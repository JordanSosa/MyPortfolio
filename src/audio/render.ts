/**
 * Offline rendering + analysis helpers (used by tools/audio.ts and
 * scripts/audio-render.mjs). Renders through an OfflineAudioContext with the
 * exact same Engine / synthesis code the game uses.
 */
import type { MusicTrack, SfxId, SfxOpts } from "./api";
import { Engine, songFor } from "./engine";
import { synthStats } from "./synth";
import { SFX } from "./sfx";
import { INST } from "./music/inst";

export const SFX_IDS = Object.keys(SFX) as SfxId[];
export const TRACKS: Exclude<MusicTrack, "none">[] = [
  "title", "battle", "boss", "final", "victory", "gameover", "shop",
  // Season 2
  "hub", "gacha", "gacha_mythic", "candy", "academy", "beach", "finale",
  "boss_candy", "boss_academy", "boss_beach", "boss_finale", "cancel",
];

/** Stage tempos (docs/content/stages.md, StageDef.bpm): beat-synced weapons expect the battle theme at this bpm. */
export const STAGE_BPM: Partial<Record<Exclude<MusicTrack, "none">, number>> = { candy: 150, academy: 136, beach: 128, finale: 160 };

/** In-run sfx from the base game and Season 2 used by the chaos mixes. */
export const CHAOS_BASE: SfxId[] = ["hit", "hit", "hitCrit", "enemyDie", "gem", "gem", "starShot", "slash", "explosion", "orbitHit", "bubblePop", "coin"];
export const CHAOS_S2: SfxId[] = ["hit", "hit", "hitCrit", "enemyDie", "gem", "gem", "missile", "fanSmack", "teacup", "fireball", "boba", "paperCrane", "crunch", "splash", "sparkleCharm", "glitch"];

/** game defaults (src/ui/save.ts) so renders match what players hear */
export const DEFAULT_VOLS = { master: 0.8, music: 0.7, sfx: 0.85 };

export interface Stats {
  seconds: number;
  /** time of the last sample above -60 dBFS */
  audible: number;
  peak: number;
  peakDb: number;
  rms: number;
  rmsDb: number;
  dc: number;
  clipped: number;
  nan: number;
  /** max |x| over the first 32 samples (onset click check) */
  head: number;
  /** max |x| over the last 32 samples (cut-off check) */
  tail: number;
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

/**
 * Warm-up before anything sounds: DynamicsCompressorNode starts in a state that
 * strongly attenuates the first ~50 ms, which would make offline measurements of
 * short sounds meaningless. Renders start their content at PRE and drop it after.
 */
export const PRE = 0.35;

function offline(seconds: number, sr: number): OfflineAudioContext {
  return new OfflineAudioContext(2, Math.ceil((seconds + PRE) * sr), sr);
}

/** Drop the warm-up pre-roll. */
function cut(buf: AudioBuffer): AudioBuffer {
  const skip = Math.floor(PRE * buf.sampleRate);
  const len = Math.max(1, buf.length - skip);
  const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: len, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(skip, skip + len), c);
  return out;
}

export function stats(buf: AudioBuffer): Stats {
  const n = buf.length;
  const sr = buf.sampleRate;
  let peak = 0, sum = 0, sq = 0, clipped = 0, nan = 0, head = 0, tail = 0, lastLoud = 0;
  const thr = Math.pow(10, -60 / 20);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const x = d[i];
      if (x !== x) {
        nan++;
        continue;
      }
      const a = x < 0 ? -x : x;
      if (a > peak) peak = a;
      if (a >= 0.999) clipped++;
      if (a > thr && i > lastLoud) lastLoud = i;
      sum += x;
      sq += x * x;
      if (i < 32 && a > head) head = a;
      if (i >= n - 32 && a > tail) tail = a;
    }
  }
  const tot = n * buf.numberOfChannels;
  const rms = Math.sqrt(sq / tot);
  return { seconds: n / sr, audible: lastLoud / sr, peak, peakDb: db(peak), rms, rmsDb: db(rms), dc: sum / tot, clipped, nan, head, tail };
}

export async function renderSfx(id: SfxId, opts: SfxOpts = {}, seconds = 4, sr = 44100): Promise<AudioBuffer> {
  const ctx = offline(seconds, sr);
  const eng = new Engine(ctx);
  eng.clock = () => 0;
  eng.setVolumes(DEFAULT_VOLS);
  eng.clock = () => PRE;
  eng.sfx(id, opts, PRE);
  return cut(await ctx.startRendering());
}

