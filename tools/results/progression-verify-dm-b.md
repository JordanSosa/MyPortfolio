# Progression verify-dm-b

`node tools/progression.mjs --bots mid --seeds 3-10 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-b.json --name verify-dm-b` (2026-11-03)

## Milestones (median hours (run) [min-max] over 8 seeds; --bots mid --seeds 3-10 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-b.json --name verify-dm-b)

| Milestone | Target | mid |
| --- | --- | --- |
| First board node | run 1 | 0.06 h (run 1) [0.04-0.09] |
| First Merch Machine pull | first hour | 0.06 h (run 1) [0.04-0.09] |
| First King Puff kill | runs 3-6 (0.5-1 h) | 0.44 h (run 6) [0.14-0.75] |
| Dream Meadow clear | 1.5-3 h | 1.18 h (run 13) [0.44-2.32] |
| Candy Kingdom clear | 4-7 h | not reached (1.18 h played) |
| Shoujo Academy clear | 8-14 h | not reached (1.18 h played) |
| Beach Episode clear | 15-25 h | not reached (1.18 h played) |
| Final Arc clear | 30-45 h | not reached (1.18 h played) |
| All gameplay heroes | - | not reached (1.18 h played) |
| All gameplay weapons | - | not reached (1.18 h played) |
| All passives | - | not reached (1.18 h played) |
| All gameplay heroes + weapons | 40-60 h | not reached (1.18 h played) |
| First 10-pull | - | 0.55 h (run 7) [0.28-1.01] |
| First SSR+ | - | 0.70 h (run 8) [0.34-0.78] +5 n/r |
| First UR+ | - | 0.78 h (run 8) [0.78-0.78] +7 n/r |
| First LR+ | - | not reached (1.18 h played) |
| First MYTHIC | - | not reached (1.18 h played) |
| 4 relic slots | - | not reached (1.18 h played) |
| Board ring 1 done | - | 1.10 h (run 12) [1.06-1.14] +6 n/r |
| Board ring 2 done | - | not reached (1.18 h played) |
| Board ring 3 done | - | not reached (1.18 h played) |
| Board ring 4 done | - | not reached (1.18 h played) |
| Board fully bought | 100-150 h | not reached (1.18 h played) |
| Main hero Lv 10 | ~3 h (P2) | not reached (1.18 h played) |
| Main hero Lv 20 | ~15 h (P4) | not reached (1.18 h played) |
| Main hero Lv 30 | ~80 h (P6) | not reached (1.18 h played) |
| Every gameplay hero Lv 30 | 200 h+ | not reached (1.18 h played) |
| A weapon mastery 5 | ~8 h (P3) | not reached (1.18 h played) |
| A weapon mastery 10 | ~80 h (P6) | not reached (1.18 h played) |
| Mastery 10 on all 20 | 200 h+ | not reached (1.18 h played) |
| Heat 8 clear | - | not reached (1.18 h played) |
| Heat 16 clear | - | not reached (1.18 h played) |
| Heat 32 clear | - | not reached (1.18 h played) |
| Max heat (41) clear | 200 h+ | not reached (1.18 h played) |

Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):

## Checkpoint snapshots (median over seeds) vs META.md §9.1

**mid**

| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 h | P1: 420, Lv 5, M 1/0, - | 1.9k | 5.5 | 2 / 2 | SR:mecha_model_kit*0 R:hype_towel*0 (2) | C0 | 11 | 1/0/0/0/0 |

## Income per phase (median over seeds)

**mid**

| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-1 h | 11.5 | 4:27 | 134 | 1.6k | 2.6k | 1.17 | 10.0 | 4.4k | dream meadow |
| 1-3 h | 7.6 | 8:40 | 365 | 2.8k | 2.5k | 0.76 | 7.50 | 5.2k | dream meadow |

## The incremental hook (first 10 h) and dead zones (whole run)

| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 12.5 | 100% | 100% | 100% | 0.98 h / 7 runs (at 2.12 h) | 0.98 h / 7 runs (at 2.12 h) | 0.23 h / 1 runs (at 1.57 h) |

("Payout covers": the run's coin payout alone buys the cheapest node that was open before it; gaps are the worst seed; a progress event = a board buy, an unlock, a pull or a hero level-up, earned or bought.)

## First 12 runs (mid, seed 3)

| Run | h | Stage | Result | Time | Kills | Coins | Gems | Bought | Board | Pulls | New |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.06 | dream meadow | death | 2:43 | 1432 | 49 | 524 | 5 (83) | 83 | 1 | main_character_aura |
| 2 | 0.11 | dream meadow | death | 2:37 | 2052 | 61 | 257 | 5 (120) | 203 | 1 | mochi, bubble_tea_cannon, idol_lightstick_wave |
| 3 | 0.20 | dream meadow | death | 4:32 | 2726 | 92 | 96 | 3 (94) | 297 | 1 | - |
| 4 | 0.25 | dream meadow | death | 2:24 | 1054 | 61 | 11 | 2 (58) | 355 | 1 | - |
| 5 | 0.34 | dream meadow | death | 4:11 | 3026 | 99 | 255 | 6 (206) | 561 | 1 | kotatsu_of_sloth, chibi_charm |
| 6 | 0.45 | dream meadow | death | 6:04 | 6530 | 183 | 569 | 5 (182) | 743 | 1 | rin, kuro, dark_flame_dragon, training_montage, friendship_bracelet |
| 7 | 0.58 | dream meadow | death | 6:49 | 3553 | 191 | 302 | 3 (178) | 921 | 11 | inner_monologue |
| 8 | 0.63 | dream meadow | death | 2:29 | 1285 | 69 | 21 | 2 (74) | 995 | 11 | - |
| 9 | 0.71 | dream meadow | death | 4:06 | 1298 | 99 | 10 | 1 (87) | 1082 | 11 | - |
| 10 | 0.81 | dream meadow | death | 5:05 | 3547 | 130 | 92 | 3 (144) | 1226 | 11 | - |
| 11 | 0.96 | dream meadow | death | 8:15 | 12319 | 278 | 207 | 5 (255) | 1481 | 11 | - |
| 12 | 1.15 | dream meadow | clear | 11:01 | 19697 | 683 | 1156 | 3 (698) | 2179 | 21 | pudding, candy_kingdom, teapot_tempest, budget_cuts, filler_overload, rushed_production, censored, cliffhanger, power_creep |

## Unlock timeline (median hours; n/r = not reached)

| Unlock | mid |
| --- | --- |
| main_character_aura | 0.06 |
| bubble_tea_cannon | 0.14 |
| mochi | 0.16 |
| idol_lightstick_wave | 0.31 |
| chibi_charm | 0.34 |
| kotatsu_of_sloth | 0.39 |
| rin | 0.44 |
| kuro | 0.44 |
| dark_flame_dragon | 0.44 |
| training_montage | 0.44 |
| friendship_bracelet | 0.44 |
| notice_me_sparkles | 0.56 |
| inner_monologue | 0.60 |
| pudding | 1.18 |
| candy_kingdom | 1.18 |
| teapot_tempest | 1.18 |
| budget_cuts | 1.18 |
| filler_overload | 1.18 |
| rushed_production | 1.18 |
| censored | 1.18 |
| cliffhanger | 1.18 |
| power_creep | 1.18 |
| plot_armor | 1.70 |

(8 accounts; 100 banked runs, 100 simulated; 1 min wall clock)
