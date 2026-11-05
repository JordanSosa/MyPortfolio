/**
 * Frame profiler (always on, in every build: Settings "Copy diagnostics" reads it).
 *
 * Cost: one performance.now() per phase (7 per frame) and a few typed-array
 * stores; nothing allocates per frame. App.frame drives it:
 *
 *   prof.begin(t0)              frame start
 *   prof.lap(PH.sim)            time since the previous mark goes to that phase
 *   prof.end(rawDt, cpuMs, enemies, particles, sprites)
 *
 * Phases (CPU time on the main thread):
 *   ui   input, App logic, hub / modal per-frame updates (DOM)
 *   sim  Session.tick: World.step sub-steps, camera, feedback bridge
 *   view WorldView.draw (sprite batch build) + Renderer.beginFrame
 *   fx   particles / juice / numbers update + draw
 *   gpu  Renderer.endFrame (WebGL submission: upload, passes, composite; 0 = no draw this frame)
 *   hud  in-run DOM HUD update
 *
 * Two stores: a ring of the last RING frames (percentiles, the console graph)
 * and 60 one-second buckets (frame-time histogram, peaks) for "the last 60 s".
 */

export const PH = { ui: 0, sim: 1, view: 2, fx: 3, gpu: 4, hud: 5 } as const;
export const PHASES = ["ui", "sim", "view", "fx", "gpu", "hud"] as const;
export type PhaseName = (typeof PHASES)[number];
/** Frame-time histogram bucket upper edges (ms); the last bucket is everything slower. */
export const HIST_EDGES = [8.5, 17, 20, 25, 34, 50, 100] as const;
export const HIST_LABELS = ["≤8", "≤17", "≤20", "≤25", "≤33", "≤50", "≤100", ">100"] as const;

const RING = 2048;
const SECS = 60;
const NB = HIST_EDGES.length + 1;
const NP = PHASES.length;

export interface Percentiles {
  p50: number;
  p95: number;
  max: number;
  avg: number;
}

export interface WindowStats {
  /** Seconds covered (<= 60) and frames in them. */
  seconds: number;
  frames: number;
  fps: number;
  hist: number[];
  worstMs: number;
  peakEnemies: number;
  peakParticles: number;
  peakSprites: number;
}

class FrameProfiler {
  /** Frames recorded since boot. */
  frames = 0;
  /** Real frame interval (ms), total CPU (ms) and per-phase CPU (ms), ring of the last RING frames. */
  readonly dt = new Float32Array(RING);
  readonly cpu = new Float32Array(RING);
  readonly ph: Float32Array[] = PHASES.map(() => new Float32Array(RING));
  readonly enemies = new Uint16Array(RING);
  readonly particles = new Uint16Array(RING);
  private head = 0;
  private t = 0;
  private readonly acc = new Float64Array(NP);
  // one-second buckets
  private readonly secHist = new Uint32Array(SECS * NB);
  private readonly secFrames = new Uint32Array(SECS);
  private readonly secWorst = new Float32Array(SECS);
  private readonly secEnemies = new Uint16Array(SECS);
  private readonly secParticles = new Uint16Array(SECS);
  private readonly secSprites = new Uint32Array(SECS);
  private sec = -1;
  private slot = 0;
  private secsSeen = 0;

  begin(now = performance.now()): void {
    this.t = now;
    const a = this.acc;
    for (let i = 0; i < NP; i++) a[i] = 0;
  }

  lap(phase: number): void {
    const n = performance.now();
    this.acc[phase] += n - this.t;
    this.t = n;
  }

  /** Close the frame: rawDt = real frame interval (s), cpuMs = total frame CPU. */
  end(rawDt: number, cpuMs: number, enemies: number, particles: number, sprites = 0): void {
    const i = this.head;
    const dtMs = rawDt * 1000;
    this.dt[i] = dtMs;
    this.cpu[i] = cpuMs;
    for (let k = 0; k < NP; k++) this.ph[k][i] = this.acc[k];
    this.enemies[i] = enemies > 65535 ? 65535 : enemies;
    this.particles[i] = particles > 65535 ? 65535 : particles;
    this.head = (i + 1) % RING;
    this.frames++;
    // one-second buckets (wall clock)
    const s = Math.floor(performance.now() / 1000);
    if (s !== this.sec) this.roll(s);
    const sl = this.slot;
    this.secFrames[sl]++;
    let b = 0;
    while (b < HIST_EDGES.length && dtMs > HIST_EDGES[b]) b++;
    this.secHist[sl * NB + b]++;
    if (dtMs > this.secWorst[sl]) this.secWorst[sl] = dtMs;
    if (enemies > this.secEnemies[sl]) this.secEnemies[sl] = Math.min(65535, enemies);
    if (particles > this.secParticles[sl]) this.secParticles[sl] = Math.min(65535, particles);
    if (sprites > this.secSprites[sl]) this.secSprites[sl] = sprites;
  }

