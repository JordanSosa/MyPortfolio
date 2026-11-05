/**
 * KURO - "Lord of the Abyssal Flame" (owner: s2-heroes-a).
 * Hero set (24x24 idle/run/hurt/cast), bust portrait, and the ult reveal prop.
 * Art direction: docs/content/heroes.md §2.4.
 */
import {
  Pix,
  gridSprite,
  heroSprites,
  wave,
  bend,
  SPARKLE,
  SPARK_S,
  strand,
  layer,
  eye,
  lidded,
  fierce,
  blush,
  paintPortrait,
  EYE_FAR,
  FAR_X,
  EYE_Y,
  TWINKLE,
  TWINKLE_S,
  type StrandKeys,
  type PortraitDef,
  type Iris,
  type HeroDef,
  type SpriteDef,
} from "./s2-heroes-a-util";

// ============================================================================ hero sprite

// Interior-only head (auto-outlined; top + bottom rows are outline room).
// Hair 2/x with f sheen + ONE crimson streak r/R on a crown spike. Eyepatch 0
// (G gloss, y star) on the near eye with its strap crossing the forehead;
// visible far eye crimson R/r + w shine.
const K_HEAD_IN = `
................
...f...f........
..ff..ffr.......
.ff2.ff2r.f.....
ff22f222Rff2....
.2ff22222222x...
f22fff222x22xx..
.22x22sx20sxxx..
..22xs000ss111..
f22xxs00ysswRs..
.22xxs000ssRrs..
..22xss0sssrrs..
..x2xkbsss1ssb..
...xx1ssssssk...
................
`;
const K_HEAD = Pix.of(K_HEAD_IN, "kuro head").outline("1").str();
/** Blink: only the visible eye closes (the patch is always closed). */
const K_FACE_BLINK = `
................
................
................
................
................
................
................
................
...........sss..
...........sss..
...........111..
...........sss..
`;
/** Hurt: the patch flips up onto the forehead revealing a perfectly normal (squeezed) eye. */
const K_FACE_HURT = `
................
................
................
................
................
................
................
......0y0.......
.....s1ssss1ss..
.....ss11s11ss..
.....s1ssss1ss..
.....sssssssss..
.....kbss11sbb..
.........RR.....
`;
/** Cast: the visible eye flares wide, mouth open shouting. */
const K_FACE_CAST = `
................
................
................
................
................
................
................
................
................
................
................
...........rw...
.........00.....
.........RR.....
`;

// Cape: dark outside (2/x) with a G rim light, crimson lining (R/r) on the
// inside fold, tattered hem. Interior-only; outlined when stamped.
const K_CAPE_IDLE = [
  `
.......22
......f2x
.....f22x
....f22xx
....f2xxx
...f22xxx
...f2xxRx
..f22xRrx
..f2xRrrx
.f22Rrrrx
.f2x2Rr2x
f2.2x.2.x
`,
  `
.......22
......f2x
.....f22x
....f22xx
....f2xxx
...f22xxx
...f2xxRx
..f22xRrx
..f2xRrrx
.f2xRrrRx
f22x2Rr2x
.2.x..2.x
`,
];
const K_CAPE_RUN = [
  `
..........f2
.......ff22x
....ff222xxx
.ff222xxxxRx
f22xxxxRRrr.
.2x2xRRrr...
..2.xR.r....
....R.......
`,
  `
..........f2
.......ff22x
...fff222xxx
ff2222xxxxRx
.f2xxxxRRrr.
..22xRRrr...
...2.R.r....
.....R......
`,
];
const K_CAPE_CAST = `
............2
...........f2
.........ff2x
.......ff22xx
.....ff222xRx
...ff222xRRrx
.ff222xRRrrrx
f222xRRrrrrRx
.22xRrrrrrRRx
..2.R.r.R.Rx.
`;
/** High stand-up collar points either side of the jaw (red inside). */
const K_COLLAR_L = `
2.
2R
2R
`;
const K_COLLAR_R = `
.2
R2
R2
`;
const K_BODY = `
..1Unnnn1...
.1UUnynnn1..
.1s1Unnn1W1.
..1Unynn1g1.
.1UUnnnnnn1.
.1Unnnynnn1.
`;
const K_BODY_NOARM = `
..1Unnnnn1..
.1UUnynnnn1.
.1s1Unnnn1..
..1Unynn1...
.1UUnnnnnn1.
.1Unnnynnn1.
`;
/** Bandaged arm thrust forward while running (runes i). */
const K_ARM_OUT = `
.11111.
1nWiWW1
.11111.
`;
/** Bandaged arm thrust straight up (cast): fist above the head, runes lit i/j. Interior; outlined. */
const K_ARM_UP = [
  `
WWW.
WiW.
gWW.
.Wi.
.WW.
.nn.
.nn.
nn..
`,
  `
WjW.
jWj.
gWW.
.Wj.
.Wi.
.nn.
.nn.
nn..
`,
];
/** Mr. Toasty: o/O/y salamander (3x2 body + head) with a 0 eye. */
const TOASTY = `
..oo0
OooyO
`;
const TOASTY_FLICK = `
O.oo0
.ooyO
`;
const TOASTY_FIRE = `
..oo0oy
OooyO.z
`;

