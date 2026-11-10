/**
 * Beach Episode enemies (owner: s2-stages-b): Crab-kun, Seagull, Jellyfish,
 * Watermelon (+ half), Sandcastle Golem, Tiny Shark and the seed bullet.
 * Art direction + gameplay tells: docs/content/enemies.md §3.
 *
 * All face RIGHT, feet pivot (w/2, h-1), plum '1' outlines, light from the
 * top-left. Crab, jellyfish bells, melon half and the seed are hand-pixelled
 * grids; round bodies (seagull, melon, shark) are shaded procedurally with
 * hand-pixelled faces on top. Every special frame (tell / attack) is drawn to
 * read at 1x against both dry and wet sand.
 */
import type { SpriteDef } from "../format";
import { Cv, spr, part, stack, soften } from "./s2-stages-b-util";

/** Local warm-light keys shared by the beach enemies. */
const PAL: Record<string, string> = {
  _: "#6e1840", // crab inner separator (deep crimson)
  "+": "#ff9488", // red lit (warm)
  "=": "#ffd2c8", // red rim / belly light
};

// ============================================================================ CRAB-KUN
// Hand-pixelled parts (fills only), each outlined on its own layer and stacked
// back-to-front: legs -> body -> eye stalks -> claws. Light from the top-left:
// '+' lit, 'r' base, 'R' shade; '=' is the pale shell glint.
const CRAB_BODY = `
...++rrrr...
.++=++rrrrR.
++=++rrrrrRR
++rrrrrrrRRR
.rrrrrrrRRR.`;
const CRAB_BODY_SQUASH = `
..+++rrrrr...
.++=++rrrrrR.
++=++rrrrrrRR
.rrrrrrrrRRR.`;
/** Left claw, raised, pincer open upward. */
const CLAW_L = `
.r.r
+r.r
+rrR
+rRR
.RR.`;
/** Right claw: the mirror image, re-lit from the top-left. */
const CLAW_R = `
+.r.
+.rR
+rrR
+rRR
.RR.`;
/** Claw thrust forward (lunge), pincer open to the right. */
const CLAW_FWD = `
.++rr
+r...
+r...
+rrrR
.RRR.`;
/** 2x2 bead eye: black with a white glint, looking right. */
const CRAB_EYE = `
ww
w0`;

interface CrabPose {
  by: number; // body top row
  bx?: number; // body x shift
  legs: [number, number][]; // leg pixels (fill), drawn behind the body
  claws: "side" | "up" | "fwd";
  squash?: boolean;
}

function crab(o: CrabPose): Cv {
  const W = 16;
  const bx = 2 + (o.bx ?? 0);
  const by = o.by;
  const legs = new Cv(W, W);
  for (const [x, y] of o.legs) legs.set(x, y, "R");
  legs.outline("1");
  const body = part(W, W, o.squash ? CRAB_BODY_SQUASH : CRAB_BODY, o.squash ? bx - 0 : bx, by);
  // eyes on little stalks
  const eyeY = o.claws === "up" ? by - 5 : by - 4;
  const eyes = new Cv(W, W);
  for (const ex of [bx + 4, bx + 7]) {
    eyes.put(CRAB_EYE, ex, eyeY);
    for (let y = eyeY + 2; y < by; y++) eyes.set(ex + (ex < bx + 6 ? 1 : 0), y, "R");
  }
  eyes.outline("1");
  const claws = new Cv(W, W);
  if (o.claws === "side") {
    claws.put(CLAW_L, bx - 1, by - 5).set(bx, by, "R").set(bx, by + 1, "R");
    claws.put(CLAW_R, bx + 9, by - 5).set(bx + 11, by, "R").set(bx + 11, by + 1, "R");
  } else if (o.claws === "up") {
    claws.put(CLAW_L, bx - 2, by - 8).set(bx - 1, by - 3, "R").set(bx - 1, by - 2, "R").set(bx, by - 1, "R").set(bx, by, "R");
    claws.put(CLAW_R, bx + 10, by - 8).set(bx + 12, by - 3, "R").set(bx + 12, by - 2, "R").set(bx + 11, by - 1, "R").set(bx + 11, by, "R");
  } else {
    claws.put(CLAW_L, bx - 1, by - 4).set(bx, by + 1, "R");
    claws.put(CLAW_FWD, bx + 9, by - 2);
  }
  claws.outline("1");
  const c = soften(stack(W, W, legs, body, eyes, claws), "+rR=", "_");
  // pincer-tip glints on the tell
  if (o.claws === "up") c.set(bx - 1, by - 8, "w").set(bx + 13, by - 8, "w");
  // face on the shell front: blush + ':3' mouth (an 'o' while lunging)
  const fy = by + 2;
  c.set(bx + 2, fy, "b").set(bx + 9, fy, "b");
  if (o.claws === "fwd") c.set(bx + 5, fy, "1").set(bx + 6, fy, "1").set(bx + 5, fy + 1, "0").set(bx + 6, fy + 1, "1");
  else c.set(bx + 5, fy, "1").set(bx + 6, fy + 1, "1").set(bx + 7, fy, "1");
  return c;
}

