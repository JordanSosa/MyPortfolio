/**
 * PUDDING - Maid Cafe Ace (owner: s2-heroes-a).
 * Hero set (24x24 idle/run/hurt/cast), bust portrait, and the omurice ult actor.
 * Art direction: docs/content/heroes.md §2.5.
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
  blush,
  heartShine,
  sparkly,
  letter,
  inHeart,
  paintPortrait,
  EYE_NEAR,
  EYE_FAR,
  EYE_ARC,
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

// Interior-only head (auto-outlined). Honey hair F/B/Y in two round buns, a lace
// headdress w/W/g sitting on the crown between them, caramel eyes d/H/h + w.
const P_HEAD_IN = `
....................
........w.w.w.......
.......wWgWgWw......
..BB..wWWWWWWWw.BB..
.BFBBpFBFFFFFFFpBFY.
.FBFFpBFFFFFFFFpFFY.
..FFYYBFFFFFFFFYYY..
....FFYFsFFsFYsY....
....FFYs111ss111....
....FFYsswOsswOs....
....FFYssOossOos....
....FFYssohssohs....
....FYYkbbssRsbb....
.....YY1ssssssk.....
....................
`;
const P_HEAD = Pix.of(P_HEAD_IN, "pudding head").outline("1").str();
const P_FACE_BLINK = `
....................
....................
....................
....................
....................
....................
....................
....................
........sss..sss....
........sss..sss....
........111..111....
....................
`;
/** Hurt: >< eyes, wobbly mouth. */
const P_FACE_HURT = `
....................
....................
....................
....................
....................
....................
....................
....................
.......s1ssss1ss....
.......ss11s11ss....
.......s1ssss1ss....
.......sssssssss....
.......kbss11sbb....
...........RR.......
`;
/** Cast: closed-eye service smile ^^ + open mouth. */
const P_FACE_CAST = `
....................
....................
....................
....................
....................
....................
....................
....................
.......sssssssss....
.......s1s1ss1s1....
.......1sss11sss1...
.......sssssssss....
.......kbbs00sbb....
...........RR.......
`;

/** Black dress (2/x, G sheen), puffy sleeves, white apron with a pink heart pocket, frilly hem. */
const P_BODY = `
..12WwW21...
.1G22ww221..
.1s12wwW1s1.
..12wwwW21..
.12wwpwWW21.
1WwWwWwWwWW1
`;
const P_BODY_TRAY = `
..12WwW21...
.1G22ww2221.
.1s12wwW21..
..12wwwW21..
.12wwpwWW21.
1WwWwWwWwWW1
`;
const P_LEGPAL = { N: "W", n: "g", S: "W", s: "g", F: "2", f: "x", G: "x", g: "X" };

/** Pudding on the tray (interior, auto-outlined). f = wobble frames. */
const PUD = [
  `
..dHd..
..yyY..
.yyyYY.
`,
  `
.......
.ddHdd.
.yyyYY.
`,
  `
..dHd..
..yyY..
..yyY..
`,
];
const TRAY = `wWWWWWg`;

function trayWithPudding(c: Pix, x: number, y: number, wob: number, lift = 0): void {
  // tray: 7 wide, 1 tall (+ outline)
  c.put(Pix.of(TRAY), x, y, { outline: "1" });
  c.put(Pix.of(PUD[wob]), x, y - 3 - lift, { outline: "1" });
  // re-draw tray surface so the pudding outline sits on it
  if (!lift) c.put(Pix.of(TRAY), x, y);
}

const HEART = `
.p.p.
pqpPP
.pPP.
..P..
`;

const HEART_BIG = `
.pp.pp.
pqqppPP
pqwpPPP
.ppPPP.
..pPP..
`;

