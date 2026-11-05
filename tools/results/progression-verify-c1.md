# Progression verify-c1

`node tools/progression.mjs --bots mid --seeds 3-10 --hours 14 --stop-at 2 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-c1.json --name verify-c1` (2026-11-03)

## Milestones (median hours (run) [min-max] over 8 seeds; --bots mid --seeds 3-10 --hours 14 --stop-at 2 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-c1.json --name verify-c1)

| Milestone | Target | mid |
| --- | --- | --- |
| First board node | run 1 | 0.05 h (run 1) [0.04-0.21] |
| First Merch Machine pull | first hour | 0.05 h (run 1) [0.04-0.21] |
| First King Puff kill | runs 3-6 (0.5-1 h) | 0.26 h (run 4) [0.15-0.80] |
| Dream Meadow clear | 1.5-3 h | 1.41 h (run 15) [0.80-2.13] |
| Candy Kingdom clear | 4-7 h | 2.77 h (run 24) [1.29-4.19] |
| Shoujo Academy clear | 8-14 h | not reached (2.77 h played) |
| Beach Episode clear | 15-25 h | not reached (2.77 h played) |
| Final Arc clear | 30-45 h | not reached (2.77 h played) |
| All gameplay heroes | - | not reached (2.77 h played) |
| All gameplay weapons | - | not reached (2.77 h played) |
| All passives | - | 3.12 h (run 26) [2.68-3.95] +5 n/r |
| All gameplay heroes + weapons | 40-60 h | not reached (2.77 h played) |
| First 10-pull | - | 0.65 h (run 9) [0.26-0.98] |
| First SSR+ | - | 1.24 h (run 14) [0.46-3.95] +3 n/r |
| First UR+ | - | 2.74 h (run 24) [1.24-3.95] +4 n/r |
| First LR+ | - | 3.95 h (run 32) [3.95-3.95] +7 n/r |
| First MYTHIC | - | not reached (2.77 h played) |
| 4 relic slots | - | not reached (2.77 h played) |
| Board ring 1 done | - | 1.27 h (run 13) [1.04-1.41] +1 n/r |
| Board ring 2 done | - | not reached (2.77 h played) |
| Board ring 3 done | - | not reached (2.77 h played) |
| Board ring 4 done | - | not reached (2.77 h played) |
| Board fully bought | 100-150 h | not reached (2.77 h played) |
| Main hero Lv 10 | ~3 h (P2) | 3.57 h (run 30) [3.57-3.57] +7 n/r |
| Main hero Lv 20 | ~15 h (P4) | not reached (2.77 h played) |
| Main hero Lv 30 | ~80 h (P6) | not reached (2.77 h played) |
| Every gameplay hero Lv 30 | 200 h+ | not reached (2.77 h played) |
| A weapon mastery 5 | ~8 h (P3) | not reached (2.77 h played) |
| A weapon mastery 10 | ~80 h (P6) | not reached (2.77 h played) |
| Mastery 10 on all 20 | 200 h+ | not reached (2.77 h played) |
| Heat 8 clear | - | not reached (2.77 h played) |
| Heat 16 clear | - | not reached (2.77 h played) |
| Heat 32 clear | - | not reached (2.77 h played) |
| Max heat (41) clear | 200 h+ | not reached (2.77 h played) |

Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):

## Checkpoint snapshots (median over seeds) vs META.md §9.1

**mid**

| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 h | P1: 420, Lv 5, M 1/0, - | 1.7k | 5 | 2 / 1.5 | SR:mecha_model_kit*0 SR:pity_keychain*0 (2) | C0 | 11 | 1/0/0/0/0 |
| 3 h | P2: 1.9k, Lv 10, M 3/1, 1 R | 6.1k | 9 | 3 / 2 | SSR:protagonist_scarf*0 SR:mascot_head*0 (2) | C0 | 21 | 1/0/0/0/0 |

## Income per phase (median over seeds)

**mid**

| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-1 h | 12.1 | 4:12 | 147 | 1.6k | 2.7k | 1.16 | 9.55 | 3.7k | dream meadow |
| 1-3 h | 7.4 | 7:52 | 383 | 2.8k | 1.6k | 0.83 | 7.50 | 4.8k | candy kingdom |
| 3-8 h | 5.9 | 10:28 | 514 | 3.4k | 1.4k | 0.84 | 5.00 | 4.9k | candy kingdom |

## The incremental hook (first 10 h) and dead zones (whole run)

| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 24 | 93% | 91% | 91% | 0.72 h / 5 runs (at 1.94 h) | 0.72 h / 5 runs (at 1.94 h) | 0.12 h / 1 runs (at 1.64 h) |

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
| henshin_burst | 0.78 |
| notice_me_sparkles | 0.78 |
| kotatsu_of_sloth | 0.80 |
| cheat_fireball | 1.28 |
| pudding | 1.41 |
| candy_kingdom | 1.41 |
| teapot_tempest | 1.41 |
| budget_cuts | 1.41 |
| filler_overload | 1.41 |
| rushed_production | 1.41 |
| censored | 1.41 |
| cliffhanger | 1.41 |
| power_creep | 1.41 |
| plot_armor | 1.92 |
| speed_lines | 2.76 |
| aoi | 2.77 |
| shoujo_academy | 2.77 |
| micro_missile_swarm | 2.77 |
| mid_season_break | 2.77 |
| dub_version | 2.77 |
| spoilers | 2.77 |
| bento_box | 3.04 |

(8 accounts; 188 banked runs, 188 simulated; 3 min wall clock)
