# Meta layer (Season 2 account progression)

`src/meta` is the PURE account layer of Season 2 (docs/EXPANSION.md §2-§14):
profile, save migration, economy, the Training Arc board, hero levels /
talents / constellations, the Merch Machine (parody gacha), achievements
("Plot Points"), unlock rules, the codex, the loadout -> RunConfig builder and
`applyRunToProfile`. No DOM, no localStorage, no audio: it runs in Vitest and in
the headless progression simulator. `src/ui/save.ts` is the only storage
boundary. Content names and numbers come from the content bible
(`docs/content/`); every tunable number lives in `src/meta/tuning.ts`.

```
            src/ui/save.ts (kko.save.v2, the only storage boundary)
                 │  sanitizeProfile + reconcileProfile at boot, migrateV1, export / import
                 ▼
  Profile ──buildRunConfig(profile, choice)──▶ { hero, config: RunConfig } ──▶ new World({ hero, run })
     ▲                                                                            │
     └──────────── applyRunToProfile(profile, world.summary()) ◀── RunSummary.stats (RunStats)
                         └─▶ RunReport (results v2 screen)
```

## 1. Module map

| File | What |
| --- | --- |
| `tuning.ts` | **Every tunable number**: payout, grade, hero XP curve, mastery curve, board costs, relic slots, rotation, gacha rates / pity / Copium, Copium Exchange prices, Gem Exchange, codex bounties, migration gift. The economy also reads the stages' Ratings (`StageDef.rewardMul`), the Plot Point rewards (`achievements/defs`) and the in-run coin sources (`CFG.coinDropChance` ... `chestCoinsGolden`). |
| `profile.ts` | `Profile` type (version 2), `defaultProfile()`, `sanitizeProfile(raw)` (field-by-field repair, never throws), `Settings` (unchanged from v1), `setFlag`. |
| `reconcile.ts` | `reconcileProfile(p, ctx)`: content-aware repair (levels from XP, talents vs trees and points, unknown board nodes refunded, keystone slots, pity caps, loadout made playable) + start / newly-met unlocks. |
| `content.ts` | `MetaContent` catalogue (heroes, weapons, passives, enemies, bosses, stages, relics, talent trees, twists) from the `src/game` registries (`gameContent()`), or `makeContent(parts)` for tests. Every meta function takes an optional `ctx`. |
| `roster.ts` | The 11 Season 2 heroes: how each is obtained (start / play / gacha / mythic) and its gacha rarity. |
| `legacy.ts` | Frozen save v1: types, defaults, validator, old Dream Shop prices, `migrateV1`. |
| `transfer.ts` | Export / import string `KKO2.<base64>.<crc32>` (own base64 / UTF-8 / CRC-32). |
| `economy.ts` | Results grade, `computePayout` (line items), hero XP / level curve, mastery ranks, talent respec and level-accelerator costs, Gem Exchange quote. |
| `heroes.ts` | Hero XP -> levels -> talent points, allocate / refund / reset / repair talents (tier gating = `TALENT_TIER_POINTS`), coin level accelerator, constellations from copies. |
| `board/` | Training Arc: `data.ts` (6 sectors x 5 rings = 120 nodes, 10 keystones), `graph.ts` (layout, edges, costs), `board.ts` (gating, buy / refund / respec, keystone slots, auto-path, `applyBoard`, the v1 Dream Shop shim). |
| `gacha/` | Merch Machine: `rates.ts` (allocation-free rarity roller with soft / hard / UR pity and the 10-pull floor), `banners.ts` (banners, pools, featured rotation, banner names), `engine.ts` (`pull`, 50/50, dupes, Copium, history, spark), `exchange.ts` (Copium Exchange, Gem Exchange). |
| `achievements/` | Plot Points: `types.ts`, `registry.ts` (`import.meta.glob("./defs/*.ts")`), `defs/*.ts` (one file per category group), `engine.ts` (evaluate, claim, views, in-run `AchievementWatch`). |
| `unlocks.ts` | `UNLOCK_RULES` (content id -> condition + codex hint), `evaluateUnlocks`, `unlockStatus` (progress for "???" entries), `grantUnlock`. |
| `codex.ts` | Discovery + gem bounties, per-tab progress. |
| `loadout.ts` | `resolveLoadout` / `validateLoadout` (locked stage / hero / twist, relic slots, ownership), `buildRunConfig`, `twistHeat`, `relicSlots`. |
| `rewards.ts` | `applyRunToProfile(profile, summary)` -> `RunReport`. |
| `index.ts` | Barrel (`import { ... } from "../meta"`). |

