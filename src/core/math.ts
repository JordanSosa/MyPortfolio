/**
 * Math helpers: scalar utils, 2D vectors (allocation-free style), easing,
 * angles, damping/springs and smooth value noise (for camera shake etc).
 * Everything here is pure and allocation-free unless it says otherwise.
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

// ---------------------------------------------------------------- scalars
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const saturate = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Inverse lerp: where `v` sits between a and b (unclamped). */
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
/** Map v from [a0,a1] to [b0,b1] (unclamped). */
export const remap = (v: number, a0: number, a1: number, b0: number, b1: number): number => b0 + (b1 - b0) * invLerp(a0, a1, v);
export const remapClamped = (v: number, a0: number, a1: number, b0: number, b1: number): number =>
  b0 + (b1 - b0) * saturate(invLerp(a0, a1, v));
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = saturate((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (e0: number, e1: number, x: number): number => {
  const t = saturate((x - e0) / (e1 - e0));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const sign = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);
/** Move `v` toward `target` by at most `step`. */
export const approach = (v: number, target: number, step: number): number =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);
/** Positive modulo. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;
/** Triangle wave 0..1..0 over period 1. */
export const pingpong = (t: number): number => 1 - Math.abs((mod(t, 2)) - 1);
export const fract = (v: number): number => v - Math.floor(v);

/**
 * Frame-rate independent exponential damping toward `target`.
 * `lambda` ~ responsiveness (higher = snappier; 10 = reaches ~63% in 0.1 s).
 */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  target + (current - target) * Math.exp(-lambda * dt);

/** Unity-style SmoothDamp. Returns the new value; velocity is read/written in `vel.v`. */
export function smoothDamp(current: number, target: number, vel: { v: number }, smoothTime: number, dt: number, maxSpeed = Infinity): number {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, -maxChange, maxChange);
  const t = current - change;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  let out = t + (change + temp) * exp;
  if (target - current > 0 === out > target) {
    out = target;
    vel.v = (out - target) / Math.max(dt, 1e-6);
  }
  return out;
}

/**
 * Critically/under-damped spring step (semi-implicit Euler). Great for squash
 * and stretch: kick `s.v`, the value springs back to `target`.
 *   const sq = { x: 1, v: 0 };  ...  sq.v -= 6;  springStep(sq, 1, 300, 14, dt)
 */
export function springStep(s: { x: number; v: number }, target: number, stiffness: number, damping: number, dt: number): void {
  const a = -stiffness * (s.x - target) - damping * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

// ---------------------------------------------------------------- vectors
export interface Vec2 {
  x: number;
  y: number;
}
export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y });
export const len = (x: number, y: number): number => Math.sqrt(x * x + y * y);
export const len2 = (x: number, y: number): number => x * x + y * y;
export const dist = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
};
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};
export const dot = (ax: number, ay: number, bx: number, by: number): number => ax * bx + ay * by;
export const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

/** Write normalised (x,y) into `out` (zero vector stays zero). Returns out. */
export function normalize(out: Vec2, x: number, y: number): Vec2 {
  const l = Math.sqrt(x * x + y * y);
  if (l > 1e-9) {
    out.x = x / l;
    out.y = y / l;
  } else {
    out.x = 0;
    out.y = 0;
  }
  return out;
}
export function setVec(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}
/** Clamp vector length to max (in place). */
export function clampLen(v: Vec2, max: number): Vec2 {
  const l2 = v.x * v.x + v.y * v.y;
  if (l2 > max * max) {
    const k = max / Math.sqrt(l2);
    v.x *= k;
    v.y *= k;
  }
  return v;
}
/** Rotate (x,y) by angle into out. */
export function rotate(out: Vec2, x: number, y: number, a: number): Vec2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  out.x = x * c - y * s;
  out.y = x * s + y * c;
  return out;
}
export function fromAngle(out: Vec2, a: number, length = 1): Vec2 {
  out.x = Math.cos(a) * length;
  out.y = Math.sin(a) * length;
  return out;
}

// ---------------------------------------------------------------- angles
export const angleTo = (ax: number, ay: number, bx: number, by: number): number => Math.atan2(by - ay, bx - ax);
/** Wrap to (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
/** Shortest signed difference b - a in (-PI, PI]. */
export const angleDiff = (a: number, b: number): number => wrapAngle(b - a);
export const lerpAngle = (a: number, b: number, t: number): number => a + angleDiff(a, b) * t;
export const dampAngle = (a: number, b: number, lambda: number, dt: number): number =>
  a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
/** Rotate angle `a` toward `b` by at most `step` radians. */
export function approachAngle(a: number, b: number, step: number): number {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

// ---------------------------------------------------------------- easing (t in 0..1)
export type EaseFn = (t: number) => number;
const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = TAU / 3;
const c5 = TAU / 4.5;

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

export const ease = {
  linear: (t: number) => t,
  quadIn: (t: number) => t * t,
  quadOut: (t: number) => 1 - (1 - t) * (1 - t),
  quadInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  cubicIn: (t: number) => t * t * t,
  cubicOut: (t: number) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  quartOut: (t: number) => 1 - Math.pow(1 - t, 4),
  quintOut: (t: number) => 1 - Math.pow(1 - t, 5),
  sineIn: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  sineOut: (t: number) => Math.sin((t * Math.PI) / 2),
  sineInOut: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  expoIn: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  expoOut: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  expoInOut: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  circOut: (t: number) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  backIn: (t: number) => c3 * t * t * t - c1 * t * t,
  backOut: (t: number) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  backInOut: (t: number) =>
    t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2,
  elasticIn: (t: number) => (t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4)),
  elasticOut: (t: number) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1),
  elasticInOut: (t: number) =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1,
  bounceOut,
  bounceIn: (t: number) => 1 - bounceOut(1 - t),
} satisfies Record<string, EaseFn>;
export type EaseName = keyof typeof ease;

/** Back-out with configurable overshoot (default ~10%). */
export function easeOutBack(t: number, overshoot = c1): number {
  const k = overshoot + 1;
  return 1 + k * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}
/** Elastic out with configurable period. */
export function easeOutElastic(t: number, period = 0.3): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin(((t - period / 4) * TAU) / period) + 1;
}
/** Bell curve 0 -> 1 -> 0 over t in 0..1 (sin based). */
export const bell = (t: number): number => (t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI));

// ---------------------------------------------------------------- noise
// Smooth 1D/2D value noise in [-1, 1]. Deterministic, allocation-free.
function hash1(i: number): number {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ 0x165667b1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function hash2(x: number, y: number): number {
  return hash1(Math.imul(x | 0, 0x1f1f1f1f) ^ Math.imul(y | 0, 0x3c6ef372));
}
/** Integer hash -> [0,1). Handy for deterministic per-tile randomness. */
export const hash01 = (x: number, y = 0): number => hash2(x, y);

/** Smooth value noise, -1..1, period-free. `seed` offsets the lattice. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash1(i + seed * 1013);
  const b = hash1(i + 1 + seed * 1013);
  return (a + (b - a) * u) * 2 - 1;
}
export function noise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const s = seed * 7919;
  const a = hash2(ix + s, iy);
  const b = hash2(ix + 1 + s, iy);
  const c = hash2(ix + s, iy + 1);
  const d = hash2(ix + 1 + s, iy + 1);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}
/** Fractal 1D noise (2 octaves), -1..1. Nicer for shake. */
export const fbm1 = (x: number, seed = 0): number => noise1(x, seed) * 0.7 + noise1(x * 2.13 + 17.1, seed + 3) * 0.3;
