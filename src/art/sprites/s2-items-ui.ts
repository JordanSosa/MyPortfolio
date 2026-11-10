/**
 * Season 2 hub / gacha / board UI art (owner: s2-items): big currency icons,
 * the gacha capsule + meteor + summoning circle, rarity badges and card
 * corners, the MASTERED frame and the Training Arc board nodes / glyphs.
 * (The Merch Machine itself lives in s2-items-machine.ts.)
 *
 * House style: auto plum outline, top-left light, hue-shifted ramps, a white
 * glint. Glows use semi-transparent local palette keys (GLOW).
 */
import type { SpriteDef } from "../format";
import { Cv, GLOW, LIGHT, inStar, micro, ring, rgba, shadedStar, sparkle, spr, starRadius } from "../sprites/s2-items-util";

const shade = (dx: number, dy: number) => dx * LIGHT[0] + dy * LIGHT[1]; // + = lit

/** Light-from-top-left sphere normal shading value for a pixel inside a circle (-1..1). */
function sphereL(x: number, y: number, cx: number, cy: number, r: number): number {
  const nx = (x - cx) / (r + 0.5);
  const ny = (y - cy) / (r + 0.5);
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
}

/** Diagonal shine band (frame 1 "shine sweep"): paints `k` on opaque, non-outline pixels where x + y is in [a, a + w). */
function sweep(c: Cv, a: number, w: number, k = "w", k2 = "z"): Cv {
  return c.each((x, y, cur) => {
    if (cur === "." || cur === "1" || cur === "0") return null;
    const d = x + y - a;
    if (d >= 0 && d < w) return d === 0 || d === w - 1 ? k2 : k;
    return null;
  });
}

// =========================================================================== big currency icons (24x24)

function coinBig(f: number): Cv {
  const c = new Cv(24, 24);
  const cx = 11.5;
  const cy = 11;
  c.disc(cx, cy + 1.2, 10, "O"); // coin thickness
  c.disc(cx, cy, 10, (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    const l = shade(x - cx, y - cy);
    if (d > 8.4) return l > 1.5 ? "z" : l > -3 ? "y" : "Y";
    if (d > 7.4) return l > 0 ? "Y" : "z"; // engraved groove (reversed light)
    return l > 3.5 ? "z" : l > -3.5 ? "y" : "Y";
  });
  c.outline("1");
  // embossed star: drop shadow down-right, pale face, lit edge top-left
  c.shape((x, y) => inStar(x - 1, y - 1, cx, cy + 0.4, 5, 6.2, 2.9, 0, 0.35), "O");
  c.shape(
    (x, y) => inStar(x, y, cx, cy + 0.4, 5, 6.2, 2.9, 0, 0.35),
    (x, y) => (shade(x - cx, y - cy) > 1.2 ? "w" : "z"),
  );
  c.pts([[5, 5], [6, 4], [4, 6]], "w");
  if (f === 1) sweep(c, 18, 3);
  else c.set(17, 4, "w");
  return c;
}

function gemBig(f: number): Cv {
  const c = new Cv(24, 24);
  const L: [number, number] = [1, 9];
  const R: [number, number] = [22, 9];
  const TL: [number, number] = [6, 3];
  const TR: [number, number] = [17, 3];
  const GL: [number, number] = [8.5, 9];
  const GR: [number, number] = [15, 9];
  const B: [number, number] = [11.5, 21.5];
  c.poly([L, TL, GL], "q");
  c.poly([TL, TR, GR, GL], (x, y) => (y < 5 ? "w" : "q"));
  c.poly([TR, R, GR], "p");
  c.poly([L, GL, B], "p");
  c.poly([GL, GR, B], (x, y) => (y < 14 ? "q" : "p"));
  c.poly([GR, R, B], (x, y) => (x > 15 ? "Q" : "P"));
  c.rect(1, 9, 22, 1, "P");
  c.rect(2, 9, 6, 1, "p");
  c.outline("1");
  c.pts([[7, 4], [6, 5], [5, 6]], "w");
  if (f === 1) sweep(c, 16, 3);
  else sparkle(c, 19, 3, "w", "q");
  return c;
}

