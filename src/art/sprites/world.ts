/**
 * World art (owner: world): seamless meadow ground tiles, decoration and
 * destructible props.
 *
 * Ground tiles share one flat base colour; every detail (tufts, flowers,
 * clovers, glints, the worn patch) is a whole stamp kept at least 1px inside
 * the tile, so ANY combination of the 8 variants tiles seamlessly. Contrast
 * is kept low so actors (plum outlines) pop on top.
 *
 * f0-3 plain grass, f4 tiny flowers, f5 clover and f6 sparkle are "islands"
 * (details never touch the border). f7 (worn path) is a uniform periodic
 * texture instead, because src/view/ground.ts groups it into big contiguous
 * noise regions; it tiles with itself and borders grass softly.
 *
 * Deco uses soft green / coloured outlines so it reads crisply but stays a
 * step behind the plum-outlined actors.
 */
import type { SpriteDef } from "../format";
import { Cv, hash, spr } from "./world-util";

// --------------------------------------------------------------------------
// ground palette (local keys; the master palette has no low-contrast meadow ramp)
// --------------------------------------------------------------------------
const GROUND_PAL: Record<string, string> = {
  "3": "#8fd67d", // base
  "4": "#81cb79", // soft shade (cooler)
  "5": "#74c078", // deeper shade (blue-green)
  "6": "#9edd84", // light (warmer)
  "7": "#b2e78f", // tip highlight
  "8": "#d6f5c0", // pale glint
  S: "#a1d985", // worn grass (lighter, warmer)
  T: "#b3dd90", // bare soil (lightest)
  V: "#86cf7b", // trampled grass (slightly darker, cooler)
  A: "#c6bce6", // pastel pebble
  D: "#ebe6f8", // pebble light
  J: "#a69bcf", // pebble shade
};

/** Deco greens (soft, so tufts sit "in" the meadow rather than on it). */
const DECO_PAL: Record<string, string> = {
  K: "#5aae68", // blade shade
  L: "#7dca77", // blade
  M: "#a6e388", // blade lit
  N: "#cff3ac", // blade tip
  Z: "#3f8f58", // soft green outline
};

/** Small seeded RNG (mulberry32) for deterministic layouts. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Grass marks. Light from the top-left: lit tip '6'/'7', shaded base '4'/'5'.
const TUFTS = [
  `
4.4
.4.`,
  `
6.
4.
.4`,
  `
.6.
4.4`,
  `
6..
.4.
.44`,
  `
.7
.6
4.`,
  `
44`,
  `
6
4`,
];
const GRAIN = [
  `
4`,
  `
6`,
];

/** Place stamps at random free spots strictly inside the tile (1px margin, `gap` px apart). */
function scatter(c: Cv, r: () => number, stamps: string[], n: number, gap = 1): void {
  let placed = 0;
  for (let tries = 0; tries < 500 && placed < n; tries++) {
    const st = Cv.of(stamps[Math.floor(r() * stamps.length)]);
    const x = 1 + Math.floor(r() * (c.w - 2 - st.w + 1));
    const y = 1 + Math.floor(r() * (c.h - 2 - st.h + 1));
    let ok = true;
    for (let yy = -gap; yy < st.h + gap && ok; yy++)
      for (let xx = -gap; xx < st.w + gap; xx++)
        if (c.inb(x + xx, y + yy) && c.get(x + xx, y + yy) !== "3") {
          ok = false;
          break;
        }
    if (!ok) continue;
    c.put(st, x, y);
    placed++;
  }
}

