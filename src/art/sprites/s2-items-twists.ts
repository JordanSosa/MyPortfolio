/**
 * Season 2 Plot Twist icons (15) and the small hub UI icons (Dream Gem,
 * Copium, Plot Point trophy, unknown codex entry, heat) - owner: s2-items.
 *
 * Same 16x16 house style as icons.ts: one bold silhouette, auto plum outline
 * (1-px margin kept), 2-3 tone shading lit from the top-left, one white glint.
 * Twists are "bad news" modifiers, so they lean on warning reds, cracks and
 * crossed-out shapes, but stay cute.
 */
import type { SpriteDef } from "../format";
import { Cv, I16, LIGHT, inHeart, micro, ring, shadedStar, sparkle, spr } from "../sprites/s2-items-util";

const shade = (dx: number, dy: number) => dx * LIGHT[0] + dy * LIGHT[1];

/** Shaded heart centred at (cx, cy). */
function heart(c: Cv, cx: number, cy: number, s: number, keys: [string, string, string] = ["P", "p", "q"]): Cv {
  return c.shape(
    (x, y) => inHeart(x, y, cx, cy, s),
    (x, y) => {
      const l = shade(x - cx, y - cy) / s;
      return l > 0.45 ? keys[2] : l > -0.3 ? keys[1] : keys[0];
    },
  );
}

// =========================================================================== twists

const PIGGY = `
..qq..........
..qPp.........
..pPpp.qqq....
.pqqqpppppp...
pqwqqqppp0pp..
pqqqqqpppppqqq
pqqqqpppppqPqP
ppqqpppppppqqq
pppppppppPpbp.
.PpppppPPPPpP.
..PPPPPPPPPP..
..PP.....PP...`;

function budgetCuts(): Cv {
  const c = I16().put(PIGGY, 1, 3);
  c.set(0, 7, "p").set(0, 6, "q");
  c.outline("1");
  // coin slot on the back
  c.rect(6, 4, 3, 1, "1");
  // the crack: a zigzag from the slot down through the belly
  c.pts([[7, 5], [6, 6], [7, 7], [6, 8], [7, 9], [6, 10], [7, 11]], "1");
  c.pts([[8, 6], [8, 8], [8, 10]], "Q");
  // a lonely coin escaping
  c.put(
    `
.11.
1yz1
1Yy1
.11.`,
    11,
    0,
  );
  return c;
}

/** A film can seen at 3/4: flat cylinder (top ellipse + side band). */
function filmCan(c: Cv, cx: number, cy: number, rx: number, ry: number, side: number, top: string, rim: string, dark: string): void {
  c.rect(Math.round(cx - rx), cy, Math.round(rx * 2) + 1, side, dark);
  c.ellipse(cx, cy + side, rx, ry, dark);
  c.ellipse(cx, cy, rx, ry, (x, y) => (shade(x - cx, y - cy) > 1 ? rim : top));
}

function fillerOverload(): Cv {
  const c = I16();
  // three film reels stacked like pancakes, a strip of film spilling off the top one
  filmCan(c, 7.5, 11.5, 6, 2, 2, "g", "W", "G");
  filmCan(c, 7, 8, 5.5, 2, 2, "u", "v", "U");
  filmCan(c, 8, 4.5, 5.5, 2, 2, "g", "W", "G");
  c.outline("1");
  // hub + holes on the top reel
  c.set(8, 4, "2").set(5, 4, "G").set(11, 4, "G").set(8, 3, "G").set(8, 5, "G");
  c.set(5, 3, "w").set(4, 7, "w");
  // film strip
  c.put(
    `
x.
xx
fx
xx
x.`,
    13,
    5,
  );
  c.set(14, 9, "1").set(15, 9, "x").set(15, 10, "x").set(14, 10, "f");
  return c;
}

