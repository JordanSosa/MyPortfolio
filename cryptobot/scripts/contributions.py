#!/usr/bin/env python3
"""Regular contributions and long-run projections (reports/contributions.json).

1. History: a real-world plan ($1,000 start + $300 every week) replayed on
   Binance data with the full simulator - pro-rata deposit handling vs the old
   behaviour, and Binance's ~$5 minimum order - against simply buying BTC
   weekly or leaving the money in cash.
2. Projection: $10,000 (and the contribution plan) over 20 years, by block-
   bootstrapping v4's own daily returns (2014-2026, three records), under three
   explicit assumptions about the future:
     * "history repeats"  - the record as it was (crypto's hyper-growth years)
     * "base case"        - historical risk, half the historical average return
                            (the usual ~50% haircut for backtested strategies,
                            Harvey & Liu 2015)
     * "recent regime"    - the average return of 2025-26 only, the weakest period
   These are scenarios, not forecasts. Pre-tax, in USD.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from cryptobot.backtest import CostModel, simulate  # noqa: E402
from cryptobot.data import load_panel  # noqa: E402
from cryptobot.research import trim_panel  # noqa: E402
from cryptobot.strategy import ensemble_weights  # noqa: E402
from research_v4 import adv_of, v4_params  # noqa: E402

REPORTS = ROOT / "reports"
WEEKLY, START_CASH = 300.0, 1_000.0


def xirr(cashflows: list[tuple[pd.Timestamp, float]]) -> float:
    """Money-weighted annual return (deposits negative, final value positive)."""
    t0 = cashflows[0][0]
    yrs = np.array([(d - t0).days / 365.0 for d, _ in cashflows])
    cf = np.array([c for _, c in cashflows])
    lo, hi = -0.99, 10.0
    f = lambda r: float((cf / (1 + r) ** yrs).sum())
    for _ in range(200):
        mid = (lo + hi) / 2
        if f(lo) * f(mid) <= 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def history(panel: dict, w: pd.DataFrame, start: str) -> dict:
    ep = v4_params()
    close, adv = panel["close"], adv_of(panel, ep.adv_window)
    s = pd.Timestamp(start, tz="UTC")
    days = close.index[close.index >= s]
    deposits = pd.Series(WEEKLY, days[7::7])
    out = {}
    cost = CostModel(aum_usd=START_CASH)
    for name, mode, min_usd in [("fixed: pro-rata deposits, $5 minimum order", "prorata", 5.0),
                                ("ideal: pro-rata, no minimum order", "prorata", 0.0),
                                ("old behaviour: deposits wait for the 5% band", "naive", 5.0)]:
        r = simulate(w, close, adv, cost, band=ep.band, min_trade=ep.min_trade, start=s,
                     flows=deposits, initial_usd=START_CASH, min_order_usd=min_usd, flow_mode=mode)
        final = float(r.nav_usd.iloc[-1])
        cfs = [(days[0], -START_CASH)] + [(d, -WEEKLY) for d in deposits.index] + [(days[-1], final)]
        out[name] = {"contributed": round(START_CASH + WEEKLY * len(deposits), 0),
                     "final_value": round(final, 0), "money_weighted_return": round(xirr(cfs), 4),
                     "avg_exposure": round(float(r.exposure.mean()), 3)}
    # alternatives: buy BTC every week (same costs) / keep it in cash
    btc = close["BTCUSDT"].loc[s:]
    units = START_CASH / btc.iloc[0] * (1 - 0.0013)
    for d in deposits.index:
        units += WEEKLY / btc.loc[d] * (1 - 0.0013)
    final = float(units * btc.iloc[-1])
    cfs = [(days[0], -START_CASH)] + [(d, -WEEKLY) for d in deposits.index] + [(days[-1], final)]
    out["alternative: buy BTC every week and hold"] = {
        "contributed": round(START_CASH + WEEKLY * len(deposits), 0), "final_value": round(final, 0),
        "money_weighted_return": round(xirr(cfs), 4)}
    out["alternative: cash (0%)"] = {"contributed": round(START_CASH + WEEKLY * len(deposits), 0),
                                     "final_value": round(START_CASH + WEEKLY * len(deposits), 0)}
    return out


def v4_record() -> pd.Series:
    rd = lambda f: pd.read_csv(REPORTS / f, index_col=0, parse_dates=True)
    return pd.concat([rd("v4_fresh_returns.csv")["v4"], rd("v4_dev_returns.csv")["v4"],
                      rd("v4_holdout_returns.csv")["v4"]]).dropna()


def bootstrap_paths(r: np.ndarray, years: int, n: int, block: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    T = years * 365
    out = np.empty((n, T))
    for i in range(n):
        idx = []
        while len(idx) < T:
            s0 = rng.integers(0, len(r) - block)
            idx.extend(range(s0, s0 + block))
        out[i] = r[idx[:T]]
    return out


def project(daily: np.ndarray, start: float, weekly: float, years: int) -> np.ndarray:
    """Account value at each year-end for every path (deposits weekly)."""
    n, T = daily.shape
    v = np.full(n, start, dtype=float)
    yearly = np.empty((n, years))
    for t in range(T):
        v *= 1 + daily[:, t]
        if weekly and (t + 1) % 7 == 0:
            v += weekly
        if (t + 1) % 365 == 0:
            yearly[:, (t + 1) // 365 - 1] = v
    return yearly


def projections() -> dict:
    rec = v4_record()
    ho = pd.read_csv(REPORTS / "v4_holdout_returns.csv", index_col=0, parse_dates=True)["v4"].dropna()
    mu = rec.mean()
    scen = {"history repeats": 0.0,
            "base case (half the historical return)": -0.5 * mu,
            "recent regime (2025-26 average)": ho.mean() - mu}
    out = {"record": {"start": str(rec.index[0].date()), "end": str(rec.index[-1].date()),
                      "years": round(len(rec) / 365, 1),
                      "historical_cagr": round(float((1 + rec).prod() ** (365 / len(rec)) - 1), 4)},
           "scenarios": {}}
    for k, (name, shift) in enumerate(scen.items()):
        paths = bootstrap_paths((rec + shift).values, 20, 4000, 60, seed=k)
        lump = project(paths, 10_000.0, 0.0, 20)
        dca = project(paths, START_CASH, WEEKLY, 20)
        g = np.median((1 + paths).prod(axis=1)) ** (1 / 20) - 1
        out["scenarios"][name] = {
            "median_annual_growth": round(float(g), 4),
            "lump_10k_median_by_year": [round(float(x), 0) for x in np.median(lump, axis=0)],
            "lump_10k_p10_by_year": [round(float(x), 0) for x in np.percentile(lump, 10, axis=0)],
            "lump_10k_p90_by_year": [round(float(x), 0) for x in np.percentile(lump, 90, axis=0)],
            "lump_10k_share_of_paths_below_10k_at_year_5": round(float((lump[:, 4] < 10_000).mean()), 3),
            "dca_median_by_year": [round(float(x), 0) for x in np.median(dca, axis=0)],
            "dca_p10_by_year": [round(float(x), 0) for x in np.percentile(dca, 10, axis=0)],
            "dca_p90_by_year": [round(float(x), 0) for x in np.percentile(dca, 90, axis=0)],
        }
    out["dca_contributed_by_year"] = [START_CASH + WEEKLY * (365 * (y + 1) // 7) for y in range(20)]
    return out


def main():
    panel = trim_panel(load_panel("1d"))
    w = ensemble_weights(panel, v4_params())
    out = {"plan": f"${START_CASH:,.0f} start + ${WEEKLY:,.0f} every week",
           "history_from_2019": history(panel, w, "2019-01-01"),
           "history_from_2025": history(panel, w, "2025-01-01"),
           "projection_20y": projections()}
    (REPORTS / "contributions.json").write_text(json.dumps(out, indent=2, default=str))
    print(json.dumps({k: v for k, v in out.items() if k != "projection_20y"}, indent=1))
    p = out["projection_20y"]
    print("record", p["record"])
    for name, s in p["scenarios"].items():
        print(name, "median growth", s["median_annual_growth"], "| $10k after 5/10/20y:",
              s["lump_10k_median_by_year"][4], s["lump_10k_median_by_year"][9],
              s["lump_10k_median_by_year"][19], "| p10/p90 at 20y:", s["lump_10k_p10_by_year"][19],
              s["lump_10k_p90_by_year"][19])


if __name__ == "__main__":
    main()
