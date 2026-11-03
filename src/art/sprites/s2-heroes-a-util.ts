/**
 * Shared authoring kit for the Season 2 "s2-heroes-a" cast (Kuro, Pudding, Aoi,
 * Akane). Exports NO sprites (the registry only picks up `sprites`/`fonts`).
 *
 * It mirrors the construction of the base cast exactly so the new heroes read
 * as the same show:
 *  - heroes: the layered part pipeline + shared pose table of heroes.ts
 *    (back layer -> legs -> body -> head + face patch -> front layer), same
 *    timing, bob, lean and leg poses, same 24x24 feet pivot.
 *  - portraits: the 3/4 face construction of portraits.ts (shared face polygon,
 *    big glossy anime eyes, strand-painted hair with a cast shadow and a glossy
 *    shine band, dark-plum outline), plus a few extra toys (heart highlights,
 *    triangle eyes, speed lines, hand-lettering) for the over-the-top OC look.
 */
import { Pix, gridSprite, strand, type StrandKeys } from "../sprites/chars-util";
import type { GridSprite, SpriteDef } from "../format";

export { Pix, gridSprite, strand };
export type { StrandKeys, GridSprite, SpriteDef };

// ============================================================================ hero sprite kit

/** Shift each row of a part by off(y) pixels. Output is 2px wider on each side (place at x-2). */
export function wave(part: string | Pix, off: (y: number) => number): Pix {
  const p = typeof part === "string" ? Pix.of(part, "wave") : part;
  const out = new Pix(p.w + 4, p.h);
  for (let y = 0; y < p.h; y++) {
    const o = Math.round(off(y));
    for (let x = 0; x < p.w; x++) {
      const k = p.get(x, y);
      if (k !== ".") out.set(x + 2 + o, y, k);
    }
  }
  return out;
}

/** Bend a part: rows >= y0 shift by dx, rows >= y1 by dx2. Output is 2px wider each side. */
export function bend(part: string | Pix, y0: number, dx: number, y1 = 999, dx2 = dx): Pix {
  return wave(part, (y) => (y >= y1 ? dx2 : y >= y0 ? dx : 0));
}

/** Build a part from shapes, then outline it. */
export function outlined(w: number, h: number, draw: (p: Pix) => void, key = "1"): Pix {
  const p = new Pix(w, h);
  draw(p);
  return p.outline(key);
}

/**
 * Leg poses: fill-only 9x3 grids (rows y20..y22) that get an automatic outline.
 * Keys: N = near leg, n = far leg, S/s = near/far lower leg (socks),
 * F/f = near shoe light/dark, G/g = far shoe light/dark. Same poses as heroes.ts.
 */
export const LEGS_IDLE = `
..nn.NN..
..ss.SS..
..gG.Ff..
`;
export const LEGS_RUN = [
  `
..nnNN...
.ss...SS.
gG.....Ff
`,
  `
...nNN...
.ss..SS..
Gg...Ff..
`,
  `
...NNn...
...SSs...
...Ffg...
`,
  `
..NNnn...
.SS...ss.
Ff.....gG
`,
  `
...Nnn...
.SS..ss..
fF...gG..
`,
  `
...nnN...
...ssS...
...gGf...
`,
];
export const LEGS_HURT = `
.NN..nn..
.SS...ss.
Ff.....gG
`;
export const LEGS_CAST = `
.nn...NN.
.ss...SS.
.gG...Ff.
`;

export interface LegPal {
  N: string;
  n: string;
  S: string;
  s: string;
  F: string;
  f: string;
  G: string;
  g: string;
}

export function legs(art: string, pal: LegPal): Pix {
  const p = Pix.of(art, "legs").recolor(pal as unknown as Record<string, string>);
  const q = new Pix(p.w + 2, p.h + 2);
  q.put(p, 1, 1).outline("1");
  for (let x = 0; x < q.w; x++) q.set(x, 0, "."); // the skirt/hem covers the hips
  return q;
}

export type Anim = "idle" | "run" | "hurt" | "cast";
export type FaceKind = "blink" | "hurt" | "cast";
export interface Pose {
  anim: Anim;
  i: number;
  bob: number;
  lean: number;
  legs: string;
  face?: FaceKind;
}
export interface Ctx {
  /** head top-left */
  hx: number;
  hy: number;
  /** body block left x (12-wide block) and upper-body dy */
  bx: number;
  by: number;
}

