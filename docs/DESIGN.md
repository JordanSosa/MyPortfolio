# KIRA☆KIRA OVERDRIVE — Design & Technical Spec

A cute, chaotic, anime pixel-art **survivors-like** (auto-attacking horde
survival). You play a magical girl defending Dreamland from a stampede of
Nightmare Plushies until dawn. Everything is generated at runtime: pixel art is
authored as palette grids in TypeScript, audio is synthesised with WebAudio,
effects are WebGL2 shaders. No binary assets.

Runs in any modern browser; **mobile (touch, portrait and landscape) is a
first-class target**, desktop (keyboard/gamepad) equally supported.

---

## 1. Pillars

1. **Instant power fantasy.** First level-up inside 8 seconds. A screen full of
   enemies melting under your build by minute 3.
2. **Over-the-top juice on everything.** Every hit flashes, squashes, pops a
   number. Every death bursts into confetti. Every level-up is a fireworks
   show. Bosses get cinematic intros. Ultimates get anime cut-ins.
3. **Fast loop.** 10-minute runs, dash with a short cooldown, combo ranks that
   reward never stopping, Overdrive ultimate roughly every 45-60 s.
4. **Kawaii-but-crunchy.** Pastel dream palette, coloured outlines, big shiny
   anime eyes — rendered as true low-res pixels with modern glow and
   distortion layered on top.
5. **Readable chaos.** Enemy bullets are always bright, glowing, high-contrast
   and drawn above everything else; telegraphs are shape + colour.

---

## 2. Core loop & numbers

Coordinates are **art pixels** (1 unit = 1 sprite pixel). Time in seconds.

| Thing | Value |
| --- | --- |
| Run length | Final boss appears 9:00; killing it = victory ("DAWN BREAKS!"). If alive at 10:30 it enrages. |
| Player HP | 100 (Rin 120) |
| Player speed | 72 px/s (Mochi +15%) |
| Hurt i-frames | 0.4 s (player blinks) |
| Dash | 0.16 s at 300 px/s (~48 px), invulnerable during dash + 0.1 s, cooldown 1.2 s |
| Pickup radius | 24 px; gems inside accelerate to the player (start 60 px/s, +600 px/s²) |
| Crit | base 5 %, ×2 damage |
| XP to next level | `5 + (L-1)*8 + max(0, L-20)*6` (level 1→2 needs 5) |
| Gems | gem_1 = 1 xp, gem_2 = 5, gem_3 = 25, gem_4 = merged (sum). If > 250 gems exist, merge the farthest into one gem_4 |
| Weapon slots | 6 weapons, 6 passives; each item has 5 levels |
| Reroll | 2 per run (+ meta) |

### 2.1 Combo & rank
Every kill extends a 2.5 s combo timer. Ranks by combo count:
`C 10 · B 30 · A 60 · S 100 · SS 200 · SSS 400`. XP multiplier
`1.1 / 1.2 / 1.3 / 1.5 / 1.75 / 2.0`. Rank-up = stamp animation + `rankUp`
sfx. Combo break (timer expires) = `comboBreak` sfx, counter shatters.

### 2.2 Overdrive (ultimate)
Meter 0-100: +1 per kill, +8 elite, +30 boss, +0.5/s passive. When full the
ULT button pulses rainbow (`ultReady`). Cast = 1.1 s anime cut-in (sim paused,
FX keep animating) then the hero's ultimate (3-4 s, player invulnerable).

### 2.3 Level-up flow
Hitstop 100 ms → light pillar + ray burst + "LEVEL UP!" text → time eases to
0.2× over 0.3 s → modal with **3 cards** (4 with Luck meta). Cards fly in
staggered with a flip; rarity frame: common (white), rare (blue), epic
(violet), **evolution (animated rainbow)**. Multiple pending level-ups queue.
**Mobile safety:** ignore card taps for the first 350 ms and require a *fresh*
touch (a finger still held from the joystick must not select a card). If
everything is maxed, offer "Heal 30 HP" / "+50 coins".

### 2.4 Chests
Elites drop a chest; bosses drop a golden chest. Opening: chest shakes,
light beams leak, lid bursts, a slot-reel of item icons spins and lands on 1
upgrade (golden chest: 3; 5 % chance of a 5-upgrade "JACKPOT"). Chests
prioritise evolutions when eligible.

