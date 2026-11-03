/**
 * PLOT HOLE (The Final Arc, docs/content/enemies.md §4). A swirling tear in the
 * storyboard: a stationary hazard drifting 8 px/s toward the hero, never
 * spawned closer than 90 px, at most 3 alive (the cap the director can't
 * express yet: an extra one unspawns itself), no contact damage, never elite.
 *
 * Twist - Gravity: pulls the hero within 90 px toward its centre (30 px/s at
 * the edge -> 60 px/s near the core) and deals 14 every 0.5 s inside r 12. It
 * also eats gems and player projectiles that enter r 12 (they vanish in a
 * swirl), storing the gems. Killed: "PLOT HOLE FILLED!" and every eaten gem is
 * spat back out. Collapses by itself after 20 s (spitting the gems too).
 *
 * timer = next core tick, a = stored gem XP, b = gems eaten (count).
 */
import { C } from "../../art/palette";
import { enemyDmgScale } from "../config";
import { PK_FREE, type Enemy, type EnemyDef } from "../types";
import type { World } from "../world";
import { BX_FILLED, BX_SWALLOW, countAlive, cue, pullHero } from "./_s45";
import { toPlayer } from "./_steer";

export const HOLE_PULL_R = 90;
export const HOLE_CORE_R = 12;
export const HOLE_MAX = 3;
export const HOLE_LIFE = 20;
const CORE_DMG = 14;
const CORE_EVERY = 0.5;
const MIN_SPAWN = 90;

const dir = { x: 0, y: 0 };

/** Spit the swallowed gems back out (a few big ones, never more than 8). */
function spit(e: Enemy, w: World, filled: boolean): void {
  const xp = e.a;
  const n = Math.min(8, Math.max(xp > 0 ? 1 : 0, Math.round(e.b)));
  for (let i = 0; i < n; i++) w.dropGem(e.x, e.y - 6, xp / n);
  cue(w, BX_FILLED, e.x, e.y - e.cy, filled ? 1 : 0, 0, n, e);
  e.a = e.b = 0;
}

export const plotHole: EnemyDef = {
  id: "plot_hole",
  name: "Plot Hole",
  sprite: "en_plot_hole",
  fps: 6,
  hp: 500,
  speed: 8,
  dmg: 0,
  radius: 12,
  height: 12,
  xp: 8,
  shadow: 0,
  knockResist: 1,
  noElite: true,
  noSeparation: true,
  colors: [C.deep, C.darkViolet, C.violet, C.white],
  init(e, w) {
    e.a = e.b = 0;
    e.timer = CORE_EVERY;
    // (cap: a 4th hole never opens)
    if (countAlive(w, "plot_hole") > HOLE_MAX) {
      w.despawn(e);
      return;
    }
    // never closer than 90 px
    const dx = e.x - w.player.x;
    const dy = e.y - w.player.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < MIN_SPAWN) {
      const k = d > 1 ? MIN_SPAWN / d : 0;
      e.x = w.player.x + (k ? dx * k : MIN_SPAWN);
      e.y = w.player.y + (k ? dy * k : 0);
    }
  },
  update(e, w, dt) {
    const p = w.player;
    const d = toPlayer(e, w, dir);
    e.vx = dir.x * e.speed;
    e.vy = dir.y * e.speed;
    // gravity well (on the hero's feet: the hole is a hole in the ground)
    if (d < HOLE_PULL_R && !p.dead) {
      const pull = 30 + 30 * (1 - d / HOLE_PULL_R);
      const step = Math.min(d, pull * dt);
      pullHero(w, -dir.x * step, -dir.y * step);
    }
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = CORE_EVERY;
      if (d < HOLE_CORE_R + 4) w.hurtPlayer(CORE_DMG * enemyDmgScale(w.t), e.x, e.y, e.def.id);
    }
    const cy = e.y - e.cy;
    // it eats gems...
    const R2 = HOLE_CORE_R * HOLE_CORE_R;
    const gems = w.gems.items;
    for (let i = 0; i < w.gems.count; i++) {
      const g = gems[i];
      if (g.dead) continue;
      const gx = g.x - e.x;
      const gy = g.y - e.y;
      if (gx * gx + gy * gy > R2) continue;
      g.dead = true;
      e.a += g.value;
      e.b++;
      cue(w, BX_SWALLOW, g.x, g.y, 0, 0, 1, e);
    }
    // ...and the hero's projectiles
    const pr = w.projectiles.items;
    for (let i = 0; i < w.projectiles.count; i++) {
      const q = pr[i];
      if (q.dead || q.kind !== PK_FREE) continue;
      const qx = q.x - e.x;
      const qy = q.y - cy;
      if (qx * qx + qy * qy > R2) continue;
      q.dead = true;
      cue(w, BX_SWALLOW, q.x, q.y, 0, 0, 2, e);
    }
    // the plot moves on without it
    if (e.t >= HOLE_LIFE) {
      spit(e, w, false);
      w.despawn(e);
    }
  },
  onDeath(e, w) {
    spit(e, w, true);
  },
};

export const enemies: EnemyDef[] = [plotHole];
