/**
 * Texture atlas. Rasterises sprite + font defs (src/art), shelf-packs them
 * into one RGBA texture (premultiplied alpha, nearest sampling) with a 1px
 * edge extrusion + 1px transparent gutter around every frame.
 *
 * Every frame gets a numeric *handle*; a sprite's frames are consecutive
 * handles (info.first .. info.first + info.count - 1). Hot code should resolve
 * handles once (atlas.info("en_puff").first) and draw by number.
 *
 * Manifest ids that are not registered yet get a clearly visible placeholder
 * (pink checker + outline) of the right size and frame count; a single
 * console warning lists them.
 *
 * Two ways to get one (docs/ENGINE.md "Boot path"): `new Atlas({ sprites,
 * fonts })` paints and packs at runtime (dev, tests, tools), and
 * `Atlas.fromBaked(meta, pixels)` wraps the atlas the production build baked
 * (tools/bake-atlas.ts: `toBaked()` + `buildPixels()` of a runtime atlas), so
 * the game never evaluates the sprite modules on a phone. This module never
 * imports the sprite registry: src/render/atlas-source.ts picks the source.
 */
import { rasterizeFont, rasterizeSprite, type FontDef, type RasterSprite, type SpriteDef } from "../art/format";
import { FONT_MANIFEST, MANIFEST } from "../art/manifest";
import { FALLBACK_FONT } from "./fallback-font";
import type { GL } from "./gl";

/** Serializable font table of a baked atlas (FontInfo with plain arrays). */
export interface BakedFont {
  id: string;
  h: number;
  handle: number[];
  advance: number[];
  width: number[];
  spaceAdvance: number;
  placeholder: boolean;
}

/** Everything but the pixels of a packed atlas (the build's atlas.json). */
export interface BakedAtlasMeta {
  version: 1;
  width: number;
  height: number;
  /**
   * The distinct premultiplied RGBA texels, 4 bytes each (most frequent first). atlas.png stores a
   * 16-bit index into this list per texel (render/atlas-source.ts decodes it).
   */
  palette: number[];
  /** FNV-1a over the texels as little-endian u32 (checks a decode that went through a canvas). */
  hash: number;
  fx: number[];
  fy: number[];
  fw: number[];
  fh: number[];
  fox: number[];
  foy: number[];
  /** Sprite infos in handle order (the "__missing" placeholder included). */
  sprites: SpriteInfo[];
  fonts: BakedFont[];
  missing: string[];
}

export interface AtlasOptions {
  /** Sprite defs (the registry, src/art/sprites/index.ts ALL_SPRITES). */
  sprites: readonly SpriteDef[];
  /** Font defs (ALL_FONTS). */
  fonts: readonly FontDef[];
  /** More defs after `sprites` (registered ids win; tools/engine-test stand-ins). */
  extraSprites?: readonly SpriteDef[];
}

export interface SpriteInfo {
  id: string;
  w: number;
  h: number;
  /** Pivot in sprite pixels. */
  ox: number;
  oy: number;
  fps: number;
  /** First frame handle. */
  first: number;
  /** Number of frames. */
  count: number;
  /** True for generated placeholder art. */
  placeholder: boolean;
}

export interface FontInfo {
  id: string;
  /** Cell height including outline. */
  h: number;
  /** Handle per char code (0..255), -1 = none. */
  handle: Int32Array;
  /** Pen advance per char code. */
  advance: Uint8Array;
  /** Glyph cell width per char code. */
  width: Uint8Array;
  /** Advance used for unknown characters. */
  spaceAdvance: number;
  placeholder: boolean;
}

interface PackItem {
  handle: number;
  w: number;
  h: number;
  px: Uint8ClampedArray;
}

const PAD = 2; // 1px extrusion + 1px transparent gutter

export class Atlas {
  width = 0;
  height = 0;
  /** Frame table (by handle). */
  fx = new Uint16Array(0);
  fy = new Uint16Array(0);
  fw = new Uint16Array(0);
  fh = new Uint16Array(0);
  fox = new Float32Array(0);
  foy = new Float32Array(0);
  frameCount = 0;

