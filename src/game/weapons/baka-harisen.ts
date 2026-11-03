/**
 * Baka Harisen (Akane's signature, docs/content/weapons.md §2.4): every `cd` s
 * a paper-fan SMACK toward the nearest close enemy (else where Akane faces):
 * an ellipse (half extents 20 x 14, x area) centred 16 px ahead; each enemy
 * is hit once for `dmg` with huge `knock` and dazed for `stun` s (bosses are
 * never dazed). Amount 2 adds a backhand 0.2 s later in the opposite
 * direction (each further Amount alternates ±90°). Ricochet: a smacked enemy
 * that touches another within 0.4 s deals 40 % of the smack to it (once).
 * MEGA BAKA (Lv5): every 5th smack deals x3 and releases a shockwave ring
 * (r 48 x area) that hits everything for the smack damage; a big BAKA! always
 * pops. Otherwise a smack that hits pops BAKA! 35 % of the time (1.2 s
 * global cooldown) - counted in RunStats.bakas.
 * Evolution: Dere Dere Harisen (+ Friendship Bracelet) - a heart-shaped fan
 * smacks all around Akane; smacked enemies become projectiles (60 % to up to
 * 3 victims each); every smack heals 1 HP per enemy hit (max 3). "...baka ♡"
 *
 * Akane's talents read here (both forms): Ricochet Bonk (+20 % of the hit as
 * collision damage per rank), Harisen of Ultimate Denial (forward and ±60°),
 * Twin-Tail Tornado (every 5th smack is a drill spin: 360°, r 48, 3 hits of
 * 60 %).
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { CFG } from "../config";
import { PK_ATTACHED, ROT_SPIN, SHAPE_CIRCLE, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { fired, wstats, type WStats } from "./_shared";
import { HFX_AKANE_RING, HFX_AKANE_SMACK, daze, heroesA, hfx } from "./_heroes-a";

const DERE = "dere_dere_harisen";
/** Extra smack directions for Amount 2, 3, 4...: backhand, then ±90°. */
const EXTRA = [Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, (-3 * Math.PI) / 4, (3 * Math.PI) / 4, -Math.PI / 4];
const DENIAL = (60 * Math.PI) / 180;

/** Aim: the nearest enemy close by (auto-aim keeps a melee hero fun on a phone), else where she faces. */
function aimAngle(w: World): number {
  const pl = w.player;
  const e = w.nearestEnemy(pl.x, pl.y - CFG.playerCy, 62);
  if (e) return Math.atan2(e.y - e.cy - (pl.y - CFG.playerCy), e.x - pl.x);
  return Math.atan2(pl.aimY, pl.aimX);
}

/** Ricochet share of the smack damage (40 % + Ricochet Bonk 20 % per rank). */
function ricochet(w: World): number {
  return 0.4 + 0.2 * w.talentRank("akane_ricochet");
}

/** The fan sprite (visual only, the hit test is instant). */
function fanSprite(w: World, inst: WeaponInstance, a: number, reach: number, area: number, mega: boolean): void {
  const p = w.spawnProjectile(inst);
  p.kind = PK_ATTACHED;
  p.r = 0;
  p.ox = Math.cos(a) * reach;
  p.oy = Math.sin(a) * reach - CFG.playerCy;
  const pl = w.player;
  p.x = pl.x + p.ox;
  p.y = pl.y + p.oy;
  // mirrored, not upside down, when swinging left
  const left = Math.cos(a) < 0;
  p.flipX = left;
  p.rot = left ? a - Math.PI : a;
  p.sprite = "w_harisen";
  p.anim = 1;
  p.life = 0.18;
  p.scale = area * (mega ? 1.3 : 1);
  p.pierce = Infinity;
}

/** One frontal smack along `a`: instant ellipse hit test. Returns enemies hit. */
function smack(w: World, inst: WeaponInstance, S: WStats, a: number, mul: number, mega: boolean): number {
  const pl = w.player;
  const area = S.area;
  const reach = 16 * Math.sqrt(area);
  const cx = pl.x + Math.cos(a) * reach;
  const cy = pl.y - CFG.playerCy + Math.sin(a) * reach;
  const hw = 20 * area;
  const hh = 14 * area;
  const ca = Math.cos(-a);
  const sa = Math.sin(-a);
  const dmg = S.dmg * mul;
  const stun = S.L.stun ?? 0.3;
  const st = heroesA(w);
  const rico = S.dmg * ricochet(w);
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, Math.max(hw, hh) + 16, buf);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const e = w.enemies.items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy - cy;
    const lx = dx * ca - dy * sa;
    const ly = dx * sa + dy * ca;
    const ax = hw + e.r * 0.8;
    const ay = hh + e.r * 0.8;
    if ((lx * lx) / (ax * ax) + (ly * ly) / (ay * ay) > 1) continue;
    // knocked away from Akane (mostly along the swing)
    const ra = Math.atan2(e.y - e.cy - (pl.y - CFG.playerCy), e.x - pl.x);
    w.hitEnemy(e, dmg, inst, ra, S.knock, 0, inst.def.id, inst.def.color);
    hits++;
    if (e.dead) continue;
    daze(e, stun);
    st.fly(e, rico, 0.4, 1, inst, inst.def.id);
  }
  w.release();
  fanSprite(w, inst, a, reach, area, mega);
  hfx(w, HFX_AKANE_SMACK, cx, cy, a, 0, area, mega ? 1 : 0);
  return hits;
}

