# Stages, director events, Plot Twists, Filler Arc

Stages 2-5 (EXPANSION §10), written field-for-field against `StageDef` in
`src/game/stage.ts` so each can be typed into `src/game/stages/<id>.ts`
directly. Dream Meadow (`src/game/stages/dream-meadow.ts`) is the reference.
Timing rule (same as Dream Meadow): the final boss arrives at `duration − 60`,
enrages at `duration + 30`.

| # | id | Name | duration | final boss at | mid bosses | rewardMul | requires | bpm* |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `dream_meadow` | Dream Meadow | 600 | 9:00 | 3:00, 6:00 | 1 | — | 140 |
| 2 | `candy_kingdom` | Candy Kingdom | 720 | 11:00 | 6:00 | 1.25 | `dream_meadow` | 150 |
| 3 | `shoujo_academy` | Shoujo Academy | 840 | 13:00 | 7:00 | 1.5 | `candy_kingdom` | 136 |
| 4 | `beach_episode` | Beach Episode | 960 | 15:00 | 8:00 | 1.8 | `shoujo_academy` | 128 |
| 5 | `final_arc` | The Final Arc | 1200 | 19:00 | 8:00, 14:00 | 2.2 | `beach_episode` | 160 |

\* `bpm` is a proposed optional `StageDef.bpm` (Idol Lightstick Wave's beat
clock, `weapons.md` §2.11). The audio agent sequences each stage's battle theme
at this tempo.

Proposed optional `TimelineEvent` fields used below: `label` (the
`waveIncoming` banner text) and `sprite` (bullet sprite for `bulletRain`).
Enemy HP ramps come from the base HP in `enemies.md` × `enemyHpScale(t)`;
longer stages are naturally tougher at the end.

---

## 1. Candy Kingdom — `candy_kingdom`

```ts
name: "Candy Kingdom",
subtitle: "Episode 2: Everything Here Is Edible (Please Don't)",
blurb: "sugar rush, sprinkle storms, a very sticky tyrant",
order: 2, duration: 720, rewardMul: 1.25, requires: "dream_meadow",
finalBoss: "sugar_plum_tyrant", enrageAt: 750,
opening: { enemy: "gummy_bear", count: 12 },
props: { ids: ["prop_candy_jar", "prop_pinata"], interval: 16, max: 4 },
music: { battle: "candy", boss: "boss_candy", final: "boss_candy" },
clearColor: 0xffb8dc,
victory: { fx: "dawn", title: "SUGAR CRASH!", line: "the Candy Kingdom is free, and slightly sticky" },
endless: { hpPerMinute: 0.35, spawnPerMinute: 0.08, eliteEvery: 45, elites: 2, bossEvery: 120,
           rematches: ["gingerbread_golem", "sugar_plum_tyrant"], bossHpPerLoop: 0.5, bossSpawnMul: 0.5 },
```

**Phases**

```ts
const EARLY = { gummy_bear: 3, candy_corn: 1 };
const MID   = { gummy_bear: 3, candy_corn: 2 };
const L1    = { gummy_bear: 2, candy_corn: 2, donut_roller: 1, lollipop_mage: 1 };
const L2    = { ...L1, marshmallow_brute: 0.6 };
const ALL   = { gummy_bear: 2, candy_corn: 2, donut_roller: 1.2, lollipop_mage: 1, marshmallow_brute: 0.8 };
const LATE  = { gummy_bear: 1.6, candy_corn: 2, donut_roller: 1.4, lollipop_mage: 1.2, marshmallow_brute: 1.1 };
phases: [
  { from: 0,   to: 60,  mix: EARLY, rate: [1.6, 3.0], max: 60 },
  { from: 60,  to: 120, mix: MID,   rate: [3.2, 4.5], max: 110 },
  { from: 120, to: 210, mix: L1,    rate: [4.5, 6.5], max: 150 },
  { from: 210, to: 300, mix: L2,    rate: [7, 10],    max: 180 },
  { from: 300, to: 360, mix: ALL,   rate: [12, 15],   max: 220 },
  { from: 360, to: 390, mix: ALL,   rate: [15, 16],   max: 230 },
  { from: 390, to: 540, mix: ALL,   rate: [18, 26],   max: 250 },
  { from: 540, to: 660, mix: LATE,  rate: [26, 32],   max: 270 },
  { from: 660, to: 1e9, mix: LATE,  rate: [32, 32],   max: 270 },
],
```

**Events**

| at | kind | params | banner |
| --- | --- | --- | --- |
| 0:45 | `swarmLine` | gummy_bear ×10, speed 70 | |
| 1:30 | `swarmLine` | candy_corn ×12, lines 3, speed 60 | PHALANX! |
| 2:30 | `elite` | | |
| 3:00 | `laneCharge` | donut_roller ×6, lines 3, speed 165 | ROLLING DONUTS! |
| 4:00 | `encircle` | gummy_bear ×28 | |
| 4:30 | `elite` | | |
| 5:30 | `flood` | gummy_bear ×46, 6 s | GUMMY AVALANCHE! |
| 6:00 | `boss` | gingerbread_golem, spawnMul 0.45 | |
| 6:45 | `elite` | | |
| 7:15 | `bulletRain` | sprite eb_candy, ×40, 8 s | SPRINKLE STORM! |
| 7:45 | `elite` | | |
| 8:00 | `swarmLine` | candy_corn ×18, lines 4, speed 64 | PHALANX! |
| 8:30 | `elite` | | |
| 8:45 | `laneCharge` | donut_roller ×10, lines 4, speed 165 | ROLLING DONUTS! |
| 9:15 | `encircle` | marshmallow_brute ×8 | MARSHMALLOW WALL! |
| 9:30 | `elite` | | |
| 10:00 | `bulletRain` | sprite eb_candy, ×60, 10 s | SPRINKLE STORM! |
| 10:15 | `elite` | | |
| 10:30 | `flood` | candy_corn ×50, 6 s | THE WHOLE ARMY?! |
| 11:00 | `boss` | sugar_plum_tyrant, spawnMul 0.4 | |