  readonly sprites = new Map<string, SpriteInfo>();
  readonly fonts = new Map<string, FontInfo>();
  /** Manifest ids that got placeholder art. */
  readonly missing: string[] = [];
  /** Handle of the generic "unknown sprite" placeholder. */
  missingInfo!: SpriteInfo;

  private rasters = new Map<string, RasterSprite>();
  private items: PackItem[] = [];
  private warned = new Set<string>();
  private urlCache = new Map<string, string>();
  /** Baked atlas: the premultiplied texture bytes (uploaded as they are; DOM rasters are cut from them). */
  private baked: Uint8Array | null = null;
  texture: WebGLTexture | null = null;

  /** A baked atlas (tools/bake-atlas.ts): `pixels` = the exact premultiplied RGBA its runtime twin uploads. */
  static fromBaked(meta: BakedAtlasMeta, pixels: Uint8Array): Atlas {
    if (meta.version !== 1) throw new Error(`[atlas] unknown baked atlas version ${meta.version}`);
    if (pixels.length !== meta.width * meta.height * 4) throw new Error(`[atlas] baked pixels are ${pixels.length} bytes, want ${meta.width * meta.height * 4}`);
    const a = new Atlas(null);
    a.width = meta.width;
    a.height = meta.height;
    a.frameCount = meta.fx.length;
    a.fx = Uint16Array.from(meta.fx);
    a.fy = Uint16Array.from(meta.fy);
    a.fw = Uint16Array.from(meta.fw);
    a.fh = Uint16Array.from(meta.fh);
    a.fox = Float32Array.from(meta.fox);
    a.foy = Float32Array.from(meta.foy);
    for (const s of meta.sprites) a.sprites.set(s.id, { ...s });
    for (const f of meta.fonts)
      a.fonts.set(f.id, {
        id: f.id,
        h: f.h,
        handle: Int32Array.from(f.handle),
        advance: Uint8Array.from(f.advance),
        width: Uint8Array.from(f.width),
        spaceAdvance: f.spaceAdvance,
        placeholder: f.placeholder,
      });
    a.missing.push(...meta.missing);
    a.missingInfo = a.sprites.get("__missing") as SpriteInfo;
    a.baked = pixels;
    return a;
  }

  /** The serializable tables of this atlas (the build bakes them next to `buildPixels()`; palette / hash by the bake). */
  toBaked(palette: number[] = [], hash = 0): BakedAtlasMeta {
    return {
      version: 1,
      width: this.width,
      height: this.height,
      palette,
      hash,
      fx: [...this.fx],
      fy: [...this.fy],
      fw: [...this.fw],
      fh: [...this.fh],
      fox: [...this.fox],
      foy: [...this.foy],
      sprites: [...this.sprites.values()].sort((a, b) => a.first - b.first).map((s) => ({ ...s })),
      fonts: [...this.fonts.values()].map((f) => ({
        id: f.id,
        h: f.h,
        handle: [...f.handle],
        advance: [...f.advance],
        width: [...f.width],
        spaceAdvance: f.spaceAdvance,
        placeholder: f.placeholder,
      })),
      missing: [...this.missing],
    };
  }

