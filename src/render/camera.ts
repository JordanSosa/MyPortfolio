/**
 * 2D camera in art-pixel world units.
 *
 *   camera.follow(px, py, vx, vy, dt)   smooth follow with look-ahead in the move direction
 *   camera.shake(0.4)                   add trauma (0..1); offset = maxShake * trauma^2 * smooth noise
 *   camera.zoomPunch(0.08)              brief zoom-in that springs back
 *   camera.zoom = 0.9                   persistent zoom (eased via zoomTo); <1 shows more world
 *   camera.view                         visible world rect {x, y, w, h} this frame (after shake)
 *   camera.worldToScreen(x, y, out)     -> CSS pixels; screenToWorld(sx, sy, out)
 *
 * The renderer owns the pixel scale: it calls `setViewport(cssW, cssH, pxScale)`.
 */
import { clamp, damp, fbm1 } from "./../core/math";

/** Largest step (s) of the zoom-punch spring's integration (stable well below its ~0.09 s limit). */
const PUNCH_STEP = 1 / 60;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Camera {
  /** Camera centre (world), before shake. */
  x = 0;
  y = 0;
  /** Follow tuning. */
  followLambda = 7;
  lookAhead = 18;
  lookAheadLambda = 3;
  /** Max shake offset in world px at trauma 1 (and max roll is not used: pixels stay axis aligned). */
  maxShake = 9;
  traumaDecay = 1.5;
  shakeFreq = 26;
  /** Global multiplier for shake (user setting 0 / 0.5 / 1). */
  shakeScale = 1;

  trauma = 0;
  /** Persistent zoom (1 = default pixel scale; < 1 = zoomed out). */
  zoom = 1;
  private zoomTarget = 1;
  private zoomLambda = 4;
  private punch = 0;
  private punchV = 0;
  private lax = 0;
  private lay = 0;
  private t = 0;

  /** Final (shaken) centre used for rendering this frame. */
  renderX = 0;
  renderY = 0;
  readonly view: Rect = { x: 0, y: 0, w: 0, h: 0 };

  // viewport (set by renderer)
  cssW = 1;
  cssH = 1;
  /** CSS px per art px at zoom 1 (from the pixel scale rule). */
  baseScale = 2;
  /** Effective CSS px per art px this frame (baseScale * zoom * punch). */
  scale = 2;

  setViewport(cssW: number, cssH: number, baseScale: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.baseScale = baseScale;
    this.recompute();
  }

  /** Jump to a position (no smoothing). */
  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.lax = this.lay = 0;
    this.recompute();
  }

  /** Smoothly follow a target; (vx, vy) = its velocity (for look-ahead). */
  follow(tx: number, ty: number, vx: number, vy: number, dt: number): void {
    const sp = Math.sqrt(vx * vx + vy * vy);
    const k = sp > 1 ? Math.min(1, sp / 80) / sp : 0;
    this.lax = damp(this.lax, vx * k * this.lookAhead, this.lookAheadLambda, dt);
    this.lay = damp(this.lay, vy * k * this.lookAhead, this.lookAheadLambda, dt);
    this.x = damp(this.x, tx + this.lax, this.followLambda, dt);
    this.y = damp(this.y, ty + this.lay, this.followLambda, dt);
    this.recompute();
  }

  /** Add trauma 0..1 (clamped). Shake amount ~ trauma^2. */
  shake(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  /** Brief zoom-in kick (0.05 subtle .. 0.2 huge). */
  zoomPunch(amount: number): void {
    this.punchV += amount * 28;
  }

  /** Ease persistent zoom to `z` (lambda ~ speed). */
  zoomTo(z: number, lambda = 4): void {
    this.zoomTarget = z;
    this.zoomLambda = lambda;
  }

  /** Advance shake/zoom springs. Use real dt so shake runs during hitstop. */
  update(dt: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
    this.zoom = damp(this.zoom, this.zoomTarget, this.zoomLambda, dt);
    // punch spring, sub-stepped: one long frame (a step-mode film frame draws 10+ accumulated frames at once)
    // in a single explicit step goes unstable past ~0.09 s and rings the zoom between its +-50 % clamps
    if (dt > 0.5) this.punch = this.punchV = 0;
    else
      for (let left = dt; left > 1e-6; left -= PUNCH_STEP) {
        const h = Math.min(left, PUNCH_STEP);
        const a = -260 * this.punch - 22 * this.punchV;
        this.punchV += a * h;
        this.punch += this.punchV * h;
      }
    this.recompute();
  }

  private recompute(): void {
    const s = this.trauma * this.trauma * this.maxShake * this.shakeScale;
    const sx = s * fbm1(this.t * this.shakeFreq, 1);
    const sy = s * fbm1(this.t * this.shakeFreq, 2);
    this.renderX = this.x + sx;
    this.renderY = this.y + sy;
    const z = Math.max(0.2, this.zoom * (1 + clamp(this.punch, -0.5, 0.5)));
    this.scale = this.baseScale * z;
    const w = this.cssW / this.scale;
    const h = this.cssH / this.scale;
    this.view.x = this.renderX - w / 2;
    this.view.y = this.renderY - h / 2;
    this.view.w = w;
    this.view.h = h;
  }

  /** World -> CSS pixel coordinates (relative to the canvas). */
  worldToScreen(x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
    out.x = (x - this.view.x) * this.scale;
    out.y = (y - this.view.y) * this.scale;
    return out;
  }

  /** CSS pixel coordinates -> world. */
  screenToWorld(sx: number, sy: number, out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.view.x + sx / this.scale;
    out.y = this.view.y + sy / this.scale;
    return out;
  }

  /** Is the circle (x, y, r) within the view (+margin)? */
  inView(x: number, y: number, r = 0, margin = 0): boolean {
    const v = this.view;
    const m = r + margin;
    return x + m >= v.x && x - m <= v.x + v.w && y + m >= v.y && y - m <= v.y + v.h;
  }
}
