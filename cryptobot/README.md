# cryptobot — trend-following crypto rotation (v4 ensemble)

An asset-agnostic, long-only spot strategy for crypto. Every day after the
00:00 UTC close it ranks the most liquid coins by trend strength, holds the
strongest uptrends sized by volatility, and moves to cash (USDT) when the
market trends down.

The current version, **v4**, came out of a full audit of the first version
([`AUDIT.md`](AUDIT.md)). It has no tuned parameters: it averages 27 signal
configurations on 7 staggered rebalance calendars. It was frozen, then tested
once on data nobody had looked at, under a pre-registered protocol
([`PROTOCOL_v2.md`](PROTOCOL_v2.md)).

![untouched data](reports/v4_fresh.png)
![untouched data drawdowns](reports/v4_fresh_drawdown.png)

## Verdict

**What the evidence supports.** The strategy has a statistically solid,
cost-robust edge, and it cuts drawdowns to between a quarter and a half of
holding crypto.

* **Untouched data.** On a different exchange (Bitfinex, 2014-2018, delisted
  coins included) it made **+42% a year at a −21% worst drawdown**. BTC made
  +39% a year at −83%. It passed all six pre-registered criteria.
* **Combined record.** Over all records (12.8 years, 2014 → 2026) it compounds
  at 33% a year with Sharpe 1.42 and a worst drawdown of −32%.

**What it is not.**

* **It doesn't beat BTC in roaring bull markets.** In 2017 it made +407%
  while BTC made +1,325%. It trades upside for survival.
* **It earns little in choppy markets.** In 2025-26 it made only +6.8% in
  21 months (BTC −11%, alts −53%).
* **The live record is still short.** The forward test started on
  2026-10-14, so there is little live evidence yet.

**Recommendation.** Paper-trade it for 90 days. The ledgers are already
running, and the daily job keeps them going once merged. Then go live with
10–25% of the intended capital if `forward_report.py` says `continue`, and
scale up only while results stay inside the expected band.

## Evidence

| Tier | Data | v4 Sharpe | v4 CAGR | v4 MaxDD | BTC Sharpe / MaxDD | Status |
| --- | --- | --- | --- | --- | --- | --- |
| **Fresh (primary test)** | Bitfinex 2014-2018, 113 pairs incl. delisted, 0.2% fees | **1.72** | **42.1%** | **−21.4%** | 0.82 / −82.9% | untouched, run once, **all 6 criteria passed** |
| Development | Binance 2019-2024 | 1.47 | 35.5% | −31.7% | 1.15 / −76.6% | in-sample at the design level |
| Holdout | Binance 2025-01 → 2026-10 | 0.29 | 3.8% | −24.4% | 0.06 / −53.0% | contaminated (seen before v4 existed), not used for decisions |
| Forward | live paper ledgers | – | – | – | – | started 2026-10-14 |

Pre-registered fresh-data criteria (`reports/v4_fresh_bitfinex.json`), all ✅:

| # | Criterion | Result |
| --- | --- | --- |
| F1 | Probabilistic Sharpe vs 0 ≥ 0.95 | 0.9999 |
| F2 | Sharpe ≥ BTC buy-and-hold | 1.72 vs 0.82 |
| F3 | MaxDD ≤ ½ of BTC's | −21.4% vs −82.9% |
| F4 | Calmar > BTC's | 1.97 vs 0.47 |
| F5 | Sharpe at 2× costs ≥ 0.75× base | 1.61 (94%) |
| F6 | Consistent with the development record (≥ 5th pct) | 66th percentile |

Other checks:

* **Cost and timing robustness.** Cost drag is 0.67% a year at 3.9× annual
  turnover. Sharpe stays at 1.41–1.47 whether fills happen at the close or
  1, 4 or 12 hours later (hourly data, `reports/v4_exec_delay.json`).
* **Live engine = backtest.** On all 651 holdout days, signals matched to
  7e-15. Paper-account NAV tracks the simulator to 0.012% a year
  (`reports/v4_parity.json`).
* **No single lucky setting.** The ensemble beats its median member (1.47 vs
  1.34). On random half-universes, Sharpe ranges 1.19–1.58.

## Risk profiles: the one dial

Everything is frozen except the portfolio volatility target, which you choose
with `--risk`. Sharpe barely changes across profiles; return and drawdown
scale together.

| Profile | Vol target | Fresh 2014-18: CAGR / MaxDD | Dev 2019-24: CAGR / MaxDD |
| --- | --- | --- | --- |
| conservative | 20% | 26% / −13% | 16% / −16% |
| **balanced (default, validated)** | **35%** | **42% / −21%** | **36% / −32%** |
| growth | 50% | 54% / −36% | 49% / −41% |
| aggressive | 75% | 69% / −38% | 63% / −56% |

