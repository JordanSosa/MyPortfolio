/**
 * Low-level synthesis toolkit shared by the SFX and the music instruments.
 *
 * Everything is built from stock WebAudio nodes (oscillators, band-limited
 * PeriodicWaves, looping noise buffers, biquads, wave shapers) scheduled with
 * sample-accurate automation, so the same code runs in a realtime AudioContext
 * and in an OfflineAudioContext (scripts/audio-render.mjs).
 *
 * Rules every generator follows (no clicks, no leaks):
 *  - every gain envelope starts at 0 and returns to exactly 0 before the source stops;
 *  - attack is never shorter than ~1 ms;
 *  - every source is started and stopped, and nothing long-lived holds a reference
 *    to per-note nodes, so finished voices are garbage collected.
 */

export type WaveName =
  | "sine"
  | "square"
  | "sawtooth"
  | "triangle"
  /** 25 % pulse - the classic chiptune lead */
  | "p25"
  /** 12.5 % pulse - thin, nasal */
  | "p12"
  /** soft (low-passed) square */
  | "soft"
  /** sine + few harmonics, organ / flute-ish */
  | "organ"
  /** bright, buzzy (saw with a stronger upper end) */
  | "buzz";

/**
 * Per-context shared resources (noise buffers, periodic waves, curves). The
 * looping noise buffers are generated on first use (not inside the unlock gesture).
 */
export interface Kit {
  ctx: BaseAudioContext;
  readonly white: AudioBuffer;
  readonly pink: AudioBuffer;
  waves: Map<string, PeriodicWave>;
  curves: Map<string, Float32Array<ArrayBuffer>>;
}

const kits = new WeakMap<BaseAudioContext, Kit>();

class LazyKit implements Kit {
  waves = new Map<string, PeriodicWave>();
  curves = new Map<string, Float32Array<ArrayBuffer>>();
  private w: AudioBuffer | null = null;
  private p: AudioBuffer | null = null;
  constructor(readonly ctx: BaseAudioContext) {}
  get white(): AudioBuffer {
    return (this.w ??= makeNoise(this.ctx, false));
  }
  get pink(): AudioBuffer {
    return (this.p ??= makeNoise(this.ctx, true));
  }
}

export function kitFor(ctx: BaseAudioContext): Kit {
  let k = kits.get(ctx);
  if (!k) {
    k = new LazyKit(ctx);
    kits.set(ctx, k);
  }
  return k;
}

/** Looping noise length (s): a 1 s loop is inaudible as a loop under the envelopes. */
const NOISE_SECONDS = 1;

function makeNoise(ctx: BaseAudioContext, pink: boolean): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // tiny deterministic LCG so offline renders are reproducible
  let s = pink ? 0x2545f491 : 0x9e3779b9;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296 * 2 - 1;
  };
  if (!pink) {
    for (let i = 0; i < len; i++) d[i] = rnd();
  } else {
    // Paul Kellet's economy pink filter
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd();
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  }
  // remove DC and make the loop seam continuous (fade the last 64 samples into the first)
  let mean = 0;
  for (let i = 0; i < len; i++) mean += d[i];
  mean /= len;
  for (let i = 0; i < len; i++) d[i] -= mean;
  const X = 64;
  for (let i = 0; i < X; i++) {
    const k = i / X;
    d[len - X + i] = d[len - X + i] * (1 - k) + d[i] * k;
  }
  return buf;
}

