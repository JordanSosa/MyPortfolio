"""Independent validation data: Bitfinex USD pairs, 2013-2018, incl. delisted.

Why: the Binance 2019-2024 period was used to develop the strategy and the
2025-26 holdout has been looked at, so neither is untouched any more. Bitfinex
is a different venue (USD-quoted, different order books and listings) whose
public API still serves candles for delisted pairs, so a survivorship-free
panel for 2016-2018 can be rebuilt - a period the strategy never traded in
development (Binance history only starts 2017-08).

Bitfinex does not publish a list of delisted pairs, so candidates are the
union of its current currencies, every Binance/Poloniex base asset and its
legacy 3-letter codes; every candidate is probed and kept if it has candles
before ``END``.
"""
from __future__ import annotations

import time
from pathlib import Path

import pandas as pd
import requests

from .data import DATA_DIR, STABLES

API = "https://api-pub.bitfinex.com/v2"
OUT = DATA_DIR / "bitfinex_1d"
END = pd.Timestamp("2019-01-31", tz="UTC")

LEGACY = """AID AGI AIO ANT ATM AUC AVT BAT BBN BCI BFT BNT BTG BCH BAB BSV CBT CFI CND CNN
CTX DAD DAT DTA DTH DTX DGB EDO ELF ESS ETP EVT FUN GNT GOT HOT IOS IOT IQX KNC LRC LYM MAN
MIT MKR MNA MTN NCA NEO ODE OMG ORS PAI POA POY QSH QTM RBT RCN RDN REP REQ RLC RRT RTE SAN
SEE SEN SNG SNT SPK STJ TKN TNB TRX UTK UTN VEE VET WAX WPR WTC XLM XTZ XVG YYW ZCN ZIL ZRX
DSH XMR ZEC ETC LTC ETH BTC XRP EOS LEO GNO ABS AMP BOX CLO DGX GSD MLN OKB SWM USK VSY XCH
ATD ADD MTO IQX ENJ NEC ORS UOS YGG OMN DRN PNK""".split()


def _get(url: str, params: dict | None = None):
    for attempt in range(8):
        r = requests.get(url, params=params, timeout=30)
        if r.status_code == 429 or (r.status_code >= 500):
            time.sleep(10 * (attempt + 1))
            continue
        return r
    r.raise_for_status()
    return r


def candidate_codes(binance_bases: list[str]) -> list[str]:
    cur = _get(f"{API}/conf/pub:list:currency").json()[0]
    pol = []
    try:
        pol = [m["symbol"].split("_")[0] for m in _get("https://api.poloniex.com/markets").json()]
    except Exception:  # noqa: BLE001 - optional source
        pass
    ok = lambda c: (c.isalnum() and c.upper() == c and 2 <= len(c) <= 6 and not c.endswith("F0")
                    and c not in STABLES and c not in {"UST", "USD", "EUR"})
    # probe the likeliest first: legacy Bitfinex codes, then its current list, then the rest
    ordered, seen = [], set()
    for group in (LEGACY, sorted(cur), sorted(set(binance_bases) | set(pol))):
        for c in group:
            if ok(c) and c not in seen:
                ordered.append(c)
                seen.add(c)
    return ordered


def fetch_pair(code: str) -> pd.DataFrame | None:
    sym = f"t{code}USD" if len(code) == 3 else f"t{code}:USD"
    r = _get(f"{API}/candles/trade:1D:{sym}/hist",
             {"limit": 10000, "start": 0, "end": int(END.timestamp() * 1000), "sort": 1})
    try:
        d = r.json()
    except ValueError:
        return None
    if not isinstance(d, list) or not d or not isinstance(d[0], list):
        return None
    df = pd.DataFrame(d, columns=["t", "open", "close", "high", "low", "volume"])
    df.index = pd.to_datetime(df["t"], unit="ms", utc=True).dt.normalize()
    df = df[~df.index.duplicated(keep="last")].sort_index()
    df["quote_volume"] = df["volume"] * df["close"]
    return df[["open", "high", "low", "close", "volume", "quote_volume"]]


def download(binance_bases: list[str], sleep: float = 2.1, log=print) -> list[str]:
    OUT.mkdir(parents=True, exist_ok=True)
    done = {p.stem for p in OUT.glob("*.parquet")}
    probed = OUT / "_probed.txt"
    seen = set(probed.read_text().split()) if probed.exists() else set()
    kept = []
    for code in candidate_codes(binance_bases):
        if code in seen:
            if f"{code}USD" in done:
                kept.append(code)
            continue
        df = fetch_pair(code)
        if df is not None and len(df) and df.index[0] < END:
            df.to_parquet(OUT / f"{code}USD.parquet")
            kept.append(code)
            log(f"kept {code}: {df.index[0].date()} -> {df.index[-1].date()} ({len(df)} bars)")
        with probed.open("a") as fh:
            fh.write(code + "\n")
        time.sleep(sleep)
    return kept


GOLD = {"XAUT", "PAXG", "XAU", "DGX"}


def is_pegged(close: pd.Series) -> bool:
    """Stablecoin test fixed in PROTOCOL_v2: close within +-5% of 1.00 USD on
    at least 80% of trading days."""
    c = close.dropna()
    return len(c) > 0 and float(((c > 0.95) & (c < 1.05)).mean()) >= 0.8


def load_panel_bitfinex(end: str = "2018-12-31") -> dict[str, pd.DataFrame]:
    files = sorted(OUT.glob("*.parquet"))
    frames = {f.stem: pd.read_parquet(f) for f in files}
    frames = {k: v.loc[:pd.Timestamp(end, tz="UTC")] for k, v in frames.items()}
    frames = {k: v for k, v in frames.items()
              if len(v) and k[:-3] not in GOLD and not is_pegged(v["close"])}
    full = pd.date_range(min(df.index[0] for df in frames.values()), pd.Timestamp(end, tz="UTC"),
                         freq="D")
    panel = {}
    for field in ["open", "high", "low", "close", "volume", "quote_volume"]:
        w = pd.DataFrame({s: df[field] for s, df in frames.items()}).reindex(full)
        if field in ("open", "high", "low", "close"):
            # Bitfinex omits candles on zero-volume days: carry the last price
            # forward *within* a pair's life so quiet days are not mistaken for
            # delistings; volume stays 0 on those days.
            last_valid = {s: frames[s].index[-1] for s in frames}
            filled = w.ffill()
            for s, lv in last_valid.items():
                filled.loc[filled.index > lv, s] = float("nan")
            w = filled
        else:
            w = w.fillna(0.0)
            for s, df in frames.items():
                w.loc[(w.index < df.index[0]) | (w.index > df.index[-1]), s] = float("nan")
        panel[field] = w
    # rename to Binance-style symbols so the strategy's BTC regime filter works
    return {k: v.rename(columns=lambda c: c.replace("USD", "USDT")) for k, v in panel.items()}
