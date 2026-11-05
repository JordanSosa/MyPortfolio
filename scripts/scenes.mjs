// Scene gallery + automatic visual checks (docs/DEVTOOLS.md §5). One Vite dev server, one Chromium per worker
// (--jobs, default 4); every shot is a named scenario reached in step mode (/?scenario=<name>&step=1: no
// wall-clock waits), measured, flagged, and laid out on one contact sheet.
//
//   npm run scenes                                  the key screens (29, Kuro's ult filmed) on i13 + desktop
//   npm run scenes -- --only boss:,ult:             scenarios whose name starts with one of these (or equals one)
//   npm run scenes -- --only "ult:kuro~180/15"      a FILM: the scenario, then a checked shot every 15 frames for 180
//                                                   (transient effects: an ult's shadow pass, a flash, a phase change)
//   npm run scenes -- --all                         every scenario __kk.scenarios() lists (108)
//   npm run scenes -- --devices i13,i13l,se,desktop,w360 --jobs 4   (also fhd 1920x1080, laptop 1366x768, half 683x768)
//   npm run scenes -- --baseline                    store these shots as the visual baseline (shots/scenes/baseline/); every
//                                                   scene is loaded twice and its load-to-load diff kept as its noise floor
//   npm run scenes -- --diff                        compare against the baseline: perceptual pixel diff % per shot (a
//                                                   <name>.diff.png per changed shot; warning > 0.5 %, error > 10 %)
//   npm run scenes -- --quick                       an 11-scene smoke subset on one device (doctor --scenes)
//   npm run scenes -- --self-test                   inject each fault (blackout, whiteout, overflow, sideways scroll,
//                                                   placeholder art, page error, murk, illegible text, a white haze
//                                                   over the hero) into one scene: all must be flagged
//   npm run scenes -- --only crowd: --film 120/15   every hero mid / late in a busy run, filmed (the washout check)
//   npm run scenes -- --only "crowd:pudding:mid~60/30" --blame 12
//                                                   washout attribution: the 12 draw call sites nearest the hero, each
//                                                   drawn alone / dropped, her readability re-measured (+ no bloom,
//                                                   no particles, no <layer>...); in summary.json probe.hero.blame
//   flags: --out <dir> (default shots/scenes/latest)  --full-res (device-pixel PNGs; default CSS px)  --sound
//          --film [frames/every] (film every scene; default 120/15)
//          --seed N --hero <id> --profile <p>  --param k=v[,k=v]  --timeout 30000
//          --diff-threshold 0.5 (a warning + diff image above it)  --diff-fail 10 (an error above it)
//          --no-fail (exit 0 even with flagged shots)  --json (print the summary JSON instead of the table)
//          --no-seed-random (keep the browser's Math.random; by default it is seeded so shots repeat exactly)
//          --hero-dump (<name>.hero.png: what the washout check compared)  --no-hero (skip the washout check)
//
// Per shot: mean luminance, % near-black, % near-white, % dark (no channel above 56: `murk` on in-run frames),
// luminance spread, placeholder sprites drawn (WebGL draws of placeholder atlas handles during one render + DOM
// .px-missing icons), illegible bitmap text (ink about as dark as its font's outline), page errors, DOM elements
// with text / controls outside the viewport (not clipped by a scrolling / hidden ancestor), page-level
// horizontal scroll, scenario readiness, and on in-run frames how much of the HERO's own contrast survives (`washout`:
// a hero-only render of the same frame vs the frame, over her pixels). Thresholds in CHECKS below; a shot breaking an error-level one fails
// the run (exit 1). Output: <out>/<device>/<name>.png, contact.png (every shot, flags in red), index.html,
// summary.json (for agents).
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, startServer, launchBrowser as launchLib } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    return require(`${execSync("npm root -g").toString().trim()}/playwright`);
  }
}
const { devices } = loadPlaywright();
/** lib.mjs's browser: SwiftShader WebGL + software raster / compositing for the DOM (fast first screenshots). */
export const launchBrowser = () => launchLib();
const ROOT = fileURLToPath(new URL("..", import.meta.url));

// ------------------------------------------------------------------ what to shoot
/** The key screens: every hub page, each stage's look, early / late runs, bosses, ults, modals, results, gacha. */
export const KEY_SCENES = [
  "hub:fresh", "hub:rich", "stages", "loadout", "board", "heroes", "hero:kuro", "gacha", "wiki", "settings",
  "run:early", "run:late", "stage:candy_kingdom", "stage:shoujo_academy", "stage:beach_episode", "stage:final_arc",
  "boss:lady_lunatic", "boss:gingerbread_golem:p2", "boss:cancel_sama", "speech",
  // (filmed: Kuro's ETERNAL ABYSS shadow pass is a transient full-screen effect between two scenario moments)
  "ult:hoshi", "ult:kuro~180/15", "ult:truck_kun:mid",
  "levelup", "chest:golden", "pause", "over:death", "results:first-clear", "gacha:pull-x10",
];
/** doctor --scenes: one of each kind, one device (11 scenes, 21 shots with Kuro's filmed ult). */
export const QUICK_SCENES = ["hub:mid", "board", "gacha", "run:early", "run:late", "boss:king_puff", "speech", "ult:kuro~150/15", "levelup", "over:death", "results:victory"];

export const DEVICE_LIST = {
  i13: () => ({ ...devices["iPhone 13"] }),
  i13l: () => {
    const d = { ...devices["iPhone 13"] };
    return { ...d, viewport: { width: d.viewport.height, height: d.viewport.width } };
  },
  se: () => ({ ...devices["iPhone SE"] }),
  w360: () => ({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["Pixel 5"].userAgent }),
  desktop: () => ({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }),
  // more desktop windows (keyboard / mouse: no touch controls, the HUD's Overdrive gauge instead): a 1080p monitor,
  // a small laptop, and a browser snapped to half of that laptop's screen
  fhd: () => ({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }),
  laptop: () => ({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 }),
  half: () => ({ viewport: { width: 683, height: 768 }, deviceScaleFactor: 1 }),
};

/**
 * Anomaly thresholds. `level: "error"` fails the run. OVERRIDES (`when` = a scenario name pattern) relax a check
 * for a scene that is meant to look that way.
 */
export const CHECKS = {
  blackout: { level: "error", nearBlack: 92, meanLum: 8 }, // % of pixels with luminance < 14, or mean < 8 (the all-black ult)
  whiteout: { level: "error", nearWhite: 55 }, // % of pixels with luminance > 242
  blank: { level: "error", std: 3 }, // luminance standard deviation below this = one flat colour
  dark: { level: "warning", meanLum: 22 },
  // In-run play (no modal): % of "dark" pixels (no RGB channel above 56: what reads as black on a phone at low
  // brightness; a saturated violet ground of the same luminance does not count). Kuro's first ETERNAL ABYSS
  // (GRADES.dim + a x10 near-black salamander) peaked at 12-27 % during its shadow pass, which looked merely moody on
  // a desktop monitor and "just black" on the owner's phone. Every in-run scene today stays under 4 %.
  murk: { level: "error", dark: 10 },
  placeholder: { level: "error" }, // any placeholder sprite drawn / DOM icon missing
  // bitmap text whose ink is about as dark as its font's own outline (WCAG contrast < 1.5): every letter merges
  // into a blob (the Season 2 speech bubbles: plum ink on font_main's plum outline)
  illegible: { level: "error", contrast: 1.5 },
  // In-run play (no modal, no ult cut-in): is the HERO still readable? Her own pixels (a hero-only render of the
  // same frame) against the frame: `keep` = % of her own luminance contrast that survives (the slope of frame
  // luminance on clean luminance over her pixels; a haze or bloom over her squashes it toward 0, sparks on top
  // barely move it). Calibrated on 70 in-run scenes + films on i13 (docs/DEVTOOLS.md §5): every frame at keep >= 70
  // reads clearly; the orbital haze over Mochi / Pudding (Shoujo Academy 3:20) scored 3-41. Error below `keep`, warning below
  // `keepWarn`. `radius` (art px) = the disc around her for the reported `halo` (% near-white).
  washout: { level: "error", keep: 35, keepWarn: 55, radius: 20 },
  pageError: { level: "error" },
  scroll: { level: "error" }, // the page scrolls sideways (phones)
  overflow: { level: "warning" }, // text / buttons outside the viewport
  // --diff: % of pixels that changed perceptibly. Above `pct` (+ the scene's noise floor) = a warning with a diff
  // image to look at; above `failPct` = an error. In-run scenes are not pixel-exact yet (fx/presets.ts caps scorch
  // decals on performance.now(), the hub's attract game budgets its catch-up on wall time): 0-6 % between loads.
  diff: { level: "warning", pct: 0.5, failPct: 10 },
};
const OVERRIDES = [
  // e.g. { when: /^ult:kuro/, dark: null }  (a scene meant to be that dark: drop or loosen one check for it).
  // None needed today: across all 69 scenarios x 4 devices the darkest shot has mean luminance 30 (gacha:mythic),
  // the most near-black 58 %, the most near-white 18 %, the flattest a luminance spread of 30.
];

/**
 * Runs before any page script: Math.random becomes a seeded PRNG (mulberry32) so particles, the attract game
 * and fxRng repeat exactly from load to load (the sim itself is seeded already); without it two loads of the
 * same in-run scenario differ by 6-15 % of their pixels and --diff is useless.
 */
