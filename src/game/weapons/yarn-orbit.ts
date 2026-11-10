/**
 * Yarn Orbit (Mochi): yarn balls circle the player (3 s on / 1.3 s off),
 * each enemy can be bonked every 0.4 s (0.34 s from Lv3, 0.28 s at Lv5).
 * Evolution: Cosmic Yarn (+ Magnet Star) - 6 permanent planets (bonk every 0.26 s) that also pull gems.
 * Second evolution: Meowteor Hammer (+ Power Bow) - 4 permanent spiked yarn balls on a ring that swings
 *   in and out (`rIn`..`rOut`, one swing per `cd` s) and SLAMS at the top of every swing (a blast per ball).
 *   The aggressive route: far more ground covered and burst, but no gem pull, and its balls guard like the
 *   base weapon's (`block` 1) while spending half the swing away from her.
 *
 * ORBITAL GUARD (weapons/_orbital.ts): every ball / planet eats the enemy bullets it touches. A
 * ball breaks on its first (`block` 1) and is back its mend time later (`mend` s, scaled: _orbital.ts); a planet soaks
 * `block` 3 and mends faster; a Meowteor ball breaks on its first, like a yarn ball (a broken one does not slam). Boss beams / slams / telegraphed blasts are not bullets: never blocked.
 *
 * Mochi's Infinite Yarn talent (+2 balls, never off) and C6 (never off, pulls
 * gems like Cosmic Yarn) read here.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_MANAGED, ROT_SPIN, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { GUARD_MAX, guardBlock, guardBody, guardOf, guardTick, type OrbitalGuard } from "./_orbital";
import { fired, killOwned, own, prune, wstats, type WStats } from "./_shared";

/** Orbital Guard defaults (the level tables carry `block` / `mend`). */
const MEND = 2.5;

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

/** Gems touching an orbiting ball get pulled to the player (Cosmic Yarn gravity; a broken one doesn't). */
function pullGems(w: World, inst: WeaponInstance, live: number, r: number): void {
  const gr2 = r * r;
  for (let g = 0; g < w.gems.count; g++) {
    const gem = w.gems.items[g];
    if (gem.state !== 0 || gem.dead) continue;
    for (let i = 0; i < live; i++) {
      const p = inst.projs[i];
      if (p.r <= 0) continue;
      const dx = gem.x - p.x;
      const dy = gem.y - p.y;
      if (dx * dx + dy * dy < gr2) {
        gem.state = 1;
        gem.speed = 80;
        break;
      }
    }
  }
}

