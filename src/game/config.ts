/**
 * Core gameplay numbers (DESIGN §2). Pure data: no DOM / WebGL / audio.
 * Units: art pixels, seconds.
 */
export const CFG = {
  // player
  playerHp: 100,
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
  coinDropChance: 0.02,
  /** Above maxCoins resting coins the farthest fold into one (value summed, keeping coinMergeKeep): bounded pickups. */
  maxCoins: 110,
  coinMergeKeep: 80,
  // combat
  critChance: 0.05,
  critMult: 2,
  damageVariance: 0.12,
  /** Each level-up heals this fraction of max HP (min 3): steady sustain that rewards killing. */
  levelHeal: 0.03,
  // build
  weaponSlots: 6,
  passiveSlots: 6,
  maxLevel: 5,
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
  /** Enemy contact / shot damage x (1 + max(0, m - 4) * this) (bosses use their own numbers). */
  enemyDmgPerMinute: 0.06,
  elite: { hp: 10, speed: 0.9, dmg: 1.5, scale: 1.5 },
  /** Boss HP per player level above / below BossInfo.level (clamped to [bossHpMin, bossHpMax]). */
  bossHpPerLevel: 0.035,
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
 * XP needed to go from level L to L+1 (piecewise linear). Lv 2 costs only 3 XP (the
 * first level-up lands a few seconds in, with the starter vacuum CFG.starterVacuum),
 * then the cost grows by 10 per level up to Lv 6 (15 XP for Lv 3), 38 per level to Lv 12 (the
 * starter build forms), only 12 per level to Lv 22 (level-ups keep coming every
 * ~8-12 s while the horde and the bosses ramp up), then 72 and 132 per level from
 * Lv 22 / 38: a snowballed build can't turn the late game into a modal every few
 * seconds. Tuned with the balance probe (ARCHITECTURE section 6).
 */
export function xpToNext(level: number): number {
  const L = Math.max(1, Math.floor(level));
  if (L === 1) return 3;
  return 5 + (L - 1) * 10 + Math.max(0, L - 6) * 28 - Math.max(0, L - 12) * 26 + Math.max(0, L - 22) * 60 + Math.max(0, L - 38) * 60;
}

/** Enemy HP multiplier at run time `t` seconds (DESIGN §3.4 scaling, accelerated). */
export function enemyHpScale(t: number): number {
  const m = t / 60;
  return 1 + m * CFG.enemyHpPerMinute + m * m * CFG.enemyHpPerMinute2 + m * m * m * CFG.enemyHpPerMinute3;
}

/** Boss HP multiplier for a boss tuned for player level `ref` against the current `level` (1 without a ref). */
export function bossHpScale(ref: number | undefined, level: number): number {
  if (!ref) return 1;
  return Math.min(CFG.bossHpMax, Math.max(CFG.bossHpMin, 1 + (level - ref) * CFG.bossHpPerLevel));
}

/** XP multiplier for gems dropped at run time `t` seconds. */
export function gemXpScale(t: number): number {
  return 1 + Math.max(0, t / 60 - 3) * CFG.gemXpPerMinute;
}

/** Enemy contact / shot damage multiplier at run time `t` seconds. */
export function enemyDmgScale(t: number): number {
  return 1 + Math.max(0, t / 60 - 4) * CFG.enemyDmgPerMinute;
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