## 2. The profile (save v2)

`localStorage['kko.save.v2']` holds one plain-JSON `Profile`:

| Field | Holds |
| --- | --- |
| `currencies` | `coins` (★ Star Coins), `gems` (♦ Dream Gems), `copium` |
| `unlocks` | `heroes, weapons, passives, stages, twists` (ids) and `relicSlots` (extra slots from non-board sources) |
| `board` | `ranks` (node -> rank), `paid` (node -> coins paid: exact refunds), `active` (keystones switched on), `respecs` |
| `heroes` | per hero: `xp, level` (cached from xp), `talents` (id -> rank), `constellation` (0-6), `runs, clears, kills, time, bestTime, talentRespecs` |
| `mastery` | base weapon id -> mastery XP (evolutions feed their base) |
| `relics` | owned relic id -> stars 0-6 |
| `loadout` | `stage, hero, relics[], twists{id: rank}, endless, startWeapon` |
| `gacha` | per banner `{pity, pityUR, guaranteed, pulls}`, `spark`, `history` (last 100), `stats` (pulls, tenPulls, gemsSpent, byRarity, 50/50s, N streaks, copiumEarned, sparksUsed, exchangeBuys, hardPityHits, pityInsurance, gemExchanges) |
| `rotation` | `cycle, runsLeft` (featured banners change every 3 runs) |
| `achievements` | `progress` (best value), `done` (id -> episode), `claimed` |
| `lifetime` | runs, clears, deaths, time, kills, killsByEnemy, eliteKills, bossKills, `bossHeat` (stage -> boss -> best heat), damage / kills by base weapon, dashes, ults, level-ups, chests, food, evolutions, revives, damage taken, coins / gems / copium earned, max combo / rank / level, no-hit / no-dash / pacifist bests, fastest death, pulls, max evolutions, heroes that cleared |
| `codex` | discovered ids per tab (heroes, weapons, passives, enemies, bosses, relics, stages) |
| `records` | per stage: runs, clears, best time / heat (-1 = never cleared) / endless / kills / level / combo, first-clear episode |
| `best` | v1 global bests (title screen) |
| `settings` | unchanged from v1 |
| `tutorial` | v1 `dash` / `ult` + `flags` for hub tutorials |
| `titles` | owned title ids (= achievement ids) and the equipped one |
| `flags` | misc UI-set flags (`finePrint` ...) |
| `info` | created / lastPlayed (epoch ms), migratedFrom, repairs |

**Never blocks boot.** `sanitizeProfile` repairs every section on its own (a
broken gacha block resets only the gacha block): finite clamped numbers,
integer counters, id-checked keys (no `__proto__`), bounded list sizes, known
enums. `reconcileProfile` then applies the content-aware rules. Both are
idempotent (fuzz-tested in `tests/meta.profile.test.ts`).

**Boot** (`src/ui/save.ts`): v2 present -> sanitise; v2 missing -> migrate
`kko.save.v1` if present, else a fresh profile; v2 unreadable -> its raw text is
kept in `kko.save.v2.corrupt`, then as missing. Then reconcile (new unlocks go to
`save.bootUnlocks` for the hub to celebrate) and write back if anything changed.
The v1 key is never deleted. Import / reset keep the replaced profile in
`kko.save.v2.backup`.

**Migration v1 -> v2** (`legacy.ts migrateV1`): coins kept + every coin spent in
the old Dream Shop refunded (frozen v1 price formula `round(base x 1.6^rank / 5) x 5`),
settings / bests / run counts / kills kept (Dream Meadow record, lifetime),
Rin and Mochi unlocked, the "Welcome to Season 2" gift (1,600 ♦ = one 10-pull,
`TUNING.migration.welcomeGems`), `info.migratedFrom = 1` (`save.migration` holds
the refund + gift for a welcome screen).

**Export / import**: `save.exportString()` -> `KKO2.<base64 JSON>.<crc32>`;
`save.importString(text)` rejects empty / foreign / damaged / non-profile strings
with a message (`DECODE_ERROR_TEXT`) and otherwise sanitises + reconciles.
Whitespace and line breaks in pasted strings are ignored.

### UI-facing save API (`src/ui/save.ts`)

