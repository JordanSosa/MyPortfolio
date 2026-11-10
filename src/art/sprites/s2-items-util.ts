/**
 * Authoring helpers for the Season 2 "s2-items" art (weapon fx, pops, 16x16
 * icons, relic / twist icons, hub / gacha / board UI). Exports NO sprites (the
 * registry only picks up `sprites` / `fonts`).
 *
 * Built on the world kit's `Cv` (world-util) so icons share the base game's
 * construction: one bold silhouette, auto plum outline (1-px margin kept),
 * 2-3 tone shading lit from the top-left, one white glint.
 */
import { Cv, LIGHT, bayer, hash, inHeart, inPoly, inStar, rgba, shadedStar, spr, starRadius } from "../sprites/world-util";

export { Cv, LIGHT, bayer, hash, inHeart, inPoly, inStar, rgba, shadedStar, spr, starRadius };

/** Semi-transparent glow keys shared by the weapon / fx / UI art (merge into a sprite's `pal`). */
export const GLOW: Record<string, string> = {
  "+": rgba("#ff7ab8", 0.45), // pink glow
  "-": rgba("#ff7ab8", 0.2), // faint pink
  "=": rgba("#ffb8dc", 0.7), // pale pink 70 %
  "~": rgba("#5aa8ff", 0.4), // blue glow
  "^": rgba("#4fe6df", 0.5), // cyan glow
  "%": rgba("#ffffff", 0.55), // white 55 %
  "@": rgba("#ffffff", 0.25), // white 25 %
  "&": rgba("#ffe14d", 0.45), // yellow glow
  "*": rgba("#ff9a3d", 0.45), // orange glow
  $: rgba("#b47cff", 0.45), // violet glow
  ";": rgba("#b47cff", 0.2), // faint violet
  ":": rgba("#fff7b0", 0.3), // faint pale yellow
  "!": rgba("#140c22", 0.35), // soft dark (decal shadow)
  "?": rgba("#e0a020", 0.6), // amber glass
};

// ---------------------------------------------------------------------------- 16x16 icons

/** Blank 16x16 icon canvas. */
export const I16 = (): Cv => new Cv(16, 16);

/** Icon canvas with `art` stamped at (x, y). */
export function icon(art: string, x = 1, y = 1): Cv {
  return I16().put(art, x, y);
}

/** Small 4-point sparkle (no outline) for accents. */
export function sparkle(c: Cv, x: number, y: number, core = "w", arm = "z", under = false): Cv {
  const s = (xx: number, yy: number, k: string) => {
    if (!under || c.get(xx, yy) === ".") c.set(xx, yy, k);
  };
  s(x, y, core);
  s(x - 1, y, arm);
  s(x + 1, y, arm);
  s(x, y - 1, arm);
  s(x, y + 1, arm);
  return c;
}

/** Gold twinkle stamped on a corner of evolution icons (matches the base game's evolutions). */
export const TWINKLE = `
..O..
.OzO.
OzwzO
.OzO.
..O..`;
export function twinkle(c: Cv, corner: "tr" | "tl" | "br" | "bl" = "tr"): Cv {
  const x = corner === "tr" || corner === "br" ? 11 : 0;
  const y = corner === "tr" || corner === "tl" ? 0 : 11;
  return c.put(TWINKLE, x, y);
}

export type Rarity = "N" | "R" | "SR" | "SSR" | "UR" | "LR" | "MYTHIC";

/**
 * Relic rarity glint in the top-right corner (relics.md): a 1-px glint at
 * (15,0) in the rarity colour; UR / LR / MYTHIC get two extra corner pixels
 * (rainbow, crimson-gold, RGB split) so they read as "more".
 */
export function rarityGlint(c: Cv, r: Rarity): Cv {
  const one: Record<string, string> = { N: "g", R: "u", SR: "i", SSR: "y" };
  if (one[r]) return c.set(15, 0, one[r]);
  if (r === "UR") return c.set(15, 0, "y").set(14, 0, "p").set(15, 1, "c");
  if (r === "LR") return c.set(15, 0, "y").set(14, 0, "r").set(15, 1, "R");
  return c.set(15, 0, "w").set(14, 0, "c").set(15, 1, "p");
}

// ---------------------------------------------------------------------------- micro lettering