/** Band-limited periodic wave for the custom wave names (cached per context). */
export function periodic(kit: Kit, name: WaveName): PeriodicWave | null {
  if (name === "sine" || name === "square" || name === "sawtooth" || name === "triangle") return null;
  let w = kit.waves.get(name);
  if (w) return w;
  const N = 48;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    switch (name) {
      case "p25":
      case "p12": {
        const duty = name === "p25" ? 0.25 : 0.125;
        // pulse train (cosine series), gently rolled off at the top to tame harshness
        re[n] = ((2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)) * (1 / (1 + (n / 40) ** 2));
        break;
      }
      case "soft":
        if (n % 2 === 1) im[n] = (1 / n) * Math.exp(-n / 9);
        break;
      case "organ":
        im[n] = n === 1 ? 1 : n === 2 ? 0.5 : n === 3 ? 0.32 : n === 4 ? 0.12 : n === 6 ? 0.06 : 0;
        break;
      case "buzz":
        im[n] = (1 / Math.pow(n, 0.8)) * (n % 2 ? 1 : 0.7);
        break;
    }
  }
  try {
    w = kit.ctx.createPeriodicWave(re, im, { disableNormalization: false });
  } catch {
    w = kit.ctx.createPeriodicWave(re, im); // old WebKit: no constraints argument
  }
  kit.waves.set(name, w);
  return w;
}

/** Shared wave-shaper curves. */
export function curve(kit: Kit, name: "soft" | "drive" | "crush" | "clip" | "lofi"): Float32Array<ArrayBuffer> {
  let c = kit.curves.get(name);
  if (c) return c;
  const n = 2048;
  c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    switch (name) {
      case "soft":
        c[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
        break;
      case "drive":
        c[i] = Math.tanh(x * 4) / Math.tanh(4);
        break;
      case "crush": {
        const s = Math.tanh(x * 6) / Math.tanh(6);
        c[i] = Math.round(s * 7) / 7;
        break;
      }
      case "lofi": {
        // "budget" bitcrush: ~4-bit staircase, no extra drive (cancel's degrade chain, glitch sfx)
        c[i] = Math.round(x * 10) / 10;
        break;
      }
      case "clip": {
        // transparent below 0.75, smooth knee up to 0.98 (final safety clipper)
        const a = Math.abs(x);
        const knee = 0.75;
        const y = a <= knee ? a : knee + (0.98 - knee) * Math.tanh((a - knee) / (0.98 - knee));
        c[i] = Math.sign(x) * y;
        break;
      }
    }
  }
  kit.curves.set(name, c);
  return c;
}

export const EPS = 0.0001;

/** Sources (oscillators / noise buffers) started so far - a CPU-cost proxy for the offline perf report. */
export const synthStats = { sources: 0 };

export function mtof(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function semis(s: number): number {
  return Math.pow(2, s / 12);
}

/**
 * Schedules an ADSR on `g` (which must be untouched before). Returns the time the
 * envelope reaches exactly 0.
 *  s <= 0 -> percussive: attack, hold, exponential decay of length d to silence.
 *  s > 0  -> attack, hold, decay to s*peak over d, sustain until t+len, release r.
 */
export function adsr(
  g: AudioParam,
  t: number,
  peak: number,
  a: number,
  h: number,
  d: number,
  s: number,
  len: number,
  r: number,
): number {
  peak = Math.max(peak, EPS * 2);
  a = Math.max(a, 0.001);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + a);
  let tt = t + a;
  if (h > 0) {
    tt += h;
    g.setValueAtTime(peak, tt);
  }
  if (s <= 0) {
    const te = tt + Math.max(d, 0.004);
    g.exponentialRampToValueAtTime(EPS, te);
    g.linearRampToValueAtTime(0, te + 0.003);
    return te + 0.003;
  }
  const sus = Math.max(peak * Math.min(s, 1), EPS * 2);
  const tRel = Math.max(t + len, tt + 0.002);
  const tDec = Math.min(tt + Math.max(d, 0.002), tRel);
  if (s < 1) g.exponentialRampToValueAtTime(sus, tDec);
  g.setValueAtTime(s < 1 ? sus : peak, tRel);
  const tEnd = tRel + Math.max(r, 0.006);
  g.exponentialRampToValueAtTime(EPS, tEnd);
  g.linearRampToValueAtTime(0, tEnd + 0.003);
  return tEnd + 0.003;
}

/** Glide an AudioParam (frequency-like, must stay > 0) from a to b over dt. `max` clamps (Nyquist). */
export function glide(p: AudioParam, t: number, a: number, b: number | undefined, dt: number, lin = false, max = 20000): void {
  a = Math.min(Math.max(a, 1), max);
  p.setValueAtTime(a, t);
  if (b !== undefined && b !== a && dt > 0) {
    b = Math.min(Math.max(b, 1), max);
    if (lin) p.linearRampToValueAtTime(b, t + dt);
    else p.exponentialRampToValueAtTime(b, t + dt);
  }
}

