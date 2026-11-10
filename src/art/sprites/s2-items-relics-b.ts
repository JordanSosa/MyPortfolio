/**
 * Season 2 relic icons, part B (owner: s2-items): the 12 SR, 10 SSR, 6 UR,
 * 4 LR and 3 MYTHIC relics ("merch"). 16x16, same construction as part A
 * (bold silhouette, auto plum outline, top-left light, one white glint) and
 * the rarity glint in the top-right corner (relics.md). Higher rarities get
 * richer materials: gold trims, glows, sparkles, and for MYTHIC a glitch.
 */
import type { SpriteDef } from "../format";
import { Cv, GLOW, I16, LIGHT, inHeart, inStar, micro, rarityGlint, ring, shadedStar, sparkle, spr, type Rarity } from "../sprites/s2-items-util";

const shade = (dx: number, dy: number) => dx * LIGHT[0] + dy * LIGHT[1];

/** Stamp art at (x, y), outline it, run `after`, then apply the rarity glint. */
function relic(art: string, r: Rarity, x = 1, y = 1, after?: (c: Cv) => void): Cv {
  const c = I16().put(art, x, y);
  c.outline("1");
  after?.(c);
  return rarityGlint(c, r);
}

/** Translucent keys used by glass / cel / card relics. */
const GLASS: Record<string, string> = {
  ...GLOW,
  A: "#bafff6a0", // aqua glass
  V: "#b0d8ff90", // light-blue glass
  K: "#5aa8ff70", // blue glass shadow
  Z: "#ffffffc0", // glass glint
};

// =========================================================================== SR

/** Grumpy plush of your rival: round bear plush, red headband with flapping tails, angry brows. */
const RIVAL_PLUSHIE = `
.hh......hh...
hHHh....hHHh..
hHhhhhhhhhHh..
.hhBBhhhhhhH..
rrrrrrrrrrrrr.
RrrrwrrrrrrRrRr
.hhhhhhhhhhH.Rr
.h01hhhh10hH..R
.h0whhhhw0hH...
.hbhh111hbhH...
..hhh.1.hhH....
..HhhhhhhhH....
.hHhBBBBhhHH...
.HH.HHHH.HHH...`;

function rivalPlushie(): Cv {
  const c = I16().put(RIVAL_PLUSHIE, 1, 1);
  c.outline("1");
  // stitched seam down the belly
  c.set(7, 12, "H");
  return rarityGlint(c, "SR");
}

function swordKeychain(): Cv {
  const c = I16();
  // huge blade from bottom-left to top-right
  for (let i = 0; i <= 9; i++) {
    const x = 4 + i;
    const y = 11 - i;
    c.set(x, y, "W").set(x - 1, y, "w").set(x, y + 1, "g");
  }
  c.set(13, 2, "w").set(14, 1, "w");
  // cross guard (gold) + red grip + pommel
  c.line(1, 10, 5, 14, "Y");
  c.line(2, 10, 5, 13, "y");
  c.pts([[3, 12], [2, 13], [1, 14]], "r");
  c.set(4, 13, "R");
  c.outline("1");
  // the tiny ring it hangs from + chain link (plum metal)
  ring(c, 2.5, 3.5, 1.2, 2.0, "G");
  c.set(1, 2, "g").set(2, 2, "g");
  c.line(4, 5, 5, 7, "g");
  c.set(9, 6, "z");
  return rarityGlint(c, "SR");
}

function lightNovel(): Cv {
  const c = I16();
  // thick paperback in 3/4: cover face + chunky page block on the right
  c.rect(2, 2, 9, 13, "p");
  c.rect(2, 2, 1, 13, "P");
  c.poly([[11, 2], [14, 4], [14, 15], [11, 15]], "B");
  c.rect(11, 4, 3, 11, (x, y) => (y % 2 === 0 ? "B" : "W"));
  c.rect(11, 3, 1, 1, "B");
  c.outline("1");
  // cover: an anime eye + a very long title in tiny text rows
  c.rect(4, 3, 6, 1, "w");
  c.rect(4, 5, 5, 1, "w");
  c.rect(4, 7, 6, 1, "q");
  c.rect(4, 9, 4, 1, "q");
  c.rect(3, 4, 7, 0, "q");
  c.ellipse(6.5, 12, 2.5, 1.6, "w");
  c.set(6, 12, "u").set(7, 12, "U").set(6, 11, "1").set(7, 11, "1").set(5, 11, "1").set(8, 11, "1");
  c.set(7, 12, "0");
  c.set(6, 12, "w");
  // "1" volume tab
  c.set(10, 3, "y").set(10, 4, "y");
  return rarityGlint(c, "SR");
}

