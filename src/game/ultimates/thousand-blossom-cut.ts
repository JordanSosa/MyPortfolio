/**
 * Rin - Thousand Blossom Cut: the world freezes, 12 slash lines carve the
 * screen, then every on-screen enemy is hit for massive damage in a petal explosion.
 */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import type { UltimateDef } from "../types";

const SLASHES = 12;
const SLASH_EVERY = 0.11;
const BURST_AT = SLASHES * SLASH_EVERY + 0.35;

export const thousandBlossomCut: UltimateDef = {
  id: "thousand_blossom_cut",
  name: "Thousand Blossom Cut",
  hero: "rin",
  desc: "Time stops, 12 slashes carve the screen, then everything bursts into petals.",
  duration: BURST_AT + 0.7,
  start(w, u) {
    w.timeStop = true;
    u.data.i = 0;
    u.data.burst = 0;
  },
  update(w, u) {
    const d = u.data;
    const pl = w.player;
    while (d.i < SLASHES && u.t >= d.i * SLASH_EVERY) {
      // a long line through a point near the screen centre at a random steep angle
      const a = (d.i % 2 ? 0.35 : -0.35) * Math.PI + w.rng.spread(0.5);
      const cx = pl.x + (w.rng.next() - 0.5) * w.viewW * 0.7;
      const cy = pl.y - 8 + (w.rng.next() - 0.5) * w.viewH * 0.6;
      const L = Math.max(w.viewW, w.viewH) * 0.85;
      const dx = Math.cos(a) * L;
      const dy = Math.sin(a) * L;
      w.emit("ultSlash", { x0: cx - dx, y0: cy - dy, x1: cx + dx, y1: cy + dy, i: d.i });
      d.i++;
    }
    if (!d.burst && u.t >= BURST_AT) {
      d.burst = 1;
      w.timeStop = false;
      w.emit("ultBurst", { x: pl.x, y: pl.y - 8, w: w.viewW, h: w.viewH });
      w.hitAllInView(260 * w.stats.might * u.power, 520 * u.power, 220, "thousand_blossom_cut", C.pink, CH_ULT);
    }
  },
  end(w) {
    w.timeStop = false;
  },
};

export const ultimates: UltimateDef[] = [thousandBlossomCut];