const RUN_BOB = [1, 0, -1, 1, 0, -1];
export const POSES: Record<Anim, Pose[]> = {
  idle: [
    { anim: "idle", i: 0, bob: 0, lean: 0, legs: LEGS_IDLE },
    { anim: "idle", i: 1, bob: 1, lean: 0, legs: LEGS_IDLE },
    { anim: "idle", i: 2, bob: 1, lean: 0, legs: LEGS_IDLE },
    { anim: "idle", i: 3, bob: 0, lean: 0, legs: LEGS_IDLE, face: "blink" },
  ],
  run: LEGS_RUN.map((l, i) => ({ anim: "run" as Anim, i, bob: RUN_BOB[i], lean: 1, legs: l })),
  hurt: [{ anim: "hurt", i: 0, bob: 0, lean: -1, legs: LEGS_HURT, face: "hurt" }],
  cast: [
    { anim: "cast", i: 0, bob: 0, lean: -1, legs: LEGS_CAST, face: "cast" },
    { anim: "cast", i: 1, bob: -1, lean: -1, legs: LEGS_CAST, face: "cast" },
  ],
};

export interface HeroDef {
  id: string;
  head: string;
  faces: Partial<Record<FaceKind, string>>;
  legPal: LegPal;
  /** head top-left at bob 0 / lean 0 */
  headX?: number;
  headY?: number;
  /** clamp for upper-body bob */
  minBob?: number;
  /** Optional per-pose head override (e.g. looking away). */
  headFor?(p: Pose): string | null;
  /** Optional per-pose face override (painted over the head). */
  faceFor?(p: Pose): string | null;
  /** Replace the default human legs (e.g. a mech). */
  drawLegs?(c: Pix, p: Pose, k: Ctx): void;
  back(c: Pix, p: Pose, k: Ctx): void;
  body(c: Pix, p: Pose, k: Ctx): void;
  front(c: Pix, p: Pose, k: Ctx): void;
}

export function buildFrame(h: HeroDef, p: Pose): Pix {
  const c = new Pix(24, 24);
  const bob = Math.max(h.minBob ?? -9, p.bob);
  const k: Ctx = { hx: (h.headX ?? 5) + p.lean, hy: (h.headY ?? 1) + bob, bx: 6 + Math.round(p.lean / 2), by: bob };
  h.back(c, p, k);
  if (h.drawLegs) h.drawLegs(c, p, k);
  else c.put(legs(p.legs, h.legPal), 7, 19);
  h.body(c, p, k);
  const head = Pix.of(h.headFor?.(p) ?? h.head, h.id + " head");
  const face = h.faceFor?.(p) ?? (p.face ? h.faces[p.face] : null);
  if (face) head.put(face, 0, 0);
  c.put(head, k.hx, k.hy);
  h.front(c, p, k);
  return c;
}

export function heroSprites(h: HeroDef, poses: Record<Anim, Pose[]> = POSES, pal?: Record<string, string>): SpriteDef[] {
  const fps: Record<Anim, number> = { idle: 6, run: 12, hurt: 8, cast: 8 };
  return (["idle", "run", "hurt", "cast"] as Anim[]).map((a) =>
    gridSprite(
      `${h.id}_${a}`,
      24,
      24,
      poses[a].map((p) => buildFrame(h, p)),
      "feet",
      pal ? { fps: fps[a], pal } : { fps: fps[a] },
    ),
  );
}

// shared small props (same as heroes.ts)
export const SPARKLE = `
..w..
..w..
wwzww
..w..
..w..
`;
export const SPARK_S = `
.z.
zwz
.z.
`;
/** Raised front arm (sleeve colour key `q`) - top-right is the hand. */
export const ARM_UP = `
..1s1
.1s1.
1q1..
`;

// ============================================================================ portrait kit

