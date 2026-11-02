/**
 * Quality tiers + automatic quality controller (DESIGN 8.3).
 *
 *   const auto = new AutoQuality("high", (tier) => applyQuality(tier));
 *   loop: auto.sample(realDt * 1000)
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

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: { dprCap: 1, glowScale: 0.5, bloom: true, particles: 1500, maxEnemies: 150 },
  mid: { dprCap: 1.5, glowScale: 0.5, bloom: true, particles: 3000, maxEnemies: 250 },
  high: { dprCap: 2, glowScale: 1, bloom: true, particles: 5000, maxEnemies: 350 },
};

const ORDER: QualityTier[] = ["low", "mid", "high"];

export class AutoQuality {
  tier: QualityTier;
  enabled = true;
  /** Step down when the rolling average frame time exceeds this (ms). */
  downMs = 20;
  /** Step up when it is below this (ms). */
  upMs = 12;
  private sum = 0;
  private n = 0;
  private window = 0;
  private cooldown = 3;
  private downs = 0;

  constructor(
    initial: QualityTier,
    private readonly onChange: (tier: QualityTier, settings: QualitySettings) => void,
  ) {
    this.tier = initial;
  }

  /** Feed one frame time in ms (use the real frame interval, i.e. dt * 1000). */
  sample(ms: number): void {
    if (!this.enabled) return;
    const s = ms / 1000;
    this.cooldown -= s;
    this.sum += ms;
    this.n++;
    this.window += s;
    if (this.window < 2) return;
    const avg = this.sum / this.n;
    this.sum = this.n = this.window = 0;
    if (this.cooldown > 0) return;
    const i = ORDER.indexOf(this.tier);
    if (avg > this.downMs && i > 0) {
      this.set(ORDER[i - 1]);
      this.downs++;
      this.cooldown = 4;
    } else if (avg < this.upMs && i < ORDER.length - 1) {
      this.set(ORDER[i + 1]);
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

/** Initial guess: phones/tablets start at "mid", desktops at "high". */
export function guessTier(): QualityTier {
  try {
    const coarse = matchMedia("(pointer: coarse)").matches;
    const cores = navigator.hardwareConcurrency || 4;
    if (coarse) return cores >= 6 ? "mid" : "low";
    return "high";
  } catch {
    return "mid";
  }
}
