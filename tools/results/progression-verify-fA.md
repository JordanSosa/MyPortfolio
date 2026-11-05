# Progression verify-fA

`node tools/progression.mjs --bots mid --seeds 3-6 --hours 60 --stop-at final --workers 2 --resume-dir /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/saves-a1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-fA.json --name verify-fA` (2026-11-04)

## Milestones (median hours (run) [min-max] over 4 seeds; --bots mid --seeds 3-6 --hours 60 --stop-at final --workers 2 --resume-dir /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/saves-a1 --patch /tmp/claude-0/-home-user-MyPortfolio/26872faf-ce0b-5b43-87b8-c1b9eff408d5/scratchpad/verify/p-fA.json --name verify-fA)

| Milestone | Target | mid |
| --- | --- | --- |
| First board node | run 1 | 0.04 h (run 1) [0.04-0.05] |
| First Merch Machine pull | first hour | 0.04 h (run 1) [0.04-0.05] |
| First King Puff kill | runs 3-6 (0.5-1 h) | 0.34 h (run 5) [0.19-0.60] |
| Dream Meadow clear | 1.5-3 h | 1.41 h (run 15) [0.97-2.13] |
| Candy Kingdom clear | 4-7 h | 4.70 h (run 39) [2.67-5.46] |
| Shoujo Academy clear | 8-14 h | 13.3 h (run 94) [6.59-16.2] |
| Beach Episode clear | 15-25 h | 20.6 h (run 140) [18.7-23.4] |
| Final Arc clear | 30-45 h | 26.1 h (run 175) [22.0-29.2] |
| All gameplay heroes | - | 13.3 h (run 94) [6.59-16.2] |
| All gameplay weapons | - | not reached (26.1 h played) |
| All passives | - | 3.80 h (run 36) [2.86-4.53] |
| All gameplay heroes + weapons | 40-60 h | not reached (26.1 h played) |
| First 10-pull | - | 0.65 h (run 9) [0.51-0.83] |
| First SSR+ | - | 2.82 h (run 26) [0.71-5.92] |
| First UR+ | - | 12.5 h (run 91) [2.13-22.8] +2 n/r |
| First LR+ | - | not reached (26.1 h played) |
| First MYTHIC | - | not reached (26.1 h played) |
| 4 relic slots | - | not reached (26.1 h played) |
| Board ring 1 done | - | 1.25 h (run 15) [1.04-1.41] |
| Board ring 2 done | - | 8.72 h (run 70) [8.49-9.13] |
| Board ring 3 done | - | not reached (26.1 h played) |
| Board ring 4 done | - | not reached (26.1 h played) |
| Board fully bought | 100-150 h | not reached (26.1 h played) |
| Main hero Lv 10 | ~3 h (P2) | 3.62 h (run 33) [3.36-3.88] |
| Main hero Lv 20 | ~15 h (P4) | 22.2 h (run 156) [21.9-22.8] |
| Main hero Lv 30 | ~80 h (P6) | not reached (26.1 h played) |
| Every gameplay hero Lv 30 | 200 h+ | not reached (26.1 h played) |
| A weapon mastery 5 | ~8 h (P3) | 6.11 h (run 52) [5.90-6.59] |
| A weapon mastery 10 | ~80 h (P6) | not reached (26.1 h played) |
| Mastery 10 on all 20 | 200 h+ | not reached (26.1 h played) |
| Heat 8 clear | - | not reached (26.1 h played) |
| Heat 16 clear | - | not reached (26.1 h played) |
| Heat 32 clear | - | not reached (26.1 h played) |
| Max heat (41) clear | 200 h+ | not reached (26.1 h played) |

Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):

## Checkpoint snapshots (median over seeds) vs META.md §9.1

**mid**

| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 8 h | P3: 20k, Lv 15, M 5/2, SSR + SR | 24k | 13 | 5 / 4 | SSR:protagonist_scarf*1 SR:mascot_head*1 (2) | C0 | 51 | 4/1/2/0/0 |
| 15 h | P4: 84k, Lv 20, M 7/4, 2 SSR + SR | 61k | 17 | 6 / 4.5 | UR:hot_blooded_bandana*0 SR:magnifying_glass*1 SR:cosplay_wig*0 (3) | C0 | 61 | 1/4/2/0/0 |

## Income per phase (median over seeds)

**mid**

| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3-8 h | 9.1 | 5:51 | 531 | 4.8k | 337 | 0.76 | 12.0 | 5.4k | beach episode |
| 8-15 h | 7.1 | 7:44 | 829 | 5.9k | 375 | 0.19 | 39.5 | 5.0k | beach episode |
| 15-30 h | 5.7 | 9:52 | 1.5k | 7.9k | 753 | 0.44 | 12.8 | 6.1k | beach episode |

## The incremental hook (first 10 h) and dead zones (whole run)

| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mid | 0 | 0% | 0% | 0% | 0.25 h / 2 runs (at 9.47 h) | 16.3 h / 1 runs (at 16.3 h) | 0.44 h / 2 runs (at 19.9 h) |

("Payout covers": the run's coin payout alone buys the cheapest node that was open before it; gaps are the worst seed; a progress event = a board buy, an unlock, a pull or a hero level-up, earned or bought.)

## First 12 runs (mid, seed 3)

| Run | h | Stage | Result | Time | Kills | Coins | Gems | Bought | Board | Pulls | New |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 117 | 16.3 | beach episode | death | 5:52 | 307 | 806 | 76 | 0 (0) | 56817 | 61 | - |
| 118 | 16.4 | beach episode | death | 6:34 | 647 | 913 | 192 | 1 (1950) | 58767 | 61 | - |
| 119 | 16.5 | beach episode | death | 5:22 | 1194 | 759 | 31 | 0 (0) | 58767 | 61 | - |
| 120 | 16.8 | shoujo academy | death | 16:05 | 17291 | 1145 | 48 | 1 (1950) | 60717 | 61 | - |
| 121 | 16.9 | beach episode | death | 4:34 | 759 | 664 | 29 | 0 (0) | 60717 | 61 | - |
| 122 | 17.1 | shoujo academy | death | 8:23 | 6559 | 485 | 30 | 0 (0) | 60717 | 61 | - |
| 123 | 17.2 | beach episode | death | 8:42 | 4035 | 1178 | 50 | 1 (2175) | 62892 | 61 | - |
| 124 | 17.3 | beach episode | death | 4:49 | 1763 | 703 | 29 | 0 (0) | 62892 | 61 | - |
| 125 | 17.6 | shoujo academy | clear | 15:50 | 26696 | 1558 | 113 | 1 (2325) | 65217 | 61 | - |
| 126 | 17.7 | beach episode | death | 4:52 | 1448 | 709 | 29 | 0 (0) | 65217 | 61 | - |
| 127 | 17.9 | shoujo academy | death | 13:23 | 4497 | 675 | 542 | 0 (0) | 65217 | 61 | - |
| 128 | 18.0 | beach episode | death | 6:44 | 1127 | 877 | 40 | 1 (2175) | 67392 | 61 | - |

## Unlock timeline (median hours; n/r = not reached)

| Unlock | mid |
| --- | --- |
| cheat_fireball | 20.3 |
| final_arc | 20.6 |
| studio_change | 20.6 |
| shounen_rival | 20.6 |
| simulcast_delay | 26.1 |
| sequel_hook | 26.1 |
| notice_me_sparkles | 26.9 |

(4 accounts; 323 banked runs, 679 simulated; 38 min wall clock)
