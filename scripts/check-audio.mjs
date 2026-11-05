// Audio checks (docs/DEVTOOLS.md §6.3, ~15-20 s): renders the game's real synthesis offline (tools/audio.html,
// window.__audioRender, the same Engine the game plays) and fails when a mix gets too expensive for a phone,
// clips or produces NaN, or the phone profile stops being structurally cheaper; and boots the real game as an
// iPhone, an Android phone and a desktop (the profile each gets, Android focus-loss recovery).
//
//   node scripts/check-audio.mjs [--json] [--seconds 6] [--repeat 2]
//
//   node scripts/check-audio.mjs --part device       only the live-device part (profile choice + focus recovery)
//
// Two parts:
//  cost    the offline renders below, against minimum speeds
//  device  the real game booted as an iPhone, an Android phone and a desktop (~4 s, in parallel): the AudioContext
//          each one creates must use its profile (phones: 24 kHz + latencyHint 'playback'; desktop: full rate +
//          'interactive'). Then, on the Android phone, the three ways Season 2 lost its sound for good (commit 2a8c805):
//          a window blur whose focus event never comes, a hide whose 'visible' event is lost (then a tap), and a
//          system suspend (audio focus) with no tap at all. The context must be running again within 1.5 s of each.
//
// Cost = seconds of audio rendered per second of wall time ("x real time"; a render that misses its budget is
// retried, best of --repeat). The
// phone ("lite": 24 kHz, one short reverb, 12 voices) and desktop ("full": 44.1 kHz) profiles each render
//   battle   the base combat chaos (12 sfx ids, 300 sfx/s) over the battle theme at full intensity
//   heavy    the Season 2 chaos (16 ids + lightsticks on the beat, honks, transforms, NANI?!) over the finale theme
// Measured on this 4-core container when the lite profile shipped (commit 32ccada): lite heavy 3.6x, lite battle
// 9.1x, full heavy 1.5x, full battle 2.9x. Floors sit ~30 % under those so CPU noise from parallel checks does
// not trip them; a real regression (a second convolver, a voice-cap leak) does. Below 1x a core cannot keep up.
import { fileURLToPath } from "node:url";
import { loadavg } from "node:os";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { parseArgs, startServer, launchBrowser, newPage } from "./lib.mjs";

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    return require(`${execSync("npm root -g").toString().trim()}/playwright`);
  }
}
const { devices } = loadPlaywright();

export const BUDGET = [
  { id: "lite.heavy", lite: true, sr: 24000, heavy: true, min: 2.5 },
  { id: "lite.battle", lite: true, sr: 24000, heavy: false, min: 6.0 },
  { id: "full.heavy", lite: false, sr: 44100, heavy: true, min: 1.05 },
  { id: "full.battle", lite: false, sr: 44100, heavy: false, min: 2.0 },
];

/**
 * Structural budget of the phone profile vs the desktop one, on the heavy mix: voice sources started (oscillators,
 * buffer sources; the music's notes are the same in both) and seconds of convolution impulse. Today: 77 % of the
 * voices and 24 % of the impulse; a lite profile that lost its savings is at 100 % of both.
 */
export const SHAPE = { voices: 0.88, reverb: 0.5 };

/** tools/audio.html, before its scripts: count the nodes every OfflineAudioContext creates (and the impulse lengths). */
const COUNT_NODES = () => {
  const c = { sources: 0, nodes: 0, convSec: 0, convolvers: 0 };
  const P = BaseAudioContext.prototype;
  for (const k of Object.getOwnPropertyNames(P)) {
    if (!k.startsWith("create") || typeof P[k] !== "function") continue;
    const f = P[k];
    P[k] = function (...a) {
      if (this instanceof OfflineAudioContext) {
        c.nodes++;
        if (k === "createOscillator" || k === "createBufferSource") c.sources++;
      }
      return f.apply(this, a);
    };
  }
  const d = Object.getOwnPropertyDescriptor(ConvolverNode.prototype, "buffer");
  Object.defineProperty(ConvolverNode.prototype, "buffer", {
    ...d,
    set(v) {
      if (v && this.context instanceof OfflineAudioContext) {
        c.convSec += v.duration * v.numberOfChannels;
        c.convolvers++;
      }
      d.set.call(this, v);
    },
  });
  window.__nodes = { reset: () => Object.assign(c, { sources: 0, nodes: 0, convSec: 0, convolvers: 0 }), read: () => ({ ...c }) };
};

