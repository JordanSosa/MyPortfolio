#!/usr/bin/env python3
"""Audit diagnostics for the frozen v3 strategy (see AUDIT.md).

Quantifies: data-gap false liquidations, tokenised equities in the universe,
cost drag and turnover decomposition, suspicious price prints, statistical
power of the holdout, correctly-specified Deflated Sharpe, and vol-matched /
simple-trend benchmarks.
"""
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cryptobot import metrics as M  # noqa: E402
from cryptobot.backtest import CostModel, simulate  # noqa: E402
from cryptobot.data import load_panel  # noqa: E402
from cryptobot.research import run_config, trim_panel  # noqa: E402
from cryptobot.strategy import Params, compute_features, target_weights  # noqa: E402

STOCKLIKE = re.compile(r"^[A-Z]{2,5}BUSDT$")


def frozen_params() -> Params:
    cfg = dict(json.loads((ROOT / "frozen_config.json").read_text())["params"])
    cfg["lookbacks"] = tuple(cfg["lookbacks"])
    return Params(**cfg)


def main():
    out = {}
    p = frozen_params()
    raw = load_panel("1d")
    panel = trim_panel(raw)
    close = panel["close"]
    f = compute_features(panel, p)
    w = target_weights(panel, p, f)
    res = simulate(w, close, f["adv"], CostModel(aum_usd=100_000), band=p.band)
    held = res.weights.shift(1).fillna(0) > 0

    # 1. data gaps: held asset has NaN price but trades again later
    last_valid = close.apply(lambda s: s.last_valid_index())
    gap = close.isna() & (close.index.values[:, None] <= last_valid.values[None, :])
    first_valid = close.apply(lambda s: s.first_valid_index())
    gap &= close.index.values[:, None] >= first_valid.values[None, :]
    false_liq = (gap & held)
    out["data_gaps"] = {
        "gap_cells_in_panel": int(gap.values.sum()),
        "symbols_with_gaps": int(gap.any().sum()),
        "false_liquidations_v3": int(false_liq.values.sum()),
        "false_liquidation_events": [
            {"date": str(d.date()), "symbol": s, "weight": round(float(res.weights.shift(1).loc[d, s]), 4)}
            for d, s in zip(*np.where(false_liq.values))
            for d, s in [(close.index[d], close.columns[s])]][:20],
        "gap_days_trend_nan_exits": int((gap & held).values.sum()),
    }
    # a gap also makes the trend NaN for up to max(lookback) days after it
    tr_nan_after_gap = f["trend"].isna() & close.notna() & (f["hist"] >= p.min_history)
    out["data_gaps"]["trend_nan_while_trading_cells"] = int(tr_nan_after_gap.values.sum())

    # 2. tokenised equities ("xStocks"-style *BUSDT) in the raw universe
    stocklike = [c for c in raw["close"].columns if STOCKLIKE.match(c) and c not in
                 {"AAVEBUSDT"}]
    in_trim = [c for c in stocklike if c in close.columns]
    out["tokenised_equities"] = {
        "candidates_in_raw_universe": len(stocklike), "examples": stocklike[:12],
        "in_trimmed_panel": in_trim,
        "ever_held_weight": {c: round(float(res.weights[c].max()), 4) for c in in_trim
                             if res.weights[c].max() > 0}}

    # 3. cost drag and turnover decomposition
    yr = res.costs.groupby(res.costs.index.year).sum()
    wprev = res.weights.shift(1).fillna(0)
    dw = (res.weights - wprev)
    # approximate split: entries (prev 0), exits (new 0), resizes (both > 0)
    entries = dw.where((wprev == 0) & (res.weights > 0)).abs().sum().sum()
    exits = dw.where((wprev > 0) & (res.weights == 0)).abs().sum().sum()
    resizes = dw.where((wprev > 0) & (res.weights > 0) & (dw.abs() > 1e-9)).abs().sum().sum()
    drift = (res.weights - wprev).abs().sum().sum()
    tot = entries + exits + resizes
    out["costs"] = {
        "cost_drag_by_year_pct": {int(k): round(float(v) * 100, 2) for k, v in yr.items()},
        "avg_cost_drag_pct_per_year": round(float(res.costs.loc["2019":].sum() /
                                                  (len(res.costs.loc["2019":]) / 365)) * 100, 2),
        "turnover_share": {"entries": round(entries / tot, 3), "exits": round(exits / tot, 3),
                           "resizes": round(resizes / tot, 3)},
        "gross_vs_net_sharpe_2019+": [round(M.sharpe(res.gross_returns.loc["2019":]), 3),
                                      round(M.sharpe(res.returns.loc["2019":]), 3)],
        "gross_vs_net_cagr_2019+": [round(M.cagr(res.gross_returns.loc["2019":]), 4),
                                    round(M.cagr(res.returns.loc["2019":]), 4)],
        "round_trips_per_year": round(float(((wprev == 0) & (res.weights > 0)).values.sum()
                                            / (len(close.loc["2019":]) / 365)), 1),
    }
    del drift

    # 4. suspicious prints among assets the strategy actually held
    r = close.pct_change(fill_method=None)
    sus = r.where(held & ((r > 1.0) | (r < -0.6))).stack().dropna()
    out["extreme_returns_while_held"] = [{"date": str(d.date()), "symbol": s, "ret": round(float(v), 3)}
                                         for (d, s), v in sus.items()][:20]

    # 5. statistical power of the holdout
    ho = res.returns.loc["2025-01-01":]
    wf = pd.read_csv(ROOT / "reports" / "walk_forward_returns.csv", index_col=0,
                     parse_dates=True)["strategy_oos"].dropna()
    n_years = len(ho) / 365
    sr_ho = M.sharpe(ho)
    se = math.sqrt((1 + 0.5 * sr_ho ** 2) / n_years)
    # distribution of Sharpe over windows of the same length drawn from the WF OOS record
    x = wf.values
    L = len(ho)
    rng = np.random.default_rng(0)
    sims = []
    for _ in range(4000):
        idx = []
        while len(idx) < L:
            s0 = rng.integers(0, len(x) - 30)
            idx.extend(range(s0, s0 + 30))
        y = x[idx[:L]]
        sims.append(y.mean() / y.std() * math.sqrt(365))
    out["holdout_power"] = {
        "holdout_years": round(n_years, 2), "holdout_sharpe": round(sr_ho, 3),
        "sharpe_standard_error": round(se, 3),
        "95pct_CI": [round(sr_ho - 1.96 * se, 2), round(sr_ho + 1.96 * se, 2)],
        "holdout_sharpe_percentile_within_wf_windows": round(float((np.array(sims) < sr_ho).mean() * 100), 1),
        "wf_window_sharpe_p05_p50_p95": [round(float(np.percentile(sims, q)), 2) for q in (5, 50, 95)],
        "min_years_to_detect_sharpe_1_vs_0_at_95pct": round((1.645 / 1.0) ** 2 * (1 + 0.5), 1),
    }

    # 6. Deflated Sharpe specified for an out-of-sample series: trials = OOS pipelines inspected
    v = {k: json.loads((ROOT / "reports" / f).read_text())["oos"]["Sharpe"]
         for k, f in [("v1", "walk_forward_v1.json"), ("v2", "walk_forward_v2.json"),
                      ("v3", "walk_forward.json")]}
    per = np.array(list(v.values())) / math.sqrt(365)
    out["dsr"] = {
        "oos_sharpes_of_pipelines_inspected": v,
        "dsr_trials_3_pipelines": round(M.deflated_sharpe(wf, 3, float(per.std(ddof=1))), 4),
        "dsr_as_preregistered_324": json.loads((ROOT / "reports" / "walk_forward.json").read_text())["deflated_sharpe"],
        "psr_vs_zero": round(M.probabilistic_sharpe(wf, 0.0), 4),
    }

    # 7. fairer benchmarks over 2019-01-01 -> latest
    s0 = pd.Timestamp("2019-01-01", tz="UTC")
    strat = res.returns.loc[s0:]
    btc = close["BTCUSDT"].pct_change().loc[s0:].fillna(0)
    adv = f["adv"]
    cm = CostModel()
    # (a) BTC scaled to the strategy's realised vol, rebalanced monthly
    k = float(strat.std() / btc.std())
    tw = pd.DataFrame(np.nan, close.index, ["BTCUSDT"])
    ms = close.index.to_series().dt.month.diff().fillna(1).ne(0)
    tw.loc[ms.values, "BTCUSDT"] = k
    vm = simulate(tw, close[["BTCUSDT"]], adv[["BTCUSDT"]], cm, start=s0).returns
    # (b) classic BTC 200-day SMA filter (long above, cash below), daily check
    sma = close["BTCUSDT"].rolling(200).mean()
    tw2 = (close["BTCUSDT"] > sma).astype(float).to_frame("BTCUSDT")
    sma200 = simulate(tw2, close[["BTCUSDT"]], adv[["BTCUSDT"]], cm, start=s0).returns
    # (c) same-engine single-asset trend on BTC with the frozen lookbacks
    from cryptobot.strategy import single_asset_weights
    tw3 = single_asset_weights(close["BTCUSDT"].dropna(), p).to_frame("BTCUSDT")
    btc_tr = simulate(tw3, close[["BTCUSDT"]], adv[["BTCUSDT"]], cm, start=s0).returns
    def s(rr):
        d = M.summary(rr)
        return {k2: round(d[k2], 4) for k2 in ["CAGR", "vol", "Sharpe", "MaxDD", "Calmar"]}
    out["benchmarks_2019_to_now"] = {
        "strategy_v3_frozen": s(strat), "btc_buy_hold": s(btc),
        f"btc_vol_matched_{k:.2f}x_monthly": s(vm), "btc_sma200_filter": s(sma200),
        "btc_single_asset_trend_same_engine": s(btc_tr),
        "strategy_beta_to_btc": round(float(np.cov(strat, btc)[0, 1] / btc.var()), 3),
        "strategy_corr_to_btc": round(float(np.corrcoef(strat, btc)[0, 1]), 3),
    }
    (ROOT / "reports" / "audit_diagnostics.json").write_text(json.dumps(out, indent=2, default=str))
    print(json.dumps(out, indent=1, default=str))


if __name__ == "__main__":
    main()
