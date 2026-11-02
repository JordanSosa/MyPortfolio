# Architecture (Kira Kira Overdrive)

Read with `docs/DESIGN.md` (what the game is) and `docs/ENGINE.md` (renderer,
fx, input, time APIs). This file explains how the game code is put together
and how to add content without touching other people's files.

---

## 1. Module map

```
src/
  main.ts              boot: fonts (@fontsource), styles, App, window.__kk hooks
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
    weapons/*.ts       one file per weapon (+ its evolution); `_shared.ts` helpers
    enemies/*.ts       one file per enemy behaviour (props too); `_steer.ts` helpers
    bosses/*.ts        one file per boss
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

  ui/                  DOM: app state machine, HUD, screens, modals, save
    app.ts             App: loop, screens, modals, level-up / chest / game-over flow, settings
    session.ts         Session = World + WorldView + Feedback (real run or attract mode)
    hud.ts             HUD (XP, level, timer, kills/coins, icons, combo, boss bar, banners)
    cutin.ts           ultimate anime cut-in overlay
    nav.ts             keyboard / gamepad menu navigation (spatial focus)
    save.ts            persisted save (kko.save.v1)
    dom.ts             tiny DOM helpers (atlas sprite -> <img>)
    styles.css         all UI styles (palette CSS variables)
    screens/*.ts       splash, title, select, levelup, chest, pause, settings, over, results, shop

  debug/
    bot.ts             autoplay bot + `simulate()` headless runner (PURE; used by tests, ?autoplay, ?skip, attract)
    params.ts          URL params (?autoplay ?seed ?hero ?skip ?god ?mute ?quality ?screen ?fps ?speed)
    hooks.ts           window.__kk (skipTo, spawn, giveXp, levelUp, chest, ult, pause, endRun, stats ...)
    fps.ts             FPS meter

tests/                 vitest: core math, xp/cards/chests/meta, headless 3-minute bot runs, boss, ults
scripts/e2e.mjs        Playwright e2e: desktop / mobile portrait / mobile landscape, screenshots, fails on errors
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
  r.beginFrame -> view.draw -> fx.update/draw -> r.endFrame
  hud.update(world)
```

Modals set `time.paused` (the sim stops, ambient fx keep animating), hide the
touch controls, mark held fingers stale, remove the onboarding hint and muffle
the music (except the game-over / victory modal, whose jingle stays clear). The
ultimate cut-in is handled *inside* the sim (`world.ult.phase === "cutin"`
pauses the world for `CFG.cutinTime` while particles keep running); the view
darkens the frame through `r.post.dim` meanwhile.

### Music per state

| State | Track | Where |
| --- | --- | --- |
| splash (before the unlock gesture) | none | `App.unlockAudio` picks the track for the current screen |
| title / select / settings | `title` | `App.goTitle / goSelect` |
| Dream Shop | `shop` | `App.goShop` |
| run | `battle` + `setIntensity(enemies, combo rank, boss)` | `App.startRun`, `Feedback.frame` |
| boss alive | `def.boss.music` (`boss` / `final`) | `feedback.ts bossSpawn`; back to `battle` 2 s after a non-final boss dies; `App.revived` restores the right one |
| level-up / chest / pause | (muffled) | `App.openModal` |
| death | duck, then `gameover` with the DREAM OVER modal | `feedback.ts playerDied`, `App.gameFrame` |
| victory | `victory` starts with the "DAWN BREAKS!" event | `feedback.ts victory` |
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
| combat | `enemyHit`, `enemyKilled`, `propBroken`, `eliteSpawned`, `explosion`, `weaponFire`, `enemyShoot`, `telegraph`, `shockwave` |
| player | `playerHurt`, `playerHeal`, `playerDied`, `playerRevived`, `dash`, `dashReady` |
| progression | `levelUp`, `upgradeApplied`, `evolution` |
| pickups | `gem`, `coin`, `pickup`, `chestDropped`, `chestCollected`, `chestOpened`, `magnet`, `bomb`, `freeze` |
| combo / ult | `comboRank`, `comboBreak`, `ultReady`, `ultCutin`, `ultStart`, `ultEnd`, `ultSlash`, `ultBurst`, `ultMeow` |
| director | `waveIncoming`, `bossWarning`, `bossSpawn`, `bossKilled`, `bossEnrage` |
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
`w.telegraphCircle(...)` / `w.telegraphLine(...)`. Bullets: `w.spawnBullet(...)`.
Scratch state: `e.state, e.timer, e.a, e.b, e.c, e.d`.

### Boss (`src/game/bosses/<name>.ts`)

An `EnemyDef` with `boss: { title, subtitle, music?, final? }`, exported as
`export const bosses = [...]`. `bosses/king-puff.ts` is the reference
(hop x3 -> telegraphed jump -> slam ring + shockwave + summons). The timeline
`boss` event (`{ at: 180, kind: "boss", enemy: "king_puff", spawnMul: 0.4 }`)
gives the 3 s WARNING, entrance from the top, name card, boss bar, music,
reduced spawns, slow-mo death sequence and golden chest. `final: true` makes
its death the victory (until a final boss is registered, surviving 10:00 wins).
`w.director.enraged` turns true at 10:30 while the final boss lives.

### Director event (`src/game/director/`)

