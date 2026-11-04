# Progression verify-dm-d

`node tools/progression.mjs --bots mid --seeds 3-10 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-d.json --name verify-dm-d` (2026-11-03)

## Milestones (median hours (run) [min-max] over 8 seeds; --bots mid --seeds 3-10 --hours 8 --stop-at 1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-dm-d.json --name verify-dm-d)

| Milestone | Target | mid |
| --- | --- | --- |
| First board node | run 1 | 0.05 h (run 1) [0.04-0.08] |
| First Merch Machine pull | first hour | 0.05 h (run 1) [0.04-0.08] |
| First King Puff kill | runs 3-6 (0.5-1 h) | 0.55 h (run 8) [0.25-0.75] |
| Dream Meadow clear | 1.5-3 h | 1.09 h (run 11) [0.67-1.62] |
| Candy Kingdom clear | 4-7 h | not reached (1.09 h played) |
| Shoujo Academy clear | 8-14 h | not reached (1.09 h played) |
| Beach Episode clear | 15-25 h | not reached (1.09 h played) |
| Final Arc clear | 30-45 h | not reached (1.09 h played) |
| All gameplay heroes | - | not reached (1.09 h played) |
| All gameplay weapons | - | not reached (1.09 h played) |
| All passives | - | not reached (1.09 h played) |
| All gameplay heroes + weapons | 40-60 h | not reached (1.09 h played) |
| First 10-pull | - | 0.57 h (run 8) [0.33-0.75] |
| First SSR+ | - | 0.75 h (run 9) [0.34-1.12] +5 n/r |
| First UR+ | - | 1.12 h (run 10) [1.12-1.12] +7 n/r |
| First LR+ | - | not reached (1.09 h played) |
| First MYTHIC | - | not reached (1.09 h played) |
| 4 relic slots | - | not reached (1.09 h played) |
| Board ring 1 done | - | 1.13 h (run 15) [1.08-1.31] +5 n/r |
| Board ring 2 done | - | not reached (1.09 h played) |
| Board ring 3 done | - | not reached (1.09 h played) |
| Board ring 4 done | - | not reached (1.09 h played) |
| Board fully bought | 100-150 h | not reached (1.09 h played) |
| Main hero Lv 10 | ~3 h (P2) | not reached (1.09 h played) |
| Main hero Lv 20 | ~15 h (P4) | not reached (1.09 h played) |
| Main hero Lv 30 | ~80 h (P6) | not reached (1.09 h played) |
| Every gameplay hero Lv 30 | 200 h+ | not reached (1.09 h played) |
| A weapon mastery 5 | ~8 h (P3) | not reached (1.09 h played) |
| A weapon mastery 10 | ~80 h (P6) | not reached (1.09 h played) |
| Mastery 10 on all 20 | 200 h+ | not reached (1.09 h played) |
| Heat 8 clear | - | not reached (1.09 h played) |
| Heat 16 clear | - | not reached (1.09 h played) |
| Heat 32 clear | - | not reached (1.09 h played) |
| Max heat (41) clear | 200 h+ | not reached (1.09 h played) |

Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):

## Checkpoint snapshots (median over seeds) vs META.md §9.1

**mid**

| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 h | P1: 420, Lv 5, M 1/0, - | 2.0k | 5.5 | 2 / 2 | SR:cosplay_wig*0 (1) | C0 | 16 | 0/0/0/0/0 |

## Income per phase (median over seeds)

**mid**

| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-1 h | 11.9 | 4:17 | 155 | 1.8k | 2.9k | 1.22 | 9.09 | 4.1k | dream meadow |
| 1-3 h | 7.2 | 9:39 | 530 | 3.0k | 1.9k | 1.61 | 3.50 | 5.1k | dream meadow |

## The incremental hook (first 10 h) and dead zones (whole run)

| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 11 | 100% | 100% | 100% | 0.30 h / 2 runs (at 1.44 h) | 0.30 h / 2 runs (at 1.44 h) | 0.16 h / 1 runs (at 1.29 h) |

("Payout covers": the run's coin payout alone buys the cheapest node that was open before it; gaps are the worst seed; a progress event = a board buy, an unlock, a pull or a hero level-up, earned or bought.)

## First 12 runs (mid, seed 3)

| Run | h | Stage | Result | Time | Kills | Coins | Gems | Bought | Board | Pulls | New |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.05 | dream meadow | death | 2:09 | 1017 | 43 | 518 | 5 (83) | 83 | 1 | main_character_aura |
| 2 | 0.09 | dream meadow | death | 1:47 | 1087 | 39 | 7 | 2 (38) | 121 | 1 | - |
| 3 | 0.14 | dream meadow | death | 2:08 | 780 | 47 | 55 | 4 (104) | 225 | 1 | bubble_tea_cannon |
| 4 | 0.21 | dream meadow | death | 3:45 | 2205 | 87 | 58 | 3 (87) | 312 | 1 | mochi |
| 5 | 0.24 | dream meadow | death | 0:51 | 383 | 21 | 11 | 1 (22) | 334 | 1 | - |
| 6 | 0.28 | dream meadow | death | 1:31 | 704 | 44 | 9 | 1 (36) | 370 | 1 | - |
| 7 | 0.33 | dream meadow | death | 2:33 | 1829 | 69 | 18 | 2 (79) | 449 | 1 | - |
| 8 | 0.41 | dream meadow | death | 3:50 | 2955 | 98 | 311 | 5 (190) | 639 | 1 | idol_lightstick_wave, kotatsu_of_sloth, chibi_charm |
| 9 | 0.62 | dream meadow | death | 11:38 | 22824 | 569 | 1650 | 11 (564) | 1203 | 11 | rin, kuro, dark_flame_dragon, inner_monologue, training_montage, friendship_bracelet |
| 10 | 0.82 | dream meadow | death | 11:23 | 12959 | 376 | 210 | 7 (365) | 1568 | 11 | - |
| 11 | 1.03 | dream meadow | clear | 11:43 | 19285 | 540 | 708 | 4 (557) | 2125 | 21 | pudding, candy_kingdom, teapot_tempest, budget_cuts, filler_overload, rushed_production, censored, cliffhanger, power_creep |

## Unlock timeline (median hours; n/r = not reached)

| Unlock | mid |
| --- | --- |
| main_character_aura | 0.05 |
| bubble_tea_cannon | 0.16 |
| mochi | 0.21 |
| idol_lightstick_wave | 0.30 |
| kotatsu_of_sloth | 0.36 |
| notice_me_sparkles | 0.41 |
| chibi_charm | 0.47 |
| rin | 0.55 |
| kuro | 0.55 |
| dark_flame_dragon | 0.55 |
| training_montage | 0.55 |
| friendship_bracelet | 0.55 |
| inner_monologue | 0.58 |
| pudding | 1.09 |
| candy_kingdom | 1.09 |
| teapot_tempest | 1.09 |
| budget_cuts | 1.09 |
| filler_overload | 1.09 |
| rushed_production | 1.09 |
| censored | 1.09 |
| cliffhanger | 1.09 |
| power_creep | 1.09 |

(8 accounts; 96 banked runs, 96 simulated; 1 min wall clock)
