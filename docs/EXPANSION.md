# KIRA☆KIRA OVERDRIVE — "Season 2" Expansion Spec

This spec turns the game into an **incremental roguelite built to be played for
hundreds of hours**:

- You start weak and die early.
- Every run pays out, and the payouts buy permanent power.
- Over many runs you become a cute anime death machine.

It keeps everything that works already: the chaotic cute energy, the AAA
juice and the mobile-first controls. On top of that it leans hard into
**satire of anime and gacha games**.

This document is the source of truth for the expansion. Base gameplay rules
still come from `DESIGN.md`. Detailed content (every hero, weapon, enemy,
relic, achievement, talent, board node and satire line) lives in
`docs/CONTENT.md`, the content bible, which must stay consistent with this spec.

Decisions made with the owner:

- The only extra incremental mechanic is a **parody gacha**: banners, pity,
  printed rates, dramatic pulls, a use for dupes, and ridiculous rarities up to
  MYTHIC with god-awful odds.
- **No** idle or offline income, **no** prestige reset, **no** daily or weekly
  challenges.
- Run length **grows with the stage**, from 10 minutes up to 20.

---

## 1. Pillars

1. **Fail forward.**
   - Every run, even a 90-second death, pays out currency.
   - The results screen always ends on "you can afford something".
   - Meta power is visible: the next run is noticeably stronger.
2. **Many dials of power.** Seven independent progression tracks feed one run:
   - the Training Arc board
   - hero levels and talents
   - hero constellations
   - weapon mastery
   - relic loadout and relic stars
   - unlocks
   - Plot Twist difficulty

   Each has its own pace, so there is always a next goal in reach.
3. **Deep builds.** One build is:
   hero × talents × 6 weapons (and evolutions) × 6 passives × 4 relics × twists.
   Synergies must be real. Evolutions, talent keystones and relic hooks change
   *how* weapons behave, not only their numbers.
4. **The game knows it's an anime (and a gacha).** Everything gets the
   satire treatment:
   - a narrator who announces runs as episodes
   - OC-style "DeviantArt profile" bios ("DO NOT STEAL!!")
   - trope enemies with speech bubbles
   - attack names screamed in cut-ins
   - a gacha with fine print

   The satire punches at tropes, never at people.
5. **AAA, chaotic and cute.** New content gets the same juice bar as
   `DESIGN.md §4`. The menus are a destination in their own right, animated and
   satisfying.
6. **Mobile first.** Every new screen must work one-handed in portrait on a
   360×640 phone, and with touch, mouse, keyboard and gamepad.

## 2. Progression arc targets

The "average player" is the balance probe's mid-skill bot. Hours are play
time, about 6 runs per hour early on.

| Milestone | Target |
| --- | --- |
| Run 1 (fresh save) | Dies around 2:00-3:00 in Dream Meadow and earns enough coins for 2-4 cheap board nodes |
| First King Puff kill (3:00 boss) | Runs 3-6 (~0.5-1 h) |
| First Dream Meadow clear | ~1.5-3 h |
| Candy Kingdom clear | ~4-7 h |
| Shoujo Academy clear | ~8-14 h |
| Beach Episode clear | ~15-25 h |
| The Final Arc clear ("Series Finale") | ~30-45 h |
| All gameplay heroes and weapons unlocked | ~40-60 h |
| Board fully bought | ~100-150 h |
| Max Plot Twist heat clears, full hero talents, mastery 10 on every weapon | 200 h+ |
| Full gacha collection incl. MYTHICs | Effectively endless (sparks make it finite) |

**Early difficulty:**
- The current stage 1 is too easy until about 5:00. A fresh save must feel
  real pressure by 1:30 and is expected to die before the first boss.
- Base player power goes down, and early enemy toughness and density go up.
- The board's first ring makes the first 3 minutes winnable within an hour.

