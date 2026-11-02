/**
 * Offline rendering + analysis helpers (used by tools/audio.ts and
 * scripts/audio-render.mjs). Renders through an OfflineAudioContext with the
 * exact same Engine / synthesis code the game uses.
 */
import type { MusicTrack, SfxId, SfxOpts } from "./api";
import { Engine, songFor } from "./engine";
import { SFX } from "./sfx";
import { INST } from "./music/inst";

export const SFX_IDS = Object.keys(SFX) as SfxId[];
export const TRACKS: Exclude<MusicTrack, "none">[] = ["title", "battle", "boss", "final", "victory", "gameover", "shop"];

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

/** Dense combat mix: many sfx over battle music at high intensity (headroom check). */
export async function renderChaos(seconds = 8, sr = 44100): Promise<AudioBuffer> {
  const ctx = offline(seconds, sr);
  const eng = new Engine(ctx);
  let vt = 0;
  eng.clock = () => vt;
  eng.setVolumes(DEFAULT_VOLS);
  eng.setIntensity(1);
  vt = PRE;
  eng.music("battle", 0);
  const spam: SfxId[] = ["hit", "hit", "hitCrit", "enemyDie", "gem", "gem", "starShot", "slash", "explosion", "orbitHit", "bubblePop", "coin"];
  let k = 0;
  for (let s = 0; s < seconds; s += 0.01) {
    vt = PRE + s;
    eng.tick(vt);
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
  sr?: number;
}

/**
 * Render a track like the realtime engine plays it: the OfflineAudioContext is
 * suspended every STEP seconds and the engine schedules just-in-time (same
 * lookahead as realtime). Creating all notes up front would make long renders
 * crawl (every not-yet-started node is still traversed each render quantum).
 */
export async function renderTrack(track: Exclude<MusicTrack, "none">, o: TrackRenderOpts = {}): Promise<AudioBuffer> {
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
  eng.setIntensity(steps[0]?.[1] ?? 1);
  vt = PRE;
  eng.music(track, 0);
  eng.tick(vt);
  let si = 1, mi = 0, switched = false;
  const total = seconds + PRE;
  const at = (t: number) => Math.round(t * sr / 128) * 128 / sr; // suspend times are quantised to render quanta
  const step = (t: number) => {
    vt = t;
    const s = t - PRE;
    while (si < steps.length && steps[si][0] <= s) eng.setIntensity(steps[si++][1]);
    while (mi < muf.length && muf[mi][0] <= s) eng.setMuffled(muf[mi++][1]);
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
  return cut(await ctx.startRendering());
}

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
  loopSeconds: number;
  totalSeconds: number;
  sections: { name: string; bars: number; events: number }[];
  /** melodic notes landing on beats 1/3 of a bar that are not chord tones */
  strongOff: { channel: string; section: string; beat: number; note: number; chord: string }[];
  strongTotal: number;
  /** channels referencing a missing instrument */
  missingInst: string[];
  /** per channel: lowest / highest MIDI note */
  ranges: Record<string, [number, number]>;
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
  for (const sec of song.order) {
    if (seen.has(sec.name)) continue;
    seen.add(sec.name);
    sections.push({ name: sec.name, bars: sec.beats / bpb, events: sec.ev.length });
    for (const e of sec.ev) {
      if (e.d) continue;
      const ch = def.channels[e.ch];
      const r = (ranges[ch.id] ??= [999, -1]);
      r[0] = Math.min(r[0], e.m);
      r[1] = Math.max(r[1], e.m);
      const inBar = e.t % bpb;
      const strong = Math.abs(inBar) < 1e-3 || Math.abs(inBar - bpb / 2) < 1e-3;
      if (!strong || !sec.chords.length) continue;
      const c = sec.chords.find((g) => e.t >= g.t - 1e-6 && e.t < g.end - 1e-6);
      if (!c) continue;
      strongTotal++;
      if (!c.pcs.includes(((e.m % 12) + 12) % 12)) strongOff.push({ channel: ch.id, section: sec.name, beat: e.t, note: e.m, chord: c.sym });
    }
  }
  const missingInst = def.channels.filter((c) => c.inst !== "drums" && !INST[c.inst]).map((c) => c.id);
  const loopBeats = song.order.slice(Math.max(0, song.loopTo)).reduce((a, s) => a + s.beats, 0);
  const totalBeats = song.order.reduce((a, s) => a + s.beats, 0);
  return { track, bpm: def.bpm, loopSeconds: loopBeats * spb, totalSeconds: totalBeats * spb, sections, strongOff, strongTotal, missingInst, ranges };
}
