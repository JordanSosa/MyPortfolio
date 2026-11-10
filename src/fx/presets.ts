/**
 * Particle presets (EmitterDefs) + ready-made composite effects that follow
 * the DESIGN juice catalogue. Defs are shared module constants - never
 * mutate them; use emit() overrides (angle, colour, size, speed, layer).
 *
 *   ps.emit(P.confetti, x, y, 12);
 *   fxEnemyDeath(kit, x, y, [C.mint, C.lime]);
 *   fxExplosion(kit, x, y, 32);
 */
import { C } from "../art/palette";
import { TAU } from "../core/math";
import { Layer } from "../render/layers";
import type { Juice } from "./juice";
import type { EmitterDef, Particles } from "./particles";

export const CONFETTI_COLORS: readonly number[] = [C.pink, C.yellow, C.cyan, C.violet, C.lime, C.orange, C.pinkLight, C.lightBlue, C.white];
export const SPARK_COLORS: readonly number[] = [C.white, C.paleYellow, C.aqua, C.pinkLight];

const PI = Math.PI;

export const P = {
  /** Multi-colour confetti squares that pop up, spin and bounce on the ground. */
  confetti: {
    sprite: "fx_px",
    frames: "fixed",
    speed: [35, 105],
    life: [0.8, 1.4],
    size: [1, 0.75],
    sizeJitter: 0.35,
    colors: CONFETTI_COLORS,
    rot: "random",
    spin: [5, 15],
    bounce: { vz: [70, 160], gravity: 420, restitution: 0.42, friction: 6 },
    alphaCurve: "late",
    layer: Layer.Fx,
  },
  /** Twinkling 4-point stars (additive + bloom). */
  sparkle: {
    sprite: "fx_spark",
    frames: "life",
    speed: [8, 40],
    life: [0.3, 0.55],
    size: [1, 1],
    sizeJitter: 0.3,
    colors: SPARK_COLORS,
    drag: 3,
    additive: true,
    glow: true,
    alphaCurve: "none",
    layer: Layer.FxAdd,
  },
  /** Soft lavender-white smoke puff (normal blend). */
  smoke: {
    sprite: "fx_puff",
    frames: "life",
    speed: [5, 20],
    angle: -PI / 2,
    spread: PI * 1.2,
    life: [0.45, 0.7],
    size: [0.8, 1.25],
    sizeJitter: 0.2,
    colors: [C.offWhite, C.lavender, C.white],
    alpha: 0.75,
    drag: 2.5,
    gravity: -12,
    alphaCurve: "late",
    layer: Layer.Fx,
  },
  /** Small dust puffs (dash, landing, footsteps). */
  dust: {
    sprite: "fx_puff",
    frames: "life",
    speed: [6, 24],
    life: [0.28, 0.42],
    size: [0.4, 0.75],
    sizeJitter: 0.25,
    colors: [C.offWhite, C.lavender],
    alpha: 0.75,
    drag: 5,
    gravity: -10,
    alphaCurve: "late",
    layer: Layer.FxBelow,
  },
  /** Expanding thick ring (use sizeMul = radius / 16). */
  ring: {
    sprite: "fx_ring_thick",
    frames: "fixed",
    speed: [0, 0],
    life: [0.32, 0.32],
    size: [0.15, 1],
    sizeCurve: "out",
    colors: C.white,
    alphaCurve: "linear",
    additive: true,
    glow: true,
    layer: Layer.FxAdd,
  },
  /** Thin 1px ring variant. */
  ringThin: {
    sprite: "fx_ring",
    frames: "fixed",
    speed: [0, 0],
    life: [0.4, 0.4],
    size: [0.2, 1],
    sizeCurve: "out",
    colors: C.white,
    alphaCurve: "linear",
    additive: true,
    glow: true,
    layer: Layer.FxAdd,
  },
  /** Stretched streaks radiating outward (ray burst). */
  rays: {
    sprite: "fx_streak",
    frames: "fixed",
    speed: [150, 260],
    life: [0.18, 0.32],
    size: [0.9, 0.5],
    rot: "velocity",
    stretch: 0.004,
    drag: 7,
    colors: [C.white, C.paleYellow],
    additive: true,
    glow: true,
    alphaCurve: "linear",
    layer: Layer.FxAdd,
  },
  /** Chunky bouncing debris bits. */
  debris: {
    sprite: "fx_px",
    frames: "fixed",
    speed: [50, 130],
    life: [0.6, 1.0],
    size: [1, 0.7],
    sizeJitter: 0.4,
    colors: [0x4b3470, 0x7a6ea3, 0xb6acd9],
    rot: "random",
    spin: [6, 14],
    bounce: { vz: [80, 190], gravity: 520, restitution: 0.35, friction: 7 },
    alphaCurve: "late",
    layer: Layer.Fx,
  },
  /** Impact burst sprite (tint with the weapon colour). */
  hit: {
    sprite: "fx_hit",
    frames: "life",
    speed: [0, 0],
    life: [0.2, 0.2],
    size: [1, 1],
    colors: C.white,
    additive: true,
    glow: true,
    alphaCurve: "none",
    layer: Layer.FxAdd,
  },
  /** Cute explosion sprite (use sizeMul = radius / 16). */
  explosion: {
    sprite: "fx_explosion",
    frames: "life",
    speed: [0, 0],
    life: [0.56, 0.56],
    size: [1, 1.08],
    colors: C.white,
    glow: true,
    glowLife: 0.5,
    alphaCurve: "none",
    layer: Layer.Fx,
  },
  /** Additive flash glow that shrinks (sizeMul = radius / 16). Not bloom-flagged: it already is a glow. */
  flare: {
    sprite: "fx_glow",
    frames: "fixed",
    speed: [0, 0],
    life: [0.2, 0.2],
    size: [1.2, 0.3],
    sizeCurve: "out",
    colors: C.white,
    alpha: 0.85,
    alphaCurve: "linear",
    additive: true,
    layer: Layer.FxAdd,
  },
  /** Tiny glowing embers flying out. */
  ember: {
    sprite: "fx_glow_s",
    frames: "fixed",
    speed: [30, 110],
    life: [0.3, 0.65],
    size: [0.35, 0.05],
    colors: [C.yellow, C.orange, C.paleYellow],
    drag: 3.5,
    gravity: 30,
    additive: true,
    glow: true,
    alphaCurve: "linear",
    layer: Layer.FxAdd,
  },
  /** Sakura petals tumbling with sway. */
  petals: {
    sprite: "fx_petal",
    frames: "loop",
    fps: 6,
    speed: [20, 70],
    life: [0.8, 1.5],
    size: [1, 0.9],
    colors: [C.pinkLight, C.pink, C.white],
    gravity: 35,
    drag: 1.8,
    sway: 22,
    rot: "random",
    spin: [1.5, 4],
    alphaCurve: "late",
    layer: Layer.Fx,
  },
  /** Little hearts floating up. */
  hearts: {
    sprite: "fx_heart",
    frames: "fixed",
    speed: [14, 34],
    angle: -PI / 2,
    spread: 1.4,
    life: [0.6, 1.0],
    size: [1, 0.8],
    sizeCurve: "pop",
    colors: [C.pink, C.red, C.pinkLight],
    gravity: -18,
    drag: 1,
    alphaCurve: "late",
    layer: Layer.Fx,
  },
  /** Tall light pillar (level up / chest). sizeMul ~ height / 32. */
  pillar: {
    sprite: "fx_glow",
    frames: "fixed",
    speed: [0, 0],
    life: [0.7, 0.7],
    size: [1, 1.15],
    aspect: 0.22,
    colors: C.paleYellow,
    alphaCurve: "inout",
    additive: true,
    glow: true,
    layer: Layer.FxAdd,
  },
  /**
   * Scorch decal: a faint burnt ring that fades over 2.5 s (sizeMul = radius / 16).
   * A ring, never a filled disc: filled grey discs read as shadows / King Puff's
   * landing telegraph. Emit through `emitScorch` (live budget of SCORCH_MAX).
   */
  scorch: {
    sprite: "fx_ring_thick",
    frames: "fixed",
    speed: [0, 0],
    life: [2.5, 2.5],
    size: [0.9, 0.85],
    // purple-tinted "magic burn" rather than a black hole on the pastel meadow
    colors: 0x4b3470,
    alpha: 0.12,
    alphaCurve: "linear",
    layer: Layer.Decal,
  },
  /** Sparkle trail dot for projectiles / gems (short, additive). */
  trail: {
    sprite: "fx_glow_s",
    frames: "fixed",
    speed: [0, 6],
    life: [0.16, 0.26],
    size: [0.32, 0.05],
    colors: C.white,
    additive: true,
    glow: true,
    alphaCurve: "linear",
    layer: Layer.FxAdd,
  },
  /** Coin / star shower bits (gold, bounce). */
  coins: {
    sprite: "coin",
    frames: "loop",
    fps: 12,
    speed: [30, 90],
    life: [0.9, 1.4],
    size: [1, 1],
    colors: C.white,
    bounce: { vz: [120, 220], gravity: 520, restitution: 0.4, friction: 6 },
    alphaCurve: "late",
    layer: Layer.Fx,
  },
} satisfies Record<string, EmitterDef>;

