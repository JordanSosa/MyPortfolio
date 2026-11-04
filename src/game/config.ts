/**
 * Core gameplay numbers (DESIGN §2). Pure data: no DOM / WebGL / audio.
 * Units: art pixels, seconds.
 */
import type { StageScaling } from "./stage";
export const CFG = {
  // player
  /** Base max HP (Season 2: 100 -> 80, so the account's HP nodes / levels are felt from the first run). */
  playerHp: 80,
  playerSpeed: 72,
  playerRadius: 6,
  /** Player body centre height above the feet (World.PLAYER_CY; content modules read it here to avoid importing world.ts). */
  playerCy: 8,
  hurtIframes: 0.5,
  dashTime: 0.16,
  dashSpeed: 300,
  dashInvulnExtra: 0.1,
  dashCd: 1.2,
  // pickups
  pickupRadius: 24,
  /**
   * Early-game "starter vacuum": while the hero is below Lv 3 and in the first
   * starterVacuumTime seconds, gems within this radius (px) home in, so the first
   * level-ups land within a few seconds even for a hero standing still / running away.
   */
  starterVacuum: 110,
  starterVacuumTime: 30,
  gemStartSpeed: 60,
  gemAccel: 600,
  collectRadius: 7,
  /** Above maxGems the farthest gems merge into one rainbow gem_4 (keeping mergeKeep), which drifts to the player. */
  maxGems: 160,
  mergeKeep: 120,
  mergedGemDrift: 28,
  /**
   * In-run coin sources (economy: docs/META.md §4). They never touch combat (only food pickups
   * have hooks); the payout counts the coins picked up as they are, so they stay small next to
   * the stage-scaled episode bonuses. A regular kill drops a coin with this chance (x luck).
   */
  coinDropChance: 0.002,
  /** Coins a boss / an elite bursts into on death (1 each). */
  bossCoinDrops: 8,
  eliteCoinDrops: 4,
  /** "Star Pouch": the coin fallback card of a maxed build (level-ups and chests). */
  starPouchCoins: 3,
  /** Chest coin bonus: chestCoins + 0..chestCoins (golden: chestCoinsGolden), x3 on a JACKPOT, x greed. */
  chestCoins: 3,
  chestCoinsGolden: 10,
  /** Above maxCoins resting coins the farthest fold into one (value summed, keeping coinMergeKeep): bounded pickups. */
  maxCoins: 110,
  coinMergeKeep: 80,
  // combat
  critChance: 0.05,
  critMult: 2,
  damageVariance: 0.12,
  /** Each level-up heals this fraction of max HP (min 3): steady sustain that rewards killing. */
  levelHeal: 0.03,
  // build (defaults; RunConfig.weaponSlots / passiveSlots override them per run)
  weaponSlots: 6,
  passiveSlots: 6,
  maxLevel: 5,
  /**
   * Generic weapon Limit Break (mastery: RunConfig.weaponLevelBonus) for a weapon
   * without its own WeaponDef.limitBreak entries: every level past the last
   * defined one gives +limitBreakDmg damage (additive fraction) and +1 amount.
   */
  limitBreakDmg: 0.2,
  /** An evolution inherits this much extra damage per Limit Break level its base weapon had when it evolved. */
  limitBreakInherit: 0.15,
  /** Level-up skip refund: this fraction of the current level's XP cost, plus coins. */
  skipXp: 0.25,
  skipCoins: 10,
  /** Seconds to recharge one shield charge (Stats.shield) by default. */
  shieldCd: 15,
  /** Plot Armor (keystone / relics): seconds of invulnerability after surviving a lethal hit (talents may raise it). */
  plotArmorIframes: 1,
  rerolls: 2,
  baseCards: 3,
  // combo / overdrive
  /**
   * Combo window (s) per rank, indexed by rank + 1 (none, C, B, A, S, SS, SSS).
   * A kill puts `comboRefill[rank + 1]` seconds back on the timer (capped at the
   * window), so holding a rank needs about 1 / refill kills per second: high
   * ranks drain fast and have to be fed. When the timer runs out at B or better
   * the rank drops one step (count falls to that rank's threshold) instead of
   * breaking; below B it breaks. Getting hurt also drops one rank.
   */
  comboWindow: [2.5, 2.5, 2.3, 2.0, 1.7, 1.45, 1.2],
  comboRefill: [2.5, 2.5, 2.3, 0.3, 0.15, 0.08, 0.04],
  ultMax: 100,
  /** Meter at the start of a run (the first Overdrive lands around 1:00). */
  ultStart: 25,
  ultPerKill: 0.3,
  /** Cap on the meter gained from ordinary kills per second (elite / boss / passive gains come on top). */
  ultKillCap: 1.25,
  ultPerElite: 8,
  ultPerBoss: 30,
  ultPerSecond: 0.55,
  cutinTime: 1.1,
  // enemies
  /** Enemy HP x (1 + a m + b m^2 + c m^3), m = run minutes: gentle early, then it chases the build's power (evolutions from ~4:00). */
  enemyHpPerMinute: 0.1,
  enemyHpPerMinute2: 0.01,
  enemyHpPerMinute3: 0.014,
  /** Gem XP x (1 + max(0, m - 3) * this): later enemies are worth more (the late horde pays for the steeper curve). */
  gemXpPerMinute: 0.15,
  /** ...plus min(m, gemXpEarlyMinutes) * gemXpEarly: the early horde (tougher since Season 2) keeps the level-ups coming. */
  gemXpEarly: 0,
  gemXpEarlyMinutes: 3,
  /** Level-up cost curve (xpToNext). */
  xpCurve: { base: 5, per: 10, k6: 16, k12: -14, k22: 60, k38: 60, max: 2500 },
  /** Enemy contact / shot damage x (1 + max(0, m - 4) * this) (bosses use their own numbers). */
  enemyDmgPerMinute: 0.06,
  elite: { hp: 10, speed: 0.9, dmg: 1.5, scale: 1.5 },
  /**
   * Boss HP per player level above / below BossInfo.level (clamped to [bossHpMin, bossHpMax]).
   * Season 2: 0 = FIXED boss HP (deliberate): account power has to be felt as faster boss kills
   * (a level-scaled boss soaked it up - a max account fought Cancel-sama at x1.8 HP); each boss's
   * HP is set for its stage's intended checkpoint (ARCHITECTURE section 6). The scaling stays for
   * tools / twists that want it.
   */
  bossHpPerLevel: 0,
  bossHpMin: 0.5,
  bossHpMax: 1.8,
  /** Enemies farther than this (x the view half-diagonal) are recycled to the spawn ring. */
  recycleFactor: 1.35,
  // run
  bossWarningTime: 3,
  /** If no final boss is registered, surviving this long = victory. */
  fallbackVictoryAt: 600,
  enrageAt: 630,
  /** Enemy bullet hygiene: hard cap, and bullets this far beyond the view edge are culled (px). */
  maxBullets: 400,
  bulletCullMargin: 90,
  // props
  propInterval: 16,
  maxProps: 4,
  // default view (art px) used headless / before the renderer reports its size
  viewW: 216,
  viewH: 384,
} as const;

