/**
 * Season 2 relic icons, part A (owner: s2-items): the 12 N and 14 R relics
 * ("merch"). 16x16, drawn as cheap-to-lovable merchandise in the base icon
 * style (bold silhouette, auto plum outline, top-left light, one white glint),
 * with the 1-px rarity glint in the top-right corner (relics.md): N grey, R blue.
 */
import type { SpriteDef } from "../format";
import { Cv, I16, LIGHT, inHeart, inStar, micro, rarityGlint, shadedStar, sparkle, spr, type Rarity } from "../sprites/s2-items-util";

const shade = (dx: number, dy: number) => dx * LIGHT[0] + dy * LIGHT[1];

/** Stamp art at (x, y), outline it, then apply the rarity glint. */
function relic(art: string, r: Rarity, x = 1, y = 1, after?: (c: Cv) => void): Cv {
  const c = I16().put(art, x, y);
  c.outline("1");
  after?.(c);
  return rarityGlint(c, r);
}

// =========================================================================== N

const BENT_SPOON = `
.gWWg........
gWwwWg.......
gWwwWg.......
gWWWWg.......
.gWWg........
...gW........
....gW.......
.....gW......
......gWWg...
.........gWWg
............g`;

const KNOCKOFF_KEYCHAIN = `
....GGG.......
...G...G......
...G...G......
....GGG.......
.....G........
.pp..G...pp...
pqqppppppqp...
.pqppppppppP..
.pw0ppp00pP...
.p00pppw0pP...
.ppppp1pppP...
..ppPbppbPP...
...PPPPPPP....`;

function stickerSheet(): Cv {
  const c = I16();
  c.rect(2, 2, 12, 13, "w");
  c.rect(13, 2, 1, 13, "W");
  c.rect(2, 14, 12, 1, "W");
  c.outline("1");
  // 3x3 grid of star stickers; half of them peeled off (just the die-cut outline left)
  const spots: [number, number, boolean][] = [
    [4.5, 4.8, true],
    [8, 4.8, false],
    [11.4, 4.8, true],
    [4.5, 8.4, false],
    [8, 8.4, true],
    [11.4, 8.4, false],
    [4.5, 12, true],
    [8, 12, false],
    [11.4, 12, false],
  ];
  for (const [x, y, on] of spots) {
    c.shape((xx, yy) => inStar(xx, yy, x, y, 5, 2.0, 1.0, 0, 0.3), on ? "y" : "W");
    if (!on) c.set(Math.round(x), Math.round(y), "g");
    else c.set(Math.round(x) - 1, Math.round(y) - 1, "z");
  }
  return rarityGlint(c, "N");
}

function energyDrink(): Cv {
  const c = I16();
  // can body
  c.rect(4, 3, 8, 12, "e");
  c.rect(4, 3, 2, 12, "l");
  c.rect(10, 3, 2, 12, "E");
  c.rect(4, 2, 8, 1, "g");
  c.rect(5, 1, 6, 1, "W");
  c.rect(4, 14, 8, 1, "G");
  // lightning bolt
  c.pts([[8, 4], [7, 5], [7, 6], [6, 7], [7, 7], [8, 7], [9, 7], [8, 8], [8, 9], [7, 10]], "y");
  c.outline("1");
  c.set(7, 1, "w").set(5, 4, "m");
  // red EXP stamp slapped across the can
  c.rect(2, 9, 12, 7, "r");
  c.rect(3, 10, 10, 5, "w");
  micro(c, "EXP", 3, 10, "R", 1);
  return rarityGlint(c, "N");
}

const CAPSULE_LID = `
....pppp.
..pqqqppP
.pqwqpppP
.pqqpppPP
pppppPPP.
PPPPPP...`;
function emptyCapsule(): Cv {
  const c = I16();
  // bottom half (white bowl, empty inside)
  c.ellipse(7, 11, 5.6, 3.6, (x, y) => (y < 11 ? null : shade(x - 7, y - 11) > 0 ? "w" : "W"));
  c.ellipse(7, 11, 5.6, 1.3, "g");
  c.ellipse(7, 11.2, 4.4, 0.7, "G");
  // the pink lid, popped off and tipped back
  c.put(CAPSULE_LID, 6, 1);
  c.outline("1");
  // one sad sparkle
  c.set(3, 4, "g").set(2, 4, "G").set(4, 4, "G").set(3, 3, "G").set(3, 5, "G");
  return rarityGlint(c, "N");
}

