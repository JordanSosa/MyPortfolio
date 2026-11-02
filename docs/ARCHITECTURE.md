# Architecture (Kira Kira Overdrive)

Read with `docs/DESIGN.md` (what the game is) and `docs/ENGINE.md` (renderer,
fx, input, time APIs). This file explains how the game code is put together
and how to add content without touching other people's files.

---

## 1. Module map

```
src/
  main.ts              boot: fonts (@fontsource), styles, App, window.__kk hooks; removes index.html's static
                       #boot splash once the app runs; "needs WebGL2" only when WebGL2 is really missing (any
                       other constructor error resets the settings and retries once, then a generic error)
  core/  render/  fx/  engine (docs/ENGINE.md)
  art/                 palette / format / manifest (frozen contracts) + sprites/*.ts (auto-registered)
  audio/               api.ts (frozen contract) + index.ts `audio` implementation

  game/                PURE SIMULATION - no DOM / WebGL / audio imports. Runs in Vitest.
    world.ts           World: entities, step(dt), combat, pickups, xp, build, ult, combo, chests
    types.ts           entity + content definition types (Enemy, Projectile, WeaponDef, EnemyDef, ...)
    events.ts          GameEvents (typed bus payloads)
    config.ts          DESIGN numbers (CFG), xpToNext, combo RANKS, damage channels
    stats.ts           Stats block + modifier chain
    heroes.ts          hero table (stats trait, start weapon, ult)
    passives.ts        passive table (8 passives x 5 levels)
    meta.ts            Dream Shop upgrades + costs
    upgrades.ts        level-up card generation / application, chest rewards
    registry.ts        auto-registry (import.meta.glob) of weapons / enemies / bosses / ultimates
    weapons/*.ts       one file per weapon (+ its evolution); `_shared.ts` helpers, `_fx.ts` (weaponFx kinds,
                       reused-payload emit helpers, random on-screen targets)
    enemies/*.ts       one file per enemy behaviour (props too); `_steer.ts` helpers, `_bullets.ts` (fair
                       shoot / ring / fan helpers: never spawn on the player), `_fx.ts` (enemyFx kinds + emit helper)
    bosses/*.ts        one file per boss (king-puff, nightmare-teddy, lady-lunatic); `_luna.ts` (Lady Lunatic
                       state + moon-ring geometry, import-cycle free for the bot / view)
    ultimates/*.ts     one file per hero ultimate
    director/
      timeline.ts      spawn phases + timed events AS DATA
      events.ts        event-kind handlers (swarmLine, encircle, flood, elite, boss)
      director.ts      continuous spawning, props, boss warning/entrance, run end

  view/                draws the world with the renderer (reads the World, never mutates it)
    world-view.ts      enemies, hero, projectiles, bullets, gems, pickups, telegraphs, overlays
    ground.ts          infinite procedural meadow + deco (stable per-cell hashing)
    trails.ts          projectile trail presets (keyed by Projectile.trail)
    texts.ts           in-world bitmap texts ("LEVEL UP!", "FREEZE!")
    anims.ts           sprite handle cache
    feedback.ts        EVENT -> juice/particles/numbers/audio/haptics/HUD hooks bridge
    weapon-fx.ts       arsenal visuals: bubble field / ocean dome, prism + rainbow beams, candy landing markers,
                       love-tornado swirl (per frame) + `weaponFx` events (lightning, blasts, dome bursts, heals)
                       + arsenal trail looks (merged into TRAILS)
    bestiary-fx.ts     bestiary visuals: per-enemy `decorate` hook (eye charge, pumpkin shiver, wisp fuse ring,
                       boss eyes / claws / halo, Lady Lunatic's moon ring), `enemyFx` cues, boss phase / enrage
                       juice, boss death throes, the VICTORY dawn sequence and the grade overrides (LUNATIC MOON
                       dim, enrage red, sunrise sweep)

  ui/                  DOM: app state machine, HUD, screens, modals, save
    app.ts             App: loop, screens, modals, level-up / chest / game-over flow, settings, run-start stinger,
                       Back-gesture history guard, AutoQuality feed, WebGL draw throttle under modals
    session.ts         Session = World + WorldView + Feedback (real run or attract mode)
    hud.ts             HUD (XP, level, timer, kills/coins, icons, combo, boss bar, banners + boss letterbox,
                       onboarding hint / bubbles, READY?/GO! stamp); diffed, quantised, WAAPI juice (see 2.1)
    cutin.ts           ultimate anime cut-in overlay (ended by the sim / App only: no wall-clock timer)
    tutorial.ts        first-runs onboarding (move hint until moved, DASH bubble until the first dash,
                       OVERDRIVE-ready bubble x2, "fills as you fight" once per run)
    wake.ts            Screen Wake Lock during runs (re-acquired when the page is visible again)
    nav.ts             keyboard / gamepad menu navigation (spatial focus; `refocus` after in-place re-renders)
    save.ts            persisted save (kko.save.v1), validated on load (`sanitizeSave`), tutorial flags
    dom.ts             tiny DOM helpers (atlas sprite -> <img>, sprite pre-decode, `Bump` WAAPI one-shots, fmtNum)
    styles.css         all UI styles (palette CSS variables)
    screens/*.ts       splash, title, select, levelup, chest, pause, settings, over, results, shop

  debug/
    bot.ts             autoplay bot + `simulate()` headless runner (PURE; used by tests, ?autoplay, ?skip, attract,
                       the balance probe; `noDash` / `randomPicks` make the "lazy" weak-player proxy)
    params.ts          URL params (?autoplay ?seed ?hero ?skip ?god ?mute ?quality ?screen ?fps ?speed)
    hooks.ts           window.__kk (skipTo, spawn, giveXp, levelUp, chest, ult, give, clearWeapons, pause, endRun, stats ...)
    fps.ts             FPS meter

tests/                 vitest: core math, xp/cards/chests/meta, headless 3-minute bot runs, boss, ults,
                       bestiary.test.ts (late enemies, both bosses through every pattern/phase, victory, enrage,
                       bullet hygiene), integrity.test.ts (final boss + death on one step, coin merge, a full
                       unmuted run with a listener on every event: bounded lists, victory)
                       quality.test.ts (AutoQuality stepping, guessTier, save validation, fmtNum)
tools/balance.probe.ts `npm run balance`: full headless runs, every hero x seed, good + lazy bot, pacing report (section 6)
scripts/e2e.mjs        Playwright e2e: desktop / mobile portrait / mobile landscape, screenshots, fails on errors
scripts/peak.mjs       peak-chaos readability shots (adaptive bloom limiter on / off)
scripts/icons.mjs      regenerates public/icon-192.png + icon-512.png from the atlas
public/                PWA manifest + icons
```