**Account-power checkpoints** (the contract between the combat curve and the
economy; built and measured by `tools/checkpoints.ts` / `node tools/matrix.mjs`,
contents in META.md §9.1, results in ARCHITECTURE.md §6):

| Checkpoint | Hours | Intended clear (~40-70 % for the mid bot) |
| --- | --- | --- |
| P0 fresh save | 0 | - (dies ~2:30-4:00 in Dream Meadow) |
| P1 a few ring-1 nodes | ~1 | - (reaches King Puff) |
| P2 ring 1 done, Lv 10 | ~3 | Dream Meadow |
| P3 ring 2, Lv 15, 2 relics | ~8 | Candy Kingdom |
| P4 ring 3 started, Lv 20 | ~15 | Shoujo Academy |
| P5 ring 4 started, Lv 25, 4 relics | ~30 | Beach Episode (and the Final Arc's lower end) |
| P6 ring 5 half, Lv 30 | ~80 | The Final Arc |
| P7 near max | ~150 | Plot Twist heat: melts the Final Arc at heat 12, works at heat 41 |

A stage's first clear lands a little before its intended checkpoint (a player
retries at 10-30 % clear chances), which is how the milestone hours above line
up with the checkpoint hours. Measured against these targets (economy pass, progression
simulator): ARCHITECTURE.md §6.6. Boss fights at the intended checkpoint: King Puff
(the 3:00 tutorial boss) 20-45 s, other mid bosses 45-60 s, finals 75-100 s,
Cancel-sama ~150 s.

**Late power:** a max-progression account is a death machine, with an evolved
build by 3:00 and screens melting constantly. Plot Twists are what keep it
challenging.

## 3. Currencies

| Currency | Look | Earned from | Spent on |
| --- | --- | --- | --- |
| **Star Coins** | ★ gold | Picked up in runs, plus the end-of-run payout (time, kills, bosses, rank, heat) | Training Arc board nodes, hero level-ups (optional accelerator), talent respec |
| **Dream Gems** ("definitely not premium currency") | ♦ pink crystal | First clears, boss first kills, achievements, codex entries, milestone rewards, a small per-run trickle, and a joke "Gem Exchange" that converts coins at a terrible rate | Gacha pulls |
| **Copium** | pastel pill capsule | Gacha dupes beyond max stars, plus a little per pull ("consolation") | Copium Exchange: buy a chosen relic, hero or pull, or pity insurance |
| **Hero XP** | per hero | Runs played with that hero (time + kills) | Automatic hero levels 1-30 → talent points |
| **Mastery XP** | per weapon | Damage dealt with that weapon | Automatic mastery ranks 1-10 |

Numbers are balanced by the progression simulator (§13). Gacha is fed only by
gems from play: there is no real money and no ads. The satire is the point.

## 4. Run payout ("Episode Results")

The results screen becomes a show:

1. The "Episode N" title card and "TO BE CONTINUED →" banner on death,
   or "SERIES FINALE?!" on a clear.
2. The payout ticks up line by line: coins picked up, the time bonus, the kill
   bonus, each boss, then greed, the rank grade and the stage's **Ratings**
   (x1 Dream Meadow ... x8 the Final Arc) on those episode bonuses, and the heat
   multiplier on everything (formulas: META.md §4).
3. Hero XP and weapon mastery bars fill, with level-up pops.
4. Achievement unlock cards and new unlocks get a full-screen celebration
   ("NEW WEAPON UNLOCKED!").
