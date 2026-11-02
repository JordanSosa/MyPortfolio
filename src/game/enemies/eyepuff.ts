/**
 * Eyepuff (DESIGN §3.4): floating one-eyed fluffball that keeps ~90 px away,
 * charges for 0.4 s (frame 3: the eye glows, sparkles gather) and fires an
 * eb_orb at the player. From 6:00 it sometimes fires a 3-shot fan; elites
 * always fan 5. Only shoots while on screen and never point-blank.
 *
 * state 0 = drift (timer = shot cooldown, b = blink clock), 1 = charge, 2 = recoil.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt, B_ORB, fan, shoot } from "./_bullets";
import { EFX_EYE_CHARGE, efx, onScreen } from "./_fx";
import { keepAway } from "./_steer";

const CHARGE = 0.4;
const RECOIL = 0.25;
const SHOT_SPEED = 70;
/** Fans unlock at 6:00. */
const FAN_AT = 360;

/** Eye position (bullet origin), relative to the feet. */
function eyeY(e: Enemy): number {
  return e.y - e.z - 8 * e.scale;
}

function fire(e: Enemy, w: World): void {
  const x = e.x + e.face * e.scale;
  const y = eyeY(e);
  const aim = aimAt(w, x, y);
  const sp = SHOT_SPEED * (w.director.enraged ? 1.15 : 1);
  if (e.elite) fan(w, x, y, 5, aim, 0.24, sp, e.dmg, B_ORB);
  else if (w.t >= FAN_AT && w.rng.next() < 0.35) fan(w, x, y, 3, aim, 0.28, sp, e.dmg, B_ORB);
  else shoot(w, x, y, aim, sp, e.dmg, B_ORB);
  // recoil: a little hop backwards + squash
  e.kx -= Math.cos(aim) * 40;
  e.ky -= Math.sin(aim) * 40;
  e.sqV -= 7;
}

export const eyepuff: EnemyDef = {
  id: "eyepuff",
  name: "Eyepuff",
  sprite: "en_eyepuff",
  fps: 5,
  hp: 20,
  speed: 30,
  dmg: 8,
  radius: 6,
  height: 13,
  xp: 2,
  shadow: 10,
  colors: [C.pink, C.pinkLight, C.violet, C.white],
  init(e, w) {
    e.a = w.rng.next() * TAU;
    e.timer = w.rng.range(1.2, 2.8);
    e.b = w.rng.range(0, 3);
  },
  // art: f0-1 float, f2 blink, f3 charge (eye glows)
  frame(e) {
    if (e.state === 1) return 3;
    if (e.state === 0 && e.b % 3.2 > 3.05) return 2;
    return Math.floor(e.t * 4 + e.a) & 1;
  },
  update(e, w, dt) {
    e.z = 5 + Math.sin(e.t * 3 + e.a) * 1.5;
    if (e.state === 0) {
      const d = keepAway(e, w, e.speed, 90);
      e.b += dt;
      e.timer -= dt;
      if (e.timer <= 0) {
        if (d > 36 && d < 170 && onScreen(w, e.x, e.y, -6)) {
          e.state = 1;
          e.timer = 0;
          efx(w, EFX_EYE_CHARGE, e.x, eyeY(e), 0, 0, e.scale, e);
        } else e.timer = 0.3;
      }
    } else if (e.state === 1) {
      // hold still while the eye charges (the readable tell)
      e.vx *= 0.2;
      e.vy *= 0.2;
      e.timer += dt;
      if (e.timer >= CHARGE) {
        fire(e, w);
        e.state = 2;
        e.timer = 0;
      }
    } else {
      e.vx = e.vy = 0;
      e.timer += dt;
      if (e.timer >= RECOIL) {
        e.state = 0;
        e.timer = w.rng.range(2.4, 3.4) * (w.director.enraged ? 0.75 : 1);
      }
    }
  },
};

export const enemies: EnemyDef[] = [eyepuff];
