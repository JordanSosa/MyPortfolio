/**
 * Mochi - Nyan Stampede: 60 big cats gallop across the screen in 5 alternating
 * waves, each wave a tight wall of two staggered rows, trampling (damage + big
 * knockback). Cats are drawn at 2x in warm creams / peaches / pale yellows only
 * (never the enemy pastels), glowing, so the stampede can't be mistaken for a horde.
 *
 * Season 2 (docs/content/heroes.md): Cat Army (talent capstone) = 90 cats and
 * trampled enemies have a 10% chance to drop a coin; Catnip Overdrive (talent
 * capstone) = two extra walls running top->bottom and bottom->top, and every
 * gem in view flies to Mochi; C4 = +20 cats.
 */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import { PK_FREE, type ProjHitHook, type UltimateDef } from "../types";
import type { World } from "../world";

const WAVES = 5;
const ROWS = 2;
const WAVE_EVERY = 0.6;
/** Horizontal gap between the two rows of a wave (px), the back row offset half a slot vertically. */
const ROW_GAP = 30;
/** Per hit (every 0.22 s per enemy): 5 waves x 42 ~ the old 4 waves x 48, slightly more. */
const CAT_DMG = 42;
/** Warm fur only: cream, peach (skin base), pale yellow, white, light peach. */
const CAT_TINTS = [0xffffff, 0xfff0c9, C.paleYellow, 0xffd6c4, 0xfff1ea, 0xffe3b8];

/** Cat Army: a trampled enemy has a 10% chance to drop a coin. */
const catArmyHit: ProjHitHook = (_p, w, e) => {
  if (!e.dead && !e.def.prop && w.rng.next() < 0.1) w.dropPickup("coin", e.x, e.y, 1);
};

/** One cat of a wall running along (dx, dy) (unit, axis-aligned). */
function cat(w: World, x: number, y: number, dx: number, dy: number, sp: number, dmg: number, life: number, army: boolean): void {
  const p = w.spawnProjectile(null, "nyan_stampede");
  p.ch = CH_ULT;
  p.kind = PK_FREE;
  p.x = x;
  p.y = y;
  p.vx = dx * sp + (dy !== 0 ? w.rng.spread(5) : 0);
  p.vy = dy * sp;
  p.speed = sp;
  p.r = 14;
  p.dmg = dmg;
  p.knock = 280;
  p.pierce = Infinity;
  p.hitEvery = 0.22;
  p.life = life;
  p.sprite = "ult_cat";
  p.fps = 16;
  p.scale = 2;
  p.entity = true;
  p.glow = true;
  p.shadow = 11;
  p.flipX = dx < 0;
  p.tint = CAT_TINTS[w.rng.int(0, CAT_TINTS.length - 1)];
  p.trail = "dust";
  if (army) p.onHit = catArmyHit;
}

/** Catnip Overdrive: a vertical wall running down (dir 1) or up (-1) across the view. */
function verticalWall(w: World, dir: number, dmg: number, perRow: number, army: boolean): void {
  const pl = w.player;
  const hw = w.viewW * 0.5;
  const hh = w.viewH * 0.5;
  const sp = w.rng.range(250, 290);
  const slot = (hw * 2 - 16) / perRow;
  const life = (hh * 2 + 140 + ROW_GAP) / sp;
  for (let row = 0; row < ROWS; row++)
    for (let i = 0; i < perRow; i++) {
      const x = pl.x - hw + 8 + (i + 0.5 * row + w.rng.next() * 0.25) * slot;
      const y = pl.y - 8 - dir * (hh + 24 + row * ROW_GAP + w.rng.next() * 6);
      cat(w, x, y, 0, dir, sp + w.rng.spread(10), dmg, life, army);
    }
}

