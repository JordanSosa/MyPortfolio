/**
 * The audio engine for one BaseAudioContext (realtime or offline).
 *
 * Graph:
 *   sfx voices -> [pan] -> sfxIn ----------------------------> sfxVol --\
 *          \-> send -> sfxReverb ----------------------------/          \
 *   music players (dry) ---> musicIn -> musicVol -> muffle LP -> duck ---> masterGain -> master chain -> out
 *   music players (rev) -> musicReverb -/                       (DC block, glue comp, limiter, soft clip: fxchain.ts)
 *   music players (dly) -> pingpong delay -/
 *
 * SFX are rate-limited per id, capped per id and globally (oldest / lowest
 * priority voice is stolen with a short fade). Low-priority gameplay sounds
 * (hits, deaths, gems, coins, weapon shots: pri <= 1 and not `free`, plus the
 * spammy `budget` weapon booms) also share a global new-voice budget
 * (LOW_PER_FRAME per 1/60 s window, LOW_PER_SECOND on average, at most
 * LOW_ID_PER_SECOND of it for any one id): a late-game fight would otherwise
 * build ~1,300 WebAudio nodes a second. UI, level-up, boss, ult, player and
 * telegraph sounds never touch it. A trigger that is rate-limited away instead
 * nudges the id's newest voice up (max +3 dB), so a cluster still sounds bigger.
 * Music is scheduled by Player objects; the engine crossfades between them.
 */
import type { MusicTrack, SfxId, SfxOpts } from "./api";
import { makeDelay, makeMaster, makeReverb, type Delay, type Master, type Reverb } from "./fxchain";
import { Player } from "./music/player";
import { compileSong, type CSong } from "./music/song";
import { SONGS } from "./music/songs";
import { SFX } from "./sfx";
import { kitFor, semis, Voice, type Kit } from "./synth";

export const MAX_VOICES = 24;
/** Global budget for new low-priority voices: per 1/60 s window, and a token bucket per second. */
export const LOW_PER_FRAME = 3;
export const LOW_PER_SECOND = 16;
const LOW_BURST = 8;
/** Fair share inside the budget: one id gets at most LOW_ID_PER_SECOND of it (hits can't starve kill pops). */
export const LOW_ID_PER_SECOND = 4;
const LOW_ID_BURST = 3;
/** `budget` ids (higher-priority weapon booms) skip the shared pool but get at most this many voices per second. */
const BOOM_ID_PER_SECOND = 3;
/** A rate-limited trigger bumps the id's newest voice by this factor, up to +3 dB in total. */
const MERGE_BUMP = 1.12;
const MERGE_MAX = 1.413;
/** |pan| below this plays centred (no StereoPanner node). */
const PAN_MIN = 0.15;
/** music scheduling window (s) */
export const LOOKAHEAD = 0.15;

const BASE = { master: 0.9, music: 2.0, sfx: 2.5 };
const MUFFLE_HZ = 620;

interface Active {
  id: SfxId;
  pri: number;
  start: number;
  end: number;
  out: GainNode;
  srcs: AudioScheduledSourceNode[];
  stolen: boolean;
  /** Initial output gain, and how much merged triggers have raised it (x, <= MERGE_MAX). */
  vol: number;
  bump: number;
}

const compiled = new Map<string, CSong>();
export function songFor(track: Exclude<MusicTrack, "none">): CSong {
  let c = compiled.get(track);
  if (!c) {
    c = compileSong(SONGS[track]);
    compiled.set(track, c);
  }
  return c;
}

const taper = (v: number) => {
  const x = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
  return x * x;
};

export class Engine {
  readonly ctx: BaseAudioContext;
  readonly kit: Kit;
  /** clock override for offline renders */
  clock: () => number;
  private readonly master: Master;
  private readonly masterGain: GainNode;
  private readonly sfxIn: GainNode;
  private readonly sfxVol: GainNode;
  private readonly sfxRev: Reverb;
  private readonly musicIn: GainNode;
  private readonly musicVol: GainNode;
  private readonly musicLP: BiquadFilterNode;
  private readonly duckGain: GainNode;
  private readonly musicRev: Reverb;
  private readonly musicDly: Delay;
  private voices: Active[] = [];
  private last = new Map<SfxId, number>();
  /** Newest voice per id (merge target for rate-limited triggers). */
  private newest = new Map<SfxId, Active>();
  // low-priority budget: current 1/60 s window + token bucket
  private lowWin = -1;
  private lowWinN = 0;
  private lowTokens = LOW_BURST;
  private lowT = 0;
  /** Per-id share of the low-priority budget: [tokens, last refill time]. */
  private lowId = new Map<SfxId, [number, number]>();
  /** Triggers dropped by the low-priority budget, and voices started, per id (debug / probes). */
  readonly budgetDrops: Partial<Record<SfxId, number>> = {};
  readonly started: Partial<Record<SfxId, number>> = {};
  private players: Player[] = [];
  private current: Player | null = null;
  track: MusicTrack = "none";
  private intensity = 0;
  private muffled = false;
  private duckUntil = 0;
  private duckDepth = 1;
  private vols = { master: 1, music: 1, sfx: 1 };

