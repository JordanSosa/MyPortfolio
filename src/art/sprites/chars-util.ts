/**
 * Authoring helpers for the character art (heroes, portraits, enemies, bosses,
 * bullets). Exports NO sprites (the registry only picks up `sprites`/`fonts`).
 *
 * `Pix` is a tiny palette-key canvas: hand-drawn parts (template-literal grids)
 * are stamped onto it in z-order, shapes can be filled procedurally, and the
 * result is serialised back to the GridSprite frame-string format.
 */
import { rows, type GridSprite } from "../format";

/** Problems found while parsing parts (ragged rows etc). Checked by dev scripts. */
export const ART_WARNINGS: string[] = [];

export type Key = string;
export type KeyFn = (x: number, y: number) => Key | null;

export interface PutOpts {
  /** Mirror the part horizontally before placing. */
  flip?: boolean;
  /** Recolour keys while placing. */
  map?: Record<string, string>;
  /** Only paint where the destination is empty. */
  under?: boolean;
  /** Only paint where the destination is already opaque. */
  onlyOver?: boolean;
  /** Outline the part itself with this key before placing (outline may extend 1px outside the part). */
  outline?: Key;
  /** Keys in the part to treat as transparent. */
  skip?: string;
}

export class Pix {
  readonly w: number;
  readonly h: number;
  d: string[];

  constructor(w: number, h: number, fillKey: Key = ".") {
    this.w = w;
    this.h = h;
    this.d = new Array(w * h).fill(fillKey);
  }

  /** Parse a grid (rows trimmed, blank lines dropped). Ragged rows are padded with '.'. */
  static of(art: string, name = "part"): Pix {
    const rs = rows(art);
    const w = Math.max(0, ...rs.map((r) => r.length));
    const p = new Pix(w, rs.length);
    rs.forEach((r, y) => {
      if (r.length !== w) ART_WARNINGS.push(`${name}: row ${y} has ${r.length} chars, expected ${w}`);
      for (let x = 0; x < r.length; x++) p.d[y * w + x] = r[x];
    });
    return p;
  }

