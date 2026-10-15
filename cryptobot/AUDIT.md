# Audit of the cryptobot research and code

Date: 2026-10-14/15. Scope: everything delivered in the first pass (v3): data,
simulator, strategy, validation methodology, live/paper engine, documentation.
It was done in three passes:

1. my own audit (sections 1-2);
2. a second pass over the audit's own fixes (C12-C13);
3. an independent adversarial review by a separate agent with no stake in the
   design (section 2b).

Every number below is reproducible from the scripts named next to it; raw
outputs are in `reports/`.

## Verdict in one paragraph

The first pass had a real edge but a fragile evidence base and a live engine
that was not safe for real money. Across the three passes:

* **Findings:** 8 methodology problems, 13 code defects, 11 review findings
  (3 high-severity, all in the live engine), and data errors (re-used tickers,
  redenominations, a wrongly excluded coin).
* **Fixes:** all of them are fixed, and the single tuned configuration (v3) is
  replaced by a parameter-free ensemble (v4).
* **Fresh test:** v4 was frozen and tested once on **data nobody had looked
  at**: Bitfinex 2014-2018, a different exchange, including delisted coins. It
  passed all six pre-registered criteria: Sharpe 1.72 vs 0.82 for BTC, max
  drawdown −21% vs −83%, robust to doubled costs and to liquidity limits.
* **Running it:** v4 is cheaper (cost drag 0.67% vs 2.75% a year), insensitive
  to execution timing, and its live engine reproduces the backtest exactly.
* **One honest negative:** on the 2025-26 Binance holdout (already
  contaminated, so not decision-relevant) v4 earned only +7.7% in 21 months
  against v3's +25%. Both beat BTC (−11%) and the alt basket (−53%) there.

---

## 1. Methodology findings

### M1. The holdout was spent, and there was no untouched data left
v3 was evaluated on 2025-01 → 2026-10. Anything designed after seeing that is
contaminated if judged on the same window.

**Fix:** built an independent, survivorship-free dataset from Bitfinex
(`cryptobot/data_bitfinex.py`).
* It probed 1,236 candidate tickers and found 118 USD pairs with history
  before 2019, including delisted ones (Darkcoin 2014-15, YOYOW, Aventus,
  Datum, ...).
* Bitfinex is a different venue, USD-quoted, and 2014-2017 is a period the
  strategy never traded during development.
* v4 was frozen and the test criteria were pre-registered (commit `a36c0ce`,
  [`PROTOCOL_v2.md`](PROTOCOL_v2.md)) **before** any result on this data
  existed.

### M2. Several v1 benchmarks had almost no statistical power
On a 1.78-year holdout the standard error of the Sharpe ratio is 0.83 (95% CI
for v3: −0.95 to 2.29). Telling a Sharpe of 1 apart from 0 at 95% confidence
needs about 4 years. v3's holdout Sharpe (0.67) sat at the **20th percentile**
of same-length windows drawn from its own walk-forward record. That is fully
consistent with no decay; B9's "fail" carried almost no information
(`scripts/audit_diagnostics.py`).

**Fix:** protocol v2 uses criteria that hold up statistically:
* a Probabilistic Sharpe Ratio test;
* a bootstrap consistency test against the development record;
* a 5-year test on another venue.

### M3. The Deflated Sharpe Ratio was mis-specified
For an out-of-sample (walk-forward) series, the selection bias comes from the
number of **pipelines whose OOS results were inspected** (v1-v3), not from the
324 in-sample grid configurations. Correctly specified, v3's DSR is
**0.9993**, not 0.944. The pre-registered figure stays on record as a miss.

### M4. Single-configuration selection was the main overfitting channel
Walk-forward picked a different configuration almost every year. The final
pick was one of 108, and its rebalance weekday was the luckiest of 7 (Sharpe
1.52 vs 1.24 for the worst).

**Fix (v4):** average all 27 signal configurations on all 7 weekday
calendars, so nothing is selected.

