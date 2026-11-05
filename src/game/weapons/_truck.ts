/**
 * Truck-kun drives (docs/content/heroes.md §1.1 "Heavy Vehicle", §2.11): a
 * heading + speed vehicle model behind the same joystick / keys (World.mover),
 * no hit recoil (World.heavy), and the C6 trailer that follows on a rope and
 * rams like the cab. No `weapons` export: the registry ignores this file.
 *
 * Feel: the stick sets the wanted heading and throttle. The truck turns toward
 * it at 8-14 rad/s (tighter when slow: it can still pull a cartoon U-turn on the
 * spot), accelerates at 260 px/s^2, brakes at 420 px/s^2 when the stick is
 * released, and a hard turn bleeds up to 45 % of its speed (it corners instead
 * of strafing). A dash launches it along the dash and it keeps rolling that way.
 */
import { CFG, CH_MISC } from "../config";
import { PK_MANAGED, type Enemy, type ProjHitHook, type Projectile, type WeaponInstance } from "../types";
import type { World } from "../world";
import { wstats } from "./_shared";

const ACCEL = 260;
const BRAKE = 420;
const TURN_FAST = 8;
const TURN_SLOW = 14;
/** Trailer rope length (px) and ram radius. */
const ROPE = 18;
const RAM_R = 10;

export interface TruckState {
  /** Heading (radians) and speed along it (px/s). */
  hd: number;
  v: number;
  /** Signed turn rate this step (rad/s): the view leans into corners. */
  turn: number;
  /** C6 trailer (managed projectile) and its uid; its position and facing. */
  trailer: Projectile | null;
  tuid: number;
  tx: number;
  ty: number;
}
const trucks = new WeakMap<World, TruckState>();

/** Truck state of this world (null unless Truck-kun is driving). */
export function truckState(w: World): TruckState | null {
  return trucks.get(w) ?? null;
}

/** The direction the hero "faces" for the horn: the truck's heading, else the last move direction. */
export function facing(w: World, out: { x: number; y: number }): { x: number; y: number } {
  const st = trucks.get(w);
  if (st) {
    out.x = Math.cos(st.hd);
    out.y = Math.sin(st.hd);
  } else {
    out.x = w.player.aimX;
    out.y = w.player.aimY;
  }
  return out;
}

/** Is the hero moving fast enough to ram (>= 60 % of its move speed)? */
export function ramming(w: World): boolean {
  const p = w.player;
  const min = 0.6 * CFG.playerSpeed * w.stats.moveSpeed;
  return p.vx * p.vx + p.vy * p.vy >= min * min;
}

function drive(w: World, mx: number, my: number, dt: number): void {
  const st = trucks.get(w) as TruckState;
  const p = w.player;
  const max = CFG.playerSpeed * w.stats.moveSpeed;
  const m = Math.min(1, Math.sqrt(mx * mx + my * my));
  st.turn = 0;
  if (m > 0.05) {
    const want = Math.atan2(my, mx);
    let da = want - st.hd;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const slowK = 1 - Math.min(1, st.v / Math.max(1, max));
    const step = (TURN_FAST + (TURN_SLOW - TURN_FAST) * slowK) * dt;
    const turn = Math.max(-step, Math.min(step, da));
    st.hd += turn;
    st.turn = dt > 0 ? turn / dt : 0;
    if (st.hd > Math.PI) st.hd -= Math.PI * 2;
    else if (st.hd < -Math.PI) st.hd += Math.PI * 2;
    // a hard turn bleeds speed (the truck corners instead of strafing)
    const target = m * max * (1 - 0.45 * Math.min(1, Math.abs(da) / Math.PI));
    const dv = target - st.v;
    st.v += dv > 0 ? Math.min(dv, ACCEL * dt) : Math.max(dv, -BRAKE * dt);
  } else st.v = Math.max(0, st.v - BRAKE * dt);
  p.vx = Math.cos(st.hd) * st.v;
  p.vy = Math.sin(st.hd) * st.v;
}

/** Truck-kun's Heavy Vehicle: vehicle movement + no recoil. Installed by the hero (HeroDef.install). */
export function installTruck(w: World): TruckState {
  let st = trucks.get(w);
  if (st) return st;
  const s: TruckState = { hd: 0, v: 0, turn: 0, trailer: null, tuid: 0, tx: 0, ty: 0 };
  st = s;
  trucks.set(w, s);
  w.heavy = true;
  w.mover = drive;
  // a dash launches the truck along the dash: it keeps rolling that way at full speed
  w.hooks.on("dash", (d) => {
    s.hd = Math.atan2(d.dy, d.dx);
    s.v = CFG.playerSpeed * w.stats.moveSpeed;
  });
  return s;
}

/** The live horn (or its evolution): the trailer rams with its numbers. */
function hornInst(w: World): WeaponInstance | null {
  return w.hasWeapon("isekai_rush_hour") ?? w.hasWeapon("horn_of_reincarnation") ?? null;
}

/** Bull Bar stun on trailer hits too. */
const trailerHit: ProjHitHook = (_p, w, e: Enemy) => {
  const r = w.talentRank("truck_bull_bar");
  if (r > 0 && !e.def.boss && !e.dead) e.stun = Math.max(e.stun, 0.1 + 0.1 * r);
};

/**
 * Truck-kun C6 "Now With Trailer": a trailer follows 18 px behind on a rope and
 * rams like the cab (the horn's ram damage, its own 0.4 s per-enemy cooldown).
 */
export function installTrailer(w: World): void {
  const st = installTruck(w);
  const p0 = w.player;
  st.tx = p0.x - ROPE;
  st.ty = p0.y;
  w.hooks.on("step", () => {
    if (w.phase !== "play") return;
    const p = w.player;
    // rope: the hitch is the cab's rear; the trailer is only ever pulled, never pushed
    const hx = p.x - Math.cos(st.hd) * 8;
    const hy = p.y - Math.sin(st.hd) * 4;
    const dx = hx - st.tx;
    const dy = hy - st.ty;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > ROPE) {
      st.tx = hx - (dx / d) * ROPE;
      st.ty = hy - (dy / d) * ROPE;
    }
    let q = st.trailer;
    const inst = hornInst(w);
    if (!q || q.dead || q.uid !== st.tuid) {
      q = w.spawnProjectile(inst, inst ? inst.def.id : "horn_of_reincarnation");
      q.kind = PK_MANAGED;
      q.ch = CH_MISC;
      q.hitEvery = 0.4;
      q.pierce = Infinity;
      q.knock = 120;
      q.life = Infinity;
      q.sprite = "truck_kun_trailer";
      q.fps = 8;
      q.entity = true;
      q.shadow = 16;
      q.onHit = trailerHit;
      st.trailer = q;
      st.tuid = q.uid;
    }
    q.owner = inst;
    q.source = inst ? inst.def.id : "horn_of_reincarnation";
    q.x = st.tx;
    q.y = st.ty;
    if (Math.abs(dx) > 0.5) q.flipX = dx < 0;
    // rams only while the truck is really moving (the cab's rule)
    const moving = ramming(w);
    q.r = moving && inst ? RAM_R : 0;
    if (inst) {
      const S = wstats(w, inst);
      q.dmg = (S.L.ram ?? 12) * (S.dmg / Math.max(1e-6, S.L.dmg)) * (1 + 0.2 * w.talentRank("truck_bull_bar"));
    }
  });
}
