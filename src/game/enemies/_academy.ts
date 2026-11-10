/**
 * Shoujo Academy shared sim state (helper - no `enemies` export): installed
 * once per World by the first academy enemy that spawns (WeakMap, no globals).
 *
 *   - dash watch: a `dash` hook remembers when / where the player dashed
 *     (Hall Monitors: "NO RUNNING!")
 *   - Tsundere Slime "Mixed Signals": a `hit` hook (non-lethal hits)
 *   - Love Letter hearts: enemy bullets with the HEART sprite home toward the
 *     player at 0.8 rad/s (`step` hook; only while hearts can be alive)
 *   - Exam Paper "F-": XP gain -5 % per stack (a `statMods` entry), each stack
 *     expiring on its own clock
 *   - Council Ninja decoys: explode (r 20, 12 dmg) 1 s after the smoke bomb
 *
 * Allocation-free listeners; fixed-size typed arrays for stacks / decoys.
 */
import { CFG } from "../config";
import type { Enemy } from "../types";
import type { World } from "../world";
import { cue } from "./_cue";

/** Love Letter heart bullets (fx_heart, tinted pink by the view). */
export const HEART = "fx_heart";
export const HEART_TURN = 0.8;
/** F- stacks: max regular / Final Exam, XP gain per stack. */
export const F_MAX = 3;
export const F_MAX_ELITE = 6;
export const F_GROWTH = 0.05;
const F_SLOTS = 6;
/** Decoy blast (elite Council Ninja). */
export const DECOY_R = 20;
export const DECOY_DMG = 12;
export const DECOY_FUSE = 1;
export const MAX_DECOYS = 8;

/** Cue kinds of the Shoujo Academy (src/view/academy-fx.ts). */
export const SA_WHISTLE = "academy_whistle";
export const SA_FAIL = "academy_fail";
export const SA_BLUSH = "academy_blush";
export const SA_RETURN = "academy_return";
export const SA_SMOKE = "academy_smoke";
export const SA_DECOY_BOOM = "academy_decoy_boom";
export const SA_TELE_OUT = "academy_tele_out";
export const SA_TELE_IN = "academy_tele_in";
export const SA_REJECTED = "academy_rejected";

export interface AcademyState {
  /** World.t of the last dash (-1 = none) and where it started. */
  dashAt: number;
  dashX: number;
  dashY: number;
  /** F- stacks: expiry run time per slot (0 = free). */
  readonly fUntil: Float64Array;
  /** Active F- stacks (recounted every step). */
  fStacks: number;
  /** Hearts may be alive until this run time (homing runs only then). */
  heartsUntil: number;
  /** Decoys: x, y, fuse left (s; <= 0 = free), damage. */
  readonly dx: Float64Array;
  readonly dy: Float64Array;
  readonly dt: Float64Array;
  /** Throttle for the scripted shouts ("NO RUNNING!", "New student!"): World.t of the last one. */
  shoutAt: number;
  /** Hook for the Tsundere Slime (set by its module: no import cycle). */
  onHit: ((e: Enemy, w: World) => void) | null;
}

const STATES = new WeakMap<World, AcademyState>();

/** The academy state if any academy enemy has spawned in this world (view: F- badge, decoys). */
export function academyState(w: World): AcademyState | undefined {
  return STATES.get(w);
}

