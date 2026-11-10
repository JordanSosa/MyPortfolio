/**
 * Bubble Aura: a shimmering bubble field around the hero. Every enemy inside
 * is slowed (bosses are immune to the slow) and takes a damage tick on its
 * own per-enemy cooldown (so hits ripple through the crowd instead of
 * flashing in lock-step). Cooldown makes it tick faster, Area grows it,
 * Duration makes the slow linger.
 * Evolution: Ocean Dome (+ Heart Locket) - a huge caustic dome: heals 1 HP per
 * 10 kills and periodically bursts outward (knock-back blast + flying bubbles).
 * Second evolution: Soap Opera (+ Inner Monologue) - the aura shrinks to a small field and she leaves a
 *   trail of soap bubbles while she moves (one per `every` px, `max` alive, `life` s): the first enemy to
 *   touch one is lifted and held inside it (`hold` s, elites half; a boss is only slowed), ticked for `dmg`
 *   and popped for `pop` when the hold ends. No heal: the kiting route.
 *
 * No projectiles for the field itself: the view reads `inst.data.r` (current
 * radius) and `inst.data.burst` (seconds since the last burst) and draws the
 * field in src/view/weapon-fx.ts.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_FREE, ROT_SPIN, type Enemy, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { killOwned, own, prune, wstats, type WStats } from "./_shared";
import { WFX_DOME_BURST, WFX_DOME_HEAL, alive, fireSfx, heroFx, wfx } from "./_fx";

/** Ticks + slow for everything inside radius R around the hero's body. */
function field(w: World, inst: WeaponInstance, S: WStats, R: number): void {
  const pl = w.player;
  const cx = pl.x;
  const cy = pl.y - 8;
  const tick = Math.max(0.18, S.cd);
  const slowK = S.L.slow ?? 0.7;
  const slowT = 0.3 * S.duration;
  const ch = inst.slot;
  const now = w.t;
  const id = inst.def.id;
  const color = inst.def.color;
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 12, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy - cy;
    const rr = R + e.r * 0.5;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (!e.def.prop && !e.def.boss) {
      e.slow = e.slowT > 0 ? Math.min(e.slow, slowK) : slowK;
      e.slowT = Math.max(e.slowT, slowT);
    }
    if (now - e.lastHit[ch] < tick) continue;
    e.lastHit[ch] = now;
    w.hitEnemy(e, S.dmg, inst, Math.atan2(dy, dx), S.knock, 0, id, color);
  }
  w.release();
}

/** Visual radius eases toward the real one (level-ups grow the field smoothly). */
function easeRadius(inst: WeaponInstance, R: number, dt: number): void {
  const d = inst.data;
  d.r = d.r ? d.r + (R - d.r) * (1 - Math.exp(-6 * dt)) : R * 0.4;
}

export const bubbleAura: WeaponDef = {
  id: "bubble_aura",
  name: "Bubble Aura",
  icon: "icon_bubble_aura",
  color: C.cyan,
  hitSfx: "bubblePop",
  desc: "A bubble field around you that slows enemies and pops them over time.",
  levels: [
    { dmg: 5, cd: 0.5, amount: 1, area: 1, radius: 30, slow: 0.7, knock: 10 },
    { dmg: 7, cd: 0.5, amount: 1, area: 1.1, radius: 30, slow: 0.7, knock: 10 },
    // (weapon bench pass, docs/content/weapons.md section 9: Lv3-5 dmg was 9 / 11 / 14)
    { dmg: 11, cd: 0.45, amount: 1, area: 1.1, radius: 30, slow: 0.7, knock: 12 },
    { dmg: 15, cd: 0.45, amount: 1, area: 1.25, radius: 30, slow: 0.65, knock: 12 },
    { dmg: 21, cd: 0.4, amount: 1, area: 1.4, radius: 30, slow: 0.62, knock: 14 },
  ],
  upgrades: ["Damage +2, area +10%", "Damage +4, ticks 10% faster", "Damage +4, area +15%, stronger slow", "Damage +6, area +15%, ticks faster"],
  evolutions: [
    { into: "ocean_dome", with: "heart_locket" },
    { into: "soap_opera", with: "inner_monologue" },
  ],
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { area: 0.15, dmg: 0.2, text: "LIMIT BREAK — Extra Foam: +15% area, +20% damage" },
    { dmg: 0.3, cd: 0.9, text: "MASTERED — Bath Time: +30% damage, ticks 10% faster" },
  ],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const R = (S.L.radius ?? 30) * S.area;
    easeRadius(inst, R, dt);
    field(w, inst, S, inst.data.r);
  },
};

