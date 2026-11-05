# Developer suite: why Season 2 was slow, and the tools that fix it

## 1. Post-mortem: where the time went

Season 2 took roughly 30+ hours of wall-clock agent time across 4 container
restarts. Measured inner loops at the end of it:

| Loop | Cost | Why |
| --- | --- | --- |
| One screenshot of a specific game moment (e.g. minute 8, a boss) | ~16 s | starts a dev server and a browser, fast-forwards the sim, then waits on headless WebGL at **1-6 fps** (SwiftShader) |
| `node scripts/e2e.mjs` (3 devices) | **6.3 min** | real-time flows rendered at a few fps |
| A touch-only flow (fresh save → run → results → board → gacha → run) | **8.4 min** | same |
| `npm test` | 49 s (2 s at project start) | long headless runs mixed into the default suite |
| One progression-balance measurement (6 accounts × 160 h) | **76 min** | only full simulated runs, one process, no caching |
| Difficulty tuning | ~30 iterations of the above class | no fast or analytic model to try a number quickly |

The root causes, in order of cost:

1. **No shared scenario harness.** Agents wrote **426 one-off scripts** in 52
   scratch folders and took **5,423 screenshots (4.6 GB)**. Most of them rebuild
   the same steps: seed a save, jump to a state, wait for frames, capture.
2. **Verification was bound to real time.** The game only advances on
   `requestAnimationFrame`, so a check had to wait for headless frames. There
   was no deterministic "step N frames and render once" mode.
3. **Balance could only be measured by full simulated runs.** That meant
   10-20 minute stages, sequential processes, no caching, and no quick model
   for what-ifs. The targets were also tuned more precisely than needed: the
   owner's guidance is rough ranges.
4. **No live diagnostics, for agents or the owner.** Real-device bugs (Android
   audio, CSP, an all-black ult) came back as "static-y" or "just black", and
   each took several build→publish→report round trips. Nothing on the device
   could report audio state, frame times or errors.
5. **Cheap bug classes reached the owner.**
   - Two global-CSS class collisions: `.cd` threw the dash button to the
     top-left, and `.bn` put the boss name over the HP bar.
   - A `fetch()` blocked by the artifact CSP.
   - An ult that blacked out the screen.

   A 1-second lint, a CSP boot check and a luminance check would each have
   caught one of these.
6. **Orchestration.**
   - Very large agents (5-7 h each), strictly sequential phases (bible → art
     → code → polish → balance → QA) and a 2-agent concurrency cap made the
     critical path long.
   - Restarts killed long agents mid-task.
   - QA only ran at the very end.

## 2. The suite (targets)

