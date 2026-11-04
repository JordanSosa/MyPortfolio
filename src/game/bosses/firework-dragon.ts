/**
 * SUMMER FESTIVAL FIREWORK DRAGON (Beach Episode FINAL 15:00, docs/content/enemies.md §5.6).
 * "Tonight's Main Event (Do Not Look Directly At)". A paper festival-lantern
 * dragon: only the head is a hitbox; 6 lantern body segments follow the head's
 * path (the view draws them, the sim checks their contact vs the hero: 18).
 *
 *   P1 (100-60 %) "Opening Ceremony"
 *     Rocket Volley    3 rockets shoot up; burst circles telegraphed 1.0 s (r 28) on the
 *                      ground; each bursts into a ring of 16 eb_firework (60 px/s with
 *                      30 px/s^2 drag, then they fall) + "TAMAYA!"
 *     Dragon Dance     slithers across the view on a telegraphed sine path (120 px/s) for 3 s
 *     Sparkler Breath  inhale (f2), then two aimed fans of 9 eb_firework (80 px/s)
 *   P2 (< 60 %) "GRAND FINALE (EARLY)" - they fired everything too soon: the grade
 *     lerps to night, a rocket every 0.8 s on top of everything, faster dances,
 *     cycling burst colours
 *   P3 (< 25 %) "ENCORE!!": every pattern at 70 % density at once; the finale: 5
 *     rockets burst in a pentagon around the hero; bullets +15 % speed
 *   Enrage at the stage's enrageAt (16:30): everything faster.
 *
 * Death: "...and that concludes tonight's show. Please exit in an orderly
 * fashion." -> the victory "SUMMER'S OVER!".
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { CFG } from "../config";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt } from "../enemies/_bullets";
import { onScreen, shock } from "../enemies/_fx";
import { say } from "../enemies/_say";
import { BX_BREATH, BX_BURST, BX_DANCE, BX_ROCKET, cue } from "../enemies/_s45";
import { anchor, fanOf, finalDawn, go, phaseFlourish, readable, shot, stageFx, steerTo } from "./_s45boss";

export const FD_ENTER = 0;
export const FD_DRIFT = 1;
export const FD_VOLLEY = 2;
export const FD_DANCE_TELE = 3;
export const FD_DANCE = 4;
export const FD_BREATH = 5;
export const FD_FINALE = 6;
export const FD_FLOURISH = 7;

const P_VOLLEY = 0;
const P_DANCE = 1;
const P_BREATH = 2;
const P_FINALE = 3;
const P_ENCORE = 4;
const CYCLES: readonly (readonly number[])[] = [[], [P_VOLLEY, P_DANCE, P_BREATH], [P_DANCE, P_VOLLEY, P_BREATH, P_DANCE], [P_FINALE, P_ENCORE, P_BREATH, P_ENCORE]];

export const FD_P2 = 0.6;
export const FD_P3 = 0.25;
const TOP = 46;
const HEAD_Y = 18;
export const SEGMENTS = 6;
/** Path samples between body segments (one sample per SAMPLE px of head travel). */
const SAMPLE = 3;
const PER_SEG = 5;
const TRAIL = SEGMENTS * PER_SEG + 2;
const SEG_R = 6;
const SEG_DMG = 18;
export const ROCKET_T = 1.0;
export const BURST_R = 28;
const STAR = 14;
/** Bullet.accel value marking a falling firework star (too small to change its speed). */
const FALLING = 1e-4;
/** Burst colours (the view tints each ring; phase 2+ cycles through them). */
export const BURST_COLORS: readonly number[] = [C.yellow, C.pink, C.cyan, C.lime, C.orange, C.violet];

export interface DragonState {
  phase: number;
  pat: number;
  n: number;
  drift: number;
  /** Head path ring buffer (x, y) and write index; segment positions (view + contact). */
  trailX: Float32Array;
  trailY: Float32Array;
  head: number;
  filled: number;
  lastX: number;
  lastY: number;
  segX: Float32Array;
  segY: Float32Array;
  /** Pending rocket bursts: position, seconds left (< 0 = free), bullets, colour index. */
  rx: Float32Array;
  ry: Float32Array;
  rt: Float32Array;
  rn: Uint8Array;
  rc: Uint8Array;
  /** Background rockets (phase 2+): seconds to the next one. */
  bgT: number;
  colorI: number;
  /** Dance: direction, start x, base y, speed, elapsed. */
  danceDir: number;
  danceX: number;
  danceY: number;
  danceV: number;
  /** Encore combo sub-timer. */
  sub: number;
  /** The night grade has been asked for (phase 2). */
  night: boolean;
  /** World.muted last update (the night directive is re-sent after a muted fast-forward). */
  muted: boolean;
}