**Ground — `tile_candy`** (16×16×8): f0-3 strawberry frosting (soft pink `q/p`,
subtle piped swirls, seamless), f4 rainbow sprinkles, f5 chocolate drizzle
(`d/H`), f6 sugar sparkle (`w/z` glints), f7 cookie-crumb path (`h/H/d`).

```ts
tiles: { sprite: "tile_candy", rules: [
  { noise: { freq: 0.09, seed: 11, above: 0.5 }, frames: [7] },                     // cookie paths
  { noise: { freq: 0.2, ox: 31, oy: 7, seed: 5, above: 0.44 }, hash: { below: 0.6 }, frames: [4, 5], cuts: [0.55] },
  { hash: { above: 0.965 }, frames: [6] },
  { hash: { above: 0.93 }, frames: [4, 5], mul: 991 },
], base: { frames: [0, 1, 2, 3], mul: 1000 } },
```

**Deco**

```ts
deco: [
  { kind: "scatter", cell: 24, base: 0.18, noise: 0.5, freq: 0.16, seed: 23, salt: 2, items: [
    { sprite: "deco_gumdrop", upTo: 0.35 },
    { sprite: "deco_candy_lolli", upTo: 0.62 },
    { sprite: "deco_candy_cane", upTo: 0.8, shadow: 6 },
    { sprite: "deco_sugar_cube", upTo: 0.92, shadow: 9 },
    { sprite: "deco_cupcake", upTo: 1, shadow: 7, glow: { r: 8, color: 0xff7ab8 } },
  ] },
  { kind: "tall", sprite: "deco_lollipop_tree", cell: 96, chance: 0.4, salt: 2, shadow: 24,
    sway: { speed: 1.1, above: 0.35 }, canopy: { r: 16, h: 26 }, flipAbove: 0.3 },
],
```

**Colour-grade arc** — Sugar Morning → Caramel Afternoon → Sugar Crash Dusk:

```ts
grade: [
  { at: 0,   grade: { tint: [1.04, 0.99, 1.0], lift: [0.02, 0.0, 0.02], saturation: 1.12, contrast: 1.03, brightness: 1.02, hue: 0 } },
  { at: 0.5, grade: { tint: [1.06, 0.96, 0.9], lift: [0.05, 0.02, 0.0], saturation: 1.1, contrast: 1.04, brightness: 1.0, hue: 0 } },
  { at: 1,   grade: { tint: [0.98, 0.88, 1.0], lift: [0.06, 0.0, 0.07], saturation: 1.08, contrast: 1.06, brightness: 0.96, hue: 0 } },
],
ambient: {
  base: [ { at: 0, petals: 0, motes: 10, fireflies: 0 }, { at: 1, petals: 0, motes: 14, fireflies: 6 } ],
  layers: [ { sprite: "fx_sprinkle", motion: "fall", colors: [0xff7ab8, 0xffe14d, 0x4fe6df, 0x94e85e, 0xffffff],
              density: [ { at: 0, n: 14 }, { at: 1, n: 24 } ], speed: [14, 26], sway: 8, spin: 3, alpha: 0.9 } ],
},
```

**Art direction.** A pastel confectionery kingdom: frosting ground, gumdrop
pebbles, candy-cane fences, lollipop trees with spiral canopies on striped
trunks. Everything has a little face or a shine pixel. Palette: `q/p/P` frosting,
`y/z` lemon, `c/a` mint, `H/h/d` cookie, `w` sugar. Props: `prop_candy_jar`
(12×16×2, a glass jar of sweets with a cork, f1 glint — breaks into candy
confetti) and `prop_pinata` (16×16×2, a star piñata on a string, f1 swing —
bursts into coins and wrapped sweets). Music mood: a bouncy 150 bpm sugar-pop
march (glockenspiel lead, kazoo-like square, clap snares); boss theme: the same
melody in a minor key with a tuba.

---

## 2. Shoujo Academy — `shoujo_academy`

```ts
name: "Shoujo Academy",
subtitle: "Episode 3: The Transfer Student Is Suspiciously Powerful",
blurb: "cherry blossoms, hall passes, unspoken feelings",
order: 3, duration: 840, rewardMul: 1.5, requires: "candy_kingdom",
finalBoss: "bishounen", enrageAt: 870,
opening: { enemy: "exam_paper", count: 12 },
props: { ids: ["prop_school_desk", "prop_vending"], interval: 16, max: 4 },
music: { battle: "academy", boss: "boss_academy", final: "boss_academy" },
clearColor: 0xe9e3f7,
victory: { fx: "dawn", title: "CLASS DISMISSED!", line: "graduation was a bit dramatic this year" },
endless: { hpPerMinute: 0.38, spawnPerMinute: 0.08, eliteEvery: 45, elites: 2, bossEvery: 120,
           rematches: ["council_president", "bishounen"], bossHpPerLoop: 0.5, bossSpawnMul: 0.5 },
```

**Phases**

