/**
 * SR ("Super Rare") relics: event hooks (docs/content/relics.md).
 */
import { CFG } from "../config";
import type { RelicDef } from "../defs";
import { atStar, proc } from "./_util";

const NOVEL = [8, 9, 10, 11, 12, 13, 14];

export const lightNovelVol1: RelicDef = {
  id: "light_novel_vol1",
  name: "Light Novel Vol. 1 (Unread)",
  rarity: "SR",
  icon: "icon_relic_light_novel_vol1",
  flavor: "Full title: 'I Never Read This Book, So Now I Get an Extra Card?!'",
  desc: (s) => `The first ${atStar(NOVEL, s)} level-ups each run offer +1 card`,
  install(w, s) {
    const n = atStar(NOVEL, s);
    let ups = 0;
    w.statMods.push((st) => {
      if (ups < n) st.cards += 1;
    });
    w.hooks.on("levelUp", () => {
      // (the offer for level-up #k is made after it: +1 card while k <= n)
      if (++ups === n) w.statsDirty = true;
    });
  },
};

const GOLDFISH = [5, 6, 7, 8, 9, 10, 11];
const SPLASH_R = 48;

export const festivalGoldfish: RelicDef = {
  id: "festival_goldfish",
  name: "Festival Goldfish (Bagged)",
  rarity: "SR",
  icon: "icon_relic_festival_goldfish",
  flavor: "Named Captain. Has been through a lot.",
  desc: (s) => `Every 15 s a splash heals ${atStar(GOLDFISH, s)} HP and slows enemies within ${SPLASH_R} px by 50% for 1 s`,
  install(w, s) {
    const hp = atStar(GOLDFISH, s);
    w.every(15, () => {
      const p = w.player;
      const y = p.y - CFG.playerCy;
      w.heal(hp);
      const buf = w.acquire();
      const n = w.grid.query(p.x, y, SPLASH_R + 24, buf);
      for (let k = 0; k < n; k++) {
        const e = w.enemies.items[buf[k]];
        if (!e || e.dead || e.def.prop || e.def.boss) continue;
        const dx = e.x - p.x;
        const dy = e.y - e.cy - y;
        const rr = SPLASH_R + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (e.slow > 0.5) e.slow = 0.5;
        if (e.slowT < 1) e.slowT = 1;
      }
      w.release();
      proc(w, "festival_goldfish", p.x, y, SPLASH_R);
    });
  },
};

export const relics: RelicDef[] = [lightNovelVol1, festivalGoldfish];