const PUDDING: HeroDef = {
  id: "pudding",
  head: P_HEAD,
  headX: 2,
  headY: -1,
  minBob: 0,
  faces: { blink: P_FACE_BLINK, hurt: P_FACE_HURT, cast: P_FACE_CAST },
  legPal: P_LEGPAL,
  back() {},
  body(c, p, { bx, by }) {
    c.put(p.anim === "idle" || p.anim === "run" ? P_BODY_TRAY : P_BODY, bx, 14 + by);
    // skirt bounce: the frilly hem flares out on the airborne run frames
    if (p.anim === "run" && p.bob < 0) c.put("1WwWwWwWwWwWW1\n.11111111111.", bx - 1, 19 + by);
    else if (p.anim === "run" && p.bob === 0) c.put("1WwWwWwWwWW1", bx, 19 + by);
  },
  front(c, p, { hx, hy, bx, by }) {
    if (p.anim === "idle") {
      // tray held flat at shoulder height on the far hand; curtsy dip on f2
      const wob = p.i === 1 ? 1 : p.i === 3 ? 2 : 0;
      trayWithPudding(c, bx + 10, 14 + by, wob);
      c.set(bx + 12, 15 + by, "s").set(bx + 11, 15 + by, "1").set(bx + 13, 15 + by, "1").set(bx + 12, 16 + by, "1");
    } else if (p.anim === "run") {
      // the tray stays perfectly level (she is a professional) - the pudding jiggles
      const wob = [0, 1, 0, 2, 1, 0][p.i];
      trayWithPudding(c, bx + 10, 14, wob);
      c.set(bx + 12, 15, "s").set(bx + 11, 15, "1").set(bx + 13, 15, "1").set(bx + 12, 16, "1");
    } else if (p.anim === "hurt") {
      // tray knocked askew, the pudding flies 2px off it
      const t = new Pix(9, 5);
      t.line(0, 3, 7, 0, "W").line(0, 4, 7, 1, "g");
      t.set(0, 3, "w").set(1, 3, "w").set(2, 2, "w").set(7, 1, "G");
      c.put(t, bx + 9, 13 + by, { outline: "1" });
      c.put(Pix.of(PUD[2]), bx + 11, 7 + by, { outline: "1" });
      c.set(bx + 16, 9 + by, "w").set(bx + 17, 8 + by, "w");
      c.set(bx + 10, 17 + by, "s");
    } else {
      // tray raised high on the far hand, a heart above it
      const tx = bx + 10;
      const ty = 10 + by;
      c.put(Pix.of("..s\n.s.\nW..\n2.."), tx + 1, ty + 1, { outline: "1" });
      trayWithPudding(c, tx, ty, p.i === 1 ? 1 : 0);
      c.put(Pix.of(p.i === 1 ? HEART_BIG : HEART), tx + (p.i === 1 ? 0 : 1), p.i === 1 ? 0 : 1, { outline: "1" });
      if (p.i === 1) c.put(SPARKLE, hx - 2, hy + 4);
      else c.put(SPARK_S, hx - 1, hy + 5);
    }
  },
};

// ============================================================================ portrait

const PH: StrandKeys = { base: "F", shade: "Y", light: "B", deep: "O" };

/** A big round hair bun with a swirl, tied with a pink scrunchie. */
function bun(l: Pix, cx: number, cy: number, r: number, flip: boolean): void {
  l.ellipse(cx, cy, r, r * 0.92, "F");
  l.each((x, y, k) => {
    if (k !== "F") return null;
    const nx = (x - cx) / r;
    const ny = (y - cy) / r;
    if (nx + ny > 0.75) return "O";
    if (nx + ny > 0.25) return "Y";
    if (nx + ny < -0.9) return "B";
    return null;
  });
  // one clean swirl line (Y) with a light catch (z) on its upper-left turn
  let px = cx;
  let py = cy;
  for (let t = 0.6; t < 7.2; t += 0.35) {
    const rr = r * 0.11 * t;
    const a = t * 1.25 + (flip ? Math.PI : 0);
    const x = Math.round(cx + Math.cos(a) * rr);
    const y = Math.round(cy + Math.sin(a) * rr * 0.92);
    l.line(px, py, x, y, "Y");
    px = x;
    py = y;
  }
  l.set(Math.round(cx - r * 0.45), Math.round(cy - r * 0.45), "z");
}

