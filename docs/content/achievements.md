# Achievements ("Plot Points")

EXPANSION §11. 160 Plot Points in the six categories of
`src/meta/achievements/types.ts` (`story, combat, heroes, weapons, gacha,
silly`). Ids already registered in `src/meta/achievements/defs/*.ts` are kept
verbatim (marked ●); everything else is new. Each entry is one
`counter(...)` / `feat(...)` call: id, name, desc, category, target, value
function, reward. `hidden` entries show as "???" until done.

In-run toasts: rate-limited to one per 4 s, queued, top-centre under the timer,
never over the hero. Text: `PLOT POINT! <name>` + the reward chip.

## 1. Counter keys

`value(c)` reads only these (see `AchCtx`):

| Key | Meaning |
| --- | --- |
| `life.<k>` | `Lifetime` field including the run being evaluated: `runs, clears, deaths, time, endlessTime, kills, killsByEnemy.<id>, eliteKills, bossKills.<id>, damage, damageByWeapon.<base>, killsByWeapon.<base>, dashes, ults, levelUps, chests, foodEaten, evolutions, revivesUsed, damageTaken, coinsPicked, coinsEarned, gemsEarned, copiumEarned, maxCombo, maxRank, bestLevel, noHitBest, noDashBest, pacifistBest, fastestDeath, pulls, maxEvolutions, heroesCleared[]` |
| `run.<k>` | the evaluated run's `RunStats` (this run only); `run.kills` = Σ `killsByEnemy` |
| `clears(s)` / `bestHeat()` / `bestEndless()` | `AchCtx` helpers |
| `rec.<stage>.<k>` | `p.records[stage]` (`bestTime, clears, bestHeat, bestEndless, bestKills`) |
| `gacha.<k>` | `p.gacha.stats` (`pulls, tenPulls, byRarity.<R>, won5050, lost5050, nStreakBest, copiumEarned, sparksUsed, exchangeBuys`) |
| `p.<…>` | other profile state: `p.unlocks.heroes`, `p.heroes.<id>.level / .constellation`, `p.mastery.<w>` (rank via `masteryRank`), `p.relics` (owned, stars), `p.codex.<tab>`, `p.currencies.coins` |

**New counters (†) this list needs** — add as optional fields, filled by the
run-stats collector / the gacha engine:

