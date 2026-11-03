/**
 * Season 2 weapon visuals, part A (owner: s2-items): Dark Flame Dragon,
 * Teapot Tempest, Micro Missile Swarm and their evolutions.
 *
 * Physical objects (salamander, cups, teapot, missiles) get the plum outline;
 * flames / hot liquids follow the base weapons' bloom recipe (pale core ->
 * saturated body -> coloured rim). Everything faces RIGHT (code rotates/mirrors).
 */
import type { SpriteDef } from "../format";
import { Cv, GLOW, rgba, spr } from "../sprites/s2-items-util";

// ============================================================================ Dark Flame Dragon

/** Small salamander, hand-pixelled (12x12): big chibi head, stubby body, flame-tipped tail. */
const SAL_BODY = `
............
......111...
.....1ooo1..
....1oyyoo1.
....1oyw0oo1
....1oo00oo1
....1ooob11.
.11.1Oooo1..
1oo1oBBoo1..
yz1ooBBBO1..
1.1OooOO1...
..1O11O1....`;
/** Violet bat wing (Kuro insists it is "abyssal"); f0 up, f1 mid, f2 down. Drawn behind the body. */
const SAL_WING = [
  `
.11...
1ii1..
1Iii1.
.1IIi1
..1II1
...11.`,
  `
......
......
1111..
1iii11
.1IIi1
..111.`,
  `
1111.
1iii1
.1Ii1
..11.`,
];
function salamander(f: number): Cv {
  const c = new Cv(12, 12);
  const pose = f === 3 ? 1 : f;
  const bob = f === 0 ? 0 : f === 2 ? 0 : 0;
  c.put(SAL_BODY, 0, bob);
  c.put(SAL_WING[pose], 0, (pose === 0 ? 1 : pose === 1 ? 2 : 4) + bob, { under: true });
  // flickering tail flame
  if (f % 2 === 1) c.set(0, 9 + bob, "z").set(1, 9 + bob, "y").set(0, 10 + bob, "o");
  return c;
}

// breath puff: orange flame, violet "drawn-on" outline
const DFIRE = [
  `
........
........
........
...oo...
...yzo..
...oyo..
........
........`,
  `
........
....o...
...oyo..
..oyzyo.
..yzzyo.
..oyyoo.
...oo...
........`,
  `
....o...
..o.yo..
..oyzyo.
.oyzzyo.
.oyzyyo.
.ooyyoo.
..oooo..
........`,
  `
........
....o...
...oy...
....o.o.
..o..oy.
.oy...o.
..o.....
........`,
];
function dragonFire(f: number): Cv {
  const c = Cv.of(DFIRE[f]);
  return c.outline("I");
}

// --- Unsealed Abyss Dragon (24x24): the salamander grown up, black-violet, magenta eyes
/** Big bat wing (magenta membrane, leading edges lit), drawn behind the body. f0 up, f1 mid, f2 down. */
const ABYSS_WING = [
  `
0............
0P0.....0....
0QP0...0P0...
0QQP0.0QP0...
0QQQP00QQP0..
.0QQQQQQQQP0.
.0QQQQQQQQQP0
..0QQQQQQQQQ0
..0QQ0QQ0QQ0.
...00.00.00..`,
  `
000000.......
0PPPPP0000...
.0QQQQPPPP00.
..0QQQQQQQQP0
..0QQQQQQQQQ0
...0Q0QQ0QQ0.
....0.00.00..`,
  `
.......00000.
....000QQQQ0.
..00QQQQQQQ0.
.0QQQQQQQQ0..
0QQQ0QQQ0Q0..
0Q00.0Q0.00..
00...00......`,
];
const WING_Y = [0, 3, 6];