function crabFrames(): Cv[] {
  return [
    crab({ by: 8, legs: [[3, 13], [2, 14], [5, 13], [10, 13], [12, 13], [13, 14]], claws: "side" }),
    crab({ by: 7, legs: [[4, 12], [4, 13], [3, 14], [6, 12], [6, 13], [9, 12], [9, 13], [11, 12], [12, 13], [12, 14]], claws: "side" }),
    crab({ by: 9, legs: [[2, 13], [1, 14], [5, 14], [10, 14], [13, 13], [14, 14]], claws: "up", squash: true }),
    crab({ by: 8, legs: [[3, 13], [2, 14], [1, 14], [6, 13], [11, 13], [12, 14]], claws: "fwd" }),
  ];
}

// ============================================================================ SEAGULL
// Side view, flying right, drawn high in the box (code adds height + shadow).
// Shapes live in the bird's local frame so the dive pose can tilt cleanly.
type Wing = "up" | "down" | "glide" | "tuck";

function inTri(px: number, py: number, a: [number, number], b: [number, number], c: [number, number]): boolean {
  const s = (p1: [number, number], p2: [number, number]) => (px - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (py - p2[1]);
  const d1 = s(a, b);
  const d2 = s(b, c);
  const d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function seagull(wing: Wing, tilt: number, bob: number): Cv {
  const c = new Cv(16, 16);
  const ox = 7;
  const oy = 7.5 + bob;
  const ca = Math.cos(tilt);
  const sa = Math.sin(tilt);
  // local coords: x forward (right), y down
  const loc = (x: number, y: number) => {
    const dx = x + 0.5 - (ox + 0.5);
    const dy = y + 0.5 - (oy + 0.5);
    return [dx * ca + dy * sa, -dx * sa + dy * ca] as const;
  };
  const toScr = (lx: number, ly: number) => [ox + lx * ca - ly * sa, oy + lx * sa + ly * ca] as const;
  const HEAD: [number, number, number] = [2.6, -2.4, 3.1];
  const WINGS: Record<Wing, { tip: [number, number]; mid: [number, number] }> = {
    up: { tip: [-5.5, -7.5], mid: [-0.5, -5] },
    down: { tip: [-5, 6], mid: [-0.5, 4] },
    glide: { tip: [-7.5, -3.2], mid: [-1.5, -3.5] },
    tuck: { tip: [-6.5, -1.6], mid: [0, -2.6] },
  };
  const wg = WINGS[wing];
  const shA: [number, number] = [1, -1.2];
  const shB: [number, number] = [-3, -0.6];
  const inWing = (lx: number, ly: number, tip: [number, number], mid: [number, number]) =>
    inTri(lx, ly, shA, shB, tip) || inTri(lx, ly, shA, mid, tip);
  const wingKey = (lx: number, ly: number, tip: [number, number], far: boolean) => {
    const t = Math.hypot(lx - shA[0], ly - shA[1]) / Math.hypot(tip[0] - shA[0], tip[1] - shA[1]);
    if (t > 0.74) return far ? "1" : "2"; // dark wingtips
    if (far) return "G";
    return t < 0.3 ? "j" : "g";
  };
  // far wing (behind, darker, a little shorter)
  if (wing !== "tuck") {
    const farTip: [number, number] = [wg.tip[0] + 2, wg.tip[1] + (wing === "down" ? -1.5 : 1.5)];
    const farMid: [number, number] = [wg.mid[0] + 1.5, wg.mid[1] + (wing === "down" ? -1 : 1)];
    c.each((x, y) => {
      const [lx, ly] = loc(x, y);
      return inWing(lx, ly, farTip, farMid) ? wingKey(lx, ly, farTip, true) : null;
    });
  }
  // body + head + tail: a fat white mochi of a bird
  c.each((x, y) => {
    const [lx, ly] = loc(x, y);
    const body = ((lx + 0.6) / 4.6) ** 2 + ((ly - 1) / 3.4) ** 2 <= 1;
    const head = (lx - HEAD[0]) ** 2 + (ly - HEAD[1]) ** 2 <= HEAD[2] ** 2;
    const tail = inTri(lx, ly, [-3.6, -0.8], [-3.6, 2.2], [-7.2, 0]);
    if (!body && !head && !tail) return null;
    if (tail && !body) return lx < -6 ? "G" : "g";
    // lit from the top-left; lavender shade on the belly
    if (ly > 2.6 && !head) return "g";
    if (ly > 1.4 && !head) return "W";
    const l = -(lx - 0.5) * 0.1 - ly * 0.25;
    return l > 0.55 ? "w" : head || l > 0.1 ? "w" : "W";
  });
  // beak: yellow wedge with an orange-red tip spot
  c.each((x, y) => {
    const [lx, ly] = loc(x, y);
    if (inTri(lx, ly, [5.2, -2.9], [5.2, -0.9], [8.6, -1.6])) return lx > 7.4 ? "o" : "y";
    return null;
  });
  // near wing on top of the body
  c.each((x, y) => {
    const [lx, ly] = loc(x, y);
    return inWing(lx, ly, wg.tip, wg.mid) ? wingKey(lx, ly, wg.tip, false) : null;
  });
  // feather detail: a white "mirror" spot on the dark tip, and a lighter leading edge
  if (wing !== "tuck") {
    const [mx, my] = toScr(wg.tip[0] * 0.86 + shA[0] * 0.14, wg.tip[1] * 0.86 + shA[1] * 0.14);
    if (c.get(Math.round(mx), Math.round(my)) === "2") c.set(Math.round(mx), Math.round(my), "w");
  }
  // tucked orange feet
  if (wing !== "tuck") {
    const [fx, fy] = toScr(-0.6, 4.6);
    c.set(Math.round(fx), Math.round(fy), "o").set(Math.round(fx) + 1, Math.round(fy), "O");
  }
  c.outline("1");
  // side-eye: flat heavy lid over a pupil glancing back at you; a little blush
  const [ex, ey] = toScr(HEAD[0] + 1.1, HEAD[1] - 0.2);
  const exr = Math.round(ex);
  const eyr = Math.round(ey);
  c.set(exr - 1, eyr - 1, "1").set(exr, eyr - 1, "1");
  c.set(exr - 1, eyr, "0").set(exr, eyr, "w");
  c.set(exr - 1, eyr + 1, "b");
  return c;
}

function seagullFrames(): Cv[] {
  return [seagull("up", 0, 0), seagull("down", 0, 1), seagull("glide", 0, 0), seagull("tuck", 0.8, 0)];
}

// ============================================================================ JELLYFISH
// Translucent bell (alpha palette keys), sleepy face, four wavy tentacles.
// f0-2 pulse swim (rest / squash / stretch), f3 glow = the zap telegraph:
// bright aqua outline and a white inner rim.
const JELLY_PAL: Record<string, string> = {
  "%": "#ddc6ffd0", // bell base (lavender, translucent)
  "&": "#b47cffd0", // bell shade
  "*": "#f6efffe0", // bell light
  "~": "#ddc6ffb0", // tentacle lavender
  "^": "#ffb8dcc0", // tentacle pink
  "!": "#bafff6", // glow rim aqua
};

const BELL_REST = `
...%%%%%%...
.%%**%%pp%%.
%%**%%%pp%%&
%*%%%%%%%%&&
%%%%%%%%%%&&
%%%%%%%%%%&&
%%%%%%%%%&&&
&&&&&&&&&&&&
.&&.&&.&&.&.`;
const BELL_SQUASH = `
....%%%%%%....
.%%**%%%pp%%%.
%%*%%%%%pp%%%&
%*%%%%%%%%%%&&
%%%%%%%%%%%&&&
%%%%%%%%%%&&&&
&&&&&&&&&&&&&&
&.&&.&&.&&.&&.`;
const BELL_STRETCH = `
...%%%%...
.%%*%%pp%.
.%**%%pp%.
%*%%%%%%%&
%%%%%%%%%&
%%%%%%%%&&
%%%%%%%&&&
&&&&&&&&&&
&.&&.&&.&.`;

function jelly(bell: string, bx: number, by: number, sway: number, spread: number, glow: boolean): Cv {
  const c = new Cv(16, 16);
  const b = Cv.of(bell);
  c.put(b, bx, by);
  const rim = by + b.h - 2; // last solid rim row
  c.outline(glow ? "!" : "1");
  if (glow) c.each((x, y, k) => ("%&*".includes(k) && (c.get(x - 1, y) === "!" || c.get(x + 1, y) === "!" || c.get(x, y - 1) === "!") ? "w" : null));
  // four wavy tentacles hanging from the frill (un-outlined so they stay delicate)
  const cx = bx + (b.w - 1) / 2;
  const tents = [-3.5, -1.2, 1.2, 3.5];
  tents.forEach((off, i) => {
    for (let y = rim + 3; y <= 15; y++) {
      const d = y - rim - 2;
      const x = cx + off * (1 + spread * d * 0.1) + Math.sin(d * 1.2 + sway) * 0.75;
      const k = glow ? (i % 2 ? "a" : "w") : i % 2 ? "i" : "p";
      if (c.get(Math.round(x), y) === ".") c.set(Math.round(x), y, k);
    }
  });
  // sleepy face low on the bell, turned a little right: closed eyes, blush, tiny 'o'
  const fx = Math.round(cx) + 1;
  const ey = rim - 3;
  for (const ex of [fx - 4, fx + 1]) c.set(ex, ey, "1").set(ex + 1, ey + 1, "1").set(ex + 2, ey, "1");
  c.set(fx - 5, ey + 2, "b").set(fx + 4, ey + 2, "b");
  c.set(fx - 1, ey + 2, "1");
  // shine
  c.set(bx + 2, by + 2, "w");
  return c;
}

function jellyFrames(): Cv[] {
  return [
    jelly(BELL_REST, 2, 1, 0, 0, false),
    jelly(BELL_SQUASH, 1, 2, 1.6, 1, false),
    jelly(BELL_STRETCH, 3, 1, 3.2, -0.6, false),
    jelly(BELL_REST, 2, 1, 0, 0, true),
  ];
}

// ============================================================================ WATERMELON
// Striped melon in a straw sun hat. Stripes follow the sphere's meridians; on
// the roll frames the meridian axis spins so the stripes visibly tumble.
const MELON_PAL: Record<string, string> = {
  "<": "#24804d", // stripe dark green (lit side)
  ">": "#175a40", // stripe shade
  "[": "#8fdc6a", // rind light green
  "]": "#5fbf5a", // rind base
  "{": "#3f9a55", // rind shade
};

/**
 * Melon sphere: light rind lit from the top-left with crisp dark zig-zag
 * stripes along meridians. The stripe mask is built upright, then rotated by
 * `rot` degrees for the roll frames (the lighting stays screen-fixed).
 */
function melonBody(c: Cv, cx: number, cy: number, rx: number, ry: number, rot: number, keep: (x: number, y: number) => boolean): void {
  const mask = new Cv(16, 16);
  const LONS = [-1.2, -0.5, 1.25];
  for (let y = 0; y < 16; y++) {
    const t = (y + 0.5 - (cy + 0.5)) / (ry + 0.3);
    if (Math.abs(t) >= 1) continue;
    const R = (rx + 0.3) * Math.sqrt(1 - t * t);
    const zig = (y >> 1) & 1 ? 0 : 1;
    for (const lon of LONS) {
      const x = Math.round(cx + R * Math.sin(lon) + (lon < 0 ? -zig : zig) * 0.6);
      mask.set(x, y, "S");
      if (R * Math.cos(lon) > 3.2) mask.set(x + (lon < 0 ? 1 : -1), y, "S");
    }
  }
  const m = rot ? mask.rotate((rot * Math.PI) / 180, cx, cy) : mask;
  c.ellipse(cx, cy, rx, ry, (x, y) => {
    const nx = (x - cx) / (rx + 0.5);
    const ny = (y - cy) / (ry + 0.5);
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const l = nx * -0.55 + ny * -0.62 + nz * 0.56;
    if (m.get(x, y) === "S" && !keep(x, y)) return l > 0.05 ? "<" : ">";
    return l > 0.5 ? "[" : l > -0.12 ? "]" : "{";
  });
}

const HAT = `
....hBBBh....
...hBzBBBh...
...rrrrrrR...
.hBBBBBBBBBh.
hhFFFFFFFFFhh`;
const HAT_TILT = `
.....hBBh.....
...hBzBBBh....
..rrrrrrR.....
.hBBBBBBBBhh..
hFFFFFFFFFFFh.`;

function melon(f: number): Cv {
  const roll = f >= 2;
  const bob = f === 1 ? -1 : 0;
  const cx = 7.5;
  const cy = roll ? 9.5 : 9 + bob;
  const fx = 9;
  const fy = Math.round(cy);
  const feet = new Cv(16, 16);
  if (!roll) {
    // little waddling feet
    const l = f === 0 ? 0 : 1;
    feet.set(5, 14 - l, "E").set(4, 14 - l, "E").set(10, 13 + l, "E").set(11, 13 + l, "E");
    feet.outline("1");
  }
  const face = (x: number, y: number) => x >= fx - 3 && x <= fx + 3 && y >= fy - 1 && y <= fy + 2;
  const body = new Cv(16, 16);
  melonBody(body, cx, cy, 6, roll ? 5 : 5.4, roll ? (f === 2 ? 40 : 85) : 0, face);
  body.outline("1");
  const hat = part(16, 16, roll ? HAT_TILT : HAT, roll ? 0 : 1, roll ? 1 : 1 + bob);
  const c = stack(16, 16, feet, body, hat);
  if (!roll) {
    // happy face: tall shiny eyes, blush, open smile
    for (const ex of [fx - 2, fx + 2]) c.set(ex, fy - 1, "w").set(ex, fy, "0");
    c.set(fx - 3, fy + 1, "b").set(fx + 3, fy + 1, "b");
    c.set(fx - 1, fy + 1, "0").set(fx, fy + 1, "0").set(fx + 1, fy + 1, "0").set(fx, fy + 2, "r");
  } else {
    // '>w<' wheee
    c.set(fx - 3, fy - 1, "0").set(fx - 2, fy, "0").set(fx - 3, fy + 1, "0");
    c.set(fx + 3, fy - 1, "0").set(fx + 2, fy, "0").set(fx + 3, fy + 1, "0");
    c.set(fx - 1, fy + 1, "0").set(fx, fy + 2, "0").set(fx + 1, fy + 1, "0");
    // dust kicked up behind
    const d: [number, number][] = f === 2 ? [[1, 13], [0, 11]] : [[0, 13], [1, 12]];
    for (const [x, y] of d) if (c.get(x, y) === ".") c.set(x, y, "B");
  }
  return c;
}

/** Watermelon half: red flesh (seeds up) on a green rind bowl, tiny angry face. f0 squat, f1 hop (stretched). */
const HALF = `
..WqrrrW..
.Wqr0rrrW.
Wqrrrr0rRW
Wr0rrRrRRW
[WWWWWWWW{
[]]]]]]]]{
.[]]]]]]{.`;
const HALF_HOP = `
..WqrrW..
.Wq0rrrW.
Wqrrr0rRW
Wr0rRrRRW
[WWWWWWW{
[]]]]]]]{
[]]]]]]]{
.[]]]]]{.`;
function melonHalf(f: number): Cv {
  const hop = f === 1;
  const c = part(12, 10, hop ? HALF_HOP : HALF, hop ? 2 : 1, hop ? 1 : 2);
  // tiny angry face on the rind: outer brow pixels slanting in ('\ /'), dot eyes, flat mouth
  const ey = hop ? 6 : 7;
  const [l, r] = hop ? [5, 8] : [5, 8];
  c.set(l - 1, ey - 1, "1").set(r + 1, ey - 1, "1");
  c.set(l, ey, "0").set(r, ey, "0");
  c.set(l + 1, ey + 1, "1").set(l + 2, ey + 1, "1");
  return c;
}

const SEED_PAL: Record<string, string> = {
  "(": "#ff7ab8", // halo
  ")": "#ffb8dcb0", // outer halo (translucent)
  "^": "#5a3a4a", // seed glint (muted, so it never reads as an eye)
};

/** Teardrop seed (tilted, point up-left) in a hot-pink glow; f1 = brighter pulse. */
const SEED = [
  `
.)(().
)(0(()
(0^0((
(000((
)(00()
.)(().`,
  `
.(qq(.
(q0qq(
q0^0qq
q000qq
(q00q(
.(qq(.`,
];
function seed(f: number): Cv {
  return Cv.of(SEED[f]);
}

// ============================================================================ SANDCASTLE GOLEM
// A walking sandcastle: two towers for ears, window eyes, a pink shell nose,
// an arched door mouth, a pennant on top and stubby sand legs. Darker, more
// saturated sand than the ground so it never melts into the beach.
const CASTLE_PAL: Record<string, string> = {
  // packed WET sand: darker and warmer than the dry beach so it never melts into the ground
  "(": "#f7c983", // lit sand
  ")": "#e2a160", // sand base
  "[": "#c07a47", // sand shade
  "]": "#8c5238", // deep shade / mortar
  "~": "#f2b874", // trickling grains (no outline)
};

function sandBlock(c: Cv, x0: number, y0: number, x1: number, y1: number, brick = true): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let k = x === x0 ? "(" : x >= x1 - 1 ? (x === x1 ? "]" : "[") : ")";
      if (y === y0 && x < x1 - 1) k = "(";
      // brick courses: a mortar line every 3 rows, staggered joints
      if (brick && y > y0 && (y - y0) % 3 === 0 && x > x0 && x < x1) k = "[";
      if (brick && y > y0 && (y - y0) % 3 !== 0 && x > x0 && x < x1 - 1 && (x + (Math.floor((y - y0) / 3) % 2) * 2) % 4 === 0 && (y - y0) % 3 === 1) k = "[";
      c.set(x, y, k);
    }
}