function themeSongCd(): Cv {
  const c = I16();
  // disc peeking out on the right (rainbow sheen)
  c.disc(10, 8, 5, (x, y) => {
    const a = Math.atan2(y - 8, x - 10);
    const sheen = ["v", "a", "m", "z", "q", "j"];
    return sheen[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % 6];
  });
  c.disc(10, 8, 1.2, "g");
  c.set(10, 8, ".");
  // sleeve with a sparkly star cover
  c.rect(1, 3, 10, 11, "I");
  c.rect(1, 3, 10, 1, "i");
  c.rect(1, 3, 1, 11, "i");
  shadedStar(c, 6, 8.6, 4.2, 2.0, { rimLit: "z", rimDark: "Y", body: "y", inner: "y", core: "w" }, { coreR: 0.7 });
  c.outline("1");
  c.set(10, 8, "1");
  c.set(3, 5, "w").set(9, 12, "j");
  return rarityGlint(c, "SR");
}

const COSPLAY_WIG = `
...uuuvv....
..uvvvvuuu..
.uvvuuuuuuU.
.uvuuuuuuuUU
uvuuggggguUU
uuu.gWWWg.UU
uuu.gWWWg.Uu
uUu.gWWWg.UU
uUu..gWg..UU
UU....g...UU
UU....g...U.
U....GgG..U.
....GgggG...`;

function cosplayWig(): Cv {
  return relic(COSPLAY_WIG, "SR", 2, 2, (c) => {
    c.set(4, 3, "w");
  });
}

function festivalGoldfish(): Cv {
  const c = I16();
  // knotted bag: water body, clear top, knot + red string
  c.ellipse(7.5, 10, 6, 4.6, (x, y) => (y < 7 ? "V" : shade(x - 7.5, y - 10) > 1.5 ? "a" : "A"));
  c.poly([[4, 7], [11, 7], [8.5, 3], [6.5, 3]], "V");
  c.rect(6, 2, 3, 2, "W");
  c.outline("1");
  c.set(9, 1, "r").set(10, 0, "r").set(11, 1, "r");
  // the goldfish (faces left, fancy tail right)
  c.put(
    `
..ooo..rr
.oyoooorR
o0woooRr.
.oooOo.rR
..OO....r`,
    3,
    8,
  );
  // water line + bubbles + glints
  c.rect(2, 7, 12, 1, "c");
  c.set(4, 8, "Z").set(3, 10, "Z").set(12, 6, "w");
  return rarityGlint(c, "SR");
}

function mascotHead(): Cv {
  const c = I16();
  // round ears + head (pastel yellow mascot), neck hole at the bottom
  c.disc(3, 3.5, 2.2, "Y");
  c.disc(12, 3.5, 2.2, "Y");
  c.ball(7.5, 8, 6.4, 6.2, "OYyyz");
  c.disc(3, 3.5, 1, "o");
  c.disc(12, 3.5, 1, "o");
  c.rect(4, 14, 8, 1, "O");
  c.outline("1");
  // dopey face: eyes far apart, open smile with tongue, blush
  c.rect(3, 7, 2, 2, "0").set(3, 7, "w");
  c.rect(11, 7, 2, 2, "0").set(11, 7, "w");
  c.put(
    `
1....1
.1111.
.1rr1.
..11..`,
    5,
    9,
  );
  c.set(2, 10, "b").set(13, 10, "b");
  c.set(5, 3, "z");
  return rarityGlint(c, "SR");
}

function pityKeychain(): Cv {
  const c = I16();
  // counter body (pink clicker) hanging from a ring
  c.rect(2, 6, 12, 9, "p");
  c.rect(2, 6, 12, 1, "q");
  c.rect(2, 6, 1, 9, "q");
  c.rect(3, 14, 11, 1, "P");
  c.rect(13, 7, 1, 8, "P");
  // clicker button
  c.rect(10, 4, 3, 2, "g");
  c.outline("1");
  // LCD showing 89
  c.rect(4, 8, 9, 6, "m");
  c.rect(4, 8, 9, 1, "l");
  micro(c, "89", 5, 9, "E");
  // ring
  ring(c, 4.5, 2.5, 1.3, 2.2, "g");
  c.set(3, 1, "w");
  return rarityGlint(c, "SR");
}

/** Headband seen from the front, curving round an invisible forehead, two tails fluttering right. */
function headband(c: Cv, lit: string, mid: string, dark: string, y0: number): void {
  for (let x = 1; x <= 11; x++) {
    const yt = Math.round(y0 + 0.07 * (x - 6) * (x - 6));
    c.set(x, yt, lit).set(x, yt + 1, mid).set(x, yt + 2, mid).set(x, yt + 3, dark);
  }
  // knot + tails
  c.put(
    `
.${lit}${lit}..
${mid}${mid}${mid}${lit}${lit}
${mid}${dark}${mid}${mid}${dark}
.${dark}${mid}.${mid}
..${mid}${dark}.
...${mid}.`.replace(/ /g, "."),
    11,
    y0 + 1,
  );
}

