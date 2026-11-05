# Progression verify-dm-c

`node tools/progression.mjs --bots mid --seeds 3-10 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-c.json --name verify-dm-c` (2026-11-03)

## Milestones (median hours (run) [min-max] over 8 seeds; --bots mid --seeds 3-10 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-c.json --name verify-dm-c)

| Milestone | Target | mid |
| --- | --- | --- |
| First board node | run 1 | 0.06 h (run 1) [0.04-0.09] |
| First Merch Machine pull | first hour | 0.06 h (run 1) [0.04-0.09] |
| First King Puff kill | runs 3-6 (0.5-1 h) | 0.48 h (run 6) [0.15-0.83] |
| Dream Meadow clear | 1.5-3 h | 1.11 h (run 13) [0.44-1.78] |
| Candy Kingdom clear | 4-7 h | not reached (1.11 h played) |
| Shoujo Academy clear | 8-14 h | not reached (1.11 h played) |
| Beach Episode clear | 15-25 h | not reached (1.11 h played) |
| Final Arc clear | 30-45 h | not reached (1.11 h played) |
| All gameplay heroes | - | not reached (1.11 h played) |
| All gameplay weapons | - | not reached (1.11 h played) |
| All passives | - | not reached (1.11 h played) |
| All gameplay heroes + weapons | 40-60 h | not reached (1.11 h played) |
| First 10-pull | - | 0.57 h (run 8) [0.32-1.06] |
| First SSR+ | - | 0.63 h (run 9) [0.34-1.13] +5 n/r |
| First UR+ | - | 1.13 h (run 10) [1.13-1.13] +7 n/r |
| First LR+ | - | not reached (1.11 h played) |
| First MYTHIC | - | not reached (1.11 h played) |
| 4 relic slots | - | not reached (1.11 h played) |
| Board ring 1 done | - | 1.18 h (run 12) [1.15-1.27] +5 n/r |
| Board ring 2 done | - | not reached (1.11 h played) |
| Board ring 3 done | - | not reached (1.11 h played) |
| Board ring 4 done | - | not reached (1.11 h played) |
| Board fully bought | 100-150 h | not reached (1.11 h played) |
| Main hero Lv 10 | ~3 h (P2) | not reached (1.11 h played) |
| Main hero Lv 20 | ~15 h (P4) | not reached (1.11 h played) |
| Main hero Lv 30 | ~80 h (P6) | not reached (1.11 h played) |
| Every gameplay hero Lv 30 | 200 h+ | not reached (1.11 h played) |
| A weapon mastery 5 | ~8 h (P3) | not reached (1.11 h played) |
| A weapon mastery 10 | ~80 h (P6) | not reached (1.11 h played) |
| Mastery 10 on all 20 | 200 h+ | not reached (1.11 h played) |
| Heat 8 clear | - | not reached (1.11 h played) |
| Heat 16 clear | - | not reached (1.11 h played) |
| Heat 32 clear | - | not reached (1.11 h played) |
| Max heat (41) clear | 200 h+ | not reached (1.11 h played) |

Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):

## Checkpoint snapshots (median over seeds) vs META.md §9.1

**mid**

| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 h | P1: 420, Lv 5, M 1/0, - | 1.9k | 5 | 2 / 2 | UR:directors_cut*0 SR:mascot_head*0 (2) | C0 | 11 | 1/0/0/0/0 |

## Income per phase (median over seeds)

**mid**

| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-1 h | 11.9 | 4:17 | 135 | 1.6k | 2.7k | 1.16 | 10.0 | 4.2k | dream meadow |
| 1-3 h | 7.7 | 8:12 | 387 | 2.9k | 2.4k | 2.06 | 3.50 | 4.7k | dream meadow |

## The incremental hook (first 10 h) and dead zones (whole run)

| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 12.5 | 100% | 100% | 100% | 0.32 h / 3 runs (at 1.59 h) | 0.32 h / 3 runs (at 1.59 h) | 0.16 h / 2 runs (at 1.59 h) |

("Payout covers": the run's coin payout alone buys the cheapest node that was open before it; gaps are the worst seed; a progress event = a board buy, an unlock, a pull or a hero level-up, earned or bought.)

## First 12 runs (mid, seed 3)

| Run | h | Stage | Result | Time | Kills | Coins | Gems | Bought | Board | Pulls | New |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.06 | dream meadow | death | 2:43 | 1432 | 49 | 524 | 5 (83) | 83 | 1 | main_character_aura |
| 2 | 0.11 | dream meadow | death | 2:37 | 2052 | 61 | 257 | 5 (120) | 203 | 1 | mochi, bubble_tea_cannon, idol_lightstick_wave |
| 3 | 0.20 | dream meadow | death | 4:32 | 2726 | 92 | 96 | 3 (94) | 297 | 1 | - |
| 4 | 0.25 | dream meadow | death | 2:24 | 1054 | 61 | 11 | 2 (58) | 355 | 1 | - |
| 5 | 0.34 | dream meadow | death | 4:11 | 3026 | 99 | 255 | 6 (206) | 561 | 1 | kotatsu_of_sloth, chibi_charm |
| 6 | 0.43 | dream meadow | death | 4:37 | 4289 | 140 | 59 | 4 (134) | 695 | 1 | - |
| 7 | 0.53 | dream meadow | death | 5:25 | 4566 | 178 | 190 | 4 (185) | 880 | 1 | rin, inner_monologue, training_montage |
| 8 | 0.61 | dream meadow | death | 4:03 | 1644 | 92 | 19 | 2 (86) | 966 | 1 | - |
| 9 | 0.71 | dream meadow | death | 5:01 | 4253 | 151 | 61 | 2 (139) | 1105 | 1 | - |
| 10 | 0.82 | dream meadow | death | 6:23 | 2820 | 169 | 105 | 3 (177) | 1282 | 1 | kuro, dark_flame_dragon, friendship_bracelet |
| 11 | 0.88 | dream meadow | death | 2:44 | 1773 | 72 | 13 | 1 (61) | 1343 | 1 | - |
| 12 | 1.06 | dream meadow | death | 10:04 | 13670 | 301 | 967 | 6 (313) | 1656 | 11 | - |

## Unlock timeline (median hours; n/r = not reached)

| Unlock | mid |
| --- | --- |
| main_character_aura | 0.06 |
| bubble_tea_cannon | 0.15 |
| mochi | 0.16 |
| idol_lightstick_wave | 0.31 |
| chibi_charm | 0.34 |
| kotatsu_of_sloth | 0.39 |
| rin | 0.48 |
| training_montage | 0.48 |
| kuro | 0.48 |
| dark_flame_dragon | 0.48 |
| friendship_bracelet | 0.48 |
| inner_monologue | 0.59 |
| notice_me_sparkles | 0.62 |
| pudding | 1.11 |
| candy_kingdom | 1.11 |
| teapot_tempest | 1.11 |
| budget_cuts | 1.11 |
| filler_overload | 1.11 |
| rushed_production | 1.11 |
| censored | 1.11 |
| cliffhanger | 1.11 |
| power_creep | 1.11 |

(8 accounts; 95 banked runs, 95 simulated; 1 min wall clock)
