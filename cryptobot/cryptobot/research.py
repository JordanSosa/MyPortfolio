"""Walk-forward research harness used by scripts/run_research.py."""
from __future__ import annotations

import itertools
from dataclasses import replace

import numpy as np
import pandas as pd


def _ts(x) -> pd.Timestamp:
    t = pd.Timestamp(x)
    return t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")

from . import metrics as M
from .backtest import CostModel, simulate
from .strategy import Params, compute_features, target_weights

GRID = {
    "universe_size": [15, 30, 50],
    "top_k": [4, 8, 15],
    "lookbacks": [(10, 20, 40, 80), (20, 40, 80, 160), (40, 80, 160, 320)],
    "target_vol": [0.35, 0.60],
    "regime_filter": [True, False],
}


def grid_params(base: Params = Params()) -> list[Params]:
    keys = list(GRID)
    return [replace(base, **dict(zip(keys, vals))) for vals in itertools.product(*GRID.values())]


def trim_panel(panel: dict, max_rank: int = 80, min_days: int = 60) -> dict:
    """Drop symbols that were never among the top ``max_rank`` by trailing
    volume. Pure speed optimisation: such coins can never enter the universe
    for any grid value (max universe_size=50 < 80)."""
    qv = panel["quote_volume"].rolling(30, min_periods=10).median()
    hist = panel["close"].notna().cumsum()
    rk = qv.where(hist >= min_days).rank(axis=1, ascending=False)
    keep = rk.le(max_rank).any()
    keep = keep[keep].index
    return {k: v[keep] for k, v in panel.items()}


def run_config(panel: dict, p: Params, cost: CostModel | None = None, lag: int = 0,
               feats_cache: dict | None = None, start=None, end=None):
    key = (p.lookbacks, p.vol_lookback, p.adv_window)
    if feats_cache is not None and key in feats_cache:
        f = feats_cache[key]
    else:
        f = compute_features(panel, p)
        if feats_cache is not None:
            feats_cache[key] = f
    w = target_weights(panel, p, f)
    return simulate(w, panel["close"], f["adv"], cost or CostModel(aum_usd=100_000),
                    band=p.band, lag=lag, start=start, end=end)


def btc_buy_hold(panel: dict, start=None, end=None) -> pd.Series:
    r = panel["close"]["BTCUSDT"].pct_change(fill_method=None)
    if start:
        r = r[r.index >= _ts(start)]
    if end:
        r = r[r.index <= _ts(end)]
    return r.fillna(0)


def ew_top10(panel: dict, cost: CostModel | None = None, start=None, end=None) -> pd.Series:
    """Equal-weight basket of the 10 most liquid eligible coins, rebalanced on
    the first day of each month. Same cost model as the strategy."""
    close = panel["close"]
    adv = panel["quote_volume"].rolling(30, min_periods=10).median()
    hist = close.notna().cumsum()
    rk = adv.where((hist >= 200) & close.notna()).rank(axis=1, ascending=False)
    w = (rk <= 10).astype(float)
    w = w.div(w.sum(axis=1).replace(0, np.nan), axis=0)
    month_start = w.index.to_series().dt.month.diff().fillna(1).ne(0)
    w[~month_start.values] = np.nan
    return simulate(w, close, adv, cost or CostModel(), start=start, end=end).returns


def walk_forward(trial_returns: pd.DataFrame, test_years: list[int], train_start: str,
                 select=M.sharpe) -> tuple[pd.Series, list[dict]]:
    """For each test year pick the config with best ``select`` on all data from
    ``train_start`` up to the end of the previous year; stitch OOS returns."""
    oos, log = [], []
    t0 = _ts(train_start)
    for y in test_years:
        tr = trial_returns[(trial_returns.index >= t0) & (trial_returns.index.year < y)]
        scores = tr.apply(select)
        best = scores.idxmax()
        te = trial_returns.loc[trial_returns.index.year == y, best]
        oos.append(te)
        log.append({"year": y, "chosen": best, "train_score": float(scores.max()),
                    "test_sharpe": M.sharpe(te), "test_return": float((1 + te).prod() - 1)})
    return pd.concat(oos), log


def neighbour_robustness(scores: pd.Series, params: dict[str, Params], chosen: str,
                         ratio: float = 0.7) -> float:
    """Share of grid neighbours (differ in exactly one parameter) whose score
    is >= ratio * chosen score."""
    cp = params[chosen].to_dict()
    nb = []
    for k, p in params.items():
        d = p.to_dict()
        diff = [g for g in GRID if d[g] != cp[g] and not (isinstance(d[g], list) and list(cp[g]) == d[g])]
        if len(diff) == 1:
            nb.append(scores[k])
    if not nb:
        return float("nan")
    return float(np.mean(np.array(nb) >= ratio * scores[chosen]))
