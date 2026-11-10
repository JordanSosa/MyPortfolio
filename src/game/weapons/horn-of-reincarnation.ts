/**
 * Horn of Reincarnation (Truck-kun's signature, docs/content/weapons.md §2.8):
 * HONK - every `cd` s a shockwave cone in the facing direction (length `len` x
 * area, half-angle `angle`°, `dmg`, `knock`, daze 0.3 s). `amount` 2 = a second
 * honk 0.25 s later at 60 % ("HONK-HONK"). Ram: while the hero moves at >= 60 %
 * of its move speed, enemies touching a circle r 10 placed 8 px ahead of the
 * body take `ram` damage (per-enemy re-hit 0.4 s) and are knocked sideways.
 *
 * Twist - Isekai'd: non-boss enemies killed by the honk or the ram vanish in a
 * light pillar instead of confetti and drop +1 extra gem with 25 % chance
 * (weapons/_hb.ts installIsekai; RunStats.isekaid).
 *
 * Evolution: Isekai Rush Hour (+ Swift Shoes) - a 360° honk ring every `cd` s
 * and every `truckEvery` s a phantom truck ploughs through the densest cluster
 * after a 0.4 s lane telegraph (`truckDmg`, pierce ∞, knockback 300 along the
 * lane); ram `ram`; isekai'd extra-gem chance `isekai`.
 *
 * Truck-kun's talents read here: Air Horn (+8 % cone length per rank), Bull Bar
 * (+20 % ram damage per rank, rammed enemies stunned 0.2 / 0.3 / 0.4 s),
 * Next-Life Guarantee (extra-gem chance, installIsekai) and Eighteen Wheeler
 * (the horn also honks backward at 70 %, ram hitbox +50 %).
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import { PK_FREE, ROT_FIXED, SHAPE_ELLIPSE, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { GHOST_TRUCK, HB, densest, hfx, installIsekai } from "./_hb";
import { fired, wstats, type WStats } from "./_shared";
import { facing, ramming } from "./_truck";

const ID = "horn_of_reincarnation";
const EVO = "isekai_rush_hour";
const dir = { x: 1, y: 0 };
const pt = { x: 0, y: 0 };
const LANE_HALF = 14;
const GHOST_TINT = 0xbafff6;

/** Next-Life Guarantee: +15 / 25 / 35 % extra-gem chance on isekai'd kills. */
function nextLife(w: World): number {
  const r = w.talentRank("truck_next_life");
  return r <= 0 ? 0 : [0.15, 0.25, 0.35][Math.min(3, r) - 1];
}

/** Damage multiplier of the weapon's base `dmg` (might x mastery x Limit Break). */
function dmgK(S: WStats): number {
  return S.dmg / Math.max(1e-6, S.L.dmg);
}

/**
 * Honk cone from the hero's body along (dx, dy). `half` = half-angle in degrees (>= 180 = ring).
 * Returns the enemies hit.
 */
function honk(w: World, inst: WeaponInstance, dx: number, dy: number, len: number, half: number, dmg: number, knock: number): number {
  const p = w.player;
  const ox = p.x + dx * 4;
  const oy = p.y - CFG.playerCy + dy * 4;
  const cosH = half >= 180 ? -2 : Math.cos((half * Math.PI) / 180);
  const buf = w.acquire();
  const n = w.grid.query(ox, oy, len + 12, buf);
  const items = w.enemies.items;
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const ex = e.x - ox;
    const ey = e.y - e.cy - oy;
    const d = Math.sqrt(ex * ex + ey * ey);
    if (d > len + e.r) continue;
    // inside the cone (a little slack for the enemy's body)
    if (cosH > -2 && d > e.r && (ex * dx + ey * dy) / d < cosH - e.r / Math.max(8, d)) continue;
    if (!e.def.boss && !e.def.prop) e.stun = Math.max(e.stun, 0.3);
    w.hitEnemy(e, dmg, inst, Math.atan2(ey, ex), knock, 0, inst.def.id, inst.def.color);
    hits++;
  }
  w.release();
  hfx(w, HB.HONK, ox, oy, dx, dy, len, half >= 180 ? 0 : half);
  return hits;
}