const SEED_RANDOM = () => {
  let a = 0x6b6b2026;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Console noise that is not a game error (SwiftShader / Vite chatter). */
const BENIGN = [/GPU stall due to ReadPixels/i, /\[vite\]/i, /Automatic fallback to software WebGL/i, /WebGL.*performance warning/i, /favicon/i];

// ------------------------------------------------------------------ in-page probe
/**
 * Runs in the page after the scenario is ready: counts placeholder draws and illegible glyph draws over one
 * render, DOM issues, snapshot. `lite` (film frames after the first): the WebGL draw checks and the snapshot only.
 */
export const PROBE = async ({ lite = false, contrast = 1.5, heroR = 20, blame = 0, heroDump = false, hero: heroOn = true } = {}) => {
  const kk = window.__kk;
  const out = { scenario: kk.scenarioState ?? null, placeholders: 0, placeholderIds: [], illegible: [], domMissing: 0, overflow: [], scrollX: 0, snap: null };
  // ---- hero readability (washout): the real render below records the hero's own draw calls and reads the box
  // around her; after the screenshot, HERO_FINISH replays just those calls (no game or view code runs: nothing in the
  // run changes) for her silhouette and how she looks with nothing on top (same grade / dim / flash), and compares.
  let hero = null;
  try {
    const app = kk.app;
    const g = app.game;
    const w = g?.world;
    if (heroOn && w && app.screen === "game" && !app.modal && !w.player.dead && g.view?.heroHud !== false) hero = heroSetup(app, g, w);
  } catch (e) {
    out.heroError = String(e);
  }
  function heroSetup(app, g, w) {
    const r = app.r;
    const gl = r.gl;
    const cam = r.camera;
    const p = w.player;
    const pref = `${w.hero.sprite}_`;
    const hs = new Set();
    for (const s of r.atlas.sprites.values()) if (s.id.startsWith(pref)) for (let i = 0; i < s.count; i++) hs.add(s.first + i);
    const rect = r.canvas.getBoundingClientRect();
    const dpr = r.canvas.width / Math.max(1, rect.width);
    const c = cam.worldToScreen(p.x, p.y - 10, { x: 0, y: 0 });
    // read a box of +-(heroR + 6) art px around the body (canvas px); the disc for `halo` is heroR art px
    const half = (heroR + 6) * cam.scale * dpr;
    const x0 = Math.max(0, Math.floor(c.x * dpr - half));
    const y0 = Math.max(0, Math.floor(c.y * dpr - half));
    const x1 = Math.min(r.canvas.width, Math.ceil(c.x * dpr + half));
    const y1 = Math.min(r.canvas.height, Math.ceil(c.y * dpr + half));
    const rw = x1 - x0;
    const rh = y1 - y0;
    if (rw < 8 || rh < 8) return null;
    const read = () => {
      const buf = new Uint8Array(rw * rh * 4);
      const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // (bottom-up rows; every buffer is read the same way)
      gl.readPixels(x0, gl.drawingBufferHeight - y1, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
      return buf;
    };
    // Her draws: the Entity sprite, and on a busy screen the beacon's redraw above the fx (Bullets layer: no lean,
    // a 1 px plum outline), which is what shows
    const mine = (layer, h, x, y) => (layer === 3 || layer === 7) && hs.has(h) && Math.abs(x - p.x) < 1.5 && Math.abs(y - p.y) < 12;
    const draws = [];
    const ctx = { draws, mine, read, shot: null, finish: null };
    ctx.finish = (blame, heroDump) => heroFinish(app, g, w, ctx, { rect, dpr, x0, y1, rw, rh, read, mine, hs, cam, r, gl, p }, blame, heroDump);
    return ctx;
  }
  function heroFinish(app, g, w, ctx, B, blame, heroDump) {
    const t0 = performance.now();
    const { rect, dpr, x0, y1, rw, rh, read, mine, hs, cam, r, p } = B;
    const b = r.batch;
    const ps = app.fx.ps;
    const ghosts = app.fx.ghosts;
    // her recorded draws replayed alone (bloom off: nothing glows, so its blur passes would add nothing)
    const bloomWas = r.post.bloomEnabled;
    let clean;
    try {
      r.post.bloomEnabled = false;
      r.beginFrame(0);
      for (const d of ctx.draws) b.drawP(...d);
      r.endFrame();
      clean = read();
    } finally {
      r.post.bloomEnabled = bloomWas;
    }
    const shot = ctx.shot;
    // the empty background per row: its two border columns (the box is ~3x her size), interpolated across; her mask
    // = pixels off that, and their centroid = the disc centre
    const n = rw * rh;
    const mask = new Uint8Array(n);
    let cnt = 0, sx = 0, sy = 0;
    for (let j = 0; j < rh; j++) {
      const L = j * rw * 4;
      const R0 = L + (rw - 2) * 4;
      for (let i = 0; i < rw; i++) {
        const t = i / (rw - 1);
        const k = L + i * 4;
        let d = 0;
        for (let ch = 0; ch < 3; ch++) d += Math.abs(clean[k + ch] - ((clean[L + ch] + clean[L + 4 + ch]) / 2) * (1 - t) - ((clean[R0 + ch] + clean[R0 + 4 + ch]) / 2) * t);
        if (d < 30) continue;
        mask[j * rw + i] = 1;
        cnt++;
        sx += i;
        sy += j;
      }
    }
    if (cnt < 12) return null;
    const cx = sx / cnt;
    const cy = sy / cnt;
    const R = heroR * cam.scale * dpr;
    const lum = (d, k) => 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
    const chroma = (d, k) => Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]);
    /**
     * The hero's readability in a frame `shot` (same box), over her pixels (clean luminance c, frame luminance f):
     *  keep  % of her own contrast that survives: the slope of f on c (least squares) x 100. A haze over her
     *        (f = a*c + (1-a)*white) gives a; bloom adds and clips toward white; sparks on top add noise, not slope
     *  ink   % of her clean dark pixels (outline, eyes: c < 80) that still read dark (f < 110)
     *  wash  % of her pixels lifted to near-white (f > 215, chroma < 60) that were not near-white clean
     *  lift  mean luminance added;  halo  % near-white pixels in the disc of heroR art px around her
     */
    const measure = (shot) => {
      let nInk = 0, kept = 0, washed = 0, sc = 0, sf = 0, scc = 0, scf = 0, sff = 0, disc = 0, halo = 0;
      const R2 = R * R;
      for (let i = 0, k = 0; i < n; i++, k += 4) {
        const ls = lum(shot, k);
        const dx = (i % rw) - cx;
        const dy = ((i / rw) | 0) - cy;
        if (dx * dx + dy * dy <= R2) {
          disc++;
          if (ls > 215 && chroma(shot, k) < 60) halo++;
        }
        if (!mask[i]) continue;
        const lc = lum(clean, k);
        sc += lc;
        sf += ls;
        scc += lc * lc;
        scf += lc * ls;
        sff += ls * ls;
        if (lc < 80) {
          nInk++;
          if (ls < 110) kept++;
        }
        if (lc <= 215 && ls > 215 && chroma(shot, k) < 60) washed++;
      }
      const pc = (a, b2) => (b2 ? +((a / b2) * 100).toFixed(1) : null);
      const vc = scc / cnt - (sc / cnt) ** 2;
      const vf = sff / cnt - (sf / cnt) ** 2;
      const cv = scf / cnt - (sc / cnt) * (sf / cnt);
      return {
        keep: vc > 25 ? +((cv / vc) * 100).toFixed(1) : null,
        corr: vc > 25 && vf > 1 ? +(cv / Math.sqrt(vc * vf)).toFixed(2) : null,
        ink: nInk >= 8 ? pc(kept, nInk) : null,
        wash: pc(washed, cnt),
        lift: +((sf - sc) / cnt).toFixed(1),
        halo: pc(halo, disc),
      };
    };
    // (rows are bottom-up: screen y = y1 - 1 - row)
    // (+ the glow load that gates the bloom limiter and the hero beacon, and the beacon's blast cover: WorldView)
    const res = { x: Math.round((x0 + cx) / dpr + rect.left), y: Math.round((y1 - 1 - cy) / dpr + rect.top), r: Math.round(R / dpr), px: cnt, cutin: w.ult?.phase === "cutin", load: +r.post.load.toFixed(2), cover: +(g.view.coverT ?? 0).toFixed(2), ...measure(shot) };
    res.ms = Math.round(performance.now() - t0 + (ctx.readMs ?? 0));
    if (blame > 0) res.blame = heroBlame();
    // --hero-dump: the buffers (top-down rows) for <name>.hero.png
    if (heroDump) {
      const b64 = (u8) => {
        const t = new Uint8Array(u8.length);
        for (let j = 0; j < rh; j++) t.set(u8.subarray((rh - 1 - j) * rw * 4, (rh - j) * rw * 4), j * rw * 4);
        let str = "";
        for (let i = 0; i < t.length; i += 0x8000) str += String.fromCharCode(...t.subarray(i, i + 0x8000));
        return btoa(str);
      };
      const m = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) m[i * 4] = mask[i];
      res.dump = { w: rw, h: rh, mask: b64(m), clean: b64(clean), shot: b64(shot) };
    }
    return res;

    // ---- --blame: which draws wash her out (after the screenshot: these renders run the view's draw code again).
    function heroBlame() {
      // the view's per-render counters (frameN: every-Nth-frame sparks, ghosts): restored after a side render
      const ctrs = [g.view, ...Object.values(g.view)].filter((o) => o && typeof o === "object" && typeof o.frameN === "number");
      /**
       * One side render: draws filtered by `keep(layer, handle, x, y, flags)`, particle / ghost spawns from draw code
       * blocked, Math.random swapped for a fixed-seed one, the view's frame counters and fxRng put back: every blame
       * render sees the same frame.
       */
      const rng = ps.rng;
      const side = (keep, mutate, bloom = true) => {
        const fn = ctrs.map((o) => o.frameN);
        const rs = rng ? [rng.a, rng.b, rng.c, rng.d] : null;
        const origP = b.drawP;
        const origBloom = r.post.bloomEnabled;
        // (no glow sprite drawn = no bloom to add: skip its blur passes, the costliest part of a SwiftShader frame)
        if (!bloom) r.post.bloomEnabled = false;
        const origS = b.drawSub;
        const origE = ps.emit;
        const origG = ghosts?.spawn;
        const origR = Math.random;
        let s = 0x2545f491;
        Math.random = () => {
          s = (s + 0x6d2b79f5) | 0;
          let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        b.drawP = function (layer, handle, x, y, sx, sy, rot, col, a, fl, flags, ...rest) {
          if (keep(layer, handle, x, y, flags, a, sx, sy)) return origP.call(this, layer, handle, x, y, sx, sy, rot, col, a, fl, mutate ? mutate(flags) : flags, ...rest);
        };
        b.drawSub = function (layer, handle, ...rest) {
          if (keep(layer, handle, rest[4], rest[5], rest[11], rest[9], rest[6], rest[7])) return origS.call(this, layer, handle, ...rest);
        };
        ps.emit = () => {};
        if (ghosts) ghosts.spawn = () => null;
        try {
          // the draw half of App.frame only (kk.render() would also run the frame's logic at dt 0: the driving bot
          // thinks, the HUD updates, and every later film frame would drift from a run without the check)
          r.beginFrame(0);
          g.draw(r.time, 0, 0);
          app.fx.draw();
          r.endFrame();
          return read();
        } finally {
          delete b.drawP;
          delete b.drawSub;
          delete ps.emit;
          if (ghosts) delete ghosts.spawn;
          if (b.drawP !== origP) b.drawP = origP;
          if (b.drawSub !== origS) b.drawSub = origS;
          if (ps.emit !== origE) ps.emit = origE;
          if (ghosts && ghosts.spawn !== origG) ghosts.spawn = origG;
          Math.random = origR;
          r.post.bloomEnabled = origBloom;
          ctrs.forEach((o, i) => (o.frameN = fn[i]));
          if (rs) [rng.a, rng.b, rng.c, rng.d] = rs;
        }
      };
      // ---- --blame: which draws wash her out. One recording render notes every draw call site near her (stack
      // trace -> the first frame outside src/render/), then each of the top `blame` sites is dropped in turn (all of
      // its draws, so its bloom goes too) and her readability re-measured; plus whole-class variants.
      // Particles come from many emitters through one draw call: from the first --blame probe on, every ps.emit is
      // tagged with its call site (kept through the pool's swap-removes), so the shots after it (a film:
      // --blame --film 60/30) name the emitter behind each particle
      const tagged = !!ps.__kkTags;
      if (!tagged) {
        const tags = (ps.__kkTags = new Array(ps.capacity));
        const emit = ps.emit;
        const kill = ps.kill;
        ps.emit = function (...a) {
          const c0 = this.count;
          const k0 = this.cursor;
          emit.apply(this, a);
          const st = String(new Error().stack).split("\n").slice(2);
          let site = "?";
          for (const l of st) {
            const m = /at (?:new )?([^\s(]+)?\s*\(?(?:[^)]*\/)?([^/:)\s]+\.(?:ts|js))/.exec(l);
            if (m && !/particles\.ts/.test(m[2])) {
              site = `${m[1] ?? "?"} (${m[2]})`;
              break;
            }
          }
          for (let i = c0; i < this.count; i++) tags[i] = site;
          for (let i = k0; i !== this.cursor; i = (i + 1) % this.capacity) tags[i] = site;
        };
        ps.kill = function (i) {
          tags[i] = tags[this.count - 1];
          return kill.call(this, i);
        };
      }
      {
        const sprOf = new Map();
        for (const s of r.atlas.sprites.values()) for (let i = 0; i < s.count; i++) sprOf.set(s.first + i, s.id);
        const near = (heroR + 48) ** 2;
        const keyOf = new Map();
        const sites = new Map();
        const siteOf = (h) => {
          const st = String(new Error().stack).split("\n").slice(2);
          const fr = [];
          for (const l of st) {
            if (/\/src\/render\/|\bat (side|heroBlame|heroFinish|PROBE)\b|pptr|playwright|<anonymous>/.test(l)) continue;
            const m = /at (?:new )?([^\s(]+)?\s*\(?(?:[^)]*\/)?([^/:)\s]+\.(?:ts|js|mjs))/.exec(l);
            if (!m) continue;
            fr.push(`${m[1] ?? "?"} (${m[2]})`);
            if (fr.length >= 2) break;
          }
          let k = fr.join(" <- ") || "?";
          // generic drawers get what they drew: the particle's emitter, the projectile's weapon, the sprite
          if (/particles\.ts/.test(k)) k = `particles: ${sprOf.get(h) ?? h}${tagOf ? ` from ${tagOf.get(`${curX}|${curY}`) ?? "(emitted before the probe)"}` : ""}`;
          else if (/drawProjectiles/.test(k)) k = `projectile ${projOf.get(`${curX}|${curY}`) ?? "?"} [${sprOf.get(h) ?? h}] (world-view.ts drawProjectiles)`;
          else k = `${k} [${sprOf.get(h) ?? h}]`;
          return k;
        };
        const projOf = new Map();
        // (a falling projectile draws at y - z, the rest at y: both keys)
        for (const q of w.projectiles.items)
          if (!q.dead) for (const yy of [q.y, q.y - (q.z ?? 0)]) projOf.set(`${q.x}|${yy}`, q.source || q.owner?.def.id || "?");
        // (particles draw at (x, y - z): a position -> emitter map, rebuilt by the draw of the recording render)
        let tagOf = null;
        let curX = 0;
        let curY = 0;
        const psDraw = ps.draw;
        if (ps.__kkTags)
          ps.draw = function (...a) {
            tagOf = new Map();
            for (let i = 0; i < this.count; i++) tagOf.set(`${this.x[i]}|${this.y[i] - this.z[i]}`, ps.__kkTags[i] ?? "?");
            return psDraw.apply(this, a);
          };
        side((layer, h, x, y, flags, a, sxx, syy) => {
          curX = x;
          curY = y;
          const dx = x - p.x;
          const dy = y - (p.y - 10);
          const area = Math.min(4000, (b.fw?.[h] ?? 8) * (b.fh?.[h] ?? 8) * Math.abs(sxx * syy));
          // (every draw gets its site, so dropping a site drops its far draws and their bloom too; only near ones score)
          const k = siteOf(h);
          keyOf.set(`${layer}|${h}|${x}|${y}`, k);
          if (dx * dx + dy * dy < near + area) {
            let s = sites.get(k);
            if (!s) sites.set(k, (s = { site: k, draws: 0, glow: 0, add: 0, score: 0, layers: new Set() }));
            s.draws++;
            if (flags & 6) s.glow++;
            if (flags & 1 || layer === 6) s.add++;
            s.layers.add(layer);
            s.score += a * area * (1 + (flags & 6 ? 2 : 0) + (flags & 1 || layer === 6 ? 1 : 0));
          }
          return true;
        });
        delete ps.draw;
        if (ps.draw !== psDraw) ps.draw = psDraw;
        // a site's draws are found again by (layer, handle, x, y) of the recording render (same frame, dt 0)
        const base = measure(side(() => true));
        const top = [...sites.values()].sort((a, b2) => b2.score - a.score).slice(0, blame);
        const rows = [];
        const d = (k, m) => (m[k] != null && base[k] != null ? +(m[k] - base[k]).toFixed(1) : null);
        const delta = (m) => ({ keep: m.keep, dKeep: d("keep", m), dInk: d("ink", m), dWash: d("wash", m), dLift: d("lift", m), dHalo: d("halo", m) });
        // drop one site (its marginal share), and draw it alone over the ground + her (what it does by itself: haze
        // saturates, so with several white-hot sources dropping any one barely helps while each alone washes her out)
        const bare = measure(side((layer, h, x, y) => layer <= 2 || mine(layer, h, x, y)));
        for (const s of top) {
          const m = measure(side((layer, h, x, y) => keyOf.get(`${layer}|${h}|${x}|${y}`) !== s.site));
          const al = measure(side((layer, h, x, y) => layer <= 2 || mine(layer, h, x, y) || keyOf.get(`${layer}|${h}|${x}|${y}`) === s.site));
          const alone = al.keep != null && bare.keep != null ? +(al.keep - bare.keep).toFixed(1) : null;
          rows.push({ site: s.site, draws: s.draws, glow: s.glow, add: s.add, layers: [...s.layers].join(","), score: Math.round(s.score), ...delta(m), alone, aloneKeep: al.keep });
        }
        const variants = {};
        const bloomWas = r.post.bloomEnabled;
        try {
          r.post.bloomEnabled = false;
          variants["no bloom"] = delta(measure(side(() => true)));
        } finally {
          r.post.bloomEnabled = bloomWas;
        }
        variants["no Glow flags (no bloom from sprites)"] = delta(measure(side(() => true, (f) => f & ~6)));
        variants["no FxAdd layer / Add flag"] = delta(measure(side((layer, h, x, y, flags) => layer !== 6 && !(flags & 1))));
        variants["no particles"] = delta(measure(side((layer, h, x, y) => !/^particles:/.test(keyOf.get(`${layer}|${h}|${x}|${y}`) ?? ""))));
        const LN = ["ground", "decal", "shadow", "entity", "fxBelow", "fx", "fxAdd", "bullets", "text", "overlay"];
        for (const L of [1, 3, 4, 5, 6, 7, 8, 9]) variants[`no ${LN[L]} layer (but her)`] = delta(measure(side((layer, h, x, y) => layer !== L || mine(layer, h, x, y))));
        variants["hero only + ground"] = delta(bare);
        return { base, bare, sites: rows.sort((a, b2) => (a.alone ?? 0) - (b2.alone ?? 0) || (b2.dKeep ?? 0) - (a.dKeep ?? 0)), variants, sitesNear: sites.size, tagged };
      }
    }
  }
  try {
    const r = kk.app.r;
    const ph = new Map();
    for (const s of r.atlas.sprites.values()) if (s.placeholder) for (let i = 0; i < s.count; i++) ph.set(s.first + i, s.id);
    // bitmap text: glyph handle -> font, and each font's auto outline (FontDef.outline: default #2d1b45, false = none).
    // Ink about as dark as its own outline merges every letter into a blob (the Season 2 speech bubbles).
    const glyph = new Map();
    for (const [id, f] of r.atlas.fonts) for (let c = 0; c < 256; c++) if (f.handle[c] >= 0) glyph.set(f.handle[c], id);
    window.__kkFontDefs ??= await import("/src/art/sprites/index.ts").then((m) => m.ALL_FONTS).catch(() => []);
    window.__kkPalette ??= await import("/src/art/palette.ts").then((m) => m.PALETTE).catch(() => ({}));
    const hex = (h) => (h ? parseInt(String(h).replace("#", ""), 16) : -1);
    const outline = new Map(window.__kkFontDefs.map((d) => [d.id, d.outline === false ? -1 : hex(d.outline?.[0] === "#" ? d.outline : window.__kkPalette[d.outline ?? ""] ?? d.outline ?? "#2d1b45")]));
    const b = r.batch;
    const orig = b.drawP;
    const seen = new Map();
    const inks = new Map();
    // drawP(layer, handle, x, y, sx, sy, rot, color, alpha, flash, flags, ...)
    b.drawP = function (layer, handle, ...rest) {
      const id = ph.get(handle);
      if (id !== undefined) seen.set(id, (seen.get(id) ?? 0) + 1);
      if (hero && hero.mine(layer, handle, rest[0], rest[1])) hero.draws.push([layer, handle, ...rest]);
      const fid = glyph.get(handle);
      if (fid !== undefined && rest[6] >= 0.35) {
        const k = `${fid}|${rest[5]}|${Math.round(rest[7] * 20) / 20}`;
        inks.set(k, (inks.get(k) ?? 0) + 1);
      }
      return orig.call(this, layer, handle, ...rest);
    };
    try {
      const tR = performance.now();
      kk.render();
      out.renderMs = Math.round(performance.now() - tR);
      // (read in the same task as the render: the drawing buffer is not presented yet)
      if (hero) {
        const tRead = performance.now();
        hero.shot = hero.read();
        hero.readMs = performance.now() - tRead;
        // (finished by HERO_FINISH once the screenshot is taken)
        window.__kkHero = hero;
        out.heroPending = true;
      }
    } finally {
      delete b.drawP;
      if (b.drawP !== orig) b.drawP = orig;
    }
    out.placeholders = [...seen.values()].reduce((a, n) => a + n, 0);
    out.placeholderIds = [...seen.keys()].slice(0, 8);
    // WCAG contrast ratio between the ink (tint x white glyph, pushed to white by `flash`) and the outline
    const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const lum = (rgb) => 0.2126 * lin((rgb >> 16) & 255) + 0.7152 * lin((rgb >> 8) & 255) + 0.0722 * lin(rgb & 255);
    for (const [k, n] of inks) {
      const [fid, colS, flS] = k.split("|");
      const ol = outline.get(fid) ?? -1;
      if (ol < 0) continue;
      const col = Number(colS) >>> 0;
      const fl = Number(flS);
      const ink = [16, 8, 0].reduce((a, sh) => a | (Math.round(((col >> sh) & 255) * (1 - fl) + 255 * fl) << sh), 0);
      const a = lum(ink);
      const o = lum(ol);
      const ratio = (Math.max(a, o) + 0.05) / (Math.min(a, o) + 0.05);
      if (ratio < contrast) out.illegible.push({ font: fid, ink: `#${ink.toString(16).padStart(6, "0")}`, outline: `#${ol.toString(16).padStart(6, "0")}`, ratio: +ratio.toFixed(2), glyphs: n });
    }
  } catch (e) {
    out.probeError = String(e);
  }
  if (lite) {
    try {
      const s = await kk.snapshot();
      out.snap = { screen: s.screen, modal: s.modal, hubPage: s.hubPage, run: s.run ? { stage: s.run.stage, t: s.run.t, hero: s.run.hero, level: s.run.level, enemies: s.run.enemies.total, boss: s.run.boss?.id ?? null, ult: s.run.ult.phase } : null, errors: s.errors.errors };
    } catch (e) {
      out.snapError = String(e);
    }
    return out;
  }
  const vis = (el) => (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true);
  out.domMissing = [...document.querySelectorAll(".px-missing")].filter(vis).length;
  const vw = innerWidth;
  const vh = innerHeight;
  // sideways scroll: the document (when it can scroll at all), or a vertical page scroller (a hub page) whose
  // content got wider than itself (strips that scroll sideways on purpose have overflow-y hidden / visible)
  out.scrollX = Math.max(0, document.documentElement.scrollWidth - vw);
  out.scrollEl = null;
  for (const el of document.body.querySelectorAll("*")) {
    if (el.clientWidth < vw * 0.5 || el.closest(".kkd")) continue;
    const cs = getComputedStyle(el);
    if (!/auto|scroll/.test(cs.overflowY) || /hidden|clip/.test(cs.overflowX)) continue;
    const extra = el.scrollWidth - el.clientWidth;
    if (extra > 2 && extra > out.scrollX) {
      out.scrollX = extra;
      out.scrollEl = el.tagName.toLowerCase() + (el.classList.length ? "." + [...el.classList].slice(0, 2).join(".") : "");
    }
  }
  // an element past the viewport edge is a bug unless an inner box clips it on purpose (a card's rounded corners,
  // a carousel) or a scroll container makes it reachable; a clip by body / a full-screen root is the viewport's
  const hiddenOnPurpose = (el) => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) return true;
      const r = p.getBoundingClientRect();
      return !(r.width >= vw * 0.95 && r.height >= vh * 0.95);
    }
    return false;
  };
  // mid-flight: an unfinished (finite) transition / animation that moves it or an ancestor (a strip sliding in)
  const MOVES = /^(transform|translate|left|right|top|bottom|inset|margin)/;
  const moving = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      for (const a of e.getAnimations()) {
        if (a.playState === "finished" || a.effect?.getComputedTiming?.().iterations === Infinity) continue;
        if (a.transitionProperty && MOVES.test(a.transitionProperty)) return true;
        const kf = a.effect?.getKeyframes?.() ?? [];
        if (kf.some((k) => Object.keys(k).some((p) => MOVES.test(p)))) return true;
      }
    }
    return false;
  };
  const path = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) parts.unshift(e.tagName.toLowerCase() + (e.classList.length ? "." + [...e.classList].slice(0, 2).join(".") : ""));
    return parts.join(" > ");
  };
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest(".kkd, script, style, canvas")) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own && !el.matches("button, a, input, select, [data-act]")) continue;
    const rc = el.getBoundingClientRect();
    if (rc.width < 2 || rc.height < 2) continue;
    const over = Math.max(rc.right - vw, -rc.left, rc.bottom - vh, -rc.top);
    if (over <= 2) continue;
    if (!vis(el) || hiddenOnPurpose(el) || moving(el)) continue;
    // fully off screen = parked / sliding in (a toast, a page in transition), not an overflow
    if (rc.left >= vw || rc.right <= 0 || rc.top >= vh || rc.bottom <= 0) continue;
    out.overflow.push({ el: path(el), text: (el.textContent ?? "").trim().slice(0, 40), px: Math.round(over) });
    if (out.overflow.length >= 6) break;
  }
  try {
    const s = await kk.snapshot();
    out.snap = {
      screen: s.screen,
      modal: s.modal,
      hubPage: s.hubPage,
      run: s.run ? { stage: s.run.stage, t: s.run.t, hero: s.run.hero, level: s.run.level, enemies: s.run.enemies.total, boss: s.run.boss?.id ?? null, ult: s.run.ult.phase } : null,
      sprites: s.perf.sprites,
      drawCalls: s.perf.drawCalls,
      particles: s.perf.particles,
      errors: s.errors.errors,
    };
  } catch (e) {
    out.snapError = String(e);
  }
  return out;
};

