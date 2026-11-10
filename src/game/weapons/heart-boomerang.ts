/**
 * Heart Boomerang: spinning hearts thrown at the nearest enemies. Each one
 * curls out ~90 px along a boomerang arc, slows, turns around and homes back
 * to the player, piercing everything on both legs (every enemy can be hit
 * once on the way out and once on the way back).
 * Evolution: Love Tornado (+ Twin Charm) - waves of winged hearts spiral out
 * from the player and back in a rotating tornado, several waves at once.
 * Second evolution: Unrequited Heart (+ Heart Locket) - one big heart locks onto the highest-HP enemy near
 *   the hero and shuttles hero <-> target for ever: each pass hits harder (`ramp` per pass, half kept when the
 *   target dies), what stands in the way takes `through` of it, every catch heals a little. The single-target
 *   route: an elite / boss killer that is poor against a ring of small enemies.
 *
 * Visuals: sprite + "heart" / "loveTornado" trails (src/view/weapon-fx.ts
 * registers them) and the tornado swirl drawn around the player there too.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_FREE, PK_MANAGED, ROT_FIXED, ROT_SPIN, type Enemy, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { own, prune, killOwned, wstats, type WStats } from "./_shared";
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
  evolutions: [
    { into: "love_tornado", with: "twin_charm" },
    { into: "unrequited_heart", with: "heart_locket" },
  ],
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

// ---------------------------------------------------------------- Unrequited Heart

const U_DOCK = 0;
const U_OUT = 1;
const U_BACK = 2;
/** Shortest leg (s): a target right next to her is not hit faster than this. */
const U_LEG = 0.2;

/** The highest-HP enemy within `r` of the hero that no other heart of the weapon is on (else the highest). */
function crush(w: World, inst: WeaponInstance, self: Projectile, r: number): Enemy | null {
  const pl = w.player;
  const buf = w.acquire();
  const n = w.grid.query(pl.x, pl.y - 8, r, buf);
  const items = w.enemies.items;
  let best: Enemy | null = null;
  let free: Enemy | null = null;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead || e.def.prop || e.untargetable) continue;
    if (!best || e.hp > best.hp) best = e;
    if (free && e.hp <= free.hp) continue;
    let taken = false;
    for (const q of inst.projs) if (q !== self && q.target === e && q.targetUid === e.uid) taken = true;
    if (!taken) free = e;
  }
  w.release();
  return free ?? best;
}

/**
 * The heart (managed). Scratch: a = leg (dock / out / back), b = consecutive passes on the target (the ramp),
 * speed = this leg's speed, vx = 1 once this trip's pass landed (a managed projectile's velocity is free scratch),
 * target / targetUid = who it will not leave alone (homing stays 0: the hook flies it).
 */
