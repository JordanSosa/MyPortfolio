/**
 * Player weapon visuals + ultimate projectiles (owner: world).
 *
 * Everything here is drawn on the bloom layer, so the recipe is: pale/white
 * core -> saturated body -> coloured dark rim (never plum on the hot parts),
 * with a few semi-transparent edge pixels where a soft falloff helps.
 * All sprites face RIGHT (code rotates/mirrors).
 */
import type { SpriteDef } from "../format";
import { Cv, LIGHT, inHeart, rgba, shadedStar, spr } from "./world-util";

// ------------------------------------------------------------------ shared palettes
const PAL: Record<string, string> = {
  "+": rgba("#ff7ab8", 0.4), // pink glow 40 %
  "-": rgba("#ff7ab8", 0.18), // pink glow 18 %
  "=": rgba("#ffb8dc", 0.7), // pale pink 70 %
  "~": rgba("#5aa8ff", 0.4), // blue glow 40 %
  "^": rgba("#4fe6df", 0.55), // cyan 55 %
  "%": rgba("#ffffff", 0.55), // white 55 %
  "&": rgba("#ffe14d", 0.45), // yellow 45 %
  $: rgba("#b47cff", 0.45), // violet 45 %
  "@": rgba("#ffffff", 0.25), // white 25 %
};

// ------------------------------------------------------------------ w_star (12x12), hand-pixelled + symmetric
const W_STAR = [
  `
.....OO.....
....OzyO....
....OzyO....
...OzzyyO...
OOOOzwwyOOOO
OzzzzwwyyyoO
.OyzzzzyyoO.
..OyzzyyoO..
..OyzyyyoO..
.OyyoOOyyoO.
.OyoO..OooO.
.OOO....OOO.`,
  `
.....OO.....
....OwzO....
....OwzO..w.
...OzwzyO...
OOOOwwwzOOOO
OzzzwwwzzyoO
.OzzwwzzyoO.
..OzzzzyoO..
..OyzzyyoO..
.OzyoOOyyoO.
.OyoO..OyoO.
.OOO....OOO.`,
];

// ------------------------------------------------------------------ w_star_evo (16x16)
const SPARK5 = `
.%.
%w%
.%.`;
function wStarEvo(f: number): Cv {
  const c = new Cv(16, 16);
  shadedStar(c, 7.5, 8.3, 5.4, 2.9, { rimLit: "q", rimDark: "i", body: "p", inner: "q", core: "w" }, { coreR: 1.6 });
  c.set(6, 6, "w");
  c.outline("I");
  // orbiting sparkles (rotate 90 degrees between frames) + trail dots
  const orbit = f === 0 ? [[13, 2], [1, 12]] : [[13, 12], [1, 2]];
  for (const [x, y] of orbit) c.put(SPARK5, x - 1, y - 1, { under: true });
  const trail = f === 0 ? [[11, 1], [3, 14]] : [[14, 10], [0, 4]];
  for (const [x, y] of trail) if (c.get(x, y) === ".") c.set(x, y, "$");
  return c;
}

// ------------------------------------------------------------------ w_slash (48x32, 4 frames)
const PETAL_A = `
.qq
qwp
pP.`;
const PETAL_B = `
qq.
pwq
.Pp`;

