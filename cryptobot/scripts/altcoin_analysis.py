#!/usr/bin/env python3
"""How does the strategy do on altcoins? Three angles (reports/altcoins.json).

1. Attribution - where v4's P&L actually came from: BTC, ETH, large / mid /
   small alts (Binance 2019-2026 and Bitfinex 2014-2018).
2. One coin at a time - the trend engine run on every coin that was ever in
   the top-50 liquid universe (incl. delisted: LUNA, FTT, ...), each over its
   own life, against simply holding that coin. Untuned: the three v4 lookback
   sets averaged, 35% vol target, same costs.
3. Alt-only portfolio - v4 forbidden from holding BTC and ETH (they still
   drive the regime filter), and a mid-cap variant without the 15 largest coins.

All of this re-uses data already seen during development, so it describes
behaviour; it is not new out-of-sample evidence.
"""
from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from cryptobot import metrics as M  # noqa: E402
from cryptobot.backtest import CostModel, simulate  # noqa: E402
from cryptobot.data import load_panel  # noqa: E402
from cryptobot.data_bitfinex import load_panel_bitfinex  # noqa: E402
from cryptobot.research import trim_panel  # noqa: E402
from cryptobot.strategy import (Params, _trend_score, ensemble_weights,  # noqa: E402
                                ffill_within_life, single_asset_weights)
from research_v4 import S, adv_of, run_v4, v4_params, window  # noqa: E402

REPORTS = ROOT / "reports"
MAJORS = ("BTCUSDT", "ETHUSDT")


# ------------------------------------------------------------------ 1. attribution
def attribution(panel: dict, res, start: str, end: str | None) -> dict:
    close = panel["close"]
    life = ffill_within_life(close)
    r = life.pct_change(fill_method=None)
    held = res.weights.shift(1).fillna(0.0)
    contrib = (held * r).fillna(0.0)
    sel = (contrib.index >= pd.Timestamp(start, tz="UTC"))
    if end:
        sel &= contrib.index <= pd.Timestamp(end, tz="UTC")
    contrib, held = contrib[sel], held[sel]
    adv = adv_of(panel).reindex_like(close)[sel]
    hist = close.notna().cumsum()[sel]
    alts = [c for c in close.columns if c not in MAJORS]
    alt_rank = adv[alts].where(hist[alts] >= 200).rank(axis=1, ascending=False)
    group = pd.DataFrame("other", contrib.index, contrib.columns)
    for c in MAJORS:
        if c in group.columns:
            group[c] = c[:-4]
    group[alts] = np.where(alt_rank <= 10, "alts: top-10",
                           np.where(alt_rank <= 30, "alts: 11-30", "alts: 31+"))
    total = float(contrib.values.sum())
    out = {"gross_pnl_sum": round(total, 4), "groups": {}}
    for g in ["BTC", "ETH", "alts: top-10", "alts: 11-30", "alts: 31+"]:
        m = group == g
        c = float(contrib.where(m).sum().sum())
        out["groups"][g] = {"share_of_pnl": round(c / total, 3) if total else None,
                            "avg_weight": round(float(held.where(m).sum(axis=1).mean()), 4)}
    per_coin = contrib.sum().sort_values()
    out["top_contributors"] = {k: round(float(v), 4) for k, v in per_coin.tail(10)[::-1].items()}
    out["worst_contributors"] = {k: round(float(v), 4) for k, v in per_coin.head(8).items()}
    yr = contrib.groupby(contrib.index.year)
    out["by_year"] = {int(y): {"BTC+ETH": round(float(d[[c for c in MAJORS if c in d]].sum().sum()), 4),
                               "alts": round(float(d[[c for c in d.columns if c not in MAJORS]].sum().sum()), 4)}
                      for y, d in yr}
    coins_held = (held > 0.002).any()
    out["coins_ever_held"] = int(coins_held.sum())
    out["share_of_held_coins_profitable"] = round(float((per_coin[coins_held[coins_held].index] > 0).mean()), 3)
    return out


# ------------------------------------------------------------------ 2. one coin at a time
def single_coin_weights(close: pd.Series, btc_trend: pd.Series | None, lookback_sets,
                        target_vol: float = 0.35) -> pd.Series:
    """The trend engine on one coin: the three v4 lookback sets averaged;
    optionally scaled by the same BTC regime filter v4 uses."""
    w = sum(single_asset_weights(close, replace(Params(), lookbacks=lb, target_vol=target_vol))
            for lb in lookback_sets) / len(lookback_sets)
    if btc_trend is not None:
        w = w * np.clip(0.5 + btc_trend.reindex(w.index), 0, 1).fillna(0.5)
    return w.clip(0, 1)


