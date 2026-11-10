/**
 * SUGAR PLUM TYRANT (owner "s2-bosses"), Candy Kingdom FINAL 11:00.
 * boss_sugarplum 48x64x6, feet pivot (24, 63), faces right, floats.
 *   f0-1 float (bob, tutu + leg sway), f2 cast (lollipop scepter raised, glowing),
 *   f3 pirouette (arms in fifth, passe leg, blurred tutu + speed lines),
 *   f4 laugh (back of the hand at the mouth, "ohoho" ^^ eyes),
 *   f5 sugar-crashed (slumped on the floor, asleep, crown askew, drool bubble).
 * A regal ballerina-tyrant: giant pink hair bun at the back, a cupcake crown,
 * plum pancake tutu with sugar sparkle, pink pointe shoes, imperious face.
 * Docs: docs/content/enemies.md §5.2.
 */
import type { SpriteDef } from "../format";
import { Pix, animeEye, ball, capsule, gridSprite, hash2, layer, range, sparkle, strand, type StrandKeys } from "./s2-bosses-util";

type P2 = [number, number];
const HAIR: StrandKeys = { base: "p", shade: "P", light: "q", deep: "Q" };
const BUN_RAMP = ["Q", "P", "p", "p", "q"];

/** Cupcake crown: striped gold wrapper, swirled frosting, cherry. Top-left at (x, y), 11x10. */
function crown(p: Pix, x: number, y: number, tilt = 0): void {
  layer(p, (l) => {
    // wrapper (trapezoid), gold stripes
    l.poly([[x + 1, y + 6 + tilt], [x + 10, y + 6 - tilt], [x + 9, y + 10 - tilt], [x + 2, y + 10 + tilt]], "y");
    l.each((xx, yy, k) => (k === "y" ? ((xx - x) % 2 === 0 ? "Y" : xx - x > 7 ? "Y" : "y") : null));
    // frosting swirl: three stacked blobs
    ball(l, x + 5.5, y + 6, 5.2, 2.2, ["P", "p", "q", "q"]);
    ball(l, x + 5.5, y + 4, 3.8, 1.8, ["P", "p", "q", "w"]);
    ball(l, x + 5.5, y + 2.4, 2.2, 1.3, ["p", "q", "w"]);
  });
  // cherry
  layer(p, (l) => {
    l.ellipse(x + 6, y - 0.5, 1.5, 1.4, "r");
    l.set(x + 5, y - 1, "w").set(x + 7, y, "R");
  });
  p.set(x + 7, y - 3, "E").set(x + 7, y - 2, "E");
  // sprinkles
  p.set(x + 3, y + 5, "c").set(x + 8, y + 4, "y").set(x + 6, y + 6, "l");
}

interface Face {
  kind: "haughty" | "cast" | "laugh" | "sleep" | "spin";
}

