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


# ----------------------------------------------------------------- audit fixes / v4
from cryptobot.strategy import EnsembleParams, ensemble_weights, equity_like  # noqa: E402


def test_temporary_gap_is_not_a_delisting():
    """A held coin with a 2-day data gap must be carried (no haircut, no trade)
    and the full move across the gap booked when trading resumes."""
    idx = pd.date_range("2021-01-01", periods=6, freq="D", tz="UTC")
    close = pd.DataFrame({"X": [100, 100, np.nan, np.nan, 150, 150.0]}, idx)
    tg = pd.DataFrame({"X": [1.0, 1.0, 0.0, 0.0, 1.0, 1.0]}, idx)  # targets 0 during gap
    adv = pd.DataFrame({"X": [1e12] * 6}, idx)
    zero = CostModel(fee_bps=0, base_slip_bps=0, aum_usd=0)
    res = simulate(tg, close, adv, zero)
    assert np.isclose(M.equity(res.returns).iloc[-1], 1.5)        # +50% across the gap
    assert res.turnover.iloc[2] == 0 and res.turnover.iloc[3] == 0  # no trading in the gap


def test_ensemble_no_lookahead_truncation_invariance():
    panel = synthetic_panel()
    ep = EnsembleParams(min_history=100, universe_sizes=(5, 8), top_ks=(2, 4),
                        lookback_sets=((10, 20, 40, 80), (20, 40, 80, 160)))
    full = ensemble_weights(panel, ep)
    for cut in [300, 452, 640]:
        trunc = {k: v.iloc[:cut] for k, v in panel.items()}
        np.testing.assert_allclose(ensemble_weights(trunc, ep).iloc[-1].values,
                                   full.iloc[cut - 1].values, atol=1e-12)


def test_ensemble_is_mean_of_members():
    from cryptobot.strategy import members, target_weights
    panel = synthetic_panel()
    ep = EnsembleParams(min_history=100, universe_sizes=(8,), top_ks=(3,),
                        lookback_sets=((10, 20, 40, 80),), tranches=7)
    ens = ensemble_weights(panel, ep)
    mean = sum(target_weights(panel, m) for m in members(ep)) / len(members(ep))
    np.testing.assert_allclose(ens.values, mean.values, atol=1e-12)


def test_tokenised_equities_excluded_but_coins_kept():
    idx = pd.date_range("2025-01-01", periods=600, freq="D", tz="UTC")
    rng = np.random.default_rng(3)
    r = rng.normal(0, 0.03, (600, 3))
    weekend = idx.dayofweek >= 5
    r[weekend, 0] *= 0.1                                   # stock token: quiet weekends
    close = pd.DataFrame(100 * np.exp(np.cumsum(r, 0)), idx, ["NVDABUSDT", "BNBUSDT", "ARBUSDT"])
    close.loc[close.index < pd.Timestamp("2026-06-11", tz="UTC"), "NVDABUSDT"] = np.nan
    m = equity_like(close)
    assert m["NVDABUSDT"].iloc[-1]
    assert not m["BNBUSDT"].any() and not m["ARBUSDT"].any()


def test_cash_yield_accrues_on_idle_cash_only():
    idx = pd.date_range("2021-01-01", periods=366, freq="D", tz="UTC")
    close = pd.DataFrame({"X": np.full(366, 100.0)}, idx)
    tg = pd.DataFrame({"X": [0.5] + [np.nan] * 365}, idx)
    adv = pd.DataFrame({"X": [1e12] * 366}, idx)
    zero = CostModel(fee_bps=0, base_slip_bps=0, aum_usd=0)
    res = simulate(tg, close, adv, zero, cash_rate=pd.Series(0.04, idx))
    # ~50% in cash at 4% for a year -> ~ +2%
    assert 0.019 < M.equity(res.returns).iloc[-1] - 1 < 0.021


def test_min_trade_skips_dust_but_not_exits():
    idx = pd.date_range("2021-01-01", periods=3, freq="D", tz="UTC")
    close = pd.DataFrame({"X": [100.0] * 3, "Y": [100.0] * 3}, idx)
    tg = pd.DataFrame({"X": [0.001, 0.001, 0.0], "Y": [0.5, 0.5, 0.0]}, idx)
    adv = pd.DataFrame({"X": [1e12] * 3, "Y": [1e12] * 3}, idx)
    res = simulate(tg, close, adv, CostModel(fee_bps=0, base_slip_bps=0, aum_usd=0), min_trade=0.002)
    assert res.weights["X"].max() == 0          # dust entry skipped
    assert res.weights["Y"].iloc[-1] == 0       # exit always executed


def test_equity_rule_uses_true_listing_date_in_short_live_windows():
    """In a live window that starts after June 2026 every coin's first price
    is the window start; with listing metadata BNB must stay eligible and the
    stock token must stay excluded."""
    idx = pd.date_range("2028-03-01", periods=400, freq="D", tz="UTC")
    rng = np.random.default_rng(5)
    r = rng.normal(0, 0.03, (400, 2))
    r[idx.dayofweek >= 5, 0] *= 0.1                   # stock token: quiet weekends
    r[idx.dayofweek >= 5, 1] *= 0.6                   # BNB with unusually quiet weekends
    close = pd.DataFrame(100 * np.exp(np.cumsum(r, 0)), idx, ["NVDABUSDT", "BNBUSDT"])
    listed = pd.Series({"NVDABUSDT": pd.Timestamp("2026-06-11", tz="UTC"),
                        "BNBUSDT": pd.Timestamp("2017-11-06", tz="UTC")})
    m = equity_like(close, listed)
    assert m["NVDABUSDT"].iloc[-1] and not m["BNBUSDT"].any()
