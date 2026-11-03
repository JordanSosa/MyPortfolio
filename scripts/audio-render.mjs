// Offline audio renders + analysis through the game's real synthesis code.
//
//   node scripts/audio-render.mjs                 # everything: sfx, tracks (20 s), spam, chaos, harmony report
//   node scripts/audio-render.mjs --sfx [--filter gem,hit]
//   node scripts/audio-render.mjs --tracks [--filter battle] [--seconds 20 | --seconds full]
//   node scripts/audio-render.mjs --analyze       # music theory sanity report only (no audio)
//   node scripts/audio-render.mjs --spectro       # also write spectrogram PNGs (python3 + numpy + PIL)
//   node scripts/audio-render.mjs --live          # realtime smoke test: unlock by click, live music + sfx, analyser levels
//   node scripts/audio-render.mjs --layers        # intensity layers: every layered track at intensity 0 vs 1 (level + band deltas)
//   node scripts/audio-render.mjs --degrade       # cancel's budget cuts: 64 s with degrade 0 / .34 / .67 / 1, per-segment spectra
//   node scripts/audio-render.mjs --mix [--filter candy]  # per-channel solo levels (10 s, intensity 1) vs the full mix
//   node scripts/audio-render.mjs --scenes        # scripted Season 2 moments (MYTHIC pull, 10-pull, death stinger, lost 50/50)
//   node scripts/audio-render.mjs --chaos         # headroom: base chaos over battle + Season 2 chaos over every stage theme
//
// Renders run inside headless Chromium (OfflineAudioContext) on tools/audio.html,
// WAVs go to shots/audio/, per-file stats are printed (duration, peak, RMS, DC,
// clipping, NaN, onset/tail level). Exit code 1 if any file is silent, clips, has
// NaNs, a DC offset or an onset click.
import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseArgs, startServer, launchBrowser, newPage } from "./lib.mjs";

