/**
 * Second evolutions, package B (docs/content/weapons.md §8):
 *
 *   SOAP OPERA (Bubble Aura + Inner Monologue)
 *     w_soap_bubble              16x16 x3   a soap bubble: thin rainbow rim, almost clear inside (the rim's colours turn)
 *     icon_soap_opera            16x16
 *   REFRACTION OVERLOAD (Prism Beam + Lucky Clover)
 *     icon_refraction_overload   16x16      (the beams are lines drawn by src/view/evo2/b.ts)
 *   BROWN SUGAR RAILGUN (Bubble Tea Cannon + Power Bow)
 *     w_pearl_rail               16x8 x2    a pearl at speed, a caramel streak behind it (faces right)
 *     fx_syrup                   16x8 x2    ground decal: a tile of the syrup streak (tiles along x)
 *     icon_brown_sugar_railgun   16x16
 *   FAILED EXAM STORM (Paper Crane Flock + Training Montage)
 *     w_paper_plane              12x8 x2    a paper dart folded from an exam, red marks on the wing (faces right)
 *     icon_failed_exam_storm     16x16
 *   UNDERGROUND MOSH PIT (Idol Lightstick Wave + Plot Armor)
 *     fx_stomp                   24x8 x2    a low dust puff kicked up by a stomp (played once over a particle's life)
 *     icon_mosh_pit              16x16
 */
import type { SpriteDef } from "../format";
import type { ManifestEntry } from "../manifest";
import { Cv, I16, iconRow, rgba, row, spr, twinkle } from "./evo2-util";

// ---------------------------------------------------------------------------- Soap Opera

/** The soap film's colours around the rim (saturated: a bubble has to read on a pale floor too). */
const FILM = "pyluic";

/** A soap bubble's rim (r0..r1) coloured by angle, turned by `turn` (0..1). */
function film(c: Cv, cx: number, cy: number, r0: number, r1: number, turn: number): void {
  c.each((x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > r1) return null;
    if (d < r0) return d > r0 - 1.2 && dx + dy > 2 ? "-" : "+";
    const a = (Math.atan2(dy, dx) / (Math.PI * 2) + 1.375 + turn) % 1;
    return FILM[Math.floor(a * FILM.length) % FILM.length];
  });
}

const SOAP_PAL: Record<string, string> = {
  "+": rgba("#9ff5ee", 0.2), // the film, seen through
  "-": rgba("#5aa8ff", 0.42), // its shaded side (bottom-right)
  "%": rgba("#ffffff", 0.7), // soft shine
};

function wSoapBubble(f: number): Cv {
  const c = new Cv(16, 16);
  film(c, 7.5, 7.5, 5.3, 6.9, f / 3);
  // the window shine (top-left) and a small bounce light (bottom-right)
  c.pts([[4, 4], [5, 3]], "w").pts([[3, 5], [6, 3], [4, 5]], "%");
  c.set(10 + (f === 1 ? 1 : 0), 11, "%");
  return c;
}

function iconSoapOpera(): Cv {
  const c = I16();
  // one big bubble (opaque here: an icon has to read on any card), a little one drifting off
  c.each((x, y) => {
    const d = Math.hypot(x - 7, y - 8);
    if (d > 6.2) return null;
    if (d > 4.9) return FILM[Math.floor(((Math.atan2(y - 8, x - 7) / (Math.PI * 2) + 1.375) % 1) * FILM.length) % FILM.length];
    return x + y < 13 ? "a" : "c";
  });
  c.disc(13, 13.2, 1.3, "a");
  c.outline("1");
  // the drama inside: a small heart, cracked
  c.put(
    `
p.p
PpP
.P.`,
    6,
    8,
  );
  c.pts([[4, 5], [5, 4]], "w").set(3, 6, "a");
  return twinkle(c, "tr");
}

// ---------------------------------------------------------------------------- Refraction Overload

function iconRefractionOverload(): Cv {
  const c = I16();
  // the glass prism
  c.poly(
    [
      [5.5, 3.6],
      [10.4, 12.4],
      [0.6, 12.4],
    ],
    (x) => (x < 5 ? "w" : x < 7 ? "a" : "v"),
  );
  c.outline("1");
  c.set(4, 7, "w");
  // one beam in, three out, each forking again at its tip (no outline: they are light)
  c.rect(0, 9, 2, 1, "w");
  c.line(9, 7, 12, 4, "c").pts([[13, 2], [14, 1], [14, 4], [15, 4]], "c");
  c.line(10, 9, 12, 9, "y").pts([[13, 8], [14, 7], [13, 10], [14, 11]], "y");
  c.line(11, 12, 12, 13, "p").pts([[13, 13], [14, 13], [12, 14], [12, 15]], "p");
  return twinkle(c, "tl");
}