function merlons(c: Cv, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x += 2) c.set(x, y, x === x0 ? "(" : x >= x1 - 1 ? "[" : ")");
}

function sandcastle(f: number): Cv {
  const c = new Cv(24, 24);
  if (f === 3) return sandPile();
  const bob = f === 1 ? -1 : 0;
  // legs: stubby sand pillars, alternate stepping
  const lUp = f === 0 ? 1 : 0;
  const rUp = f === 2 ? 1 : 0;
  sandBlock(c, 7, 19 - lUp + bob, 10, 22 - lUp, false);
  sandBlock(c, 13, 19 - rUp + bob, 16, 22 - rUp, false);
  // body (keep) + crenellations
  const top = 8 + bob;
  sandBlock(c, 5, top, 18, 19 + bob);
  merlons(c, 5, 18, top - 1);
  // tower "ears"
  sandBlock(c, 2, 4 + bob, 6, 14 + bob);
  merlons(c, 2, 6, 3 + bob);
  sandBlock(c, 17, 4 + bob, 21, 14 + bob);
  merlons(c, 17, 21, 3 + bob);
  // pennant on a little wooden stick
  for (let y = 1 + bob; y < top - 1; y++) c.set(12, y, "H");
  c.set(12, bob, "y");
  c.put(
    `
pqq
pq.
p..`,
    13,
    1 + bob,
  );
  // sand trickling off the sides while it stomps
  const trick: [number, number][] =
    f === 0
      ? [
          [4, 16],
          [4, 18],
          [19, 15],
        ]
      : f === 1
        ? [
            [20, 17],
            [3, 15],
          ]
        : [
            [4, 17],
            [19, 17],
            [19, 19],
          ];
  c.outline("1");
  for (const [x, y] of trick) if (c.get(x, y + bob) === ".") c.set(x, y + bob, "~");
  // face: window eyes with glints, shell nose, arched door mouth
  const fy = 11 + bob;
  for (const ex of [8, 14]) {
    c.set(ex, fy, "0").set(ex + 1, fy, "0").set(ex, fy + 1, "0").set(ex + 1, fy + 1, "0");
    c.set(ex, fy - 1, "]").set(ex + 1, fy - 1, "]"); // arch lintel
    c.set(ex + 1, fy, "w");
  }
  c.set(7, fy + 2, "b").set(16, fy + 2, "b");
  c.put(
    `
qpq
.P.`,
    10,
    fy + 2,
  );
  c.set(11, fy + 5, "]").set(12, fy + 5, "]");
  c.set(10, fy + 6, "]").set(11, fy + 6, "0").set(12, fy + 6, "0").set(13, fy + 6, "]");
  c.set(11, fy + 7, "0").set(12, fy + 7, "0");
  // tower windows (arrow slits)
  c.set(4, 6 + bob, "]").set(4, 7 + bob, "]").set(19, 6 + bob, "]").set(19, 7 + bob, "]");
  return c;
}