---

## 3. Content

### 3.1 Heroes

| Hero | Look | Start weapon | Trait | Ultimate |
| --- | --- | --- | --- | --- |
| **Hoshi** (star magician) | pink twin-tails, star clips, cyan eyes, white/pink magical-girl dress, star wand | Star Shot | +10 % projectile speed, −5 % cooldown | **Supernova Shower** — 30 meteors rain across the view over 3 s, each exploding (radius 32) |
| **Rin** (shrine swordswoman) | black ponytail with red ribbon, red eyes, white haori + red hakama, katana | Petal Slash | +20 HP, +10 % damage | **Thousand Blossom Cut** — world freezes, 12 slash lines carve the screen, then every on-screen enemy is hit for massive damage in a petal explosion |
| **Mochi** (neko-girl) | cream bob + cat ears, golden cat eyes, oversized lavender paw hoodie, tail | Yarn Orbit | +15 % move speed, +20 % pickup radius | **Nyan Stampede** — 40 cats gallop across the screen in waves, trampling (damage + big knockback) |

### 3.2 Weapons (5 levels each) and evolutions
Base stats are multiplied by passives (Might, Area, Cooldown, Amount...).

| Weapon | Behaviour | Base | Evolution (needs Lv5 + passive) |
| --- | --- | --- | --- |
| **Star Shot** | Homing stars at nearest enemies | dmg 10, cd 0.9, amt 1, spd 160, pierce 1 | **Galaxy Barrage** (+Wish Charm): rotating spiral stream of homing stars, cd 0.12 |
| **Petal Slash** | Arc slash in facing dir (Lv2 also behind) | dmg 16, cd 1.1, area 48×32 | **Sakura Tempest** (+Big Ribbon): 360° whirlwind every 0.8 s + petal projectiles |
| **Yarn Orbit** | Balls orbit the player (r 28), 3 s on / 1.5 s off | dmg 8, per-enemy hit cd 0.4 | **Cosmic Yarn** (+Magnet Star): 6 planets, permanent, also pull gems |
| **Heart Boomerang** | Thrown at nearest, flies 90 px and returns, pierces | dmg 12, cd 1.4 | **Love Tornado** (+Twin Charm): hearts spiral outward in a tornado |
| **Thunder Bell** | Lightning strikes random on-screen enemies, chains (60 %) | dmg 20, cd 1.6, strikes 2, chain 2 | **Raijin Drum** (+Power Bow): 8 huge bolts with AoE blasts + screen flash |
| **Candy Bomb** | Lobs bombs (0.6 s arc) at enemies, AoE r 28 | dmg 25, cd 2.0 | **Sugar Nuke** (+Lucky Clover): giant bomb r 80 + 6 cluster bomblets |
| **Bubble Aura** | Damaging aura r 30, ticks 0.5 s, slows 30 % | dmg 5 | **Ocean Dome** (+Heart Locket): huge dome, heals 1 HP per 10 kills inside, bubbles burst outward |
| **Prism Beam** | 0.5 s piercing beam (len 140) toward nearest, ticks 0.1 s | dmg 6/tick, cd 2.2 | **Rainbow Cannon** (+Swift Shoes): 3 beams sweeping 360° |

### 3.3 Passives (5 levels)
Power Bow +10 % dmg · Wish Charm −8 % cooldown · Big Ribbon +10 % area ·
Twin Charm +1 projectile at Lv1/3/5 · Swift Shoes +10 % move, −5 % dash cd ·
Magnet Star +30 % pickup radius · Lucky Clover +4 % crit, +10 % luck ·
Heart Locket +20 max HP, +0.2 HP/s regen.

### 3.4 Enemies
HP scales `× (1 + minutes × 0.18)`. All have a shadow, a hit flash and a
death burst in their own colours.

