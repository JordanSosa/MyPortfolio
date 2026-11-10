/**
 * Kotatsu of Sloth (general weapon, docs/content/weapons.md §2.12). Standing
 * still (move input < 0.1, not dashing) for `deploy` s deploys a kotatsu at
 * the hero's feet: an aura r `radius` x area (+8% per extra Amount) that slows
 * enemies (x`slow`) and hits them for `dmg` every `cd` s; the hero inside gains
 * `armor` armor and `regen` HP/s. Moving folds it into a small travelling aura
 * (r 18, slows 20%, no damage).
 * Twist - Too Comfy: after `comfy` s standing still the hero dozes off: every
 * weapon (the kotatsu included) stops dealing damage (World.dozing), the aura
 * grows x1.5, its slow becomes x0.3, regen x3, Zzz. Moving wakes up instantly.
 * That is the "Pacifist?" route (RunStats.pacifistBest counts it by itself);
 * RunStats.comfyBest = the longest Too Comfy stretch.
 * Lv5: enemies inside for 3 s fall asleep (dazed) and take +25% damage.
 * Evolution: Eternal Winter Break (+ Chibi Charm) - always deployed and moves
 * with the hero (r 48 and x0.6 damage while moving), pulls in gems, and when
 * Too Comfy (after 3 s) the aura grows x1.5 and hits x3 - weapons keep firing -
 * while mikan are lobbed at random enemies in view.
 * Second evolution: All-You-Can-Eat Nabe (+ Bento Box) - deploys like the base weapon (stand still
 * `deploy` s) with a hot pot: r `radius` x area, enemies inside are slowed (x`slow`) and COOKED: `dmg`
 * every `cd` s, +`cook` per second each has stayed inside (max +`cookMax`); every `snackEvery`-th enemy
 * that dies inside (to anything) drops a snack (heals `snackHeal`). Moving folds it at once: nothing
 * travels with the hero, and there is no Too Comfy doze on this route. The view (src/view/evo2/d.ts)
 * draws w_nabe from the same `Kotatsu` state.
 *
 * No projectiles for the aura (mikan are PK_FALL lobs): the state lives in a
 * `Kotatsu` per instance (`kotatsuOf`, read by src/view/arsenal2-fx.ts, which
 * draws w_kotatsu / w_kotatsu_evo, the aura and the Zzz). The armor / regen is
 * a World.statMods entry installed with the weapon and removed on dispose.
 */