/**
 * Heart hands (front view): curled fingers form the two lobes, the thumbs meet
 * at the point; the heart-shaped hole in the middle is real negative space.
 */
function heartHands(l: Pix, x0: number, y0: number): void {
  const W = 22;
  const H = 15;
  for (let y = y0; y < y0 + H + 6; y++)
    for (let x = x0 - 3; x < x0 + W + 3; x++) {
      const outer = inHeart(x, y, x0, y0, W, H);
      const inner = inHeart(x, y, x0 + 6, y0 + 4, W - 12, H - 8);
      if (outer && !inner) l.set(x, y, "s");
    }
  // wrists going down off the frame
  l.poly([[x0 - 1, y0 + 9], [x0 + 6, y0 + 15], [x0 + 3, y0 + 25], [x0 - 5, y0 + 25]], "s");
  l.poly([[x0 + W + 1, y0 + 9], [x0 + W - 6, y0 + 15], [x0 + W - 3, y0 + 25], [x0 + W + 5, y0 + 25]], "s");
  // light from the top-left, shade lower-right
  l.each((x, y, k) => {
    if (k !== "s") return null;
    const rx = x - x0;
    const ry = y - y0;
    if (ry < 3 && rx < W / 2 - 1) return "t";
    if (rx > W - 6 && ry > 4) return "k";
    if (ry > H - 3 && rx > W / 2) return "k";
    return null;
  });
  // finger creases over each lobe + the thumb seam at the point
  const crease = (x: number, y: number, dx: number, dy: number) => l.line(x, y, x + dx, y + dy, "k");
  crease(x0 + 3, y0 + 2, 2, 2);
  crease(x0 + 6, y0 + 1, 1, 2);
  crease(x0 + 1, y0 + 6, 3, 1);
  crease(x0 + W - 4, y0 + 2, -2, 2);
  crease(x0 + W - 7, y0 + 1, -1, 2);
  crease(x0 + W - 2, y0 + 6, -3, 1);
  l.line(x0 + W / 2, y0 + H - 6, x0 + W / 2, y0 + H - 1, "k");
}

