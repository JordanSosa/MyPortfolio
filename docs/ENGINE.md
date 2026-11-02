# Engine guide (Kira Kira Overdrive)

The engine is three folders: `src/core` (math, rng, events, pools, spatial hash,
time, input, storage, loop), `src/render` (WebGL2 renderer, atlas, sprite batch,
camera, bitmap text, post FX) and `src/fx` (particles, presets, damage numbers,
juice, lightning, afterimages, ambient, speed lines). `tools/engine-test.ts` is a
working example of all of it. Run it with `npm run dev` and open
`/tools/engine-test.html` (`?stress=3000`, `?touch=1`, `?night=1`, `?standins=0`).

Units: world coordinates are **art pixels** (1 unit = 1 sprite pixel), y points
down, angles are radians, time is seconds, colours are `0xRRGGBB` numbers (use `C`
from `src/art/palette.ts`) and alpha is a separate value from 0 to 1.

---

## 1. Frame skeleton

```ts
import { Renderer, Layer, Flag, QUALITY, guessTier, AutoQuality } from "./render";
import { createFx } from "./fx";
import { Input, Loop, time, substep } from "./core";

const tier = guessTier();
const r = new Renderer({ parent: document.body, quality: QUALITY[tier], clearColor: 0x8ed873 });
const fx = createFx(r, { particles: QUALITY[tier].particles });
const input = new Input();
const auto = new AutoQuality(tier, (t, q) => { r.setQuality(q); fx.ps.setCapacity(q.particles); });

const loop = new Loop((dt) => {          // dt = real seconds, clamped to 1/20
  time.update(dt);                       // time.dt = scaled (0 in hitstop/pause), time.realDt = dt
  input.update();                        // poll gamepad, latch edges
  substep(time.dt, 1 / 60, (h) => sim.step(h));
  r.camera.follow(player.x, player.y, player.vx, player.vy, dt);
  r.beginFrame(dt);                      // resize, camera shake/zoom, post timers, clears the batch
  view.draw(r);                          // queue sprites (any order; layers sort it out)
  fx.update(time.dt, dt);                // particles freeze during hitstop; ambient/speed lines use real time
  fx.draw();
  r.endFrame();                          // scene -> glow -> bloom -> composite
  auto.sample(dt * 1000);
});
loop.onVisibility = (hidden) => { if (hidden) pauseGame(); };   // also fires on window blur
loop.start();
```

All drawing must happen **between `beginFrame` and `endFrame`**.

---

## 2. Renderer (`src/render/renderer.ts`)

`new Renderer({ canvas?, parent?, quality?, clearColor?, extraSprites?, pixelScale? })`
creates a fixed full-screen canvas (with `touch-action: none`), builds the atlas
and sets up WebGL2. It throws if WebGL2 is unavailable.

Pixel scale (DESIGN 8.1): the short side of the screen shows
`clamp(minCssDim / 1.8, 200, 300)` art px, so a portrait phone is about 216 px
wide and a desktop is 300 px tall. The scene is rendered at that low resolution
and upscaled with sharp-bilinear filtering, so pixels stay crisp at any
non-integer scale. Resizes, orientation changes and DPR changes are picked up
automatically on the next `beginFrame`. `r.onResize = (r) => …` fires after one.

| Member | What |
| --- | --- |
| `r.atlas`, `r.batch`, `r.text`, `r.camera`, `r.post` | sub-systems (below) |
| `r.time` | real seconds accumulated by `beginFrame` (UI-style animation clock) |
| `r.cssW / cssH / dpr / sceneW / sceneH` | viewport info |
| `r.H.px / glow / glowS / shadow / ring / ringThick / circle / streak` | handles of the utility sprites |
| `r.setQuality({ dprCap, glowScale, bloom })` | quality tier (see `QUALITY`, `AutoQuality`, `guessTier`) |
| `r.stats` | `{ instances, glow, drawCalls, sceneW, sceneH, scale, dpr }` from the last frame |
| `r.onRestore` | called after a lost WebGL context has been rebuilt (automatic). `r.debugLoseContext()` simulates a loss |

