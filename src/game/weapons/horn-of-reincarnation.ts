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
 * Second evolution: Free Delivery (+ Magnet Star) - the honk is reversed: every `cd` s the cone ahead
 * (`len` x area, half-angle `angle`°) PULLS every enemy in it up to `pull` px toward the bumper (a `dmg`
 * tug; elites half, bosses and props not at all) and the gems / coins in it to the truck; `slamAfter` s
 * later the DELIVERY lands: everything on the bumper (r `slamR` x area) takes `slam` and is thrown ahead.
 * The moving ram stays (`ram`), no phantom trucks. Its kills are isekai'd with the base weapon's extra-gem
 * chance (`isekai`), but quietly (`quietIsekai`): everything dies ON the bumper, and a light pillar per
 * kill there buried the truck - the view shows one pillar per delivery instead (FD_SLAM's kills).
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
import { GHOST_TRUCK, HB, densest, extraGem, hfx, installIsekai } from "./_hb";
import { fired, wstats, type WStats } from "./_shared";
import { facing, ramming } from "./_truck";

const ID = "horn_of_reincarnation";
const EVO = "isekai_rush_hour";
const FREE = "free_delivery";
/** heroFx cues (src/view/evo2/d.ts): the reversed honk from (x, y) along (x2, y2), r = length, n = half-angle. */
export const FD_PULL = "evo2d_pull";
/** An enemy got pulled (it wears a parcel for a moment): `enemy`. */
export const FD_PARCEL = "evo2d_parcel";
/** The delivery landed on the bumper at (x, y) along (x2, y2); r = radius, n = enemies hit + 100 x the ones it finished. */
export const FD_SLAM = "evo2d_slam";
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
  evolutions: [
    { into: EVO, with: "swift_shoes" },
    { into: FREE, with: "magnet_star" },
  ],
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

// ---------------------------------------------------------------- Free Delivery

/** Knockback velocity that carries an enemy `px` (World decays e.kx by exp(-9 t)). */
const PULL_K = 9;
/** Parcels (view cues) per honk. */
const PARCELS = 14;

const QUIET = new WeakSet<World>();
/** Kills this step by Free Delivery (the slam reports its own). */
let finished = 0;

/** Free Delivery's isekai'd kills: RunStats.isekaid and the extra gem, without a light pillar each (once per world). */
function quietIsekai(w: World): void {
  if (QUIET.has(w)) return;
  QUIET.add(w);
  w.hooks.on("kill", (k) => {
    if (k.source !== FREE || k.boss) return;
    finished++;
    w.bumpStat("isekaid");
    const inst = w.hasWeapon(FREE);
    let c = (inst?.def.levels[0].isekai ?? 0.25) + nextLife(w);
    while (c > 0) {
      if (c >= 1 || w.rng.next() < c) extraGem(w, k.enemy, k.x, k.y);
      c -= 1;
    }
  });
}

/**
 * The delivery spot: `out` = the point just off the bumper, `DROP` px ahead of the body along (dx, dy).
 * (Not on the cab: a whole cone of enemies dying on top of the truck buried it in their own death fx.)
 */
const DROP = 22;
function bumper(w: World, dx: number, dy: number, out: { x: number; y: number }): void {
  const p = w.player;
  out.x = p.x + dx * DROP;
  out.y = p.y - CFG.playerCy + dy * DROP;
}

/** The reversed honk: pull everything in the cone toward the bumper. Returns the enemies pulled. */
function pullCone(w: World, inst: WeaponInstance, dx: number, dy: number, len: number, half: number, pull: number, dmg: number): number {
  bumper(w, dx, dy, pt);
  const bx = pt.x;
  const by = pt.y;
  const p = w.player;
  const ox = p.x;
  const oy = p.y - CFG.playerCy;
  const cosH = Math.cos((half * Math.PI) / 180);
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
    if (d > e.r && (ex * dx + ey * dy) / d < cosH - e.r / Math.max(8, d)) continue;
    // the tug: toward the bumper, never past it (the hit's own knock is 0: the pull is set, not added)
    const tx = bx - e.x;
    const ty = by - (e.y - e.cy);
    const td = Math.sqrt(tx * tx + ty * ty);
    if (w.hitEnemy(e, dmg, inst, Math.atan2(ty, tx), 0, 0, FREE, inst.def.color)) continue;
    hits++;
    if (e.def.boss || e.def.prop) continue;
    const resist = e.def.knockResist ?? 0;
    const want = Math.min(pull * (e.elite ? 0.5 : 1) * (1 - resist), Math.max(0, td - e.r - 4));
    if (want > 1 && td > 1) {
      e.kx = (tx / td) * want * PULL_K;
      e.ky = (ty / td) * want * PULL_K;
      e.stun = Math.max(e.stun, 0.3);
      if (hits <= PARCELS) hfx(w, FD_PARCEL, e.x, e.y, e.x, e.y, 0, 0, e);
    }
  }
  w.release();
  // free shipping: the gems and coins in the cone come along
  const far = len * len;
  const gems = w.gems;
  for (let i = 0; i < gems.count; i++) {
    const g = gems.items[i];
    if (g.dead || g.state !== 0) continue;
    const gx = g.x - ox;
    const gy = g.y - oy;
    const d2 = gx * gx + gy * gy;
    if (d2 > far || gx * dx + gy * dy < cosH * Math.sqrt(d2)) continue;
    g.state = 1;
    g.speed = 90;
  }
  const picks = w.pickups;
  for (let i = 0; i < picks.count; i++) {
    const c = picks.items[i];
    if (c.dead || c.kind !== "coin" || c.state !== 0) continue;
    const gx = c.x - ox;
    const gy = c.y - oy;
    const d2 = gx * gx + gy * gy;
    if (d2 > far || gx * dx + gy * dy < cosH * Math.sqrt(d2)) continue;
    c.state = 1;
    c.speed = 90;
  }
  hfx(w, FD_PULL, ox, oy, dx, dy, len, half);
  return hits;
}

