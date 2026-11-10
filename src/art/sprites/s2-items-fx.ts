/**
 * Season 2 effects + pop text (owner: s2-items): BAKA! / NANI?! / HONK pops,
 * charm heart, shoujo rose, henshin burst, overdone crater, isekai light
 * pillar, sleepy Zzz and glitch motes.
 *
 * Pop text is hand-lettered: coloured letters, a white (or pale) keyline and a
 * plum outer outline so it reads on every ground, with a little per-letter
 * bounce. Light effects follow the bloom recipe (white core, colour body,
 * semi-transparent falloff).
 */
import type { SpriteDef } from "../format";
import { Cv, GLOW, hash, inHeart, inStar, rgba, spr } from "../sprites/s2-items-util";

// ============================================================================ hand-lettering

/** Chunky 4x6 display glyphs (x = ink): brush-lettered, heavy left downstrokes. */
const DISPLAY: Record<string, string[]> = {
  B: ["xxx.", "x..x", "xxx.", "x..x", "x..x", "xxx."],
  A: [".xx.", "x..x", "x..x", "xxxx", "x..x", "x..x"],
  K: ["x..x", "x.x.", "xx..", "xx..", "x.x.", "x..x"],
  N: ["x..x", "xx.x", "xxxx", "x.xx", "x..x", "x..x"],
  I: ["x", "x", "x", "x", "x", "x"],
  H: ["x..x", "x..x", "xxxx", "x..x", "x..x", "x..x"],
  O: [".xx.", "x..x", "x..x", "x..x", "x..x", ".xx."],
  "?": [".xx.", "x..x", "..x.", ".x..", "....", ".x.."],
  "!": ["x", "x", "x", "x", ".", "x"],
};
/** Narrow 3x6 capitals for BAKA! (leaves room for the anger vein in 24 px). */
const NARROW: Record<string, string[]> = {
  B: ["xx.", "x.x", "xx.", "x.x", "x.x", "xx."],
  A: [".x.", "x.x", "x.x", "xxx", "x.x", "x.x"],
  K: ["x.x", "x.x", "xx.", "xx.", "x.x", "x.x"],
  "!": ["x", "x", "x", "x", ".", "x"],
};
/** Small lowercase 3x4 glyphs for the "...baka" whisper. */
const SMALL: Record<string, string[]> = {
  b: ["x..", "x..", "xx.", "x.x", "xx."],
  a: ["...", ".xx", "x.x", "x.x", ".xx"],
  k: ["x..", "x.x", "xx.", "x.x", "x.x"],
};

function letter(c: Cv, g: string[], x: number, y: number, k: string): number {
  for (let yy = 0; yy < g.length; yy++) for (let xx = 0; xx < g[yy].length; xx++) if (g[yy][xx] === "x") c.set(x + xx, y + yy, k);
  return g[0].length;
}

/** Write a word with per-letter y bounce offsets; returns the end x. */
function word(c: Cv, s: string, x: number, y: number, k: string, bounce: number[], font = DISPLAY, gap = 1): number {
  let pen = x;
  [...s].forEach((ch, i) => {
    const g = font[ch];
    if (!g) {
      pen += 2;
      return;
    }
    pen += letter(c, g, pen, y + (bounce[i % bounce.length] ?? 0), k) + gap;
  });
  return pen - gap;
}

/** Keyline (inner) + plum outline (outer). */
function popOutline(c: Cv, key: string, outer = "1"): Cv {
  c.selout({}, key);
  c.outline(outer);
  return c;
}

/** The anime anger vein (four little corner brackets). */
const ANGER = `
.r.r.
rr.rr
.....
rr.rr
.r.r.`;

function fxBaka(f: number): Cv {
  const c = new Cv(24, 10);
  if (f === 0) {
    word(c, "BAKA!", 2, 2, "r", [1, 0, 1, 0, -1], NARROW);
    popOutline(c, "w");
    c.put(ANGER, 19, 0);
    c.each((x, y, k) => (k === "r" && x >= 19 && y <= 4 ? "r" : null));
  } else {
    // whispered: "..baka" + a heart, small and pink
    c.set(1, 7, "p").set(3, 7, "p");
    word(c, "baka", 5, 3, "p", [0, 0, 0, 0], SMALL);
    c.shape((x, y) => inHeart(x, y, 21.6, 4.6, 2.2), "p");
    c.set(20, 3, "q");
    c.selout({}, "W");
    c.outline("1");
  }
  return c;
}

