/**
 * AKANE - Tsundere Drill Princess (owner: s2-heroes-a).
 * Hero set (24x24 idle/run/hurt/cast), bust portrait. The drills ARE the character.
 * Art direction: docs/content/heroes.md §2.7.
 */
import {
  Pix,
  gridSprite,
  heroSprites,
  SPARKLE,
  SPARK_S,
  strand,
  layer,
  eye,
  lidded,
  letter,
  paintPortrait,
  EYE_NEAR,
  EYE_FAR,
  NEAR_X,
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

// Interior-only head (auto-outlined). Hair R/r/o with z sheen, golden eyes Y/y/z + w,
// fierce lids, permanent blush.
const K_HEAD_IN = `
................
......yyoo......
....yyzyoooo....
...yzyyoooooR...
..yzyoooooooRR..
..yyoRooooRooR..
..ooRRsoRsoRsR..
..ooR111ss1111..
..ooRsswYsswYs..
..ooRssYyssYys..
..ooRssyzssyzs..
..oRRkbbss1bbb..
...RR1ssssssk...
................
`;
const AK_HEAD = Pix.of(K_HEAD_IN, "akane head").outline("1").str();
const AK_FACE_BLINK = `
................
................
................
................
................
................
................
.....sssssssss..
.....sssssssss..
.....s11sss11s..
.....ss11ssss1..
`;
/** "Hmph": looks away (irises slide to the far corner, lids lowered), pout. */
const AK_FACE_AWAY = `
................
................
................
................
................
................
................
.....1111s11111.
.....ssYwssYsw..
.....ssyYssyYs..
.....sssssssss..
.....kbbbs1bbb..
`;
const AK_FACE_HURT = `
................
................
................
................
................
................
................
.....s1ssss1ss..
.....ss11s11ss..
.....s1ssss1ss..
.....sssssssss..
.....kbbs11bbb..
.........RR.....
`;
/** Cast: fierce shout, mouth wide. */
const AK_FACE_CAST = `
................
................
................
................
................
................
................
.....11sss1111..
.....s11ssswYs..
.....sswYssYys..
.....ssYyssyzs..
.....kbbs00bbb..
........1RR1....
`;

/** One spiral drill: three coils, each lit top-left with a z spiral highlight. Interior; outlined. */
const DRILL = `
.yzyo.
zyyooR
yoooRR
.RRRR.
.zyoo.
zyooRR
.ooRR.
..RR..
.zyo.
.yoR.
..oR.
..R..
`;
/** Drill stretched 1px ("uncoiled", hurt). */
const DRILL_LONG = `
.yzyo.
zyyooR
yoooRR
.RRRR.
.zyoo.
zyooRR
.ooRR.
..RR..
.zyo.
.yoR.
..oR.
..oR.
..R..
`;
const BOW = `
RR...RR
RrR.RrR
RrrRrrR
RRRrRRR
.R.R.R.
`;

/** Raised harisen (cast): big wedge, pleats radiating up from the taped handle. */
const HARISEN_UP = `
wwGWGWG
wwGWGWG
.wGWGW.
..GWG..
...W...
...d...
`;
const AK_BODY = `
..1nwwwn1...
.1nnwRrwnn1.
.1WsWWWWsW1.
..1WWWrWW1..
.1rRrRrRrR1.
.1RrRrRrRrR1
`;
const AK_BODY_NOARMS = `
..1nwwwn1...
.1nnwRrwnn1.
.1s1wWrW1s1.
..1WWWrW1...
.1rRrRrRrR1.
.1RrRrRrRrR1
`;
/** White paper harisen: pleats W/g with G fold lines, wide end up. Interior; outlined. */
const HARISEN = `
wGWGW
wGWGW
.GWG.
..W..
..d..
`;
const HARISEN_FWD = `
...ww.
.wwWWW
dGGGGG
.WWWWW
...WW.
`;

function drill(c: Pix, x: number, y: number, flip: boolean, sway: (y: number) => number, long = false): void {
  const d = Pix.of(long ? DRILL_LONG : DRILL, "drill");
  const w = new Pix(d.w + 4, d.h);
  for (let yy = 0; yy < d.h; yy++)
    for (let xx = 0; xx < d.w; xx++) {
      const k = d.get(xx, yy);
      if (k !== ".") w.set(xx + 2 + Math.round(sway(yy)), yy, k);
    }
  c.put(flip ? w.flipX() : w, x - 2, y, { outline: "1" });
}

const AKANE: HeroDef = {
  id: "akane",
  head: AK_HEAD,
  headX: 4,
  headY: 0,
  faces: { blink: AK_FACE_BLINK, hurt: AK_FACE_HURT, cast: AK_FACE_CAST },
  faceFor(p) {
    return p.anim === "idle" && p.i === 2 ? AK_FACE_AWAY : null;
  },
  legPal: { N: "s", n: "k", S: "W", s: "g", F: "d", f: "1", G: "1", g: "0" },
  back(c, p, { hx, hy }) {
    // drills: spring 1px out of phase in idle, swing behind like pendulums when running
    if (p.anim === "idle") {
      const a = p.i === 1 ? 1 : 0;
      const b = p.i === 3 ? 1 : 0;
      drill(c, hx - 4, hy + 5 + a, false, () => 0);
      drill(c, hx + 14, hy + 5 + b, true, () => 0);
    } else if (p.anim === "run") {
      const ph = [0, -1, -2, -1, 0, 1][p.i];
      drill(c, hx - 4, hy + 5, false, (y) => (y < 4 ? 0 : y < 8 ? -1 + Math.min(0, ph) : -2 + ph));
      drill(c, hx + 14, hy + 5, true, (y) => (y < 4 ? 0 : y < 8 ? 1 : 2 - ph));
    } else if (p.anim === "hurt") {
      drill(c, hx - 5, hy + 5, false, (y) => (y < 6 ? 0 : -1), true);
      drill(c, hx + 15, hy + 5, true, (y) => (y < 6 ? 0 : -1), true);
    } else {
      drill(c, hx - 5, hy + 4 - p.i, false, (y) => (y < 5 ? 0 : -1));
      drill(c, hx + 15, hy + 4 - p.i, true, (y) => (y < 5 ? 0 : -1));
    }
  },
  body(c, p, { bx, by }) {
    c.put(p.anim === "idle" ? AK_BODY : AK_BODY_NOARMS, bx, 14 + by);
  },
  front(c, p, { hx, hy, bx, by }) {
    c.put(Pix.of(BOW), hx + 4, hy - 1, { outline: "1" });
    if (p.anim === "idle") {
      c.put(Pix.of(HARISEN), bx + 10, 16 + by, { outline: "1" });
    } else if (p.anim === "run") {
      c.put(Pix.of(HARISEN_FWD), bx + 11, 15 + by, { outline: "1" });
    } else if (p.anim === "hurt") {
      c.put(Pix.of(HARISEN), bx + 11, 14 + by, { outline: "1" });
    } else {
      // harisen raised high in both hands, wide end up
      c.put(Pix.of(HARISEN_UP), hx + 13, hy - p.i, { outline: "1" });
      c.put(Pix.of("s.\n.s"), hx + 15, hy + 6 - p.i, { outline: "1" });
      if (p.i === 1) {
        c.put(SPARKLE, hx + 10, hy + 1);
        c.set(hx + 21, hy + 1, "w").set(hx + 21, hy + 3, "w");
      } else c.put(SPARK_S, hx + 11, hy + 2);
    }
  },
};

// ============================================================================ portrait

const AKH: StrandKeys = { base: "o", shade: "O", light: "y", deep: "R" };
/**
 * A giant spiral drill: coils drawn bottom-up, each its own outlined band so the
 * spiral reads; light from the top-left (y/z rim on the upper-left of each coil,
 * O/R shadow on the lower-right and under each coil).
 */
function bigDrill(p: Pix, cx: number, y0: number, w0: number, coils: number, step: number, lean: number): void {
  for (let i = coils - 1; i >= 0; i--) {
    const w = Math.max(2.5, w0 * (1 - i / (coils + 0.6)));
    const cy = y0 + i * step;
    const x = cx + i * lean;
    const rh = step * 0.72;
    layer(p, (l) => {
      l.ellipse(x, cy, w, rh, (px, py) => {
        const nx = (px - x) / w;
        const ny = (py - cy) / rh;
        if (ny > 0.45 + nx * 0.25) return nx > 0.1 ? "R" : "O";
        if (nx + ny * 0.8 < -0.75) return "z";
        if (nx + ny * 0.8 < -0.35) return "y";
        if (nx + ny * 0.6 > 0.55) return "O";
        return "o";
      });
    }, "R");
    // the coil's tip on the last one
    if (i === coils - 1) {
      layer(p, (l) => l.poly([[x - 2, cy + rh - 1], [x + 3, cy + rh - 1], [x + 1, cy + rh + 4]], "O"), "R");
    }
  }
}

/** Side-glance: slide the iris to the far (right) corner, leaving white on the near side. */
function sideGlance(e: Pix): void {
  const out = e.clone();
  for (let y = 0; y < e.h; y++)
    for (let x = 0; x < e.w; x++) {
      const k = e.get(x, y);
      if (!"DMLKwa".includes(k)) continue;
      const src = e.get(x - 2, y);
      out.set(x, y, "DMLKwa".includes(src) ? src : "W");
    }
  e.d = out.d;
}

/** The harisen swinging at the viewer: a big pleated paper sector from the bottom-right corner. */
function bakaFan(l: Pix): void {
  const ox = 66;
  const oy = 66;
  for (let y = 26; y < 64; y++)
    for (let x = 30; x < 64; x++) {
      const dx = x - ox;
      const dy = y - oy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx); // ~ -PI..-PI/2 for up-left
      if (r > 34 || r < 6) continue;
      if (a < -2.95 || a > -1.75) continue;
      const pleat = Math.floor((a + 3) / 0.13);
      let k = pleat % 2 ? "W" : "w";
      if (r > 31) k = "g";
      if (pleat % 2 && r > 20 && (x + y) % 9 === 0) k = "g";
      l.set(x, y, k);
    }
  // taped handle
  l.poly([[58, 64], [64, 58], [64, 64]], "d");
}

