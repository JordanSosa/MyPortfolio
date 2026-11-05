/**
 * THE BISHOUNEN WHO NEVER NOTICES YOU (owner "s2-bosses"), Shoujo Academy FINAL 13:00.
 * boss_bishounen 48x64x6, feet pivot (24, 63), faces right.
 *   f0-1 hair sway (back turned, 3/4 rear view: only his cheek, ear and
 *   lashes show), f2 hair flip (hand sweeping the hair up into a glittering
 *   arc), f3 looking at his phone (screen glow on his cheek), f4 wind-swept
 *   pose (coat tails + hair streaming, violet lining, petals), f5 FACING the
 *   camera (phase 3 only): star-sparkle eyes, gentle smile, blush, a rose
 *   offered to YOU.
 * Long white school coat with gold epaulettes and trim, navy trousers,
 * flowing silver-lavender hair (violet-shaded so it never merges with the
 * coat), roses and sparkles built into the art. Docs: enemies.md §5.4.
 */
import type { SpriteDef } from "../format";
import { Pix, animeEye, ball, capsule, gridSprite, layer, range, rrect, sparkle, strand, type StrandKeys } from "./s2-bosses-util";

type P2 = [number, number];
const HAIR: StrandKeys = { base: "j", shade: "i", light: "w", deep: "I" };
const COAT: StrandKeys = { base: "W", shade: "g", light: "w", deep: "G" };
const SKIN: StrandKeys = { base: "s", shade: "k", light: "t" };

/** Small red rose (5x5) with a leaf. */
const ROSE = `
.RrR.
RrqrR
rRrRr
.RrR.
..eE.
`;
function rose(p: Pix, x: number, y: number): void {
  p.put(ROSE, x, y, { outline: "1" });
}
function petal(p: Pix, x: number, y: number, k: "r" | "q" = "r"): void {
  layer(p, (l) => l.set(x, y, k).set(x + 1, y, k === "r" ? "R" : "p"), "1");
}

interface Pose {
  bob: number;
  /** hair tips swing left by this much (wind / sway) */
  sway: number;
  /** hair lifted into a flip arc (0..1) */
  flip: number;
  /** coat tails flare to the left */
  flare: number;
  arm: "pocket" | "flip" | "phone" | "wind";
}

const POSES: Pose[] = [
  { bob: 0, sway: 1, flip: 0, flare: 0, arm: "pocket" },
  { bob: 1, sway: 3, flip: 0, flare: 1, arm: "pocket" },
  { bob: 0, sway: 2, flip: 1, flare: 1, arm: "flip" },
  { bob: 0, sway: 1, flip: 0, flare: 0, arm: "phone" },
  { bob: 0, sway: 9, flip: 0, flare: 6, arm: "wind" },
];

const HX = 24;

// ---------------------------------------------------------------------------- shared body parts
function legs(p: Pix, top: number, wide = false): void {
  layer(p, (l) => {
    const d = wide ? 1 : 0;
    capsule(l, 21, top, 20 - d, 59, 2.4, "n");
    capsule(l, 28, top, 29 + d, 59, 2.4, "X");
    l.line(19 - d, top + 1, 19 - d, 58, "U");
    l.line(27, top + 1, 28 + d, 58, "n");
    // white loafers
    rrect(l, 17 - d, 60, 22 - d, 62, (x) => (x < 19 - d ? "w" : "W"), { tr: 1 });
    rrect(l, 27 + d, 60, 32 + d, 62, (x) => (x < 29 + d ? "W" : "g"), { tr: 1 });
  });
}

