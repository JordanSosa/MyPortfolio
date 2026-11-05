/**
 * Candy Kingdom world art (owner: s2-stages-a): strawberry-frosting ground,
 * candy deco, the lollipop tree, the two destructible props and the ambient
 * sprinkle. Art direction: docs/content/stages.md §1.
 *
 * Ground tiles follow the meadow's rules (world.ts): one flat frosting base
 * colour; every detail is a whole stamp kept 1px inside the tile, so any
 * combination of f0-6 tiles seamlessly. f7 (cookie-crumb path) is a uniform
 * 16px-periodic texture because the ground view groups it into large noise
 * regions. Contrast stays low so plum-outlined actors pop on top.
 */
import type { SpriteDef } from "../format";
import { spr } from "../sprites/world-util";
import { Cv, SEL, ground, rng, scatter, tileNoise, centreX } from "./s2-stages-a-util";

// --------------------------------------------------------------------------
// ground palette (local: soft frosting ramp + cookie ramp)
// --------------------------------------------------------------------------
const FROST_PAL: Record<string, string> = {
  "3": "#f3b9d0", // frosting base
  "4": "#e9adc9", // soft shade (cooler)
  "5": "#dd9fc3", // deeper shade (violet lean)
  "6": "#f7c4d5", // light (warmer)
  "7": "#fbd2dc", // ridge highlight
  "8": "#fff0f2", // sugar glint
  // cookie-crumb path
  A: "#e8bc9f", // crumb lit
  D: "#e3b398", // packed crumbs
  J: "#dba891", // crumb shade (pink-violet lean)
  K: "#f0cbae", // crumb highlight
  N: "#b27767", // choc-chip crumb
  // chocolate drizzle
  S: "#a7664f", // drizzle shade
  T: "#bd7c5e", // drizzle
  V: "#d99f80", // drizzle highlight
};

// Piped-frosting marks. Light from the top-left: lit '6'/'7', shaded '4'/'5'.
const FROSTING = [
  // rosette dollop
  `
.67.
6.74
.44.`,
  // swirl curl
  `
.66.
6..4
.745
..4.`,
  // piped wave
  `
.677..
6...44
`,
  // little crescent ridge
  `
.66.
4..4`,
  // tiny peak
  `
.7
64`,
  // short ridge
  `
677
.44`,
];
const GRAIN = [
  `
4`,
  `
6`,
];

function frosting(seed: number, marks: number, grain: number): Cv {
  const c = new Cv(16, 16, "3");
  const r = rng(seed);
  scatter(c, r, FROSTING, marks, 2);
  scatter(c, r, GRAIN, grain, 1);
  return c;
}

/** Rainbow sprinkle rods (2px, with a soft frosting shadow under the lower-right end). */
const SPRINKLES = [
  `
yy
.5`,
  `
c.
c5`,
  `
l.
.l
..5`.trim(),
  `
.w
w.
5.`.trim(),
  `
uu
.5`,
  `
i.
i5`,
  `
.o
o5`,
  `
pp
.5`,
];

