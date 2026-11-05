/**
 * Truck-kun - ISEKAI EXPRESS (docs/content/heroes.md §2.11, 4.0 s):
 *   0.0 s  HONK (sfx `honk`) and a white flash (view; respects Reduce flashing).
 *   Four lanes, each telegraphed 0.4 s (telegraphLine, half width 14, 0xffe14d), then a ghostly
 *   Truck-kun (`truck_kun_run` x2, tint 0xbafff6, alpha 0.7, speed lines: drawn by the view) drives
 *   across the whole view at 520 px/s: 0.4 s top quarter (left -> right), 1.2 s bottom quarter
 *   (right -> left), 2.0 s middle (left -> right), 2.8 s the "express lane": straight through the
 *   densest cluster, aimed from the nearest view edge.
 *   Everything in a lane: 420 damage, knockback 350 along the lane. Non-boss enemies killed by the
 *   ult are isekai'd (a light pillar, +1 extra gem: weapons/_hb.ts installIsekai).
 *
 * C4: +1 lane. Unlimited Mileage (talent capstone): two more random lanes at
 * 3.2 / 3.6 s (4.6 s long) and +1 Overdrive per isekai'd enemy (paid when the
 * ult ends: the meter can't fill during it). Afterlife Customer Loyalty (talent
 * capstone): the express lane drops off 3 tiny Truck-kuns (`en_mini_truck`,
 * friendly tint) that patrol for 10 s ramming enemies (60 damage, 0.5 s per enemy).
 */
import { C } from "../../art/palette";
import { CFG, CH_ULT } from "../config";
import { PK_FREE, ROT_FIXED, SHAPE_ELLIPSE, type ProjHook, type UltimateDef } from "../types";
import type { World } from "../world";
import { GHOST_TRUCK, HB, densest, hfx, installIsekai } from "../weapons/_hb";

const ID = "isekai_express";
const SPEED = 520;
const HALF = 14;
const TELL = 0.4;
const DMG = 420;
const BASE_LANES = [0.4, 1.2, 2.0, 2.8];
const MAX_LANES = 8;
const DURATION = 4;
const GHOST_TINT = 0xbafff6;
const MINI_TINT = 0xb0d8ff;
const pt = { x: 0, y: 0 };
/** Lane geometry per slot (u.data keys, no allocation per step). */
const KX0 = ["ax0", "ax1", "ax2", "ax3", "ax4", "ax5", "ax6", "ax7"];
const KY0 = ["ay0", "ay1", "ay2", "ay3", "ay4", "ay5", "ay6", "ay7"];
const KX1 = ["bx0", "bx1", "bx2", "bx3", "bx4", "bx5", "bx6", "bx7"];
const KY1 = ["by0", "by1", "by2", "by3", "by4", "by5", "by6", "by7"];
const KT = ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"];

/** Lane drive times for this run (C4 / Unlimited Mileage add lanes). */
function laneTimes(w: World, out: number[]): number {
  out.length = 0;
  for (const t of BASE_LANES) out.push(t);
  if (w.talentRank("truck_unlimited_mileage") > 0) out.push(3.2, 3.6);
  if (w.cons >= 4 && w.hero.id === "truck_kun") out.push(out[out.length - 1] + 0.4);
  return Math.min(MAX_LANES, out.length);
}
const times: number[] = [];

/** Mini Truck-kun patrol: chase the nearest enemy near it, else circle the hero (p.b = circle phase). */
const miniDrive: ProjHook = (p, w, dt) => {
  const e = w.nearestEnemy(p.x, p.y, 150);
  let tx: number;
  let ty: number;
  if (e) {
    tx = e.x;
    ty = e.y - e.cy;
  } else {
    const pl = w.player;
    const a = p.age * 2 + p.b;
    tx = pl.x + Math.cos(a) * 40;
    ty = pl.y - 8 + Math.sin(a) * 28;
  }
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const sp = 125;
  const k = Math.min(1, 6 * dt);
  p.vx += ((dx / d) * sp - p.vx) * k;
  p.vy += ((dy / d) * sp - p.vy) * k;
  if (Math.abs(p.vx) > 4) p.flipX = p.vx < 0;
};