import { CFG } from "../config";
import type { StatMod } from "../stats";
import { PK_FALL, ROT_SPIN, type Enemy, type ProjHook, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { wstats, type WStats } from "./_shared";
import { A2_KOTATSU_COMFY, A2_KOTATSU_DEPLOY, A2_KOTATSU_FOLD, A2_KOTATSU_SNORE, A2_KOTATSU_WAKE, A2_MIKAN, A2_SLEEP, a2fx, dropStatMod, keyDmg } from "./_arsenal2";
import { daze, dropSnack, slowEnemy } from "./_heroes-a";

const NABE = "all_you_can_eat_nabe";
/** Folded (travelling) aura: radius, slow. */
export const FOLDED_R = 18;
const FOLDED_SLOW = 0.8;
/** Too Comfy: aura x1.5, slow x0.3, regen x3. */
export const COMFY_AURA = 1.5;
const COMFY_SLOW = 0.3;
const COMFY_REGEN = 3;
/** Lv5: seconds inside before an enemy falls asleep, and the damage it then takes. */
export const SLEEP_AFTER = 3;
const SLEEP_DMG = 1.25;
/** Eternal Winter Break while moving: aura radius, damage factor. */
export const EVO_MOVING_R = 48;
const EVO_MOVING_DMG = 0.6;
const EVO_COMFY_DMG = 3;
const SNORE_EVERY = 2.4;

/** Per-instance kotatsu state (the view reads it). */
export class Kotatsu {
  /** Seconds standing still. */
  still = 0;
  deployed = false;
  comfy = false;
  /** Current Too Comfy stretch (s). */
  comfyT = 0;
  /** Kotatsu position (feet). */
  x = 0;
  y = 0;
  /** Aura radius now (for the view). */
  r = 0;
  /** The hero stands inside the aura (armor / regen apply). */
  heroIn = false;
  armor = 0;
  regen = 0;
  mikanT = 0;
  snoreT = 0;
  /** Lv5: seconds each enemy (uid) has been inside; swapped every step. */
  inside = new Map<number, number>();
  private next = new Map<number, number>();
  mod: StatMod | null = null;
  /** All-You-Can-Eat Nabe: enemies that died inside so far, and the hottest cook bonus this step (0..cookMax). */
  eaten = 0;
  heat = 0;
  constructor(readonly evo: boolean) {}

  /** Swap the inside-time maps (the old "next" is cleared for this step). */
  swap(): Map<number, number> {
    const n = this.next;
    n.clear();
    this.next = this.inside;
    this.inside = n;
    return this.next;
  }
}

/** Per-world asleep set + the dmgTaken rule (installed once). */
interface SleepBook {
  asleep: Set<number>;
}
const SLEEP = new WeakMap<World, SleepBook>();
function sleepBook(w: World): SleepBook {
  let b = SLEEP.get(w);
  if (!b) {
    const book: SleepBook = { asleep: new Set<number>() };
    b = book;
    SLEEP.set(w, book);
    w.dmgTaken.push((e) => (book.asleep.size > 0 && book.asleep.has(e.uid) ? SLEEP_DMG : 1));
  }
  return b;
}

/** Enemy uids asleep in a kotatsu this step (the view draws Zzz over them). */
export function asleepIn(w: World): ReadonlySet<number> | undefined {
  return SLEEP.get(w)?.asleep;
}

const STATES = new WeakMap<WeaponInstance, Kotatsu>();

/** The kotatsu state of a weapon instance, or undefined. */
export function kotatsuOf(inst: WeaponInstance): Kotatsu | undefined {
  return STATES.get(inst);
}

function state(w: World, inst: WeaponInstance): Kotatsu {
  let K = STATES.get(inst);
  if (!K) {
    const k = new Kotatsu(!!inst.def.evolved);
    K = k;
    k.x = w.player.x;
    k.y = w.player.y;
    // armor / regen while the hero is inside (read live; the update marks the stats dirty on change)
    k.mod = (s) => {
      if (!k.heroIn) return;
      s.armor += k.armor;
      s.regen += k.regen;
    };
    w.statMods.push(k.mod);
    w.statsDirty = true;
    STATES.set(inst, k);
  }
  return K;
}

/** Move input below 0.1 and not dashing. */
function standingStill(w: World): boolean {
  const i = w.input;
  return i.mx * i.mx + i.my * i.my < 0.01 && w.player.dashT <= 0;
}

/** Set the hero's armor / regen bonus (stats recompute only when it changes). */
function setBonus(w: World, K: Kotatsu, inside: boolean, armor: number, regen: number): void {
  if (K.heroIn === inside && K.armor === armor && K.regen === regen) return;
  K.heroIn = inside;
  K.armor = armor;
  K.regen = regen;
  w.statsDirty = true;
}

function wake(w: World, K: Kotatsu): void {
  if (!K.comfy) return;
  a2fx(w, A2_KOTATSU_WAKE, w.player.x, w.player.y - CFG.playerCy - 10, 0, 0, K.comfyT, K.evo ? 1 : 0);
  K.comfy = false;
  K.comfyT = 0;
  if (!K.evo) w.dozing = false;
}

function clearSleep(w: World, K: Kotatsu): void {
  K.inside.clear();
  SLEEP.get(w)?.asleep.clear();
}

/**
 * Slow + tick everything inside radius R around (cx, cy). dmg <= 0 = no damage.
 * Lv5 (`sleepy`): count each enemy's time inside; after SLEEP_AFTER s it is dazed and marked asleep.
 */
function aura(w: World, inst: WeaponInstance, K: Kotatsu, cx: number, cy: number, R: number, slow: number, dmg: number, tick: number, knock: number, sleepy: boolean, dt: number): void {
  const ch = inst.slot;
  const now = w.t;
  const id = inst.def.id;
  const color = inst.def.color;
  const prev = sleepy ? K.swap() : null;
  const book = sleepy ? sleepBook(w) : null;
  if (book) book.asleep.clear();
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 14, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]] as Enemy | undefined;
    if (!e || e.dead || e.def.prop) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy * 0.5 - cy;
    const rr = R + e.r * 0.5;
    if (dx * dx + dy * dy > rr * rr) continue;
    slowEnemy(e, slow, 0.25);
    if (prev && book) {
      const t = (prev.get(e.uid) ?? 0) + dt;
      K.inside.set(e.uid, t);
      if (t >= SLEEP_AFTER && !e.def.boss) {
        if (t - dt < SLEEP_AFTER) a2fx(w, A2_SLEEP, e.x, e.y - e.cy * 2 - 4);
        daze(e, 0.3);
        book.asleep.add(e.uid);
      }
    }
    if (dmg <= 0 || now - e.lastHit[ch] < tick) continue;
    e.lastHit[ch] = now;
    w.hitEnemy(e, dmg, inst, Math.atan2(dy, dx), knock, 0, id, color);
  }
  w.release();
}