export function academyInstall(w: World): AcademyState {
  let s = STATES.get(w);
  if (s) return s;
  s = {
    dashAt: -1,
    dashX: 0,
    dashY: 0,
    fUntil: new Float64Array(F_SLOTS),
    fStacks: 0,
    heartsUntil: -1,
    dx: new Float64Array(MAX_DECOYS),
    dy: new Float64Array(MAX_DECOYS),
    dt: new Float64Array(MAX_DECOYS),
    shoutAt: -9,
    onHit: null,
  };
  STATES.set(w, s);
  const st = s;
  w.hooks.on("dash", (h) => {
    st.dashAt = w.t;
    st.dashX = h.x;
    st.dashY = h.y;
  });
  w.hooks.on("hit", (h) => {
    const e = h.enemy;
    if (st.onHit && e.def.id === "tsundere_slime" && e.hp > 0 && !e.dead) st.onHit(e, w);
  });
  // F-: XP gain down per active stack
  w.statMods.push((stats) => {
    if (st.fStacks > 0) stats.growth -= F_GROWTH * st.fStacks;
  });
  w.hooks.on("step", (h) => {
    // F- expiry
    if (st.fStacks > 0) {
      let n = 0;
      for (let i = 0; i < F_SLOTS; i++) if (st.fUntil[i] > w.t) n++;
      if (n !== st.fStacks) {
        st.fStacks = n;
        w.statsDirty = true;
      }
    }
    // heart homing (only while hearts may exist)
    if (st.heartsUntil > w.t) heartsHome(w, h.dt);
    // decoy fuses
    for (let i = 0; i < MAX_DECOYS; i++) {
      if (st.dt[i] <= 0) continue;
      st.dt[i] -= h.dt;
      if (st.dt[i] > 0) continue;
      const x = st.dx[i];
      const y = st.dy[i];
      const p = w.player;
      const ddx = p.x - x;
      const ddy = p.y - CFG.playerCy - (y - 8);
      const rr = DECOY_R + CFG.playerRadius * w.stats.hitbox;
      if (ddx * ddx + ddy * ddy < rr * rr) w.hurtPlayer(DECOY_DMG * w.difficulty.enemyDmg, x, y, "council_ninja");
      cue(w, SA_DECOY_BOOM, x, y, 0, 0, DECOY_R);
    }
  });
  return s;
}

function heartsHome(w: World, dt: number): void {
  const p = w.player;
  const px = p.x;
  const py = p.y - CFG.playerCy;
  const max = HEART_TURN * dt;
  const items = w.bullets.items;
  for (let i = 0; i < w.bullets.count; i++) {
    const b = items[i];
    if (b.dead || b.sprite !== HEART) continue;
    const want = Math.atan2(py - b.y, px - b.x);
    const cur = Math.atan2(b.vy, b.vx);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const a = cur + Math.max(-max, Math.min(max, d));
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
  }
}

/** Add one F- stack (Exam Paper contact). Returns the new stack count. */
export function addFail(w: World, elite: boolean): number {
  const s = academyInstall(w);
  const cap = elite ? F_MAX_ELITE : F_MAX;
  const life = elite ? 8 : 5;
  let n = 0;
  let oldest = 0;
  for (let i = 0; i < F_SLOTS; i++) {
    if (s.fUntil[i] > w.t) n++;
    if (s.fUntil[i] < s.fUntil[oldest]) oldest = i;
  }
  if (n >= cap) {
    // at the cap: refresh the stack closest to expiring instead
    let soon = -1;
    for (let i = 0; i < F_SLOTS; i++) if (s.fUntil[i] > w.t && (soon < 0 || s.fUntil[i] < s.fUntil[soon])) soon = i;
    if (soon >= 0) s.fUntil[soon] = Math.max(s.fUntil[soon], w.t + life);
  } else {
    s.fUntil[oldest] = w.t + life;
    n++;
  }
  if (n !== s.fStacks) {
    s.fStacks = n;
    w.statsDirty = true;
  }
  return n;
}

/** Arm a decoy blast at (x, y) (elite Council Ninja smoke bomb). */
export function addDecoy(w: World, x: number, y: number): void {
  const s = academyInstall(w);
  let slot = 0;
  for (let i = 0; i < MAX_DECOYS; i++) {
    if (s.dt[i] <= 0) {
      slot = i;
      break;
    }
    if (s.dt[i] < s.dt[slot]) slot = i;
  }
  s.dx[slot] = x;
  s.dy[slot] = y;
  s.dt[slot] = DECOY_FUSE;
  w.telegraphCircle(x, y, DECOY_R, DECOY_FUSE, 0xb47cff);
}

/** May a throttled scripted shout play now (at most one per `gap` s per world)? */
export function shoutOk(w: World, gap = 0.6): boolean {
  const s = academyInstall(w);
  if (w.t - s.shoutAt < gap) return false;
  s.shoutAt = w.t;
  return true;
}
