/**
 * Season 2 boss bullets (owner "s2-bosses"). Centre pivot, 2-frame pulse.
 * Same recipe as the base bullets (src/art/sprites/bullets.ts): a dark
 * contrast ring, a saturated body, a pure-white core and a soft alpha glow
 * halo (local `+ * =` palette entries) so each one reads on every stage's
 * ground (pink frosting, pale stone, warm sand, dark storyboard paper).
 */
import type { SpriteDef } from "../format";
import { Pix, bands, glowPal, gridSprite, halo, text } from "./s2-bosses-util";

const d2 = (x: number, y: number, cx: number, cy: number) => Math.hypot(x - cx, y - cy);

// ------------------------------------------------------------------ eb_gumdrop (sugared, hot pink)
const GUMDROP = `
..........
....QQ....
...QqqQ...
..QpqwwQ..
..Qpwqqp..
.QpqqpwpQ.
.QppwppPQ.
.QPppppPQ.
..QQQQQQ..
..........
`;
function gumdrop(f: number): Pix {
  const p = Pix.of(GUMDROP);
  // fix the rim on row 4 + sugar crystals that twinkle on f1
  p.set(2, 4, "Q").set(7, 4, "Q");
  p.set(6, 4, "p").set(5, 4, "q");
  if (f) p.set(3, 6, "w").set(6, 7, "q").set(5, 2, "w").set(3, 3, "w");
  halo(p, f ? ["=", "*"] : ["*", "+"]);
  return p;
}

// ------------------------------------------------------------------ eb_plum (faceted sugar-crystal orb)
function plum(f: number): Pix {
  const p = new Pix(10, 10);
  const R = f ? 4.0 : 3.7;
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++) {
      const r = d2(x, y, 4.5, 4.5);
      if (r > R) continue;
      const lr = d2(x, y, 3.6, 3.6);
      let k = r > R - 0.9 ? "2" : lr < 1.2 ? "w" : lr < 2.0 ? "j" : "i";
      // facets: a diagonal crystal seam and a darker lower-right face
      if (k === "i" && x + y >= 10) k = "I";
      if (k !== "2" && k !== "w" && (x - y === 0 || x - y === 1) && x > 4) k = "j";
      p.set(x, y, k);
    }
  p.set(6, 3, "w");
  halo(p, f ? ["=", "*"] : ["*", "+"]);
  return p;
}

// ------------------------------------------------------------------ eb_stamp (red "NO" stamp mark)
function stamp(f: number): Pix {
  const p = new Pix(12, 12);
  for (let y = 1; y <= 10; y++)
    for (let x = 1; x <= 10; x++) {
      const corner = (x === 1 || x === 10) && (y === 1 || y === 10);
      if (corner) continue;
      const rim = x === 1 || x === 10 || y === 1 || y === 10;
      const inner = x === 2 || x === 9 || y === 2 || y === 9;
      p.set(x, y, rim ? "R" : inner ? "q" : "r");
    }
  text(p, "NO", 3, 4, "w");
  // ink texture: the stamp never inks perfectly
  p.set(8, 8, "R");
  if (f) p.set(2, 2, "w").set(3, 2, "w").set(2, 3, "w");
  halo(p, f ? ["=", "+"] : ["*"], false);
  return p;
}

// ------------------------------------------------------------------ eb_rose (rose head, sparkle core)
const ROSE = `
..........
...RrrR...
..rqqrrR..
.rqRRRqrR.
.rqRwzRrR.
.rpRzRRrR.
.RrpRRrpR.
.eRrppprR.
.eeRRRRR..
..........
`;
function rose(f: number): Pix {
  const p = Pix.of(ROSE);
  p.set(8, 1, "e").set(7, 1, "E");
  if (f) p.set(4, 4, "w").set(5, 4, "w").set(4, 5, "w").set(5, 5, "z").set(3, 4, "z");
  halo(p, f ? ["=", "*"] : ["*", "+"]);
  return p;
}

// ------------------------------------------------------------------ eb_ink (violet ink blob, aqua ring)
function ink(f: number): Pix {
  const p = new Pix(10, 10);
  const wob = (a: number) => 3.1 + 0.45 * Math.sin(a * 3 + f * 1.3) + 0.25 * Math.sin(a * 5 + 1);
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++) {
      const a = Math.atan2(y - 4.5, x - 4.5);
      const r = d2(x, y, 4.5, 4.5);
      if (r > wob(a)) continue;
      const lr = d2(x, y, 3.5, 3.5);
      p.set(x, y, lr < 0.8 ? "w" : lr < 1.8 ? "i" : x + y > 10 ? "2" : "I");
    }
  // drip
  p.set(6, 8, f ? "I" : "2");
  if (f) p.set(6, 9, "2");
  halo(p, f ? ["=", "*"] : ["=", "+"]);
  return p;
}

