/**
 * A Real Friend (MYTHIC relic, docs/content/relics.md "A Real Friend - behaviour"):
 * a non-targetable ally that follows the hero on a lagged path 24-40 px behind
 * and fights with a second instance of the hero's start weapon (same level,
 * evolves when the hero's does), firing from its own position at X % damage.
 * Kills credit the start weapon (same source id: RunStats, mastery).
 *
 * How a weapon written for the hero fires from somewhere else: while the
 * Friend's instance updates - and while any projectile it owns runs its hooks -
 * the hero's position (and the state a weapon may touch: i-frames, shields,
 * timed buffs) is swapped to the Friend and restored right after ("sandbox").
 * Projectiles that follow the hero (PK_ATTACHED) are re-anchored to the Friend.
 * Hook wrappers are module-scope functions with one reused record per pooled
 * projectile object: nothing is allocated per frame or per shot.
 *
 * No `relics` export: the registry ignores this file (mythic.ts installs it).
 */
import { CFG, MAX_WEAPON_SLOTS } from "../config";
import { PK_ATTACHED, PK_MANAGED, type Enemy, type ProjHitHook, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { proc } from "./_util";

/** Player-position history length (steps) and the lag the Friend walks behind (steps). */
const HIST = 48;
const LAG = 20;
/** Distance band to the hero (px). */
const NEAR = 24;
const FAR = 40;

export interface Friend {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 right, -1 left. */
  face: number;
  moving: boolean;
  /** Seconds of the cast / cheer pose left (the hero's Overdrive). */
  castT: number;
  /** Seconds since the Friend joined (spawn-in sparkle). */
  t: number;
  /** Damage share (X / 100). */
  k: number;
  /** The Friend's weapon instance (not in world.weapons: no slot, no HUD, no cards). */
  inst: WeaponInstance | null;
  /** The hero's start weapon id and its evolution id (resolved on the first step). */
  base: string;
  evo: string;
  readonly hx: Float32Array;
  readonly hy: Float32Array;
  head: number;
  filled: number;
}

interface Wrap {
  uid: number;
  u: ProjHook | null;
  h: ProjHitHook | null;
  e: ProjHook | null;
  att: boolean;
}

const friends = new WeakMap<World, Friend>();
/** One reused record per pooled projectile object (keyed by object, validated by uid). */
const wraps = new WeakMap<Projectile, Wrap>();

/** The run's Friend for the view, or null (no A Real Friend equipped). */
export function friendOf(w: World): Friend | null {
  return friends.get(w) ?? null;
}

// ---------------------------------------------------------------- sandbox
/** Saved hero state while the Friend's weapon acts (one per world is enough: never nested). */
const SAVE = { x: 0, y: 0, vx: 0, vy: 0, face: 1, iframes: 0, dashInv: 0, shield: 0, shieldT: 0, depth: 0 };
let buffT = new Float64Array(16);

function enter(w: World, f: Friend): void {
  if (SAVE.depth++ > 0) return;
  const p = w.player;
  SAVE.x = p.x;
  SAVE.y = p.y;
  SAVE.vx = p.vx;
  SAVE.vy = p.vy;
  SAVE.face = p.face;
  SAVE.iframes = p.iframes;
  SAVE.dashInv = p.dashInv;
  SAVE.shield = p.shield;
  SAVE.shieldT = p.shieldT;
  const b = w.buffs;
  if (buffT.length < b.length) buffT = new Float64Array(b.length * 2);
  for (let i = 0; i < b.length; i++) buffT[i] = b[i].t;
  p.x = f.x;
  p.y = f.y;
  p.vx = f.vx;
  p.vy = f.vy;
  p.face = f.face;
}

function leave(w: World): void {
  if (--SAVE.depth > 0) return;
  const p = w.player;
  p.x = SAVE.x;
  p.y = SAVE.y;
  p.vx = SAVE.vx;
  p.vy = SAVE.vy;
  p.face = SAVE.face;
  // (a weapon that buffs its wielder - a henshin's i-frames and slow, a shield charge - buffs the Friend, not the hero)
  p.iframes = SAVE.iframes;
  p.dashInv = SAVE.dashInv;
  p.shield = SAVE.shield;
  p.shieldT = SAVE.shieldT;
  const b = w.buffs;
  for (let i = 0; i < b.length && i < buffT.length; i++) {
    if (b[i].t !== buffT[i]) {
      b[i].t = buffT[i];
      w.statsDirty = true;
    }
  }
}

// ---------------------------------------------------------------- projectile hook wrappers
function fUpdate(p: Projectile, w: World, dt: number): void {
  const f = friends.get(w);
  const r = wraps.get(p);
  if (!f || !r || r.uid !== p.uid) return;
  enter(w, f);
  try {
    if (r.u) {
      r.u(p, w, dt);
      // (a hook may swap itself for its next phase: keep wrapping the new one)
      if (p.update !== fUpdate) {
        r.u = p.update;
        p.update = fUpdate;
      }
    }
    if (r.att) {
      p.x = f.x + p.ox;
      p.y = f.y + p.oy;
    }
  } finally {
    leave(w);
  }
}

function fHit(p: Projectile, w: World, e: Enemy): void {
  const f = friends.get(w);
  const r = wraps.get(p);
  if (!f || !r || r.uid !== p.uid || !r.h) return;
  enter(w, f);
  try {
    r.h(p, w, e);
  } finally {
    leave(w);
  }
}

function fEnd(p: Projectile, w: World, dt: number): void {
  const f = friends.get(w);
  const r = wraps.get(p);
  if (!f || !r || r.uid !== p.uid || !r.e) return;
  enter(w, f);
  try {
    r.e(p, w, dt);
  } finally {
    leave(w);
  }
}

/** Wrap every projectile the Friend's instance owns whose hooks are not wrapped yet. */
function wrapOwned(w: World, inst: WeaponInstance): void {
  const items = w.projectiles.items;
  for (let i = 0; i < w.projectiles.count; i++) {
    const p = items[i];
    if (p.dead || p.owner !== inst) continue;
    let r = wraps.get(p);
    if (!r) {
      r = { uid: 0, u: null, h: null, e: null, att: false };
      wraps.set(p, r);
    }
    if (r.uid !== p.uid) {
      r.uid = p.uid;
      r.u = null;
      r.h = null;
      r.e = null;
      r.att = p.kind === PK_ATTACHED;
      if (r.att) p.kind = PK_MANAGED;
    }
    if (p.update !== fUpdate) {
      r.u = p.update;
      if (r.u || r.att) p.update = fUpdate;
    }
    if (p.onHit && p.onHit !== fHit) {
      r.h = p.onHit;
      p.onHit = fHit;
    }
    if (p.onEnd && p.onEnd !== fEnd) {
      r.e = p.onEnd;
      p.onEnd = fEnd;
    }
  }
}

/** End the Friend's instance (evolution swap): its projectiles go with it. */
function retire(w: World, f: Friend): void {
  const old = f.inst;
  if (!old) return;
  enter(w, f);
  try {
    old.def.dispose?.(w, old);
  } finally {
    leave(w);
  }
  const items = w.projectiles.items;
  for (let i = 0; i < w.projectiles.count; i++) if (items[i].owner === old) items[i].dead = true;
  f.inst = null;
}

function equip(w: World, f: Friend, def: WeaponDef, of: WeaponInstance): void {
  retire(w, f);
  // its own re-hit channel when the build leaves one free (an aura of each never blocks the other)
  const slot = w.weaponSlots < MAX_WEAPON_SLOTS ? MAX_WEAPON_SLOTS - 1 : of.slot;
  const inst: WeaponInstance = { def, level: of.level, slot, timer: 0.35, t: 0, projs: [], uids: [], data: {}, damage: 0, kills: 0, dmgMul: (of.dmgMul ?? 1) * f.k };
  f.inst = inst;
  enter(w, f);
  try {
    def.init?.(w, inst);
  } finally {
    leave(w);
  }
}

// ---------------------------------------------------------------- install
/** Bring the Friend into the run (A Real Friend, `k` = damage share). */
export function installFriend(w: World, k: number): Friend {
  const f: Friend = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    face: 1,
    moving: false,
    castT: 0,
    t: 0,
    k,
    inst: null,
    base: "",
    evo: "",
    hx: new Float32Array(HIST),
    hy: new Float32Array(HIST),
    head: 0,
    filled: 0,
  };
  friends.set(w, f);
  let started = false;
  w.hooks.on("step", (h) => {
    const dt = h.dt;
    const p = w.player;
    if (!started) {
      started = true;
      f.x = p.x - 26;
      f.y = p.y + 4;
      const start = w.hasWeapon(w.startWeapon);
      f.base = w.startWeapon;
      f.evo = start?.def.evolution?.into ?? "";
      proc(w, "real_friend", f.x, f.y - CFG.playerCy, 0);
    }
    f.t += dt;
    f.castT = Math.max(0, f.castT - dt);
    // ---- follow on a lagged path, 24-40 px from the hero
    f.hx[f.head] = p.x;
    f.hy[f.head] = p.y;
    f.head = (f.head + 1) % HIST;
    if (f.filled < HIST) f.filled++;
    const lag = Math.min(LAG, f.filled - 1);
    const j = (f.head - 1 - lag + HIST * 2) % HIST;
    let tx = f.hx[j];
    let ty = f.hy[j];
    let dx = tx - p.x;
    let dy = ty - p.y;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d < NEAR + 4) {
      // the hero stands still (or doubles back): keep a polite gap on the Friend's side
      let ax = f.x - p.x;
      let ay = f.y - p.y;
      const al = Math.sqrt(ax * ax + ay * ay);
      if (al < 0.5) {
        ax = -1;
        ay = 0.2;
      } else {
        ax /= al;
        ay /= al;
      }
      tx = p.x + ax * (NEAR + 4);
      ty = p.y + ay * (NEAR + 4);
    }
    const ox = f.x;
    const oy = f.y;
    const kk = Math.min(1, dt * 7);
    f.x += (tx - f.x) * kk;
    f.y += (ty - f.y) * kk;
    dx = f.x - p.x;
    dy = f.y - p.y;
    d = Math.sqrt(dx * dx + dy * dy);
    if (d > FAR) {
      f.x = p.x + (dx / d) * FAR;
      f.y = p.y + (dy / d) * FAR;
    }
    f.vx = dt > 0 ? (f.x - ox) / dt : 0;
    f.vy = dt > 0 ? (f.y - oy) / dt : 0;
    f.moving = f.vx * f.vx + f.vy * f.vy > 36;
    if (f.vx > 3) f.face = 1;
    else if (f.vx < -3) f.face = -1;
    else if (!f.moving) f.face = p.x >= f.x ? 1 : -1;
    // ---- the Friend's weapon mirrors the hero's start weapon (or its evolution)
    if (p.dead) return;
    const mine = w.hasWeapon(f.base) ?? (f.evo ? w.hasWeapon(f.evo) : undefined);
    if (!mine) return;
    if (!f.inst || f.inst.def !== mine.def) equip(w, f, mine.def, mine);
    const inst = f.inst as WeaponInstance;
    inst.level = mine.level;
    inst.dmgMul = (mine.dmgMul ?? 1) * f.k;
    inst.t += dt;
    enter(w, f);
    try {
      inst.def.update(w, inst, dt);
    } finally {
      leave(w);
    }
    wrapOwned(w, inst);
  });
  // FRIEND! - the cast pose and a cheer whenever the hero's Overdrive starts
  w.hooks.on("ult", () => {
    const u = w.ult;
    f.castT = u ? (u.dur ?? u.def.duration) : 2;
    proc(w, "real_friend", f.x, f.y - CFG.playerCy, 1);
  });
  return f;
}
