/**
 * Content registries, assembled automatically with import.meta.glob (works in
 * Vite and Vitest). To add content, drop a file into the folder - no shared
 * file needs editing:
 *
 *   src/game/weapons/<name>.ts    export const weapons: WeaponDef[] = [base, evolution];
 *   src/game/enemies/<name>.ts    export const enemies: EnemyDef[] = [...];
 *   src/game/bosses/<name>.ts     export const bosses: EnemyDef[] = [...];   (def.boss set)
 *   src/game/ultimates/<name>.ts  export const ultimates: UltimateDef[] = [...];
 *
 * Files without those exports (helpers such as `_shared.ts`) are ignored.
 * Ids must be unique; duplicates are reported and skipped. Registration
 * order is sorted by file path, so runs stay deterministic per seed.
 */
import type { EnemyDef, UltimateDef, WeaponDef } from "./types";

type Mod = { weapons?: WeaponDef[]; enemies?: EnemyDef[]; bosses?: EnemyDef[]; ultimates?: UltimateDef[] };

const weaponMods = import.meta.glob<Mod>("./weapons/*.ts", { eager: true });
const enemyMods = import.meta.glob<Mod>("./enemies/*.ts", { eager: true });
const bossMods = import.meta.glob<Mod>("./bosses/*.ts", { eager: true });
const ultMods = import.meta.glob<Mod>("./ultimates/*.ts", { eager: true });

function collect<T extends { id: string }>(mods: Record<string, Mod>, key: keyof Mod, what: string): Map<string, T> {
  const out = new Map<string, T>();
  for (const path of Object.keys(mods).sort()) {
    const list = mods[path][key] as T[] | undefined;
    if (!list) continue;
    for (const def of list) {
      if (out.has(def.id)) {
        console.warn(`[registry] duplicate ${what} id '${def.id}' in ${path} - skipped`);
        continue;
      }
      out.set(def.id, def);
    }
  }
  return out;
}

export const WEAPONS: ReadonlyMap<string, WeaponDef> = collect<WeaponDef>(weaponMods, "weapons", "weapon");
export const ENEMIES: ReadonlyMap<string, EnemyDef> = collect<EnemyDef>(enemyMods, "enemies", "enemy");
export const BOSSES: ReadonlyMap<string, EnemyDef> = collect<EnemyDef>(bossMods, "bosses", "boss");
export const ULTIMATES: ReadonlyMap<string, UltimateDef> = collect<UltimateDef>(ultMods, "ultimates", "ultimate");

/** Enemy or boss def by id. */
export function enemyDef(id: string): EnemyDef | undefined {
  return ENEMIES.get(id) ?? BOSSES.get(id);
}

/** Base (non-evolved) weapons that can be offered as NEW. */
export function baseWeapons(): WeaponDef[] {
  const out: WeaponDef[] = [];
  for (const w of WEAPONS.values()) if (!w.evolved) out.push(w);
  return out;
}

/** The evolution a base weapon turns into (if its def and the target exist). */
export function evolutionOf(base: WeaponDef): WeaponDef | undefined {
  return base.evolution ? WEAPONS.get(base.evolution.into) : undefined;
}
