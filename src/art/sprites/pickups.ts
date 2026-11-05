/**
 * Pickups (owner: world): XP shards, coins, food, power-ups and the chest.
 * Gems and coins are glowy (drawn on the bloom layer): bright pale cores,
 * saturated facets, coloured dark rims so they still read on the meadow.
 */
import type { SpriteDef } from "../format";
import { Cv, spr } from "./world-util";

// ------------------------------------------------------------------ gems
const GEM1 = [
  `
...U...
..UaU..
.UwacU.
UwaacCU
.UacCU.
..UCU..
...U...`,
  `
...U...
..UwU..
.UwwaU.
UwwaacU
.UacCU.
..UcU..
...U...`,
];

const GEM2 = [
  `
...QQ...
..QwqQ..
.QwqqpQ.
.QqqpPQ.
.QqppPQ.
.QqpPPQ.
..QpPQ..
...QQ...`,
  `
...QQ...
..QwwQ..
.QwwqqQ.
.QwqqpQ.
.QqqpPQ.
.QqppPQ.
..QpPQ..
...QQ...`,
];

/** Gold star crystal, hand-pixelled: lit upper-left facets, shaded lower-right. */
const GEM3 = [
  `
....OO....
...OzyO...
...OzyO...
OOOOzyYOOO
OzzzzzyyYO
.OzzzyyYO.
..OzyyYO..
.OzyOOyYO.
.OyO..OYO.
.OO....OO.`,
  `
....OO....
...OwzO...
...OzyO...
OOOOwzYOOO
OzzzwwzyYO
.OzzzzyYO.
..OzyyYO..
.OzyOOyYO.
.OyO..OYO.
.OO....OO.`,
];

/** Rainbow prism: a big diamond with diagonal hue bands that slide one step per frame. */
function gem4(frame: number): Cv {
  const c = new Cv(12, 12);
  const cx = 5.5;
  const cy = 5.5;
  const SAT = ["p", "o", "y", "l", "c", "u", "i", "j"];
  const LIT = ["q", "z", "z", "m", "a", "v", "j", "w"];
  const DRK = ["P", "O", "Y", "e", "C", "U", "I", "i"];
  c.shape(
    (x, y) => Math.abs(x - cx) + Math.abs(y - cy) <= 5.1,
    (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      if (Math.abs(dx) + Math.abs(dy) <= 1.1) return "w";
      const h = (Math.floor((x - y + 24) / 2) + frame * 2) % 8;
      if (dx < 0 && dy < 0) return LIT[h];
      if (dx > 0 && dy > 0) return DRK[h];
      return SAT[h];
    },
  );
  c.set(4, 3, "w");
  c.outline("I");
  return c;
}

// ------------------------------------------------------------------ coin (4-frame spin)
const COIN = [
  `
..OOOO..
.OzzyyO.
OzyyYyyO
OyYYYYYO
OyyYYYyO
OyYyyYyO
.OyyyYO.
..OOOO..`,
  `
...OOO..
..OzyyO.
.OzyzyYO
.OyzzzYO
.OyyzyYO
.OyzyzYO
..OYYYO.
...OOO..`,
  `
...OO...
...OzO..
...OyO..
...OyO..
...OyO..
...OyO..
...OYO..
...OO...`,
  `
..OOO...
.OyyzO..
OYyyyzO.
OYyyyyO.
OYyyyyO.
OYyyyyO.
.OYYYO..
..OOO...`,
];

// ------------------------------------------------------------------ food
const ONIGIRI = `
............
.....11.....
....1tw1....
...1twww1...
...1wwwwW1..
..1ww0ww0W1.
..1wbw1wbW1.
.1wwwwwwwWW1
.1wWXXXXXgW1
.1WWXxxXXgg1
..11XXXXX11.
....11111...`;

const CAKE = `
.......e....
......rer...
.....rwrrR..
.....1RrR1..
....1BwBBB1.
...1BBBBBBW1
..1BBBBBBBW1
.1hhhhhhhhH1
.1qqrqqqrqP1
.1hhhhhhhhH1
.1FFFFFFFFH1
..11111111..`;

// ------------------------------------------------------------------ power-ups
const MAGNET = [
  `
............
...111111...
..1rrrrrR1..
.1rqrrrrrR1.
.1rr1111rR1.
.1rR1..1rR1.
.1rR1..1rR1.
.1WW1..1Wg1.
.1ww1..1wW1.
.1111..1111.
............
............`,
  `
.........w..
...111111z..
..1rrrrrR1..
.1rqrrrrrR1.
.1rr1111rR1.
.1rR1..1rR1.
.1rR1..1rR1.
.1WW1..1Wg1.
.1ww1..1wW1.
.1111..1111.
.y........y.
............`,
];

