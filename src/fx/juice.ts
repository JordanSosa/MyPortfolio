/**
 * Juice facade: one place for game-feel effects, applying the user's
 * accessibility settings (screen shake %, "reduce flashing").
 *
 *   juice.hitstop(60); juice.shake(0.35); juice.flash(0xffffff, 0.5);
 *   juice.shockwave(x, y, 1, 72); juice.aberration(2); juice.damageVignette(0.8);
 *   juice.apply({ shake: 0.5, reduceFlashing: true });
 */
import { time as globalTime, type Time } from "../core/time";
import type { Renderer } from "../render/renderer";

export interface JuiceSettings {
  /** Screen shake multiplier 0..1 (settings 0 / 50 / 100 %). */
  shake: number;
  /** Accessibility: tone down full-screen flashes, aberration and hue cycling. */
  reduceFlashing: boolean;
  /** Allow hitstop (debug/bot fast-forward may disable it). */
  hitstop: boolean;
}

export class Juice {
  readonly settings: JuiceSettings = { shake: 1, reduceFlashing: false, hitstop: true };

  constructor(
    private readonly r: Renderer,
    private readonly time: Time = globalTime,
  ) {}

  apply(s: Partial<JuiceSettings>): void {
    Object.assign(this.settings, s);
    this.r.post.flashScale = this.settings.reduceFlashing ? 0.3 : 1;
    this.r.post.aberrationScale = this.settings.reduceFlashing ? 0.35 : 1;
  }

  /** Freeze the simulation for `ms` of real time (shake/post keep running). */
  hitstop(ms: number): void {
    if (this.settings.hitstop) this.time.hitstop(ms);
  }

  /** Slow motion to `scale` for `seconds` (real time) with eased in/out. */
  slowmo(scale: number, seconds: number): void {
    this.time.slowmo(scale, seconds);
  }

  /** Add camera trauma 0..1 (0.1 tap, 0.35 hurt, 0.6 big boom, 1 = max). */
  shake(trauma: number): void {
    if (this.settings.shake <= 0) return;
    this.r.camera.shake(trauma * Math.sqrt(this.settings.shake));
  }

  /** Quick zoom-in kick (0.04 subtle .. 0.15 huge). */
  zoomPunch(amount: number): void {
    this.r.camera.zoomPunch(amount * (0.35 + 0.65 * this.settings.shake));
  }

  /** Full-screen colour flash (amount 0..1, fades over `seconds`). Reduced when "reduce flashing" is on. */
  flash(color: number, amount: number, seconds = 0.2): void {
    const a = this.settings.reduceFlashing ? Math.min(0.12, amount * 0.3) : amount;
    this.r.post.flashScale = 1;
    this.r.post.flash(color, a, seconds);
    this.r.post.flashScale = this.settings.reduceFlashing ? 0.3 : 1;
  }

  /** World-space ripple distortion. */
  shockwave(x: number, y: number, strength = 1, radius = 64, life = 0.6): void {
    this.r.post.shockwave(x, y, strength, radius, life);
  }

  /** Chromatic aberration pulse (art px at the screen edge). */
  aberration(amount: number): void {
    this.r.post.aberration(amount);
  }

  /** Red damage vignette pulse 0..1. */
  damageVignette(amount: number): void {
    this.r.post.damageVignette(this.settings.reduceFlashing ? amount * 0.6 : amount);
  }

  /** Temporary bloom boost. */
  bloomSurge(amount: number, seconds = 0.6): void {
    this.r.post.bloomSurge(this.settings.reduceFlashing ? amount * 0.5 : amount, seconds);
  }

  /** Hue-cycling grade (evolution). Skipped with reduce flashing. */
  hueCycle(seconds = 0.6): void {
    if (!this.settings.reduceFlashing) this.r.post.hueCycle(seconds);
  }

  /** Combined "big impact" helper: hitstop + shake + punch + flash + wave + aberration. */
  impact(x: number, y: number, power = 1): void {
    this.hitstop(40 + 50 * power);
    this.shake(0.25 + 0.35 * power);
    this.zoomPunch(0.03 + 0.05 * power);
    this.flash(0xffffff, 0.15 + 0.25 * power, 0.18);
    this.shockwave(x, y, 0.6 + 0.6 * power, 40 + 50 * power);
    this.aberration(1 + 2 * power);
  }
}