/** Near (image-left) eye, outer corner on the left. Keys D/M/L iris dark/mid/light, K pupil. */
export const EYE_NEAR = `
.....000000.
...00000000.
..0000000000
.00DDDDDDDD0
00WDDDDDDDDW
0.WDwwwDDDDW
..WDwwwKKMDW
..WDMwKKKMDW
..WMMKKKKMMW
..WMMMKKMMLW
..WMLMMMMLLW
..WDLwLLLaLW
...WLLLLLLW.
....kkkkkk..
`;
/** Far (image-right) eye, foreshortened, outer corner on the right. */
export const EYE_FAR = `
0000000...
000000000.
0000000000
0DDDDDDD00
WDDDDDDDW0
WDwwDDDDW.
WDwwKKMDW.
WDMKKKKMW.
WMMKKKKMW.
WMMMKKMLW.
WMLMMMLLW.
WDLwLaLLW.
.WLLLLLW..
..kkkkk...
`;
/** Happy closed eye (^^), 10x14. '.' keeps the skin underneath. */
export const EYE_ARC = `
..........
..........
..........
..........
..........
..........
...0000...
.00....00.
0........0
..........
..........
..........
..........
..........
`;

export interface Iris {
  D: string;
  M: string;
  L: string;
  K: string;
}

/** Lower the upper lid by drop(x) rows per column (half-lidded / fierce slanted lids). */
export function lidShape(tpl: string, drop: (x: number, w: number) => number): string {
  const p = Pix.of(tpl, "lid");
  const out = p.clone();
  for (let x = 0; x < p.w; x++) {
    const d = Math.max(0, Math.round(drop(x, p.w)));
    if (!d) continue;
    for (let y = 0; y < p.h; y++) {
      const k = p.get(x, y);
      if (k === ".") continue;
      if (y < d) out.set(x, y, "s");
      else if (y < d + 3) {
        const src = p.get(x, y - d);
        out.set(x, y, src === "." ? "s" : src === "0" ? "0" : k);
      }
    }
    if (p.get(x, d + 2) !== ".") out.set(x, d + 2, "0");
  }
  return out.str();
}
export const lidded = (tpl: string, n: number) => lidShape(tpl, () => n);
/** Fierce: the lid slopes down toward the inner corner (near eye: right side, far eye: left side). */
export const fierce = (tpl: string, near: boolean, n = 3) =>
  lidShape(tpl, (x, w) => (near ? (x / (w - 1)) * n : (1 - x / (w - 1)) * n) - 0.3);

/** Star-shaped sparkle highlights inside the iris (excited eyes). */
export function sparkly(e: Pix): void {
  e.each((_x, _y, k) => (k === "w" ? "L" : null));
  const hl = (x: number, y: number) => {
    if (e.get(x, y) !== "." && e.get(x, y) !== "0" && e.get(x, y) !== "W") e.set(x, y, "w");
  };
  const star = (cx: number, cy: number) => {
    hl(cx, cy);
    hl(cx - 1, cy);
    hl(cx + 1, cy);
    hl(cx, cy - 1);
    hl(cx, cy + 1);
  };
  star(Math.floor(e.w * 0.4), 6);
  hl(Math.floor(e.w * 0.65), 10);
}

/** Heart-shaped highlight (3x3-ish) inside the iris, replacing the round shine. */
export function heartShine(e: Pix): void {
  e.each((_x, _y, k) => (k === "w" ? "L" : null));
  const cx = Math.floor(e.w * 0.38);
  const hl = (x: number, y: number) => {
    const k = e.get(x, y);
    if (k !== "." && k !== "0" && k !== "W") e.set(x, y, "w");
  };
  // heart: two lobes + point
  hl(cx - 1, 5);
  hl(cx + 1, 5);
  hl(cx - 1, 6);
  hl(cx, 6);
  hl(cx + 1, 6);
  hl(cx, 7);
  hl(Math.floor(e.w * 0.7), 10);
}

export function eye(p: Pix, tpl: string, x: number, y: number, iris: Iris, extra?: (e: Pix) => void): void {
  const e = Pix.of(tpl, "eye");
  if (extra) extra(e);
  e.recolor(iris as unknown as Record<string, string>);
  p.put(e, x, y);
}

/** Draw a layer with `draw`, outline it, and composite it onto `p`. Returns the layer. */
export function layer(p: Pix, draw: (l: Pix) => void, outline: string | null = "1"): Pix {
  const l = new Pix(p.w, p.h);
  draw(l);
  if (outline) l.outline(outline);
  p.put(l, 0, 0);
  return l;
}

/** Skin pixels just below/right of hair get the hair's cast shadow (light from top-left). */
export function castShadow(p: Pix, hair: Pix, depth = 2): void {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const k = p.get(x, y);
      if (k !== "s" && k !== "t" && k !== "b") continue;
      let hit = false;
      for (let d = 1; d <= depth && !hit; d++) if (hair.solid(x - 1, y - d) || hair.solid(x, y - d)) hit = true;
      if (hit) p.set(x, y, k === "b" ? "P" : "k");
    }
}

