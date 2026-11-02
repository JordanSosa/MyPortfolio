/**
 * Pooled damage numbers (bitmap font). Pop 1.6 -> 1 with easeOutBack, rise +
 * slight x drift, fade at the end of 0.6 s. Max ~150 alive; the oldest is recycled.
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
      this.pool.push({ active: false, x: 0, y: 0, vx: 0, rise: 0, t: 0, life: 1, scale: 1, color: 0, wobble: 0, codes: new Uint8Array(MAXC), n: 0, kind: 0, seq: 0 });
  }

  private alloc(): Num {
    // ring buffer: the next slot is the oldest one
    const n = this.pool[this.head];
    this.head = (this.head + 1) % this.pool.length;
    return n;
  }

  /** Spawn a number. Returns nothing; zero allocations. */
  spawn(x: number, y: number, value: number, kind: DamageKind = "normal", color = -1): void {
    if (this.hideAll) return;
    if (!this.enabled && (kind === "normal" || kind === "crit")) return;
    const st = this.styles[kind];
    const d = this.alloc();
    d.active = true;
    d.x = x + fxRng.spread(3);
    d.y = y + fxRng.spread(2);
    d.vx = fxRng.spread(10);
    d.rise = st.rise * (0.85 + fxRng.next() * 0.3);
    d.t = 0;
    d.life = st.life;
    d.scale = st.scale * this.scale;
    d.color = color >= 0 ? color : st.color;
    d.kind = KIND[kind];
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
      if (d.t >= d.life) d.active = false;
    }
  }

  clear(): void {
    for (const d of this.pool) d.active = false;
  }

  draw(): void {
    const text = this.r.text;
    for (let k = 0; k < this.pool.length; k++) {
      // draw oldest first so new numbers are on top
      const d = this.pool[(this.head + k) % this.pool.length];
      if (!d.active) continue;
      const u = d.t / d.life;
      const pop = d.t < 0.2 ? 1.6 + (1 - 1.6) * easeOutBack(d.t / 0.2, 2.2) : 1;
      const s = d.scale * pop;
      const rise = d.rise * (1 - (1 - u) * (1 - u) * (1 - u));
      const x = d.x + d.vx * d.t;
      const y = d.y - rise;
      const alpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      const flash = d.t < 0.06 ? 1 - d.t / 0.06 : 0;
      const rot = d.wobble ? Math.sin(d.t * 26) * 0.12 * (1 - u) : 0;
      text.drawCodes(Layer.Text, d.codes, d.n, x, y, s, d.color, alpha, d.kind === 1 ? Flag.Glow : 0, flash, d.wobble ? 1.2 : 0, d.t, rot);
    }
  }

  get alive(): number {
    let n = 0;
    for (const d of this.pool) if (d.active) n++;
    return n;
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
