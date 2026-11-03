/**
 * Authoring helpers for the Season 2 boss art (owner "s2-bosses"). Exports NO
 * sprites (the registry only picks up `sprites` / `fonts`).
 *
 * Same construction as the base-game bosses (src/art/sprites/bosses.ts): parts
 * are painted on the character kit's `Pix` canvas in z-order, each part on its
 * own layer with a dark-plum `1` outline, round volumes lit from the top-left
 * with `ball`, hair with `strand`.
 */
import { fill } from "../format";
import { Pix, ball, gridSprite, hash2, strand, type StrandKeys } from "./chars-util";

export { Pix, ball, gridSprite, hash2, strand };
export type { StrandKeys };

export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Draw a part on its own layer, outline it, composite it onto `p`. Returns the layer. */
export function layer(p: Pix, draw: (l: Pix) => void, outline: string | null = "1", corners = false): Pix {
  const l = new Pix(p.w, p.h);
  draw(l);
  if (outline) l.outline(outline, corners);
  p.put(l, 0, 0);
  return l;
}

// ---------------------------------------------------------------------------- sparkles
export const SPARK = `
.w.
wzw
.w.
`;
export const SPARK_M = `
..w..
..w..
wwzww
..w..
..w..
`;
export const SPARK_B = `
...w...
...w...
..wzw..
wwzzzww
..wzw..
...w...
...w...
`;
/** Twinkle sparkle of size 0 (dot), 1 (plus), 2 (long cross), 3 (big). */
export function sparkle(p: Pix, x: number, y: number, size: 0 | 1 | 2 | 3): void {
  if (size === 0) p.set(x, y, "w");
  else if (size === 1) p.put(SPARK, x - 1, y - 1);
  else if (size === 2) p.put(SPARK_M, x - 2, y - 2);
  else p.put(SPARK_B, x - 3, y - 3);
}

// ---------------------------------------------------------------------------- tiny 3x5 font
const F3: Record<string, string> = {
  A: ".x.|x.x|xxx|x.x|x.x",
  B: "xx.|x.x|xx.|x.x|xx.",
  C: ".xx|x..|x..|x..|.xx",
  D: "xx.|x.x|x.x|x.x|xx.",
  E: "xxx|x..|xx.|x..|xxx",
  F: "xxx|x..|xx.|x..|x..",
  G: ".xx|x..|x.x|x.x|.xx",
  H: "x.x|x.x|xxx|x.x|x.x",
  I: "x|x|x|x|x",
  K: "x.x|x.x|xx.|x.x|x.x",
  L: "x..|x..|x..|x..|xxx",
  M: "x...x|xx.xx|x.x.x|x...x|x...x",
  N: "x..x|xx.x|x.xx|x..x|x..x",
  O: ".x.|x.x|x.x|x.x|.x.",
  P: "xx.|x.x|xx.|x..|x..",
  R: "xx.|x.x|xx.|x.x|x.x",
  S: ".xx|x..|.x.|..x|xx.",
  T: "xxx|.x.|.x.|.x.|.x.",
  U: "x.x|x.x|x.x|x.x|.x.",
  V: "x.x|x.x|x.x|.x.|.x.",
  W: "x...x|x...x|x.x.x|xx.xx|x...x",
  X: "x.x|x.x|.x.|x.x|x.x",
  Y: "x.x|x.x|.x.|.x.|.x.",
  "!": "x|x|x|.|x",
  "?": "xx.|..x|.x.|...|.x.",
  ".": ".|.|.|.|x",
  "-": "..|..|xx|..|..",
};
/** 3x4 condensed caps (for tight labels). */
const F34: Record<string, string> = {
  A: ".x.|x.x|xxx|x.x",
  C: ".xx|x..|x..|.xx",
  D: "xx.|x.x|x.x|xx.",
  E: "xxx|xx.|x..|xxx",
  I: "x|x|x|x",
  N: "x..x|xx.x|x.xx|x..x",
  O: ".x.|x.x|x.x|.x.",
  R: "xx.|x.x|xx.|x.x",
  S: ".xx|xx.|..x|xx.",
  T: "xxx|.x.|.x.|.x.",
  V: "x.x|x.x|x.x|.x.",
  W: "x...x|x.x.x|x.x.x|.x.x.",
  L: "x..|x..|x..|xxx",
  P: "xx.|x.x|xx.|x..",
  ".": ".|.|.|x",
};