### M5. Benchmarks were too easy
A tougher benchmark is **the same trend engine on BTC alone**: Sharpe 1.27 over
2019 → 2026, against v3's 1.52. Most of the edge comes from trend-following
plus volatility targeting; the coin rotation adds diversification. Every
results table now includes it.

### M6. Execution timing was assumed, not measured
**Fix:** downloaded hourly candles for 338 coins and re-simulated fills 1, 4
and 12 hours after the close (section 4.4).

### M7. Idle cash earned nothing
About 75% of capital is in USDT. Yield is modelled optionally as the US
3-month T-bill rate minus 0.5 pp (`data.load_tbill`). Headline numbers exclude
it. See also R2: the bot must see the whole account, so cash must **not** be
moved to savings outside the spot wallet.

### M8. No liquidity limit on position size
The cost model caps slippage at 0.75%, which cannot represent a position many
times a coin's daily volume. That never mattered on Binance below $1M, but on
the thinner Bitfinex history it inflated about 18% of P&L (section 4.1).

**Fix:** positions are capped at 10% of the coin's 30-day median daily volume.
It is always on in paper/live, and optional in the simulator
(`max_participation`).

---

## 2. Code defects found and fixed (passes 1-2)

| # | Defect | Impact | Fix | Test |
| --- | --- | --- | --- | --- |
| C1 | Simulator treated **any** missing price as a delisting; signals went NaN for up to 80 days after a gap | Latent: 543 gap days, 12 coins; no false liquidation in v3's history | Positions carried through gaps, no trading on gap days, move booked on resumption | `test_temporary_gap_is_not_a_delisting` |
| C2 | **Tokenised equities** (`<TICKER>BUSDT`, from June 2026) would become eligible in Dec 2026 | Bot would buy stock tokens | Name + listing-date + weekend-volatility rule (its weekend test only became functional after R7) | `test_tokenised_equities_excluded_but_coins_kept` |
| C3 | One rejected live order aborted the rest of the rebalance and lost the log | Half-executed rebalances | Orders attempted independently, all outcomes logged | `test_live_broker_one_failure_does_not_abort_others` |
| C4 | Live buys sized at yesterday's close could exceed free USDT | Rejected entries | Buys sized in USDT, capped at free balance | `test_live_broker_sells_first_full_exit_and_caps_buys` |
| C5 | Full exits sold a computed amount (dust, or oversell) | Positions not closed | Exits sell the entire free balance (dust then handled by R3) | same |
| C6 | No stale-data guard | Could trade on old candles | Latest bar must be yesterday (UTC) | `test_stale_data_guard` |
| C7 | No idempotency or lock in live mode | Double cron run trades twice | Lock + per-bar idempotency (per account: R5) | `test_run_lock_is_exclusive` |
| C8 | Non-atomic state writes | Corrupt state after a crash | Write-then-rename | – |
| C9 | Paper (exchange mode) could not value or sell delisted holdings | NAV overstated | Replaced by R4's gap/delisting rule | `test_paper_carries_gaps_and_delists_only_after_a_week` |
| C10 | Data top-up treated a symbol more than 45 days stale as delisted | Stale CI cache would delist everything | `refresh_symbol` backfills monthly, then daily | – |
| C11 | Ledger CSV appends could misalign columns | Corrupt forward record | Header-aware append | `test_append_csv_keeps_columns_aligned` |
| C12 | Equity rule took the listing date from the first price in the panel; live windows are ~800 days | Wrong exclusions from ~2028 | True listing dates as panel metadata | `test_equity_rule_uses_true_listing_date_in_short_live_windows` |
| C13 | Refresh skipped the month of the last cached bar | Silent gap after an outage | Refresh from the first missing day's month | – |

## 2b. Independent adversarial review (pass 3)

A separate agent reviewed the live engine, simulator, strategy and data code
with fake exchanges and synthetic data, with no access to my reasoning. It
reproduced most findings with scripts. All 23 tests passed at the time; none
of these defects was covered by them.

