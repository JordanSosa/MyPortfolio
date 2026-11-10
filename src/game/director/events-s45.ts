/**
 * Director event kinds of the Beach Episode and The Final Arc (docs/content/stages.md §5),
 * merged into EVENT_HANDLERS by events.ts (`eventHandlers` export; types only from there):
 *
 *   tideSweep        a 60 px water band crosses the view from a random edge (a foam line
 *                    telegraphs it for 1 s): the hero is slowed 40 % inside, enemies are
 *                    pushed along at 30 px/s. No damage. (`tideBands(w)` for the view)
 *   commercialBreak  letterbox + a "WE'LL BE RIGHT BACK!" eyecatch (view); continuous
 *                    spawning pauses for `duration` s while the enemies on screen keep
 *                    acting; then "AND WE'RE BACK!" and a flood of `count` `enemy` over 4 s
 *   flashback        "PREVIOUSLY ON...": an encircle of `count` enemies from earlier stages
 *                    (puff, gummy_bear, love_letter, crab_kun; equal weights) in sepia with
 *                    base HP 70, chatting from their own speech pools (`isFlashback` for the view)
 *
 * Every spawn goes through w.spawnEnemy; event-time closures only (no per-step allocation).
 */
import { ENEMIES } from "../registry";
import type { EnemyDef } from "../types";
import type { World } from "../world";
import type { Director } from "./director";
import type { TimelineEvent } from "../stage";
import { BX_COMMERCIAL, BX_FLASHBACK, cue, slowZone } from "../enemies/_s45";

type Handler = (w: World, d: Director, ev: TimelineEvent) => void;

// ---------------------------------------------------------------- tideSweep
export const TIDE_HALF = 30;
export const TIDE_TELE = 1;
export const TIDE_SLOW = 0.6;
export const TIDE_PUSH = 30;

export interface TideBand {
  on: boolean;
  /** Origin (the hero's position when it began) and travel direction (axis-aligned unit). */
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  /** Band centre along the direction (px from the origin), start / end of its travel, speed. */
  pos: number;
  from: number;
  to: number;
  speed: number;
  /** Telegraph seconds left (the band waits at `from` as a foam line). */
  tele: number;
}

const TIDES = new WeakMap<World, TideBand[]>();

/** Live / recent tide bands (view). */
export function tideBands(w: World): readonly TideBand[] {
  return TIDES.get(w) ?? NONE;
}
const NONE: readonly TideBand[] = [];

function band(w: World): TideBand {
  let list = TIDES.get(w);
  if (!list) {
    list = [];
    TIDES.set(w, list);
  }
  for (const b of list) if (!b.on) return b;
  const b: TideBand = { on: false, ox: 0, oy: 0, dx: 1, dy: 0, pos: 0, from: 0, to: 0, speed: 40, tele: 0 };
  list.push(b);
  return b;
}

// ---------------------------------------------------------------- commercialBreak
export interface Commercial {
  /** Seconds left of the break (0 = none) and its full length. */
  left: number;
  dur: number;
}
const BREAKS = new WeakMap<World, Commercial>();

/** The current commercial break (view: letterbox + eyecatch). */
export function commercialOf(w: World): Commercial | undefined {
  return BREAKS.get(w);
}

// ---------------------------------------------------------------- flashback
export const FLASHBACK_POOL = ["puff", "gummy_bear", "love_letter", "crab_kun"] as const;
export const FLASHBACK_TINT = 0xdda574;
const FLASHBACK_HP = 70;
const FLASH_UIDS = new WeakMap<World, Set<number>>();

/** Is this enemy (uid) part of a "PREVIOUSLY ON..." flashback (drawn in sepia)? */
export function isFlashback(w: World, uid: number): boolean {
  const s = FLASH_UIDS.get(w);
  return !!s && s.size > 0 && s.has(uid);
}

function flashSet(w: World): Set<number> {
  let s = FLASH_UIDS.get(w);
  if (!s) {
    const set = new Set<number>();
    s = set;
    FLASH_UIDS.set(w, set);
    // forget them as they die (the uid is never reused)
    w.hooks.on("kill", (k) => {
      if (set.size > 0) set.delete(k.enemy.uid);
    });
  }
  return s;
}

