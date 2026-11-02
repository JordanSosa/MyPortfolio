/**
 * 16x16 UI icons (owner: world): level-up cards, HUD, chest reel.
 *
 * House style: one bold silhouette per icon, 1px plum outline (auto, so the
 * art keeps a 1px margin), 2-3 tone shading lit from the top-left, one white
 * glint. Evolution icons are more ornate (gold trims, extra motifs) and carry
 * a gold twinkle in a corner so they read as "special" even without the card.
 */
import type { SpriteDef } from "../format";
import { Cv, LIGHT, inHeart, shadedStar, spr } from "./world-util";

const N = 16;
const blank = (): Cv => new Cv(N, N);
const from = (art: string, x = 0, y = 0): Cv => blank().put(art, x, y);

/** Gold twinkle for evolution icons, drawn on top at a corner. */
const TWINKLE = `
..O..
.OzO.
OzwzO
.OzO.
..O..`;
function evo(c: Cv, corner: "tr" | "tl" | "br" | "bl" = "tr"): Cv {
  const x = corner === "tr" || corner === "br" ? 11 : 0;
  const y = corner === "tr" || corner === "tl" ? 0 : 11;
  return c.put(TWINKLE, x, y);
}

/** Small 4-point sparkle (no outline) for accents. */
function sparkle(c: Cv, x: number, y: number, core = "w", arm = "z"): Cv {
  return c.set(x, y, core).set(x - 1, y, arm).set(x + 1, y, arm).set(x, y - 1, arm).set(x, y + 1, arm);
}

const shade = (dx: number, dy: number) => dx * LIGHT[0] + dy * LIGHT[1]; // + = lit

// =========================================================================== weapons

const STAR13 = `
......z......
.....zzy.....
.....zyy.....
....zzyyY....
zzzzzwwyyyyyY
.yzzzwyyyyyY.
..yzzzyyyyY..
...yzyyyyY...
...yzyyyyY...
..yzyyyyyyY..
..yzyY.yyyY..
.yyY.....yYY.
.yY.......YY.`;

function starShot(): Cv {
  const c = from(STAR13, 1, 2);
  c.put(
    `
.z.
zwz
.z.`,
    12,
    0,
  );
  return c.outline("1");
}

function petalSlash(): Cv {
  const c = blank();
  // asymmetric swoosh: thin tail at the bottom, fat head at the top-right ending in a point
  const cx = 2.0;
  const cy = 8.0;
  const ax = 12.2;
  const ay = 7.3;
  const pm = (80 * Math.PI) / 180;
  c.each((x, y) => {
    const u = (x - cx) / ax;
    const v = (y - cy) / ay;
    const rho = Math.hypot(u, v);
    const phi = Math.atan2(v, u);
    if (Math.abs(phi) > pm) return null;
    const k = (pm - phi) / (2 * pm); // 0 = bottom tail, 1 = top head
    const t = k < 0.8 ? 0.5 * Math.pow(k / 0.8, 1.4) : 0.5 * Math.pow(Math.max(0, 1 - (k - 0.8) / 0.2), 0.6);
    const s2 = (1 - rho) / Math.max(0.001, t);
    if (s2 < 0 || s2 > 1 || t < 0.05) return null;
    if (s2 < 0.35) return "w";
    if (s2 < 0.7) return "q";
    return "p";
  });
  const PET = `
.qq.q
qwqqq
qqqpP
.qpP.
..P..`;
  c.put(PET, 2, 4);
  c.put(
    `
qq.
qwp
.pP`,
    5,
    11,
  );
  c.outline("1");
  sparkle(c, 1, 1, "w", "q");
  return c;
}