// ---------------------------------------------------------------- Ocean Dome

/** Burst bubble: rises a little as it flies and wobbles. */
function burstBubbles(w: World, inst: WeaponInstance, S: WStats, R: number): void {
  const pl = w.player;
  const n = Math.min(18, S.amount);
  const a0 = w.rng.angle();
  const dmg = (S.L.burstDmg ?? 40) * w.stats.might * 0.6;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const p = w.spawnProjectile(inst);
    p.kind = PK_FREE;
    p.x = pl.x + Math.cos(a) * R * 0.5;
    p.y = pl.y - 8 + Math.sin(a) * R * 0.5;
    const sp = (120 + w.rng.next() * 40) * w.stats.projSpeed;
    p.speed = sp;
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp;
    p.r = 6 * S.area;
    p.dmg = dmg;
    p.knock = 90;
    p.pierce = 4;
    p.life = 0.75;
    p.sprite = "w_bubble";
    p.fps = 3;
    p.scale = 1.7 * S.area;
    p.rotMode = ROT_SPIN;
    p.spin = w.rng.spread(3);
    p.pop = true;
    p.trail = "bubble";
  }
}

/** Knock-back blast for everything inside the dome. */
function burstBlast(w: World, inst: WeaponInstance, S: WStats, R: number): void {
  const pl = w.player;
  const cx = pl.x;
  const cy = pl.y - 8;
  const dmg = (S.L.burstDmg ?? 40) * w.stats.might;
  const knock = S.L.burstKnock ?? 190;
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 12, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy - cy;
    const rr = R + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    w.hitEnemy(e, dmg, inst, Math.atan2(dy, dx), knock, 0, inst.def.id, C.aqua);
  }
  w.release();
}

export const oceanDome: WeaponDef = {
  id: "ocean_dome",
  name: "Ocean Dome",
  icon: "icon_ocean_dome",
  color: C.aqua,
  hitSfx: "bubblePop",
  sfx: "bubblePop",
  evolved: true,
  desc: "EVOLUTION! A huge healing ocean dome that bursts outward in tidal waves.",
  levels: [{ dmg: 21, cd: 0.35, amount: 10, area: 1, radius: 64, slow: 0.55, burst: 2.6, burstDmg: 42, burstKnock: 200, knock: 16 }],
  upgrades: [],
  init(_w, inst) {
    inst.data.burst = 0;
    inst.data.k0 = inst.kills;
    inst.data.bt = 1.2;
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    const R = (S.L.radius ?? 64) * S.area;
    easeRadius(inst, R, dt);
    field(w, inst, S, d.r);
    d.burst = (d.burst ?? 0) + dt;
    d.bt = (d.bt ?? 0) - dt;
    if (d.bt <= 0) {
      d.bt = (S.L.burst ?? 2.6) * Math.max(0.5, w.stats.cooldown);
      d.burst = 0;
      burstBlast(w, inst, S, d.r);
      burstBubbles(w, inst, S, d.r);
      const pl = w.player;
      wfx(w, WFX_DOME_BURST, pl.x, pl.y - 8, pl.x, pl.y, d.r);
      fireSfx(w, inst, pl.x, pl.y);
    }
    // 1 HP per 10 kills made by the dome (everything it kills dies inside it)
    const k = inst.kills - (d.k0 ?? inst.kills);
    if (k >= 10) {
      const heals = Math.floor(k / 10);
      d.k0 = (d.k0 ?? 0) + heals * 10;
      const p = w.player;
      if (p.hp < p.maxHp) {
        w.heal(heals, true);
        wfx(w, WFX_DOME_HEAL, p.x, p.y, p.x, p.y, 0, heals);
      }
    }
  },
};

