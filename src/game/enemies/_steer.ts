/**
 * Shared steering helpers for enemy behaviours (no exports named `enemies`,
 * so the registry ignores this file).
 */
import type { Enemy } from "../types";
import type { World } from "../world";

/** Unit direction from the enemy to the player -> out, returns the distance. */
export function toPlayer(e: Enemy, w: World, out: { x: number; y: number }): number {
  const dx = w.player.x - e.x;
  const dy = w.player.y - e.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  out.x = dx / d;
  out.y = dy / d;
  return d;
}

const dir = { x: 0, y: 0 };

/** Plain chase at `speed`. */
export function seek(e: Enemy, w: World, speed: number): number {
  const d = toPlayer(e, w, dir);
  e.vx = dir.x * speed;
  e.vy = dir.y * speed;
  return d;
}

/** Chase with a sideways sine weave (amplitude as a fraction of speed). */
export function weave(e: Enemy, w: World, speed: number, freq: number, amp: number): number {
  const d = toPlayer(e, w, dir);
  const s = Math.sin(e.t * freq + e.a) * amp;
  // fade the weave out up close so they still connect
  const k = Math.min(1, d / 50);
  e.vx = (dir.x - dir.y * s * k) * speed;
  e.vy = (dir.y + dir.x * s * k) * speed;
  return d;
}

/** Keep roughly `range` px away (shooters). */
export function keepAway(e: Enemy, w: World, speed: number, range: number): number {
  const d = toPlayer(e, w, dir);
  const k = d > range + 10 ? 1 : d < range - 10 ? -0.8 : 0;
  // orbit a little while holding position
  const o = Math.sin(e.t * 0.7 + e.a) * 0.5;
  e.vx = (dir.x * k - dir.y * o) * speed;
  e.vy = (dir.y * k + dir.x * o) * speed;
  return d;
}
