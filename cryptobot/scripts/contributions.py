#!/usr/bin/env python3
"""Regular contributions, tax and long-run projections.

    python scripts/contributions.py                      # $1,000 + $300 a week, USD
    python scripts/contributions.py --aud --weekly 500   # A$1,000 + A$500 a week, Australian tax

1. History: the plan replayed on Binance data with the full simulator - pro-
   rata deposit handling vs the old behaviour, and Binance's ~$5 minimum order
   - against buying BTC weekly or leaving the money in cash.
   With ``--aud`` the deposits are Australian dollars converted to USDT at the
   day's exchange rate (FRED DEXUSAL) less 0.1%, values are in AUD, and
   Australian capital gains tax (cryptobot/tax_au.py) is paid out of the
   account every 31 October. Also shown: the "growth" risk profile, buying BTC
   weekly (taxed only when sold) and a 50/50 split between the two.
2. Projection: $10,000 (and the contribution plan) over 20 years, by block-
   bootstrapping v4's own daily returns (2014-2026, three records), under three
   explicit assumptions about the future:
     * "history repeats"  - the record as it was (crypto's hyper-growth years)
     * "base case"        - historical risk, half the historical average return
                            (the usual ~50% haircut for backtested strategies,
                            Harvey & Liu 2015)
     * "recent regime"    - the average return of 2025-26 only, the weakest period
   These are scenarios, not forecasts. With ``--aud`` they assume AUD/USD ends
   where it starts, and an after-tax version treats each year's gain as
   realised and taxed at the marginal rate (losses carried forward).
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from cryptobot.backtest import CostModel, simulate  # noqa: E402
from cryptobot.data import load_audusd, load_panel  # noqa: E402
from cryptobot.research import trim_panel  # noqa: E402
from cryptobot.strategy import ensemble_weights  # noqa: E402
from cryptobot.tax_au import (Ledger, account_ledger, annual_tax, due_date,  # noqa: E402
                              tax_on_gain)
from research_v4 import adv_of, v4_params  # noqa: E402

REPORTS = ROOT / "reports"
FX_COST = 0.001          # AUD -> USDT conversion of each deposit
BTC_COST = 0.0013        # fee + spread on each BTC purchase
GROWTH_VOL = 0.50        # the "growth" risk profile (scripts/paper_trade.py)


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


def history(panel: dict, w: pd.DataFrame, start: str, start_cash: float, weekly: float) -> dict:
    """USD plan: deposit handling variants and simple alternatives."""
    ep = v4_params()
    close, adv = panel["close"], adv_of(panel, ep.adv_window)
    s = pd.Timestamp(start, tz="UTC")
    days = close.index[close.index >= s]
    deposits = pd.Series(weekly, days[7::7])
    out = {}
    cost = CostModel(aum_usd=start_cash)
    for name, mode, min_usd in [("fixed: pro-rata deposits, $5 minimum order", "prorata", 5.0),
                                ("ideal: pro-rata, no minimum order", "prorata", 0.0),
                                ("old behaviour: deposits wait for the 5% band", "naive", 5.0)]:
        r = simulate(w, close, adv, cost, band=ep.band, min_trade=ep.min_trade, start=s,
                     flows=deposits, initial_usd=start_cash, min_order_usd=min_usd, flow_mode=mode)
        final = float(r.nav_usd.iloc[-1])
        cfs = [(days[0], -start_cash)] + [(d, -weekly) for d in deposits.index] + [(days[-1], final)]
        out[name] = {"contributed": round(start_cash + weekly * len(deposits), 0),
                     "final_value": round(final, 0), "money_weighted_return": round(xirr(cfs), 4),
                     "avg_exposure": round(float(r.exposure.mean()), 3)}
    # alternatives: buy BTC every week (same costs) / keep it in cash
    btc = close["BTCUSDT"].loc[s:]
    units = start_cash / btc.iloc[0] * (1 - BTC_COST)
    for d in deposits.index:
        units += weekly / btc.loc[d] * (1 - BTC_COST)
    final = float(units * btc.iloc[-1])
    cfs = [(days[0], -start_cash)] + [(d, -weekly) for d in deposits.index] + [(days[-1], final)]
    out["alternative: buy BTC every week and hold"] = {
        "contributed": round(start_cash + weekly * len(deposits), 0), "final_value": round(final, 0),
        "money_weighted_return": round(xirr(cfs), 4)}
    out["alternative: cash (0%)"] = {"contributed": round(start_cash + weekly * len(deposits), 0),
                                     "final_value": round(start_cash + weekly * len(deposits), 0)}
    return out


# ---------------------------------------------------------------- AUD + tax
def drawdowns(value: pd.Series, index: pd.Series) -> dict:
    """Biggest fall in account value (deposits included) and in the
    deposit-free return index, and the longest spell below a previous high."""
    fall = value.cummax() - value
    trough = fall.idxmax()
    peak = value.loc[:trough].idxmax()
    dd = index / index.cummax() - 1
    under = (dd < -1e-9).astype(int)
    spell = under.groupby((under == 0).cumsum()).sum()
    return {"largest_fall_in_value": round(float(fall.max()), 0),
            "fall_from": str(peak.date()), "fall_to": str(trough.date()),
            "value_at_peak": round(float(value[peak]), 0),
            "value_at_trough": round(float(value[trough]), 0),
            "max_drawdown_of_returns": round(float(dd.min()), 3),
            "longest_spell_below_a_high_days": int(spell.max())}


def plan_deposits(days: pd.DatetimeIndex, start_cash: float, weekly: float, rate: pd.Series):
    """Initial and weekly deposits in AUD and as USDT received."""
    local = pd.Series(float(weekly), days[7::7])
    usd = local * rate.reindex(local.index).values * (1 - FX_COST)
    return float(start_cash * rate.iloc[0] * (1 - FX_COST)), local, usd


def unpaid(tbl: pd.DataFrame, end: pd.Timestamp) -> float:
    """Tax for financial years not yet due by ``end``."""
    fys = [fy for fy in tbl.index if due_date(fy) > end]
    return float(tbl.loc[fys, "tax"].sum()) if fys else 0.0


def bot_account(w, close, adv, ep, days, start_cash, weekly, rate, income) -> dict:
    """The bot on a plan: pre-tax, and with tax paid out of the account."""
    init_usd, dep_local, dep_usd = plan_deposits(days, start_cash, weekly, rate)
    cost = CostModel(aum_usd=init_usd)

    def run(paid: dict):
        fu, fl = dep_usd.copy(), dep_local.copy()
        for d, a in paid.items():
            fu.loc[d] = fu.get(d, 0.0) - a * rate[d]
            fl.loc[d] = fl.get(d, 0.0) - a
        fu, fl = fu.sort_index(), fl.sort_index()
        res = simulate(w, close, adv, cost, band=ep.band, min_trade=ep.min_trade, start=days[0],
                       flows=fu, initial_usd=init_usd, min_order_usd=5.0, flow_mode="prorata",
                       record_trades=True)
        return res, fu, fl

    end = days[-1]
    res, fu, fl = run({})
    to_aud = lambda s: s / rate.reindex(s.index).values
    pre_value = to_aud(res.nav_usd)
    index = to_aud((1 + res.returns).cumprod())
    out = {"contributed": start_cash + float(dep_local.sum()), "value": pre_value, "index": index,
           "avg_exposure": float(res.exposure.mean()), "deposits": dep_local}
    paid, done = {}, set()
    while True:                       # pay each financial year's tax in turn, re-simulating
        led = account_ledger(res, close, rate, init_usd, start_cash, fu, fl)
        tax = annual_tax(led.events, income)
        added = False
        for fy in tax.index:
            if fy in done or due_date(fy) > end:
                continue
            done.add(fy)
            if tax.loc[fy, "tax"] > 0.5:
                paid[due_date(fy)] = float(tax.loc[fy, "tax"])
                added = True
                break
        if not added:
            break
        res, fu, fl = run(paid)
    liq = account_ledger(res, close, rate, init_usd, start_cash, fu, fl, liquidate=True)
    final = float(res.nav_usd.iloc[-1] / rate.iloc[-1])
    out.update(paid=paid, tax_table=tax, events=led.events, events_liq=liq.events, final_taxed=final,
               after_tax_holding=final - unpaid(tax, end),
               after_tax_sold=final - unpaid(annual_tax(liq.events, income), end))
    return out


def btc_account(close, days, start_cash, weekly, rate) -> dict:
    """Buy BTC every week and hold (taxed only when sold)."""
    btc = close["BTCUSDT"].reindex(days).ffill()
    buys = pd.concat([pd.Series(float(start_cash), days[:1]), pd.Series(float(weekly), days[7::7])])
    units = buys * rate.reindex(buys.index).values * (1 - BTC_COST) / btc.reindex(buys.index).values
    value = units.reindex(days).fillna(0.0).cumsum() * btc / rate.reindex(days).values
    led = Ledger()
    for d, u in units.items():
        led.buy(d, "BTC", u, buys[d])
    led.sell(days[-1], "BTC", None, float(value.iloc[-1]))
    return {"contributed": float(buys.sum()), "value": value, "events_liq": led.events,
            "index": btc / rate.reindex(days).values, "deposits": buys.iloc[1:]}


def summarise(name, contributed, value, index, deposits, start_cash, days,
              after_tax_sold=None, after_tax_holding=None, tax_paid=None, extra=None) -> dict:
    mwr = lambda final: xirr([(days[0], -start_cash)] + [(d, -a) for d, a in deposits.items()]
                             + [(days[-1], final)])
    final = float(value.iloc[-1])
    out = {"plan": name, "contributed": round(contributed, 0), "value_before_tax": round(final, 0),
           "money_weighted_return_before_tax": round(mwr(final), 4)}
    if tax_paid is not None:
        out["tax_paid_out_of_the_account"] = round(tax_paid, 0)
    if after_tax_holding is not None:
        out["after_tax_still_holding"] = round(after_tax_holding, 0)
    if after_tax_sold is not None:
        out["after_tax_if_all_sold_at_the_end"] = round(after_tax_sold, 0)
        out["money_weighted_return_after_tax_if_sold"] = round(mwr(after_tax_sold), 4)
    out.update(extra or {})
    out["drawdowns"] = drawdowns(value, index)
    return out


def aud_history(panel, weights: dict, start: str, start_cash: float, weekly: float,
                rate: pd.Series, income: float) -> dict:
    ep = v4_params()
    close, adv = panel["close"], adv_of(panel, ep.adv_window)
    days = close.index[close.index >= pd.Timestamp(start, tz="UTC")]
    rate = rate.reindex(days).ffill().bfill()
    end = days[-1]
    rows = []
    bots = {}
    for prof, w in weights.items():
        b = bot_account(w, close, adv, ep, days, start_cash, weekly, rate, income)
        bots[prof] = b
        rows.append(summarise(f"bot ({prof})", b["contributed"], b["value"], b["index"],
                              b["deposits"], start_cash, days, b["after_tax_sold"],
                              b["after_tax_holding"], sum(b["paid"].values()),
                              {"avg_exposure": round(b["avg_exposure"], 3)}))
    bt = btc_account(close, days, start_cash, weekly, rate)
    btc_tax = unpaid(annual_tax(bt["events_liq"], income), end)
    rows.append(summarise("buy BTC every week and hold", bt["contributed"], bt["value"], bt["index"],
                          bt["deposits"], start_cash, days, float(bt["value"].iloc[-1]) - btc_tax,
                          float(bt["value"].iloc[-1]), 0.0))
    # 50/50: half the plan in the bot, half in BTC; the final tax year is shared
    hb = bot_account(weights["balanced"], close, adv, ep, days, start_cash / 2, weekly / 2, rate, income)
    hc = btc_account(close, days, start_cash / 2, weekly / 2, rate)
    value = hb["value"] + hc["value"]
    taxed_final = hb["final_taxed"] + float(hc["value"].iloc[-1])
    split_tax = unpaid(annual_tax(hb["events_liq"] + hc["events_liq"], income), end)
    split_hold = unpaid(annual_tax(hb["events"], income), end)
    idx = (value / value.shift(1)).fillna(1.0)
    dep = hb["deposits"] + hc["deposits"].reindex(hb["deposits"].index).fillna(0.0)
    adj = idx - dep.reindex(value.index).fillna(0.0) / value.shift(1).fillna(1.0)   # strip deposits
    rows.append(summarise("50/50: bot (balanced) + BTC weekly", hb["contributed"] + hc["contributed"],
                          value, adj.cumprod(), dep, start_cash, days, taxed_final - split_tax,
                          taxed_final - split_hold, sum(hb["paid"].values())))
    contributed = rows[0]["contributed"]
    rows.append({"plan": "cash under the mattress (0%)", "contributed": contributed,
                 "value_before_tax": contributed})
    yearly = {}
    for name, v in [("bot (balanced)", bots["balanced"]["value"]), ("BTC weekly", bt["value"])]:
        ye = v.groupby(v.index.year).last()
        yearly[name] = {int(k): round(float(x), 0) for k, x in ye.items()}
    dep_all = pd.concat([pd.Series(float(start_cash), days[:1]), bots["balanced"]["deposits"]])
    yearly["contributed"] = {int(k): round(float(x), 0) for k, x in
                             dep_all.groupby(dep_all.index.year).sum().cumsum().items()}
    taxes = {str(d.date()): round(a, 0) for d, a in bots["balanced"]["paid"].items()}
    return {"start": str(days[0].date()), "end": str(end.date()), "plans": rows,
            "year_end_values": yearly, "bot_balanced_tax_payments": taxes}


# ---------------------------------------------------------------- projections
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


def project(daily: np.ndarray, start: float, weekly: float, years: int,
            income: float | None = None) -> np.ndarray:
    """Account value at each year-end for every path (deposits weekly). With
    ``income``, each year's gain is taxed as realised at the marginal rate
    on top of that income, losses carried forward."""
    n, T = daily.shape
    v = np.full(n, start, dtype=float)
    yearly = np.empty((n, years))
    v0, added, carry = v.copy(), np.zeros(n), np.zeros(n)
    for t in range(T):
        v *= 1 + daily[:, t]
        if weekly and (t + 1) % 7 == 0:
            v += weekly
            added += weekly
        if (t + 1) % 365 == 0:
            if income is not None:
                gain = v - v0 - added - carry
                v -= tax_on_gain(gain, income)
                carry = np.maximum(-gain, 0.0)
                v0, added = v.copy(), np.zeros(n)
            yearly[:, (t + 1) // 365 - 1] = v
    return yearly


def projections(start_cash: float, weekly: float, income: float | None) -> dict:
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
    pct = lambda a, q: [round(float(x), 0) for x in np.percentile(a, q, axis=0)]
    for k, (name, shift) in enumerate(scen.items()):
        paths = bootstrap_paths((rec + shift).values, 20, 4000, 60, seed=k)
        lump = project(paths, 10_000.0, 0.0, 20)
        dca = project(paths, start_cash, weekly, 20)
        g = np.median((1 + paths).prod(axis=1)) ** (1 / 20) - 1
        s = out["scenarios"][name] = {
            "median_annual_growth": round(float(g), 4),
            "lump_10k_median_by_year": pct(lump, 50),
            "lump_10k_p10_by_year": pct(lump, 10),
            "lump_10k_p90_by_year": pct(lump, 90),
            "lump_10k_share_of_paths_below_10k_at_year_5": round(float((lump[:, 4] < 10_000).mean()), 3),
            "dca_median_by_year": pct(dca, 50),
            "dca_p10_by_year": pct(dca, 10),
            "dca_p90_by_year": pct(dca, 90),
            "dca_share_of_paths_below_contributions_at_year_5":
                round(float((dca[:, 4] < start_cash + weekly * (5 * 365 // 7)).mean()), 3),
        }
        if income is not None:
            taxed = project(paths, start_cash, weekly, 20, income)
            s["dca_after_tax_median_by_year"] = pct(taxed, 50)
            s["dca_after_tax_p10_by_year"] = pct(taxed, 10)
            s["dca_after_tax_p90_by_year"] = pct(taxed, 90)
    out["dca_contributed_by_year"] = [start_cash + weekly * (365 * (y + 1) // 7) for y in range(20)]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weekly", type=float, default=300.0)
    ap.add_argument("--start-cash", type=float, default=1_000.0)
    ap.add_argument("--aud", action="store_true",
                    help="Australian dollars and Australian capital gains tax")
    ap.add_argument("--income", type=float, default=100_000.0,
                    help="--aud: other taxable income that the gains sit on top of")
    ap.add_argument("--out", help="output file (default reports/contributions[_aud_<weekly>].json)")
    a = ap.parse_args()
    panel = trim_panel(load_panel("1d"))
    ep = v4_params()
    w = ensemble_weights(panel, ep)
    cur = "A$" if a.aud else "$"
    out = {"plan": f"{cur}{a.start_cash:,.0f} start + {cur}{a.weekly:,.0f} every week"}
    if a.aud:
        rate = load_audusd()
        weights = {"balanced": w, "growth": ensemble_weights(panel, replace(ep, target_vol=GROWTH_VOL))}
        out["assumptions"] = {
            "currency": "AUD; deposits converted to USDT at the day's rate (FRED DEXUSAL) less 0.1%",
            "tax": f"Australian CGT, FIFO parcels, 50% discount after 12 months, losses carried "
                   f"forward, 2026-27 resident rates + 2% Medicare on top of A${a.income:,.0f} of "
                   f"other income, each year's tax paid out of the account on 31 October",
            "btc": "BTC bought with AUD weekly (0.13% cost), never sold until the end",
            "in_sample_warning": "2019-2024 is v4's development period: replays from 2019 are "
                                 "in-sample and flatter the bot"}
        for start in ["2019-01-01", "2025-01-01"]:
            out[f"history_from_{start[:4]}"] = aud_history(panel, weights, start, a.start_cash,
                                                          a.weekly, rate, a.income)
        out["projection_20y"] = projections(a.start_cash, a.weekly, a.income)
        default = REPORTS / f"contributions_aud_{a.weekly:.0f}.json"
    else:
        out["history_from_2019"] = history(panel, w, "2019-01-01", a.start_cash, a.weekly)
        out["history_from_2025"] = history(panel, w, "2025-01-01", a.start_cash, a.weekly)
        out["projection_20y"] = projections(a.start_cash, a.weekly, None)
        default = REPORTS / "contributions.json"
    path = Path(a.out) if a.out else default
    path.write_text(json.dumps(out, indent=2, default=str))
    print(json.dumps({k: v for k, v in out.items() if k != "projection_20y"}, indent=1, default=str))
    p = out["projection_20y"]
    print("record", p["record"])
    for name, s in p["scenarios"].items():
        print(name, "median growth", s["median_annual_growth"], "| plan median after 5/10/20y:",
              s["dca_median_by_year"][4], s["dca_median_by_year"][9], s["dca_median_by_year"][19],
              "| after tax:", [s.get("dca_after_tax_median_by_year", [None] * 20)[i] for i in (4, 9, 19)])
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
