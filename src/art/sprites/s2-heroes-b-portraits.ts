/**
 * Season 2 hero bust portraits, owner s2-heroes-b: Senpai, Magical Girl #47,
 * Isekai-kun, Truck-kun. 64x64, centre pivot, 2 expressions each
 * (f0 = select screen, f1 = ultimate cut-in / gacha splash).
 *
 * Same construction as the base cast (src/art/sprites/portraits.ts, whose
 * helpers are not exported - copied here): strand-painted cel-shaded
 * hair, the shared 3/4 face facing right, hand-pixelled anime eyes, blush
 * hatching and lots of earnest sparkles. That "beginner DeviantArt OC profile
 * art" energy is the point. Art direction: docs/content/heroes.md §2.8-2.11.
 */
import type { SpriteDef } from "../format";
import { Pix, gridSprite, strand, type StrandKeys } from "./chars-util";

// ============================================================================ eyes

/** Near (image-left) eye, outer corner on the left. Keys D/M/L iris dark/mid/light, K pupil. */
const EYE_NEAR = `
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
const EYE_FAR = `
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
/** Happy closed eye (wink / ^^), 10x14. '.' keeps the skin underneath. */
const EYE_ARC = `
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

interface Iris {
  D: string;
  M: string;
  L: string;
  K: string;
}

/** Lower the upper lid by drop(x) rows per column (half-lidded / fierce slanted lids). */
function lidShape(tpl: string, drop: (x: number, w: number) => number): string {
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
const lidded = (tpl: string, n: number) => lidShape(tpl, () => n);
/** Star-shaped sparkle highlights inside the iris (excited eyes). */
function sparkly(e: Pix): void {
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

function eye(p: Pix, tpl: string, x: number, y: number, iris: Iris, extra?: (e: Pix) => void): void {
  const e = Pix.of(tpl, "eye");
  if (extra) extra(e);
  e.recolor(iris as unknown as Record<string, string>);
  p.put(e, x, y);
}

// ============================================================================ painting helpers

/** Draw a layer with `draw`, outline it, and composite it onto `p`. Returns the layer. */
function layer(p: Pix, draw: (l: Pix) => void, outline: string | null = "1"): Pix {
  const l = new Pix(p.w, p.h);
  draw(l);
  if (outline) l.outline(outline);
  p.put(l, 0, 0);
  return l;
}

/** Skin pixels just below/right of hair get the hair's cast shadow (light from top-left). */
function castShadow(p: Pix, hair: Pix, depth = 2): void {
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
function blush(p: Pix, x: number, y: number, n: number, key = "b"): void {
  for (let i = 0; i < n; i++) {
    p.set(x + i * 2, y + 1, key);
    p.set(x + i * 2 + 1, y, key);
  }
}

/**
 * Glossy anime hair shine: a 2px arc band across the crown with short
 * downward zig-zag spikes, plus a hard glint. Only paints over `on` keys.
 */
function hairShine(p: Pix, x0: number, x1: number, yAt: (x: number) => number, on: string[], key: string, core: string, glint = "w"): void {
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
  p.set(gx, gy, glint).set(gx + 1, gy, glint);
}

const TWINKLE = `
...w...
...w...
..wzw..
wwzzzww
..wzw..
...w...
...w...
`;
const TWINKLE_S = `
.w.
wzw
.w.
`;

// ============================================================================ shared face

const FACE_POLY: [number, number][] = [
  [14, 22], [24, 16], [37, 15], [46, 17], [50, 24], [51, 32], [50, 39], [48, 44], [44, 48], [40, 51], [35, 51], [28, 48], [21, 42], [16, 34],
];

function neckAndFace(p: Pix): void {
  layer(p, (l) => {
    l.rect(31, 45, 9, 9, "s");
    l.rect(31, 45, 9, 4, "k");
    l.rect(31, 49, 2, 4, "k");
  });
  layer(p, (l) => {
    l.poly(FACE_POLY, "s");
    l.each((x, y, k) => (k === "s" && y > 43 && x > 41 && x - 41 > (50 - y) * 0.5 ? "k" : null));
    l.set(21, 38, "t").set(22, 38, "t").set(21, 39, "t");
  });
}

const NEAR_X = 20;
const FAR_X = 38;
const EYE_Y = 24;

interface PortraitDef {
  hair: StrandKeys;
  /** colour line between hair locks */
  hairLine: string;
  shine: { key: string; core: string; on: string[] };
  back(p: Pix, f: number): void;
  body(p: Pix, f: number): void;
  expr(p: Pix, f: number): void;
  crown(l: Pix): void;
  bangs(l: Pix, f: number): void;
  extras(p: Pix, f: number): void;
}

const PORTRAIT_PAL = { "~": "#ffe3f1", A: "#3462d6c8" };

// ============================================================================ s2-heroes-b extensions

interface PDef extends PortraitDef {
  /** behind everything (gets outlined with the silhouette) */
  bg?(p: Pix, f: number): void;
  /** after the final outline pass, into empty pixels only (screentone, glows) */
  post?(p: Pix, f: number): void;
  /** skip the glossy hair shine band (Isekai-kun's deliberately flat hair) */
  noShine?: boolean;
  shineY?: (x: number) => number;
}

function paintS2(d: PDef, f: number): Pix {
  const p = new Pix(64, 64);
  d.bg?.(p, f);
  d.back(p, f);
  d.body(p, f);
  neckAndFace(p);
  d.expr(p, f);
  layer(p, (l) => d.crown(l), null);
  const bangs = layer(p, (l) => d.bangs(l, f), d.hairLine);
  castShadow(p, bangs);
  if (!d.noShine) hairShine(p, 16, 45, d.shineY ?? ((x) => 8 + Math.pow((x - 30) / 15, 2) * 5), d.shine.on, d.shine.key, d.shine.core);
  d.extras(p, f);
  p.outline("1");
  d.post?.(p, f);
  return p;
}

/** Shift the iris (and its highlights) sideways inside the eye white: looking off to one side. */
function lookAside(tpl: string, dx: number): string {
  const p = Pix.of(tpl, "look");
  const out = p.clone();
  const iris = "DMLKwa";
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) if (iris.includes(p.get(x, y))) out.set(x, y, "W");
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const k = p.get(x, y);
      if (!iris.includes(k)) continue;
      const tx = x + dx;
      const dst = p.get(tx, y);
      if (dst !== "." && dst !== "0" && dst !== "k") out.set(tx, y, k);
    }
  return out.str();
}

/** Paint only into empty pixels. */
function dotsInto(p: Pix, k: string, test: (x: number, y: number) => boolean): void {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) === "." && test(x, y)) p.set(x, y, k);
}

/** Hand-pixelled roses (spiral cup, lit from the top-left), fill only - layer() outlines them. */
const ROSE_L = `
....rrrrr....
..rrpqqqprr..
.rpqRRRRRqpr.
rpqRRrrrrRRpr
rpRRrpqqrRRRr
rpRrpRRRqrRRr
rrRrpRrrRrRRr
.rRRrpRRrRRr.
.prRRrrrRRRp.
..pprRRRRpp..
...ppprrpp...
....pppp.....
`;
const ROSE_M = `
..rrrrr..
.rpqqqpr.
rpRRRRRpr
rpRrqqRRr
rRRpRRrRr
.rRRrrRr.
..pRRRp..
...ppp...
`;
const ROSE_S = `
.rrrr.
rpqqpr
rqRRrR
rRprRR
.RRRR.
..RR..
`;
type RoseSize = "L" | "M" | "S";
/** Stamp a rose centred on (cx, cy). */
function rose(l: Pix, cx: number, cy: number, size: RoseSize): void {
  const t = Pix.of(size === "L" ? ROSE_L : size === "M" ? ROSE_M : ROSE_S, "rose");
  l.put(t, Math.round(cx - t.w / 2), Math.round(cy - t.h / 2));
}

/** Leaf (pointed ellipse) in green. */
function leaf(l: Pix, x0: number, y0: number, x1: number, y1: number, w = 2): void {
  strand(l, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - 1], [x1, y1]], 1, 1, { base: "e" });
  strand(l, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1]], w * 2, 1, { base: "e", shade: "E", light: "l" });
}

// ============================================================================ SENPAI
const SENPAI_HAIR: StrandKeys = { base: "j", shade: "g", light: "w", deep: "G" };
const SENPAI: PDef = {
  hair: SENPAI_HAIR,
  hairLine: "G",
  shine: { key: "w", core: "w", on: ["j", "g"] },
  bg(p, f) {
    // roses in the background corners (shoujo frame)
    layer(p, (l) => {
      leaf(l, 9, 9, 15, 13);
      rose(l, 6, 5, "L");
      leaf(l, 56, 10, 51, 13);
      rose(l, 58, 7, "M");
      if (f === 1) {
        leaf(l, 7, 54, 12, 58);
        rose(l, 4, 51, "M");
      }
    });
  },
  back(p, f) {
    const H = SENPAI_HAIR;
    const wind = f === 0 ? 1 : 0;
    // long hair flowing behind, blown back (to the left) by the ever-present wind
    layer(p, (l) => {
      l.ellipse(33, 26, 21, 21, "g");
      l.poly([[14, 28], [50, 28], [52, 48], [14, 50]], "g");
      l.each((x, y, k) => (k === "g" && (x < 18 || x > 48) && y > 30 ? "G" : null));
    });
    layer(p, (l) => {
      strand(l, [[16, 12], [9, 18 - wind * 2], [3, 26 - wind * 3], [0, 34 - wind * 4]], 11, 3, H, { shadeAt: 0.2 });
      strand(l, [[15, 20], [8, 28], [3, 38 - wind * 3], [0, 46 - wind * 4]], 10, 2, H, { shadeAt: 0.2 });
      strand(l, [[16, 30], [9, 40], [6, 50 - wind * 3], [2, 58 - wind * 2]], 9, 2, H, { shadeAt: 0.2 });
      strand(l, [[50, 16], [55, 27], [56, 40], [53, 52]], 8, 2, H, { shadeAt: 0.05 });
    });
  },
  body(p, f) {
    layer(p, (l) => {
      // open white blazer
      l.poly([[3, 64], [7, 57], [17, 52], [29, 50], [41, 50], [51, 52], [58, 57], [62, 64]], "w");
      l.each((x, y, k) => (k === "w" && x > 47 ? "W" : k === "w" && x > 41 && y > 58 ? "W" : null));
      // shirt + tie in the open front
      l.poly([[29, 50], [41, 50], [39, 64], [31, 64]], "W");
      l.poly([[34, 51], [37, 51], [38, 60], [36, 64], [33, 60]], "I");
      l.set(35, 52, "i").set(35, 54, "i").set(34, 56, "i");
      // lapels
      l.line(28, 50, 31, 64, "g").line(27, 51, 29, 64, "g");
      l.line(42, 50, 40, 64, "g").line(43, 51, 42, 64, "G");
      // shoulder seams + sleeve shading
      l.line(10, 57, 17, 53, "g").line(52, 53, 58, 57, "G");
      // gold buttons
      l.set(29, 60, "Y").set(30, 63, "Y").set(29, 59, "y");
    });
    // red rose tucked in the breast pocket (far chest)
    layer(p, (l) => {
      l.line(46, 60, 52, 60, "g");
      rose(l, 49, 57, "S");
      l.set(51, 59, "E").set(47, 59, "e");
    });
  },
  expr(p, f) {
    const iris: Iris = { D: "I", M: "i", L: "j", K: "0" };
    if (f === 0) {
      // serene, half-lidded, gazing off-camera to the right
      eye(p, lookAside(lidded(EYE_NEAR, 3), 2), NEAR_X, EYE_Y, iris);
      eye(p, lookAside(lidded(EYE_FAR, 3), 2), FAR_X, EYE_Y, iris);
      p.put(
        `
