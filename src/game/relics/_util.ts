/**
 * Relic / talent helpers (no `relics` export: the registry ignores this file).
 */
import type { World } from "../world";

const procEv = { id: "", x: 0, y: 0, v: 0 };

/**
 * Tell the view a relic / talent / twist effect fired at (x, y) (flourish,
 * name tag, banner; src/view/relic-fx.ts). One reused payload, muted-safe.
 * `v` carries an effect value the view needs (e.g. a buff's duration).
 */
export function proc(w: World, id: string, x: number, y: number, v = 0): void {
  if (w.muted) return;
  procEv.id = id;
  procEv.x = x;
  procEv.y = y;
  procEv.v = v;
  w.emit("relicProc", procEv);
}

/** Value at a star level from a ★0..★6 table (docs/content/relics.md "Values"). */
export function atStar(table: readonly number[], stars: number): number {
  return table[Math.max(0, Math.min(table.length - 1, Math.floor(stars)))];
}

/**
 * Recompute the stats whenever `key()` changes (a `statMods` entry that reads run state: combo rank,
 * HP threshold, MINT / OPENED...). One step listener; `key` must be cheap and allocation-free.
 */
export function dirtyOn(w: World, key: () => number): void {
  let last = key();
  w.hooks.on("step", () => {
    const k = key();
    if (k !== last) {
      last = k;
      w.statsDirty = true;
    }
  });
}

/** "+3.5%" style number for card text (no trailing zeros). */
export function num(v: number): string {
  return `${Math.round(v * 100) / 100}`;
}
