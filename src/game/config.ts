/**
 * Core gameplay numbers (DESIGN §2). Pure data: no DOM / WebGL / audio.
 * Units: art pixels, seconds.
 */
export const CFG = {
  // player
  playerHp: 100,
  playerSpeed: 72,
  playerRadius: 6,
  hurtIframes: 0.4,
  dashTime: 0.16,
  dashSpeed: 300,
  dashInvulnExtra: 0.1,
  dashCd: 1.2,
  // pickups
  pickupRadius: 24,
  gemStartSpeed: 60,
  gemAccel: 600,
  collectRadius: 7,
  maxGems: 250,
  mergeKeep: 200,
  coinDropChance: 0.02,
  // combat
  critChance: 0.05,
  critMult: 2,
  damageVariance: 0.12,
  // build
  weaponSlots: 6,
  passiveSlots: 6,
  maxLevel: 5,
  rerolls: 2,
  baseCards: 3,
  // combo / overdrive
  comboTime: 2.5,
  ultMax: 100,
  ultPerKill: 1,
  ultPerElite: 8,
  ultPerBoss: 30,
  ultPerSecond: 0.5,
  cutinTime: 1.1,
  // enemies
  /** Enemy HP x (1 + m * perMinute + m^2 * perMinute2), m = run minutes (accelerates so late builds stay challenged). */
  enemyHpPerMinute: 0.22,
  enemyHpPerMinute2: 0.035,
  elite: { hp: 10, speed: 0.9, dmg: 1.5, scale: 1.5 },
  /** Enemies farther than this (x the view half-diagonal) are recycled to the spawn ring. */
  recycleFactor: 1.35,
  // run
  bossWarningTime: 3,
  /** If no final boss is registered, surviving this long = victory. */
  fallbackVictoryAt: 600,
  enrageAt: 630,
  // props
  propInterval: 20,
  maxProps: 4,
  // default view (art px) used headless / before the renderer reports its size
  viewW: 216,
  viewH: 384,
} as const;

/**
 * XP needed to go from level L to L+1. Level 1->2 needs 5 (first level-up in a few
 * seconds, DESIGN §2); the curve then steepens at Lv 6, 15 and 25 so the mid-game
 * settles at a level-up every ~10-20 s instead of a modal every few seconds
 * (combo XP multipliers of up to x2 are sustained for minutes by a good build).
 */
export function xpToNext(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return 5 + (L - 1) * 10 + Math.max(0, L - 6) * 8 + Math.max(0, L - 15) * 12 + Math.max(0, L - 25) * 16;
}

/** Enemy HP multiplier at run time `t` seconds (DESIGN §3.4 scaling, accelerated). */
export function enemyHpScale(t: number): number {
  const m = t / 60;
  return 1 + m * CFG.enemyHpPerMinute + m * m * CFG.enemyHpPerMinute2;
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

/** Damage channels for per-enemy re-hit cooldowns (Enemy.lastHit). 0..5 are weapon slots. */
export const CH_ULT = 6;
export const CH_MISC = 7;
export const CHANNELS = 8;