// ---------------------------------------------------------------- mikan (Eternal Winter Break)
const HAND_Z = 10;
/** Parabolic lob (the world integrates z; onEnd lands it). Scratch: b = flight time, ang = apex. */
const lobArc: ProjHook = (p, _w, dt) => {
  const k = p.age / p.b;
  const z = k >= 1 ? -1 : HAND_Z * (1 - k) + 4 * p.ang * k * (1 - k);
  p.vz = (z - p.z) / Math.max(dt, 1e-4);
};
const mikanLand: ProjHook = (p, w) => {
  const buf = w.acquire();
  const n = w.grid.query(p.x, p.y, p.r + 20, buf);
  const items = w.enemies.items;
  const owner = p.owner;
  const color = owner ? owner.def.color : 0xff9a3c;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - e.cy - p.y;
    const rr = p.r + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    w.hitEnemy(e, p.dmg, owner, Math.atan2(dy, dx), p.knock, 0, p.source, color);
  }
  w.release();
  a2fx(w, A2_MIKAN, p.x, p.y, p.x, p.y, p.r);
};

function lobMikan(w: World, inst: WeaponInstance, S: WStats): void {
  const t = w.randomEnemyInView(-10);
  if (!t) return;
  const pl = w.player;
  const sx = pl.x;
  const sy = pl.y - 12;
  const tx = t.x;
  const ty = t.y - t.cy * 0.5;
  const dist = Math.hypot(tx - sx, ty - sy);
  const T = 0.42 + Math.min(0.35, dist / 420);
  const p = w.spawnProjectile(inst);
  p.kind = PK_FALL;
  p.x = sx;
  p.y = sy;
  p.vx = (tx - sx) / T;
  p.vy = (ty - sy) / T;
  p.z = HAND_Z;
  p.b = T;
  p.ang = 26 + Math.min(40, dist * 0.18);
  p.life = T + 0.5;
  p.r = 12 * S.area;
  p.dmg = keyDmg(S, S.L.mikanDmg ?? 20);
  p.knock = 40;
  p.sprite = "w_mikan";
  p.fps = 8;
  p.rotMode = ROT_SPIN;
  p.spin = w.rng.spread(9);
  p.shadow = 6;
  p.update = lobArc;
  p.onEnd = mikanLand;
}

/** Eternal Winter Break: gems within `R` drift in. */
function pullGems(w: World, R: number): void {
  const pl = w.player;
  const r2 = R * R;
  for (let g = 0; g < w.gems.count; g++) {
    const gem = w.gems.items[g];
    if (gem.dead || gem.state !== 0) continue;
    const dx = gem.x - pl.x;
    const dy = gem.y - pl.y;
    if (dx * dx + dy * dy < r2) {
      gem.state = 1;
      gem.speed = 45;
    }
  }
}

