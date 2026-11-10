/**
 * Boss entrance / headroom geometry (import-free helper: the director, the boss
 * modules and tests share it without an import cycle through the registry).
 *
 * The top HUD (timer, XP bar, boss bar) covers roughly the top 13 % of a portrait
 * phone and 18 % of a landscape one: a boss keeps its sprite top (feet - body
 * height - hover z) at least `bossHeadroom(viewH)` below the view top, so its
 * name card never plays over an off-screen or HUD-covered boss.
 */
import type { World } from "../world";

/** Minimum gap (art px) between the view top and a boss's sprite top. */
export const BOSS_TOP_MIN = 36;
export const BOSS_TOP_K = 0.2;

export function bossHeadroom(viewH: number): number {
  return Math.max(BOSS_TOP_MIN, viewH * BOSS_TOP_K);
}

/** Smallest feet y that keeps a sprite `top` px tall (body + hover z) under the HUD. */
export function minBossFeetY(w: World, top: number): number {
  return w.player.y - w.viewH * 0.5 + bossHeadroom(w.viewH) + top;
}
