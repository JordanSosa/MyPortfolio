/**
 * NIGHTMARE TEDDY (6:00 boss, DESIGN §3.5).
 *
 * Pattern loop (short stomping walks in between):
 *   CHARGE x3  wind-up (frame 2) with an aim lane on the ground -> fast dash
 *              leaving a wall of dust -> slams to a stop (shake + shockwave)
 *   CLAW SWEEP lumbers in close -> danger circle around itself -> spinning
 *              claw sweep that hits everything inside
 *   STAR SPIRAL rings of eb_star fired in a slowly rotating spiral
 *   ROAR       (frame 3) shakes the screen and summons Teddies + Puffs
 * Below 50 % HP it roars into a rage (brief invulnerable flourish): every
 * step is faster, spirals get denser, the sweep ends in a star ring.
 *
 * Per-boss scratch state lives in a WeakMap (pooled Enemy objects get a fresh
 * state in init()); `e.state` / `e.timer` are the pattern step and its clock.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { CFG } from "../config";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { B_STAR, ring } from "../enemies/_bullets";
import { EFX_CAST, EFX_CLAW, EFX_DASH, EFX_DUSTWALL, EFX_IMPACT, EFX_ROAR, EFX_SKID, EFX_STOMP, EFX_SUMMON, efx, onScreen, shock } from "../enemies/_fx";

export const NT_WALK = 0;
export const NT_WINDUP = 1;
export const NT_CHARGE = 2;
export const NT_RECOVER = 3;
export const NT_APPROACH = 4;
export const NT_SWEEP_TELE = 5;
export const NT_SWEEP = 6;
export const NT_SPIRAL = 7;
export const NT_ROAR = 8;

/** Pattern cycle (each starts after a short walk). */
const P_CHARGE = 0;
const P_SWEEP = 1;
const P_SPIRAL = 2;
const P_ROAR = 3;
const CYCLE = [P_CHARGE, P_SWEEP, P_SPIRAL, P_ROAR];

export const NT_SWEEP_R = 50;
const CHARGE_T = 0.6;
const CHARGES = 3;
const BODY_Y = 26;
/** Damage of each star bullet. */
const SHOT = 13;

export interface TeddyState {
  /** Index into CYCLE of the pattern that runs next. */
  next: number;
  /** Charges left / rings fired / sweep already hit. */
  n: number;
  /** Charge direction. */
  dx: number;
  dy: number;
  /** Spiral base angle + turn direction. */
  spin: number;
  dir: number;
  /** Walk duration before the next pattern. */
  walk: number;
  /** Rage announced (below 50 %). */
  rage: boolean;
}

const STATE = new WeakMap<Enemy, TeddyState>();

/** Scratch state of a Nightmare Teddy (view / tests). */
export function teddyState(e: Enemy): TeddyState | undefined {
  return STATE.get(e);
}

function st(e: Enemy): TeddyState {
  let s = STATE.get(e);
  if (!s) {
    s = { next: 0, n: 0, dx: 1, dy: 0, spin: 0, dir: 1, walk: 2.5, rage: false };
    STATE.set(e, s);
  }
  return s;
}

/** 1 normally, < 1 (faster) in rage. */
function tempo(s: TeddyState): number {
  return s.rage ? 0.78 : 1;
}

/**
 * Whole body in view and clear of the top HUD (timer + boss bar): patterns
 * only start where the player can read the wind-up (matters on short
 * landscape screens, where it walks in from the top).
 */
function inView(e: Enemy, w: World): boolean {
  const p = w.player;
  const hh = w.viewH * 0.5;
  return Math.abs(e.x - p.x) < w.viewW * 0.5 - 22 && e.y - 50 > p.y - hh + 18 && e.y < p.y + hh - 4;
}

function go(e: Enemy, state: number): void {
  e.state = state;
  e.timer = 0;
}

function aimDir(e: Enemy, w: World, s: TeddyState): void {
  const dx = w.player.x - e.x;
  const dy = w.player.y - e.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  s.dx = dx / d;
  s.dy = dy / d;
}

function chargeSpeed(s: TeddyState): number {
  return s.rage ? 265 : 230;
}

function startWindup(e: Enemy, w: World, s: TeddyState): void {
  go(e, NT_WINDUP);
  aimDir(e, w, s);
  e.face = s.dx >= 0 ? 1 : -1;
  const wind = 0.72 * tempo(s);
  const len = chargeSpeed(s) * CHARGE_T + e.r;
  w.telegraphLine(e.x, e.y, e.x + s.dx * len, e.y + s.dy * len, e.r - 2, wind);
  e.sqV -= 5;
}

