/**
 * Bubble Aura: a shimmering bubble field around the hero. Every enemy inside
 * is slowed (bosses are immune to the slow) and takes a damage tick on its
 * own per-enemy cooldown (so hits ripple through the crowd instead of
 * flashing in lock-step). Cooldown makes it tick faster, Area grows it,
 * Duration makes the slow linger.
 * Evolution: Ocean Dome (+ Heart Locket) - a huge caustic dome: heals 1 HP per
 * 10 kills and periodically bursts outward (knock-back blast + flying bubbles).
 *
 * No projectiles for the field itself: the view reads `inst.data.r` (current
 * radius) and `inst.data.burst` (seconds since the last burst) and draws the
 * field in src/view/weapon-fx.ts.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_FREE, ROT_SPIN, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { wstats, type WStats } from "./_shared";
import { WFX_DOME_BURST, WFX_DOME_HEAL, fireSfx, wfx } from "./_fx";

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
    { dmg: 9, cd: 0.45, amount: 1, area: 1.1, radius: 30, slow: 0.7, knock: 12 },
    { dmg: 11, cd: 0.45, amount: 1, area: 1.25, radius: 30, slow: 0.65, knock: 12 },
    { dmg: 14, cd: 0.4, amount: 1, area: 1.4, radius: 30, slow: 0.62, knock: 14 },
  ],
  upgrades: ["Damage +2, area +10%", "Damage +2, ticks 10% faster", "Damage +2, area +15%, stronger slow", "Damage +3, area +15%, ticks faster"],
  evolutions: [{ into: "ocean_dome", with: "heart_locket" }],
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
  levels: [{ dmg: 14, cd: 0.35, amount: 10, area: 1, radius: 64, slow: 0.55, burst: 2.6, burstDmg: 42, burstKnock: 200, knock: 16 }],
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

export const weapons: WeaponDef[] = [bubbleAura, oceanDome];
