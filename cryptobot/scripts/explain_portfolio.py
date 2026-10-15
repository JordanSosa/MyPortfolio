#!/usr/bin/env python3
"""Explain today's targets: why the bot wants to hold what it holds.

    python scripts/explain_portfolio.py                 # latest bar, Binance archive data
    python scripts/explain_portfolio.py --date 2026-10-13
    python scripts/explain_portfolio.py --ledger reports/paper/binance-archive-v4

Shows the market regime (BTC trend -> exposure multiplier), the liquid
universe, and for every coin with a target weight: its trend scores, its
volatility and how many of the 189 ensemble sub-portfolios hold it.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cryptobot.data import load_panel, slice_panel  # noqa: E402
from cryptobot.live import load_strategy  # noqa: E402
from cryptobot.research import trim_panel  # noqa: E402
from cryptobot.strategy import (Params, _hold_np, _regime, _size_np, _universe_rank,  # noqa: E402
                                compute_features, equity_like)


def explain(panel: dict, ep, day: pd.Timestamp) -> dict:
    close = panel["close"]
    excluded = equity_like(close, panel.get("listed")) if ep.exclude_equities else None
    i = close.index.get_loc(day)
    members = []
    trend_by_set, regime_by_set = {}, {}
    final = np.zeros(close.shape[1])
    for lbs in ep.lookback_sets:
        f = compute_features(panel, Params(lookbacks=lbs, vol_lookback=ep.vol_lookback,
                                           adv_window=ep.adv_window))
        tag = f"{lbs[0]}-{lbs[-1]}d"
        trend = f["trend"]
        trend_by_set[tag] = trend.iloc[i]
        reg = _regime(trend, ep.regime_filter)
        regime_by_set[tag] = float(reg.iloc[i]) if reg is not None else 1.0
        ann_vol = (f["vol"] * np.sqrt(365)).values
        neg = ((trend <= 0) | trend.isna()).values
        rank_u = _universe_rank(f, ep.min_history, excluded)
        for U in ep.universe_sizes:
            score = trend.where((rank_u <= U) & (trend > 0))
            rank = score.rank(axis=1, ascending=False).values
            for K in ep.top_ks:
                for off in ep.offsets():
                    pick = _hold_np(rank <= K, neg, close.index, ep.rebalance_days, off)
                    w = _size_np(score.values, ann_vol, pick, ep.target_vol, ep.max_weight,
                                 None if reg is None else reg.values)[i]
                    final += w
                    members.append({"set": tag, "U": U, "K": K, "offset": off,
                                    "gross": float(w.sum()), "held": w > 1e-9})
    n = len(members)
    final /= n
    f30 = compute_features(panel, Params(lookbacks=ep.lookback_sets[1], adv_window=ep.adv_window))
    adv_rank = _universe_rank(f30, ep.min_history, excluded).iloc[i]
    vol = f30["vol"].iloc[i] * np.sqrt(365)
    held = np.array([m["held"] for m in members])
    rows = []
    for j, c in enumerate(close.columns):
        if final[j] < 0.002:
            continue
        rows.append({"coin": c.replace("USDT", ""), "weight": round(float(final[j]), 4),
                     "held_by": f"{int(held[:, j].sum())}/{n}",
                     **{f"trend_{k}": round(float(v.get(c, np.nan)), 2) for k, v in trend_by_set.items()},
                     "ann_vol": round(float(vol.get(c, np.nan)), 2),
                     "volume_rank": int(adv_rank.get(c)) if np.isfinite(adv_rank.get(c, np.nan)) else None})
    gross = np.array([m["gross"] for m in members])
    return {
        "date": str(day.date()),
        "btc_trend": {k: round(float(v.get("BTCUSDT", np.nan)), 3) for k, v in trend_by_set.items()},
        "regime_multiplier": {k: round(v, 3) for k, v in regime_by_set.items()},
        "members": n, "members_all_cash": int((gross < 1e-9).sum()),
        "avg_member_exposure": round(float(gross.mean()), 3),
        "total_target_exposure": round(float(final.sum()), 3),
        "coins_with_target": len(rows),
        "eligible_coins": int(adv_rank.notna().sum()),
        "top15_by_volume": [c.replace("USDT", "") for c in adv_rank.sort_values().index[:15]],
        "positions": sorted(rows, key=lambda r: -r["weight"]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--strategy", default=str(ROOT / "frozen_config_v4.json"))
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    ep = load_strategy(Path(a.strategy))
    panel = trim_panel(load_panel("1d"))
    day = pd.Timestamp(a.date, tz="UTC") if a.date else panel["close"].index[-1]
    panel = slice_panel(panel, start=day - pd.Timedelta(days=900), end=day)
    out = explain(panel, ep, day)
    if a.json:
        print(json.dumps(out, indent=1))
        return
    print(f"Bar {out['date']}  |  BTC trend {out['btc_trend']}  ->  regime multiplier "
          f"{out['regime_multiplier']}")
    print(f"{out['eligible_coins']} eligible coins; 15 most liquid: {', '.join(out['top15_by_volume'])}")
    print(f"{out['members']} sub-portfolios: {out['members_all_cash']} fully in cash, average "
          f"exposure {out['avg_member_exposure']:.1%}  ->  total target exposure "
          f"{out['total_target_exposure']:.1%} across {out['coins_with_target']} coins\n")
    print(pd.DataFrame(out["positions"]).to_string(index=False))


if __name__ == "__main__":
    main()
