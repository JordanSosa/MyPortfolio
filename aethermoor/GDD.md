# AETHERMOOR — Game Design Document
### A browser-based MMO vertical slice: *Path of Exile* meets *Flyff*

**Version:** 1.0 · **Scope:** Vertical slice (single zone, full core loop) · **Platform:** Browser (desktop, WebGL)

---

## 1. High Concept

**Aethermoor** is a nostalgic, pastel-skied 3D MMORPG in the spirit of *Flyff* — tab-targeting,
a skill hotbar, cheerful field music, grinding cute-but-deadly mobs for quests — welded to the
deep character-building machinery of *Path of Exile*: a sprawling shared passive tree, skills
customized through drop-only augments and level investment, fully randomized gear affixes across
six rarity tiers, and crafting currencies that drop from monsters and are consumed to reforge items.

The fantasy: *"I'm level 14, I just found an Epic sword with +12% attack speed, I'm three passive
nodes away from the 'Bladestorm' notable, and the boar field music is stuck in my head."*

---

## 2. Design Pillars

1. **Cozy grind, deep build.** Moment-to-moment play is relaxed and legible (walk up, tab, press
   1-2-3). Long-term play is a build-crafting puzzle with real decisions and real trade-offs.
2. **Every kill can matter.** Any mob can drop a currency shard, an augment, or a rare. Loot
   cadence is tuned so something interesting happens every minute of grinding.
3. **Numbers you can feel.** Allocating a passive, leveling a skill, or slotting an augment must
   produce a visible change in the field within seconds.
4. **The world feels inhabited.** Even in a slice with no real netcode, the game *reads* as an
   MMO: other adventurers wander the town, a chat box murmurs, nameplates float everywhere.

---

## 3. Core Gameplay Loop

```
 ┌──────────────────────────────────────────────────────────────┐
 │  Take quest in town  →  Run to field  →  Tab-target mobs     │
 │  →  Rotate hotbar skills  →  Loot gear / currency / augments │
 │  →  Level up (passive pt + skill pt)  →  Return to town      │
 │  →  Turn in quest  →  Craft / vendor / respec / plan tree    │
 │  →  Take harder quest  →  … →  Zone boss                     │
 └──────────────────────────────────────────────────────────────┘
```

Session cadence targets (slice):
- **~30–45 min** to complete the quest chain and kill the zone boss at a casual pace.
- A level-up roughly every 3–5 minutes early, slowing to ~8 minutes by the boss.
- A rarity-upgrade currency drop every ~2–3 minutes of active grinding.

---

## 4. Classes

Three classes for the slice. Class choice sets base stats, the six starting skills, and the
starting position on the shared passive tree (PoE-style: one tree, three entry points).

| Class | Fantasy | Primary stat | Resource flavor | Playstyle |
|---|---|---|---|---|
| **Blademaster** | Frontline duelist | STR | Stamina-cheap melee | Sticky melee, cleaves, self-buffs |
| **Arcanist** | Aether-wielding scholar | INT | Big mana, big hits | Burst casts, AoE control |
| **Windrunner** | Skyborne hunter | DEX | Sustained ranged | Kiting, crits, damage-over-time |

### 4.1 Attributes

- **STR** — +2 max HP and +1% melee damage per point.
- **DEX** — +0.1% crit chance and +1% ranged/projectile damage per point.
- **INT** — +3 max MP and +1% spell damage per point.
- **VIT** — +5 max HP and +0.2 HP/s regen per point.

Attributes come from class base, +2 per level auto-assigned by class weighting, gear affixes,
and passive tree nodes.

### 4.2 Derived stats

HP, MP, HP/MP regen, armor (phys mitigation, diminishing), evasion (dodge chance), attack speed,
cast speed, movement speed, crit chance, crit multiplier (base 150%), elemental resistances
(fire/cold/lightning, capped 75%), flat & % damage by tag (melee/projectile/spell/element).

---

## 5. Combat