/** After the screenshot: the washout measurement of the frame PROBE recorded (null = no hero to measure). */
export const HERO_FINISH = ({ blame = 0, heroDump = false } = {}) => {
  const h = window.__kkHero;
  window.__kkHero = null;
  try {
    return h ? h.finish(blame, heroDump) : null;
  } catch (e) {
    return { error: String(e) };
  }
};

/** --self-test: each fault is injected into one shot and must be flagged as `expect` (none = a clean shot). */
export const FAULTS = {
  none: { expect: null },
  blackout: { expect: "blackout" },
  whiteout: { expect: "whiteout" },
  overflow: { expect: "overflow" },
  scroll: { expect: "scroll" },
  placeholder: { expect: "placeholder" },
  pageError: { expect: "pageError" },
  murk: { expect: "murk" },
  illegible: { expect: "illegible" },
  washout: { expect: "washout" },
};
const INJECT = async (fault) => {
  const box = (bg) => {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;inset:0;z-index:2147483646;background:${bg}`;
    document.body.appendChild(d);
  };
  if (fault === "blackout") box("#000");
  else if (fault === "whiteout") box("#fff");
  else if (fault === "overflow") {
    const b = document.createElement("button");
    b.textContent = "CUT OFF BUTTON";
    b.style.cssText = `position:fixed;top:40%;left:${innerWidth - 60}px;width:220px;z-index:2147483646`;
    document.body.appendChild(b);
  } else if (fault === "scroll") {
    // a page scroller whose row is too wide (what an unconstrained flex row does on a 360 px phone)
    const pg = document.createElement("div");
    pg.style.cssText = "position:fixed;inset:0;overflow:auto;z-index:2147483646;pointer-events:none";
    const row = document.createElement("div");
    row.style.cssText = `width:${innerWidth + 300}px;height:10px`;
    pg.appendChild(row);
    document.body.appendChild(pg);
  } else if (fault === "placeholder") {
    // every atlas sprite pretends to be placeholder art: whatever the scene draws must be counted
    for (const s of window.__kk.app.r.atlas.sprites.values()) s.placeholder = true;
  } else if (fault === "murk") {
    // a dimmed screen with a big near-black shape over the middle (Kuro's first ETERNAL ABYSS), not a full blackout
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;left:15%;top:25%;width:70%;height:40%;border-radius:40%;z-index:2147483646;background:rgba(16,10,28,.92);pointer-events:none";
    document.body.appendChild(d);
  } else if (fault === "illegible") {
    // every bitmap string in the outline colour (dark ink on font_main's dark outline: the first speech bubbles)
    const t = window.__kk.app.r.text;
    const ink = 0x2d1b45;
    const fast = t.drawFast.bind(t);
    t.drawFast = (layer, str, x, y, scale, _c, ...rest) => fast(layer, str, x, y, scale, ink, ...rest);
    const codes = t.drawCodes.bind(t);
    t.drawCodes = (layer, cs, n, x, y, scale, _c, ...rest) => codes(layer, cs, n, x, y, scale, ink, ...rest);
    const draw = t.draw.bind(t);
    t.draw = (str, x, y, o = {}) => draw(str, x, y, { ...o, color: ink, rainbow: false, flash: 0 });
  } else if (fault === "washout") {
    // a white haze over the hero (what stacked additive glows + bloom do): drawn into the frame after the view, a
    // soft white disc + a white glow on her body. The rest of the screen stays as it was (no whiteout).
    const app = window.__kk.app;
    const v = app.game.view;
    const draw = v.draw.bind(v);
    v.draw = (...a) => {
      draw(...a);
      const p = app.game.world.player;
      app.r.circle(9, p.x, p.y - 10, 24, 0xfffaf2, 0.82);
      app.r.glow(p.x, p.y - 10, 30, 0xffffff, 0.9);
    };
  } else if (fault === "pageError") {
    setTimeout(() => {
      throw new Error("scenes self-test: injected page error");
    });
    await new Promise((r) => setTimeout(r, 20));
  }
};

// ------------------------------------------------------------------ pixels
/** Luminance stats of an RGBA PNG. */
export function pixelMetrics(png) {
  const { data, width, height } = png;
  const n = width * height;
  let sum = 0, sq = 0, black = 0, white = 0, dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += y;
    sq += y * y;
    if (y < 14) black++;
    else if (y > 242) white++;
    // "dark" = no channel above 56: dimmed grey / black reads as black on a phone at low brightness, a saturated
    // violet ground of the same luminance (the Final Arc) does not
    if (data[i] < 56 && data[i + 1] < 56 && data[i + 2] < 56) dark++;
  }
  const mean = sum / n;
  const pct = (k) => +((k / n) * 100).toFixed(1);
  return { meanLum: +mean.toFixed(1), std: +Math.sqrt(Math.max(0, sq / n - mean * mean)).toFixed(1), nearBlack: pct(black), nearWhite: pct(white), dark: pct(dark) };
}

/** Perceptual diff (YIQ distance, as pixelmatch does): % of pixels that changed, and a diff image. */
export function pixelDiff(a, b, threshold = 0.1) {
  if (a.width !== b.width || a.height !== b.height) return { pct: 100, size: `${b.width}x${b.height} -> ${a.width}x${a.height}`, png: null };
  const maxDelta = 35215 * threshold * threshold;
  const out = new PNG({ width: a.width, height: a.height });
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const r1 = a.data[i], g1 = a.data[i + 1], b1 = a.data[i + 2];
    const r2 = b.data[i], g2 = b.data[i + 1], b2 = b.data[i + 2];
    const y = (r1 - r2) * 0.29889531 + (g1 - g2) * 0.58662247 + (b1 - b2) * 0.11448223;
    const iq = (r1 - r2) * 0.59597799 - (g1 - g2) * 0.2741761 - (b1 - b2) * 0.32180189;
    const q = (r1 - r2) * 0.21147017 - (g1 - g2) * 0.52261711 + (b1 - b2) * 0.31114694;
    const d = 0.5053 * y * y + 0.299 * iq * iq + 0.1957 * q * q;
    if (d > maxDelta) {
      diff++;
      out.data[i] = 255, out.data[i + 1] = 0, out.data[i + 2] = 80, out.data[i + 3] = 255;
    } else {
      const g = (0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1) * 0.35 + 30;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = g, out.data[i + 3] = 255;
    }
  }
  return { pct: +((diff / (a.width * a.height)) * 100).toFixed(2), png: out };
}

// ------------------------------------------------------------------ run
const fileName = (name) => name.replace(/[^a-zA-Z0-9_.-]+/g, "_");
/** Default film when `--film` has no value: 2 s, a frame every 0.25 s. */
const FILM_DEFAULT = "120/15";
/** `ult:kuro~180/15` -> the scenario `ult:kuro`, filmed for 180 frames with a check every 15. `dflt` = --film. */
export function parseSpec(name, dflt = null) {
  const [scenario, filmS] = String(name).split("~");
  const f = filmS ?? dflt;
  if (!f) return { scenario, film: null };
  const [frames, every] = String(f === true || f === "" ? FILM_DEFAULT : f).split("/").map(Number);
  if (!(frames > 0)) throw new Error(`bad film '${f}' in '${name}' (frames/every, e.g. ~180/15)`);
  const ev = every > 0 ? every : Math.max(1, Math.round(frames / 8));
  return { scenario, film: { frames, every: ev } };
}

function flagsFor(name, shot) {
  const ov = Object.assign({}, ...OVERRIDES.filter((o) => o.when.test(name)));
  const c = (k) => (k in ov ? ov[k] && { ...CHECKS[k], ...ov[k] } : CHECKS[k]);
  const f = [];
  const add = (k, msg) => {
    const chk = c(k);
    if (chk) f.push({ kind: k, level: chk.level, msg });
  };
  const m = shot.metrics;
  const p = shot.probe ?? {};
  if (shot.harnessError) f.push({ kind: "harness", level: "error", msg: shot.harnessError });
  if (p.scenario && p.scenario.status !== "ready") f.push({ kind: "scenario", level: "error", msg: `scenario ${p.scenario.status}: ${p.scenario.error ?? ""}` });
  if (m) {
    const bo = c("blackout");
    if (bo && (m.nearBlack > bo.nearBlack || m.meanLum < bo.meanLum)) add("blackout", `blackout: ${m.nearBlack}% near-black, mean luminance ${m.meanLum}`);
    const wo = c("whiteout");
    if (wo && m.nearWhite > wo.nearWhite) add("whiteout", `whiteout: ${m.nearWhite}% near-white`);
    const bl = c("blank");
    if (bl && m.std < bl.std) add("blank", `blank screen: luminance spread ${m.std}`);
    const dk = c("dark");
    if (dk && m.meanLum < dk.meanLum && !f.some((x) => x.kind === "blackout")) add("dark", `very dark: mean luminance ${m.meanLum}`);
    const mk = c("murk");
    const play = p.snap && p.snap.screen === "game" && !p.snap.modal;
    if (mk && play && m.dark > mk.dark && !f.some((x) => x.kind === "blackout")) add("murk", `the play area reads as black on a phone: ${m.dark}% of pixels have no channel above 56 (limit ${mk.dark}%), mean luminance ${m.meanLum}`);
  }
  const wo = c("washout");
  const h = p.hero;
  if (wo && h && h.keep != null && !h.cutin && p.snap?.screen === "game" && !p.snap.modal && h.keep < wo.keepWarn) {
    const err = h.keep < wo.keep;
    f.push({ kind: "washout", level: err ? wo.level : "warning", msg: `the hero is lost in the frame: ${h.keep}% of her contrast survives (${err ? "error" : "warning"} under ${err ? wo.keep : wo.keepWarn}%; ${h.ink ?? "-"}% of her outline still dark, ${h.wash}% of her pixels near-white, +${h.lift} luminance, ${h.halo}% near-white within ${h.r}px) at (${h.x}, ${h.y})` });
  }
  if (p.illegible?.length) add("illegible", `illegible bitmap text: ${p.illegible.slice(0, 3).map((x) => `${x.glyphs} ${x.font} glyphs in ink ${x.ink} on their ${x.outline} outline (contrast ${x.ratio})`).join("; ")}`);
  if (p.placeholders || p.domMissing) add("placeholder", `placeholder art: ${p.placeholders} sprite draws${p.placeholderIds?.length ? ` (${p.placeholderIds.join(", ")})` : ""}, ${p.domMissing} missing DOM icons`);
  if (shot.errors?.length) add("pageError", `${shot.errors.length} page errors: ${shot.errors[0].slice(0, 160)}`);
  if (p.scrollX > 0) add("scroll", `${p.scrollEl ?? "the page"} scrolls sideways by ${p.scrollX}px`);
  if (p.overflow?.length) add("overflow", `${p.overflow.length} elements outside the viewport: ${p.overflow.slice(0, 2).map((o) => `${o.el} "${o.text}" (${o.px}px)`).join("; ")}`);
  if (shot.diff && shot.diff.pct > shot.diffThreshold) {
    const big = shot.diff.pct > (shot.diffFail ?? CHECKS.diff.failPct) || shot.diff.size;
    f.push({ kind: "diff", level: big ? "error" : CHECKS.diff.level, msg: `visual diff ${shot.diff.pct}% vs baseline (threshold ${shot.diffThreshold}%${shot.diff.noise ? `, noise ${shot.diff.noise}%` : ""})${shot.diff.size ? ` (size ${shot.diff.size})` : ""}${shot.diff.file ? ` -> ${shot.diff.file}` : ""}` });
  }
  return f;
}

async function resolveNames(browser, base, args) {
  if (args["self-test"] && !args.only) return ["run:early"];
  if (args.quick && !args.only && !args.all) return QUICK_SCENES;
  if (!args.only && !args.all) return KEY_SCENES;
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/?step=1&mute=1`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__kk && typeof window.__kk.scenarios === "function", null, { timeout: 30000 });
  const all = (await page.evaluate(() => window.__kk.scenarios())).map((s) => s.name);
  await ctx.close();
  if (args.all) return all;
  const pre = String(args.only).split(",").map((s) => s.trim()).filter(Boolean);
  const names = all.filter((n) => pre.some((p) => n === p || (p.endsWith(":") || p.endsWith("@") ? n.startsWith(p) : n.startsWith(p + ":") || n === p)));
  // a name that is not in the list (e.g. run:300@final_arc, a parametric one) is passed through as is
  for (const p of pre) if (!p.endsWith(":") && !names.includes(p) && !all.some((n) => n.startsWith(p + ":"))) names.push(p);
  return names;
}

