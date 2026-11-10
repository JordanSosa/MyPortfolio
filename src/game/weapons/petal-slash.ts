/**
 * Petal Slash (Rin): a crescent sword arc in the facing direction (Lv2: also
 * behind; extra Amount adds up / down / diagonal arcs).
 * Evolution: Sakura Tempest (+ Big Ribbon) - a 360 degree whirlwind every 0.8 s
 * that also flings petal blades.
 * Second evolution: Already Cut (+ Swift Shoes) - one long line cut along the way she last moved: no damage
 *   on the cut, everything on the line is MARKED and takes it all at once when she sheathes the blade
 *   (`wait` s later; +`moved` if she walked on meanwhile). Marks that die shed petal blades down the line.
 *   (Aim assist: she turns to a line with more than twice as many enemies on it, if there is one.)
 *   Directional and delayed, the highest single-line burst, nothing behind her.
 *
 * Rin's talents (talents/rin.ts) read here, for both forms: Wide Stance (+6%
 * area per rank), Petal Storm (each slash launches 1-3 homing petal blades),
 * Crescent Moon Draw (every 3rd swing is a 360 degree moon slash, r 56, x1.5).
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_ATTACHED, PK_FREE, ROT_SPIN, SHAPE_CIRCLE, SHAPE_ELLIPSE, type Enemy, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { heroFx, sfxAt } from "./_fx";
import { fired, wstats, type WStats } from "./_shared";

/** Direction offsets for slash #k: front, back, up, down, then diagonals. */
const DIRS = [0, Math.PI, -Math.PI / 2, Math.PI / 2, -Math.PI / 4, (Math.PI * 3) / 4, Math.PI / 4, (-Math.PI * 3) / 4];

/** Aim: the nearest enemy close by (auto-aim keeps melee fun on a phone), else the horizontal facing. */
function aimAngle(w: World): number {
  const pl = w.player;
  const e = w.nearestEnemy(pl.x, pl.y - 8, 64);
  if (e) return Math.atan2(e.y - e.cy - (pl.y - 8), e.x - pl.x);
  return pl.face > 0 ? 0 : Math.PI;
}

/** Wide Stance: area multiplier from the talent rank (1 without it). */
function stance(w: World): number {
  const r = w.talentRank("rin_wide_stance");
  return r > 0 ? 1 + 0.06 * r : 1;
}

/** Petal Storm / Sakura blades: one homing petal blade from the hero toward `a` (target optional). */
function petalBlade(w: World, inst: WeaponInstance, a: number, dmg: number, pierce: number, tgt: Enemy | null, source?: string): void {
  const pl = w.player;
  const q = w.spawnProjectile(inst, source);
  q.kind = PK_FREE;
  q.x = pl.x + Math.cos(a) * 10;
  q.y = pl.y - 8 + Math.sin(a) * 10;
  q.speed = 150 * w.stats.projSpeed;
  q.vx = Math.cos(a) * q.speed;
  q.vy = Math.sin(a) * q.speed;
  q.r = 4;
  q.homing = 3.2;
  q.target = tgt;
  q.targetUid = tgt ? tgt.uid : 0;
  q.dmg = dmg;
  q.pierce = pierce;
  q.knock = 30;
  q.life = 0.75;
  q.sprite = "ult_petal";
  q.rotMode = ROT_SPIN;
  q.spin = 14;
  q.trail = "petal";
}

const near: Enemy[] = [];

/** Crescent Moon Draw: a 360 degree moon slash around the hero (r 56 x area, x1.5 damage). */
function moonSlash(w: World, inst: WeaponInstance, r: number, dmg: number, knock: number): void {
  const pl = w.player;
  const p = w.spawnProjectile(inst);
  p.kind = PK_ATTACHED;
  p.ox = 0;
  p.oy = -8;
  p.x = pl.x;
  p.y = pl.y - 8;
  p.shape = SHAPE_CIRCLE;
  p.r = r;
  p.dmg = dmg;
  p.knock = knock;
  p.pierce = Infinity;
  p.hitEvery = 0.5;
  p.life = 0.4;
  p.sprite = "w_tempest";
  p.fps = 18;
  p.rotMode = ROT_SPIN;
  p.spin = 14;
  p.scale = (r * 2) / 44;
  p.tint = 0xfff1c4;
  p.pop = true;
  p.glow = true;
  p.alpha = 0.95;
}

