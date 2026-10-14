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