/** What composite effects need. */
export interface FxKit {
  ps: Particles;
  juice?: Juice;
}

/** At most this many scorch decals alive at once (explosions + Raijin blasts share it). */
export const SCORCH_MAX = 10;
const scorchUntil = new Float64Array(SCORCH_MAX);
let scorchClock = 0;

/**
 * Emit a scorch decal if fewer than SCORCH_MAX are alive (a ring of expiry
 * timestamps on the real clock: no allocation). Returns whether it was emitted.
 */
export function emitScorch(ps: Particles, x: number, y: number, sizeMul: number): boolean {
  const now = (scorchClock = typeof performance !== "undefined" ? performance.now() / 1000 : scorchClock + 0.016);
  for (let i = 0; i < SCORCH_MAX; i++)
    if (scorchUntil[i] <= now) {
      scorchUntil[i] = now + 2.5;
      ps.emit(P.scorch, x, y, 1, NaN, -1, sizeMul);
      return true;
    }
  return false;
}

/** Enemy death: pop -> confetti in its colours + white sparkles + puff + expanding ring. */
export function fxEnemyDeath(k: FxKit, x: number, y: number, colors: readonly number[], scale = 1): void {
  const ps = k.ps;
  const n = 8 + ((Math.random() * 7) | 0);
  for (let i = 0; i < n; i++) ps.emit(P.confetti, x, y - 4 * scale, 1, NaN, colors[i % colors.length], scale);
  ps.emit(P.sparkle, x, y - 5 * scale, 3, NaN, -1, scale);
  ps.emit(P.smoke, x, y - 4 * scale, 1, NaN, -1, scale);
  ps.emit(P.ring, x, y - 5 * scale, 1, NaN, colors[0] ?? C.white, 0.9 * scale);
}