function wikiPrintout(): Cv {
  const c = I16();
  c.poly([[2, 1], [11, 1], [14, 4], [14, 15], [2, 15]], "w");
  c.rect(13, 5, 1, 10, "W");
  c.pts([[11, 1], [11, 2], [11, 3], [11, 4], [12, 4], [13, 4]], "W");
  c.pts([[12, 2], [12, 3], [13, 3]], "g");
  // text lines + highlighter streaks
  for (let y = 4; y <= 13; y += 2) for (let x = 3; x <= 12; x++) if ((x + y * 3) % 7 !== 0) c.set(x, y, "g");
  c.rect(3, 6, 7, 1, "y");
  c.rect(5, 10, 6, 1, "q");
  c.rect(3, 12, 4, 1, "y");
  c.outline("1");
  return rarityGlint(c, "N");
}

function lanyard(): Cv {
  const c = I16();
  // strap: a V from the top corners
  c.line(2, 0, 6, 6, "u");
  c.line(3, 0, 7, 6, "U");
  c.line(13, 0, 9, 6, "u");
  c.line(12, 0, 8, 6, "U");
  c.rect(7, 6, 2, 2, "g");
  // badge
  c.rect(3, 8, 10, 7, "w");
  c.rect(3, 8, 10, 2, "p");
  c.rect(12, 10, 1, 5, "W");
  c.outline("1");
  // "STAFF?" (squint)
  micro(c, "ST", 4, 10, "2", 1);
  c.pts([[11, 10], [12, 10], [12, 11], [11, 12], [11, 14]], "r");
  return rarityGlint(c, "N");
}

function usedBandage(): Cv {
  const c = I16();
  // a diagonal rounded strip
  const inStrip = (x: number, y: number) => {
    const u = (x - 7.5 + (y - 8)) / Math.SQRT2;
    const v = (x - 7.5 - (y - 8)) / Math.SQRT2;
    return Math.abs(u) < 7.4 && Math.abs(v) < 2.6 && Math.hypot(Math.max(0, Math.abs(u) - 5), Math.abs(v)) < 2.6;
  };
  c.shape(inStrip, (x, y) => (x - y > 1 ? "p" : "q"));
  // pad with a heart
  c.shape((x, y) => inStrip(x, y) && Math.abs(x - 7.5 + (y - 8)) < 5, (x, y) => (x - y > 1 ? "q" : "t"));
  c.shape((x, y) => inHeart(x, y, 7.6, 7.8, 2.0), "r");
  // breathing holes
  for (const [x, y] of [[3, 12], [4, 13], [12, 3], [13, 4]] as [number, number][]) c.set(x, y, "P");
  c.outline("1");
  // used: one corner curled + a little smudge
  c.set(13, 2, "P").set(6, 6, "q");
  return rarityGlint(c, "N");
}

function offbrandWatch(): Cv {
  const c = I16();
  // straps
  c.rect(5, 0, 6, 4, "x");
  c.rect(5, 12, 6, 4, "x");
  c.rect(6, 1, 1, 2, "f").set(6, 13, "f").set(6, 14, "f");
  // chunky case + LCD
  c.rect(1, 3, 14, 10, "G");
  c.rect(1, 3, 14, 1, "g");
  c.rect(2, 5, 12, 6, "m");
  c.rect(2, 10, 12, 1, "l");
  c.outline("1");
  // 88:88 (segments squeezed shoulder to shoulder)
  micro(c, "88", 2, 5, "E", 0);
  c.set(8, 6, "E").set(8, 8, "E");
  micro(c, "88", 9, 5, "E", 0);
  c.set(14, 7, "y");
  return rarityGlint(c, "N");
}

function regionLockedDvd(): Cv {
  const c = I16();
  c.rect(2, 1, 12, 14, "n");
  c.rect(2, 1, 2, 14, "U");
  c.rect(4, 2, 9, 12, "u");
  c.outline("1");
  // globe + prohibition sign
  c.disc(8.5, 8, 3.6, (x, y) => ((x + y) % 3 === 0 ? "e" : "c"));
  c.each((x, y) => {
    const d = Math.hypot(x - 8.5, y - 8);
    if (d >= 3.6 && d <= 4.8) return "r";
    if (d < 3.8 && Math.abs(x - 8.5 + (y - 8)) < 0.8) return "r";
    return null;
  });
  c.set(6, 6, "a");
  c.set(3, 2, "v");
  return rarityGlint(c, "N");
}

