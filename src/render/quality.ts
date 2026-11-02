/**
 * Quality tiers + automatic quality controller (DESIGN 8.3).
 *
 *   const auto = new AutoQuality("mid", (tier) => applyQuality(tier));
 *   loop: auto.sample(realDt * 1000, cpuMsOfThisFrame)
 *
 * The controller judges 2 s windows against the display's own refresh
 * interval (estimated as the window's median frame time, never slower than
 * 60 Hz), so a 60 Hz phone that hits every vsync can climb tiers and a
 * 120 Hz one is held to its own budget:
 *   - a frame is "missed" when it took more than 1.3x the refresh interval;
 *   - step DOWN (then 4 s cooldown) when more than 10 % of a window's frames
 *     missed, or the average CPU (JS) time per frame exceeds 0.75x refresh;
 *   - step UP after 8 s without a bad window while the average CPU time stays
 *     under 0.4x refresh (cooldown 8 s + 12 s per earlier down-step, so a
 *     device that struggled climbs back more and more carefully).
 */
export type QualityTier = "low" | "mid" | "high";

export interface QualitySettings {
  /** Device pixel ratio cap for the final composite. */
  dprCap: number;
  /** Glow buffer resolution relative to the scene buffer. */
  glowScale: number;
  bloom: boolean;
  /** Particle capacity for fx/particles. */
  particles: number;
  /** Max alive enemies (director cap). */
  maxEnemies: number;
}

/**
 * The scene renders at art resolution; dprCap only sizes the final nearest-
 * neighbour composite, so even "low" keeps phone screens crisp (DPR 2).
 */
export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: { dprCap: 2, glowScale: 0.5, bloom: true, particles: 1500, maxEnemies: 150 },
  mid: { dprCap: 2.5, glowScale: 0.5, bloom: true, particles: 3000, maxEnemies: 250 },
  high: { dprCap: 3, glowScale: 1, bloom: true, particles: 5000, maxEnemies: 350 },
};

export const QUALITY_TIERS: readonly QualityTier[] = ["low", "mid", "high"];

export function isQualityTier(v: unknown): v is QualityTier {
  return v === "low" || v === "mid" || v === "high";
}

/** Window length (s) and the slowest refresh interval assumed (ms, 60 Hz). */
const WINDOW_S = 2;
const MAX_REFRESH_MS = 1000 / 60;
/** Frame-time buffer capacity: a 2 s window at up to 256 Hz. */
const CAP = 512;

export class AutoQuality {
  tier: QualityTier;
  enabled = true;
  /** Missed-frame threshold relative to the refresh interval. */
  missFactor = 1.3;
  /** Step down when more than this fraction of a window's frames missed. */
  missRate = 0.1;
  /** Step down when the average CPU time exceeds this fraction of the refresh interval. */
  cpuDown = 0.75;
  /** Step up only while the average CPU time is under this fraction. */
  cpuUp = 0.4;
  /** Seconds without a bad window before stepping up. */
  upAfter = 8;
  /** Last window's estimate of the refresh interval (ms) (debug / tests). */
  refreshMs = MAX_REFRESH_MS;
  private readonly frames = new Float32Array(CAP);
  private readonly sorted = new Float32Array(CAP);
  private n = 0;
  private cpuSum = 0;
  private window = 0;
  private cooldown = 3;
  private clean = 0;
  private downs = 0;

  constructor(
    initial: QualityTier,
    private readonly onChange: (tier: QualityTier, settings: QualitySettings) => void,
  ) {
    this.tier = initial;
  }

  /**
   * Feed one frame: `frameMs` = the real frame interval (dt * 1000), `cpuMs` =
   * the main-thread time this frame's update + draw took (0 / omitted: judge
   * missed frames only).
   */
  sample(frameMs: number, cpuMs = 0): void {
    if (!this.enabled || !(frameMs > 0)) return;
    const s = frameMs / 1000;
    this.cooldown -= s;
    if (this.n < CAP) this.frames[this.n++] = frameMs;
    this.cpuSum += cpuMs > 0 ? cpuMs : 0;
    this.window += s;
    if (this.window < WINDOW_S) return;
    this.judge();
  }

  /** Drop the partial window (after a pause / screen change, whose frames say nothing). */
  resetWindow(): void {
    this.n = 0;
    this.cpuSum = 0;
    this.window = 0;
  }

  private judge(): void {
    const n = this.n;
    const window = this.window;
    const cpu = n > 0 ? this.cpuSum / n : 0;
    // refresh interval = median frame time of the window (60 Hz at the slowest)
    const sorted = this.sorted;
    sorted.set(this.frames.subarray(0, n));
    const view = sorted.subarray(0, n);
    view.sort();
    const median = n > 0 ? view[n >> 1] : MAX_REFRESH_MS;
    const refresh = Math.min(median, MAX_REFRESH_MS);
    this.refreshMs = refresh;
    const limit = refresh * this.missFactor;
    let missed = 0;
    for (let i = 0; i < n; i++) if (this.frames[i] > limit) missed++;
    this.resetWindow();
    const bad = n > 0 && (missed / n > this.missRate || cpu > this.cpuDown * refresh);
    if (bad) this.clean = 0;
    else this.clean += window;
    if (this.cooldown > 0) return;
    const i = QUALITY_TIERS.indexOf(this.tier);
    if (bad) {
      if (i > 0) {
        this.set(QUALITY_TIERS[i - 1]);
        this.downs++;
        this.cooldown = 4;
      }
    } else if (this.clean >= this.upAfter && cpu < this.cpuUp * refresh && i < QUALITY_TIERS.length - 1) {
      this.set(QUALITY_TIERS[i + 1]);
      this.clean = 0;
      // each down-step makes stepping back up more conservative (avoid oscillation)
      this.cooldown = 8 + this.downs * 12;
    }
  }

  set(tier: QualityTier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.onChange(tier, QUALITY[tier]);
  }
}

/**
 * Initial guess: every phone / tablet (coarse pointer) starts at "mid" (iOS
 * clamps hardwareConcurrency, so core counts say nothing), desktops at "high".
 * AutoQuality moves from there.
 */
export function guessTier(): QualityTier {
  try {
    return matchMedia("(pointer: coarse)").matches ? "mid" : "high";
  } catch {
    return "mid";
  }
}