// ---------------------------------------------------------------------------- Brown Sugar Railgun

const RAIL_PAL: Record<string, string> = {
  "+": rgba("#dda574", 0.55), // the caramel streak, thinning out
  "-": rgba("#a6683f", 0.4),
};

function wPearlRail(f: number): Cv {
  const c = new Cv(16, 8);
  // the streak: a caramel wedge tapering to the left
  c.each((x, y) => {
    if (x > 10) return null;
    const half = 0.4 + (x / 10) * 2.2;
    const dy = Math.abs(y - 3.5);
    if (dy > half) return null;
    if ((x + f * 2) % 4 === 0 && x < 7) return null;
    return dy < half * 0.45 ? (x > 5 ? "B" : "h") : x > 4 ? "+" : "-";
  });
  // the pearl
  c.ball(11.5, 3.5, 2.7, 2.7, "00dH", { bias: -0.05 });
  c.set(10 + f, 2, "w");
  return c;
}

const SYRUP_PAL: Record<string, string> = {
  "+": rgba("#8a4a22", 0.62), // syrup
  "-": rgba("#c27a3a", 0.4), // its thin edge
  "%": rgba("#fff0c9", 0.55), // a glint
};

/** A tile of the streak: a band with wobbling edges that meet themselves at x = 0 / 16. */
function fxSyrup(f: number): Cv {
  const c = new Cv(16, 8);
  c.each((x, y) => {
    const ph = (x / 16) * Math.PI * 2 + f * 2.1;
    const top = 2.2 + 0.5 * Math.sin(ph);
    const bot = 5.6 + 0.5 * Math.sin(ph * 2 + 1);
    if (y < top - 0.9 || y > bot + 0.9) return null;
    return y < top || y > bot ? "-" : "+";
  });
  c.set(f ? 11 : 4, 3, "%").set(f ? 3 : 12, 4, "%");
  return c;
}

function iconBrownSugarRailgun(): Cv {
  const c = I16();
  // the very long straw, corner to corner
  c.line(1, 14, 9, 6, "p");
  c.line(2, 14, 10, 6, "q");
  c.line(1, 13, 9, 5, "P");
  for (let k = 0; k < 4; k++) c.set(2 + k * 2, 12 - k * 2, "w");
  // the pearl leaving it
  c.ball(12, 3.6, 2.4, 2.4, "0ddH");
  c.outline("1");
  c.set(11, 3, "w");
  // caramel speed lines between the two (no outline: they are motion)
  c.set(10, 7, "h").set(8, 4, "h").set(12, 7, "B").set(13, 8, "h");
  return twinkle(c, "tl");
}

// ---------------------------------------------------------------------------- Failed Exam Storm

const PLANE = [
  `
............
fww.........
.fwwwrw.....
..fwwwrwwwf.
...fWWWWWf..
....fWWf....
.....ff.....
............`,
  `
............
............
fwwwwrw.....
.ffwwwrwwwf.
...fWWWWWf..
....fWWWf...
.....fff....
............`,
];

function wPaperPlane(f: number): Cv {
  return new Cv(12, 8).put(PLANE[f], 0, 0);
}

function iconFailedExamStorm(): Cv {
  const c = I16();
  // the exam: a sheet, ruled lines, a red mark in the corner
  c.rect(1, 2, 9, 12, "w");
  c.rect(1, 13, 9, 1, "W");
  for (let y = 9; y <= 11; y += 2) c.rect(2, y, 6, 1, "g");
  c.put(
    `
rrr
r..
rr.
r..
r..`,
    2,
    3,
  );
  c.rect(6, 4, 3, 1, "g");
  c.outline("1");
  // a paper plane already leaving with it
  const plane = new Cv(16, 16);
  plane.poly(
    [
      [6, 8],
      [14.4, 6.6],
      [9, 11],
    ],
    "w",
  );
  plane.poly(
    [
      [9, 11],
      [14.4, 6.8],
      [11, 13.4],
    ],
    "W",
  );
  plane.line(9, 11, 14, 7, "g");
  plane.outline("1");
  c.put(plane, 0, 0);
  return twinkle(c, "tr");
}

// ---------------------------------------------------------------------------- Underground Mosh Pit

const DUST_PAL: Record<string, string> = {
  "+": rgba("#e9e3f7", 0.8),
  "-": rgba("#b6acd9", 0.55),
};

