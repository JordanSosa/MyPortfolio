/**
 * Authoring helpers for the world / FX / UI art (owner: world).
 * Exports NO sprites (the registry only picks up `sprites` / `fonts`).
 *
 * `Cv` is a palette-key canvas: hand-drawn parts (template-literal grids) are
 * stamped onto it, shapes are filled procedurally (discs, polygons, stars,
 * shaded spheres...), outlines / selective outlines / glow halos are added,
 * and the result is serialised back to the GridSprite frame-string format.
 */
import { rows, type GridSprite } from "../format";

export type Pivot = "center" | "feet";
export type KeyFn = (x: number, y: number) => string | null | undefined;

export interface PutOpts {
  /** Mirror the part horizontally before placing. */
  flip?: boolean;
  /** Recolour keys while placing. */
  map?: Record<string, string>;
  /** Only paint where the destination is empty. */
  under?: boolean;
  /** Only paint where the destination is already opaque. */
  over?: boolean;
  /** Keys in the part to treat as transparent (besides '.'). */
  skip?: string;
}

/** Light direction used by every shaded shape: from the top-left, slightly towards the viewer. */
const LX = -0.55;
const LY = -0.62;
const LZ = 0.56;
const LN = Math.hypot(LX, LY, LZ);
export const LIGHT: readonly [number, number, number] = [LX / LN, LY / LN, LZ / LN];

export class Cv {
  readonly w: number;
  readonly h: number;
  d: string[];

  constructor(w: number, h: number, k = ".") {
    this.w = w;
    this.h = h;
    this.d = new Array<string>(w * h).fill(k);
  }

