/**
 * TRUCK-KUN, boss form (owner "s2-bosses"), The Final Arc 8:00 mid boss.
 * boss_truck 72x48x6, feet pivot (36, 47), faces right.
 *   f0-1 idle rumble (body shudders, exhaust puffs), f2 headlights FLASH (lane
 *   charge tell: blazing eyes + beams), f3 charge (tilted forward, dust, speed
 *   lines), f4 drift (angled, tyre smoke, skid), f5 reverse (white reverse
 *   light on, beeping lines).
 * boss_truck_moustache 12x4: the evil alternate-universe one's curly
 * moustache overlay, drawn by the view under the grille.
 * The hero design gone menacing, in 3/4 view so the FACE reads: grimy white
 * cab-over truck, red racing stripe, headlights as glaring eyes under heavy
 * brows, a grille of teeth, dents, a 'REINCARNATION SERVICES' cargo box.
 * Docs: docs/content/enemies.md §5.7.
 */
import type { SpriteDef } from "../format";
import { Pix, ball, gridSprite, hash2, layer, range, rrect, sparkle, text } from "./s2-bosses-util";

type P2 = [number, number];

interface Pose {
  /** body shudder offset */
  dy: number;
  /** forward tilt: px the front drops (+) / rises (-) relative to the back */
  tilt: number;
  eyes: "glare" | "flash" | "squint";
  fx: "exhaust0" | "exhaust1" | "beams" | "dust" | "smoke" | "reverse";
}

const POSES: Pose[] = [
  { dy: 0, tilt: 0, eyes: "glare", fx: "exhaust0" },
  { dy: 1, tilt: 0, eyes: "glare", fx: "exhaust1" },
  { dy: 0, tilt: 0, eyes: "flash", fx: "beams" },
  { dy: 0, tilt: 3, eyes: "squint", fx: "dust" },
  { dy: 0, tilt: -2, eyes: "squint", fx: "smoke" },
  { dy: 0, tilt: -1, eyes: "glare", fx: "reverse" },
];

const GROUND = 46;

/** 3/4 wheel: tyre ellipse + rim + hub bolts. */
function wheel(p: Pix, cx: number, cy: number, rx: number, ry: number, phase: number): void {
  layer(p, (l) => {
    l.ellipse(cx, cy, rx, ry, "0");
    l.ellipse(cx + 0.5, cy, rx * 0.55, ry * 0.55, "G");
    l.ellipse(cx + 0.2, cy - 0.3, rx * 0.3, ry * 0.3, "g");
    const a = phase * 1.4;
    l.set(cx + Math.cos(a) * rx * 0.42, cy + Math.sin(a) * ry * 0.42, "w");
    l.set(cx + Math.cos(a + 3.1) * rx * 0.42, cy + Math.sin(a + 3.1) * ry * 0.42, "W");
    // tread notches
    for (let i = 0; i < 6; i++) {
      const b = (i / 6) * Math.PI * 2 + phase;
      l.set(cx + Math.cos(b) * (rx - 0.6), cy + Math.sin(b) * (ry - 0.6), "1");
    }
  });
}

/** Shear the whole frame: front (right) drops by `tilt` px over its length. */
function tiltFrame(src: Pix, tilt: number): Pix {
  if (!tilt) return src;
  const out = new Pix(src.w, src.h);
  for (let x = 0; x < src.w; x++) {
    const off = Math.round(((x - 8) / 60) * tilt);
    for (let y = 0; y < src.h; y++) {
      const k = src.get(x, y);
      if (k !== ".") out.set(x, y + off, k);
    }
  }
  return out;
}

