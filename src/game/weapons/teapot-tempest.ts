/**
 * Teapot Tempest (Pudding's signature, docs/content/weapons.md §2.2):
 * `amount` teacups orbit at r 30 x area, `speed` rad/s, hitting on contact
 * (`dmg`, per-enemy re-hit `every` s). Every `cd` s a cup tips over and leaves
 * a tea puddle (r `puddleR` x area, `life` x duration s, at most 6, the oldest
 * dries first): while Pudding moves, the cup on her heading tips and the tea
 * lands on her path (LEAD px ahead); standing still, the cup nearest the action.
 * Enemies in a puddle take `puddleDmg` every 0.5 s and are slowed 15 %.
 * WARM TEA: brushing any puddle (her feet within its rim + BRUSH px) warms her
 * up for WARM_T s (refreshed by any puddle, never stacks): `heal` HP/s x
 * healMul for as long as it lasts, so the tea heals on the move - no standing
 * in it. The only signature weapon that heals.
 * ORBITAL GUARD (weapons/_orbital.ts): each cup eats the first enemy bullet it
 * touches, breaks, and is back its mend time later (`mend` s, scaled: _orbital.ts).
 * Evolution: Eternal Tea Party (+ Bento Box) - a flying teapot pours a
 * scalding tea moat around Pudding (ring band, slows) and, every `pour` s, a
 * puddle on her path (Warm Tea at the evolution's `heal`); six sturdier cups
 * (`block` 2) fling hot droplets at enemies outside the moat, kills inside heal
 * and drop petit fours.
 *
 * Pudding's talents read here (both forms where it makes sense): Free Refills
 * (+0.5 s puddle life and Warm Tea per rank), Extra Cups (+1 cup per rank), Tea
 * Ceremony (puddles / the moat twice as big, slow 40 %), Flying Teacup Service
 * (every 3 s a cup is thrown at the farthest enemy in view: r 24, 40 damage,
 * leaves a puddle). Pudding C6: Warm Tea heals twice as fast.
 *
 * Cups and puddles are owned projectiles (p.a = 0 cup, 1 puddle) with no
 * sprite: src/view/heroes-a-fx.ts draws them (cup tilt from p.b = tip time,
 * scale 0 = broken, puddle frames from age / life); inst.data.warm / warmMax =
 * Warm Tea seconds left / its full length (the view's steam ring). Puddles
 * tick on CH_MISC so they never share a re-hit window with the cups (slot
 * channel).
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { CFG, CH_MISC } from "../config";
import { PK_ATTACHED, PK_FALL, PK_FREE, PK_MANAGED, ROT_SPIN, SHAPE_RING, type Enemy, type ProjHitHook, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { fired, killOwned, own, prune, wstats, type WStats } from "./_shared";
import { sfxAt } from "./_fx";
import { HFX_PUD_SHATTER, HFX_PUD_SIP, HFX_PUD_SPILL, HFX_PUD_WARM, dropPudding, dropSnack, heroesA, hfx, slowEnemy } from "./_heroes-a";
import { GUARD_MAX, guardBlock, guardBody, guardOf, guardTick } from "./_orbital";

const CUP = 0;
const PUDDLE = 1;
const MOAT = 2;
const MAX_PUDDLES = 6;
const ORBIT_R = 30;
/** Flying Teacup Service puddles use Teapot Tempest's Lv5 numbers. */
const TOSS_PUDDLE = { r: 20, dmg: 12, life: 5 };
/** Warm Tea: seconds per brush (+0.5 per Free Refills rank); brush reach past a puddle's rim (px). */
export const WARM_T = 3;
const BRUSH = 4;
/** Moving spills land this far ahead of Pudding's feet (px), PATH_K of the way from the tipping cup. */
const LEAD = 30;
const PATH_K = 0.8;
/** Pudding counts as moving above this speed (px/s). */
const MOVING = 20;
/** Teacup body radius (contact hits and Orbital Guard). */
const CUP_R = 5;

/** Puddle slow (Tea Ceremony: 40 %) and size multiplier. */
function ceremony(w: World): boolean {
  return w.talentRank("pudding_tea_ceremony") > 0;
}

/** Enemies stepping in tea are slowed (p.vz = slow factor). */
const teaSlow: ProjHitHook = (p, _w, e) => {
  slowEnemy(e, p.vz, 0.6);
};

