/**
 * Boss sprites (owner: chars). Feet pivot (w/2, h-1), facing right.
 *  - boss_kingpuff 48x48: f0 idle, f1 squish, f2 stretch (jump wind-up), f3 squashed flat (landing)
 *  - boss_teddy    56x56: f0-1 stomp, f2 wind-up (claws raised), f3 roar
 *  - boss_lunatic  48x64: f0-1 float, f2 cast (arms out), f3 laugh
 */
import type { SpriteDef } from "../format";
import { Pix, ball, gridSprite, strand, type StrandKeys } from "./chars-util";

function layer(p: Pix, draw: (l: Pix) => void, outline: string | null = "1"): Pix {
  const l = new Pix(p.w, p.h);
  draw(l);
  if (outline) l.outline(outline);
  p.put(l, 0, 0);
  return l;
}

const SPARK = `
.w.
wzw
.w.
`;
const SPARK_B = `
...w...
...w...
..wzw..
wwzzzww
..wzw..
...w...
...w...
`;

// ============================================================================ KING PUFF
const CROWN = `
.1.....1.....1.
1z1...1z1...1y1
1yy1.1yzy1.1yY1
1yzy1yyryy1yyY1
1yyyyyyyyyyyyY1
1YcYyYyrYyYcYY1
1YYYYYYYYYYYYO1
.1111111111111.
`;
const MOUSTACHE = `
.11...........11.
1BB1.........1BB1
1B1...11111...1B1
1BF1.1BBBBB1.1FB1
.1BF1BBBBBBB1FB1.
.1FBBBBFhFBBBBF1.
..1hFFBB1BBFFh1..
...1111h1h1111...
.......111.......
`;

function kingPuff(i: number): Pix {
  const p = new Pix(48, 48);
  const pose = [
    { cx: 24, cy: 33, rx: 19, ry: 13.6 },
    { cx: 24, cy: 34, rx: 20.5, ry: 12.6 },
    { cx: 24, cy: 31, rx: 17, ry: 15.6 },
    { cx: 24, cy: 39, rx: 23, ry: 8.6 },
  ][i];
  const top = Math.round(pose.cy - pose.ry);
  // royal cape behind the body with ermine trim on its edges
  layer(p, (l) => {
    const cy = top + 4;
    const L0 = pose.cx - pose.rx + 3;
    const R0 = pose.cx + pose.rx - 3;
    l.poly([[L0, cy], [R0, cy], [pose.cx + pose.rx + 4, 47], [pose.cx - pose.rx - 4, 47]], "r");
    l.each((x, y, k) => (k === "r" && x > pose.cx + 4 ? "R" : null));
    // ermine: white fur bands along both outer edges with black tail tips
    for (let y = cy; y <= 47; y++) {
      const t = (y - cy) / (47 - cy);
      const lx = Math.round(L0 + (pose.cx - pose.rx - 4 - L0) * t);
      const rx = Math.round(R0 + (pose.cx + pose.rx + 4 - R0) * t);
      l.set(lx, y, "w").set(lx + 1, y, "W").set(rx, y, "W").set(rx - 1, y, "g");
      if ((y - cy) % 4 === 2) l.set(lx + 1, y, "0").set(rx - 1, y, "0");
    }
  });
  // slime body
  layer(p, (l) => {
    ball(l, pose.cx, pose.cy, pose.rx, pose.ry, ["C", "c", "c", "a", "a"], { spec: "w", specAt: 0.93 });
    // jelly rim + inner bubbles
    l.each((x, y, k) => (k !== "." && !l.solid(x, y + 1) && x < pose.cx + 4 ? "a" : null));
    l.set(pose.cx - 10, pose.cy + 3, "a").set(pose.cx - 9, pose.cy + 4, "a").set(pose.cx + 12, pose.cy + 2, "a");
    l.set(pose.cx - 12, pose.cy - 6, "w").set(pose.cx - 11, pose.cy - 7, "w");
  });
  // crown (tilted jauntily)
  p.put(CROWN, pose.cx - 9, top - 6);
  // face
  const fy = Math.round(pose.cy - pose.ry * 0.35);
  const fx = pose.cx + 3;
  const eye = i === 3 ? `
1111
....
` : `
.11.
1w01
1001
1001
.11.
`;
  p.put(eye, fx - 5, fy - 3);
  p.put(eye, fx + 6, fy - 3);
  // blush
  for (const bx of [fx - 9, fx + 10]) p.set(bx, fy + 2, "b").set(bx + 1, fy + 2, "b").set(bx + 2, fy + 1, "b");
  p.put(MOUSTACHE, fx - 8, fy + 2);
  if (i === 3) p.put(SPARK, fx - 18, fy - 6).put(SPARK, fx + 14, fy - 4);
  return p;
}