/** Orbital Guard over the placed ring: hide broken bodies, block the bullets touching the rest. */
function guardRing(w: World, inst: WeaponInstance, g: OrbitalGuard, S: WStats, R: number, size: number): void {
  const n = Math.min(GUARD_MAX, inst.projs.length);
  for (let k = 0; k < n; k++) guardBody(g, k, inst.projs[k], size * S.area, S.area);
  g.n = n;
  // (the weapon's own balls: its level / Limit Break count + Infinite Yarn's 2; the Amount stat's extra share the guard)
  g.ref = S.amount - w.stats.amount + (w.talentRank("mochi_infinite_yarn") > 0 ? 2 : 0);
  const pl = w.player;
  guardBlock(w, g, S.L.block ?? 1, S.L.mend ?? MEND, inst.def.color, pl.x, pl.y - 8, R);
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
  desc: "Yarn balls orbit you, bonking enemies and blocking their shots.",
  levels: [
    // (weapon bench pass, docs/content/weapons.md section 9: dmg was 10 / 10 / 14 / 14 / 20, now 16 / 16 / 23 / 25 / 37; area - the ball size, so the guard - and the 3 s on / 1.3 s off cycle are unchanged)
    { dmg: 16, cd: 1.3, amount: 3, area: 1, duration: 3, speed: 3.4, knock: 45, every: 0.4, block: 1, mend: 2.5 },
    { dmg: 16, cd: 1.3, amount: 4, area: 1, duration: 3, speed: 3.4, knock: 45, every: 0.4, block: 1, mend: 2.5 },
    { dmg: 23, cd: 1.3, amount: 4, area: 1.15, duration: 3, speed: 3.4, knock: 50, every: 0.34, block: 1, mend: 2.5 },
    { dmg: 25, cd: 1.2, amount: 5, area: 1.2, duration: 3.5, speed: 3.6, knock: 50, every: 0.34, block: 1, mend: 2.5 },
    { dmg: 37, cd: 1.1, amount: 5, area: 1.3, duration: 3.5, speed: 4.2, knock: 55, every: 0.28, block: 1, mend: 2.2 },
  ],
  upgrades: ["+1 yarn ball", "Damage +7, area +15%, bonks faster", "+1 yarn ball, damage +2, bigger, lasts longer", "Damage +12, area +10%, spins and bonks faster"],
  evolutions: [
    { into: "cosmic_yarn", with: "magnet_star" },
    { into: "meowteor_hammer", with: "power_bow" },
  ],
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { amount: 1, dmg: 0.15, text: "LIMIT BREAK — Spare Yarn: +1 ball, +15% damage" },
    { area: 0.2, dmg: 0.2, text: "MASTERED — Big Ball Energy: +20% area, +20% damage" },
  ],
  init(_w, inst) {
    inst.data.off = 0.2;
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    const g = guardOf(inst);
    guardTick(w, g, S.L.mend ?? MEND, inst.def.color, dt);
    let live = prune(inst);
    d.ang = ((d.ang ?? 0) + (S.L.speed ?? 3.2) * w.stats.projSpeed * dt) % TAU;
    // Infinite Yarn (talent: +2 balls) / C6: the balls never turn off (C6 also pulls gems)
    const infinite = w.talentRank("mochi_infinite_yarn") > 0;
    const c6 = w.cons >= 6 && w.hero.id === "mochi";
    if (infinite || c6) {
      const want = Math.min(12, S.amount + (infinite ? 2 : 0));
      if (live !== want || (live > 0 && inst.projs[0].life !== Infinity)) {
        killOwned(inst);
        for (let i = 0; i < want; i++) spawnBall(w, inst, S, Infinity, "w_yarn", 5, S.L.every ?? 0.4);
        live = want;
        fired(w, inst, w.player.x, w.player.y);
      }
      for (const p of inst.projs) {
        p.dmg = S.dmg;
        p.r = 5 * S.area;
        p.scale = S.area;
        p.hitEvery = S.L.every ?? 0.4;
      }
      placeRing(w, inst, 28 * S.area, d.ang, 0.85);
      guardRing(w, inst, g, S, 28 * S.area, 5);
      if (c6) pullGems(w, inst, live, 14 * S.area);
      return;
    }
    if (live > 0) {
      placeRing(w, inst, 28 * S.area, d.ang, 0.85);
      guardRing(w, inst, g, S, 28 * S.area, 5);
      return;
    }
    // (off phase: no bodies; broken slots keep mending and the next balls spawn hidden until they reform)
    g.n = 0;
    d.off = (d.off ?? 0) - dt;
    if (d.off > 0) return;
    d.off = S.cd;
    const n = Math.min(10, S.amount);
    for (let i = 0; i < n; i++) spawnBall(w, inst, S, S.duration, "w_yarn", 5, S.L.every ?? 0.4);
    placeRing(w, inst, 28 * S.area, d.ang, 0.85);
    guardRing(w, inst, g, S, 28 * S.area, 5);
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
  desc: "EVOLUTION! 6 permanent planets orbit you: they pull in gems and soak up enemy shots.",
  levels: [{ dmg: 38, cd: 0, amount: 6, area: 1.15, speed: 2.6, knock: 65, every: 0.26, block: 3, mend: 1.5 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    const g = guardOf(inst);
    guardTick(w, g, S.L.mend ?? 1.5, inst.def.color, dt);
    const want = Math.min(12, S.amount);
    let live = prune(inst);
    if (live !== want) {
      killOwned(inst);
      for (let i = 0; i < want; i++) spawnBall(w, inst, S, Infinity, "w_planet", 7, S.L.every ?? 0.35);
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
    guardRing(w, inst, g, S, R, 7);
    // gravity: gems touching a planet get pulled to the player
    pullGems(w, inst, live, 16 * S.area);
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

/** Meowteor Hammer: how far out the ring is (0 = `rIn`, 1 = `rOut`) at swing phase `ph` (0..1, the slam at 0.5). */
export function meowteorSwing(ph: number): number {
  return 0.5 - 0.5 * Math.cos(ph * TAU);
}

export const meowteorHammer: WeaponDef = {
  id: "meowteor_hammer",
  name: "Meowteor Hammer",
  icon: "icon_meowteor_hammer",
  color: C.orange,
  hitSfx: "orbitHit",
  evolved: true,
  desc: "EVOLUTION! 4 spiked yarn wrecking balls swing far out and SLAM on every swing. Blocking is somebody else's arc.",
  levels: [{ dmg: 28, cd: 2.6, amount: 4, area: 1.15, speed: 4.4, knock: 90, every: 0.3, block: 1, mend: 2.2, rIn: 26, rOut: 74, slam: 26, slamDmg: 90 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    const g = guardOf(inst);
    guardTick(w, g, S.L.mend ?? 2.2, inst.def.color, dt);
    const want = Math.min(10, S.amount);
    if (prune(inst) !== want) {
      killOwned(inst);
      for (let i = 0; i < want; i++) spawnBall(w, inst, S, Infinity, "w_meowteor", 8, S.L.every ?? 0.3);
      fired(w, inst, w.player.x, w.player.y);
    }
    for (const p of inst.projs) {
      p.dmg = S.dmg;
      p.knock = S.knock;
      p.hitEvery = S.L.every ?? 0.3;
    }
    d.ang = ((d.ang ?? 0) + (S.L.speed ?? 4.4) * w.stats.projSpeed * dt) % TAU;
    // the swing: in -> out -> in once per `cd` s (the cooldown stat swings it faster); the slam at the far point
    const before = d.ph ?? 0;
    const ph = before + dt / Math.max(0.6, S.cd);
    d.ph = ph % 1;
    const rIn = (S.L.rIn ?? 26) * S.area;
    const R = rIn + ((S.L.rOut ?? 74) * S.area - rIn) * meowteorSwing(d.ph);
    placeRing(w, inst, R, d.ang, 0.85);
    guardRing(w, inst, g, S, R, 8);
    if (before < 0.5 && ph >= 0.5) {
      const r = (S.L.slam ?? 26) * S.area;
      const dmg = (S.L.slamDmg ?? 70) * (S.dmg / Math.max(1e-6, S.L.dmg));
      // (a broken ball is not there to slam)
      for (const p of inst.projs) if (p.r > 0) w.explode(p.x, p.y, r, dmg, inst, S.knock * 1.6, inst.def.id, inst.def.color);
    }
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

export const weapons: WeaponDef[] = [yarnOrbit, cosmicYarn, meowteorHammer];