function abyssDragon(f: number): Cv {
  const c = new Cv(24, 24);
  const pose = f === 3 ? 1 : f;
  const b = f === 2 ? -1 : f === 0 ? 1 : 0; // wings down -> body up
  // thick tail sweeping back, curling up
  c.ellipse(4.5, 18 + b, 2.6, 1.6, "x");
  c.pts([[2, 17 + b], [1, 16 + b], [1, 15 + b], [2, 16 + b]], "x");
  c.pts([[3, 19 + b], [4, 19 + b], [5, 19 + b], [6, 19 + b]], "X");
  // body, then the big chibi head + muzzle on top
  c.ball(10, 16.5 + b, 5.0, 4.0, "Xxxf", { bias: -0.05 });
  c.ball(15.2, 9.6 + b, 6.0, 5.4, "Xxxf", { bias: 0.05 });
  c.ball(20.4, 11.6 + b, 2.5, 2.0, "Xxxf", { bias: 0.1 });
  // sheen on the crown
  c.pts([[12, 6 + b], [13, 5 + b], [14, 5 + b], [11, 7 + b]], "G");
  // belly plates
  c.pts([[9, 19 + b], [10, 19 + b], [11, 19 + b], [12, 18 + b], [13, 18 + b], [13, 17 + b]], "2");
  c.pts([[10, 18 + b], [11, 18 + b], [12, 17 + b]], "I");
  // stubby feet
  c.rect(7, 20 + b, 2, 2, "X");
  c.rect(12, 20 + b, 2, 2, "X");
  // horns sweeping back
  c.pts([[12, 4 + b], [11, 3 + b], [10, 2 + b], [9, 2 + b]], "g");
  c.pts([[15, 4 + b], [15, 3 + b], [14, 2 + b], [14, 1 + b]], "W");
  c.set(10, 3 + b, "G").set(15, 4 + b, "g");
  c.outline("0");
  c.put(ABYSS_WING[pose], 0, WING_Y[pose] + b, { under: true });
  // magenta spine spikes down the back
  c.pts([[9, 7 + b], [8, 9 + b], [6, 12 + b]], "P");
  c.pts([[9, 8 + b], [8, 10 + b], [6, 13 + b]], "Q");
  // tail flame (magenta, glowing)
  c.pts([[1, 14 + b], [0, 14 + b], [1, 13 + b], [0, 13 + b], [1, 12 + b]], "p");
  c.pts([[0, 12 + b], [1, 11 + b]], "q");
  c.set(0, 15 + b, "P").set(2, 14 + b, "P").set(1, 13 + b, "w");
  // big glowing eye with an "evil" brow
  c.pts([[15, 7 + b], [16, 7 + b], [17, 7 + b], [18, 8 + b]], "0");
  c.pts([[15, 8 + b], [16, 8 + b], [17, 8 + b], [15, 9 + b], [16, 9 + b], [17, 9 + b], [15, 10 + b], [16, 10 + b], [17, 10 + b]], "p");
  c.set(15, 8 + b, "w").set(16, 8 + b, "q").set(17, 10 + b, "q").set(15, 10 + b, "P").set(16, 10 + b, "q");
  c.pts([[14, 9 + b], [14, 10 + b]], "0");
  // nostril, grin with a fang, blush
  c.set(21, 10 + b, "0");
  c.pts([[18, 13 + b], [19, 13 + b], [20, 13 + b], [21, 12 + b]], "0");
  c.set(19, 14 + b, "w");
  c.pts([[14, 12 + b], [15, 12 + b]], "Q");
  return c;
}

// abyss flame: actually black-violet with a magenta core; a soft magenta halo keeps it readable on dark ground
const AFIRE = [
  `
..........
..........
..........
....X.....
...XxX....
...xPx....
...XpX....
....X.....
..........
..........`,
  `
..........
.....X....
....Xx....
...XxPX...
...xPpx.X.
..XPpqPxX.
..xPqwpX..
..XxPpxX..
...XXxX...
..........`,
  `
....X.....
...Xx..X..
...xX.Xx..
..XxPXxPX.
.XxPpPPpX.
.xPpqwqpx.
.XPpwqpPX.
.XxPppPxX.
..XXxxXX..
...XXXX...`,
  `
......X...
..X..Xx...
..x..xX...
.Xx....X..
.xX...XxX.
...X..xP..
..XxX.X...
..xPx.....
...X......
..........`,
];
function abyssFire(f: number): Cv {
  return Cv.of(AFIRE[f]).halo(["+"]);
}

// ============================================================================ Teapot Tempest

/** Teacup body on its own 8x6 (rim, tea, handle) so it can tip; the saucer stays put. */
const CUP = `
.pqqp...
pyooOp..
Wppppg..
wwwwgWWW
wwwwgW.W
.wwgWWW.`;
const SAUCER = `
gWWWWWWg
.gggggg.`;
/** f1: the cup lifted and tipped forward, tea pouring over the front rim onto the saucer. */
const CUP_TIP = `
..pp....
.pqqp...
Wpyoop..
wwpyoOp.
wwwwppoo
.wwwgWWo
..wgW..o`;
function teacup(f: number): Cv {
  const c = new Cv(10, 10);
  c.put(SAUCER, 1, 7);
  c.put(f === 0 ? CUP : CUP_TIP, 1, f === 0 ? 1 : 0);
  c.outline("1");
  if (f === 1) {
    // splash on the saucer
    c.set(8, 7, "o").set(9, 6, "y");
  } else {
    // a curl of steam
    c.set(7, 0, "W");
  }
  return c;
}