// ============================================================================ NIGHTMARE TEDDY
const FUR = ["2", "2", "2", "I", "I", "i"];

/** Cotton stuffing puff cluster. */
function cotton(l: Pix, x: number, y: number, n: number): void {
  const offs: [number, number, number][] = [[0, 0, 1.6], [2, -1, 1.3], [-2, 1, 1.2], [1, 2, 1.1], [3, 1, 1.0]];
  for (const [dx, dy, r] of offs.slice(0, n)) ball(l, x + dx, y + dy, r + 0.4, r + 0.3, ["g", "W", "w"]);
}

function clawPaw(l: Pix, cx: number, cy: number, dir: 1 | -1, up = false): void {
  ball(l, cx, cy, 6, 7.5, FUR);
  l.ellipse(cx + dir, cy + (up ? -3 : 3), 3, 2.5, "q"); // paw pad
  // three big hooked claws (2px blades curving outward)
  for (let c = -1; c <= 1; c++) {
    const bx = cx + c * 3 - (dir < 0 ? 1 : 0);
    const by = up ? cy - 7 : cy + 7;
    const sy = up ? -1 : 1;
    l.set(bx, by, "w").set(bx + 1, by, "W");
    l.set(bx, by + sy, "w").set(bx + 1, by + sy, "g");
    l.set(bx + (dir > 0 ? 1 : 0), by + 2 * sy, "W").set(bx + (dir > 0 ? 2 : -1), by + 3 * sy, "g");
  }
}