function head(p: Pix, cx: number, cy: number, f: Face, bunSide = 1): void {
  // giant bun at the back (screen-left), wrapped spiral
  layer(p, (l) => {
    ball(l, cx - 8, cy - 9, 8.6, 8.2, BUN_RAMP, { spec: "w", specAt: 0.97 });
    // spiral wrap lines
    for (let a = 0; a < Math.PI * 3.2; a += 0.08) {
      const r = 1.4 + a * 0.62;
      const x = cx - 8 + Math.cos(a + 0.6) * r;
      const y = cy - 9 + Math.sin(a + 0.6) * r * 0.95;
      if (r < 7.6 && l.get(Math.round(x), Math.round(y)) !== ".") l.set(x, y, x < cx - 9 && y < cy - 10 ? "p" : "P");
    }
  });
  // back hair mass
  layer(p, (l) => {
    l.ellipse(cx, cy - 1, 9.4, 9.2, "P");
    strand(l, [[cx - 7, cy - 2], [cx - 9, cy + 6], [cx - 8, cy + 11]], 5, 2, HAIR, { shadeAt: 0.1 });
  });
  // face
  layer(p, (l) => {
    l.poly([[cx - 7, cy - 3], [cx - 2, cy - 7], [cx + 6, cy - 6], [cx + 8, cy - 1], [cx + 8, cy + 4], [cx + 5, cy + 8], [cx + 1, cy + 9], [cx - 4, cy + 7], [cx - 7, cy + 3]], "s");
    l.each((x, y, k) => (k === "s" && (x < cx - 5 || y > cy + 6) ? "k" : k === "s" && x > cx + 4 && y < cy ? "t" : null));
  });
  // ---- expression (eyes at y cy, near eye left)
  const ey = cy - 1;
  const iris = { dark: "I", mid: "i", light: "j" };
  if (f.kind === "haughty" || f.kind === "cast") {
    // big glossy eyes, long lashes (outer flicks), sparkle shine
    animeEye(p, cx - 5, ey - 1, 5, 6, { ...iris, pupil: "2" }, { lash: -1 });
    animeEye(p, cx + 3, ey - 1, 4, 6, { ...iris, pupil: "2" }, { lash: 1 });
    p.set(cx - 6, ey - 1, "0").set(cx + 7, ey - 1, "0");
    // arched brows (the far one raised: imperious)
    p.line(cx - 6, ey - 3, cx - 2, ey - 4, "P");
    p.line(cx + 3, ey - 5, cx + 6, ey - 4, "P");
    if (f.kind === "haughty") {
      // smug cat mouth
      p.put(`
1.1.1
.1.1.
`, cx - 1, cy + 4);
    } else
      p.put(`
.11.
1RR1
1rr1
.11.
`, cx, cy + 3);
  } else if (f.kind === "laugh") {
    // ^^ eyes
    p.set(cx - 5, ey + 2, "0").set(cx - 4, ey + 1, "0").set(cx - 3, ey + 1, "0").set(cx - 2, ey + 2, "0").set(cx - 6, ey + 1, "0");
    p.set(cx + 3, ey + 2, "0").set(cx + 4, ey + 1, "0").set(cx + 5, ey + 1, "0").set(cx + 6, ey + 2, "0").set(cx + 7, ey + 1, "0");
    p.line(cx - 5, ey - 2, cx - 2, ey - 3, "P").line(cx + 3, ey - 3, cx + 6, ey - 2, "P");
    p.put(`
111
1R1
.1.
`, cx + 1, cy + 4);
  } else if (f.kind === "spin") {
    // serene closed eyes
    p.line(cx - 4, ey + 2, cx - 1, ey + 2, "0").line(cx + 3, ey + 2, cx + 6, ey + 2, "0");
    p.set(cx - 5, ey + 1, "0").set(cx + 7, ey + 1, "0");
    p.set(cx + 1, cy + 5, "1").set(cx + 2, cy + 5, "1");
  } else {
    // asleep: droopy closed eyes, open snore mouth, drool
    p.line(cx - 4, ey + 3, cx - 1, ey + 2, "0").line(cx + 3, ey + 2, cx + 6, ey + 3, "0");
    p.put(`
.11.
1001
.11.
`, cx, cy + 4);
    p.set(cx + 3, cy + 6, "a").set(cx + 3, cy + 7, "a");
  }
  // blush
  for (const bx of [cx - 5, cx + 5]) p.set(bx, cy + 3, "b").set(bx + 1, cy + 3, "b");
  // bangs: swept, side locks framing the face
  layer(p, (l) => {
    strand(l, [[cx - 6, cy - 8], [cx - 7, cy - 2], [cx - 6, cy + 6]], 5, 2, HAIR, { shadeAt: 0.2 });
    strand(l, [[cx - 3, cy - 9], [cx - 2, cy - 5], [cx - 1, cy - 3]], 6, 2, HAIR);
    strand(l, [[cx + 2, cy - 9], [cx + 3, cy - 5], [cx + 2, cy - 3]], 6, 2, HAIR);
    strand(l, [[cx + 6, cy - 8], [cx + 8, cy - 3], [cx + 8, cy + 5]], 4, 2, HAIR, { shadeAt: -0.1 });
    l.ellipse(cx, cy - 8, 7.5, 3, "p");
    l.each((x, y, k) => (k === "p" && y < cy - 8 && x < cx + 1 ? "q" : null));
  }, "1");
  // shine arc on the bangs
  for (let x = cx - 4; x <= cx + 2; x++) if (p.get(x, cy - 9) === "p" || p.get(x, cy - 9) === "q") p.set(x, cy - 9, x === cx - 1 ? "w" : "q");
  void bunSide;
}

