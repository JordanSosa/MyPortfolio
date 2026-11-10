/**
 * Aoi - GET IN THE ROBOT!! (docs/content/heroes.md §2.6).
 * Three giant robot fists fall from the sky onto the densest enemy clusters in
 * view (grid 48 px, most enemies first, a boss counts as 10), one per second:
 * a blue telegraph circle (r 60, 0.6 s), then the fist (open hand -> fist)
 * drops from 220 px at 600 px/s with a growing shadow; impact r 64, 260
 * damage, knockback 300, shake, shockwave, debris. At 3.1 s ROCKET PUNCH: the
 * fist flies across the whole view through Aoi's row (a 40 px lane,
 * telegraphed 0.25 s): 200 damage to everything in the lane, pierce ∞.
 *
 * C4 = +1 fist; Super Robot Upgrade (talent capstone) = 5 fists and the
 * rocket punch comes back like a boomerang. More fists fall faster (the
 * rocket punch keeps its 3.1 s beat). Combining Sequence (talent) is a buff
 * installed by talents/aoi.ts on this ult's end.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import { PK_FALL, PK_FREE, SHAPE_ELLIPSE, type ProjHook, type UltimateDef } from "../types";
import type { World } from "../world";
import { HFX_AOI_FIST, HFX_AOI_IMPACT, HFX_AOI_ROCKET, hfx } from "../weapons/_heroes-a";

const ID = "get_in_the_robot";
const CELL = 48;
const GRID = 24;
const TELE = 0.6;
const TELE_R = 60;
const FALL_H = 220;
const FALL_SPEED = 600;
/** The fist starts falling this long after its telegraph appears (impact at +0.9 s). */
const FALL_AT = 0.9 - FALL_H / FALL_SPEED;
const BLAST = 64;
const FIST_DMG = 260;
const ROCKET_AT = 3.1;
const ROCKET_TELE = 0.25;
const ROCKET_DMG = 200;
const LANE = 20;
const ROCKET_SPEED = 640;
const BLUE = 0x5aa8ff;

const cnt = new Float64Array(GRID * GRID);
const sx = new Float64Array(GRID * GRID);
const sy = new Float64Array(GRID * GRID);
const out = { x: 0, y: 0 };
/** u.data keys of the drop points (no string building per frame). */
const PX = ["px0", "px1", "px2", "px3", "px4", "px5", "px6", "px7"];
const PY = ["py0", "py1", "py2", "py3", "py4", "py5", "py6", "py7"];

/**
 * Densest 48 px cell in view (a boss counts 10), skipping cells within 70 px of earlier drops
 * (d.px0..pyN). Writes its enemies' centroid to `out`; false when the view is empty.
 */
function densest(w: World, d: Record<string, number>, drops: number): boolean {
  const p = w.player;
  const x0 = p.x - w.viewW * 0.5;
  const y0 = p.y - w.viewH * 0.5;
  const nx = Math.min(GRID, Math.ceil(w.viewW / CELL));
  const ny = Math.min(GRID, Math.ceil(w.viewH / CELL));
  cnt.fill(0, 0, GRID * GRID);
  sx.fill(0, 0, GRID * GRID);
  sy.fill(0, 0, GRID * GRID);
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i];
    if (e.dead || e.def.prop) continue;
    const cx = Math.floor((e.x - x0) / CELL);
    const cy = Math.floor((e.y - y0) / CELL);
    if (cx < 0 || cy < 0 || cx >= nx || cy >= ny) continue;
    const k = cy * GRID + cx;
    const wgt = e.def.boss ? 10 : 1;
    cnt[k] += wgt;
    sx[k] += e.x * wgt;
    sy[k] += e.y * wgt;
  }
  let best = -1;
  let bc = 0;
  for (let k = 0; k < GRID * GRID; k++) {
    if (cnt[k] <= bc) continue;
    const mx = sx[k] / cnt[k];
    const my = sy[k] / cnt[k];
    let near = false;
    for (let j = 0; j < drops && !near; j++) {
      const dx = mx - d[PX[j]];
      const dy = my - d[PY[j]];
      near = dx * dx + dy * dy < 70 * 70;
    }
    if (near) continue;
    bc = cnt[k];
    best = k;
  }
  if (best < 0) return false;
  out.x = sx[best] / cnt[best];
  out.y = sy[best] / cnt[best];
  return true;
}

/** A fist lands: big blast (p.dmg), the impact cue. */
const fistLand: ProjHook = (p, w) => {
  w.explode(p.x, p.y - 6, BLAST, p.dmg, null, 300, ID, C.blue, true);
  hfx(w, HFX_AOI_IMPACT, p.x, p.y, p.x, p.y, BLAST);
};

