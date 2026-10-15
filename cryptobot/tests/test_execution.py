import numpy as np
import pandas as pd

from cryptobot.execution import liquidity_cap


def test_liquidity_cap_binds_only_for_thin_markets():
    tgt = pd.Series({"BIG": 0.2, "THIN": 0.2})
    adv = pd.Series({"BIG": 50e6, "THIN": 20_000.0})
    out = liquidity_cap(tgt, adv, nav_usd=100_000)
    assert out["BIG"] == 0.2                       # 10% of $50M >> $20k position
    assert np.isclose(out["THIN"], 0.02)            # 10% of $20k = $2k = 2% of NAV


def test_liquidity_cap_array_form_and_unknown_adv():
    out = liquidity_cap(np.array([0.3, 0.3]), np.array([np.nan, 1e9]), nav_usd=1e6)
    assert out[0] == 0.0 and out[1] == 0.3          # unknown liquidity -> no position


def test_simulator_liquidity_cap():
    from cryptobot.backtest import CostModel, simulate
    idx = pd.date_range("2021-01-01", periods=3, freq="D", tz="UTC")
    close = pd.DataFrame({"X": [1.0, 1.0, 1.0]}, idx)
    tg = pd.DataFrame({"X": [0.5, 0.5, 0.5]}, idx)
    adv = pd.DataFrame({"X": [100_000.0] * 3}, idx)            # $100k/day
    cm = CostModel(fee_bps=0, base_slip_bps=0, aum_usd=1_000_000, max_slip_bps=0)
    res = simulate(tg, close, adv, cm, max_participation=0.10)
    assert np.isclose(res.weights["X"].iloc[0], 0.01)           # $10k of a $1M account
    assert np.isclose(simulate(tg, close, adv, cm).weights["X"].iloc[0], 0.5)  # off by default


# ----------------------------------------------------------------- deposits / withdrawals
from cryptobot.execution import detect_flow, flow_deltas  # noqa: E402


def test_deposit_is_invested_pro_rata_keeping_the_mix():
    pre = pd.Series({"AUSDT": 0.20, "BUSDT": 0.05})        # 75% cash
    nav_pre, flow = 10_000.0, 10_000.0
    d = flow_deltas(flow, pre, nav_pre + flow, min_order_usd=5)
    diluted = pre * nav_pre / (nav_pre + flow)
    np.testing.assert_allclose((diluted + d).values, pre.values)   # weights unchanged
    assert np.isclose(d["AUSDT"] * 20_000, 2_000)                 # $2,000 of the deposit into A


def test_deposit_top_ups_below_exchange_minimum_stay_in_cash():
    pre = pd.Series({"AUSDT": 0.20, "BUSDT": 0.01})
    d = flow_deltas(300.0, pre, 1_300.0, min_order_usd=5)
    assert "AUSDT" in d.index and "BUSDT" not in d.index          # $3 top-up skipped


def test_small_withdrawal_comes_from_cash_large_one_trims_pro_rata():
    pre = pd.Series({"AUSDT": 0.20, "BUSDT": 0.05})
    assert flow_deltas(-500.0, pre, 9_500.0).empty                  # 5%: cash only
    d = flow_deltas(-5_000.0, pre, 5_000.0)                         # 50%: trim
    np.testing.assert_allclose((pre * 2 + d).values, pre.values)    # weights back to the mix


def test_detect_flow_ignores_trades_and_noise():
    px = pd.Series({"AUSDT": 10.0, "BUSDT": 2.0})
    units = {"AUSDT": 100.0, "BUSDT": 500.0}                       # $2,000 in coins
    assert detect_flow(10_000.0, 8_000.0, units, px) == 0.0         # nothing changed
    assert detect_flow(10_003.0, 8_000.0, units, px) == 0.0         # $3 of noise
    assert np.isclose(detect_flow(10_300.0, 8_000.0, units, px), 300.0)   # weekly deposit
    assert np.isclose(detect_flow(7_000.0, 8_000.0, units, px), -3_000.0)  # withdrawal


def test_simulator_deposit_naive_vs_pro_rata():
    from cryptobot.backtest import CostModel, simulate
    idx = pd.date_range("2021-01-01", periods=4, freq="D", tz="UTC")
    close = pd.DataFrame({"X": [1.0] * 4}, idx)
    tg = pd.DataFrame({"X": [0.08] * 4}, idx)                    # a typical small position
    adv = pd.DataFrame({"X": [1e12] * 4}, idx)
    cm = CostModel(fee_bps=0, base_slip_bps=0, aum_usd=0, max_slip_bps=0)
    flows = pd.Series({idx[2]: 10_000.0})
    pr = simulate(tg, close, adv, cm, band=0.05, flows=flows, initial_usd=10_000)
    nv = simulate(tg, close, adv, cm, band=0.05, flows=flows, initial_usd=10_000, flow_mode="naive")
    assert np.isclose(pr.weights["X"].iloc[2], 0.08)             # deposit invested pro rata
    assert np.isclose(nv.weights["X"].iloc[2], 0.04)             # naive: diluted, 4pp gap < 5pp band
    assert np.isclose(pr.nav_usd.iloc[-1], 20_000)


def test_simulator_min_order_usd_skips_small_entries():
    from cryptobot.backtest import CostModel, simulate
    idx = pd.date_range("2021-01-01", periods=2, freq="D", tz="UTC")
    close = pd.DataFrame({"X": [1.0, 1.0], "Y": [1.0, 1.0]}, idx)
    tg = pd.DataFrame({"X": [0.003, 0.003], "Y": [0.2, 0.2]}, idx)    # $3 and $200 on $1,000
    adv = pd.DataFrame({"X": [1e12] * 2, "Y": [1e12] * 2}, idx)
    cm = CostModel(fee_bps=0, base_slip_bps=0, aum_usd=0, max_slip_bps=0)
    r = simulate(tg, close, adv, cm, initial_usd=1_000, min_order_usd=5)
    assert r.weights["X"].max() == 0 and np.isclose(r.weights["Y"].iloc[0], 0.2)