/** Ram: a circle ahead of the moving hero (per-enemy 0.4 s on the weapon's channel). */
function ram(w: World, inst: WeaponInstance, S: WStats): void {
  if (!ramming(w)) return;
  const p = w.player;
  const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
  const ux = p.vx / sp;
  const uy = p.vy / sp;
  const big = w.talentRank("truck_eighteen_wheeler") > 0 ? 1.5 : 1;
  const R = 10 * big;
  const cx = p.x + ux * 8 * big;
  const cy = p.y - CFG.playerCy + uy * 8 * big;
  const bull = w.talentRank("truck_bull_bar");
  const dmg = (S.L.ram ?? 12) * dmgK(S) * (1 + 0.2 * bull);
  const ch = inst.slot;
  const now = w.t;
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 12, buf);
  const items = w.enemies.items;
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const ex = e.x - cx;
    const ey = e.y - e.cy - cy;
    const rr = R + e.r;
    if (ex * ex + ey * ey > rr * rr) continue;
    if (now - e.lastHit[ch] < 0.4) continue;
    e.lastHit[ch] = now;
    // knocked sideways: away from the truck's path, to whichever side it was on
    const side = ux * ey - uy * ex >= 0 ? 1 : -1;
    const ka = Math.atan2(ux * side, -uy * side);
    if (bull > 0 && !e.def.boss && !e.def.prop) e.stun = Math.max(e.stun, 0.1 + 0.1 * bull);
    w.hitEnemy(e, dmg, inst, ka, 120, 0, inst.def.id, inst.def.color);
    hits++;
  }
  w.release();
  if (hits > 0) hfx(w, HB.RAM, cx, cy, ux, uy, R, hits);
}