/** Plum pancake tutu centred at (cx, cy). mode: 0/1 sway, "blur" (spinning), "flat" (sat on the floor). */
function tutu(p: Pix, cx: number, cy: number, mode: 0 | 1 | "blur" | "flat"): void {
  const rx = mode === "flat" ? 20 : 18.5;
  const ry = mode === "flat" ? 4.5 : 5.2;
  layer(p, (l) => {
    // under-layer scallops
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI;
      const x = cx + Math.cos(Math.PI - a) * (rx - 1.5);
      const y = cy + 2 + Math.sin(a) * ry * 0.6 + (mode === 1 ? (i & 1 ? 1 : 0) : mode === 0 ? (i & 1 ? 0 : 1) : 0);
      l.ellipse(x, y, 3, 2.4, "2");
    }
    ball(l, cx, cy, rx, ry, ["2", "I", "i", "i", "j"], { ly: -1.2, lx: -0.4 });
    // ruffle ridges
    for (let x = cx - rx + 3; x < cx + rx - 2; x += 4) l.line(x, cy - 1, x + 1, cy + ry - 1, "I");
  });
  // sugar sparkle
  for (let i = 0; i < 9; i++) {
    const x = Math.round(cx - rx + 3 + hash2(i, 3, 11) * (rx * 2 - 6));
    const y = Math.round(cy - 2 + hash2(i, 4, 11) * 5);
    if (p.get(x, y) === "i" || p.get(x, y) === "I" || p.get(x, y) === "j") p.set(x, y, i % 3 === 0 ? "w" : "j");
  }
  if (mode === "blur") {
    // motion smear: lighter streaks + speed lines either side
    for (const [y, x0, x1] of [[cy - 2, cx - 16, cx - 6], [cy + 1, cx - 18, cx - 9], [cy + 3, cx + 5, cx + 15], [cy - 1, cx + 8, cx + 17]] as [number, number, number][])
      for (let x = x0; x <= x1; x++) if (p.get(x, y) !== "." && p.get(x, y) !== "1") p.set(x, y, "j");
    for (const [y, x0, x1] of [[cy - 4, 0, 5], [cy + 3, 1, 4], [cy - 3, 43, 47], [cy + 2, 44, 47]] as [number, number, number][]) p.line(x0, y, x1, y, "w");
  }
}

function legs(p: Pix, hipX: number, hipY: number, kind: "dangle0" | "dangle1" | "passe" | "none"): void {
  if (kind === "none") return;
  const L: [P2, P2, P2] = kind === "dangle0" ? [[hipX - 3, hipY], [hipX - 4, hipY + 8], [hipX - 4, hipY + 15]] : kind === "dangle1" ? [[hipX - 3, hipY], [hipX - 3, hipY + 8], [hipX - 5, hipY + 15]] : [[hipX - 3, hipY], [hipX - 2, hipY + 8], [hipX - 2, hipY + 16]];
  const R: [P2, P2, P2] = kind === "dangle0" ? [[hipX + 3, hipY], [hipX + 5, hipY + 7], [hipX + 6, hipY + 14]] : kind === "dangle1" ? [[hipX + 3, hipY], [hipX + 4, hipY + 8], [hipX + 4, hipY + 15]] : [[hipX + 3, hipY], [hipX + 8, hipY + 5], [hipX + 0, hipY + 8]];
  for (const leg of [L, R]) {
    layer(p, (l) => {
      strand(l, leg, 3.4, 2.6, { base: "t", shade: "q", light: "w" });
      // pointe shoe (pink, satin) on the last 3 px
      const [ex, ey] = leg[2];
      const [bx, by] = leg[1];
      const dx = ex - bx;
      const dy = ey - by;
      const len = Math.hypot(dx, dy) || 1;
      capsule(l, ex - (dx / len) * 2.5, ey - (dy / len) * 2.5, ex, ey, 1.4, "p");
      l.set(ex - (dx / len) * 2, ey - (dy / len) * 2, "q");
    });
    // crossed ribbons
    const [bx, by] = leg[1];
    p.set(bx, by + 2, "p").set(bx + 1, by + 3, "q");
  }
}