function yarnBall(c: Cv, cx: number, cy: number, r: number): void {
  // wound strands: ")"-shaped arcs, with a crossing band over the upper-left
  c.disc(cx, cy, r, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const l = shade(dx, dy) / r;
    const inBand = dx + dy < -r * 0.25 && dx + dy > -r * 1.25;
    const u = inBand ? dy + 0.1 * dx * dx : dx - 0.1 * dy * dy;
    const period = r > 3 ? 2.6 : 2;
    const line = Math.abs((((u + 40) % period) + period) % period - period / 2) < 0.5;
    if (line) return l > 0.35 ? "P" : "Q";
    return l > 0.3 ? "q" : l > -0.45 ? "p" : "P";
  });
}

function yarnOrbit(): Cv {
  const c = blank();
  // orbit trail (dotted arc), drawn first
  const trail: [number, number][] = [
    [2, 4],
    [1, 6],
    [1, 9],
    [2, 11],
  ];
  yarnBall(c, 8.5, 8.5, 5.0);
  c.set(6, 6, "w");
  yarnBall(c, 12.5, 3.0, 1.9);
  c.outline("1");
  for (const [x, y] of trail) c.set(x, y, "q");
  // loose thread
  c.set(4, 14, "p").set(3, 14, "p").set(2, 15, "p");
  return c;
}

const HEART10 = `
.rrr..rrr.
rqwrrrrpwr
rwqrrrrrrR
rrrrrrrrRR
.rrrrrrRR.
..rrrrRR..
...rrRR...
....RR....`;

function heartBoomerang(): Cv {
  const c = from(HEART10, 5, 4);
  c.outline("1");
  // curved return path + arrow head
  c.pts(
    [
      [3, 3],
      [2, 4],
      [1, 6],
      [1, 7],
      [1, 8],
      [2, 10],
      [3, 11],
      [4, 12],
    ],
    "w",
  );
  c.pts(
    [
      [4, 1],
      [4, 2],
      [3, 2],
      [5, 2],
    ],
    "w",
  );
  c.pts(
    [
      [5, 13],
      [6, 14],
    ],
    "q",
  );
  return c;
}

function thunderBell(): Cv {
  const c = from(`
................
.......yy.......
......y..y......
......yyyy......
.....zyyyyY.....
....zyyyyyYY....
....zyyyyyYY....
....zyyyyyyY....
...zyyyyyyyYY...
...zyyyyyyyYY...
..zzyyyyyyyyYY..
..YYYYYYYYYYYY..
......OyyO......
.......OO.......
................
................`);
  c.put(
    `
..aw
.ac.
acca
..ac
.ac.
.c..`,
    6,
    4,
  );
  c.outline("1");
  // spark lines
  c.set(1, 4, "a").set(0, 3, "a").set(14, 4, "a").set(15, 3, "a");
  return c;
}

function candyBomb(): Cv {
  const c = blank();
  const cx = 7.5;
  const cy = 9.0;
  c.disc(cx, cy, 4.4, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const l = shade(dx, dy) / 4.4;
    // peppermint swirl: three spiral arms
    const v = (((Math.atan2(dy, dx) / (Math.PI * 2)) * 3 + r * 0.16) % 1 + 1) % 1;
    if (v < 0.42) return l > -0.45 ? "w" : "W";
    return l > 0.3 ? "q" : l > -0.4 ? "p" : "P";
  });
  // wrapper twists
  c.put(
    `
.y
yz
yy
yY
.Y`,
    1,
    7,
  );
  c.put(
    `
z.
yy
yY
YY
Y.`,
    13,
    7,
  );
  c.pts(
    [
      [8, 4],
      [9, 3],
    ],
    "H",
  );
  c.outline("1");
  c.set(10, 2, "H");
  sparkle(c, 12, 1, "w", "y");
  c.set(11, 3, "o");
  return c;
}

