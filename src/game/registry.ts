/**
 * Content registries, assembled automatically with import.meta.glob (works in
 * Vite and Vitest). To add content, drop a file into the folder - no shared
 * file needs editing:
 *
 *   src/game/weapons/<name>.ts    export const weapons: WeaponDef[] = [base, evolution];
 *   src/game/enemies/<name>.ts    export const enemies: EnemyDef[] = [...];
 *   src/game/bosses/<name>.ts     export const bosses: EnemyDef[] = [...];   (def.boss set)
 *   src/game/ultimates/<name>.ts  export const ultimates: UltimateDef[] = [...];
 *   src/game/stages/<name>.ts     export const stages: StageDef[] = [...];
 *   src/game/relics/<group>.ts    export const relics: RelicDef[] = [...];      (one file per rarity)
 *   src/game/talents/<hero>.ts    export const talentTrees: TalentTree[] = [...];
 *   src/game/twists/<group>.ts    export const twists: TwistDef[] = [...];
 *
 * Files without those exports (helpers such as `_shared.ts`) are ignored.
 * Ids must be unique; duplicates are reported and skipped. Registration
 * order is sorted by file path, so runs stay deterministic per seed.
 */
import type { RelicDef, StageInfo, TalentTree, TwistDef } from "./defs";
import { stageInfo, type StageDef } from "./stage";
import type { EnemyDef, UltimateDef, WeaponDef } from "./types";

type Mod = {
  weapons?: WeaponDef[];
  enemies?: EnemyDef[];
  bosses?: EnemyDef[];
  ultimates?: UltimateDef[];
  stages?: StageDef[];
  relics?: RelicDef[];
  twists?: TwistDef[];
  talentTrees?: TalentTree[];
};

const weaponMods = import.meta.glob<Mod>("./weapons/*.ts", { eager: true });
const enemyMods = import.meta.glob<Mod>("./enemies/*.ts", { eager: true });
const bossMods = import.meta.glob<Mod>("./bosses/*.ts", { eager: true });
const ultMods = import.meta.glob<Mod>("./ultimates/*.ts", { eager: true });
const stageMods = import.meta.glob<Mod>("./stages/*.ts", { eager: true });
const relicMods = import.meta.glob<Mod>("./relics/*.ts", { eager: true });
const talentMods = import.meta.glob<Mod>("./talents/*.ts", { eager: true });
const twistMods = import.meta.glob<Mod>("./twists/*.ts", { eager: true });

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
const stageMap = new Map<string, StageDef>(
  [...collect<StageDef>(stageMods, "stages", "stage").values()].sort((a, b) => a.order - b.order).map((d) => [d.id, d] as const),
);
/** Stages by id, sorted by StageDef.order. */
export const STAGES: ReadonlyMap<string, StageDef> = stageMap;

/**
 * Register a stage at runtime (tests, tools, sandboxes - shipped stages are files in
 * src/game/stages/). Replaces a stage with the same id.
 */
export function registerStage(def: StageDef): void {
  stageMap.set(def.id, def);
}
export const RELICS: ReadonlyMap<string, RelicDef> = collect<RelicDef>(relicMods, "relics", "relic");
export const TWISTS: ReadonlyMap<string, TwistDef> = collect<TwistDef>(twistMods, "twists", "twist");
/** Talent trees by hero id. */
export const TALENT_TREES: ReadonlyMap<string, TalentTree> = (() => {
  const out = new Map<string, TalentTree>();
  for (const path of Object.keys(talentMods).sort()) {
    for (const t of talentMods[path].talentTrees ?? []) {
      if (out.has(t.hero)) {
        console.warn(`[registry] duplicate talent tree for '${t.hero}' in ${path} - skipped`);
        continue;
      }
      out.set(t.hero, t);
    }
  }
  return out;
})();

/** Default stage id (RunConfig default, unknown ids fall back to it). */
export const DEFAULT_STAGE = "dream_meadow";

/** Stage def by id (unknown ids -> Dream Meadow, or the first registered stage). */
export function stageDef(id: string | undefined): StageDef {
  const d = (id && STAGES.get(id)) || STAGES.get(DEFAULT_STAGE) || STAGES.values().next().value;
  if (!d) throw new Error("[registry] no stage registered");
  return d;
}

/** Stage metadata for the account layer, in stage order. */
export function stageInfos(): StageInfo[] {
  return [...STAGES.values()].map(stageInfo);
}

/** Talent node lookup: hero tree node by talent id (talent ids are unique per tree). */
export function talentNode(hero: string, id: string): TalentTree["nodes"][number] | undefined {
  return TALENT_TREES.get(hero)?.nodes.find((n) => n.id === id);
}

/** Total heat of a set of twist ids at their ranks (rank r = the sum of TwistDef.heat[0..r-1]; unknown ids count 0). */
export function twistHeat(ids: readonly string[], ranks?: Record<string, number>): number {
  let h = 0;
  for (const id of ids) {
    const d = TWISTS.get(id);
    if (!d) continue;
    const r = Math.max(1, Math.min(d.maxRank, Math.floor(ranks?.[id] ?? 1)));
    for (let i = 0; i < r; i++) h += d.heat[i] ?? 0;
  }
  return h;
}

/** Enemy or boss def by id. */
export function enemyDef(id: string): EnemyDef | undefined {
  return ENEMIES.get(id) ?? BOSSES.get(id);
}

/** Base weapon of an evolved weapon (itself for a base weapon). */
export function baseWeaponOf(def: WeaponDef): WeaponDef {
  if (!def.evolved) return def;
  for (const w of WEAPONS.values()) if (w.evolution?.into === def.id) return w;
  return def;
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
