# Progression verify-dm-f

`node tools/progression.mjs --bots mid --seeds 3-10 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-f.json --name verify-dm-f` (2026-11-03)

## Milestones (median hours (run) [min-max] over 8 seeds; --bots mid --seeds 3-10 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-f.json --name verify-dm-f)

| Milestone | Target | mid |
| --- | --- | --- |
| First board node | run 1 | 0.05 h (run 1) [0.04-0.21] |
| First Merch Machine pull | first hour | 0.05 h (run 1) [0.04-0.21] |
| First King Puff kill | runs 3-6 (0.5-1 h) | 0.40 h (run 5) [0.19-0.80] |
| Dream Meadow clear | 1.5-3 h | 1.49 h (run 16) [0.80-2.11] |
| Candy Kingdom clear | 4-7 h | not reached (1.49 h played) |
| Shoujo Academy clear | 8-14 h | not reached (1.49 h played) |
| Beach Episode clear | 15-25 h | not reached (1.49 h played) |
| Final Arc clear | 30-45 h | not reached (1.49 h played) |
| All gameplay heroes | - | not reached (1.49 h played) |
| All gameplay weapons | - | not reached (1.49 h played) |
| All passives | - | not reached (1.49 h played) |
| All gameplay heroes + weapons | 40-60 h | not reached (1.49 h played) |
| First 10-pull | - | 0.70 h (run 9) [0.19-0.84] |
| First SSR+ | - | 0.65 h (run 8) [0.24-1.39] +5 n/r |
| First UR+ | - | 1.39 h (run 13) [1.39-1.39] +7 n/r |
| First LR+ | - | not reached (1.49 h played) |
| First MYTHIC | - | not reached (1.49 h played) |
| 4 relic slots | - | not reached (1.49 h played) |
| Board ring 1 done | - | 1.24 h (run 14) [1.10-1.44] +1 n/r |
| Board ring 2 done | - | not reached (1.49 h played) |
| Board ring 3 done | - | not reached (1.49 h played) |
| Board ring 4 done | - | not reached (1.49 h played) |
| Board fully bought | 100-150 h | not reached (1.49 h played) |
| Main hero Lv 10 | ~3 h (P2) | not reached (1.49 h played) |
| Main hero Lv 20 | ~15 h (P4) | not reached (1.49 h played) |
| Main hero Lv 30 | ~80 h (P6) | not reached (1.49 h played) |
| Every gameplay hero Lv 30 | 200 h+ | not reached (1.49 h played) |
| A weapon mastery 5 | ~8 h (P3) | not reached (1.49 h played) |
| A weapon mastery 10 | ~80 h (P6) | not reached (1.49 h played) |
| Mastery 10 on all 20 | 200 h+ | not reached (1.49 h played) |
| Heat 8 clear | - | not reached (1.49 h played) |
| Heat 16 clear | - | not reached (1.49 h played) |
| Heat 32 clear | - | not reached (1.49 h played) |
| Max heat (41) clear | 200 h+ | not reached (1.49 h played) |

Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):

## Checkpoint snapshots (median over seeds) vs META.md §9.1

**mid**

| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 h | P1: 420, Lv 5, M 1/0, - | 1.7k | 5 | 2 / 2 | SR:cosplay_wig*0 (1) | C0 | 11 | 0/0/0/0/0 |

## Income per phase (median over seeds)

**mid**

| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-1 h | 12.5 | 4:03 | 129 | 1.6k | 2.6k | 1.24 | 10.5 | 3.7k | dream meadow |
| 1-3 h | 7.1 | 8:54 | 346 | 2.9k | 2.8k | 1.98 | 5.00 | 4.8k | dream meadow |

## The incremental hook (first 10 h) and dead zones (whole run)

| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 16 | 100% | 91% | 91% | 0.62 h / 6 runs (at 1.87 h) | 0.62 h / 6 runs (at 1.87 h) | 0.20 h / 2 runs (at 1.46 h) |

("Payout covers": the run's coin payout alone buys the cheapest node that was open before it; gaps are the worst seed; a progress event = a board buy, an unlock, a pull or a hero level-up, earned or bought.)

## First 12 runs (mid, seed 3)

| Run | h | Stage | Result | Time | Kills | Coins | Gems | Bought | Board | Pulls | New |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.05 | dream meadow | death | 2:04 | 1303 | 49 | 596 | 5 (83) | 83 | 1 | main_character_aura |
| 2 | 0.10 | dream meadow | death | 2:19 | 1225 | 54 | 21 | 2 (46) | 129 | 1 | - |
| 3 | 0.13 | dream meadow | death | 1:19 | 488 | 30 | 92 | 4 (96) | 225 | 1 | mochi, bubble_tea_cannon |
| 4 | 0.17 | dream meadow | death | 1:29 | 426 | 32 | 71 | 1 (36) | 261 | 1 | - |
| 5 | 0.24 | dream meadow | death | 3:17 | 2605 | 85 | 147 | 3 (87) | 348 | 1 | idol_lightstick_wave, chibi_charm |
| 6 | 0.30 | dream meadow | death | 3:06 | 1095 | 65 | 9 | 3 (67) | 415 | 1 | - |
| 7 | 0.34 | dream meadow | death | 1:42 | 739 | 42 | 10 | 1 (34) | 449 | 1 | - |
| 8 | 0.40 | dream meadow | death | 2:35 | 1319 | 73 | 16 | 2 (78) | 527 | 1 | - |
| 9 | 0.49 | dream meadow | death | 4:55 | 6923 | 153 | 669 | 6 (255) | 782 | 1 | rin, kotatsu_of_sloth, training_montage |
| 10 | 0.58 | dream meadow | death | 4:25 | 2192 | 106 | 41 | 1 (87) | 869 | 1 | inner_monologue |
| 11 | 0.77 | dream meadow | death | 10:40 | 12110 | 300 | 581 | 5 (312) | 1181 | 11 | kuro, dark_flame_dragon, friendship_bracelet |
| 12 | 0.85 | dream meadow | death | 4:12 | 3618 | 125 | 18 | 3 (101) | 1282 | 11 | - |

## Unlock timeline (median hours; n/r = not reached)

| Unlock | mid |
| --- | --- |
| main_character_aura | 0.05 |
| bubble_tea_cannon | 0.15 |
| mochi | 0.17 |
| idol_lightstick_wave | 0.22 |
| training_montage | 0.24 |
| chibi_charm | 0.40 |
| rin | 0.40 |
| kuro | 0.40 |
| dark_flame_dragon | 0.40 |
| friendship_bracelet | 0.40 |
| kotatsu_of_sloth | 0.55 |
| inner_monologue | 0.57 |
| henshin_burst | 0.74 |
| pudding | 1.49 |
| candy_kingdom | 1.49 |
| teapot_tempest | 1.49 |
| budget_cuts | 1.49 |
| filler_overload | 1.49 |
| rushed_production | 1.49 |
| censored | 1.49 |
| cliffhanger | 1.49 |
| power_creep | 1.49 |
| plot_armor | 1.86 |

(8 accounts; 124 banked runs, 124 simulated; 1 min wall clock)
