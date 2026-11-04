/**
 * Gacha Plot Points (docs/content/achievements.md §6, 25): pulls, pity,
 * 50/50s, rarities, the Merch collection, Copium and the exchanges.
 * Evaluated outside runs too (after pulls, at boot).
 */
import { counter, feat } from "../helpers";
import type { AchCtx, AchievementDef } from "../types";
import { relicsAtStars } from "./_shared";

const stats = (c: AchCtx) => c.p.gacha.stats;

export const achievements: AchievementDef[] = [
  counter("first_pull", "Just One Pull", "Pull the Merch Machine once. Just one. Surely.", "gacha", 1, (c) => stats(c).pulls, { gems: 160 }),
  counter("first_ten_pull", "The Ten-Pull", "Do a 10-pull. Feel the guarantee.", "gacha", 1, (c) => stats(c).tenPulls, { gems: 40 }),
  counter("pulls_100", "Pity Party", "Pull 100 times.", "gacha", 100, (c) => stats(c).pulls, { gems: 160 }),
  counter("pulls_300", "UR Pity Pilgrim", "Pull 300 times.", "gacha", 300, (c) => stats(c).pulls, { gems: 240 }),
  counter("pulls_1000", "The Thousand-Pull Pilgrimage", "Pull 1,000 times.", "gacha", 1000, (c) => stats(c).pulls, { gems: 800, title: "Whale (Platonic)" }),
  counter("gacha_hell", "Gacha Hell", "Pull 10 N items in a row.", "gacha", 10, (c) => stats(c).nStreakBest, { gems: 80 }),
  counter("gacha_hell_25", "Gacha Hell: Director's Cut", "Pull 25 N items in a row.", "gacha", 25, (c) => stats(c).nStreakBest, { gems: 160 }, { hidden: true }),
  feat("lost_5050", "LOST THE 50/50", "Lose a 50/50. Here's a consolation prize. It's gems. It's always gems.", "gacha", (c) => stats(c).lost5050 > 0, { gems: 80 }),
  counter("lost_5050_3", "Three-Time Loser (Affectionate)", "Lose three 50/50s.", "gacha", 3, (c) => stats(c).lost5050, { gems: 120 }),
  counter("won_5050", "Coin Flip Champion", "Win a 50/50.", "gacha", 1, (c) => stats(c).won5050, { gems: 60 }),
  feat(
    "first_ssr",
    "Gold Meteor",
    "Pull an SSR or better.",
    "gacha",
    (c) => {
      const b = stats(c).byRarity;
      return b.SSR + b.UR + b.LR + b.MYTHIC > 0;
    },
    { gems: 50 },
  ),
  feat(
    "first_ur",
    "Rainbow Meteor",
    "Pull a UR or better.",
    "gacha",
    (c) => {
      const b = stats(c).byRarity;
      return b.UR + b.LR + b.MYTHIC > 0;
    },
    { gems: 120 },
  ),
  feat("first_lr", "Legendary (Actually)", "Pull an LR or better.", "gacha", (c) => stats(c).byRarity.LR + stats(c).byRarity.MYTHIC > 0, { gems: 240 }),
  feat("mythic", "Whale-Sized Luck", "Pull a MYTHIC. The odds were 0.0069%. Nice.", "gacha", (c) => stats(c).byRarity.MYTHIC > 0, { gems: 800, title: "Literally Chosen" }, { hidden: true }),
  counter("hard_pity", "The Machine Felt Bad", "Get an SSR from hard pity.", "gacha", 1, (c) => stats(c).hardPityHits ?? 0, { gems: 80 }),
  counter("spark_used", "Spark Plug", "Claim the 1,000-pull spark.", "gacha", 1, (c) => stats(c).sparksUsed, { gems: 200, title: "Spark Plug" }),
  feat("truck_owned", "It Found You", "Own Truck-kun.", "gacha", (c) => c.p.unlocks.heroes.includes("truck_kun"), { gems: 400 }, { hidden: true }),
  counter("relics_10", "Merch Collector", "Own 10 different relics.", "gacha", 10, (c) => Object.keys(c.p.relics).length, { gems: 80 }),
  counter("relics_30", "Merch Hoarder", "Own 30 different relics.", "gacha", 30, (c) => Object.keys(c.p.relics).length, { gems: 160 }),
  counter("relics_all", "Complete Merch Catalogue", "Own all 61 relics.", "gacha", 61, (c) => Object.keys(c.p.relics).length, { gems: 1500, title: "Merch Completionist" }),
  counter("relic_star_6", "Fully Merched", "Raise any relic to ★6.", "gacha", 1, (c) => Math.min(1, relicsAtStars(c, 6)), { gems: 160 }),
  counter("cone_zone", "Foreshadowing", "Raise the Traffic Cone to ★6. It's coming.", "gacha", 6, (c) => c.p.relics.traffic_cone ?? 0, { gems: 40 }),
  counter("copium_1000", "Professional Coper", "Earn 1,000 Copium.", "gacha", 1000, (c) => stats(c).copiumEarned, { gems: 100 }),
  counter("exchange_buy", "Copium Connoisseur", "Buy anything from the Copium Exchange.", "gacha", 1, (c) => stats(c).exchangeBuys, { gems: 30 }),
  counter("gem_exchange", "Terrible Deal", "Use the Gem Exchange. You know the rate. You did it anyway.", "gacha", 1, (c) => stats(c).gemExchanges ?? 0, { gems: 10 }),
];