function chocolateCoin(): Cv {
  const c = I16();
  c.disc(7.5, 8, 6.6, (x, y) => {
    const d = Math.hypot(x - 7.5, y - 8);
    const l = shade(x - 7.5, y - 8) / 6.6;
    if (d > 5.4) return l > 0.1 ? "y" : "Y";
    return l > 0.45 ? "z" : "y";
  });
  shadedStar(c, 7.5, 8.3, 3.8, 1.9, { rimLit: "O", rimDark: "z", body: "Y", inner: "Y", core: "Y" }, { coreR: 0 });
  // the bite (top-right): foil torn, chocolate showing
  for (const [bx, by, r] of [[13, 3, 2.6], [11, 1.6, 2.0]] as [number, number, number][]) c.disc(bx, by, r, ".");
  c.each((x, y, k) => {
    if (k === "." || x < 8 || y > 7) return null;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => c.get(x + dx, y + dy) === "." && Math.hypot(x + dx - 12.5, y + dy - 2.5) < 4);
    return near ? "d" : null;
  });
  c.outline("1");
  c.set(4, 4, "w").set(3, 5, "w");
  return rarityGlint(c, "N");
}

function trafficCone(): Cv {
  const c = I16();
  c.poly([[7, 1], [9, 1], [13, 13], [3, 13]], (x, y) => (y >= 6 && y <= 8 ? (x < 8 ? "w" : "W") : x < 8 ? "o" : "O"));
  c.rect(1, 13, 14, 2, "O");
  c.rect(1, 13, 14, 1, "o");
  c.outline("1");
  // tyre mark: a dark tread track rolling across
  for (let x = 1; x <= 14; x++) {
    const y = Math.round(11 - x * 0.45);
    if (c.get(x, y) !== "." && c.get(x, y) !== "1") c.set(x, y, (x % 2 ? "2" : "x"));
  }
  c.set(7, 2, "z");
  return rarityGlint(c, "N");
}

// =========================================================================== R

function acrylicStand(): Cv {
  const c = I16();
  // clear acrylic plate with a rainbow edge
  const rb = ["r", "o", "y", "l", "c", "u", "i", "p"];
  c.rect(3, 1, 10, 12, "a");
  c.each((x, y) => {
    if (x < 3 || x > 12 || y < 1 || y > 12) return null;
    if (x === 3 || x === 12 || y === 1 || y === 12) return rb[(x + y) % rb.length];
    return null;
  });
  // printed chibi (pink twin-tails, big eyes)
  c.disc(7.6, 6, 2.8, "p");
  c.disc(7.6, 6.6, 2.0, "s");
  c.rect(5, 4, 5, 1, "p");
  c.set(4, 7, "p").set(11, 7, "p").set(4, 8, "P").set(11, 8, "P");
  c.set(6, 6, "0").set(9, 6, "0").set(6, 7, "b").set(9, 7, "b");
  c.rect(6, 9, 4, 3, "w");
  c.set(7, 9, "p").set(8, 9, "p");
  // base
  c.rect(2, 13, 12, 2, "v");
  c.rect(2, 13, 12, 1, "a");
  c.outline("1");
  c.set(4, 2, "w");
  return rarityGlint(c, "R");
}

function smudgedPoster(): Cv {
  const c = I16();
  // a rolled-up poster tube lying diagonally, rubber band round the middle
  const u = (x: number, y: number) => ((x - 2) + (13 - y)) / Math.SQRT2; // along the tube
  const v = (x: number, y: number) => ((x - 2) - (13 - y)) / Math.SQRT2; // across
  c.shape(
    (x, y) => u(x, y) > 0 && u(x, y) < 15 && Math.abs(v(x, y)) < 2.7,
    (x, y) => (v(x, y) > 1.2 ? "F" : v(x, y) < -1.0 ? "w" : "B"),
  );
  // band
  c.shape((x, y) => Math.abs(u(x, y) - 6.5) < 0.7 && Math.abs(v(x, y)) < 2.7, "r");
  // rolled end: a spiral cap at the top-right
  c.disc(12.2, 3.6, 2.6, "B");
  c.outline("1");
  c.pts([[12, 3], [13, 3], [13, 4], [12, 5], [11, 4], [11, 3]], "F");
  c.set(12, 4, "h");
  // the smudged signature scrawl along the tube
  c.pts([[4, 11], [5, 10], [5, 12], [6, 11], [7, 10]], "x");
  c.pts([[9, 7], [10, 6], [10, 8], [11, 7]], "x");
  c.pts([[6, 12], [7, 11], [10, 9]], "g");
  return rarityGlint(c, "R");
}

