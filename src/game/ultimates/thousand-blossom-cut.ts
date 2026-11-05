/**
 * Rin - Thousand Blossom Cut: the world freezes, 12 slash lines carve the
 * screen, then every on-screen enemy is hit for massive damage in a petal explosion.
 *
 * Season 2 (docs/content/heroes.md): Ten Thousand Blossoms (talent capstone)
 * = 24 slash lines (carved twice as fast, same timing) and the burst hits a
 * second time at 50%; C4 = +4 slash lines and +20% damage.
 */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import type { UltimateDef } from "../types";

const SLASHES = 12;
const SLASH_EVERY = 0.11;
const BURST_AT = SLASHES * SLASH_EVERY + 0.35;
/** Ten Thousand Blossoms: the second burst lands this long after the first. */
const ECHO_AFTER = 0.25;

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
    const tenK = w.talentRank("rin_ten_thousand") > 0;
    const c4 = w.cons >= 4 && w.hero.id === "rin";
    const n = SLASHES + (tenK ? 12 : 0) + (c4 ? 4 : 0);
    u.data.n = n;
    // (more lines carve faster: the burst always lands at BURST_AT)
    u.data.every = n === SLASHES ? SLASH_EVERY : (SLASHES * SLASH_EVERY) / n;
    u.data.dmgK = c4 ? 1.2 : 1;
    u.data.echo = tenK ? 1 : 0;
  },
  update(w, u) {
    const d = u.data;
    const pl = w.player;
    while (d.i < d.n && u.t >= d.i * d.every) {
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
      w.hitAllInView(260 * w.stats.might * u.power * d.dmgK, 520 * u.power * d.dmgK, 220, "thousand_blossom_cut", C.pink, CH_ULT);
    }
    // Ten Thousand Blossoms: the burst hits twice (the second at 50%)
    if (d.echo === 1 && u.t >= BURST_AT + ECHO_AFTER) {
      d.echo = 2;
      w.emit("ultBurst", { x: pl.x, y: pl.y - 8, w: w.viewW, h: w.viewH });
      w.hitAllInView(130 * w.stats.might * u.power * d.dmgK, 260 * u.power * d.dmgK, 160, "thousand_blossom_cut", C.pinkLight, CH_ULT);
    }
  },
  end(w) {
    w.timeStop = false;
  },
};

export const ultimates: UltimateDef[] = [thousandBlossomCut];
