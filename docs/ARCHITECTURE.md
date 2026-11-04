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
    world.ts           World: entities, step(dt), combat, pickups, xp, build, ult, combo, chests; takes a RunConfig
                       (stage, endless, twists, mods, pools, Limit Breaks, relics, talents, constellation, start
                       bonuses, slots, flags), banish / skip, dash charges, shields, Plot Armor, the Filler Arc
    run-config.ts      CONTRACT with src/meta: RunConfig (+ RUN_FLAGS keys) in, RunStats out (World.summary().stats)
    defs.ts            CONTRACT: RelicDef, TalentTree / TalentNode (+ TALENT_TIER_POINTS), TwistDef, StageInfo,
                       ConstellationDef, Rarity
    stage.ts           StageDef (timeline, opening, props, final boss, endless, tiles / deco / grade / ambient /
                       music / victory, hooks) + stageInfo / stageBosses / stagePhaseAt helpers
    hooks.ts           gameplay hook toolkit: SimHooks payload types for `world.hooks` (never muted), Buff,
                       onDashThrough (shared per-dash sweep)
    run-stats.ts       RunStatsCollector (hooks -> RunStats counters, finish() at summary time)
    types.ts           entity + content definition types (Enemy, Projectile, WeaponDef, EnemyDef, ...)
    events.ts          GameEvents (typed bus payloads)
    config.ts          DESIGN numbers (CFG), xpToNext, combo RANKS, damage channels (8 weapon slots, CH_ULT,
                       CH_MISC, CH_RELIC)
    stats.ts           Stats block + modifier chain (pipeline order in the header)
    heroes.ts          hero table (stats trait, start weapon, ult, constellations C1-C6)
    passives.ts        passive table (16 passives x 5 levels: the slice's 8 + Season 2's 8, locked until unlocked;
                       `install(w, inst)` for run-state effects such as Friendship Bracelet's per-weapon statMod)
    meta.ts            legacy Dream Shop ranks (WorldOptions.meta; tests / balance probe)
    upgrades.ts        level-up card generation / application (pools, banish, Limit Break cards, Light Novel
                       titles), chest rewards (chest luck)
    evo-hints.ts       evolution hints for the level-up / chest cards and the pause list: a known recipe's state
                       (ready / have / missing / blocked), pair-completing and READY-making picks; `evolution`
                       normalised to a list (several evolutions per weapon); the known rule comes in as input
    registry.ts        auto-registry (import.meta.glob) of weapons / enemies / bosses / ultimates / stages /
                       relics / talent trees / twists (+ registerStage for tests / tools, twistHeat, stageInfos)
    stages/*.ts        one file per stage (dream-meadow.ts = the original slice, timeline included); candy-kingdom.ts
                       (stage 2: the pinata's coins + gumdrop snack in onStart), shoujo-academy.ts (stage 3: the
                       vending machine's chilled can in onStart); beach-episode.ts
                       (stage 4: the cooler's chilled onigiri in onStart), final-arc.ts (stage 5: Truck-kun's evil
                       name card in onStart, Cancel-sama's restoration in onFinalBossKilled)
    relics/*.ts        one file per rarity (n, r, sr, ssr, ur, lr, mythic); `_util.ts` (proc, atStar, dirtyOn),
                       `_friend.ts` (A Real Friend: the ally + its sandboxed weapon instance)
    nani.ts            NANI?! pop rules (satire.md §5), installed by the RunStats collector (RunStats.nanis)
    talents/*.ts       one tree per hero (hoshi, rin, mochi); `_node.ts` helpers
    twists/*.ts        Plot Twist groups (production, story, broadcast); `_twist.ts` helpers
    weapons/*.ts       one file per weapon (+ its evolution); `_shared.ts` helpers, `_fx.ts` (weaponFx kinds,
                       reused-payload emit helpers, random on-screen targets, `heroFx()`: THE heroFx emitter every
                       Season 2 group shares - `_heroes-a.ts` / `_hb.ts` re-export it as `hfx`, `_arsenal2.ts`
                       wraps it as `a2fx`); `_arsenal2.ts` (the general Season 2
                       weapons: "a2_*" heroFx cues, the stage beat clock from StageDef.bpm, the combo-rank crowd bonus)
    enemies/*.ts       one file per enemy behaviour (props too); `_steer.ts` helpers, `_bullets.ts` (fair
                       shoot / ring / fan helpers: never spawn on the player), `_fx.ts` (enemyFx kinds + emit helper);
                       `_s45.ts` (Beach Episode / Final Arc: enemyFx cue kinds 400-499 + the hero's environment - slow
                       zones and pulls applied by one `step` hook per world); props-s45.ts (beach ball, cooler,
                       clapperboard, CRT TV); stage 4 crab-kun, seagull, jellyfish, watermelon (+ half),
                       sandcastle-golem, tiny-shark; stage 5 shadow-clone, filler-goon, plot-hole, animation-error
                       (+ dropped frames), mini-truck (`launchMiniTruck` for Truck-kun's RUSH HOUR);
                       `_say.ts` (`say(w, e, text)`: the `enemySay` speech-bubble event), `_cue.ts` (`cue()`: the
                       string-kinded `stageCue` event); `_candy.ts` (Candy Kingdom: Shield Wall dmgTaken rule, Toasty
                       hit hook, S'more puddles, "candy_*" cue kinds), `_academy.ts` (Shoujo Academy: dash watch, the
                       Tsundere hit hook, homing paper hearts, F- stacks as a statMod, ninja decoys, "academy_*" cues);
                       candy-props.ts / academy-props.ts; stage 2 gummy-bear, candy-corn, donut-roller, marshmallow-brute,
                       lollipop-mage; stage 3 hall-monitor (`monitorWhistle`, the schoolBell's target), love-letter,
                       tsundere-slime, transfer-student, exam-paper, council-ninja
    bosses/*.ts        one file per boss (king-puff, nightmare-teddy, lady-lunatic); `_luna.ts` (Lady Lunatic
                       state + moon-ring geometry, import-cycle free for the bot / view); `_dawn.ts` (`dawnOut`: the
                       victory dawn every final boss shares - bullets cleared, on-screen enemies dissolve in light);
                       `_s45boss.ts` (stage 4 / 5 boss kit: readable(), phaseFlourish(), finalDawn (= `_dawn.ts`),
                       tinted shot / ring / fan, heroInLane, stageFx());
                       kraken-chan, firework-dragon, truck-kun, rival-chan, cancel-sama (state getters for view / tests);
                       `_s23.ts` (stage 2 / 3 boss kit: hoverAnchor + catch-up glide, lineAcross, the telegraphed
                       Rain queue, dawnOut, segDist); gingerbread-golem, sugar-plum-tyrant, council-president (+ the
                       School Regulation rules: `activeRule(w)`), bishounen
    ultimates/*.ts     one file per hero ultimate
    director/
      timeline.ts      SpawnPhase / TimelineEvent types + Dream Meadow compat exports (the data lives in stages/)
      events.ts        event-kind handlers (swarmLine, batStorm, wispRush, encircle, flood, elite, boss); more kinds
                       merged from `events-*.ts` (`eventHandlers` export): events-s45.ts = tideSweep (`tideBands`),
                       commercialBreak (`commercialOf`), flashback (`isFlashback`); events-s2.ts is spread in directly:
                       laneCharge (lanes telegraphed before AND while their column crosses), teleportIn, bulletRain
                       (ground shadows on the player's row), schoolBell
      director.ts      stage-driven spawning, props, boss warning/entrance, run end, Filler Arc waves / rematches

  view/                draws the world with the renderer (reads the World, never mutates it)
    world-view.ts      enemies (+ per-enemy skins / tints), hero (+ dash charge pips, shield bubble), projectiles,
                       bullets, gems, pickups (+ relic hearts, censored coins), telegraphs, overlays
    ground.ts          stage-driven infinite ground: tile region rules + scatter / tall deco (stable per-cell hashing)
    stage-view.ts      StageLook: grade + ambient keyframes, extra ambient layers, clear colour, stage music ids,
                       sim `stageFx` directives (grade override + DIRECTIVE_GRADES "ratings", render scale = the scene
                       FBO's `Renderer.sceneScale` (ENGINE.md §9), anim fps cap, particles, speed lines, stills;
                       "Reduce flashing" drops the degrading ones)
    s45-fx.ts          Beach Episode + The Final Arc looks (one WorldView field / Feedback bind): beach-fx.ts (crabs facing
                       the hero, seagull loot + dive tells, jelly zaps + chain bolts, shark fins, sand-pile rebuild rings,
                       tide bands, Kraken-chan's tentacles / ink / HIGH TIDE water, the lantern dragon body + rockets,
                       the crab-hug death scene), finale-fx.ts (sepia flashbacks, clone eyes, off-model Animation
                       Errors, headlight tells, the evil moustached Truck-kun, Rival-chan's headband / aura / push-ups /
                       beams, Cancel stamps + CANCELLED decals, the ratings chart, letterbox eyecatches, still-frame
                       borders, EPISODE ENDS IN 60 / OVERTIME, the reduce-flashing phase badge, death scenes, the
                       cancel theme's setDegrade), s45-common.ts (tick rings, `Captions` = a thin adapter over the shared
                       speech.ts `sayAt` bubbles, hero-safe text pops)
    relic-fx.ts        relic / talent / twist procs, shields, Plot Armor, ENCORE!, the Filler Arc sequence + cards
    merch-fx.ts        the 61-relic merch line's own looks (asked first by relic-fx): per-relic stamps / particles,
                       A Real Friend (hero sprites + pink outline), the Red String, Rival marks, SECOND WIND border,
                       the NANI?! pop (game/nani.ts decides it)
    heroes-a-fx.ts     Kuro / Pudding / Aoi / Akane: breath streams + burning heads, the Abyssal Gaze eye, beams, the
                       ETERNAL ABYSS shadow sweep (dim grade, flashlight reveal, black-feather kills), teacups / tea
                       puddles / moat / teapot, the omurice, spaghetti missile trails + sauce decals, the C6 drone,
                       ROCKET PUNCH, drill spins, the "...h-hmph." band, BAKA! / text pops (satire pop rules)
    heroes-b-fx.ts     Senpai / Magical Girl #47 / Isekai-kun / Truck-kun: the sparkle aura (Shoujo Filter roses,
                       KIRA KIRA), charm hearts + pink tint, the SENPAI NOTICED YOU shoujo frame; henshin flashes,
                       the charge ring, the ult turntable + narrator subtitle; burning craters, STATUS SCREEN window
                       slams + fake "9999999" numbers; truck lean / exhaust, HONK waves + pops, isekai'd light
                       pillars (no confetti), ghost trucks on their lanes
    arsenal2-fx.ts     Bubble Tea / Paper Cranes / Idol Lightsticks / Kotatsu (+ evolutions): crane flock drawing (flap,
                       facing, crumple, fold glow, paper trail), tapered lightstick crescents + the Chorus ring, the
                       ENCORE! crowd, the kotatsu (aura, quilt frames, steam, Zzz over the hero and sleeping enemies),
                       the WISH GRANTED! gold rain, boba pops / tea splashes, mikan splashes ("a2_*" heroFx cues)
    trails.ts          projectile trail presets (keyed by Projectile.trail)
    texts.ts           in-world bitmap texts ("LEVEL UP!", "FREEZE!")
    anims.ts           sprite handle cache
    feedback.ts        EVENT -> juice/particles/numbers/audio/haptics/HUD hooks bridge (one bind-options object - sfx,
                       haptic, sound, calm, hooks - shared by every content view group's `bind`)
    weapon-fx.ts       arsenal visuals: bubble field / ocean dome, prism + rainbow beams, candy landing markers,
                       love-tornado swirl (per frame) + `weaponFx` events (lightning, blasts, dome bursts, heals)
                       + arsenal trail looks (merged into TRAILS)
    speech.ts          THE enemy speech bubbles of every stage (satire.md §5-6 pools of all five stages): ambient 4 % /
                       elite 25 % on entering the view, scripted lines from the sim's `enemySay`, free-standing
                       `sayAt(x, y, text, life, ink)` lines (boss death lines: rows of <= 22 characters, a trailing "♡"
                       as the heart sprite, kept out of the bottom third where the touch buttons are); 3 on screen in
                       total (an ambient one never placed over another), 8 s per type, none above 200 enemies or
                       within 40 px of the hero
    bullet-looks.ts    SHARED per-sprite enemy-bullet looks for drawBullets (glow colour / radius, spin, velocity
                       rotation, tint, size by hit radius): a stage view registers its bullets at module load
    candy-fx.ts        Candy Kingdom looks: gummy flavour tints, Shield Wall glint, Corn-mander flag, donut roll
                       rotation, Toasty / S'more marshmallows, mage staff glow, the golem's buttons / dashed Cookie
                       Cutter / crumbs, the Tyrant's halo / jete afterimages / crash Zzz, chocolate puddles, the
                       SUGAR RUSH grade ("candy_*" cues, `StageFxOpts`)
    academy-fx.ts      Shoujo Academy looks: whistle glints, blushing slimes, transfer sparkles, ninja smoke + decoys,
                       glare beams, the phone-glare wedge, the wind lane, REJECTED stamps, the School Regulation rule
                       card, the F- badge, phase 3's shoujo filter ("academy_*" cues)
    bestiary-fx.ts     bestiary visuals: per-enemy `decorate` hook (eye charge, pumpkin shiver, wisp fuse ring,
                       boss eyes / claws / halo, Lady Lunatic's moon ring), `enemyFx` cues, boss phase / enrage
                       juice, boss death throes, the VICTORY dawn sequence and the grade overrides (LUNATIC MOON
                       dim, enrage red, sunrise sweep)

  meta/                PURE ACCOUNT LAYER (Season 2) - no DOM / localStorage. Runs in Vitest. docs/META.md
    profile.ts         Profile (save v2) type, defaults, field-by-field sanitiser; reconcile.ts content-aware repair
    tuning.ts          every tunable economy / gacha / board number
    economy.ts         grade, line-by-line payout, hero XP + mastery curves, costs
    board/             Training Arc: 120-node constellation (data, layout, costs), buy / refund / respec, applyBoard
    heroes.ts          levels, talents (tier gating), constellations      gacha/  banners, pity, pulls, spark, exchange
    achievements/      Plot Points (defs/*.ts auto-registered), evaluation, in-run watcher
    unlocks.ts codex.ts  unlock rules + hints, discoveries + bounties      legacy.ts transfer.ts  save v1 migration, export string
    loadout.ts         loadout -> RunConfig (validation)                   rewards.ts  applyRunToProfile -> RunReport

  ui/                  DOM: app state machine, HUD, the Season 2 hub, screens, modals, save (section 10)
    app.ts             App: loop, screens (splash / hub / game / results), modals, level-up / chest / game-over flow,
                       settings, account runs (save.runPlan -> RunConfig) + bankRun, episode card + READY? / GO!,
                       in-run Plot Point toasts, Back-gesture history guard, AutoQuality feed, WebGL draw rules,
                       run-in-progress stash, save warnings / other-window reloads (section 10.1)
    session.ts         Session = World + WorldView + Feedback (real run or attract mode)
    hud.ts             HUD (XP, level, timer, kills/coins, icons, combo, boss bar, banners + boss letterbox,
                       onboarding hint / bubbles, READY?/GO! stamp); diffed, quantised, WAAPI juice (see 2.1);
                       `hud-arsenal2.ts`: the lightstick icon pulses on the beat, the Thousand Crane Wish counter
                       `hud-overdrive.ts`: the Overdrive gauge (bottom-right) whenever the touch controls are hidden
                       (keyboard / mouse / gamepad), with the key to press; the hero's own dash pips stay the dash display
    cutin.ts           ultimate anime cut-in overlay (ended by the sim / App only: no wall-clock timer)
    tutorial.ts        first-runs onboarding (move hint until moved, DASH bubble until the first dash,
                       OVERDRIVE-ready bubble x2, "fills as you fight" once per run)
    wake.ts            Screen Wake Lock during unpaused runs (released by the pause menu, re-acquired on resume /
                       when the page is visible again and no modal is open)
    nav.ts             keyboard / gamepad menu navigation (spatial focus; `refocus` after in-place re-renders)
    save.ts            THE storage boundary: save v2 (kko.save.v2 Profile), v1 migration (gift paid once), repair,
                       export / import, runPlan / recordRun, the run-in-progress stash, the revision guard between
                       windows, write-failure tracking, v1-shaped `save.data` view (docs/META.md §2, section 10.1)
    dom.ts             tiny DOM helpers (atlas sprite -> <img>, idle-time sprite prewarm, `Bump` WAAPI one-shots, fmtNum)
    styles.css         HUD / in-run modal styles (palette CSS variables)
    stinger.ts         run-start "EPISODE N" title card, the TO BE CONTINUED -> arrow banner
    kit/               hub UI kit: currency bar, buttons, tabs, cards, rows, badges, rarity frames, progress bars,
                       detail sheet, confirm dialog, toasts, pan / zoom viewport, frame ticker (kit.css)
    hub/               the hub: hub.ts (page stack + header), home, stages, loadout, board (Training Arc),
                       heroes (+ hero page), gacha (Merch Machine), wiki, celebrate (unlock cards, boot notices),
                       parts (stage thumbnails, relic tiles), copy.ts + copy-data.ts (satire bible lines), hub.css
    screens/*.ts       splash, levelup, chest, pause, settings (+ save data tab), over (TO BE CONTINUED), results
                       (Episode Results); evo-hints.ts draws the evolution hint lines / glow / pause badges (KE_CSS)
                       and owns the known rule (`runKnown`: Wiki discoveries + this run's evolutions; practice = all)

  debug/
    bot.ts             autoplay bot + `simulate()` headless runner (PURE; used by tests, ?autoplay, ?skip, attract,
                       the balance probe; `noDash` / `randomPicks` make the "lazy" weak-player proxy)
    params.ts          URL params (?autoplay ?seed ?hero ?skip ?god ?mute ?quality ?screen ?fps ?speed) + Season 2
                       run configs (?stage ?endless ?twists ?relics ?talents ?cons ?flags ?lb ?startLevel ?slots)
    hooks.ts           window.__kk (skipTo, spawn, giveXp, levelUp, chest, ult, give, clearWeapons, pause, endRun, stats,
                       relic, twist, endless, stageFx, runStats ...)
    fps.ts             FPS meter
    perf.ts            frame profiler (always on: per-phase CPU ring + 60 s histogram; App.frame laps it)
    diag.ts            error / warning ring, context losses, the "Copy diagnostics" text + clipboard fallback
    dev.ts             developer suite entry: ?step=1 step mode (__kk.step / render / freeze), ?scenario=, ?dev=1,
                       the ` key + 3-finger long-press, lazy loaders (docs/DEVTOOLS.md §3)
    scenarios.ts       named scenarios (warp, sandboxed account runs) + snapshot.ts (__kk.snapshot JSON); lazy chunk
    profiles.ts        seeded profiles (tools/checkpoints.ts) + the save sandbox; lazy chunk
    console/           the dev console overlay (Perf / Run / Audio / Acct / Scn / Log tabs); lazy chunk

tests/                 vitest: core math, xp/cards/chests/meta, headless 3-minute bot runs, boss, ults,
                       bestiary.test.ts (late enemies, both bosses through every pattern/phase, victory, enrage,
                       bullet hygiene), integrity.test.ts (final boss + death on one step, coin merge, a full
                       unmuted run with a listener on every event: bounded lists, victory)
                       quality.test.ts (AutoQuality stepping, guessTier, save validation, fmtNum)
                       Season 2 sim: stages.test.ts (registry, Dream Meadow parity: frozen run fingerprints +
                       ground draw-call parity against tests/fixtures/, a test-only second stage), runconfig.test.ts
                       (stat pipeline, pools, Limit Breaks, slots, start bonuses, flags, banish / skip, bot policy),
                       effects.test.ts (hook toolkit, every relic, talent trees, constellations, Plot Twists),
                       endless.test.ts (Filler Arc, RunStats, the view's stage look / stageFx directives)
                       Season 2 meta: tests/meta.*.test.ts (docs/META.md §10); integration.test.ts (the seams
                       between meta, sim and banking with the live registries: section 11)
                       Season 2 content: heroes-a / heroes-b / arsenal2 / relics / achievements / stage-<id> suites;
                       coverage.test.ts = the registries against the bible (section 12)
tools/balance.probe.ts `npm run balance`: full headless runs, every hero x seed, good + lazy bot, pacing report (section 6)
tools/progression.sim.ts `npm run progression`: consecutive runs with one account (bot + spending policy), hours to
                       every EXPANSION §2 milestone, income / power curves (docs/META.md §9)
scripts/e2e.mjs        Playwright e2e: desktop / mobile portrait / mobile landscape in parallel, screenshots, fails on errors
scripts/flows.mjs      Playwright account flows (section 11): fresh save -> run -> bank -> buy -> stronger run, v1
                       migration, Filler Arc clear, Android Back in every state, keyboard-only play; 4 devices
scripts/peak.mjs       peak-chaos readability shots (adaptive bloom limiter on / off)
scripts/icons.mjs      regenerates public/icon-192.png + icon-512.png from the atlas
scripts/scenes.mjs     scene gallery: scenarios in step mode on N browsers, contact sheet, visual anomaly flags
                       (blackout, murk, illegible text, placeholders, overflow, errors), films (name~frames/every),
                       --baseline / --diff, --self-test (docs/DEVTOOLS.md §5)
scripts/doctor.mjs     every cheap gate in parallel (§7); lint-css.mjs (global CSS collisions), check-artifact.mjs
                       (CSP boot of the published page), check-audio.mjs (synthesis cost budget + lite-profile shape,
                       the AudioContext each device gets, Android focus-loss recovery), check-bundle.mjs (main-chunk
                       budget, dev code stays lazy) (§6)
vitest.config.ts       the unit suite: fast by default, `slow` tag for long headless runs (npm run test:slow / test:all)
CLAUDE.md              the agent guide: which tool answers what, rules, known pitfalls
public/                PWA manifest + icons
```

Dependency direction: `ui -> view -> game`, `ui -> meta -> game`, `ui/view -> render/fx/core`,
`game -> core (events, rng, pool, spatial, math) + art/palette (colours only)`.
**Nothing in `src/game` may import `render`, `fx`, `ui`, `view`, `audio` or touch the DOM;
`src/meta` follows the same rule and never touches localStorage (only `src/ui/save.ts` does).**

---

## 2. Frame flow

```
Loop(dt) -> App.frame
  time.update(dt); input.update(); nav.update(input)
  game frame: input -> world.input (or the bot), pause, touch meters,
              level-up intro (time eases to 0.2x, then modal), chest modal, game over
  session.tick(time.dt, dt): substep(1/60) world.step(); camera.follow; feedback.frame()
  r.beginFrame -> view.draw -> fx.update/draw -> r.endFrame   (at most 30x/s while an in-run modal is up; NOT AT ALL
                                                              behind an opaque hub page or a full-screen hub overlay -
                                                              the attract game does not even step - and once (again on
                                                              resize / context restore) for the frozen run behind
                                                              Results; fx.update still runs every frame)
  hud.update(world)
  auto.sample(loop.rawDt * 1000, cpuMs)   (the REAL frame interval, not the 1/20-clamped dt; skipped while paused /
                                          a modal / settings / Results / a covered hub, and 1 s after a screen change)
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
  disconnect / WebGL context loss all go through `pause()`); Esc / gamepad
  START pressed during the episode card, READY? or the cut-in is remembered
  the same way (its edge is never dropped);
- on the frame a modal closed, gameplay edges (dash / ult / pause) are dropped,
  and a nav "back" consumes back + pause + ult + dash + confirm, so the gamepad B
  that resumes never casts and Enter never re-clicks the pause button (which is
  `tabindex=-1` and blurred on click); P / START toggle the pause closed.

Android Back / edge-swipe back: everything except the hub's home page (and the
splash) keeps one same-URL history entry (`{kk: 1}`, `App.syncHistory`);
`popstate` re-arms it and routes like Esc: an open sheet / dialog / reveal /
celebration closes, settings close, a hub page pops, the game pauses, the pause
menu resumes, level-up / chest / game over ignore it, Results go to the hub.
At the home page with nothing open the guard is dropped (`history.back()`, its
own popstate ignored), so Back leaves the page. A release is issued at most
once until its traversal lands (`App.selfPops`): `history.state` only changes
when it does, and a second `history.back()` would step off the page (this is
what Back on Episode Results -> hub home used to do). The Hub only syncs the
guard once the App has switched to it (`app.hub === this`).

Run-start stinger: a hub run (START EPISODE / RETRY of one) first shows the
"EPISODE N" title card (`stinger.ts`, 1.35 s, `narratorSting`), then READY?
with `time.paused` for 0.6 s (hero cast pose, HUD flies in via `.hud.intro`),
then GO! (light shake, uiConfirm), the sim and the touch controls start; input
is ignored before GO!. Deep links / autoplay / `?skip` start without it.

Menus over the attract game (`App.frame`, `Session.camOffX/Y`): the camera is
offset so the bot's hero runs in open meadow, never under the menu. The hub
home reports the free window between its profile card and PLAY (portrait) or
between its columns (landscape) through `HubPage.camAnchor()`; opaque pages
(everything but home) and the full-screen hub overlays (unlock celebrations,
the Merch Machine pull: `App.syncCover` on overlay open / close) hide the scene
completely, so the attract game neither steps nor draws behind them; the first
uncovered frame draws fresh (after a rotation or a context restore too); the
splash keeps the old rules (right of the key art in compact landscape).

Small-screen layout rules (styles.css): the touch OVERDRIVE button reaches
~210 px above the bottom edge, so in touch portrait the onboarding pill sits
above the hero (25 %); the pause menu and settings fit a 320x568 phone without
scrolling (`max-height: 620px` portrait rules, six build slots per row under
360 px); Episode Results is two columns in landscape (header + payout left, XP /
mastery / Plot Points / narrator right) with the buttons in a sticky footer.
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
- UI sprites are encoded and decoded (`img.decode()`) in real idle time only
  (`requestIdleCallback` without a timeout, slices of at most 8 ms), hub icons
  first, then portraits and hero idles; the queue waits (coarse 500 ms timer,
  no per-frame polling) during a run, a modal, settings, an overlay and for 1 s
  after a screen change (`__kk.prewarm()` reports its progress). The Training
  Arc's glyph pretint (`hub/board/glyph.ts pretint`, queued at boot) keeps out
  of a run the same way (`setPretintGate`, set by `App.start`); glyphs already
  waiting on screen are always served.

### Quality tiers (render/quality.ts)

Every coarse-pointer device starts at `mid`, desktops at `high`. AutoQuality
judges 2 s windows against the display's own refresh interval (median frame
time, never slower than 60 Hz): more than 10 % of frames over 1.3x refresh, or
average JS time above 0.75x refresh, steps down (4 s cooldown); 8 s without a
bad window with JS under 0.4x refresh steps up (cooldown 8 s + 12 s per earlier
down-step). It is fed the real, unclamped frame interval (`Loop.rawDt`, one
frame counting at most 250 ms), so windows and cooldowns are wall-clock time
and a 5 fps phone steps down within 4 s. DPR caps are 2 / 2.5 / 3 (the scene
renders at art resolution, only the nearest-neighbour composite scales; the
canvas is `image-rendering: pixelated`); each step down also lowers the enemy
cap and particle budget, and `low` is clearly cheaper than `mid` (glow buffer
at 1/4 resolution, 800 particles; bloom stays on).

### Music per state

| State | Track | Where |
| --- | --- | --- |
| splash (before the unlock gesture) | none | `App.unlockAudio` picks the track for the current screen |
| hub pages / settings | `hub` (`gacha` on the Merch Machine page: `HubPage.music`) | `Hub.syncChrome` |
| run | the stage's `music.battle` + `setIntensity(enemies, combo rank, boss)` | `App.startRun` (`view.stage.music("battle")`), `Feedback.frame` |
| boss alive | the stage's `music.final` for its final boss (or a boss asking for `final`), else `music.boss` | `feedback.ts bossSpawn` (`StageLook.bossMusic`); back to the battle theme 2 s of **game time** (`world.t`) after a non-final boss dies (frame time is clamped on slow devices, so it is not used); `App.revived` restores the right one |
| Filler Arc | the battle theme returns 1.2 s after "...IN THE FILLER ARC!" | `relic-fx.ts fillerArc` -> `Feedback.musicBackAt` |
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
- **Two buses**: `world.bus` = presentation (view / HUD / audio, silent while
  muted); `world.hooks` = gameplay hooks (`hooks.ts` SimHooks: kill, hit, hurt,
  lethal, block, levelUp, dash, ult, ultEnd, pickup, gem, chest, eliteSpawn,
  bossSpawn, bossKill, prop, heal, revive, reroll, banish, skip, endless, step),
  **never muted**, so relics / talents / twists / RunStats behave the same in a
  fast-forward (runs stay reproducible per seed). One reused payload per hook.
- **RunConfig** (`run-config.ts`): `new World({ hero, seed, run })`; without
  `run` = `defaultRunConfig()` (Dream Meadow, everything unlocked - identical
  to the shipped slice: `tests/stages.test.ts` replays frozen fingerprints).
  Stat pipeline (`World.recomputeStats`): base -> hero trait -> legacy Dream
  Shop -> `run.mods` -> relic mods -> talent mods -> constellation -> passives
  -> `world.statMods` (run modifiers, timed `Buff`s) -> `finalizeStats`.
  Twists scale `world.difficulty` (enemy HP / speed / damage, spawns, cap,
  bullets, elites, boss warning / intro / sequel, food, level heal, rerolls)
  and set `world.look` presentation hints (darken, elite outlines, censored).
- **RunStats**: `World.summary().stats` at the end of a run; `World.runStats()`
  refreshes and returns the same live object without building a summary (the
  in-run Plot Point watcher polls it about once a second). `RunStats.greed`
  (final Stats.greed) lets the payout apply greed to the coin bonuses.
- **Start weapons** (`RunConfig.start.weapons`): a weapon the hero already holds
  is levelled up to the given level (the board's "Prepared Protagonist" on the
  signature weapon), any other weapon is added at that level.
- **Endless**: with `run.endless` the final boss's death calls
  `World.startEndless()` instead of `win()` (`stageCleared` either way): the
  director then runs `StageDef.endless` (HP / spawn growth per endless minute,
  elite waves, boss rematches scaled per loop, an episode card every 5:00).

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
| run | `victory`, `fillerArc` (endless continues), `fillerWave` (elite wave / rematch), `fillerEpisode` (every 5:00) |
| Season 2 | `shieldBlock`, `plotArmor` (lethal hit survived), `ultEncore` (ENCORE! heart meteors), `relicProc` (relic / talent / twist proc, reused payload), `stageFx` (sim -> view look directive), `enemySay` (speech bubble: `enemies/_say.ts`, drawn by `view/speech.ts`), `stageCue` (stage content cue with namespaced string kinds, `enemies/_cue.ts`) |

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

**Orbiting bodies guard the hero** (`weapons/_orbital.ts`, Orbital Guard): a weapon whose projectiles orbit her
(Yarn Orbit / Cosmic Yarn, Teapot Tempest / Eternal Tea Party) calls `guardTick` once per step, `guardBody` per
body after placing it (slot k = ring index / cup ordinal; a broken body keeps its projectile with r 0 / scale 0),
sets `guard.n` (bodies placed) and `guard.ref` (its own count without the Amount stat) and calls `guardBlock`:
bodies that are up destroy the `world.bullets` they touch (beams, slams and telegraphed blasts are not bullets),
break after the level's `block` bullets and reform after `mendTime` (`mend` s scaled by the cooldown stat at half
rate, the Amount stat's extra bodies and a second guarding weapon; knobs in `CFG.guard`, docs/content/weapons.md
§7). Only instances in `world.weapons` block (A Real Friend's copy never does). Per-instance state is typed arrays
(`guardOf`); the view only plays the cues, `weaponFx` WFX_ORB_BLOCK / BREAK / REFORM (nothing is drawn per
frame: a broken body is empty space until it reforms, no cooldown marker by design); blocks count in
`RunStats.orbitalBlocks`. A new orbital weapon adds `block` / `mend` to its levels and the three calls (the cues
come for free).

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

The director picks it up as soon as its id appears in a stage's phase mix
(`src/game/stages/<stage>.ts`; Dream Meadow's 2:00+ phases already list
`eyepuff`, `pumpkin`, `teddy`, `wisp`). `special: true` keeps an event / twist
enemy out of every random pick; `noCodex: true` keeps an implementation actor (the Animation Error's
dropped frames) out of the wiki / codex; `tint` re-colours a re-used sprite and a
per-enemy `e.skin` re-dresses one enemy (the Rival (Recolour)).
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

Hit context for `dmgTaken` / `hit` listeners: `World.hitProj` is the projectile whose hit is
being applied (null for auras, explosions, ults...) and `World.blastDepth` > 0 inside
`explode()` (the Candy Corn's front-half Shield Wall, the Marshmallow Brute's Toasty).

### Director event (`src/game/director/`)

Data goes in the stage file (`StageDef.events`), behaviour in `events.ts`:
`EVENT_HANDLERS.myEvent = (w, d, ev) => { ... }`. Use `d.addTask((dt) => stillRunning)`
for events that unfold over time (see `flood`, `batStorm`, `wispRush`). Emit
`waveIncoming` once for the HUD banner (kinds `swarm`, `encircle`, `storm`,
`wisps`, else "STAMPEDE!"; `TimelineEvent.label` overrides the text, e.g.
"POP QUIZ!"). Spawn through `w.spawnEnemy` so twists / curse / the Filler Arc
scale it, and read `w.difficulty.elite` for elite counts.

### Stage (`src/game/stages/<stage>.ts`)

`export const stages: StageDef[] = [myStage]` (types in `stage.ts`;
`stages/dream-meadow.ts` is the reference, `docs/content/stages.md` has
stages 2-5 written field for field). Everything a stage changes is data:

- sim: `phases` (mix / rate / cap per time window), `events` (bosses included),
  `opening` ring, `finalBoss` (its death = victory, or the Filler Arc),
  `enrageAt`, `props` (ids / interval / max), `endless` (`EndlessDef`), hooks
  `onStart(w)` and `onFinalBossKilled(w, boss)` (return true to own the ending).
- view: `tiles` (sprite + region rules: noise paths / patches, hash accents,
  `cuts` / `mul` / `weights` frame picks), `deco` (`scatter` + `tall` layers,
  `salt` decorrelates hashes), `clearColor`, `grade` keyframes (preset name or
  inline values, over `t / gradeSpan`, default span = the final boss's arrival),
  `ambient.base` (engine petals / motes / fireflies) + `ambient.layers`
  (sprinkles, snow, bubbles, glitch motes: `stage-view.ts` draws them),
  `music` (battle / boss / final track ids), `victory` texts.
- a boss that degrades the show (Cancel-sama) emits `stageFx` directives:
  `w.emit("stageFx", { kind: "grade" | "renderScale" | "animFps" | "speedLines" |
  "still" | "reset", value, seconds, id })`; `StageLook.directive` applies them and
  `Feedback.dispose` resets them.
- the account layer reads `stageInfo(def)` / `stageInfos()` (bosses, final boss,
  enemies, requires, rewardMul). `registerStage(def)` adds one at runtime (tests:
  `tests/stages.test.ts` runs a test-only stage with its own tileset and roster).

### Relic (`src/game/relics/<rarity>.ts`)

`RelicDef { id, name, rarity, icon: "icon_relic_<id>", flavor, desc(stars),
mods?(s, stars), install?(w, stars) }` (values per star from
`docs/content/relics.md`, `atStar(table, stars)`). Stat parts go in `mods`
(applied in the pipeline). Behaviour in `install`, through the hook toolkit:

```ts
install(w, s) {
  w.hooks.on("kill", (k) => { if (!k.boss && w.rng.next() < 0.02) w.dropPickup("heart", k.x, k.y, 3); });
  w.every(15, () => { ... });                 // periodic (w.after(sec, fn) = one-shot)
  const mode = new Buff(w);                   // timed stat buff (recomputes on start / expiry)
  w.statMods.push((st) => { if (mode.on) st.cooldown -= 0.4; });
  onDashThrough(w, (e) => w.hitEnemy(e, 10 * w.stats.might, null, 0, 160, 0, "rubber_duck", 0xffe14d));
  proc(w, "my_relic", x, y);                  // view flourish (relic-fx.ts; default: sparkle + name tag)
}
```

Hook listeners must not allocate per event (payloads are reused: read, don't
keep). Gameplay randomness uses `w.rng`. Relic damage uses source = relic id.
New look for a proc: a `case` in `view/merch-fx.ts proc()` (the merch line's own
looks; `relic-fx.ts proc()` asks it first, then its own cases, then the generic
sparkle + name tag).

All 61 relics of the bible ship (`relics/n.ts` ... `mythic.ts`; `tests/relics.test.ts`
installs each at ★0 / ★6 and checks its effect). Run-state levers they use, all
additive on `World` and safe to reuse:

- `w.hurtMods` - final-damage modifiers on a landed hit (after shields / armor,
  before the lethal check): Mascot Costume Head (1 damage), Pocket Tissues (-50 %).
- `w.dmgTaken` - per-hit damage-taken factors on enemies: Rival Plushie marks, Red
  String of Fate, Oversized Sword Keychain (x3 + a forced NANI?!).
- `w.jackpotBonus` (absolute chest JACKPOT chance), `w.chestEvoEarly` (chests offer
  an evolution N levels before max: Golden Gacha Ticket), `w.doublePicks` (levels
  whose offer is picked twice: `World.choose` keeps the rest of the offer - Season
  Finale Manga), `u.dur` from the `ult` hook (Studio's Last Remaining Budget).
- `relics/_util.ts dirtyOn(w, key)`: recompute stats when a state key changes (combo
  rank, HP below 50 %, MINT / OPENED).
- A Real Friend (`relics/_friend.ts`, view: `merch-fx.ts drawFriend`): an ally with a
  second instance of the start weapon (not in `w.weapons`). While it (or a projectile
  it owns) updates, the hero's position and self-buff state are swapped to the Friend
  ("sandbox"), so any weapon fires from the Friend; PK_ATTACHED shots are re-anchored.
- NANI?! pops (`game/nani.ts`, installed by the RunStats collector): decided in the
  sim (`RunStats.nanis` = pops shown), rolled from a hash of the step + enemy uid so
  no `w.rng` draw is added; the view pop lives in `merch-fx.ts`.

### Talent tree (`src/game/talents/<hero>.ts`)

`export const talentTrees: TalentTree[] = [{ hero, branches: [3 names], nodes }]`,
nodes from `node(id, name, branch, tier, maxRank, desc, { mods?, install? })`
(`talents/_node.ts`); 5 / 3 / 3 / 3 / 1 ranks per branch, ids `<hero>_<slug>`
(unique across trees: the meta layer indexes them globally), tier gating is the
meta layer's (`TALENT_TIER_POINTS`). Weapon / ult parts read the rank in the
weapon or ult file: `w.talentRank("hoshi_backup_dancers")` (also for its
evolution); per-weapon damage: `w.addWeaponDamage("star_shot", 0.06 * r)`;
start weapon changes: set `w.startWeapon` / `w.startWeaponLevel` in `install`
(it runs before the start weapon is added); forced crits: `w.critRules.push(...)`.

### Constellation (`HeroDef.constellations`, `src/game/heroes.ts`)

Six `ConstellationDef { name, desc, mods?, install? }` per hero (C1..C6), applied
up to `RunConfig.constellation`; ult / weapon code reads `w.cons` (e.g. Supernova
Shower +10 meteors at C4).

### Plot Twist (`src/game/twists/<group>.ts`)

`TwistDef { id, name, icon, maxRank, heat: [per-rank increments], desc(rank),
install(w, rank), note?, unlockedBy? }`. Usually it scales `w.difficulty`, pushes
a `w.statMods` entry, sets a `w.look` hint for the view, or registers a timer
(`shounen_rival`). Total heat = `twistHeat(ids, ranks)` (= `RunStats.heat`).

### Season 2 hero primitives (shared, additive)

- `Enemy.stun` (s): dazed / stunned - no behaviour update, no own movement, knockback still applies
  (Baka Harisen daze; bosses are never dazed by `daze()` in `weapons/_heroes-a.ts`).
- `World.dmgTaken`: damage-taken multipliers applied in `hitEnemy` (burning enemies +15 % with Kuro's
  The Seal Is Broken, Senpai's swoon...). Cheap, allocation-free functions only.
- `"snack"` pickups: content food with its own `Pickup.sprite` / `tint` (puddings, petit fours, Moe hearts),
  collected on touch, heals `value` x healMul, counts as food eaten.
- `heroFx` event (`HeroFxEvent`, namespaced string kinds such as `kuro_shadow`, `akane_baka`, `hb_*`, `a2_*`)
  for hero weapon / ult / talent cues, all emitted through `weapons/_fx.ts heroFx()` (one reused payload; kinds
  are pinned collision-free by `tests/coverage.test.ts`); each group's view file handles its own kinds.
- `UltState.dur`: an ult's `start()` may lengthen THIS cast (TRUE Forbidden Technique, Super Robot Upgrade,
  extra Omurice pulses); `HeroDef.band` / `cutinLine` feed `ui/cutin.ts`.
- Group A sim helpers live in `weapons/_heroes-a.ts` (`heroesA(w)`: per-world burns, the Abyssal Gaze mark,
  smacked "flyers", BAKA! pop rules, Aoi's drone position; one kill + one step hook per world).
- `HeroDef.install(w)`: a trait that is more than stats, run once after relics and before talents /
  constellations (Senpai's staring aura, Isekai-kun's Lv 3 start, Truck-kun's driving). `World.startLevel`
  (from `RunConfig.start.level`) may be raised there or by talents (Starter Village Bonus).
- `World.mover` replaces the default input -> velocity damping (Truck-kun: heading + throttle, `weapons/_truck.ts`);
  `World.heavy` ignores hit recoil; `Stats.hitbox` scales the player radius (Truck-kun 1.5, Chibi Charm < 1);
  `World.contactDmg` scales contact damage only (Too Cool To Get Hit).
- `World.hurtGuards`: a guard returning true negates a hit before shields (Panic Henshin; it emits `block` itself).
  `World.dmgTaken` rules also receive the hit's `crit` (Shoujo Filter's crit bonus on charmed enemies).
- Group B sim helpers: `weapons/_hb.ts` (`HB` heroFx kinds, `densest()` cluster finder, the isekai'd rules,
  `everyStat()`), `weapons/_charm.ts` (charm / swoon / fluster book: charmed enemies run in MODE_STRAIGHT with their
  contact damage parked), `weapons/_truck.ts` (driving, ram check, the C6 trailer); hero defs in `game/heroes-b.ts`.
- `World.dozing` (Kotatsu of Sloth's Too Comfy): while true, `hitEnemy` ignores every weapon hit (an owner or a
  weapon-id source): no damage, no hit hook, so `RunStats.pacifistBest` grows by itself; ults / relics still hit.
- Beat-synced weapons (Idol Lightstick Wave, Sold-Out Dome Tour) read `weapons/_arsenal2.ts beatIndex(w)`: beats of
  `StageDef.bpm` (default 140) from the run clock, so every beat weapon shares one grid; `inst.data.beatAt` is the
  run time of the last beat (the HUD pulse).
- View hooks for hero looks: `WorldView.heroXf` (rotation / scale / y offset of the hero sprite, set per frame),
  `heroesB.death(e)` (an enemyKilled that the hero fx draws itself: isekai'd pillars) and `heroesB.numberText(e)`
  (a damage-number text override) consulted by `feedback.ts`.

### Season 2 stage primitives (stages 4-5, shared, additive)

- `Enemy.untargetable`: skipped by homing / auto-aim picks (`homingTarget`, `nearestEnemy`, `nearestEnemies`,
  `randomEnemyInView`) while true; area damage still hits (Tiny Shark's fin, a Sandcastle Golem's sand pile).
- `Bullet.tint` (reset to white by `spawnBullet`): per-bullet sprite + glow tint drawn by `WorldView.drawBullets`
  over the per-sprite `bullet-looks.ts` look (firework stars cycling colours, Shadow Clone orbs).
- `hooks.blast { x, y, r }`: every `World.explode` (never muted) - a pile crumbles in an explosion.
- `enemies/_s45.ts` environment: `slowZone(w, k)` (call each step the hero stands in it), `slowFor(w, k, s)`,
  `pullHero(w, dx, dy)`, applied once per step by one `step` hook per world (it takes back part of the hero's own
  movement - no Stats recompute; a dash cuts through at full speed).
- A killing blow can be refused from a `hit` hook (it fires after `e.hp -= d`, before the kill check): the golem's
  hook turns the "death" into its pile by setting `hp = 1` + `inv`, so XP and elite loot drop only on the final death.
- Still frames = `w.freezeT` (enemies + bullets hold, the hero moves) + a `stageFx` "still" (WorldView keeps the
  pose without the frozen tint / overlay). Bosses that must keep time through them use `World.t` stamps.
- Cosmetic cues of these stages are `enemyFx` kinds 400-499 (EFX_* in `_fx.ts` stay below 100).
- `stageFx` directives travel on the muted presentation bus: a boss whose look persists (Cancel-sama's
  degradations, the Firework Dragon's night) re-sends its current state on the first update after `w.muted` turns
  false, so `?skip=` / `__kk.skipTo` never leave the view out of step with the sim.
- Big bosses only start a pattern while `readable(e, w, top, margin)` (margin ~ half their sprite width);
  Cancel-sama, left out of the shot for 1.2 s while drifting, smash-cuts back to his anchor (`BX_CUT`, "CUT TO:").

### RunStats counters

Collected by `run-stats.ts` from `world.hooks` (`evolutions` = the EVOLVED weapons held at the end: a maxed
base weapon is not an evolution); content-specific counters
(`nanis`, `bakas`, `charmed`, ...) go through `w.bumpStat(key, n)`. A new
counter = an optional field on `RunStats` (contract: additive only) + its
collection in `RunStatsCollector`. `RunStats.killedBy` is the `by` argument of
`w.hurtPlayer(dmg, sx, sy, by)` (contact damage passes the enemy id itself): a boss
slam / blast that calls `hurtPlayer` directly should pass `e.def.id` too, or the
"defeated by X" Plot Points (Candle Wisp, Truck-kun) can't see it.

Plot Points (`src/meta/achievements/defs/*.ts`, 171 entries = docs/content/achievements.md;
shared readers in `defs/_shared.ts`) read only `AchCtx`; end-of-run feats (a death, a
quit) also require `c.ended`, so the in-run watcher never toasts them mid-run. Every
id has a crafted trigger in `tests/achievements.test.ts` (with a bible-sized content
catalogue) and every unlock-granting one matches its `UNLOCK_RULES` row.

### Passive (`src/game/passives.ts`)

Append `{ id, name, icon, levels: [5 texts], apply(stats, level) }`. Stats are
recomputed from scratch (base -> hero -> account / relic / talent /
constellation mods -> passives -> run modifiers). New stat? add it to `Stats`
in `stats.ts` (+ `baseStats`, + a clamp in `finalizeStats` if it needs one) and
read it where needed. A passive whose effect depends on run state (Friendship
Bracelet: damage per weapon held) adds `install(w, inst)` and pushes a
`World.statMods` entry that reads `inst.level` live (weapon changes already mark
the stats dirty when statMods exist).

### Ultimate (`src/game/ultimates/<name>.ts`)

`{ id, name, hero, desc, duration, start(w, u), update(w, u, dt), end?(w, u) }`
exported as `ultimates`. The hero table's `ult` field references the id. The
cut-in, invulnerability, meter and HUD are generic. Use `CH_ULT` for damage
channels, `w.timeStop` to freeze enemies, and emit custom events for visuals
(add them to `GameEvents` + a handler in `view/feedback.ts`).

### Hero (`src/game/heroes.ts`)

Add a `HeroDef` (sprites `${id}_idle|run|hurt|cast`, `portrait_${id}`), its
start weapon and ultimate. The select screen lists `HEROES` automatically.
Season 2 hero groups keep their defs in their own file and spread them into
`HEROES` (`...HEROES_B` from `heroes-b.ts`); `band` / `cutinLine` feed the cut-in
(`heroes-b.ts cutinLine(w)` lets a talent rewrite the line for a run), `install`
carries trait behaviour, and the bot's per-hero distances live in `debug/bot.ts`
(`PREF`, `BOSS_ENGAGE`, `BRAVE`).

---

## 5. Juice map (DESIGN §4 -> code)

| Event | Where |
| --- | --- |
| Enemy hit flash / squash / knockback | `World.hitEnemy` (flash, sqV, kx/ky) + `WorldView.drawEnemies` (a boss flashes at half strength, `BOSS_FLASH`: under six weapons its flash timer never runs out, and a full flash would keep it a white silhouette all fight) |
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
| VICTORY: slow-mo chained explosions up the final boss, dawn flash at 1.7 s, enemies dissolve into light, the stage's `victory.title` / `line` ("DAWN BREAKS!", "SUGAR CRASH!" ...: the title steps down a whole pixel scale and a long line wraps onto two rows when the view is too narrow), sunrise grade sweep + sun + god rays, fireworks, victory music, results modal at 7.2 s | `bestiary-fx.ts finalDeath / victory / drawDawn`, `App.gameFrame` |
| Bullet clears pop every bullet into a sparkle | `bestiary-fx.ts bulletsCleared` |
| Orbital Guard: a bullet pops on an orbiting body's rim (small blink, tiny ring, two sparks), a breaking body goes KA-POP (white flash, sparkles and bits in its colour and white, a quick ring; under half a second, no smoke), and then nothing: no cooldown marker while it is down (owner feedback), it just pops back in (sim scale pop + a silent speck of sparkle); sfx rate-limited (block, break), cues budgeted per frame (breaks apart from rim pops: a volley never swallows an explosion). Warm Tea: an amber ring at Pudding's feet whose 8 dots count the seconds left, a warm glow and steam, blinking as it cools | `view/weapon-fx.ts guardCue`, `view/heroes-a-fx.ts drawWarmTea` |
| Combo counter, rank stamps (one-shot shine inside the glyph's gradient fill), SSS border (opacity crossfade), milestone blip every 25 (`comboUp`); the timer bar drains faster at high ranks (gold-pink from S), a rank drop replays the letter falling in + a red flinch on the counter + a soft high `comboBreak` | `hud.ts` (WAAPI), `feedback.ts enemyKilled / comboDrop` |
| Peak-chaos readability: adaptive bloom limiter (`r.post.load` from the glow-instance count), fewer sparks / puffs / numbers, fainter + smaller enemy numbers (a screen with 40+ enemy bullets counts as busy too), hero beacon (faint silhouette + ring above player fx, under bullets; also forced on for ~0.5 s when an explosion / Raijin blast lands on the hero, `WorldView.coverHero`), small player shots fade within 16 px of the hero's body (Galaxy Barrage streams spawn there); the beacon redraws the hero's current frame translucent (its plum outline reads over white blasts and pink star clouds), and the live boss gets the same treatment (boss beacon) so it never vanishes under six evolutions | `render/post.ts feedGlow`, `feedback.ts frame()`, `fx/damage.ts busy`, `WorldView.drawHeroBeacon / drawBossBeacon / drawProjectiles` |
| HUD banners while a boss is alive drop below the hero and shrink (`.banner.low`): Lady Lunatic fights from the upper half, so ENRAGED! / ELITE! / EVOLUTION! never cover her or her bullets | `hud.ts banner()`, `styles.css` |
| Enemy bullets (`enemyShoot` sfx, rate-limited; pop-in flash, end-of-life fade, moons rotate along velocity) | `World.spawnBullet` emits `enemyShoot` (one reused payload), `WorldView.drawBullets` |
| Elite / boss aura | `WorldView.drawEnemies`: 4 one-pixel offset tinted silhouettes (no `Glow` flag) + soft halo |
| Hero behind a tree | `Ground.draw(time, px, py)` fades that canopy |
| Ambient petals / motes / fireflies + stage ambient layers, the stage's grade keyframes (Dream Meadow: day -> dusk -> night), sim `stageFx` directives | `view/stage-view.ts` (`Feedback.frame` -> `StageLook.frame`, `WorldView.draw` -> `StageLook.draw`) |
| Relic / talent procs (name tag + flourish), shield BLOCK!, PLOT ARMOR! (hitstop, slow-mo, rays), ENCORE!, SAKUGA MODE border, the rival's title pop | `view/relic-fx.ts` |
| Filler Arc: final boss throes, "TO BE CONTINUED..." freeze-frame (letterbox, sepia), record scratch, "JUST KIDDING! ...IN THE FILLER ARC!", fireworks, the battle theme returns; elite-wave / rematch banners, FILLER EPISODE cards every 5:00 | `view/relic-fx.ts fillerArc` |
| Banish mode (cards get a red BANISH veil, unbanishable ones grey out), SKIP, LIMIT BREAK! tags, 5-6 card grid | `ui/screens/levelup.ts` (LU_CSS) |
| Evolution hints, once a recipe is discovered: a weapon card's "→ EVO · needs PASSIVE" line (READY! / Lv 3→4 of 5 / greyed passive / NO SLOT), a NEW passive's "Evolves WEAPON → EVO"; a gold (READY) or aqua (completes the pair) ring + opacity-pulsed inner glow, static under reduced motion; compact lines in the 5-6 card grid and short landscape; the chest reveal; the pause menu's EVOLUTIONS list + slot badges | `game/evo-hints.ts` (rules), `ui/screens/evo-hints.ts` (KE_CSS) |

---

## 6. Balance (Season 2 combat difficulty curve)

The combat curve is tuned against **account power**, not against a fresh hero:
every stage has an *intended checkpoint* (a synthetic account built through the
real meta layer, docs/META.md §9.1) at which the average-player bot clears it
about half the time. A fresh save dies early in Dream Meadow; every run pays out,
the account grows, and the next checkpoint's stage opens up. The economy pass
then tunes income / costs so an account reaches each checkpoint at its hours
(EXPANSION §2).

### 6.1 Tools

| Tool | What |
| --- | --- |
| `tools/checkpoints.ts` | `CHECKPOINTS` P0-P7 + `checkpointProfile(id, hero)` / `checkpointRun(id, { hero, stage, twists })` (RunConfig through `buildRunConfig`), `HEAT_SETS.mid` (heat 12) / `.max` (41). Shared board / talent policy: `tools/policy.ts` (also used by `npm run progression`). |
| `node tools/matrix.mjs` | The power-vs-stage matrix: checkpoint x stage x hero x seed (x bot, x twists) in parallel vitest workers (`tools/matrix.sim.ts`, one per CPU), per cell: clear %, death times (p25-p75), boss fight lengths (killed / reached), first level-up, level-up gaps (0:20-3:00 median / max, longest outside boss fights), levels at 1/2/3/5/10 min, damage taken 0-1:30 / 1:30-3:00, kills/s and alive enemies per minute, killers. `--cells P2:dm,...`, `--cp`, `--stages`, `--heroes`, `--seeds 1-8`, `--bot lazy,mid,good`, `--twists mid|max`, `--tmax 240` (early-game experiments), `--by hero`, `--name x` (writes `tools/results/matrix-x.json` + `.md`). A run ends at its clear, its death (after revives) or duration + 5:00 (timeout). |
| `--variants sweep.json` | Tuning sweeps without editing files: `{name: patch}` with dotted paths into the live content (`"cfg.playerHp": 80`, `"stage.final_arc.scaling": {...}`, `"stage.dream_meadow.phases": [...]`, `"boss.cancel_sama.hp": 1600000`, `"_only": ["final_arc"]`), applied before and undone after each job (`applyPatch`). |
| `node tools/matrix-report.mjs before after` | The compact grids below from the saved results. |
| `npm run balance` | The full-run probe (per-run lines, 30 s timelines with `VERBOSE=1`, per-weapon dps `GAUGE=1`); `CP=P2 STAGE=candy_kingdom BOT=mid` plays a checkpoint's RunConfig, `BOT=lazy,mid,good,strong`. |
| `node tools/progression.mjs` | The economy's ground truth (6.6, META.md §9): bot accounts (weak / mid / strong x seeds, one process each, 4 in parallel) play real runs from a fresh save and bank / spend like a player; milestones in hours / runs, checkpoint snapshots, income per phase, the "something to buy" hook and dead zones, unlock timeline. `npm run progression` is one account with a line per run (`VERBOSE=1`). |
| `tools/econ.sim.ts` | Offline economy checks: `ECON=fit` prices `matrix --stats` runs with the live payout / XP / mastery formulas (`FIT_PATCH` tries a change), `ECON=reprice` reprices the checkpoints' board ranks under other ring costs. |
| `node tools/matrix.mjs --stats` | Keeps each run's RunStats in the result (input of `ECON=fit`). |
| `npm run balance:lab` | **Start here** (docs/DEVTOOLS.md §4): the whole checkpoint x stage matrix, boss fights, weapon DPS, level curves, a progression sample and anomaly flags in ~85 s cold / ~10 s warm. Analytic model + short real-sim samples on 4 cached workers, what-ifs with `--set "stage.final_arc.scaling.hp*=1.2"` (files untouched). Writes `shots/balance-lab/<name>/report.{html,json,md}`. The matrix and the progression tool stay for exact long runs. |

**Bots** (`src/debug/bot.ts makeBot`): `lazy` (random level-up picks, never
dashes: the weak player), **`mid` (the average player the curve is tuned for:
knows the build rules but takes a random card 35 % of the time, 0.24 s reactions,
sloppier steering)**, `good` (`new Bot()`: the autoplay / attract / e2e bot, 0.18 s),
`strong` (0.12 s, little slop). The upgrade valuation covers all 20 weapons
(`WEAPON_VALUE`, from the gauge's dense-crowd dps) and 16 passives
(`PASSIVE_VALUE`, build-aware: Friendship Bracelet grows with the weapon count,
Training Montage early, armour passives when hurt) plus every evolution recipe
(a passive that evolves a held weapon +26, a weapon whose passive is held +5 / +6).

Sim cost: 1-5 s per Dream Meadow run, 10-40 s for a high-power Final Arc run (huge
kill counts); the full 480-run matrix takes ~25 min on 4 CPUs at dt 1/30 (the probe's
default: within noise of the live 1/60 sub-step).

### 6.2 Targets (mid bot)

| Target | |
| --- | --- |
| P0 (fresh save) in Dream Meadow | real pressure by 1:30, dies ~2:00-3:30 (rarely reaching King Puff), a level-up every ~6-12 s, screens full of dying enemies |
| a stage's intended checkpoint | ~40-70 % clears; Dream Meadow P2, Candy Kingdom P3, Shoujo Academy P4, Beach Episode P5, The Final Arc P5-P6 |
| one checkpoint lower | mostly dies before the final boss |
| two checkpoints higher | clears comfortably |
| boss fights at the intended checkpoint | mid bosses 45-60 s (King Puff, the 3:00 tutorial boss, 20-45 s), finals 75-100 s, Cancel-sama ~150 s |
| P7 ("cute anime death machine") | melts the Final Arc at moderate heat (12), has to work at heat 41 |
| never a slog | no HP-sponge trash, no 30 s without a level-up, the ramp bites from minute 1 |

### 6.3 How the curve works

**Player** (`config.ts`): base max HP **80** (was 100: the account's HP nodes and
levels are felt from the first run). XP: `xpToNext(L) = min(2500, 5 + 10(L-1) +
16(L-6)+ - 14(L-12)+ + 60(L-22)+ + 60(L-38)+)` (+26 per level Lv 6-12 instead of
+38: the tougher early horde still levels you every ~6-12 s; **capped at 2,500**
from Lv 46 so the long stages never go 30+ s without a level-up). Gem XP x
`(1 + 0.15 max(0, m - 3))`; level-ups heal 3 % max HP; `CFG.gemXpEarly` (an early
gem-XP ramp) exists and is 0 (it flattened the P0-P2 spread too much).

**Card pool** (`upgrades.ts`): the NEW weapons (passives) of an offer share the
weight the slice's 7 (8) candidates had, however big the Season 2 pool is (20 + 16
items no longer drown the upgrades of what the build holds); while the hero holds
only its starter weapon every offer shows one NEW weapon (builds form even when
the pool is wide). The slice's own pools are unaffected by the normalisation.

**Stage toughness** (`StageDef.scaling`, `StageScaling` in `stage.ts`, defaults in
`config.ts DEFAULT_SCALING`, read through `World.scaling`): regular-enemy HP x
`hp x (1 + a m' + b m'^2 + c m'^3)` with `m' = minutes x pace`, contact / shot damage
x `dmg x (1 + dmgPerMinute x max(0, m - dmgFrom))` (`World.enemyDmgMul()` for
bullets that don't use `e.dmg`), spawn rate x `spawn`, phase caps x `cap`, enemy
speed x `speed`, boss HP x `bossHp`, adaptive-toughness ceiling `adaptMax`. Every
stage uses the curve `[0.65, 0.03, 0.032]` (Dream Meadow's) on its own roster's base
stats; the tier and the stretch differ:

| Stage (intended) | hp tier | pace | HP x at 1:00 / 3:00 / final boss | damage x at 1:00 -> final boss | spawn / speed |
| --- | --- | --- | --- | --- | --- |
| Dream Meadow (P2) | 1.45 (was 1) | 1.08 (1) | 2.6 / 6.5 / 57 (9:00) | 1.8 -> 2.4 (+4 %/min) | own timeline (x1.4 rates, caps 75-260) / 1 |
| Candy Kingdom (P3) | 2.1 (1.3) | 1.05 (0.85) | 3.7 / 9.1 / 130 (11:00) | 1.8 -> 2.5 (+4 %/min) | x1.4 / x1.15 |
| Shoujo Academy (P4) | 3.4 (2.5) | 0.68 (0.62) | 5.0 / 9.3 / 106 (13:00) | 1.8 -> 2.7 (+4 %/min) | x1.4 / x1.15 |
| Beach Episode (P5) | 7.5 (5.5) | 0.6 (0.55) | 10.6 / 18 / 245 (15:00) | 1.8 -> 5.8 (+16 %/min) | x1.4 / x1.15 |
| The Final Arc (P5-P6) | 3.2 (1.8) | 0.68 (0.6) | 4.7 / 8.7 / 267 (19:00) | 1.8 -> 6.7 (+15 %/min, was +13) | x1.4 / x1.15 |

(The tiers and boss HP were raised again by the verification pass, 6.7: the combat-curve pass tuned against
synthetic checkpoints, and the average player's real account - Hoshi, the starter, and the Merch Machine's
relics - cleared every stage at about half the target hours; the "was" values in brackets are that pass's.)

(The old single global curve gave x119 at 20:00 on every stage.) The long stages
grow x19 (Beach, 1:00 -> 15:00) and x42 (Final Arc) across the run, like Dream Meadow's x19; their late
game is carried by the **damage ramp** (armour, HP and dodging decide it, not
sponge HP: a P5 Beach build kills as fast at 14:00 as at 2:00). The early tiers
scale with the account the stage is meant for (a P5 account has ~3.5x a P2's early
DPS); the Final Arc's opening is deliberately softer (x2.5) so P5 survives it and
dies later.

**Early threats** (mixes): a Lv 1-5 starter kit one-shots fodder, and fodder feeds
XP (more puffs made a fresh save *stronger*); pressure comes from what reaches you.
Dream Meadow's 1:00-3:00 mix leans on boos / eyepuffs / shroomies (rates x1.4, caps
75 / 120 / 160 in the first three minutes); Candy adds lollipop mages and the first
donut rollers in the first two minutes, the Academy council ninjas (shurikens) from
0:30, the Beach watermelons (seed fans) from 0:30; enemies are 15 % faster from stage
2 on (a strong account out-ran slow melee).

**Bosses**: **fixed HP** (`CFG.bossHpPerLevel = 0`, deliberate: the old level
scaling soaked up account power - a max account fought Cancel-sama at x1.8 HP and
P7 cleared no more than P6), each set for its stage's intended checkpoint:

| Boss | HP (combat pass; slice) | Boss | HP (combat pass; slice) |
| --- | --- | --- | --- |
| King Puff (3:00) | **12,000** (10,000; 2,600) | Council President (7:00) | **125,000** (100,000; 70,000) |
| Nightmare Teddy (6:00) | **65,000** (45,000; 17,500) | Bishounen (13:00) | **230,000** (180,000; 200,000) |
| Lady Lunatic (9:00) | **82,000** (58,000; 34,000) | Kraken-chan (8:00) | **270,000** (210,000; 160,000) |
| Gingerbread Golem (6:00) | **90,000** (60,000; 30,000) | Firework Dragon (15:00) | **430,000** (330,000; 420,000) |
| Sugar Plum Tyrant (11:00) | **200,000** (120,000; 90,000) | Truck-kun (8:00) | **520,000** (400,000; 300,000) |
| | | Rival-chan (14:00) | **600,000** (460,000; 650,000) |
| | | Cancel-sama (19:00) | **1,650,000** (1,500,000; 1,400,000) |

(Bold: the verification pass (6.7). The slice values were scaled x0.5-1.8 by the player's level; the
Season 2 ones are what the boss has.)

Unchanged from the slice pass: combo windows / refills, Overdrive (+0.3 per kill
capped at 1.25/s, +8 elite, +30 boss, +0.55/s), the director's pressure floor
(below 80 % of the cap the rate is boosted up to x4) and adaptive toughness (from
3:30, below 55 % of the cap new spawns gain up to +150 % HP; `adaptMax` per stage,
all at the default), hurt i-frames 0.5 s, lanterns every ~16 s, the gem merge.

### 6.4 Results: the power-vs-stage matrix

`node tools/matrix.mjs --seeds 1-4 --name after` (8 checkpoints x 5 stages x Hoshi
/ Rin / Kuro x 4 seeds = 480 runs, mid bot); raw runs and per-cell tables in
`tools/results/matrix-{before,after}.{json,md}`, the "before" measured on the
pre-pass sim (old curve, old card weights, level-scaled bosses) with the same
checkpoints and the same mid bot. With 12 runs a cell's clear rate has a standard
error of ~14 points: read the grid as a whole.

Clear rate (median death time of the runs that died), mid bot, before -> after; **bold** = the stage's intended checkpoint.

| | Dream Meadow | Candy Kingdom | Shoujo Academy | Beach Episode | The Final Arc |
| --- | --- | --- | --- | --- | --- |
| P0 | 67% (7:03) -> 0% (2:49) | 25% (4:53) -> 0% (1:42) | 0% (4:50) -> 0% (1:06) | 0% (3:01) -> 0% (0:28) | 0% (1:35) -> 0% (0:20) |
| P1 | 92% (11:14) -> 17% (3:45) | 33% (7:56) -> 0% (2:06) | 0% (7:43) -> 0% (1:15) | 0% (6:38) -> 0% (1:11) | 0% (1:28) -> 0% (1:09) |
| P2 | **100% -> 67% (5:58)** | 67% -> 0% (7:12) | 8% (9:26) -> 0% (2:08) | 0% (7:10) -> 0% (2:06) | 0% (1:55) -> 0% (1:10) |
| P3 | 100% -> 92% (4:37) | **67% (13:55) -> 50% (9:38)** | 17% (10:51) -> 0% (7:40) | 0% (12:01) -> 0% (2:47) | 0% (4:57) -> 0% (1:13) |
| P4 | 100% -> 100% | 92% -> 92% (9:58) | **58% (11:46) -> 50% (10:50)** | 17% (17:34) -> 17% (7:14) | 0% (10:46) -> 0% (3:51) |
| P5 | 100% -> 100% | 100% -> 100% | 100% -> 100% | **67% -> 75% (16:08)** | **17% (14:27) -> 33% (5:40)** |
| P6 | 100% -> 100% | 100% -> 100% | 100% -> 100% | 92% -> 100% | **42% -> 75% (16:58)** |
| P7 | 100% -> 100% | 100% -> 100% | 100% -> 100% | 92% -> 100% | 42% -> 92% (18:17) |

Boss fight length (s, median of kills, killed / reached) at the intended checkpoint(s), after:

| Stage | Checkpoint | Bosses |
| --- | --- | --- |
| Dream Meadow | P2 | king puff 23 (10/12); nightmare teddy 33 (9/10); lady lunatic 90 (8/8) |
| Candy Kingdom | P3 | gingerbread golem 58 (11/11); sugar plum tyrant 96 (6/6) |
| Shoujo Academy | P4 | council president 77 (11/12); bishounen 115 (6/7) |
| Beach Episode | P5 | kraken chan 50 (12/12); firework dragon 99 (9/12) |
| The Final Arc | P5 | truck kun boss 113 (8/8); rival chan 118 (6/6); cancel sama 238 (4/5) |
| The Final Arc | P6 | truck kun boss 58 (12/12); rival chan 66 (12/12); cancel sama 153 (9/9) |

Early-game feel (medians), after:

| Stage @ checkpoint | 1st level-up | level-up gap 0:20-3:00 | longest gap (no boss) | level 1/2/3 min | damage taken 0-1:30 / 1:30-3:00 | kills/s min 1-3 | alive min 1-3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dream Meadow @ P0 | 2.2 s | 9.3 s | 39 s | 9 / 12 / 14 | 65 / 60 | 8.1 / 10.5 / 7.2 | 42 / 81 / 136 |
| Dream Meadow @ P2 | 1.3 s | 9.0 s | 26 s | 10 / 17 / 25 | 4 / 0 | 11.4 / 17.2 / 31.0 | 35 / 65 / 87 |
| Candy Kingdom @ P3 | 1.2 s | 5.5 s | 30 s | 12 / 22 / 29 | 0 / 0 | 8.2 / 15.8 / 22.3 | 30 / 49 / 60 |
| Shoujo Academy @ P4 | 1.3 s | 7.0 s | 38 s | 10 / 15 / 26 | 18 / 15 | 10.6 / 13.7 / 22.6 | 29 / 70 / 64 |
| Beach Episode @ P5 | 5.2 s | 8.0 s | 48 s | 12 / 18 / 23 | 32 / 19 | 8.9 / 15.1 / 19.8 | 42 / 82 / 86 |
| The Final Arc @ P5 | 3.6 s | 5.3 s | 28 s | 20 / 27 / 34 | 31 / 72 | 15.8 / 32.6 / 44.1 | 42 / 61 / 63 |
| The Final Arc @ P6 | 4.9 s | 5.5 s | 16 s | 25 / 31 / 36 | 0 / 0 | 24.9 / 48.4 / 61.5 | 28 / 38 / 42 |

**Bots** at the intended checkpoints (`--bot lazy,good`, `tools/results/matrix-bots`;
the mid bot is the average player between them):

| Stage @ checkpoint | lazy | mid | good |
| --- | --- | --- | --- |
| Dream Meadow @ P2 | 33% (4:38) | 67% (5:58) | 67% (5:42) |
| Candy Kingdom @ P3 | 8% (8:38) | 50% (9:38) | 75% (10:49) |
| Shoujo Academy @ P4 | 0% (9:05) | 50% (10:50) | 75% (12:46) |
| Beach Episode @ P5 | 25% (9:02) | 75% (16:08) | 92% (16:42) |
| The Final Arc @ P6 | 75% (16:51) | 75% (16:58) | 75% (18:08) |

**P7 at heat** (`--twists mid|max`, `HEAT_SETS`): heat 0: 92% (fights truck kun boss 38 s, rival chan 41 s, cancel sama 84 s); heat 12: 75% clears (12 runs, deaths at 16:14; fights truck kun boss 36 s, rival chan 34 s, cancel sama 58 s); heat 41: 58% clears (12 runs, deaths at 15:13; fights truck kun boss 53 s, rival chan 74 s, cancel sama 145 s).

### 6.5 Notes and deliberate deviations

- **Heroes differ a lot at low power.** Hoshi (homing Star Shot + Supernova on the
  boss) is the strongest Dream Meadow hero: King Puff in ~5-10 s where Rin / Kuro need
  30-60 s; the grid's 3-hero medians sit between. Akane (knockback fan), Senpai and
  Truck-kun (ram / honk) level slowly and die early at P0-P2 (Akane Lv 5-8 and
  200-600 kills by 2:30 where Aoi has ~2,500). They unlock at P4+ / from the Merch
  Machine, so the curve is unaffected, but a hero-balance pass should look at them.
- **A frontier stage's opening is a power fantasy for the upper checkpoint.** P6 in
  the Final Arc takes no damage in the first minutes (Lv 22 at 1:00 from start Lv 8 and
  +66 % XP, 1.6x move speed, 31 % damage reduction): an opening that touches it walls
  P5 (tested: x5 opening HP killed P5 at ~2:00). The stage bites from ~5:00; every
  intended checkpoint whose stage is its frontier (P0-P5) takes damage in the first 3:00.
- **P7 is only ~1.3x faster on bosses than P6** (Cancel-sama ~95 s vs ~130-180 s): the
  checkpoint gap is modest (ring 5 is mostly small stats). P7's keystones / relics are
  set explicitly (META.md §9.1) - the value policy's Glass Cannon made P7 *weaker* than P6
  against the damage ramps.
- **Long stages end above x100 HP** (Beach x145 at 15:00 on a x5.5 tier, Final Arc x107):
  the growth across a stage stays x19-42 (Dream Meadow x19), so late enemies die about as
  fast relative to the build as early ones; the danger is the damage ramp.
- **Boss fight lengths are noisy** (+-40 % between matrix runs with the same HP, the
  hero mix dominates); the HP above sit in the middle of several runs.
- **A sim crash fixed on the way**: the Sandcastle Golem's blast hook re-entered itself
  (crumble -> kill -> a talent / relic explosion -> blast) and spliced the pile list
  mid-loop (`TypeError` in `sandcastle-golem.ts`); it now walks a snapshot.


### 6.6 Economy pass: account progression against the curve

The combat curve (6.1-6.5) says *how strong* an account must be for each stage; the
economy decides *when* the account gets there. Tuned with the progression simulator
(`node tools/progression.mjs`, docs/META.md §9: a bot plays real runs with the account's
RunConfig, banks them with `applyRunToProfile` and spends like a player), mid bot =
the average player, weak = the lazy bot, strong = faster and tidier than the autoplay bot.

**Method.**

1. `node tools/matrix.mjs --stats` cells (P0-P7 x every stage, Hoshi / Kuro) keep each
   run's RunStats, so a payout / hero XP / mastery formula can be priced offline at known
   power before a progression run (`tools/results/matrix-econ-data.json`).
2. Short progression runs (mid x 4 seeds, 3-30 h) after each change; `--save-at 22` dumps
   the accounts so the late game can be replayed with `RESUME=` without the first day.
3. The final before / after: weak / mid / strong x seeds 1-2 (the "before" is the economy
   as the combat-curve pass left it, same tool and player model).

**What the first measurements showed** (before): the mid bot cleared every stage in 8 h
and bought the whole board by 30 h. Three things carried it:

- *Payouts grew with raw power, not the stage*: once a build is maxed every level-up is
  a 50-coin Star Pouch, so a strong Dream Meadow clear paid ~5k coins (a fresh death 66).
- *The early Plot Point flood*: ~8k gems in the first 5 runs (a 10-pull every ~2 runs)
  and 1,000-5,000-coin rewards (Plushie Purge at run 3 bought half of ring 1); gacha relics
  (an SSR / UR set by hour 2-8) were worth more than a whole checkpoint of board.
- *Hero XP / mastery*: Lv 30 at 14 h, a mastery-10 weapon at 4 h.

**What changed** (numbers: META.md §4):

- **Payout** = coins picked up (kept small: 0.2 % drop chance, Star Pouch 3) + episode
  bonuses (time with the first 2:00 counting double, bosses, clear, kills) x greed x rank x
  the stage's **Ratings** (1 / 1.5 / 2 / 5 / 8), then heat / curse. A run's coins now track
  the stage it was played in: a 90 s death still buys a ring-1 node, a Dream Meadow clear
  pays ~730, an Academy clear ~1.4k, a Beach clear ~3.3k, a Final Arc clear ~10k (heat 0).
- **Gems**: every Plot Point gem reward halved (joke numbers and the first-pull pair kept),
  first clears / first boss kills / codex halved, the per-run stipend scaled by Ratings^0.5.
- **Plot Point coins** cut so none buys a ring (Pilot Episode +40 so run 1 buys 3-4 nodes).
- **Hero XP**: `120 L^1.3 1.06^(L-1)` per level (Lv 30 = 418k XP), kill XP / 5, XP x
  Ratings^0.3, x3 catch-up for heroes more than 2 levels behind the best one.
- **Mastery**: thresholds 500 ... 10M XP (rank 10 = 10B damage with the weapon).
- **Board**: ring 1 25 -> 15 a rank (so a fresh 2:30 death buys two nodes); the
  checkpoints keep their ranks (META.md §9.1 coin values repriced).
- **Unlocks**: Paper Crane Flock at 600 lifetime evolutions (was 10): the 40-60 h unlock.
- **Player model**: a try-out run for every newly unlocked hero; after a short frontier
  death (under 40 % of the stage) one farming run on the last cleared stage; hero levels
  with coins when nothing is open on the board; the endgame heat ladder + hero rotation.

**Results** (`tools/results/progression-{before,after}.md`; weak / mid / strong x seeds 1-2,
median hours; "after" = 160 h per account with stride 6 after the first Final Arc clear,
"before" = 60 h, n/r = not reached in that time):

| Milestone | Target (mid) | weak before | weak after | mid before | mid after | strong before | strong after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| First King Puff kill | runs 3-6 | run 2 | run 5.5 | run 2 | run 4.5 | run 2 | run 1.5 |
| Dream Meadow clear | 1.5-3 h | 0.65 h | 1.26 h | 0.43 h | 0.70 h | 0.38 h | 0.72 h |
| Candy Kingdom clear | 4-7 h | 2.68 h | 2.89 h | 1.07 h | 2.28 h | 0.67 h | 1.66 h |
| Shoujo Academy clear | 8-14 h | 6.36 h | 10.0 h | 1.87 h | 5.19 h | 1.11 h | 4.82 h |
| Beach Episode clear | 15-25 h | 9.04 h | 26.4 h | 3.55 h | 9.68 h | 2.46 h | 8.89 h |
| Final Arc clear | 30-45 h | 13.9 h | 38.6 h | 8.17 h | 20.1 h | 4.56 h | 12.6 h |
| All gameplay heroes + weapons | 40-60 h | 6.36 h | 80.4 h | 1.87 h | 47.7 h | 1.11 h | 40.6 h |
| Board fully bought | 100-150 h | 46.4 h | n/r (3.5M of 4.85M at 150 h) | 30.5 h | 145.1 h | 31.1 h | 144.9 h |
| Main hero Lv 30 | ~80 h (P6) | 17.8 h | 81.9 h | 14.1 h | 71.7 h | 13.7 h | 80.1 h |
| A weapon mastery 10 | ~80 h (P6) | 8.95 h | 132.9 h | 4.15 h | 116.6 h | 3.11 h | 101.0 h |
| Heat 16 clear | - | 42.9 h (1 of 2) | 106.8 h (1 of 2) | 36.1 h | 85.4 h | 40.4 h | 98.1 h |
| Max heat (41) clear, every hero Lv 30, mastery 10 on all 20 | 200 h+ | n/r | n/r | n/r | n/r | n/r | n/r |

- **On target** (mid): King Puff at run 4-5; all heroes + weapons 48 h; the board 145 h;
  main hero Lv 30 72 h; the 200 h+ goals still open at 160 h (heat 32 cleared once at
  130 h). Weak is ~1.6x slower (median ratio over the clears and rings), as asked. Late:
  the first mastery-10 weapon (~117 h; the P6 contract has it at 80 h, the account is at
  rank 9 there - a 3 % damage step).
- **The account against the §9.1 contract** (mid, 3 / 8 / 15 / 30 / 80 / 150 h): board coins
  8.4k / 39k / 106k / 302k / 1.57M / 4.85M against 1.9k / 20k / 84k / 399k / 2.30M / 4.85M
  (a third of a ring ahead in hours 3-15, ~25-30 % behind at 30-80 h), hero Lv 9 / 14 / 18.5
  / 23 / 30 / 30 against 10 / 15 / 20 / 25 / 30 / 30, signature mastery 3 / 5 / 7 / 8 / 9 /
  10 against 3 / 5 / 7 / 8 / 10 / 10. Relics run ahead: a UR + SSR set by 5-8 h (the
  contract has SR + R at 8 h and its first UR at 30 h).
- **The stage clears still land at ~0.45-0.67x of their hour targets** (before: ~0.25-0.3x).
  The account is on the contract's board power when they happen; the mid bot clears each
  stage about one checkpoint below its intended one (matrix §6: Dream Meadow 17 % at P1,
  Beach 8-17 % at P4, the Final Arc 33 % at P5) and, with its ahead-of-contract gacha
  relics and ~6-8 runs an hour, gets those clears early. Slowing the economy
  further would push the board past 150 h and empty the Results screen; this needs the
  combat side (a steeper clear-rate drop below each intended checkpoint, or relic stat
  values / checkpoint relic sets that match the gacha's real output).
- **Strong is ~0.95x mid, not ~0.6x**: coins, hero XP and gems pay for time played, so a
  stronger player earns about the same per hour (longer runs, fewer of them), and the
  stage clears are dominated by the retry tail above (strong is 0.63x on the Final Arc).
- **The hook** (first 10 h): every account's first-hour runs all buy a board node; mid
  buys after ~90 % of its runs in hours 0-5 and ~55 % in hours 6-10 (ring 2 is done by
  ~7 h and ring-3 ranks cost 1,500+ against 400-1,600-coin runs) - 79 % over the 10 h
  (weak 61 %, strong 84 %; before 95 / 76 / 86 % with the board ~6x underpriced). Longest
  gap without a board buy in the first 10 h: 0.31 h / 1 run (weak 0.33 h / 3 runs); over the
  whole run 2.8-2.9 h / 7-9 runs in ring 5 (~135-150 h, 50-130k-coin ranks) while hero levels,
  pulls and heat badges keep coming (longest gap without any progress event 1.1-1.3 h / 3-4 runs).
- **First-hour wins / starter pulls**: no starter gems; run 1 (a ~2:00 death: ~40 coins + the
  Pilot Episode Plot Point's 160 ♦ / 40 ★) buys 5 ring-1 ranks and the first single pull, "Just One Pull" pays
  it back, the first 10-pull comes at ~run 7 (0.5 h; the King Puff / first-clear gems).
  The Merch Machine then gives a 10-pull every ~5.5 runs in hour 1, every 9-20 runs from 1 h
  to 80 h (kept there: the relics already run ahead of the contract) and every ~4.6 runs late.
- **Player-model sensitivity** (`progression-after-push`: the same economy with a player
  that never farms, Paper Crane Flock still at 1,000 evolutions): Dream Meadow 0.70 h,
  Candy 1.38, Academy 4.35, Beach 8.38, the Final Arc 15.1 h, the board 143 h; mid buys a
  node after 63 % of its first-10 h runs.

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
| Account layer | `src/meta/**`, `src/ui/save.ts` (the only storage boundary) | pure (no DOM / localStorage); numbers in `meta/tuning.ts`; Plot Points = files in `meta/achievements/defs/` |
| Debug / tests | `src/debug/**`, `tests/**`, `scripts/e2e.mjs`, `scripts/icons.mjs` | |

Parallel content work: one agent per new file in `weapons/`, `enemies/`,
`bosses/`, `ultimates/`. Shared files that need a line or two:
`stages/<stage>.ts` (timeline tuning), `view/trails.ts` (new trail looks),
`game/events.ts` + `view/feedback.ts` (new event types).

---

## 8. Verification

**Start with `npm run doctor`** (~25 s: typecheck, fast tests, sprites, CSS collision lint, audio cost budget + the
profile each device gets + Android focus recovery, bundle budget, artifact CSP boot) and `npm run scenes` for anything
visual (docs/DEVTOOLS.md §5-7, CLAUDE.md). docs/DEVTOOLS.md §8 shows each check catching the Season 2 bug it exists
for, and §9 has the measured before / after.

```
npm run doctor                 # every cheap gate in parallel, one pass / fail table (--scenes, --all)
npm run scenes                 # 29 key screens x i13 + desktop (Kuro's ult filmed) with blackout / murk / illegible-text /
                               # placeholder / overflow / error flags; --only "ult:kuro~180/15" films one scenario
npm run typecheck
npm test                       # the FAST suite (~8 s): everything not tagged "slow" (vitest.config.ts)
npm run test:slow              # tests tagged { tags: ["slow"] }: full stage runs, 3-minute bot runs (all heroes),
                               # relic / talent sweeps, Dream Meadow parity, fuzzers (~40 s)
npm run test:all               # both (the pre-split `npm test`): unit + headless bot runs, bosses, ults, determinism,
                               # run integrity, AutoQuality / save validation / fmtNum (tests/quality.test.ts)
                               # (testTimeout 60 s, 240 s for "slow": the full-run sims take 5-9 s on a loaded machine)
node scripts/e2e.mjs           # (~2.5 min: the 3 devices in parallel, one browser each; --serial ~5 min)
                               # desktop + mobile portrait + mobile landscape: splash -> hub -> PLAY -> episodes -> loadout
                               # -> START EPISODE -> run -> quit -> Episode Results -> hub; hub pages (board buy, talents,
                               # pull, wiki, settings export, Android Back); autoplay level-up / chest / pause / results
node scripts/shot.mjs --path "/?autoplay=1&hero=rin&skip=150" --mobile --wait 5000 --out shots/x.png
node scripts/flows.mjs         # Season 2 account flows on portrait / landscape / iPhone SE / desktop (section 11):
                               # --only portrait,se --flow fresh,v1,endless,nav,keys --out shots/flows --keep-going
node scripts/touch.mjs         # touch-only Training Arc checks on iPhone 13 (CDP touch: one-finger pan, drags over
                               # stars never press them, tap opens a node sheet, pinch zoom)
npm run balance                # headless full-run balance probe: 3 heroes x 10 seeds x good + lazy bot (section 6);
                               # CP=P2 STAGE=candy_kingdom BOT=mid plays an account checkpoint's RunConfig
node tools/matrix.mjs          # power-vs-stage matrix: checkpoints P0-P7 x 5 stages x heroes x seeds (section 6)
npm run progression            # account progression simulator (docs/META.md §9; BOT=weak|mid|strong RUNS=...)
npm run build && npm run build:single   # dist/ (Pages) and dist-single/index.html (standalone, works from file://)
```

**Fast path (docs/DEVTOOLS.md §3):** `/?scenario=<name>&step=1` reaches any moment in under ~1 s and
`__kk.step(n)` advances it deterministically (one synchronous draw at the end), so screenshots never
wait on headless frame rates. The notes below are for live (rAF) pages.

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

Debug params that bend a run (`?god=1`, `?skip=`, `?speed=`) turn even a hub START EPISODE
into a **practice run** (never banked, never stashed; Results says PRACTICE RUN · NOT SAVED);
`?seed=` is allowed on account runs. The `__kk` hooks (`__kk.god()`, `__kk.skipTo()` ...) do
not change that: scripts use them to fast-forward real account runs.

Handy URLs: hub deep links `/?screen=hub|stages|loadout|board|heroes|gacha|wiki|settings`,
`/?screen=hero&hero=rin&tab=talents`, `/?screen=gacha&tab=exchange`, `/?screen=wiki&tab=plot`; `/?autoplay=1&skip=185&god=1`
(boss), `/?fps=1`, `/?seed=42&hero=mochi`. Console: `__kk.levelUp()`,
`__kk.chest(true)`, `__kk.ult()`, `__kk.spawn("shroomie!", 3)`, `__kk.skipTo(170)`,
`__kk.clearWeapons(); __kk.give("rainbow_cannon")` (isolate a weapon), `__kk.give("twin_charm", 3)`,
`__kk.time.paused = true` (freeze sim + fx for a mid-action screenshot),
`__kk.boss("lady_lunatic")` (boss now; `true` = with the WARNING), `__kk.bossHp(0.2)` (jump to a phase),
`__kk.enrage()`. Boss screenshots: `/?screen=game&hero=rin&god=1&skip=355` (no autoplay: the hero stands
still, the boss comes to it), then `__kk.clearWeapons()` and `__kk.world.director.spawnMul = 0`.

Season 2 run configs from the URL (`debug/params.ts debugRunConfig`; any of them builds a RunConfig):
`/?screen=game&endless=1&skip=548&god=1` then kill Lady (`__kk.bossHp(0.001)`) -> the Filler Arc,
`&relics=sakuga_cel:6,sentai_badge:3`, `&talents=hoshi_encore,hoshi_choreography:5`, `&cons=6`,
`&twists=budget_cuts:3,spoilers`, `&flags=banish:3,skip:2,dashCharges:2`, `&lb=star_shot:2`,
`&stage=<id>`, `&startLevel=5`, `&slots=7,7`. Console: `__kk.relic(id, stars)`, `__kk.twist(id, rank)`,
`__kk.endless()`, `__kk.stageFx("renderScale", 0.5)`, `__kk.runStats()`. Season 2 shots (Dream Meadow
old-vs-new parity, Filler Arc, relic procs, dash pips + shield, banish / skip level-up on 3 devices):
`shots/sim-core/`.

---

## 9. Meta layer (account progression)

`src/meta` turns the profile into a `RunConfig` and a finished run back into
profile progress; details, formulas and APIs in **docs/META.md**.

```
save.profile --buildRunConfig(profile, choice)--> { hero, config } --> new World({ hero, run: config })
World.summary() --applyRunToProfile(profile, summary)--> RunReport (payout lines, XP, mastery, unlocks, Plot Points)
```

- Storage: `src/ui/save.ts` only (`kko.save.v2`; v1 migrated once and kept; corrupt
  data repaired or set aside, never fatal).
- Content: every meta function reads a `MetaContent` catalogue (`gameContent()` from the
  registries, or a fixed one in tests), so account rules never depend on how much
  content has shipped.
- Adding content: a Plot Point is a new entry in `src/meta/achievements/defs/<group>.ts`
  (or a new file there); an unlock condition is a row in `UNLOCK_RULES`; a board node is
  a spec in `src/meta/board/data.ts` (ids are save keys: never rename, removed ids are
  refunded); numbers go in `src/meta/tuning.ts`.
- Tests: `tests/meta.*.test.ts`. Economy: `npm run progression`.

---

## 10. Hub UI (Season 2, `src/ui/hub`, `src/ui/kit`)

The title / select / Dream Shop screens are gone: after the splash the App
shows one `Hub` screen (`ui/hub/hub.ts`), a **navigation stack** of pages over
the live attract game, under a persistent header (Back, page title, currency
bar, settings).

```
splash -> Hub [home] -> stages -> loadout -> START EPISODE -> run -> TO BE CONTINUED / victory -> Episode Results
                     -> board (Training Arc)                                 results: UPGRADE -> Hub [home, board]
                     -> heroes -> hero (profile / talents / constellation)             RETRY   -> same plan again
                     -> gacha (Merch Machine)  -> wiki (codex + Plot Points)           HUB     -> Hub [home]
```

- **Settings** from the hub has GAME + SAVE DATA tabs; from the pause menu only
  GAME (an import / reset mid-run would bank the live run into another profile).
  After an import / reset the panel re-reads the new profile's settings object.
- **Pages** are `HubPage` objects built by a factory in `PAGES` (`hub.ts`):
  `{ id, el, title, layer, music?, opaque?, camAnchor?, show?, update?, dispose? }`.
  `hub.open(id, opts)` slides a page in from the right (the old one slides left
  and is hidden, keeping its state and scroll); `hub.back()` reverses it and
  disposes the page; `hub.popTo(id)`. A page's first keyboard / gamepad focus
  is its `data-nav-default`, else its first item: the header is
  `data-nav-chrome`, so a gamepad A on a fresh page never presses Back. A page sliding out is `inert` at once:
  it stays visible for the 300 ms slide but can neither take the keyboard /
  gamepad focus (`Nav.items` skips `[inert]`) nor a second tap. A confirm press
  on a focus that went stale refocuses the default instead of clicking it. Transitions are transform / opacity
  only (`.p-in-r` ...). Each page's NavLayer roots at the whole hub, so the
  header buttons and the visible page share keyboard / gamepad focus; hidden
  pages drop out (`offsetParent === null`). `show()` runs when a page is on top
  again (re-read the profile). Deep links: `App.start` maps `?screen=` to a
  path (`["home", "board"]`), `?hero=` / `?tab=` become `PageOpts`.
- **Adding a page**: a file exporting `xxxPage(hub, opts): HubPage`, a `PageId`
  + entry in `PAGES`, a tile / button that calls `hub.open("xxx")`. Mutate the
  profile only through `src/meta` functions, then `hub.changed()` (saves and
  counts the currency bar to the new balances with gain pops).
- **Account runs**: loadout START -> `App.startAccountRun()` ->
  `save.runPlan()` (repaired loadout -> RunConfig; never throws) ->
  `startRun(hero, true, config, { account: true })`. The legacy `meta` option
  is never passed with an account config. `App.bankRun()` banks a finished run
  exactly once (`save.recordRun` -> `RunReport`): as soon as its outcome is final
  (the TO BE CONTINUED modal with no revive left, the victory modal; closing the
  app there loses nothing), else from Results / the game-over RETRY; RETRY of an
  account run re-plans (the profile just changed). The game-over RETRY also
  claims the Plot Point rewards (when one pays gems / coins: `cashClaimable`,
  the same rule as leaving Results) and queues its unlocks
  (`save.pendingUnlocks`): the next Results (or the hub home) celebrates them.
  TO BE CONTINUED makes RESULTS the big default for episodes 1-3 (RETRY small),
  RETRY from episode 4. A first clear points the loadout at the episode it
  unlocked (PLAY reads "EP. N · Candy Kingdom"; the card says NEW EPISODE!).
  **Practice runs** (deep links / `?autoplay` / `?screen=game` / `?god` /
  `?skip` / `?speed`, which play the debug RunConfig) never touch the account: `App.practice`,
  `save.previewRun` (the report on a throwaway copy), a "PRACTICE RUN · NOT
  SAVED" tag on Results, no CLAIM ALL, no in-run Plot Point toasts, and the
  saved loadout's hero is left alone.
- **Episode Results** (`screens/results.ts`): beats on frame time from
  `update()` - payout lines (coins, then gems) count up with ticks, totals pop
  and the currency bar counts; hero XP fills level by level (LEVEL UP!), mastery
  bars (RANK UP / LIMIT BREAK! / MASTERED!), Plot Point cards (CLAIM ALL),
  record chips, the NEW UNLOCK celebration per unlock, the narrator's "Next time
  on..." line, "You can afford: ...". Tapping the show skips to the end; reduced
  motion shows the end state at once. UPGRADE opens the board centred on the
  cheapest affordable node. Leaving by UPGRADE / RETRY / HUB / Back claims any
  unclaimed gem / coin Plot Points (CLAIM ALL stays the juicy optional moment);
  after a claim "You can afford" is recomputed (board nodes, a pull / a
  10-pull). The NEW ... UNLOCKED! cards are never lost: a skip (or reduced
  motion) shows them at once, unlocks a TBC RETRY skipped come first, and a
  button pressed before their beat shows them first, then acts. A failed bank
  (storage full / blocked) adds a "Saving failed" line under the currency bar.
- **Unlock celebrations** (`celebrateUnlocks`): a kind unlocked 3+ times at once
  is one card ("6 NEW PLOT TWISTS!": icon grid + a line per item, a twist's
  rank-1 effect), a sequence is at most 4 cards (the last sums up the rest),
  and every kind has its own narrator pool (satire.md §8). Opaque plum base
  under the per-kind glow: nothing behind shows through.
- **Boot notices** (`hub/celebrate.ts homeNotices / bootNotices`, once per
  session and again after START OVER / IMPORT (`App.onProfileReplaced` ->
  `resetBootNotices`), at home): a notice for a set-aside unreadable save (the
  damaged copy stays; Settings -> SAVE DATA can copy / discard it), the WELCOME
  TO SEASON 2 dialog for a first v1 migration (refund, 10-pull gift, Rin +
  Mochi), "Episode N was interrupted" for a run banked at boot (on any hub
  page), one celebration for boot-reconciliation unlocks + queued unlocks, and
  Plot Points the profile already qualifies for (one toast pointing at the
  Wiki). Later home visits celebrate unlocks queued since.
- **Home guidance**: ONE spotlit tile gets the red badge + glow (never pulled
  and can pull > affordable board node > free talent points > Wiki rewards >
  another pull); other tiles with news get a quiet dot; before episode 1 only
  PLAY glows. The narrator types a one-time coach line for the spotlit tile
  (`profile.tutorial.flags.coach_<tile>`, set once it was read on screen). The
  "Previously on..." recap is told by outcome (survived / walked off the set /
  SAVED ... (first clear!) / the filler ran ...).
- **Copy**: every satire line comes from the content bible through
  `hub/copy-data.ts` (episode titles, next-time lines, death lines, tips,
  taglines, grade comments, wiki blurbs, OC bios, gacha lines);
  `hub/copy.ts pick()` never repeats one of the last 10 picks of a pool.
- **Art**: Season 2 sprite ids go through `kit/art.ts` (`currencyIcon`,
  `relicIcon`, `twistIcon`, `portrait`, `rarityBadge` ...): the real pixels as
  soon as the atlas has them (`hasArt`), a styled CSS stand-in until then (never
  the magenta placeholder).

### Kit (`src/ui/kit`, styles in `kit.css`)

| Piece | API |
| --- | --- |
| Currency bar | `new CurrencyBar(ids?)`, `.set(c)` (jump), `.sync(c, pop)` (count-up + bump + "+120" pop below the pill; gains on one pill within 600 ms merge into one pop) |
| Buttons / chips | `btn(label, { cls: gold\|violet\|cyan\|red\|ghost\|small\|wide, act, icon, sub, badge, def })`, `iconBtn`, `.chip` |
| Tabs | `new TabBar(tabs, initial, onChange)`, `.select(id)`, `.setBadge(id, html)` (scrolls the active tab into view) |
| Cards / rows | `card({ art, kicker, title, body, rarity, act })`, `row({ icon, title, sub, right, act })`, `sectionTitle`, `tag` |
| Badges | `badge(true \| n \| "NEW")` ("!" affordable / new; inside pill buttons it tucks into the curve) |
| Rarity frames | `.rf.r-n \| r-r \| r-sr \| r-ssr \| r-ur \| r-lr \| r-my` (SSR/LR shine, UR rainbow, MYTHIC glitch-rainbow) |
| Progress | `pbar(frac, label, colour)`, `setBar(el, frac)` (transform: scaleX only) |
| Detail sheet | `openSheet(host, { title, kicker, icon, html, foot })` -> `{ body, update(), close() }`: bottom sheet (drag to dismiss) on portrait, side panel in landscape / desktop |
| Confirm | `await confirmDialog(host, { title, body, ok, cancel, danger, okCls })` (default focus = Cancel) |
| Toasts | `toast(host, msg, { kind: info\|good\|bad\|ach\|gacha, kicker, sub, reward, icon, inRun })`: queued, two at once, duplicates within 1.2 s dropped; `inRun` = the bottom strip, clear of the hero and the touch buttons; hub toasts wait while `host.holdToasts()` (the settings panel: `suspendToasts` / `resumeToasts`) |
| Pan / zoom | `new PanZoom(host, content, { bounds, minZoom, maxZoom, far, near, active })`, `.update(dt)` per frame, `go / zoomBy / ensureVisible / fitZoom`: one-finger drag with inertia, pinch, wheel (zoom at the cursor), + / - keys, gamepad right stick + LB / RB; a drag never clicks |
| Ticker | `animate(obj)` / `kitTick(dt)` (App.frame) for number animations; `reducedMotion()` |

Rules: every interactive element is a `<button data-nav>` at least 44 CSS px
tall (board nodes add a 9 px invisible hit ring); overlays push a NavLayer and
call `host.overlayOpened/Closed()` (Back guard), custom full-screen overlays use
`trackOverlay(±1)`; animation is transform / opacity (WAAPI one-shots for
pops / shakes, no forced reflow); pages and cards carry `contain`; every
`prefers-reduced-motion` user gets end states without glides or count-ups;
safe-area insets pad the header, pages, sticky footers and sheets. Screenshot
sweep (desktop, iPhone SE, iPhone 13 portrait + landscape, every hub page):
`node shots/hub-ui/shots.mjs [--only se,i13] [--scenes home,board]`.

### 10.1 Save safety (`ui/save.ts`, `ui/app.ts`)

| Risk | What happens |
| --- | --- |
| Reload / OS tab discard / app kill mid-run, or on TO BE CONTINUED with a revive left | `save.stashRun(world.runStats())` writes `kko.run.pending` `{ v, at, runsAtStart, stats }` for account runs on page hide / pagehide / blur, every 15 s of unpaused play and when TBC offers a revive; `bankRun` clears it. The next boot banks a stash whose `runsAtStart` still equals `lifetime.runs` as DROPPED (or the death it was) -> `save.interrupted` -> "Episode N was interrupted" toast; its unlocks are queued. A window playing an account run holds the shared Web Lock `kko.run.live`: a window booting meanwhile leaves that stash alone (no double bank). |
| Two tabs / windows | Every successful write bumps `kko.save.v2.rev`. A `storage` event reloads `save.profile` (`onExternalChange`: the hub re-renders its page and toasts "Your save changed in another window. Reloaded!"; mid-run nothing changes). A `save()` that finds a newer revision it missed (frozen tab) never overwrites it: it reloads and returns false (`save.conflicted`); `recordRun` re-applies the run to the reloaded profile, so a banked run is never dropped. START OVER / IMPORT always win. |
| Storage full / blocked (shared GitHub Pages quota) | `save()` frees the reset / import backup and retries once (never the damaged-save copy); `writeOk` false -> one console warning + a sticky hub banner "Progress can't be saved on this device..." and a "Saving failed" line on Results; cleared by the next good write. After the first banked account run the app asks `navigator.storage.persist()` once (answer in `profile.flags.persist`). |
| Unreadable v2 save | Raw text kept in `kko.save.v2.corrupt` (never deleted by the game; Settings -> SAVE DATA: COPY / DISCARD). v1 present: re-migrated WITHOUT a second 1,600-gem gift or WELCOME (the `kko.save.v1.migrated` marker, or a damaged v2 over v1, means it was paid). |

Regression tests: `tests/meta.save.test.ts` (stash banked once / discarded, lock deferral,
revision conflict + re-applied run, writeOk, backup freed on quota, one-time gift). Browser
repros: `shots/qa2-fix-b-app-loop-save-safety-hub-flow-results-celebrations-mobile-input-and-settings/`
(`bugs-reload.mjs`, `bugs-flows.mjs --only twotabs`, `bugs-quota.mjs`, `bugs-corrupt.mjs`, `mob-lifecycle.mjs`).

---

## 11. Season 2 integration: the account loop end to end

```
 ui/save.ts (kko.save.v2) ── Profile ──▶ meta/loadout buildRunConfig ──▶ RunConfig ──▶ game/World (+ bot in tools)
        ▲                     (repaired loadout, pools,                        │  world.hooks (never muted)
        │                      board / level mods, mastery,                    ▼
        │                      relic + talent ids, twists, flags)       RunStatsCollector ─▶ RunStats
        │                                                                      │  World.summary().stats
        └── save.recordRun ◀── meta/rewards applyRunToProfile ◀────────────────┘
                 │                (payout lines, XP, mastery, records, codex, unlocks,
                 │                 Plot Points, banner rotation, "you can afford")
                 └─▶ RunReport ─▶ ui/screens/results (Episode Results) ─▶ hub pages (board, heroes, gacha, wiki)
```

One owner per rule (the other layers only pass ids / numbers through):

| Rule | Owner | The other side |
| --- | --- | --- |
| What is playable: heroes, stages, weapon / passive pools, twists, relics owned | `meta/unlocks.ts`, `meta/loadout.ts` | the sim receives plain id lists (`weaponPool`, `passivePool`, `twists`, `relics`) |
| Stat pipeline order (base -> hero -> legacy shop -> `run.mods` -> relics -> talents -> constellation -> passives -> run modifiers) | `World.recomputeStats` | meta contributes only `mods` (board + hero level) |
| Relic / talent / constellation stats and behaviour | the sim, from ids (`relics/`, `talents/`, `heroes.ts`) | never in `mods` (would count twice) |
| Talent tier gating, talent points, relic stars, constellation from copies | `meta/heroes.ts`, `meta/gacha` | the sim trusts the ranks it gets |
| Heat | `game/registry twistHeat` (sim, `RunStats.heat`) and `meta/loadout twistHeat` (loadout meter) | must agree: pinned by a test |
| Twist unlock stage | `TwistDef.unlockedBy` (sim data) and `UNLOCK_RULES` (meta table) | must agree: pinned by a test |
| Payout, hero XP, mastery, records, codex, unlocks, Plot Points, rotation | `meta/rewards.ts applyRunToProfile` | runs once per banked run |
| Banking | `App.bankRun`: account runs once, as soon as the outcome is final (else Results / game-over RETRY); practice runs only `save.previewRun` | |
| Storage | `ui/save.ts` | nothing else touches localStorage |
| Back / focus | `App.onPopState` + `Nav` (sections 2, 10) | pages expose `onBack` through their NavLayer |

**Invariants** (each pinned by `tests/integration.test.ts` and / or `scripts/flows.mjs`):

- fail forward: a fresh account's first death pays for a board node; the node is
  in the next run's stats and nothing else moves;
- nothing in the account config is ignored or applied twice (relic / talent /
  constellation stats, hero level, mastery and Limit Break levels, board slots,
  start level, flags, Prepared Protagonist on the signature weapon);
- loadout heat = sim heat = `RunStats.heat` = the payout's heat line;
- content pools: a run offers only the account's unlocked weapons (+ the
  signature weapon); a fresh account has Hoshi, Dream Meadow and the 8 + 8
  originals;
- every banked run advances the banner rotation once and evaluates Plot Points;
  greed scales the coin bonuses without double-counting pickups; a Filler Arc
  run banks as a clear with its endless time and record;
- debug / deep-link runs never bank; Android Back never leaves the app except
  at the hub home with nothing open; level-up / game over ignore Back; every hub
  page takes the keyboard focus on itself.

**Browser flows** (`node scripts/flows.mjs`, real taps / clicks / keys, shots
in `shots/flows/<device>-<flow>-NN-<step>.png`; devices `portrait` (iPhone 13),
`landscape`, `se` (iPhone SE), `desktop`; every screenshot also fails the run on
a horizontal page overflow or a button cut off at the screen edge):

| Flow | Checks |
| --- | --- |
| `fresh` | empty profile -> hub -> only Dream Meadow open -> only Hoshi playable -> START -> die -> TO BE CONTINUED -> Results (banked once: coins = payout, XP, record, codex, mastery, rotation, Plot Points) -> UPGRADE -> buy a node from its sheet (paid = coins spent) -> next run measurably stronger -> pause QUIT banks run 2 |
| `v1` | a seeded `kko.save.v1` migrates: WELCOME dialog (refund, 1,600 gems, Rin + Mochi), balances / heroes / settings / bests / last hero in `kko.save.v2`, Dream Shop refunded not kept, v1 key kept, Rin and Mochi playable, settings on screen, no second migration on reload |
| `endless` | a cleared profile: FILLER ARC toggle + a twist by tap -> START (endless + heat in the World) -> the final boss falls -> TO BE CONTINUED... JUST KIDDING -> die -> SERIES FINALE?! with Filler Arc + heat lines -> clear, endless record, best heat, rotation banked |
| `nav` | Android Back: closes a sheet, pops pages, pauses after the episode card, resumes / pauses in-run, ignored by level-up and game over, Results -> hub, leaves the page at home |
| `keys` | (desktop) keyboard only: focus lands on each hub page, Enter through home -> episodes -> loadout -> START, Escape pause / resume, arrows steer, Enter picks a card, game over -> RESULTS -> UPGRADE -> board -> Escape home |

**Gates for a foundation hand-off**: `npm run typecheck`, `npm test`,
`npm run build`, `npm run build:single`, `node scripts/e2e.mjs`,
`node scripts/flows.mjs`, `npm run balance`, `npm run progression`,
`node tools/matrix.mjs` (after a balance change).

---

## 12. Season 2 content tables (what ships, where it lives)

Everything below is registered by dropping files into the registry folders (section 4) and is pinned
against the content bible by **`tests/coverage.test.ts`**: ids, names, rarities, evolution pairs, Limit
Break numbers + card texts, talent nodes (tier / branch / ranks), stage lengths / boss times / gating /
tempo, twist ranks + heat + unlock stage, Plot Point categories + unlock rewards, the unlock path of every
earnable item, every sprite id the bible's art manifest lists and every sprite id literal in `src/`,
every sfx / music id a content def names, the Merch Machine pools (every rarity tier filled, Truck-kun
only on the Isekai Express), heroFx kind uniqueness, and the hub copy each entry needs (speech pools,
wiki blurbs, TO BE CONTINUED lines, OC bios). Adding a row to the bible without its content (or drifting
from it) fails there with the exact id.

### Heroes (`game/heroes.ts` + `game/heroes-b.ts`, talents `game/talents/<hero>.ts`, ults `game/ultimates/`)

| Hero | Start weapon -> evolution (+ passive) | Ultimate | Unlock (`meta/unlocks.ts`) |
| --- | --- | --- | --- |
| `hoshi` | `star_shot` -> `galaxy_barrage` (+ `wish_charm`) | `supernova_shower` | start |
| `rin` | `petal_slash` -> `sakura_tempest` (+ `big_ribbon`) | `thousand_blossom_cut` | defeat King Puff |
| `mochi` | `yarn_orbit` -> `cosmic_yarn` (+ `magnet_star`) | `nyan_stampede` | 3,000 lifetime kills |
| `kuro` | `dark_flame_dragon` -> `unsealed_abyss_dragon` (+ `inner_monologue`) | `eternal_abyss` | survive 6:00 in Dream Meadow |
| `pudding` | `teapot_tempest` -> `eternal_tea_party` (+ `bento_box`) | `omurice_of_love` | clear Dream Meadow |
| `aoi` | `micro_missile_swarm` -> `al_dente_armageddon` (+ `speed_lines`) | `get_in_the_robot` | clear Candy Kingdom |
| `akane` | `baka_harisen` -> `dere_dere_harisen` (+ `friendship_bracelet`) | `not_like_i_like_you` | clear Shoujo Academy |
| `senpai` | `notice_me_sparkles` -> `shoujo_filter` (+ `main_character_aura`) | `senpai_noticed_you` | Merch Machine (SSR) / Copium |
| `magical_girl_47` | `henshin_burst` -> `infinite_henshin_loop` (+ `plot_armor`) | `episode_long_transformation` | Merch Machine (SSR) / Copium |
| `isekai_kun` | `cheat_fireball` -> `cheat_meteor` (+ `training_montage`) | `status_screen` | Merch Machine (UR) / Copium |
| `truck_kun` | `horn_of_reincarnation` -> `isekai_rush_hour` (+ `swift_shoes`) | `isekai_express` | Isekai Express (MYTHIC) / 1,000-pull spark |

Signature weapons unlock with their hero and then join every hero's pool. Every hero: 15 talent nodes
(5 / 3 / 3 / 3 / 1 ranks per branch), C1-C6 constellations, a cut-in band + line, an OC bio, bot distances.
View files: `view/heroes-a-fx.ts` (Kuro, Pudding, Aoi, Akane), `view/heroes-b-fx.ts` (the other four).

### General weapons and passives

| Weapon | Evolution (+ passive) | Unlock |
| --- | --- | --- |
| `heart_boomerang` / `thunder_bell` / `candy_bomb` / `bubble_aura` / `prism_beam` | `love_tornado` (+ `twin_charm`) / `raijin_drum` (+ `power_bow`) / `sugar_nuke` (+ `lucky_clover`) / `ocean_dome` (+ `heart_locket`) / `rainbow_cannon` (+ `swift_shoes`) | start |
| `bubble_tea_cannon` | `tapioca_tsunami` (+ `big_ribbon`) | 1,000 lifetime Puff kills |
| `paper_crane_flock` | `thousand_crane_wish` (+ `wish_charm`) | 10 lifetime evolutions (`RunStats.evolutions`: evolved weapons only) |
| `idol_lightstick_wave` | `sold_out_dome_tour` (+ `twin_charm`) | reach SSS rank |
| `kotatsu_of_sloth` | `eternal_winter_break` (+ `chibi_charm`) | survive 3:00 without dashing |

All 20 base weapons carry Lv6 / Lv7 Limit Breaks (`WeaponDef.limitBreak`). Passives: the slice's 8 at
start; `plot_armor` 5,000 damage taken, `main_character_aura` S rank, `bento_box` 50 snacks, `speed_lines`
500 dashes, `inner_monologue` 25 Overdrives, `training_montage` level 25 in a run, `friendship_bracelet`
4 heroes, `chibi_charm` 2:00 without a hit. View: `view/arsenal2-fx.ts`, `ui/hud-arsenal2.ts`.

### Stages (`game/stages/<id>.ts`)

| # | Stage | Length | bpm | Music (battle / boss / final) | Bosses | Roster | Look files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `dream_meadow` | 10:00 | 150 | battle / boss / final | `king_puff` 3:00, `nightmare_teddy` 6:00, `lady_lunatic` 9:00 | puff, batbun, boo, shroomie (+ spore), eyepuff, pumpkin, teddy, wisp | bestiary-fx |
| 2 | `candy_kingdom` | 12:00 | 150 | candy / boss_candy / boss_candy | `gingerbread_golem` 6:00, `sugar_plum_tyrant` 11:00 | gummy_bear, candy_corn, donut_roller, marshmallow_brute, lollipop_mage | candy-fx |
| 3 | `shoujo_academy` | 14:00 | 136 | academy / boss_academy / boss_academy | `council_president` 7:00, `bishounen` 13:00 | hall_monitor, love_letter, tsundere_slime, transfer_student, exam_paper, council_ninja | academy-fx |
| 4 | `beach_episode` | 16:00 | 128 | beach / boss_beach / boss_beach | `kraken_chan` 8:00, `firework_dragon` 15:00 | crab_kun, seagull, jellyfish, watermelon (+ half), sandcastle_golem, tiny_shark | beach-fx (s45-fx) |
| 5 | `final_arc` | 20:00 | 160 | finale / boss_finale / cancel | `truck_kun_boss` 8:00, `rival_chan` 14:00, `cancel_sama` 19:00 | shadow_clone, filler_goon, plot_hole, animation_error (+ dropped frames), mini_truck | finale-fx (s45-fx) |

Each stage unlocks with the previous stage's clear; `bpm` is its battle theme's tempo (the beat clock of
Idol Lightstick Wave: Dream Meadow keeps the slice's 150 bpm theme, the bible's 140 predates it).
Director event kinds: `events.ts` (swarmLine, batStorm, wispRush, encircle, flood, elite, boss),
`events-s2.ts` (laneCharge, teleportIn, bulletRain, schoolBell), `events-s45.ts` (tideSweep,
commercialBreak, flashback). The twist enemy `rival_recolour` (Shounen Rival) is shared by every stage.

### Relics, Plot Twists, Plot Points

| Registry | Files | Count |
| --- | --- | --- |
| Relics (Merch) | `game/relics/n.ts r.ts sr.ts ssr.ts ur.ts lr.ts mythic.ts` (+ `_friend.ts` A Real Friend, `_util.ts`) | 61: N 12, R 14, SR 12, SSR 10, UR 6, LR 4, MYTHIC 3 |
| Plot Twists | `game/twists/production.ts story.ts broadcast.ts` | 15 (6 open with Dream Meadow, +3 / +2 / +2 / +2 per later clear) |
| Plot Points | `meta/achievements/defs/story.ts combat.ts heroes.ts weapons.ts gacha.ts silly.ts` (+ `_shared.ts`) | 171: story 24, combat 28, heroes 36, weapons 37, gacha 25, silly 21 |

### Cue namespaces (presentation events, one reused payload each)

| Event | Kinds | Emitter | View |
| --- | --- | --- | --- |
| `weaponFx` | numeric `WFX_*` | `weapons/_fx.ts wfx` | `view/weapon-fx.ts` |
| `heroFx` | strings: `kuro_* pudding_* aoi_* akane_* ha_text` / `hb_*` / `a2_*` | `weapons/_fx.ts heroFx` (`hfx`, `a2fx`) | heroes-a-fx / heroes-b-fx / arsenal2-fx |
| `enemyFx` | numeric: `EFX_*` < 100 (bestiary), 400-499 (Beach / Final Arc, `enemies/_s45.ts`) | `enemies/_fx.ts efx` | bestiary-fx / s45-fx |
| `stageCue` | strings `candy_*` / `academy_*` | `enemies/_cue.ts cue` | candy-fx / academy-fx |
| `enemySay` | free text ("" = a pool line) | `enemies/_say.ts say` | `view/speech.ts` (also `sayAt` for boss death lines) |
| `stageFx` | `grade renderScale animFps speedLines still reset ...` | `bosses/_s45boss.ts stageFx` | `view/stage-view.ts` |
| `relicProc` | relic / talent / twist ids | `relics/_util.ts proc` | merch-fx, then relic-fx |
