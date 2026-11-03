/**
 * THE BISHOUNEN WHO NEVER NOTICES YOU (owner "s2-bosses"), Shoujo Academy FINAL 13:00.
 * boss_bishounen 48x64x6, feet pivot (24, 63), faces right.
 *   f0-1 hair sway (back turned, 3/4 rear view: only his profile's lashes show),
 *   f2 hair flip, f3 looking at his phone (screen glow), f4 wind-swept pose
 *   (coat tails + hair streaming, petals), f5 FACING the camera (phase 3 only):
 *   star-sparkle eyes, gentle smile, blush, a rose offered to the viewer.
 * Long white school coat with gold trim (lavender-shaded so it reads on pale
 * stone), flowing silver-lavender hair, roses and sparkles built into the art.
 * Docs: docs/content/enemies.md §5.4.
 */
import type { SpriteDef } from "../format";
import { Pix, ball, capsule, gridSprite, layer, range, rrect, sparkle, strand, type StrandKeys } from "./s2-bosses-util";

type P2 = [number, number];
const HAIR: StrandKeys = { base: "j", shade: "G", light: "w", deep: "2" };
const COAT: StrandKeys = { base: "W", shade: "g", light: "w", deep: "G" };
const SKIN = { base: "s", shade: "k", light: "t" };

/** Small red rose (5x5) with a leaf. */
const ROSE = `
.RrR.
RrqrR
rRrRr
.RrR.
..eE.
`;
function rose(p: Pix, x: number, y: number, o: { outline?: boolean } = {}): void {
  p.put(ROSE, x, y, o.outline === false ? {} : { outline: "1" });
}
function petal(p: Pix, x: number, y: number, k = "r"): void {
  p.set(x, y, k).set(x + 1, y, k === "r" ? "R" : "P").set(x, y - 1, "1").set(x + 1, y + 1, "1");
}

interface Pose {
  bob: number;
  /** horizontal hair streaming (+ = to the left/back) */
  sway: number;
  coatFlare: number;
  arm: "pocket" | "flip" | "phone" | "wind";
}

const POSES: Pose[] = [
  { bob: 0, sway: 1, coatFlare: 0, arm: "pocket" },
  { bob: 1, sway: 3, coatFlare: 1, arm: "pocket" },
  { bob: 0, sway: 6, coatFlare: 1, arm: "flip" },
  { bob: 0, sway: 1, coatFlare: 0, arm: "phone" },
  { bob: 0, sway: 9, coatFlare: 5, arm: "wind" },
];

const HX = 23;

function legs(p: Pix, top: number): void {
  layer(p, (l) => {
    capsule(l, 20, top, 19, 60, 2.3, "n");
    capsule(l, 27, top, 28, 60, 2.3, "x");
    l.line(18, top + 2, 18, 59, "U");
    // white shoes
    rrect(l, 16, 60, 21, 62, (x) => (x < 18 ? "w" : "W"), 1);
    rrect(l, 26, 60, 31, 62, (x) => (x < 28 ? "W" : "g"), 1);
  });
}

/** Long white coat seen from behind: high collar, centre back seam + slit, gold-trimmed hem. */
function coatBack(p: Pix, top: number, flare: number): void {
  layer(p, (l) => {
    l.poly(
      [
        [16, top],
        [31, top],
        [33, top + 12],
        [36 - flare * 0.2, top + 31],
        [24, top + 33],
        [12 - flare, top + 32 - flare * 0.6],
        [14, top + 12],
      ],
      "W",
    );
    // lighting: lit left side, lavender shadow on the right, folds
    l.each((x, y, k) => {
      if (k !== "W") return null;
      if (x <= 17 && y < top + 20) return "w";
      if (x >= 29 + (y - top) * 0.1) return "g";
      if (x >= 31 + (y - top) * 0.1) return "G";
      if ((x === 20 || x === 28) && y > top + 16) return "g";
      return null;
    });
    // back seam + slit showing the violet lining
    l.line(24, top + 3, 24, top + 23, "g");
    l.poly([[24, top + 23], [26.5, top + 33], [21.5, top + 33]], "I");
    l.line(24, top + 25, 24, top + 32, "2");
    // flared tail shows lining on the trailing edge
    if (flare > 2) l.each((x, y, k) => (k !== "." && x < 15 - flare * 0.4 && y > top + 22 ? "I" : null));
    // gold trim on the hem
    l.each((x, y, k) => (k !== "." && !l.solid(x, y + 1) ? "Y" : k !== "." && !l.solid(x, y + 2) ? "y" : null));
    // belt
    l.line(15, top + 15, 32, top + 15, "g");
    l.set(23, top + 15, "y").set(24, top + 15, "y").set(25, top + 15, "Y");
  });
}