| Enemy | HP | Speed | Dmg | Behaviour |
| --- | --- | --- | --- | --- |
| Puff (slime) | 8 | 32 | 6 | Hop-chase (speed pulses with the hop frames) |
| Batbun | 5 | 55 | 4 | Weaving chase; swarm events fly straight lines |
| Boo (ghost) | 14 | 38 | 7 | Sine-wave approach, alpha flickers |
| Shroomie | 30 | 22 | 9 | Waddle; splits into 2 Spores (hp 4, spd 50) on death |
| Teddy Brute | 90 | 24 | 14 | Tank, knockback resist 70 % |
| Eyepuff | 20 | 30 | 8 | Keeps ~90 px away, telegraphs 0.4 s then shoots an `eb_orb` (70 px/s) |
| Pumpkin Dasher | 40 | 30 | 12 | Every 3 s: 0.5 s telegraph (shake, red flash, aim line) then 180 px/s dash for 0.5 s |
| Candle Wisp | 6 | 70 | 10 | Kamikaze; explodes (r 16) on contact or death |
| **Elite** (any) | ×10 | ×0.9 | ×1.5 | ×1.5 scale, pulsing rainbow outline glow; drops chest + coin shower |

### 3.5 Bosses
Intro: 3 s red WARNING banner + siren → boss enters with name card ("KING
PUFF — Ruler of the Squish Kingdom"), slight zoom-out, boss music. Boss HP bar
at the top. Death: 1.2 s slow-mo at 0.25×, chained explosions, white flash,
golden chest with a light beam.

| Boss | Time | HP | Patterns |
| --- | --- | --- | --- |
| **King Puff** | 3:00 | 1500 | Hop ×3 toward player → big jump (landing circle telegraph 1 s) → slam: ring of 16 `eb_orb` + shockwave; summons 6 Puffs |
| **Nightmare Teddy** | 6:00 | 5000 | Telegraphed charge ×3 (aim line), spinning claw sweep, `eb_star` spiral rings, summons Teddies |
| **Lady Lunatic** | 9:00 | 14000 | P1 moon spirals (`eb_moon`) + teleport · P2 (<60 %) orbiting moons + fan shots · P3 (<25 %) screen dims, huge radial patterns |

### 3.6 Director timeline
Enemies spawn just outside the view. Max-alive cap is also limited by the
device quality tier (low 150 / mid 250 / high 350).

| Time | Mix | Spawn/s | Max | Events |
| --- | --- | --- | --- | --- |
| 0:00-1:00 | Puff, Batbun | 1.5 → 3 | 60 | |
| 1:00-2:00 | + Boo | 3 → 4 | 100 | 1:45 bat swarm line |
| 2:00-3:00 | + Shroomie, Eyepuff | 4 → 5 | 140 | 2:30 elite |
| 3:00 | **King Puff** (spawns ×0.4 while alive) | | | |
| 3:30-5:00 | + Pumpkin, Teddy | 5 → 6 | 180 | 4:00 encircle ring, 4:30 elite |
| 5:00-6:00 | + Wisp | 6 → 7 | 220 | 5:30 Puff flood stream |
| 6:00 | **Nightmare Teddy** | | | |
| 6:30-9:00 | everything | 8 → 10 | 300 | elites every 45 s, 7:00 ring, 7:30 bat storm, 8:15 wisp rush |
| 9:00 | **Lady Lunatic** (spawns ×0.5) | | | |

### 3.7 Pickups & props
Destructible lanterns/gift boxes spawn near (off-screen) every ~20 s and drop
food (onigiri +20 HP, cake +50 HP), coins, and rarely magnet (pulls all
gems), bomb (damages everything on screen) or clock (freezes enemies 5 s).
Enemies drop coins 2 % of the time; elites drop a coin shower.

### 3.8 Meta progression (Dream Shop, persisted)
Coins buy permanent ranks: Might (+5 % dmg), Vitality (+10 HP), Swiftness
(+4 % speed), Magnetism (+10 % radius), Greed (+10 % coins), Luck (+5 %),
Reroll (+1), Revive (1 max, revive at 50 % HP with a screen-clearing burst).
Cost grows ~1.6× per rank.

---

## 4. Juice catalogue (non-negotiable minimums)

| Event | Effects |
| --- | --- |
| Enemy hit | White flash (shader) 0.08 s · squash 1.25/0.8 springing back over 0.12 s · knockback · damage number pops (scale 1.6→1 bounce, rises, fades 0.6 s; crit = yellow, ×2 size, wobble, sparkle) · weapon-tinted `fx_hit` · `hit` sfx (rate-limited, ±2 st random) |
| Enemy death | Pop (scale 1.3 + flash) → 8-14 confetti particles in the enemy's colours + white sparkles · `fx_puff` · expanding `fx_ring` · gem hops out in a little arc |
| Elite death | + shockwave distortion · 30 particles · coin shower · hitstop 60 ms · `eliteDie` |
| Player hurt | Red vignette flash · shake 0.35 · chromatic aberration pulse · hitstop 50 ms · blinking i-frames · red number · haptic 30 ms. HP < 30 %: heartbeat vignette pulse |
| Gem pickup | Gem streaks in with a stretched trail · sparkle on collect · `gem` sfx pitch climbs per chained pickup (resets after 0.6 s) · XP bar shimmer |
| Level up | See §2.3: hitstop, 24-ray burst, light pillar, 2 rings, golden flash, bouncing "LEVEL UP!", confetti |
| Evolution | Rainbow flash, hue-cycling grade for 0.6 s, "EVOLUTION!" banner, hero cast pose |
| Explosion | `fx_explosion` scaled to radius · additive glow flash · shockwave distortion · shake 0.2-0.5 · debris · scorch decal fading over 6 s |
| Lightning | Jagged polyline (midpoint displacement) with white core + cyan glow, flickers 0.12 s · impact flash · `w_bell` marker |
| Dash | 5 fading afterimages (cyan/pink) · dust puffs · speed streaks · zoom punch |
| Ultimate | Screen darkens, radial speed lines, portrait (f1) slides in on a diagonal band, huge outlined title text shakes in, voice blips, then flash + effect + max shake + bloom surge |
| Boss warning | Red pulsing border, hazard-stripe WARNING banner scrolling, siren |
| Combo | Bouncing counter; rank letter stamps in rotated with a shine; SSS = rainbow text + glowing screen border |
| Ambient | Screen-space petals & sparkle motes · deco sways · day → dusk → night colour grade across the run · fireflies at night |

Global helpers: **hitstop(ms)**, **slowmo(scale, seconds)**, **shake(trauma)**
(trauma²-scaled smooth noise, decays), **zoomPunch(amount)**,
**flash(color, amount)**, **shockwave(x, y, strength)**, **aberration(amount)**.
Settings can scale shake and flashing ("Reduce flashing" accessibility option).

---

## 5. Art direction

- **Resolution:** heroes 24×24, small enemies 16×16, Teddy 24×24, bosses
  48-64 px, projectiles 8-16, pickups 7-12, tiles 16×16, icons 16×16,
  portraits 64×64. Exact ids/sizes: `src/art/manifest.ts`.
- **Palette:** `src/art/palette.ts` only (local `pal` overrides allowed for
  semi-transparent pixels or special glows). Outline `1` (dark plum), never
  black. Hue-shifted ramps: shadows purple/blue, highlights warm.
- **Chibi anime proportions:** head ≈ 55 % of character height. Eyes are the
  focus: 2-3 px wide, dark upper lid line, coloured iris, one white highlight
  pixel; blush `b` under the eyes. Expressive faces on enemies too (dot eyes,
  `:3` mouths, blush).
- **Silhouettes first:** every sprite must read at 1× scale on the green
  meadow. Enemies differ in silhouette, not just colour.
- **Animation:** idle 4 frames (breathing bob + hair/ribbon sway + a blink),
  run 6 frames (bouncy; hair/accessories trail), enemies 4-frame loops with
  squash/stretch. Code adds procedural squash, flip, bob and rotation on top.
- **Lighting:** light from top-left. Glowing things (gems, projectiles,
  bullets, crystals) have a bright core and are drawn on the glow layer.
- **World:** a dreamy pastel meadow — soft green grass, flowers, cotton-candy
  trees, glowing crystals. The colour grade shifts day → dusk → violet night.

Authoring tools: `npm run sprites -- --filter hoshi --scale 6 --out shots/hoshi.png`
renders a contact sheet you can open/view, and prints validation errors.
Helpers in `src/art/format.ts`: `hflip`, `recolor`, `shift`, `overlay`,
`spliceRows`, `fill`.

---

## 6. Audio direction

Chiptune-meets-J-pop: square/pulse leads with vibrato, triangle/sine bass,
noise drums, bright arpeggios, FM bells, with a light convolution/feedback-delay
reverb and a master compressor/limiter so dense combat never clips. SFX are
short, punchy, pitched; rate-limited and voice-capped (≤ 24 voices). Music is
sequenced at runtime with a lookahead scheduler; battle music has
intensity layers (0 = bass+pads, 0.5 = +drums, 1 = +lead+arps) driven by
enemy density/combo. Boss and final-boss themes are distinct. Level-up/pause
muffles music with a low-pass. API: `src/audio/api.ts`.

---

## 7. UI / UX

- **Fonts:** `Pixelify Sans` (display/headers/body) and `Silkscreen` (small
  caps labels, numbers) via `@fontsource`. In-world text uses the bitmap
  `font_main` from the atlas.
- **DOM overlay** for HUD and menus (crisp text, CSS animations), canvas for
  the world. Use CSS custom properties built from the palette. Use
  `image-rendering: pixelated` for any sprite shown in the DOM (icons and
  portraits are converted from the atlas to data URLs).
- **HUD (portrait phone):** full-width XP bar at the very top with a level
  badge, big timer under it, kills + coins top-right, owned weapon/passive
  icons in a compact row under the XP bar, combo counter mid-right, boss HP
  bar under the timer when active, HP bar drawn under the hero in-world,
  pause button top corner. Bottom: floating joystick zone, DASH button
  bottom-right, OVERDRIVE button above it with a circular fill meter.
  Everything respects `env(safe-area-inset-*)`.
- **Controls:** WASD/arrows move · Space/Shift dash · E/Enter ultimate ·
  Esc/P pause · gamepad left stick, A dash, B/RT ultimate, Start pause.
  Touch: floating joystick (touch-down anywhere not on a button sets the
  origin; knob radius 48 CSS px; analogue with 0.15 deadzone; hidden when
  idle). Multi-touch: joystick + buttons simultaneously.
- **Screens:** splash ("tap to start" — unlocks audio) → title (animated logo
  with shine sweep + bouncing letters, live autoplay attract-mode game behind
  a dim overlay; PLAY / DREAM SHOP / SETTINGS) → character select (portrait
  cards, trait, start weapon, ultimate, idle animation; GO!) → game ↔
  level-up / chest / pause → game over ("DREAM OVER…", revive if owned) or
  victory ("DAWN BREAKS!" fireworks) → results (time, level, kills, max combo,
  coins, per-weapon damage bars, grade, NEW BEST badges; RETRY / TITLE).
  Settings: master/music/sfx volume, screen shake 0/50/100 %, reduce
  flashing, damage numbers, quality auto/low/high, haptics, show FPS.
- Pause automatically on `visibilitychange`/`blur`. Prevent scroll, pinch-zoom,
  double-tap zoom, text selection, long-press menus, pull-to-refresh.
- PWA: manifest + icons, `apple-mobile-web-app-capable`, theme colour, so
  "Add to Home Screen" launches full-screen.

---

## 8. Technical architecture

TypeScript (strict) + Vite. No engine/framework — custom WebGL2 renderer,
vanilla DOM UI.

```
src/
  main.ts            boot: fonts, renderer, atlas, input, audio unlock, app state machine, main loop
  core/              math, rng (seeded), events (typed bus), pool, spatial hash, time (hitstop/slowmo), input, storage
  render/            gl helpers, atlas builder, sprite batcher, post-processing, camera, bitmap text
  art/               palette.ts, format.ts, manifest.ts (contracts) + sprites/*.ts (data, auto-registered)
  game/              PURE simulation: world, player, enemies, bosses, director, weapons, passives, upgrades,
                     pickups, combat, combo, overdrive. NO DOM / WebGL / audio calls - emits events instead.
  view/              draws the world state each frame through the renderer (entities, shadows, hp bars)
  fx/                particles, damage numbers, juice (shake, flashes, shockwaves), lightning, trails,
                     cut-ins - mostly driven by game events
  audio/             api.ts (contract) + synthesised sfx & music
  ui/                DOM HUD, screens, touch controls, styles
  debug/             window.__kk hooks, autoplay bot, FPS meter
```

### 8.1 Rendering pipeline
1. **Pixel scale:** `targetShort = clamp(minCssDim / 1.8, 200, 300)` art px on
   the short screen side → phone portrait ≈ 216 px wide, desktop ≈ 300 px tall.
2. **Scene pass** into a low-res RGBA8 framebuffer exactly
   `ceil(cssW / scale) + 2` × `ceil(cssH / scale) + 2` art px (nearest
   sampling, premultiplied alpha). Camera position is snapped to whole art
   pixels for this pass; the sub-pixel remainder is applied in the final pass
   (smooth scrolling without pixel crawl).
3. **Layers** (drawn in order): ground tiles → ground decals → shadows →
   entities (y-sorted) → player projectiles/FX (normal + additive) → enemy
   bullets (always on top, glowing) → in-world text → world-space overlays.
4. **Glow buffer:** anything flagged *glow* (projectiles, gems, bullets,
   explosions, lightning, crystals, additive FX) is drawn into a half-res glow
   target as well; it is blurred (dual-Kawase / downsample chain) and added
   back as bloom. The pastel ground never blooms.
5. **Final composite** at device resolution (DPR capped at 2): sharp-bilinear
   upscale of the scene (crisp pixels at any non-integer scale) + sub-pixel
   camera offset + bloom + chromatic aberration + up to 8 shockwave
   distortions + vignette + colour grade (tint/saturation/contrast for
   day→night) + full-screen flash.
6. **Sprite batcher:** one atlas texture (built at boot from `src/art`),
   WebGL2 instanced quads. Per-instance: position, pivot, scale x/y, rotation,
   uv rect, RGBA tint, flash (0..1 lerp to white), blend (normal/additive).
   Zero per-sprite allocations in the hot path.

### 8.2 Simulation
- Variable timestep clamped at 1/20 s; substeps of ≤ 1/60 s for stability.
- `time.scale` for slow-mo; hitstop freezes the sim (and particles) for N ms
  of real time while shake keeps running.
- Entities: pooled objects in arrays with swap-remove; spatial hash (32 px
  cells) rebuilt per substep for separation and hit queries; circle
  collisions. Enemies softly separate from each other.
- The sim never touches DOM/WebGL/audio: it emits typed events
  (`enemyHit`, `enemyKilled`, `playerHurt`, `levelUp`, `bossWarning`,
  `explosion`, ...). FX, audio, UI subscribe. This makes the whole game
  runnable headless in Node (vitest) for balance simulations.
- Seeded RNG (`?seed=`).

### 8.3 Performance budget (mid-range phone, 60 fps)
300 enemies + 2000 particles + 400 gems + 150 projectiles. Auto quality:
rolling 2 s frame-time average; > 20 ms steps quality down (fewer particles,
smaller glow buffer, lower enemy cap), < 12 ms steps up. Particles are
struct-of-arrays in typed arrays. No allocations per frame in hot loops.

### 8.4 Persistence
`localStorage['kko.save.v1']` = `{ coins, meta: {...ranks}, settings, best:
{ time, kills, level, combo }, runs }`, every access in try/catch.

### 8.5 Debug hooks (for tests and screenshots)
URL params: `?autoplay=1` (bot plays + auto-picks upgrades), `?seed=N`,
`?hero=hoshi|rin|mochi`, `?skip=SECONDS` (fast-forward the sim), `?god=1`,
`?mute=1`, `?quality=low|high`, `?screen=title|select|game|results|shop`,
`?fps=1`. Global `window.__kk` exposes the game, world and helpers
(`skipTo`, `spawn`, `giveXp`, `levelUp`, `setSpeed`, `god`, `stats`).

### 8.6 Tooling
- `npm run dev` — dev server (`--host` for testing on a phone on the LAN)
- `npm run typecheck`, `npm test` (vitest, includes a headless 10-minute bot sim)
- `npm run sprites -- [--filter x] [--owner chars|world] [--scale 6] [--out file.png]`
- `node scripts/shot.mjs --path "/?autoplay=1&skip=120" --mobile --wait 4000 --out shots/x.png`
- `npm run build` (GitHub Pages) and `npm run build:single` (one self-contained HTML)
