# Audit of the cryptobot research and code

Date: 2026-10-14. Scope: everything delivered in the first pass (v3): data,
simulator, strategy, validation methodology, live/paper engine, documentation.
Every number below is reproducible from the scripts named next to it; raw
outputs are in `reports/`.

## Verdict in one paragraph

The first pass had a real edge but a fragile evidence base and a live engine
that was not safe for real money. The audit found 8 methodology problems and 13
code defects, fixed all of them, and replaced the single tuned configuration
(v3) with a parameter-free ensemble (v4). v4 was then frozen and tested once on
**data nobody had looked at**: Bitfinex 2014-2018, a different exchange,
including delisted coins. It passed all six pre-registered criteria: Sharpe
1.72 vs 0.82 for BTC, max drawdown −21% vs −83%, robust to doubled costs. It is
cheaper to run (cost drag 0.67% vs 2.75% a year), insensitive to execution
timing, and its live engine reproduces the backtest exactly. One honest
negative: on the 2025-26 Binance holdout (already contaminated, so not
decision-relevant) v4 earned only +6.8% in 21 months against v3's +25%. Both
beat BTC (−11%) and the alt basket (−53%) there.

---

## 1. Methodology findings

### M1. The holdout was spent, and there was no untouched data left
v3 was evaluated on 2025-01 → 2026-10. Anything designed after seeing that is
contaminated if judged on the same window.
**Fix:** built an independent, survivorship-free dataset from Bitfinex
(`cryptobot/data_bitfinex.py`). It probed 1,236 candidate tickers and found 118
USD pairs with history before 2019, including delisted ones (Darkcoin 2014-15,
YOYOW, Aventus, Datum, ...). Bitfinex is a different venue, USD-quoted, and
2014-2017 is a period the strategy never traded during development. v4 was
frozen and the test criteria were pre-registered (commit `a36c0ce`,
[`PROTOCOL_v2.md`](PROTOCOL_v2.md)) **before** any result on this data existed.

### M2. Several v1 benchmarks had almost no statistical power
On a 1.78-year holdout the standard error of the Sharpe ratio is 0.83 (95% CI
for v3: −0.95 to 2.29). Telling a Sharpe of 1 apart from 0 at 95% confidence
needs about 4 years. v3's holdout Sharpe (0.67) sat at the **20th percentile**
of same-length windows drawn from its own walk-forward record. That is fully
consistent with no decay; B9's "fail" carried almost no information.
(`scripts/audit_diagnostics.py` → `reports/audit_diagnostics.json`)
**Fix:** protocol v2 uses criteria that hold up statistically:
* Probabilistic Sharpe Ratio (is the edge statistically positive?).
* A consistency test against the bootstrap distribution of the development
  record.
* A much longer and different test period: 5 years on another venue.

### M3. The Deflated Sharpe Ratio was mis-specified
I applied the DSR to the stitched walk-forward series but counted the 324
in-sample grid configurations as trials. For an out-of-sample series, the
selection bias comes from the number of **pipelines whose OOS results were
inspected**: v1, v2 and v3, so 3. Correctly specified, v3's DSR is **0.9993**,
not 0.944. The pre-registered figure stays on record as a miss, and the
correction is reported alongside it, not substituted for it.

### M4. Single-configuration selection was the main overfitting channel
* Walk-forward picked a different configuration almost every year.
* The final pick was one of 108.
* Its weekly rebalance weekday was the luckiest of the 7 possible: Sharpe 1.52
  vs 1.24 for the worst weekday.

**Fix (v4):** average all 27 signal configurations, each on all 7 weekday
calendars. Nothing is selected, so there is nothing to overfit.

### M5. Benchmarks were too easy
Comparing a 26%-vol strategy with 66%-vol BTC flatters it. A much tougher
benchmark is **the same trend engine run on BTC alone**: Sharpe 1.27 over
2019 → 2026, close to v3's 1.52. Most of the edge comes from trend-following
plus volatility targeting; the coin rotation adds diversification on top of
that. Every results table now includes "BTC trend, same engine" and a
vol-matched BTC position.

### M6. Execution timing was assumed, not measured
Fills were assumed at the 00:00 UTC daily close.
**Fix:** downloaded hourly candles for all 338 coins that ever entered the
universe and re-simulated with fills 1, 4 and 12 hours after the close
(`research_v4.py exec`).

