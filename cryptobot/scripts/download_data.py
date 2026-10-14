#!/usr/bin/env python3
"""Download / refresh the daily history of every Binance USDT spot pair
(including delisted ones) into cryptobot/data/1d. Safe to re-run."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from cryptobot import data  # noqa: E402

if __name__ == "__main__":
    ok = data.download_universe("1d", workers=48)
    print(f"monthly archive: {len(ok)} symbols")
    print(f"daily top-up rows: {data.topup_universe('1d')}")
