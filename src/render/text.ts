/**
 * Bitmap text from the atlas (`font_main`, falling back to the built-in font).
 * Glyphs are white ink + dark outline, so `color` tints the ink.
 *
 *   text.draw("LEVEL UP!", x, y, { scale: 2, color: C.yellow, align: "center", wobble: 1.5, layer: Layer.Text })
 *   text.drawFast(Layer.Text, "x99", x, y, 1, 0xffffff, 1, 0)    // positional, no options object
 *   text.measure("HELLO", 2)
 *
 * (x, y) is the top-left (align left), top-centre or top-right of the text box.
 * Use `valign: "middle"` to centre vertically.
 */
import { hsv } from "../core/color";
import type { Atlas, FontInfo } from "./atlas";
import type { SpriteBatch } from "./batch";
import { Flag, Layer } from "./layers";

export type Align = "left" | "center" | "right";

export interface TextOpts {
  layer?: number;
  scale?: number;
  color?: number;
  alpha?: number;
  align?: Align;
  valign?: "top" | "middle" | "bottom";
  /** Per-glyph vertical wave amplitude (px). */
  wobble?: number;
  /** Wave speed (rad/s) and phase per glyph. */
  wobbleSpeed?: number;
  wobblePhase?: number;
  /** Time used for wobble/rainbow (seconds). Defaults to the renderer clock. */
  time?: number;
  /** Per-glyph rainbow colours (ignores `color`). */
  rainbow?: boolean;
  /** Whole-string rotation (radians) around the anchor. */
  rotation?: number;
  /** Flash 0..1 to white. */
  flash?: number;
  /** Extra letter spacing (px, before scale). */
  spacing?: number;
  glow?: boolean;
  additive?: boolean;
  font?: string;
}

export class BitmapText {
  /** Clock for wobble/rainbow when opts.time is not given (renderer advances it). */
  time = 0;
  private font: FontInfo;

  constructor(
    private atlas: Atlas,
    private batch: SpriteBatch,
    fontId = "font_main",
  ) {
    this.font = atlas.font(fontId);
  }

  /** Line height in px at scale 1 (cell height incl. outline). */
  get lineHeight(): number {
    return this.font.h;
  }

  /** Line height in px at scale 1 of a specific font (cell height incl. any outline). */
  lineHeightOf(fontId: string): number {
    return this.atlas.font(fontId).h;
  }

  /** Width of `str` in px at `scale`. */
  measure(str: string, scale = 1, spacing = 0, fontId?: string): number {
    const f = fontId ? this.atlas.font(fontId) : this.font;
    let w = 0;
    const n = str.length;
    for (let i = 0; i < n; i++) {
      const c = str.charCodeAt(i);
      w += (c < 256 && f.handle[c] >= 0 ? f.advance[c] : f.spaceAdvance) + spacing;
    }
    // last glyph: replace advance with its full cell width (outline)
    if (n > 0) {
      const c = str.charCodeAt(n - 1);
      if (c < 256 && f.handle[c] >= 0) w += f.width[c] - f.advance[c] - spacing;
    }
    return w * scale;
  }

  /** Positional fast path (no wobble/rotation). */
  drawFast(layer: number, str: string, x: number, y: number, scale = 1, color = 0xffffff, alpha = 1, alignN = 0, flags = 0, flash = 0, fontId?: string): void {
    const f = fontId ? this.atlas.font(fontId) : this.font;
    let pen = x;
    if (alignN !== 0) {
      const w = this.measure(str, scale, 0, fontId);
      pen = alignN === 1 ? x - w / 2 : x - w;
    }
    pen = Math.round(pen);
    const yy = Math.round(y);
    const n = str.length;
    for (let i = 0; i < n; i++) {
      const c = str.charCodeAt(i);
      const h = c < 256 ? f.handle[c] : -1;
      if (h >= 0) {
        if (c !== 32) this.batch.drawP(layer, h, pen, yy, scale, scale, 0, color, alpha, flash, flags, 0, 0);
        pen += f.advance[c] * scale;
      } else pen += f.spaceAdvance * scale;
    }
  }