/** Hit everything within R of the hero (MEGA BAKA ring, Dere Dere smack, drill spin). Returns enemies hit. */
function ring(w: World, inst: WeaponInstance, R: number, dmg: number, knock: number, stun: number, flyDmg: number, flyT: number, victims: number): number {
  const pl = w.player;
  const cx = pl.x;
  const cy = pl.y - CFG.playerCy;
  const st = heroesA(w);
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 16, buf);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const e = w.enemies.items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy - cy;
    const rr = R + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    w.hitEnemy(e, dmg, inst, Math.atan2(dy, dx), knock, 0, inst.def.id, inst.def.color);
    hits++;
    if (e.dead) continue;
    if (stun > 0) daze(e, stun);
    if (flyDmg > 0) st.fly(e, flyDmg, flyT, victims, inst, inst.def.id);
  }
  w.release();
  return hits;
}

/** Twin-Tail Tornado: a 360° drill spin (r 48 x area, 3 hits of 60 % over 0.3 s). */
function drillSpin(w: World, inst: WeaponInstance, S: WStats, mul: number): void {
  const pl = w.player;
  const R = 48 * S.area;
  const p = w.spawnProjectile(inst);
  p.kind = PK_ATTACHED;
  p.ox = 0;
  p.oy = -CFG.playerCy;
  p.x = pl.x;
  p.y = pl.y - CFG.playerCy;
  p.shape = SHAPE_CIRCLE;
  p.r = R;
  p.dmg = S.dmg * 0.6 * mul;
  p.knock = S.knock * 0.5;
  p.pierce = Infinity;
  p.hitEvery = 0.1;
  p.life = 0.3;
  hfx(w, HFX_AKANE_SMACK, pl.x, pl.y - CFG.playerCy, 0, 0, R, 2);
}

/** The every-5th specials (MEGA BAKA at Lv5, Twin-Tail Tornado). Returns true when the primary smack is replaced. */
function fifth(w: World, inst: WeaponInstance, S: WStats, mega: boolean, mul: number): boolean {
  const tornado = w.talentRank("akane_twin_tail_tornado") > 0;
  if (tornado) drillSpin(w, inst, S, mul);
  if (mega) {
    const pl = w.player;
    const R = 48 * S.area;
    ring(w, inst, R, S.dmg, S.knock, 0, 0, 0, 0);
    hfx(w, HFX_AKANE_RING, pl.x, pl.y - CFG.playerCy, pl.x, pl.y, R, 1);
    heroesA(w).bakaPop(pl.x + Math.cos(inst.data.aim ?? 0) * 34, pl.y - 26, true, 2);
  }
  return tornado;
}

