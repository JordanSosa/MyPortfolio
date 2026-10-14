#!/usr/bin/env python3
"""Tune / qualify the single-asset trend mode for one coin.

    python scripts/tune_asset.py SOLUSDT
    python scripts/tune_asset.py ETHUSDT --holdout-start 2025-01-01

Steps (same discipline as the portfolio research):
1. Eligibility gates - enough history and liquidity.
2. Grid of lookback sets x vol targets, walk-forward by calendar year with
   the plateau selection rule, data after --holdout-start never used.
3. Holdout gate on data after --holdout-start (never used for selection).
4. Verdict against the single-asset benchmarks; writes
   configs/<SYMBOL>.json if it qualifies (used by paper_trade.py --asset).
"""
import argparse
import itertools
import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cryptobot import metrics as M  # noqa: E402
from cryptobot.backtest import CostModel, simulate  # noqa: E402
from cryptobot.data import download_symbol, load_panel  # noqa: E402
from cryptobot.strategy import Params, single_asset_weights  # noqa: E402

LOOKBACKS = [(10, 20, 40, 80), (20, 40, 80, 160), (40, 80, 160, 320)]
VOLS = [0.3, 0.5, 0.8]
MIN_DAYS = 730
MIN_ADV = 20e6


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("symbol")
    ap.add_argument("--holdout-start", default="2025-01-01")
    ap.add_argument("--aum", type=float, default=100_000)
    a = ap.parse_args()
    sym = a.symbol.upper()
    download_symbol(sym, "1d")
    panel = load_panel("1d", [sym])
    close = panel["close"][sym].dropna()
    adv = panel["quote_volume"][sym].rolling(30, min_periods=10).median()
    dev = close[close.index < pd.Timestamp(a.holdout_start, tz="UTC")]

    gates = {
        "history_days": int(len(dev)), "history_ok": len(dev) >= MIN_DAYS,
        "adv_usd_now": float(adv.iloc[-1]), "liquidity_ok": float(adv.iloc[-1]) >= MIN_ADV,
    }
    # trend persistence: variance ratio of 20-day vs 1-day returns (>1 = trending)
    lr = np.log(dev).diff().dropna()
    vr = float(lr.rolling(20).sum().var() / (20 * lr.var()))
    gates["variance_ratio_20d"] = round(vr, 3)

    cost = CostModel(aum_usd=a.aum)
    trials, cfgs = {}, {}
    for lb, v in itertools.product(LOOKBACKS, VOLS):
        p = replace(Params(), lookbacks=lb, target_vol=v)
        k = f"L{'-'.join(map(str, lb))}_V{v}"
        w = single_asset_weights(close, p).to_frame(sym)
        res = simulate(w, close.to_frame(sym), adv.to_frame(sym), cost, band=p.band)
        trials[k], cfgs[k] = res.returns, p
    trials = pd.DataFrame(trials)
    trials = trials[trials.index >= close.index[0] + pd.Timedelta(days=200)]
    devt = trials[trials.index < pd.Timestamp(a.holdout_start, tz="UTC")]

    def plateau(df):
        s = df.apply(M.sharpe)
        out = {}
        for k in df:
            lb, v = k.split("_V")
            nb = [j for j in df if (j.split("_V")[0] == lb) ^ (j.split("_V")[1] == v)]
            out[k] = float(np.mean([s[k]] + [s[j] for j in nb]))
        return pd.Series(out)

    years = sorted(set(devt.index.year))[1:]
    oos, log = [], []
    for y in years:
        tr = devt[devt.index.year < y]
        if len(tr) < 365:
            continue
        best = plateau(tr).idxmax()
        te = devt.loc[devt.index.year == y, best]
        oos.append(te)
        log.append({"year": y, "chosen": best, "test_sharpe": round(M.sharpe(te), 3)})
    oos = pd.concat(oos) if oos else pd.Series(dtype=float)
    bh = close.pct_change().reindex(oos.index).fillna(0)
    final = plateau(devt).idxmax()
    ho = trials.loc[trials.index >= pd.Timestamp(a.holdout_start, tz="UTC"), final]
    bh_ho = close.pct_change().reindex(ho.index).fillna(0)

    s_oos, s_bh = M.summary(oos), M.summary(bh)
    verdict = {
        "S1_history_and_liquidity": gates["history_ok"] and gates["liquidity_ok"],
        "S2_wf_sharpe_ge_0.8": s_oos["Sharpe"] >= 0.8,
        "S3_beats_buy_hold_sharpe": s_oos["Sharpe"] > s_bh["Sharpe"],
        "S4_maxdd_le_60pct_of_buy_hold": s_oos["MaxDD"] >= 0.6 * s_bh["MaxDD"],
        "S5_positive_in_most_wf_years": float(np.mean([r["test_sharpe"] > 0 for r in log])) >= 0.6,
        # validation gate on data never used for selection (mirrors protocol B9)
        "S6_holdout_sharpe_ge_half_wf_and_positive": bool(
            len(ho) > 180 and M.sharpe(ho) > 0 and M.sharpe(ho) >= 0.5 * s_oos["Sharpe"]),
    }
    qualified = all(verdict.values())
    report = {"symbol": sym, "gates": gates, "walk_forward": log,
              "wf_oos": {k: round(v, 4) if isinstance(v, float) else v for k, v in s_oos.items()},
              "wf_buy_hold": {k: round(v, 4) if isinstance(v, float) else v for k, v in s_bh.items()},
              "final_config": final,
              "holdout": {k: round(v, 4) if isinstance(v, float) else v
                          for k, v in M.summary(ho).items()} if len(ho) > 30 else None,
              "holdout_buy_hold_sharpe": round(M.sharpe(bh_ho), 4) if len(ho) > 30 else None,
              "verdict": verdict, "qualified": qualified}
    print(json.dumps(report, indent=1))
    if qualified:
        (ROOT / "configs").mkdir(exist_ok=True)
        cfg = cfgs[final].to_dict()
        (ROOT / "configs" / f"{sym}.json").write_text(json.dumps(
            {"symbol": sym, "params": cfg, "report": report}, indent=2))
        print(f"wrote configs/{sym}.json")
    else:
        print("NOT qualified - do not trade this asset in single-asset mode.")


if __name__ == "__main__":
    main()