/**
 * XP needed to go from level L to L+1 (piecewise linear, CFG.xpCurve). Lv 2 costs only 3 XP (the
 * first level-up lands a few seconds in, with the starter vacuum CFG.starterVacuum),
 * then the cost grows by `per` per level, plus `k6` per level from Lv 6 (the starter build forms),
 * `k12` from Lv 12 (level-ups keep coming every ~8-12 s while the horde and the bosses ramp up),
 * then `k22` and `k38` more from Lv 22 / 38: a snowballed build can't turn the late game into a
 * modal every few seconds; capped at `max` so the long stages never go 30+ s without one.
 * Tuned with the balance probe and the matrix (ARCHITECTURE section 6).
 */
export function xpToNext(level: number): number {
  const L = Math.max(1, Math.floor(level));
  if (L === 1) return 3;
  const c = CFG.xpCurve;
  return Math.min(c.max, c.base + (L - 1) * c.per + Math.max(0, L - 6) * c.k6 + Math.max(0, L - 12) * c.k12 + Math.max(0, L - 22) * c.k22 + Math.max(0, L - 38) * c.k38);
}

/** The default stage toughness (StageDef.scaling fills its gaps from this). */
export const DEFAULT_SCALING: Readonly<StageScaling> = Object.freeze({
  hp: 1,
  curve: [CFG.enemyHpPerMinute, CFG.enemyHpPerMinute2, CFG.enemyHpPerMinute3] as const,
  pace: 1,
  dmg: 1,
  dmgPerMinute: CFG.enemyDmgPerMinute,
  dmgFrom: 4,
  bossHp: 1,
  adaptMax: 1.5,
  spawn: 1,
  cap: 1,
  speed: 1,
});

