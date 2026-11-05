/**
 * Shoujo Academy world art (owner: s2-stages-a): courtyard stone pavers,
 * school deco, the sakura tree and the two destructible props.
 * Art direction: docs/content/stages.md §2.
 *
 * Ground tiles: every tile carries grout on its top row and left column, and
 * its own slabs inside (layouts differ per frame), so ANY combination of
 * f0-6 tiles reads as one irregular flagstone courtyard with no seams. Slab
 * bevels are lit top-left / shaded bottom-right like everything else. f7
 * (running track) is a uniform 16px-periodic rubber texture with a lane line
 * on the same row of every tile, because the ground view groups it into big
 * noise regions. Contrast stays low so plum-outlined actors pop on top.
 */
import type { SpriteDef } from "../format";
import { spr } from "../sprites/world-util";
import { Cv, ground, rng, scatter, tileNoise, hash } from "./s2-stages-a-util";

// --------------------------------------------------------------------------
// ground palette (local: pale courtyard stone + rubber track)
// --------------------------------------------------------------------------
const STONE_PAL: Record<string, string> = {
  "3": "#e7e1f2", // slab base
  "4": "#ddd6ec", // slab bevel shade (bottom / right)
  "5": "#d2c9e4", // grout
  "6": "#f2eef9", // slab bevel light (top / left)
  "7": "#e1daee", // cooler slab
  "8": "#ece3ef", // warmer slab (pink lean)
  "9": "#d6cde6", // pits / wear
  // chalk + petals
  A: "#fdfbff", // white chalk
  D: "#f3bcd8", // pink chalk
  J: "#ffc3dd", // petal light
  K: "#f59cc4", // petal
  L: "#e07fae", // petal shade
  // running track
  M: "#d99782", // track base
  N: "#cf8a76", // track grain (shade)
  S: "#e3a590", // track grain (light)
  T: "#f7eee9", // lane line
  V: "#e9d3cb", // lane line edge / worn
};

type Slab = [number, number, number, number, string]; // x0, y0, x1, y1 (inclusive interior), tone

/** Slab layouts (interior rects). Grout is row 0 / column 0 plus any internal 1px gaps. */
const LAYOUTS: Record<string, Slab[]> = {
  // two long horizontal slabs
  B: [
    [1, 1, 15, 7, "3"],
    [1, 9, 15, 15, "7"],
  ],
  // two small slabs over one long one
  E: [
    [1, 1, 7, 7, "8"],
    [9, 1, 15, 7, "3"],
    [1, 9, 15, 15, "3"],
  ],
  // one long slab over two small ones
  F: [
    [1, 1, 15, 7, "7"],
    [1, 9, 6, 15, "3"],
    [8, 9, 15, 15, "8"],
  ],
  // two tall slabs (off-centre split)
  C: [
    [1, 1, 9, 15, "3"],
    [11, 1, 15, 15, "7"],
  ],
  // one big slab
  A: [[1, 1, 15, 15, "3"]],
  // four squares
  D: [
    [1, 1, 7, 7, "3"],
    [9, 1, 15, 7, "7"],
    [1, 9, 7, 15, "8"],
    [9, 9, 15, 15, "3"],
  ],
};

function pavers(layout: string, seed: number, pits = 3): Cv {
  const c = new Cv(16, 16, "5");
  const r = rng(seed);
  for (const [x0, y0, x1, y1, tone] of LAYOUTS[layout]) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        let k = tone;
        const top = y === y0;
        const left = x === x0;
        const bot = y === y1;
        const right = x === x1;
        if ((top && !right) || (left && !bot)) k = "6";
        else if (bot || right) k = "4";
        c.set(x, y, k);
      }
    // soft wear: a couple of pits with a lit lip (top-left), a lighter fleck
    const area = (x1 - x0 - 1) * (y1 - y0 - 1);
    const n = Math.max(1, Math.round((pits * area) / 120));
    for (let i = 0; i < n; i++) {
      const x = x0 + 2 + Math.floor(r() * Math.max(1, x1 - x0 - 3));
      const y = y0 + 2 + Math.floor(r() * Math.max(1, y1 - y0 - 3));
      if (r() < 0.6) c.set(x, y, "9");
      else c.set(x, y, "6");
    }
  }
  return c;
}

