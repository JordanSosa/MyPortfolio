/**
 * Candy Corn Soldier (Candy Kingdom, enemies.md §1): a marching seeker that
 * mostly arrives in formation lines (swarmLine "PHALANX!").
 *
 * Twist - Shield Wall: while >= 2 other soldiers are within 20 px, projectiles
 * hitting its FRONT half deal 40 % less (_candy.ts dmgTaken rule; the view
 * flashes the wrapper shield). Break the formation, break the wall.
 * Elite "Corn-mander": soldiers within 60 px march 20 % faster; carries a flag.
 *
 * a = gait phase, b = time of the last blocked hit (view flash),
 * c = "boosted by a Corn-mander" until (World.t), timer = commander pulse clock.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { EnemyDef } from "../types";
import { toPlayer } from "./_steer";
import { candyInstall } from "./_candy";

const dir = { x: 0, y: 0 };
const BOOST = 1.2;
const BOOST_R = 60;

export const candyCorn: EnemyDef = {
  id: "candy_corn",
  name: "Candy Corn Soldier",
  sprite: "en_candy_corn",
  fps: 8,
  hp: 26,
  speed: 30,
  dmg: 8,
  radius: 6,
  height: 13,
  xp: 2,
  shadow: 10,
  knockResist: 0.2,
  colors: [C.yellow, C.orange, C.white],
  init(e, w) {
    candyInstall(w);
    e.a = w.rng.next();
    e.b = -9;
    e.c = -1;
    e.timer = w.rng.next() * 0.3;
  },
  // art: f0-3 march (legs alternate, spear bobs) - in step with the gait
  frame(e) {
    return Math.floor((e.t * 2 + e.a) * 4) & 3;
  },
  update(e, w, dt) {
    toPlayer(e, w, dir);
    const boost = w.t < e.c ? BOOST : 1;
    // a brisk march: a little surge on every step
    const step = Math.abs(Math.sin((e.t * 2 + e.a) * TAU));
    const sp = e.speed * boost * (0.75 + 0.4 * step);
    e.vx = dir.x * sp;
    e.vy = dir.y * sp;
    if (!e.elite) return;
    // Corn-mander: rally the squad around it
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = 0.25;
    const buf = w.acquire();
    const n = w.grid.query(e.x, e.y - e.cy, BOOST_R, buf);
    const items = w.enemies.items;
    for (let k = 0; k < n; k++) {
      const o = items[buf[k]];
      if (!o || o === e || o.dead || o.def !== candyCorn) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy <= BOOST_R * BOOST_R) o.c = w.t + 0.4;
    }
    w.release();
  },
};

export const enemies: EnemyDef[] = [candyCorn];
