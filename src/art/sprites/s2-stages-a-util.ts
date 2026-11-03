/**
 * Authoring helpers for the Season 2 "s2-stages-a" art (Candy Kingdom +
 * Shoujo Academy). Exports NO sprites (the registry only picks up
 * `sprites` / `fonts`).
 *
 * World art (tiles, deco, props) is painted on the world kit's `Cv`
 * (world-util), actors on the character kit's `Pix` + `ball` (chars-util),
 * so everything matches the base game's construction and lighting
 * (light from the top-left, hue-shifted ramps, dark-plum outline on actors,
 * soft hue outlines on deco).
 */
import { Cv, hash } from "../sprites/world-util";
import { Pix } from "../sprites/chars-util";

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

/** Smooth value noise that repeats every 16 px (a wrapped `cells` x `cells` lattice). 0..1 */
export function tileNoise(x: number, y: number, cells: number, seed: number): number {
  const size = 16 / cells;
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

/**
 * Place stamps at random free spots strictly inside the tile (1px margin, `gap`
 * px apart). A spot is free while every pixel around it is still one of `free`.
 */
export function scatter(c: Cv, r: () => number, stamps: string[], n: number, gap = 1, free = "3"): void {
  let placed = 0;
  for (let tries = 0; tries < 600 && placed < n; tries++) {
    const st = Cv.of(stamps[Math.floor(r() * stamps.length)]);
    const x = 1 + Math.floor(r() * (c.w - 2 - st.w + 1));
    const y = 1 + Math.floor(r() * (c.h - 2 - st.h + 1));
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

/** Push the art down so its lowest opaque pixel sits on row h-1 (feet pivot). */
export function ground<T extends Cv | Pix>(c: T): T {
  let bottom = 0;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.d[y * c.w + x] !== ".") bottom = Math.max(bottom, y);
  c.shift(0, c.h - 1 - bottom);
  return c;
}

/** Horizontally centre the art's opaque bounds in the canvas (keeps rows). */
export function centreX<T extends Cv | Pix>(c: T, bias = 0): T {
  let x0 = c.w;
  let x1 = -1;
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++)
      if (c.d[y * c.w + x] !== ".") {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
  if (x1 < 0) return c;
  const dx = Math.floor((c.w - (x1 - x0 + 1)) / 2) - x0 + bias;
  c.shift(dx, 0);
  return c;
}

/** Selective-outline map shared by the deco: darker tone of each fill colour. */
export const SEL: Record<string, string> = {
  w: "g",
  W: "G",
  g: "2",
  G: "2",
  q: "P",
  p: "Q",
  P: "Q",
  Q: "1",
  r: "R",
  R: "1",
  y: "O",
  z: "Y",
  Y: "O",
  o: "O",
  O: "1",
  u: "U",
  v: "U",
  U: "n",
  n: "1",
  j: "I",
  i: "I",
  I: "2",
  e: "E",
  l: "E",
  m: "E",
  E: "1",
  c: "C",
  a: "C",
  C: "n",
  B: "H",
  F: "H",
  h: "d",
  H: "d",
  d: "1",
  k: "d",
  s: "k",
  b: "P",
};

/** Read a grid part into a Cv (convenience). */
export const cv = (art: string): Cv => Cv.of(art);

/** Count of frames helper. */
export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

export { Cv, Pix, hash };
