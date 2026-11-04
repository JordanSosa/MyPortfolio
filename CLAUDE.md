# CLAUDE.md: Kira Kira Overdrive

Read this first. It tells you which tool answers which question in seconds. Season 2 took 30+ hours,
mostly because agents waited on headless frames and re-scripted the same setups (`docs/DEVTOOLS.md` §1).
Don't repeat that.

## What this is

Kira Kira Overdrive is a cute anime pixel-art survivors-like that grew into an incremental roguelite. The
owner plays it mostly on a phone.

- **Stack:** TypeScript strict, Vite 8, TypeScript 7 (native `tsc`, about 2 s), a custom WebGL2 renderer,
  a vanilla DOM UI and synthesized WebAudio. There are no binary assets.
- **Ships twice:**
  - GitHub Pages: `npm run build` writes `dist/`.
  - A single-file build: `npm run build:single`, published inside a **CSP-sandboxed artifact viewer**.

## Where things live

| Path | What |
| --- | --- |
| `src/game/` | **Pure** simulation: World, content registries (weapons, enemies, bosses, stages, relics, ...). No DOM, WebGL, audio or storage. |
| `src/meta/` | **Pure** account layer: profile, economy, board, gacha, unlocks. No DOM or localStorage (`src/ui/save.ts` is the only storage boundary). |
| `src/view/`, `src/ui/` | Drawing the world; the App state machine, HUD, hub (`ui/hub/`), UI kit (`ui/kit/`), screens. |
| `src/core/`, `src/render/`, `src/fx/` | Engine: loop, input, WebGL2 renderer, particles (`docs/ENGINE.md`). |
| `src/audio/` | Synth engine (full / phone "lite" profiles), offline renderer (`render.ts`). |
| `src/debug/` | `window.__kk` hooks, bot, step mode, scenarios, snapshot, dev console, profiler, diagnostics. |
| `tests/` | Vitest suites, fast by default; long ones are tagged `slow`. |
| `tools/` | Balance lab, probes, checkpoints (seeded accounts), audio bench. |
| `scripts/` | Playwright and Node tools: scenes, doctor, the checks, e2e, flows, shot. |

Further docs:

- `docs/ARCHITECTURE.md`: module map, frame flow, how to add content, verification.
- `docs/DEVTOOLS.md`: this suite in depth.
- `docs/META.md`, `docs/ENGINE.md`, `docs/DESIGN.md`.

## Use these tools first

