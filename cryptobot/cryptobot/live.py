"""Live / paper trading engine.

The engine calls *exactly* the same ``target_weights`` function as the
backtest, on a panel built from the exchange's recent daily candles, and takes
the last row. The only live-specific logic is order generation (same no-trade
band as the simulator) and bookkeeping.

Run once per day shortly after 00:00 UTC (the daily candle close), e.g. cron:
    5 0 * * *  cd /path/to/cryptobot && python scripts/paper_trade.py
"""
from __future__ import annotations

import csv
import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .backtest import CostModel
from .strategy import Params, compute_features, target_weights

QUOTE = "USDT"


# ---------------------------------------------------------------- market data
def build_live_panel(exchange, n_symbols: int = 80, days: int = 400,
                     quote: str = QUOTE, extra: list[str] | None = None) -> dict:
    """Daily OHLCV panel for the ``n_symbols`` most liquid ``*/quote`` spot
    markets on ``exchange`` (a ccxt instance). Excludes stablecoins and the
    still-forming current candle."""
    from .data import LEVERAGED, STABLES
    exchange.load_markets()
    tickers = exchange.fetch_tickers()
    cands = []
    for sym, t in tickers.items():
        m = exchange.markets.get(sym)
        if not m or not m.get("spot") or m.get("quote") != quote or not m.get("active", True):
            continue
        if m["base"] in STABLES or LEVERAGED.search(m["base"] + quote):
            continue
        qv = t.get("quoteVolume") or (t.get("baseVolume") or 0) * (t.get("last") or 0)
        cands.append((qv or 0, sym))
    cands = [s for _, s in sorted(cands, reverse=True)[:n_symbols]]
    # always fetch currently held coins so they can be valued and sold
    for name in extra or []:
        sym = name[:-len(quote)] + "/" + quote
        if sym in exchange.markets and sym not in cands:
            cands.append(sym)
    since = exchange.milliseconds() - days * 86_400_000
    fields = {k: {} for k in ["open", "high", "low", "close", "volume", "quote_volume"]}
    today = pd.Timestamp.now(tz="UTC").normalize()
    for sym in cands:
        try:
            rows = _fetch_daily(exchange, sym, since)
        except Exception as e:  # noqa: BLE001 - one bad market shouldn't stop the run
            print(f"skip {sym}: {e}")
            continue
        if not rows:
            continue
        df = pd.DataFrame(rows, columns=["t", "open", "high", "low", "close", "volume"])
        df.index = pd.to_datetime(df["t"], unit="ms", utc=True)
        df = df[df.index < today]                     # drop the forming candle
        df["quote_volume"] = df["volume"] * df["close"]
        name = sym.replace("/", "")
        for k in fields:
            fields[k][name] = df[k]
        time.sleep(exchange.rateLimit / 1000)
    return {k: pd.DataFrame(v).sort_index() for k, v in fields.items()}


def _fetch_daily(exchange, sym: str, since: int) -> list:
    """Paginated daily candles (some venues cap a request at 300 bars)."""
    rows: list = []
    while True:
        batch = exchange.fetch_ohlcv(sym, "1d", since=since, limit=300)
        if not batch:
            return rows
        rows += [b for b in batch if not rows or b[0] > rows[-1][0]]
        if len(batch) < 300 or batch[-1][0] >= exchange.milliseconds() - 86_400_000:
            return rows
        since = batch[-1][0] + 86_400_000
        time.sleep(exchange.rateLimit / 1000)


def latest_targets(panel: dict, p: Params) -> tuple[pd.Timestamp, pd.Series, pd.Series]:
    f = compute_features(panel, p)
    w = target_weights(panel, p, f)
    t = w.index[-1]
    return t, w.iloc[-1], panel["close"].iloc[-1]


