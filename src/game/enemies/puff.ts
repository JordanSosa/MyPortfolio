/** Puff (slime): hop-chase, speed pulses with the hop (DESIGN §3.4). */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { EnemyDef } from "../types";
import { toPlayer } from "./_steer";

const dir = { x: 0, y: 0 };
/** Hops per second - matches the 4-frame en_puff loop at 8 fps. */
export const PUFF_HOP_HZ = 2;

export const puff: EnemyDef = {
  id: "puff",
  name: "Puff",
  sprite: "en_puff",
  fps: 8,
  hp: 8,
  speed: 32,
  dmg: 6,
  radius: 6,
  height: 11,
  xp: 1,
  shadow: 12,
  colors: [C.mint, C.lime, C.green, C.white],
  init(e, w) {
    e.a = w.rng.next() * TAU;
  },
  // sync the 4 art frames (rest, take-off stretch, airborne, landing squash) with the hop phase
  frame(e) {
    const p = (((e.t * PUFF_HOP_HZ + e.a / TAU) % 1) + 1) % 1;
    return p < 0.12 ? 1 : p < 0.42 ? 2 : p < 0.62 ? 3 : 0;
  },
  update(e, w) {
    toPlayer(e, w, dir);
    const h = Math.sin(e.t * TAU * PUFF_HOP_HZ + e.a);
    const f = h > 0 ? h : 0;
    const sp = e.speed * (0.25 + 2.2 * f);
    e.vx = dir.x * sp;
    e.vy = dir.y * sp;
    e.z = f * 3;
  },
};

export const enemies: EnemyDef[] = [puff];
