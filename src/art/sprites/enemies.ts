/**
 * Enemy sprites (owner: chars): cute-but-mischievous Nightmare Plushies.
 * All face RIGHT, feet pivot (w/2, h-1). Floating enemies are drawn high in
 * their box; code draws the ground shadow at the pivot.
 *
 * Round bodies use the directional `ball` shader (light from top-left), then a
 * plum outline; faces and details are hand-pixelled on top.
 */
import type { SpriteDef } from "../format";
import { Pix, ball, gridSprite } from "./chars-util";

/** Outline whatever is on `p` and return it. */
function ol(p: Pix, key = "1"): Pix {
  return p.outline(key);
}

// ============================================================================ PUFF (mint slime)
// hop cycle: rest -> stretch/launch -> airborne -> landing squash
const PUFF_RAMP = ["C", "c", "a", "a"];
const PUFF_POSE: { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 7.5, cy: 10.5, rx: 6.5, ry: 4.6 },
  { cx: 7.5, cy: 8.6, rx: 5.0, ry: 5.8 },
  { cx: 7.5, cy: 7.4, rx: 5.8, ry: 5.0 },
  { cx: 7.5, cy: 11.6, rx: 7.2, ry: 3.6 },
];
function puff(i: number): Pix {
  const { cx, cy, rx, ry } = PUFF_POSE[i];
  const p = new Pix(16, 16);
  ball(p, cx, cy, rx, ry, PUFF_RAMP, { spec: "w", specAt: 0.9 });
  // jelly rim light on the bottom edge
  p.each((x, y, k) => (k !== "." && !p.solid(x, y + 1) && x > cx - rx + 2 && x < cx + 1 ? "a" : null));
  const top = Math.round(cy - ry);
  // leaf sprout
  p.set(cx - 1, top - 1, "e").set(cx, top - 1, "l").set(cx, top - 2, "l").set(cx + 1, top - 2, "m");
  ol(p);
  // face (shifted right: it looks where it goes)
  const ey = Math.round(cy - (i === 3 ? 0 : 1));
  const ex = Math.round(cx + 1);
  p.set(ex - 1, ey, "0").set(ex + 2, ey, "0");
  if (i !== 3) p.set(ex - 1, ey + 1, "0").set(ex + 2, ey + 1, "0");
  p.set(ex - 1, ey - (i === 3 ? 0 : 0), "0");
  p.set(ex - 2, ey + (i === 3 ? 1 : 2), "b").set(ex + 3, ey + (i === 3 ? 1 : 2), "b");
  p.set(ex, ey + (i === 3 ? 1 : 2), "1").set(ex + 1, ey + (i === 3 ? 1 : 2), "1");
  // eye shine
  if (i !== 3) p.set(ex - 1, ey, "n").set(ex + 2, ey, "n");
  return p;
}

// ============================================================================ BATBUN
// right-side (front) wing poses; the back wing is the mirrored, darker copy
const BAT_WING = [
  `
....11
...1I1
..1II1
1IIII1
1I1I1.
.1.1..
`,
  `
.......
.......
111111.
1IIIII1
1I1I1I1
.1.1.1.
`,
  `
......
......
111...
1II1..
1III1.
.1III1
..1.11
`,
];
const BAT_EARS = [
  `
.11..11.
1qi11qi1
1qi11qi1
1qi11qi1
.1i11i1.
`,
  `
..11..11.
.1qi11qi1
1qi11qi1.
1qi11qi1.
.1i11i1..
`,
];
function batbun(i: number): Pix {
  const wingIdx = [0, 1, 2, 1][i];
  const dy = [0, 1, 2, 1][i] - 1; // body bobs opposite to the flap
  const p = new Pix(16, 16);
  const by = 8 - dy;
  // back wing (darker), behind the body on the left
  const wing = Pix.of(BAT_WING[wingIdx], "bat wing");
  p.put(wing.flipX().recolor({ I: "2" }), 0, by - 5);
  // ears (trail back a touch on the downstroke)
  p.put(BAT_EARS[wingIdx === 2 ? 1 : 0], 5, by - 8);
  // body
  const b = new Pix(16, 16);
  ball(b, 8.5, by, 4.6, 4.2, ["I", "i", "i", "j"], { spec: "w", specAt: 0.96 });
  ol(b);
  p.put(b, 0, 0);
  p.set(6, by + 5, "1").set(7, by + 5, "1").set(10, by + 5, "1").set(11, by + 5, "1");
  // front wing on the right
  p.put(wing, 11, by - 5);
  // face
  p.set(9, by - 1, "0").set(12, by - 1, "0").set(9, by, "0").set(12, by, "0");
  p.set(8, by + 1, "b").set(13, by + 1, "b");
  p.set(10, by + 1, "1").set(11, by + 1, "1").set(11, by + 2, "w");
  return p;
}