### Drawing sprites

```ts
// Fast path (no allocation): resolve handles once, then draw by number.
const puff = r.atlas.anim("en_puff");                  // { first, count, fps }
r.spr(Layer.Entity, r.frame(puff, t), x, y, flip * sqX, sqY, rot, tint, alpha, flash, flags);
//     layer        handle            pos   scale (neg = flip)  rad 0xRRGGBB 0..1  0..1   Flag bits

// Convenience (allocates the options object; fine for a few calls per frame).
r.sprite({ id: "chest", frame: 1, x, y, layer: Layer.Entity, scale: 1.5, flipX: true, glow: true, flash: 0.5 });
```

- **Pivot:** comes from the sprite def (`feet` actors: `(w/2, h-1)`, everything else is centred). Override it with `r.batch.drawP(..., px, py)` or `sprite({ pivotX, pivotY })`.
- **Flash** lerps the sprite toward its **tint colour**. With the default white tint that is the white hit flash; with `tint = C.cyan` and `flash = 1` you get a solid cyan silhouette.
- **Flags** (`Flag`): `Add` (additive), `Glow` (also drawn into the bloom buffer), `GlowOnly` (only in bloom: halos), `NoSnap` (skip pixel-grid snapping).
- **Snapping:** unrotated quads have their min corner snapped to the art-pixel grid, so sprites never shimmer. Rotated sprites are not snapped.
- **Animation:** `r.frame(anim, t, loop = true)` (same as `animFrame`) returns the handle at time `t`. `r.handle(id, frame)` gives a single frame.

### Layers (`Layer`)

Drawn in this order: `Ground, Decal, Shadow, Entity (y-sorted), FxBelow, Fx, FxAdd (forced additive), Bullets, Text, Overlay`.

- Within a layer, sprites draw in submission order. `Entity` is stably sorted by `y`, so draw actors at their feet position.
- To draw an attachment exactly in front of its owner, use the same `y`. Alternatively set `r.batch.sortBias = 0.01` (reset it afterwards) or `r.batch.sortKey = y` (set it back to `NaN`).
- Everything uses premultiplied alpha. Additive sprites output alpha 0, so normal and additive sprites mix with **no blend switches**. The whole scene is a single instanced draw call, and the glow pass is one more.
- Enemy bullets go on `Layer.Bullets` with `Flag.Glow`, so they are always on top and always glowing.

### Primitive helpers

```ts
r.rect(Layer.Text, x, y, w, h, color, alpha);           // top-left rect (HP bars)
r.line(Layer.Fx, x0, y0, x1, y1, thickness, color, alpha, flags);
r.circle(Layer.Decal, x, y, radius, C.red, 0.25);       // filled (telegraph zones)
r.ring(Layer.FxAdd, x, y, radius, C.white, 1, Flag.Glow, /*thick*/ true);
r.glow(x, y, radius, C.yellow, 0.6);                    // soft additive + bloom halo (FxAdd)
r.shadow(x, y, widthPx, alpha);                         // blob shadow on the Shadow layer
r.fillView(Layer.Overlay, C.deep, 0.5);                 // darken the whole view (ult cut-in)
```

Utility sprites, all white so they can be tinted: `fx_px` (2x2), `fx_dot` (1x1),
`fx_glow`, `fx_glow_s`, `fx_shadow`, `fx_ring`, `fx_ring_thick`, `fx_ring_soft`
(64 px, soft), `fx_circle`, `fx_soft_circle` (soft edge), `fx_streak`
(transparent on its left end), `fx_flare` (anime 4-point star), and `fx_beam`
(8x32 vertical light beam that is bright at the bottom).

### Atlas (`r.atlas`)

