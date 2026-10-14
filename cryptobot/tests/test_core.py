import numpy as np
import pandas as pd
import pytest

from cryptobot import metrics as M
from cryptobot.backtest import CostModel, simulate
from cryptobot.live import PaperAccount, plan_orders
from cryptobot.strategy import Params, compute_features, target_weights


def synthetic_panel(n_assets=12, days=700, seed=1):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2020-01-01", periods=days, freq="D", tz="UTC")
    syms = ["BTCUSDT"] + [f"A{i}USDT" for i in range(n_assets - 1)]
    drift = rng.normal(0, 0.002, n_assets)
    r = rng.normal(drift, 0.04, (days, n_assets))
    close = pd.DataFrame(100 * np.exp(np.cumsum(r, 0)), idx, syms)
    close.iloc[:150, 5] = np.nan            # late listing
    close.iloc[500:, 7] = np.nan            # delisting
    qv = pd.DataFrame(rng.uniform(1e6, 1e8, (days, n_assets)), idx, syms).where(close.notna())
    return {"open": close, "high": close, "low": close, "close": close,
            "volume": qv / close, "quote_volume": qv}


def test_no_lookahead_truncation_invariance():
    """Weights at date t must be identical whether or not future data exists."""
    panel = synthetic_panel()
    p = Params(min_history=100, universe_size=8, top_k=4)
    full = target_weights(panel, p)
    for cut in [300, 451, 620]:
        trunc = {k: v.iloc[:cut] for k, v in panel.items()}
        w = target_weights(trunc, p)
        np.testing.assert_allclose(w.iloc[-1].values, full.iloc[cut - 1].values, atol=1e-12)


def test_weights_long_only_and_unlevered():
    panel = synthetic_panel()
    w = target_weights(panel, Params(min_history=100, universe_size=8, top_k=4))
    assert (w.values >= -1e-12).all()
    assert (w.sum(axis=1) <= 1 + 1e-9).all()


def test_simulator_buy_and_hold_matches_price_path():
    idx = pd.date_range("2021-01-01", periods=5, freq="D", tz="UTC")
    close = pd.DataFrame({"X": [100, 110, 99, 120, 120.0]}, idx)
    tg = pd.DataFrame({"X": [1.0, np.nan, np.nan, np.nan, np.nan]}, idx)
    adv = pd.DataFrame({"X": [1e12] * 5}, idx)
    zero = CostModel(fee_bps=0, base_slip_bps=0, aum_usd=0)
    res = simulate(tg, close, adv, zero)
    assert np.isclose(M.equity(res.returns).iloc[-1], 1.2)


def test_simulator_charges_costs_and_haircuts_delisting():
    idx = pd.date_range("2021-01-01", periods=4, freq="D", tz="UTC")
    close = pd.DataFrame({"X": [100, 100, np.nan, np.nan]}, idx)
    tg = pd.DataFrame({"X": [1.0, np.nan, np.nan, np.nan]}, idx)
    adv = pd.DataFrame({"X": [1e12] * 4}, idx)
    c = CostModel(fee_bps=10, base_slip_bps=0, aum_usd=0, max_slip_bps=0)
    res = simulate(tg, close, adv, c, delist_haircut=0.5)
    eq = M.equity(res.returns)
    assert np.isclose(eq.iloc[0], 0.999)
    assert np.isclose(eq.iloc[-1], 0.999 * 0.5)


def test_live_order_plan_matches_simulator_band():
    tgt = pd.Series({"A": 0.30, "B": 0.0, "C": 0.12})
    cur = pd.Series({"A": 0.28, "B": 0.05, "D": 0.01})
    d = plan_orders(tgt, cur, band=0.05)
    assert set(d.index) == {"B", "C", "D"}       # A within band, B/D exits, C entry
    assert np.isclose(d["B"], -0.05) and np.isclose(d["C"], 0.12)


def test_paper_account_round_trip(tmp_path):
    acct = PaperAccount(tmp_path / "s.json", 1000.0, {}, CostModel(fee_bps=0, base_slip_bps=0, aum_usd=0))
    px = pd.Series({"AUSDT": 10.0})
    acct.execute(pd.Series({"AUSDT": 0.5}), px, pd.Series({"AUSDT": 1e12}))
    assert np.isclose(acct.nav(px), 1000.0)
    assert np.isclose(acct.weights(px)["AUSDT"], 0.5)


def test_pbo_detects_pure_noise():
    rng = np.random.default_rng(0)
    trials = pd.DataFrame(rng.normal(0, 0.01, (1600, 40)))
    out = M.pbo_cscv(trials, n_splits=8)
    assert 0.3 < out["PBO"] < 0.7   # noise -> ~50% chance of overfit
