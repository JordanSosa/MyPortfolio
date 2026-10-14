"""Live / paper trading engine.

The engine calls *exactly* the same weight functions as the backtest
(``ensemble_weights`` for v4, ``target_weights`` for v3) on a panel built from
recent daily candles, and takes the last row. Live-specific logic is limited to
order generation (the simulator's band / minimum-trade / no-trade-in-gap
rules, see ``plan_orders``), order execution and bookkeeping.

Run once per day shortly after 00:00 UTC (the daily candle close), e.g. cron:
    5 0 * * *  cd /path/to/cryptobot && python scripts/paper_trade.py
"""
from __future__ import annotations

import contextlib
import csv
import fcntl
import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .backtest import CostModel
from .strategy import (EnsembleParams, Params, compute_features, ensemble_weights,
                       target_weights)

QUOTE = "USDT"


# ---------------------------------------------------------------- configuration
def load_strategy(path: Path) -> EnsembleParams | Params:
    """Read a frozen config (v4 ensemble or v3 single config), verifying its hash."""
    import hashlib
    fz = json.loads(Path(path).read_text())
    blob = json.dumps(fz["params"], sort_keys=True)
    if "sha256" in fz and hashlib.sha256(blob.encode()).hexdigest() != fz["sha256"]:
        raise ValueError(f"{path}: parameters do not match their recorded hash")
    if fz.get("version") == "v4":
        return EnsembleParams.from_dict(fz["params"])
    cfg = dict(fz["params"])
    cfg["lookbacks"] = tuple(cfg["lookbacks"])
    return Params(**cfg)


def history_days(p: EnsembleParams | Params) -> int:
    """Daily bars the live panel needs so every feature equals the backtest's:
    the longest lookback plus a volatility window of the same length, plus slack."""
    lb = p.max_lookback if isinstance(p, EnsembleParams) else max(p.lookbacks)
    return max(lb * 2 + 160, p.min_history + 160)


def min_trade_of(p) -> float:
    return getattr(p, "min_trade", 0.0)


# ---------------------------------------------------------------- market data
def build_live_panel(exchange, n_symbols: int = 80, days: int = 800,
                     quote: str = QUOTE, extra: list[str] | None = None) -> dict:
    """Daily OHLCV panel for the ``n_symbols`` most liquid ``*/quote`` spot
    markets on ``exchange`` (a ccxt instance) plus any ``extra`` symbols (held
    coins). Excludes stablecoins, leveraged tokens and the forming candle."""
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
    panel = {k: pd.DataFrame(v).sort_index() for k, v in fields.items()}
    panel["listed"] = _listing_dates(exchange, list(panel["close"].columns), quote)
    return panel


def _listing_dates(exchange, names: list[str], quote: str) -> pd.Series:
    """First-ever daily candle for symbols the tokenised-equity rule could
    apply to (``<TICKER>B<quote>``). The live window is ~800 days, so the
    first price in it is not the listing date."""
    from .strategy import _EQUITY_NAME
    out = {}
    for name in names:
        if not _EQUITY_NAME.match(name):
            continue
        try:
            first = exchange.fetch_ohlcv(name[:-len(quote)] + "/" + quote, "1d", since=0, limit=1)
            if first:
                out[name] = pd.Timestamp(first[0][0], unit="ms", tz="UTC")
        except Exception as e:  # noqa: BLE001 - fall back to the first price in the window
            print(f"listing date unavailable for {name}: {e}")
    return pd.Series(out, dtype="datetime64[ns, UTC]")


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


# ---------------------------------------------------------------- signals
def latest_targets(panel: dict, p: Params | EnsembleParams
                   ) -> tuple[pd.Timestamp, pd.Series, pd.Series]:
    if isinstance(p, EnsembleParams):
        w = ensemble_weights(panel, p)
    else:
        w = target_weights(panel, p, compute_features(panel, p))
    t = w.index[-1]
    return t, w.iloc[-1], panel["close"].iloc[-1]


def latest_targets_v4(panel: dict, ep: EnsembleParams):
    return latest_targets(panel, ep)


