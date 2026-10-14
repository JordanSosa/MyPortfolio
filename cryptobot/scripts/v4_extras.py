#!/usr/bin/env python3
"""Capacity and liquidity sensitivity for v4 (reports/v4_capacity_liquidity.json).

* capacity: development-period results for account sizes $10k - $50M (costs scale
  with square-root market impact)
* liquidity: positions capped at a share of each coin's 30-day median daily
  volume (simulator ``max_participation``), on Binance 2019-24 and on the
  thinner Bitfinex 2014-18 history, plus "coins under $1M/day excluded"

Descriptive only: it can make results more realistic, it never selects anything.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from cryptobot.backtest import CostModel, simulate  # noqa: E402
from cryptobot.data import load_panel  # noqa: E402
from cryptobot.data_bitfinex import load_panel_bitfinex  # noqa: E402
from cryptobot.research import trim_panel  # noqa: E402
from cryptobot.strategy import ensemble_weights, target_weights  # noqa: E402
from research_v4 import S, adv_of, v3_params, v4_params, window  # noqa: E402


def run(panel, w, cost, band, min_trade, part=None):
    return simulate(w, panel["close"], adv_of(panel), cost, band=band, min_trade=min_trade,
                    max_participation=part)


def main():
    ep, p3 = v4_params(), v3_params()
    out = {"capacity_binance_2019_2024": {}, "liquidity_binance_2019_2024": {},
           "liquidity_bitfinex_2014_2018": {}}
    pb = trim_panel(load_panel("1d", end="2024-12-31"))
    w = ensemble_weights(pb, ep)
    for aum in [1e4, 1e5, 1e6, 1e7, 5e7]:
        r = run(pb, w, CostModel(aum_usd=aum), ep.band, ep.min_trade)
        out["capacity_binance_2019_2024"][int(aum)] = S(window(r.returns, "2019-01-01", "2024-12-31"), r)
        r = run(pb, w, CostModel(aum_usd=aum), ep.band, ep.min_trade, part=0.10)
        out["liquidity_binance_2019_2024"][f"aum{int(aum)}_cap10pctADV"] = S(
            window(r.returns, "2019-01-01", "2024-12-31"), r)
    pf = load_panel_bitfinex(end="2018-12-31")
    wf = ensemble_weights(pf, ep)
    w3 = target_weights(pf, p3)
    W = lambda r: window(r.returns, "2014-01-01", "2018-12-31")
    L = out["liquidity_bitfinex_2014_2018"]
    L["v4_as_preregistered"] = S(W(run(pf, wf, CostModel(fee_bps=20, aum_usd=1e5), ep.band, ep.min_trade)))
    for aum, part in [(1e4, 0.10), (1e5, 0.10), (1e5, 0.02), (1e6, 0.10), (1e6, 0.02)]:
        L[f"v4_aum{int(aum)}_cap{int(part * 100)}pctADV"] = S(W(run(
            pf, wf, CostModel(fee_bps=20, aum_usd=aum), ep.band, ep.min_trade, part)))
    adv = adv_of(pf)
    wx = wf.where(adv.reindex_like(wf) >= 1e6, 0.0)
    L["v4_exclude_adv_below_1M"] = S(W(run(pf, wx, CostModel(fee_bps=20, aum_usd=1e5), ep.band, ep.min_trade)))
    L["v3_as_tested"] = S(W(run(pf, w3, CostModel(fee_bps=20, aum_usd=1e5), p3.band, 0.0)))
    L["v3_aum100000_cap10pctADV"] = S(W(run(pf, w3, CostModel(fee_bps=20, aum_usd=1e5), p3.band, 0.0, 0.10)))
    (ROOT / "reports" / "v4_capacity_liquidity.json").write_text(json.dumps(out, indent=2, default=str))
    for sec, d in out.items():
        print("==", sec)
        for k, v in d.items():
            print(f"   {str(k):32s} Sharpe {v['Sharpe']:.3f} CAGR {v['CAGR']:.4f} MaxDD {v['MaxDD']:.4f}"
                  + (f" cost {v['cost_drag_ann']:.4f}" if "cost_drag_ann" in v else ""))


if __name__ == "__main__":
    main()