interface Pose {
  bob: number;
  head: P2;
  arms: "idle0" | "idle1" | "cast" | "fifth" | "laugh";
  legs: "dangle0" | "dangle1" | "passe";
  tutu: 0 | 1 | "blur";
  face: Face["kind"];
}

const POSES: Pose[] = [
  { bob: 0, head: [25, 23], arms: "idle0", legs: "dangle0", tutu: 0, face: "haughty" },
  { bob: -1, head: [25, 23], arms: "idle1", legs: "dangle1", tutu: 1, face: "haughty" },
  { bob: -1, head: [24, 23], arms: "cast", legs: "dangle1", tutu: 0, face: "cast" },
  { bob: -1, head: [24, 23], arms: "fifth", legs: "passe", tutu: "blur", face: "spin" },
  { bob: 0, head: [25, 23], arms: "laugh", legs: "dangle0", tutu: 1, face: "laugh" },
];

/** Lollipop scepter: gold shaft (a->b), swirl lollipop head at b. */
function scepter(p: Pix, a: P2, b: P2, glow: boolean): void {
  layer(p, (l) => {
    capsule(l, a[0], a[1], b[0], b[1], 0.9, "Y");
    l.line(a[0], a[1], b[0], b[1], "y");
  });
  const [hx, hy] = [b[0], b[1] - 4];
  layer(p, (l) => {
    l.ellipse(hx, hy, 4.6, 4.6, "w");
    // swirl
    for (let t = 0; t < Math.PI * 4; t += 0.05) {
      const r = t * 0.36;
      if (r > 4.4) break;
      for (const w of [0, 0.4]) l.set(hx + Math.cos(t + w) * r, hy + Math.sin(t + w) * r, "p");
    }
    l.each((x, y, k) => (k === "p" && x + y > hx + hy + 3 ? "P" : k === "w" && x + y > hx + hy + 4 ? "q" : null));
  });
  if (glow) {
    sparkle(p, hx - 6, hy - 5, 2);
    sparkle(p, hx + 4, hy - 6, 0);
    sparkle(p, hx + 6, hy + 4, 0);
  } else p.set(hx - 2, hy - 2, "w");
}

function bodice(p: Pix, cx: number, top: number): void {
  layer(p, (l) => {
    l.poly([[cx - 4, top], [cx + 5, top], [cx + 4, top + 9], [cx - 3, top + 9]], "I");
    l.each((x, y, k) => (k === "I" && x <= cx - 2 ? "i" : k === "I" && x >= cx + 3 ? "2" : null));
    // gold neckline + bow
    l.line(cx - 4, top, cx + 5, top, "y");
    l.set(cx, top + 1, "Y").set(cx + 1, top + 1, "y");
    // laced front
    for (let y = top + 3; y < top + 9; y += 2) l.set(cx, y, "j");
  });
}

function arm(p: Pix, pts: P2[], sleeve = true): void {
  layer(p, (l) => {
    strand(l, pts, 3, 2.6, { base: "s", shade: "k", light: "t" });
    if (sleeve) {
      // puffed sleeve at the shoulder
      ball(l, pts[0][0], pts[0][1], 2.6, 2.2, ["2", "I", "i", "j"]);
    }
  });
  const [hx, hy] = pts[pts.length - 1];
  layer(p, (l) => l.ellipse(hx, hy, 1.6, 1.5, "s"));
}

