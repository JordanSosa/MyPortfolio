/**
 * The Final Arc world art (owner: s2-stages-b): storyboard-paper tiles, the
 * "budget ran out" sketch deco, and the two destructible props.
 * Art direction: docs/content/stages.md §4.
 *
 * Tiles: f0-3 dark violet storyboard paper with a faint animation-paper grid
 * every 8 px (lines on columns/rows 0 and 8, so the grid is continuous across
 * any mix of tiles); f4-6 are island stamps kept 1px inside the tile; f7
 * (unfinished pencil sketch on pale paper) is a uniform 16px-periodic
 * texture because the stage groups it into big contiguous patches.
 */
import type { SpriteDef } from "../format";
import { Cv, rng, spr, grain, scatterStamps, tileNoise, ground } from "./s2-stages-b-util";

const PAPER_PAL: Record<string, string> = {
  "3": "#3a2b5e", // storyboard paper (dark violet)
  "4": "#35285a", // paper fibre shade
  "5": "#413267", // paper fibre light
  "6": "#2f2a62", // grid line (faint navy)
  "7": "#4a3a72", // pencil smudge
  // unfinished sketch paper
  "8": "#ddd6ee", // pale paper
  "9": "#cfc6e6", // paper shade
  S: "#b9aed8", // pencil line (light)
  T: "#a397c9", // pencil line (dark)
  // light leak
  V: "#6a4fb0", // crack glow outer
  K: "#b49cf0", // crack glow inner
  // film strip (muted so it never reads as a coin or a bullet)
  A: "#1f1636", // film base
  D: "#5a4a7e", // sprocket hole
  J: "#8a6a58", // frame (dim sepia)
  L: "#b08a68", // frame light
};

function paper(seed: number, extras = 0): Cv {
  const c = new Cv(16, 16, "3");
  const r = rng(seed);
  grain(c, r, "45", 0.09, "3");
  // the animation-paper grid: faint lines every 8px
  c.each((x, y) => (x % 8 === 0 || y % 8 === 0 ? "6" : null));
  // registration crosses where the grid lines meet (only some tiles)
  if (extras > 0) {
    scatterStamps(
      c,
      r,
      [
        `
7`,
        `
77`,
        `
7
7`,
      ],
      extras,
      "345",
      1,
    );
  }
  return c;
}

function tileFinale(): Cv[] {
  const out: Cv[] = [];
  out.push(paper(11, 1));
  out.push(paper(29, 2));
  out.push(paper(47, 0));
  out.push(paper(83, 1));
  // f4 a jagged crack leaking a little light (thin, branching: never a smooth beam)
  {
    const c = paper(101, 0);
    const crack: [number, number][] = [
      [4, 3], [5, 4], [5, 5], [6, 6], [7, 6], [7, 7], [8, 8], [8, 9], [9, 10], [10, 10], [10, 11], [11, 12],
      [6, 7], [5, 8], [4, 8], // branch
      [9, 8], [10, 7], // branch
    ];
    const glow = new Cv(16, 16);
    for (const [x, y] of crack) glow.set(x, y, "K");
    glow.halo(["V"]);
    glow.each((x, y, k) => (k !== "." && (x < 1 || y < 1 || x > 14 || y > 14) ? "." : null));
    c.put(glow, 0, 0);
    for (const [x, y] of crack) c.set(x, y, "K");
    for (const [x, y] of [[7, 7], [8, 8], [5, 5]] as [number, number][]) c.set(x, y, "w");
    out.push(c);
  }
  // f5 a film-strip fragment lying on the paper (dark strip, sprocket holes, dim sepia frames)
  {
    const c = paper(131, 0);
    c.put(
      `
.........AA.
.......AADA.
.....AAAAAAA
...AADAJLAAA
.AAAAAJJJAAD
AADAJLAAAAA.
AAAAJJJAADA.
ADAAAAAAA...
AAAADA......
.AA.........`,
      2,
      3,
    );
    out.push(c);
  }
  // f6 star glints
  {
    const c = paper(151, 0);
    c.put(
      `
..j..
..w..
jwwwj
..w..
..j..`,
      3,
      3,
    );
    c.put(
      `
.j.
jwj
.j.`,
      10,
      9,
    );
    c.set(12, 3, "j").set(5, 12, "K");
    out.push(c);
  }
  // f7 unfinished pencil sketch on pale paper: the same 8px animation grid (so it lines up with
  // the dark paper) plus loose diagonal pencil hatching that wraps across the tile edges.
  {
    const c = new Cv(16, 16, "8");
    const r = rng(907);
    grain(c, r, "9", 0.05, "8");
    c.each((x, y) => (x % 8 === 0 || y % 8 === 0 ? "9" : null));
    c.each((x, y) => {
      if ((x + y) % 4 !== 0) return null; // period 4 divides 16: strokes continue across tiles
      // broken strokes: short dashes with gaps, varying pressure
      const n = tileNoise(x, y, 8, 91);
      if (n < 0.38) return null;
      return n > 0.72 ? "T" : "S";
    });
    out.push(c);
  }
  return out;
}