```ts
import { save, recordRun, exportSave, importSave, resetSettings } from "./save";
save.profile                     // the live Profile: mutate with src/meta functions, then save.save()
save.runPlan(choice?)            // buildRunConfig -> { hero, config, issues, heat, relicSlots, board }
save.recordRun(summary)          // applyRunToProfile + persist -> RunReport (also save.lastReport)
save.previewRun(summary)         // the same report on a throwaway copy: debug / deep-link ("practice") runs never bank
save.exportString() / save.importString(text) / save.reset()
save.origin / save.migration / save.bootUnlocks
save.data                        // v1-shaped live view for the pre-hub screens (coins, meta, settings, best, runs, wins, lastHero, totalKills, tut)
```

`save.data.meta` maps the old Dream Shop ids onto their board nodes
(`LEGACY_SHOP_NODES`: might -> `might_1`, vitality -> `hp_1`, ... same effect
per rank and max rank) and records the old price as paid. It exists for the
legacy `World({ meta })` path. A World built from `save.runPlan().config` already
applies those nodes through the board mod: pass `meta` OR `run`, never both.
The v1-compatible `recordRun(summary)` sets `summary.coins` to the whole payout
so the old results screen shows what was earned.

## 3. Run loop

```ts
const plan = save.runPlan({ stage, hero, relics, twists, endless, startWeapon });  // repaired, never throws
if (plan.issues.length) showWhyTheLoadoutChanged(plan.issues);
const world = new World({ hero: plan.hero, seed, run: plan.config });
// in-run toasts (about once a second, not per frame; runStats() refreshes one live object, no summary build):
const watch = new AchievementWatch(save.profile);
for (const a of watch.poll(world.runStats())) toast(a);
// after the run:
const report = save.recordRun(world.summary());   // RunReport for results v2
```

Only **account runs** bank (`App.startAccountRun`: hub START EPISODE, RETRY of one).
Debug / deep-link runs (`?autoplay`, `?screen=game`, `?god`, `?relics=` ...) play
with every pool open and use `save.previewRun` instead: Episode Results shows the
payout with a "PRACTICE RUN · NOT SAVED" tag, nothing is stored, the saved
loadout is untouched and no in-run Plot Point toasts fire.