  /** Parse a grid string (rows trimmed, blank lines dropped). Ragged rows are padded with '.'. */
  static of(art: string): Cv {
    const rs = rows(art);
    const w = Math.max(0, ...rs.map((r) => r.length));
    const c = new Cv(w, rs.length);
    rs.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) c.d[y * w + x] = r[x];
    });
    return c;
  }

  clone(): Cv {
    const c = new Cv(this.w, this.h);
    c.d = this.d.slice();
    return c;
  }

  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): string {
    return this.inb(x, y) ? this.d[y * this.w + x] : ".";
  }

  solid(x: number, y: number): boolean {
    return this.get(x, y) !== ".";
  }

  set(x: number, y: number, k: string | null | undefined): this {
    if (k == null) return this;
    x = Math.round(x);
    y = Math.round(y);
    if (this.inb(x, y)) this.d[y * this.w + x] = k;
    return this;
  }

  /** Set several pixels: pts = [[x,y],...]. */
  pts(list: ReadonlyArray<readonly [number, number]>, k: string): this {
    for (const [x, y] of list) this.set(x, y, k);
    return this;
  }

  /** Stamp a part (grid string or Cv) with its top-left at (x, y). */
  put(src: string | Cv, x: number, y: number, o: PutOpts = {}): this {
    let p = typeof src === "string" ? Cv.of(src) : src;
    if (o.flip) p = p.flipX();
    for (let yy = 0; yy < p.h; yy++)
      for (let xx = 0; xx < p.w; xx++) {
        let k = p.d[yy * p.w + xx];
        if (k === "." || (o.skip && o.skip.includes(k))) continue;
        if (o.map && k in o.map) k = o.map[k];
        const dx = x + xx;
        const dy = y + yy;
        if (!this.inb(dx, dy)) continue;
        const cur = this.d[dy * this.w + dx];
        if (o.under && cur !== ".") continue;
        if (o.over && cur === ".") continue;
        this.d[dy * this.w + dx] = k;
      }
    return this;
  }

  /** Visit every pixel; return a key to replace it (null/undefined keeps it). */
  each(fn: (x: number, y: number, k: string) => string | null | undefined | void): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const r = fn(x, y, this.d[y * this.w + x]);
        if (r != null) this.d[y * this.w + x] = r;
      }
    return this;
  }

  /** Replace keys everywhere. */
  map(m: Record<string, string>): this {
    for (let i = 0; i < this.d.length; i++) {
      const k = this.d[i];
      if (k in m) this.d[i] = m[k];
    }
    return this;
  }

  rect(x: number, y: number, w: number, h: number, k: string | KeyFn): this {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, typeof k === "string" ? k : k(xx, yy));
    return this;
  }

  /** Filled ellipse; pixel (x,y) is inside when ((x-cx)/rx)^2 + ((y-cy)/ry)^2 <= 1. */
  ellipse(cx: number, cy: number, rx: number, ry: number, k: string | KeyFn): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, typeof k === "string" ? k : k(x, y));
      }
    return this;
  }

  disc(cx: number, cy: number, r: number, k: string | KeyFn): this {
    return this.ellipse(cx, cy, r, r, k);
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, k: string): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, k);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Fill a polygon (pixel centres tested with even-odd). */
  poly(p: ReadonlyArray<readonly [number, number]>, k: string | KeyFn): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (inPoly(p, x, y)) this.set(x, y, typeof k === "string" ? k : k(x, y));
    return this;
  }

  /** Fill every pixel where `inside(x,y)` is true. */
  shape(inside: (x: number, y: number) => boolean, k: string | KeyFn): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (inside(x, y)) this.set(x, y, typeof k === "string" ? k : k(x, y));
    return this;
  }

  /**
   * Shaded ellipsoid: ramp is dark -> light. `bias` shifts the lighting
   * (+ = brighter). Optional specular highlight key at the hot spot.
   */
  ball(cx: number, cy: number, rx: number, ry: number, ramp: string, o: { bias?: number; spec?: string; specAt?: number; rim?: string } = {}): this {
    const bias = o.bias ?? 0;
    return this.ellipse(cx, cy, rx, ry, (x, y) => {
      const nx = (x - cx) / (rx + 0.5);
      const ny = (y - cy) / (ry + 0.5);
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const l = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      if (o.spec && l > (o.specAt ?? 0.93)) return o.spec;
      const t = Math.min(0.999, Math.max(0, (l + 0.15 + bias) / 1.15));
      return ramp[Math.floor(t * ramp.length)];
    });
  }

  /** 1px outline of `k` around opaque pixels (in place). diag = 8-neighbour. */
  outline(k = "1", diag = false): this {
    return this.selout({}, k, diag);
  }

  /**
   * Selective outline: each new outline pixel takes the colour mapped from
   * the opaque neighbour it touches (first match in `m`), else `def`.
   * `only` restricts which sides receive outline: e.g. (dx,dy) => dy >= 0.
   */
  selout(m: Record<string, string>, def = "1", diag = false, only?: (x: number, y: number) => boolean): this {
    const w = this.w;
    const h = this.h;
    const src = this.d.slice();
    const sol = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] !== ".";
    const N4 = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const nb = diag ? N8 : N4;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (sol(x, y)) continue;
        if (only && !only(x, y)) continue;
        let hit: string | null = null;
        for (const [dx, dy] of nb)
          if (sol(x + dx, y + dy)) {
            const nk = src[(y + dy) * w + (x + dx)];
            if (nk in m) {
              hit = m[nk];
              break;
            }
            if (hit === null) hit = def;
          }
        if (hit !== null) this.d[y * w + x] = hit;
      }
    return this;
  }

  /** Concentric glow rings in transparent space: keys[0] at distance 1, keys[1] at 2 ... (4-neighbour growth). */
  halo(keys: string[], diagFirst = false): this {
    for (let i = 0; i < keys.length; i++) {
      const before = this.d.slice();
      const w = this.w;
      const sol = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < this.h && before[y * w + x] !== ".";
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < w; x++) {
          if (sol(x, y)) continue;
          const d8 = (diagFirst && i === 0) || i % 2 === 1;
          const n4 = sol(x - 1, y) || sol(x + 1, y) || sol(x, y - 1) || sol(x, y + 1);
          const n8 = n4 || sol(x - 1, y - 1) || sol(x + 1, y - 1) || sol(x - 1, y + 1) || sol(x + 1, y + 1);
          if (d8 ? n8 : n4) this.d[y * w + x] = keys[i];
        }
    }
    return this;
  }

  flipX(): Cv {
    const c = new Cv(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) c.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
    return c;
  }

  flipY(): Cv {
    const c = new Cv(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) c.d[y * this.w + x] = this.d[(this.h - 1 - y) * this.w + x];
    return c;
  }

  /** Shift contents by (dx, dy) (in place, vacated pixels become '.'). */
  shift(dx: number, dy: number): this {
    const src = this.d.slice();
    this.d.fill(".");
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const sx = x - dx;
        const sy = y - dy;
        if (sx >= 0 && sy >= 0 && sx < this.w && sy < this.h) this.d[y * this.w + x] = src[sy * this.w + sx];
      }
    return this;
  }

  /** Nearest-neighbour rotation about (cx, cy) (default: centre). Returns a new canvas of the same size. */
  rotate(a: number, cx = (this.w - 1) / 2, cy = (this.h - 1) / 2): Cv {
    const c = new Cv(this.w, this.h);
    const ca = Math.cos(-a);
    const sa = Math.sin(-a);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const sx = Math.round(cx + dx * ca - dy * sa);
        const sy = Math.round(cy + dx * sa + dy * ca);
        c.d[y * this.w + x] = this.get(sx, sy);
      }
    return c;
  }

  count(k?: string): number {
    let n = 0;
    for (const v of this.d) if (k === undefined ? v !== "." : v === k) n++;
    return n;
  }

  str(): string {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) out.push(this.d.slice(y * this.w, (y + 1) * this.w).join(""));
    return out.join("\n");
  }
}

