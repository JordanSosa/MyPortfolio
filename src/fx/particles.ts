/**
 * Particle system: struct-of-arrays typed arrays, fixed capacity (quality
 * tier: 1500 / 3000 / 5000), swap-remove, no per-particle objects.
 *
 *   const ps = new Particles(renderer, 3000);
 *   ps.emit(P.confetti, x, y, 12);                  // preset (see presets.ts)
 *   ps.emit(P.sparkle, x, y, 4, angle, C.yellow);   // optional angle / colour / size / speed overrides
 *   ps.update(time.dt); ps.draw();
 *
 * Emitter defs are plain objects; define them once (module scope) and reuse.
 */
import { lerpColor } from "../core/color";
import { TAU } from "../core/math";
import { fxRng, type Rng } from "../core/rng";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";

export type FrameMode = "fixed" | "random" | "life" | "loop";
export type Curve = "linear" | "out" | "in" | "pop" | "none";
export type AlphaCurve = "linear" | "late" | "inout" | "flicker" | "none";

export interface EmitterDef {
  /** Atlas sprite id. */
  sprite: string;
  /** How frames are chosen: fixed (frame), random per particle, over life, or looping at fps. Default: life if multi-frame. */
  frames?: FrameMode;
  frame?: number;
  fps?: number;
  /** Speed range px/s. */
  speed?: [number, number];
  /** Emission direction (radians) and total spread (radians; TAU = all around). */
  angle?: number;
  spread?: number;
  /** Lifetime range in seconds. */
  life?: [number, number];
  /** Scale at birth / death (multiplies the sprite size). */
  size?: [number, number];
  /** Random size multiplier range, e.g. 0.3 -> x0.7..1.3. */
  sizeJitter?: number;
  sizeCurve?: Curve;
  /** Start colour(s) - one is picked at random. */
  colors?: number | readonly number[];
  /** End colour (lerped over life). Omit to keep the start colour. */
  colorEnd?: number;
  alpha?: number;
  alphaCurve?: AlphaCurve;
  /** px/s^2 downward (screen y). Ignored with bounce (uses bounce.gravity on height). */
  gravity?: number;
  /** Exponential velocity damping per second. */
  drag?: number;
  /** Initial rotation: "random", "velocity" (aligned each frame) or a fixed angle. */
  rot?: "random" | "velocity" | number;
  /** Spin range rad/s (random sign). */
  spin?: [number, number];
  additive?: boolean;
  glow?: boolean;
  /** Only bloom during the first `glowLife` fraction of life (e.g. 0.5 for explosions whose smoke shouldn't glow). */
  glowLife?: number;
  glowOnly?: boolean;
  layer?: number;
  /** Ground bounce (confetti/debris): particles get a height z with upward speed vz and bounce on y. */
  bounce?: { vz: [number, number]; gravity?: number; restitution?: number; friction?: number };
  /** Stretch along velocity: scaleX *= 1 + speed * stretch (rays, streaks). */
  stretch?: number;
  /** Constant horizontal/vertical aspect: scaleX *= aspect (e.g. 0.3 for a tall light pillar). */
  aspect?: number;
  /** Spawn inside a circle of this radius (or on its edge with ring). */
  radius?: number;
  ring?: boolean;
  /** With radius: velocity points away from the centre instead of using angle/spread. */
  outward?: boolean;
  /** Sideways sine sway amplitude (px/s), e.g. falling petals. */
  sway?: number;
  /** Flash-to-white at birth fading over the first 30% of life (0..1). */
  flash?: number;
}

interface Compiled {
  def: EmitterDef;
  first: number;
  count: number;
  fps: number;
  mode: number; // 0 fixed 1 random 2 life 3 loop
  frame: number;
  colors: number[];
  hasEnd: boolean;
  end: number;
  flags: number;
  layer: number;
  sizeCurve: number;
  alphaCurve: number;
  rotMode: number; // 0 fixed 1 random 2 velocity
  rot: number;
}