function slash(w: World, inst: WeaponInstance, S: WStats, k: number): void {
  const pl = w.player;
  if (k === 0) inst.data.aim = aimAngle(w);
  const a = (inst.data.aim ?? 0) + DIRS[k % DIRS.length];
  const area = S.area * stance(w);
  const reach = 19 * area;
  const p = w.spawnProjectile(inst);
  p.kind = PK_ATTACHED;
  p.ox = Math.cos(a) * reach;
  p.oy = Math.sin(a) * reach - 8;
  p.x = pl.x + p.ox;
  p.y = pl.y + p.oy;
  p.shape = SHAPE_ELLIPSE;
  p.ang = a;
  p.r = 1;
  p.hw = 24 * area;
  p.hh = 16 * area;
  p.dmg = S.dmg;
  p.knock = S.knock;
  p.pierce = Infinity;
  p.hitEvery = 0.3;
  p.life = 0.26;
  p.sprite = "w_slash";
  p.anim = 1;
  p.rot = a;
  p.scale = area;
  p.glow = true;
  p.trail = "slash";
  // Petal Storm: 1 / 2 / 3 homing petal blades at the nearest enemies (8 damage, pierce 1)
  const storm = w.talentRank("rin_petal_storm");
  if (storm > 0) {
    const n = w.nearestEnemies(pl.x, pl.y - 8, 150, storm, near);
    for (let i = 0; i < storm; i++) {
      const t = n > 0 ? near[i % n] : null;
      const ta = t ? Math.atan2(t.y - t.cy - (pl.y - 8), t.x - pl.x) : a + (i - (storm - 1) / 2) * 0.4;
      petalBlade(w, inst, ta, 8 * w.stats.might * (inst.dmgMul ?? 1), 1, t);
    }
  }
}

export const petalSlash: WeaponDef = {
  id: "petal_slash",
  name: "Petal Slash",
  icon: "icon_petal_slash",
  color: C.pinkLight,
  sfx: "slash",
  desc: "A sweeping sakura sword arc in the direction you face.",
  levels: [
    { dmg: 16, cd: 1.1, amount: 1, area: 1, knock: 70 },
    { dmg: 16, cd: 1.1, amount: 2, area: 1, knock: 70 },
    { dmg: 22, cd: 1.1, amount: 2, area: 1.15, knock: 75 },
    { dmg: 22, cd: 0.9, amount: 2, area: 1.15, knock: 75 },
    { dmg: 30, cd: 0.9, amount: 2, area: 1.3, knock: 85 },
  ],
  upgrades: ["Also slashes behind you", "Damage +6, area +15%", "Cooldown -18%", "Damage +8, area +15%"],
  evolutions: [
    { into: "sakura_tempest", with: "big_ribbon" },
    { into: "already_cut", with: "swift_shoes" },
  ],
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { dmg: 0.2, area: 0.15, text: "LIMIT BREAK — Whetstone: +20% damage, +15% area" },
    { dmg: 0.25, cd: 0.85, text: "MASTERED — One Thousand Cuts: +25% damage, −15% cooldown" },
  ],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    if ((d.queue ?? 0) > 0) {
      d.qt = (d.qt ?? 0) - dt;
      while (d.qt <= 0 && d.queue > 0) {
        slash(w, inst, S, d.k ?? 0);
        d.k = (d.k ?? 0) + 1;
        d.queue--;
        d.qt += 0.09;
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    inst.timer = S.cd;
    d.queue = Math.min(DIRS.length, S.amount);
    d.qt = 0;
    d.k = 0;
    // Crescent Moon Draw: every 3rd swing is a full moon slash
    if (w.talentRank("rin_crescent_draw") > 0) {
      d.vol = (d.vol ?? 0) + 1;
      if (d.vol % 3 === 0) moonSlash(w, inst, 56 * S.area * stance(w), S.dmg * 1.5, S.knock * 1.2);
    }
    fired(w, inst, w.player.x, w.player.y);
  },
};