```ts
const EARLY = { exam_paper: 3, love_letter: 2 };
const MID   = { exam_paper: 2, love_letter: 2, tsundere_slime: 2 };
const L1    = { ...MID, hall_monitor: 1.2 };
const L2    = { exam_paper: 2, love_letter: 2, tsundere_slime: 2, hall_monitor: 1.4, council_ninja: 0.8 };
const L3    = { ...L2, transfer_student: 0.6 };
const ALL   = { exam_paper: 1.8, love_letter: 2, tsundere_slime: 1.8, hall_monitor: 1.4, council_ninja: 1.2, transfer_student: 1 };
phases: [
  { from: 0,   to: 60,  mix: EARLY, rate: [1.8, 3.2], max: 65 },
  { from: 60,  to: 150, mix: MID,   rate: [3.4, 5],   max: 120 },
  { from: 150, to: 240, mix: L1,    rate: [5, 7],     max: 160 },
  { from: 240, to: 360, mix: L2,    rate: [7.5, 11],  max: 190 },
  { from: 360, to: 420, mix: L3,    rate: [12, 15],   max: 220 },
  { from: 420, to: 450, mix: L3,    rate: [15, 15],   max: 220 },
  { from: 450, to: 600, mix: ALL,   rate: [17, 24],   max: 250 },
  { from: 600, to: 780, mix: ALL,   rate: [24, 32],   max: 270 },
  { from: 780, to: 1e9, mix: ALL,   rate: [32, 32],   max: 270 },
],
```

Transfer Students in the phase mix also arrive by teleport (their own spawn
rule, `enemies.md`).

**Events**

| at | kind | params | banner |
| --- | --- | --- | --- |
| 0:50 | `swarmLine` | love_letter ×14, speed 80 | |
| 1:40 | `encircle` | exam_paper ×24 | POP QUIZ! |
| 2:30 | `elite` | | |
| 3:20 | `teleportIn` | transfer_student ×3 | TRANSFER STUDENTS?! |
| 4:00 | `schoolBell` | count 8 | THE BELL RINGS! |
| 4:30 | `elite` | | |
| 5:00 | `batStorm` | love_letter ×12, lines 6, 6 s, speed 90 | CONFESSION SEASON! |
| 5:45 | `elite` | | |
| 6:20 | `encircle` | exam_paper ×36 | POP QUIZ! |
| 7:00 | `boss` | council_president, spawnMul 0.45 | |
| 7:45 | `elite` | | |
| 8:15 | `teleportIn` | transfer_student ×6 | TRANSFER STUDENTS?! |
| 8:45 | `elite` | | |
| 9:15 | `schoolBell` | count 12 | THE BELL RINGS! |
| 9:45 | `elite` | | |
| 10:15 | `batStorm` | love_letter ×14, lines 7, 7 s, speed 95 | CONFESSION SEASON! |
| 10:45 | `elite` | | |
| 11:15 | `encircle` | tsundere_slime ×32 | I-IT'S NOT LIKE WE SURROUNDED YOU! |
| 11:45 | `elite` | | |
| 12:15 | `flood` | exam_paper ×60, 6 s | FINALS WEEK! |
| 12:45 | `elite` | | |
| 13:00 | `boss` | bishounen, spawnMul 0.4 | |

**Ground — `tile_academy`**: f0-3 pale courtyard stone pavers (`W/g` with soft
`G` grout, seamless), f4 fallen sakura petals (`q/p`), f5 a chalk doodle (a
heart with an arrow, `w`), f6 polish sparkle, f7 running track (terracotta `O/o`
with a white lane line).

```ts
tiles: { sprite: "tile_academy", rules: [
  { noise: { freq: 0.07, seed: 17, above: 0.55 }, frames: [7] },                    // running track
  { noise: { freq: 0.18, ox: -12, oy: 44, seed: 9, above: 0.4 }, hash: { below: 0.7 }, frames: [4] },
  { hash: { above: 0.985 }, frames: [5] },
  { hash: { above: 0.955 }, frames: [6] },
], base: { frames: [0, 1, 2, 3], mul: 1000 } },
```

**Deco**

```ts
deco: [
  { kind: "scatter", cell: 24, base: 0.16, noise: 0.45, freq: 0.15, seed: 29, salt: 3, items: [
    { sprite: "deco_petal_pile", upTo: 0.38 },
    { sprite: "deco_hedge", upTo: 0.6, shadow: 10 },
    { sprite: "deco_shoe_locker", upTo: 0.75, shadow: 10 },
    { sprite: "deco_school_sign", upTo: 0.88, shadow: 6 },
    { sprite: "deco_school_lamp", upTo: 1, shadow: 5, glow: { r: 9, color: 0xfff7b0 } },
  ] },
  { kind: "tall", sprite: "deco_sakura_tree", cell: 88, chance: 0.45, salt: 3, shadow: 26,
    sway: { speed: 1.2, above: 0.3 }, canopy: { r: 17, h: 24 }, flipAbove: 0.25 },
],
```

**Colour-grade arc** — Morning Assembly → Golden After-School → Confession
Sunset → Rooftop Twilight:

```ts
grade: [
  { at: 0,    grade: { tint: [1.0, 1.0, 1.03], lift: [0.01, 0.01, 0.03], saturation: 1.04, contrast: 1.02, brightness: 1.03, hue: 0 } },
  { at: 0.45, grade: { tint: [1.06, 0.98, 0.9], lift: [0.05, 0.02, 0.0], saturation: 1.06, contrast: 1.03, brightness: 1.0, hue: 0 } },
  { at: 0.8,  grade: { tint: [1.08, 0.9, 0.92], lift: [0.07, 0.0, 0.04], saturation: 1.08, contrast: 1.05, brightness: 0.97, hue: 0 } },
  { at: 1,    grade: { tint: [0.92, 0.88, 1.02], lift: [0.04, 0.0, 0.08], saturation: 1.06, contrast: 1.06, brightness: 0.96, hue: 0 } },
],
ambient: {
  base: [ { at: 0, petals: 18, motes: 8, fireflies: 0 }, { at: 0.8, petals: 22, motes: 12, fireflies: 0 },
          { at: 1, petals: 14, motes: 14, fireflies: 10 } ],
  layers: [ { sprite: "fx_px", motion: "drift", colors: [0xfff7b0, 0xffffff],          // sunlit hallway dust
              density: [ { at: 0, n: 10 }, { at: 1, n: 6 } ], speed: [3, 8], alpha: 0.5, glow: true } ],
},
```

