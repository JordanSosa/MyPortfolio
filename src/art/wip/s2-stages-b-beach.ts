/**
 * Beach Episode world art (owner: s2-stages-b): seamless sand tiles, beach
 * deco and the two destructible props. Art direction: docs/content/stages.md §3.
 *
 * Tiles: f0-3 dry sand share one flat base colour; grain is single pixels
 * (seam-proof) and every multi-pixel detail is a stamp kept 1px inside the
 * tile, so ANY mix of f0-5 tiles seamlessly. f6 (wet sand) is a uniform
 * 16px-periodic texture because the stage groups it into big contiguous
 * tide-pool regions; f7 (gull footprints) is an island stamp, because the
 * stage interleaves it with plain sand.
 */
import type { SpriteDef } from "../format";
import { Cv, rng, spr, grain, scatterStamps, tileNoise, ground } from "./s2-stages-b-util";

// --------------------------------------------------------------------------
// ground palette (local keys: a low-contrast sand ramp the master palette lacks)
// --------------------------------------------------------------------------
const SAND_PAL: Record<string, string> = {
  "3": "#f8dca2", // dry sand base
  "4": "#eccb94", // grain shade (warm)
  "5": "#ddb18f", // deep grain / dents (mauve-shifted)
  "6": "#fde8bb", // light grain
  "7": "#fff6db", // sun glint
  "8": "#e3bf90", // wet sand base (darker, cooler)
  "9": "#d6ae8a", // wet sand shade
  S: "#ecd2a8", // wet sand light
  T: "#c9f3ea", // aqua sheen
  V: "#f2fffb", // sheen core
  K: "#d3a88c", // footprint dent (mauve)
  // muted shell / starfish tones: ground details must never read as pickups or bullets
  A: "#f6c9c4", // shell pink light
  D: "#e9a5a8", // shell pink
  J: "#c98393", // shell pink shade
  L: "#f2b08f", // starfish light (coral)
  M: "#e58c7c", // starfish coral
  N: "#c86f78", // starfish shade
  Z: "#fff2e6", // shell white
};

const SAND = "3";
const FREE = "3467";

/** Dry sand: fine single-pixel grain everywhere + a few tiny 2px stamps inside. */
function sand(seed: number, stamps = 3): Cv {
  const c = new Cv(16, 16, SAND);
  const r = rng(seed);
  grain(c, r, "4446", 0.11, SAND);
  grain(c, r, "5", 0.012, SAND);
  scatterStamps(
    c,
    r,
    [
      `
46`,
      `
4
6`,
      `
.4
46`,
      `
5
6`,
      `
7`,
    ],
    stamps,
    "346",
    1,
  );
  return c;
}

function tileBeach(): Cv[] {
  const out: Cv[] = [];
  out.push(sand(11, 3));
  out.push(sand(29, 4));
  out.push(sand(47, 2));
  out.push(sand(83, 3));
  // f4 shells: a pink scallop and a cream spiral
  {
    const c = sand(101, 1);
    c.put(
      `
.AAA.
AZADA
DADAJ
.JDJ.
..5..`,
      2,
      4,
    );
    c.put(
      `
.ZZ.
Z4ZZ
.445`,
      10,
      10,
    );
    c.put(
      `
6
5`,
      12,
      3,
    );
    out.push(c);
  }
  // f5 a tiny starfish with a dozy face
  {
    const c = sand(131, 1);
    c.put(
      `
...L...
...M...
..LLM..
LLLLLMN
.MLLLN.
.LMNMN.
.MN.NN.
.5...5.`,
      4,
      4,
    );
    // dozy face
    c.set(6, 8, "N").set(8, 8, "N").set(7, 9, "N");
    out.push(c);
  }
  // f6 wet sand: uniform periodic texture + soft sheen streaks
  {
    // Tide ripples: two gentle wavy ridges per tile whose ends meet at the tile edges, so a
    // wet region reads as continuous ripple marks (lit crest on top, shaded trough below).
    const c = new Cv(16, 16, "8");
    const r = rng(613);
    grain(c, r, "9S", 0.05, "8");
    const ripple = (y0: number, phase: number, amp: number) => {
      for (let x = 0; x < 16; x++) {
        const y = y0 + Math.round(Math.sin(((x + phase) / 16) * Math.PI * 2) * amp);
        c.set(x, y, "S");
        c.set(x, y + 1, "9");
      }
    };
    ripple(3, 0, 1.2);
    ripple(11, 5, 1.2);
    // a little sky reflection pooled in two troughs
    c.put(`TVT`, 6, 6);
    out.push(c);
  }
  // f7 gull footprint trail (little three-toed arrows) - island stamp
  {
    const c = sand(151, 1);
    const PRINT = `
K.K
.K.
.K.`;
    c.put(PRINT, 3, 11);
    c.put(PRINT, 7, 8);
    c.put(PRINT, 4, 4);
    c.put(PRINT, 9, 1);
    out.push(c);
  }
  return out;
}