/** f3: the golem collapsed into a sand pile: tower stumps poking out, pennant stuck on top, dizzy eyes, shell nose. */
function sandPile(): Cv {
  const c = new Cv(24, 24);
  const shade = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => {
    const l = -((x - cx) / rx) * 0.6 - ((y - cy) / ry) * 0.8;
    return l > 0.5 ? "(" : l > -0.15 ? ")" : l > -0.6 ? "[" : "]";
  };
  // two tower stumps sticking out of the heap (its "ears")
  sandBlock(c, 3, 13, 6, 19);
  merlons(c, 3, 6, 12);
  sandBlock(c, 17, 14, 20, 19);
  merlons(c, 17, 20, 13);
  // the heap
  c.ellipse(11.5, 20.5, 10.4, 3.4, shade(11.5, 20.5, 10.4, 3.4));
  c.ellipse(11.5, 17.6, 6.6, 3.6, shade(11.5, 17.6, 6.6, 3.6));
  // pennant stuck in the top, drooping
  for (let y = 9; y <= 14; y++) c.set(12, y, "H");
  c.put(
    `
pq
pqq
P..`,
    13,
    9,
  );
  // stray clumps
  c.set(1, 22, ")").set(22, 22, "[");
  c.outline("1");
  // dizzy 'x x' eyes + shell nose + wobbly mouth
  for (const ex of [8, 13]) c.set(ex, 17, "1").set(ex + 2, 17, "1").set(ex + 1, 18, "1").set(ex, 19, "1").set(ex + 2, 19, "1");
  c.put(
    `
qpq
.P.`,
    10,
    19,
  );
  c.set(7, 20, "b").set(16, 20, "b");
  return c;
}