/** A tea puddle at (x, y): r, damage every 0.5 s, life (s). */
export function teaPuddle(w: World, inst: WeaponInstance | null, x: number, y: number, r: number, dmg: number, life: number): Projectile {
  const p = w.spawnProjectile(inst, inst ? inst.def.id : "teapot_tempest");
  p.kind = PK_MANAGED;
  p.ch = CH_MISC;
  p.x = x;
  p.y = y;
  p.r = r;
  p.dmg = dmg;
  p.knock = 0;
  p.pierce = Infinity;
  p.hitEvery = 0.5;
  p.life = life;
  p.a = PUDDLE;
  p.vz = ceremony(w) ? 0.6 : 0.85;
  p.onHit = teaSlow;
  if (inst) own(inst, p);
  return p;
}

/** Warm Tea length (s): WARM_T + 0.5 per Free Refills rank. */
export function warmTime(w: World): number {
  return WARM_T + 0.5 * w.talentRank("pudding_refill");
}

/**
 * WARM TEA: brushing any of this weapon's puddles sets the buff to its full length (refresh, never
 * stack); while it lasts the hero heals `hps` x healMul (Pudding C6 x2) in 1 s sips - one number per
 * second, not a stream - plus the remainder when the tea cools, so one brush heals hps x warmTime.
 */
function warmTea(w: World, inst: WeaponInstance, hps: number, dt: number): void {
  // one Warm Tea per hero: a copy of the weapon outside her slots (A Real Friend's) scalds with its puddles
  // but never heals - its puddles land on the Friend's own path, so it would double her healing
  if (!w.weapons.includes(inst)) return;
  const d = inst.data;
  const pl = w.player;
  if (inPuddle(w, inst)) {
    if (!((d.warm ?? 0) > 0)) hfx(w, HFX_PUD_WARM, pl.x, pl.y);
    d.warm = d.warmMax = warmTime(w);
  }
  const left = d.warm ?? 0;
  if (left <= 0) {
    d.sip = 0;
    return;
  }
  d.sip = (d.sip ?? 0) + Math.min(dt, left);
  d.warm = Math.max(0, left - dt);
  if (d.sip < 1 - 1e-6 && d.warm > 0) return;
  const s = Math.min(1, d.sip);
  d.sip -= s;
  // (a cooled-down sliver is not worth a number)
  if (s < 0.05 || pl.hp >= pl.maxHp) return;
  // Pudding C6: Warm Tea heals twice as fast
  const k = w.hero.id === "pudding" && w.cons >= 6 ? 2 : 1;
  // (silent: the view shows a small tea-steam "+N" instead of the full heal fanfare every second)
  const before = pl.hp;
  w.heal(hps * k * s, true);
  hfx(w, HFX_PUD_SIP, pl.x, pl.y, pl.x, pl.y, 0, Math.round(pl.hp - before));
}

/**
 * Keep `n` cups orbiting (p.a = CUP) and guard with them (Orbital Guard: `block` bullets break a cup
 * for its mend time (mendTime); a broken cup has r 0 / scale 0 and neither hits, tips nor flings).
 */
function orbitCups(w: World, inst: WeaponInstance, n: number, mine: number, R: number, spin: number, dmg: number, every: number, ch: number, block: number, mend: number, dt: number): void {
  const pl = w.player;
  const g = guardOf(inst);
  guardTick(w, g, mend, inst.def.color, dt);
  let have = 0;
  for (let i = 0; i < inst.projs.length; i++) if (inst.projs[i].a === CUP) have++;
  while (have < n) {
    const p = w.spawnProjectile(inst);
    p.kind = PK_MANAGED;
    p.a = CUP;
    p.r = CUP_R;
    p.pierce = Infinity;
    p.life = Infinity;
    p.knock = 30;
    p.pop = true;
    own(inst, p);
    have++;
  }
  let k = 0;
  const d = inst.data;
  d.rot = ((d.rot ?? 0) + spin * dt) % TAU;
  for (let i = 0; i < inst.projs.length; i++) {
    const p = inst.projs[i];
    if (p.a !== CUP) continue;
    if (k >= n) {
      p.dead = true;
      continue;
    }
    const a = d.rot + (k / n) * TAU;
    p.ang = a;
    p.x = pl.x + Math.cos(a) * R;
    p.y = pl.y - CFG.playerCy + Math.sin(a) * R * 0.8;
    p.dmg = dmg;
    p.hitEvery = every;
    p.ch = ch;
    if (p.b > 0) p.b = Math.max(0, p.b - dt);
    if (k < GUARD_MAX) guardBody(g, k, p, CUP_R, 1);
    k++;
  }
  g.n = Math.min(k, GUARD_MAX);
  g.ref = mine;
  guardBlock(w, g, block, mend, inst.def.color, pl.x, pl.y - CFG.playerCy, R);
}

