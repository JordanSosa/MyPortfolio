/**
 * Second evolutions, package A (docs/content/weapons.md §8.3):
 *
 *   w_comet_star                  16x16 x2   Critical Constellation: a heavy comet star, tail to the left (flies along +x)
 *   icon_critical_constellation   16x16
 *   w_iai_line                    48x8  x3   Already Cut: the line (white hairline -> pink afterimage -> wisps), stretched by code
 *   fx_sheath                     12x12 x2   ... the sheath-click glint on Rin's hip
 *   icon_already_cut              16x16
 *   w_heart_big                   16x16 x2   Unrequited Heart: a big magenta heart with a plaster on it (f1 = the beat)
 *   icon_unrequited_heart         16x16
 *   fx_ping                       8x8   x2   Group Chat Lightning: the notification dot over a hop (f1 = with its ring)
 *   icon_group_chat_lightning     16x16
 *   w_konpeito                    8x8   x2   Konpeito Minefield: a star candy in white / grey (tinted by code; f1 = turned)
 *   icon_konpeito_minefield       16x16
 */
import type { SpriteDef } from "../format";
import type { ManifestEntry } from "../manifest";
import { Cv, I16, iconRow, row, spr, twinkle } from "./evo2-util";
import { inHeart, shadedStar } from "./world-util";

// ---------------------------------------------------------------- Critical Constellation
const GOLD = { rimLit: "z", rimDark: "Y", body: "y", inner: "z", core: "w" };

function wCometStar(f: number): Cv {
  const c = new Cv(16, 16);
  // the tail: a wedge that thins out to the left, breaking up at its end (f1: the break-up shifted)
  for (let x = 0; x < 9; x++) {
    const half = 0.4 + (x / 8) * 2.4;
    for (let y = 4; y < 12; y++) {
      if (Math.abs(y - 7.5) > half) continue;
      if (x < 4 && (x + y + f) % 2 === 0) continue;
      c.set(x, y, x < 3 ? "O" : x < 6 ? "o" : "y");
    }
  }
  shadedStar(c, 10, 7.5, 5.4, 2.6, GOLD, { rot: Math.PI / 2, coreR: 1.3, round: 0.5 });
  c.set(9, 6, "w");
  // (a coloured rim, never plum: the comet glows)
  c.outline("O");
  return c;
}

function iconCriticalConstellation(): Cv {
  const c = I16();
  shadedStar(c, 6, 9.5, 5.2, 2.5, GOLD, { coreR: 1.2, round: 0.5 });
  c.outline("1");
  // the constellation, drawn over the outline so it stays a hairline: the big star, two small ones, the twinkle
  c.line(8, 7, 11, 4, "a").line(10, 10, 13, 11, "a").line(13, 11, 14, 7, "a");
  c.set(13, 11, "w").set(12, 11, "v").set(14, 11, "v").set(13, 10, "v").set(13, 12, "v");
  c.set(14, 7, "w").set(2, 3, "w").set(1, 3, "v").set(3, 3, "v").set(2, 2, "v").set(2, 4, "v");
  return twinkle(c, "tr");
}

// ---------------------------------------------------------------- Already Cut
function wIaiLine(f: number): Cv {
  const c = new Cv(48, 8);
  for (let x = 1; x < 47; x++) {
    const tip = Math.min(x - 1, 46 - x);
    if (f === 0) {
      // a white hairline in a thin pink sheath (it must read on a pale floor as well), bare at the tips
      c.set(x, 3, "w");
      if (tip > 3) c.set(x, 4, tip > 8 ? "p" : "q").set(x, 2, tip > 8 ? "p" : "q");
    } else if (f === 1) {
      // the afterimage: pink, opening up
      if (x % 7 !== 3) c.set(x, 3, tip > 5 ? "p" : "q");
      if (tip > 6 && x % 3 !== 0) c.set(x, 4, "q");
      if (tip > 10 && x % 5 === 1) c.set(x, 2, "q");
    } else if ((x * 7) % 11 < 4 && tip > 2) {
      // wisps drifting off the line
      c.set(x, 3 + (x % 4 === 0 ? -1 : x % 4 === 2 ? 1 : 0), x % 3 ? "q" : "p");
    }
  }
  return c;
}