function pencilCase(): Cv {
  const c = I16();
  // a pencil peeking out
  c.line(10, 1, 12, 5, "y");
  c.line(11, 1, 13, 5, "Y");
  c.set(10, 0, "h").set(11, 0, "h");
  // pastel pouch
  c.ellipse(7.5, 10, 7, 4.6, (x, y) => (y < 8 ? "j" : shade(x - 7.5, y - 10) > 1.5 ? "j" : y > 12 ? "i" : "j"));
  c.ellipse(7.5, 10, 7, 4.6, (x, y) => (shade(x - 7.5, y - 10) < -2 ? "i" : null));
  // zip line
  c.line(2, 8, 13, 8, "I");
  c.outline("1");
  // cat-face zip pull
  c.put(
    `
1.1.
1w1.
1ww1
.11.`.replace(/\n1\.1\./, "\n1.1."),
    3,
    8,
  );
  c.set(4, 10, "0");
  c.set(5, 6, "w");
  return rarityGlint(c, "R");
}

function pocketTissues(): Cv {
  const c = I16();
  // tissue popping out of the slit
  c.poly([[6, 1], [10, 2], [11, 6], [5, 6]], (x, y) => (x < 8 ? "w" : "W"));
  // pack
  c.rect(1, 5, 14, 9, "v");
  c.rect(1, 5, 14, 2, "a");
  c.rect(1, 12, 14, 2, "u");
  c.rect(5, 6, 6, 1, "U");
  c.outline("1");
  // crying face
  c.pts([[4, 9], [5, 8], [6, 9]], "2");
  c.pts([[9, 9], [10, 8], [11, 9]], "2");
  c.pts([[4, 10], [4, 11], [11, 10], [11, 11]], "w");
  c.pts([[7, 11], [8, 11]], "2");
  c.set(7, 2, "w");
  return rarityGlint(c, "R");
}

function phoneStrap(): Cv {
  const c = I16();
  // cord loop
  c.each((x, y) => {
    const d = Math.hypot((x - 5) / 3.2, (y - 4.5) / 3.8);
    return d > 0.7 && d < 1.0 ? "p" : null;
  });
  c.line(6, 8, 8, 9, "P");
  // glowing star charm
  shadedStar(c, 10, 10.5, 4.6, 2.2, { rimLit: "z", rimDark: "Y", body: "y", inner: "y", core: "w" }, { coreR: 1.2 });
  c.outline("1");
  c.halo(["&"]);
  c.set(8, 9, "w");
  return rarityGlint(c, "R");
}

function rubberDuck(): Cv {
  const c = I16();
  // body + head
  c.ellipse(7, 11.2, 6, 3.4, (x, y) => (shade(x - 7, y - 11) > 1 ? "z" : y > 12 ? "Y" : "y"));
  c.ball(9.6, 7, 3.2, 3.0, "Yyyz");
  // beak
  c.pts([[13, 7], [14, 7], [13, 8], [14, 8]], "o");
  c.set(14, 8, "O");
  // captain's hat (navy, gold emblem, white top)
  c.rect(7, 2, 6, 2, "w");
  c.rect(6, 4, 8, 2, "n");
  c.rect(12, 5, 3, 1, "x");
  c.outline("1");
  c.set(9, 4, "y");
  c.set(11, 7, "0").set(11, 6, "w");
  c.set(4, 10, "Y").set(5, 9, "Y").set(6, 10, "Y");
  return rarityGlint(c, "R");
}

