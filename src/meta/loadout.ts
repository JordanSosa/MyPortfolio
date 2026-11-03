/**
 * Loadout -> RunConfig (docs/EXPANSION.md §8, §14): validates a loadout
 * choice (locked stage / hero / twist, relic slots, ownership) and combines
 * every progression track into the sim's RunConfig contract:
 *
 *   board (stat mod, flags, slots, start bonuses) + hero level (+1% dmg / HP per level)
 *   + talents + constellation + weapon mastery (weaponDamage, weaponLevelBonus)
 *   + relics and their stars + Plot Twists (ranks, heat) + unlocked pools.
 *
 * Relic / talent / constellation STAT parts are applied by the sim from their
 * ids (RunConfig contract) and are never duplicated in `mods`. PURE.
 */
import type { RunConfig } from "../game/run-config";
import type { Stats, StatMod } from "../game/stats";
import { applyBoard, type BoardEffects } from "./board/board";
import { firstStage, gameContent, type MetaContent } from "./content";
import { masteryDamage, masteryLevelBonus, masteryRank } from "./economy";
import { repairTalents, talentPoints } from "./heroes";
import { defaultHeroProgress, type Loadout, type Profile, START_HERO } from "./profile";
import { TUNING } from "./tuning";
import { isUnlocked } from "./unlocks";

export interface LoadoutChoice {
  hero?: string;
  stage?: string;
  relics?: string[];
  twists?: Record<string, number>;
  endless?: boolean;
  startWeapon?: string | null;
}

export type LoadoutField = "hero" | "stage" | "relics" | "twists" | "endless" | "startWeapon";
export type LoadoutReason = "unknown" | "locked" | "notOwned" | "slots" | "duplicate" | "notCleared" | "rank" | "noEndless";

export interface LoadoutIssue {
  field: LoadoutField;
  id?: string;
  reason: LoadoutReason;
}

/** Relic slots: 1 + board slots + other unlocks, at most TUNING.relics.maxSlots. */
export function relicSlots(p: Profile, board: BoardEffects = applyBoard(p)): number {
  const R = TUNING.relics;
  return Math.max(1, Math.min(R.maxSlots, R.baseSlots + board.slots.relic + p.unlocks.relicSlots));
}

/** Total heat of twists at their ranks (rank r = the sum of the first r heat entries). */
export function twistHeat(twists: Readonly<Record<string, number>>, ctx: MetaContent = gameContent()): number {
  let h = 0;
  for (const id in twists) {
    const d = ctx.twists.get(id);
    if (!d) continue;
    const r = Math.max(1, Math.min(d.maxRank, Math.floor(twists[id])));
    for (let i = 0; i < r; i++) h += d.heat[i] ?? 0;
  }
  return h;
}

const stageCleared = (p: Profile, stage: string) => (p.records[stage]?.clears ?? 0) > 0;

/** Every problem with a choice (merged over the saved loadout). Empty = valid. */
export function validateLoadout(p: Profile, choice: LoadoutChoice = {}, ctx: MetaContent = gameContent()): LoadoutIssue[] {
  return resolveLoadout(p, choice, ctx).issues;
}

/**
 * Merge a choice over the saved loadout and repair it into a valid one
 * (locked / unknown parts dropped or replaced by safe defaults), listing what
 * was wrong. The result can always be played.
 */
