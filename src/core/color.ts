/**
 * Colour helpers. Colours in code are 0xRRGGBB integers (see C in
 * src/art/palette.ts). Alpha is always passed separately (0..1).
 */
import { clamp } from "./math";

export const rgb = (r: number, g: number, b: number): number =>
  ((clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255)) >>> 0;
export const red = (c: number): number => (c >>> 16) & 255;
export const green = (c: number): number => (c >>> 8) & 255;
export const blue = (c: number): number => c & 255;

/** '#rrggbb' -> 0xRRGGBB */
export const hexColor = (hex: string): number => parseInt(hex.replace("#", "").slice(0, 6), 16) >>> 0;

/** Lerp two 0xRRGGBB colours per channel. */
export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >>> 16) & 255;
  const ag = (a >>> 8) & 255;
  const ab = a & 255;
  const r = ar + ((((b >>> 16) & 255) - ar) * t) | 0;
  const g = ag + ((((b >>> 8) & 255) - ag) * t) | 0;
  const bb = ab + (((b & 255) - ab) * t) | 0;
  return ((r << 16) | (g << 8) | bb) >>> 0;
}

/** Multiply brightness (k > 1 brightens, clamped). */
export function scaleColor(c: number, k: number): number {
  return rgb(((c >>> 16) & 255) * k, ((c >>> 8) & 255) * k, (c & 255) * k);
}

/** HSV (h in 0..1 wraps, s, v 0..1) -> 0xRRGGBB */
export function hsv(h: number, s: number, v: number): number {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      (r = v), (g = t), (b = p);
      break;
    case 1:
      (r = q), (g = v), (b = p);
      break;
    case 2:
      (r = p), (g = v), (b = t);
      break;
    case 3:
      (r = p), (g = q), (b = v);
      break;
    case 4:
      (r = t), (g = p), (b = v);
      break;
    default:
      (r = v), (g = p), (b = q);
  }
  return rgb(r * 255, g * 255, b * 255);
}

/** Pastel rainbow colour at phase t (0..1 wraps). */
export const rainbow = (t: number, sat = 0.55, val = 1): number => hsv(t, sat, val);

/** Write [r,g,b] floats 0..1 into out (index offset `o`). */
export function toFloats(c: number, out: Float32Array | number[], o = 0): void {
  out[o] = ((c >>> 16) & 255) / 255;
  out[o + 1] = ((c >>> 8) & 255) / 255;
  out[o + 2] = (c & 255) / 255;
}

/** 0xRRGGBB -> 'rgb(r g b / a)' CSS string (allocates; for DOM only). */
export const cssColor = (c: number, a = 1): string => `rgb(${(c >>> 16) & 255} ${(c >>> 8) & 255} ${c & 255} / ${a})`;