function rushedProduction(): Cv {
  const c = I16();
  // alarm clock dashing right: bells, legs, speed lines behind it
  c.disc(6, 3, 1.6, "Y");
  c.disc(14, 3, 1.6, "Y");
  c.disc(10, 8.5, 5.2, (x, y) => (shade(x - 10, y - 8.5) > 0.5 ? "r" : "R"));
  c.disc(10, 8.5, 3.8, (x, y) => (shade(x - 10, y - 8.5) < -2 ? "W" : "w"));
  c.pts([[7, 14], [13, 14]], "R");
  c.outline("1");
  c.set(6, 2, "z").set(14, 2, "z");
  // hands: blur arcs (they're spinning)
  c.line(10, 8, 10, 6, "1");
  c.line(10, 8, 12, 9, "1");
  c.pts([[8, 6], [12, 6], [7, 9]], "g");
  c.set(10, 8, "r");
  // speed lines
  c.line(0, 6, 3, 6, "w");
  c.line(1, 9, 4, 9, "w");
  c.line(0, 12, 3, 12, "w");
  c.set(8, 4, "q");
  return c;
}

function censored(): Cv {
  const c = I16();
  heart(c, 7.5, 7.8, 6.8);
  c.outline("1");
  c.set(4, 4, "w").set(3, 5, "w");
  // the black censor bar (sticks out past the heart)
  c.rect(0, 6, 16, 4, "1");
  c.rect(1, 7, 14, 2, "0");
  c.set(3, 7, "2").set(4, 7, "2");
  return c;
}

const CLIFF = `
.....eee........
..eeelleee......
.elleeeeeeE.....
EeeEeeeEeEEE....
hhhHhhhHhhH.ss..
HhhhHhHhhHHsts..
HHhHhhHhH.ppts..
dHHhHhhH.ppppp..
.dHHhhHH.pwpwp..
..dHhHH..pp0p0..
...dHHd...psbs..
....dHd....uU...
.....dd....uu...
...........s.s..
................`;

function cliffhanger(): Cv {
  const c = I16().put(CLIFF, 0, 1);
  c.outline("1");
  c.set(14, 5, "a"); // sweat drop
  c.set(3, 4, "m");
  return c;
}

function powerCreep(): Cv {
  const c = I16();
  // crown
  c.poly([[2, 14], [2, 9], [5, 11.5], [8, 7.5], [11, 11.5], [14, 9], [14, 14]], (x, y) => (shade(x - 8, y - 11) > 0.5 ? "y" : y > 12 ? "Y" : "y"));
  c.rect(2, 13, 13, 2, "Y");
  c.set(8, 12, "r").set(5, 13, "u").set(11, 13, "e");
  // rising arrow above it
  c.poly([[8, 0], [13, 5], [10, 5], [10, 8], [6, 8], [6, 5], [3, 5]], (x, y) => (x < 8 ? "q" : "p"));
  c.outline("1");
  c.set(7, 2, "w").set(3, 9, "z");
  return c;
}

function spoilers(): Cv {
  const c = I16();
  // speech bubble
  c.ellipse(8, 6.5, 6.8, 5.4, (x, y) => (shade(x - 8, y - 6.5) < -2.4 ? "W" : "w"));
  c.poly([[3, 9], [6, 11], [1.5, 14.5]], "w");
  c.outline("1");
  // "!" crossed out
  c.rect(7, 2, 2, 6, "r");
  c.rect(7, 9, 2, 2, "r");
  c.set(7, 2, "q");
  c.line(3, 11, 12, 2, "1");
  c.line(4, 11, 13, 2, "R");
  return c;
}

function dubVersion(): Cv {
  const c = I16();
  // microphone, tilted: mesh head + handle
  c.line(4, 13, 8, 9, "x");
  c.line(3, 13, 7, 9, "x");
  c.line(4, 14, 8, 10, "2");
  c.disc(9.5, 6.5, 3.6, (x, y) => ((x + y) % 2 === 0 ? (shade(x - 9.5, y - 6.5) > 0 ? "w" : "g") : shade(x - 9.5, y - 6.5) > 0 ? "W" : "G"));
  c.line(7, 9, 9, 11, "r");
  c.outline("1");
  c.set(8, 4, "w");
  // the "?" (wrong lines)
  c.put(
    `
.yy.
y..y
..y.
.y..
....
.y..`,
    1,
    1,
  );
  c.selout({}, "1", false, (x, y) => x <= 5 && y <= 7);
  return c;
}