function fxNani(f: number): Cv {
  const c = new Cv(28, 12);
  word(c, "NANI?!", 3, 3 + f, "r", f === 0 ? [0, -1, 0, 1, -1, 0] : [-1, 0, 0, 0, -1, -1]);
  c.selout({}, "w");
  c.outline("1");
  // shock lines radiating from the corners
  const lines: [number, number][] = f === 0 ? [[0, 0], [1, 1], [27, 0], [26, 1], [0, 11], [27, 11], [13, 0]] : [[1, 0], [2, 1], [26, 0], [25, 1], [1, 11], [26, 11], [14, 0]];
  for (const [x, y] of lines) if (c.get(x, y) === ".") c.set(x, y, "y");
  return c;
}

function fxHonk(f: number): Cv {
  const c = new Cv(24, 10);
  const dx = f === 1 ? -1 : 0;
  word(c, "HONK", 4 + dx, 2, "y", f === 0 ? [0, 0, 0, 0] : [1, 0, 1, 0]);
  c.each((x, y, k) => (k === "y" ? "O" : null));
  c.selout({}, "z");
  c.outline("1");
  // sound lines: a "(" on the left, little blast ticks off the top-right / bottom-right
  const L: [number, number][] = [[1, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 7]];
  for (const [x, y] of L) c.set(x + (f === 1 ? 0 : 1), y, "z");
  for (const [x, y] of [[22, 0], [23, 0], [22, 9], [23, 9]] as [number, number][]) if (c.get(x, y) === ".") c.set(x, y, "z");
  return c;
}

// ============================================================================ charm heart (8x7)

const CHARM = `
.11..11.
1qw11pp1
1pqpppP1
1ppppPP1
.1ppPP1.
..1PP1..
...11...`;
function charmHeart(f: number): Cv {
  const c = Cv.of(CHARM);
  if (f === 1) {
    // heartbroken: a zigzag crack splits it and the colour drains
    c.map({ p: "P", q: "p", P: "Q", w: "q" });
    for (const [x, y] of [
      [4, 1],
      [3, 2],
      [4, 3],
      [3, 4],
      [4, 5],
    ])
      c.set(x, y, "1");
  }
  return c;
}

// ============================================================================ shoujo rose (16x16)

function roseBig(f: number): Cv {
  const c = new Cv(16, 16);
  const cx = 7.5;
  const cy = 7;
  // leaves
  c.poly([[3, 12], [6, 9.5], [7, 11], [4, 14]], "e");
  c.poly([[12.5, 12.5], [9, 10], [8.4, 11.6], [11, 14]], "E");
  c.set(4, 12, "l").set(11, 12, "e");
  // bloom: a spiral of petal edges
  const rot = f === 0 ? 0 : 0.9;
  c.disc(cx, cy, 5.2, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx) + rot;
    // spiral phase: petal edges where (r - k*a) crosses an integer
    const ph = (((r * 0.62 - a / (Math.PI * 2) * 1.0) % 1) + 1) % 1;
    const lit = dx + dy < -1.5;
    if (ph < 0.2) return r < 2 ? "R" : "Q";
    if (r < 1.6) return "R";
    if (lit) return ph > 0.75 ? "q" : "p";
    return ph > 0.7 ? "p" : "r";
  });
  c.outline("1");
  c.set(5, 4, "w");
  // sparkles (shoujo!) - they swap places between frames
  const sp = f === 0 ? [[14, 2], [1, 3], [14, 9]] : [[13, 1], [1, 8], [15, 6]];
  for (const [x, y] of sp) {
    c.set(x, y, "w");
    for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (c.get(x + ddx, y + ddy) === ".") c.set(x + ddx, y + ddy, "q");
  }
  return c;
}

// ============================================================================ henshin burst (32x32, 6 frames, play-once)