function bubble(c: Cv, cx: number, cy: number, r: number): void {
  c.disc(cx, cy, r, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) / (r + 0.5);
    const l = shade(dx, dy) / r;
    if (d > 0.78) return l > 0.3 ? "a" : "c";
    return l < -0.35 ? "a" : "v";
  });
  // curved white highlight hugging the upper-left rim
  if (r > 3) {
    for (let a = 3.5; a <= 4.6; a += 0.12) c.set(cx + Math.cos(a) * (r - 1.6), cy + Math.sin(a) * (r - 1.6), "w");
    c.set(cx + r * 0.45, cy + r * 0.45, "w");
  } else c.set(cx - 0.6, cy - 0.6, "w");
}

function bubbleAura(): Cv {
  const c = blank();
  bubble(c, 6.5, 9.0, 5.2);
  bubble(c, 12.3, 4.0, 2.4);
  bubble(c, 13.0, 11.5, 1.6);
  c.outline("1");
  return c;
}

function prismBeam(): Cv {
  const c = blank();
  // white beam in
  c.rect(0, 9, 5, 2, "w");
  // rainbow fan out (behind the prism)
  const RAIN = ["r", "o", "y", "l", "c", "i"];
  c.each((x, y) => {
    if (x < 9) return null;
    const t = (x - 9) / 6; // 0..1
    const top = 8 - t * 4.2;
    const bot = 10 + t * 4.2;
    if (y < top || y > bot) return null;
    const k = Math.min(5, Math.floor(((y - top) / (bot - top + 0.001)) * 6));
    return RAIN[k];
  });
  // glass prism
  c.poly(
    [
      [7.5, 1.6],
      [13.4, 13.4],
      [1.6, 13.4],
    ],
    (x, y) => (x < 6 ? "w" : x < 8 ? "a" : x < 10 ? "v" : "u"),
  );
  c.set(7, 4, "w").set(6, 6, "w");
  c.outline("1");
  return c;
}

// =========================================================================== evolutions

function galaxyBarrage(): Cv {
  const c = blank();
  shadedStar(c, 7.5, 8.2, 5.0, 2.6, { rimLit: "q", rimDark: "P", body: "p", inner: "q", core: "w" }, { coreR: 1.2 });
  c.outline("1");
  // spiral arms of stardust (no outline: they glitter on the card)
  for (let arm = 0; arm < 2; arm++)
    for (let t = 0; t <= 1; t += 0.035) {
      const a = t * Math.PI * 1.1 + arm * Math.PI + 0.9;
      const r = 6.2 + t * 2.0;
      const x = Math.round(7.5 + Math.cos(a) * r);
      const y = Math.round(8 + Math.sin(a) * r * 0.9);
      if (c.get(x, y) === ".") c.set(x, y, t < 0.35 ? "i" : t < 0.7 ? "j" : "w");
    }
  sparkle(c, 2, 13, "w", "j");
  sparkle(c, 13, 13, "w", "z");
  return evo(c, "tr");
}

const PETAL5 = `
.qq
qwq
pP.`;

function sakuraTempest(): Cv {
  const c = blank();
  const cx = 7.5;
  const cy = 8.0;
  // solid whirlwind ring with three spiral wind-streaks
  c.each((x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r < 3.4 || r > 7.0) return null;
    let v = ((Math.atan2(dy, dx) / (Math.PI * 2)) * 3 - (r - 3.4) * 0.09 + 1) % 1;
    if (v < 0) v += 1;
    if (v < 0.16) return "w";
    if (v < 0.5) return "q";
    return shade(dx, dy) / r > -0.3 ? "p" : "P";
  });
  c.outline("1");
  // petal in the eye of the storm
  c.put(
    `
qq.
qwp
.pP`,
    6,
    7,
  );
  sparkle(c, 1, 14, "w", "q");
  return evo(c, "tr");
}