// --------------------------------------------------------------------------
// deco
// --------------------------------------------------------------------------

/** Selective outline map: each fill takes the darker tone of its own ramp. */
const SEL: Record<string, string> = {
  w: "g",
  W: "G",
  g: "G",
  G: "2",
  q: "P",
  p: "P",
  P: "Q",
  r: "R",
  R: "1",
  o: "O",
  y: "O",
  z: "Y",
  Y: "O",
  u: "U",
  v: "U",
  U: "n",
  B: "H",
  F: "H",
  h: "H",
  H: "d",
  d: "1",
  c: "C",
  a: "C",
  e: "E",
  l: "E",
  m: "E",
  E: "1",
  j: "I",
  i: "I",
};

/** Deco-local colours. */
const DECO_PAL: Record<string, string> = {
  // dune grass (sage / olive, sits softly on sand)
  K: "#6f9450",
  L: "#9cbb5e",
  M: "#c9d982",
  N: "#eef2b6",
  Z: "#557545",
  // beach rocks (cool blue-grey so they separate from the warm sand)
  A: "#c4c0db",
  D: "#e4e1f0",
  J: "#8f8bb0",
  S: "#6d6a92",
  // shells
  T: "#fbd9cf",
  V: "#f2b0a8",
  "3": "#d98a8f",
  "4": "#b9707f",
};

const SHELLS = [
  // scallop: cream fan with a bumpy top edge, ribs converging on the hinge "ears"
  `
........
.z.B.F..
zBBhBFF.
BBhBhFF.
.BhBhF..
..BhF...
.HHHHH..
........`,
  // spiral (moon snail): white with a lavender whorl
  `
........
........
..wwW...
.wWggW..
.wgwWgW.
.WgWgWgW
.WWggWg.
..WWWgg.`,
  // conch: knobbly cream spire, pink flared lip
  `
........
...h....
..hBh...
.hBzBh..
hBBBBBT.
.hBBTVVT
..hTVV3.
...V33..`,
  // pink heart cockle (yes, it is really heart shaped)
  `
........
.TT.TV..
TwTVTVV.
TTVTVV3.
.TVTV3..
..VV3...
...3....
........`,
];

function decoShells(): Cv[] {
  return SHELLS.map((g) => {
    const c = Cv.of(g.split("\n").map((r) => r.trim().slice(0, 8)).join("\n"));
    return ground(c.selout({ ...SEL, T: "3", V: "3", "3": "4", "4": "4", z: "H" }, "H"));
  });
}

const DUNE_GRASS = [
  `
........
.N....N.
..M..M..
..L.ML..
...LL.N.
..KLLKM.
.KLKLKL.
........`,
  `
........
...N....
.N.M..N.
..ML.M..
..L.LL..
..LKL...
.KLKLK..
........`,
  `
........
........
.N....N.
..M.NM..
..LML...
..KLL.N.
.KLKLKM.
........`,
];