def check_fresh(bar: pd.Timestamp, now: pd.Timestamp | None = None) -> None:
    """Refuse to trade on stale data: the latest complete daily bar must be
    yesterday's (UTC)."""
    now = now or pd.Timestamp.now(tz="UTC")
    expected = now.normalize() - pd.Timedelta(days=1)
    if bar < expected:
        raise RuntimeError(f"stale data: latest bar {bar.date()} but expected {expected.date()}; "
                           "not trading")


# ---------------------------------------------------------------- order planning
def plan_orders(target: pd.Series, current: pd.Series, band: float, min_trade: float = 0.0,
                tradable: pd.Index | None = None) -> pd.Series:
    """Weight deltas to trade - the simulator's exact rules: trade when the
    drift exceeds ``band`` or a position opens/closes; skip trades smaller than
    ``min_trade`` unless they close a position; never trade a coin with no
    price today (data gap / suspended market)."""
    idx = target.index.union(current.index)
    tgt = target.reindex(idx).fillna(0).clip(lower=0)
    if tgt.sum() > 1:
        tgt = tgt / tgt.sum()
    cur = current.reindex(idx).fillna(0)
    if tradable is not None:
        frozen = ~idx.isin(tradable)
        tgt[frozen] = cur[frozen]
    diff = tgt - cur
    closing = (tgt == 0) & (cur > 0)
    trade = (diff.abs() > band) | closing | ((cur == 0) & (tgt > 0))
    trade &= (diff.abs() > max(min_trade, 1e-6)) | closing
    return diff[trade]


# ---------------------------------------------------------------- bookkeeping
def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text)
    os.replace(tmp, path)


