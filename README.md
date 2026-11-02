# KIRA☆KIRA OVERDRIVE

A cute, chaotic anime pixel-art **survivors-like** for the browser. You play a
magical girl holding back a stampede of Nightmare Plushies until dawn: move,
dash and let your weapons fire on their own. Your build snowballs through
level-up cards, evolutions and anime-style ultimates.

It plays on **phones (touch, portrait or landscape)** and on **desktop
(keyboard or gamepad)**. Nothing in it is a downloaded or binary asset. All
pixel art is palette grids written in TypeScript, all sound and music is
synthesised with WebAudio, and every effect is a WebGL2 shader.

**Play:** https://jordansosa.github.io/MyPortfolio/ (published from `master` by GitHub Actions)

---

## What's in a run

- **10 minutes, fast loop:** first level-up within seconds, a dash with a 1.2 s
  cooldown, combo ranks from C to SSS that boost XP, and an **Overdrive** ultimate
  with an anime cut-in about once a minute.
- **3 heroes:** Hoshi (star magician), Rin (shrine swordswoman) and Mochi
  (neko-girl). Each has her own starting weapon, trait and ultimate: Supernova
  Shower, Thousand Blossom Cut and Nyan Stampede.
- **8 weapons, each with an evolution:** Star Shot → Galaxy Barrage,
  Petal Slash → Sakura Tempest, Yarn Orbit → Cosmic Yarn, Heart Boomerang →
  Love Tornado, Thunder Bell → Raijin Drum, Candy Bomb → Sugar Nuke,
  Bubble Aura → Ocean Dome, Prism Beam → Rainbow Cannon.
- **8 passives**, rarity-framed level-up cards, rerolls, and slot-reel treasure chests.
- **8 enemy types plus elites**, director events (bat swarms, encircling rings,
  floods, wisp rushes) and **3 bosses**. King Puff arrives at 3:00 and
  Nightmare Teddy at 6:00. Lady Lunatic, the three-phase final boss with
  bullet-hell attacks, arrives at 9:00, and beating her makes dawn break.
- **Dream Shop:** permanent upgrades bought with the coins you collect, saved in your browser.

## Controls

| | Touch | Keyboard | Gamepad |
| --- | --- | --- | --- |
| Move | Drag anywhere (floating joystick) | WASD / arrow keys | Left stick |
| Dash | DASH button | Space / Shift | A |
| Overdrive (ultimate) | OVERDRIVE button | E / Enter | B / RT |
| Pause | Pause button (top right) | Esc / P | Start |

Tip: on a phone, use **Add to Home Screen** to play full-screen.

## Under the hood

- **Renderer:** a custom WebGL2 renderer.
  - The scene is drawn into a low-resolution "art pixel" framebuffer, then
    upscaled with sharp-bilinear filtering, so pixels stay crisp at any screen size.
  - The camera moves smoothly between pixels.
  - Instanced sprite batching draws the whole scene in one draw call.
- **Post-processing:** bloom fed only by glowing sprites, shockwave distortion,
  chromatic aberration, a vignette and a colour grade that runs from day
  through dusk to night.
- **Juice:** hitstop, slow-mo, screen shake, zoom punch, hit flashes,
  squash-and-stretch, a pooled particle system, bitmap-font damage numbers,
  lightning and afterimages.
- **Simulation:** pure, with no DOM, WebGL or audio. Gameplay emits typed
  events, and the effects, audio and UI listen to them. This lets the whole
  game run headless in Vitest, including a bot that plays full runs for
  balance testing.
- **Audio:** sound effects and seven original chiptune tracks are synthesised
  at runtime. Battle music adds layers as the fight intensifies, music is
  muffled while you pick upgrades, and a limiter keeps the mix from clipping.
- **Mobile:** multi-touch floating joystick, safe-area-aware HUD, a guard so a
  finger still held from moving can't pick a level-up card, auto-pause when the
  app is backgrounded, automatic quality scaling, haptics and a PWA manifest.

Docs: [`docs/DESIGN.md`](docs/DESIGN.md) (design spec) ·
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (code map, events, how to add content) ·
[`docs/ENGINE.md`](docs/ENGINE.md) (renderer, effects and input APIs).

## Development

Requires Node 22+.

```sh
npm install
npm run dev            # dev server; --host is on, so you can open it on a phone on the same network
npm run typecheck
npm test               # unit tests + headless bot runs through bosses and victory
npm run balance        # full-run balance probe (bot runs across heroes and seeds)
npm run build          # dist/ for GitHub Pages
npm run build:single   # dist-single/index.html: the whole game in one self-contained file
```

Tooling:

- `npm run sprites -- --filter hoshi --scale 6 --out shots/hoshi.png` renders
  a sprite contact sheet and validates every sprite against `src/art/manifest.ts`.
- `node scripts/shot.mjs --path "/?autoplay=1&skip=150" --mobile --wait 5000 --out shots/x.png`
  takes a headless screenshot with phone emulation.
- `node scripts/e2e.mjs` runs the end-to-end flow on desktop, phone portrait and phone landscape.

Debug URL parameters: `?autoplay=1` (a bot plays) · `?hero=hoshi|rin|mochi` ·
`?skip=SECONDS` · `?god=1` · `?seed=N` · `?mute=1` · `?quality=low|high` ·
`?screen=title|select|shop` · `?fps=1`. In the console, `window.__kk` exposes
helpers such as `skipTo`, `spawn`, `boss`, `give`, `levelUp`, `chest` and `ult`.

## Deployment

`.github/workflows/deploy-pages.yml` tests, builds and publishes `dist/` to
GitHub Pages on every push to `master` (enable it once under **Settings →
Pages → Source: GitHub Actions**). `.github/workflows/ci.yml` type-checks,
tests and builds every pull request.