const STATE = new WeakMap<Enemy, DragonState>();

export function dragonState(e: Enemy): DragonState | undefined {
  return STATE.get(e);
}

const MAX_ROCKETS = 10;

function st(e: Enemy): DragonState {
  let s = STATE.get(e);
  if (!s) {
    s = {
      phase: 1,
      pat: 0,
      n: 0,
      drift: 2,
      trailX: new Float32Array(TRAIL),
      trailY: new Float32Array(TRAIL),
      head: 0,
      filled: 0,
      lastX: 0,
      lastY: 0,
      segX: new Float32Array(SEGMENTS),
      segY: new Float32Array(SEGMENTS),
      rx: new Float32Array(MAX_ROCKETS),
      ry: new Float32Array(MAX_ROCKETS),
      rt: new Float32Array(MAX_ROCKETS).fill(-1),
      rn: new Uint8Array(MAX_ROCKETS),
      rc: new Uint8Array(MAX_ROCKETS),
      bgT: 0.8,
      colorI: 0,
      danceDir: 1,
      danceX: 0,
      danceY: 0,
      danceV: 120,
      sub: 0,
      night: false,
      muted: false,
    };
    STATE.set(e, s);
  }
  return s;
}

function tempo(w: World, s: DragonState): number {
  return (w.director.enraged ? 0.8 : 1) * (s.phase >= 3 ? 0.9 : 1);
}
function speedK(w: World, s: DragonState): number {
  return (s.phase >= 3 ? 1.15 : 1) * (w.director.enraged ? 1.1 : 1);
}

function resetTrail(e: Enemy, s: DragonState): void {
  for (let i = 0; i < TRAIL; i++) {
    s.trailX[i] = e.x;
    s.trailY[i] = e.y - i * 0.5;
  }
  s.head = 0;
  s.filled = TRAIL;
  s.lastX = e.x;
  s.lastY = e.y;
  for (let k = 0; k < SEGMENTS; k++) {
    s.segX[k] = e.x;
    s.segY[k] = e.y;
  }
}

/** Record the head's path and place the body segments along it; returns nothing (segX/segY updated). */
function updateBody(e: Enemy, s: DragonState): void {
  let dx = e.x - s.lastX;
  let dy = e.y - s.lastY;
  let d = Math.sqrt(dx * dx + dy * dy);
  while (d >= SAMPLE) {
    s.lastX += (dx / d) * SAMPLE;
    s.lastY += (dy / d) * SAMPLE;
    s.head = (s.head + 1) % TRAIL;
    s.trailX[s.head] = s.lastX;
    s.trailY[s.head] = s.lastY;
    dx = e.x - s.lastX;
    dy = e.y - s.lastY;
    d = Math.sqrt(dx * dx + dy * dy);
  }
  for (let k = 0; k < SEGMENTS; k++) {
    const i = (s.head - (k + 1) * PER_SEG + TRAIL * 4) % TRAIL;
    s.segX[k] = s.trailX[i];
    s.segY[k] = s.trailY[i];
  }
}

/** Body segments sting on contact (the head's own contact is the generic one). */
function bodyContact(e: Enemy, w: World, s: DragonState): void {
  if (w.invulnerable) return;
  const p = w.player;
  const py = p.y - CFG.playerCy;
  const rr = SEG_R + CFG.playerRadius - 1;
  for (let k = 0; k < SEGMENTS; k++) {
    const dx = s.segX[k] - p.x;
    const dy = s.segY[k] - HEAD_Y * 0.6 - py;
    if (dx * dx + dy * dy < rr * rr) {
      w.hurtPlayer(SEG_DMG, s.segX[k], s.segY[k], e.def.id);
      return;
    }
  }
}

