/**
 * CRAB-KUN (Beach Episode, docs/content/enemies.md §3). Crabs only walk
 * sideways: it strafes around the hero at ~50 px, facing her, and when it
 * lines up (the hero within 15 deg of its front = level with it) it raises
 * its claws (0.3 s tell, f2) and lunges 30 px with them open (f3).
 *
 * Twist - Sidestep: a player projectile closing in has a 20 % chance to be
 * dodged - it scuttles 8 px sideways, the shot passes ("Sidestep!") - at most
 * once per second. Elite "King Crab": lunges twice.
 *
 * state 0 strafe (timer = lunge cooldown), 1 tell, 2 lunge, 3 recover.
 * a = orbit direction (+-1), b = next sidestep roll (World.t),
 * c = lunge direction x (+-1), d = lunges left.
 */
import { C } from "../../art/palette";
import { clamp } from "../../core/math";
import { PK_FREE, type Enemy, type EnemyDef } from "../types";
import type { World } from "../world";
import { BX_LUNGE, BX_SIDESTEP, Q_SIDESTEP, cue, quip } from "./_s45";
import { onScreen } from "./_fx";

export const CRAB_TELL = 0.3;
export const CRAB_LUNGE = 0.15;
/** Lunge length (px, x scale). */
export const CRAB_LUNGE_PX = 30;
const RECOVER = 0.3;
/** tan(15 deg): "lined up" = the hero within 15 deg of the crab's front. */
const LINE_UP = 0.268;
export const CRAB_DODGE = 0.2;

function strafeRadius(e: Enemy): number {
  return 46 + (e.uid % 9);
}

/** Sidestep roll against the nearest incoming free projectile (one roll per ~0.12 s, one dodge per second). */
function sidestep(e: Enemy, w: World): void {
  if (w.t < e.b || ((w.steps + e.uid) & 1) !== 0) return;
  const ex = e.x;
  const ey = e.y - e.cy;
  const pr = w.projectiles.items;
  for (let i = 0; i < w.projectiles.count; i++) {
    const p = pr[i];
    if (p.dead || p.kind !== PK_FREE || p.r <= 0 || p.age < p.delay) continue;
    const dx = ex - p.x;
    const dy = ey - p.y;
    const reach = p.r + e.r + 16;
    const d2 = dx * dx + dy * dy;
    if (d2 > reach * reach || dx * p.vx + dy * p.vy <= 0) continue;
    const vl = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (vl < 20) continue;
    if (w.rng.next() >= CRAB_DODGE) {
      e.b = w.t + 0.12;
      return;
    }
    // scuttle perpendicular to the shot, away from its line, far enough to clear it
    const nx = -p.vy / vl;
    const ny = p.vx / vl;
    const off = dx * nx + dy * ny;
    const side = off >= 0 ? 1 : -1;
    const shift = Math.max(8, p.r + e.r + 2 - Math.abs(off));
    e.x += nx * side * shift;
    e.y += ny * side * shift;
    // the shot passes: it can't hit this crab again on this flight / for its re-hit window
    if (p.hitEvery > 0) e.lastHit[p.ch] = w.t + 0.25;
    else {
      p.hits[p.nHits % p.hits.length] = e.uid;
      p.nHits++;
    }
    e.b = w.t + 1;
    e.sqV += 5;
    quip(w, e, "Sidestep!", Q_SIDESTEP, 5);
    cue(w, BX_SIDESTEP, e.x, e.y, nx * side, ny * side, shift, e);
    return;
  }
}

function tell(e: Enemy, dir: number): void {
  e.state = 1;
  e.timer = 0;
  e.c = dir;
  e.vx = e.vy = 0;
  e.sqV -= 4;
}

export const crabKun: EnemyDef = {
  id: "crab_kun",
  name: "Crab-kun",
  sprite: "en_crab",
  fps: 8,
  hp: 48,
  speed: 40,
  dmg: 9,
  radius: 7,
  height: 9,
  xp: 2,
  shadow: 13,
  knockResist: 0.4,
  colors: [C.red, C.orange, C.white],
  init(e, w) {
    e.a = w.rng.next() < 0.5 ? -1 : 1;
    e.timer = w.rng.range(0.8, 2);
    e.b = 0;
    e.d = 0;
  },
  // art: f0-1 sideways scuttle, f2 claws up (tell), f3 lunge
  frame(e) {
    if (e.state === 1) return 2;
    if (e.state === 2) return 3;
    if (e.state === 3) return e.timer < 0.12 ? 3 : 2;
    return Math.floor(e.t * 10 + e.uid) & 1;
  },
  update(e, w, dt) {
    const p = w.player;
    sidestep(e, w);
    if (e.state === 0) {
      e.timer -= dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > 110) {
        // scuttle in diagonally until it can start circling
        e.vx = (dx / d) * e.speed;
        e.vy = (dy / d) * e.speed;
      } else {
        // strafe: tangential around the hero, holding ~50 px
        const k = clamp((d - strafeRadius(e)) / 24, -1, 1);
        const tx = (-dy / d) * e.a;
        const ty = (dx / d) * e.a;
        e.vx = (tx * 0.9 + (dx / d) * k * 0.7) * e.speed;
        e.vy = (ty * 0.9 + (dy / d) * k * 0.7) * e.speed;
        // lined up (level with her, in reach): claws up
        const ax = Math.abs(dx);
        if (e.timer <= 0 && ax > 10 && ax < 72 && Math.abs(dy) < ax * LINE_UP && onScreen(w, e.x, e.y, -6)) {
          e.d = e.elite ? 2 : 1;
          tell(e, dx >= 0 ? 1 : -1);
        }
      }
      // keep orbiting the same way, but sometimes switch (a crab changes its mind)
      if (((w.steps + e.uid) % 240) === 0 && w.rng.next() < 0.3) e.a = -e.a;
    } else if (e.state === 1) {
      e.timer += dt;
      e.vx = e.vy = 0;
      if (e.timer >= CRAB_TELL) {
        e.state = 2;
        e.timer = 0;
        e.sqV += 6;
        cue(w, BX_LUNGE, e.x, e.y, e.c, 0, e.scale, e);
      }
    } else if (e.state === 2) {
      e.timer += dt;
      e.vx = (e.c * CRAB_LUNGE_PX * e.scale) / CRAB_LUNGE;
      e.vy = 0;
      if (e.timer >= CRAB_LUNGE) {
        e.state = 3;
        e.timer = 0;
        e.d--;
      }
    } else {
      e.timer += dt;
      e.vx = e.vy = 0;
      if (e.timer >= RECOVER) {
        // King Crab: a second lunge, re-aimed at the hero's side
        if (e.d > 0) tell(e, p.x >= e.x ? 1 : -1);
        else {
          e.state = 0;
          e.timer = w.rng.range(1.2, 2.2);
        }
      }
    }
  },
};

export const enemies: EnemyDef[] = [crabKun];