/** Puddle body: amber ellipse with a glossy pale rim on the top-left and a darker lip at the bottom. */
function puddleBody(c: Cv, cx: number, cy: number, rx: number, ry: number, dry = 0): void {
  c.ellipse(cx, cy, rx, ry, (x, y) => {
    const u = (x - cx) / rx;
    const v = (y - cy) / ry;
    const d = Math.hypot(u, v);
    if (dry > 0 && ((x * 13 + y * 7) % 11) / 11 < dry * (d > 0.6 ? 1.2 : 0.4)) return null;
    if (d > 0.82) return v > 0 ? "O" : "Y";
    if (d > 0.62 && u + v < -0.4) return "y";
    return v > 0.15 ? "Y" : "o";
  });
}
function teaPuddle(f: number): Cv {
  const c = new Cv(24, 14);
  if (f === 0) {
    // splash: crown of droplets + fresh puddle
    puddleBody(c, 11.5, 9, 9, 3.6);
    c.pts([[4, 4], [6, 2], [9, 1], [14, 1], [17, 2], [19, 4], [21, 6], [2, 6]], "o");
    c.pts([[6, 3], [9, 2], [14, 2], [17, 3]], "y");
    c.pts([[9, 0], [14, 0]], "z");
    c.pts([[7, 5], [8, 4], [15, 4], [16, 5]], "Y");
    c.pts([[8, 7], [9, 7], [10, 7]], "z");
  } else if (f === 2) {
    // drying: a tea-ring stain with a couple of last pools
    c.ellipse(11.5, 7.5, 9.5, 4.2, (x, y) => {
      const d = Math.hypot((x - 11.5) / 9.5, (y - 7.5) / 4.2);
      if (d > 0.78) return y > 7 ? "O" : "Y";
      return null;
    });
    c.ellipse(8, 8, 2.6, 1.3, "o");
    c.ellipse(15, 6.5, 1.6, 0.9, "o");
  } else {
    puddleBody(c, 11.5, 7.5, 10.5, 4.6);
    if (f === 1) {
      c.ellipse(19, 11, 2, 1.2, "o");
      c.pts([[19, 10]], "y");
    }
  }
  c.selout({}, "!");
  // gloss highlights
  if (f === 1) c.pts([[7, 5], [8, 5], [9, 5], [6, 6]], "z").set(8, 4, "w").set(15, 9, "y").set(16, 9, "y");
  if (f === 0) c.set(7, 7, "w");
  if (f === 2) c.pts([[7, 7], [8, 7]], "y");
  return c;
}

/** Flower decal (pink, 5 px) */
function flower(c: Cv, x: number, y: number): void {
  c.set(x, y, "q").set(x - 1, y, "p").set(x + 1, y, "p").set(x, y - 1, "p").set(x, y + 1, "P");
}
function teapotBody(): Cv {
  const c = new Cv(24, 20);
  // handle loop (left), drawn first so the body overlaps it
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 9; x++) {
      const d = Math.hypot((x - 5.5) / 3.6, (y - 11.5) / 3.6);
      if (d > 0.62 && d <= 1.05 && x < 6) c.set(x, y, x < 3 ? "W" : "g");
    }
  // spout: a thick neck rising to the right
  c.poly([[16, 13.5], [18, 10.5], [21, 6.5], [23.2, 5.5], [23.2, 7.8], [21.5, 9.5], [19.5, 14.5]], (x, y) => (y > 13 - (x - 17) * 1.4 ? "g" : x + y < 30 ? "w" : "W"));
  // round body
  c.ball(12, 12.2, 7.6, 5.6, "gWWww", { spec: "w" });
  // foot ring
  c.rect(8, 17, 9, 1, "g");
  // lid + knob
  c.ellipse(12, 6.6, 4.6, 1.4, (x) => (x < 11 ? "w" : "W"));
  c.rect(8, 7, 9, 1, "g");
  c.ball(12, 4.2, 1.5, 1.4, "Ppq");
  // pink flowers + mint leaves
  flower(c, 8, 11);
  flower(c, 14, 14);
  flower(c, 16, 9);
  c.set(9, 12, "e").set(13, 15, "e").set(17, 10, "e");
  return c;
}
function teapotBig(f: number): Cv {
  let c = teapotBody();
  if (f === 1) c = c.rotate(0.38, 12, 12).shift(-1, 0);
  c.outline("1");
  if (f === 0) {
    // gloss + a sparkle by the lid
    c.set(8, 9, "w").set(9, 8, "w");
    c.set(20, 2, "z").set(19, 2, "y").set(21, 2, "y").set(20, 1, "y").set(20, 3, "y");
  } else {
    // pouring: find the spout tip (right-most opaque pixel) and arc tea down from it
    let tx = 0;
    let ty = 0;
    c.each((x, y, k) => {
      if (k !== "." && x >= tx) {
        tx = x;
        ty = y;
      }
    });
    const stream: [number, number][] = [];
    for (let y = ty + 1; y < 20; y++) stream.push([Math.min(23, tx + (y - ty > 2 ? 1 : 0)), y]);
    c.pts(stream, "o");
    for (const [x, y] of stream) if (y % 3 === 0) c.set(x, y, "y");
    c.set(tx, ty + 1, "z");
  }
  return c;
}

