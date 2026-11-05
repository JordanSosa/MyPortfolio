/**
 * Global time controller.
 *
 *   time.update(realDt)        once per frame (the Loop's clamped dt)
 *   time.dt                    scaled dt for the simulation / particles (0 during hitstop & pause)
 *   time.realDt                unscaled dt (UI, camera shake, post FX, audio)
 *   time.hitstop(80)           freeze scaled time for 80 ms of real time (max-merges, doesn't stack)
 *   time.slowmo(0.25, 1.2)     ease to 0.25x, hold, ease back to 1x over 1.2 s total (real time)
 *   time.easeTo(0.2, 0.3)      persistent target scale (e.g. while the level-up modal opens); easeTo(1, 0.2) to restore
 *   time.paused = true         scaled dt = 0 (realDt keeps flowing)
 *
 * Effective scale = paused ? 0 : hitstop ? 0 : base * slowmo * userSpeed
 */
import { lerp, smoothstep } from "./math";

export class Time {
  /** Unscaled (clamped) frame delta in seconds. */
  realDt = 0;
  /** Scaled delta for gameplay/particles. */
  dt = 0;
  /** Current effective scale (0 during hitstop/pause). */
  scale = 1;
  /** Real seconds since start. */
  now = 0;
  /** Scaled seconds since start (sim clock). */
  simTime = 0;
  /** Frame counter. */
  frame = 0;
  /** Debug/user multiplier (e.g. ?speed=4 or the bot fast-forward). */
  speed = 1;
  paused = false;

  private hitstopLeft = 0;
  // slowmo envelope
  private smScale = 1;
  private smT = 0;
  private smDur = 0;
  private smIn = 0;
  private smOut = 0;
  // persistent eased base scale
  private base = 1;
  private baseFrom = 1;
  private baseTo = 1;
  private baseT = 0;
  private baseDur = 0;

  /** Seconds of hitstop remaining. */
  get hitstopRemaining(): number {
    return this.hitstopLeft;
  }
  get inHitstop(): boolean {
    return this.hitstopLeft > 0;
  }
  /** Current slowmo/base factor ignoring hitstop & pause (useful to slow FX consistently). */
  get flowScale(): number {
    return this.base * this.slowmoFactor() * this.speed;
  }

  update(realDt: number): void {
    this.realDt = realDt;
    this.now += realDt;
    this.frame++;

    // persistent base ease
    if (this.baseT < this.baseDur) {
      this.baseT = Math.min(this.baseDur, this.baseT + realDt);
      this.base = lerp(this.baseFrom, this.baseTo, smoothstep(0, 1, this.baseT / this.baseDur));
    } else this.base = this.baseTo;

    // slowmo envelope
    if (this.smT < this.smDur) this.smT += realDt;

    let s = this.base * this.slowmoFactor() * this.speed;
    if (this.hitstopLeft > 0) {
      this.hitstopLeft -= realDt;
      s = 0;
    }
    if (this.paused) s = 0;
    this.scale = s;
    this.dt = realDt * s;
    this.simTime += this.dt;
  }

  private slowmoFactor(): number {
    if (this.smT >= this.smDur) return 1;
    const t = this.smT;
    let env = 1;
    if (t < this.smIn) env = smoothstep(0, 1, t / this.smIn);
    else if (t > this.smDur - this.smOut) env = smoothstep(0, 1, (this.smDur - t) / this.smOut);
    return lerp(1, this.smScale, env);
  }

  /** Freeze scaled time for `ms` milliseconds of real time. Overlapping calls keep the longest. */
  hitstop(ms: number): void {
    const s = Math.min(ms, 400) / 1000;
    if (s > this.hitstopLeft) this.hitstopLeft = s;
  }

  /**
   * Slow motion: ease to `scale` over `easeIn` s, hold, ease back to 1 over `easeOut` s;
   * `seconds` is the total duration in real time. A new call while one is
   * running merges (keeps the slower scale, extends the duration).
   */
  slowmo(scale: number, seconds: number, easeIn = 0.08, easeOut = Math.min(0.35, seconds * 0.4)): void {
    const active = this.smT < this.smDur;
    if (active) {
      const remaining = this.smDur - this.smT;
      this.smScale = Math.min(this.smScale, scale);
      // keep current envelope fully engaged: restart past the ease-in
      const dur = Math.max(remaining, seconds);
      this.smIn = 0.0001;
      this.smOut = easeOut;
      this.smDur = dur;
      this.smT = 0.0001;
    } else {
      this.smScale = scale;
      this.smDur = Math.max(seconds, 0.01);
      this.smIn = Math.min(easeIn, this.smDur * 0.5);
      this.smOut = Math.min(easeOut, this.smDur - this.smIn);
      this.smT = 0;
    }
  }

  /** Cancel slowmo immediately. */
  clearSlowmo(): void {
    this.smT = this.smDur = 0;
  }

  /** Ease the persistent base scale to `scale` over `seconds` (real time). */
  easeTo(scale: number, seconds = 0): void {
    this.baseFrom = this.base;
    this.baseTo = scale;
    this.baseT = 0;
    this.baseDur = Math.max(0, seconds);
    if (seconds <= 0) this.base = scale;
  }
  get baseScale(): number {
    return this.base;
  }

  /** Reset clocks and effects (new run). */
  reset(): void {
    this.hitstopLeft = 0;
    this.clearSlowmo();
    this.base = this.baseFrom = this.baseTo = 1;
    this.baseDur = this.baseT = 0;
    this.simTime = 0;
    this.paused = false;
  }
}

/** Shared global time controller. */
export const time = new Time();
