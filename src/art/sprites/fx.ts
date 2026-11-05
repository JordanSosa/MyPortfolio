/**
 * Pixel FX sprites (owner: world).
 *
 * fx_spark / fx_hit / fx_heart / fx_puff / fx_petal are drawn in white and
 * light greys (soft edges via semi-transparent white) because code tints
 * them. fx_explosion is full colour: white flash -> fireball -> lavender smoke.
 */
import type { SpriteDef } from "../format";
import { Cv, LIGHT, hash, rgba, spr } from "./world-util";

const WPAL: Record<string, string> = {
  "+": rgba("#ffffff", 0.7),
  "-": rgba("#ffffff", 0.38),
  "*": rgba("#ffffff", 0.18),
  // light lavender-greys for volume (still near-white so tints stay clean)
  "=": "#f3f0fb",
  "~": "#dcd6ee",
  "^": rgba("#dcd6ee", 0.6),
  ":": rgba("#f3f0fb", 0.45),
};

// ------------------------------------------------------------------ fx_spark (8x8): grow -> peak -> shrink -> dot
const SPARK = [
  `
........
........
...--...
..-ww-..
..-ww-..
...--...
........
........`,
  `
...--...
...++...
...ww...
-+wwww+-
-+wwww+-
...ww...
...++...
...--...`,
  `
........
...-....
...w+...
.-+ww+..
..+wwww-
...+w...
....-...
........`,
  `
........
........
........
...+-...
...-+...
........
........
........`,
];

// ------------------------------------------------------------------ fx_hit (16x16): star flash -> shards
function hit(f: number): Cv {
  const c = new Cv(16, 16);
  const cx = 7.5;
  const cy = 7.5;
  if (f === 0) {
    // compact 8-point burst
    c.each((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const spike = Math.pow(Math.abs(Math.cos(a * 4)), 6);
      const R = 2.6 + spike * 3.4;
      if (r < R - 1.2) return "w";
      if (r < R - 0.4) return "+";
      if (r < R + 0.3) return "-";
      return null;
    });
    return c;
  }
  if (f === 1) {
    // bigger star, hollowing out
    c.each((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + Math.PI / 8;
      const spike = Math.pow(Math.abs(Math.cos(a * 4)), 8);
      const R = 3.4 + spike * 4.4;
      if (r < 1.6) return "-";
      if (r < 2.6) return "+";
      if (r < R - 0.8) return "w";
      if (r < R + 0.2) return "+";
      return null;
    });
    return c;
  }
  // f2 / f3: shards flying outward (8 small slivers), fading
  const n = 8;
  const rad = f === 2 ? 5.2 : 6.6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2 ? 0.25 : 0) + Math.PI / 8;
    const len = f === 2 ? (i % 2 ? 2.2 : 3.2) : i % 2 ? 1.2 : 2.0;
    for (let t = 0; t <= len; t += 0.5) {
      const x = cx + Math.cos(a) * (rad + t - len / 2);
      const y = cy + Math.sin(a) * (rad + t - len / 2);
      const k = f === 2 ? (t < len * 0.6 ? "w" : "+") : t < len * 0.5 ? "+" : "-";
      c.set(Math.round(x), Math.round(y), k);
    }
  }
  if (f === 2) c.disc(cx, cy, 1.2, "*");
  return c;
}

// ------------------------------------------------------------------ fx_puff (16x16, 6 frames): soft cloud expanding + fading
/** Draw cloud lobes back-to-front, each shaded like a soft ball (ramp dark -> light). */
function lobes(c: Cv, list: ReadonlyArray<readonly [number, number, number]>, ramp: string, bias = 0.12): void {
  for (const [x, y, r] of list) if (r > 0.4) c.ball(x, y, r, r * 0.92, ramp, { bias });
}

function puff(f: number): Cv {
  const c = new Cv(16, 16);
  const cx = 7.5;
  const cy = 8.2;
  // lobe layout: [dx, dy, r] (back/top lobes first)
  const base: [number, number, number][] = [
    [-2.2, -2.0, 2.6],
    [2.0, -2.2, 2.5],
    [-3.4, 0.9, 2.5],
    [3.3, 0.8, 2.6],
    [0, 0.6, 3.4],
    [-1.1, 2.6, 2.2],
    [1.6, 2.5, 2.2],
  ];
  const grow = [0.5, 0.78, 0.95, 1.05, 1.12, 1.15][f];
  const spread = [0.45, 0.75, 0.95, 1.1, 1.3, 1.45][f];
  const shrink = [1, 1, 1, 0.92, 0.72, 0.5][f];
  const list = base.map(([x, y, r]) => [cx + x * spread, cy + y * spread - f * 0.3, r * grow * shrink] as const);
  const ramp = f < 3 ? "~==w" : f === 3 ? "^:=+" : f === 4 ? "^::+" : "**--";
  lobes(c, f === 0 ? [[cx - 1, cy - 0.5, 2.0], [cx + 1.2, cy - 0.8, 1.7], [cx, cy + 0.8, 2.3]] : list, ramp);
  return c;
}

// ------------------------------------------------------------------ fx_petal (6x6): near-white so tints read as sakura
const PETAL_PAL: Record<string, string> = {
  w: "#ffffff",
  "=": "#fdeff6",
  "~": "#e8dcef",
};
const PETAL = [
  `
.ww.w.
w=www.
w===w.
.==~..
..~~..
......`,
  `
......
....w.
...w=.
..==~.
.=~~..
.~....`,
];

