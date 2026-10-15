import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from cryptobot import monitor

ROOT = Path(__file__).resolve().parent.parent


def write_ledger(path: Path, nav, flow, tag):
    path.mkdir(parents=True, exist_ok=True)
    bars = pd.date_range("2026-01-01", periods=len(nav), freq="D").strftime("%Y-%m-%d")
    pd.DataFrame({"run_at": "x", "bar": bars, "strategy": tag, "nav": nav, "flow": flow,
                  "exposure": 0.3}).to_csv(path / "equity.csv", index=False)


def test_kill_level_is_1_4x_worst_drawdown_rounded_to_5pc():
    assert monitor.kill_level(-0.317) == -0.45          # balanced, as documented
    assert monitor.kill_level(-0.417) == -0.60
    assert monitor.kill_level(-0.16) == -0.20


def test_profile_from_strategy_tag():
    assert monitor.profile_of("okx-v4-growth") == "growth"
    assert monitor.profile_of("binance-v4") == "balanced"
    assert monitor.profile_of("") == "balanced"


def test_deposits_are_not_gains_in_the_drawdown():
    nav = pd.Series([100.0, 90.0, 190.0, 171.0])
    flow = pd.Series([0.0, 0.0, 100.0, 0.0])           # +100 deposit on day 3
    now, worst = monitor.drawdown(nav, flow)
    assert np.isclose(now, -0.19) and np.isclose(worst, -0.19)


def test_ping_is_a_no_op_without_url_and_never_raises(monkeypatch):
    calls = []
    import requests
    monkeypatch.setattr(requests, "post", lambda url, **kw: calls.append(url))
    monkeypatch.delenv("HEALTHCHECK_URL", raising=False)
    assert monitor.ping("hello") is False and calls == []
    monkeypatch.setenv("HEALTHCHECK_URL", "https://hc-ping.com/abc/")
    assert monitor.ping("ok") and monitor.ping("bad", fail=True)
    assert calls == ["https://hc-ping.com/abc", "https://hc-ping.com/abc/fail"]

    def boom(url, **kw):
        raise OSError("network down")
    monkeypatch.setattr(requests, "post", boom)
    assert monitor.ping("x") is False


def test_report_flags_the_kill_switch_for_the_ledgers_profile(tmp_path, monkeypatch):
    prof = tmp_path / "profiles.json"
    prof.write_text(json.dumps({"profiles": {"balanced": {"kill_drawdown": -0.45},
                                             "growth": {"kill_drawdown": -0.60}}}))
    monkeypatch.setattr(monitor, "PROFILES_JSON", prof)
    nav, flow = [100.0, 60.0, 50.0], [0.0, 0.0, 0.0]         # -50% drawdown
    write_ledger(tmp_path / "a", nav, flow, "okx-v4")
    write_ledger(tmp_path / "b", nav, flow, "okx-v4-growth")
    msg, breach = monitor.report(tmp_path / "a")
    assert breach and msg.startswith("KILL SWITCH")
    msg, breach = monitor.report(tmp_path / "b")
    assert not breach and "kill switch -60%" in msg


def test_forward_report_reads_strategy_from_a_live_ledger(tmp_path, capsys):
    sys.path.insert(0, str(ROOT / "scripts"))
    import forward_report
    led = tmp_path / "live" / "okx-1a2b3c4d5e6f"                 # live ledgers are named by account
    write_ledger(led, [10_000.0, 10_100.0, 10_050.0], [0.0, 0.0, 0.0], "okx-v4")
    forward_report.main(led)
    out = json.loads(capsys.readouterr().out)
    assert out["strategy"] == "v4" and out["risk_profile"] == "balanced"
    assert out["kill_switch_drawdown"] == -0.45 and out["action"] == "continue"
