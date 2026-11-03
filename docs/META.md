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
| `tuning.ts` | **Every tunable number**: payout, grade, hero XP curve, mastery curve, board costs, relic slots, rotation, gacha rates / pity / Copium, Copium Exchange prices, Gem Exchange, codex bounties, migration gift. The economy pass edits only this file. |
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
// in-run toasts (about once a second, not per frame):
const watch = new AchievementWatch(save.profile);
for (const a of watch.poll(world.summary().stats)) toast(a);
// after the run:
const report = save.recordRun(world.summary());   // RunReport for results v2
```

**RunConfig built by `buildRunConfig`** (contract: `src/game/run-config.ts`):
`mods` = board stat mod + hero level mod (+1% damage, +1% max HP per level above
1); relic / talent / constellation stat parts are applied by the sim from their
ids, never duplicated here. `weaponPool` / `passivePool` = unlocked and
registered (the hero's signature weapon always offered), `weaponDamage` = +3%
per mastery rank, `weaponLevelBonus` = +1 at rank 5 ("Limit Break"), +2 at 10,
`relics` with stars, `talents` (repaired against the tree and points),
`constellation`, `twists` + `twistRanks`, `start` (board start levels, chosen
start weapon at Lv2 with "Prepared Protagonist"), slots (6 + board), `flags`
(board `RUN_FLAGS`: banish, skip, dashCharges, ultStart, chestLuck, eliteRate,
plotArmor, friendship, revives).

**Validation** (`resolveLoadout`, issues listed, the loadout repaired): hero
unknown / locked, stage unknown / locked, relics unknown / not owned / duplicate /
over the slots (1 + board + `unlocks.relicSlots`, max 4), twists unknown / locked
/ stage not cleared yet / rank over max, endless before a clear, unknown or
locked start weapon.

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

- **Grade**: a death scores `minutes + kills/400 + level/12 + maxCombo/300`
  (D / C / B / A); a clear is A, S under 150 damage taken, SS under 50 with an
  SSS combo rank.
- **Coins**: picked up + time (per minute) + kills (+ elites) + each boss (by its
  slot in the stage) + clear + endless minutes, then x grade x heat
  (`1 + 0.08 heat`) x curse x stage `rewardMul`.
- **Gems**: stipend (per run + per minute + endless) x gem find (`RunStats.gemFind`)
  x heat x curse x stage, + first clear (by stage order), + boss first kills, +
  heat badges (4 / 8 / 16 / 32, once per stage), + codex bounties; achievements
  pay separately.
- **Hero XP**: time + kills + bosses + clear, x stage reward; level L -> L+1 costs
  `round(140 x L^1.32)` (Lv 30 ≈ 155k XP ≈ 100 full runs); one talent point per level.
- **Mastery**: damage x 0.001 XP; ranks at 300 ... 110,000 XP; +3% damage per rank.
- **Costs**: talent respec 50 + 15 per point; hero level accelerator 0.6 coins per
  missing XP; Gem Exchange 1,000 ★ -> 10 ♦.

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
  rounded to friendly steps: 25 on ring 1 up to ~100k for a ring-5 keystone;
  ~4.9 M coins for the whole board.
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
  called by `applyRunToProfile`). A banner whose featured item is not registered
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
need the previous clear. `evaluateUnlocks` runs after every run and at boot;
`unlockStatus` gives the codex hint and progress ("412 / 1,000"). Codex
discoveries pay `TUNING.codex` gems once per entry.

## 9. Progression simulator (`npm run progression`)

`tools/progression.sim.ts` plays consecutive runs with one account: loadout
policy (furthest unlocked stage, main hero, best relics) -> `buildRunConfig` ->
headless World + bot (`BOT=weak|mid|strong`) -> `applyRunToProfile` (auto-claim)
-> spending policy (board by value / cost through `autoPath`, talents in the
strongest branch, 10-pulls on the featured banner, spark, Copium vouchers,
keystones). It prints per-run lines (`VERBOSE=1`, payout lines with `LINES=1`),
curves every `EVERY` runs, hours / runs to every EXPANSION §2 milestone, totals and
the sim cost; `OUT=file.json` writes the full log. Env: `RUNS`, `HOURS`, `SEED`,
`OVERHEAD` (menu seconds per run), `DT`, `MAXE`.

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
