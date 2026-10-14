#!/usr/bin/env python3
"""Daily forward-test (paper) or live run. Run once per day after 00:00 UTC.

    python scripts/paper_trade.py                       # paper, Binance data
    python scripts/paper_trade.py --exchange kraken     # any ccxt venue with USDT pairs
    CRYPTOBOT_LIVE=I_UNDERSTAND_THE_RISK API_KEY=.. API_SECRET=.. \\
        python scripts/paper_trade.py --live            # real orders

Every run appends to reports/paper/<exchange>/{equity,trades,targets}.csv, so
the forward-test record accumulates and can be compared against the backtest
with scripts/forward_report.py.
"""
import argparse
import json
import os
import sys
from pathlib import Path

import ccxt
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cryptobot.live import (LiveBroker, PaperAccount, append_csv, build_live_panel,  # noqa: E402
                            latest_targets, now_utc, plan_orders)
from cryptobot.strategy import Params, single_asset_weights  # noqa: E402


def load_params(path: Path) -> Params:
    cfg = dict(json.loads(path.read_text())["params"])
    cfg["lookbacks"] = tuple(cfg["lookbacks"])
    return Params(**cfg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exchange", default="binance")
    ap.add_argument("--capital", type=float, default=10_000.0)
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--dry", action="store_true", help="compute targets only, no state change")
    ap.add_argument("--asset", help="single-asset mode, e.g. SOLUSDT (needs configs/<asset>.json "
                                    "from scripts/tune_asset.py)")
    a = ap.parse_args()

    cfg_path = ROOT / "configs" / f"{a.asset.upper()}.json" if a.asset else ROOT / "frozen_config.json"
    p = load_params(cfg_path)
    kw = {"enableRateLimit": True}
    if a.live:
        kw.update(apiKey=os.environ["API_KEY"], secret=os.environ["API_SECRET"])
    ex = getattr(ccxt, a.exchange)(kw)
    ca = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE")
    if ca:  # corporate / sandbox TLS proxies
        ex.validateServerSsl = ca
    out = ROOT / "reports" / "paper" / (a.exchange + (f"-{a.asset.upper()}" if a.asset else ""))
    held = []
    if a.live:
        held = [f"{c}USDT" for c, q in ex.fetch_balance()["total"].items() if q]
    elif (out / "state.json").exists():
        held = list(json.loads((out / "state.json").read_text())["units"])
    if not a.asset:
        panel = build_live_panel(ex, n_symbols=80, days=max(p.lookbacks) + 120, extra=held)
    if a.asset:
        sym = a.asset.upper()
        panel = build_live_panel(ex, n_symbols=0, days=max(p.lookbacks) + 120, extra=[sym])
        w = single_asset_weights(panel["close"][sym], p)
        t, target, prices = w.index[-1], pd.Series({sym: float(w.iloc[-1])}), panel["close"].iloc[-1]
    else:
        t, target, prices = latest_targets(panel, p)
    adv = panel["quote_volume"].rolling(p.adv_window, min_periods=10).median().iloc[-1]
    target = target[target > 0]
    print(f"{now_utc()} bar={t.date()} targets:\n{target.round(4).to_string() or '(all cash)'}")

    if a.dry:
        return
    if a.live:
        broker = LiveBroker(ex)
        nav, cur = broker.positions(prices)
        fills = broker.execute(plan_orders(target, cur, p.band), prices, nav)
    else:
        acct = PaperAccount.load(out / "state.json", a.capital)
        last = out / "last_bar.txt"
        if last.exists() and last.read_text().strip() == str(t.date()):
            print("already processed this bar; nothing to do")
            return
        cur = acct.weights(prices)
        fills = acct.execute(plan_orders(target, cur, p.band), prices, adv)
        acct.save()
        nav = acct.nav(prices)
        last.write_text(str(t.date()))
    stamp = {"run_at": now_utc(), "bar": str(t.date())}
    append_csv(out / "equity.csv", [{**stamp, "nav": round(nav, 2),
                                     "exposure": round(float(target.sum()), 4)}])
    append_csv(out / "trades.csv", [{**stamp, **f} for f in fills])
    append_csv(out / "targets.csv", [{**stamp, "symbol": s, "weight": round(float(w), 5)}
                                     for s, w in target.items()])
    print(f"NAV {nav:,.2f}  trades {len(fills)}")


if __name__ == "__main__":
    main()