const PUDDING_P: PortraitDef = {
  hairLine: "O",
  shine: { key: "B", core: "z", on: ["F", "Y", "O", "B"], y: 9 },
  tilt(f) {
    // f0: the professional service-smile head tilt (steps fall between the eyes)
    return f === 0 ? (x) => (x < 34 ? 0 : x < 50 ? 1 : 2) : null;
  },
  back(p) {
    // twin buns (behind the crown) with pink scrunchies
    layer(p, (l) => {
      bun(l, 11, 10, 9, false);
      bun(l, 54, 9, 8.5, true);
    });
    layer(p, (l) => {
      l.ellipse(17, 17, 4, 2.5, "p");
      l.ellipse(48, 16, 4, 2.5, "P");
      l.set(16, 16, "q").set(47, 15, "p");
    });
    // short back hair
    layer(p, (l) => {
      l.ellipse(33, 28, 21, 19, "Y");
      l.poly([[13, 30], [53, 30], [52, 50], [14, 50]], "Y");
      l.each((x, y, k) => (k === "Y" && x > 47 ? "O" : null));
    });
  },
  body(p, f) {
    layer(p, (l) => {
      // black dress + puffy sleeves
      l.poly([[2, 64], [6, 55], [18, 51], [46, 51], [58, 55], [62, 64]], "2");
      l.ellipse(9, 59, 8, 6, "2");
      l.ellipse(56, 59, 8, 6, "2");
      l.each((x, y, k) => (k === "2" && (x < 8 || (x < 14 && y < 58)) ? "G" : k === "2" && x > 54 ? "x" : null));
      // white apron bib + straps with frills
      l.poly([[22, 54], [44, 54], [42, 64], [24, 64]], "w");
      l.line(19, 52, 23, 64, "W").line(47, 52, 43, 64, "W");
      l.each((x, y, k) => (k === "w" && x > 38 ? "W" : null));
    });
    // frilly collar: scalloped white ruffle
    layer(p, (l) => {
      for (let i = 0; i < 6; i++) l.ellipse(23 + i * 4, 52, 2.6, 2.2, i % 2 ? "W" : "w");
      l.set(34, 54, "p").set(33, 53, "p").set(35, 53, "P");
    });
    // name badge "PUDDING" + heart
    layer(p, (l) => {
      l.rect(31, 56, 30, 8, "w");
      l.rect(31, 56, 30, 1, "q");
    });
    letter(p, "PUDDlNG", 34, 58, "P", "w");
    p.set(60, 59, "p").set(59, 58, "p").set(61, 58, "p").set(60, 60, "p").set(61, 59, "P");
  },
  expr(p, f) {
    const iris: Iris = { D: "O", M: "o", L: "h", K: "d" };
    if (f === 0) {
      eye(p, EYE_ARC, NEAR_X + 1, EYE_Y + 2, iris);
      eye(p, EYE_ARC, FAR_X, EYE_Y + 2, iris);
      // wide closed service smile
      p.put(
        `
1.......1
.1.....1.
..11111..
`,
        36,
        43,
      );
      blush(p, 19, 40, 4);
      blush(p, 46, 40, 2);
    } else {
      eye(p, EYE_NEAR, NEAR_X, EYE_Y, iris, heartShine);
      eye(p, EYE_FAR, FAR_X, EYE_Y, iris, heartShine);
      // "KYUN": small open mouth
      p.put(
        `
.1111.
100001
10RR01
.1qq1.
..11..
`,
        38,
        43,
      );
      blush(p, 18, 40, 5);
      blush(p, 45, 40, 3);
    }
    p.set(46, 39, "k").set(46, 40, "k");
  },
  crown(l) {
    l.ellipse(33, 18, 21, 15, "F");
    l.each((x, y, k) => (y > 12 ? "." : x > 44 && k === "F" ? "Y" : null));
  },
  bangs(l) {
    const h = PH;
    // soft side locks curling in at the jaw
    strand(l, [[16, 13], [11, 26], [12, 40], [16, 48]], 9, 3, h);
    strand(l, [[49, 12], [54, 25], [54, 38], [50, 46]], 8, 3, h, { shadeAt: 0.0 });
    // fluffy fringe
    strand(l, [[20, 8], [18, 17], [20, 23]], 9, 2, h);
    strand(l, [[25, 7], [24, 16], [26, 23]], 9, 2, h);
    strand(l, [[30, 6], [30, 15], [32, 22]], 9, 2, h);
    strand(l, [[35, 6], [36, 15], [36, 21]], 8, 2, h);
    strand(l, [[40, 7], [42, 15], [42, 22]], 9, 2, h);
    strand(l, [[45, 8], [47, 16], [47, 23]], 8, 2, h);
    // tall lace headdress across the crown ("reads as a crown"): scalloped frill + band
    for (let i = 0; i < 6; i++) l.ellipse(20 + i * 5, 2 + Math.abs(i - 2.5) * 0.8, 2.7, 3, "w");
    l.poly([[16, 3], [50, 3], [50, 6], [16, 6]], "w");
    l.poly([[14, 6], [52, 6], [51, 10], [15, 10]], "W");
    for (let x = 16; x < 51; x += 3) l.set(x, 8, "g");
    for (let i = 0; i < 6; i++) l.set(20 + i * 5, 2 + Math.round(Math.abs(i - 2.5) * 0.8), "g");
    l.each((x, y, k) => (k === "w" && x > 44 ? "W" : null));
  },
  extras(p, f) {
    if (f === 0) {
      p.put(TWINKLE, 54, 26);
      p.put(TWINKLE_S, 6, 30);
    } else {
      // ketchup bottle tucked under her arm
      layer(p, (l) => {
        l.poly([[50, 63], [53, 47], [60, 48], [60, 63]], "r");
        l.rect(54, 43, 5, 5, "w");
        l.rect(55, 40, 3, 3, "r");
        l.each((x, y, k) => (k === "r" && x > 57 ? "R" : k === "r" && x < 53 && y > 50 ? "q" : null));
        l.rect(52, 53, 7, 4, "y");
        l.set(54, 54, "r").set(56, 55, "r");
      });
      // the heart hands, at chin height
      layer(p, (l) => heartHands(l, 23, 48));
      // the moe-moe love glowing inside the hand-heart
      for (let y = 48; y < 64; y++)
        for (let x = 23; x < 46; x++)
          if (inHeart(x, y, 29, 52, 10, 7) && p.get(x, y) !== "1") p.set(x, y, y < 54 && x < 33 ? "q" : "p");
      p.set(30, 53, "w").set(31, 53, "w");
      letter(p, "KYUN", 46, 2, "p", "w", 0.5);
      p.put(TWINKLE, 3, 24);
      p.put(TWINKLE_S, 58, 26);
      p.put(TWINKLE_S, 10, 42);
    }
  },
};

