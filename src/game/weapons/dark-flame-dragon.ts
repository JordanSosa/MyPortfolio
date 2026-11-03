/**
 * Dark Flame Dragon (Kuro's signature, docs/content/weapons.md §2.1): `amount`
 * tiny salamander familiars hover at Kuro's shoulders. Every `cd` s, when an
 * enemy is within 110 px x area, each one turns to the nearest enemy and
 * breathes a cone (length `len` x area, half-angle `angle` deg) for
 * `duration` s, hitting everything in it every 0.12 s (slot channel) and
 * setting it on Burn (`burnDps` for `burn` s, ticks every 0.5 s, refreshes,
 * never stacks; the burn is the weapon's damage). The flames are orange with a
 * violet outline Kuro drew on ("black" flames).
 * Evolution: Unsealed Abyss Dragon (+ Inner Monologue) - a black-violet dragon
 * circles Kuro breathing actually-black flames outward, judges the strongest
 * enemy with a jet every `cd` s, and burning enemies that die explode.
 *
 * Kuro's talents read here (both forms): Dark Flame Kindling (+15 % burn per
 * rank), The Seal Is Broken (black flames, burn x2; its +15 % damage taken is
 * installed by the talent), Eyepatch: Off (a Crimson Eye Beam every 4 s at the
 * Marked or nearest enemy). Kuro C6: Ragnarok II, a second salamander.
 *
 * Familiars are owned PK_MANAGED projectiles with r = 0 (no contact hits); the
 * view (src/view/heroes-a-fx.ts) reads their breath from the projectile:
 * ang = breath angle, a = breath seconds left, hh = cone length, hw = cone
 * half-angle (radians), b = black flames (1). Beams (unowned PK_MANAGED,
 * r = 0) carry b = BEAM_JET / BEAM_EYE, origin (ox, oy), angle ang, length a.
 */
import { C } from "../../art/palette";
import { TAU, approachAngle } from "../../core/math";
import { CFG, CH_MISC } from "../config";
import { PK_MANAGED, type Enemy, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { fired, killOwned, own, prune, wstats, type WStats } from "./_shared";
import { HFX_KURO_EYE_BEAM, HFX_KURO_JET, heroesA, hfx, segmentHits, strongestInView } from "./_heroes-a";

const DEG = Math.PI / 180;
/** Projectile.b markers for the view: ABYSSAL LORD'S JUDGEMENT jet / Crimson Eye Beam. */
export const BEAM_JET = 7;
export const BEAM_EYE = 8;
/** Shoulder offsets (x, y from the feet) for familiars 1..6 (the first three from the bible). */
const OFF_X = [10, -10, 0, 16, -16, 0];
const OFF_Y = [-14, -14, -20, -7, -7, -26];
const MAX_FAMILIARS = 6;
/** Breath re-hit (s) of the base weapon / the evolution. */
const TICK = 0.12;
const TICK_EVO = 0.1;
/** The base weapon only breathes when an enemy is this close (x area). */
const WAKE_RANGE = 110;

/** Burn damage multiplier from Kuro's talents (Kindling +15 % per rank, Seal Broken x2). */
export function burnMul(w: World): number {
  let k = 1 + 0.15 * w.talentRank("kuro_kindling");
  if (w.talentRank("kuro_seal_broken") > 0) k *= 2;
  return k;
}

/** Extra familiars: Kuro C6 (Ragnarok II, "the sequel"). */
function sequel(w: World): number {
  return w.hero.id === "kuro" && w.cons >= 6 ? 1 : 0;
}

/** Hit everything in the cone from (ox, oy) along `a` (length L, half-angle ha) on the slot channel; burn it. */
function cone(w: World, inst: WeaponInstance, ox: number, oy: number, a: number, L: number, ha: number, dmg: number, knock: number, every: number, burnDps: number, burnT: number): void {
  const buf = w.acquire();
  const n = w.grid.query(ox, oy, L + 16, buf);
  const items = w.enemies.items;
  const ch = inst.slot;
  const now = w.t;
  const st = heroesA(w);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - ox;
    const dy = e.y - e.cy - oy;
    const d2 = dx * dx + dy * dy;
    const reach = L + e.r;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2);
    if (d > e.r + 2) {
      // inside the cone (the enemy's radius widens it a little)
      const cos = (dx * ca + dy * sa) / d;
      const slack = Math.asin(Math.min(1, e.r / d));
      if (cos < Math.cos(Math.min(Math.PI, ha + slack))) continue;
    }
    if (now - e.lastHit[ch] < every) continue;
    e.lastHit[ch] = now;
    w.hitEnemy(e, dmg, inst, a, knock, 0, inst.def.id, inst.def.color);
    if (!e.dead) st.burn(e, burnDps, burnT);
  }
  w.release();
}