export const hornOfReincarnation: WeaponDef = {
  id: ID,
  name: "Horn of Reincarnation",
  icon: "icon_horn_of_reincarnation",
  color: C.yellow,
  sfx: "honk",
  desc: "HONK: a shockwave cone ahead. Moving rams enemies, and the ones you finish are sent to another world.",
  levels: [
    { dmg: 18, cd: 1.8, amount: 1, len: 64, angle: 30, knock: 180, ram: 12 },
    { dmg: 18, cd: 1.8, amount: 1, len: 72, angle: 30, knock: 180, ram: 16 },
    { dmg: 26, cd: 1.8, amount: 1, len: 72, angle: 38, knock: 190, ram: 16 },
    { dmg: 26, cd: 1.5, amount: 1, len: 72, angle: 38, knock: 190, ram: 22 },
    { dmg: 36, cd: 1.5, amount: 2, len: 88, angle: 38, knock: 200, ram: 30 },
  ],
  upgrades: ["Louder honk, harder ram", "Damage +8, wider honk", "Cooldown −17%, ram damage +6", "Damage +10, longer honk, HONK-HONK"],
  evolutions: [{ into: EVO, with: "swift_shoes" }],
  limitBreak: [
    { dmg: 0.2, area: 0.15, text: "LIMIT BREAK — Air Horn Upgrade: +20% damage, +15% honk" },
    { cd: 0.85, dmg: 0.2, text: "MASTERED — Rush Hour: −15% cooldown, +20% damage" },
  ],
  init(w, inst) {
    installIsekai(w, nextLife(w));
    inst.timer = 0.4;
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    ram(w, inst, S);
    const len = (S.L.len ?? 64) * S.area * (1 + 0.08 * w.talentRank("truck_air_horn"));
    const half = S.L.angle ?? 30;
    const back = w.talentRank("truck_eighteen_wheeler") > 0;
    // queued follow-up honks (HONK-HONK): 0.25 s apart at 60 %
    if ((d.q ?? 0) > 0) {
      d.qt -= dt;
      if (d.qt <= 0) {
        d.q--;
        d.qt = 0.25;
        facing(w, dir);
        honk(w, inst, dir.x, dir.y, len, half, S.dmg * 0.6, S.knock);
        if (back) honk(w, inst, -dir.x, -dir.y, len, half, S.dmg * 0.6 * 0.7, S.knock);
        fired(w, inst, w.player.x, w.player.y);
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    if (!w.nearestEnemy(pl.x, pl.y - CFG.playerCy, len + 24)) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
    facing(w, dir);
    honk(w, inst, dir.x, dir.y, len, half, S.dmg, S.knock);
    if (back) honk(w, inst, -dir.x, -dir.y, len, half, S.dmg * 0.7, S.knock);
    fired(w, inst, pl.x, pl.y);
    d.q = Math.max(0, S.amount - 1);
    d.qt = 0.25;
  },
};

// ---------------------------------------------------------------- Isekai Rush Hour

/** A phantom truck driving the lane from (x0, y) along +x (dir 1) or -x (dir -1). */
function phantomTruck(w: World, inst: WeaponInstance, x0: number, y: number, dirX: number, len: number, S: WStats): void {
  const L = S.L;
  const sp = (L.truckSpeed ?? 480) * w.stats.projSpeed;
  const p = w.spawnProjectile(inst);
  p.kind = PK_FREE;
  p.x = x0;
  p.y = y;
  p.speed = sp;
  p.vx = dirX * sp;
  p.vy = 0;
  p.shape = SHAPE_ELLIPSE;
  p.ang = 0;
  p.hw = 20;
  p.hh = LANE_HALF;
  p.r = 20;
  p.dmg = (L.truckDmg ?? 90) * dmgK(S);
  p.knock = 300;
  p.pierce = Infinity;
  p.hitEvery = 0.6;
  p.life = len / sp;
  // (sprite-less: the view draws the ghost truck centred on its lane, see GHOST_TRUCK)
  p.scale = 1.5;
  p.tint = GHOST_TINT;
  p.alpha = 0.7;
  p.rotMode = ROT_FIXED;
  p.flipX = dirX < 0;
  p.update = GHOST_TRUCK;
  hfx(w, HB.LANE, x0, y, x0 + dirX * len, y, LANE_HALF, 0);
}

export const isekaiRushHour: WeaponDef = {
  id: EVO,
  name: "Isekai Rush Hour",
  icon: "icon_isekai_rush_hour",
  color: C.yellow,
  sfx: "honk",
  evolved: true,
  desc: "EVOLUTION! The honk goes 360° and phantom trucks plough through crowds on a schedule.",
  levels: [{ dmg: 40, cd: 1.5, amount: 1, radius: 72, knock: 220, ram: 45, truckEvery: 4, truckDmg: 90, truckSpeed: 480, isekai: 0.4 }],
  upgrades: [],
  init(w, inst) {
    installIsekai(w, nextLife(w));
    inst.timer = 0.3;
    inst.data.tt = 1.5;
    inst.data.lane = -1;
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    ram(w, inst, S);
    const pl = w.player;
    // phantom trucks: a 0.4 s lane telegraph through the densest cluster, then the truck
    if (d.lane >= 0) {
      d.lane -= dt;
      if (d.lane <= 0) {
        d.lane = -1;
        const span = w.viewW + 80;
        phantomTruck(w, inst, d.lx, d.ly, d.ld, span, S);
        fired(w, inst, d.lx, d.ly);
      }
    }
    d.tt = (d.tt ?? 0) - dt;
    if (d.tt <= 0 && d.lane < 0) {
      if (densest(w, pt) > 0) {
        d.tt = S.L.truckEvery ?? 4;
        const ld = w.rng.next() < 0.5 ? 1 : -1;
        const hw = w.viewW * 0.5 + 40;
        d.ld = ld;
        d.lx = pl.x - ld * hw;
        d.ly = pt.y;
        d.lane = 0.4;
        w.telegraphLine(d.lx, d.ly, pl.x + ld * hw, d.ly, LANE_HALF, 0.4, 0xffe14d);
        hfx(w, HB.LANE_TELL, d.lx, d.ly, pl.x + ld * hw, d.ly, 0.4);
      } else d.tt = 0.3;
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const R = (S.L.radius ?? 72) * S.area * (1 + 0.08 * w.talentRank("truck_air_horn"));
    if (!w.nearestEnemy(pl.x, pl.y - CFG.playerCy, R + 16)) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
    honk(w, inst, 1, 0, R, 180, S.dmg, S.knock);
    fired(w, inst, pl.x, pl.y);
  },
};

export const weapons: WeaponDef[] = [hornOfReincarnation, isekaiRushHour];
