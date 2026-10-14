"""Live / paper trading engine.

The engine calls *exactly* the same weight functions as the backtest
(``ensemble_weights`` for v4, ``target_weights`` for v3) on a panel built from
recent daily candles, and takes the last row. Live-specific logic is limited to
order generation (the simulator's band / minimum-trade / no-trade-in-gap
rules, see ``plan_orders``), order execution and bookkeeping.

Safety rules (each added after a defect was found - see AUDIT.md):
* refuse to trade unless the data is fresh AND complete: BTC (regime filter),
  every held coin and >= 95% of the universe priced on the expected bar
* every holding is valued (last price -> exchange ticker -> abort); positions
  below the exchange minimum / ``min_trade`` are dust and count as zero
* a coin missing for a few days is a data gap (carried), not a delisting

Run once per day shortly after 00:00 UTC (the daily candle close), e.g. cron:
    5 0 * * *  cd /path/to/cryptobot && python scripts/paper_trade.py
"""
from __future__ import annotations

import contextlib
import csv
import fcntl
import hashlib
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
DELIST_AFTER_DAYS = 7          # a coin missing this many consecutive days is treated as delisted
MIN_COVERAGE = 0.95            # share of yesterday's priced coins that must be priced today


# ---------------------------------------------------------------- configuration
def load_strategy(path: Path) -> EnsembleParams | Params:
    """Read a frozen config (v4 ensemble or v3 single config), verifying its hash."""
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


def account_id(api_key: str) -> str:
    """Stable, non-reversible identifier of an exchange account (for locks/state)."""
    return hashlib.sha256(api_key.encode()).hexdigest()[:12]


# ---------------------------------------------------------------- market data
def build_live_panel(exchange, n_symbols: int = 150, days: int = 800,
                     quote: str = QUOTE, extra: list[str] | None = None) -> dict:
    """Daily OHLCV panel for the ``n_symbols`` most liquid ``*/quote`` spot
    markets on ``exchange`` (a ccxt instance) plus any ``extra`` symbols (held
    coins). Excludes stablecoins, leveraged tokens and the forming candle.

    On Binance the klines endpoint is used directly so the panel carries the
    exact quote-asset volume the backtest archive uses; on other venues quote
    volume is approximated by volume x close."""
    from .data import STABLES, is_leveraged, split_discontinuities
    exchange.load_markets()
    tickers = exchange.fetch_tickers()
    bases = {m["base"] for m in exchange.markets.values() if m.get("quote") == quote}
    cands = []
    for sym, t in tickers.items():
        m = exchange.markets.get(sym)
        if not m or not m.get("spot") or m.get("quote") != quote or not m.get("active", True):
            continue
        if m["base"] in STABLES or is_leveraged(m["base"], bases):
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
    use_klines = getattr(exchange, "id", "") == "binance" and hasattr(exchange, "publicGetKlines")
    for sym in cands:
        try:
            df = (_fetch_binance_klines(exchange, sym, since) if use_klines
                  else _fetch_generic(exchange, sym, since))
        except Exception as e:  # noqa: BLE001 - recorded; completeness is checked later
            print(f"skip {sym}: {e}")
            continue
        if df is None or not len(df):
            continue
        df = df[df.index < today]                     # drop the forming candle
        name = sym.replace("/", "")
        for k in fields:
            fields[k][name] = df[k]
        time.sleep(exchange.rateLimit / 1000)
    panel = {k: pd.DataFrame(v).sort_index() for k, v in fields.items()}
    panel["listed"] = _listing_dates(exchange, list(panel["close"].columns), quote)
    return split_discontinuities(panel)


def _fetch_generic(exchange, sym: str, since: int) -> pd.DataFrame | None:
    rows = _fetch_daily(exchange, sym, since)
    if not rows:
        return None
    df = pd.DataFrame(rows, columns=["t", "open", "high", "low", "close", "volume"])
    df.index = pd.to_datetime(df["t"], unit="ms", utc=True)
    df["quote_volume"] = df["volume"] * df["close"]
    return df