const SPECTRO_PY = String.raw`
import sys, json, wave
import numpy as np
from PIL import Image, ImageDraw

out_dir = sys.argv[1]
files = json.loads(sys.argv[2])

STOPS = [(0, 0, 4), (28, 16, 68), (79, 18, 123), (129, 37, 129), (181, 54, 122), (229, 80, 100), (251, 135, 97), (254, 194, 135), (252, 253, 191)]
def lut():
    xs = np.linspace(0, 1, len(STOPS))
    t = np.linspace(0, 1, 256)
    return np.stack([np.interp(t, xs, [c[i] for c in STOPS]) for i in range(3)], axis=1).astype(np.uint8)
LUT = lut()

def load(path):
    with wave.open(path) as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        d = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    return d.reshape(-1, ch).mean(axis=1), sr

def spectro(x, sr, width, height, fmin=40.0, fmax=16000.0, nfft=2048, rel=False):
    hop = max(16, len(x) // width)
    win = np.hanning(nfft).astype(np.float32)
    pad = np.concatenate([np.zeros(nfft // 2, np.float32), x, np.zeros(nfft, np.float32)])
    frames = max(1, 1 + (len(pad) - nfft) // hop)
    idx = np.arange(nfft)[None, :] + hop * np.arange(frames)[:, None]
    S = np.abs(np.fft.rfft(pad[idx] * win, axis=1)) / (win.sum() / 2)
    db = 20 * np.log10(S + 1e-9)
    freqs = np.fft.rfftfreq(nfft, 1.0 / sr)
    rows = np.geomspace(fmin, fmax, height)[::-1]
    bins = np.clip(np.searchsorted(freqs, rows), 0, len(freqs) - 1)
    img = db[:, bins].T
    top = float(img.max()) if rel else 0.0
    v = np.clip((img - top + 95) / 95, 0, 1)
    rgb = LUT[(v * 255).astype(np.uint8)]
    im = Image.fromarray(rgb, "RGB").resize((width, height), Image.BILINEAR)
    return im

def envelope(x, width, height, color=(126, 232, 255)):
    im = Image.new("RGB", (width, height), (20, 12, 32))
    d = ImageDraw.Draw(im)
    n = len(x)
    for c in range(width):
        a, b = int(c * n / width), int((c + 1) * n / width)
        seg = x[a:max(b, a + 1)]
        if len(seg) == 0:
            continue
        pk = float(np.max(np.abs(seg)))
        rms = float(np.sqrt(np.mean(seg * seg)))
        h2 = height / 2
        d.line([(c, h2 - pk * h2), (c, h2 + pk * h2)], fill=(90, 60, 140))
        d.line([(c, h2 - rms * h2), (c, h2 + rms * h2)], fill=color)
        if pk >= 0.999:
            d.point((c, 0), fill=(255, 60, 60))
    return im

def freq_grid(im, x0, y0, height, fmin=40.0, fmax=16000.0):
    d = ImageDraw.Draw(im)
    for f in (100, 250, 500, 1000, 2000, 4000, 8000):
        y = y0 + int((1 - np.log(f / fmin) / np.log(fmax / fmin)) * height)
        d.line([(x0, y), (x0 + 6, y)], fill=(255, 255, 255))
        d.text((x0 + 8, y - 6), f"{f // 1000}k" if f >= 1000 else str(f), fill=(220, 220, 220))

# ---- sfx contact sheet
sfx = files.get("sfx", [])
if sfx:
    TW, SH, EH, LH, COLS = 300, 120, 26, 14, 5
    rows = (len(sfx) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * TW, rows * (SH + EH + LH)), (36, 24, 56))
    for i, path in enumerate(sfx):
        x, sr = load(path)
        dur = len(x) / sr
        # adaptive time scale (0.35 .. 3 s per tile), colours relative to the file's own peak
        span = int(min(3.0, max(0.35, dur)) * sr)
        xx = np.zeros(span, np.float32)
        xx[: min(span, len(x))] = x[:span]
        sp = spectro(xx, sr, TW - 2, SH, nfft=512 if dur < 0.5 else 1024, rel=True)
        ev = envelope(xx, TW - 2, EH)
        cx, cy = (i % COLS) * TW, (i // COLS) * (SH + EH + LH)
        d = ImageDraw.Draw(sheet)
        name = path.rsplit("/", 1)[-1].replace("sfx_", "").replace(".wav", "")
        d.text((cx + 3, cy + 1), f"{name}  {dur:.2f}s (tile {span/sr:.2f}s)  pk {20*np.log10(max(1e-9, float(np.max(np.abs(x))))):.1f}dB", fill=(255, 226, 122))
        sheet.paste(sp, (cx + 1, cy + LH))
        sheet.paste(ev, (cx + 1, cy + LH + SH))
        freq_grid(sheet, cx + 1, cy + LH, SH)
    sheet.save(f"{out_dir}sfx_sheet.png")
    print(f"spectrogram sheet: {out_dir}sfx_sheet.png")

# ---- spectral balance (share of energy per band) - a phone speaker reproduces little below ~250 Hz
BANDS = [(20, 60), (60, 150), (150, 400), (400, 1000), (1000, 2500), (2500, 6000), (6000, 16000)]
if files.get("tracks"):
    print("spectral balance (dB share of total energy) + 'phone' loudness (RMS above 250 Hz):")
    print("file".ljust(22) + "".join(f"{a}-{b}".rjust(11) for a, b in BANDS) + "   phoneRMS")
    for path in files["tracks"]:
        x, sr = load(path)
        X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
        f = np.fft.rfftfreq(len(x), 1 / sr)
        tot = X.sum() + 1e-20
        row = [10 * np.log10(X[(f >= a) & (f < b)].sum() / tot + 1e-12) for a, b in BANDS]
        phone = 10 * np.log10(X[f >= 250].sum() / tot + 1e-12) + 20 * np.log10(max(1e-9, float(np.sqrt(np.mean(x * x)))))
        name = path.rsplit("/", 1)[-1].replace(".wav", "")
        print(name.ljust(22) + "".join(f"{v:11.1f}" for v in row) + f"   {phone:7.1f}")

# ---- tracks
for path in files.get("tracks", []):
    x, sr = load(path)
    W, SH, EH = 1500, 380, 90
    im = Image.new("RGB", (W, SH + EH + 20), (36, 24, 56))
    im.paste(spectro(x, sr, W, SH), (0, 20))
    im.paste(envelope(x, W, EH), (0, 20 + SH))
    d = ImageDraw.Draw(im)
    dur = len(x) / sr
    for s in range(int(dur) + 1):
        xp = int(s / dur * W)
        d.line([(xp, 20 + SH - 8), (xp, 20 + SH)], fill=(255, 255, 255))
        if s % 2 == 0:
            d.text((xp + 2, 20 + SH - 20), f"{s}s", fill=(255, 255, 255))
    freq_grid(im, 0, 20, SH)
    name = path.rsplit("/", 1)[-1].replace(".wav", "")
    pk = 20 * np.log10(max(1e-9, float(np.max(np.abs(x)))))
    rms = 20 * np.log10(max(1e-9, float(np.sqrt(np.mean(x * x)))))
    d.text((4, 4), f"{name}   {dur:.1f}s   peak {pk:.1f} dBFS   rms {rms:.1f} dBFS", fill=(255, 226, 122))
    png = path.replace(".wav", ".png")
    im.save(png)
    print(f"spectrogram: {png}")
`;