- `info(id)` returns `{ first, count, w, h, ox, oy, fps, placeholder }`. `handle(id, frame)`, `anim(id, fps?)` and `has(id)` (false for placeholders) are the other lookups.
- Manifest ids that are not drawn yet get a **pink checker placeholder** of the right size and frame count, and a single console warning lists them. An unknown id (not in the manifest) returns a 10x10 placeholder and is warned about once.
- `dataURL(id, frame = 0, scale = 1)` returns a cached PNG for DOM icons and portraits (use `image-rendering: pixelated`). `canvas(id, frame, scale)` returns the canvas itself.
- `font("font_main")` returns the glyph tables. If `font_main` is missing, a built-in 7 px fallback font is used automatically.

### Bitmap text (`r.text`)

```ts
r.text.draw("LEVEL UP!", x, y, { scale: 2, color: C.yellow, align: "center", valign: "middle",
  wobble: 1.5, rainbow: false, rotation: 0, glow: true, layer: Layer.Text, alpha: 1, flash: 0 });
r.text.drawFast(Layer.Text, "x99", x, y, scale, color, alpha, /*align 0 left,1 centre,2 right*/ 1);
r.text.measure("HELLO", 2);           // width in px
r.text.lineHeight;                    // 9 for font_main (7 px + outline)
```

Glyphs are white ink with a dark outline, so `color` tints the ink. Keep `scale` an integer for crisp text (damage-number pops are the exception).
Screen-space text: draw at `r.camera.view.x + sx`, `view.y + sy` on `Layer.Overlay`.

### Camera (`r.camera`)

```ts
cam.follow(tx, ty, vx, vy, dt);   // smooth follow + look-ahead (followLambda, lookAhead, lookAheadLambda)
cam.snapTo(x, y);
cam.shake(0.35);                  // add trauma 0..1; offset = maxShake * trauma^2 * smooth noise, decays
cam.zoomPunch(0.06);              // brief zoom-in kick that springs back
cam.zoomTo(0.85, 3);              // persistent zoom (<1 = zoomed out, e.g. boss intro)
cam.view;                         // {x, y, w, h} visible world rect this frame (cull/spawn with it)
cam.inView(x, y, r, margin);
cam.worldToScreen(x, y, out);     // -> CSS px; also r.worldToScreen / r.screenToWorld
cam.shakeScale = 0.5;             // settings multiplier (Juice does this for you)
```

Camera shake and zoom are updated with **real** dt in `beginFrame`, so they keep moving during hitstop.

### Post FX (`r.post`, plus shortcuts on `r`)

```ts
r.shockwave(x, y, strength = 1, radius = 64, life = 0.6); // world-space refractive ring, max 8 (oldest replaced)
r.flash(C.white, 0.4, 0.2);         // full-screen flash colour, amount, fade seconds
r.aberration(2);                    // chromatic aberration pulse (art px at the screen edge)
r.damageVignette(0.8);              // red edge vignette pulse
r.post.damageFloor = 0.3;           // persistent low-HP vignette (animate it for a heartbeat)
r.post.bloomSurge(1, 0.8);          // temporary bloom boost (ult)
r.post.hueCycle(0.6);               // hue-cycling grade (evolution)
r.post.dim = 0.55;                  // darken scene AND bloom (owner sets it every frame; 0 = off)
r.bloom = 0.95;                     // base bloom strength;  r.post.glowCore = tight halo weight
r.post.bloomLimit = 0.6;            // adaptive limiter: how much bloom a crowded glow buffer may cut (0 = off)
r.post.load;                        // 0..1 peak-chaos load (read-only; fed by endFrame from the glow count)
r.post.vignette = 0.32;             // base vignette amount
r.setGrade(GRADES.night, 3);        // ease the colour grade over 3 s (GRADES: day, dusk, night, dim, neutral)
r.post.blendGrade(GRADES.day, GRADES.night, runProgress);  // drive day -> night directly
r.post.gradeProtect = 0.8;          // how much glowing gameplay sprites escape the grade (0 = graded like the rest)
```

