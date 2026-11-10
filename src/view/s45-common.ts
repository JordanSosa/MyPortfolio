/**
 * Shared view kit of the Beach Episode / The Final Arc fx (beach-fx.ts,
 * finale-fx.ts): fixed-size timed-visual rings (no per-frame allocation),
 * boss-line captions (death lines and quips of a speaker that is already
 * gone: the shared speech.ts bubbles), satire text pops that keep clear of
 * the hero, and the bind options both files take from Feedback.
 */
import { C } from "../art/palette";
import type { SfxId } from "../audio";
import type { World } from "../game/world";
import { bossHeadroom } from "../game/bosses/_entrance";
import type { FeedbackHooks } from "./feedback";
import type { Speech } from "./speech";
import type { WorldTexts } from "./texts";

export interface S45BindOpts {
  sfx(id: SfxId, vol?: number, pitch?: number, x?: number): void;
  haptic(ms: number): void;
  sound: boolean;
  calm: boolean;
  hooks?: FeedbackHooks;
}

/** One timed visual (position, second point, radius / scale, variant, age, life; life 0 = free). */
export interface Tick {
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  n: number;
  t: number;
  life: number;
}

export function ticks(n: number): Tick[] {
  const out: Tick[] = [];
  for (let i = 0; i < n; i++) out.push({ x: 0, y: 0, x2: 0, y2: 0, r: 0, n: 0, t: 0, life: 0 });
  return out;
}

/** Start a tick in the first free slot (or the oldest). Returns it. */
export function tick(list: Tick[], x: number, y: number, x2: number, y2: number, r: number, n: number, life: number): Tick {
  let best = list[0];
  for (const t of list) {
    if (t.life <= 0) {
      best = t;
      break;
    }
    if (t.t / t.life > best.t / best.life) best = t;
  }
  best.x = x;
  best.y = y;
  best.x2 = x2;
  best.y2 = y2;
  best.r = r;
  best.n = n;
  best.t = 0;
  best.life = life;
  return best;
}

/** Advance a tick by dt; returns its 0..1 progress, or -1 when it is free / just ended. */
export function step(t: Tick, dt: number): number {
  if (t.life <= 0) return -1;
  t.t += dt;
  if (t.t >= t.life) {
    t.life = 0;
    return -1;
  }
  return t.t / t.life;
}

/** Keep a pop's anchor at least `clear` px from the hero's body (satire.md §5: pops never cover the hero). */
export function clearOfHero(w: World, x: number, y: number, clear: number, out: { x: number; y: number }): void {
  const p = w.player;
  const hx = p.x;
  const hy = p.y - 10;
  const dx = x - hx;
  const dy = y - hy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= clear) {
    out.x = x;
    out.y = y;
    return;
  }
  if (d < 1) {
    out.x = hx;
    out.y = hy - clear;
    return;
  }
  out.x = hx + (dx / d) * clear;
  out.y = hy + (dy / d) * clear;
}

const pt = { x: 0, y: 0 };

/**
 * A satire text pop ("TAMAYA!", "HUG!", "CUT TO:"): bouncy world text that never lands on the hero, and
 * never under the top HUD (timer / coins / boss bar: the speech.ts bubbles' headroom rule).
 */
export function popText(w: World, texts: WorldTexts, s: string, x: number, y: number, color: number, scale = 1.6, life = 0.8): void {
  if (w.ult?.phase === "cutin") return;
  clearOfHero(w, x, y, 34, pt);
  const top = w.player.y - 8 - w.viewH * 0.5 + bossHeadroom(w.viewH) * 0.85 + 6;
  texts.add(s, pt.x, Math.max(pt.y, top), { color, scale, life, rise: 10, wobble: 0.6 });
}

// ---------------------------------------------------------------- caption bubbles (boss lines)
/**
 * Speech-bubble captions for lines whose speaker is gone (boss death lines, the crab's "...♡"):
 * a thin adapter over the SHARED bubble set (speech.ts `Speech.sayAt`), so the stage 4 / 5 lines
 * share the satire.md §5 rules (3 bubbles on screen, clear of the hero, out of the touch buttons'
 * bottom third) with every other stage's bubbles instead of drawing a second, parallel set.
 */
export class Captions {
  constructor(private readonly speech: Speech) {}

  clear(): void {
    this.speech.clearFree();
  }

  show(text: string, x: number, y: number, life = 3, ink: number = C.outline): void {
    this.speech.sayAt(x, y, text, life, ink);
  }
}
