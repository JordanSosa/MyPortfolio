#!/usr/bin/env python3
"""The bot against ordinary investing, for financial independence.

    python scripts/wealth_paths.py      # -> reports/wealth_paths.json

Same take-home budget (A$500 a week, rising with inflation) for 30 years, in
today's dollars, four ways:

  1. the bot (balanced) after Australian tax - v4's own record resampled as in
     contributions.py, "base case" (half the historical return) and "recent
     regime" (2025-26 average);
  2. a low-cost diversified share index fund held outside super;
  3. salary sacrifice into super up to the concessional cap, the rest in the
     index fund outside super;
  4. that plan with 10% of the budget in the bot instead.

Shares: lognormal annual real returns, 5.0% geometric mean and 16% volatility
before costs (world shares returned 5.2% a year above inflation over
1900-2024, UBS Global Investment Returns Yearbook 2025). Index fund outside
super: 0.15% fee + 0.6% tax drag (dividends on a A$100k salary, net of
franking credits). Super: 0.3% fees + 0.3% tax drag; contributions taxed 15%.
Inflation 2.5%. Scenarios, not forecasts.
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
from contributions import REPORTS, bootstrap_paths, v4_record  # noqa: E402
from cryptobot.tax_au import tax_on_gain  # noqa: E402

YEARS, N = 30, 4000
INFL = 0.025
WEEKLY = 500.0                       # take-home dollars a week, today's money
SALARY, MARGINAL = 100_000.0, 0.32   # 30% bracket + 2% Medicare levy
SG, CAP = 0.12, 32_500.0             # 2026-27 super guarantee rate and concessional cap
EQ_REAL, EQ_VOL = 0.05, 0.16
ETF_COST = 0.0015 + 0.006            # fee + tax drag outside super
SUPER_COST = 0.003 + 0.003           # fees + tax drag inside super
TARGET = 1_500_000.0                 # e.g. A$52,500 a year at a 3.5% withdrawal rate
CHECK = (10, 15, 20, 25, 30)


def shares(budget_etf: float, budget_super: float, z: np.ndarray, real: float = EQ_REAL,
           split: bool = False):
    """Real wealth at each year end: yearly contributions (spread through the
    year) into the index fund outside and inside super (``split``: both parts)."""
    n, years = z.shape
    r_out = np.exp(np.log(1 + real - ETF_COST) + EQ_VOL * z) - 1
    r_in = np.exp(np.log(1 + real - SUPER_COST) + EQ_VOL * z) - 1
    out, sup = np.zeros(n), np.zeros(n)
    outside, inside = np.empty((n, years)), np.empty((n, years))
    for y in range(years):
        out = out * (1 + r_out[:, y]) + budget_etf * np.sqrt(1 + r_out[:, y])
        sup = sup * (1 + r_in[:, y]) + budget_super * np.sqrt(1 + r_in[:, y])
        outside[:, y], inside[:, y] = out, sup
    return (outside, inside) if split else outside + inside


def bot(daily_nominal: np.ndarray, weekly_real: float, years: int, income: float) -> np.ndarray:
    """Real wealth at each year end for the bot: weekly deposits rising with
    inflation, each year's nominal gain taxed at the marginal rate on top of
    ``income`` (brackets indexed), losses carried forward."""
    n, T = daily_nominal.shape
    v, v0, added, carry = np.zeros(n), np.zeros(n), np.zeros(n), np.zeros(n)
    yearly = np.empty((n, years))
    for t in range(T):
        level = (1 + INFL) ** ((t + 1) / 365)
        v *= 1 + daily_nominal[:, t]
        if (t + 1) % 7 == 0:
            v += weekly_real * level
            added += weekly_real * level
        if (t + 1) % 365 == 0:
            gain = v - v0 - added - carry
            v -= tax_on_gain(gain / level, income) * level
            carry = np.maximum(-gain, 0.0)
            v0, added = v.copy(), np.zeros(n)
            yearly[:, (t + 1) // 365 - 1] = v / level
    return yearly


def summary(w: np.ndarray, contributed_per_year: float) -> dict:
    pct = lambda q: {y: round(float(np.percentile(w[:, y - 1], q)), -3) for y in CHECK}
    hit = w >= TARGET
    first = np.where(hit.any(axis=1), hit.argmax(axis=1) + 1, np.inf)   # never reached = infinite
    med = float(np.median(first))
    return {"median": pct(50), "p10": pct(10), "p90": pct(90),
            "chance_of_target_by_year": {y: round(float(hit[:, y - 1].mean()), 3) for y in (15, 20, 25, 30)},
            "median_years_to_target": med if np.isfinite(med) else None,
            "contributed_per_year_today_dollars": round(contributed_per_year, 0)}


def years_to_target(weekly: float, spending: float, real: float, swr: float = 0.035) -> float:
    """Deterministic years until savings at a steady real return reach spending / swr."""
    c, goal = weekly * 52, spending / swr
    return float(np.log(1 + goal * real / c) / np.log(1 + real))


def main():
    budget = WEEKLY * 52
    room = CAP - SG * SALARY                              # concessional room left after SG
    sacrifice = min(room, budget / (1 - MARGINAL))        # pre-tax dollars
    to_super = sacrifice * 0.85
    to_etf = budget - sacrifice * (1 - MARGINAL)
    rng = np.random.default_rng(7)
    z = rng.standard_normal((N, YEARS))
    rec = v4_record()
    ho = pd.read_csv(REPORTS / "v4_holdout_returns.csv", index_col=0, parse_dates=True)["v4"].dropna()
    mu = rec.mean()
    out = {"assumptions": {
        "budget": f"A${WEEKLY:,.0f} a week take-home, rising with inflation; values in today's dollars",
        "inflation": INFL, "salary": SALARY, "marginal_rate": MARGINAL,
        "shares": f"lognormal real returns, {EQ_REAL:.1%} geometric mean, {EQ_VOL:.0%} volatility",
        "index_fund_outside_super_cost": ETF_COST, "super_cost": SUPER_COST,
        "salary_sacrifice": {"pre_tax": round(sacrifice), "into_super_after_15pc_tax": round(to_super),
                             "take_home_cost": round(sacrifice * (1 - MARGINAL)),
                             "left_for_index_fund": round(to_etf)},
        "target": TARGET, "years": YEARS, "paths": N}, "plans": {}}
    plans = out["plans"]
    tenth = {}
    for name, shift, seed in [("bot, base case", -0.5 * mu, 1), ("bot, recent regime", ho.mean() - mu, 2)]:
        paths = bootstrap_paths((rec + shift).values, YEARS, N, 60, seed=seed)
        plans[name] = summary(bot(paths, WEEKLY, YEARS, SALARY), budget)
        tenth[name] = bot(paths, WEEKLY * 0.1, YEARS, SALARY)
    plans["index fund outside super"] = summary(shares(budget, 0.0, z), budget)
    outside, inside = shares(to_etf, to_super, z, split=True)
    plans["salary sacrifice to super + index fund"] = summary(outside + inside, to_etf + to_super)
    plans["salary sacrifice to super + index fund"]["median_outside_super"] = {
        y: round(float(np.median(outside[:, y - 1])), -3) for y in CHECK}
    rest = shares(to_etf - 0.1 * budget, to_super, z)
    for name, b in tenth.items():
        plans[f"super + index fund, 10% in the bot ({name.split(', ')[1]})"] = summary(
            rest + b, to_etf + to_super)
    for real in (0.04, 0.06):
        plans[f"index fund outside super, shares {real:.0%} real"] = summary(shares(budget, 0.0, z, real), budget)
    net = (1 + EQ_REAL - ETF_COST) - 1
    out["years_to_independence"] = {
        "assumption": f"steady {net:.2%} real return after costs, 3.5% withdrawal rate",
        "rows_weekly_invested": {f"A${w:,.0f}": {f"A${s/1000:.0f}k a year": round(years_to_target(w, s, net), 1)
                                                for s in (40_000, 60_000, 80_000)}
                                 for w in (500, 700, 1_000, 1_500)}}
    (REPORTS / "wealth_paths.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
