/**
 * Heart Boomerang: spinning hearts thrown at the nearest enemies. Each one
 * curls out ~90 px along a boomerang arc, slows, turns around and homes back
 * to the player, piercing everything on both legs (every enemy can be hit
 * once on the way out and once on the way back).
 * Evolution: Love Tornado (+ Twin Charm) - waves of winged hearts spiral out
 * from the player and back in a rotating tornado, several waves at once.
 *
 * Visuals: sprite + "heart" / "loveTornado" trails (src/view/weapon-fx.ts
 * registers them) and the tornado swirl drawn around the player there too.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_FREE, PK_MANAGED, ROT_FIXED, ROT_SPIN, type Enemy, type ProjHook, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { wstats, type WStats } from "./_shared";
import { WFX_CATCH, fireSfx, wfx } from "./_fx";

const targets: Enemy[] = [];

/**
 * Boomerang flight. Scratch: a = leg (0 out, 1 back), b = deceleration (px/s^2),
 * ang = curl (rad/s, sign = side), angV = max return speed.
 */
const boomerang: ProjHook = (p, w, dt) => {
  if (p.a === 0) {
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const ns = sp - p.b * dt;
    // curl the path sideways so the heart flies a real boomerang loop
    const c = Math.cos(p.ang * dt);
    const s = Math.sin(p.ang * dt);
    const vx = p.vx * c - p.vy * s;
    p.vy = p.vx * s + p.vy * c;
    p.vx = vx;
    if (ns <= 14) {
      // turn around: a fresh leg (everything can be hit again), no knock-back toward the hero
      p.a = 1;
      p.nHits = 0;
      p.speed = 14;
      p.knock = 0;
      p.spin *= 1.35;
    } else {
      const k = ns / (sp || 1);
      p.vx *= k;
      p.vy *= k;
    }
    return;
  }
  const pl = w.player;
  const dx = pl.x - p.x;
  const dy = pl.y - 9 - p.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  p.speed = Math.min(p.angV, p.speed + p.b * 1.5 * dt);
  // fade into the hero's hands so returning hearts never pile up on top of her
  p.alpha = Math.min(1, Math.max(0.2, (d - 6) / 22));
  if (d < 9 + p.speed * dt) {
    wfx(w, WFX_CATCH, p.x, p.y);
    p.dead = true;
    return;
  }
  const k = 1 - Math.exp(-9 * dt);
  p.vx += ((dx / d) * p.speed - p.vx) * k;
  p.vy += ((dy / d) * p.speed - p.vy) * k;
};

function throwHeart(w: World, inst: WeaponInstance, S: WStats, index: number): void {
  const pl = w.player;
  const sx = pl.x + pl.face * 3;
  const sy = pl.y - 11;
  const n = w.nearestEnemies(sx, sy, 170, Math.max(1, S.amount), targets);
  let a: number;
  if (n > 0) {
    const t = targets[index % n];
    a = Math.atan2(t.y - t.cy - sy, t.x - sx);
    // repeated throws at the same target fan out a little
    if (index >= n) a += (index & 1 ? 1 : -1) * 0.35 * Math.ceil((index - n + 1) / 2);
  } else a = Math.atan2(pl.aimY, pl.aimX) + (index - (S.amount - 1) / 2) * 0.5;
  const range = (S.L.range ?? 90) * Math.sqrt(w.stats.projSpeed);
  const v0 = S.speed;
  const side = index & 1 ? -1 : 1;
  const p = w.spawnProjectile(inst);
  p.kind = PK_FREE;
  p.x = sx;
  p.y = sy;
  // aim slightly against the curl so the loop passes through the target
  const curl = 1.5 * side;
  const a0 = a - curl * 0.32;
  p.vx = Math.cos(a0) * v0;
  p.vy = Math.sin(a0) * v0;
  p.speed = v0;
  p.a = 0;
  p.b = (v0 * v0) / (2 * range);
  p.ang = curl;
  p.angV = v0 * 1.25;
  p.r = 6 * S.area;
  p.dmg = S.dmg;
  p.knock = S.knock;
  p.pierce = Infinity;
  p.hitEvery = 0;
  p.life = 4;
  p.sprite = "w_heart";
  // Area grows the hit circle fully; the sprite grows a bit less so big builds stay readable
  p.scale = Math.min(S.area, 1 + (S.area - 1) * 0.6);
  p.rotMode = ROT_SPIN;
  p.spin = 15 * side;
  p.trail = "heart";
  p.shadow = 6;
  p.update = boomerang;
}

