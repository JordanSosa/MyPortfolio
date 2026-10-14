# Validation protocol v2 (pre-registered 2026-10-14, before any v4 fresh-data result)

Supersedes [`PROTOCOL.md`](PROTOCOL.md) for strategy **v4**. v1 is kept unchanged as
the record of how v3 was validated.

## Why a second protocol

The audit ([`AUDIT.md`](AUDIT.md)) found that:

1. The 2025-01-01 → 2026-10-13 holdout has been looked at (v3 was evaluated on it).
   Anything designed afterwards and judged on that window is contaminated.
2. Several v1 benchmarks had almost no statistical power on a 21-month window
   (Sharpe standard error ≈ 0.83), so a pass or fail there carried little information.
3. The Deflated Sharpe Ratio was mis-specified: applied to a walk-forward
   (out-of-sample) series it should count the *pipelines whose OOS results were
   inspected*, not the in-sample grid size.

v4 was therefore designed using **only** Binance data up to 2024-12-31 plus the
audit's diagnostics, and is judged here on data nobody has looked at.

## Strategy under test

`frozen_config_v4.json` (hash-checked by every script): the equal-weight
ensemble of 27 signal configurations (universe 15/30/50 × top-k 4/8/15 ×
lookback sets 10-80 / 20-160 / 40-320 days), each on 7 staggered weekly
rebalance calendars; BTC regime filter on; 35% vol target; 5% no-trade band;
0.2% minimum trade. Code: `cryptobot/strategy.py::ensemble_weights`.

Changes from v3, and why each was decided *before* testing:

| Change | Reason (from the audit, not from v4 results) |
| --- | --- |
| Average all configs instead of selecting one | Selection is the main overfitting channel; the 108-config grid was a broad plateau |
| 7 rebalance tranches | v3's weekday phase was the luckiest of 7 (Sharpe 1.52 vs 1.24 worst) |
| Data-gap handling | Gaps were treated as delistings (latent; no realised impact on v3) |
| Tokenised-equity exclusion | Stock tokens listed on Binance in June 2026 will become eligible in December 2026 |
| Minimum trade 0.2% of NAV | Mirrors exchange minimum order sizes; keeps paper and live identical |

## Evidence tiers

| Tier | Data | Status |
| --- | --- | --- |
| Development | Binance 2019-01-01 → 2024-12-31 | in-sample at the design level (`reports/v4_dev.json`) |
| **Fresh (primary test)** | **Bitfinex USD pairs incl. delisted, 2014-01-01 → 2018-12-31** | **untouched; run once** |
| Contaminated holdout | Binance 2025-01-01 → latest | reported, never used for decisions |
| Forward | live paper ledgers from 2026-10-14 | the final arbiter |

### Fresh test definition

* Data: every Bitfinex `t<CODE>USD` pair with candles before 2019-01-31 found by
  probing 1,236 candidate codes (`cryptobot/data_bitfinex.py`). Delisted pairs
  included. Days without a candle (Bitfinex omits zero-volume days) are carried
  at the last price with zero volume.
* Excluded before any result is computed: pegged assets, meaning those whose
  close is within ±5% of 1.00 USD on ≥ 80% of their days (stablecoins), and gold
  tokens (`XAUT`, `PAXG`). Chain-split tokens (e.g. `BCC`, `BCU`, `BT1`/`BT2`)
  stay in, because they were tradable instruments.
* Costs: 20 bps taker fee (Bitfinex 2014-2018) + the same liquidity-scaled
  slippage model, $100k account.
* Window: 2014-01-01 → 2018-12-31, also reported as 2014-2016 and 2017-2018.
  The 2014-2016 universe is tiny (BTC, LTC, a few alts), so that segment mostly
  tests the trend/regime engine; 2017-2018 tests the rotation.

### Pass criteria for v4 on the fresh data (full window)

| # | Criterion |
| --- | --- |
| F1 | Probabilistic Sharpe Ratio vs 0 ≥ 0.95 (the edge is statistically positive) |
| F2 | Sharpe ≥ BTC buy-and-hold Sharpe |
| F3 | Max drawdown ≤ ½ of BTC buy-and-hold's |
| F4 | Calmar > BTC buy-and-hold's |
| F5 | Sharpe at 2× costs ≥ 0.75 × base Sharpe |
| F6 | Sharpe ≥ 5th percentile of same-length windows block-bootstrapped from the v4 development record (consistency: no structural break) |

**Decision rule (fixed now):** v4 becomes the recommended strategy if it passes
F1 and F6 and at least 5 of the 6. If it fails F1 or F6, no version is
recommended for real capital until the forward test has six months of data
inside its expected band. v3 is run through the same test for comparison only.

### Other checks (pass/fail fixed now)

* Live-engine parity, v4: replaying the holdout day by day through the live code
  path (800-day rolling window, as live) reproduces backtest targets, max abs
  weight difference < 1e-9.
* Execution delay (hourly data, dev period): Sharpe with fills 4 hours after
  the close ≥ 0.8 × Sharpe at the close.
* Deflated Sharpe on the development record, counting the 4 pipelines whose OOS
  results were inspected (v1-v4): ≥ 0.95.