// ============================================================================ TINY SHARK
// Chubby baby shark, mostly head. f0-1 only the fin cuts through the sand
// (ripples), f2 surfacing (head pops up, sand spray), f3 chomp (mouth wide).
const SHARK_PAL: Record<string, string> = {
  "(": "#8fc3ff", // body light
  ")": "#5aa8ff", // body base
  "[": "#3a78d6", // body shade
  "]": "#e6d2b0", // sand ripple light
  "{": "#c99a78", // sand ripple shade (reads on dry and wet sand)
};

function finOnly(f: number): Cv {
  const c = new Cv(16, 12);
  // a mound of pushed-up sand around the fin: lit crest on top, shaded trough below
  const cx = 8.5;
  const cy = 9.6;
  c.each((x, y) => {
    const d = ((x + 0.5 - cx) / 6) ** 2 + ((y + 0.5 - cy) / 2.1) ** 2;
    if (d > 1 || d < 0.45) return null;
    if ((x + f * 2) % 5 === 0) return null; // broken, moving ripple
    return y + 0.5 < cy ? "B" : "{";
  });
  // bow wave piling up in front of the fin, wake trailing behind (both shift each frame)
  c.set(14, 8 + f, "B").set(15, 9, "B").set(14, 10 - f, "{");
  const wx = 2 - f;
  c.set(wx + 1, 8, "B").set(wx, 9, "{").set(wx + 2, 10, "{").set(wx + 1, 11, "B");
  // dorsal fin: blue triangle with a lit leading edge and a white glint
  const fin = new Cv(16, 12);
  fin.put(
    `
....)
...)[
..()[
.()[[
()))[`,
    6,
    4 + f,
  );
  fin.set(8, 6 + f, "w");
  fin.outline("1");
  // the sand hides the bottom of the fin
  fin.each((x, y, k) => (y >= 10 - (f === 1 ? 0 : 1) + 1 && k !== "." ? "." : null));
  c.put(fin, 0, 0);
  return c;
}