// particle flag bits
const F_ADD = 1;
const F_GLOW = 2;
const F_GLOWONLY = 4;
const F_BOUNCE = 8;
const F_ROTVEL = 16;
const F_STRETCH = 32;

const CURVES: Record<Curve, number> = { linear: 0, out: 1, in: 2, pop: 3, none: 4 };
const ACURVES: Record<AlphaCurve, number> = { linear: 0, late: 1, inout: 2, flicker: 3, none: 4 };
const MODES: Record<FrameMode, number> = { fixed: 0, random: 1, life: 2, loop: 3 };

export class Particles {
  capacity: number;
  count = 0;
  /** Global multiplier on emitted counts (quality / settings). */
  density = 1;
  rng: Rng = fxRng;

  private x!: Float32Array;
  private y!: Float32Array;
  private z!: Float32Array;
  private vx!: Float32Array;
  private vy!: Float32Array;
  private vz!: Float32Array;
  private age!: Float32Array;
  private life!: Float32Array;
  private s0!: Float32Array;
  private s1!: Float32Array;
  private rot!: Float32Array;
  private spin!: Float32Array;
  private grav!: Float32Array;
  private drag!: Float32Array;
  private a0!: Float32Array;
  private stretch!: Float32Array;
  private asp!: Float32Array;
  private sway!: Float32Array;
  private phase!: Float32Array;
  private bg!: Float32Array; // bounce gravity
  private br!: Float32Array; // restitution
  private bf!: Float32Array; // friction
  private flashA!: Float32Array;
  private glowL!: Float32Array;
  private c0!: Uint32Array;
  private c1!: Uint32Array;
  private h0!: Int32Array;
  private nf!: Uint8Array;
  private fps!: Float32Array;
  private mode!: Uint8Array;
  private fr!: Uint8Array;
  private flags!: Uint8Array;
  private layer!: Uint8Array;
  private scurve!: Uint8Array;
  private acurve!: Uint8Array;

  private compiled = new WeakMap<EmitterDef, Compiled>();
  private cursor = 0;

  constructor(
    private readonly r: Renderer,
    capacity = 3000,
  ) {
    this.capacity = capacity;
    this.alloc(capacity);
  }

  private alloc(n: number): void {
    const F = () => new Float32Array(n);
    this.x = F();
    this.y = F();
    this.z = F();
    this.vx = F();
    this.vy = F();
    this.vz = F();
    this.age = F();
    this.life = F();
    this.s0 = F();
    this.s1 = F();
    this.rot = F();
    this.spin = F();
    this.grav = F();
    this.drag = F();
    this.a0 = F();
    this.stretch = F();
    this.asp = F();
    this.sway = F();
    this.phase = F();
    this.bg = F();
    this.br = F();
    this.bf = F();
    this.flashA = F();
    this.glowL = F();
    this.c0 = new Uint32Array(n);
    this.c1 = new Uint32Array(n);
    this.h0 = new Int32Array(n);
    this.nf = new Uint8Array(n);
    this.fps = F();
    this.mode = new Uint8Array(n);
    this.fr = new Uint8Array(n);
    this.flags = new Uint8Array(n);
    this.layer = new Uint8Array(n);
    this.scurve = new Uint8Array(n);
    this.acurve = new Uint8Array(n);
  }

  /** Change capacity (quality tier). Live particles beyond the new capacity are dropped. */
  setCapacity(n: number): void {
    if (n === this.capacity) return;
    this.alloc(n);
    this.capacity = n;
    this.count = 0;
    this.cursor = 0;
  }

  clear(): void {
    this.count = 0;
  }

