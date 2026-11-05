/**
 * Season 2 weapon visuals, part B (owner: s2-items): Baka Harisen, Henshin
 * Burst ribbons, Cheat Fireball / Meteor, HONK wave, Bubble Tea, Paper Cranes,
 * Idol Lightsticks, Kotatsu of Sloth (+ evolutions).
 *
 * Swings / waves / fire follow the bloom recipe of the base weapons (white core
 * -> saturated body -> coloured rim, a few semi-transparent edge pixels);
 * physical objects get the plum outline. Everything faces / opens RIGHT.
 */
import type { SpriteDef } from "../format";
import { Cv, GLOW, LIGHT, hash, inHeart, rgba, spr } from "../sprites/s2-items-util";

const deg = Math.PI / 180;

// ============================================================================ Baka Harisen (32x24, arc opens right)

/**
 * Pleated paper swing: an elliptical band centred left of the sprite; pleats
 * alternate by angle (white / lavender-white), the outer edge has a pink-grey
 * crease, the leading tip carries the folded fan head.
 */
function harisen(f: number): Cv {
  const c = new Cv(32, 24);
  const cx = 6;
  const cy = 12;
  const ax = 25;
  const ay = 11.2;
  const lim = 78 * deg;
  const win = [
    [-lim, -lim * 0.05],
    [-lim, lim],
    [-lim * 0.55, lim],
    [-lim * 0.2, lim],
  ][f];
  const thick = [0.42, 0.5, 0.36, 0.22][f];
  c.each((x, y) => {
    const u = (x - cx) / ax;
    const v = (y - cy) / ay;
    const rho = Math.hypot(u, v);
    const phi = Math.atan2(v, u);
    if (phi < win[0] || phi > win[1]) return null;
    const span = (win[1] - win[0]) / 2;
    const mid = (win[1] + win[0]) / 2;
    const k = Math.abs(phi - mid) / span;
    // the band is fattest near the leading (bottom) end on f1, like a fan opening
    const lead = f === 0 ? 1 - (phi - win[0]) / (win[1] - win[0]) : (phi - win[0]) / (win[1] - win[0]);
    const t = thick * Math.pow(Math.max(0, 1 - k * k), 0.5) * (0.55 + 0.45 * lead);
    if (t <= 0.02) return null;
    const s = (1 - rho) / t; // 0 outer edge .. 1 inner edge
    if (s < 0 || s > 1) return null;
    const pleat = Math.floor((phi + 2) / (7 * deg)) % 2 === 0;
    if (f >= 2) {
      // fading: broken streaks
      if (((x * 3 + y * 5) % (f === 2 ? 5 : 3)) === 0) return null;
      if (s < 0.25) return f === 2 ? "W" : "%";
      return f === 2 ? (pleat ? "%" : "@") : "@";
    }
    if (s < 0.14) return "q";
    if (s < 0.82) return pleat ? "w" : "W";
    return "%";
  });
  // folded fan head at the leading tip (f0 top, f1 bottom-right) with its red-taped grip
  if (f <= 1) {
    const HEAD_UP = `
..1111..
.1wWwW1.
1wWwWwW1
1WwWwWw1
.1wWwW1.
..1rr1..
..1Rr1..
...11...`;
    const HEAD_DOWN = `
11.......
1rR1.....
.1rR1111.
..1wWwWw1
..1WwWwW1
..1wWwWw1
...1WwW1.
....111..`;
    if (f === 0) c.put(HEAD_UP, 19, 0);
    else c.put(HEAD_DOWN, 20, 15);
  }
  // speed lines off the front edge
  const lines: [number, number, number][] =
    f === 0 ? [[24, 6, 4], [26, 9, 3]] : f === 1 ? [[28, 8, 4], [29, 12, 3], [27, 15, 4], [25, 4, 3]] : f === 2 ? [[29, 10, 3], [27, 15, 2]] : [];
  for (const [x, y, l] of lines) for (let i = 0; i < l; i++) c.set(x + i, y, i === 0 ? "w" : "%");
  return c;
}