  /** Paint + pack sprite / font defs at runtime (`null`: an empty shell for fromBaked). */
  constructor(opts: AtlasOptions | null) {
    if (!opts) return;
    const defs = [...opts.sprites, ...(opts.extraSprites ?? [])];
    const fonts = opts.fonts;
    const tables: { x: number[]; y: number[]; w: number[]; h: number[]; ox: number[]; oy: number[] } = { x: [], y: [], w: [], h: [], ox: [], oy: [] };
    let handle = 0;
    const addRaster = (r: RasterSprite, placeholder: boolean) => {
      if (this.sprites.has(r.id)) return;
      const info: SpriteInfo = { id: r.id, w: r.w, h: r.h, ox: r.ox, oy: r.oy, fps: r.fps, first: handle, count: r.frames.length, placeholder };
      for (const px of r.frames) {
        this.items.push({ handle, w: r.w, h: r.h, px });
        tables.ox.push(r.ox);
        tables.oy.push(r.oy);
        handle++;
      }
      this.sprites.set(r.id, info);
      this.rasters.set(r.id, r);
    };

    for (const d of defs) {
      try {
        addRaster(rasterizeSprite(d), false);
      } catch (e) {
        console.warn(`[atlas] failed to rasterise '${d.id}':`, e);
      }
    }
    // placeholders for manifest entries not drawn yet
    for (const m of MANIFEST) {
      const have = this.sprites.get(m.id);
      if (have) continue;
      this.missing.push(m.id);
      const ox = m.w / 2;
      const oy = m.pivot === "feet" ? m.h - 1 : m.h / 2;
      addRaster(placeholderRaster(m.id, m.w, m.h, m.frames, ox, oy), true);
    }
    addRaster(placeholderRaster("__missing", 10, 10, 1, 5, 5), true);
    this.missingInfo = this.sprites.get("__missing") as SpriteInfo;

    // fonts (+ fallback for any manifest font that is missing)
    const fontDefs = new Map<string, FontDef>();
    for (const f of fonts) fontDefs.set(f.id, f);
    fontDefs.set(FALLBACK_FONT.id, FALLBACK_FONT);
    const missingFonts: string[] = [];
    for (const fm of FONT_MANIFEST) if (!fontDefs.has(fm.id)) missingFonts.push(fm.id);
    const fontEntries: [string, FontDef, boolean][] = [...fontDefs].map(([id, d]) => [id, d, false]);
    for (const id of missingFonts) fontEntries.push([id, FALLBACK_FONT, true]);
    for (const [id, def, placeholder] of fontEntries) {
      let rf;
      try {
        rf = rasterizeFont(def);
      } catch (e) {
        console.warn(`[atlas] failed to rasterise font '${id}':`, e);
        continue;
      }
      const info: FontInfo = {
        id,
        h: rf.h,
        handle: new Int32Array(256).fill(-1),
        advance: new Uint8Array(256),
        width: new Uint8Array(256),
        spaceAdvance: 4,
        placeholder,
      };
      for (const [ch, gl] of rf.glyphs) {
        const code = ch.charCodeAt(0);
        if (code > 255) continue;
        info.handle[code] = handle;
        info.advance[code] = gl.advance;
        info.width[code] = gl.w;
        this.items.push({ handle, w: gl.w, h: gl.h, px: gl.pixels });
        tables.ox.push(0);
        tables.oy.push(0);
        handle++;
      }
      // lowercase -> uppercase aliases, uppercase -> lowercase aliases
      for (let c = 97; c <= 122; c++) {
        if (info.handle[c] < 0 && info.handle[c - 32] >= 0) {
          info.handle[c] = info.handle[c - 32];
          info.advance[c] = info.advance[c - 32];
          info.width[c] = info.width[c - 32];
        } else if (info.handle[c - 32] < 0 && info.handle[c] >= 0) {
          info.handle[c - 32] = info.handle[c];
          info.advance[c - 32] = info.advance[c];
          info.width[c - 32] = info.width[c];
        }
      }
      if (info.handle[32] >= 0) info.spaceAdvance = info.advance[32];
      else info.advance[32] = info.spaceAdvance;
      this.fonts.set(id, info);
    }
    if (missingFonts.length) this.missing.push(...missingFonts);

    this.frameCount = handle;
    this.fx = new Uint16Array(handle);
    this.fy = new Uint16Array(handle);
    this.fw = new Uint16Array(handle);
    this.fh = new Uint16Array(handle);
    this.fox = Float32Array.from(tables.ox);
    this.foy = Float32Array.from(tables.oy);
    this.pack();

    if (this.missing.length) {
      console.warn(
        `[atlas] ${this.missing.length} manifest entr${this.missing.length === 1 ? "y is" : "ies are"} not drawn yet - using placeholders: ${this.missing.join(", ")}`,
      );
    }
  }

  // ---------------------------------------------------------------- packing
  private pack(): void {
    const order = this.items.slice().sort((a, b) => b.h - a.h || b.w - a.w);
    let area = 0;
    for (const it of order) area += (it.w + PAD * 2) * (it.h + PAD * 2);
    const widths = area < 3_000_000 ? [2048, 4096] : [4096];
    for (const W of widths) {
      const H = this.tryPack(order, W);
      if (H > 0 && H <= 4096) {
        this.width = W;
        this.height = H;
        return;
      }
    }
    throw new Error("[atlas] sprites do not fit into a 4096x4096 atlas");
  }

