/**
 * Candy Kingdom enemies + enemy bullet (owner: s2-stages-a).
 * All face RIGHT, feet pivot (w/2, h-1); floating enemies are drawn high in
 * their box (code draws the ground shadow at the pivot). Built like the base
 * bestiary (enemies.ts): directional `ball` bodies lit from the top-left, a
 * dark-plum outline, faces hand-pixelled on top. Gameplay notes per enemy:
 * docs/content/enemies.md §1.
 */
import type { SpriteDef } from "../format";
import { Pix, ball, gridSprite } from "../sprites/chars-util";
import { range } from "./s2-stages-a-util";

function ol(p: Pix, key = "1"): Pix {
  return p.outline(key);
}

// ============================================================================ GUMMY BEAR (tinted by code)
// Pale translucent jelly (W/w body, lavender shade) so the per-instance tint reads.
// f0 rest, f1 launch stretch, f2 airborne, f3 'boing' wide squash.
const GUMMY_POSE: { sx: number; sy: number; lift: number }[] = [
  { sx: 1.0, sy: 0.94, lift: 0 },
  { sx: 0.88, sy: 1.12, lift: 0 },
  { sx: 0.96, sy: 1.04, lift: 2 },
  { sx: 1.18, sy: 0.8, lift: 0 },
];
const JELLY = ["g", "W", "W", "w"];

function gummy(i: number): Pix {
  const { sx, sy, lift } = GUMMY_POSE[i];
  const base = 14.5 - lift; // bottom of the feet
  const X = (x: number) => 8 + (x - 8) * sx;
  const Y = (y: number) => base - (14.5 - y) * sy;
  const p = new Pix(16, 16);
  // feet (dangle a touch when airborne)
  const feet = new Pix(16, 16);
  const fy = i === 2 ? 0.7 : 0;
  ball(feet, X(5.4), Y(13.5) + fy, 1.9 * sx, 1.3, JELLY);
  ball(feet, X(10.8), Y(13.5) + fy, 1.9 * sx, 1.3, JELLY);
  ol(feet);
  p.put(feet, 0, 0);
  // one jelly mass: ears, head, body, arms (shading seams, not outlines, separate the parts)
  const j = new Pix(16, 16);
  const armUp = i === 2 ? -1.4 : i === 3 ? 0.8 : 0;
  ball(j, X(8), Y(10.7), 4.6 * sx, 3.3 * sy, JELLY, { bias: 0.08 });
  ball(j, X(3.4), Y(9.9) + armUp, 1.3, 1.6 * sy, JELLY);
  ball(j, X(12.6), Y(9.9) + armUp, 1.3, 1.6 * sy, JELLY);
  ball(j, X(5.2), Y(2.9), 1.7, 1.5, JELLY);
  ball(j, X(11.3), Y(2.9), 1.7, 1.5, JELLY);
  ball(j, X(8.3), Y(5.7), 4.5 * sx, 3.3 * sy, JELLY, { spec: "w", specAt: 0.93, bias: 0.04 });
  // translucent belly: a lighter inner core
  ball(j, X(7.6), Y(11.0), 2.2 * sx, 1.6 * sy, ["W", "w", "w"], { only: (x, y) => j.solid(x, y) });
  // jelly rim light along the lower edge (light passing through)
  const rim = j.clone();
  j.each((x, y, k) => (k !== "." && !rim.solid(x, y + 1) && x < X(10) ? "w" : null));
  ol(j);
  p.put(j, 0, 0);
  // inner ears
  p.set(X(5.2), Y(2.9), "g").set(X(11.3), Y(2.9), "g");
  // two-pixel gleam top-left of the head
  const hx = Math.round(X(5.8));
  const hy = Math.round(Y(4.3));
  p.set(hx, hy, "w").set(hx + 1, hy - 1, "w");
  // face: dot eyes + a tiny nose centred below them + blush (looks right)
  const ey = Math.round(Y(5.4));
  const ex0 = Math.round(X(7.6));
  const ex1 = Math.round(X(11.4));
  if (i === 3) {
    // boing: squeezed happy '> <'
    p.set(ex0, ey, "1").set(ex0 - 1, ey - 1, "1").set(ex0 - 1, ey + 1, "1");
    p.set(ex1, ey, "1").set(ex1 + 1, ey - 1, "1").set(ex1 + 1, ey + 1, "1");
  } else {
    p.set(ex0, ey, "0").set(ex1, ey, "0").set(ex0, ey + 1, "0").set(ex1, ey + 1, "0");
  }
  p.set(Math.round((ex0 + ex1) / 2), ey + 2, "1");
  const by = ey + (i === 3 ? 2 : 2);
  p.set(ex0 - 1, by, "b").set(ex1 + 1, by, "b");
  return p;
}