// --- Dere Dere Harisen (48x48): heart-shaped pink paper fan whirling 360 degrees
function heart5(c: Cv, x: number, y: number, k = "p", hi = "q"): void {
  c.set(x - 1, y, k).set(x + 1, y, k).set(x - 1, y + 1, k).set(x, y + 1, k).set(x + 1, y + 1, k).set(x, y + 2, k);
  c.set(x - 1, y, hi);
  c.set(x - 2, y + 1, ".");
}
function harisenEvo(f: number): Cv {
  const c = new Cv(48, 48);
  const cx = 23.5;
  const cy = 23.5;
  const rot = f * (Math.PI / 2);
  // the whirl: a pleated ring band, brightest just behind the fan head, fading round the circle
  c.each((x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d < 12 || d > 22.5) return null;
    let a = Math.atan2(dy, dx) - rot; // 0 = head position
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); // 0..2pi behind the head (trailing clockwise)
    const trail = a / (2 * Math.PI); // 0 just behind head .. 1 far
    const width = 10.5 * (1 - trail * 0.75);
    const s = (22.5 - d) / width;
    if (s > 1) return null;
    const pleat = Math.floor((a + 7) / (8 * deg)) % 2 === 0;
    if (trail > 0.55) return ((x + y) & 1) === 0 && s < 0.6 ? "-" : null;
    if (s < 0.12) return "P";
    if (trail > 0.3) return pleat ? "=" : "+";
    return pleat ? "q" : "p";
  });
  // heart-shaped fan head at the leading edge
  const hx = cx + Math.cos(rot) * 17;
  const hy = cy + Math.sin(rot) * 17;
  const head = new Cv(48, 48);
  head.shape(
    (x, y) => {
      // heart oriented with its point towards the centre
      const dx = x - hx;
      const dy = y - hy;
      const ca = Math.cos(-rot - Math.PI / 2);
      const sa = Math.sin(-rot - Math.PI / 2);
      const u = dx * ca - dy * sa;
      const v = dx * sa + dy * ca;
      return inHeart(u + 0, -v, 0, 0, 6.2);
    },
    (x, y) => {
      const l = (x - hx) * LIGHT[0] + (y - hy) * LIGHT[1];
      const pleat = Math.floor(Math.atan2(y - cy, x - cx) / (9 * deg) + 40) % 2 === 0;
      if (l > 2.5) return "q";
      return pleat ? "p" : "P";
    },
  );
  head.outline("Q");
  c.put(head, 0, 0);
  c.set(Math.round(hx) - 2, Math.round(hy) - 2, "w");
  // tiny hearts flung off the whirl
  const pts = [
    [40, 6],
    [44, 30],
    [6, 40],
    [3, 14],
  ];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + f) % 4;
    const [x, y] = pts[j];
    heart5(c, x, y, i % 2 ? "p" : "q", "w");
  }
  return c;
}

// ============================================================================ Henshin ribbons

/**
 * Ribbon strip along a parametric curve: each sample stamps a short segment
 * whose colour flips between the front (lit) and back (shaded) face where the
 * strip twists, so the loop reads as a ribbon, not a ring.
 */