function catEarHeadband(): Cv {
  const c = I16();
  // headband arc
  c.each((x, y) => {
    const d = Math.hypot((x - 7.5) / 6.6, (y - 12) / 7.4);
    return d > 0.82 && d < 1.0 && y < 14 ? (x < 7 ? "q" : "p") : null;
  });
  // cat ears (outer pink, inner light)
  c.poly([[2, 7], [3.2, 1], [7, 5]], "p");
  c.poly([[13, 7], [11.8, 1], [8, 5]], "p");
  c.poly([[3.2, 6], [3.8, 3], [5.6, 5]], "q");
  c.poly([[11.8, 6], [11.2, 3], [9.4, 5]], "q");
  c.outline("1");
  c.set(4, 3, "w");
  return rarityGlint(c, "R");
}

function chopsticks(): Cv {
  const c = I16();
  c.line(2, 2, 13, 13, "r");
  c.line(3, 2, 14, 13, "R");
  c.line(13, 2, 2, 13, "u");
  c.line(12, 2, 1, 13, "U");
  // tips (bare wood)
  c.pts([[12, 12], [13, 13], [14, 13], [2, 12], [1, 13], [2, 13]], "h");
  c.outline("1");
  c.set(3, 3, "q").set(12, 3, "v");
  return rarityGlint(c, "R");
}

function hypeTowel(): Cv {
  const c = I16();
  // towel waving: top and bottom edges ripple together
  const top = (x: number) => 3 + Math.round(Math.sin(x * 0.5) * 1.2);
  for (let x = 1; x <= 14; x++) for (let y = top(x); y <= top(x) + 8; y++) c.set(x, y, y === top(x) || y === top(x) + 8 ? "p" : x > 11 ? "W" : "w");
  c.outline("1");
  // fringe
  for (let x = 2; x <= 13; x += 2) c.set(x, top(x) + 10, "p");
  // "SSS" in bold red
  for (let i = 0; i < 3; i++) {
    const x = 2 + i * 4;
    micro(c, "S", x, top(x + 1) + 2, "r");
  }
  c.set(2, 4, "w");
  return rarityGlint(c, "R");
}

function fanClubCard(): Cv {
  const c = I16();
  c.rect(1, 3, 14, 10, "p");
  c.rect(1, 3, 14, 2, "q");
  c.rect(1, 11, 14, 2, "P");
  c.outline("1");
  // holographic heart
  c.shape(
    (x, y) => inHeart(x, y, 5, 8, 2.8),
    (x, y) => ["c", "j", "a", "q", "z"][(x + y) % 5],
  );
  c.set(4, 7, "w");
  // member number + name lines
  c.rect(9, 6, 5, 1, "w");
  c.rect(9, 8, 4, 1, "q");
  c.rect(9, 10, 3, 1, "q");
  return rarityGlint(c, "R");
}

function instantRamen(): Cv {
  const c = I16();
  // chopsticks stuck in
  c.line(9, 0, 11, 6, "h");
  c.line(11, 0, 12, 6, "H");
  // cup
  c.poly([[2, 6], [14, 6], [12.5, 15], [3.5, 15]], (x, y) => (y >= 9 && y <= 11 ? "r" : x < 7 ? "w" : "W"));
  c.rect(2, 6, 13, 2, "B");
  c.rect(4, 6, 8, 1, "F");
  c.outline("1");
  c.pts([[6, 10], [7, 10]], "z");
  // steam
  c.pts([[4, 4], [5, 3], [4, 2], [5, 1]], "W");
  c.pts([[7, 4], [6, 3], [7, 2]], "W");
  c.set(4, 13, "w");
  return rarityGlint(c, "R");
}

function battlePlaylist(): Cv {
  const c = I16();
  c.rect(1, 3, 14, 10, "x");
  c.rect(1, 3, 14, 1, "f");
  c.rect(3, 5, 10, 5, "B");
  c.rect(4, 10, 8, 3, "X");
  c.outline("1");
  // reels
  c.rect(4, 7, 2, 2, "x");
  c.rect(10, 7, 2, 2, "x");
  c.rect(6, 7, 4, 2, "h");
  // skull sticker (white, top-left of the label)
  c.put(
    `
.www.
w0w0w
.www.
.w.w.`,
    5,
    5,
    {},
  );
  c.set(5, 11, "g").set(10, 11, "g");
  return rarityGlint(c, "R");
}