function wSlash(f: number): Cv {
  const c = new Cv(48, 32);
  const cx = 14;
  const cy = 15.5;
  const ax = 32;
  const ay = 15;
  const phiMax = (80 * Math.PI) / 180;
  // per-frame sweep window, thickness and fade
  const win = [
    [-phiMax, phiMax * 0.15],
    [-phiMax, phiMax],
    [-phiMax * 0.85, phiMax],
    [-phiMax * 0.7, phiMax],
  ][f];
  const thick = [0.26, 0.4, 0.3, 0.2][f];
  c.each((x, y) => {
    const u = (x - cx) / ax;
    const v = (y - cy) / ay;
    const rho = Math.hypot(u, v);
    const phi = Math.atan2(v, u);
    if (phi < win[0] || phi > win[1]) return null;
    // taper towards both tips of the sweep window
    const span = (win[1] - win[0]) / 2;
    const mid = (win[1] + win[0]) / 2;
    const k = Math.abs(phi - mid) / span;
    const t = thick * Math.pow(Math.max(0, 1 - k * k), 0.65);
    if (t <= 0.01) return null;
    const s = (1 - rho) / t; // 0 = outer edge, 1 = inner edge
    if (s < 0 || s > 1) return null;
    if (f === 0) {
      if (s < 0.15) return "q";
      if (s < 0.6) return "w";
      if (s < 0.8) return "q";
      return "%";
    }
    if (f === 1) {
      if (s < 0.1) return "p";
      if (s < 0.45) return "w";
      if (s < 0.62) return "q";
      if (s < 0.8) return "p";
      return "%";
    }
    if (f === 2) {
      // fading: broken into parallel streaks
      const band = Math.floor(s * 5);
      if ((band === 1 || band === 3) && ((x + y) & 3) === 0) return null;
      if (s < 0.15) return "q";
      if (s < 0.45) return "%";
      if (s < 0.6) return "q";
      return "@";
    }
    // f3: wisps - two thin broken strands
    if (Math.abs(s - 0.25) < 0.12 && ((x * 7 + y * 3) % 5 !== 0)) return "%";
    if (Math.abs(s - 0.7) < 0.12 && ((x * 5 + y) % 4 !== 0)) return "@";
    return null;
  });
  // white leading tip on the appear frame
  if (f === 0) {
    const tip = win[1];
    const x = Math.round(cx + Math.cos(tip) * ax * 0.93);
    const y = Math.round(cy + Math.sin(tip) * ay * 0.93);
    c.put(SPARK5, x - 1, y - 1);
  }
  // sakura petals riding the outer edge, drifting outward over the frames
  const petals: [number, number][] = [
    [-0.95, 1.08],
    [-0.35, 1.12],
    [0.3, 1.1],
    [0.9, 1.06],
    [0.05, 0.86],
  ];
  if (f > 0)
    petals.forEach(([pa, pr], i) => {
      const drift = (f - 1) * 0.07;
      const x = Math.round(cx + Math.cos(pa) * ax * (pr + drift)) - 1;
      const y = Math.round(cy + Math.sin(pa) * ay * (pr + drift)) - 1;
      if (f === 3 && i % 2 === 1) return;
      c.put(i % 2 ? PETAL_B : PETAL_A, Math.min(45, x), Math.max(0, Math.min(29, y)), f === 3 ? { map: { w: "q", P: "p" } } : {});
    });
  return c;
}

// ------------------------------------------------------------------ w_tempest (48x48, 4 frames, 3-fold swirl)
function wTempest(f: number): Cv {
  const c = new Cv(48, 48);
  const cx = 23.5;
  const cy = 23.5;
  const rot = (f / 4) * ((Math.PI * 2) / 3);
  c.each((x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r < 10 || r > 22.5) return null;
    const a = Math.atan2(dy, dx) - rot;
    // three spiral arms: v in [0,1) along each arm, 0 = leading edge
    let v = ((a / (Math.PI * 2)) * 3 - (r - 10) * 0.045) % 1;
    if (v < 0) v += 1;
    const edge = Math.abs(r - 17) / 5.5; // 0 at the ring centre line
    if (v < 0.07 && edge < 0.9) return "w";
    if (v < 0.16 && edge < 0.95) return edge < 0.5 ? "w" : "q";
    if (v < 0.3 && edge < 0.85) return edge < 0.4 ? "q" : "p";
    if (v < 0.45 && edge < 0.7) return "%";
    if (v < 0.6 && edge < 0.5) return "@";
    // faint full ring so it reads as a 360 degree whirlwind
    if (edge < 0.18) return "@";
    return null;
  });
  // petals orbiting with the wind
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * Math.PI * 2 + 0.4;
    const rr = i % 2 ? 21 : 13.5;
    const x = Math.round(cx + Math.cos(a) * rr) - 1;
    const y = Math.round(cy + Math.sin(a) * rr) - 1;
    c.put(i % 2 ? PETAL_A : PETAL_B, x, y);
  }
  return c;
}

