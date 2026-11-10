/**
 * Built-in 7px fallback font. Used automatically when a requested font (e.g.
 * `font_main`, drawn by the art agent) is not registered, so text always renders.
 */
import type { FontDef } from "../art/format";

const g = (s: string) => s.trim();

export const FALLBACK_FONT: FontDef = {
  id: "font_engine",
  h: 7,
  spacing: 0,
  glyphs: {
    " ": g(`
...
...
...
...
...
...
...`),
    "0": g(`
.xxx.
x...x
x..xx
x.x.x
xx..x
x...x
.xxx.`),
    "1": g(`
.xx.
xxx.
.xx.
.xx.
.xx.
.xx.
xxxx`),
    "2": g(`
.xxx.
x...x
....x
...x.
..x..
.x...
xxxxx`),
    "3": g(`
xxxx.
....x
....x
.xxx.
....x
....x
xxxx.`),
    "4": g(`
...x.
..xx.
.x.x.
x..x.
xxxxx
...x.
...x.`),
    "5": g(`
xxxxx
x....
xxxx.
....x
....x
x...x
.xxx.`),
    "6": g(`
.xxx.
x....
x....
xxxx.
x...x
x...x
.xxx.`),
    "7": g(`
xxxxx
....x
...x.
..x..
..x..
.x...
.x...`),
    "8": g(`
.xxx.
x...x
x...x
.xxx.
x...x
x...x
.xxx.`),
    "9": g(`
.xxx.
x...x
x...x
.xxxx
....x
....x
.xxx.`),
    A: g(`
.xxx.
x...x
x...x
xxxxx
x...x
x...x
x...x`),
    B: g(`
xxxx.
x...x
x...x
xxxx.
x...x
x...x
xxxx.`),
    C: g(`
.xxx.
x...x
x....
x....
x....
x...x
.xxx.`),
    D: g(`
xxxx.
x...x
x...x
x...x
x...x
x...x
xxxx.`),
    E: g(`
xxxxx
x....
x....
xxxx.
x....
x....
xxxxx`),
    F: g(`
xxxxx
x....
x....
xxxx.
x....
x....
x....`),
    G: g(`
.xxx.
x...x
x....
x.xxx
x...x
x...x
.xxxx`),
    H: g(`
x...x
x...x
x...x
xxxxx
x...x
x...x
x...x`),
    I: g(`
xxx
.x.
.x.
.x.
.x.
.x.
xxx`),
    J: g(`
..xxx
...x.
...x.
...x.
x..x.
x..x.
.xx..`),
    K: g(`
x...x
x..x.
x.x..
xx...
x.x..
x..x.
x...x`),
    L: g(`
x....
x....
x....
x....
x....
x....
xxxxx`),
    M: g(`
x...x
xx.xx
x.x.x
x.x.x
x...x
x...x
x...x`),
    N: g(`
x...x
xx..x
x.x.x
x..xx
x...x
x...x
x...x`),
    O: g(`
.xxx.
x...x
x...x
x...x
x...x
x...x
.xxx.`),
    P: g(`
xxxx.
x...x
x...x
xxxx.
x....
x....
x....`),
    Q: g(`
.xxx.
x...x
x...x
x...x
x.x.x
x..x.
.xx.x`),
    R: g(`
xxxx.
x...x
x...x
xxxx.
x.x..
x..x.
x...x`),
    S: g(`
.xxxx
x....
x....
.xxx.
....x
....x
xxxx.`),
    T: g(`
xxxxx
..x..
..x..
..x..
..x..
..x..
..x..`),
    U: g(`
x...x
x...x
x...x
x...x
x...x
x...x
.xxx.`),
    V: g(`
x...x
x...x
x...x
x...x
x...x
.x.x.
..x..`),
    W: g(`
x...x
x...x
x...x
x.x.x
x.x.x
xx.xx
x...x`),
    X: g(`
x...x
x...x
.x.x.
..x..
.x.x.
x...x
x...x`),
    Y: g(`
x...x
x...x
.x.x.
..x..
..x..
..x..
..x..`),
    Z: g(`
xxxxx
....x
...x.
..x..
.x...
x....
xxxxx`),
    "!": g(`
xx
xx
xx
xx
xx
..
xx`),
    "?": g(`
.xxx.
x...x
....x
..xx.
..x..
.....
..x..`),
    "+": g(`
.....
..x..
..x..
xxxxx
..x..
..x..
.....`),
    "-": g(`
...
...
...
xxx
...
...
...`),
    x: g(`
.....
.....
x...x
.x.x.
..x..
.x.x.
x...x`),
    "%": g(`
xx..x
xx..x
...x.
..x..
.x...
x..xx
x..xx`),
    ".": g(`
.
.
.
.
.
.
x`),
    ",": g(`
..
..
..
..
..
.x
x.`),
    ":": g(`
.
.
x
.
.
x
.`),
    "/": g(`
....x
....x
...x.
..x..
.x...
x....
x....`),
    "'": g(`
x
x
.
.
.
.
.`),
    "*": g(`
..x..
..x..
xxxxx
.xxx.
.x.x.
x...x
.....`),
    "(": g(`
.x
x.
x.
x.
x.
x.
.x`),
    ")": g(`
x.
.x
.x
.x
.x
.x
x.`),
    "#": g(`
.x.x.
.x.x.
xxxxx
.x.x.
xxxxx
.x.x.
.x.x.`),
    "=": g(`
....
....
xxxx
....
xxxx
....
....`),
    "<": g(`
...x
..x.
.x..
x...
.x..
..x.
...x`),
    ">": g(`
x...
.x..
..x.
...x
..x.
.x..
x...`),
    "~": g(`
.....
.....
.x...
x.x.x
...x.
.....
.....`),
  },
};
