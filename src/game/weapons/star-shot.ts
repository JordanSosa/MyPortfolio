/**
 * Star Shot (Hoshi): bursts of homing stars at the nearest enemies.
 * Evolution: Galaxy Barrage (+ Wish Charm) - a rotating spiral stream of homing stars.
 * Second evolution: Critical Constellation (+ Lucky Clover) - a volley of heavy, slow comet stars (no homing,
 *   pierce 4) at the highest-HP enemies in view every `cd` s; the first hit of each always crits, and a crit
 *   that kills splits into two half-damage mini stars. The burst / elite route: long gaps, scales with crit.
 *
 * Hoshi's talents (talents/hoshi.ts) read here, for both forms: Fan Chant
 * rank 3 = +1 pierce, Backup Dancers = +1 star (spiral arm) per rank.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_FREE, ROT_SPIN, ROT_VELOCITY, type Enemy, type ProjHitHook, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { heroFx } from "./_fx";
import { fired, wstats, type WStats } from "./_shared";

const targets: Enemy[] = [];
const CONSTELLATION = "critical_constellation";

/** The Star Shot (or Galaxy Barrage) instance, for damage attribution of talent / constellation stars. */
export function starInst(w: World): WeaponInstance | null {
  return w.hasWeapon("star_shot") ?? w.hasWeapon("galaxy_barrage") ?? w.hasWeapon(CONSTELLATION) ?? null;
}

/** A small homing star from (x, y) toward angle a (Hoshi's talent / constellation shots, `source` = their id). */
export function miniStar(w: World, owner: WeaponInstance | null, source: string, x: number, y: number, a: number, dmg: number, tgt: Enemy | null, scale = 0.7): Projectile {
  const sp = 170 * w.stats.projSpeed;
  const p = w.spawnProjectile(owner, source);
  p.kind = PK_FREE;
  p.x = x;
  p.y = y;
  p.speed = sp;
  p.vx = Math.cos(a) * sp;
  p.vy = Math.sin(a) * sp;
  p.homing = 7;
  p.target = tgt;
  p.targetUid = tgt ? tgt.uid : 0;
  p.r = 4;
  p.dmg = dmg;
  p.pierce = 1;
  p.knock = 18;
  p.life = 1.1;
  p.sprite = "w_star";
  p.scale = scale;
  p.rotMode = ROT_SPIN;
  p.spin = 12;
  p.glow = true;
  p.trail = "star";
  return p;
}

function fireStar(w: World, inst: WeaponInstance, S: WStats, index: number): void {
  const pl = w.player;
  const sx = pl.x + pl.face * 4;
  const sy = pl.y - 13;
  const n = w.nearestEnemies(sx, sy, 190, Math.max(1, S.amount), targets);
  let a: number;
  let target: Enemy | null = null;
  if (n > 0) {
    target = targets[index % n];
    a = Math.atan2(target.y - target.cy - sy, target.x - sx) + w.rng.spread(0.35);
  } else a = Math.atan2(pl.aimY, pl.aimX) + w.rng.spread(0.6);
  const p = w.spawnProjectile(inst);
  p.kind = PK_FREE;
  p.x = sx;
  p.y = sy;
  p.speed = S.speed;
  p.vx = Math.cos(a) * S.speed;
  p.vy = Math.sin(a) * S.speed;
  p.homing = 7.5;
  p.target = target;
  p.targetUid = target ? target.uid : 0;
  p.r = 5;
  p.dmg = S.dmg;
  p.pierce = S.pierce + (w.talentRank("hoshi_fan_chant") >= 3 ? 1 : 0);
  p.knock = S.knock;
  p.life = 1.7;
  p.sprite = "w_star";
  p.rotMode = ROT_SPIN;
  p.spin = (index & 1 ? -1 : 1) * 11;
  p.glow = true;
  p.trail = "star";
}

export const starShot: WeaponDef = {
  id: "star_shot",
  name: "Star Shot",
  icon: "icon_star_shot",
  color: C.yellow,
  sfx: "starShot",
  desc: "Fires homing stars at the nearest enemies.",
  levels: [
    { dmg: 10, cd: 0.85, amount: 2, speed: 160, pierce: 2, knock: 26 },
    { dmg: 10, cd: 0.85, amount: 3, speed: 160, pierce: 2, knock: 26 },
    { dmg: 14, cd: 0.75, amount: 3, speed: 175, pierce: 3, knock: 28 },
    { dmg: 14, cd: 0.75, amount: 4, speed: 175, pierce: 3, knock: 28 },
    { dmg: 18, cd: 0.65, amount: 5, speed: 190, pierce: 4, knock: 32 },
  ],
  upgrades: ["+1 star", "Damage +4, cooldown -12%, pierces 1 more", "+1 star", "Damage +4, +1 star, pierces 1 more"],
  evolutions: [
    { into: "galaxy_barrage", with: "wish_charm" },
    { into: "critical_constellation", with: "lucky_clover" },
  ],
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { dmg: 0.15, amount: 1, text: "LIMIT BREAK — Idol Stamina: +1 star, +15% damage" },
    { dmg: 0.25, amount: 1, cd: 0.9, text: "MASTERED — Sold-Out Show: +1 star, +25% damage, −10% cooldown" },
  ],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    if ((d.queue ?? 0) > 0) {
      d.qt = (d.qt ?? 0) - dt;
      while (d.qt <= 0 && d.queue > 0) {
        fireStar(w, inst, S, d.shot ?? 0);
        d.shot = (d.shot ?? 0) + 1;
        d.queue--;
        d.qt += 0.075;
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    if (!w.nearestEnemy(pl.x, pl.y - 8, 175)) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
    d.queue = S.amount + w.talentRank("hoshi_backup_dancers");
    d.qt = 0;
    d.shot = 0;
    fired(w, inst, pl.x, pl.y);
  },
};