export interface EnvOpts {
  /** offset (s) from the voice's t0 */
  t?: number;
  /** peak gain */
  v?: number;
  a?: number;
  h?: number;
  /** decay time (to silence when s=0) */
  d?: number;
  /** sustain level 0..1 (0 = percussive) */
  s?: number;
  /** time until release (sustained envelopes) */
  len?: number;
  r?: number;
  /** destination (defaults to the voice output) */
  out?: AudioNode;
  /** constant-power stereo pan of this component only (-1..1) */
  pan?: number;
}

export interface FilterOpts {
  /** low-pass cutoff (start) */
  lp?: number;
  /** low-pass end cutoff */
  lp2?: number;
  /** low-pass sweep time (default: the envelope decay) */
  lpt?: number;
  hp?: number;
  hp2?: number;
  hpt?: number;
  bp?: number;
  bp2?: number;
  bpt?: number;
  q?: number;
  /** wave-shaper drive after the source */
  drive?: "soft" | "drive" | "crush" | "lofi";
}

export interface ToneOpts extends EnvOpts, FilterOpts {
  w?: WaveName;
  f: number;
  /** glide target frequency */
  f2?: number;
  /** glide time (default = d) */
  gt?: number;
  /** linear (instead of exponential) glide */
  lin?: boolean;
  /** detune cents */
  det?: number;
  /** vibrato depth (cents), rate (Hz), onset delay (s) */
  vib?: number;
  vr?: number;
  vd?: number;
  /** tremolo depth 0..1, rate Hz */
  trem?: number;
  tr?: number;
}

export interface NoiseOpts extends EnvOpts, FilterOpts {
  pink?: boolean;
  /** playback rate (darker < 1 < brighter-ish) */
  rate?: number;
  /** random amplitude crackle: rate of square-ish gating (Hz) */
  crackle?: number;
}

export interface FmOpts extends EnvOpts, FilterOpts {
  f: number;
  f2?: number;
  gt?: number;
  /** modulator / carrier frequency ratio */
  ratio: number;
  /** modulation index (start) */
  idx: number;
  /** modulation index (end) */
  idx2?: number;
  /** index sweep time (default d) */
  it?: number;
  w?: WaveName;
  mw?: WaveName;
  det?: number;
  vib?: number;
  vr?: number;
  vd?: number;
}

export interface FormantOpts extends EnvOpts {
  f: number;
  /** pitch contour: [timeFraction, semitoneOffset][] */
  pc?: [number, number][];
  /** vowel contour: [timeFraction, F1, F2][] */
  vc: [number, number, number][];
  w?: WaveName;
  q?: number;
  vib?: number;
  vr?: number;
}

/**
 * A voice = a group of sources rendered into one output node starting at t0.
 * The engine keeps the source list for voice stealing.
 */
export class Voice {
  readonly ctx: BaseAudioContext;
  readonly srcs: AudioScheduledSourceNode[] = [];
  /** absolute time the last component finishes */
  end: number;

  constructor(
    readonly kit: Kit,
    readonly out: AudioNode,
    readonly t0: number,
  ) {
    this.ctx = kit.ctx;
    this.end = t0;
  }

  private track(src: AudioScheduledSourceNode, start: number, stop: number): void {
    synthStats.sources++;
    src.start(start);
    src.stop(stop + 0.01);
    this.srcs.push(src);
    if (stop > this.end) this.end = stop;
  }

  osc(w: WaveName, f: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    const pw = periodic(this.kit, w);
    if (pw) o.setPeriodicWave(pw);
    else o.type = w as OscillatorType;
    o.frequency.value = Math.min(Math.max(f, 1), this.nyq);
    return o;
  }

  /** highest frequency we let an oscillator / filter reach */
  get nyq(): number {
    return this.ctx.sampleRate * 0.45;
  }