function sparklyHairClip(): Cv {
  const c = I16();
  // clip bar
  c.rect(1, 10, 11, 2, "g");
  c.rect(1, 10, 11, 1, "W");
  // star
  shadedStar(c, 9, 7.6, 5.6, 2.8, { rimLit: "q", rimDark: "P", body: "p", inner: "q", core: "w" }, { coreR: 0.8 });
  c.outline("1");
  c.set(7, 5, "w");
  sparkle(c, 2, 3, "w", "q");
  sparkle(c, 14, 13, "w", "z");
  return rarityGlint(c, "R");
}

function luckyCat(): Cv {
  const c = I16();
  // body + head
  c.ellipse(7, 11.4, 5, 3.6, (x, y) => (shade(x - 7, y - 11) < -1.5 ? "W" : "w"));
  c.ball(7, 6.2, 4.2, 3.6, "Wwww");
  // ears
  c.poly([[3, 4], [3.6, 0.6], [6, 3]], "w");
  c.poly([[11, 4], [10.4, 0.6], [8, 3]], "w");
  // raised paw
  c.ellipse(12.5, 4, 1.6, 2.2, "w");
  // gold coin held at the belly
  c.disc(7, 11.5, 2.4, (x, y) => (shade(x - 7, y - 11.5) > 0 ? "y" : "Y"));
  c.outline("1");
  c.set(4, 2, "p").set(10, 2, "p");
  // face: happy closed eyes, blush, red collar + bell
  c.pts([[5, 6], [4, 5]], "0");
  c.pts([[9, 6], [10, 5]], "0");
  c.set(4, 7, "b").set(10, 7, "b");
  c.rect(4, 9, 7, 1, "r");
  c.set(7, 9, "y");
  c.set(6, 11, "z");
  return rarityGlint(c, "R");
}

export const sprites: SpriteDef[] = [
  spr("icon_relic_bent_spoon", 16, 16, [relic(BENT_SPOON, "N", 1, 2, (c) => sparkle(c, 12, 2, "w", "g"))], "center"),
  spr("icon_relic_knockoff_keychain", 16, 16, [relic(KNOCKOFF_KEYCHAIN, "N", 1, 1)], "center"),
  spr("icon_relic_sticker_sheet", 16, 16, [stickerSheet()], "center"),
  spr("icon_relic_expired_energy_drink", 16, 16, [energyDrink()], "center"),
  spr("icon_relic_empty_capsule", 16, 16, [emptyCapsule()], "center"),
  spr("icon_relic_wiki_printout", 16, 16, [wikiPrintout()], "center"),
  spr("icon_relic_convention_lanyard", 16, 16, [lanyard()], "center"),
  spr("icon_relic_used_bandage", 16, 16, [usedBandage()], "center"),
  spr("icon_relic_offbrand_watch", 16, 16, [offbrandWatch()], "center"),
  spr("icon_relic_region_locked_dvd", 16, 16, [regionLockedDvd()], "center"),
  spr("icon_relic_chocolate_coin", 16, 16, [chocolateCoin()], "center"),
  spr("icon_relic_traffic_cone", 16, 16, [trafficCone()], "center"),
  spr("icon_relic_acrylic_stand", 16, 16, [acrylicStand()], "center"),
  spr("icon_relic_smudged_poster", 16, 16, [smudgedPoster()], "center"),
  spr("icon_relic_pencil_case", 16, 16, [pencilCase()], "center"),
  spr("icon_relic_pocket_tissues", 16, 16, [pocketTissues()], "center"),
  spr("icon_relic_phone_strap", 16, 16, [phoneStrap()], "center", { pal: { "&": "#ffe14d73" } }),
  spr("icon_relic_rubber_duck", 16, 16, [rubberDuck()], "center"),
  spr("icon_relic_cat_ear_headband", 16, 16, [catEarHeadband()], "center"),
  spr("icon_relic_mismatched_chopsticks", 16, 16, [chopsticks()], "center"),
  spr("icon_relic_hype_towel", 16, 16, [hypeTowel()], "center"),
  spr("icon_relic_fan_club_card", 16, 16, [fanClubCard()], "center"),
  spr("icon_relic_instant_ramen", 16, 16, [instantRamen()], "center"),
  spr("icon_relic_battle_playlist", 16, 16, [battlePlaylist()], "center"),
  spr("icon_relic_sparkly_hair_clip", 16, 16, [sparklyHairClip()], "center"),
  spr("icon_relic_lucky_cat", 16, 16, [luckyCat()], "center"),
];