function launch(e: Enemy, w: World, s: DragonState, x: number, y: number, n: number, tele = ROCKET_T): void {
  for (let i = 0; i < MAX_ROCKETS; i++) {
    if (s.rt[i] >= 0) continue;
    s.rx[i] = x;
    s.ry[i] = y;
    s.rt[i] = tele;
    s.rn[i] = n;
    s.rc[i] = s.phase >= 2 ? s.colorI++ % BURST_COLORS.length : 0;
    w.telegraphCircle(x, y, BURST_R, tele, BURST_COLORS[s.rc[i]]);
    cue(w, BX_ROCKET, e.x, e.y - HEAD_Y, x, y, tele, e);
    return;
  }
}

/** Ring of firework stars: they bloom outward, drag to a stop, then fall (see fallStars). */
function burst(e: Enemy, w: World, s: DragonState, i: number): void {
  const x = s.rx[i];
  const y = s.ry[i] - 6;
  const n = s.rn[i];
  const col = BURST_COLORS[s.rc[i]];
  const sp = 60 * speedK(w, s);
  const a0 = w.rng.angle();
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * TAU;
    const b = shot(w, x + Math.cos(a) * 6, y + Math.sin(a) * 6, a, sp, STAR, "eb_firework", col, 6);
    if (b) b.accel = -30;
  }
  shock(w, x, y, 34, 0.35);
  cue(w, BX_BURST, x, y, s.rc[i], 0, n, e);
  if (w.rng.next() < 0.45) say(w, e, "TAMAYA!!", false);
}

/** Bloomed firework stars that dragged to a stop fall like embers (no per-bullet state: matched by sprite + shooter). */
function fallStars(w: World, dt: number): void {
  const items = w.bullets.items;
  for (let i = 0; i < w.bullets.count; i++) {
    const b = items[i];
    if (b.dead || b.sprite !== "eb_firework" || b.accel >= 0 || b.from !== "firework_dragon") continue;
    const v2 = b.vx * b.vx + b.vy * b.vy;
    // (the drag ends; gravity takes over: at most 46 px/s down). FALLING marks it (a no-op acceleration).
    if (v2 < 64 || b.age > 2.1) b.accel = FALLING;
  }
  for (let i = 0; i < w.bullets.count; i++) {
    const b = items[i];
    if (b.dead || b.sprite !== "eb_firework" || b.accel !== FALLING) continue;
    b.vx *= 1 - Math.min(1, dt * 1.5);
    b.vy = Math.min(46, b.vy + 50 * dt);
  }
}

function tickRockets(e: Enemy, w: World, s: DragonState, dt: number): void {
  for (let i = 0; i < MAX_ROCKETS; i++) {
    if (s.rt[i] < 0) continue;
    s.rt[i] -= dt;
    if (s.rt[i] <= 0) {
      s.rt[i] = -1;
      burst(e, w, s, i);
    }
  }
}

function nearHero(w: World, r0: number, r1: number, out: { x: number; y: number }): void {
  const p = w.player;
  const a = w.rng.angle();
  const d = w.rng.range(r0, r1);
  out.x = p.x + Math.cos(a) * d;
  out.y = p.y + Math.sin(a) * d * 0.75;
}

const tmp = { x: 0, y: 0 };

function startDance(e: Enemy, w: World, s: DragonState): void {
  go(e, FD_DANCE_TELE);
  const p = w.player;
  s.danceDir = e.x < p.x ? 1 : -1;
  s.danceX = p.x - s.danceDir * (w.viewW * 0.5 + 24);
  s.danceY = p.y - CFG.playerCy;
  s.danceV = (s.phase >= 2 ? 150 : 120) * speedK(w, s);
  // the sine path, telegraphed in short segments
  const len = s.danceV * 3;
  const seg = 8;
  for (let k = 0; k < seg; k++) {
    const x0 = s.danceX + s.danceDir * (len * k) / seg;
    const x1 = s.danceX + s.danceDir * (len * (k + 1)) / seg;
    const y0 = s.danceY + danceOff(((len * k) / seg) / s.danceV);
    const y1 = s.danceY + danceOff(((len * (k + 1)) / seg) / s.danceV);
    w.telegraphLine(x0, y0 + HEAD_Y, x1, y1 + HEAD_Y, 7, 0.8 * tempo(w, s), C.orange);
  }
  cue(w, BX_DANCE, e.x, e.y, s.danceDir, 0, 3, e);
}

/** Vertical sine offset of the dance after `t` s. */
function danceOff(t: number): number {
  return Math.sin(t * 2.6) * 34;
}

