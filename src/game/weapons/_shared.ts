/**
 * Helpers shared by weapon files (no `weapons` export, so the registry
 * ignores this file).
 */
import type { Projectile, WeaponInstance, WeaponLevel } from "../types";
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

/** Current stats (shared scratch object: read immediately, don't keep). */
export function wstats(w: World, inst: WeaponInstance): WStats {
  const L = inst.def.levels[Math.min(inst.level, inst.def.levels.length) - 1];
  const s = w.stats;
  S.L = L;
  S.dmg = L.dmg * s.might;
  S.cd = L.cd * s.cooldown;
  S.amount = Math.max(1, L.amount + s.amount);
  S.speed = (L.speed ?? 0) * s.projSpeed;
  S.pierce = L.pierce ?? 1;
  S.area = (L.area ?? 1) * s.area;
  S.duration = (L.duration ?? 1) * s.duration;
  S.knock = L.knock ?? 20;
  return S;
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

/** Emit the fire event for sfx. */
export function fired(w: World, inst: WeaponInstance, x: number, y: number): void {
  if (inst.def.sfx) w.emit("weaponFire", { id: inst.def.id, sfx: inst.def.sfx, x, y });
}