/** Long hair seen from behind: ONE tapered mass flowing back, strand streaks, split tips. */
function hairBack(p: Pix, hy: number, sway: number): void {
  const s = sway;
  const cxAt = (y: number) => HX - 1 - s * Math.max(0, (y - hy) / 26) * 1.1;
  layer(p, (l) => {
    l.ellipse(HX, hy, 9.4, 9.2, "j");
    const pts: P2[] = [
      [HX - 9, hy - 1],
      [HX - 10 - s * 0.3, hy + 10],
      [HX - 11 - s * 0.9, hy + 19],
      [HX - 10 - s * 1.2, hy + 25],
      [HX - 7 - s, hy + 22],
      [HX - 5 - s * 0.9, hy + 27],
      [HX - 2 - s * 0.7, hy + 22],
      [HX + 1 - s * 0.6, hy + 25],
      [HX + 3 - s * 0.4, hy + 19],
      [HX + 7, hy + 10],
      [HX + 9, hy],
    ];
    l.poly(pts, "j");
    // shading across the flow: lit left edge, shadowed right edge, strand streaks
    l.each((x, y, k) => {
      if (k !== "j") return null;
      const c = cxAt(y);
      const u = x - c;
      if (y < hy - 3) {
        // crown: ball shading
        const d = Math.hypot(x - (HX - 3), y - (hy - 5));
        return d < 3.2 ? "w" : x > HX + 5 ? "g" : null;
      }
      if (u > 6) return "G";
      if (u > 3) return "g";
      const streak = Math.round(u + (y - hy) * 0.06);
      if (streak === -3 || streak === 1) return "g";
      if (streak === -6 && y < hy + 14) return "w";
      return null;
    });
    // tips darker
    l.each((x, y, k) => (k !== "." && y > hy + 21 && (k === "j" || k === "w") ? "g" : null));
  });
  // glossy angel-ring sheen across the crown
  for (let a = -2.5; a < -0.7; a += 0.06) {
    const x = Math.round(HX + Math.cos(a) * 7);
    const y = Math.round(hy - 1 + Math.sin(a) * 6);
    const k = p.get(x, y);
    if (k !== "." && k !== "1") p.set(x, y, "w");
  }
}

/** The sliver of profile on the right: cheek, lashes, nose tip (looking away). */
function profile(p: Pix, hy: number, glow: boolean): void {
  layer(p, (l) => {
    l.poly([[HX + 6, hy - 3], [HX + 10, hy - 2], [HX + 11, hy + 1], [HX + 10, hy + 2], [HX + 10, hy + 5], [HX + 7, hy + 8], [HX + 5, hy + 6]], "s");
    l.each((x, y, k) => (k === "s" && x < HX + 8 ? "k" : null));
    if (glow) l.each((x, y, k) => (k === "s" ? "a" : k === "k" ? "s" : null));
  });
  // long lashes flicking out past the cheek + a violet glint of the far eye
  p.set(HX + 9, hy - 1, "0").set(HX + 10, hy - 1, "0").set(HX + 11, hy - 2, "0").set(HX + 12, hy - 3, "1");
  p.set(HX + 9, hy, "i");
  p.set(HX + 7, hy + 4, "b");
  // a lock of hair falling over the ear
  layer(p, (l) => strand(l, [[HX + 5, hy - 7], [HX + 7, hy - 3], [HX + 7, hy + 3]], 4, 2, HAIR, { shadeAt: -0.1 }), "1");
}

function phone(p: Pix, x: number, y: number, lit: boolean): void {
  layer(p, (l) => {
    rrect(l, x, y, x + 3, y + 5, "2", 1);
    if (lit) l.rect(x + 1, y + 1, 2, 4, "a");
    else l.set(x + 1, y + 1, "G");
  });
  if (lit) {
    // screen glow spilling out
    for (const [gx, gy] of [[x + 5, y + 1], [x + 5, y + 4], [x + 4, y - 1], [x + 4, y + 6]] as P2[]) p.set(gx, gy, "a");
    p.set(x + 6, y + 2, "c");
  }
}