  /** Shelf pack into width W. Returns the used height (multiple of 4) or -1. */
  private tryPack(order: PackItem[], W: number): number {
    let x = 0;
    let y = 0;
    let shelf = 0;
    for (const it of order) {
      const cw = it.w + PAD * 2;
      const ch = it.h + PAD * 2;
      if (cw > W) return -1;
      if (x + cw > W) {
        y += shelf;
        x = 0;
        shelf = 0;
      }
      this.fx[it.handle] = x + PAD;
      this.fy[it.handle] = y + PAD;
      this.fw[it.handle] = it.w;
      this.fh[it.handle] = it.h;
      x += cw;
      if (ch > shelf) shelf = ch;
    }
    const H = y + shelf;
    return Math.ceil(H / 4) * 4;
  }

  /** The premultiplied RGBA pixel buffer (a baked atlas: the baked bytes as they are). */
  buildPixels(): Uint8Array {
    if (this.baked) return this.baked;
    const W = this.width;
    const out = new Uint8Array(W * this.height * 4);
    for (const it of this.items) {
      const tx = this.fx[it.handle];
      const ty = this.fy[it.handle];
      const w = it.w;
      const h = it.h;
      const src = it.px;
      // copy with extrusion: destination covers [-1, w] x [-1, h]
      for (let y = -1; y <= h; y++) {
        const sy = y < 0 ? 0 : y >= h ? h - 1 : y;
        for (let x = -1; x <= w; x++) {
          const sx = x < 0 ? 0 : x >= w ? w - 1 : x;
          const si = (sy * w + sx) * 4;
          const a = src[si + 3];
          if (a === 0) continue;
          const di = ((ty + y) * W + (tx + x)) * 4;
          out[di] = (src[si] * a + 127) / 255;
          out[di + 1] = (src[si + 1] * a + 127) / 255;
          out[di + 2] = (src[si + 2] * a + 127) / 255;
          out[di + 3] = a;
        }
      }
    }
    return out;
  }