/** Diagonal pill capsule from A to B (SDF), pink half then lavender half. */
function pill(c: Cv, ax: number, ay: number, bx: number, by: number, r: number): Cv {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  return c.each((x, y) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const qx = ax + dx * t;
    const qy = ay + dy * t;
    const d = Math.hypot(x - qx, y - qy);
    if (d > r) return null;
    const along = ((x - ax) * dx + (y - ay) * dy) / len2;
    const nx = (x - qx) / r;
    const ny = (y - qy) / r;
    const l = nx * LIGHT[0] + ny * LIGHT[1] + Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * LIGHT[2];
    const pink = along < 0.5;
    if (Math.abs(along - 0.5) < 0.03) return pink ? "P" : "I";
    if (l > 0.85) return "w";
    if (pink) return l > 0.55 ? "q" : l > 0.05 ? "p" : "P";
    return l > 0.55 ? "w" : l > 0.05 ? "j" : "i";
  });
}

function copiumBig(f: number): Cv {
  const c = new Cv(24, 24);
  pill(c, 6, 17, 17, 6, 5);
  c.outline("1");
  sparkle(c, 4, 4, "w", "q");
  c.set(20, 19, "j").set(21, 18, "q");
  if (f === 1) sweep(c, 20, 3);
  return c;
}

// =========================================================================== gacha capsule (32x32 x6)

type CapCol = { d: string; m: string; l: string; h: string };
const CAP_COLS: CapCol[] = [
  { d: "n", m: "U", l: "u", h: "v" }, // blue
  { d: "2", m: "I", l: "i", h: "j" }, // purple
  { d: "O", m: "Y", l: "y", h: "z" }, // gold
];
const RAINBOW = ["r", "o", "y", "e", "c", "u", "i"];

function capsuleBody(c: Cv, top: (x: number, y: number, l: number) => string, cx = 15.5, cy = 16.5, r = 13, lift = 0): Cv {
  // bottom half: white plastic
  c.disc(cx, cy, r, (x, y) => {
    if (y < cy) return null;
    const l = sphereL(x, y, cx, cy, r);
    return l > 0.62 ? "w" : l > 0.2 ? "W" : "g";
  });
  // top half: coloured plastic (optionally lifted off when cracked)
  c.disc(cx, cy - lift, r, (x, y) => {
    if (y >= cy - lift) return null;
    return top(x, y, sphereL(x, y, cx, cy - lift, r));
  });
  // seam band
  for (let x = 0; x < c.w; x++)
    for (const yy of [Math.round(cy) - lift - 1, Math.round(cy)]) {
      if (c.get(x, yy) === "." || Math.hypot(x - cx, yy - cy) > r) continue;
      c.set(x, yy, yy < cy ? "G" : "g");
    }
  return c;
}

function capsuleShine(c: Cv, cx = 15.5, cy = 16.5, lift = 0): Cv {
  c.ellipse(cx - 6, cy - 8 - lift, 2.6, 1.6, "w");
  c.set(Math.round(cx - 2), Math.round(cy - 10.5 - lift), "w");
  c.pts([[Math.round(cx + 9), Math.round(cy + 5)], [Math.round(cx + 8), Math.round(cy + 7)]], "w");
  return c;
}

