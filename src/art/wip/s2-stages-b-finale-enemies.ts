/**
 * The Final Arc enemies (owner: s2-stages-b): Filler Episode Goon, Plot Hole,
 * Animation Error and Mini Truck-kun. Art direction + gameplay tells:
 * docs/content/enemies.md §4.
 *
 * All face RIGHT, feet pivot (w/2, h-1). The stage ground is dark violet
 * storyboard paper with pale "unfinished" patches, so every enemy carries a
 * light fill or bright edge colour that reads on both.
 */
import type { SpriteDef } from "../format";
import { Cv, spr } from "./s2-stages-b-util";

// ============================================================================ FILLER EPISODE GOON
// Deliberately low detail: two flat tones, two dot eyes, the upper body is the
// SAME drawing on every frame (limited animation) and only the legs move.
const GOON_PAL: Record<string, string> = {
  "(": "#c3b9e0", // suit light
  ")": "#9d92c4", // suit base
  "[": "#7a6ea3", // suit shade
};

function goonUpper(): Cv {
  const c = new Cv(16, 16);
  // head: a plain rounded balaclava, same colour as the suit
  c.ellipse(8, 5.5, 4.2, 3.8, (x, y) => (x + y < 10 ? "(" : x > 10 || y > 7 ? "[" : ")"));
  // body: boxy jumpsuit with broad shoulders
  c.rect(5, 9, 7, 4, (x) => (x === 5 ? "(" : x >= 10 ? "[" : ")"));
  c.rect(4, 9, 9, 1, (x) => (x <= 5 ? "(" : x >= 11 ? "[" : ")"));
  // stiff arms at the sides, fists
  c.rect(3, 10, 1, 3, "(").rect(13, 10, 1, 3, "[");
  c.set(3, 12, "G").set(13, 12, "G");
  // belt (the one 'detail')
  c.rect(5, 12, 7, 1, "G");
  return c;
}

function goon(f: number): Cv {
  const c = new Cv(16, 16);
  const L = [
    // [left foot x, left lift, right foot x, right lift]
    [6, 0, 9, 0],
    [5, 0, 10, 1],
    [6, 0, 9, 0],
    [5, 1, 10, 0],
  ][f];
  c.rect(L[0], 13 - L[1], 2, 2, "[");
  c.rect(L[2], 13 - L[3], 2, 2, ")");
  c.set(L[0], 14 - L[1], "G").set(L[0] + 1, 14 - L[1], "G").set(L[2], 14 - L[3], "G").set(L[2] + 1, 14 - L[3], "G"); // boots
  c.put(goonUpper(), 0, 0);
  c.outline("1");
  // two dot eyes looking right, nothing else
  c.set(9, 5, "0").set(11, 5, "0");
  return c;
}

// ============================================================================ PLOT HOLE
// A torn hole in the storyboard: white ragged paper rim around a swirling
// black-violet vortex (4 arms; each frame turns it 22.5 deg so the loop is
// seamless), one confused eye floating in the middle.
const HOLE_PAL: Record<string, string> = {
  "(": "#120a24", // vortex deep
  ")": "#2c1a52", // vortex body
  "[": "#743fd1", // swirl arm
  "]": "#b47cff", // swirl arm lit
  "{": "#e2d6ff", // swirl glint
};