/** Elite death: bigger everything + coin shower + shockwave + hitstop. */
export function fxEliteDeath(k: FxKit, x: number, y: number, colors: readonly number[]): void {
  const ps = k.ps;
  for (let i = 0; i < 30; i++) ps.emit(P.confetti, x, y - 8, 1, NaN, colors[i % colors.length], 1.3, 1.4);
  ps.emit(P.sparkle, x, y - 8, 10, NaN, -1, 1.2, 1.8);
  ps.emit(P.rays, x, y - 8, 12, NaN, colors[0] ?? C.white);
  ps.emit(P.ring, x, y - 8, 1, NaN, C.white, 2.4);
  ps.emit(P.ringThin, x, y - 8, 1, NaN, colors[0] ?? C.white, 3.2);
  ps.emit(P.coins, x, y - 6, 8);
  ps.emit(P.smoke, x, y - 6, 4, NaN, -1, 1.3);
  if (k.juice) {
    k.juice.hitstop(60);
    k.juice.shake(0.3);
    k.juice.shockwave(x, y - 6, 0.9, 70);
  }
}

/** Weapon hit: tinted impact burst + a couple of sparks along the hit direction. */
export function fxHit(k: FxKit, x: number, y: number, color: number = C.white, angle = NaN): void {
  k.ps.emit(P.hit, x, y, 1, NaN, color);
  k.ps.emit(P.sparkle, x, y, 2, angle, -1, 0.8, 1.6);
}

