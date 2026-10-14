"""Event-accurate daily portfolio simulator.

Conventions
-----------
* ``targets`` row *t* is a target weight vector computed from data up to and
  including the close of bar *t*. With ``lag=0`` it is filled at the close of
  bar *t* (the live bot runs a few minutes after the UTC daily close, so the
  fill is the close plus slippage). ``lag=1`` fills a full bar later and is
  used as a robustness check.
* Weights drift with prices between trades; the simulator trades an asset only
  when its drifted weight differs from target by more than ``band`` (a
  no-trade band that cuts turnover). Exits to zero are always executed.
* Long-only spot, no leverage: weights >= 0 and sum <= 1, the rest is cash
  (USDT). Cash earns ``cash_rate`` (annualised, per day) if given, else 0%.
* Costs per unit of traded notional = taker fee + liquidity-dependent
  slippage. If a held asset stops trading for good (delisting) it is
  liquidated at its last price minus ``delist_haircut``. A *temporary* gap in
  the data (exchange maintenance, suspended deposits) is not a delisting: the
  position is carried, cannot be traded during the gap, and the full price
  move is booked when trading resumes.
* Trades smaller than ``min_trade`` (fraction of NAV) are skipped unless they
  close a position - mirrors exchange minimum order sizes.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .strategy import ffill_within_life


def _ts(x) -> pd.Timestamp:
    t = pd.Timestamp(x)
    return t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")


@dataclass
class CostModel:
    fee_bps: float = 10.0          # Binance spot taker fee (0.1%)
    base_slip_bps: float = 3.0     # half-spread + impact for the deepest books
    ref_adv_usd: float = 50e6      # ADV at which slippage == base_slip_bps
    max_slip_bps: float = 75.0
    aum_usd: float = 100_000.0     # account size; impact scales with sqrt(order/ADV)
    multiplier: float = 1.0        # stress-test knob (2.0 = double all costs)

    def per_asset_bps(self, adv_usd: np.ndarray) -> np.ndarray:
        adv = np.where(np.isfinite(adv_usd) & (adv_usd > 0), adv_usd, 1e5)
        slip = self.base_slip_bps * np.sqrt(self.ref_adv_usd / adv)
        # square-root market impact of a full-account order (Almgren et al.)
        slip = slip + 50.0 * np.sqrt(self.aum_usd / adv)
        slip = np.clip(slip, self.base_slip_bps, self.max_slip_bps)
        return (self.fee_bps + slip) * self.multiplier


@dataclass
class Result:
    returns: pd.Series
    gross_returns: pd.Series
    weights: pd.DataFrame
    turnover: pd.Series
    costs: pd.Series
    exposure: pd.Series
    trades: int


def simulate(targets: pd.DataFrame, close: pd.DataFrame, adv_usd: pd.DataFrame,
             cost: CostModel | None = None, band: float = 0.0, lag: int = 0,
             delist_haircut: float = 0.10, start=None, end=None,
             cash_rate: pd.Series | None = None, min_trade: float = 0.0) -> Result:
    cost = cost or CostModel()
    cols = targets.columns
    close = close.reindex(columns=cols)
    adv_usd = adv_usd.reindex(index=close.index, columns=cols)
    targets = targets.reindex(index=close.index).shift(lag)
    if start is not None:
        sel = close.index >= _ts(start)
        close, targets, adv_usd = close[sel], targets[sel], adv_usd[sel]
    if end is not None:
        sel = close.index <= _ts(end)
        close, targets, adv_usd = close[sel], targets[sel], adv_usd[sel]

    px = close.values                                   # NaN = not tradable today
    life = ffill_within_life(close)
    rets = life.pct_change(fill_method=None).values     # gap days 0, resume day = full move
    listed = life.notna().values                        # between first and last print
    tg = targets.values
    adv = adv_usd.values
    T, N = px.shape
    cr = (np.zeros(T) if cash_rate is None else
          cash_rate.reindex(close.index).ffill().fillna(0.0).values / 365.0)
    h = np.zeros(N)
    out_r = np.zeros(T)
    out_g = np.zeros(T)
    out_to = np.zeros(T)
    out_c = np.zeros(T)
    W = np.zeros((T, N))
    n_trades = 0
    for t in range(T):
        r = rets[t]
        alive = np.isfinite(px[t])
        # P&L from holdings over bar t, plus interest on idle cash
        rr = np.where(np.isfinite(r), r, 0.0)
        pnl = float(h @ rr) + max(0.0, 1.0 - float(h.sum())) * cr[t]
        h = h * (1 + rr)
        # forced liquidation of held assets that were delisted (not mere gaps)
        dead = (h > 0) & ~listed[t]
        forced = 0.0
        if dead.any():
            forced = float(h[dead].sum() * delist_haircut)
            pnl -= forced
            h[dead] = 0.0
        nav = 1 + pnl
        h = h / nav if nav > 0 else h * 0
        cost_t = 0.0
        to_t = 0.0
        tgt = tg[t]
        if np.isfinite(tgt).any():
            tgt = np.where(np.isfinite(tgt), np.maximum(tgt, 0), 0.0)
            s = tgt.sum()
            if s > 1:
                tgt = tgt / s
            tgt = np.where(alive, tgt, h)               # cannot trade during a data gap
            diff = tgt - h
            trade = (np.abs(diff) > band) | ((tgt == 0) & (h > 0)) | ((h == 0) & (tgt > 0))
            trade &= (np.abs(diff) > max(min_trade, 1e-6)) | ((tgt == 0) & (h > 0))
            trade &= alive
            if trade.any():
                bps = cost.per_asset_bps(adv[t])
                cost_t = float((np.abs(diff[trade]) * bps[trade]).sum() / 1e4)
                to_t = float(np.abs(diff[trade]).sum())
                h[trade] = tgt[trade]
                n_trades += int(trade.sum())
        out_g[t] = pnl
        out_r[t] = (1 + pnl) * (1 - cost_t) - 1
        out_to[t] = to_t
        out_c[t] = cost_t
        W[t] = h
    idx = close.index
    Wdf = pd.DataFrame(W, idx, cols)
    return Result(pd.Series(out_r, idx), pd.Series(out_g, idx), Wdf,
                  pd.Series(out_to, idx), pd.Series(out_c, idx), Wdf.sum(axis=1), n_trades)