def one_coin_study(panel: dict, coins: list[str], cost: CostModel, min_days: int = 730,
                   warmup: int = 365) -> pd.DataFrame:
    close = panel["close"]
    adv = adv_of(panel)
    ep = v4_params()
    btc = ffill_within_life(close[["BTCUSDT"]])
    lr = np.log(btc).diff()
    btc_tr = sum(_trend_score(btc, lb, lr.rolling(max(lb), min_periods=20).std())["BTCUSDT"]
                 for lb in ep.lookback_sets) / len(ep.lookback_sets)
    rows = []
    for c in coins:
        px = close[c].dropna()
        if len(px) < min_days:
            continue
        start = px.index[warmup]
        end = px.index[-1]
        cl = close[[c]].loc[:end]
        a = adv[[c]].loc[:end]
        bh_t = pd.DataFrame(np.nan, cl.index, [c])
        bh_t.loc[start, c] = 1.0
        bh = simulate(bh_t, cl, a, cost, start=start).returns
        rec = {"coin": c, "start": str(start.date()), "end": str(end.date()),
               "delisted": bool(end < close.index[-1] - pd.Timedelta(days=5)),
               "median_adv_musd": round(float(a[c].loc[start:].median() / 1e6), 2)}
        for name, bt in [("trend", None), ("trend_regime", btc_tr)]:
            w = single_coin_weights(px, None if c == "BTCUSDT" else bt, ep.lookback_sets).to_frame(c)
            tr = simulate(w, cl, a, cost, band=0.05, start=start).returns
            s = M.summary(tr)
            rec.update({f"{name}_{k}": s[k] for k in ["CAGR", "Sharpe", "MaxDD", "total_return"]})
            rec[f"{name}_exposure"] = float(w[c].loc[start:].mean())
        s = M.summary(bh)
        rec.update({f"hold_{k}": s[k] for k in ["CAGR", "Sharpe", "MaxDD", "total_return"]})
        rows.append(rec)
    return pd.DataFrame(rows)


def summarise_coins(df: pd.DataFrame, engine: str = "trend_regime") -> dict:
    if df.empty:
        return {}
    alts = df[~df.coin.isin(MAJORS)]

    def block(d):
        return {
            "n_coins": int(len(d)),
            "n_delisted": int(d.delisted.sum()),
            "median_sharpe": {"hold": round(float(d.hold_Sharpe.median()), 2),
                              "trend": round(float(d[f"{engine}_Sharpe"].median()), 2)},
            "median_CAGR": {"hold": round(float(d.hold_CAGR.median()), 3),
                            "trend": round(float(d[f"{engine}_CAGR"].median()), 3)},
            "median_maxDD": {"hold": round(float(d.hold_MaxDD.median()), 3),
                             "trend": round(float(d[f"{engine}_MaxDD"].median()), 3)},
            "share_trend_sharpe_beats_hold": round(float((d[f"{engine}_Sharpe"] > d.hold_Sharpe).mean()), 3),
            "share_trend_return_beats_hold": round(float((d[f"{engine}_total_return"] > d.hold_total_return).mean()), 3),
            "share_trend_smaller_drawdown": round(float((d[f"{engine}_MaxDD"] > d.hold_MaxDD).mean()), 3),
            "share_hold_lost_money": round(float((d.hold_total_return < 0).mean()), 3),
            "share_trend_lost_money": round(float((d[f"{engine}_total_return"] < 0).mean()), 3),
            "share_trend_sharpe_above_0.5": round(float((d[f"{engine}_Sharpe"] > 0.5).mean()), 3),
        }
    out = {"all_alts": block(alts)}
    liquid = alts[alts.median_adv_musd >= 20]
    if len(liquid):
        out["liquid_alts_adv_ge_20M"] = block(liquid)
    out["delisted_alts"] = block(alts[alts.delisted]) if alts.delisted.any() else {}
    for c in MAJORS:
        r = df[df.coin == c]
        if len(r):
            r = r.iloc[0]
            out[c] = {k: round(float(r[k]), 3) for k in
                      ["hold_Sharpe", f"{engine}_Sharpe", "hold_CAGR", f"{engine}_CAGR",
                       "hold_MaxDD", f"{engine}_MaxDD"]}
    return out