function plotHole(f: number): Cv {
  const c = new Cv(24, 24);
  const cx = 11.5;
  const cy = 14.5;
  const rx = 9.6;
  const ry = 6.8;
  const rot = (f * Math.PI) / 8;
  // irregular torn outline: radius wobbles with angle, plus sharp paper shards
  const tear = (a: number) => 1 + 0.07 * Math.sin(a * 3 + 0.7) + 0.05 * Math.sin(a * 7 + 2.1);
  const shard = (a: number) => {
    const k = (a / (Math.PI * 2) + 1) * 9;
    const t = k - Math.floor(k);
    return Math.max(0, 0.22 - Math.abs(t - 0.5) * 0.9) * (Math.floor(k) % 2 ? 1 : 0.6);
  };
  c.each((x, y) => {
    const dx = (x + 0.5 - (cx + 0.5)) / rx;
    const dy = (y + 0.5 - (cy + 0.5)) / ry;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const hole = tear(a);
    if (d > hole + shard(a) + 0.13) return null;
    if (d > hole) return dy < 0.15 ? "w" : "W"; // torn paper lip + shards (shaded underside)
    // vortex: 4 logarithmic spiral arms, brighter toward the rim
    const t = a + Math.log(Math.max(0.05, d)) * 2.6 - rot;
    const arm = Math.cos(t * 4);
    if (d < 0.16) return "(";
    if (arm > 0.6) return d > 0.5 ? "]" : "[";
    if (arm > 0.15) return d > 0.35 ? "[" : ")";
    return d > 0.6 ? ")" : "(";
  });
  // glints riding the arms
  for (let i = 0; i < 4; i++) {
    const a = rot * 1.2 + (i * Math.PI) / 2 + 0.5;
    const x = Math.round(cx + Math.cos(a) * rx * 0.7);
    const y = Math.round(cy + Math.sin(a) * ry * 0.7);
    if ("()[]".includes(c.get(x, y))) c.set(x, y, "{");
  }
  c.outline("1");
  // paper flecks being sucked in (move between frames)
  const flecks: [number, number][] = [
    [2, 8],
    [21, 9],
    [4, 21],
    [20, 20],
  ];
  flecks.forEach(([x, y], i) => {
    const k = (f + i) % 4;
    const px = Math.round(x + (cx - x) * k * 0.08);
    const py = Math.round(y + (cy - y) * k * 0.08);
    if (c.get(px, py) === ".") c.set(px, py, "W");
  });
  // the confused eye floating in the middle: big sclera, violet iris glancing up-right, heavy lid
  const eye = new Cv(24, 24);
  eye.ellipse(11.5, 12.5, 4.4, 3.3, "w");
  eye.each((x, y, k) => (k === "w" && y >= 15 ? "W" : null));
  eye.outline("1");
  c.put(eye, 0, 0);
  c.put(
    `
.iii
iI00
iI0w
.ii.`,
    11,
    10,
  );
  for (let x = 9; x <= 15; x++) c.set(x, 9, "1"); // heavy upper lid (deadpan squint)
  // one raised wavy brow + a tiny "?" thought
  c.set(8, 6, "1").set(9, 5, "1").set(10, 6, "1").set(11, 5, "1").set(12, 6, "1");
  c.put(
    `
ww.
..w
.w.
...
.w.`,
    17,
    3,
  );
  return c;
}

// ============================================================================ ANIMATION ERROR
// A cute blob mascot drawn badly on purpose: eyes of different sizes, an arm
// growing out of its head, a magenta/black missing-texture patch, RGB-split
// edges (red copy left, cyan copy right). Each frame jitters random rows 1px.
const ERR_PAL: Record<string, string> = {
  "(": "#ffd0e4", // body light
  ")": "#ffa8cd", // body base
  "[": "#e07fb0", // body shade
  "{": "#ff3b6b", // red split
  "}": "#3bf0ff", // cyan split
  "<": "#ff4fd8", // missing-texture magenta
};

function errorBody(): Cv {
  const c = new Cv(16, 16);
  // lopsided blob body
  c.ellipse(7.6, 9.6, 4.8, 4.4, (x, y) => ((x - 7.6) + (y - 9.6) < -3 ? "(" : (x - 7.6) * 0.6 + (y - 9.6) > 2.2 ? "[" : ")"));
  c.ellipse(9.5, 8, 2.6, 2.4, ")");
  // an arm sprouting from the top of the head (wrong place)
  c.rect(6, 3, 1, 2, ")");
  c.set(5, 2, ")").set(7, 2, ")");
  // one stubby leg on the side instead of below
  c.rect(12, 11, 2, 1, "[");
  c.set(4, 14, "[").set(5, 14, "[");
  // missing-texture checker patch (2px squares)
  for (let y = 10; y < 14; y++) for (let x = 5; x < 9; x++) c.set(x, y, ((x >> 1) + (y >> 1)) % 2 ? "<" : "0");
  return c;
}

function animationError(f: number): Cv {
  const body = errorBody();
  // jitter: a few rows slip sideways by 1px (deterministic per frame)
  const slips: Record<number, number>[] = [{ 4: 1, 11: -1 }, { 7: -1, 12: 1, 13: 1 }, { 3: -1, 9: 1 }, { 5: 1, 6: 1, 14: -1 }];
  const j = new Cv(16, 16);
  body.each((x, y, k) => {
    if (k !== ".") j.set(x + (slips[f][y] ?? 0), y, k);
    return null;
  });
  const c = new Cv(16, 16);
  // RGB split fringes (offset swaps between frames)
  const rdx = f % 2 === 0 ? -1 : -1;
  const cdx = f === 1 ? 1 : f === 3 ? 2 : 1;
  const rdy = f === 2 ? 1 : 0;
  c.put(j.clone().map({ "(": "{", ")": "{", "[": "{", "<": "{", "0": "{" }), rdx, rdy);
  c.put(j.clone().map({ "(": "}", ")": "}", "[": "}", "<": "}", "0": "}" }), cdx, 0);
  c.put(j, 0, 0);
  c.outline("1");
  // face, off-model: one huge eye, one tiny eye, mouth on the cheek
  const ex = (slips[f][8] ?? 0) + (slips[f][7] ?? 0);
  c.put(
    `
0000
0ww0
0w00
0000`,
    8 + ex,
    6,
  );
  c.set(5, 8, "0");
  c.set(11, 11, "1").set(12, 11, "1").set(12, 10, "1");
  c.set(4, 9, "b");
  return c;
}

