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
| **Dev console** (in game: `?dev=1`, the `` ` `` key, or a 3-finger long-press on phones) | ad-hoc `__kk` scripts, guesswork | inspect and drive any live state in seconds, on any device |
| **Diagnostics export** ("Copy diagnostics" in Settings and in the console) | vague bug reports | one paste tells us the device, quality tier, fps/frame-time histogram, audio state (rate, latency, voices, stress, skipped notes) and the recent errors |
| **Scenarios + deterministic stepping** (`?scenario=…`, `?step=1`, `__kk.step(n)`, `__kk.snapshot()`) | waiting on wall-clock fps | any moment reproducible in under 2 s, the same every time |
| **`npm run scenes`** (gallery: parallel pages, contact sheet, automatic visual metrics + anomaly flags) | 426 bespoke scripts | 20+ key screens in about 1 minute, with blackouts, missing sprites and errors flagged automatically |
| **`npm run balance:lab`** (analytic model + parallel short sims + cached HTML report) | 76-minute measurements | a balance answer in under 2 min; what-if tweaks in seconds |
| **`npm run doctor`** (typecheck + fast tests + sprite check + CSS collision lint + artifact CSP boot + audio cost budget + bundle size) | bugs found by the owner | run before every commit: under 2-3 minutes |
| **Fast/slow test split** (`npm test` fast, `npm run test:slow`) | 49 s default suite | default under 10 s |
| **`CLAUDE.md`** | agents rediscovering tooling | every agent starts from the suite |
