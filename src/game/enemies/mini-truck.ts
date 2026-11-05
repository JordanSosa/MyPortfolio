/**
 * MINI TRUCK-KUN (The Final Arc, docs/content/enemies.md §4). Truck-kun's
 * nephew, learning the family business. A lane charger: it spawns just outside
 * the view, telegraphs a lane through the hero's position (0.8 s, headlights
 * flashing f2, "HONK!"), then drives straight across at 200 px/s and leaves the
 * view - never stops, never turns. Also the truck of the `laneCharge` events
 * (MODE_STRAIGHT) and of Truck-kun's RUSH HOUR (`launchMiniTruck`).
 *
 * Twist - Friendly Fire: enemies in its lane are hit too (its contact damage)
 * and "isekai'd" if that kills them (a light pillar; no XP for the hero). It
 * clears lanes for you if you stand right. Elite "Semi-Truck": twice as long
 * (the view stretches it), lane telegraph 1.0 s.
 *
 * state -1 not aimed yet, 0 telegraph, 1 drive. c/d = lane direction, a = 1 once it honked
 * (MODE_STRAIGHT trucks honk when they enter the view).
 */
import { C } from "../../art/palette";
import { CH_MISC } from "../config";
import { MODE_STRAIGHT, type Enemy, type EnemyDef } from "../types";
import type { World } from "../world";
import { onScreen } from "./_fx";
import { BX_HONK, BX_ISEKAI, Q_HONK, cue, quip } from "./_s45";

export const TRUCK_TELE = 0.8;
export const SEMI_TELE = 1.0;
export const LANE_HALF = 10;
/** Re-hit window for the same enemy (one bump per pass). */
const BUMP_EVERY = 0.6;

const hooked = new WeakSet<World>();

function honk(e: Enemy, w: World): void {
  e.a = 1;
  cue(w, BX_HONK, e.x, e.y - e.cy, e.c, e.d, e.scale, e);
  quip(w, e, "HONK!", Q_HONK, 3);
}

/** Friendly fire: every driving Mini Truck-kun bumps (and isekai's) the enemies in its way. */
function install(w: World): void {
  if (hooked.has(w)) return;
  hooked.add(w);
  w.hooks.on("step", () => {
    if (w.phase !== "play") return;
    const items = w.enemies.items;
    for (let i = 0; i < w.enemies.count; i++) {
      const t = items[i];
      if (t.dead || t.def !== miniTruck) continue;
      const straight = t.mode === MODE_STRAIGHT;
      if (!straight && t.state !== 1) continue;
      // lane-event trucks honk as they roll into view
      if (straight && t.a === 0 && onScreen(w, t.x, t.y, 0)) {
        const l = Math.sqrt(t.vx * t.vx + t.vy * t.vy) || 1;
        t.c = t.vx / l;
        t.d = t.vy / l;
        honk(t, w);
      }
      bump(t, w);
    }
  });
}

function bump(t: Enemy, w: World): void {
  const ty = t.y - t.cy;
  const reach = t.r * (t.elite ? 1.6 : 1) + 4;
  const buf = w.acquire();
  const n = w.grid.query(t.x, ty, reach + 16, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const o = items[buf[k]];
    if (!o || o === t || o.dead || o.def.boss || o.def.prop || o.def === miniTruck) continue;
    const dx = o.x - t.x;
    const dy = o.y - o.cy - ty;
    const rr = reach + o.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (w.t - o.lastHit[CH_MISC] < BUMP_EVERY) continue;
    o.lastHit[CH_MISC] = w.t;
    const dmg = t.dmg;
    if (o.hp <= dmg) {
      // isekai'd: off to another world (no XP, no kill credit for the hero)
      cue(w, BX_ISEKAI, o.x, o.y, 0, 0, o.scale, o);
      w.despawn(o);
    } else w.hitEnemy(o, dmg, null, Math.atan2(t.vy, t.vx), 140, 0, "mini_truck", C.yellow);
  }
  w.release();
}

/** Aim a fresh truck down a lane: it telegraphs from where it stands through (tx, ty), then drives. */
export function aimTruck(e: Enemy, w: World, tx: number, ty: number): void {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  e.c = dx / d;
  e.d = dy / d;
  e.state = 0;
  e.timer = 0;
  e.face = e.c >= 0 ? 1 : -1;
  const len = d + Math.max(w.viewW, w.viewH) * 0.75 + 40;
  w.telegraphLine(e.x, e.y - e.cy, e.x + e.c * len, e.y - e.cy + e.d * len, LANE_HALF, e.elite ? SEMI_TELE : TRUCK_TELE, C.yellow);
  honk(e, w);
}

/** Truck-kun's RUSH HOUR: a Mini Truck-kun at (x, y) aimed through (tx, ty). */
export function launchMiniTruck(w: World, x: number, y: number, tx: number, ty: number): Enemy | null {
  const e = w.spawnEnemy("mini_truck", x, y);
  if (e && !e.dead) aimTruck(e, w, tx, ty);
  return e;
}

export const miniTruck: EnemyDef = {
  id: "mini_truck",
  name: "Mini Truck-kun",
  sprite: "en_mini_truck",
  fps: 8,
  hp: 110,
  speed: 200,
  dmg: 16,
  radius: 8,
  height: 10,
  xp: 5,
  shadow: 18,
  knockResist: 0.9,
  noSeparation: true,
  colors: [C.white, C.lightBlue, C.yellow],
  init(e, w) {
    install(w);
    e.a = 0;
    // (aimed on its first update: a lane-event truck is switched to MODE_STRAIGHT right after spawning)
    e.state = -1;
  },
  // art: f0-1 idle/drive (wheels), f2 headlights flash, f3 boost (exhaust flame)
  frame(e) {
    if (e.mode === MODE_STRAIGHT) return Math.floor(e.t * 10) & 1 ? 3 : 0;
    if (e.state === 0) return Math.floor(e.timer * 8) & 1 ? 2 : 0;
    return e.timer < 0.3 ? 3 : Math.floor(e.t * 12) & 1;
  },
  update(e, w, dt) {
    // from the spawn ring: a lane through the hero's spot right now
    if (e.state === -1) aimTruck(e, w, w.player.x, w.player.y);
    e.timer += dt;
    if (e.state === 0) {
      e.vx = e.vy = 0;
      if (e.timer >= (e.elite ? SEMI_TELE : TRUCK_TELE)) {
        e.state = 1;
        e.timer = 0;
        e.sqV += 6;
      }
      return;
    }
    e.vx = e.c * e.speed;
    e.vy = e.d * e.speed;
    e.face = e.c >= 0 ? 1 : -1;
    // gone once it has crossed the view (never turns back)
    const p = w.player;
    const along = (e.x - p.x) * e.c + (e.y - p.y) * e.d;
    if (along > Math.max(w.viewW, w.viewH) * 0.5 + 40) w.despawn(e);
  },
};

export const enemies: EnemyDef[] = [miniTruck];
