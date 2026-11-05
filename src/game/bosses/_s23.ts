/**
 * Boss kit for the Candy Kingdom / Shoujo Academy bosses (helper - no
 * `bosses` export, import-cycle free: types only from world/registry).
 *
 *   hoverAnchor   where a floating / standing boss keeps itself: above the
 *                 player on portrait screens, beside them (mostly left, away from
 *                 the touch buttons) on wide landscape views, never under the HUD
 *   lineAcross    a straight line of enemies crossing the view through a point
 *                 (Royal Decree, the Fan Club, love-letter storms)
 *   rain          telegraphed falling bullets (Rose Rain): a fixed-size queue
 *   dawnOut       a final boss's death: every other enemy dissolves in light
 */
import { clamp } from "../../core/math";
import { MODE_STRAIGHT, type Enemy } from "../types";
import type { World } from "../world";
import { bossHeadroom, minBossFeetY } from "./_entrance";
import { EFX_TELE_IN, EFX_TELE_OUT, efx, onScreen } from "../enemies/_fx";
import { CFG } from "../config";

export const TAU = Math.PI * 2;

/** Smallest signed angle a - b in (-PI, PI]. */
export function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d <= -Math.PI) d += TAU;
  return d;
}

export const wide = (w: World): boolean => w.viewW > w.viewH * 1.2;

/**
 * Hover / stand target for a boss whose sprite is `top` px tall (body + float):
 * `up` px above the player on portrait screens (swaying `sway` px), or ~a quarter
 * view beside them on landscape (keeps its side; never under the top HUD).
 */
export function hoverAnchor(e: Enemy, w: World, up: number, sway: number, top: number, out: { x: number; y: number }): void {
  const p = w.player;
  if (wide(w)) {
    const side = e.x > p.x + 2 ? 1 : -1;
    out.x = p.x + side * Math.min(100, w.viewW * 0.25);
    out.y = Math.max(minBossFeetY(w, top + 4), p.y - 12 + Math.sin(e.t * 0.6) * 12);
  } else {
    out.x = p.x + Math.sin(e.t * 0.55) * sway;
    out.y = Math.max(minBossFeetY(w, top + 4), p.y - Math.min(up, w.viewH * 0.5 - 70));
  }
}

/**
 * Glide toward (tx, ty) at up to `max` px/s (sets velocity). Left far behind (the hero ran
 * off while it was casting) it catches up at up to 2x its own speed, so a boss never
 * fights from off screen.
 */
export function glide(e: Enemy, tx: number, ty: number, max: number): void {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const m = d > 60 ? Math.max(max, e.speed * Math.min(2, (d - 60) / 40)) : max;
  e.vx = clamp(dx * 2, -m, m);
  e.vy = clamp(dy * 2, -m, m);
}

/**
 * `count` enemies in a straight line flying along angle `a` across the view,
 * passing (perpendicular offset `off`) through (x, y). Returns how many spawned.
 */
export function lineAcross(w: World, id: string, count: number, speed: number, a: number, x: number, y: number, off = 0): number {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const dist = Math.max(w.viewW, w.viewH) * 0.5 + 30;
  const cx = x - dx * dist - dy * off;
  const cy = y - dy * dist + dx * off;
  let n = 0;
  for (let i = 0; i < count; i++) {
    const s = (i - (count - 1) / 2) * 11;
    const en = w.spawnEnemy(id, cx - dy * s, cy + dx * s);
    if (!en) continue;
    en.mode = MODE_STRAIGHT;
    en.vx = dx * speed;
    en.vy = dy * speed;
    en.face = dx >= 0 ? 1 : -1;
    n++;
  }
  return n;
}

/**
 * Telegraphed bullet rain (Rose Rain): `n` bullets over `dur` s fall from the top
 * edge of the view at random x; each crossing of the player's row gets a small
 * ground shadow `lead` s before. Fixed-size queues: create once per boss.
 */
