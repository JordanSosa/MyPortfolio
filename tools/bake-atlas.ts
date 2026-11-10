/**
 * Build-time atlas bake (docs/ENGINE.md "Boot path"). Paints and packs every
 * registered sprite + font exactly as the runtime does (`new Atlas()` on the
 * registry: no GL needed) and returns
 *
 *   meta  the frame tables, sprite infos and font tables (Atlas.toBaked),
 *         plus the texel PALETTE: the atlas holds only a few hundred distinct
 *         premultiplied RGBA values (pixel art on a fixed palette, plus its
 *         alpha ramps), most frequent first, and an FNV-1a hash of the texels
 *   png   atlas.png: an 8-bit grayscale PNG, width x (2 x height), PNG filter
 *         0 on every row, holding the 16-bit palette index of every texel:
 *         rows [0, h) the low bytes, rows [h, 2h) the high bytes (nearly all
 *         zero). About 130 KB where a plain RGBA PNG is 0.7-1 MB, it decodes
 *         exactly whichever way the browser reads it (render/atlas-source.ts:
 *         a native inflate of the scanlines, or the image decoder + a canvas -
 *         opaque gray pixels survive both), and the result is byte for byte
 *         the premultiplied RGBA `Atlas.buildPixels()` uploads to GL today.
 *
 * vite.config.ts runs it through Vite's module runner (the registry uses
 * import.meta.glob) at the start of every production build; tests/atlas-bake
 * checks it byte for byte against a runtime atlas.
 */
import { createRequire } from "node:module";
import { FONT_MANIFEST, MANIFEST } from "../src/art/manifest";
import { ALL_FONTS, ALL_SPRITES } from "../src/art/sprites/index";
import { Atlas, type BakedAtlasMeta } from "../src/render/atlas";

interface PngLib {
  PNG: {
    new (o: { width: number; height: number }): { data: Buffer };
    sync: {
      write(png: { data: Buffer }, o: Record<string, number | boolean>): Buffer;
      read(b: Buffer): { width: number; height: number; data: Buffer };
    };
  };
}

const pngjs = (): PngLib => createRequire(import.meta.url)("pngjs") as PngLib;

export interface BakedAtlas {
  meta: BakedAtlasMeta;
  png: Uint8Array;
  /** The texture bytes (premultiplied RGBA, = buildPixels()). */
  pixels: Uint8Array;
}

/** The runtime atlas of the current sprite registry (what dev / tests build). */
export function runtimeAtlas(): Atlas {
  return new Atlas({ sprites: ALL_SPRITES, fonts: ALL_FONTS, manifest: MANIFEST, fontManifest: FONT_MANIFEST });
}

/** FNV-1a over u32 words (the texels as little-endian u32). */
export function texelHash(words: Uint32Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 0x01000193) >>> 0;
  return h >>> 0;
}

/** Palette (most frequent texel first) + per-texel index of premultiplied RGBA bytes. */
export function indexTexels(pixels: Uint8Array): { palette: Uint32Array; index: Uint16Array } {
  const words = new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.byteLength >> 2);
  const freq = new Map<number, number>();
  for (let i = 0; i < words.length; i++) freq.set(words[i], (freq.get(words[i]) ?? 0) + 1);
  const order = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map((e) => e[0]);
  if (order.length > 65536) throw new Error(`[bake-atlas] ${order.length} distinct texels do not fit a 16-bit index`);
  const at = new Map(order.map((c, i) => [c, i]));
  const index = new Uint16Array(words.length);
  for (let i = 0; i < words.length; i++) index[i] = at.get(words[i]) as number;
  return { palette: Uint32Array.from(order), index };
}

/** The two-plane grayscale index PNG (filter 0, zlib's default strategy: pngjs defaults to RLE). */
export function encodeIndexPng(width: number, height: number, index: Uint16Array): Uint8Array {
  const { PNG } = pngjs();
  const img = new PNG({ width, height: height * 2 });
  const d = img.data;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const lo = i * 4;
    const hi = (i + n) * 4;
    d[lo] = d[lo + 1] = d[lo + 2] = index[i] & 255;
    d[hi] = d[hi + 1] = d[hi + 2] = index[i] >> 8;
    d[lo + 3] = d[hi + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(img, { colorType: 0, inputColorType: 6, inputHasAlpha: true, bitDepth: 8, filterType: 0, deflateLevel: 9, deflateStrategy: 0 }));
}

/** Decode a PNG with pngjs (8-bit RGBA out; tests). */
export function decodePng(png: Uint8Array): { width: number; height: number; data: Uint8Array } {
  const r = pngjs().PNG.sync.read(Buffer.from(png));
  return { width: r.width, height: r.height, data: new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength) };
}

/** Premultiplied RGBA texels from a decoded index PNG (pngjs RGBA: gray in R) + the palette bytes. */
export function texelsFromIndexPng(rgba: Uint8Array, width: number, height: number, palette: readonly number[]): Uint8Array {
  const pal = new Uint32Array(new Uint8Array(palette).buffer);
  const out = new Uint8Array(width * height * 4);
  const o32 = new Uint32Array(out.buffer);
  const n = width * height;
  for (let i = 0; i < n; i++) o32[i] = pal[rgba[i * 4] | (rgba[(i + n) * 4] << 8)];
  return out;
}

export function bakeAtlas(): BakedAtlas {
  const a = runtimeAtlas();
  const pixels = a.buildPixels();
  const { palette, index } = indexTexels(pixels);
  const palBytes = [...new Uint8Array(palette.buffer)];
  const hash = texelHash(new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.byteLength >> 2));
  return { meta: a.toBaked(palBytes, hash), png: encodeIndexPng(a.width, a.height, index), pixels };
}
