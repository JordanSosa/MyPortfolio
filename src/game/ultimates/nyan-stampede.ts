/**
 * Mochi - Nyan Stampede: 60 big cats gallop across the screen in 5 alternating
 * waves, each wave a tight wall of two staggered rows, trampling (damage + big
 * knockback). Cats are drawn at 2x in warm creams / peaches / pale yellows only
 * (never the enemy pastels), glowing, so the stampede can't be mistaken for a horde.
 */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import { PK_FREE, type UltimateDef } from "../types";

const WAVES = 5;
const ROWS = 2;
const PER_ROW = 6;
const WAVE_EVERY = 0.6;
/** Horizontal gap between the two rows of a wave (px), the back row offset half a slot vertically. */
const ROW_GAP = 30;
/** Per hit (every 0.22 s per enemy): 5 waves x 42 ~ the old 4 waves x 48, slightly more. */
const CAT_DMG = 42;
/** Warm fur only: cream, peach (skin base), pale yellow, white, light peach. */
const CAT_TINTS = [0xffffff, 0xfff0c9, C.paleYellow, 0xffd6c4, 0xfff1ea, 0xffe3b8];

export const nyanStampede: UltimateDef = {
  id: "nyan_stampede",
  name: "Nyan Stampede",
  hero: "mochi",
  desc: "60 big cats stampede across the screen in walls, trampling everything.",
  duration: WAVES * WAVE_EVERY + 1.3,
  start(_w, u) {
    u.data.wave = 0;
  },
  update(w, u) {
    const d = u.data;
    const pl = w.player;
    while (d.wave < WAVES && u.t >= d.wave * WAVE_EVERY) {
      const dir = d.wave % 2 === 0 ? 1 : -1;
      const hw = w.viewW * 0.5;
      const hh = w.viewH * 0.5;
      const sp = w.rng.range(250, 290);
      const span = hh * 2 - 16;
      const slot = span / PER_ROW;
      for (let row = 0; row < ROWS; row++)
        for (let i = 0; i < PER_ROW; i++) {
          const p = w.spawnProjectile(null, "nyan_stampede");
          p.ch = CH_ULT;
          p.kind = PK_FREE;
          // a wall: the front row leads, the back row trails ROW_GAP behind, staggered half a slot
          p.x = pl.x - dir * (hw + 24 + row * ROW_GAP + w.rng.next() * 6);
          p.y = pl.y - hh + 18 + (i + 0.5 * row + w.rng.next() * 0.25) * slot;
          p.vx = dir * (sp + w.rng.spread(10));
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
        }
      // the leading edge enters at x = pl.x - dir * hw (view edge)
      w.emit("ultMeow", { x: pl.x - dir * hw, y: pl.y, dir, wave: d.wave });
      d.wave++;
    }
  },
};

export const ultimates: UltimateDef[] = [nyanStampede];