const RIBBON_KEYS: [string, string][] = [
  ["p", "q"],
  ["l", "m"],
  ["y", "z"],
];
function henshin(f: number): Cv {
  const c = new Cv(32, 32);
  const cx = 15.5;
  const cy = 15.5;
  if (f <= 2) {
    // ribbons spiralling IN (radius shrinks frame by frame, a tighter curl each time)
    const r0 = [15, 11, 6][f];
    const spin = f * 1.3;
    for (let i = 0; i < 3; i++) {
      const [k, hi] = RIBBON_KEYS[i];
      const base = (i * Math.PI * 2) / 3 + spin;
      for (let t = 0; t <= 1; t += 0.01) {
        const a = base + t * 2.6;
        const r = r0 * (1 - t * 0.55);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        c.set(x, y, t < 0.15 ? hi : k);
        c.set(x + Math.cos(a) * 1, y + Math.sin(a) * 1, k);
      }
    }
    // gathering glow at the centre
    const g = [1.5, 2.5, 4][f];
    c.disc(cx, cy, g + 1.2, "%");
    c.disc(cx, cy, g, f === 2 ? "w" : "z");
    if (f === 2) sparkleRing(c, cx, cy, 10, 6, 0);
    return c;
  }
  if (f === 3) {
    // STAR FLASH
    c.disc(cx, cy, 11, "@");
    c.disc(cx, cy, 8, "%");
    c.shape((x, y) => inStar(x, y, cx, cy, 5, 11, 4.6, 0, 0.3), (x, y) => (Math.hypot(x - cx, y - cy) < 5 ? "w" : "z"));
    c.shape((x, y) => inStar(x, y, cx, cy, 5, 11, 4.6, 0, 0.3) && !inStar(x, y, cx, cy, 5, 10, 4.0, 0, 0.3), "y");
    // long cross flare
    for (let d = 0; d < 16; d++) {
      const k = d < 8 ? "w" : "%";
      c.set(cx + d, cy, k).set(cx - d, cy, k);
    }
    return c;
  }
  // f4-5: ribbons flying OUT + fading star / sparkles
  const r0 = f === 4 ? 6 : 11;
  for (let i = 0; i < 3; i++) {
    const [k, hi] = RIBBON_KEYS[i];
    const base = (i * Math.PI * 2) / 3 + 0.4 + (f - 4) * 0.5;
    for (let t = 0; t <= 1; t += 0.01) {
      const a = base + t * 1.4;
      const r = r0 + t * (f === 4 ? 9 : 5);
      if (f === 5 && (Math.floor(t * 14) % 3 === 0)) continue;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      c.set(x, y, t > 0.85 ? hi : k);
      if (f === 4) c.set(x + 1, y, k);
    }
  }
  if (f === 4) {
    c.shape((x, y) => inStar(x, y, cx, cy, 5, 6, 2.6, 0.3, 0.3), (x, y) => (Math.hypot(x - cx, y - cy) < 2.5 ? "w" : "z"));
    sparkleRing(c, cx, cy, 12, 8, 0.2);
  } else {
    sparkleRing(c, cx, cy, 14, 6, 0.6);
    c.set(cx, cy, "%");
  }
  return c;
}
function sparkleRing(c: Cv, cx: number, cy: number, r: number, n: number, off: number): void {
  for (let i = 0; i < n; i++) {
    const a = off + (i * Math.PI * 2) / n;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    c.set(x, y, "w");
    if (i % 2 === 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.set(x + dx, y + dy, "%");
  }
}

// ============================================================================ overdone crater (24x12)

function crater(f: number): Cv {
  const c = new Cv(24, 12);
  const cx = 11.5;
  const cy = 6;
  c.ellipse(cx, cy, 11.4, 5.6, (x, y) => {
    const d = Math.hypot((x - cx) / 11.4, (y - cy) / 5.6);
    const n = hash(x, y, 3) * 0.12;
    if (f === 0) {
      if (d + n > 0.86) return "!";
      if (d + n > 0.68) return y < cy ? "O" : "R";
      if (d + n > 0.5) return "o";
      if (d + n > 0.28) return "y";
      return "z";
    }
    if (f === 1) {
      if (d + n > 0.86) return "!";
      if (d + n > 0.62) return "2";
      // embers: scattered glowing specks on charcoal
      const e = hash(x, y, 9);
      if (e > 0.86) return d < 0.5 ? "y" : "o";
      if (e > 0.74) return "O";
      return d < 0.4 ? "X" : "x";
    }
    // scorch: soft charcoal with a dark rim, fading out
    if (d + n > 0.8) return "!";
    if (d + n > 0.55) return "x";
    return hash(x, y, 4) > 0.8 ? "2" : "X";
  });
  // the crater lip (lit top-left rim)
  if (f < 2) {
    for (let x = 4; x <= 10; x++) if (c.get(x, 1) !== ".") c.set(x, 1, f === 0 ? "y" : "O");
  }
  return c;
}

// ============================================================================ isekai light pillar (16x48, feet)

function lightPillar(f: number): Cv {
  const c = new Cv(16, 48);
  const cx = 7.5;
  const top = [30, 0, 0, 6][f]; // f0 rising from the ground, f1-2 full, f3 fading out
  const halfW = [3.4, 4.4, 3.6, 2.4][f];
  for (let y = top; y < 46; y++) {
    const t = (y - top) / (46 - top); // 0 top .. 1 base
    const w = halfW * (0.75 + 0.25 * t);
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - cx) / w;
      if (d > 1.35) continue;
      const up = 1 - t; // 1 at the top
      let k: string;
      if (f === 3) {
        // fading: a thin faint gold column
        if (d > 0.9) continue;
        k = d < 0.4 && up < 0.6 ? "&" : ":";
      } else if (up > 0.82) {
        // soft top: only translucent gold
        if (d > 1.05) continue;
        k = d < 0.5 ? "&" : ":";
      } else if (d < 0.35) k = up > 0.6 ? "z" : "w";
      else if (d < 0.75) k = up > 0.6 ? "&" : "z";
      else if (d < 1.05) k = "&";
      else k = ":";
      c.set(x, y, k);
    }
  }
  // glowing ground ellipse at the base
  c.ellipse(cx, 46, 7.4, 1.6, f === 3 ? ":" : "&");
  c.ellipse(cx, 46, 4.8, 1.0, f === 3 ? "&" : "z");
  if (f < 3) c.ellipse(cx, 46, 2.2, 0.6, "w");
  // sparkles rising up (higher each frame)
  const sp: [number, number][] = [
    [2, 40],
    [13, 34],
    [1, 26],
    [14, 18],
    [3, 10],
    [12, 4],
  ];
  sp.forEach(([x, y], i) => {
    const yy = y - f * 5;
    if (yy < 0 || (f === 0 && yy < 28)) return;
    c.set(x, yy, i % 2 ? "w" : "z");
    if (i % 3 === 0 && f < 3) c.set(x, yy - 1, "%").set(x, yy + 1, "%").set(x - 1, yy, "%").set(x + 1, yy, "%");
  });
  return c;
}