  /** (Re)create the GL texture. */
  upload(gl: GL): WebGLTexture {
    const t = gl.createTexture();
    if (!t) throw new Error("[atlas] createTexture failed");
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.buildPixels());
    this.texture = t;
    return t;
  }

  // ---------------------------------------------------------------- lookups
  has(id: string): boolean {
    const s = this.sprites.get(id);
    return !!s && !s.placeholder;
  }

  /** Sprite info (placeholder info for unknown ids, warned once). */
  info(id: string): SpriteInfo {
    const s = this.sprites.get(id);
    if (s) return s;
    if (!this.warned.has(id)) {
      this.warned.add(id);
      console.warn(`[atlas] unknown sprite id '${id}' (not in manifest, not registered)`);
    }
    return this.missingInfo;
  }

  /** Frame handle for (id, frame). Frame wraps around the frame count. */
  handle(id: string, frame = 0): number {
    const s = this.info(id);
    const f = ((frame % s.count) + s.count) % s.count;
    return s.first + (f | 0);
  }

  /** Animation descriptor { first, count, fps } (fps from the sprite def unless overridden). */
  anim(id: string, fps?: number): Anim {
    const s = this.info(id);
    return { first: s.first, count: s.count, fps: fps ?? s.fps };
  }

  font(id = "font_main"): FontInfo {
    const f = this.fonts.get(id) ?? this.fonts.get("font_engine");
    return f as FontInfo;
  }

  /**
   * Raw straight-alpha frame pixels (for CPU use). A baked atlas cuts them out of the premultiplied
   * texture on first use (cached): opaque and clear pixels are exact; a partly transparent pixel gets
   * the colour that premultiplies back to the same texel (DOM canvases store premultiplied colour, so
   * icons drawn from it come out the same as from the painted raster).
   */
  raster(id: string): RasterSprite | undefined {
    const r = this.rasters.get(id);
    if (r || !this.baked) return r;
    const s = this.sprites.get(id);
    if (!s) return undefined;
    const out = this.cut(s);
    this.rasters.set(id, out);
    return out;
  }

  private cut(s: SpriteInfo): RasterSprite {
    const px = this.baked as Uint8Array;
    const W = this.width;
    const frames: Uint8ClampedArray[] = [];
    for (let f = 0; f < s.count; f++) {
      const hd = s.first + f;
      const x0 = this.fx[hd];
      const y0 = this.fy[hd];
      const w = s.w;
      const h = s.h;
      const fr = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        let si = ((y0 + y) * W + x0) * 4;
        let di = y * w * 4;
        for (let x = 0; x < w; x++, si += 4, di += 4) {
          const a = px[si + 3];
          if (a === 0) continue;
          if (a === 255) {
            fr[di] = px[si];
            fr[di + 1] = px[si + 1];
            fr[di + 2] = px[si + 2];
          } else {
            fr[di] = Math.round((px[si] * 255) / a);
            fr[di + 1] = Math.round((px[si + 1] * 255) / a);
            fr[di + 2] = Math.round((px[si + 2] * 255) / a);
          }
          fr[di + 3] = a;
        }
      }
      frames.push(fr);
    }
    return { id: s.id, w: s.w, h: s.h, ox: s.ox, oy: s.oy, fps: s.fps, frames };
  }

  /** A canvas with the frame drawn at integer `scale` (nearest). */
  canvas(id: string, frame = 0, scale = 1): HTMLCanvasElement {
    const r = this.raster(id) ?? this.raster("__missing")!;
    const f = r.frames[((frame % r.frames.length) + r.frames.length) % r.frames.length];
    const src = document.createElement("canvas");
    src.width = r.w;
    src.height = r.h;
    // willReadFrequently keeps these tiny canvases CPU-side: no GPU readback stall on toDataURL
    src.getContext("2d", { willReadFrequently: true })!.putImageData(new ImageData(new Uint8ClampedArray(f), r.w, r.h), 0, 0);
    if (scale === 1) return src;
    const c = document.createElement("canvas");
    c.width = Math.round(r.w * scale);
    c.height = Math.round(r.h * scale);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  /** PNG data URL of a frame, nearest-scaled (cached). For DOM icons/portraits (use image-rendering: pixelated). */
  dataURL(id: string, frame = 0, scale = 1): string {
    const key = `${id}:${frame}:${scale}`;
    let u = this.urlCache.get(key);
    if (!u) {
      u = this.canvas(id, frame, scale).toDataURL("image/png");
      this.urlCache.set(key, u);
    }
    return u;
  }
}

export interface Anim {
  first: number;
  count: number;
  fps: number;
}

/** Frame handle of `anim` at time t (seconds). loop=false clamps on the last frame. */
export function animFrame(a: Anim, t: number, loop = true): number {
  let f = Math.floor(t * a.fps);
  if (loop) f = ((f % a.count) + a.count) % a.count;
  else f = f < 0 ? 0 : f >= a.count ? a.count - 1 : f;
  return a.first + f;
}

function placeholderRaster(id: string, w: number, h: number, frames: number, ox: number, oy: number): RasterSprite {
  const out: Uint8ClampedArray[] = [];
  for (let f = 0; f < frames; f++) {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        let c: [number, number, number];
        if (edge) c = [45, 27, 69];
        else if (((x >> 1) + (y >> 1) + f) & 1) c = [255, 79, 216];
        else c = [255, 184, 240];
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
        px[i + 3] = 255;
      }
    // frame indicator: white tick along the top inner row
    if (w > 4) {
      const fx = 1 + ((f * 2) % Math.max(1, w - 3));
      for (let k = 0; k < 2; k++) {
        const i = (1 * w + fx + k) * 4;
        px[i] = px[i + 1] = px[i + 2] = 255;
      }
    }
    // pivot marker
    const pxX = Math.min(w - 1, Math.max(0, Math.floor(ox)));
    const pxY = Math.min(h - 1, Math.max(0, Math.floor(oy)));
    const pi = (pxY * w + pxX) * 4;
    px[pi] = 79;
    px[pi + 1] = 230;
    px[pi + 2] = 223;
    out.push(px);
  }
  return { id, w, h, ox, oy, fps: 6, frames: out };
}
