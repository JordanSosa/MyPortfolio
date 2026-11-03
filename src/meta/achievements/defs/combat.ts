/**
 * Combat Plot Points (docs/content/achievements.md §3, 28): kills, elites,
 * bosses, combo ranks, not getting hit, levels, chests, Overdrive.
 */
import { counter, feat } from "../helpers";
import type { AchievementDef } from "../types";
import { bossTotal, runKillCount } from "./_shared";

export const achievements: AchievementDef[] = [
  counter("kills_1k", "Plushie Problem", "Defeat 1,000 enemies.", "combat", 1_000, (c) => c.life.kills, { gems: 60 }),
  counter("mochi_3000", "Cat-astrophe", "Defeat 3,000 enemies. Someone is impressed (she's a cat).", "combat", 3_000, (c) => c.life.kills, { gems: 80, unlock: "mochi" }),
  counter("kills_10k", "Plushie Purge", "Defeat 10,000 enemies.", "combat", 10_000, (c) => c.life.kills, { gems: 160, coins: 1000 }),
  counter("kills_100k", "Extinction Event (Cute)", "Defeat 100,000 enemies.", "combat", 100_000, (c) => c.life.kills, { gems: 400 }),
  counter("kills_1m", "One Million Plushies Later", "Defeat 1,000,000 enemies.", "combat", 1_000_000, (c) => c.life.kills, { gems: 1000, title: "Plushie Nightmare" }),
  counter("episode_1000", "Thousand-Kill Episode", "Defeat 1,000 enemies in one run.", "combat", 1_000, runKillCount, { gems: 100 }),
  counter("episode_5000", "Screen Melter", "Defeat 5,000 enemies in one run.", "combat", 5_000, runKillCount, { gems: 300 }),
  counter("elites_10", "Rainbow Outline Hunter", "Defeat 10 elites.", "combat", 10, (c) => c.life.eliteKills, { gems: 40 }),
  counter("elites_100", "Rival Of The Week, Every Week", "Defeat 100 elites.", "combat", 100, (c) => c.life.eliteKills, { gems: 120 }),
  counter("elites_1000", "Elite Burnout", "Defeat 1,000 elites. They have a union now.", "combat", 1_000, (c) => c.life.eliteKills, { gems: 400 }),
  counter("bosses_10", "Boss Rush", "Defeat 10 bosses.", "combat", 10, bossTotal, { gems: 120 }),
  counter("bosses_100", "Weekly Villain Subscription", "Defeat 100 bosses.", "combat", 100, bossTotal, { gems: 400 }),
  counter("combo_100", "Combo Breaker Breaker", "Reach a 100 combo.", "combat", 100, (c) => c.life.maxCombo, { gems: 40 }),
  counter("combo_1000", "Four-Digit Combo", "Reach a 1,000 combo.", "combat", 1_000, (c) => c.life.maxCombo, { gems: 240 }),
  counter("combo_5000", "Combo Counter Overflow", "Reach a 5,000 combo. The counter needed a bigger font.", "combat", 5_000, (c) => c.life.maxCombo, { gems: 600 }, { hidden: true }),
  // (combo rank index: 0 = C ... 3 = S ... 5 = SSS)
  counter("rank_s", "Main Character Energy", "Reach the S combo rank.", "combat", 3, (c) => Math.max(0, c.life.maxRank), { gems: 80, unlock: "main_character_aura" }),
  counter("rank_sss", "SSS-Rank Protagonist", "Reach the SSS combo rank.", "combat", 5, (c) => Math.max(0, c.life.maxRank), { gems: 160, unlock: "idol_lightstick_wave" }),
  counter("no_hit_120", "Be Small, Be Unhittable", "Go 2:00 without taking damage in one run.", "combat", 120, (c) => c.life.noHitBest, { gems: 100, unlock: "chibi_charm" }),
  counter("no_hit_180", "Untouchable", "Go 3:00 without taking damage in one run. Plot armor, but earned.", "combat", 180, (c) => c.life.noHitBest, { gems: 160 }),
  feat("flawless_finale", "Flawless Finale", "Clear a stage taking less than 150 damage.", "combat", (c) => !!c.run && c.run.stageCleared && c.run.damageTaken < 150, { gems: 300, title: "Flawless" }),
  counter("level_25", "Cue the Montage", "Reach level 25 in one run.", "combat", 25, (c) => c.life.bestLevel, { gems: 60, unlock: "training_montage" }),
  counter("level_50", "Power Creep Personified", "Reach level 50 in one run.", "combat", 50, (c) => c.life.bestLevel, { gems: 160 }),
  counter("level_99", "Lv.99 (Basically 9999)", "Reach level 99 in one run.", "combat", 99, (c) => c.life.bestLevel, { gems: 600 }, { hidden: true }),
  counter("damage_5000", "Character Building", "Take 5,000 damage in total. Walk it off.", "combat", 5_000, (c) => c.life.damageTaken, { gems: 80, unlock: "plot_armor" }),
  counter("chests_100", "Treasure Hoarder", "Open 100 chests.", "combat", 100, (c) => c.life.chests, { gems: 60, coins: 1500 }),
  counter("jackpot", "JACKPOT!!", "Hit a 5-item chest JACKPOT.", "combat", 1, (c) => c.run?.jackpots ?? 0, { gems: 120 }),
  counter("ults_25", "Name Your Attacks", "Use Overdrive 25 times.", "combat", 25, (c) => c.life.ults, { gems: 60, unlock: "inner_monologue" }),
  counter("ults_500", "Attack Name Enthusiast", "Use Overdrive 500 times. Your throat hurts.", "combat", 500, (c) => c.life.ults, { gems: 320 }),
];