/** Galaxy stars fly out along the spiral, then start homing. */
const galaxyStar: ProjHook = (p) => {
  if (p.homing === 0 && p.age > 0.16) p.homing = 6.5;
};

export const galaxyBarrage: WeaponDef = {
  id: "galaxy_barrage",
  name: "Galaxy Barrage",
  icon: "icon_galaxy_barrage",
  color: C.pink,
  sfx: "starShot",
  evolved: true,
  desc: "EVOLUTION! A rotating spiral stream of homing galaxy stars.",
  levels: [{ dmg: 14, cd: 0.1, amount: 3, speed: 180, pierce: 3, knock: 30 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    d.spin = ((d.spin ?? 0) + 2.7 * dt) % TAU;
    inst.timer -= dt;
    const pl = w.player;
    const dancers = w.talentRank("hoshi_backup_dancers");
    const arms = Math.min(6 + dancers, S.amount + dancers);
    const pierce = S.pierce + (w.talentRank("hoshi_fan_chant") >= 3 ? 1 : 0);
    while (inst.timer <= 0) {
      inst.timer += Math.max(0.06, S.cd);
      d.n = (d.n ?? 0) + 1;
      for (let k = 0; k < arms; k++) {
        const a = d.spin + (k / arms) * TAU;
        const p = w.spawnProjectile(inst);
        p.kind = PK_FREE;
        p.x = pl.x + Math.cos(a) * 6;
        p.y = pl.y - 12 + Math.sin(a) * 6;
        p.speed = S.speed;
        p.vx = Math.cos(a) * S.speed;
        p.vy = Math.sin(a) * S.speed;
        p.homing = 0;
        p.update = galaxyStar;
        p.r = 6;
        p.dmg = S.dmg;
        p.pierce = pierce;
        p.knock = S.knock;
        p.life = 1.5;
        p.sprite = "w_star_evo";
        p.rotMode = ROT_SPIN;
        p.spin = 12;
        p.glow = true;
        p.trail = "galaxy";
      }
      if (d.n % 3 === 0) fired(w, inst, pl.x, pl.y);
    }
  },
};

// ---------------------------------------------------------------- Critical Constellation

/** View cue (heroFx): a crit of the constellation at (x2, y2), linked from the previous one at (x, y); n = 1 on a kill. */
export const FX_STAR_LINK = "e2a_link";
/** Crits closer together than this (s) are stars of one constellation (the view joins them with a line). */
const LINK_GAP = 0.7;

interface StarChart {
  x: number;
  y: number;
  /** World time of the last crit (-1 = none yet). */
  at: number;
  /** Mini stars split this second (budget). */
  sec: number;
  left: number;
}
const charts = new WeakMap<World, StarChart>();

/** One listener per world: every crit of the weapon is a star of the constellation; a crit kill splits. */
function chartOf(w: World): StarChart {
  let c = charts.get(w);
  if (c) return c;
  const ch: StarChart = { x: 0, y: 0, at: -1, sec: -1, left: 0 };
  c = ch;
  charts.set(w, ch);
  w.hooks.on("hit", (h) => {
    if (!h.crit || h.source !== CONSTELLATION) return;
    const e = h.enemy;
    const x = e.x;
    const y = e.y - e.cy;
    const dead = e.hp <= 0 && !e.def.boss;
    const linked = ch.at >= 0 && w.t - ch.at < LINK_GAP;
    heroFx(w, FX_STAR_LINK, linked ? ch.x : x, linked ? ch.y : y, x, y, 0, dead ? 1 : 0);
    ch.x = x;
    ch.y = y;
    ch.at = w.t;
    const inst = h.owner;
    if (!dead || !inst) return;
    if (w.t - ch.sec >= 1) {
      ch.sec = w.t;
      ch.left = 14;
    }
    if (ch.left <= 0) return;
    ch.left--;
    const L = inst.def.levels[0];
    const dmg = L.dmg * (L.mini ?? 0.5) * w.stats.might * (inst.dmgMul ?? 1);
    const a0 = w.rng.angle();
    for (let k = 0; k < 2; k++) miniStar(w, inst, CONSTELLATION, x, y, a0 + k * Math.PI, dmg, null, 0.75);
  });
  return ch;
}

const top: Enemy[] = [];

/** The `max` highest-HP enemies in view (props excluded) into `top`, highest first. */
function highestInView(w: World, max: number): number {
  const p = w.player;
  const hw = w.viewW * 0.5 - 4;
  const hh = w.viewH * 0.5 - 4;
  const items = w.enemies.items;
  let n = 0;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i];
    if (e.dead || e.def.prop || e.untargetable || Math.abs(e.x - p.x) > hw || Math.abs(e.y - e.cy - (p.y - 8)) > hh) continue;
    let k: number;
    if (n < max) k = n++;
    else if (e.hp > top[max - 1].hp) k = max - 1;
    else continue;
    while (k > 0 && top[k - 1].hp < e.hp) {
      top[k] = top[k - 1];
      k--;
    }
    top[k] = e;
  }
  return n;
}