function gachaCapsule(f: number): Cv {
  const c = new Cv(32, 32);
  if (f <= 2) {
    const k = CAP_COLS[f];
    capsuleBody(c, (x, y, l) => (l > 0.72 ? k.h : l > 0.35 ? k.l : l > -0.05 ? k.m : k.d));
    c.outline("1");
    capsuleShine(c);
    // star sticker on the dome
    shadedStar(c, 20, 9, 3.2, 1.5, { rimLit: "w", rimDark: f === 2 ? "o" : "q", body: f === 2 ? "w" : "q", inner: "w", core: "w" }, { coreR: 0.5 });
    return c;
  }
  if (f === 3) {
    capsuleBody(c, (x, y, l) => {
      const band = Math.floor((x + (16.5 - y) * 0.6) / 4.2);
      const k = RAINBOW[((band % 7) + 7) % 7];
      return l > 0.93 ? "w" : k;
    });
    c.outline("1");
    capsuleShine(c);
    sparkle(c, 21, 7, "w", "z");
    sparkle(c, 4, 22, "w", "z");
    return c;
  }
  if (f === 4) {
    // glitch: dark capsule, RGB-split ghosts, displaced slices, dead pixels
    const base = new Cv(32, 32);
    capsuleBody(base, (x, y, l) => (l > 0.72 ? "f" : l > 0.25 ? "x" : "X"));
    base.outline("1");
    capsuleShine(base);
    const cyan = base.clone().shift(-2, 0).map({});
    const pink = base.clone().shift(2, 0);
    c.put(cyan, 0, 0, { map: Object.fromEntries([...new Set(cyan.d)].filter((k) => k !== ".").map((k) => [k, "c"])) });
    c.put(pink, 0, 0, { map: Object.fromEntries([...new Set(pink.d)].filter((k) => k !== ".").map((k) => [k, "p"])) });
    c.put(base, 0, 0);
    // horizontal slice displacement
    for (const [y0, h, dx] of [
      [7, 2, 3],
      [19, 3, -3],
      [24, 1, 2],
    ] as const) {
      const rowsCopy = base.clone();
      for (let y = y0; y < y0 + h; y++)
        for (let x = 0; x < 32; x++) {
          const k = rowsCopy.get(x - dx, y);
          c.set(x, y, k === "." ? "." : k);
        }
    }
    c.pts([[9, 12], [10, 12], [22, 21], [6, 20], [24, 9]], "l");
    c.pts([[13, 25], [14, 25], [20, 13]], "w");
    return c;
  }
  // f5: cracked open, the dome lifted, light pouring out of the gap
  capsuleBody(c, (x, y, l) => (l > 0.62 ? "w" : l > 0.2 ? "W" : "g"), 15.5, 17.5, 12.5, 3);
  c.outline("1");
  // light in the gap + leaking rays
  c.rect(4, 15, 24, 3, (x, y) => (Math.abs(x - 15.5) < 9 ? (y === 16 ? "w" : "z") : null));
  c.each((x, y, k) => {
    if (k !== ".") return null;
    const dx = x - 15.5;
    const dy = y - 16;
    const a = Math.atan2(dy, dx);
    const d = Math.hypot(dx, dy);
    const ray = Math.abs(Math.sin(a * 3)) > 0.93 && Math.abs(dy) < 8 && Math.abs(dx) > 10;
    if (ray && d < 16) return d < 14 ? "%" : "@";
    return null;
  });
  // crack zigzags on both halves
  c.pts([[12, 13], [13, 12], [12, 11], [13, 10]], "G");
  c.pts([[19, 19], [18, 20], [19, 21]], "g");
  c.set(9, 6, "w").set(10, 5, "w").set(8, 7, "w");
  sparkle(c, 27, 6, "w", "z");
  sparkle(c, 4, 27, "w", "z");
  return c;
}

// =========================================================================== gacha meteor (24x48 x5)

type MetCol = { core: string; inner: string; mid: string; outer: string; glow: string };
const MET_COLS: MetCol[] = [
  { core: "w", inner: "a", mid: "u", outer: "U", glow: "~" },
  { core: "w", inner: "j", mid: "i", outer: "I", glow: "$" },
  { core: "w", inner: "z", mid: "y", outer: "o", glow: "&" },
];

function meteorShape(c: Cv, keyAt: (x: number, y: number, v: number, t: number) => string | null, hx = 12, hy = 40, hr = 5.4): Cv {
  // trail: tapers from the head (y = hy) up to y = 1, slight wiggle
  c.each((x, y) => {
    if (y > hy) return null;
    const t = (hy - y) / (hy - 1); // 0 at the head, 1 at the top
    const w = hr * (1 - t) * 0.95 + 0.4;
    const xc = hx + Math.sin(t * 6) * 0.8 * t;
    const v = 1 - Math.abs(x - xc) / w; // 1 on the axis
    if (v <= 0) return null;
    return keyAt(x, y, v, t);
  });
  c.disc(hx, hy, hr, (x, y) => keyAt(x, y, 1 - Math.hypot(x - hx, y - hy) / (hr + 0.5), -1));
  return c;
}

