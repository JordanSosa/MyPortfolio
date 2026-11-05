/**
 * Sprite data format + rasteriser. This file is a FROZEN CONTRACT shared by
 * the art modules (src/art/sprites/*.ts), the atlas builder (src/render) and
 * the preview tool (tools/sprites.ts). Add helpers in your own files instead
 * of changing the types here.
 *
 * A sprite file exports any of:
 *     export const sprites: SpriteDef[] = [...]
 *     export const fonts: FontDef[] = [...]
 * and is auto-registered by src/art/sprites/index.ts (import.meta.glob).
 */
import { PALETTE, hexToRgba } from "./palette";

/**
 * Hand-authored pixel grid. Each frame is a multi-line string, one row per
 * line, one palette key per pixel. '.' = transparent. Leading/trailing
 * whitespace on each line and blank lines are ignored, so frames can be
 * indented inside template literals. Every row must be exactly `w` chars and
 * there must be exactly `h` rows.
 */
export interface GridSprite {
  id: string;
  w: number;
  h: number;
  frames: string[];
  /** Pivot in sprite pixels (what (x,y) means when drawn). Default (w/2, h/2). Characters: put it at the feet. */
  ox?: number;
  oy?: number;
  /**
   * Auto outline: palette key or '#hex'. A 1px 4-neighbour outline is added
   * around opaque pixels, INSIDE the w x h box (leave a 1px transparent margin).
   * Hand-drawn outlines are fine too - then omit this.
   */
  outline?: string | false;
  /** Local palette overrides/additions: key -> '#rrggbb' | '#rrggbbaa'. */
  pal?: Record<string, string>;
  /** Default animation speed in frames/second (default 8). */
  fps?: number;
}

/** Procedurally painted sprite (glows, rings, gradients, noise tiles...). */
export interface ProcSprite {
  id: string;
  w: number;
  h: number;
  frames: number;
  ox?: number;
  oy?: number;
  fps?: number;
  /** Paint frame `frame`. `set` writes straight (non-premultiplied) RGBA 0..255. Unset pixels are transparent. */
  paint(
    frame: number,
    set: (x: number, y: number, r: number, g: number, b: number, a: number) => void,
    w: number,
    h: number,
  ): void;
}

export type SpriteDef = GridSprite | ProcSprite;

/**
 * Bitmap font. Glyphs are grids (rows of 'x' for ink, '.' for empty) of
 * height `h` and any width. Rasterised as WHITE ink (so it can be tinted) with
 * an automatic 1px dark outline, so each glyph cell is (gw+2) x (h+2).
 */
export interface FontDef {
  id: string;
  h: number;
  /** Extra horizontal spacing between glyphs in pixels (default 0; outlines already add 2). */
  spacing?: number;
  /** char -> grid (use 'x' for ink). Include ' ' as an all-'.' glyph to set space width. */
  glyphs: Record<string, string>;
  /** Outline colour (default '#2d1b45'). Use false for no outline. */
  outline?: string | false;
}

export interface RasterSprite {
  id: string;
  w: number;
  h: number;
  ox: number;
  oy: number;
  fps: number;
  /** One straight-alpha RGBA buffer (w*h*4) per frame. */
  frames: Uint8ClampedArray[];
}

export interface RasterGlyph {
  ch: string;
  w: number; // including outline
  h: number; // including outline
  advance: number; // pen advance in px
  pixels: Uint8ClampedArray;
}

export interface RasterFont {
  id: string;
  h: number; // including outline
  glyphs: Map<string, RasterGlyph>;
}

export function isGrid(def: SpriteDef): def is GridSprite {
  return Array.isArray((def as GridSprite).frames);
}

/** Split a frame string into rows (trimmed, blank lines dropped). */
export function rows(frame: string): string[] {
  return frame
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Validate a grid sprite; returns a list of human-readable problems (empty = OK). */
export function validateGrid(def: GridSprite): string[] {
  const errs: string[] = [];
  const pal = { ...PALETTE, ...(def.pal ?? {}) };
  if (!def.frames.length) errs.push(`${def.id}: no frames`);
  def.frames.forEach((f, fi) => {
    const rs = rows(f);
    if (rs.length !== def.h) errs.push(`${def.id}[${fi}]: ${rs.length} rows, expected ${def.h}`);
    rs.forEach((r, ri) => {
      if (r.length !== def.w) errs.push(`${def.id}[${fi}] row ${ri}: ${r.length} chars, expected ${def.w}: "${r}"`);
      for (const ch of r) {
        if (ch !== "." && !(ch in pal)) {
          errs.push(`${def.id}[${fi}] row ${ri}: unknown palette key '${ch}'`);
          break;
        }
      }
    });
  });
  if (def.outline && def.outline[0] !== "#" && !(def.outline in pal)) {
    errs.push(`${def.id}: unknown outline key '${def.outline}'`);
  }
  return errs;
}

function resolveColor(key: string, pal: Record<string, string>): [number, number, number, number] {
  if (key[0] === "#") return hexToRgba(key);
  const hex = pal[key];
  if (!hex) return [255, 0, 255, 255];
  return hexToRgba(hex);
}

/** Add a 1px 4-neighbour outline of colour `col` around opaque pixels (in place, inside bounds). */
export function addOutline(px: Uint8ClampedArray, w: number, h: number, col: [number, number, number, number]): void {
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = px[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const n =
        (x > 0 && solid[i - 1]) ||
        (x < w - 1 && solid[i + 1]) ||
        (y > 0 && solid[i - w]) ||
        (y < h - 1 && solid[i + w]);
      if (n) {
        px[i * 4] = col[0];
        px[i * 4 + 1] = col[1];
        px[i * 4 + 2] = col[2];
        px[i * 4 + 3] = col[3];
      }
    }
  }
}