A `Grade` is `{ tint: [r,g,b], lift: [r,g,b], saturation, contrast, brightness, hue }`.
Bloom is added **after** grading, so glowing things stay luminous at night.
**Grade protect mask:** sprites drawn with `Flag.Glow` in normal blend (enemy
bullets, gems, player shots, crit numbers) leave their coverage in the glow
buffer's alpha (additive draws leave 0). The composite mixes the ungraded colour
back in by `clamp(glow.a x 1.5, 0, 1) x gradeProtect` (before the hue rotation,
so evolution hue cycles still apply), so dusk / night tint the meadow and the
actors while bullets stay bright and high-contrast. Off when bloom is off (no glow
pass). The dusk / night presets are soft (night: tint 0.88/0.86/1.0, a violet
lift, saturation 1.08) - the night mood comes from the lift and the fireflies.
Only sprites flagged `Glow` or `GlowOnly` bloom; the pastel ground never does.
Because bloom is composited after the scene, a dark full-screen *sprite* cannot
dim glowing things - use `r.post.dim` for that (the ultimate cut-in does).
Likewise the glow buffer never sees what is drawn on top of a glowing sprite: a
`Glow` silhouette *behind* a sprite (outline tricks) blooms through the sprite
and washes it out, so draw such helpers without `Glow`.

**Adaptive bloom limiter.** Every `endFrame` feeds the frame's glow-instance
count (normalised to a phone-sized 80k art px² view) into `r.post.feedGlow()`:
`r.post.load` ramps from 0 at `loadFrom` (220) to 1 at `loadTo` (800) glow
instances, with a fast attack (~0.12 s) and a slow release (~0.8 s). The
composite multiplies the bloom strength, bloom surges and (half as much) the
glow core by `r.post.bloomLimiter = 1 - bloomLimit x load`, so a late-game screen
full of evolved weapons stays readable instead of whiting out. Game code reads
`r.post.load` to thin its own juice (the feedback bridge scales its spark /
puff / damage-number budgets and sets `fx.dmg.busy`, the view draws a faint
hero beacon above player fx).

---

## 3. FX (`src/fx`, bundle via `createFx(r, { particles })`)

`fx = { ps, juice, dmg, bolts, ghosts, ambient, speed, update(dt, realDt), draw(), clear() }`.

### Particles (`fx.ps`)

Particles are struct-of-arrays in typed arrays with a fixed capacity
(`setCapacity(n)` per quality tier; it copies the first min(count, n) live
particles into the new arrays, so a tier change mid-fight keeps the screen's
particles). When full, the oldest slots are overwritten. `ps.density` scales emit
counts. `ps.position(i, out)` reads a live particle's position (tests / debug).
`emitScorch(ps, x, y, sizeMul)` emits the budgeted scorch ring (at most
`SCORCH_MAX` = 10 alive; `P.scorch` is a faint `fx_ring_thick`, 2.5 s).

```ts
import { P } from "./fx";
fx.ps.emit(P.confetti, x, y, 12);                                      // preset
fx.ps.emit(P.sparkle, x, y, 4, angle, C.yellow, /*sizeMul*/ 1.2, /*speedMul*/ 1.5, /*layer*/ -1);
fx.ps.emit(P.ring, x, y, 1, NaN, C.pink, radius / 16);                // ring sized to a radius
```

Define custom emitters once, at module scope, as `EmitterDef`:
`{ sprite, frames: "fixed"|"random"|"life"|"loop", frame, fps, speed: [min,max], angle, spread, life: [min,max], size: [start,end], sizeJitter, sizeCurve: "linear"|"out"|"in"|"pop"|"none", colors: n | n[], colorEnd, alpha, alphaCurve: "linear"|"late"|"inout"|"flicker"|"none", gravity, drag, rot: "random"|"velocity"|angle, spin: [min,max], additive, glow, glowLife, glowOnly, layer, bounce: { vz: [min,max], gravity, restitution, friction }, stretch, aspect, radius, ring, outward, sway, flash }`.

`bounce` gives the particle a fake height that pops up and bounces on the
ground (confetti, debris, coins). `stretch` elongates along the velocity (ray
bursts). `aspect` sets a constant x/y ratio (light pillars).