// ============================================================================ Zzz (8x8, 3 sizes) and glitch motes (8x8)

const ZZZ = [
  `
........
........
.111111.
.1jjjj1.
.11jI11.
.1jI11..
.1jjjj1.
.111111.`.replace(/\n\.1jI11\.\./, "\n.1jI11.."),
  `
........
........
.11111..
1jjjjI1.
.1.1jI1.
..1jI1..
.1jjjj1.
.11111..`,
  `
.111111.
1jjjjjI1
.111jI1.
...1jI1.
..1jI1..
.1jI111.
1jjjjjI1
.111111.`,
];

const GLITCH_COLS = ["p", "c", "l", "w"];
function glitch(f: number): Cv {
  const c = new Cv(8, 8);
  // three offset blocks per frame (RGB split): pink / cyan / lime, plus white sparks
  for (let i = 0; i < 4; i++) {
    const r = (n: number) => Math.floor(hash(f * 7 + i, n, 77) * 8);
    const w = 1 + (r(1) % 4);
    const h = 1 + (r(2) % 2);
    const x = r(3) % (8 - w + 1);
    const y = r(4) % (8 - h + 1);
    c.rect(x, y, w, h, GLITCH_COLS[i]);
    // the RGB-split ghost of the block, offset 1px
    if (i < 3) c.rect(Math.min(7, x + 1), y + 1 > 7 ? y - 1 : y + 1, Math.max(1, w - 1), 1, GLITCH_COLS[(i + 1) % 3]);
  }
  c.set(Math.floor(hash(f, 9, 5) * 8), Math.floor(hash(f, 8, 5) * 8), "w");
  return c;
}

export const sprites: SpriteDef[] = [
  spr("fx_baka", 24, 10, [0, 1].map(fxBaka), "center", { fps: 6 }),
  spr("fx_nani", 28, 12, [0, 1].map(fxNani), "center", { fps: 16 }),
  spr("fx_honk", 24, 10, [0, 1].map(fxHonk), "center", { fps: 16 }),
  spr("fx_charm_heart", 8, 7, [0, 1].map(charmHeart), "center", { fps: 4 }),
  spr("fx_rose_big", 16, 16, [0, 1].map(roseBig), "center", { fps: 3 }),
  spr("fx_henshin", 32, 32, [0, 1, 2, 3, 4, 5].map(henshin), "center", { pal: GLOW, fps: 12 }),
  spr("fx_crater", 24, 12, [0, 1, 2].map(crater), "center", { pal: GLOW, fps: 2 }),
  spr("fx_light_pillar", 16, 48, [0, 1, 2, 3].map(lightPillar), "feet", { pal: GLOW, fps: 8 }),
  spr("fx_zzz", 8, 8, ZZZ, "center", { fps: 3 }),
  spr("fx_glitch", 8, 8, [0, 1, 2, 3].map(glitch), "center", { fps: 12 }),
];

void rgba;