# ---------------------------------------------------------------- execution
def plan_orders(target: pd.Series, current: pd.Series, band: float) -> pd.Series:
    """Weight deltas to trade, using the simulator's exact band rule."""
    idx = target.index.union(current.index)
    tgt = target.reindex(idx).fillna(0).clip(lower=0)
    if tgt.sum() > 1:
        tgt = tgt / tgt.sum()
    cur = current.reindex(idx).fillna(0)
    diff = tgt - cur
    trade = (diff.abs() > band) | ((tgt == 0) & (cur > 0)) | ((cur == 0) & (tgt > 0))
    trade &= diff.abs() > 1e-6
    return diff[trade]


@dataclass
class PaperAccount:
    path: Path
    cash: float = 10_000.0
    units: dict | None = None
    cost: CostModel = field(default_factory=CostModel)

    @classmethod
    def load(cls, path: Path, initial_cash: float = 10_000.0) -> "PaperAccount":
        if path.exists():
            s = json.loads(path.read_text())
            return cls(path, s["cash"], s["units"])
        return cls(path, initial_cash, {})

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({"cash": self.cash, "units": self.units}, indent=2))

    def nav(self, prices: pd.Series) -> float:
        return self.cash + sum(u * float(prices.get(s, np.nan)) for s, u in self.units.items()
                               if np.isfinite(prices.get(s, np.nan)))

    def weights(self, prices: pd.Series) -> pd.Series:
        nav = self.nav(prices)
        return pd.Series({s: u * prices[s] / nav for s, u in self.units.items()
                          if s in prices and np.isfinite(prices[s])}, dtype=float)

    def execute(self, deltas: pd.Series, prices: pd.Series, adv: pd.Series) -> list[dict]:
        nav = self.nav(prices)
        bps = pd.Series(self.cost.per_asset_bps(adv.reindex(deltas.index).values), deltas.index)
        fills = []
        for sym in deltas.sort_values().index:          # sells first, frees cash
            dw = float(deltas[sym])
            px = float(prices[sym])
            notional = dw * nav
            c = abs(notional) * bps[sym] / 1e4
            self.units[sym] = self.units.get(sym, 0.0) + notional / px
            self.cash -= notional + c
            if abs(self.units[sym]) * px < 1e-6:
                self.units.pop(sym)
            fills.append({"symbol": sym, "side": "BUY" if dw > 0 else "SELL",
                          "notional": round(notional, 2), "price": px, "cost": round(c, 4)})
        return fills


class LiveBroker:
    """Real orders via ccxt. Requires API keys and explicit opt-in. Market
    orders, sells before buys, respects exchange minimums."""

    def __init__(self, exchange):
        if os.environ.get("CRYPTOBOT_LIVE") != "I_UNDERSTAND_THE_RISK":
            raise RuntimeError("Set CRYPTOBOT_LIVE=I_UNDERSTAND_THE_RISK to trade real money.")
        self.ex = exchange

    def positions(self, prices: pd.Series) -> tuple[float, pd.Series]:
        bal = self.ex.fetch_balance()["total"]
        vals = {f"{a}{QUOTE}": q * float(prices[f"{a}{QUOTE}"]) for a, q in bal.items()
                if f"{a}{QUOTE}" in prices.index and q}
        nav = float(bal.get(QUOTE, 0)) + sum(vals.values())
        return nav, pd.Series(vals, dtype=float) / nav

    def execute(self, deltas: pd.Series, prices: pd.Series, nav: float) -> list[dict]:
        fills = []
        for name in deltas.sort_values().index:
            sym = name[:-len(QUOTE)] + "/" + QUOTE
            amount = abs(float(deltas[name])) * nav / float(prices[name])
            m = self.ex.market(sym)
            amount = float(self.ex.amount_to_precision(sym, amount))
            min_cost = (m.get("limits", {}).get("cost", {}) or {}).get("min") or 5
            if amount * float(prices[name]) < min_cost:
                continue
            side = "buy" if deltas[name] > 0 else "sell"
            o = self.ex.create_order(sym, "market", side, amount)
            fills.append({"symbol": name, "side": side, "amount": amount, "id": o.get("id")})
        return fills


def append_csv(path: Path, rows: list[dict]):
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    new = not path.exists()
    with path.open("a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        if new:
            w.writeheader()
        w.writerows(rows)


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