/** Is Pudding on the move (her heading is pl.aimX / aimY)? */
function moving(w: World): boolean {
  const pl = w.player;
  return pl.moving && pl.vx * pl.vx + pl.vy * pl.vy > MOVING * MOVING;
}

/**
 * The cup that tips: moving, the one nearest her heading; still, the one nearest the nearest enemy
 * (else the one in front of her). A cup that is up wins; with every cup broken the tea still spills
 * from the best slot (no tipping cup to see), so a volley that breaks them never cuts off the healing.
 */
function frontCup(w: World, inst: WeaponInstance): Projectile | null {
  const pl = w.player;
  const go = moving(w);
  const e = go ? null : w.nearestEnemy(pl.x, pl.y - CFG.playerCy, 140);
  const fx = e ? e.x : pl.x + pl.aimX * 40;
  const fy = e ? e.y - e.cy : pl.y - CFG.playerCy + pl.aimY * 40;
  let best: Projectile | null = null;
  let bd = Infinity;
  for (let i = 0; i < inst.projs.length; i++) {
    const p = inst.projs[i];
    if (p.a !== CUP || p.dead) continue;
    const dx = p.x - fx;
    const dy = p.y - fy;
    // (broken cups only as a last resort)
    const d2 = dx * dx + dy * dy + (p.r <= 0 ? 1e6 : 0);
    if (d2 < bd) {
      bd = d2;
      best = p;
    }
  }
  return best;
}

/** Drop the oldest puddles beyond the cap (they dry up). */
function capPuddles(inst: WeaponInstance): void {
  let n = 0;
  for (let i = 0; i < inst.projs.length; i++) if (inst.projs[i].a === PUDDLE && !inst.projs[i].dead) n++;
  while (n > MAX_PUDDLES) {
    let old: Projectile | null = null;
    for (let i = 0; i < inst.projs.length; i++) {
      const p = inst.projs[i];
      if (p.a === PUDDLE && !p.dead && (!old || p.life - p.age < old.life - old.age)) old = p;
    }
    if (!old) break;
    // (dries in its last 0.5 s: the view shows the drying frame)
    if (old.life - old.age > 0.5) old.life = old.age + 0.5;
    old.a = 3;
    n--;
  }
}

/** Do the hero's feet brush any of this weapon's puddles (within its rim + BRUSH px; puddles are 1.6:1 ellipses)? */
function inPuddle(w: World, inst: WeaponInstance): boolean {
  const pl = w.player;
  for (let i = 0; i < inst.projs.length; i++) {
    const p = inst.projs[i];
    if ((p.a !== PUDDLE && p.a !== 3) || p.dead) continue;
    const dx = pl.x - p.x;
    const dy = (pl.y - p.y) * 1.6;
    const rr = p.r + BRUSH;
    if (dx * dx + dy * dy <= rr * rr) return true;
  }
  return false;
}

/** Where a spill lands: on Pudding's path while she moves (PATH_K of the way from (x, y) to LEAD px ahead), else (x, y). */
const spot = { x: 0, y: 0 };
function spillSpot(w: World, x: number, y: number): { x: number; y: number } {
  spot.x = x;
  spot.y = y;
  if (moving(w)) {
    const pl = w.player;
    spot.x += (pl.x + pl.aimX * LEAD - x) * PATH_K;
    spot.y += (pl.y + pl.aimY * LEAD - y) * PATH_K;
  }
  return spot;
}

// ---------------------------------------------------------------- Flying Teacup Service
/** A thrown cup lands: shatter (r 24, 40 x might) and leave a puddle. */
const tossLand: ProjHook = (p, w) => {
  const R = 24 * w.stats.area;
  const buf = w.acquire();
  const n = w.grid.query(p.x, p.y - 4, R + 16, buf);
  for (let k = 0; k < n; k++) {
    const e = w.enemies.items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - e.cy - (p.y - 4);
    const rr = R + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    w.hitEnemy(e, p.dmg, p.owner, Math.atan2(dy, dx), 90, 0, p.source, C.gold);
  }
  w.release();
  hfx(w, HFX_PUD_SHATTER, p.x, p.y, p.x, p.y, R);
  sfxAt(w, "pudding_cup_toss", "teacup", p.x, p.y);
  const big = ceremony(w) ? 2 : 1;
  const life = (TOSS_PUDDLE.life + 0.5 * w.talentRank("pudding_refill")) * w.stats.duration;
  teaPuddle(w, p.owner, p.x, p.y, TOSS_PUDDLE.r * w.stats.area * big, TOSS_PUDDLE.dmg * w.stats.might, life);
};

