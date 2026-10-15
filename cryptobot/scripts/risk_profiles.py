#!/usr/bin/env python3
"""v4 at every risk profile over all three records, and the kill-switch
drawdown that follows from them.

    python scripts/risk_profiles.py   # -> reports/v4_profile_returns.csv, reports/v4_profiles.json

Same simulator and costs as research_v4.py: fresh Bitfinex 2014-2018 (0.2%
fees), Binance development 2019-2024 and holdout 2025 onwards. The kill
switch for a profile is 1.4x its worst drawdown in any record, rounded to the
nearest 5% (balanced: -31.7% -> -45%, the level the README has always used).
forward_report.py and the live monitor read these records and thresholds.
"""
from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from cryptobot import metrics as M  # noqa: E402
from cryptobot.backtest import CostModel  # noqa: E402
from cryptobot.data import load_panel  # noqa: E402
from cryptobot.data_bitfinex import load_panel_bitfinex  # noqa: E402
from cryptobot.monitor import RISK_PROFILES as PROFILES, kill_level  # noqa: E402
from cryptobot.research import trim_panel  # noqa: E402
from research_v4 import (AUM, DEV_END, DEV_START, FRESH_END, FRESH_START,  # noqa: E402
                         HOLDOUT_START, REPORTS, run_v4, v4_params, window)


def main():
    ep = v4_params()
    bitfinex = load_panel_bitfinex(end=FRESH_END)
    binance = trim_panel(load_panel("1d"))
    returns, out = {}, {"rule": "kill switch = 1.4 x worst drawdown in any record, rounded to 5%",
                        "profiles": {}}
    for name, vol in PROFILES.items():
        p = replace(ep, target_vol=vol)
        fresh = window(run_v4(bitfinex, p, CostModel(fee_bps=20.0, aum_usd=AUM)).returns,
                       FRESH_START, FRESH_END)
        b = run_v4(binance, p).returns
        parts = {"fresh_2014_2018": fresh, "dev_2019_2024": window(b, DEV_START, DEV_END),
                 "holdout_2025_on": window(b, HOLDOUT_START)}
        returns[name] = pd.concat(parts.values())
        worst = min(M.max_drawdown(r) for r in parts.values())
        out["profiles"][name] = {
            "target_vol": vol,
            **{k: {"CAGR": round(M.cagr(r), 4), "Sharpe": round(M.sharpe(r), 3),
                   "MaxDD": round(M.max_drawdown(r), 4)} for k, r in parts.items()},
            "worst_drawdown": round(worst, 4), "kill_drawdown": kill_level(worst)}
        print(name, json.dumps(out["profiles"][name]))
    pd.DataFrame(returns).to_csv(REPORTS / "v4_profile_returns.csv")
    (REPORTS / "v4_profiles.json").write_text(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