/** ROCKET PUNCH flight: p.a = direction, p.b = 1 boomerang (comes back once past the far edge). */
const rocketHook: ProjHook = (p, w) => {
  const pl = w.player;
  p.y = pl.y - CFG.playerCy;
  const edge = pl.x + p.a * (w.viewW * 0.5 + 40);
  if (p.b === 1 && (p.a > 0 ? p.x >= edge : p.x <= edge)) {
    p.b = 2;
    p.a = -p.a;
    p.vx = -p.vx;
    p.flipX = !p.flipX;
    // a fresh pass: everything in the lane can be hit again
    p.nHits = 0;
    p.life = p.age + (w.viewW + 120) / ROCKET_SPEED;
    hfx(w, HFX_AOI_ROCKET, p.x, p.y, p.a, LANE, LANE, 1);
  }
};

export const getInTheRobot: UltimateDef = {
  id: ID,
  name: "GET IN THE ROBOT!!",
  hero: "aoi",
  desc: "Three giant robot fists fall on the densest crowds, then a ROCKET PUNCH flies through Aoi's row.",
  duration: 3.6,
  start(w, u) {
    const sup = w.talentRank("aoi_super_robot") > 0;
    const fists = Math.min(PX.length, (sup ? 5 : 3) + (w.cons >= 4 && w.hero.id === "aoi" ? 1 : 0));
    const d = u.data;
    d.fists = fists;
    // 3 fists 1 s apart; more fists fall faster so the last one still lands before the rocket punch
    d.every = fists <= 3 ? 1 : 2 / (fists - 1);
    d.tele = 0;
    d.fell = 0;
    d.rocketTele = 0;
    d.rocket = 0;
    d.boomerang = sup ? 1 : 0;
    d.dir = w.player.face >= 0 ? 1 : -1;
    u.dur = sup ? ROCKET_AT + (2 * (w.viewW + 80)) / ROCKET_SPEED + 0.3 : 3.6;
  },
  update(w, u) {
    const d = u.data;
    const pl = w.player;
    // telegraphs on the densest clusters, each fist 0.9 s after its circle appears
    while (d.tele < d.fists && u.t >= d.tele * d.every) {
      const i = d.tele++;
      if (!densest(w, d, i)) {
        // nothing to punch: it still lands near Aoi (the robot doesn't do subtle)
        out.x = pl.x + w.rng.spread(w.viewW * 0.3);
        out.y = pl.y + w.rng.spread(w.viewH * 0.25);
      }
      d[PX[i]] = out.x;
      d[PY[i]] = out.y;
      w.telegraphCircle(out.x, out.y, TELE_R, TELE, BLUE);
    }
    while (d.fell < d.tele && u.t >= d.fell * d.every + FALL_AT) {
      const i = d.fell++;
      const x = d[PX[i]];
      const y = d[PY[i]];
      const p = w.spawnProjectile(null, ID);
      p.kind = PK_FALL;
      p.x = x;
      p.y = y;
      p.z = FALL_H;
      p.vz = -FALL_SPEED;
      p.r = 0;
      // play-once over 0.55 s: the open hand clenches into a fist 0.275 s into the fall
      p.life = 0.55;
      p.anim = 1;
      p.dmg = FIST_DMG * w.stats.might * u.power;
      p.sprite = "ult_robot_fist";
      p.scale = 1.5;
      p.shadow = 30;
      p.onEnd = fistLand;
      hfx(w, HFX_AOI_FIST, x, y, x, y, BLAST, i);
    }
    // ROCKET PUNCH through Aoi's row
    const y = pl.y - CFG.playerCy;
    const hw = w.viewW * 0.5 + 40;
    if (!d.rocketTele && u.t >= ROCKET_AT - ROCKET_TELE) {
      d.rocketTele = 1;
      w.telegraphLine(pl.x - hw, y, pl.x + hw, y, LANE, ROCKET_TELE, BLUE);
    }
    if (!d.rocket && u.t >= ROCKET_AT) {
      d.rocket = 1;
      const dir = d.dir;
      const p = w.spawnProjectile(null, ID);
      p.kind = PK_FREE;
      p.x = pl.x - dir * hw;
      p.y = y;
      p.vx = dir * ROCKET_SPEED;
      p.vy = 0;
      p.speed = ROCKET_SPEED;
      p.shape = SHAPE_ELLIPSE;
      p.r = 1;
      p.hw = 26;
      p.hh = LANE;
      p.dmg = ROCKET_DMG * w.stats.might * u.power;
      p.knock = 260;
      p.pierce = Infinity;
      p.life = (hw * 2 + 40) / ROCKET_SPEED;
      // (no sprite: the view draws the clenched fist + its motion blur, src/view/heroes-a-fx.ts)
      p.flipX = dir < 0;
      p.a = dir;
      p.b = d.boomerang;
      p.update = rocketHook;
      hfx(w, HFX_AOI_ROCKET, p.x, y, dir, LANE, LANE, 0);
    }
  },
};

export const ultimates: UltimateDef[] = [getInTheRobot];
