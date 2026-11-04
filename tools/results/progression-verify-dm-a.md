# Progression verify-dm-a

`node tools/progression.mjs --bots mid --seeds 3-10 --hours 6 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-a.json --name verify-dm-a` (2026-11-03)

## Milestones (median hours (run) [min-max] over 8 seeds; --bots mid --seeds 3-10 --hours 6 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-a.json --name verify-dm-a)

| Milestone | Target | mid |
| --- | --- | --- |
| First board node | run 1 | 0.05 h (run 1) [0.04-0.11] |
| First Merch Machine pull | first hour | 0.05 h (run 1) [0.04-0.11] |
| First King Puff kill | runs 3-6 (0.5-1 h) | 0.29 h (run 3) [0.11-0.86] |
| Dream Meadow clear | 1.5-3 h | 1.15 h (run 11) [0.47-1.41] |
| Candy Kingdom clear | 4-7 h | not reached (1.15 h played) |
| Shoujo Academy clear | 8-14 h | not reached (1.15 h played) |
| Beach Episode clear | 15-25 h | not reached (1.15 h played) |
| Final Arc clear | 30-45 h | not reached (1.15 h played) |
| All gameplay heroes | - | not reached (1.15 h played) |
| All gameplay weapons | - | not reached (1.15 h played) |
| All passives | - | not reached (1.15 h played) |
| All gameplay heroes + weapons | 40-60 h | not reached (1.15 h played) |
| First 10-pull | - | 0.49 h (run 5) [0.19-0.91] |
| First SSR+ | - | 0.52 h (run 6) [0.24-1.31] +5 n/r |
| First UR+ | - | 1.31 h (run 10) [1.31-1.31] +7 n/r |
| First LR+ | - | not reached (1.15 h played) |
| First MYTHIC | - | not reached (1.15 h played) |
| 4 relic slots | - | not reached (1.15 h played) |
| Board ring 1 done | - | 1.02 h (run 9) [0.94-1.10] +6 n/r |
| Board ring 2 done | - | not reached (1.15 h played) |
| Board ring 3 done | - | not reached (1.15 h played) |
| Board ring 4 done | - | not reached (1.15 h played) |
| Board fully bought | 100-150 h | not reached (1.15 h played) |
| Main hero Lv 10 | ~3 h (P2) | not reached (1.15 h played) |
| Main hero Lv 20 | ~15 h (P4) | not reached (1.15 h played) |
| Main hero Lv 30 | ~80 h (P6) | not reached (1.15 h played) |
| Every gameplay hero Lv 30 | 200 h+ | not reached (1.15 h played) |
| A weapon mastery 5 | ~8 h (P3) | not reached (1.15 h played) |
| A weapon mastery 10 | ~80 h (P6) | not reached (1.15 h played) |
| Mastery 10 on all 20 | 200 h+ | not reached (1.15 h played) |
| Heat 8 clear | - | not reached (1.15 h played) |
| Heat 16 clear | - | not reached (1.15 h played) |
| Heat 32 clear | - | not reached (1.15 h played) |
| Max heat (41) clear | 200 h+ | not reached (1.15 h played) |

Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):

## Checkpoint snapshots (median over seeds) vs META.md §9.1

**mid**

| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 h | P1: 420, Lv 5, M 1/0, - | 1.9k | 5 | 1 / 2 | N:bent_spoon*0 (1) | C0 | 11 | 0/0/0/0/0 |

## Income per phase (median over seeds)

**mid**

| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-1 h | 9.9 | 5:18 | 225 | 2.0k | 3.2k | 1.21 | 7.27 | 3.9k | dream meadow |
| 1-3 h | 9.6 | 7:19 | 304 | 2.8k | 2.8k | 3.19 | 3.00 | 5.4k | dream meadow |

## The incremental hook (first 10 h) and dead zones (whole run)

| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 10.5 | 100% | 100% | 100% | 0.18 h / 2 runs (at 1.12 h) | 0.18 h / 2 runs (at 1.12 h) | 0.08 h / 1 runs (at 1.02 h) |

("Payout covers": the run's coin payout alone buys the cheapest node that was open before it; gaps are the worst seed; a progress event = a board buy, an unlock, a pull or a hero level-up, earned or bought.)

## First 12 runs (mid, seed 3)

| Run | h | Stage | Result | Time | Kills | Coins | Gems | Bought | Board | Pulls | New |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.11 | dream meadow | death | 6:04 | 5629 | 105 | 1297 | 10 (203) | 203 | 1 | rin, mochi, kuro, bubble_tea_cannon, dark_flame_dragon, idol_lightstick_wave, kotatsu_of_sloth, main_character_aura, training_montage, friendship_bracelet, chibi_charm |
| 2 | 0.18 | dream meadow | death | 3:04 | 1022 | 65 | 85 | 2 (58) | 261 | 1 | - |
| 3 | 0.25 | dream meadow | death | 3:39 | 2939 | 89 | 20 | 3 (94) | 355 | 1 | - |
| 4 | 0.30 | dream meadow | death | 2:16 | 1743 | 60 | 95 | 5 (157) | 512 | 1 | - |
| 5 | 0.39 | dream meadow | death | 4:34 | 3733 | 113 | 11 | 2 (112) | 624 | 1 | - |
| 6 | 0.47 | dream meadow | death | 3:58 | 2290 | 105 | 13 | 3 (109) | 733 | 1 | - |
| 7 | 0.52 | dream meadow | death | 2:04 | 1208 | 55 | 45 | 2 (49) | 782 | 1 | inner_monologue |
| 8 | 0.60 | dream meadow | death | 4:19 | 2621 | 107 | 10 | 2 (109) | 891 | 1 | - |
| 9 | 0.68 | dream meadow | death | 4:10 | 3445 | 94 | 78 | 2 (86) | 977 | 1 | - |
| 10 | 0.76 | dream meadow | death | 4:12 | 2524 | 106 | 10 | 2 (108) | 1085 | 1 | - |
| 11 | 0.91 | dream meadow | death | 7:54 | 5737 | 183 | 311 | 3 (197) | 1282 | 11 | - |
| 12 | 1.11 | dream meadow | death | 11:04 | 15153 | 319 | 479 | 5 (286) | 1568 | 11 | - |

## Unlock timeline (median hours; n/r = not reached)

| Unlock | mid |
| --- | --- |
| main_character_aura | 0.05 |
| bubble_tea_cannon | 0.14 |
| idol_lightstick_wave | 0.15 |
| mochi | 0.15 |
| kotatsu_of_sloth | 0.22 |
| chibi_charm | 0.25 |
| rin | 0.29 |
| kuro | 0.29 |
| dark_flame_dragon | 0.29 |
| training_montage | 0.29 |
| friendship_bracelet | 0.29 |
| notice_me_sparkles | 0.32 |
| henshin_burst | 0.45 |
| inner_monologue | 0.52 |
| pudding | 1.15 |
| candy_kingdom | 1.15 |
| teapot_tempest | 1.15 |
| budget_cuts | 1.15 |
| filler_overload | 1.15 |
| rushed_production | 1.15 |
| censored | 1.15 |
| cliffhanger | 1.15 |
| power_creep | 1.15 |

(8 accounts; 77 banked runs, 77 simulated; 1 min wall clock)
