/**
 * Enemy bullets (owner: chars). Centre pivot, 2-frame pulse.
 * Readability first: saturated colour, a mid-dark contrast ring, bright
 * pastel body and a pure-white core, wrapped in a soft alpha glow halo
 * (local palette entries with alpha) that also feeds the bloom pass.
 */
import type { SpriteDef } from "../format";
import { fill } from "../format";
import { gridSprite } from "./chars-util";

type Band = [number, string];

/** Radial bands: first band whose limit exceeds the field value wins. */
function bands(w: number, h: number, field: (x: number, y: number) => number, bs: Band[]): string {
  return fill(w, h, (x, y) => {
    const v = field(x, y);
    for (const [lim, k] of bs) if (v < lim) return k;
    return ".";
  });
}

// ------------------------------------------------------------------ eb_orb (hot pink)
const ORB_PAL = { "+": "#ff3d9a38", "*": "#ff3d9a90", "=": "#ff3d9ad0" };
const orbField = (x: number, y: number) => Math.hypot(x - 3.5, y - 3.5);
const ORB = [
  bands(8, 8, orbField, [
    [1.25, "w"],
    [2.0, "q"],
    [2.6, "p"],
    [3.1, "P"],
    [3.6, "*"],
    [4.3, "+"],
  ]),
  bands(8, 8, orbField, [
    [1.6, "w"],
    [2.3, "q"],
    [2.9, "p"],
    [3.35, "P"],
    [3.8, "="],
    [4.6, "*"],
  ]),
];

// ------------------------------------------------------------------ eb_star (purple 4-point)
const STAR_PAL = { "+": "#a35cff38", "*": "#a35cff8c", "=": "#b47cffd0" };
const STAR = [
  `
....II....
...+ij+...
...*jj*...
.+*ijji*+.
IiijwwjiiI
IiijwwjiiI
.+*ijji*+.
...*jj*...
...+ji+...
....II....
`,
  `
....jI....
...=jj=...
..+*jj*+..
.=*jwwj*=.
IijwwwwjiI
IijwwwwjiI
.=*jwwj*=.
..+*jj*+..
...=jj=...
....Ij....
`,
];

// ------------------------------------------------------------------ eb_moon (pale crescent)
const MOON_PAL = { "+": "#ffe14d34", "*": "#ffe14d88", "=": "#fff7b0c8" };
const MOON = [0, 1].map((f) => {
  const R = f ? 4.9 : 4.6;
  const inMoon = (x: number, y: number) => Math.hypot(x - 5.5, y - 5.5) < R && Math.hypot(x - 7.6, y - 4.0) > R * 0.82;
  const moonPx: [number, number][] = [];
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (inMoon(x, y)) moonPx.push([x, y]);
  return fill(12, 12, (x, y) => {
    const d = Math.hypot(x - 5.5, y - 5.5);
    const cut = Math.hypot(x - 7.6, y - 4.0);
    if (inMoon(x, y)) {
      const depth = cut - R * 0.82;
      if (d > R - 0.9) return "y";
      if (depth > 2.0) return "w";
      if (depth > 0.9) return "z";
      return "y";
    }
    let m = 99;
    for (const [mx, my] of moonPx) m = Math.min(m, Math.hypot(x - mx, y - my));
    if (m < 1.3) return f ? "=" : "*";
    if (m < 2.2) return f ? "*" : "+";
    return ".";
  });
});

export const sprites: SpriteDef[] = [
  gridSprite("eb_orb", 8, 8, ORB, "center", { fps: 8, pal: ORB_PAL }),
  gridSprite("eb_star", 10, 10, STAR, "center", { fps: 8, pal: STAR_PAL }),
  gridSprite("eb_moon", 12, 12, MOON, "center", { fps: 8, pal: MOON_PAL }),
];
