/**
 * Marshmallow Brute (Candy Kingdom, enemies.md §1): the Teddy tank - slow,
 * heavy, gait-synced stomps with a dust ring every other step.
 *
 * Twist - Toasty: hit by fire (Dark Flame Dragon, Cheat Fireball, their
 * evolutions) or any explosion, it is Toasted for the rest of its life:
 * golden-brown, +30 % speed, takes +50 % damage, "Toasty!" (_candy.ts).
 * Elite "S'more Supreme": leaves a chocolate puddle on death (r 24, 4 s) that
 * slows enemies (never the player).
 *
 * a = gait phase, b = last stride frame (footfall detection), c = 1 when toasted.
 */
import { C } from "../../art/palette";
import type { Enemy, EnemyDef } from "../types";
import { EFX_STOMP, efx, onScreen } from "./_fx";
import { toPlayer } from "./_steer";
import { addPuddle, candyInstall } from "./_candy";

const dir = { x: 0, y: 0 };
const CYCLE_HZ = 1.0;

function stride(e: Enemy): number {
  return Math.floor((e.t * CYCLE_HZ * (e.c === 1 ? 1.3 : 1) + e.a) * 4) & 3;
}

export const marshmallowBrute: EnemyDef = {
  id: "marshmallow_brute",
  name: "Marshmallow Brute",
  sprite: "en_marshmallow",
  fps: 5,
  hp: 120,
  speed: 22,
  dmg: 13,
  radius: 10,
  height: 20,
  xp: 6,
  shadow: 21,
  knockResist: 0.6,
  colors: [C.white, C.offWhite, C.pinkLight],
  init(e, w) {
    candyInstall(w);
    e.a = w.rng.next();
    e.b = stride(e);
    e.c = 0;
  },
  // art: f0-3 heavy squash-walk (the top compresses on the step frames f1 / f3)
  frame: stride,
  update(e, w) {
    toPlayer(e, w, dir);
    const f = stride(e);
    const sp = e.speed * (f === 0 || f === 2 ? 1.45 : 0.55);
    e.vx = dir.x * sp;
    e.vy = dir.y * sp;
    if (f !== e.b) {
      e.b = f;
      if (f === 1 || f === 3) {
        e.sqV += 5;
        if (f === 1 && onScreen(w, e.x, e.y, 24)) efx(w, EFX_STOMP, e.x, e.y, 0, 0, e.scale * 1.1, e);
      }
    }
  },
  onDeath(e, w) {
    if (e.elite) addPuddle(w, e.x, e.y);
  },
};

export const enemies: EnemyDef[] = [marshmallowBrute];