**Tab-targeting** (classic MMO):
- `Tab` cycles nearest visible enemies; click-to-target also works. Target frame shows HP, level, name.
- Auto-attack begins when in range of the current target (toggleable by pressing `R` or attacking).
- Skills 1–6 on the hotbar (`1`–`6` keys). Targeted skills require a target in range; ground/self
  skills fire immediately. Global cooldown 0.6s; each skill has its own cooldown + mana cost.
- Movement: WASD relative to camera; hold right-mouse to orbit; wheel zooms. No action-dodge —
  positioning matters for leashing, pulling singles, and AoE shapes, like the classics.

**Damage model (PoE-lite):**
```
hit = skillBase(level) × weaponContribution × (1 + Σ%increases) × critMult? × (1 - targetMitigation)
```
- Damage types: **physical, fire, cold, lightning**. Mobs and players have armor + 3 resists.
- Crits roll per hit. Cold hits *chill* (-20% move/attack speed 2s), lightning can *shock*
  (+15% damage taken 3s), fire can *ignite* (DoT, 4s). Status chance comes from skills/passives.
- **Mob threat model (Flyff-style name colors):** mob nameplates tint by relative level
  (gray = trivial, white = even, orange = dangerous, red = deadly). Aggressive species attack
  on proximity; passive species only when struck. Mobs leash to their spawn area and reset.

**Death:** player respawns in town at full HP, keeps everything, loses 5% of current level's XP
(never de-levels). Cheap enough to keep grinding, real enough to respect orange mobs.

---

## 6. Skills & Skill Customization (the PoE half, part 1)

Each class has **6 active skills**, unlocked by character level (1/1/4/7/10/13). Depth comes from
two investment axes:

### 6.1 Skill levels
- Characters earn **1 skill point per level**. Each skill can be leveled 1 → 10.
- Each skill level: **+12% effectiveness** (damage or potency) and every 3rd level adds a minor
  scaler (e.g. Cleave's arc widens, Fireball's ignite chance +10%).
- Points are refundable at the town **Skill Sage** for gold (cheap early, scaling) — encourage
  experimentation.

### 6.2 Augments (drop-only skill modifiers ≈ PoE support gems)
- Mobs drop **Augment Runes**. Each skill has **2 augment sockets** (second unlocks at skill lvl 5).
- Augments are tradeoffs, not strict upgrades. Slice pool (12):

| Augment | Effect |
|---|---|
| **Echo** | Skill repeats once at 40% damage, +25% mana cost |
| **Overwhelm** | +35% damage, +20% cooldown |
| **Swiftness** | -25% cooldown, -15% damage |
| **Splinter** | Projectiles/strikes split to 2 extra targets at 45% damage |
| **Immolate** | 40% of damage added as fire, hits can ignite |
| **Permafrost** | 30% of damage added as cold, always chills |
| **Storming** | 30% of damage added as lightning, +15% shock chance |
| **Leeching** | Heal for 4% of skill damage dealt |
| **Thrift** | -40% mana cost, -10% damage |
| **Colossus** | +40% area of effect |
| **Precision** | +15% crit chance for this skill |
| **Brutality** | +50% crit multiplier, -10% base damage |

Any augment fits any skill → 6 skills × pick-2-of-12 ordering-independent = large per-class build
space before the tree is even considered.

### 6.3 Slice skill list

**Blademaster:** Heavy Strike (big single hit, stun chance) · Cleave (frontal arc) · Whirlwind
(PBAoE) · War Banner (self buff: +damage aura) · Lunge (gap-closer + hit) · Executioner's Call
(bonus damage vs targets <35% HP).

**Arcanist:** Aether Bolt (cheap filler) · Fireball (AoE splash + ignite) · Frost Nova (PBAoE +
chill) · Chain Spark (bounces to 3 targets) · Mana Weave (self buff: regen + spell damage) ·
Meteor (huge delayed AoE).