  /** Draw char codes from a typed array (allocation-free numbers). */
  drawCodes(layer: number, codes: ArrayLike<number>, n: number, x: number, y: number, scale: number, color: number, alpha: number, flags: number, flash: number, wobble = 0, wobbleT = 0, rot = 0): number {
    const f = this.font;
    let w = 0;
    for (let i = 0; i < n; i++) {
      const c = codes[i];
      w += c < 256 && f.handle[c] >= 0 ? f.advance[c] : f.spaceAdvance;
    }
    if (n > 0) {
      const c = codes[n - 1];
      if (c < 256 && f.handle[c] >= 0) w += f.width[c] - f.advance[c];
    }
    w *= scale;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    // centre anchor: (x, y) is the centre of the string box
    let pen = -w / 2;
    const top = (-f.h * scale) / 2;
    for (let i = 0; i < n; i++) {
      const c = codes[i];
      const h = c < 256 ? f.handle[c] : -1;
      if (h >= 0) {
        const dy = wobble ? Math.sin(wobbleT * 14 + i * 0.9) * wobble : 0;
        const lx = pen;
        const ly = top + dy;
        if (rot !== 0) this.batch.drawP(layer, h, x + lx * cos - ly * sin, y + lx * sin + ly * cos, scale, scale, rot, color, alpha, flash, flags, 0, 0);
        else this.batch.drawP(layer, h, Math.round(x + lx), Math.round(y + ly), scale, scale, 0, color, alpha, flash, flags, 0, 0);
        pen += f.advance[c] * scale;
      } else pen += f.spaceAdvance * scale;
    }
    return w;
  }

  /** Draw a string with options. Returns the width drawn. */
  draw(str: string, x: number, y: number, o: TextOpts = {}): number {
    const f = o.font ? this.atlas.font(o.font) : this.font;
    const scale = o.scale ?? 1;
    const spacing = o.spacing ?? 0;
    const layer = o.layer ?? Layer.Text;
    const w = this.measure(str, scale, spacing, o.font);
    const align = o.align ?? "left";
    let ax = align === "center" ? w / 2 : align === "right" ? w : 0;
    const hpx = f.h * scale;
    const ay = o.valign === "middle" ? hpx / 2 : o.valign === "bottom" ? hpx : 0;
    const rot = o.rotation ?? 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const t = o.time ?? this.time;
    const wob = o.wobble ?? 0;
    const ws = o.wobbleSpeed ?? 9;
    const wp = o.wobblePhase ?? 0.75;
    let flags = 0;
    if (o.glow) flags |= Flag.Glow;
    if (o.additive) flags |= Flag.Add;
    const alpha = o.alpha ?? 1;
    const color = o.color ?? 0xffffff;
    const flash = o.flash ?? 0;
    let pen = 0;
    if (rot === 0) {
      x = Math.round(x - ax);
      y = Math.round(y - ay);
      ax = 0;
    }
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      const h = c < 256 ? f.handle[c] : -1;
      if (h < 0) {
        pen += (f.spaceAdvance + spacing) * scale;
        continue;
      }
      if (c !== 32) {
        const dy = wob ? Math.round(Math.sin(t * ws + i * wp) * wob) : 0;
        const col = o.rainbow ? hsv(t * 0.6 + i * 0.08, 0.5, 1) : color;
        if (rot === 0) {
          this.batch.drawP(layer, h, x + pen, y + dy * scale, scale, scale, 0, col, alpha, flash, flags, 0, 0);
        } else {
          const lx = pen - ax;
          const ly = -ay + dy * scale;
          this.batch.drawP(layer, h, x + lx * cos - ly * sin, y + lx * sin + ly * cos, scale, scale, rot, col, alpha, flash, flags, 0, 0);
        }
      }
      pen += (f.advance[c] + spacing) * scale;
    }
    return w;
  }
}