function nextPattern(e: Enemy, w: World, s: DragonState): void {
  const cyc = CYCLES[s.phase];
  const pat = cyc[s.pat % cyc.length];
  s.pat++;
  s.n = 0;
  s.sub = 0;
  const p = w.player;
  switch (pat) {
    case P_VOLLEY: {
      go(e, FD_VOLLEY);
      launch(e, w, s, p.x, p.y, 16);
      for (let k = 0; k < 2; k++) {
        nearHero(w, 46, 74, tmp);
        launch(e, w, s, tmp.x, tmp.y, 16);
      }
      break;
    }
    case P_DANCE:
      startDance(e, w, s);
      break;
    case P_BREATH:
      go(e, FD_BREATH);
      cue(w, BX_BREATH, e.x, e.y - HEAD_Y, 0, 0, 0.6, e);
      break;
    case P_FINALE: {
      go(e, FD_FINALE);
      const a0 = w.rng.angle();
      for (let k = 0; k < 5; k++) {
        const a = a0 + (k / 5) * TAU;
        launch(e, w, s, p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58 * 0.8, 11, ROCKET_T + k * 0.12);
      }
      break;
    }
    default: {
      // ENCORE: the dance with the volley + the breath on top, all at 70 % density
      startDance(e, w, s);
      s.sub = 1;
      launch(e, w, s, p.x, p.y, 11);
      nearHero(w, 50, 80, tmp);
      launch(e, w, s, tmp.x, tmp.y, 11);
    }
  }
}

function drift(e: Enemy, s: DragonState, sec: number): void {
  go(e, FD_DRIFT);
  s.drift = sec;
}