function ribbonPath(c: Cv, pts: [number, number, boolean][], front: [string, string], back: [string, string], w = 1): void {
  for (let i = 0; i < pts.length; i++) {
    const [x, y, face] = pts[i];
    const [k, hi] = face ? front : back;
    for (let dy = 0; dy <= w - 1; dy++) c.set(x, y + dy, k);
    if (face && i % 5 === 1) c.set(x, y, hi);
  }
}
function curve(n: number, fn: (t: number) => [number, number, boolean]): [number, number, boolean][] {
  const out: [number, number, boolean][] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y, f] = fn(i / n);
    out.push([Math.round(x), Math.round(y), f]);
  }
  return out;
}
/** Henshin ribbon: the classic looped ribbon (pink front, mint back); f1 = it twists over. */
const RIBBON = `
....1111....
...1qqpp1...
..1q1111p1..
..1p1..1P1..
..1p1..1P1..
...1p11P1...
....1pP1....
...1lm1p1...
..1lm1.1pP1.
.1lm1...1pP1
.1m1.....1P1
..1.......1.`;
function ribbon(f: number): Cv {
  const c = Cv.of(RIBBON);
  if (f === 0) return c;
  return c.flipX().map({ p: "l", q: "m", P: "E", l: "p", m: "q" });
}
/** Infinite Henshin Loop: a gold ribbon in an infinity loop; f1 the front strand flips. */
function ribbonEvo(f: number): Cv {
  const c = new Cv(14, 14);
  const pts = curve(160, (t) => {
    const a = t * Math.PI * 2;
    const den = 1 + Math.sin(a) * Math.sin(a);
    return [6.5 + (6 * Math.cos(a)) / den, 6.2 + ((6 * Math.sin(a) * Math.cos(a)) / den) * 1.7, true];
  });
  // back strand first (darker), then the band, then outline
  for (const [x, y] of pts) {
    c.set(x, y, y < 6 ? "y" : "Y");
    c.set(x, y + 1, "Y");
  }
  c.outline("1");
  // front strand across the crossing (f1: the other diagonal is in front)
  const front: [number, number][] = f === 0 ? [[5, 4], [6, 5], [6, 6], [7, 7], [7, 8], [8, 9]] : [[8, 4], [7, 5], [7, 6], [6, 7], [6, 8], [5, 9]];
  for (const [x, y] of front) c.set(x, y, "z");
  c.set(2, 3, "w").set(10, 3, "z");
  // sparkle (alternating corners)
  const [sx, sy] = f === 0 ? [12, 1] : [1, 12];
  c.set(sx, sy, "w");
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (c.get(sx + dx, sy + dy) === ".") c.set(sx + dx, sy + dy, "z");
  return c;
}

// ============================================================================ Cheat Fireball (14x14) + Meteor

/** Round fireball with a flame tail streaming LEFT (it flies right). Flicker by frame. */
function fireball(f: number): Cv {
  const c = new Cv(14, 14);
  const cx = 8.6;
  const cy = 6.8;
  c.each((x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    // tail: the radius grows towards the back (left), with flickering tongues
    const back = Math.max(0, -dx);
    const tongue = Math.sin(dy * 1.7 + f * 1.9) * 0.9 + Math.sin(dy * 0.8 - f * 2.3) * 0.6;
    const ry = 4.6 + back * 0.05;
    const len = 4.7 + (back > 0 ? 2.6 + tongue : 0);
    const u = dx < 0 ? dx / len : dx / 4.7;
    const v = dy / ry;
    const d = Math.hypot(u, v);
    if (d > 1) return null;
    // hot core offset slightly forward + up-left light
    const core = Math.hypot((dx - 0.6) / 2.4, (dy + 0.4) / 2.2);
    const n = hash(x, y, f) * 0.18;
    if (core + n < 0.55) return "w";
    if (core + n < 1.0) return "z";
    if (d + n < 0.7) return "y";
    if (d + n < 0.86) return "o";
    return dx < -3 ? "O" : "r";
  });
  // tiny sparks thrown off the tail
  const sp = [
    [1, 4],
    [0, 9],
    [2, 11],
    [1, 2],
  ];
  const [sx, sy] = sp[f];
  c.set(sx, sy, "y");
  // dark red rim to separate from bright grounds
  c.selout({ w: "R", z: "R", y: "R", o: "R", r: "R", O: "R" }, "R");
  return c;
}