// ============================================================================ CANDY CORN SOLDIER
// A tip-up candy-corn kernel (white tip, orange middle, yellow base) under a
// little green gumdrop helmet, stubby legs, a toothpick spear in a white-gloved
// fist. f0-3 march: legs alternate, body + spear bob.
/** Kernel rows: [y, x0, x1, band] (band: w white tip, o orange middle, y yellow base). */
const KERNEL: [number, number, number, string][] = [
  [3, 6, 8, "w"],
  [4, 5, 9, "w"],
  [5, 5, 9, "o"],
  [6, 4, 10, "o"],
  [7, 4, 10, "o"],
  [8, 3, 11, "o"],
  [9, 3, 11, "y"],
  [10, 3, 11, "y"],
  [11, 3, 11, "y"],
  [12, 4, 10, "y"],
];

function candyCorn(i: number): Pix {
  const p = new Pix(16, 16);
  const bob = [0, -1, 0, -1][i];
  // legs (march: lift alternates)
  const legs = new Pix(16, 16);
  const lLift = [1, 0, 0, 0][i];
  const rLift = [0, 0, 1, 0][i];
  legs.rect(5, 13 - lLift, 2, 2, "2").rect(8, 13 - rLift, 2, 2, "2");
  legs.set(5, 13 - lLift, "G").set(8, 13 - rLift, "G");
  ol(legs);
  p.put(legs, 0, 0);
  // kernel body: lit left edge, shaded right edge, glossy specks
  const body = new Pix(16, 16);
  for (const [y, x0, x1, band] of KERNEL)
    for (let x = x0; x <= x1; x++) {
      const lit = x === x0 || (x === x0 + 1 && y > 8);
      const shade = x >= x1 - (x1 - x0 > 6 ? 1 : 0);
      let k: string;
      if (band === "w") k = lit ? "w" : shade ? "g" : "W";
      else if (band === "o") k = lit ? "y" : shade ? "O" : "o";
      else k = lit ? "z" : shade ? "Y" : "y";
      body.set(x, y + bob, k);
    }
  body.set(4, 10 + bob, "w");
  ol(body);
  p.put(body, 0, 0);
  // back fist (white glove) peeking out on the left
  p.put(
    `
.11.
1wW1
.11.`,
    0,
    8 + bob,
  );
  // gumdrop helmet: small sugared green dome sitting on the white tip
  p.put(
    `
..111..
.1mle1.
1llleE1
1eeeEE1
.11111.`,
    4,
    -1 + bob,
  );
  p.set(6, 0 + bob, "w");
  // face on the orange band (looks right): lidded, determined eyes + blush + shout
  const fy = 6 + bob;
  p.set(6, fy, "1").set(7, fy, "1").set(6, fy + 1, "0").set(7, fy + 1, "w");
  p.set(9, fy, "1").set(10, fy, "1").set(9, fy + 1, "0").set(10, fy + 1, "w");
  p.set(5, fy + 2, "b").set(11, fy + 2, "b");
  p.set(8, fy + 3, "R").set(8, fy + 2, "1");
  // toothpick spear in the front hand (bobs opposite to the body)
  const sb = [1, 0, 1, 0][i];
  const sx = 13;
  const sp = new Pix(16, 16);
  for (let y = 2 + sb; y <= 14; y++) sp.set(sx, y, y < 4 + sb ? "B" : "h");
  sp.set(sx, 1 + sb, "B");
  ol(sp);
  p.put(sp, 0, 0);
  // white-gloved fist gripping the spear
  p.put(
    `
.11.
1ww1
1Wg1
.11.`,
    sx - 1,
    8 + bob,
  );
  return p;
}

// ============================================================================ DONUT ROLLER
// Pink-frosted donut standing on its edge (the hole doubles as a surprised 'O' mouth),
// sprinkles, tiny feet. f0-1 waddle, f2-3 rolling (sprinkle pattern rotated 45° per frame).
const SPRINKLE_SPOTS: [number, number, string][] = [
  [-4.2, -2.6, "y"],
  [-1.2, -5.0, "c"],
  [3.0, -4.6, "w"],
  [5.0, -1.0, "l"],
  [4.0, 3.2, "u"],
  [0.4, 4.6, "y"],
  [-3.8, 3.0, "c"],
  [-5.2, 0.4, "w"],
];