function cosmicYarn(): Cv {
  const c = blank();
  const cx = 7.0;
  const cy = 8.5;
  const tilt = -0.38;
  const ring = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * Math.cos(tilt) + dy * Math.sin(tilt);
    const v = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
    const on = Math.hypot(u / 7.2, v / 2.9) <= 1 && Math.hypot(u / 5.2, v / 1.6) > 1;
    return { on, front: v >= 0 };
  };
  c.shape((x, y) => ring(x, y).on && !ring(x, y).front, "Y");
  c.ball(cx, cy, 4.4, 4.4, "IiijjW", { bias: 0.06 });
  // yarn-wound bands on the planet
  c.each((x, y, k) => ("Iij".includes(k) && (x + y * 2) % 5 === 0 ? "I" : null));
  c.set(5, 6, "w");
  c.shape(
    (x, y) => ring(x, y).on && ring(x, y).front,
    (x, y) => (x < cx ? "z" : "y"),
  );
  c.outline("1");
  // tiny orbiting moon
  c.set(1, 2, "q").set(2, 2, "p").set(1, 3, "p");
  return evo(c, "tr");
}

function loveTornado(): Cv {
  const c = blank();
  for (let y = 1; y <= 14; y++) {
    const t = (y - 1) / 13;
    const hw = 6.2 - t * 5.4;
    const mid = 6.8 + Math.sin(y * 0.7) * 0.9;
    for (let x = 0; x < 16; x++) {
      const u = (x - (mid - hw)) / (2 * hw);
      if (u < 0 || u > 1) continue;
      const band = y % 3 === 0;
      c.set(x, y, band ? (u < 0.4 ? "p" : "P") : u < 0.22 ? "w" : u < 0.55 ? "q" : u < 0.85 ? "p" : "P");
    }
  }
  c.outline("1");
  // hearts swirling around the funnel
  const H3 = `
r.r
rrr
.r.`;
  c.put(H3, 12, 6);
  c.put(H3, 0, 9);
  c.set(13, 6, "w");
  return evo(c, "tr");
}

function raijinDrum(): Cv {
  const c = from(`
................
................
................
.....hhhhhh.....
....hBwBBBBh....
...hBBBBBBBBh...
...hhBBBBBBhh...
..ryhhhhhhhhyR..
..rrrrrrrrrrRR..
..rrryyyyrrrRR..
..rrryRRyrrrRR..
..rrryyyyrrrRR..
..ryrrrrrrrryR..
...hhhhhhhhhh...
................
................`);
  c.set(3, 8, "p").set(3, 9, "p");
  c.outline("1");
  // lightning bolts either side
  const BOLT = `
..z
.zy
zyy
.y.
y..`;
  c.put(BOLT, 0, 1);
  c.put(BOLT, 13, 10, { flip: true });
  return evo(c, "tr");
}

function sugarNuke(): Cv {
  const c = blank();
  c.line(10, 11, 13, 14, "W");
  c.line(11, 11, 14, 14, "g");
  const cx = 7.0;
  const cy = 7.5;
  c.disc(cx, cy, 5.6, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const v = ((Math.atan2(dy, dx) / (Math.PI * 2)) * 2 + r * 0.22 + 1) % 1;
    const l = shade(dx, dy) / 5.6;
    if (v < 0.5) return l > 0.35 ? "q" : l > -0.4 ? "p" : "P";
    return l > -0.4 ? "w" : "W";
  });
  c.set(5, 4, "w");
  c.outline("1");
  // gold fuse spark + bomblets
  c.set(8, 1, "H");
  sparkle(c, 9, 0, "w", "y");
  c.set(1, 14, "p").set(2, 14, "q").set(0, 12, "y");
  return evo(c, "tl");
}

function oceanDome(): Cv {
  const c = blank();
  const cx = 7.5;
  const cy = 11.0;
  // dome
  c.ellipse(cx, cy, 6.6, 8.2, (x, y) => {
    if (y > 10) return null;
    const dx = x - cx;
    const dy = y - cy;
    const l = shade(dx, dy * 0.8) / 7;
    const d = Math.hypot(dx / 6.6, dy / 8.2);
    if (d > 0.82) return l > 0.1 ? "a" : "c";
    return l > 0.2 ? "a" : l > -0.25 ? "c" : "C";
  });
  // wave base
  c.put(
    `
..wwa.awwa.awa.
.uuuuuuuuuuuuuu
.UUuuUUuuUUuuUU`,
    0,
    11,
  );
  // heart inside
  c.put(
    `
p.p
ppp
.p.`,
    6,
    6,
  );
  c.set(4, 4, "w").set(3, 5, "w").set(5, 3, "w");
  c.outline("1");
  c.set(10, 4, "w").set(11, 7, "a");
  return evo(c, "tr");
}

