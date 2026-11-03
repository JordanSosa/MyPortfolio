/** Silly Plot Points: the ones nobody does on purpose (until they read this). */
import { counter, feat } from "../helpers";
import type { AchievementDef } from "../types";

export const achievements: AchievementDef[] = [
  feat(
    "speedrun",
    "Speedrun Any%",
    "Die within 10 seconds. World record pace.",
    "silly",
    (c) => (c.ended && !!c.run && !c.run.stageCleared && c.run.outcome !== "quit" && c.run.time <= 10) || (c.life.fastestDeath > 0 && c.life.fastestDeath <= 10),
    { gems: 69 },
    { hidden: true },
  ),
  counter("pacifist", "Pacifist?", "Survive 60 seconds without any weapon dealing damage (the Kotatsu understands).", "silly", 60, (c) => Math.max(c.life.pacifistBest, c.run?.pacifistBest ?? 0), { gems: 120 }, { hidden: true }),
  counter("no_dash", "Allergic To Dashing", "Survive 3:00 in one run without dashing.", "silly", 180, (c) => c.life.noDashBest, { gems: 60, unlock: "kotatsu_of_sloth" }),
  counter("touch_grass", "Touch Grass", "Eat 100 snacks from lanterns and gift boxes.", "silly", 100, (c) => c.life.foodEaten, { gems: 40 }),
  counter("episode_100", "Long-Running Series", "Play 100 runs. The show has outlived its manga.", "silly", 100, (c) => c.life.runs, { gems: 320 }),
  counter("tax_brackets", "Tax Brackets", "Hold 100,000 Star Coins at once.", "silly", 100_000, (c) => c.p.currencies.coins, { gems: 100 }),
  counter("flesh_wound", "It Was Only A Flesh Wound", "Get revived. The death was fake. The tears were real.", "silly", 1, (c) => c.life.revivesUsed, { gems: 50 }),
  counter("deaths_50", "TO BE CONTINUED", "Get defeated 50 times. Every cliffhanger counts.", "silly", 50, (c) => c.life.deaths, { gems: 160 }),
];
