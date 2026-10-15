"""Execution constraints shared by the simulator and the live/paper engine.

Kept separate from the strategy: these depend on the account (its size), not
on market signals, so they are not part of the frozen strategy parameters.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

MAX_PARTICIPATION = 0.10   # a position may not exceed 10% of the coin's median daily volume


def liquidity_cap(target, adv_usd, nav_usd: float, max_participation: float = MAX_PARTICIPATION):
    """Cap each target weight at ``max_participation * ADV / NAV`` so that no
    position is larger than a tenth of a typical day's trading in that coin
    (it can then be exited within a day without dominating the market).
    Works on a Series (live: one day) or an ndarray row (simulator).
    Never binds for small accounts in liquid coins."""
    if nav_usd <= 0 or max_participation is None:
        return target
    if isinstance(target, pd.Series):
        adv = adv_usd.reindex(target.index) if isinstance(adv_usd, pd.Series) else adv_usd
        cap = (max_participation * pd.Series(adv, index=target.index).astype(float)).fillna(0.0) / nav_usd
        return target.clip(upper=cap)
    adv = np.where(np.isfinite(adv_usd), adv_usd, 0.0)
    return np.minimum(target, max_participation * adv / nav_usd)


# ------------------------------------------------------------------ deposits / withdrawals
FLOW_MIN_USD = 10.0            # smaller unexplained NAV changes are noise (interest, dust, rounding)
FLOW_MIN_FRAC = 0.005          # ... or smaller than 0.5% of the account
WITHDRAW_PRORATA_FRAC = 0.10   # withdrawals up to 10% of the account come out of cash only


def detect_flow(nav_now: float, cash_prev: float, units_prev: dict, prices) -> float:
    """External deposit (+) or withdrawal (-) since the last run: today's
    account value minus what yesterday's holdings would be worth at today's
    prices. Trades between runs move value between assets and do not count;
    only money entering or leaving the account does."""
    expected = float(cash_prev) + sum(float(u) * float(prices[s]) for s, u in units_prev.items()
                                      if s in prices.index and np.isfinite(prices[s]))
    flow = nav_now - expected
    if abs(flow) < max(FLOW_MIN_USD, FLOW_MIN_FRAC * max(nav_now, 1.0)):
        return 0.0
    return flow


def flow_deltas(flow: float, weights_pre: pd.Series, nav_after: float,
                min_order_usd: float = 5.0,
                withdraw_prorata_frac: float = WITHDRAW_PRORATA_FRAC) -> pd.Series:
    """Weight changes (relative to the post-flow account) that put a deposit
    or withdrawal to work *pro rata*: every holding grows or shrinks by the
    same fraction and the cash share stays the same, so the account keeps
    exactly the mix the strategy chose - as if the flow had always been there.

    * deposits: each holding is topped up by ``flow x its weight`` (skipped if
      below the exchange minimum order; that part simply stays as cash)
    * withdrawals up to ``withdraw_prorata_frac`` of the account are taken from
      cash (no selling - the account is usually ~75% cash); larger ones trim
      every holding pro rata so risk does not jump
    """
    if flow == 0 or nav_after <= 0 or weights_pre.empty:
        return pd.Series(dtype=float)
    nav_pre = nav_after - flow
    if flow < 0 and -flow <= withdraw_prorata_frac * nav_pre:
        return pd.Series(dtype=float)
    amounts = flow * weights_pre                         # dollars per holding
    amounts = amounts[amounts.abs() >= min_order_usd]
    return amounts / nav_after
