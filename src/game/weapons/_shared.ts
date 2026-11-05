/**
 * Helpers shared by weapon files (no `weapons` export, so the registry
 * ignores this file).
 */
import { CFG } from "../config";
import type { Projectile, WeaponDef, WeaponInstance, WeaponLevel } from "../types";
import type { World } from "../world";

/** Resolved numbers for the weapon's current level with the player's stats applied. */
export interface WStats {
  dmg: number;
  cd: number;
  amount: number;
  speed: number;
  pierce: number;
  area: number;
  duration: number;
  knock: number;
  /** The raw level entry (weapon-specific extra keys). */
  L: WeaponLevel;
}

const S: WStats = { dmg: 0, cd: 1, amount: 1, speed: 0, pierce: 1, area: 1, duration: 1, knock: 0, L: { dmg: 0, cd: 1, amount: 1 } };

/**
 * Current stats (shared scratch object: read immediately, don't keep). Levels
 * past the last `levels` entry are mastery Limit Breaks: the last level plus
 * the weapon's `limitBreak` entries (or the generic +CFG.limitBreakDmg damage
 * and +1 amount per extra level). Mastery damage (inst.dmgMul) applies on top.
 */
export function wstats(w: World, inst: WeaponInstance): WStats {
  const def = inst.def;
  const n = def.levels.length;
  const L = def.levels[Math.min(inst.level, n) - 1];
  const s = w.stats;
  let dmgK = inst.dmgMul ?? 1;
  let cdK = 1;
  let amount = L.amount;
  let area = L.area ?? 1;
  for (let x = 0; x < inst.level - n; x++) {
    const lb = def.limitBreak?.[x];
    if (lb) {
      dmgK += lb.dmg ?? 0;
      amount += lb.amount ?? 0;
      area += lb.area ?? 0;
      cdK *= lb.cd ?? 1;
    } else {
      dmgK += CFG.limitBreakDmg;
      amount += 1;
    }
  }
  S.L = L;
  S.dmg = L.dmg * s.might * dmgK;
  S.cd = L.cd * s.cooldown * cdK;
  S.amount = Math.max(1, amount + s.amount);
  S.speed = (L.speed ?? 0) * s.projSpeed;
  S.pierce = L.pierce ?? 1;
  S.area = area * s.area;
  S.duration = (L.duration ?? 1) * s.duration;
  S.knock = L.knock ?? 20;
  return S;
}

/** Card text for a Limit Break level (1-based extra level index). */
export function limitBreakText(def: WeaponDef, extra: number): string {
  return def.limitBreak?.[extra - 1]?.text ?? `LIMIT BREAK: damage +${Math.round(CFG.limitBreakDmg * 100)}%, +1 amount`;
}

/** Remember a persistent projectile owned by the weapon. */
export function own(inst: WeaponInstance, p: Projectile): void {
  inst.projs.push(p);
  inst.uids.push(p.uid);
}

/** Drop owned projectiles that died (or whose pooled object got reused). Returns the live count. */
export function prune(inst: WeaponInstance): number {
  let j = 0;
  for (let i = 0; i < inst.projs.length; i++) {
    const p = inst.projs[i];
    if (!p.dead && p.uid === inst.uids[i]) {
      inst.projs[j] = p;
      inst.uids[j] = inst.uids[i];
      j++;
    }
  }
  inst.projs.length = j;
  inst.uids.length = j;
  return j;
}

/** Kill every owned projectile. */
export function killOwned(inst: WeaponInstance): void {
  for (let i = 0; i < inst.projs.length; i++) if (inst.projs[i].uid === inst.uids[i]) inst.projs[i].dead = true;
  inst.projs.length = 0;
  inst.uids.length = 0;
}

const fireEv = { id: "", sfx: "", x: 0, y: 0 };

/** Emit the fire event for sfx (one reused payload: firing never allocates). */
export function fired(w: World, inst: WeaponInstance, x: number, y: number): void {
  if (!inst.def.sfx || w.muted) return;
  fireEv.id = inst.def.id;
  fireEv.sfx = inst.def.sfx;
  fireEv.x = x;
  fireEv.y = y;
  w.emit("weaponFire", fireEv);
}