function nightmareTeddy(i: number): Pix {
  const p = new Pix(56, 56);
  const bob = [0, 0, -2, -1][i];
  const lLift = i === 0 ? 3 : 0;
  const rLift = i === 1 ? 3 : 0;
  // legs
  layer(p, (l) => {
    ball(l, 17, 49.5 - lLift, 7, 5.5, FUR);
    ball(l, 38, 49.5 - rLift, 7, 5.5, FUR);
    l.ellipse(18, 51 - lLift, 3.5, 2.5, "j");
    l.ellipse(39, 51 - rLift, 3.5, 2.5, "j");
    l.set(12, 47 - lLift, "g").set(13, 46 - lLift, "g").set(14, 47 - lLift, "g");
  });
  // back arm (left)
  layer(p, (l) => {
    if (i === 2) clawPaw(l, 8, 18 + bob, -1, true);
    else if (i === 3) clawPaw(l, 5, 28 + bob, -1);
    else clawPaw(l, 9, 34 + bob + (i === 0 ? 1 : -1), -1);
  });
  // body
  layer(p, (l) => {
    ball(l, 28, 36 + bob, 17, 13, FUR, { spec: "j", specAt: 0.95 });
    // torn belly hole: jagged dark rim, cotton spilling out
    l.poly([[22, 33 + bob], [25, 31 + bob], [27, 33 + bob], [30, 30 + bob], [33, 33 + bob], [36, 32 + bob], [36, 40 + bob], [33, 44 + bob], [30, 42 + bob], [27, 45 + bob], [23, 42 + bob]], "0");
    cotton(l, 27, 36 + bob, 5);
    cotton(l, 32, 39 + bob, 4);
    // stitches along the seams
    for (let y = -6; y <= 6; y += 2) l.set(20, 37 + bob + y, "j").set(19, 38 + bob + y, "j");
    // mismatched sewn patches
    l.rect(37, 28 + bob, 6, 5, "e");
    l.rect(37, 28 + bob, 6, 1, "l");
    l.rect(37, 32 + bob, 6, 1, "E");
    for (let x = 37; x < 43; x += 2) l.set(x, 27 + bob, "g").set(x, 33 + bob, "g");
    l.rect(13, 40 + bob, 4, 4, "q");
    l.set(12, 41 + bob, "g").set(12, 43 + bob, "g").set(17, 40 + bob, "g");
  });
  // shoulder seam bursting
  layer(p, (l) => cotton(l, 15, 25 + bob, 3), "1");
  // head
  const hy = 16 + bob + (i === 3 ? -1 : 0);
  layer(p, (l) => {
    ball(l, 15, hy - 9, 5.5, 5.5, FUR);
    ball(l, 41, hy - 9, 5.5, 5.5, FUR);
    l.ellipse(15, hy - 9, 2.5, 2.5, "q");
    // torn right ear: bite-shaped notch
    l.ellipse(44, hy - 13, 2.6, 2.6, ".");
    ball(l, 28, hy, 15, 12, FUR, { spec: "j", specAt: 0.95 });
    ball(l, 32, hy + 5, 6.5, 4.5, ["I", "i", "j"]);
  });
  layer(p, (l) => cotton(l, 44, hy - 12, 2), "1");
  // stitched scar across the left eye
  p.line(18, hy - 8, 25, hy + 1, "j");
  for (let k = 0; k <= 7; k += 2) p.set(17 + k, hy - 6 + k, "w").set(19 + k, hy - 8 + k, "w");
  // heavy brow + glowing red eyes (angry slant)
  const ey = hy - 3;
  const glowEye = (x: number, flip: boolean) => {
    const e = Pix.of(`
11....
.111..
1RrrR1
1rzyr1
1RrrR1
.1111.
`);
    p.put(flip ? e.flipX() : e, x, ey);
  };
  glowEye(21, false);
  glowEye(34, true);
  p.line(20, ey - 1, 26, ey + 1, "0").line(35, ey + 1, 41, ey - 1, "0");
  // nose
  p.set(32, hy + 3, "0").set(33, hy + 3, "0").set(32, hy + 4, "1").set(31, hy + 3, "1").set(34, hy + 3, "1");
  if (i === 3) {
    p.put(
      `
.11111111111.
1w1w00000w1w1
10w0000000w01
1000RRRRR0001
.100RrrrR001.
..111111111..
`,
      26,
      hy + 4,
    );
  } else if (i === 2) {
    p.put(
      `
1w1.1w1.1w1
.1w1w1w1w1.
`,
      27,
      hy + 6,
    );
  } else {
    p.put(
      `
1.1.1.1.1.1
.1w1w1w1w1.
`,
      27,
      hy + 6,
    );
  }
  // front arm (right) with claws
  layer(p, (l) => {
    if (i === 2) clawPaw(l, 49, 16 + bob, 1, true);
    else if (i === 3) clawPaw(l, 50, 27 + bob, 1);
    else clawPaw(l, 47, 34 + bob + (i === 1 ? 1 : -1), 1);
  });
  if (i === 3) {
    for (const [x, y] of [[54, 8], [52, 4], [55, 13], [47, 2], [3, 10], [6, 5]] as [number, number][]) p.set(x, y, "w").set(x - 1, y + 1, "W");
  }
  if (i === 2) p.set(27, ey - 3, "R").set(36, ey - 3, "R");
  return p;
}

// ============================================================================ LADY LUNATIC
const LUNA_HAIR: StrandKeys = { base: "g", shade: "G", light: "W", deep: "2" };

