/**
 * Cheat Fireball (Isekai-kun's signature, docs/content/weapons.md §2.7):
 * "Cheat Skill: Fireball Lv.9999. It's his Lv.1 spell." Every `cd` s,
 * `amount` fireballs fly at the nearest distinct enemies at `speed`; each
 * explodes on its first hit (or after 180 px): r `blast` x area, `dmg`, `knock`.
 *
 * Twist - "Did I overdo it?": every `overdo`-th cast (counter on the weapon) is
 * overdone: blast x2.5, damage x3, a burning crater (r 20, 2 s, 8 dmg every
 * 0.25 s), shake + white flash and "Did I overdo it?" (view, rate-limited).
 * Counts RunStats.overdos (once per overdone cast).
 *
 * Evolution: Meteor Lv.99999 (+ Training Montage) - every `cd` s a meteor falls
 * on the densest cluster (telegraphed): r `blast`, `dmg`; every `overdo`-th one
 * is r `overdoBlast`, x3 damage, crater r 40 for 3 s, "...did I overdo it again?".
 * Between meteors, `small` regular fireballs every 1.2 s (`smallDmg`).
 *
 * Second evolution: "Holding Back" Fireball (+ Twin Charm) - a stream: every `cd` s one small fireball
 * (speed `speed`, small blast r `blast` x area, `dmg`, no explosion event: the view sparks it) at the
 * nearest enemy, +1 stream at the next-nearest per 2 extra amount. No overdone casts; every `sneeze`-th
 * fireball is a sneeze instead: one overdone blast of the base weapon (`sneezeDmg`, r `sneezeBlast`).
 *
 * Isekai-kun's talents read here: "Lv.9999" (+8 % blast per rank), Overdone
 * (rank 1 every 4th cast, rank 2 +20 % overdone blast, rank 3 every 3rd),
 * "Did I Overdo It AGAIN?" (every overdone detonation bursts into 6 regular
 * fireballs). The burning craters are the instance's owned projectiles
 * (`inst.projs`, sprite-less: the view draws them on the ground).
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { CFG } from "../config";
import { PK_FALL, PK_FREE, PK_MANAGED, ROT_VELOCITY, type Enemy, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { CRATER, HB, densest, hfx } from "./_hb";
import { fired, own, prune, wstats, type WStats } from "./_shared";

const ID = "cheat_fireball";
const EVO = "cheat_meteor";
const HOLD = "holding_back";
/** heroFx cues (src/view/evo2/d.ts): a small fireball popped at (x, y), radius r / a volley left the hand (n = fireballs so far) / the sneeze. */
export const HOLD_POP = "evo2d_pop";
export const HOLD_SHOT = "evo2d_shot";
export const HOLD_SNEEZE = "evo2d_sneeze";
const RANGE = 180;
const targets: Enemy[] = [];
const pt = { x: 0, y: 0 };

/** Every n-th cast is overdone (Overdone talent: every 4th at rank 1, every 3rd at rank 3). */
function overdoEvery(w: World, base: number): number {
  const r = w.talentRank("isekai_overdone");
  let n = base;
  if (r >= 1) n = Math.min(n, 4);
  if (r >= 3) n = Math.min(n, 3);
  return Math.max(2, n);
}

/** Blast radius multiplier from "Lv.9999" (+8 % per rank). */
function blastK(w: World): number {
  return 1 + 0.08 * w.talentRank("isekai_lv9999");
}

/** Overdone blast multiplier (x2.5, Overdone rank 2: +20 %). */
function overdoK(w: World): number {
  return 2.5 * (w.talentRank("isekai_overdone") >= 2 ? 1.2 : 1);
}

/** A burning crater (owned, sprite-less: drawn on the ground by the view). */
function crater(w: World, inst: WeaponInstance, x: number, y: number, r: number, life: number): void {
  const q = w.spawnProjectile(inst);
  q.kind = PK_MANAGED;
  q.x = x;
  q.y = y;
  q.r = r;
  q.dmg = 8 * w.stats.might * (inst.dmgMul ?? 1);
  q.hitEvery = 0.25;
  q.pierce = Infinity;
  q.knock = 0;
  q.life = life;
  q.update = CRATER;
  own(inst, q);
}

