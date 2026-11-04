# Heroes

11 heroes (EXPANSION §6). The first three exist (`src/game/heroes.ts`); their
traits, weapons and ultimates do not change. This file adds the 8 new heroes,
the talent trees and constellations for all 11, the OC bios for all 11 and the
art direction for the new sprites.

Base player: 100 HP, 72 px/s, hitbox radius 6 (CFG). Hero level (1-30, from
hero XP) gives +1% might and +1% max HP per level above 1 and one talent point
per level (30 points at Lv30). Unlocks are in `achievements.md` (story heroes)
and `gacha.md` (gacha heroes).

---

## 1. Roster

| # | id | Name | Title (select screen) | Source / gacha rarity | Start weapon | Ultimate |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `hoshi` | Hoshi | Star Magician | start / SR dupes | `star_shot` | `supernova_shower` |
| 2 | `rin` | Rin | Shrine Swordswoman | defeat King Puff / SR | `petal_slash` | `thousand_blossom_cut` |
| 3 | `mochi` | Mochi | Neko Girl | 3,000 lifetime kills / SR | `yarn_orbit` | `nyan_stampede` |
| 4 | `kuro` | Kuro | Lord of the Abyssal Flame | reach 6:00 in Dream Meadow / SR | `dark_flame_dragon` | `eternal_abyss` |
| 5 | `pudding` | Pudding | Maid Café Ace | clear Dream Meadow / SR | `teapot_tempest` | `omurice_of_love` |
| 6 | `aoi` | Aoi | Mecha Pilot (Licensed Since Tuesday) | clear Candy Kingdom / SR | `micro_missile_swarm` | `get_in_the_robot` |
| 7 | `akane` | Akane | Tsundere Drill Princess | clear Shoujo Academy / SR | `baka_harisen` | `not_like_i_like_you` |
| 8 | `senpai` | Senpai | Sparkly Bishounen | gacha SSR or Copium | `notice_me_sparkles` | `senpai_noticed_you` |
| 9 | `magical_girl_47` | Magical Girl #47 | Aggressively Generic Magical Girl | gacha SSR or Copium | `henshin_burst` | `episode_long_transformation` |
| 10 | `isekai_kun` | Isekai-kun | Beige Overpowered Protagonist | gacha UR or Copium | `cheat_fireball` | `status_screen` |
| 11 | `truck_kun` | Truck-kun | The Isekai Truck (Playable) | MYTHIC banner or 1,000-pull spark | `horn_of_reincarnation` | `isekai_express` |

### 1.1 Traits (exact `apply(s)`)

