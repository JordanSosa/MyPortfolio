#!/usr/bin/env python3
"""Full research pipeline.

Stage ``wf``      : walk-forward on data up to 2024-12-31 ONLY (panel is
                    physically truncated), all diagnostics, then freezes the
                    final configuration to frozen_config.json.
Stage ``holdout`` : one-shot evaluation of the frozen config on 2025-01-01 →
                    latest. Refuses to run if the frozen config hash changed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cryptobot import metrics as M  # noqa: E402
from cryptobot.backtest import CostModel  # noqa: E402
from cryptobot.data import load_panel  # noqa: E402
from cryptobot.research import (GRID, btc_buy_hold, ew_top10, grid_params,  # noqa: E402
                                neighbour_robustness, run_config, trim_panel)
from cryptobot.strategy import Params  # noqa: E402

REPORTS = ROOT / "reports"
FROZEN = ROOT / "frozen_config.json"
DEV_END = "2024-12-31"
TRAIN_START = "2018-07-01"
WF_YEARS = [2019, 2020, 2021, 2022, 2023, 2024]
HOLDOUT_START = "2025-01-01"
# Every configuration ever evaluated on development data counts as a trial for
# the Deflated Sharpe Ratio, including earlier research iterations:
#   v1 (daily selection, 108 configs) -> failed B2/B3/B4, see reports/walk_forward_v1.json
#   v2 (weekly entries/daily exits, 108 configs) -> failed B2 (MaxDD -45%) and
#       B4 (DSR 0.937); see reports/walk_forward_v2.json
#   v3 (this): same 108 configs, selection rule constrained by training MaxDD.
#       Counted as another 108 trials to stay conservative.
PRIOR_TRIALS = 216
MAX_TRAIN_DD = -0.40   # protocol B2 absolute limit


def pid(p: Params) -> str:
    lb = "-".join(map(str, p.lookbacks))
    return f"U{p.universe_size}_K{p.top_k}_L{lb}_V{p.target_vol}_R{int(p.regime_filter)}"


def neighbours(params: dict[str, Params]) -> dict[str, list[str]]:
    out = {}
    for k, p in params.items():
        d = p.to_dict()
        nb = []
        for k2, p2 in params.items():
            d2 = p2.to_dict()
            if sum(d[g] != d2[g] for g in GRID) == 1:
                nb.append(k2)
        out[k] = nb
    return out


def plateau_scores(trials: pd.DataFrame, nbrs: dict[str, list[str]]) -> pd.Series:
    """Selection score = mean Sharpe of a config and its one-step grid
    neighbours (prefers broad plateaus over isolated peaks). Configs whose own
    training-period drawdown breaches MAX_TRAIN_DD are ineligible; if all
    breach, the one with the shallowest drawdown wins."""
    s = trials.apply(M.sharpe)
    dd = trials.apply(M.max_drawdown)
    sc = pd.Series({k: float(np.mean([s[k]] + [s[n] for n in nbrs[k]])) for k in trials})
    ok = dd >= MAX_TRAIN_DD
    if not ok.any():
        return dd - dd.max()          # argmax -> shallowest drawdown
    return sc.where(ok, -np.inf)


def walk_forward_plateau(trials, nbrs, years, train_start):
    oos, log = [], []
    t0 = pd.Timestamp(train_start, tz="UTC")
    for y in years:
        tr = trials[(trials.index >= t0) & (trials.index.year < y)]
        sc = plateau_scores(tr, nbrs)
        best = sc.idxmax()
        te = trials.loc[trials.index.year == y, best]
        oos.append(te)
        log.append({"year": y, "chosen": best, "train_plateau_sharpe": float(sc.max()),
                    "test_sharpe": M.sharpe(te), "test_return": float((1 + te).prod() - 1)})
    return pd.concat(oos), log


def fmt(d: dict) -> dict:
    return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in d.items()}


def stage_wf(args):
    t0 = time.time()
    panel = trim_panel(load_panel("1d", end=DEV_END))
    print(f"panel: {panel['close'].shape}, {time.time()-t0:.0f}s")
    plist = grid_params()
    params = {pid(p): p for p in plist}
    nbrs = neighbours(params)
    cache: dict = {}
    trials, trials2x, trials_lag = {}, {}, {}
    turnover = {}
    for i, (k, p) in enumerate(params.items()):
        res = run_config(panel, p, feats_cache=cache)
        trials[k] = res.returns
        turnover[k] = res.turnover
        if i % 20 == 0:
            print(f"  {i}/{len(params)} {k} {time.time()-t0:.0f}s")
    trials = pd.DataFrame(trials)
    trials = trials[trials.index >= pd.Timestamp(TRAIN_START, tz="UTC")]

    oos, wf_log = walk_forward_plateau(trials, nbrs, WF_YEARS, TRAIN_START)

    # stress tests re-run only the configs that walk-forward actually picked
    chosen = sorted({r["chosen"] for r in wf_log})
    for k in chosen:
        trials2x[k] = run_config(panel, params[k], CostModel(multiplier=2.0), feats_cache=cache).returns
        trials_lag[k] = run_config(panel, params[k], lag=1, feats_cache=cache).returns
    pick = lambda d: pd.concat([d[r["chosen"]][d[r["chosen"]].index.year == r["year"]] for r in wf_log])
    oos2x, ooslag = pick(trials2x), pick(trials_lag)

    s, e = oos.index[0], oos.index[-1]
    btc = btc_buy_hold(panel, s, e)
    ew = ew_top10(panel, start=s, end=e)

    sr_trials = trials.loc[s:e].apply(lambda r: r.mean() / r.std())
    n_trials_total = len(trials.columns) + PRIOR_TRIALS
    dsr = M.deflated_sharpe(oos, n_trials=n_trials_total, trial_sr_std=float(sr_trials.std()))
    pbo = M.pbo_cscv(trials.loc[s:e], n_splits=16)
    boot = M.block_bootstrap_sharpe(oos)

    # final configuration: best plateau score on the whole development period
    sc_all = plateau_scores(trials, nbrs)
    final = sc_all.idxmax()
    full_sr = trials.apply(M.sharpe)
    robust = neighbour_robustness(full_sr, params, final, 0.7)

    out = {
        "generated": pd.Timestamp.now(tz="UTC").isoformat(),
        "n_symbols_in_panel": int(panel["close"].shape[1]),
        "n_trials": len(trials.columns),
        "n_trials_total_incl_prior_iterations": n_trials_total,
        "walk_forward_log": wf_log,
        "oos": fmt(M.summary(oos)),
        "oos_2x_costs": fmt(M.summary(oos2x)),
        "oos_lag1": fmt(M.summary(ooslag)),
        "btc_buy_hold": fmt(M.summary(btc)),
        "ew_top10": fmt(M.summary(ew)),
        "oos_annual": {int(k): round(v, 4) for k, v in M.annual_returns(oos).items()},
        "btc_annual": {int(k): round(v, 4) for k, v in M.annual_returns(btc).items()},
        "ew_annual": {int(k): round(v, 4) for k, v in M.annual_returns(ew).items()},
        "deflated_sharpe": round(dsr, 4),
        "pbo": pbo,
        "bootstrap": fmt(boot),
        "trial_sharpe_distribution": fmt({
            "min": float(full_sr.min()), "p25": float(full_sr.quantile(.25)),
            "median": float(full_sr.median()), "p75": float(full_sr.quantile(.75)),
            "max": float(full_sr.max()), "share_above_1": float((full_sr > 1).mean())}),
        "final_config": final,
        "final_config_dev_sharpe": round(float(full_sr[final]), 4),
        "final_config_neighbour_robustness": robust,
    }
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "walk_forward.json").write_text(json.dumps(out, indent=2))
    pd.DataFrame({"strategy_oos": oos, "btc_buy_hold": btc, "ew_top10": ew}).to_csv(
        REPORTS / "walk_forward_returns.csv")
    full_sr.sort_values(ascending=False).to_csv(REPORTS / "grid_sharpes.csv", header=["sharpe"])

    cfg = params[final].to_dict()
    blob = json.dumps(cfg, sort_keys=True)
    FROZEN.write_text(json.dumps({"params": cfg, "id": final,
                                  "sha256": hashlib.sha256(blob.encode()).hexdigest(),
                                  "frozen_at": pd.Timestamp.now(tz="UTC").isoformat()}, indent=2))
    print(json.dumps({k: out[k] for k in ["oos", "btc_buy_hold", "ew_top10", "deflated_sharpe",
                                          "pbo", "final_config", "walk_forward_log"]}, indent=1))
    print(f"done in {time.time()-t0:.0f}s")


def stage_holdout(args):
    fz = json.loads(FROZEN.read_text())
    blob = json.dumps(fz["params"], sort_keys=True)
    assert hashlib.sha256(blob.encode()).hexdigest() == fz["sha256"], "frozen config was modified"
    cfg = dict(fz["params"])
    cfg["lookbacks"] = tuple(cfg["lookbacks"])
    p = Params(**cfg)
    panel = trim_panel(load_panel("1d"))
    s = HOLDOUT_START
    res = run_config(panel, p, start=None)
    r = res.returns[res.returns.index >= pd.Timestamp(s, tz="UTC")]
    r2 = run_config(panel, p, CostModel(multiplier=2.0)).returns.loc[r.index]
    rl = run_config(panel, p, lag=1).returns.loc[r.index]
    e = r.index[-1]
    btc = btc_buy_hold(panel, s, e)
    ew = ew_top10(panel, start=s, end=e)
    w = res.weights.loc[r.index]
    out = {
        "frozen_config": fz,
        "holdout": fmt(M.summary(r, turnover=res.turnover, exposure=res.exposure)),
        "holdout_2x_costs": fmt(M.summary(r2)),
        "holdout_lag1": fmt(M.summary(rl)),
        "btc_buy_hold": fmt(M.summary(btc)),
        "ew_top10": fmt(M.summary(ew)),
        "monthly": {str(k.date()): round(float(v), 4) for k, v in
                    r.groupby(r.index.to_period("M")).apply(lambda x: (1 + x).prod() - 1)
                    .to_timestamp().items()},
        "most_held": w.mean().sort_values(ascending=False).head(15).round(4).to_dict(),
        "current_weights": w.iloc[-1][w.iloc[-1] > 0].round(4).to_dict(),
    }
    (REPORTS / "holdout.json").write_text(json.dumps(out, indent=2))
    pd.DataFrame({"strategy": r, "btc_buy_hold": btc, "ew_top10": ew}).to_csv(
        REPORTS / "holdout_returns.csv")
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["wf", "holdout"])
    a = ap.parse_args()
    {"wf": stage_wf, "holdout": stage_holdout}[a.stage](a)