function meteorCheat(f: number): Cv {
  const c = new Cv(24, 32);
  const hx = 12;
  const hy = 24;
  // fire tail going up (wide at the head, tapering to licking tongues at the top)
  c.each((x, y) => {
    if (y > hy + 1) return null;
    const up = hy - y; // 0 at head .. 24 at top
    const w = 7.2 - up * 0.2 + Math.sin(up * 0.9 + f * 2.2 + x * 0.4) * 1.1;
    const dx = Math.abs(x - hx + Math.sin(up * 0.35 + f) * 0.8);
    if (dx > w || w < 0.6) return null;
    const t = dx / w;
    const flick = hash(x, y, 7 + f) * 0.25;
    if (up < 14 && t + flick < 0.3) return up < 7 ? "w" : "z";
    if (t + flick < 0.55) return "y";
    if (t + flick < 0.8) return "o";
    return up > 16 ? "%" : "r";
  });
  // the rock (head, bottom): dark, cracked, glowing seams
  c.ellipse(hx, hy + 1, 6.2, 5.4, (x, y) => {
    const l = (x - hx) * LIGHT[0] + (y - hy - 1) * LIGHT[1];
    if (l > 2.5) return "h";
    if (l > -0.5) return "H";
    if (l > -3.4) return "d";
    return "2";
  });
  c.pts([[10, 23], [11, 24], [12, 24], [13, 25], [14, 26], [9, 26], [10, 27], [15, 23]], "o");
  c.pts([[11, 24], [13, 25]], "y");
  c.selout({ h: "1", H: "1", d: "1", "2": "1", o: "1", y: "1" }, "R", false, (x, y) => y > hy - 3);
  // speed sparks
  const sp = f === 0 ? [[4, 10], [19, 6], [6, 3]] : [[19, 12], [5, 6], [17, 2]];
  for (const [x, y] of sp) c.set(x, y, "y");
  return c;
}

// ============================================================================ HONK wave (32x32, arcs open right)

function honkWave(f: number): Cv {
  const c = new Cv(32, 32);
  const cx = 1;
  const cy = 15.5;
  const base = [5, 9, 13, 16][f];
  const fade = [0, 0, 0.3, 0.6][f];
  for (let i = 0; i < 3; i++) {
    const r = base + i * (4.5 + f * 0.6);
    const span = (34 + i * 8) * deg;
    const th = i === 0 ? 1.7 : 1.4;
    c.each((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy * 1.05);
      const a = Math.atan2(dy, dx);
      if (Math.abs(a) > span || Math.abs(d - r) > th) return null;
      if (fade && hash(x, y, i + f * 3) < fade) return null;
      const edge = Math.abs(a) / span;
      const core = Math.abs(d - r) / th;
      if (core < 0.45 && edge < 0.75) return f >= 3 ? "%" : "w";
      if (core < 0.8) return edge > 0.8 ? "&" : "z";
      return f >= 2 ? "&" : "y";
    });
  }
  return c;
}

// ============================================================================ Bubble Tea

const BOBA = [
  `
..1111..
.1HddX1.
1Hhdddd1
1Hwddd01
1dddd001
1ddd0001
.1d0001.
..1111..`,
  `
..1111..
.1dHhd1.
1ddhwHd1
1dddhdd1
1dddd001
1ddd0001
.1d0001.
..1111..`,
];

function bobaBig(f: number): Cv {
  const c = new Cv(14, 14);
  c.ball(6.8, 6.4, 5.4, 5.2, "0Xddd", { bias: 0.05 });
  // amber rim light on the lower-right (tea reflection)
  c.each((x, y, k) => (k !== "." && !c.solid(x + 1, y + 1) && x + y > 14 && x + y < 19 ? "d" : null));
  // big shine (shifts between frames: it rolls)
  const S = f === 0 ? [[3, 3], [4, 3], [3, 4], [5, 2]] : [[5, 2], [6, 2], [4, 3], [7, 2]];
  c.pts(S as [number, number][], "w");
  c.set(f === 0 ? 4 : 6, f === 0 ? 4 : 3, "h");
  c.outline("1");
  // a syrup bead dripping off the bottom
  c.set(9, 13, "H").set(10, 13, "1").set(8, 13, "1");
  return c;
}

// ============================================================================ Paper cranes (12x10, faces right)

/**
 * Origami crane in profile (faces right): a diamond body, thin neck rising to a
 * pointed head, thin tail rising behind, and one big triangular wing that flaps.
 * Built from polygons (flat planes, lit from the top-left), then outlined.
 */