function farthestInView(w: World): Enemy | null {
  const pl = w.player;
  const hw = w.viewW * 0.5 - 6;
  const hh = w.viewH * 0.5 - 6;
  let best: Enemy | null = null;
  let bd = -1;
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i];
    if (e.dead || e.def.prop) continue;
    const dx = e.x - pl.x;
    const dy = e.y - pl.y;
    if (Math.abs(dx) > hw || Math.abs(dy) > hh) continue;
    const d2 = dx * dx + dy * dy;
    if (d2 > bd) {
      bd = d2;
      best = e;
    }
  }
  return best;
}

function cupToss(w: World, inst: WeaponInstance, dt: number): void {
  if (w.talentRank("pudding_cup_toss") <= 0) return;
  const d = inst.data;
  d.toss = (d.toss ?? 1) - dt;
  if (d.toss > 0) return;
  const t = farthestInView(w);
  if (!t) {
    d.toss = 0.3;
    return;
  }
  d.toss = 3;
  const pl = w.player;
  const T = 0.6;
  const p = w.spawnProjectile(inst);
  p.kind = PK_FALL;
  p.x = pl.x;
  p.y = pl.y;
  p.vx = (t.x - pl.x) / T;
  p.vy = (t.y - pl.y) / T;
  // a lob from body height that lands at T: z(t) = z0 + vz t - g t^2 / 2 (tossArc applies g)
  p.z = 14;
  p.vz = (TOSS_G * T * T * 0.5 - 14) / T;
  p.r = 0;
  p.life = T + 0.5;
  p.dmg = 40 * w.stats.might * (inst.dmgMul ?? 1);
  p.sprite = "w_teacup";
  p.rotMode = ROT_SPIN;
  p.spin = 14;
  p.shadow = 6;
  p.update = tossArc;
  p.onEnd = tossLand;
  fired(w, inst, pl.x, pl.y);
}

/** Lob gravity for the thrown cup (PK_FALL only integrates z by vz). */
const TOSS_G = 400;
const tossArc: ProjHook = (p, _w, dt) => {
  p.vz -= TOSS_G * dt;
};