/** Long white coat seen from behind: gold-trimmed hem, centre seam, vent, half-belt. */
function coatBack(p: Pix, top: number, flare: number): void {
  layer(p, (l) => {
    l.poly(
      [
        [14, top + 1],
        [34, top + 1],
        [35, top + 12],
        [37 - flare * 0.2, top + 27],
        [25, top + 29],
        [11 - flare, top + 28 - flare * 0.7],
        [13, top + 12],
      ],
      "W",
    );
    // light from the top-left: lit left panel, lavender-grey shade down the right, folds
    l.each((x, y, k) => {
      if (k !== "W") return null;
      if (x >= 33 - (y - top) * 0.02) return "G";
      if (x >= 30) return "g";
      if (x <= 15 && y < top + 22) return "w";
      if ((x === 18 || x === 29) && y > top + 17) return "g";
      return null;
    });
    // centre seam + vent showing the violet lining
    l.line(24, top + 15, 24, top + 22, "g");
    l.poly([[24, top + 21], [27, top + 29], [21, top + 29]], "I");
    l.line(24, top + 23, 24, top + 28, "2");
    // flared tail shows its lining on the trailing edge
    if (flare > 2) l.each((x, y, k) => (k !== "." && x < 14 - flare * 0.5 && y > top + 18 ? (x < 11 - flare * 0.5 ? "I" : "i") : null));
    // gold trim on the hem
    l.each((x, y, k) => (k !== "." && !l.solid(x, y + 1) ? "Y" : k !== "." && !l.solid(x, y + 2) ? "y" : null));
    // half-belt with two gold buttons
    l.line(17, top + 16, 31, top + 16, "g");
    l.line(17, top + 17, 31, top + 17, "G");
    l.set(18, top + 16, "y").set(30, top + 16, "y");
  });
}

/** Shoulders + high collar + gold epaulettes (back view). */
function shoulders(p: Pix, top: number): void {
  layer(p, (l) => {
    l.poly([[12, top + 3], [17, top - 1], [31, top - 1], [36, top + 3], [36, top + 7], [12, top + 7]], "W");
    l.each((x, y, k) => (k === "W" && x < 17 ? "w" : k === "W" && x > 32 ? "g" : null));
    // epaulettes with fringe
    for (const [x0, x1, k] of [[11, 16, "y"], [32, 37, "Y"]] as [number, number, string][]) {
      l.rect(x0, top + 1, x1 - x0 + 1, 2, k);
      for (let x = x0; x <= x1; x += 2) l.set(x, top + 3, "Y");
      l.set(x0 + 1, top + 1, "z");
    }
  });
}

/** Sleeve hanging from a shoulder through an elbow to a cuff (gold cuff band). */
function sleeve(p: Pix, pts: P2[], hand: boolean): void {
  layer(p, (l) => {
    strand(l, pts, 4.6, 3.8, COAT, { shadeAt: 0.25 });
    const [cx, cy] = pts[pts.length - 1];
    l.ellipse(cx, cy, 1.9, 1.9, "y");
    l.set(cx - 1, cy - 1, "z");
  });
  if (hand) {
    const [hx, hy] = pts[pts.length - 1];
    const [px, py] = pts[pts.length - 2];
    const L = Math.hypot(hx - px, hy - py) || 1;
    layer(p, (l) => ball(l, hx + ((hx - px) / L) * 2.6, hy + ((hy - py) / L) * 2.6, 1.9, 1.9, ["k", "s", "s", "t"]));
  }
}

function phone(p: Pix, x: number, y: number, lit: boolean): void {
  layer(p, (l) => {
    rrect(l, x, y, x + 3, y + 5, "2", 1);
    if (lit) l.rect(x + 1, y + 1, 2, 4, "a");
    else l.set(x + 1, y + 1, "G").set(x + 2, y + 2, "f");
  });
}

// ---------------------------------------------------------------------------- back view (f0-4)
/** Long flowing hair from behind: a fan of layered locks with pointed shoujo tips. */
function hairBack(p: Pix, hy: number, pose: Pose): void {
  const s = pose.sway;
  const fl = pose.flip;
  // locks left -> right: [root dx, length, width]
  const locks: [number, number, number][] = [
    [-7, 20, 6],
    [-5, 25, 6],
    [-3, 22, 5],
    [-1, 27, 6],
    [2, 23, 6],
    [4, 26, 5],
    [6, 19, 5],
  ];
  layer(p, (l) => {
    // crown: a lit sphere
    ball(l, HX, hy, 8.8, 8.6, ["I", "i", "i", "j", "j", "j", "w"], { lx: -0.5, ly: -0.7 });
    locks.forEach(([rx, len, w], i) => {
      const root: P2 = [HX + rx, hy + 1];
      // rest: splay outward a little; sway: tips trail left; flip: the fan lifts up-left
      const splay = rx * 0.025;
      const lift = fl * (2.2 - i * 0.22);
      const a = Math.PI / 2 + splay + s * 0.03 + lift;
      const tip: P2 = [root[0] + Math.cos(a) * len - s * (len / 30), root[1] + Math.sin(a) * len];
      // curve: the middle bows against the motion so locks arc instead of sticking out straight
      const am = Math.PI / 2 + splay + lift * 0.55;
      const mid: P2 = [root[0] + Math.cos(am) * len * 0.5 - s * 0.2, root[1] + Math.sin(am) * len * 0.5];
      strand(l, [root, mid, tip], w, 1, HAIR, { shadeAt: 0.25, lightAt: -0.5, deepAt: 0.8 });
    });
  });
  // glossy angel-ring sheen across the crown
  for (let a = -2.6; a < -0.6; a += 0.05) {
    const x = Math.round(HX - 0.5 + Math.cos(a) * 6.5);
    const y = Math.round(hy - 0.5 + Math.sin(a) * 5.5);
    const k = p.get(x, y);
    if (k === "j" || k === "i") p.set(x, y, "w");
  }
}