// ============================================================================ BOO (sheet ghost)
function boo(i: number): Pix {
  const p = new Pix(16, 16);
  const bob = [0, -1, -1, 0][i];
  const cy = 6 + bob;
  // sheet body: dome + skirt that trails into a wavy tail on the left
  const body = new Pix(16, 16);
  ball(body, 8.5, cy, 5.2, 5, ["j", "W", "w"], { spec: "w" });
  body.rect(4, cy, 10, 5, (x, y) => (x > 11 ? "j" : x > 9 ? "W" : "W"));
  // wavy hem: 4 phases
  const hem = [
    [0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
    [1, 0, 0, 1, 1, 0, 0, 1, 1, 0],
    [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
  ][i];
  for (let x = 4; x < 14; x++) if (hem[x - 4]) body.set(x, cy + 5, x > 11 ? "j" : "W");
  // tail curling back (left)
  const tx = [1, 2, 1, 0][i];
  body.set(3, cy + 4, "W").set(2, cy + 5, "W").set(1 + (tx > 1 ? 1 : 0), cy + 6, "j");
  body.set(3, cy + 3, "W").set(2, cy + 4, "W");
  // lavender shadow on the lower right of the skirt
  body.each((x, y, k) => (k === "W" && y > cy + 2 && x > 10 ? "j" : null));
  ol(body);
  p.put(body, 0, 0);
  // face: shy, tongue out
  const fy = cy;
  p.set(9, fy, "0").set(12, fy, "0").set(9, fy + 1, "0").set(12, fy + 1, "0");
  p.set(8, fy + 2, "b").set(13, fy + 2, "b");
  p.set(10, fy + 2, "1").set(11, fy + 2, "1").set(11, fy + 3, "r").set(10, fy + 3, i % 2 ? "p" : "r");
  return p;
}

// ============================================================================ SHROOMIE
function shroom(i: number): Pix {
  const p = new Pix(16, 16);
  const tilt = [0, 1, 0, -1][i];
  const bob = [0, -1, 0, -1][i];
  // feet (waddle)
  const feet = new Pix(16, 16);
  const lf = [0, -1, 0, 0][i];
  const rf = [0, 0, 0, -1][i];
  feet.rect(4, 13 + lf, 3, 2, "H").rect(9, 13 + rf, 3, 2, "H");
  feet.set(4, 13 + lf, "h").set(9, 13 + rf, "h");
  ol(feet);
  p.put(feet, 0, 0);
  // stem body
  const st = new Pix(16, 16);
  ball(st, 8.5, 10.5 + bob, 5, 3.8, ["h", "B", "B"]);
  ol(st);
  p.put(st, 0, 0);
  // cap
  const cap = new Pix(16, 16);
  const ccx = 8 + tilt * 0.6;
  ball(cap, ccx, 6.5 + bob, 7.2, 5, ["R", "r", "r", "r"], { spec: "q", specAt: 0.9 });
  cap.each((_x, y) => (y > 7 + bob ? "." : null));
  cap.rect(1, 7 + bob, 14, 1, (x) => (cap.solid(x, 6 + bob) ? "R" : null));
  // white spots
  const spots: [number, number][] = [[4, 4], [8, 2], [11, 5], [6, 6], [13, 7]];
  for (const [x, y] of spots) {
    const sx = Math.round(x + tilt * 0.6);
    const sy = y + bob;
    if (cap.solid(sx, sy)) cap.set(sx, sy, "w");
    if (cap.solid(sx + 1, sy) && (x === 4 || x === 11)) cap.set(sx + 1, sy, "W");
  }
  ol(cap);
  p.put(cap, 0, 0);
  // grumpy face on the stem: furrowed brows, beady eyes, frown
  const fy = 10 + bob;
  p.set(7, fy - 1, "1").set(8, fy, "1"); // brows slant down toward the middle
  p.set(13, fy - 1, "1").set(12, fy, "1");
  p.set(9, fy, "0").set(9, fy + 1, "0").set(11, fy, "0").set(11, fy + 1, "0");
  p.set(10, fy + 2, "1").set(9, fy + 3, "1").set(11, fy + 3, "1"); // frown
  p.set(7, fy + 2, "b").set(13, fy + 2, "b");
  return p;
}

// ============================================================================ TEDDY BRUTE (24x24)
function teddy(i: number): Pix {
  const p = new Pix(24, 24);
  const bob = [0, 1, 0, 1][i];
  const lLift = [1, 0, 0, 0][i];
  const rLift = [0, 0, 1, 0][i];
  const FUR = ["d", "H", "H", "h"];
  // legs
  const legs = new Pix(24, 24);
  ball(legs, 8, 20.5 - lLift, 2.8, 2.2, FUR);
  ball(legs, 15, 20.5 - rLift, 2.8, 2.2, FUR);
  legs.set(9, 21 - lLift, "h").set(16, 21 - rLift, "h");
  ol(legs);
  p.put(legs, 0, 0);
  // body + arms
  const body = new Pix(24, 24);
  ball(body, 11.5, 15.5 + bob, 7, 5.2, FUR);
  ball(body, 4.5, 14.5 + bob, 2.2, 3, FUR);
  ball(body, 19, 14.5 + bob, 2.2, 3, FUR);
  ol(body);
  p.put(body, 0, 0);
  // belly patch + heart
  p.put(
    `
.rr.rr.
rqrrrrR
rrrrrRR
.rrrRR.
..rRR..
...R...
`,
    9,
    13 + bob,
  );
  // stitches on the body seam
  p.set(6, 17 + bob, "B").set(7, 18 + bob, "B").set(17, 17 + bob, "h").set(16, 18 + bob, "h");
  // head
  const head = new Pix(24, 24);
  ball(head, 6.5, 2.8 + bob, 2.6, 2.4, FUR);
  ball(head, 16.5, 2.8 + bob, 2.6, 2.4, FUR);
  ball(head, 11.5, 7.5 + bob, 7, 5.6, FUR);
  ball(head, 14.5, 10.8 + bob, 3.3, 2.2, ["h", "B", "B"]);
  head.set(6, 2 + bob, "b").set(16, 2 + bob, "b").set(7, 3 + bob, "b").set(17, 3 + bob, "b");
  ol(head);
  p.put(head, 0, 0);
  // face: button eye (left) + stitched X eye (right), nose, stitched smile
  const fy = 5 + bob;
  p.put(
    `
.11.
1Un1
1nn1
.11.
`,
    8,
    fy,
  );
  p.set(9, fy + 1, "U").set(10, fy + 1, "v");
  // stitched X eye
  p.set(13, fy, "1").set(15, fy, "1").set(14, fy + 1, "1").set(13, fy + 2, "1").set(15, fy + 2, "1");
  // nose + stitched smile on the muzzle
  p.set(14, fy + 4, "0").set(15, fy + 4, "0").set(14, fy + 5, "1");
  p.set(13, fy + 6, "1").set(15, fy + 6, "1");
  p.set(12, fy + 3, "b").set(17, fy + 3, "b");
  // seam stitch across the head
  p.set(11, 2 + bob, "d").set(11, 3 + bob, "B").set(11, 4 + bob, "d");
  return p;
}

// ============================================================================ EYEPUFF
function eyepuff(i: number): Pix {
  const p = new Pix(16, 16);
  const bob = [0, -1, 0, 0][i];
  const cy = 6.5 + bob;
  const fluff = new Pix(16, 16);
  const charge = i === 3;
  ball(fluff, 8, cy, 6, 5.6, charge ? ["P", "p", "q"] : ["P", "p", "q", "q"], { spec: "w", specAt: 0.97 });
  // fluffy scalloped edge
  const bumps: [number, number][] = [[2, cy - 3], [5, cy - 6], [10, cy - 6], [13, cy - 3], [14, cy + 1], [12, cy + 5], [4, cy + 5], [1, cy + 1]];
  for (const [x, y] of bumps) ball(fluff, x, y, 1.6, 1.6, ["P", "p", "q"]);
  // little tuft on top
  fluff.set(8, Math.round(cy - 7), "q").set(9, Math.round(cy - 8), "q");
  ol(fluff);
  p.put(fluff, 0, 0);
  // the eye
  const ey = Math.round(cy) - 3;
  if (i === 2) {
    p.put(
      `
.......
.......
.......
1.....1
.11111.
..bbb..
`,
      5,
      ey,
    );
  } else {
    const iris = charge ? { D: "R", M: "r", L: "y", H: "z", K: "O" } : { D: "I", M: "i", L: "j", H: "w", K: "0" };
    p.put(
      Pix.of(`
.11111.
1WDDDW1
WDHMKDW
WDMKKMW
WMMLMMW
.WLLLW.
..bbb..
`).recolor(iris),
      5,
      ey,
    );
    if (charge) {
      p.set(4, ey - 1, "y").set(12, ey - 1, "y").set(8, ey - 2, "z");
    }
  }
  return p;
}

// ============================================================================ PUMPKIN DASHER
function pumpkin(i: number): Pix {
  const p = new Pix(16, 16);
  const dash = i >= 2;
  const bob = [0, -1, 0, 0][i];
  const lean = dash ? 1 : 0;
  // tiny legs
  const legs = new Pix(16, 16);
  if (!dash) {
    const a = i === 0;
    legs.rect(a ? 5 : 6, 13, 2, 2, "2").rect(a ? 10 : 9, 13, 2, 2, "2");
  } else {
    // running stride: legs stretched back and forward
    legs.line(4, 14, 6, 12, "2").line(5, 14, 7, 12, "2");
    legs.line(10, 12, 12, 14, "2").line(11, 12, 13, 14, "2");
  }
  ol(legs);
  p.put(legs, 0, 0);
  // pumpkin head
  const head = new Pix(16, 16);
  const cx = 8 + lean;
  const cy = 7.6 + bob + (dash ? 0.4 : 0);
  ball(head, cx, cy, 6.6, 5.4, ["O", "o", "o", "o"], { spec: "y", specAt: 0.88 });
  // ridges
  head.each((x, y, k) => (k !== "." && (x === Math.round(cx) - 3 || x === Math.round(cx) + 2) && y > cy - 4 ? "O" : null));
  // stem + curl leaf
  const top = Math.round(cy - 5.4);
  head.set(cx - 1, top - 1, "E").set(cx - 1, top - 2, "e").set(cx, top - 2, "e").set(cx + 1, top - 1, "l");
  ol(head);
  p.put(head, 0, 0);
  // carved face (glowing)
  const fx = Math.round(cx);
  const fy = Math.round(cy);
  if (!dash) {
    // mischievous: glowing triangle eyes, toothy grin
    p.set(fx - 2, fy - 3, "0").set(fx - 3, fy - 2, "0").set(fx - 2, fy - 2, "y").set(fx - 1, fy - 2, "0");
    p.set(fx + 2, fy - 3, "0").set(fx + 1, fy - 2, "0").set(fx + 2, fy - 2, "y").set(fx + 3, fy - 2, "0");
    p.set(fx - 3, fy, "0").set(fx + 3, fy, "0");
    p.line(fx - 2, fy + 1, fx + 2, fy + 1, "y");
    p.set(fx - 3, fy + 1, "0").set(fx + 3, fy + 1, "0").set(fx - 1, fy + 1, "0").set(fx + 1, fy + 1, "0");
    p.line(fx - 2, fy + 2, fx + 2, fy + 2, "0");
    p.set(fx - 4, fy - 1, "b").set(fx + 4, fy - 1, "b");
  } else {
    // angry slanted eyes, wide grin
    p.set(fx - 3, fy - 2, "0").set(fx - 2, fy - 1, "0").set(fx - 1, fy - 1, "0").set(fx - 2, fy - 2, "y");
    p.set(fx + 3, fy - 2, "0").set(fx + 2, fy - 1, "0").set(fx + 1, fy - 1, "0").set(fx + 2, fy - 2, "y");
    p.line(fx - 3, fy + 1, fx + 3, fy + 1, "0");
    p.line(fx - 2, fy + 2, fx + 2, fy + 2, "y");
    p.set(fx - 3, fy + 2, "0").set(fx + 3, fy + 2, "0").set(fx, fy + 2, "0");
    // speed puffs behind
    if (i === 3) p.set(0, 9, "W").set(1, 10, "W").set(0, 6, "W");
    else p.set(1, 8, "W").set(0, 11, "W");
  }
  return p;
}

// ============================================================================ CANDLE WISP (12x12)
const WISP_FLAME = [
  `
...1....
..1u1...
..1uv1..
.1uvvi1.
.1uvwvi1
1ivwwvi1
1ivwwvI1
.1ivvI1.
`,
  `
....1...
...1u1..
..1uv1..
.1uvvi1.
1ivvwvi1
1ivwwvi1
1ivwwvI1
.1iivI1.
`,
  `
...11...
..1uu1..
..1uvi1.
.1ivvi1.
.1vwwvi1
1ivwwvi1
1ivwwvI1
.1ivvI1.
`,
  `
..1.....
..1u1...
.1uvi1..
.1uvvi1.
1ivwvvi1
1iwwwvI1
1ivwwvI1
.1ivvI1.
`,
];
function wisp(i: number): Pix {
  const p = new Pix(12, 12);
  const bob = [0, 0, -1, 0][i];
  // candle wax body with drips
  const wax = new Pix(12, 12);
  wax.rect(3, 7 + bob, 6, 4, (x) => (x === 3 ? "w" : x > 6 ? "g" : "W"));
  wax.set(3, 11 + bob, "W").set(7, 11 + bob, "g");
  ol(wax);
  p.put(wax, 0, 0);
  p.put(WISP_FLAME[i], 2, 0 + bob);
  // face on the wax
  p.set(6, 8 + bob, "0").set(8, 8 + bob, "0");
  p.set(5, 9 + bob, "b").set(9, 9 + bob, "b");
  p.set(7, 9 + bob, "1");
  return p;
}

// ============================================================================ SPORE (10x10)
function spore(i: number): Pix {
  const p = new Pix(10, 10);
  const legs = new Pix(10, 10);
  if (i === 0) legs.set(3, 8, "H").set(6, 8, "H");
  else legs.set(2, 8, "H").set(7, 8, "H").set(4, 8, "H");
  ol(legs);
  p.put(legs, 0, 0);
  const st = new Pix(10, 10);
  ball(st, 5, 6.5, 2.8, 2, ["h", "B"]);
  ol(st);
  p.put(st, 0, 0);
  const cap = new Pix(10, 10);
  ball(cap, 5 + (i ? 0.5 : 0), 4, 4, 3, ["R", "r", "r"], { spec: "q", specAt: 0.88 });
  cap.each((_x, y) => (y > 4 ? "." : null));
  cap.set(4, 2, "w").set(7, 3, "w");
  ol(cap);
  p.put(cap, 0, 0);
  p.set(5, 6, "0").set(7, 6, "0");
  return p;
}

// ============================================================================ ULT CAT (Mochi's stampede)
function ultCat(i: number): Pix {
  const p = new Pix(16, 16);
  const FUR = ["g", "W", "w", "w"];
  const bob = [0, -1, -2, -1][i];
  // legs per gallop phase: [backX, backY, frontX, frontY] offsets
  const legsets: [number, number, number, number][][] = [
    [[1, 13, 3, 12], [12, 13, 14, 12]], // extended
    [[4, 13, 5, 12], [10, 13, 11, 12]], // gathering
    [[6, 12, 6, 11], [8, 12, 9, 11]], // gathered (air)
    [[3, 12, 5, 13], [11, 12, 13, 13]], // push-off
  ];
  const legs = new Pix(16, 16);
  for (const [ax, ay, bx, by] of legsets[i]) {
    legs.line(ax, ay + bob + 1, bx, by + bob + 1, "W");
    legs.set(ax, ay + bob + 2, "g");
  }
  ol(legs);
  p.put(legs, 0, 0);
  const body = new Pix(16, 16);
  // tail
  body.line(2, 9 + bob, 0, 5 + bob - (i % 2), "W");
  body.set(1, 4 + bob - (i % 2), "W");
  ball(body, 7, 10 + bob, 5.4, 3.6, FUR);
  ball(body, 11.5, 7 + bob, 3.8, 3.4, FUR, { spec: "w" });
  // ears
  body.set(9, 3 + bob, "W").set(9, 4 + bob, "W").set(10, 4 + bob, "W");
  body.set(13, 3 + bob, "W").set(13, 4 + bob, "W").set(14, 4 + bob, "g");
  ol(body);
  p.put(body, 0, 0);
  p.set(9, 4 + bob, "b").set(13, 4 + bob, "b");
  // face
  p.set(11, 7 + bob, "0").set(14, 7 + bob, "0");
  p.set(12, 8 + bob, "1").set(13, 8 + bob, "1");
  p.set(10, 8 + bob, "b").set(15, 8 + bob, "b");
  return p;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const sprites: SpriteDef[] = [
  gridSprite("en_puff", 16, 16, range(4).map(puff), "feet", { fps: 8 }),
  gridSprite("en_batbun", 16, 16, range(4).map(batbun), "feet", { fps: 12 }),
  gridSprite("en_boo", 16, 16, range(4).map(boo), "feet", { fps: 6 }),
  gridSprite("en_shroom", 16, 16, range(4).map(shroom), "feet", { fps: 7 }),
  gridSprite("en_teddy", 24, 24, range(4).map(teddy), "feet", { fps: 6 }),
  gridSprite("en_eyepuff", 16, 16, range(4).map(eyepuff), "feet", { fps: 5 }),
  gridSprite("en_pumpkin", 16, 16, range(4).map(pumpkin), "feet", { fps: 8 }),
  gridSprite("en_wisp", 12, 12, range(4).map(wisp), "feet", { fps: 10 }),
  gridSprite("en_spore", 10, 10, range(2).map(spore), "feet", { fps: 10 }),
  gridSprite("ult_cat", 16, 16, range(4).map(ultCat), "feet", { fps: 12 }),
];