....1
.111.
`,
        38,
        45,
      );
      blush(p, 20, 40, 2);
    } else {
      // finally looking at you: sparkling, gentle smile
      eye(p, EYE_NEAR, NEAR_X, EYE_Y, iris, sparkly);
      eye(p, EYE_FAR, FAR_X, EYE_Y, iris, sparkly);
      p.put(
        `
1....1
.1111.
`,
        37,
        44,
      );
      blush(p, 19, 40, 4);
      blush(p, 46, 40, 2);
    }
    // long lashes: flicks off the outer corners
    p.set(19, 25, "0").set(18, 24, "0").set(17, 24, "0").set(19, 27, "0").set(18, 27, "0").set(17, 28, "0");
    p.set(48, 25, "0").set(49, 24, "0").set(48, 27, "0").set(49, 27, "0");
    p.set(46, 39, "k").set(46, 40, "k").set(45, 40, "t");
  },
  crown(l) {
    l.ellipse(33, 18, 21, 15, "j");
    l.each((x, y, k) => (y > 12 ? "." : x > 44 && k === "j" ? "g" : null));
  },
  bangs(l, f) {
    const h = SENPAI_HAIR;
    // near side lock falling in front of the ear
    strand(l, [[16, 13], [12, 26], [12, 40], [15, 52]], 8, 2, h);
    // side-swept fringe: every lock sweeps from the parting down to the right
    strand(l, [[20, 8], [21, 16], [22, 23]], 8, 1, h);
    strand(l, [[24, 7], [27, 15], [30, 22]], 9, 1, h);
    strand(l, [[28, 6], [33, 14], [36, 21]], 9, 1, h);
    // THE lock: sweeps across and hides the far eye
    if (f === 0) strand(l, [[29, 6], [36, 13], [41, 22], [44, 31], [45, 40]], 13, 2, h, { shadeAt: 0.25 });
    // f1: the lock has slid just enough for the far eye to peek out
    else strand(l, [[30, 6], [39, 12], [46, 21], [49, 31], [49, 40]], 11, 2, h, { shadeAt: 0.25 });
    strand(l, [[36, 7], [44, 11], [50, 20], [52, 32]], 9, 2, h, { shadeAt: 0.1 });
    strand(l, [[41, 8], [49, 13], [53, 24], [53, 42], [51, 54]], 7, 3, h, { shadeAt: 0.0 });
    if (f === 0) {
      // loose strands caught by the wind
      strand(l, [[17, 12], [11, 11], [5, 13]], 3, 1, h);
    }
  },
  extras(p, f) {
    if (f === 0) {
      // petals on the wind
      for (const [x, y] of [[4, 38], [10, 30], [58, 30], [54, 44]] as [number, number][]) p.set(x, y, "r").set(x + 1, y, "R").set(x, y + 1, "R");
      p.put(TWINKLE, 50, 32);
      p.put(TWINKLE_S, 3, 20);
    } else {
      // the rose, offered to YOU (stem rising from below the frame)
      layer(p, (l) => {
        strand(l, [[54, 58], [50, 64]], 3, 2, { base: "E", light: "e" });
        leaf(l, 53, 60, 46, 59, 2);
        rose(l, 55, 53, "L");
      });
      p.put(TWINKLE, 0, 28);
      p.put(TWINKLE, 57, 37);
      p.put(TWINKLE_S, 26, 0);
      p.put(TWINKLE_S, 44, 44);
      p.put(TWINKLE_S, 1, 58);
    }
  },
  post(p, f) {
    // screentone: a soft diagonal band of dots in the empty background
    dotsInto(p, "j", (x, y) => {
      const t = (x - y + 64) / 128;
      return x % 3 === 0 && y % 3 === (x % 2) && (f === 1 ? t > 0.55 || t < 0.25 : t > 0.6);
    });
  },
};

// ============================================================================ tiny glyphs (stickers, badges, status windows)
const GLYPHS3: Record<string, string> = {
  H: "x.x|xxx|x.x",
  E: "xxx|xx.|xxx",
  L: "x..|x..|xxx",
  O: "xxx|x.x|xxx",
};
const DIGITS5: Record<string, string> = {
  "#": ".x.x.|xxxxx|.x.x.|xxxxx|.x.x.",
  "4": "x.x|x.x|xxx|..x|..x",
  "7": "xxx|..x|.x.|.x.|.x.",
  "?": "xx.|..x|.x.|...|.x.",
};
/** Write `text` with a tiny glyph table at (x, y) in key `k` (1px gap). */
function write(p: Pix, text: string, x: number, y: number, k: string, table: Record<string, string>): number {
  let cx = x;
  for (const ch of text) {
    const g = table[ch];
    if (!g) {
      cx += 2;
      continue;
    }
    const rs = g.split("|");
    rs.forEach((r, yy) => [...r].forEach((c, xx) => c === "x" && p.set(cx + xx, y + yy, k)));
    cx += rs[0].length + 1;
  }
  return cx;
}

const STAT_GLYPHS: Record<string, string> = {
  L: "x..|x..|x..|x..|xxx",
  V: "x.x|x.x|x.x|x.x|.x.",
  S: "xx|x.|xx|.x|xx",
  T: "xxx|.x.|.x.|.x.|.x.",
  A: "xxx|x.x|xxx|x.x|x.x",
  U: "x.x|x.x|x.x|x.x|xxx",
};

// ============================================================================ MAGICAL GIRL #47
const MG_HAIR: StrandKeys = { base: "v", shade: "u", light: "w", deep: "U" };
const HEART_CLIP = `
.pp.pp.
pqqppPp
pqppppP
.ppppP.
..pPP..
...P...
`;
const HEART_BIG = `
..ppp...ppp..
.pqqqp.pqppP.
pqwwqpppqppPP
pqwqppppppPPP
pqqpppppppPPP
.pppppppppPP.
..ppppppPPP..
...ppppPPP...
....ppPPP....
.....pPP.....
......P......
`;
const MAGICAL_GIRL_47: PDef = {
  hair: MG_HAIR,
  hairLine: "U",
  shine: { key: "w", core: "w", on: ["v", "u"] },
  back(p) {
    // sensible shoulder-length bob, ends flicking out (perfectly symmetrical)
    layer(p, (l) => {
      l.ellipse(33, 26, 22, 21, "u");
      l.poly([[12, 28], [54, 28], [56, 49], [10, 49]], "u");
      l.each((x, y, k) => (k === "u" && (x < 16 || x > 50) && y > 30 ? "U" : null));
    });
    layer(p, (l) => {
      strand(l, [[13, 40], [9, 48], [5, 51]], 6, 2, MG_HAIR);
      strand(l, [[53, 40], [57, 48], [61, 51]], 6, 2, MG_HAIR, { shadeAt: 0.0 });
    });
  },
  body(p, f) {
    layer(p, (l) => {
      // mint bodice + puffy white sleeves
      l.poly([[5, 64], [10, 57], [19, 53], [29, 51], [41, 51], [49, 53], [56, 57], [61, 64]], "m");
      l.each((x, y, k) => (k === "m" && x > 46 ? "e" : k === "m" && x < 20 + (y - 52) * 0.4 ? "w" : null));
      l.ellipse(8, 60, 7, 5, "w");
      l.ellipse(58, 60, 7, 5, "W");
      l.each((x, y, k) => (k === "w" && x > 10 && y > 61 ? "W" : k === "W" && x > 60 && y > 61 ? "g" : null));
      // scalloped white collar
      for (let i = 0; i < 6; i++) l.ellipse(23 + i * 4, 52.5, 2.4, 2, i < 3 ? "w" : "W");
    });
    layer(p, (l) => {
      // HELLO my name is: red band, white letters, an illegible scribble
      l.rect(9, 54, 21, 10, "w");
      l.rect(9, 54, 21, 5, "r");
      l.each((x, y, k) => (k === "r" && y === 58 ? "R" : null));
    });
    write(p, "HELLO", 10, 55, "w", GLYPHS3);
    p.set(26, 55, "w").set(28, 55, "w").set(26, 57, "w").set(27, 57, "w").set(28, 57, "w");
    // scribble (3 rows of messy G)
    p.line(11, 61, 13, 60, "G").line(13, 60, 15, 62, "G").line(15, 62, 18, 60, "G").line(18, 60, 19, 61, "G").line(19, 61, 22, 60, "G").line(22, 60, 24, 62, "G");
    p.set(26, 61, "G").set(27, 60, "G");
    p.rect(9, 63, 21, 1, "g");
    // gold #47 badge
    layer(p, (l) => {
      l.ellipse(44, 58, 8.2, 5.2, "y");
      l.each((x, y, k) => (k === "y" && x + y > 107 ? "Y" : k === "y" && x + y < 95 ? "z" : null));
    });
    write(p, "#47", 38, 56, "O", DIGITS5);
    if (f === 1) {
      // the raised arm holding the wand up
      layer(p, (l) => {
        strand(l, [[59, 62], [60, 48], [59, 30]], 6, 5, { base: "s", shade: "k", light: "t" });
        l.ellipse(60, 60, 5, 4.5, "W");
      });
    }
  },
  expr(p, f) {
    const iris: Iris = { D: "U", M: "u", L: "v", K: "n" };
    if (f === 0) {
      // standard eyes, standard hopeful smile
      eye(p, EYE_NEAR, NEAR_X, EYE_Y, iris);
      eye(p, EYE_FAR, FAR_X, EYE_Y, iris);
      p.put(
        `