  clone(): Pix {
    const p = new Pix(this.w, this.h);
    p.d = this.d.slice();
    return p;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Key {
    return this.inside(x, y) ? this.d[y * this.w + x] : ".";
  }

  set(x: number, y: number, k: Key | null | undefined): this {
    if (k == null) return this;
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = k;
    return this;
  }

  solid(x: number, y: number): boolean {
    return this.get(x, y) !== ".";
  }

  /** Stamp a part (grid string or Pix) with its top-left at (x, y). */
  put(src: string | Pix, x: number, y: number, o: PutOpts = {}): this {
    let p = typeof src === "string" ? Pix.of(src) : src;
    if (o.flip) p = p.flipX();
    let ox = 0;
    if (o.outline) {
      const q = new Pix(p.w + 2, p.h + 2);
      q.put(p, 1, 1);
      q.outline(o.outline);
      p = q;
      ox = -1;
    }
    for (let yy = 0; yy < p.h; yy++)
      for (let xx = 0; xx < p.w; xx++) {
        let k = p.d[yy * p.w + xx];
        if (k === "." || (o.skip && o.skip.includes(k))) continue;
        if (o.map && k in o.map) k = o.map[k];
        const dx = x + xx + ox;
        const dy = y + yy + ox;
        if (!this.inside(dx, dy)) continue;
        const cur = this.d[dy * this.w + dx];
        if (o.under && cur !== ".") continue;
        if (o.onlyOver && cur === ".") continue;
        this.d[dy * this.w + dx] = k;
      }
    return this;
  }

  /** Add a 1px outline of `key` around opaque pixels (in place). corners=true -> 8-neighbour. */
  outline(key: Key = "1", corners = false): this {
    const w = this.w;
    const h = this.h;
    const d = this.d;
    const s = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) s[i] = d[i] !== "." ? 1 : 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (s[i]) continue;
        const l = x > 0;
        const r = x < w - 1;
        const u = y > 0;
        const b = y < h - 1;
        let n = (l && s[i - 1]) || (r && s[i + 1]) || (u && s[i - w]) || (b && s[i + w]);
        if (!n && corners) n = (l && u && s[i - w - 1]) || (r && u && s[i - w + 1]) || (l && b && s[i + w - 1]) || (r && b && s[i + w + 1]);
        if (n) d[i] = key;
      }
    return this;
  }

  flipX(): Pix {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
    return p;
  }

  /** Move everything by (dx, dy). */
  shift(dx: number, dy: number): this {
    const n = new Array(this.w * this.h).fill(".");
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const sx = x - dx;
        const sy = y - dy;
        if (sx >= 0 && sy >= 0 && sx < this.w && sy < this.h) n[y * this.w + x] = this.d[sy * this.w + sx];
      }
    this.d = n;
    return this;
  }

  /** Recolour keys in place. */
  recolor(map: Record<string, string>): this {
    this.d = this.d.map((k) => map[k] ?? k);
    return this;
  }

  /** Apply fn to every pixel; returning null keeps the pixel. */
  each(fn: (x: number, y: number, k: Key) => Key | null | undefined): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const r = fn(x, y, this.d[y * this.w + x]);
        if (r != null) this.d[y * this.w + x] = r;
      }
    return this;
  }

  rect(x: number, y: number, w: number, h: number, k: Key | KeyFn): this {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, typeof k === "function" ? k(xx, yy) : k);
    return this;
  }

  /** Filled ellipse centred at (cx, cy) (may be .5) with radii rx, ry. */
  ellipse(cx: number, cy: number, rx: number, ry: number, k: Key | KeyFn): this {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1.0) this.set(x, y, typeof k === "function" ? k(x, y) : k);
      }
    return this;
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, k: Key): this {
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

  /** Even-odd polygon fill (pixel centres). */
  poly(pts: [number, number][], k: Key | KeyFn): this {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const py = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if (ay <= py === by <= py) continue;
        xs.push(ax + ((py - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++)
          this.set(x, y, typeof k === "function" ? k(x, y) : k);
    }
    return this;
  }

  /** Copy a rectangular region into a new Pix. */
  crop(x: number, y: number, w: number, h: number): Pix {
    const p = new Pix(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) p.d[yy * w + xx] = this.get(x + xx, y + yy);
    return p;
  }

  str(): string {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) out.push(this.d.slice(y * this.w, (y + 1) * this.w).join(""));
    return out.join("\n");
  }
}

/** Build a GridSprite with the manifest pivot convention. */
export function gridSprite(
  id: string,
  w: number,
  h: number,
  frames: (string | Pix)[],
  pivot: "feet" | "center",
  extra: Partial<Pick<GridSprite, "fps" | "pal">> = {},
): GridSprite {
  const fs = frames.map((f) => {
    const p = typeof f === "string" ? Pix.of(f, id) : f;
    if (p.w !== w || p.h !== h) {
      ART_WARNINGS.push(`${id}: frame is ${p.w}x${p.h}, expected ${w}x${h}`);
      const q = new Pix(w, h);
      q.put(p, 0, 0);
      return q.str();
    }
    return p.str();
  });
  return {
    id,
    w,
    h,
    frames: fs,
    ox: w / 2,
    oy: pivot === "feet" ? h - 1 : h / 2,
    ...extra,
  };
}

/** Simple deterministic hash noise 0..1 for dithering/texture. */
export function hash2(x: number, y: number, seed = 0): number {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}

