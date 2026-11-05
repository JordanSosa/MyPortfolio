/**
 * TRUCK-KUN, boss form (owner "s2-bosses"), The Final Arc 8:00 mid boss.
 * boss_truck 72x48x6, feet pivot (36, 47), faces right.
 *   f0-1 idle rumble (body shudders on its springs, exhaust stack puffs),
 *   f2 headlights FLASH (Lane Change tell: blazing white eyes + glare rays),
 *   f3 charge (tilted forward, dust kicked up behind, speed lines),
 *   f4 drift (rear swung out, tyre smoke, skid mark),
 *   f5 reverse (white reverse light on, beeping arcs).
 * boss_truck_moustache 12x4: the evil alternate-universe one's curly
 * moustache overlay, drawn by the view under the grille.
 * The hero design gone menacing, in 3/4 view so the FACE reads: grimy white
 * cab-over truck, red racing stripe, headlights as glaring eyes under heavy
 * steel brows, a grille of teeth, dents and rust, a chrome exhaust stack and a
 * "REINCARNATION SERVICES" cargo box. Docs: docs/content/enemies.md §5.7.
 */
import type { SpriteDef } from "../format";
import { Pix, ball, gridSprite, hash2, layer, range, rrect, sparkle } from "./s2-bosses-util";

type P2 = [number, number];

interface Pose {
  /** body shudder (px down) */
  dy: number;
  /** forward tilt: px the front drops (+) / rises (-) relative to the rear */
  tilt: number;
  /** drift: rows above the axles shear left by up to this many px (rear swings out) */
  skew: number;
  eyes: "glare" | "flash" | "squint" | "back";
  fx: "puff0" | "puff1" | "flash" | "dust" | "smoke" | "reverse";
}

const POSES: Pose[] = [
  { dy: 0, tilt: 0, skew: 0, eyes: "glare", fx: "puff0" },
  { dy: 1, tilt: 0, skew: 0, eyes: "glare", fx: "puff1" },
  { dy: 0, tilt: 0, skew: 0, eyes: "flash", fx: "flash" },
  { dy: 0, tilt: 3, skew: 0, eyes: "squint", fx: "dust" },
  { dy: 0, tilt: -2, skew: 5, eyes: "squint", fx: "smoke" },
  { dy: 0, tilt: 0, skew: 0, eyes: "back", fx: "reverse" },
];

/** Narrow 3x4 caps for the livery (N is 3 wide). */
const GLYPH: Record<string, string> = {
  A: ".x.|x.x|xxx|x.x",
  C: ".xx|x..|x..|.xx",
  E: "xxx|xx.|x..|xxx",
  I: "x|x|x|x",
  N: "xx.|x.x|x.x|x.x",
  O: ".x.|x.x|x.x|.x.",
  R: "xx.|x.x|xx.|x.x",
  S: ".xx|xx.|..x|xx.",
  T: "xxx|.x.|.x.|.x.",
  V: "x.x|x.x|x.x|.x.",
  "-": "..|..|xx|..",
};
function word(p: Pix, s: string, x: number, y: number, k: string): number {
  let pen = x;
  for (const ch of s) {
    const rs = GLYPH[ch].split("|");
    rs.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] === "x") p.set(pen + xx, y + yy, k);
    });
    pen += rs[0].length + 1;
  }
  return pen - x - 1;
}

const GROUND = 47;
// layout (rest pose)
const BOX = { x0: 1, x1: 45, y0: 5, y1: 35 };
const CAB = { side0: 45, front0: 53, front1: 70, y0: 7, y1: 39 };

function wheel(p: Pix, cx: number, cy: number, r: number, phase: number): void {
  layer(p, (l) => {
    l.ellipse(cx, cy, r, r, "0");
    // tyre sheen on the lit upper-left
    for (let a = -2.6; a < -1.2; a += 0.08) l.set(cx + Math.cos(a) * (r - 0.6), cy + Math.sin(a) * (r - 0.6), "2");
    // rim + hub
    l.ellipse(cx, cy, r * 0.52, r * 0.52, "G");
    l.ellipse(cx - 0.3, cy - 0.3, r * 0.3, r * 0.3, "g");
    l.set(cx - 1, cy - 1, "W");
    // lug nuts spin with the phase
    for (let i = 0; i < 4; i++) {
      const b = phase + (i * Math.PI) / 2;
      l.set(cx + Math.cos(b) * r * 0.42, cy + Math.sin(b) * r * 0.42, "2");
    }
  });
}

