/**
 * SSR ("Super Super Rare") relics: mechanics changes (docs/content/relics.md).
 */
import type { RelicDef } from "../defs";
import { atStar, proc } from "./_util";

const SCARF = [1, 1, 1, 2, 2, 2, 2];

export const protagonistScarf: RelicDef = {
  id: "protagonist_scarf",
  name: "Protagonist's Scarf",
  rarity: "SSR",
  icon: "icon_relic_protagonist_scarf",
  flavor: "Never touches the ground. Never washed.",
  desc: (s) => `Survive ${atStar(SCARF, s)} lethal hit${atStar(SCARF, s) > 1 ? "s" : ""} per run at 1 HP${s >= 6 ? "; each save also heals 30%" : ""}`,
  install(w, s) {
    w.plotArmor += atStar(SCARF, s);
    if (s >= 6)
      w.hooks.on("lethal", (h) => {
        if (!h.saved) return;
        // (the save sets HP to 1 right after this hook: heal on the next step)
        w.after(0, () => w.heal(w.player.maxHp * 0.3));
      });
  },
};

const SENTAI = [300, 345, 390, 435, 480, 525, 570];
/** Five sentai colours (red, blue, yellow, green, pink). */
const SENTAI_COLORS = [0xff4d6d, 0x4fa8ff, 0xffe14d, 0x7be36b, 0xff8fd0];

export const sentaiBadge: RelicDef = {
  id: "sentai_badge",
  name: "Sentai Team Badge",
  rarity: "SSR",
  icon: "icon_relic_sentai_badge",
  flavor: "Requires a team of five. You are the team of five.",
  desc: (s) => `When Overdrive starts, a 5-colour explosion goes off behind you (r 80, ${atStar(SENTAI, s)} x might x ult power)`,
  install(w, s) {
    const base = atStar(SENTAI, s);
    w.hooks.on("ult", (u) => {
      const p = w.player;
      // "behind you": opposite the way the hero faces / moves
      const x = p.x - p.aimX * 24;
      const y = p.y - 8 - p.aimY * 18;
      // (not a "big" blast: the Overdrive's own flash is already on screen - the five-colour rings carry it)
      w.explode(x, y, 80 * w.stats.area, base * w.stats.might * u.power, null, 220, "sentai_badge", SENTAI_COLORS[0]);
      proc(w, "sentai_badge", x, y);
    });
  },
};

export const relics: RelicDef[] = [protagonistScarf, sentaiBadge];