function shonenHeadband(): Cv {
  const c = I16();
  headband(c, "w", "w", "g", 6);
  c.outline("1");
  // red flame emblem in the centre of the band
  c.put(
    `
..r..
.rr.r
.ryrr
rryzr
.rrr.`,
    4,
    4,
  );
  c.selout({}, "1", false, (x, y) => y <= 5);
  c.set(2, 7, "w").set(1, 8, "W");
  c.set(13, 4, "w").set(14, 5, "w");
  return rarityGlint(c, "SR");
}

function compactMirror(): Cv {
  const c = I16();
  // lid (open, upright) with the mirror, then the base (heart)
  c.shape(
    (x, y) => inHeart(x, y, 7.5, 5.5, 5.4),
    (x, y) => (inHeart(x, y, 7.5, 5.6, 3.9) ? (shade(x - 7.5, y - 5) > 0.8 ? "w" : x + y < 13 ? "a" : "v") : "p"),
  );
  c.ellipse(7.5, 12.6, 5.6, 2.2, (x, y) => (y < 12 ? "q" : "P"));
  c.rect(7, 10, 2, 1, "Y");
  c.outline("1");
  c.set(4, 4, "w").set(5, 3, "w");
  sparkle(c, 13, 3, "w", "q");
  c.set(1, 13, "z");
  return rarityGlint(c, "SR");
}

function mechaModelKit(): Cv {
  const c = I16();
  // grey sprue frame with runners
  c.rect(1, 2, 14, 12, "g");
  c.rect(2, 3, 12, 10, ".");
  c.rect(1, 7, 14, 1, "g");
  c.rect(7, 2, 1, 12, "g");
  // parts: head, arm, chest plate, and one empty slot (B-14)
  c.rect(3, 4, 3, 2, "w").set(3, 4, "w").set(5, 5, "W");
  c.rect(9, 4, 4, 2, "u").set(9, 4, "v");
  c.rect(3, 9, 3, 3, "r").set(3, 9, "q");
  c.outline("1");
  c.rect(1, 2, 14, 1, "W");
  // gates (little nubs connecting parts), empty slot shows only nubs
  c.set(4, 6, "g").set(10, 6, "g").set(4, 8, "g");
  c.set(10, 8, "g").set(10, 12, "g");
  c.set(10, 10, "G").set(9, 10, "G").set(11, 10, "G");
  // tag
  c.set(14, 14, "y");
  return rarityGlint(c, "SR");
}

function magnifyingGlass(): Cv {
  const c = I16();
  // handle (brown, bottom-right)
  c.line(10, 10, 13, 13, "H");
  c.line(11, 10, 14, 13, "d");
  c.line(10, 11, 13, 14, "h");
  // lens: gold rim + glass
  ring(c, 6.5, 6.5, 3.7, 5.2, (x, y) => (shade(x - 6.5, y - 6.5) > 0 ? "y" : "Y"));
  c.disc(6.5, 6.5, 3.6, (x, y) => (shade(x - 6.5, y - 6.5) > 1.6 ? "a" : "v"));
  c.outline("1");
  // the "?"
  c.put(
    `
.11.
1..1
...1
..1.
.1..
....
.1..`,
    5,
    3,
  );
  c.set(4, 4, "w").set(3, 5, "w");
  return rarityGlint(c, "SR");
}

// =========================================================================== SSR

/** Hand-drawn: a knotted neck loop on the left, two tails streaming right in the dramatic wind, fringed ends. */
const PROTAGONIST_SCARF = `
............o.o
..........ooooo
.......oooorrRr
..ooo.oorrrRR..
.orrroorrRRR...
.rRRrrrRRR.....
.rR.RRRR.......
.rR............
.rR..oooo......
.rRooorrroo.o.o
..RRrrrRRrrooooo
...RRR...RRRrRr.
...........R.R..`;

function protagonistScarf(): Cv {
  return relic(PROTAGONIST_SCARF, "SSR", 0, 1, (c) => {
    c.set(2, 4, "z");
    c.pts([[6, 14], [7, 14], [8, 14]], "W"); // wind lines
    c.pts([[4, 0], [5, 0], [6, 0]], "W");
  });
}

function transformationBrooch(): Cv {
  const c = I16();
  const wing = `
.ww..
wWww.
.wWww
..wWw
...ww`;
  c.put(wing, 0, 3);
  c.put(wing, 11, 3, { flip: true });
  // heart gem with gold bezel
  c.shape((x, y) => inHeart(x, y, 7.5, 8, 4.6), "Y");
  c.shape(
    (x, y) => inHeart(x, y, 7.5, 7.8, 3.5),
    (x, y) => (shade(x - 7.5, y - 8) > 1.2 ? "q" : shade(x - 7.5, y - 8) > -1 ? "p" : "P"),
  );
  c.rect(7, 2, 2, 2, "y");
  c.outline("1");
  c.set(6, 6, "w").set(5, 7, "w");
  c.set(7, 2, "z");
  sparkle(c, 2, 13, "w", "y");
  return rarityGlint(c, "SSR");
}

