/**
 * Transient bitmap-font texts in the world ("LEVEL UP!", "EVOLUTION!",
 * "FREEZE!") with a bouncy pop-in, wobble, optional rainbow, rise and fade.
 * Anchors: world point, follow the player, or screen-centre relative.
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

interface T {
  s: string;
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
    this.list.push({
      s,
      x,
      y,
      t: 0,
      life: o.life ?? 1.2,
      color: o.color ?? 0xffffff,
      scale: o.scale ?? 2,
      rainbow: !!o.rainbow,
      rise: o.rise ?? 10,
      anchor: o.anchor ?? 0,
      wobble: o.wobble ?? 1,
      glow: o.glow ?? true,
      delay: o.delay ?? 0,
    });
  }

  clear(): void {
    this.list.length = 0;
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
      if (base > 1) {
        const w1 = r.text.measure(t.s, 1);
        while (base > 1 && w1 * base > v.w - 8) base--;
      }
      const sc = Math.max(0.2, base * pop);
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
