/**
 * GINGERBREAD GOLEM (owner "s2-bosses"), Candy Kingdom 6:00 mid boss.
 * boss_gingerbread 56x56x6, feet pivot (28, 55), faces right.
 *   f0-1 stomp (alternate legs), f2 jump crouch (club overhead),
 *   f3 slam (club smashed down, crumbs), f4 half-baked (phase 2: a leg has
 *   crumbled off, gooey middle, crumbs), f5 roar (mouth wide, icing cracks).
 * One flat cookie silhouette (head + torso + limbs unioned) bevel-shaded like a
 * thick baked slab (light from the top-left), white icing piping inset along
 * the contour, an icing-drawn angry face, three gumdrop buttons and a striped
 * candy-cane club. Docs: docs/content/enemies.md §5.1.
 */
import type { SpriteDef } from "../format";
import { Pix, bevel, capsule, gridSprite, hash2, insetDist, layer, range, scatter, sparkle } from "./s2-bosses-util";

/** local ramp extras: mid-shadow brown (leans red-violet), raw dough, deep crumb */
const PAL = { K: "#7f4636", D: "#4a2a2a" };

type P2 = [number, number];
interface Pose {
  bob: number;
  head: P2;
  torso: P2;
  lArm: [P2, P2];
  rArm: [P2, P2];
  lLeg: [P2, P2] | null;
  rLeg: [P2, P2];
  /** candy-cane club: shaft from `a` to `b`, hook at `b` curling toward `hook` (+1 right / -1 left) */
  cane: { a: P2; b: P2; hook: 1 | -1 };
  mouth: "frown" | "grit" | "roar";
  brows: number;
}

const POSES: Pose[] = [
  // f0 stomp: left foot up
  {
    bob: 0,
    head: [29, 14],
    torso: [28, 35],
    lArm: [[18, 29], [9, 35]],
    rArm: [[39, 29], [47, 32]],
    lLeg: [[22, 42], [19, 47]],
    rLeg: [[34, 42], [37, 50]],
    cane: { a: [48, 41], b: [50, 11], hook: -1 },
    mouth: "frown",
    brows: 0,
  },
  // f1 stomp: right foot up
  {
    bob: 1,
    head: [29, 14],
    torso: [28, 35],
    lArm: [[18, 29], [9, 33]],
    rArm: [[39, 29], [47, 34]],
    lLeg: [[22, 42], [19, 50]],
    rLeg: [[34, 42], [37, 47]],
    cane: { a: [48, 43], b: [50, 13], hook: -1 },
    mouth: "frown",
    brows: 0,
  },
  // f2 jump crouch: squat, both arms up holding the club overhead
  {
    bob: 4,
    head: [28, 15],
    torso: [28, 35],
    lArm: [[17, 28], [9, 11]],
    rArm: [[39, 28], [46, 10]],
    lLeg: [[21, 40], [15, 50]],
    rLeg: [[35, 40], [41, 50]],
    cane: { a: [4, 9], b: [47, 7], hook: 1 },
    mouth: "grit",
    brows: 1,
  },
  // f3 slam: low, both arms forward-down, club smashed onto the ground in front
  {
    bob: 6,
    head: [27, 15],
    torso: [27, 35],
    lArm: [[17, 29], [12, 37]],
    rArm: [[37, 29], [45, 39]],
    lLeg: [[21, 41], [15, 50]],
    rLeg: [[34, 41], [39, 50]],
    cane: { a: [41, 34], b: [52, 50], hook: 1 },
    mouth: "roar",
    brows: 1,
  },
  // f4 half-baked: left leg crumbled off, leaning on the right leg
  {
    bob: 1,
    head: [30, 14],
    torso: [29, 35],
    lArm: [[19, 29], [10, 31]],
    rArm: [[40, 29], [47, 34]],
    lLeg: null,
    rLeg: [[34, 42], [35, 50]],
    cane: { a: [48, 43], b: [50, 13], hook: -1 },
    mouth: "grit",
    brows: 1,
  },
  // f5 roar: arms flung up, mouth wide, icing cracks
  {
    bob: -1,
    head: [29, 13],
    torso: [28, 35],
    lArm: [[18, 28], [7, 21]],
    rArm: [[39, 28], [48, 21]],
    lLeg: [[22, 42], [18, 50]],
    rLeg: [[34, 42], [38, 50]],
    cane: { a: [47, 34], b: [51, 9], hook: -1 },
    mouth: "roar",
    brows: 2,
  },
];

const HEAD_R = 10.2;

