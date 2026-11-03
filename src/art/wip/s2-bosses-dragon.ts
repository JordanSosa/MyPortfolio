/**
 * SUMMER FESTIVAL FIREWORK DRAGON (owner "s2-bosses"), Beach Episode FINAL 15:00.
 * boss_firework_dragon 72x48x6 head, feet pivot (36, 47), faces right.
 *   f0-1 slither (bob, mane + whisker flutter), f2 inhale (cheeks puffed,
 *   sparks sucked in), f3 breathe sparks (jaw open, spark spray), f4 burst pose
 *   (head thrown up, mouth wide, fireworks popping), f5 coil (head tucked
 *   down, eyes rolled back, mane flared).
 * boss_firework_body 16x16x2, centre pivot: a round red paper lantern with gold
 * ribs and a sparkler; f1 sway.
 * Paper festival-lantern dragon: red paper `r/R` stretched over darker ribs,
 * gold `y/Y` trim + horns, googly lantern eyes, firework-fuse whiskers that end
 * in lit sparks, a fluttering paper-tassel mane. Docs: enemies.md §5.6.
 */
import type { SpriteDef } from "../format";
import { Pix, ball, capsule, gridSprite, layer, range, rrect, sparkle } from "./s2-bosses-util";

type P2 = [number, number];

interface Pose {
  dy: number;
  /** snout vertical offset relative to the skull (+down) */
  snout: number;
  jaw: number;
  puff: number;
  pupil: P2;
  whisk: number;
  mane: number;
}

const POSES: Pose[] = [
  { dy: 0, snout: 0, jaw: 2, puff: 0, pupil: [1, 1], whisk: 0, mane: 0 },
  { dy: -2, snout: 1, jaw: 2, puff: 0, pupil: [1, 0], whisk: 1, mane: 1 },
  { dy: -1, snout: 0, jaw: 0, puff: 1, pupil: [0, -1], whisk: 2, mane: 2 },
  { dy: 0, snout: 1, jaw: 9, puff: 0, pupil: [1, 1], whisk: 1, mane: 1 },
  { dy: -3, snout: -5, jaw: 11, puff: 0, pupil: [0, -2], whisk: 3, mane: 3 },
  { dy: 4, snout: 4, jaw: 0, puff: 0, pupil: [-2, -1], whisk: 2, mane: 2 },
];

/** Red lantern paper with darker horizontal ribs, lit from the top-left. */
function paperFill(l: Pix, ribEvery: number, ribPhase: number): void {
  l.each((x, y, k) => {
    if (k !== "r") return null;
    const top = !l.solid(x, y - 1) || !l.solid(x, y - 2);
    const bottom = !l.solid(x, y + 1) || !l.solid(x, y + 2);
    const right = !l.solid(x + 1, y) || !l.solid(x + 2, y);
    if ((y + ribPhase) % ribEvery === 0) return bottom ? "Q" : "R";
    if (bottom || right) return "R";
    if (top) return "o";
    return null;
  });
}