/** Anime blush hatching: short diagonal strokes. */
export function blush(p: Pix, x: number, y: number, n: number, key = "b"): void {
  for (let i = 0; i < n; i++) {
    p.set(x + i * 2, y + 1, key);
    p.set(x + i * 2 + 1, y, key);
  }
}

/**
 * Glossy anime hair shine: a 2px arc band across the crown with short
 * downward zig-zag spikes, plus a hard glint. Only paints over `on` keys.
 */
export function hairShine(p: Pix, x0: number, x1: number, yAt: (x: number) => number, on: string[], key: string, core: string, glint = "w"): void {
  const paint = (x: number, y: number, k = key) => {
    if (on.includes(p.get(x, y))) p.set(x, y, k);
  };
  for (let x = x0; x <= x1; x++) {
    const y = Math.round(yAt(x));
    const mid = Math.abs(x - (x0 + (x1 - x0) * 0.35)) < (x1 - x0) * 0.22;
    paint(x, y, mid ? core : key);
    paint(x, y + 1);
    const ph = (x - x0) % 4;
    if (ph === 1) {
      paint(x, y + 2);
      paint(x, y + 3);
    } else if (ph === 2) paint(x, y + 2);
  }
  const gx = Math.round(x0 + (x1 - x0) * 0.3);
  const gy = Math.round(yAt(gx));
  if (on.includes(p.get(gx, gy)) || p.get(gx, gy) === key || p.get(gx, gy) === core) p.set(gx, gy, glint).set(gx + 1, gy, glint);
}

export const STAR9 = `
....1....
...1y1...
...1y1...
11yyzyy11
1yzzzzyY1
.1yzzyY1.
.1yyYyY1.
1yY1.1YY1
11.....11
`;
export const TWINKLE = `
...w...
...w...
..wzw..
wwzzzww
..wzw..
...w...
...w...
`;
export const TWINKLE_S = `
.w.
wzw
.w.
`;

export const FACE_POLY: [number, number][] = [
  [14, 22], [24, 16], [37, 15], [46, 17], [50, 24], [51, 32], [50, 39], [48, 44], [44, 48], [40, 51], [35, 51], [28, 48], [21, 42], [16, 34],
];

export function neckAndFace(p: Pix, dx = 0, dy = 0): void {
  layer(p, (l) => {
    l.rect(31 + dx, 45 + dy, 9, 9, "s");
    l.rect(31 + dx, 45 + dy, 9, 4, "k");
    l.rect(31 + dx, 49 + dy, 2, 4, "k");
  });
  layer(p, (l) => {
    l.poly(
      FACE_POLY.map(([x, y]) => [x + dx, y + dy] as [number, number]),
      "s",
    );
    l.each((x, y, k) => (k === "s" && y > 43 + dy && x > 41 + dx && x - 41 - dx > (50 + dy - y) * 0.5 ? "k" : null));
    l.set(21 + dx, 38 + dy, "t").set(22 + dx, 38 + dy, "t").set(21 + dx, 39 + dy, "t");
  });
}

export const NEAR_X = 20;
export const FAR_X = 38;
export const EYE_Y = 24;

export interface PortraitDef {
  hairLine: string;
  shine: { key: string; core: string; on: string[]; x0?: number; x1?: number; y?: number };
  /** whole-head offset (for tilted / leaning poses); the eyes/mouth add it themselves */
  offset?(f: number): [number, number];
  back(p: Pix, f: number): void;
  body(p: Pix, f: number): void;
  expr(p: Pix, f: number): void;
  crown(l: Pix, f: number): void;
  bangs(l: Pix, f: number): void;
  extras(p: Pix, f: number): void;
  /** painted after the final outline (glows, speed lines that must stay un-outlined) */
  post?(p: Pix, f: number): void;
  /** Optional head tilt: per-column vertical shift applied to the back hair and the head (not the body/extras). */
  tilt?(f: number): ((x: number) => number) | null;
}

/** Shift each column of `src` down by dy(x) (a cheap, clean pixel-art tilt when dy steps between features). */
export function shearY(src: Pix, dy: (x: number) => number): Pix {
  const out = new Pix(src.w, src.h);
  for (let x = 0; x < src.w; x++) {
    const d = Math.round(dy(x));
    for (let y = 0; y < src.h; y++) {
      const k = src.get(x, y);
      if (k !== ".") out.set(x, y + d, k);
    }
  }
  return out;
}

