/**
 * Pooled damage numbers (bitmap font). Pop 1.6 -> 1 with easeOutBack, rise +
 * slight x drift, fade at the end of 0.6 s. Max ~150 alive; the oldest is recycled.
 * A crit landing next to a fresh crit (< 0.15 s old, within 14 px) merges into it
 * (summed value, re-pop) instead of stacking; `aliveCrit` counts live crits for the
 * caller's cap. Enemy numbers near `focus` (the hero) shrink and fade so a wall of
 * numbers never hides the hero, and their glyphs carry Flag.Focus (the renderer's
 * hero focus zone fades them per pixel over her body).
 *
 *   dmg.spawn(x, y, 12)                 // normal (white)
 *   dmg.spawn(x, y, 48, "crit")         // yellow x2, wobble, sparkle, "!"
 *   dmg.spawn(x, y, 7, "player")        // red
 *   dmg.spawn(x, y, 20, "heal")         // green "+20"
 *   dmg.text(x, y, "MISS", C.lavender)  // any short string
 *   dmg.update(time.dt); dmg.draw();
 */
import { C } from "../art/palette";
import { easeOutBack } from "../core/math";
import { fxRng } from "../core/rng";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import type { Particles } from "./particles";
import { P } from "./presets";

export type DamageKind = "normal" | "crit" | "player" | "heal" | "text";

const MAXC = 12;

interface Num {
  active: boolean;
  /** Displayed value (crits merge into it). */
  value: number;
  x: number;
  y: number;
  vx: number;
  rise: number;
  t: number;
  life: number;
  scale: number;
  color: number;
  wobble: number;
  codes: Uint8Array;
  n: number;
  kind: number;
  seq: number;
}

const KIND: Record<DamageKind, number> = { normal: 0, crit: 1, player: 2, heal: 3, text: 4 };
const K_CRIT = 1;
/** Crit merge window: a new crit within MERGE_PX of a crit younger than MERGE_T s adds to it. */
const MERGE_T = 0.15;
const MERGE_PX = 14;
/** Enemy numbers whose centre is within FOCUS_R px of the focus point draw small + faint. */
const FOCUS_R = 26;

export interface DamageStyle {
  color: number;
  scale: number;
  life: number;
  rise: number;
}

export class DamageNumbers {
  /** Master toggle (settings: damage numbers on/off). Player/heal numbers still show when false unless `hideAll`. */
  enabled = true;
  hideAll = false;
  /** Global scale multiplier (e.g. 0.8 on small screens). */
  scale = 1;
  /**
   * Peak-chaos dimmer 0..1 (the feedback bridge sets it from r.post.load each
   * frame): enemy damage numbers get fainter, lose the spawn flash and crits stop
   * blooming, so a wall of numbers never covers the hero or the bullets. Player
   * damage / heal numbers are never dimmed.
   */
  busy = 0;
  /**
   * Hero exclusion zone (world px): set every frame by the feedback bridge. Enemy
   * numbers (normal / crit) whose centre is within FOCUS_R px are drawn at 0.6x and
   * 35 % alpha, so the hero stays readable under a pile of crits.
   */
  focusX = 0;
  focusY = 0;
  focusOn = false;
  /**
   * Called once at the end of draw() (then cleared): the owner of in-world banner
   * texts sets it every frame so those draw on top of the numbers (same layer, later).
   */
  after: (() => void) | null = null;
  readonly styles: Record<DamageKind, DamageStyle> = {
    normal: { color: C.white, scale: 1, life: 0.6, rise: 14 },
    crit: { color: C.yellow, scale: 2, life: 0.75, rise: 18 },
    player: { color: C.red, scale: 1.25, life: 0.7, rise: 16 },
    heal: { color: C.lime, scale: 1.1, life: 0.7, rise: 16 },
    text: { color: C.white, scale: 1, life: 0.8, rise: 12 },
  };
  private pool: Num[] = [];
  private head = 0;
  private seq = 0;

  constructor(
    private readonly r: Renderer,
    private readonly ps: Particles | null = null,
    capacity = 150,
  ) {
    for (let i = 0; i < capacity; i++)
      this.pool.push({ active: false, value: 0, x: 0, y: 0, vx: 0, rise: 0, t: 0, life: 1, scale: 1, color: 0, wobble: 0, codes: new Uint8Array(MAXC), n: 0, kind: 0, seq: 0 });
  }

  /** Live numbers (kept incrementally: read per hit event by the feedback bridge). */
  private live = 0;
  /** Live crit numbers (kept incrementally like `live`). */
  private liveCrit = 0;

  private alloc(): Num {
    // ring buffer: the next slot is the oldest one
    const n = this.pool[this.head];
    this.head = (this.head + 1) % this.pool.length;
    if (!n.active) this.live++;
    else if (n.kind === K_CRIT) this.liveCrit--;
    return n;
  }

