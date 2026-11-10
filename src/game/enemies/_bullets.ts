/**
 * Fair enemy-bullet helpers shared by shooters and bosses (helper - no
 * `enemies` export). Every shot goes through `shoot()`, which refuses to
 * spawn a bullet on top of the player (DESIGN pillar 5: readable chaos).
 *
 * Hitboxes are deliberately smaller than the glowing sprites (bullet-hell
 * convention): a moon (12 px sprite) hits with r 3, the player's hurt circle
 * is CFG.playerRadius - 2, so two bullets ~15 px apart leave a lane.
 */
import { CFG } from "../config";
import type { World } from "../world";
import type { Bullet } from "../types";

/** No bullet may appear closer than this to the player's body centre (px). */
export const SAFE_SPAWN = 24;

export const B_ORB = "eb_orb";
export const B_STAR = "eb_star";
export const B_MOON = "eb_moon";

/** Collision radius per bullet sprite (smaller than the art = fair). */
export function bulletRadius(sprite: string): number {
  return sprite === B_MOON ? 3 : sprite === B_STAR ? 2.5 : 2.5;
}

/** Spawn one bullet at (x, y) flying at `ang` with `speed`, unless it would appear on the player. */
export function shoot(w: World, x: number, y: number, ang: number, speed: number, dmg: number, sprite = B_ORB, life = 7): Bullet | null {
  const p = w.player;
  const dx = x - p.x;
  const dy = y - (p.y - CFG.playerCy);
  if (dx * dx + dy * dy < SAFE_SPAWN * SAFE_SPAWN) return null;
  return w.spawnBullet(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, dmg, sprite, bulletRadius(sprite), life);
}

/**
 * Ring of `n` bullets around (x, y), starting `r0` px out from the centre.
 * Returns the number actually spawned.
 */
export function ring(w: World, x: number, y: number, n: number, a0: number, speed: number, dmg: number, sprite = B_ORB, r0 = 8, turn = 0, accel = 0): number {
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const b = shoot(w, x + Math.cos(a) * r0, y + Math.sin(a) * r0, a, speed, dmg, sprite);
    if (b) {
      b.turn = turn;
      b.accel = accel;
      k++;
    }
  }
  return k;
}

/** Fan of `n` bullets centred on `aim`, `step` radians apart. */
export function fan(w: World, x: number, y: number, n: number, aim: number, step: number, speed: number, dmg: number, sprite = B_ORB, r0 = 6): number {
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = aim + (i - (n - 1) / 2) * step;
    if (shoot(w, x + Math.cos(a) * r0, y + Math.sin(a) * r0, a, speed, dmg, sprite)) k++;
  }
  return k;
}

/** Angle from (x, y) to the player's body centre. */
export function aimAt(w: World, x: number, y: number): number {
  return Math.atan2(w.player.y - CFG.playerCy - y, w.player.x - x);
}