  private roll(s: number): void {
    // clear every second skipped since the last frame (hidden tab, step mode), at most the whole window
    const gap = this.sec < 0 ? 1 : Math.min(SECS, Math.max(1, s - this.sec));
    for (let k = 0; k < gap; k++) {
      this.slot = (this.slot + 1) % SECS;
      const sl = this.slot;
      this.secFrames[sl] = 0;
      this.secWorst[sl] = 0;
      this.secEnemies[sl] = 0;
      this.secParticles[sl] = 0;
      this.secSprites[sl] = 0;
      this.secHist.fill(0, sl * NB, sl * NB + NB);
    }
    this.secsSeen = Math.min(SECS, this.secsSeen + gap);
    this.sec = s;
  }

  /** Number of frames held in the ring. */
  get held(): number {
    return Math.min(this.frames, RING);
  }

  /** Copy the newest `n` values of a ring channel, oldest first. */
  recent(ch: Float32Array | Uint16Array, n = this.held, out?: Float32Array): Float32Array {
    const k = Math.min(n, this.held);
    const o = out && out.length >= k ? out : new Float32Array(k);
    let j = (this.head - k + RING) % RING;
    for (let i = 0; i < k; i++) {
      o[i] = ch[j];
      j = (j + 1) % RING;
    }
    return o;
  }

  /** p50 / p95 / max / avg of a ring channel over the newest `n` frames. */
  pct(ch: Float32Array | Uint16Array, n = this.held): Percentiles {
    const v = this.recent(ch, n);
    if (!v.length) return { p50: 0, p95: 0, max: 0, avg: 0 };
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i];
    v.sort();
    const at = (q: number) => v[Math.min(v.length - 1, Math.floor(q * (v.length - 1) + 0.5))];
    return { p50: at(0.5), p95: at(0.95), max: v[v.length - 1], avg: sum / v.length };
  }

  /** Per-phase percentiles over the newest `n` frames. */
  phases(n = this.held): Record<PhaseName | "total", Percentiles> {
    const out = {} as Record<PhaseName | "total", Percentiles>;
    for (let k = 0; k < NP; k++) out[PHASES[k]] = this.pct(this.ph[k], n);
    out.total = this.pct(this.cpu, n);
    return out;
  }

  /** The last 60 s (one-second buckets, the current second included). */
  window(): WindowStats {
    const hist = new Array<number>(NB).fill(0);
    let frames = 0;
    let worst = 0;
    let pe = 0;
    let pp = 0;
    let psp = 0;
    const n = Math.max(1, this.secsSeen);
    for (let k = 0; k < n; k++) {
      const sl = (this.slot - k + SECS) % SECS;
      frames += this.secFrames[sl];
      for (let b = 0; b < NB; b++) hist[b] += this.secHist[sl * NB + b];
      worst = Math.max(worst, this.secWorst[sl]);
      pe = Math.max(pe, this.secEnemies[sl]);
      pp = Math.max(pp, this.secParticles[sl]);
      psp = Math.max(psp, this.secSprites[sl]);
    }
    // (the current second is partial: fps over the complete ones when there are any)
    let fullFrames = 0;
    for (let k = 1; k < n; k++) fullFrames += this.secFrames[(this.slot - k + SECS) % SECS];
    const fps = n > 1 ? fullFrames / (n - 1) : frames;
    return { seconds: this.secsSeen, frames, fps, hist, worstMs: worst, peakEnemies: pe, peakParticles: pp, peakSprites: psp };
  }
}

/** The app-wide frame profiler. */
export const prof = new FrameProfiler();