function donut(i: number): Pix {
  const p = new Pix(16, 16);
  const roll = i >= 2;
  const bob = [0, -1, 0, 0][i];
  const tilt = [0, 0, 0, 0][i];
  const cx = 7.5 + tilt;
  const cy = 7 + bob + (roll ? 1 : 0);
  // feet (waddle only)
  if (!roll) {
    const feet = new Pix(16, 16);
    const lf = i === 0 ? -1 : 0;
    const rf = i === 1 ? -1 : 0;
    feet.rect(4, 14 + lf, 2, 1, "h").rect(10, 14 + rf, 2, 1, "h");
    feet.set(5, 14 + lf, "H").set(11, 14 + rf, "H");
    ol(feet);
    p.put(feet, 0, 0);
  }
  // dough ring (side thickness shows on the lower-right)
  const d = new Pix(16, 16);
  ball(d, cx + 0.4, cy + 0.4, 6.6, 6.6, ["H", "h", "h", "B"]);
  // frosting on the front face, with a drippy lower edge
  const fr = new Pix(16, 16);
  ball(fr, cx - 0.2, cy - 0.2, 6.2, 6.2, ["P", "p", "p", "q"], { spec: "w", specAt: 0.94 });
  fr.each((x, y, k) => {
    if (k === ".") return null;
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    // drips: the frosting edge wobbles on the lower half
    const wob = dy > 0 ? 0.9 * Math.abs(Math.sin(Math.atan2(dy, dx) * 4.5 + (roll ? i : 0))) : 0;
    return r > 5.6 - wob ? "." : null;
  });
  d.put(fr, 0, 0);
  // the hole
  d.each((x, y, k) => (Math.hypot(x - cx - 0.3, y - cy - 0.6) < 1.75 ? "." : k));
  ol(d);
  // inner shadow in the hole's upper rim (depth)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const r = Math.hypot(x - cx - 0.3, y - cy - 0.6);
      if (r >= 1.75 && r < 2.6 && d.get(x, y) !== "1" && y <= cy + 0.6) d.set(x, y, y < cy ? "H" : d.get(x, y));
    }
  p.put(d, 0, 0);
  // sprinkles (rotated 45° per rolling frame)
  const rot = roll ? (i === 2 ? Math.PI / 4 : Math.PI / 2) : 0;
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  for (const [sx0, sy0, k] of SPRINKLE_SPOTS) {
    const sx = Math.round(cx + sx0 * ca - sy0 * sa);
    const sy = Math.round(cy + sx0 * sa + sy0 * ca);
    const pk = p.get(sx, sy);
    if (pk === "p" || pk === "q" || pk === "P") p.set(sx, sy, k);
  }
  // face: eyes above the hole, blush; rolling = determined squint
  const ey = Math.round(cy - 3);
  const ex0 = Math.round(cx - 2);
  const ex1 = Math.round(cx + 3);
  if (!roll) {
    p.set(ex0, ey, "0").set(ex1, ey, "0").set(ex0, ey + 1, "0").set(ex1, ey + 1, "0");
    p.set(ex0, ey, "1").set(ex1, ey, "1");
    p.set(ex0 - 1, ey + 2, "b").set(ex1 + 1, ey + 2, "b");
  } else {
    p.set(ex0 - 1, ey, "1").set(ex0, ey + 1, "1").set(ex0 - 1, ey + 2, "1");
    p.set(ex1 + 1, ey, "1").set(ex1, ey + 1, "1").set(ex1 + 1, ey + 2, "1");
  }
  return p;
}