Only "balanced" was the pre-registered configuration; the other rows are
informational. Choose the drawdown you can sit through without switching the
bot off. Abandoning it mid-drawdown is the most common way a sound strategy
loses money.

## How it works

Everything is computed daily after the 00:00 UTC candle close. Per ensemble
member:

1. **Universe.** The top N coins (N = 15 / 30 / 50) by 30-day median dollar
   volume, among coins with at least 200 days of history.
   * Stablecoins, leveraged tokens and tokenised stocks are excluded.
   * Delisted coins are in the data, so there is no survivorship bias.
2. **Trend score.** The average of `tanh(z)` over four lookback horizons,
   where z is the log-return scaled by its expected volatility.
   * Fast set: 10/20/40/80 days. Medium: 20-160. Slow: 40-320.
3. **Selection.** On the member's weekly rebalance day, take the top K
   (K = 4 / 8 / 15) coins with a positive trend.
   * A coin is dropped the first day its trend turns non-positive, so exits
     are daily and entries weekly.
4. **Sizing.** Weight each pick by trend ÷ volatility and scale the
   portfolio to the volatility target.
   * No leverage; at most 30% in any one coin.
   * A BTC regime filter cuts exposure when BTC itself trends down.

**v4 output.** The average of all 27 members (N × K × lookback set), each on
7 staggered weekday calendars: 189 sub-portfolios in total. On average it
holds about 13 coins at about 24% total exposure. Exposure is 0% in bear
markets and up to about 80% in strong bull markets.

**Execution.** A position is traded only when it drifts more than 5
percentage points from target. Trades under 0.2% of NAV are skipped, exits
always execute, and sells go before buys.

The economic basis is well documented: time-series and cross-sectional
momentum in crypto (Liu & Tsyvinski 2021; Liu, Tsyvinski & Wu 2022) and
volatility-managed portfolios (Moreira & Muir 2017).

## Quick start

```bash
cd cryptobot
pip install -r requirements.txt
python -m pytest -q tests                      # 23 tests incl. look-ahead and live-order logic
python scripts/download_data.py --hourly --bitfinex --tbill   # ~2 h first time (674 Binance symbols, hourly bars, Bitfinex)
python scripts/research_v4.py dev              # development evaluation (Binance <= 2024)
python scripts/research_v4.py fresh            # Bitfinex 2014-18 validation set
python scripts/research_v4.py holdout          # 2025 → today
python scripts/research_v4.py exec             # execution-delay test (needs 1h data)
python scripts/research_v4.py parity           # live-engine replay (~45 min)
python scripts/make_charts.py
```

## Forward testing (started 2026-10-14)

Four paper ledgers run from the 2026-10-13 bar, so v4 and v3 are compared
live on two data sources:

| Ledger | Strategy | Prices |
| --- | --- | --- |
| `reports/paper/binance-archive-v4/` | v4 | Binance public archive (the backtest's own source) |
| `reports/paper/okx-v4/` | v4 | live OKX API (16 of the top 25 picks shared with Binance) |
| `reports/paper/binance-archive-v3/`, `okx-v3/` | v3 | as above |

To keep them going:

* **Automatically.** `.github/workflows/cryptobot-forward-test.yml` runs
  daily at 03:17 UTC and commits the ledgers. It is paper-only with no keys,
  and starts once this branch is on `master`.
* **By cron.** Run `python scripts/paper_trade.py` (archive, v4) or add
  `--exchange okx` any time after 00:05 UTC.
* **Checking progress.** `python scripts/forward_report.py reports/paper/binance-archive-v4`
  compares the forward NAV with the band expected from the backtest records
  and evaluates the kill switches.

## Going live with real funds

```bash
export API_KEY=... API_SECRET=...      # spot trading permission only, withdrawals DISABLED
export CRYPTOBOT_LIVE=I_UNDERSTAND_THE_RISK
python scripts/paper_trade.py --exchange binance --dry          # inspect today's targets
python scripts/paper_trade.py --exchange binance --live         # balanced profile
python scripts/paper_trade.py --exchange binance --live --risk growth
```

* **Schedule.** Daily, after 00:05 UTC. The bot refuses stale data, holds a
  lock, never trades the same bar twice, and logs every order to
  `reports/live/...`.
* **Capital.**
  * v4 holds 10–25 small positions and skips trades under 0.2% of NAV.
  * With Binance's ~$5 minimum order, use **at least $5,000**, otherwise many
    positions cannot be opened.
  * Under the cost model, capacity is not a constraint for private accounts:
    dev Sharpe is 1.47 at $10k–$100k, 1.46 at $1M and 1.43 at $10M.
* **Account.** Use a dedicated sub-account. The bot sells any coin it does not
  want, including coins you bought by hand.
* **Idle cash (optional, manual).** About 75% of the account is usually USDT.
  Parking it in flexible savings at T-bill-like rates (modelled as T-bill −
  0.5 pp) added +1.6% a year over 2019-24 and +2.5% a year over 2025-26. It
  also adds exchange counterparty risk, and the bot does not automate it.

**Kill-switch rules (stop and re-validate):**

1. NAV falls more than 45% from its peak (about 1.4× the worst drawdown in
   any record).
2. After 90 or more days, the forward return falls below the 2.5th percentile
   of the expected band.
3. Realised costs per trade exceed twice the model. Check `trades.csv`
   against exchange fills.

`forward_report.py` evaluates rules 1 and 2.

**Maintenance.** Run `pytest` after any change. Do not re-tune on data you
have already seen. A new version needs a new pre-registered protocol and
untouched data; the forward ledger is now the only such data.

## Asset-specific mode: how to tune it, and when to pick an asset

The portfolio strategy is asset-agnostic and is the recommended mode. To run
the same trend engine on a single coin:

```bash
python scripts/tune_asset.py SOLUSDT       # writes configs/SOLUSDT.json only if it qualifies
python scripts/paper_trade.py --asset SOLUSDT --exchange okx
```

**How to pick an asset.** A coin is tradable in single-asset mode only if it
passes every gate:

| Gate | Requirement | Why |
| --- | --- | --- |
| S1 | ≥ 730 days of history and ≥ $20M 30-day median daily volume | enough regimes to validate; low slippage |
| S2 | Walk-forward OOS Sharpe ≥ 0.8 | real edge after costs |
| S3 | Beats the coin's own buy-and-hold Sharpe | otherwise just hold it |
| S4 | MaxDD ≤ 60% of buy-and-hold's | the point of trend following |
| S5 | Positive in ≥ 60% of walk-forward years | not one lucky year |
| S6 | Holdout Sharpe > 0 and ≥ ½ walk-forward Sharpe | generalises to data it never saw |

**How it tunes.** It tests 3 lookback ensembles × 3 volatility targets. The
config is chosen by the plateau rule (mean Sharpe of a config and its
neighbours) on a yearly walk-forward, and holdout data is never used to
select.

**When to (re)pick.**

* Re-run monthly.
* Start trading a coin only when it newly passes all gates; stop when it
  fails S2 or S6.
* Never pick a coin because of a recent rally.

**Current result.** No major coin qualifies; all fail S6. Single-coin trend
following: BTC trend made Sharpe 1.39 on Bitfinex 2014-18, but about 0 in
2025-26. The diversified ensemble is more robust. **Use the portfolio mode.**

## Research history

* **v1 → v3** (first pass). Built under [`PROTOCOL.md`](PROTOCOL.md).
  * v3 is a single configuration selected by walk-forward: OOS Sharpe 1.40
    (2019-24), holdout +25% (2025-26), and it also passes the fresh test
    (Sharpe 1.71).
  * It failed some of its own benchmarks; the audit showed those were
    under-powered.
  * Kept as a comparison: `frozen_config.json`, `reports/walk_forward*.json`,
    `reports/holdout.json`.
* **Audit → v4.** Everything found and fixed is in [`AUDIT.md`](AUDIT.md),
  including 13 code defects, the most important being in the live order
  handling.

## Limitations, stated plainly

* **No backtest proves future profits.** Even untouched historical data is
  not live trading. The forward ledgers will tell.
* **Regime dependence.** Most of the return comes in strong bull trends;
  choppy years are roughly flat (2019 +6%, 2025 −7%).
* **Not modelled:** exchange failure, USDT de-peg, account freezes, and
  taxes. Australian CGT applies to every disposal, and most holdings are held
  for under 12 months.
* **Not financial advice.**

## Layout

```
cryptobot/
  data.py           Binance archive download (incl. delisted), refresh, T-bill rates
  data_bitfinex.py  independent survivorship-free Bitfinex dataset (validation)
  strategy.py       signals, selection, sizing, v4 ensemble <- all trading logic
  backtest.py       daily simulator: drift, band, min trade, gaps, delistings, costs, cash yield
  metrics.py        Sharpe/Calmar/..., PSR, Deflated Sharpe, PBO (CSCV), block bootstrap
  research.py       v3 grid / walk-forward helpers
  live.py           market data, order planning, paper account, hardened live broker
scripts/            research_v4 (dev/fresh/holdout/exec/parity), paper_trade, forward_report,
                    audit_diagnostics, tune_asset, make_charts, v3 research scripts
reports/            every number quoted here (JSON/CSV/PNG), incl. failed iterations
frozen_config_v4.json  the recommended strategy (hash-checked)
frozen_config.json     v3, kept for comparison
PROTOCOL.md / PROTOCOL_v2.md / AUDIT.md
```