const SHEATH = [
  `
............
.....z......
.....z......
.....w......
....zwz.....
.zzwwwwwzz..
....zwz.....
.....w......
.....z......
.....z......
............
............`,
  `
............
............
...z...z....
....z.z.....
.....w......
....zwz.....
.....w......
....z.z.....
...z...z....
............
............
............`,
];

const ICON_ALREADY_CUT = `
................
.pP.............
.PpP............
..PyY...........
...Yii......w...
....iIi....w....
.....iIi..w.....
......iIiw......
.......iw.......
.......wiIi.....
......w.iIi.....
.....w...iIi....
....w.....iIi...
...w.......iI...
............i...
................`;

// ---------------------------------------------------------------- Unrequited Heart
function heart(c: Cv, cx: number, cy: number, s: number): void {
  c.shape(
    (x, y) => inHeart(x, y, cx, cy, s),
    (x, y) => (x - cx + (y - cy) < -s * 0.55 ? "p" : x - cx + (y - cy) > s * 0.75 ? "Q" : "P"),
  );
  c.set(Math.round(cx - s * 0.5), Math.round(cy - s * 0.45), "w").set(Math.round(cx - s * 0.5) + 1, Math.round(cy - s * 0.45), "q");
}

/** The plaster: a cream strip across the lower right of the heart, a tan pad in its middle. */
function plaster(c: Cv, x: number, y: number): void {
  for (let i = 0; i < 6; i++) {
    c.set(x + i, y - i, "B").set(x + i + 1, y - i, "B");
  }
  c.set(x + 2, y - 2, "h").set(x + 3, y - 2, "h").set(x + 3, y - 3, "h").set(x + 4, y - 3, "h");
}

const HEART_BIG = `
................
..QQQQ....QQQQ..
.QppppQ..QPPPPQ.
QpwqppPQQPPPPPPQ
QpqpPPPPPPPPPPPQ
QpPPPPPPPPPPBBPQ
QPPPPPPPPPPBBPQQ
.QPPPPPPPPhBPPQ.
.QPPPPPPPhhPPQQ.
..QPPPPPBhPPPQ..
...QPPPBBPPQQ...
....QPBBPPQQ....
.....QPPPQQ.....
......QPQQ......
.......QQ.......
................`;

function wHeartBig(f: number): Cv {
  const c = new Cv(16, 16).put(HEART_BIG, 0, 0);
  // f1 = the beat: the lit side flares
  if (f) c.set(2, 5, "p").set(3, 5, "p").set(4, 4, "p").set(5, 4, "p").set(3, 3, "w").set(4, 3, "q").set(2, 4, "w").set(10, 2, "p").set(11, 2, "p");
  return c;
}

function iconUnrequitedHeart(): Cv {
  const c = I16();
  heart(c, 6.5, 8.6, 5.4);
  plaster(c, 5, 12);
  c.outline("1");
  return twinkle(c, "tr");
}

// ---------------------------------------------------------------- Group Chat Lightning
const PING = [
  `
........
..RrrR..
.RrwwrR.
.rrwwrr.
.rrrrrr.
.RrwwrR.
..RrrR..
........`,
  `
.wwwwww.
w.RrrR.w
wRrwwrRw
wrrwwrrw
wrrrrrrw
wRrwwrRw
w.RrrR.w
.wwwwww.`,
];

const ICON_GROUP_CHAT = `
................
................
................
..wwwwwwww......
.wwwwwyywww.....
.wwwwyyWWww.....
.wwwyyyyWWw.....
.WwwwwyyWWW.....
.WWwwyyWWWWrr...
.WWwyWWWWWrwwr..
..aWWWWWWarwwr..
..aa.......rr...
..a.............
................
................
................`;

// ---------------------------------------------------------------- Konpeito Minefield
/** A star candy: a small ball with bumps all around (ramp dark -> light, lit from the top-left). */
function konpeito(c: Cv, cx: number, cy: number, r: number, ramp: string, rot = 0): void {
  const n = r > 2.6 ? 8 : 7;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const lit = Math.cos(a) + Math.sin(a) < -0.3;
    c.set(Math.round(cx + Math.cos(a) * (r + 0.6)), Math.round(cy + Math.sin(a) * (r + 0.6)), lit ? ramp[2] : ramp[0]);
  }
  c.ball(cx, cy, r, r, ramp, { bias: 0.1 });
  c.set(Math.round(cx - r * 0.4), Math.round(cy - r * 0.4), "w");
}