function bomb(frame: number): Cv {
  const c = new Cv(12, 12);
  c.ball(5.2, 6.8, 4.3, 4.1, "nUUu", { bias: -0.05 });
  // pink heart emblem
  c.put(
    `
p.p
ppp
.p.`,
    4,
    6,
  );
  c.set(3, 4, "v").set(4, 3, "v").set(3, 5, "u");
  // cap + fuse
  c.rect(7, 2, 2, 2, "g");
  c.set(7, 2, "W");
  c.outline("1");
  c.set(9, 1, "H").set(10, 0, "H");
  if (frame === 0) {
    c.set(11, 0, "y").set(10, 1, "o");
  } else {
    c.set(11, 0, "w").set(11, 1, "y").set(10, 1, "y").set(9, 0, "o");
  }
  return c;
}

function clock(frame: number): Cv {
  const c = new Cv(12, 12);
  const ring = frame === 1 ? 1 : 0;
  // bells
  c.ball(2.5 - ring * 0.5, 2.5, 1.6, 1.4, "Yyz");
  c.ball(8.5 + ring * 0.5, 2.5, 1.6, 1.4, "Yyz");
  // body + face
  c.ball(5.5, 6.5, 4.4, 4.2, "CCca");
  c.ellipse(5.5, 6.5, 3.0, 2.8, (x, y) => (x + y < 11 ? "w" : "W"));
  // hands + centre
  c.set(5, 5, "1").set(5, 4, "1").set(6, 6, "1").set(5, 6, "r");
  c.set(7, 7, "1");
  c.set(2, 4, "a");
  // feet
  c.set(2, 11, "1").set(9, 11, "1");
  c.outline("1");
  c.set(2, 11, "1").set(9, 11, "1");
  if (ring) {
    c.set(0, 6, "w").set(11, 6, "w").set(0, 4, "y").set(11, 4, "y");
  }
  return c;
}

// ------------------------------------------------------------------ chest (18x16, feet pivot)
/** Gold plate with a red heart, stamped over the lid/body seam. */
const LOCK = `
.1111111.
1zyyyyyY1
1yrr.rrY1
1yrwrrrY1
1yYrrrYY1
1yYYrYYY1
.1111111.`;

function chest(f: number): Cv {
  const body = `
.1ppppppppppppPP1.
.1pqppppppppppPP1.
.1ppppppppppppPP1.
.1ppppppppppppPP1.
.1YyPPPPPPPPPPYO1.
..11111111111111..`;
  const c = new Cv(18, 16);
  if (f === 0 || f === 1) {
    const lid = `
....1111111111....
..11qqqqqqqqqq11..
.1qqwwqqqqqqqqqP1.
.1qwqqqqqqqqqqqP1.
.1ppppppppppppPP1.
1YzyyyyyyyyyyyyYO1
1OYYYYYYYYYYYYYOO1`;
    c.put(body, 0, 10);
    c.put(lid, 0, f === 1 ? 2 : 3);
    c.put(LOCK, 4, f === 1 ? 5 : 6);
    if (f === 1) {
      // light leaking out of the seam + sparkles, lid lifted 1px
      c.put(".1zwwwwwwwwwwwwz1.", 0, 9);
      c.set(0, 9, "z").set(17, 9, "z");
      c.pts(
        [
          [1, 4],
          [16, 3],
          [3, 0],
          [14, 1],
        ],
        "w",
      );
      c.set(2, 1, "z").set(15, 0, "z");
    }
  } else {
    // open: lid tipped back (we see its pink underside), golden glow inside
    c.put(
      `
....1111111111....
...1PPPPPPPPPP1...
..1PQQQQQQQQQQP1..
..1PqqqqqqqqqqP1..
.1YYYYYYYYYYYYYO1.
1zzwwwwwwwwwwwzzY1
1zwwwwwwwwwwwwwzY1
1YzyyyyyyyyyyyyYO1
1OYYYYYYYYYYYYYOO1`,
      0,
      1,
    );
    c.put(body, 0, 10);
    c.put(
      `
.1111111.
1yrr.rrY1
1yrwrrrY1
1yYrrrYY1
.1111111.`,
      4,
      9,
    );
  }
  // fill the heart notch with the plate colour
  return c.each((x, y, k) => (k === "." && c.get(x - 1, y) === "r" && c.get(x + 1, y) === "r" ? "Y" : null));
}

export const sprites: SpriteDef[] = [
  spr("gem_1", 7, 7, GEM1, "center", { fps: 3 }),
  spr("gem_2", 8, 8, GEM2, "center", { fps: 3 }),
  spr("gem_3", 10, 10, GEM3, "center", { fps: 3 }),
  spr("gem_4", 12, 12, [0, 1, 2, 3].map(gem4), "center", { fps: 8 }),
  spr("coin", 8, 8, COIN, "center", { fps: 10 }),
  spr("food_onigiri", 12, 12, [ONIGIRI], "center"),
  spr("food_cake", 12, 12, [CAKE], "center"),
  spr("pk_magnet", 12, 12, MAGNET, "center", { fps: 4 }),
  spr("pk_bomb", 12, 12, [bomb(0), bomb(1)], "center", { fps: 8 }),
  spr("pk_clock", 12, 12, [clock(0), clock(1)], "center", { fps: 6 }),
  spr("chest", 18, 16, [0, 1, 2].map(chest), "feet", { fps: 6 }),
];