### M7. Idle cash earned nothing
About 75% of capital is in USDT on average. The model now optionally credits
idle cash with the US 3-month T-bill rate **minus 0.5 percentage points**
(FRED DTB3, `data.load_tbill`), a conservative proxy for stablecoin savings
rates. All headline numbers still exclude it; it is reported separately.

### M8. No liquidity limit on position size
The cost model caps slippage at 0.75%, which cannot represent a position that
is a large multiple of a coin's daily volume. On Binance the universe is liquid
enough that this never mattered below $1M. On the thinner Bitfinex history it
inflated about 18% of P&L (see 4.1).
**Fix:** positions are capped at 10% of the coin's 30-day median daily volume,
in both the simulator (optional) and the live/paper engine (always on).

---

## 2. Code defects found and fixed

| # | Defect | Impact | Fix | Test |
| --- | --- | --- | --- | --- |
| C1 | Simulator treated **any** missing price as a delisting: forced sale with a 10% haircut. Signals went NaN for up to 80 days after a one-day gap | Latent: 543 gap days across 12 coins, 397 coin-days of blanked signals; by luck no false liquidation in v3's history | Positions carried through gaps, no trading on gap days, full move booked on resumption; signals use gap-bridged prices | `test_temporary_gap_is_not_a_delisting` |
| C2 | **Tokenised equities** (NVDA, MSTR, QQQ, … as `<TICKER>BUSDT`, listed June 2026) would become eligible in December 2026; a naive name filter would also drop BNB, ARB and SHIB | The live bot would have started buying stock tokens | Point-in-time rule: name pattern AND listed after 2026-06-01 AND weekend/weekday volatility < 0.5 | `test_tokenised_equities_excluded_but_coins_kept` |
| C3 | Live broker: one rejected order raised an exception, aborting the rest of the rebalance and losing the log of fills already made | Half-executed rebalances | Every order attempted independently, all outcomes logged | `test_live_broker_one_failure_does_not_abort_others` |
| C4 | Live buys sized at yesterday's close could exceed free USDT and be rejected | Missed entries | Buys sized in USDT, capped at the free balance after sells | `test_live_broker_sells_first_full_exit_and_caps_buys` |
| C5 | Full exits sold a computed amount: dust left behind, or an oversell rejected | Positions not closed | Exits sell the entire free balance | same |
| C6 | No stale-data guard | Could trade on days-old candles | Refuses unless the latest bar is yesterday (UTC) | `test_stale_data_guard` |
| C7 | No idempotency or lock in live mode | A double cron run trades twice | Exclusive lock + per-bar idempotency in every mode | `test_run_lock_is_exclusive` |
| C8 | State files written non-atomically | A crash mid-write corrupts the account state | Write-then-rename | – |
| C9 | Paper (exchange mode) could not value or sell delisted holdings | NAV overstated | `liquidate_missing` mirrors the simulator rule | `test_paper_liquidates_delisted_at_haircut` |
| C10 | Data top-up treated any symbol more than 45 days stale as delisted | A stale CI cache would delist every coin | `refresh_symbol` backfills monthly, then daily files | – |
| C11 | Ledger CSV appends could misalign columns | Corrupt forward-test record | Header-aware append | `test_append_csv_keeps_columns_aligned` |
| C12 | *(found in a second pass over the audit's own fixes)* The tokenised-equity rule read the listing date from the first price in the panel. The live bot downloads only ~800 days, so from about 2028 every old coin would have looked newly listed | Stock tokens could re-enter, or coins be wrongly excluded, in long-running live use | True listing dates carried as panel metadata: from the archive, or from the exchange's first-ever candle (works on Binance). Elsewhere the weekend-volatility test is the fallback | `test_equity_rule_uses_true_listing_date_in_short_live_windows` |
| C13 | *(second pass)* The data refresh skipped the month containing the cache's last date when that date wasn't a month-end | A silent gap of up to ~4 weeks after an outage | Refresh starts from the month of the first missing day | – |

Tests went from 7 to 23, and a CI workflow (`cryptobot-tests.yml`) runs them on
every push. Frozen configs are hash-checked on load
(`test_frozen_configs_load_and_hash_checked`).

### Cost structure (not a bug, but the biggest drag)
v3 paid **2.8% a year** in costs at 15.6× annual turnover. 40% of that turnover
was resizing positions rather than entering or exiting. v4's averaging
smooths target weights, cutting turnover to **3.9×** and cost drag to
**0.67% a year**.

---

## 3. Strategy v4: what changed, and why

All changes were decided from the audit findings and Binance data up to
2024-12-31 only:

| Change | Motivation |
| --- | --- |
| Equal-weight ensemble of 27 configs (universe 15/30/50 × top-k 4/8/15 × lookbacks 10-80 / 20-160 / 40-320 days) | M4: remove selection |
| 7 staggered weekly rebalance calendars | M4: remove rebalance-timing luck |
| Gap-tolerant signals, tokenised-equity exclusion | C1, C2 |
| Minimum trade 0.2% of NAV, also enforced by paper/live | exchange minimums; keeps paper = live = backtest |
| Unchanged: BTC regime filter, 35% vol target, 5% band, 200-day history requirement, 30% single-coin cap | no evidence to change them |

v4 has no fitted parameters. The design-level choices are: which grid to
average, using the existing v3 grid unchanged; how many tranches (7, one per
weekday); and the risk target (unchanged).

---

## 4. Results

### 4.1 Untouched data: Bitfinex 2014-2018 (pre-registered, run once)
Fees 0.20% (Bitfinex's taker rate at the time) plus liquidity-scaled slippage
on a $100k account; delisted coins included.

| 2014-2018 | v4 | v3 | BTC buy & hold | EW top-10 | BTC trend (same engine) |
| --- | --- | --- | --- | --- | --- |
| Sharpe | **1.72** | 1.71 | 0.82 | 0.68 | 1.39 |
| CAGR | 42.1% | 43.4% | 39.3% | 23.7% | 49.4% |
| Max drawdown | **−21.4%** | −18.2% | −82.9% | −90.8% | −25.6% |
| Calmar | 1.97 | 2.39 | 0.47 | 0.26 | 1.93 |
| Sharpe at 2× costs | 1.61 | – | – | – | – |

v4 year by year, with BTC in brackets: 2014 −12% (−56%), 2015 +30% (+33%),
2016 +19% (+125%), 2017 +407% (+1,325%), 2018 −16% (−72%).

**Pre-registered criteria F1-F6: all pass.** PSR = 0.9999. Sharpe ≥ BTC.
Drawdown ≤ ½ BTC's. Calmar > BTC's. 2× costs keep 94% of the Sharpe. The
Sharpe sits at the 66th percentile of the development record's distribution,
so no structural break. Per the pre-registered decision rule, **v4 becomes the
recommended strategy.** v3 also passes all six.

**Liquidity sensitivity (added after the test; it can only make results worse
or more realistic, never selects anything).** Bitfinex had few coins before
2018, so a "top-15 by volume" universe sometimes included very thin markets.
At the extreme, the backtest held BCC at about 35× its daily volume, which is
not tradable. Overall, 18% of the test's P&L came from coins trading under
$1M a day. Re-running the frozen v4 with a position limit relative to each
coin's 30-day median daily volume (`reports/v4_liquidity_sensitivity.json`):

| Bitfinex 2014-18 | Sharpe | CAGR | MaxDD |
| --- | --- | --- | --- |
| As pre-registered | 1.72 | 42.1% | −21.4% |
| ≤ 10% of daily volume, $100k account | 1.80 | 40.0% | −20.1% |
| ≤ 2% of daily volume, $100k account | 1.72 | 34.8% | −21.0% |
| ≤ 10% of daily volume, $1M account | 1.67 | 33.2% | −23.2% |
| Coins under $1M/day excluded entirely | 1.71 | 36.2% | −22.2% |

Every variant still passes F1-F6. v3 is also robust to it: Sharpe 1.71 →
1.93 with the 10% limit, so its thin-market positions were net losers. On
Binance 2019-24 the 10% limit does not
bind for accounts up to $1M (Sharpe 1.47 → 1.46) and costs 0.07 Sharpe at
$10M. The live engine now enforces the 10% limit as a safety constraint
(finding M8).

Caveat on 2014-2016: only BTC, LTC, Darkcoin and ETH had enough history then,
so that segment mainly tests the trend and regime engine (Sharpe 0.70 vs 0.47
for BTC). 2017-2018 tests the rotation: Sharpe 2.75, drawdown −21%, vs BTC's
1.21 and −83%.

### 4.2 Development: Binance 2019-2024 (in-sample at the design level)
| 2019-2024 | v4 | v3 walk-forward OOS | BTC buy & hold | BTC trend (same engine) |
| --- | --- | --- | --- | --- |
| Sharpe | 1.47 | 1.40 | 1.15 | 1.50 |
| CAGR | 35.5% (37.1% with cash yield) | 40.4% | 71.2% | 55.6% |
| Max drawdown | −31.7% | −32.6% | −76.6% | −27.3% |
| Turnover / cost drag | 3.9× / 0.67% | 15.6× / 2.75% | – | – |
| Sharpe at 2× costs / fills a day late | 1.44 / 1.41 | 1.31 / 1.14 | – | – |

* **Ensemble vs its own members:** 1.47 against a median member of 1.34
  (range 1.01-1.74).
* **Random half-universes:** Sharpe 1.19 / 1.43 / 1.58 at the 5th / 50th /
  95th percentile.
* **DSR** (4 pipelines inspected): 0.9994.
* **Bootstrap:** P(Sharpe > 0) = 99.85%.

### 4.3 Holdout 2025-01-01 → 2026-10-13 (contaminated, so not decision-relevant)
| | v4 | v3 | BTC buy & hold | EW top-10 | BTC trend |
| --- | --- | --- | --- | --- | --- |
| Total return | +6.8% (+11.4% with cash yield) | +25.3% | −11.1% | −53.2% | −1.4% |
| Sharpe | 0.29 | 0.67 | 0.06 | −0.36 | 0.05 |
| Max drawdown | −24.4% | −20.1% | −53.0% | −68.8% | −19.9% |

v4 underperformed v3 here: v3's fast-lookback config suited the choppy
2025-26 market better than the ensemble's mix of speeds. This is reported, not
acted on: tuning v4 towards fast lookbacks now would be fitting to a window
already seen twice.

### 4.4 Execution timing (hourly data, dev period)
v4 Sharpe by fill time after the daily close:

| 0h | 1h | 4h | 12h |
| --- | --- | --- | --- |
| 1.47 | 1.43 | 1.41 | 1.46 |

Pre-registered check (Sharpe at 4h ≥ 0.8× Sharpe at 0h): **pass**. The edge
does not depend on racing other bots at 00:00 UTC.

### 4.5 Live-engine parity
* **Signals:** the live code path on rolling 800-day windows (exactly what the
  bot downloads) reproduced the backtest targets on **651 of 651** holdout
  days. Max difference 7.3e-15; the threshold was 1e-9.
* **Execution:** the paper account, driven by the live order rules, ended the
  holdout at NAV 1.05014 vs the simulator's 1.05015. Tracking error 0.012% a
  year.

### 4.6 All records combined, 2014-01-01 → 2026-10-13 (12.8 years, two venues)
| | v4 | v3 | BTC buy & hold |
| --- | --- | --- | --- |
| CAGR | 33.0% | 37.4% | 45.2% |
| Sharpe | 1.42 | 1.41 | 0.89 |
| Max drawdown | −31.7% | −32.6% | −82.9% |
| Positive calendar years | 9/13 | 9/13 | 8/13 |

---

## 5. What was *not* changed, and why

* **No short side.**
  * Australian retail access to crypto derivatives is restricted.
  * Shorting crypto carries squeeze and funding risks the spot strategy avoids.
  * There is no untouched data left to validate a new sleeve.
* **No automated savings (Simple Earn) integration.** Cash yield is modelled,
  but moving funds in and out of exchange savings products automatically could
  not be tested against the real API from here. It is documented as a manual,
  optional step.
* **No further tuning after the fresh test.** The Bitfinex data is now also
  spent. The forward test is the only clean evidence left, so changes from here
  should be rare and pre-registered.

## 6. Remaining risks

* **Regime risk:** both v3 and v4 earn most of their return in strong trending
  bull phases (2017, 2020-21, 2024). In choppy years (2019, 2025) they roughly
  break even. Expect long flat periods.
* **Venue and custody risk:** exchange failure, USDT de-peg, account freezes.
  None of these is modelled.
* **Capacity:** under the cost model, v4's dev Sharpe is 1.47 at $100k, 1.46
  at $1M, 1.43 at $10M and 1.40 at $50M (`reports/v4_dev.json` →
  `capacity_aum`). The model's slippage assumptions are themselves
  unverified above about $1M.
* **Tax:** Australian CGT applies to every disposal. Most holdings are held
  for under 12 months, so the 50% discount rarely applies. Returns here are
  pre-tax.