function truck(f: number): Pix {
  const P = POSES[f];
  const body = new Pix(72, 48);
  const dy = P.dy;
  // ---------------- cargo box (long side panel + top face), left
  const bx0 = 3;
  const bx1 = 42;
  const by0 = 6 + dy;
  const by1 = 34 + dy;
  layer(body, (l) => {
    // top face (lighter), drawn as a slanted strip
    l.poly([[bx0 + 2, by0 - 3], [bx1 + 4, by0 - 3], [bx1, by0 + 1], [bx0, by0 + 1]], "w");
    // side face
    rrect(l, bx0, by0, bx1, by1, "W", { bl: 1 });
    // grime: smudges near the bottom + random speckle, light from top-left
    l.each((x, y, k) => {
      if (k !== "W") return null;
      if (y > by1 - 4) return hash2(x, y, 5) < 0.45 ? "G" : "g";
      if (y > by1 - 7 && hash2(x, y, 6) < 0.3) return "g";
      if (x < bx0 + 3 && y < by0 + 12) return "w";
      if (hash2(x, y, 9) < 0.03) return "g";
      return null;
    });
    // panel ribs
    for (const x of [bx0 + 13, bx0 + 26]) l.line(x, by0 + 1, x, by1 - 1, "g");
    // red racing stripe
    l.rect(bx0, by1 - 11, bx1 - bx0 + 1, 3, "r");
    l.line(bx0, by1 - 11, bx1, by1 - 11, "q");
    l.line(bx0, by1 - 9, bx1, by1 - 9, "R");
    // dents
    for (const [x, y] of [[bx0 + 7, by0 + 6], [bx0 + 31, by1 - 15]] as P2[]) {
      l.set(x, y, "g").set(x + 1, y, "G").set(x, y + 1, "G").set(x + 1, y + 1, "g").set(x - 1, y, "w");
    }
  });
  // 'REINCARNATION SERVICES' + winged heart logo
  const logoX = bx0 + 6;
  const logoY = by0 + 4;
  layer(body, (l) => {
    // winged heart
    l.put(`
.....pp.pp.....
.....pPPpPp....
gg...pPPPPp..gg
.gWg..pPPp..gWg
..gWg..pp..gWg.
`, logoX + 9, logoY);
  }, null);
  text(body, "REINCARNATION", logoX - 3, logoY + 7, "2", true);
  text(body, "SERVICES", logoX + 5, logoY + 12, "R", true);
  // ---------------- cab: side door + front face (turned toward the viewer)
  const cx0 = 40;
  const cy0 = 4 + dy;
  const fx0 = 51; // front face starts
  const fx1 = 70;
  const cy1 = 38 + dy;
  layer(body, (l) => {
    // cab side
    rrect(l, cx0, cy0 + 2, fx0, cy1, "W", { tl: 2 });
    // door window
    rrect(l, cx0 + 2, cy0 + 5, fx0 - 2, cy0 + 13, (x, y) => (x + y < cx0 + cy0 + 12 ? "v" : "n"), { tl: 2 });
    l.line(cx0 + 3, cy0 + 6, cx0 + 5, cy0 + 6, "w");
    // door seam + handle
    l.line(cx0 + 1, cy0 + 15, cx0 + 1, cy1 - 2, "g");
    l.rect(fx0 - 4, cy0 + 17, 2, 1, "G");
    // stripe continues
    l.rect(cx0, cy1 - 13, fx0 - cx0, 3, "r");
    l.line(cx0, cy1 - 13, fx0, cy1 - 13, "q");
    // front face (slightly darker: faces away from the light)
    rrect(l, fx0, cy0, fx1, cy1, "W", { tr: 3, tl: 1 });
    l.each((x, y, k) => (k === "W" && x >= fx0 && (x > fx1 - 2 || y > cy1 - 5) ? "g" : k === "W" && x >= fx0 && hash2(x, y, 3) < 0.05 ? "g" : null));
    // windshield (dark glass, glare stripe)
    rrect(l, fx0 + 2, cy0 + 2, fx1 - 2, cy0 + 11, (x, y) => (x - y > fx0 - cy0 + 4 && x - y < fx0 - cy0 + 8 ? "x" : "n"), 2);
    l.line(fx0 + 4, cy0 + 9, fx0 + 9, cy0 + 4, "f");
    l.line(fx0 + 5, cy0 + 10, fx0 + 10, cy0 + 5, "U");
    // bumper
    rrect(l, fx0 - 1, cy1 - 3, fx1 + 1, cy1 + 1, (x, y) => (y === cy1 - 3 ? "g" : x > fx1 - 3 ? "2" : "G"), 1);
  });
  // ---------------- the FACE: toothy grille + glaring headlight eyes + heavy brows
  const gy0 = cy0 + 18;
  // grille of teeth
  layer(body, (l) => {
    rrect(l, fx0 + 5, gy0, fx1 - 5, gy0 + 8, "0", 1);
    // upper teeth
    for (let x = fx0 + 6; x <= fx1 - 6; x += 2) {
      l.set(x, gy0 + 1, "w").set(x + 1, gy0 + 1, "W").set(x, gy0 + 2, "w");
    }
    // lower teeth
    for (let x = fx0 + 7; x <= fx1 - 6; x += 2) {
      l.set(x, gy0 + 7, "W").set(x - 1, gy0 + 7, "g").set(x, gy0 + 6, "w");
    }
    l.line(fx0 + 6, gy0 + 4, fx1 - 6, gy0 + 4, "R");
  });
  // headlights (eyes) either side of the grille
  const eyeAt: P2[] = [
    [fx0 + 1, gy0 - 2],
    [fx1 - 5, gy0 - 2],
  ];
  for (const [ex, ey] of eyeAt) {
    layer(body, (l) => {
      if (P.eyes === "squint") {
        l.rect(ex, ey + 2, 5, 3, "y");
        l.line(ex, ey + 2, ex + 4, ey + 2, "z");
      } else {
        ball(l, ex + 2, ey + 3, 2.6, 3, ["Y", "y", "z", "w"], { spec: "w" });
      }
      if (P.eyes === "flash") l.ellipse(ex + 2, ey + 3, 2.4, 2.8, "w");
    });
    // red glaring pupil (not on flash)
    if (P.eyes === "glare") body.set(ex + 2, ey + 3, "r").set(ex + 2, ey + 4, "R");
  }
  // heavy angry brows (bolted steel bars), slanting down to the middle
  layer(body, (l) => {
    l.poly([[fx0, gy0 - 6], [fx0 + 7, gy0 - 3], [fx0 + 7, gy0 - 1], [fx0, gy0 - 4]], "2");
    l.poly([[fx1 - 7, gy0 - 3], [fx1, gy0 - 6], [fx1, gy0 - 4], [fx1 - 7, gy0 - 1]], "2");
    l.set(fx0 + 1, gy0 - 5, "G").set(fx1 - 1, gy0 - 5, "G");
  });
  // dent on the front + scratch
  body.set(fx1 - 3, cy0 + 14, "G").set(fx1 - 4, cy0 + 15, "g").line(fx0 + 2, cy1 - 7, fx0 + 5, cy1 - 8, "G");
  // licence plate
  layer(body, (l) => {
    l.rect(fx0 + 7, cy1 - 2, 6, 3, "y");
  });
  body.set(fx0 + 8, cy1 - 1, "1").set(fx0 + 10, cy1 - 1, "1").set(fx0 + 11, cy1 - 1, "1");
  // ---------------- chassis + wheels
  layer(body, (l) => {
    l.rect(bx0 + 2, by1 + 1, cx0 - bx0, 3, "2");
    l.rect(cx0, cy1 + 1, 10, 2, "2");
  });
  const ph = f * 0.9;
  wheel(body, 12, GROUND - 5 + 0, 5.6, 5.4, ph);
  wheel(body, 27, GROUND - 5 + 0, 5.6, 5.4, ph + 1);
  wheel(body, 46, GROUND - 5 + 0, 5.4, 5.4, ph + 2);
  // mudflap
  body.rect(18, 37 + dy, 2, 5, "1");
  // ---------------- tilt + fx
  let p = tiltFrame(body, P.tilt);
  // re-plant: keep the lowest wheel on the ground line
  const fxp = new Pix(72, 48);
  if (P.fx === "exhaust0" || P.fx === "exhaust1") {
    const o = P.fx === "exhaust1" ? 1 : 0;
    layer(fxp, (l) => {
      l.ellipse(3 - o, 37 - o * 2, 2.2 + o, 2 + o * 0.5, "G");
      l.ellipse(1, 33 - o * 3, 1.4, 1.4, "G");
    }, "2");
  } else if (P.fx === "beams") {
    // headlight beams blazing forward + flash sparkles
    for (const [ex, ey] of eyeAt) sparkle(fxp, ex + 2, ey + 3, 2);
    sparkle(fxp, 64, 8, 3);
    for (const dy2 of [-2, 0, 2]) fxp.line(fx1 - 1, gy0 + 1 + dy2, 71, gy0 - 2 + dy2 * 2, "z");
  } else if (P.fx === "dust") {
    // charge: dust clouds kicked behind + speed lines
    for (const [x, y, r] of [[3, 41, 3.4], [8, 44, 2.6], [1, 35, 2]] as [number, number, number][]) layer(fxp, (l) => l.ellipse(x, y, r, r * 0.8, "g"), "G");
    for (const y of [10, 18, 26]) fxp.line(0, y, 4, y, "w");
  } else if (P.fx === "smoke") {
    // drift: big tyre smoke puffs at the rear + skid mark
    for (const [x, y, r] of [[6, 40, 4], [13, 43, 3.2], [2, 33, 3], [20, 44, 2.4]] as [number, number, number][]) layer(fxp, (l) => {
      l.ellipse(x, y, r, r * 0.85, "W");
      l.ellipse(x - 1, y - 1, r * 0.5, r * 0.4, "w");
    }, "g");
    fxp.line(26, 47, 50, 47, "1");
  } else if (P.fx === "reverse") {
    // white reverse light on the back + beeping arcs
    layer(fxp, (l) => l.rect(1, 28, 2, 3, "w"), "y");
    for (const r of [4, 7]) for (let a = -0.7; a <= 0.7; a += 0.15) fxp.set(1 - Math.cos(a) * r + 1, 29 + Math.sin(a) * r, r === 4 ? "w" : "z");
  }
  p = p.put(fxp, 0, 0, { under: true });
  return p;
}

const MOUSTACHE = `
.11......11.
1001.11.1001
1f00100100f1
.1111..1111.
`;

export const sprites: SpriteDef[] = [
  gridSprite("boss_truck", 72, 48, range(6).map(truck), "feet", { fps: 8 }),
  gridSprite("boss_truck_moustache", 12, 4, [MOUSTACHE], "center", { fps: 1 }),
];