function sheetHtml(shots, devicesUsed, title, srcOf) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sections = devicesUsed.map((dev) => {
    const list = shots.filter((s) => s.device === dev);
    const land = list[0] && list[0].w > list[0].h;
    const wBase = land ? 300 : 170;
    const cells = list.map((s) => {
      const w = s.filmOf ? Math.round(wBase * 0.6) : wBase;
      const bad = s.flags.filter((f) => f.level === "error");
      const warn = s.flags.filter((f) => f.level !== "error");
      const tags = [...bad.map((f) => `<b class="e">${esc(f.kind)}</b>`), ...warn.map((f) => `<b class="w">${esc(f.kind)}</b>`)].join("");
      const hm = s.probe?.hero;
      const m = s.metrics ? `L${Math.round(s.metrics.meanLum)} d${Math.round(s.metrics.dark)}% w${Math.round(s.metrics.nearWhite)}%${hm && hm.keep != null ? ` h${Math.round(hm.keep)}%` : ""}` : "";
      return `<figure class="${bad.length ? "bad" : warn.length ? "warn" : ""}" style="width:${w}px"><img src="${srcOf(s)}" style="width:${w}px"><figcaption><span class="n">${esc(s.filmOf ? `+${s.frame}f` : s.name)}</span><span class="m">${s.filmOf ? "" : `${(s.ms.ready / 1000).toFixed(1)}s `}${m}${s.diff ? ` Δ${s.diff.pct}%` : ""}</span>${tags ? `<span class="t">${tags}</span>` : ""}</figcaption></figure>`;
    });
    return `<section><h2>${esc(dev)} <small>${list.length} shots</small></h2><div class="grid">${cells.join("")}</div></section>`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{margin:0;padding:12px;background:#140c22;color:#efe8ff;font:12px/1.3 ui-monospace,Menlo,Consolas,monospace}
h1{font-size:15px;margin:0 0 8px}h2{font-size:13px;margin:14px 0 6px;color:#ffd6f5}h2 small{color:#a99bc4;font-weight:400}
.grid{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;background:#22163a;border:2px solid #3b2a5c;border-radius:6px;overflow:hidden}
figure.bad{border-color:#ff4d6d}figure.warn{border-color:#ffb84d}img{display:block}
figcaption{padding:3px 5px;display:flex;flex-direction:column;gap:1px}.n{font-weight:700;color:#fff;word-break:break-all}.m{color:#a99bc4;font-size:11px}
.t b{display:inline-block;margin:1px 3px 0 0;padding:0 4px;border-radius:3px;font-size:10px}.t .e{background:#ff4d6d;color:#fff}.t .w{background:#ffb84d;color:#241a00}
</style></head><body><h1>${esc(title)}</h1>${sections.join("")}</body></html>`;
}

export async function runScenes(args = {}) {
  const T0 = Date.now();
  const deviceIds = String(args.devices && args.devices !== true ? args.devices : args.quick ? "i13" : "i13,desktop").split(",").map((s) => s.trim()).filter(Boolean);
  for (const d of deviceIds) if (!DEVICE_LIST[d]) throw new Error(`unknown device '${d}' (${Object.keys(DEVICE_LIST).join(", ")})`);
  // (resolve: an absolute --out, e.g. a scratch dir, stays where it was asked for instead of landing inside the repo)
  const out = resolve(ROOT, args.out && args.out !== true ? args.out : "shots/scenes/latest");
  const baseDir = join(ROOT, "shots/scenes/baseline");
  const jobsN = Math.max(1, Number(args.jobs ?? 4));
  const timeout = Number(args.timeout ?? 30000);
  const diffThreshold = Number(args["diff-threshold"] ?? CHECKS.diff.pct);
  const diffFail = Number(args["diff-fail"] ?? CHECKS.diff.failPct);
  const scale = args["full-res"] ? "device" : "css";
  // --blame [N]: per in-run shot, the N draw call sites nearest the hero are each dropped in turn and her readability
  // re-measured (washout attribution; ~N+9 extra renders per shot)
  const blame = args.blame ? (args.blame === true ? 12 : Math.max(1, Number(args.blame))) : 0;
  const extra = new URLSearchParams();
  if (!args.sound) extra.set("mute", "1");
  for (const k of ["seed", "hero", "profile"]) if (args[k] && args[k] !== true) extra.set(k, String(args[k]));
  if (args.param && args.param !== true) for (const kv of String(args.param).split(",")) { const [k, v = "1"] = kv.split("="); extra.set(k, v); }

  if (existsSync(out) && !args.keep) rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const srv = await startServer();
  const browser = await launchBrowser();
  const tBoot = Date.now() - T0;
  const shots = [];
  const noiseShots = [];
  const noiseFile = join(baseDir, "noise.json");
  const baseNoise = args.diff && existsSync(noiseFile) ? JSON.parse(readFileSync(noiseFile, "utf8")) : {};
  let names = [];
  try {
    names = await resolveNames(browser, srv.url, args);
    const queue = [];
    // device-major interleave: every worker's page cache warms on one device, then the next
    if (args["self-test"]) for (const dev of deviceIds) for (const fault of Object.keys(FAULTS)) queue.push({ name: names[0], device: dev, fault });
    else for (const dev of deviceIds) for (const name of names) queue.push({ name, device: dev });
    // --baseline loads every scene a second time: the two loads' diff is that scene's noise floor for --diff
    if (args.baseline && !args["self-test"]) for (const dev of deviceIds) for (const name of names) queue.push({ name, device: dev, repeat: true });
    let done = 0;
    const total = queue.length;
    // one Chromium per worker: pages of one browser share its single GPU process, and SwiftShader there
    // serialises them (4 pages in one browser were no faster than 1)
    const browsers = [browser];
    const worker = async (wi) => {
      const slots = new Map();
      const br = wi === 0 ? browser : await launchBrowser();
      if (wi > 0) browsers.push(br);
      try {
        for (let job = queue.shift(); job; job = queue.shift()) {
          let slot = slots.get(job.device);
          if (!slot) {
            const desc = DEVICE_LIST[job.device]();
            // CSS-pixel shots (the default) render at DPR 1: the same layout, a ninth of the SwiftShader work of a
            // DPR 3 phone canvas. --full-res keeps the device's real pixel ratio (DPR-specific bugs, crisp shots).
            if (scale === "css") desc.deviceScaleFactor = 1;
            const context = await br.newContext(desc);
            if (!args["no-seed-random"]) await context.addInitScript(SEED_RANDOM);
            const page = await context.newPage();
            const cdp = await context.newCDPSession(page);
            slot = { context, page, cdp, desc, logs: [] };
            page.on("pageerror", (e) => slot.logs.push(`[pageerror] ${e.message}`));
            page.on("console", (m) => {
              if (m.type() === "error" && !BENIGN.some((re) => re.test(m.text()))) slot.logs.push(`[console.error] ${m.text()}`);
            });
            slots.set(job.device, slot);
          }
          const { page } = slot;
          slot.logs.length = 0;
          const base = { name: job.fault ? `${job.name}+${job.fault}` : job.name, device: job.device, ms: {}, diffThreshold, ...(job.fault ? { fault: job.fault } : {}) };
          const t0 = Date.now();
          const film = [];
          /** Probe, capture, measure and compare one frame of the page (the scenario's, or a film frame after it). */
          const take = async (shot, key, lite) => {
            shot.key = key;
            shot.probe = await page.evaluate(PROBE, { lite, contrast: CHECKS.illegible.contrast, heroR: CHECKS.washout.radius, hero: !args["no-hero"] });
            const t1 = Date.now();
            // CDP capture straight from the compositor surface (Playwright's screenshot adds font / caret waits that cost
            // ~0.5-1 s per shot here); CSS scale = a clip scaled by 1 / devicePixelRatio
            const vp = slot.desc.viewport;
            const dpr = slot.desc.deviceScaleFactor ?? 1;
            const cap = await slot.cdp.send("Page.captureScreenshot", {
              format: "png",
              optimizeForSpeed: true,
              captureBeyondViewport: false,
              ...(scale === "css" && dpr !== 1 ? { clip: { x: 0, y: 0, width: vp.width, height: vp.height, scale: 1 / dpr } } : {}),
            });
            const buf = Buffer.from(cap.data, "base64");
            shot.ms.shot = Date.now() - t1;
            const file = join(out, job.device, `${fileName(shot.name)}${job.repeat ? ".noise" : ""}.png`);
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, buf);
            shot.file = relative(out, file);
            // the washout measurement, now that the frame is captured (+ --blame, --hero-dump)
            if (shot.probe.heroPending) {
              delete shot.probe.heroPending;
              const t2 = Date.now();
              const hres = await page.evaluate(HERO_FINISH, { blame, heroDump: !!args["hero-dump"] });
              shot.ms.hero = Date.now() - t2;
              if (hres?.dump) {
                // <name>.hero.png = what the check compared, x4: the hero-only replay | the frame | her mask
                const d = hres.dump;
                delete hres.dump;
                const K = 4;
                const bufs = { mask: Buffer.from(d.mask, "base64"), clean: Buffer.from(d.clean, "base64"), shot: Buffer.from(d.shot, "base64") };
                const img = new PNG({ width: d.w * K * 3 + 8, height: d.h * K });
                for (let y = 0; y < d.h * K; y++)
                  for (let x = 0; x < d.w * K * 3 + 8; x++) {
                    const panel = Math.floor(x / (d.w * K + 4));
                    const px = Math.floor((x - panel * (d.w * K + 4)) / K);
                    const o = (y * img.width + x) * 4;
                    img.data[o + 3] = 255;
                    if (px >= d.w) continue;
                    const k = (Math.floor(y / K) * d.w + px) * 4;
                    const src = panel === 0 ? bufs.clean : bufs.shot;
                    for (let ch = 0; ch < 3; ch++) img.data[o + ch] = panel === 2 && bufs.mask[k] !== 1 ? src[k + ch] * 0.25 : src[k + ch];
                  }
                const hf = join(out, job.device, `${fileName(shot.name)}.hero.png`);
                writeFileSync(hf, PNG.sync.write(img));
                shot.heroFile = relative(out, hf);
              }
              if (hres) shot.probe.hero = hres;
            }
            const png = PNG.sync.read(buf);
            shot.w = png.width;
            shot.h = png.height;
            shot.metrics = pixelMetrics(png);
            shot.png = buf;
            const bfile = join(baseDir, job.device, `${fileName(key)}.png`);
            if (job.repeat) {
              // --baseline's second pass: how much this scene differs from itself between two loads (its noise floor)
              shot.noise = existsSync(bfile) ? pixelDiff(png, PNG.sync.read(readFileSync(bfile))).pct : null;
            } else if (args.baseline) {
              mkdirSync(dirname(bfile), { recursive: true });
              writeFileSync(bfile, buf);
            } else if (args.diff) {
              if (existsSync(bfile)) {
                const d = pixelDiff(png, PNG.sync.read(readFileSync(bfile)));
                const noise = baseNoise[`${job.device}/${key}`] ?? 0;
                // flag above max(threshold, 1.5 x the scene's own load-to-load noise + threshold)
                shot.diffThreshold = +Math.max(diffThreshold, noise * 1.5 + diffThreshold).toFixed(2);
                shot.diffFail = +(diffFail + noise * 1.5).toFixed(2);
                shot.diff = { pct: d.pct, size: d.size, noise };
                if (d.png && d.pct > 0) {
                  const df = join(out, job.device, `${fileName(key)}.diff.png`);
                  writeFileSync(df, PNG.sync.write(d.png));
                  shot.diff.file = relative(out, df);
                }
              } else shot.diff = { pct: 0, missing: true };
            }
          };
          const spec = parseSpec(job.name, args.film);
          try {
            const q = new URLSearchParams(extra);
            q.set("scenario", spec.scenario);
            q.set("step", "1");
            await page.goto(`${srv.url}/?${q}`, { waitUntil: "load", timeout });
            base.ms.load = Date.now() - t0;
            await page.waitForFunction(() => ["ready", "error"].includes(document.documentElement.dataset.kkScenario ?? ""), null, { timeout, polling: 50 });
            base.ms.ready = Date.now() - t0;
            if (job.fault && job.fault !== "none") await page.evaluate(INJECT, job.fault);
            await take(base, spec.scenario, false);
            base.errors = [...slot.logs];
            // a FILM (`name~frames/every` or --film): step on from the scenario's moment and check every `every` frames,
            // so a transient full-screen effect (an ult's shadow pass, a flash) cannot slip between two scenario moments
            if (spec.film && base.probe?.scenario?.status === "ready") {
              for (let f = spec.film.every; f <= spec.film.frames; f += spec.film.every) {
                const fr = { name: `${job.name} +${f}f`, device: job.device, ms: {}, diffThreshold, filmOf: job.name, frame: f };
                const tf = Date.now();
                slot.logs.length = 0;
                try {
                  await page.evaluate((n) => window.__kk.step(n), spec.film.every);
                  fr.ms.ready = Date.now() - tf;
                  await take(fr, `${spec.scenario}+${f}f`, true);
                } catch (e) {
                  fr.harnessError = String(e?.message ?? e).split("\n")[0].slice(0, 240);
                }
                fr.errors = [...slot.logs];
                fr.ms.total = Date.now() - tf;
                fr.flags = flagsFor(spec.scenario, fr);
                film.push(fr);
              }
            }
          } catch (e) {
            base.harnessError = String(e?.message ?? e).split("\n")[0].slice(0, 240);
            base.ms.ready ??= Date.now() - t0;
          }
          base.errors ??= [...slot.logs];
          base.ms.total = Date.now() - t0;
          base.flags = flagsFor(spec.scenario, base);
          if (film.length) base.film = film.length;
          for (const shot of [base, ...film]) {
            if (job.repeat) noiseShots.push(shot);
            else shots.push(shot);
          }
          done++;
          if (!args.json && !args.quiet && process.stdout.isTTY) {
            const bad = [...new Set([base, ...film].flatMap((x) => x.flags.filter((f) => f.level === "error").map((f) => f.kind)))];
            process.stdout.write(`\r  ${done}/${total} ${job.device} ${job.name}${bad.length ? ` !! ${bad.join(",")}` : ""}`.padEnd(70).slice(0, 100) + (bad.length ? "\n" : ""));
          }
        }
      } finally {
        for (const s of slots.values()) await s.context.close().catch(() => {});
      }
    };
    await Promise.all(Array.from({ length: Math.min(jobsN, queue.length) }, (_, i) => worker(i)));
    for (const b of browsers.slice(1)) await b.close().catch(() => {});
    if (!args.json && !args.quiet && process.stdout.isTTY) process.stdout.write("\r".padEnd(100) + "\r");

    // order like the request, then the contact sheet (rendered by the same browser) + gallery + summary
    const faultIx = (x) => Object.keys(FAULTS).indexOf(x.fault ?? "none");
    const nameIx = (x) => names.indexOf(x.filmOf ?? x.name);
    shots.sort((a, b) => deviceIds.indexOf(a.device) - deviceIds.indexOf(b.device) || nameIx(a) - nameIx(b) || (a.frame ?? 0) - (b.frame ?? 0) || faultIx(a) - faultIx(b));
    const title = `scenes ${new Date().toISOString().slice(0, 16).replace("T", " ")} | ${shots.length} shots | ${deviceIds.join(", ")}`;
    const tc = Date.now();
    const thumbs = shots.filter((s) => s.png);
    // the gallery page references the PNGs next to it; the contact sheet is that page, screenshotted from file://
    writeFileSync(join(out, "index.html"), sheetHtml(thumbs, deviceIds, title, (s) => s.file));
    // (sized to the whole sheet instead of fullPage: a fullPage capture of a tall page failed once under load;
    // a failed sheet is reported, never fatal: the shots and summary.json are what matter)
    let contactError = null;
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    try {
      const sp = await ctx.newPage();
      await sp.goto(`file://${join(out, "index.html")}`, { waitUntil: "load" });
      const h = await sp.evaluate(() => document.documentElement.scrollHeight);
      await sp.setViewportSize({ width: 1400, height: Math.min(Math.max(h, 200), 16000) });
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await sp.screenshot({ path: join(out, "contact.png"), timeout: 30000 });
          contactError = null;
          break;
        } catch (e) {
          contactError = String(e?.message ?? e).split("\n")[0];
          await sp.waitForTimeout(300);
        }
      }
    } finally {
      await ctx.close().catch(() => {});
    }
    if (args.baseline && noiseShots.length) {
      // (merged: a partial --baseline --only ... keeps the other scenes' noise floors)
      const noise = existsSync(noiseFile) ? JSON.parse(readFileSync(noiseFile, "utf8")) : {};
      for (const n of noiseShots) if (n.noise != null) noise[`${n.device}/${n.key ?? n.name}`] = n.noise;
      writeFileSync(noiseFile, JSON.stringify(noise, null, 1));
    }
    let selfTest = null;
    if (args["self-test"]) {
      selfTest = shots.map((x) => {
        const want = FAULTS[x.fault]?.expect;
        const errs = x.flags.filter((f) => f.level === "error" || f.kind === want).map((f) => f.kind);
        const ok = want ? errs.includes(want) : errs.length === 0;
        return { device: x.device, fault: x.fault, expect: want ?? "clean", got: errs, ok };
      });
      // the --diff path: a clean shot against its own blackout must be an error-size diff, against itself 0
      for (const dev of deviceIds) {
        const clean = shots.find((x) => x.device === dev && x.fault === "none");
        const dark = shots.find((x) => x.device === dev && x.fault === "blackout");
        if (!clean?.png || !dark?.png) continue;
        const a = PNG.sync.read(clean.png);
        const vsDark = pixelDiff(a, PNG.sync.read(dark.png)).pct;
        const vsSelf = pixelDiff(a, PNG.sync.read(clean.png)).pct;
        selfTest.push({ device: dev, fault: "diff", expect: `> ${CHECKS.diff.failPct}% vs blackout, 0% vs itself`, got: [`${vsDark}%`, `${vsSelf}%`], ok: vsDark > CHECKS.diff.failPct && vsSelf === 0 });
      }
    }
    const contactMs = Date.now() - tc;
    for (const s of [...shots, ...noiseShots]) delete s.png;
    const errors = selfTest ? selfTest.filter((t) => !t.ok) : shots.filter((s) => s.flags.some((f) => f.level === "error"));
    const warnings = shots.filter((s) => s.flags.some((f) => f.level !== "error"));
    const summary = {
      ok: errors.length === 0,
      ms: Date.now() - T0,
      bootMs: tBoot,
      contactMs,
      out: relative(ROOT, out),
      contact: contactError ? `(contact sheet failed: ${contactError}; open the gallery)` : relative(ROOT, join(out, "contact.png")),
      gallery: relative(ROOT, join(out, "index.html")),
      devices: deviceIds,
      jobs: Math.min(jobsN, total),
      count: shots.length,
      flagged: { errors: errors.length, warnings: warnings.length },
      mode: args["self-test"] ? "self-test" : args.baseline ? "baseline" : args.diff ? "diff" : "check",
      ...(selfTest ? { selfTest } : {}),
      ...(noiseShots.length ? { noise: Object.fromEntries(noiseShots.map((n) => [`${n.device}/${n.name}`, n.noise])) } : {}),
      shots,
    };
    writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 1));
    return summary;
  } finally {
    await browser.close().catch(() => {});
    await srv.close().catch(() => {});
  }
}

function printSummary(s) {
  const pad = (v, n) => String(v).padStart(n);
  console.log(`${"device".padEnd(8)}${"scene".padEnd(30)}${pad("ready", 7)}${pad("shot", 6)}${pad("lum", 5)}${pad("blk%", 6)}${pad("dark%", 6)}${pad("wht%", 6)}${pad("hero%", 6)}${pad("wash%", 6)}${s.mode === "diff" ? pad("diff%", 7) : ""}  flags`);
  for (const x of s.shots) {
    const fl = x.flags.map((f) => (f.level === "error" ? `!${f.kind}` : f.kind)).join(" ");
    const m = x.metrics ?? {};
    console.log(`${x.device.padEnd(8)}${x.name.padEnd(30).slice(0, 30)}${pad(((x.ms.ready ?? 0) / 1000).toFixed(1), 7)}${pad(((x.ms.shot ?? 0) / 1000).toFixed(1), 6)}${pad(m.meanLum != null ? Math.round(m.meanLum) : "-", 5)}${pad(m.nearBlack ?? "-", 6)}${pad(m.dark ?? "-", 6)}${pad(m.nearWhite ?? "-", 6)}${pad(x.probe?.hero?.keep ?? "-", 6)}${pad(x.probe?.hero?.wash ?? "-", 6)}${s.mode === "diff" ? pad(x.diff ? (x.diff.missing ? "new" : x.diff.pct) : "-", 7) : ""}  ${fl}`);
  }
  const bad = s.shots.flatMap((x) => x.flags.filter((f) => f.level === "error").map((f) => `  ${x.device} ${x.name}: ${f.msg}`));
  const warn = s.shots.flatMap((x) => x.flags.filter((f) => f.level !== "error").map((f) => `  ${x.device} ${x.name}: ${f.msg}`));
  // --blame: per shot, the draw sites that wash the hero out (alone = her keep with only it over the ground, minus
  // ground + her alone; drop = what dropping it gains), then whole-class variants
  for (const x of s.shots) {
    const b = x.probe?.hero?.blame;
    if (!b) continue;
    console.log(`\nblame ${x.device} ${x.name}: hero keep ${b.base.keep}% (ground + her alone ${b.bare?.keep}%), ${b.sitesNear} draw sites near her${b.tagged ? "" : " (particle emitters are named from the 2nd blamed shot on: film it)"}`);
    console.log(`  ${"alone".padStart(6)} ${"drop".padStart(6)}  site`);
    for (const r of b.sites) console.log(`  ${pad(r.alone ?? "-", 6)} ${pad(r.dKeep ?? "-", 6)}  ${r.site}  (${r.draws} draws, ${r.glow} glow, ${r.add} add, layers ${r.layers})`);
    console.log(`  variants (keep gained): ${Object.entries(b.variants).map(([k, v]) => `${k} ${v.dKeep}`).join(" | ")}`);
  }
  if (warn.length) console.log(`\nwarnings:\n${warn.join("\n")}`);
  if (bad.length) console.log(`\nERRORS:\n${bad.join("\n")}`);
  if (s.selfTest) {
    console.log("\nself-test (each fault injected into one scene must be flagged):");
    for (const t of s.selfTest) console.log(`  ${t.ok ? "ok  " : "FAIL"} ${t.device.padEnd(8)} ${t.fault.padEnd(12)} expect ${String(t.expect).padEnd(12)} got ${t.got.join(",") || "-"}`);
  }
  if (s.noise) console.log(`\nbaseline noise floor (load-to-load diff %): ${Object.entries(s.noise).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(", ") || "all 0"}`);
  console.log(`\nscenes ${s.ok ? "ok" : "FAIL"}: ${s.count} shots (${s.devices.join(", ")}, ${s.jobs} pages) in ${(s.ms / 1000).toFixed(1)} s (boot ${(s.bootMs / 1000).toFixed(1)} s, contact sheet ${(s.contactMs / 1000).toFixed(1)} s) | ${s.flagged.errors} flagged, ${s.flagged.warnings} with warnings${s.mode !== "check" ? ` | ${s.mode}` : ""}`);
  console.log(`contact sheet: ${s.contact}\ngallery:       ${s.gallery}\nsummary:       ${s.out}/summary.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs();
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
    process.exit(0);
  }
  const s = await runScenes(args);
  if (args.json) console.log(JSON.stringify(s, null, 1));
  else printSummary(s);
  process.exit(s.ok || args["no-fail"] ? 0 : 1);
}