| # | Sev. | Finding (reproduced unless noted) | Fix | Test |
| --- | --- | --- | --- | --- |
| R1 | **High** | A failed BTC fetch silently switched the regime filter **off** (target exposure 0% → 25-42% in BTC downtrends); a panel with only 15 of ~400 coins still passed the freshness check | `check_complete`: no trading unless BTC, every held coin and ≥ 95% of yesterday's coins are priced on the bar | `test_check_complete_blocks_partial_panels` |
| R2 | **High** | A held coin missing from the price panel understated NAV and triggered unplanned real orders (e.g. 3 buys, NAV logged 3.6% low after one HTTP 429) | Holdings valued at panel price → exchange ticker → abort; inactive markets reported, not traded. README no longer suggests moving cash to savings, which the bot cannot see | `test_live_positions_values_unpriced_holding_via_ticker_and_drops_dust` |
| R3 | **High** | Dust after a full exit counted as a position, so the "open a position" rule never fired again; 1,119 of 1,120 v4 re-entries depend on that rule (live would have earned 33.4% instead of 35.5% a year on 2019-24) | Holdings below max(exchange minimum, `min_trade` × NAV) are dust: zero weight, never traded | `test_dust_does_not_block_re_entry` |
| R4 | Med | Paper liquidated a coin on its first missing day; the simulator carries gaps | Gaps carried at the last price; delisted only after 7 consecutive missing days | `test_paper_carries_gaps_and_delists_only_after_a_week`, `test_paper_gap_resumes_without_loss` |
| R5 | Med | *(reasoned)* Lock and last-bar files were per strategy setting, not per account; `--live` and `--live --risk growth` would churn one account between two target sets | Live state keyed by exchange + hashed API key; an account belongs to one setting (`--take-over` to switch) | `test_account_claimed_by_one_strategy` |
| R6 | Med | Live (ccxt) data used volume × close and a top-80 pre-cut; targets differed by up to 10.5% of NAV | Binance: klines endpoint with the archive's exact quote volume; pre-cut widened to 150 | (exact on the archive path; exchange path untestable from here) |
| R7 | Med-low | The tokenised-equity weekend test never ran (NaN propagation in `cumsum`), so every candidate was excluded; my test passed for the wrong reason | NaN-safe expanding means | `test_equity_rule_keeps_crypto_like_new_b_suffix_coin` |
| R8 | Low-med | Redenominations and re-used tickers were bridged as gaps: LUNA ×177,400 across 18 days, COCOS ×1,295, QUICK ×0.0008, SUN, BNX, DREP, STRAX, VIDT, VEN | `split_discontinuities`: >8× jump across a ≥3-day gap, or any gap >30 days, ends the old asset and starts a new one (11 series split) | `test_split_discontinuities_reused_ticker` |
| R9 | Low | Leveraged-token filter `(UP\|DOWN\|BULL\|BEAR)USDT$` dropped real coins JUP and SYRUP; gold token XAUT not excluded | Leveraged only if the prefix is itself a listed coin; XAUT excluded; JUP and SYRUP downloaded | – |
| R10 | Low | A daily file that 404'd once was never refetched | Recent holes are re-tried on every refresh | – |
| R11 | Low | Trade log written after the bar was marked done; empty CSV crashed `append_csv`; timed-out orders not counted against cash | Fills logged before `mark_done`; empty-file safe; unknown-outcome buys assumed filled | `test_unknown_order_outcome_never_overspends`, `test_append_csv_handles_empty_existing_file` |

The reviewer found no problems in:
* look-ahead (truncation invariance holds);
* order rules versus the simulator;
* order sequencing;
* leverage;
* precision handling;
* first-run, all-cash and absent-coin crash paths.

Tests: 7 → 35, run in CI on every push.

### Pass 4: found while answering operating questions (deposits, going live)