| Hero | Trait name | Card text | `apply(s)` |
| --- | --- | --- | --- |
| Hoshi | (existing) | +10% projectile speed, −5% cooldown | unchanged |
| Rin | (existing) | +20 max HP, +10% damage | unchanged |
| Mochi | (existing) | +15% move speed, +20% pickup range, 1 armor | unchanged |
| Kuro | Sealed Power | +15% area, +10% duration, −10 max HP (the seal is heavy) | `area += 0.15; duration += 0.10; maxHp -= 10` |
| Pudding | Customer Service | +0.3 HP/s regen, +15% healing, +10% luck | `regen += 0.3; healMul += 0.15; luck += 0.10` |
| Aoi | Mech Suit | +1 projectile, +1 armor, −15% move speed | `amount += 1; armor += 1; moveSpeed -= 0.15` |
| Akane | Tsun Tsun | +10% damage, +30% knockback, +5% crit chance | `might += 0.10; knock += 0.30; crit += 0.05` |
| Senpai | Effortless Charisma | +20% luck, +10% XP, enemies within 40 px are 10% slower (they're staring) | `luck += 0.20; growth += 0.10` + install: enemies with distance < 40 px get `slow = min(slow, 0.9)` each step |
| Magical Girl #47 | Perfectly Average | +5% to EVERYTHING | `might, area, moveSpeed, projSpeed, duration, pickup, luck, growth, greed += 0.05; cooldown -= 0.05; maxHp += 5` ("every stat" below always means this exact list) |
| Isekai-kun | Cheat Skill | +15% damage, +15% XP, starts every run at Lv 3 | `might += 0.15; growth += 0.15` + `RunConfig.start.level = max(start.level, 3)` |
| Truck-kun | Heavy Vehicle | +80 max HP (2x the base 80), 3 armor, +50% pickup, −15% move speed, can't be knocked back, bigger hitbox | `maxHp += 80; armor += 3; pickup += 0.5; moveSpeed -= 0.15` + player radius 9, knockback on the player ignored |

### 1.2 UI colours

`color` is the accent, `colors` the afterimage/confetti set, `band` the cut-in
band `[c1, c2, c3]` for `src/ui/cutin.ts`.

| Hero | color | colors | band |
| --- | --- | --- | --- |
| Kuro | `C.darkViolet` | darkViolet, violet, red, deep | `#ddc6ff` `#743fd1` `#2d1b45` |
| Pudding | `C.paleYellow` | paleYellow, gold, pinkLight, white | `#fff0c9` `#f2bd66` `#a6683f` |
| Aoi | `C.blue` | blue, lightBlue, yellow, white | `#b0d8ff` `#5aa8ff` `#3462d6` |
| Akane | `C.orange` | red, orange, yellow, pinkLight | `#ffe14d` `#ff9a3d` `#ad1d4a` |
| Senpai | `C.lavender` | lavender, pinkLight, white, red | `#ffffff` `#ddc6ff` `#ff7ab8` |
| Magical Girl #47 | `C.mint` | mint, lightBlue, white, pinkLight | `#d0f7ad` `#b0d8ff` `#5aa8ff` |
| Isekai-kun | `C.cyan` | `0xdda574` (tan), cyan, aqua, white | `#fff0c9` `#dda574` `#1c97ad` |
| Truck-kun | `C.white` | white, lightBlue, yellow, blue | `#e9e3f7` `#5aa8ff` `#1f2a73` |

---

## 2. The 8 new heroes

Each entry: concept, ultimate (exact mechanics), cut-in, sprite and portrait art
direction. All ultimates: player invulnerable while active, enemy bullets
cleared at start (generic), damage on channel `CH_ULT`, source id = ult id.

### 2.4 Kuro — Lord of the Abyssal Flame

A 14-year-old chuunibyou who believes his bandaged right arm seals an abyssal
power. His "Dark Flame Dragon" is a small orange salamander he calls
**Ragnarok, Scourge of the Seventh Abyss** (everyone else calls it Mr. Toasty). Kuro insists
its flames are black. They are orange.

**Ultimate `eternal_abyss` — "FORBIDDEN TECHNIQUE: ETERNAL ABYSS"** (duration 3.6 s)
- 0.0 s: grade lerps to `dim` over 0.3 s; vignette closes to 60%.
- 0.2-2.6 s: a colossal shadow sweeps across the screen left → right: it is
  the `w_salamander` sprite drawn at ×10 scale, tinted `#140c22` at 85% alpha,
  wings implied by two `fx_streak` blurs. Every enemy in view takes a tick of
  **24** every 0.24 s (10 ticks = 240 total) and is slowed 70% while it lasts.
- 2.8 s: flash. The grade snaps back. On the ground in front of Kuro, revealed
  for 0.8 s: the real salamander and a tiny `ult_flashlight` pointed at it.
  Floating text above it: `...it's a large shadow.` (font_main, lavender).
- Kills during the ult drop no confetti; they burst into 6 black `fx_px`
  "feathers" (Kuro's request).
- Cut-in title `FORBIDDEN TECHNIQUE: ETERNAL ABYSS`, line: *"My right arm...
  it's RESONATING!! Stand back — I can't hold the seal!!"*

**Sprite (24×24, `kuro_*`)** — silhouette: spiky black hair with one long fringe
over the near eye, a high-collared tattered cape flaring behind (the widest
shape), one bandaged arm held out. Keys: hair `0/1/2` with `f` sheen and ONE
crimson streak `r`; skin `s/k/t`; visible eye crimson `R/r` + `w` shine; the
eyepatch `0` (with a 1-px `y` star on it) covers the near eye; navy school jacket
`n/U`; cape `0/2` outside, `R` lining; bandages `W/g` on the right forearm with
two violet rune pixels `i` that blink on idle f2. Mr. Toasty (`o/O/y`, 3×2 px) sits
on his left shoulder. Idle: cape hem waves, rune blink, salamander tail flick.
Run: cape streams back hard, he runs with the bandaged arm extended forward
(classic). Hurt: `><` eyes, the eyepatch flips up for one frame revealing a
perfectly normal eye. Cast f0-1: bandaged arm thrust upward, rune pixels lit
`i/j`, cape fully flared, salamander breathing a 2-px orange flame.

**Portrait (64×64, `portrait_kuro`)** — 3/4 view facing right like the cast.
Big crimson visible eye, eyepatch with a hand-drawn star, a band-aid on the
cheek, collar up to the nose. Background sparkle pixels are black-violet
"dark sparkles". f0 = smug half-lidded smirk, hand over the eyepatch in the
"cool pose" (two fingers framing the eye). f1 = shouting, mouth wide, bandaged
fist in the foreground glowing violet, the salamander on his shoulder also
shouting (tiny open mouth). Deliberately overdrawn: three belts on the collar.

### 2.5 Pudding — Maid Café Ace

19-year-old head maid of the (fictional) Café Purin Purin. Unshakeably
professional. Says "Welcome home!" to bosses.

**Ultimate `omurice_of_love` — "OMURICE OF LOVE: MOE MOE KYUN!"** (duration 3.5 s)
- 0.0 s: an `ult_omurice` (f0, plain) plops onto the ground under Pudding with
  a squash (scale 1.4 → 1), dust ring.
- 0.4 s: frame f1 (ketchup heart drawn on it), sparkle burst.
- 0.9 / 1.8 / 2.7 s: three heart pulses (`fx_ring_thick` tinted pink, plus 12
  `fx_heart` particles flying outward). Each pulse: **110** damage to every
  enemy within 96 px, knockback 120 (third pulse 300), and heals 8% of max HP
  (× `healMul`). Floating text per pulse: `MOE` / `MOE` / `KYUN♡` (font_main,
  pink, bouncing).
- Enemies killed by the ult have a 30% chance to drop a tiny heart pickup
  (heal 2, uses `fx_heart` sprite, picked up like food).
- Cut-in title `OMURICE OF LOVE: MOE MOE KYUN!`, line: *"Welcome home, Master~!
  Now say it with me... MOE MOE KYUN♡!"*

**Sprite (24×24, `pudding_*`)** — silhouette: two round hair buns + a tall lace
headdress (reads as a "crown"), puffy short sleeves, wide apron skirt, a silver
tray held flat at shoulder height with a wobbling pudding on it (tray is the
signature shape). Keys: hair `F/B/Y`; headdress `w/W` with `g` lace dots; eyes
caramel `d/H/h` + `w`; dress `1/2`; apron `w/W` with a pink `p` heart pocket;
tray `g/W/w`; pudding `y/Y` with a `d` caramel top. Idle: the pudding wobbles
(1-px squash on f1/f3), she does a tiny curtsy dip on f2. Run: skirt bounces,
tray stays perfectly level (she is a professional) — the pudding jiggles.
Hurt: `><`, the pudding flies 2 px off the tray. Cast: tray raised high, a
heart `p/q` above it.

**Portrait (`portrait_pudding`)** — honey buns with lace headdress, caramel eyes
with heart-shaped highlights (`w` pixels arranged as a 3×3 heart), frilly
collar, a small name badge "PUDDING ♡". f0 = closed-eye service smile, head
tilted, a sparkle at the corner. f1 = both hands forming a heart shape in front of
her face at chin height, fingers clearly drawn, mouth open on "KYUN", eyes
shining, a ketchup bottle tucked under one arm.

### 2.6 Aoi — Mecha Pilot (Licensed Since Tuesday)

A 12-year-old ace who pilots a chibi mech roughly the shape of a trash can with
legs. She designed it herself and is very proud.

**Ultimate `get_in_the_robot` — "GET IN THE ROBOT!!"** (duration 3.6 s)
- Picks the 3 densest enemy clusters in view (grid 48 px, most enemies first;
  a boss counts as 10).
- For each cluster at 0.0 / 1.0 / 2.0 s: telegraph circle r 60 (`telegraphCircle`,
  blue) for 0.6 s; a giant `ult_robot_fist` (f0 open hand → f1 fist at 0.3 s)
  falls from 220 px above at 600 px/s with a shadow growing under it.
- Impact (0.9 / 1.9 / 2.9 s): explosion r 64, **260** damage, knockback 300,
  shake 0.5, shockwave, debris, `explosionBig`.
- 3.1 s: ROCKET PUNCH — the fist flies horizontally across the whole view
  through the player's row (a lane 40 px tall, telegraphed 0.25 s), **200**
  damage to everything in the lane, pierce ∞, speed lines.
- Cut-in title `GET IN THE ROBOT!!`, line: *"I don't need a license for a
  GIANT FIST!!"*

**Sprite (24×24, `aoi_*`)** — silhouette: a round-bellied mech (16 px wide)
with stubby legs and two chunky arm cannons; a glass dome on top with Aoi's head
inside (blue bob, aviator goggles pushed up). Keys: mech `w/W/g/G` with `u` blue
panels and `y/2` caution stripes on the shins; dome `a` (semi-transparent local
pal `#bafff6aa`) with a `w` shine; hair `u/U/n`; goggles `c/a`; eyes `u/n` +
`w`. Idle: dome bobs 1 px, a status light blinks `r/l` on f2, exhaust puff on f3.
Run: stomping waddle, legs alternate, tiny jet flames `o/y` from the back on f2/f5.
Hurt: dome cracks one pixel line, `><` inside. Cast: both arm cannons raised,
fists clenched, dome sparkling.

**Portrait (`portrait_aoi`)** — Aoi without the mech in a pilot suit (blue/white),
goggles on forehead, a plaster on the nose, a wrench tucked behind the ear.
f0 = proud grin with a thumbs up, one sparkle on the goggles. f1 = screaming
battle cry, fist forward, background speed lines, the goggles pulled DOWN with
reflected fire in them.

### 2.7 Akane — Tsundere Drill Princess

16, rich, competitive, armed with a paper fan. Has never once admitted to
anything.

**Ultimate `not_like_i_like_you` — "IT'S NOT LIKE I LIKE YOU!! BARRAGE"** (duration 3.4 s)
- 36 harisen smacks, one every 0.08 s from 0.1 s: each picks a random enemy in
  view (a boss is picked at most every 4th smack), spawns a `w_harisen` swing
  (scale 1.5, random rotation) on it: **70** damage, knockback 260, stun 0.3 s,
  and a `fx_baka` pop (pops rate-limited to 1 per 0.25 s, never over the hero).
- 3.0 s: final smack — a 360° ring r 90 around Akane: **150** damage,
  knockback 400, `fx_baka` at 2× scale.
- 3.2 s: her f1 portrait slides back in for 0.4 s with the caption
  `...h-hmph.` (cosmetic, DOM).
- Cut-in title `IT'S NOT LIKE I LIKE YOU!! BARRAGE`, line: *"D-don't get the
  wrong idea! I'm only saving you because you're in my WAY!!"*

**Sprite (24×24, `akane_*`)** — silhouette: two enormous spiral drill
twin-tails, each as tall as her body, sticking out sideways — the drills ARE
the character. Keys: drills `R/r/o` with `z` spiral highlights (3 spiral bands
per drill); eyes `Y/y` + `w`, sharp brows `1`; permanent blush `b`; big bow `R`;
sailor-style uniform `w/W` top, navy `n` collar, red `r` tie, skirt `R`;
harisen `W/g` with `G` fold lines held at the hip. Idle: drills bounce
(spring 1 px out of phase), arms crossed, she looks away on f2 ("hmph").
Run: drills swing behind like pendulums, harisen held forward. Hurt: `><`,
drills uncoil 1 px. Cast: harisen raised overhead in both hands, mouth open.

**Portrait (`portrait_akane`)** — the drills frame the whole 64×64 (cropped at
the edges, they don't fit; that's the joke). Golden eyes, pointed brows, blush
lines `b` drawn as 3 diagonal strokes. f0 = arms crossed, looking away to the
right, pout, a small "hmph" puff cloud. f1 = harisen swinging toward the
viewer, mouth wide on "BAKA", eyes squeezed into triangles, blush maxed (whole
cheeks `b`).

### 2.8 Senpai — Sparkly Bishounen

18, third-year, permanently backlit. Has never noticed anyone. Enemies within
range simply stop and stare. This is played purely as admiration/being
noticed, nothing more.

**Ultimate `senpai_noticed_you` — "SENPAI NOTICED YOU"** (duration 3.5 s)
- 0.0 s: a pink shoujo frame (DOM overlay: rose + sparkle border, 0.3 s fade
  in; `fx_rose_big` sprites in the 4 corners), bloom +30%.
- Every non-boss enemy in view is **Swooned** for 4 s: stops moving, a beating
  `fx_charm_heart` over its head, takes +50% damage from all sources.
- Bosses are **Flustered**: stunned 1.5 s (no pattern progress), +25% damage
  taken for 4 s, a heart pops over them.
- 1.2 s and 2.4 s: two sparkle waves (`fx_ring` ×2 white/pink) — **120**
  damage to every enemy in view each.
- Cut-in title `SENPAI NOTICED YOU`, line: *"...Oh. You were there? ✧"*

**Sprite (24×24, `senpai_*`)** — silhouette: tall for a chibi (head 50%), long
side-swept lavender-silver hair covering one eye, an open white blazer whose
tails flutter, a single red rose in the breast pocket. Sparkles are part of the
sprite: 2-3 `w/z` 1-px twinkles around him that move per frame. Keys: hair
`j/g/w`; eyes `I/i` + long `0` lashes; blazer `w/W/g` with `Y` buttons; shirt
`W`; tie `I`; rose `r/R` + `E` stem. Idle: hair sways, he brushes his fringe on
f2, sparkles drift. Run: a leisurely jog with the blazer streaming, one hand in
pocket. Hurt: sparkles vanish for 1 frame, `><`. Cast: hair flip, rose held out
toward the camera, 5 sparkles.

**Portrait (`portrait_senpai`)** — classic shoujo: huge lashes, eye shine
`w` as a 4-point star, roses in the background corners, screentone dots `j`.
f0 = looking AWAY (eyes to the far right, off-camera), serene, wind in hair.
f1 = he finally looks at the camera — eyes sparkling, gentle smile, rose
offered toward the viewer, extra sparkles everywhere.

### 2.9 Magical Girl #47 — Aggressively Generic Magical Girl

15. The 47th magical girl of her series. Nobody remembers her name, including
the narrator. Her "Henshin Burst" makes her invulnerable mid-transformation
because, as everyone knows, nobody attacks during a transformation.

**Ultimate `episode_long_transformation` — "EPISODE-LONG TRANSFORMATION SEQUENCE"** (duration 6.0 s, the longest ult)
- Ribbons (`w_ribbon`, 16) spin around her the whole time; she rotates slowly
  (cast frames).
- Five transformation stages at 1.0 / 2.0 / 3.0 / 4.0 / 5.0 s: radial bursts
  of r 40 / 60 / 80 / 110 / whole view, **90 / 90 / 90 / 90 / 180** damage,
  knockback 100 each, a `fx_henshin` flash and a stage caption (font_main):
  `RIBBONS!` / `SPARKLES!` / `SHOES!` / `MORE RIBBONS!` / `TRANSFORMED!`
- Narrator caption (DOM, bottom) during the ult: *"This transformation has been
  running for four minutes."*
- Cut-in title `EPISODE-LONG TRANSFORMATION SEQUENCE`, line: *"Magical...
  Miracle... Something-or-other... (what was my catchphrase?) TRANSFORM!!"*

**Sprite (24×24, `magical_girl_47_*`)** — silhouette: the "default" magical girl
template — shoulder-length hair with a single heart clip, puffy dress, heart wand.
It must look clean and slightly too symmetrical, like a template. Keys: hair
`v/u/w` (light blue, NOT pink — "the other one is pink"); clip `p`; eyes `u` +
`w`; dress `m/l/e` with `w` frills; boots `w/W`; wand `p/q` heart on a `g`
stick; a 2×2 `y` badge on the chest. Idle: wand bob, a polite wave on f2.
Run: textbook magical-girl run, one arm back. Hurt: `><`, clip pops off for
a frame. Cast: wand up, a heart sparkle `q/w` above.

**Portrait (`portrait_magical_girl_47`)** — perfectly average face (standard
eyes, standard smile), heart clip, a name tag sticker reading `HELLO my name
is` with an illegible scribble (3 rows of messy `G` pixels), badge "#47".
f0 = hopeful smile, slightly sweating (`a` sweat drop). f1 = transformation
pose: wand thrust up, ribbons swirling, mouth open mid-shout, one eye closed
in the wink every magical girl does.

### 2.10 Isekai-kun — Beige Overpowered Protagonist

17. Reincarnated after a traffic incident (see Truck-kun). Unremarkable in every
way except all of his stats. Genuinely confused by his own power.

**Ultimate `status_screen` — "STATUS SCREEN!!"** (duration 3.6 s)
- A huge translucent status window (`ult_status_window`, scaled to the view
  width) slams down three times, in three horizontal bands covering the view
  (top third, middle third, bottom third, order: top → bottom → middle).
- Each band: 0.4 s telegraph (blue outline rectangle via `telegraphLine` ×4,
  colour `0x5aa8ff`), then the window slams (scale 1.2 → 1.0, shake 0.4):
  **380** damage to every enemy in the band. Damage numbers in the band show
  the fake text `9999999` (view-only) instead of the real number.
- Band times: 0.6 / 1.4 / 2.2 s. At 3.0 s floating text over Isekai-kun:
  `...did I overdo it again?`
- Cut-in title `STATUS SCREEN!!`, line: *"Huh? Is this a lot? Everyone has
  numbers like these, right?"*

**Sprite (24×24, `isekai_kun_*`)** — silhouette: the most average boy possible:
short flat hair (no volume at all), plain hoodie, a grey adventurer cape over
it, a sword on his back he never draws. A tiny blue status-window icon (3×3 `u/a`)
floats beside his head and bobs. Keys: hair `h/H/d`; eyes `H/d` + `w`
(deliberately small and neutral); hoodie `B/h`; cape `G/2`; trousers `n`;
sword hilt `g/Y`. Idle: completely still except a blink and the floating icon
(the stillness is the joke). Run: casual jog, hands in hoodie pocket. Hurt: a
single sweat drop `a`, eyes become `..`. Cast: one finger raised casually,
status icon enlarges to 6×6 above the finger.

**Portrait (`portrait_isekai_kun`)** — flat-shaded on purpose (fewer shading
steps than everyone else), plain brown eyes, blank expression, hoodie strings.
f0 = blank "huh?" face, a tiny `?` above his head. f1 = the SAME blank face but
with a single sparkle and a sweat drop, a glowing blue status window floating
behind him filled with `w/v` "number" pixels.

### 2.11 Truck-kun — The Isekai Truck (Playable)

A light-duty cab-over delivery truck, model year 2009. Has sent a statistically
improbable number of protagonists to other worlds. Insists it was just doing its
job. The anime eyes are painted in its windshield.

**Ultimate `isekai_express` — "ISEKAI EXPRESS"** (duration 4.0 s)
- 0.0 s: honk (`honk`), white flash 0.4 (respects Reduce flashing).
- Four lanes, each telegraphed 0.4 s with a lane line (`telegraphLine`, half
  width 14, `0xffe14d`), then a ghostly Truck-kun (`truck_kun_run` drawn ×2
  scale, tint `0xbafff6`, alpha 0.7, speed lines) drives across the whole view at
  520 px/s: lanes at 0.4 s (top quarter, left→right), 1.2 s (bottom quarter,
  right→left), 2.0 s (middle, left→right), 2.8 s (the "express lane": straight
  through the densest cluster, aimed from the nearest view edge).
- Everything in a lane: **420** damage, knockback 350 along the lane.
- Non-boss enemies killed by the ult are **isekai'd**: no confetti — a
  `fx_light_pillar` rises from them and they drop +1 extra gem.
- Cut-in title `ISEKAI EXPRESS`, line: *"HONK HONK. (Translation: Your next
  life will be better.)"*

**Sprite (32×24, `truck_kun_*`, feet pivot (16, 23))** — side view, facing right:
a boxy cab-over truck, cab on the right third, cargo box on the left two thirds.
The windshield holds two big anime eyes (`0` pupils, `w` shines, `u` iris) and
a 1-px `b` blush sticker below. Keys: body `w/W/g`; blue racing stripe `u/U`;
headlights `y/z`; bumper `G/2`; wheels `0/1/G` with `g` hub; cargo box `W` with
a tiny pink `p` logo (a heart with wings — "Reincarnation Services"); plate
`y` + `1` dots. Idle: engine rumble (body shifts 1 px on f1/f3, exhaust puff
`g` on f2), eyes blink on f2. Run: wheels rotate (hub pixel moves around), body
bounces 1 px, eyes determined. Hurt: eyes `><`, a dent pixel `G` on the box.
Cast: headlights blaze (2 light-cone rows of `z` 6 px forward), eyes sparkle,
horn lines `w` above the cab.

**Portrait (`portrait_truck_kun`)** — the truck seen front-on, filling the
frame: windshield = huge anime eyes with lashes, grille = a small smile,
headlights = cheeks with blush `b`. f0 = friendly closed-eye smile (`^ ^`
eyes), sparkle on the side mirror. f1 = eyes wide and blazing, grille open
like a shouting mouth, headlights glaring `z/w` beams, horn sound lines.

---

## 3. Talent trees (all 11 heroes)

**Rules** (contract: `src/game/defs.ts`): 3 branches × 5 tiers, one node per
tier per branch. Ranks per tier: **T1 ×5, T2 ×3, T3 ×3, T4 ×3, T5 ×1** = 15
per branch, 45 per tree. Tier gate `TALENT_TIER_POINTS = [0, 2, 5, 9, 14]`
points already in the branch, so a capstone needs its whole branch. A Lv30 hero
has 30 points = **two full branches** (or a spread): the third branch is the
respec decision. Every T5 capstone changes the **ultimate** (ULT) or the
**start weapon** (WPN); every hero has at least one of each.

Node ids are `<hero>_<slug>` as written. "per rank" values stack linearly.
Weapon-specific effects read `w.talentRank(id)` inside the weapon/ult code
(they also apply to that weapon's evolution unless noted).

### Hoshi — Idol Arc / Plot Armor / Star Power

| T | Idol Arc | Plot Armor | Star Power |
| --- | --- | --- | --- |
| 1 | `hoshi_choreography` **Choreography** ×5: +4% projectile speed per rank | `hoshi_main_character_hp` **Main Character Durability** ×5: +5 max HP per rank | `hoshi_twinkle` **Twinkle** ×5: +1% crit chance per rank |
| 2 | `hoshi_fan_chant` **Fan Chant** ×3: Star Shot +6% damage per rank; at rank 3 stars pierce +1 | `hoshi_convenient_shield` **Convenient Shield** ×3: +1 shield charge (rank 1); recharge 30 / 25 / 20 s | `hoshi_shooting_star` **Shooting Star** ×3: +10% crit damage per rank |
| 3 | `hoshi_spotlight` **Spotlight** ×3: −3% cooldown per rank | `hoshi_determination` **Sheer Determination** ×3: +3% damage reduction per rank | `hoshi_wish_upon` **Wish Upon a Star** ×3: +3% might per rank |
| 4 | `hoshi_backup_dancers` **Backup Dancers** ×3: Star Shot fires +1 star per rank | `hoshi_dramatic_recovery` **Dramatic Recovery** ×3: when a shield breaks, heal 3 / 5 / 7% max HP and release a star ring (r 40, 30 / 45 / 60 dmg) | `hoshi_falling_star` **Falling Star** ×3: Star Shot crits split into 2 mini-stars (30 / 40 / 50% damage, homing, pierce 1) |
| 5 | `hoshi_encore` **ENCORE!** (ULT): 1.5 s after Supernova Shower ends, an Encore: 15 more meteors fall in a heart outline around Hoshi (r 70) + "ENCORE!" banner | `hoshi_guardian_stars` **Guardian Stars** (WPN): 2 Star Shot stars orbit Hoshi permanently (r 20, 3 rad/s); each blocks enemy bullets it touches and fires back a star at the shooter (once per 0.5 s per orbiter) | `hoshi_supernova_supreme` **Supernova Supreme** (ULT): every meteor is a guaranteed crit and the last 5 meteors are huge (r 56, ×1.5 damage) |

### Rin — Way of the Blade / Shrine Maiden / Oni Hunter

| T | Way of the Blade | Shrine Maiden | Oni Hunter |
| --- | --- | --- | --- |
| 1 | `rin_honed_edge` **Honed Edge** ×5: +3% might per rank | `rin_purified_body` **Purified Body** ×5: +5 max HP per rank | `rin_red_eyes` **Red Eyes** ×5: +1% crit chance per rank |
| 2 | `rin_wide_stance` **Wide Stance** ×3: Petal Slash area +6% per rank | `rin_ward_talisman` **Ward Talisman** ×3: +2% damage reduction per rank | `rin_killing_intent` **Killing Intent** ×3: +5% damage vs elites and bosses per rank |
| 3 | `rin_quickdraw` **Quickdraw** ×3: −3% cooldown per rank | `rin_shrine_blessing` **Shrine Blessing** ×3: +0.1 HP/s regen per rank | `rin_battle_focus` **Battle Focus** ×3: +5% crit damage per rank |
| 4 | `rin_petal_storm` **Petal Storm** ×3: each slash launches 1 / 2 / 3 petal blades at the nearest enemies (8 dmg, homing, pierce 1) | `rin_exorcism` **Exorcism** ×3: kills have a 1 / 2 / 3% chance to release an ofuda burst (r 32, 40 dmg) | `rin_execution` **Execution** ×3: Petal Slash instantly kills non-boss enemies under 10 / 15 / 20% HP |
| 5 | `rin_crescent_draw` **Crescent Moon Draw** (WPN): every 3rd Petal Slash is a 360° moon slash (r 56, ×1.5 damage) | `rin_sacred_ground` **Sacred Ground** (ULT): Thousand Blossom Cut leaves a shrine circle (r 70, 6 s): Rin regenerates 3 HP/s inside, enemies inside take 20 dmg every 0.5 s | `rin_ten_thousand` **Ten Thousand Blossoms** (ULT): 24 slash lines instead of 12, and the final burst hits twice (second hit 50%) |

### Mochi — Cat Nap / Nine Lives / Zoomies

| T | Cat Nap | Nine Lives | Zoomies |
| --- | --- | --- | --- |
| 1 | `mochi_fluffy` **Fluffy** ×5: +4% area per rank | `mochi_lands_on_feet` **Lands on Feet** ×5: +5 max HP per rank | `mochi_zoomies` **Zoomies** ×5: +3% move speed per rank |
| 2 | `mochi_kneading` **Kneading** ×3: Yarn Orbit +8% damage per rank | `mochi_cat_reflexes` **Cat Reflexes** ×3: −5% dash cooldown per rank | `mochi_shiny_things` **Shiny Things** ×3: +10% pickup range per rank |
| 3 | `mochi_purr` **Purr** ×3: +4% duration per rank | `mochi_grooming` **Grooming** ×3: +0.1 HP/s regen per rank | `mochi_pounce` **Pounce** ×3: +3% might per rank |
| 4 | `mochi_tangled` **Tangled Up** ×3: yarn hits slow enemies 10 / 20 / 30% for 1 s | `mochi_ninth_life` **Ninth Life** ×3: once per run survive a lethal hit at 1 HP (`plotArmor +1` at rank 1); invulnerable for 1 / 1.5 / 2 s after | `mochi_hunter` **Hunter Instinct** ×3: dashing through enemies deals 20 / 35 / 50 damage to each |
| 5 | `mochi_infinite_yarn` **Infinite Yarn** (WPN): Yarn Orbit never turns off and gains +2 balls | `mochi_cat_army` **Cat Army** (ULT): Nyan Stampede has 90 cats (from 60) and every trampled enemy has a 10% chance to drop a coin | `mochi_catnip` **Catnip Overdrive** (ULT): stampede walls also run top→bottom and bottom→top (2 extra walls) and the stampede magnets every gem in view |

Season 3 balance pass: yarn balls (and Cosmic Yarn's planets) block enemy bullets, break and reform (Orbital Guard,
docs/content/weapons.md §7); Infinite Yarn / C6 keep every ball guarding all the time.

### Kuro — Sealed Right Arm / Chuuni Monologue / Eye of the Abyss

| T | Sealed Right Arm | Chuuni Monologue | Eye of the Abyss |
| --- | --- | --- | --- |
| 1 | `kuro_bandages` **Bandages of Restraint** ×5: +3% area per rank | `kuro_dramatic_pose` **Dramatic Pose** ×5: +4% Overdrive gain per rank (`ultGain`) | `kuro_peeking` **Peeking Under the Patch** ×5: +1% crit chance per rank |
| 2 | `kuro_kindling` **Dark Flame Kindling** ×3: Dark Flame Dragon burn damage +15% per rank | `kuro_edgy_backstory` **Edgy Backstory** ×3: +4% might per rank while the Overdrive meter is ≥ 50% | `kuro_its_throbbing` **"It's Throbbing!"** ×3: +8% crit damage per rank |
| 3 | `kuro_incantation` **Incantation** ×3: +4% duration per rank | `kuro_name_that_attack` **Name That Attack** ×3: +8% ultimate damage per rank (`ultPower`) | `kuro_night_vision` **Night Vision** ×3: +3% might per rank |
| 4 | `kuro_wildfire` **Wildfire** ×3: burning enemies that die spread burn to enemies within 12 / 16 / 20 px | `kuro_lingering_darkness` **Lingering Darkness** ×3: after Eternal Abyss, enemies stay slowed 40% for 2 / 3 / 4 s | `kuro_abyssal_gaze` **Abyssal Gaze** ×3: every 6 / 5 / 4 s the strongest enemy in view is Marked (purple eye icon): the next hit on it is a guaranteed crit |
| 5 | `kuro_seal_broken` **The Seal Is Broken** (WPN): the flames are finally, actually black (`w_abyss_fire` sprite): burn damage ×2 and burning enemies take +15% damage from everything | `kuro_true_forbidden` **TRUE Forbidden Technique** (ULT): the shadow sweeps twice (second pass right → left, +10 ticks) and the reveal shows a stadium floodlight instead of a flashlight | `kuro_eyepatch_off` **Eyepatch: Off** (WPN): Dark Flame Dragon also fires a Crimson Eye Beam at the Marked (or nearest) enemy every 4 s (beam len 120, 8 dmg / 0.1 s for 0.4 s, pierce ∞) |

### Pudding — Tea Service / Customer Service / Head Maid

| T | Tea Service | Customer Service | Head Maid |
| --- | --- | --- | --- |
| 1 | `pudding_perfect_temp` **Perfect Temperature** ×5: +3% might per rank | `pudding_smile` **Service Smile** ×5: +5 max HP per rank | `pudding_tips` **Tips Jar** ×5: +4% coins per rank |
| 2 | `pudding_refill` **Free Refills** ×3: tea puddles and Warm Tea last +0.5 s per rank | `pudding_water` **Complimentary Water** ×3: +5% healing per rank | `pudding_bell` **Lucky Service Bell** ×3: +4% luck per rank |
| 3 | `pudding_bow` **Polite Bow** ×3: −3% cooldown per rank | `pudding_warm_welcome` **Warm Welcome** ×3: +0.1 HP/s regen per rank | `pudding_efficiency` **Rush Hour Efficiency** ×3: +4% move speed per rank |
| 4 | `pudding_extra_cups` **Extra Cups** ×3: Teapot Tempest +1 teacup per rank | `pudding_regulars` **Regulars' Discount** ×3: food heals +10% per rank and has a 10 / 20 / 30% chance to also add 5 Overdrive | `pudding_service` **Service With a Smile** ×3: every 50 / 40 / 30 kills a pudding drops (food, heals 8) |
| 5 | `pudding_tea_ceremony` **Tea Ceremony** (WPN): puddles are twice as big (easier to brush for Warm Tea) and slow enemies 40% | `pudding_moe_max` **Moe Moe Kyun MAX** (ULT): Omurice of Love gets a 4th pulse (`KYUN KYUN♡`) and each pulse grants +1 shield charge (max 3, they last until hit) | `pudding_cup_toss` **Flying Teacup Service** (WPN): every 3 s a teacup is thrown at the farthest enemy in view and shatters (r 24, 40 dmg) leaving a puddle |

Season 3 balance pass: the tea heals **on the move** - brushing any puddle gives Warm Tea (heal over 3 s, refreshed by any
puddle, never stacking; spills land on her path) and the teacups block enemy bullets (Orbital Guard). Free Refills, Tea
Ceremony, Flying Teacup Service and C6 all feed Warm Tea (docs/content/weapons.md §2.2, §7).

### Aoi — Payload / Armor Plating / Thrusters

| T | Payload | Armor Plating | Thrusters |
| --- | --- | --- | --- |
| 1 | `aoi_ammo_racks` **Ammo Racks** ×5: +3% might per rank | `aoi_hull` **Reinforced Hull** ×5: +5 max HP per rank | `aoi_boosters` **Boosters** ×5: +3% move speed per rank |
| 2 | `aoi_magazine` **Extended Magazine** ×3: Micro Missile Swarm +1 missile per rank | `aoi_plating` **Plating** ×3: +2% damage reduction per rank | `aoi_afterburner` **Afterburner** ×3: −5% dash cooldown per rank |
| 3 | `aoi_targeting` **Targeting Computer** ×3: +5% projectile speed per rank | `aoi_shock_absorbers` **Shock Absorbers** ×3: +0.1 HP/s regen per rank | `aoi_hover` **Hover Mode** ×3: +8% pickup range per rank |
| 4 | `aoi_cluster` **Cluster Warheads** ×3: missile blast radius +15% per rank | `aoi_emergency_shield` **Emergency Shield** ×3: +1 shield charge (rank 1); recharge 25 / 20 / 15 s | `aoi_jet_dash` **Jet Dash** ×3: dashes leave a flame trail (10 dmg / 0.25 s, 1 s); rank 2 trail damage +50%; rank 3 +1 dash charge |
| 5 | `aoi_full_burst` **FULL BURST** (WPN): every 5th salvo fires twice the missiles in a figure-eight + "FULL BURST!" banner | `aoi_super_robot` **Super Robot Upgrade** (ULT): GET IN THE ROBOT drops 5 fists and the rocket punch comes back like a boomerang | `aoi_combining` **Combining Sequence** (ULT): after the ult ends, 10 s of Combined Mode: +30% might, +1 amount, +20% move speed |

### Akane — Tsun / Dere / Drill Princess

| T | Tsun | Dere | Drill Princess |
| --- | --- | --- | --- |
| 1 | `akane_wind_up` **Wind-Up** ×5: +3% might per rank | `akane_secretly_caring` **Secretly Caring** ×5: +5 max HP per rank | `akane_rotation` **Rotation** ×5: +1% crit chance per rank |
| 2 | `akane_heavy_paper` **Heavy Paper** ×3: +10% knockback per rank | `akane_not_for_you` **Bento (Not For You)** ×3: food heals +10% per rank | `akane_drill_spin` **Drill Spin** ×3: +8% crit damage per rank |
| 3 | `akane_quick_temper` **Quick Temper** ×3: −3% cooldown per rank | `akane_blush` **Blush** ×3: +0.1 HP/s regen per rank | `akane_ojou_laugh` **Ojou-sama Laugh** ×3: +4% area per rank |
| 4 | `akane_ricochet` **Ricochet Bonk** ×3: knocked enemies that collide with others deal +20% of the hit per rank as collision damage | `akane_not_worried` **"It's Not Like I Was Worried!"** ×3: dropping below 30% HP grants +20 / 35 / 50% might for 6 s (30 s cooldown) | `akane_drill_breaker` **Drill Launcher** ×3: crits have a 20 / 30 / 40% chance to launch a drill (pierce ∞, 30 dmg, 200 px/s) |
| 5 | `akane_ultimate_denial` **Harisen of Ultimate Denial** (WPN): Baka Harisen smacks in 3 directions (forward and ±60°) | `akane_dere_mode` **Dere Mode** (ULT): the barrage ends with a heart explosion (r 120, 300 dmg) and heals 25% max HP | `akane_twin_tail_tornado` **Twin-Tail Tornado** (WPN): every 5th smack is replaced by a drill spin (360°, r 48, 3 hits of 60% damage) |

### Senpai — Charisma / Aloof / Popularity

| T | Charisma | Aloof | Popularity |
| --- | --- | --- | --- |
| 1 | `senpai_sparkle` **Sparkle** ×5: +3% area per rank | `senpai_composure` **Cool Composure** ×5: +5 max HP per rank | `senpai_admirers` **Admirers** ×5: +4% XP per rank |
| 2 | `senpai_magnetic` **Magnetic Personality** ×3: Notice-Me Sparkles charm chance +1.5 points per rank | `senpai_unbothered` **Unbothered** ×3: +2% damage reduction per rank | `senpai_letters` **Love Letters in the Locker** ×3: +4% luck per rank |
| 3 | `senpai_hair_flip` **Hair Flip** ×3: +4% duration per rank | `senpai_personal_space` **Personal Space** ×3: +8% pickup range per rank | `senpai_gifts` **Gifts** ×3: +5% coins per rank |
| 4 | `senpai_fan_club` **Fan Club** ×3: +2 max charmed enemies per rank | `senpai_too_cool` **Too Cool To Get Hit** ×3: contact damage taken −8% per rank and enemies within 20 px are gently pushed away | `senpai_valentines` **Valentine's Day** ×3: every 60 / 50 / 40 s, 12 chocolates fall around you (food, heal 3 each, +1 Overdrive each) |
| 5 | `senpai_love_triangle` **Love Triangle** (WPN): when a charmed enemy kills another enemy, the nearest non-charmed enemy within 48 px of the kill becomes charmed (does not count toward the max; a chain stops 3 links after the original charm) | `senpai_noticed_everyone` **Senpai Noticed Everyone** (ULT): the swoon lasts 7 s and swooned enemies burst into rose petals when it ends (r 24, 100 dmg) | `senpai_glance` **Meaningful Glance** (WPN): every 4 s Senpai glances at a random enemy in view: it is charmed instantly (bosses: stunned 0.5 s) |

### Magical Girl #47 — Henshin / Nobody Remembers Me / Season Regular

| T | Henshin | Nobody Remembers Me | Season Regular |
| --- | --- | --- | --- |
| 1 | `mg47_ribbon_practice` **Ribbon Practice** ×5: +3% might per rank | `mg47_background` **Background Character** ×5: +3% move speed per rank | `mg47_average` **Average Joe** ×5: +1% to every stat per rank (same list as her trait) |
| 2 | `mg47_quick_change` **Quick Change** ×3: Henshin Burst cooldown −4% per rank | `mg47_forgettable` **Forgettable** ×3: +2% damage reduction per rank | `mg47_filler_training` **Filler Training** ×3: +5% XP per rank |
| 3 | `mg47_sparkle_budget` **Sparkle Budget** ×3: +4% area per rank | `mg47_name_tag` **Generic Name Tag** ×3: +6 max HP per rank | `mg47_bgm` **Insert Song** ×3: +5% Overdrive gain per rank |
| 4 | `mg47_panic_plus` **Panic Henshin+** ×3: Panic Henshin triggers from 70 / 60 / 50% charge (base 80%) | `mg47_who_are_you` **"Who Are You Again?"** ×3: after 10 / 8 / 6 s without taking damage, gain a shield charge (max 1) | `mg47_recurring` **Recurring Character** ×3: each boss killed this run gives +3 / 4 / 5% to every stat |
| 5 | `mg47_double_henshin` **Double Henshin** (WPN): every Henshin Burst repeats 0.5 s later at 50% damage with mirrored ribbons | `mg47_special_episode` **Episode 47 (Special)** (ULT): after the transformation, 6 s of +40% might and +20% move speed | `mg47_has_a_name` **Finally Has a Name!** (ULT): the cut-in subtitle shows "It's... Mahou— wait—" and the ult takes 4 s instead of 6 (stages at 0.6 s steps) with +50% damage |

### Isekai-kun — Cheat Magic / Party Members / Reincarnation Perks

| T | Cheat Magic | Party Members | Reincarnation Perks |
| --- | --- | --- | --- |
| 1 | `isekai_mana_overflow` **Mana Overflow** ×5: +3% might per rank | `isekai_companions` **Loyal Companions** ×5: +5 max HP per rank | `isekai_skill_points` **Skill Points** ×5: +4% XP per rank |
| 2 | `isekai_lv9999` **"Lv.9999"** ×3: Cheat Fireball blast radius +8% per rank | `isekai_party_healer` **Party Healer** ×3: +0.1 HP/s regen per rank | `isekai_item_box` **Item Box** ×3: +8% pickup range per rank |
| 3 | `isekai_chant_skip` **Chant Skip** ×3: −3% cooldown per rank | `isekai_party_tank` **Party Tank** ×3: +2% damage reduction per rank | `isekai_appraisal` **Appraisal** ×3: +4% luck per rank |
| 4 | `isekai_overdone` **Overdone** ×3: rank 1 overdo every 4th cast (base 5th); rank 2 overdo blasts +20% radius; rank 3 every 3rd cast | `isekai_guild_support` **Guild Support** ×3: every 20 s an arrow volley from off-screen hits 6 / 8 / 10 random enemies in view (40 dmg each) | `isekai_starter_village` **Starter Village Bonus** ×3: start the run +1 level per rank (on top of the trait's Lv 3) |
| 5 | `isekai_overdid_again` **"Did I Overdo It AGAIN?"** (WPN): every overdone fireball bursts into 6 regular fireballs on detonation | `isekai_status_expanded` **Status Screen: Expanded** (ULT): 5 slams (top, bottom, middle, top half, bottom half) and the fake numbers read `99999999999` | `isekai_second_cheat` **Second Cheat Skill** (WPN): the run also starts with a random unlocked non-signature weapon at Lv1 |

### Truck-kun — Engine / Chassis / Reincarnation Services

| T | Engine | Chassis | Reincarnation Services |
| --- | --- | --- | --- |
| 1 | `truck_horsepower` **Horsepower** ×5: +3% might per rank | `truck_steel_frame` **Steel Frame** ×5: +8 max HP per rank | `truck_delivery_bonus` **Delivery Bonus** ×5: +4% coins per rank |
| 2 | `truck_air_horn` **Air Horn** ×3: honk cone length +8% per rank | `truck_airbags` **Airbags** ×3: +1 shield charge (rank 1); recharge 30 / 24 / 18 s | `truck_express` **Express Shipping** ×3: +5% XP per rank |
| 3 | `truck_turbo` **Turbo** ×3: +3% move speed per rank | `truck_crumple_zone` **Crumple Zone** ×3: +2% damage reduction per rank | `truck_insurance` **Insurance** ×3: +4% luck per rank |
| 4 | `truck_bull_bar` **Bull Bar** ×3: ram damage +20% per rank; rammed enemies stunned 0.2 / 0.3 / 0.4 s | `truck_roadside` **Roadside Assistance** ×3: +0.2 HP/s regen per rank | `truck_next_life` **Next-Life Guarantee** ×3: isekai'd enemies drop an extra gem with +15 / 25 / 35% chance |
| 5 | `truck_eighteen_wheeler` **Eighteen Wheeler** (WPN): the horn also honks backward (70% damage) and the ram hitbox is 50% larger | `truck_unlimited_mileage` **Unlimited Mileage** (ULT): ISEKAI EXPRESS drives 6 lanes (two more random lanes at 3.2 / 3.6 s, duration 4.6 s) and each isekai'd enemy gives +1 Overdrive | `truck_loyalty` **Afterlife Customer Loyalty** (ULT): the express lane drops off 3 tiny Truck-kuns (`en_mini_truck` sprite, friendly tint) that patrol for 10 s ramming enemies (60 dmg, 0.5 s per-enemy cooldown) |

---

## 4. Constellations C1-C6 (all 11)

Each gacha dupe of a hero adds one star (`HeroDef.constellations`, index 0 = C1).
The six star names are shared so players learn the ladder; the effects are per
hero. C2 always gives the start weapon at Lv2 (the run starts with it at Lv2;
it is then one level-up closer to evolving).

| Star | Shared name | Subtitle on the star-up card |
| --- | --- | --- |
| C1 | **Recolour Edition** | "Same character, new hair colour. That'll be one dupe, please." |
| C2 | **Rerun Banner Edition** | "Back by popular demand (the demand was the algorithm)." |
| C3 | **Summer Variant (Sun Hat Included)** | "Sun hat. SPF 50. Otherwise the exact same outfit." |
| C4 | **Unlicensed Collab Outfit** | "The collab partner has asked us to stop." |
| C5 | **Super-Deformed Plushie Form** | "Now available as a plushie. The plushie is stronger." |
| C6 | **Fully Awakened (Final Form)** | "Fully awakened. Until next season's final form." |

| Hero | C1 | C2 | C3 | C4 | C5 | C6 |
| --- | --- | --- | --- | --- | --- | --- |
| Hoshi | +6% might | Star Shot starts at Lv2 | Trait becomes +20% projectile speed, −8% cooldown | Supernova Shower +10 meteors | +3% crit, +10% crit damage | Star Shot stars split into 2 half-damage stars on kill; Overdrive starts at 60% |
| Rin | +15 max HP | Petal Slash starts at Lv2 | Trait becomes +35 max HP, +15% damage | Thousand Blossom Cut +4 slash lines and +20% damage | +5% crit | Petal Slash always crits enemies above 80% HP ("first cut") |
| Mochi | +6% move speed | Yarn Orbit starts at Lv2 | Trait becomes +20% move, +30% pickup, 2 armor | Nyan Stampede +20 cats | +1 dash charge | Yarn balls never turn off and pull gems like Cosmic Yarn |
| Kuro | +6% area | Dark Flame Dragon starts at Lv2 | Trait loses its −10 HP ("the seal holds") and gives +20% area | Eternal Abyss +3 ticks | +10% crit damage | A second salamander (Ragnarok II, "the sequel") joins with its own breath |
| Pudding | +10 max HP | Teapot Tempest starts at Lv2 | Trait becomes +0.5 HP/s, +25% healing, +10% luck | Omurice of Love +1 pulse | +8% luck, +8% coins | Warm Tea heals twice as fast; every 100 kills drops a pudding (heal 8) |
| Aoi | +1 armor | Micro Missile Swarm starts at Lv2 | Trait move penalty becomes −5% | GET IN THE ROBOT +1 fist | +10% projectile speed | A support drone orbits Aoi and fires 3 micro missiles every 2 s (Aoi's missile stats, 60% damage) |
| Akane | +5% might | Baka Harisen starts at Lv2 | Trait becomes +15% damage, +50% knockback, +8% crit | Barrage +12 smacks | +10% crit damage | Every BAKA! pop stuns enemies within 40 px for 1 s (the shout itself hurts) |
| Senpai | +8% luck | Notice-Me Sparkles starts at Lv2 | Trait slow aura becomes 20% within 56 px | Swoon lasts +2 s | +6% XP, +6% coins | Charmed enemies drop double XP when they die |
| Magical Girl #47 | +3% to every stat | Henshin Burst starts at Lv2 | Trait becomes +8% to everything | Transformation stages +30% damage | +10 max HP, +5% move speed | Henshin Burst also triggers on every level-up |
| Isekai-kun | +5% XP | Cheat Fireball starts at Lv2 | Trait starts the run at Lv 5 | Status Screen +1 slam | +5% might | +1 card on every level-up ("he didn't even notice") |
| Truck-kun | +20 max HP | Horn of Reincarnation starts at Lv2 | Trait becomes 5 armor and −5% move speed | Isekai Express +1 lane | +10% might | Now With Trailer: a trailer (`truck_kun_trailer`) follows 18 px behind on a rope-follow path and rams like the cab (its own 0.4 s per-enemy cooldown) |

---

## 5. OC bios (all 11)

Shown in the Heroes tab and the codex in a fake profile card: pink gradient
header, glitter divider, a "♡ Favourite" counter that only goes up by one when
the player taps it. The kaomoji render in the system fallback font on purpose
(it looks pasted in). Keep the typos marked [sic] - they are intentional; do
not "fix" them.

### Hoshi
```
~*~☆ HOSHI ☆~*~  ~ my FIRST oc!!! ~
Full name: Hoshi Kirameki (Kirameki means sparkle!! i looked it up)
Age: 14
Height: 148 cm (163 cm with hair) (171 cm with hair AND star clips)
Likes: stars, strawberry milk, shouting the name of her attacks, pink, MORE pink
Dislikes: cloudy nights, people who say pink and magenta are the same colour, homework
Power level: ★★★★★★★★☆☆ (8/10) (10/10 after strawberry milk)
Theme song: "Starlight☆Overdrive (Nightcore Remix) (Sped Up)"
Personality: SUPER genki!!! but she also has a dark side (once stayed up until 10:30pm)
Fun fact: her wand is made from a real star (it is not)
DO NOT STEAL!! DO NOT REPOST!! Hoshi is MY OC!!! fanart ok if u credit me (◕‿◕✿)
```

### Rin
```
~*~ RIN ~*~  [ shrine maiden ] [ swordswoman ] [ cool ]
Full name: Rin Kagura
Age: 16
Height: 158 cm (171 cm with ponytail)
Likes: green tea, a sharp blade, a sharp cup of tea, silence, more silence
Dislikes: being called "Rin-chan", dull swords, small talk, LOUD people (Hoshi)
Power level: "Sufficient."
Theme song: "Crimson Blossom Requiem (8-bit Cover) (Extended Mix) (Final) (Final2)"
Personality: cool and mysterious (she practises in the mirror)
Fun fact: her katana has a name but she will not tell you. It's "Katana-chan."
DO NOT STEAL!!! i will know. Rin will know. ⚔(｀・ω・´)
```

### Mochi
```
~*~=^.^= MOCHI =^.^=~*~
Full name: Mochi (just Mochi) (she is a cat girl she doesn't need a last name)
Age: 13
Height: 139 cm (151 cm with ears)
Likes: naps, boxes, yarn, knocking things off tables while making eye contact
Dislikes: baths, cucumbers (startling), the vacuum, closed doors, open doors
Power level: nya/10
Theme song: "Nyan Nyan Daydream (1 Hour Loop) (Purring Edition)"
Personality: sleepy → ZOOMIES → sleepy (repeat)
Fun fact: has been in exactly one fight with a laser pointer. she lost.
DO NOT STEAL!! mochi is MY oc and also my cat's name (the cat did not consent) (=^･ω･^=)
```

### Kuro
```
~*~†† KURO ††~*~  "Lord of the Abyssal Flame" (true name: CLASSIFIED) (it's Kuroda Haruki)
Age: 14
Height: 152 cm (164 cm with hair) (159 cm with cape collar) (sealed form)
Likes: the darkness, black coffee (6 sugars), bandages, his dragon Ragnarok, Scourge of the Seventh Abyss
Dislikes: the sun, his sealed arm acting up during P.E., his mum calling him "Haru-kun" in public
Power level: UNMEASURABLE (the school nurse's scale broke) (it was already broken)
Theme song: "Requiem of the Abyssal Flame ~Eternal Darkness Ver.~ (piano cover by me)"
Personality: dark. mysterious. edgy. secretly volunteers at the animal shelter every Sunday
Fun fact: the dragon is a salamander. the flames are orange. do NOT tell him.
DO NOT STEAL!!! stealing my OC will awaken the seal. you have been WARNED. ( ` ω ´ )
```

### Pudding
```
~*~♡ PUDDING ♡~*~  ~Head Maid of Café Purin Purin~ (not a real café) (yet)
Age: 19
Height: 155 cm (168 cm with buns and headdress)
Likes: caramel, a perfectly wobbly custard, saying "Welcome home!", polishing spoons until she can see her future
Dislikes: dropped trays, customers who don't say "moe moe kyun" back, the dishwasher (it knows what it did)
Power level: Customer satisfaction 100% (one review said 99%. she remembers.)
Theme song: "Welcome Home, Master~♡ (Café BGM Vol. 3) (Extended Lunch Rush Ver.)"
Personality: sweet, patient, terrifyingly efficient
Fun fact: has served omurice to a boss mid-fight. it left a 5-star review.
DO NOT STEAL!! pudding belongs to me and Café Purin Purin ☆ please tip ur maids (*´▽`*)
```

### Aoi
```
~*~ AOI ~*~  PILOT CALLSIGN: "BLUEBERRY" (she did not choose it)
Age: 12
Height: 131 cm (136 cm with hair) (219 cm in the mech) (the mech counts)
Likes: giant robots, screwdrivers, juice boxes, shouting the name of every mech part
Dislikes: being told she's too young to pilot (she has a LICENSE) (since Tuesday), stairs (the mech can't)
Power level: 1 (ONE) GIANT FIST
Theme song: "Hot-Blooded Engine ☆ GO! GO! GO! (Instrumental) (Remastered 2009)"
Personality: loud. louder in the mech. the mech has a speaker.
Fun fact: the mech is called "Unit-Aoi Mk. II". Mk. I was a cardboard box. she misses it.
DO NOT STEAL!!! the mech design is 100% ORIGINAL i drew it myself (it's a trash can with legs) (ง •̀_•́)ง
```

### Akane
```
~*~ AKANE ~*~  (the drills are NATURAL)
Full name: Akane Tenjouin (of the Tenjouin family) (you've heard of them) (you haven't)
Age: 16
Height: 154 cm (182 cm with drills) (drills sold seperately [sic])
Likes: tea parties, winning, her drills, NOT you, definitely not you
Dislikes: losing, people touching the drills, admitting things, the word "cute"
Power level: obviously higher than YOURS
Theme song: "It's Not Like This Is My Theme Song or Anything!! (Orchestral Ver.)"
Personality: tsundere (she says she isn't) (she is)
Fun fact: the harisen was a birthday gift. she pretends she bought it herself.
DO NOT STEAL!!! n-not that anyone would WANT to steal her or anything... b-baka!! (｀へ´)
```

### Senpai
```
~*~✧ SENPAI ✧~*~  [LIMITED SSR] (real name: unknown) (nobody has ever asked)
Age: 18
Height: 178 cm (183 cm with hair) (sparkles not included in the measurement)
Likes: windy rooftops, roses, gazing meaningfully into the middle distance
Dislikes: noticing things, wilted roses, the camera catching him before the dramatic angle
Power level: ✧✧✧✧✧ (5 sparkles) (sparkles are the unit)
Theme song: "Petals on the Wind ~Rooftop Ver.~ (Slowed + Reverb) (10 Hours)"
Personality: aloof. elegant. has never once looked directly at anyone.
Fun fact: the wind follows him indoors. nobody knows where it comes from.
DO NOT STEAL!!! senpai is LIMITED do not repost without credit (ﾉ´ヮ`)ﾉ*: ･ﾟ✧
```

### Magical Girl #47
```
~*~ Magical Girl #47 ~*~  (name pending) (name was also pending last season)
Age: 15
Height: 150 cm (152 cm with hair) (it's very sensible hair)
Likes: helping!!, plain rice, being included, the colour mint (NOT pink, that's the other one)
Dislikes: roll call, name tags falling off, being called "uh, you there"
Power level: average (perfectly) (+5% to all)
Theme song: "Magical ☆ Something ☆ Song (Opening Theme #47) (TV Size)"
Personality: kind, hardworking, slightly see-through in group shots
Fun fact: her catchphrase is "...". she's still workshopping it.
DO NOT STEAL!! please. please someone NOTICE her first. then don't steal. (・_・;)
```

### Isekai-kun
```
~*~ Isekai-kun ~*~  (Reincarnated Lv.1 → Lv.9999 in 3 days) (he didn't even try)
Age: 17 (also 17 in his previous life, he checked)
Height: 170 cm (170 cm with hair) (his hair has no volume)
Likes: nothing in particular, plain bread, being surprised by his own power
Dislikes: nothing in particular, attention (he says, while receiving all of it)
Power level: "Huh? Is 9,999,999 a lot?"
Theme song: "Ordinary Days in Another World (Chill Mix) (Extended) (He Overdid the Mix)"
Personality: ordinary. very ordinary. painfully, cosmically ordinary.
Fun fact: died once. would not recommend. would recommend the truck.
DO NOT STEAL!!! he's very relatable and that makes him MINE ( ˘・з・)
```

### Truck-kun
```
~*~ TRUCK-KUN ~*~  (registered as: Light-Duty Cab-Over Delivery Truck)
Age: Model Year 2009
Height: 2.1 m (2.1 m with hair) (it has no hair)
Likes: honking, the open road, green lights, sending people to better places
Dislikes: speed bumps, parking tickets, being blamed (it was ALWAYS just doing its job)
Power level: 4.5 tonnes
Theme song: "Express Lane to Another World (Honk Remix) (Hazard Lights Ver.)"
Personality: HONK
Fun fact: has a 100% customer satisfaction rate. none of the customers came back to complain.
DO NOT STEAL!!!! (it's a truck. you can't. it's 4.5 tonnes. it has an alarm.) ┌(ﾟдﾟ)┘ HONK
```