// ------------------------------------------------------------------ w_yarn (10x10)
const YARN = [
  `
..........
...QQQQ...
..QqqqqQ..
.QqwPPPqQ.
.QqPqqqPQ.
.QPqPPPqQ.
.QpPpppPQ.
..QpPPPQ..
...QQQQP..
.......PP.`,
  `
..........
...QQQQ...
..QqPPqQ..
.QqPqqPqQ.
.QwPqPPqQ.
.QqPpPpPQ.
.QpPpPpPQ.
..QpPPPQ..
...QQQQ...
....PPP...`,
];

// ------------------------------------------------------------------ w_planet (14x14)
function wPlanet(f: number): Cv {
  const c = new Cv(14, 14);
  const tilt = -0.36;
  const cx = 6.5;
  const cy = 6.8;
  const ring = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * Math.cos(tilt) + dy * Math.sin(tilt);
    const v = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
    const outer = Math.hypot(u / 6.6, v / 2.7) <= 1;
    const inner = Math.hypot(u / 4.7, v / 1.45) <= 1;
    return { on: outer && !inner, front: v >= 0 };
  };
  c.shape((x, y) => ring(x, y).on && !ring(x, y).front, "Y");
  c.ball(cx, cy, 3.9, 3.9, "IijjW", { bias: 0.08 });
  c.set(5, 4, "w");
  c.shape(
    (x, y) => ring(x, y).on && ring(x, y).front,
    (x, y) => (x + y < 13 ? "z" : "y"),
  );
  c.outline("2");
  if (f === 0) c.set(1, 9, "w");
  else c.set(12, 4, "w");
  return c;
}

// ------------------------------------------------------------------ w_heart (12x12)
const HEART = `
............
..QQQ..QQQ..
.QrqrQQrrrQ.
QrwqrrrrrrRQ
QrqrrrrrrrRQ
QrrrrrrrrRRQ
.QrrrrrrRRQ.
..QrrrrRRQ..
...QrrRRQ...
....QRRQ....
.....QQ.....
............`;

// ------------------------------------------------------------------ w_heart_evo (16x16): magenta heart with wings
function wHeartEvo(): Cv {
  const c = new Cv(16, 16);
  // feathered wings swept up and back (drawn first, the heart overlaps)
  const wing = `
w.....
Ww....
WwwW..
gWwwW.
.gWwww
..gWww
...gWw
....gW`;
  c.put(wing, 0, 2);
  c.put(wing, 10, 2, { flip: true });
  c.shape(
    (x, y) => inHeart(x, y, 7.5, 8.6, 4.7),
    (x, y) => {
      const dx = x - 7.5;
      const dy = y - 8.6;
      const l = dx * LIGHT[0] + dy * LIGHT[1];
      if (l > 2.2) return "q";
      if (l > -1.4) return "p";
      return "P";
    },
  );
  c.set(5, 7, "w").set(4, 8, "w").set(5, 8, "q");
  c.selout({ w: "I", W: "I", g: "I", q: "Q", p: "Q", P: "Q" }, "Q");
  return c;
}

// ------------------------------------------------------------------ w_bell (12x12)
const BELL = `
............
.....OO.....
....O..O....
....OOOO....
...OzyyyO...
...OzyyYO...
..OzycyyYO..
..OzcccyYO..
..OzyycyYO..
.OzzyycyYYO.
.OOOOOOOOOO.
.....OyO....`;

/** Shear rows to tilt the bell around its top loop (swing frame). */
function swing(src: string): Cv {
  const s = Cv.of(src);
  const c = new Cv(s.w, s.h);
  for (let y = 0; y < s.h; y++) {
    const dx = Math.round((y - 2) * 0.22);
    for (let x = 0; x < s.w; x++) c.set(x + dx, y, s.get(x, y) === "." ? null : s.get(x, y));
  }
  return c;
}

