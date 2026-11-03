/** Gacha Plot Points: pulls, pity, 50/50s, rarities, the collection. */
import { counter, feat } from "../helpers";
import type { AchievementDef } from "../types";

export const achievements: AchievementDef[] = [
  counter("first_pull", "Just One Pull", "Pull the Merch Machine once. Just one. Surely.", "gacha", 1, (c) => c.p.gacha.stats.pulls, { gems: 160 }),
  counter("pulls_100", "Pity Party", "Pull 100 times.", "gacha", 100, (c) => c.p.gacha.stats.pulls, { gems: 320 }),
  counter("pulls_1000", "Spark Joy", "Pull 1,000 times.", "gacha", 1000, (c) => c.p.gacha.stats.pulls, { gems: 1600, title: "Whale (Platonic)" }),
  counter("gacha_hell", "Gacha Hell", "Pull 10 N items in a row.", "gacha", 10, (c) => c.p.gacha.stats.nStreakBest, { gems: 160 }),
  feat("lost_5050", "LOST THE 50/50", "Lose a 50/50. Here's a consolation prize. It's gems. It's always gems.", "gacha", (c) => c.p.gacha.stats.lost5050 > 0, { gems: 160 }),
  feat("first_ssr", "Gold Meteor", "Pull an SSR or better.", "gacha", (c) => {
    const b = c.p.gacha.stats.byRarity;
    return b.SSR + b.UR + b.LR + b.MYTHIC > 0;
  }, { gems: 100 }),
  feat("mythic", "Whale-Sized Luck", "Pull a MYTHIC. The odds were 0.0069%. Nice.", "gacha", (c) => c.p.gacha.stats.byRarity.MYTHIC > 0, { gems: 1600, title: "Literally Chosen" }, { hidden: true }),
  counter("relics_10", "Merch Collector", "Own 10 different relics.", "gacha", 10, (c) => Object.keys(c.p.relics).length, { gems: 160 }),
];