/** A burst of the same sfx (rate limit / voice cap / stealing check). */
export async function renderSpam(id: SfxId, count: number, every: number, seconds = 3, sr = 44100): Promise<{ buf: AudioBuffer; played: number }> {
  const ctx = offline(seconds, sr);
  const eng = new Engine(ctx);
  let vt = 0;
  eng.clock = () => vt;
  eng.setVolumes(DEFAULT_VOLS);
  let played = 0;
  for (let i = 0; i < count; i++) {
    vt = PRE + i * every;
    if (eng.sfx(id, { pitch: (i % 5) - 2 }, vt) > 0) played++;
  }
  return { buf: cut(await ctx.startRendering()), played };
}

export interface ChaosOpts {
  /** music under the fight (default battle) */
  track?: Exclude<MusicTrack, "none">;
  /** the spammed pool (default CHAOS_BASE) */
  ids?: SfxId[];
  /** Season 2 extras: lightstick on every beat, honk / transform / nani / baka every few seconds */
  s2?: boolean;
}

/**
 * Dense combat mix: many sfx over music at high intensity (headroom check). The
 * music is scheduled just-in-time like the realtime engine (see renderTrack).
 */
export async function renderChaos(seconds = 8, sr = 44100, o: ChaosOpts = {}): Promise<AudioBuffer> {
  const ctx = offline(seconds, sr);
  const eng = new Engine(ctx);
  let vt = 0;
  eng.clock = () => vt;
  eng.setVolumes(DEFAULT_VOLS);
  eng.setIntensity(1);
  vt = PRE;
  const track = o.track ?? "battle";
  eng.music(track, 0);
  const spam = o.ids ?? CHAOS_BASE;
  const beat = 60 / songFor(track).def.bpm;
  let k = 0;
  let nextBeat = 0;
  for (let s = 0; s < seconds; s += 0.01) {
    vt = PRE + s;
    for (let j = 0; j < 3; j++) {
      const id = spam[(k++ * 7) % spam.length];
      eng.sfx(id, { pitch: (k % 9) * 0.6, pan: Math.sin(k) * 0.7, vol: 0.7 }, vt);
    }
    if (Math.abs(s - 2) < 0.005) eng.sfx("explosionBig", {}, vt);
    if (Math.abs(s - 3) < 0.005) eng.sfx("levelUp", {}, vt);
    if (Math.abs(s - 5) < 0.005) {
      eng.sfx("ultCutin", {}, vt);
      eng.duck(0.65, 1.3);
    }
    if (Math.abs(s - 6.2) < 0.005) eng.sfx("ultBlast", {}, vt);
    if (o.s2) {
      if (s >= nextBeat) {
        eng.sfx("lightstick", { vol: 0.8 }, vt);
        nextBeat += beat;
      }
      const at = (x: number) => Math.abs(s % 4 - x) < 0.005;
      if (at(0.5)) eng.sfx("honk", {}, vt);
      if (at(0.75)) eng.sfx("honk", { vol: 0.6 }, vt);
      if (at(1.5)) eng.sfx("transform", {}, vt);
      if (at(2.5)) eng.sfx("baka", {}, vt);
      if (Math.abs(s - 4.2) < 0.005) eng.sfx("nani", { vol: 0.7 }, vt);
    }
  }
  // schedule the music just-in-time (suspend / tick / resume), like renderTrack
  const STEP = 0.1;
  const total = seconds + PRE;
  const q = (t: number) => Math.round(t * sr / 128) * 128 / sr;
  eng.clock = () => vt;
  vt = PRE;
  eng.tick(PRE);
  for (let t = q(PRE + STEP); t < total - STEP; t = q(t + STEP)) {
    const tt = t;
    ctx.suspend(tt).then(() => {
      vt = tt;
      eng.tick(tt);
      void ctx.resume();
    });
  }
  return cut(await ctx.startRendering());
}

export interface TrackRenderOpts {
  seconds?: number;
  /** [time, intensity] steps */
  intensity?: [number, number][];
  /** switch to another track at a time (crossfade test) */
  then?: { at: number; track: MusicTrack; fade?: number };
  /** muffle on/off windows */
  muffle?: [number, boolean][];
  /** [time, degrade] steps (Engine.setDegrade; omitted = the track's auto mode) */
  degrade?: [number, number][];
  /** mix analysis: render only this channel */
  solo?: string;
  sr?: number;
}

/**
 * Render a track like the realtime engine plays it: the OfflineAudioContext is
 * suspended every STEP seconds and the engine schedules just-in-time (same
 * lookahead as realtime). Creating all notes up front would make long renders
 * crawl (every not-yet-started node is still traversed each render quantum).
 */
