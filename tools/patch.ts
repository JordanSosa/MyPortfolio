/**
 * Tuning patches for the balance tools (tools/matrix.sim.ts `--variants`, tools/progression.sim.ts `PATCH=`):
 * dotted paths into the LIVE content, applied in place and undone afterwards (sweeps without editing files).
 */
import { CFG } from "../src/game/config";
import { BOSSES, ENEMIES, STAGES, WEAPONS } from "../src/game/registry";

/**
 * A tuning patch: dotted paths into the live content -> values, applied before a job and
 * restored after it (sweeps without editing files):
 *   "cfg.playerHp": 80, "stage.dream_meadow.scaling": {...}, "stage.dream_meadow.phases": [...],
 *   "boss.king_puff.hp": 4000, "enemy.puff.hp": 12, "weapon.star_shot.levels.0.dmg": 9
 */
export type Patch = Record<string, unknown>;

function resolveRoot(head: string, id: string): Record<string, unknown> | undefined {
  switch (head) {
    case "cfg":
      return CFG as unknown as Record<string, unknown>;
    case "stage":
      return STAGES.get(id) as unknown as Record<string, unknown>;
    case "boss":
      return (BOSSES.get(id) ?? ENEMIES.get(id)) as unknown as Record<string, unknown>;
    case "enemy":
      return ENEMIES.get(id) as unknown as Record<string, unknown>;
    case "weapon":
      return WEAPONS.get(id) as unknown as Record<string, unknown>;
  }
  return undefined;
}

/** Apply a patch; returns the undo function. */
export function applyPatch(patch: Patch | undefined): () => void {
  const undo: (() => void)[] = [];
  for (const [path, value] of Object.entries(patch ?? {})) {
    if (path.startsWith("_")) continue; // (matrix options such as "_only")
    const parts = path.split(".");
    const head = parts.shift()!;
    let obj: Record<string, unknown> | undefined = head === "cfg" ? resolveRoot(head, "") : resolveRoot(head, parts.shift() ?? "");
    if (!obj) throw new Error(`patch: unknown root in ${path}`);
    const last = parts.pop()!;
    for (const k of parts) obj = obj?.[k] as Record<string, unknown> | undefined;
    if (!obj || !last) throw new Error(`patch: bad path ${path}`);
    const target = obj;
    const had = Object.prototype.hasOwnProperty.call(target, last);
    const old = target[last];
    target[last] = value && typeof value === "object" && !Array.isArray(value) && old && typeof old === "object" && !Array.isArray(old) ? { ...(old as object), ...(value as object) } : value;
    undo.push(() => {
      if (had) target[last] = old;
      else delete target[last];
    });
  }
  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i]();
  };
}