const CRANE_WING_APEX: [number, number][] = [
  [3, 0], // f0 up
  [0, 3], // f1 swept back
  [4, 9], // f2 down
  [1, 1], // f3 rising
];
function crane(f: number, gold: boolean): Cv {
  const c = new Cv(12, 10);
  const lit = gold ? "z" : "w";
  const mid = gold ? "y" : "W";
  const dark = gold ? "Y" : "g";
  // flat boat-shaped body
  c.poly([[1.5, 5.5], [5, 4.6], [9, 5.2], [7.5, 7.8], [3.5, 7.8]], (x, y) => (y < 6 ? lit : y < 7 ? mid : dark));
  // short tail spike behind, low
  c.set(1, 5, mid).set(0, 4, mid);
  // neck rising in front, head hooked forward (the crane tell)
  c.line(8, 5, 9, 2, lit);
  c.set(9, 1, lit).set(10, 1, lit).set(11, 2, mid);
  // the big flat wing
  const [ax, ay] = CRANE_WING_APEX[f];
  c.poly([[3, 5.4], [7.6, 5.4], [ax + 0.5, ay + 0.5]], (x, y) => (Math.abs(x - ax) + Math.abs(y - ay) < 3 ? mid : lit));
  c.line(5, 5, ax, ay, f === 2 ? dark : mid);
  c.outline("1");
  if (gold) {
    const sp = [
      [1, 8],
      [11, 8],
      [0, 0],
      [11, 5],
    ][f];
    if (c.get(sp[0], sp[1]) === ".") c.set(sp[0], sp[1], "w");
  }
  return c;
}

// ============================================================================ Idol lightsticks

const WAVE_TINT: [string, string, string][] = [
  ["P", "p", "q"], // pink
  ["C", "c", "a"], // cyan
  ["Y", "y", "z"], // yellow
  ["I", "i", "j"], // violet
];
function lightstickWave(f: number): Cv {
  const c = new Cv(32, 16);
  const [dk, md, lt] = WAVE_TINT[f];
  const cx = 2;
  const cy = 7.5;
  c.each((x, y) => {
    const u = (x - cx) / 28;
    const v = (y - cy) / 7.6;
    const rho = Math.hypot(u, v);
    const phi = Math.atan2(v, u);
    const span = 72 * deg;
    if (Math.abs(phi) > span) return null;
    const k = Math.abs(phi) / span;
    const t = 0.3 * Math.pow(1 - k * k, 0.7);
    const s = (1 - rho) / Math.max(0.001, t);
    if (s < 0 || s > 1) return null;
    if (s < 0.12) return dk;
    if (s < 0.5) return k < 0.75 ? "w" : lt;
    if (s < 0.75) return md;
    return f === 0 ? "+" : f === 1 ? "^" : f === 2 ? "&" : "$";
  });
  // music-note-ish sparkles riding the crest
  c.set(29, 4, "w").set(29, 11, "w").set(26, 2, lt).set(26, 13, lt);
  return c;
}

const LIGHTSTICK = [
  `
..1...
.1w1..
.1w1..
.1w1..
.1w1..
.1W1..
.1W1..
.1g1..
.1G1..
.1G1..
1sG1..
1ss1..
1ks1..
.11...`,
  `
....1.
...1w1
...1w1
..1w1.
..1w1.
..1W1.
.1W1..
.1g1..
.1G1..
1G1...
1sG1..
1ss1..
1ks1..
.11...`,
];

// ============================================================================ Kotatsu