**Windrunner:** Piercing Shot (line pierce) · Split Arrow (fan of 3) · Serpent Sting (nature DoT)
· Hunter's Focus (self buff: crit + attack speed) · Rain of Arrows (targeted ground AoE) ·
Skyfall Volley (execute-style burst).

---

## 7. The Passive Tree (the PoE half, part 2)

One **shared radial constellation of ~330 nodes**; each class starts at its own third of the rim
of an inner ring. Procedurally laid out at build time from a fixed seed — identical for every
player, hand-tuned notable/keystone placement rules.

- **1 passive point per level** + bonus points from quests (slice: +4 from quests → ~24 points
  available by boss kill at ~level 20).
- Node taxonomy:
  - **Minor** (~270): small stat packets — +10 STR, +8% melee damage, +5% attack speed, +12 max HP,
    +6% fire damage, +0.5% crit, +8% armor, etc. Clustered thematically so pathing is a real choice.
  - **Notable** (~48): named, build-defining medium effects — e.g. **Bladestorm** (+25% melee AoE
    damage, +10% attack speed), **Winterheart** (+30% cold damage, chills last twice as long),
    **Ironhide** (+30% armor, +5% phys reduction), **Arrowsong** (+1 Split Arrow projectile).
  - **Keystone** (~9): rule-changing trade-offs at the tree's far reaches:
    - **Glass Cannon** — +50% all damage; -30% max HP.
    - **Blood Pact** — skills cost HP instead of mana; +20% skill damage.
    - **Stormsoul** — all damage converted to lightning; +30% shock chance.
    - **Juggernaut** — cannot be chilled or stunned; -10% movement speed, +25% armor.
    - **Deadeye** — crits deal +100% crit multiplier; non-crits deal 30% less.
    - **Archmage** — +1 mana regen per 10 max mana; spells cost +30%.
    - **Thornweave** — reflect 30% of melee damage taken; -10% evasion.
    - **Soulthief** — 2% of hit damage leeched as HP; max HP -15%.
    - **Windwalker** — +15% movement speed, +10% evasion; -20% armor.
- **Respec:** gold cost per point at the Skill Sage (slice keeps it cheap ×50 gold).
- UI: full-screen zoomable/pannable canvas overlay, search box, hover tooltips, allocate/refund
  with click, path-preview highlighting (shows cheapest connection from your allocated cluster).

---

## 8. Itemization (the PoE half, part 3)

### 8.1 Slots
Weapon · Helmet · Chest · Gloves · Boots · Belt · Amulet · Ring ×2. (9 equip slots; 40-slot bag.)

### 8.2 Rarity tiers

| Tier | Color | Affixes | Notes |
|---|---|---|---|
| **Normal** | white | 0 | Craft fodder |
| **Uncommon** | green | 1–2 | |
| **Rare** | blue | 2–3 | |
| **Epic** | purple | 3–4 | |
| **Legendary** | orange | 4–6 | Gets a generated *name* ("Wrathful Edge of the Tempest") |
| **Unique** | gold | fixed | Hand-designed items with build-warping mods |

### 8.3 Affixes
Prefixes (damage/defense: flat phys, % elemental damage, flat armor, max HP…) and suffixes
(utility: attack speed, crit, resists, regen, movement speed, attributes…), each with **tiered
value brackets scaled by item level** (mob level at drop). Weapon, armor, jewelry draw from
distinct pools (~40 affix families total in the slice). Affix values roll within their bracket.

### 8.4 Uniques (slice set, 5)
- **Emberclad Mantle** (chest): +40% fire damage, ignites you deal spread to nearby enemies, -20 cold res.
- **Whisperwind** (bow-class weapon): +1 projectile to all projectile skills, -15% damage.
- **The Hungering Band** (ring): leech 3% of damage as HP; you cannot regenerate HP.
- **Aetherheart** (amulet): +50% mana regen, skills have 10% chance to cost no mana.
- **Titan's Resolve** (belt): +80 max HP, you cannot be crit, -10% attack speed.