/** Detonation (fireball onEnd): p.hw = blast radius, p.a = 1 overdone, p.hh = regular damage (for the burst-children). */
const detonate: ProjHook = (p, w) => {
  const inst = p.owner;
  const over = p.a === 1;
  w.explode(p.x, p.y, p.hw, p.dmg, inst, p.knock, inst ? inst.def.id : ID, C.orange, over);
  if (!over || !inst) return;
  crater(w, inst, p.x, p.y + 4, 20, 2);
  hfx(w, HB.OVERDO, p.x, p.y, p.x, p.y, p.hw, 0);
  // "Did I Overdo It AGAIN?": the overdone fireball bursts into 6 regular ones
  if (w.talentRank("isekai_overdid_again") > 0) burstSix(w, inst, p.x, p.y, p.hh, p.knock);
};

/** A small "ordinary" fireball's pop (Holding Back): the blast without World.explode's event (p.hw = radius). */
const smallPop: ProjHook = (p, w) => {
  const inst = p.owner;
  const R = p.hw;
  const buf = w.acquire();
  const n = w.grid.query(p.x, p.y, R + 16, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]] as Enemy | undefined;
    if (!e || e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - e.cy - p.y;
    const rr = R + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    w.hitEnemy(e, p.dmg, inst, Math.atan2(dy, dx), p.knock, 0, HOLD, C.orange);
  }
  w.release();
  hfx(w, HOLD_POP, p.x, p.y, p.x, p.y, R);
};

/** Fireball steering: explode on the first enemy it touches (no contact damage of its own). */
const fly: ProjHook = (p, w) => {
  const e = w.nearestEnemy(p.x, p.y, 24);
  if (!e) return;
  const dx = e.x - p.x;
  const dy = e.y - e.cy - p.y;
  const rr = e.r + p.b;
  if (dx * dx + dy * dy <= rr * rr) w.endProjectile(p);
};

/** One fireball from (x, y) along angle a. */
function fireball(w: World, inst: WeaponInstance, x: number, y: number, a: number, speed: number, dmg: number, blast: number, knock: number, over: boolean, base: number): Projectile {
  const p = w.spawnProjectile(inst);
  p.kind = PK_FREE;
  p.x = x;
  p.y = y;
  p.speed = speed;
  p.vx = Math.cos(a) * speed;
  p.vy = Math.sin(a) * speed;
  p.r = 0;
  p.b = over ? 7 : 4;
  p.dmg = dmg;
  p.knock = knock;
  p.hw = blast;
  p.hh = base;
  p.a = over ? 1 : 0;
  p.life = RANGE / Math.max(40, speed);
  p.sprite = "w_fireball";
  p.fps = 12;
  p.scale = over ? 1.7 : 1;
  p.rotMode = ROT_VELOCITY;
  p.glow = true;
  p.trail = over ? "hbFireBig" : "hbFire";
  p.update = fly;
  p.onEnd = detonate;
  return p;
}

/** Six regular fireballs in a ring (the AGAIN capstone; they explode on contact or after 180 px). */
function burstSix(w: World, inst: WeaponInstance, x: number, y: number, dmg: number, knock: number): void {
  const blast = 22 * w.stats.area * blastK(w);
  const sp = 120 * w.stats.projSpeed;
  const a0 = w.rng.angle();
  for (let i = 0; i < 6; i++) fireball(w, inst, x, y, a0 + (i / 6) * TAU, sp, dmg, blast, knock, false, dmg);
}

/** A cast: `amount` fireballs at the nearest distinct enemies. */
function cast(w: World, inst: WeaponInstance, S: WStats): void {
  const d = inst.data;
  d.cast = (d.cast ?? 0) + 1;
  const over = d.cast % overdoEvery(w, S.L.overdo ?? 5) === 0;
  const pl = w.player;
  const sx = pl.x + pl.face * 5;
  const sy = pl.y - 13;
  const n = w.nearestEnemies(sx, sy, 200, S.amount, targets);
  const blast = (S.L.blast ?? 22) * S.area * blastK(w);
  for (let i = 0; i < S.amount; i++) {
    let a: number;
    if (n > 0) {
      const t = targets[i % n];
      a = Math.atan2(t.y - t.cy - sy, t.x - sx) + (i >= n ? w.rng.spread(0.35) : 0);
    } else a = Math.atan2(pl.aimY, pl.aimX) + w.rng.spread(0.4);
    fireball(w, inst, sx, sy, a, S.speed, over ? S.dmg * 3 : S.dmg, over ? blast * overdoK(w) : blast, S.knock, over, S.dmg);
  }
  if (over) w.bumpStat("overdos");
  hfx(w, HB.CAST, sx, sy, sx, sy, 0, over ? 1 : 0);
  fired(w, inst, sx, sy);
}

