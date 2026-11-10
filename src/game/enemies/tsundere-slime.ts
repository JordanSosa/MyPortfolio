/**
 * Tsundere Slime (Shoujo Academy, enemies.md §2): Puff-style hop-chase.
 *
 * Twist - Mixed Signals: when hit (non-lethal) it blushes and FLEES straight
 * away from the player for 1.5 s ("I-it's not like..."), then comes back at
 * +40 % speed for 2 s ("B-baka!", a BAKA! pop at the satire pop odds); 4 s
 * cooldown from the moment it flees. Elite "Ojou Slime" (tiny drill): its
 * return dash leaves a trail of 3 static eb_orb (life 1.5 s).
 *
 * state 0 = chase, 1 = flee (blushing, frame 3), 2 = return. timer = state clock,
 * a = hop phase, b = next allowed flee (World.t), c = orbs dropped this return.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { shoot } from "./_bullets";
import { toPlayer } from "./_steer";
import { academyInstall, SA_BLUSH, SA_RETURN } from "./_academy";
import { cue } from "./_cue";
import { say } from "./_say";
import { heroesA } from "../weapons/_heroes-a";

export const SLIME_FLEE = 1.5;
export const SLIME_RETURN = 2;
const COOLDOWN = 4;
const RETURN_SPEED = 1.4;
const FLEE_SPEED = 1.25;
const HOP_HZ = 2;

export const SLIME_CHASE = 0;
export const SLIME_FLEEING = 1;
export const SLIME_RETURNING = 2;

const dir = { x: 0, y: 0 };

/** A non-lethal hit (the academy hit hook): blush and run. */
function onHit(e: Enemy, w: World): void {
  if (e.state !== SLIME_CHASE || w.t < e.b) return;
  e.state = SLIME_FLEEING;
  e.timer = 0;
  e.b = w.t + COOLDOWN;
  e.sqV -= 6;
  say(w, e, "I-it's not like...", false);
  cue(w, SA_BLUSH, e.x, e.y - e.cy, 0, 0, e.scale, 0, e);
}

export const tsundereSlime: EnemyDef = {
  id: "tsundere_slime",
  name: "Tsundere Slime",
  sprite: "en_tsundere_slime",
  fps: 8,
  hp: 26,
  speed: 36,
  dmg: 7,
  radius: 6,
  height: 11,
  xp: 2,
  shadow: 12,
  colors: [C.red, C.orange, C.pinkLight],
  init(e, w) {
    academyInstall(w).onHit = onHit;
    e.a = w.rng.next() * TAU;
    e.b = 0;
  },
  // art: f0-1 hop, f2 airborne, f3 blushing flee (face covered, sweat drop)
  frame(e) {
    if (e.state === SLIME_FLEEING) return 3;
    const p = (((e.t * HOP_HZ * (e.state === SLIME_RETURNING ? 1.5 : 1) + e.a / TAU) % 1) + 1) % 1;
    return p < 0.12 ? 1 : p < 0.45 ? 2 : 0;
  },
  update(e, w, dt) {
    toPlayer(e, w, dir);
    e.timer += dt;
    if (e.state === SLIME_FLEEING) {
      // scurry away, hopping low and fast
      const sp = e.speed * FLEE_SPEED;
      e.vx = -dir.x * sp;
      e.vy = -dir.y * sp;
      e.z = Math.abs(Math.sin(e.t * 18)) * 2;
      if (e.timer >= SLIME_FLEE) {
        e.state = SLIME_RETURNING;
        e.timer = 0;
        e.c = 0;
        e.sqV += 6;
        say(w, e, "B-baka!", false);
        cue(w, SA_RETURN, e.x, e.y - e.cy, dir.x, dir.y, e.scale, 0, e);
        heroesA(w).bakaPop(e.x, e.y - e.cy - 10, false, 0.8);
      }
      return;
    }
    const ret = e.state === SLIME_RETURNING;
    const hz = HOP_HZ * (ret ? 1.5 : 1);
    const h = Math.sin(e.t * TAU * hz + e.a);
    const f = h > 0 ? h : 0;
    const sp = e.speed * (ret ? RETURN_SPEED : 1) * (0.25 + 2.2 * f);
    e.vx = dir.x * sp;
    e.vy = dir.y * sp;
    e.z = f * 3;
    if (!ret) return;
    // Ojou Slime: a drill trail of 3 static orbs
    if (e.elite && e.c < 3 && e.timer >= 0.35 + e.c * 0.5) {
      e.c++;
      const b = shoot(w, e.x, e.y - e.cy, 0, 0, e.dmg, "eb_orb", 1.5);
      if (b) b.r = 2.5;
    }
    if (e.timer >= SLIME_RETURN) {
      e.state = SLIME_CHASE;
      e.timer = 0;
    }
  },
};

export const enemies: EnemyDef[] = [tsundereSlime];
