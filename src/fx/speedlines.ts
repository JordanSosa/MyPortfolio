/**
 * Anime speed-lines overlay (world-space, drawn on the Overlay layer over the
 * current view). Radial (ult cut-ins, focus) or directional (dash, rush).
 * Lines re-randomise every ~50 ms for that hand-drawn flicker.
 *
 *   speed.radial(1.1, { color: C.white, intensity: 1 });            // around the view centre
 *   speed.radial(0.5, { x: px, y: py, inner: 0.35 });              // around a world point
 *   speed.directional(angle, 0.25, { color: C.aqua });              // dash
 *   speed.update(realDt); speed.draw();
 */
import { TAU } from "../core/math";
import { fxRng } from "../core/rng";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";

export interface SpeedLineOpts {
  color?: number;
  /** 0..1 alpha/density multiplier. */
  intensity?: number;
  /** Number of lines (default radial 56, directional 26). */
  count?: number;
  /** World-space centre (radial). Default: view centre (follows the camera). */
  x?: number;
  y?: number;
  /** Inner clear radius as a fraction of the half-diagonal (radial, default 0.42). */
  inner?: number;
  /** Additive glow lines instead of plain (default false). */
  additive?: boolean;
}

const MAXL = 64;

export class SpeedLines {
  private mode = 0; // 0 off, 1 radial, 2 directional
  private t = 0;
  private dur = 0;
  private regen = 0;
  private color = 0xffffff;
  private intensity = 1;
  private count = 0;
  private cx = NaN;
  private cy = NaN;
  private inner = 0.42;
  private angle = 0;
  private additive = false;
  private la = new Float32Array(MAXL); // angle or lateral offset
  private lr = new Float32Array(MAXL); // inner radius factor or position
  private lt = new Float32Array(MAXL); // thickness
  private ll = new Float32Array(MAXL); // length factor
  private lA = new Float32Array(MAXL); // alpha
  private hStreak: number;

  constructor(private readonly r: Renderer) {
    this.hStreak = r.atlas.handle("fx_streak");
  }

  get active(): boolean {
    return this.mode !== 0;
  }

  radial(seconds: number, o: SpeedLineOpts = {}): void {
    this.mode = 1;
    this.begin(seconds, o, 56);
    this.cx = o.x ?? NaN;
    this.cy = o.y ?? NaN;
    this.inner = o.inner ?? 0.42;
  }

  directional(angle: number, seconds: number, o: SpeedLineOpts = {}): void {
    this.mode = 2;
    this.angle = angle;
    this.begin(seconds, o, 26);
  }

  stop(): void {
    this.mode = 0;
  }

  private begin(seconds: number, o: SpeedLineOpts, n: number): void {
    this.t = 0;
    this.dur = seconds;
    this.color = o.color ?? 0xffffff;
    this.intensity = o.intensity ?? 1;
    this.count = Math.min(MAXL, o.count ?? n);
    this.additive = o.additive ?? false;
    this.regen = 0;
  }

  private randomise(): void {
    for (let i = 0; i < this.count; i++) {
      if (this.mode === 1) {
        this.la[i] = fxRng.next() * TAU;
        this.lr[i] = this.inner * (0.85 + fxRng.next() * 0.5);
      } else {
        this.la[i] = fxRng.next() * 2 - 1;
        this.lr[i] = fxRng.next();
      }
      const r = fxRng.next();
      this.lt[i] = r < 0.15 ? 4 : r < 0.4 ? 3 : r < 0.7 ? 2 : 1;
      this.ll[i] = 0.4 + fxRng.next() * 0.8;
      this.lA[i] = 0.55 + fxRng.next() * 0.45;
    }
  }

  update(dt: number): void {
    if (!this.mode) return;
    this.t += dt;
    if (this.t >= this.dur) {
      this.mode = 0;
      return;
    }
    this.regen -= dt;
    if (this.regen <= 0) {
      this.regen = 0.05;
      this.randomise();
    }
  }

  draw(): void {
    if (!this.mode) return;
    const v = this.r.camera.view;
    const b = this.r.batch;
    const fadeIn = Math.min(1, this.t / 0.08);
    const fadeOut = Math.min(1, (this.dur - this.t) / 0.2);
    const env = fadeIn * fadeOut * this.intensity;
    const flags = this.additive ? Flag.Add | Flag.Glow : 0;
    const h = this.hStreak;
    if (this.mode === 1) {
      const cx = this.cx === this.cx ? this.cx : v.x + v.w / 2;
      const cy = this.cy === this.cy ? this.cy : v.y + v.h / 2;
      const R = Math.sqrt(v.w * v.w + v.h * v.h) / 2;
      for (let i = 0; i < this.count; i++) {
        const a = this.la[i];
        const r0 = this.lr[i] * R;
        const len = R * 1.25 - r0 + R * 0.2 * this.ll[i];
        const x = cx + Math.cos(a) * r0;
        const y = cy + Math.sin(a) * r0;
        // fx_streak is 16x4, transparent at the left -> pivot at the left edge, pointing outward
        b.drawP(Layer.Overlay, h, x, y, len / 16, this.lt[i] / 4, a, this.color, this.lA[i] * env, 0, flags, 0, 2);
      }
    } else {
      const ca = Math.cos(this.angle);
      const sa = Math.sin(this.angle);
      const span = Math.sqrt(v.w * v.w + v.h * v.h);
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      const scroll = (this.t * 3) % 1;
      for (let i = 0; i < this.count; i++) {
        const lat = this.la[i] * span * 0.5;
        const along = (((this.lr[i] + scroll) % 1) - 0.5) * span;
        const len = span * 0.25 * this.ll[i];
        // lines streak *against* the motion direction
        const x = cx - sa * lat + ca * along;
        const y = cy + ca * lat + sa * along;
        b.drawP(Layer.Overlay, h, x, y, len / 16, this.lt[i] / 4, this.angle + Math.PI, this.color, this.lA[i] * env * 0.8, 0, flags, 0, 2);
      }
    }
  }
}
