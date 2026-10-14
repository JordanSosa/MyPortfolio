"""Performance and overfitting statistics.

All return series are simple (not log) per-period returns. ``ppy`` is periods
per year; crypto trades every day so daily data uses 365.
"""
from __future__ import annotations

import itertools
import math

import numpy as np
import pandas as pd
from scipy import stats


def equity(r: pd.Series) -> pd.Series:
    return (1 + r.fillna(0)).cumprod()


def cagr(r: pd.Series, ppy: int = 365) -> float:
    r = r.dropna()
    if len(r) == 0:
        return float("nan")
    tot = float(equity(r).iloc[-1])
    return tot ** (ppy / len(r)) - 1 if tot > 0 else -1.0


def sharpe(r: pd.Series, ppy: int = 365) -> float:
    r = r.dropna()
    sd = r.std()
    return float(r.mean() / sd * math.sqrt(ppy)) if sd > 0 else 0.0


def sortino(r: pd.Series, ppy: int = 365) -> float:
    r = r.dropna()
    dd = np.sqrt((np.minimum(r, 0) ** 2).mean())
    return float(r.mean() / dd * math.sqrt(ppy)) if dd > 0 else 0.0


def max_drawdown(r: pd.Series) -> float:
    e = equity(r)
    return float((e / e.cummax() - 1).min())


def calmar(r: pd.Series, ppy: int = 365) -> float:
    mdd = max_drawdown(r)
    return cagr(r, ppy) / abs(mdd) if mdd < 0 else float("inf")


def ulcer_index(r: pd.Series) -> float:
    e = equity(r)
    dd = (e / e.cummax() - 1) * 100
    return float(np.sqrt((dd ** 2).mean()))


def longest_drawdown_days(r: pd.Series) -> int:
    e = equity(r)
    under = e < e.cummax()
    best = cur = 0
    for u in under:
        cur = cur + 1 if u else 0
        best = max(best, cur)
    return best


def summary(r: pd.Series, ppy: int = 365, turnover: pd.Series | None = None,
            exposure: pd.Series | None = None) -> dict:
    r = r.dropna()
    out = {
        "start": str(r.index[0].date()) if len(r) else "",
        "end": str(r.index[-1].date()) if len(r) else "",
        "CAGR": cagr(r, ppy),
        "vol": float(r.std() * math.sqrt(ppy)),
        "Sharpe": sharpe(r, ppy),
        "Sortino": sortino(r, ppy),
        "MaxDD": max_drawdown(r),
        "Calmar": calmar(r, ppy),
        "Ulcer": ulcer_index(r),
        "longest_DD_days": longest_drawdown_days(r),
        "total_return": float(equity(r).iloc[-1] - 1) if len(r) else float("nan"),
        "skew": float(stats.skew(r)) if len(r) > 2 else float("nan"),
        "hit_rate": float((r > 0).mean()),
    }
    if turnover is not None:
        out["turnover_ann"] = float(turnover.reindex(r.index).fillna(0).mean() * ppy)
    if exposure is not None:
        out["avg_exposure"] = float(exposure.reindex(r.index).fillna(0).mean())
    return out


def annual_returns(r: pd.Series) -> pd.Series:
    return r.groupby(r.index.year).apply(lambda x: float((1 + x).prod() - 1))


# --------------------------------------------------------------------------
# Overfitting diagnostics (Bailey & Lopez de Prado)
# --------------------------------------------------------------------------

def probabilistic_sharpe(r: pd.Series, sr_benchmark: float = 0.0) -> float:
    """P(true per-period Sharpe > sr_benchmark), adjusting for skew/kurtosis."""
    r = r.dropna()
    n = len(r)
    if n < 10 or r.std() == 0:
        return float("nan")
    sr = r.mean() / r.std()
    g3 = stats.skew(r)
    g4 = stats.kurtosis(r, fisher=False)
    denom = math.sqrt(max(1e-12, 1 - g3 * sr + (g4 - 1) / 4 * sr ** 2))
    return float(stats.norm.cdf((sr - sr_benchmark) * math.sqrt(n - 1) / denom))


def deflated_sharpe(r: pd.Series, n_trials: int, trial_sr_std: float) -> float:
    """Deflated Sharpe Ratio: PSR against the max Sharpe expected from n_trials
    *unskilled* trials. ``trial_sr_std`` is the cross-sectional std of the
    per-period Sharpe ratios of all trials that were tried."""
    emc = 0.5772156649
    n = max(n_trials, 2)
    sr0 = trial_sr_std * ((1 - emc) * stats.norm.ppf(1 - 1 / n)
                          + emc * stats.norm.ppf(1 - 1 / (n * math.e)))
    return probabilistic_sharpe(r, sr0)


def pbo_cscv(trial_returns: pd.DataFrame, n_splits: int = 16) -> dict:
    """Probability of Backtest Overfitting via Combinatorially Symmetric
    Cross-Validation. ``trial_returns``: rows=time, cols=parameter sets.

    Returns PBO (fraction of splits where the in-sample best config ranks below
    the out-of-sample median) and the median OOS rank-logit."""
    m = trial_returns.dropna(how="all").fillna(0).values
    t = (len(m) // n_splits) * n_splits
    blocks = np.array_split(m[:t], n_splits)
    logits = []
    for combo in itertools.combinations(range(n_splits), n_splits // 2):
        is_idx = set(combo)
        is_ = np.vstack([blocks[i] for i in combo])
        oos = np.vstack([blocks[i] for i in range(n_splits) if i not in is_idx])
        sr_is = is_.mean(0) / (is_.std(0) + 1e-12)
        sr_oos = oos.mean(0) / (oos.std(0) + 1e-12)
        best = int(np.argmax(sr_is))
        rank = stats.rankdata(sr_oos)[best] / (len(sr_oos) + 1)
        logits.append(math.log(rank / (1 - rank)))
    logits = np.array(logits)
    return {"PBO": float((logits <= 0).mean()), "median_logit": float(np.median(logits)),
            "n_combinations": len(logits)}


def block_bootstrap_sharpe(r: pd.Series, n: int = 2000, block: int = 30,
                           ppy: int = 365, seed: int = 0) -> dict:
    """Stationary-ish block bootstrap of annualised Sharpe and MaxDD."""
    rng = np.random.default_rng(seed)
    x = r.dropna().values
    T = len(x)
    srs, dds, cg = [], [], []
    for _ in range(n):
        idx = []
        while len(idx) < T:
            s = rng.integers(0, T - block)
            idx.extend(range(s, s + block))
        y = pd.Series(x[idx[:T]])
        srs.append(y.mean() / y.std() * math.sqrt(ppy))
        e = (1 + y).cumprod()
        dds.append((e / e.cummax() - 1).min())
        cg.append(e.iloc[-1] ** (ppy / T) - 1)
    q = lambda a, p: float(np.percentile(a, p))
    return {"Sharpe_p05": q(srs, 5), "Sharpe_p50": q(srs, 50), "Sharpe_p95": q(srs, 95),
            "P(Sharpe>0)": float((np.array(srs) > 0).mean()),
            "MaxDD_p05": q(dds, 5), "MaxDD_p50": q(dds, 50),
            "CAGR_p05": q(cg, 5), "CAGR_p50": q(cg, 50)}