| # | Finding | Fix | Test |
| --- | --- | --- | --- |
| D1 | The live engine had no concept of deposits or withdrawals. A deposit diluted every position below target, but per-coin gaps were under the 5-point band, so **zero orders** were placed: a deposit doubling the account was 58% invested after a day and 92% after a month. A withdrawal of half the account doubled exposure (23% → 47%), again with zero orders. The backtest never had cash flows, so no earlier test could catch this | Flows are detected each run (today's value vs yesterday's holdings at today's prices). Deposits are invested pro rata across current holdings, keeping the mix; withdrawals over 10% trim pro rata, smaller ones come from cash. The simulator gained the same logic (`flows`, `flow_mode`, `min_order_usd`). For small weekly deposits the old behaviour made little difference: $1k + $300/week from 2019 ends at $316,958 (fixed) vs $323,987 (old) on $122,800 contributed, within noise | `test_deposit_is_invested_pro_rata_keeping_the_mix`, `test_live_detects_weekly_deposit_and_keeps_the_mix`, `test_paper_deposit_ends_at_the_strategy_mix`, `test_small_withdrawal_comes_from_cash_large_one_trims_pro_rata`, `test_simulator_deposit_naive_vs_pro_rata` |
| D2 | OKX API keys require a passphrase, which the runner never passed, so live trading on OKX would have failed to authenticate. There was also no way to use OKX's regional API domains | `API_PASSWORD` env var; `--hostname` | (ccxt `requiredCredentials` checked) |
| D3 | The forward report measured returns from raw NAV, so a deposit would have looked like profit | Flow-adjusted time-weighted returns | – |

### Effect of the data corrections (R8, R9) on reported results
They changed historical numbers, so every v4 figure below is re-run on the
corrected data. The pre-correction values are kept here.

| Record | Before | After |
| --- | --- | --- |
| Dev 2019-24 Sharpe / CAGR | 1.47 / 35.5% | **1.42 / 33.9%** (drawdown unchanged, −31.7%) |
| Holdout 2025-26 total return | +6.8% | **+7.7%** |
| Fresh Bitfinex 2014-18 | 1.72 / 42.1% | unchanged (no spliced series on Bitfinex) |
| Combined 2014-26 CAGR / Sharpe | 33.0% / 1.42 | **32.3% / 1.40** |

Most of the dev change comes from JUP entering the universe in 2024. JUP was
barely held (max weight 0.36%), but as a top-volume coin it displaced others
from the ranked universe; without JUP/SYRUP the dev Sharpe would be 1.46.
Single calendar years are sensitive to universe composition (2024: +51.5%
without vs +43.0% with); multi-year statistics much less so.

### Cost structure
v3 paid **2.8% a year** in costs at 15.6× annual turnover, 40% of it resizing.
v4's averaging smooths targets: **3.9×** turnover and **0.67% a year** cost drag.

---

## 3. Strategy v4: what changed, and why

All decided from the audit findings and Binance data up to 2024-12-31 only:

| Change | Motivation |
| --- | --- |
| Equal-weight ensemble of 27 configs (universe 15/30/50 × top-k 4/8/15 × lookbacks 10-80 / 20-160 / 40-320 days) | M4: remove selection |
| 7 staggered weekly rebalance calendars | M4: remove timing luck |
| Gap-tolerant signals, tokenised-equity exclusion | C1, C2 |
| Minimum trade 0.2% of NAV, enforced in paper/live too | exchange minimums; paper = live = backtest |
| Unchanged: BTC regime filter, 35% vol target, 5% band, 200-day history, 30% single-coin cap | no evidence to change them |

The data and live-engine fixes of pass 3 do not change the strategy, only what
it is fed and how its orders are executed. `frozen_config_v4.json` is
unchanged.

---

## 4. Results (corrected data)

### 4.1 Untouched data: Bitfinex 2014-2018 (pre-registered, run once)
Fees 0.20% + liquidity-scaled slippage, $100k account, delisted coins included.

| 2014-2018 | v4 | v3 | BTC buy & hold | EW top-10 | BTC trend (same engine) |
| --- | --- | --- | --- | --- | --- |
| Sharpe | **1.72** | 1.71 | 0.82 | 0.68 | 1.39 |
| CAGR | 42.1% | 43.4% | 39.3% | 23.7% | 49.4% |
| Max drawdown | **−21.4%** | −18.2% | −82.9% | −90.8% | −25.6% |
| Calmar | 1.97 | 2.39 | 0.47 | 0.26 | 1.93 |
| Sharpe at 2× costs | 1.61 | – | – | – | – |

v4 year by year, with BTC in brackets:

| Year | v4 | BTC |
| --- | --- | --- |
| 2014 | −12% | −56% |
| 2015 | +30% | +33% |
| 2016 | +19% | +125% |
| 2017 | +407% | +1,325% |
| 2018 | −16% | −72% |

**Pre-registered criteria F1-F6: all pass** (PSR 0.9999; 66th percentile of
the development record as run, 69th against the corrected development record).
**v4 becomes the recommended strategy.** v3 also passes all six.

**Liquidity sensitivity** (`reports/v4_capacity_liquidity.json`). Applied after
the test; it can only make results more realistic. Before 2018 Bitfinex
"top-15" universes included very thin markets. At the extreme, the backtest
held BCC at about 35× its daily volume, and 18% of P&L came from coins
trading under $1M a day.

| Bitfinex 2014-18, frozen v4 | Sharpe | CAGR | MaxDD |
| --- | --- | --- | --- |
| As pre-registered | 1.72 | 42.1% | −21.4% |
| ≤ 10% of daily volume, $100k | 1.80 | 40.0% | −20.1% |
| ≤ 2% of daily volume, $100k | 1.70 | 34.2% | −22.0% |
| ≤ 10% of daily volume, $1M | 1.61 | 31.1% | −22.9% |
| ≤ 2% of daily volume, $1M | 1.34 | 20.4% | −20.9% |
| Coins under $1M/day excluded | 1.71 | 36.2% | −22.2% |

* All six variants pass F1-F6, including the extreme $1M / 2% case (40th
  percentile in F6; `criteria_liquidity_variants` in the same file).
* v3 with the 10% limit improves: Sharpe 1.71 → 1.93, because its thin-market
  positions were net losers.
* On Binance 2019-24 the 10% limit does not bind below about $1M.

Caveat on 2014-2016: only BTC, LTC, Darkcoin and ETH had enough history, so
that segment mainly tests the trend and regime engine (Sharpe 0.70 vs 0.47 for
BTC). 2017-2018 tests the rotation: Sharpe 2.75, drawdown −21%, against BTC's
1.21 and −83%.

### 4.2 Development: Binance 2019-2024 (in-sample at the design level)
| 2019-2024 | v4 | v3 walk-forward OOS | BTC buy & hold | BTC trend (same engine) |
| --- | --- | --- | --- | --- |
| Sharpe | 1.42 | 1.40 | 1.15 | 1.50 |
| CAGR | 33.9% (35.9% with cash yield) | 40.4% | 71.2% | 55.6% |
| Max drawdown | −31.7% | −32.6% | −76.6% | −27.3% |
| Turnover / cost drag | 3.9× / 0.67% | 15.6× / 2.75% | – | – |
| Sharpe at 2× costs / fills a day late | 1.39 / 1.41 | 1.31 / 1.14 | – | – |

* **Ensemble vs its members:** 1.42 against a median member of 1.34 (range
  1.02-1.75).
* **Random half-universes:** Sharpe 1.28 / 1.56 / 1.75 at the 5th / 50th /
  95th percentiles.
* **DSR** (4 pipelines inspected): 0.9992.
* **Bootstrap:** P(Sharpe > 0) = 99.75%.
* **Capacity:** Sharpe 1.42 at $100k, 1.41 at $1M, 1.38 at $10M.

### 4.3 Holdout 2025-01-01 → 2026-10-13 (contaminated, so not decision-relevant)
| | v4 | v3 | BTC buy & hold | EW top-10 | BTC trend |
| --- | --- | --- | --- | --- | --- |
| Total return | +7.7% (+12.4% with cash yield) | +25.3% | −11.1% | −53.2% | −1.4% |
| Sharpe | 0.31 | 0.67 | 0.06 | −0.36 | 0.05 |
| Max drawdown | −23.5% | −20.1% | −53.0% | −68.8% | −19.9% |

v4 underperformed v3 here; v3's fast-lookback config suited 2025-26 better.
This is reported, not acted on: tuning towards it now would be fitting to a
window already seen twice.

### 4.4 Execution timing (hourly data, dev period)
v4 Sharpe by fill time after the daily close:

| 0h | 1h | 4h | 12h |
| --- | --- | --- | --- |
| 1.42 | 1.43 | 1.40 | 1.43 |

Check (Sharpe at 4h ≥ 0.8× Sharpe at 0h): **pass**.

### 4.5 Live-engine parity
* **Signals:** the live code path on rolling 800-day windows reproduces the
  backtest targets on every holdout day (`reports/v4_parity.json`; max
  difference 7.3e-15 against a 1e-9 threshold; 651 of 651 days, re-run on the corrected data).
* **Execution:** the paper account driven by the live order rules tracks the
  simulator to 0.06% a year (it waits 7 days before treating a missing coin as
  delisted; the simulator knows immediately).

### 4.6 All records combined, 2014-01-01 → 2026-10-13 (12.8 years, two venues)
| | v4 | v3 | BTC buy & hold |
| --- | --- | --- | --- |
| CAGR | 32.3% | 37.4% | 45.2% |
| Sharpe | 1.40 | 1.41 | 0.89 |
| Max drawdown | −31.7% | −32.6% | −82.9% |
| Positive calendar years | 9/13 | 9/13 | 8/13 |

### 4.7 Altcoins (`scripts/altcoin_analysis.py`, `reports/altcoins.json`)
Descriptive, on already-seen data:

* **Where the profit comes from.** 72% of v4's gross P&L on Binance 2019-26
  came from altcoins (46% top-10 alts, 26% alts ranked 11-30), with 21% from
  BTC and 7% from ETH. 245 coins were held, and only 32% of them were net
  profitable: a few large trends pay for many small losses.
* **One altcoin at a time.** Across 277 altcoins (87 delisted or
  redenominated), each from one year after listing:

  | Median per coin | Holding the coin | Trend engine on it alone |
  | --- | --- | --- |
  | Return per year | −37% | +4% |
  | Worst drawdown | −96.5% | −30% |
  | Lost money overall | 84.5% of coins | 37% |

  The trend engine had the smaller drawdown on every coin. Its median Sharpe
  is only 0.29, and it is above 0.5 for just 30% of coins. On a single alt it
  is mainly a capital-protection tool.
* **Alt-only portfolio** (v4 forbidden from holding BTC/ETH): Sharpe 1.18 /
  CAGR 24.6% / drawdown −26% on Binance 2019-24; 1.97 / 62.5% / −20% on
  Bitfinex 2017-18; +9.7% in 2025-26. An equal-weight alt basket had max
  drawdowns of −92% in both of the first two periods and lost 63% in 2025-26.
  Including BTC/ETH improves Sharpe (1.42 / 2.75).

---

## 5. What was *not* changed, and why

* **No short side.**
  * Australian retail access to crypto derivatives is restricted.
  * Shorting brings squeeze and funding risk.
  * There is no untouched data left to validate a new sleeve.
* **No savings integration, and do not park cash manually.** The bot values
  the account from the spot wallet. USDT moved into savings is invisible to
  it, and it would sell positions down to the wrong size (R2). Cash yield
  stays a modelled number only.
* **No further strategy tuning.** The Bitfinex data is now also spent; the
  forward test is the only clean evidence left.

## 6. Remaining risks

* **Regime risk:** most return comes in strong trends (2017, 2020-21, 2024);
  choppy years are roughly flat (2019 +6%, 2025 −6.5%).
* **Venue and custody risk:** exchange failure, USDT de-peg and account freezes
  are not modelled.
* **The live exchange path (ccxt) could not be exercised against Binance from
  this environment** (geo-blocked). It was tested with fake exchanges and live
  OKX market data; place the first real orders at a small size and check them
  against `reports/live/.../trades.csv`.
* **Tax:** Australian CGT applies to every disposal, mostly short-term.
  Returns are pre-tax.