/** Sources started by the last renderTrack call (perf report). */
export const lastRender = { sources: 0, seconds: 0 };

export async function renderTrack(track: Exclude<MusicTrack, "none">, o: TrackRenderOpts = {}): Promise<AudioBuffer> {
  const src0 = synthStats.sources;
  const seconds = o.seconds ?? 20;
  const sr = o.sr ?? 44100;
  const STEP = 0.1;
  const ctx = offline(seconds, sr);
  const eng = new Engine(ctx);
  let vt = 0;
  eng.clock = () => vt;
  eng.setVolumes(DEFAULT_VOLS);
  const steps = [...(o.intensity ?? [[0, 1]])].sort((a, b) => a[0] - b[0]);
  const muf = [...(o.muffle ?? [])].sort((a, b) => a[0] - b[0]);
  const deg = [...(o.degrade ?? [])].sort((a, b) => a[0] - b[0]);
  eng.setIntensity(steps[0]?.[1] ?? 1);
  vt = PRE;
  eng.music(track, 0);
  if (o.solo) eng.soloChannel(o.solo);
  eng.tick(vt);
  let si = 1, mi = 0, di = 0, switched = false;
  const total = seconds + PRE;
  const at = (t: number) => Math.round(t * sr / 128) * 128 / sr; // suspend times are quantised to render quanta
  const step = (t: number) => {
    vt = t;
    const s = t - PRE;
    while (si < steps.length && steps[si][0] <= s) eng.setIntensity(steps[si++][1]);
    while (mi < muf.length && muf[mi][0] <= s) eng.setMuffled(muf[mi++][1]);
    while (di < deg.length && deg[di][0] <= s) eng.setDegrade(deg[di++][1]);
    if (o.then && !switched && s >= o.then.at) {
      switched = true;
      eng.music(o.then.track, o.then.fade ?? 1);
    }
    eng.tick(t);
  };
  for (let t = at(PRE + STEP); t < total - STEP; t = at(t + STEP)) {
    const tt = t;
    ctx.suspend(tt).then(() => {
      step(tt);
      void ctx.resume();
    });
  }
  const out = cut(await ctx.startRendering());
  lastRender.sources = synthStats.sources - src0;
  lastRender.seconds = seconds;
  return out;
}

/** One step of a scripted scene: at `t` seconds play an sfx, switch music, duck, set intensity / degrade. */
export type SceneStep =
  | { t: number; sfx: SfxId; vol?: number; pitch?: number }
  | { t: number; music: MusicTrack; fade?: number }
  | { t: number; duck: number; secs: number }
  | { t: number; intensity: number }
  | { t: number; degrade: number };

/** Render a scripted moment (a gacha pull, a death...) exactly as the engine would play it. */
export async function renderScene(steps: SceneStep[], seconds: number, sr = 44100): Promise<AudioBuffer> {
  const ctx = offline(seconds, sr);
  const eng = new Engine(ctx);
  let vt = 0;
  eng.clock = () => vt;
  eng.setVolumes(DEFAULT_VOLS);
  const todo = [...steps].sort((a, b) => a.t - b.t);
  let i = 0;
  const run = (now: number) => {
    vt = now;
    while (i < todo.length && todo[i].t + PRE <= now + 1e-6) {
      const s = todo[i++];
      if ("sfx" in s) eng.sfx(s.sfx, { vol: s.vol, pitch: s.pitch }, Math.max(now, s.t + PRE));
      else if ("music" in s) eng.music(s.music, s.fade ?? 1);
      else if ("duck" in s) eng.duck(s.duck, s.secs);
      else if ("intensity" in s) eng.setIntensity(s.intensity);
      else eng.setDegrade(s.degrade);
    }
    eng.tick(now);
  };
  const STEP = 0.05;
  const q = (t: number) => Math.round(t * sr / 128) * 128 / sr;
  run(PRE);
  for (let t = q(PRE + STEP); t < seconds + PRE - STEP; t = q(t + STEP)) {
    const tt = t;
    ctx.suspend(tt).then(() => {
      run(tt);
      void ctx.resume();
    });
  }
  return cut(await ctx.startRendering());
}

