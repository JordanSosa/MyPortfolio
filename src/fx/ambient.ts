/**
 * Screen-space ambient particles: falling sakura petals, twinkling sparkle
 * motes and night fireflies. They live in view space (with slight parallax
 * against camera motion) and wrap around the screen edges.
 *
 *   ambient.set({ petals: 14, motes: 18, fireflies: 0 });   // target densities (fade in/out smoothly)
 *   ambient.update(realDt); ambient.draw();
 */
import { C } from "../art/palette";
import { TAU } from "../core/math";
import { fxRng } from "../core/rng";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";

const MAX = 96;
const K_PETAL = 0;
const K_MOTE = 1;
const K_FLY = 2;

export interface AmbientDensity {
  petals: number;
  motes: number;
  fireflies: number;
}

export class Ambient {
  readonly target: AmbientDensity = { petals: 12, motes: 14, fireflies: 0 };
  /** Parallax factor vs camera motion (0 = glued to screen, 1 = world-fixed). */
  parallax = 0.35;
  /** Global alpha multiplier. */
  alpha = 1;
  /** Wind (px/s) pushing petals sideways. */
  wind = 10;

  private u = new Float32Array(MAX);
  private v = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private ph = new Float32Array(MAX);
  private a = new Float32Array(MAX);
  private kind = new Uint8Array(MAX);
  private on = new Uint8Array(MAX);
  private col = new Uint32Array(MAX);
  private t = 0;
  private lastX = NaN;
  private lastY = NaN;
  private hPetal: number;
  private hSpark: number;
  private hGlow: number;

  constructor(private readonly r: Renderer) {
    this.hPetal = r.atlas.info("fx_petal").first;
    this.hSpark = r.atlas.info("fx_spark").first;
    this.hGlow = r.atlas.handle("fx_glow_s");
  }

  set(d: Partial<AmbientDensity>): void {
    Object.assign(this.target, d);
  }

  private spawn(i: number, kind: number, anywhere: boolean): void {
    const v = this.r.camera.view;
    this.kind[i] = kind;
    this.on[i] = 1;
    this.a[i] = 0;
    this.ph[i] = fxRng.next() * TAU;
    this.u[i] = fxRng.next() * (v.w + 16) - 8;
    this.v[i] = anywhere ? fxRng.next() * v.h : -8;
    if (kind === K_PETAL) {
      this.vx[i] = fxRng.range(-6, 10);
      this.vy[i] = fxRng.range(12, 24);
      this.col[i] = fxRng.pick([C.pinkLight, C.pinkLight, C.pink, C.white]);
    } else if (kind === K_MOTE) {
      this.v[i] = fxRng.next() * v.h;
      this.vx[i] = fxRng.range(-3, 3);
      this.vy[i] = fxRng.range(-7, -2);
      this.col[i] = fxRng.pick([C.white, C.paleYellow, C.aqua, C.pinkLight]);
    } else {
      this.v[i] = fxRng.next() * v.h;
      this.vx[i] = fxRng.range(-8, 8);
      this.vy[i] = fxRng.range(-8, 8);
      this.col[i] = fxRng.pick([C.lime, C.paleYellow, C.aqua]);
    }
  }

  update(dt: number): void {
    this.t += dt;
    const cam = this.r.camera;
    const v = cam.view;
    const dxCam = this.lastX === this.lastX ? cam.x - this.lastX : 0;
    const dyCam = this.lastY === this.lastY ? cam.y - this.lastY : 0;
    this.lastX = cam.x;
    this.lastY = cam.y;
    // count + adjust populations toward targets
    let np = 0,
      nm = 0,
      nf = 0;
    for (let i = 0; i < MAX; i++) {
      if (!this.on[i]) continue;
      if (this.kind[i] === K_PETAL) np++;
      else if (this.kind[i] === K_MOTE) nm++;
      else nf++;
    }
    for (let i = 0; i < MAX; i++) {
      if (this.on[i]) continue;
      if (np < this.target.petals) {
        this.spawn(i, K_PETAL, this.t < 0.1);
        np++;
      } else if (nm < this.target.motes) {
        this.spawn(i, K_MOTE, true);
        nm++;
      } else if (nf < this.target.fireflies) {
        this.spawn(i, K_FLY, true);
        nf++;
      } else break;
    }
    const W = v.w + 16;
    const H = v.h + 16;
    for (let i = 0; i < MAX; i++) {
      if (!this.on[i]) continue;
      const k = this.kind[i];
      const over = (k === K_PETAL ? np > this.target.petals : k === K_MOTE ? nm > this.target.motes : nf > this.target.fireflies);
      if (over) {
        this.a[i] -= dt * 1.5;
        if (this.a[i] <= 0) {
          this.on[i] = 0;
          if (k === K_PETAL) np--;
          else if (k === K_MOTE) nm--;
          else nf--;
          continue;
        }
      } else this.a[i] = Math.min(1, this.a[i] + dt * 1.2);
      this.ph[i] += dt;
      let wx = 0;
      if (k === K_PETAL) wx = Math.sin(this.ph[i] * 1.7) * 14 + this.wind;
      else if (k === K_FLY) {
        this.vx[i] += Math.sin(this.ph[i] * 1.3 + i) * 10 * dt;
        this.vy[i] += Math.cos(this.ph[i] * 1.1 + i * 2) * 10 * dt;
        this.vx[i] *= 0.99;
        this.vy[i] *= 0.99;
      }
      this.u[i] += (this.vx[i] + wx) * dt - dxCam * this.parallax;
      this.v[i] += this.vy[i] * dt - dyCam * this.parallax;
      // wrap
      if (this.u[i] < -8) this.u[i] += W;
      else if (this.u[i] > W - 8) this.u[i] -= W;
      if (this.v[i] < -8) this.v[i] += H;
      else if (this.v[i] > H - 8) {
        if (k === K_PETAL) {
          this.v[i] = -8;
          this.u[i] = fxRng.next() * W - 8;
        } else this.v[i] -= H;
      }
    }
  }

  draw(): void {
    const b = this.r.batch;
    const v = this.r.camera.view;
    for (let i = 0; i < MAX; i++) {
      if (!this.on[i]) continue;
      const x = v.x + this.u[i];
      const y = v.y + this.v[i];
      const al = this.a[i] * this.alpha;
      const k = this.kind[i];
      if (k === K_PETAL) {
        const f = (this.ph[i] * 5) & 1;
        const flip = Math.sin(this.ph[i] * 2.3) > 0 ? 1 : -1;
        b.draw(Layer.Overlay, this.hPetal + f, x, y, flip, 1, Math.sin(this.ph[i] * 1.2) * 0.8, this.col[i], 0.8 * al);
      } else if (k === K_MOTE) {
        const tw = 0.5 + 0.5 * Math.sin(this.ph[i] * 3 + i);
        const f = tw > 0.85 ? 1 : tw > 0.5 ? 2 : 3;
        b.draw(Layer.Overlay, this.hSpark + f, x, y, 1, 1, 0, this.col[i], al * (0.4 + 0.6 * tw), 0, Flag.Add | Flag.Glow);
      } else {
        const tw = 0.5 + 0.5 * Math.sin(this.ph[i] * 2.1 + i * 1.7);
        b.draw(Layer.Overlay, this.hGlow, x, y, 0.4, 0.4, 0, this.col[i], al * tw, 0, Flag.Add | Flag.Glow | Flag.NoSnap);
        b.draw(Layer.Overlay, this.hGlow, x, y, 0.12, 0.12, 0, 0xffffff, al * tw, 0, Flag.Add | Flag.NoSnap);
      }
    }
  }
}