/** The comet's first hit always crits (`crit` 1); what it pierces afterwards rolls like any hit. */
const cometHit: ProjHitHook = (p) => {
  p.crit = 0;
};

function fireComet(w: World, inst: WeaponInstance, S: WStats, index: number, n: number): void {
  const pl = w.player;
  const sx = pl.x + pl.face * 4;
  const sy = pl.y - 13;
  let a: number;
  if (n > 0) {
    // the brightest star: with a boss in view, every fourth comet (the 1st, the 5th ...) is aimed at it
    const t = top[0].def.boss && index % 4 === 0 ? top[0] : top[index % n];
    // (lead a little: the comet is slow and does not home)
    const d = Math.hypot(t.x - sx, t.y - t.cy - sy);
    const lead = Math.min(0.5, d / Math.max(1, S.speed)) * 0.6;
    a = Math.atan2(t.y - t.cy + t.vy * t.slow * lead - sy, t.x + t.vx * t.slow * lead - sx);
    // a second comet at the same target fans out a touch
    if (index >= n) a += (index & 1 ? 1 : -1) * 0.07 * Math.ceil((index - n + 1) / 2);
    else if (index > 0 && t === top[0] && n > 1) a += (index % 8 === 0 ? -1 : 1) * 0.05;
  } else a = Math.atan2(pl.aimY, pl.aimX) + (index - 2) * 0.3;
  const p = w.spawnProjectile(inst);
  p.kind = PK_FREE;
  p.x = sx;
  p.y = sy;
  p.speed = S.speed;
  p.vx = Math.cos(a) * S.speed;
  p.vy = Math.sin(a) * S.speed;
  p.r = 8;
  p.dmg = S.dmg;
  p.crit = 1;
  p.pierce = S.pierce + (w.talentRank("hoshi_fan_chant") >= 3 ? 1 : 0);
  p.knock = S.knock;
  p.life = 2.4;
  p.sprite = "w_comet_star";
  p.rotMode = ROT_VELOCITY;
  p.rot = a;
  p.glow = true;
  p.trail = "comet";
  p.onHit = cometHit;
}

export const criticalConstellation: WeaponDef = {
  id: CONSTELLATION,
  name: "Critical Constellation",
  icon: "icon_critical_constellation",
  color: C.paleYellow,
  sfx: "starShot",
  evolved: true,
  desc: "EVOLUTION! Five heavy comet stars. Every critical hit draws the next star of the constellation.",
  levels: [{ dmg: 88, cd: 1.6, amount: 5, speed: 150, pierce: 4, knock: 60, mini: 0.5 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    chartOf(w);
    if ((d.queue ?? 0) > 0) {
      d.qt = (d.qt ?? 0) - dt;
      while (d.qt <= 0 && d.queue > 0) {
        const want = Math.min(10, S.amount + w.talentRank("hoshi_backup_dancers"));
        fireComet(w, inst, S, d.shot ?? 0, highestInView(w, want));
        top.length = 0;
        d.shot = (d.shot ?? 0) + 1;
        d.queue--;
        d.qt += 0.07;
        if (d.shot > 1 && d.shot % 2 === 1) fired(w, inst, w.player.x, w.player.y);
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const seen = highestInView(w, 1);
    top.length = 0;
    if (seen === 0) {
      inst.timer = 0.15;
      return;
    }
    inst.timer = S.cd;
    d.queue = Math.min(10, S.amount + w.talentRank("hoshi_backup_dancers"));
    d.qt = 0;
    d.shot = 0;
    fired(w, inst, w.player.x, w.player.y);
  },
};

export const weapons: WeaponDef[] = [starShot, galaxyBarrage, criticalConstellation];