export const heartBoomerang: WeaponDef = {
  id: "heart_boomerang",
  name: "Heart Boomerang",
  icon: "icon_heart_boomerang",
  color: C.red,
  sfx: "boomerang",
  desc: "Spinning hearts curl out at enemies and fly back to you, piercing everything twice.",
  levels: [
    { dmg: 12, cd: 1.4, amount: 1, speed: 215, area: 1, range: 90, knock: 40 },
    { dmg: 12, cd: 1.4, amount: 2, speed: 215, area: 1, range: 90, knock: 40 },
    { dmg: 17, cd: 1.4, amount: 2, speed: 230, area: 1.15, range: 105, knock: 45 },
    { dmg: 17, cd: 1.2, amount: 3, speed: 230, area: 1.15, range: 105, knock: 45 },
    { dmg: 24, cd: 1.1, amount: 3, speed: 245, area: 1.3, range: 120, knock: 55 },
  ],
  upgrades: ["+1 heart", "Damage +5, bigger hearts fly farther", "+1 heart, cooldown -14%", "Damage +7, bigger hearts, cooldown -8%"],
  evolution: { into: "love_tornado", with: "twin_charm" },
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { amount: 1, dmg: 0.1, text: "LIMIT BREAK — Second Date: +1 heart, +10% damage" },
    { dmg: 0.25, area: 0.15, text: "MASTERED — True Love: +25% damage, +15% area" },
  ],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    if ((d.queue ?? 0) > 0) {
      d.qt = (d.qt ?? 0) - dt;
      while (d.qt <= 0 && d.queue > 0) {
        throwHeart(w, inst, S, d.shot ?? 0);
        d.shot = (d.shot ?? 0) + 1;
        d.queue--;
        d.qt += 0.1;
        if (d.shot > 1) fireSfx(w, inst, w.player.x, w.player.y);
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    if (!w.nearestEnemy(pl.x, pl.y - 8, 165)) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
    d.queue = Math.min(10, S.amount);
    d.qt = 0;
    d.shot = 0;
    fireSfx(w, inst, pl.x, pl.y);
  },
};

// ---------------------------------------------------------------- Love Tornado

/**
 * Tornado heart (managed): spirals out to angV px and back over its life while
 * circling the player. Scratch: a = start angle, b = leg flag, ang = angular speed.
 */
const tornadoHeart: ProjHook = (p, w) => {
  const k = Math.min(1, p.age / p.life);
  const pl = w.player;
  const rad = 6 + p.angV * Math.sin(Math.PI * k);
  const a = p.a + p.ang * p.age;
  p.x = pl.x + Math.cos(a) * rad;
  p.y = pl.y - 9 + Math.sin(a) * rad * 0.88;
  p.rot = Math.sin(p.age * 11 + p.a) * 0.35;
  // coming back in: a new leg, so the whole crowd gets hit again
  if (p.b === 0 && k >= 0.5) {
    p.b = 1;
    p.nHits = 0;
  }
};

export const loveTornado: WeaponDef = {
  id: "love_tornado",
  name: "Love Tornado",
  icon: "icon_love_tornado",
  color: C.pink,
  sfx: "boomerang",
  evolved: true,
  desc: "EVOLUTION! Waves of winged hearts spiral out in a rotating love tornado.",
  levels: [{ dmg: 13, cd: 0.8, amount: 6, area: 1.15, range: 104, duration: 1.8, speed: 4.4, knock: 60 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    d.spin = ((d.spin ?? 0) + 1.7 * dt) % TAU;
    inst.timer -= dt;
    if (inst.timer > 0) return;
    inst.timer = Math.max(0.3, S.cd);
    const n = Math.min(12, S.amount);
    const life = S.duration;
    const R = (S.L.range ?? 104) * S.area;
    const om = (S.L.speed ?? 4.4) * w.stats.projSpeed;
    d.wave = (d.wave ?? 0) + 1;
    // alternate the spin direction every wave so the arms criss-cross into a vortex
    const dir = d.wave & 1 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const p = w.spawnProjectile(inst);
      p.kind = PK_MANAGED;
      p.a = d.spin + (i / n) * TAU;
      p.b = 0;
      p.ang = om * dir;
      p.angV = R;
      p.life = life;
      p.x = w.player.x;
      p.y = w.player.y - 9;
      p.r = 7 * S.area;
      p.dmg = S.dmg;
      p.knock = S.knock;
      p.pierce = Infinity;
      p.hitEvery = 0;
      p.sprite = "w_heart_evo";
      p.scale = Math.min(S.area, 1 + (S.area - 1) * 0.6);
      p.rotMode = ROT_FIXED;
      p.pop = true;
      p.trail = "loveTornado";
      p.update = tornadoHeart;
    }
    fireSfx(w, inst, w.player.x, w.player.y);
  },
};

export const weapons: WeaponDef[] = [heartBoomerang, loveTornado];