function tileCandy(): Cv[] {
  const out: Cv[] = [];
  // f0-3 plain strawberry frosting: different piped layouts + a little grain
  out.push(frosting(12, 3, 3));
  out.push(frosting(31, 4, 2));
  out.push(frosting(57, 2, 4));
  out.push(frosting(89, 3, 3));
  // f4 rainbow sprinkles
  {
    const c = frosting(103, 1, 1);
    const r = rng(907);
    scatter(c, r, SPRINKLES, 9, 1, "3");
    out.push(c);
  }
  // f5 chocolate drizzle: three thin glossy strokes drizzled diagonally across (lit tops)
  {
    const c = frosting(131, 1, 1);
    c.put(
      `
..........VT.
........VTS..
......VTS....
....VTS....VT
..VTS....VTS.
.TS....VTS...
S....VTS.....
...VTS....VT.
.VTS....VTS..
TS....VTS....
....VTS......
...TS........`,
      2,
      2,
    );
    c.each((x, y, k) => ((x === 0 || x === 15 || y === 0 || y === 15) && k !== "3" ? "3" : null));
    out.push(c);
  }
  // f6 sugar sparkle
  {
    const c = frosting(151, 2, 1);
    c.put(
      `
..8..
.878.
88w88
.878.
..8..`,
      8,
      3,
    );
    c.put(
      `
.8.
8w8
.8.`,
      3,
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
7`,
      4,
      4,
    );
    out.push(c);
  }
  // f7 cookie-crumb path: calm, 16px-periodic packed crumbs. The ground view groups f7 into
  // large regions, so there is no focal point and contrast stays very low (no visible repeat).
  {
    const c = new Cv(16, 16, "D");
    c.each((x, y) => {
      const n = tileNoise(x, y, 2, 71) * 0.55 + tileNoise(x, y, 8, 13) * 0.45;
      if (n < 0.36) return "J";
      if (n > 0.64) return "A";
      return null;
    });
    // single lit crumbs with a shaded underside, and a few chocolate-chip crumbs
    const crumbs: [number, number][] = [
      [2, 3],
      [9, 1],
      [13, 6],
      [5, 9],
      [11, 12],
      [1, 13],
      [7, 14],
    ];
    for (const [x, y] of crumbs) c.set(x, y, "K").set(x, (y + 1) % 16, "J");
    for (const [x, y] of [
      [14, 2],
      [4, 6],
      [9, 9],
    ] as const)
      c.set(x, y, "N");
    out.push(c);
  }
  return out;
}

// --------------------------------------------------------------------------
// deco
// --------------------------------------------------------------------------

const GUMDROP = `
........
...qq...
..qwqp..
.qqpqpP.
.pqpppP.
.ppppPP.
.PPPPPQ.
........`;

function decoGumdrop(): Cv[] {
  const maps: Record<string, string>[] = [
    {}, // strawberry pink
    { q: "z", p: "y", P: "Y", Q: "O" }, // lemon
    { q: "a", p: "c", P: "C", Q: "n" }, // mint
    { q: "j", p: "i", P: "I", Q: "2" }, // grape
  ];
  return maps.map((m) => {
    const c = Cv.of(GUMDROP).map(m);
    const out = { ...SEL, C: "n", I: "2", Y: "O", P: "Q", c: "C", a: "C", i: "I", j: "I", y: "O", z: "Y", q: "P", p: "Q", w: "g", Q: "1", O: "1", n: "1" };
    c.selout(out, "1");
    return ground(c);
  });
}

/** Spiral key picker: band index from angle + radius (arms keyed by `keys`). */
function spiralBand(dx: number, dy: number, pitch: number, n: number, rot = 0): number {
  const a = Math.atan2(dy, dx) / (Math.PI * 2) + rot;
  const r = Math.hypot(dx, dy);
  const t = a + r / pitch;
  return ((Math.floor(t * n) % n) + n) % n;
}

const LOLLI = `
..QQQQ..
.QqpppQ.
QpwwwwpQ
QpwppwpQ
QpwpwwPQ
QpwpppPQ
.QPPPPQ.
..QWQQ..
..GWG...
..GwG...
..GWG...
..GWG...
..GgG...
..GGG...`;

function decoLolli(): Cv[] {
  const maps: Record<string, string>[] = [
    {}, // strawberry
    { q: "a", p: "c", P: "C", Q: "n" }, // mint
    { q: "z", p: "y", P: "Y", Q: "O" }, // lemon
  ];
  return maps.map((m) => ground(Cv.of(LOLLI).map(m)));
}

/** Hand-drawn hook mask; stripes run diagonally, the right column of the stem is shaded. */
const CANE_MASK = `
........
..####..
.######.
.##..##.
.##..##.
.....##.
.....##.
.....##.
.....##.
.....##.
.....##.
........`;

function decoCane(): Cv[] {
  const c = Cv.of(CANE_MASK);
  c.each((x, y, k) => {
    if (k !== "#") return null;
    const red = (x + y) % 3 === 0;
    const shade = (x === 6 && y > 2) || (y === 2 && x === 6);
    const lit = (y === 1 || (y === 2 && x === 1)) && !red;
    if (red) return shade ? "R" : "r";
    return lit ? "w" : shade ? "W" : "w";
  });
  // glossy highlight on the top of the hook
  c.set(3, 1, "w");
  c.selout({ r: "R", R: "1", w: "R", W: "R" }, "R");
  const a = ground(c);
  return [a, a.flipX()];
}

/** Sugar cubes: crisp 3/4 cubes (lit top face, front face, shaded right face) with crystal specks. */
function decoSugarCube(): Cv[] {
  const a = Cv.of(`
........z.
..GGGGGzwz
.GwwwwwgGz
GwwwwwggG.
GWWWWWWgG.
GWwWWWWgG.
GWWWWwWgG.
GGGGGGGG..`);
  const b = Cv.of(`
...GGGGG..
..GwzwwgG.
..GWWWWgG.
GGGGGGGGGG
GwwwgGwwgG
GWWWgGWWgG
GWwWgGWwgG
GGGGGGGGGG`);
  return [ground(a), ground(b)];
}

function decoCupcake(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = Cv.of(`
....1...
...1e1..
..1wr1..
.1qrRq1.
1qqqppP1
1qpqpPP1
1PPPPPQ1
1acacaC1
.1acaC1.
..1111..`);
    if (f === 1) {
      // cherry glint: brighter shine + a tiny twinkle beside it
      c.set(4, 2, "q");
      c.set(6, 1, "w").set(6, 0, "z").set(7, 1, "z").set(6, 2, "z");
    }
    frames.push(ground(c.map({ "1": "Q" })));
  }
  return frames;
}

// --------------------------------------------------------------------------
// lollipop tree (32x40): spiral lollipop canopy on a striped candy-cane trunk
// canopy centre ~ (16, 13): manifest canopy { r: 16, h: 26 } from the feet at row 39
// --------------------------------------------------------------------------
function decoLolliTree(): Cv[] {
  const frames: Cv[] = [];
  // arms: [light, base, shade]
  const ARMS: [string, string, string][] = [
    ["q", "p", "P"],
    ["w", "W", "j"],
    ["a", "c", "C"],
    ["w", "W", "j"],
    ["z", "y", "Y"],
    ["w", "W", "j"],
  ];
  for (let f = 0; f < 2; f++) {
    const c = new Cv(32, 40);
    const sway = f;
    // trunk: candy-cane stripes, 4px, slight flare at the foot
    for (let y = 26; y < 40; y++) {
      for (let x = 14; x < 18; x++) {
        const stripe = Math.floor((y + (x - 14) * 0.8) / 2) % 2 === 0;
        const shade = x >= 17;
        const lit = x === 14;
        c.set(x, y, stripe ? (shade ? "R" : "r") : shade ? "g" : lit ? "w" : "W");
      }
    }
    c.set(13, 39, "g").set(18, 39, "g").set(13, 38, "W");
    // canopy disc with spiral arms, domed shading (light top-left)
    const cx = 15.5 + sway;
    const cy = 14.5;
    const R = 13.4;
    c.ellipse(cx, cy, R, R, (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const band = spiralBand(dx, dy, 15, ARMS.length, 0.1);
      const [L, B, S] = ARMS[band];
      // dome light: brighter top-left, darker toward the lower-right rim
      const l = (-dx * 0.55 - dy * 0.65) / R + (1 - r / R) * 0.45;
      if (l > 0.42) return L;
      if (l < -0.28) return S;
      return B;
    });
    // glossy highlight arc (top-left)
    for (let a = 0; a < 9; a++) {
      const t = Math.PI * (1.08 + a * 0.06);
      const x = Math.round(cx + Math.cos(t) * (R - 3.2));
      const y = Math.round(cy + Math.sin(t) * (R - 3.2));
      c.set(x, y, "w");
    }
    c.set(Math.round(cx - 5), Math.round(cy - 6), "w").set(Math.round(cx - 4), Math.round(cy - 7), "w");
    // sprinkle "leaves" scattered on the candy
    const spr: [number, number, string][] = [
      [8, 9, "l"],
      [21, 7, "i"],
      [25, 16, "u"],
      [18, 22, "l"],
      [8, 19, "o"],
      [14, 4, "u"],
      [13, 14, "r"],
    ];
    for (const [x, y, k] of spr) {
      const sx = x + sway;
      c.set(sx, y, k).set(sx + 1, y + (k === "l" || k === "u" ? 0 : 1), k);
    }
    // green ribbon bow where the stick meets the candy (reads as leaves)
    c.put(
      `
le....el
Elle.elE
.EEleEE.
..EEEE..
...E.E..
...E..E.`,
      12 + Math.round(sway * 0.5),
      26,
    );
    c.selout(
      {
        q: "P",
        p: "Q",
        P: "Q",
        w: "G",
        W: "G",
        j: "I",
        a: "C",
        c: "C",
        C: "n",
        z: "Y",
        y: "O",
        Y: "O",
        r: "R",
        R: "1",
        g: "2",
        l: "E",
        e: "E",
        E: "1",
      },
      "1",
    );
    frames.push(c);
  }
  return frames;
}

// --------------------------------------------------------------------------
// props
// --------------------------------------------------------------------------
const GLASS_PAL = {
  "%": "#d8f4f6a0", // empty glass (translucent aqua)
  "&": "#ffffffd0", // glass glint
};

function propCandyJar(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = Cv.of(`
............
....hhhH....
....hHHd....
...gWWWWg...
..a%%%%%%a..
.a%%%%%%%%C.
.a%%%%%%%%C.
.a%%%%%%%%C.
.a%%%%%%%%C.
.a%%%%%%%%C.
.a%%%%%%%%C.
.a%%%%%%%%C.
.a%%%%%%%%C.
..aaaaaaCC..
............
............`);
    // sweets inside: round candies + a wrapped one, packed from the bottom
    const sweets: [number, number, string, string][] = [
      [2, 11, "p", "q"],
      [4, 11, "y", "z"],
      [6, 11, "c", "a"],
      [8, 11, "i", "j"],
      [3, 9, "l", "m"],
      [5, 9, "r", "q"],
      [7, 9, "u", "v"],
      [2, 7, "o", "z"],
      [4, 7, "p", "q"],
      [8, 8, "y", "z"],
    ];
    for (const [x, y, k, hl] of sweets) {
      c.set(x, y, hl).set(x + 1, y, k).set(x, y + 1, k).set(x + 1, y + 1, k);
    }
    c.set(6, 7, "w").set(6, 8, "q").set(5, 8, "p");
    // glass highlight streak (left) + shade (right)
    for (let y = 5; y <= 11; y++) c.set(2, y, y < 9 ? "&" : c.get(2, y));
    c.set(3, 5, "&");
    if (f === 1) {
      c.set(8, 5, "w").set(7, 6, "&").set(9, 4, "w");
      c.set(2, 6, "w").set(2, 7, "w");
    }
    c.selout({ h: "d", H: "d", d: "1", g: "2", W: "2", a: "1", C: "1", "%": "1" }, "1");
    frames.push(ground(c));
  }
  return frames;
}

const STAR_MASK = `
.....#.....
....###....
....###....
###########
.#########.
..#######..
..#######..
.####.####.
.###...###.
.##.....##.`;

function pinataStar(tilt: number): Cv {
  const m = Cv.of(STAR_MASK);
  const c = new Cv(16, 16);
  // tissue-paper bands (2 rows each), lit top-left / shaded bottom-right, fringe on band edges
  const BANDS: [string, string, string][] = [
    ["q", "p", "P"],
    ["q", "p", "P"],
    ["z", "y", "Y"],
    ["a", "c", "C"],
    ["j", "i", "I"],
  ];
  const ox = 3 + tilt;
  const oy = 5;
  m.each((x, y, k) => {
    if (k !== "#") return null;
    const bi = Math.min(BANDS.length - 1, Math.floor(y / 2));
    const [L, B, S] = BANDS[bi];
    const fringe = y % 2 === 1 && x % 2 === 0 && y < 9;
    const d = (x - 5) * 0.5 + (y - 4) * 0.7;
    let key = d < -2.2 ? L : d > 2.2 ? S : B;
    if (fringe) key = key === S ? B : L;
    c.set(ox + x, oy + y, key);
    return null;
  });
  c.selout({}, "1");
  // face (looks right)
  c.set(ox + 5, oy + 4, "1").set(ox + 7, oy + 4, "1").set(ox + 5, oy + 5, "0").set(ox + 7, oy + 5, "0");
  c.set(ox + 6, oy + 6, "1");
  c.set(ox + 4, oy + 6, "b").set(ox + 8, oy + 6, "b");
  return c;
}

function propPinata(): Cv[] {
  const frames: Cv[] = [];
  for (let f = 0; f < 2; f++) {
    const c = new Cv(16, 16);
    // wooden post + arm (lit left face, shaded right face)
    const post = new Cv(16, 16);
    for (let y = 1; y < 15; y++) post.set(1, y, y === 1 ? "h" : "H");
    post.rect(2, 1, 7, 1, "h");
    post.set(2, 2, "H");
    post.selout({ h: "d", H: "d" }, "d");
    c.put(post, 0, 0);
    c.set(0, 15, "d").set(1, 15, "H").set(2, 15, "d");
    // string (swings with the star)
    if (f === 0) c.set(8, 3, "2");
    else c.set(9, 3, "2");
    c.put(pinataStar(f), 0, 0);
    // streamers under the two lower points (lag behind the swing)
    // (the star's lower tips sit on row 14; streamers would leave the box, so the tips carry tassel colours)
    c.set(4 + f, 14, "r").set(13 + f, 14, "u");
    frames.push(c);
  }
  return frames;
}

// --------------------------------------------------------------------------
// ambient sprinkle (tinted by code): a 3px rod in 4 rotations about (1,1)
// --------------------------------------------------------------------------
const SPRINKLE_FX = [
  `
....
wwW.
....
....`,
  `
..w.
.w..
W...
....`,
  `
.w..
.w..
.W..
....`,
  `
w...
.w..
..W.
....`,
];

export const sprites: SpriteDef[] = [
  spr("tile_candy", 16, 16, tileCandy(), "center", { pal: FROST_PAL, fps: 1 }),
  spr("deco_gumdrop", 8, 8, decoGumdrop(), "feet", { fps: 1 }),
  spr("deco_candy_lolli", 8, 14, decoLolli(), "feet", { fps: 1 }),
  spr("deco_candy_cane", 8, 12, decoCane(), "feet", { fps: 1 }),
  spr("deco_sugar_cube", 10, 8, decoSugarCube(), "feet", { fps: 1 }),
  spr("deco_cupcake", 8, 10, decoCupcake(), "feet", { fps: 1 }),
  spr("deco_lollipop_tree", 32, 40, decoLolliTree(), "feet", { fps: 2 }),
  spr("prop_candy_jar", 12, 16, propCandyJar(), "feet", { fps: 2, pal: GLASS_PAL }),
  spr("prop_pinata", 16, 16, propPinata(), "feet", { fps: 3 }),
  spr("fx_sprinkle", 4, 4, SPRINKLE_FX, "center", { fps: 5 }),
];
// (centreX kept for later tweaks)
void centreX;