export const eventHandlers: Record<string, Handler> = {
  /** A water band sweeps the view (stages.md §5): slow the hero, push enemies along. */
  tideSweep(w, d, ev) {
    const p = w.player;
    const b = band(w);
    const side = w.rng.int(0, 3);
    b.dx = side === 0 ? 1 : side === 1 ? -1 : 0;
    b.dy = side === 2 ? 1 : side === 3 ? -1 : 0;
    const half = b.dx !== 0 ? w.viewW * 0.5 : w.viewH * 0.5;
    b.on = true;
    b.ox = p.x;
    b.oy = p.y;
    b.from = -(half + TIDE_HALF + 8);
    b.to = half + TIDE_HALF + 8;
    b.pos = b.from;
    b.tele = TIDE_TELE;
    const dur = Math.max(1, ev.duration ?? 6);
    b.speed = Math.max(ev.speed ?? 40, (b.to - b.from) / dur);
    w.emit("waveIncoming", { kind: "tide", x: p.x - b.dx * half, y: p.y - b.dy * half, label: ev.label });
    d.addTask((dt) => {
      if (!b.on) return false;
      if (b.tele > 0) {
        b.tele -= dt;
        return true;
      }
      b.pos += b.speed * dt;
      const cx = b.ox + b.dx * b.pos;
      const cy = b.oy + b.dy * b.pos;
      // the hero: slowed inside the band
      const hp = b.dx !== 0 ? p.x - cx : p.y - cy;
      if (Math.abs(hp) < TIDE_HALF) slowZone(w, TIDE_SLOW);
      // enemies inside are carried along
      const items = w.enemies.items;
      const push = TIDE_PUSH * dt;
      for (let i = 0; i < w.enemies.count; i++) {
        const e = items[i];
        if (e.dead || e.def.boss || e.def.prop) continue;
        const o = b.dx !== 0 ? e.x - cx : e.y - cy;
        if (o > -TIDE_HALF && o < TIDE_HALF) {
          e.x += b.dx * push;
          e.y += b.dy * push;
        }
      }
      if (b.pos >= b.to) {
        b.on = false;
        return false;
      }
      return true;
    });
  },

  /** "WE'LL BE RIGHT BACK!": spawning pauses (the screen keeps fighting), then a flood. */
  commercialBreak(w, d, ev) {
    const dur = Math.max(0.5, ev.duration ?? 4);
    let c = BREAKS.get(w);
    if (!c) {
      c = { left: 0, dur: 0 };
      BREAKS.set(w, c);
    }
    const cb = c;
    cb.left = cb.dur = dur;
    d.introT = Math.max(d.introT, dur);
    const p = w.player;
    cue(w, BX_COMMERCIAL, p.x, p.y, 0, 0, dur, null);
    const e = (ev.enemy && ENEMIES.get(ev.enemy)) || d.randomMixDef();
    const total = Math.max(1, ev.count ?? 40);
    let left = total;
    let acc = 0;
    let back = false;
    const rate = total / 4;
    let a = 0;
    d.addTask((dt) => {
      if (!back) {
        cb.left = Math.max(0, cb.left - dt);
        if (cb.left > 0) return true;
        back = true;
        a = w.rng.angle();
        cue(w, BX_COMMERCIAL, p.x, p.y, 0, 0, 0, null);
        w.emit("waveIncoming", { kind: "flood", x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100, label: "AND WE'RE BACK!" });
      }
      if (!e) return false;
      acc += rate * dt;
      while (acc >= 1 && left > 0) {
        acc -= 1;
        left--;
        const R = Math.max(w.viewW, w.viewH) * 0.5 + 14;
        const aa = a + w.rng.spread(0.45);
        w.spawnEnemy(e, p.x + Math.cos(aa) * R, p.y + Math.sin(aa) * R);
      }
      return left > 0;
    });
  },

  /** "PREVIOUSLY ON...": a sepia ring of earlier stages' enemies (base HP 70). */
  flashback(w, _d, ev) {
    const defs: EnemyDef[] = [];
    for (const id of FLASHBACK_POOL) {
      const def = ENEMIES.get(id);
      if (def) defs.push(def);
    }
    if (!defs.length) return;
    const set = flashSet(w);
    const p = w.player;
    const n = Math.max(1, ev.count ?? 40);
    const R = Math.max(w.viewW, w.viewH) * 0.5 + 16;
    const a0 = w.rng.angle();
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const def = defs[w.rng.int(0, defs.length - 1)];
      const e = w.spawnEnemy(def, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.8);
      if (!e) continue;
      // base HP 70 with every multiplier the spawn applied (time, adaptive toughness, twists)
      e.maxHp = e.hp = Math.max(1, Math.round((FLASHBACK_HP * e.maxHp) / Math.max(1, def.hp)));
      set.add(e.uid);
    }
    cue(w, BX_FLASHBACK, p.x, p.y, 0, 0, n, null);
    w.emit("waveIncoming", { kind: "encircle", x: p.x, y: p.y, label: ev.label ?? "PREVIOUSLY ON..." });
  },
};
