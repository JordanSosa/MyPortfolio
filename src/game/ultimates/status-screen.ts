/**
 * Isekai-kun - STATUS SCREEN!! (docs/content/heroes.md §2.10, 3.6 s): a huge
 * translucent status window (`ult_status_window`, view-width) slams down three
 * times, in three horizontal bands of the view (top third, bottom third, middle
 * third, in that order). Each band: a 0.4 s blue outline telegraph (4
 * telegraphLines, 0x5aa8ff), then the slam (scale 1.2 -> 1, shake 0.4): 380
 * damage to every enemy in the band (the view shows "9999999" instead of the
 * real numbers there). Slams at 0.6 / 1.4 / 2.2 s; at 3.0 s, over Isekai-kun:
 * "...did I overdo it again?".
 *
 * C4: +1 slam. Status Screen: Expanded (talent capstone): 5 slams (top, bottom,
 * middle, top half, bottom half) and the fake numbers read 99999999999. Extra
 * slams fit between 0.6 s and 2.2 s.
 */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import type { UltimateDef } from "../types";
import type { World } from "../world";
import { HB, hfx } from "../weapons/_hb";

const ID = "status_screen";
const DMG = 380;
const TELL = 0.4;
const BLUE = 0x5aa8ff;
/** Bands as [from, to] fractions of the view height: top, bottom, middle third, top half, bottom half, whole. */
const BANDS: readonly (readonly [number, number])[] = [
  [0, 1 / 3],
  [2 / 3, 1],
  [1 / 3, 2 / 3],
  [0, 0.5],
  [0.5, 1],
  [0, 1],
];
const KEYS_Y0 = ["y00", "y01", "y02", "y03", "y04", "y05"];
const KEYS_Y1 = ["y10", "y11", "y12", "y13", "y14", "y15"];
const KEYS_X = ["x0", "x1", "x2", "x3", "x4", "x5"];

/** Slams this run: 3, C4 +1, Expanded = 5 (+1 with C4: the whole view). */
function slamCount(w: World): number {
  const exp = w.talentRank("isekai_status_expanded") > 0;
  const c4 = w.cons >= 4 && w.hero.id === "isekai_kun" ? 1 : 0;
  return Math.min(BANDS.length, (exp ? 5 : 3) + c4);
}

/** Slam i lands at this ult time (evenly from 0.6 s to 2.2 s). */
function slamAt(i: number, n: number): number {
  return n <= 1 ? 0.6 : 0.6 + (1.6 * i) / (n - 1);
}

export const statusScreen: UltimateDef = {
  id: ID,
  name: "STATUS SCREEN!!",
  hero: "isekai_kun",
  desc: "A giant status window slams down on three bands of the screen for absurd damage. He didn't mean to.",
  duration: 3.6,
  start(w, u) {
    u.data.n = slamCount(w);
    u.data.tell = 0;
    u.data.slam = 0;
    u.data.again = 0;
    u.data.exp = w.talentRank("isekai_status_expanded") > 0 ? 1 : 0;
  },
  update(w, u) {
    const d = u.data;
    const n = d.n;
    const p = w.player;
    // telegraph each band 0.4 s ahead (the geometry is fixed in the world from here on)
    while (d.tell < n && u.t >= slamAt(d.tell, n) - TELL) {
      const i = d.tell;
      const band = BANDS[i];
      const top = p.y - 8 - w.viewH * 0.5;
      const y0 = top + band[0] * w.viewH;
      const y1 = top + band[1] * w.viewH;
      const hw = w.viewW * 0.5 - 3;
      d[KEYS_Y0[i]] = y0;
      d[KEYS_Y1[i]] = y1;
      d[KEYS_X[i]] = p.x;
      const x0 = p.x - hw;
      const x1 = p.x + hw;
      const life = Math.max(0.05, slamAt(i, n) - u.t);
      w.telegraphLine(x0, y0 + 2, x1, y0 + 2, 1.5, life, BLUE);
      w.telegraphLine(x0, y1 - 2, x1, y1 - 2, 1.5, life, BLUE);
      w.telegraphLine(x0 + 2, y0, x0 + 2, y1, 1.5, life, BLUE);
      w.telegraphLine(x1 - 2, y0, x1 - 2, y1, 1.5, life, BLUE);
      hfx(w, HB.SLAM_TELL, p.x, (y0 + y1) * 0.5, hw, (y1 - y0) * 0.5, life, i);
      d.tell++;
    }
    while (d.slam < d.tell && u.t >= slamAt(d.slam, n)) {
      const i = d.slam;
      const y0 = d[KEYS_Y0[i]];
      const y1 = d[KEYS_Y1[i]];
      const cx = d[KEYS_X[i]];
      const hw = w.viewW * 0.5 + 8;
      const dmg = DMG * w.stats.might * u.power;
      const items = w.enemies.items;
      for (let k = 0; k < w.enemies.count; k++) {
        const e = items[k];
        if (e.dead || e.def.prop) continue;
        const ey = e.y - e.cy;
        if (Math.abs(e.x - cx) > hw || ey < y0 - e.r * 0.5 || ey > y1 + e.r * 0.5) continue;
        e.lastHit[CH_ULT] = w.t;
        w.hitEnemy(e, dmg, null, Math.PI / 2, 140, 0, ID, C.blue);
      }
      hfx(w, HB.SLAM, cx, (y0 + y1) * 0.5, w.viewW * 0.5, (y1 - y0) * 0.5, 0, d.exp ? 1 : 0);
      d.slam++;
    }
    if (!d.again && u.t >= 3) {
      d.again = 1;
      hfx(w, HB.AGAIN, p.x, p.y - 26);
    }
  },
};

export const ultimates: UltimateDef[] = [statusScreen];
