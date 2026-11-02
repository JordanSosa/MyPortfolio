/**
 * Teddy Brute (DESIGN §3.4): slow, heavy tank. 70 % knockback resistance,
 * a stomping gait (speed surges between footfalls and stalls on landing),
 * a dust ring + tiny ground shake every other step, and a big shadow.
 *
 * b = last stride frame (footfall detection).
 */
import { C } from "../../art/palette";
import type { Enemy, EnemyDef } from "../types";
import { EFX_STOMP, efx, onScreen } from "./_fx";
import { toPlayer } from "./_steer";

const dir = { x: 0, y: 0 };
/** Walk cycles per second (4 frames each, 2 footfalls per cycle). */
const CYCLE_HZ = 1.1;

function stride(e: Enemy): number {
  return Math.floor((e.t * CYCLE_HZ + e.a) * 4) & 3;
}

export const teddy: EnemyDef = {
  id: "teddy",
  name: "Teddy Brute",
  sprite: "en_teddy",
  hp: 90,
  speed: 24,
  dmg: 11,
  radius: 9,
  height: 20,
  xp: 5,
  shadow: 21,
  knockResist: 0.7,
  colors: [C.orange, C.gold, C.red, C.pinkLight, C.offWhite],
  init(e, w) {
    e.a = w.rng.next();
    e.b = stride(e);
  },
  // art: 4-frame heavy stomp walk; footfalls land on f1 and f3
  frame: stride,
  update(e, w) {
    toPlayer(e, w, dir);
    const f = stride(e);
    // surge while a foot is in the air (f0 / f2), stall as it lands (f1 / f3)
    const sp = e.speed * (f === 0 || f === 2 ? 1.45 : 0.55);
    e.vx = dir.x * sp;
    e.vy = dir.y * sp;
    if (f !== e.b) {
      e.b = f;
      if (f === 1 || f === 3) {
        e.sqV += 4; // weight settles
        if (f === 1 && onScreen(w, e.x, e.y, 24)) efx(w, EFX_STOMP, e.x, e.y, 0, 0, e.scale, e);
      }
    }
  },
};

export const enemies: EnemyDef[] = [teddy];