function rainbowCannon(): Cv {
  const c = blank();
  const RAIN = ["r", "o", "y", "l", "c", "u", "i"];
  // thick diagonal rainbow beam from the bottom-left to the top-right
  c.each((x, y) => {
    const along = (x - (15 - y)) / Math.SQRT2; // across-beam coordinate
    const pos = (x + (15 - y)) / Math.SQRT2;
    if (pos < 4 || pos > 21) return null;
    const half = 2.2 + (pos - 4) * 0.12;
    if (Math.abs(along) > half) return null;
    const k = Math.min(6, Math.floor(((along + half) / (2 * half)) * 7));
    return RAIN[k];
  });
  // white-hot muzzle burst at the origin
  c.disc(3.5, 11.5, 2.6, "w");
  c.set(3, 11, "z");
  c.outline("1");
  c.set(0, 15, "w").set(6, 15, "a").set(0, 8, "a");
  return evo(c, "tr");
}

// =========================================================================== passives

function powerBow(): Cv {
  const c = from(`
................
................
..rr........rr..
.rpqr......rqpr.
.rqwpr....rppRr.
.rpqppr..rpppRr.
.rppppRrrRppRRr.
.rRpppRppRRRRRr.
..rrRRrRRrRRrr..
.....rRrrRr.....
....rRr..rRr....
...rRr....rRr...
...rr......rR...
................
................
................`);
  c.set(7, 7, "q");
  return c.outline("1");
}

function wishCharm(): Cv {
  const c = blank();
  // cord
  c.line(2, 1, 6, 4, "W");
  c.line(13, 1, 9, 4, "W");
  c.rect(7, 4, 2, 2, "p");
  c.set(7, 4, "q");
  // star pendant
  shadedStar(c, 7.5, 10.2, 4.6, 2.4, { rimLit: "y", rimDark: "Y", body: "y", inner: "z", core: "w" }, { coreR: 0.9 });
  c.outline("1");
  sparkle(c, 13, 8, "w", "z");
  return c;
}

function bigRibbon(): Cv {
  // looped ribbon with crossed, flowing tails
  const c = from(`
................
.....pppppp.....
....pqqwqqqp....
...pqqPPPPqqp...
...pqP....Pqp...
...pqP....PqP...
...pqqP..PqqP...
....pqqPPqqP....
.....pqqqqP.....
.....qqPpqq.....
....qqP..pqq....
...qqP....pqq...
..qqP......pqP..
.qqP........pPP.
.PP..........P..
................`);
  c.outline("1");
  sparkle(c, 13, 2, "w", "q");
  return c;
}

function twinCharm(): Cv {
  const c = blank();
  const heart = (cx: number, cy: number, s: number, keys: string) =>
    c.shape(
      (x, y) => inHeart(x, y, cx, cy, s),
      (x, y) => {
        const l = shade(x - cx, y - cy) / s;
        return l > 0.35 ? keys[2] : l > -0.3 ? keys[1] : keys[0];
      },
    );
  heart(10.5, 9.5, 3.9, "Ucv");
  // link ring between them
  c.set(8, 8, "y").set(9, 7, "y");
  heart(5.5, 6.5, 3.9, "Ppq");
  c.set(4, 4, "w").set(11, 7, "w");
  c.outline("1");
  return c;
}

