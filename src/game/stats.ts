/**
 * Player stat block + modifier system.
 *
 * Stats are recomputed from scratch whenever the build changes (World.recomputeStats):
 *   base -> hero trait -> legacy Dream Shop ranks -> RunConfig.mods (account: board,
 *   hero level, mastery...) -> relic mods (by stars) -> talent mods (by rank) ->
 *   constellation -> passives (by level) -> run modifiers (World.statMods: relic /
 *   talent / twist effects that depend on run state, timed buffs) -> finalizeStats.
 * Each source is a pure `(stats) => void` modifier, so adding a new stat
 * source is just another function in the chain.
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
  /** Cards offered per level-up (clamped to 1..6 - the Infinite Gacha Credit Card offers 6). */
  cards: number;
  // ---- Season 2 (docs/EXPANSION.md §5-8)
  /** Curse: more enemies (spawn rate x (1 + curse)) that are a little tougher (HP x (1 + curse / 4)). 0 = none. */
  curse: number;
  /** Dream Gem find multiplier (reported in RunStats.gemFind, paid out by src/meta). */
  gemFind: number;
  /** Fraction of incoming damage removed after armor, 0..0.8 (Plot Armor passive, relics). */
  dmgReduction: number;
  /** Healing multiplier (food, level-up heal, relic heals; not regen). */
  healMul: number;
  /** Shield charges: each one absorbs a whole hit (then i-frames). 0 = none. */
  shield: number;
  /** Seconds to recharge one shield charge. */
  shieldCd: number;
  /** Overdrive meter gain multiplier (kills, elites, bosses, the passive trickle). */
  ultGain: number;
  /** Overdrive strength multiplier (UltState.power). */
  ultPower: number;
  /** Seconds added to every combo window. */
  comboTime: number;
  /** Damage multiplier against elites and bosses. */
  bossDmg: number;
  /** Player collision radius multiplier (CFG.playerRadius x this): Chibi Charm shrinks it, Truck-kun is 1.5. */
  hitbox: number;
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
    curse: 0,
    gemFind: 1,
    dmgReduction: 0,
    healMul: 1,
    shield: 0,
    shieldCd: CFG.shieldCd,
    ultGain: 1,
    ultPower: 1,
    comboTime: 0,
    bossDmg: 1,
    hitbox: 1,
  };
}

/** Clamp derived values into sane ranges after all modifiers ran. */
export function finalizeStats(s: Stats): Stats {
  s.cooldown = Math.max(0.35, s.cooldown);
  s.dashCd = Math.max(0.4, s.dashCd);
  s.crit = Math.min(0.9, Math.max(0, s.crit));
  s.maxHp = Math.max(1, Math.round(s.maxHp));
  s.cards = Math.max(1, Math.min(6, Math.round(s.cards)));
  s.curse = Math.max(0, s.curse);
  s.dmgReduction = Math.min(0.8, Math.max(0, s.dmgReduction));
  s.healMul = Math.max(0, s.healMul);
  s.shield = Math.max(0, Math.floor(s.shield));
  s.shieldCd = Math.max(2, s.shieldCd);
  s.rerolls = Math.max(0, Math.floor(s.rerolls));
  s.ultGain = Math.max(0, s.ultGain);
  s.ultPower = Math.max(0, s.ultPower);
  s.comboTime = Math.max(0, s.comboTime);
  s.bossDmg = Math.max(0, s.bossDmg);
  s.hitbox = Math.max(0.3, s.hitbox);
  s.revives = Math.max(0, Math.floor(s.revives));
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
