#!/usr/bin/env python3
"""Daily forward-test (paper) or live run. Run once per day after 00:00 UTC.

    python scripts/paper_trade.py                                   # paper, default strategy, Binance archive
    python scripts/paper_trade.py --exchange okx                    # paper on a live ccxt venue
    python scripts/paper_trade.py --strategy frozen_config.json     # v3 instead of the default
    python scripts/paper_trade.py --exchange binance --dry          # print today's targets only
    CRYPTOBOT_LIVE=I_UNDERSTAND_THE_RISK API_KEY=.. API_SECRET=.. \\
        python scripts/paper_trade.py --exchange binance --live     # real orders

Safety: refuses stale data (latest bar must be yesterday UTC), holds an
exclusive lock, never processes the same bar twice for one account, writes
state atomically, and logs every order attempt.

Each (venue, strategy) pair keeps its own ledger under
reports/paper/<venue>-<version>/ (or reports/live/...), so forward records of
different strategy versions never mix.
"""
import argparse
import json
import os
import sys
from dataclasses import replace
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cryptobot.live import (LiveBroker, PaperAccount, already_done, append_csv,  # noqa: E402
                            build_live_panel, check_fresh, history_days, latest_targets,
                            load_strategy, mark_done, min_trade_of, now_utc, plan_orders,
                            run_lock)
from cryptobot.strategy import EnsembleParams, single_asset_weights  # noqa: E402

DEFAULT_STRATEGY = ROOT / "frozen_config_v4.json"
# The one user-facing dial: portfolio volatility target. Everything else stays frozen.
RISK_PROFILES = {"conservative": 0.20, "balanced": 0.35, "growth": 0.50, "aggressive": 0.75}


def version_of(p) -> str:
    return "v4" if isinstance(p, EnsembleParams) else "v3"


def archive_panel(p) -> dict:
    """Binance public daily archive - the backtest's own data source."""
    from cryptobot import data
    from cryptobot.research import trim_panel
    data.download_universe("1d")          # picks up newly listed coins
    data.refresh_universe("1d")           # appends candles published since the last run
    panel = data.load_panel("1d")
    start = panel["close"].index[-1] - pd.Timedelta(days=history_days(p))
    return trim_panel({k: v.loc[start:] for k, v in panel.items()})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exchange", default="binance-archive")
    ap.add_argument("--strategy", default=str(DEFAULT_STRATEGY),
                    help="frozen config: frozen_config_v4.json (v4) or frozen_config.json (v3)")
    ap.add_argument("--capital", type=float, default=10_000.0)
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--dry", action="store_true", help="compute targets only, no state change")
    ap.add_argument("--asset", help="single-asset mode, e.g. SOLUSDT (needs configs/<asset>.json)")
    ap.add_argument("--risk", choices=list(RISK_PROFILES), default="balanced",
                    help="volatility target: conservative 20%%, balanced 35%% (frozen default), "
                         "growth 50%%, aggressive 75%%")
    ap.add_argument("--allow-stale", action="store_true", help="testing only")
    a = ap.parse_args()

    cfg = ROOT / "configs" / f"{a.asset.upper()}.json" if a.asset else Path(a.strategy)
    if not cfg.is_absolute():
        cfg = ROOT / cfg
    p = load_strategy(cfg)
    if not a.asset and a.risk != "balanced":
        p = replace(p, target_vol=RISK_PROFILES[a.risk])
    tag = f"{a.exchange}-{a.asset.upper()}" if a.asset else f"{a.exchange}-{version_of(p)}"
    if not a.asset and a.risk != "balanced":
        tag += f"-{a.risk}"
    out = ROOT / "reports" / ("live" if a.live else "paper") / tag

    with run_lock(out / ".lock"):
        ex = None
        held: list[str] = []
        if a.exchange == "binance-archive":
            if a.live:
                raise SystemExit("--live needs a real exchange, not the archive")
            panel = archive_panel(p)
        else:
            import ccxt
            kw = {"enableRateLimit": True}
            if a.live:
                kw.update(apiKey=os.environ["API_KEY"], secret=os.environ["API_SECRET"])
            ex = getattr(ccxt, a.exchange)(kw)
            ca = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE")
            if ca:  # corporate / sandbox TLS proxies
                ex.validateServerSsl = ca
            if a.live:
                held = [f"{c}USDT" for c, q in ex.fetch_balance()["total"].items() if q and c != "USDT"]
            elif (out / "state.json").exists():
                held = list(json.loads((out / "state.json").read_text())["units"])
            n = 0 if a.asset else 80
            extra = held + ([a.asset.upper()] if a.asset else [])
            panel = build_live_panel(ex, n_symbols=n, days=history_days(p), extra=extra)

        if a.asset:
            sym = a.asset.upper()
            w = single_asset_weights(panel["close"][sym], p)
            t, target, prices = w.index[-1], pd.Series({sym: float(w.iloc[-1])}), panel["close"].iloc[-1]
        else:
            t, target, prices = latest_targets(panel, p)
        adv = panel["quote_volume"].rolling(p.adv_window, min_periods=10).median().iloc[-1]
        target = target[target > 0]
        print(f"{now_utc()} strategy={version_of(p)} bar={t.date()} exposure={target.sum():.3f}\n"
              f"{target.sort_values(ascending=False).round(4).to_string() or '(all cash)'}")
        if a.dry:
            return
        if not a.allow_stale:
            check_fresh(t)
        if already_done(out, t):
            print("already processed this bar; nothing to do")
            return

        tradable = prices.dropna().index
        last_known = panel["close"].ffill().iloc[-1]
        if a.live:
            broker = LiveBroker(ex)
            nav, cur = broker.positions(prices)
            deltas = plan_orders(target, cur, p.band, min_trade_of(p), tradable)
            fills = broker.execute(deltas, target, prices, nav)
            nav, _ = broker.positions(prices)
        else:
            acct = PaperAccount.load(out / "state.json", a.capital)
            fills = acct.liquidate_missing(prices, last_known)
            px = prices.dropna()
            deltas = plan_orders(target, acct.weights(px), p.band, min_trade_of(p), tradable)
            fills += acct.execute(deltas, px, adv)
            acct.save()
            nav = acct.nav(px)
        mark_done(out, t)

    stamp = {"run_at": now_utc(), "bar": str(t.date())}
    append_csv(out / "equity.csv", [{**stamp, "nav": round(nav, 2),
                                     "exposure": round(float(target.sum()), 4)}])
    append_csv(out / "trades.csv", [{**stamp, **f} for f in fills])
    append_csv(out / "targets.csv", [{**stamp, "symbol": s, "weight": round(float(w), 5)}
                                     for s, w in target.items()])
    print(f"NAV {nav:,.2f}  orders {len(fills)}")


if __name__ == "__main__":
    main()
