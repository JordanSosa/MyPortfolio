/**
 * font_main (owner: world): chunky, rounded 7px bitmap font. White ink, the
 * rasteriser adds a 1px dark plum outline (cell = (w+2) x 9).
 *
 * - Digits are 5px wide with 2px strokes: damage numbers must read instantly.
 * - Caps use the same 2px-stroke construction; M/W/N/O/Q/T/X/Y are wider so
 *   their shapes stay unambiguous ('O' is wider than '0').
 * - Lowercase is a matching small-caps set (5px tall) so mixed-case strings
 *   ("Kira Kira") keep the chunky game look. 'x' doubles as the times sign
 *   ("x99").
 */
import type { FontDef } from "../format";

const G: Record<string, string> = {
  // ------------------------------------------------------------------ digits
  "0": `
.xxx.
xx.xx
xx.xx
xx.xx
xx.xx
xx.xx
.xxx.`,
  "1": `
.xx.
xxx.
.xx.
.xx.
.xx.
.xx.
xxxx`,
  "2": `
.xxx.
xx.xx
...xx
..xx.
.xx..
xx...
xxxxx`,
  "3": `
xxxx.
...xx
...xx
.xxx.
...xx
...xx
xxxx.`,
  "4": `
xx.xx
xx.xx
xx.xx
xxxxx
...xx
...xx
...xx`,
  "5": `
xxxxx
xx...
xxxx.
...xx
...xx
xx.xx
.xxx.`,
  "6": `
.xxx.
xx...
xxxx.
xx.xx
xx.xx
xx.xx
.xxx.`,
  "7": `
xxxxx
...xx
...xx
..xx.
..xx.
.xx..
.xx..`,
  "8": `
.xxx.
xx.xx
xx.xx
.xxx.
xx.xx
xx.xx
.xxx.`,
  "9": `
.xxx.
xx.xx
xx.xx
xx.xx
.xxxx
...xx
.xxx.`,

  // ------------------------------------------------------------------ caps
  A: `
.xxx.
xx.xx
xx.xx
xxxxx
xx.xx
xx.xx
xx.xx`,
  B: `
xxxx.
xx.xx
xx.xx
xxxx.
xx.xx
xx.xx
xxxx.`,
  C: `
.xxx.
xx.xx
xx...
xx...
xx...
xx.xx
.xxx.`,
  D: `
xxxx.
xx.xx
xx.xx
xx.xx
xx.xx
xx.xx
xxxx.`,
  E: `
xxxxx
xx...
xx...
xxxx.
xx...
xx...
xxxxx`,
  F: `
xxxxx
xx...
xx...
xxxx.
xx...
xx...
xx...`,
  G: `
.xxxx
xx...
xx...
xx.xx
xx.xx
xx.xx
.xxxx`,
  H: `
xx.xx
xx.xx
xx.xx
xxxxx
xx.xx
xx.xx
xx.xx`,
  I: `
xxxx
.xx.
.xx.
.xx.
.xx.
.xx.
xxxx`,
  J: `
..xxx
...xx
...xx
...xx
xx.xx
xx.xx
.xxx.`,
  K: `
xx.xx
xx.xx
xxxx.
xxx..
xxxx.
xx.xx
xx.xx`,
  L: `
xx...
xx...
xx...
xx...
xx...
xx...
xxxxx`,
  M: `
xx...xx
xxx.xxx
xxxxxxx
xx.x.xx
xx...xx
xx...xx
xx...xx`,
  N: `
xx..xx
xxx.xx
xxxxxx
xx.xxx
xx..xx
xx..xx
xx..xx`,
  O: `
.xxxx.
xx..xx
xx..xx
xx..xx
xx..xx
xx..xx
.xxxx.`,
  P: `
xxxx.
xx.xx
xx.xx
xxxx.
xx...
xx...
xx...`,
  Q: `
.xxxx.
xx..xx
xx..xx
xx..xx
xx.xxx
xx..xx
.xxx.x`,
  R: `
xxxx.
xx.xx
xx.xx
xxxx.
xxx..
xx.xx
xx.xx`,
  S: `
.xxxx
xx...
xx...
.xxx.
...xx
...xx
xxxx.`,
  T: `
xxxxxx
..xx..
..xx..
..xx..
..xx..
..xx..
..xx..`,
  U: `
xx.xx
xx.xx
xx.xx
xx.xx
xx.xx
xx.xx
.xxx.`,
  V: `
xx.xx
xx.xx
xx.xx
xx.xx
.xxx.
.xxx.
..x..`,
  W: `
xx...xx
xx...xx
xx...xx
xx.x.xx
xxxxxxx
xxx.xxx
xx...xx`,
  X: `
xx..xx
xx..xx
.xxxx.
..xx..
.xxxx.
xx..xx
xx..xx`,
  Y: `
xx..xx
xx..xx
.xxxx.
..xx..
..xx..
..xx..
..xx..`,
  Z: `
xxxxx
...xx
..xxx
.xxx.
xxx..
xx...
xxxxx`,

  // ------------------------------------------------------------------ punctuation
  " ": `
...
...
...
...
...
...
...`,
  "!": `
xx
xx
xx
xx
xx
..
xx`,
  "?": `
.xxx.
xx.xx
...xx
..xx.
.xx..
.....
.xx..`,
  "+": `
......
..xx..
..xx..
xxxxxx
xxxxxx
..xx..
..xx..`,
  "-": `
....
....
....
xxxx
xxxx
....
....`,
  "%": `
xx...x
xx..xx
...xx.
..xx..
.xx...
xx..xx
x...xx`,
  ".": `
..
..
..
..
..
xx
xx`,
  ",": `
..
..
..
..
xx
xx
x.`,
  ":": `
..
xx
xx
..
xx
xx
..`,
  ";": `
..
xx
xx
..
xx
xx
x.`,
  "/": `
...xx
...xx
..xx.
..xx.
.xx..
xx...
xx...`,
  "'": `
xx
xx
x.
..
..
..
..`,
  '"': `
xx.xx
xx.xx
x..x.
.....
.....
.....
.....`,
  "*": `
...x...
..xxx..
xxxxxxx
.xxxxx.
..xxx..
.xx.xx.
.x...x.`,
  "(": `
..xx
.xx.
xx..
xx..
xx..
.xx.
..xx`,
  ")": `
xx..
.xx.
..xx
..xx
..xx
.xx.
xx..`,
  "#": `
.x..x.
xxxxxx
.x..x.
.x..x.
xxxxxx
.x..x.
......`,
  "=": `
.....
.....
xxxxx
.....
xxxxx
.....
.....`,
  "<": `
...xx
..xx.
.xx..
xx...
.xx..
..xx.
...xx`,
  ">": `
xx...
.xx..
..xx.
...xx
..xx.
.xx..
xx...`,
  "&": `
.xxx..
xx.xx.
.xxx..
xxxx.x
xx.xx.
xx.xx.
.xx.xx`,
  _: `
.....
.....
.....
.....
.....
.....
xxxxx`,
  "~": `
......
......
.xx..x
xxxxxx
x..xx.
......
......`,
  "^": `
..x..
.xxx.
xx.xx
.....
.....
.....
.....`,
  $: `
..x..
.xxxx
xxx..
.xxx.
..xxx
xxxx.
..x..`,
  "@": `
.xxxx.
xx..xx
xx.xxx
xx.x.x
xx.xxx
xx....
.xxxx.`,
  "[": `
xxx
xx.
xx.
xx.
xx.
xx.
xxx`,
  "]": `
xxx
.xx
.xx
.xx
.xx
.xx
xxx`,
};