**Presets (`P`):** `confetti, sparkle, smoke, dust, ring, ringThin, rays, debris, hit, explosion, flare, ember, petals, hearts, pillar, scorch (6 s ground decal), trail, coins`.

**Composite effects** (`kit` is `fx` or `{ ps, juice }`), following the DESIGN juice catalogue:

```ts
fxEnemyDeath(fx, x, y, [C.mint, C.lime]);  // 8-14 confetti in its colours + sparkles + puff + ring
fxEliteDeath(fx, x, y, colors);            // + 30 confetti, coins, rays, shockwave, hitstop 60
fxHit(fx, x, y, weaponColor, angle);       // tinted fx_hit + sparks
fxExplosion(fx, x, y, radius);             // sprite, flare, rays, embers, debris, smoke, scorch + shake/wave/flash/aberration
fxLevelUp(fx, x, y);                       // 24 rays, light pillar, rings, confetti, golden flash, hitstop 100
fxPickup(fx, x, y, color);  fxDash(fx, x, y, dirX, dirY);  fxFirework(fx, x, y, colors?);
```

### Damage numbers (`fx.dmg`)

```ts
fx.dmg.spawn(x, y - 14, 12);              // white, pop 1.6 -> 1 (easeOutBack), rises, fades over 0.6 s
fx.dmg.spawn(x, y - 14, 48, "crit");      // yellow x2, wobble, sparkles, "48!"
fx.dmg.spawn(px, py - 20, 7, "player");   // red
fx.dmg.spawn(px, py - 20, 20, "heal");    // green "+20"
fx.dmg.text(x, y, "MISS", C.lavender);
fx.dmg.enabled = settings.damageNumbers;  // hides normal/crit only; fx.dmg.scale = global size
fx.dmg.busy = r.post.load;                // 0..1: enemy numbers fade (-40%), lose the spawn flash, crits shrink + stop blooming
fx.dmg.alive;                             // live numbers (kept incrementally, cheap to read per hit)
fx.dmg.aliveCrit;                         // live crit numbers (same bookkeeping; the feedback bridge caps them)
fx.dmg.focusX = px; fx.dmg.focusY = py - 9; fx.dmg.focusOn = true;  // hero exclusion zone (set every frame)
fx.dmg.after = drawBanners;               // called once at the end of draw(), then cleared (draw on top of numbers)
```

A crit spawned within 14 px of a live crit younger than 0.15 s merges into it
(values summed, codes rewritten, re-pops) instead of allocating a slot. Enemy
numbers (normal / crit) whose centre is within 26 px of the focus point draw at
0.6x and 35 % alpha, so a pile of numbers never hides the hero.

At most 150 are alive (a ring buffer recycles the oldest). Spawning does not
allocate. Large values are compacted (`123K`, `12M`). Edit `fx.dmg.styles` to
change colours, scales, lifetimes or rise heights.

### Juice (`fx.juice`): use this rather than calling the post FX directly

```ts
juice.hitstop(60);         // freezes time.dt for 60 ms real time (max-merged, not stacked; capped at 400)
juice.slowmo(0.25, 1.2);   // eased slow motion (real seconds)
juice.shake(0.35);         // trauma; scaled by settings.shake
juice.zoomPunch(0.05);
juice.flash(C.white, 0.5); // reduced to <= 0.12 with reduceFlashing
juice.shockwave(x, y, 1, 72);  juice.aberration(2);  juice.damageVignette(0.8);
juice.bloomSurge(1, 0.8);  juice.hueCycle(0.6);
juice.impact(x, y, power); // hitstop + shake + punch + flash + wave + aberration in one call
juice.apply({ shake: 0.5, reduceFlashing: true, hitstop: true });   // from the settings screen
```

### Lightning (`fx.bolts`)

```ts
fx.bolts.strike(x0, y0, x1, y1, { color: C.cyan, thickness: 2, life: 0.14, branches: 2, jag: 0.2, detail: 5, impact: true });
fx.bolts.fromSky(x, y, 140, { color: C.yellow, thickness: 3 });     // Thunder Bell
```

