"""Strategy: volatility-targeted trend + cross-sectional momentum rotation.

Rationale (each piece is a documented, persistent effect, not a mined pattern)
------------------------------------------------------------------------------
1. *Time-series momentum* - crypto returns are positively autocorrelated over
   1-6 month horizons (Liu & Tsyvinski 2021, "Risks and Returns of
   Cryptocurrency"). Being long only while an asset trends up avoids most of
   the -70..-95% bear markets that dominate buy-and-hold drawdowns.
2. *Cross-sectional momentum* - recent winners keep outperforming losers in
   the cross-section of coins (Liu, Tsyvinski & Wu 2022, J. Finance).
3. *Volatility targeting* - scaling exposure by inverse realised vol improves
   risk-adjusted returns because vol clusters and is negatively related to
   subsequent returns in crashes (Moreira & Muir 2017).

Two implementations share every building block:

* ``target_weights(panel, Params)`` - one configuration (v3, kept for
  reproducibility of earlier reports and for single-member tests).
* ``ensemble_weights(panel, EnsembleParams)`` - v4: the equal-weight average of
  all 27 signal configurations (3 universe sizes x 3 portfolio sizes x 3
  lookback speeds), each run on 7 staggered weekly rebalance calendars. No
  parameter is *selected*, so there is no selection overfitting and no
  rebalance-timing luck.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, replace

import numpy as np
import pandas as pd

RHO = 0.6                      # assumed average pairwise correlation for vol targeting
TOKENISED_EQUITY_START = pd.Timestamp("2026-06-01", tz="UTC")
_EQUITY_NAME = re.compile(r"^[A-Z0-9]{2,8}BUSDT$")


@dataclass(frozen=True)
class Params:
    universe_size: int = 30          # top-N by trailing USD volume eligible
    min_history: int = 200           # days of history before an asset is eligible
    lookbacks: tuple = (20, 40, 80, 160)   # trend ensemble horizons (days)
    top_k: int = 8                   # max assets held (rank by momentum score)
    vol_lookback: int = 30           # realised-vol window for sizing
    target_vol: float = 0.50         # annualised portfolio vol target
    max_weight: float = 0.30         # single-asset cap
    regime_filter: bool = True       # scale down when BTC itself is not trending
    rebalance_days: int = 7          # new entries only on rebalance days (0 = daily, v1)
    rebalance_offset: int = 0        # calendar phase of rebalance day (robustness tests only)
    band: float = 0.05               # no-trade band (abs weight) in the simulator
    adv_window: int = 30

    def to_dict(self):
        d = asdict(self)
        d["lookbacks"] = list(self.lookbacks)
        return d


@dataclass(frozen=True)
class EnsembleParams:
    universe_sizes: tuple = (15, 30, 50)
    top_ks: tuple = (4, 8, 15)
    lookback_sets: tuple = ((10, 20, 40, 80), (20, 40, 80, 160), (40, 80, 160, 320))
    tranches: int = 7                # staggered weekly calendars averaged
    rebalance_days: int = 7
    min_history: int = 200
    vol_lookback: int = 30
    target_vol: float = 0.35         # the risk dial (see README "Risk profiles")
    max_weight: float = 0.30
    regime_filter: bool = True
    band: float = 0.05
    min_trade: float = 0.002         # skip trades < 0.2% of NAV (exchange minimums)
    adv_window: int = 30
    exclude_equities: bool = True

    def to_dict(self):
        d = asdict(self)
        d["lookback_sets"] = [list(x) for x in self.lookback_sets]
        d["universe_sizes"] = list(self.universe_sizes)
        d["top_ks"] = list(self.top_ks)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "EnsembleParams":
        d = dict(d)
        d["lookback_sets"] = tuple(tuple(x) for x in d["lookback_sets"])
        d["universe_sizes"] = tuple(d["universe_sizes"])
        d["top_ks"] = tuple(d["top_ks"])
        return cls(**d)

    @property
    def max_lookback(self) -> int:
        return max(max(x) for x in self.lookback_sets)

    def offsets(self) -> list[int]:
        if self.rebalance_days <= 1:
            return [0]
        return sorted({int(round(i * self.rebalance_days / self.tranches))
                       for i in range(self.tranches)})


# ------------------------------------------------------------------ features
def ffill_within_life(df: pd.DataFrame) -> pd.DataFrame:
    """Forward-fill each column only up to its last valid value: bridges
    temporary data gaps without resurrecting delisted assets."""
    last = df.notna()[::-1].cummax()[::-1]
    return df.ffill().where(last)


def _trend_score(close: pd.DataFrame, lookbacks, vol: pd.DataFrame) -> pd.DataFrame:
    """Ensemble trend strength in [-1, 1]: mean over horizons of tanh(z), where
    z is the horizon log-return in units of its expected std."""
    lc = np.log(close)
    acc = None
    for L in lookbacks:
        z = (lc - lc.shift(L)) / (vol * np.sqrt(L))
        s = np.tanh(z)
        acc = s if acc is None else acc + s
    return acc / len(lookbacks)


def equity_like(close: pd.DataFrame, listed: pd.Series | None = None) -> pd.DataFrame:
    """Point-in-time mask of tokenised equities (e.g. Binance ``NVDABUSDT``,
    listed from June 2026). They are not crypto assets: they follow stock-
    market hours, so their weekend moves are muted. Flagged when the symbol has
    the ``<TICKER>BUSDT`` form, first traded after TOKENISED_EQUITY_START and
    its expanding weekend/weekday mean |return| ratio is below 0.5 (crypto:
    0.7-0.95; tokenised equities: 0.15-0.45). Requiring all three avoids ever
    excluding genuine coins such as BNB, ARB or SHIB."""
    mask = pd.DataFrame(False, close.index, close.columns)
    # true listing date when known (live panels hold only ~800 days, so the
    # first price in the window is NOT the listing date); else first price seen
    first = close.apply(lambda s: s.first_valid_index())
    if listed is not None:
        known = listed.reindex(close.columns)
        first = known.where(known.notna(), first)
    cands = [c for c in close.columns if _EQUITY_NAME.match(c) and first[c] is not None
             and first[c] >= TOKENISED_EQUITY_START]
    if not cands:
        return mask
    r = np.log(close[cands]).diff().abs()
    wk = np.repeat((close.index.dayofweek >= 5)[:, None], len(cands), axis=1)
    we = r.where(wk)
    wd = r.where(~wk)
    # expanding means; fillna(0) before cumsum - a plain cumsum leaves NaN on
    # every row where that day's value is NaN, which made the ratio NaN always
    n_we, n_wd = we.notna().cumsum(), wd.notna().cumsum()
    ratio = ((we.fillna(0).cumsum() / n_we.replace(0, np.nan))
             / (wd.fillna(0).cumsum() / n_wd.replace(0, np.nan)))
    mask[cands] = (ratio < 0.5) | (n_we < 8) | ratio.isna()
    return mask


def compute_features(panel: dict, p) -> dict:
    """Features shared by every configuration with the same lookbacks.
    ``p`` may be a Params (uses p.lookbacks) or anything with ``lookbacks``."""
    close = panel["close"]
    life = ffill_within_life(close)
    lr = np.log(life).diff()
    vol = lr.rolling(p.vol_lookback, min_periods=p.vol_lookback // 2).std()
    vol_long = lr.rolling(max(p.lookbacks), min_periods=20).std()
    adv = panel["quote_volume"].rolling(p.adv_window, min_periods=10).median()
    hist = close.notna().cumsum()
    trend = _trend_score(life, p.lookbacks, vol_long)
    return {"close": close, "vol": vol, "adv": adv, "hist": hist, "trend": trend}


# ------------------------------------------------------------------ building blocks
def _universe_rank(f: dict, min_history: int, excluded: pd.DataFrame | None) -> pd.DataFrame:
    close, vol, adv, hist = f["close"], f["vol"], f["adv"], f["hist"]
    eligible = (hist >= min_history) & close.notna() & adv.notna() & vol.notna()
    if excluded is not None:
        eligible &= ~excluded.reindex_like(eligible).fillna(False).astype(bool)
    return adv.where(eligible).rank(axis=1, ascending=False)


def _regime(trend: pd.DataFrame, on: bool) -> pd.Series | None:
    if not on or "BTCUSDT" not in trend.columns:
        return None
    # full risk when BTC trends up, half when neutral, none in a strong downtrend
    return np.clip(0.5 + trend["BTCUSDT"], 0.0, 1.0).fillna(0.5)


def _size_np(score: np.ndarray, ann_vol: np.ndarray, pick: np.ndarray, target_vol: float,
             max_weight: float, regime: np.ndarray | None) -> np.ndarray:
    """Conviction/vol weights over the picked set, scaled to the vol target
    (numpy core; NaN-safe)."""
    with np.errstate(invalid="ignore", divide="ignore"):
        ratio = score / ann_vol
        raw = np.where(pick & np.isfinite(ratio), ratio, 0.0)
        tot = raw.sum(axis=1)
        w = np.where(tot[:, None] != 0, raw / np.where(tot == 0, 1.0, tot)[:, None], 0.0)
        sig = np.where(pick & np.isfinite(ann_vol), ann_vol, 0.0)
        ws = w * sig
        var = (ws ** 2).sum(axis=1) * (1 - RHO) + ws.sum(axis=1) ** 2 * RHO
        scale = np.where(var > 0,
                         np.minimum(target_vol / np.sqrt(np.where(var > 0, var, 1.0)), 1.0), 0.0)
    if regime is not None:
        scale = scale * regime
    w = np.minimum(w * scale[:, None], max_weight)
    gross = w.sum(axis=1)
    return w / np.where(gross > 1, gross, 1.0)[:, None]


def _hold_np(pick: np.ndarray, neg: np.ndarray, index: pd.DatetimeIndex, every: int,
             offset: int) -> np.ndarray:
    """Selection is refreshed only on rebalance days (days since 1970-01-01,
    minus ``offset``, divisible by ``every`` - so backtest and live agree on the
    calendar). Between rebalances an asset stays held only while its trend has
    stayed positive on every day since selection: exits are daily, entries
    weekly. Memoryless: depends only on data since the last rebalance day."""
    T = len(index)
    day = np.asarray((index - pd.Timestamp("1970-01-01", tz="UTC")).days)
    is_reb = (day - offset) % every == 0
    ar = np.arange(T)
    last_reb = np.maximum.accumulate(np.where(is_reb, ar, -1))
    sel = np.where(last_reb[:, None] >= 0, pick[np.maximum(last_reb, 0)], False)
    block_start = np.maximum(last_reb, 0)
    last_neg = np.maximum.accumulate(np.where(neg, ar[:, None], -1), axis=0)
    return sel & ~(last_neg >= block_start[:, None])


def _hold_since_rebalance(pick: pd.DataFrame, trend: pd.DataFrame, every: int,
                          offset: int = 0) -> pd.DataFrame:
    neg = ((trend <= 0) | trend.isna()).values
    out = _hold_np(pick.values.astype(bool), neg, pick.index, every, offset)
    return pd.DataFrame(out, pick.index, pick.columns)


# ------------------------------------------------------------------ v3: one configuration
def target_weights(panel: dict, p: Params, feats: dict | None = None,
                   exclude_equities: bool = True) -> pd.DataFrame:
    f = feats or compute_features(panel, p)
    excluded = equity_like(f["close"], panel.get("listed")) if exclude_equities else None
    rank_u = _universe_rank(f, p.min_history, excluded)
    trend = f["trend"]
    score = trend.where((rank_u <= p.universe_size) & (trend > 0))
    pick = score.rank(axis=1, ascending=False) <= p.top_k
    if p.rebalance_days > 1:
        pick = _hold_since_rebalance(pick, trend, p.rebalance_days, p.rebalance_offset)
    reg = _regime(trend, p.regime_filter)
    w = _size_np(score.values, (f["vol"] * np.sqrt(365)).values, pick.values.astype(bool),
                 p.target_vol, p.max_weight, None if reg is None else reg.values)
    return pd.DataFrame(w, score.index, score.columns)


# ------------------------------------------------------------------ v4: ensemble
def ensemble_weights(panel: dict, ep: EnsembleParams, feats_cache: dict | None = None,
                     exclude=None) -> pd.DataFrame:
    """Equal-weight average of every (universe size, top-k, lookback set,
    rebalance tranche) member's target weights.

    ``exclude`` (research only): symbols (list) or a boolean DataFrame mask of
    coin-days that may not be held. Excluded coins still feed the BTC regime
    filter, e.g. an alt-only variant excludes BTC and ETH from trading."""
    close = panel["close"]
    excluded = equity_like(close, panel.get("listed")) if ep.exclude_equities else None
    if exclude is not None:
        extra = (exclude.reindex_like(close).fillna(False).astype(bool)
                 if isinstance(exclude, pd.DataFrame)
                 else pd.DataFrame(np.repeat(close.columns.isin(list(exclude))[None, :],
                                             len(close), axis=0), close.index, close.columns))
        excluded = extra if excluded is None else (excluded | extra)
    acc = np.zeros(close.shape)
    n = 0
    for lbs in ep.lookback_sets:
        key = (lbs, ep.vol_lookback, ep.adv_window)
        if feats_cache is not None and key in feats_cache:
            f = feats_cache[key]
        else:
            f = compute_features(panel, Params(lookbacks=lbs, vol_lookback=ep.vol_lookback,
                                               adv_window=ep.adv_window))
            if feats_cache is not None:
                feats_cache[key] = f
        trend = f["trend"]
        ann_vol = (f["vol"] * np.sqrt(365)).values
        neg = ((trend <= 0) | trend.isna()).values
        rank_u = _universe_rank(f, ep.min_history, excluded)
        reg = _regime(trend, ep.regime_filter)
        reg = None if reg is None else reg.values
        for U in ep.universe_sizes:
            score = trend.where((rank_u <= U) & (trend > 0))
            rank = score.rank(axis=1, ascending=False).values
            sv = score.values
            for K in ep.top_ks:
                pick0 = rank <= K
                for off in ep.offsets():
                    pick = (_hold_np(pick0, neg, close.index, ep.rebalance_days, off)
                            if ep.rebalance_days > 1 else pick0)
                    acc += _size_np(sv, ann_vol, pick, ep.target_vol, ep.max_weight, reg)
                    n += 1
    return pd.DataFrame(acc / n, close.index, close.columns)


def single_asset_weights(close: pd.Series, p: Params) -> pd.Series:
    """Asset-specific mode: same trend ensemble + vol targeting on one coin."""
    df = ffill_within_life(close.to_frame("x"))
    lr = np.log(df).diff()
    vol = lr.rolling(p.vol_lookback, min_periods=p.vol_lookback // 2).std()
    vol_long = lr.rolling(max(p.lookbacks), min_periods=20).std()
    tr = _trend_score(df, p.lookbacks, vol_long)["x"]
    ann = vol["x"] * np.sqrt(365)
    w = (p.target_vol / ann).clip(upper=1.0) * tr.clip(lower=0) * 2
    return w.clip(0, 1).fillna(0.0)


def members(ep: EnsembleParams) -> list[Params]:
    """The single configurations an ensemble averages (one per tranche offset)."""
    out = []
    for lbs in ep.lookback_sets:
        for U in ep.universe_sizes:
            for K in ep.top_ks:
                for off in ep.offsets():
                    out.append(Params(universe_size=U, top_k=K, lookbacks=lbs,
                                      min_history=ep.min_history, vol_lookback=ep.vol_lookback,
                                      target_vol=ep.target_vol, max_weight=ep.max_weight,
                                      regime_filter=ep.regime_filter,
                                      rebalance_days=ep.rebalance_days, rebalance_offset=off,
                                      band=ep.band, adv_window=ep.adv_window))
    return out


__all__ = ["Params", "EnsembleParams", "compute_features", "target_weights", "ensemble_weights",
           "single_asset_weights", "equity_like", "ffill_within_life", "members", "replace"]