/** Sakura petal stamps (light top-left, a shade pixel at the bottom-right). */
const PETALS = [
  `
JK
.L`,
  `
J.
KL`,
  `
.J
KK`,
  `
JKL`,
  `
J`,
  `
K`,
];

function tileAcademy(): Cv[] {
  const out: Cv[] = [];
  // f0-3 plain courtyard pavers
  out.push(pavers("B", 11));
  out.push(pavers("E", 23));
  out.push(pavers("F", 37));
  out.push(pavers("C", 41));
  // f4 fallen sakura petals (scattered on the slabs, never on the tile border)
  {
    const c = pavers("E", 53, 1);
    const r = rng(611);
    scatter(c, r, PETALS, 6, 1, "3467896");
    out.push(c);
  }
  // f5 chalk doodle: a heart with an arrow through it, on one big slab
  {
    const c = pavers("A", 67, 1);
    c.put(
      `
.........AA
..DD.DD.AA.
.D..D..DA..
.D.....AD..
..D...A.D..
...D.A.D...
....AD.....
...A.D.....
..A........
.AA........`,
      2,
      3,
    );
    out.push(c);
  }
  // f6 polish sparkle (a fresh-mopped glint on the four-square slabs)
  {
    const c = pavers("D", 79, 1);
    c.put(
      `
..A..
..w..
AwwwA
..w..
..A..`,
      9,
      2,
    );
    c.put(
      `
.A.
AwA
.A.`,
      3,
      10,
    );
    c.set(13, 12, "A");
    out.push(c);
  }
  // f7 running track: fine rubber grain (16px periodic) + a white lane line on row 8
  {
    const c = new Cv(16, 16, "M");
    c.each((x, y) => {
      const n = tileNoise(x, y, 4, 91) * 0.6 + hash(x, y, 7) * 0.4;
      if (n < 0.28) return "N";
      if (n > 0.74) return "S";
      return null;
    });
    for (let x = 0; x < 16; x++) {
      c.set(x, 8, "T");
      c.set(x, 9, hash(x, 9, 3) < 0.35 ? "V" : c.get(x, 9) === "S" ? "M" : c.get(x, 9));
    }
    // worn patches in the line (16px periodic so neighbours still join)
    c.set(5, 8, "V").set(12, 8, "V");
    out.push(c);
  }
  return out;
}

// --------------------------------------------------------------------------
// deco
// --------------------------------------------------------------------------

/** Petal piles: soft drifts of overlapping petals (lit tops, rosy undersides) plus a stray or two. */
const PILES = [
  `
........
........
........
...JJ...
..JKJJ..
.JKJKKJ.
.KLKLKL.
..LLLL..`,
  `
........
........
.....JK.
........
...JJJ..
.JJKJKJ.
JKKLKKLK
.LLLLLL.`,
  `
........
........
........
......J.
.JJ...K.
JKJK....
KLKL.JJ.
.LL.JKLK`,
  `
........
...w....
..wyw...
...wJ...
.JJKJJ..
JKJKKJK.
KLKLKLL.
.LLLLL..`,
];

function decoPetalPile(): Cv[] {
  return PILES.map((art) => ground(Cv.of(art)));
}