**RunConfig built by `buildRunConfig`** (contract: `src/game/run-config.ts`):
`mods` = board stat mod + hero level mod (+1% damage, +1% max HP per level above
1); relic / talent / constellation stat parts are applied by the sim from their
ids, never duplicated here. `weaponPool` / `passivePool` = unlocked and
registered (the hero's signature weapon always offered), `weaponDamage` = +3%
per mastery rank, `weaponLevelBonus` = +1 at rank 5 ("Limit Break"), +2 at 10,
`relics` with stars, `talents` (repaired against the tree and points),
`constellation`, `twists` + `twistRanks`, `start` (board start levels, chosen
start weapon at Lv2 with "Prepared Protagonist": the hero's signature weapon
when none is chosen, which the World then levels to Lv2 instead of adding a
second copy; another weapon joins the build at Lv2), slots (6 + board), `flags`
(board `RUN_FLAGS`: banish, skip, dashCharges, ultStart, chestLuck, eliteRate,
plotArmor, friendship, revives).

**Validation** (`resolveLoadout`, issues listed, the loadout repaired): hero
unknown / locked, stage unknown / locked, relics unknown / not owned / duplicate /
over the slots (1 + board + `unlocks.relicSlots`, max 4), twists unknown / locked
/ stage not cleared yet / rank over max, endless before a clear, unknown or
locked start weapon. `setLoadout` / the reconcile store `storedLoadout`: the repaired
loadout, except that Plot Twist ranks and the Filler Arc toggle dropped only because the
chosen stage is not cleared yet are kept (peeking at an uncleared episode keeps the heat
setup; the run there is still heat 0, no Filler Arc - `buildRunConfig` resolves).

After a grant (a pull, a Copium Exchange buy, the spark) `afterGrant` runs the unlock
rules right away (a new hero's signature weapon, "own 4 heroes" passives: returned as
`unlocks`, celebrated when the summon closes; a PULL AGAIN chain holds them until the last
summon of the chain closes, so the cards never cover a storyboard) and `autoEquipNewRelics` puts relics owned
for the first time into free relic slots, best rarity first, never replacing one
(`equipped`; the summary card reads EQUIPPED!).

**`applyRunToProfile(profile, summary)`** -> `RunReport`: payout coins and gems
line by line (amounts add up to the totals; multiplier lines carry `mul`),
lifetime counters, stage records (first clear, best time / heat / endless /
kills / level / combo, heat badges), hero XP + level-ups, mastery gains (rank
before / after, Limit Break, MASTERED), codex discoveries (gem bounty line),
banner rotation, new unlocks, new achievements (unlock / title rewards applied;
gems / coins claimed by the UI with `claimAchievement` / `claimAllAchievements`,
or `autoClaim`), balances, and `affordable` (board nodes buyable now, cheapest
cost, pulls affordable: "the results screen always ends on 'you can afford
something'").

## 4. Economy (`economy.ts`, numbers in `tuning.ts`)

Tuned by the progression simulator (§9) so the mid bot hits EXPANSION §2; the method and
the before / after tables are in ARCHITECTURE.md §6.6.

- **Grade**: a death scores `minutes + kills/2000 + level/20 + maxCombo/500` (D / C / B / A
  at 2.5 / 5 / 9); a clear is A, S under 150 damage taken, SS under 50 with an SSS combo
  rank. Rank multipliers D 1 · C 1.05 · B 1.1 · A 1.15 · S 1.25 · SS 1.35.
- **Coins** = the coins picked up (as they are: they already include greed) + the
  **episode bonuses** x greed x rank x the stage's **Ratings** (`StageInfo.rewardMul`:
  Dream Meadow 1 · Candy 1.5 · Academy 2 · Beach 5 · Final Arc 8), then x heat
  (`1 + 0.08 heat`) x curse (`1 + 0.5 curse`) on everything. Episode bonuses: time 9 / min
  (the first 2:00 count double: a 90 s death still buys a ring-1 node, and dying early never
  pays more per minute), kills 0.0002 each + elites 0.2, bosses by slot 5 / 10 / 18 / 28,
  clear 20, Filler Arc 4 / min. Picked-up coins stay small on purpose (they grow with raw
  power - a maxed build's Star Pouches - not with the stage): `CFG.coinDropChance` 0.2 % a
  kill (x luck), boss / elite bursts 8 / 4 coins, Star Pouch 3, chests 3-6 (golden 10).
  Typical payouts (heat 0, the after progression run, deaths p25-p75 / clear median): a
  fresh ~2:00 death ~45 (+40 from the Pilot Episode Plot Point); Dream Meadow 110-230 /
  ~730; Candy 210-525 / ~1,000; Academy 350-640 / ~1,400; Beach 690-1,200 / ~3,250; Final
  Arc 1,250-5,400 / ~9,800; a death inside 3:00 pays ~50 / 115 / 140 / 410 / 670 by stage.
- **Gems**: stipend (4 a run, earned over the first minute played: `4 x min(1, time / 60)`,
  + 1.5 / min + 3 / endless min) x gem find x heat (`1 + 0.06 heat`) x curse x Ratings^0.5
  (a RETRY -> pause -> DROP quit loop pays ~0 at any heat or stage; a 1:41 death pays the
  full stipend), + first clear (240 / 320 / 400 / 480 / 800 by stage
  order) + boss first kills (30, finals 60) + heat badges (200 / 400 / 800 / 1,600 at
  heat 4 / 8 / 16 / 32, once per stage) + codex bounties (hero 10, weapon 5, passive 3,
  enemy 3, boss 12, relic 2, stage 15); Plot Points pay separately (~24,800 ♦ in all, half
  the bible's first numbers). A fresh save gets no starter gems: the Pilot Episode (160 ♦)
  pays the first single pull after run 1 and "Just One Pull" pays it back.
- **Hero XP**: time 1 / s + kills 0.004 + bosses 40 + clear 150, x Ratings^0.3; x3
  ("Recap Episode" catch-up) while the hero is more than 2 levels below the account's best
  hero. Level L -> L+1 costs `round(120 x L^1.3 x 1.06^(L-1))` (Lv 10 ≈ 12.9k XP, Lv 20 ≈
  104k, Lv 30 ≈ 418k ≈ 120-150 Final Arc runs); one talent point per level.
- **Mastery**: damage x 0.001 XP; ranks at 500 / 2.5k / 12k / 35k / 80k / 160k / 320k /
  900k / 3M / 10M XP (rank 5 "Limit Break" ≈ 80M damage, rank 10 ≈ 10B); +3 % damage per
  rank.
- **Costs**: board ring 1 15 coins a rank up (ring totals 1.9k / 23k / 181k / 996k / 3.65M,
  4.85M in all); talent respec 50 + 15 per point; hero level accelerator 0.6 coins per
  missing XP (the simulated player's dead-zone fallback); Gem Exchange 1,000 ★ -> 10 ♦.
- **Unlocks** (`unlocks.ts`): the bible's conditions; Paper Crane Flock moved from 10 to
  600 lifetime evolutions (the late-game unlock: ~11-17 evolutions an hour by then, so ~40-60 h for the mid bot).

## 5. Training Arc board (`board/`)

120 nodes in 5 rings (12 / 18 / 24 / 30 / 36) around "Episode 1: Pilot", 6
themed sectors (Shounen Power, Plot Armor, Speed Lines, Main Character Brain,
Gacha Brain, Cursed Production), 10 keystones floating outside ring 5, each a
build-defining trade-off (Glass Cannon Arc, Chosen One Syndrome, Plot Armor, The
Protagonist Refuses To Fall, Speed Lines Everywhere, Filler Episode, Power of
Friendship, Merch Tie-In, Curse Of The Sequel, Truck-kun's Blessing).

- **Layout**: polar constellation (`x, y` per node, `BOARD.radius`,
  `BOARD.sectors[].angle / color`), the cheapest "spine" nodes in the middle of
  each wedge, deterministic jitter. `BOARD.edges` for drawing.
- **Gating**: ring 1 open; ring r needs the stage with order r - 1 cleared. A node
  is buyable when a neighbour is owned (the centre counts).
- **Costs**: `ringCost[ring] x kindMul x (1 + 0.45 x path position) x 1.55^(rank-1)`,
  rounded to friendly steps: 15 on ring 1 up to ~100k for a ring-5 keystone;
  ~4.85 M coins for the whole board.
- **Refund**: the top rank of a node, full price, refused when it would strand an
  owned node. **Respec**: everything back minus `min(6000, 50 + 4%)`.
- **Keystones**: bought ones switch on automatically while a slot is free;
  `toggleKeystone`, at most `TUNING.board.keystoneSlots` (2) active.
- **`applyBoard(p)`** -> one StatMod, run flags, slots, start levels, start weapon
  level, active keystones; `autoPath(p, ctx, { score? })` plans the greedy
  cheapest (or best-value) purchase chain for the "auto-path" button and the
  simulator; `affordableNodes` feeds the pulse; `nodeText` / `effectText` give the
  detail card copy.

## 6. Merch Machine (`gacha/`)

Rates N 52 / R 30 / SR 13.5 / SSR 3.6 / UR 0.75 / LR 0.14 / MYTHIC 0.0069 %
(N absorbs the 0.0031 % remainder). A pull first decides "SSR or better?"
(printed 4.4969 %, +6 points per pull from pity 74, certain at 90), the tier inside
keeps the printed proportions; UR-or-better is forced on the 300th pull without
one; the 10th pull of a 10-pull without an SR+ is SR+. `consolidatedSsrPlus()`
gives the pity-inclusive rate for the fine print. Pity is per banner type and
persists across rotations.

- **Banners**: permanent; featured hero (Senpai -> Isekai-kun -> Magical Girl #47,
  seasonal names per loop); featured merch (20 SSR / UR / LR relics in the bible's
  order); Truck-kun's Isekai Express (Truck-kun on MYTHIC drops; every N result is
  the Traffic Cone). Featured banners rotate every 3 runs (`advanceRotation`,
  called by `applyRunToProfile`) that lasted a minute or cleared the stage
  (`TUNING.rotation.minRunSeconds`: instant quits never spin the banners; they still
  count as episodes). A banner whose featured item is not registered
  yet is unavailable (`bannerView().block`).
- **Pools**: every registered relic; the gacha heroes at their rarity; unlocked
  gameplay heroes at SR (constellation copies); Truck-kun only on his banner.
- **50/50**: an SSR+ drop at the featured item's rarity is the featured item 50 %
  of the time; a loss guarantees the next one (`lost5050` on the result).
- **Copies**: relic new (★0) -> ★1..★6 -> overflow Copium by rarity; hero unlock
  -> C1..C6 -> overflow Copium; +1 Copium per pull; codex bounties on new items.
- **Spark**: 1,000 pulls on any banner -> `claimSpark(id)` any MYTHIC.
- **History** (last 100) and **stats** (`gachaStats`: observed rates, $0 IRL).
- **Copium Exchange**: Pull Voucher (120 -> 160 ♦), Pity Insurance (+10, never
  past 89), relics by rarity (N 30 ... LR 3,600), Senpai / MG47 1,400, Isekai-kun
  3,800, unlocked gameplay hero copies 400; MYTHICs never for sale.
- **RNG** is injected (`RandomSource`; `mathRandom` in the game, a seeded
  `core/rng` Rng in tests and the simulator).

## 7. Plot Points (`achievements/`)

One file per category group in `achievements/defs/` exporting
`achievements: AchievementDef[]` (auto-registered, sorted by path); helpers
`counter`, `feat`, `stageClearByOrder`. `value(c)` reads `c.life` (lifetime incl.
the evaluated run), `c.run`, `c.p`, `c.clears(stage)`, `c.bestHeat()`,
`c.bestEndless()`. The 47 core entries ship now; `docs/content/achievements.md`
lists the rest (171, ids of the core set kept). Rewards: gems / coins
(claimed), `unlock` and `title` (applied on completion). Hidden entries read
"???" in `achievementViews`. `AchievementWatch.poll(liveStats)` reports
completions mid-run without touching the profile.

## 8. Unlocks and codex

`UNLOCK_RULES` mirrors the bible (achievements.md §1, weapons.md §6, stages.md
§6): Rin (King Puff), Mochi (3,000 kills), Kuro (6:00 in Dream Meadow), Pudding /
Aoi / Akane (clear stages 1-3), gacha heroes (gacha only), signature weapons with
their hero, the 4 general weapons and 8 passives on lifetime counters, Plot Twists
by stage clears. Content with no entry is free (dev content just works); stages
need the previous clear; a twist without a row opens with the stage its
`TwistDef.unlockedBy` names (locked while that stage is not registered). `evaluateUnlocks` runs after every run and at boot;
`unlockStatus` gives the codex hint and progress ("412 / 1,000"). Codex
discoveries pay `TUNING.codex` gems once per entry.

## 9. Progression simulator (`npm run progression`, `node tools/progression.mjs`)

`tools/progression.sim.ts` plays consecutive runs with ONE account, exactly like a
player: loadout policy -> `buildRunConfig` -> headless World + bot
(`BOT=weak|mid|good|strong`, `src/debug/bot.ts makeBot`; weak = the lazy bot) ->
`applyRunToProfile` (auto-claim) -> spending policy. A run stops at its clear, its
death or 5:00 past the stage length (a real player keeps fighting a final boss).

**The player model** (`tools/policy.ts` + the worker):

- **Loadout**: the furthest open stage, the most-played hero (each newly unlocked hero
  gets one try-out run), the best relics (rarity, then stars).
- **Farming**: after a short death on the frontier (the furthest stage, not cleared yet,
  died before 40 % of its length) the next run replays the last cleared stage for coins,
  then it is back to the frontier (`FARM=0`: always push; the always-push player buys a
  board node after only ~57 % of its first-10 h runs - a string of 90 s Final Arc deaths
  pays ~400 coins against 1,500-coin ring-3 ranks - against ~80 % with farming).
- **Spending** after every run: board nodes by value / cost (`autoPath` + `nodeValue`),
  keystones, talent points (strongest branch first); with nothing open on the board
  (every open ring bought, the next one still gated) coins go into the hero-level
  accelerator instead; the very first pull is a single one, then 10-pulls (featured hero
  banner first), the spark, Copium -> Pull Vouchers.
- **Endgame** (after the first Final Arc clear): a Plot Twist heat ladder on the Final Arc
  with the main hero (+2 heat after a clear, -2 after two failures, `TWIST_LADDER`), and
  every other run trains the lowest-level hero at heat 0 (hero levels / talents keep
  moving in the long tail).

**Worker env**: `RUNS`, `HOURS`, `SEED`, `OVERHEAD` (menu seconds per run, 45),
`DT` (1/30), `MAXE` (250), `STRIDE=4 STRIDE_FROM=final|<h>` (late game: bank each
simulated run 4 times - the late game is stable and a high-power Final Arc run costs
20-30 s), `ENDGAME=0`, `TRY_NEW=0`, `FARM=0` / `FARM_BELOW=0.4`, `SAVE_AT=<h> SAVE_TO=f` / `RESUME=f` (dump an account
and continue it: late-game tuning without replaying the first hours), `OUT=f.json`,
`VERBOSE=1` (a line per run), `LINES=1` (every payout line), `PATCH='{...}'` or a .json file (a combat tuning patch,
`tools/patch.ts` paths - `"stage.candy_kingdom.scaling": {"hp": 2.1}`, `"boss.cancel_sama.hp": 1900000` - applied for the
whole account: stage-clear sweeps without editing files), `STOP_AT=final|<stage order>` (end the account at that stage's
first clear), `SAVE_END=1 SAVE_TO=f` (dump the account where it stopped). Driver flags: `--patch`, `--stop-at`,
`--save-end --save-dir d`, `--resume-dir d` (the next stage's sweep continues those dumps: the verification pass tuned
Beach / Final Arc variants from the same eight post-Academy accounts).

**The report** (`node tools/progression.mjs --bots weak,mid,strong --seeds 1-2 --hours 160
--stride 6 --name after`, ~75 min on 4 cores, one worker process per account, 4 in parallel; `--report f.json`
re-prints, `--compare before.json` adds before columns): hours / runs to every EXPANSION §2
milestone (median [min-max]), weak / strong pace vs mid, checkpoint snapshots against §9.1
(board coins, hero level, mastery, relics, constellation, pulls, clears), income per
phase (runs / h, coins / run and / h, gems / h, runs per 10-pull, hero XP / h), the
incremental hook for the first 10 h (payout covers the cheapest open node, something
affordable on Results, runs that bought a node) and the longest dead zones (no board buy;
no progress event at all), the first 12 runs, and the unlock timeline. Results:
`tools/results/progression-{before,after}.{json,md}`.

**Economy helpers** (`tools/econ.sim.ts`, `npx vitest run --config tools/econ.vitest.config.ts
--root . --disableConsoleIntercept`): `ECON=fit` prices every run of a `node tools/matrix.mjs
--stats` result (each run's RunStats kept; `tools/results/matrix-econ-data.json` = P0-P7 x
every stage, Hoshi / Kuro) with the live payout / hero XP / mastery formulas, per cell, and
`FIT_PATCH='{"payout.coinsPerMinute": 9, "stage.final_arc.rewardMul": 12}'` tries a change
offline before a progression run; `ECON=reprice RINGS=15,220,1500,7000,22000` prints what each
checkpoint's ranks cost under other ring costs (the §9.1 coin values that keep their power).

### 9.1 Account-power checkpoints (the contract between the combat curve and the economy)

`tools/checkpoints.ts` builds eight synthetic accounts **through the real meta
layer** (board purchases with the policy above, hero XP -> level -> talents,
mastery XP -> ranks / Limit Breaks, relics with stars, constellations, unlocks)
and turns them into RunConfigs with `buildRunConfig`:
`checkpointRun("P3", { hero, stage, twists })`. Checkpoints are cumulative (P(k)
is built from P(k-1): each step's coins arrive in 24 chunks and are spent with
only the rings of that step open, so ring 1 is bought before ring 2 exists).
Measurement liberties: every stage is unlocked and the played hero is unlocked
even when the account would not have it yet ("P0 Rin" = Rin at fresh-save power).

| Id | Hours (economy target) | Clears | Board coins | Hero Lv | Mastery (signature / others) | Relics equipped | Const. | Intended clear (~40-70 %) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | 0 | 0 | 0 | 1 | 0 / 0 | - | C0 | - (dies 2:30-4:00 in Dream Meadow) |
| P1 | ~1 | 0 | 420 (18 ranks of ring 1) | 5 | 1 / 0 | - | C0 | - (King Puff) |
| P1b | ~1.2 | 0 | 1,862 (ring 1 done) | 6 | 2 / 1 | SR Festival Goldfish ★0 | C0 | - (where the Dream Meadow push sits: ~10 % clears) |
| P2 | ~3 | 0 | 1,862 (ring 1 done) | 10 | 3 / 1 | SR Festival Goldfish ★0 | C0 | Dream Meadow |
| P3 | ~8 | 1 | 19,760 (ring 2 mostly) | 15 | 5 / 2 | SSR Transformation Brooch ★0, SR Mascot Head ★1 | C0 | Candy Kingdom |
| P4 | ~15 | 2 | 83,760 (ring 3 started) | 20 | 7 / 4 | SSR Protagonist Scarf ★0, SSR Brooch ★0, SR Mascot Head ★1 (slots allowing) | C0 | Shoujo Academy |
| P5 | ~30 | 3 | 398,760 (ring 4 started) | 25 | 8 / 5 | UR Director's Cut ★0, UR Unopened Figure ★0, SSR Brooch ★1, SSR Scarf ★0 (slots allowing) | C1 | Beach Episode (and the Final Arc's lower bound) |
| P6 | ~80 | 5 | 2,298,760 (ring 5 half) | 30 | 10 / 7 | LR Sakuga Cel ★1, UR ★2, SSR ★4, SSR ★3 | C2 | The Final Arc |
| P7 | ~150 | 5 | 4,854,242 (full board; keystones Plot Armor + Truck-kun's Blessing) | 30 | 10 / 10 | MYTHIC A Real Friend ★1, LR Sakuga Cel ★4, SSR Red String ★5, UR ★5 | C4 | heat: melts the Final Arc at heat 12, works at heat 41 |
| P7r | ~150 | 5 | as P7 | 30 | 10 / 10 | LR Revival Theme ★0, UR Director's Cut ★1, UR Unopened Figure ★1, UR Hot-Blooded Bandana ★0 | C6 | P7 with the Merch Machine's real 150 h haul (no MYTHIC: the spark is ~780 pulls away) |

(Verification pass: P2-P5 now hold what the Merch Machine actually gives the average player by those hours -
progression snapshots: an SR by ~1 h, SR / SSR pairs by 3-8 h, SSR + SSR + SR by 15 h, two URs by ~30 h - one
rarity more than the combat-curve pass's sets; P1b and P7r are new. P6 / P7 keep their LR / MYTHIC sets as the
lucky-gacha ceiling.)

(Board coins at today's prices: the economy pass made ring 1 40 % cheaper - 3,101 -> 1,862 coins - and
repriced every checkpoint so it keeps the ranks it was measured with: `ECON=reprice` in `tools/econ.sim.ts`.
Paper Crane Flock is now the 1,000-evolution late unlock, so P2-P5 hold the other three general weapons.)

Unlocked content grows with them (P1: Rin, Mochi, Bubble Tea Cannon, Main
Character Aura; P2: + Kuro, 3 of the 4 general weapons, 6 of the new passives; P3+:
every passive, + the heroes each clear opens; P6+: + Paper Crane Flock; P5: + Senpai;
P6: + Magical Girl #47, Isekai-kun; P7: + Truck-kun). Resulting stats (Hoshi):
P0 might x1.00 / 80 HP; P2 x1.29 / ~133 HP; P3 x1.46, 2 armor; P4 x1.67, 7 weapon
slots, a revive; P5 x1.94, start Lv 3, 4 relic slots; P6 x2.40 / ~380 HP, start Lv 8, 2
revives; P7 x2.5 might, 3 revives + Plot Armor (a 150 h player picks survivable keystones: the value
policy's Glass Cannon Arc, -40 % HP, is a liability against the long stages' damage ramps).
`HEAT_SETS.mid` (heat 12) and `HEAT_SETS.max` (41) are the Plot Twist sets for P7.

**What the economy pass tunes**: income and costs so that the mid bot's account
reaches each checkpoint's board coins / hero level / mastery / relics at about its
`hours` (the combat side then guarantees the clear rates of ARCHITECTURE.md §6:
a stage's first clear lands a little before its intended checkpoint). Changing a
checkpoint's contents is a joint decision: re-run `node tools/matrix.mjs` after.

## 10. Tests

`tests/meta.*.test.ts` (fixtures in `tests/meta.fixtures.ts`, a small fixed
content catalogue): profile sanitiser (incl. fuzzing), reconcile, v1 migration
(incl. corrupted blobs), export / import, payout, curves, board graph / rules /
effects / auto-path / v1 shim, heroes and talents, gacha statistics (1,000,000
seeded pulls: printed rates, soft pity model, pity never exceeded, 10-pull
floor, 50/50 + guarantee, copies, spark, rotation, exchange), achievements and
the in-run watcher, unlock rules, loadout validation and RunConfig (with a live
World run), applyRunToProfile (with a live bot run), and save v2 against an
in-memory localStorage (fresh / migrated / corrupt / garbage / throwing storage,
export / import, the v1 view, banking a run).

`tests/integration.test.ts` pins the seams between the layers with the LIVE
registries: run -> bank -> buy -> a measurably stronger run, hero level mods,
relic / talent / constellation stats applied exactly once, Prepared Protagonist,
mastery and Limit Break levels, board slots / start level / flags in the World,
Plot Twist heat agreeing across loadout, sim, RunStats and payout, content pools,
unlock rules vs `TwistDef.unlockedBy`, banner rotation + Plot Point evaluation
per banked run, greed on the payout, and a Filler Arc run banked as a clear.
The browser side of the same loop is `node scripts/flows.mjs` (ARCHITECTURE.md §8).
