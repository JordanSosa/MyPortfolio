/**
 * Stage content cosmetic cues (helper - no `enemies` export). Stage enemies,
 * bosses and director events emit `stageCue` events with namespaced string
 * kinds ("candy_heal", "academy_glare"...); each stage's view file
 * (src/view/candy-fx.ts, academy-fx.ts...) handles its own kinds. One reused
 * payload: emitting never allocates; a no-op while the world is muted.
 */
import type { StageCueEvent } from "../events";
import type { Enemy } from "../types";
import type { World } from "../world";

const ev: StageCueEvent = { kind: "", x: 0, y: 0, x2: 0, y2: 0, r: 0, n: 0, enemy: null };

export function cue(w: World, kind: string, x: number, y: number, x2 = 0, y2 = 0, r = 0, n = 0, enemy: Enemy | null = null): void {
  if (w.muted) return;
  ev.kind = kind;
  ev.x = x;
  ev.y = y;
  ev.x2 = x2;
  ev.y2 = y2;
  ev.r = r;
  ev.n = n;
  ev.enemy = enemy;
  w.bus.emit("stageCue", ev);
  ev.enemy = null;
}
