/**
 * Authoring helpers for the Season 2 stage art of group s2-stages-b
 * (Beach Episode + The Final Arc). Exports NO sprites.
 *
 * Builds on the world painter (`Cv` in world-util.ts): shapes, shaded balls,
 * selective outlines, halos. The import path below resolves from both
 * src/art/wip/ and src/art/sprites/, so these files move without edits.
 */
import { Cv, hash } from "../sprites/world-util";

export { Cv, hash, spr, bayer, inStar, inHeart, rgba, LIGHT } from "../sprites/world-util";

/** Small seeded RNG (mulberry32) for deterministic layouts. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise that repeats every `period` px (default 16) on a `cells` lattice. 0..1 */
export function tileNoise(x: number, y: number, cells: number, seed: number, period = 16): number {
  const size = period / cells;
  const gx = x / size;
  const gy = y / size;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const v = (i: number, j: number) => hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
  const a = v(ix, iy);
  const b = v(ix + 1, iy);
  const c = v(ix, iy + 1);
  const d = v(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Push the art down so its lowest opaque pixel sits on row h-1 (feet pivot). */
export function ground(c: Cv): Cv {
  let bottom = -1;
  c.each((_x, y, k) => {
    if (k !== ".") bottom = Math.max(bottom, y);
    return null;
  });
  if (bottom < 0) return c;
  return c.shift(0, c.h - 1 - bottom);
}

/** Centre the art horizontally on the canvas (by its opaque bounding box). */
export function centerX(c: Cv): Cv {
  let x0 = c.w;
  let x1 = -1;
  c.each((x, _y, k) => {
    if (k !== ".") {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
    return null;
  });
  if (x1 < 0) return c;
  const want = Math.floor((c.w - (x1 - x0 + 1)) / 2);
  return c.shift(want - x0, 0);
}

/**
 * Place stamps at random free spots strictly inside the tile (1px margin,
 * `gap` px apart from anything that is not one of the `free` keys).
 */
export function scatterStamps(c: Cv, r: () => number, stamps: string[], n: number, free: string, gap = 1, margin = 1): void {
  let placed = 0;
  for (let tries = 0; tries < 600 && placed < n; tries++) {
    const st = Cv.of(stamps[Math.floor(r() * stamps.length)]);
    const x = margin + Math.floor(r() * (c.w - 2 * margin - st.w + 1));
    const y = margin + Math.floor(r() * (c.h - 2 * margin - st.h + 1));
    let ok = true;
    for (let yy = -gap; yy < st.h + gap && ok; yy++)
      for (let xx = -gap; xx < st.w + gap; xx++)
        if (c.inb(x + xx, y + yy) && !free.includes(c.get(x + xx, y + yy))) {
          ok = false;
          break;
        }
    if (!ok) continue;
    c.put(st, x, y);
    placed++;
  }
}

/** Sprinkle single-pixel grain anywhere (edges included: single pixels never make seams). */
export function grain(c: Cv, r: () => number, keys: string, density: number, onto: string): void {
  c.each((_x, _y, k) => {
    if (!onto.includes(k)) return null;
    if (r() < density) return keys[Math.floor(r() * keys.length)];
    return null;
  });
}

/** Bounding box of opaque pixels. */
export function bbox(c: Cv): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = c.w;
  let y0 = c.h;
  let x1 = -1;
  let y1 = -1;
  c.each((x, y, k) => {
    if (k === ".") return null;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
    return null;
  });
  return { x0, y0, x1, y1 };
}

/** Thick-ish line helper: Bresenham with a per-point key function. */
export function lineFn(c: Cv, x0: number, y0: number, x1: number, y1: number, k: (x: number, y: number, t: number) => string | null): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    const key = k(x, y, t);
    if (key) c.set(x, y, key);
  }
}

/** Quadratic bezier point list (rounded, de-duplicated). */
export function bez(p0: [number, number], p1: [number, number], p2: [number, number], steps = 40): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    const q: [number, number] = [Math.round(x), Math.round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  return out;
}

/** Remove "elbow" pixels from a 1px path so diagonals read clean (pixel-perfect lines). */
export function pixelPerfect(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && i < pts.length - 1 && out.length) {
      const a = out[out.length - 1];
      const c = pts[i + 1];
      const b = pts[i];
      if (Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1 && (b[0] === a[0] || b[1] === a[1])) continue;
    }
    out.push(pts[i]);
  }
  return out;
}

/**
 * Layered composition: stamp a fill-only part on its own w x h canvas, give it
 * its own outline, and return it, so stacking parts back-to-front leaves a
 * clean 1px separator line wherever a front part overlaps a back part.
 */
export function part(
  w: number,
  h: number,
  grid: string | Cv,
  x: number,
  y: number,
  o: { flip?: boolean; map?: Record<string, string>; ol?: string | false; sel?: Record<string, string> } = {},
): Cv {
  const c = new Cv(w, h);
  c.put(grid, x, y, { flip: o.flip, map: o.map });
  if (o.ol !== false) {
    if (o.sel) c.selout(o.sel, o.ol ?? "1");
    else c.outline(o.ol ?? "1");
  }
  return c;
}

/** Stack canvases back-to-front onto a new canvas. */
export function stack(w: number, h: number, ...layers: Cv[]): Cv {
  const c = new Cv(w, h);
  for (const l of layers) c.put(l, 0, 0);
  return c;
}

/** Set a list of [x, y, key] pixels. */
export function px(c: Cv, list: ReadonlyArray<readonly [number, number, string]>, dx = 0, dy = 0): Cv {
  for (const [x, y, k] of list) c.set(x + dx, y + dy, k);
  return c;
}

/**
 * Soften interior separator lines: every `from` pixel (default the '1'
 * outline) that does not touch transparency, and whose other neighbours are
 * all in `inside`, becomes `to`. Keeps the silhouette plum while lines between
 * same-material parts turn into a dark shade of that material.
 */
export function soften(c: Cv, inside: string, to: string, from = "1"): Cv {
  const src = c.clone();
  c.each((x, y, k) => {
    if (k !== from) return null;
    const nb = [src.get(x - 1, y), src.get(x + 1, y), src.get(x, y - 1), src.get(x, y + 1)];
    if (!src.inb(x - 1, y) || !src.inb(x + 1, y) || !src.inb(x, y - 1) || !src.inb(x, y + 1)) return null;
    if (nb.includes(".")) return null;
    for (const n of nb) if (n !== from && !inside.includes(n)) return null;
    return to;
  });
  return c;
}
