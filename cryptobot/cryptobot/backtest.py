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
  (USDT, assumed 0% yield - conservative).
* Costs per unit of traded notional = taker fee + liquidity-dependent
  slippage. If a held asset stops trading (delisting) it is liquidated at its
  last price minus ``delist_haircut``.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


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
             delist_haircut: float = 0.10, start=None, end=None) -> Result:
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

    px = close.values
    rets = close.pct_change(fill_method=None).values
    tg = targets.values
    adv = adv_usd.values
    T, N = px.shape
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
        # P&L from holdings over bar t
        rr = np.where(np.isfinite(r), r, 0.0)
        pnl = float(h @ rr)
        h = h * (1 + rr)
        # forced liquidation of held assets that disappeared
        dead = (h > 0) & ~alive
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
            tgt = np.where(np.isfinite(tgt) & alive, np.maximum(tgt, 0), 0.0)
            s = tgt.sum()
            if s > 1:
                tgt = tgt / s
            diff = tgt - h
            trade = (np.abs(diff) > band) | ((tgt == 0) & (h > 0)) | ((h == 0) & (tgt > 0))
            trade &= np.abs(diff) > 1e-6
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