// ---------------------------------------------------------------- Baka Harisen
export const bakaHarisen: WeaponDef = {
  id: "baka_harisen",
  name: "Baka Harisen",
  icon: "icon_baka_harisen",
  color: C.red,
  sfx: "fanSmack",
  desc: "SMACK! A paper fan with enormous knockback. Smacked enemies bonk whatever they fly into.",
  levels: [
    { dmg: 22, cd: 1.5, amount: 1, area: 1, knock: 220, stun: 0.3 },
    { dmg: 22, cd: 1.5, amount: 2, area: 1, knock: 220, stun: 0.3 },
    { dmg: 30, cd: 1.5, amount: 2, area: 1.2, knock: 230, stun: 0.3 },
    { dmg: 30, cd: 1.25, amount: 2, area: 1.2, knock: 230, stun: 0.5 },
    { dmg: 40, cd: 1.25, amount: 2, area: 1.4, knock: 260, stun: 0.5 },
  ],
  upgrades: ["Backhand: also smacks behind you", "Damage +8, bigger fan", "Cooldown −17%, longer daze", "Damage +10, even bigger fan, every 5th smack is a MEGA BAKA"],
  evolution: { into: DERE, with: "friendship_bracelet" },
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { dmg: 0.25, area: 0.1, text: "LIMIT BREAK — Thicker Paper: +25% damage, +10% fan size" },
    { cd: 0.85, dmg: 0.2, text: "MASTERED — Reflex Smack: −15% cooldown, +20% damage" },
  ],
  update(w, inst, dt) {
    const d = inst.data;
    const S = wstats(w, inst);
    // queued follow-ups (backhand, then ±90°), 0.2 s apart
    if ((d.q ?? 0) > 0) {
      d.qt = (d.qt ?? 0) - dt;
      if (d.qt <= 0) {
        d.qt += 0.2;
        const k = d.qk ?? 0;
        d.qk = k + 1;
        d.q--;
        followUp(w, inst, S, (d.aim ?? 0) + EXTRA[k % EXTRA.length]);
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    if (!w.nearestEnemy(pl.x, pl.y - CFG.playerCy, 90 * S.area)) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
    d.n = (d.n ?? 0) + 1;
    d.aim = aimAngle(w);
    // MEGA BAKA from Lv5 (Limit Breaks keep it)
    const mega = inst.level >= 5 && d.n % 5 === 0;
    const mul = mega ? 3 : 1;
    const replaced = d.n % 5 === 0 && fifth(w, inst, S, mega, mul);
    if (!replaced) primary(w, inst, S, d.aim, mul, mega);
    d.q = Math.max(0, S.amount - 1);
    d.qt = 0.2;
    d.qk = 0;
    fired(w, inst, pl.x, pl.y);
  },
};

/** The forward smack (Ultimate Denial: also ±60°), with its BAKA! pop roll. */
function primary(w: World, inst: WeaponInstance, S: WStats, a: number, mul: number, mega: boolean): void {
  let hits = smack(w, inst, S, a, mul, mega);
  if (w.talentRank("akane_ultimate_denial") > 0) {
    hits += smack(w, inst, S, a + DENIAL, mul, false);
    hits += smack(w, inst, S, a - DENIAL, mul, false);
  }
  if (hits > 0 && !mega) popOver(w, a);
}

function followUp(w: World, inst: WeaponInstance, S: WStats, a: number): void {
  let hits = smack(w, inst, S, a, 1, false);
  if (w.talentRank("akane_ultimate_denial") > 0) {
    hits += smack(w, inst, S, a + DENIAL, 1, false);
    hits += smack(w, inst, S, a - DENIAL, 1, false);
  }
  if (hits > 0) popOver(w, a);
  const pl = w.player;
  fired(w, inst, pl.x, pl.y);
}

/** BAKA! roll for a smack that hit: the pop sits out along the swing, clear of Akane. */
function popOver(w: World, a: number): void {
  const pl = w.player;
  heroesA(w).bakaPop(pl.x + Math.cos(a) * 36, pl.y - CFG.playerCy + Math.sin(a) * 30 - 10, false);
}

// ---------------------------------------------------------------- Dere Dere Harisen
export const dereDereHarisen: WeaponDef = {
  id: DERE,
  name: "Dere Dere Harisen",
  icon: "icon_dere_dere_harisen",
  color: C.hotPink,
  sfx: "fanSmack",
  evolved: true,
  desc: "EVOLUTION! A heart-shaped fan smacks all around you. Smacked enemies become projectiles. '...b-baka ♡'",
  levels: [{ dmg: 60, cd: 1.1, amount: 1, radius: 54, knock: 320, stun: 0.5, missile: 0.6, healPer: 1, healMax: 3 }],
  upgrades: [],
  update(w, inst, dt) {
    const d = inst.data;
    const S = wstats(w, inst);
    if ((d.q ?? 0) > 0) {
      d.qt = (d.qt ?? 0) - dt;
      if (d.qt <= 0) {
        d.qt += 0.2;
        d.q--;
        dereSmack(w, inst, S, 1);
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    if (!w.nearestEnemy(pl.x, pl.y - CFG.playerCy, (S.L.radius ?? 54) * S.area + 30)) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
    d.n = (d.n ?? 0) + 1;
    if (d.n % 5 === 0 && w.talentRank("akane_twin_tail_tornado") > 0) drillSpin(w, inst, S, 1);
    dereSmack(w, inst, S, 1);
    d.q = Math.max(0, S.amount - 1);
    d.qt = 0.2;
  },
};

function dereSmack(w: World, inst: WeaponInstance, S: WStats, mul: number): void {
  const pl = w.player;
  const L = S.L;
  const R = (L.radius ?? 54) * S.area;
  const dmg = S.dmg * mul;
  const hits = ring(w, inst, R, dmg, S.knock, L.stun ?? 0.5, dmg * (L.missile ?? 0.6) * (ricochet(w) / 0.4), 0.5, 3);
  // the fan whirls once around her
  const p = w.spawnProjectile(inst);
  p.kind = PK_ATTACHED;
  p.r = 0;
  p.ox = 0;
  p.oy = -CFG.playerCy;
  p.x = pl.x;
  p.y = pl.y - CFG.playerCy;
  p.sprite = "w_harisen_evo";
  p.fps = 24;
  p.scale = (R * 2) / 48;
  p.rotMode = ROT_SPIN;
  p.spin = 14;
  p.rot = w.rng.next() * TAU;
  p.life = 0.24;
  p.pop = true;
  p.alpha = 0.95;
  hfx(w, HFX_AKANE_SMACK, pl.x, pl.y - CFG.playerCy, 0, 0, R, 3);
  fired(w, inst, pl.x, pl.y);
  if (hits <= 0) return;
  // a little love back: 1 HP per enemy hit (max 3) x healMul
  const heal = Math.min(L.healMax ?? 3, hits * (L.healPer ?? 1));
  if (pl.hp < pl.maxHp) w.heal(heal, true);
  const st = heroesA(w);
  const a = w.rng.angle();
  st.bakaPop(pl.x + Math.cos(a) * 40, pl.y - 28, false, 1, true);
}

export const weapons: WeaponDef[] = [bakaHarisen, dereDereHarisen];