function gachaMeteor(f: number): Cv {
  const c = new Cv(24, 48);
  if (f <= 2) {
    const k = MET_COLS[f];
    meteorShape(c, (x, y, v, t) => {
      if (t < 0) return v > 0.55 ? k.core : v > 0.3 ? k.inner : v > 0.12 ? k.mid : k.outer;
      if (t > 0.75) return v > 0.5 ? k.mid : k.glow;
      return v > 0.75 ? k.core : v > 0.5 ? k.inner : v > 0.25 ? k.mid : k.outer;
    });
    c.halo([k.glow]);
    sparkle(c, 5, 30, "w", k.inner);
    sparkle(c, 18, 18, "w", k.inner);
    c.set(16, 33, k.inner).set(7, 12, "w");
    return c;
  }
  if (f === 3) {
    meteorShape(c, (x, y, v, t) => {
      if (t < 0) return v > 0.5 ? "w" : v > 0.25 ? "z" : RAINBOW[Math.floor((x / 24) * 7) % 7];
      if (v > 0.8 && t < 0.6) return "w";
      return RAINBOW[Math.min(6, Math.floor(((x - 12) / 12 + 0.5) * 7 + (1 - v) * 0))] ?? "i";
    });
    c.halo(["@"]);
    sparkle(c, 4, 28, "w", "y");
    sparkle(c, 19, 16, "w", "c");
    sparkle(c, 6, 8, "w", "p");
    return c;
  }
  // glitch: three RGB-offset copies + chopped slices
  const base = new Cv(24, 48);
  meteorShape(base, (x, y, v, t) => (t < 0 ? (v > 0.45 ? "w" : "g") : v > 0.7 ? "w" : v > 0.35 ? "g" : "G"));
  const tint = (src: Cv, k: string) => src.clone().each((x, y, kk) => (kk === "." ? null : k));
  c.put(tint(base.clone().shift(-2, 1), "c"), 0, 0);
  c.put(tint(base.clone().shift(2, -1), "p"), 0, 0);
  c.put(base, 0, 0);
  for (const [y0, h, dx] of [
    [10, 3, 3],
    [24, 2, -2],
    [36, 2, 2],
  ] as const) {
    const cp = c.clone();
    for (let y = y0; y < y0 + h; y++) for (let x = 0; x < 24; x++) c.set(x, y, cp.get(x - dx, y));
  }
  c.pts([[3, 14], [4, 14], [20, 30], [19, 30], [5, 38], [18, 6]], "l");
  c.pts([[20, 22], [2, 26]], "w");
  return c;
}

// =========================================================================== summoning circle (64x64 x4)

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

function summonCircle(f: number): Cv {
  const c = new Cv(64, 64);
  const cx = 31.5;
  const cy = 31.5;
  const runeRot = (f / 4) * ((Math.PI * 2) / 20);
  const starRot = -(f / 4) * ((Math.PI * 2) / 5);
  // soft inner glow
  c.disc(cx, cy, 22, (x, y) => (Math.hypot(x - cx, y - cy) < 13 ? "=" : "-"));
  // pentagram (gold) inside the inner ring
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const a = starRot + (i / 5) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * 21, cy + Math.sin(a) * 21]);
  }
  c.each((x, y) => {
    for (let i = 0; i < 5; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 2) % 5];
      if (distSeg(x, y, ax, ay, bx, by) < 0.62) return "y";
    }
    return null;
  });
  // inner pink ring + outer gold double ring
  ring(c, cx, cy, 21.3, 22.6, "p");
  ring(c, cx, cy, 22.6, 23.4, "q");
  ring(c, cx, cy, 28.4, 29.4, "y");
  ring(c, cx, cy, 29.4, 30.4, "Y");
  ring(c, cx, cy, 25.6, 26.3, "P");
  // rune ticks + tiny glyphs in the band between the rings
  for (let i = 0; i < 20; i++) {
    const a = runeRot + (i / 20) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    if (i % 5 === 0) {
      // star node on the outer ring
      const sx = cx + ca * 29.4;
      const sy = cy + sa * 29.4;
      c.shape((x, y) => inStar(x, y, sx, sy, 5, 2.8, 1.3, a, 0.3), "z");
      c.set(sx, sy, "w");
      continue;
    }
    // rune: a short radial tick + a perpendicular dash
    for (let r = 24.2; r <= 27.8; r += 0.5) c.set(cx + ca * r, cy + sa * r, i % 2 ? "q" : "z");
    const rx = cx + ca * 25.9;
    const ry = cy + sa * 25.9;
    c.set(rx - sa * 1.2, ry + ca * 1.2, "j");
    c.set(rx + sa * 1.2, ry - ca * 1.2, "j");
  }
  // pentagram points get little hearts/sparkles
  for (const [px, py] of pts) {
    c.set(px, py, "w");
    c.set(px - 1, py, "z").set(px + 1, py, "z").set(px, py - 1, "z").set(px, py + 1, "z");
  }
  // centre: glowing star
  shadedStar(c, cx, cy, 4.6, 2.2, { rimLit: "w", rimDark: "y", body: "z", inner: "w", core: "w" }, { rot: starRot, coreR: 1 });
  // outer glow halo
  c.halo(["&", ":"]);
  return c;
}

