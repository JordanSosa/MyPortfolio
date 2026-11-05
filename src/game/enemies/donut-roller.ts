/**
 * Donut Roller (Candy Kingdom, enemies.md §1): the Pumpkin Dasher pattern.
 * Every ~3.5 s it spins in place for 0.6 s (telegraph: a lane on the ground,
 * sprinkles flying off), then rolls at 165 px/s in a straight line for 1.2 s
 * and skids to a stop.
 *
 * Twist - Ricochet: a roll that would leave the camera view bounces off the
 * view edge ONCE and keeps rolling for the remaining time. The bounce point is
 * decided (and telegraphed as a second lane segment) when the spin starts, so
 * the warning is exact. Elite "Glazed and Confused": rolls twice in a row (the
 * second lane telegraphed 0.3 s, re-aimed at the player).
 * laneCharge events fly them straight across in MODE_STRAIGHT (rolling frames).
 *
 * state 0 = waddle (timer = cooldown), 1 = spin, 2 = roll, 3 = skid, 4 = second
 * spin (elite), 5 = second roll. c/d = roll direction (unit), b = distance into
 * the roll where it bounces (+ = flip x, - = flip y, 0 = no bounce), a = gait phase.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { MODE_STRAIGHT, type Enemy, type EnemyDef } from "../types";
import type { World } from "../world";
import { EFX_DASH, EFX_SKID, efx, onScreen } from "./_fx";
import { toPlayer } from "./_steer";
import { candyInstall, CK_BOUNCE, CK_SPIN } from "./_candy";
import { cue } from "./_cue";

export const DONUT_SPIN = 0.6;
export const DONUT_SPIN2 = 0.3;
export const DONUT_ROLL = 1.2;
export const DONUT_SPEED = 165;
const SKID = 0.3;
/** Lane telegraph colour (frosting pink). */
const LANE = 0xff7ab8;

export const DONUT_WADDLE = 0;
export const DONUT_SPINNING = 1;
export const DONUT_ROLLING = 2;
export const DONUT_SKID = 3;
export const DONUT_SPINNING2 = 4;
export const DONUT_ROLLING2 = 5;

const dir = { x: 0, y: 0 };

/** Telegraph the planned roll path (the lane up to the bounce + the reflected rest) for `life` s. */
function drawPath(e: Enemy, w: World, life: number): void {
  const len = DONUT_SPEED * (e.speed / 26) * DONUT_ROLL;
  const r = e.r + 2;
  const hit = Math.abs(e.b);
  if (e.b !== 0 && hit < len) {
    const bx = e.x + e.c * hit;
    const by = e.y + e.d * hit;
    const c2 = e.b > 0 ? -e.c : e.c;
    const d2 = e.b > 0 ? e.d : -e.d;
    w.telegraphLine(e.x, e.y, bx, by, r, life, LANE);
    w.telegraphLine(bx, by, bx + c2 * (len - hit), by + d2 * (len - hit), r, life, LANE);
  } else w.telegraphLine(e.x, e.y, e.x + e.c * len, e.y + e.d * len, r, life, LANE);
}

/**
 * Plan a roll from the donut's position along (c, d): where it would leave the
 * view it bounces (e.b), and the whole path is telegraphed for `tele` s.
 */
function plan(e: Enemy, w: World, tele: number): void {
  const k = e.speed / 26;
  const len = DONUT_SPEED * k * DONUT_ROLL;
  const p = w.player;
  const hw = w.viewW * 0.5 - 6;
  const hh = w.viewH * 0.5 - 6;
  // distance along the path to each view wall it heads toward
  let tx = Infinity;
  let ty = Infinity;
  if (e.c > 1e-4) tx = (p.x + hw - e.x) / e.c;
  else if (e.c < -1e-4) tx = (p.x - hw - e.x) / e.c;
  if (e.d > 1e-4) ty = (p.y + hh - e.y) / e.d;
  else if (e.d < -1e-4) ty = (p.y - hh - e.y) / e.d;
  const hit = Math.min(tx, ty);
  e.b = hit > 4 && hit < len ? (tx < ty ? hit : -hit) : 0;
  drawPath(e, w, tele);
}

function aim(e: Enemy, w: World): void {
  toPlayer(e, w, dir);
  e.c = dir.x;
  e.d = dir.y;
  e.face = dir.x >= 0 ? 1 : -1;
}