function decoBeachGrass(): Cv[] {
  // outline only on the sides/base so the tips stay delicate
  return DUNE_GRASS.map((g) => ground(Cv.of(g).selout({ K: "Z", L: "Z", M: "Z", N: "Z" }, "Z", false, (x, y) => true)));
}

/** Toy bucket + spade. f0 red bucket / yellow spade, f1 blue bucket / pink spade. */
function decoSandBucket(): Cv[] {
  const base = `
.....yz.
.....yy.
......Y.
qqqqqqY.
rrrrrrrr
.rqrrRR.
.rqrrRR.
..rRRR..`;
  const out: Cv[] = [];
  for (const map of [{}, { r: "u", R: "U", q: "v", y: "p", z: "q", Y: "P" }]) {
    const c = new Cv(8, 8);
    c.put(Cv.of(base).map(map as Record<string, string>), 0, 0);
    // sand heaped inside the rim
    c.set(1, 3, "B").set(2, 3, "F").set(3, 3, "B").set(4, 3, "F").set(5, 3, "F");
    out.push(ground(c.selout({ r: "R", R: "1", q: "R", u: "U", U: "n", v: "U", y: "O", z: "O", Y: "O", p: "P", P: "Q", F: "H", B: "H" }, "1")));
  }
  return out;
}

function decoBeachRock(): Cv[] {
  const a = new Cv(10, 8);
  a.ball(4.5, 4.4, 3.8, 2.7, "JAAD", { bias: 0.06 });
  a.set(3, 3, "w");
  // barnacles: two tiny cream cones on the top-right shoulder
  a.set(6, 2, "B").set(7, 2, "B").set(6, 3, "h").set(7, 3, "W").set(5, 3, "B");
  a.selout({ J: "S", A: "S", D: "S", w: "S", B: "H", W: "H", h: "H" }, "S");
  const b = new Cv(10, 8);
  b.ball(3.6, 4.6, 2.8, 2.3, "JAAD", { bias: 0.06 });
  b.ball(7, 5.6, 1.9, 1.4, "JAD", { bias: 0.06 });
  b.set(2, 3, "w");
  b.set(7, 4, "B").set(8, 5, "h").set(7, 5, "W");
  b.selout({ J: "S", A: "S", D: "S", w: "S", B: "H", W: "H", h: "H" }, "S");
  return [ground(a), ground(b)];
}

const PARASOL_PAL: Record<string, string> = {
  "+": "#ff8f88", // red stripe lit (warm)
  "=": "#9ad0ff", // blue stripe lit
};

/**
 * Striped beach parasol: a dome of wedge stripes converging on the finial,
 * a scalloped fringe under the rim, a slim pole in a little sand mound.
 * Drawn upright, then sheared so it leans a little to the left.
 */
