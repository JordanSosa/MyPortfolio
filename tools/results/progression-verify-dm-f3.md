# Progression verify-dm-f3

`node tools/progression.mjs --bots mid --seeds 3-14 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-f3.json --name verify-dm-f3` (2026-11-03)

## Milestones (median hours (run) [min-max] over 12 seeds; --bots mid --seeds 3-14 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-f3.json --name verify-dm-f3)

| Milestone | Target | mid |
| --- | --- | --- |
| First board node | run 1 | 0.05 h (run 1) [0.02-0.06] |
| First Merch Machine pull | first hour | 0.05 h (run 1) [0.02-0.06] |
| First King Puff kill | runs 3-6 (0.5-1 h) | 0.50 h (run 7) [0.16-0.95] |
| Dream Meadow clear | 1.5-3 h | 1.19 h (run 14) [0.40-2.04] |
| Candy Kingdom clear | 4-7 h | not reached (1.19 h played) |
| Shoujo Academy clear | 8-14 h | not reached (1.19 h played) |
| Beach Episode clear | 15-25 h | not reached (1.19 h played) |
| Final Arc clear | 30-45 h | not reached (1.19 h played) |
| All gameplay heroes | - | not reached (1.19 h played) |
| All gameplay weapons | - | not reached (1.19 h played) |
| All passives | - | not reached (1.19 h played) |
| All gameplay heroes + weapons | 40-60 h | not reached (1.19 h played) |
| First 10-pull | - | 0.68 h (run 9) [0.20-0.97] |
| First SSR+ | - | 0.78 h (run 10) [0.29-1.81] +5 n/r |
| First UR+ | - | 1.39 h (run 16) [0.96-1.81] +10 n/r |
| First LR+ | - | not reached (1.19 h played) |
| First MYTHIC | - | not reached (1.19 h played) |
| 4 relic slots | - | not reached (1.19 h played) |
| Board ring 1 done | - | 1.27 h (run 14) [1.03-1.32] +8 n/r |
| Board ring 2 done | - | not reached (1.19 h played) |
| Board ring 3 done | - | not reached (1.19 h played) |
| Board ring 4 done | - | not reached (1.19 h played) |
| Board fully bought | 100-150 h | not reached (1.19 h played) |
| Main hero Lv 10 | ~3 h (P2) | not reached (1.19 h played) |
| Main hero Lv 20 | ~15 h (P4) | not reached (1.19 h played) |
| Main hero Lv 30 | ~80 h (P6) | not reached (1.19 h played) |
| Every gameplay hero Lv 30 | 200 h+ | not reached (1.19 h played) |
| A weapon mastery 5 | ~8 h (P3) | not reached (1.19 h played) |
| A weapon mastery 10 | ~80 h (P6) | not reached (1.19 h played) |
| Mastery 10 on all 20 | 200 h+ | not reached (1.19 h played) |
| Heat 8 clear | - | not reached (1.19 h played) |
| Heat 16 clear | - | not reached (1.19 h played) |
| Heat 32 clear | - | not reached (1.19 h played) |
| Max heat (41) clear | 200 h+ | not reached (1.19 h played) |

Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):

## Checkpoint snapshots (median over seeds) vs META.md §9.1

**mid**

| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 h | P1: 420, Lv 5, M 1/0, - | 1.6k | 5 | 2 / 1.5 | R:pocket_tissues*1 (1) | C0 | 11 | 0/0/0/0/0 |

## Income per phase (median over seeds)

**mid**

| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-1 h | 12.5 | 4:04 | 131 | 1.6k | 2.7k | 1.24 | 10.0 | 4.1k | dream meadow |
| 1-3 h | 7.7 | 8:11 | 352 | 2.7k | 2.2k | 1.15 | 7.00 | 5.1k | dream meadow |

## The incremental hook (first 10 h) and dead zones (whole run)

| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 13.5 | 100% | 100% | 100% | 0.82 h / 6 runs (at 1.85 h) | 0.82 h / 6 runs (at 1.85 h) | 0.21 h / 1 runs (at 1.57 h) |

("Payout covers": the run's coin payout alone buys the cheapest node that was open before it; gaps are the worst seed; a progress event = a board buy, an unlock, a pull or a hero level-up, earned or bought.)

## First 12 runs (mid, seed 3)

| Run | h | Stage | Result | Time | Kills | Coins | Gems | Bought | Board | Pulls | New |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.05 | dream meadow | death | 2:06 | 1171 | 39 | 518 | 5 (75) | 75 | 1 | main_character_aura |
| 2 | 0.11 | dream meadow | death | 2:55 | 1085 | 67 | 36 | 3 (69) | 144 | 1 | - |
| 3 | 0.15 | dream meadow | death | 1:53 | 724 | 43 | 55 | 4 (103) | 247 | 1 | bubble_tea_cannon |
| 4 | 0.20 | dream meadow | death | 2:14 | 1638 | 63 | 257 | 2 (59) | 306 | 1 | mochi, idol_lightstick_wave |
| 5 | 0.25 | dream meadow | death | 2:18 | 1330 | 55 | 17 | 2 (58) | 364 | 1 | - |
| 6 | 0.33 | dream meadow | death | 3:53 | 2829 | 108 | 61 | 3 (107) | 471 | 1 | - |
| 7 | 0.42 | dream meadow | death | 4:55 | 5151 | 122 | 536 | 6 (224) | 695 | 1 | rin, kotatsu_of_sloth, training_montage, chibi_charm |
| 8 | 0.51 | dream meadow | death | 4:05 | 794 | 99 | 15 | 3 (98) | 793 | 1 | - |
| 9 | 0.58 | dream meadow | death | 3:35 | 2139 | 108 | 39 | 1 (87) | 880 | 1 | inner_monologue |
| 10 | 0.66 | dream meadow | death | 4:29 | 1563 | 114 | 12 | 3 (138) | 1018 | 1 | - |
| 11 | 0.76 | dream meadow | death | 4:58 | 2597 | 117 | 12 | 1 (87) | 1105 | 1 | - |
| 12 | 0.97 | dream meadow | clear | 11:44 | 18861 | 465 | 1668 | 8 (463) | 1568 | 11 | kuro, pudding, candy_kingdom, dark_flame_dragon, teapot_tempest, friendship_bracelet, budget_cuts, filler_overload, rushed_production, censored, cliffhanger, power_creep |

## Unlock timeline (median hours; n/r = not reached)

| Unlock | mid |
| --- | --- |
| main_character_aura | 0.05 |
| bubble_tea_cannon | 0.16 |
| mochi | 0.17 |
| idol_lightstick_wave | 0.20 |
| chibi_charm | 0.38 |
| rin | 0.50 |
| training_montage | 0.57 |
| inner_monologue | 0.58 |
| kuro | 0.61 |
| dark_flame_dragon | 0.61 |
| friendship_bracelet | 0.65 |
| kotatsu_of_sloth | 0.65 |
| notice_me_sparkles | 0.75 |
| pudding | 1.19 |
| candy_kingdom | 1.19 |
| teapot_tempest | 1.19 |
| budget_cuts | 1.19 |
| filler_overload | 1.19 |
| rushed_production | 1.19 |
| censored | 1.19 |
| cliffhanger | 1.19 |
| power_creep | 1.19 |
| plot_armor | 1.94 |

(12 accounts; 165 banked runs, 165 simulated; 2 min wall clock)
