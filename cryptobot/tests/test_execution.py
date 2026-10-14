import numpy as np
import pandas as pd

from cryptobot.execution import liquidity_cap


def test_liquidity_cap_binds_only_for_thin_markets():
    tgt = pd.Series({"BIG": 0.2, "THIN": 0.2})
    adv = pd.Series({"BIG": 50e6, "THIN": 20_000.0})
    out = liquidity_cap(tgt, adv, nav_usd=100_000)
    assert out["BIG"] == 0.2                       # 10% of $50M >> $20k position
    assert np.isclose(out["THIN"], 0.02)            # 10% of $20k = $2k = 2% of NAV


def test_liquidity_cap_array_form_and_unknown_adv():
    out = liquidity_cap(np.array([0.3, 0.3]), np.array([np.nan, 1e9]), nav_usd=1e6)
    assert out[0] == 0.0 and out[1] == 0.3          # unknown liquidity -> no position