// ------------------------------------------------------------------ w_candy (10x10)
function wCandy(f: number): Cv {
  const c = new Cv(10, 10);
  c.ball(4.5, 5.6, 2.9, 2.9, "PpqW", { bias: 0.1 });
  // white swirl stripes
  c.set(3, 4, "w").set(4, 5, "w").set(5, 6, "w").set(6, 7, "w").set(3, 7, "w").set(6, 4, "w");
  // wrapper twists
  c.put(
    `
.y
yz
yy
.y`,
    0,
    4,
  );
  c.put(
    `
y.
zy
yY
Y.`,
    8,
    4,
  );
  c.set(5, 2, "H");
  c.outline("1");
  // fuse + spark
  c.set(6, 1, "H").set(5, 2, "H");
  if (f === 0) c.set(7, 0, "y").set(6, 0, "w");
  else c.set(7, 0, "w").set(8, 1, "y").set(7, 1, "o");
  return c;
}

// ------------------------------------------------------------------ w_candy_evo (14x14): swirl lollipop bomb
function wCandyEvo(f: number): Cv {
  const c = new Cv(14, 14);
  // stick
  c.line(9, 10, 12, 13, "W");
  c.line(10, 10, 13, 13, "g");
  const cx = 6.0;
  const cy = 6.5;
  const off = f * 0.55;
  c.disc(cx, cy, 5.0, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx) + off;
    const v = ((a / (Math.PI * 2)) * 2 + r * 0.24) % 1;
    const stripe = (v + 1) % 1 < 0.5;
    const lit = dx + dy < -2;
    const dark = dx + dy > 3.5;
    if (stripe) return dark ? "P" : lit ? "q" : "p";
    return dark ? "j" : lit ? "w" : "W";
  });
  c.set(4, 3, "w").set(3, 4, "w");
  c.outline("1");
  // fuse spark on top
  c.set(7, 0, "H");
  c.set(8, 0, f ? "y" : "w");
  if (f) c.set(9, 0, "o");
  return c;
}

// ------------------------------------------------------------------ w_bubble (8x8, translucent)
const BUBBLE_PAL: Record<string, string> = {
  "+": rgba("#e6fffb", 0.28), // interior
  "=": rgba("#bafff6", 0.92), // lit rim
  "-": rgba("#4fe6df", 0.9), // rim shade
  "*": rgba("#ffffff", 0.95),
};
const BUBBLE = [
  `
..====..
.=*++++=
=*w+++++
=*+++++-
=++++++-
=+++++w-
.=+++--.
..----..`,
  `
........
.======.
=*w++++=
=*+++++-
=++++++-
=++++w+-
.------.
........`,
];

// ------------------------------------------------------------------ prism beam
const BEAM_PAL: Record<string, string> = {
  "+": rgba("#ff7ab8", 0.45),
  "~": rgba("#5aa8ff", 0.45),
};
const BEAM_SEG = [
  `
++++++++
pppppppp
qqwqqqqq
zzzzzzwz
wwwwwwww
wwwwwwww
wwwwwwww
wwwwwwww
aawaaaaa
cccccwcc
uuuuuuuu
~~~~~~~~`,
  `
++++++++
pppppppp
qqqqqwqq
zzwzzzzz
wwwwwwww
wwwwwwww
wwwwwwww
wwwwwwww
aaaaawaa
cwcccccc
uuuuuuuu
~~~~~~~~`,
];

function beamTip(f: number): Cv {
  const c = new Cv(12, 12);
  const cx = 5.5;
  const cy = 5.5;
  const rot = f ? Math.PI / 4 : 0;
  c.each((x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r < 1.8) return "w";
    if (r < 2.6) return "a";
    const a = Math.atan2(dy, dx) - rot;
    const k = (((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2)) / (Math.PI / 2); // 0..1 between long rays
    const toLong = Math.min(k, 1 - k) * 4; // 0 on a long ray, 1 on a diagonal
    const len = toLong < 0.5 ? 6 - toLong * 2 : 3.6;
    const width = r * Math.min(k, 1 - k) * (Math.PI / 2);
    const onLong = width < 0.75 && r < len;
    const onDiag = Math.abs(toLong - 2) < 0.22 && r < 4.2;
    if (onLong) return r < 4 ? "w" : (x + y) % 2 ? "c" : "q";
    if (onDiag) return r < 3.4 ? "a" : "^";
    return null;
  });
  if (f) {
    c.disc(5.5, 5.5, 1.3, "w");
  }
  return c;
}