/** One familiar (salamander or abyss dragon). */
function familiar(w: World, inst: WeaponInstance, sprite: string, x: number, y: number): Projectile {
  const p = w.spawnProjectile(inst);
  p.kind = PK_MANAGED;
  p.r = 0;
  p.pierce = Infinity;
  p.life = Infinity;
  p.x = x;
  p.y = y;
  p.sprite = sprite;
  p.pop = true;
  p.shadow = 0;
  p.a = 0;
  own(inst, p);
  return p;
}

/** Keep exactly `n` live familiars (pooled projectiles get reused: prune by uid). */
function keepFamiliars(w: World, inst: WeaponInstance, n: number, sprite: string): void {
  prune(inst);
  const pl = w.player;
  while (inst.projs.length < n) familiar(w, inst, sprite, pl.x, pl.y - 14);
  while (inst.projs.length > n) {
    const p = inst.projs.pop() as Projectile;
    inst.uids.pop();
    p.dead = true;
  }
}

// ---------------------------------------------------------------- Crimson Eye Beam (Eyepatch: Off)
const EYE_LEN = 120;

/** p.ang = angle, p.a = length; the origin follows Kuro's eye. */
const eyeBeamHook: ProjHook = (p, w) => {
  const pl = w.player;
  p.ox = pl.x + pl.face * 3;
  p.oy = pl.y - 15;
  p.x = p.ox + Math.cos(p.ang) * p.a * 0.5;
  p.y = p.oy + Math.sin(p.ang) * p.a * 0.5;
  segmentHits(w, p.ox, p.oy, p.ang, p.a, 3, p.dmg, p.owner, CH_MISC, 0.1, 10, p.source, C.red);
};

function eyeBeam(w: World, inst: WeaponInstance): void {
  const pl = w.player;
  const st = heroesA(w);
  const ox = pl.x + pl.face * 3;
  const oy = pl.y - 15;
  const t: Enemy | null = st.mark && !st.mark.dead ? st.mark : w.nearestEnemy(ox, oy, EYE_LEN + 20);
  if (!t) return;
  const a = Math.atan2(t.y - t.cy - oy, t.x - ox);
  const p = w.spawnProjectile(inst);
  p.kind = PK_MANAGED;
  p.r = 0;
  p.ang = a;
  p.a = EYE_LEN;
  p.dmg = 8 * w.stats.might * (inst.dmgMul ?? 1);
  p.pierce = Infinity;
  p.life = 0.4;
  p.b = BEAM_EYE;
  p.ox = ox;
  p.oy = oy;
  p.update = eyeBeamHook;
  hfx(w, HFX_KURO_EYE_BEAM, ox, oy, a, 0.4, EYE_LEN);
}

/** Eyepatch: Off: the beam timer (both forms). */
function eyepatch(w: World, inst: WeaponInstance, dt: number): void {
  if (w.talentRank("kuro_eyepatch_off") <= 0) return;
  const d = inst.data;
  d.eye = (d.eye ?? 1.5) - dt;
  if (d.eye > 0) return;
  d.eye = 4;
  eyeBeam(w, inst);
}

