/**
 * Master palette for Kira Kira Overdrive.
 *
 * Every grid sprite is written with these single-character keys.
 * '.' is always transparent. Ramps are listed dark -> light.
 *
 * Style rules (see docs/DESIGN.md §Art):
 *  - Outlines use '1' (dark plum), never pure black. '0' is reserved for the
 *    deepest accents (pupils, inner mouth, deepest crevices).
 *  - Shade with hue-shifted ramps: shadows lean purple/blue, highlights lean
 *    warm/yellow. Never shade by just darkening.
 *  - Anime eyes: big, 2-3px wide, a dark top lid line, coloured iris, and a
 *    single white 'w' highlight pixel. Blush 'b' under the eyes.
 */
export const PALETTE: Readonly<Record<string, string>> = {
  // --- darks / outline ---------------------------------------------------
  "0": "#140c22", // deepest accent (pupils, mouth interior)
  "1": "#2d1b45", // DEFAULT OUTLINE - dark plum
  "2": "#4b3470", // purple shadow / dark cloth

  // --- neutrals (lavender-tinted) ----------------------------------------
  G: "#7a6ea3", // mid grey-violet
  g: "#b6acd9", // light grey-lavender
  W: "#e9e3f7", // off-white (cloth shadow on white)
  w: "#ffffff", // pure white (eye shine, sparkle core)

  // --- skin ----------------------------------------------------------------
  k: "#e39a8c", // skin shadow
  s: "#ffd6c4", // skin base
  t: "#fff1ea", // skin highlight
  b: "#ff8fab", // blush

  // --- pinks (Hoshi) ---------------------------------------------------------
  Q: "#962766", // deep pink
  P: "#d9468f", // pink shadow
  p: "#ff7ab8", // pink base
  q: "#ffb8dc", // pink light

  // --- reds -----------------------------------------------------------------
  R: "#ad1d4a", // dark red
  r: "#ff4d6d", // red

  // --- oranges / yellows / golds ------------------------------------------
  O: "#c25b1d", // dark orange
  o: "#ff9a3d", // orange
  Y: "#e0a020", // gold shadow
  y: "#ffe14d", // yellow
  z: "#fff7b0", // pale yellow / highlight

  // --- blonde / cream (Mochi) -----------------------------------------------
  F: "#f2bd66", // blonde base
  B: "#fff0c9", // cream

  // --- browns (wood, teddy fur) ---------------------------------------------
  d: "#6b3d2c", // dark brown
  H: "#a6683f", // brown
  h: "#dda574", // tan

  // --- greens -----------------------------------------------------------------
  E: "#22784a", // dark green
  e: "#45b85a", // green
  l: "#94e85e", // lime
  m: "#d0f7ad", // mint light

  // --- teals / cyans --------------------------------------------------------
  C: "#1c97ad", // teal
  c: "#4fe6df", // cyan
  a: "#bafff6", // aqua light

  // --- blues ------------------------------------------------------------------
  n: "#1f2a73", // navy
  U: "#3462d6", // dark blue
  u: "#5aa8ff", // blue
  v: "#b0d8ff", // light blue

  // --- purples ----------------------------------------------------------------
  I: "#743fd1", // dark violet
  i: "#b47cff", // violet
  j: "#ddc6ff", // lavender light

  // --- black hair (Rin), purple-tinted -----------------------------------------
  X: "#21183d", // hair shadow
  x: "#392b5e", // hair base
  f: "#6a5aa3", // hair highlight / sheen
};

/** Convenient named colours for code (UI, particles, tints). Same values as PALETTE. */
export const C = {
  outline: 0x2d1b45,
  deep: 0x140c22,
  white: 0xffffff,
  offWhite: 0xe9e3f7,
  lavender: 0xddc6ff,
  violet: 0xb47cff,
  darkViolet: 0x743fd1,
  pink: 0xff7ab8,
  pinkLight: 0xffb8dc,
  hotPink: 0xd9468f,
  red: 0xff4d6d,
  orange: 0xff9a3d,
  gold: 0xe0a020,
  yellow: 0xffe14d,
  paleYellow: 0xfff7b0,
  green: 0x45b85a,
  lime: 0x94e85e,
  mint: 0xd0f7ad,
  cyan: 0x4fe6df,
  aqua: 0xbafff6,
  blue: 0x5aa8ff,
  lightBlue: 0xb0d8ff,
  navy: 0x1f2a73,
} as const;

/** '#rrggbb' or '#rrggbbaa' -> [r,g,b,a] 0..255 */
export function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}