// per-segment stats of one wav: [label, from, to] seconds -> rms, spectral centroid, 95% roll-off, share above 4 kHz
const SEGMENT_PY = String.raw`
import sys, json, wave
import numpy as np
path = sys.argv[1]
segs = json.loads(sys.argv[2])
with wave.open(path) as w:
    n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
    d = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
x = d.reshape(-1, ch).mean(axis=1)
out = []
for label, a, b in segs:
    seg = x[int(a * sr):int(b * sr)]
    X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / sr)
    tot = X.sum() + 1e-20
    cen = float((f * X).sum() / tot)
    roll = float(f[min(len(f) - 1, int(np.searchsorted(np.cumsum(X), 0.95 * tot)))])
    hi = float(X[f >= 4000].sum() / tot)
    rms = float(20 * np.log10(max(1e-9, np.sqrt(np.mean(seg * seg)))))
    blk = int(sr * 0.01)
    nb = max(1, len(seg) // blk)
    pk = np.abs(seg[: nb * blk]).reshape(nb, blk).max(axis=1)
    hot = float((pk > 10 ** (-4 / 20)).mean())
    out.append(dict(label=label, rms=rms, centroid=cen, rolloff=roll, hi=hi, hot=hot))
print(json.dumps(out))
`;
function segments(file, segs) {
  const py = spawnSync("python3", ["-I", "-c", SEGMENT_PY, file, JSON.stringify(segs)], { encoding: "utf8" });
  if (py.status !== 0) {
    console.log("segment analysis failed:", py.stderr);
    return null;
  }
  return JSON.parse(py.stdout);
}

