#!/usr/bin/env python3
"""Download / refresh market data. Safe to re-run (only fetches what is missing).

    python scripts/download_data.py            # Binance daily, every USDT pair incl. delisted (~45 min first time)
    python scripts/download_data.py --hourly   # + hourly bars for coins that ever entered the universe (exec test)
    python scripts/download_data.py --bitfinex # + Bitfinex 2013-2018 validation set (~1 h, rate-limited)
    python scripts/download_data.py --tbill    # + US 3-month T-bill rates (cash-yield modelling)
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from cryptobot import data  # noqa: E402

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--hourly", action="store_true")
    ap.add_argument("--bitfinex", action="store_true")
    ap.add_argument("--tbill", action="store_true")
    a = ap.parse_args()
    ok = data.download_universe("1d", workers=48)
    print(f"daily: {len(ok)} symbols; refreshed {data.refresh_universe('1d')} files")
    if a.hourly:
        from cryptobot.research import trim_panel
        panel = trim_panel(data.load_panel("1d"))
        print(f"hourly: {len(data.download_universe('1h', symbols=list(panel['close'].columns), workers=48))} symbols")
    if a.bitfinex:
        from cryptobot import data_bitfinex
        bases = [p.stem[:-4] for p in (data.DATA_DIR / "1d").glob("*.parquet")]
        print(f"bitfinex: {len(data_bitfinex.download(bases))} pairs")
    if a.tbill:
        print(f"T-bill series to {data.load_tbill(refresh=True).index[-1].date()}")