function lunatic(i: number): Pix {
  const p = new Pix(48, 64);
  const bob = [0, -2, -1, 0][i];
  const by = bob;
  // crescent moon halo behind
  layer(
    p,
    (l) => {
      l.ellipse(23, 14 + by, 15, 15, "z");
      l.ellipse(29, 9 + by, 13, 13, ".");
      l.each((x, y, k) => (k === "z" && y > 18 + by ? "y" : null));
      l.each((x, y, k) => (k === "z" && x < 12 && y < 16 + by ? "w" : null));
    },
    "Y",
  );
  // long back hair: several wavy locks flowing to the hem
  layer(p, (l) => {
    const sw = [0, 1, 2, 1][i];
    const wv = (y: number, ph: number) => Math.sin(y * 0.22 + ph + i * 0.9) * 1.5;
    l.ellipse(25, 14 + by, 9, 9, "g");
    const lock = (x0: number, dir: number, len: number, w: number, ph: number, shade: number) => {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 5; k++) {
        const y = 12 + by + (len * k) / 5;
        pts.push([x0 + dir * k * 2.2 + wv(y, ph) + (k > 3 ? dir * sw : 0), y]);
      }
      strand(l, pts, w, 2, LUNA_HAIR, { shadeAt: shade });
    };
    lock(19, -1, 42, 7, 0, 0.3);
    lock(22, -0.6, 46, 6, 1.7, 0.1);
    lock(31, 1, 40, 6, 0.8, -0.1);
    lock(28, 0.6, 44, 5, 2.5, 0.0);
  });
  // dress: fitted bodice, long flared starry skirt trailing into wisps
  layer(p, (l) => {
    l.poly([[20, 24 + by], [30, 24 + by], [32, 34 + by], [40, 48 + by], [42, 56 + by], [34, 58 + by], [24, 60 + by], [14, 57 + by], [8, 54 + by], [14, 44 + by], [18, 34 + by]], "n");
    l.each((x, y, k) => (k === "n" && x < 20 - (y - 34 - by) * 0.25 ? "U" : k === "n" && x > 33 + (y - 40 - by) * 0.4 ? "2" : null));
    // hem trim
    l.each((x, y, k) => (k !== "." && !l.solid(x, y + 2) ? "I" : null));
    l.each((x, y, k) => (k !== "." && !l.solid(x, y + 1) ? "i" : null));
    // bodice
    l.rect(21, 25 + by, 9, 8, (x) => (x < 24 ? "U" : x > 27 ? "2" : "n"));
    l.line(25, 25 + by, 25, 32 + by, "I");
  });
  // stars on the skirt
  const stars: [number, number][] = [[16, 46], [24, 50], [31, 44], [20, 55], [35, 52], [27, 40], [12, 52]];
  stars.forEach(([x, y], n) => {
    p.set(x, y + by, n % 2 ? "y" : "w");
    if (n % 3 === 0) p.set(x - 1, y + by, "Y").set(x + 1, y + by, "Y").set(x, y - 1 + by, "Y").set(x, y + 1 + by, "Y");
  });
  // neck + head
  layer(p, (l) => {
    l.rect(24, 20 + by, 4, 5, "k");
    l.poly([[19, 12 + by], [24, 8 + by], [31, 9 + by], [33, 14 + by], [32, 19 + by], [29, 22 + by], [26, 23 + by], [21, 20 + by], [19, 16 + by]], "s");
  });
  // face
  const fx = 22;
  const fy = 13 + by;
  if (i === 3) {
    // laughing: closed ^^ eyes, open "ohoho" mouth
    p.set(fx, fy + 1, "1").set(fx + 1, fy, "1").set(fx + 2, fy + 1, "1");
    p.set(fx + 6, fy + 1, "1").set(fx + 7, fy, "1").set(fx + 8, fy + 1, "1");
    p.put(
      `
111
1R1
.1.
`,
      fx + 4,
      fy + 5,
    );
  } else {
    const eye = `
0000
0yY0
.zy.
`;
    p.put(eye, fx - 1, fy);
    p.put(eye, fx + 5, fy);
    p.set(fx + 6, fy + 1, "w").set(fx, fy + 1, "w");
    // smug smile
    p.set(fx + 4, fy + 6, "1").set(fx + 5, fy + 6, "1").set(fx + 6, fy + 5, "1");
  }
  p.set(fx - 1, fy + 4, "b").set(fx + 8, fy + 4, "b");
  // bangs + side locks
  layer(
    p,
    (l) => {
      strand(l, [[20, 8 + by], [18, 14 + by], [18, 22 + by]], 5, 1, LUNA_HAIR);
      strand(l, [[24, 6 + by], [22, 10 + by], [22, 13 + by]], 6, 1, LUNA_HAIR);
      strand(l, [[28, 6 + by], [28, 10 + by], [27, 13 + by]], 6, 1, LUNA_HAIR);
      strand(l, [[31, 7 + by], [32, 11 + by], [31, 13 + by]], 5, 1, LUNA_HAIR);
      strand(l, [[32, 9 + by], [34, 16 + by], [33, 24 + by]], 4, 1, LUNA_HAIR, { shadeAt: 0 });
      l.ellipse(26, 7 + by, 7, 3, "g");
      l.each((x, y, k) => (k === "g" && y < 6 + by && x < 26 ? "W" : null));
    },
    "G",
  );
  // circlet with a small crescent
  p.line(20, 8 + by, 31, 7 + by, "Y").set(25, 6 + by, "z").set(26, 6 + by, "y").set(25, 5 + by, "z");
  // arms
  if (i === 2) {
    // casting: arms flung out, moon orbs in the palms
    layer(p, (l) => {
      l.line(20, 26 + by, 9, 30 + by, "n");
      l.line(20, 27 + by, 9, 31 + by, "U");
      l.line(31, 26 + by, 41, 29 + by, "n");
      l.line(31, 27 + by, 41, 30 + by, "2");
      l.rect(6, 29 + by, 3, 3, "s");
      l.rect(41, 28 + by, 3, 3, "s");
    });
    for (const [x, y] of [[5, 25], [43, 24]] as [number, number][]) {
      layer(p, (l) => {
        l.ellipse(x, y + by, 3, 3, "z");
        l.set(x - 1, y - 1 + by, "w").set(x, y - 1 + by, "w");
      }, "y");
    }
    p.put(SPARK_B, 0, 15 + by);
    p.put(SPARK, 44, 16 + by);
  } else if (i === 3) {
    // laugh: back of the hand raised to the mouth
    layer(p, (l) => {
      l.poly([[29, 26 + by], [33, 26 + by], [35, 22 + by], [33, 20 + by]], "n");
      l.rect(32, 18 + by, 3, 3, "s");
      l.poly([[20, 26 + by], [18, 34 + by], [21, 35 + by], [22, 27 + by]], "U");
    });
    p.put(SPARK, 38, 10 + by);
  } else {
    // floating serenely, hands folded
    layer(p, (l) => {
      l.poly([[20, 26 + by], [17, 33 + by], [22, 34 + by], [23, 28 + by]], "U");
      l.poly([[30, 26 + by], [33, 33 + by], [28, 34 + by], [27, 28 + by]], "2");
      l.rect(22, 32 + by, 6, 3, "s");
    });
    p.put(SPARK, i === 0 ? 40 : 6, i === 0 ? 30 + by : 36 + by);
  }
  return p;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const sprites: SpriteDef[] = [
  gridSprite("boss_kingpuff", 48, 48, range(4).map(kingPuff), "feet", { fps: 6 }),
  gridSprite("boss_teddy", 56, 56, range(4).map(nightmareTeddy), "feet", { fps: 5 }),
  gridSprite("boss_lunatic", 48, 64, range(4).map(lunatic), "feet", { fps: 5 }),
];