export const nyanStampede: UltimateDef = {
  id: "nyan_stampede",
  name: "Nyan Stampede",
  hero: "mochi",
  desc: "60 big cats stampede across the screen in walls, trampling everything.",
  duration: WAVES * WAVE_EVERY + 1.3,
  start(w, u) {
    u.data.wave = 0;
    // 60 cats (5 waves x 2 rows x 6); Cat Army 90, C4 +20: more cats per row
    const army = w.talentRank("mochi_cat_army") > 0;
    const cats = 60 + (army ? 30 : 0) + (w.cons >= 4 && w.hero.id === "mochi" ? 20 : 0);
    u.data.perRow = Math.ceil(cats / (WAVES * ROWS));
    u.data.army = army ? 1 : 0;
    u.data.catnip = w.talentRank("mochi_catnip") > 0 ? 1 : 0;
    u.data.vert = 0;
    if (u.data.catnip) {
      // every gem in view flies home
      const pl = w.player;
      const hw = w.viewW * 0.5 + 8;
      const hh = w.viewH * 0.5 + 8;
      for (let i = 0; i < w.gems.count; i++) {
        const g = w.gems.items[i];
        if (g.dead || g.state !== 0 || Math.abs(g.x - pl.x) > hw || Math.abs(g.y - pl.y) > hh) continue;
        g.state = 1;
        g.speed = 90;
      }
    }
  },
  update(w, u) {
    const d = u.data;
    const pl = w.player;
    const perRow = d.perRow;
    const army = d.army > 0;
    while (d.wave < WAVES && u.t >= d.wave * WAVE_EVERY) {
      const dir = d.wave % 2 === 0 ? 1 : -1;
      const hw = w.viewW * 0.5;
      const hh = w.viewH * 0.5;
      const sp = w.rng.range(250, 290);
      const span = hh * 2 - 16;
      const slot = span / perRow;
      for (let row = 0; row < ROWS; row++)
        for (let i = 0; i < perRow; i++) {
          // a wall: the front row leads, the back row trails ROW_GAP behind, staggered half a slot
          const x = pl.x - dir * (hw + 24 + row * ROW_GAP + w.rng.next() * 6);
          const y = pl.y - hh + 18 + (i + 0.5 * row + w.rng.next() * 0.25) * slot;
          const vx = dir * (sp + w.rng.spread(10));
          const p = w.spawnProjectile(null, "nyan_stampede");
          p.ch = CH_ULT;
          p.kind = PK_FREE;
          p.x = x;
          p.y = y;
          p.vx = vx;
          p.vy = w.rng.spread(5);
          p.speed = Math.abs(p.vx);
          p.r = 14;
          p.dmg = CAT_DMG * w.stats.might * u.power;
          p.knock = 280;
          p.pierce = Infinity;
          p.hitEvery = 0.22;
          p.life = (hw * 2 + 140 + ROW_GAP) / p.speed;
          p.sprite = "ult_cat";
          p.fps = 16;
          p.scale = 2;
          p.entity = true;
          p.glow = true;
          p.shadow = 11;
          p.flipX = dir < 0;
          p.tint = CAT_TINTS[w.rng.int(0, CAT_TINTS.length - 1)];
          p.trail = "dust";
          if (army) p.onHit = catArmyHit;
        }
      // the leading edge enters at x = pl.x - dir * hw (view edge)
      w.emit("ultMeow", { x: pl.x - dir * hw, y: pl.y, dir, wave: d.wave });
      d.wave++;
    }
    // Catnip Overdrive: two extra walls, top -> bottom then bottom -> top
    if (d.catnip > 0) {
      const dmg = CAT_DMG * w.stats.might * u.power;
      const vpr = Math.max(4, Math.round((perRow * w.viewW) / w.viewH));
      while (d.vert < 2 && u.t >= (d.vert * 2 + 1) * WAVE_EVERY) {
        verticalWall(w, d.vert === 0 ? 1 : -1, dmg, vpr, army);
        d.vert++;
      }
    }
  },
};

export const ultimates: UltimateDef[] = [nyanStampede];