/** Measure text width in pixels (1px spacing). */
export function textWidth(s: string, small = false, spacing = 1): number {
  const f = small ? F34 : F3;
  let w = 0;
  for (const ch of s) {
    if (ch === " ") {
      w += 2;
      continue;
    }
    const g = f[ch];
    if (g) w += g.split("|")[0].length + spacing;
  }
  return Math.max(0, w - spacing);
}

/** Stamp text with key `ink` at (x, y) (top-left). Returns the width. */
export function text(p: Pix, s: string, x: number, y: number, ink: string, small = false, spacing = 1): number {
  const f = small ? F34 : F3;
  let pen = x;
  for (const ch of s) {
    if (ch === " ") {
      pen += 2;
      continue;
    }
    const g = f[ch];
    if (!g) continue;
    const rs = g.split("|");
    rs.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] === "x") p.set(pen + xx, y + yy, ink);
    });
    pen += rs[0].length + spacing;
  }
  return pen - x - spacing;
}

// ---------------------------------------------------------------------------- shapes
/** Rounded rect (corner radius in px per corner) filled with a key or key fn. */
export function rrect(
  p: Pix,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  k: string | ((x: number, y: number) => string | null),
  r: number | { tl?: number; tr?: number; bl?: number; br?: number } = 0,
): Pix {
  const rr = typeof r === "number" ? { tl: r, tr: r, bl: r, br: r } : r;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const cut = (cx: number, cy: number, rad: number | undefined) => {
        if (!rad) return false;
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        return dx < rad && dy < rad && dx + dy >= rad + (rad > 2 ? 1 : 0);
      };
      if (cut(x0, y0, rr.tl) || cut(x1, y0, rr.tr) || cut(x0, y1, rr.bl) || cut(x1, y1, rr.br)) continue;
      p.set(x, y, typeof k === "function" ? k(x, y) : k);
    }
  return p;
}

/** Thick capsule line between two points (radius r) filled with key. */
export function capsule(p: Pix, x0: number, y0: number, x1: number, y1: number, r: number, k: string | ((x: number, y: number) => string | null)): Pix {
  const minX = Math.floor(Math.min(x0, x1) - r - 1);
  const maxX = Math.ceil(Math.max(x0, x1) + r + 1);
  const minY = Math.floor(Math.min(y0, y1) - r - 1);
  const maxY = Math.ceil(Math.max(y0, y1) + r + 1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L2 = dx * dx + dy * dy || 1e-6;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      let u = ((x - x0) * dx + (y - y0) * dy) / L2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = x - (x0 + dx * u);
      const ey = y - (y0 + dy * u);
      if (ex * ex + ey * ey <= r * r) p.set(x, y, typeof k === "function" ? k(x, y) : k);
    }
  return p;
}

/**
 * Bevel-shade every opaque pixel of a flat layer like a thick cookie / slab:
 * pixels whose top-left neighbours are empty get `lit`, bottom-right edges get
 * `shade` (and `deep` on the outermost bottom-right ring), the rest `base`.
 */
export function bevel(
  l: Pix,
  keys: { base: string; lit?: string; shade?: string; deep?: string; spec?: string },
  o: { litW?: number; shadeW?: number; only?: string } = {},
): Pix {
  const src = l.clone();
  const s = (x: number, y: number) => src.get(x, y) !== "." && (!o.only || o.only.includes(src.get(x, y)));
  const litW = o.litW ?? 1;
  const shadeW = o.shadeW ?? 2;
  l.each((x, y, k) => {
    if (k === "." || (o.only && !o.only.includes(k))) return null;
    let out = keys.base;
    if (keys.shade) {
      for (let d = 1; d <= shadeW; d++) {
        if (!s(x + d, y) || !s(x, y + d) || !s(x + d, y + d)) {
          out = d === 1 && keys.deep ? keys.deep : keys.shade;
          break;
        }
      }
    }
    if (out === keys.base && keys.lit) {
      for (let d = 1; d <= litW; d++) {
        if (!s(x - d, y) || !s(x, y - d) || !s(x - d, y - d)) {
          out = keys.lit;
          break;
        }
      }
      if (out === keys.lit && keys.spec && !s(x - 1, y - 1) && !s(x - 1, y) && !s(x, y - 1)) out = keys.spec;
    }
    return out;
  });
  return l;
}