// ---------------------------------------------------------------- Dark Flame Dragon
export const darkFlameDragon: WeaponDef = {
  id: "dark_flame_dragon",
  name: "Dark Flame Dragon",
  icon: "icon_dark_flame_dragon",
  color: C.orange,
  sfx: "fireball",
  desc: "A tiny dragon on your shoulder breathes black flames at the nearest enemy. (They're orange.)",
  levels: [
    { dmg: 4, cd: 2.2, amount: 1, duration: 0.8, len: 56, angle: 22, burnDps: 4, burn: 2, knock: 8 },
    { dmg: 5, cd: 2.2, amount: 1, duration: 0.8, len: 64, angle: 22, burnDps: 4, burn: 2, knock: 8 },
    { dmg: 5, cd: 2.2, amount: 2, duration: 0.8, len: 64, angle: 22, burnDps: 4, burn: 2, knock: 8 },
    { dmg: 7, cd: 1.9, amount: 2, duration: 0.8, len: 64, angle: 22, burnDps: 4, burn: 3, knock: 8 },
    { dmg: 9, cd: 1.9, amount: 2, duration: 1.1, len: 72, angle: 28, burnDps: 6, burn: 3, knock: 10 },
  ],
  upgrades: ["Damage +1, longer flames", "+1 dragon (the sequel)", "Damage +2, cooldown −14%, burns last longer", "Damage +2, a bigger, longer, hotter breath"],
  evolution: { into: "unsealed_abyss_dragon", with: "inner_monologue" },
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { dmg: 0.2, area: 0.15, text: "LIMIT BREAK — Seal Weakening: +20% damage, +15% flame size" },
    { amount: 1, dmg: 0.2, text: "MASTERED — The Trilogy: +1 dragon, +20% damage" },
  ],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const st = heroesA(w);
    st.burnOwner = inst;
    st.burnSource = inst.def.id;
    st.burstDmg = 0;
    const n = Math.min(MAX_FAMILIARS, S.amount + sequel(w));
    keepFamiliars(w, inst, n, "w_salamander");
    breathe(w, inst, S, dt, n);
    eyepatch(w, inst, dt);
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

/** Base weapon: hover, wake up when an enemy is near, breathe cones at the nearest enemies. */
function breathe(w: World, inst: WeaponInstance, S: WStats, dt: number, n: number): void {
  const pl = w.player;
  const L = (S.L.len ?? 56) * S.area;
  const ha = (S.L.angle ?? 22) * DEG;
  const black = w.talentRank("kuro_seal_broken") > 0 ? 1 : 0;
  const k = 1 - Math.exp(-14 * dt);
  // hover at the shoulders (a lazy bob, staggered per familiar)
  for (let i = 0; i < n; i++) {
    const p = inst.projs[i];
    const tx = pl.x + OFF_X[i] * (i < 2 ? 1 : pl.face);
    const ty = pl.y + OFF_Y[i] + Math.sin(w.t * 5 + i * 1.7) * 1.5;
    p.x += (tx - p.x) * k;
    p.y += (ty - p.y) * k;
    p.hh = L;
    p.hw = ha;
    p.b = black;
  }
  inst.timer -= dt;
  if (inst.timer <= 0) {
    if (w.nearestEnemy(pl.x, pl.y - CFG.playerCy, WAKE_RANGE * S.area)) {
      inst.timer = S.cd;
      for (let i = 0; i < n; i++) {
        const p = inst.projs[i];
        const t = w.nearestEnemy(p.x, p.y, L + 40);
        p.ang = t ? Math.atan2(t.y - t.cy - p.y, t.x - p.x) : pl.face > 0 ? 0 : Math.PI;
        p.a = S.duration;
      }
      fired(w, inst, pl.x, pl.y);
    } else inst.timer = 0.15;
  }
  const dmg = S.dmg;
  const burnDps = (S.L.burnDps ?? 4) * (S.dmg / Math.max(1e-6, S.L.dmg)) * burnMul(w);
  const burnT = (S.L.burn ?? 2) * w.stats.duration;
  for (let i = 0; i < n; i++) {
    const p = inst.projs[i];
    if (p.a <= 0) {
      p.flipX = pl.face < 0;
      p.rot = 0;
      continue;
    }
    p.a -= dt;
    // the breath follows its target a little (a sweeping flame, not a frozen cone)
    const t = w.nearestEnemy(p.x, p.y, L + 30);
    if (t) p.ang = approachAngle(p.ang, Math.atan2(t.y - t.cy - p.y, t.x - p.x), 3.2 * dt);
    const right = Math.cos(p.ang) >= 0;
    p.flipX = !right;
    p.rot = right ? p.ang * 0.35 : (p.ang - Math.PI) * 0.35;
    const mx = p.x + Math.cos(p.ang) * 4;
    const my = p.y + Math.sin(p.ang) * 4;
    cone(w, inst, mx, my, p.ang, L, ha, dmg, S.knock, TICK, burnDps, burnT);
  }
}

