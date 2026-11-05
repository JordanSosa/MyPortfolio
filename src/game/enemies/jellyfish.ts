/**
 * JELLYFISH (Beach Episode, docs/content/enemies.md §3). Drifts lazily on a
 * slow Boo-style sine. Twist - Zap Pulse: every 4 s it glows for 0.5 s (a
 * cyan r 28 telegraph circle), then pulses an electric ring (r 28): 8 damage
 * and a 30 % slow for 1 s if the hero is inside. Chain: when one dies, the
 * other jellyfish within 50 px take 30 % of their max HP (a lightning line
 * between them) - lightning-weapon catnip. Elite: r 40, every 3 s.
 *
 * state 0 drift (timer = next pulse), 1 glow (tell).
 * a = sine phase.
 */
import { C } from "../../art/palette";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { toPlayer } from "./_steer";
import { onScreen } from "./_fx";
import { BX_CHAIN, BX_ZAP, cue, slowFor } from "./_s45";

export const JELLY_TELL = 0.5;
export function jellyRadius(e: Enemy): number {
  return e.elite ? 40 : 28;
}
function every(e: Enemy): number {
  return e.elite ? 3 : 4;
}
export const JELLY_CHAIN_R = 50;
const CHAIN_FRAC = 0.3;

const dir = { x: 0, y: 0 };
/** Chain depth guard (a chain reaction through a whole bloom stays bounded). */
let chainDepth = 0;

export const jellyfish: EnemyDef = {
  id: "jellyfish",
  name: "Jellyfish",
  sprite: "en_jellyfish",
  fps: 6,
  hp: 40,
  speed: 20,
  dmg: 8,
  radius: 6,
  height: 14,
  xp: 2,
  shadow: 10,
  colors: [C.lavender, C.pinkLight, C.aqua],
  init(e, w) {
    e.a = w.rng.angle();
    e.timer = w.rng.range(1.5, every(e));
  },
  // art: f0-2 pulse swim (bell squashes), f3 glow (bright outline)
  frame(e) {
    if (e.state === 1) return 3;
    return Math.floor(e.t * 5 + e.a) % 3;
  },
  update(e, w, dt) {
    const d = toPlayer(e, w, dir);
    const s = Math.sin(e.t * 1.6 + e.a);
    const k = Math.min(1, d / 40);
    const sp = e.speed * (0.7 + 0.5 * Math.abs(Math.sin(e.t * 2.5 + e.a)));
    if (e.state === 0) {
      e.vx = (dir.x - dir.y * s * k) * sp;
      e.vy = (dir.y + dir.x * s * k) * sp;
      e.z = 3 + Math.sin(e.t * 2 + e.a) * 2;
      e.timer -= dt;
      if (e.timer <= 0) {
        if (onScreen(w, e.x, e.y, 10)) {
          e.state = 1;
          e.timer = 0;
          w.telegraphCircle(e.x, e.y, jellyRadius(e), JELLY_TELL, C.cyan);
        } else e.timer = 0.5;
      }
    } else {
      e.vx = e.vy = 0;
      e.timer += dt;
      if (e.timer >= JELLY_TELL) {
        e.state = 0;
        e.timer = every(e);
        const R = jellyRadius(e);
        const p = w.player;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const inside = dx * dx + dy * dy < R * R;
        if (inside && w.hurtPlayer(e.dmg, e.x, e.y, e.def.id)) slowFor(w, 0.7, 1);
        e.sqV += 6;
        cue(w, BX_ZAP, e.x, e.y, inside ? 1 : 0, 0, R, e);
      }
    }
  },
  onDeath(e, w) {
    if (chainDepth > 24) return;
    chainDepth++;
    const items = w.enemies.items;
    const R2 = JELLY_CHAIN_R * JELLY_CHAIN_R;
    for (let i = 0; i < w.enemies.count; i++) {
      const o = items[i];
      if (o === e || o.dead || o.def !== e.def) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy > R2) continue;
      cue(w, BX_CHAIN, e.x, e.y - e.cy, o.x, o.y - o.cy, 1, o);
      w.hitEnemy(o, o.maxHp * CHAIN_FRAC, null, Math.atan2(dy, dx), 30, 0, "jelly_chain", C.cyan);
    }
    chainDepth--;
  },
};

export const enemies: EnemyDef[] = [jellyfish];
