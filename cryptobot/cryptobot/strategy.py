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

Design choices that reduce overfitting
--------------------------------------
* Signals are an *ensemble* over several lookbacks instead of one tuned value.
* Universe is chosen point-in-time by trailing liquidity, so it naturally
  rotates as coins rise and die (no hindsight list of "winners").
* Very few free parameters; every one has an economic meaning.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd


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
    band: float = 0.05               # no-trade band (abs weight) in the simulator
    adv_window: int = 30

    def to_dict(self):
        d = asdict(self)
        d["lookbacks"] = list(self.lookbacks)
        return d


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


def compute_features(panel: dict, p: Params) -> dict:
    close = panel["close"]
    lr = np.log(close).diff()
    vol = lr.rolling(p.vol_lookback, min_periods=p.vol_lookback // 2).std()
    vol_long = lr.rolling(max(p.lookbacks), min_periods=20).std()
    adv = (panel["quote_volume"].rolling(p.adv_window, min_periods=10).median())
    hist = close.notna().cumsum()
    trend = _trend_score(close, p.lookbacks, vol_long)
    return {"close": close, "vol": vol, "adv": adv, "hist": hist, "trend": trend}


def target_weights(panel: dict, p: Params, feats: dict | None = None) -> pd.DataFrame:
    f = feats or compute_features(panel, p)
    close, vol, adv, hist, trend = f["close"], f["vol"], f["adv"], f["hist"], f["trend"]

    # point-in-time liquid universe
    eligible = (hist >= p.min_history) & close.notna() & adv.notna() & vol.notna()
    adv_rank = adv.where(eligible).rank(axis=1, ascending=False)
    in_univ = adv_rank <= p.universe_size

    # candidates: in universe and trending up; rank by trend strength
    score = trend.where(in_univ & (trend > 0))
    rank = score.rank(axis=1, ascending=False)
    pick = rank <= p.top_k
    if p.rebalance_days > 1:
        pick = _hold_since_rebalance(pick, trend, p.rebalance_days)

    # inverse-vol weights scaled by conviction (trend strength)
    ann_vol = vol * np.sqrt(365)
    raw = (score / ann_vol).where(pick).fillna(0.0)
    tot = raw.sum(axis=1)
    w = raw.div(tot.replace(0, np.nan), axis=0).fillna(0.0)

    # portfolio vol targeting using a simple correlation assumption (avg rho)
    rho = 0.6  # crypto assets are highly correlated; conservative constant
    sig = ann_vol.where(pick).fillna(0.0)
    var = ((w * sig) ** 2).sum(axis=1) * (1 - rho) + ((w * sig).sum(axis=1) ** 2) * rho
    port_vol = np.sqrt(var)
    scale = (p.target_vol / port_vol.replace(0, np.nan)).clip(upper=1.0).fillna(0.0)

    if p.regime_filter and "BTCUSDT" in trend.columns:
        btc = trend["BTCUSDT"]
        # full risk when BTC trends up, half when neutral-negative, none in strong downtrend
        regime = np.clip(0.5 + btc, 0.0, 1.0)
        scale = scale * regime.reindex(scale.index).fillna(0.5)

    w = w.mul(scale, axis=0)
    w = w.clip(upper=p.max_weight)
    gross = w.sum(axis=1)
    w = w.div(gross.where(gross > 1, 1.0), axis=0)
    return w


def _hold_since_rebalance(pick: pd.DataFrame, trend: pd.DataFrame, every: int) -> pd.DataFrame:
    """Selection is refreshed only on rebalance days (days since 1970-01-01
    divisible by ``every``, so backtest and live agree on the calendar). Between
    rebalances an asset stays held only while its trend has stayed positive on
    every day since selection - exits are daily, entries weekly. Memoryless:
    depends only on data since the last rebalance day."""
    day = (pick.index - pd.Timestamp("1970-01-01", tz="UTC")).days
    is_reb = pd.Series(day % every == 0, pick.index)
    mask = np.repeat(is_reb.values[:, None], pick.shape[1], axis=1)
    sel = pick.astype(float).where(mask).ffill().fillna(0.0).astype(bool)
    block = is_reb.cumsum()
    neg = (trend <= 0) | trend.isna()
    broke = neg.astype(int).groupby(block.values).cummax().astype(bool)
    return sel & ~broke


def single_asset_weights(close: pd.Series, p: Params) -> pd.Series:
    """Asset-specific mode: same trend ensemble + vol targeting on one coin."""
    df = close.to_frame("x")
    lr = np.log(df).diff()
    vol = lr.rolling(p.vol_lookback, min_periods=p.vol_lookback // 2).std()
    vol_long = lr.rolling(max(p.lookbacks), min_periods=20).std()
    tr = _trend_score(df, p.lookbacks, vol_long)["x"]
    ann = vol["x"] * np.sqrt(365)
    w = (p.target_vol / ann).clip(upper=1.0) * tr.clip(lower=0) * 2
    return w.clip(0, 1).fillna(0.0)