  private compile(def: EmitterDef): Compiled {
    let c = this.compiled.get(def);
    if (c) return c;
    const info = this.r.atlas.info(def.sprite);
    let flags = 0;
    if (def.additive || def.layer === Layer.FxAdd) flags |= F_ADD;
    if (def.glow) flags |= F_GLOW;
    if (def.glowOnly) flags |= F_GLOWONLY;
    if (def.bounce) flags |= F_BOUNCE;
    if (def.rot === "velocity") flags |= F_ROTVEL;
    if (def.stretch) flags |= F_STRETCH;
    const cols = def.colors === undefined ? [0xffffff] : typeof def.colors === "number" ? [def.colors] : [...def.colors];
    c = {
      def,
      first: info.first,
      count: info.count,
      fps: def.fps ?? info.fps,
      mode: MODES[def.frames ?? (info.count > 1 ? "life" : "fixed")],
      frame: def.frame ?? 0,
      colors: cols.length ? cols : [0xffffff],
      hasEnd: def.colorEnd !== undefined,
      end: def.colorEnd ?? 0xffffff,
      flags,
      layer: def.layer ?? (def.additive ? Layer.FxAdd : Layer.Fx),
      sizeCurve: CURVES[def.sizeCurve ?? "linear"],
      alphaCurve: ACURVES[def.alphaCurve ?? "late"],
      rotMode: def.rot === "random" ? 1 : def.rot === "velocity" ? 2 : 0,
      rot: typeof def.rot === "number" ? def.rot : 0,
    };
    this.compiled.set(def, c);
    return c;
  }

  /**
   * Emit `n` particles at (x, y).
   * Overrides: angle (NaN = def), color (-1 = def), sizeMul, speedMul, layer (-1 = def).
   */
  emit(def: EmitterDef, x: number, y: number, n = 1, angle = NaN, color = -1, sizeMul = 1, speedMul = 1, layer = -1): void {
    const c = this.compile(def);
    const d = def;
    const rng = this.rng;
    let total = n * this.density;
    total = Math.floor(total) + (rng.next() < total - Math.floor(total) ? 1 : 0);
    const baseAngle = angle === angle ? angle : (d.angle ?? 0);
    const spread = d.spread ?? TAU;
    const sp0 = d.speed ? d.speed[0] : 0;
    const sp1 = d.speed ? d.speed[1] : 0;
    const l0 = d.life ? d.life[0] : 0.5;
    const l1 = d.life ? d.life[1] : 0.5;
    const z0 = d.size ? d.size[0] : 1;
    const z1 = d.size ? d.size[1] : z0;
    const sj = d.sizeJitter ?? 0;
    const lay = layer >= 0 ? layer : c.layer;
    let flags = c.flags;
    if (lay === Layer.FxAdd) flags |= F_ADD;
    for (let k = 0; k < total; k++) {
      let i: number;
      if (this.count < this.capacity) i = this.count++;
      else {
        i = this.cursor;
        this.cursor = (this.cursor + 1) % this.capacity;
      }
      let px = x;
      let py = y;
      let a = baseAngle + (rng.next() - 0.5) * spread;
      if (d.radius) {
        const ra = rng.next() * TAU;
        const rr = d.ring ? d.radius : d.radius * Math.sqrt(rng.next());
        px += Math.cos(ra) * rr;
        py += Math.sin(ra) * rr;
        if (d.outward) a = ra;
      }
      const sp = (sp0 + (sp1 - sp0) * rng.next()) * speedMul;
      this.x[i] = px;
      this.y[i] = py;
      this.vx[i] = Math.cos(a) * sp;
      this.vy[i] = Math.sin(a) * sp;
      this.age[i] = 0;
      this.life[i] = Math.max(0.016, l0 + (l1 - l0) * rng.next());
      const j = sj ? 1 + (rng.next() * 2 - 1) * sj : 1;
      this.s0[i] = z0 * j * sizeMul;
      this.s1[i] = z1 * j * sizeMul;
      this.rot[i] = c.rotMode === 1 ? rng.next() * TAU : c.rot;
      const sMin = d.spin ? d.spin[0] : 0;
      const sMax = d.spin ? d.spin[1] : 0;
      this.spin[i] = (sMin + (sMax - sMin) * rng.next()) * (rng.next() < 0.5 ? -1 : 1);
      this.grav[i] = d.gravity ?? 0;
      this.drag[i] = d.drag ?? 0;
      this.a0[i] = d.alpha ?? 1;
      this.stretch[i] = d.stretch ?? 0;
      this.asp[i] = d.aspect ?? 1;
      this.sway[i] = d.sway ?? 0;
      this.phase[i] = rng.next() * TAU;
      this.flashA[i] = d.flash ?? 0;
      this.glowL[i] = d.glowLife ?? 1;
      if (d.bounce) {
        const b = d.bounce;
        this.z[i] = 0;
        this.vz[i] = b.vz[0] + (b.vz[1] - b.vz[0]) * rng.next();
        this.bg[i] = b.gravity ?? 420;
        this.br[i] = b.restitution ?? 0.45;
        this.bf[i] = b.friction ?? 5;
      } else {
        this.z[i] = 0;
        this.vz[i] = 0;
      }
      const col = color >= 0 ? color : c.colors.length === 1 ? c.colors[0] : c.colors[(rng.next() * c.colors.length) | 0];
      this.c0[i] = col;
      this.c1[i] = c.hasEnd ? c.end : col;
      this.h0[i] = c.first;
      this.nf[i] = c.count;
      this.fps[i] = c.fps;
      this.mode[i] = c.mode;
      this.fr[i] = c.mode === 1 ? (rng.next() * c.count) | 0 : Math.min(c.count - 1, c.frame);
      this.flags[i] = flags;
      this.layer[i] = lay;
      this.scurve[i] = c.sizeCurve;
      this.acurve[i] = c.alphaCurve;
    }
  }