function startPattern(e: Enemy, w: World, s: TeddyState): void {
  const p = CYCLE[s.next % CYCLE.length];
  s.next++;
  if (p === P_CHARGE) {
    s.n = CHARGES;
    startWindup(e, w, s);
  } else if (p === P_SWEEP) go(e, NT_APPROACH);
  else if (p === P_SPIRAL) {
    go(e, NT_SPIRAL);
    s.n = 0;
    s.spin = w.rng.angle();
    s.dir = -s.dir;
    efx(w, EFX_CAST, e.x, e.y - BODY_Y, 0, 0, 2, e);
  } else go(e, NT_ROAR);
}

function walkThenNext(e: Enemy, s: TeddyState, dur: number): void {
  go(e, NT_WALK);
  s.walk = dur * tempo(s);
}

function summon(e: Enemy, w: World, s: TeddyState): void {
  const teds = s.rage ? 3 : 2;
  const puffs = 3;
  const n = teds + puffs;
  const a0 = w.rng.angle();
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const x = e.x + Math.cos(a) * 46;
    const y = e.y + Math.sin(a) * 34;
    const m = w.spawnEnemy(i < teds ? "teddy" : "puff", x, y);
    if (m) efx(w, EFX_SUMMON, x, y, 0, 0, i < teds ? 1.4 : 1, m);
  }
}