Dependency direction: `ui -> view -> game`, `ui/view -> render/fx/core`,
`game -> core (events, rng, pool, spatial, math) + art/palette (colours only)`.
**Nothing in `src/game` may import `render`, `fx`, `ui`, `view`, `audio` or touch the DOM.**

---

## 2. Frame flow

```
Loop(dt) -> App.frame
  time.update(dt); input.update(); nav.update(input)
  game frame: input -> world.input (or the bot), pause, touch meters,
              level-up intro (time eases to 0.2x, then modal), chest modal, game over
  session.tick(time.dt, dt): substep(1/60) world.step(); camera.follow; feedback.frame()
  r.beginFrame -> view.draw -> fx.update/draw -> r.endFrame   (at most 30x/s while a modal or Results is up;
                                                              fx.update still runs every frame)
  hud.update(world)
  auto.sample(frameMs, cpuMs)   (skipped while paused / a modal / settings / Results, and 1 s after a screen change)
```

Modals set `time.paused` (the sim stops, ambient fx keep animating), hide the
touch controls, mark held fingers stale, remove the onboarding hint and muffle
the music (except the game-over / victory modal, whose jingle stays clear). The
ultimate cut-in is handled *inside* the sim (`world.ult.phase === "cutin"`
pauses the world for `CFG.cutinTime` while particles keep running); the view
darkens the frame through `r.post.dim` meanwhile. The DOM cut-in overlay
(`ui/cutin.ts`) plays its 0.92 s intro and then *holds* until the sim emits
`ultStart` (feedback hook `cutinEnd`), so it can't vanish early on a slow device
whose sim runs on clamped frame time. App also ends it whenever the sim is no
longer in its cut-in (muted fast-forwards never emit `ultStart`) and on every
run end / screen change; a paused game keeps it up untouched.

Flow rules around the cut-in and modals (`App.gameFrame`):

- level-up / chest modals (and the 0.4 s level-up slow-mo intro) never start
  while `world.ult.phase === "cutin"`; an OVERDRIVE press is ignored while a
  level-up / chest is queued, so the cut-in never starts under a modal;
- `pause()` during the cut-in or the run-start READY? sets `pausePending`, and
  the pause opens on the first frame after it (blur / visibility / gamepad
  disconnect / WebGL context loss all go through `pause()`);
- on the frame a modal closed, gameplay edges (dash / ult / pause) are dropped,
  and a nav "back" consumes back + pause + ult + dash + confirm, so the gamepad B
  that resumes never casts and Enter never re-clicks the pause button (which is
  `tabindex=-1` and blurred on click); P / START toggle the pause closed.

Android Back / edge-swipe back: every non-title screen pushes one same-URL
history entry (`{kk: 1}`); `popstate` re-arms it and routes like Esc (settings
closes, game pauses, pause resumes, level-up / chest / game over ignore it,
select / shop / results go to the title). Back at the title the guard is
dropped (`history.back()`, its own popstate ignored), so Back leaves the page.

Run-start stinger (only GO! on the select screen): READY? with `time.paused`
for 0.6 s (hero cast pose, HUD flies in via `.hud.intro`), then GO! (light
shake, uiConfirm), the sim and the touch controls start; input is ignored
before GO!. Deep links / autoplay / `?skip` / RETRY start without it.

Menus over the attract game (`App.frame`, `Session.camOffX/Y`): the camera is
offset so the bot's hero runs in open meadow, never under the menu - portrait:
below the centred menu (80 % height); desktop / wide landscape: left of the
centred column (22 %, 62 %); compact phone landscape: between the logo and the
menu (title) or right of the key art (splash).

Small-screen layout rules (styles.css): the touch OVERDRIVE button reaches
~210 px above the bottom edge, so in touch portrait the onboarding pill sits
above the hero (25 %); the pause menu and settings fit a 320x568 phone without
scrolling (`max-height: 620px` portrait rules, six build slots per row under
360 px); shop cards put the price on its own line under 360 px; Results is a
two-column panel in phone landscape (stats + buttons left, damage chart right).
The level-up REROLL is disabled when `world.canReroll` is false (only the Heal /
Star Pouch fallbacks remain), so it is never spent or tapped for nothing.

### 2.1 DOM performance rules (phones)

- No always-on CSS animation outside the compositor: full-screen glow borders
  (`.sss-border`, `.danger`, `.warn-border`) are `display: none` until `.on` and
  then animate opacity only; shine sweeps, XP stripes, hazard stripes and cut-in
  speed lines move by `transform`.
- HUD writes are diffed; bars are quantised to 1/400 with pre-built transform
  strings; counters (kills / coins / combo) are written at most 15x per second
  with tabular digits in fixed-width boxes; the boss bar's ghost catches up after
  the HP holds for 0.2 s.
- Juice (combo bump, level pop, coin bump, XP shim, rank stamp / fall / shine) is
  WAAPI through `dom.ts Bump` (created once, rewound, rate-limited): no class
  replays, no forced reflow. `replay()` is for one-off non-HUD screens only.
- Weapon / passive slots are reused nodes; `.xpbar .combo .stats .bossbar .card`
  carry `contain: layout style`, modals `contain: strict`.
- UI sprites are encoded and decoded (`img.decode()`) at idle after boot.

### Quality tiers (render/quality.ts)