/** The sliver of profile on the right: ear, cheek, a flick of lashes (looking away). */
function profile(p: Pix, hy: number, glow: boolean): void {
  layer(p, (l) => {
    l.poly([[HX + 6, hy - 2], [HX + 9, hy - 1], [HX + 10, hy + 2], [HX + 9, hy + 5], [HX + 7, hy + 8], [HX + 5, hy + 7]], "s");
    l.each((x, y, k) => (k === "s" && x <= HX + 6 ? "k" : null));
    if (glow) l.each((x, y, k) => (k === "s" ? "a" : k === "k" ? "v" : null));
  });
  // lashes flicking out past the cheek line + a glint of violet eye
  p.set(HX + 10, hy, "0").set(HX + 11, hy - 1, "0").set(HX + 12, hy - 2, "1");
  p.set(HX + 9, hy + 1, "I");
  if (!glow) p.set(HX + 8, hy + 5, "b");
  // a lock of hair falling over the ear
  layer(p, (l) => strand(l, [[HX + 4, hy - 7], [HX + 7, hy - 2], [HX + 7, hy + 5]], 4, 1.5, HAIR, { shadeAt: -0.1 }), "1");
}

function backView(f: number): Pix {
  const pose = POSES[f];
  const p = new Pix(48, 64);
  const by = pose.bob;
  const hy = 12 + by;
  const top = 22 + by;
  legs(p, top + 26, f === 4);
  // back arm (screen-left)
  if (pose.arm === "flip") {
    // raised, sweeping the hair up and away
    sleeve(p, [[14, top + 2], [8, top - 3], [12, hy - 5]], true);
  } else if (pose.arm === "wind") {
    sleeve(p, [[14, top + 2], [10, top + 9], [9, top + 16]], true);
  } else {
    sleeve(p, [[14, top + 2], [12, top + 10], [13, top + 17]], false);
  }
  coatBack(p, top, pose.flare);
  shoulders(p, top);
  hairBack(p, hy, pose);
  profile(p, hy, pose.arm === "phone");
  // front arm (screen-right)
  if (pose.arm === "phone") {
    sleeve(p, [[34, top + 2], [38, top + 6], [36, hy + 6]], true);
    phone(p, 34, hy - 1, true);
    // screen glow spilling onto the hair and air
    for (const [gx, gy] of [[39, hy], [39, hy + 3], [38, hy - 3], [32, hy - 2]] as P2[]) if (!p.solid(gx, gy)) p.set(gx, gy, "a");
    p.set(40, hy + 1, "c");
  } else if (pose.arm === "wind") {
    sleeve(p, [[34, top + 2], [39, top + 6], [42, top + 11]], true);
    phone(p, 41, top + 12, false);
  } else {
    sleeve(p, [[34, top + 2], [36, top + 10], [35, top + 17]], true);
    phone(p, 34, top + 18, false);
  }
  // roses + sparkles built in
  if (f === 0) {
    sparkle(p, 41, 5, 2);
    sparkle(p, 5, 28, 1);
    rose(p, 2, 10);
    rose(p, 39, 41);
  } else if (f === 1) {
    sparkle(p, 43, 8, 1);
    sparkle(p, 4, 33, 2);
    rose(p, 1, 8);
    rose(p, 40, 39);
  } else if (f === 2) {
    // hair flip: arc of sparkles + petals
    for (const [x, y] of [[3, 20], [7, 4], [16, 2]] as P2[]) sparkle(p, x, y, 1);
    sparkle(p, 2, 11, 2);
    petal(p, 4, 30);
    petal(p, 9, 37, "q");
    rose(p, 39, 30);
  } else if (f === 3) {
    sparkle(p, 43, 6, 1);
    rose(p, 2, 28);
  } else {
    // wind: petals streaming left
    for (const [x, y] of [[3, 12], [7, 22], [1, 40], [6, 50], [38, 3], [44, 16], [2, 31]] as P2[]) petal(p, x, y, (x + y) % 3 ? "r" : "q");
    sparkle(p, 43, 30, 2);
  }
  return p;
}

