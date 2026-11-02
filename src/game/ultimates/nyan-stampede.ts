/** Mochi - Nyan Stampede: 40 cats gallop across the screen in 4 waves, trampling (damage + big knockback). */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import { PK_FREE, type UltimateDef } from "../types";

const WAVES = 4;
const PER_WAVE = 10;
const WAVE_EVERY = 0.75;
const CAT_TINTS = [0xffffff, C.paleYellow, C.pinkLight, C.lavender, C.lightBlue, C.mint, 0xffd6c4, C.aqua];

export const nyanStampede: UltimateDef = {
  id: "nyan_stampede",
  name: "Nyan Stampede",
  hero: "mochi",
  desc: "40 cats stampede across the screen, trampling everything.",
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
      for (let i = 0; i < PER_WAVE; i++) {
        const sp = w.rng.range(230, 300);
        const p = w.spawnProjectile(null, "nyan_stampede");
        p.ch = CH_ULT;
        p.kind = PK_FREE;
        p.x = pl.x - dir * (hw + 16 + w.rng.next() * 50);
        p.y = pl.y - hh + 14 + ((i + w.rng.next() * 0.8) / PER_WAVE) * (hh * 2 - 10);
        p.vx = dir * sp;
        p.vy = w.rng.spread(8);
        p.speed = sp;
        p.r = 9;
        p.dmg = 48 * w.stats.might * u.power;
        p.knock = 260;
        p.pierce = Infinity;
        p.hitEvery = 0.22;
        p.life = (hw * 2 + 120) / sp;
        p.sprite = "ult_cat";
        p.fps = 16;
        p.entity = true;
        p.shadow = 11;
        p.flipX = dir < 0;
        p.tint = CAT_TINTS[w.rng.int(0, CAT_TINTS.length - 1)];
        p.trail = "dust";
      }
      w.emit("ultMeow", { x: pl.x - dir * hw, y: pl.y });
      d.wave++;
    }
  },
};

export const ultimates: UltimateDef[] = [nyanStampede];