/** Smooth value noise that repeats every 16 px: a `cells` x `cells` random lattice, wrapped. 0..1 */
function tileNoise(x: number, y: number, cells: number, seed: number): number {
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

function grass(seed: number, tufts: number, grain: number): Cv {
  const c = new Cv(16, 16, "3");
  const r = rng(seed);
  scatter(c, r, TUFTS, tufts, 2);
  scatter(c, r, GRAIN, grain, 1);
  return c;
}

function tileGround(): Cv[] {
  const out: Cv[] = [];
  // f0-3 plain grass: different tuft layouts + a little grain
  out.push(grass(11, 4, 3));
  out.push(grass(29, 5, 2));
  out.push(grass(47, 3, 4));
  out.push(grass(83, 4, 3));
  // f4 tiny flowers (hand placed)
  {
    const c = grass(101, 2, 2);
    c.put(
      `
.w.
wyw
.w4`,
      3,
      3,
    );
    c.put(
      `
.q.
qzq
.q4`,
      10,
      9,
    );
    c.put(
      `
j
4`,
      11,
      3,
    );
    c.put(
      `
w
4`,
      5,
      11,
    );
    out.push(c);
  }
  // f5 clover patches
  {
    const c = grass(131, 2, 1);
    c.put(
      `
.66.
6776
.664
..4.`,
      2,
      7,
    );
    c.put(
      `
66.
676
.64`,
      10,
      3,
    );
    c.put(
      `
6.
64`,
      11,
      11,
    );
    out.push(c);
  }
  // f6 sparkle grass: dewy glints
  {
    const c = grass(151, 3, 1);
    c.put(
      `
.8.
8w8
.8.`,
      9,
      4,
    );
    c.put(
      `
7
8`,
      4,
      10,
    );
    c.put(
      `
8`,
      12,
      12,
    );
    c.put(
      `
8`,
      3,
      3,
    );
    out.push(c);
  }
  // f7 worn path: a UNIFORM, 16px-periodic patchy-soil texture. The ground view groups f7 into
  // large contiguous regions, so it must tile with itself without any per-tile focal point,
  // and stay low-contrast so the stair-stepped region border against grass reads softly.
  {
    const c = new Cv(16, 16, "3");
    c.each((x, y) => {
      const n = tileNoise(x, y, 4, 31) * 0.7 + tileNoise(x, y, 8, 57) * 0.3;
      // light (bare) clumps balanced by darker (trampled) ones: same average brightness as grass
      if (n > 0.7) return "T";
      if (n > 0.56) return "S";
      if (n < 0.3) return "V";
      return null;
    });
    out.push(c);
  }
  return out;
}

// --------------------------------------------------------------------------
// deco
// --------------------------------------------------------------------------

/** Selective outline map: dark tones of each fill colour. */
const SEL: Record<string, string> = {
  w: "g",
  W: "G",
  g: "2",
  q: "P",
  p: "Q",
  P: "Q",
  r: "R",
  y: "O",
  z: "Y",
  Y: "O",
  o: "O",
  u: "U",
  v: "U",
  U: "n",
  j: "I",
  i: "I",
  e: "Z",
  l: "Z",
  m: "Z",
  K: "Z",
  L: "Z",
  M: "Z",
  N: "Z",
  c: "C",
  a: "C",
  B: "H",
  F: "H",
  h: "d",
};

/** Push the art down so its lowest opaque pixel sits on row h-1 (feet pivot). */
function ground(c: Cv): Cv {
  let bottom = 0;
  c.each((x, y, k) => {
    if (k !== ".") bottom = Math.max(bottom, y);
    return null;
  });
  return c.shift(0, c.h - 1 - bottom);
}

const FLOWERS = [
  // daisy
  `
........
..w.w...
.wwyww..
..wyYw..
..w.L...
....LM..
...ML...
........`,
  // tulip
  `
........
..p.p...
..pqpp..
..pqpP..
...PP...
...L.M..
..ML....
........`,
  // star-flower (yellow 5-point)
  `
........
...y....
.yyzyy..
..yYy...
..y.y...
...L....
...LM...
........`,
  // bluebell: arched stem with two hanging bells
  `
........
...LLL..
..L...L.
.vu...L.
.uU..vu.
.....uU.
......L.
........`,
  // pink puff (round pom flower)
  `
........
..qqp...
.qwqpp..
.qqppP..
..pPP...
...L....
..ML....
........`,
  // sunflower bud
  `
........
...yy...
..yooy..
..yoOy..
...yy...
..ML....
...LM...
........`,
];

function decoFlowers(): Cv[] {
  return FLOWERS.map((f) => ground(Cv.of(f).selout(SEL, "Z")));
}

const GRASS = [
  `
........
........
..N..N..
..L.ML..
.ML.L.N.
.LLMLKL.
........
........`,
  `
........
....N...
.N..L.N.
.L.ML.L.
.LKLLKL.
........
........
........`,
  `
........
........
........
...N.N..
.N.L.L..
.LKLLM..
........
........`,
  `
........
..N.....
..LN..N.
.N.L.ML.
.L.LKLL.
.LKLLKL.
........
........`,
];

function decoGrass(): Cv[] {
  return GRASS.map((g) => ground(Cv.of(g).selout(SEL, "Z", false, (x, y) => true)));
}

function decoRock(): Cv[] {
  const a = new Cv(10, 8);
  a.ball(4.5, 4.4, 3.6, 2.6, "JAAD", { bias: 0.08 });
  a.set(3, 3, "w");
  a.put(
    `
.M
LK`,
    6,
    5,
    { under: true },
  );
  a.selout({ J: "2", A: "2", D: "2", w: "2", L: "Z", K: "Z", M: "Z" }, "2");
  const b = new Cv(10, 8);
  b.ball(3.4, 4.6, 2.6, 2.3, "JAAD", { bias: 0.08 });
  b.ball(6.8, 5.4, 1.8, 1.5, "JAD", { bias: 0.08 });
  b.set(2, 3, "w");
  b.selout({ J: "2", A: "2", D: "2", w: "2" }, "2");
  return [ground(a), ground(b)];
}

function decoMush(): Cv[] {
  const a = Cv.of(`
........
..acca..
.awaacC.
.CCCCCC.
..BWg...
..BWg.a.
..BWgcC.
........`);
  const b = Cv.of(`
........
..qppq..
.qwqppP.
.PPPPPP.
..BWg...
..BWgjq.
..BWgPj.
........`);
  return [
    ground(a.selout({ a: "C", c: "C", C: "U", w: "C", W: "2", B: "2", g: "2" }, "2")),
    ground(b.selout({ q: "Q", p: "Q", P: "Q", w: "Q", W: "2", B: "2", g: "2", j: "I" }, "2")),
  ];
}

/** Crystal cluster: a tall crystal and a short one, facets lit from the left (light | mid | dark). */
const CRYSTAL = `
........
....w...
...wjI..
...wjiI.
...jjiI.
.w.jjiI.
.jIjjiI.
.jIjjiI.
.jijjiI.
.jjjjiI.
..jjiI..
........`;

function decoCrystal(): Cv[] {
  const a = Cv.of(CRYSTAL).selout({ j: "I", i: "I", I: "2", w: "I" }, "2");
  const b = Cv.of(CRYSTAL)
    .flipX()
    .map({ j: "a", i: "c", I: "C" })
    .selout({ a: "C", c: "C", C: "n", w: "C" }, "n");
  return [ground(a), ground(b)];
}

/** Cotton-candy tree: fluffy pink canopy with lavender shadows, curly trunk. */
function decoTree(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = new Cv(32, 40);
    const trunk = [
      [15, 38],
      [15, 37],
      [16, 36],
      [16, 35],
      [16, 34],
      [15, 33],
      [15, 32],
      [15, 31],
      [16, 30],
      [16, 29],
      [16, 28],
      [15, 27],
      [15, 26],
      [15, 25],
    ] as const;
    for (const [x, y] of trunk) {
      c.set(x - 1, y, "h");
      c.set(x, y, "H");
      c.set(x + 1, y, "H");
      c.set(x + 2, y, "d");
    }
    c.pts(
      [
        [12, 38],
        [13, 38],
        [13, 37],
        [18, 38],
        [19, 38],
        [18, 37],
      ],
      "H",
    );
    c.set(14, 38, "H").set(17, 38, "d");
    c.pts(
      [
        [18, 31],
        [19, 30],
        [20, 30],
        [21, 31],
      ],
      "H",
    );
    c.set(20, 32, "h");
    const sway = f === 1 ? 1 : 0;
    // back puffs first, front puffs last, so each front puff's lit rim overlaps the one behind
    const puffs: [number, number, number][] = [
      [12, 4.8, 3.6],
      [19.5, 5, 3.8],
      [8.5, 10.5, 5],
      [23, 10, 5],
      [15.5, 10, 7.5],
      [9, 17, 6],
      [22, 17, 6.2],
      [15.5, 19, 6.2],
    ];
    const RAMP = "iPPpppqq";
    for (const [px, py, pr] of puffs) {
      const sx = px + (py < 12 ? sway : py < 18 ? sway * 0.5 : 0);
      c.ball(sx, py, pr, pr * 0.92, RAMP, { bias: 0.08 });
    }
    const glints: [number, number][] = [
      [11, 3],
      [7, 9],
      [14, 6],
      [21, 8],
      [18, 15],
      [6, 15],
      [13, 16],
    ];
    for (const [gx, gy] of glints) {
      const x = gx + (gy < 12 ? sway : 0);
      if (c.get(x, gy) !== ".") c.set(x, gy, "w");
    }
    c.selout({ i: "I", P: "Q", p: "Q", q: "Q", B: "Q", w: "Q", h: "d", H: "d", d: "1" }, "1");
    frames.push(c);
  }
  return frames;
}

