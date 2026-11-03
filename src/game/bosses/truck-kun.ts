/**
 * TRUCK-KUN (The Final Arc 8:00 mid boss, docs/content/enemies.md §5.7).
 * "Reincarnation Services, Est. Too Many Protagonists Ago" - the legendary
 * isekai truck. If the hero IS Truck-kun: "TRUCK-KUN?!" - the evil
 * alternate-universe one (orange, with a moustache: the view draws it).
 *
 *   P1 (100-50 %)  Lane Change x3 -> Reverse Beep -> Traffic Cone Scatter (loop)
 *     Lane Change   headlights flash (f2); a lane across the whole view through the
 *                   hero (half width 16, 0.8 s); it charges across at 320 px/s, leaves
 *                   the view and re-enters from another side 0.6 s later
 *     Reverse Beep  backs up toward the hero for 4 s (f5); every beep (0.5 s) a ring of
 *                   10 eb_cone (50 px/s)
 *     Cone Scatter  lobs 8 cones to telegraphed spots (0.8 s); they land as static
 *                   hazards (eb_cone, 4 s)
 *   P2 (< 50 %) "RUSH HOUR" - it brought friends: 3 Mini Truck-kun lanes every 6 s,
 *     Lane Change x4 with 0.6 s telegraphs, Horn Blast (a telegraphed r 80 honk ring, 20)
 *
 * Death: "...HONK. (Translation: See you in the next world.)" - it isekai's
 * itself in a giant light pillar (view).
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { CFG } from "../config";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { shock } from "../enemies/_fx";
import { say } from "../enemies/_say";
import { BX_BEEP, BX_CONE, BX_HONK, BX_HORN, BX_TRUCK_LANE, cue } from "../enemies/_s45";
import { launchMiniTruck } from "../enemies/mini-truck";
import { anchor, go, heroInLane, phaseFlourish, readable, ringOf, steerTo } from "./_s45boss";

export const TK_ENTER = 0;
export const TK_DRIFT = 1;
export const TK_LANE_TELE = 2;
export const TK_LANE = 3;
export const TK_GONE = 4;
export const TK_BEEP = 5;
export const TK_CONES = 6;
export const TK_HORN_TELE = 7;
export const TK_HORN = 8;
export const TK_FLOURISH = 9;
export const TK_RETURN = 10;

const P_LANES = 0;
const P_BEEP = 1;
const P_CONES = 2;
const P_HORN = 3;
const CYCLES: readonly (readonly number[])[] = [[], [P_LANES, P_BEEP, P_CONES], [P_LANES, P_HORN, P_BEEP, P_CONES, P_HORN]];

const TOP = 48;
const BODY_Y = 14;
export const LANE_HALF = 16;
export const CHARGE_SPEED = 320;
const GONE = 0.6;
const BEEP_EVERY = 0.5;
const BEEP_TIME = 4;
const CONE_DMG = 14;
export const CONE_N = 8;
export const CONE_FLIGHT = 0.8;
export const CONE_LIFE = 4;
export const HORN_R = 80;
const HORN_TELE = 0.6;
const HORN_DMG = 20;
const RUSH_EVERY = 6;
/** Half the truck's length along its lane (contact during a charge). */
const HALF_LEN = 28;

export const TRUCK_TITLE = "TRUCK-KUN";
export const TRUCK_SUB = "Reincarnation Services, Est. Too Many Protagonists Ago";
export const EVIL_TITLE = "TRUCK-KUN?!";
export const EVIL_SUB = "The Evil Alternate-Universe One (It Has a Moustache)";

export interface TruckState {
  phase: number;
  pat: number;
  /** Lane changes left in this pattern, lane direction, lane start. */
  lanes: number;
  dx: number;
  dy: number;
  /** Contact damage parked during the charges (lane-accurate contact instead). */
  dmg: number;
  n: number;
  /** Lobbed cones in flight: target + seconds left (< 0 = free). */
  cx: Float32Array;
  cy: Float32Array;
  ct: Float32Array;
  rushT: number;
  /** The evil alternate-universe one (the hero is Truck-kun). */
  evil: boolean;
}

const STATE = new WeakMap<Enemy, TruckState>();

export function truckState(e: Enemy): TruckState | undefined {
  return STATE.get(e);
}

function st(e: Enemy): TruckState {
  let s = STATE.get(e);
  if (!s) {
    s = { phase: 1, pat: 0, lanes: 0, dx: 1, dy: 0, dmg: 22, n: 0, cx: new Float32Array(CONE_N), cy: new Float32Array(CONE_N), ct: new Float32Array(CONE_N).fill(-1), rushT: RUSH_EVERY, evil: false };
    STATE.set(e, s);
  }
  return s;
}

