#!/usr/bin/env python3
"""v4 research pipeline - see PROTOCOL_v2.md for the rules each stage obeys.

    python scripts/research_v4.py dev       # Binance <= 2024-12-31 only (panel truncated)
    python scripts/research_v4.py freeze    # writes frozen_config_v4.json (commit before next)
    python scripts/research_v4.py fresh     # untouched: Bitfinex 2014-2018, survivorship-free
    python scripts/research_v4.py holdout   # Binance 2025-01-01 -> latest (contaminated, see protocol)
    python scripts/research_v4.py exec      # fills 1h / 4h / 12h after the daily close (hourly data)
    python scripts/research_v4.py parity    # live engine replay == backtest, v4
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import time
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cryptobot import metrics as M  # noqa: E402
from cryptobot.backtest import CostModel, simulate  # noqa: E402
from cryptobot.data import load_panel, load_tbill  # noqa: E402
from cryptobot.research import trim_panel  # noqa: E402
from cryptobot.strategy import (EnsembleParams, Params, ensemble_weights,  # noqa: E402
                                members, single_asset_weights, target_weights)

REPORTS = ROOT / "reports"
FROZEN_V4 = ROOT / "frozen_config_v4.json"
DEV_START, DEV_END = "2019-01-01", "2024-12-31"
HOLDOUT_START = "2025-01-01"
FRESH_START, FRESH_END = "2014-01-01", "2018-12-31"
AUM = 100_000


# ------------------------------------------------------------------ helpers
def v3_params() -> Params:
    cfg = dict(json.loads((ROOT / "frozen_config.json").read_text())["params"])
    cfg["lookbacks"] = tuple(cfg["lookbacks"])
    return Params(**cfg)


def v4_params(frozen: bool = True) -> EnsembleParams:
    if frozen and FROZEN_V4.exists():
        fz = json.loads(FROZEN_V4.read_text())
        blob = json.dumps(fz["params"], sort_keys=True)
        assert hashlib.sha256(blob.encode()).hexdigest() == fz["sha256"], "v4 config modified"
        return EnsembleParams.from_dict(fz["params"])
    return EnsembleParams()


def adv_of(panel: dict, window: int = 30) -> pd.DataFrame:
    return panel["quote_volume"].rolling(window, min_periods=10).median()


def run_v4(panel, ep: EnsembleParams, cost=None, lag=0, cash_rate=None, start=None, end=None,
           weights=None, exec_close=None):
    w = ensemble_weights(panel, ep) if weights is None else weights
    px = panel["close"] if exec_close is None else exec_close
    return simulate(w, px, adv_of(panel, ep.adv_window), cost or CostModel(aum_usd=AUM),
                    band=ep.band, lag=lag, start=start, end=end, cash_rate=cash_rate,
                    min_trade=ep.min_trade)


def run_v3(panel, p: Params, cost=None, lag=0, cash_rate=None, start=None, end=None,
           weights=None, exec_close=None):
    w = target_weights(panel, p) if weights is None else weights
    px = panel["close"] if exec_close is None else exec_close
    return simulate(w, px, adv_of(panel, p.adv_window), cost or CostModel(aum_usd=AUM),
                    band=p.band, lag=lag, start=start, end=end, cash_rate=cash_rate)


def window(r: pd.Series, start=None, end=None) -> pd.Series:
    if start:
        r = r[r.index >= pd.Timestamp(start, tz="UTC")]
    if end:
        r = r[r.index <= pd.Timestamp(end, tz="UTC")]
    return r


def S(r: pd.Series, res=None) -> dict:
    d = M.summary(r, turnover=None if res is None else res.turnover,
                  exposure=None if res is None else res.exposure)
    if res is not None:
        d["cost_drag_ann"] = float(res.costs.reindex(r.index).sum() / (len(r) / 365))
    keep = ["start", "end", "CAGR", "vol", "Sharpe", "Sortino", "MaxDD", "Calmar",
            "longest_DD_days", "total_return", "turnover_ann", "avg_exposure", "cost_drag_ann"]
    return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in d.items() if k in keep}


def benchmarks(panel: dict, start, end, fee_bps=10.0) -> dict:
    close = panel["close"]
    cm = CostModel(fee_bps=fee_bps, aum_usd=AUM)
    adv = adv_of(panel)
    btc = window(close["BTCUSDT"].pct_change(fill_method=None).fillna(0), start, end)
    hist = close.notna().cumsum()
    rk = adv.where((hist >= 200) & close.notna()).rank(axis=1, ascending=False)
    ew_t = (rk <= 10).astype(float)
    ew_t = ew_t.div(ew_t.sum(axis=1).replace(0, np.nan), axis=0)
    ms = ew_t.index.to_series().dt.month.diff().fillna(1).ne(0)
    ew_t[~ms.values] = np.nan
    ew = simulate(ew_t, close, adv, cm, start=start, end=end).returns
    sat = single_asset_weights(close["BTCUSDT"], replace(Params(), lookbacks=(10, 20, 40, 80),
                                                         target_vol=0.35)).to_frame("BTCUSDT")
    btc_trend = simulate(sat, close[["BTCUSDT"]], adv[["BTCUSDT"]], cm, band=0.05,
                         start=start, end=end).returns
    return {"btc_buy_hold": btc, "ew_top10": ew, "btc_trend_same_engine": btc_trend}


def yearly(r: pd.Series) -> dict:
    return {int(k): round(float(v), 4) for k, v in M.annual_returns(r).items()}


# ------------------------------------------------------------------ stages
def stage_dev(_):
    t0 = time.time()
    panel = trim_panel(load_panel("1d", end=DEV_END))
    ep, p3 = v4_params(frozen=False), v3_params()
    tb = load_tbill()
    w4 = ensemble_weights(panel, ep)
    w3 = target_weights(panel, p3)
    r4 = run_v4(panel, ep, weights=w4)
    r4y = run_v4(panel, ep, weights=w4, cash_rate=tb)
    r3 = run_v3(panel, p3, weights=w3)
    r4_2x = run_v4(panel, ep, CostModel(aum_usd=AUM, multiplier=2.0), weights=w4)
    r4_lag = run_v4(panel, ep, lag=1, weights=w4)
    r3_2x = run_v3(panel, p3, CostModel(aum_usd=AUM, multiplier=2.0), weights=w3)
    r3_lag = run_v3(panel, p3, lag=1, weights=w3)
    print(f"core sims {time.time()-t0:.0f}s")
    W = lambda res: window(res.returns, DEV_START, DEV_END)
    bm = {k: window(v, DEV_START, DEV_END) for k, v in benchmarks(panel, DEV_START, DEV_END).items()}
    wf3 = pd.read_csv(REPORTS / "walk_forward_returns.csv", index_col=0,
                      parse_dates=True)["strategy_oos"].dropna()

    # members of the ensemble (tranche 0 only) - how does the average compare?
    mem = {}
    for m in members(ep):
        if m.rebalance_offset != 0:
            continue
        k = f"U{m.universe_size}_K{m.top_k}_L{m.lookbacks[0]}"
        mem[k] = M.sharpe(W(run_v3(panel, m)))
    mem = pd.Series(mem)

    # half-universe robustness
    rng = np.random.default_rng(42)
    cols = [c for c in panel["close"].columns if c != "BTCUSDT"]
    half = []
    for _ in range(20):
        keep = ["BTCUSDT"] + list(rng.choice(cols, len(cols) // 2, replace=False))
        sub = {k: v[keep] for k, v in panel.items()}
        half.append(M.sharpe(W(run_v4(sub, ep))))

    # risk dial (information only - the default 0.35 was fixed before this ran)
    dial = {}
    for tv in [0.20, 0.35, 0.50, 0.75, 1.00]:
        e2 = replace(ep, target_vol=tv)
        dial[tv] = S(W(run_v4(panel, e2)))

    r4d = W(r4)
    v = {"v1": 1.1602, "v2": 1.3396, "v3": 1.3978, "v4": M.sharpe(r4d)}
    per = np.array(list(v.values())) / math.sqrt(365)
    out = {
        "generated": pd.Timestamp.now(tz="UTC").isoformat(),
        "period": [DEV_START, DEV_END],
        "params_v4": ep.to_dict(),
        "v4": S(r4d, r4), "v4_with_cash_yield": S(W(r4y), r4y),
        "v3_fixed_code_single_config": S(W(r3), r3),
        "v3_walk_forward_oos_as_reported": S(wf3),
        "benchmarks": {k: S(v_) for k, v_ in bm.items()},
        "v4_2x_costs": S(W(r4_2x)), "v4_lag1": S(W(r4_lag)),
        "v3_2x_costs": S(W(r3_2x)), "v3_lag1": S(W(r3_lag)),
        "annual": {"v4": yearly(r4d), "v3": yearly(W(r3)), "btc": yearly(bm["btc_buy_hold"])},
        "member_sharpes": {"min": round(float(mem.min()), 3), "median": round(float(mem.median()), 3),
                           "max": round(float(mem.max()), 3), "n": int(len(mem)),
                           "ensemble": round(M.sharpe(r4d), 3)},
        "half_universe_sharpe_p05_p50_p95": [round(float(np.percentile(half, q)), 3)
                                             for q in (5, 50, 95)],
        "risk_dial": dial,
        "psr_vs_0": round(M.probabilistic_sharpe(r4d, 0.0), 4),
        "dsr_pipelines_inspected_4": round(M.deflated_sharpe(r4d, 4, float(per.std(ddof=1))), 4),
        "bootstrap": {k: round(x, 4) for k, x in M.block_bootstrap_sharpe(r4d).items()},
        "corr_v4_v3": round(float(np.corrcoef(r4d, W(r3))[0, 1]), 3),
    }
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "v4_dev.json").write_text(json.dumps(out, indent=2, default=str))
    pd.DataFrame({"v4": r4d, "v4_yield": W(r4y), "v3": W(r3), **bm}).to_csv(REPORTS / "v4_dev_returns.csv")
    print(json.dumps({k: out[k] for k in ["v4", "v4_with_cash_yield", "v3_fixed_code_single_config",
                                          "v3_walk_forward_oos_as_reported", "benchmarks",
                                          "v4_2x_costs", "v4_lag1", "member_sharpes",
                                          "half_universe_sharpe_p05_p50_p95", "annual"]},
                     indent=1, default=str))
    print(f"done {time.time()-t0:.0f}s")


def stage_freeze(_):
    ep = EnsembleParams()
    cfg = ep.to_dict()
    blob = json.dumps(cfg, sort_keys=True)
    FROZEN_V4.write_text(json.dumps({
        "version": "v4", "params": cfg, "sha256": hashlib.sha256(blob.encode()).hexdigest(),
        "frozen_at": pd.Timestamp.now(tz="UTC").isoformat()}, indent=2))
    print(FROZEN_V4.read_text())


def criteria(r: pd.Series, r2x: pd.Series, btc: pd.Series, dev_window_sharpes: np.ndarray) -> dict:
    s, b = M.summary(r), M.summary(btc)
    pct = float((dev_window_sharpes < s["Sharpe"]).mean() * 100)
    return {
        "F1_psr_vs_0_ge_0.95": M.probabilistic_sharpe(r, 0.0) >= 0.95,
        "F2_sharpe_ge_btc": s["Sharpe"] >= b["Sharpe"],
        "F3_maxdd_le_half_btc": s["MaxDD"] >= 0.5 * b["MaxDD"],
        "F4_calmar_gt_btc": s["Calmar"] > b["Calmar"],
        "F5_2x_cost_sharpe_ge_0.75x": M.sharpe(r2x) >= 0.75 * s["Sharpe"],
        "F6_consistent_with_dev_p5_or_better": pct >= 5.0,
        "_sharpe_percentile_vs_dev_windows": round(pct, 1),
        "_psr": round(M.probabilistic_sharpe(r, 0.0), 4),
    }


def dev_window_sharpes(length: int, n: int = 4000) -> np.ndarray:
    """Sharpe of same-length windows block-bootstrapped from the v4 dev record."""
    x = pd.read_csv(REPORTS / "v4_dev_returns.csv", index_col=0)["v4"].dropna().values
    rng = np.random.default_rng(0)
    out = []
    for _ in range(n):
        idx = []
        while len(idx) < length:
            s0 = rng.integers(0, len(x) - 30)
            idx.extend(range(s0, s0 + 30))
        y = x[idx[:length]]
        out.append(y.mean() / y.std() * math.sqrt(365) if y.std() > 0 else 0.0)
    return np.array(out)


def stage_fresh(_):
    from cryptobot.data_bitfinex import load_panel_bitfinex
    panel = load_panel_bitfinex(end=FRESH_END)
    ep, p3 = v4_params(), v3_params()
    fee = 20.0                       # Bitfinex taker fee in 2014-2018
    cm, cm2 = CostModel(fee_bps=fee, aum_usd=AUM), CostModel(fee_bps=fee, aum_usd=AUM, multiplier=2.0)
    w4, w3 = ensemble_weights(panel, ep), target_weights(panel, p3)
    out = {"source": "Bitfinex USD pairs (incl. delisted)", "n_pairs": int(panel["close"].shape[1]),
           "fee_bps": fee, "frozen_v4": json.loads(FROZEN_V4.read_text())["sha256"]}
    eligible = (panel["close"].notna().cumsum() >= 200) & panel["close"].notna()
    out["eligible_coins_by_year"] = {int(y): int(eligible[eligible.index.year == y].sum(axis=1).max())
                                     for y in range(2014, 2019)}
    rets = {}
    for name, (s, e) in {"full_2014_2018": (FRESH_START, FRESH_END),
                         "2014_2016": ("2014-01-01", "2016-12-31"),
                         "2017_2018": ("2017-01-01", "2018-12-31")}.items():
        r4 = window(run_v4(panel, ep, cm, weights=w4).returns, s, e)
        r4x = window(run_v4(panel, ep, cm2, weights=w4).returns, s, e)
        r3 = window(run_v3(panel, p3, cm, weights=w3).returns, s, e)
        bm = {k: window(v, s, e) for k, v in benchmarks(panel, s, e, fee_bps=fee).items()}
        out[name] = {"v4": S(r4), "v4_2x_costs": S(r4x), "v3": S(r3),
                     **{k: S(v) for k, v in bm.items()},
                     "annual": {"v4": yearly(r4), "v3": yearly(r3), "btc": yearly(bm["btc_buy_hold"])}}
        if name == "full_2014_2018":
            out["criteria_v4"] = criteria(r4, r4x, bm["btc_buy_hold"], dev_window_sharpes(len(r4)))
            r3x = window(run_v3(panel, p3, cm2, weights=w3).returns, s, e)
            out["criteria_v3"] = criteria(r3, r3x, bm["btc_buy_hold"], dev_window_sharpes(len(r3)))
            rets = {"v4": r4, "v3": r3, **bm}
    (REPORTS / "v4_fresh_bitfinex.json").write_text(json.dumps(out, indent=2, default=str))
    pd.DataFrame(rets).to_csv(REPORTS / "v4_fresh_returns.csv")
    print(json.dumps(out, indent=1, default=str))


def stage_holdout(_):
    panel = trim_panel(load_panel("1d"))
    ep, p3 = v4_params(), v3_params()
    tb = load_tbill()
    w4, w3 = ensemble_weights(panel, ep), target_weights(panel, p3)
    s = HOLDOUT_START
    r4 = run_v4(panel, ep, weights=w4)
    r4d = window(r4.returns, s)
    out = {"warning": "CONTAMINATED: v3's holdout results were seen before v4 was designed. "
                      "Reported for completeness; not used as evidence for v4.",
           "v4": S(r4d, r4),
           "v4_with_cash_yield": S(window(run_v4(panel, ep, weights=w4, cash_rate=tb).returns, s)),
           "v4_2x_costs": S(window(run_v4(panel, ep, CostModel(aum_usd=AUM, multiplier=2.0),
                                          weights=w4).returns, s)),
           "v4_lag1": S(window(run_v4(panel, ep, lag=1, weights=w4).returns, s)),
           "v3_fixed_code": S(window(run_v3(panel, p3, weights=w3).returns, s)),
           **{k: S(v) for k, v in benchmarks(panel, s, None).items()},
           "v4_monthly": {str(k.date()): round(float(v), 4) for k, v in
                          r4d.groupby(r4d.index.to_period("M")).apply(lambda x: (1 + x).prod() - 1)
                          .to_timestamp().items()},
           "v4_current_weights": w4.iloc[-1][w4.iloc[-1] > 0.002].round(4).to_dict()}
    (REPORTS / "v4_holdout.json").write_text(json.dumps(out, indent=2, default=str))
    print(json.dumps(out, indent=1, default=str))


def stage_exec(_):
    """Fills N hours after the daily close: execution prices come from hourly
    candles; signals still use the 00:00 UTC daily bars."""
    from cryptobot.data import DATA_DIR
    panel = trim_panel(load_panel("1d"))
    ep, p3 = v4_params(), v3_params()
    w4, w3 = ensemble_weights(panel, ep), target_weights(panel, p3)
    cols = [c for c in panel["close"].columns if (DATA_DIR / "1h" / f"{c}.parquet").exists()]
    held = (w4.max() > 0) | (w3.max() > 0)
    missing = [c for c in held[held].index if c not in cols]
    hourly = {c: pd.read_parquet(DATA_DIR / "1h" / f"{c}.parquet")["close"] for c in cols}
    h = pd.DataFrame(hourly).sort_index()
    out = {"symbols_with_hourly": len(cols), "held_symbols_missing_hourly": missing}
    for delay in [0, 1, 4, 12]:
        # daily bar t closes at t+1d 00:00; the fill is the close of the hourly
        # bar that ends `delay` hours later (delay 0 = the daily close itself)
        if delay == 0:
            px = panel["close"]
        else:
            stamp = panel["close"].index + pd.Timedelta(days=1) + pd.Timedelta(hours=delay - 1)
            px = h.reindex(stamp)
            px.index = panel["close"].index
            px = px.reindex(columns=panel["close"].columns)
            px = px.where(panel["close"].notna())
            # assets without hourly data keep daily closes (only ever tiny weights)
            px = px.fillna(panel["close"].where(px.isna()))
        for name, run, w in [("v4", run_v4, w4), ("v3", run_v3, w3)]:
            res = run(panel, ep if name == "v4" else p3, weights=w, exec_close=px)
            for per, (s, e) in {"dev": (DEV_START, DEV_END), "holdout": (HOLDOUT_START, None)}.items():
                out.setdefault(f"{name}_{per}", {})[f"delay_{delay}h"] = S(window(res.returns, s, e))
    (REPORTS / "v4_exec_delay.json").write_text(json.dumps(out, indent=2, default=str))
    print(json.dumps(out, indent=1, default=str))


def stage_parity(a):
    """Every holdout day (or every ``a.step``-th): rebuild the panel exactly as
    the live bot sees it (data up to that day, 800-day window) and compare the
    live engine's targets with the full-history backtest targets."""
    from cryptobot.live import latest_targets_v4
    panel = trim_panel(load_panel("1d"))
    ep = v4_params()
    full = ensemble_weights(panel, ep)
    days = full.index[full.index >= pd.Timestamp(HOLDOUT_START, tz="UTC")][::a.step]
    worst = 0.0
    t0 = time.time()
    for i, d in enumerate(days):
        lo = d - pd.Timedelta(days=ep.max_lookback * 2 + 160)
        trunc = {k: v.loc[lo:d] for k, v in panel.items()}
        t, w, _ = latest_targets_v4(trunc, ep)
        assert t == d
        worst = max(worst, float((w.reindex(full.columns).fillna(0) - full.loc[d]).abs().max()))
        if i % 50 == 0:
            print(f"  {i}/{len(days)} worst so far {worst:.2e} ({time.time()-t0:.0f}s)")
    out = {"days_checked": len(days), "step": a.step, "window_days": ep.max_lookback * 2 + 160,
           "max_abs_weight_diff": worst}
    (REPORTS / "v4_parity.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["dev", "freeze", "fresh", "holdout", "exec", "parity"])
    ap.add_argument("--step", type=int, default=1)
    a = ap.parse_args()
    {"dev": stage_dev, "freeze": stage_freeze, "fresh": stage_fresh, "holdout": stage_holdout,
     "exec": stage_exec, "parity": stage_parity}[a.stage](a)
