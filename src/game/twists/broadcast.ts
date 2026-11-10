/**
 * Plot Twists, "broadcast" (docs/content/stages.md §6): the network meddles
 * with your build.
 */
import type { TwistDef } from "../defs";
import { ranked } from "./_twist";

export const midSeasonBreak: TwistDef = {
  id: "mid_season_break",
  name: "Mid-Season Break",
  icon: "icon_twist_mid_season_break",
  maxRank: 2,
  heat: [1, 1],
  note: "No rerolls until we're back in the spring.",
  unlockedBy: "candy_kingdom",
  desc: (r) => `${ranked("Mid-Season Break", r, 2)}: no rerolls${r >= 2 ? ", no banishes and no skips" : ""}`,
  install(w, r) {
    w.difficulty.rerolls = false;
    if (r >= 2) {
      w.banishes = 0;
      w.skips = 0;
    }
  },
};

export const lightNovelTitle: TwistDef = {
  id: "light_novel_title",
  name: "Light Novel Title",
  icon: "icon_twist_light_novel_title",
  maxRank: 1,
  heat: [2],
  note: "Our Hero, Who Was Given Fewer Cards, Somehow Survives Anyway",
  unlockedBy: "shoujo_academy",
  desc: () => "Light Novel Title: level-ups offer 1 fewer card (min 2) - the titles take up too much space",
  install(w) {
    w.novelTitles = true;
    w.statMods.push((s) => void (s.cards = Math.max(2, s.cards - 1)));
  },
};

export const twists: TwistDef[] = [midSeasonBreak, lightNovelTitle];