export const nightmareTeddy: EnemyDef = {
  id: "nightmare_teddy",
  name: "Nightmare Teddy",
  sprite: "boss_teddy",
  fps: 6,
  hp: 17500,
  speed: 34,
  dmg: 18,
  radius: 19,
  height: 46,
  xp: 0,
  shadow: 46,
  knockResist: 0.97,
  colors: [C.violet, C.darkViolet, C.lavender, C.red, C.white],
  boss: { title: "NIGHTMARE TEDDY", subtitle: "The Plush That Never Sleeps", music: "boss", level: 33 },
  // art: f0-1 stomp, f2 wind-up, f3 roar
  frame(e) {
    switch (e.state) {
      case NT_WINDUP:
      case NT_SWEEP_TELE:
        return 2;
      case NT_CHARGE:
        return Math.floor(e.timer * 12) & 1;
      case NT_SWEEP:
        return (Math.floor(e.timer * 16) & 1) * 2;
      case NT_SPIRAL:
      case NT_ROAR:
        return 3;
      case NT_RECOVER:
        return 0;
      default:
        return Math.floor(e.t * 4.8) & 1;
    }
  },
  init(e) {
    const s = st(e);
    s.next = 0;
    s.n = 0;
    s.dir = 1;
    s.rage = false;
    // entrance: stomp in from the top before the first pattern
    walkThenNext(e, s, 2.2);
  },
  update(e, w, dt) {
    const s = st(e);
    const p = w.player;
    const k = tempo(s);
    e.timer += dt;

    // rage at 50 %: interrupt with a roar (brief invulnerable flourish)
    if (!s.rage && e.hp < e.maxHp * 0.5) {
      s.rage = true;
      e.inv = 1.1;
      go(e, NT_ROAR);
      w.emit("bossPhase", { id: e.def.id, phase: 2, x: e.x, y: e.y, title: "NIGHTMARE RAGE!", subtitle: "it's getting faster" });
    }

    switch (e.state) {
      case NT_WALK: {
        // measured body centre to body centre: the 46 px tall bear stops short of the hero from any side
        // (from below, its head ends under the hero's feet instead of its body covering the hero)
        const dx = p.x - e.x;
        const dy = p.y - CFG.playerCy - (e.y - BODY_Y);
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        // lumbering stomp; breaks into a run when the player kites it far away, and lumbers back a
        // step when it ended up on top of the hero (after a sweep / charge)
        const gait = 0.7 + 0.6 * Math.abs(Math.sin(e.t * Math.PI * 2.4));
        const sp = d < 38 ? -e.speed * 0.8 * gait : d < 44 ? 0 : e.speed * (s.rage ? 1.3 : 1) * (d > 150 ? 2.2 : 1) * gait;
        e.vx = (dx / d) * sp;
        e.vy = (dy / d) * sp;
        const step = Math.floor(e.t * 4.8);
        if (step !== Math.floor((e.t - dt) * 4.8)) {
          e.sqV += 3;
          if (onScreen(w, e.x, e.y, 30)) efx(w, EFX_STOMP, e.x, e.y, 0, 0, 2.2, e);
        }
        // (fallback after 3 s more: tiny screens where it can never fit entirely)
        if (e.timer >= s.walk && (inView(e, w) || (e.timer > s.walk + 3 && onScreen(w, e.x, e.y - BODY_Y, -10)))) startPattern(e, w, s);
        break;
      }
      case NT_WINDUP: {
        // lean back, then go
        e.vx = -s.dx * 10;
        e.vy = -s.dy * 10;
        if (e.timer >= 0.72 * k) {
          go(e, NT_CHARGE);
          e.sqV += 8;
          efx(w, EFX_DASH, e.x, e.y, s.dx, s.dy, 2.4, e);
        }
        break;
      }
      case NT_CHARGE: {
        const sp = chargeSpeed(s);
        e.vx = s.dx * sp;
        e.vy = s.dy * sp;
        e.face = s.dx >= 0 ? 1 : -1;
        if (Math.floor(e.timer / 0.05) !== Math.floor((e.timer - dt) / 0.05)) efx(w, EFX_DUSTWALL, e.x, e.y, s.dx, s.dy, 1, e);
        if (e.timer >= CHARGE_T) {
          go(e, NT_RECOVER);
          e.vx = e.vy = 0;
          e.sqV -= 12;
          efx(w, EFX_SKID, e.x, e.y, s.dx, s.dy, 2.6, e);
          efx(w, EFX_IMPACT, e.x, e.y, s.dx, s.dy, 0.8, e);
          shock(w, e.x, e.y, 34, 0.55);
        }
        break;
      }
      case NT_RECOVER: {
        e.vx = e.vy = 0;
        if (e.timer >= 0.42 * k) {
          s.n--;
          if (s.n > 0) startWindup(e, w, s);
          else walkThenNext(e, s, 1.1);
        }
        break;
      }
      case NT_APPROACH: {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const sp = e.speed * 2.3;
        e.vx = (dx / d) * sp;
        e.vy = (dy / d) * sp;
        if (d < 40 || e.timer > 1.4) {
          go(e, NT_SWEEP_TELE);
          e.vx = e.vy = 0;
          w.telegraphCircle(e.x, e.y, NT_SWEEP_R, 0.8 * k, C.red);
          e.sqV -= 6;
        }
        break;
      }
      case NT_SWEEP_TELE: {
        e.vx = e.vy = 0;
        if (e.timer >= 0.8 * k) {
          go(e, NT_SWEEP);
          s.n = 0;
          efx(w, EFX_CLAW, e.x, e.y, 0, 0, NT_SWEEP_R, e);
        }
        break;
      }
      case NT_SWEEP: {
        e.vx = e.vy = 0;
        // spinning: flip facing quickly
        e.face = Math.floor(e.timer * 14) & 1 ? 1 : -1;
        if (s.n === 0 && e.timer > 0.08) {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          if (dx * dx + dy * dy < NT_SWEEP_R * NT_SWEEP_R) {
            s.n = 1;
            w.hurtPlayer(e.dmg * 1.2, e.x, e.y);
          }
        }
        if (e.timer >= 0.55) {
          if (s.rage) ring(w, e.x, e.y - BODY_Y, 12, w.rng.angle(), 64, SHOT, B_STAR, 22);
          shock(w, e.x, e.y, NT_SWEEP_R, 0.4);
          walkThenNext(e, s, 1.0);
        }
        break;
      }
      case NT_SPIRAL: {
        e.vx = e.vy = 0;
        const every = 0.3 * k;
        const rings = s.rage ? 10 : 8;
        if (e.timer >= s.n * every + 0.35 && s.n < rings) {
          const n = s.rage ? 11 : 9;
          ring(w, e.x, e.y - BODY_Y, n, s.spin, s.rage ? 70 : 62, SHOT, B_STAR, 20);
          s.spin += 0.17 * s.dir;
          s.n++;
          e.sqV -= 3;
        }
        if (s.n >= rings && e.timer >= rings * every + 0.8) walkThenNext(e, s, 1.4);
        break;
      }
      case NT_ROAR: {
        e.vx = e.vy = 0;
        if (e.timer >= 0.3 && e.timer - dt < 0.3) {
          e.sqV += 14;
          efx(w, EFX_ROAR, e.x, e.y - BODY_Y, 0, 0, s.rage ? 1.4 : 1, e);
          shock(w, e.x, e.y, 70, 0.9);
          summon(e, w, s);
          if (s.rage) ring(w, e.x, e.y - BODY_Y, 14, w.rng.angle(), 58, SHOT, B_STAR, 22);
        }
        if (e.timer >= 1.25 * k) walkThenNext(e, s, 1.3);
        break;
      }
      default:
        walkThenNext(e, s, 1);
    }
  },
};

export const bosses: EnemyDef[] = [nightmareTeddy];