| You need | Run | Time |
| --- | --- | --- |
| Confidence before a commit | `npm run doctor` (add `--scenes` for visuals, `--all` for the slow tests too) | ~25 s (35 s with `--scenes`) |
| Unit tests while iterating | `npm test` (the fast suite); `npm run test:slow` / `npm run test:all` for long headless runs | 8 s / 40 s / 50 s |
| Type errors | `npm run typecheck` | 2 s |
| To *see* the game (any change to UI, art, fx or layout) | `npm run scenes`, then open `shots/scenes/latest/contact.png` | ~70 s for 82 shots |
| A narrower visual check | `npm run scenes -- --only boss:,ult: --devices i13,se`; `--all` covers all 81 scenarios | seconds |
| A transient effect (an ult, a flash, a phase change) | film it: `npm run scenes -- --only "ult:kuro~180/15"` (a checked shot every 15 frames for 180) or `--film` | ~6 s |
| Visual regressions | `npm run scenes -- --baseline` once, then `npm run scenes -- --diff` | |
| A specific game state | `/?scenario=<name>&step=1`, then `__kk.step(n)` and `await __kk.snapshot()` (JSON). List: `await __kk.scenarios()` | <1 s |
| Live state on a device | dev console: `?dev=1`, the `` ` `` key, or a 3-finger long-press | |
| A balance or difficulty answer | `npm run balance:lab` and what-ifs with `--set "boss.*.hp*=0.9"` | 10 s warm, 85 s cold |
| Publishing the artifact | `npm run check:artifact` (the CSP boot check); publish `shots/artifact/kira-kira-overdrive.html` | 18 s |
| A change to audio | `npm run check:audio` (phone cost budget + lite-profile shape, clipping, NaN; the profile each device gets; Android focus-loss recovery) | 18 s |
| The real flows with real taps | `node scripts/e2e.mjs` (3 devices in parallel) | ~3 min |
| Did a tool really catch an old bug? | `docs/DEVTOOLS.md` §8: export the old commit, link `node_modules`, run the tool from the copy | |
| A change to CSS or class names | `npm run lint:css` | 1 s |
| Bundle growth | `npm run check:bundle` (main-chunk budget; dev code must stay lazy) | 5 s |

Every script prints its usage with `--help` (`node scripts/scenes.mjs --help`, `npm run balance:lab -- --help`).

A tool is wrong if it is slow, flaky or misses a bug. When that happens, fix the tool rather than working
around it. `docs/DEVTOOLS.md` §8 shows how each check was proven against the Season 2 bug it exists for.

## Rules

- Keep `src/game` and `src/meta` pure, as above.
- Tools reuse the real code paths: the real `World`, the bot, the real meta builders (`tools/checkpoints.ts`)
  and the real renderer. **Never fork game logic** into a script.
- **Never wait on the wall clock in headless.** SwiftShader WebGL runs at 1-6 fps, so use
  `?step=1` / `__kk.step(n)` and the scenario hooks.
  - Need a state no scenario reaches? Add a scenario in `src/debug/scenarios.ts`. Don't write another
    one-off Playwright script.
- Tag a new test that runs the sim for more than ~0.2 s: `test("...", { tags: ["slow"] }, () => ...)`.
  `npm test` must stay under 10 s.
- Developer-only code loads lazily (`src/debug/dev.ts` loaders). `check:bundle` fails if the console or the
  scenarios reach the main chunk.
- Other agents may be editing the same tree.
  - Re-read a shared file (`package.json`, `src/ui/app.ts`, `src/main.ts`, `docs/*`) right before you edit it.
  - Keep those edits small.
  - Don't change git state unless asked.

## Pitfalls that already cost us (each has a check now)

- **Global CSS.**
  - Every `.css` file and every injected `<style>` ends up in one global stylesheet.
  - A bare `.cd` in the gacha sheet threw the in-run DASH button to the top-left.
  - A bare `.bn` in the Training Arc sheet sat on the boss name.
  - Namespace classes per module (`kk-`, `gc-`, `bb-`, `kkd-`, ...).
  - Never style a short bare class, or a bare element in a hub page sheet. `npm run lint:css`.
- **CSP sandbox.**
  - The published artifact may not fetch or XHR, even `data:` URIs, and may not reach external URLs.
  - A `fetch(dataURI)` atlas decode made the game fail to boot there.
  - Inline everything and decode without `fetch`. `npm run check:artifact`.
- **Phone audio cost.**
  - Busy fights rendered at 1.5x real time on a server core, so phones crackled.
  - Phones use the lite profile (24 kHz, 12 voices). Keep the heaviest mix at 2.5x real time or better.
    `npm run check:audio` also boots the game as an iPhone, an Android phone and a desktop and checks the
    AudioContext each one gets, and that the lite graph stays structurally cheaper than the full one.
- **Android audio focus.**
  - A window blur with no focus event back (a notification, the host app's UI) left the game silent for good.
  - `npm run check:audio` replays the blur, a lost 'visible' event and a system suspend on an Android phone:
    the sound must come back within 1.5 s each time.
- **Blackouts, murk, illegible text and placeholders.**
  - Kuro's first ETERNAL ABYSS read as "just black" on the owner's phone while headless shots looked merely
    moody (mean luminance 62-98). `npm run scenes` flags `murk`: in-run frames where more than 10 % of the
    pixels have no channel above 56. The shadow pass is transient, so the key scenes **film** that ult
    (`ult:kuro~180/15`). A single scenario moment missed it.
  - Speech bubbles drew dark ink with `font_main`'s dark outline, so every letter became a blob. `illegible`
    flags any bitmap text whose ink is about as dark as its font's outline (the `speech` scenario shows bubbles).
  - Also flagged: blackouts, whiteouts, blank screens, placeholder sprites, page errors, elements cut off at
    the viewport edge and sideways scrolling. `--self-test` proves each check fires.
- **Headless time.**
  - Episode Results and the gacha summon run on `performance.now()`. The scenarios handle that; your
    script should not.
  - The in-run shots are not pixel-exact between loads yet: scorch decals in `fx/presets.ts` and the attract
    game in `ui/session.ts` read the wall clock. Treat small `--diff` percentages on in-run scenes as noise.
- **The owner's save.**
  - Scenarios run in a save sandbox.
  - `?god` / `?skip` / `?speed` turn a run into a practice run that is never banked.
  - Never write to a real profile from a tool.