Every coarse-pointer device starts at `mid`, desktops at `high`. AutoQuality
judges 2 s windows against the display's own refresh interval (median frame
time, never slower than 60 Hz): more than 10 % of frames over 1.3x refresh, or
average JS time above 0.75x refresh, steps down (4 s cooldown); 8 s without a
bad window with JS under 0.4x refresh steps up (cooldown 8 s + 12 s per earlier
down-step). DPR caps are 2 / 2.5 / 3 (the scene renders at art resolution, only
the nearest-neighbour composite scales; the canvas is `image-rendering:
pixelated`); each step down also lowers the enemy cap and particle budget.

### Music per state

| State | Track | Where |
| --- | --- | --- |
| splash (before the unlock gesture) | none | `App.unlockAudio` picks the track for the current screen |
| title / select / settings | `title` | `App.goTitle / goSelect` |
| Dream Shop | `shop` | `App.goShop` |
| run | `battle` + `setIntensity(enemies, combo rank, boss)` | `App.startRun`, `Feedback.frame` |
| boss alive | `def.boss.music` (`boss` / `final`) | `feedback.ts bossSpawn`; back to `battle` 2 s of **game time** (`world.t`) after a non-final boss dies (frame time is clamped on slow devices, so it is not used); `App.revived` restores the right one |
| level-up / chest / pause | (muffled) | `App.openModal` |
| run-start stinger | `battle` starts with READY? | `App.startRun` |
| death | duck, then `gameover` with the DREAM OVER modal (2.0 s after death) | `feedback.ts playerDied`, `App.gameFrame` |
| boss phase change | duck 1.9 s | `bestiary-fx.ts bossPhase` |
| victory | `victory` starts at the dawn flash, 1.7 s after the final blow ("DAWN BREAKS!") | `bestiary-fx.ts victory` |
| results | keeps `victory` / `gameover` | `App.endRun` |

Hitstop / slow-mo are global `time` effects triggered by the feedback bridge.

---

## 3. Simulation essentials

- **Coordinates**: art px, y down. Actor positions are the **feet**; the
  collision centre is `(x, y - cy)` (`cy = def.height / 2 * scale`). The
  player body centre is `(x, y - PLAYER_CY)`.
- **Entities** live in `PooledList`s (`world.enemies / projectiles / bullets /
  gems / pickups / telegraphs`). Kill by setting `dead = true`; removal happens
  in `cleanup()` at the end of `step()`, then the enemy `SpatialHash` is
  rebuilt (indices stay valid during a step).
- **Pooled objects are reused.** Never keep a reference across steps unless you
  also keep its `uid` and compare (see `weapons/_shared.ts own()/prune()`).
- **Damage**: `world.hitEnemy(e, base, owner, angle, knock, critBonus, source, color)`
  (crit + variance + knockback + flash + events + kill). Area damage:
  `world.explode(x, y, r, dmg, owner, knock, source, color)`,
  `world.hitAllInView(...)`. Per-enemy re-hit cooldowns use **damage
  channels** (`Enemy.lastHit[ch]`; weapon slot 0..5, `CH_ULT`, `CH_MISC`).
- **Projectiles** are data-driven: behaviour (`kind`: free / attached /
  managed / falling, homing, shape circle / ellipse / ring, pierce, hitEvery,
  hooks `update/onHit/onEnd`) and visuals (`sprite, anim, scale, rot, rotMode,
  tint, glow, trail, entity, pop, shadow, telegraph`) that the view interprets.
- **RNG**: everything gameplay uses `world.rng` (seeded) - runs are
  reproducible per seed (tested).
- **Events**: `world.emit(type, payload)`. Hot events reuse one payload object.
  `world.muted = true` silences everything (fast-forward).

### Events (src/game/events.ts)

| Group | Events |
| --- | --- |
| combat | `enemyHit`, `enemyKilled`, `propBroken`, `eliteSpawned`, `explosion`, `weaponFire`, `weaponFx`, `enemyShoot`, `telegraph`, `shockwave` |
| player | `playerHurt`, `playerHeal`, `playerDied`, `playerRevived`, `dash`, `dashReady` |
| progression | `levelUp`, `upgradeApplied`, `evolution` |
| pickups | `gem`, `coin`, `pickup`, `chestDropped`, `chestCollected`, `chestOpened`, `magnet`, `bomb`, `freeze` |
| combo / ult | `comboRank`, `comboDrop` (fell one rank), `comboBreak`, `ultReady`, `ultCutin`, `ultStart`, `ultEnd`, `ultSlash`, `ultBurst`, `ultMeow` |
| director | `waveIncoming`, `bossWarning`, `bossSpawn`, `bossKilled`, `bossEnrage`, `bossPhase` |
| bestiary | `enemyFx` (EFX_* cue + position / direction / power, reused payload), `bulletsCleared` (fired before the bullet list is emptied) |
| run | `victory` |

Feedback for each lives in `src/view/feedback.ts` (one `bus.on` per event).

---

## 4. How to add content