function backView(f: number): Pix {
  const pose = POSES[f];
  const p = new Pix(48, 64);
  const by = pose.bob;
  const hy = 13 + by;
  const top = 22 + by;
  // floating roses / sparkles behind
  if (f === 0) rose(p, 3, 12);
  if (f === 1) rose(p, 2, 10);
  legs(p, top + 26);
  // back arm (screen-left) hanging into the coat pocket / flipping hair
  if (pose.arm === "flip") {
    layer(p, (l) => {
      strand(l, [[14, top + 3], [9, top - 2], [14, hy - 4]], 4.4, 3.4, COAT);
      l.ellipse(15, hy - 4, 1.8, 1.6, "s");
    });
  } else {
    layer(p, (l) => strand(l, [[15, top + 3], [12, top + 10], [13, top + 18]], 4, 3.4, COAT));
  }
  coatBack(p, top, pose.coatFlare);
  // shoulders/collar
  layer(p, (l) => {
    l.poly([[13, top + 2], [18, top - 2], [29, top - 2], [34, top + 2], [34, top + 6], [13, top + 6]], "W");
    l.each((x, y, k) => (k === "W" && x < 17 ? "w" : k === "W" && x > 30 ? "g" : null));
    // gold epaulette trim
    l.line(13, top + 2, 17, top - 1, "y").line(30, top - 1, 34, top + 2, "Y");
    l.rect(19, top - 3, 10, 3, "W");
    l.line(19, top - 3, 28, top - 3, "y");
  });
  hairBack(p, hy, pose.sway);
  profile(p, hy, pose.arm === "phone");
  // front arm (screen-right)
  if (pose.arm === "phone") {
    layer(p, (l) => strand(l, [[33, top + 3], [37, top + 3], [35, hy + 6]], 4.4, 3.4, COAT));
    layer(p, (l) => l.ellipse(34, hy + 6, 1.8, 1.8, "s"));
    phone(p, 34, hy + 1, true);
  } else if (pose.arm === "wind") {
    layer(p, (l) => strand(l, [[33, top + 3], [38, top + 7], [41, top + 12]], 4.4, 3.4, COAT));
    phone(p, 40, top + 11, false);
  } else {
    layer(p, (l) => strand(l, [[32, top + 3], [35, top + 10], [34, top + 18]], 4, 3.4, COAT));
    phone(p, 33, top + 17, false);
  }
  // roses + sparkles built in
  if (f === 0) {
    sparkle(p, 40, 6, 2);
    sparkle(p, 6, 30, 1);
    rose(p, 38, 42);
  } else if (f === 1) {
    sparkle(p, 42, 9, 1);
    sparkle(p, 5, 34, 2);
    rose(p, 39, 40);
  } else if (f === 2) {
    // hair flip: arc of sparkles and petals
    for (const [x, y] of [[4, 18], [3, 26], [6, 9]] as P2[]) sparkle(p, x, y, 1);
    sparkle(p, 9, 3, 2);
    petal(p, 2, 33);
    petal(p, 8, 40);
    rose(p, 39, 30);
  } else if (f === 3) {
    sparkle(p, 42, 8, 1);
    rose(p, 2, 30);
  } else {
    // wind: petals streaming
    for (const [x, y] of [[3, 12], [6, 22], [2, 40], [9, 50], [40, 4], [44, 18]] as P2[]) petal(p, x, y, (x + y) % 3 ? "r" : "q");
    sparkle(p, 42, 30, 2);
  }
  return p;
}

