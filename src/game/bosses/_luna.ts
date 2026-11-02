/**
 * Lady Lunatic's per-boss state + moon-ring geometry (helper - no `bosses`
 * export). Kept free of runtime imports from world/registry so the bot and
 * the view can read the ring without creating an import cycle
 * (bot -> boss -> world -> registry -> boss).
 */
import { TAU } from "../../core/math";
import type { Enemy } from "../types";

/** Body centre height above the feet (bullet origin), before the float offset. */
export const LL_BODY = 30;
/** Moons in the P2 orbiting ring. */
export const LUNA_RING_N = 10;

export interface LunaState {
  /** Current (announced) phase 1..3. */
  phase: number;
  /** Position in the phase's pattern cycle. */
  pat: number;
  /** Volleys fired in the current pattern. */
  n: number;
  spin: number;
  dir: number;
  /** P2 moon ring age (-1 = no ring) and fade-out timer. */
  ringT: number;
  ringOut: number;
  /** Starfall lane column. */
  gap: number;
  /** Seconds of drifting before the next pattern. */
  drift: number;
}

const STATE = new WeakMap<Enemy, LunaState>();

/** State of a Lady Lunatic (view / tests / bot), or undefined. */
export function lunaState(e: Enemy): LunaState | undefined {
  return STATE.get(e);
}

/** State of a Lady Lunatic, created on first use (the boss module resets it in init()). */
export function lunaStateOf(e: Enemy): LunaState {
  let s = STATE.get(e);
  if (!s) {
    s = { phase: 1, pat: 0, n: 0, spin: 0, dir: 1, ringT: -1, ringOut: 0, gap: 4, drift: 1 };
    STATE.set(e, s);
  }
  return s;
}

/** Visual body centre y (bullets come from here). */
export function lunaBodyY(e: Enemy): number {
  return e.y - e.z - LL_BODY;
}

/** Position of ring moon `i` -> out. False when there is no ring. */
export function lunaRing(e: Enemy, i: number, out: { x: number; y: number }): boolean {
  const s = STATE.get(e);
  if (!s || s.ringT < 0 || e.dead) return false;
  const grow = Math.min(1, s.ringT / 0.9) * (s.ringOut > 0 ? s.ringOut / 0.6 : 1);
  if (grow <= 0) return false;
  // breathes between ~22 and ~58 px
  const R = (22 + 36 * (0.5 - 0.5 * Math.cos(s.ringT * 1.25))) * grow;
  const a = s.ringT * 1.2 * s.dir + (i / LUNA_RING_N) * TAU;
  out.x = e.x + Math.cos(a) * R;
  out.y = lunaBodyY(e) + Math.sin(a) * R;
  return true;
}