### 8.5 Crafting currencies (drop from mobs, consumed on gear)

| Currency | Effect | Feel |
|---|---|---|
| **Shard of Awakening** | Normal → Uncommon with 1–2 random affixes | Transmute |
| **Crystal of Change** | Reroll a Uncommon's affixes | Alteration |
| **Orb of Ascension** | Upgrade rarity one tier (up to Epic), adds affix | Regal+ |
| **Prism of Chaos** | Reroll all affixes on Rare/Epic/Legendary | Chaos |
| **Rune of Fortune** | Reroll *values* of existing affixes (keep mods) | Divine |
| **Tome of Legends** | Epic → Legendary, rerolls into 4–6 affixes | Exalted slam moment |

Crafting UI: right-click currency → cursor becomes the orb → click a bag/equipped item.
Instant, tactile, dopamine.

### 8.6 Loot rules
- Drops materialize as ground beams color-coded by rarity (Flyff sparkle × PoE beam). Click or
  walk-over to loot; `Z` vacuums nearby loot.
- Drop tables: every mob roll = gold + chance{equipment (rarity weighted by mob level & species
  tier), currency, augment rune, quest item}. Boss has guaranteed Epic+ and one guaranteed unique
  on first kill.

---

## 9. Quests & Progression (the Flyff half)

Classic bulletin-board chain from NPCs with `!` / `?` markers, tracked in a quest log + on-screen
tracker. Slice chain (8 quests):

1. **"Welcome to Brightshore"** — talk to Captain Maren (intro, +50g).
2. **"Puffling Cull"** — kill 8 Pufflings (field intro; reward: Shard of Awakening ×2).
3. **"Boar Bristles"** — collect 6 Bristleback Hides (drop-collect; reward: Uncommon weapon).
4. **"The Sage's Errand"** — deliver a parcel to the Skill Sage (introduces respec/augments; +1 passive pt).
5. **"Mushroom Menace"** — kill 10 Sporelings + 3 Fungal Shamblers (reward: Orb of Ascension, +1 passive pt).
6. **"Wisp in the Dark"** — kill Gloomwisps at night edge of forest (reward: augment rune, +1 passive pt).
7. **"Thin the Vanguard"** — kill 5 Duskfang Raiders near the ruins (orange-difficulty; reward: Epic item, +1 passive pt).
8. **"The Duskfang Alpha"** — kill **Grulmok, Duskfang Alpha** (zone boss; reward: unique item, title in chat, victory fanfare).

**XP curve:** `xpToLevel(n) = 80 × n^1.9`. Mobs give `~12 × mobLevel × speciesMult`, with a
Flyff-style level-gap falloff (gray mobs → ~10% XP).

---

## 10. World: The Isle of Brightshore

Single hand-composed ~400×400m island zone, low-poly pastel aesthetic (bright grass, chunky
trees, soft-gradient sky, drifting clouds, floating motes):

- **Brightshore Town** — safe zone. NPCs: Captain Maren (quests), Merchant Poppy (vendor:
  buy potions/basics, sell trash), Skill Sage Elowen (respec, augment socketing help), a bulletin
  board, fountain plaza, and **wandering fake adventurers** with procedurally generated
  names/classes ("xXDarkBladeXx has entered the world").
- **Sunmeadow** (lv 1–5): Pufflings, Bristleback Boars. Rolling flowered hills.
- **Gloomroot Forest** (lv 5–12): Sporelings, Fungal Shamblers, Gloomwisps. Denser, darker canopy.
- **The Broken Ruins** (lv 12–18): Duskfang Raiders, Duskfang Mystics. Cracked stone, purple haze.
- **Alpha's Hollow** (lv 20 boss arena): Grulmok — 3-phase fight (melee swipes → summons adds →
  enrage with ground-slam AoE telegraphs).

Mobs respawn ~12s after death at their spawn cluster. Day/night tint cycle (~10 min loop) purely
atmospheric in the slice.

