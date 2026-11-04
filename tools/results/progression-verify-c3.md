# Progression verify-c3

`node tools/progression.mjs --bots mid --seeds 3-10 --hours 16 --stop-at 2 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-c3.json --name verify-c3` (2026-11-03)

## Milestones (median hours (run) [min-max] over 8 seeds; --bots mid --seeds 3-10 --hours 16 --stop-at 2 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-c3.json --name verify-c3)

| Milestone | Target | mid |
| --- | --- | --- |
| First board node | run 1 | 0.05 h (run 1) [0.04-0.21] |
| First Merch Machine pull | first hour | 0.05 h (run 1) [0.04-0.21] |
| First King Puff kill | runs 3-6 (0.5-1 h) | 0.26 h (run 4) [0.15-0.80] |
| Dream Meadow clear | 1.5-3 h | 1.41 h (run 15) [0.80-2.13] |
| Candy Kingdom clear | 4-7 h | 3.64 h (run 29) [1.87-6.06] |
| Shoujo Academy clear | 8-14 h | not reached (3.64 h played) |
| Beach Episode clear | 15-25 h | not reached (3.64 h played) |
| Final Arc clear | 30-45 h | not reached (3.64 h played) |
| All gameplay heroes | - | not reached (3.64 h played) |
| All gameplay weapons | - | not reached (3.64 h played) |
| All passives | - | 3.96 h (run 34) [2.86-4.31] +3 n/r |
| All gameplay heroes + weapons | 40-60 h | not reached (3.64 h played) |
| First 10-pull | - | 0.65 h (run 9) [0.26-0.98] |
| First SSR+ | - | 1.66 h (run 18) [0.46-4.31] +2 n/r |
| First UR+ | - | 3.09 h (run 27) [1.19-4.31] +4 n/r |
| First LR+ | - | 4.31 h (run 35) [4.31-4.31] +7 n/r |
| First MYTHIC | - | not reached (3.64 h played) |
| 4 relic slots | - | not reached (3.64 h played) |
| Board ring 1 done | - | 1.26 h (run 14) [1.04-1.57] |
| Board ring 2 done | - | not reached (3.64 h played) |
| Board ring 3 done | - | not reached (3.64 h played) |
| Board ring 4 done | - | not reached (3.64 h played) |
| Board fully bought | 100-150 h | not reached (3.64 h played) |
| Main hero Lv 10 | ~3 h (P2) | 3.47 h (run 30) [3.23-3.60] +4 n/r |
| Main hero Lv 20 | ~15 h (P4) | not reached (3.64 h played) |
| Main hero Lv 30 | ~80 h (P6) | not reached (3.64 h played) |
| Every gameplay hero Lv 30 | 200 h+ | not reached (3.64 h played) |
| A weapon mastery 5 | ~8 h (P3) | 6.06 h (run 44) [6.06-6.06] +7 n/r |
| A weapon mastery 10 | ~80 h (P6) | not reached (3.64 h played) |
| Mastery 10 on all 20 | 200 h+ | not reached (3.64 h played) |
| Heat 8 clear | - | not reached (3.64 h played) |
| Heat 16 clear | - | not reached (3.64 h played) |
| Heat 32 clear | - | not reached (3.64 h played) |
| Max heat (41) clear | 200 h+ | not reached (3.64 h played) |

Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):

## Checkpoint snapshots (median over seeds) vs META.md §9.1

**mid**

| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 h | P1: 420, Lv 5, M 1/0, - | 1.7k | 5 | 2 / 1.5 | SR:mecha_model_kit*0 R:smudged_poster*1 (2) | C0 | 11 | 1/0/0/0/0 |
| 3 h | P2: 1.9k, Lv 10, M 3/1, 1 R | 6.8k | 9 | 3.5 / 3 | SR:light_novel_vol1*0 SR:mascot_head*0 (2) | C0 | 26 | 4/1/0/0/0 |

## Income per phase (median over seeds)

**mid**

| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-1 h | 12.1 | 4:12 | 145 | 1.6k | 2.7k | 1.16 | 9.55 | 3.7k | dream meadow |
| 1-3 h | 8.2 | 6:39 | 324 | 2.7k | 1.4k | 0.77 | 8.00 | 4.6k | candy kingdom |
| 3-8 h | 6.1 | 9:39 | 499 | 3.0k | 930 | 0.48 | 9.00 | 4.6k | candy kingdom |

## The incremental hook (first 10 h) and dead zones (whole run)

| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 29 | 74% | 85% | 85% | 0.72 h / 5 runs (at 1.94 h) | 0.72 h / 5 runs (at 1.94 h) | 0.13 h / 1 runs (at 3.81 h) |

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
| 9 | 0.60 | dream meadow | death | 11:16 | 17907 | 369 | 1610 | 10 (468) | 995 | 11 | rin, kuro, dark_flame_dragon, kotatsu_of_sloth, inner_monologue, training_montage, friendship_bracelet |
| 10 | 0.69 | dream meadow | death | 4:38 | 3035 | 115 | 11 | 2 (110) | 1105 | 11 | - |
| 11 | 0.76 | dream meadow | death | 3:23 | 1580 | 107 | 70 | 1 (87) | 1192 | 11 | - |
| 12 | 0.97 | dream meadow | clear | 11:53 | 18898 | 499 | 770 | 7 (509) | 1701 | 21 | pudding, candy_kingdom, teapot_tempest, budget_cuts, filler_overload, rushed_production, censored, cliffhanger, power_creep |

## Unlock timeline (median hours; n/r = not reached)

| Unlock | mid |
| --- | --- |
| main_character_aura | 0.05 |
| bubble_tea_cannon | 0.15 |
| mochi | 0.17 |
| idol_lightstick_wave | 0.22 |
| chibi_charm | 0.23 |
| training_montage | 0.23 |
| rin | 0.26 |
| kuro | 0.26 |
| dark_flame_dragon | 0.26 |
| friendship_bracelet | 0.26 |
| inner_monologue | 0.54 |
| notice_me_sparkles | 0.78 |
| kotatsu_of_sloth | 0.80 |
| pudding | 1.41 |
| candy_kingdom | 1.41 |
| teapot_tempest | 1.41 |
| budget_cuts | 1.41 |
| filler_overload | 1.41 |
| rushed_production | 1.41 |
| censored | 1.41 |
| cliffhanger | 1.41 |
| power_creep | 1.41 |
| plot_armor | 1.94 |
| henshin_burst | 2.62 |
| speed_lines | 2.93 |
| aoi | 3.64 |
| shoujo_academy | 3.64 |
| micro_missile_swarm | 3.64 |
| mid_season_break | 3.64 |
| dub_version | 3.64 |
| spoilers | 3.64 |
| bento_box | 3.90 |

(8 accounts; 253 banked runs, 253 simulated; 5 min wall clock)
