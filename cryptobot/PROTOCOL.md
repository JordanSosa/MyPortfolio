# Validation protocol and pass/fail benchmarks

Written and committed **before any strategy results were looked at**
(2026-10-14). Its purpose is to stop the most common failure in trading
research: tuning until the backtest looks good, then losing money live.

## Data

* Source: Binance spot bulk archive (`data.binance.vision`), daily bars, every
  USDT pair ever listed **including delisted coins** (LUNA, FTT, ...).
  Stablecoins, fiat pairs and leveraged tokens are excluded.
* Universe is selected **point-in-time** by trailing 30-day median USD volume.

## Time splits

| Segment | Dates | Use |
| --- | --- | --- |
| Warm-up | 2017-08 → 2018-12 | indicator warm-up only |
| Walk-forward | 2019-01-01 → 2024-12-31 | each calendar year is tested with parameters chosen only on data *before* that year (expanding window) |
| **Locked holdout** | 2025-01-01 → latest available | run **once**, with the configuration frozen in `frozen_config.json` (hash recorded) after walk-forward |
| Forward (live paper) | after the commit date | `scripts/paper_trade.py` logs real-time decisions; unaffected by any research choice |

## Costs (baseline)

Taker fee 10 bps + liquidity-dependent slippage (≥3 bps, square-root impact on
a $100k account), every trade, both sides. Delisted holdings are liquidated at
the last price minus 10%. Cash earns 0%.

## Benchmarks (what "good" means here)

Comparators: **BTC buy-and-hold** and an **equal-weight top-10 liquid basket**
(monthly rebalance, same costs).

The strategy *passes* only if **all** of the following hold on out-of-sample
data (walk-forward OOS concatenated, and separately the holdout):

| # | Criterion | Threshold |
| --- | --- | --- |
| B1 | Net Sharpe (daily, annualised, 365) | ≥ 1.0 and > BTC buy-and-hold |
| B2 | Max drawdown | ≤ 50% of BTC buy-and-hold's drawdown over the same period, and ≤ 40% absolute |
| B3 | Calmar (CAGR / MaxDD) | ≥ 1.0 and > BTC buy-and-hold |
| B4 | Deflated Sharpe Ratio (all configs tried counted as trials) | ≥ 0.95 |
| B5 | Probability of Backtest Overfitting (CSCV, 16 splits) | ≤ 0.25 |
| B6 | Cost stress: Sharpe at 2× costs | ≥ 0.75 |
| B7 | Execution-delay stress: fills one full day late | Sharpe ≥ 0.75 |
| B8 | Parameter robustness: share of grid neighbours with Sharpe ≥ 0.7× the chosen one | ≥ 80% |
| B9 | Holdout Sharpe | ≥ 0.5× walk-forward Sharpe and > 0 |
| B10 | Live/backtest parity: replaying the holdout through the live engine reproduces backtest weights | max abs weight diff < 1e-9 |

"One of the most powerful trading bots of all time" is not a measurable
claim; these criteria are. They correspond roughly to a top-decile systematic
fund (Sharpe ≥ 1 net, drawdowns well below the underlying market) and are
deliberately hard to hit by curve-fitting.