/** The devices of the live part: what each must get, and whether the focus-loss cases run on it. */
export const DEVICES = {
  iphone: { desc: () => ({ ...devices["iPhone 13"] }), lite: true },
  android: { desc: () => ({ ...devices["Pixel 5"] }), lite: true, focus: true },
  desktop: { desc: () => ({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), lite: false },
};
/** Seconds a lost context gets to come back on its own (the game retries a system suspend after 300 ms). */
const RECOVER_S = 1.5;

/** Before any game script: keep every AudioContext the page makes, with the options it was created with. */
const CAPTURE = () => {
  const Orig = window.AudioContext ?? window.webkitAudioContext;
  if (!Orig) return;
  window.__ctxs = [];
  const Spy = class extends Orig {
    constructor(o) {
      super(o);
      window.__ctxs.push({ ctx: this, opts: o ? { sampleRate: o.sampleRate ?? null, latencyHint: o.latencyHint ?? null } : {} });
    }
  };
  window.AudioContext = Spy;
  if (window.webkitAudioContext) window.webkitAudioContext = Spy;
};

/** One device: boot to the splash (step mode: no frames, no CPU), tap, check the profile; on Android, lose focus 3 ways. */
async function deviceCase(browser, url, id) {
  const d = DEVICES[id];
  const t0 = Date.now();
  const ctx = await browser.newContext(d.desc());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(CAPTURE);
  const out = { id, ok: true, issues: [], profile: null, focus: [], ms: 0 };
  const fail = (m) => {
    out.ok = false;
    out.issues.push(m);
  };
  try {
    await page.goto(`${url}/?step=1`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__kk && window.__kk.app && !document.getElementById("boot"), null, { timeout: 30000 });
    const vp = page.viewportSize();
    const tap = async () => {
      if (d.desc().hasTouch) await page.touchscreen.tap(vp.width / 2, vp.height * 0.6);
      else await page.mouse.click(vp.width / 2, vp.height * 0.6);
    };
    const state = () => page.evaluate(() => window.__ctxs?.[window.__ctxs.length - 1]?.ctx.state ?? "none");
    /** ms until the context is running again (null = still not running after RECOVER_S). */
    const until = async () => {
      const t = Date.now();
      try {
        await page.waitForFunction(() => window.__ctxs?.[window.__ctxs.length - 1]?.ctx.state === "running", null, { timeout: RECOVER_S * 1000, polling: 25 });
        return Date.now() - t;
      } catch {
        return null;
      }
    };
    await tap();
    const unlockMs = await until();
    const info = await page.evaluate(() => {
      const c = window.__ctxs ?? [];
      const last = c[c.length - 1];
      return { contexts: c.length, opts: last?.opts ?? null, sampleRate: last?.ctx.sampleRate ?? 0, state: last?.ctx.state ?? "none" };
    });
    out.profile = { ...info, unlockMs };
    if (!info.contexts) fail("no AudioContext after the first tap");
    else if (unlockMs == null) fail(`the AudioContext is ${info.state} after the first tap`);
    if (info.contexts) {
      const lite = info.sampleRate <= 24000 && info.opts?.latencyHint === "playback";
      if (d.lite && !lite) fail(`phone got the full audio profile (${info.sampleRate} Hz, latencyHint ${info.opts?.latencyHint ?? "default"}); phones need the lite one (24 kHz, 'playback'): the full mix crackles there`);
      if (!d.lite && lite) fail(`desktop got the phone profile (${info.sampleRate} Hz)`);
    }
    if (d.focus && unlockMs != null) {
      const setVis = (v, fire) =>
        page.evaluate(
          ([v, fire]) => {
            Object.defineProperty(document, "visibilityState", { value: v, configurable: true });
            Object.defineProperty(document, "hidden", { value: v === "hidden", configurable: true });
            if (fire) document.dispatchEvent(new Event("visibilitychange"));
          },
          [v, fire],
        );
      // 1. a window blur (a notification shade, the host app's own UI) whose focus event never arrives, then a tap
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.waitForTimeout(150);
      await tap();
      let ms = await until();
      out.focus.push({ case: "blur, focus never returns, tap", ms, state: ms == null ? await state() : "running" });
      // 2. a real hide whose 'visible' event is lost, then a tap on the (visible) page
      await setVis("hidden", true);
      await page.waitForTimeout(150);
      await setVis("visible", false);
      await tap();
      ms = await until();
      out.focus.push({ case: "hidden, 'visible' event lost, tap", ms, state: ms == null ? await state() : "running" });
      // 3. the system takes the audio (Android audio focus, an output switch): no tap at all
      await page.evaluate(() => window.__ctxs[window.__ctxs.length - 1].ctx.suspend());
      await page.waitForTimeout(50);
      ms = await until();
      out.focus.push({ case: "system suspend, no tap", ms, state: ms == null ? await state() : "running" });
      for (const f of out.focus) if (f.ms == null) fail(`audio stays ${f.state} after: ${f.case} (must resume within ${RECOVER_S} s)`);
    }
    for (const e of errors) fail(`page error: ${e.slice(0, 160)}`);
  } catch (e) {
    fail(`harness: ${String(e?.message ?? e).split("\n")[0]}`);
  } finally {
    await ctx.close().catch(() => {});
  }
  out.ms = Date.now() - t0;
  return out;
}

export async function checkAudio(args = {}) {
  const T0 = Date.now();
  const seconds = Number(args.seconds ?? 6);
  const repeat = Math.max(1, Number(args.repeat ?? 2));
  const parts = String(args.part && args.part !== true ? args.part : "cost,device").split(",");
  const srv = await startServer();
  const browser = await launchBrowser();
  const rows = [];
  const device = [];
  const shape = {};
  const problems = [];
  try {
    if (parts.includes("device")) {
      // (before the renders: the renders measure CPU speed, and these pages would compete with them)
      const t = Date.now();
      device.push(...(await Promise.all(Object.keys(DEVICES).map((id) => deviceCase(browser, srv.url, id)))));
      for (const d of device) for (const i of d.issues) problems.push(`${d.id}: ${i}`);
      device.ms = Date.now() - t;
    }
    if (!parts.includes("cost")) return { ok: problems.length === 0, ms: Date.now() - T0, seconds, repeat, load: +loadavg()[0].toFixed(2), rows, device, deviceMs: device.ms ?? 0, shape, problems };
    const page = await newPage(browser, { w: 900, h: 600 });
    await page.addInitScript(COUNT_NODES);
    await page.goto(`${srv.url}/tools/audio.html`, { waitUntil: "load" });
    await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
    for (const b of BUDGET) {
      const o = b.heavy ? { track: "finale", s2: true, lite: b.lite } : { lite: b.lite };
      const r = await page.evaluate(
        async ({ o, sr, seconds, repeat, heavy, min }) => {
          const ar = window.__audioRender;
          if (heavy) o.ids = ar.chaosS2;
          // best of up to `repeat` renders: a second one only when the first misses the budget (CPU noise)
          let best = Infinity;
          for (let i = 0; i < repeat && seconds / (best / 1000) < min; i++) best = Math.min(best, await ar.chaosCost(seconds, o, sr));
          // the signal checks (clipping / NaN / DC) on the heavy mixes, the loudest ones (stats only; the WAV stays in the page),
          // with the audio graph it builds counted (deterministic: the shape check below)
          window.__nodes.reset();
          const s = heavy ? (await ar.chaos(seconds, o, sr)).stats : null;
          const g = window.__nodes.read();
          return { ms: best, graph: heavy ? g : null, stats: s && { peak: s.peak, peakDb: s.peakDb, rmsDb: s.rmsDb, clipped: s.clipped, nan: s.nan, dc: s.dc } };
        },
        { o, sr: b.sr, seconds, repeat, heavy: b.heavy, min: b.min },
      );
      const ratio = +(seconds / (r.ms / 1000)).toFixed(2);
      const issues = [];
      if (ratio < b.min) issues.push(`renders at ${ratio}x real time, budget >= ${b.min}x`);
      if (r.stats) {
        if (r.stats.nan) issues.push(`${r.stats.nan} NaN samples`);
        if (r.stats.clipped) issues.push(`${r.stats.clipped} clipped samples`);
        if (r.stats.peak < 0.05) issues.push("silent");
        if (Math.abs(r.stats.dc) > 0.004) issues.push(`DC offset ${r.stats.dc.toFixed(4)}`);
      }
      rows.push({ ...b, ratio, renderMs: Math.round(r.ms), graph: r.graph, ...r.stats, ok: !issues.length, issues });
      for (const i of issues) problems.push(`${b.id}: ${i}`);
    }
    // SHAPE: the phone profile must stay structurally cheaper than the desktop one on the same heavy mix. Node and
    // impulse counts are deterministic, so this holds on any machine, under any load (the speed floors above are noisy:
    // a lite profile that lost its savings still rendered at 2.9-3.5x here, above its 2.5x floor).
    const L = rows.find((x) => x.id === "lite.heavy")?.graph;
    const F = rows.find((x) => x.id === "full.heavy")?.graph;
    if (L && F) {
      shape.voices = { lite: L.sources, full: F.sources, max: SHAPE.voices };
      shape.reverb = { lite: +L.convSec.toFixed(2), full: +F.convSec.toFixed(2), max: SHAPE.reverb };
      if (L.sources > F.sources * SHAPE.voices) problems.push(`lite profile: ${L.sources} voice sources on the heavy mix vs ${F.sources} on desktop (must be <= ${SHAPE.voices * 100} %): its voice cap / budget is gone`);
      if (L.convSec > F.convSec * SHAPE.reverb) problems.push(`lite profile: ${L.convSec.toFixed(2)} s of convolution impulse vs ${F.convSec.toFixed(2)} s on desktop (must be <= ${SHAPE.reverb * 100} %): a long reverb is back on phones`);
    }
    const errs = page.__logs.filter((l) => l.startsWith("[pageerror]"));
    for (const e of errs) problems.push(e.slice(0, 200));
  } finally {
    await browser.close().catch(() => {});
    await srv.close().catch(() => {});
  }
  return { ok: problems.length === 0, ms: Date.now() - T0, seconds, repeat, load: +loadavg()[0].toFixed(2), rows, device, deviceMs: device.ms ?? 0, shape, problems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs();
  const r = await checkAudio(args);
  if (args.json) console.log(JSON.stringify(r, null, 1));
  else {
    for (const d of r.device) {
      const p = d.profile;
      console.log(`${d.ok ? "ok  " : "FAIL"} device.${d.id.padEnd(8)} ${p ? `${p.sampleRate} Hz, latencyHint ${p.opts?.latencyHint ?? "default"}, unlock ${p.unlockMs ?? "-"} ms` : "-"}${d.focus.length ? ` | focus: ${d.focus.map((f) => (f.ms == null ? `${f.case} STAYS ${f.state}` : `${f.ms} ms`)).join(", ")}` : ""}${d.issues.length ? "  <-- " + d.issues.join("; ") : ""}`);
    }
    for (const x of r.rows)
      console.log(`${x.ok ? "ok  " : "FAIL"} ${x.id.padEnd(12)} ${String(x.ratio).padStart(6)}x real time (budget >= ${x.min}x, ${x.renderMs} ms for ${r.seconds} s @ ${x.sr / 1000} kHz)${x.peakDb != null ? `  peak ${x.peakDb.toFixed(1)} dB  rms ${x.rmsDb.toFixed(1)} dB  clip ${x.clipped}  nan ${x.nan}` : ""}${x.issues.length ? "  <-- " + x.issues.join(", ") : ""}`);
    if (r.shape.voices) console.log(`${r.problems.some((p) => p.startsWith("lite profile")) ? "FAIL" : "ok  "} lite.shape   voices ${r.shape.voices.lite} vs ${r.shape.voices.full} (${Math.round((r.shape.voices.lite / r.shape.voices.full) * 100)} %, max ${r.shape.voices.max * 100} %), reverb ${r.shape.reverb.lite} vs ${r.shape.reverb.full} s (${Math.round((r.shape.reverb.lite / Math.max(1e-9, r.shape.reverb.full)) * 100)} %, max ${r.shape.reverb.max * 100} %)`);
    if (r.problems.length) console.log(`\nproblems:\n  ${r.problems.join("\n  ")}${r.load > 3 ? `\n(load average ${r.load}: other work was running; rerun alone with npm run check:audio before trusting a cost failure)` : ""}`);
    console.log(`check:audio ${r.ok ? "ok" : "FAIL"} in ${(r.ms / 1000).toFixed(1)} s (load ${r.load})`);
  }
  process.exit(r.ok ? 0 : 1);
}
