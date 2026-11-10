/**
 * Season 2 director event kinds (docs/content/stages.md §5), merged into
 * EVENT_HANDLERS by events.ts. Shared by the stages that use them:
 *
 *   laneCharge  telegraphed parallel lanes centred on the player, then a column of
 *               enemies crossing each lane in MODE_STRAIGHT (Donut Rollers, Watermelons,
 *               Mini Truck-kun)
 *   teleportIn  sparkle circles near the player, then the enemies pop in (Transfer
 *               Students, Plot Holes)
 *   bulletRain  bullets falling from the top edge of the view across the player's view,
 *               each crossing announced by a small ground shadow (Sprinkle Storm)
 *   schoolBell  the chime: every Hall Monitor on screen whistles and dashes, more
 *               Hall Monitors arrive evenly around the view edges
 *
 * Every spawn goes through w.spawnEnemy (twists / curse / the Filler Arc scale it);
 * each event emits one `waveIncoming` for the HUD banner (TimelineEvent.label).
 * Event-time closures only (no per-step allocation).
 */
import { CFG } from "../config";
import { MODE_STRAIGHT, type EnemyDef } from "../types";
import { ENEMIES } from "../registry";
import type { World } from "../world";
import type { Director } from "./director";
import type { TimelineEvent } from "../stage";
import { bulletRadius } from "../enemies/_bullets";
import { EFX_SUMMON, efx } from "../enemies/_fx";
import { monitorWhistle } from "../enemies/hall-monitor";

type Handler = (w: World, d: Director, ev: TimelineEvent) => void;

function def(id: string | undefined, d: Director): EnemyDef | undefined {
  return (id && ENEMIES.get(id)) || d.randomMixDef();
}

/** laneCharge lane spacing / telegraph (stages.md §5). */
export const LANE_GAP = 40;
export const LANE_HALF_W = 10;
export const LANE_TELE = 0.8;
export const LANE_STAGGER = 0.15;
export const LANE_COLOR = 0xffe14d;
/** teleportIn sparkle circles. */
export const TELE_R = 10;
export const TELE_T = 0.6;
export const TELE_COLOR = 0xddc6ff;
/** bulletRain: fall speed range, damage, shadow lead time. */
export const RAIN_SPEED_MIN = 65;
export const RAIN_SPEED_MAX = 85;
export const RAIN_DMG = 10;
export const RAIN_SHADOW = 0.6;
export const RAIN_SHADOW_COLOR = 0x2d1b45;