// ---------------------------------------------------------------- update
function comfyClock(w: World, inst: WeaponInstance, K: Kotatsu, comfyAfter: number, dt: number): void {
  const pl = w.player;
  if (!K.comfy && K.still >= comfyAfter) {
    K.comfy = true;
    K.comfyT = 0;
    K.snoreT = 0.9;
    if (!K.evo) w.dozing = true;
    a2fx(w, A2_KOTATSU_COMFY, pl.x, pl.y - CFG.playerCy - 12, 0, 0, 0, K.evo ? 1 : 0);
  }
  if (!K.comfy) return;
  K.comfyT += dt;
  w.bumpStat("comfyBest", K.comfyT);
  K.snoreT -= dt;
  if (K.snoreT <= 0) {
    K.snoreT = SNORE_EVERY;
    a2fx(w, A2_KOTATSU_SNORE, pl.x + 6, pl.y - CFG.playerCy - 14, 0, 0, 0, K.evo ? 1 : 0);
  }
  void inst;
}

function kotatsu(w: World, inst: WeaponInstance, dt: number): void {
  const S = wstats(w, inst);
  const L = S.L;
  const K = state(w, inst);
  const pl = w.player;
  const still = standingStill(w);
  if (still) K.still += dt;
  else {
    wake(w, K);
    if (K.deployed) {
      K.deployed = false;
      clearSleep(w, K);
      a2fx(w, A2_KOTATSU_FOLD, K.x, K.y);
    }
    K.still = 0;
  }
  if (!K.deployed && still && K.still >= (L.deploy ?? 0.6)) {
    K.deployed = true;
    K.x = pl.x;
    K.y = pl.y;
    a2fx(w, A2_KOTATSU_DEPLOY, K.x, K.y);
  }
  if (K.deployed) comfyClock(w, inst, K, L.comfy ?? 5, dt);
  const extra = Math.max(0, S.amount - 1);
  const base = (L.radius ?? 40) * S.area * (1 + 0.08 * extra);
  if (!K.deployed) {
    K.x = pl.x;
    K.y = pl.y;
    K.r = FOLDED_R * Math.sqrt(Math.max(1, S.area));
    setBonus(w, K, false, 0, 0);
    aura(w, inst, K, pl.x, pl.y - 6, K.r, FOLDED_SLOW, 0, 1, 0, false, dt);
    return;
  }
  const R = K.comfy ? base * COMFY_AURA : base;
  K.r = R;
  const hx = pl.x - K.x;
  const hy = pl.y - K.y;
  setBonus(w, K, hx * hx + hy * hy <= R * R, L.armor ?? 1, (L.regen ?? 0.5) * (K.comfy ? COMFY_REGEN : 1));
  // (Too Comfy: nothing deals damage, the kotatsu included - skip the hits, keep the slow)
  aura(w, inst, K, K.x, K.y - 6, R, K.comfy ? COMFY_SLOW : (L.slow ?? 0.6), K.comfy ? 0 : S.dmg, Math.max(0.15, S.cd), S.knock, (L.sleep ?? 0) > 0, dt);
}

function winterBreak(w: World, inst: WeaponInstance, dt: number): void {
  const S = wstats(w, inst);
  const L = S.L;
  const K = state(w, inst);
  const pl = w.player;
  const still = standingStill(w);
  if (still) K.still += dt;
  else {
    wake(w, K);
    K.still = 0;
  }
  if (!K.deployed) {
    K.deployed = true;
    a2fx(w, A2_KOTATSU_DEPLOY, pl.x, pl.y, pl.x, pl.y, 0, 1);
  }
  // always deployed, carried along
  K.x = pl.x;
  K.y = pl.y;
  if (still) comfyClock(w, inst, K, L.comfy ?? 3, dt);
  const base = (L.radius ?? 64) * S.area;
  const R = !still ? EVO_MOVING_R * S.area : K.comfy ? base * COMFY_AURA : base;
  const dmgK = !still ? EVO_MOVING_DMG : K.comfy ? EVO_COMFY_DMG : 1;
  K.r = R;
  setBonus(w, K, true, L.armor ?? 2, L.regen ?? 1.5);
  aura(w, inst, K, K.x, K.y - 6, R, L.slow ?? 0.4, S.dmg * dmgK, Math.max(0.15, S.cd), S.knock, false, dt);
  pullGems(w, L.gemPull ?? 120);
  if (K.comfy) {
    K.mikanT -= dt;
    if (K.mikanT <= 0) {
      K.mikanT += Math.max(0.15, (L.mikanEvery ?? 0.5) * (S.cd / (L.cd || 1)));
      lobMikan(w, inst, S);
    }
  } else K.mikanT = 0;
}