  /** Chain optional filters/drive after `src`; returns the last node. */
  private chain(src: AudioNode, o: FilterOpts, t: number, defT: number): AudioNode {
    let n = src;
    const ctx = this.ctx;
    if (o.drive) {
      const ws = ctx.createWaveShaper();
      ws.curve = curve(this.kit, o.drive);
      n.connect(ws);
      n = ws;
    }
    const q = o.q ?? 0.7;
    if (o.hp) {
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.Q.value = 0.7;
      glide(f.frequency, t, o.hp, o.hp2, o.hpt ?? defT, false, this.nyq);
      n.connect(f);
      n = f;
    }
    if (o.bp) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = q;
      glide(f.frequency, t, o.bp, o.bp2, o.bpt ?? defT, false, this.nyq);
      n.connect(f);
      n = f;
    }
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = o.bp ? 0.7 : q;
      glide(f.frequency, t, o.lp, o.lp2, o.lpt ?? defT, false, this.nyq);
      n.connect(f);
      n = f;
    }
    return n;
  }

  private dest(o: EnvOpts): AudioNode {
    const out = o.out ?? this.out;
    if (o.pan === undefined || o.pan === 0 || !this.ctx.createStereoPanner) return out;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    p.connect(out);
    return p;
  }

  private envGain(o: EnvOpts, t: number, defV: number): { g: GainNode; end: number } {
    const g = this.ctx.createGain();
    const end = adsr(g.gain, t, o.v ?? defV, o.a ?? 0.002, o.h ?? 0, o.d ?? 0.2, o.s ?? 0, o.len ?? 0, o.r ?? 0.05);
    return { g, end };
  }

  private vibrato(target: AudioParam, t: number, end: number, depth: number, rate: number, delay: number): void {
    const l = this.ctx.createOscillator();
    l.frequency.value = rate;
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.setValueAtTime(0, t + delay);
    lg.gain.linearRampToValueAtTime(depth, t + delay + 0.12);
    l.connect(lg).connect(target);
    this.track(l, t, end);
  }

  /** Oscillator with pitch glide, filters and an ADSR. Returns the absolute end time. */
  tone(o: ToneOpts): number {
    const t = this.t0 + (o.t ?? 0);
    const src = this.osc(o.w ?? "square", o.f);
    const dec = o.d ?? 0.2;
    glide(src.frequency, t, o.f, o.f2, o.gt ?? dec, o.lin, this.nyq);
    if (o.det) src.detune.value = o.det;
    const { g, end } = this.envGain(o, t, 0.2);
    if (o.vib) this.vibrato(src.detune, t, end, o.vib, o.vr ?? 6, o.vd ?? 0.12);
    let tail: AudioNode = g;
    if (o.trem) {
      const tg = this.ctx.createGain();
      tg.gain.value = 1 - o.trem * 0.5;
      const l = this.ctx.createOscillator();
      l.frequency.value = o.tr ?? 8;
      const lg = this.ctx.createGain();
      lg.gain.value = o.trem * 0.5;
      l.connect(lg).connect(tg.gain);
      this.track(l, t, end);
      g.connect(tg);
      tail = tg;
    }
    this.chain(src, o, t, dec).connect(g);
    tail.connect(this.dest(o));
    this.track(src, t, end);
    return end;
  }

  /** Filtered noise burst. */
  noise(o: NoiseOpts): number {
    const t = this.t0 + (o.t ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = o.pink ? this.kit.pink : this.kit.white;
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    const dec = o.d ?? 0.2;
    const { g, end } = this.envGain(o, t, 0.2);
    let tail: AudioNode = g;
    if (o.crackle) {
      // random-ish gating: a square LFO at an irrational ratio with a second one
      const cg = this.ctx.createGain();
      cg.gain.value = 0.5;
      for (const [rate, depth] of [
        [o.crackle, 0.35],
        [o.crackle * 1.618, 0.25],
      ] as const) {
        const l = this.ctx.createOscillator();
        l.type = "square";
        l.frequency.value = rate;
        const lg = this.ctx.createGain();
        lg.gain.value = depth;
        l.connect(lg).connect(cg.gain);
        this.track(l, t, end);
      }
      g.connect(cg);
      tail = cg;
    }
    this.chain(src, o, t, dec).connect(g);
    tail.connect(this.dest(o));
    // random start offset so repeated bursts never sound identical
    synthStats.sources++;
    src.start(t, Math.random() * 1.5);
    src.stop(end + 0.01);
    this.srcs.push(src);
    if (end > this.end) this.end = end;
    return end;
  }

  /** 2-operator FM (bells, e-piano, metallic shings). */
  fm(o: FmOpts): number {
    const t = this.t0 + (o.t ?? 0);
    const dec = o.d ?? 0.4;
    const car = this.osc(o.w ?? "sine", o.f);
    const mod = this.osc(o.mw ?? "sine", o.f * o.ratio);
    glide(car.frequency, t, o.f, o.f2, o.gt ?? dec, false, this.nyq);
    glide(mod.frequency, t, o.f * o.ratio, o.f2 !== undefined ? o.f2 * o.ratio : undefined, o.gt ?? dec, false, this.nyq);
    if (o.det) {
      car.detune.value = o.det;
      mod.detune.value = o.det;
    }
    const mg = this.ctx.createGain();
    const i0 = Math.max(o.idx * o.f * o.ratio, 0.01);
    const i1 = Math.max((o.idx2 ?? o.idx * 0.1) * o.f * o.ratio, 0.01);
    mg.gain.setValueAtTime(i0, t);
    mg.gain.exponentialRampToValueAtTime(i1, t + (o.it ?? dec));
    mod.connect(mg).connect(car.frequency);
    const { g, end } = this.envGain(o, t, 0.2);
    if (o.vib) this.vibrato(car.detune, t, end, o.vib, o.vr ?? 6, o.vd ?? 0.15);
    this.chain(car, o, t, dec).connect(g);
    g.connect(this.dest(o));
    this.track(car, t, end);
    this.track(mod, t, end);
    return end;
  }

  /** Source through two moving band-pass formants (voices, meows). */
  formant(o: FormantOpts): number {
    const t = this.t0 + (o.t ?? 0);
    const len = o.len ?? 0.2;
    const src = this.osc(o.w ?? "sawtooth", o.f);
    // pitch contour
    const fq = (x: number) => Math.min(x, this.nyq);
    src.frequency.setValueAtTime(fq(o.f * semis(o.pc?.[0]?.[1] ?? 0)), t);
    if (o.pc) for (const [k, st] of o.pc) src.frequency.linearRampToValueAtTime(fq(o.f * semis(st)), t + k * len);
    const { g, end } = this.envGain({ ...o, s: o.s ?? 0.8, d: o.d ?? 0.05 }, t, 0.2);
    if (o.vib) this.vibrato(src.detune, t, end, o.vib, o.vr ?? 7, 0.05);
    const q = o.q ?? 7;
    const mix = this.ctx.createGain();
    mix.gain.value = 1;
    for (let k = 0; k < 2; k++) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = k === 0 ? q : q * 1.3;
      const p = bp.frequency;
      p.setValueAtTime(o.vc[0][1 + k], t);
      for (const pt of o.vc) p.linearRampToValueAtTime(pt[1 + k], t + pt[0] * len);
      const fg = this.ctx.createGain();
      fg.gain.value = k === 0 ? 1.6 : 1.1;
      src.connect(bp).connect(fg).connect(mix);
    }
    mix.connect(g);
    g.connect(this.dest(o));
    this.track(src, t, end);
    return end;
  }

  /** A sub-bus with its own (optionally swept) filter, for shaping several components together. */
  filter(type: BiquadFilterType, f: number, f2?: number, dt = 0.2, q = 0.7, t = 0): BiquadFilterNode {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.Q.value = q;
    glide(b.frequency, this.t0 + t, f, f2, dt, false, this.nyq);
    b.connect(this.out);
    return b;
  }

  /** A sub-bus gain (e.g. to pan or level a group of components). */
  bus(gain = 1, pan = 0): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.out);
    } else g.connect(this.out);
    return g;
  }
}