**Art direction.** A spotless anime school courtyard in eternal cherry-blossom
season: stone pavers, trimmed hedges, shoe lockers out in the open (nobody
questions it), "NO RUNNING" signs, warm lamp posts, sakura trees dropping petals
forever. Palette `W/g/G` stone, `q/p` blossom, `E/e` hedges, `n/U` uniforms,
`y` lamps. Props: `prop_school_desk` (14×12×1, a classic desk with a carved
heart; breaks into paper scraps) and `prop_vending` (12×20×2, a pastel drink
vending machine, f1 light flicker; drops cans that count as food). Music
mood: 136 bpm school-life pop with piano and a bright synth bell, a "school
chime" motif on the event stingers; boss theme: dramatic strings over the same
chime.

---

## 3. Beach Episode — `beach_episode`

The obligatory beach episode, kept wholesome: the most revealing thing on
screen is a crab's opinion.

```ts
name: "Beach Episode",
subtitle: "Episode 4: The Obligatory Beach Episode (Crabs Only)",
blurb: "sand, sun, sidestepping crabs, fireworks after dark",
order: 4, duration: 960, rewardMul: 1.8, requires: "shoujo_academy",
finalBoss: "firework_dragon", enrageAt: 990,
opening: { enemy: "crab_kun", count: 12 },
props: { ids: ["prop_beachball", "prop_cooler"], interval: 16, max: 4 },
music: { battle: "beach", boss: "boss_beach", final: "boss_beach" },
clearColor: 0xfff0c9,
victory: { fx: "dawn", title: "SUMMER'S OVER!", line: "see you at the next festival" },
endless: { hpPerMinute: 0.4, spawnPerMinute: 0.09, eliteEvery: 45, elites: 2, bossEvery: 120,
           rematches: ["kraken_chan", "firework_dragon"], bossHpPerLoop: 0.5, bossSpawnMul: 0.5 },
```

**Phases**

```ts
const EARLY = { crab_kun: 3, seagull: 1 };
const MID   = { crab_kun: 3, seagull: 2, tiny_shark: 1 };
const L1    = { crab_kun: 2, seagull: 2, tiny_shark: 1.5, jellyfish: 1.5 };
const L2    = { ...L1, watermelon: 1 };
const L3    = { ...L2, sandcastle_golem: 0.5 };
const ALL   = { crab_kun: 2, seagull: 1.8, tiny_shark: 1.6, jellyfish: 1.5, watermelon: 1.2, sandcastle_golem: 0.9 };
phases: [
  { from: 0,   to: 60,  mix: EARLY, rate: [1.8, 3.2], max: 65 },
  { from: 60,  to: 150, mix: MID,   rate: [3.4, 5],   max: 120 },
  { from: 150, to: 270, mix: L1,    rate: [5, 7.5],   max: 160 },
  { from: 270, to: 390, mix: L2,    rate: [8, 11],    max: 190 },
  { from: 390, to: 480, mix: L3,    rate: [12, 15],   max: 220 },
  { from: 480, to: 510, mix: L3,    rate: [15, 15],   max: 225 },
  { from: 510, to: 720, mix: ALL,   rate: [17, 25],   max: 250 },
  { from: 720, to: 900, mix: ALL,   rate: [25, 32],   max: 270 },
  { from: 900, to: 1e9, mix: ALL,   rate: [32, 32],   max: 270 },
],
```

**Events**

| at | kind | params | banner |
| --- | --- | --- | --- |
| 0:45 | `swarmLine` | seagull ×12, speed 85 | SEAGULLS! |
| 1:40 | `encircle` | crab_kun ×22 | CRAB CIRCLE! |
| 2:30 | `elite` | | |
| 3:20 | `laneCharge` | watermelon ×6, lines 3, speed 140 | WATERMELON ROLL! |
| 4:00 | `tideSweep` | 6 s, speed 40 | HIGH TIDE! |
| 4:30 | `elite` | | |
| 5:30 | `batStorm` | seagull ×12, lines 6, 6 s, speed 110 | SEAGULL DIVE! |
| 6:15 | `elite` | | |
| 7:00 | `encircle` | tiny_shark ×24 | ...fin. |
| 7:30 | `elite` | | |
| 8:00 | `boss` | kraken_chan, spawnMul 0.45 | |
| 8:45 | `elite` | | |
| 9:15 | `laneCharge` | watermelon ×10, lines 4, speed 140 | WATERMELON ROLL! |
| 9:45 | `elite` | | |
| 10:15 | `tideSweep` | 8 s, speed 40 | HIGH TIDE! |
| 10:45 | `elite` | | |
| 11:15 | `encircle` | jellyfish ×26 | JELLY RING! |
| 11:45 | `elite` | | |
| 12:15 | `batStorm` | seagull ×14, lines 7, 7 s, speed 115 | SEAGULL DIVE! |
| 12:45 | `elite` | | |
| 13:15 | `flood` | crab_kun ×60, 6 s | CRAB MIGRATION! |
| 13:45 | `elite` | | |
| 14:15 | `encircle` | sandcastle_golem ×8 | SANDCASTLE SIEGE! |
| 14:30 | `elite` | | |
| 15:00 | `boss` | firework_dragon, spawnMul 0.4 | |