  /** false for OfflineAudioContext renders */
  readonly realtime: boolean;
  /** how far ahead of currentTime sfx are scheduled */
  private readonly ahead: number;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.realtime = typeof OfflineAudioContext === "undefined" || !(ctx instanceof OfflineAudioContext);
    // Mobile browsers render in bursts of several quanta, so `currentTime` seen from the
    // main thread can lag the audio thread. Scheduling a little ahead keeps attacks intact.
    const base = (ctx as AudioContext).baseLatency;
    this.ahead = this.realtime ? Math.min(0.03, Math.max(0.008, Number.isFinite(base) ? base : 0.01)) : 0.006;
    this.kit = kitFor(ctx);
    this.clock = () => ctx.currentTime;
    this.master = makeMaster(ctx);
    this.masterGain = this.master.input;
    this.masterGain.gain.value = BASE.master;

    this.sfxVol = ctx.createGain();
    this.sfxVol.gain.value = BASE.sfx;
    this.sfxVol.connect(this.masterGain);
    this.sfxIn = ctx.createGain();
    this.sfxIn.connect(this.sfxVol);
    // (realtime: the impulses are built in later macrotasks, so the unlock gesture stays short)
    this.sfxRev = makeReverb(ctx, this.sfxVol, 1.1, 2.2, 0.55, 0.7, 7, this.realtime ? 30 : -1);

    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.masterGain);
    this.musicLP = ctx.createBiquadFilter();
    this.musicLP.type = "lowpass";
    this.musicLP.frequency.value = this.openHz;
    this.musicLP.Q.value = 0.9;
    this.musicLP.connect(this.duckGain);
    this.musicVol = ctx.createGain();
    this.musicVol.gain.value = BASE.music;
    this.musicVol.connect(this.musicLP);
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.musicVol);
    this.musicRev = makeReverb(ctx, this.musicIn, 1.8, 2.4, 0.75, 0.55, 3, this.realtime ? 60 : -1);
    this.musicDly = makeDelay(ctx, this.musicIn, 0.3, 0.38, 0.55);
  }

  now(): number {
    return this.clock();
  }

  /** "fully open" cutoff for the muffle low-pass */
  private get openHz(): number {
    return Math.min(20000, this.ctx.sampleRate * 0.45);
  }

  // ---------------------------------------------------------------- sfx

  private prune(now: number): void {
    const vs = this.voices;
    for (let i = vs.length - 1; i >= 0; i--) {
      if (vs[i].end <= now) {
        vs[i] = vs[vs.length - 1];
        vs.pop();
      }
    }
  }

  private steal(a: Active, now: number): void {
    if (a.stolen) return;
    a.stolen = true;
    const g = a.out.gain;
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.018);
    } catch {
      /* ignore */
    }
    for (const s of a.srcs) {
      try {
        s.stop(now + 0.025);
      } catch {
        /* old WebKit throws on a second stop() */
      }
    }
    a.end = now + 0.03;
    const i = this.voices.indexOf(a);
    if (i >= 0) this.voices.splice(i, 1);
  }

  /** Play a sound now (or at `at`). Returns the time it ends, or -1 when dropped. */
  sfx(id: SfxId, opts: SfxOpts = {}, at?: number): number {
    const def = SFX[id];
    if (!def) return -1;
    const now = this.now();
    const t0 = at ?? now + this.ahead;
    this.prune(now);
    const pri = def.pri ?? 1;
    const lastT = this.last.get(id);
    if (lastT !== undefined && t0 - lastT < (def.gap ?? 0.02) && t0 >= lastT) {
      this.merge(id, now);
      return -1;
    }
    // global new-voice budget for low-priority gameplay sounds (UI / boss / player sounds bypass it)
    if ((def.budget || (pri <= 1 && !def.free)) && !this.lowBudget(id, t0, !!def.budget)) {
      this.budgetDrops[id] = (this.budgetDrops[id] ?? 0) + 1;
      this.merge(id, now);
      return -1;
    }
    const max = def.max ?? 3;
    let same = 0;
    let oldestSame: Active | null = null;
    for (const a of this.voices) {
      if (a.id !== id) continue;
      same++;
      if (!oldestSame || a.start < oldestSame.start) oldestSame = a;
    }
    if (same >= max && oldestSame) this.steal(oldestSame, now);
    if (this.voices.length >= MAX_VOICES) {
      let victim: Active | null = null;
      for (const a of this.voices) {
        if (!victim || a.pri < victim.pri || (a.pri === victim.pri && a.start < victim.start)) victim = a;
      }
      if (!victim || victim.pri > pri) return -1;
      this.steal(victim, now);
    }
    this.last.set(id, t0);

    const ctx = this.ctx;
    const vol = Math.max(0, Math.min(2, opts.vol ?? 1)) * (def.vol ?? 0.7);
    if (vol <= 0.0001) return -1;
    const out = ctx.createGain();
    out.gain.value = vol;
    const pan = opts.pan ?? 0;
    if (Math.abs(pan) >= PAN_MIN && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(p).connect(this.sfxIn);
    } else out.connect(this.sfxIn);
    if (def.rev) {
      const s = ctx.createGain();
      s.gain.value = def.rev;
      out.connect(s).connect(this.sfxRev.input);
    }
    const spread = def.rnd ? (Math.random() * 2 - 1) * def.rnd : 0;
    const p = semis(Math.max(-36, Math.min(36, (opts.pitch ?? 0) + spread)));
    const v = new Voice(this.kit, out, t0);
    try {
      def.play(v, p, opts);
    } catch (e) {
      // a bad automation value must never take the game down
      console.warn(`[audio] sfx ${id} failed`, e);
    }
    const a: Active = { id, pri, start: t0, end: v.end + 0.02, out, srcs: v.srcs, stolen: false, vol, bump: 1 };
    this.voices.push(a);
    this.newest.set(id, a);
    this.started[id] = (this.started[id] ?? 0) + 1;
    return v.end;
  }

  /**
   * Take a slot from the low-priority budget for `id` at time t (false = over budget).
   * `boom` ids only use their own (smaller) per-id share, never the shared pool.
   */
  private lowBudget(id: SfxId, t: number, boom: boolean): boolean {
    const win = Math.floor(t * 60);
    if (win !== this.lowWin) {
      this.lowWin = win;
      this.lowWinN = 0;
    }
    if (t > this.lowT) {
      this.lowTokens = Math.min(LOW_BURST, this.lowTokens + (t - this.lowT) * LOW_PER_SECOND);
      this.lowT = t;
    }
    let b = this.lowId.get(id);
    if (!b) {
      b = [LOW_ID_BURST, t];
      this.lowId.set(id, b);
    } else if (t > b[1]) {
      b[0] = Math.min(LOW_ID_BURST, b[0] + (t - b[1]) * (boom ? BOOM_ID_PER_SECOND : LOW_ID_PER_SECOND));
      b[1] = t;
    }
    if (boom) {
      if (b[0] < 1) return false;
      b[0] -= 1;
      return true;
    }
    if (this.lowWinN >= LOW_PER_FRAME || this.lowTokens < 1 || b[0] < 1) return false;
    this.lowWinN++;
    this.lowTokens -= 1;
    b[0] -= 1;
    return true;
  }

  /** A trigger merged into the id's newest still-playing voice: a little louder (max +3 dB), no new nodes. */
  private merge(id: SfxId, now: number): void {
    const a = this.newest.get(id);
    if (!a || a.stolen || a.end <= now || a.bump >= MERGE_MAX) return;
    a.bump = Math.min(MERGE_MAX, a.bump * MERGE_BUMP);
    try {
      a.out.gain.value = a.vol * a.bump;
    } catch {
      /* ignore */
    }
  }

  get activeVoices(): number {
    this.prune(this.now());
    return this.voices.length;
  }

  // ---------------------------------------------------------------- music

  music(track: MusicTrack, fade = 1): void {
    if (track === this.track) return;
    this.track = track;
    const now = this.now();
    const prev = this.current;
    const f = Math.max(0, Number.isFinite(fade) ? fade : 1);
    if (prev) prev.fadeOut(now, f);
    this.current = null;
    if (track === "none") return;
    const song = songFor(track);
    // let the old track dip first so the new downbeat lands clean
    const start = now + 0.05 + (prev ? Math.min(f * 0.45, 1.2) : 0);
    const p = new Player(this.kit, song, { dry: this.musicIn, rev: this.musicRev.input, dly: this.musicDly.input }, start, prev ? 0.08 : 0.02, this.intensity);
    this.musicDly.setTime(p.delaySeconds, start);
    this.players.push(p);
    this.current = p;
    p.update(now, now + LOOKAHEAD);
  }

  /** Advance music scheduling; call every ~25 ms (realtime) or stepwise (offline). */
  tick(now = this.now()): void {
    const horizon = now + LOOKAHEAD;
    for (let i = this.players.length - 1; i >= 0; i--) {
      const p = this.players[i];
      p.update(now, horizon);
      const dead = (p !== this.current && now > p.stopAt + 0.3) || (p.finished && now > p.doneAt + 8);
      if (dead) {
        // Offline renders build the whole graph before rendering: disconnecting would
        // silence the player for the entire render, so only realtime engines dispose.
        if (this.realtime) p.dispose();
        this.players.splice(i, 1);
        if (p === this.current) this.current = null;
      }
    }
  }

  setIntensity(x: number): void {
    this.intensity = Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
    this.current?.setIntensity(this.intensity);
  }

  /** Series-finale "budget cuts" for the current track (only songs with a `degrade` arrangement react). */
  setDegrade(x: number): void {
    this.current?.setDegrade(Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0)), this.now());
  }

  /** Mix analysis: play only channel `id` of the current track (null = all). Not used by the game. */
  soloChannel(id: string | null): void {
    const p = this.current;
    if (!p) return;
    for (const c of p.channelIds) p.setChannelGain(c, id === null || c === id ? 1 : 0);
  }

  /** Degrade value the current track is playing with right now (meters / tests). */
  get degrade(): number {
    return this.current?.degAt(this.now()) ?? 0;
  }

  setMuffled(on: boolean): void {
    if (on === this.muffled) return;
    this.muffled = on;
    const now = this.now();
    const f = this.musicLP.frequency;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    // closes quickly (most of the sweep happens in the first ~0.2 s), reopens a bit slower
    f.setTargetAtTime(on ? MUFFLE_HZ : this.openHz, now, on ? 0.09 : 0.18);
    this.applyMusicVol(now);
  }

  duck(amount: number, seconds: number): void {
    const now = this.now();
    const depth = Math.max(0.05, Math.min(1, 1 - (Number.isFinite(amount) ? amount : 0)));
    const until = now + Math.max(0.05, Number.isFinite(seconds) ? seconds : 0.5);
    const active = now < this.duckUntil;
    const newDepth = active ? Math.min(depth, this.duckDepth) : depth;
    const newUntil = active ? Math.max(until, this.duckUntil) : until;
    if (active && newDepth === this.duckDepth && newUntil === this.duckUntil) return;
    this.duckDepth = newDepth;
    this.duckUntil = newUntil;
    const g = this.duckGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(newDepth, now, 0.025);
    g.setTargetAtTime(1, newUntil, 0.28);
  }

  setVolumes(v: { master?: number; music?: number; sfx?: number }): void {
    const now = this.now();
    if (v.master !== undefined) {
      this.vols.master = v.master;
      this.masterGain.gain.setTargetAtTime(taper(v.master) * BASE.master, now, 0.03);
    }
    if (v.sfx !== undefined) {
      this.vols.sfx = v.sfx;
      this.sfxVol.gain.setTargetAtTime(taper(v.sfx) * BASE.sfx, now, 0.03);
    }
    if (v.music !== undefined) {
      this.vols.music = v.music;
      this.applyMusicVol(now);
    }
  }

  private applyMusicVol(now: number): void {
    this.musicVol.gain.setTargetAtTime(taper(this.vols.music) * BASE.music * (this.muffled ? 0.7 : 1), now, 0.06);
  }

  /** An AnalyserNode fed by the final output (test bench meters). */
  tap(fft = 2048): AnalyserNode {
    const a = this.ctx.createAnalyser();
    a.fftSize = fft;
    this.master.output.connect(a);
    return a;
  }

  /** Gain reduction of the glue compressor and limiter in dB (meters). */
  get reduction(): { comp: number; limiter: number } {
    return { comp: this.master.comp.reduction, limiter: this.master.limiter.reduction };
  }

  /** Name of the section the current track is scheduling. */
  get section(): string {
    return this.current?.cursor.section ?? "";
  }

  /** Stop everything immediately (tests / page teardown). */
  stopAll(): void {
    const now = this.now();
    for (const a of [...this.voices]) this.steal(a, now);
    for (const p of this.players) p.fadeOut(now, 0.05);
    this.current = null;
    this.track = "none";
  }
}