5. A narrator line ("Next time on Kira Kira Overdrive: Hoshi learns about tax
   brackets!").
6. Buttons: **Upgrade** (goes straight to the board, with affordable nodes
   pulsing), **Retry**, **Hub**.

## 5. Training Arc (the upgrade board)

The upgrade board is a pannable, zoomable **constellation map** of about 120
nodes in 5 rings around a centre "Episode 1" node.

- **Ring gating:** each ring unlocks by clearing the matching stage (ring 2
  needs a Dream Meadow clear, and so on), so the board grows with the story.
- **Node types:**
  - **Stat nodes:** might, max HP, regen, armor, move speed, cooldown, area,
    amount, projectile speed, duration, pickup, crit, crit damage, luck,
    growth (XP), greed (coins), gem find, dash cooldown, curse (more enemies
    and more rewards).
  - **Utility nodes:** +reroll, +banish (remove a card from the pool for the
    run), +skip, +1 card choice, start at level N, start with a chosen weapon
    at Lv2, +relic slot (1 → 4), +weapon slot (6 → 7), +passive slot (6 → 7),
    revive (up to 2), +dash charge (up to 3), Overdrive starting charge,
    chest luck, elite frequency.
  - **Keystones:** about 10 big build-defining nodes on the outer ring, each
    with a satire name and a trade-off, e.g.
    - "Glass Cannon Arc": +60% damage, −40% HP
    - "Power of Friendship": +4% damage for each different weapon you hold
    - "Plot Armor": once per run, survive a lethal hit
- Costs grow with the ring and the node, from about 15 coins on ring 1 to
  tens of thousands on ring 5.
- Respec costs coins (cheap) so players can experiment.
- Mobile: pinch zoom, drag to pan, tap a node for a detail card with a BUY
  button. There is also an "auto-path" button that shows the cheapest
  affordable nodes. Affordable nodes pulse.
- Replaces the old Dream Shop. v1 saves are refunded (see §14).

## 6. Heroes

There are 11 heroes. Each has the same sprite set as today (idle/run/hurt/cast
plus a 64×64 two-expression portrait in the beloved "beginner DeviantArt OC"
style), a start weapon, a trait, an ultimate with a cut-in, an OC bio, and a
talent tree.

| # | Hero | Concept | Start weapon | Ultimate | How unlocked |
| --- | --- | --- | --- | --- | --- |
| 1 | **Hoshi** | star magician (existing) | Star Shot | Supernova Shower | start |
| 2 | **Rin** | shrine swordswoman (existing) | Petal Slash | Thousand Blossom Cut | defeat King Puff |
| 3 | **Mochi** | neko-girl (existing) | Yarn Orbit | Nyan Stampede | 3,000 lifetime kills |
| 4 | **Kuro** | chuunibyou "Lord of the Abyssal Flame" (14, eyepatch, bandaged "sealed" arm, cape) | Dark Flame Dragon (a tiny salamander that breathes fire) | FORBIDDEN TECHNIQUE: ETERNAL ABYSS (it's a large shadow) | reach 6:00 in Dream Meadow |
| 5 | **Pudding** | maid café maid ("Welcome home, Master~!") | Teapot Tempest (teacups orbit and spill tea puddles that heal you and scald enemies) | Omurice of Love: Moe Moe Kyun! | clear Dream Meadow |
| 6 | **Aoi** | mecha pilot in a chibi mech | Micro Missile Swarm (a tangle of spaghetti missile trails) | GET IN THE ROBOT (a giant fist from the sky) | clear Candy Kingdom |
| 7 | **Akane** | tsundere with drill twin-tails | Baka Harisen (a paper-fan smack, huge knockback, "BAKA!" pops) | It's Not Like I Like You!! Barrage | clear Shoujo Academy |
| 8 | **Senpai** | sparkly bishounen (gacha SSR) | Notice-Me Sparkles (sparkle aura that charms enemies into fighting each other) | SENPAI NOTICED YOU (everything swoons) | gacha or Copium |
| 9 | **Magical Girl #47** | aggressively generic magical girl nobody remembers the name of (gacha SSR) | Henshin Burst (periodic invulnerable transformation blasts) | Episode-Long Transformation Sequence | gacha or Copium |
| 10 | **Isekai-kun** | beige overpowered protagonist (gacha UR) | Cheat Skill: Fireball Lv.9999 ("Did I overdo it again?") | STATUS SCREEN!! | gacha or Copium |
| 11 | **Truck-kun** | the isekai truck itself, playable (gacha MYTHIC) | Horn of Reincarnation (honk shockwave cone + ramming contact damage) | ISEKAI EXPRESS | gacha MYTHIC banner only, or 1,000-pull spark |

**Hero level** (1-30 from hero XP):
- Each level gives a small flat bonus (+1% damage and +1% HP).
- Every level gives a talent point.

**Talents:**
- 3 branches × 5 tiers per hero, with ranks per node and a capstone that
  changes the ultimate or the start weapon.
- Example, Hoshi:
  - "Idol Arc": more projectiles, and the ult adds an encore.
  - "Plot Armor": shields.
  - "Star Power": crits.

**Constellations C0-C6:**
- Each dupe from the gacha adds one star.
- Each star is a real bonus with a satire name, e.g. C1 "Recolour Edition",
  C6 "Fully Awakened (Final Form)".

**Bios:** OC-profile style. Name with ~*~ sparkles, age, height ("(with
hair)"), likes and dislikes, power level, theme song, "DO NOT STEAL/REPOST!!".

## 7. Weapons, passives, mastery

**Weapons:** 20 in total (8 existing + 12 new), each with an evolution, so
40 weapon definitions.

**The 12 new weapons:**
- **8 hero signature weapons:** Dark Flame Dragon, Teapot Tempest, Micro
  Missile Swarm, Baka Harisen, Notice-Me Sparkles, Henshin Burst, Cheat
  Fireball, Horn of Reincarnation.
- **4 general weapons:**
  - Bubble Tea Cannon (bouncing boba)
  - Paper Crane Flock (homing origami)
  - Idol Lightstick Wave (pulses on the music's beat)
  - Kotatsu of Sloth (sleepy-slow aura)

**Passives:** 16 in total (8 existing + 8 new):
- Plot Armor (damage reduction)
- Main Character Aura (crit damage)
- Bento Box (healing and regen)
- Speed Lines (projectile speed)
- Inner Monologue (duration)
- Training Montage (XP)
- Friendship Bracelet (damage per unique weapon)
- Chibi Charm (smaller hitbox, wider pickup)

Every evolution pairs a weapon with a passive.

**Unlocks are earned through play.** Every new weapon and passive has an
unlock condition shown as a "???" hint in the codex, for example:
- kill 1,000 Puffs → Bubble Tea Cannon
- survive 3:00 without dashing → Kotatsu of Sloth
- reach SSS rank → Idol Lightstick Wave

A hero's signature weapon unlocks with the hero. The weapons have to be
unlocked before the level-up card pool offers them.

**Mastery ranks 1-10** (from damage dealt):
- +3% damage per rank.
- Rank 5: **Limit Break**, max level 5 → 6 with a listed bonus.
- Rank 10: max level 7, plus a gold icon frame and a "MASTERED" badge in the
  codex.

## 8. Relics ("Merch") and loadout

Relics are equipped before a run:
- 1 slot at the start, up to 4 via the board.
- Rarities: N, R, SR, SSR, UR, LR, MYTHIC.
- About 60 relics:

  | Rarity | Count |
  | --- | --- |
  | N | 12 |
  | R | 14 |
  | SR | 12 |
  | SSR | 10 |
  | UR | 6 |
  | LR | 4 |
  | MYTHIC | 3 |

Effects scale with rarity:
- **N:** small stats, e.g. "Slightly Bent Spoon: +3% might".
- **Higher rarities:** event hooks, e.g. "Limited Edition Acrylic Stand: kills
  have a 2% chance to drop a tiny heart".
- **SSR and above:** mechanics changes.
- **MYTHIC:** absurd, run-defining effects, for example:
  - "Infinite Gacha Credit Card": every level-up offers 6 cards and rerolls
    are free.
  - "A Real Friend": a second copy of your hero fights beside you.
  - "The Final Episode Script": Overdrive is always ready.

**Relic stars:** each dupe adds a star, up to 6 (★0-★6), and boosts the
relic's effect. Dupes past ★6 turn into Copium.

## 9. The Merch Machine (parody gacha)

Full-commitment satire with real, exciting mechanics.

- **Banners** (tabs in the Merch Machine):
  - **"Permanent Banner: Totally Normal Merch"** (standard pool).
  - **Featured Hero banner:** 50% rate-up on one SSR/UR hero. It rotates
    **every 3 runs**, with a "BANNER ENDS IN 2 RUNS!!" FOMO joke and a
    countdown in runs, not real time.
  - **Featured Relic banner:** same rotation.
  - **"Truck-kun's Isekai Express" MYTHIC banner:** permanent and cursed.
    The fine print is very long.
- **Cost:** 160 ♦ per pull, or 1,600 ♦ for 10. A 10-pull guarantees SR or
  better.
- **Rates** (shown on a fine-print screen that is deliberately too long):

  | Rarity | Rate |
  | --- | --- |
  | N ("Normie") | 52% |
  | R | 30% |
  | SR | 13.5% |
  | SSR | 3.6% |
  | UR | 0.75% |
  | LR | 0.14% |
  | **MYTHIC** | **0.0069%** ("nice") |

- **Pity:**
  - Soft pity from pull 74, hard pity at 90 for SSR or better.
  - Featured 50/50 with a guarantee after a loss; losing shows a "LOST THE
    50/50" toast and a sad trombone.
  - UR pity at 300.
  - **MYTHIC spark at 1,000 pulls:** pick any MYTHIC.
  - Pity counters are visible and persistent per banner type.
- **Dupes:** they become hero constellations or relic stars, with an animated
  "★ UP!". Past the cap they become Copium.
- **Copium Exchange:** buy specific heroes, relics, pulls, or "Pity
  Insurance" (+10 pity) with Copium.
- **Pull animation** (the big AAA moment):
  1. Summoning circle and charging music.
  2. A falling meteor or capsule whose colour reveals the best rarity of the
     pull: blue, purple, gold, rainbow (UR/LR), then **glitch** (MYTHIC).
  3. Cards flip one by one.
  4. SSR and above get a full-screen splash with the portrait or relic art
     and a dramatic title.
  5. **MYTHIC breaks the game on purpose:** the screen cracks, a fake system
     error ("KAWAII_OVERFLOW 0xDEADBEEF"), the music cuts, then everything
     explodes into rainbow confetti, the narrator screams, and the rarity
     title stamps in.
  6. A skip button ("Skip? …fine.").
  7. A 10-pull summary grid.
- **History log** of the last 100 pulls and a stats screen (pulls, gems
  "spent", "money you'd have spent IRL: $0 (we checked)").

## 10. Stages, endless and Plot Twists

| # | Stage | Length | Enemies (5-6 new each, plus elites) | Bosses (mid / final) | How unlocked |
| --- | --- | --- | --- | --- | --- |
| 1 | **Dream Meadow** (existing) | 10:00 | existing 8 | King Puff 3:00, Nightmare Teddy 6:00, Lady Lunatic 9:00 | start |
| 2 | **Candy Kingdom** (sugar rush) | 12:00 | Gummy Bear, Candy Corn Soldier, Donut Roller, Marshmallow Brute, Lollipop Mage | Gingerbread Golem 6:00, Sugar Plum Tyrant 11:00 | clear 1 |
| 3 | **Shoujo Academy** (anime high school) | 14:00 | Hall Monitor, Love Letter swarm, Tsundere Slime (flees when hit, "I-it's not like…"), Transfer Student (teleports in), Exam Paper ("F-"), Student Council Ninja | Student Council President 7:00, The Bishounen Who Never Notices You 13:00 | clear 2 |
| 4 | **Beach Episode** (the obligatory one, kept wholesome) | 16:00 | Crab-kun (sidestep), Seagull dive swarm, Jellyfish, Watermelon (rolls and splits), Sandcastle Golem, Tiny Shark | Kraken-chan 8:00, Summer Festival Firework Dragon 15:00 | clear 3 |
| 5 | **The Final Arc** | 20:00 | Shadow Clone (a dark copy of your hero), Filler Episode Goon, Plot Hole (a black hole that pulls), Animation Error (glitchy corrupted sprites), Mini Truck-kun (lane charges) | Truck-kun 8:00, Rival-chan 14:00, **CANCEL-SAMA, the Network Executive** 19:00 | clear 4 |

**Cancel-sama** is the series finale boss. The game itself degrades through
its phases:
- **"Ratings Drop":** the colour grade desaturates.
- **"Budget Cuts":** the render scale drops to half resolution and the
  animation frame rate drops.
- **"Rushed Ending":** speed lines and still frames.
- **The win:** "RENEWED FOR SEASON 2!!"

**Each stage has its own:**
- tile set (8 variants), deco and props
- colour-grade arc and ambient particles (petals, sprinkles, cherry-blossom
  hallway dust, sea spray, glitch motes)
- battle and boss music
- timeline (phases and events)
- unlock requirement
- reward multiplier

**Endless "Filler Arc":**
- After a clear, the player can continue. Scaling keeps rising and periodic
  elite and boss rematches loop.
- Rewards keep counting, so a "best endless time" is recorded per stage.

**Plot Twists** (Hades-heat-style opt-in modifiers, unlocked after the first
clear of a stage):
- About 14 twists, each with 1-3 ranks and a heat value per rank. Examples:
  - Budget Cuts: enemy HP +25%
  - Filler Overload: spawns +30%
  - Rushed Production: bullets +30% speed
  - Censored: no healing pickups
  - Cliffhanger: −40% max HP
  - Power Creep: elites ×2
  - Spoilers: no boss warnings
  - Shounen Rival: a rival periodically hunts you
  - Mid-Season Break: no rerolls
  - Dub Version: enemies 15% faster
- Total heat adds +X% coins and gems.
- The best heat cleared per stage is recorded, with badges at heat 4, 8, 16
  and 32.

## 11. Achievements ("Plot Points") and codex

**Achievements:** about 150, grouped into categories:
- Story (stage clears)
- Combat
- Heroes (per-hero goals)
- Weapons (unlocks and mastery)
- Gacha (e.g. "Gacha Hell": 10 N items in a row; "Whale-Sized Luck": pull a
  MYTHIC)
- Silly (e.g. "Speedrun Any%": die within 10 seconds; "Pacifist?": survive
  60 seconds with no weapons firing, via the Kotatsu)

Each has a progress bar, rewards (gems, coins, unlocks, titles) and a toast
in-run when it unlocks (rate-limited, never covering the hero).

**Codex** (the "Kira Kira Wiki"), with these tabs:
- Heroes: OC bios and constellations.
- Weapons: stats, mastery and evolution recipes once discovered.
- Enemies: kill counts and wiki-style trope blurbs.
- Bosses
- Relics: owned and star level.
- Stages: best time, best heat and endless record.

Undiscovered entries show silhouettes with hint text. Discovering entries
pays small gem bounties.

## 12. Satire bible (tone)

- **Voice:** an over-excited anime narrator plus self-aware gacha marketing
  copy. Short, punchy, quotable.
- **Devices:**
  - episode title cards at run start ("Episode 47: The Puffs Have a Union
    Now?!")
  - "TO BE CONTINUED →" on death
  - screamed attack names
  - "NANI?!" pops on big crits (rate-limited)
  - trope enemies with 1-3 word speech bubbles
  - fake fine print
  - OC bios
  - "Next time on…" teasers
  - rarity titles that are far too dramatic
- **Never:**
  - sexualised content of any kind (the Beach Episode stays crabs and
    watermelons)
  - jokes at real people or groups
  - real franchise or character names
  - copyrighted lines

Parody the **tropes**, not specific works.

## 13. Balance and economy tooling (required)

A headless **progression simulator** (in `tools/` plus `npm run progression`)
plays many consecutive runs:
1. A bot of configurable skill plays each run with the account's real
   RunConfig.
2. Rewards are applied.
3. A spending policy buys board nodes greedily by value, levels talents,
   pulls the gacha when it has 10-pull gems, and equips the best relics.

It reports **hours (and runs) to each milestone in §2**, currency
income/spend curves, and power curves. The economy is tuned until those
targets hold for the mid-skill bot, a weak bot is roughly 1.5-2× slower, and
a strong bot is roughly 0.6× the time.

The headless world must stay fast: a 20-minute stage simulates in under ~5 s.

## 14. Technical requirements

**Layering:**
- `src/game` holds the pure sim plus content definitions, including stages,
  relic behaviour, talent behaviour and Plot Twists.
- `src/meta` is a NEW pure layer: profile, economy, board, gacha,
  achievements, unlocks, rewards and the loadout → RunConfig builder. It has
  no DOM.
- `src/ui` holds the hub screens.
- Only `src/ui` touches localStorage, through `save.ts`.

**Contract:** `src/game/run-config.ts` (`RunConfig`, `RunStats`).
- `World` takes `{ run: RunConfig }`.
- `RunSummary` carries `stats: RunStats`.
- The default config is Dream Meadow with everything unlocked, so the
  current tests keep working.

**Registries:** via `import.meta.glob`, as today. One file per stage, enemy,
boss, weapon, relic group, talent tree, twist group and achievement group.
Adding content never means editing a shared index.

**Save v2:** `kko.save.v2` (profile).
- Migration from v1:
  - keep coins, settings, bests and run counts
  - refund the coins spent in the old Dream Shop
  - unlock Rin and Mochi for existing players
  - grant a 10-pull "Welcome to Season 2" gift
- Every field is sanitised. Corrupt data never blocks boot.
- An export/import save string sits in settings, as base64 text copied with a
  button.

**Hub UI:** a navigation stack with tabs and a shared component kit
(currency bar, buttons, tabs, cards, lists, detail sheets, confirm dialogs,
toasts, badges). Animated transitions, the Android Back guard,
keyboard/gamepad focus, safe areas, and 60 fps on phones (`contain`, no
layout thrash).

**Art:** new sprite ids are appended to `src/art/manifest.ts`. Art agents
iterate with `npm run sprites`, and new heroes and portraits match the
existing style.

**Audio:**
- `src/audio/api.ts` gains new SfxIds and MusicTracks additively: hub, gacha
  (plus a MYTHIC sting), 4 stage battle themes, and 4 boss/finale themes.
- All of it stays synthesised.

**Quality gates per wave:** typecheck, `npm test`, sprite validation, both
builds, e2e, and a screenshot review on desktop, iPhone SE and iPhone 13
(portrait and landscape).

## 15. Delivery waves

1. **Foundations**
   - meta core and save v2
   - stage system, gating, endless, twists and relic/talent hooks in the sim
   - the content bible and manifest additions
   - the hub UI framework
2. **Meta features**
   - Training Arc board UI
   - heroes screen (levels, talents, bios)
   - the Merch Machine (logic, UI and pull animations)
   - payout/results v2, achievements and codex
   - audio additions
3. **Art:** heroes and portraits, stage tile sets/deco/props, enemies,
   bosses, weapon/relic/icon art.
4. **Content code:** new heroes (ults, talents, signature weapons), the
   general weapons and passives, stages 2-5 (enemies, bosses, timelines),
   relic behaviours, achievements.
5. **Economy:** the progression simulator and tuning to §2.
6. **QA wave:** review lenses → triage → fixes → regression.
