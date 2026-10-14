#!/usr/bin/env python3
"""Benchmark B10: live-engine / backtest parity over the holdout.

1. Signal parity - for every holdout day, rebuild the panel *truncated at that
   day* (exactly what the live bot sees), call the live ``latest_targets`` and
   compare to the backtest's target row. Any look-ahead in the signal code
   would show up as a mismatch.
2. Execution parity - drive the live ``PaperAccount`` + ``plan_orders`` path
   day by day with historical closes and compare its NAV to the simulator.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cryptobot.backtest import CostModel  # noqa: E402
from cryptobot.data import load_panel  # noqa: E402
from cryptobot.live import PaperAccount, latest_targets, plan_orders  # noqa: E402
from cryptobot.research import run_config, trim_panel  # noqa: E402
from cryptobot.strategy import Params, compute_features, target_weights  # noqa: E402

START = "2025-01-01"


def main(step: int = 1):
    cfg = dict(json.loads((ROOT / "frozen_config.json").read_text())["params"])
    cfg["lookbacks"] = tuple(cfg["lookbacks"])
    p = Params(**cfg)
    panel = trim_panel(load_panel("1d"))
    f = compute_features(panel, p)
    full = target_weights(panel, p, f)
    days = full.index[full.index >= pd.Timestamp(START, tz="UTC")]

    # 1. signal parity
    max_diff = 0.0
    for d in days[::step]:
        trunc = {k: v.loc[:d] for k, v in panel.items()}
        t, w, _ = latest_targets(trunc, p)
        assert t == d
        max_diff = max(max_diff, float((w - full.loc[d]).abs().max()))

    # 2. execution parity (paper engine vs simulator, same costs)
    cost = CostModel(aum_usd=100_000)
    sim = run_config(panel, p, cost)
    acct = PaperAccount(Path("/dev/null"), 1.0, {}, cost)
    navs = []
    close, adv = panel["close"], f["adv"]
    pre = full.index[full.index < pd.Timestamp(START, tz="UTC")]
    for d in list(pre[-1:]) + list(days):
        px = close.loc[d].dropna()
        # liquidate anything that stopped trading (simulator: last price - haircut)
        for s in [s for s in acct.units if s not in px.index]:
            last = close[s].loc[:d].dropna().iloc[-1]
            acct.cash += acct.units.pop(s) * last * 0.9
        cur = acct.weights(px)
        acct.execute(plan_orders(full.loc[d].reindex(px.index).fillna(0), cur, p.band), px,
                     adv.loc[d].reindex(px.index))
        navs.append(acct.nav(px))
    paper = pd.Series(navs[1:], days) / navs[0]
    simnav = (1 + sim.returns.loc[days]).cumprod()
    te = float((paper.pct_change().fillna(paper.iloc[0] - 1)
                - sim.returns.loc[days]).std() * np.sqrt(365))
    out = {"days_checked": len(days[::step]), "signal_max_abs_weight_diff": max_diff,
           "paper_final_nav": float(paper.iloc[-1]), "sim_final_nav": float(simnav.iloc[-1]),
           "nav_tracking_error_ann": te}
    (ROOT / "reports" / "parity.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
