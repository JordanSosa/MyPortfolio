import numpy as np
import pandas as pd

from cryptobot.backtest import CostModel, simulate
from cryptobot.tax_au import Ledger, account_ledger, annual_tax, fin_year, income_tax, tax_on_gain

D = lambda s: pd.Timestamp(s, tz="UTC")
ZERO = CostModel(fee_bps=0, base_slip_bps=0, max_slip_bps=0, aum_usd=0)


def test_income_tax_2026_27_rates_with_medicare():
    assert np.isclose(income_tax(18_200), 18_200 * 0.02)
    assert np.isclose(income_tax(100_000), 4_020 + 0.30 * 55_000 + 2_000)
    assert np.isclose(income_tax(200_000), 51_370 + 0.45 * 10_000 + 4_000)
    assert np.isclose(tax_on_gain(10_000, 100_000), 3_200)            # 30% + 2%
    assert np.isclose(tax_on_gain(-5_000, 100_000), 0.0)


def test_fifo_parcels_and_twelve_month_discount():
    led = Ledger()
    led.buy(D("2020-01-01"), "X", 1.0, 100.0)
    led.buy(D("2020-06-01"), "X", 1.0, 200.0)
    led.sell(D("2021-03-01"), "X", 1.5, 450.0)
    (d1, _, p1, c1, g1, disc1), (d2, _, p2, c2, g2, disc2) = led.events
    assert (p1, c1, g1, disc1) == (300.0, 100.0, 200.0, True)          # oldest parcel first
    assert np.isclose(p2, 150.0) and np.isclose(c2, 100.0) and not disc2
    assert np.isclose(led.total["X"], 0.5)


def test_discount_needs_more_than_a_year_excluding_both_days():
    for sold, eligible in [("2021-07-01", False), ("2021-07-02", True)]:
        led = Ledger()
        led.buy(D("2020-07-01"), "X", 1.0, 100.0)
        led.sell(D(sold), "X", None, 150.0)
        assert led.events[0][5] is eligible


def test_losses_hit_non_discount_gains_first_then_carry_forward():
    ev = [(D("2021-01-10"), "A", 2_000, 1_000, 1_000, False),          # FY2021
          (D("2021-02-10"), "B", 3_000, 1_000, 2_000, True),
          (D("2021-03-10"), "C", 500, 2_000, -1_500, False),
          (D("2021-09-10"), "D", 0, 3_000, -3_000, False),             # FY2022: loss only
          (D("2022-09-10"), "E", 2_000, 1_000, 1_000, False)]          # FY2023
    t = annual_tax(ev, 100_000)
    assert np.isclose(t.loc[2021, "net_capital_gain"], 0.5 * 1_500)    # 1,000 offset fully, 1,500 halved
    assert np.isclose(t.loc[2022, "tax"], 0) and np.isclose(t.loc[2022, "loss_carried"], 3_000)
    assert np.isclose(t.loc[2023, "net_capital_gain"], 0) and np.isclose(t.loc[2023, "loss_carried"], 2_000)
    assert fin_year(D("2021-06-30")) == 2021 and fin_year(D("2021-07-01")) == 2022


def test_record_trades_reconcile_with_holdings_and_cash():
    rng = np.random.default_rng(3)
    idx = pd.date_range("2021-01-01", periods=120, freq="D", tz="UTC")
    close = pd.DataFrame(100 * np.exp(np.cumsum(rng.normal(0, 0.03, (120, 3)), 0)), idx, list("XYZ"))
    tg = pd.DataFrame(rng.dirichlet([1, 1, 1, 2], 120)[:, :3], idx, list("XYZ")).iloc[::5].reindex(idx)
    adv = pd.DataFrame(1e12, idx, list("XYZ"))
    flows = pd.Series([500.0, -300.0, 2_000.0, -1_500.0], idx[[10, 31, 52, 90]])
    res = simulate(tg, close, adv, ZERO, band=0.02, flows=flows, initial_usd=1_000.0,
                   record_trades=True)
    H = res.weights.mul(res.nav_usd, axis=0)                          # dollar holdings
    r = close.pct_change().fillna(0.0)
    np.testing.assert_allclose(H.values[1:], (H.shift(1) * (1 + r)).values[1:] + res.trades_usd.values[1:],
                               atol=1e-6)
    cash = res.nav_usd - H.sum(axis=1)
    f = flows.reindex(idx).fillna(0.0)
    np.testing.assert_allclose(cash.values[1:], (cash.shift(1) - res.trades_usd.sum(axis=1) + f).values[1:],
                               atol=1e-6)


def test_account_ledger_gain_in_aud():
    idx = pd.date_range("2021-01-01", periods=3, freq="D", tz="UTC")
    close = pd.DataFrame({"X": [100.0, 120.0, 120.0]}, idx)
    tg = pd.DataFrame({"X": [0.5, 0.0, np.nan]}, idx)
    adv = pd.DataFrame({"X": [1e12] * 3}, idx)
    res = simulate(tg, close, adv, ZERO, initial_usd=1_000.0, record_trades=True)
    rate = pd.Series(0.5, idx)                                        # 1 AUD = 0.5 USD
    led = account_ledger(res, close, rate, initial_usd=1_000.0, initial_aud=2_000.0)
    coin = [e for e in led.events if e[1] == "X"]
    assert len(coin) == 1 and np.isclose(coin[0][4], 2 * 100.0)       # $100 USD gain = A$200
    assert all(np.isclose(e[4], 0.0) for e in led.events if e[1] == "USDT")   # flat FX: no USDT gain