function abandonedHeadband(): Cv {
  const c = I16();
  // the headband, still tied in a loop, dropped on the ground; tails frayed
  c.ellipse(6.5, 8.5, 5.6, 3.6, (x, y) => (y < 7 ? "v" : y > 10 ? "U" : "u"));
  c.ellipse(6.5, 8.2, 3.6, 1.7, ".");
  c.put(
    `
uu....
UuuU..
.UuuuU
...UuU
....uU`,
    10,
    9,
  );
  c.outline("1");
  // stitched star patch, scorch mark + smoke wisp
  c.pts([[3, 10], [2, 11], [3, 11], [4, 11], [3, 12]], "y");
  c.pts([[7, 11], [8, 11], [9, 11], [8, 12], [6, 11]], "2");
  c.set(8, 11, "0");
  c.pts([[8, 9], [9, 8], [8, 7], [9, 6]], "G");
  // frayed threads at the tail ends
  c.pts([[15, 12], [15, 14], [14, 15]], "u");
  c.set(4, 6, "w");
  return rarityGlint(c, "SSR");
}

function sakuraSnowGlobe(): Cv {
  const c = I16();
  // glass dome
  c.disc(7.5, 6.5, 5.6, (x, y) => (shade(x - 7.5, y - 6.5) > 2.6 ? "Z" : "A"));
  // tiny sakura tree
  c.rect(7, 7, 2, 4, "H");
  c.set(6, 9, "H");
  c.ellipse(7.5, 5.6, 3.2, 2.4, (x, y) => (shade(x - 7.5, y - 5.6) > 0.8 ? "q" : (x * 3 + y) % 4 === 0 ? "P" : "p"));
  // snow / petals in the water + ground
  c.rect(3, 11, 10, 1, "W");
  c.set(4, 4, "q").set(11, 9, "q").set(10, 3, "w");
  // base (wood with gold band)
  c.rect(2, 12, 12, 3, "H");
  c.rect(2, 12, 12, 1, "y");
  c.rect(3, 14, 10, 1, "d");
  c.outline("1");
  c.set(4, 3, "w").set(3, 4, "w");
  return rarityGlint(c, "SSR");
}

function seasonFinaleManga(): Cv {
  const c = I16();
  // manga volume: black spine, white cover with dramatic speed lines round a gold star
  c.rect(3, 1, 11, 14, "w");
  c.rect(1, 1, 2, 14, "x");
  c.rect(1, 1, 1, 14, "f");
  c.rect(13, 1, 1, 14, "W");
  for (const [x, y] of [[3, 1], [3, 7], [13, 1], [13, 7]] as const) c.line(8, 4, x, y, "j");
  c.outline("1");
  shadedStar(c, 8, 4.4, 4.2, 1.9, { rimLit: "z", rimDark: "Y", body: "y", inner: "y", core: "w" }, { coreR: 0.5, round: 0.2 });
  // red FINAL ribbon wrapped round the lower half
  c.rect(1, 8, 14, 7, "r");
  c.rect(1, 8, 14, 1, "q");
  c.rect(1, 14, 14, 1, "R");
  micro(c, "FIN", 3, 9, "w");
  c.set(14, 14, ".");
  c.set(15, 13, "1").set(14, 14, "1");
  return rarityGlint(c, "SSR");
}

function windMachine(): Cv {
  const c = I16();
  // billowing red cape streaming off to the right
  c.poly([[8, 3], [14, 2], [12, 6], [15, 8], [11, 9], [13, 12], [8, 10]], (x, y) => (y < 6 && x < 12 ? "r" : x > 11 ? "R" : "r"));
  c.line(9, 4, 13, 3, "o");
  // fan: round cage + blades + stand
  c.disc(5, 6.5, 4.4, "g");
  c.disc(5, 6.5, 3.4, "W");
  c.pts([[5, 4], [5, 5], [6, 5], [3, 7], [4, 7], [6, 8], [7, 8], [5, 9]], "u");
  c.set(5, 6, "U").set(4, 6, "G");
  c.rect(4, 11, 2, 2, "G");
  c.rect(2, 13, 6, 2, "g");
  c.rect(2, 13, 6, 1, "W");
  c.outline("1");
  // speed lines blowing right
  c.line(10, 13, 14, 13, "w");
  c.line(11, 0, 13, 0, "w");
  c.set(3, 4, "w");
  return rarityGlint(c, "SSR");
}