// ------------------------------------------------------------------ eb_firework (white star spark, tinted by code)
const FW = [
  `
....gg....
....ww....
.g..ww..g.
...wwww...
gwwwwwwwwg
gwwwwwwwwg
...wwww...
.g..ww..g.
....ww....
....gg....
`,
  `
g........g
.w......w.
..w.ww.w..
...wwww...
.wwwwwwww.
.wwwwwwww.
...wwww...
..w.ww.w..
.w......w.
g........g
`,
];
function firework(f: number): Pix {
  const p = Pix.of(FW[f]);
  // soft grey contrast edge (tinted darker by code) so it reads on pale grounds too
  p.outline("G");
  // core
  p.each((x, y, k) => (k === "w" && Math.hypot(x - 4.5, y - 4.5) > 2.6 ? "W" : null));
  // only the 4 ray tips get a faint glow pixel
  for (const [x, y] of f ? [[0, 1], [1, 0], [9, 1], [8, 0], [0, 8], [1, 9], [9, 8], [8, 9]] : [[3, 0], [6, 0], [3, 9], [6, 9], [0, 3], [0, 6], [9, 3], [9, 6]]) if (!p.solid(x, y)) p.set(x, y, "+");
  return p;
}

// ------------------------------------------------------------------ eb_cone (traffic cone, glowing outline)
function cone(f: number): Pix {
  const p = new Pix(10, 10);
  const body = new Pix(10, 10);
  // cone: tip (4.5, 1) -> base half-width 3 at y 7; base plate y 8
  body.poly([[4, 1], [6, 1], [8, 8], [2, 8]], "o");
  body.each((x, y, k) => {
    if (k !== "o") return null;
    if (y === 4 || y === 5) return x >= 6 ? "W" : "w";
    if (x >= 6 && y > 1) return "O";
    if (x <= 3 && y > 5) return "o";
    return "o";
  });
  body.set(4, 2, "z").set(4, 3, "y");
  body.set(3, 6, "y");
  body.rect(1, 8, 8, 1, (x) => (x < 3 ? "g" : x > 6 ? "2" : "G"));
  body.outline("1");
  p.put(body, 0, 0);
  halo(p, f ? ["="] : ["*"], false);
  return p;
}

// ------------------------------------------------------------------ eb_rival (red-orange energy star)
const STAR5 = `
....xx....
....xx....
...xxxx...
xxxxxxxxxx
.xxxxxxxx.
..xxxxxx..
..xxxxxx..
.xxx..xxx.
.xx....xx.
.x......x.
`;
function rivalStar(f: number): Pix {
  const m = Pix.of(STAR5);
  const p = new Pix(10, 10);
  m.each((x, y, k) => {
    if (k !== "x") return null;
    const edge = !m.solid(x - 1, y) || !m.solid(x + 1, y) || !m.solid(x, y - 1) || !m.solid(x, y + 1);
    const r = Math.hypot(x - 4.5, y - 4.8);
    p.set(x, y, r < 1.2 ? "w" : r < 2.0 ? (f ? "w" : "z") : edge ? (x + y > 9 ? "R" : "r") : r < 2.9 ? "y" : "o");
    return null;
  });
  halo(p, f ? ["=", "*"] : ["*", "+"]);
  return p;
}

// ------------------------------------------------------------------ eb_memo (folded memo with a red X)
function memo(f: number): Pix {
  const p = new Pix(12, 12);
  const sheet = new Pix(12, 12);
  sheet.poly([[2, 1], [8, 1], [10, 3], [10, 11], [2, 11]], "w");
  sheet.each((x, y, k) => (k === "w" ? (y > 8 || x > 8 ? "W" : "w") : null));
  // ruled lines
  for (const y of [4, 6, 8]) for (let x = 3; x <= 8; x++) if (sheet.get(x, y) !== ".") sheet.set(x, y, "g");
  // dog-ear fold
  sheet.set(8, 1, "g").set(8, 2, "g").set(9, 2, "g").set(8, 3, "G").set(9, 3, "G");
  // red X
  for (let i = 0; i < 6; i++) {
    sheet.set(3 + i, 4 + i * 0.85, i < 3 ? "r" : "R");
    sheet.set(8 - i, 4 + i * 0.85, i < 3 ? "r" : "R");
  }
  sheet.set(4, 4, "r").set(7, 4, "r");
  sheet.outline("1");
  p.put(sheet, 0, 0);
  // bright outline glow
  halo(p, f ? ["="] : ["*"], false);
  return p;
}

const two = (fn: (f: number) => Pix) => [fn(0), fn(1)];

export const sprites: SpriteDef[] = [
  gridSprite("eb_gumdrop", 10, 10, two(gumdrop), "center", { fps: 8, pal: glowPal("#ff3d9a") }),
  gridSprite("eb_plum", 10, 10, two(plum), "center", { fps: 8, pal: glowPal("#a35cff") }),
  gridSprite("eb_stamp", 12, 12, two(stamp), "center", { fps: 8, pal: glowPal("#ff4d3d", [0x40, 0x90, 0xc0]) }),
  gridSprite("eb_rose", 10, 10, two(rose), "center", { fps: 8, pal: glowPal("#ff4d6d") }),
  gridSprite("eb_ink", 10, 10, two(ink), "center", { fps: 8, pal: glowPal("#4fe6df", [0x40, 0x90, 0xd8]) }),
  gridSprite("eb_firework", 10, 10, two(firework), "center", { fps: 10, pal: glowPal("#ffffff", [0x40, 0x80, 0xb0]) }),
  gridSprite("eb_cone", 10, 10, two(cone), "center", { fps: 8, pal: glowPal("#ffe14d", [0x40, 0x88, 0xc8]) }),
  gridSprite("eb_rival", 10, 10, two(rivalStar), "center", { fps: 10, pal: glowPal("#ff7a2d") }),
  gridSprite("eb_memo", 12, 12, two(memo), "center", { fps: 8, pal: glowPal("#ffe14d", [0x40, 0x88, 0xd0]) }),
];