// ---------------------------------------------------------------------------- f5: he turns around
function facing(): Pix {
  const p = new Pix(48, 64);
  const hx = 23;
  const hy = 16;
  const top = 27;
  // roses framing him (shoujo panel energy)
  rose(p, 1, 3);
  rose(p, 42, 51);
  rose(p, 2, 47);
  // long hair behind the shoulders
  layer(p, (l) => {
    ball(l, hx, hy - 2, 10.5, 10, ["I", "i", "j", "j", "w"]);
    strand(l, [[hx - 8, hy], [hx - 12, hy + 12], [hx - 13, hy + 25]], 8, 1.5, HAIR, { shadeAt: 0.1 });
    strand(l, [[hx + 8, hy], [hx + 12, hy + 11], [hx + 13, hy + 23]], 7, 1.5, HAIR, { shadeAt: -0.2 });
    strand(l, [[hx - 6, hy + 2], [hx - 9, hy + 15], [hx - 10, hy + 28]], 6, 1.5, HAIR, { shadeAt: 0.3 });
  });
  legs(p, top + 25);
  // open long coat (front): white, gold trim, lavender shirt + gold buttons
  layer(p, (l) => {
    l.poly([[15, top + 1], [32, top + 1], [33, top + 12], [35, top + 27], [24, top + 29], [13, top + 27], [15, top + 12]], "W");
    l.each((x, y, k) => (k === "W" && x < 17 ? "w" : k === "W" && x > 30 ? "g" : null));
    l.each((x, y, k) => (k !== "." && !l.solid(x, y + 1) ? "Y" : null));
    // the open front: shirt
    l.poly([[20, top], [27, top], [26, top + 16], [23, top + 19], [21, top + 16]], "j");
    l.each((x, y, k) => (k === "j" && x >= 25 ? "i" : null));
    for (let y = top + 3; y <= top + 15; y += 4) l.set(23, y, "y");
    // lapels with gold edging
    l.line(19, top, 21, top + 14, "Y").line(28, top, 26, top + 14, "Y");
    // below the waist the coat falls open: violet lining edges, navy trousers between
    l.poly([[23, top + 17], [29, top + 28], [18, top + 28]], "n");
    l.each((x, y, k) => (k === "n" && x > 24 ? "X" : null));
    l.line(23, top + 17, 18, top + 27, "I").line(24, top + 17, 29, top + 27, "i");
    // waist sash
    l.line(16, top + 16, 31, top + 16, "g");
  });
  rose(p, 28, top + 4);
  // shoulders + epaulettes
  layer(p, (l) => {
    l.poly([[12, top + 3], [17, top - 1], [30, top - 1], [35, top + 3], [35, top + 6], [12, top + 6]], "W");
    l.each((x, y, k) => (k === "W" && x < 17 ? "w" : k === "W" && x > 31 ? "g" : null));
    for (const [x0, x1, k] of [[11, 16, "y"], [31, 36, "Y"]] as [number, number, string][]) {
      l.rect(x0, top + 1, x1 - x0 + 1, 2, k);
      for (let x = x0; x <= x1; x += 2) l.set(x, top + 3, "Y");
    }
    // high collar + red cravat
    l.rect(19, top - 3, 9, 3, "W");
    l.line(19, top - 3, 27, top - 3, "y");
    l.set(23, top - 1, "r").set(24, top - 1, "R").set(23, top, "R");
  });
  // back arm: hand on hip
  sleeve(p, [[14, top + 2], [10, top + 9], [15, top + 14]], true);
  // ---- face (big, soft, shoujo)
  layer(p, (l) => {
    l.poly([[hx - 9, hy - 5], [hx - 5, hy - 9], [hx + 5, hy - 9], [hx + 9, hy - 5], [hx + 9, hy + 3], [hx + 6, hy + 8], [hx + 1, hy + 10], [hx - 4, hy + 8], [hx - 8, hy + 3]], "s");
    l.each((x, y, k) => (k === "s" && (x < hx - 7 || y > hy + 7) ? "k" : k === "s" && x > hx + 4 && y < hy - 1 ? "t" : null));
  });
  // HUGE sparkly eyes: violet gradient, lash wings, star shine, lower lash
  const iris = { dark: "I", mid: "i", light: "i", pupil: "2" };
  animeEye(p, hx - 8, hy - 3, 6, 8, iris, { lash: -1, round: "s" });
  animeEye(p, hx + 3, hy - 3, 6, 8, iris, { lash: 1, round: "s" });
  for (const ex of [hx - 5, hx + 6]) {
    // 4-point star shine low in each iris + a lavender reflection
    p.set(ex - 1, hy + 1, "w").set(ex - 2, hy + 2, "w").set(ex, hy + 2, "w").set(ex - 1, hy + 3, "w").set(ex - 1, hy + 2, "z");
    p.set(ex, hy + 4, "j").set(ex + 1, hy + 4, "j").set(ex - 2, hy + 4, "j").set(ex - 1, hy + 4, "j");
  }
  // lower lash ticks
  p.set(hx - 8, hy + 4, "1").set(hx + 8, hy + 4, "1");
  // gentle smile
  p.set(hx - 1, hy + 7, "1").set(hx, hy + 8, "1").set(hx + 1, hy + 8, "1").set(hx + 2, hy + 7, "1");
  // DRAMATIC blush hatching ///
  for (const bx of [hx - 8, hx + 3]) for (let i = 0; i < 3; i++) p.set(bx + i * 2, hy + 7, "b").set(bx + i * 2 + 1, hy + 6, "b");
  // ---- bangs: swept across the brow, never over the eyes; one lock between the eyes
  layer(p, (l) => {
    l.ellipse(hx, hy - 10, 9.5, 3, "j");
    strand(l, [[hx - 7, hy - 11], [hx - 6, hy - 8], [hx - 5, hy - 6]], 5, 1.2, HAIR, { shadeAt: 0.35 });
    strand(l, [[hx - 3, hy - 12], [hx - 1, hy - 8], [hx, hy - 5]], 4, 1, HAIR, { shadeAt: 0.35 });
    strand(l, [[hx + 2, hy - 12], [hx + 5, hy - 9], [hx + 7, hy - 6]], 5, 1.2, HAIR, { shadeAt: 0.35 });
    strand(l, [[hx + 6, hy - 11], [hx + 10, hy - 6], [hx + 11, hy + 3]], 4, 1.2, HAIR, { shadeAt: 0.2 });
    strand(l, [[hx - 8, hy - 9], [hx - 11, hy - 2], [hx - 11, hy + 8]], 4, 1.2, HAIR, { shadeAt: 0.2 });
    // the one dramatic ahoge-swoop up top
    strand(l, [[hx - 1, hy - 12], [hx - 5, hy - 15], [hx - 10, hy - 15]], 4, 1, HAIR);
  });
  for (let x = hx - 6; x <= hx + 4; x++) {
    const y = hy - 11 + (x < hx - 2 ? 1 : 0);
    const k = p.get(x, y);
    if (k === "j" || k === "i") p.set(x, y, "w");
  }
  // ---- front arm offering a rose toward the viewer
  sleeve(p, [[33, top + 2], [38, top + 7], [38, top + 1]], true);
  layer(p, (l) => {
    l.line(39, top - 1, 41, top - 6, "E");
    l.set(40, top - 3, "e").set(41, top - 3, "e");
    ball(l, 42, top - 9, 3.8, 3.4, ["R", "r", "r", "q"]);
    l.set(42, top - 9, "R").set(41, top - 10, "R").set(43, top - 8, "R").set(41, top - 8, "q").set(43, top - 10, "q");
  });
  // sparkles everywhere
  for (const [x, y, s] of [[7, 27, 2], [38, 5, 3], [45, 22, 1], [5, 38, 1], [40, 36, 1], [11, 3, 1], [30, 2, 0], [45, 42, 0]] as [number, number, 0 | 1 | 2 | 3][]) sparkle(p, x, y, s);
  petal(p, 4, 18, "q");
  petal(p, 43, 30);
  return p;
}

export const sprites: SpriteDef[] = [gridSprite("boss_bishounen", 48, 64, range(6).map((f) => (f === 5 ? facing() : backView(f))), "feet", { fps: 4 })];
