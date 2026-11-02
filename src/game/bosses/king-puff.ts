/**
 * KING PUFF (3:00 boss, DESIGN §3.5) - reference boss implementation.
 * Pattern loop: hop x3 toward the player -> big jump (landing circle
 * telegraph 1 s) -> slam: ring of 16 eb_orb + shockwave, summons 6 Puffs ->
 * short squashed recovery. Below 40% HP: faster hops and a 24-orb ring.
 *
 * Boss AI convention: `e.state` = pattern step, `e.timer` = time in step,
 * `e.a..e.d` = scratch (here: b = hop counter, c/d = jump target).
 * `e.z` lifts the sprite (hops / jumps); the view draws frame 3 (squashed)
 * while `e.state === REST`.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";

export const KP_HOP = 0;
export const KP_JUMP = 1;
export const KP_REST = 2;
const JUMP_TIME = 1.0;

function slam(e: Enemy, w: World, angry: boolean): void {
  const p = w.player;
  e.sqV -= 14;
  const n = angry ? 24 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    w.spawnBullet(e.x + Math.cos(a) * 10, e.y - 10 + Math.sin(a) * 10, Math.cos(a) * 70, Math.sin(a) * 70, 10, "eb_orb", 3, 5);
  }
  w.emit("shockwave", { x: e.x, y: e.y, r: 60, power: 1 });
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  if (dx * dx + dy * dy < 36 * 36) w.hurtPlayer(e.dmg * 1.4, e.x, e.y);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    w.spawnEnemy("puff", e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 22);
  }
}

export const kingPuff: EnemyDef = {
  id: "king_puff",
  name: "King Puff",
  sprite: "boss_kingpuff",
  fps: 6,
  hp: 1500,
  speed: 46,
  dmg: 15,
  radius: 17,
  height: 34,
  xp: 0,
  shadow: 40,
  knockResist: 0.95,
  colors: [C.mint, C.lime, C.yellow, C.white],
  boss: { title: "KING PUFF", subtitle: "Ruler of the Squish Kingdom", music: "boss" },
  // art: f0 idle, f1 squish, f2 stretched (airborne), f3 flat (landing)
  frame(e) {
    if (e.state === KP_REST) return 3;
    if (e.state === KP_JUMP) return e.z > 6 ? 2 : 1;
    if (e.z > 3) return 2;
    return e.timer < 0.05 ? 1 : 0;
  },
  init(e) {
    e.state = KP_HOP;
    e.timer = 0;
    e.b = 0;
  },
  update(e, w, dt) {
    const p = w.player;
    const angry = e.hp < e.maxHp * 0.4 || w.director.enraged;
    const hopT = angry ? 0.45 : 0.6;
    e.timer += dt;
    if (e.state === KP_HOP) {
      const k = e.timer / hopT;
      e.z = Math.sin(Math.min(1, k) * Math.PI) * 10;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const sp = k < 1 ? e.speed * (angry ? 1.4 : 1) * 1.6 : 0;
      e.vx = (dx / d) * sp;
      e.vy = (dy / d) * sp;
      if (e.timer >= hopT + 0.12) {
        e.timer = 0;
        e.b++;
        w.emit("shockwave", { x: e.x, y: e.y, r: 18, power: 0.15 });
        if (e.b >= 3) {
          // big jump onto the player's current spot (dodge it!)
          e.b = 0;
          e.state = KP_JUMP;
          e.c = p.x;
          e.d = p.y;
          w.telegraphCircle(p.x, p.y, 34, JUMP_TIME);
        }
      }
    } else if (e.state === KP_JUMP) {
      const t = e.timer / JUMP_TIME;
      e.z = Math.sin(Math.min(1, t) * Math.PI) * 70;
      const rem = Math.max(0.05, JUMP_TIME - e.timer);
      e.vx = (e.c - e.x) / rem;
      e.vy = (e.d - e.y) / rem;
      if (t >= 1) {
        e.x = e.c;
        e.y = e.d;
        e.z = 0;
        e.vx = e.vy = 0;
        e.state = KP_REST;
        e.timer = 0;
        slam(e, w, angry);
      }
    } else {
      e.vx = e.vy = 0;
      if (e.timer > (angry ? 0.5 : 0.9)) {
        e.state = KP_HOP;
        e.timer = 0;
      }
    }
  },
};

export const bosses: EnemyDef[] = [kingPuff];