/** f5: he finally turns around. Full shoujo: star eyes, gentle smile, a rose for YOU. */
function facing(): Pix {
  const p = new Pix(48, 64);
  const hy = 14;
  const top = 23;
  // big rose + sparkle frame behind
  rose(p, 2, 4);
  rose(p, 41, 47);
  legs(p, top + 26);
  // open coat (front view): white coat, lavender shirt, gold buttons
  layer(p, (l) => {
    l.poly([[14, top], [33, top], [34, top + 12], [36, top + 31], [24, top + 33], [12, top + 31], [14, top + 12]], "W");
    l.each((x, y, k) => (k === "W" && x < 17 ? "w" : k === "W" && x > 30 ? "g" : null));
    l.each((x, y, k) => (k !== "." && !l.solid(x, y + 1) ? "Y" : null));
    // open front: shirt
    l.poly([[21, top], [27, top], [26, top + 16], [24, top + 18], [22, top + 16]], "j");
    l.line(24, top + 2, 24, top + 16, "g");
    l.set(23, top + 4, "y").set(23, top + 8, "y").set(23, top + 12, "y");
    // lapels
    l.line(20, top, 22, top + 14, "g").line(28, top, 26, top + 14, "g");
  });
  // back arm on hip
  layer(p, (l) => strand(l, [[15, top + 2], [11, top + 9], [15, top + 14]], 4, 3, COAT));
  // hair behind
  layer(p, (l) => {
    ball(l, HX, hy - 1, 9.6, 9.4, ["G", "g", "j", "j", "w"]);
    strand(l, [[HX - 8, hy + 2], [HX - 11, hy + 14], [HX - 12, hy + 24]], 6, 2, HAIR, { shadeAt: 0.1 });
    strand(l, [[HX + 8, hy + 2], [HX + 10, hy + 13], [HX + 11, hy + 22]], 5, 2, HAIR, { shadeAt: -0.1 });
    strand(l, [[HX - 7, hy], [HX - 10, hy + 12], [HX - 12, hy + 20]], 6, 2, HAIR, { shadeAt: 0.2 });
    strand(l, [[HX + 7, hy], [HX + 9, hy + 10], [HX + 10, hy + 17]], 5, 2, HAIR, { shadeAt: 0.0 });
  });
  // collar (under the chin)
  layer(p, (l) => {
    l.rect(19, top - 2, 10, 3, "W");
    l.line(19, top - 2, 28, top - 2, "y");
  });
  // face
  layer(p, (l) => {
    l.poly([[HX - 7, hy - 3], [HX - 3, hy - 6], [HX + 5, hy - 6], [HX + 8, hy - 1], [HX + 7, hy + 4], [HX + 4, hy + 8], [HX + 1, hy + 9], [HX - 3, hy + 8], [HX - 7, hy + 3]], "s");
    l.each((x, y, k) => (k === "s" && (x < HX - 5 || y > hy + 6) ? "k" : k === "s" && x > HX + 3 && y < hy - 1 ? "t" : null));
  });
  // star-sparkle shoujo eyes (violet), lashes, highlights shaped like stars
  const EYE = `
.000000
0IIiII0
0IwiiI.
0iwwwi.
0ijwjj.
.jjjj..
`;
  p.put(EYE, HX - 6, hy - 2);
  p.put(EYE, HX + 2, hy - 2, { flip: true });
  // extra lashes
  p.set(HX - 7, hy - 3, "0").set(HX + 9, hy - 3, "0").set(HX - 7, hy - 1, "0").set(HX + 9, hy - 1, "0");
  // gentle smile + blush
  p.set(HX, hy + 6, "1").set(HX + 1, hy + 6, "1").set(HX - 1, hy + 5, "1").set(HX + 2, hy + 5, "1");
  for (const x of [HX - 6, HX - 5, HX + 5, HX + 6]) p.set(x, hy + 4, "b");
  p.set(HX - 5, hy + 3, "b").set(HX + 5, hy + 3, "b");
  // bangs: swept, one long lock across the brow
  layer(p, (l) => {
    strand(l, [[HX - 5, hy - 9], [HX - 2, hy - 5], [HX + 1, hy - 3]], 6, 2, HAIR, { shadeAt: 0.3 });
    strand(l, [[HX + 1, hy - 9], [HX + 4, hy - 6], [HX + 6, hy - 2]], 6, 2, HAIR);
    strand(l, [[HX - 8, hy - 6], [HX - 9, hy + 2], [HX - 8, hy + 9]], 4, 2, HAIR, { shadeAt: 0.2 });
    strand(l, [[HX + 7, hy - 6], [HX + 9, hy + 1], [HX + 9, hy + 8]], 4, 2, HAIR);
    l.ellipse(HX, hy - 8, 8, 3, "j");
  });
  for (let x = HX - 5; x <= HX + 4; x++) if (p.get(x, hy - 9) === "j" || p.get(x, hy - 9) === "g") p.set(x, hy - 9, "w");
  // front arm offering a rose to the viewer
  layer(p, (l) => strand(l, [[31, top + 2], [36, top + 6], [38, top + 3]], 4, 3, COAT));
  layer(p, (l) => l.ellipse(38, top + 3, 1.8, 1.8, "s"));
  // the offered rose (bigger)
  layer(p, (l) => {
    l.line(38, top + 1, 41, top - 6, "E");
    ball(l, 42, top - 9, 3.6, 3.2, ["R", "r", "r", "q"]);
    l.set(42, top - 9, "R").set(41, top - 10, "R").set(43, top - 8, "R").set(41, top - 8, "q");
    l.set(39, top - 3, "e").set(40, top - 2, "e");
  });
  // sparkles everywhere
  for (const [x, y, s] of [[7, 22, 2], [40, 3, 3], [44, 18, 1], [4, 40, 1], [38, 33, 1], [10, 2, 1], [32, 2, 0]] as [number, number, 0 | 1 | 2 | 3][]) sparkle(p, x, y, s);
  return p;
}

export const sprites: SpriteDef[] = [gridSprite("boss_bishounen", 48, 64, range(6).map((f) => (f === 5 ? facing() : backView(f))), "feet", { fps: 4 })];