1....1
.1RR1.
..11..
`,
        36,
        43,
      );
      blush(p, 19, 40, 4);
      blush(p, 46, 40, 2);
    } else {
      // the wink every magical girl does, mid-shout
      eye(p, EYE_NEAR, NEAR_X, EYE_Y, iris, sparkly);
      eye(p, EYE_ARC, FAR_X, EYE_Y, iris);
      p.put(
        `
.111111.
1wwwwww1
10000001
10RRRR01
.1RqqR1.
..1111..
`,
        36,
        42,
      );
      blush(p, 18, 40, 5);
      blush(p, 45, 40, 3);
    }
    p.set(46, 39, "k").set(46, 40, "k").set(45, 40, "t");
  },
  crown(l) {
    l.ellipse(33, 18, 21, 15, "v");
    l.each((x, y, k) => (y > 12 ? "." : x > 44 && k === "v" ? "u" : null));
  },
  bangs(l) {
    const h = MG_HAIR;
    // bob sides, symmetrical
    strand(l, [[16, 13], [12, 26], [12, 38], [15, 46]], 9, 4, h);
    strand(l, [[50, 13], [54, 26], [54, 38], [51, 46]], 9, 4, h, { shadeAt: 0.0 });
    // an evenly spaced, perfectly regulation fringe
    for (let i = 0; i < 7; i++) {
      const x = 20 + i * 4.5;
      strand(l, [[x, 7], [x, 15], [x, 22]], 7, 2, h, { shadeAt: i > 4 ? 0.0 : 0.35 });
    }
  },
  extras(p, f) {
    // the one heart clip
    layer(p, (l) => l.put(HEART_CLIP, 14, 10));
    if (f === 0) {
      // hopeful sweat drop
      layer(p, (l) =>
        l.put(
          `