All registries are assembled with `import.meta.glob` in `src/game/registry.ts`:
**adding a file is enough - no index file to edit.** Files whose names start
with `_` are helpers (they simply don't export the registry array).
Run `npm test` afterwards (the test script disables Vitest's fs module cache
so new files are always picked up).

### Weapon (`src/game/weapons/<name>.ts`)

```ts
import { C } from "../../art/palette";
import { PK_FREE, ROT_SPIN, type WeaponDef } from "../types";
import { fired, wstats } from "./_shared";

export const heartBoomerang: WeaponDef = {
  id: "heart_boomerang", name: "Heart Boomerang", icon: "icon_heart_boomerang", color: C.red, sfx: "boomerang",
  desc: "Thrown at the nearest enemy, flies out and returns, piercing.",
  levels: [ { dmg: 12, cd: 1.4, amount: 1, speed: 150, pierce: Infinity, knock: 40 }, /* ... 5 entries */ ],
  upgrades: ["+1 heart", "Damage +5", "...", "..."],          // text for Lv2..Lv5
  evolution: { into: "love_tornado", with: "twin_charm" },   // optional
  update(w, inst, dt) {
    const S = wstats(w, inst);                               // dmg/cd/amount/area... with stats applied
    inst.timer -= dt;
    if (inst.timer > 0) return;
    inst.timer = S.cd;
    const p = w.spawnProjectile(inst);                       // pooled, fields reset
    p.kind = PK_FREE; p.x = w.player.x; p.y = w.player.y - 10; /* velocity, r, dmg, pierce... */
    p.sprite = "w_heart"; p.rotMode = ROT_SPIN; p.spin = 12; p.glow = true; p.trail = "star";
    p.update = myBoomerangHook;                              // module-scope function (no per-frame closures)
    fired(w, inst, w.player.x, w.player.y);
  },
};
export const loveTornado: WeaponDef = { id: "love_tornado", evolved: true, /* one level */ ... };
export const weapons: WeaponDef[] = [heartBoomerang, loveTornado];
```

It is automatically offered as a NEW card, levels up, shows in the HUD/pause/
results, and evolves via the card/chest system. New trail looks: add a key to
`src/view/trails.ts`. Hit sound override: `hitSfx`.

Looks the projectile list can't express (lightning, area blasts, heals, auras,
beams) follow the arsenal pattern: the weapon emits `weaponFx` events through
`wfx(w, WFX_*, ...)` from `weapons/_fx.ts` (one reused payload, muted-safe) and
`src/view/weapon-fx.ts` turns them into juice; persistent visuals (aura radius
in `inst.data`, owned beam / bomb projectiles in `inst.projs`) are read there
each frame by weapon id. Reference files: `heart-boomerang.ts` (custom flight
hook, per-leg hit lists), `thunder-bell.ts` (marker projectile + chain via
`grid.nearest`), `candy-bomb.ts` (parabolic PK_FALL + AoE), `bubble-aura.ts`
(no projectiles, per-enemy tick cooldown on the slot channel + slow),
`prism-beam.ts` (owned beams with an exact segment hit test).

### Enemy (`src/game/enemies/<name>.ts`)

```ts
export const eyepuff: EnemyDef = {
  id: "eyepuff", name: "Eyepuff", sprite: "en_eyepuff", hp: 20, speed: 30, dmg: 8, radius: 6, height: 12,
  xp: 2, shadow: 11, colors: [C.pink, C.pinkLight, C.white],
  update(e, w, dt) { keepAway(e, w, e.speed, 90); /* set e.vx/e.vy; shoot with w.spawnBullet(...) */ },
  onDeath(e, w) { /* optional */ },
  frame(e) { return e.state === 1 ? 3 : -1; },              // optional sprite frame override
};
export const enemies: EnemyDef[] = [eyepuff];
```

The director picks it up as soon as its id appears in a `timeline.ts` phase
mix (the 2:00+ phases already list `eyepuff`, `pumpkin`, `teddy`, `wisp`).
Elite variants, hit flash, squash, knockback, separation, death confetti
(`colors`), gems and HP scaling are all automatic. Telegraphs:
`w.telegraphCircle(...)` / `w.telegraphLine(...)`. Bullets: `shoot / ring / fan`
from `enemies/_bullets.ts` (they refuse to spawn within `SAFE_SPAWN` of the
player and use the small fair hitboxes); raw `w.spawnBullet(...)` only for
off-screen spawns (starfall). Cosmetic cues: `efx(w, EFX_*, x, y, dx, dy, power, e)`
from `enemies/_fx.ts` (and `shock(w, x, y, r, power)` for slam / flourish shockwaves; both reuse one payload); looks the generic drawer can't express go in
`view/bestiary-fx.ts decorate()` (keyed by def id, return true when it drew the
sprite itself). Scratch state: `e.state, e.timer, e.a, e.b, e.c, e.d`
(`frame()` should return a frame for every state so the art's special frames
never show up in the default loop). Reference files: `eyepuff.ts` (keep-away
shooter with a charge tell), `pumpkin.ts` (aimed-once dash with a lane
telegraph), `teddy.ts` (gait-synced stomps), `wisp.ts` (fuse + blast, chain
reactions through `w.explode`, contact damage disabled).

Bullet hygiene lives in `World`: `CFG.maxBullets` (400, extra shots are
dropped), culling `CFG.bulletCullMargin` px beyond the view, and
`w.clearBullets()` (bomb pickup, ultimate start, revive, boss phase changes)
which emits `bulletsCleared` first so the view can pop every bullet.

### Boss (`src/game/bosses/<name>.ts`)

An `EnemyDef` with `boss: { title, subtitle, music?, final? }`, exported as
`export const bosses = [...]`. `bosses/king-puff.ts` is the reference
(hop x3 -> telegraphed jump -> slam ring + shockwave + summons). The timeline
`boss` event (`{ at: 180, kind: "boss", enemy: "king_puff", spawnMul: 0.4 }`)
gives the 3 s WARNING, entrance from the top, name card, boss bar, music,
reduced spawns, slow-mo death sequence and golden chest. `final: true` makes
its death the victory (until a final boss is registered, surviving 10:00 wins).
Its death sets `w.finalBossDown`; if the player died earlier in that same step
the death plays out first and the director wins the run right after a revive
(a run can never continue without its final boss).
`w.director.enraged` turns true at 10:30 while the final boss lives.

Boss conventions (see `nightmare-teddy.ts`, `lady-lunatic.ts`): per-boss
scratch state in a module `WeakMap<Enemy, State>` reset in `init()` (exported
getter for the view / tests), `e.state` / `e.timer` as the pattern step, a
pattern cycle array, patterns only start while the boss is on screen, phase
changes set `e.inv` (hits are ignored while > 0), call `w.clearBullets()` and
emit `bossPhase { title, subtitle }` (banner, shockwave, duck in the view).
If an earlier boss is still alive when the next one arrives it flees
(`Director.spawnBoss`). A final boss's `onDeath` dissolves the remaining
enemies (`EFX_DAWN_POP`) before `World.win()`.

