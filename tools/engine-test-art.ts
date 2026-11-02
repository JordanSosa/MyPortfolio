/**
 * Procedural stand-in art for the engine showcase ONLY (tools/engine-test.ts).
 * Passed to the Renderer as `extraSprites`: registered art always wins, these
 * only fill manifest ids that are not drawn yet, so the showcase looks like a
 * game while the art is being made in parallel.
 */
import { addOutline, type ProcSprite } from "../src/art/format";
import { PALETTE, hexToRgba } from "../src/art/palette";

type RGBA = [number, number, number, number];
const P = (k: string): RGBA => hexToRgba(PALETTE[k]);
const H = (hex: string): RGBA => hexToRgba(hex);
const OUT = P("1");

class Pix {
  px: Uint8ClampedArray;
  constructor(
    public w: number,
    public h: number,
  ) {
    this.px = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: RGBA, a = c[3]): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
    this.px[i + 3] = a;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[(y * this.w + x) * 4 + 3];
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA, a = 255): void {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c, a);
      }
  }
  disc(cx: number, cy: number, r: number, c: RGBA, a = 255): void {
    this.ellipse(cx, cy, r, r, c, a);
  }
  rect(x0: number, y0: number, w: number, h: number, c: RGBA, a = 255): void {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c, a);
  }
  outline(c: RGBA = OUT): void {
    addOutline(this.px, this.w, this.h, c);
  }
  flush(set: (x: number, y: number, r: number, g: number, b: number, a: number) => void): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (this.px[i + 3]) set(x, y, this.px[i], this.px[i + 1], this.px[i + 2], this.px[i + 3]);
      }
  }
}

function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 2147483647, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function proc(id: string, w: number, h: number, frames: number, feet: boolean, paint: (p: Pix, f: number) => void, fps = 8): ProcSprite {
  return {
    id,
    w,
    h,
    frames,
    fps,
    ox: w / 2,
    oy: feet ? h - 1 : h / 2,
    paint(f, set) {
      const p = new Pix(w, h);
      paint(p, f);
      p.flush(set);
    },
  };
}

// ---------------------------------------------------------------- ground
const G0 = H("#8ed873");
const G1 = H("#a3e383");
const G2 = H("#7bcb66");
const G3 = H("#c4f0a0");
const tile = proc("tile_ground", 16, 16, 8, false, (p, f) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = hash(x, y, f % 4);
      p.set(x, y, n < 0.1 ? G2 : n > 0.93 ? G1 : G0);
    }
  // short grass strokes
  for (let k = 0; k < 3; k++) {
    const x = Math.floor(hash(k, 9, f) * 15);
    const y = 1 + Math.floor(hash(k, 3, f) * 14);
    p.set(x, y, G2);
    p.set(x + 1, y - 1, G2);
  }
  if (f === 4)
    for (let k = 0; k < 3; k++) {
      const x = 2 + Math.floor(hash(k, 1, 44) * 12);
      const y = 2 + Math.floor(hash(k, 2, 44) * 12);
      const c = k === 1 ? P("w") : P("q");
      p.set(x, y, c);
      p.set(x - 1, y, c);
      p.set(x + 1, y, c);
      p.set(x, y - 1, c);
      p.set(x, y + 1, c);
      p.set(x, y, P("y"));
    }
  if (f === 5)
    for (let k = 0; k < 4; k++) {
      const x = 3 + Math.floor(hash(k, 5, 55) * 10);
      const y = 3 + Math.floor(hash(k, 6, 55) * 10);
      p.set(x, y, P("e"));
      p.set(x + 1, y, P("e"));
      p.set(x, y + 1, P("e"));
    }
  if (f === 6)
    for (let k = 0; k < 4; k++) p.set(2 + Math.floor(hash(k, 7, 66) * 12), 2 + Math.floor(hash(k, 8, 66) * 12), G3);
  if (f === 7)
    for (let y = 3; y < 13; y++)
      for (let x = 3; x < 13; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d < 4.5 + hash(x, y, 77) * 1.5) p.set(x, y, H("#c9d98a"));
      }
});