  private kill(i: number): void {
    const j = --this.count;
    if (i === j) return;
    this.x[i] = this.x[j];
    this.y[i] = this.y[j];
    this.z[i] = this.z[j];
    this.vx[i] = this.vx[j];
    this.vy[i] = this.vy[j];
    this.vz[i] = this.vz[j];
    this.age[i] = this.age[j];
    this.life[i] = this.life[j];
    this.s0[i] = this.s0[j];
    this.s1[i] = this.s1[j];
    this.rot[i] = this.rot[j];
    this.spin[i] = this.spin[j];
    this.grav[i] = this.grav[j];
    this.drag[i] = this.drag[j];
    this.a0[i] = this.a0[j];
    this.stretch[i] = this.stretch[j];
    this.asp[i] = this.asp[j];
    this.sway[i] = this.sway[j];
    this.phase[i] = this.phase[j];
    this.bg[i] = this.bg[j];
    this.br[i] = this.br[j];
    this.bf[i] = this.bf[j];
    this.flashA[i] = this.flashA[j];
    this.glowL[i] = this.glowL[j];
    this.c0[i] = this.c0[j];
    this.c1[i] = this.c1[j];
    this.h0[i] = this.h0[j];
    this.nf[i] = this.nf[j];
    this.fps[i] = this.fps[j];
    this.mode[i] = this.mode[j];
    this.fr[i] = this.fr[j];
    this.flags[i] = this.flags[j];
    this.layer[i] = this.layer[j];
    this.scurve[i] = this.scurve[j];
    this.acurve[i] = this.acurve[j];
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const { x, y, z, vx, vy, vz, age, life, grav, drag, rot, spin, flags, sway, phase } = this;
    for (let i = this.count - 1; i >= 0; i--) {
      const a = age[i] + dt;
      if (a >= life[i]) {
        this.kill(i);
        continue;
      }
      age[i] = a;
      const fl = flags[i];
      if (fl & F_BOUNCE) {
        vz[i] -= this.bg[i] * dt;
        z[i] += vz[i] * dt;
        if (z[i] <= 0) {
          z[i] = 0;
          if (vz[i] < -25) {
            vz[i] = -vz[i] * this.br[i];
            vx[i] *= 0.6;
            vy[i] *= 0.6;
            spin[i] *= 0.6;
          } else {
            vz[i] = 0;
            const k = Math.exp(-this.bf[i] * dt);
            vx[i] *= k;
            vy[i] *= k;
            spin[i] *= k;
          }
        }
      } else if (grav[i] !== 0) vy[i] += grav[i] * dt;
      const dr = drag[i];
      if (dr !== 0) {
        const k = Math.exp(-dr * dt);
        vx[i] *= k;
        vy[i] *= k;
      }
      let sx = 0;
      if (sway[i] !== 0) sx = Math.sin(a * 3.2 + phase[i]) * sway[i];
      x[i] += (vx[i] + sx) * dt;
      y[i] += vy[i] * dt;
      rot[i] += spin[i] * dt;
    }
  }

