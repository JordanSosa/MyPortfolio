/**
 * Beach Episode enemies (owner: s2-stages-b): Crab-kun, Seagull, Jellyfish,
 * Watermelon (+ half), Sandcastle Golem, Tiny Shark and the seed bullet.
 * Art direction + gameplay tells: docs/content/enemies.md §3.
 *
 * All face RIGHT, feet pivot (w/2, h-1), plum '1' outlines, light from the
 * top-left. Bodies use the directional `ball` shader; faces and details are
 * hand-pixelled on top. Every special frame (tell / attack) is drawn to read
 * at 1x against warm sand.
 */
import type { SpriteDef } from "../format";
import { Cv, spr } from "./s2-stages-b-util";

/** Local warm-light keys shared by the beach enemies. */
const PAL: Record<string, string> = {
  "+": "#ff9488", // red lit (warm)
  "=": "#ffd2c8", // red rim / belly light
};

// ============================================================================ CRAB-KUN
// Everything is composed in colour first and outlined ONCE, so parts never
// stack their own outlines; 1px gaps between parts become clean '1' separators.
// Claw parts are the RIGHT claw ('+' lit, 'r' base, 'R' shade); the left is mirrored.
const CLAW_SIDE = `
r.r
+rr
+rR
.R.`;
const CLAW_UP = `
r..r
+r.r
+rrR
.rR.
..R.`;
const CLAW_FWD = `
+rrr
+r..
+r..
+rrR`;

interface CrabPose {
  dy: number; // body bob
  legs: 0 | 1 | 2; // leg phase (2 = stretched lunge)
  claws: "side" | "up" | "fwd";
}

function crab(o: CrabPose): Cv {
  const c = new Cv(16, 16);
  const up = o.claws === "up";
  const fwd = o.claws === "fwd";
  const bx = 7.5 + (fwd ? 0.5 : 0);
  const by = 10 + o.dy;
  const fx = Math.round(bx);
  const fy = Math.round(by);
  // legs
  const LEGS: [number, number][][] = [
    [[-4, 3], [-5, 4], [3, 3], [4, 4], [-2, 4], [1, 4]],
    [[-4, 3], [-4, 4], [3, 3], [3, 4], [-3, 4], [2, 4]],
    [[-4, 3], [-5, 4], [-6, 4], [3, 3], [2, 4], [-2, 4]],
  ];
  const legY = Math.round(10); // legs stay planted while the shell bobs
  for (const [x, y] of LEGS[o.legs]) c.set(fx + x, legY + y - (y === 3 && o.dy < 0 ? 1 : 0), "R");
  // shell (squashes on the tell)
  c.ball(bx, by + (up ? 0.5 : 0), up ? 5 : 4.6, up ? 2.8 : 3.3, "Rrr+", { bias: 0.08 });
  c.each((x, y, k) => (k !== "." && k !== "R" && !c.solid(x, y + 1) && x > bx - 3 && x < bx + 2 ? "=" : null));
  // eyes on short stalks
  const ey = fy - (up ? 5 : 6);
  for (const x of [fx - 3, fx + 1]) {
    c.set(x + (x < fx ? 1 : 0), ey + 2, "R");
    c.set(x, ey, "w").set(x + 1, ey, fwd ? "0" : "w");
    c.set(x, ey + 1, "w").set(x + 1, ey + 1, "0");
  }
  // claws
  if (o.claws === "side") {
    c.put(CLAW_SIDE, fx + 4, fy - 7);
    c.put(CLAW_SIDE, fx - 7, fy - 7, { flip: true });
    c.set(fx + 4, fy - 3, "R").set(fx - 5, fy - 3, "R");
  } else if (up) {
    c.put(CLAW_UP, fx + 3, fy - 9);
    c.put(CLAW_UP, fx - 7, fy - 9, { flip: true });
  } else {
    c.put(CLAW_FWD, fx + 4, fy - 4);
    c.put(CLAW_SIDE, fx - 7, fy - 7, { flip: true });
    c.set(fx - 5, fy - 3, "R");
  }
  c.outline("1");
  // shell glint, tell glints on the pincer tips
  c.set(fx - 2, fy - 2 + (up ? 1 : 0), "w");
  if (up) c.set(fx + 3, fy - 9, "w").set(fx - 4, fy - 9, "w");
  // face: blush + ':3' cat mouth (an open 'o' while lunging)
  const my = fy + (up ? 1 : 0);
  c.set(fx - 3, my, "b").set(fx + 3, my, "b");
  if (fwd) c.set(fx, my, "1").set(fx + 1, my, "1").set(fx, my + 1, "R").set(fx + 1, my + 1, "1");
  else c.set(fx - 1, my, "1").set(fx, my + 1, "1").set(fx + 1, my, "1");
  return c;
}