function head(f: number): Pix {
  const P = POSES[f];
  const p = new Pix(72, 48);
  const dy = P.dy;
  const sk: P2 = [24, 22 + dy]; // skull centre
  const sn = P.snout;
  // ---- mane: paper tassels fluttering behind (left), alternating gold/orange
  layer(p, (l) => {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.93 + i * 0.085);
      const len = 15 + (i % 2) * 4 + P.mane * 1.5;
      const x0 = sk[0] + Math.cos(a) * 9;
      const y0 = sk[1] + Math.sin(a) * 9 + 2;
      const wob = Math.sin(i * 1.7 + f * 1.3) * 2;
      const x1 = x0 + Math.cos(a) * len;
      const y1 = y0 + Math.sin(a) * len * 0.8 + wob;
      capsule(l, x0, y0, x1, y1, 2.4 - (i % 2) * 0.4, i % 2 ? "o" : "y");
      // notched paper tip
      l.set(x1, y1, ".");
    }
    l.each((x, y, k) => (k === "y" && x + y > sk[0] + sk[1] - 6 ? "Y" : k === "o" && x + y > sk[0] + sk[1] - 6 ? "O" : null));
  });
  // ---- horns: gold paper, swept back
  layer(p, (l) => {
    l.poly([[sk[0] + 2, sk[1] - 10], [sk[0] - 9, sk[1] - 21 - P.mane], [sk[0] - 4, sk[1] - 20 - P.mane], [sk[0] + 7, sk[1] - 11]], "y");
    l.poly([[sk[0] + 9, sk[1] - 10], [sk[0] + 4, sk[1] - 23 - P.mane], [sk[0] + 8, sk[1] - 21 - P.mane], [sk[0] + 13, sk[1] - 10]], "y");
    l.each((x, y, k) => (k === "y" && (x - sk[0]) * 0.6 + (y - sk[1]) * -0.3 > 4 ? "Y" : k === "y" && y < sk[1] - 18 ? "z" : null));
  });
  // ---- lower jaw (opens by P.jaw)
  const jx0 = sk[0] + 7;
  const jy = sk[1] + 6 + sn * 0.5;
  layer(p, (l) => {
    const open = P.jaw;
    l.poly([[jx0, jy], [jx0 + 27, jy + open * 0.55 + 3], [jx0 + 26, jy + open * 0.55 + 8], [jx0 + 3, jy + 10]], "r");
    paperFill(l, 4, 1);
    if (open > 3) {
      // mouth interior + tongue
      l.poly([[jx0 + 4, jy], [jx0 + 25, jy + open * 0.5 + 1], [jx0 + 24, jy + open * 0.55 + 2], [jx0 + 5, jy + 3]], "0");
      l.poly([[jx0 + 9, jy + 2], [jx0 + 20, jy + open * 0.45 + 1], [jx0 + 14, jy + open * 0.45 + 2]], "P");
    }
    // lower teeth
    for (let i = 0; i < 4; i++) {
      const tx = jx0 + 9 + i * 4;
      const ty = jy + open * 0.5 * ((tx - jx0) / 27) + 1;
      l.set(tx, ty, "w").set(tx + 1, ty, "W").set(tx, ty - 1, "w");
    }
  });
  // ---- skull (lantern ball) + snout
  const snY = sk[1] - 4 + sn;
  layer(p, (l) => {
    l.ellipse(sk[0], sk[1], 16 + P.puff * 2, 14 + P.puff, "r");
    // snout block (rounded): short and chunky
    rrect(l, sk[0] + 6, snY - 2, sk[0] + 35, snY + 11 - (P.jaw > 8 ? 2 : 0), "r", { tl: 0, tr: 5, br: 3, bl: 0 });
    // big nose bulb
    l.ellipse(sk[0] + 34, snY + 1, 5, 4.4, "r");
    if (P.puff) l.ellipse(sk[0] + 14, sk[1] + 5, 7, 5, "r");
    paperFill(l, 5, 0);
  });
  // gold trim along the snout ridge and jaw line
  for (let x = sk[0] + 10; x <= sk[0] + 33; x++) {
    if (p.get(x, snY - 1) !== "." && p.get(x, snY - 1) !== "1") p.set(x, snY - 1, x % 3 ? "y" : "z");
    const by = snY + 10 - (P.jaw > 8 ? 2 : 0);
    if (p.get(x, by) === "R" || p.get(x, by) === "Q" || p.get(x, by) === "r") p.set(x, by, "Y");
  }
  // upper teeth (paper zig-zag) when the jaw is open
  if (P.jaw > 1) {
    const by = snY + 11 - (P.jaw > 8 ? 2 : 0);
    for (let x = sk[0] + 13; x < sk[0] + 34; x += 4) p.set(x, by, "w").set(x + 1, by, "W").set(x, by + 1, "w");
  }
  // nostril + gold cheek swirl
  p.set(sk[0] + 36, snY, "0").set(sk[0] + 37, snY, "0").set(sk[0] + 36, snY - 1, "1").set(sk[0] + 37, snY + 1, "1");
  // gold crest ring on the cheek (lantern mon)
  layer(p, (l) => {
    l.ellipse(sk[0] - 1, sk[1] + 5, 4.2, 4.2, "y");
    l.ellipse(sk[0] - 1, sk[1] + 5, 2.2, 2.2, "r");
    l.set(sk[0] - 1, sk[1] + 5, "z").set(sk[0] - 3, sk[1] + 3, "z");
    l.each((x, y, k) => (k === "y" && x + y > sk[0] + sk[1] + 6 ? "Y" : null));
  }, "R");
  // brow ridge (gold) over the eye
  layer(p, (l) => {
    l.poly([[sk[0] + 4, sk[1] - 10], [sk[0] + 18, sk[1] - 11], [sk[0] + 20, sk[1] - 7], [sk[0] + 6, sk[1] - 7]], "y");
    l.each((x, y, k) => (k === "y" && y >= sk[1] - 8 ? "Y" : null));
  });
  // ---- googly lantern eye: glowing paper ball + loose pupil
  const ex = sk[0] + 13;
  const ey = sk[1] - 5;
  layer(p, (l) => {
    ball(l, ex, ey, 5.4, 5.4, ["y", "z", "z", "w"], { spec: "w" });
  });
  layer(p, (l) => l.ellipse(ex + P.pupil[0] * 1.2 + 0.5, ey + P.pupil[1] * 1.2 + 0.5, 2.3, 2.3, "0"), null);
  p.set(ex + P.pupil[0] + 0, ey + P.pupil[1] - 1, "w");
  // eye ring (gold)
  // ---- firework-fuse whiskers from the snout, sparks at the tips
  /** Firework-fuse whisker: a cord streaming BACK from the lip along a wavy arc, burning tip. */
  const fuse = (pts: P2[]) => {
    layer(p, (l) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        l.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "G");
        l.line(pts[i][0], pts[i][1] - 1, pts[i + 1][0], pts[i + 1][1] - 1, i % 3 === 1 ? "o" : "g");
      }
    });
    const [tx, ty] = pts[pts.length - 1];
    return [Math.round(tx), Math.round(ty)] as P2;
  };
  const wv = (t: number, ph: number) => Math.sin(t * 6 + ph + P.whisk * 1.3) * 1.6;
  const arc = (x0: number, y0: number, x1: number, y1: number, bend: number, ph: number) => {
    const pts: P2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * bend + wv(t, ph) * t]);
    }
    return pts;
  };
  // upper whisker arcs up and back over the snout; lower one sweeps back under the jaw
  const t1 = fuse(arc(sk[0] + 33, snY - 2, sk[0] + 20 - P.whisk, snY - 17 - P.whisk, 4, 0));
  const t2 = fuse(arc(sk[0] + 30, snY + 9 + P.jaw * 0.4, sk[0] + 6 - P.whisk, jy + 16, -3, 2));
  for (const [x, y] of [t1, t2]) {
    sparkle(p, x, y, P.whisk >= 3 ? 2 : 1);
    p.set(x, y, "y");
  }
  // ---- per-frame fx
  if (f === 2) {
    // inhale: spark motes streaming INTO the mouth
    for (const [x, y] of [[69, 26], [66, 31], [70, 34], [63, 37]] as P2[]) p.set(x, y, "y").set(x - 1, y, "o");
    p.line(64, 28, 67, 27, "z").line(62, 34, 66, 35, "z");
  }
  if (f === 3) {
    // breathe: spray of sparks out of the open jaw
    for (const [x, y, s] of [[66, 30, 2], [70, 36, 1], [62, 38, 1], [69, 25, 0], [71, 31, 0]] as [number, number, 0 | 1 | 2][]) {
      sparkle(p, x, y, s);
      p.set(x, y, "y");
    }
    p.line(58, 31, 64, 29, "z").line(58, 33, 65, 35, "y").line(57, 35, 62, 39, "o");
  }
  if (f === 4) {
    // burst: fireworks popping around the head
    const burst = (cx: number, cy: number, r: number, k: string) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        p.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, k);
        p.set(cx + Math.cos(a) * (r - 1.4), cy + Math.sin(a) * (r - 1.4), "w");
      }
    };
    burst(62, 8, 5, "y");
    burst(6, 6, 4, "p");
    burst(66, 40, 4, "c");
  }
  if (f === 5) {
    // coil: smoke puffs from the fuses
    for (const [x, y] of [[t1[0] + 2, t1[1] - 3], [t2[0] - 2, t2[1] - 3]] as P2[]) layer(p, (l) => l.ellipse(x, y, 1.6, 1.4, "g"), "G");
  }
  return p;
}

