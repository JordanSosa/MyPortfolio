"""Historical market data: Binance public bulk archive (data.binance.vision).

Why this source
---------------
* It contains every spot pair Binance ever listed, *including delisted ones*
  (LUNA, FTT, ...). Using it avoids survivorship bias, which is the single most
  common reason crypto backtests look great and then fail live.
* It is free, needs no API key and is not geo-blocked like api.binance.com.

Files are cached under ``cryptobot/data/<interval>/<SYMBOL>.parquet``.
"""
from __future__ import annotations

import io
import re
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import requests

BUCKET = "https://s3-ap-northeast-1.amazonaws.com/data.binance.vision"
BASE = "https://data.binance.vision/data/spot"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

COLS = ["open_time", "open", "high", "low", "close", "volume", "close_time",
        "quote_volume", "trades", "taker_base", "taker_quote", "ignore"]

# Things that are not "crypto assets" in the sense we want to trade.
STABLES = {"USDC", "BUSD", "TUSD", "USDP", "PAX", "DAI", "FDUSD", "USDS", "USDSB", "SUSD",
           "UST", "USTC", "EUR", "GBP", "AUD", "TRY", "BRL", "RUB", "UAH", "NGN", "ZAR",
           "BIDR", "IDRT", "BVND", "AEUR", "EURI", "FRAX", "USD1", "XUSD", "BFUSD", "RLUSD",
           "PAXG", "XAUT", "WBTC", "WBETH", "BETH", "BNSOL", "USDE", "U", "BKRW", "LUSD"}
_LEV = re.compile(r"^(?P<base>[A-Z0-9]*)(UP|DOWN|BULL|BEAR)$")


def is_leveraged(base: str, known_bases) -> bool:
    """Binance leveraged tokens are <UNDERLYING>UP/DOWN/BULL/BEAR (plus the bare
    BULL/BEAR BTC tokens). A real coin that merely ends in those letters (JUP,
    SYRUP) is kept: its prefix is not itself a listed coin."""
    m = _LEV.match(base)
    if not m:
        return False
    under = m.group("base")
    return under == "" or under in known_bases


# kept for backwards compatibility with code that only has one symbol at hand
LEVERAGED = re.compile(r"^(BTC|ETH|BNB|XRP|ADA|LINK|DOT|LTC|BCH|EOS|XTZ|TRX|XLM|FIL|UNI|SUSHI|AAVE|"
                       r"YFI|SXP|1INCH)?(UP|DOWN|BULL|BEAR)USDT$")


def split_discontinuities(panel: dict, max_ratio: float = 8.0, min_gap: int = 3,
                          max_bridge: int = 30) -> dict:
    """Split price series that join two different assets: redenominations,
    token swaps and re-used tickers (e.g. LUNA -> Terra 2.0 on 2022-05-31 under
    the same symbol, x177,400 across an 18-day gap). A break is a price ratio
    beyond ``max_ratio`` (either way) across a trading gap of ``min_gap``+ days,
    or any gap longer than ``max_bridge`` days.

    The latest segment keeps the real symbol (so live orders map correctly);
    earlier segments become ``<SYMBOL>~1``, ``~2``... and end like delistings.
    Real one-day crashes (no gap) are untouched."""
    close = panel["close"]
    breaks = {}
    for c in close.columns:
        s = close[c].dropna()
        if len(s) < 2:
            continue
        gap = s.index.to_series().diff().dt.days
        jump = np.abs(np.log(s / s.shift(1)))
        b = s.index[((gap >= min_gap) & (jump > np.log(max_ratio))) | (gap > max_bridge)]
        if len(b):
            breaks[c] = list(b)
    if not breaks:
        return panel
    out = {k: (v.copy() if isinstance(v, pd.DataFrame) else v) for k, v in panel.items()}
    listed = dict(panel["listed"]) if "listed" in panel else {}
    for c, bs in breaks.items():
        edges = [close.index[0]] + bs
        for i in range(len(bs)):
            name = f"{c}~{i + 1}"
            lo, hi = edges[i], bs[i]
            for k, v in out.items():
                if isinstance(v, pd.DataFrame) and c in v.columns:
                    seg = v[c].where((v.index >= lo) & (v.index < hi))
                    v[name] = seg
            first = close[c].loc[lo:hi].first_valid_index()
            if first is not None:
                listed[name] = first
        for k, v in out.items():
            if isinstance(v, pd.DataFrame) and c in v.columns:
                v[c] = v[c].where(v.index >= bs[-1])
        listed[c] = bs[-1]
    if listed:
        out["listed"] = pd.Series(listed)
    return out