/** Trimmed hedge: flat clipped top face (lit), leafy front face, darker toward the roots. */
function decoHedge(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = new Cv(12, 10);
    const x0 = 1;
    const x1 = 10;
    const top = 2;
    const bot = 8;
    for (let y = top; y <= bot; y++)
      for (let x = x0; x <= x1; x++) {
        if ((y === top || y === bot) && (x === x0 || x === x1)) continue;
        const n = hash(x, y, 31 + f * 7);
        let k: string;
        if (y <= top + 1) k = y === top ? (n < 0.35 ? "m" : "l") : n < 0.2 ? "m" : "l"; // clipped top
        else if (y === top + 2) k = n < 0.5 ? "e" : "E"; // crisp edge under the top
        else {
          const shade = x >= x1 - 1 || y >= bot - 1;
          k = shade ? (n < 0.55 ? "E" : "e") : n < 0.22 ? "l" : n < 0.78 ? "e" : "E";
        }
        c.set(x, y, k);
      }
    if (f === 1) {
      // fallen petals resting on the clipped top + one caught in the leaves
      c.set(3, 2, "q").set(4, 3, "p").set(7, 2, "q").set(8, 3, "q").set(5, 6, "q");
    }
    c.selout({ m: "E", l: "E", e: "E", E: "1", q: "E", p: "E" }, "1");
    frames.push(ground(c));
  }
  return frames;
}

/** Outdoor shoe locker: wooden cabinet with 2x3 little doors; a pink love letter sticks out of one. */
function decoShoeLocker(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = Cv.of(`
............
.BBBBBBBBBh.
.hhhhhhhhhH.
.HHHHHHHHHd.
.HhhhHhhhHd.
.HhhdHhhdHd.
.HhhhHhhhHd.
.HHHHHHHHHd.
.HhhhHhhhHd.
.HhhdHhhdHd.
.HhhhHhhhHd.
.HHHHHHHHHd.
.HhhhHhhhHd.
.HhhdHhhdHd.
.HhhhHhhhHd.
.dd......dd.`);
    // lit top edge of each door
    c.each((x, y, k) => (k === "h" && (y === 4 || y === 8 || y === 12) && x !== 4 && x !== 8 ? "B" : null));
    // the love letter (pink envelope + red heart seal) wedged in a door
    const [lx, ly] = f === 0 ? [6, 8] : [2, 12];
    c.put(
      `
qqq
prq`,
      lx,
      ly,
    );
    if (f === 1) {
      // second variant: one door hanging open (dark inside, a shoe heel)
      c.put(
        `
222
2W2
2W2`,
        6,
        4,
      );
      c.set(9, 4, "h").set(9, 5, "h").set(9, 6, "H");
    }
    c.selout({ h: "d", H: "d", B: "d", d: "1", q: "P", p: "P", r: "R" }, "1");
    frames.push(ground(c));
  }
  return frames;
}

/** Sign on a post: f0 'NO RUNNING' pictogram (red ring + slash over a running figure), f1 a blue arrow sign. */
function decoSchoolSign(): Cv[] {
  // white board, red ring + slash, navy runner (head, torso + arm, two legs)
  const a = Cv.of(`
.GGGGGG.
GwrrrrwG
GrrwnwrG
GrwrnnrG
GrwnrnrG
GrnwwrrG
GwrrrrwG
.G2gG2G.
...gG...
...gG...
...gG...
..2gG2..`);
  const b = Cv.of(`
........
.uuuuuu.
.uuuwuU.
.wwwwwU.
.wwwwwwU
.uuuwuU.
.uuuuuU.
.UUUUUU.
...gG...
...gG...
...gG...
..gGGG..`);
  b.each((x, y, k) => (k === "u" && y === 1 && x < 6 ? "v" : null));
  b.selout({ u: "U", U: "n", v: "U", w: "U", g: "2", G: "2" }, "1");
  return [ground(a), ground(b)];
}

/** Lamp post: warm globe under a dark cap, slim pole, footed base. f1 = glow flicker (dimmer). */
function decoSchoolLamp(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = Cv.of(`
......
..22..
.2GG2.
.zwwz.
.zwwy.
.yzyY.
..2G..
..G2..
..G2..
..G2..
..G2..
..G2..
..G2..
..G2..
.2GG2.
.2222.`);
    if (f === 1)
      c.put(
        `
yzzy
yzyY
YyYO`,
        1,
        3,
      );
    c.selout({ z: "O", w: "Y", y: "O", Y: "O", G: "1", "2": "1" }, "1");
    frames.push(ground(c));
  }
  return frames;
}