function dispose(w: World, inst: WeaponInstance): void {
  const K = STATES.get(inst);
  if (!K) return;
  if (K.comfy && !K.evo) w.dozing = false;
  clearSleep(w, K);
  dropStatMod(w, K.mod ?? undefined);
  K.mod = null;
  STATES.delete(inst);
}

export const kotatsuOfSloth: WeaponDef = {
  id: "kotatsu_of_sloth",
  name: "Kotatsu of Sloth",
  icon: "icon_kotatsu_of_sloth",
  color: 0xff9a3c,
  sfx: "snore",
  desc: "Stand still and a kotatsu appears: a cosy aura that slows and lulls enemies. Stay too long and you get Too Comfy.",
  levels: [
    // (weapon bench pass, docs/content/weapons.md section 9: dmg was 4 / 5 / 5 / 7 / 9, regen 0.5 / 0.5 / 1 / 1 / 1, armor 1 / 1 / 1 / 2 / 2)
    { dmg: 5, cd: 0.5, amount: 1, radius: 40, slow: 0.6, deploy: 0.6, armor: 1, regen: 0.5, comfy: 5, knock: 0 },
    { dmg: 7, cd: 0.5, amount: 1, radius: 44, slow: 0.6, deploy: 0.6, armor: 1, regen: 1.0, comfy: 5, knock: 0 },
    { dmg: 9, cd: 0.5, amount: 1, radius: 44, slow: 0.5, deploy: 0.6, armor: 2, regen: 1.5, comfy: 5, knock: 0 },
    { dmg: 15, cd: 0.5, amount: 1, radius: 44, slow: 0.5, deploy: 0.4, armor: 2, regen: 2.0, comfy: 5, knock: 0 },
    { dmg: 28, cd: 0.5, amount: 1, radius: 52, slow: 0.5, deploy: 0.4, armor: 3, regen: 2.5, comfy: 5, knock: 0, sleep: 1 },
  ],
  upgrades: ["Damage +2, bigger blanket, more regen", "Cosier: damage +2, stronger slow, more regen, +1 armor inside", "Damage +6, deploys faster, more regen", "Damage +13, bigger, +1 armor; enemies inside 3 s fall asleep and take +25% damage"],
  evolutions: [
    { into: "eternal_winter_break", with: "chibi_charm" },
    { into: NABE, with: "bento_box" },
  ],
  // mastery Limit Breaks (docs/content/weapons.md §4): a Limit Break amount = +8% radius
  limitBreak: [
    { area: 0.2, dmg: 0.15, text: "LIMIT BREAK — Bigger Blanket: +20% area, +15% damage" },
    { dmg: 0.3, cd: 0.85, text: "MASTERED — Professional Napper: +30% damage, ticks 15% faster" },
  ],
  update: kotatsu,
  dispose,
};

export const eternalWinterBreak: WeaponDef = {
  id: "eternal_winter_break",
  name: "Eternal Winter Break",
  icon: "icon_eternal_winter_break",
  color: 0xff9a3c,
  sfx: "snore",
  evolved: true,
  desc: "EVOLUTION! The kotatsu comes with you, pulls in gems, and lobs mikan when you get Too Comfy.",
  levels: [{ dmg: 24, cd: 0.4, amount: 1, radius: 64, slow: 0.4, armor: 3, regen: 3, comfy: 3, gemPull: 120, mikanEvery: 0.5, mikanDmg: 20, knock: 0 }],
  upgrades: [],
  update: winterBreak,
  dispose,
};

// ---------------------------------------------------------------- All-You-Can-Eat Nabe
/** heroFx cue (src/view/evo2/d.ts): the nabe served a snack at (x, y). */
export const NABE_SNACK = "evo2d_snack";
const NABE_WORLDS = new WeakSet<World>();