const unrequited: ProjHook = (p, w, dt) => {
  const inst = p.owner;
  if (!inst) return;
  const S = wstats(w, inst);
  const L = S.L;
  const pl = w.player;
  const hx = pl.x + pl.face * 3;
  const hy = pl.y - 11;
  const range = L.range ?? 140;
  // (S is shared scratch: a hit's hooks may resolve another weapon's stats)
  const speed = S.speed;
  let t = p.target;
  const lost = !t || t.dead || t.uid !== p.targetUid;
  if (lost || (p.a !== U_OUT && Math.hypot((t as Enemy).x - pl.x, (t as Enemy).y - pl.y) > range * 1.35)) {
    // gone (or left behind): the next one inherits half of the grudge
    if (t) p.b = Math.floor(p.b * 0.5);
    t = p.target = null;
    if (p.a === U_OUT || p.a === U_DOCK) {
      t = p.target = crush(w, inst, p, range);
      p.targetUid = t ? t.uid : 0;
      if (!t && p.a === U_OUT) p.a = U_BACK;
    }
  }
  p.dmg = S.dmg * (L.through ?? 0.5);
  p.r = 9 * S.area;
  p.scale = Math.min(S.area, 1 + (S.area - 1) * 0.6);
  if (p.a === U_DOCK) {
    // nobody to bother: it waits at her shoulder
    const k = 1 - Math.exp(-10 * dt);
    p.x += (pl.x - pl.face * 9 - p.x) * k;
    p.y += (pl.y - 20 + Math.sin(p.age * 3) * 1.5 - p.y) * k;
    p.r = 0;
    p.alpha = 0.85;
    if (!t) return;
    p.a = U_OUT;
    p.x = hx;
    p.y = hy;
    launch(p, t, speed);
  }
  const tx = p.a === U_OUT && t ? t.x : hx;
  const ty = p.a === U_OUT && t ? t.y - t.cy : hy;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const step = p.speed * dt;
  p.rot = Math.sin(p.age * 13) * 0.25;
  // fade into her hands (as the boomerang: it never sits on top of her)
  const hd = Math.hypot(p.x - hx, p.y - hy);
  p.alpha = Math.min(1, Math.max(0.25, (hd - 6) / 20));
  if (p.a === U_OUT && t) {
    if (d > t.r + 3 + step) {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      return;
    }
    // the pass: the full hit, harder every time
    p.x = tx;
    p.y = ty;
    const ramp = Math.min(L.rampMax ?? 1.2, (L.ramp ?? 0.08) * p.b);
    p.b++;
    p.vx = 1;
    w.hitEnemy(t, S.dmg * (1 + ramp), inst, Math.atan2(dy, dx), S.knock, 0, inst.def.id, inst.def.color);
    p.a = U_BACK;
    p.speed = Math.max(40, Math.min(speed, Math.hypot(hx - p.x, hy - p.y) / U_LEG));
    newLeg(p, t);
    return;
  }
  if (d > 8 + step) {
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    return;
  }
  // caught: a little comfort (only a heart that actually reached its target), then straight back out
  wfx(w, WFX_CATCH, p.x, p.y);
  if (p.vx > 0) {
    p.vx = 0;
    const cap = L.healCap ?? 2;
    const each = L.heal ?? 0.5;
    const dd = inst.data;
    // (a bucket of `cap` HP per second shared by the weapon's hearts)
    dd.pool = Math.min(cap, (dd.pool ?? cap) + (w.t - (dd.at ?? w.t)) * cap);
    dd.at = w.t;
    if (dd.pool >= each && pl.hp < pl.maxHp) {
      dd.pool -= each;
      w.heal(each, true);
    }
  }
  // (the whoosh on every other throw: it comes back more than twice a second)
  if (p.b & 1) fireSfx(w, inst, pl.x, pl.y);
  if (!t) t = p.target = crush(w, inst, p, range);
  p.targetUid = t ? t.uid : 0;
  if (!t) {
    p.a = U_DOCK;
    return;
  }
  p.a = U_OUT;
  p.x = hx;
  p.y = hy;
  launch(p, t, speed);
};

/** A new leg: everything in the way can be hit again, the target itself only by the pass. */
function newLeg(p: Projectile, t: Enemy | null): void {
  p.nHits = 0;
  if (t) {
    p.hits[0] = t.uid;
    p.nHits = 1;
  }
}

function launch(p: Projectile, t: Enemy, speed: number): void {
  p.speed = Math.max(40, Math.min(speed, Math.hypot(t.x - p.x, t.y - t.cy - p.y) / U_LEG));
  newLeg(p, t);
}

export const unrequitedHeart: WeaponDef = {
  id: "unrequited_heart",
  name: "Unrequited Heart",
  icon: "icon_unrequited_heart",
  color: C.hotPink,
  sfx: "boomerang",
  evolved: true,
  desc: "EVOLUTION! One big heart picks one enemy and keeps coming back. It will not take the hint.",
  levels: [{ dmg: 58, cd: 0, amount: 1, area: 1, speed: 320, knock: 14, range: 140, ramp: 0.08, rampMax: 1.2, through: 0.6, heal: 0.5, healCap: 2 }],
  upgrades: [],
  update(w, inst) {
    const S = wstats(w, inst);
    // 1 heart, 2 with +2 Amount, 3 with +4
    const want = Math.min(3, 1 + Math.floor((S.amount - 1) / 2));
    let live = prune(inst);
    for (; live < want; live++) {
      const p = w.spawnProjectile(inst);
      p.kind = PK_MANAGED;
      p.a = U_DOCK;
      p.b = 0;
      p.vx = 0;
      p.x = w.player.x;
      p.y = w.player.y - 20;
      p.r = 0;
      p.knock = 0;
      p.pierce = Infinity;
      p.hitEvery = 0;
      p.life = Infinity;
      p.sprite = "w_heart_big";
      p.scale = Math.min(S.area, 1 + (S.area - 1) * 0.6);
      p.rotMode = ROT_FIXED;
      p.shadow = 7;
      p.trail = "heartBig";
      p.update = unrequited;
      own(inst, p);
    }
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

export const weapons: WeaponDef[] = [heartBoomerang, loveTornado, unrequitedHeart];