// =========================================================================== rarity badges (24x12 x7) and card corners (8x8 x7)

/** Chunky 5x7 badge letters (2-px strokes). */
const BOLD: Record<string, string[]> = {
  N: ["xx..xx", "xxx.xx", "xxxxxx", "xx.xxx", "xx..xx", "xx..xx", "xx..xx"],
  R: ["xxxx.", "xx.xx", "xx.xx", "xxxx.", "xx.xx", "xx.xx", "xx.xx"],
  S: [".xxxx", "xx...", "xx...", ".xxx.", "...xx", "...xx", "xxxx."],
  U: ["xx.xx", "xx.xx", "xx.xx", "xx.xx", "xx.xx", "xx.xx", ".xxx."],
  L: ["xx...", "xx...", "xx...", "xx...", "xx...", "xx...", "xxxxx"],
};

function bold(c: Cv, s: string, x: number, y: number, ink: string, shadow: string): void {
  let pen = x;
  for (const ch of s) {
    const g = BOLD[ch];
    for (let yy = 0; yy < g.length; yy++)
      for (let xx = 0; xx < g[yy].length; xx++)
        if (g[yy][xx] === "x") {
          if (c.get(pen + xx + 1, y + yy + 1) !== ink) c.set(pen + xx + 1, y + yy + 1, shadow);
          c.set(pen + xx, y + yy, ink);
        }
    pen += g[0].length + 1;
  }
}
const boldW = (s: string) => [...s].reduce((w, ch) => w + BOLD[ch][0].length + 1, -1);

/** Narrow micro text for MYTHIC (I is 1 px wide). */
function mythic(c: Cv, x: number, y: number, k: string): void {
  const G: string[][] = [
    ["x.x", "xxx", "xxx", "x.x", "x.x"],
    ["x.x", "x.x", ".x.", ".x.", ".x."],
    ["xxx", ".x.", ".x.", ".x.", ".x."],
    ["x.x", "x.x", "xxx", "x.x", "x.x"],
    ["x", "x", "x", "x", "x"],
    [".xx", "x..", "x..", "x..", ".xx"],
  ];
  let pen = x;
  for (const g of G) {
    for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < g[yy].length; xx++) if (g[yy][xx] === "x") c.set(pen + xx, y + yy, k);
    pen += g[0].length + 1;
  }
}

function badgeBase(fill: (x: number, y: number) => string): Cv {
  const c = new Cv(24, 12);
  c.rect(1, 1, 22, 10, fill);
  // rounded pill ends
  for (const [x, y] of [[1, 1], [22, 1], [1, 10], [22, 10]] as const) c.set(x, y, ".");
  c.outline("1");
  return c;
}

const LABELS = ["N", "R", "SR", "SSR", "UR", "LR"];

function rarityBadge(f: number): Cv {
  if (f === 6) {
    // MYTHIC: black with RGB-split lettering
    const c = badgeBase((x, y) => (y < 3 ? "x" : "X"));
    mythic(c, 2, 4, "c");
    mythic(c, 3, 3, "p");
    mythic(c, 2, 3, "w");
    c.pts([[21, 2], [20, 9], [1, 6]], "l");
    return c;
  }
  const ramps: [string, string, string, string][] = [
    ["W", "g", "G", "2"], // N grey
    ["v", "u", "U", "n"], // R blue
    ["j", "i", "I", "2"], // SR violet
    ["z", "y", "Y", "O"], // SSR gold
    ["w", "w", "w", "w"], // UR rainbow (baked below)
    ["r", "R", "Q", "1"], // LR crimson
  ];
  const [hi, mid, lo, sh] = ramps[f];
  const c = badgeBase((x, y) => {
    if (f === 4) return RAINBOW[Math.min(6, Math.floor(((x - 1) / 22) * 7))];
    return y <= 2 ? hi : y >= 9 ? lo : mid;
  });
  if (f === 4) c.rect(2, 1, 20, 1, "w");
  if (f === 5) {
    // gold trim on the crimson badge
    c.rect(2, 1, 20, 1, "y");
    c.rect(2, 10, 20, 1, "Y");
  }
  const s = LABELS[f];
  const w = boldW(s);
  const x = Math.round((24 - w) / 2);
  const ink = f === 5 ? "y" : "w";
  const shadow = f === 3 ? "O" : f === 4 ? "1" : f === 5 ? "1" : sh;
  bold(c, s, x, 2, ink, shadow);
  // glint on the left end
  c.set(2, 2, f === 5 ? "z" : "w");
  return c;
}