export const sakuraTempest: WeaponDef = {
  id: "sakura_tempest",
  name: "Sakura Tempest",
  icon: "icon_sakura_tempest",
  color: C.pink,
  sfx: "slash",
  evolved: true,
  desc: "EVOLUTION! A 360° petal whirlwind every 0.8 s that flings petal blades.",
  levels: [{ dmg: 33, cd: 0.8, amount: 6, area: 1, knock: 95, petalDmg: 17 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    inst.timer -= dt;
    if (inst.timer > 0) return;
    inst.timer = S.cd;
    const pl = w.player;
    // Crescent Moon Draw on the evolution: every 3rd whirl is a moon slash (r 56, x1.5)
    const d = inst.data;
    let moon = false;
    if (w.talentRank("rin_crescent_draw") > 0) {
      d.vol = (d.vol ?? 0) + 1;
      moon = d.vol % 3 === 0;
    }
    const r = (moon ? 56 : 36) * S.area * stance(w);
    const p = w.spawnProjectile(inst);
    p.kind = PK_ATTACHED;
    p.ox = 0;
    p.oy = -8;
    p.x = pl.x;
    p.y = pl.y - 8;
    p.shape = SHAPE_CIRCLE;
    p.r = r;
    p.dmg = moon ? S.dmg * 1.5 : S.dmg;
    p.knock = S.knock;
    p.pierce = Infinity;
    p.hitEvery = 0.5;
    p.life = 0.46;
    p.sprite = "w_tempest";
    p.anim = 0;
    p.fps = 16;
    p.rotMode = ROT_SPIN;
    p.spin = 10;
    p.scale = (r * 2) / 44;
    p.pop = true;
    p.alpha = 0.92;
    // petal blades: the fan is centred on the nearest enemy (a boss in range wins) and the blades curve in
    // (Petal Storm adds its blades to the fan)
    const storm = w.talentRank("rin_petal_storm");
    const n = Math.min(14 + storm, S.amount + 2 + storm);
    const b = w.boss;
    const tgt = b && !b.dead && Math.abs(b.x - pl.x) < 150 && Math.abs(b.y - b.cy - pl.y) < 150 ? b : w.nearestEnemy(pl.x, pl.y - 8, 150);
    const a0 = tgt ? Math.atan2(tgt.y - tgt.cy - (pl.y - 8), tgt.x - pl.x) : w.rng.angle();
    const pdmg = (S.L.petalDmg ?? 14) * w.stats.might;
    for (let k = 0; k < n; k++) petalBlade(w, inst, a0 + (k / n) * TAU, pdmg, 3, k === 0 ? tgt : null);
    fired(w, inst, pl.x, pl.y);
  },
};

// ---------------------------------------------------------------- Already Cut

/** View cues (heroFx). The cut: a line from (x, y) to (x2, y2), half-width r. */
export const FX_CUT = "e2a_cut";
/** An enemy on the line was marked (`enemy`, n = its uid; the mark resolves `r` s later). */
export const FX_CUT_MARK = "e2a_mark";
/** The sheath click at the hero (x, y): n = marks resolved, r = 1 when she moved on (the bonus). */
export const FX_CUT_CLICK = "e2a_click";

const MARKS = 48;
/** The pending cut of one instance: who is marked, where she stood, the line's angle. */
interface Cut {
  es: (Enemy | null)[];
  uids: Int32Array;
  n: number;
  /** Seconds until the sheath click (<= 0: nothing pending). */
  t: number;
  /** Damage multiplier of this cut (Crescent Moon Draw: every 3rd one). */
  mul: number;
  px: number;
  py: number;
  ang: number;
}
const cuts = new WeakMap<WeaponInstance, Cut>();
function cutOf(inst: WeaponInstance): Cut {
  let c = cuts.get(inst);
  if (!c) cuts.set(inst, (c = { es: new Array<Enemy | null>(MARKS).fill(null), uids: new Int32Array(MARKS), n: 0, t: 0, mul: 1, px: 0, py: 0, ang: 0 }));
  return c;
}

/** Mark every enemy on the segment from (x, y) along `a` (length len, half-width hw) that is not marked yet. */
function markLine(w: World, c: Cut, x: number, y: number, a: number, len: number, hw: number, wait: number, dry = false): number {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const buf = w.acquire();
  const n = w.grid.query(x + ca * len * 0.5, y + sa * len * 0.5, len * 0.5 + hw + 16, buf);
  const items = w.enemies.items;
  let on = 0;
  for (let k = 0; k < n && c.n < MARKS; k++) {
    const e = items[buf[k]];
    if (!e || e.dead || e.def.prop) continue;
    const dx = e.x - x;
    const dy = e.y - e.cy - y;
    const along = dx * ca + dy * sa;
    if (along < -e.r || along > len + e.r || Math.abs(dy * ca - dx * sa) > hw + e.r) continue;
    on++;
    if (dry) continue;
    let seen = false;
    for (let i = 0; i < c.n; i++)
      if (c.uids[i] === e.uid) {
        seen = true;
        break;
      }
    if (seen) continue;
    c.es[c.n] = e;
    c.uids[c.n++] = e.uid;
    heroFx(w, FX_CUT_MARK, e.x, e.y - e.cy, e.x, e.y - e.cy, wait, e.uid, e);
  }
  w.release();
  return on;
}

/** A petal blade shed by a mark that died: straight on down the line from (x, y). */
function shedPetal(w: World, inst: WeaponInstance, x: number, y: number, a: number, dmg: number): void {
  const q = w.spawnProjectile(inst);
  q.kind = PK_FREE;
  q.x = x;
  q.y = y;
  q.speed = 170 * w.stats.projSpeed;
  q.vx = Math.cos(a) * q.speed;
  q.vy = Math.sin(a) * q.speed;
  q.r = 4;
  q.dmg = dmg;
  q.pierce = 3;
  q.knock = 30;
  q.life = 0.6;
  q.sprite = "ult_petal";
  q.rotMode = ROT_SPIN;
  q.spin = 14;
  q.trail = "petal";
}

/** The sheath click: every mark that still stands takes the cut at once. */
function sheathe(w: World, inst: WeaponInstance, S: WStats, c: Cut): void {
  const pl = w.player;
  const L = S.L;
  const moved = Math.hypot(pl.x - c.px, pl.y - c.py) > 6;
  const dmg = S.dmg * c.mul * (moved ? 1 + (L.moved ?? 0.5) : 1);
  const pdmg = (L.petalDmg ?? 14) * w.stats.might * (inst.dmgMul ?? 1);
  const petals = Math.round(L.petals ?? 3);
  // (S is shared scratch: a hit's hooks may resolve another weapon's stats)
  const knock = S.knock;
  let shed = 18;
  let hit = 0;
  for (let i = 0; i < c.n; i++) {
    const e = c.es[i];
    c.es[i] = null;
    if (!e || e.dead || e.uid !== c.uids[i]) continue;
    hit++;
    const x = e.x;
    const y = e.y - e.cy;
    // (knocked sideways off the line, alternating: the cut opens)
    if (!w.hitEnemy(e, dmg, inst, c.ang + (i & 1 ? 1 : -1) * 1.2, knock, 0, inst.def.id, inst.def.color)) continue;
    for (let k = 0; k < petals && shed > 0; k++, shed--) shedPetal(w, inst, x, y, c.ang + (k - (petals - 1) / 2) * 0.22, pdmg);
  }
  c.n = 0;
  heroFx(w, FX_CUT_CLICK, pl.x, pl.y, pl.x, pl.y, moved ? 1 : 0, hit);
  if (hit > 0) sfxAt(w, inst.def.id, "hitCrit", pl.x, pl.y);
}

export const alreadyCut: WeaponDef = {
  id: "already_cut",
  name: "Already Cut",
  icon: "icon_already_cut",
  color: C.pinkLight,
  sfx: "slash",
  evolved: true,
  desc: "EVOLUTION! One long cut the way you face. Nothing happens. Then she sheathes the blade.",
  levels: [{ dmg: 54, cd: 1.3, amount: 1, area: 1, knock: 40, len: 150, wid: 14, wait: 0.45, moved: 0.5, petals: 3, petalDmg: 14 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const c = cutOf(inst);
    const L = S.L;
    const wait = L.wait ?? 0.45;
    if (c.t > 0) {
      c.t -= dt;
      if (c.t <= 0) sheathe(w, inst, S, c);
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    // (never a second cut before the first one is sheathed)
    inst.timer = Math.max(S.cd, wait + 0.1);
    const pl = w.player;
    const d = inst.data;
    // Rin's talents on this route: Wide Stance widens it, every 3rd draw is a Crescent Moon cut (x2.5 as wide, x1.5)
    let moon = false;
    if (w.talentRank("rin_crescent_draw") > 0) {
      d.vol = (d.vol ?? 0) + 1;
      moon = d.vol % 3 === 0;
    }
    const area = S.area * stance(w);
    const len = (L.len ?? 150) * area;
    const hw = (L.wid ?? 14) * 0.5 * area * (moon ? 2.5 : 1);
    const x = pl.x;
    const y = pl.y - 8;
    // The way she last moved - unless that line holds less than half of what the best line around her would
    // (the nearest enemy's, or one of 12 around the clock): then she turns to that one. Melee on a phone needs
    // the help (as Petal Slash's auto-aim), and lining enemies up is still the player's job.
    const move = Math.atan2(pl.aimY, pl.aimX);
    let a0 = move;
    const mine = markLine(w, c, x, y, move, len, hw, wait, true);
    let best = mine * 2;
    const e = w.nearestEnemy(x, y, len);
    for (let k = e ? -1 : 0; k < 12; k++) {
      const a = k < 0 && e ? Math.atan2(e.y - e.cy - y, e.x - x) : move + (k * TAU) / 12;
      const n = markLine(w, c, x, y, a, len, hw, wait, true);
      if (n > best) {
        best = n;
        a0 = a;
      }
    }
    c.px = pl.x;
    c.py = pl.y;
    c.ang = a0;
    c.t = wait;
    c.mul = moon ? 1.5 : 1;
    // extra Amount fans more cuts around the first (never behind her)
    const cutsN = Math.min(5, S.amount);
    for (let k = 0; k < cutsN; k++) {
      const a = a0 + (k & 1 ? 1 : -1) * 0.3 * Math.ceil(k / 2);
      markLine(w, c, x, y, a, len, hw, wait);
      heroFx(w, FX_CUT, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, hw, k);
    }
    // ... and Petal Storm's homing blades fly on the cut
    const storm = w.talentRank("rin_petal_storm");
    if (storm > 0) {
      const n = w.nearestEnemies(x, y, 150, storm, near);
      for (let i = 0; i < storm; i++) {
        const t = n > 0 ? near[i % n] : null;
        petalBlade(w, inst, t ? Math.atan2(t.y - t.cy - y, t.x - x) : a0 + (i - (storm - 1) / 2) * 0.4, 8 * w.stats.might * (inst.dmgMul ?? 1), 1, t);
      }
    }
    fired(w, inst, pl.x, pl.y);
  },
};

export const weapons: WeaponDef[] = [petalSlash, sakuraTempest, alreadyCut];