// ============================================================================ MINI TRUCK-KUN
// A tiny, angrier Truck-kun: white cargo box + cab-over cab, RED racing stripe,
// furious eyes painted in the windshield. f0-1 drive (wheel bolts turn),
// f2 headlights flash (the lane telegraph), f3 boost (exhaust flame).
const TRUCK_PAL: Record<string, string> = {
  "(": "#fff7b0", // headlight beam core
  ")": "#ffe14d80", // beam glow (translucent)
};

function wheel(c: Cv, x: number, y: number, phase: number): void {
  c.put(
    `
.000.
0GgG0
0gWg0
0GgG0
.000.`,
    x,
    y,
  );
  const bolts: [number, number][] = [
    [1, 1],
    [3, 1],
    [3, 3],
    [1, 3],
  ];
  const [bx, by] = bolts[phase & 3];
  c.set(x + bx, y + by, "w");
}

function miniTruck(f: number): Cv {
  const c = new Cv(24, 16);
  const bob = f === 1 ? 1 : 0;
  const body = new Cv(24, 16);
  // cargo box
  body.rect(3, 1 + bob, 11, 10, (x, y) => (y === 1 + bob || x === 3 ? "w" : y >= 9 + bob ? "g" : x === 8 ? "g" : "W"));
  // cab (cab-over, rounded front top), a little lower than the box
  body.rect(14, 3 + bob, 7, 8, (x, y) => (x >= 20 && y > 4 + bob ? "W" : y >= 9 + bob ? "g" : "w"));
  body.set(20, 3 + bob, ".");
  // windshield (tall enough for proper anime eyes)
  body.rect(15, 4 + bob, 5, 4, "a");
  body.set(19, 4 + bob, "v").set(19, 7 + bob, "v");
  // red racing stripe across box and cab
  for (let x = 3; x <= 20; x++) {
    if (body.get(x, 8 + bob) !== ".") body.set(x, 8 + bob, "r");
    if (body.get(x, 9 + bob) !== ".") body.set(x, 9 + bob, "R");
  }
  // bumper + headlight
  body.rect(21, 9 + bob, 1, 2, "G");
  body.set(20, 7 + bob, f === 2 ? "w" : "y").set(20, 6 + bob, f === 2 ? "z" : "W");
  // exhaust pipe at the back
  body.set(2, 10 + bob, "G");
  // winged heart on the box
  body.put(
    `
q.p.q
.ppP.
..P..`,
    6,
    3 + bob,
  );
  body.outline("1");
  c.put(body, 0, 0);
  // furious eyes painted in the windshield: brows slashing down to the middle, 2px eyes
  const ey = 5 + bob;
  c.set(15, ey - 1, "1").set(16, ey, "1"); // left brow
  c.set(19, ey - 1, "1").set(18, ey, "1"); // right brow
  const eyeK = f === 2 ? "r" : "0";
  c.set(15, ey + 1, eyeK).set(16, ey + 1, eyeK).set(16, ey + 2, eyeK);
  c.set(18, ey + 1, eyeK).set(19, ey + 1, eyeK).set(18, ey + 2, eyeK);
  c.set(16, ey + 1, "w").set(19, ey + 1, "w");
  // wheels
  const ph = [0, 2, 3, 1][f];
  wheel(c, 4, 11, ph);
  wheel(c, 15, 11, ph + 1);
  // headlight flash: a fan of light in front (the lane telegraph frame)
  if (f === 2) {
    c.put(
      `
..)
.)(
)((
.)(
..)`,
      21,
      4,
    );
    c.set(21, 6, "w");
  }
  // boost: exhaust flame out of the back
  if (f === 3) {
    c.put(
      `
.Oo
oyy
zyw
oyy
.Oo`,
      0,
      8,
    );
  }
  return c;
}

export const sprites: SpriteDef[] = [
  spr("en_filler_goon", 16, 16, [0, 1, 2, 3].map(goon), "feet", { pal: GOON_PAL }),
  spr("en_plot_hole", 24, 24, [0, 1, 2, 3].map(plotHole), "feet", { pal: HOLE_PAL }),
  spr("en_animation_error", 16, 16, [0, 1, 2, 3].map(animationError), "feet", { pal: ERR_PAL }),
  spr("en_mini_truck", 24, 16, [0, 1, 2, 3].map(miniTruck), "feet", { pal: TRUCK_PAL }),
];
