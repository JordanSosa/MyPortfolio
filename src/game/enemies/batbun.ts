/** Batbun: fast weaving chase; swarm events fly them in straight lines (director MODE_STRAIGHT). */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { EnemyDef } from "../types";
import { weave } from "./_steer";

export const batbun: EnemyDef = {
  id: "batbun",
  name: "Batbun",
  sprite: "en_batbun",
  fps: 12,
  hp: 5,
  speed: 55,
  dmg: 4,
  radius: 5,
  height: 14,
  xp: 1,
  shadow: 9,
  colors: [C.violet, C.lavender, C.pink, C.white],
  init(e, w) {
    e.a = w.rng.next() * TAU;
    e.b = w.rng.range(3.2, 4.4);
  },
  update(e, w) {
    weave(e, w, e.speed, e.b, 0.85);
    e.z = 2 + Math.sin(e.t * 9 + e.a) * 1.5;
  },
};

export const enemies: EnemyDef[] = [batbun];