export class Rain {
  private readonly sx: Float64Array;
  private readonly st: Float64Array;
  private readonly sy: Float64Array;
  private head = 0;
  private pending = 0;
  private left = 0;
  private acc = 0;
  private rate = 0;
  private t = 0;
  private sprite = "eb_orb";
  private dmg = 0;
  private r = 2.5;
  private speed0 = 60;
  private speed1 = 80;
  constructor(private readonly cap: number) {
    this.sx = new Float64Array(cap);
    this.st = new Float64Array(cap);
    this.sy = new Float64Array(cap);
  }
  start(n: number, dur: number, sprite: string, dmg: number, r: number, speed0: number, speed1: number): void {
    this.left = Math.min(n, this.cap);
    this.rate = this.left / Math.max(0.1, dur);
    this.acc = 0;
    this.t = 0;
    this.sprite = sprite;
    this.dmg = dmg;
    this.r = r;
    this.speed0 = speed0;
    this.speed1 = speed1;
    this.head = 0;
    this.pending = 0;
  }
  get busy(): boolean {
    return this.left > 0 || this.pending > 0;
  }
  stop(): void {
    this.left = 0;
    this.pending = 0;
  }
  update(w: World, dt: number, lead: number, shadowColor: number): void {
    if (!this.busy) return;
    this.t += dt;
    this.acc += this.rate * dt;
    const p = w.player;
    while (this.acc >= 1 && this.left > 0) {
      this.acc -= 1;
      this.left--;
      let x = 0;
      for (let k = 0; k < 6; k++) {
        x = p.x + w.rng.spread(w.viewW * 0.5 - 6);
        if (this.t > 0.5 || Math.abs(x - p.x) > 30) break;
      }
      const top = p.y - w.viewH * 0.5 - 8;
      const vy = w.rng.range(this.speed0, this.speed1);
      w.spawnBullet(x, top, 0, vy, this.dmg, this.sprite, this.r, (w.viewH + 40) / vy);
      const travel = (p.y - CFG.playerCy - top) / (vy * w.difficulty.bulletSpeed);
      const i = this.head;
      this.sx[i] = x;
      this.sy[i] = p.y;
      this.st[i] = this.t + Math.max(0, travel - lead);
      this.head = (this.head + 1) % this.cap;
      this.pending++;
    }
    while (this.pending > 0) {
      const i = (this.head - this.pending + this.cap) % this.cap;
      if (this.st[i] > this.t) break;
      w.telegraphCircle(this.sx[i], this.sy[i], 5, lead, shadowColor);
      this.pending--;
    }
  }
}

/** A final boss falls: every other on-screen enemy dissolves in light (victory dawn), the rest just leave. */
export { dawnOut } from "./_dawn";

/** Distance from (px, py) to the segment (x0, y0)-(x1, y1). */
export function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const sx = x1 - x0;
  const sy = y1 - y0;
  const L2 = sx * sx + sy * sy || 1;
  const u = clamp(((px - x0) * sx + (py - y0) * sy) / L2, 0, 1);
  const dx = px - (x0 + sx * u);
  const dy = py - (y0 + sy * u);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Is the boss's body on screen (patterns only start then)? */
export function bossVisible(e: Enemy, w: World, margin = -12): boolean {
  return onScreen(w, e.x, e.y - e.cy, margin);
}

/** Seconds off screen after which a boss between patterns warps back into view. */
export const OFF_WARP = 1.2;

/**
 * Off-screen clock: + dt while the boss's body is outside the view (with margin) or tucked under
 * the top HUD band, reset when it is properly visible.
 */
export function offClock(e: Enemy, w: World, acc: number, dt: number): number {
  const underHud = e.y - e.cy < w.player.y - w.viewH * 0.5 + bossHeadroom(w.viewH) * 0.8;
  return onScreen(w, e.x, e.y - e.cy, 6) && !underHud ? 0 : acc + dt;
}

/** Vanish here and reappear at (x, y) in a sparkle burst (the hero ran off: bosses never fight from off screen). */
export function warpTo(e: Enemy, w: World, x: number, y: number): void {
  efx(w, EFX_TELE_OUT, e.x, e.y - e.cy, 0, 0, 1, e);
  e.x = x;
  e.y = y;
  e.kx = e.ky = 0;
  e.inv = Math.max(e.inv, 0.3);
  efx(w, EFX_TELE_IN, e.x, e.y - e.cy, 0, 0, 1.2, e);
}