function parasol(scheme: "red" | "blue", flutter: boolean): Cv {
  const c = new Cv(24, 24);
  const CX = 11.5;
  const AY = 2; // apex
  const RIM = 9; // rim row
  const RX = 10.6;
  const col = scheme === "red" ? { lit: "+", base: "r", dark: "R" } : { lit: "=", base: "u", dark: "U" };
  const white = { lit: "w", base: "W", dark: "g" };
  const WEDGE = 3.05;
  const stripe = (rimX: number) => (Math.floor((rimX + WEDGE / 2) / WEDGE) % 2 === 0 ? col : white);
  // pole
  for (let y = RIM; y <= 21; y++) c.set(11, y, "W").set(12, y, "g");
  // dome
  for (let y = AY; y <= RIM; y++)
    for (let x = 0; x < 24; x++) {
      const dx = x + 0.5 - (CX + 0.5);
      const dy = (RIM + 0.6 - (y + 0.5)) / (RIM + 0.6 - AY);
      if ((dx / RX) ** 2 + dy * dy > 1) continue;
      // project the pixel onto the rim along a line from the apex -> wedge stripes
      const k = (RIM - AY) / Math.max(0.6, y + 0.5 - AY);
      const rimX = dx * Math.min(k, 6);
      const s = stripe(rimX);
      const lit = -dx / RX * 0.8 + dy * 0.5;
      const cap = y <= AY + 1 ? white : s; // white crown so the wedges never converge into noise
      c.set(x, y, y === RIM ? cap.dark : lit > 0.45 ? cap.lit : lit < -0.25 ? cap.dark : cap.base);
    }
  // scalloped fringe: one little drop per stripe
  for (let i = -3; i <= 3; i++) {
    const fx = Math.round(CX + i * WEDGE);
    const s = stripe(i * WEDGE);
    const d = flutter && (i === -2 || i === 1) ? 1 : 0;
    c.set(fx, RIM + 1 + d, s.dark);
    if (Math.abs(i) < 3) c.set(fx + 1, RIM + 1 + d, s.dark);
    if (flutter && d) c.set(fx, RIM + 1, s.dark);
  }
  // finial
  c.set(11, AY - 1, "y").set(12, AY - 1, "Y");
  // lean: shear rows left the higher they are
  const sh = new Cv(24, 24);
  for (let y = 0; y < 24; y++) {
    const off = -Math.round((21 - y) * 0.11);
    for (let x = 0; x < 24; x++) {
      const k = c.get(x, y);
      if (k !== ".") sh.set(x + off, y, k);
    }
  }
  // sand mound at the base
  sh.put(
    `
.hFBFh.
hFBBFFh`,
    8,
    21,
  );
  sh.selout({ r: "R", "+": "R", R: "1", u: "U", "=": "U", U: "n", w: "G", W: "G", g: "2", y: "O", Y: "O", F: "H", B: "H", h: "H" }, "1");
  return sh;
}

function decoParasol(): Cv[] {
  return [ground(parasol("red", false)), ground(parasol("blue", true))];
}

/** Two crenellated towers, a keep with an arched door, a pink pennant. Lit from the left. */
function decoMiniSandcastle(): Cv {
  const c = new Cv(12, 10);
  const block = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) c.set(x, y, x === x0 ? "B" : x === x1 ? "h" : y === y0 ? "B" : "F");
  };
  block(4, 5, 7, 9); // keep
  block(1, 3, 3, 9); // left tower
  block(8, 3, 10, 9); // right tower
  // merlons
  c.set(1, 2, "B").set(3, 2, "F").set(8, 2, "B").set(10, 2, "h");
  c.set(4, 4, "B").set(7, 4, "h");
  // door + windows
  c.set(5, 8, "H").set(6, 8, "H").set(5, 9, "d").set(6, 9, "d").set(5, 7, "h");
  c.set(2, 5, "H").set(9, 5, "H");
  // sand base spill
  c.set(0, 9, "h").set(11, 9, "H");
  // pennant on the keep
  c.set(6, 1, "1").set(6, 2, "1").set(6, 3, "1").set(6, 4, "1");
  c.set(7, 1, "p").set(8, 1, "q").set(7, 2, "P");
  c.set(6, 0, "Y");
  return ground(c.selout({ B: "H", F: "H", h: "H", H: "d", P: "Q", p: "Q", q: "P", Y: "O" }, "H"));
}

// --------------------------------------------------------------------------
// palm tree (tall deco, 2-frame sway)
// --------------------------------------------------------------------------
const PALM_PAL: Record<string, string> = {
  K: "#164a40", // frond outline (deep teal-green)
  L: "#1f6b4c", // frond underside
  M: "#2f9a52", // frond shade
  N: "#53bf5b", // frond base
  S: "#9be36a", // frond lit
  T: "#d9f7a4", // frond rim light
};

type P2 = [number, number];
function qb(a: P2, b: P2, c: P2, t: number): P2 {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
}

