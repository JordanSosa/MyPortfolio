/**
 * Paper Crane Flock (general weapon, docs/content/weapons.md §2.10): `amount`
 * origami cranes idle in a loose flock around the hero (each on its own lazy
 * orbit r 18-30, bobbing). Each crane on its own: when its `cd` is ready and an
 * enemy is within `range` x area, it darts at it (`speed`, homing 6 rad/s),
 * hits (`pierce` enemies), then flies back to the flock.
 * Twist - Folded Tighter: each kill folds that crane tighter, +5% damage for
 * that crane (max +50%). Every fold resets when the hero is hurt (the cranes
 * crumple).
 * Evolution: Thousand Crane Wish (+ Wish Charm) - twelve golden cranes; every
 * 1,000 crane kills grants a Wish: a full heal and a 3 s golden crane storm
 * that sweeps the view (every enemy in view takes `stormDmg` once).
 *
 * Cranes are owned PK_MANAGED projectiles (p.a = crane slot) that this file
 * moves every step; they only have a hit circle while darting. Per-crane state
 * lives in a `Flock` per instance (`flockOf`, read by src/view/arsenal2-fx.ts,
 * which draws the cranes: flap, facing, crumple frame, paper trail, fold glow).
 * Storm cranes are plain projectiles (generic sprite drawer) on the weapon's
 * slot channel, so the storm hits each enemy once.
 */