/** Count what dies inside a deployed nabe (once per world; the hook reads the live instance). */
function nabeKills(w: World): void {
  if (NABE_WORLDS.has(w)) return;
  NABE_WORLDS.add(w);
  w.hooks.on("kill", (k) => {
    const inst = w.hasWeapon(NABE);
    const K = inst && STATES.get(inst);
    if (!inst || !K || !K.deployed || k.boss || k.enemy.def.prop) return;
    const dx = k.x - K.x;
    const dy = k.y - (K.y - 6);
    const rr = K.r + 8;
    if (dx * dx + dy * dy > rr * rr) return;
    const L = inst.def.levels[0];
    if (++K.eaten % Math.max(1, L.snackEvery ?? 12) !== 0) return;
    dropSnack(w, "w_mikan", k.x, k.y, L.snackHeal ?? 4);
    a2fx(w, NABE_SNACK, k.x, k.y);
  });
}

function nabe(w: World, inst: WeaponInstance, dt: number): void {
  const S = wstats(w, inst);
  const L = S.L;
  const K = state(w, inst);
  const pl = w.player;
  if (standingStill(w)) K.still += dt;
  else {
    K.still = 0;
    if (K.deployed) {
      K.deployed = false;
      K.inside.clear();
      K.heat = 0;
      a2fx(w, A2_KOTATSU_FOLD, K.x, K.y);
    }
  }
  if (!K.deployed) {
    // folded: nothing travels with her
    K.x = pl.x;
    K.y = pl.y;
    K.r = 0;
    setBonus(w, K, false, 0, 0);
    if (K.still < (L.deploy ?? 0.4)) return;
    K.deployed = true;
    a2fx(w, A2_KOTATSU_DEPLOY, K.x, K.y, K.x, K.y, 0, 1);
  }
  const R = (L.radius ?? 80) * S.area * (1 + 0.08 * Math.max(0, S.amount - 1));
  K.r = R;
  const hx = pl.x - K.x;
  const hy = pl.y - K.y;
  setBonus(w, K, hx * hx + hy * hy <= R * R, L.armor ?? 2, L.regen ?? 1);
  // slow + cook: each enemy's seconds inside raise its own damage
  const cx = K.x;
  const cy = K.y - 6;
  const ch = inst.slot;
  const now = w.t;
  const tick = Math.max(0.12, S.cd);
  const rate = L.cook ?? 0.25;
  const cap = L.cookMax ?? 2;
  const slow = L.slow ?? 0.7;
  const prev = K.swap();
  let heat = 0;
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 14, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]] as Enemy | undefined;
    if (!e || e.dead || e.def.prop) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy * 0.5 - cy;
    const rr = R + e.r * 0.5;
    if (dx * dx + dy * dy > rr * rr) continue;
    slowEnemy(e, slow, 0.25);
    const t = (prev.get(e.uid) ?? 0) + dt;
    K.inside.set(e.uid, t);
    const bonus = Math.min(cap, rate * t);
    if (bonus > heat) heat = bonus;
    if (now - e.lastHit[ch] < tick) continue;
    e.lastHit[ch] = now;
    w.hitEnemy(e, S.dmg * (1 + bonus), inst, Math.atan2(dy, dx), S.knock, 0, NABE, inst.def.color);
  }
  w.release();
  K.heat = heat;
}

export const allYouCanEatNabe: WeaponDef = {
  id: NABE,
  name: "All-You-Can-Eat Nabe",
  icon: "icon_all_you_can_eat_nabe",
  color: 0xff9a3c,
  evolved: true,
  desc: "EVOLUTION! The kotatsu gets a hot pot. Whatever wanders in gets cooked. Whatever gets cooked is dinner.",
  levels: [{ dmg: 24, cd: 0.3, amount: 1, radius: 80, slow: 0.7, deploy: 0.4, cook: 0.25, cookMax: 2, snackEvery: 12, snackHeal: 4, armor: 2, regen: 1, knock: 0 }],
  upgrades: [],
  init(w) {
    nabeKills(w);
  },
  update: nabe,
  dispose,
};

export const weapons: WeaponDef[] = [kotatsuOfSloth, eternalWinterBreak, allYouCanEatNabe];