/** Grimy white panel shading: speckle + bottom grime, light from the top-left. */
function grime(l: Pix, x0: number, y0: number, x1: number, y1: number, seed: number): void {
  l.each((x, y, k) => {
    if (k !== "W" || x < x0 || x > x1 || y < y0 || y > y1) return null;
    if (y > y1 - 2) return hash2(x, y, seed) < 0.55 ? "G" : "g";
    if (y > y1 - 5 && hash2(x, y, seed + 1) < 0.35) return "g";
    if (x < x0 + 4 && y < y0 + 10) return "w";
    if (hash2(x, y, seed + 2) < 0.025) return "g";
    return null;
  });
}

function body(f: number): Pix {
  const P = POSES[f];
  const p = new Pix(72, 48);
  const dy = P.dy;
  const by0 = BOX.y0 + dy;
  const by1 = BOX.y1 + dy;
  const cy0 = CAB.y0 + dy;
  const cy1 = CAB.y1 + dy;
  // ---------------- exhaust stack (behind the cab)
  layer(p, (l) => {
    l.rect(44, 1 + dy, 3, cy0 + 6, "g");
    l.line(44, 1 + dy, 44, cy0 + 6, "W");
    l.line(46, 1 + dy, 46, cy0 + 6, "G");
    l.rect(43, 0 + dy, 5, 2, "G");
    l.set(43, 0 + dy, "g");
  });
  // ---------------- cargo box: top strip + side panel
  layer(p, (l) => {
    l.poly([[BOX.x0 + 2, by0 - 3], [BOX.x1 + 1, by0 - 3], [BOX.x1, by0], [BOX.x0, by0]], "w");
    rrect(l, BOX.x0, by0, BOX.x1, by1, "W", { bl: 1 });
    grime(l, BOX.x0, by0, BOX.x1, by1, 5);
    // corner posts + rivet line
    l.line(BOX.x0 + 1, by0 + 1, BOX.x0 + 1, by1 - 1, "g");
    for (let x = BOX.x0 + 4; x < BOX.x1; x += 5) l.set(x, by0 + 1, "g");
    // red racing stripe (6px) with a pink lit edge
    l.rect(BOX.x0, by0 + 19, BOX.x1 - BOX.x0 + 1, 6, "r");
    l.line(BOX.x0, by0 + 19, BOX.x1, by0 + 19, "q");
    l.line(BOX.x0, by0 + 24, BOX.x1, by0 + 24, "R");
    // dents (crumpled spots) + rust streaks from rivets
    for (const [x, y] of [[9, by0 + 5], [34, by0 + 13]] as P2[]) {
      l.set(x, y, "G").set(x + 1, y, "g").set(x, y + 1, "g").set(x + 1, y + 1, "G").set(x - 1, y - 1, "w").set(x + 2, y + 2, "W");
    }
  });
  // livery: winged heart logo + "REINCAR- / NATION" + "SERVICES" on the stripe
  p.put(
    `
GG.....pp.pp.....GG
.GgG..pqppPpp..GgG.
..GgG.pppppPp.GgG..
...GGG.pppPp.GGG...
.........pP........
`,
    BOX.x0 + 12,
    by0 + 2,
  );
  word(p, "REINCAR-", BOX.x0 + 7, by0 + 8, "2");
  word(p, "NATION", BOX.x0 + 9, by0 + 13, "2");
  word(p, "SERVICES", BOX.x0 + 7, by0 + 20, "w");
  // ---------------- cab: side (door) + front face turned toward the viewer
  const s0 = CAB.side0;
  const f0 = CAB.front0;
  const f1 = CAB.front1;
  layer(p, (l) => {
    // cab side
    rrect(l, s0, cy0 + 1, f0, cy1, "W", { tl: 3 });
    grime(l, s0, cy0, f0, cy1, 9);
    // door window (dark glass, glare)
    rrect(l, s0 + 2, cy0 + 4, f0 - 1, cy0 + 12, (x, y) => (x + y < s0 + cy0 + 11 ? "U" : "n"), { tl: 2 });
    l.line(s0 + 3, cy0 + 7, s0 + 5, cy0 + 5, "v");
    // door seam + handle + stripe continuing round the cab
    l.line(s0 + 1, cy0 + 14, s0 + 1, cy1 - 2, "g");
    l.rect(f0 - 4, cy0 + 15, 2, 1, "G");
    l.rect(s0, by0 + 19, f0 - s0 + 1, 6, "r");
    l.line(s0, by0 + 19, f0, by0 + 19, "q");
    l.line(s0, by0 + 24, f0, by0 + 24, "R");
    // front face: turned away from the light, one step darker
    rrect(l, f0, cy0, f1, cy1, (x, y) => (x <= f0 + 1 || y <= cy0 + 1 ? "W" : "g"), { tr: 3, tl: 1 });
    l.each((x, y, k) => (k === "g" && x >= f0 && (x >= f1 - 1 || y >= cy1 - 1) ? "G" : null));
    // windshield: dark tinted glass + glare streaks
    rrect(l, f0 + 2, cy0 + 2, f1 - 2, cy0 + 11, (x, y) => (y < cy0 + 4 ? "U" : "n"), 2);
    l.line(f0 + 4, cy0 + 9, f0 + 9, cy0 + 4, "v");
    l.line(f0 + 5, cy0 + 9, f0 + 10, cy0 + 4, "u");
    l.line(f0 + 11, cy0 + 9, f0 + 13, cy0 + 7, "U");
    // roof marker lights
    for (const x of [f0 + 4, f0 + 8, f0 + 12]) l.set(x, cy0 + 1, "o");
    // bumper
    rrect(l, f0 - 1, cy1 - 4, f1 + 1, cy1, (x, y) => (y === cy1 - 4 ? "W" : x >= f1 - 1 ? "2" : y === cy1 ? "2" : "G"), 1);
    // licence plate
    l.rect(f0 + 6, cy1 - 3, 6, 3, "y");
    l.set(f0 + 7, cy1 - 2, "1").set(f0 + 9, cy1 - 2, "1").set(f0 + 10, cy1 - 2, "1");
  });
  // side mirror on an arm, sticking out at the front corner
  layer(p, (l) => {
    l.line(f0 - 1, cy0 + 6, f0 - 3, cy0 + 4, "G");
    l.rect(f0 - 5, cy0 + 1, 2, 5, "g");
    l.set(f0 - 5, cy0 + 1, "w");
  });
  // ---------------- the FACE
  const ey = cy0 + 17; // eye centre row
  const eL: P2 = [f0 + 3.5, ey];
  const eR: P2 = [f1 - 3.5, ey];
  // grille of teeth (mouth)
  layer(p, (l) => {
    rrect(l, f0 + 5, ey + 1, f1 - 5, ey + 8, "0", 1);
    // zigzag fangs: upper row points down, lower row points up
    for (let x = f0 + 6; x <= f1 - 6; x += 2) {
      l.set(x, ey + 2, "w").set(x + 1, ey + 2, "W").set(x, ey + 3, "W");
      l.set(x + 1, ey + 7, "W").set(x, ey + 7, "g").set(x + 1, ey + 6, "w");
    }
    l.line(f0 + 6, ey + 4, f1 - 6, ey + 4, "R");
    l.line(f0 + 6, ey + 5, f1 - 6, ey + 5, "R");
  });
  // headlight eyes
  for (const [ex, eyy] of [eL, eR]) {
    layer(p, (l) => {
      if (P.eyes === "squint") {
        l.rect(ex - 2.5, eyy, 6, 2, "y");
        l.line(ex - 2, eyy, ex + 2, eyy, "z");
      } else {
        ball(l, ex, eyy, 2.9, 2.9, ["O", "y", "z", "w"], { spec: "w" });
      }
      if (P.eyes === "flash") l.ellipse(ex, eyy, 2.6, 2.6, "w");
    });
    // glaring red slit pupils
    if (P.eyes === "glare") p.set(ex + 0.5, eyy, "r").set(ex + 0.5, eyy + 1, "R").set(ex + 0.5, eyy - 1, "r");
    if (P.eyes === "back") p.set(ex - 1.5, eyy, "r").set(ex - 1.5, eyy + 1, "R");
  }
  // heavy steel brows, slanting down toward the grille (angry)
  layer(p, (l) => {
    l.poly([[f0, ey - 6], [f0 + 7, ey - 2], [f0 + 7, ey], [f0, ey - 4]], "2");
    l.poly([[f1 - 7, ey - 2], [f1, ey - 6], [f1, ey - 4], [f1 - 7, ey]], "2");
    l.line(f0 + 1, ey - 5, f0 + 5, ey - 3, "G");
    l.line(f1 - 5, ey - 3, f1 - 1, ey - 5, "G");
  });
  // a dent + scratch on the face
  p.set(f1 - 3, cy0 + 13, "G").set(f1 - 4, cy0 + 14, "g").line(f0 + 2, cy1 - 7, f0 + 4, cy1 - 8, "G");
  // ---------------- chassis + wheels (wheels never shudder)
  layer(p, (l) => {
    l.rect(BOX.x0 + 3, by1 + 1, s0 - BOX.x0, 3, "2");
    l.line(BOX.x0 + 3, by1 + 1, s0 + 2, by1 + 1, "G");
    l.rect(s0, cy1 + 1, 6, 2, "2");
  });
  const ph = f * 0.8;
  wheel(p, 11, GROUND - 6, 6, ph);
  wheel(p, 25, GROUND - 6, 6, ph + 1);
  wheel(p, 51, GROUND - 6, 6, ph + 2);
  // mudflap behind the rear wheels
  layer(p, (l) => l.rect(33, 37 + dy, 2, 6, "2"));
  return p;
}

