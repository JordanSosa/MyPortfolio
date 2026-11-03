/**
 * Lollipop Mage (Candy Kingdom, enemies.md §1): the Eyepuff keep-away shooter
 * (holds ~90 px, 0.4 s charge tell with the staff raised, frame 2).
 *
 * Attack: a swirl candy (eb_candy, 70 px/s, dmg 8) that CURVES at 1.2 rad/s -
 * launched off-axis so its arc passes through the player's position (a
 * sidestep still dodges it); from 6:00 a 3-fan of them.
 * Twist - Sugar High (healer): every 3rd cast instead heals every candy enemy
 * within 60 px by 10 % of its max HP ("Sugar rush!", heal pose frame 3).
 * Kill the mages first. Elite: heals 25 % and grants +20 % speed for 3 s.
 *
 * state 0 = drift (timer = cooldown), 1 = charge / heal wind-up, 2 = recoil.
 * a = bob phase, b = casts so far, c = curve sign of the next shot.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt, shoot } from "./_bullets";
import { onScreen } from "./_fx";
import { keepAway } from "./_steer";
import { CANDY_IDS, candyInstall, CK_CAST, CK_HEAL, CK_HEALED } from "./_candy";
import { cue } from "./_cue";
import { say } from "./_say";

const CHARGE = 0.4;
const RECOIL = 0.25;
const SHOT_SPEED = 70;
const TURN = 1.2;
const FAN_AT = 360;
export const MAGE_HEAL_R = 60;
const HEAL = 0.1;
const HEAL_ELITE = 0.25;
/** Elite heal: +20 % speed for 3 s (Enemy.slow > 1 speeds an enemy up). */
const HASTE = 1.2;
const HASTE_T = 3;

export const MAGE_CHARGE = 1;

/** Is the current wind-up a heal (every 3rd cast)? */
export function mageHealing(e: Enemy): boolean {
  return e.state === MAGE_CHARGE && e.b % 3 === 2;
}

function staffY(e: Enemy): number {
  return e.y - e.z - 15 * e.scale;
}

/** One curving candy: its arc of turn rate `turn` passes through the player's body centre. */
function candy(w: World, x: number, y: number, aim: number, dist: number, turn: number, dmg: number): void {
  const sp = SHOT_SPEED * (w.director.enraged ? 1.15 : 1);
  // chord length d = 2 (v / w) sin(w T / 2): the heading leads the chord by w T / 2
  const q = Math.min(0.98, (dist * Math.abs(turn)) / (2 * sp));
  const half = Math.asin(q);
  const b = shoot(w, x, y, aim - Math.sign(turn) * half, sp, dmg, "eb_candy", 6);
  if (b) b.turn = turn;
}

function heal(e: Enemy, w: World): void {
  const k = e.elite ? HEAL_ELITE : HEAL;
  const buf = w.acquire();
  const n = w.grid.query(e.x, e.y - e.cy, MAGE_HEAL_R + 10, buf);
  const items = w.enemies.items;
  let healed = 0;
  for (let i = 0; i < n; i++) {
    const o = items[buf[i]];
    if (!o || o.dead || o.def.boss || !CANDY_IDS.has(o.def.id)) continue;
    const dx = o.x - e.x;
    const dy = o.y - e.y;
    if (dx * dx + dy * dy > MAGE_HEAL_R * MAGE_HEAL_R) continue;
    if (o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + Math.ceil(o.maxHp * k));
    if (e.elite) {
      o.slow = HASTE;
      o.slowT = HASTE_T;
    }
    if (o !== e) {
      healed++;
      cue(w, CK_HEALED, o.x, o.y - o.cy, 0, 0, o.scale, 0, o);
    }
  }
  w.release();
  cue(w, CK_HEAL, e.x, e.y - e.cy, 0, 0, MAGE_HEAL_R, healed, e);
  say(w, e, "Sugar rush!", false);
}

export const lollipopMage: EnemyDef = {
  id: "lollipop_mage",
  name: "Lollipop Mage",
  sprite: "en_lollipop_mage",
  fps: 5,
  hp: 30,
  speed: 28,
  dmg: 8,
  radius: 6,
  height: 15,
  xp: 3,
  shadow: 10,
  colors: [C.pink, C.mint, C.yellow, C.white],
  init(e, w) {
    candyInstall(w);
    e.a = w.rng.next() * TAU;
    e.timer = w.rng.range(1.2, 2.8);
    e.b = w.rng.int(0, 2);
    e.c = w.rng.next() < 0.5 ? 1 : -1;
  },
  // art: f0-1 float / bob, f2 cast (staff up, swirl glows), f3 heal pose (arms wide)
  frame(e) {
    if (e.state === MAGE_CHARGE) return mageHealing(e) ? 3 : 2;
    if (e.state === 2) return e.b % 3 === 0 ? 3 : 2;
    return Math.floor(e.t * 3 + e.a) & 1;
  },
  update(e, w, dt) {
    e.z = 4 + Math.sin(e.t * 2.6 + e.a) * 1.5;
    if (e.state === 0) {
      const d = keepAway(e, w, e.speed, 90);
      e.timer -= dt;
      if (e.timer <= 0) {
        if (d > 36 && d < 170 && onScreen(w, e.x, e.y, -6)) {
          e.state = MAGE_CHARGE;
          e.timer = 0;
          cue(w, CK_CAST, e.x + e.face * 3 * e.scale, staffY(e), 0, 0, mageHealing(e) ? 1 : 0, 0, e);
        } else e.timer = 0.3;
      }
      return;
    }
    if (e.state === MAGE_CHARGE) {
      e.vx *= 0.2;
      e.vy *= 0.2;
      e.timer += dt;
      if (e.timer < CHARGE) return;
      if (mageHealing(e)) heal(e, w);
      else {
        const x = e.x + e.face * 3 * e.scale;
        const y = staffY(e);
        const aim = aimAt(w, x, y);
        const dx = w.player.x - x;
        const dy = w.player.y - 8 - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const turn = TURN * e.c;
        if (e.elite || w.t >= FAN_AT) for (let i = -1; i <= 1; i++) candy(w, x, y, aim + i * 0.3, dist, turn, e.dmg);
        else candy(w, x, y, aim, dist, turn, e.dmg);
        e.c = -e.c;
        e.sqV -= 6;
      }
      e.b++;
      e.state = 2;
      e.timer = 0;
      return;
    }
    e.vx = e.vy = 0;
    e.timer += dt;
    if (e.timer >= RECOIL) {
      e.state = 0;
      e.timer = w.rng.range(2.3, 3.2) * (w.director.enraged ? 0.75 : 1);
    }
  },
};

export const enemies: EnemyDef[] = [lollipopMage];