function minis(w: World, x: number, y: number, power: number): void {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p = w.spawnProjectile(null, "truck_loyalty");
    p.ch = CH_ULT;
    p.kind = PK_FREE;
    p.x = x + Math.cos(a) * 8;
    p.y = y + Math.sin(a) * 6;
    p.vx = Math.cos(a) * 80;
    p.vy = Math.sin(a) * 80;
    p.r = 8;
    p.dmg = 60 * w.stats.might * power;
    p.knock = 120;
    p.pierce = Infinity;
    p.hitEvery = 0.5;
    p.life = 10;
    p.b = a;
    p.sprite = "en_mini_truck";
    p.fps = 10;
    p.tint = MINI_TINT;
    p.entity = true;
    p.shadow = 10;
    p.pop = true;
    p.update = miniDrive;
  }
  hfx(w, HB.HONK, x, y, 1, 0, 0, -1);
}

/** Lane i geometry: start (x0, y0) -> end (x1, y1), stored in u.data. */
function planLane(w: World, d: Record<string, number>, i: number): void {
  const p = w.player;
  const hw = w.viewW * 0.5 + 40;
  const hh = w.viewH * 0.5;
  const cy = p.y - 8;
  let x0 = p.x - hw;
  let x1 = p.x + hw;
  let y0 = cy;
  let y1 = cy;
  if (i === 0) y0 = y1 = cy - hh * 0.75;
  else if (i === 1) {
    y0 = y1 = cy + hh * 0.75;
    x0 = p.x + hw;
    x1 = p.x - hw;
  } else if (i === 2) {
    // middle lane, left -> right
  } else if (i === 3) {
    // the express lane: from the view edge nearest the densest cluster, straight through it
    if (densest(w, pt) <= 0) {
      pt.x = p.x;
      pt.y = cy;
    }
    const L = pt.x - (p.x - w.viewW * 0.5);
    const R = p.x + w.viewW * 0.5 - pt.x;
    const T = pt.y - (cy - hh);
    const B = cy + hh - pt.y;
    const m = Math.min(L, R, T, B);
    const vh = hh + 40;
    if (m === L) {
      x0 = p.x - hw;
      x1 = p.x + hw;
      y0 = y1 = pt.y;
    } else if (m === R) {
      x0 = p.x + hw;
      x1 = p.x - hw;
      y0 = y1 = pt.y;
    } else if (m === T) {
      x0 = x1 = pt.x;
      y0 = cy - vh;
      y1 = cy + vh;
    } else {
      x0 = x1 = pt.x;
      y0 = cy + vh;
      y1 = cy - vh;
    }
    d.ex = pt.x;
    d.ey = pt.y;
  } else {
    // random lanes (Unlimited Mileage / C4): horizontal or vertical, either way
    if (w.rng.next() < 0.5) {
      const y = cy + (w.rng.next() * 2 - 1) * hh * 0.8;
      y0 = y1 = y;
      if (w.rng.next() < 0.5) {
        x0 = p.x + hw;
        x1 = p.x - hw;
      }
    } else {
      const x = p.x + (w.rng.next() * 2 - 1) * w.viewW * 0.4;
      x0 = x1 = x;
      const up = w.rng.next() < 0.5;
      y0 = up ? cy + hh + 40 : cy - hh - 40;
      y1 = up ? cy - hh - 40 : cy + hh + 40;
    }
  }
  d[KX0[i]] = x0;
  d[KY0[i]] = y0;
  d[KX1[i]] = x1;
  d[KY1[i]] = y1;
}