---

## 11. UI (Flyff-skinned, PoE-dense)

- **HUD:** player frame (HP/MP/XP), target frame with cast/threat coloring, 6-slot hotbar with
  cooldown sweeps + keybind labels, buff icons, minimap (top-right, rotating dot map), quest
  tracker (right edge), gold counter, loot toasts.
- **Windows** (draggable, toggle keys): Inventory `B` (grid + equip paperdoll + currency tab),
  Character `C` (all stats), Skills `K` (levels + augment sockets), Passive Tree `P`
  (full-screen), Quest Log `L`, Vendor (proximity).
- **Item tooltips**: PoE-style — name colored by rarity, base, implicit, affix lines, compare-on-hover
  vs equipped.
- **Chat box** (bottom-left): system messages (loot, levels, quest), and ambient fake-player
  chatter for MMO feel.
- **Nameplates**: floating names + HP bars over all entities, level-tinted for mobs.

---

## 12. Audio

All synthesized at runtime via WebAudio (zero asset downloads):

- **Music:** cheerful Flyff-esque town theme (plucky pentatonic lead, warm pads, ~96bpm) and a
  breezier field theme; crossfade on zone transitions; tenser loop in ruins/boss.
- **SFX:** melee thwack, bow release, spell whoosh/impact by element, mob hurt/death chirps,
  loot chime *scaled by rarity* (legendary = little arpeggio), level-up fanfare, UI ticks,
  currency "glassy" pop, quest-complete jingle.
- Master/music/SFX volume sliders; mute persists.

---

## 13. The "MMO" in a Slice (no server)

The slice is single-player but **stages multiplayer presence**:
- 8–12 fake adventurers with generated names, random class gear colors, wandering town/fields,
  occasionally "fighting" mobs.
- Ambient chat: join/leave messages, fake trade spam, "gz!" on your level-ups.
- Architecture keeps a clean client/sim split (game state updated by a tick loop, rendering
  reads state) so a real websocket layer could replace the fake presence later.

**Persistence:** full character save (level, gear, bag, tree, skills, quests, gold, position) to
`localStorage`, autosaved every 10s and on window close. "New Character" wipes.

---

## 14. Technical Architecture

- **Stack:** Vite + vanilla JS modules + three.js (WebGL). No framework; HTML/CSS overlay UI.
  Matches the other projects in this repo and deploys to GitHub Pages under `/aethermoor/`.
- **Structure:**
  - `src/core/` — RNG (seeded), event bus, save/load, game state.
  - `src/data/` — pure data: classes, skills, augments, affixes, uniques, mobs, quests, passive
    tree generator.
  - `src/world/` — three.js scene, terrain, props, entities (player/mobs/NPCs/fakes), camera rig.
  - `src/systems/` — combat resolver, loot generator, progression, quest tracking, AI tick.
  - `src/ui/` — HUD, windows, tooltips, tree canvas, chat, minimap.
  - `src/audio/` — WebAudio music sequencer + SFX synth.
- **Perf targets:** 60fps on integrated GPU; instanced meshes for grass/trees; nameplates via a
  pooled CSS2D layer; sim tick at 10Hz for AI, render-rate for movement/animation.

---

## 15. Out of Scope (slice) → Future

Real netcode & parties · guilds · trading/auction house · more classes & class promotions
(Flyff-style job change) · flying mounts/boards (the Flyff signature — planned as the *next*
milestone) · maps/endgame system (PoE-style) · seasonal leagues · PvP arena · gamepad support ·
mobile layout.

---

## 16. Success Criteria for the Slice

A new player, with no instructions beyond the intro toast, can: pick a class → complete the quest
chain → hit ~level 18–20 → craft at least one Epic with currencies → slot 2+ augments → allocate
20+ passive points including a keystone → kill Grulmok → and afterwards be able to articulate the
build they'd try next. If they can also hum the field theme, we've nailed it.