..a..
.aaa.
aawaa
aaaac
.acc.
`,
          49,
          29,
        ),
      );
      p.put(TWINKLE_S, 4, 22);
    } else {
      // heart wand thrust up
      layer(p, (l) => {
        l.line(58, 30, 56, 14, "g");
        l.line(59, 30, 57, 14, "W");
        l.put(HEART_BIG, 50, 2);
        l.ellipse(58, 31, 3.5, 3, "s");
      });
      // ribbons swirling
      layer(p, (l) => {
        strand(l, [[0, 46], [6, 34], [4, 22], [10, 12], [20, 4]], 3, 3, { base: "p", shade: "P", light: "q" });
        strand(l, [[1, 60], [7, 50], [2, 40], [6, 30]], 3, 2, { base: "m", shade: "e", light: "w" });
      });
      p.put(TWINKLE, 42, 12);
      p.put(TWINKLE, 0, 0);
      p.put(TWINKLE_S, 47, 0);
      p.put(TWINKLE_S, 2, 54);
    }
  },
};

// ============================================================================ ISEKAI-KUN
// Flatter shading than everyone else on purpose (2-tone hair, no gloss band),
// small plain eyes, a completely blank face. He is from a different, beiger art style.
const IK_HAIR: StrandKeys = { base: "h", shade: "H" };
/** Small plain eyes (vs the cast's huge ones). Near: outer corner on the left. */
const IK_EYE_NEAR = `
...0000.
.0000000
..WdddW.
..WdwdW.
..WHddW.
..WHHHW.
...kkk..
`;
const IK_EYE_FAR = `
0000...
000000.
WdddW..
WdwdW..
WHddW..
WHHHW..
.kkk...
`;
const NUM3: Record<string, string> = {
  "9": "xxx|x.x|xxx|..x|xxx",
  "8": "xxx|x.x|xxx|x.x|xxx",
  "0": "xxx|x.x|x.x|x.x|xxx",
  "1": ".x.|xx.|.x.|.x.|xxx",
};
const ISEKAI_KUN: PDef = {
  hair: IK_HAIR,
  hairLine: "H",
  shine: { key: "h", core: "h", on: [] },
  noShine: true,
  bg(p, f) {
    if (f !== 1) return;
    // a glowing status window floating behind him, full of numbers
    layer(p, (l) => {
      l.rect(1, 0, 62, 42, "w");
      l.rect(2, 1, 60, 40, "A");
      l.rect(2, 1, 60, 7, "U");
      l.rect(2, 8, 60, 1, "v");
    });
    write(p, "LV", 3, 2, "w", STAT_GLYPHS);
    write(p, "9999999999999", 11, 2, "z", NUM3);
    for (let row = 0; row < 5; row++) {
      const y = 11 + row * 6;
      for (let x = 4; x < 60; x += 4) {
        if (x > 12 && x < 52 && y > 6) continue; // hidden behind him anyway
        write(p, row % 2 ? "9" : "8", x, y, row === 0 ? "w" : "v", NUM3);
      }
    }
  },
  back(p) {
    // hood behind the neck + the (flat) back of the head
    layer(p, (l) => {
      l.ellipse(33, 52, 20, 9, "h");
      l.each((x, y, k) => (k === "h" && x > 44 ? "H" : null));
    });
    layer(p, (l) => {
      l.ellipse(33, 25, 20, 19, "H");
    });
  },
  body(p) {
    layer(p, (l) => {
      // grey adventurer cape over the shoulders (2 tones, flat)
      l.poly([[2, 64], [6, 56], [16, 52], [48, 52], [58, 56], [62, 64]], "G");
      l.each((x, y, k) => (k === "G" && x > 46 ? "2" : null));
      // beige hoodie front
      l.poly([[16, 64], [20, 54], [28, 51], [42, 51], [48, 54], [50, 64]], "B");
      l.each((x, y, k) => (k === "B" && x > 42 ? "h" : null));
      // hood rim
      l.line(24, 52, 30, 50, "h").line(40, 50, 46, 53, "H");
    });
    // hoodie strings with aglets
    p.line(31, 52, 30, 61, "w").line(39, 52, 40, 61, "w");
    p.set(30, 62, "g").set(40, 62, "g");
  },
  expr(p, f) {
    const iris: Iris = { D: "d", M: "H", L: "h", K: "0" };
    eye(p, IK_EYE_NEAR, NEAR_X + 3, EYE_Y + 4, iris);
    eye(p, IK_EYE_FAR, FAR_X + 1, EYE_Y + 4, iris);
    // "huh?" - a tiny blank open mouth (the SAME in both frames)
    p.put(
      `