/** 4x4 Bayer threshold 0..1 (ordered dithering). */
export function bayer(x: number, y: number): number {
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  return (m[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

export interface StrandKeys {
  /** main fill */
  base: Key;
  /** shadow side (screen-right of a downward strand, i.e. away from the top-left light) */
  shade?: Key;
  /** lit side */
  light?: Key;
  /** deepest crease along the far edge */
  deep?: Key;
}

/**
 * Tapered thick polyline ("hair lock"). Width goes w0 -> w1 from root to tip.
 * Cel-shaded across its width: lit side / base / shadow / deep crease, where the
 * shadow side is the right-hand side of the travel direction rotated so a strand
 * travelling downward is shaded on its screen-right.
 */
export function strand(
  p: Pix,
  pts: [number, number][],
  w0: number,
  w1: number,
  keys: StrandKeys,
  o: { shadeAt?: number; lightAt?: number; deepAt?: number; gamma?: number } = {},
): Pix {
  const segs: { ax: number; ay: number; dx: number; dy: number; len: number; t0: number }[] = [];
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1e-6;
    segs.push({ ax, ay, dx: bx - ax, dy: by - ay, len, t0: total });
    total += len;
  }
  const maxW = Math.max(w0, w1);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const shadeAt = o.shadeAt ?? 0.35;
  const lightAt = o.lightAt ?? -0.55;
  const deepAt = o.deepAt ?? 0.8;
  const gamma = o.gamma ?? 1;
  const ys = Math.max(0, Math.floor(y0 - maxW));
  const ye = Math.min(p.h - 1, Math.ceil(y1 + maxW));
  const xs = Math.max(0, Math.floor(x0 - maxW));
  const xe = Math.min(p.w - 1, Math.ceil(x1 + maxW));
  const lim2 = (maxW / 2 + 0.5) * (maxW / 2 + 0.5);
  for (let y = ys; y <= ye; y++)
    for (let x = xs; x <= xe; x++) {
      let best2 = Infinity;
      let bt = 0;
      let side = 0;
      for (let si = 0; si < segs.length; si++) {
        const s = segs[si];
        let u = ((x - s.ax) * s.dx + (y - s.ay) * s.dy) / (s.len * s.len);
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const ex = x - (s.ax + s.dx * u);
        const ey = y - (s.ay + s.dy * u);
        const d2 = ex * ex + ey * ey;
        if (d2 < best2) {
          best2 = d2;
          bt = (s.t0 + u * s.len) / total;
          // perpendicular (dy, -dx): for a downward strand this points to screen-right
          side = (ex * s.dy - ey * s.dx) / s.len;
        }
      }
      if (best2 > lim2) continue;
      const best = Math.sqrt(best2);
      const w = w0 + (w1 - w0) * (gamma === 1 ? bt : Math.pow(bt, gamma));
      const r = w / 2;
      if (best > r) continue;
      const n = side / Math.max(0.5, r);
      let k = keys.base;
      if (keys.deep && n > deepAt) k = keys.deep;
      else if (keys.shade && n > shadeAt) k = keys.shade;
      else if (keys.light && n < lightAt) k = keys.light;
      p.set(x, y, k);
    }
  return p;
}

/** Pixels of `p` (non-transparent) as a boolean mask. */
export function maskOf(p: Pix): boolean[] {
  return p.d.map((k) => k !== ".");
}

/**
 * Directionally lit ellipsoid ("ball") fill. `ramp` is dark -> light; light
 * comes from the top-left. Optional specular key on the hottest pixels.
 */
export function ball(
  p: Pix,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ramp: string[],
  o: { lx?: number; ly?: number; spec?: string; specAt?: number; bias?: number; only?: (x: number, y: number) => boolean } = {},
): Pix {
  const lx0 = o.lx ?? -0.55;
  const ly0 = o.ly ?? -0.65;
  const lz0 = 0.55;
  const ln = Math.hypot(lx0, ly0, lz0);
  const lx = lx0 / ln;
  const ly = ly0 / ln;
  const lz = lz0 / ln;
  p.ellipse(cx, cy, rx, ry, (x, y) => {
    if (o.only && !o.only(x, y)) return null;
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const l = nx * lx + ny * ly + nz * lz + (o.bias ?? 0);
    if (o.spec && l > (o.specAt ?? 0.95)) return o.spec;
    const t = Math.max(0, Math.min(0.999, (l + 0.25) / 1.15));
    return ramp[Math.floor(t * ramp.length)];
  });
  return p;
}