/** The moments the Season 2 UI scripts (timings from docs/content/gacha.md and src/ui). */
export const SCENES: Record<string, { seconds: number; steps: SceneStep[] }> = {
  // gacha.md storyboard: summon, meteor, impact -> MYTHIC: glitch + music cut, silence + error, boom at 2.3 s, sting at 5.5 s
  mythic_pull: {
    seconds: 13,
    steps: [
      { t: 0, music: "gacha", fade: 0 },
      { t: 2, sfx: "gachaCharge" },
      { t: 2, duck: 0.5, secs: 2.2 },
      { t: 3.2, sfx: "gachaMeteor" },
      { t: 4.2, sfx: "gachaMythicGlitch" },
      { t: 4.2, music: "none", fade: 0 },
      { t: 6.5, sfx: "gachaMythicBoom" },
      { t: 7.2, sfx: "voiceBlip" },
      { t: 7.35, sfx: "voiceBlip" },
      { t: 7.5, sfx: "voiceBlip" },
      { t: 9.7, music: "gacha_mythic", fade: 0 },
    ],
  },
  // src/ui/hub/gacha.ts as it is wired today: charge, meteor at 0.7 s, reveal at 1.25 s, card flips every 0.16 s
  ssr_ten_pull: {
    seconds: 8,
    steps: [
      { t: 0, music: "gacha", fade: 0 },
      { t: 1.5, sfx: "uiConfirm" },
      { t: 1.6, sfx: "gachaCharge" },
      { t: 2.3, sfx: "gachaMeteor" },
      { t: 2.85, sfx: "gachaRevealSSR" },
      ...Array.from({ length: 10 }, (_, i) => ({ t: 2.95 + i * 0.16, sfx: (i === 4 ? "starUp" : "cardFlip") as SfxId, vol: 0.7, pitch: i })),
      { t: 4.9, sfx: "gachaDupe" },
    ],
  },
  // the TO BE CONTINUED death screen (src/ui/screens/over.ts): gameOver, then the riff 0.18 s later, over the gameover track
  death_tbc: {
    seconds: 7,
    steps: [
      { t: 0, music: "candy", fade: 0 },
      { t: 0, intensity: 0.8 },
      { t: 2, sfx: "playerDie" },
      { t: 3, music: "gameover", fade: 0.6 },
      { t: 3, sfx: "gameOver" },
      { t: 3.18, sfx: "toBeContinued" },
    ],
  },
  // losing the 50/50 in the Merch Machine
  lost_5050: {
    seconds: 6,
    steps: [
      { t: 0, music: "gacha", fade: 0 },
      { t: 1.5, sfx: "gachaRevealSSR" },
      { t: 2.6, sfx: "recordScratch" },
      { t: 2.9, sfx: "gachaLost5050" },
    ],
  },
};

// ---------------------------------------------------------------- WAV + transfer

export function wavBytes(buf: AudioBuffer): Uint8Array {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  out.setUint32(4, 36 + n * ch * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true);
  w(36, "data");
  out.setUint32(40, n * ch * 2, true);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const x = Math.max(-1, Math.min(1, data[c][i] || 0));
      out.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
      o += 2;
    }
  }
  return new Uint8Array(out.buffer);
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}

/** Trim a buffer to its audible part + a little tail (for compact sfx WAVs). */
export function trimmed(buf: AudioBuffer, audible: number, pad = 0.15): AudioBuffer {
  const len = Math.min(buf.length, Math.max(1, Math.ceil((audible + pad) * buf.sampleRate)));
  const ctx = new OfflineAudioContext(buf.numberOfChannels, len, buf.sampleRate);
  const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(0, len), c);
  return out;
}

// ---------------------------------------------------------------- music analysis (no audio)

export interface HarmonyReport {
  track: string;
  bpm: number;
  /** declared home key (SongDef.key) and the key estimated from the notes (Krumhansl-Schmuckler) */
  key: string;
  detectedKey: string;
  keyScore: number;
  loopSeconds: number;
  totalSeconds: number;
  sections: { name: string; bars: number; events: number }[];
  /** degrade tiers (setDegrade): threshold + section names */
  tiers: { at: number; order: string[] }[];
  /** intensity layers: channel -> threshold (layered songs only) */
  layers: Record<string, number>;
  /** bars (in the main loop) where nothing plays at intensity 0 (would sound like a dropout) */
  silentBars: string[];
  /** melodic notes landing on beats 1/3 of a bar that are not chord tones */
  strongOff: { channel: string; section: string; beat: number; note: number; chord: string }[];
  strongTotal: number;
  /** channels referencing a missing instrument */
  missingInst: string[];
  /** per channel: lowest / highest MIDI note */
  ranges: Record<string, [number, number]>;
}

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Krumhansl-Schmuckler key estimate from a duration-weighted pitch-class histogram. */
export function estimateKey(hist: number[]): { key: string; score: number } {
  const corr = (a: number[], b: number[]) => {
    const ma = a.reduce((x, y) => x + y, 0) / 12;
    const mb = b.reduce((x, y) => x + y, 0) / 12;
    let n = 0, da = 0, db2 = 0;
    for (let i = 0; i < 12; i++) {
      n += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) ** 2;
      db2 += (b[i] - mb) ** 2;
    }
    return n / Math.sqrt(da * db2 || 1);
  };
  let best = { key: "?", score: -2 };
  for (let r = 0; r < 12; r++) {
    for (const [prof, q] of [[MAJOR_PROFILE, "major"], [MINOR_PROFILE, "minor"]] as const) {
      const rot = prof.map((_, i) => prof[(i - r + 12) % 12]);
      const c = corr(hist, rot);
      if (c > best.score) best = { key: `${NOTE_NAMES[r]} ${q}`, score: c };
    }
  }
  return best;
}