def _list_prefixes(prefix: str) -> list[str]:
    out, marker = [], ""
    while True:
        r = requests.get(BUCKET, params={"delimiter": "/", "prefix": prefix, "marker": marker},
                         timeout=60)
        r.raise_for_status()
        p = re.findall(r"<Prefix>" + re.escape(prefix) + r"([^/]+)/</Prefix>", r.text)
        out += p
        if "<IsTruncated>true" not in r.text or not p:
            return out
        marker = prefix + p[-1] + "/"


def list_usdt_symbols() -> list[str]:
    """All tradable-asset USDT spot pairs ever listed (stables/levered tokens removed).

    Tokenised equities (e.g. ``AAPLBUSDT``) are removed by the liquidity/history
    filters downstream as well as by the explicit check here.
    """
    syms = _list_prefixes("data/spot/monthly/klines/")
    bases = {s[:-4] for s in syms if s.endswith("USDT")}
    out = []
    for s in syms:
        if not s.endswith("USDT"):
            continue
        base = s[:-4]
        if is_leveraged(base, bases) or base in STABLES or base.endswith("BUSD"):
            continue
        out.append(s)
    return out


def _fetch_zip(url: str) -> pd.DataFrame | None:
    for _ in range(4):
        try:
            r = requests.get(url, timeout=60)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                raw = z.read(z.namelist()[0])
            df = pd.read_csv(io.BytesIO(raw), header=None)
            if isinstance(df.iloc[0, 0], str):  # some files have a header row
                df = df.iloc[1:]
            df = df.iloc[:, :12]
            df.columns = COLS
            return df
        except (requests.RequestException, zipfile.BadZipFile):
            continue
    raise RuntimeError(f"failed to download {url}")


def _month_files(symbol: str, interval: str) -> list[str]:
    prefix = f"data/spot/monthly/klines/{symbol}/{interval}/"
    out, marker = [], ""
    while True:
        r = requests.get(BUCKET, params={"prefix": prefix, "marker": marker}, timeout=60)
        r.raise_for_status()
        keys = re.findall(r"<Key>(" + re.escape(prefix) + r"[^<]+\.zip)</Key>", r.text)
        out += keys
        if "<IsTruncated>true" not in r.text or not keys:
            return out
        marker = keys[-1]