Bolts are midpoint-displaced polylines with a white core and a coloured glow
(additive + bloom). They re-jitter every 35 ms, flicker, and draw an impact
glow. Up to 64 bolts, including branches, can be alive at once.

### Afterimages (`fx.ghosts`) + `TrailEmitter`

```ts
const trail = new TrailEmitter(fx.ghosts, /*interval*/ 0.03, /*life*/ 0.26, /*alpha*/ 0.55);
// while dashing, every frame:
trail.tick(time.dt, heroHandle, x, y, facing, 1, (i++ & 1) ? C.cyan : C.pink, Layer.FxBelow);
fx.ghosts.spawn(handle, x, y, sx, sy, rot, color, life, alpha, layer, additive = false, glow = false);
```

Ghosts are translucent silhouettes tinted `color` (`fx.ghosts.flash` sets how
solid they are). Avoid the additive option for dense trails, because
overlapping additive ghosts saturate to white.

### Ambient (`fx.ambient`) and speed lines (`fx.speed`)

```ts
fx.ambient.set({ petals: 12, motes: 14, fireflies: 0 });  // densities fade smoothly; set fireflies at night
fx.ambient.wind = 10; fx.ambient.parallax = 0.35; fx.ambient.alpha = 1;
fx.speed.radial(1.1, { color: C.white, intensity: 1, x?, y?, inner: 0.42, count: 56 });   // ult cut-in
fx.speed.directional(angle, 0.3, { color: C.aqua, intensity: 0.7 });                     // dash
```

Both draw on `Layer.Overlay` in view space and run on real time.

---

## 4. Core (`src/core`)

### Time (`time`, global `Time` instance)

| | |
| --- | --- |
| `time.update(realDt)` | once per frame |
| `time.dt` / `time.realDt` / `time.scale` | scaled dt (0 in hitstop or pause), raw dt, effective scale |
| `time.simTime` / `time.now` / `time.frame` | scaled clock, real clock, frame counter |
| `time.hitstop(ms)`, `time.slowmo(scale, s)` | as Juice |
| `time.easeTo(0.2, 0.3)` / `time.easeTo(1, 0.2)` | persistent eased scale (level-up modal) |
| `time.paused = true` | dt becomes 0 and realDt keeps flowing |
| `time.speed = 4` | debug fast-forward |
| `time.reset()` | new run |

### Input (`new Input(opts?)`)

```ts
input.update();                       // first thing each frame
input.move.x / input.move.y           // analog, |move| <= 1 (keys, stick, dpad, touch joystick; strongest wins)
input.facing                          // last non-zero direction (unit)
input.pressed("dash" | "ult" | "pause" | "confirm" | "back" | "up" | "down" | "left" | "right")   // edge this frame
input.held("dash");  input.consume("ult");  input.trigger("dash");   // inject (bots)
input.lastDevice                      // "keyboard" | "gamepad" | "touch" | "mouse"
input.haptic(30);  input.haptics = settings.haptics;   // single pulses: >= 20 ms, at most one per 50 ms (patterns pass through)
```

A gamepad disconnect (event, or no connected pad while polling) clears every
gamepad hold and the pending edges only the pad produced, so DASH / OVERDRIVE
can't stay latched.

Key bindings: WASD/arrows move, Space/Shift dash, E/Enter ult, Esc/P pause,
Enter/Space confirm, Esc/Backspace back. Gamepad: left stick or d-pad moves, A/X/LB/RB
dash, B/Y/RT ult, Start/Back pause, A confirm, B back. The stick also produces
auto-repeating up/down/left/right edges for menus.

**Touch controls** are a DOM overlay (`.kk-touch`, z-index `var(--kk-touch-z, 40)`) with multi-touch support:

```ts
input.showTouchControls(true);        // during gameplay; shown while the player uses touch (auto-hides on
                                      // keyboard/gamepad use, re-appears on the next touch; ?touch=1 forces)
input.showTouchControls(false);       // menus/modals (also releases the joystick)
input.setJoystickEnabled(false);      // keep the buttons but disable the stick
input.setUltCharge(meter / 100, ready);   // OVERDRIVE ring fill + rainbow pulse when ready
input.setDashCharge(1 - cd / maxCd);  // DASH ring (1 = ready, pops when it becomes ready)
input.deny("ult");                    // shake the button (pressed while not ready)
```

Phone-CPU budget: every looping animation of the overlay is compositor-only. The
OVERDRIVE-ready rainbow is three static pre-coloured glow layers (`.kk-btn .gl`)
cross-fading by opacity (no animated `box-shadow`) plus the `scale` pulse and
the ring ping; the cooldown rings have no transition / filter (a static soft halo
stroke `.glo` instead) and their `stroke-dashoffset` writes are quantised to 40
steps and throttled to ~15 per second; the ready pop and the deny shake use the
Web Animations API (no forced reflow). `.kk-btn` has `contain: layout style`.

- **Floating joystick:** a touch-down anywhere that is not a button sets the origin. The knob radius is 48 CSS px, with a radial 0.15 deadzone and analog output. If the finger goes past the radius, the origin is dragged along.
- **Ignored targets:** touches that start on `button, a, input, select, textarea, label, [data-ui], [data-no-joystick]` never start the joystick. Put `data-ui` on HUD elements that should block it, such as the pause button.
- **Fresh touches** for level-up cards (DESIGN 2.3): call `input.markTouchesStale()` when the modal opens, then ignore any event for which `input.isFresh(event)` is false. That works for pointer and click events, and the finger that was steering when the modal opened is rejected.
- `input.stickActive`, `input.pointersDown`, `input.touchControlsVisible` and `input.touchControlsWanted` are also available.
- **Page shell CSS** (main/UI): set `touch-action: none; overscroll-behavior: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent` on `html, body`. The renderer canvas and touch overlay already set `touch-action: none` on themselves. `tools/engine-test.html` shows the full set.

### Loop

`new Loop((dt, nowSec) => …)` runs a requestAnimationFrame loop with dt clamped
to `maxDt = 1/20`. It stops while the tab is hidden and resumes without a dt
spike. `loop.onVisibility(hidden)` also fires on blur and focus, and
`loop.frameMs` is the CPU time of the last frame. `substep(dt, 1/60, (h, i, n) => …)`
splits a frame into equal sub-steps.

### RNG (`Rng`, seeded sfc32)

```ts
const rng = new Rng(urlSeed());       // ?seed=N (or a random seed); new Rng("text") also works
rng.next(); rng.range(a, b); rng.int(1, 6); rng.chance(0.05); rng.sign(); rng.angle(); rng.spread(3);
rng.pick(arr); rng.weightedIndex([70, 20, 10]); rng.weighted(items, (it) => it.weight); rng.gauss(0, 1);
rng.shuffle(arr); rng.fork(); rng.getState()/setState(s);
```

`fxRng` is the shared cosmetic RNG. Gameplay should use its own seeded `Rng`
so runs are reproducible.

### Events (`EventBus<M>`)

```ts
type GameEvents = { enemyKilled: { x: number; y: number; kind: string }; levelUp: { level: number } };
export const bus = new EventBus<GameEvents>();
const off = bus.on("enemyKilled", (e) => fxEnemyDeath(fx, e.x, e.y, COLORS[e.kind]));
bus.emit("enemyKilled", payload);   // no allocation on emit (reuse payload objects in hot paths)
bus.once(...); off(); bus.clear();
```

### Spatial hash (`SpatialHash`)

```ts
const grid = new SpatialHash(32 /*cell*/, 1024 /*initial capacity*/);
grid.clear();
for (let i = 0; i < enemies.count; i++) grid.insert(i, e.x, e.y, e.r);   // ids: your array indices
const n = grid.query(x, y, radius, out /* number[] or Int32Array */);     // ids overlapping the circle -> out[0..n)
const id = grid.nearest(x, y, maxR, acceptFn?);                            // -1 if none
```

