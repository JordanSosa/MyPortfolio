/**
 * Where the texture atlas comes from (docs/ENGINE.md "Boot path").
 *
 *  - production build: the atlas was painted and packed at build time
 *    (vite.config.ts `bakedAtlas` -> tools/bake-atlas.ts): `virtual:kk-atlas`
 *    holds its tables, its texel palette and the URL of atlas.png (a data URI
 *    in the single-file build), a grayscale image of 16-bit palette indices
 *    (two planes: low bytes, then high bytes). preloadAtlas() fetches it,
 *    inflates the scanlines with the browser's native DecompressionStream
 *    (the PNG is written with filter 0, so they ARE the index planes; no JS
 *    PNG decoder) and looks the texels up: the exact premultiplied bytes the
 *    runtime atlas would upload. Browsers without DecompressionStream (iOS
 *    < 16.4) decode the PNG natively and read it back from a canvas (opaque
 *    gray pixels come back exact; a hash check reports anything else). No
 *    sprite module is ever loaded or evaluated in production.
 *  - dev server, tests, tools: the sprite registry is imported on demand and
 *    the atlas is painted at runtime (sprite edits show on reload).
 *
 * main.ts awaits preloadAtlas() before `new App()`; the Renderer then picks
 * the preloaded atlas up synchronously (takeAtlas), so neither constructor
 * changed. A page that builds a Renderer itself (tools/engine-test.ts) awaits
 * preloadAtlas() first.
 */
import type { SpriteDef } from "../art/format";
import baked from "virtual:kk-atlas";
import { Atlas, type BakedAtlasMeta } from "./atlas";

let loaded: Atlas | null = null;
let pending: Promise<Atlas> | null = null;
let extras: readonly SpriteDef[] = [];

/** Load the atlas once (later calls share it). `extraSprites`: dev / tools stand-ins (runtime atlas only). */
export function preloadAtlas(opts: { extraSprites?: readonly SpriteDef[] } = {}): Promise<Atlas> {
  if (opts.extraSprites?.length) extras = opts.extraSprites;
  pending ??= load().then((a) => (loaded = a));
  return pending;
}

/** The preloaded atlas (the Renderer constructor). Throws when preloadAtlas() has not finished. */
export function takeAtlas(): Atlas {
  if (!loaded) throw new Error("[atlas] the atlas is not loaded yet: await preloadAtlas() before creating a Renderer");
  return loaded;
}

async function load(): Promise<Atlas> {
  if (baked) {
    if (extras.length) console.warn("[atlas] extraSprites are ignored by the baked atlas (dev server only)");
    return Atlas.fromBaked(baked.meta, await bakedTexels(baked.url, baked.meta));
  }
  // (never reached in a production build: `baked` is always set there, and this import is dropped)
  if (!import.meta.env.PROD) {
    const { ALL_SPRITES, ALL_FONTS } = await import("../art/sprites/index");
    return new Atlas({ sprites: ALL_SPRITES, fonts: ALL_FONTS, extraSprites: extras });
  }
  throw new Error("[atlas] no baked atlas in this build");
}

/** The baked atlas' premultiplied RGBA texels (exact: see the header). */
async function bakedTexels(url: string, meta: BakedAtlasMeta): Promise<Uint8Array> {
  const png = await urlBytes(url);
  if (typeof DecompressionStream === "function") return texelsFromPlanes(await inflateIndexPng(png, meta.width, meta.height), meta.width + 1, 1, meta);
  const out = texelsFromPlanes(await canvasIndexPng(png, meta.width, meta.height), meta.width * 4, 0, meta, 4);
  if (texelHash(out) !== meta.hash) console.warn("[atlas] the atlas image decoded with different texels on this browser (colour management?): art may look slightly off");
  return out;
}

/**
 * The bytes behind `url`. A data: URI (the single-file build inlines atlas.png)
 * is decoded in place: sandboxed hosts with a strict Content-Security-Policy
 * (connect-src) refuse fetch() even for data: URLs, which made the game fail
 * to boot with "The game's art could not be loaded". Real URLs (the multi-file
 * GitHub Pages build) are fetched as usual.
 */