// ============================================================================ MARSHMALLOW BRUTE (24x24)
// A big squishy cylinder (lit left face, lavender right face, pale top), tiny arms,
// sleepy closed eyes and a ':3'. f0-3 heavy squash-walk (top compresses on the step frames).
function marshmallow(i: number): Pix {
  const p = new Pix(24, 24);
  const squash = [0, 2, 0, 2][i];
  const lLift = [0, 0, 1, 0][i];
  const rLift = [1, 0, 0, 0][i];
  const left = 4 - (squash ? 1 : 0);
  const right = 19 + (squash ? 1 : 0);
  const topY = 5 + squash;
  const botY = 20;
  // feet
  const feet = new Pix(24, 24);
  ball(feet, 8, 21 - lLift, 2.6, 1.4, ["g", "W", "w"]);
  ball(feet, 15.5, 21 - rLift, 2.6, 1.4, ["g", "W", "w"]);
  ol(feet);
  p.put(feet, 0, 0);
  // body: rounded box with cylindrical shading
  const b = new Pix(24, 24);
  const w = right - left;
  for (let y = topY; y <= botY; y++)
    for (let x = left; x <= right; x++) {
      const edge = x === left || x === right;
      const edge2 = x === left + 1 || x === right - 1;
      if (edge && (y <= topY + 1 || y >= botY - 1)) continue;
      if (edge2 && (y === topY || y === botY)) continue;
      const u = (x - left) / w; // 0..1 across
      let k = u < 0.12 ? "w" : u < 0.62 ? "W" : u < 0.86 ? "g" : "j";
      if (u >= 0.62 && u < 0.7 && (x + y) % 2 === 0) k = "W"; // soft dither into the shade
      b.set(x, y, k);
    }
  // top face (pale ellipse)
  const tcx = (left + right) / 2;
  b.ellipse(tcx, topY + 1.4, (right - left) / 2 - 0.4, 1.9, (x, y) => (y <= topY + 1 ? "w" : x > tcx + 5 ? "W" : "w"));
  // rim line between top and side
  for (let x = left + 1; x < right; x++) if (b.get(x, topY + 3) !== ".") b.set(x, topY + 3, x > tcx + 4 ? "g" : "W");
  // tiny arms
  ball(b, left - 0.6, 14 + squash * 0.5, 1.4, 1.8, ["g", "W", "w"]);
  ball(b, right + 0.6, 14 + squash * 0.5, 1.4, 1.8, ["g", "j", "W"]);
  ol(b);
  p.put(b, 0, 0);
  // sleepy face (looks right): heavy flat lids with a droop, ':3' mouth, blush
  const fy = 11 + Math.round(squash * 0.7);
  const e0 = 10;
  const e1 = 16;
  for (const ex of [e0, e1]) p.set(ex - 1, fy, "1").set(ex, fy, "1").set(ex + 1, fy, "1");
  p.set(e0 - 2, fy + 1, "1").set(e1 + 2, fy + 1, "1"); // outer droop
  // ':3' (an 'ω'), well below the eyes
  const mx = 12;
  const my = fy + 3;
  p.set(mx, my, "1").set(mx + 1, my + 1, "1").set(mx + 2, my, "1").set(mx + 3, my + 1, "1").set(mx + 4, my, "1");
  p.set(e0 - 2, fy + 2, "b").set(e0 - 1, fy + 2, "b").set(e1 + 1, fy + 2, "b").set(e1 + 2, fy + 2, "b");
  // sugar dusting specks
  p.set(left + 3, 17, "w").set(left + 6, 15, "w").set(right - 3, 18, "W");
  return p;
}

// ============================================================================ LOLLIPOP MAGE (16x20, floats)
// Robed little wizard: tall twisted-candy hat with a lollipop tip, lavender robe, lollipop staff.
// f0-1 float bob, f2 cast (staff raised, swirl glows), f3 heal pose (arms wide).
function mageHat(p: Pix, bob: number, tilt: number): void {
  const h = new Pix(16, 20);
  // cone with diagonal pink/white twist stripes
  for (let y = 2; y <= 8; y++) {
    const t = (y - 2) / 6;
    const cx = 6.5 + (1 - t) * 1.2 * tilt;
    const hw = 0.6 + t * 3.2;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const stripe = Math.floor((x + y * 1.0) / 2) % 2 === 0;
      const shade = x > cx + hw * 0.4;
      h.set(x, y + bob, stripe ? (shade ? "P" : "p") : shade ? "W" : "w");
    }
  }
  // brim
  h.rect(2, 9 + bob, 10, 1, (x) => (x < 4 ? "i" : x > 9 ? "I" : "i"));
  h.set(3, 8 + bob, "i").set(10, 8 + bob, "I");
  ol(h);
  p.put(h, 0, 0);
  // lollipop tip (swirl ball)
  const tx = Math.round(6.5 + 1.2 * tilt);
  p.put(
    `
.11.
1qp1
1pP1
.11.`,
    tx - 1,
    bob,
  );
}

