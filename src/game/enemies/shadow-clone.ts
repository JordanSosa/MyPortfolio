/**
 * SHADOW CLONE (The Final Arc, docs/content/enemies.md §4). A dark copy of
 * the hero: her own run animation (per-instance `skin`), dark-plum tinted, with
 * red eyes and a violet afterimage trail drawn by the view. Seeks at the
 * hero's base speed.
 *
 * Twist - Mirror: when the hero dashes, every Shadow Clone on screen dashes
 * too (toward her, 0.16 s at 300 px/s, 0.25 s later). Every 2.5 s it fires one
 * dark eb_orb (tint 0x743fd1) at her. Elite "Evil Twin": also copies her start
 * weapon at Lv1 as enemy bullets (one aimed dark orb per that weapon's cooldown).
 *
 * state 0 seek, 1 mirrored dash. timer = next orb, b = next Evil Twin orb,
 * c = the dash it already mirrored (World.t of the dash), d = dash time left.
 */
import { C } from "../../art/palette";
import { enemyDmgScale } from "../config";
import { WEAPONS } from "../registry";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt } from "./_bullets";
import { onScreen } from "./_fx";
import { BX_MIRROR, cue } from "./_s45";
import { toPlayer } from "./_steer";
import { shot } from "../bosses/_s45boss";

export const CLONE_TINT = 0x2d1b45;
export const CLONE_ORB_TINT = 0x743fd1;
export const MIRROR_DELAY = 0.25;
export const MIRROR_TIME = 0.16;
export const MIRROR_SPEED = 300;
const ORB_EVERY = 2.5;
const ORB_SPEED = 70;
const ORB_DMG = 12;

/** World.t of the hero's last dash, per world (one dash hook per world). */
const LAST_DASH = new WeakMap<World, { t: number }>();

function dashClock(w: World): { t: number } {
  let c = LAST_DASH.get(w);
  if (!c) {
    const clock = { t: -1e9 };
    c = clock;
    LAST_DASH.set(w, clock);
    w.hooks.on("dash", () => {
      clock.t = w.t;
    });
  }
  return c;
}

const dir = { x: 0, y: 0 };

function orb(e: Enemy, w: World): void {
  const y = e.y - e.cy - 2;
  shot(w, e.x, y, aimAt(w, e.x, y), ORB_SPEED, ORB_DMG * enemyDmgScale(w.t), "eb_orb", CLONE_ORB_TINT, 5);
}

/** Lv1 cooldown of the hero's start weapon (the Evil Twin's fire rate). */
function twinCd(w: World): number {
  const d = WEAPONS.get(w.startWeapon);
  return Math.max(0.6, d?.levels[0]?.cd ?? 1.2);
}

export const shadowClone: EnemyDef = {
  id: "shadow_clone",
  name: "Shadow Clone",
  // (re-skinned per instance as the current hero's run animation)
  sprite: "hoshi_run",
  fps: 13,
  hp: 150,
  speed: 72,
  dmg: 14,
  radius: 6,
  height: 12,
  xp: 5,
  shadow: 12,
  knockResist: 0.3,
  tint: CLONE_TINT,
  colors: [C.deep, C.darkViolet, C.red],
  init(e, w) {
    e.skin = `${w.hero.sprite}_run`;
    e.timer = w.rng.range(1, ORB_EVERY);
    e.b = twinCd(w);
    e.c = dashClock(w).t;
  },
  update(e, w, dt) {
    const clock = dashClock(w);
    // Mirror: the hero dashed - every clone on screen follows suit 0.25 s later
    if (e.state === 0 && clock.t > e.c && w.t >= clock.t + MIRROR_DELAY) {
      e.c = clock.t;
      if (onScreen(w, e.x, e.y, 0)) {
        toPlayer(e, w, dir);
        e.state = 1;
        e.d = MIRROR_TIME;
        e.vx = dir.x * MIRROR_SPEED;
        e.vy = dir.y * MIRROR_SPEED;
        cue(w, BX_MIRROR, e.x, e.y, dir.x, dir.y, 1, e);
      }
    }
    if (e.state === 1) {
      e.d -= dt;
      if (e.d <= 0) e.state = 0;
      return;
    }
    toPlayer(e, w, dir);
    e.vx = dir.x * e.speed;
    e.vy = dir.y * e.speed;
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = ORB_EVERY;
      if (onScreen(w, e.x, e.y, -8)) orb(e, w);
    }
    if (e.elite) {
      e.b -= dt;
      if (e.b <= 0) {
        e.b = twinCd(w);
        if (onScreen(w, e.x, e.y, -8)) orb(e, w);
      }
    }
  },
};

export const enemies: EnemyDef[] = [shadowClone];
