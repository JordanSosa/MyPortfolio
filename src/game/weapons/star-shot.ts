/**
 * Star Shot (Hoshi): bursts of homing stars at the nearest enemies.
 * Evolution: Galaxy Barrage (+ Wish Charm) - a rotating spiral stream of homing stars.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_FREE, ROT_SPIN, type Enemy, type ProjHook, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { fired, wstats, type WStats } from "./_shared";

const targets: Enemy[] = [];

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
  p.r = 5;
  p.dmg = S.dmg;
  p.pierce = S.pierce;
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
    { dmg: 10, cd: 0.9, amount: 1, speed: 160, pierce: 1, knock: 26 },
    { dmg: 10, cd: 0.9, amount: 2, speed: 160, pierce: 1, knock: 26 },
    { dmg: 14, cd: 0.8, amount: 2, speed: 175, pierce: 1, knock: 28 },
    { dmg: 14, cd: 0.8, amount: 3, speed: 175, pierce: 1, knock: 28 },
    { dmg: 18, cd: 0.72, amount: 3, speed: 190, pierce: 2, knock: 32 },
  ],
  upgrades: ["+1 star", "Damage +4, cooldown -11%", "+1 star", "Damage +4, pierces 1 more enemy"],
  evolution: { into: "galaxy_barrage", with: "wish_charm" },
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
    d.queue = S.amount;
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
  levels: [{ dmg: 15, cd: 0.12, amount: 2, speed: 175, pierce: 2, knock: 30 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    d.spin = ((d.spin ?? 0) + 2.7 * dt) % TAU;
    inst.timer -= dt;
    const pl = w.player;
    const arms = Math.min(6, S.amount);
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
        p.pierce = S.pierce;
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

export const weapons: WeaponDef[] = [starShot, galaxyBarrage];
