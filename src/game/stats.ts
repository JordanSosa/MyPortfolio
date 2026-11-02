/**
 * Player stat block + modifier system.
 *
 * Stats are recomputed from scratch whenever the build changes:
 *   base -> hero trait -> meta ranks (Dream Shop) -> passives (by level)
 * Each source is a pure `(stats) => void` modifier, so adding a new stat
 * source is just another function in the chain (see World.recomputeStats).
 *
 * Weapons read the multipliers when they fire:
 *   damage   = base * might          cooldown = base * cooldown
 *   area     = base * area           count    = base + amount
 *   speed    = base * projSpeed      duration = base * duration
 */
import { CFG } from "./config";

export interface Stats {
  maxHp: number;
  /** HP per second. */
  regen: number;
  /** Flat damage reduction per hit (min 1 damage taken). */
  armor: number;
  /** Movement speed multiplier. */
  moveSpeed: number;
  /** Damage multiplier. */
  might: number;
  /** Cooldown multiplier (lower = faster). Clamped to >= 0.35. */
  cooldown: number;
  /** Area / size multiplier. */
  area: number;
  /** Extra projectiles / instances (additive). */
  amount: number;
  /** Projectile speed multiplier. */
  projSpeed: number;
  /** Effect duration multiplier. */
  duration: number;
  /** Pickup radius multiplier (base CFG.pickupRadius). */
  pickup: number;
  /** Crit chance 0..1. */
  crit: number;
  /** Crit damage multiplier. */
  critMult: number;
  /** Luck multiplier (rarity rolls, drops). */
  luck: number;
  /** XP multiplier. */
  growth: number;
  /** Coin multiplier. */
  greed: number;
  /** Dash cooldown multiplier. */
  dashCd: number;
  /** Knockback multiplier. */
  knock: number;
  revives: number;
  rerolls: number;
  /** Cards offered per level-up. */
  cards: number;
}

export type StatMod = (s: Stats) => void;

export function baseStats(): Stats {
  return {
    maxHp: CFG.playerHp,
    regen: 0,
    armor: 0,
    moveSpeed: 1,
    might: 1,
    cooldown: 1,
    area: 1,
    amount: 0,
    projSpeed: 1,
    duration: 1,
    pickup: 1,
    crit: CFG.critChance,
    critMult: CFG.critMult,
    luck: 1,
    growth: 1,
    greed: 1,
    dashCd: 1,
    knock: 1,
    revives: 0,
    rerolls: CFG.rerolls,
    cards: CFG.baseCards,
  };
}

/** Clamp derived values into sane ranges after all modifiers ran. */
export function finalizeStats(s: Stats): Stats {
  s.cooldown = Math.max(0.35, s.cooldown);
  s.dashCd = Math.max(0.4, s.dashCd);
  s.crit = Math.min(0.9, Math.max(0, s.crit));
  s.maxHp = Math.max(1, Math.round(s.maxHp));
  s.cards = Math.max(1, Math.min(4, Math.round(s.cards)));
  return s;
}

/** Human readable stat lines for the pause screen (label, value). */
export function describeStats(s: Stats): [string, string][] {
  const pct = (v: number) => `${v >= 1 ? "+" : ""}${Math.round((v - 1) * 100)}%`;
  return [
    ["Max HP", `${s.maxHp}`],
    ["Regen", `${s.regen.toFixed(1)}/s`],
    ["Armor", `${s.armor}`],
    ["Might", pct(s.might)],
    ["Cooldown", `${Math.round((s.cooldown - 1) * 100)}%`],
    ["Area", pct(s.area)],
    ["Amount", `+${s.amount}`],
    ["Speed", pct(s.moveSpeed)],
    ["Magnet", pct(s.pickup)],
    ["Crit", `${Math.round(s.crit * 100)}%`],
    ["Luck", pct(s.luck)],
  ];
}