// ---------------------------------------------------------------- Soap Opera (second evolution)

/** heroFx cues (src/view/evo2/b.ts): a soap bubble closed around an enemy / popped at (x, y); r = its radius. */
export const SOAP_TRAP = "e2_soap_trap";
export const SOAP_POP = "e2_soap_pop";
/** Bubble states (Projectile.a): drifting on her trail / holding an enemy. */
export const SOAP_FREE = 0;
export const SOAP_HELD = 1;
/** How high a held enemy floats (px, Enemy.z). */
const SOAP_LIFT = 5;
/** A boss is never held: the bubble pops on it and slows it to this for the hold time. */
const SOAP_BOSS_SLOW = 0.7;

/** Pop a bubble (the held enemy, if any, drops and takes the pop). */
function soapPop(p: Projectile, w: World, e: Enemy | null): void {
  if (e) e.z = 0;
  // the pop splashes everybody around it (the one inside included); a bubble nobody was in just bursts
  const R = e ? p.speed : 0;
  if (R > 0) {
    const buf = w.acquire();
    const n = w.grid.query(p.x, p.y, R + 14, buf);
    const items = w.enemies.items;
    for (let k = 0; k < n; k++) {
      const o = items[buf[k]];
      if (!o || o.dead) continue;
      const dx = o.x - p.x;
      const dy = o.y - o.cy - p.y;
      const rr = R + o.r;
      if (o !== e && dx * dx + dy * dy > rr * rr) continue;
      w.hitEnemy(o, p.vz, p.owner, Math.atan2(dy, dx), p.knock, 0, p.source, C.aqua);
    }
    w.release();
  }
  heroFx(w, SOAP_POP, p.x, p.y, p.x, p.y, Math.max(R, p.hw * p.scale));
  w.endProjectile(p);
}

/**
 * A soap bubble. Scratch: a = state, hw = touch radius, vz = pop damage, speed = pop radius, ox = hold seconds, oy = tick
 * seconds, b = hold end (World.t), angV = next tick (World.t); target / targetUid = the held enemy.
 */
const soapHook: ProjHook = (p, w) => {
  if (p.a === SOAP_HELD) {
    const e = p.target;
    if (!alive(e, p.targetUid)) {
      soapPop(p, w, null);
      return;
    }
    // held: no behaviour, no movement of its own (Enemy.stun), floating in the bubble
    e.stun = Math.max(e.stun, 0.1);
    e.z = SOAP_LIFT;
    p.x = e.x;
    p.y = e.y - e.cy - SOAP_LIFT;
    if (w.t >= p.angV) {
      p.angV = w.t + p.oy;
      if (w.hitEnemy(e, p.dmg, p.owner, -Math.PI / 2, 0, 0, p.source, C.aqua)) {
        soapPop(p, w, null);
        return;
      }
    }
    if (w.t >= p.b) soapPop(p, w, e);
    return;
  }
  // free: the first enemy that touches it (one that is already held or dazed is left alone)
  let hit: Enemy | null = null;
  const buf = w.acquire();
  const n = w.grid.query(p.x, p.y, p.hw + 14, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead || e.def.prop || e.stun > 0 || e.inv > 0) continue;
    const dx = e.x - p.x;
    const dy = e.y - e.cy - p.y;
    const rr = p.hw + e.r * 0.6;
    if (dx * dx + dy * dy > rr * rr) continue;
    hit = e;
    break;
  }
  w.release();
  if (!hit) return;
  if (hit.def.boss) {
    hit.slow = hit.slowT > 0 ? Math.min(hit.slow, SOAP_BOSS_SLOW) : SOAP_BOSS_SLOW;
    hit.slowT = Math.max(hit.slowT, p.ox);
    soapPop(p, w, hit);
    return;
  }
  p.a = SOAP_HELD;
  p.target = hit;
  p.targetUid = hit.uid;
  p.b = w.t + p.ox * (hit.elite ? 0.5 : 1);
  p.angV = w.t + p.oy;
  p.life = Infinity;
  p.scale = Math.max(1, (hit.r + 4) / 7);
  heroFx(w, SOAP_TRAP, hit.x, hit.y - hit.cy, hit.x, hit.y, p.hw * p.scale);
};