**Ground — `tile_beach`**: f0-3 warm sand (`B/F` with fine `h` grain,
seamless), f4 shells, f5 a starfish, f6 wet sand (darker `h/F` with an `a`
sheen line), f7 footprints / raked sand.

```ts
tiles: { sprite: "tile_beach", rules: [
  { noise: { freq: 0.05, seed: 41, above: 0.58 }, frames: [6] },                    // wet tide-pool patches
  { noise: { freq: 0.1, ox: 9, oy: 27, seed: 13, above: 0.52 }, hash: { below: 0.5 }, frames: [7] },
  { hash: { above: 0.975 }, frames: [5] },
  { hash: { above: 0.94 }, frames: [4] },
], base: { frames: [0, 1, 2, 3], mul: 1000 } },
```

**Deco**

```ts
deco: [
  { kind: "scatter", cell: 24, base: 0.14, noise: 0.45, freq: 0.14, seed: 37, salt: 4, items: [
    { sprite: "deco_shell", upTo: 0.35 },
    { sprite: "deco_beach_grass", upTo: 0.55 },
    { sprite: "deco_sand_bucket", upTo: 0.68, shadow: 6 },
    { sprite: "deco_beach_rock", upTo: 0.84, shadow: 9 },
    { sprite: "deco_parasol", upTo: 0.92, shadow: 18 },
    { sprite: "deco_mini_sandcastle", upTo: 1, shadow: 10 },
  ] },
  { kind: "tall", sprite: "deco_palm", cell: 104, chance: 0.35, salt: 4, shadow: 22,
    sway: { speed: 0.9, above: 0.3 }, canopy: { r: 18, h: 30 }, flipAbove: 0.5 },
],
```

**Colour-grade arc** — Noon Sun → Golden Hour → Dusk → Festival Night:

```ts
grade: [
  { at: 0,    grade: { tint: [1.04, 1.0, 0.95], lift: [0.02, 0.01, 0.0], saturation: 1.1, contrast: 1.04, brightness: 1.04, hue: 0 } },
  { at: 0.5,  grade: { tint: [1.08, 0.95, 0.86], lift: [0.06, 0.02, 0.0], saturation: 1.08, contrast: 1.05, brightness: 1.0, hue: 0 } },
  { at: 0.85, grade: "dusk" },
  { at: 1,    grade: { tint: [0.86, 0.86, 1.02], lift: [0.04, 0.01, 0.09], saturation: 1.1, contrast: 1.06, brightness: 0.95, hue: 0 } },
],
ambient: {
  base: [ { at: 0, petals: 0, motes: 12, fireflies: 0 }, { at: 0.8, petals: 0, motes: 12, fireflies: 0 },
          { at: 1, petals: 0, motes: 10, fireflies: 16 } ],
  layers: [
    { sprite: "fx_px", motion: "rise", colors: [0xffffff, 0xbafff6, 0xb0d8ff],     // sea spray
      density: [ { at: 0, n: 8 }, { at: 1, n: 12 } ], speed: [6, 14], sway: 10, alpha: 0.6 },
    { sprite: "fx_spark", motion: "rise", colors: [0xffe14d, 0xff9a3d, 0xff7ab8],  // festival sparks after dusk
      density: [ { at: 0, n: 0 }, { at: 0.85, n: 0 }, { at: 1, n: 10 } ], speed: [8, 16], sway: 6, glow: true },
  ],
},
```

**Art direction.** Bright summer beach: sand, shells, striped parasols, buckets,
tiny decorative sandcastles, palm trees; at night paper lanterns' warm light
and festival sparks. Nobody is in swimwear; there are no people at all, only
crabs, gulls, melons and a very friendly octopus. Palette `B/F/h` sand, `c/a/v`
water sheen, `r/w` parasol stripes, `E/e/l` palms. Props: `prop_beachball`
(12×12×2, bouncing f1; pops into confetti) and `prop_cooler` (14×12×1, a
blue-and-white cool box; drops "chilled" food: onigiri with a sweat drop).
Music mood: 128 bpm sunny surf-pop (steel-drum-like FM bell, clean guitar
arps, shaker); boss theme: festival taiko drums with a chiptune flute.

---

## 4. The Final Arc — `final_arc`

```ts
name: "The Final Arc",
subtitle: "Episode 5: The Final Arc (Final) (Real) (v2)",
blurb: "plot holes, rushed animation, and the network is watching",
order: 5, duration: 1200, rewardMul: 2.2, requires: "beach_episode",
finalBoss: "cancel_sama", enrageAt: 1230,
opening: { enemy: "filler_goon", count: 12 },
props: { ids: ["prop_clapboard", "prop_crt_tv"], interval: 16, max: 4 },
music: { battle: "finale", boss: "boss_finale", final: "cancel" },
clearColor: 0x2d1b45,
victory: { fx: "dawn", title: "RENEWED FOR SEASON 2!!", line: "the network has approved another season" },
endless: { hpPerMinute: 0.45, spawnPerMinute: 0.1, eliteEvery: 40, elites: 3, bossEvery: 120,
           rematches: ["truck_kun_boss", "rival_chan", "cancel_sama"], bossHpPerLoop: 0.5, bossSpawnMul: 0.45 },
onFinalBossKilled: Cancel-sama's restoration sequence (enemies.md §5.9), then the default victory.
```

**Phases** (Plot Holes are capped at 3 alive: proposed optional `EnemyDef.maxAlive`)