  /** A live crit younger than MERGE_T within MERGE_PX of (x, y), or null. */
  private mergeTarget(x: number, y: number): Num | null {
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) {
      const d = pool[i];
      if (!d.active || d.kind !== K_CRIT || d.t >= MERGE_T) continue;
      if (Math.abs(d.x - x) < MERGE_PX && Math.abs(d.y - y) < MERGE_PX) return d;
    }
    return null;
  }

  /** Spawn a number. Returns nothing; zero allocations. */
  spawn(x: number, y: number, value: number, kind: DamageKind = "normal", color = -1): void {
    if (this.hideAll) return;
    if (!this.enabled && (kind === "normal" || kind === "crit")) return;
    const st = this.styles[kind];
    if (kind === "crit") {
      // crits landing on the same spot within a blink sum into one number that re-pops
      const m = this.mergeTarget(x, y);
      if (m) {
        m.value += value;
        m.t = 0;
        let n = writeNumber(m.codes, 0, m.value);
        if (n < MAXC) m.codes[n++] = 33; // '!'
        m.n = n;
        return;
      }
    }
    const d = this.alloc();
    d.active = true;
    d.value = value;
    d.x = x + fxRng.spread(3);
    d.y = y + fxRng.spread(2);
    d.vx = fxRng.spread(10);
    d.rise = st.rise * (0.85 + fxRng.next() * 0.3);
    d.t = 0;
    d.life = st.life;
    d.scale = st.scale * this.scale;
    d.color = color >= 0 ? color : st.color;
    d.kind = KIND[kind];
    if (d.kind === K_CRIT) this.liveCrit++;
    d.wobble = kind === "crit" ? 1 : 0;
    d.seq = ++this.seq;
    let n = 0;
    if (kind === "heal") d.codes[n++] = 43; // '+'
    n = writeNumber(d.codes, n, value);
    if (kind === "crit" && n < MAXC) d.codes[n++] = 33; // '!'
    d.n = n;
    if (kind === "crit" && this.ps) {
      this.ps.emit(P.sparkle, x, y - 4, 3, NaN, C.paleYellow, 1.1, 1.6);
    }
  }

  /** Spawn a short text popup (uppercase ASCII, <= 12 chars). */
  text(x: number, y: number, str: string, color: number = C.white, scale = 1): void {
    if (this.hideAll) return;
    const st = this.styles.text;
    const d = this.alloc();
    d.active = true;
    d.value = 0;
    d.x = x;
    d.y = y;
    d.vx = 0;
    d.rise = st.rise;
    d.t = 0;
    d.life = st.life;
    d.scale = scale * this.scale;
    d.color = color;
    d.kind = KIND.text;
    d.wobble = 0;
    d.seq = ++this.seq;
    const n = Math.min(MAXC, str.length);
    for (let i = 0; i < n; i++) d.codes[i] = str.charCodeAt(i) & 255;
    d.n = n;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (const d of this.pool) {
      if (!d.active) continue;
      d.t += dt;
      if (d.t >= d.life) {
        d.active = false;
        this.live--;
        if (d.kind === K_CRIT) this.liveCrit--;
      }
    }
  }

  clear(): void {
    for (const d of this.pool) d.active = false;
    this.live = 0;
    this.liveCrit = 0;
  }

  draw(): void {
    const text = this.r.text;
    const fx = this.focusX;
    const fy = this.focusY;
    const focus = this.focusOn;
    const fr2 = FOCUS_R * FOCUS_R;
    for (let k = 0; k < this.pool.length; k++) {
      // draw oldest first so new numbers are on top
      const d = this.pool[(this.head + k) % this.pool.length];
      if (!d.active) continue;
      const u = d.t / d.life;
      const pop = d.t < 0.2 ? 1.6 + (1 - 1.6) * easeOutBack(d.t / 0.2, 2.2) : 1;
      // (busy screens: crits shrink toward normal size)
      let s = d.scale * pop * (d.kind === 1 ? 1 - 0.3 * this.busy : 1);
      const rise = d.rise * (1 - (1 - u) * (1 - u) * (1 - u));
      const x = d.x + d.vx * d.t;
      const y = d.y - rise;
      const enemy = d.kind <= 1;
      const dim = enemy ? this.busy : 0;
      let alpha = (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3) * (1 - 0.4 * dim);
      let glow = d.kind === 1 && dim < 0.5 ? Flag.Glow : 0;
      // hero exclusion zone: enemy numbers right over the hero shrink + fade (never a wall over her)
      if (enemy && focus) {
        const dx = x - fx;
        const dy = y - fy;
        if (dx * dx + dy * dy < fr2) {
          s *= 0.6;
          alpha *= 0.35;
          glow = 0;
        }
      }
      const flash = d.t < 0.06 ? (1 - d.t / 0.06) * (1 - dim) : 0;
      const rot = d.wobble ? Math.sin(d.t * 26) * 0.12 * (1 - u) : 0;
      // (and every enemy-number glyph fades per pixel over her body, like the player's fx: SpriteBatch.focus)
      text.drawCodes(Layer.Text, d.codes, d.n, x, y, s, d.color, alpha, glow | (enemy ? Flag.Focus : 0), flash, d.wobble ? 1.2 : 0, d.t, rot);
    }
    const after = this.after;
    if (after) {
      this.after = null;
      after();
    }
  }

  get alive(): number {
    return this.live;
  }

  /** Live crit numbers (the feedback bridge caps them). */
  get aliveCrit(): number {
    return this.liveCrit;
  }
}

/** Write a compact integer into codes (12345 -> "12345", 123456 -> "123K", 1.2M). Returns new length. */
function writeNumber(codes: Uint8Array, n: number, value: number): number {
  let v = Math.max(0, Math.round(value));
  let suffix = 0;
  if (v >= 10_000_000) {
    v = Math.round(v / 1_000_000);
    suffix = 77; // M
  } else if (v >= 100_000) {
    v = Math.round(v / 1000);
    suffix = 75; // K
  }
  const start = n;
  if (v === 0) codes[n++] = 48;
  while (v > 0 && n < MAXC - 2) {
    codes[n++] = 48 + (v % 10);
    v = Math.floor(v / 10);
  }
  // reverse the digits
  for (let i = start, j = n - 1; i < j; i++, j--) {
    const t = codes[i];
    codes[i] = codes[j];
    codes[j] = t;
  }
  if (suffix) codes[n++] = suffix;
  return n;
}