// ---------------------------------------------------------------------------- body segment
function lantern(f: number): Pix {
  const p = new Pix(16, 16);
  const sway = f ? 1 : 0;
  // sparkler stuck in the top, sparks at the tip
  p.line(9 + sway, 3, 12 + sway * 2, 0, "G");
  p.set(12 + sway * 2, 0, "w").set(13 + sway * 2, 0, f ? "y" : "z").set(12 + sway * 2, 1, f ? "z" : "y").set(11 + sway * 2, 0, "y");
  if (f) p.set(14, 1, "y").set(10, 0, "w");
  else p.set(14, 0, "w");
  layer(p, (l) => {
    // gold caps
    l.rect(5, 3, 6, 2, "Y");
    l.rect(5, 13, 6, 2, "Y");
    l.set(5, 3, "y").set(6, 3, "y").set(5, 13, "y");
    // red paper body
    l.ellipse(8, 9, 6.6, 4.8, "r");
    l.each((x, y, k) => {
      if (k !== "r") return null;
      const d = Math.hypot(x - 7, y - 8.5);
      if (y === 7 || y === 10 || y === 12) return x > 10 ? "Q" : "R";
      if (d < 2) return "y";
      if (d < 3.3) return "o";
      if (x > 11 || y > 12) return "R";
      return null;
    });
  });
  p.set(6, 8, "z");
  return p;
}

export const sprites: SpriteDef[] = [
  gridSprite("boss_firework_dragon", 72, 48, range(6).map(head), "feet", { fps: 6 }),
  gridSprite("boss_firework_body", 16, 16, [lantern(0), lantern(1)], "center", { fps: 4 }),
];