function swiftShoes(): Cv {
  const c = from(`
................
................
................
....ccc.........
...caaac........
...caaaacc......
...caaaawacc....
...cqqqaawaacc..
...caaqqqaaaaac.
...ccaaaaaaaaac.
...wwwwwwwwwwww.
...pppppppppppp.
................
................
................
................`);
  // feathered heel wing (behind the shoe)
  c.put(
    `
ww...
Www..
gWwww
.gWWw
..gW.`,
    0,
    3,
    { under: true },
  );
  c.outline("1");
  // speed lines
  c.set(0, 10, "a").set(1, 10, "a").set(0, 12, "v").set(1, 12, "v");
  return c.shift(0, 1);
}

function magnetStar(): Cv {
  const c = blank();
  // field arcs either side
  const arc = (cx: number, dir: number, r: number, key: string) => {
    for (let a = -1.1; a <= 1.1; a += 0.05) c.set(cx + Math.cos(a) * r * dir, 8 + Math.sin(a) * r * 1.1, key);
  };
  arc(7.5, 1, 6.3, "u");
  arc(7.5, -1, 6.3, "u");
  arc(7.5, 1, 4.8, "v");
  arc(7.5, -1, 4.8, "v");
  c.each((x, y, k) => (k !== "." && x > 4 && x < 11 ? "." : null));
  shadedStar(c, 7.5, 8.2, 4.5, 2.4, { rimLit: "y", rimDark: "Y", body: "y", inner: "z", core: "w" }, { coreR: 0.9 });
  c.outline("1");
  return c;
}

function luckyClover(): Cv {
  const c = blank();
  c.line(9, 10, 12, 14, "e");
  c.line(10, 10, 13, 14, "E");
  const leaf = (cx: number, cy: number) => c.ball(cx, cy, 2.9, 2.9, "Eell", { bias: 0.05 });
  leaf(7.5, 3.9);
  leaf(3.9, 7.5);
  leaf(11.1, 7.5);
  leaf(7.5, 11.1);
  // heart notches / leaf veins
  c.pts(
    [
      [7, 2],
      [8, 2],
      [2, 7],
      [2, 8],
      [13, 7],
      [13, 8],
      [7, 13],
      [8, 13],
    ],
    "E",
  );
  c.rect(7, 7, 2, 2, "e");
  c.set(6, 3, "m").set(3, 6, "m").set(10, 6, "m").set(6, 10, "m");
  c.outline("1");
  return c;
}

function heartLocket(): Cv {
  const c = blank();
  // chain
  c.pts(
    [
      [7, 1],
      [8, 1],
      [6, 2],
      [9, 2],
    ],
    "Y",
  );
  c.shape(
    (x, y) => inHeart(x, y, 7.5, 9.0, 5.8),
    (x, y) => {
      const l = shade(x - 7.5, y - 9) / 5.8;
      return l > 0.35 ? "z" : l > -0.3 ? "y" : "Y";
    },
  );
  // pink gem set in the middle
  c.shape(
    (x, y) => inHeart(x, y, 7.5, 8.8, 2.6),
    (x, y) => (x + y < 16 ? "q" : "p"),
  );
  c.set(6, 7, "w");
  c.set(4, 5, "w");
  c.outline("1");
  return c;
}

// =========================================================================== HUD / UI

function coin(): Cv {
  const c = blank();
  c.disc(7.5, 7.5, 6.6, (x, y) => {
    const dx = x - 7.5;
    const dy = y - 7.5;
    const d = Math.hypot(dx, dy);
    const l = shade(dx, dy) / 6.6;
    if (d > 5.3) return l > 0.1 ? "y" : "Y";
    return l > 0.45 ? "z" : "y";
  });
  // engraved star: shadowed upper-left inner edge, lit lower-right inner edge
  shadedStar(c, 7.5, 7.8, 4.0, 2.0, { rimLit: "O", rimDark: "z", body: "Y", inner: "Y", core: "Y" }, { coreR: 0 });
  c.set(4, 3, "w").set(3, 4, "w");
  return c.outline("1");
}