export const cheatFireball: WeaponDef = {
  id: ID,
  name: "Cheat Fireball",
  icon: "icon_cheat_fireball",
  color: C.orange,
  sfx: "fireball",
  desc: "Cheat Skill: Fireball Lv.9999. It's his Lv.1 spell. Every few casts he overdoes it.",
  levels: [
    { dmg: 28, cd: 1.8, amount: 1, speed: 110, blast: 22, overdo: 5, knock: 90 },
    { dmg: 34, cd: 1.8, amount: 1, speed: 110, blast: 24, overdo: 5, knock: 90 },
    { dmg: 34, cd: 1.8, amount: 2, speed: 115, blast: 24, overdo: 5, knock: 95 },
    { dmg: 44, cd: 1.5, amount: 2, speed: 115, blast: 28, overdo: 5, knock: 100 },
    { dmg: 52, cd: 1.5, amount: 3, speed: 120, blast: 28, overdo: 4, knock: 110 },
  ],
  upgrades: ["Damage +6, bigger boom", "+1 fireball", "Damage +10, cooldown −17%, bigger boom", "Damage +8, +1 fireball, overdoes it every 4th cast"],
  evolutions: [
    { into: EVO, with: "training_montage" },
    { into: HOLD, with: "twin_charm" },
  ],
  limitBreak: [
    { amount: 1, dmg: 0.1, text: "LIMIT BREAK — Dual Cast (Accidentally): +1 fireball, +10% damage" },
    { dmg: 0.25, area: 0.2, text: "MASTERED — Lv.10000: +25% damage, +20% blast" },
  ],
  update(w, inst, dt) {
    if (inst.projs.length) prune(inst);
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    if (!w.nearestEnemy(pl.x, pl.y - CFG.playerCy, 190)) {
      inst.timer = 0.1;
      return;
    }
    const S = wstats(w, inst);
    inst.timer = S.cd;
    cast(w, inst, S);
  },
};

// ---------------------------------------------------------------- Meteor Lv.99999

/** Meteor landing: p.hw = blast radius, p.a = 1 overdone. */
const meteorLand: ProjHook = (p, w) => {
  const inst = p.owner;
  const over = p.a === 1;
  w.explode(p.x, p.y, p.hw, p.dmg, inst, p.knock, inst ? inst.def.id : EVO, C.orange, true);
  if (!inst) return;
  if (over) {
    crater(w, inst, p.x, p.y + 4, 40, 3);
    hfx(w, HB.OVERDO, p.x, p.y, p.x, p.y, p.hw, 1);
    if (w.talentRank("isekai_overdid_again") > 0) burstSix(w, inst, p.x, p.y - 4, p.hh, 110);
  }
};

const FALL_H = 220;
const FALL_SPEED = 320;

function meteor(w: World, inst: WeaponInstance, S: WStats): void {
  const d = inst.data;
  d.cast = (d.cast ?? 0) + 1;
  const over = d.cast % overdoEvery(w, S.L.overdo ?? 3) === 0;
  if (densest(w, pt) <= 0) {
    pt.x = w.player.x + w.rng.spread(40);
    pt.y = w.player.y - 30;
  }
  const L = S.L;
  const r = (over ? (L.overdoBlast ?? 110) * (w.talentRank("isekai_overdone") >= 2 ? 1.2 : 1) : (L.blast ?? 48)) * S.area * blastK(w);
  const p = w.spawnProjectile(inst);
  p.kind = PK_FALL;
  p.x = pt.x + 30;
  p.y = pt.y;
  const t = FALL_H / FALL_SPEED;
  p.vx = -30 / t;
  p.z = FALL_H;
  p.vz = -FALL_SPEED;
  p.r = 0;
  p.life = 3;
  p.dmg = over ? S.dmg * 3 : S.dmg;
  p.hh = (L.smallDmg ?? 30) * (S.dmg / Math.max(1e-6, L.dmg));
  p.knock = S.knock;
  p.hw = r;
  p.a = over ? 1 : 0;
  p.sprite = "w_meteor_cheat";
  p.fps = 10;
  p.scale = over ? 2.2 : 1.2;
  p.rot = Math.atan2(FALL_SPEED, -30 / t) - Math.PI / 2;
  p.glow = true;
  p.trail = "meteor";
  p.shadow = over ? 30 : 16;
  p.telegraph = r;
  p.onEnd = meteorLand;
  if (over) w.bumpStat("overdos");
  fired(w, inst, pt.x, pt.y);
}