```ts
const EARLY = { filler_goon: 3, animation_error: 1 };
const MID   = { filler_goon: 3, animation_error: 2, mini_truck: 0.5 };
const L1    = { filler_goon: 2.5, animation_error: 2, mini_truck: 0.8, shadow_clone: 0.6 };
const L2    = { ...L1, plot_hole: 0.15 };
const ALL   = { filler_goon: 2.2, animation_error: 2, mini_truck: 1, shadow_clone: 1, plot_hole: 0.2 };
const LATE  = { filler_goon: 2, animation_error: 2.2, mini_truck: 1.2, shadow_clone: 1.3, plot_hole: 0.25 };
phases: [
  { from: 0,    to: 60,   mix: EARLY, rate: [2, 3.5],  max: 70 },
  { from: 60,   to: 180,  mix: MID,   rate: [3.5, 6],  max: 130 },
  { from: 180,  to: 330,  mix: L1,    rate: [6, 10],   max: 180 },
  { from: 330,  to: 480,  mix: L2,    rate: [10, 15],  max: 220 },
  { from: 480,  to: 510,  mix: L2,    rate: [15, 15],  max: 220 },
  { from: 510,  to: 840,  mix: ALL,   rate: [17, 26],  max: 250 },
  { from: 840,  to: 870,  mix: ALL,   rate: [24, 24],  max: 250 },
  { from: 870,  to: 1140, mix: LATE,  rate: [26, 34],  max: 280 },
  { from: 1140, to: 1e9,  mix: LATE,  rate: [30, 30],  max: 280 },
],
```

**Events**

| at | kind | params | banner |
| --- | --- | --- | --- |
| 1:00 | `swarmLine` | filler_goon ×14, speed 60 | FILLER! |
| 2:00 | `laneCharge` | mini_truck ×3, lines 3, speed 200 | TRUCKS?! |
| 2:30 | `elite` | | |
| 3:30 | `commercialBreak` | 4 s, then filler_goon ×40 | WE'LL BE RIGHT BACK! |
| 4:30 | `elite` | | |
| 5:00 | `teleportIn` | plot_hole ×2 | PLOT HOLES! |
| 5:45 | `elite` | | |
| 6:30 | `flashback` | ×40 | PREVIOUSLY ON... |
| 7:15 | `elite` | | |
| 8:00 | `boss` | truck_kun_boss, spawnMul 0.45 | |
| 9:00 | `elite` | | |
| 9:30 | `laneCharge` | mini_truck ×5, lines 5, speed 200 | RUSH HOUR! |
| 10:00 | `elite` | | |
| 10:30 | `commercialBreak` | 4 s, then animation_error ×40 | WE'LL BE RIGHT BACK! |
| 11:00 | `elite` | | |
| 11:30 | `encircle` | shadow_clone ×10 | THEY'RE ALL YOU?! |
| 12:00 | `elite` | | |
| 12:30 | `flashback` | ×50 | PREVIOUSLY ON... |
| 13:00 | `elite` | | |
| 13:30 | `teleportIn` | plot_hole ×3 | PLOT HOLES! |
| 14:00 | `boss` | rival_chan, spawnMul 0.45 | |
| 15:00 | `elite` | | |
| 15:30 | `laneCharge` | mini_truck ×6, lines 6, speed 210 | RUSH HOUR! |
| 16:00 | `elite` | | |
| 16:30 | `commercialBreak` | 4 s, then filler_goon ×60 | WE'LL BE RIGHT BACK! |
| 17:00 | `elite` | | |
| 17:30 | `flashback` | ×60 | PREVIOUSLY ON... |
| 18:00 | `elite` | | |
| 18:30 | `encircle` | shadow_clone ×14 | THEY'RE ALL YOU?! |
| 19:00 | `boss` | cancel_sama, spawnMul 0.35 | |

**Ground — `tile_finale`**: f0-3 dark storyboard paper (`2/1` violet with faint
`n` animation-paper grid lines, seamless), f4 cracks leaking light (`j/w`), f5 a
film-strip fragment (`0/G` with `y` frames), f6 star glints, f7 **unfinished
pencil sketch** (lavender `g/j` sketch lines on pale paper `W`) — patches of the
world the budget never coloured.

```ts
tiles: { sprite: "tile_finale", rules: [
  { noise: { freq: 0.08, seed: 53, above: 0.56 }, frames: [7] },                    // unfinished patches
  { hash: { above: 0.975 }, frames: [5] },
  { hash: { above: 0.94 }, frames: [4] },
  { hash: { above: 0.9 }, frames: [6] },
], base: { frames: [0, 1, 2, 3], mul: 1000 } },
```

**Deco**

```ts
deco: [
  { kind: "scatter", cell: 24, base: 0.14, noise: 0.5, freq: 0.15, seed: 61, salt: 5, items: [
    { sprite: "deco_film_reel", upTo: 0.25, shadow: 7 },
    { sprite: "deco_sketch_bush", upTo: 0.5 },
    { sprite: "deco_storyboard", upTo: 0.68, shadow: 8 },
    { sprite: "deco_broken_pillar", upTo: 0.84, shadow: 9 },
    { sprite: "deco_glitch_crystal", upTo: 1, shadow: 6, glow: { r: 10, color: 0x4fe6df } },
  ] },
  { kind: "tall", sprite: "deco_sketch_tree", cell: 100, chance: 0.38, salt: 5, shadow: 22,
    sway: { speed: 0.8, above: 0.4 }, canopy: { r: 17, h: 24 }, flipAbove: 0.5 },
],
```