function rim(c: Pix, art: string, x: number, y: number): void {
  c.put(Pix.of(art, "kuro part"), x, y, { outline: "1" });
}

const KURO: HeroDef = {
  id: "kuro",
  head: K_HEAD,
  headX: 4,
  headY: -1,
  faces: { blink: K_FACE_BLINK, hurt: K_FACE_HURT, cast: K_FACE_CAST },
  legPal: { N: "n", n: "2", S: "n", s: "2", F: "H", f: "d", G: "d", g: "1" },
  back(c, p, { hx, hy, bx, by }) {
    // cape: the widest shape, flaring behind
    if (p.anim === "run") rim(c, K_CAPE_RUN[p.i % 2], bx - 8, 12 + by);
    else if (p.anim === "idle") rim(c, K_CAPE_IDLE[p.i === 1 || p.i === 2 ? 1 : 0], bx - 6, 10 + by);
    else if (p.anim === "hurt") rim(c, bend(K_CAPE_IDLE[1], 6, 1, 9, 2).str(), bx - 8, 10 + by);
    else rim(c, K_CAPE_CAST, bx - 8, 11 + by + p.i);
    rim(c, K_COLLAR_L, hx + 2, hy + 11);
    rim(c, K_COLLAR_R, hx + 13, hy + 11);
  },
  body(c, p, { bx, by }) {
    c.put(p.anim === "cast" ? K_BODY_NOARM : K_BODY, bx, 14 + by);
    // rune blink on idle f2
    if (p.anim === "idle" && p.i === 2) c.set(bx + 9, 17 + by, "i");
  },
  front(c, p, { hx, hy, bx, by }) {
    if (p.anim === "run") c.put(K_ARM_OUT, bx + 9, 15 + by);
    if (p.anim === "cast") {
      const ax = bx + 12;
      const ay = 5 + by - p.i;
      rim(c, K_ARM_UP[p.i], ax, ay);
      // abyssal glow around the fist
      c.set(ax, ay - 1, "j").set(ax + 4, ay, "j").set(ax + 2, ay - 2, p.i ? "w" : "j");
      if (p.i === 1) c.set(ax - 1, ay + 1, "i").set(ax + 5, ay + 2, "i");
    }
    // Mr. Toasty on the left shoulder
    const tx = bx - 1;
    const ty = 12 + by;
    if (p.anim === "cast") rim(c, TOASTY_FIRE, tx, ty);
    else if (p.anim === "idle" && p.i === 2) rim(c, TOASTY_FLICK, tx, ty);
    else if (p.anim === "hurt") rim(c, TOASTY, tx - 1, ty - 2);
    else rim(c, TOASTY, tx, ty);
    if (p.anim === "cast") {
      if (p.i === 1) c.put(SPARKLE, hx - 3, hy + 1);
      else c.put(SPARK_S, hx - 2, hy + 2);
    }
  },
};

// ============================================================================ portrait

const KH: StrandKeys = { base: "2", shade: "x", light: "f", deep: "X" };
const KH_RED: StrandKeys = { base: "r", shade: "R", light: "o", deep: "R" };
/** "Dark sparkles": the chuuni's own black-violet glitter. */
const DARK_TW = TWINKLE.replace(/w/g, "I").replace(/z/g, "2");
const DARK_TW_S = TWINKLE_S.replace(/w/g, "I").replace(/z/g, "2");