/** Kotatsu: wooden top over a fluffy quilt that flares out to the floor (warm red, cream dots), seen from the front-top. */
function kotatsuBody(c: Cv, x0: number, y0: number, w: number, h: number, glow: boolean, plush: number): void {
  const qx0 = x0;
  const qx1 = x0 + w - 1;
  const qy0 = y0 + 3;
  const qy1 = y0 + h - 1;
  const cxm = (qx0 + qx1) / 2;
  for (let y = qy0; y <= qy1; y++)
    for (let x = qx0; x <= qx1; x++) {
      const ty = (y - qy0) / (qy1 - qy0);
      // flare: narrow under the table, puffing out towards the floor (a soft S curve)
      const inset = (2 + plush) * (1 - Math.sin(Math.min(1, ty * 1.6) * Math.PI / 2));
      const half = (qx1 - qx0) / 2 - inset;
      if (Math.abs(x - cxm) > half) continue;
      // scalloped hem
      if (y === qy1 && (x - qx0) % 4 === 0) continue;
      const lx = (x - cxm) / half; // -1 .. 1
      let k = "r";
      if (lx < -0.72 && ty < 0.75) k = "p"; // lit left puff
      if (lx > 0.7) k = "R";
      if (ty > 0.78) k = lx < 0 ? "R" : "Q";
      if ((x - qx0) % 7 === 3 && ty > 0.35 && ty <= 0.78) k = lx > 0.7 ? "Q" : "R"; // soft folds
      if ((x - qx0 + 2) % 5 === 0 && (y - qy0) % 4 === 2 && ty < 0.75) k = "B";
      c.set(x, y, k);
    }
  // puffy top edge where the table presses the quilt
  for (let x = Math.round(qx0 + 3 + plush); x <= Math.round(qx1 - 3 - plush); x++) c.set(x, qy0, "q");
  // tabletop: a wooden slab with a lit front-top edge, slightly wider than the quilt top
  for (let y = y0; y < y0 + 4; y++)
    for (let x = x0 + 1; x <= x0 + w - 2; x++) {
      const k = y === y0 ? "h" : y === y0 + 3 ? "d" : (x * 3 + y) % 11 === 0 ? "h" : "H";
      c.set(x, y, k);
    }
  if (glow) {
    // heater glow leaking from under the hem
    for (let x = qx0 + 1; x <= qx1 - 1; x++) {
      if (c.get(x, qy1) !== ".") c.set(x, qy1, (x - qx0) % 2 ? "o" : "y");
      if (c.get(x, qy1 - 1) !== "." && (x - qx0) % 3 === 0) c.set(x, qy1 - 1, "o");
    }
  }
}

function steam(c: Cv, x: number, y: number, f: number): void {
  const off = [0, 1, 0, -1][f % 4];
  c.set(x + off, y, "%").set(x + off, y - 1, "W").set(x - off, y - 2, "%").set(x - off, y - 3, "@");
}

function kotatsu(f: number): Cv {
  const c = new Cv(32, 24);
  if (f === 0) {
    // folded: a quilt bundle tied with a cord (travelling mode)
    c.ellipse(16, 18.5, 9, 4.5, (x, y) => (y < 17 ? "r" : x > 19 ? "R" : (x + y) % 5 === 0 ? "B" : "r"));
    c.rect(12, 13, 9, 2, "H");
    c.rect(12, 13, 9, 1, "h");
    c.pts([[16, 15], [16, 16], [16, 17], [16, 18], [16, 19], [16, 20], [16, 21], [16, 22]], "y");
    c.outline("1");
    c.set(13, 17, "q").set(12, 18, "q");
    return c;
  }
  kotatsuBody(c, 2, 9, 28, 14, f === 3, 1);
  // a teacup on the table
  c.rect(19, 7, 3, 2, "w");
  c.set(21, 7, "W").set(19, 6, "p").set(20, 6, "p").set(21, 6, "p");
  c.outline("1");
  if (f === 3) {
    // Too Comfy: the heater glows through - warm rim light under the hem + glow halo
    c.selout({}, "*", false, (x, y) => y >= 21);
    for (let x = 4; x < 28; x += 4) c.set(x, 23, "&");
    c.set(5, 7, "j").set(6, 6, "j").set(5, 6, "j").set(6, 7, "j");
  } else {
    steam(c, 20, 4, f);
    steam(c, 25, 6, f + 1);
  }
  return c;
}