function palm(sway: number): Cv {
  const c = new Cv(32, 40);
  // ---- trunk: a gentle S-curve, segmented rings, lit on the left
  const T0: P2 = [15.5, 39];
  const T1: P2 = [12.5, 26];
  const T2: P2 = [18.5, 13];
  const xAt = new Map<number, number>();
  for (let i = 0; i <= 200; i++) {
    const [x, y] = qb(T0, T1, T2, i / 200);
    const yy = Math.round(y);
    if (!xAt.has(yy)) xAt.set(yy, x);
  }
  for (let y = 14; y <= 39; y++) {
    const cx = xAt.get(y) ?? 15;
    const w = y > 34 ? 4.4 : y > 24 ? 3.6 : 3.2;
    const x0 = Math.round(cx - w / 2);
    const x1 = Math.round(cx + w / 2) - 1;
    const ring = (y + 1) % 3 === 0;
    for (let x = x0; x <= x1; x++) {
      let k = x === x0 ? "h" : x === x1 ? "d" : "H";
      if (ring) k = x === x0 ? "H" : "d";
      c.set(x, y, k);
    }
    if (ring) c.set(x0 - 1, y, "H"); // little notch sticking out on the lit side
  }
  // root flare
  c.set(12, 39, "H").set(13, 38, "H").set(18, 39, "d").set(18, 38, "d");
  // ---- coconuts (behind the fronds' front layer)
  const nuts: P2[] = [
    [17.2, 14.6],
    [20.6, 15.2],
    [18.8, 17.2],
  ];
  // ---- fronds: crown -> control -> tip; drawn back to front
  const crown: P2 = [18.5, 12];
  const FRONDS: { c: P2; t: P2; w: number; back?: boolean }[] = [
    { c: [14, 0], t: [5, 6], w: 2.6, back: true },
    { c: [24, -1], t: [28, 5], w: 2.6, back: true },
    { c: [8, 6], t: [1, 17], w: 2.9 },
    { c: [28, 5], t: [31, 18], w: 2.9 },
    { c: [11, 13], t: [7, 25], w: 2.6 },
    { c: [25, 12], t: [27, 26], w: 2.6 },
    { c: [17, 1], t: [16, 2], w: 2.2 },
  ];
  const drawFrond = (f: { c: P2; t: P2; w: number; back?: boolean }) => {
    const layer = new Cv(32, 40);
    const tip: P2 = [f.t[0] + sway * (f.t[1] < 10 ? 1 : 1), f.t[1] + (f.t[1] > 15 ? sway * 0.4 : 0)];
    const ctrl: P2 = [f.c[0] + sway * 0.5, f.c[1]];
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const [x, y] = qb(crown, ctrl, tip, t);
      const [x2, y2] = qb(crown, ctrl, tip, Math.min(1, t + 0.01));
      let tx = x2 - x;
      let ty = y2 - y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      // normal pointing "up" (screen) side of the leaf
      let nx = ty;
      let ny = -tx;
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      // leaflet serration: notches along the length, wide in the middle
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.06)), 0.7);
      const saw = ((t * 11) % 1) < 0.55 ? 1 : 0.55;
      const w = f.w * env * (t < 0.12 ? 0.6 : saw);
      for (let s = -w; s <= w; s += 0.35) {
        const px = x + nx * s;
        // the lower half droops (leaflets hang under gravity)
        const py = y + ny * s + (s < 0 ? -s * 0.35 : 0);
        const up = s > 0.35;
        const k = up ? (s > w * 0.6 && t < 0.8 ? "T" : "S") : s < -w * 0.45 ? "L" : "M";
        const cur = layer.get(Math.round(px), Math.round(py));
        if (cur === "." || k === "T" || (k === "S" && cur !== "T")) layer.set(px, py, k);
      }
      // midrib
      layer.set(x, y, t < 0.85 ? "N" : "S");
    }
    if (f.back) layer.map({ T: "S", S: "N", N: "M", M: "L" });
    layer.selout({}, "K");
    c.put(layer, 0, 0);
  };
  for (const f of FRONDS.filter((f) => f.back)) drawFrond(f);
  c.selout({ d: "1", H: "d", h: "d" }, "1");
  for (const f of FRONDS.filter((f) => !f.back)) drawFrond(f);
  // coconuts hang just under the crown, in front of the frond bases
  const nc = new Cv(32, 40);
  for (const [nx, ny] of nuts) nc.ball(nx, ny + 1.5, 1.6, 1.5, "dHHh", { bias: 0.1 });
  nc.selout({}, "1");
  c.put(nc, 0, 0);
  return c;
}