export const cheatMeteor: WeaponDef = {
  id: EVO,
  name: "Meteor Lv.99999",
  icon: "icon_cheat_meteor",
  color: C.orange,
  sfx: "explosionBig",
  evolved: true,
  desc: "EVOLUTION! He trained (once). Meteors fall on the biggest crowd; every third one is... a lot.",
  levels: [{ dmg: 120, cd: 2.4, amount: 1, blast: 48, overdo: 3, overdoBlast: 110, small: 2, smallDmg: 30, knock: 160 }],
  upgrades: [],
  init(_w, inst) {
    inst.timer = 0.6;
    inst.data.st = 0.6;
  },
  update(w, inst, dt) {
    if (inst.projs.length) prune(inst);
    const S = wstats(w, inst);
    const d = inst.data;
    // between meteors: `small` regular fireballs every 1.2 s
    d.st = (d.st ?? 0) - dt;
    if (d.st <= 0) {
      d.st = 1.2 * Math.max(0.5, w.stats.cooldown);
      const pl = w.player;
      const sx = pl.x + pl.face * 5;
      const sy = pl.y - 13;
      const n = w.nearestEnemies(sx, sy, 200, (S.L.small ?? 2) + Math.max(0, S.amount - 1), targets);
      const dmg = (S.L.smallDmg ?? 30) * (S.dmg / Math.max(1e-6, S.L.dmg));
      const blast = 22 * S.area * blastK(w);
      for (let i = 0; i < n; i++) {
        const t = targets[i];
        fireball(w, inst, sx, sy, Math.atan2(t.y - t.cy - sy, t.x - sx), 120 * w.stats.projSpeed, dmg, blast, 90, false, dmg);
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    if (!w.nearestEnemy(pl.x, pl.y - CFG.playerCy, 220)) {
      inst.timer = 0.15;
      return;
    }
    inst.timer = S.cd;
    meteor(w, inst, S);
  },
};

// ---------------------------------------------------------------- "Holding Back" Fireball

export const holdingBack: WeaponDef = {
  id: HOLD,
  name: '"Holding Back" Fireball',
  icon: "icon_holding_back",
  color: C.orange,
  evolved: true,
  desc: "EVOLUTION! He is holding back. This is him holding back: a stream of perfectly ordinary fireballs.",
  levels: [{ dmg: 15, cd: 0.14, amount: 1, speed: 230, blast: 12, knock: 20, sneeze: 100, sneezeDmg: 156, sneezeBlast: 70 }],
  upgrades: [],
  init(_w, inst) {
    inst.timer = 0.3;
  },
  update(w, inst, dt) {
    if (inst.projs.length) prune(inst);
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    const sx = pl.x + pl.face * 5;
    const sy = pl.y - 13;
    const S = wstats(w, inst);
    const streams = Math.min(6, 1 + Math.floor((S.amount - 1) / 2));
    const n = w.nearestEnemies(sx, sy, 190, streams, targets);
    if (n === 0) {
      inst.timer = 0.1;
      return;
    }
    // (a step can owe more than one volley at a tiny cooldown: the timer keeps the remainder)
    inst.timer += Math.max(0.05, S.cd);
    const d = inst.data;
    const blast = (S.L.blast ?? 12) * S.area * blastK(w);
    const every = Math.max(10, S.L.sneeze ?? 100);
    for (let i = 0; i < streams; i++) {
      const t = targets[i % n];
      const a = Math.atan2(t.y - t.cy - sy, t.x - sx) + (i >= n ? w.rng.spread(0.3) : w.rng.spread(0.04));
      d.cast = (d.cast ?? 0) + 1;
      if (d.cast % every === 0) {
        // the sneeze: one overdone blast of the base weapon
        const k = S.dmg / Math.max(1e-6, S.L.dmg);
        fireball(w, inst, sx, sy, a, S.speed * 0.6, (S.L.sneezeDmg ?? 156) * k, (S.L.sneezeBlast ?? 70) * S.area * blastK(w), 110, true, S.dmg);
        w.bumpStat("overdos");
        hfx(w, HOLD_SNEEZE, sx, sy);
        continue;
      }
      const p = fireball(w, inst, sx, sy, a, S.speed, S.dmg, blast, S.knock, false, S.dmg);
      p.b = 3;
      p.scale = 0.6;
      p.trail = "";
      p.onEnd = smallPop;
    }
    hfx(w, HOLD_SHOT, sx, sy, sx, sy, 0, d.cast);
  },
};

export const weapons: WeaponDef[] = [cheatFireball, cheatMeteor, holdingBack];
