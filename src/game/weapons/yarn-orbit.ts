/**
 * Yarn Orbit (Mochi): yarn balls circle the player (3 s on / 1.5 s off),
 * each enemy can be bonked every 0.4 s.
 * Evolution: Cosmic Yarn (+ Magnet Star) - 6 permanent planets that also pull gems.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_MANAGED, ROT_SPIN, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { fired, killOwned, own, prune, wstats, type WStats } from "./_shared";

function spawnBall(w: World, inst: WeaponInstance, S: WStats, life: number, sprite: string, size: number, hitEvery: number): Projectile {
  const p = w.spawnProjectile(inst);
  p.kind = PK_MANAGED;
  p.x = w.player.x;
  p.y = w.player.y - 8;
  p.r = size * S.area;
  p.dmg = S.dmg;
  p.knock = S.knock;
  p.pierce = Infinity;
  p.hitEvery = hitEvery;
  p.life = life;
  p.sprite = sprite;
  p.rotMode = ROT_SPIN;
  p.spin = 7;
  p.scale = S.area;
  p.pop = true;
  p.shadow = 6;
  own(inst, p);
  return p;
}

function placeRing(w: World, inst: WeaponInstance, radius: number, ang: number, tilt: number): void {
  const n = inst.projs.length;
  const pl = w.player;
  for (let i = 0; i < n; i++) {
    const p = inst.projs[i];
    const a = ang + (i / n) * TAU;
    p.x = pl.x + Math.cos(a) * radius;
    p.y = pl.y - 8 + Math.sin(a) * radius * tilt;
    p.z = 8;
  }
}

export const yarnOrbit: WeaponDef = {
  id: "yarn_orbit",
  name: "Yarn Orbit",
  icon: "icon_yarn_orbit",
  color: C.pink,
  hitSfx: "orbitHit",
  desc: "Yarn balls orbit you, bonking anything they touch.",
  levels: [
    { dmg: 10, cd: 1.3, amount: 3, area: 1, duration: 3, speed: 3.4, knock: 45 },
    { dmg: 10, cd: 1.3, amount: 4, area: 1, duration: 3, speed: 3.4, knock: 45 },
    { dmg: 13, cd: 1.3, amount: 4, area: 1.15, duration: 3, speed: 3.4, knock: 50 },
    { dmg: 13, cd: 1.2, amount: 5, area: 1.15, duration: 3.5, speed: 3.6, knock: 50 },
    { dmg: 16, cd: 1.1, amount: 5, area: 1.2, duration: 3.5, speed: 4.2, knock: 55 },
  ],
  upgrades: ["+1 yarn ball", "Damage +3, area +15%", "+1 yarn ball, lasts longer", "Damage +3, spins faster"],
  evolution: { into: "cosmic_yarn", with: "magnet_star" },
  init(_w, inst) {
    inst.data.off = 0.2;
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    const live = prune(inst);
    d.ang = ((d.ang ?? 0) + (S.L.speed ?? 3.2) * w.stats.projSpeed * dt) % TAU;
    if (live > 0) {
      placeRing(w, inst, 28 * S.area, d.ang, 0.85);
      return;
    }
    d.off = (d.off ?? 0) - dt;
    if (d.off > 0) return;
    d.off = S.cd;
    const n = Math.min(10, S.amount);
    for (let i = 0; i < n; i++) spawnBall(w, inst, S, S.duration, "w_yarn", 5, 0.4);
    placeRing(w, inst, 28 * S.area, d.ang, 0.85);
    fired(w, inst, w.player.x, w.player.y);
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

export const cosmicYarn: WeaponDef = {
  id: "cosmic_yarn",
  name: "Cosmic Yarn",
  icon: "icon_cosmic_yarn",
  color: C.violet,
  hitSfx: "orbitHit",
  evolved: true,
  desc: "EVOLUTION! 6 permanent orbiting planets that also pull in gems.",
  levels: [{ dmg: 15, cd: 0, amount: 6, area: 1, speed: 2.6, knock: 65 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    const want = Math.min(12, S.amount);
    let live = prune(inst);
    if (live !== want) {
      killOwned(inst);
      for (let i = 0; i < want; i++) spawnBall(w, inst, S, Infinity, "w_planet", 7, 0.35);
      live = want;
      fired(w, inst, w.player.x, w.player.y);
    }
    for (const p of inst.projs) {
      p.dmg = S.dmg;
      p.r = 7 * S.area;
      p.scale = S.area;
    }
    d.ang = ((d.ang ?? 0) + (S.L.speed ?? 2.6) * w.stats.projSpeed * dt) % TAU;
    const R = 40 * S.area;
    placeRing(w, inst, R, d.ang, 0.8);
    // gravity: gems touching a planet get pulled to the player
    const gr = 16 * S.area;
    const gr2 = gr * gr;
    for (let g = 0; g < w.gems.count; g++) {
      const gem = w.gems.items[g];
      if (gem.state !== 0 || gem.dead) continue;
      for (let i = 0; i < live; i++) {
        const p = inst.projs[i];
        const dx = gem.x - p.x;
        const dy = gem.y - p.y;
        if (dx * dx + dy * dy < gr2) {
          gem.state = 1;
          gem.speed = 80;
          break;
        }
      }
    }
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

export const weapons: WeaponDef[] = [yarnOrbit, cosmicYarn];