/** A low dust puff: two lumps kicked out to the sides of a stomp; f1 = spread out and thinner. */
function fxStomp(f: number): Cv {
  const c = new Cv(24, 8);
  const lumps: ReadonlyArray<readonly [number, number, number]> = f
    ? [
        [3.5, 5, 2.2],
        [9, 4.4, 1.6],
        [15, 4.4, 1.6],
        [20.5, 5, 2.2],
      ]
    : [
        [7, 4.6, 2.8],
        [12, 5, 2.2],
        [17, 4.6, 2.8],
      ];
  for (const [x, y, r] of lumps) c.ellipse(x, y, r, r * 0.8, (_px, py) => (py < y ? "+" : "-"));
  if (f) c.set(6, 2, "+").set(18, 2, "+").set(12, 3, "-");
  return c;
}

function iconMoshPit(): Cv {
  const c = I16();
  // the boot coming down (a violet platform boot, pink laces, a thick pink sole)
  c.put(
    `
..iii.....
..i2i.....
..iqi.....
..i2i.....
..iqiii...
..i2222ii.
.ii22222i.
.pppppppp.
.PPPPPPPP.`,
    3,
    1,
  );
  c.outline("1");
  c.set(5, 1, "j");
  // the shove: a pink shock ring flattening out under the sole, and the floor's dust
  c.pts([[1, 12], [2, 13], [3, 13], [12, 13], [13, 13], [14, 12]], "p");
  c.pts([[4, 14], [5, 14], [6, 14], [9, 14], [10, 14], [11, 14]], "q");
  c.set(0, 10, "y").set(15, 10, "c").set(1, 8, "w");
  return twinkle(c, "tr");
}

export const sprites: SpriteDef[] = [
  spr("w_soap_bubble", 16, 16, [0, 1, 2].map(wSoapBubble), "center", { fps: 4, pal: SOAP_PAL }),
  spr("icon_soap_opera", 16, 16, [iconSoapOpera()], "center"),
  spr("icon_refraction_overload", 16, 16, [iconRefractionOverload()], "center"),
  spr("w_pearl_rail", 16, 8, [0, 1].map(wPearlRail), "center", { fps: 12, pal: RAIL_PAL }),
  spr("fx_syrup", 16, 8, [0, 1].map(fxSyrup), "center", { pal: SYRUP_PAL }),
  spr("icon_brown_sugar_railgun", 16, 16, [iconBrownSugarRailgun()], "center"),
  spr("w_paper_plane", 12, 8, [0, 1].map(wPaperPlane), "center", { fps: 8 }),
  spr("icon_failed_exam_storm", 16, 16, [iconFailedExamStorm()], "center"),
  spr("fx_stomp", 24, 8, [0, 1].map(fxStomp), "center", { pal: DUST_PAL }),
  spr("icon_mosh_pit", 16, 16, [iconMoshPit()], "center"),
];

export const manifest: ManifestEntry[] = [
  row("w_soap_bubble", 16, 16, 3, "Soap Opera: a soap bubble, thin pastel rainbow rim, almost clear inside, a white window shine; the rim's colours turn a third per frame"),
  iconRow("icon_soap_opera", "Evolution: Soap Opera (Bubble Aura + Inner Monologue) - a rainbow-rimmed soap bubble with a small pink heart inside, gold twinkle"),
  iconRow("icon_refraction_overload", "Evolution: Refraction Overload (Prism Beam + Lucky Clover) - a glass prism, one white beam in, three coloured beams out that each fork, gold twinkle"),
  row("w_pearl_rail", 16, 8, 2, "Brown Sugar Railgun: a dark glossy pearl at the right with a tapering caramel streak behind it; f1 = the streak's gaps shifted"),
  row("fx_syrup", 16, 8, 2, "Brown Sugar Railgun: a translucent brown syrup band with wobbling edges, tiles along x (ground decal); f1 = another wobble"),
  iconRow("icon_brown_sugar_railgun", "Evolution: Brown Sugar Railgun (Bubble Tea Cannon + Power Bow) - a long pink straw firing one dark pearl, caramel speed lines, gold twinkle"),
  row("w_paper_plane", 12, 8, 2, "Failed Exam Storm: a white paper dart facing right, two red marks on its wing; f1 = the wings tilted"),
  iconRow("icon_failed_exam_storm", "Evolution: Failed Exam Storm (Paper Crane Flock + Training Montage) - an exam sheet with a red grade and a paper plane leaving it, gold twinkle"),
  row("fx_stomp", 24, 8, 2, "Underground Mosh Pit: a low pale dust puff kicked out to both sides of a stomp; f1 = spread wider and thinner"),
  iconRow("icon_mosh_pit", "Evolution: Underground Mosh Pit (Idol Lightstick Wave + Plot Armor) - a platform boot stomping, a pink shock ring under the sole, gold twinkle"),
];
