#!/usr/bin/env python3
"""Extra robustness checks on the frozen config (no selection happens here).

1. Rebalance phase: all 7 weekday phases of the weekly entry schedule.
2. Random half-universes: 30 draws, each strategy only sees a random 50% of
   coins (BTC always kept for the regime filter).
3. Account size: costs at $10k, $100k, $1M, $10M.
Full period 2019-01-01 -> latest (walk-forward OOS years + holdout).
"""
import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cryptobot import metrics as M  # noqa: E402
from cryptobot.backtest import CostModel  # noqa: E402
from cryptobot.data import load_panel  # noqa: E402
from cryptobot.research import run_config, trim_panel  # noqa: E402
from cryptobot.strategy import Params  # noqa: E402

START = "2019-01-01"


def main():
    cfg = dict(json.loads((ROOT / "frozen_config.json").read_text())["params"])
    cfg["lookbacks"] = tuple(cfg["lookbacks"])
    p = Params(**cfg)
    panel = trim_panel(load_panel("1d"))
    stat = lambda r: {"Sharpe": round(M.sharpe(r.loc[START:]), 3),
                      "CAGR": round(M.cagr(r.loc[START:]), 4),
                      "MaxDD": round(M.max_drawdown(r.loc[START:]), 4)}
    out = {"phase": {}, "half_universe": [], "aum": {}}
    for k in range(7):
        out["phase"][k] = stat(run_config(panel, replace(p, rebalance_offset=k)).returns)
    rng = np.random.default_rng(42)
    cols = [c for c in panel["close"].columns if c != "BTCUSDT"]
    for i in range(30):
        keep = ["BTCUSDT"] + list(rng.choice(cols, len(cols) // 2, replace=False))
        sub = {k: v[keep] for k, v in panel.items()}
        out["half_universe"].append(stat(run_config(sub, p).returns))
    for aum in [1e4, 1e5, 1e6, 1e7]:
        out["aum"][int(aum)] = stat(run_config(panel, p, CostModel(aum_usd=aum)).returns)
    hu = pd.DataFrame(out["half_universe"])
    out["half_universe_summary"] = {c: [round(float(hu[c].quantile(q)), 3) for q in (.05, .5, .95)]
                                    for c in hu}
    ph = pd.DataFrame(out["phase"]).T
    out["phase_summary"] = {c: [round(float(ph[c].min()), 3), round(float(ph[c].max()), 3)] for c in ph}
    (ROOT / "reports" / "robustness.json").write_text(json.dumps(out, indent=2))
    print(json.dumps({k: out[k] for k in ["phase_summary", "half_universe_summary", "aum"]}, indent=1))


if __name__ == "__main__":
    main()
