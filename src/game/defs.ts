/**
 * CONTRACT: Season 2 content definition types shared by the simulation
 * (src/game, which implements behaviour) and the account layer (src/meta,
 * which reads the metadata: names, rarities, ranks, costs, descriptions).
 * See docs/EXPANSION.md.
 *
 * Ownership: the sim foundation agent owns this file after creation and may
 * only ADD fields (optional ones, or new interfaces) so src/meta keeps
 * compiling. Registries (one file per item group, auto-registered with
 * import.meta.glob) live in src/game/stages, src/game/relics,
 * src/game/talents, src/game/twists.
 */
import type { Stats } from "./stats";
import type { World } from "./world";

/** Gacha / relic rarity, lowest to highest. */
export type Rarity = "N" | "R" | "SR" | "SSR" | "UR" | "LR" | "MYTHIC";
export const RARITIES: readonly Rarity[] = ["N", "R", "SR", "SSR", "UR", "LR", "MYTHIC"];

/** Relic ("Merch") equipped before a run. Stars 0..6 come from gacha dupes. */
export interface RelicDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Atlas icon id (16x16). */
  icon: string;
  /** Satirical flavour line (codex / gacha splash). */
  flavor: string;
  /** Effect text at a star level 0..6. */
  desc(stars: number): string;
  /** Stat part of the effect. */
  mods?(s: Stats, stars: number): void;
  /** Sim behaviour, installed once at run start (subscribe to w.bus events, set flags). Must clean up nothing: the World is discarded after the run. */
  install?(w: World, stars: number): void;
}

/** One node of a hero talent tree. */
export interface TalentNode {
  id: string;
  name: string;
  /** 0, 1 or 2 (the tree's three branches). */
  branch: number;
  /** 1..5 (tier 5 = capstone). Higher tiers need points spent in the branch (meta rule: TALENT_TIER_POINTS). */
  tier: number;
  maxRank: number;
  icon?: string;
  /** Effect text at `rank` (1..maxRank). */
  desc(rank: number): string;
  /** Other talent ids that must have >= 1 rank first. */
  requires?: string[];
  mods?(s: Stats, rank: number): void;
  install?(w: World, rank: number): void;
}

/**
 * Points that must already be spent in a branch before a node of tier T can
 * take a rank: TALENT_TIER_POINTS[T - 1] (the meta layer enforces it; the sim
 * only applies the ranks it is given).
 */
export const TALENT_TIER_POINTS: readonly number[] = [0, 2, 5, 9, 14];

export interface TalentTree {
  /** Hero id. */
  hero: string;
  /** Branch names, e.g. ["Idol Arc", "Plot Armor", "Star Power"]. */
  branches: [string, string, string];
  nodes: TalentNode[];
}

/** Plot Twist: opt-in difficulty modifier with heat (rewards scale with total heat). */
export interface TwistDef {
  id: string;
  name: string;
  icon?: string;
  maxRank: number;
  /** Heat added at each rank (index 0 = rank 1): the total at rank r is the sum of the first r entries (registry twistHeat). */
  heat: number[];
  /** Effect text at `rank`. */
  desc(rank: number): string;
  /** Applied once at run start. */
  install(w: World, rank: number): void;
  /** Parody "network note" subtitle on the twist card. */
  note?: string;
  /** Stage whose first clear unlocks this twist (docs/content/stages.md §6). */
  unlockedBy?: string;
}

/** Lightweight stage metadata the account layer needs (full StageDef lives in src/game/stages). */
export interface StageInfo {
  id: string;
  name: string;
  /** Episode-style subtitle. */
  subtitle: string;
  /** 1-based order on the stage map. */
  order: number;
  /** Run length in seconds (final boss spawns before this). */
  duration: number;
  /** Boss ids in order (mid bosses then the final boss). */
  bosses: string[];
  /** Coin/gem reward multiplier. */
  rewardMul: number;
  // ---- optional (added by the sim agent)
  /** Final boss id (also the last entry of `bosses`); clearing = killing it. */
  finalBoss?: string;
  /** Enemy ids that spawn in the stage (codex / stage card), boss ids excluded. */
  enemies?: string[];
  /** Whether the "Filler Arc" endless continuation is available after a clear. */
  endless?: boolean;
  /** Short mood line for the stage card ("sugar rush"). */
  blurb?: string;
  /** Stage id that must be cleared to unlock this one (undefined = available from the start). */
  requires?: string;
}

/**
 * One hero constellation star (C1..C6, gacha dupes of the hero). Stored on the
 * hero def (`HeroDef.constellations`, index 0 = C1); a hero at C3 gets entries
 * 0..2. Stat parts go in `mods`, behaviour in `install` (see RelicDef).
 */
export interface ConstellationDef {
  /** Satire title, e.g. "Recolour Edition". */
  name: string;
  desc: string;
  mods?(s: Stats): void;
  install?(w: World): void;
}
