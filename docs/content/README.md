# KIRA☆KIRA OVERDRIVE — Season 2 Content Bible

This folder is the content bible that `docs/EXPANSION.md` calls `docs/CONTENT.md`
(it grew into one file per topic). It is the **single source of truth** for every
name, number, line and look the code, art, audio and economy agents implement.
Implement it literally. If something here contradicts `EXPANSION.md`, the spec
wins and this bible is the bug.

| File | What it decides |
| --- | --- |
| [heroes.md](heroes.md) | 8 new heroes, traits, ultimates + cut-in lines, talent trees for all 11, constellations C1-C6 for all 11, OC bios for all 11, sprite + portrait art direction |
| [weapons.md](weapons.md) | 12 new weapons (5-level tables), 12 evolutions, Limit Break Lv6/Lv7 for all 20, 8 new passives, unlock conditions + codex hints |
| [stages.md](stages.md) | Stages 2-5 as `StageDef` data (phases, events, tiles, deco, grade, ambient, music, endless), new director event kinds, Plot Twists, Filler Arc rules |
| [enemies.md](enemies.md) | 22 new enemies + 1 split form, 9 new bosses with phases, telegraphs, name cards, death lines, sprite plans |
| [relics.md](relics.md) | 61 relics ("Merch"): rarity, hook, effect per star ★0-★6, icon, flavour |
| [gacha.md](gacha.md) | Banners, rotation, pull storyboard (beats, timings, sfx), rarity titles, fine print, 50/50 lines, dupes, Copium Exchange, pity UI |
| [achievements.md](achievements.md) | 152 Plot Points with counter keys, targets and rewards (incl. every unlock) |
| [satire.md](satire.md) | Narrator, episode titles, "Next time on…", death stingers, NANI/BAKA rules, speech bubble pools, loading tips, menu flavour, grade comments, wiki blurbs |
| [art-manifest.md](art-manifest.md) | Every new sprite id with size, frames, pivot, owner group and one-line direction (mirrored in `src/art/manifest.ts`) |

## Global conventions

**Ids.** snake_case, globally unique per kind. Heroes `kuro`; weapons
`dark_flame_dragon`; evolutions `unsealed_abyss_dragon`; passives `plot_armor`;
enemies `gummy_bear`; bosses `gingerbread_golem`; stages `candy_kingdom`; relics
`bent_spoon`; twists `budget_cuts`; talents `<hero>_<slug>`; achievements
snake_case (the 41 ids already registered in `src/meta/achievements/defs` are kept). Sprite ids follow the existing prefixes: `<hero>_idle|run|hurt|cast`,
`portrait_<hero>`, `en_*`, `boss_*`, `eb_*` (enemy bullets), `w_*` (player
projectiles), `fx_*`, `ult_*`, `icon_*` (16×16), `tile_*`, `deco_*`, `prop_*`,
`ui_*`, `board_*`.

**Stats.** Effects are written against `src/game/stats.ts` field names so they can be
implemented 1:1: `might, maxHp, regen, armor, moveSpeed, cooldown, area, amount,
projSpeed, duration, pickup, crit, critMult, luck, growth, greed, dashCd, knock,
revives, rerolls, cards, curse, gemFind, dmgReduction, healMul, shield, shieldCd`.
"+4% might" means `s.might += 0.04`; "−3% cooldown" means `s.cooldown -= 0.03`;
"+1 shield charge" means `s.shield += 1`. Flags (`RunConfig.flags`): `plotArmor,
dashCharges, ultStart, chestLuck, eliteRate, friendship, revives, freeRerolls,
banish, skip`.

**Proposed additions** this bible relies on (sim / meta agents: add them additively;
until then the listed fallback applies). Already landed in code: `TimelineEvent.label`,
`TimelineEvent.sprite`, `StageDef.bpm`, `EnemyDef.tint`, `EnemyDef.special`.

| Addition | Meaning | Used by | Fallback |
| --- | --- | --- | --- |
| `Stats.ultGain` (default 1) | Overdrive meter gain multiplier (kills, elites, bosses, passive) | talents, relics | ignore |
| `Stats.ultPower` (default 1) | multiplies `UltState.power` | talents, relics, constellations | ignore |
| `Stats.comboTime` (default 0) | seconds added to every combo window (`CFG.comboWindow`) | Hype Towel | ignore |
| `Stats.bossDmg` (default 1) | damage multiplier vs bosses and elites | relics, talents | ignore |
| `Stats.hitbox` (default 1) | player collision radius multiplier | Chibi Charm | ignore |
| per-weapon damage bonus | talent / relic "+X% <weapon> damage" uses the same channel as mastery (`RunConfig.weaponDamage`; an evolution uses its base's entry) | talents | — |
| `w.talentRank(id)` | rank of a talent node in this run (0 if not taken) so weapon and ult code can read it | talents that modify weapons / ults | — |
| `HeroDef.cutinLine?` | the shouted subtitle under the ult title in the cut-in | heroes | no subtitle |
| `EnemyDef.maxAlive?` | per-type alive cap the director respects | Plot Hole (3) | spawn weight only |
| per-instance enemy sprite | Shadow Clone draws the current hero's `<hero>_run` | enemies | `tint` on a fixed sprite |
| `RunStats` extras | `nanis, bakas, charmed, henshins, overdos, isekaid, healed, jackpots, killedBy, ultReadyAtDeath, comfyBest, maxWeaponsHeld` | achievements (§1 there) | achievement stays locked |
| gacha stats extras | `hardPityHits, pityInsurance, gemExchanges`, profile flag `finePrint` | achievements | achievement stays locked |

**Board nodes** (Training Arc, EXPANSION §5) are authored directly in
`src/meta/board/data.ts` by the meta layer; their copy follows this bible's tone
(§12 guardrails apply there too).

**Damage numbers.** All weapon/ult damage below is BASE damage before `might`,
mastery and crits, exactly like the existing `levels` tables. Ultimate damage is
`base × might × u.power` (power = `1 + 0.06 × (level − 1)`, × `Stats.ultPower`).

**Tone guardrails** (EXPANSION §12, repeated because they are not optional):
never sexualised (the Beach Episode is crabs and watermelons; nobody is ever
shown in swimwear); jokes at tropes, never at real people or groups; no real
franchise, studio, character or song names; no quoted lines from real works.
Ages are plain numbers (no "actually 1,000 years old"). Romance tropes are
played as rivalry, friendship or "being noticed", never as anything physical.

**Accessibility.** Every effect that flashes, shakes, desaturates or drops the
frame rate (MYTHIC pull, Cancel-sama, Firework Dragon, Studio Change) respects the
"Reduce flashing" setting: the flash becomes a fade, the degradation becomes a
corner badge. Speech bubbles and pops never cover the hero.