// ------------------------------------------------------------------ fx_heart (7x6)
const HEART = `
.ww.ww.
www=ww=
ww====~
.====~.
..=~~..
...~...`;

// ------------------------------------------------------------------ fx_explosion (32x32, 7 frames)
const EXPAL: Record<string, string> = {
  "+": rgba("#fff7b0", 0.55),
  "-": rgba("#ffe14d", 0.3),
  "*": rgba("#ff9a3d", 0.35),
  "=": rgba("#ddc6ff", 0.6),
  "~": rgba("#b6acd9", 0.45),
  ":": rgba("#e9e3f7", 0.35),
  "[": rgba("#b6acd9", 0.45),
  "]": rgba("#c9bdf0", 0.5),
  "{": rgba("#ddc6ff", 0.5),
  "}": rgba("#f3f0fb", 0.5),
};

const STAR4 = `
.w.
wzw
.w.`;

/** Scalloped (cloud-edged) radius. */
function scallop(a: number, R: number, bumps: number, amp: number, phase = 0): number {
  return R + amp * Math.abs(Math.sin((a * bumps) / 2 + phase));
}

function explosion(f: number): Cv {
  const c = new Cv(32, 32);
  const cx = 15.5;
  const cy = 15.5;
  if (f === 0) {
    // white flash disc with a hot yellow rim + soft halo
    c.each((x, y) => {
      const r = Math.hypot(x - cx, y - cy);
      if (r < 6.2) return "w";
      if (r < 7.4) return "z";
      if (r < 8.6) return "+";
      if (r < 10) return "-";
      return null;
    });
    return c;
  }
  if (f <= 3) {
    // fireball: puffy scalloped edge, white-hot core moving towards the lit side
    const R = [0, 9.5, 11.6, 12.6][f];
    const coreShift = [0, 0.5, 1.2, 1.8][f];
    c.each((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const edge = scallop(a, R - 1.6, 9, 1.8, f * 0.6);
      if (r > edge + 1.2) return null;
      if (r > edge) return f === 3 ? "*" : "-";
      // core distance (offset to top-left)
      const kx = dx + coreShift;
      const ky = dy + coreShift;
      const k = Math.hypot(kx, ky) / edge;
      const lit = -(dx * LIGHT[0] + dy * LIGHT[1]) / edge; // + on the shaded side
      if (f === 1) {
        if (k < 0.42) return "w";
        if (k < 0.62) return "z";
        if (k < 0.82) return "y";
        return lit > 0.35 ? "o" : "y";
      }
      if (f === 2) {
        if (k < 0.25) return "w";
        if (k < 0.45) return "z";
        if (k < 0.66) return "y";
        if (k < 0.86) return lit > 0.2 ? "o" : "y";
        return lit > 0.3 ? "r" : "o";
      }
      // f3: cooling, a pink-red shadow side
      if (k < 0.18) return "z";
      if (k < 0.4) return "y";
      if (k < 0.66) return lit > 0.1 ? "o" : "y";
      if (k < 0.86) return lit > 0.2 ? "r" : "o";
      return lit > 0.25 ? "r" : "o";
    });
    // sparkle stars
    const stars: [number, number][][] = [
      [],
      [
        [4, 6],
        [26, 9],
        [22, 26],
      ],
      [
        [2, 13],
        [27, 4],
        [24, 27],
        [7, 27],
      ],
      [
        [1, 6],
        [29, 13],
        [12, 29],
        [27, 26],
      ],
    ];
    for (const [x, y] of stars[f]) c.put(STAR4, x - 1, y - 1);
    return c;
  }
  // f4-6: lavender smoke puffs drifting outward, shrinking and turning translucent
  const k = f - 4; // 0..2
  const puffs: [number, number, number][] = [
    [0, -9, 3.8],
    [-7, -5, 4.6],
    [7, -5, 4.4],
    [0, 0, 6.2],
    [-7, 5, 4.4],
    [7, 5, 4.2],
    [0, 9, 3.6],
  ];
  const out = 1 + k * 0.28;
  const shrink = [1, 0.8, 0.58][k];
  const ramp = ["gjjw", "gjjW", "[]{}"][k];
  lobes(
    c,
    puffs.map(([px, py, pr]) => [cx + px * out, cy + py * out - k * 1.5, pr * shrink] as const),
    ramp,
  );
  // last embers on the first smoke frame
  if (k === 0) c.pts([[9, 8], [23, 11], [14, 24]], "y");
  return c;
}

export const sprites: SpriteDef[] = [
  spr("fx_spark", 8, 8, SPARK, "center", { fps: 12, pal: WPAL }),
  spr("fx_hit", 16, 16, [0, 1, 2, 3].map(hit), "center", { fps: 20, pal: WPAL }),
  spr("fx_puff", 16, 16, [0, 1, 2, 3, 4, 5].map(puff), "center", { fps: 12, pal: WPAL }),
  spr("fx_petal", 6, 6, PETAL, "center", { fps: 6, pal: PETAL_PAL }),
  spr("fx_heart", 7, 6, [HEART], "center", { pal: { "=": "#f3f0fb", "~": "#d6cfea" } }),
  spr("fx_explosion", 32, 32, [0, 1, 2, 3, 4, 5, 6].map(explosion), "center", { fps: 12, pal: EXPAL }),
];