/** Hand-drawn 5-point star (slightly crooked, as drawn in marker by a 14-year-old). */
const STAR_DOODLE = `
...y...
...yy..
yyyyyyy
.yyyyy.
.yy.yy.
y.....y
`;

const KURO_P: PortraitDef = {
  hairLine: "X",
  shine: { key: "f", core: "j", on: ["2", "x", "X", "f"], x0: 18, x1: 46 },
  back(p) {
    // high cape collar behind the head (outside 0/2, crimson lining)
    layer(p, (l) => {
      l.poly([[6, 64], [4, 30], [12, 36], [16, 52]], "2");
      l.poly([[58, 64], [62, 28], [52, 36], [50, 52]], "2");
      l.poly([[8, 60], [6, 34], [13, 39], [16, 54]], "R");
      l.poly([[57, 60], [60, 32], [53, 39], [51, 54]], "R");
      l.each((x, y, k) => (k === "R" && x > 10 && x < 54 ? "r" : null));
    });
    // spiky back hair (sweeps up and back)
    layer(p, (l) => {
      l.ellipse(33, 27, 21, 20, "x");
      strand(l, [[16, 22], [2, 14]], 10, 1, KH);
      strand(l, [[14, 32], [0, 30]], 9, 1, KH);
      strand(l, [[16, 40], [4, 46]], 8, 1, KH);
      strand(l, [[50, 18], [62, 14]], 8, 1, KH, { shadeAt: 0.0 });
      strand(l, [[52, 30], [63, 34]], 7, 1, KH, { shadeAt: 0.0 });
    }, "X");
  },
  body(p) {
    // navy gakuran shoulders under a black cape
    layer(p, (l) => {
      l.poly([[2, 64], [8, 55], [20, 51], [44, 51], [56, 55], [62, 64]], "n");
      l.each((x, y, k) => (k === "n" && x < 18 + (y - 52) * 0.4 ? "U" : null));
      l.poly([[2, 64], [6, 56], [16, 53], [14, 64]], "2");
      l.poly([[62, 64], [58, 56], [48, 53], [50, 64]], "2");
      // gold buttons
      l.set(33, 58, "y").set(33, 62, "y");
    });
  },
  expr(p, f) {
    const iris: Iris = { D: "R", M: "r", L: "o", K: "0" };
    // eyepatch over the near eye: glossy black with a marker-drawn star
    layer(p, (l) => {
      l.ellipse(25.5, 30.5, 7.5, 7, "0");
      l.set(21, 26, "2").set(22, 25, "2").set(23, 25, "2").set(20, 27, "2");
    });
    p.put(STAR_DOODLE, 23, 27);
    // strap: up-left over the temple and up-right across the brow
    p.line(18, 26, 13, 20, "0").line(31, 25, 37, 19, "0");
    if (f === 0) {
      eye(p, lidded(EYE_FAR, 4), FAR_X, EYE_Y, iris);
      // smug lopsided smirk
      p.line(37, 45, 41, 46, "1").line(42, 45, 44, 43, "1").set(41, 47, "k");
    } else {
      eye(p, fierce(EYE_FAR, false, 4), FAR_X, EYE_Y, iris, (e) => e.set(6, 11, "w"));
      p.put(
        `
.1111111.
1wwwwwww1
100000001
10RRRRR01
10RqqqR01
.1RRRRR1.
..11111..
`,
        35,
        42,
      );
    }
    // band-aid on the cheek (tilted, slightly crooked)
    layer(p, (l) => {
      l.poly([[42, 41], [50, 38], [51, 41], [43, 44]], "W");
      l.set(46, 40, "q").set(47, 40, "q").set(46, 41, "q").set(47, 41, "q");
      l.set(43, 42, "g").set(49, 39, "g");
    });
    blush(p, 19, 41, 3);
  },
  crown(l) {
    l.ellipse(33, 18, 21, 15, "2");
    l.each((x, y, k) => (y > 12 ? "." : x > 44 && k === "2" ? "x" : null));
  },
  bangs(l, f) {
    const h = KH;
    // crown spikes, up and back
    strand(l, [[24, 10], [16, 0]], 9, 1, h);
    strand(l, [[32, 8], [30, -2]], 9, 1, h);
    strand(l, [[40, 8], [46, -1]], 8, 1, h);
    // the ONE crimson streak
    strand(l, [[29, 9], [24, 1]], 4, 1, KH_RED);
    // spiky fringe; the long lock hangs over the near eye
    strand(l, [[16, 14], [12, 28], [14, 40]], 8, 1, h);
    strand(l, [[21, 10], [20, 20], [23, 30]], 9, 1, h);
    strand(l, [[27, 9], [28, 18], [30, 23]], 8, 1, h);
    strand(l, [[33, 8], [35, 16], [37, 21]], 8, 1, h);
    strand(l, [[39, 8], [42, 16], [43, 22]], 8, 1, h);
    strand(l, [[45, 10], [48, 17], [50, 23]], 7, 1, h);
    strand(l, [[49, 13], [53, 24], [53, 36]], 6, 1, h, { shadeAt: 0.0 });
    if (f === 1) strand(l, [[12, 20], [4, 22]], 5, 1, h);
  },
  extras(p, f) {
    // HIGH collar up to the nose: cape collar points rising in front of the jaw, three belts (overdrawn)
    layer(p, (l) => {
      l.poly([[12, 64], [10, 40], [20, 44], [30, 52], [34, 64]], "2");
      l.poly([[58, 64], [56, 38], [48, 44], [42, 52], [38, 64]], "2");
      l.each((x, y, k) => (k === "2" && ((x < 14 && y < 50) || (x > 53 && y < 48)) ? "R" : null));
      l.each((x, y, k) => (k === "2" && x < 18 && y > 44 ? "x" : null));
      for (const by of [50, 55, 60]) {
        for (let x = 10; x < 58; x++) if (l.get(x, by) === "2" || l.get(x, by) === "x") l.set(x, by, "G");
      }
      l.rect(25, 49, 3, 3, "y").set(26, 50, "2");
      l.rect(45, 54, 3, 3, "y").set(46, 55, "2");
      l.rect(24, 59, 3, 3, "y").set(25, 60, "2");
    });
    if (f === 0) {
      // cool pose: bandaged hand over the sealed side, two fingers framing the eyepatch
      const SK: StrandKeys = { base: "s", shade: "k", light: "t" };
      layer(p, (l) => {
        // wrist + palm, bandaged
        l.poly([[0, 64], [2, 52], [12, 44], [30, 42], [32, 50], [22, 58], [12, 64]], "W");
        // clean diagonal bandage wraps + shading away from the light
        l.each((x, y, k) => (k === "W" && (x - y + 64) % 5 === 0 ? "g" : null));
        l.each((x, y, k) => (k === "W" && (x > 27 || y > 60) ? "g" : null));
        l.each((x, y, k) => (k === "W" && x + y < 54 ? "w" : null));
        // curled ring + little finger knuckles
        l.ellipse(27, 44, 3, 2.5, "s");
        l.ellipse(23, 46, 3, 2.5, "s");
        l.set(26, 43, "t").set(22, 45, "t").set(28, 46, "k").set(24, 48, "k");
        // rune pixels on the bandage
        l.set(9, 54, "i").set(14, 51, "i").set(18, 55, "I").set(6, 59, "i");
      });
      layer(p, (l) => {
        strand(l, [[15, 45], [13, 33], [12, 22]], 5, 4, SK); // index, left of the patch
        strand(l, [[21, 44], [28, 33], [34, 24]], 5, 4, SK); // middle, right of the patch
        l.set(12, 21, "t").set(13, 21, "t").set(34, 23, "t").set(33, 23, "t");
        // bandage wraps at the finger bases
        l.rect(12, 38, 5, 2, "W");
        l.line(22, 40, 26, 37, "W").line(23, 41, 27, 38, "W");
      });
      p.put(DARK_TW, 52, 4);
      p.put(DARK_TW_S, 57, 26);
      p.put(DARK_TW_S, 2, 30);
    } else {
      // glowing bandaged fist thrust at the viewer
      layer(p, (l) => {
        l.ellipse(15, 53, 15, 13, "i");
        l.ellipse(15, 53, 13, 11, "j");
      }, null);
      layer(p, (l) => {
        l.rect(4, 48, 22, 13, "W");
        for (let i = 0; i < 4; i++) l.ellipse(7 + i * 5.3, 48, 2.8, 3.2, "W");
        // knuckle highlights + gaps
        for (let i = 0; i < 4; i++) {
          const kx = Math.round(7 + i * 5.3);
          l.set(kx - 1, 46, "w").set(kx, 46, "w");
          if (i < 3) l.line(kx + 3, 46, kx + 3, 50, "g");
        }
        l.line(5, 53, 24, 53, "g");
        // thumb wrapped across the front (bare skin tip)
        l.ellipse(11, 57, 7, 2.6, "s");
        l.set(6, 56, "t").set(7, 56, "t").set(14, 59, "k").set(12, 59, "k").set(17, 57, "k");
        // wrist bandage + glowing runes
        l.rect(6, 61, 18, 3, "W");
        l.line(8, 61, 10, 63, "g").line(14, 61, 16, 63, "g").line(20, 61, 22, 63, "g");
        l.set(20, 50, "i").set(9, 51, "I").set(15, 55, "i").set(22, 56, "j");
      });
      // Mr. Toasty on the far shoulder, also shouting (a chubby salamander, NOT a dragon)
      const TK: StrandKeys = { base: "o", shade: "O", light: "y", deep: "O" };
      layer(p, (l) => {
        strand(l, [[50, 54], [45, 57], [42, 55], [41, 52]], 4, 1, TK); // curly tail
        l.ellipse(53, 53, 6, 3.4, (x, y) => (y > 54 ? "O" : y < 52 && x < 54 ? "y" : "o"));
        l.ellipse(59, 50.5, 4, 3.4, (x, y) => (y > 52 ? "O" : y < 50 && x < 60 ? "y" : "o"));
        // stubby legs
        l.set(49, 57, "O").set(50, 57, "O").set(55, 57, "O").set(56, 57, "O");
      });
      layer(p, (l) => {
        // little stubby wing
        l.poly([[51, 50], [54, 46], [56, 50]], "O");
        l.set(53, 48, "o");
      });
      // eye + shouting mouth
      p.set(59, 49, "0").set(59, 48, "w");
      p.set(62, 51, "0").set(63, 51, "0").set(62, 52, "R").set(63, 52, "0").set(62, 50, "1").set(63, 53, "1");
      p.set(52, 54, "y").set(54, 54, "y");
      // sparkles around the fist
      p.put(TWINKLE_S, 28, 44);
      p.put(TWINKLE_S, 2, 40);
      p.put(DARK_TW, 50, 2);
      p.put(DARK_TW, 2, 4);
      p.put(DARK_TW_S, 57, 30);
    }
  },
};

