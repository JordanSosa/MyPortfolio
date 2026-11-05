/**
 * Love Letter (Shoujo Academy, enemies.md §2): the Batbun weave chase; swarm
 * events (CONFESSION SEASON!) fly them in straight lines.
 *
 * Twist - Persistent Admirer: on death, a 20 % chance to burst into 3 paper
 * hearts (enemy bullets r 3, 40 px/s, homing 0.8 rad/s, life 3 s, dmg 3); the
 * death pop shows a tiny "REJECTED" stamp. Elite "Confession": 3 hearts always,
 * and faster (60 px/s).
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { EnemyDef } from "../types";
import { aimAt, shoot } from "./_bullets";
import { weave } from "./_steer";
import { academyInstall, HEART, SA_REJECTED } from "./_academy";
import { cue } from "./_cue";

const HEART_CHANCE = 0.2;
const HEART_SPEED = 40;
const HEART_SPEED_ELITE = 60;
const HEART_LIFE = 3;
const HEART_DMG = 3;

export const loveLetter: EnemyDef = {
  id: "love_letter",
  name: "Love Letter",
  sprite: "en_love_letter",
  fps: 10,
  hp: 7,
  speed: 60,
  dmg: 4,
  radius: 4,
  height: 9,
  xp: 1,
  shadow: 7,
  colors: [C.pinkLight, C.white, C.pink],
  init(e, w) {
    academyInstall(w);
    e.a = w.rng.next() * TAU;
    e.b = w.rng.range(3, 4.2);
  },
  update(e, w) {
    weave(e, w, e.speed, e.b, 0.8);
    e.z = 3 + Math.sin(e.t * 8 + e.a) * 1.5;
  },
  onDeath(e, w) {
    const burst = e.elite || w.rng.next() < HEART_CHANCE;
    cue(w, SA_REJECTED, e.x, e.y - e.cy, 0, 0, e.scale, burst ? 1 : 0, e);
    if (!burst) return;
    const st = academyInstall(w);
    const sp = e.elite ? HEART_SPEED_ELITE : HEART_SPEED;
    const y = e.y - e.cy;
    const aim = aimAt(w, e.x, y);
    // a little fan away from the aim: the homing curls them back in (readable, never instant)
    for (let i = 0; i < 3; i++) {
      const b = shoot(w, e.x, y, aim + (i - 1) * 1.3 + Math.PI * 0.15, sp, HEART_DMG, HEART, HEART_LIFE);
      if (b) b.r = 3;
    }
    st.heartsUntil = Math.max(st.heartsUntil, w.t + HEART_LIFE + 0.1);
  },
};

export const enemies: EnemyDef[] = [loveLetter];