| Tool | Replaces | Target |
| --- | --- | --- |
| **Dev console** (in game: `?dev=1`; in developer mode the `` ` `` key or a 3-finger long-press on phones) | ad-hoc `__kk` scripts, guesswork | inspect and drive any live state in seconds, on any device |
| **Diagnostics export** ("Copy diagnostics" in Settings and in the console) | vague bug reports | one paste tells us the device, quality tier, fps/frame-time histogram, audio state (rate, latency, voices, stress, skipped notes) and the recent errors |
| **Scenarios + deterministic stepping** (`?scenario=…`, `?step=1`, `__kk.step(n)`, `__kk.snapshot()`) | waiting on wall-clock fps | any moment reproducible in under 2 s, the same every time |
| **`npm run scenes`** (gallery: parallel pages, contact sheet, automatic visual metrics + anomaly flags) | 426 bespoke scripts | 20+ key screens in about 1 minute, with blackouts, missing sprites and errors flagged automatically |
| **`npm run balance:lab`** (analytic model + parallel short sims + cached HTML report) | 76-minute measurements | a balance answer in under 2 min; what-if tweaks in seconds |
| **`npm run doctor`** (typecheck + fast tests + sprite check + CSS collision lint + artifact CSP boot + audio cost budget + bundle size) | bugs found by the owner | run before every commit: under 2-3 minutes |
| **Fast/slow test split** (`npm test` fast, `npm run test:slow`) | 49 s default suite | default under 10 s |
| **`CLAUDE.md`** | agents rediscovering tooling | every agent starts from the suite |

Every target is met; §9 has the measured before / after, and §8 shows each guard rail catching the Season 2 bug
it was built for.

## 3. Dev console, step mode, scenarios, diagnostics (`src/debug/`)

### 3.1 Deterministic step mode

`?step=1` stops the `requestAnimationFrame` loop (`Loop.setManual`, `src/core/loop.ts`). The game
then advances only through `__kk.step(frames = 1, dt = 1/60)`: every frame runs the sim, fx and DOM
updates, only the **last** one draws the WebGL scene, synchronously, so a screenshot taken right
after is exact. CSS / WAAPI animations are paused and advanced by the same dt (synced every 4 frames
and at the end of each step), so the DOM matches the sim too. `__kk.render()` draws once without
advancing time; `__kk.freeze(true|false)` switches step mode at runtime (the console's FREEZE).

Measured on this container (headless Chromium + SwiftShader, 4 cores shared): `run:late` ready in
0.4 s with `?step=1` against 10.7 s on live frames; a screenshot of a stepped page takes ~0.3 s
(the first one per page ~2 s) against 4-5 s while the live loop competes for the CPU.

### 3.2 Scenarios (`src/debug/scenarios.ts`, lazy chunk)

`/?scenario=<name>&step=1[&seed=N&hero=<id>&profile=fresh|mid|rich|P0..P7&god=0&account=0]`, or
`await __kk.scenario(name, { seed, hero, profile })` -> `{ ok, ms, marks, error, screen, modal, t }`.
At boot `<html data-kk-scenario="pending|ready|error">` and `__kk.scenarioState` report progress, so a
script waits with `page.waitForFunction(() => document.documentElement.dataset.kkScenario !== "pending")`.
`__kk.scenarios()` lists every concrete name (108 today: parametric kinds expand over the registries).

| Name | State |
| --- | --- |
| `hub:fresh` `hub:mid` `hub:rich` (also `hub:P0`..`hub:P7`) | hub home with a seeded account (fresh save; P3 ~8 h; P7 + every unlock + currency) |
| `stages` `loadout` `board` `heroes` `gacha` `wiki` (`<page>:<tab>`), `hero:<id>[:<tab>]`, `settings` | a hub page / the settings panel, mid account |
| `run:early` `run:mid` `run:late` `run:late@<stage>` `run:<seconds>@<stage>` | a run moment (0:45, 40 % of the stage, 20 s before its final boss) |
| `stage:<id>` | 40 % into that stage (its mix, ground, grade, music) |
| `boss:<id>` `boss:<id>:p2` `:p3` `boss:<id>@0.3` | the boss after its entrance, at its stage and time; p2 / p3 = HP 50 % / 20 % (the phase change plays) |
| `ult:<hero>` `ult:<hero>:mid` | the anime cut-in / 1 s into the active ultimate |
| `hud:overdrive` `hud:overdrive-ready` `hud:overdrive-pad` `hud:overdrive-tut` `hud:overdrive-swap` | the HUD's Overdrive gauge of keyboard / mouse / gamepad play (1:40 Dream Meadow): 60 % charged; full (the rainbow READY); full with the gamepad's B; a fresh account's first run with the OVERDRIVE READY bubble pointing at it; a touchscreen laptop (a touch mid-run must swap the gauge for the OVERDRIVE button, a key must swap it back: asserted, the scenario fails otherwise). On touch devices the OVERDRIVE button shows instead (the gauge must not) |
| `speech` `speech:<stage>` | the 4 enemies nearest the hero speak from their stage's pools, plus one free bubble (default Candy Kingdom) |
| `orbital:<weapon>` `orbital:<tea weapon>:tea` | Orbital Guard mid-Shoujo Academy (Mochi's Yarn Orbit Lv5 / Cosmic Yarn, Pudding's Teapot Tempest Lv5 / Eternal Tea Party): a 16-bullet ring fired at the hero, shown once a body breaks (film it for the reform: `orbital:yarn_orbit~150/10`); `:calm` = the same volley in the run's first seconds, the orbital alone (judge the break and the empty slot; not in `--all`); `:tea` = Warm Tea on the move (1:30, a calmer crowd) |
| `crowd:<hero>` `crowd:<hero>:mid` (`@<stage>`) | every hero in a busy run with a full build, after 2 s of live play (the stress scenes of the `washout` check): late = a rich account at Shoujo Academy 10:00, ~level 24 bot-picked, the signature weapon evolved plus every maxed weapon whose passive is held; `:mid` = a mid account at 3:20, level 10, the signature weapon at its top level. Mid-run is the harder case: the bloom limiter and the hero beacon only switch on at high glow load. Film them: `crowd:pudding:mid~120/15` |
| `levelup` `chest` `chest:golden` `pause` `over:death` `over:victory` | in-run modals |
| `levelup:evo-hints` `levelup:evo-four` `levelup:evo-many` `chest:evo-hints` `pause:evo-hints` | evolution hints: a mid account that discovered 4 evolutions, a hand-picked build + offer (READY, pair-completing passive, missing passive, an undiscovered recipe; 3 / 4 / 6 cards) |
| `results:death` `results:victory` `results:first-clear` | Episode Results of a real (sandboxed) account run, finished; first-clear = a P1 account clears Dream Meadow (unlock cards) |
| `gacha:pull-x10` `gacha:mythic` | a Merch Machine x10 pull 3.6 s in; a forced MYTHIC (needs the dev server's `__kkGacha`) |

How a moment is reached, without forking game logic: runs start through `App.startRun` with the
profile's loadout (`save.runPlan` -> `buildRunConfig`); profiles come from `tools/checkpoints.ts`
(the real meta builders); a late moment is a **warp** (bot-picked level-ups through the real card
generation, a chest every 8 levels for evolutions, run time set and the director's timeline cursor
moved past earlier events, 4 s of muted bot play to fill the screen at that phase); then real App
frames run unmuted (banners, boss bars, music, cut-ins, modals) while the bot steers the hero (its
Overdrive held just under full so it never casts unasked); control returns to the player at the end.
**Every scenario runs in a SANDBOX** (`src/debug/profiles.ts`): save writes are off for the page, so
the owner's real save is never touched (reload without `?scenario=` to get it back).

Readiness is measured in §3.6 (`marks` in each result say where the time went). Wall-clock-driven UI is
handled explicitly: Episode Results uses its own tap-to-skip (its beats run on `performance.now()`),
the gacha summon is driven by the dev build's `__kkGacha.speed(0)` / `step()` in step mode, and the
ghost-tap guard is waited out in real time.

`await __kk.snapshot()` returns plain JSON: screen / modal / hub page / overlays / step mode, time
controls, the run (stage, t, phase, hero, level, xp, hp, god, kills, combo, ult, dash, boss + HP
fraction, WARNING, enemies total / elites / props / by id, bullets, projectiles, gems, pickups,
pending level-ups / chests, weapons + levels, passives, relics, twists, director + next timeline
events), the attract game, perf (fps, frame ms p50 / p95, per-phase CPU p50 / p95, tier, sprites,
draw calls, particles, context losses), audio stats, the save summary, and the last errors.

### 3.3 Frame profiler (`src/debug/perf.ts`, always on)

`App.frame` laps one `performance.now()` per phase: **ui** (input, App logic, hub / modal DOM
updates), **sim** (`Session.tick`: World steps, camera, feedback), **view** (`WorldView.draw` +
`beginFrame`), **fx** (particles / juice update + draw), **gpu** (`Renderer.endFrame` submission;
0 = no draw that frame), **hud**. Two stores: a ring of the last 2048 frames (percentiles, graphs) and
60 one-second buckets (frame-time histogram, peaks of enemies / particles / sprites). Cost: 7 clock
reads and a few typed-array stores per frame, no allocation. `__kk.perf.phases(300)`,
`__kk.perf.window()`.

### 3.4 Dev console (`src/debug/console/`, lazy chunk)

Opens with `?dev=1`, or `__kk.dev()`; in **developer mode** also the `` ` `` key and a **3-finger long-press**
(0.65 s; timed with rAF because Chrome defers timers during a touch). Developer mode (`src/debug/devmode.ts`) is
off by default and kept per browser (`kko.devmode.v1`, core storage helpers, never the profile): `?dev=1` turns
it on, `?dev=0` off, and Settings switches it with **7 taps on the build label** under DONE / DIAGNOSTICS (a toast
counts down the last three; this is the way in on a phone inside the artifact viewer, where URL params can't be
added). Why gated: the long-press opened the console in production too, so a panicking player with three fingers
down mid-run could get it; the `` ` `` key sits right under Esc (pause) on a PC keyboard; and the console's Account
tab can rewrite the real save. Settings' DIAGNOSTICS stays available to everyone. Proof: `tests/dev-mode.test.ts`,
`node scripts/e2e.mjs --devmode` (real CDP 3-finger long-press and real taps on the label, ~60 s). Draggable header,
collapses to a small pill
(left edge, under the HUD's weapon icons) that only refreshes its fps twice a second; touches on it
never reach the joystick (`data-no-joystick`). Tabs:

- **Perf**: frame-time graph, stacked per-phase CPU graph, p50 / p95 / max table, the 60 s histogram,
  counts (enemies / cap, bullets, projectiles, gems, particles / cap, sprites, glow, draw calls,
  scene size, tier), quality AUTO / LOW / MID / HIGH, render toggles (hitboxes, spawn ring with a
  0.6x zoom, bloom off, grade off: `console/overlay.ts` wraps `Renderer.endFrame` only once a toggle
  is used), FREEZE + step 1 / 10 / 60 / 300 frames.
- **Run**: pause sim, freeze / step, speed 0.25x-8x, skip to a time (bot, muted); timeline (stage,
  t, spawn phase, director state, build, boss, enrage, the next timeline events with ETAs); spawn
  any enemy (x N, elite), any boss now / with WARNING, boss HP 50 / 20 / 5 %, enrage; give any
  weapon / passive / relic (stars), level up, +5 levels (bot picks), ult full, chests; god, heal,
  kill all, kill boss, clear bullets, end run.
- **Audio**: context state, sample rate, base / output latency, lite / full profile + lookahead,
  voices / cap, stress, skipped music notes, sfx started / dropped by the budget, music track,
  `AudioContext.renderCapacity` where the browser has it; play any sfx, any track, stop, unlock /
  resume; RELOAD LITE / FULL / AUTO (the `?audio=` override for the next load).
- **Acct**: sandbox / write state, currencies (+ / zero), UNLOCK ALL, apply a profile (fresh / mid /
  rich / P0..P7 for any hero; saved like Settings IMPORT, with the backup, unless sandboxed), START
  OVER, copy the save string, SANDBOX, RELOAD (real save). Destructive buttons need a second tap.
- **Scn**: every scenario as a button (seed / hero / profile options), shows its readiness time,
  collapses the console so the state is visible.
- **Log**: the last 100 errors / warnings (repeats counted), COPY DIAGNOSTICS / COPY LOG, a
  selectable text box when the host blocks the clipboard.

### 3.5 Diagnostics export (`src/debug/diag.ts`, every build)

Settings -> **⧉ DIAGNOSTICS** (next to DONE, also from the pause menu) and the console's ⧉ copy one
compact block: build (version, commit, date, dev / prod / single-file), UA, screen / viewport / DPR /
canvas / scene size, quality tier (+ tier changes), WebGL renderer (unmasked where allowed) + context
losses, fps and the frame-time histogram of the last 60 s, CPU per phase p50 / p95, peaks, where the
player is (screen, modal, run stage / t / hero / level / hp / enemies), audio (state, rate,
latencies, lite / full, voices, stress, skipped notes, sfx started / dropped, lookahead, track,
renderCapacity), the save summary, and the last 20 errors / warnings. The clipboard call happens
inside the tap (`navigator.clipboard`, then `execCommand("copy")`); when the host blocks both, the
text appears selected in a box. Verified in the CSP-wrapped single-file preview
(`scripts/artifact-page.py`): boot, 3-finger long-press, a scenario, the Settings copy, no CSP
violations.

### 3.6 Measured

Scenario readiness, all 69, one page at a time, `?step=1`, dev server, headless Chromium on this
container (ms from the call to ready; the full boot + scenario + screenshot per page is 1.9-4.3 s,
and the whole list takes 191 s sequentially with one browser):

| Group | Ready in |
| --- | --- |
| hub pages (`stages` `loadout` `board` `heroes` `gacha` `wiki` `hero:*`) | 53-147 ms |
| `hub:fresh` / `mid` / `rich`, `settings` (wait for the attract game behind the menu) | 221-344 ms |
| `run:*`, `stage:*` (warp + 1 s of live frames) | 128-339 ms |
| `ult:*` cut-in / mid-ult | 123-515 ms |
| `boss:*` (entrance played out) | 383-653 ms |
| `levelup` `chest` `pause` `over:death` | 205-267 ms |
| `over:victory` (the dawn plays to the card) | 656 ms |
| `results:death` / `victory` / `first-clear` | 426 / 504 / 939 ms |
| `gacha:pull-x10` / `gacha:mythic` (0.6 s of it is the game's own 300 ms ghost-tap guard, twice) | ~1.3 s |

- Bundle (production `vite build`): main chunk 1,482,128 -> 1,498,877 B (+16.7 KB, +1.1 %; gzip -9
  498.2 -> 505.3 KB, +1.4 %) for the profiler, diagnostics and the dev entry; the console (28.5 KB,
  11.3 KB gz), scenarios (15.0 KB, 6.2 KB gz) and profiles (8.4 KB, with tools/checkpoints.ts) are
  separate chunks fetched only on use. Single-file build: 2,107,064 -> 2,193,217 B (+86 KB, +4.1 %;
  gzip +36.8 KB): it inlines every chunk (side-effect free until used) so the console works in the
  artifact on the owner's phone.
- `npm test` unchanged (936 tests); `node scripts/e2e.mjs` passes on all three devices.

## 4. Balance lab (`npm run balance:lab`, `tools/balance-lab/`)

One command gives the checkpoint x stage clear matrix, boss fight lengths, the weapon DPS table, level
curves, an economy sample, anomaly flags and the model's own error. It writes
`shots/balance-lab/<name>/report.html` (self-contained, inline SVG, light / dark, phone-width safe),
`report.json` (for agents) and `report.md`, and prints their paths.

```
npm run balance:lab                                        # today's content
npm run balance:lab -- --set "stage.final_arc.scaling.hp*=1.2"     # what-if: before -> after, files untouched
npm run balance:lab -- --set "boss.*.hp*=0.9" --set "weapon.star_shot.dmg*=1.2" --set "tuning.payout.coinsPerMinute*=0.8"
npm run balance:lab -- --model-only                        # the analytic model on cached build data
npm run balance:lab -- --full P5:final,P6:final --seeds 1-4    # real full runs for some cells as well
npm run balance:lab -- --validate | --calibrate | --trace P6:final:hoshi | --refcheck | --job '<json>' | --help
```

**How it works.** Every number comes from the real code: the headless `World`, the bot, the checkpoints'
`buildRunConfig` and the live registries. No game logic is copied.

- **Worker pool.** Four forked Node processes load the game once through Vite's module runner (no
  Vitest start-up). They take jobs from one shared queue, longest first.
- **Short jobs instead of full runs.**
  - The bot's build path per checkpoint x hero: level-ups and chests, no combat.
  - Gauges: each weapon alone, plus snapshot builds against a dense crowd, a pinned boss and a
    walking-in horde at 3 HPs.
  - A census of child spawns per stage (spores, dropped frames).
  - Runs from 0:00 to 3:00 at each stage's intended checkpoint and the one below.
  - Boss fights from snapshots: the build grown to the level real runs have at that time, the
    timeline skipped to the boss, a charged Overdrive.
  - 60 s slices mid-stage.
  - Slices and boss fights also record `blocks` (enemy bullets eaten by orbiting weapons, Orbital Guard) in their
    cached results and `--job` output.
  - A 2 h progression sample: two mid accounts through the real `tools/progression.sim.ts`.
- **Disk cache.** `node_modules/.cache/balance-lab` keys every job by what it depends on:
  - the src files of the loaded module graph and the lab's own sim code;
  - the stage's file plus every enemy / boss file it can spawn;
  - the checkpoint's `RunConfig` fingerprint (its data and the stats its mods produce);
  - the overrides that can touch the job.

  So a re-run only recomputes the cells whose inputs changed. Editing the Final Arc reruns 37 of 575
  jobs. A `tuning.*` change reruns only the progression sample, because combat keys on the RunConfig.
- **Analytic model** (`model.ts`, ~2 s for 50 cells x 3 heroes x 2 seeds x 16 noise draws):
  - The horde comes straight from the stage data: phase rates x mixes x HP / damage scaling, the
    director's x4 pressure floor and adaptive toughness, events, elites, bosses, the account's
    curse, child spawns and the ranged share of the mix.
  - The build's damage comes from the gauged weapon table x the account's stats (cooldown / area /
    amount elasticities), scaled to snapshot gauges of the bot's real builds. Kill throughput comes
    from the horde gauge.
  - Then a time-stepped run tracks the walk-in, kills, gem XP (with the combo rank's XP multiplier),
    level-ups, hits, healing, revives and boss fights.
  - The player constants (`calibration.json`) are fitted with `--calibrate` against 96 full
    reference runs: 16 cells around each intended checkpoint, Hoshi / Rin / Kuro, 2 seeds.
  - The report's matrix is the model corrected by the samples: boss time-to-kill and pressure from
    the boss fights, hit rate from the slices, and the early windows' survival.
- **What-ifs** (`overrides.ts`):
  - `path=value`, `*=`, `+=`, `-=` with `*` wildcards, applied in-process in the main process and
    every worker.
  - Roots: `stage`, `enemy`, `boss`, `weapon` (`weapon.<id>.dmg` = every level's dmg), `passive`,
    `relic`, `twist`, `hero`, `cfg`, `tuning`, `cp` (a checkpoint's fields).

**Measured** (4 cores; the old tools for comparison):

| | Wall time |
| --- | --- |
| `npm run balance:lab`, empty cache (575 real-sim jobs) | **85 s** |
| the same, warm cache | **9-12 s** |
| a new what-if on one stage (37 jobs recompute) / repeated | **34 s** / 17 s |
| an economy what-if (`tuning.*`: the progression sample only) | 46 s |
| `--model-only` what-if | ~15 s |
| the 96 reference full runs (`--validate` / `--calibrate`), cold / warm | 138 s / instant |
| old: one progression measurement (6 accounts x 160 h) | 76 min |
| old: the 480-run matrix (`node tools/matrix.mjs`) | ~25 min |

**Accuracy.** The matrix is a rough-ranges tool. The error is reported in every report under "Model
accuracy":

| Against | Clear % (mean abs.) | Intended cells | Death time | Boss TTK | Levels |
| --- | --- | --- | --- | --- | --- |
| today's 96 runs, model + samples (the report's matrix) | 15 pts | 11 pts | 65 % | 40 % | 18 % |
| today's 96 runs, analytic model alone | 24 pts | 18 pts | 36 % | 40 % | 17 % |
| `matrix-verify-dm-f` [F] (Dream Meadow P0-P3) | 22 pts | 29 pts | 38 % | 40 % | 14 % |
| `matrix-after` (every stage; stage tiers and boss HP patched back, older relic sets not) | 13 pts | 21 pts | 50 % | 37 % | 17 % |

Death time is the median death time of the runs that died. That is a noisy statistic: a cell
dies at 3:00 or at 9:00 depending on the seed. Use `--full` for exact numbers in a few cells.

**First findings** (mid bot, today's content; the reference runs agree):

- The Candy Kingdom at P3, the Shoujo Academy at P4 and the Final Arc at P5 clear 17-22 %,
  against a 40-70 % target.
- Their first bosses (Gingerbread Golem, Council President) kill the hero in about two of three
  sampled fights.
- P0 dies in Dream Meadow at 1:10-1:40 (Kuro / Rin) against the 2:00-3:30 target.

## 5. Scene gallery (`npm run scenes`, `scripts/scenes.mjs`)

One Vite dev server. Each worker gets its own Chromium (pages of one browser share one SwiftShader GPU
process, so 4 pages in one browser were no faster than 1). Every shot is a named scenario reached with
`/?scenario=<name>&step=1`, so no shot waits on the wall clock. Then:

- a probe, run in the page;
- a CDP capture straight from the compositor;
- pixel metrics in Node;
- one contact sheet.

```
npm run scenes                                   # 29 key screens x i13 + desktop (+ Kuro's filmed ult) -> shots/scenes/latest/contact.png
npm run scenes -- --only boss:,ult:kuro          # scenario name prefixes (or exact names, parametric ones too)
npm run scenes -- --only "ult:kuro~180/15"       # a FILM: the scenario, then a checked shot every 15 frames for 180
npm run scenes -- --only boss: --film 120/20     # film every scene of the run
npm run scenes -- --all --devices i13,i13l,se,desktop,w360 --jobs 4
npm run scenes -- --only hud: --devices desktop,fhd,laptop,half   # desktop windows: 1280x720, 1920x1080, 1366x768, 683x768
npm run scenes -- --baseline                     # store shots/scenes/baseline/ (+ a per-scene noise floor)
npm run scenes -- --diff                         # perceptual pixel diff % per shot vs the baseline (+ .diff.png)
npm run scenes -- --quick                        # 12 scenes, one device, Kuro's ult + a crowd filmed: 26 shots (doctor --scenes)
npm run scenes -- --self-test                    # inject every fault into one scene: each must be flagged
npm run scenes -- --only crowd: --film 120/15 --devices i13      # every hero, filmed: the `washout` check's stress run
npm run scenes -- --only "crowd:pudding:mid~60/30" --blame 12   # WHICH draws wash the hero out (see washout below)
npm run scenes -- --only orbital:yarn_orbit --hero-dump          # <name>.hero.png: what the washout check compared
```

**Output** (`shots/scenes/latest/`):

- `<device>/<name>.png`: CSS-pixel shots, rendered at DPR 1 (`--full-res` keeps the device's DPR).
- `contact.png`: every shot, error flags in red and warnings in amber.
- `index.html`: the same gallery, to open.
- `summary.json`: per shot, the timings, scenario readiness, metrics, probe results, flags and the
  snapshot (screen, modal, run stage / t / level / enemies / boss, sprites, draw calls).

The exit code is 1 when a shot has an error-level flag.

**Checks** (`CHECKS` in the script). Per-scenario overrides go in `OVERRIDES`.

| Flag | Level | Fires when |
| --- | --- | --- |
| `blackout` | error | more than 92 % of pixels have luminance < 14, or the mean luminance is < 8 |
| `whiteout` | error | more than 55 % of pixels have luminance > 242 |
| `blank` | error | the luminance spread is < 3 (one flat colour) |
| `dark` | warning | the mean luminance is < 22 |
| `murk` | error | an in-run frame (no modal) where more than 10 % of the pixels have no RGB channel above 56: it reads as black on a phone at low brightness |
| `illegible` | error | bitmap text drawn in an ink whose WCAG contrast with its font's own outline is under 1.5 (dark ink on `font_main`'s dark outline) |
| `washout` | error < 35, warning < 55 | an in-run frame (no modal, not the ult cut-in) where less than that % of the hero's own contrast survives: she is lost in glow, haze or things drawn over her |
| `placeholder` | error | a placeholder atlas handle is drawn, or a `.px-missing` DOM icon is visible |
| `pageError` | error | an uncaught error or a `console.error` (minus SwiftShader / Vite noise) |
| `scroll` | error | the document or a vertical page scroller scrolls sideways |
| `overflow` | warning | a text or control element sticks out of the viewport and is not clipped on purpose or sliding |
| `scenario` / `harness` | error | the scenario ended in `error`, or a timeout |
| `diff` (`--diff`) | warning > 0.5 % + noise, error > 10 % + noise | pixels changed vs the baseline |

Notes on the checks:

- **`placeholder`** wraps `SpriteBatch.drawP` during one `__kk.render()` and counts draws of placeholder
  atlas handles.
- **`illegible`** uses the same render: every glyph draw is mapped to its font (`atlas.fonts`), and its ink
  (the tint, pushed to white by `flash`) is compared with the font's auto outline (`FontDef.outline`, default
  `#2d1b45`; `false` = none). Speech bubbles use the outline-free `font_ink`, so dark ink is fine there.
- **`murk`** counts "dark" pixels as pixels whose brightest channel is under 56, not by luminance. A saturated
  violet ground (the Final Arc) has a low luminance but is not black; a dimmed grey is. By luminance (< 40) the
  Final Arc scenes scored 22-62 % and would have been false alarms. By brightest channel every in-run scene of the 70
  scores under 4 %, and Kuro's old ETERNAL ABYSS scores 12-27 % during its shadow pass.
- **`washout`** (the hero is lost in the fx). Mochi and Pudding mid-run (Shoujo Academy 3:20, level 10) sat inside
  a white / amber haze of hit sparks and pickup sparkles, and whole-frame checks cannot see that. Per in-run shot the
  probe's real render records the hero's own draw calls (her Entity sprite and the hero beacon's redraw, not her
  dash afterimages) and reads the box around her back. After the screenshot, those calls alone are replayed, then
  the same frame with nothing drawn (`HERO_FINISH`; no game or view code runs): where the two differ is her
  silhouette, and the replay's colours are how she looks with nothing over her (same grade, dim, flash, shockwaves).
  The first version estimated the empty background from the box's border columns; a shockwave's bright rim
  crossing the box became part of "her", and Final Arc frames where she reads fine scored -56 to 22. `keep` = the least-squares slope of frame luminance on clean luminance
  over her pixels, x 100: a haze `a x her + (1 - a) x white` gives `a`; bloom adds and clips toward white; sparks on
  top add noise, not slope. Nothing in the run changes: seeded loads with and without the check give pixel-identical
  shots and film frames 30 steps on (`run:late`, `crowd:pudding:mid`, `orbital:yarn_orbit`, `stage:final_arc`,
  `ult:kuro:mid`). Also in `summary.json` (`probe.hero`): `ink` (% of her clean dark pixels still darker than 110),
  `wash` (% of her pixels lifted to near-white), `lift` (mean luminance added), `halo` (% near-white within 20 art
  px), `load` (the glow load that gates the bloom limiter and the hero beacon), `cover` (the beacon's blast cover),
  her position and `ms`.
  - Calibrated on i13 against 70 in-run scenes, the 22 `crowd:` scenes and their films, read by eye: every frame at
    `keep` >= 70 shows her clearly; 35-55 = partly visible in haze; < 35 = gone (Mochi's Yarn Orbit 3-21, Pudding's
    Teapot Tempest 27, Kraken-chan 19, Final Arc 25, Aoi / MG#47 mid-ult 30 / 3). `ink` and `wash` were tried as the
    flag first and rejected: Isekai-kun and Truck-kun on a white bloom keep a grey outline that reads fine.
  - What it found, and the fix. `--blame` named hit sparks, explosions (a Candy Bomb blast centred on her is a
    white disc 150 px across), kill bursts, pickup sparkles, Galaxy Barrage stars, Truck-kun's light pillars, enemy
    numbers, a "DON!" banner on her hair, hit-flashing enemies piled in front of her, and her own dash afterimage
    drawn on top of her (MG#47 read as a flat pink silhouette). The glow load stayed under the bloom limiter's
    threshold, so the beacon never helped. The fix is the hero focus zone (docs/ENGINE.md: the player's fx fade per
    pixel over her body, the bloom over her is cut, afterimages go under the entities, a pile in front brings up the
    beacon, banners start above her head). Same instrument on both trees (`keep` min / mean, errors, warnings):

    | Run (frames) | Before | After |
    | --- | --- | --- |
    | `crowd:` x 11 heroes x late / mid, films 120/15, i13 (195) | 0 / 65, 30 errors, 22 warnings | 45 / 84, 0, 2 |
    | the same on desktop (192) | -1 / 57, 47, 41 | 39 / 82, 0, 10 |
    | `run:`, `stage:`, `boss:`, `orbital:`, films 60/15, i13 (155) | 0 / 73, 16, 20 | 42 / 88, 0, 4 |
    | `ult:` x 22, films 240/20, i13 (286) | -2 / 73, 35, 26 | 21 / 87, 6, 13 |
    | key set, i13 + desktop (68 in-run) | 4 / 69, 14, 3 | 59 / 90, 0, 0 |

    The share of near-white pixels within 20 art px of her (`halo`) fell from 49 % to 33 % in the i13 crowd films,
    while the frames' mean luminance moved by 0.5 (the spectacle away from her is untouched) and the darkest in-run
    frame stayed at 6.7 % `murk` pixels. The six ult errors left are Magical Girl #47's transformation and Isekai-kun's
    STATUS SCREEN, which cover her on purpose, as Aoi's robot does at the end of hers; `OVERRIDES` relaxes `washout`
    to 15 / 35 for those three ults (MG#47 and Isekai-kun scored -6 to 16 before the fix, so a regression still
    fails). Every ult filmed to its end (`ult:<hero>~600/30`): the first frame after it ends scores 58-94 (before:
    25-84), the rest of the film 47-90 at worst (before: 0-59).
  - Regression guard: the key set films `crowd:magical_girl_47:mid~120/15` (before the fix: 10 errors over i13 and
    desktop) and `--quick` (so `doctor --scenes`) films `crowd:kuro:mid~120/30` (before: 2 errors).
  - `--blame [N]` (default 12) explains a flagged frame: one recording render notes every draw's call site (stack
    trace -> the first frame outside `src/render/`; particles by their sprite and, from the first blamed shot on,
    by the `ps.emit` call site that spawned them; projectiles by their weapon), then for the N sites scoring highest
    near her: `alone` = her `keep` with only that site drawn over the ground (what it does by itself) and `dKeep` =
    the gain from dropping it (its marginal share; with several white-hot sources each alone washes her out and
    dropping any one barely helps). Plus whole-class variants: no bloom, no Glow flags, no FxAdd / Add, no
    particles, no <layer>. Particle emitters are named only on shots after the first, so film it:
    `--blame --film 60/30`. ~2N+12 extra renders per shot; they run the view's draw code again (with particle
    spawns blocked, `Math.random`, `fxRng` and the view's `frameN` counters put back), after the screenshot.
  - `--hero-dump` writes `<name>.hero.png` (x4: the hero-only render, the frame, her mask) to check the check.
  - Cost: two replayed renders (a few sprites, then nothing) + three small read-backs per in-run shot (see
    Measured); `--no-hero` skips it.
- **Films.** A scenario is one moment. A transient full-screen effect (an ult's shadow pass, a flash, a phase
  change) can sit between two moments: `ult:kuro:mid` never caught the old ETERNAL ABYSS, because its shadow had
  already passed. `name~frames/every` (or `--film frames/every`, default `120/15`) shoots the scenario, then
  steps `every` frames at a time and checks each frame like a shot (`<name> +<n>f`, smaller on the sheet). The key
  scenes film `ult:kuro~180/15`; `--quick` films `ult:kuro~150/15`. A film frame costs about 0.15 s.
- **`overflow`** ignores three cases:
  - the element is clipped by an inner box or reachable through a scroll container;
  - the element is completely off screen;
  - the element is mid-way through a finite transition or animation that moves it.

Measured on all 69 scenarios x 4 devices (before `speech`), the threshold margins are wide:

- The darkest real shot has mean luminance 30 (`gacha:mythic`).
- The most near-black shot is 58 %; the most near-white is 18 %.
- The flattest shot has a luminance spread of 30.

**`--self-test`** runs `run:early` once clean and once with each fault injected in the page:

- a black overlay;
- a white overlay;
- a button 160 px past the edge;
- a page scroller with a too-wide row;
- every atlas sprite marked as a placeholder;
- a thrown error;
- a dim screen with a big near-black shape over the middle (`murk`);
- every bitmap string drawn in the outline colour (`illegible`);
- a soft white disc and glow drawn over the hero (`washout`).

Every fault must produce its flag and the clean shot must stay clean. A clean shot must also diff 0 % against
itself and more than 10 % against its blackout.

Measured: 20/20 pass in 20.5 s; with the `washout` fault, 22/22 in 44.5 s (a host at load 5-10, another agent's runs in parallel).

**Determinism.**

- An init script seeds `Math.random`, so particles, `fxRng` and the attract game repeat. Without it, two
  loads of an in-run scenario differed by 6-15 % of their pixels; with it, hub pages and modals are
  pixel-exact (0 %).
- In-run scenes still differ by 0-6 % between loads, because two game paths read the wall clock:
  - `emitScorch` (`src/fx/presets.ts`) caps scorch decals on `performance.now()`;
  - the attract catch-up in `src/ui/session.ts` budgets its sim slice on wall time.

  So `--baseline` loads every scene twice and keeps the difference as that scene's noise floor
  (`baseline/noise.json`). Small diffs are warnings with a `.diff.png` to look at. Moving those two paths
  to frame / sim time would make in-run shots pixel-exact too.

**Measured** (4 shared cores, dev server, headless Chromium):

| Run | Wall time |
| --- | --- |
| `npm run scenes` (28 key scenes x i13 + desktop = 56 shots) | **64 s** |
| `npm run scenes` today (29 key scenes + Kuro's 12-frame film, x i13 + desktop = 82 shots) | **68 s** |
| `--all --devices i13,i13l,se,desktop` (69 x 4 = 276 shots) | 272 s (~1 s / shot) |
| the same today (70 x 4 = 280 shots, `murk` + `illegible` included) | 290 s, 0 flagged; the 192 in-run shots score 3.1 % dark at most |
| `--quick` (10 shots, i13) | 14 s alone, 21-30 s inside doctor |
| `--quick` today (11 scenes + a 10-frame film = 21 shots, i13) | 14.5 s alone, 35 s inside doctor |
| `--quick` with the crowd film (12 scenes = 26 shots, i13; host at load 12-15) | 22-31 s alone (34.7 s on the tree before the fix: same shots) |
| `npm run scenes` with the crowd film (100 shots; host at load 12-15) | 115-146 s (154 s on the tree before the fix) |
| one scene, one device (server + browser + shot + sheet) | 6 s |
| `npm run scenes` with the `washout` check vs `--no-hero` (82 shots, 50 of them measured; host at load 9-18) | 121-142 s vs 138-140 s: within the noise. `HERO_FINISH` took 12-15 s of worker time (4 workers), median 0.2-0.3 s per in-run shot, nearly all of it the read-back's GPU sync |
| `--self-test` (14 shots, 2 devices) | 16.5 s |

Where the time went, and what fixed it:

- **The first screenshot after a navigation.** It cost 1.4-1.8 s, because SwiftShader GPU-rasterised the
  hub's DOM. Software raster and compositing (`--disable-gpu-rasterization --disable-gpu-compositing`;
  WebGL stays on SwiftShader) brought it to 50-80 ms: 56 shots went from 135 s to 93 s on one page.
- **Parallel pages in one browser.** They were no faster than one page. One browser per worker gave
  93 s -> 64 s on 4 jobs.
- **What is left.** Each shot is a full page load (~0.4 s), the dev build painting the atlas and booting
  (~0.6 s), and the scenario (0.1-1.3 s). Reusing one page through `__kk.scenario()` without a reload was
  0.8 s / shot, but its states leaked between scenarios (up to 62 % of pixels different from a fresh load),
  so every shot reloads.

## 6. Guard rails

### 6.1 `npm run lint:css` (`scripts/lint-css.mjs`, ~0.6 s, no dependencies)

Every `.css` file is bundled into one global stylesheet, and `core/touch.ts`, `screens/levelup.ts` and the
console inject more. The lint parses all of it (nested `@media` / `@supports` / `@container` included). It
also reads the class names TS puts on elements: `class="..."` in templates (with the string literals of
their `${}`), `classList.*`, `className`, and `h()` / `el()` / `img()`.

A rule is **anchored** on class C when C is the only class of its first compound (`.cd`, `.cd:hover`,
`.bn > *`). Such a rule reaches every element with C anywhere in the document. Errors:

- **foreign-bare**: a TS file outside sheet X's module puts C on an element, and X anchors C. It is an
  error when one of these holds:
  - the file's own sheet styles C in another role (two meanings);
  - C is generic or 3 characters or fewer;
  - X is a hub page sheet and the file is an in-run HUD module (`hub-leak`).

  Otherwise the borrowing is reported as a warning.
- **shared-bare**: X anchors C and another module's sheet styles its own C elements. It is an error when
  that sheet uses C under another element (`.bossbar .bn`) or C is generic or short.
- **hub-leak** (element form): a hub page sheet styles a bare element (`button:hover`, `img`).

Not collisions:

- kit classes refined by a page through a compound or scoped selector;
- `body.flag` / `html.flag` state scopes;
- `prefers-reduced-motion` blocks that only switch animations off;
- dead rules (a class no TS ever sets, like the slice's leftover `.meta .pp`).

Warnings:

- `split-definition`: the same component is defined unscoped in two sheets;
- `borrowed`;
- `refinement`;
- `short-name`: a short global class, the next collision waiting to happen.

Proof that it catches the two Season 2 bugs:

- `node scripts/lint-css.mjs --rev 57cb271^` reports the gacha `.cd` reaching the DASH button (`hub-leak` +
  `shared-bare`) and the board's `.bn`. `--rev 1dd3bb7^` reports `.bn` vs `.bossbar .bn`.
- The tree as shipped reports 0 errors and 32 warnings.
- `tests/lint-css.test.ts` (fast suite) runs the same bugs and their fixes on synthetic trees. It also covers
  a bare `button:hover` in a hub sheet, and kit refinements / reduced-motion overrides / dead rules staying
  clean.

### 6.2 `npm run check:artifact` (`scripts/check-artifact.mjs`, ~16 s, 5 s with `--no-build`)

1. Builds the single file and wraps it with `scripts/artifact-page.py`, which writes
   `shots/artifact/kira-kira-overdrive.html`, the page to publish.
2. Serves the CSP preview over http, with the CSP both in the meta tag and in the response header.
3. Boots it as an iPhone 13: a few live frames, then step mode, `hub:mid` and `run:early` + 3 s of play,
   then 0.8 s of the live loop again.

It fails on any of these:

- a CSP violation (`securitypolicyviolation`, recorded from before the first script);
- any `fetch` / XHR / beacon / WebSocket call, `data:` URIs included;
- a request to anything but `data:` / `blob:`;
- an external URL or a literal `fetch("data:` in the page;
- a page error;
- a boot that does not finish within 20 s, or that has already broken (a CSP violation or page error, then
  3 s with no boot: the check gives up then instead of waiting out the 20 s);
- a run that does not play;
- a page over 2.4 MB (it is 2,146,065 B today).

Proof:

- `--self-test` plants `fetch("data:...")` and an external `<img>`, and all three expectations fire.
- The pre-fix tree of the atlas bug (`git archive 80e6a1f^`, run with `--root`) fails with "CSP violation:
  connect-src blocked data" and "fetch(data:image/png;base64,...) at runtime", where it used to boot to a
  black screen in the artifact. That failing run takes 7.7 s, build included; it took 24.6 s before the
  check gave up early on a broken boot.

### 6.3 `npm run check:audio` (`scripts/check-audio.mjs`, ~15-18 s)

```
npm run check:audio                         # both parts
npm run check:audio -- --part device        # only the live devices (~10 s): profile + Android focus
npm run check:audio -- --part cost --json   # only the offline renders, JSON
```

**Part 1, devices** (the real game from the dev server, 3 pages in parallel, step mode so no frames run).
An init script keeps every `AudioContext` the page creates, with its constructor options. After the first tap:

| Device | Must get |
| --- | --- |
| iPhone 13, Pixel 5 (Android) | the lite profile: `sampleRate` 24000 and `latencyHint: "playback"` |
| desktop | the full profile: the default rate and `"interactive"` |

Then, on the Android phone, the three ways Season 2 lost its sound for good (commit 2a8c805):

1. a window blur whose focus event never comes back, then a tap;
2. a hide whose `visible` event is lost, then a tap on the visible page;
3. a system suspend (Android audio focus, an output switch), with no tap at all.

After each one the context must be `running` again within 1.5 s. Today it takes 4 ms, 28 ms and 281 ms
(the game retries a system suspend after 300 ms).

**Part 2, cost.** Renders the real Engine offline through `tools/audio.html` (`window.__audioRender.chaosCost` / `chaos`). It
measures four mixes:

- phone (lite, 24 kHz) and desktop (full, 44.1 kHz);
- each with the base battle chaos and with the heavy Season 2 chaos over the finale theme.

It fails when a mix renders slower than its floor, in x real time:

| Mix | Floor | Measured when the lite profile shipped |
| --- | --- | --- |
| lite heavy | 2.5x | 3.6x |
| lite battle | 6x | 9.1x |
| full heavy | 1.05x | 1.5x |
| full battle | 2x | 2.9x |

A mix that misses its floor is rendered once more and the best render counts. The heavy mixes must also have
no clipping, NaN, silence or DC offset.

Today: 3.2-4.7x / 8-13x / 1.8-2.2x / 3.6-4.5x, with 0 clipped samples and 0 NaN (the low ends inside doctor).

**Shape** (deterministic). The speed floors are noisy on a shared machine: a lite profile that had lost all its
savings (full reverbs and 24 voices at 24 kHz) still rendered at 2.9-3.6x, above its 2.5x floor. So the heavy
renders also count the graph they build (an init script wraps every `create*` of `OfflineAudioContext` and the
`ConvolverNode.buffer` setter). On the same heavy mix the lite profile must start at most 88 % of the full
profile's voice sources, and use at most 50 % of its seconds of convolution impulse. Today: 77 % of the voices
(857 vs 1115; the music's notes are the same in both) and 24 % of the impulse (1.1 vs 4.6 s). The regression
above scores 100 % on both, on any machine and under any load.

### 6.4 `npm run check:bundle` (`scripts/check-bundle.mjs`, ~4 s)

1. `vite build`.
2. The main chunk must stay within 1,575,000 B raw and 530,000 B gzip. Today it is 1,498,877 B (95.2 %)
   and 506,784 B gzip (95.6 %).
3. The dev console (`kkd-panel`) and the scenario list (`results:first-clear`) must not appear in the main
   chunk. They must stay lazy chunks.

## 7. `npm run doctor` and the fast / slow test split

### 7.1 Doctor (`scripts/doctor.mjs`)

Every gate runs as its own process, longest first, on `min(cores, 4)` lanes. The full logs go to
`shots/doctor/<check>.log` and the table gives one line per check. Exit code 1 when any check fails.
A real-time cost budget is load-sensitive: when `check:audio` fails only on cost while doctor's own lanes had the
machine at load 9-16 (its "load average ...: other work was running" note), doctor runs it again alone once the
other checks are done and that run decides (the row reads "rerun alone"). A device / shape failure never reruns.

```
npm run doctor              # typecheck, fast tests, sprites --validate, lint:css, check:audio (cost + devices), check:bundle, check:artifact
npm run doctor -- --scenes  # + scenes --quick
npm run doctor -- --all     # + scenes --quick, and the whole test suite instead of the fast one
npm run doctor -- --only lint:css,typecheck | --skip artifact | --json | --jobs 2
```

| Run | Wall time | Work |
| --- | --- | --- |
| `npm run doctor` | **24 s** | 85 s of work over 4 lanes; audio (cost + devices) 24 s, fast tests 19 s under load, artifact 19 s, bundle 11 s, sprites 9 s, typecheck 3 s, lint 2 s |
| `npm run doctor -- --scenes` | **35 s** | + the quick gallery (12 scenes, Kuro's ult and a crowd filmed: 26 shots), the critical path |
| `npm run doctor -- --all` | 65 s | the full suite, 65 s under load, is the critical path |

### 7.2 Fast / slow tests (`vitest.config.ts`)

Vitest 5 test tags. `vitest.config.ts` extends `vite.config.ts`: the same plugins, plus a fixed
`__KK_BUILD__` so that src/debug/diag.ts keeps one transform. It defines the `slow` tag (timeout 240 s)
and uses every core.

The 82 tests that took more than ~0.2 s carry `{ tags: ["slow"] }`. They are:

- full stage runs and 3-minute bot runs;
- relic and talent sweeps;
- Dream Meadow parity;
- the profile fuzzer;
- the atlas bake raster;
- long gacha samples.

Nothing was moved or deleted: the tag sits on the test in place. A file whose docblock says
`// @module-tag slow` is not even loaded by the fast run (none today).

| Command | Runs | Wall time |
| --- | --- | --- |
| `npm test` | 860 fast tests (82 slow skipped), fs module cache on | **7.6-8.3 s** (was 49-52 s) |
| `npm run test:slow` | the 82 slow tests, cache off | ~40 s |
| `npm run test:all` | all 942, cache off (the old `npm test`) | ~50 s |

Two details:

- The fast run keeps Vitest's fs module cache. I checked that it picks up files added to or removed from an
  `import.meta.glob` folder (the registries).
- `maxWorkers` = cores. The default left one core idle, and the fast run took 9.2 s instead of 7.7 s.

## 8. Proof: Season 2's bugs, re-detected

Each bug that reached the owner in Season 2 was put back, and the suite was run against it. Visual and audio bugs
were put back in a scratch copy of today's tree. The CSS and CSP bugs used the real pre-fix commits. The real tree
was never edited, and it checks clean (§7.1, §5).

| Bug (fix commit) | How it was put back | Caught by | Flag / message | Time |
| --- | --- | --- | --- | --- |
| `.cd` in the gacha sheet threw the DASH button to the top-left (57cb271) | `lint:css --rev 57cb271^` | `npm run lint:css` | `hub-leak` + `shared-bare` on `.cd` (and `.bn`): 4 errors | 2.4 s |
| `.bn` in the Training Arc sheet sat on the boss name (1dd3bb7) | `lint:css --rev 1dd3bb7^` | `npm run lint:css` | `hub-leak` + `shared-bare` on `.bn`: 2 errors (0 at `1dd3bb7` itself) | 2.1 s |
| `fetch(dataURI)` atlas decode: no boot in the CSP sandbox (80e6a1f) | `git archive 80e6a1f^`, `check:artifact --root` | `npm run check:artifact` | "CSP violation: connect-src blocked data", "fetch(data:image/png...) at runtime", "did not boot" | 7.7 s with the build (24.6 s before the fail-fast) |
| Kuro's ETERNAL ABYSS read as "just black" on the phone (a29656d) | the old `GRADES.dim`, the 0.6 vignette and the x10 near-black salamander | `npm run scenes` (key, `--quick`, `doctor --scenes`) | `murk` on the film frames +75f, +105f, +135f: 12-27 % dark pixels (limit 10 %, today under 4 %) | 14.5 s (`--quick`) |
| Speech bubble text: dark ink on `font_main`'s dark outline (a29656d) | the bubbles drawn with `font_main` again | `npm run scenes` (`speech` scenario) | `illegible`: "42 font_main glyphs in ink #2d1b45 on their #2d1b45 outline (contrast 1)" | same run |
| Phones crackled on the full audio profile (32ccada) | phones given the full profile (`wantLite()` false) | `npm run check:audio` (devices) | "phone got the full audio profile (44100 Hz, latencyHint interactive)" on iPhone and Android | 12-18 s |
| ... or the lite profile losing its savings (the same bug, in the engine) | `Engine` ignores `lite` | `npm run check:audio` (shape) | voices 1115 vs 1115 (100 %, max 88 %), reverb 4.6 vs 4.6 s (100 %, max 50 %). The speed floor alone passed it at 2.9-3.6x | 12-15 s |
| Audio silent for good on Android after a focus change (2a8c805) | the 2a8c805 hunks reverted | `npm run check:audio` (devices) | all three cases "audio stays suspended" (blur without focus, lost `visible` event, system suspend) | 11.9 s |

What the proof changed in the tools:

- **Kuro's blackout was not caught at first.** Headless shots of the old ult have a mean luminance of 62-98 and
  under 14 % near-black, far from the `blackout` limits (mean < 8 or 92 % near-black). The phone showed "just
  black" because of its low brightness and its smaller, darker panel.
  - The fix was a new `murk` check. A luminance version (< 40) flagged the Final Arc's saturated violet stage at
    22-62 %, so it measures the brightest channel instead (§5).
  - The ult's single scenario moment (`ult:kuro:mid`) misses the shadow, which has passed by then. So scenes gained
    **films** (`name~frames/every`), and the key and quick sets film that ult.
- **The speech bubbles had no check at all.** The `speech` scenario now puts bubbles on screen, and the
  `illegible` check compares each glyph's ink with its own font's outline (§5).
- **The phone audio bug was invisible to the cost floors.** It was a profile *choice*, and every profile met its
  own floor. `check:audio` now boots the game as real devices and checks which `AudioContext` each one gets. It
  also gained the deterministic shape check, because the noisy speed floors let a lite profile without its savings
  through.
- **The Android focus bug had only a hand-run repro** (`shots/me/bugs/audio.mjs`). It is now part of
  `check:audio`, and so of `npm run doctor`.
- **`check:artifact` waited 20 s on a boot that had already failed.** It now gives up 3 s after a CSP violation or
  page error.
- **Running a tool on an old tree served no fonts.** `node_modules` was a symlink outside Vite's allow list, so
  every font request got a 403 and showed up as a page error. `scripts/lib.mjs` now allows the link's real path.

**How to repeat this for any bug** (no git state change, no edit to the real tree):

```
S=/tmp/proof && mkdir -p $S/tree
# a scratch copy of today's tree, with the bug put back by hand or with a reversed fix ...
tar --exclude=./node_modules --exclude=./shots --exclude=./.git --exclude=./dist --exclude=./dist-single -cf - . | tar -xf - -C $S/tree
ln -s "$PWD/node_modules" $S/tree/node_modules
git show <fix-commit> -- <files> | (cd $S/tree && patch -R -p1)
(cd $S/tree && node scripts/scenes.mjs --only "speech,ult:kuro~180/15" --out ../shots)   # or check-audio.mjs ...
# ... or an old commit as it was
git archive <fix-commit>^ | tar -x -C $S/old && ln -s "$PWD/node_modules" $S/old/node_modules
node scripts/check-artifact.mjs --root $S/old        # the tools of today on the tree of then
node scripts/lint-css.mjs --rev <fix-commit>^        # lint:css reads a commit directly
```

A tool that misses a bug it should catch gets a new check and a `--self-test` fault for it. Do that rather than a
one-off script.

## 9. Before / after, measured

All on this 4-core container (headless Chromium with SwiftShader). "Before" is the Season 2 way: the post-mortem's
numbers (§1), or the old tool re-run today.

| Question | Before | After | |
| --- | --- | --- | --- |
| **A screenshot of a specific moment** (a boss on screen) | 21.7 s with `scripts/shot.mjs` (`skip=355`, 5 s wait), and it missed: no boss on screen, the tutorial hint over the fight (~16 s in the post-mortem) | **5.6 s** cold for `boss:lady_lunatic` with every check (server, browser, shot, sheet), ready 1.8 s after load; **< 1 s** with `__kk.scenario()` in an open page | ~4x, and the right state |
| **A visual sweep** (the key screens, 2 devices) | a hand-written script per sweep, ~16-22 s a state: ~15-20 min for 56 shots (extrapolated), checked by eye | **68 s** for 82 shots (`npm run scenes`), 11 checks per shot, contact sheet, JSON | ~15x (extrapolated) |
| **E2E-equivalent coverage** | `node scripts/e2e.mjs` **6.3 min** (devices one after another), 16-19 screenshots a device checked by eye; 5.0 min re-run today serially with the faster raster | **2.4-2.9 min** for the same flows (the 3 devices in parallel, one browser each). States: `scenes --all` checks 70 states x 4 devices (280 shots) in 4.8 min with automatic flags | 2.2-2.6x for the flows |
| **A balance answer** | **76 min** for one progression measurement; ~25 min for the 480-run matrix; tuning took ~30 such iterations | **11 s** for the full report (cached), **34 s** for a new what-if on one stage, 85 s from an empty cache | 40-400x |
| **The test suite while iterating** | `npm test` **49-52 s** (936 tests, long headless runs mixed in) | **7.6-7.7 s** (860 fast tests); `test:all` keeps all 942 at ~50 s | 6.5x |
| **Pre-commit confidence** | typecheck + `npm test` ≈ 55 s, plus e2e 6.3 min. All of them passed while the 7 bugs in §8 shipped: every one reached the owner | **`npm run doctor` 24 s** catches the CSS, CSP and audio bugs (5 of 7); **`doctor --scenes` 35 s** catches all 7 | 7 of 7 caught before the owner, in ~35 s |
| **Reproducing a bug report from a phone** | "static-y", "just black": several build → publish → report round trips | Settings → ⧉ DIAGNOSTICS pastes the device, tier, fps histogram, audio state and errors; the dev console shows them live | one paste |

Today's gates, for reference:

- `npm run doctor`: 24 s.
- `npm run doctor -- --scenes`: 35 s.
- `npm run scenes`: 68 s for 82 shots.
- `node scripts/e2e.mjs`: 145-173 s.
- `npm test`: 7.7 s.
- `npm run test:all`: 44-50 s.
- `npm run balance:lab`: 11 s cached.