def download_symbol(symbol: str, interval: str = "1d", force: bool = False) -> Path | None:
    """Download full monthly history for one symbol into a parquet cache."""
    path = DATA_DIR / interval / f"{symbol}.parquet"
    if path.exists() and not force:
        return path
    keys = _month_files(symbol, interval)
    if not keys:
        return None
    frames = [f for f in (_fetch_zip(f"https://data.binance.vision/{k}") for k in keys)
              if f is not None and len(f)]
    if not frames:
        return None
    df = pd.concat(frames, ignore_index=True)
    ot = pd.to_numeric(df["open_time"])
    # Binance switched spot timestamps to microseconds in 2025.
    ot = np.where(ot > 1e14, ot // 1000, ot)
    df["open_time"] = pd.to_datetime(ot, unit="ms", utc=True)
    for c in ["open", "high", "low", "close", "volume", "quote_volume", "taker_quote"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = (df[["open_time", "open", "high", "low", "close", "volume", "quote_volume", "taker_quote"]]
          .drop_duplicates("open_time").sort_values("open_time").set_index("open_time"))
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path)
    return path


def download_universe(interval: str = "1d", symbols: list[str] | None = None,
                      workers: int = 16) -> list[str]:
    symbols = symbols or list_usdt_symbols()
    with ThreadPoolExecutor(workers) as ex:
        res = list(ex.map(lambda s: (s, download_symbol(s, interval)), symbols))
    return [s for s, p in res if p is not None]


def load_panel(interval: str = "1d", symbols: list[str] | None = None,
               end: str | date | None = None) -> dict[str, pd.DataFrame]:
    """Return wide DataFrames (index=time, columns=symbol) for each OHLCV field."""
    d = DATA_DIR / interval
    files = sorted(d.glob("*.parquet")) if symbols is None else [d / f"{s}.parquet" for s in symbols]
    frames = {f.stem: pd.read_parquet(f) for f in files if f.exists()}
    if not frames:
        raise FileNotFoundError(f"no cached data in {d}; run scripts/download_data.py")
    panel = {}
    for field in ["open", "high", "low", "close", "volume", "quote_volume"]:
        w = pd.DataFrame({s: df[field] for s, df in frames.items()}).sort_index()
        if end is not None:
            w = w.loc[:pd.Timestamp(end, tz="UTC")]
        panel[field] = w
    # metadata: true first-trading date of every symbol (independent of any
    # later slicing of the price window - see strategy.equity_like)
    panel["listed"] = pd.Series({s: df.index[0] for s, df in frames.items() if len(df)})
    return split_discontinuities(panel)


def slice_panel(panel: dict, start=None, end=None) -> dict:
    """Time-slice every price/volume frame of a panel; metadata (Series keyed
    by symbol, e.g. ``listed``) passes through unchanged."""
    def utc(x):
        if x is None:
            return None
        t = pd.Timestamp(x)
        return t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")
    lo, hi = utc(start), utc(end)
    out = {}
    for k, v in panel.items():
        out[k] = v.loc[lo:hi] if isinstance(v, pd.DataFrame) else v
    return out


def topup_daily(symbol: str, interval: str = "1d") -> int:
    """Append daily archive files published after the last monthly file
    (the monthly archive lags by up to a month). Returns rows added."""
    path = DATA_DIR / interval / f"{symbol}.parquet"
    if not path.exists():
        return 0
    df = pd.read_parquet(path)
    last = df.index[-1]
    today = pd.Timestamp.now(tz="UTC").normalize()
    if last < today - pd.Timedelta(days=45):
        return 0  # delisted / inactive
    frames = []
    for d in pd.date_range(last + pd.Timedelta(days=1), today - pd.Timedelta(days=1), freq="D"):
        ds = d.strftime("%Y-%m-%d")
        f = _fetch_zip(f"{BASE}/daily/klines/{symbol}/{interval}/{symbol}-{interval}-{ds}.zip")
        if f is not None and len(f):
            frames.append(f)
    if not frames:
        return 0
    new = pd.concat(frames, ignore_index=True)
    ot = pd.to_numeric(new["open_time"])
    ot = np.where(ot > 1e14, ot // 1000, ot)
    new["open_time"] = pd.to_datetime(ot, unit="ms", utc=True)
    for c in ["open", "high", "low", "close", "volume", "quote_volume", "taker_quote"]:
        new[c] = pd.to_numeric(new[c], errors="coerce")
    new = new[["open_time", "open", "high", "low", "close", "volume", "quote_volume",
               "taker_quote"]].set_index("open_time")
    out = pd.concat([df, new])
    out = out[~out.index.duplicated(keep="last")].sort_index()
    out.to_parquet(path)
    return len(new)


def topup_universe(interval: str = "1d", workers: int = 32) -> int:
    syms = [p.stem for p in (DATA_DIR / interval).glob("*.parquet")]
    with ThreadPoolExecutor(workers) as ex:
        return sum(ex.map(lambda s: topup_daily(s, interval), syms))


def load_tbill(haircut: float = 0.005, refresh: bool = False) -> pd.Series:
    """Daily US 3-month T-bill rate (FRED DTB3) as a decimal annual rate, minus
    ``haircut``, floored at 0, forward-filled to calendar days. Used as a
    conservative proxy for what idle stablecoins earn (flexible savings,
    tokenised T-bill funds); historically Binance/Coinbase stablecoin rates
    were mostly at or above T-bills."""
    path = DATA_DIR / "DTB3.csv"
    if refresh or not path.exists():
        r = requests.get("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTB3", timeout=60)
        r.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(r.text)
    df = pd.read_csv(path)
    df.columns = ["date", "rate"]
    s = pd.to_numeric(df["rate"], errors="coerce") / 100.0
    s.index = pd.to_datetime(df["date"]).dt.tz_localize("UTC")
    s = s.dropna()
    s = s.reindex(pd.date_range(s.index[0], pd.Timestamp.now(tz="UTC").normalize(), freq="D")).ffill()
    return (s - haircut).clip(lower=0.0)


def refresh_symbol(symbol: str, interval: str = "1d") -> int:
    """Bring a cached symbol up to date however stale it is: missing monthly
    archive files first, then daily files for the current month. A symbol is
    only treated as delisted when the archive has nothing newer."""
    path = DATA_DIR / interval / f"{symbol}.parquet"
    if not path.exists():
        return 0
    df = pd.read_parquet(path)
    last = df.index[-1]
    # first month that may hold missing bars: the month of the day after `last`
    first_needed = (last + pd.Timedelta(days=1)).normalize().replace(day=1)
    frames = []
    for k in _month_files(symbol, interval):
        ym = re.search(r"-(\d{4})-(\d{2})\.zip$", k)
        if ym and pd.Timestamp(f"{ym.group(1)}-{ym.group(2)}-01", tz="UTC") >= first_needed:
            f = _fetch_zip(f"https://data.binance.vision/{k}")
            if f is not None and len(f):
                frames.append(f)
    if frames:
        new = _clean(pd.concat(frames, ignore_index=True))
        df = pd.concat([df, new])
        df = df[~df.index.duplicated(keep="last")].sort_index()
        df.to_parquet(path)
    added = len(frames) + topup_daily(symbol, interval)
    return added + _refill_recent_holes(symbol, interval)


def _refill_recent_holes(symbol: str, interval: str = "1d", days: int = 60) -> int:
    """Re-try daily files for dates missing inside the last ``days`` days of a
    cached series (a daily file that 404'd once would otherwise never be
    fetched again). Only applies to the daily interval."""
    if interval != "1d":
        return 0
    path = DATA_DIR / interval / f"{symbol}.parquet"
    df = pd.read_parquet(path)
    lo = max(df.index[0], df.index[-1] - pd.Timedelta(days=days))
    want = pd.date_range(lo, df.index[-1], freq="D")
    missing = want.difference(df.index)
    frames = []
    for d in missing:
        f = _fetch_zip(f"{BASE}/daily/klines/{symbol}/{interval}/{symbol}-{interval}-{d.strftime('%Y-%m-%d')}.zip")
        if f is not None and len(f):
            frames.append(f)
    if not frames:
        return 0
    new = _clean(pd.concat(frames, ignore_index=True))
    out = pd.concat([df, new])
    out = out[~out.index.duplicated(keep="last")].sort_index()
    out.to_parquet(path)
    return len(frames)


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    ot = pd.to_numeric(df["open_time"])
    ot = np.where(ot > 1e14, ot // 1000, ot)
    df["open_time"] = pd.to_datetime(ot, unit="ms", utc=True)
    for c in ["open", "high", "low", "close", "volume", "quote_volume", "taker_quote"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return (df[["open_time", "open", "high", "low", "close", "volume", "quote_volume",
                "taker_quote"]].drop_duplicates("open_time").set_index("open_time").sort_index())


def refresh_universe(interval: str = "1d", workers: int = 32) -> int:
    syms = [p.stem for p in (DATA_DIR / interval).glob("*.parquet")]
    with ThreadPoolExecutor(workers) as ex:
        return sum(ex.map(lambda s: refresh_symbol(s, interval), syms))
