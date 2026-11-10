/**
 * Student Council Ninja (Shoujo Academy, enemies.md §2): the Eyepuff
 * keep-away shooter at 70 px.
 *
 * Attack: a 3-fan of eb_shuriken (85 px/s, dmg 9) every 3 s after a 0.4 s tell
 * (hand raised, frame 2). Twist - Smoke Bomb: when the player comes within
 * 40 px it vanishes in smoke and reappears 60 px BEHIND the player (relative
 * to the way they face), 4 s cooldown. Elite: 5-fans, and the smoke bomb
 * leaves a decoy that explodes (r 20, 12 dmg) after 1 s.
 *
 * state 0 = drift (timer = shot cooldown), 1 = throw tell, 2 = recoil,
 * 3 = reappearing (smoke frame). b = smoke bomb ready at (World.t), a = phase.
 */
import { C } from "../../art/palette";
import { TAU, clamp } from "../../core/math";
import type { EnemyDef } from "../types";
import { aimAt, fan } from "./_bullets";
import { onScreen } from "./_fx";
import { keepAway } from "./_steer";
import { academyInstall, addDecoy, SA_SMOKE } from "./_academy";
import { cue } from "./_cue";

const TELL = 0.4;
const RECOIL = 0.25;
const SHOT_SPEED = 85;
const SMOKE_NEAR = 40;
const BEHIND = 60;
const SMOKE_CD = 4;
const APPEAR = 0.3;

export const NINJA_TELL = 1;
export const NINJA_APPEAR = 3;

export const councilNinja: EnemyDef = {
  id: "council_ninja",
  name: "Student Council Ninja",
  sprite: "en_council_ninja",
  fps: 8,
  hp: 40,
  speed: 50,
  dmg: 9,
  radius: 6,
  height: 12,
  xp: 3,
  shadow: 10,
  colors: [C.navy, C.darkViolet, C.red, C.white],
  init(e, w) {
    academyInstall(w);
    e.a = w.rng.next() * TAU;
    e.timer = w.rng.range(1.5, 3);
    e.b = 0;
  },
  // art: f0-1 crouch-run, f2 throw, f3 smoke (half dissolved)
  frame(e) {
    if (e.state === NINJA_TELL || e.state === 2) return 2;
    if (e.state === NINJA_APPEAR) return 3;
    return Math.floor(e.t * 8 + e.a) & 1;
  },
  update(e, w, dt) {
    const p = w.player;
    if (e.state === NINJA_APPEAR) {
      e.vx = e.vy = 0;
      e.timer += dt;
      e.alpha = Math.min(1, 0.3 + e.timer / APPEAR);
      if (e.timer >= APPEAR) {
        e.state = 0;
        e.alpha = 1;
        e.timer = w.rng.range(0.6, 1.2);
      }
      return;
    }
    // Smoke Bomb: too close - poof, and it is behind you
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    if (w.t >= e.b && dx * dx + dy * dy < SMOKE_NEAR * SMOKE_NEAR && w.phase === "play") {
      e.b = w.t + SMOKE_CD;
      cue(w, SA_SMOKE, e.x, e.y - e.cy, 0, 0, e.scale, e.elite ? 1 : 0, e);
      if (e.elite) addDecoy(w, e.x, e.y);
      const hw = w.viewW * 0.5 - 12;
      const hh = w.viewH * 0.5 - 16;
      e.x = clamp(p.x - p.aimX * BEHIND, p.x - hw, p.x + hw);
      e.y = clamp(p.y - p.aimY * BEHIND, p.y - hh + 12, p.y + hh);
      e.kx = e.ky = 0;
      e.face = p.x >= e.x ? 1 : -1;
      e.state = NINJA_APPEAR;
      e.timer = 0;
      e.inv = 0.15;
      e.alpha = 0.3;
      cue(w, SA_SMOKE, e.x, e.y - e.cy, 1, 0, e.scale, 0, e);
      return;
    }
    if (e.state === 0) {
      const d = keepAway(e, w, e.speed, 70);
      e.timer -= dt;
      if (e.timer <= 0) {
        if (d > 30 && d < 160 && onScreen(w, e.x, e.y, -6)) {
          e.state = NINJA_TELL;
          e.timer = 0;
          e.face = dx >= 0 ? 1 : -1;
        } else e.timer = 0.3;
      }
    } else if (e.state === NINJA_TELL) {
      e.vx *= 0.2;
      e.vy *= 0.2;
      e.timer += dt;
      if (e.timer >= TELL) {
        const x = e.x + e.face * 4 * e.scale;
        const y = e.y - e.cy - 2;
        const n = e.elite ? 5 : 3;
        fan(w, x, y, n, aimAt(w, x, y), 0.26, SHOT_SPEED * (w.director.enraged ? 1.15 : 1), e.dmg, "eb_shuriken", 6);
        e.state = 2;
        e.timer = 0;
        e.sqV -= 5;
      }
    } else {
      e.vx = e.vy = 0;
      e.timer += dt;
      if (e.timer >= RECOIL) {
        e.state = 0;
        e.timer = 3 * (w.director.enraged ? 0.8 : 1);
      }
    }
  },
};

export const enemies: EnemyDef[] = [councilNinja];
