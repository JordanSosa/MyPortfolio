/**
 * ANIMATION ERROR (The Final Arc, docs/content/enemies.md §4). A cute
 * character drawn badly on purpose. Seeks with frame-skip movement: instead of
 * moving smoothly it teleports 12 px toward the hero every 0.25 s
 * (unpredictable, but fair: same average speed, never a jump onto her).
 *
 * Twist - Off-Model: its hitbox (r 5) is smaller than its drawn size; every
 * ~1.5 s it draws for one frame at x2 scale or squashed (the view, with
 * fx_glitch blocks). On death it leaves 2 "dropped frames": static copies
 * (12 HP, no damage, 1.5 s) that soak projectiles. Elite "Key Animation
 * Missing": a pure sketch outline (view) immune to knockback.
 *
 * timer = next frame skip, a = glitch phase (view).
 */
import { C } from "../../art/palette";
import type { EnemyDef } from "../types";
import { BX_SKIP, cue } from "./_s45";
import { toPlayer } from "./_steer";

export const SKIP_EVERY = 0.25;
export const DROPPED_LIFE = 1.5;
/** Px per skip at the base speed 40 (an elite's 0.9x speed skips a little shorter). */
const SKIP_PX = 12;

const dir = { x: 0, y: 0 };

export const animationError: EnemyDef = {
  id: "animation_error",
  name: "Animation Error",
  sprite: "en_animation_error",
  fps: 8,
  hp: 90,
  speed: 40,
  dmg: 12,
  radius: 5,
  height: 12,
  xp: 3,
  shadow: 10,
  colors: [C.pink, C.cyan, C.lime, C.white],
  init(e, w) {
    e.timer = w.rng.range(0, SKIP_EVERY);
    e.a = w.rng.next() * 10;
  },
  update(e, w, dt) {
    e.vx = e.vy = 0;
    // Key Animation Missing: no knockback either
    if (e.elite) e.kx = e.ky = 0;
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer += SKIP_EVERY;
    const d = toPlayer(e, w, dir);
    const step = Math.min(SKIP_PX * (e.speed / 40), Math.max(0, d - 6));
    if (step <= 0) return;
    const ox = e.x;
    const oy = e.y;
    e.x += dir.x * step;
    e.y += dir.y * step;
    e.face = dir.x >= 0 ? 1 : -1;
    cue(w, BX_SKIP, e.x, e.y, ox, oy, step, e);
  },
  onDeath(e, w) {
    // two dropped frames hang in the air where it was
    for (let i = 0; i < 2; i++) {
      const f = w.spawnEnemy("dropped_frame", e.x + (i ? 5 : -5), e.y + (i ? 2 : -2));
      if (f) f.face = e.face;
    }
  },
};

/** A frozen leftover frame: soaks projectiles, does nothing else, gone after 1.5 s. */
export const droppedFrame: EnemyDef = {
  id: "dropped_frame",
  name: "Dropped Frame",
  sprite: "en_animation_error",
  hp: 12,
  speed: 0,
  dmg: 0,
  radius: 5,
  height: 12,
  xp: 0,
  shadow: 0,
  knockResist: 1,
  special: true,
  noElite: true,
  noSeparation: true,
  // (a static decoy of its Animation Error, not a roster enemy: no wiki entry of its own)
  noCodex: true,
  colors: [C.cyan, C.pink, C.white],
  init(e) {
    // 12 HP flat (no time scaling)
    e.maxHp = e.hp = 12;
    e.alpha = 0.6;
  },
  frame() {
    return 0;
  },
  update(e, w) {
    e.vx = e.vy = 0;
    e.kx = e.ky = 0;
    if (e.t >= DROPPED_LIFE) w.despawn(e);
  },
};

export const enemies: EnemyDef[] = [animationError, droppedFrame];
