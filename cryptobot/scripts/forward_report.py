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

KILL_DD = -0.45          # 1.4x the worst out-of-sample drawdown (-32.6%)
KILL_PCTL = 2.5          # forward return below the 2.5th pct of the expectation band


def oos_record() -> pd.Series:
    wf = pd.read_csv(ROOT / "reports" / "walk_forward_returns.csv", index_col=0, parse_dates=True)
    ho = pd.read_csv(ROOT / "reports" / "holdout_returns.csv", index_col=0, parse_dates=True)
    return pd.concat([wf["strategy_oos"].dropna(), ho["strategy"].dropna()])


def main(path: Path):
    eq = pd.read_csv(path / "equity.csv", parse_dates=["bar"]).drop_duplicates("bar", keep="last")
    nav = eq.set_index("bar")["nav"]
    r = nav.pct_change().dropna()
    n = len(r)
    rec = oos_record().values
    rng = np.random.default_rng(0)
    sims_ret, sims_dd = [], []
    for _ in range(5000):
        s = rng.integers(0, len(rec) - max(n, 1))
        x = rec[s:s + max(n, 1)]
        e = np.cumprod(1 + x)
        sims_ret.append(e[-1] - 1)
        sims_dd.append((e / np.maximum.accumulate(e) - 1).min())
    fwd_ret = float(nav.iloc[-1] / nav.iloc[0] - 1)
    fwd_dd = float((nav / nav.cummax() - 1).min())
    pct = float((np.array(sims_ret) < fwd_ret).mean() * 100)
    out = {
        "days": n, "start": str(nav.index[0].date()), "end": str(nav.index[-1].date()),
        "forward_return": round(fwd_ret, 4), "forward_maxdd": round(fwd_dd, 4),
        "forward_sharpe": round(M.sharpe(r), 3) if n > 20 else None,
        "expected_return_p5_p50_p95": [round(float(np.percentile(sims_ret, q)), 4) for q in (5, 50, 95)],
        "expected_maxdd_p5_p50": [round(float(np.percentile(sims_dd, q)), 4) for q in (5, 50)],
        "forward_return_percentile_vs_backtest": round(pct, 1),
        "KILL_drawdown": fwd_dd <= KILL_DD,
        "KILL_underperformance": n >= 90 and pct < KILL_PCTL,
    }
    out["action"] = ("STOP TRADING - re-validate" if out["KILL_drawdown"] or out["KILL_underperformance"]
                     else "continue")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "reports" / "paper" / "binance-archive")