function midSeasonBreak(): Cv {
  const c = I16();
  // calendar page with a red header and binder rings
  c.rect(1, 3, 14, 12, "w");
  c.rect(1, 3, 14, 3, "r");
  c.rect(1, 3, 14, 1, "q");
  c.rect(14, 6, 1, 9, "W");
  c.rect(1, 14, 14, 1, "W");
  c.outline("1");
  c.rect(4, 1, 1, 3, "g").rect(11, 1, 1, 3, "g");
  c.set(4, 1, "w").set(11, 1, "w");
  for (let y = 7; y <= 13; y += 2) for (let x = 3; x <= 13; x += 2) c.set(x, y, "g");
  // big red X over everything
  c.line(3, 7, 10, 14, "1");
  c.line(4, 7, 11, 14, "r");
  c.line(5, 7, 12, 14, "R");
  c.line(12, 7, 5, 14, "1");
  c.line(13, 7, 6, 14, "r");
  c.line(11, 7, 4, 14, "R");
  return c;
}

function darkerAndEdgier(): Cv {
  const c = I16();
  // cute plush bunny... with an eyepatch and a scar. very edgy.
  c.ellipse(4.5, 3.5, 1.6, 3.4, "j");
  c.ellipse(10.5, 3.5, 1.6, 3.4, "j");
  c.ball(7.5, 9.5, 6, 5, "ijjjw");
  c.outline("1");
  c.set(4, 2, "q").set(4, 3, "q").set(10, 2, "q").set(10, 3, "q");
  // eyepatch + strap
  c.line(2, 6, 13, 9, "1");
  c.rect(8, 8, 3, 2, "0");
  c.set(9, 8, "x");
  // the good eye: sharp, angry
  c.rect(4, 9, 2, 2, "0").set(4, 9, "w");
  c.line(3, 8, 5, 8, "1");
  // scar + frowny stitched mouth
  c.pts([[11, 11], [12, 12], [10, 12]], "R");
  c.pts([[6, 12], [7, 13], [8, 12]], "1");
  c.set(3, 11, "b");
  return c;
}

function lightNovelTitle(): Cv {
  const c = I16();
  // open book: two pages fanning out from the spine
  c.poly([[0.5, 10], [7.5, 9], [7.5, 15.5], [0.5, 14.5]], "w");
  c.poly([[15, 10], [7.5, 9], [7.5, 15.5], [15, 14.5]], "W");
  c.outline("1");
  c.line(8, 9, 8, 15, "g");
  for (const y of [11, 13]) {
    c.line(2, y, 6, y - 1, "g");
    c.line(10, y - 1, 14, y, "G");
  }
  // the title: a banner far too long for the icon, text running off both edges
  c.rect(0, 1, 16, 6, "p");
  c.rect(0, 1, 16, 1, "q");
  c.rect(0, 6, 16, 1, "P");
  for (let x = 0; x < 16; x++) {
    if (x % 4 !== 3) c.set(x, 3, "w");
    if (x % 5 !== 2) c.set(x, 5, "w");
  }
  c.rect(0, 0, 16, 1, "1");
  c.rect(0, 7, 16, 1, "1");
  return c;
}

function shounenRival(): Cv {
  const c = I16();
  const fist = `
..sss.
.stsss
stssks
sssskk
.ssskk
..kkk.`;
  // left fist (ours) and right fist (taped, the rival's)
  c.put(fist, 1, 5);
  c.put(fist, 9, 5, { flip: true, map: { s: "h", t: "B", k: "H" } });
  c.rect(0, 7, 1, 3, "q");
  c.rect(15, 7, 1, 3, "r");
  c.outline("1");
  c.pts([[13, 6], [13, 7], [13, 8]], "w");
  // knuckle lines
  c.pts([[4, 7], [4, 9]], "k");
  c.pts([[11, 7], [11, 9]], "H");
  // impact burst between them
  c.put(
    `
..y..
.yzy.
yzwzy
.yzy.
..y..`,
    5,
    0,
  );
  c.pts([[7, 13], [7, 14], [5, 13], [9, 13]], "y");
  return c;
}