/** Explosion scaled to radius: sprite + flare + rays + debris + smoke + ring + scorch ring (budgeted) (+ juice). */
export function fxExplosion(k: FxKit, x: number, y: number, radius = 28, juice = true): void {
  const ps = k.ps;
  const s = radius / 16;
  ps.emit(P.explosion, x, y, 1, NaN, -1, s);
  ps.emit(P.flare, x, y, 1, NaN, C.paleYellow, s * 0.9);
  ps.emit(P.ring, x, y, 1, NaN, C.paleYellow, s * 1.15);
  ps.emit(P.rays, x, y, 8 + Math.round(radius / 6), NaN, -1, 0.8 + s * 0.2, 0.6 + s * 0.35);
  ps.emit(P.ember, x, y, 6 + Math.round(radius / 5), NaN, -1, 1, 0.7 + s * 0.3);
  ps.emit(P.debris, x, y, 5 + Math.round(radius / 6));
  ps.emit(P.smoke, x, y, 2 + Math.round(radius / 16), NaN, -1, 0.6 + s * 0.3, 1.5);
  emitScorch(ps, x, y, s * 0.75);
  if (juice && k.juice) {
    const p = Math.min(1, radius / 64);
    k.juice.shake(0.2 + 0.3 * p);
    k.juice.shockwave(x, y, 0.7 + 0.6 * p, radius * 2.2);
    k.juice.flash(C.paleYellow, 0.08 + 0.12 * p, 0.15);
    k.juice.aberration(0.8 + 1.5 * p);
  }
}

/** Level up: 24-ray burst, light pillar, 2 rings, golden flash, confetti (+ hitstop). */
export function fxLevelUp(k: FxKit, x: number, y: number): void {
  const ps = k.ps;
  for (let i = 0; i < 24; i++) ps.emit(P.rays, x, y - 10, 1, (i / 24) * TAU, i & 1 ? C.yellow : C.white, 1.2, 1.4);
  ps.emit(P.pillar, x, y - 30, 1, NaN, C.paleYellow, 3.2);
  ps.emit(P.pillar, x, y - 30, 1, NaN, C.white, 2.2);
  ps.emit(P.ring, x, y - 10, 1, NaN, C.yellow, 2.6);
  ps.emit(P.ringThin, x, y - 10, 1, NaN, C.white, 3.6);
  ps.emit(P.confetti, x, y - 10, 36, NaN, -1, 1.2, 1.5);
  ps.emit(P.sparkle, x, y - 12, 14, NaN, -1, 1.3, 2.2);
  if (k.juice) {
    k.juice.hitstop(100);
    k.juice.flash(C.paleYellow, 0.35, 0.3);
    k.juice.shockwave(x, y - 10, 1.0, 90);
    k.juice.bloomSurge(0.8, 0.8);
  }
}

/** Gem/coin collect sparkle. */
export function fxPickup(k: FxKit, x: number, y: number, color: number = C.aqua): void {
  k.ps.emit(P.sparkle, x, y, 2, NaN, color, 0.9);
  k.ps.emit(P.ringThin, x, y, 1, NaN, color, 0.45);
}

/** Dash: dust puffs behind + a few streaks against the move direction. */
export function fxDash(k: FxKit, x: number, y: number, dirX: number, dirY: number): void {
  const back = Math.atan2(-dirY, -dirX);
  k.ps.emit(P.dust, x, y, 4, back);
  k.ps.emit(P.rays, x, y - 8, 5, back, C.aqua, 0.7, 0.6);
  if (k.juice) k.juice.zoomPunch(0.035);
}

/** Generic multicolour celebration burst (chest open, victory fireworks). */
export function fxFirework(k: FxKit, x: number, y: number, colors: readonly number[] = CONFETTI_COLORS): void {
  const ps = k.ps;
  const c = colors[(Math.random() * colors.length) | 0];
  ps.emit(P.rays, x, y, 16, NaN, c, 1, 1.2);
  ps.emit(P.sparkle, x, y, 12, NaN, -1, 1.1, 2.5);
  ps.emit(P.ember, x, y, 14, NaN, c, 1.2, 1.6);
  ps.emit(P.ring, x, y, 1, NaN, c, 2.2);
}