/** Shear: columns drop toward the front by `tilt` px; then rows above the axles slide back by up to `skew` px. */
function deform(src: Pix, tilt: number, skew: number): Pix {
  let cur = src;
  if (tilt) {
    const out = new Pix(src.w, src.h);
    for (let x = 0; x < src.w; x++) {
      const oy = Math.round(((x - 10) / 60) * tilt);
      for (let y = 0; y < src.h; y++) {
        const k = cur.get(x, y);
        if (k !== ".") out.set(x, y + oy, k);
      }
    }
    cur = out;
  }
  if (skew) {
    const out = new Pix(src.w, src.h);
    for (let y = 0; y < src.h; y++) {
      const ox = -Math.round(Math.max(0, (38 - y) / 38) * skew);
      for (let x = 0; x < src.w; x++) {
        const k = cur.get(x, y);
        if (k !== ".") out.set(x + ox, y, k);
      }
    }
    cur = out;
  }
  return cur;
}

function truck(f: number): Pix {
  const P = POSES[f];
  let p = deform(body(f), P.tilt, P.skew);
  const fx = new Pix(72, 48);
  const puff = (x: number, y: number, r: number, light: boolean) =>
    layer(fx, (l) => {
      l.ellipse(x, y, r, r * 0.85, light ? "W" : "G");
      l.ellipse(x - r * 0.35, y - r * 0.35, r * 0.45, r * 0.4, light ? "w" : "g");
    }, light ? "g" : "2");
  if (P.fx === "puff0") {
    puff(41, 2, 1.6, false);
  } else if (P.fx === "puff1") {
    puff(39, 2, 2.2, false);
    puff(35, 1, 1.4, false);
  } else if (P.fx === "flash") {
    // blazing glare rays from both headlights
    const ey = CAB.y0 + 17;
    for (const ex of [CAB.front0 + 3.5, CAB.front1 - 3.5]) sparkle(fx, ex, ey, 2);
    sparkle(fx, 66, 3, 3);
    for (const [x0, y0, x1, y1] of [[59, 4, 57, 1], [71, 13, 71, 9], [50, 10, 48, 8]] as [number, number, number, number][]) fx.line(x0, y0, x1, y1, "z");
  } else if (P.fx === "dust") {
    // charge: dust kicked up behind the rear wheels + speed lines
    for (const [x, y, r] of [[3, 41, 3.4], [8, 44, 2.6], [1, 34, 2.2]] as [number, number, number][]) puff(x, y, r, true);
    for (const [y, x0, len] of [[9, 0, 5], [17, 0, 3], [27, 0, 4]] as [number, number, number][]) fx.line(x0, y, x0 + len, y, "w");
  } else if (P.fx === "smoke") {
    // drift: tyre smoke billowing off the rear wheels + a skid mark
    for (const [x, y, r] of [[5, 40, 4], [15, 43, 3.2], [2, 32, 3], [24, 45, 2.4], [44, 45, 2]] as [number, number, number][]) puff(x, y, r, true);
    fx.line(28, 47, 46, 47, "1");
  } else if (P.fx === "reverse") {
    // white reverse light on the rear corner + beeping arcs
    layer(fx, (l) => l.rect(0, 30, 2, 3, "w"), "y");
    for (const [r, k] of [[4, "w"], [7, "z"]] as [number, string][])
      for (let a = -0.7; a <= 0.7; a += 0.12) fx.set(Math.round(2 - Math.cos(a) * r), Math.round(31 + Math.sin(a) * r), k);
  }
  p = p.put(fx, 0, 0, { under: true });
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