Import rule for content modules: never import a *value* from `world.ts`
(types only - use `CFG.playerCy` instead of `PLAYER_CY`). A runtime edge
content -> world -> registry -> content crashes whichever module is loaded
first ("Cannot access 'bosses' before initialization"); helpers the bot or the
view need (e.g. the moon ring) live in import-free `_*.ts` files.

### Director event (`src/game/director/`)

Data goes in `timeline.ts` (`EVENTS`), behaviour in `events.ts`:
`EVENT_HANDLERS.myEvent = (w, d, ev) => { ... }`. Use `d.addTask((dt) => stillRunning)`
for events that unfold over time (see `flood`, `batStorm`, `wispRush`). Emit
`waveIncoming` once for the HUD banner (kinds `swarm`, `encircle`, `storm`,
`wisps`, else "STAMPEDE!").

### Passive (`src/game/passives.ts`)

Append `{ id, name, icon, levels: [5 texts], apply(stats, level) }`. Stats are
recomputed from scratch (base -> hero -> meta -> passives). New stat? add it
to `Stats` in `stats.ts` (+ `baseStats`) and read it where needed.

### Ultimate (`src/game/ultimates/<name>.ts`)

`{ id, name, hero, desc, duration, start(w, u), update(w, u, dt), end?(w, u) }`
exported as `ultimates`. The hero table's `ult` field references the id. The
cut-in, invulnerability, meter and HUD are generic. Use `CH_ULT` for damage
channels, `w.timeStop` to freeze enemies, and emit custom events for visuals
(add them to `GameEvents` + a handler in `view/feedback.ts`).

### Hero (`src/game/heroes.ts`)

Add a `HeroDef` (sprites `${id}_idle|run|hurt|cast`, `portrait_${id}`), its
start weapon and ultimate. The select screen lists `HEROES` automatically.

---

## 5. Juice map (DESIGN §4 -> code)