/** Rasterise any sprite def into RGBA frames. Malformed grids are padded/cropped and painted magenta where unknown. */
export function rasterizeSprite(def: SpriteDef): RasterSprite {
  const w = def.w;
  const h = def.h;
  const out: Uint8ClampedArray[] = [];
  if (isGrid(def)) {
    const pal = { ...PALETTE, ...(def.pal ?? {}) };
    const cache = new Map<string, [number, number, number, number]>();
    for (const f of def.frames) {
      const px = new Uint8ClampedArray(w * h * 4);
      const rs = rows(f);
      for (let y = 0; y < Math.min(h, rs.length); y++) {
        const r = rs[y];
        for (let x = 0; x < Math.min(w, r.length); x++) {
          const ch = r[x];
          if (ch === ".") continue;
          let c = cache.get(ch);
          if (!c) {
            c = resolveColor(ch, pal);
            cache.set(ch, c);
          }
          const i = (y * w + x) * 4;
          px[i] = c[0];
          px[i + 1] = c[1];
          px[i + 2] = c[2];
          px[i + 3] = c[3];
        }
      }
      if (def.outline) addOutline(px, w, h, resolveColor(def.outline, pal));
      out.push(px);
    }
  } else {
    for (let fi = 0; fi < def.frames; fi++) {
      const px = new Uint8ClampedArray(w * h * 4);
      const set = (x: number, y: number, r: number, g: number, b: number, a: number) => {
        x |= 0;
        y |= 0;
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const i = (y * w + x) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = a;
      };
      def.paint(fi, set, w, h);
      out.push(px);
    }
  }
  return {
    id: def.id,
    w,
    h,
    ox: def.ox ?? w / 2,
    oy: def.oy ?? h / 2,
    fps: def.fps ?? 8,
    frames: out,
  };
}

export function rasterizeFont(def: FontDef): RasterFont {
  const glyphs = new Map<string, RasterGlyph>();
  const outline = def.outline === false ? null : resolveColor(def.outline ?? "#2d1b45", PALETTE as Record<string, string>);
  const pad = outline ? 1 : 0;
  for (const [ch, grid] of Object.entries(def.glyphs)) {
    const rs = rows(grid);
    const gw = Math.max(1, ...rs.map((r) => r.length));
    const w = gw + pad * 2;
    const h = def.h + pad * 2;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < Math.min(def.h, rs.length); y++) {
      for (let x = 0; x < rs[y].length; x++) {
        if (rs[y][x] === "." || rs[y][x] === " ") continue;
        const i = ((y + pad) * w + (x + pad)) * 4;
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 255;
      }
    }
    if (outline) addOutline(px, w, h, outline);
    glyphs.set(ch, { ch, w, h, advance: gw + (def.spacing ?? 0) + (pad ? 1 : 0), pixels: px });
  }
  return { id: def.id, h: def.h + pad * 2, glyphs };
}

// ---------------------------------------------------------------------------
// Authoring helpers (pure string transforms on frames). Use freely.
// ---------------------------------------------------------------------------

/** Mirror a frame horizontally. */
export function hflip(frame: string): string {
  return rows(frame)
    .map((r) => [...r].reverse().join(""))
    .join("\n");
}

/** Replace palette keys: recolor(frame, { p: 'u', P: 'U' }). */
export function recolor(frame: string, map: Record<string, string>): string {
  return rows(frame)
    .map((r) => [...r].map((c) => map[c] ?? c).join(""))
    .join("\n");
}

/** Shift a frame by (dx, dy) pixels, filling with '.'. */
export function shift(frame: string, dx: number, dy: number): string {
  const rs = rows(frame);
  const h = rs.length;
  const w = rs[0]?.length ?? 0;
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) {
      const sy = y - dy;
      const sx = x - dx;
      line += sy >= 0 && sy < h && sx >= 0 && sx < w ? rs[sy][sx] : ".";
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Draw `top` over `base` ('.' in top keeps base). Both must be the same size. */
export function overlay(base: string, top: string): string {
  const b = rows(base);
  const t = rows(top);
  return b
    .map((r, y) =>
      [...r]
        .map((c, x) => {
          const tc = t[y]?.[x] ?? ".";
          return tc === "." ? c : tc;
        })
        .join(""),
    )
    .join("\n");
}

/** Replace a horizontal band of rows [y0, y1) in `base` with the same rows from `src`. Handy for leg-only run frames. */
export function spliceRows(base: string, src: string, y0: number, y1: number): string {
  const b = rows(base);
  const s = rows(src);
  return b.map((r, y) => (y >= y0 && y < y1 ? (s[y] ?? r) : r)).join("\n");
}

/** Build a frame from a function. fill(w, h, (x, y) => key). */
export function fill(w: number, h: number, fn: (x: number, y: number) => string): string {
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = "";
    for (let x = 0; x < w; x++) line += fn(x, y);
    out.push(line);
  }
  return out.join("\n");
}
