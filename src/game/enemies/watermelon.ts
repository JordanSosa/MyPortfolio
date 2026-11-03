/**
 * WATERMELON (+ WATERMELON HALF) (Beach Episode, docs/content/enemies.md §3).
 *
 * Watermelon: short waddles between Donut-style rolls - a 0.6 s lane
 * telegraph, then 140 px/s for 1.4 s in that fixed direction (f2-3). Also the
 * roller of the `laneCharge` events (MODE_STRAIGHT: it just rolls).
 * Twist - Split: on death it splits into 2 Watermelon Halves (elite "Prize
 * Melon": 4). Halves hop after the hero and spit 3-fans of eb_seed (60 px/s,
 * dmg 5) every 2.5 s ("Seedy..."); halves never split again.
 *
 * Watermelon state 0 waddle (timer = roll cooldown), 1 telegraph, 2 roll, 3 skid; c/d = roll direction.
 * Half state 0 hop (timer = next spit); a = hop phase.
 */
import { C } from "../../art/palette";
import { enemyDmgScale } from "../config";
import { MODE_STRAIGHT, type EnemyDef } from "../types";
import { aimAt, fan } from "./_bullets";
import { EFX_DASH, EFX_SKID, efx, onScreen } from "./_fx";
import { BX_SPLIT, Q_ROLL, Q_SEEDY, cue, quip } from "./_s45";
import { toPlayer } from "./_steer";

export const MELON_TELEGRAPH = 0.6;
export const MELON_ROLL = 1.4;
export const MELON_ROLL_SPEED = 140;
const SKID = 0.3;
export const SEED_SPEED = 60;
export const SEED_DMG = 5;
export const SEED_EVERY = 2.5;

const dir = { x: 0, y: 0 };

export const watermelon: EnemyDef = {
  id: "watermelon",
  name: "Watermelon",
  sprite: "en_watermelon",
  fps: 6,
  hp: 70,
  speed: 22,
  dmg: 12,
  radius: 7,
  height: 11,
  xp: 3,
  shadow: 13,
  knockResist: 0.3,
  colors: [C.green, C.red, C.lime],
  init(e, w) {
    e.timer = w.rng.range(1.5, 3.5);
  },
  // art: f0-1 waddle, f2-3 roll
  frame(e) {
    if (e.mode === MODE_STRAIGHT || e.state === 2) return 2 + (Math.floor(e.t * 12) & 1);
    if (e.state === 1) return Math.floor(e.timer * 14) & 1;
    if (e.state === 3) return e.timer < SKID * 0.6 ? 3 : 0;
    return Math.floor(e.t * 5 + e.uid) & 1;
  },
  update(e, w, dt) {
    e.timer += e.state === 0 ? -dt : dt;
    if (e.state === 0) {
      const d = toPlayer(e, w, dir);
      const sp = e.speed * (0.6 + 0.6 * Math.abs(Math.sin(e.t * 5 + e.uid)));
      e.vx = dir.x * sp;
      e.vy = dir.y * sp;
      if (e.timer <= 0) {
        if (d > 10 && d < 170 && onScreen(w, e.x, e.y, -8)) {
          e.state = 1;
          e.timer = 0;
          e.c = dir.x;
          e.d = dir.y;
          const len = MELON_ROLL_SPEED * MELON_ROLL * 0.8;
          w.telegraphLine(e.x, e.y, e.x + e.c * len, e.y + e.d * len, e.r + 2, MELON_TELEGRAPH, C.lime);
        } else e.timer = 0.4;
      }
    } else if (e.state === 1) {
      e.vx = e.vy = 0;
      if (((e.timer * 30) | 0) % 3 === 0) e.sqV -= 1.2;
      if (e.timer >= MELON_TELEGRAPH) {
        e.state = 2;
        e.timer = 0;
        e.sqV += 6;
        efx(w, EFX_DASH, e.x, e.y, e.c, e.d, e.scale, e);
        quip(w, e, "Roll roll!", Q_ROLL, 6);
      }
    } else if (e.state === 2) {
      // (the roll eases out over its last 30 %)
      const k = e.timer > MELON_ROLL * 0.7 ? Math.max(0.35, 1 - (e.timer - MELON_ROLL * 0.7) / (MELON_ROLL * 0.3)) : 1;
      e.vx = e.c * MELON_ROLL_SPEED * k;
      e.vy = e.d * MELON_ROLL_SPEED * k;
      e.face = e.c >= 0 ? 1 : -1;
      if (e.timer >= MELON_ROLL) {
        e.state = 3;
        e.timer = 0;
        efx(w, EFX_SKID, e.x, e.y, e.c, e.d, e.scale, e);
      }
    } else {
      const f = Math.max(0, 1 - e.timer / SKID);
      e.vx = e.c * 40 * f;
      e.vy = e.d * 40 * f;
      if (e.timer >= SKID) {
        e.state = 0;
        e.timer = w.rng.range(2.6, 3.8);
      }
    }
  },
  onDeath(e, w) {
    const n = e.elite ? 4 : 2;
    const a0 = w.rng.angle();
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const h = w.spawnEnemy("watermelon_half", e.x + Math.cos(a) * 5, e.y + Math.sin(a) * 3);
      if (!h) continue;
      h.kx = Math.cos(a) * 90;
      h.ky = Math.sin(a) * 60;
      h.timer = SEED_EVERY * (0.4 + 0.25 * i);
    }
    cue(w, BX_SPLIT, e.x, e.y - e.cy, 0, 0, n, e);
  },
};

export const watermelonHalf: EnemyDef = {
  id: "watermelon_half",
  name: "Watermelon Half",
  sprite: "en_watermelon_half",
  fps: 6,
  hp: 16,
  speed: 34,
  dmg: 7,
  radius: 5,
  height: 7,
  xp: 1,
  shadow: 9,
  // (only born from a split: never part of a spawn mix)
  special: true,
  noElite: true,
  colors: [C.red, C.green, C.white],
  init(e, w) {
    e.a = w.rng.next();
    e.timer = SEED_EVERY;
  },
  // art: f0-1 hop
  frame(e) {
    return Math.floor(e.t * 4 + e.a * 2) & 1;
  },
  update(e, w, dt) {
    toPlayer(e, w, dir);
    // hop-chase: speed pulses with the hop, little z bounce
    const ph = (e.t * 2 + e.a) % 1;
    const hop = Math.sin(ph * Math.PI);
    e.vx = dir.x * e.speed * (0.25 + 1.2 * hop);
    e.vy = dir.y * e.speed * (0.25 + 1.2 * hop);
    e.z = hop * 4;
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = SEED_EVERY;
      if (onScreen(w, e.x, e.y, -6)) {
        const y = e.y - e.cy;
        const n = fan(w, e.x, y, 3, aimAt(w, e.x, y), 0.32, SEED_SPEED, SEED_DMG * enemyDmgScale(w.t), "eb_seed");
        if (n > 0) {
          e.sqV -= 5;
          quip(w, e, "Seedy...", Q_SEEDY, 7);
        }
      }
    }
  },
};

export const enemies: EnemyDef[] = [watermelon, watermelonHalf];