// --------------------------------------------------------------------------
// sakura tree (32x40): fluffy pale-pink blossom canopy with gaps that show the
// dark curvy branches, a few falling petals. Canopy centre ~ (16, 15),
// manifest canopy { r: 17, h: 24 } from the feet at row 39.
// --------------------------------------------------------------------------
function decoSakuraTree(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = new Cv(32, 40);
    const sway = f;
    // trunk: dark S-curve with flared roots; lit left edge (H), base d, purple shade (2) on the right
    for (let y = 39; y >= 20; y--) {
      const t = (39 - y) / 19;
      const sx = 15.6 + Math.sin(t * 3.4 + 0.2) * 1.7 - t * 0.4;
      const w = y > 36 ? 1.7 + (y - 36) * 0.65 : 1.5 - t * 0.3;
      for (let x = Math.floor(sx - w - 0.5); x <= Math.ceil(sx + w + 0.5); x++) {
        const u = (x + 0.5 - (sx - w)) / (2 * w);
        if (u < 0 || u > 1) continue;
        c.set(x, y, u < 0.3 ? "H" : u < 0.72 ? "d" : "2");
      }
    }
    // a knot
    c.set(15, 31, "2");
    // branches (the canopy covers most of them; the hollows reveal them)
    const branch = (pts: [number, number][], k: string, k2?: string) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
        for (let s = 0; s <= n; s++) {
          const x = Math.round(ax + ((bx - ax) * s) / n);
          const y = Math.round(ay + ((by - ay) * s) / n);
          c.set(x, y, k);
          if (k2) c.set(x, y + 1, k2);
        }
      }
    };
    const LB: [number, number][] = [
      [15, 22],
      [12, 20],
      [9, 19],
      [6, 17],
      [3, 16],
    ];
    const RB: [number, number][] = [
      [16, 22],
      [19, 20],
      [22, 19],
      [25, 17],
      [28, 16],
    ];
    const MB: [number, number][] = [
      [16, 21],
      [16, 16],
      [15, 11],
    ];
    branch(LB, "d", "2");
    branch(RB, "d", "2");
    branch(MB, "d");
    // canopy: a wide umbrella of blossom clusters, back row first, front row last
    const puffs: [number, number, number][] = [
      [10, 7.5, 4.6],
      [17.5, 5.5, 5],
      [24, 8, 4.6],
      [5, 13, 4],
      [12, 11.5, 5.4],
      [20.5, 11.5, 5.4],
      [27.5, 13.5, 3.9],
      [7.5, 17.5, 3.7],
      [15.5, 17, 4.6],
      [23.5, 17.5, 3.7],
    ];
    const RAMP = "Pppqqqqt";
    for (const [px, py, pr] of puffs) {
      const sx = px + (py < 10 ? sway : py < 15 ? sway * 0.5 : 0);
      c.ball(sx, py, pr, pr * 0.84, RAMP, { bias: -0.02 });
    }
    // hollows under the canopy: deep shade where the branches show through
    const gaps: [number, number, number][] = [
      [11.5, 20.2, 1.7],
      [19.8, 20.2, 1.7],
    ];
    for (const [gx, gy, gr] of gaps)
      c.each((x, y, k) => (k !== "." && Math.hypot(x - gx, (y - gy) * 1.4) <= gr ? "Q" : null));
    branch(LB.slice(0, 3), "d");
    branch(RB.slice(0, 3), "d");
    // blossom texture: tiny bright florets on the lit side, deeper dots in the shade
    for (let y = 1; y < 24; y++)
      for (let x = 1; x < 31; x++) {
        const k = c.get(x, y);
        const h = hash(x, y, 77);
        if (k === "t" && h < 0.12) c.set(x, y, "w");
        else if (k === "q" && h < 0.07) c.set(x, y, "t");
        else if (k === "p" && h < 0.1) c.set(x, y, "q");
        else if (k === "p" && h > 0.92) c.set(x, y, "P");
      }
    // selective outline: deep-pink rim on the blossoms, plum on the wood
    c.selout({ t: "P", w: "P", q: "P", p: "Q", P: "Q", Q: "1", H: "1", d: "1", "2": "1" }, "1");
    // falling petals (drift right + fall between frames)
    // drifting petals: they flutter sideways with the breeze (and flip edge-on) between the
    // two frames instead of bobbing; real falling petals come from the stage's ambient layer
    const fall: [number, number, number][] = [
      [2, 25, 1],
      [28, 23, 0],
      [26, 31, 1],
      [5, 33, 0],
      [21, 36, 0],
    ];
    for (const [x0, y, two] of fall) {
      const x = x0 + (f === 1 ? (x0 < 16 ? 1 : -1) : 0);
      const wide = f === 0 ? two : 1 - two;
      c.set(x, y, "q");
      if (wide) c.set(x + 1, y, "p");
    }
    // petals collected around the roots
    c.set(11, 39, "q").set(12, 39, "p").set(20, 39, "q").set(21, 39, "p").set(9, 39, "q");
    frames.push(c);
  }
  return frames;
}