**Colour-grade arc** — Dramatic Sunset → Climax Red → Void → Final Void
(Cancel-sama's phases override it while he lives):

```ts
grade: [
  { at: 0,    grade: { tint: [1.08, 0.92, 0.88], lift: [0.06, 0.01, 0.03], saturation: 1.08, contrast: 1.06, brightness: 0.98, hue: 0 } },
  { at: 0.4,  grade: { tint: [1.1, 0.86, 0.9], lift: [0.08, 0.0, 0.05], saturation: 1.1, contrast: 1.08, brightness: 0.96, hue: 0 } },
  { at: 0.75, grade: { tint: [0.9, 0.84, 1.04], lift: [0.05, 0.0, 0.1], saturation: 1.04, contrast: 1.08, brightness: 0.94, hue: 0 } },
  { at: 1,    grade: { tint: [0.84, 0.82, 1.04], lift: [0.04, 0.0, 0.12], saturation: 1.0, contrast: 1.1, brightness: 0.92, hue: 0 } },
],
ambient: {
  base: [ { at: 0, petals: 0, motes: 14, fireflies: 0 }, { at: 1, petals: 0, motes: 18, fireflies: 0 } ],
  layers: [ { sprite: "fx_glitch", motion: "glitch", colors: [0xff7ab8, 0x4fe6df, 0x94e85e, 0xffffff],
              density: [ { at: 0, n: 6 }, { at: 1, n: 20 } ], speed: [0, 0], alpha: 0.8, glow: true } ],
},
```

**Art direction.** The show running out of money in real time: a dark
storyboard-paper void with grid lines, film reels, storyboard easels, broken
dramatic pillars, glitch crystals, and trees and bushes that are only pencil
sketches. The further you go, the more the world is literally unfinished.
Palette `0/1/2/n` void, `j/g/W` sketch, `c/p/l` glitch accents. Props:
`prop_clapboard` (14×14×1, a film clapperboard reading "TAKE 47") and
`prop_crt_tv` (14×14×2, an old TV showing colour bars, f1 static). Music mood:
160 bpm dramatic finale rock-chiptune (choir pads, driving bass, key change
every 64 bars); `cancel` theme: the main menu theme played on a corporate hold
music organ that slowly glitches.

---

## 5. New director event kinds (`director/events.ts`)

| kind | Params | Behaviour |
| --- | --- | --- |
| `laneCharge` | `enemy, count, lines, speed, label?` | Picks a random axis; places `lines` lanes 40 px apart centred on the player, perpendicular to it. Each lane shows a `telegraphLine` (half width 10, colour `0xffe14d`) for 0.8 s, then `count / lines` enemies spawn in a column just outside the view and cross it in `MODE_STRAIGHT` at `speed`. Lanes fire 0.15 s apart. Banner kind `lanes`. |
| `teleportIn` | `enemy, count, label?` | `count` sparkle telegraph circles (r 10, 0.6 s) at 40-70 px from the player (≥ 90 px for `plot_hole`), evenly spread with jitter; the enemies appear in a puff. |
| `bulletRain` | `sprite, count, duration, label?` | Over `duration` s, `count` bullets fall from the top edge of the view at random x across the player's view, 65-85 px/s straight down, dmg 10, each preceded by a 0.6 s ground shadow at its landing row; never spawned within 40 px horizontally of the player in the first 0.5 s. |
| `tideSweep` | `duration, speed, label?` | A 60-px water band crosses the view from a random edge to the opposite one (telegraphed by a foam line for 1 s). Inside it: the player is slowed 40%, enemies are pushed along at 30 px/s. No damage. The view draws translucent water + foam. |
| `schoolBell` | `count, label?` | Chime sfx (`narratorSting`); every Hall Monitor on screen does its whistle dash immediately; `count` Hall Monitors spawn evenly around the view edges. |
| `commercialBreak` | `duration, enemy, count, label?` | Letterbox bars slide in (view) with a small eyecatch card `WE'LL BE RIGHT BACK!` at the top (never covering the hero); spawning pauses for `duration` s while existing enemies keep acting; then `AND WE'RE BACK!` and a `flood` of `count` `enemy` over 4 s. |
| `flashback` | `count, label?` | `PREVIOUSLY ON...` banner; an encircle of `count` enemies drawn from earlier stages (`puff`, `gummy_bear`, `love_letter`, `crab_kun`, equal weights) with a sepia tint (`0xdda574`) and base HP 70; they use their original speech pools. |

---

## 6. Plot Twists ("heat")

Opt-in modifiers chosen on the stage card (EXPANSION §10). `TwistDef.heat` is the
per-rank **increment** array; "total" is the heat at max rank. Total heat pays
`TUNING.payout.heatCoinPer` / `heatGemPer`. Badges at heat 4, 8, 16, 32 per
stage. Max possible heat: **41**.

**Unlocking.** A stage's twist menu opens after that stage's first clear. The
twist roster grows with clears: Dream Meadow clear unlocks the first 6; Candy
Kingdom +3; Shoujo Academy +2; Beach Episode +2; The Final Arc +2.

| # | id | Name | Ranks | heat | total | Effect per rank | Icon (16×16) | Unlocked by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `budget_cuts` | Budget Cuts | 3 | [1,1,1] | 3 | Enemy HP +25% / +50% / +75% | a cracked piggy bank | Dream Meadow |
| 2 | `filler_overload` | Filler Overload | 2 | [1,2] | 3 | Spawn rate +30% / +60%, max alive +10% / +20% (device cap still applies) | a stack of film reels | Dream Meadow |
| 3 | `rushed_production` | Rushed Production | 2 | [1,1] | 2 | Enemy bullets +30% / +60% speed | a clock with speed lines | Dream Meadow |
| 4 | `censored` | Censored | 2 | [2,2] | 4 | R1: no food or heal pickups (props drop coins instead; pickups show a black "CENSORED" bar); R2: also no level-up heal | a black bar over a heart | Dream Meadow |
| 5 | `cliffhanger` | Cliffhanger | 2 | [1,2] | 3 | Max HP −20% / −40% | a hero hanging from a cliff edge | Dream Meadow |
| 6 | `power_creep` | Power Creep | 2 | [1,2] | 3 | R1: elites ×2 per elite event; R2: ×3 and elites +50% HP | a rising arrow over a crown | Dream Meadow |
| 7 | `spoilers` | Spoilers | 1 | [1] | 1 | No boss WARNING and no spawn pause: bosses just appear ("the warnings were spoilers") | a speech bubble with a "!" crossed out | Candy Kingdom |
| 8 | `dub_version` | Dub Version | 2 | [1,2] | 3 | Enemies +15% / +30% move speed | a microphone with a "?" | Candy Kingdom |
| 9 | `mid_season_break` | Mid-Season Break | 2 | [1,1] | 2 | R1: no rerolls; R2: also no banishes and no skips | a calendar with a big X | Candy Kingdom |
| 10 | `darker_and_edgier` | Darker and Edgier | 3 | [1,1,2] | 4 | Enemy damage +20% / +40% / +60%; R3 also tints the stage grade 15% darker (gameplay sprites protected) | a cute plush with an eyepatch | Shoujo Academy |
| 11 | `light_novel_title` | Light Novel Title | 1 | [2] | 2 | Level-ups offer 1 fewer card (minimum 2) — "the titles take up too much space"; card names get a long subtitle ("Star Shot: The Homing Stars I Fired in Another World Were Secretly Level 99?!") | an open book with a very long title | Shoujo Academy |
| 12 | `shounen_rival` | Shounen Rival | 3 | [1,1,2] | 4 | A `rival_recolour` hunts you every 90 / 60 / 40 s (enemies.md §4) | two clashing fists | Beach Episode |
| 13 | `studio_change` | Studio Change | 1 | [1] | 1 | Elites have no rainbow outline until they are first hit ("the new studio forgot the outlines") | a paint palette with a "?" | Beach Episode |
| 14 | `sequel_hook` | Sequel Hook | 2 | [2,2] | 4 | R1: the final boss gets back up once at 40% HP with a 3 s flourish ("IT'S NOT OVER!"); R2: every boss does | a "TO BE CONTINUED" arrow | The Final Arc |
| 15 | `simulcast_delay` | Simulcast Delay | 2 | [1,1] | 2 | Overdrive charges 25% / 50% slower | a buffering spinner | The Final Arc |

`desc(rank)` texts: the "Effect per rank" column with the rank's numbers only,
e.g. `Budget Cuts II: enemy HP +50%`. Twist cards show a parody "network note"
subtitle:

| Twist | Network note |
| --- | --- |
| Budget Cuts | "We're reallocating the HP budget to the villains." |
| Filler Overload | "Can we stretch this to 52 episodes?" |
| Rushed Production | "Animate faster. The bullets too." |
| Censored | "Snacks tested poorly with focus groups." |
| Cliffhanger | "Leave them hanging. Literally." |
| Power Creep | "Every villain needs a stronger villain." |
| Spoilers | "The trailer showed everything anyway." |
| Dub Version | "The enemies talk faster in this version." |
| Mid-Season Break | "No rerolls until we're back in the spring." |
| Darker and Edgier | "Kids love grit, right? Right?" |
| Light Novel Title | "Our Hero, Who Was Given Fewer Cards, Somehow Survives Anyway" |
| Shounen Rival | "Give them a rival. Test audiences love yelling." |
| Studio Change | "New studio, new look. Elites? Who?" |
| Sequel Hook | "Nobody really dies if there's a sequel." |
| Simulcast Delay | "Overdrive will be available one week later in your region." |

---

## 7. Endless — the "Filler Arc"

- **Opt-in:** after a stage's first clear its stage card gets a `CONTINUE INTO
  FILLER ARC` toggle (`RunConfig.endless`). With it on, the final boss's death
  does not end the run: banner `TO BE CONTINUED... IN THE FILLER ARC!`, the stage
  counts as cleared (`stageCleared`), the clear rewards are banked, and the run
  goes on.
- **Scaling:** per the stage's `EndlessDef` (above): HP and spawn rate keep rising
  per endless minute, elite waves every `eliteEvery` s (growing by 1 each wave),
  boss rematches every `bossEvery` s cycling the stage's bosses with
  +`bossHpPerLoop` HP per loop.
- **Episode cards:** every 5:00 of endless time a title card slides in:
  `FILLER EPISODE N: <random filler title from satire.md §2.2>`.
- **Rewards** keep counting (`TUNING.payout.endlessCoinsPerMinute`,
  `endlessGemsPerMinute`). The run ends only on death (`TO BE CONTINUED →`) or quit.
- **Records:** best endless time per stage (codex Stages tab, stage card badge),
  shown as `Filler Arc record 23:41`.
- **Network Notes (optional, if `cancel_sama` is registered):** at endless 30:00
  and every 15:00 after, in any stage, a rematch of Cancel-sama's phase-1 pattern
  set ("NETWORK NOTES: PLEASE WRAP IT UP") with 50% of his HP; beating it pays a
  rematch bonus and counts `bossRematches`.

## 8. Stage map and stage cards (hub)

Five stage cards on a vertical "season" strip (portrait first), each a fake
episode thumbnail with: the stage name, the subtitle, a 3-line blurb, best time,
best heat (with badge), Filler Arc record, `rewardMul` shown as
`Ratings ×1.5`, the twist menu (after the first clear) and the endless toggle.
Locked cards show a silhouette and `UNLOCKS AFTER: <previous stage> (no spoilers)`.