function propLantern(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = Cv.of(`
............
.....dd.....
....dHHd....
...rrrrrr...
..rroyyorr..
..rozzzzor..
..royzwyor..
..rozzzzor..
..rroyyorr..
...rrrrrr...
....dHHd....
.....qq.....
.....pq.....
.....HH.....
.....Hh.....
.....Hh.....
.....Hh.....
....dHhd....
...dHHhhd...
............`);
    if (f === 1) {
      c.put(
        `
rozzwzor
royzzwor
rozzzzor`,
        2,
        5,
      );
      c.set(4, 4, "y").set(7, 4, "y");
    }
    c.set(3, 6, "R").set(8, 6, "R").set(3, 7, "R").set(8, 7, "R");
    c.selout({ r: "R", o: "R", d: "1", H: "1", h: "1", q: "P", p: "Q" }, "1");
    frames.push(c);
  }
  return frames;
}

function propGift(): Cv {
  const c = Cv.of(`
..............
..qq....qq....
.qwpq..qwpq...
.qppqqqqppq...
..qqpppPqq....
.aaaaqpaaaaa..
.aawaqpaaaaC..
.aaaaqpaaacC..
.aaaaqpaaacC..
.caaaqpaacCC..
.ccaaqPaccCC..
..CCCPPCCCC...
..............
..............`);
  c.selout({ a: "C", c: "C", C: "2", q: "P", p: "Q", P: "Q", w: "P" }, "1");
  return ground(c);
}

export const sprites: SpriteDef[] = [
  spr("tile_ground", 16, 16, tileGround(), "center", { pal: GROUND_PAL, fps: 1 }),
  spr("deco_flower", 8, 8, decoFlowers(), "feet", { fps: 1, pal: DECO_PAL }),
  spr("deco_grass", 8, 8, decoGrass(), "feet", { fps: 1, pal: DECO_PAL }),
  spr("deco_rock", 10, 8, decoRock(), "feet", { fps: 1, pal: { ...GROUND_PAL, ...DECO_PAL } }),
  spr("deco_mush", 8, 8, decoMush(), "feet", { fps: 1 }),
  spr("deco_crystal", 8, 12, decoCrystal(), "feet", { fps: 1 }),
  spr("deco_tree", 32, 40, decoTree(), "feet", { fps: 2 }),
  spr("prop_lantern", 12, 20, propLantern(), "feet", { fps: 6 }),
  spr("prop_gift", 14, 14, [propGift()], "feet", { fps: 1 }),
];