| Field | Where | Counts |
| --- | --- | --- |
| `RunStats.nanis` | sim | NANI?! pops shown (satire.md §5) |
| `RunStats.bakas` | sim | BAKA! pops shown |
| `RunStats.charmed` | sim | enemies charmed (Notice-Me Sparkles, Shoujo Filter, Senpai's ult) |
| `RunStats.henshins` | sim | Henshin Burst transformations (incl. Panic) |
| `RunStats.overdos` | sim | overdone fireballs / meteors |
| `RunStats.isekaid` | sim | enemies isekai'd (Horn, Rush Hour, Isekai Express) |
| `RunStats.healed` | sim | HP healed (after healMul) |
| `RunStats.jackpots` | sim | chest JACKPOTs |
| `RunStats.killedBy` | sim | enemy id of the killing blow ("" if alive / quit) |
| `RunStats.ultReadyAtDeath` | sim | 1 if the Overdrive meter was full at death |
| `RunStats.comfyBest` | sim | longest Too Comfy stretch (s) |
| `RunStats.maxWeaponsHeld` | sim | most weapons held at once |
| `gacha.hardPityHits` | meta | SSR+ drops that came from hard pity |
| `gacha.pityInsurance` | meta | Pity Insurance bought |
| `gacha.gemExchanges` | meta | Gem Exchange uses |
| `p.flags.finePrint` | meta (UI sets it) | scrolled to the bottom of the fine print |

**Unlocks.** Content unlocks are evaluated by `UNLOCK_RULES` in
`src/meta/unlocks.ts`; the unlock achievements below use the *same* condition and
carry `reward.unlock`, so the results screen shows the Plot Point card and the
"NEW … UNLOCKED!" celebration together. Canonical rules (three differ from the
current table — update `UNLOCK_RULES`):

| Content | Rule | Achievement |
| --- | --- | --- |
| hero `rin` | `bossKill king_puff` | `king_puff_down` |
| hero `mochi` | `life.kills ≥ 3,000` | `mochi_3000` |
| hero `kuro` | `survive dream_meadow 360 s` | `kuro_awakens` |
| hero `pudding` | `stageClear 1` | `clear_stage_1` ● |
| hero `aoi` | `stageClear 2` | `clear_stage_2` ● |
| hero `akane` | `stageClear 3` | `clear_stage_3` ● |
| weapon `bubble_tea_cannon` | `killsByEnemy.puff ≥ 1,000` | `boba_origins` |
| weapon `paper_crane_flock` | `life.evolutions ≥ 600` | `evolve_10` |
| weapon `idol_lightstick_wave` | `life.maxRank ≥ 5` | `rank_sss` ● |
| weapon `kotatsu_of_sloth` | `life.noDashBest ≥ 180` | `no_dash` ● |
| passive `plot_armor` | `life.damageTaken ≥ 5,000` | `damage_5000` |
| passive `main_character_aura` | **`life.maxRank ≥ 3`** (S rank; code has maxCombo 400) | `rank_s` |
| passive `bento_box` | `life.foodEaten ≥ 50` | `snacks_50` |
| passive `speed_lines` | `life.dashes ≥ 500` | `dashes_500` |
| passive `inner_monologue` | **`life.ults ≥ 25`** (code has runs 20) | `ults_25` |
| passive `training_montage` | **`life.bestLevel ≥ 25`** (code has levelUps 500) | `level_25` |
| passive `friendship_bracelet` | `heroCount ≥ 4` | `heroes_4` |
| passive `chibi_charm` | `life.noHitBest ≥ 120` | `no_hit_120` |

---

## 2. Story (24)

| id | Name | Description | Condition | Reward |
| --- | --- | --- | --- | --- |
| `pilot_episode` ● | Pilot Episode | Finish your first run. Every legend has a rough first episode. | `life.runs ≥ 1` | 160 ♦ · 40 ★ (run 1 buys two board nodes and the first pull) |
| `king_puff_down` | Long Live the King (Not) | Defeat King Puff. | `life.bossKills.king_puff ≥ 1` | 30 ♦ · unlock `rin` |
| `teddy_down` | Lights On | Defeat Nightmare Teddy. Check under the bed: clear. | `life.bossKills.nightmare_teddy ≥ 1` | 40 ♦ |
| `kuro_awakens` | The Seal Weakens | Survive 6:00 in Dream Meadow. Something stirs. It's edgy. | `rec.dream_meadow.bestTime ≥ 360` | 40 ♦ · unlock `kuro` |
| `clear_stage_1` ● | Dawn Breaks | Clear Dream Meadow. | `clears(dream_meadow) ≥ 1` | 120 ♦ · title "Dawnbringer" · unlock `pudding` |
| `gingerbread_down` | Crumbled | Defeat the Gingerbread Golem. It was supposed to be a house. | `life.bossKills.gingerbread_golem ≥ 1` | 40 ♦ |
| `clear_stage_2` ● | Sugar Crash | Clear Candy Kingdom. | `clears(candy_kingdom) ≥ 1` | 160 ♦ · unlock `aoi` |
| `president_down` | Motion Carried | Defeat the Student Council President. It's going on her record. | `life.bossKills.council_president ≥ 1` | 50 ♦ |
| `clear_stage_3` ● | Graduation Ceremony | Clear Shoujo Academy. | `clears(shoujo_academy) ≥ 1` | 200 ♦ · unlock `akane` |
| `kraken_down` | She Got Her Hug | Defeat Kraken-chan. A crab hugged her. Everyone cried. | `life.bossKills.kraken_chan ≥ 1` | 60 ♦ |
| `clear_stage_4` ● | The Obligatory Beach Episode | Clear Beach Episode. Crabs were defeated. Watermelons were split. | `clears(beach_episode) ≥ 1` | 240 ♦ |
| `truck_down` | Right of Way | Defeat Truck-kun. Look both ways next time. | `life.bossKills.truck_kun_boss ≥ 1` | 70 ♦ |
| `rival_down` | See You Next Season | Defeat Rival-chan. She'll be back. She said so. Loudly. | `life.bossKills.rival_chan ≥ 1` | 80 ♦ |
| `clear_stage_5` ● | RENEWED FOR SEASON 2!! | Clear The Final Arc and defeat Cancel-sama. | `clears(final_arc) ≥ 1` | 800 ♦ · title "Series Finale" |
| `all_bosses` | Villain of the Week, Every Week | Defeat all 12 bosses at least once. | distinct keys of `life.bossKills` among the 12 boss ids `≥ 12` | 300 ♦ · title "Villain Collector" |
| `filler_arc` ● | Filler Arc Enjoyer | Survive 5:00 of the endless Filler Arc in one run. | `bestEndless() ≥ 300` | 100 ♦ |
| `filler_15` | This Filler Has Its Own Filler | Survive 15:00 of the Filler Arc in one run. | `bestEndless() ≥ 900` | 200 ♦ |
| `filler_30` | The Filler Is the Show Now | Survive 30:00 of the Filler Arc in one run. | `bestEndless() ≥ 1800` | 400 ♦ · title "Filler Veteran" |
| `rematch_1` | Rematch! | Defeat a boss rematch in the Filler Arc. | `Σ run.bossRematches ≥ 1` (any run) | 60 ♦ |
| `heat_4` ● | Plot Twist! | Clear any stage at heat 4 or more. | `bestHeat() ≥ 4` | 120 ♦ |
| `heat_8` | Twist Upon Twist | Clear any stage at heat 8 or more. | `bestHeat() ≥ 8` | 200 ♦ |
| `heat_16` ● | Twist Ending Connoisseur | Clear any stage at heat 16 or more. Nobody saw it coming (they did). | `bestHeat() ≥ 16` | 400 ♦ · title "Plot Twister" |
| `heat_32` | Nobody Saw That Coming | Clear any stage at heat 32 or more. The writers are concerned. | `bestHeat() ≥ 32` | 800 ♦ · title "Showrunner's Nightmare" |
| `heat_8_everywhere` | Every Season Has a Twist | Clear all 5 stages at heat 8 or more. | `min over stages of rec.<s>.bestHeat ≥ 8` | 400 ♦ |

## 3. Combat (28)

| id | Name | Description | Condition | Reward |
| --- | --- | --- | --- | --- |
| `kills_1k` ● | Plushie Problem | Defeat 1,000 enemies. | `life.kills ≥ 1,000` | 30 ♦ |
| `mochi_3000` | Cat-astrophe | Defeat 3,000 enemies. Someone is impressed (she's a cat). | `life.kills ≥ 3,000` | 40 ♦ · unlock `mochi` |
| `kills_10k` ● | Plushie Purge | Defeat 10,000 enemies. | `life.kills ≥ 10,000` | 80 ♦ · 100 ★ |
| `kills_100k` ● | Extinction Event (Cute) | Defeat 100,000 enemies. | `life.kills ≥ 100,000` | 200 ♦ |
| `kills_1m` ● | One Million Plushies Later | Defeat 1,000,000 enemies. | `life.kills ≥ 1,000,000` | 500 ♦ · title "Plushie Nightmare" |
| `episode_1000` | Thousand-Kill Episode | Defeat 1,000 enemies in one run. | `run.kills ≥ 1,000` | 50 ♦ |
| `episode_5000` | Screen Melter | Defeat 5,000 enemies in one run. | `run.kills ≥ 5,000` | 150 ♦ |
| `elites_10` | Rainbow Outline Hunter | Defeat 10 elites. | `life.eliteKills ≥ 10` | 20 ♦ |
| `elites_100` ● | Rival Of The Week, Every Week | Defeat 100 elites. | `life.eliteKills ≥ 100` | 60 ♦ |
| `elites_1000` | Elite Burnout | Defeat 1,000 elites. They have a union now. | `life.eliteKills ≥ 1,000` | 200 ♦ |
| `bosses_10` ● | Boss Rush | Defeat 10 bosses. | `Σ life.bossKills ≥ 10` | 60 ♦ |
| `bosses_100` | Weekly Villain Subscription | Defeat 100 bosses. | `Σ life.bossKills ≥ 100` | 200 ♦ |
| `combo_100` ● | Combo Breaker Breaker | Reach a 100 combo. | `life.maxCombo ≥ 100` | 20 ♦ |
| `combo_1000` | Four-Digit Combo | Reach a 1,000 combo. | `life.maxCombo ≥ 1,000` | 120 ♦ |
| `combo_5000` | Combo Counter Overflow | Reach a 5,000 combo. The counter needed a bigger font. | `life.maxCombo ≥ 5,000` | 300 ♦ · hidden |
| `rank_s` | Main Character Energy | Reach the S combo rank. | `life.maxRank ≥ 3` | 40 ♦ · unlock `main_character_aura` |
| `rank_sss` ● | SSS-Rank Protagonist | Reach the SSS combo rank. | `life.maxRank ≥ 5` | 80 ♦ · unlock `idol_lightstick_wave` |
| `no_hit_120` | Be Small, Be Unhittable | Go 2:00 without taking damage in one run. | `life.noHitBest ≥ 120` | 50 ♦ · unlock `chibi_charm` |
| `no_hit_180` ● | Untouchable | Go 3:00 without taking damage in one run. Plot armor, but earned. | `life.noHitBest ≥ 180` | 80 ♦ |
| `flawless_finale` | Flawless Finale | Clear a stage taking less than 150 damage. | `run.stageCleared && run.damageTaken < 150` | 150 ♦ · title "Flawless" |
| `level_25` | Cue the Montage | Reach level 25 in one run. | `life.bestLevel ≥ 25` | 30 ♦ · unlock `training_montage` |
| `level_50` | Power Creep Personified | Reach level 50 in one run. | `life.bestLevel ≥ 50` | 80 ♦ |
| `level_99` | Lv.99 (Basically 9999) | Reach level 99 in one run. | `life.bestLevel ≥ 99` | 300 ♦ · hidden |
| `damage_5000` | Character Building | Take 5,000 damage in total. Walk it off. | `life.damageTaken ≥ 5,000` | 40 ♦ · unlock `plot_armor` |
| `chests_100` | Treasure Hoarder | Open 100 chests. | `life.chests ≥ 100` | 30 ♦ · 600 ★ |
| `jackpot` | JACKPOT!! | Hit a 5-item chest JACKPOT. | `run.jackpots† ≥ 1` | 60 ♦ |
| `ults_25` | Name Your Attacks | Use Overdrive 25 times. | `life.ults ≥ 25` | 30 ♦ · unlock `inner_monologue` |
| `ults_500` | Attack Name Enthusiast | Use Overdrive 500 times. Your throat hurts. | `life.ults ≥ 500` | 160 ♦ |

## 4. Heroes (36)

| id | Name | Description | Condition | Reward |
| --- | --- | --- | --- | --- |
| `heroes_3` ● | Assemble The Party | Unlock 3 heroes. | `p.unlocks.heroes.length ≥ 3` | 40 ♦ |
| `heroes_4` | Party of Four | Unlock 4 heroes. Friendship achieved. | `p.unlocks.heroes.length ≥ 4` | 50 ♦ · unlock `friendship_bracelet` |
| `heroes_6` ● | Ensemble Cast | Unlock 6 heroes. | `≥ 6` | 100 ♦ · 200 ★ |
| `heroes_all` ● | Full Cast Reveal | Unlock all 11 heroes. Yes, even the truck. | `≥ 11` | 800 ♦ · title "Showrunner" |
| `hero_level_10` ● | Character Development | Raise any hero to level 10. | `max p.heroes.*.level ≥ 10` | 50 ♦ |
| `hero_level_30` ● | Max Affection | Raise any hero to level 30. | `max level ≥ 30` | 240 ♦ · title "Main Character" |
| `all_heroes_30` | Complete Box Set | Raise all 11 heroes to level 30. | `count(level ≥ 30) ≥ 11` | 1,000 ♦ · title "Box Set Collector" |
| `clear_3_heroes` ● | Spin-Off Material | Clear a stage with 3 different heroes. | `life.heroesCleared.length ≥ 3` | 120 ♦ |
| `clear_6_heroes` | Ensemble Episode | Clear a stage with 6 different heroes. | `≥ 6` | 200 ♦ |
| `clear_all_heroes` | Every Character Gets an Episode | Clear a stage with all 11 heroes. | `≥ 11` | 600 ♦ · title "Fair Screen Time" |
| `constellation_1` | Recolour Edition | Raise any hero to C1. | `max p.heroes.*.constellation ≥ 1` | 30 ♦ |
| `constellation_6` ● | Fully Awakened (Final Form) | Bring any hero to C6. | `max constellation ≥ 6` | 320 ♦ · title "Final Form" |
| `capstone` | Character Arc Complete | Take any tier-5 talent. | any `p.heroes.*.talents` node of tier 5 with rank ≥ 1 | 40 ♦ |
| `two_arcs` | Two Full Arcs | Spend all 30 talent points on one hero. | `max points spent ≥ 30` | 150 ♦ |
| `clear_hoshi` | Star of the Show | Clear a stage as Hoshi. | `life.heroesCleared has hoshi` | 60 ♦ |
| `hoshi_stars` | Ten Thousand Wishes | Defeat 10,000 enemies with Star Shot (or Galaxy Barrage). | `life.killsByWeapon.star_shot ≥ 10,000` | 80 ♦ |
| `clear_rin` | Blade of the Shrine | Clear a stage as Rin. | `has rin` | 60 ♦ |
| `rin_blossoms` | Thousand Blossom Accountant | Deal 1,000,000 damage with Petal Slash (or Sakura Tempest). | `life.damageByWeapon.petal_slash ≥ 1,000,000` | 80 ♦ |
| `clear_mochi` | Cat's Out of the Bag | Clear a stage as Mochi. | `has mochi` | 60 ♦ |
| `mochi_yarn_only` | Loyal to the Yarn | Clear a stage as Mochi using no weapon but Yarn Orbit (and its evolutions). | `run.stageCleared && run.hero = mochi && run.weaponsUsed ⊆ {yarn_orbit, cosmic_yarn, meowteor_hammer}` | 120 ♦ · hidden |
| `clear_kuro` | The Abyss Gazes Back | Clear a stage as Kuro. | `has kuro` | 60 ♦ |
| `kuro_overdrive` | Chuuni Overload | Use Overdrive 8 times in one run as Kuro. | `run.hero = kuro && run.ults ≥ 8` | 80 ♦ |
| `clear_pudding` | Order Up! | Clear a stage as Pudding. | `has pudding` | 60 ♦ |
| `pudding_heal` | Five-Star Service | Heal 1,000 HP in one run as Pudding. | `run.hero = pudding && run.healed† ≥ 1,000` | 80 ♦ |
| `clear_aoi` | Mission Complete (License Pending) | Clear a stage as Aoi. | `has aoi` | 60 ♦ |
| `aoi_spaghetti` | Spaghetti Code | Defeat 2,000 enemies with Micro Missile Swarm (or Al Dente Armageddon) in one run. | `run.killsByWeapon.micro_missile_swarm + run.killsByWeapon.al_dente_armageddon ≥ 2,000` | 80 ♦ |
| `clear_akane` | N-Not Like I Wanted to Win | Clear a stage as Akane. | `has akane` | 60 ♦ |
| `akane_baka` | BAKA ×100 | See 100 BAKA! pops in one run. | `run.bakas† ≥ 100` | 60 ♦ |
| `clear_senpai` | Noticed (Finally) | Clear a stage as Senpai. | `has senpai` | 60 ♦ |
| `senpai_charm` | Fan Club President | Charm 300 enemies in one run. | `run.charmed† ≥ 300` | 80 ♦ |
| `clear_mg47` | Remembered (For Now) | Clear a stage as Magical Girl #47. | `has magical_girl_47` | 60 ♦ |
| `mg47_henshin` | Transformation Sequence #47 | Transform 47 times in one run. | `run.henshins† ≥ 47` | 147 ♦ |
| `clear_isekai` | Another World, Another Clear | Clear a stage as Isekai-kun. | `has isekai_kun` | 60 ♦ |
| `isekai_overdo` | Did I Overdo It? | Overdo 30 fireballs in one run. | `run.overdos† ≥ 30` | 80 ♦ |
| `clear_truck` | Delivered | Clear a stage as Truck-kun. | `has truck_kun` | 60 ♦ |
| `truck_isekai` | Reincarnation Services | Isekai 1,000 enemies in one run. | `run.isekaid† ≥ 1,000` | 120 ♦ |

## 5. Weapons (37)

| id | Name | Description | Condition | Reward |
| --- | --- | --- | --- | --- |
| `evolve_1` ● | Glow-Up | Evolve a weapon. | `life.evolutions ≥ 1` | 30 ♦ |
| `evolve_10` | Origami Is Just Paper Evolving | Evolve 600 weapons. A thousand folds grant a wish; the other 400 are DLC. | `life.evolutions ≥ 600` | 300 ♦ · unlock `paper_crane_flock` |
| `evolve_25` ● | Transformation Sequence Addict | Evolve 25 weapons. | `life.evolutions ≥ 25` | 120 ♦ |
| `evolve_6_run` ● | Six-Evolution Spectacle | Hold 6 evolved weapons in one run. | `life.maxEvolutions ≥ 6` | 160 ♦ |
| `boba_origins` | Tapioca Origins | Defeat 1,000 Puffs. They're chewy. | `life.killsByEnemy.puff ≥ 1,000` | 40 ♦ · 60 ★ · unlock `bubble_tea_cannon` |
| `snacks_50` | Growing Hero | Eat 50 snacks. | `life.foodEaten ≥ 50` | 30 ♦ · unlock `bento_box` |
| `dashes_500` | Feel the Speed Lines | Dash 500 times. | `life.dashes ≥ 500` | 30 ♦ · unlock `speed_lines` |
| `mastery_5` ● | Limit Break! | Reach mastery rank 5 with any weapon. | best mastery rank `≥ 5` | 60 ♦ |
| `mastery_10` ● | MASTERED | Reach mastery rank 10 with any weapon. | best mastery rank `≥ 10` | 200 ♦ · title "Weapon Otaku" |
| `mastery_5x5` | Limit Breaker | Reach mastery rank 5 with 5 weapons. | `count(rank ≥ 5) ≥ 5` | 150 ♦ |
| `mastery_10x5` | Five Masterpieces | Reach mastery rank 10 with 5 weapons. | `count(rank ≥ 10) ≥ 5` | 400 ♦ |
| `mastery_all` | Arsenal: MASTERED | Reach mastery rank 10 with all 20 weapons. | `count(rank ≥ 10) ≥ 20` | 1,000 ♦ · title "Weapon Encyclopedia" |
| `arsenal_8` ● | Arsenal Otaku | Discover 8 weapons in the codex. | `p.codex.weapons.length ≥ 8` | 50 ♦ |
| `arsenal_20` | Full Arsenal | Discover all 20 base weapons. | base weapons in `p.codex.weapons` `≥ 20` | 150 ♦ |
| `evolutions_all` | Evolution Encyclopedia | Discover all 20 evolutions. | evolutions in `p.codex.weapons` `≥ 20` | 400 ♦ |
| `passives_all` | Fully Accessorised | Discover all 16 passives. | `p.codex.passives.length ≥ 16` | 100 ♦ |
| `seven_weapons` | Seven-Weapon Sampler | Hold 7 weapons at once. | `run.maxWeaponsHeld† ≥ 7` | 80 ♦ |
| `evo_galaxy_barrage` | Galaxy Brain | Evolve Galaxy Barrage. | `p.codex.weapons has galaxy_barrage` | 20 ♦ |
| `evo_sakura_tempest` | Petal to the Metal | Evolve Sakura Tempest. | `has sakura_tempest` | 20 ♦ |
| `evo_cosmic_yarn` | Ball of Infinite Yarn | Evolve Cosmic Yarn. | `has cosmic_yarn` | 20 ♦ |
| `evo_love_tornado` | Whirlwind Romance | Evolve Love Tornado. | `has love_tornado` | 20 ♦ |
| `evo_raijin_drum` | Drum Solo | Evolve Raijin Drum. | `has raijin_drum` | 20 ♦ |
| `evo_sugar_nuke` | Tactical Sweetness | Evolve Sugar Nuke. | `has sugar_nuke` | 20 ♦ |
| `evo_ocean_dome` | Bath Time Is Over | Evolve Ocean Dome. | `has ocean_dome` | 20 ♦ |
| `evo_rainbow_cannon` | Full Spectrum Argument | Evolve Rainbow Cannon. | `has rainbow_cannon` | 20 ♦ |
| `evo_unsealed_abyss_dragon` | He Was Right All Along | Evolve Unsealed Abyss Dragon. The flames are black now. | `has unsealed_abyss_dragon` | 30 ♦ |
| `evo_eternal_tea_party` | Bottomless Refills | Evolve Eternal Tea Party. | `has eternal_tea_party` | 30 ♦ |
| `evo_al_dente_armageddon` | Al Dente Achieved | Evolve Al Dente Armageddon. | `has al_dente_armageddon` | 30 ♦ |
| `evo_dere_dere_harisen` | ...B-Baka ♡ | Evolve Dere Dere Harisen. | `has dere_dere_harisen` | 30 ♦ |
| `evo_shoujo_filter` | Screentone Overload | Evolve Shoujo Filter. | `has shoujo_filter` | 30 ♦ |
| `evo_infinite_henshin_loop` | Still Transforming | Evolve Infinite Henshin Loop. | `has infinite_henshin_loop` | 30 ♦ |
| `evo_cheat_meteor` | He Trained (Once) | Evolve Meteor Lv.99999. | `has cheat_meteor` | 30 ♦ |
| `evo_isekai_rush_hour` | Gridlock to Another World | Evolve Isekai Rush Hour. | `has isekai_rush_hour` | 30 ♦ |
| `evo_tapioca_tsunami` | Tapioca Tsunami Warning | Evolve Tapioca Tsunami. | `has tapioca_tsunami` | 30 ♦ |
| `evo_thousand_crane_wish` | Wish Granted | Evolve Thousand Crane Wish. | `has thousand_crane_wish` | 30 ♦ |
| `evo_sold_out_dome_tour` | Sold Out (Emotionally) | Evolve Sold-Out Dome Tour. | `has sold_out_dome_tour` | 30 ♦ |
| `evo_eternal_winter_break` | Never Leaving the Kotatsu | Evolve Eternal Winter Break. | `has eternal_winter_break` | 30 ♦ |

## 6. Gacha (25)

| id | Name | Description | Condition | Reward |
| --- | --- | --- | --- | --- |
| `first_pull` ● | Just One Pull | Pull the Merch Machine once. Just one. Surely. | `gacha.pulls ≥ 1` | 160 ♦ (it pays the pull back) |
| `first_ten_pull` | The Ten-Pull | Do a 10-pull. Feel the guarantee. | `gacha.tenPulls ≥ 1` | 40 ♦ |
| `pulls_100` ● | Pity Party | Pull 100 times. | `gacha.pulls ≥ 100` | 160 ♦ |
| `pulls_300` | UR Pity Pilgrim | Pull 300 times. | `gacha.pulls ≥ 300` | 240 ♦ |
| `pulls_1000` ● | The Thousand-Pull Pilgrimage | Pull 1,000 times. | `gacha.pulls ≥ 1,000` | 800 ♦ · title "Whale (Platonic)" |
| `gacha_hell` ● | Gacha Hell | Pull 10 N items in a row. | `gacha.nStreakBest ≥ 10` | 80 ♦ |
| `gacha_hell_25` | Gacha Hell: Director's Cut | Pull 25 N items in a row. | `gacha.nStreakBest ≥ 25` | 160 ♦ · hidden |
| `lost_5050` ● | LOST THE 50/50 | Lose a 50/50. Here's a consolation prize. It's gems. It's always gems. | `gacha.lost5050 ≥ 1` | 80 ♦ |
| `lost_5050_3` | Three-Time Loser (Affectionate) | Lose three 50/50s. | `gacha.lost5050 ≥ 3` | 120 ♦ |
| `won_5050` | Coin Flip Champion | Win a 50/50. | `gacha.won5050 ≥ 1` | 60 ♦ |
| `first_ssr` ● | Gold Meteor | Pull an SSR or better. | `byRarity SSR+UR+LR+MYTHIC ≥ 1` | 50 ♦ |
| `first_ur` | Rainbow Meteor | Pull a UR or better. | `byRarity UR+LR+MYTHIC ≥ 1` | 120 ♦ |
| `first_lr` | Legendary (Actually) | Pull an LR or better. | `byRarity LR+MYTHIC ≥ 1` | 240 ♦ |
| `mythic` ● | Whale-Sized Luck | Pull a MYTHIC. The odds were 0.0069%. Nice. | `byRarity.MYTHIC ≥ 1` | 800 ♦ · title "Literally Chosen" · hidden |
| `hard_pity` | The Machine Felt Bad | Get an SSR from hard pity. | `gacha.hardPityHits† ≥ 1` | 80 ♦ |
| `spark_used` | Spark Plug | Claim the 1,000-pull spark. | `gacha.sparksUsed ≥ 1` | 200 ♦ · title "Spark Plug" |
| `truck_owned` | It Found You | Own Truck-kun. | `p.unlocks.heroes has truck_kun` | 400 ♦ · hidden |
| `relics_10` ● | Merch Collector | Own 10 different relics. | `count(p.relics) ≥ 10` | 80 ♦ |
| `relics_30` | Merch Hoarder | Own 30 different relics. | `≥ 30` | 160 ♦ |
| `relics_all` | Complete Merch Catalogue | Own all 61 relics. | `≥ 61` | 1,500 ♦ · title "Merch Completionist" |
| `relic_star_6` | Fully Merched | Raise any relic to ★6. | `max relic stars ≥ 6` | 160 ♦ |
| `cone_zone` | Foreshadowing | Raise the Traffic Cone to ★6. It's coming. | `p.relics.traffic_cone.stars ≥ 6` | 40 ♦ |
| `copium_1000` | Professional Coper | Earn 1,000 Copium. | `gacha.copiumEarned ≥ 1,000` | 100 ♦ |
| `exchange_buy` | Copium Connoisseur | Buy anything from the Copium Exchange. | `gacha.exchangeBuys ≥ 1` | 30 ♦ |
| `gem_exchange` | Terrible Deal | Use the Gem Exchange. You know the rate. You did it anyway. | `gacha.gemExchanges† ≥ 1` | 10 ♦ |

## 7. Silly (21)

| id | Name | Description | Condition | Reward |
| --- | --- | --- | --- | --- |
| `speedrun` ● | Speedrun Any% | Die within 10 seconds. World record pace. | death with `run.time ≤ 10` (or `life.fastestDeath ≤ 10`) | 69 ♦ · hidden |
| `pacifist` ● | Pacifist? | Survive 60 seconds without any weapon dealing damage (the Kotatsu understands). | `max(life.pacifistBest, run.pacifistBest) ≥ 60` | 60 ♦ · hidden |
| `no_dash` ● | Allergic To Dashing | Survive 3:00 in one run without dashing. | `life.noDashBest ≥ 180` | 30 ♦ · unlock `kotatsu_of_sloth` |
| `touch_grass` ● | Touch Grass | Eat 100 snacks from lanterns and gift boxes. | `life.foodEaten ≥ 100` | 20 ♦ |
| `episode_100` ● | Long-Running Series | Play 100 runs. The show has outlived its manga. | `life.runs ≥ 100` | 160 ♦ · 2,500 ★ |
| `tax_brackets` ● | Tax Brackets | Hold 100,000 Star Coins at once. | `p.currencies.coins ≥ 100,000` | 50 ♦ |
| `flesh_wound` ● | Back After the Commercial Break | Get revived. The death was fake. The tears were real. | `life.revivesUsed ≥ 1` | 20 ♦ |
| `deaths_50` ● | TO BE CONTINUED | Get defeated 50 times. Every cliffhanger counts. | `life.deaths ≥ 50` | 80 ♦ |
| `do_not_disturb` | Do Not Disturb | Stay Too Comfy in the Kotatsu for 2:00 straight. | `run.comfyBest† ≥ 120` | 60 ♦ · hidden |
| `wisp_death` | Should've Blown Out the Candle | Be defeated by a Candle Wisp. | `run.killedBy† = wisp` | 20 ♦ · hidden |
| `isekaid` | Isekai'd | Be defeated by Truck-kun or a Mini Truck-kun. See you in the next world. | `run.killedBy† ∈ {truck_kun_boss, mini_truck}` | 50 ♦ · title "Reincarnated" · hidden |
| `saving_it` | Saving It for Later | Be defeated with Overdrive fully charged. | `run.ultReadyAtDeath† = 1` | 20 ♦ · hidden |
| `commitment_issues` | Commitment Issues | Reroll 20 times in one run. | `run.rerollsUsed ≥ 20` | 40 ♦ |
| `not_my_type` | Not My Type | Banish 5 cards in one run. | `run.banishesUsed ≥ 5` | 30 ♦ |
| `nani_100` | NANI?! ×100 | See 100 NANI?! pops in one run. | `run.nanis† ≥ 100` | 40 ♦ |
| `background_character` | Background Character | Survive 1:00 with fewer than 10 kills. Very low profile. | `run.time ≥ 60 && run.kills < 10` | 20 ♦ · hidden |
| `dropped_after_ep1` | Dropped After Episode 1 | Quit a run within 30 seconds. | `run.outcome = quit && run.time < 30` | 10 ♦ · hidden |
| `censored_clear` | Snack-Free Diet | Clear a stage with Censored active. | `run.stageCleared && run.twists has censored` | 60 ♦ |
| `sequel_hook_clear` | It's Not Over! (It Was) | Clear a stage with Sequel Hook active. | `run.stageCleared && run.twists has sequel_hook` | 60 ♦ |
| `greedy_protagonist` | Greedy Protagonist | Pick up 1,000 coins in one run. | `run.coins ≥ 1,000` | 300 ★ (coins for the greedy) |
| `read_fine_print` | Read The Fine Print | Scroll to the very bottom of the Merch Machine fine print. Nobody does that. | `p.flags.finePrint† = 1` | 69 ♦ · hidden |

---

**Totals:** Story 24 · Combat 28 · Heroes 36 · Weapons 37 · Gacha 25 · Silly 21 =
**171** (41 existing ● + 130 new). Gem total ≈ 24,800 ♦ (≈ 155 pulls; 41,000 before the economy pass) over the
whole 200 h+ journey — the economy pass may scale rewards, not remove entries.
**Economy pass (docs/META.md §4):** every gem reward was halved (rounded to 10; the joke
numbers 69 / 147 / 10 and the 160 ♦ of Pilot Episode and Just One Pull - the first pull and
its refund - stay): with the old totals the Merch Machine handed out a 10-pull every ~2 runs
in the first hour and an SSR / UR relic set that cleared the Final Arc in ~8 h. The early coin
rewards were cut so a Plot Point
never buys a whole board ring in the first hours (Plushie Purge 1,000 → 100 ★,
Treasure Hoarder 1,500 → 600 ★, Ensemble Cast 2,000 → 200 ★, Long-Running Series
5,000 → 2,500 ★, Greedy Protagonist 1,000 → 300 ★, Tapioca Origins 300 → 60 ★), the
Pilot Episode pays 40 ★ (a fresh save's first run always buys two cheap board nodes)
and Origami Is Just Paper Evolving moved to 600 evolutions (300 ♦: Paper Crane
Flock is the late-game unlock, ~40-60 h).

**Titles** (profile card, shown under the player name; the achievement id is the
title id): Dawnbringer · Series Finale · Villain Collector · Filler Veteran ·
Plot Twister · Showrunner's Nightmare · Plushie Nightmare · Flawless · Main
Character · Showrunner · Box Set Collector · Fair Screen Time · Final Form ·
Weapon Otaku · Weapon Encyclopedia · Whale (Platonic) · Literally Chosen ·
Spark Plug · Merch Completionist · Reincarnated.