// --------------------------------------------------------------------------
// deco
// --------------------------------------------------------------------------
const DECO_PAL: Record<string, string> = {
  // pencil lines (sketch deco): lavender on the dark paper
  S: "#cbbcf0", // pencil light
  T: "#9d8fd0", // pencil mid
  K: "#7c6db6", // pencil faint (construction lines)
  // stone (broken pillar): violet-grey ramp
  A: "#e2dcf2", // stone lit
  D: "#b4a9d4", // stone base
  J: "#8478ad", // stone shade
  L: "#5c5288", // stone deep
  M: "#3b3263", // stone crevice
};

/** Film reel standing on its edge (four windows round the hub), film tail spilling on the ground. f1 = blue-steel reel with a red label. */
const REEL = `
..wwWW..
.wW##Wg.
wWW##Wgg
W##%W##g
W##WG##G
gWW##ggG
.gW##gG.
..gGGG..`;

function decoFilmReel(): Cv[] {
  const out: Cv[] = [];
  for (let v = 0; v < 2; v++) {
    const c = new Cv(10, 10);
    const reel = Cv.of(REEL).map(v === 0 ? { "#": "2", "%": "W" } : { w: "v", W: "u", g: "U", G: "n", "#": "1", "%": "r" });
    c.put(reel, 1, 1);
    c.selout({ w: "G", W: "G", g: "2", G: "1", "2": "1", r: "1", v: "U", u: "n", U: "1", n: "1" }, "1");
    c.set(4, 4, v === 0 ? "G" : "R");
    // film tail spilling out onto the ground
    c.pts(v === 0 ? [[8, 9], [9, 9]] : [[8, 8], [9, 9], [8, 9]], "2");
    out.push(ground(c));
  }
  return out;
}

/** A bush drawn only as lavender pencil lines: lumpy outline, a few inner curls, overshooting strokes. */
function decoSketchBush(): Cv[] {
  const out: Cv[] = [];
  const lumps: [number, number, number][][] = [
    [
      [3.5, 6, 2.6],
      [6, 4.6, 3],
      [8.6, 6.2, 2.5],
    ],
    [
      [3.2, 6.4, 2.4],
      [5.6, 5, 2.6],
      [8.4, 5.4, 2.6],
    ],
  ];
  lumps.forEach((L, i) => {
    const fill = new Cv(12, 10);
    for (const [x, y, r] of L) fill.disc(x, y, r, "#");
    fill.rect(1, 7, 10, 2, (x) => (x > 1 && x < 10 ? "#" : null));
    const c = new Cv(12, 10);
    // keep only the outline of the lumpy mass: pencil contour
    fill.each((x, y, k) => {
      if (k !== "#") return null;
      const edge = fill.get(x - 1, y) === "." || fill.get(x + 1, y) === "." || fill.get(x, y - 1) === "." || fill.get(x, y + 1) === ".";
      if (edge) c.set(x, y, y < 4 || x < 3 ? "S" : "T");
      return null;
    });
    // inner curls / scribbles
    if (i === 0) c.pts([[5, 6], [6, 5], [7, 6]], "K").pts([[3, 7], [4, 6]], "K");
    else c.pts([[4, 6], [5, 7], [6, 6]], "K").pts([[8, 6], [9, 5]], "K");
    // overshooting strokes (it was drawn fast)
    c.set(0, 8, "K").set(11, 8, "K");
    if (i === 0) c.set(6, 0, "K");
    else c.set(10, 2, "K");
    out.push(ground(c));
  });
  return out;
}