/** The delivery: everything on the bumper takes `slam` and is thrown ahead. */
function deliver(w: World, inst: WeaponInstance, S: WStats, dx: number, dy: number): void {
  bumper(w, dx, dy, pt);
  const cx = pt.x;
  const cy = pt.y;
  const big = w.talentRank("truck_eighteen_wheeler") > 0 ? 1.5 : 1;
  const R = (S.L.slamR ?? 16) * Math.sqrt(S.area) * big;
  const bull = w.talentRank("truck_bull_bar");
  const dmg = (S.L.slam ?? 85) * dmgK(S) * (1 + 0.2 * bull);
  const ka = Math.atan2(dy, dx);
  finished = 0;
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 14, buf);
  const items = w.enemies.items;
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const ex = e.x - cx;
    const ey = e.y - e.cy - cy;
    const rr = R + e.r;
    if (ex * ex + ey * ey > rr * rr) continue;
    if (bull > 0 && !e.def.boss && !e.def.prop) e.stun = Math.max(e.stun, 0.1 + 0.1 * bull);
    w.hitEnemy(e, dmg, inst, ka, S.knock, 0, FREE, inst.def.color);
    hits++;
  }
  w.release();
  if (hits > 0) hfx(w, FD_SLAM, cx, cy, dx, dy, R, hits + 100 * finished);
}

export const freeDelivery: WeaponDef = {
  id: FREE,
  name: "Free Delivery",
  icon: "icon_free_delivery",
  color: C.yellow,
  evolved: true,
  desc: "EVOLUTION! The horn now pulls. Parcels are delivered to the bumper. The parcels are enemies.",
  levels: [{ dmg: 12, cd: 1.6, amount: 1, len: 110, angle: 40, pull: 60, knock: 150, ram: 40, slam: 85, slamR: 16, slamAfter: 0.24, isekai: 0.25 }],
  upgrades: [],
  init(w, inst) {
    quietIsekai(w);
    inst.timer = 0.3;
    inst.data.st = -1;
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    ram(w, inst, S);
    // the delivery lands `slamAfter` s after its honk, wherever the bumper is by then
    if (d.st >= 0) {
      d.st -= dt;
      if (d.st < 0) {
        facing(w, dir);
        deliver(w, inst, S, dir.x, dir.y);
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    const len = (S.L.len ?? 110) * S.area * (1 + 0.08 * w.talentRank("truck_air_horn"));
    if (!w.nearestEnemy(pl.x, pl.y - CFG.playerCy, len + 24)) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
    facing(w, dir);
    const half = S.L.angle ?? 40;
    pullCone(w, inst, dir.x, dir.y, len, half, S.L.pull ?? 60, S.dmg);
    // Eighteen Wheeler: the horn pulls what is behind too (at 70 %, to the tailgate)
    if (w.talentRank("truck_eighteen_wheeler") > 0) pullCone(w, inst, -dir.x, -dir.y, len, half, (S.L.pull ?? 60) * 0.7, S.dmg * 0.7);
    d.st = S.L.slamAfter ?? 0.24;
  },
};

export const weapons: WeaponDef[] = [hornOfReincarnation, isekaiRushHour, freeDelivery];