// ------------------------------------------------------------------ ult_meteor (16x24): star head at the bottom, tail going up
function meteor(f: number): Cv {
  const c = new Cv(16, 24);
  const hx = 7.5;
  const hy = 18.5;
  // tail: widens from the top towards the head
  c.each((x, y) => {
    if (y > hy) return null;
    const t = y / hy; // 0 top .. 1 head
    const half = 0.6 + t * 4.2;
    const dx = Math.abs(x - hx);
    if (dx > half) return null;
    const core = dx < half * 0.35;
    if (t < 0.25) return core ? "$" : null;
    if (t < 0.45) return core ? "j" : "$";
    if (t < 0.7) return core ? "q" : dx < half * 0.7 ? "p" : "$";
    return core ? "z" : dx < half * 0.7 ? "y" : "&";
  });
  // sparkles in the tail (alternate per frame)
  const sp = f === 0 ? [[6, 3], [9, 7], [5, 10], [10, 12], [7, 1]] : [[9, 2], [6, 6], [10, 9], [5, 13], [8, 4]];
  for (const [x, y] of sp) c.set(x, y, "w");
  // star head
  shadedStar(c, hx, hy, 4.6, 2.5, { rimLit: "y", rimDark: "o", body: "y", inner: "z", core: "w" }, { coreR: f ? 1.8 : 1.3 });
  c.selout({ y: "O", o: "O", z: "O", w: "O" }, ".", false, (x, y) => y >= 14);
  return c;
}

// ------------------------------------------------------------------ ult_petal (8x8)
const ULT_PETAL = [
  `
.qq.qq..
qwqqqqp.
qwqqqpp.
qqqqppP.
.qqppP..
.qppPP..
..pPP...
...P....`,
  `
........
.....qq.
....qwq.
...qqqP.
..qqpP..
.qppP...
.pP.....
........`,
];

export const sprites: SpriteDef[] = [
  spr("w_star", 12, 12, W_STAR, "center", { fps: 8 }),
  spr("w_star_evo", 16, 16, [wStarEvo(0), wStarEvo(1)], "center", { fps: 8, pal: PAL }),
  spr("w_slash", 48, 32, [0, 1, 2, 3].map(wSlash), "center", { fps: 16, pal: PAL }),
  spr("w_tempest", 48, 48, [0, 1, 2, 3].map(wTempest), "center", { fps: 14, pal: PAL }),
  spr("w_yarn", 10, 10, YARN, "center", { fps: 6 }),
  spr("w_planet", 14, 14, [wPlanet(0), wPlanet(1)], "center", { fps: 4 }),
  spr("w_heart", 12, 12, [HEART], "center"),
  spr("w_heart_evo", 16, 16, [wHeartEvo()], "center"),
  spr("w_bell", 12, 12, [BELL, swing(BELL)], "center", { fps: 6 }),
  spr("w_candy", 10, 10, [wCandy(0), wCandy(1)], "center", { fps: 10 }),
  spr("w_candy_evo", 14, 14, [wCandyEvo(0), wCandyEvo(1)], "center", { fps: 10 }),
  spr("w_bubble", 8, 8, BUBBLE, "center", { fps: 4, pal: BUBBLE_PAL }),
  spr("w_beam_seg", 8, 12, BEAM_SEG, "center", { fps: 12, pal: BEAM_PAL }),
  spr("w_beam_tip", 12, 12, [beamTip(0), beamTip(1)], "center", { fps: 12, pal: PAL }),
  spr("ult_meteor", 16, 24, [meteor(0), meteor(1)], "center", { fps: 10, pal: PAL }),
  spr("ult_petal", 8, 8, ULT_PETAL, "center", { fps: 6 }),
];
