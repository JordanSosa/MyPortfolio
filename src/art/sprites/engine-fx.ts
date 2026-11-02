/**
 * Extra procedural utility sprites (owner: engine). Not in the manifest - free
 * helpers for FX/gameplay code. All white so they can be tinted.
 *
 *   fx_soft_circle  32x32  filled disc with a soft 3px edge (telegraph zones, auras, dimmers)
 *   fx_flare        16x16  anime 4-point star flare with a hot core (crit shine, pickups, twinkles)
 *   fx_beam         8x32   vertical light beam: bright centre column, fades to the top (pillars, chest light)
 *   fx_ring_soft    64x64  soft glowing ring (big shockwave rings that stay smooth when scaled)
 *   fx_dot          1x1    single white pixel (1px particles/lines)
 */
import type { ProcSprite } from "../format";

const softCircle: ProcSprite = {
  id: "fx_soft_circle",
  w: 32,
  h: 32,
  frames: 1,
  paint(_f, set, w, h) {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const R = w / 2 - 0.5;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > R) continue;
        const e = Math.min(1, (R - d) / 3);
        set(x, y, 255, 255, 255, Math.round(255 * e * e * (3 - 2 * e)));
      }
  },
};

const flare: ProcSprite = {
  id: "fx_flare",
  w: 16,
  h: 16,
  frames: 1,
  paint(_f, set, w, h) {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        // thin cross arms that taper + round core
        const arm = Math.max(Math.max(0, 1 - dx / 7.5) * Math.max(0, 1 - dy / 1.1), Math.max(0, 1 - dy / 7.5) * Math.max(0, 1 - dx / 1.1));
        const core = Math.max(0, 1 - Math.hypot(dx, dy) / 3.2);
        const a = Math.min(1, arm * 1.15 + core * core * 1.4);
        if (a > 0.04) set(x, y, 255, 255, 255, Math.round(a * 255));
      }
  },
};

const beam: ProcSprite = {
  id: "fx_beam",
  w: 8,
  h: 32,
  frames: 1,
  paint(_f, set, w, h) {
    const cx = (w - 1) / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const across = Math.max(0, 1 - Math.abs(x - cx) / (w / 2));
        const up = y / (h - 1); // 0 top .. 1 bottom
        const a = Math.pow(across, 1.6) * Math.pow(up, 0.7);
        if (a > 0.02) set(x, y, 255, 255, 255, Math.round(a * 255));
      }
  },
};

const ringSoft: ProcSprite = {
  id: "fx_ring_soft",
  w: 64,
  h: 64,
  frames: 1,
  paint(_f, set, w, h) {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const R = w / 2 - 6;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - cx, y - cy) - R;
        const a = Math.exp(-(d * d) / 8);
        if (a > 0.03) set(x, y, 255, 255, 255, Math.round(a * 255));
      }
  },
};

const dot: ProcSprite = {
  id: "fx_dot",
  w: 1,
  h: 1,
  frames: 1,
  ox: 0.5,
  oy: 0.5,
  paint(_f, set) {
    set(0, 0, 255, 255, 255, 255);
  },
};

export const sprites: ProcSprite[] = [softCircle, flare, beam, ringSoft, dot];
