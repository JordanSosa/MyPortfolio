import json
import os

import numpy as np
import pandas as pd
import pytest

from cryptobot.live import (LiveBroker, PaperAccount, append_csv, check_complete, check_fresh,
                            claim_account, load_strategy, plan_orders, run_lock)
from cryptobot.strategy import EnsembleParams


class FakeExchange:
    """Minimal ccxt-like exchange: fills market orders at fixed prices."""

    id = "fake"

    def __init__(self, balances, prices, fail=(), inactive=(), timeout=()):
        self.bal = dict(balances)
        self.px = prices
        self.fail = set(fail)
        self.timeout = set(timeout)
        self.orders = []
        self.has = {"createMarketBuyOrderWithCost": True}
        self.markets = {f"{b}/USDT": {"active": b not in set(inactive),
                                      "limits": {"cost": {"min": 5.0}}}
                        for b in set(prices) | set(balances) if b != "USDT"}

    def fetch_ticker(self, sym):
        return {"last": self.px.get(sym.split("/")[0])}

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
        import ccxt
        base = sym.split("/")[0]
        if base in self.fail:
            raise RuntimeError("exchange rejected")
        if base in self.timeout:
            raise ccxt.RequestTimeout("timed out after the exchange accepted it")
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


def test_paper_carries_gaps_and_delists_only_after_a_week(tmp_path):
    acct = PaperAccount(tmp_path / "s.json", 0.0, {"XUSDT": 10.0}, last_px={"XUSDT": 2.0})
    day = pd.Timestamp("2026-01-01", tz="UTC")
    today = pd.Series({"YUSDT": 1.0})                       # X has no price today
    assert acct.update_gaps(today, pd.Series({"XUSDT": 2.0}), day) == []
    assert np.isclose(acct.nav(today), 20.0)                # carried at last price
    for k in range(1, 6):
        assert acct.update_gaps(today, pd.Series({"XUSDT": 2.0}), day + pd.Timedelta(days=k)) == []
    fills = acct.update_gaps(today, pd.Series({"XUSDT": 2.0}), day + pd.Timedelta(days=6))
    assert fills and fills[0]["side"] == "DELIST" and np.isclose(acct.cash, 18.0)


def test_paper_gap_resumes_without_loss(tmp_path):
    acct = PaperAccount(tmp_path / "s.json", 0.0, {"XUSDT": 10.0}, last_px={"XUSDT": 2.0})
    d = pd.Timestamp("2026-01-01", tz="UTC")
    acct.update_gaps(pd.Series(dtype=float), pd.Series({"XUSDT": 2.0}), d)
    acct.update_gaps(pd.Series({"XUSDT": 2.2}), pd.Series({"XUSDT": 2.2}), d + pd.Timedelta(days=1))
    assert not acct.missing and np.isclose(acct.nav(pd.Series({"XUSDT": 2.2})), 22.0)


def test_check_complete_blocks_partial_panels():
    idx = pd.date_range("2026-01-01", periods=3, freq="D", tz="UTC")
    cols = ["BTCUSDT", "ETHUSDT"] + [f"C{i}USDT" for i in range(40)]
    close = pd.DataFrame(1.0, idx, cols)
    check_complete(close, held=["ETHUSDT"])                       # complete: fine
    bad = close.copy(); bad.loc[idx[-1], "BTCUSDT"] = np.nan
    with pytest.raises(RuntimeError, match="BTCUSDT"):
        check_complete(bad, held=[])                              # regime input missing
    bad = close.copy(); bad.loc[idx[-1], "ETHUSDT"] = np.nan
    with pytest.raises(RuntimeError, match="held"):
        check_complete(bad, held=["ETHUSDT"])                     # held coin unpriced
    check_complete(bad, held=["ETHUSDT"], grace={"ETHUSDT": "2026-01-03"})  # known gap
    bad = close.copy(); bad.loc[idx[-1], cols[2:8]] = np.nan
    with pytest.raises(RuntimeError, match="priced"):
        check_complete(bad, held=[])                              # coverage < 95%


def test_live_positions_values_unpriced_holding_via_ticker_and_drops_dust(live_env):
    ex = FakeExchange({"USDT": 6_000.0, "AAA": 10.0, "BBB": 0.0001, "CCC": 5.0},
                      {"AAA": 300.0, "BBB": 20_000.0, "CCC": 100.0}, inactive={"CCC"})
    br = LiveBroker(ex)
    prices = pd.Series({"BBBUSDT": 20_000.0})                    # AAA missing from the panel
    nav, w = br.positions(prices, min_trade=0.002)
    assert np.isclose(nav, 6_000 + 3_000 + 2.0)                  # AAA via ticker, BBB dust counted
    assert "AAAUSDT" in w.index and "BBBUSDT" not in w.index     # dust is not a position
    assert br.dust == ["BBBUSDT"] and br.unpriced_inactive == ["CCCUSDT"]


def test_dust_does_not_block_re_entry(live_env):
    ex = FakeExchange({"USDT": 1_000.0, "AAA": 0.00001}, {"AAA": 100.0})
    br = LiveBroker(ex)
    nav, cur = br.positions(pd.Series({"AAAUSDT": 100.0}), min_trade=0.002)
    d = plan_orders(pd.Series({"AAAUSDT": 0.03}), cur, band=0.05, min_trade=0.002)
    assert "AAAUSDT" in d.index                                  # opening rule fires again


def test_unknown_order_outcome_never_overspends(live_env):
    ex = FakeExchange({"USDT": 1_000.0}, {"AAA": 10.0, "BBB": 10.0}, timeout={"AAA"})
    br = LiveBroker(ex)
    target = pd.Series({"AAAUSDT": 0.6, "BBBUSDT": 0.3})
    fills = br.execute(plan_orders(target, pd.Series(dtype=float), 0.05), target,
                       pd.Series({"AAAUSDT": 10.0, "BBBUSDT": 10.0}), 1_000.0)
    st = {f["symbol"]: f for f in fills}
    assert st["AAAUSDT"]["status"].startswith("UNKNOWN")
    # AAA ($600) may have filled, so only $995 - $600 = $395 may go to BBB
    assert st["BBBUSDT"]["cost"] <= 1_000 * 0.995 - 600 + 1e-6


def test_account_claimed_by_one_strategy(tmp_path):
    claim_account(tmp_path, "binance-v4")
    claim_account(tmp_path, "binance-v4")
    with pytest.raises(RuntimeError):
        claim_account(tmp_path, "binance-v4-growth")
    claim_account(tmp_path, "binance-v4-growth", take_over=True)


def test_append_csv_handles_empty_existing_file(tmp_path):
    f = tmp_path / "t.csv"
    f.write_text("")
    append_csv(f, [{"a": 1}])
    assert pd.read_csv(f)["a"].tolist() == [1]


def test_frozen_configs_load_and_hash_checked(tmp_path):
    root = os.path.join(os.path.dirname(__file__), "..")
    ep = load_strategy(os.path.join(root, "frozen_config_v4.json"))
    assert isinstance(ep, EnsembleParams) and ep.tranches == 7
    bad = json.loads(open(os.path.join(root, "frozen_config_v4.json")).read())
    bad["params"]["target_vol"] = 0.9
    (tmp_path / "bad.json").write_text(json.dumps(bad))
    with pytest.raises(ValueError):
        load_strategy(tmp_path / "bad.json")