function sharkHead(chomp: boolean, rise: number): Cv {
  const c = new Cv(16, 12);
  const cy = 6.5 + rise;
  // fin on top + tiny tail behind
  c.put(
    `
.).
()[`,
    6,
    Math.round(cy - 5.6),
  );
  c.set(2, Math.round(cy) - 1, ")").set(1, Math.round(cy) - 2, ")").set(1, Math.round(cy), "[");
  // round chubby head (white belly underneath)
  c.ellipse(8, cy, 6, 4.6, (x, y) => {
    const nx = (x - 8) / 6.5;
    const ny = (y - cy) / 5.1;
    if (ny > 0.35) return ny > 0.65 ? "W" : "w";
    const l = -nx * 0.6 - ny * 0.8;
    return l > 0.45 ? "(" : l > -0.25 ? ")" : "[";
  });
  // cut off by the sand line while surfacing
  if (rise > 0) c.each((_x, y) => (y >= 11 ? "." : null));
  c.outline("1");
  // big round eyes, glancing right
  const ey = Math.round(cy) - 2;
  for (const ex of [7, 11]) {
    c.set(ex, ey, "0").set(ex + 1, ey, "0").set(ex, ey + 1, "0").set(ex + 1, ey + 1, "0");
    c.set(ex + 1, ey, "w");
  }
  c.set(6, ey + 2, "b").set(13, ey + 2, "b");
  if (chomp) {
    // CHOMP: the whole front of the face opens: teeth on both jaws, dark gullet, red tongue
    c.put(
      `
.11111
1w1w10
100000
10rrr0
1w1w10
.11111`,
      9,
      Math.round(cy),
    );
  } else {
    // smile showing three tiny teeth
    const my = Math.round(cy) + 1;
    c.set(9, my, "1").set(10, my + 1, "1").set(11, my + 1, "w").set(12, my + 1, "1").set(13, my, "1");
    c.set(10, my, "w").set(12, my, "w");
  }
  if (rise > 0) {
    // sand spray around the surfacing head + the sand line
    for (const [x, y] of [
      [1, 9],
      [0, 7],
      [15, 8],
      [14, 6],
      [3, 10],
    ] as [number, number][])
      c.set(x, y, "]");
    for (let x = 2; x <= 14; x++) if (c.get(x, 11) === ".") c.set(x, 11, x % 2 ? "{" : "]");
  }
  return c;
}

export const sprites: SpriteDef[] = [
  spr("en_crab", 16, 16, crabFrames(), "feet", { pal: PAL }),
  spr("en_seagull", 16, 16, seagullFrames(), "feet", { pal: PAL }),
  spr("en_jellyfish", 16, 16, jellyFrames(), "feet", { pal: { ...PAL, ...JELLY_PAL } }),
  spr("en_watermelon", 16, 16, [0, 1, 2, 3].map(melon), "feet", { pal: MELON_PAL }),
  spr("en_watermelon_half", 12, 10, [0, 1].map(melonHalf), "feet", { pal: MELON_PAL }),
  spr("eb_seed", 6, 6, [0, 1].map(seed), "center", { pal: SEED_PAL }),
  spr("en_sandcastle", 24, 24, [0, 1, 2, 3].map(sandcastle), "feet", { pal: CASTLE_PAL, fps: 6 }),
  spr("en_tiny_shark", 16, 12, [finOnly(0), finOnly(1), sharkHead(false, 2), sharkHead(true, 0)], "feet", { pal: SHARK_PAL }),
];