// ---------------------------------------------------------------- Teapot Tempest
export const teapotTempest: WeaponDef = {
  id: "teapot_tempest",
  name: "Teapot Tempest",
  icon: "icon_teapot_tempest",
  color: C.gold,
  sfx: "teacup",
  desc: "Teacups orbit you, block enemy shots and spill tea on your path. Brush a puddle: Warm Tea heals you on the move.",
  levels: [
    { dmg: 8, cd: 2.5, amount: 2, speed: 3.0, every: 0.5, puddleR: 14, puddleDmg: 6, life: 4, heal: 1.5, knock: 30, block: 1, mend: 2.5 },
    { dmg: 8, cd: 2.5, amount: 3, speed: 3.0, every: 0.5, puddleR: 14, puddleDmg: 6, life: 4, heal: 1.5, knock: 30, block: 1, mend: 2.5 },
    { dmg: 11, cd: 2.5, amount: 3, speed: 3.0, every: 0.5, puddleR: 16, puddleDmg: 8, life: 4, heal: 2, knock: 30, block: 1, mend: 2.5 },
    { dmg: 11, cd: 2.0, amount: 4, speed: 3.2, every: 0.5, puddleR: 16, puddleDmg: 8, life: 4, heal: 2, knock: 30, block: 1, mend: 2.5 },
    { dmg: 14, cd: 2.0, amount: 4, speed: 3.2, every: 0.45, puddleR: 20, puddleDmg: 12, life: 5, heal: 3, knock: 30, block: 1, mend: 2.2 },
  ],
  upgrades: ["+1 teacup", "Damage +3, hotter, wider puddles, warmer tea", "+1 teacup, spills more often", "Damage +3, bigger, longer puddles, much warmer tea"],
  evolutions: [{ into: "eternal_tea_party", with: "bento_box" }],
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { amount: 1, dmg: 0.15, text: "LIMIT BREAK — Guest Cup: +1 teacup, +15% damage" },
    { area: 0.2, cd: 0.85, text: "MASTERED — Bottomless Pot: +20% puddle size, spills 15% faster" },
  ],
  update(w, inst, dt) {
    prune(inst);
    const S = wstats(w, inst);
    const L = S.L;
    const extra = w.talentRank("pudding_extra_cups");
    const n = Math.min(10, S.amount + extra);
    // (own cups: level / Limit Break + Extra Cups; the Amount stat's extra share the guard, weapons/_orbital.ts)
    orbitCups(w, inst, n, S.amount - w.stats.amount + extra, ORBIT_R * S.area, S.L.speed ?? 3, S.dmg, L.every ?? 0.5, inst.slot, L.block ?? 1, L.mend ?? 2.5, dt);
    inst.timer -= dt;
    if (inst.timer <= 0) {
      inst.timer = S.cd;
      spill(w, inst, S);
    }
    capPuddles(inst);
    warmTea(w, inst, L.heal ?? 1.5, dt);
    cupToss(w, inst, dt);
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

function spill(w: World, inst: WeaponInstance, S: WStats): void {
  const c = frontCup(w, inst);
  if (!c) return;
  c.b = 0.35;
  const L = S.L;
  const big = ceremony(w) ? 2 : 1;
  const life = ((L.life ?? 4) + 0.5 * w.talentRank("pudding_refill")) * w.stats.duration;
  const dk = S.dmg / Math.max(1e-6, L.dmg);
  // (moving: the tea lands on her path, a step ahead - she brushes it without breaking stride)
  const at = spillSpot(w, c.x, c.y + CFG.playerCy * 0.75);
  teaPuddle(w, inst, at.x, at.y, (L.puddleR ?? 14) * S.area * big, (L.puddleDmg ?? 4) * dk, life);
  hfx(w, HFX_PUD_SPILL, at.x, at.y - 4, c.x, c.y);
  fired(w, inst, c.x, c.y);
}

// ---------------------------------------------------------------- Eternal Tea Party
const MOAT_EVERY = 0.4;

/** Tea droplet flung by a cup. */
function teaDrop(w: World, inst: WeaponInstance, x: number, y: number, t: Enemy, dmg: number): void {
  const a = Math.atan2(t.y - t.cy - y, t.x - x);
  const sp = 170 * w.stats.projSpeed;
  const p = w.spawnProjectile(inst);
  p.kind = PK_FREE;
  p.x = x;
  p.y = y;
  p.speed = sp;
  p.vx = Math.cos(a) * sp;
  p.vy = Math.sin(a) * sp;
  p.homing = 5;
  p.target = t;
  p.targetUid = t.uid;
  p.r = 3;
  p.dmg = dmg;
  p.knock = 30;
  p.pierce = 1;
  p.life = 1.1;
  p.sprite = "w_tea_drop";
  p.rotMode = ROT_SPIN;
  p.spin = 10;
  p.trail = "tea";
}

const near: Enemy[] = [];
const moatHooked = new WeakSet<World>();

/** Kills inside the moat: 1 HP per `killHeal` kills, `petit` chance of a petit four (one listener per world). */
function moatKills(w: World): void {
  if (moatHooked.has(w)) return;
  moatHooked.add(w);
  const st = heroesA(w);
  st.onKill.push((e, x, y) => {
    const inst = w.hasWeapon("eternal_tea_party");
    if (!inst || e.def.prop) return;
    const pl = w.player;
    const L = inst.def.levels[0];
    const R = (L.moatR ?? 44) * w.stats.area + (L.moatW ?? 10);
    const dx = x - pl.x;
    const dy = y - e.cy - (pl.y - CFG.playerCy);
    if (dx * dx + dy * dy > R * R) return;
    const d = inst.data;
    d.mk = (d.mk ?? 0) + 1;
    if (d.mk >= (L.killHeal ?? 8)) {
      d.mk = 0;
      if (pl.hp < pl.maxHp) w.heal(1, true);
    }
    if (w.rng.next() < (L.petit ?? 0.02) * w.stats.luck) dropSnack(w, "w_petit_four", x, y, 5);
  });
}

export const eternalTeaParty: WeaponDef = {
  id: "eternal_tea_party",
  name: "Eternal Tea Party",
  icon: "icon_eternal_tea_party",
  color: C.gold,
  sfx: "teacup",
  evolved: true,
  desc: "EVOLUTION! A flying teapot pours a scalding tea moat around you and warm tea on your path; six sturdy cups fling hot droplets and block shots.",
  levels: [
    {
      dmg: 16, cd: 1.2, amount: 6, speed: 3.4, every: 0.4, moatR: 44, moatW: 10, moatDmg: 10, slow: 0.7, dropDmg: 12, killHeal: 8, petit: 0.02, knock: 30,
      pour: 2, puddleR: 20, puddleDmg: 8, life: 4, heal: 3.5, block: 2, mend: 1.5,
    },
  ],
  upgrades: [],
  init(w) {
    moatKills(w);
  },
  update(w, inst, dt) {
    prune(inst);
    const S = wstats(w, inst);
    const L = S.L;
    const dk = S.dmg / Math.max(1e-6, L.dmg);
    const extra = w.talentRank("pudding_extra_cups");
    const n = Math.min(10, S.amount + extra);
    // cups on CH_MISC: the moat owns the slot channel
    orbitCups(w, inst, n, S.amount - w.stats.amount + extra, ORBIT_R * Math.sqrt(S.area), L.speed ?? 3.4, S.dmg, L.every ?? 0.4, CH_MISC, L.block ?? 2, L.mend ?? 1.5, dt);
    // the moat (one attached ring band, re-made if lost)
    let moat: Projectile | null = null;
    for (let i = 0; i < inst.projs.length; i++) if (inst.projs[i].a === MOAT) moat = inst.projs[i];
    if (!moat) {
      moat = w.spawnProjectile(inst);
      moat.kind = PK_ATTACHED;
      moat.a = MOAT;
      moat.shape = SHAPE_RING;
      moat.ox = 0;
      moat.oy = -CFG.playerCy;
      moat.pierce = Infinity;
      moat.life = Infinity;
      moat.hitEvery = MOAT_EVERY;
      moat.knock = 12;
      moat.onHit = teaSlow;
      own(inst, moat);
    }
    const big = ceremony(w) ? 2 : 1;
    moat.r = (L.moatR ?? 44) * S.area + ((L.moatW ?? 10) * (big - 1)) / 2;
    moat.hw = (L.moatW ?? 10) * big;
    moat.dmg = (L.moatDmg ?? 10) * dk;
    moat.vz = big > 1 ? Math.min(0.6, L.slow ?? 0.7) : (L.slow ?? 0.7);
    // every cd s each cup flings a droplet at the nearest enemy outside the moat
    inst.timer -= dt;
    if (inst.timer <= 0) {
      inst.timer = S.cd;
      const pl = w.player;
      const cy = pl.y - CFG.playerCy;
      const out = moat.r + 2;
      const m = w.nearestEnemies(pl.x, cy, 190, 24, near);
      let j = 0;
      for (let i = 0; i < inst.projs.length; i++) {
        const c = inst.projs[i];
        if (c.a !== CUP || c.dead || c.r <= 0) continue;
        // the k-th cup takes the k-th nearest target outside the moat
        let t: Enemy | null = null;
        while (j < m) {
          const e = near[j++];
          const dx = e.x - pl.x;
          const dy = e.y - e.cy - cy;
          if (dx * dx + dy * dy > out * out) {
            t = e;
            break;
          }
        }
        if (!t) break;
        c.b = 0.25;
        teaDrop(w, inst, c.x, c.y, t, (L.dropDmg ?? 12) * dk);
      }
      fired(w, inst, pl.x, pl.y);
    }
    // the teapot pours warm tea on her path every `pour` s (at her feet while she stands still)
    const d = inst.data;
    d.pour = (d.pour ?? 0.5) - dt;
    if (d.pour <= 0) {
      d.pour = (L.pour ?? 2) * w.stats.cooldown;
      const pl = w.player;
      const at = spillSpot(w, pl.x, pl.y);
      const life = ((L.life ?? 4) + 0.5 * w.talentRank("pudding_refill")) * w.stats.duration;
      teaPuddle(w, inst, at.x, at.y, (L.puddleR ?? 20) * S.area * big, (L.puddleDmg ?? 8) * dk, life);
      hfx(w, HFX_PUD_SPILL, at.x, at.y - 4, pl.x, pl.y - 34);
    }
    capPuddles(inst);
    // (path pours and Flying Teacup Service puddles both warm her up)
    warmTea(w, inst, L.heal ?? 3.5, dt);
    cupToss(w, inst, dt);
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

/** Pudding C6 (with the puddle double heal read in sip()): every 100 kills a pudding drops (heals 8). */
export function puddingC6(w: World): void {
  let n = 0;
  heroesA(w).onKill.push((_e, x, y) => {
    if (++n < 100) return;
    n = 0;
    dropPudding(w, x, y);
  });
}

export const weapons: WeaponDef[] = [teapotTempest, eternalTeaParty];