function decoPalm(): Cv[] {
  return [palm(0), palm(1)];
}

// --------------------------------------------------------------------------
// props
// --------------------------------------------------------------------------
const BALL_PAL: Record<string, string> = {
  "+": "#ff8f88",
  "=": "#9ad0ff",
};

/**
 * Beach ball: coloured panels fan out from a little white cap near the
 * top-left (the lit pole), shaded as a sphere. f1 = squash on the bounce.
 */
function beachBall(squash: boolean): Cv {
  const c = new Cv(12, 12);
  const cx = 5.5;
  const rx = squash ? 5.4 : 4.7;
  const ry = squash ? 3.5 : 4.7;
  const cy = 11 - ry - 0.5;
  const capX = cx - rx * 0.36;
  const capY = cy - ry * 0.36;
  const PANELS: [number, { lit: string; base: string; dark: string }][] = [
    [-5, { lit: "+", base: "r", dark: "R" }], // up / up-right
    [45, { lit: "w", base: "W", dark: "g" }], // right
    [100, { lit: "=", base: "u", dark: "U" }], // down-right
    [165, { lit: "z", base: "y", dark: "Y" }], // down-left
    [400, { lit: "w", base: "W", dark: "g" }], // left
  ];
  c.ellipse(cx, cy, rx, ry, (x, y) => {
    const nx = (x - cx) / (rx + 0.5);
    const ny = (y - cy) / (ry + 0.5);
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const l = nx * -0.55 + ny * -0.62 + nz * 0.56;
    const dx = x - capX;
    const dy = y - capY;
    if (Math.hypot(dx, dy * (rx / ry)) < 0.8) return "w";
    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (a < -110) a += 360;
    const p = PANELS.find(([lim]) => a < lim)![1];
    return l > 0.72 ? p.lit : l < 0.1 ? p.dark : p.base;
  });
  // specular glint
  c.set(Math.round(capX) + 1, Math.round(capY) - 1, "w");
  c.selout({}, "1");
  return c;
}

function propCooler(): Cv {
  const c = Cv.of(`
..............
....111111....
...1g....G1...
.111111111111.
1wwwwwwwwwwwW1
1WwwwwwwwwwWg1
1gggggggggggG1
1vuuuuuuuuuUU1
1vuupupuuuuUU1
1vuupppuuuuUU1
1uuuupuuuuUUn1
.111111111111.`);
  // latch
  c.set(6, 6, "y").set(7, 6, "Y");
  return c;
}

void DECO_PAL;

export const sprites: SpriteDef[] = [
  spr("tile_beach", 16, 16, tileBeach(), "center", { pal: SAND_PAL, fps: 1 }),
  spr("deco_shell", 8, 8, decoShells(), "feet", { fps: 1, pal: DECO_PAL }),
  spr("deco_beach_grass", 8, 8, decoBeachGrass(), "feet", { fps: 1, pal: DECO_PAL }),
  spr("deco_sand_bucket", 8, 8, decoSandBucket(), "feet", { fps: 1 }),
  spr("deco_beach_rock", 10, 8, decoBeachRock(), "feet", { fps: 1, pal: DECO_PAL }),
  spr("deco_parasol", 24, 24, decoParasol(), "feet", { fps: 1, pal: PARASOL_PAL }),
  spr("deco_mini_sandcastle", 12, 10, [decoMiniSandcastle()], "feet", { fps: 1 }),
  spr("deco_palm", 32, 40, decoPalm(), "feet", { fps: 2, pal: PALM_PAL }),
  spr("prop_beachball", 12, 12, [beachBall(false), beachBall(true)], "feet", { fps: 4, pal: BALL_PAL }),
  spr("prop_cooler", 14, 12, [propCooler()], "feet", { fps: 1 }),
];