/** 3x5 micro font (x = ink). A few glyphs are narrower / wider. */
const MICRO_SRC: Record<string, string[]> = {
  A: [".x.", "x.x", "xxx", "x.x", "x.x"],
  B: ["xx.", "x.x", "xx.", "x.x", "xx."],
  C: [".xx", "x..", "x..", "x..", ".xx"],
  D: ["xx.", "x.x", "x.x", "x.x", "xx."],
  E: ["xxx", "x..", "xx.", "x..", "xxx"],
  F: ["xxx", "x..", "xx.", "x..", "x.."],
  G: [".xx", "x..", "x.x", "x.x", ".xx"],
  H: ["x.x", "x.x", "xxx", "x.x", "x.x"],
  I: ["xxx", ".x.", ".x.", ".x.", "xxx"],
  J: ["..x", "..x", "..x", "x.x", ".x."],
  K: ["x.x", "x.x", "xx.", "x.x", "x.x"],
  L: ["x..", "x..", "x..", "x..", "xxx"],
  M: ["x.x", "xxx", "xxx", "x.x", "x.x"],
  N: ["xx.", "x.x", "x.x", "x.x", "x.x"],
  O: [".x.", "x.x", "x.x", "x.x", ".x."],
  P: ["xx.", "x.x", "xx.", "x..", "x.."],
  Q: [".x.", "x.x", "x.x", "xx.", ".xx"],
  R: ["xx.", "x.x", "xx.", "x.x", "x.x"],
  S: [".xx", "x..", ".x.", "..x", "xx."],
  T: ["xxx", ".x.", ".x.", ".x.", ".x."],
  U: ["x.x", "x.x", "x.x", "x.x", "xxx"],
  V: ["x.x", "x.x", "x.x", "x.x", ".x."],
  W: ["x.x", "x.x", "xxx", "xxx", "x.x"],
  X: ["x.x", "x.x", ".x.", "x.x", "x.x"],
  Y: ["x.x", "x.x", ".x.", ".x.", ".x."],
  Z: ["xxx", "..x", ".x.", "x..", "xxx"],
  "0": ["xxx", "x.x", "x.x", "x.x", "xxx"],
  "1": [".x", "xx", ".x", ".x", ".x"],
  "2": ["xx.", "..x", ".x.", "x..", "xxx"],
  "3": ["xx.", "..x", ".x.", "..x", "xx."],
  "4": ["x.x", "x.x", "xxx", "..x", "..x"],
  "5": ["xxx", "x..", "xx.", "..x", "xx."],
  "6": [".xx", "x..", "xxx", "x.x", "xxx"],
  "7": ["xxx", "..x", ".x.", ".x.", ".x."],
  "8": ["xxx", "x.x", "xxx", "x.x", "xxx"],
  "9": ["xxx", "x.x", "xxx", "..x", "xx."],
  "!": ["x", "x", "x", ".", "x"],
  "?": ["xx.", "..x", ".x.", "...", ".x."],
  ".": [".", ".", ".", ".", "x"],
  ":": [".", "x", ".", "x", "."],
  "-": ["..", "..", "xx", "..", ".."],
  "+": ["...", ".x.", "xxx", ".x.", "..."],
  "/": ["..x", "..x", ".x.", "x..", "x.."],
  "'": ["x", "x", ".", ".", "."],
  "*": ["...", ".x.", "xxx", ".x.", "..."],
  "<": [".....", "xx.xx", "xxxxx", ".xxx.", "..x.."], // heart
  " ": ["..", "..", "..", "..", ".."],
};

export function microWidth(s: string, gap = 1): number {
  let w = 0;
  for (const ch of s) w += (MICRO_SRC[ch] ?? MICRO_SRC[" "])[0].length + gap;
  return Math.max(0, w - gap);
}

/** Draw `s` in the micro font with its top-left at (x, y). Returns the pen x after the text. */
export function micro(c: Cv, s: string, x: number, y: number, k: string, gap = 1): number {
  let pen = x;
  for (const ch of s) {
    const g = MICRO_SRC[ch] ?? MICRO_SRC[" "];
    for (let yy = 0; yy < g.length; yy++) for (let xx = 0; xx < g[yy].length; xx++) if (g[yy][xx] === "x") c.set(pen + xx, y + yy, k);
    pen += g[0].length + gap;
  }
  return pen;
}

// ---------------------------------------------------------------------------- shapes

/** Shaded sphere straight onto a Cv (ramp dark -> light) with an optional specular key. */
export function orb(c: Cv, cx: number, cy: number, r: number, ramp: string, spec?: string, bias = 0): Cv {
  return c.ball(cx, cy, r, r, ramp, { spec, bias, specAt: 0.9 });
}

/** Ring band between radii r0..r1 (pixel centres) with a per-pixel key function. */
export function ring(c: Cv, cx: number, cy: number, r0: number, r1: number, k: string | ((x: number, y: number, a: number, d: number) => string | null)): Cv {
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r0 || d > r1) continue;
      const v = typeof k === "string" ? k : k(x, y, Math.atan2(y - cy, x - cx), d);
      if (v) c.set(x, y, v);
    }
  return c;
}

/** Fill a 5-point star using shadedStar with gold keys. */
export function goldStar(c: Cv, cx: number, cy: number, R: number, r: number, o: { round?: number; coreR?: number; rot?: number } = {}): Cv {
  shadedStar(c, cx, cy, R, r, { rimLit: "z", rimDark: "Y", body: "y", inner: "y", core: "z" }, { coreR: 0, ...o });
  return c;
}

/** Recolour the canvas through a key map (returns a clone). */
export function tint(c: Cv, m: Record<string, string>): Cv {
  return c.clone().map(m);
}