function dropSoap(w: World, inst: WeaponInstance, S: WStats, x: number, y: number): void {
  const L = S.L;
  const p = w.spawnProjectile(inst);
  p.kind = PK_FREE;
  // (a little off her line: a trail of bubbles, not a string of beads)
  p.x = x + w.rng.spread(3);
  p.y = y + w.rng.spread(3);
  p.a = SOAP_FREE;
  // (no generic hit circle: the hook decides who is caught)
  p.r = 0;
  p.hw = (L.br ?? 8) * Math.sqrt(S.area);
  p.dmg = S.dmg;
  p.vz = ((L.pop ?? 40) * S.dmg) / Math.max(1e-6, L.dmg);
  p.knock = S.knock;
  p.speed = (L.popR ?? 26) * S.area;
  p.ox = (L.hold ?? 1.6) * S.duration;
  p.oy = Math.max(0.18, S.cd);
  p.pierce = Infinity;
  p.life = (L.life ?? 3.5) * S.duration;
  p.sprite = "w_soap_bubble";
  p.fps = 4;
  p.scale = Math.sqrt(S.area);
  p.pop = true;
  p.update = soapHook;
  own(inst, p);
}

/** Let go of everything the bubbles hold (the weapon is replaced / the run ends). */
function soapDispose(inst: WeaponInstance): void {
  for (let i = 0; i < inst.projs.length; i++) {
    const p = inst.projs[i];
    if (p.uid === inst.uids[i] && p.a === SOAP_HELD && alive(p.target, p.targetUid)) p.target.z = 0;
  }
  killOwned(inst);
}

export const soapOpera: WeaponDef = {
  id: "soap_opera",
  name: "Soap Opera",
  icon: "icon_soap_opera",
  color: C.aqua,
  hitSfx: "bubblePop",
  evolved: true,
  desc: "EVOLUTION! You leave a trail of soap bubbles. Each one traps an enemy in a dramatic misunderstanding.",
  levels: [{ dmg: 24, cd: 0.4, amount: 1, area: 1, radius: 22, slow: 0.62, knock: 12, every: 14, max: 24, life: 3.5, hold: 1.6, pop: 90, popR: 26, br: 8 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    const pl = w.player;
    const live = prune(inst);
    // the trail: one bubble per `every` px she has moved, left where she just was
    const step = S.L.every ?? 14;
    const dx = pl.x - (d.lx ?? pl.x);
    const dy = pl.y - (d.ly ?? pl.y);
    const d2 = dx * dx + dy * dy;
    if (d.lx === undefined || d2 > 60 * 60) {
      d.lx = pl.x;
      d.ly = pl.y;
    } else if (d2 >= step * step) {
      let room = live < (S.L.max ?? 24) + 2 * (S.amount - 1);
      // full: the oldest bubble that holds nobody makes way (the trail follows her)
      for (let i = 0; i < live && !room; i++) {
        if (inst.projs[i].a !== SOAP_FREE) continue;
        inst.projs[i].dead = true;
        room = true;
      }
      if (room) dropSoap(w, inst, S, d.lx, (d.ly ?? pl.y) - 7);
      d.lx = pl.x;
      d.ly = pl.y;
    }
    // what is left of the aura (last: its hits may resolve another weapon's stats into the shared scratch)
    const R = (S.L.radius ?? 22) * S.area;
    easeRadius(inst, R, dt);
    field(w, inst, S, d.r);
  },
  dispose(_w, inst) {
    soapDispose(inst);
  },
};

export const weapons: WeaponDef[] = [bubbleAura, oceanDome, soapOpera];