function kotatsuEvo(f: number): Cv {
  const c = new Cv(40, 28);
  kotatsuBody(c, 2, 11, 36, 16, f === 3, 2);
  // bowl of mikan on top (each fruit outlined on its own so the pile reads)
  c.ellipse(20, 9.6, 5.6, 2.0, (x, y) => (y < 9 ? "W" : x > 21 ? "g" : "W"));
  c.rect(16, 11, 9, 1, "g");
  const fruit = (fx: number, fy: number) => {
    const m = new Cv(40, 28);
    m.ball(fx, fy, 2.3, 2.1, "OOooy");
    m.outline("1");
    m.set(Math.round(fx) - 1, Math.round(fy) - 1, "z");
    c.put(m, 0, 0);
  };
  fruit(17.3, 7);
  fruit(22.7, 7);
  fruit(20, 4.6);
  c.set(20, 2, "e").set(21, 1, "l");
  c.outline("1");
  if (f === 3) {
    c.selout({}, "*", false, (x, y) => y >= 25);
    for (let x = 5; x < 36; x += 4) c.set(x, 27, "&");
    // zzz bubble
    c.pts([[4, 4], [5, 4], [6, 4], [5, 5], [4, 6], [5, 6], [6, 6]], "j");
    c.pts([[8, 1], [9, 1], [9, 2], [8, 3], [9, 3]], "j");
  } else {
    steam(c, 12, 8, f);
    steam(c, 28, 8, f + 2);
    steam(c, 32, 10, f + 1);
  }
  return c;
}

const MIKAN = [
  `
....1...
..11e1..
.1oyle1.
1oyzoo11
1oyooooO1`,
  ``,
];
function mikan(f: number): Cv {
  const c = new Cv(8, 8);
  c.ball(3.6, 4.4, 2.8, 2.6, "OOooy", { spec: "y" });
  // navel dimple + leaf
  if (f === 0) {
    c.set(4, 1, "E").set(5, 1, "e").set(5, 0, "l");
  } else {
    c.set(6, 3, "E").set(7, 3, "e").set(7, 2, "l");
  }
  c.outline("1");
  c.set(f === 0 ? 2 : 3, f === 0 ? 3 : 2, "z");
  return c;
}
void MIKAN;

export const sprites: SpriteDef[] = [
  spr("w_harisen", 32, 24, [0, 1, 2, 3].map(harisen), "center", { pal: GLOW, fps: 22 }),
  spr("w_harisen_evo", 48, 48, [0, 1, 2, 3].map(harisenEvo), "center", { pal: GLOW, fps: 16 }),
  spr("w_ribbon", 12, 12, [0, 1].map(ribbon), "center", { fps: 10 }),
  spr("w_ribbon_evo", 14, 14, [0, 1].map(ribbonEvo), "center", { fps: 10 }),
  spr("w_fireball", 14, 14, [0, 1, 2, 3].map(fireball), "center", { pal: GLOW, fps: 12 }),
  spr("w_meteor_cheat", 24, 32, [0, 1].map(meteorCheat), "center", { pal: GLOW, fps: 10 }),
  spr("w_honk_wave", 32, 32, [0, 1, 2, 3].map(honkWave), "center", { pal: GLOW, fps: 14 }),
  spr("w_boba", 8, 8, BOBA, "center", { fps: 6 }),
  spr("w_boba_big", 14, 14, [0, 1].map(bobaBig), "center", { fps: 6 }),
  spr("w_crane", 12, 10, [0, 1, 2, 3].map((f) => crane(f, false)), "center", { fps: 10 }),
  spr("w_crane_gold", 12, 10, [0, 1, 2, 3].map((f) => crane(f, true)), "center", { fps: 10 }),
  spr("w_lightstick_wave", 32, 16, [0, 1, 2, 3].map(lightstickWave), "center", { pal: GLOW, fps: 8 }),
  spr("w_lightstick", 6, 14, LIGHTSTICK, "center", { fps: 4 }),
  spr("w_kotatsu", 32, 24, [0, 1, 2, 3].map(kotatsu), "feet", { pal: GLOW, fps: 4 }),
  spr("w_kotatsu_evo", 40, 28, [0, 1, 2, 3].map(kotatsuEvo), "feet", { pal: GLOW, fps: 4 }),
  spr("w_mikan", 8, 8, [0, 1].map(mikan), "center", { fps: 6 }),
];

void rgba;
