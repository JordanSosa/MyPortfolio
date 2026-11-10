/**
 * Notice-Me Sparkles (Senpai's signature, docs/content/weapons.md §2.5): a
 * sparkle aura that stings a little and charms enemies into fighting each
 * other. Every `cd` s, every enemy inside r `radius` x area takes `dmg`; each
 * non-charmed one then rolls `charm` (elites half, bosses immune) and walks off
 * to fight for Senpai for `duration` s (weapons/_charm.ts). Up to `max`
 * admirers at once (+2 per extra amount, +2 per Fan Club rank). Lv5: heartbreak
 * explodes into hearts.
 *
 * Evolution: Shoujo Filter (+ Main Character Aura) - a bigger aura, charmed
 * enemies hit 3x harder, crits on charmed enemies get +0.5 crit multiplier,
 * and every 6 s a KIRA KIRA MOMENT charms every non-boss in the aura (bosses
 * are Distracted, their pattern pauses 1 s, once per 12 s per boss).
 *
 * Senpai's talents read here: Magnetic Personality (+1.5 charm points per
 * rank), Fan Club (+2 max per rank), Meaningful Glance (every 4 s a random
 * enemy in view is charmed / a boss stunned 0.5 s) and Love Triangle (chain
 * charms, see _charm.ts). No projectiles: the view reads `inst.data.r` (eased
 * aura radius) and `inst.data.kira` (seconds since the last Kira moment).
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { WeaponDef, WeaponInstance } from "../types";
import type { World } from "../world";
import { charm, charmRules, charmedCount, distract, isCharmed } from "./_charm";
import { HB, hfx } from "./_hb";
import { wstats, type WStats } from "./_shared";

const ID = "notice_me_sparkles";
const EVO = "shoujo_filter";

/** Max counted admirers for the current level (base + 2 per extra amount + 2 per Fan Club rank). */
function maxCharmed(w: World, S: WStats): number {
  return (S.L.max ?? 4) + 2 * Math.max(0, S.amount - 1) + 2 * w.talentRank("senpai_fan_club");
}

/** One aura pulse: damage everything inside, then charm rolls. */
function pulse(w: World, inst: WeaponInstance, S: WStats, R: number, evo: boolean): void {
  const pl = w.player;
  const cx = pl.x;
  const cy = pl.y - CFG.playerCy;
  const L = S.L;
  const chance = (L.charm ?? 0.08) + 0.015 * w.talentRank("senpai_magnetic");
  const secs = S.duration;
  const max = maxCharmed(w, S);
  const mul = evo ? (L.charmDmgMul ?? 3) : 2;
  const boom = evo || inst.level >= 5;
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 12, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead || e.def.prop) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy - cy;
    const rr = R + e.r * 0.5;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (w.hitEnemy(e, S.dmg, inst, Math.atan2(dy, dx), S.knock, 0, inst.def.id, inst.def.color)) continue;
    if (e.def.boss || isCharmed(w, e)) continue;
    const c = e.elite ? chance * 0.5 : chance;
    if (charmedCount(w) >= max || w.rng.next() >= c) continue;
    if (charm(w, e, secs, { max, mul, boom, links: 3 })) hfx(w, HB.CHARM, e.x, e.y - e.cy * 2, e.x, e.y, 0, 0, e);
  }
  w.release();
}

/** KIRA KIRA MOMENT: every non-boss in the aura is charmed for kiraTime s (free); bosses are Distracted. */
function kira(w: World, inst: WeaponInstance, S: WStats, R: number): void {
  const pl = w.player;
  const cx = pl.x;
  const cy = pl.y - CFG.playerCy;
  const secs = (S.L.kiraTime ?? 2) * w.stats.duration;
  const mul = S.L.charmDmgMul ?? 3;
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 12, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead || e.def.prop) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy - cy;
    const rr = R + e.r * 0.5;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (e.def.boss) {
      if (distract(w, e)) hfx(w, HB.FLUSTER, e.x, e.y - e.cy * 2, e.x, e.y, 0, 1, e);
      continue;
    }
    if (charm(w, e, secs, { counted: false, mul, boom: true, links: 3 })) hfx(w, HB.CHARM, e.x, e.y - e.cy * 2, e.x, e.y, 0, 1, e);
  }
  w.release();
  hfx(w, HB.KIRA, cx, cy, cx, cy, R);
}

/** Visual radius eases toward the real one (level-ups / area grow the aura smoothly). */
function easeRadius(inst: WeaponInstance, R: number, dt: number): void {
  const d = inst.data;
  d.r = d.r ? d.r + (R - d.r) * (1 - Math.exp(-6 * dt)) : R * 0.4;
}

