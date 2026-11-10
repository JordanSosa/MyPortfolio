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
   * Account stat modifiers (board nodes, hero level, keystone stat parts...),
   * applied in order AFTER the hero trait. The sim then applies, by itself and
   * from their ids: relic mods (RelicDef.mods by stars), talent mods
   * (TalentNode.mods by rank) and the hero constellation, then in-run passives
   * (World.recomputeStats). Do NOT also put relic / talent / constellation stat
   * parts here (they would count twice). Per-weapon mastery damage goes in
   * `weaponDamage`.
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
   * Numeric loadout flags from the board/relics that are not Stats. Known keys
   * and their meaning: RUN_FLAGS below. Unknown keys are ignored by the sim.
   */
  flags: Record<string, number>;
  // ---- optional (added by the sim agent; absent = default)
  /** Plot Twist rank per id (1..maxRank) for the ids listed in `twists`; a missing entry = rank 1. */
  twistRanks?: Record<string, number>;
  /**
   * Extra damage per weapon id as an additive fraction (weapon mastery: +0.03
   * per rank, e.g. { star_shot: 0.15 }). An evolved weapon uses its base
   * weapon's entry (plus its own, if any).
   */
  weaponDamage?: Record<string, number>;
}

/**
 * RunConfig.flags keys understood by the sim (docs/EXPANSION.md §5, §8).
 * Values are numbers; 0 / missing = off.
 */
export const RUN_FLAGS = {
  /** Banishes for the run: remove a level-up card's item from the pool (and replace the card). */
  banish: "banishes per run",
  /** Skips for the run: skip a level-up for an XP + coin refund (CFG.skipXp / skipCoins). */
  skip: "level-up skips per run",
  /** Extra dash charges on top of the base 1 (each recharges in turn), total clamped to 5. */
  dashCharges: "extra dash charges",
  /** Overdrive starting charge as a fraction of a full meter, added to the base CFG.ultStart. */
  ultStart: "starting Overdrive (0..1 of a meter)",
  /** Chest luck 0..1: a plain chest rolls 3 rewards with this chance; jackpot chance x (1 + chestLuck). */
  chestLuck: "chest luck (0..1)",
  /** Extra elites per timeline elite event (fractions roll a chance), and endless elite waves. */
  eliteRate: "elite frequency (+elites per elite event)",
  /** "Plot Armor" keystone: survive this many lethal hits per run (at 1 HP, short invulnerability). */
  plotArmor: "lethal hits survived per run",
  /** "Power of Friendship" keystone: +this damage (fraction) per different weapon held. */
  friendship: "damage per different weapon held (fraction)",
  /** Extra revives on top of Stats.revives (board: up to 2). */
  revives: "extra revives",
  /** Rerolls never run out (the Infinite Gacha Credit Card sets it too). */
  freeRerolls: "1 = rerolls are free",
} as const;

export type RunFlag = keyof typeof RUN_FLAGS;

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
  /** Evolved weapon ids held at the end (Plot Points "Evolve X weapons" / "Hold 6 evolved weapons"). */
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
  // ---- optional extras (added by the sim agent; always filled by World.summary())
  /** Plot Twist ranks used (id -> rank). */
  twistRanks?: Record<string, number>;
  /** Final Stats.gemFind (Dream Gem payout multiplier from relics / talents / board). */
  gemFind?: number;
  /** Final Stats.curse. */
  curse?: number;
  /**
   * Final Stats.greed (coin multiplier). Coins picked up in the run already
   * include it; src/meta applies it to the end-of-run coin bonuses too.
   */
  greed?: number;
  /** Run time (s) of the first dash, -1 = never dashed ("survive 3:00 without dashing"). */
  firstDashAt?: number;
  /** Longest stretch (s) in which no weapon dealt damage ("Pacifist?"). */
  pacifistBest?: number;
  rerollsUsed?: number;
  banishesUsed?: number;
  skipsUsed?: number;
  /** Destructible props broken. */
  propsBroken?: number;
  /** Hits absorbed by shields. */
  shieldBlocks?: number;
  /** Lethal hits survived (Plot Armor keystone / relics). */
  plotArmorSaves?: number;
  /** Boss rematches defeated in the Filler Arc (endless). */
  bossRematches?: number;
  /** Seconds the final boss took from spawn to death (-1 = not killed). */
  finalBossTime?: number;
  /** Ids of every weapon held during the run (base and evolved, in order acquired). */
  weaponsUsed?: string[];
  /** Ids of every passive held during the run. */
  passivesUsed?: string[];
  /** Relic ids equipped. */
  relics?: string[];
  /** How the run ended. */
  outcome?: "victory" | "dead" | "quit";
  // ---- counters the content bible's achievements read (docs/content/README.md "RunStats extras")
  crits?: number;
  /** "NANI?!" pops (big crits). */
  nanis?: number;
  /** "BAKA!" pops (Akane). */
  bakas?: number;
  /** Enemies charmed (Senpai). */
  charmed?: number;
  /** Henshin Bursts (Magical Girl #47). */
  henshins?: number;
  /** "Did I overdo it again?" overkills (Isekai-kun). */
  overdos?: number;
  /** Enemies reincarnated by Truck-kun. */
  isekaid?: number;
  /** HP healed in total. */
  healed?: number;
  /** Chest jackpots. */
  jackpots?: number;
  /** What landed the killing blow on the hero: enemy id (a bullet counts as its shooter; else its sprite id), or an effect id. */
  killedBy?: string;
  /** The Overdrive meter was full when the hero died. */
  ultReadyAtDeath?: boolean;
  /** Longest stretch (s) standing still. */
  stillBest?: number;
  /** Longest stretch (s) inside the Kotatsu of Sloth aura. */
  comfyBest?: number;
  gemsCollected?: number;
  /** Most weapons held at once. */
  maxWeaponsHeld?: number;
  /** Enemy bullets blocked by orbiting weapon bodies (Orbital Guard: weapons/_orbital.ts). */
  orbitalBlocks?: number;
}

/** Numeric RunStats extras that content code counts with World.bumpStat(). */
export type RunStatCounter = "crits" | "nanis" | "bakas" | "charmed" | "henshins" | "overdos" | "isekaid" | "jackpots" | "comfyBest" | "orbitalBlocks";

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