# ------------------------------------------------------------------ 3. alt-only portfolios
def ew_alts(panel: dict, cost: CostModel, start, end) -> pd.Series:
    close = panel["close"]
    adv = adv_of(panel)
    hist = close.notna().cumsum()
    cols = [c for c in close.columns if c not in MAJORS]
    rk = adv[cols].where((hist[cols] >= 200) & close[cols].notna()).rank(axis=1, ascending=False)
    w = (rk <= 10).astype(float)
    w = w.div(w.sum(axis=1).replace(0, np.nan), axis=0)
    ms = w.index.to_series().dt.month.diff().fillna(1).ne(0)
    w[~ms.values] = np.nan
    w = w.reindex(columns=close.columns)
    return simulate(w, close, adv, cost, start=start, end=end).returns


def portfolio_variants(panel: dict, cost: CostModel, periods: dict) -> dict:
    ep = v4_params()
    close = panel["close"]
    adv = adv_of(panel)
    hist = close.notna().cumsum()
    top15 = adv.where(hist >= 200).rank(axis=1, ascending=False) <= 15
    variants = {
        "v4 (as frozen)": ensemble_weights(panel, ep),
        "v4 alts only (no BTC, ETH)": ensemble_weights(panel, ep, exclude=list(MAJORS)),
        "v4 without the 15 largest coins": ensemble_weights(panel, ep, exclude=top15),
    }
    out = {}
    for pname, (s, e) in periods.items():
        out[pname] = {}
        for vname, w in variants.items():
            res = run_v4(panel, ep, cost, weights=w)
            out[pname][vname] = S(window(res.returns, s, e), res)
        btc = window(close["BTCUSDT"].pct_change(fill_method=None).fillna(0), s, e)
        out[pname]["BTC buy & hold"] = S(btc)
        out[pname]["equal-weight top-10 alts (monthly)"] = S(ew_alts(panel, cost, s, e))
    return out


def main():
    out = {}
    # ---------------- Binance
    pb = trim_panel(load_panel("1d"))
    ep = v4_params()
    cost = CostModel(aum_usd=100_000)
    res = run_v4(pb, ep, cost)
    out["attribution_binance_2019_2026"] = attribution(pb, res, "2019-01-01", None)
    # coins that were ever in the top-50 liquid universe
    adv = adv_of(pb)
    hist = pb["close"].notna().cumsum()
    in50 = (adv.where(hist >= 200).rank(axis=1, ascending=False) <= 50).any()
    coins = [c for c in in50[in50].index]
    oc = one_coin_study(pb, coins, CostModel(aum_usd=10_000))
    oc.to_csv(REPORTS / "altcoins_one_coin_binance.csv", index=False)
    out["one_coin_binance"] = {"trend_with_btc_regime": summarise_coins(oc, "trend_regime"),
                               "trend_pure": summarise_coins(oc, "trend")}
    out["portfolios_binance"] = portfolio_variants(
        pb, cost, {"2019-2024 (development)": ("2019-01-01", "2024-12-31"),
                   "2025-2026 (holdout)": ("2025-01-01", None)})
    # ---------------- Bitfinex
    pf = load_panel_bitfinex(end="2018-12-31")
    cost_f = CostModel(fee_bps=20, aum_usd=100_000)
    res_f = run_v4(pf, ep, cost_f)
    out["attribution_bitfinex_2014_2018"] = attribution(pf, res_f, "2014-01-01", "2018-12-31")
    oc_f = one_coin_study(pf, [c for c in pf["close"].columns], CostModel(fee_bps=20, aum_usd=10_000),
                          min_days=500, warmup=250)
    oc_f.to_csv(REPORTS / "altcoins_one_coin_bitfinex.csv", index=False)
    out["one_coin_bitfinex"] = {"trend_with_btc_regime": summarise_coins(oc_f, "trend_regime"),
                                "trend_pure": summarise_coins(oc_f, "trend")}
    out["portfolios_bitfinex"] = portfolio_variants(
        pf, cost_f, {"2017-2018 (alts available)": ("2017-01-01", "2018-12-31")})
    (REPORTS / "altcoins.json").write_text(json.dumps(out, indent=2, default=str))
    print(json.dumps(out, indent=1, default=str))


if __name__ == "__main__":
    main()
