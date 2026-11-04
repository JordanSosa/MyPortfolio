# Balance and economy results

## Account progression (economy pass)

Written by `node tools/progression.mjs --name <name>` (all accounts' run logs, snapshots,
milestones and unlock times in `.json`; the report in `.md`; `--report file.json`
re-prints one, `--compare before.json` adds before columns):

- `progression-before`: the economy as it was after the combat-curve pass (old payout,
  board ring 1 at 25, hero XP `140 L^1.32`, mastery 300 ... 110k, Plot Point gems and coins
  at the bible's first numbers), weak / mid / strong x seeds 1-2, 60 h each.
- `progression-after`: the tuned economy, weak / mid / strong x seeds 1-2, 160 h each
  (stride 6 after the first Final Arc clear), with the default player model (farms the last
  cleared stage for one run after a short frontier death).
- `progression-after-push`: the same economy with the always-push player model (`FARM=0`
  behaviour: every run on the furthest stage) and Paper Crane Flock still at 1,000
  evolutions; the sensitivity check for the player model.
- `matrix-econ-data`: `node tools/matrix.mjs --stats` cells (P0-P3 Dream Meadow ...
  P4-P7 Final Arc, Hoshi / Kuro x 3 seeds) with each run's RunStats, for fitting the
  payout / hero XP / mastery formulas offline.

The method and the final tables are in docs/META.md §4 / §9 and docs/ARCHITECTURE.md §6.6.

# Power-vs-stage matrix results

Written by `node tools/matrix.mjs --name <name>` (raw runs `.json`, per-cell table `.md`); `node tools/matrix-report.mjs before after` prints the grids of docs/ARCHITECTURE.md §6.

- `matrix-before`: the pre-pass sim (old global curve, old card weights, level-scaled bosses), same checkpoints and mid bot.
- `matrix-after`: the tuned sim, 8 checkpoints x 5 stages x Hoshi / Rin / Kuro x 4 seeds.
- `matrix-bots`: lazy and good bots at the intended checkpoints.
- `matrix-heat-mid` / `matrix-heat-max`: P7 in the Final Arc at heat 12 / 41.

## Summary

`node tools/matrix.mjs --seeds 1-4 --name after` (8 checkpoints x 5 stages x Hoshi
/ Rin / Kuro x 4 seeds = 480 runs, mid bot); raw runs and per-cell tables in
`tools/results/matrix-{before,after}.{json,md}`, the "before" measured on the
pre-pass sim (old curve, old card weights, level-scaled bosses) with the same
checkpoints and the same mid bot. With 12 runs a cell's clear rate has a standard
error of ~14 points: read the grid as a whole.

Clear rate (median death time of the runs that died), mid bot, before -> after; **bold** = the stage's intended checkpoint.

| | Dream Meadow | Candy Kingdom | Shoujo Academy | Beach Episode | The Final Arc |
| --- | --- | --- | --- | --- | --- |
| P0 | 67% (7:03) -> 0% (2:49) | 25% (4:53) -> 0% (1:42) | 0% (4:50) -> 0% (1:06) | 0% (3:01) -> 0% (0:28) | 0% (1:35) -> 0% (0:20) |
| P1 | 92% (11:14) -> 17% (3:45) | 33% (7:56) -> 0% (2:06) | 0% (7:43) -> 0% (1:15) | 0% (6:38) -> 0% (1:11) | 0% (1:28) -> 0% (1:09) |
| P2 | **100% -> 67% (5:58)** | 67% -> 0% (7:12) | 8% (9:26) -> 0% (2:08) | 0% (7:10) -> 0% (2:06) | 0% (1:55) -> 0% (1:10) |
| P3 | 100% -> 92% (4:37) | **67% (13:55) -> 50% (9:38)** | 17% (10:51) -> 0% (7:40) | 0% (12:01) -> 0% (2:47) | 0% (4:57) -> 0% (1:13) |
| P4 | 100% -> 100% | 92% -> 92% (9:58) | **58% (11:46) -> 50% (10:50)** | 17% (17:34) -> 17% (7:14) | 0% (10:46) -> 0% (3:51) |
| P5 | 100% -> 100% | 100% -> 100% | 100% -> 100% | **67% -> 75% (16:08)** | **17% (14:27) -> 33% (5:40)** |
| P6 | 100% -> 100% | 100% -> 100% | 100% -> 100% | 92% -> 100% | **42% -> 75% (16:58)** |
| P7 | 100% -> 100% | 100% -> 100% | 100% -> 100% | 92% -> 100% | 42% -> 92% (18:17) |

Boss fight length (s, median of kills, killed / reached) at the intended checkpoint(s), after:

| Stage | Checkpoint | Bosses |
| --- | --- | --- |
| Dream Meadow | P2 | king puff 23 (10/12); nightmare teddy 33 (9/10); lady lunatic 90 (8/8) |
| Candy Kingdom | P3 | gingerbread golem 58 (11/11); sugar plum tyrant 96 (6/6) |
| Shoujo Academy | P4 | council president 77 (11/12); bishounen 115 (6/7) |
| Beach Episode | P5 | kraken chan 50 (12/12); firework dragon 99 (9/12) |
| The Final Arc | P5 | truck kun boss 113 (8/8); rival chan 118 (6/6); cancel sama 238 (4/5) |
| The Final Arc | P6 | truck kun boss 58 (12/12); rival chan 66 (12/12); cancel sama 153 (9/9) |

Early-game feel (medians), after:

| Stage @ checkpoint | 1st level-up | level-up gap 0:20-3:00 | longest gap (no boss) | level 1/2/3 min | damage taken 0-1:30 / 1:30-3:00 | kills/s min 1-3 | alive min 1-3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dream Meadow @ P0 | 2.2 s | 9.3 s | 39 s | 9 / 12 / 14 | 65 / 60 | 8.1 / 10.5 / 7.2 | 42 / 81 / 136 |
| Dream Meadow @ P2 | 1.3 s | 9.0 s | 26 s | 10 / 17 / 25 | 4 / 0 | 11.4 / 17.2 / 31.0 | 35 / 65 / 87 |
| Candy Kingdom @ P3 | 1.2 s | 5.5 s | 30 s | 12 / 22 / 29 | 0 / 0 | 8.2 / 15.8 / 22.3 | 30 / 49 / 60 |
| Shoujo Academy @ P4 | 1.3 s | 7.0 s | 38 s | 10 / 15 / 26 | 18 / 15 | 10.6 / 13.7 / 22.6 | 29 / 70 / 64 |
| Beach Episode @ P5 | 5.2 s | 8.0 s | 48 s | 12 / 18 / 23 | 32 / 19 | 8.9 / 15.1 / 19.8 | 42 / 82 / 86 |
| The Final Arc @ P5 | 3.6 s | 5.3 s | 28 s | 20 / 27 / 34 | 31 / 72 | 15.8 / 32.6 / 44.1 | 42 / 61 / 63 |
| The Final Arc @ P6 | 4.9 s | 5.5 s | 16 s | 25 / 31 / 36 | 0 / 0 | 24.9 / 48.4 / 61.5 | 28 / 38 / 42 |

**Bots** at the intended checkpoints (`--bot lazy,good`, `tools/results/matrix-bots`;
the mid bot is the average player between them):

| Stage @ checkpoint | lazy | mid | good |
| --- | --- | --- | --- |
| Dream Meadow @ P2 | 33% (4:38) | 67% (5:58) | 67% (5:42) |
| Candy Kingdom @ P3 | 8% (8:38) | 50% (9:38) | 75% (10:49) |
| Shoujo Academy @ P4 | 0% (9:05) | 50% (10:50) | 75% (12:46) |
| Beach Episode @ P5 | 25% (9:02) | 75% (16:08) | 92% (16:42) |
| The Final Arc @ P6 | 75% (16:51) | 75% (16:58) | 75% (18:08) |

**P7 at heat** (`--twists mid|max`, `HEAT_SETS`): heat 0: 92% (fights truck kun boss 38 s, rival chan 41 s, cancel sama 84 s); heat 12: 75% clears (12 runs, deaths at 16:14; fights truck kun boss 36 s, rival chan 34 s, cancel sama 58 s); heat 41: 58% clears (12 runs, deaths at 15:13; fights truck kun boss 53 s, rival chan 74 s, cancel sama 145 s).


