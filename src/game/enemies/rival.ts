/**
 * RIVAL (RECOLOUR) - the Plot Twist enemy of "shounen_rival"
 * (docs/content/enemies.md §4, stages.md §6): a random OTHER hero's run
 * sprite with a red tint (per-enemy `skin`), title pop "YOUR RIVAL (RECOLOUR)
 * APPEARS!". HP 60 x run minutes (min 120), speed 80, dmg 16, xp 10. Seeks;
 * every 3 s a telegraphed dash (the Pumpkin pattern, 220 px/s) - a sidestep
 * always dodges it. Drops a chest ("Next time... for sure!"). Never part of
 * a spawn mix (`special`); spawnRival keeps one alive at a time.
 *
 * state 0 = chase (timer = cooldown), 1 = telegraph, 2 = dash, 3 = skid.
 * c/d = dash direction (unit).
 */
import { C } from "../../art/palette";
import { HEROES } from "../heroes";
import { proc } from "../relics/_util";
import type { EnemyDef } from "../types";
import type { World } from "../world";
import { EFX_DASH, EFX_SKID, efx, onScreen } from "./_fx";
import { toPlayer } from "./_steer";

export const RIVAL_ID = "rival_recolour";
export const RIVAL_TELEGRAPH = 0.5;
export const RIVAL_DASH = 0.45;
export const RIVAL_DASH_SPEED = 220;
const SKID = 0.3;
const EVERY = 3;

const dir = { x: 0, y: 0 };

export const rivalRecolour: EnemyDef = {
  id: RIVAL_ID,
  name: "Rival (Recolour)",
  sprite: "rin_run",
  fps: 12,
  hp: 120,
  speed: 80,
  dmg: 16,
  radius: 6,
  height: 16,
  xp: 10,
  shadow: 12,
  knockResist: 0.5,
  noElite: true,
  special: true,
  tint: C.red,
  colors: [C.red, C.pinkLight, C.white, C.darkViolet],
  init(e, w) {
    // HP 60 x run minutes (min 120), with the twists' enemy HP on top
    e.maxHp = e.hp = Math.round(Math.max(120, (60 * w.t) / 60) * w.difficulty.enemyHp);
    e.timer = EVERY;
  },
  update(e, w, dt) {
    e.timer += e.state === 0 ? -dt : dt;
    if (e.state === 0) {
      const d = toPlayer(e, w, dir);
      e.vx = dir.x * e.speed;
      e.vy = dir.y * e.speed;
      if (e.timer <= 0) {
        if (d > 8 && d < 150 && onScreen(w, e.x, e.y, -10)) {
          e.state = 1;
          e.timer = 0;
          e.c = dir.x;
          e.d = dir.y;
          e.face = dir.x >= 0 ? 1 : -1;
          const len = RIVAL_DASH_SPEED * RIVAL_DASH + 10;
          w.telegraphLine(e.x, e.y, e.x + e.c * len, e.y + e.d * len, e.r + 3, RIVAL_TELEGRAPH);
        } else e.timer = 0.3;
      }
    } else if (e.state === 1) {
      e.vx = e.vy = 0;
      if (((e.timer * 30) | 0) % 3 === 0) e.sqV -= 1.5;
      if (e.timer >= RIVAL_TELEGRAPH) {
        e.state = 2;
        e.timer = 0;
        e.sqV += 6;
        efx(w, EFX_DASH, e.x, e.y, e.c, e.d, 1.4, e);
      }
    } else if (e.state === 2) {
      e.vx = e.c * RIVAL_DASH_SPEED;
      e.vy = e.d * RIVAL_DASH_SPEED;
      e.face = e.c >= 0 ? 1 : -1;
      if (e.timer >= RIVAL_DASH) {
        e.state = 3;
        e.timer = 0;
        efx(w, EFX_SKID, e.x, e.y, e.c, e.d, 1.2, e);
      }
    } else {
      const f = Math.max(0, 1 - e.timer / SKID);
      e.vx = e.c * RIVAL_DASH_SPEED * 0.5 * f * f;
      e.vy = e.d * RIVAL_DASH_SPEED * 0.5 * f * f;
      if (e.timer >= SKID) {
        e.state = 0;
        e.timer = EVERY;
      }
    }
  },
  onDeath(e, w) {
    w.dropPickup("chest", e.x, e.y, 1, false);
    proc(w, "rival_recolour_down", e.x, e.y - 20);
  },
};

/** shounen_rival twist timer: the rival hunts you (one alive at a time), re-skinned as a random other hero. */
export function spawnRival(w: World): void {
  for (let i = 0; i < w.enemies.count; i++) {
    const o = w.enemies.items[i];
    if (!o.dead && o.def.id === RIVAL_ID) return;
  }
  w.edgePoint(16, w.tmp, true);
  const e = w.spawnEnemy(RIVAL_ID, w.tmp.x, w.tmp.y);
  if (!e) return;
  const others = HEROES.filter((h) => h.id !== w.hero.id);
  const h = others.length ? others[w.rng.int(0, others.length - 1)] : w.hero;
  e.skin = `${h.sprite}_run`;
  proc(w, RIVAL_ID, e.x, e.y);
}

export const enemies: EnemyDef[] = [rivalRecolour];