/** The name card follows the hero: Truck-kun meets its evil alternate-universe self. */
export function truckTitles(w: World): void {
  const b = truckKunBoss.boss;
  if (!b) return;
  const evil = w.hero.id === "truck_kun";
  b.title = evil ? EVIL_TITLE : TRUCK_TITLE;
  b.subtitle = evil ? EVIL_SUB : TRUCK_SUB;
}

function laneTele(s: TruckState): number {
  return s.phase >= 2 ? 0.6 : 0.8;
}

/** A random lane axis through the hero: mostly horizontal (readable on a phone), some vertical / diagonal. */
function pickDir(w: World, s: TruckState): void {
  const r = w.rng.next();
  const sgn = w.rng.next() < 0.5 ? -1 : 1;
  if (r < 0.6) {
    s.dx = sgn;
    s.dy = 0;
  } else if (r < 0.85) {
    s.dx = 0;
    s.dy = sgn;
  } else {
    s.dx = sgn * Math.SQRT1_2;
    s.dy = (w.rng.next() < 0.5 ? -1 : 1) * Math.SQRT1_2;
  }
}

/** Half the view along a direction (+ margin). */
function halfAlong(w: World, dx: number, dy: number, margin: number): number {
  return Math.abs(dx) * w.viewW * 0.5 + Math.abs(dy) * w.viewH * 0.5 + margin;
}

function startLane(e: Enemy, w: World, s: TruckState, fromHere: boolean): void {
  const p = w.player;
  const py = p.y;
  if (fromHere) {
    const dx = p.x - e.x;
    const dy = py - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    s.dx = dx / d;
    s.dy = dy / d;
  } else {
    pickDir(w, s);
    const back = halfAlong(w, s.dx, s.dy, 44);
    e.x = p.x - s.dx * back;
    e.y = py - s.dy * back;
    cue(w, BX_TRUCK_LANE, e.x, e.y, s.dx, s.dy, 1, e);
  }
  go(e, TK_LANE_TELE);
  e.face = s.dx >= 0 ? 1 : -1;
  e.untargetable = false;
  e.inv = 0;
  const far = halfAlong(w, s.dx, s.dy, 60);
  const ex = p.x + s.dx * far;
  const ey = py + s.dy * far;
  w.telegraphLine(e.x, e.y - BODY_Y, ex, ey - BODY_Y, LANE_HALF, laneTele(s), C.yellow);
  cue(w, BX_HONK, e.x, e.y - BODY_Y, s.dx, s.dy, 2, e);
  e.dmg = 0;
}

function nextPattern(e: Enemy, w: World, s: TruckState): void {
  const cyc = CYCLES[s.phase];
  const pat = cyc[s.pat % cyc.length];
  s.pat++;
  s.n = 0;
  switch (pat) {
    case P_LANES:
      s.lanes = s.phase >= 2 ? 4 : 3;
      startLane(e, w, s, true);
      break;
    case P_BEEP:
      go(e, TK_BEEP);
      break;
    case P_CONES: {
      go(e, TK_CONES);
      const p = w.player;
      for (let i = 0; i < CONE_N; i++) {
        let x = p.x;
        let y = p.y;
        if (i > 0) {
          const a = (i / (CONE_N - 1)) * TAU + w.rng.spread(0.3);
          const d = w.rng.range(26, 92);
          x += Math.cos(a) * d;
          y += Math.sin(a) * d * 0.8;
        }
        s.cx[i] = x;
        s.cy[i] = y;
        s.ct[i] = CONE_FLIGHT + i * 0.05;
        w.telegraphCircle(x, y, 7, CONE_FLIGHT + i * 0.05, C.orange);
        cue(w, BX_CONE, e.x, e.y - BODY_Y - 8, x, y, CONE_FLIGHT + i * 0.05, e);
      }
      break;
    }
    default:
      go(e, TK_HORN_TELE);
      w.telegraphCircle(e.x, e.y, HORN_R, HORN_TELE, C.yellow);
      cue(w, BX_HONK, e.x, e.y - BODY_Y, 0, 0, 3, e);
  }
}

function drift(e: Enemy, s: TruckState): void {
  go(e, TK_DRIFT);
  e.dmg = s.dmg;
}