export const S2_EVENTS: Record<string, Handler> = {
  /**
   * `lines` parallel lanes LANE_GAP px apart, centred on the player, along a random axis.
   * Lane i telegraphs at i x LANE_STAGGER for LANE_TELE s, then `count / lines` enemies
   * enter in a column just outside the view and cross it at `speed`.
   */
  laneCharge(w, d, ev) {
    const e = def(ev.enemy, d);
    if (!e) return;
    const lines = Math.max(1, ev.lines ?? 3);
    const per = Math.max(1, Math.round((ev.count ?? 6) / lines));
    const speed = ev.speed ?? 160;
    const p = w.player;
    // axis: mostly horizontal / vertical (readable on a phone), sometimes diagonal
    const a = w.rng.next() < 0.75 ? w.rng.int(0, 3) * (Math.PI / 2) : w.rng.int(0, 3) * (Math.PI / 2) + Math.PI / 4;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const cx = p.x;
    const cy = p.y - CFG.playerCy;
    // half length of the lane across the view (from just outside one edge to just outside the other)
    const half = Math.abs(ux) * (w.viewW * 0.5) + Math.abs(uy) * (w.viewH * 0.5) + 26;
    let t = 0;
    let shown = 0;
    let fired = 0;
    w.emit("waveIncoming", { kind: "lanes", x: cx - ux * half, y: cy - uy * half, label: ev.label });
    d.addTask((dt) => {
      t += dt;
      while (shown < lines && t >= shown * LANE_STAGGER) {
        const o = (shown - (lines - 1) / 2) * LANE_GAP;
        const ox = cx + nx * o;
        const oy = cy + ny * o;
        w.telegraphLine(ox - ux * half, oy - uy * half, ox + ux * half, oy + uy * half, LANE_HALF_W, LANE_TELE, LANE_COLOR);
        shown++;
      }
      while (fired < lines && t >= fired * LANE_STAGGER + LANE_TELE) {
        const o = (fired - (lines - 1) / 2) * LANE_GAP;
        const sx = cx + nx * o - ux * (half + 6);
        const sy = cy + ny * o - uy * (half + 6);
        // the lane stays marked while its column crosses the view
        const ox = cx + nx * o;
        const oy = cy + ny * o;
        const cross = (half * 2 + per * (e.radius * 2 + 6) + 12) / Math.max(1, speed);
        w.telegraphLine(ox - ux * half, oy - uy * half, ox + ux * half, oy + uy * half, LANE_HALF_W, cross, LANE_COLOR);
        for (let i = 0; i < per; i++) {
          // (feet = collision centre + cy: spawn so the body rides the lane centre)
          const back = i * (e.radius * 2 + 6);
          const en = w.spawnEnemy(e, sx - ux * back, sy - uy * back + e.height * 0.5);
          if (!en) continue;
          en.mode = MODE_STRAIGHT;
          en.vx = ux * speed;
          en.vy = uy * speed;
          en.face = ux >= 0 ? 1 : -1;
        }
        fired++;
      }
      return fired < lines;
    });
  },

  /** `count` sparkle circles 40-70 px from the player (>= 90 px for Plot Holes); the enemies pop in after TELE_T s. */
  teleportIn(w, d, ev) {
    const e = def(ev.enemy, d);
    if (!e) return;
    const n = Math.max(1, ev.count ?? 3);
    const p = w.player;
    const far = e.id === "plot_hole";
    const r0 = far ? 90 : 40;
    const r1 = far ? 110 : 70;
    const a0 = w.rng.angle();
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    const hw = w.viewW * 0.5 - 14;
    const hh = w.viewH * 0.5 - 14;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + w.rng.spread(0.5 / n + 0.15);
      const r = w.rng.range(r0, r1);
      // (kept on screen: portrait views are narrow)
      xs[i] = Math.min(p.x + hw, Math.max(p.x - hw, p.x + Math.cos(a) * r));
      ys[i] = Math.min(p.y + hh, Math.max(p.y - hh, p.y + Math.sin(a) * r));
      w.telegraphCircle(xs[i], ys[i], TELE_R, TELE_T, TELE_COLOR);
    }
    w.emit("waveIncoming", { kind: "teleport", x: p.x, y: p.y, label: ev.label });
    let t = 0;
    d.addTask((dt) => {
      t += dt;
      if (t < TELE_T) return true;
      for (let i = 0; i < n; i++) {
        const en = w.spawnEnemy(e, xs[i], ys[i]);
        if (en) efx(w, EFX_SUMMON, xs[i], ys[i], 0, 0, 0.8, en);
      }
      return false;
    });
  },

  /**
   * `count` bullets over `duration` s from the top edge of the view at random x, straight down at
   * 65-85 px/s (dmg 10): each crossing of the player's row is announced RAIN_SHADOW s ahead by a
   * small ground shadow. Never within 40 px (x) of the player in the first 0.5 s.
   */
  bulletRain(w, d, ev) {
    const sprite = ev.sprite ?? "eb_orb";
    const total = Math.max(1, ev.count ?? 40);
    const dur = Math.max(0.5, ev.duration ?? 8);
    const rad = bulletRadius(sprite);
    const rate = total / dur;
    let left = total;
    let acc = 0;
    let t = 0;
    // pending shadows: [time, x, y] ring (event-time arrays, reused for the event's life)
    const shT = new Float64Array(total);
    const shX = new Float64Array(total);
    const shY = new Float64Array(total);
    let shHead = 0;
    let shN = 0;
    const p = w.player;
    w.emit("waveIncoming", { kind: "rain", x: p.x, y: p.y - w.viewH * 0.5, label: ev.label });
    d.addTask((dt) => {
      t += dt;
      acc += rate * dt;
      while (acc >= 1 && left > 0) {
        acc -= 1;
        left--;
        let x = 0;
        for (let tries = 0; tries < 6; tries++) {
          x = p.x + w.rng.spread(w.viewW * 0.5 - 4);
          if (t > 0.5 || Math.abs(x - p.x) > 40) break;
        }
        const top = p.y - w.viewH * 0.5 - 8;
        const vy = w.rng.range(RAIN_SPEED_MIN, RAIN_SPEED_MAX);
        const life = (w.viewH + 40) / vy;
        w.spawnBullet(x, top, 0, vy, RAIN_DMG, sprite, rad, life);
        // the shadow appears RAIN_SHADOW s before it crosses the player's current row
        const travel = (p.y - CFG.playerCy - top) / (vy * w.difficulty.bulletSpeed);
        shT[shHead] = t + Math.max(0, travel - RAIN_SHADOW);
        shX[shHead] = x;
        shY[shHead] = p.y;
        shHead = (shHead + 1) % total;
        shN++;
      }
      // emit due shadows (in spawn order)
      while (shN > 0) {
        const i = (shHead - shN + total) % total;
        if (shT[i] > t) break;
        w.telegraphCircle(shX[i], shY[i], 5, RAIN_SHADOW, RAIN_SHADOW_COLOR);
        shN--;
      }
      return left > 0 || shN > 0;
    });
  },

  /** The bell: every Hall Monitor on screen whistles and dashes; `count` more arrive evenly around the view edges. */
  schoolBell(w, _d, ev) {
    const p = w.player;
    w.emit("waveIncoming", { kind: "bell", x: p.x, y: p.y, label: ev.label });
    const items = w.enemies.items;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i];
      if (!e.dead && e.def.id === "hall_monitor") monitorWhistle(e, w, true);
    }
    const m = ENEMIES.get(ev.enemy ?? "hall_monitor");
    if (!m) return;
    const n = Math.max(1, ev.count ?? 8);
    const hw = w.viewW * 0.5 + 14;
    const hh = w.viewH * 0.5 + 14;
    const per = (hw + hh) * 4;
    const off = w.rng.next() * per;
    for (let i = 0; i < n; i++) {
      // evenly spaced along the view rectangle's perimeter
      let s = (off + (i / n) * per) % per;
      let x: number;
      let y: number;
      if (s < hw * 2) {
        x = p.x - hw + s;
        y = p.y - hh;
      } else if ((s -= hw * 2) < hh * 2) {
        x = p.x + hw;
        y = p.y - hh + s;
      } else if ((s -= hh * 2) < hw * 2) {
        x = p.x + hw - s;
        y = p.y + hh;
      } else {
        s -= hw * 2;
        x = p.x - hw;
        y = p.y + hh - s;
      }
      w.spawnEnemy(m, x, y);
    }
  },
};
