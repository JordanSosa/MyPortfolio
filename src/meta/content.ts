/**
 * Content catalogue for the account layer: a read-only snapshot of what the
 * simulation registers (heroes, weapons, passives, enemies, bosses, stages,
 * relics, talent trees, Plot Twists), with the derived lookups src/meta needs.
 *
 * Every meta function that reads content takes an optional `ctx: MetaContent`
 * (default: `gameContent()`, built once from the src/game registries), so
 * tests can run the economy / gacha / board against a small fixed catalogue
 * and the account rules never depend on how many items the content wave has
 * shipped so far.
 */
import type { RelicDef, StageInfo, TalentTree, TwistDef } from "../game/defs";
import { HEROES } from "../game/heroes";
import { PASSIVES } from "../game/passives";
import { BOSSES, ENEMIES, RELICS, stageInfos, TALENT_TREES, TWISTS, WEAPONS } from "../game/registry";

export interface HeroInfo {
  id: string;
  name: string;
  title: string;
  /** Signature (start) weapon id. */
  weapon: string;
  portrait: string;
  /** Constellation stars C1..C6 (name + effect text) for the heroes screen. */
  constellations?: readonly { name: string; desc: string }[];
}

export interface WeaponInfo {
  id: string;
  name: string;
  icon: string;
  evolved: boolean;
  /** Base weapons: the evolution's id and the passive it needs. */
  evolution?: { into: string; with: string };
  /** Evolved weapons: the base weapon id (mastery is tracked on the base). */
  baseOf?: string;
}

export interface NamedInfo {
  id: string;
  name: string;
  icon?: string;
}

export interface MetaContent {
  heroes: readonly HeroInfo[];
  heroById: ReadonlyMap<string, HeroInfo>;
  /** Every weapon incl. evolutions. */
  weapons: ReadonlyMap<string, WeaponInfo>;
  /** Base (non-evolved) weapons in registry order. */
  baseWeapons: readonly WeaponInfo[];
  passives: ReadonlyMap<string, NamedInfo>;
  /** Regular enemies (no props, no bosses, no `noCodex` actors). */
  enemies: ReadonlyMap<string, NamedInfo>;
  bosses: ReadonlyMap<string, NamedInfo>;
  /** Stages sorted by `order`. */
  stages: readonly StageInfo[];
  stageById: ReadonlyMap<string, StageInfo>;
  relics: ReadonlyMap<string, RelicDef>;
  /** Talent trees by hero id. */
  talents: ReadonlyMap<string, TalentTree>;
  /** Talent node by id (across all trees) with its hero. */
  talentNodes: ReadonlyMap<string, { hero: string; tree: TalentTree; node: TalentTree["nodes"][number] }>;
  twists: ReadonlyMap<string, TwistDef>;
}

export interface ContentParts {
  heroes?: readonly HeroInfo[];
  weapons?: readonly WeaponInfo[];
  passives?: readonly NamedInfo[];
  enemies?: readonly NamedInfo[];
  bosses?: readonly NamedInfo[];
  stages?: readonly StageInfo[];
  relics?: readonly RelicDef[];
  talents?: readonly TalentTree[];
  twists?: readonly TwistDef[];
}

/** Dream Meadow as the sim shipped it before the stage registry (used only when no stage is registered). */
export const FALLBACK_STAGE: StageInfo = {
  id: "dream_meadow",
  name: "Dream Meadow",
  subtitle: "Episode 1: The Plushies Are Restless",
  order: 1,
  duration: 600,
  bosses: ["king_puff", "nightmare_teddy", "lady_lunatic"],
  rewardMul: 1,
};

const byId = <T extends { id: string }>(list: readonly T[]): Map<string, T> => new Map(list.map((x) => [x.id, x]));