.11.
1RR1
.11.
`,
      39,
      44,
    );
    p.set(46, 39, "k").set(46, 40, "k");
  },
  crown(l) {
    // no volume at all: the hair sits flat on the skull
    l.ellipse(33, 19, 20, 13, "h");
    l.each((x, y, k) => (y > 13 ? "." : x > 44 && k === "h" ? "H" : null));
  },
  bangs(l) {
    const h = IK_HAIR;
    strand(l, [[16, 14], [13, 26], [14, 36]], 7, 3, h);
    strand(l, [[50, 14], [53, 26], [52, 36]], 7, 3, h, { shadeAt: 0.0 });
    // a plain, flat fringe
    for (let i = 0; i < 6; i++) {
      const x = 20 + i * 5.4;
      strand(l, [[x, 8], [x, 16], [x + 0.5, 22]], 9, 5, h, { shadeAt: 0.6 });
    }
  },
  extras(p, f) {
    if (f === 0) {
      // tiny "?"
      layer(p, (l) => write(l, "?", 54, 2, "w", DIGITS5));
    } else {
      layer(p, (l) =>
        l.put(
          `
..a..
..a..
.aaa.
aawac
aaaac
.acc.
`,
          55,
          21,
        ),
      );
      p.put(TWINKLE, 6, 44);
    }
  },
};

// ============================================================================ TRUCK-KUN (front-on)
/** A huge painted anime eye: gradient iris (dark top -> light bottom), pupil, catch-lights, thick lid + lashes. */
function bigEye(p: Pix, cx: number, cy: number, rx: number, ry: number, outerLeft: boolean, star: boolean): void {
  const e = new Pix(64, 64);
  e.ellipse(cx, cy, rx + 1, ry + 0.6, "W");
  e.ellipse(cx, cy + 0.5, rx, ry, (x, y) => {
    const t = (y - (cy - ry)) / (2 * ry);
    return t < 0.34 ? "U" : t < 0.7 ? "u" : "v";
  });
  e.ellipse(cx, cy + 1, rx * 0.42, ry * 0.42, "n");
  e.ellipse(cx, cy + 1, rx * 0.42 - 1, ry * 0.42 - 1, "0");
  // lid: thick band over the top, flicking out into lashes at the outer corner
  for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
    const nx = (x - cx) / (rx + 1);
    if (Math.abs(nx) > 1) continue;
    const y = Math.round(cy - (ry + 0.6) * Math.sqrt(1 - nx * nx));
    e.set(x, y, "0").set(x, y + 1, "0");
  }
  const ox = outerLeft ? -1 : 1;
  const ex = Math.round(cx + ox * (rx + 1));
  const ey = Math.round(cy - ry * 0.35);
  e.line(ex, ey, ex + ox * 3, ey - 3, "0").line(ex, ey + 2, ex + ox * 4, ey, "0").line(ex, ey + 4, ex + ox * 3, ey + 4, "0");
  // catch-lights
  const hx = Math.round(cx - rx * 0.4);
  const hy = Math.round(cy - ry * 0.35);
  if (star) {
    e.line(hx, hy - 3, hx, hy + 3, "w").line(hx - 3, hy, hx + 3, hy, "w");
    e.rect(hx - 1, hy - 1, 3, 3, "w");
  } else e.rect(hx - 1, hy - 1, 3, 3, "w");
  e.set(Math.round(cx + rx * 0.45), Math.round(cy + ry * 0.45), "w").set(Math.round(cx + rx * 0.45) - 1, Math.round(cy + ry * 0.45), "w");
  // lower lid
  e.line(Math.round(cx - rx * 0.6), Math.round(cy + ry + 1), Math.round(cx + rx * 0.6), Math.round(cy + ry + 1), "k");
  p.put(e, 0, 0);
}

// The cab fills the frame: windshield = giant painted anime eyes with lashes,
// grille = the mouth, headlights = blushing cheeks, mirrors = ears.
function truckPortrait(f: number): Pix {
  const p = new Pix(64, 64);
  // tyres peeking out at the bottom corners
  layer(p, (l) => {
    l.rect(5, 55, 9, 9, "0");
    l.rect(50, 55, 9, 9, "0");
    l.rect(7, 57, 5, 7, "2");
    l.rect(52, 57, 5, 7, "2");
  });
  // side mirrors on stalks (ears)
  layer(p, (l) => {
    l.line(4, 20, 8, 20, "G").line(55, 20, 59, 20, "G");
    l.rect(0, 13, 5, 13, "2");
    l.rect(59, 13, 5, 13, "2");
    l.rect(1, 14, 3, 11, "v");
    l.rect(60, 14, 3, 11, "v");
    l.set(1, 14, "w").set(1, 15, "w").set(60, 14, "w").set(60, 15, "w");
  });
  // the cab
  const cab = layer(p, (l) => {
    l.poly([[7, 9], [12, 3], [51, 3], [56, 9], [57, 56], [6, 56]], "w");
    l.each((x, y, k) => (k !== "w" ? null : x > 50 || y > 52 ? "g" : x > 44 || y > 48 ? "W" : null));
    // roof marker lights
    for (const x of [22, 28, 34, 40]) l.rect(x, 4, 3, 1, "o").set(x, 4, "y");
  });
  // windshield
  layer(p, (l) => {
    l.poly([[11, 9], [14, 7], [49, 7], [52, 9], [53, 33], [10, 33]], "a");
    l.each((x, y, k) => (k === "a" && (y > 30 || x > 49) ? "v" : null));
    // glare streaks
    l.line(13, 13, 17, 9, "w").line(13, 15, 19, 9, "w");
  });
  // eyes painted on the glass
  if (f === 0) {
    // friendly closed-eye '^ ^' smile
    for (const [cx, ox] of [[21, -1], [42, 1]] as [number, number][]) {
      const arc: [number, number][] = [[-7, 25], [-6, 22], [-4, 20], [-2, 19], [2, 19], [4, 20], [6, 22], [7, 25]];
      for (let i = 0; i + 1 < arc.length; i++) {
        p.line(cx + arc[i][0], arc[i][1], cx + arc[i + 1][0], arc[i + 1][1], "0");
        p.line(cx + arc[i][0], arc[i][1] + 1, cx + arc[i + 1][0], arc[i + 1][1] + 1, "0");
      }
      // lashes flicking out at the outer corner
      const ex = cx + ox * 7;
      p.line(ex, 23, ex + ox * 3, 21, "0").line(ex, 25, ex + ox * 3, 25, "0");
    }
  } else {
    bigEye(p, 21, 21, 6.5, 8, true, true);
    bigEye(p, 42, 21, 6.5, 8, false, true);
  }
  // wipers
  p.line(14, 32, 24, 30, "G").line(38, 32, 48, 30, "G");
  // front panel: racing stripe + winged-heart emblem
  p.rect(7, 36, 50, 2, "u");
  p.rect(7, 38, 50, 1, "U");
  layer(p, (l) =>
    l.put(
      `