export function inPoly(p: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Deterministic hash -> [0,1). */
export function hash(x: number, y: number, seed = 0): number {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** 4x4 ordered dither threshold in (0,1). */
export function bayer(x: number, y: number): number {
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  return (m[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/**
 * Radius of a rounded n-point star at angle `a` (0 = pointing up when rot = 0).
 * `round` 0 = sharp, 1 = very chubby.
 */
export function starRadius(a: number, n: number, R: number, r: number, rot = 0, round = 0.4): number {
  const seg = (Math.PI * 2) / n;
  let t = (((a - rot + Math.PI / 2) % seg) + seg) % seg; // 0..seg, 0 at a tip
  t = Math.abs(t / seg - 0.5) * 2; // 1 at tip, 0 between tips
  const s = Math.pow(t, 1 + round * 1.5);
  const k = round * 0.5;
  const mix = s * (1 - k) + (t * t * (3 - 2 * t)) * k;
  return r + (R - r) * mix;
}

/** Inside test for a star centred at (cx, cy). Angle 0 points up. */
export function inStar(x: number, y: number, cx: number, cy: number, n: number, R: number, r: number, rot = 0, round = 0.4): boolean {
  const dx = x - cx;
  const dy = y - cy;
  const a = Math.atan2(dx, -dy);
  return Math.hypot(dx, dy) <= starRadius(a, n, R, r, rot, round);
}

/** Inside test for a classic heart centred at (cx, cy) with half-width s. */
export function inHeart(x: number, y: number, cx: number, cy: number, s: number): boolean {
  const u = (x - cx) / s;
  const v = -(y - cy) / s + 0.15;
  const a = u * u + v * v - 1;
  return a * a * a - u * u * v * v * v <= 0;
}

/**
 * Shaded star: depth from the edge picks rim/body/inner, the lit side
 * (top-left) gets the bright rim; `core` keys a white centre.
 */
export function shadedStar(
  c: Cv,
  cx: number,
  cy: number,
  R: number,
  r: number,
  keys: { rimLit: string; rimDark: string; body: string; inner: string; core: string },
  o: { round?: number; coreR?: number; rot?: number } = {},
): void {
  const round = o.round ?? 0.6;
  const rot = o.rot ?? 0;
  c.shape(
    (x, y) => inStar(x, y, cx, cy, 5, R, r, rot, round),
    (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dx, -dy);
      const depth = starRadius(a, 5, R, r, rot, round) - d;
      if (d < (o.coreR ?? 1.2)) return keys.core;
      if (depth < 1.0) return dx * LIGHT[0] + dy * LIGHT[1] > -0.3 ? keys.rimLit : keys.rimDark;
      if (depth < 2.0) return dx + dy < 0 ? keys.inner : keys.body;
      return keys.inner;
    },
  );
}

/** Build a GridSprite from frames (strings or canvases) with a manifest pivot. */
export function spr(
  id: string,
  w: number,
  h: number,
  frames: Array<string | Cv>,
  pivot: Pivot,
  o: { pal?: Record<string, string>; fps?: number; outline?: string } = {},
): GridSprite {
  const fs = frames.map((f) => (typeof f === "string" ? f : f.str()));
  const s: GridSprite = {
    id,
    w,
    h,
    frames: fs,
    ox: w / 2,
    oy: pivot === "feet" ? h - 1 : h / 2,
  };
  if (o.pal) s.pal = o.pal;
  if (o.fps) s.fps = o.fps;
  if (o.outline) s.outline = o.outline;
  return s;
}

/** Hex helper for semi-transparent palette entries: alpha 0..1 -> '#rrggbbaa'. */
export function rgba(hex: string, a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");
  return hex.slice(0, 7) + v;
}