// ---------------------------------------------------------------- enemies (squishy blobs with faces)
function blob(id: string, w: number, h: number, frames: number, body: string, shade: string, light: string, extra?: (p: Pix, f: number, cx: number, top: number) => void, float = false) {
  return proc(id, w, h, frames, true, (p, f) => {
    const sq = [0, 1, 0, -1][f % 4];
    const rx = w * 0.36 + sq * 0.6;
    const ry = h * 0.3 - sq * 0.6;
    const cx = w / 2;
    const cy = h - 1 - ry - (float ? 2 + (f % 2) : 0.5);
    p.ellipse(cx, cy, rx, ry, P(shade));
    p.ellipse(cx - 0.6, cy - 0.8, rx - 0.8, ry - 1, P(body));
    p.ellipse(cx - rx * 0.4, cy - ry * 0.45, Math.max(1, rx * 0.25), Math.max(0.8, ry * 0.2), P(light));
    // face
    const ey = Math.round(cy - ry * 0.05);
    const ex = Math.max(2, Math.round(rx * 0.42));
    p.set(cx - ex, ey, P("0"));
    p.set(cx + ex - 1, ey, P("0"));
    p.set(cx - ex, ey - 1, P("0"));
    p.set(cx + ex - 1, ey - 1, P("0"));
    p.set(cx - ex, ey - 1, P("w"));
    p.set(cx + ex - 1, ey - 1, P("w"));
    p.set(cx - ex - 1, ey + 1, P("b"));
    p.set(cx + ex, ey + 1, P("b"));
    p.set(cx - 1, ey + 1, P("0"));
    p.set(cx, ey + 2, P("0"));
    extra?.(p, f, cx, Math.round(cy - ry));
    p.outline();
  }, 7);
}
const enemies = [
  blob("en_puff", 16, 16, 4, "m", "e", "w", (p, _f, cx, top) => {
    p.set(cx, top - 1, P("e"));
    p.set(cx + 1, top - 2, P("l"));
  }),
  blob("en_batbun", 16, 16, 4, "i", "I", "j", (p, f, cx, top) => {
    const up = f % 2 ? -1 : 1;
    for (let k = 0; k < 3; k++) {
      p.set(cx - 6 - k, top + 3 + up * k * 0.5, P("I"));
      p.set(cx + 5 + k, top + 3 + up * k * 0.5, P("I"));
    }
    p.rect(cx - 3, top - 3, 1, 3, P("i"));
    p.rect(cx + 2, top - 3, 1, 3, P("i"));
  }, true),
  blob("en_boo", 16, 16, 4, "W", "g", "w", undefined, true),
  blob("en_shroom", 16, 16, 4, "B", "h", "w", (p, _f, cx, top) => {
    p.ellipse(cx, top + 1, 6, 3.4, P("r"));
    p.set(cx - 2, top, P("w"));
    p.set(cx + 2, top + 1, P("w"));
  }),
  blob("en_teddy", 24, 24, 4, "h", "H", "B", (p, _f, cx, top) => {
    p.disc(cx - 6, top + 1, 2.2, P("H"));
    p.disc(cx + 6, top + 1, 2.2, P("H"));
  }),
  blob("en_eyepuff", 16, 16, 4, "q", "p", "w", undefined, true),
  blob("en_pumpkin", 16, 16, 4, "o", "O", "y", (p, _f, cx, top) => p.rect(cx, top - 1, 1, 2, P("E"))),
  blob("en_wisp", 12, 12, 4, "u", "U", "a", (p, f, cx, top) => {
    p.set(cx, top - 1 - (f % 2), P("c"));
    p.set(cx, top - 2 - (f % 2), P("a"));
  }, true),
  blob("en_spore", 10, 10, 2, "r", "R", "q"),
];