function sentaiBadge(): Cv {
  const c = I16();
  const cols: [string, string][] = [
    ["r", "R"], // up
    ["u", "U"], // right-top
    ["y", "Y"], // right-bottom
    ["e", "E"], // left-bottom
    ["p", "P"], // left-top
  ];
  c.shape(
    (x, y) => inStar(x, y, 7.5, 8.2, 5, 7.6, 3.6, 0, 0.15),
    (x, y) => {
      const a = Math.atan2(x - 7.5, -(y - 8));
      const idx = (Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / 5)) % 5 + 5) % 5;
      const order = [0, 1, 2, 3, 4];
      const [lit, dark] = cols[order[idx]];
      return shade(x - 7.5, y - 8) > 0 ? lit : dark;
    },
  );
  c.outline("1");
  c.disc(7.5, 8.2, 1.9, (x, y) => (shade(x - 7.5, y - 8) > 0.3 ? "z" : "y"));
  c.set(7, 7, "w");
  return rarityGlint(c, "SSR");
}

function isekaiStatusCard(): Cv {
  const c = I16();
  c.rect(1, 2, 14, 12, "K");
  c.rect(2, 3, 12, 10, "V");
  c.outline("1");
  // white frame corners + header bar
  c.rect(2, 3, 12, 2, "u");
  micro(c, "LV", 3, 3, "w", 1);
  c.set(3, 3, "w");
  // rows of digit pixels (absurd numbers)
  for (let row = 0; row < 3; row++) {
    const y = 6 + row * 2;
    c.rect(3, y, 2, 1, "w");
    for (let x = 6; x < 13; x++) if ((x + row) % 3 !== 0 || row === 2) c.set(x, y, row === 2 ? "y" : "a");
  }
  c.set(14, 14, "Z");
  c.rect(1, 13, 14, 1, "U");
  return rarityGlint(c, "SSR");
}

function screentoneSheet(): Cv {
  const c = I16();
  c.rect(2, 1, 12, 14, (x, y) => ((x + (y % 2)) % 2 === 0 && y % 2 === 0 ? "G" : "W"));
  c.rect(2, 1, 12, 14, (x, y) => (x % 2 === 1 && y % 2 === 1 ? "g" : "w"));
  // star cut out
  c.shape((x, y) => inStar(x, y, 8, 8.4, 5, 4.6, 2.2, 0, 0.3), ".");
  // peeled corner bottom-right
  c.poly([[10.5, 15], [14, 11.5], [14, 15]], ".");
  c.poly([[10.5, 14.5], [13.5, 11.5], [10.5, 11.5]], "j");
  c.outline("1");
  // sparkle inside the cut
  sparkle(c, 8, 8, "w", "y");
  c.set(3, 2, "w");
  return rarityGlint(c, "SSR");
}

function redStringOfFate(): Cv {
  const c = I16();
  // a little fist with the pinky held out sideways (pinky promise)
  c.ellipse(4, 11.5, 3.2, 3, (x, y) => (shade(x - 4, y - 11.5) > 1 ? "t" : y > 13 ? "k" : "s"));
  c.rect(6, 9, 6, 2, (x, y) => (y === 9 ? "t" : "s"));
  c.set(12, 9, "s").set(12, 10, "k");
  c.outline("1");
  c.set(11, 9, "q").set(12, 9, "q");
  c.pts([[6, 11], [6, 12]], "k");
  // red bow tied round the pinky
  c.put(
    `
rr.
rRr
.R.
.R.
rRr
rr.`,
    7,
    7,
  );
  c.set(8, 9, "R").set(8, 10, "R");
  // the thread curling up into a heart
  c.line(9, 8, 10, 6, "r");
  c.put(
    `
.rr.rr
r..r..r
r.....r
.r...r.
..r.r..
...r...`,
    8,
    0,
  );
  c.selout({}, "1", false, (x, y) => y <= 8 && x >= 7);
  c.set(9, 2, "w");
  return rarityGlint(c, "SSR");
}

// =========================================================================== UR

function unopenedFigure(): Cv {
  const c = I16();
  // box (pink) with a clear window showing a chibi figure
  c.rect(2, 1, 12, 14, "p");
  c.rect(2, 1, 12, 2, "q");
  c.rect(2, 1, 1, 14, "q");
  c.rect(13, 1, 1, 14, "P");
  c.rect(4, 4, 8, 9, "v");
  c.outline("1");
  // figure inside: head + hair + body + base
  c.disc(8, 6.6, 1.8, "s");
  c.rect(6, 5, 4, 1, "y");
  c.set(6, 6, "y").set(10, 6, "y");
  c.set(7, 7, "0").set(9, 7, "0");
  c.rect(7, 9, 3, 2, "u");
  c.rect(6, 11, 5, 1, "g");
  c.set(4, 4, "w").set(5, 4, "w").set(4, 5, "w");
  // MINT sticker (gold seal, bottom-left)
  c.disc(3.5, 12.5, 2.2, "y");
  c.set(3, 12, "z").set(4, 13, "Y");
  c.selout({}, "1", false, (x, y) => x <= 6 && y >= 9);
  return rarityGlint(c, "UR");
}