@contextlib.contextmanager
def run_lock(path: Path):
    """Exclusive lock so two cron runs can never trade the same account at once."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as fh:
        try:
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as e:
            raise RuntimeError(f"another run holds {path}") from e
        yield


def already_done(state_dir: Path, bar: pd.Timestamp) -> bool:
    f = state_dir / "last_bar.txt"
    return f.exists() and f.read_text().strip() >= str(bar.date())


def mark_done(state_dir: Path, bar: pd.Timestamp) -> None:
    atomic_write(state_dir / "last_bar.txt", str(bar.date()))


@dataclass
class PaperAccount:
    path: Path
    cash: float = 10_000.0
    units: dict = field(default_factory=dict)
    cost: CostModel = field(default_factory=CostModel)

    @classmethod
    def load(cls, path: Path, initial_cash: float = 10_000.0) -> "PaperAccount":
        if path.exists():
            s = json.loads(path.read_text())
            return cls(path, s["cash"], s["units"])
        return cls(path, initial_cash, {})

    def save(self):
        atomic_write(self.path, json.dumps({"cash": self.cash, "units": self.units}, indent=2))

    def nav(self, prices: pd.Series) -> float:
        return self.cash + sum(u * float(prices.get(s, np.nan)) for s, u in self.units.items()
                               if np.isfinite(prices.get(s, np.nan)))

    def weights(self, prices: pd.Series) -> pd.Series:
        nav = self.nav(prices)
        return pd.Series({s: u * prices[s] / nav for s, u in self.units.items()
                          if s in prices and np.isfinite(prices[s])}, dtype=float)

    def liquidate_missing(self, prices: pd.Series, last_known: pd.Series,
                          haircut: float = 0.10) -> list[dict]:
        """Coins that disappeared from the venue (delisted) are booked out at
        their last known price minus ``haircut`` - the simulator's rule."""
        fills = []
        for s in [s for s in self.units if s not in prices.index or not np.isfinite(prices[s])]:
            lp = float(last_known.get(s, 0.0) or 0.0)
            if not np.isfinite(lp) or lp <= 0:
                continue                      # unknown price: keep carrying it
            proceeds = self.units.pop(s) * lp * (1 - haircut)
            self.cash += proceeds
            fills.append({"symbol": s, "side": "DELIST", "notional": round(-proceeds, 2),
                          "price": lp, "cost": round(proceeds * haircut / (1 - haircut), 4)})
        return fills

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
    """Real orders via ccxt. Requires API keys and explicit opt-in.

    * sells before buys; a full exit sells the entire free balance
    * buys are sized in quote currency and capped at the free USDT actually
      available after the sells (no rejected orders from price moves)
    * every order is attempted independently and logged, success or failure
    """

    def __init__(self, exchange, quote: str = QUOTE):
        if os.environ.get("CRYPTOBOT_LIVE") != "I_UNDERSTAND_THE_RISK":
            raise RuntimeError("Set CRYPTOBOT_LIVE=I_UNDERSTAND_THE_RISK to trade real money.")
        self.ex = exchange
        self.quote = quote

    def balances(self) -> dict:
        return self.ex.fetch_balance()

    def positions(self, prices: pd.Series) -> tuple[float, pd.Series]:
        bal = self.balances()["total"]
        vals = {f"{a}{self.quote}": float(q) * float(prices[f"{a}{self.quote}"])
                for a, q in bal.items()
                if a != self.quote and q and f"{a}{self.quote}" in prices.index
                and np.isfinite(prices[f"{a}{self.quote}"])}
        nav = float(bal.get(self.quote, 0) or 0) + sum(vals.values())
        return nav, (pd.Series(vals, dtype=float) / nav if nav > 0 else pd.Series(dtype=float))

    def _min_cost(self, sym: str) -> float:
        m = self.ex.market(sym)
        return float(((m.get("limits") or {}).get("cost") or {}).get("min") or 5.0)

    def execute(self, deltas: pd.Series, target: pd.Series, prices: pd.Series, nav: float
                ) -> list[dict]:
        fills = []
        free = self.balances()["free"]
        for name in deltas[deltas < 0].sort_values().index:            # sells
            base = name[:-len(self.quote)]
            sym = f"{base}/{self.quote}"
            try:
                if float(target.get(name, 0.0)) <= 0:
                    amount = float(free.get(base, 0) or 0)            # full exit
                else:
                    amount = min(abs(float(deltas[name])) * nav / float(prices[name]),
                                 float(free.get(base, 0) or 0))
                amount = float(self.ex.amount_to_precision(sym, amount))
                if amount * float(prices[name]) < self._min_cost(sym):
                    fills.append({"symbol": name, "side": "sell", "status": "skipped_min_notional"})
                    continue
                o = self.ex.create_order(sym, "market", "sell", amount)
                fills.append({"symbol": name, "side": "sell", "amount": amount,
                              "id": o.get("id"), "status": "ok"})
            except Exception as e:  # noqa: BLE001 - log and continue with the rest
                fills.append({"symbol": name, "side": "sell", "status": f"error: {e}"[:300]})
        quote_free = float(self.balances()["free"].get(self.quote, 0) or 0) * 0.995
        for name in deltas[deltas > 0].sort_values(ascending=False).index:  # buys
            sym = f"{name[:-len(self.quote)]}/{self.quote}"
            try:
                cost = min(float(deltas[name]) * nav, quote_free)
                if cost < self._min_cost(sym):
                    fills.append({"symbol": name, "side": "buy", "status": "skipped_min_notional"})
                    continue
                if self.ex.has.get("createMarketBuyOrderWithCost"):
                    o = self.ex.create_market_buy_order_with_cost(sym, cost)
                else:
                    px = float(self.ex.fetch_ticker(sym).get("ask") or prices[name])
                    amt = float(self.ex.amount_to_precision(sym, cost / px * 0.998))
                    o = self.ex.create_order(sym, "market", "buy", amt)
                quote_free -= cost
                fills.append({"symbol": name, "side": "buy", "cost": round(cost, 2),
                              "id": o.get("id"), "status": "ok"})
            except Exception as e:  # noqa: BLE001
                fills.append({"symbol": name, "side": "buy", "status": f"error: {e}"[:300]})
        return fills


def append_csv(path: Path, rows: list[dict]):
    """Append rows, keeping columns aligned with the existing header; new
    columns extend the header (the file is rewritten once when that happens)."""
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    keys: list[str] = []
    for r in rows:
        keys += [k for k in r if k not in keys]
    if path.exists():
        with path.open(newline="") as fh:
            header = next(csv.reader(fh), [])
        extra = [k for k in keys if k not in header]
        if extra:
            old = pd.read_csv(path, dtype=str)
            pd.concat([old, pd.DataFrame(rows, dtype=str)], ignore_index=True)[
                header + extra].to_csv(path, index=False)
            return
        keys = header
    new = not path.exists()
    with path.open("a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keys, extrasaction="ignore")
        if new:
            w.writeheader()
        w.writerows(rows)


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
