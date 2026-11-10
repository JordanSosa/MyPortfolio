/**
 * Senpai - SENPAI NOTICED YOU (docs/content/heroes.md §2.8, 3.5 s): a pink
 * shoujo frame closes in (view), and for once Senpai looks at everyone.
 *   0.0 s  every non-boss enemy in view is Swooned for 4 s: it stops moving, a beating heart over its
 *          head, +50 % damage from all sources. Bosses are Flustered: stunned 1.5 s (no pattern
 *          progress), +25 % damage taken for 4 s, a heart pops over them.
 *   1.2 s / 2.4 s  two sparkle waves: 120 damage to every enemy in view.
 *
 * C4: the swoon lasts +2 s. Senpai Noticed Everyone (talent capstone): the swoon
 * lasts 7 s and swooned enemies burst into rose petals when it ends (r 24, 100
 * damage). Swoons count RunStats.charmed. State lives in weapons/_charm.ts.
 */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import type { UltimateDef } from "../types";
import type { World } from "../world";
import { fluster, swoon } from "../weapons/_charm";
import { HB, hfx, inView } from "../weapons/_hb";

const ID = "senpai_noticed_you";
const WAVES = [1.2, 2.4];
const WAVE_DMG = 120;

/** Swoon seconds for this run (4 s, C4 +2 s, Senpai Noticed Everyone 7 s). */
function swoonTime(w: World): number {
  if (w.talentRank("senpai_noticed_everyone") > 0) return 7;
  return 4 + (w.cons >= 4 && w.hero.id === "senpai" ? 2 : 0);
}

export const senpaiNoticedYou: UltimateDef = {
  id: ID,
  name: "SENPAI NOTICED YOU",
  hero: "senpai",
  desc: "Senpai finally notices everyone: every enemy in view swoons (+50% damage taken), bosses get flustered, two sparkle waves.",
  duration: 3.5,
  start(w, u) {
    u.data.wave = 0;
    const secs = swoonTime(w);
    const burst = w.talentRank("senpai_noticed_everyone") > 0 ? 100 * w.stats.might * u.power : 0;
    const items = w.enemies.items;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i];
      if (e.dead || e.def.prop || !inView(w, e, 8)) continue;
      if (e.def.boss) {
        fluster(w, e, 1.5, 4);
        hfx(w, HB.FLUSTER, e.x, e.y - e.cy * 2, e.x, e.y, 0, 0, e);
      } else swoon(w, e, secs, burst);
    }
    const p = w.player;
    hfx(w, HB.NOTICED, p.x, p.y, p.x, p.y, secs);
  },
  update(w, u) {
    const d = u.data;
    while (d.wave < WAVES.length && u.t >= WAVES[d.wave]) {
      const dmg = WAVE_DMG * w.stats.might * u.power;
      w.hitAllInView(dmg, dmg, 60, ID, C.pinkLight, CH_ULT);
      const p = w.player;
      hfx(w, HB.SPARKLE_WAVE, p.x, p.y - 8, p.x, p.y, 0, d.wave);
      d.wave++;
    }
  },
};

export const ultimates: UltimateDef[] = [senpaiNoticedYou];
