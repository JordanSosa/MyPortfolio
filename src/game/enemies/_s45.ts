/**
 * Beach Episode / The Final Arc sim helpers (helper - no `enemies` export, so
 * the registry ignores this file). Shared by the stage 4 / 5 enemies, bosses
 * and director events:
 *
 *   cue kinds   `enemyFx` kinds 400-499 (EFX_* in _fx.ts are the bestiary's 1-99):
 *               src/view/beach-fx.ts and src/view/finale-fx.ts turn them into juice
 *   env         the hero's environment: slow zones (tide water, ink puddles,
 *               jellyfish zaps) and pulls (Plot Holes), applied once per step by a
 *               single `step` hook per world (allocation-free; never touches Stats,
 *               so no stat recompute and nothing to undo)
 *
 * Content modules import values from here, never from world.ts (import rule).
 */
import type { Enemy } from "../types";
import type { World } from "../world";
import { efx } from "./_fx";
import { say } from "./_say";

// ---------------------------------------------------------------- cue kinds (enemyFx, 400-499)
/** Crab-kun sidesteps a projectile: (x, y) = new feet, (dx, dy) = shift direction, power = px. */
export const BX_SIDESTEP = 401;
/** A short lunge starts (crab / tiny shark chomp): (dx, dy) = direction. */
export const BX_LUNGE = 402;
/** A seagull grabbed a pickup ("MINE!"): power = pickup code (see SG_* in seagull.ts). */
export const BX_STEAL = 403;
/** A seagull starts its dive: (dx, dy) = direction. */
export const BX_DIVE = 404;
/** Jellyfish zap pulse: power = radius, dx = 1 when the hero was inside. */
export const BX_ZAP = 405;
/** Jellyfish death chain bolt: (x, y) -> (dx, dy) (a second point, not a direction). */
export const BX_CHAIN = 406;
/** Watermelon splits: power = halves. */
export const BX_SPLIT = 407;
/** Sandcastle Golem collapses into its pile. */
export const BX_PILE = 408;
/** A sand pile is stomped / blasted ("MOAT!"): power = 1 stomp, 2 blast. */
export const BX_MOAT = 409;
/** A sand pile rebuilds its golem. */
export const BX_REBUILD = 410;
/** Tiny Shark surfaces ("!"): power = elite ? 2 : 1. */
export const BX_SURFACE = 411;
/** Tiny Shark dives back into the sand. */
export const BX_SUBMERGE = 412;
/** Kraken-chan: a tentacle slams the sand (power = radius). */
export const BX_TENTACLE = 420;
/** Kraken-chan: HUG! (contact during the lunge). */
export const BX_HUG = 421;
/** Kraken-chan: an ink puddle lands (power = radius). */
export const BX_INK = 422;
/** Kraken-chan: ink cannon (cheeks puffed). */
export const BX_INK_CANNON = 423;
/** Kraken-chan: the HIGH TIDE rises (phase 2). */
export const BX_TIDE = 424;
/** Firework Dragon: a rocket launches from (x, y) toward (dx, dy) (a point), power = flight seconds. */
export const BX_ROCKET = 430;
/** Firework Dragon: a rocket bursts ("TAMAYA!"): power = bullets, dx = colour index. */
export const BX_BURST = 431;
/** Firework Dragon: sparkler breath (inhale -> breathe). */
export const BX_BREATH = 432;
/** Firework Dragon: dragon dance starts (dx = direction sign). */
export const BX_DANCE = 433;
/** Mini Truck-kun / Truck-kun: HONK (headlights flash, lane start). power = scale. */
export const BX_HONK = 450;
/** Mini Truck-kun runs over another enemy: isekai'd (a light pillar, no XP). */
export const BX_ISEKAI = 451;
/** Plot Hole swallows something (gem / projectile): a swirl at (x, y), power 1 gem / 2 shot. */
export const BX_SWALLOW = 452;
/** Plot Hole filled / collapsed: power = gems spat out, dx = 1 when filled (killed). */
export const BX_FILLED = 453;
/** Animation Error frame skip: (x, y) -> (dx, dy) (old position, a point). */
export const BX_SKIP = 454;
/** Filler Goon "reappears next episode". */
export const BX_RERUN = 455;
/** Shadow Clone mirrors the hero's dash: (dx, dy) = direction. */
export const BX_MIRROR = 456;
/** Truck-kun: drives off the view / re-enters (power 0 out, 1 in). */
export const BX_TRUCK_LANE = 460;
/** Truck-kun: Reverse Beep (one beep). */
export const BX_BEEP = 461;
/** Truck-kun: Horn Blast shockwave (power = radius). */
export const BX_HORN = 462;
/** Truck-kun: a traffic cone lobbed from (x, y) to (dx, dy) (a point). */
export const BX_CONE = 463;
/** Rival-chan: dash slash from (x, y) to (dx, dy) (a point). */
export const BX_SLASH = 470;
/** Rival-chan: beam charge starts (power = seconds). */
export const BX_BEAM_CHARGE = 471;
/** Rival-chan: TRAINING MONTAGE starts (power = seconds). */
export const BX_MONTAGE = 472;
/** Rival-chan: smoke bomb exit (death). */
export const BX_SMOKE = 473;
/** CANCEL-SAMA: the stamp slams (power = radius). */
export const BX_STAMP = 480;
/** CANCEL-SAMA: a degradation stage begins (power = phase 2..4). */
export const BX_DEGRADE = 481;
/** CANCEL-SAMA: still frame (power = seconds). */
export const BX_STILL = 482;
/** CANCEL-SAMA: restoration (death): colour floods back from (x, y). */
export const BX_RENEWED = 483;
/** CANCEL-SAMA: phone call / outsourcing (power = summoned count). */
export const BX_CALL = 484;
/** Commercial break starts (power = seconds) / ends (power = 0): letterbox + eyecatch. */
export const BX_COMMERCIAL = 490;
/** Flashback wave (sepia ring). */
export const BX_FLASHBACK = 491;
/** CANCEL-SAMA: smash "CUT TO:" back into view at (x, y) from (dx, dy) (a point). */
export const BX_CUT = 492;