function skull(): Cv {
  const c = from(`
................
..........pp.pp.
....WWWWWpqqpqp.
...WwwwwwWppPp..
..WwwwwwwwWpP...
..Wwwwwwwwwg....
..Ww00ww00Wg....
..Ww0w0w0wWg....
..Ww00ww00Wg....
..WwwwwwwwWg....
...gwww0wwg.....
....gwwwwg......
....gWgWgg......
................
................
................`);
  // cute shine in the eye sockets is the 'w' inside the 0 blocks
  return c.outline("1").shift(1, 1);
}

function hudHeart(): Cv {
  const c = blank();
  c.shape(
    (x, y) => inHeart(x, y, 7.5, 7.9, 6.6),
    (x, y) => {
      const l = shade(x - 7.5, y - 7.9) / 6.6;
      return l > 0.45 ? "p" : l > -0.35 ? "r" : "R";
    },
  );
  c.pts(
    [
      [4, 4],
      [3, 5],
      [3, 6],
      [4, 5],
    ],
    "w",
  );
  c.set(5, 4, "q").set(11, 4, "q");
  return c.outline("1");
}

function gem(): Cv {
  const c = from(`
.......U.......
......UaU......
.....UwaaU.....
....UwwacCU....
...UwwaacCCU...
..UwaaaacCCCU..
.UwaaaaaccCCCU.
UaaaaaacccCCCCU
.UaaaaccccCCCU.
..UaaacccCCCU..
...UaacccCCU...
....UacccCU....
.....UacCU.....
......UcU......
.......U.......`);
  c.map({ U: "." });
  c.set(6, 4, "w").set(5, 5, "w");
  return c.outline("1").shift(0, 0);
}

function reroll(): Cv {
  const c = blank();
  const cx = 7.5;
  const cy = 8.0;
  const R = 4.8;
  const arc = (a0: number, a1: number) => {
    c.each((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r < R - 1.3 || r > R + 1.3) return null;
      let a = Math.atan2(dy, dx);
      if (a < a0) a += Math.PI * 2;
      if (a > a1) return null;
      return shade(dx, dy) / r > 0.15 ? "a" : "c";
    });
    // arrow head at the a1 end, pointing clockwise along the tangent
    const px = cx + Math.cos(a1) * R;
    const py = cy + Math.sin(a1) * R;
    const tx = -Math.sin(a1);
    const ty = Math.cos(a1);
    const nx = Math.cos(a1);
    const ny = Math.sin(a1);
    c.poly(
      [
        [px + nx * 2.9 - tx * 0.6, py + ny * 2.9 - ty * 0.6],
        [px - nx * 2.9 - tx * 0.6, py - ny * 2.9 - ty * 0.6],
        [px + tx * 3.2, py + ty * 3.2],
      ],
      "c",
    );
  };
  arc(Math.PI * 0.95, Math.PI * 1.78);
  arc(-0.05, Math.PI * 0.78);
  c.outline("1");
  sparkle(c, 7, 8, "w", "z");
  return c;
}

function chestIcon(): Cv {
  const c = from(`
................
................
...1111111111...
..1qqqqqqqqqq1..
.1qwqqqqqqqqqP1.
.1pppppppppppP1.
1YzyyyyyyyyyyYO1
1OYYYY1111YYYOO1
.1pppp1yr1pppP1.
.1pqpp1rr1ppPP1.
.1pppp1111ppPP1.
.1YyPPPPPPPPYO1.
..111111111111..
................
................
................`);
  return c.map({ "1": "." }).outline("1").shift(0, 1);
}

function hpUp(): Cv {
  const c = blank();
  c.shape(
    (x, y) => inHeart(x, y, 7.0, 7.0, 5.9),
    (x, y) => {
      const l = shade(x - 7, y - 7) / 5.9;
      return l > 0.45 ? "p" : l > -0.35 ? "r" : "R";
    },
  );
  c.set(4, 4, "w").set(3, 5, "w");
  c.outline("1");
  // green plus badge
  c.disc(11.5, 11.5, 3.6, "1");
  c.disc(11.5, 11.5, 2.7, (x, y) => (x + y < 23 ? "l" : "e"));
  c.rect(11, 9, 2, 6, "w");
  c.rect(9, 11, 6, 2, "w");
  return c;
}