/** Channel ids of a track (mix analysis). */
export function trackChannels(track: Exclude<MusicTrack, "none">): { id: string; layer: number; inst: string }[] {
  const d = songFor(track).def;
  return d.channels.map((c) => ({ id: c.id, layer: d.layered ? (c.layer ?? 0) : 0, inst: c.inst }));
}

export function analyzeTrack(track: Exclude<MusicTrack, "none">): HarmonyReport {
  const song = songFor(track);
  const def = song.def;
  const spb = 60 / def.bpm;
  const bpb = song.bpb;
  const strongOff: HarmonyReport["strongOff"] = [];
  let strongTotal = 0;
  const ranges: Record<string, [number, number]> = {};
  const seen = new Set<string>();
  const sections: HarmonyReport["sections"] = [];
  const hist = new Array(12).fill(0);
  const mainNames = new Set(song.order.map((s) => s.name));
  const all = [...song.order, ...song.tiers.flatMap((t) => t.order)];
  for (const sec of all) {
    if (seen.has(sec.name)) continue;
    seen.add(sec.name);
    sections.push({ name: sec.name, bars: sec.beats / bpb, events: sec.ev.length });
    for (const e of sec.ev) {
      if (e.d) continue;
      const ch = def.channels[e.ch];
      const r = (ranges[ch.id] ??= [999, -1]);
      r[0] = Math.min(r[0], e.m);
      r[1] = Math.max(r[1], e.m);
      if (mainNames.has(sec.name)) hist[((e.m % 12) + 12) % 12] += e.dur;
      const inBar = e.t % bpb;
      const strong = Math.abs(inBar) < 1e-3 || Math.abs(inBar - bpb / 2) < 1e-3;
      if (!strong || !sec.chords.length) continue;
      const c = sec.chords.find((g) => e.t >= g.t - 1e-6 && e.t < g.end - 1e-6);
      if (!c) continue;
      strongTotal++;
      if (!c.pcs.includes(((e.m % 12) + 12) % 12)) strongOff.push({ channel: ch.id, section: sec.name, beat: e.t, note: e.m, chord: c.sym });
    }
  }
  // bars with nothing at intensity 0 (layered songs drop channels with layer > 0)
  const silentBars: string[] = [];
  const base = (i: number) => !def.layered || (def.channels[i].layer ?? 0) <= 0;
  for (const sec of song.order) {
    for (let b = 0; b < sec.beats / bpb; b++) {
      const on = sec.ev.some((e) => base(e.ch) && e.t < (b + 1) * bpb - 1e-6 && e.t + e.dur > b * bpb + 1e-6);
      if (!on) silentBars.push(`${sec.name}:${b + 1}`);
    }
  }
  const layers: Record<string, number> = {};
  if (def.layered) for (const c of def.channels) if ((c.layer ?? 0) > 0) layers[c.id] = c.layer!;
  const missingInst = def.channels.filter((c) => c.inst !== "drums" && !INST[c.inst]).map((c) => c.id);
  const loopBeats = song.order.slice(Math.max(0, song.loopTo)).reduce((a, s) => a + s.beats, 0);
  const totalBeats = song.order.reduce((a, s) => a + s.beats, 0);
  const k = estimateKey(hist);
  return {
    track, bpm: def.bpm, key: def.key ?? "", detectedKey: k.key, keyScore: k.score,
    loopSeconds: loopBeats * spb, totalSeconds: totalBeats * spb, sections,
    tiers: song.tiers.map((t) => ({ at: t.at, order: t.order.map((s) => s.name) })),
    layers, silentBars, strongOff, strongTotal, missingInst, ranges,
  };
}