import { CFG } from "../config";
import { PK_MANAGED, ROT_FIXED, type Enemy, type ProjHitHook, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { killOwned, own, prune, wstats, type WStats } from "./_shared";
import { alive } from "./_fx";
import { A2_CRANE_CRUMPLE, A2_CRANE_DART, A2_CRANE_FOLD, A2_WISH, a2fx, keyDmg } from "./_arsenal2";

export const CRANE_MAX = 24;
/** Crane states. */
export const CR_IDLE = 0;
export const CR_DART = 1;
export const CR_RETURN = 2;
/** Folded Tighter: +5% per kill, up to 10 folds (+50%). */
export const FOLD_PER = 0.05;
export const FOLD_MAX = 10;
/** Seconds the cranes stay crumpled (and grounded) after the hero is hurt. */
export const CRUMPLE_T = 0.6;
/** Homing turn rate while darting (rad/s). */
const TURN = 6;
/** Back in the flock within this distance of its slot (at least the return turning radius). */
const ARRIVE = 22;
/** Turn rate flying home (rad/s). */
const RETURN_TURN = 9;
/** A dart gives up after this long and flies home. */
const DART_MAX = 1.4;
/** Wish storm: cranes, waves, seconds. */
export const STORM_CRANES = 60;
const STORM_WAVES = 3;
export const STORM_TIME = 3;

/** Per-instance flock state (typed arrays sized CRANE_MAX; allocated once per instance). */
export class Flock {
  readonly st = new Uint8Array(CRANE_MAX);
  readonly cd = new Float32Array(CRANE_MAX);
  readonly folds = new Uint8Array(CRANE_MAX);
  readonly hits = new Uint8Array(CRANE_MAX);
  readonly dartT = new Float32Array(CRANE_MAX);
  readonly crumple = new Float32Array(CRANE_MAX);
  readonly orbR = new Float32Array(CRANE_MAX);
  readonly orbA = new Float32Array(CRANE_MAX);
  readonly orbW = new Float32Array(CRANE_MAX);
  readonly retry = new Uint8Array(CRANE_MAX);
  readonly tgt: (Enemy | null)[] = new Array<Enemy | null>(CRANE_MAX).fill(null);
  readonly tgtUid = new Int32Array(CRANE_MAX);
  readonly present = new Uint8Array(CRANE_MAX);
  /** World.damageTaken at the last step (a rise = the hero got hurt). */
  hurt = 0;
  /** Thousand Crane Wish: crane kills toward the next Wish, and the storm clock (-1 = none). */
  wish = 0;
  stormT = -1;
  /** Wishes granted this run. */
  wishes = 0;
  constructor(readonly gold: boolean) {}
}

const FLOCKS = new WeakMap<WeaponInstance, Flock>();

/** The flock of a crane weapon instance (the view reads it), or undefined. */
export function flockOf(inst: WeaponInstance): Flock | undefined {
  return FLOCKS.get(inst);
}

const targets: Enemy[] = [];
const slotPt = { x: 0, y: 0 };

function flock(w: World, inst: WeaponInstance): Flock {
  let F = FLOCKS.get(inst);
  if (!F) {
    F = new Flock(!!inst.def.evolved);
    F.hurt = w.damageTaken;
    FLOCKS.set(inst, F);
  }
  return F;
}

/** The crane's idle spot in the flock (loose orbit around the hero's shoulders, bobbing). */
function slotOf(w: World, F: Flock, i: number): { x: number; y: number } {
  const pl = w.player;
  const a = F.orbA[i];
  slotPt.x = pl.x + Math.cos(a) * F.orbR[i];
  slotPt.y = pl.y - 14 + Math.sin(a) * F.orbR[i] * 0.55 + Math.sin(w.t * 3.1 + i * 1.7) * 2;
  return slotPt;
}

function spawnCrane(w: World, inst: WeaponInstance, F: Flock, i: number, n: number, S: WStats): void {
  const p = w.spawnProjectile(inst);
  p.kind = PK_MANAGED;
  p.a = i;
  p.r = 0;
  p.pierce = Infinity;
  p.hitEvery = 0;
  p.life = Infinity;
  p.knock = S.knock;
  p.rotMode = ROT_FIXED;
  // (drawn by src/view/arsenal2-fx.ts: no generic sprite)
  p.sprite = "";
  p.onHit = craneHit;
  F.st[i] = CR_IDLE;
  F.orbR[i] = 18 + w.rng.next() * 12;
  F.orbA[i] = w.rng.angle();
  F.orbW[i] = (w.rng.next() < 0.5 ? -1 : 1) * (0.9 + w.rng.next() * 0.9);
  F.cd[i] = (i / Math.max(1, n)) * S.cd + 0.15;
  F.crumple[i] = 0;
  const s = slotOf(w, F, i);
  p.x = s.x;
  p.y = s.y;
  own(inst, p);
}

/** Keep exactly `n` cranes in slots 0..n-1 (new slots fly in from the hero; folds of a slot persist). */
function ensure(w: World, inst: WeaponInstance, F: Flock, n: number, S: WStats): void {
  prune(inst);
  F.present.fill(0);
  for (let k = 0; k < inst.projs.length; k++) {
    const p = inst.projs[k];
    if (p.a >= n) p.dead = true;
    else F.present[p.a] = 1;
  }
  if (inst.projs.length !== n) {
    prune(inst);
    for (let i = 0; i < n; i++) if (!F.present[i]) spawnCrane(w, inst, F, i, n, S);
  }
}

/** Damage of crane i (base x its folds). */
function craneDmg(F: Flock, i: number, base: number): number {
  return base * (1 + FOLD_PER * F.folds[i]);
}

/** Pick a dart target near the hero that no other darting crane is chasing (else the nearest). */
function pickTarget(w: World, F: Flock, i: number, range: number): Enemy | null {
  const pl = w.player;
  const m = w.nearestEnemies(pl.x, pl.y - 8, range, 8, targets);
  if (m === 0) return null;
  for (let k = 0; k < m; k++) {
    const t = targets[k];
    let taken = false;
    for (let j = 0; j < CRANE_MAX && !taken; j++) if (j !== i && F.st[j] === CR_DART && F.tgt[j] === t) taken = true;
    if (!taken) return t;
  }
  return targets[i % m];
}

function startDart(w: World, inst: WeaponInstance, F: Flock, p: Projectile, t: Enemy, S: WStats): void {
  const i = p.a;
  F.st[i] = CR_DART;
  F.tgt[i] = t;
  F.tgtUid[i] = t.uid;
  F.hits[i] = 0;
  F.dartT[i] = 0;
  F.retry[i] = 0;
  F.cd[i] = S.cd;
  p.nHits = 0;
  p.b = S.dmg;
  p.dmg = craneDmg(F, i, S.dmg);
  p.knock = S.knock;
  p.pierce = Infinity;
  p.r = 5 * Math.min(1.6, S.area);
  const a = Math.atan2(t.y - t.cy - p.y, t.x - p.x);
  // launch with a little upward flick (the cranes "take off" before they dive)
  p.vx = Math.cos(a) * S.speed * 0.8;
  p.vy = Math.sin(a) * S.speed * 0.8 - 30;
  a2fx(w, A2_CRANE_DART, p.x, p.y, t.x, t.y - t.cy);
}

function goHome(F: Flock, p: Projectile): void {
  F.st[p.a] = CR_RETURN;
  F.tgt[p.a] = null;
  p.r = 0;
}

/** Turn velocity toward (tx, ty) at most `turn` rad/s, at `speed`. */
function steer(p: Projectile, tx: number, ty: number, speed: number, turn: number, dt: number): number {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const want = Math.atan2(dy, dx);
  const cur = Math.atan2(p.vy, p.vx);
  let da = want - cur;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const step = turn * dt;
  const na = cur + (da > step ? step : da < -step ? -step : da);
  const sp0 = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  const sp = sp0 + (speed - sp0) * Math.min(1, 6 * dt);
  p.vx = Math.cos(na) * sp;
  p.vy = Math.sin(na) * sp;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  return Math.sqrt(dx * dx + dy * dy);
}

const craneHit: ProjHitHook = (p, w, e) => {
  const inst = p.owner;
  const F = inst ? FLOCKS.get(inst) : undefined;
  if (!inst || !F) return;
  const i = p.a;
  if (e.dead) {
    // Folded Tighter
    if (F.folds[i] < FOLD_MAX) {
      F.folds[i]++;
      p.dmg = craneDmg(F, i, p.b);
      a2fx(w, A2_CRANE_FOLD, p.x, p.y, p.x, p.y, 0, F.folds[i]);
    }
    if (F.gold) F.wish++;
  }
  F.hits[i]++;
  const S = wstats(w, inst);
  if (F.hits[i] >= S.pierce) {
    goHome(F, p);
    return;
  }
  // piercing darts carry on to the next enemy nearby
  const t = w.homingTarget(p, 60);
  if (t) {
    F.tgt[i] = t;
    F.tgtUid[i] = t.uid;
  } else goHome(F, p);
};

/** Storm crane: sweeps across the current view (relative to the hero) after its start delay. */
const stormFly: ProjHook = (p, w) => {
  const pl = w.player;
  const hw = w.viewW * 0.5 + 40;
  const k = Math.max(0, (p.age - p.delay) / Math.max(0.01, p.life - p.delay));
  const dir = p.oy;
  p.x = pl.x + dir * (-hw + k * hw * 2);
  p.y = pl.y - CFG.playerCy + p.ox + Math.sin(p.age * 7 + p.ox) * 3;
  p.flipX = dir < 0;
};

function wishStorm(w: World, inst: WeaponInstance, S: WStats): void {
  const dmg = keyDmg(S, S.L.stormDmg ?? 200);
  const per = Math.ceil(STORM_CRANES / STORM_WAVES);
  const flight = 1.25;
  const step = (STORM_TIME - flight) / (STORM_WAVES - 1);
  const hh = w.viewH * 0.5;
  for (let v = 0; v < STORM_WAVES; v++) {
    const dir = v & 1 ? -1 : 1;
    for (let j = 0; j < per; j++) {
      const p = w.spawnProjectile(inst);
      p.kind = PK_MANAGED;
      // rows evenly spaced over the view height, a little jitter so the wave reads as a flock
      p.ox = -hh + ((j + 0.5) / per) * hh * 2 + (w.rng.next() - 0.5) * 6;
      p.oy = dir;
      p.delay = v * step + w.rng.next() * 0.18;
      p.life = p.delay + flight;
      p.r = 12;
      p.dmg = dmg;
      p.knock = 40;
      p.pierce = Infinity;
      // one hit per enemy for the whole storm (the slot channel's re-hit cooldown)
      p.hitEvery = STORM_TIME + 0.5;
      p.sprite = "w_crane_gold";
      p.fps = 14;
      p.scale = 1.25;
      p.rotMode = ROT_FIXED;
      p.glow = true;
      p.trail = "craneGold";
      p.update = stormFly;
      stormFly(p, w, 0);
    }
  }
}

function step(w: World, inst: WeaponInstance, dt: number): void {
  const S = wstats(w, inst);
  const L = S.L;
  const F = flock(w, inst);
  const n = Math.min(CRANE_MAX, S.amount);
  ensure(w, inst, F, n, S);
  // the hero got hurt: every fold resets and the cranes crumple
  if (w.damageTaken > F.hurt + 1e-6) {
    let had = false;
    for (let i = 0; i < CRANE_MAX; i++) {
      if (F.folds[i] > 0) had = true;
      F.folds[i] = 0;
      F.crumple[i] = CRUMPLE_T;
    }
    for (const p of inst.projs) {
      if (F.st[p.a] === CR_DART) goHome(F, p);
      p.dmg = p.b;
    }
    a2fx(w, A2_CRANE_CRUMPLE, w.player.x, w.player.y - CFG.playerCy, 0, 0, 0, had ? 1 : 0);
  }
  F.hurt = w.damageTaken;
  // Thousand Crane Wish
  if (F.gold) {
    const goal = L.wish ?? 1000;
    inst.data.wish = F.wish;
    inst.data.wishGoal = goal;
    if (F.wish >= goal && F.stormT < 0) {
      F.wish = 0;
      F.wishes++;
      F.stormT = 0;
      inst.data.wish = 0;
      w.heal(w.player.maxHp);
      wishStorm(w, inst, S);
      a2fx(w, A2_WISH, w.player.x, w.player.y - CFG.playerCy, 0, 0, STORM_TIME);
    }
    if (F.stormT >= 0) {
      F.stormT += dt;
      if (F.stormT >= STORM_TIME) F.stormT = -1;
    }
  }
  const range = (L.range ?? 100) * S.area;
  const speed = S.speed;
  for (let k = 0; k < inst.projs.length; k++) {
    const p = inst.projs[k];
    const i = p.a;
    F.cd[i] -= dt;
    if (F.crumple[i] > 0) F.crumple[i] -= dt;
    F.orbA[i] += F.orbW[i] * dt;
    switch (F.st[i]) {
      case CR_IDLE: {
        const s = slotOf(w, F, i);
        const e = 1 - Math.exp(-7 * dt);
        const dx = (s.x - p.x) * e;
        const dy = (s.y - p.y) * e;
        p.x += dx;
        p.y += dy;
        p.vx = dt > 0 ? dx / dt : 0;
        p.vy = dt > 0 ? dy / dt : 0;
        if (F.cd[i] <= 0 && F.crumple[i] <= 0) {
          const t = pickTarget(w, F, i, range);
          if (t) startDart(w, inst, F, p, t, S);
          else F.cd[i] = 0.12;
        }
        break;
      }
      case CR_DART: {
        F.dartT[i] += dt;
        let t = F.tgt[i];
        if (!alive(t, F.tgtUid[i])) {
          // "re-folded" once onto the nearest enemy it has not hit, then home
          t = F.retry[i] ? null : w.homingTarget(p, 70);
          F.retry[i] = 1;
          F.tgt[i] = t;
          F.tgtUid[i] = t ? t.uid : 0;
        }
        if (!t || F.dartT[i] > DART_MAX) {
          goHome(F, p);
          break;
        }
        steer(p, t.x, t.y - t.cy, speed, TURN, dt);
        break;
      }
      default: {
        const s = slotOf(w, F, i);
        const d = steer(p, s.x, s.y, speed * 1.1, RETURN_TURN, dt);
        // (inside its turning circle the idle easing takes over, or it would orbit its slot)
        if (d < Math.max(ARRIVE, (speed * 1.1) / RETURN_TURN + 6)) {
          F.st[i] = CR_IDLE;
          p.r = 0;
        }
        break;
      }
    }
    p.rot = F.st[i] === CR_IDLE ? 0 : Math.atan2(p.vy, p.vx);
  }
}

export const paperCraneFlock: WeaponDef = {
  id: "paper_crane_flock",
  name: "Paper Crane Flock",
  icon: "icon_paper_crane_flock",
  color: 0xffffff,
  sfx: "paperCrane",
  desc: "Origami cranes flutter around you and dart at nearby enemies.",
  levels: [
    { dmg: 9, cd: 1.2, amount: 3, speed: 170, range: 100, pierce: 1, knock: 25 },
    { dmg: 9, cd: 1.2, amount: 4, speed: 170, range: 100, pierce: 1, knock: 25 },
    { dmg: 12, cd: 1.2, amount: 4, speed: 180, range: 115, pierce: 1, knock: 25 },
    { dmg: 12, cd: 1.0, amount: 5, speed: 180, range: 115, pierce: 1, knock: 28 },
    { dmg: 15, cd: 1.0, amount: 6, speed: 190, range: 115, pierce: 2, knock: 30 },
  ],
  upgrades: ["+1 crane", "Damage +3, wider patrol", "+1 crane, darts more often", "Damage +3, +1 crane, darts pierce 2"],
  evolution: { into: "thousand_crane_wish", with: "wish_charm" },
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { amount: 1, dmg: 0.1, text: "LIMIT BREAK — Another Fold: +1 crane, +10% damage" },
    { amount: 1, dmg: 0.2, text: "MASTERED — Origami Master: +1 crane, +20% damage" },
  ],
  update: step,
  dispose(_w, inst) {
    killOwned(inst);
    FLOCKS.delete(inst);
  },
};

export const thousandCraneWish: WeaponDef = {
  id: "thousand_crane_wish",
  name: "Thousand Crane Wish",
  icon: "icon_thousand_crane_wish",
  color: 0xffd34d,
  sfx: "paperCrane",
  evolved: true,
  desc: "EVOLUTION! Twelve golden cranes. Every 1,000 crane kills grants a Wish: a full heal and a golden crane storm.",
  levels: [{ dmg: 22, cd: 0.7, amount: 12, speed: 210, range: 130, pierce: 3, knock: 30, wish: 1000, stormDmg: 200 }],
  upgrades: [],
  update: step,
  dispose(_w, inst) {
    killOwned(inst);
    FLOCKS.delete(inst);
  },
};

export const weapons: WeaponDef[] = [paperCraneFlock, thousandCraneWish];