const TEA_DROP = [
  `
.W....
..1...
.1Y1..
1YzY1.
1OYy1.
.111..`,
  `
..W...
..1...
.1Y1..
1YzY1.
1OYy1.
.111..`,
];

const PETIT_FOUR = `
...11...
..1rr1..
.1qrw11.
1qqqqqq1
1pwpwpP1
1hBhBhH1
1FhhhhH1
.111111.`;

// ============================================================================ Micro Missile Swarm

const MISSILE = [
  `
..1.....
.1U1111.
o1wwwwz1
oyWWWWu1
.1U1111.
..1.....`,
  `
..1.....
.1U1111.
y1wwwwz1
zoWWWWu1
.1U1111.
..1.....`,
];

const MISSILE_EVO = [
  `
..1.......
.1U1111...
.1wwwww11.
o1wwwwHdr1
oyWWWWhHR1
.1WWWWW11.
.1U1111...
..1.......`,
  `
..1.......
.1U1111...
z1wwwww11.
yoWwwwHdr1
zyWWWWhHR1
o1WWWWW11.
.1U1111...
..1.......`,
];

function sauce(f: number): Cv {
  const c = new Cv(12, 8);
  c.ellipse(5.5, 4.2, 4.3, 2.4, (x, y) => (y >= 5 ? "R" : "r"));
  c.pts([[1, 2], [10, 1], [11, 5], [0, 5], [8, 7]], "r");
  c.pts([[2, 4], [9, 6]], "R");
  c.selout({ r: "R" }, "R");
  c.pts([[3, 3], [4, 3]], "o").set(4, 2, "q");
  if (f === 1) {
    // a bubble rises and pops
    c.set(7, 2, "r").set(7, 1, "q").set(8, 1, "r").set(6, 1, "R");
    c.set(7, 0, "R");
  } else {
    c.set(7, 3, "q");
  }
  return c;
}

export const sprites: SpriteDef[] = [
  spr("w_salamander", 12, 12, [0, 1, 2, 3].map(salamander), "center", { fps: 10 }),
  spr("w_dragon_fire", 8, 8, [0, 1, 2, 3].map(dragonFire), "center", { fps: 12 }),
  spr("w_abyss_dragon", 24, 24, [0, 1, 2, 3].map(abyssDragon), "center", { fps: 8 }),
  spr("w_abyss_fire", 10, 10, [0, 1, 2, 3].map(abyssFire), "center", { pal: GLOW, fps: 12 }),
  spr("w_teacup", 10, 10, [0, 1].map(teacup), "center"),
  spr("w_tea_puddle", 24, 14, [0, 1, 2].map(teaPuddle), "center", { pal: GLOW, fps: 6 }),
  spr("w_teapot_big", 24, 20, [0, 1].map(teapotBig), "center", { fps: 4 }),
  spr("w_tea_drop", 6, 6, TEA_DROP, "center", { pal: GLOW }),
  spr("w_petit_four", 8, 8, [PETIT_FOUR], "center"),
  spr("w_missile", 8, 6, MISSILE, "center", { fps: 16 }),
  spr("w_missile_evo", 10, 8, MISSILE_EVO, "center", { fps: 16 }),
  spr("w_sauce", 12, 8, [0, 1].map(sauce), "center", { fps: 4 }),
];

void rgba;