/** Emit a stage cue (alias of efx: cosmetic, no-op while muted). */
export const cue = efx;

// ---------------------------------------------------------------- the hero's environment
export interface S45Env {
  /** Strongest slow factor reported this step by zones (1 = none). Reset after every step. */
  zoneK: number;
  /** Timed slow (jellyfish zap): factor + seconds left. */
  timedK: number;
  timedT: number;
  /** Pull displacement accumulated this step (px). */
  px: number;
  py: number;
  /** The slow applied last step (view: water splash under the hero). */
  slowNow: number;
}

const ENV = new WeakMap<World, S45Env>();

/** The world's environment state (installed on first use: one `step` listener per world). */
export function envOf(w: World): S45Env {
  let s = ENV.get(w);
  if (s) return s;
  const env: S45Env = { zoneK: 1, timedK: 1, timedT: 0, px: 0, py: 0, slowNow: 1 };
  s = env;
  ENV.set(w, env);
  w.hooks.on("step", (h) => {
    const p = w.player;
    if (env.timedT > 0) {
      env.timedT -= h.dt;
      if (env.timedT <= 0) env.timedK = 1;
    }
    const k = Math.min(env.zoneK, env.timedT > 0 ? env.timedK : 1);
    env.zoneK = 1;
    env.slowNow = k;
    if (p.dead || w.phase !== "play") {
      env.px = env.py = 0;
      return;
    }
    // slow: take back part of this step's own movement (a dash cuts through water at full speed)
    if (k < 1 && p.dashT <= 0) {
      p.x -= p.vx * h.dt * (1 - k);
      p.y -= p.vy * h.dt * (1 - k);
    }
    if (env.px !== 0 || env.py !== 0) {
      p.x += env.px;
      p.y += env.py;
      env.px = env.py = 0;
    }
  });
  return env;
}

/** The hero stands in a slow zone this step (`k` = speed factor, 0.6 = 40 % slower). */
export function slowZone(w: World, k: number): void {
  const s = envOf(w);
  if (k < s.zoneK) s.zoneK = k;
}

/** Slow the hero to `k` for `seconds` (refreshes; the stronger slow wins). */
export function slowFor(w: World, k: number, seconds: number): void {
  const s = envOf(w);
  if (s.timedT <= 0 || k <= s.timedK) s.timedK = k;
  s.timedT = Math.max(s.timedT, seconds);
}

/** Move the hero by (dx, dy) px at the end of this step (Plot Hole gravity). */
export function pullHero(w: World, dx: number, dy: number): void {
  const s = envOf(w);
  s.px += dx;
  s.py += dy;
}

// ---------------------------------------------------------------- small shared helpers
/** True when the enemy's body is inside the view by `margin` px (negative = well inside). */
export function inViewBody(e: Enemy, w: World, margin = 0): boolean {
  const p = w.player;
  return Math.abs(e.x - p.x) <= w.viewW * 0.5 + margin && Math.abs(e.y - e.cy - p.y) <= w.viewH * 0.5 + margin;
}

/** Live enemies of a def id (counting only). */
export function countAlive(w: World, id: string): number {
  let n = 0;
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const o = items[i];
    if (!o.dead && o.def.id === id) n++;
  }
  return n;
}

// ---------------------------------------------------------------- rate-limited behaviour shouts
/** Shout slots (one cooldown each, per world): a crowd of crabs doesn't all yell "Sidestep!" at once. */
export const Q_SIDESTEP = 0;
export const Q_MINE = 1;
export const Q_REBUILD = 2;
export const Q_RERUN = 3;
export const Q_HONK = 4;
export const Q_ROLL = 5;
export const Q_SEEDY = 6;
export const Q_NOM = 7;
const Q_SLOTS = 8;
const QUIPS = new WeakMap<World, Float64Array>();

/** `say()` a behaviour line unless the same kind of line was shouted less than `cooldown` s ago (World.t). */
export function quip(w: World, e: Enemy, text: string, slot: number, cooldown = 4): void {
  if (w.muted) return;
  let q = QUIPS.get(w);
  if (!q) {
    q = new Float64Array(Q_SLOTS).fill(-1e9);
    QUIPS.set(w, q);
  }
  if (w.t - q[slot] < cooldown) return;
  q[slot] = w.t;
  say(w, e, text);
}