export const fireworkDragon: EnemyDef = {
  id: "firework_dragon",
  name: "Summer Festival Firework Dragon",
  sprite: "boss_firework_dragon",
  fps: 6,
  hp: 430000,
  speed: 60,
  dmg: 18,
  radius: 18,
  height: 30,
  xp: 0,
  shadow: 40,
  knockResist: 1,
  noSeparation: true,
  colors: [C.red, C.gold, C.yellow, C.orange, C.white],
  boss: { title: "SUMMER FESTIVAL FIREWORK DRAGON", subtitle: "Tonight's Main Event (Do Not Look Directly At)", music: "final", final: true, level: 78 },
  // art: f0-1 slither, f2 inhale, f3 breathe (sparks), f4 burst pose (mouth wide), f5 coil
  frame(e) {
    switch (e.state) {
      case FD_BREATH:
        return e.timer < 0.6 ? 2 : 3;
      case FD_VOLLEY:
      case FD_FINALE:
        return 4;
      case FD_FLOURISH:
      case FD_DANCE_TELE:
        return 5;
      default:
        return Math.floor(e.t * 5) & 1;
    }
  },
  init(e, w) {
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.n = 0;
    s.night = false;
    s.muted = w.muted;
    s.bgT = 0.8;
    s.rt.fill(-1);
    resetTrail(e, s);
    go(e, FD_ENTER);
    e.inv = 2.2;
    e.z = 8;
  },
  update(e, w, dt) {
    const s = st(e);
    const p = w.player;
    const k = tempo(w, s);
    e.timer += dt;
    if (s.muted && !w.muted && s.night) stageFx(w, "grade", 0.75, 0, "night");
    s.muted = w.muted;
    if (e.state === FD_ENTER && e.timer < dt * 1.5) resetTrail(e, s);
    tickRockets(e, w, s, dt);
    fallStars(w, dt);

    // phase changes (never skipped)
    if (e.state !== FD_ENTER && e.state !== FD_FLOURISH) {
      const want = e.hp < e.maxHp * FD_P3 ? 3 : e.hp < e.maxHp * FD_P2 ? 2 : 1;
      if (want > s.phase) {
        s.phase++;
        s.pat = 0;
        go(e, FD_FLOURISH);
        if (s.phase === 2) {
          phaseFlourish(e, w, 2, "GRAND FINALE (EARLY)", "they fired everything too soon", "TAMAYA!!");
          if (!s.night) {
            s.night = true;
            stageFx(w, "grade", 0.75, 2.5, "night");
          }
        } else phaseFlourish(e, w, 3, "ENCORE!!", "the show must go on (and on)", "ENCORE!");
      }
    }
    // GRAND FINALE (EARLY): a rocket every 0.8 s on top of everything
    if (s.phase >= 2 && e.state !== FD_FLOURISH && e.state !== FD_ENTER) {
      s.bgT -= dt;
      if (s.bgT <= 0) {
        s.bgT = (w.director.enraged ? 0.6 : 0.8) * (s.phase >= 3 ? 1.15 : 1);
        if (onScreen(w, e.x, e.y, 60)) {
          nearHero(w, 30, 92, tmp);
          launch(e, w, s, tmp.x, tmp.y, s.phase >= 3 ? 9 : 12);
        }
      }
    }

    switch (e.state) {
      case FD_ENTER:
      case FD_DRIFT: {
        // always slithering: a lazy loop around its hover spot
        anchor(e, w, 84, TOP, tmp);
        const lx = tmp.x + Math.cos(e.t * 1.3) * 34;
        const ly = tmp.y + Math.sin(e.t * 2.6) * 12;
        steerTo(e, lx, ly, e.speed * (e.state === FD_ENTER ? 1.6 : 1.2));
        if (e.state === FD_ENTER) {
          if (e.timer > 1.8 && s.n === 0) {
            s.n = 1;
            say(w, e, "TAMAYA!!");
          }
          if (e.timer > 2.4) drift(e, s, 0.4);
        } else if (e.timer >= s.drift * k && (readable(e, w, TOP, 30) || e.timer > s.drift + 3)) nextPattern(e, w, s);
        break;
      }
      case FD_FLOURISH:
        e.vx = e.vy = 0;
        if (e.timer > 1.6) drift(e, s, 0.6);
        break;
      case FD_VOLLEY:
      case FD_FINALE:
        steerTo(e, e.x, e.y, 10);
        if (e.timer >= (e.state === FD_FINALE ? 1.9 : 1.3) * k) drift(e, s, 0.9);
        break;
      case FD_DANCE_TELE:
        // swing out to the start of the path (fast), then go
        steerTo(e, s.danceX, s.danceY + HEAD_Y, 320);
        if (e.timer >= 0.8 * k) {
          go(e, FD_DANCE);
          e.x = s.danceX;
          e.y = s.danceY + HEAD_Y;
        }
        break;
      case FD_DANCE: {
        const t = e.timer;
        const tx = s.danceX + s.danceDir * s.danceV * t;
        const ty = s.danceY + HEAD_Y + danceOff(t);
        e.vx = (tx - e.x) / dt;
        e.vy = (ty - e.y) / dt;
        e.face = s.danceDir;
        // ENCORE: the sparkler fans fly during the dance (70 % density: 6 stars)
        if (s.sub === 1 && ((s.n === 0 && t >= 1) || (s.n === 1 && t >= 2))) {
          s.n++;
          const y = e.y - HEAD_Y;
          fanOf(w, e.x, y, 6, aimAt(w, e.x, y), 0.2, 80 * speedK(w, s), STAR, "eb_firework", BURST_COLORS[s.colorI++ % BURST_COLORS.length], 10);
        }
        if (t >= 3) drift(e, s, 0.8);
        break;
      }
      case FD_BREATH: {
        steerTo(e, e.x, e.y, 8);
        const y = e.y - HEAD_Y;
        if (s.n < 2 && e.timer >= (0.6 + s.n * 0.45) * k) {
          const n = s.phase >= 3 ? 7 : 9;
          fanOf(w, e.x, y, n, aimAt(w, e.x, y) + (s.n === 1 ? 0.08 : 0), 0.16, 80 * speedK(w, s), STAR, "eb_firework", s.phase >= 2 ? BURST_COLORS[s.colorI++ % BURST_COLORS.length] : C.yellow, 12);
          s.n++;
          e.sqV -= 5;
        }
        if (e.timer >= 1.6 * k) drift(e, s, 0.8);
        break;
      }
      default:
        drift(e, s, 1);
    }
    e.z = 8 + Math.sin(e.t * 2.2) * 3;
    updateBody(e, s);
    if (e.state !== FD_ENTER && e.state !== FD_FLOURISH) bodyContact(e, w, s);
  },
  onDeath(e, w) {
    const s = STATE.get(e);
    if (s) {
      s.rt.fill(-1);
      // (GRAND FINALE's night override eases back out: the stage's own festival night remains)
      if (s.night) stageFx(w, "grade", 0, 2.5, "night");
    }
    if (w.isFinalBoss(e)) finalDawn(e, w);
    else w.clearBullets();
  },
};

export const bosses: EnemyDef[] = [fireworkDragon];
