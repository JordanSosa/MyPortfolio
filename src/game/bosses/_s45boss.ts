/**
 * Boss helpers shared by the Beach Episode / The Final Arc bosses (helper - no
 * `bosses` export). Same conventions as nightmare-teddy.ts / lady-lunatic.ts:
 * per-boss state in a module WeakMap reset in init(), `e.state` / `e.timer` as
 * the pattern step, a pattern cycle per phase, patterns only start while the
 * boss is readable on screen, a phase change = invulnerable flourish
 * (`inv`, clearBullets, `bossPhase` banner + shockwave, a scripted taunt).
 *
 * Import-free of world.ts values (types only) - see ARCHITECTURE.md, import rule.
 */
import { clamp } from "../../core/math";
import { CFG } from "../config";
import type { StageFxEvent } from "../events";
import type { Bullet, Enemy } from "../types";
import type { World } from "../world";
import { SAFE_SPAWN, bulletRadius } from "../enemies/_bullets";
import { shock } from "../enemies/_fx";
import { say } from "../enemies/_say";
import { minBossFeetY } from "./_entrance";

/** Phase-change flourish length (s): invulnerable, no pattern. */
export const FLOURISH = 1.6;

export function go(e: Enemy, state: number): void {
  e.state = state;
  e.timer = 0;
}

/**
 * The whole sprite (`top` px tall above the feet) is inside the view and clear of the top HUD:
 * a pattern starts only where the player can read its wind-up.
 */
export function readable(e: Enemy, w: World, top: number, margin = 12): boolean {
  const p = w.player;
  const hh = w.viewH * 0.5;
  return Math.abs(e.x - p.x) < w.viewW * 0.5 - margin && e.y - e.z - top > minBossFeetY(w, 0) - 6 && e.y < p.y + hh - 4;
}

/** Phase change: invulnerable flourish, bullets cleared, banner + shockwave, a scripted taunt. */
export function phaseFlourish(e: Enemy, w: World, phase: number, title: string, subtitle: string, taunt: string, inv = FLOURISH): void {
  e.inv = inv + 0.2;
  w.clearBullets();
  w.emit("bossPhase", { id: e.def.id, phase, x: e.x, y: e.y, title, subtitle });
  shock(w, e.x, e.y - e.cy, 90, 1);
  if (taunt) say(w, e, taunt);
}

/** Final boss down: every other enemy dissolves in light outward from it (the victory dawn), bullets cleared. */
export { dawnOut as finalDawn } from "./_dawn";

/** Float toward (tx, ty) at up to `max` px/s (eased: fast when far, gentle when close). */
export function steerTo(e: Enemy, tx: number, ty: number, max: number): void {
  const dx = tx - e.x;
  const dy = ty - e.y;
  e.vx = clamp(dx * 2, -max, max);
  e.vy = clamp(dy * 2, -max, max);
}

/**
 * The hover anchor bosses fight from: above the hero on portrait screens, beside her (left first: the
 * touch buttons sit bottom-right) on wide landscape screens. `dist` = how far, `top` = sprite height.
 */
export function anchor(e: Enemy, w: World, dist: number, top: number, out: { x: number; y: number }): void {
  const p = w.player;
  if (w.viewW > w.viewH * 1.2) {
    const side = e.x > p.x + 2 ? 1 : -1;
    out.x = p.x + side * Math.min(dist + 20, w.viewW * 0.3);
    out.y = Math.max(minBossFeetY(w, top), p.y + 10);
  } else {
    out.x = p.x + Math.sin(e.t * 0.5) * 30;
    out.y = Math.max(minBossFeetY(w, top), p.y - Math.min(dist, w.viewH * 0.5 - 60));
  }
}

/**
 * One aimed / ring bullet with a tint, unless it would appear on the hero (the _bullets.ts fairness rule).
 * Returns the bullet (configure turn / accel) or null.
 */
export function shot(w: World, x: number, y: number, ang: number, speed: number, dmg: number, sprite: string, tint = 0xffffff, life = 7): Bullet | null {
  const p = w.player;
  const dx = x - p.x;
  const dy = y - (p.y - CFG.playerCy);
  if (dx * dx + dy * dy < SAFE_SPAWN * SAFE_SPAWN) return null;
  const b = w.spawnBullet(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, dmg, sprite, bulletRadius(sprite), life);
  b.tint = tint;
  return b;
}

/** Ring of `n` tinted shots (returns how many spawned). */
export function ringOf(w: World, x: number, y: number, n: number, a0: number, speed: number, dmg: number, sprite: string, tint = 0xffffff, r0 = 8, accel = 0, turn = 0): number {
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const b = shot(w, x + Math.cos(a) * r0, y + Math.sin(a) * r0, a, speed, dmg, sprite, tint);
    if (b) {
      b.accel = accel;
      b.turn = turn;
      k++;
    }
  }
  return k;
}

/** Fan of `n` tinted shots centred on `aim`, `step` rad apart. */
export function fanOf(w: World, x: number, y: number, n: number, aim: number, step: number, speed: number, dmg: number, sprite: string, tint = 0xffffff, r0 = 6): number {
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = aim + (i - (n - 1) / 2) * step;
    if (shot(w, x + Math.cos(a) * r0, y + Math.sin(a) * r0, a, speed, dmg, sprite, tint)) k++;
  }
  return k;
}

/** Point-to-segment distance check: is the hero's body within `half` px of the segment (x0, y0)-(x1, y1)? */
export function heroInLane(w: World, x0: number, y0: number, x1: number, y1: number, half: number): boolean {
  const p = w.player;
  const px = p.x;
  const py = p.y - CFG.playerCy;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1);
  const qx = x0 + dx * t - px;
  const qy = y0 + dy * t - py;
  return qx * qx + qy * qy < half * half;
}

// ---------------------------------------------------------------- stageFx directives (one reused payload)
const fxEv: StageFxEvent = { kind: "", value: 0, seconds: 0, id: "" };

/** Tell the view to change the show's look (src/view/stage-view.ts directive). */
export function stageFx(w: World, kind: string, value: number, seconds = 0, id = ""): void {
  fxEv.kind = kind;
  fxEv.value = value;
  fxEv.seconds = seconds;
  fxEv.id = id;
  w.emit("stageFx", fxEv);
}