function cardCorner(f: number): Cv {
  const c = new Cv(8, 8);
  const cols = [
    ["W", "g", "G"],
    ["v", "u", "U"],
    ["j", "i", "I"],
    ["z", "y", "Y"],
    ["w", "c", "u"],
    ["y", "R", "Q"],
    ["w", "x", "X"],
  ][f];
  const [hi, mid, lo] = cols;
  // L bracket, 2 px thick, lit along the outer edge
  c.rect(1, 1, 6, 2, mid);
  c.rect(1, 1, 2, 6, mid);
  c.rect(1, 1, 6, 1, hi);
  c.rect(1, 1, 1, 6, hi);
  if (f === 4) {
    // rainbow bracket
    const rb = ["r", "o", "y", "e", "c", "u"];
    for (let i = 0; i < 6; i++) c.set(1 + i, 1, rb[i]).set(1, 1 + i, rb[i]);
  }
  c.outline("1");
  if (f >= 2) {
    // corner jewel
    c.put(
      `
.${hi}.
${hi}${f === 5 ? "y" : "w"}${lo}
.${lo}.`,
      0,
      0,
    );
  }
  if (f >= 3) c.set(5, 4, hi).set(4, 5, hi); // flourish dots
  if (f === 5) c.set(6, 3, "y").set(3, 6, "y");
  if (f === 6) c.set(6, 0, "c").set(7, 1, "p").set(0, 6, "l").set(5, 5, "p");
  return c;
}

// =========================================================================== MASTERED frame (20x20)

function mastered(): Cv {
  const c = new Cv(20, 20);
  // 2-px gold frame around a transparent 16x16 window
  c.rect(1, 1, 18, 18, (x, y) => (x <= 2 || y <= 2 || x >= 17 || y >= 17 ? (x + y < 19 ? "y" : "Y") : null));
  c.rect(1, 1, 18, 1, "z");
  c.rect(1, 1, 1, 18, "z");
  c.rect(18, 2, 1, 17, "O");
  c.rect(2, 18, 17, 1, "O");
  c.outline("1");
  // inner edge line (separates the frame from the icon)
  c.rect(3, 3, 14, 14, ".");
  for (let i = 3; i <= 16; i++) c.set(i, 3, "1").set(3, i, "1").set(i, 16, "1").set(16, i, "1");
  c.rect(4, 4, 12, 12, ".");
  // corner studs
  for (const [x, y] of [[1, 1], [18, 1], [1, 18], [18, 18]] as const) c.set(x, y, "w");
  // star on top, centred, overlapping the top bar
  c.rect(7, 0, 6, 1, ".");
  const s = new Cv(20, 20);
  shadedStar(s, 9.5, 2.6, 3.4, 1.6, { rimLit: "z", rimDark: "O", body: "y", inner: "y", core: "w" }, { coreR: 0.6 });
  s.outline("1");
  c.put(s, 0, 0);
  return c;
}

// =========================================================================== Training Arc board

/** Board star state colours: [rim-lit, body, inner, rim-dark, core]. */
const NODE_STATES: [string, string, string, string, string][] = [
  ["G", "2", "2", "1", "G"], // locked: dim plum
  ["W", "g", "j", "G", "w"], // available: pale lavender
  ["w", "q", "w", "p", "w"], // affordable: bright pink-white (pulsed by code)
  ["z", "y", "z", "O", "w"], // owned: gold
];

function boardNode(f: number): Cv {
  const c = new Cv(16, 16);
  const [lit, body, inner, dark, core] = NODE_STATES[f];
  if (f === 2) c.disc(7.5, 8, 7.4, "+");
  shadedStar(c, 7.5, 8.3, 7.2, 3.9, { rimLit: lit, rimDark: dark, body, inner, core }, { round: 0.65, coreR: f === 0 ? 0 : 1.2 });
  c.outline("1");
  if (f === 0) c.set(7, 7, "1").set(8, 7, "1").set(7, 8, "G").set(8, 8, "G"); // keyhole
  if (f === 3) c.set(5, 5, "w");
  return c;
}