/** Chebyshev distance from each opaque pixel to the nearest transparent pixel (capped). */
export function insetDist(l: Pix, cap = 8): number[] {
  const d = new Array(l.w * l.h).fill(0);
  for (let y = 0; y < l.h; y++)
    for (let x = 0; x < l.w; x++) {
      if (!l.solid(x, y)) continue;
      let r = 1;
      for (; r <= cap; r++) {
        let hit = false;
        for (let k = -r; k <= r && !hit; k++) {
          if (!l.solid(x + k, y - r) || !l.solid(x + k, y + r) || !l.solid(x - r, y + k) || !l.solid(x + r, y + k)) hit = true;
        }
        if (hit) break;
      }
      d[y * l.w + x] = r;
    }
  return d;
}

/** Add `rings.length` alpha glow rings outward around opaque pixels (rings[0] nearest). */
export function halo(p: Pix, rings: string[], corners = true): Pix {
  for (const k of rings) {
    const solid = p.d.map((c) => c !== ".");
    const w = p.w;
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < w; x++) {
        if (solid[y * w + x]) continue;
        let n = false;
        for (let dy = -1; dy <= 1 && !n; dy++)
          for (let dx = -1; dx <= 1 && !n; dx++) {
            if (!dx && !dy) continue;
            if (!corners && dx && dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < w && yy < p.h && solid[yy * w + xx]) n = true;
          }
        if (n) p.set(x, y, k);
      }
  }
  return p;
}

/** Radial bands (bullets): first band whose limit exceeds the field value wins. */
export function bands(w: number, h: number, field: (x: number, y: number) => number, bs: [number, string][]): string {
  return fill(w, h, (x, y) => {
    const v = field(x, y);
    for (const [lim, k] of bs) if (v < lim) return k;
    return ".";
  });
}

/** Alpha glow palette: '+' faint, '*' mid, '=' strong of one hex colour. */
export function glowPal(hex: string, a = [0x38, 0x8c, 0xd0]): Record<string, string> {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return { "+": hex + h(a[0]), "*": hex + h(a[1]), "=": hex + h(a[2]) };
}

/** Anime boss eye (w x h >= 3x4): dark top lid, iris ramp top->bottom, white highlight top-left. */
export function animeEye(
  p: Pix,
  x: number,
  y: number,
  w: number,
  h: number,
  iris: { dark: string; mid: string; light: string; pupil?: string },
  o: { lid?: string; shine?: boolean; lash?: -1 | 0 | 1; lower?: string; round?: string } = {},
): void {
  const lid = o.lid ?? "0";
  for (let xx = 0; xx < w; xx++) p.set(x + xx, y, lid);
  for (let yy = 1; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const t = (yy - 1) / Math.max(1, h - 2);
      let k = t < 0.34 ? iris.dark : t < 0.67 ? iris.mid : iris.light;
      if (iris.pupil && yy >= 1 && yy <= h - 2 && xx >= Math.floor((w - 1) / 2) && xx <= Math.ceil((w - 1) / 2) && h >= 5 && t > 0.2 && t < 0.75) k = iris.pupil;
      p.set(x + xx, y + yy, k);
    }
  if (o.lower) for (let xx = 1; xx < w - 1; xx++) p.set(x + xx, y + h, o.lower);
  if (o.shine !== false) {
    p.set(x, y + 1, "w");
    if (h >= 5 && w >= 4) p.set(x + 1, y + 1, "w").set(x, y + 2, "w");
    if (h >= 5) p.set(x + w - 1, y + h - 2, "w");
  }
  if (o.round) p.set(x, y + h - 1, o.round).set(x + w - 1, y + h - 1, o.round);
  if (o.lash === 1) p.set(x + w, y - 1, lid).set(x + w, y, lid);
  if (o.lash === -1) p.set(x - 1, y - 1, lid).set(x - 1, y, lid);
}

/** Scatter n crumbs/flecks of the given keys inside a box (deterministic). */
export function scatter(p: Pix, x0: number, y0: number, w: number, h: number, n: number, keys: string[], seed: number, under = false): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.floor(hash2(i, 1, seed) * w);
    const y = y0 + Math.floor(hash2(i, 2, seed) * h);
    if (under && p.solid(x, y)) continue;
    p.set(x, y, keys[i % keys.length]);
  }
}