function directorsCut(): Cv {
  const c = I16();
  // blue Blu-ray case
  c.rect(2, 1, 12, 14, "U");
  c.rect(2, 1, 12, 2, "u");
  c.rect(2, 1, 1, 14, "u");
  c.rect(3, 4, 10, 10, "n");
  c.outline("1");
  c.rect(4, 1, 6, 1, "v");
  // director's chair: canvas back + seat, X legs
  c.rect(5, 6, 6, 2, "r");
  c.rect(5, 6, 1, 7, "h");
  c.rect(10, 6, 1, 7, "h");
  c.rect(5, 9, 6, 1, "r");
  c.line(6, 10, 9, 12, "H");
  c.line(9, 10, 6, 12, "H");
  c.set(7, 6, "q");
  // gold "director's cut" stripe
  c.rect(3, 13, 10, 1, "y");
  c.set(3, 2, "w");
  return rarityGlint(c, "UR");
}

function timeSkipClock(): Cv {
  const c = I16();
  // clock: gold rim, white face
  c.disc(7, 9, 5.4, (x, y) => (shade(x - 7, y - 9) > 0 ? "y" : "Y"));
  c.disc(7, 9, 4.2, (x, y) => (shade(x - 7, y - 9) < -2 ? "W" : "w"));
  c.line(7, 9, 7, 6, "1");
  c.line(7, 9, 10, 9, "1");
  c.set(7, 9, "r");
  c.set(7, 5, "g").set(11, 9, "g").set(7, 13, "g").set(3, 9, "g");
  c.outline("1");
  // pink arrow jumping forward over the top
  c.pts([[2, 3], [3, 2], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 2], [11, 3], [12, 4]], "p");
  c.pts([[3, 3], [4, 2], [9, 2], [10, 3]], "q");
  c.put(
    `
pppp
.ppp
..pp
...p`,
    11,
    3,
  );
  c.selout({}, "1", false, (x, y) => y <= 7 && !(x > 3 && x < 11 && y > 3));
  c.set(5, 6, "t");
  return rarityGlint(c, "UR");
}

function hotBloodedBandana(): Cv {
  const c = I16();
  // flames licking up from the band
  c.put(
    `
..y....y....
.yo...yo..y.
.yoo.yoo.yo.
yoroyooryoo.
yorroorrooro`,
    2,
    2,
  );
  // red bandana band with knot + tails on the right
  c.rect(1, 7, 12, 4, "r");
  c.rect(1, 7, 12, 1, "o");
  c.rect(1, 10, 12, 1, "R");
  c.put(
    `
rr.
rRr
.rR
..R`,
    12,
    9,
  );
  c.outline("1");
  // white bandana dots
  c.set(3, 9, "w").set(7, 8, "w").set(10, 9, "w");
  c.set(4, 3, "z");
  return rarityGlint(c, "UR");
}

function goldenTicket(): Cv {
  const c = I16();
  c.rect(1, 4, 14, 8, (x, y) => (y < 6 ? "z" : y > 9 ? "Y" : "y"));
  c.rect(1, 4, 1, 8, "z");
  // notches + perforation
  c.set(1, 7, ".").set(1, 8, ".").set(14, 7, ".").set(14, 8, ".");
  c.outline("1");
  for (let y = 5; y < 11; y += 2) c.set(4, y, "Y");
  shadedStar(c, 9.5, 7.8, 3.6, 1.7, { rimLit: "w", rimDark: "O", body: "o", inner: "o", core: "z" }, { coreR: 0.6 });
  c.set(2, 5, "w");
  sparkle(c, 3, 1, "w", "z");
  sparkle(c, 13, 14, "w", "y");
  return rarityGlint(c, "UR");
}

function sacredPlotDevice(): Cv {
  const c = I16();
  // ornate claw base
  c.rect(4, 13, 8, 2, "H");
  c.rect(4, 13, 8, 1, "h");
  c.pts([[3, 11], [4, 12], [12, 11], [11, 12]], "Y");
  // glowing golden orb
  c.ball(8, 7, 5.2, 5.2, "OYyzz", { spec: "w", specAt: 0.9 });
  c.outline("1");
  // "?" carved inside
  c.put(
    `
.dd.
d..d
..dd
.dd.
....
.d..`,
    7,
    4,
  );
  sparkle(c, 2, 2, "w", "y");
  sparkle(c, 14, 6, "w", "z");
  return rarityGlint(c, "UR");
}

// =========================================================================== LR

function originalManuscript(): Cv {
  const c = I16();
  // thick stack: page edges visible on the front
  c.rect(1, 6, 13, 9, (x, y) => (y % 2 === 0 ? "W" : "B"));
  c.rect(1, 14, 13, 1, "g");
  // top page (slightly rotated look via offset)
  c.poly([[2, 2], [14, 3], [14, 7], [1, 6]], "w");
  c.outline("1");
  // handwriting scribbles
  c.line(4, 4, 8, 4, "G");
  c.line(9, 4, 12, 5, "G");
  c.line(3, 5, 7, 5, "G");
  // coffee ring
  ring(c, 10.5, 9.5, 1.6, 2.4, "H");
  c.set(10, 9, "h");
  c.set(3, 3, "z");
  c.set(14, 14, "R");
  return rarityGlint(c, "LR");
}