export function resolveLoadout(p: Profile, choice: LoadoutChoice = {}, ctx: MetaContent = gameContent(), board: BoardEffects = applyBoard(p)): { loadout: Loadout; issues: LoadoutIssue[] } {
  const issues: LoadoutIssue[] = [];
  const want: Loadout = {
    hero: choice.hero ?? p.loadout.hero,
    stage: choice.stage ?? p.loadout.stage,
    relics: [...(choice.relics ?? p.loadout.relics)],
    twists: { ...(choice.twists ?? p.loadout.twists) },
    endless: choice.endless ?? p.loadout.endless,
    startWeapon: choice.startWeapon !== undefined ? choice.startWeapon : p.loadout.startWeapon,
  };
  // hero
  let hero = want.hero;
  if (!ctx.heroById.has(hero)) {
    issues.push({ field: "hero", id: hero, reason: "unknown" });
    hero = "";
  } else if (!isUnlocked(p, "hero", hero)) {
    issues.push({ field: "hero", id: hero, reason: "locked" });
    hero = "";
  }
  if (!hero) hero = p.unlocks.heroes.find((h) => ctx.heroById.has(h)) ?? (ctx.heroById.has(START_HERO) ? START_HERO : (ctx.heroes[0]?.id ?? START_HERO));
  // stage
  let stage = want.stage;
  if (!ctx.stageById.has(stage)) {
    issues.push({ field: "stage", id: stage, reason: "unknown" });
    stage = "";
  } else if (!isUnlocked(p, "stage", stage)) {
    issues.push({ field: "stage", id: stage, reason: "locked" });
    stage = "";
  }
  if (!stage) stage = firstStage(ctx).id;
  // relics
  const slots = relicSlots(p, board);
  const relics: string[] = [];
  for (const id of want.relics) {
    if (!ctx.relics.has(id)) issues.push({ field: "relics", id, reason: "unknown" });
    else if (!(id in p.relics)) issues.push({ field: "relics", id, reason: "notOwned" });
    else if (relics.includes(id)) issues.push({ field: "relics", id, reason: "duplicate" });
    else if (relics.length >= slots) issues.push({ field: "relics", id, reason: "slots" });
    else relics.push(id);
  }
  // twists (opt-in heat; only on a stage cleared before)
  const twists: Record<string, number> = {};
  const cleared = stageCleared(p, stage);
  for (const id of Object.keys(want.twists)) {
    const d = ctx.twists.get(id);
    const r = Math.floor(want.twists[id]);
    if (!d) issues.push({ field: "twists", id, reason: "unknown" });
    else if (!isUnlocked(p, "twist", id)) issues.push({ field: "twists", id, reason: "locked" });
    else if (!cleared) issues.push({ field: "twists", id, reason: "notCleared" });
    else if (!(r >= 1)) continue;
    else {
      if (r > d.maxRank) issues.push({ field: "twists", id, reason: "rank" });
      twists[id] = Math.min(d.maxRank, r);
    }
  }
  // endless (after a clear, if the stage has it)
  let endless = want.endless;
  if (endless) {
    const info = ctx.stageById.get(stage);
    if (!cleared) {
      issues.push({ field: "endless", reason: "notCleared" });
      endless = false;
    } else if (info?.endless === false) {
      issues.push({ field: "endless", reason: "noEndless" });
      endless = false;
    }
  }
  // chosen start weapon ("Prepared Protagonist")
  let startWeapon = want.startWeapon;
  if (startWeapon !== null) {
    const w = ctx.weapons.get(startWeapon);
    if (!w || w.evolved) {
      issues.push({ field: "startWeapon", id: startWeapon, reason: "unknown" });
      startWeapon = null;
    } else if (!isUnlocked(p, "weapon", startWeapon)) {
      issues.push({ field: "startWeapon", id: startWeapon, reason: "locked" });
      startWeapon = null;
    }
  }
  // same key order as the profile defaults (the sanitiser's change detection compares JSON)
  return { loadout: { stage, hero, relics, twists, endless, startWeapon }, issues };
}

export interface RunPlan {
  /** Hero id for `new World({ hero, run })`. */
  hero: string;
  config: RunConfig;
  /** The valid loadout actually used. */
  loadout: Loadout;
  issues: LoadoutIssue[];
  heat: number;
  relicSlots: number;
  /** Hero level used for the level bonus. */
  heroLevel: number;
  board: BoardEffects;
}