function crabFrames(): Cv[] {
  return [
    crab({ dy: 0, legs: 0, claws: "side" }),
    crab({ dy: -1, legs: 1, claws: "side" }),
    crab({ dy: 0, legs: 0, claws: "up" }),
    crab({ dy: 0, legs: 2, claws: "fwd" }),
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
  return [seagull("up", 0, 0), seagull("down", 0, 1), seagull("glide", 0, 0), seagull("tuck", 0.55, 0)];
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

function jelly(phase: number, rx: number, ry: number, rim: number, glow: boolean): Cv {
  const c = new Cv(16, 16);
  const cx = 7.5;
  // bell: a tall dome with a softly rounded rim
  c.each((x, y) => {
    const dx = (x + 0.5 - (cx + 0.5)) / rx;
    const dy = (y + 0.5 - (rim + 0.5)) / ry;
    // frilled skirt: every other pixel under the rim, so the outline scallops it
    const frill = y === Math.round(rim) + 1 && Math.abs(dx) < 0.9 && (x + Math.round(phase)) % 2 === 0;
    const inside = y <= rim ? dx * dx + dy * dy <= 1 : frill;
    if (!inside) return null;
    if (frill) return "&";
    const l = -dx * 0.55 - dy * 0.75;
    if (l > 1.0) return "*";
    if (dx > 0.62 && dy > -0.75) return "&";
    return "%";
  });
  // pink spots
  const spots: [number, number][] = [
    [-0.55, -0.55],
    [0.05, -0.8],
    [0.55, -0.45],
    [-0.15, -0.3],
  ];
  for (const [sx, sy] of spots) {
    const x = Math.round(cx + sx * rx);
    const y = Math.round(rim + sy * ry);
    if (c.get(x, y) !== ".") c.set(x, y, "q");
  }
  c.outline(glow ? "!" : "1");
  if (glow) c.each((x, y, k) => (k !== "!" && k !== "." && (c.get(x - 1, y) === "!" || c.get(x + 1, y) === "!" || c.get(x, y - 1) === "!") ? "w" : null));
  // tentacles: un-outlined coloured strands so they stay delicate
  const tents = [4.6, 6.6, 8.8, 10.8];
  const bottom = Math.round(rim) + 2;
  tents.forEach((tx0, i) => {
    for (let y = bottom + 1; y <= 15; y++) {
      const d = y - bottom;
      const x = tx0 + (tx0 - cx) * 0.1 * d + Math.sin(d * 0.85 + phase + i * 1.9) * 0.85;
      const k = glow ? (i % 2 ? "!" : "w") : i % 2 ? "i" : "p";
      if (c.get(Math.round(x), y) === ".") c.set(Math.round(x), y, k);
    }
  });
  // sleepy face low on the bell, looking right: closed '‿' eyes, blush, tiny mouth
  const fy = Math.round(rim - 1);
  const fx = Math.round(cx + 1);
  for (const ex of [fx - 3, fx + 1]) c.set(ex, fy - 1, "1").set(ex + 1, fy, "1").set(ex + 2, fy - 1, "1");
  c.set(fx - 3, fy + 1, "b").set(fx + 3, fy + 1, "b");
  c.set(fx, fy + 1, "1");
  // shine
  c.set(Math.round(cx - rx * 0.55), Math.round(rim - ry * 0.6), "w");
  return c;
}

function jellyFrames(): Cv[] {
  return [
    jelly(0, 6, 6, 7.5, false),
    jelly(1.6, 6.6, 5.2, 8.2, false),
    jelly(3.2, 5.5, 6.6, 7, false),
    jelly(0, 6, 6, 7.5, true),
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

function melonBody(c: Cv, cx: number, cy: number, rx: number, ry: number, axisDeg: number, face: (x: number, y: number) => boolean): void {
  const a = (axisDeg * Math.PI) / 180;
  const ax = Math.sin(a);
  const ay = -Math.cos(a);
  c.ellipse(cx, cy, rx, ry, (x, y) => {
    const nx = (x - cx) / (rx + 0.5);
    const ny = (y - cy) / (ry + 0.5);
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const u = nx * -ay + ny * ax; // across the stripe axis
    const v = nx * ax + ny * ay; // along it
    const lon = Math.atan2(u, nz);
    // narrow dark stripes with a little zig-zag wobble, never across the face
    const stripe = !face(x, y) && Math.cos(lon * 3.4 + 0.9 + Math.sin(v * 9) * 0.3) > 0.5;
    const l = nx * -0.55 + ny * -0.62 + nz * 0.56;
    if (stripe) return l > 0.45 ? "<" : ">";
    if (l > 0.3) return "[";
    return l > -0.15 ? "]" : "{";
  });
}

function strawHat(c: Cv, x: number, y: number, tilt: number): void {
  // brim + crown + red ribbon; tilt shifts the crown back (to the left)
  const t = tilt;
  c.put(
    `
....hBBBh....
...hBzBBBh...
...rrrrrrR...
.hBBBBBBBBBh.
hhFFFFFFFFFhh`,
    x,
    y,
    {},
  );
  if (t) {
    // windswept: brim lifted at the front
    c.set(x + 12, y + 3, "h").set(x + 12, y + 4, ".").set(x + 11, y + 4, "F");
  }
}

function melon(f: number): Cv {
  const c = new Cv(16, 16);
  const roll = f >= 2;
  const bob = f === 1 ? -1 : 0;
  const cx = 7.5;
  const cy = (roll ? 10 : 9.6) + bob;
  const fx = 9;
  const fy = Math.round(cy) + (roll ? 0 : 0);
  // feet (waddle)
  if (!roll) {
    const lf = f === 0 ? 0 : -1;
    const rf = f === 0 ? -1 : 0;
    c.set(5, 14 + lf - bob, "E").set(6, 14 + lf - bob, "E").set(9, 14 + rf - bob, "E").set(10, 14 + rf - bob, "E");
  }
  const faceBox = (x: number, y: number) => x >= fx - 3 && x <= fx + 3 && y >= fy - 1 && y <= fy + 2;
  melonBody(c, cx, cy, roll ? 6.2 : 6, roll ? 4.8 : 5, roll ? (f === 2 ? 45 : 90) : 0, faceBox);
  // hat on top (lifted and blown back while rolling)
  const hat = new Cv(16, 16);
  strawHat(hat, roll ? 0 : 1, roll ? 0 : 1 + bob, roll ? 1 : 0);
  c.put(hat, 0, 0);
  c.outline("1");
  if (!roll) {
    c.set(fx - 2, fy - 1, "0").set(fx - 2, fy, "0").set(fx + 2, fy - 1, "0").set(fx + 2, fy, "0");
    c.set(fx - 2, fy - 1, "w").set(fx + 2, fy - 1, "w");
    c.set(fx - 3, fy + 1, "b").set(fx + 3, fy + 1, "b");
    c.set(fx - 1, fy + 1, "1").set(fx, fy + 2, "R").set(fx + 1, fy + 1, "1").set(fx, fy + 1, "r");
  } else {
    c.set(fx - 3, fy - 1, "1").set(fx - 2, fy, "1").set(fx - 3, fy + 1, "1"); // '>'
    c.set(fx + 3, fy - 1, "1").set(fx + 2, fy, "1").set(fx + 3, fy + 1, "1"); // '<'
    c.set(fx - 1, fy + 1, "1").set(fx, fy + 1, "1").set(fx + 1, fy + 1, "1").set(fx, fy + 2, "r");
  }
  return c;
}

/** Watermelon half: red flesh (seeds up) on a green rind dome, tiny angry face. f1 = airborne. */
function melonHalf(f: number): Cv {
  const c = new Cv(12, 10);
  const up = f === 1 ? 1 : 0;
  const cy = 3.4 - up;
  // rind dome (front)
  c.each((x, y) => {
    const dx = (x + 0.5 - 6) / 5.2;
    const dy = (y + 0.5 - (cy + 0.6)) / (f === 1 ? 5.4 : 4.9);
    if (y + 0.5 < cy + 0.6 || dx * dx + dy * dy > 1) return null;
    const l = -dx * 0.6 - dy * 0.4;
    return l > 0.3 ? "[" : l > -0.25 ? "]" : "{";
  });
  // white rind line + red flesh disc on top
  c.ellipse(5.5, cy, 5, 2.2, "W");
  c.ellipse(5.5, cy, 4, 1.5, (x, y) => (x < 4 && y < cy ? "q" : x > 7 ? "R" : "r"));
  // seeds
  for (const [sx, sy] of [
    [3, 0],
    [6, -1],
    [8, 0],
    [5, 1],
  ] as [number, number][])
    c.set(sx, Math.round(cy) + sy, "0");
  c.outline("1");
  // tiny angry face on the rind
  const fy = Math.round(cy) + 4;
  c.set(6, fy - 1, "1").set(9, fy - 1, "1"); // brows angled in
  c.set(7, fy, "0").set(9, fy, "0");
  c.set(8, fy + 1, "1");
  return c;
}

const SEED_PAL: Record<string, string> = {
  "(": "#ff7ab8a0", // inner halo (pink, translucent)
  ")": "#ffb8dc60", // outer halo
};

function seed(f: number): Cv {
  const c = new Cv(6, 6);
  c.put(
    `
.0.
000
000
.0.`,
    1,
    1,
  );
  c.set(2, 2, "w");
  c.halo(f === 0 ? ["p", ")"] : ["q", "("]);
  return c;
}

// ============================================================================ SANDCASTLE GOLEM
// A walking sandcastle: two towers for ears, window eyes, a pink shell nose,
// an arched door mouth, a pennant on top and stubby sand legs. Darker, more
// saturated sand than the ground so it never melts into the beach.
const CASTLE_PAL: Record<string, string> = {
  "(": "#ffe7b0", // lit sand
  ")": "#f2bd66", // sand base
  "[": "#d99a5a", // sand shade
  "]": "#a8683f", // deep shade / mortar
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
  for (const [x, y] of trick) c.set(x, y + bob, ")");
  c.outline("1");
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
  "{": "#cfa983", // sand ripple shade
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
    return y + 0.5 < cy ? "B" : "h";
  });
  // wake trailing behind (left), shifting each frame
  const wx = 2 - f;
  c.set(wx + 1, 8, "B").set(wx, 9, "h").set(wx + 2, 10, "h").set(wx + 1, 11, "B");
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
  if (chomp) {
    // mouth wide open on the front
    c.ellipse(11.5, cy + 1.2, 2.6, 2.1, "R");
    c.ellipse(11.8, cy + 1.6, 1.5, 1.1, "0");
  }
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
    // three little teeth on the upper jaw
    const my = Math.round(cy) + 0;
    c.set(10, my, "w").set(12, my, "w").set(14, my + 1, "w");
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