/** Build a catalogue from parts (tests, tools). Missing parts are empty; derived lookups are filled in. */
export function makeContent(parts: ContentParts): MetaContent {
  const weapons = new Map<string, WeaponInfo>();
  for (const w of parts.weapons ?? []) weapons.set(w.id, { ...w });
  // evolved -> base links
  for (const w of weapons.values()) {
    if (!w.evolved && w.evolution) {
      const evo = weapons.get(w.evolution.into);
      if (evo && !evo.baseOf) evo.baseOf = w.id;
    }
  }
  const stages = [...(parts.stages ?? [])].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  const talents = new Map<string, TalentTree>();
  const talentNodes = new Map<string, { hero: string; tree: TalentTree; node: TalentTree["nodes"][number] }>();
  for (const t of parts.talents ?? []) {
    if (talents.has(t.hero)) continue;
    talents.set(t.hero, t);
    for (const n of t.nodes) if (!talentNodes.has(n.id)) talentNodes.set(n.id, { hero: t.hero, tree: t, node: n });
  }
  const heroes = [...(parts.heroes ?? [])];
  return {
    heroes,
    heroById: byId(heroes),
    weapons,
    baseWeapons: [...weapons.values()].filter((w) => !w.evolved),
    passives: byId(parts.passives ?? []),
    enemies: byId(parts.enemies ?? []),
    bosses: byId(parts.bosses ?? []),
    stages,
    stageById: byId(stages),
    relics: byId(parts.relics ?? []),
    talents,
    talentNodes,
    twists: byId(parts.twists ?? []),
  };
}

let cached: MetaContent | null = null;

/** The live catalogue from the src/game registries (built once). */
export function gameContent(): MetaContent {
  if (cached) return cached;
  const weapons: WeaponInfo[] = [];
  for (const w of WEAPONS.values()) weapons.push({ id: w.id, name: w.name, icon: w.icon, evolved: !!w.evolved, evolution: w.evolution ? { ...w.evolution } : undefined });
  const enemies: NamedInfo[] = [];
  for (const e of ENEMIES.values()) if (!e.prop && !e.boss && !e.noCodex) enemies.push({ id: e.id, name: e.name, icon: e.sprite });
  const bosses: NamedInfo[] = [];
  for (const b of BOSSES.values()) bosses.push({ id: b.id, name: b.name, icon: b.sprite });
  const stages = stageInfos();
  cached = makeContent({
    heroes: HEROES.map((h) => ({
      id: h.id,
      name: h.name,
      title: h.title,
      weapon: h.weapon,
      portrait: h.portrait,
      constellations: h.constellations?.map((c) => ({ name: c.name, desc: c.desc })),
    })),
    weapons,
    passives: PASSIVES.map((p) => ({ id: p.id, name: p.name, icon: p.icon })),
    enemies,
    bosses,
    stages: stages.length ? stages : [FALLBACK_STAGE],
    relics: [...RELICS.values()],
    talents: [...TALENT_TREES.values()],
    twists: [...TWISTS.values()],
  });
  return cached;
}

// ---------------------------------------------------------------- lookups

/** Base weapon id for any weapon id (evolutions map to their base; unknown ids map to themselves). */
export function baseWeaponId(id: string, ctx: MetaContent = gameContent()): string {
  return ctx.weapons.get(id)?.baseOf ?? id;
}

/** Stage by 1-based order. */
export function stageByOrder(order: number, ctx: MetaContent = gameContent()): StageInfo | undefined {
  for (const s of ctx.stages) if (s.order === order) return s;
  return undefined;
}

/** The first stage (lowest order). */
export function firstStage(ctx: MetaContent = gameContent()): StageInfo {
  return ctx.stages[0] ?? FALLBACK_STAGE;
}

/** Final boss id of a stage (its last boss), if any. */
export function finalBossOf(stage: StageInfo | undefined): string | undefined {
  return stage && stage.bosses.length > 0 ? stage.bosses[stage.bosses.length - 1] : undefined;
}

/** Display name of any content id (hero, weapon, passive, enemy, boss, stage, relic, twist), else the id. */
export function contentName(id: string, ctx: MetaContent = gameContent()): string {
  return (
    ctx.heroById.get(id)?.name ??
    ctx.weapons.get(id)?.name ??
    ctx.passives.get(id)?.name ??
    ctx.enemies.get(id)?.name ??
    ctx.bosses.get(id)?.name ??
    ctx.stageById.get(id)?.name ??
    ctx.relics.get(id)?.name ??
    ctx.twists.get(id)?.name ??
    id
  );
}