// --------------------------------------------------------------------------
// props
// --------------------------------------------------------------------------

/** Classic school desk (3/4 view): wooden top with a carved heart, steel book box, tube legs. */
function propSchoolDesk(): Cv {
  const c = Cv.of(`
..............
...BBBBBBBBBB.
..BhhdhdhhhhH.
..hhdHHHHhhhH.
.hhhhdHHhhhH..
.hhhhhHhhhhH..
.HHHHHHHHHHd..
.gGGGGGGGGG2..
.gWWWWWWWWG2..
.g.GGGGGGG.2..
.g........g2..
.G........G...`);
  c.selout({ B: "d", h: "d", H: "d", d: "1", g: "2", G: "2", W: "G", "2": "1" }, "1");
  return ground(c);
}

/** Pastel drink vending machine: glowing can window, buttons, coin slot, pickup tray. f1 = light flicker. */
function propVending(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = Cv.of(`
............
.qqqqqqqqqP.
.qvvvvvvvpP.
.qvwavwavpP.
.qqqqqqqqpP.
.qaaaaaaapP.
.qayaraepbP.
.qaaaaaaapP.
.qaraeauapP.
.qaaaaaaapP.
.qaeauayapP.
.qaaaaaaapP.
.qqqqqqqqpP.
.qrryyccpqP.
.qqqqqqgGpP.
.qqqqqqqqpP.
.q222222qpP.
.q200002qpP.
.qqqqqqqqpP.
.PPPPPPPPPQ.`);
    // light the cans: a bright top pixel on each
    if (f === 1) {
      // flicker: the window and the header dim
      c.each((x, y, k) => (k === "a" ? "C" : k === "v" ? "u" : k === "w" ? "v" : null));
    }
    c.selout({ q: "P", p: "Q", P: "Q", Q: "1" }, "1");
    frames.push(ground(c));
  }
  return frames;
}

export const sprites: SpriteDef[] = [
  spr("tile_academy", 16, 16, tileAcademy(), "center", { pal: STONE_PAL, fps: 1 }),
  spr("deco_petal_pile", 8, 8, decoPetalPile(), "feet", { fps: 1, pal: STONE_PAL }),
  spr("deco_hedge", 12, 10, decoHedge(), "feet", { fps: 1 }),
  spr("deco_shoe_locker", 12, 16, decoShoeLocker(), "feet", { fps: 1 }),
  spr("deco_school_sign", 8, 12, decoSchoolSign(), "feet", { fps: 1 }),
  spr("deco_school_lamp", 6, 16, decoSchoolLamp(), "feet", { fps: 3 }),
  spr("deco_sakura_tree", 32, 40, decoSakuraTree(), "feet", { fps: 2 }),
  spr("prop_school_desk", 14, 12, [propSchoolDesk()], "feet", { fps: 1 }),
  spr("prop_vending", 12, 20, propVending(), "feet", { fps: 3 }),
];