/** Storyboard panel on a little wooden easel; two sets of stick-figure sketches. */
function decoStoryboard(): Cv[] {
  const out: Cv[] = [];
  for (let v = 0; v < 2; v++) {
    const c = new Cv(12, 16);
    // easel legs (A-frame) + back leg
    c.line(2, 15, 4, 8, "H");
    c.line(9, 15, 7, 8, "d");
    c.line(6, 14, 6, 10, "d");
    // board
    c.rect(1, 2, 10, 9, "W");
    c.rect(1, 2, 10, 1, "w");
    // panel grid
    c.line(6, 3, 6, 10, "g");
    c.line(2, 6, 10, 6, "g");
    // sketches
    if (v === 0) {
      // stick figure, a speech bubble, a big "!" panel, a sun
      c.set(3, 3, "1").set(3, 4, "1").set(2, 5, "1").set(4, 5, "1");
      c.set(8, 3, "G").set(9, 3, "G").set(8, 4, "G");
      c.set(3, 7, "r").set(3, 8, "r").set(3, 10, "r");
      c.set(8, 8, "1").set(9, 7, "1").set(8, 9, "G").set(9, 9, "1");
    } else {
      // a truck doodle (of course), a heart, explosion lines, a stick figure running
      c.rect(2, 4, 3, 1, "1");
      c.set(4, 3, "1").set(2, 5, "G").set(4, 5, "G");
      c.set(8, 3, "p").set(9, 3, "p").set(8, 4, "p");
      c.set(3, 8, "1").set(2, 7, "G").set(4, 7, "G").set(2, 9, "G").set(4, 9, "G");
      c.set(8, 7, "1").set(8, 8, "1").set(9, 9, "1").set(7, 9, "1");
    }
    // tray ledge under the board
    c.rect(1, 11, 10, 1, "H");
    c.selout({ W: "G", w: "G", g: "G", H: "1", d: "1", h: "1" }, "1");
    out.push(ground(c));
  }
  return out;
}

/** Broken dramatic column: fluted shaft, plinth, jagged snapped top. f1 shorter + a fallen chunk. */
function brokenPillar(v: number): Cv {
  const c = new Cv(12, 32);
  const top = v === 0 ? 4 : 13;
  // plinth
  c.rect(1, 28, 10, 3, (x, y) => (y === 28 ? "A" : x < 3 ? "D" : x > 8 ? "L" : "J"));
  c.rect(2, 26, 8, 2, (x, y) => (y === 26 ? "A" : x < 4 ? "D" : x > 7 ? "L" : "J"));
  // shaft with flutes (vertical grooves), lit from the left
  for (let y = top; y < 26; y++)
    for (let x = 3; x <= 8; x++) {
      let k = x === 3 ? "A" : x === 8 ? "L" : x === 7 ? "J" : "D";
      if ((x === 5 || x === 7) && y > top + 1) k = x === 5 ? "J" : "L"; // flute grooves
      c.set(x, y, k);
    }
  // jagged snapped top
  const jag = v === 0 ? [0, 2, 1, 3, 0, 2] : [1, 0, 2, 0, 3, 1];
  for (let i = 0; i < 6; i++) for (let y = top; y < top + jag[i]; y++) c.set(3 + i, y, ".");
  // broken top face (lit)
  for (let i = 0; i < 6; i++) c.set(3 + i, top + jag[i], i < 3 ? "A" : "D");
  // a dramatic crack down the shaft
  const cy0 = top + 5;
  c.pts(
    [
      [4, cy0],
      [5, cy0 + 1],
      [5, cy0 + 2],
      [4, cy0 + 3],
      [4, cy0 + 4],
    ],
    "M",
  );
  if (v === 1) {
    // fallen chunk lying beside it
    c.rect(9, 28, 2, 2, "D");
    c.set(9, 28, "A").set(10, 29, "J");
    c.rect(0, 29, 2, 2, "J");
    c.set(0, 29, "D");
  }
  c.selout({ A: "L", D: "L", J: "M", L: "1", M: "1" }, "1");
  return ground(c);
}

