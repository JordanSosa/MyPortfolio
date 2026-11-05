/**
 * Hero bust portraits (owner: chars). 64x64, centre pivot, 2 expressions each.
 * f0 = select-screen expression, f1 = ultimate cut-in shout.
 *
 * Painted with the strand/shape toolkit in chars-util (tapered cel-shaded hair
 * locks, polygon masses, automatic hair cast-shadow on the face) plus
 * hand-pixelled anime eyes, mouths and accessories. All three share one face
 * construction (3/4 view facing right) so they read as one cast.
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

/** Turn round pupils into cat slits. */
function catSlit(tpl: string): string {
  const p = Pix.of(tpl, "cat-eye");
  // find iris rows containing pupil, keep a 1-2px vertical slit at the pupil centre
  let sx = 0;
  let n = 0;
  p.each((x, _y, k) => {
    if (k === "K") {
      sx += x;
      n++;
    }
    return null;
  });
  const cx = n ? Math.round(sx / n) : Math.floor(p.w / 2);
  p.each((x, y, k) => {
    if (k === "K" && x !== cx && !(x === cx - 1 && y >= 7 && y <= 8)) return "M";
    return null;
  });
  // extend the slit up/down a little
  for (let y = 4; y <= 11; y++) if ("DML".includes(p.get(cx, y))) p.set(cx, y, "K");
  return p.str();
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
/** Fierce: the lid slopes down toward the inner corner (near eye: right side, far eye: left side). */
const fierce = (tpl: string, near: boolean, n = 3) =>
  lidShape(tpl, (x, w) => (near ? (x / (w - 1)) * n : (1 - x / (w - 1)) * n) - 0.3);

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

const STAR9 = `
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

function paint(d: PortraitDef, f: number): Pix {
  const p = new Pix(64, 64);
  d.back(p, f);
  d.body(p, f);
  neckAndFace(p);
  d.expr(p, f);
  layer(p, (l) => d.crown(l), null);
  const bangs = layer(p, (l) => d.bangs(l, f), d.hairLine);
  castShadow(p, bangs);
  hairShine(p, 16, 45, (x) => 8 + Math.pow((x - 30) / 15, 2) * 5, d.shine.on, d.shine.key, d.shine.core);
  d.extras(p, f);
  p.outline("1");
  return p;
}

// ============================================================================ HOSHI
const HOSHI_HAIR: StrandKeys = { base: "p", shade: "P", light: "q", deep: "Q" };
const HOSHI: PortraitDef = {
  hair: HOSHI_HAIR,
  hairLine: "Q",
  shine: { key: "q", core: "~", on: ["p", "P", "Q", "q"] },
  back(p) {
    layer(p, (l) => {
      strand(l, [[12, 12], [5, 24], [3, 38], [6, 52], [3, 64]], 13, 8, HOSHI_HAIR);
      strand(l, [[52, 10], [59, 22], [61, 36], [58, 50], [61, 64]], 13, 8, HOSHI_HAIR, { shadeAt: 0.1 });
    });
    layer(p, (l) => {
      l.ellipse(33, 26, 21, 21, "P");
      l.poly([[13, 28], [53, 28], [54, 54], [12, 54]], "P");
      l.each((x, y, k) => (k === "P" && (x < 17 || x > 49) && y > 30 ? "Q" : null));
    });
  },
  body(p) {
    layer(p, (l) => {
      l.poly([[3, 64], [8, 57], [17, 53], [29, 51], [41, 51], [50, 53], [57, 57], [61, 64]], "W");
      l.each((x, y, k) => (k === "W" && x < 22 + (y - 52) * 0.5 ? "w" : null));
      l.poly([[17, 53], [30, 51], [33, 59], [25, 63], [14, 59]], "p");
      l.poly([[40, 51], [51, 53], [54, 59], [43, 63], [35, 59]], "P");
      l.line(16, 58, 25, 62, "w").line(43, 62, 52, 58, "W");
      l.ellipse(8, 61, 7, 5, "q");
      l.ellipse(58, 61, 7, 5, "p");
      l.each((x, y, k) => (k === "q" && x > 10 && y > 60 ? "p" : k === "p" && x > 60 && y > 60 ? "P" : null));
      // big yellow bow
      l.ellipse(29, 58, 5, 3.6, "y");
      l.ellipse(40, 58, 5, 3.6, "y");
      l.each((x, y, k) => (k === "y" && (y > 59 || x > 42) ? "Y" : null));
      l.poly([[31, 60], [28, 64], [32, 64], [33, 61]], "Y");
      l.poly([[37, 60], [40, 64], [36, 64], [35, 61]], "Y");
      l.rect(32, 56, 5, 5, "y");
      l.set(33, 57, "z").set(27, 57, "z").set(28, 56, "z").set(38, 57, "z");
    });
    p.line(31, 56, 31, 60, "O").line(37, 56, 37, 60, "O").line(26, 60, 28, 61, "O").line(40, 61, 43, 59, "O");
  },
  expr(p, f) {
    const iris: Iris = { D: "C", M: "c", L: "a", K: "n" };
    eye(p, f === 0 ? EYE_NEAR : fierce(EYE_NEAR, true, 2), NEAR_X, EYE_Y, iris);
    eye(p, f === 0 ? EYE_ARC : fierce(EYE_FAR, false, 2), FAR_X, EYE_Y, iris);
    p.set(46, 39, "k").set(46, 40, "k").set(45, 40, "t");
    if (f === 0) {
      p.put(
        `
11...11
.1RRR1.
..111..
`,
        37,
        44,
      );
    } else {
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
        43,
      );
    }
    blush(p, 19, 40, 4);
    blush(p, 46, 40, 2);
  },
  crown(l) {
    l.ellipse(33, 18, 21, 15, "p");
    l.each((x, y, k) => (y > 12 ? "." : x > 44 && k === "p" ? "P" : null));
  },
  bangs(l) {
    const h = HOSHI_HAIR;
    strand(l, [[15, 14], [12, 26], [12, 40], [14, 52]], 8, 1, h);
    strand(l, [[20, 9], [18, 18], [19, 24]], 9, 1, h);
    strand(l, [[25, 8], [24, 17], [26, 22]], 9, 1, h);
    strand(l, [[30, 7], [30, 16], [31, 22]], 9, 1, h);
    strand(l, [[35, 7], [35, 18], [34, 28]], 7, 1, h);
    strand(l, [[40, 7], [41, 16], [40, 22]], 9, 1, h);
    strand(l, [[45, 9], [46, 17], [45, 23]], 8, 1, h);
    strand(l, [[49, 11], [51, 19], [50, 25]], 7, 1, h);
    strand(l, [[49, 14], [53, 26], [53, 40], [50, 50]], 6, 1, h, { shadeAt: 0.0 });
  },
  extras(p, f) {
    layer(p, (l) => strand(l, [[34, 6], [31, 1], [36, 0]], 3, 1, HOSHI_HAIR));
    p.put(STAR9, 6, 6);
    p.put(STAR9, 49, 4);
    if (f === 1) {
      p.line(21, 21, 29, 23, "Q").line(21, 20, 28, 22, "Q");
      p.line(39, 23, 46, 21, "Q").line(40, 23, 46, 22, "Q");
      p.put(TWINKLE, 1, 20);
      p.put(TWINKLE, 55, 38);
      p.put(TWINKLE_S, 9, 44);
      p.put(TWINKLE_S, 57, 20);
    } else {
      p.put(TWINKLE, 53, 25);
      p.put(TWINKLE_S, 49, 34);
    }
  },
};

// ============================================================================ RIN
const RIN_HAIR: StrandKeys = { base: "x", shade: "X", light: "f", deep: "0" };
const RIN: PortraitDef = {
  hair: RIN_HAIR,
  hairLine: "0",
  shine: { key: "f", core: "j", on: ["x", "X", "0", "f"] },
  back(p) {
    // high ponytail sweeping down the left side
    layer(p, (l) => {
      strand(l, [[16, 9], [8, 12], [4, 24], [5, 40], [3, 56], [5, 64]], 14, 8, RIN_HAIR, { shadeAt: 0.25 });
    });
    // big red ribbon at the tie
    layer(p, (l) => {
      l.poly([[14, 9], [2, 2], [0, 9], [4, 14]], "r");
      l.poly([[14, 9], [19, 0], [25, 3], [20, 12]], "r");
      l.poly([[12, 10], [8, 22], [11, 22], [14, 11]], "R");
      l.poly([[15, 11], [17, 21], [20, 20], [16, 10]], "R");
      l.each((x, y, k) => (k === "r" && (y > 10 || (x > 20 && y > 5)) ? "R" : null));
      l.line(2, 4, 8, 7, "q").line(20, 3, 23, 4, "q");
      l.ellipse(14, 9.5, 2.5, 2.5, "r");
      l.set(13, 9, "q");
    });
    // long back hair
    layer(p, (l) => {
      l.ellipse(33, 26, 21, 21, "X");
      l.poly([[13, 28], [53, 28], [55, 64], [11, 64]], "X");
      l.each((x, y, k) => (k === "X" && (x < 16 || x > 50) && y > 30 ? "0" : null));
    });
  },
  body(p, f) {
    layer(p, (l) => {
      l.poly([[3, 64], [8, 56], [18, 52], [30, 50], [40, 50], [50, 52], [57, 56], [61, 64]], "W");
      l.each((x, y, k) => (k === "W" && x < 20 + (y - 52) * 0.6 ? "w" : k === "W" && x > 48 ? "g" : null));
      // kimono V collar: red under-collar, white over-collar bands
      l.poly([[29, 50], [41, 50], [36, 61]], "r");
      l.poly([[31, 50], [39, 50], [36, 57]], "R");
      l.line(28, 50, 35, 63, "w").line(29, 50, 36, 63, "w");
      l.line(42, 50, 37, 62, "g").line(41, 50, 36, 62, "W");
      // shoulder seam shading
      l.line(12, 57, 18, 54, "g").line(50, 54, 56, 57, "G");
    });
    if (f === 1) {
      // drawn katana flashing across the corner
      layer(p, (l) => {
        l.line(40, 63, 63, 40, "w");
        l.line(41, 63, 63, 41, "v");
        l.line(42, 63, 63, 42, "g");
      });
      p.put(TWINKLE, 53, 44);
    }
  },
  expr(p, f) {
    const iris: Iris = { D: "R", M: "r", L: "o", K: "0" };
    if (f === 0) {
      eye(p, lidded(EYE_NEAR, 3), NEAR_X, EYE_Y, iris);
      eye(p, lidded(EYE_FAR, 3), FAR_X, EYE_Y, iris);
      p.put(
        `
....1
111..
`,
        38,
        45,
      );
      blush(p, 20, 40, 2);
    } else {
      eye(p, fierce(EYE_NEAR, true, 4), NEAR_X, EYE_Y, iris, (e) => e.set(4, 11, "w"));
      eye(p, fierce(EYE_FAR, false, 4), FAR_X, EYE_Y, iris, (e) => e.set(6, 11, "w"));
      p.put(
        `
.1111111.
1wwwwwww1
100000001
10RRRRR01
.1RRrR01.
..11111..
`,
        35,
        43,
      );
      blush(p, 19, 40, 3);
      blush(p, 46, 40, 2);
    }
    p.set(46, 39, "k").set(46, 40, "k").set(45, 40, "t");
  },
  crown(l) {
    l.ellipse(33, 18, 21, 15, "x");
    l.each((x, y, k) => (y > 12 ? "." : x > 44 && k === "x" ? "X" : null));
  },
  bangs(l) {
    const h = RIN_HAIR;
    strand(l, [[16, 14], [13, 28], [13, 44], [14, 58]], 8, 4, h);
    strand(l, [[20, 9], [19, 18], [20, 23]], 9, 2, h);
    strand(l, [[25, 8], [25, 17], [27, 24]], 9, 2, h);
    strand(l, [[30, 7], [31, 16], [33, 25]], 9, 1, h);
    strand(l, [[35, 7], [37, 16], [38, 22]], 9, 2, h);
    strand(l, [[40, 7], [42, 16], [43, 23]], 9, 2, h);
    strand(l, [[45, 9], [47, 17], [48, 24]], 8, 2, h);
    strand(l, [[49, 13], [53, 26], [53, 42], [52, 56]], 7, 4, h, { shadeAt: 0.0 });
  },
  extras(p, f) {
    if (f === 1) {
      // fierce slanted brows + eye glint
      p.put(TWINKLE_S, 30, 27);
      p.put(TWINKLE_S, 48, 27);
      // sakura petals
      for (const [x, y] of [[3, 30], [58, 14], [8, 48], [55, 30]] as [number, number][])
        p.put(
          `
.qp
qpP
pP.
`,
          x,
          y,
        );
    } else {
      p.put(
        `
.qp
qpP
pP.
`,
        55,
        28,
      );
    }
  },
};

// ============================================================================ MOCHI
const MOCHI_HAIR: StrandKeys = { base: "F", shade: "h", light: "B", deep: "H" };
const PAW = `
...1111..1111...
..1BBBB11BBBB1..
.11BqqB11BqqB11.
1BB1BB1BB1BB1BB1
1BqqB1BBBB1BqqB1
1BqqBBBBBBBBqqB1
1BBBBBqqqqBBBBh1
1BBBBqqqqqqBBBh1
.1BBBqqqqqqBBhh1
.1BBBBqqqqBBBh1.
..1hBBBBBBBhh1..
...11hhhhhh11...
....1jjiiiiI1...
....1jiiiiII1...
....1jiiiiII1...
`;
const MOCHI: PortraitDef = {
  hair: MOCHI_HAIR,
  hairLine: "H",
  shine: { key: "B", core: "w", on: ["F", "h", "H", "B"] },
  back(p) {
    // hood behind the head
    layer(p, (l) => {
      l.ellipse(33, 44, 26, 16, "i");
      l.each((x, y, k) => (k === "i" && x > 44 ? "I" : k === "i" && x < 20 ? "j" : null));
    });
    // cat ears (behind the crown)
    const ear = (pts: [number, number][], inner: [number, number][]) =>
      layer(p, (l) => {
        l.poly(pts, "F");
        l.poly(inner, "q");
        l.each((x, y, k) => (k === "q" && y > 10 ? "b" : null));
      });
    ear([[12, 16], [10, 0], [26, 9]], [[14, 13], [12, 4], [22, 10]]);
    ear([[40, 8], [53, -1], [55, 15]], [[43, 9], [52, 3], [52, 12]]);
    // bob back hair
    layer(p, (l) => {
      l.ellipse(33, 27, 21, 20, "h");
      l.each((x, y, k) => (k === "h" && x > 48 ? "H" : null));
    });
  },
  body(p, f) {
    layer(p, (l) => {
      l.poly([[3, 64], [8, 55], [18, 51], [46, 51], [56, 55], [61, 64]], "i");
      l.each((x, y, k) => (k === "i" && x < 18 + (y - 52) * 0.4 ? "j" : k === "i" && x > 47 ? "I" : null));
      // drawstrings
      l.line(30, 52, 29, 61, "w").line(38, 52, 39, 61, "w");
      l.set(29, 62, "B").set(39, 62, "B").set(28, 62, "B").set(40, 62, "B");
      // paw print on the chest
      l.ellipse(34, 61, 2.5, 2, "q");
      l.set(31, 58, "q").set(34, 57, "q").set(37, 58, "q");
    });
    if (f === 1) p.put(PAW, 47, 47);
  },
  expr(p, f) {
    const iris: Iris = { D: "O", M: "Y", L: "y", K: "0" };
    if (f === 0) {
      eye(p, catSlit(EYE_NEAR), NEAR_X, EYE_Y, iris);
      eye(p, catSlit(EYE_FAR), FAR_X, EYE_Y, iris);
      p.put(
        `
1..1..1
.11.11.
`,
        37,
        44,
      );
      blush(p, 19, 40, 4);
      blush(p, 46, 40, 2);
    } else {
      eye(p, catSlit(EYE_NEAR), NEAR_X, EYE_Y, iris, sparkly);
      eye(p, catSlit(EYE_FAR), FAR_X, EYE_Y, iris, sparkly);
      p.put(
        `
.111111.
10000w01
10000001
10RRRR01
.1RqqR1.
..1111..
`,
        36,
        43,
      );
      blush(p, 18, 40, 5);
      blush(p, 45, 40, 3);
    }
    p.set(46, 39, "k").set(46, 40, "k");
  },
  crown(l) {
    l.ellipse(33, 18, 21, 15, "F");
    l.each((x, y, k) => (y > 12 ? "." : x > 44 && k === "F" ? "h" : null));
  },
  bangs(l) {
    const h = MOCHI_HAIR;
    // bob sides curling in under the cheeks
    strand(l, [[16, 13], [11, 26], [12, 40], [18, 48]], 10, 4, h);
    strand(l, [[49, 12], [54, 25], [54, 38], [48, 47]], 9, 4, h, { shadeAt: 0.0 });
    // blunt fringe
    strand(l, [[20, 8], [19, 17], [20, 23]], 9, 3, h);
    strand(l, [[25, 7], [25, 16], [26, 23]], 9, 3, h);
    strand(l, [[30, 6], [30, 15], [31, 23]], 9, 3, h);
    strand(l, [[35, 6], [35, 15], [35, 24]], 9, 3, h);
    strand(l, [[40, 7], [41, 15], [41, 23]], 9, 3, h);
    strand(l, [[45, 8], [46, 16], [46, 23]], 8, 3, h);
    strand(l, [[49, 10], [51, 17], [50, 23]], 7, 2, h);
  },
  extras(p, f) {
    // fluffy ear tufts
    p.set(15, 12, "B").set(16, 11, "B").set(48, 11, "B").set(49, 10, "B");
    if (f === 1) {
      p.put(TWINKLE, 2, 26);
      p.put(TWINKLE_S, 58, 24);
      p.put(TWINKLE_S, 8, 46);
      p.put(TWINKLE, 27, 0);
    } else {
      p.put(TWINKLE_S, 56, 28);
    }
  },
};

const PORTRAIT_PAL = { "~": "#ffe3f1" };

export const sprites: SpriteDef[] = [
  gridSprite("portrait_hoshi", 64, 64, [paint(HOSHI, 0), paint(HOSHI, 1)], "center", { pal: PORTRAIT_PAL }),
  gridSprite("portrait_rin", 64, 64, [paint(RIN, 0), paint(RIN, 1)], "center", { pal: PORTRAIT_PAL }),
  gridSprite("portrait_mochi", 64, 64, [paint(MOCHI, 0), paint(MOCHI, 1)], "center", { pal: PORTRAIT_PAL }),
];
