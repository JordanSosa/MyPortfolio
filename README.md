# KIRA☆KIRA OVERDRIVE · Season 2

A cute, chaotic anime pixel-art **survivors-like** for the browser that grew
into an **incremental roguelite**. You play a magical girl (or a sparkly
bishounen, a chuunibyou, a maid, a mecha pilot... or the isekai truck) holding
back a stampede of Nightmare Plushies. Move, dash and let your weapons fire on
their own. Your build snowballs through level-up cards, evolutions and
anime-style ultimates. Every run, even a 90-second death, pays out, and the
payouts buy permanent power for the next episode.

Season 2 also leans hard into **anime and gacha satire**: a parody gacha with a
printed 0.0069% MYTHIC rate, a "Training Arc" upgrade board, a fan-edited wiki
that is probably wrong, and a final boss who is the network cancelling the
show.

It plays on **phones (touch, portrait or landscape)** and on **desktop
(keyboard, mouse or gamepad)**. Nothing in it is a downloaded or binary asset.
All pixel art is palette grids written in TypeScript, all sound and music is
synthesised with WebAudio, and every effect is a WebGL2 shader.

**Play:** https://jordansosa.github.io/MyPortfolio/ (published from `master` by GitHub Actions)

---

## What's in Season 2

**Runs**

- **5 episodes (stages), 10 to 20 minutes each:** Dream Meadow (10 min),
  Candy Kingdom (12), Shoujo Academy (14), Beach Episode (16) and The Final
  Arc (20). Each has its own enemies, events, look and music.
- **12 bosses:** King Puff, Nightmare Teddy and Lady Lunatic; the Gingerbread
  Golem and the Sugar Plum Tyrant; the Student Council President and The
  Bishounen Who Never Notices You; Kraken-chan and the Summer Festival
  Firework Dragon; Truck-kun, Rival-chan and **CANCEL-SAMA**.
- **11 heroes:** Hoshi, Rin, Mochi, Kuro, Pudding, Aoi, Akane, Senpai,
  Magical Girl #47, Isekai-kun and Truck-kun. Each has a signature weapon, a
  trait, an ultimate with an anime cut-in, a talent tree, six constellations
  and an OC bio.
- **20 weapons, each with two evolutions and Limit Breaks** (40 evolutions:
  one per passive, and a ROUTE SPLIT pick when both are ready), **16 passives**,
  rarity-framed level-up cards, rerolls, banish / skip, and slot-reel chests.
- **The Filler Arc:** after a stage is cleared, an endless mode keeps going
  past the final boss.
- **15 Plot Twists:** opt-in "heat" modifiers (Budget Cuts, Censored,
  Spoilers...) that make a cleared episode harder and pay more.

**The hub (between runs)**

- **Episodes + loadout:** pick the stage, hero, starting weapon, equipped
  relics, Plot Twists and the Filler Arc toggle, then START EPISODE.
- **Episode Results:** the payout ticks in line by line (Star Coins, Dream
  Gems, hero XP, weapon mastery), with records, Plot Points, unlock
  celebrations and a "you can afford..." line that points at what to buy next.
- **Training Arc:** a 120-node constellation board of permanent stat upgrades
  and keystones, bought with Star Coins (pan / pinch on touch, drag / wheel on
  desktop).
- **Heroes:** hero levels, talent points, constellations from duplicate pulls,
  and each hero's bio.
- **Merch Machine (parody gacha):** a permanent banner, a featured-hero banner
  (50/50 rate-up), a featured-merch banner and Truck-kun's Isekai Express
  (MYTHIC 0.0069%). Soft and hard pity, a 1,000-pull MYTHIC spark, dupes
  become Copium for the Copium Exchange, full fine print and pull history.
  Pulls give heroes and **61 relics ("Merch")** that go into your relic slots.
- **Kira Kira Wiki:** a codex of everything you have met, and **171 Plot
  Points** (achievements) to claim for gems and unlocks.
- **Save data:** progress lives in the browser (save v2; a Season 1 save is
  migrated once, with a welcome gift). A run cut short by a reload or a
  closed tab is banked at the next launch; another open window's changes are
  picked up instead of being overwritten; Settings → SAVE DATA exports and
  imports the save as text.

Three currencies: **Star Coins** (every run; the Training Arc, hero levels and respecs),
**Dream Gems** (Plot Points, first clears, a small per-minute trickle; the
Merch Machine) and **Copium** (gacha dupes; the Copium Exchange). There is no
real money anywhere, no idle income, no dailies.

## Controls

| | Touch | Keyboard | Gamepad |
| --- | --- | --- | --- |
| Move | Drag anywhere (floating joystick) | WASD / arrow keys | Left stick / D-pad |
| Dash | DASH button | Space / Shift | A / X / bumpers |
| Overdrive (ultimate) | OVERDRIVE button | E / Enter | B / Y / RT |
| Pause | Pause button (top right) | Esc / P | Start / Back |
| Menus | Tap; swipe to scroll | Arrows / WASD, Enter or Space, Esc or Backspace to go back | D-pad / stick, A to confirm, B to go back |

On the Training Arc, drag with one finger to pan and pinch to zoom (mouse:
drag and wheel). Android's Back gesture closes a sheet, pops a hub page or
pauses a run instead of leaving the game. Tip: on a phone, use **Add to Home
Screen** to play full-screen.

## Under the hood

- **TypeScript (strict) + Vite**, no framework: the hub UI is vanilla DOM
  with a small kit of controls, sheets, toasts and a navigation stack that
  works with touch, mouse, keyboard and gamepad.
