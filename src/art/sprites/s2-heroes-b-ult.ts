/**
 * Isekai-kun's ultimate actor (owner s2-heroes-b): `ult_status_window`, 64x40,
 * centre pivot. A translucent blue game status window that slams down over a
 * third of the view (scaled to the view width by code), so enemies stay
 * visible through it. White frame, title bar, rows of tiny stat labels and
 * absurdly long digit rows (STATUS SCREEN!!, docs/content/heroes.md §2.10).
 */
import type { SpriteDef } from "../format";
import { Pix, gridSprite } from "./chars-util";

/** 3x5 pixel font (2-wide S/T where it reads better). */
const FONT: Record<string, string> = {
  S: "xxx|x..|xxx|..x|xxx",
  T: "xxx|.x.|.x.|.x.|.x.",
  A: ".x.|x.x|xxx|x.x|x.x",
  U: "x.x|x.x|x.x|x.x|xxx",
  L: "x..|x..|x..|x..|xxx",
  V: "x.x|x.x|x.x|x.x|.x.",
  H: "x.x|x.x|xxx|x.x|x.x",
  P: "xx.|x.x|xx.|x..|x..",
  M: "x.x|xxx|xxx|x.x|x.x",
  R: "xx.|x.x|xx.|x.x|x.x",
  I: "xxx|.x.|.x.|.x.|xxx",
  N: "x.x|xxx|xxx|xxx|x.x",
  K: "x.x|xx.|x..|xx.|x.x",
  E: "xxx|x..|xx.|x..|xxx",
  X: "x.x|x.x|.x.|x.x|x.x",
  "9": "xxx|x.x|xxx|..x|xxx",
  "8": "xxx|x.x|xxx|x.x|xxx",
  "0": "xxx|x.x|x.x|x.x|xxx",
  "!": "x|x|x|.|x",
  ".": ".|.|.|.|x",
};

function write(p: Pix, text: string, x: number, y: number, k: string): number {
  let cx = x;
  for (const ch of text) {
    const g = FONT[ch];
    if (!g) {
      cx += 2;
      continue;
    }
    const rs = g.split("|");
    rs.forEach((r, yy) => [...r].forEach((c, xx) => c === "x" && p.set(cx + xx, y + yy, k)));
    cx += rs[0].length + 1;
  }
  return cx;
}

function statusWindow(): Pix {
  const p = new Pix(64, 40);
  // translucent body, darker title bar, glowing inner rim
  p.rect(0, 0, 64, 40, "1");
  p.rect(1, 1, 62, 38, "w");
  p.rect(2, 2, 60, 36, "A");
  p.rect(2, 2, 60, 7, "D");
  p.rect(2, 9, 60, 1, "v");
  p.rect(2, 10, 1, 28, "V");
  p.rect(61, 10, 1, 28, "V");
  p.rect(2, 37, 60, 1, "V");
  // title: STATUS + a fake close button
  write(p, "STATUS", 4, 3, "w");
  p.rect(53, 3, 7, 5, "r");
  write(p, "X", 55, 3, "w");
  p.set(53, 3, "R").set(59, 3, "R").set(53, 7, "R").set(59, 7, "R");
  // stat rows: label + absurdly long digits (6px pitch: 5px glyphs + 1px gap)
  const rows: [string, string][] = [
    ["LV", "9999"],
    ["HP", "9999999999"],
    ["MP", "9999999999"],
    ["STR", "99999999.."],
  ];
  rows.forEach(([label, digits], i) => {
    const y = 11 + i * 6;
    write(p, label, 4, y, "a");
    write(p, digits, 19, y, i === 0 ? "z" : "w");
  });
  // dotted separator under LV, and a fake scrollbar (there are MORE stats)
  for (let x = 4; x < 58; x += 2) p.set(x, 16, "V");
  p.rect(59, 11, 1, 24, "V");
  p.rect(59, 11, 1, 6, "a");
  // corner glints (it's a GLOWING window)
  p.set(1, 1, "a").set(62, 1, "a").set(1, 38, "a").set(62, 38, "a");
  return p;
}

export const sprites: SpriteDef[] = [
  gridSprite("ult_status_window", 64, 40, [statusWindow()], "center", {
    pal: {
      A: "#3462d6a8", // translucent window body
      D: "#1f2a73d8", // title bar
      V: "#b0d8ff70", // soft inner glow rim
    },
  }),
];