/** Cones in flight land as static hazards; RUSH HOUR's Mini Truck-kun lanes. */
function tickExtras(e: Enemy, w: World, s: TruckState, dt: number): void {
  for (let i = 0; i < CONE_N; i++) {
    if (s.ct[i] < 0) continue;
    s.ct[i] -= dt;
    if (s.ct[i] <= 0) {
      s.ct[i] = -1;
      const b = w.spawnBullet(s.cx[i], s.cy[i] - 3, 0, 0, CONE_DMG, "eb_cone", 3.5, CONE_LIFE);
      b.tint = 0xffffff;
      shock(w, s.cx[i], s.cy[i], 10, 0.1);
    }
  }
  if (s.phase >= 2 && e.state !== TK_FLOURISH) {
    s.rushT -= dt;
    if (s.rushT <= 0) {
      s.rushT = RUSH_EVERY;
      rushHour(w);
    }
  }
}

/** Three parallel Mini Truck-kun lanes 40 px apart through the hero. */
function rushHour(w: World): void {
  const p = w.player;
  const horiz = w.rng.next() < 0.6;
  const sgn = w.rng.next() < 0.5 ? -1 : 1;
  const dx = horiz ? sgn : 0;
  const dy = horiz ? 0 : sgn;
  const back = halfAlong(w, dx, dy, 26);
  for (let k = -1; k <= 1; k++) {
    const ox = -dy * k * 40;
    const oy = dx * k * 40;
    launchMiniTruck(w, p.x + ox - dx * back, p.y + oy - dy * back, p.x + ox, p.y + oy);
  }
  w.emit("waveIncoming", { kind: "lanes", x: p.x - dx * back, y: p.y - dy * back, label: "RUSH HOUR!" });
}

const tmp = { x: 0, y: 0 };