  draw(): void {
    const b = this.r.batch;
    const { x, y, z, vx, vy, age, life, s0, s1, rot, flags, a0, c0, c1, h0, nf, fps, mode, fr, layer, scurve, acurve, stretch, asp, flashA, glowL } = this;
    const rng = this.rng;
    for (let i = 0; i < this.count; i++) {
      const t = age[i] / life[i];
      // size curve
      let sc: number;
      switch (scurve[i]) {
        case 1: {
          const u = 1 - (1 - t) * (1 - t);
          sc = s0[i] + (s1[i] - s0[i]) * u;
          break;
        }
        case 2:
          sc = s0[i] + (s1[i] - s0[i]) * t * t;
          break;
        case 3: {
          // pop: grow 0 -> start quickly (ease out), then start -> end
          if (t < 0.15) {
            const u = t / 0.15;
            sc = s0[i] * (1 - (1 - u) * (1 - u)) * 1.15;
          } else sc = s0[i] * 1.15 + (s1[i] - s0[i] * 1.15) * ((t - 0.15) / 0.85);
          break;
        }
        case 4:
          sc = s0[i];
          break;
        default:
          sc = s0[i] + (s1[i] - s0[i]) * t;
      }
      if (sc <= 0.01) continue;
      // alpha curve
      let al = a0[i];
      switch (acurve[i]) {
        case 0:
          al *= 1 - t;
          break;
        case 1:
          if (t > 0.6) al *= 1 - (t - 0.6) / 0.4;
          break;
        case 2:
          al *= t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
          break;
        case 3:
          al *= (1 - t) * (0.55 + 0.45 * rng.next());
          break;
      }
      if (al <= 0.01) continue;
      const fl = flags[i];
      // frame
      const n = nf[i];
      let f = 0;
      const m = mode[i];
      if (m === 2) f = Math.min(n - 1, (t * n) | 0);
      else if (m === 3) f = ((age[i] * fps[i]) | 0) % n;
      else f = fr[i];
      const col = c0[i] === c1[i] ? c0[i] : lerpColor(c0[i], c1[i], t);
      let r = rot[i];
      let sx = sc * asp[i];
      if (fl & F_ROTVEL) r = Math.atan2(vy[i], vx[i]);
      if (fl & F_STRETCH) {
        const spd = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
        sx *= 1 + spd * stretch[i];
      }
      let bf = 0;
      if (fl & F_ADD) bf |= Flag.Add;
      if (fl & F_GLOW && t < glowL[i]) bf |= Flag.Glow;
      if (fl & F_GLOWONLY) bf |= Flag.GlowOnly;
      const fla = flashA[i] > 0 && t < 0.3 ? flashA[i] * (1 - t / 0.3) : 0;
      const h = h0[i] + f;
      b.draw(layer[i], h, x[i], y[i] - z[i], sx, sc, r, col, al, fla, bf);
    }
  }
}
