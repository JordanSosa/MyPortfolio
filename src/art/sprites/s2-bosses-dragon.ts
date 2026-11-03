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
  const sk: P2 = [27, 25 + dy]; // skull centre
  const sn = P.snout;
  const snY = sk[1] - 3 + sn;
  const jx0 = sk[0] + 5;
  const jy = sk[1] + 5 + sn * 0.5;
  const shut = P.jaw > 8 ? 2 : 0;
  const wv = (t: number, ph: number) => Math.sin(t * 6 + ph + P.whisk * 1.3) * 1.4;
  const arc = (x0: number, y0: number, x1: number, y1: number, bend: number, ph: number) => {
    const pts: P2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push([x0 + (x1 - x0) * t - Math.sin(t * Math.PI) * bend * 0.4, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * bend + wv(t, ph) * t]);
    }
    return pts;
  };
  /** Firework-fuse whisker: a twisted cord (grey with orange flecks), returns its burning tip. */
  const fuse = (pts: P2[]) => {
    layer(p, (l) => {
      for (let i = 0; i + 1 < pts.length; i++) l.line(pts[i][0] + 1, pts[i][1] + 1, pts[i + 1][0] + 1, pts[i + 1][1] + 1, "G");
      for (let i = 0; i + 1 < pts.length; i++) l.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i % 3 === 1 ? "o" : "g");
    });
    const [tx, ty] = pts[pts.length - 1];
    return [Math.round(tx), Math.round(ty)] as P2;
  };
  // ---- mane: paper tassels fluttering behind (left), alternating gold/orange
  layer(p, (l) => {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.86 + i * 0.09);
      const len = 9 + (i % 2) * 3 + P.mane;
      const x0 = sk[0] + Math.cos(a) * 8;
      const y0 = sk[1] + Math.sin(a) * 8 + 1;
      const wob = Math.sin(i * 1.7 + f * 1.3) * 1.5;
      const x1 = x0 + Math.cos(a) * len;
      const y1 = y0 + Math.sin(a) * len * 0.8 + wob;
      capsule(l, x0, y0, x1, y1, 2.1 - (i % 2) * 0.4, i % 2 ? "o" : "y");
      l.set(x1, y1, ".");
    }
    l.each((x, y, k) => (k === "y" && x + y > sk[0] + sk[1] - 6 ? "Y" : k === "o" && x + y > sk[0] + sk[1] - 6 ? "O" : null));
  });
  // ---- lower whisker: a barbel fuse from behind the mouth corner, trailing down and back
  const t2 = fuse(arc(sk[0] + 7, sk[1] + 7, sk[0] - 7 - P.whisk, sk[1] + 17 - P.whisk * 0.5 + (f === 5 ? -3 : 0), -2, 2));
  // ---- horns: gold paper, swept back
  layer(p, (l) => {
    const m = P.mane;
    l.poly([[sk[0] + 1, sk[1] - 8], [sk[0] - 7, sk[1] - 17 - m], [sk[0] - 3, sk[1] - 16 - m], [sk[0] + 5, sk[1] - 9]], "y");
    l.poly([[sk[0] + 7, sk[1] - 8], [sk[0] + 3, sk[1] - 18 - m], [sk[0] + 6, sk[1] - 17 - m], [sk[0] + 10, sk[1] - 8]], "y");
    l.each((x, y, k) => (k === "y" && (x - sk[0]) * 0.6 + (y - sk[1]) * -0.3 > 3 ? "Y" : k === "y" && y < sk[1] - 14 ? "z" : null));
  });
  // ---- lower jaw (opens by P.jaw)
  layer(p, (l) => {
    const open = P.jaw;
    l.poly([[jx0, jy], [jx0 + 22, jy + open * 0.5 + 2], [jx0 + 21, jy + open * 0.5 + 6], [jx0 + 2, jy + 8]], "r");
    paperFill(l, 4, 1);
    if (open > 3) {
      l.poly([[jx0 + 3, jy], [jx0 + 20, jy + open * 0.45 + 1], [jx0 + 19, jy + open * 0.5 + 2], [jx0 + 4, jy + 2]], "0");
      l.poly([[jx0 + 7, jy + 2], [jx0 + 16, jy + open * 0.4 + 1], [jx0 + 11, jy + open * 0.4 + 2]], "P");
    }
    for (let i = 0; i < 3; i++) {
      const tx = jx0 + 8 + i * 4;
      const ty = jy + open * 0.5 * ((tx - jx0) / 22) + 1;
      l.set(tx, ty, "w").set(tx + 1, ty, "W").set(tx, ty - 1, "w");
    }
  });
  // ---- skull (lantern ball) + snout
  layer(p, (l) => {
    l.ellipse(sk[0], sk[1], 12 + P.puff * 1.5, 11 + P.puff, "r");
    rrect(l, sk[0] + 4, snY - 2, sk[0] + 28, snY + 9 - shut, "r", { tl: 0, tr: 4, br: 3, bl: 0 });
    l.ellipse(sk[0] + 28, snY + 1, 4, 3.6, "r");
    if (P.puff) l.ellipse(sk[0] + 11, sk[1] + 4, 5.5, 4, "r");
    paperFill(l, 4, 0);
  });
  // gold trim along the snout ridge and the lip line
  for (let x = sk[0] + 8; x <= sk[0] + 27; x++) {
    if (p.get(x, snY - 1) !== "." && p.get(x, snY - 1) !== "1") p.set(x, snY - 1, x % 3 ? "y" : "z");
    const by = snY + 8 - shut;
    if (p.get(x, by) === "R" || p.get(x, by) === "Q" || p.get(x, by) === "r" || p.get(x, by) === "o") p.set(x, by, "Y");
  }
  // upper teeth (paper zig-zag) when the jaw is open
  if (P.jaw > 1) {
    const by = snY + 10 - shut;
    for (let x = sk[0] + 10; x < sk[0] + 27; x += 4) p.set(x, by, "w").set(x + 1, by, "W").set(x, by + 1, "w");
  }
  // nostril
  p.set(sk[0] + 30, snY, "0").set(sk[0] + 30, snY - 1, "1").set(sk[0] + 31, snY + 1, "1");
  // gold crest on the cheek (lantern mon)
  layer(p, (l) => {
    l.ellipse(sk[0] - 1, sk[1] + 4, 3.4, 3.4, "y");
    l.ellipse(sk[0] - 1, sk[1] + 4, 1.6, 1.6, "r");
    l.set(sk[0] - 1, sk[1] + 4, "z").set(sk[0] - 3, sk[1] + 2, "z");
    l.each((x, y, k) => (k === "y" && x + y > sk[0] + sk[1] + 5 ? "Y" : null));
  }, "R");
  // brow ridge (gold) over the eye
  layer(p, (l) => {
    l.poly([[sk[0] + 3, sk[1] - 8], [sk[0] + 15, sk[1] - 9], [sk[0] + 16, sk[1] - 6], [sk[0] + 5, sk[1] - 6]], "y");
    l.each((x, y, k) => (k === "y" && y >= sk[1] - 7 ? "Y" : null));
  });
  // ---- googly lantern eye: glowing paper ball + loose pupil
  const ex = sk[0] + 10;
  const ey = sk[1] - 4;
  layer(p, (l) => ball(l, ex, ey, 4.6, 4.6, ["y", "z", "z", "w"], { spec: "w" }));
  layer(p, (l) => l.ellipse(ex + P.pupil[0] + 0.5, ey + P.pupil[1] + 0.5, 1.9, 1.9, "0"), null);
  p.set(ex + P.pupil[0], ey + P.pupil[1] - 1, "w");
  // ---- upper whisker: a fuse from the nose curling up, forward, then back over the snout
  // a curl like a question mark, flicking with the frame
  const w = P.whisk;
  const curl: P2[] = [];
  const ctrl: P2[] = [
    [sk[0] + 27, snY - 3],
    [sk[0] + 31 + w * 0.3, snY - 8],
    [sk[0] + 30 + w * 0.5, snY - 13 - w * 0.3],
    [sk[0] + 25, snY - 16 - w * 0.4],
    [sk[0] + 20 - w, snY - 14 - w * 0.6],
  ];
  for (const c of ctrl) c[1] = Math.max(2, c[1]);
  for (let i = 0; i + 1 < ctrl.length; i++)
    for (let t = 0; t < 1; t += 0.25) curl.push([ctrl[i][0] + (ctrl[i + 1][0] - ctrl[i][0]) * t, ctrl[i][1] + (ctrl[i + 1][1] - ctrl[i][1]) * t]);
  curl.push(ctrl[ctrl.length - 1]);
  const t1 = fuse(curl);
  for (const [x, y] of [t1, t2]) {
    sparkle(p, x, y, P.whisk >= 3 ? 2 : 1);
    p.set(x, y, "y");
  }
  // ---- per-frame fx
  const mx = sk[0] + 30;
  const my = jy + 2;
  if (f === 2) {
    // inhale: spark motes streaming INTO the mouth
    for (const [x, y] of [[mx + 9, my - 3], [mx + 7, my + 2], [mx + 10, my + 5], [mx + 4, my + 7]] as P2[]) p.set(x, y, "y").set(x - 1, y, "o");
    p.line(mx + 3, my - 1, mx + 6, my - 2, "z").line(mx + 2, my + 4, mx + 6, my + 5, "z");
  }
  if (f === 3) {
    // breathe: spray of sparks out of the open jaw
    for (const [x, y, s] of [[mx + 6, my + 2, 2], [mx + 10, my + 7, 1], [mx + 3, my + 9, 1], [mx + 9, my - 3, 0], [mx + 11, my + 2, 0]] as [number, number, 0 | 1 | 2][]) {
      sparkle(p, x, y, s);
      p.set(x, y, "y");
    }
    p.line(mx - 2, my + 1, mx + 3, my, "z").line(mx - 2, my + 3, mx + 4, my + 5, "y").line(mx - 3, my + 5, mx + 1, my + 9, "o");
  }
  if (f === 4) {
    // burst: fireworks popping around the head
    const burst = (cx: number, cy: number, r: number, k: string) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        p.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, k);
        p.set(cx + Math.cos(a) * (r - 1.4), cy + Math.sin(a) * (r - 1.4), "w");
      }
      p.set(cx, cy, "w");
    };
    burst(64, 8, 5, "y");
    burst(6, 7, 4, "p");
    burst(65, 40, 4, "c");
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