/** Meaningful Glance (talent capstone): every 4 s a random enemy in view is charmed instantly (bosses: stunned 0.5 s). */
export function glance(w: World): void {
  const e = w.randomEnemyInView(-8);
  if (!e) return;
  const pl = w.player;
  const y = e.y - e.cy;
  if (e.def.boss) {
    e.stun = Math.max(e.stun, 0.5);
    hfx(w, HB.GLANCE, pl.x, pl.y - 14, e.x, y, 0, 1, e);
    return;
  }
  const inst = w.hasWeapon(EVO) ?? w.hasWeapon(ID);
  const S = inst ? wstats(w, inst) : null;
  const secs = S ? S.duration : 3 * w.stats.duration;
  const evo = inst?.def.id === EVO;
  hfx(w, HB.GLANCE, pl.x, pl.y - 14, e.x, y, 0, 0, e);
  if (charm(w, e, secs, { counted: false, mul: evo ? 3 : 2, boom: evo || (inst?.level ?? 0) >= 5, links: 3 })) hfx(w, HB.CHARM, e.x, e.y - e.cy * 2, e.x, e.y, 0, 1, e);
}

export const noticeMeSparkles: WeaponDef = {
  id: ID,
  name: "Notice-Me Sparkles",
  icon: "icon_notice_me_sparkles",
  color: C.pinkLight,
  sfx: "sparkleCharm",
  desc: "A sparkle aura that stings a little and charms enemies into fighting each other.",
  levels: [
    { dmg: 3, cd: 0.5, amount: 1, radius: 36, charm: 0.08, duration: 3, max: 4, knock: 6 },
    { dmg: 3, cd: 0.5, amount: 1, radius: 40, charm: 0.1, duration: 3, max: 4, knock: 6 },
    { dmg: 5, cd: 0.5, amount: 1, radius: 40, charm: 0.1, duration: 3, max: 6, knock: 6 },
    { dmg: 5, cd: 0.45, amount: 1, radius: 40, charm: 0.11, duration: 4, max: 6, knock: 6 },
    { dmg: 7, cd: 0.45, amount: 1, radius: 48, charm: 0.14, duration: 4, max: 10, knock: 8 },
  ],
  upgrades: ["Wider aura, more charming", "Damage +2, up to 6 admirers", "Charm lasts longer, ticks faster", "Damage +2, bigger aura, up to 10 admirers; heartbreak explodes"],
  evolutions: [{ into: EVO, with: "main_character_aura" }],
  limitBreak: [
    { area: 0.15, dmg: 0.2, text: "LIMIT BREAK — Extra Sparkle: +15% aura, +20% damage" },
    { dmg: 0.2, cd: 0.88, text: "MASTERED — Unbearable Charisma: +20% damage, ticks 12% faster" },
  ],
  init(w, inst) {
    inst.timer = 0.3;
    if (w.talentRank("senpai_love_triangle") > 0) charmRules(w, { triangle: true });
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const R = (S.L.radius ?? 36) * S.area;
    easeRadius(inst, R, dt);
    inst.timer -= dt;
    if (inst.timer > 0) return;
    inst.timer = Math.max(0.15, S.cd);
    pulse(w, inst, S, inst.data.r, false);
  },
};

export const shoujoFilter: WeaponDef = {
  id: EVO,
  name: "Shoujo Filter",
  icon: "icon_shoujo_filter",
  color: C.pink,
  sfx: "sparkleCharm",
  evolved: true,
  desc: "EVOLUTION! Everything near you is drawn in shoujo style. Charmed enemies hit 3× harder; every 6 s, a Kira Kira Moment charms them all.",
  levels: [{ dmg: 10, cd: 0.4, amount: 1, radius: 64, charm: 0.2, duration: 4, max: 20, charmDmgMul: 3, critBonus: 0.5, kiraEvery: 6, kiraTime: 2, knock: 10 }],
  upgrades: [],
  init(w, inst) {
    inst.timer = 0.2;
    inst.data.kt = 2.5;
    inst.data.kira = 99;
    charmRules(w, { critBonus: inst.def.levels[0].critBonus ?? 0.5, triangle: w.talentRank("senpai_love_triangle") > 0 });
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    const R = (S.L.radius ?? 64) * S.area;
    easeRadius(inst, R, dt);
    d.kira = (d.kira ?? 0) + dt;
    d.kt = (d.kt ?? 0) - dt;
    if (d.kt <= 0) {
      d.kt = S.L.kiraEvery ?? 6;
      d.kira = 0;
      kira(w, inst, S, d.r);
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    inst.timer = Math.max(0.12, S.cd);
    pulse(w, inst, S, d.r, true);
  },
};

export const weapons: WeaponDef[] = [noticeMeSparkles, shoujoFilter];
