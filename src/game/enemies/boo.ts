/** Boo (ghost): sine-wave approach, alpha flickers (more see-through while drifting sideways). */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { EnemyDef } from "../types";
import { toPlayer } from "./_steer";

const dir = { x: 0, y: 0 };

export const boo: EnemyDef = {
  id: "boo",
  name: "Boo",
  sprite: "en_boo",
  fps: 6,
  hp: 14,
  speed: 38,
  dmg: 6,
  radius: 6,
  height: 14,
  xp: 2,
  shadow: 11,
  colors: [C.offWhite, C.lavender, C.pinkLight, C.white],
  init(e, w) {
    e.a = w.rng.next() * TAU;
  },
  update(e, w) {
    const d = toPlayer(e, w, dir);
    const s = Math.sin(e.t * 2.2 + e.a);
    const k = Math.min(1, d / 40) * 1.1;
    e.vx = (dir.x - dir.y * s * k) * e.speed;
    e.vy = (dir.y + dir.x * s * k) * e.speed;
    // ghostly flicker: 0.45..1, with quick shimmer
    const f = 0.5 + 0.5 * Math.sin(e.t * 3.1 + e.a);
    e.alpha = 0.45 + 0.55 * (1 - f * 0.8) * (0.9 + 0.1 * Math.sin(e.t * 23));
    e.z = 3 + Math.sin(e.t * 2.8 + e.a) * 2;
  },
};

export const enemies: EnemyDef[] = [boo];
