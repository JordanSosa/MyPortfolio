/**
 * Enemy speech bubbles, sim side (helper - no `enemies` export). Behaviours
 * and bosses call `say()` for scripted lines ("NO RUNNING!", "Toasty!", boss
 * taunts); the view (src/view/speech.ts) owns the line pools, the ambient
 * "4 % on entering the view" rule, the caps and the drawing (satire.md §5-6).
 * One reused payload; a no-op while the world is muted (fast-forwards).
 */
import type { EnemySayEvent } from "../events";
import type { Enemy } from "../types";
import type { World } from "../world";

const ev: EnemySayEvent = { enemy: null, text: "", force: true };

/** `e` says `text` ("" = a random line from its pool). `force` = scripted (skips chance + cooldown). */
export function say(w: World, e: Enemy, text = "", force = true): void {
  if (w.muted) return;
  ev.enemy = e;
  ev.text = text;
  ev.force = force;
  w.bus.emit("enemySay", ev);
  ev.enemy = null;
}