qq.p.p.qq
.qqpppqq.
...qpq...
....p....
`,
      27,
      35,
    ),
  );
  // headlights = cheeks
  for (const cx of [13, 50]) {
    layer(p, (l) => {
      l.ellipse(cx, 45, 5.5, 4.5, "y");
      l.each((x, y, k) => (k === "y" && x - cx + (y - 45) > 3 ? "Y" : k === "y" && x - cx + (y - 45) < -3 ? "z" : null));
      l.set(cx - 2, 43, "w").set(cx - 1, 43, "w").set(cx - 2, 44, "w");
    });
  }
  blush(p, 6, 50, 4);
  blush(p, 46, 50, 4);
  // grille = mouth
  if (f === 0) {
    layer(p, (l) => {
      l.poly([[23, 42], [41, 42], [40, 48], [36, 51], [28, 51], [24, 48]], "G");
      for (let y = 43; y <= 50; y += 2) l.each((x, yy, k) => (k === "G" && yy === y ? "2" : null));
    });
  } else {
    // grille flung open: shouting
    layer(p, (l) => {
      l.poly([[21, 41], [43, 41], [41, 50], [36, 54], [28, 54], [23, 50]], "0");
      l.rect(22, 41, 21, 2, "w");
      l.each((x, y, k) => (k === "0" && y > 49 ? "R" : k === "0" && y > 48 && x > 26 && x < 38 ? "R" : null));
      l.ellipse(32, 52, 4, 1.5, "r");
    });
  }
  // bumper + plate
  layer(p, (l) => {
    l.rect(5, 55, 54, 5, "G");
    l.rect(5, 55, 54, 1, "g");
    l.rect(5, 59, 54, 1, "2");
    l.rect(26, 56, 12, 4, "y");
    l.set(28, 57, "1").set(31, 57, "1").set(34, 57, "1").set(30, 58, "1").set(33, 58, "1");
  });
  // extras
  if (f === 0) {
    p.put(TWINKLE, 0, 8);
    p.put(TWINKLE_S, 60, 26);
    p.put(TWINKLE_S, 31, 0);
  } else {
    // headlights glaring
    p.put(TWINKLE, 10, 41);
    p.put(TWINKLE, 47, 41);
    // horn sound lines
    for (const [x, y, dx] of [[5, 2, -1], [58, 2, 1]] as [number, number, number][]) {
      p.line(x, y + 4, x + dx * 3, y, "w");
      p.line(x + dx * 2, y + 6, x + dx * 5, y + 3, "w");
    }
  }
  p.outline("1");
  if (f === 1) {
    // headlight beams fanning out of the frame from both cheeks
    for (const [cx, dir] of [[13, -1], [50, 1]] as [number, number][]) {
      const beam = (x: number, y: number, spread: number) => {
        const dx = (x - cx) * dir;
        return dx > 0 && Math.abs(y - 45) < dx * spread + 1.5;
      };
      dotsInto(p, "w", (x, y) => beam(x, y, 0.12));
      dotsInto(p, "z", (x, y) => beam(x, y, 0.45));
    }
  }
  return p;
}

export const sprites: SpriteDef[] = [
  gridSprite("portrait_senpai", 64, 64, [paintS2(SENPAI, 0), paintS2(SENPAI, 1)], "center", { pal: PORTRAIT_PAL }),
  gridSprite("portrait_magical_girl_47", 64, 64, [paintS2(MAGICAL_GIRL_47, 0), paintS2(MAGICAL_GIRL_47, 1)], "center", { pal: PORTRAIT_PAL }),
  gridSprite("portrait_isekai_kun", 64, 64, [paintS2(ISEKAI_KUN, 0), paintS2(ISEKAI_KUN, 1)], "center", { pal: PORTRAIT_PAL }),
  gridSprite("portrait_truck_kun", 64, 64, [truckPortrait(0), truckPortrait(1)], "center", { pal: PORTRAIT_PAL }),
];