export async function urlBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    if (comma < 0) throw new Error("[atlas] malformed data URI");
    const head = url.slice(5, comma);
    const body = url.slice(comma + 1);
    if (/;base64$/i.test(head)) {
      const bin = atob(body);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new TextEncoder().encode(decodeURIComponent(body));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[atlas] ${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * The index planes of the baked atlas.png (8-bit gray, width x 2h, no
 * interlace, filter 0): the IDAT zlib stream inflated natively; every
 * scanline keeps its leading filter byte (0), skipped by texelsFromPlanes.
 */
export async function inflateIndexPng(png: Uint8Array, w: number, h: number): Promise<Uint8Array> {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (dv.getUint32(0) !== 0x89504e47) throw new Error("[atlas] not a PNG");
  const idat: Uint8Array[] = [];
  for (let o = 8; o + 8 <= png.length; ) {
    const len = dv.getUint32(o);
    const type = dv.getUint32(o + 4);
    if (type === 0x49484452) {
      // IHDR: width, height, bit depth 8, colour type 0 (gray), interlace 0
      if (dv.getUint32(o + 8) !== w || dv.getUint32(o + 12) !== h * 2 || png[o + 16] !== 8 || png[o + 17] !== 0 || png[o + 20] !== 0)
        throw new Error("[atlas] atlas.png does not match its tables");
    } else if (type === 0x49444154) idat.push(png.subarray(o + 8, o + 8 + len));
    else if (type === 0x49454e44) break;
    o += 12 + len;
  }
  const raw = new Uint8Array(await new Response(new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
  if (raw.length !== (w + 1) * h * 2) throw new Error("[atlas] atlas.png data is truncated");
  for (let y = 0; y < h * 2; y++) if (raw[y * (w + 1)] !== 0) throw new Error("[atlas] atlas.png must use PNG filter 0 (tools/bake-atlas.ts writes it)");
  return raw;
}

/** The index planes through the browser's image decoder + a canvas (RGBA, gray in R). */
async function canvasIndexPng(png: Uint8Array, w: number, h: number): Promise<Uint8Array> {
  const img = new Image();
  const src = URL.createObjectURL(new Blob([png as BlobPart], { type: "image/png" }));
  try {
    img.src = src;
    await img.decode();
  } finally {
    URL.revokeObjectURL(src);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h * 2;
  const g = c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  g.drawImage(img, 0, 0);
  return new Uint8Array(g.getImageData(0, 0, w, h * 2).data.buffer);
}

/**
 * Texels from the two index planes: `stride` bytes a row, the first index byte
 * at `skip`, `step` bytes per index (1: inflated scanlines, 4: canvas RGBA).
 */
function texelsFromPlanes(planes: Uint8Array, stride: number, skip: number, meta: BakedAtlasMeta, step = 1): Uint8Array {
  const { width: w, height: h } = meta;
  const pal = new Uint32Array(new Uint8Array(meta.palette).buffer);
  const out = new Uint8Array(w * h * 4);
  const o32 = new Uint32Array(out.buffer);
  for (let y = 0; y < h; y++) {
    let lo = y * stride + skip;
    let hi = (y + h) * stride + skip;
    const d = y * w;
    for (let x = 0; x < w; x++, lo += step, hi += step) o32[d + x] = pal[planes[lo] | (planes[hi] << 8)];
  }
  return out;
}

/** FNV-1a over the texels as u32 words (tools/bake-atlas.ts texelHash). */
function texelHash(px: Uint8Array): number {
  const words = new Uint32Array(px.buffer, px.byteOffset, px.byteLength >> 2);
  let hsh = 0x811c9dc5;
  for (let i = 0; i < words.length; i++) hsh = Math.imul(hsh ^ words[i], 0x01000193) >>> 0;
  return hsh >>> 0;
}
