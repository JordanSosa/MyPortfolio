/**
 * The victory dawn shared by every final boss (helper - no `bosses` export,
 * import-cycle free: types only from world): when a final boss falls, the
 * enemy bullets clear and every other on-screen enemy dissolves in light,
 * outward from the boss (`EFX_DAWN_POP`, staggered by distance); the rest
 * just leave. Lady Lunatic, the Candy / Academy finals (`_s23.ts dawnOut`)
 * and the Beach / Final Arc finals (`_s45boss.ts finalDawn`) all call this.
 */
import type { Enemy } from "../types";
import type { World } from "../world";
import { EFX_DAWN_POP, efx, onScreen } from "../enemies/_fx";

export function dawnOut(e: Enemy, w: World): void {
  w.clearBullets();
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const o = items[i];
    if (o === e || o.dead) continue;
    if (!o.def.prop && onScreen(w, o.x, o.y, 30)) {
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      efx(w, EFX_DAWN_POP, o.x, o.y, 0, 0, 0.35 + Math.sqrt(dx * dx + dy * dy) / 260, o);
    }
    w.despawn(o);
  }
}
