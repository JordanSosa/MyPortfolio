/**
 * Director event handlers, keyed by TimelineEvent.kind. To add a new event
 * kind: add a handler here and reference it from timeline.ts.
 *
 * Handlers spawn immediately or register a per-step task with
 * `d.addTask((dt) => stillRunning)` for things that unfold over time.
 */
import { MODE_STRAIGHT, type EnemyDef } from "../types";
import { BOSSES, ENEMIES } from "../registry";
import type { World } from "../world";
import type { Director } from "./director";
import type { TimelineEvent } from "./timeline";

export type EventHandler = (w: World, d: Director, ev: TimelineEvent) => void;

function def(id: string | undefined, d: Director): EnemyDef | undefined {
  return (id && ENEMIES.get(id)) || d.randomMixDef();
}

export const EVENT_HANDLERS: Record<string, EventHandler> = {
  /** A line (or several) of enemies flying straight across the screen through the player's area. */
  swarmLine(w, d, ev) {
    const e = def(ev.enemy, d);
    if (!e) return;
    const p = w.player;
    const lines = ev.lines ?? 1;
    const count = ev.count ?? 12;
    const speed = ev.speed ?? 75;
    for (let L = 0; L < lines; L++) {
      const a = w.rng.angle();
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const dist = Math.max(w.viewW, w.viewH) * 0.5 + 30;
      // perpendicular offset so the line sweeps across the player
      const off = (w.rng.next() - 0.5) * 40;
      const cx = p.x - dx * dist - dy * off;
      const cy = p.y - dy * dist + dx * off;
      for (let i = 0; i < count; i++) {
        const s = (i - (count - 1) / 2) * 11;
        const en = w.spawnEnemy(e, cx - dy * s + w.rng.spread(2), cy + dx * s + w.rng.spread(2));
        if (!en) continue;
        en.mode = MODE_STRAIGHT;
        en.vx = dx * speed;
        en.vy = dy * speed;
        en.face = dx >= 0 ? 1 : -1;
      }
      w.emit("waveIncoming", { kind: "swarm", x: cx, y: cy });
    }
  },

  /** A ring of enemies closing in around the player. */
  encircle(w, d, ev) {
    const e = def(ev.enemy, d);
    if (!e) return;
    const p = w.player;
    const n = ev.count ?? 24;
    const R = Math.max(w.viewW, w.viewH) * 0.5 + 16;
    const a0 = w.rng.angle();
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      w.spawnEnemy(e, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.8);
    }
    w.emit("waveIncoming", { kind: "encircle", x: p.x, y: p.y });
  },

  /** A dense stream pouring in from one direction over `duration` seconds. */
  flood(w, d, ev) {
    const e = def(ev.enemy, d);
    if (!e) return;
    const total = ev.count ?? 40;
    const dur = ev.duration ?? 6;
    const a = w.rng.angle();
    let left = total;
    let acc = 0;
    const rate = total / dur;
    w.emit("waveIncoming", { kind: "flood", x: w.player.x + Math.cos(a) * 100, y: w.player.y + Math.sin(a) * 100 });
    d.addTask((dt) => {
      acc += rate * dt;
      while (acc >= 1 && left > 0) {
        acc -= 1;
        left--;
        const p = w.player;
        const R = Math.max(w.viewW, w.viewH) * 0.5 + 14;
        const aa = a + w.rng.spread(0.35);
        w.spawnEnemy(e, p.x + Math.cos(aa) * R, p.y + Math.sin(aa) * R);
      }
      return left > 0;
    });
  },

  /** One elite of a random current-mix enemy (or `enemy`). */
  elite(w, d, ev) {
    const e = ev.enemy ? ENEMIES.get(ev.enemy) : d.randomMixDef(true);
    if (!e) return;
    w.edgePoint(20, w.tmp, true);
    w.spawnEnemy(e, w.tmp.x, w.tmp.y, true);
  },

  /** Boss: 3 s WARNING, then the boss enters from the top. Unregistered bosses are skipped. */
  boss(_w, d, ev) {
    const b = ev.enemy ? BOSSES.get(ev.enemy) : undefined;
    if (!b || !b.boss) return;
    d.warnBoss(b, ev.spawnMul ?? 0.4);
  },
};