const BAKA_FAN = `
..........1111111.
.......111wwWWWWg1
.....11wwwWWWWWgG1
...11wwwGWWWWgGG1.
..1wwwGWWWWWgGG1..
.1wwGWWWWWgGGG1...
1wGWWWWWgGGG11....
1GWWWWgGGG11......
1WWWgGG111........
.1gG111...........
..1d1.............
...1..............
`;

const AKANE_P: PortraitDef = {
  hairLine: "R",
  shine: { key: "y", core: "z", on: ["o", "O", "R", "y"] },
  back(p) {
    // the drills: far too big for the frame (that's the joke)
    bigDrill(p, 5, 12, 9, 7, 8, 0);
    bigDrill(p, 59, 12, 9, 7, 8, 0);
    // back hair
    layer(p, (l) => {
      l.ellipse(33, 27, 21, 20, "O");
      l.poly([[13, 30], [53, 30], [52, 48], [14, 48]], "O");
      l.each((x, y, k) => (k === "O" && x > 48 ? "R" : null));
    });
  },
  body(p, f) {
    layer(p, (l) => {
      // white sailor top, navy sailor collar with a white stripe, red scarf
      l.poly([[8, 64], [12, 55], [20, 51], [44, 51], [52, 55], [56, 64]], "w");
      l.each((x, y, k) => (k === "w" && x > 44 ? "W" : null));
      l.poly([[14, 56], [22, 51], [33, 60], [44, 51], [50, 56], [44, 64], [22, 64]], "n");
      l.line(17, 57, 23, 53, "w").line(43, 53, 48, 57, "W");
      l.poly([[29, 56], [37, 56], [35, 60], [31, 60]], "r");
      l.poly([[31, 60], [35, 60], [37, 64], [29, 64]], "R");
      l.set(31, 57, "q");
    });
    if (f === 0) {
      // arms crossed (the universal tsundere pose)
      layer(p, (l) => {
        l.poly([[12, 54], [40, 57], [39, 63], [10, 61]], "w");
        l.poly([[26, 56], [54, 53], [55, 59], [27, 63]], "W");
        l.ellipse(41, 59, 3, 2.5, "s");
        l.ellipse(23, 58, 3, 2.5, "s");
        l.line(36, 55, 36, 62, "n").line(28, 56, 28, 62, "n");
      });
    }
  },
  expr(p, f) {
    const iris: Iris = { D: "O", M: "Y", L: "y", K: "R" };
    if (f === 0) {
      // looking away to the right, half-lidded, pout
      eye(p, lidded(EYE_NEAR, 4), NEAR_X, EYE_Y, iris, sideGlance);
      eye(p, lidded(EYE_FAR, 4), FAR_X, EYE_Y, iris, sideGlance);
      p.put(
        `
..111.
.1RR1.
..11..
`,
        39,
        44,
      );
      // 3-stroke blush
      for (const [x, y] of [[19, 40], [22, 40], [25, 40], [45, 40], [48, 40]] as [number, number][]) p.line(x, y + 2, x + 2, y, "b");
    } else {
      // >< triangle eyes squeezed shut, mouth wide on "BAKA", cheeks fully red
      layer(p, (l) => {
        l.poly([[21, 27], [31, 32], [21, 37]], "0");
        l.poly([[47, 27], [38, 32], [47, 37]], "0");
      }, null);
      p.put(
        `
..11111111..
.1wwwwwwww1.
10000000001.
10RRRRRRR01.
10RRqqqqR01.
.10RRRRR01..
..1111111...
`,
        33,
        42,
      );
      layer(p, (l) => {
        l.ellipse(23, 42, 6, 3, "b");
        l.ellipse(47, 42, 4, 3, "b");
      }, null);
      for (const [x, y] of [[19, 40], [22, 40], [25, 40], [45, 40], [48, 40]] as [number, number][]) p.line(x, y + 2, x + 2, y, "P");
    }
    p.set(46, 38, "k").set(46, 39, "k");
  },
  crown(l) {
    l.ellipse(33, 18, 21, 15, "o");
    l.each((x, y, k) => (y > 12 ? "." : x > 44 && k === "o" ? "O" : null));
  },
  bangs(l) {
    const h = AKH;
    strand(l, [[16, 13], [12, 26], [13, 40]], 8, 2, h);
    strand(l, [[49, 12], [54, 25], [53, 38]], 7, 2, h, { shadeAt: 0.0 });
    // swept, pointy princess fringe
    strand(l, [[20, 8], [18, 16], [21, 23]], 9, 1, h);
    strand(l, [[25, 7], [25, 16], [28, 22]], 9, 1, h);
    strand(l, [[30, 6], [32, 15], [34, 21]], 9, 1, h);
    strand(l, [[36, 6], [38, 14], [41, 20]], 8, 1, h);
    strand(l, [[41, 7], [44, 15], [46, 22]], 8, 1, h);
    strand(l, [[46, 9], [49, 16], [50, 22]], 7, 1, h);
  },
  extras(p, f) {
    // pointed brows, drawn over the fringe (anime law)
    if (f === 0) {
      p.line(20, 20, 30, 23, "1").line(21, 21, 30, 24, "1");
      p.line(39, 23, 48, 19, "1").line(39, 24, 48, 20, "1");
    } else {
      p.line(19, 19, 30, 25, "1").line(20, 20, 30, 26, "1");
      p.line(38, 25, 49, 18, "1").line(38, 26, 49, 19, "1");
    }
    // big red bow
    // big red bow: two rounded loops, fold lines into the knot, short tails
    layer(p, (l) => {
      l.poly([[31, 9], [23, 13], [21, 9], [24, 3]], "R");
      l.poly([[35, 9], [43, 13], [45, 9], [42, 3]], "R");
      l.poly([[31, 7], [22, 0], [17, 3], [18, 10], [26, 11]], "r");
      l.poly([[35, 7], [44, 0], [49, 3], [48, 10], [40, 11]], "r");
      l.each((x, y, k) => (k === "r" && x > 38 && y > 4 ? "R" : null));
      l.line(19, 3, 23, 2, "q").line(18, 5, 20, 4, "q");
      l.line(22, 5, 29, 7, "R").line(21, 8, 28, 8, "R");
      l.line(44, 5, 37, 7, "Q").line(45, 8, 38, 8, "Q");
      l.ellipse(33, 7.5, 3, 3, "r");
      l.set(32, 6, "q").set(33, 6, "q").set(34, 9, "R");
    });
    if (f === 0) {
      // "hmph" puff
      // "hmph" puff: a little trail of steam clouds leaving the pout
      layer(p, (l) => {
        l.ellipse(47.5, 47, 1.6, 1.4, "w");
        l.ellipse(51, 45.5, 2.2, 2, "w");
        l.ellipse(55.5, 44, 3, 2.7, "w");
        l.set(57, 45, "W").set(56, 46, "W").set(52, 46, "W");
      });
    } else {
      // the harisen swinging AT the viewer + lettering
      layer(p, (l) => bakaFan(l));
      // swing streaks
      p.line(28, 30, 33, 26, "w").line(26, 36, 31, 33, "w").line(31, 24, 35, 21, "w");
      letter(p, "BAKA!", 3, 2, "r", "w");
    }
  },
};

export const sprites: SpriteDef[] = [
  ...heroSprites(AKANE),
  gridSprite("portrait_akane", 64, 64, [paintPortrait(AKANE_P, 0), paintPortrait(AKANE_P, 1)], "center"),
];
