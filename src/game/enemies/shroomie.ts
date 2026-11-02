/** Shroomie: slow waddle; splits into 2 Spores on death. Spore: tiny fast chaser. */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { EnemyDef } from "../types";
import { seek, toPlayer } from "./_steer";

const dir = { x: 0, y: 0 };

export const spore: EnemyDef = {
  id: "spore",
  name: "Spore",
  sprite: "en_spore",
  fps: 10,
  hp: 4,
  speed: 50,
  dmg: 4,
  radius: 4,
  height: 8,
  xp: 1,
  shadow: 7,
  colors: [C.red, C.white, C.pinkLight],
  noElite: true,
  init(e, w) {
    e.a = w.rng.next() * TAU;
    // pop out of the parent in a little burst
    const a = w.rng.angle();
    e.kx = Math.cos(a) * 90;
    e.ky = Math.sin(a) * 90;
  },
  update(e, w) {
    seek(e, w, e.speed * (0.85 + 0.3 * Math.sin(e.t * 14 + e.a)));
  },
};

export const shroomie: EnemyDef = {
  id: "shroomie",
  name: "Shroomie",
  sprite: "en_shroom",
  fps: 7,
  hp: 30,
  speed: 22,
  dmg: 8,
  radius: 7,
  height: 13,
  xp: 3,
  shadow: 13,
  knockResist: 0.25,
  colors: [C.red, C.white, C.pinkLight, C.offWhite],
  init(e, w) {
    e.a = w.rng.next() * TAU;
  },
  update(e, w) {
    toPlayer(e, w, dir);
    // waddle: forward speed bobs with each step, slight side sway
    const step = Math.sin(e.t * TAU * 1.75 + e.a);
    const sp = e.speed * (0.7 + 0.45 * Math.abs(step));
    e.vx = (dir.x - dir.y * step * 0.3) * sp;
    e.vy = (dir.y + dir.x * step * 0.3) * sp;
  },
  onDeath(e, w) {
    const n = e.elite ? 5 : 2;
    for (let i = 0; i < n; i++) w.spawnEnemy(spore, e.x + w.rng.spread(4), e.y + w.rng.spread(3));
  },
};

export const enemies: EnemyDef[] = [shroomie, spore];
