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
import { Cv, spr, part, stack } from "./s2-stages-b-util";

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
  c.set(L[0], 14 - L[1], "2").set(L[0] + 1, 14 - L[1], "2").set(L[2], 14 - L[3], "2").set(L[2] + 1, 14 - L[3], "2"); // boots
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
// A cute chibi mascot drawn badly on purpose: one huge sparkly eye and one
// dot eye placed too high, the mouth slid onto the cheek, an arm sprouting
// from the wrong side of the head, legs of different lengths, a
// magenta/black missing-texture patch where half the face should be, and
// RGB-split fringes (red copy left, cyan copy right). Each frame a different
// band of rows slips 1px and the split offsets change: deliberate jitter.
const ERR_PAL: Record<string, string> = {
  "{": "#ff3b6b", // red split
  "}": "#3bf0ff", // cyan split
  "<": "#ff4fd8", // missing-texture magenta
};
const ERR_BASE = `
................
.......pq.......
.....qqpppp..s..
....qpppppPP.s..
...qpppppppPPs..
...pptpptpPPPs..
...ptsssssskP...
...psssssssk....
...psssssssk....
....ssssssk.....
.....WWWWg......
....WWWWWgg.....
.....WWWgg......
.....s...s......
.....s..........
................`;

function animationError(f: number): Cv {
  const base = Cv.of(ERR_BASE);
  // jitter: a band of rows slips sideways by 1px (different band each frame)
  const slips: Record<number, number>[] = [{}, { 2: 1, 3: 1, 4: 1 }, { 11: -1, 12: -1, 13: -1, 14: -1 }, { 6: 1, 7: 1 }];
  const body = new Cv(16, 16);
  base.each((x, y, k) => {
    if (k !== ".") body.set(x + (slips[f][y] ?? 0), y, k);
    return null;
  });
  body.outline("1");
  // RGB split fringes under the outlined silhouette
  const red = body.clone().map(Object.fromEntries([..."1pqPtskWgw0<"].map((k) => [k, "{"])));
  const cyan = body.clone().map(Object.fromEntries([..."1pqPtskWgw0<"].map((k) => [k, "}"])));
  const rdx = [-1, -1, -2, -1][f];
  const cdx = [1, 2, 1, 1][f];
  const rdy = [0, 0, 0, 1][f];
  const c = new Cv(16, 16);
  c.put(red, rdx, rdy).put(cyan, cdx, 0).put(body, 0, 0);
  const eo = slips[f][7] ?? 0;
  // the huge sparkly eye (left) and the tiny dot eye (too high, right)
  c.put(
    `
000
0wU
0uw`,
    4 + eo,
    6,
  );
  c.set(9 + (slips[f][5] ?? 0), 5, "0");
  // mouth slid onto the cheek, sideways
  c.set(10 + eo, 7, "1").set(10 + eo, 8, "R");
  c.set(4 + eo, 9, "b");
  // missing-texture checker patch (2px squares) over the right of the face
  for (let y = 7; y < 11; y++)
    for (let x = 8; x < 12; x++) {
      const sx = x + (slips[f][y] ?? 0);
      if ("stkpPWg".includes(c.get(sx, y))) c.set(sx, y, ((x >> 1) + (y >> 1)) % 2 ? "<" : "0");
    }
  return c;
}

// ============================================================================ MINI TRUCK-KUN
// A tiny, angrier Truck-kun: white cargo box + cab-over cab (outlined as
// separate layers like the real one), a RED racing stripe, furious eyes
// painted in the windshield. f0-1 drive (wheel bolts turn, body bobs),
// f2 headlights flash (the lane telegraph: eyes glare red, headlight burst),
// f3 boost (exhaust flame + speed puffs).
const TRUCK_PAL: Record<string, string> = {
  "(": "#fff7b0", // flash core
  ")": "#ffe14dc0", // flash glow (translucent)
  "~": "#c9d6ff", // windshield glare
};
const MT_BOX = `
wwwwwwwwwww
wWWWWWWWWWg
wWWqWpWqWWg
wWWWqpPWWWg
wWWWWPWWWWg
wWWWWWWWWWg
wWWWWWWWWWg
rrrrrrrrrrr
RRRRRRRRRRR
ggggggggggg`;
const MT_CAB = `
wwwww..
wwwwwW.
waaaav~
waaaavW
waaaavW
waaaavW
rrrrrry
RRRRRRY
gggggGG`;
const MT_WHEEL = `
.000.
0GgG0
0gWg0
0GgG0
.000.`;

function miniTruck(f: number): Cv {
  const bob = f === 1 ? 1 : 0;
  const box = part(24, 16, MT_BOX, 3, 2 + bob);
  const cab = part(24, 16, MT_CAB, 14, 3 + bob);
  const c = stack(24, 16, box, cab);
  // bumper
  c.set(21, 11 + bob, "G").set(22, 11 + bob, "1").set(21, 12 + bob, "1").set(21, 10 + bob, "1");
  // exhaust pipe stub at the back
  c.set(2, 11 + bob, "G").set(1, 11 + bob, "1");
  // furious eyes in the windshield: brows slashing down to the middle ('\ /'), 2x2 eyes with a glint
  const ey = 5 + bob;
  const eye = f === 2 ? "r" : "n";
  const glint = f === 2 ? "z" : "w";
  c.set(15, ey, "1").set(16, ey + 1, "1").set(19, ey, "1").set(18, ey + 1, "1");
  for (const ex of [15, 18]) c.set(ex, ey + 2, eye).set(ex + 1, ey + 2, glint).set(ex, ey + 3, eye).set(ex + 1, ey + 3, eye);
  // wheels (bolt pixel orbits)
  const bolts: [number, number][] = [
    [1, 1],
    [3, 1],
    [3, 3],
    [1, 3],
  ];
  const ph = [0, 1, 2, 3][f];
  for (const [wx, k] of [
    [4, 0],
    [15, 1],
  ] as [number, number][]) {
    c.put(MT_WHEEL, wx, 11);
    const [bx, by] = bolts[(ph + k) & 3];
    c.set(wx + bx, 11 + by, "w");
    c.set(wx - 1, 12, "1").set(wx + 5, 12, "1");
  }
  if (f === 2) {
    // headlight burst: the lane telegraph
    c.set(20, 9, "w").set(20, 10, "z");
    c.put(
      `
.).
)()
.).`,
      21,
      8,
    );
    c.set(23, 9, ")").set(22, 7, ")").set(22, 11, ")");
  }
  if (f === 3) {
    // boost: flame out of the exhaust + speed puffs
    c.put(
      `
.Oo
oyz
.Oo`,
      0,
      10,
    );
    c.set(0, 4, "g").set(1, 4, "g").set(0, 7, "W");
  }
  return c;
}

export const sprites: SpriteDef[] = [
  spr("en_filler_goon", 16, 16, [0, 1, 2, 3].map(goon), "feet", { pal: GOON_PAL }),
  spr("en_plot_hole", 24, 24, [0, 1, 2, 3].map(plotHole), "feet", { pal: HOLE_PAL }),
  spr("en_animation_error", 16, 16, [0, 1, 2, 3].map(animationError), "feet", { pal: ERR_PAL }),
  spr("en_mini_truck", 24, 16, [0, 1, 2, 3].map(miniTruck), "feet", { pal: TRUCK_PAL }),
];