- **Renderer:** a custom WebGL2 renderer.
  - The scene is drawn into a low-resolution "art pixel" framebuffer, then
    upscaled with sharp-bilinear filtering, so pixels stay crisp at any screen size.
  - Instanced sprite batching draws the whole scene in one draw call.
  - Bloom fed only by glowing sprites, shockwave distortion, chromatic
    aberration, a vignette and a per-stage colour grade.
  - The production build bakes the sprite atlas at build time, so a phone
    never paints 400+ sprites before the first frame.
- **Juice:** hitstop, slow-mo, screen shake, zoom punch, hit flashes,
  squash-and-stretch, pooled particles, bitmap-font damage numbers, speech
  bubbles and full-screen ultimate cut-ins.
- **Simulation:** pure, with no DOM, WebGL or audio. Gameplay emits typed
  events that the effects, audio and UI listen to, so whole runs play headless
  in Vitest, including bots used for balance and progression tuning.
- **Meta layer (`src/meta`):** the profile, payouts, board, gacha, unlocks and
  Plot Points are pure functions over the save, tested on their own.
- **Audio:** sound effects and original chiptune tracks are synthesised at
  runtime; battle music adds layers as the fight intensifies.
- **Mobile:** multi-touch joystick, 44 px touch targets, safe-area-aware
  layouts in portrait and landscape, auto-pause when backgrounded, the screen
  stays awake during a run (and may sleep while paused), haptics, a PWA
  manifest, and automatic quality scaling measured against the display's own
  refresh rate.

## Docs

- [`docs/EXPANSION.md`](docs/EXPANSION.md): the Season 2 spec (pillars, progression targets, systems).
- [`docs/META.md`](docs/META.md): the meta layer (profile, economy, board, gacha, Plot Points, progression simulator).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): code map, events, app flow, save safety, verification, URL params and `__kk` hooks.
- [`docs/ENGINE.md`](docs/ENGINE.md): renderer, atlas boot path, effects and input APIs.
- [`docs/DESIGN.md`](docs/DESIGN.md): the base game design.
- [`docs/content/`](docs/content/README.md): the content bible (heroes, weapons, enemies, stages, relics, gacha, Plot Points, satire lines, art manifest).

## Development

Requires Node 22+.

```sh
npm install
npm run dev            # dev server; --host is on, so you can open it on a phone on the same network
npm run typecheck
npm test               # unit tests, meta-layer tests and headless bot runs through every stage and boss
npm run build          # dist/ for GitHub Pages (bakes the sprite atlas)
npm run build:single   # dist-single/index.html: the whole game in one self-contained file (works from file://)
npm run preview        # serve the production build
```

Balance and progression tools:

```sh
npm run balance                                # headless full-run probe: heroes x seeds x a good and a lazy bot
CP=P2 STAGE=candy_kingdom BOT=mid npm run balance   # one account checkpoint's RunConfig on one stage
node tools/matrix.mjs                          # power-vs-stage matrix: checkpoints P0-P7 x stages x heroes x seeds
npm run progression                            # account progression simulator (BOT=weak|mid|strong RUNS=...)
```

`npm run progression` plays a whole account from a fresh save (runs, payouts,
board buys, pulls, talents) and reports when the first pull, King Puff and each
first clear happen; docs/META.md §9 has the targets.

Browser checks (Playwright, headless Chromium; screenshots go to `shots/`):

```sh
node scripts/e2e.mjs        # desktop, phone portrait, phone landscape: splash -> hub -> run -> Results -> hub pages
node scripts/flows.mjs      # Season 2 account flows: fresh save, v1 migration, endless, navigation, keyboard / gamepad
node scripts/touch.mjs      # touch-only Training Arc checks (pan, pinch, tap) on iPhone 13
node scripts/shot.mjs --path "/?autoplay=1&skip=150" --mobile --wait 5000 --out shots/x.png
npm run sprites -- --validate                  # validate every sprite against src/art/manifest.ts
npm run sprites -- --filter hoshi --scale 6 --out shots/hoshi.png   # sprite contact sheet
```

Dev-only pages on the dev server: `/tools/sprites.html` (sprite browser),
`/tools/audio.html` (sound and music board), `/tools/engine-test.html`,
`/tools/tiles.html`.

**Debug URL parameters:** `?autoplay=1` (a bot plays) · `?hero=<id>` ·
`?stage=<id>` · `?seed=N` · `?skip=SECONDS` · `?god=1` · `?speed=N` ·
`?mute=1` · `?quality=low|mid|high` · `?fps=1` ·
`?screen=hub|stages|loadout|board|heroes|hero|gacha|wiki|settings|game` ·
run configs such as `?relics=sakuga_cel:6` `?twists=budget_cuts:3`
`?endless=1` `?cons=6` `?lb=star_shot:2`. `?god`, `?skip` and `?speed` turn
any run, even one started from the hub, into a practice run that is never
saved. In the console, `window.__kk` exposes helpers such as `skipTo`,
`spawn`, `boss`, `give`, `relic`, `twist`, `levelUp`, `chest`, `ult` and
`runStats`. docs/ARCHITECTURE.md §8 lists them all.

## Deployment

`.github/workflows/deploy-pages.yml` installs, tests, builds and publishes
`dist/` to GitHub Pages on every push to `master` (enable it once under
**Settings → Pages → Source: GitHub Actions**). The build uses relative paths,
so it works under any sub-path; set `BASE_PATH` to force one.
`.github/workflows/ci.yml` type-checks, tests and builds every pull request.
`npm run build:single` makes a single self-contained `index.html` that can be
shared or opened straight from disk.