// ------------------------------------------------------------------ small caps (5px tall on the baseline)
const SMALL: Record<string, string> = {
  a: `
.xxx.
xx.xx
xxxxx
xx.xx
xx.xx`,
  b: `
xxxx.
xx.xx
xxxx.
xx.xx
xxxx.`,
  c: `
.xxx
xx..
xx..
xx..
.xxx`,
  d: `
xxxx.
xx.xx
xx.xx
xx.xx
xxxx.`,
  e: `
xxxx
xx..
xxx.
xx..
xxxx`,
  f: `
xxxx
xx..
xxx.
xx..
xx..`,
  g: `
.xxxx
xx...
xx.xx
xx.xx
.xxxx`,
  h: `
xx.xx
xx.xx
xxxxx
xx.xx
xx.xx`,
  i: `
xx
xx
xx
xx
xx`,
  j: `
..xx
..xx
..xx
x.xx
.xx.`,
  k: `
xx.xx
xxxx.
xxx..
xxxx.
xx.xx`,
  l: `
xx..
xx..
xx..
xx..
xxxx`,
  m: `
xx...xx
xxx.xxx
xxxxxxx
xx.x.xx
xx...xx`,
  n: `
xx..xx
xxx.xx
xxxxxx
xx.xxx
xx..xx`,
  o: `
.xxx.
xx.xx
xx.xx
xx.xx
.xxx.`,
  p: `
xxxx.
xx.xx
xxxx.
xx...
xx...`,
  q: `
.xxx.
xx.xx
xx.xx
xx.xx
.xx.x`,
  r: `
xxxx.
xx.xx
xxxx.
xx.xx
xx.xx`,
  s: `
.xxxx
xx...
.xxx.
...xx
xxxx.`,
  t: `
xxxxxx
..xx..
..xx..
..xx..
..xx..`,
  u: `
xx.xx
xx.xx
xx.xx
xx.xx
.xxx.`,
  v: `
xx.xx
xx.xx
.xxx.
.xxx.
..x..`,
  w: `
xx...xx
xx.x.xx
xxxxxxx
xxx.xxx
xx...xx`,
  x: `
xx..xx
.xxxx.
..xx..
.xxxx.
xx..xx`,
  y: `
xx..xx
.xxxx.
..xx..
..xx..
..xx..`,
  z: `
xxxxx
..xxx
.xxx.
xxx..
xxxxx`,
};

/** Pad a 5-row small-caps glyph to the 7-row cell (2 empty rows on top). */
function lower(grid: string): string {
  const rs = grid
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const w = rs[0].length;
  return ["".padEnd(w, "."), "".padEnd(w, "."), ...rs].join("\n");
}

const glyphs: Record<string, string> = { ...G };
for (const [ch, g] of Object.entries(SMALL)) glyphs[ch] = lower(g);

export const fonts: FontDef[] = [
  { id: "font_main", h: 7, glyphs },
  // Same glyphs without the auto outline, 1 px apart: for DARK ink on LIGHT backgrounds (speech bubbles).
  // Dark ink + the dark outline of font_main merges every letter into a blob.
  { id: "font_ink", h: 7, glyphs, outline: false, spacing: 1 },
];
