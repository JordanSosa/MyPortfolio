/** Combat Plot Points: kills, elites, bosses, combo ranks, not getting hit. */
import { counter } from "../helpers";
import type { AchievementDef } from "../types";

export const achievements: AchievementDef[] = [
  counter("kills_1k", "Plushie Problem", "Defeat 1,000 enemies.", "combat", 1_000, (c) => c.life.kills, { gems: 60 }),
  counter("kills_10k", "Plushie Purge", "Defeat 10,000 enemies.", "combat", 10_000, (c) => c.life.kills, { gems: 160 }),
  counter("kills_100k", "Extinction Event (Cute)", "Defeat 100,000 enemies.", "combat", 100_000, (c) => c.life.kills, { gems: 400 }),
  counter("kills_1m", "One Million Plushies Later", "Defeat 1,000,000 enemies.", "combat", 1_000_000, (c) => c.life.kills, { gems: 1000, title: "Plushie Nightmare" }),
  counter("elites_100", "Rival Of The Week, Every Week", "Defeat 100 elites.", "combat", 100, (c) => c.life.eliteKills, { gems: 120 }),
  counter("bosses_10", "Boss Rush", "Defeat 10 bosses.", "combat", 10, (c) => Object.values(c.life.bossKills).reduce((a, b) => a + b, 0), { gems: 120 }),
  counter("combo_100", "Combo Breaker Breaker", "Reach a 100 combo.", "combat", 100, (c) => c.life.maxCombo, { gems: 40 }),
  counter("rank_sss", "SSS-Rank Protagonist", "Reach the SSS combo rank.", "combat", 5, (c) => Math.max(0, c.life.maxRank), { gems: 160, unlock: "idol_lightstick_wave" }),
  counter("no_hit_180", "Untouchable", "Go 3:00 without taking damage in one run. Plot armor, but earned.", "combat", 180, (c) => c.life.noHitBest, { gems: 160 }),
];