function revivalTheme(): Cv {
  const c = I16();
  c.put(
    `
......r.......
.....ro....r..
..r..roo..ro..
..ro.royo.ro..
.roo.ryyo.roo.
.royoryzyoryo.
rroyyyzzyyyor.
royyzzzzzzyyor
royzzzzzzzzyor
royzzzzzzzzyor
royzzzzzzzyoor
rooyyyyyyyyoor
.roooooooooor.
..rrrrrrrrrr..`,
    1,
    1,
  );
  c.outline("1");
  // white eighth note with its own outline, sitting in the fire
  const n = new Cv(16, 16);
  n.ellipse(6.5, 11, 2.6, 2, "w");
  n.rect(8, 3, 2, 8, "w");
  n.put(
    `
ww..
.ww.
..ww
...w
..w.`,
    10,
    3,
  );
  n.set(5, 12, "W").set(6, 12, "W").set(7, 12, "W").set(9, 10, "W");
  n.outline("1");
  c.put(n, 0, 0);
  c.set(5, 10, "t");
  return rarityGlint(c, "LR");
}

function lastBudget(): Cv {
  const c = I16();
  // crimson velvet cushion with gold tassels
  c.ellipse(7.5, 11.8, 7, 3, (x, y) => (shade(x - 7.5, y - 11.8) > 1 ? "r" : y > 12.5 ? "Q" : "R"));
  c.pts([[1, 14], [14, 14]], "y");
  // coin standing on it
  c.ellipse(7.5, 6.5, 4.4, 5, (x, y) => (shade(x - 7.5, y - 6.5) > 0.4 ? "y" : "Y"));
  c.ellipse(7.5, 6.5, 2.8, 3.4, (x, y) => (shade(x - 7.5, y - 6.5) > 0 ? "Y" : "y"));
  c.outline("1");
  c.set(6, 3, "z").set(5, 4, "z");
  shadedStar(c, 7.5, 6.6, 2.2, 1, { rimLit: "z", rimDark: "O", body: "y", inner: "y", core: "z" }, { coreR: 0.4 });
  sparkle(c, 13, 3, "w", "y");
  c.set(4, 12, "q");
  return rarityGlint(c, "LR");
}

function sakugaCel(): Cv {
  const c = I16();
  // transparent cel with peg holes
  c.rect(1, 1, 14, 14, "V");
  c.rect(1, 1, 14, 1, "a");
  c.set(4, 2, "1").set(7, 2, "1").set(8, 2, "1").set(11, 2, "1");
  c.outline("1");
  // dynamic flying-kick pose: red pencil construction lines + blue cleanup line
  c.disc(10, 5.5, 1.6, "r");
  c.set(10, 5, "w");
  c.line(9, 7, 6, 10, "r");
  c.line(7, 9, 3, 7, "u");
  c.line(8, 8, 12, 9, "u");
  c.line(6, 10, 3, 13, "r");
  c.line(6, 10, 9, 13, "r");
  c.line(9, 13, 11, 13, "r");
  // speed lines + a gold sakuga sparkle
  c.line(12, 11, 14, 11, "w");
  c.line(11, 13, 13, 13, "w");
  sparkle(c, 4, 4, "w", "y");
  c.set(2, 3, "Z");
  return rarityGlint(c, "LR");
}

// =========================================================================== MYTHIC

function infiniteCreditCard(): Cv {
  const c = I16();
  c.rect(1, 3, 14, 10, (x, y) => (x + y < 9 ? "2" : "X"));
  c.outline("1");
  c.rect(1, 3, 14, 1, "x");
  // gold chip + infinity sign
  c.rect(3, 6, 3, 2, "y");
  c.set(3, 6, "z").set(4, 7, "Y");
  c.put(
    `
.yy.yy.
y..y..y
.yy.yy.`,
    7,
    9,
  );
  c.rect(3, 10, 3, 1, "Y");
  // glitch sparkles (RGB split pixels)
  c.set(13, 5, "c").set(12, 5, "p").set(2, 14, "l").set(3, 14, "c").set(0, 8, "p").set(11, 1, "w").set(12, 1, "c");
  return rarityGlint(c, "MYTHIC");
}

const HANDS = `
..ss.....ss...
.sttk...stsk..
stsssk.stssks.
sts.bk.kbtssk.
sts.bbkbbtssk.
.ss.bbbbb.sk..
.sk..bbb.ssk..
..sk..b..sk...
..stk...ssk...
..stsk.sssk...
..sttsssssk...
.kssssssssk...
.ss.kkkk.ssk..`;