// ---------------------------------------------------------------- projectiles / pickups / fx
function star(p: Pix, cx: number, cy: number, R: number, r: number, c: RGBA, rot = -Math.PI / 2) {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const a = Math.atan2(dy, dx) - rot;
      const k = (Math.cos(a * 5) + 1) / 2;
      if (Math.hypot(dx, dy) <= r + (R - r) * Math.pow(k, 2.2)) p.set(x, y, c);
    }
}
const misc: ProcSprite[] = [
  proc("w_star", 12, 12, 2, false, (p, f) => {
    star(p, 6, 6.3, 5.4, 2.4, P(f ? "z" : "y"));
    star(p, 6, 6.3, 3, 1.2, P("z"));
    p.set(5, 5, P("w"));
    p.outline(P("O"));
  }),
  proc("w_yarn", 10, 10, 2, false, (p, f) => {
    p.disc(5, 5, 4, P("p"));
    for (let k = 0; k < 4; k++) p.set(2 + k + f, 3 + k, P("q"));
    p.set(3, 3, P("w"));
    p.outline(P("Q"));
  }),
  proc("eb_orb", 8, 8, 2, false, (p, f) => {
    p.disc(4, 4, 3.6, P("P"));
    p.disc(4, 4, 2.6 - f * 0.3, P("p"));
    p.disc(4, 4, 1.3, P("w"));
  }),
  ...[
    ["gem_1", 7, "c", "a"],
    ["gem_2", 8, "p", "q"],
    ["gem_3", 10, "y", "z"],
  ].map(([id, s, c, l]) =>
    proc(id as string, s as number, s as number, 2, false, (p, f) => {
      const n = s as number;
      const m = (n - 1) / 2;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) if (Math.abs(x - m) / (m - 0.2) + Math.abs(y - m) / m <= 1) p.set(x, y, P(c as string));
      p.set(Math.floor(m) - 1, Math.floor(m) - 1, P(l as string));
      if (f) p.set(Math.floor(m), Math.floor(m) - 1, P("w"));
      p.outline();
    }),
  ),
  proc("gem_4", 12, 12, 4, false, (p, f) => {
    const cols = ["p", "y", "c", "i"];
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++) if (Math.abs(x - 5.5) / 4.6 + Math.abs(y - 5.5) / 5.4 <= 1) p.set(x, y, P(cols[(f + ((x + y) >> 2)) % 4]));
    p.set(4, 4, P("w"));
    p.outline();
  }),
  proc("coin", 8, 8, 4, false, (p, f) => {
    const rx = [3.4, 2.4, 1.2, 2.4][f];
    p.ellipse(4, 4, rx, 3.4, P("Y"));
    p.ellipse(4 - 0.3, 4 - 0.3, Math.max(0.6, rx - 0.9), 2.5, P("y"));
    if (f !== 2) p.set(4, 3, P("z"));
  }),
  proc("fx_spark", 8, 8, 4, false, (p, f) => {
    const L = [2, 3, 2, 0][f];
    const W = P("w");
    p.set(3, 3, W);
    p.set(4, 4, W);
    p.set(3, 4, W);
    p.set(4, 3, W);
    for (let k = 1; k <= L; k++) {
      p.set(3, 3 - k, W);
      p.set(4, 4 + k, W);
      p.set(3 - k, 4, W);
      p.set(4 + k, 3, W);
    }
    if (f === 3) {
      p.rect(0, 0, 8, 8, W, 0);
      p.set(3, 3, W);
      p.set(4, 4, W);
    }
  }),
  proc("fx_hit", 16, 16, 4, false, (p, f) => {
    const W = P("w");
    const R = [4, 6.5, 7.5, 7.8][f];
    const r = [1.5, 2.5, 4.5, 6][f];
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - 8;
        const dy = y + 0.5 - 8;
        const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const k = Math.pow((Math.cos(a * 4) + 1) / 2, 3);
        const outer = r + (R - r) * k;
        if (d <= outer && d >= (f >= 2 ? r * 0.9 : 0)) p.set(x, y, W, f === 3 ? 160 : 255);
      }
  }),
  proc("fx_puff", 16, 16, 6, false, (p, f) => {
    const r = 2.5 + f * 1.05;
    const a = [255, 255, 235, 200, 150, 90][f];
    const c = P(f < 3 ? "w" : "W");
    p.disc(8, 8.5, r, P("j"), a);
    p.disc(7.4, 7.6, r * 0.8, c, a);
    if (f >= 3) p.disc(8, 8, r * 0.45, P("j"), 0);
  }, 12),
  proc("fx_petal", 6, 6, 2, false, (p, f) => {
    if (f === 0) {
      p.ellipse(3, 3, 2.6, 1.6, P("q"));
      p.set(1, 3, P("p"));
      p.set(4, 2, P("w"));
    } else {
      p.ellipse(3, 3, 1.4, 2.4, P("q"));
      p.set(3, 4, P("p"));
    }
  }),
  proc("fx_heart", 7, 6, 1, false, (p) => {
    const W = P("w");
    [".x.x...", "xxxxx..", "xxxxx..", ".xxx...", "..x...."].forEach((row, y) => [...row].forEach((ch, x) => ch === "x" && p.set(x + 1, y, W)));
  }),
  proc("fx_explosion", 32, 32, 7, false, (p, f) => {
    if (f === 0) {
      p.disc(16, 16, 8, P("w"));
      return;
    }
    if (f <= 3) {
      const r = 7 + f * 3;
      p.disc(16, 16, r, P("o"));
      p.disc(15, 15, r - 2, P("y"));
      p.disc(14, 14, r - 5, P("z"));
      p.disc(13, 13, Math.max(1, r - 9), P("w"));
      for (let k = 0; k < 6; k++) {
        const a = k + f;
        p.disc(16 + Math.cos(a) * (r - 1), 16 + Math.sin(a) * (r - 1), 2.2, P("o"));
      }
      p.outline(P("O"));
      return;
    }
    const k = f - 4;
    const al = [230, 170, 100][k];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + k * 0.3;
      const d = 10 + k * 3;
      p.disc(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, 4.5 - k, P(i % 2 ? "j" : "W"), al);
    }
  }, 12),
  proc("deco_flower", 8, 8, 6, true, (p, f) => {
    const cols = ["w", "p", "y", "u", "q", "o"];
    p.rect(4, 4, 1, 4, P("E"));
    p.set(5, 6, P("e"));
    p.disc(4.5, 3, 2.1, P(cols[f]));
    p.set(4, 3, P(f === 2 ? "o" : "y"));
    p.outline();
  }),
  proc("deco_grass", 8, 8, 4, true, (p, f) => {
    for (let k = 0; k < 4; k++) {
      const x = 1 + k * 2 - (f & 1);
      const hgt = 3 + ((k + f) % 3);
      for (let y = 0; y < hgt; y++) p.set(x + (y > 2 ? (k & 1 ? 1 : -1) : 0), 7 - y, P(y > 2 ? "l" : "e"));
    }
  }),
  proc("deco_rock", 10, 8, 2, true, (p, f) => {
    p.ellipse(5, 5, 4 - f, 2.6, P("g"));
    p.ellipse(4.4, 4.4, 2.6 - f, 1.5, P("W"));
    p.outline();
  }),
  proc("deco_mush", 8, 8, 2, true, (p, f) => {
    p.rect(3, 4, 2, 4, P("B"));
    p.ellipse(4, 3.5, 3.3, 2.2, P(f ? "c" : "i"));
    p.set(3, 2, P("w"));
    p.outline();
  }),
  proc("deco_crystal", 8, 12, 2, true, (p, f) => {
    const c = f ? ["C", "c", "a"] : ["I", "i", "j"];
    for (let y = 2; y < 12; y++) {
      const half = Math.min(2.5, (y - 1) * 0.6);
      for (let x = 0; x < 8; x++) if (Math.abs(x + 0.5 - 4) <= half) p.set(x, y, P(x < 4 ? c[1] : c[0]));
    }
    p.rect(3, 3, 1, 6, P(c[2]));
    p.outline();
  }),
  proc("deco_tree", 32, 40, 2, true, (p, f) => {
    p.rect(14, 22, 4, 17, P("H"));
    p.rect(14, 22, 1, 17, P("h"));
    const o = f;
    p.disc(16 + o, 15, 11, P("P"));
    p.disc(10 + o, 18, 7, P("P"));
    p.disc(22 + o, 18, 7, P("P"));
    p.disc(15 + o, 13, 9.5, P("p"));
    p.disc(10 + o, 16, 5.5, P("p"));
    p.disc(21 + o, 16, 5.5, P("q"));
    p.disc(13 + o, 10, 4, P("q"));
    p.disc(12 + o, 9, 1.5, P("w"));
    p.outline();
  }),
  proc("prop_lantern", 12, 20, 2, true, (p, f) => {
    p.rect(5, 10, 2, 10, P("d"));
    p.ellipse(6, 7, 4.4, 5, P("r"));
    p.ellipse(6, 7, 2.6, 3.6, P(f ? "y" : "o"));
    p.rect(3, 1, 6, 1, P("d"));
    p.outline();
  }),
  proc("prop_gift", 14, 14, 1, true, (p) => {
    p.rect(2, 5, 10, 8, P("m"));
    p.rect(6, 5, 2, 8, P("p"));
    p.rect(2, 8, 10, 1, P("p"));
    p.disc(5, 4, 2, P("p"));
    p.disc(9, 4, 2, P("p"));
    p.outline();
  }),
];

export const STANDIN_SPRITES: ProcSprite[] = [tile, ...enemies, ...misc];
