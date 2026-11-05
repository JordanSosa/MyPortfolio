/**
 * Pumpkin Dasher (DESIGN §3.4): waddles after the player; every ~3 s it
 * plants its feet for a 0.5 s telegraph (shake + red flash in the view, an
 * aim lane on the ground), then dashes 180 px/s for 0.5 s in that fixed
 * direction (frames 2-3) and skids to a stop in a cloud of dust. The dash is
 * aimed once, at the start of the telegraph: a sidestep always dodges it.
 *
 * state 0 = walk (timer = cooldown), 1 = telegraph, 2 = dash, 3 = skid.
 * c/d = dash direction (unit).
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { EnemyDef } from "../types";
import { EFX_DASH, EFX_SKID, efx, onScreen } from "./_fx";
import { toPlayer } from "./_steer";

export const PUMPKIN_TELEGRAPH = 0.5;
export const PUMPKIN_DASH = 0.5;
export const PUMPKIN_DASH_SPEED = 180;
const SKID = 0.32;

const dir = { x: 0, y: 0 };

export const pumpkin: EnemyDef = {
  id: "pumpkin",
  name: "Pumpkin Dasher",
  sprite: "en_pumpkin",
  fps: 6,
  hp: 40,
  speed: 30,
  dmg: 10,
  radius: 6,
  height: 12,
  xp: 3,
  shadow: 12,
  knockResist: 0.2,
  colors: [C.orange, C.yellow, C.gold, C.green],
  init(e, w) {
    e.a = w.rng.next() * TAU;
    e.timer = w.rng.range(1.4, 3.4);
  },
  // art: f0-1 walk, f2-3 dash pose (leaning forward, angry eyes)
  frame(e) {
    if (e.state === 1) return 2;
    if (e.state === 2) return 2 + (Math.floor(e.timer * 14) & 1);
    if (e.state === 3) return e.timer < SKID * 0.6 ? 3 : 0;
    return Math.floor(e.t * 6 + e.a) & 1;
  },
  update(e, w, dt) {
    const k = e.speed / 30; // elites are a bit slower in everything
    e.timer += e.state === 0 ? -dt : dt;
    if (e.state === 0) {
      const d = toPlayer(e, w, dir);
      const bob = Math.abs(Math.sin(e.t * TAU * 1.5 + e.a));
      const sp = e.speed * (0.7 + 0.5 * bob);
      e.vx = dir.x * sp;
      e.vy = dir.y * sp;
      if (e.timer <= 0) {
        if (d > 6 && d < 140 && onScreen(w, e.x, e.y, -10)) {
          e.state = 1;
          e.timer = 0;
          e.c = dir.x;
          e.d = dir.y;
          e.face = dir.x >= 0 ? 1 : -1;
          const len = PUMPKIN_DASH_SPEED * k * PUMPKIN_DASH + 8 * e.scale;
          w.telegraphLine(e.x, e.y, e.x + e.c * len, e.y + e.d * len, e.r + 2, PUMPKIN_TELEGRAPH);
        } else e.timer = 0.25;
      }
    } else if (e.state === 1) {
      e.vx = e.vy = 0;
      // wind-up shiver (the view adds the jitter + red flash)
      if (((e.timer * 30) | 0) % 3 === 0) e.sqV -= 1.5;
      if (e.timer >= PUMPKIN_TELEGRAPH) {
        e.state = 2;
        e.timer = 0;
        e.sqV += 6;
        efx(w, EFX_DASH, e.x, e.y, e.c, e.d, e.scale, e);
      }
    } else if (e.state === 2) {
      const sp = PUMPKIN_DASH_SPEED * k;
      e.vx = e.c * sp;
      e.vy = e.d * sp;
      e.face = e.c >= 0 ? 1 : -1;
      if (e.timer >= PUMPKIN_DASH) {
        e.state = 3;
        e.timer = 0;
        e.sqV -= 8;
        efx(w, EFX_SKID, e.x, e.y, e.c, e.d, e.scale, e);
      }
    } else {
      // skid: slide to a stop
      const f = Math.max(0, 1 - e.timer / SKID);
      const sp = PUMPKIN_DASH_SPEED * k * 0.55 * f * f;
      e.vx = e.c * sp;
      e.vy = e.d * sp;
      e.face = e.c >= 0 ? 1 : -1;
      if (e.timer >= SKID) {
        e.state = 0;
        e.timer = w.rng.range(2.6, 3.4) * (w.director.enraged ? 0.8 : 1);
      }
    }
  },
};

export const enemies: EnemyDef[] = [pumpkin];