/** Hero level stat bonus: +1% damage and +1% max HP per level above 1 (TUNING.hero). */
export function heroLevelMod(level: number): StatMod | null {
  const L = Math.max(0, Math.floor(level) - 1);
  if (L <= 0) return null;
  const H = TUNING.hero;
  return (s: Stats) => {
    s.might += H.mightPerLevel * L;
    s.maxHp *= 1 + H.hpPerLevel * L;
  };
}

/**
 * Build the RunConfig for a loadout choice (merged over the saved loadout).
 * Never fails: invalid parts are repaired and reported in `issues`.
 */
export function buildRunConfig(p: Profile, choice: LoadoutChoice = {}, ctx: MetaContent = gameContent()): RunPlan {
  const board = applyBoard(p);
  const { loadout, issues } = resolveLoadout(p, choice, ctx, board);
  const hp = p.heroes[loadout.hero] ?? defaultHeroProgress();
  const heroInfo = ctx.heroById.get(loadout.hero);
  const mods: StatMod[] = [];
  if (board.mod) mods.push(board.mod);
  const lvl = heroLevelMod(hp.level);
  if (lvl) mods.push(lvl);

  // pools: unlocked & registered (the hero's signature weapon is always offered)
  const weaponPool = ctx.baseWeapons.filter((w) => isUnlocked(p, "weapon", w.id) || w.id === heroInfo?.weapon).map((w) => w.id);
  const passivePool = [...ctx.passives.keys()].filter((id) => isUnlocked(p, "passive", id));

  // mastery
  const weaponDamage: Record<string, number> = {};
  const weaponLevelBonus: Record<string, number> = {};
  for (const id of Object.keys(p.mastery).sort()) {
    if (!ctx.weapons.has(id)) continue;
    const rank = masteryRank(p.mastery[id]);
    const dmg = masteryDamage(rank);
    const lb = masteryLevelBonus(rank);
    if (dmg > 0) weaponDamage[id] = Math.round(dmg * 1000) / 1000;
    if (lb > 0) weaponLevelBonus[id] = lb;
  }

  // talents: only what the tree and the hero's points allow
  const tree = ctx.talents.get(loadout.hero);
  const talents = tree ? repairTalents(tree, hp.talents, talentPoints(hp).total) : {};

  const startWeapons: { id: string; level: number }[] = [];
  if (board.startWeaponLevel > 0) {
    const id = loadout.startWeapon ?? heroInfo?.weapon;
    if (id) startWeapons.push({ id, level: board.startWeaponLevel });
  }

  const twistIds = Object.keys(loadout.twists).sort();
  const twistRanks: Record<string, number> = {};
  for (const id of twistIds) twistRanks[id] = loadout.twists[id];
  const flags: Record<string, number> = {};
  for (const [k, v] of Object.entries(board.flags)) if (v) flags[k] = Math.round(v * 1000) / 1000;

  const config: RunConfig = {
    stage: loadout.stage,
    endless: loadout.endless,
    twists: twistIds,
    twistRanks,
    mods,
    weaponPool,
    passivePool,
    weaponLevelBonus,
    weaponDamage,
    relics: loadout.relics.map((id) => ({ id, stars: Math.max(0, Math.min(TUNING.relics.maxStars, p.relics[id] ?? 0)) })),
    talents,
    constellation: Math.max(0, Math.min(TUNING.constellation.max, hp.constellation)),
    start: { level: 1 + board.startLevel, weapons: startWeapons },
    weaponSlots: 6 + board.slots.weapon,
    passiveSlots: 6 + board.slots.passive,
    flags,
  };
  return { hero: loadout.hero, config, loadout, issues, heat: twistHeat(loadout.twists, ctx), relicSlots: relicSlots(p, board), heroLevel: hp.level, board };
}

/** Save a (repaired) choice as the profile's loadout. Returns the issues found. */
export function setLoadout(p: Profile, choice: LoadoutChoice, ctx: MetaContent = gameContent()): LoadoutIssue[] {
  const { loadout, issues } = resolveLoadout(p, choice, ctx);
  p.loadout = loadout;
  return issues;
}