/** Candy cane: thick striped shaft + hook. */
function cane(l: Pix, a: P2, b: P2, hook: 1 | -1): void {
  // sample the path: shaft a->b, then a half circle hook
  const pts: P2[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // hook: perpendicular side chosen by `hook` (screen-right/left of an upward shaft)
  let px = -uy;
  let py = ux;
  if (px * hook < 0 || (px === 0 && hook < 0)) {
    px = -px;
    py = -py;
  }
  const R = 4;
  const cx = b[0] + px * R;
  const cy = b[1] + py * R;
  const a0 = Math.atan2(b[1] - cy, b[0] - cx);
  for (let i = 1; i <= 24; i++) {
    // sweep 180 degrees through the "forward" (shaft direction) side
    const t = (i / 24) * Math.PI;
    const s = Math.sign(ux * -py + uy * px) || 1;
    const ang = a0 - s * t;
    pts.push([cx + Math.cos(ang) * R, cy + Math.sin(ang) * R]);
  }
  // cumulative length
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const r = 2.1;
  for (let y = 0; y < l.h; y++)
    for (let x = 0; x < l.w; x++) {
      let best = 1e9;
      let bi = 0;
      for (let i = 0; i < pts.length; i++) {
        const d = (x - pts[i][0]) ** 2 + (y - pts[i][1]) ** 2;
        if (d < best) {
          best = d;
          bi = i;
        }
      }
      if (best > r * r) continue;
      // side across the cane: sign of cross product with the local tangent
      const j = Math.min(pts.length - 1, bi + 1);
      const i0 = Math.max(0, bi - 1);
      const tx = pts[j][0] - pts[i0][0];
      const ty = pts[j][1] - pts[i0][1];
      const tl = Math.hypot(tx, ty) || 1;
      const side = ((x - pts[bi][0]) * ty - (y - pts[bi][1]) * tx) / tl;
      const stripe = Math.floor((cum[bi] + side * 0.9) / 2.6) & 1;
      // light from the top-left: the side facing up-left is lit
      const nx = -ty / tl;
      const ny = tx / tl;
      const lit = (nx * side < 0 ? 1 : -1) * 0; // flat stripes, shading below
      void lit;
      const shadeSide = side * (ty > 0 ? 1 : -1) * (tx < 0 ? -1 : 1);
      const dark = (x - pts[bi][0]) + (y - pts[bi][1]) > 0.9;
      const light = (x - pts[bi][0]) + (y - pts[bi][1]) < -1.2;
      void shadeSide;
      void nx;
      void ny;
      l.set(x, y, stripe ? (dark ? "R" : "r") : dark ? "g" : light ? "w" : "W");
    }
  // shine dots on the lit edge
}

function cookie(pose: Pose, f: number): Pix {
  const l = new Pix(56, 56);
  const dy = pose.bob;
  const D = (pt: P2): P2 => [pt[0], pt[1] + dy];
  const [hx, hy] = D(pose.head);
  const [tx, ty] = D(pose.torso);
  // limbs (feet stay planted: legs are not bobbed at the foot end)
  const limb = (seg: [P2, P2], r: number, plantFoot: boolean) => {
    const a = D(seg[0]);
    const b = plantFoot ? seg[1] : D(seg[1]);
    capsule(l, a[0], a[1], b[0], b[1], r, "H");
  };
  if (pose.lLeg) limb(pose.lLeg, 5.6, true);
  limb(pose.rLeg, 5.6, true);
  // feet: slightly flattened bottoms
  limb(pose.lArm, 5, false);
  limb(pose.rArm, 5, false);
  // big fists
  for (const arm of [pose.lArm, pose.rArm]) l.ellipse(arm[1][0], arm[1][1] + dy, 5.6, 5.4, "H");
  l.ellipse(tx, ty, 13.6, 11.4, "H");
  l.ellipse(hx, hy, HEAD_R, HEAD_R - 0.3, "H");
  // flatten feet bottoms at the ground line
  l.each((x, y, k) => (y > 54 ? "." : null));
  return l;
}

function golem(f: number): Pix {
  const pose = POSES[f];
  const p = new Pix(56, 56);
  const dy = pose.bob;
  const [hx, hy] = [pose.head[0], pose.head[1] + dy];
  const [tx, ty] = [pose.torso[0], pose.torso[1] + dy];

  // ---- club behind the cookie (the hand grips over it)
  if (f !== 3) layer(p, (l) => cane(l, pose.cane.a, pose.cane.b, pose.cane.hook));

  // ---- the cookie
  const mask = cookie(pose, f);
  const dist = insetDist(mask, 6);
  // cookie thickness: the slab's side edge peeks out bottom-right
  layer(p, (l) => {
    mask.each((x, y, k) => {
      if (k !== ".") {
        l.set(x + 1, y + 1, "D");
      }
      return null;
    });
    l.put(mask, 0, 0);
    bevel(l, { base: "H", lit: "h", shade: "K", deep: "d" }, { litW: 1, shadeW: 2, only: "H" });
    // baked spice speckles + soft top-left sheen on head and belly
    l.each((x, y, k) => {
      if (k !== "H") return null;
      const nH = Math.hypot(x - (hx - 4), y - (hy - 4));
      const nT = Math.hypot(x - (tx - 5), y - (ty - 4));
      if (nH < 4.2 || nT < 4.6) return "h";
      if (hash2(x, y, 7) < 0.035) return "K";
      return null;
    });
  });
  const icingKey = (x: number, y: number) => (x - hx + (y - hy) > 6 ? "W" : "w");
  // ---- icing piping inset along the whole contour (scalloped every 4 px)
  p.each((x, y, k) => {
    const d = dist[y * 56 + x];
    if (d !== 3 || mask.get(x, y) === ".") return null;
    // keep it off the neck pinch (between head and torso) for a cleaner read
    if (y > hy + HEAD_R - 3 && y < ty - 9) return null;
    // on the head only a crown arc above the face (the face is drawn in icing too)
    if (Math.hypot(x - hx, y - hy) <= HEAD_R + 0.6 && y > hy - 5) return null;
    return icingKey(x, y);
  });
  // wrist + ankle zig-zags (across each limb near its end)
  const zig = (seg: [P2, P2], plant: boolean, at: number, r: number) => {
    const a: P2 = [seg[0][0], seg[0][1] + dy];
    const b: P2 = plant ? seg[1] : [seg[1][0], seg[1][1] + dy];
    const cx = a[0] + (b[0] - a[0]) * at;
    const cy = a[1] + (b[1] - a[1]) * at;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    for (let s = -r; s <= r; s++) {
      const off = (s & 1 ? 1 : 0) - 0.5;
      const x = cx - uy * s + ux * off;
      const y = cy + ux * s + uy * off;
      if (mask.get(Math.round(x), Math.round(y)) !== "." && dist[Math.round(y) * 56 + Math.round(x)] >= 2) p.set(x, y, icingKey(Math.round(x), Math.round(y)));
    }
  };
  void zig;

  // ---- gumdrop buttons (pink, lime, lemon)
  const GUM = `
.11.
1zq1
1qp1
1111
`;
  const gums: [string, string, string][] = [
    ["p", "q", "P"],
    ["l", "m", "e"],
    ["y", "z", "Y"],
  ];
  gums.forEach(([base, light, shade], i) => {
    const g = Pix.of(GUM).recolor({ p: base, q: light, z: "w" });
    g.set(2, 2, shade).set(1, 2, base);
    p.put(g, tx - 1 + (i === 1 ? 1 : 0), ty - 7 + i * 5);
  });
  if (f === 2 || f === 3) {
    // buttons glow (Gumdrop Buttons tell shares the crouch)
  }

  // ---- face (icing-drawn), turned a little to the right
  const fx = hx + 1;
  const fy = hy;
  // eyes: icing sclera, big dark pupil with a shine, an angry brow cutting the lid
  const EYE_L = `
w......
.ww....
..www..
.w000w.
.w0w0w.
.w000w.
..www..
`;
  const SQ_L = `
.......
w......
.ww....
...ww..
.ww....
w......
.......
`;
  const b = pose.brows;
  if (f === 3) {
    p.put(SQ_L, fx - 8, fy - 4);
    p.put(SQ_L, fx + 2, fy - 4, { flip: true });
  } else {
    p.put(EYE_L, fx - 8, fy - 5 - (b > 1 ? 1 : 0));
    p.put(EYE_L, fx + 2, fy - 5 - (b > 1 ? 1 : 0), { flip: true });
    if (b > 0) {
      // furious: brows thicker and steeper
      p.set(fx - 9, fy - 6, "w").set(fx + 8, fy - 6, "w");
    }
    if (f === 5) {
      // shrunken pupils of pure rage
      p.set(fx - 6, fy - 1 - 1, "0").set(fx + 5, fy - 1 - 1, "0");
    }
  }
  // candy cheeks
  p.set(fx - 10, fy + 3, "b").set(fx - 9, fy + 3, "b").set(fx + 8, fy + 3, "b").set(fx + 9, fy + 3, "b");
  // mouth
  if (pose.mouth === "frown") {
    // stern frown with one little fang
    const pts: P2[] = [[fx - 5, fy + 7], [fx - 3, fy + 5], [fx + 3, fy + 5], [fx + 5, fy + 7]];
    for (let i = 0; i + 1 < pts.length; i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "w");
    p.set(fx + 1, fy + 6, "w");
  } else if (pose.mouth === "grit") {
    const M = `
.wwwwwwwww.
w0w0w0w0w0w
w0w0w0w0w0w
.wwwwwwwww.
`;
    p.put(M, fx - 5, fy + 3);
  } else {
    const M = `
.wwwwwwwwww.
w0w0000000ww
w0000000000w
w000RRRR000w
w00RrrrrR00w
.w0RrrrrR0w.
..wwwwwwww..
`;
    p.put(M, fx - 6, fy + 3);
  }
  // roar: icing cracks across the head
  if (f === 5 || f === 4) {
    const cr = f === 5 ? "d" : "K";
    p.line(hx - 7, hy - 8, hx - 4, hy - 5, cr).line(hx - 4, hy - 5, hx - 5, hy - 2, cr);
    p.line(hx + 5, hy - 9, hx + 7, hy - 6, cr).line(hx + 7, hy - 6, hx + 9, hy - 5, cr);
  }

  // ---- foreground: slammed club, crumbs, dust, sparkles
  if (f === 3) {
    layer(p, (l) => cane(l, pose.cane.a, pose.cane.b, pose.cane.hook));
    // impact: crumbs flying + dust puffs
    scatter(p, 30, 40, 26, 10, 14, ["h", "H", "d", "w"], 31, true);
    sparkle(p, 51, 38, 2);
    sparkle(p, 36, 41, 1);
    const puff = (x: number, y: number) =>
      layer(p, (l) => {
        l.ellipse(x, y, 2.2, 1.6, "W");
        l.ellipse(x + 2.5, y + 0.5, 1.6, 1.3, "W");
        l.set(x - 1, y - 1, "w");
      }, "g");
    puff(44, 52);
    puff(8, 53);
    puff(33, 53);
  }
  if (f === 4) {
    // crumbled stump on the left hip: jagged bitten edge, gooey raw-dough middle
    const sx = 22;
    const sy = 42 + dy;
    layer(p, (l) => {
      l.ellipse(sx, sy, 5.6, 3.4, "K");
      // jagged break: bite notches along the bottom
      for (let x = sx - 6; x <= sx + 6; x++) {
        const notch = (x & 1) === 0 ? 1 : 0;
        for (let y = sy + 2 - notch; y <= sy + 4; y++) l.set(x, y, ".");
      }
      // crumbly baked interior + a gooey raw middle
      l.ellipse(sx, sy, 4.2, 2.0, "h");
      l.each((x, y, k) => (k === "h" && hash2(x, y, 3) < 0.3 ? "H" : null));
      l.set(sx, sy, "B").set(sx + 1, sy, "B").set(sx, sy + 1, "F").set(sx - 1, sy, "F");
    }, "1");
    // falling crumbs below the stump
    for (const [x, y, k] of [[19, 48, "H"], [22, 51, "h"], [25, 47, "K"], [17, 53, "H"], [23, 54, "d"], [27, 52, "h"], [14, 50, "h"]] as [number, number, string][]) {
      p.set(x, y, "1").set(x + 1, y, k).set(x, y - 1, "1").set(x + 1, y - 1, "1");
    }
    // gooey drip
    p.set(22, 45 + dy, "B").set(22, 46 + dy, "F").set(21, 46 + dy, "1").set(23, 46 + dy, "1").set(21, 45 + dy, "1").set(23, 45 + dy, "1").set(22, 47 + dy, "1");
  }
  if (f === 5) {
    // roar crumbs shaking off + steam puffs of rage
    for (const [x, y] of [[8, 9], [13, 4], [44, 3], [40, 8]] as P2[]) p.set(x, y, "h").set(x + 1, y, "K");
    sparkle(p, 6, 5, 1);
  }
  if (f === 2) {
    // gumdrop buttons charge up during the crouch
    sparkle(p, tx + 6, ty - 7, 1);
  }
  return p;
}

export const sprites: SpriteDef[] = [gridSprite("boss_gingerbread", 56, 56, range(6).map(golem), "feet", { fps: 5, pal: PAL })];