function mage(i: number): Pix {
  const p = new Pix(16, 20);
  const bob = [0, -1, -1, 0][i];
  const by = 1 + bob; // float: the whole figure hovers
  // robe (bell), hem flutters
  const robe = new Pix(16, 20);
  for (let y = 11; y <= 17; y++) {
    const t = (y - 11) / 6;
    const hw = 2.6 + t * 2.6;
    for (let x = Math.round(6.5 - hw); x <= Math.round(6.5 + hw); x++) {
      const rel = (x - (6.5 - hw)) / (2 * hw);
      robe.set(x, y + by, rel < 0.25 ? "j" : rel > 0.7 ? "I" : "i");
    }
  }
  const hem = [
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  ][i % 2];
  for (let k = 0; k < 11; k++) if (hem[k]) robe.set(1 + k, 18 + by, k > 7 ? "I" : "i");
  // star emblem
  robe.set(5, 14 + by, "q").set(7, 14 + by, "p").set(5, 15 + by, "p").set(6, 15 + by, "p").set(7, 15 + by, "P").set(6, 16 + by, "P");
  ol(robe);
  p.put(robe, 0, 0);
  // face (peeks under the brim)
  const face = new Pix(16, 20);
  ball(face, 7, 10.6 + by, 3.4, 2.4, ["k", "s", "s", "t"]);
  ol(face);
  p.put(face, 0, 0);
  const fy = 10 + by;
  if (i === 3) {
    // heal: happy closed eyes '^ ^'
    p.set(6, fy + 1, "1").set(7, fy, "1").set(8, fy + 1, "1");
    p.set(9, fy + 1, ".");
    p.set(9, fy + 1, "s");
  } else {
    p.set(6, fy, "0").set(6, fy + 1, "0").set(9, fy, "0").set(9, fy + 1, "0");
    if (i === 2) p.set(6, fy, "z").set(9, fy, "z"); // eyes light up on the cast
    else p.set(6, fy, "w").set(9, fy, "w");
  }
  p.set(5, fy + 2, "b").set(10, fy + 2, "b");
  // hat on top (tilts back on the cast)
  mageHat(p, by, i === 2 ? -1 : i === 3 ? 0 : i === 1 ? 0 : 0);
  // arms + staff
  const staffX = 12;
  if (i === 3) {
    // heal: both arms flung up and out in a V, sparkles rising from the hands
    p.put(
      `
.11..........11.
1sI1........1Is1
1iI1........1iI1
.1ii1......1ii1.
..1ii1....1ii1..
...1111..1111...`,
      0,
      6 + by,
    );
    for (const [x, y] of [
      [1, 2],
      [14, 1],
      [3, 0],
    ] as const)
      p.set(x, y + by, "z");
    p.set(0, 3 + by, "+").set(15, 3 + by, "+").set(13, 0 + by, "w");
  } else {
    const raise = i === 2;
    const sy = raise ? -3 : 0;
    // staff stick
    for (let y = 7 + by + sy; y <= 17 + by + sy; y++) p.set(staffX + 1, y, y % 3 === 0 ? "g" : "W");
    // candy head
    if (raise) {
      // swirl head blazing: white-hot core, gold glow ring, sparkle pixels
      p.put(
        `
..+z+..
.+1111+
z1wzw1z
+1zwz1+
.1wzw1.
.+111+.
..+z+..`,
        staffX - 2,
        0,
      );
    } else
      p.put(
        `
.111.
1qpp1
1pwP1
1PPQ1
.111.`,
        staffX - 1,
        3 + by,
      );
    // hand (sleeve) on the staff
    p.put(
      `
111.
1ii1
1Is1
.11.`,
      staffX - 2,
      (raise ? 9 : 12) + by,
    );
  }
  return p;
}

// ============================================================================ eb_candy (8x8 bullet)
// Pink-white swirl candy: dark deep-pink rim (reads on pink frosting), white core, soft glow.
const CANDY_PAL = { "+": "#ff3d9a40", "*": "#ff7ab890", "=": "#ffb8dcd0" };
const EB_CANDY = [
  `
..+**+..
.+*QQ*+.
+*QpwpQ*
*QwppwQ*
*QpwwpQ*
+*QpwpQ*
.+*QQ*+.
..+**+..`,
  `
.+*==*+.
+*=QQ=*+
*=QwppQ=
=QpwwwQ=
=QwwwpQ=
*=QppwQ=
+*=QQ=*+
.+*==*+.`,
];

export const sprites: SpriteDef[] = [
  gridSprite("en_gummy", 16, 16, range(4).map(gummy), "feet", { fps: 8 }),
  gridSprite("en_candy_corn", 16, 16, range(4).map(candyCorn), "feet", { fps: 8 }),
  gridSprite("en_donut", 16, 16, range(4).map(donut), "feet", { fps: 8 }),
  gridSprite("en_marshmallow", 24, 24, range(4).map(marshmallow), "feet", { fps: 6 }),
  gridSprite("en_lollipop_mage", 16, 20, range(4).map(mage), "feet", { fps: 5, pal: { "+": "#fff7b0a0" } }),
  gridSprite("eb_candy", 8, 8, EB_CANDY, "center", { fps: 8, pal: CANDY_PAL }),
];