function studioChange(): Cv {
  const c = I16();
  // wooden paint palette (kidney shape with a thumb hole)
  c.ellipse(8, 9, 7, 5.6, (x, y) => (shade(x - 8, y - 9) > 1.5 ? "B" : shade(x - 8, y - 9) > -2 ? "h" : "H"));
  c.disc(4.5, 11.5, 1.2, ".");
  c.poly([[15, 13], [12, 15], [16, 16]], ".");
  c.outline("1");
  // paint blobs
  c.rect(4, 6, 2, 2, "r");
  c.rect(7, 4, 2, 2, "y");
  c.rect(10, 5, 2, 2, "u");
  c.rect(12, 8, 2, 2, "e");
  // "?" in the middle (new studio, who dis)
  c.put(
    `
.II.
I..I
..I.
.I..
....
.I..`,
    7,
    7,
  );
  c.set(4, 6, "q").set(7, 4, "z").set(10, 5, "v").set(12, 8, "l");
  return c;
}

function sequelHook(): Cv {
  const c = I16();
  // the "TO BE CONTINUED" arrow, pointing right
  c.poly([[0.5, 4.5], [10, 4.5], [10, 1], [15.5, 7.5], [10, 14], [10, 10.5], [0.5, 10.5]], (x, y) => (y < 6 ? "h" : y > 9 ? "H" : "h"));
  c.outline("1");
  c.rect(1, 5, 9, 1, "B");
  micro(c, "TBC", 1, 5, "d");
  c.set(11, 4, "B");
  return c;
}

function simulcastDelay(): Cv {
  const c = I16();
  // buffering spinner: 8 dots fading round a ring (head = white, tail fades to plum)
  const keys = ["w", "a", "c", "C", "i", "I", "2", "2"];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = 7.5 + Math.cos(a) * 5.2;
    const y = 7.5 + Math.sin(a) * 5.2;
    c.disc(x, y, 1.5 - i * 0.08, keys[i]);
  }
  c.outline("1");
  return c;
}

// =========================================================================== UI icons

/** Faceted pink Dream Gem (the "definitely not premium" currency). */
function dreamGem(c: Cv, ox: number, oy: number, s: number): Cv {
  const cx = ox + 7 * s;
  const top = oy;
  const gird = oy + 4 * s;
  const bot = oy + 13 * s;
  const P = [
    [ox + 3 * s, top],
    [ox + 11 * s, top],
    [ox + 14 * s, gird],
    [cx, bot],
    [ox, gird],
  ] as const;
  c.poly(P as unknown as [number, number][], (x, y) => {
    if (y < gird) {
      // crown: table in the middle, bezel facets left/right
      if (y === Math.round(top)) return x < cx ? "q" : "p";
      return x < ox + 4 * s ? "q" : x > ox + 10 * s ? "P" : x < cx ? "w" : "q";
    }
    // pavilion: three long facets converging on the culet
    const t = (x - cx) / Math.max(1, bot - y);
    return t < -0.55 ? "p" : t < 0.05 ? "q" : t < 0.5 ? "P" : "Q";
  });
  return c;
}

function iconDreamGem(): Cv {
  const c = I16();
  dreamGem(c, 1, 1.5, 1);
  c.rect(1, 6, 14, 1, "P");
  c.outline("1");
  c.set(5, 3, "w").set(5, 4, "w");
  sparkle(c, 13, 2, "w", "q");
  return c;
}

function iconCopium(): Cv {
  const c = I16();
  // diagonal pill capsule: pink half, lavender half
  const p = new Cv(16, 16);
  p.rect(2, 5, 6, 6, "p");
  p.rect(8, 5, 6, 6, "j");
  p.disc(2.5, 7.5, 3, "p");
  p.disc(13, 7.5, 3, "j");
  p.rect(2, 5, 6, 1, "q").rect(8, 5, 6, 1, "w");
  p.rect(1, 10, 7, 1, "P").rect(8, 10, 6, 1, "i");
  p.set(8, 5, "W").set(8, 10, "i");
  p.rect(3, 6, 3, 1, "w");
  const r = p.rotate(-0.6);
  c.put(r, 0, 0);
  c.outline("1");
  sparkle(c, 3, 3, "w", "q");
  c.set(13, 13, "j");
  return c;
}