const GLITCH_PAL: Record<string, string> = {
  "(": "#ff4fd8", // magenta split
  ")": "#4ff0ff", // cyan split
  "[": "#f2eaff", // crystal light
  "]": "#c9b8ff", // crystal mid
  "{": "#8f7ae0", // crystal shade
};

/** Glitch crystal: a pale crystal with magenta/cyan RGB-split edges. f1 = rows pixel-shifted. */
function glitchCrystal(shiftRows: boolean): Cv {
  const base = Cv.of(`
........
....[...
...[]{..
...[]{..
...[]{..
.[.[]{..
.[{[]{..
.[{[]{..
.[][]{..
.[[[]{..
..[]{...
........`);
  const c = new Cv(8, 12);
  // RGB split: a magenta copy 1px left and a cyan copy 1px right, under the crystal
  c.put(base.clone().map({ "[": "(", "]": "(", "{": "(" }), -1, 0);
  c.put(base.clone().map({ "[": ")", "]": ")", "{": ")" }), 1, 0);
  c.put(base, 0, 0);
  c.set(4, 3, "w").set(2, 6, "w");
  if (shiftRows) {
    // a glitch band: two rows slide sideways
    const rowsToShift = [4, 8];
    for (const y of rowsToShift) {
      const row = Array.from({ length: 8 }, (_, x) => c.get(x, y));
      for (let x = 0; x < 8; x++) c.set(x, y, row[(x - 2 + 8) % 8] ?? ".");
    }
  }
  return ground(c);
}

/**
 * Tree drawn as an unfinished pencil sketch: construction circles for the
 * canopy, a few scribbled leaf clusters, a two-line trunk, a centre guide
 * and a ground line. f1 = canopy swayed 1px.
 */
function sketchTree(sway: number): Cv {
  const c = new Cv(32, 40);
  const ring = (cx: number, cy: number, r: number, k: string, gap = 0) => {
    const n = Math.ceil(r * 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (gap && Math.sin(a * 3 + gap) > 0.82) continue; // broken pencil line
      c.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.92), k);
    }
  };
  const s = sway;
  // centre guide line (faint) through the whole tree
  for (let y = 1; y < 22; y += 2) c.set(16, y, "K");
  // ground line
  for (let x = 8; x <= 24; x++) if (x % 5 !== 0) c.set(x, 39, "K");
  // trunk: two pencil lines with a little root flare and bark ticks
  for (let y = 22; y <= 38; y++) {
    const w = y > 35 ? 3 : 2;
    c.set(15 - w + (y < 28 ? 1 : 0), y, "T");
    c.set(17 + w - (y < 28 ? 1 : 0) - 0, y, "T");
  }
  c.set(12, 38, "T").set(20, 38, "T");
  c.set(16, 30, "K").set(15, 26, "K").set(17, 34, "K");
  // canopy: overlapping construction circles
  ring(16 + s, 12, 9, "T", 1);
  ring(10 + s, 16, 5, "K");
  ring(22 + s, 16, 5, "K");
  ring(16 + s, 7, 5, "K", 2);
  // scribbled leaf clusters (hatched, only a few: the budget ran out)
  const scrib = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) if ((x + y) % 2 === 0 && (x * 3 + y) % 5 !== 0) c.set(x + s, y, "S");
  };
  scrib(9, 9, 5, 3);
  scrib(18, 6, 4, 3);
  scrib(19, 15, 4, 2);
  // a couple of loose leaf strokes
  c.set(7 + s, 7, "S").set(8 + s, 6, "S").set(25 + s, 9, "S").set(26 + s, 10, "S");
  // the tell-tale "?" scribble a storyboard artist left in the corner
  c.pts(
    [
      [26, 2],
      [27, 1],
      [28, 2],
      [27, 3],
      [27, 5],
    ],
    "K",
  );
  return c;
}

// --------------------------------------------------------------------------
// props
// --------------------------------------------------------------------------

/**
 * Clapperboard reading 'TAKE 47': striped clapper sticks (slightly open) on a
 * dark slate. "TAKE" in a 3x3 micro font (letters alternate white/lavender so
 * they separate without gaps), "47" big underneath.
 */