// ---------------------------------------------------------------- Unsealed Abyss Dragon
/** ABYSSAL LORD'S JUDGEMENT: p.ang = angle, p.a = length, p.target = the judged enemy; the origin follows the first dragon. */
const jetHook: ProjHook = (p, w, dt) => {
  const inst = p.owner;
  const pl = w.player;
  let ox = pl.x;
  let oy = pl.y - 14;
  if (inst && inst.projs.length && inst.projs[0].uid === inst.uids[0] && !inst.projs[0].dead) {
    ox = inst.projs[0].x;
    oy = inst.projs[0].y;
  }
  const t = p.target;
  if (t && !t.dead && t.uid === p.targetUid) p.ang = approachAngle(p.ang, Math.atan2(t.y - t.cy - oy, t.x - ox), 5 * dt);
  p.ox = ox;
  p.oy = oy;
  p.x = ox + Math.cos(p.ang) * p.a * 0.5;
  p.y = oy + Math.sin(p.ang) * p.a * 0.5;
  segmentHits(w, ox, oy, p.ang, p.a, 5, p.dmg, p.owner, CH_MISC, 0.1, 30, p.source, C.violet);
};

export const unsealedAbyssDragon: WeaponDef = {
  id: "unsealed_abyss_dragon",
  name: "Unsealed Abyss Dragon",
  icon: "icon_unsealed_abyss_dragon",
  color: C.violet,
  sfx: "fireball",
  evolved: true,
  desc: "EVOLUTION! The seal breaks: an abyss dragon circles you breathing actually-black flames and passes judgement on the strongest enemy.",
  levels: [{ dmg: 10, cd: 3, amount: 1, len: 64, angle: 26, orbit: 36, burnDps: 10, burn: 4, jetDmg: 30, jetLen: 160, burstDmg: 25 }],
  upgrades: [],
  init(_w, inst) {
    inst.data.spin = 0;
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const L0 = S.L;
    const st = heroesA(w);
    const dk = S.dmg / Math.max(1e-6, L0.dmg);
    st.burnOwner = inst;
    st.burnSource = inst.def.id;
    st.burstDmg = (L0.burstDmg ?? 25) * dk;
    const n = Math.min(MAX_FAMILIARS, S.amount + sequel(w));
    keepFamiliars(w, inst, n, "w_abyss_dragon");
    const pl = w.player;
    const d = inst.data;
    d.spin = ((d.spin ?? 0) + 1.6 * dt) % TAU;
    const R = (L0.orbit ?? 36) * Math.sqrt(S.area);
    const L = (L0.len ?? 64) * S.area;
    const ha = (L0.angle ?? 26) * DEG;
    const burnDps = (L0.burnDps ?? 10) * dk * burnMul(w);
    const burnT = (L0.burn ?? 4) * w.stats.duration;
    const cx = pl.x;
    const cy = pl.y - CFG.playerCy;
    for (let i = 0; i < n; i++) {
      const p = inst.projs[i];
      const a = d.spin + (i / n) * TAU;
      p.x = cx + Math.cos(a) * R;
      p.y = cy + Math.sin(a) * R * 0.8 - 4;
      p.ang = a;
      p.a = 1;
      p.hh = L;
      p.hw = ha;
      p.b = 1;
      // fly along the orbit (tangent), facing where it goes
      p.flipX = -Math.sin(a) < 0;
      p.rot = 0;
      cone(w, inst, p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6, a, L, ha, S.dmg, 14, TICK_EVO, burnDps, burnT);
    }
    // ABYSSAL LORD'S JUDGEMENT on the strongest enemy in view
    inst.timer -= dt;
    if (inst.timer <= 0) {
      const t = strongestInView(w);
      if (!t) inst.timer = 0.25;
      else {
        inst.timer = S.cd;
        const o = inst.projs[0];
        const ox = o ? o.x : cx;
        const oy = o ? o.y : cy;
        const j = w.spawnProjectile(inst);
        j.kind = PK_MANAGED;
        j.r = 0;
        j.ang = Math.atan2(t.y - t.cy - oy, t.x - ox);
        j.a = (L0.jetLen ?? 160) * Math.sqrt(S.area);
        j.target = t;
        j.targetUid = t.uid;
        j.dmg = (L0.jetDmg ?? 30) * dk;
        j.pierce = Infinity;
        j.life = 0.5;
        j.b = BEAM_JET;
        j.ox = ox;
        j.oy = oy;
        j.update = jetHook;
        hfx(w, HFX_KURO_JET, ox, oy, j.ang, 0.5, j.a, 0, t);
        fired(w, inst, ox, oy);
      }
    }
    eyepatch(w, inst, dt);
  },
  dispose(w, inst) {
    killOwned(inst);
    const st = heroesA(w);
    st.burstDmg = 0;
  },
};

export const weapons: WeaponDef[] = [darkFlameDragon, unsealedAbyssDragon];
