/** Procedural utility sprites (owner: engine). Soft shapes that are not hand-pixelled. */
import type { ProcSprite } from "../format";

const radial = (id: string, size: number, falloff: number): ProcSprite => ({
  id,
  w: size,
  h: size,
  frames: 1,
  paint(_f, set, w, h) {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const R = w / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - cx, y - cy) / R;
        if (d >= 1) continue;
        const a = Math.pow(1 - d, falloff);
        set(x, y, 255, 255, 255, Math.round(a * 255));
      }
  },
});

const ring = (id: string, size: number, thick: number, soft: boolean): ProcSprite => ({
  id,
  w: size,
  h: size,
  frames: 1,
  paint(_f, set, w, h) {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const R = w / 2 - 0.5;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - cx, y - cy);
        const inner = R - thick;
        if (d > R + 0.01) continue;
        if (d >= inner) set(x, y, 255, 255, 255, 255);
        else if (soft && d >= inner - 4) set(x, y, 255, 255, 255, Math.round(((d - (inner - 4)) / 4) * 120));
      }
  },
});

export const sprites: ProcSprite[] = [
  {
    id: "fx_px",
    w: 2,
    h: 2,
    frames: 1,
    paint(_f, set) {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) set(x, y, 255, 255, 255, 255);
    },
  },
  radial("fx_glow", 32, 1.6),
  radial("fx_glow_s", 16, 1.4),
  {
    id: "fx_shadow",
    w: 16,
    h: 6,
    frames: 1,
    paint(_f, set, w, h) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
          if (d < 1) set(x, y, 45, 27, 69, d < 0.7 ? 110 : 70);
        }
    },
  },
  ring("fx_ring", 32, 1, false),
  ring("fx_ring_thick", 32, 3, true),
  {
    id: "fx_circle",
    w: 32,
    h: 32,
    frames: 1,
    paint(_f, set, w, h) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) if (Math.hypot(x - cx, y - cy) <= w / 2 - 0.5) set(x, y, 255, 255, 255, 255);
    },
  },
  {
    id: "fx_streak",
    w: 16,
    h: 4,
    frames: 1,
    paint(_f, set, w, h) {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const edge = y === 0 || y === h - 1 ? 0.45 : 1;
          set(x, y, 255, 255, 255, Math.round((x / (w - 1)) * 255 * edge));
        }
    },
  },
];