function iconTrophy(): Cv {
  const c = I16();
  // handles
  ring(c, 3, 5.5, 1.2, 2.3, "Y");
  ring(c, 12, 5.5, 1.2, 2.3, "Y");
  // cup
  c.poly([[3, 1.5], [13, 1.5], [12, 7], [9.5, 10], [5.5, 10], [3, 7]], (x, y) => (shade(x - 8, y - 5) > 1.5 ? "z" : shade(x - 8, y - 5) > -1.8 ? "y" : "Y"));
  c.rect(7, 10, 2, 2, "Y");
  c.rect(4, 12, 8, 3, "H");
  c.rect(4, 12, 8, 1, "h");
  c.rect(6, 13, 4, 1, "y");
  c.outline("1");
  shadedStar(c, 8, 5, 2.6, 1.2, { rimLit: "w", rimDark: "O", body: "o", inner: "o", core: "z" }, { coreR: 0.4 });
  c.set(5, 2, "w").set(4, 3, "w");
  return c;
}

function iconCodexUnknown(): Cv {
  const c = I16();
  // a plum blob silhouette (puff-shaped "something") with a white "?"
  c.ellipse(8, 9.5, 6.4, 5, (x, y) => (shade(x - 8, y - 9.5) > 1.5 ? "x" : "X"));
  c.ellipse(5, 4.5, 2, 2.4, "X");
  c.ellipse(11, 4.5, 2, 2.4, "X");
  c.outline("1");
  c.set(4, 4, "x").set(10, 4, "x");
  c.put(
    `
.ww.
w..w
...w
..w.
.w..
....
.w..`,
    6,
    6,
  );
  return c;
}

function iconHeat(): Cv {
  const c = I16();
  // pink -> orange flame with a twisty swirl inside
  c.put(
    `
......p.......
.....pp.......
....ppo..p....
...ppoo..pp...
..ppooo.ppo...
..pooyooooo...
.ppoyyyyyoop..
.poyyzzzyyop..
ppoyzzzzzyoop.
poyyzzwzzyyop.
poyzzzzzzzyop.
ppoyzzzzzyoop.
.ppoyyyyyoop..
..pppoooopp...`,
    1,
    1,
  );
  c.outline("1");
  // swirl
  c.pts([[7, 10], [8, 10], [9, 9], [9, 8], [8, 7], [7, 7], [6, 8], [6, 9]], "p");
  c.set(7, 9, "o").set(8, 9, "y");
  c.set(10, 6, "q");
  return c;
}

export const sprites: SpriteDef[] = [
  spr("icon_twist_budget_cuts", 16, 16, [budgetCuts()], "center"),
  spr("icon_twist_filler_overload", 16, 16, [fillerOverload()], "center"),
  spr("icon_twist_rushed_production", 16, 16, [rushedProduction()], "center"),
  spr("icon_twist_censored", 16, 16, [censored()], "center"),
  spr("icon_twist_cliffhanger", 16, 16, [cliffhanger()], "center"),
  spr("icon_twist_power_creep", 16, 16, [powerCreep()], "center"),
  spr("icon_twist_spoilers", 16, 16, [spoilers()], "center"),
  spr("icon_twist_dub_version", 16, 16, [dubVersion()], "center"),
  spr("icon_twist_mid_season_break", 16, 16, [midSeasonBreak()], "center"),
  spr("icon_twist_darker_and_edgier", 16, 16, [darkerAndEdgier()], "center"),
  spr("icon_twist_light_novel_title", 16, 16, [lightNovelTitle()], "center"),
  spr("icon_twist_shounen_rival", 16, 16, [shounenRival()], "center"),
  spr("icon_twist_studio_change", 16, 16, [studioChange()], "center"),
  spr("icon_twist_sequel_hook", 16, 16, [sequelHook()], "center"),
  spr("icon_twist_simulcast_delay", 16, 16, [simulcastDelay()], "center"),
  spr("icon_dreamgem", 16, 16, [iconDreamGem()], "center"),
  spr("icon_copium", 16, 16, [iconCopium()], "center"),
  spr("icon_trophy", 16, 16, [iconTrophy()], "center"),
  spr("icon_codex_unknown", 16, 16, [iconCodexUnknown()], "center"),
  spr("icon_heat", 16, 16, [iconHeat()], "center"),
];