export function paintPortrait(d: PortraitDef, f: number): Pix {
  const p = new Pix(64, 64);
  const [dx, dy] = d.offset?.(f) ?? [0, 0];
  const tilt = d.tilt?.(f) ?? null;
  // back hair (tilted with the head)
  const back = new Pix(64, 64);
  d.back(back, f);
  p.put(tilt ? shearY(back, tilt) : back, 0, 0);
  d.body(p, f);
  // head
  const h = new Pix(64, 64);
  neckAndFace(h, dx, dy);
  d.expr(h, f);
  layer(h, (l) => d.crown(l, f), null);
  const bangs = layer(h, (l) => d.bangs(l, f), d.hairLine);
  castShadow(h, bangs);
  const s = d.shine;
  hairShine(h, (s.x0 ?? 16) + dx, (s.x1 ?? 45) + dx, (x) => (s.y ?? 8) + dy + Math.pow((x - 30 - dx) / 15, 2) * 5, s.on, s.key, s.core);
  p.put(tilt ? shearY(h, tilt) : h, 0, 0);
  d.extras(p, f);
  p.outline("1");
  d.post?.(p, f);
  return p;
}

/** Radial speed lines from (cx, cy) in the empty background only. */
export function speedLines(p: Pix, cx: number, cy: number, n: number, r0: number, key: string, seed = 1): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ((i * 7919 + seed * 31) % 13) * 0.02;
    const len = 6 + ((i * 37 + seed) % 9);
    for (let t = 0; t < len; t++) {
      const r = r0 + ((i * 13) % 7) + t;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      if (p.get(x, y) === ".") p.set(x, y, key);
    }
  }
}

/** Implicit heart test: true if (x, y) lies inside a heart of size w x h whose top-left is (x0, y0). */
export function inHeart(x: number, y: number, x0: number, y0: number, w: number, h: number): boolean {
  const u = ((x + 0.5 - x0) / w) * 2.6 - 1.3;
  const v = 1.25 - ((y + 0.5 - y0) / h) * 2.5;
  const a = u * u + v * v - 1;
  return a * a * a - u * u * v * v * v <= 0;
}

/** Tiny 3x5 hand-lettering font for portrait shout text (uppercase + a few symbols). */
const LETTERS: Record<string, string> = {
  A: ".x.|x.x|xxx|x.x|x.x",
  B: "xx.|x.x|xx.|x.x|xx.",
  C: ".xx|x..|x..|x..|.xx",
  D: "xx.|x.x|x.x|x.x|xx.",
  E: "xxx|x..|xx.|x..|xxx",
  F: "xxx|x..|xx.|x..|x..",
  G: ".xx|x..|x.x|x.x|.xx",
  H: "x.x|x.x|xxx|x.x|x.x",
  I: "xxx|.x.|.x.|.x.|xxx",
  l: "x|x|x|x|x",
  K: "x.x|x.x|xx.|x.x|x.x",
  M: "x.x|xxx|xxx|x.x|x.x",
  N: "x.x|xxx|xxx|xxx|x.x",
  O: ".x.|x.x|x.x|x.x|.x.",
  P: "xx.|x.x|xx.|x..|x..",
  R: "xx.|x.x|xx.|x.x|x.x",
  S: ".xx|x..|.x.|..x|xx.",
  U: "x.x|x.x|x.x|x.x|.x.",
  Y: "x.x|x.x|.x.|.x.|.x.",
  "!": "x|x|x|.|x",
  ".": ".|.|.|.|x",
  "~": "....|.x.x|x.x.|....|....",
};

/** Stamp text with the mini font: ink key + outline key (1px, 8-neighbour). Returns width. */
export function letter(p: Pix, text: string, x: number, y: number, ink: string, outline = "1", tilt = 0): number {
  const l = new Pix(p.w, p.h);
  let pen = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") {
      pen += 2;
      continue;
    }
    const g = LETTERS[ch];
    if (!g) continue;
    const rowsG = g.split("|");
    const dy = Math.round(i * tilt);
    rowsG.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] === "x") l.set(pen + xx, y + yy + dy, ink);
    });
    pen += rowsG[0].length + 1;
  }
  l.outline(outline, true);
  p.put(l, 0, 0);
  return pen - x;
}
