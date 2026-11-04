/**
 * TINY SHARK (Beach Episode, docs/content/enemies.md §3). Seeks the hero as
 * just a fin cutting through the sand (f0-1).
 *
 * Twist - Fin Mode: while finned, homing / auto-aim ignore it (area damage
 * still hits) and it does no contact damage. At 30 px from the hero it
 * surfaces (0.4 s tell: "!" + f2) and lunges 24 px (f3), then stays surfaced
 * and targetable for 1.2 s before diving again. Elite "Great Tiny Shark":
 * surfaces with a ring of 6 eb_seed "sand spray".
 *
 * state 0 fin, 1 surfacing tell, 2 lunge, 3 surfaced.
 * b = its contact damage (parked while finned), c/d = lunge direction.
 */
import { C } from "../../art/palette";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { ring } from "./_bullets";
import { onScreen } from "./_fx";
import { BX_LUNGE, BX_SUBMERGE, BX_SURFACE, Q_NOM, cue, quip } from "./_s45";
import { toPlayer } from "./_steer";

export const SHARK_TELL = 0.4;
export const SHARK_LUNGE = 0.12;
export const SHARK_LUNGE_PX = 24;
export const SHARK_UP = 1.2;
const SURFACE_AT = 30;

const dir = { x: 0, y: 0 };

function fin(e: Enemy, w: World): void {
  e.state = 0;
  e.timer = 0;
  e.untargetable = true;
  e.dmg = 0;
  cue(w, BX_SUBMERGE, e.x, e.y, 0, 0, e.scale, e);
}

export const tinyShark: EnemyDef = {
  id: "tiny_shark",
  name: "Tiny Shark",
  sprite: "en_tiny_shark",
  fps: 8,
  hp: 22,
  speed: 62,
  dmg: 10,
  radius: 5,
  height: 8,
  xp: 1,
  shadow: 10,
  colors: [C.lightBlue, C.blue, C.white],
  init(e) {
    e.b = e.dmg;
    e.state = 0;
    e.untargetable = true;
    e.dmg = 0;
  },
  // art: f0-1 fin only (sand ripple), f2 surfacing, f3 chomp
  frame(e) {
    if (e.state === 0) return Math.floor(e.t * 8 + e.uid) & 1;
    if (e.state === 1) return 2;
    if (e.state === 2) return 3;
    return Math.floor(e.timer * 3) % 3 === 2 ? 3 : 2;
  },
  update(e, w, dt) {
    e.timer += dt;
    const d = toPlayer(e, w, dir);
    switch (e.state) {
      case 0: {
        // the fin weaves a little as it cuts toward the hero
        const s = Math.sin(e.t * 6 + e.uid) * 0.3;
        e.vx = (dir.x - dir.y * s) * e.speed;
        e.vy = (dir.y + dir.x * s) * e.speed;
        if (d < SURFACE_AT * e.scale && e.timer > 0.6 && onScreen(w, e.x, e.y, -4)) {
          e.state = 1;
          e.timer = 0;
          e.untargetable = false;
          e.c = dir.x;
          e.d = dir.y;
          e.face = dir.x >= 0 ? 1 : -1;
          e.sqV += 8;
          cue(w, BX_SURFACE, e.x, e.y, dir.x, dir.y, e.elite ? 2 : 1, e);
          if (e.elite) ring(w, e.x, e.y - e.cy, 6, w.rng.angle(), 62, 5 * w.enemyDmgMul(), "eb_seed", 7);
          quip(w, e, "Nom?", Q_NOM, 6);
        }
        break;
      }
      case 1:
        e.vx = e.vy = 0;
        if (e.timer >= SHARK_TELL) {
          e.state = 2;
          e.timer = 0;
          e.dmg = e.b;
          cue(w, BX_LUNGE, e.x, e.y, e.c, e.d, e.scale, e);
        }
        break;
      case 2:
        e.vx = (e.c * SHARK_LUNGE_PX * e.scale) / SHARK_LUNGE;
        e.vy = (e.d * SHARK_LUNGE_PX * e.scale) / SHARK_LUNGE;
        if (e.timer >= SHARK_LUNGE) {
          e.state = 3;
          e.timer = 0;
        }
        break;
      default:
        // surfaced: a slow waddle on its tiny fins, then back under
        e.vx = dir.x * e.speed * 0.3;
        e.vy = dir.y * e.speed * 0.3;
        if (e.timer >= SHARK_UP) fin(e, w);
    }
  },
};

export const enemies: EnemyDef[] = [tinyShark];