const args = parseArgs();
const OUT = new URL("../shots/audio/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const all = !args.sfx && !args.tracks && !args.analyze && !args.chaos && !args.spam && !args.live && !args.layers && !args.degrade && !args.mix && !args.scenes;
const filter = args.filter && args.filter !== true ? String(args.filter).split(",") : null;
const pick = (id) => !filter || filter.some((f) => id.includes(f));
const fullLength = args.seconds === "full";
const seconds = fullLength ? 0 : Number(args.seconds ?? 20);

const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const problems = [];
const srcRate = {};

function report(name, s, kind) {
  const issues = [];
  if (s.nan) issues.push(`NaN×${s.nan}`);
  if (s.clipped) issues.push(`clip×${s.clipped}`);
  if (s.peak < (kind === "sfx" ? 0.02 : 0.05)) issues.push("SILENT/too quiet");
  if (Math.abs(s.dc) > 0.004) issues.push(`DC ${fmt(s.dc, 4)}`);
  if (s.head > 0.02) issues.push(`onset click ${fmt(s.head, 3)}`);
  if (kind === "sfx" && s.audible > 3.6) issues.push("too long / no release");
  if (issues.length) problems.push(`${name}: ${issues.join(", ")}`);
  console.log(
    `${name.padEnd(22)} len ${fmt(s.audible).padStart(5)}s  peak ${fmt(s.peakDb, 1).padStart(6)} dB  rms ${fmt(s.rmsDb, 1).padStart(6)} dB  dc ${fmt(s.dc, 4).padStart(7)}  clip ${String(s.clipped).padStart(3)}  nan ${s.nan}  head ${fmt(s.head, 3)}  tail ${fmt(s.tail, 3)}${issues.length ? "   <-- " + issues.join(", ") : ""}`,
  );
}

function save(name, wav) {
  const file = `${OUT}${name}.wav`;
  writeFileSync(file, Buffer.from(wav, "base64"));
  return file;
}

const { url, close } = await startServer();
const browser = await launchBrowser();
const written = { sfx: [], tracks: [] };
let code = 0;
try {
  const page = await newPage(browser, { w: 1000, h: 800 });
  await page.goto(`${url}/tools/audio.html`, { waitUntil: "load" });
  await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
  const ids = await page.evaluate(() => window.__audioRender.sfxIds);
  const tracks = await page.evaluate(() => window.__audioRender.tracks);
  const stageBpm = await page.evaluate(() => window.__audioRender.stageBpm);
  const meta = {};
  for (const t of tracks) meta[t] = await page.evaluate((t) => window.__audioRender.analyze(t), t);
  const isBoss = (t) => t.startsWith("boss") || t === "final" || t === "cancel";
  /** the intensity schedule a render uses: layered tracks ramp up like a run (bosses from 0.4) */
  const rampFor = (t, len) =>
    meta[t].layers && Object.keys(meta[t].layers).length
      ? isBoss(t)
        ? [[0, 0.4], [len * 0.4, 0.7], [len * 0.7, 1]]
        : [[0, 0], [len * 0.25, 0.45], [len * 0.5, 0.75], [len * 0.7, 1]]
      : [[0, 1]];

  if (all || args.analyze) {
    console.log("\n== music analysis (strong-beat melody notes vs chords) ==");
    for (const t of tracks.filter(pick)) {
      const r = meta[t];
      const pctN = r.strongTotal ? 100 * (1 - r.strongOff.length / r.strongTotal) : 100;
      const pct = pctN.toFixed(1);
      const secs = r.sections.length > 14 ? `${r.sections.length} sections (${r.sections.slice(0, 9).map((s) => `${s.name}(${s.bars})`).join(" ")} ...)` : `sections ${r.sections.map((s) => `${s.name}(${s.bars})`).join(" ")}`;
      console.log(`${t.padEnd(13)} ${r.bpm} bpm  total ${fmt(r.totalSeconds, 1)} s  loop ${fmt(r.loopSeconds, 1)} s  ${secs}`);
      console.log(`    key: declared "${r.key || "-"}"  detected ${r.detectedKey} (r ${fmt(r.keyScore)})   chord-tone on strong beats ${pct}% (${r.strongOff.length}/${r.strongTotal} off)`);
      if (Object.keys(r.layers).length) console.log("    layers:", Object.entries(r.layers).map(([k, v]) => `${k}@${v}`).join("  "));
      if (r.tiers.length) console.log("    degrade tiers:", r.tiers.map((x) => `>=${x.at}: ${x.order.join(" ")}`).join("  |  "));
      if (r.missingInst.length) problems.push(`${t}: missing instruments ${r.missingInst.join(",")}`);
      if (pctN < 97) problems.push(`${t}: only ${pct}% chord tones on strong beats`);
      if (stageBpm[t] && stageBpm[t] !== r.bpm) problems.push(`${t}: ${r.bpm} bpm, the stage beat clock expects ${stageBpm[t]}`);
      if (r.key && !r.key.includes("->") && !r.key.toLowerCase().startsWith(r.detectedKey.toLowerCase().split(" ")[0].toLowerCase() + " ") && r.key.toLowerCase() !== r.detectedKey.toLowerCase())
        console.log(`    note: detected key differs from the declared one`);
      if (r.silentBars.length) {
        console.log(`    bars silent at intensity 0: ${r.silentBars.join(" ")}`);
        if (Object.keys(r.layers).length && r.silentBars.length > 2) problems.push(`${t}: ${r.silentBars.length} bars silent at intensity 0`);
      }
      for (const o of r.strongOff) console.log(`    off: ${o.channel} ${o.section} beat ${o.beat} note ${o.note} over ${o.chord}`);
      console.log("    ranges:", Object.entries(r.ranges).map(([k, [a, b]]) => `${k} ${a}-${b}`).join("  "));
    }
  }

  if (all || args.sfx) {
    console.log("\n== sfx ==");
    for (const id of ids.filter(pick)) {
      const r = await page.evaluate((id) => window.__audioRender.sfx(id), id);
      report(id, r.stats, "sfx");
      written.sfx.push(save(`sfx_${id}`, r.wav));
    }
    // pitch-tracking check for the gem chain
    if (pick("gem")) {
      for (const p of [0, 7, 14]) {
        const r = await page.evaluate((p) => window.__audioRender.sfx("gem", p), p);
        report(`gem@+${p}`, r.stats, "sfx");
      }
    }
  }

  if (all || args.spam) {
    console.log("\n== rate limit / voice cap (40 triggers, 5 ms apart) ==");
    for (const id of ["hit", "gem", "enemyDie", "explosion", "missile", "boba", "teacup", "crunch", "fireball", "honk", "lightstick"]) {
      const r = await page.evaluate((id) => window.__audioRender.spam(id, 40, 0.005), id);
      console.log(`${id.padEnd(10)} played ${r.played}/40`);
      report(`spam_${id}`, r.stats, "spam");
      save(`spam_${id}`, r.wav);
    }
  }

  if (all || args.chaos) {
    console.log("\n== combat chaos mix (headroom) ==");
    const r = await page.evaluate(() => window.__audioRender.chaos(8));
    report("chaos", r.stats, "mix");
    written.tracks.push(save("mix_chaos", r.wav));
    // Season 2: the new weapon sounds (+ lightstick on the beat, honks, henshin, BAKA, NANI) over every stage theme
    for (const t of ["candy", "academy", "beach", "finale", "boss_finale", "cancel"].filter(pick)) {
      const r2 = await page.evaluate((t) => window.__audioRender.chaos(8, { track: t, ids: window.__audioRender.chaosS2, s2: true }), t);
      report(`chaos_s2_${t}`, r2.stats, "mix");
      const f2 = save(`mix_chaos_s2_${t}`, r2.wav);
      written.tracks.push(f2);
      const g = segments(f2, [["all", 0.5, 7.9]])?.[0];
      if (g) {
        console.log(`    ${(g.hot * 100).toFixed(1)}% of 10 ms blocks peak above -4 dBFS (limiter working)`);
        if (g.hot > 0.05) problems.push(`chaos_s2_${t}: the mix sits on the limiter (${(g.hot * 100).toFixed(1)}% hot blocks)`);
      }
    }
  }

  if (all || args.tracks) {
    console.log(`\n== music (${fullLength ? "full length" : seconds + " s each"}) ==`);
    for (const t of tracks.filter(pick)) {
      const len = fullLength ? Math.ceil((await page.evaluate((t) => window.__audioRender.analyze(t), t)).totalSeconds + 3) : seconds;
      const o = { seconds: len };
      o.intensity = fullLength ? [[0, 1]] : rampFor(t, len);
      if (t === "cancel" && !fullLength) o.degrade = [[0, 0], [len * 0.25, 0.34], [len * 0.5, 0.67], [len * 0.75, 1]];
      const r = await page.evaluate(([t, o]) => window.__audioRender.track(t, o), [t, o]);
      report(`music_${t}`, r.stats, "music");
      srcRate[t] = r.srcPerSec;
      written.tracks.push(save(`music_${t}`, r.wav));
    }
    // CPU proxy: synth sources started per second (each = an oscillator or noise buffer + its envelope / filters)
    // reference: the busiest base-game track (already shipped and profiled on phones)
    const BASE = ["title", "battle", "boss", "final", "victory", "gameover", "shop"];
    const ref = Math.max(0, ...BASE.map((t) => srcRate[t] ?? 0));
    console.log("sources started per second" + (ref ? ` (busiest base-game track = ${fmt(ref, 0)})` : "") + ":");
    console.log("  " + Object.entries(srcRate).map(([t, v]) => `${t} ${fmt(v, 0)}`).join("  "));
    for (const [t, v] of Object.entries(srcRate)) if (ref && v > ref * 1.25) problems.push(`music_${t}: ${fmt(v, 0)} sources/s, over 1.25x the busiest base-game track (${fmt(ref, 0)})`);
    if (!filter || pick("xfade")) {
      const r = await page.evaluate(() =>
        window.__audioRender.track("battle", { seconds: 12, intensity: [[0, 1]], then: { at: 5, track: "boss", fade: 1.2 }, muffle: [[8.5, true], [10.5, false]] }),
      );
      report("xfade_battle_boss", r.stats, "music");
      written.tracks.push(save("xfade_battle_boss", r.wav));
    }
  }

  if (all || args.scenes) {
    console.log("\n== scenes (scripted Season 2 moments, timings from gacha.md / src/ui) ==");
    for (const name of (await page.evaluate(() => window.__audioRender.scenes)).filter(pick)) {
      const r = await page.evaluate((n) => window.__audioRender.scene(n), name);
      report(`scene_${name}`, r.stats, "mix");
      written.tracks.push(save(`scene_${name}`, r.wav));
    }
  }

  if (args.mix) {
    console.log("\n== per-channel levels (solo, 10 s at intensity 1, from 2 s): rms / share of the full mix / centroid ==");
    for (const t of tracks.filter(pick)) {
      const full = await page.evaluate((t) => window.__audioRender.track(t, { seconds: 10, intensity: [[0, 1]] }), t);
      const ff = save(`mix_full_${t}`, full.wav);
      const fs = segments(ff, [["full", 2, 10]])?.[0];
      const rows = [];
      for (const c of await page.evaluate((t) => window.__audioRender.channels(t), t)) {
        const r = await page.evaluate(([t, id]) => window.__audioRender.track(t, { seconds: 10, intensity: [[0, 1]], solo: id }), [t, c.id]);
        const f = save(`mix_solo`, r.wav);
        const g = segments(f, [[c.id, 2, 10]])?.[0];
        rows.push(`${c.id}${c.layer ? "@" + c.layer : ""} ${fmt(g?.rms, 1)} (${fmt((g?.rms ?? -99) - (fs?.rms ?? 0), 1)}) ${fmt(g?.centroid, 0)}Hz`);
      }
      console.log(`${t.padEnd(13)} full ${fmt(fs?.rms, 1)} dB ${fmt(fs?.centroid, 0)} Hz |  ${rows.join("  |  ")}`);
    }
  }

  if (all || args.layers) {
    console.log("\n== intensity layers (12 s of the looped sections at intensity 0 vs 1; bosses 0.4 vs 1) ==");
    for (const t of tracks.filter(pick).filter((t) => Object.keys(meta[t].layers).length)) {
      const lo = isBoss(t) ? 0.4 : 0;
      const from = meta[t].totalSeconds - meta[t].loopSeconds + 0.5; // skip the intro
      const secs = from + 12.5;
      const a = await page.evaluate(([t, lo, secs]) => window.__audioRender.track(t, { seconds: secs, intensity: [[0, lo]] }), [t, lo, secs]);
      const b = await page.evaluate(([t, secs]) => window.__audioRender.track(t, { seconds: secs, intensity: [[0, 1]] }), [t, secs]);
      const fa = save(`layers_${t}_lo`, a.wav);
      const fb = save(`layers_${t}_hi`, b.wav);
      const sa = segments(fa, [["lo", from, from + 12]])?.[0];
      const sb = segments(fb, [["hi", from, from + 12]])?.[0];
      const d = sa && sb ? sb.rms - sa.rms : NaN;
      console.log(
        `${t.padEnd(13)} @${lo}: rms ${fmt(sa?.rms, 1)} dB  centroid ${fmt(sa?.centroid, 0)} Hz  >4k ${fmt((sa?.hi ?? 0) * 100, 2)}%   @1: rms ${fmt(sb?.rms, 1)} dB  centroid ${fmt(sb?.centroid, 0)} Hz  >4k ${fmt((sb?.hi ?? 0) * 100, 2)}%   delta ${fmt(d, 1)} dB  peak@1 ${fmt(b.stats.peakDb, 1)} dB`,
      );
      if (b.stats.clipped || b.stats.nan) problems.push(`layers ${t}: clipping/NaN at intensity 1`);
      if (sa && sa.rms < -42) problems.push(`layers ${t}: too sparse at intensity ${lo} (${fmt(sa.rms, 1)} dB)`);
      // a layer must be heard: louder, brighter, or more top end (dense boss mixes are held level by the glue compressor)
      if (Number.isFinite(d) && d < 0.8 && sb.centroid - sa.centroid < 150 && sb.hi < sa.hi * 1.5) problems.push(`layers ${t}: intensity barely changes anything (${fmt(d, 1)} dB)`);
    }
  }

  if (all || args.degrade) {
    console.log("\n== cancel: budget cuts (setDegrade 0 -> .34 @22 s -> .67 @38 s -> 1 @54 s, intensity 0.7) ==");
    const len = 70;
    const r = await page.evaluate((len) => window.__audioRender.track("cancel", { seconds: len, intensity: [[0, 0.7]], degrade: [[0, 0], [22, 0.34], [38, 0.67], [54, 1]] }), len);
    report("music_cancel_degrade", r.stats, "music");
    const f = save("music_cancel_degrade", r.wav);
    written.tracks.push(f);
    // each step lands on the next bar line (1.5 s at 160 bpm): measure from 2 s into each segment
    const segs = segments(f, [["epic (0)", 8, 22], ["ratings drop (.34)", 24, 38], ["budget cuts (.67)", 40, 54], ["rushed ending (1)", 56, 69.5]]);
    if (segs) {
      for (const g of segs) console.log(`  ${g.label.padEnd(20)} rms ${fmt(g.rms, 1)} dB  centroid ${fmt(g.centroid, 0).padStart(5)} Hz  roll-off95 ${fmt(g.rolloff, 0).padStart(5)} Hz  >4k ${fmt(g.hi * 100, 2)}%`);
      for (let i = 1; i < segs.length; i++) {
        if (segs[i].rolloff >= segs[i - 1].rolloff) problems.push(`cancel: bandwidth did not shrink from "${segs[i - 1].label}" to "${segs[i].label}"`);
        if (segs[i].rms < -40) problems.push(`cancel: "${segs[i].label}" is nearly silent`);
      }
    }
    // auto mode (nobody calls setDegrade): it must still get cheaper on its own
    const auto = await page.evaluate(() => window.__audioRender.track("cancel", { seconds: 90, intensity: [[0, 0.7]] }));
    report("music_cancel_auto", auto.stats, "music");
    const fa = save("music_cancel_auto", auto.wav);
    written.tracks.push(fa);
    const sa = segments(fa, [["auto 0-28 s", 2, 28], ["auto 58-80 s", 58, 80], ["auto 83-90 s", 83, 89.5]]);
    if (sa) {
      for (const g of sa) console.log(`  ${g.label.padEnd(20)} rms ${fmt(g.rms, 1)} dB  centroid ${fmt(g.centroid, 0).padStart(5)} Hz  roll-off95 ${fmt(g.rolloff, 0).padStart(5)} Hz  >4k ${fmt(g.hi * 100, 2)}%`);
      if (sa[2].rolloff >= sa[0].rolloff) problems.push("cancel: auto mode never degraded");
    }
  }

  if (args.live) {
    console.log("\n== realtime smoke test (AudioContext in the page) ==");
    const before = await page.evaluate(() => ({ unlocked: window.__audioLive.unlocked(), state: window.__audioLive.state() }));
    console.log("before gesture:", JSON.stringify(before));
    await page.click("#unlock");
    await page.waitForTimeout(300);
    const steps = [
      ["title music", "music:title", 2500],
      ["battle @0", "music:battle|int:0", 3000],
      ["battle @1", "int:1", 4500],
      ["muffled", "muffle:1", 1500],
      ["unmuffled", "muffle:0", 1000],
      ["sfx burst", "burst", 800],
      ["duck", "duck", 600],
      ["suspend", "suspend", 800],
      ["resume", "resume", 1200],
      ["boss xfade", "music:boss", 2500],
      ["hub", "music:hub", 2500],
      ["gacha", "music:gacha|sfx:gachaCharge", 2000],
      ["mythic cut", "sfx:gachaMythicGlitch|cut", 1200],
      ["mythic boom", "sfx:gachaMythicBoom|music:gacha_mythic", 2500],
      ["cancel epic", "music:cancel|int:0.7|deg:0", 3000],
      ["cancel cuts", "deg:0.67", 4000],
      ["cancel rushed", "deg:1", 3000],
      ["none", "music:none", 1500],
      ["silence", "wait", 1500],
    ];
    for (const [label, action, ms] of steps) {
      const r = await page.evaluate(([a, ms]) => window.__audioLive.run(a, ms), [action, ms]);
      console.log(`${label.padEnd(12)} ctx ${r.state.padEnd(9)} rms ${fmt(r.rmsDb, 1).padStart(6)} dB  peak ${fmt(r.peakDb, 1).padStart(6)} dB  voices ${String(r.voices).padStart(2)}  section ${r.section}`);
      if (label === "battle @1" && r.rmsDb < -40) problems.push("live: battle music silent");
      if (label === "suspend" && r.state !== "suspended") problems.push("live: suspend did not suspend");
      if (label === "resume" && r.state !== "running") problems.push("live: resume did not resume");
      if (label === "silence" && r.rmsDb > -60) problems.push("live: music did not stop");
      if (["hub", "gacha", "cancel epic", "cancel cuts", "cancel rushed", "mythic boom"].includes(label) && r.rmsDb < -40) problems.push(`live: ${label} silent`);
      if (label.startsWith("cancel") && r.section === "") problems.push(`live: ${label} has no section`);
    }
  }

  const errs = page.__logs.filter((l) => l.startsWith("[pageerror]") || l.startsWith("[error]") || l.startsWith("[warning]"));
  if (errs.length) {
    console.log("\nPAGE LOGS:\n" + errs.join("\n"));
    if (errs.some((l) => !l.startsWith("[warning]"))) code = 2;
  }
} finally {
  await browser.close();
  await close();
}

if (args.spectro && (written.sfx.length || written.tracks.length)) {
  const py = spawnSync("python3", ["-I", "-c", SPECTRO_PY, OUT, JSON.stringify(written)], { stdio: "inherit" });
  if (py.status !== 0) console.log("spectrogram rendering failed");
}

if (problems.length) {
  console.log(`\n${problems.length} PROBLEM(S):\n  ` + problems.join("\n  "));
  code = code || 1;
} else console.log("\nall renders clean");
console.log(`wav files in ${OUT}`);
process.exit(code);