The query is an exact circle-versus-circle test. Large objects are inserted
into every cell they overlap, and queries don't allocate. Rebuild the grid
every substep.

### Pools

`new Pool(create, reset?, prewarm)` provides `get()` and `release(o)`.
`new PooledList(create, reset?)` adds `spawn()`, `removeAt(i)` (swap-remove, so
iterate backwards or use `i--`), `remove(o)`, `removeWhere(pred)`, `clear()`,
`items` and `count`.

### Storage

```ts
const save = new Store("save", 1, DEFAULT_SAVE /*, migrate?(old, oldVersion) */);   // key "kko.save.v1"
save.data.coins += 10; save.save(); save.reset();
loadJSON(name, version, defaults); saveJSON(name, version, value);   // one-off variants
```

Every access is wrapped in try/catch. Loaded data is deep-merged over the
defaults, so new fields get defaults and fields whose type changed are dropped.

### Math and colour (`core/math.ts`, `core/color.ts`)

- **Math:** `clamp, saturate, lerp, invLerp, remap, remapClamped, smoothstep, approach, damp(cur, target, lambda, dt), smoothDamp, springStep({x,v}, target, k, c, dt), len, dist, dist2, normalize(out,x,y), clampLen, rotate, fromAngle, angleTo, wrapAngle, angleDiff, lerpAngle, dampAngle, approachAngle, ease.* (quad…quint, sine, expo, circ, back, elastic, bounce), easeOutBack(t, overshoot), easeOutElastic, bell, noise1, noise2, fbm1, hash01, TAU`.
- **Colour:** `rgb, lerpColor, scaleColor, hsv, rainbow, hexColor, cssColor, toFloats`.
- **Squash and stretch pattern:** keep `sq = { x: 1, v: 0 }`. On a hit, do `sq.v -= 9`. Every step, call `springStep(sq, 1, 340, 14, dt)` and draw with `sx = face * (2 - sq.x), sy = sq.x`.

---

## 5. Debug

`new FpsMeter()` from `src/debug/fps.ts` gives a DOM meter at the bottom left:
`show()`, `toggle()`, and `frame(dt, cpuMs?, extraText?)` once per frame.

## 6. Performance notes

- All hot paths are allocation-free: `batch.draw` (about 45 ns per sprite), particles, damage numbers, lightning, ghosts, ambient, text and spatial queries. The only allocating helper is `r.sprite({...})`; do not use it in large loops.
- Each frame does one buffer upload, one instanced draw for the whole scene, one for the glow buffer, about 10 small bloom passes and one composite pass.
- Measured CPU cost: 20k sprites take 0.9 ms to queue and 3.6 ms to sort, pack and upload in headless Chrome. 5000 particles take about 1 ms to update and 1.1 ms to draw.
- Quality tiers (`QUALITY.low/mid/high`) set the DPR cap (1 / 1.5 / 2), the glow buffer scale (0.5 / 0.5 / 1), the particle capacity (1500 / 3000 / 5000) and the enemy cap.

## 7. Changes made by the gameplay slice

- `input.haptic()` is a no-op until the page has had a user gesture (`navigator.userActivation.hasBeenActive`), so Chrome no longer logs a vibrate intervention error.
- `atlas.canvas()` / `atlas.dataURL()` use CPU-side 2D contexts (`willReadFrequently`) so encoding DOM icons never stalls on a GPU readback. The UI always encodes sprites at 1x (`src/ui/dom.ts sprite()`) and upscales with `image-rendering: pixelated`, and pre-encodes all icons/portraits in idle time at boot.
- `P.scorch` is a soft purple "magic burn" ring (alpha 0.12, 2.5 s, budgeted through `emitScorch`) instead of a dark outline-coloured hole.
- The app sets `r.bloom = 0.8` (late-game fights stay readable).

## 8. Changes made by the integration pass

- `PostFx.dim` (0..1, `u_dim` in the composite): multiplies the final image after bloom. The world view sets it every frame (`0.55` ramping in during the ult cut-in, else `0`); `post.reset()` clears it.