// ============================================================================ ult actor

/** OMURICE OF LOVE: a giant plate of omurice. f0 plain, f1 with a ketchup heart + sparkles. */
function omurice(f: number): Pix {
  const p = new Pix(48, 32);
  // white plate (perspective ellipse, rim + well)
  layer(p, (l) => {
    l.ellipse(23.5, 24, 22.5, 6.6, "W");
    l.ellipse(23.5, 23.4, 18, 4.6, "w");
    l.each((x, y, k) => (k === "W" && y > 26 ? "g" : k === "W" && x > 38 && y > 23 ? "g" : null));
    l.set(6, 22, "w").set(7, 21, "w").set(8, 21, "w");
  });
  // rice peeking out under the omelette
  layer(p, (l) => {
    l.ellipse(23.5, 22.5, 15, 3.6, "w");
    for (const [x, y] of [[11, 23], [14, 24], [18, 25], [23, 25], [28, 25], [32, 24], [35, 23], [16, 23], [30, 23]] as [number, number][]) l.set(x, y, "W");
    l.set(12, 24, "g").set(34, 24, "g").set(25, 26, "g");
  }, null);
  // golden omelette dome (rugby-ball), lit from the top-left, browned underside
  layer(p, (l) => {
    l.ellipse(23.5, 15.5, 15.5, 8.8, (x, y) => {
      const nx = (x - 23.5) / 15.5;
      const ny = (y - 15.5) / 8.8;
      const t = -nx * 0.5 - ny * 0.75;
      if (t > 0.62) return "z";
      if (t > 0.18) return "y";
      if (t > -0.35) return "F";
      if (t > -0.7) return "Y";
      return "O";
    });
    // tucked omelette seam + soft folds
    l.line(10, 19, 37, 19, "Y");
    l.set(14, 12, "z").set(15, 11, "z").set(16, 11, "z");
  });
  // parsley sprig
  layer(p, (l) => {
    l.ellipse(40, 21, 2, 1.5, "e");
    l.set(39, 20, "l").set(41, 22, "E").set(42, 21, "E");
  });
  if (f === 1) {
    // ketchup heart, hand-drawn (moe moe kyun)
    layer(p, (l) => {
      for (let y = 6; y < 20; y++)
        for (let x = 14; x < 34; x++) if (inHeart(x, y, 16.5, 7.5, 14, 11)) l.set(x, y, "r");
      l.each((x, y, k) => (k === "r" && (x > 27 || y > 15) ? "R" : null));
      l.set(19, 9, "q").set(20, 9, "q").set(19, 10, "q");
    }, "R");
    p.put(TWINKLE, 1, 4);
    p.put(TWINKLE_S, 39, 2);
    p.put(TWINKLE_S, 44, 12);
    p.put(SPARK_S, 5, 15);
  }
  p.outline("1");
  return p;
}

export const sprites: SpriteDef[] = [
  ...heroSprites(PUDDING),
  gridSprite("ult_omurice", 48, 32, [omurice(0), omurice(1)], "feet"),
  gridSprite("portrait_pudding", 64, 64, [paintPortrait(PUDDING_P, 0), paintPortrait(PUDDING_P, 1)], "center"),
];