def _fetch_binance_klines(exchange, sym: str, since: int) -> pd.DataFrame | None:
    """Binance /api/v3/klines: identical fields to the public archive,
    including quote-asset volume (index 7)."""
    rows = []
    start = since
    while True:
        batch = exchange.publicGetKlines({"symbol": sym.replace("/", ""), "interval": "1d",
                                          "startTime": start, "limit": 1000})
        if not batch:
            break
        rows += batch
        if len(batch) < 1000:
            break
        start = int(batch[-1][0]) + 86_400_000
    if not rows:
        return None
    df = pd.DataFrame([r[:8] for r in rows],
                      columns=["t", "open", "high", "low", "close", "volume", "ct", "quote_volume"])
    df.index = pd.to_datetime(pd.to_numeric(df["t"]), unit="ms", utc=True)
    for c in ["open", "high", "low", "close", "volume", "quote_volume"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df[~df.index.duplicated(keep="last")]


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
        except Exception as e:  # noqa: BLE001 - fall back to the weekend-volatility test
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


def check_complete(close: pd.DataFrame, held: list[str], min_coverage: float = MIN_COVERAGE,
                   grace: dict | None = None) -> None:
    """Refuse to trade on an incomplete panel. A failed fetch must never be
    mistaken for a market state: without BTC the regime filter silently
    switches off; without a held coin the account is mis-valued; a thin panel
    changes every ranking.

    ``grace``: held coins already known to be missing (possible delisting being
    counted down by the paper account) - allowed through."""
    if len(close) < 2:
        raise RuntimeError("incomplete data: fewer than two bars")
    last, prev = close.iloc[-1], close.iloc[-2]
    problems = []
    if "BTCUSDT" not in close.columns or not np.isfinite(last.get("BTCUSDT", np.nan)):
        problems.append("BTCUSDT has no price on the latest bar (regime filter input)")
    grace = grace or {}
    missing_held = [s for s in held if s not in grace and
                    (s not in close.columns or not np.isfinite(last.get(s, np.nan)))]
    if missing_held:
        problems.append(f"held coins without a price on the latest bar: {missing_held}")
    was = prev.notna()
    if was.sum() > 0:
        cov = float((last.notna() & was).sum() / was.sum())
        if cov < min_coverage:
            problems.append(f"only {cov:.0%} of yesterday's coins are priced on the latest bar "
                            f"(need {min_coverage:.0%})")
    if problems:
        raise RuntimeError("incomplete data, not trading: " + "; ".join(problems))


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


def claim_account(state_dir: Path, tag: str, take_over: bool = False) -> None:
    """One strategy setting per real account: running two settings against the
    same account would churn it between two target sets every day."""
    f = state_dir / "owner.txt"
    if f.exists() and f.read_text().strip() != tag and not take_over:
        raise RuntimeError(f"this account is run by '{f.read_text().strip()}', not '{tag}'. "
                           "Use --take-over to switch deliberately.")
    atomic_write(f, tag)


@dataclass
class PaperAccount:
    path: Path
    cash: float = 10_000.0
    units: dict = field(default_factory=dict)
    cost: CostModel = field(default_factory=CostModel)
    missing: dict = field(default_factory=dict)      # symbol -> first bar it was unpriced
    last_px: dict = field(default_factory=dict)      # symbol -> last known price

    @classmethod
    def load(cls, path: Path, initial_cash: float = 10_000.0) -> "PaperAccount":
        if path.exists():
            s = json.loads(path.read_text())
            return cls(path, s["cash"], s["units"], missing=s.get("missing", {}),
                       last_px=s.get("last_px", {}))
        return cls(path, initial_cash, {})

    def save(self):
        atomic_write(self.path, json.dumps({"cash": self.cash, "units": self.units,
                                            "missing": self.missing, "last_px": self.last_px},
                                           indent=2))

    def valuation_prices(self, prices: pd.Series) -> pd.Series:
        """Today's price where available, else the last known price (a coin in a
        data gap keeps its value - the simulator's rule)."""
        px = prices.dropna().astype(float)
        extra = {s: self.last_px[s] for s in self.units if s not in px.index and s in self.last_px}
        return pd.concat([px, pd.Series(extra, dtype=float)]) if extra else px

    def nav(self, prices: pd.Series) -> float:
        px = self.valuation_prices(prices)
        return self.cash + sum(u * float(px[s]) for s, u in self.units.items() if s in px.index)

    def weights(self, prices: pd.Series) -> pd.Series:
        px = self.valuation_prices(prices)
        nav = self.nav(prices)
        return pd.Series({s: u * px[s] / nav for s, u in self.units.items() if s in px.index},
                         dtype=float)

    def update_gaps(self, prices: pd.Series, last_known: pd.Series, bar: pd.Timestamp,
                    haircut: float = 0.10) -> list[dict]:
        """Track held coins without a price. A gap is carried at the last known
        price; after DELIST_AFTER_DAYS consecutive missing days the coin is
        treated as delisted and booked out at that price minus ``haircut``."""
        fills = []
        for s in list(self.units):
            p = prices.get(s, np.nan)
            if np.isfinite(p):
                self.missing.pop(s, None)
                self.last_px[s] = float(p)
                continue
            lp = last_known.get(s, np.nan)
            if np.isfinite(lp):
                self.last_px[s] = float(lp)
            first = pd.Timestamp(self.missing.setdefault(s, str(bar.date())), tz="UTC")
            if (bar - first).days + 1 >= DELIST_AFTER_DAYS and s in self.last_px:
                px = self.last_px[s]
                proceeds = self.units.pop(s) * px * (1 - haircut)
                self.cash += proceeds
                self.missing.pop(s, None)
                fills.append({"symbol": s, "side": "DELIST", "notional": round(-proceeds, 2),
                              "price": px, "cost": round(proceeds * haircut / (1 - haircut), 4)})
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
            self.last_px[sym] = px
            if abs(self.units[sym]) * px < 1e-6:
                self.units.pop(sym)
            fills.append({"symbol": sym, "side": "BUY" if dw > 0 else "SELL",
                          "notional": round(notional, 2), "price": px, "cost": round(c, 4)})
        return fills


class LiveBroker:
    """Real orders via ccxt. Requires API keys and explicit opt-in.

    * holdings are valued at the panel price, else the exchange ticker; an
      active market that cannot be priced aborts the run (never guess NAV)
    * holdings worth less than max(exchange minimum order, ``min_trade`` x NAV)
      are dust: they count as zero (so re-entries work) and are not traded
    * sells before buys; a full exit sells the entire free balance
    * buys are sized in quote currency and capped at the free USDT actually
      available after the sells
    * every order is attempted independently and logged; an order whose
      outcome is unknown (timeout) is assumed filled for cash accounting and
      flagged for reconciliation
    """

    def __init__(self, exchange, quote: str = QUOTE):
        if os.environ.get("CRYPTOBOT_LIVE") != "I_UNDERSTAND_THE_RISK":
            raise RuntimeError("Set CRYPTOBOT_LIVE=I_UNDERSTAND_THE_RISK to trade real money.")
        self.ex = exchange
        self.quote = quote
        self.dust: list[str] = []
        self.unpriced_inactive: list[str] = []

    def balances(self) -> dict:
        return self.ex.fetch_balance()

    def _min_cost(self, sym: str) -> float:
        try:
            m = self.ex.market(sym)
        except Exception:  # noqa: BLE001
            return 5.0
        return float(((m.get("limits") or {}).get("cost") or {}).get("min") or 5.0)

    def _price(self, name: str, prices: pd.Series) -> float:
        p = prices.get(name, np.nan)
        if np.isfinite(p):
            return float(p)
        sym = f"{name[:-len(self.quote)]}/{self.quote}"
        m = self.ex.markets.get(sym)
        if m is None or not m.get("active", True):
            return float("nan")                    # no market: cannot trade it anyway
        t = self.ex.fetch_ticker(sym)
        p = t.get("last") or t.get("close")
        if not p:
            raise RuntimeError(f"cannot price held {name}; not trading")
        return float(p)

    def positions(self, prices: pd.Series, min_trade: float = 0.0
                  ) -> tuple[float, pd.Series]:
        """(NAV in quote currency, weights of tradable non-dust holdings)."""
        bal = self.balances()["total"]
        vals = {}
        self.dust, self.unpriced_inactive = [], []
        for a, q in bal.items():
            if a == self.quote or not q:
                continue
            name = f"{a}{self.quote}"
            if f"{a}/{self.quote}" not in self.ex.markets:
                continue                           # e.g. fee tokens without a USDT market
            p = self._price(name, prices)
            if not np.isfinite(p):
                self.unpriced_inactive.append(name)
                continue
            vals[name] = float(q) * p
        nav = float(bal.get(self.quote, 0) or 0) + sum(vals.values())
        if nav <= 0:
            return 0.0, pd.Series(dtype=float)
        w = {}
        for name, v in vals.items():
            sym = f"{name[:-len(self.quote)]}/{self.quote}"
            if v < max(self._min_cost(sym), min_trade * nav):
                self.dust.append(name)
                continue
            w[name] = v / nav
        return nav, pd.Series(w, dtype=float)

    def execute(self, deltas: pd.Series, target: pd.Series, prices: pd.Series, nav: float
                ) -> list[dict]:
        import ccxt  # local import: tests use a fake exchange
        unknown = (ccxt.RequestTimeout, ccxt.NetworkError)
        fills = []
        free = self.balances()["free"]
        for name in deltas[deltas < 0].sort_values().index:            # sells
            base = name[:-len(self.quote)]
            sym = f"{base}/{self.quote}"
            try:
                px = self._price(name, prices)
                if float(target.get(name, 0.0)) <= 0:
                    amount = float(free.get(base, 0) or 0)            # full exit
                else:
                    amount = min(abs(float(deltas[name])) * nav / px, float(free.get(base, 0) or 0))
                amount = float(self.ex.amount_to_precision(sym, amount))
                if amount * px < self._min_cost(sym):
                    fills.append({"symbol": name, "side": "sell", "status": "skipped_min_notional"})
                    continue
                o = self.ex.create_order(sym, "market", "sell", amount)
                fills.append({"symbol": name, "side": "sell", "amount": amount,
                              "id": o.get("id"), "status": "ok"})
            except unknown as e:
                fills.append({"symbol": name, "side": "sell",
                              "status": f"UNKNOWN - check exchange: {e}"[:300]})
            except Exception as e:  # noqa: BLE001 - log and continue with the rest
                fills.append({"symbol": name, "side": "sell", "status": f"error: {e}"[:300]})
        quote_free = float(self.balances()["free"].get(self.quote, 0) or 0) * 0.995
        for name in deltas[deltas > 0].sort_values(ascending=False).index:  # buys
            sym = f"{name[:-len(self.quote)]}/{self.quote}"
            cost = min(float(deltas[name]) * nav, quote_free)
            try:
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
            except unknown as e:
                quote_free -= cost                 # may have filled: never over-spend
                fills.append({"symbol": name, "side": "buy", "cost": round(cost, 2),
                              "status": f"UNKNOWN - check exchange: {e}"[:300]})
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
    header: list[str] = []
    if path.exists() and path.stat().st_size > 0:
        with path.open(newline="") as fh:
            header = next(csv.reader(fh), [])
    if header:
        extra = [k for k in keys if k not in header]
        if extra:
            old = pd.read_csv(path, dtype=str)
            pd.concat([old, pd.DataFrame(rows, dtype=str)], ignore_index=True)[
                header + extra].to_csv(path, index=False)
            return
        keys = header
    with path.open("a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keys, extrasaction="ignore")
        if not header:
            w.writeheader()
        w.writerows(rows)


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