function goldUp(): Cv {
  const c = from(`
................
.....hh.hh......
......hHh.......
.....dddd.......
....hhhhhh......
...hBBhhhhh.....
..hBBhhhhhhH....
..hBhhyyhhhH....
..hhhyzyyhhH....
..hhhhyyhhHH....
..hhhhhhhHHH....
...HHHHHHHH.....
................
................
................
................`);
  c.outline("1");
  // spilled star coins
  const COIN = `
.yy.
yzyY
yyYY
.YY.`;
  c.put(COIN, 10, 9);
  c.put(COIN, 12, 12);
  c.put(COIN, 7, 12);
  c.each((x, y, k) => ((k === "y" || k === "z" || k === "Y") && y >= 9 && (x >= 10 || y >= 12) ? null : null));
  // outline the coins
  const coins = new Cv(16, 16);
  coins.put(COIN, 10, 9).put(COIN, 12, 12).put(COIN, 7, 12);
  coins.outline("1");
  c.put(coins, 0, 0);
  return c;
}

export const sprites: SpriteDef[] = [
  // weapons
  spr("icon_star_shot", N, N, [starShot()], "center"),
  spr("icon_petal_slash", N, N, [petalSlash()], "center"),
  spr("icon_yarn_orbit", N, N, [yarnOrbit()], "center"),
  spr("icon_heart_boomerang", N, N, [heartBoomerang()], "center"),
  spr("icon_thunder_bell", N, N, [thunderBell()], "center"),
  spr("icon_candy_bomb", N, N, [candyBomb()], "center"),
  spr("icon_bubble_aura", N, N, [bubbleAura()], "center"),
  spr("icon_prism_beam", N, N, [prismBeam()], "center"),
  // evolutions
  spr("icon_galaxy_barrage", N, N, [galaxyBarrage()], "center"),
  spr("icon_sakura_tempest", N, N, [sakuraTempest()], "center"),
  spr("icon_cosmic_yarn", N, N, [cosmicYarn()], "center"),
  spr("icon_love_tornado", N, N, [loveTornado()], "center"),
  spr("icon_raijin_drum", N, N, [raijinDrum()], "center"),
  spr("icon_sugar_nuke", N, N, [sugarNuke()], "center"),
  spr("icon_ocean_dome", N, N, [oceanDome()], "center"),
  spr("icon_rainbow_cannon", N, N, [rainbowCannon()], "center"),
  // passives
  spr("icon_power_bow", N, N, [powerBow()], "center"),
  spr("icon_wish_charm", N, N, [wishCharm()], "center"),
  spr("icon_big_ribbon", N, N, [bigRibbon()], "center"),
  spr("icon_twin_charm", N, N, [twinCharm()], "center"),
  spr("icon_swift_shoes", N, N, [swiftShoes()], "center"),
  spr("icon_magnet_star", N, N, [magnetStar()], "center"),
  spr("icon_lucky_clover", N, N, [luckyClover()], "center"),
  spr("icon_heart_locket", N, N, [heartLocket()], "center"),
  // HUD / UI
  spr("icon_coin", N, N, [coin()], "center"),
  spr("icon_skull", N, N, [skull()], "center"),
  spr("icon_heart", N, N, [hudHeart()], "center"),
  spr("icon_gem", N, N, [gem()], "center"),
  spr("icon_reroll", N, N, [reroll()], "center"),
  spr("icon_chest", N, N, [chestIcon()], "center"),
  spr("icon_hp_up", N, N, [hpUp()], "center"),
  spr("icon_gold_up", N, N, [goldUp()], "center"),
];
