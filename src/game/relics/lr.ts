/**
 * LR ("Legendary Rare") relics (docs/content/relics.md).
 */
import type { RelicDef } from "../defs";
import { Buff } from "../hooks";
import { atStar, proc } from "./_util";

const SAKUGA = [5, 5.5, 6, 6.5, 7, 7.5, 8];

export const sakugaCel: RelicDef = {
  id: "sakuga_cel",
  name: "Sakuga Animation Cel",
  rarity: "LR",
  icon: "icon_relic_sakuga_cel",
  flavor: "For five seconds, the budget is infinite.",
  desc: (s) => `Every 30 s, SAKUGA MODE for ${atStar(SAKUGA, s)} s: -40% cooldown, +20% move speed, every hit sparkles`,
  install(w, s) {
    const dur = atStar(SAKUGA, s);
    const mode = new Buff(w);
    w.statMods.push((st) => {
      if (!mode.on) return;
      st.cooldown -= 0.4;
      st.moveSpeed += 0.2;
    });
    w.every(30, () => {
      mode.start(dur);
      const p = w.player;
      proc(w, "sakuga_cel", p.x, p.y - 10, dur);
    });
  },
};

export const relics: RelicDef[] = [sakugaCel];