export const truckKunBoss: EnemyDef = {
  id: "truck_kun_boss",
  name: "Truck-kun",
  sprite: "boss_truck",
  fps: 8,
  hp: 300000,
  speed: 60,
  dmg: 22,
  radius: 18,
  height: 26,
  xp: 0,
  shadow: 60,
  knockResist: 1,
  noSeparation: true,
  colors: [C.white, C.red, C.offWhite, C.yellow, C.lightBlue],
  boss: { title: TRUCK_TITLE, subtitle: TRUCK_SUB, music: "boss", level: 45 },
  // art: f0-1 idle rumble, f2 headlights flash, f3 charge, f4 drift (tyre smoke), f5 reverse
  frame(e) {
    switch (e.state) {
      case TK_LANE_TELE:
      case TK_HORN_TELE:
        return Math.floor(e.timer * 10) & 1 ? 2 : 0;
      case TK_LANE:
        return 3;
      case TK_RETURN:
        return 4;
      case TK_BEEP:
        return 5;
      case TK_HORN:
        return 2;
      default:
        return Math.floor(e.t * 10) & 1;
    }
  },
  init(e, w) {
    truckTitles(w);
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.lanes = 0;
    s.dmg = e.dmg;
    s.ct.fill(-1);
    s.rushT = RUSH_EVERY;
    s.evil = w.hero.id === "truck_kun";
    go(e, TK_ENTER);
    e.inv = 2.2;
  },
  update(e, w, dt) {
    const s = st(e);
    const p = w.player;
    e.timer += dt;
    tickExtras(e, w, s, dt);

    // RUSH HOUR at 50 % (never skipped; waits for a charge to finish)
    if (s.phase === 1 && e.hp < e.maxHp * 0.5 && (e.state === TK_DRIFT || e.state === TK_BEEP || e.state === TK_CONES)) {
      s.phase = 2;
      s.pat = 0;
      go(e, TK_FLOURISH);
      e.dmg = s.dmg;
      phaseFlourish(e, w, 2, "RUSH HOUR", "it brought friends", "HONK HONK.");
      cue(w, BX_HONK, e.x, e.y - BODY_Y, 0, 0, 3, e);
    }

    switch (e.state) {
      case TK_ENTER: {
        anchor(e, w, 84, TOP, tmp);
        steerTo(e, tmp.x, tmp.y, e.speed * 2);
        if (e.timer > 1.8 && s.n === 0) {
          s.n = 1;
          say(w, e, "HONK.");
        }
        if (e.timer > 2.4) drift(e, s);
        break;
      }
      case TK_FLOURISH:
        e.vx = e.vy = 0;
        if (e.timer > 1.6) drift(e, s);
        break;
      case TK_DRIFT: {
        anchor(e, w, 84, TOP, tmp);
        const far = Math.abs(e.x - p.x) > w.viewW * 0.45 || Math.abs(e.y - p.y) > w.viewH * 0.45;
        steerTo(e, tmp.x, tmp.y, e.speed * (far ? 3 : 1));
        if (e.timer >= 1 && (readable(e, w, TOP) || e.timer > 4)) nextPattern(e, w, s);
        break;
      }
      case TK_LANE_TELE:
        e.vx = -s.dx * 6;
        e.vy = -s.dy * 6;
        if (e.timer >= laneTele(s)) {
          go(e, TK_LANE);
          e.sqV += 8;
          shock(w, e.x, e.y, 24, 0.3);
        }
        break;
      case TK_LANE: {
        e.vx = s.dx * CHARGE_SPEED;
        e.vy = s.dy * CHARGE_SPEED;
        // lane-accurate contact: the hero inside the 16 px lane where the truck is
        const y = e.y - BODY_Y;
        if (heroInLane(w, e.x - s.dx * HALF_LEN, y - s.dy * HALF_LEN, e.x + s.dx * HALF_LEN, y + s.dy * HALF_LEN, LANE_HALF + CFG.playerRadius * 0.5)) w.hurtPlayer(s.dmg, e.x, e.y, e.def.id);
        const along = (e.x - p.x) * s.dx + (e.y - p.y) * s.dy;
        if (along > halfAlong(w, s.dx, s.dy, 56)) {
          go(e, TK_GONE);
          e.vx = e.vy = 0;
          e.untargetable = true;
          e.inv = GONE + 0.1;
          s.lanes--;
          cue(w, BX_TRUCK_LANE, e.x, e.y, s.dx, s.dy, 0, e);
        }
        break;
      }
      case TK_GONE:
        e.vx = e.vy = 0;
        if (e.timer >= GONE) {
          if (s.lanes > 0) startLane(e, w, s, false);
          else {
            // re-enter from a new side and drift back to its spot
            pickDir(w, s);
            const back = halfAlong(w, s.dx, s.dy, 30);
            e.x = p.x - s.dx * back;
            e.y = p.y - s.dy * back;
            e.untargetable = false;
            e.inv = 0;
            go(e, TK_RETURN);
            cue(w, BX_TRUCK_LANE, e.x, e.y, s.dx, s.dy, 1, e);
          }
        }
        break;
      case TK_RETURN: {
        anchor(e, w, 84, TOP, tmp);
        steerTo(e, tmp.x, tmp.y, CHARGE_SPEED * 0.45);
        if (e.timer > 0.9) drift(e, s);
        break;
      }
      case TK_BEEP: {
        // backs up toward the hero, beeping
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const sp = d > 50 ? 40 : 0;
        e.vx = (dx / d) * sp;
        e.vy = (dy / d) * sp;
        if (e.timer >= (s.n + 1) * BEEP_EVERY && s.n < BEEP_TIME / BEEP_EVERY) {
          s.n++;
          ringOf(w, e.x, e.y - BODY_Y, 10, (s.n & 1) * (Math.PI / 10) + e.t * 0.3, 50, CONE_DMG, "eb_cone", 0xffffff, 16);
          cue(w, BX_BEEP, e.x, e.y - BODY_Y, 0, 0, s.n, e);
          e.sqV -= 3;
        }
        if (e.timer >= BEEP_TIME + 0.3) drift(e, s);
        break;
      }
      case TK_CONES:
        e.vx = e.vy = 0;
        if (e.timer >= CONE_FLIGHT + CONE_N * 0.05 + 0.4) drift(e, s);
        break;
      case TK_HORN_TELE:
        e.vx = e.vy = 0;
        if (e.timer >= HORN_TELE) {
          go(e, TK_HORN);
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          if (dx * dx + dy * dy < HORN_R * HORN_R) w.hurtPlayer(HORN_DMG, e.x, e.y, e.def.id);
          shock(w, e.x, e.y - BODY_Y, HORN_R, 1);
          cue(w, BX_HORN, e.x, e.y - BODY_Y, 0, 0, HORN_R, e);
          e.sqV += 10;
        }
        break;
      case TK_HORN:
        e.vx = e.vy = 0;
        if (e.timer >= 0.6) drift(e, s);
        break;
      default:
        drift(e, s);
    }
    if (e.state === TK_LANE || e.state === TK_RETURN || e.state === TK_LANE_TELE) e.face = s.dx >= 0 ? 1 : s.dx < 0 ? -1 : e.face;
  },
  onDeath(e, w) {
    const s = STATE.get(e);
    if (s) s.ct.fill(-1);
    w.clearBullets();
  },
};

export const bosses: EnemyDef[] = [truckKunBoss];