// ============================================================================ ult reveal prop

/**
 * "...it's a large shadow." The tiny yellow flashlight (on its side, pointing
 * right) that made the ETERNAL ABYSS. Light cone is semi-transparent.
 */
function flashlight(): Pix {
  const p = new Pix(12, 12);
  // light cone (unoutlined, soft)
  p.poly([[8, 5], [12, 1], [12, 11], [8, 7]], "L");
  p.poly([[8, 5.5], [12, 3.5], [12, 8.5], [8, 6.5]], "M");
  const body = new Pix(12, 12);
  body.rect(1, 5, 5, 3, "y");
  body.rect(1, 5, 5, 1, "z");
  body.rect(1, 7, 5, 1, "Y");
  body.set(3, 5, "r").set(4, 5, "r"); // switch
  body.rect(6, 4, 2, 5, "W");
  body.set(6, 4, "w").set(7, 8, "g").set(6, 8, "g");
  body.outline("1");
  p.put(body, 0, 0);
  p.set(8, 5, "z").set(8, 6, "z").set(8, 7, "z");
  return p;
}

export const sprites: SpriteDef[] = [
  ...heroSprites(KURO),
  gridSprite("ult_flashlight", 12, 12, [flashlight()], "center", { pal: { L: "#fff7b055", M: "#fff7b0aa" } }),
  gridSprite("portrait_kuro", 64, 64, [paintPortrait(KURO_P, 0), paintPortrait(KURO_P, 1)], "center"),
];
