/**
 * CONTRACT between the account layer (src/meta, pure) and the simulation
 * (src/game, pure). See docs/EXPANSION.md §14.
 *
 *   profile (save) --src/meta/loadout.ts buildRunConfig()--> RunConfig --> new World({ run })
 *   World --> RunSummary (+ RunStats) --src/meta/rewards.ts--> profile
 *
 * Ownership: the stage/sim foundation agent owns this file after creation and
 * may only ADD optional fields (never rename/remove), so src/meta keeps
 * compiling. Behaviour for ids referenced here lives in registries under
 * src/game (stages/, relics/, talents/, twists/).
 */
import type { StatMod } from "./stats";

export interface RunConfig {
  /** StageDef id (src/game/stages). */
  stage: string;
  /** Keep going after the final boss ("Filler Arc" endless mode). */
  endless: boolean;
  /** Plot Twist ids (opt-in difficulty modifiers, src/game/twists). */
  twists: string[];
  /**
   * Account stat modifiers, applied in order AFTER the hero trait and BEFORE
   * in-run passives: board nodes, hero level, talent stat parts, relic stat
   * parts, constellation, weapon mastery.
   */
  mods: StatMod[];
  /** Unlocked weapon ids offered on level-up cards. undefined = every registered weapon (tests/dev). */
  weaponPool?: string[];
  /** Unlocked passive ids. undefined = every registered passive. */
  passivePool?: string[];
  /** Extra max levels per weapon id (mastery limit breaks), e.g. { star_shot: 1 }. */
  weaponLevelBonus?: Record<string, number>;
  /** Equipped relics and their star level 0..6 (dupes). Behaviour: src/game/relics. */
  relics: { id: string; stars: number }[];
  /** Hero talents: talent id -> rank. Behaviour: src/game/talents. */
  talents: Record<string, number>;
  /** Hero constellation 0..6 (gacha dupes of the hero). */
  constellation: number;
  /** Run-start bonuses bought on the board. */
  start: { level: number; weapons: { id: string; level: number }[] };
  /** Build slot limits (board can raise them). */
  weaponSlots: number;
  passiveSlots: number;
  /**
   * Numeric loadout flags from the board/relics that are not Stats, e.g.
   * banish, skip, dashCharges, ultStart (0..1 starting charge), chestLuck.
   * Unknown keys are ignored by the sim.
   */
  flags: Record<string, number>;
}

/** Lifetime-trackable counters for one run (achievements, mastery, rewards). */
export interface RunStats {
  stage: string;
  hero: string;
  twists: string[];
  /** Total Plot Twist heat. */
  heat: number;
  endless: boolean;
  /** Seconds survived. */
  time: number;
  /** Seconds survived after the final boss (endless). */
  endlessTime: number;
  stageCleared: boolean;
  killsByEnemy: Record<string, number>;
  eliteKills: number;
  /** Boss ids killed this run, in order. */
  bossKills: string[];
  damageByWeapon: Record<string, number>;
  killsByWeapon: Record<string, number>;
  /** Weapon ids held at max level / evolved at the end. */
  evolutions: string[];
  dashes: number;
  ults: number;
  levelUps: number;
  level: number;
  chests: number;
  coins: number;
  foodEaten: number;
  maxCombo: number;
  /** Highest combo rank index reached (-1 none, 0 = C ... 5 = SSS). */
  maxRank: number;
  damageTaken: number;
  /** Longest stretch in seconds without taking damage. */
  noHitBest: number;
  revivesUsed: number;
}

export function defaultRunConfig(over: Partial<RunConfig> = {}): RunConfig {
  return {
    stage: "dream_meadow",
    endless: false,
    twists: [],
    mods: [],
    relics: [],
    talents: {},
    constellation: 0,
    start: { level: 1, weapons: [] },
    weaponSlots: 6,
    passiveSlots: 6,
    flags: {},
    ...over,
  };
}
