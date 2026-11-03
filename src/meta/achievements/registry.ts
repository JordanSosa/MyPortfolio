/**
 * Achievement registry: every `src/meta/achievements/defs/*.ts` exporting
 * `achievements: AchievementDef[]` (import.meta.glob, sorted by path, so the
 * order is stable). Adding a category file is enough; duplicate ids are
 * reported and skipped.
 */
import type { AchievementDef } from "./types";

type Mod = { achievements?: AchievementDef[] };

const mods = import.meta.glob<Mod>("./defs/*.ts", { eager: true });

function collect(): Map<string, AchievementDef> {
  const out = new Map<string, AchievementDef>();
  for (const path of Object.keys(mods).sort()) {
    for (const def of mods[path].achievements ?? []) {
      if (out.has(def.id)) {
        console.warn(`[achievements] duplicate id '${def.id}' in ${path} - skipped`);
        continue;
      }
      out.set(def.id, def);
    }
  }
  return out;
}

export const ACHIEVEMENTS: ReadonlyMap<string, AchievementDef> = collect();
export const ACHIEVEMENT_LIST: readonly AchievementDef[] = [...ACHIEVEMENTS.values()];