| Event | Where |
| --- | --- |
| Enemy hit flash / squash / knockback | `World.hitEnemy` (flash, sqV, kx/ky) + `WorldView.drawEnemies` |
| Damage numbers, hit sparks, hit sfx (rate-limited, ±2 st) | `feedback.ts enemyHit` (per-frame budgets; a plain number per enemy at most every 0.22 s so 0.07 s beam ticks don't stack columns; boss damage summed into one number every 0.14 s and boss sparks every 0.05 s, so a boss soaking six weapons is never buried under its own numbers) |
| Death confetti in enemy colours, puff, ring, gem hop | `feedback.ts enemyKilled` -> `fxEnemyDeath(def.colors)`, `World.dropGem` arc |
| Elite death (shockwave, 30 particles, coins, hitstop 60) | `fxEliteDeath` |
| Player hurt package + low-HP heartbeat | `feedback.ts playerHurt`, `Feedback.frame` (damageFloor pulse), HUD `.danger` |
| Gem streaks + climbing pitch + XP shimmer | `WorldView.drawGems` (fx_streak), `feedback.ts gem` (chain pitch), HUD `xpPulse` |
| Level up (hitstop, rays, pillar, rings, flash, text, slow-mo 0.2x, modal) | `fxLevelUp` + `App.gameFrame` intro + `screens/levelup.ts` |
| Evolution (rainbow flash, hue cycle, banner, cast pose, fireworks) | `feedback.ts evolution` |
| Explosions (+ candy confetti for candy bombs) | `fxExplosion` via `explosion` events, `weapon-fx.ts` |
| Lightning (bell bolts, chains, Raijin blasts + drum flash), dome bursts, Sugar Nuke shockwave | `weapon-fx.ts` via `weaponFx` events |
| Dash (afterimages, dust, speed lines, zoom punch) | `WorldView.drawPlayer` (TrailEmitter), `feedback.ts dash` |
| Ultimate cut-in (dark, speed lines, portrait band, title, voice blips, blast) | `feedback.ts ultCutin/ultStart`, `ui/cutin.ts`, view darkening |
| Boss warning / name card / bar / death | `feedback.ts boss*`, HUD banners + bar; the name card sits on a dark plate with letterbox bars sliding in / out (`hud.ts banner("boss")`): under the boss bar on desktop / landscape (the boss enters from the left there), inside the top letterbox band in portrait (the boss enters top-centre right under the HUD, where a card under the boss bar would sit on it); the WARNING border follows `director.warning` and banner timers pause under modals; death throes (flashing, shaking silhouette) in `bestiary-fx.ts` |
| Run start: READY? (sim paused 0.6 s, cast pose, HUD fly-in) -> GO! stamp + shake | `App.beginIntro / introFrame`, `hud.ts intro`, `.hud.intro` / `.go-stamp` |
| Game over: portrait (greyed), "so close" line, RETRY (banks the run) / RESULTS | `screens/over.ts` |
| Chest payoff: reels land, then flip into level-up style cards; coins count up in the modal | `screens/chest.ts` (`levelup.ts cardHtml`) |
| Results: victory = battle-cry portrait, defeat = calm face greyed + sweat drop; S / A gold-rainbow grade + shine + burst | `screens/results.ts`, `.grade` |
| Telegraphs: eye charge glow, pumpkin shiver + red flash + dash lane (chevrons), wisp fuse blink + blast ring, claw-sweep circle | `bestiary-fx.ts decorate`, `WorldView.drawTelegraphs` |
| Stomps, skids, dust walls, roars, summons, teleports | `bestiary-fx.ts` via `enemyFx` events |
| Boss phase change (banner, flash, shockwave, speed lines, duck), enrage (WARNING banner, red grade + vignette) | `bestiary-fx.ts bossPhase / bossEnrage / applyGrade` |
| VICTORY: slow-mo chained explosions up the final boss, dawn flash at 1.7 s, enemies dissolve into light, "DAWN BREAKS!", sunrise grade sweep + sun + god rays, fireworks, victory music, results modal at 7.2 s | `bestiary-fx.ts finalDeath / victory / drawDawn`, `App.gameFrame` |
| Bullet clears pop every bullet into a sparkle | `bestiary-fx.ts bulletsCleared` |
| Combo counter, rank stamps (one-shot shine inside the glyph's gradient fill), SSS border (opacity crossfade), milestone blip every 25 (`comboUp`); the timer bar drains faster at high ranks (gold-pink from S), a rank drop replays the letter falling in + a red flinch on the counter + a soft high `comboBreak` | `hud.ts` (WAAPI), `feedback.ts enemyKilled / comboDrop` |
| Peak-chaos readability: adaptive bloom limiter (`r.post.load` from the glow-instance count), fewer sparks / puffs / numbers, fainter + smaller enemy numbers (a screen with 40+ enemy bullets counts as busy too), hero beacon (faint silhouette + ring above player fx, under bullets; also forced on for ~0.5 s when an explosion / Raijin blast lands on the hero, `WorldView.coverHero`), small player shots fade within 16 px of the hero's body (Galaxy Barrage streams spawn there); the beacon redraws the hero's current frame translucent (its plum outline reads over white blasts and pink star clouds), and the live boss gets the same treatment (boss beacon) so it never vanishes under six evolutions | `render/post.ts feedGlow`, `feedback.ts frame()`, `fx/damage.ts busy`, `WorldView.drawHeroBeacon / drawBossBeacon / drawProjectiles` |
| HUD banners while a boss is alive drop below the hero and shrink (`.banner.low`): Lady Lunatic fights from the upper half, so ENRAGED! / ELITE! / EVOLUTION! never cover her or her bullets | `hud.ts banner()`, `styles.css` |
| Enemy bullets (`enemyShoot` sfx, rate-limited; pop-in flash, end-of-life fade, moons rotate along velocity) | `World.spawnBullet` emits `enemyShoot` (one reused payload), `WorldView.drawBullets` |
| Elite / boss aura | `WorldView.drawEnemies`: 4 one-pixel offset tinted silhouettes (no `Glow` flag) + soft halo |
| Hero behind a tree | `Ground.draw(time, px, py)` fades that canopy |
| Ambient petals / motes / fireflies, day -> dusk -> night grade | `Feedback.frame` |

---

## 6. Balance (full-run pacing pass)

### The probe

`npm run balance` (`tools/balance.probe.ts`) plays full headless runs (default
12:00, so a slow final-boss kill after the 10:30 enrage still resolves) for every
hero x seed with two bot profiles and prints one line per run plus a summary per
hero / profile (medians and [min-max]):

- **good** = the autoplay bot, the *average-player proxy*: steers away from
  pressure (big hitters weigh more), reads telegraphs (jump circles, dash lanes,
  claw sweeps) and dodges bullets with a 0.18 s reaction time, dashes out of
  crowds, breaks lanterns for food, chases a boss into its weapon range while
  above 45 % HP, picks weapons / damage passives / evolutions first.
- **lazy** = the *weak-player proxy*: the same movement, but random level-up
  picks and it never dashes (`Bot.randomPicks`, `Bot.noDash`).

Env: `HEROES=rin`, `SEEDS=1,2,3`, `T=600`, `BOT=good|lazy|both`, `META=mid|max`
(Dream Shop ranks), `MAXE=150|250|350` (device enemy cap), `VIEW=phone|land|desktop`,
`DT=0.0167` (the live game sub-steps at 1/60; the probe defaults to 1/30, which
gives the same results within noise), `VERBOSE=1` (30 s timeline, build, alive %
of cap, damage taken by source per run). The summary reports: win rate + death
times + final blows, first level-up, level at 1/3/6/9 min (runs still alive),
XP earned and the share of gem XP actually collected, the level-up interval
between 2:00 and 8:00, first evolution, boss kill times, damage taken (total,
last 4 minutes, per minute, min HP after 6:00), kills/s and damage dealt/s per
minute, adaptive toughness per minute, alive % of the cap, time at SSS / S+
per minute, combo breaks, Overdrive count / interval, and damage taken by source.

With 16 seeds a per-hero win rate still has a standard error of ~11 points:
judge changes on all heroes together (48 runs) and re-run before trusting a
small shift. Every change re-rolls the seeds' RNG streams.

### Results (16 seeds x 3 heroes x 2 bots, 12:00, no Dream Shop)

| Target | Good bot (Hoshi / Rin / Mochi) | Lazy bot |
| --- | --- | --- |
| first level-up 3-8 s | 3.0 / 4.3 / 3.4 s | same |
| level ~12-16 at 3:00 | 18 / 16 / 16 | 16 / 16 / 15 |
| level ~28-36 at 6:00 | 38 / 31 / 35 | 28 / 30 / 31 |
| level ~45-55 at 9:00 | 48 / 48 / 52 | 46 / 43 / 49 |
| level-up every ~8-14 s (2:00-8:00, median gap) | 11.9 / 9.3 / 9.9 s | 13.7 / 10.9 / 12.4 s |
| an evolution by ~5:00 | first at 2:39 / 2:26 / 3:15 (median), 4-5 per run | first at 3:27-4:09, 0-2 per run |
| King Puff 20-45 s | 13 / 27 / 38 s | 43 / 36 / 52 s |
| Nightmare Teddy 40-80 s | 35 / 49 / 58 s | 29 / 73 / 107 s |
| Lady Lunatic 70-140 s | 89 / 49 / 109 s | 58 / 100 / 131 s |
| good bot wins 60-90 % | **81 / 81 / 75 % (79 %)** | 25 / 44 / 25 % (31 %) |
| lazy bot usually dies 5:00-9:30 | - | 33 of 48 die, median 6:03, 85 % of the deaths between 4:30 and 9:00 |
| meaningful damage in the last 4 min | 76 / 47 / 49 HP median (up to 310-420), min HP after 6:00 ~75-85 % | 148 / 204 / 177 HP |
| SSS not permanent from minute 1 | SSS 0 % in min 1-2, 0-29 % in min 3, 3-67 % in min 4, 70-100 % late | SSS rare before 7:00 |
| Overdrive every 45-70 s | every 53-55 s (10-11 per run, the first ~1:00) | every 53-56 s |
| enemy count at the cap after ~5:00 | 50-63 % of the cap at 6:30-9:00 (90 % reached in waves) | 55-73 % |

Variants (8 seeds, good / lazy win rate): **mid Dream Shop** (every rank at
half) 79 % / 42 %; **maxed shop** 96 % / 58 % (the good bot then takes only
5-25 damage in the last 4 minutes): the shop is a real crutch for a weaker
player without making a run free. **Low-tier device** (cap 150; those fewer
enemies get x1.3 HP late) 88 % good, 62-79 % of the cap late. **Desktop view**
(533x300) 75 % good. **1/60 steps** (the live sub-step) 78 % good (6 seeds), same
levels and boss times as 1/30. Sim cost: 0.7-3.8 s per 12-minute run.

The deliberate deviations: Hoshi (ranged, homing stars focus bosses) kills King
Puff / Nightmare Teddy faster than the window and levels a little faster; Rin
melts Lady faster than the others; the median build keeps the screen at
50-60 % of the cap rather than at it (the adaptive toughness converts a too-fast
clear into tougher, not more, enemies - more spawns made the median build lose).

### How the pacing works (numbers in `config.ts`, `director/*`, content files)

- **XP**: `xpToNext(L) = 5 + 10(L-1) + 28(L-6)+ - 26(L-12)+ + 60(L-22)+ + 60(L-38)+`
  (cost per level +10 to Lv 6, +38 to Lv 12, +12 to Lv 22, +72, then +132 from Lv 38).
  Gem XP x `(1 + 0.15 max(0, m - 3))` (m = minutes). Above 160 gems the farthest
  merge into a rainbow gem_4 that drifts to the player (28 px/s): uncollected XP
  is recovered, which mostly helps struggling builds (the bot collects 70-80 % of
  the gem XP, a lazy bot 40-75 %). Every level-up heals 3 % max HP.
- **Combo**: per-rank window `[2.5, 2.5, 2.3, 2.0, 1.7, 1.45, 1.2]` s and refill
  per kill `[2.5, 2.5, 2.3, 0.3, 0.15, 0.08, 0.04]` s (none, C ... SSS): holding
  A / S / SS / SSS needs ~3 / 7 / 13 / 25 kills/s. Running dry at B+ drops one
  rank (`comboDrop`), below B it breaks; a hit drops one rank.
- **Overdrive**: starts at 25; +0.3 per kill but at most 1.25/s from ordinary
  kills (a budget refilled per second), +8 elite, +30 boss, +0.55/s passive.
  Before: +1 per kill made it every 9-15 s (a near-permanent invulnerable
  screen clear that hid every other balance problem).
- **Enemies**: HP x `(1 + 0.1m + 0.01m² + 0.014m³)` (x1.7 at 3:00, x4.6 at
  6:00, x12 at 9:00), contact / shot damage x `(1 + 0.06 max(0, m - 4))`.
  Lowered contact damage: Puff 5, Boo 6, Shroomie 8, Teddy 11, Pumpkin 10. Hurt
  i-frames 0.5 s, lanterns every ~16 s.
- **Director**: spawn rates / caps per phase in `timeline.ts` (1.3 -> 2.7/s cap
  55 in minute 1, up to 20 -> 30/s cap 260 from 6:30). Below 80 % of the cap
  (`MIN_ALIVE`) the rate is boosted up to x4. **Adaptive toughness**
  (`Director.adapt`, from 3:30): while fewer than 55 % of the cap are alive, new
  spawns gain HP (+3 %/s at an empty screen, max +150 %), relaxing at 2 %/s once
  the screen is busy; `Director.hpMul` also gives a device capped below the phase
  max x sqrt(max / cap) HP (<= x1.4). Boss spawn multipliers: King Puff x0.55,
  Nightmare Teddy x0.4, Lady Lunatic x0.4.
- **Bosses**: HP x `clamp(1 + 0.035 (level - ref), 0.5, 1.8)` at spawn
  (`BossInfo.level`): King Puff 2600 @ Lv 17, Nightmare Teddy 17500 @ Lv 33, Lady
  Lunatic 34000 @ Lv 52. Lady's bullets deal 15, Teddy's stars 13.
- **Weapons** (`GAUGE=1 npm run balance`: dps alone vs a dense crowd of 120
  respawning 60-HP puffs, a ring of 300-HP enemies and a pinned boss): Star Shot fires 2+ stars
  that pierce 2-4 (L5 ~600 dps; it is the single-target / boss weapon), Thunder
  Bell L1-4 got a spark blast and more chains (L1 61 -> 356 dps), Galaxy Barrage
  553 -> 1.4k dense (3 arms, pierce 3), Yarn Orbit bonks faster from Lv3 (0.34 / 0.28 s)
  and Cosmic Yarn hits for 19 every 0.26 s (Mochi's boss fights were 2x longer
  than anyone's), Sakura Tempest's petal blades fan toward the nearest enemy (a
  boss first) and curve in. Other base weapons sit at L1 ~370-980, L5 ~2-4k,
  evolutions ~3.1-5.8k dense (Galaxy Barrage 1.4k dense but ~450 on a boss,
  3-10x anyone else).
- **Heroes**: Mochi gained 1 armor (melee, 100 HP: the lazy Mochi used to die
  before 4:00). **Dream Shop**: Might +4 %/rank, Vitality +8 HP/rank.

### Before / after (bot, same probe)

| | Before (content merged, no tuning) | After |
| --- | --- | --- |
| good bot wins | 50-88 % per hero, damage taken over a whole run 4-250 (median 60-90) | 75-81 %, 76 / 47 / 49 in the last 4 min alone |
| lazy bot | wins 50-63 %, deaths 2:33-6:52 rare | wins 31 %, dies ~6:00 (4:30-9:00) |
| Overdrive | every 9-15 s (37-62 per run) | every 53-55 s (10-11) |
| SSS | 100 % of the time from 2:00 on, one combo per run | earned: 0 % before 2:00, flickers mid-game, drops on hits |
| levels at 3:00 / 6:00 / 9:00 | 16-19 / 29-33 / 43-47 | 16-18 / 31-38 / 48-52 |
| King Puff / Teddy / Lady | 10-16 s / 26-50 s / 47-91 s | 13-38 s / 35-58 s / 49-109 s |
| alive % of cap after 5:00 | 7-21 % | 50-63 % |

Verification-pass re-check (after the content wave's integration fixes: coin merge, Nightmare Teddy
standing off from the hero by body centre, Lady Lunatic favouring the left in landscape, candy bombs
avoiding the hero's feet), 8 seeds x 3 heroes: good bot 83 % (Hoshi 100 / Rin 88 / Mochi 63), lazy
bot 38 %, levels 18 / 36 / 50 at 3:00 / 6:00 / 9:00, King Puff 23 s, Nightmare Teddy 29 s (34 s
with the old walk on the same 10 seeds), Lady Lunatic 72 s: inside the noise of the table above.

### Readability at peak chaos (view)

`r.post.load` (adaptive bloom limiter, see ENGINE.md) measures the glow load;
at load 1 bloom drops to 40 %, the feedback bridge halves its hit-spark / death
puff budgets, cuts the damage-number budget by 60 % and its soft / hard caps
(70 / 110 alive -> ~32 / 55; past the soft cap only crits and boss hits pop),
enemy numbers fade 40 % and crits shrink and stop blooming, and the hero gets a
faint silhouette + ring drawn above the player's own weapon fx (under enemy
bullets). `scripts/peak.mjs` shoots a 6-evolution crowd and late autoplay
runs with the limiter on and off (`node scripts/peak.mjs`, shots in `shots/peak/`).

## 7. Ownership boundaries

| Area | Files | Rule |
| --- | --- | --- |
| Contracts (frozen) | `art/palette.ts format.ts manifest.ts sprites/index.ts`, `audio/api.ts` | never edit |
| Art | `src/art/sprites/*.ts` | art agents; game code references sprites by manifest id only |
| Audio | `src/audio/*` | audio agent; game calls only `audio.*` from `src/audio/index.ts` |
| Engine | `src/core`, `src/render`, `src/fx` | keep APIs coherent, document in ENGINE.md |
| Simulation | `src/game/**` | pure; content = new files in the registry folders |
| View / UI | `src/view/**`, `src/ui/**`, `src/main.ts`, `index.html`, `src/render/quality.ts` | |
| Debug / tests | `src/debug/**`, `tests/**`, `scripts/e2e.mjs`, `scripts/icons.mjs` | |

Parallel content work: one agent per new file in `weapons/`, `enemies/`,
`bosses/`, `ultimates/`. Shared files that need a line or two:
`director/timeline.ts` (tuning), `view/trails.ts` (new trail looks),
`game/events.ts` + `view/feedback.ts` (new event types).

---

## 8. Verification

```
npm run typecheck
npm test                       # unit + headless bot runs (all heroes), bosses, ults, determinism, run integrity,
                               # AutoQuality / save validation / fmtNum (tests/quality.test.ts)
                               # (--testTimeout=60000: the full-run sims take 5-9 s on a loaded / CI machine)
node scripts/e2e.mjs           # desktop + mobile portrait + mobile landscape, screenshots in shots/e2e/
node scripts/shot.mjs --path "/?autoplay=1&hero=rin&skip=150" --mobile --wait 5000 --out shots/x.png
npm run balance                # headless full-run balance probe: 3 heroes x 10 seeds x good + lazy bot (section 6)
npm run build && npm run build:single   # dist/ (Pages) and dist-single/index.html (standalone, works from file://)
```

Headless Chromium renders with SwiftShader at ~5 fps; the loop clamps dt to
1/20 s, so CSS-free timers that run on frame time (feedback `after()`, modal
tap guards, results counters) advance ~4x slower than wall time in screenshots.
Wait on game state (`__kk.*`) rather than fixed sleeps in scripts. On a shared,
loaded machine rAF can drop to a few frames per second: for frame-exact checks,
stop the loop (`__kk.app.loop.stop()`) and drive `__kk.app.frame(1 / 60)` by hand
(see `shots/fix-b/throttle.mjs`, `feel-go.mjs`, `death-check.mjs`).

UI flow / platform regression scripts (Playwright, scratch, `shots/fix-b/`):
`cutin-modal.mjs` / `cutin-quit.mjs` (cut-in vs modals), `history.mjs` (Android Back),
`gamepad.mjs` / `focus.mjs` / `kbnav.mjs` (pause + menu input routing), `save-boot.mjs`
(broken saves), `warn-modal.mjs`, `ctxloss.mjs`, `throttle.mjs` (modal draw rate),
`wake-fs.mjs` (wake lock + fullscreen), `touch-tut.mjs` (onboarding), `chest-check.mjs`,
`death-check.mjs`, `intro-check.mjs`, `results-shots.mjs`, `anims.mjs` (running CSS
animations during play), `perf-*.mjs` (production build in `shots/fix-b/dist`).

Handy URLs: `/?screen=title`, `/?screen=select`, `/?autoplay=1&skip=185&god=1`
(boss), `/?fps=1`, `/?seed=42&hero=mochi`. Console: `__kk.levelUp()`,
`__kk.chest(true)`, `__kk.ult()`, `__kk.spawn("shroomie!", 3)`, `__kk.skipTo(170)`,
`__kk.clearWeapons(); __kk.give("rainbow_cannon")` (isolate a weapon), `__kk.give("twin_charm", 3)`,
`__kk.time.paused = true` (freeze sim + fx for a mid-action screenshot),
`__kk.boss("lady_lunatic")` (boss now; `true` = with the WARNING), `__kk.bossHp(0.2)` (jump to a phase),
`__kk.enrage()`. Boss screenshots: `/?screen=game&hero=rin&god=1&skip=355` (no autoplay: the hero stands
still, the boss comes to it), then `__kk.clearWeapons()` and `__kk.world.director.spawnMul = 0`.
