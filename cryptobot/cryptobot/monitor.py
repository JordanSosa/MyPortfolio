"""Live-account monitoring: a dead-man's switch and kill-switch alerts.

Set ``HEALTHCHECK_URL`` to a check on healthchecks.io (free), or any service
with the same ping API, and every live run reports in:

* success: a POST to the URL with a one-line summary;
* failure (an exception, stale or incomplete data, an exchange error): a POST
  to ``<URL>/fail`` with the error;
* kill switch: when the account's drawdown, with deposits and withdrawals
  taken out, passes the level for its risk profile, the summary goes to
  ``/fail`` as well.

If the server dies, no ping arrives at all and the service raises the alarm.
That is the one failure the bot cannot report itself. Without
``HEALTHCHECK_URL`` nothing is sent.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import pandas as pd

# The one user-facing dial: portfolio volatility target. Everything else stays frozen.
RISK_PROFILES = {"conservative": 0.20, "balanced": 0.35, "growth": 0.50, "aggressive": 0.75}
DEFAULT_KILL = -0.45                  # balanced v4 and v3: ~1.4x their worst drawdowns
PROFILES_JSON = Path(__file__).resolve().parent.parent / "reports" / "v4_profiles.json"


def kill_level(worst_drawdown: float) -> float:
    """Kill-switch drawdown: 1.4x the worst drawdown in any record, rounded to
    the nearest 5% (balanced: -31.7% -> -45%)."""
    return round(round(1.4 * worst_drawdown / 0.05) * 0.05, 2)


def profile_of(tag: str) -> str:
    """Risk profile from a ledger's strategy tag ('okx-v4-growth' -> 'growth')."""
    last = str(tag).rsplit("-", 1)[-1]
    return last if last in RISK_PROFILES else "balanced"


def kill_drawdown(tag: str = "") -> float:
    """Kill-switch level for the strategy a ledger runs (reports/v4_profiles.json)."""
    if "-v3" in str(tag):
        return DEFAULT_KILL
    try:
        prof = json.loads(PROFILES_JSON.read_text())["profiles"][profile_of(tag)]
        return float(prof["kill_drawdown"])
    except (OSError, KeyError, ValueError):
        return DEFAULT_KILL


def flow_adjusted_returns(nav: pd.Series, flow: pd.Series) -> pd.Series:
    """Daily time-weighted returns: deposits and withdrawals are not profits or
    losses, so each day's flow is removed before comparing NAVs."""
    return ((nav - flow) / nav.shift(1) - 1).dropna()


def read_ledger(path: Path) -> tuple[pd.Series, pd.Series, str]:
    """NAV, flows and strategy tag of a paper or live ledger (``equity.csv``)."""
    eq = pd.read_csv(Path(path) / "equity.csv", parse_dates=["bar"])
    eq = eq.drop_duplicates("bar", keep="last").set_index("bar")
    flow = eq["flow"].fillna(0.0) if "flow" in eq.columns else pd.Series(0.0, eq.index)
    tags = eq["strategy"].dropna() if "strategy" in eq.columns else pd.Series(dtype=str)
    return eq["nav"].astype(float), flow.astype(float), (str(tags.iloc[-1]) if len(tags) else "")


def drawdown(nav: pd.Series, flow: pd.Series) -> tuple[float, float]:
    """(current, worst) drawdown of the flow-adjusted NAV."""
    growth = pd.concat([pd.Series([1.0]), (1 + flow_adjusted_returns(nav, flow)).cumprod()],
                       ignore_index=True)
    dd = growth / growth.cummax() - 1
    return float(dd.iloc[-1]), float(dd.min())


def ping(message: str, fail: bool = False, url: str | None = None) -> bool:
    """Report to the health-check service; never raises (monitoring must not
    break trading)."""
    url = os.environ.get("HEALTHCHECK_URL", "") if url is None else url
    if not url:
        return False
    try:
        import requests
        requests.post(url.rstrip("/") + ("/fail" if fail else ""), data=message.encode()[:10_000],
                      timeout=10)
        return True
    except Exception as e:  # noqa: BLE001
        print(f"monitor: ping failed ({e})")
        return False


def report(out_dir: Path) -> tuple[str, bool]:
    """One-line status of a ledger and whether it breaches its kill switch."""
    nav, flow, tag = read_ledger(out_dir)
    now, worst = drawdown(nav, flow)
    kill = kill_drawdown(tag)
    breach = worst <= kill
    msg = (f"{tag or out_dir.name} bar {nav.index[-1].date()}: NAV {nav.iloc[-1]:,.2f}, drawdown "
           f"{now:.1%} (worst {worst:.1%}, kill switch {kill:.0%})")
    if breach:
        msg = "KILL SWITCH: " + msg + " - stop trading and re-validate (README)"
    return msg, breach