// (white / greys only: the four candy colours are the projectile's tint)
const KONPEITO = [
  `
..x..x..
.xwxxWx.
xwwwWWx.
.xwwWWgx
xWwWWWgx
.xWWWgx.
.xgxggx.
..x.xx..`,
  `
...x.x..
.xxwxWx.
xwxwWWWx
.xwwWWgx
xwwWWWgx
xWWWWgx.
.xxgxgx.
...x.x..`,
];

function iconKonpeitoMinefield(): Cv {
  const c = I16();
  konpeito(c, 5, 5.5, 3.2, "Ppq");
  konpeito(c, 10.5, 10.5, 2.8, "emm", 0.4);
  konpeito(c, 4, 12, 2, "Yyz", 0.2);
  c.outline("1");
  // armed: a tiny red light on the big one
  c.set(6, 6, "r");
  return twinkle(c, "tr");
}

export const sprites: SpriteDef[] = [
  spr("w_comet_star", 16, 16, [wCometStar(0), wCometStar(1)], "center", { fps: 10 }),
  spr("icon_critical_constellation", 16, 16, [iconCriticalConstellation()], "center"),
  spr("w_iai_line", 48, 8, [wIaiLine(0), wIaiLine(1), wIaiLine(2)], "center", { fps: 10 }),
  spr("fx_sheath", 12, 12, SHEATH, "center", { fps: 12 }),
  spr("icon_already_cut", 16, 16, [twinkle(I16().put(ICON_ALREADY_CUT, 0, 0).outline("1"), "tr")], "center"),
  spr("w_heart_big", 16, 16, [wHeartBig(0), wHeartBig(1)], "center", { fps: 5 }),
  spr("icon_unrequited_heart", 16, 16, [iconUnrequitedHeart()], "center"),
  spr("fx_ping", 8, 8, PING, "center", { fps: 8 }),
  spr("icon_group_chat_lightning", 16, 16, [twinkle(I16().put(ICON_GROUP_CHAT, 0, 0).outline("1"), "tr")], "center"),
  spr("w_konpeito", 8, 8, KONPEITO, "center", { fps: 3 }),
  spr("icon_konpeito_minefield", 16, 16, [iconKonpeitoMinefield()], "center"),
];

export const manifest: ManifestEntry[] = [
  row("w_comet_star", 16, 16, 2, "Critical Constellation: a heavy gold comet star flying right (pale core, dark-orange rim), a short broken tail to the left; f1 = the tail flickers"),
  iconRow("icon_critical_constellation", "Evolution: Critical Constellation (Star Shot + Lucky Clover) - a gold star linked to three small stars by pale lines, gold twinkle"),
  row("w_iai_line", 48, 8, 3, "Already Cut: the cut line, stretched along the cut by code - f0 a white hairline in a pink sheath, f1 its pink afterimage, f2 pink wisps"),
  row("fx_sheath", 12, 12, 2, "Already Cut: the sheath-click glint on the hero's hip (a white four-point glint, then its small diagonal echo)"),
  iconRow("icon_already_cut", "Evolution: Already Cut (Petal Slash + Swift Shoes) - a sheathed katana crossed by one white hairline cut, gold twinkle"),
  row("w_heart_big", 16, 16, 2, "Unrequited Heart: a big magenta heart with a cream plaster on it (deep-pink rim); f1 = the beat (a touch bigger)"),
  iconRow("icon_unrequited_heart", "Evolution: Unrequited Heart (Heart Boomerang + Heart Locket) - a magenta heart with a plaster, gold twinkle"),
  row("fx_ping", 8, 8, 2, "Group Chat Lightning: a red notification dot (white mark) over a forwarded hop; f1 = with a white ring"),
  iconRow("icon_group_chat_lightning", "Evolution: Group Chat Lightning (Thunder Bell + Friendship Bracelet) - a speech bubble with a yellow bolt and a red notification dot, gold twinkle"),
  row("w_konpeito", 8, 8, 2, "Konpeito Minefield: a tiny bumpy star candy in white / grey with a dark rim (tinted pink, mint, yellow or lavender by code); f1 = turned a little"),
  iconRow("icon_konpeito_minefield", "Evolution: Konpeito Minefield (Candy Bomb + Chibi Charm) - three star candies (pink, mint, yellow), a tiny red light on the big one, gold twinkle"),
];
