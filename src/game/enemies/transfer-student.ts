/**
 * Transfer Student (Shoujo Academy, enemies.md §2): seek + teleport.
 *
 * Twist - Mysterious Arrival: never walks in from the spawn ring. A spawn far
 * from the player waits hidden (untargetable, harmless) while a sparkle circle
 * (r 10, 0.6 s) marks a spot 36-60 px from the player, then appears there
 * ("New student!"). Spawned close by (the teleportIn event already
 * telegraphed it) it simply arrives. Every 5 s it blinks to a new spot 40 px
 * from the player (0.5 s telegraph circle at the destination; it can't be hit
 * while blinking: inv 0.2 s). Elite "Exchange Student": blinks every 3 s and
 * leaves a ring of 6 eb_orb where it left.
 *
 * state 0 = arriving (hidden), 1 = walk, 2 = blink telegraph, 3 = tele-in.
 * timer = state clock, b = blink countdown (stored contact damage while hidden),
 * c/d = destination, a = gait phase.
 */
import { C } from "../../art/palette";
import { TAU, clamp } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { ring } from "./_bullets";
import { toPlayer } from "./_steer";
import { academyInstall, SA_TELE_IN, SA_TELE_OUT, shoutOk } from "./_academy";
import { cue } from "./_cue";
import { say } from "./_say";

export const TS_ARRIVE_T = 0.6;
export const TS_BLINK_TELE = 0.5;
const BLINK_EVERY = 5;
const BLINK_EVERY_ELITE = 3;
const TELE_IN_T = 0.2;
/** Spawned closer than this to the player = it was already telegraphed (teleportIn). */
const NEAR = 80;
const SPARKLE = 0xddc6ff;

export const TS_ARRIVING = 0;
export const TS_WALK = 1;
export const TS_BLINKING = 2;
export const TS_TELE_IN = 3;

const dir = { x: 0, y: 0 };

/** A spot `r0..r1` px from the player, on screen, not on top of the student itself. */
function spot(e: Enemy, w: World, r0: number, r1: number): void {
  const p = w.player;
  const hw = w.viewW * 0.5 - 14;
  const hh = w.viewH * 0.5 - 18;
  for (let tries = 0; tries < 6; tries++) {
    const a = w.rng.angle();
    const r = w.rng.range(r0, r1);
    e.c = clamp(p.x + Math.cos(a) * r, p.x - hw, p.x + hw);
    e.d = clamp(p.y + Math.sin(a) * r, p.y - hh + 10, p.y + hh);
    const dx = e.c - e.x;
    const dy = e.d - e.y;
    if (dx * dx + dy * dy > 30 * 30) return;
  }
}

function arrive(e: Enemy, w: World): void {
  e.x = e.c;
  e.y = e.d;
  e.kx = e.ky = 0;
  e.state = TS_TELE_IN;
  e.timer = 0;
  e.alpha = 1;
  e.untargetable = false;
  e.inv = TELE_IN_T;
  e.sqV += 8;
  cue(w, SA_TELE_IN, e.x, e.y - e.cy, 0, 0, e.scale, 0, e);
}

export const transferStudent: EnemyDef = {
  id: "transfer_student",
  name: "Transfer Student",
  sprite: "en_transfer_student",
  fps: 6,
  hp: 48,
  speed: 30,
  dmg: 11,
  radius: 6,
  height: 15,
  xp: 3,
  shadow: 10,
  knockResist: 0.1,
  colors: [C.lightBlue, C.navy, C.white],
  init(e, w) {
    academyInstall(w);
    e.a = w.rng.next() * TAU;
    const dx = e.x - w.player.x;
    const dy = e.y - w.player.y;
    if (dx * dx + dy * dy < NEAR * NEAR) {
      // already telegraphed (teleportIn): it just appears
      e.c = e.x;
      e.d = e.y;
      arrive(e, w);
      e.b = (e.elite ? BLINK_EVERY_ELITE : BLINK_EVERY) * w.rng.range(0.6, 1);
      return;
    }
    // hidden until the sparkle circle has played (no contact damage, no auto-aim, no hits)
    e.state = TS_ARRIVING;
    e.timer = 0;
    e.alpha = 0;
    e.untargetable = true;
    e.inv = TS_ARRIVE_T + 0.1;
    e.b = e.dmg;
    e.dmg = 0;
    spot(e, w, 36, 60);
    w.telegraphCircle(e.c, e.d, 10, TS_ARRIVE_T, SPARKLE);
  },
  // art: f0-1 walk (scarf waves), f2 teleport-out (sparkle dissolve), f3 teleport-in
  frame(e) {
    if (e.state === TS_BLINKING) return e.timer > TS_BLINK_TELE - 0.2 ? 2 : Math.floor(e.t * 5 + e.a) & 1;
    if (e.state === TS_TELE_IN || e.state === TS_ARRIVING) return 3;
    return Math.floor(e.t * 5 + e.a) & 1;
  },
  update(e, w, dt) {
    e.timer += dt;
    switch (e.state) {
      case TS_ARRIVING:
        e.vx = e.vy = 0;
        if (e.timer >= TS_ARRIVE_T) {
          e.dmg = e.b;
          arrive(e, w);
          e.b = e.elite ? BLINK_EVERY_ELITE : BLINK_EVERY;
          if (shoutOk(w, 0.9)) say(w, e, "New student!");
        }
        break;
      case TS_TELE_IN:
        e.vx = e.vy = 0;
        if (e.timer >= TELE_IN_T) {
          e.state = TS_WALK;
          e.timer = 0;
        }
        break;
      case TS_WALK: {
        toPlayer(e, w, dir);
        const sw = 0.85 + 0.2 * Math.sin(e.t * TAU * 1.2 + e.a);
        e.vx = dir.x * e.speed * sw;
        e.vy = dir.y * e.speed * sw;
        e.b -= dt;
        if (e.b <= 0) {
          spot(e, w, 38, 44);
          e.state = TS_BLINKING;
          e.timer = 0;
          w.telegraphCircle(e.c, e.d, 10, TS_BLINK_TELE, SPARKLE);
        }
        break;
      }
      default: {
        // blink: hold still while the destination sparkles, then vanish -> appear
        e.vx *= 0.3;
        e.vy *= 0.3;
        if (e.timer >= TS_BLINK_TELE) {
          cue(w, SA_TELE_OUT, e.x, e.y - e.cy, 0, 0, e.scale, 0, e);
          // Exchange Student: a parting ring of orbs where it stood
          if (e.elite) ring(w, e.x, e.y - e.cy, 6, w.rng.angle(), 42, e.dmg, "eb_orb", 6);
          arrive(e, w);
          e.b = e.elite ? BLINK_EVERY_ELITE : BLINK_EVERY;
        }
      }
    }
  },
};

export const enemies: EnemyDef[] = [transferStudent];
