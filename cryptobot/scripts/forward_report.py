#!/usr/bin/env python3
"""Compare the accumulating forward test with what the backtest predicts, and
evaluate the kill-switch rules.

    python scripts/forward_report.py [reports/paper/binance-archive]

Expectation bands come from the out-of-sample record (walk-forward 2019-2024
+ holdout 2025-): for a forward window of N days we bootstrap the distribution
of N-day returns and max drawdowns from that record.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cryptobot import metrics as M  # noqa: E402
from cryptobot.monitor import (DEFAULT_KILL, flow_adjusted_returns, kill_drawdown,  # noqa: E402
                               profile_of, read_ledger)

KILL_PCTL = 2.5          # forward return below the 2.5th pct of the expectation band


def oos_record(version: str, profile: str = "balanced") -> pd.Series:
    """Every daily return of the strategy version outside its own fitting:
    v3 - walk-forward OOS + holdout; v4 - development, fresh (Bitfinex) and
    holdout records (other risk profiles: scripts/risk_profiles.py)."""
    R = ROOT / "reports"
    rd = lambda f: pd.read_csv(R / f, index_col=0, parse_dates=True)
    if version == "v4" and profile != "balanced":
        return rd("v4_profile_returns.csv")[profile].dropna()
    if version == "v4":
        parts = [rd("v4_dev_returns.csv")["v4"]]
        for f, col in [("v4_fresh_returns.csv", "v4"), ("v4_holdout_returns.csv", "v4")]:
            if (R / f).exists():
                parts.append(rd(f)[col])
        return pd.concat([x.dropna() for x in parts])
    return pd.concat([rd("walk_forward_returns.csv")["strategy_oos"].dropna(),
                      rd("holdout_returns.csv")["strategy"].dropna()])


def main(path: Path):
    nav, flow, tag = read_ledger(path)
    r = flow_adjusted_returns(nav, flow)
    n = len(r)
    # live ledgers are named by account, so the strategy comes from the ledger itself
    version = "v4" if "-v4" in tag or str(path).rstrip("/").endswith("-v4") else "v3"
    profile = profile_of(tag) if version == "v4" else "balanced"
    kill = DEFAULT_KILL if version == "v3" else kill_drawdown(tag)
    rec = oos_record(version, profile).values
    rng = np.random.default_rng(0)
    sims_ret, sims_dd = [], []
    for _ in range(5000):
        s = rng.integers(0, len(rec) - max(n, 1))
        x = rec[s:s + max(n, 1)]
        e = np.cumprod(1 + x)
        sims_ret.append(e[-1] - 1)
        sims_dd.append((e / np.maximum.accumulate(e) - 1).min())
    growth = (1 + r).cumprod()                      # flow-free growth of $1
    fwd_ret = float(growth.iloc[-1] - 1) if len(growth) else 0.0
    fwd_dd = float((growth / growth.cummax() - 1).min()) if len(growth) else 0.0
    pct = float((np.array(sims_ret) < fwd_ret).mean() * 100)
    out = {
        "strategy": version, "risk_profile": profile, "days": n, "start": str(nav.index[0].date()),
        "end": str(nav.index[-1].date()),
        "forward_return": round(fwd_ret, 4), "forward_maxdd": round(fwd_dd, 4),
        "forward_sharpe": round(M.sharpe(r), 3) if n > 20 else None,
        "expected_return_p5_p50_p95": [round(float(np.percentile(sims_ret, q)), 4) for q in (5, 50, 95)],
        "expected_maxdd_p5_p50": [round(float(np.percentile(sims_dd, q)), 4) for q in (5, 50)],
        "forward_return_percentile_vs_backtest": round(pct, 1),
        "kill_switch_drawdown": kill,
        "KILL_drawdown": fwd_dd <= kill,
        "KILL_underperformance": n >= 90 and pct < KILL_PCTL,
    }
    out["action"] = ("STOP TRADING - re-validate" if out["KILL_drawdown"] or out["KILL_underperformance"]
                     else "continue")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "reports" / "paper" / "binance-archive-v4")
