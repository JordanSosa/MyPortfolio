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
state atomically, and logs every order attempt. Live runs report to
HEALTHCHECK_URL if set (cryptobot/monitor.py): success, failure, kill switch.

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
from cryptobot import monitor  # noqa: E402
from cryptobot.execution import liquidity_cap  # noqa: E402
from cryptobot.live import (LiveBroker, PaperAccount, account_id, already_done,  # noqa: E402
                            append_csv, atomic_write, build_live_panel, check_complete,
                            combined_orders,
                            check_fresh, claim_account, history_days, latest_targets, live_flow,
                            load_strategy, mark_done, min_trade_of, now_utc, plan_orders,
                            run_lock)
from cryptobot.monitor import RISK_PROFILES  # noqa: E402
from cryptobot.strategy import EnsembleParams, single_asset_weights  # noqa: E402

DEFAULT_STRATEGY = ROOT / "frozen_config_v4.json"


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
    return trim_panel(data.slice_panel(panel, start=start))


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
    ap.add_argument("--take-over", action="store_true",
                    help="live: let this strategy setting take over an account run by another")
    ap.add_argument("--hostname", help="override the exchange API domain (e.g. OKX regional "
                                       "domains such as us.okx.com / app.okx.com)")
    ap.add_argument("--deposit", type=float, default=0.0,
                    help="paper: add this much cash before today's run (live detects deposits itself)")
    ap.add_argument("--withdraw", type=float, default=0.0,
                    help="paper: remove this much cash before today's run")
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
    if a.live:
        # one state directory (lock, last bar, owner) per real exchange ACCOUNT,
        # whatever strategy setting is pointed at it
        out = ROOT / "reports" / "live" / f"{a.exchange}-{account_id(os.environ['API_KEY'])}"
    else:
        out = ROOT / "reports" / "paper" / tag

    with run_lock(out / ".lock"):
        ex = None
        held: list[str] = []
        acct = None
        if not a.live:
            acct = PaperAccount.load(out / "state.json", a.capital)
            held = list(acct.units)
        if a.exchange == "binance-archive":
            if a.live:
                raise SystemExit("--live needs a real exchange, not the archive")
            panel = archive_panel(p)
        else:
            import ccxt
            kw = {"enableRateLimit": True}
            if a.live:
                kw.update(apiKey=os.environ["API_KEY"], secret=os.environ["API_SECRET"])
                if os.environ.get("API_PASSWORD"):          # OKX (and others) use a passphrase
                    kw["password"] = os.environ["API_PASSWORD"]
            ex = getattr(ccxt, a.exchange)(kw)
            if a.hostname:                                  # e.g. OKX regional API domains
                ex.hostname = a.hostname
            ca = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE")
            if ca:  # corporate / sandbox TLS proxies
                ex.validateServerSsl = ca
            if a.live:
                ex.load_markets()
                held = [f"{c}USDT" for c, q in ex.fetch_balance()["total"].items()
                        if q and c != "USDT" and f"{c}/USDT" in ex.markets]
            n = 0 if a.asset else 150
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
        # never trade on a partial panel (a failed BTC fetch would silently
        # switch off the regime filter; a missing held coin mis-values the account)
        check_complete(panel["close"], held, grace=acct.missing if acct else None)
        if already_done(out, t):
            print("already processed this bar; nothing to do")
            if a.live:
                monitor.ping(f"{tag}: bar {t.date()} already processed")
            return

        tradable = prices.dropna().index
        last_known = panel["close"].ffill().iloc[-1]
        if a.live:
            claim_account(out, tag, a.take_over)
            broker = LiveBroker(ex)
            nav, cur = broker.positions(prices, min_trade_of(p))
            if broker.dust:
                print(f"dust (treated as zero): {broker.dust}")
            if broker.unpriced_inactive:
                print(f"WARNING held coins without an active market (not traded): "
                      f"{broker.unpriced_inactive}")
            # money in or out since the last run (deposits are detected, not declared)
            prev = json.loads((out / "state.json").read_text()) if (out / "state.json").exists() else None
            flow, pre_w = live_flow(prev, nav, cur, last_known.combine_first(prices))
            if flow:
                print(f"external {'deposit' if flow > 0 else 'withdrawal'} detected: {flow:,.2f}")
            target = liquidity_cap(target, adv, nav)
            deltas = combined_orders(target, cur, flow, pre_w, nav, p.band, min_trade_of(p), tradable)
            fills = broker.execute(deltas, target, prices, nav)
        else:
            fills = acct.update_gaps(prices, last_known, t)
            flow = a.deposit - a.withdraw
            pre_w = acct.weights(prices)
            if flow:
                acct.add_cash(flow, prices)
            nav = acct.nav(prices)
            target = liquidity_cap(target, adv, nav)
            deltas = combined_orders(target, acct.weights(prices), flow, pre_w, nav, p.band,
                                     min_trade_of(p), tradable)
            fills += acct.execute(deltas, prices.dropna(), adv)
            acct.save()
        # record what happened BEFORE marking the bar done, so a crash below can
        # never hide executed orders behind "already processed"
        stamp = {"run_at": now_utc(), "bar": str(t.date()), "strategy": tag}
        append_csv(out / "trades.csv", [{**stamp, **f} for f in fills])
        append_csv(out / "targets.csv", [{**stamp, "symbol": s, "weight": round(float(w), 5)}
                                         for s, w in target.items()])
        mark_done(out, t)
        try:
            if a.live:
                nav = broker.positions(prices, min_trade_of(p))[0]
                # baseline for tomorrow's deposit/withdrawal detection
                atomic_write(out / "state.json", json.dumps(
                    {"bar": str(t.date()), "cash": broker.cash, "units": broker.units}, indent=2))
            else:
                nav = acct.nav(prices)
        except Exception as e:  # noqa: BLE001 - NAV is informational after trading
            print(f"post-trade NAV unavailable ({e}); logging pre-trade NAV")
        append_csv(out / "equity.csv", [{**stamp, "nav": round(nav, 2), "flow": round(flow, 2),
                                         "exposure": round(float(target.sum()), 4)}])
        try:
            status, breach = monitor.report(out)
        except Exception as e:  # noqa: BLE001 - reporting must never fail a run that traded
            status, breach = f"{tag}: status unavailable ({e})", False
    print(f"NAV {nav:,.2f}  orders {len(fills)}\n{status}")
    if a.live:
        monitor.ping(f"{status} | exposure {target.sum():.0%}, orders {len(fills)}", fail=breach)


if __name__ == "__main__":
    try:
        main()
    except BaseException as e:
        quiet = isinstance(e, KeyboardInterrupt) or (isinstance(e, SystemExit) and e.code in (0, None))
        if "--live" in sys.argv and not quiet:
            monitor.ping(f"cryptobot live run FAILED: {type(e).__name__}: {e}", fail=True)
        raise
