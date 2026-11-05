/**
 * Projectile trail presets, keyed by Projectile.trail (set by weapon /
 * ultimate files in the sim). To add one: add a key here and set
 * `p.trail = "<key>"` in the weapon.
 */
import { C } from "../art/palette";
import { P, type EmitterDef } from "../fx";
import { Layer } from "../render/layers";

export interface TrailDef {
  def: EmitterDef;
  /** Emit every N frames (per projectile, staggered by uid). */
  every: number;
  n: number;
  /** Colour cycle for emitted particles (undefined = the emitter's own colours). */
  colors?: readonly number[];
  /** Additive halo drawn under glowing projectiles. */
  color: number;
  halo: number;
  haloAlpha: number;
  yOff?: number;
}

const petalFall: EmitterDef = {
  sprite: "fx_petal",
  frames: "loop",
  fps: 6,
  speed: [4, 18],
  life: [0.35, 0.6],
  size: [1, 0.6],
  colors: [C.pinkLight, C.pink, C.white],
  gravity: 30,
  drag: 2,
  rot: "random",
  spin: [3, 8],
  alphaCurve: "late",
  layer: Layer.Fx,
};

const sparkTrail: EmitterDef = {
  ...P.sparkle,
  speed: [2, 10],
  life: [0.22, 0.36],
  size: [0.7, 0.7],
};

export const TRAILS: Record<string, TrailDef> = {
  star: { def: P.trail, every: 1, n: 1, colors: [C.paleYellow, C.yellow, C.white], color: C.yellow, halo: 8, haloAlpha: 0.35 },
  galaxy: { def: P.trail, every: 2, n: 1, colors: [C.pink, C.violet, C.pinkLight], color: C.pink, halo: 9, haloAlpha: 0.32 },
  slash: { def: petalFall, every: 2, n: 1, color: C.pinkLight, halo: 0, haloAlpha: 0 },
  petal: { def: P.trail, every: 3, n: 1, colors: [C.pinkLight, C.pink], color: C.pink, halo: 0, haloAlpha: 0 },
  meteor: { def: sparkTrail, every: 1, n: 2, colors: [C.paleYellow, C.yellow, C.white, C.pinkLight], color: C.yellow, halo: 16, haloAlpha: 0.5 },
  dust: { def: P.dust, every: 5, n: 1, color: C.white, halo: 0, haloAlpha: 0, yOff: 0 },
  orbit: { def: P.trail, every: 3, n: 1, colors: [C.violet, C.lavender], color: C.violet, halo: 9, haloAlpha: 0.3 },
};
