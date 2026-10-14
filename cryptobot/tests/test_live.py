import json
import os

import numpy as np
import pandas as pd
import pytest

from cryptobot.live import (LiveBroker, PaperAccount, append_csv, check_fresh, load_strategy,
                            plan_orders, run_lock)
from cryptobot.strategy import EnsembleParams


class FakeExchange:
    """Minimal ccxt-like exchange: fills market orders at fixed prices."""

    def __init__(self, balances, prices, fail=()):
        self.bal = dict(balances)
        self.px = prices
        self.fail = set(fail)
        self.orders = []
        self.has = {"createMarketBuyOrderWithCost": True}

    def fetch_balance(self):
        return {"total": dict(self.bal), "free": dict(self.bal)}

    def market(self, sym):
        return {"limits": {"cost": {"min": 5.0}}}

    def amount_to_precision(self, sym, amount):
        return f"{np.floor(amount * 1e6) / 1e6:.6f}"

    def create_order(self, sym, typ, side, amount):
        base = sym.split("/")[0]
        if base in self.fail:
            raise RuntimeError("exchange rejected")
        px = self.px[base]
        if side == "sell":
            assert amount <= self.bal.get(base, 0) + 1e-9, "oversold"
            self.bal[base] -= amount
            self.bal["USDT"] += amount * px
        self.orders.append((side, base, amount))
        return {"id": str(len(self.orders))}

    def create_market_buy_order_with_cost(self, sym, cost):
        base = sym.split("/")[0]
        if base in self.fail:
            raise RuntimeError("exchange rejected")
        assert cost <= self.bal["USDT"] + 1e-9, "insufficient USDT"
        self.bal["USDT"] -= cost
        self.bal[base] = self.bal.get(base, 0) + cost / self.px[base]
        self.orders.append(("buy", base, cost))
        return {"id": str(len(self.orders))}


@pytest.fixture
def live_env(monkeypatch):
    monkeypatch.setenv("CRYPTOBOT_LIVE", "I_UNDERSTAND_THE_RISK")


def test_live_broker_sells_first_full_exit_and_caps_buys(live_env):
    ex = FakeExchange({"USDT": 100.0, "AAA": 10.0, "BBB": 5.0}, {"AAA": 50.0, "BBB": 20.0, "CCC": 10.0})
    br = LiveBroker(ex)
    prices = pd.Series({"AAAUSDT": 50.0, "BBBUSDT": 20.0, "CCCUSDT": 10.0})
    nav, cur = br.positions(prices)
    assert np.isclose(nav, 100 + 500 + 100)
    target = pd.Series({"CCCUSDT": 0.9})                  # exit AAA and BBB, buy CCC
    deltas = plan_orders(target, cur, band=0.05)
    fills = br.execute(deltas, target, prices, nav)
    sides = [o[0] for o in ex.orders]
    assert sides.index("buy") > max(i for i, s in enumerate(sides) if s == "sell")
    assert ex.bal["AAA"] == 0 and ex.bal["BBB"] == 0      # full exits sell everything
    assert ex.bal["USDT"] >= 0                              # buys never exceed free cash
    assert all(f["status"] == "ok" for f in fills)


def test_live_broker_one_failure_does_not_abort_others(live_env):
    ex = FakeExchange({"USDT": 1000.0}, {"AAA": 10.0, "BBB": 10.0}, fail={"AAA"})
    br = LiveBroker(ex)
    prices = pd.Series({"AAAUSDT": 10.0, "BBBUSDT": 10.0})
    target = pd.Series({"AAAUSDT": 0.3, "BBBUSDT": 0.3})
    fills = br.execute(plan_orders(target, pd.Series(dtype=float), 0.05), target, prices, 1000.0)
    st = {f["symbol"]: f["status"] for f in fills}
    assert st["AAAUSDT"].startswith("error") and st["BBBUSDT"] == "ok"


def test_live_broker_requires_opt_in(monkeypatch):
    monkeypatch.delenv("CRYPTOBOT_LIVE", raising=False)
    with pytest.raises(RuntimeError):
        LiveBroker(FakeExchange({"USDT": 1.0}, {}))


def test_plan_orders_min_trade_and_gaps():
    tgt = pd.Series({"A": 0.001, "B": 0.0, "C": 0.2})
    cur = pd.Series({"B": 0.1, "C": 0.0})
    d = plan_orders(tgt, cur, band=0.05, min_trade=0.002, tradable=pd.Index(["A", "C"]))
    assert "A" not in d.index        # dust entry skipped
    assert "B" not in d.index        # no price today -> cannot trade (gap)
    assert np.isclose(d["C"], 0.2)


def test_stale_data_guard():
    now = pd.Timestamp("2026-10-14 00:10", tz="UTC")
    check_fresh(pd.Timestamp("2026-10-13", tz="UTC"), now)
    with pytest.raises(RuntimeError):
        check_fresh(pd.Timestamp("2026-10-11", tz="UTC"), now)


def test_append_csv_keeps_columns_aligned(tmp_path):
    f = tmp_path / "t.csv"
    append_csv(f, [{"a": 1, "b": 2}])
    append_csv(f, [{"b": 3, "a": 4}])                # different key order
    append_csv(f, [{"a": 5, "b": 6, "c": 7}])        # new column
    df = pd.read_csv(f)
    assert list(df.columns) == ["a", "b", "c"]
    assert df["a"].tolist() == [1, 4, 5] and df["b"].tolist() == [2, 3, 6]


def test_run_lock_is_exclusive(tmp_path):
    with run_lock(tmp_path / ".lock"):
        with pytest.raises(RuntimeError):
            with run_lock(tmp_path / ".lock"):
                pass


def test_paper_liquidates_delisted_at_haircut(tmp_path):
    acct = PaperAccount(tmp_path / "s.json", 0.0, {"XUSDT": 10.0})
    fills = acct.liquidate_missing(pd.Series({"YUSDT": 1.0}), pd.Series({"XUSDT": 2.0}))
    assert np.isclose(acct.cash, 18.0) and not acct.units and fills[0]["side"] == "DELIST"


def test_frozen_configs_load_and_hash_checked(tmp_path):
    root = os.path.join(os.path.dirname(__file__), "..")
    ep = load_strategy(os.path.join(root, "frozen_config_v4.json"))
    assert isinstance(ep, EnsembleParams) and ep.tranches == 7
    bad = json.loads(open(os.path.join(root, "frozen_config_v4.json")).read())
    bad["params"]["target_vol"] = 0.9
    (tmp_path / "bad.json").write_text(json.dumps(bad))
    with pytest.raises(ValueError):
        load_strategy(tmp_path / "bad.json")
