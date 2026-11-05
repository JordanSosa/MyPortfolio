/**
 * Transient bitmap-font texts in the world ("LEVEL UP!", "MAGNET!",
 * "FREEZE!") with a bouncy pop-in, wobble, optional rainbow, rise and fade.
 * Anchors: world point, follow the player, or screen-centre relative.
 * Texts that follow the player stack upward (14 px per live one) instead of
 * printing over each other, and `covers()` lets the feedback bridge keep
 * damage numbers out of their box.
 */
import { easeOutBack } from "../core/math";
import { Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";

export interface WorldTextOpts {
  color?: number;
  scale?: number;
  rainbow?: boolean;
  life?: number;
  rise?: number;
  /** 0 = world point, 1 = follows the player (x,y = offset), 2 = screen (x,y = offset from view centre). */
  anchor?: 0 | 1 | 2;
  wobble?: number;
  glow?: boolean;
  delay?: number;
}

/** Vertical step (px) between stacked player-anchored texts. */
const STACK = 14;
/**
 * A player-anchored text's box starts at least this far above her feet (the top of her head + 2 px), pop-in
 * overshoot included: "DON!" at -30 sat on her hair and its glow hid her face for half a second.
 */
const HEAD_CLEAR = 26;

interface T {
  s: string;
  /** Text width at scale 1 (measured once on add). */
  w1: number;
  x: number;
  y: number;
  t: number;
  life: number;
  color: number;
  scale: number;
  rainbow: boolean;
  rise: number;
  anchor: number;
  wobble: number;
  glow: boolean;
  delay: number;
}

export class WorldTexts {
  private list: T[] = [];
  constructor(private readonly r: Renderer) {}

  add(s: string, x: number, y: number, o: WorldTextOpts = {}): void {
    if (this.list.length > 24) this.list.shift();
    const anchor = o.anchor ?? 0;
    const scale = o.scale ?? 2;
    const rise = o.rise ?? 10;
    if (anchor === 1) {
      // never over her head (the pop-in grows a scale-2 text by ~25 %)
      const lh = this.r.text.lineHeight;
      y = Math.min(y, -HEAD_CLEAR - (lh * scale * 1.25) / 2);
      // stack above the player-anchored texts still alive ("BOOM!" + "MAGNET!" in the same second):
      // at least STACK px per live one, and clear of the topmost one's box once it has fully risen
      let k = 0;
      let top = Infinity;
      for (const t of this.list) {
        if (t.anchor !== 1) continue;
        k++;
        top = Math.min(top, t.y - t.rise - (lh * t.scale) / 2);
      }
      if (k > 0) y = Math.min(y - STACK * k, top + rise - 2 - (lh * scale) / 2);
    }
    this.list.push({
      s,
      w1: this.r.text.measure(s, 1),
      x,
      y,
      t: 0,
      life: o.life ?? 1.2,
      color: o.color ?? 0xffffff,
      scale,
      rainbow: !!o.rainbow,
      rise,
      anchor,
      wobble: o.wobble ?? 1,
      glow: o.glow ?? true,
      delay: o.delay ?? 0,
    });
  }

  clear(): void {
    this.list.length = 0;
  }

  /**
   * Is world point (x, y) inside the box of a live player-anchored text (player at
   * px, py)? The feedback bridge skips enemy damage numbers there.
   */
  covers(x: number, y: number, px: number, py: number): boolean {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.anchor !== 1) continue;
      const lt = t.t - t.delay;
      if (lt < 0) continue;
      const k = lt / t.life;
      const cx = px + t.x;
      const cy = py + t.y - t.rise * Math.min(1, k * 1.6);
      const hw = t.w1 * t.scale * 0.5 + 4;
      const hh = 5 * t.scale + 3;
      if (Math.abs(x - cx) < hw && Math.abs(y - cy) < hh) return true;
    }
    return false;
  }

  /** realDt so banners keep animating in hitstop/slow-mo. */
  update(realDt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.t += realDt;
      if (t.t >= t.life + t.delay) this.list.splice(i, 1);
    }
  }

  draw(px: number, py: number): void {
    const r = this.r;
    const v = r.camera.view;
    for (const t of this.list) {
      const lt = t.t - t.delay;
      if (lt < 0) continue;
      const k = lt / t.life;
      const pop = lt < 0.25 ? easeOutBack(lt / 0.25, 2.4) : 1;
      const alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      let x = t.x;
      let y = t.y;
      if (t.anchor === 1) {
        x += px;
        y += py;
      } else if (t.anchor === 2) {
        x += v.x + v.w / 2;
        y += v.y + v.h / 2;
      }
      y -= t.rise * Math.min(1, k * 1.6);
      // integer scales stay crisp; the pop overshoot uses fractional scale briefly.
      // Big banners shrink (by whole steps) to fit narrow portrait views.
      let base = t.scale;
      const w1 = t.w1;
      if (base > 1) while (base > 1 && w1 * base > v.w - 8) base--;
      // (the pop overshoot never pushes it past the view edges either)
      const sc = Math.max(0.2, Math.min(base * pop, w1 > 0 ? (v.w - 8) / w1 : base * pop));
      r.text.draw(t.s, x, y, {
        align: "center",
        valign: "middle",
        scale: lt < 0.25 ? sc : base,
        color: t.color,
        rainbow: t.rainbow,
        wobble: t.wobble,
        alpha,
        glow: t.glow,
        layer: t.anchor === 2 ? Layer.Overlay : Layer.Text,
      });
    }
  }
}