Data goes in `timeline.ts` (`EVENTS`), behaviour in `events.ts`:
`EVENT_HANDLERS.myEvent = (w, d, ev) => { ... }`. Use `d.addTask((dt) => stillRunning)`
for events that unfold over time (see `flood`). Emit `waveIncoming` for the HUD banner.

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
| Damage numbers, hit sparks, hit sfx (rate-limited, ±2 st) | `feedback.ts enemyHit` (per-frame budgets) |
| Death confetti in enemy colours, puff, ring, gem hop | `feedback.ts enemyKilled` -> `fxEnemyDeath(def.colors)`, `World.dropGem` arc |
| Elite death (shockwave, 30 particles, coins, hitstop 60) | `fxEliteDeath` |
| Player hurt package + low-HP heartbeat | `feedback.ts playerHurt`, `Feedback.frame` (damageFloor pulse), HUD `.danger` |
| Gem streaks + climbing pitch + XP shimmer | `WorldView.drawGems` (fx_streak), `feedback.ts gem` (chain pitch), HUD `xpPulse` |
| Level up (hitstop, rays, pillar, rings, flash, text, slow-mo 0.2x, modal) | `fxLevelUp` + `App.gameFrame` intro + `screens/levelup.ts` |
| Evolution (rainbow flash, hue cycle, banner, cast pose, fireworks) | `feedback.ts evolution` |
| Explosions, lightning-ready | `fxExplosion` via `explosion` events |
| Dash (afterimages, dust, speed lines, zoom punch) | `WorldView.drawPlayer` (TrailEmitter), `feedback.ts dash` |
| Ultimate cut-in (dark, speed lines, portrait band, title, voice blips, blast) | `feedback.ts ultCutin/ultStart`, `ui/cutin.ts`, view darkening |
| Boss warning / name card / bar / death | `feedback.ts boss*`, HUD banners + bar |
| Combo counter, rank stamps, SSS border, milestone blip every 25 (`comboUp`) | `hud.ts`, `feedback.ts enemyKilled` |
| Enemy bullets (`enemyShoot` sfx, rate-limited) | `World.spawnBullet` emits `enemyShoot` (one reused payload) |
| Elite / boss aura | `WorldView.drawEnemies`: 4 one-pixel offset tinted silhouettes (no `Glow` flag) + soft halo |
| Hero behind a tree | `Ground.draw(time, px, py)` fades that canopy |
| Ambient petals / motes / fireflies, day -> dusk -> night grade | `Feedback.frame` |

---

## 6. Balance (tuned in the integration pass)

`npm run balance` (`tools/balance.probe.ts`, env `HEROES`, `SEEDS`, `T`) runs the
bot headless for every hero x seed and prints the level / kill / damage / boss
timeline. The numbers below come from it (6-10 seeds per hero, 5 min):

- XP curve `xpToNext(L) = 5 + (L-1)*10 + max(0,L-6)*8 + max(0,L-15)*12 + max(0,L-25)*16`
  (`config.ts`). First level-up 2-7 s, about level 6-8 at 1:00, 12-16 at 3:00,
  then roughly one level-up every 9-12 s (a good build keeps the x2 SSS combo
  multiplier alive for minutes, so the curve has to be steep).
- Enemy HP `enemyHpScale(t) = 1 + m*0.22 + m²*0.035` (m = minutes; `config.ts`).
- Yarn Orbit Lv1-5 damage/uptime raised (Mochi used to die around 2:30 in 2 of 6 seeds).
- Only 3 weapons and 4 enemy types exist so far, so runs are still easy (the bot
  takes ~20-150 damage in 5 minutes). Re-tune `timeline.ts` rates/caps and the
  curve once the remaining weapons, enemies and bosses land.

## 7. Ownership boundaries

| Area | Files | Rule |
| --- | --- | --- |
| Contracts (frozen) | `art/palette.ts format.ts manifest.ts sprites/index.ts`, `audio/api.ts` | never edit |
| Art | `src/art/sprites/*.ts` | art agents; game code references sprites by manifest id only |
| Audio | `src/audio/*` | audio agent; game calls only `audio.*` from `src/audio/index.ts` |
| Engine | `src/core`, `src/render`, `src/fx` | keep APIs coherent, document in ENGINE.md |
| Simulation | `src/game/**` | pure; content = new files in the registry folders |
| View / UI | `src/view/**`, `src/ui/**`, `src/main.ts`, `index.html` | |
| Debug / tests | `src/debug/**`, `tests/**`, `scripts/e2e.mjs`, `scripts/icons.mjs` | |

Parallel content work: one agent per new file in `weapons/`, `enemies/`,
`bosses/`, `ultimates/`. Shared files that need a line or two:
`director/timeline.ts` (tuning), `view/trails.ts` (new trail looks),
`game/events.ts` + `view/feedback.ts` (new event types).

---

## 8. Verification

```
npm run typecheck
npm test                       # unit + headless 3-minute bot runs (all heroes), boss, ults, determinism
node scripts/e2e.mjs           # desktop + mobile portrait + mobile landscape, screenshots in shots/e2e/
node scripts/shot.mjs --path "/?autoplay=1&hero=rin&skip=150" --mobile --wait 5000 --out shots/x.png
npm run balance                # headless bot balance probe (level / kills / damage / boss timeline)
npm run build && npm run build:single   # dist/ (Pages) and dist-single/index.html (standalone, works from file://)
```

Headless Chromium renders with SwiftShader at ~5 fps; the loop clamps dt to
1/20 s, so CSS-free timers that run on frame time (feedback `after()`, modal
tap guards, results counters) advance ~4x slower than wall time in screenshots.
Wait on game state (`__kk.*`) rather than fixed sleeps in scripts.

Handy URLs: `/?screen=title`, `/?screen=select`, `/?autoplay=1&skip=185&god=1`
(boss), `/?fps=1`, `/?seed=42&hero=mochi`. Console: `__kk.levelUp()`,
`__kk.chest(true)`, `__kk.ult()`, `__kk.spawn("shroomie!", 3)`, `__kk.skipTo(170)`.