export const donutRoller: EnemyDef = {
  id: "donut_roller",
  name: "Donut Roller",
  sprite: "en_donut",
  fps: 6,
  hp: 44,
  speed: 26,
  dmg: 11,
  radius: 7,
  height: 10,
  xp: 3,
  shadow: 13,
  knockResist: 0.3,
  colors: [C.pink, C.pinkLight, C.offWhite, C.yellow],
  init(e, w) {
    candyInstall(w);
    e.a = w.rng.next() * TAU;
    e.timer = w.rng.range(1.5, 3.5);
  },
  // art: f0-1 waddle, f2-3 rolling (the view also spins the sprite while rolling)
  frame(e) {
    if (e.mode === MODE_STRAIGHT || e.state === DONUT_ROLLING || e.state === DONUT_ROLLING2) return 2 + (Math.floor(e.t * 16) & 1);
    if (e.state === DONUT_SPINNING || e.state === DONUT_SPINNING2) return 2 + (Math.floor(e.t * 10) & 1);
    if (e.state === DONUT_SKID) return 2;
    return Math.floor(e.t * 6 + e.a) & 1;
  },
  update(e, w, dt) {
    const k = e.speed / 26;
    e.timer += e.state === DONUT_WADDLE ? -dt : dt;
    switch (e.state) {
      case DONUT_WADDLE: {
        const d = toPlayer(e, w, dir);
        const bob = Math.abs(Math.sin(e.t * TAU * 1.5 + e.a));
        const sp = e.speed * (0.7 + 0.5 * bob);
        e.vx = dir.x * sp;
        e.vy = dir.y * sp;
        if (e.timer <= 0) {
          // (rolls start from a readable distance: never point-blank)
          if (d > 40 && d < 150 && onScreen(w, e.x, e.y, -10)) {
            e.state = DONUT_SPINNING;
            e.timer = 0;
            aim(e, w);
            plan(e, w, DONUT_SPIN);
            cue(w, CK_SPIN, e.x, e.y - e.cy, e.c, e.d, e.scale, 0, e);
          } else e.timer = 0.3;
        }
        break;
      }
      case DONUT_SPINNING:
      case DONUT_SPINNING2: {
        e.vx = e.vy = 0;
        if (((e.timer * 30) | 0) % 3 === 0) e.sqV -= 1.2;
        const T = e.state === DONUT_SPINNING ? DONUT_SPIN : DONUT_SPIN2;
        if (e.timer >= T) {
          e.state = e.state === DONUT_SPINNING ? DONUT_ROLLING : DONUT_ROLLING2;
          e.timer = 0;
          e.sqV += 6;
          // the lane stays marked while it rolls (the danger is the roll, not the spin)
          drawPath(e, w, DONUT_ROLL);
          efx(w, EFX_DASH, e.x, e.y, e.c, e.d, e.scale, e);
        }
        break;
      }
      case DONUT_ROLLING:
      case DONUT_ROLLING2: {
        const sp = DONUT_SPEED * k;
        // Ricochet: once, at the planned point on the view edge
        if (e.b !== 0 && e.timer * sp >= Math.abs(e.b)) {
          if (e.b > 0) e.c = -e.c;
          else e.d = -e.d;
          e.b = 0;
          e.sqV -= 8;
          cue(w, CK_BOUNCE, e.x, e.y - e.cy, e.c, e.d, e.scale, 0, e);
        }
        e.vx = e.c * sp;
        e.vy = e.d * sp;
        e.face = e.c >= 0 ? 1 : -1;
        if (e.timer >= DONUT_ROLL) {
          e.timer = 0;
          if (e.elite && e.state === DONUT_ROLLING) {
            // Glazed and Confused: straight into a second roll
            e.state = DONUT_SPINNING2;
            aim(e, w);
            plan(e, w, DONUT_SPIN2);
          } else {
            e.state = DONUT_SKID;
            e.sqV -= 8;
            efx(w, EFX_SKID, e.x, e.y, e.c, e.d, e.scale, e);
          }
        }
        break;
      }
      default: {
        const f = Math.max(0, 1 - e.timer / SKID);
        const sp = DONUT_SPEED * k * 0.5 * f * f;
        e.vx = e.c * sp;
        e.vy = e.d * sp;
        if (e.timer >= SKID) {
          e.state = DONUT_WADDLE;
          e.timer = w.rng.range(3.1, 3.9) * (w.director.enraged ? 0.8 : 1);
        }
      }
    }
  },
};

export const enemies: EnemyDef[] = [donutRoller];