function boardKeystone(f: number): Cv {
  const c = new Cv(24, 24);
  const [lit, body, inner, dark, core] = NODE_STATES[f];
  if (f === 2) c.disc(11.5, 10, 11, "+");
  // ornate backing: a second, rotated star in the dark tone
  shadedStar(c, 11.5, 10.5, 11, 6, { rimLit: dark, rimDark: dark, body: dark, inner: dark, core: dark }, { round: 0.3, rot: Math.PI / 5 });
  shadedStar(c, 11.5, 10.5, 10, 5, { rimLit: lit, rimDark: dark, body, inner, core }, { round: 0.55, coreR: 2 });
  // ribbon banner across the bottom: tails behind (darker, notched), band in front
  const rib = f === 0 ? ["G", "2", "x"] : f === 3 ? ["o", "r", "R"] : ["q", "p", "P"];
  c.rect(0, 18, 6, 4, rib[2]);
  c.rect(18, 18, 6, 4, rib[2]);
  c.set(0, 19, ".").set(0, 20, ".").set(23, 19, ".").set(23, 20, ".");
  c.rect(4, 16, 16, 4, rib[1]);
  c.rect(4, 16, 16, 1, rib[0]);
  c.set(4, 20, rib[2]).set(19, 20, rib[2]);
  c.outline("1");
  for (let x = 6; x <= 17; x += 2) c.set(x, 18, f === 0 ? "G" : f === 3 ? "y" : "w");
  if (f === 0) c.set(11, 10, "1").set(12, 10, "1").set(11, 11, "G").set(12, 11, "G");
  if (f >= 2) {
    sparkle(c, 3, 3, "w", lit === "w" ? "q" : lit);
    sparkle(c, 20, 3, "w", lit === "w" ? "q" : lit);
  }
  return c;
}

function boardCenter(f: number): Cv {
  const c = new Cv(32, 32);
  if (f === 1) c.disc(15.5, 16, 15.5, (x, y) => (Math.hypot(x - 15.5, y - 16) > 13 ? "-" : "+"));
  shadedStar(c, 15.5, 17, 14, 7.4, { rimLit: "z", rimDark: "O", body: "y", inner: "y", core: "y" }, { round: 0.5, coreR: 0 });
  c.outline("1");
  // clapperboard ("EPISODE 1") in the middle
  const cb = new Cv(32, 32);
  cb.rect(9, 14, 14, 9, "x");
  cb.rect(9, 14, 14, 1, "f");
  // striped clapper top, opened a little
  for (let x = 9; x < 23; x++) cb.set(x, 12, ((x - 9) >> 1) % 2 ? "w" : "x").set(x - 1, 11, ((x - 9) >> 1) % 2 ? "w" : "x");
  cb.set(22, 11, ".");
  cb.outline("1");
  micro(cb, "EP1", 10, 16, "w");
  cb.rect(10, 22, 12, 0, "g");
  c.put(cb, 0, 0);
  c.set(21, 16, "p").set(21, 18, "p");
  if (f === 1) {
    sparkle(c, 4, 5, "w", "z");
    sparkle(c, 27, 6, "w", "z");
    sparkle(c, 26, 27, "w", "z");
  } else {
    c.set(10, 7, "w");
  }
  return c;
}