function propClapboard(): Cv {
  const c = new Cv(14, 14);
  // clapper stick (lifted at the right) + hinge
  c.put(
    `
.......wwww2.
..ww22ww22...
ww22ww22.....`,
    0,
    0,
  );
  c.set(0, 3, "g");
  // lower stick
  c.put(`ww22ww22ww22w`, 0, 3);
  // slate
  c.rect(0, 4, 13, 10, "2");
  const TAKE = [
    ["###", ".#.", ".#."],
    [".#.", "###", "#.#"],
    ["#.#", "##.", "#.#"],
    ["###", "##.", "###"],
  ];
  TAKE.forEach((g, i) =>
    g.forEach((row, y) => [...row].forEach((ch, x) => ch === "#" && c.set(1 + i * 3 + x, 5 + y, i % 2 ? "j" : "W"))),
  );
  const D47 = [
    ["#.#", "#.#", "###", "..#", "..#"],
    ["###", "..#", ".#.", ".#.", ".#."],
  ];
  D47.forEach((g, i) => g.forEach((row, y) => [...row].forEach((ch, x) => ch === "#" && c.set(3 + i * 4 + x, 9 + y, "w"))));
  c.selout({ w: "G", W: "G", g: "2", G: "2", "2": "1", j: "1" }, "1");
  return ground(c);
}

const TV_PAL: Record<string, string> = {
  "(": "#4ff0ff",
  ")": "#ff4fd8",
};

/** Old CRT TV with rabbit ears: f0 colour bars, f1 static. */
function propCrtTv(f: number): Cv {
  const c = new Cv(14, 14);
  // rabbit-ear antenna
  c.line(6, 3, 3, 0, "G").line(7, 3, 10, 0, "G");
  c.set(3, 0, "w").set(10, 0, "w");
  // cabinet (wood-ish violet) with a rounded screen bezel
  c.rect(1, 3, 12, 9, (x, y) => (y === 3 ? "g" : x === 1 ? "g" : x === 12 ? "2" : "G"));
  c.rect(2, 4, 8, 6, "2");
  // knobs on the right
  c.set(11, 5, "y").set(11, 7, "W").set(11, 9, "2");
  // legs
  c.set(2, 12, "2").set(11, 12, "2").set(2, 13, "2").set(11, 13, "2");
  // screen content
  const BARS = ["w", "y", "(", "l", ")", "r", "u"];
  for (let y = 5; y <= 8; y++)
    for (let x = 3; x <= 8; x++) {
      if (f === 0) c.set(x, y, y === 8 ? (x % 2 ? "U" : "2") : BARS[x - 3]);
      else {
        const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const n = h - Math.floor(h);
        c.set(x, y, n > 0.66 ? "w" : n > 0.33 ? "g" : "G");
      }
    }
  // screen glare
  c.set(3, 5, f === 0 ? "w" : "w");
  c.selout({ g: "2", G: "2", W: "2", "2": "1", w: "G", y: "O" }, "1");
  return c;
}

export const sprites: SpriteDef[] = [
  spr("tile_finale", 16, 16, tileFinale(), "center", { pal: PAPER_PAL, fps: 1 }),
  spr("deco_film_reel", 10, 10, decoFilmReel(), "feet", { fps: 1 }),
  spr("deco_sketch_bush", 12, 10, decoSketchBush(), "feet", { fps: 1, pal: DECO_PAL }),
  spr("deco_storyboard", 12, 16, decoStoryboard(), "feet", { fps: 1 }),
  spr("deco_broken_pillar", 12, 32, [brokenPillar(0), brokenPillar(1)], "feet", { fps: 1, pal: DECO_PAL }),
  spr("deco_glitch_crystal", 8, 12, [glitchCrystal(false), glitchCrystal(true)], "feet", { fps: 4, pal: GLITCH_PAL }),
  spr("deco_sketch_tree", 32, 40, [sketchTree(0), sketchTree(1)], "feet", { fps: 2, pal: DECO_PAL }),
  spr("prop_clapboard", 14, 14, [propClapboard()], "feet", { fps: 1 }),
  spr("prop_crt_tv", 14, 14, [propCrtTv(0), propCrtTv(1)], "feet", { fps: 2, pal: TV_PAL }),
];