function drive(w: World, d: Record<string, number>, i: number, power: number): void {
  const x0 = d[KX0[i]];
  const y0 = d[KY0[i]];
  const dx = d[KX1[i]] - x0;
  const dy = d[KY1[i]] - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const p = w.spawnProjectile(null, ID);
  p.ch = CH_ULT;
  p.kind = PK_FREE;
  p.x = x0;
  p.y = y0;
  p.speed = SPEED;
  p.vx = ux * SPEED;
  p.vy = uy * SPEED;
  p.shape = SHAPE_ELLIPSE;
  p.ang = Math.atan2(uy, ux);
  p.hw = 26;
  p.hh = HALF;
  p.r = 26;
  p.dmg = DMG * w.stats.might * power;
  p.knock = 350;
  p.pierce = Infinity;
  p.hitEvery = 0.35;
  p.life = len / SPEED;
  p.scale = 2;
  p.tint = GHOST_TINT;
  p.alpha = 0.7;
  p.rotMode = ROT_FIXED;
  p.flipX = ux < -0.01;
  p.update = GHOST_TRUCK;
  hfx(w, HB.LANE, x0, y0, d[KX1[i]], d[KY1[i]], HALF, i === 3 ? 1 : 0);
  // Afterlife Customer Loyalty: the express lane drops 3 mini Truck-kuns where it meets the crowd
  if (i === 3 && w.talentRank("truck_loyalty") > 0) {
    const ex = d.ex - x0;
    const ey = d.ey - y0;
    d.drop = d.t0g + Math.max(0, (ex * ux + ey * uy) / SPEED);
  }
}

export const isekaiExpress: UltimateDef = {
  id: ID,
  name: "ISEKAI EXPRESS",
  hero: "truck_kun",
  desc: "HONK HONK. Ghost trucks drive four lanes across the screen; whatever they flatten is sent to another world.",
  duration: DURATION,
  start(w, u) {
    const st = installIsekai(w);
    st.byUlt = 0;
    const d = u.data;
    d.n = laneTimes(w, times);
    for (let i = 0; i < d.n; i++) d[KT[i]] = times[i];
    d.len = w.talentRank("truck_unlimited_mileage") > 0 ? 4.6 : 4;
    if (w.cons >= 4 && w.hero.id === "truck_kun") d.len += 0.4;
    // (this cast's length: Unlimited Mileage 4.6 s, C4 +0.4 s for its extra lane)
    u.dur = d.len;
    d.tell = 0;
    d.go = 0;
    d.drop = -1;
    d.t0g = 0;
    const p = w.player;
    hfx(w, HB.EXPRESS, p.x, p.y - CFG.playerCy);
  },
  update(w, u) {
    const d = u.data;
    while (d.tell < d.n && u.t >= d[KT[d.tell]] - TELL) {
      const i = d.tell;
      planLane(w, d, i);
      const life = Math.max(0.05, d[KT[i]] - u.t);
      w.telegraphLine(d[KX0[i]], d[KY0[i]], d[KX1[i]], d[KY1[i]], HALF, life, 0xffe14d);
      hfx(w, HB.LANE_TELL, d[KX0[i]], d[KY0[i]], d[KX1[i]], d[KY1[i]], life, i === 3 ? 1 : 0);
      d.tell++;
    }
    while (d.go < d.tell && u.t >= d[KT[d.go]]) {
      d.t0g = u.t;
      drive(w, d, d.go, u.power);
      d.go++;
    }
    if (d.drop >= 0 && u.t >= d.drop) {
      d.drop = -1;
      minis(w, d.ex, d.ey, u.power);
    }
  },
  end(w) {
    // Unlimited Mileage: +1 Overdrive per isekai'd enemy (after the ult: the meter is locked during it)
    if (w.talentRank("truck_unlimited_mileage") <= 0) return;
    const st = installIsekai(w);
    const n = st.byUlt;
    st.byUlt = 0;
    if (n > 0) w.after(0, (ww) => ww.addUlt(n));
  },
};

export const ultimates: UltimateDef[] = [isekaiExpress];