/** 8x8 board glyphs: white ink + plum outline (tinted by code). */
const GLYPHS: string[] = [
  // 0 might: a sword
  `
.....ww.
....www.
...www..
w.www...
.www....
..w.....
.w.w....
w.......`,
  // 1 max HP: heart
  `
........
.ww.ww..
wwwwwww.
wwwwwww.
.wwwww..
..www...
...w....
........`,
  // 2 regen: plus with a sparkle
  `
......w.
..ww.www
..ww..w.
wwwwww..
wwwwww..
..ww....
..ww....
........`,
  // 3 armor: shield
  `
wwwwwww.
w.www.w.
wwwwwww.
wwwwwww.
.wwwww..
.wwwww..
..www...
...w....`,
  // 4 move: winged boot
  `
w.......
ww.ww...
.wwww...
..www...
..wwwww.
..wwwwww
........
........`,
  // 5 cooldown: clock
  `
.wwwww..
ww.w.ww.
w..w..w.
w..www..
w.....w.
ww...ww.
.wwwww..
........`,
  // 6 area: target rings
  `
..www...
.w...w..
w.www.w.
w.w.w.w.
w.www.w.
.w...w..
..www...
........`,
  // 7 amount: three shots
  `
........
ww......
ww..ww..
....ww..
.ww...ww
.ww...ww
........
........`,
  // 8 projectile speed: arrow with speed lines
  `
........
....w...
ww..ww..
..wwwww.
ww..ww..
....w...
........
........`,
  // 9 duration: hourglass
  `
wwwwwww.
.w...w..
..w.w...
...w....
..www...
.wwwww..
wwwwwww.
........`,
  // 10 pickup: magnet
  `
ww...ww.
ww...ww.
ww...ww.
ww...ww.
www.www.
.wwwww..
..www...
........`,
  // 11 crit: crosshair
  `
...w....
.wwwww..
.w.w.w..
wwwwwww.
.w.w.w..
.wwwww..
...w....
........`,
  // 12 crit damage: burst
  `
w..w..w.
.w.w.w..
..www...
wwwwwww.
..www...
.w.w.w..
w..w..w.
........`,
  // 13 luck: clover
  `
.ww.ww..
wwwwwww.
.wwwww..
wwwwwww.
.ww.ww..
...w....
..w.....
........`,
  // 14 XP: level-up arrow
  `
...w....
..www...
.wwwww..
wwwwwww.
..www...
..www...
..www...
........`,
  // 15 coins: coin with a star
  `
..www...
.wwwww..
ww.w.ww.
w.....w.
ww...ww.
.wwwww..
..www...
........`,
  // 16 gem find: diamond
  `
........
.wwwww..
wwwwwww.
.wwwww..
..www...
...w....
........
........`,
  // 17 dash cooldown: double chevron
  `
........
w..w....
.w..w...
..w..w..
.w..w...
w..w....
........
........`,
  // 18 curse: skull
  `
.wwwww..
wwwwwww.
w..w..w.
wwwwwww.
.wwwww..
.w.w.w..
........
........`,
  // 19 reroll / banish / skip / cards: card
  `
.wwww...
.w..w...
.w.ww.w.
.wwww.w.
...wwww.
...w..w.
...wwww.
........`,
  // 20 slot: empty slot with a plus
  `
wwwwwww.
w.....w.
w..w..w.
w.www.w.
w..w..w.
w.....w.
wwwwwww.
........`,
  // 21 revive: haloed heart
  `
.wwwww..
........
.ww.ww..
wwwwwww.
.wwwww..
..www...
...w....
........`,
  // 22 dash charge: battery
  `
..www...
.wwwww..
.w...w..
.wwwww..
.w...w..
.wwwww..
.wwwww..
........`,
  // 23 overdrive / chest / elite: crown
  `
........
w..w..w.
ww.w.ww.
wwwwwww.
wwwwwww.
wwwwwww.
........
........`,
];

function glyph(i: number): Cv {
  const c = new Cv(8, 8).put(GLYPHS[i], 0, 0);
  // centre the 7x7 ink in the 8x8 cell, then outline (keeps a 1-px margin where possible)
  return c.outline("1");
}

export const sprites: SpriteDef[] = [
  spr("ui_coin_big", 24, 24, [coinBig(0), coinBig(1)], "center", { fps: 2 }),
  spr("ui_gem_big", 24, 24, [gemBig(0), gemBig(1)], "center", { fps: 2 }),
  spr("ui_copium_big", 24, 24, [copiumBig(0), copiumBig(1)], "center", { fps: 2 }),
  spr("ui_gacha_capsule", 32, 32, [0, 1, 2, 3, 4, 5].map(gachaCapsule), "center", { pal: GLOW }),
  spr("ui_gacha_meteor", 24, 48, [0, 1, 2, 3, 4].map(gachaMeteor), "center", { pal: GLOW }),
  spr("ui_summon_circle", 64, 64, [0, 1, 2, 3].map(summonCircle), "center", { pal: GLOW, fps: 8 }),
  spr("ui_rarity_badge", 24, 12, [0, 1, 2, 3, 4, 5, 6].map(rarityBadge), "center"),
  spr("ui_card_corner", 8, 8, [0, 1, 2, 3, 4, 5, 6].map(cardCorner), "center"),
  spr("ui_mastered", 20, 20, [mastered()], "center"),
  spr("board_node", 16, 16, [0, 1, 2, 3].map(boardNode), "center", { pal: { "+": rgba("#ff7ab8", 0.35) } }),
  spr("board_keystone", 24, 24, [0, 1, 2, 3].map(boardKeystone), "center", { pal: { "+": rgba("#ff7ab8", 0.35) } }),
  spr("board_center", 32, 32, [boardCenter(0), boardCenter(1)], "center", { pal: GLOW, fps: 2 }),
  spr("board_glyph", 8, 8, GLYPHS.map((_, i) => glyph(i)), "center"),
];