/** A stage's full toughness (its own fields over DEFAULT_SCALING). */
export function stageScaling(part: Partial<StageScaling> | undefined): StageScaling {
  return part ? { ...DEFAULT_SCALING, ...part } : DEFAULT_SCALING;
}

/** Enemy HP multiplier at run time `t` seconds (DESIGN §3.4 scaling, accelerated; a stage's own toughness with `sc`). */
export function enemyHpScale(t: number, sc: StageScaling = DEFAULT_SCALING): number {
  const m = (t / 60) * sc.pace;
  const [a, b, c] = sc.curve;
  return sc.hp * (1 + m * a + m * m * b + m * m * m * c);
}

/** Boss HP multiplier for a boss tuned for player level `ref` against the current `level` (1 without a ref). */
export function bossHpScale(ref: number | undefined, level: number): number {
  if (!ref) return 1;
  return Math.min(CFG.bossHpMax, Math.max(CFG.bossHpMin, 1 + (level - ref) * CFG.bossHpPerLevel));
}

/** XP multiplier for gems dropped at run time `t` seconds (an early ramp over the first minutes, then the late ramp). */
export function gemXpScale(t: number): number {
  const m = t / 60;
  return 1 + Math.min(m, CFG.gemXpEarlyMinutes) * CFG.gemXpEarly + Math.max(0, m - 3) * CFG.gemXpPerMinute;
}

/** Enemy contact / shot damage multiplier at run time `t` seconds (a stage's own toughness with `sc`). */
export function enemyDmgScale(t: number, sc: StageScaling = DEFAULT_SCALING): number {
  return sc.dmg * (1 + Math.max(0, t / 60 - sc.dmgFrom) * sc.dmgPerMinute);
}

export interface Rank {
  id: string;
  at: number;
  mult: number;
}

/** Combo ranks (DESIGN §2.1). */
export const RANKS: readonly Rank[] = [
  { id: "C", at: 10, mult: 1.1 },
  { id: "B", at: 30, mult: 1.2 },
  { id: "A", at: 60, mult: 1.3 },
  { id: "S", at: 100, mult: 1.5 },
  { id: "SS", at: 200, mult: 1.75 },
  { id: "SSS", at: 400, mult: 2.0 },
];

/** Index into RANKS for a combo count (-1 = no rank). */
export function rankFor(count: number): number {
  let r = -1;
  for (let i = 0; i < RANKS.length; i++) if (count >= RANKS[i].at) r = i;
  return r;
}

/** Most weapon slots a build can ever have (RunConfig.weaponSlots is clamped to it). */
export const MAX_WEAPON_SLOTS = 8;
/** Most passive slots a build can ever have. */
export const MAX_PASSIVE_SLOTS = 8;
/**
 * Damage channels for per-enemy re-hit cooldowns (Enemy.lastHit). 0..MAX_WEAPON_SLOTS-1
 * are weapon slots (a board-bought 7th / 8th slot gets its own channel).
 */
export const CH_ULT = MAX_WEAPON_SLOTS;
export const CH_MISC = MAX_WEAPON_SLOTS + 1;
/** Relic / talent / twist effects (their own re-hit channel, so an aura never blocks a weapon). */
export const CH_RELIC = MAX_WEAPON_SLOTS + 2;
export const CHANNELS = MAX_WEAPON_SLOTS + 3;