function tyrant(f: number): Pix {
  const p = new Pix(48, 64);
  if (f === 5) return crashed();
  const pose = POSES[f];
  const by = pose.bob;
  const [hx, hy0] = pose.head;
  const hy = hy0 + by;
  const neckY = hy + 9;
  const bodTop = neckY + 1;
  const tutuY = bodTop + 11;
  const hipY = tutuY + 2;
  // arms behind? (back arm drawn early)
  const sx = hx;
  const shL: P2 = [sx - 4, bodTop + 2];
  const shR: P2 = [sx + 5, bodTop + 2];
  // ---- back layers: legs, scepter (when held low), back arm
  legs(p, hx, hipY, pose.legs);
  if (pose.arms === "fifth") {
    // (drawn after the head, see below)
  } else if (pose.arms === "laugh") {
    arm(p, [shL, [sx - 9, bodTop + 6], [sx - 4, bodTop + 9]]);
  } else {
    // hand on hip
    arm(p, [shL, [sx - 9, bodTop + 5], [sx - 5, bodTop + 9]]);
  }
  tutu(p, hx, tutuY, pose.tutu);
  // neck + bodice
  layer(p, (l) => l.rect(hx - 1, neckY - 2, 3, 4, "k"));
  bodice(p, hx, bodTop);
  // ---- head (bun, face, bangs) + crown
  head(p, hx, hy, { kind: pose.face });
  crown(p, hx - 1, hy - 18 + (pose.arms === "fifth" ? 0 : 0), pose.face === "laugh" ? 1 : 0);
  // ---- front arm + scepter
  if (pose.arms === "cast") {
    scepter(p, [40, bodTop + 6], [42, 12 + by], true);
    arm(p, [shR, [sx + 10, bodTop - 3], [41, bodTop - 10]]);
  } else if (pose.arms === "fifth") {
    arm(p, [shL, [sx - 10, bodTop - 6], [sx - 7, hy - 14]]);
    arm(p, [shR, [sx + 10, bodTop - 6], [sx + 9, hy - 14]]);
    // swoosh arcs around the spin
    for (let a = 0.2; a < 1.25; a += 0.04) {
      p.set(hx + Math.cos(Math.PI + a) * 22, tutuY + 3 + Math.sin(a) * 8, a > 0.9 ? "j" : "w");
      p.set(hx + Math.cos(-a * 0.9) * 22, tutuY - 4 - Math.sin(a) * 9, a > 0.9 ? "j" : "w");
    }
    sparkle(p, 4, 18, 1);
    sparkle(p, 44, 50, 1);
  } else if (pose.arms === "laugh") {
    scepter(p, [34, 54 + by], [40, 30 + by], false);
    // back of the hand to the mouth
    arm(p, [shR, [sx + 9, bodTop + 2], [hx + 5, hy + 6]]);
    sparkle(p, 42, 12, 1);
  } else {
    const sway = pose.arms === "idle1" ? 1 : 0;
    scepter(p, [39, 50 + by], [41 + sway, 25 + by], false);
    arm(p, [shR, [sx + 10, bodTop + 5], [40 + sway, bodTop + 5]]);
  }
  if (f === 0) sparkle(p, 6, 30, 1);
  if (f === 1) sparkle(p, 44, 44, 1);
  return p;
}

/** f5: sugar-crashed on the floor, asleep. */
function crashed(): Pix {
  const p = new Pix(48, 64);
  // scepter dropped on the floor
  scepter(p, [3, 61], [16, 58], false);
  // tutu flattened on the ground
  tutu(p, 24, 58, "flat");
  // slippers poking out in front
  layer(p, (l) => {
    capsule(l, 36, 61, 41, 62, 1.5, "p");
    l.set(40, 61, "q");
  });
  // slumped torso leaning forward
  layer(p, (l) => {
    l.poly([[19, 46], [27, 45], [30, 55], [18, 56]], "I");
    l.each((x, y, k) => (k === "I" && x < 22 ? "i" : k === "I" && x > 27 ? "2" : null));
    l.line(19, 46, 27, 45, "y");
  });
  // arms dangling
  layer(p, (l) => {
    strand(l, [[19, 47], [15, 52], [14, 57]], 3, 2.6, { base: "s", shade: "k", light: "t" });
    strand(l, [[28, 47], [32, 52], [34, 56]], 3, 2.6, { base: "s", shade: "k", light: "t" });
  });
  // head drooped forward and down
  head(p, 27, 37, { kind: "sleep" });
  // crown sliding off, askew
  crown(p, 31, 20, 2);
  // drool bubble + zz
  layer(p, (l) => {
    l.ellipse(35, 44, 2.4, 2.4, "a");
    l.set(34, 43, "w");
  }, "C");
  p.put(`
1111
..1.
.1..
1111
`, 40, 26);
  p.put(`
111
.1.
111
`, 44, 21);
  // sugar sparkles fizzling out
  p.set(8, 50, "j").set(42, 52, "j").set(11, 44, "w");
  return p;
}

const frame = (f: number): Pix => tyrant(f);

export const sprites: SpriteDef[] = [gridSprite("boss_sugarplum", 48, 64, range(6).map(frame), "feet", { fps: 5 })];