function realFriend(): Cv {
  return relic(HANDS, "MYTHIC", 1, 2, (c) => {
    c.set(6, 6, "q").set(5, 5, "q");
    sparkle(c, 7, 1, "w", "q");
  });
}

function finalEpisodeScript(): Cv {
  const c = I16();
  // script pages bound with two brads, glowing gold bookmark out of the top
  c.rect(2, 1, 11, 14, "w");
  c.rect(12, 2, 1, 13, "W");
  c.rect(2, 14, 11, 1, "W");
  c.rect(9, 0, 2, 4, "y");
  c.set(9, 0, "z");
  c.outline("1");
  c.set(4, 3, "G").set(4, 12, "G");
  for (const y of [3, 5]) c.line(6, y, 8, y, "g");
  c.line(6, 7, 11, 7, "g");
  c.set(10, 4, "Y").set(9, 4, "y");
  // red stamp box with FIN inside
  c.rect(1, 8, 13, 7, "r");
  c.rect(2, 9, 11, 5, "w");
  micro(c, "FIN", 2, 9, "r");
  c.set(1, 8, "R").set(13, 14, "R");
  sparkle(c, 13, 2, "w", "y");
  c.set(11, 0, "z");
  return rarityGlint(c, "MYTHIC");
}

export const sprites: SpriteDef[] = [
  // SR
  spr("icon_relic_rival_plushie", 16, 16, [rivalPlushie()], "center"),
  spr("icon_relic_oversized_sword_keychain", 16, 16, [swordKeychain()], "center"),
  spr("icon_relic_light_novel_vol1", 16, 16, [lightNovel()], "center"),
  spr("icon_relic_theme_song_cd", 16, 16, [themeSongCd()], "center"),
  spr("icon_relic_cosplay_wig", 16, 16, [cosplayWig()], "center"),
  spr("icon_relic_festival_goldfish", 16, 16, [festivalGoldfish()], "center", { pal: GLASS }),
  spr("icon_relic_mascot_head", 16, 16, [mascotHead()], "center"),
  spr("icon_relic_pity_keychain", 16, 16, [pityKeychain()], "center"),
  spr("icon_relic_shonen_headband", 16, 16, [shonenHeadband()], "center"),
  spr("icon_relic_compact_mirror", 16, 16, [compactMirror()], "center"),
  spr("icon_relic_mecha_model_kit", 16, 16, [mechaModelKit()], "center"),
  spr("icon_relic_magnifying_glass", 16, 16, [magnifyingGlass()], "center"),
  // SSR
  spr("icon_relic_protagonist_scarf", 16, 16, [protagonistScarf()], "center"),
  spr("icon_relic_transformation_brooch", 16, 16, [transformationBrooch()], "center"),
  spr("icon_relic_abandoned_headband", 16, 16, [abandonedHeadband()], "center"),
  spr("icon_relic_sakura_snow_globe", 16, 16, [sakuraSnowGlobe()], "center", { pal: GLASS }),
  spr("icon_relic_season_finale_manga", 16, 16, [seasonFinaleManga()], "center"),
  spr("icon_relic_wind_machine", 16, 16, [windMachine()], "center"),
  spr("icon_relic_sentai_badge", 16, 16, [sentaiBadge()], "center"),
  spr("icon_relic_isekai_status_card", 16, 16, [isekaiStatusCard()], "center", { pal: GLASS }),
  spr("icon_relic_screentone_sheet", 16, 16, [screentoneSheet()], "center"),
  spr("icon_relic_red_string_of_fate", 16, 16, [redStringOfFate()], "center"),
  // UR
  spr("icon_relic_unopened_figure", 16, 16, [unopenedFigure()], "center"),
  spr("icon_relic_directors_cut", 16, 16, [directorsCut()], "center"),
  spr("icon_relic_time_skip_clock", 16, 16, [timeSkipClock()], "center"),
  spr("icon_relic_hot_blooded_bandana", 16, 16, [hotBloodedBandana()], "center"),
  spr("icon_relic_golden_ticket", 16, 16, [goldenTicket()], "center"),
  spr("icon_relic_sacred_plot_device", 16, 16, [sacredPlotDevice()], "center"),
  // LR
  spr("icon_relic_original_manuscript", 16, 16, [originalManuscript()], "center"),
  spr("icon_relic_revival_theme", 16, 16, [revivalTheme()], "center"),
  spr("icon_relic_last_budget", 16, 16, [lastBudget()], "center"),
  spr("icon_relic_sakuga_cel", 16, 16, [sakugaCel()], "center", { pal: GLASS }),
  // MYTHIC
  spr("icon_relic_infinite_credit_card", 16, 16, [infiniteCreditCard()], "center"),
  spr("icon_relic_real_friend", 16, 16, [realFriend()], "center"),
  spr("icon_relic_final_episode_script", 16, 16, [finalEpisodeScript()], "center"),
];
