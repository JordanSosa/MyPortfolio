/**
 * Gummy Bear (Candy Kingdom, enemies.md §1): Puff-style hop-chase in four
 * flavours (a per-instance tint the view applies: e.b = flavour index).
 *
 * Twist - Elastic: knockback on it is halved (knockResist 0.5), and 0.25 s
 * after being knocked it BOINGS ~20 px back toward the player (wide squash,
 * frame 3). Elite "King-Size Gummy": splits into 3 normal gummies on death.
 *
 * state 0 = hop-chase, 1 = knocked (flying, waiting to boing), 2 = boing.
 * a = hop phase, b = flavour (0 red, 1 lime, 2 lemon, 3 blue), timer = state clock.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { EnemyDef } from "../types";
import { toPlayer } from "./_steer";
import { candyInstall, CK_BOING, CK_SPLIT } from "./_candy";
import { cue } from "./_cue";

/** Flavour tints (red, lime, lemon, blue). */
export const GUMMY_TINTS: readonly number[] = [0xff4d6d, 0x94e85e, 0xffe14d, 0x5aa8ff];
const HOP_HZ = 2;
/** Knockback speed (px/s) that counts as "being knocked". */
const KNOCKED = 32;
const WAIT = 0.25;
const BOING_T = 0.24;
/** Knockback impulse of the boing (decays at exp(-9 t): ~20 px of travel). */
const BOING_V = 180;

const dir = { x: 0, y: 0 };

export const GUMMY_ST_KNOCKED = 1;
export const GUMMY_ST_BOING = 2;

export const gummyBear: EnemyDef = {
  id: "gummy_bear",
  name: "Gummy Bear",
  sprite: "en_gummy",
  fps: 8,
  hp: 12,
  speed: 34,
  dmg: 6,
  radius: 6,
  height: 12,
  xp: 1,
  shadow: 11,
  knockResist: 0.5,
  colors: [C.white, C.pinkLight, C.red, C.lime, C.yellow, C.blue],
  init(e, w) {
    candyInstall(w);
    e.a = w.rng.next() * TAU;
    e.b = w.rng.int(0, GUMMY_TINTS.length - 1);
  },
  // art: f0-1 hop squash / stretch, f2 airborne, f3 boing (wide squash)
  frame(e) {
    if (e.state === GUMMY_ST_KNOCKED) return 2;
    if (e.state === GUMMY_ST_BOING) return 3;
    const p = (((e.t * HOP_HZ + e.a / TAU) % 1) + 1) % 1;
    return p < 0.12 ? 1 : p < 0.45 ? 2 : p < 0.62 ? 3 : 0;
  },
  update(e, w, dt) {
    if (e.state === 0) {
      if (e.kx * e.kx + e.ky * e.ky > KNOCKED * KNOCKED) {
        e.state = GUMMY_ST_KNOCKED;
        e.timer = 0;
        e.vx = e.vy = 0;
        return;
      }
      toPlayer(e, w, dir);
      const h = Math.sin(e.t * TAU * HOP_HZ + e.a);
      const f = h > 0 ? h : 0;
      const sp = e.speed * (0.25 + 2.2 * f);
      e.vx = dir.x * sp;
      e.vy = dir.y * sp;
      e.z = f * 3.5;
      return;
    }
    e.vx = e.vy = 0;
    e.timer += dt;
    if (e.state === GUMMY_ST_KNOCKED) {
      e.z = Math.max(0, e.z - dt * 20);
      if (e.timer >= WAIT) {
        // BOING: springs back toward the player
        toPlayer(e, w, dir);
        e.kx = dir.x * BOING_V;
        e.ky = dir.y * BOING_V;
        e.state = GUMMY_ST_BOING;
        e.timer = 0;
        e.sqV -= 11;
        cue(w, CK_BOING, e.x, e.y, dir.x, dir.y, e.scale, e.b, e);
      }
    } else if (e.timer >= BOING_T) {
      e.state = 0;
      e.timer = 0;
    }
  },
  onDeath(e, w) {
    if (!e.elite) return;
    // King-Size Gummy: three regular gummies pop out
    cue(w, CK_SPLIT, e.x, e.y - e.cy, 0, 0, e.scale, e.b, e);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + w.rng.spread(0.4);
      const g = w.spawnEnemy(gummyBear, e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 4);
      if (!g) continue;
      g.kx = Math.cos(a) * 110;
      g.ky = Math.sin(a) * 80;
      g.state = GUMMY_ST_KNOCKED;
    }
  },
};

export const enemies: EnemyDef[] = [gummyBear];
