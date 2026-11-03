/**
 * Silly Plot Points (docs/content/achievements.md §7, 21): the ones nobody
 * does on purpose (until they read this). End-of-run feats (deaths, quits)
 * only count once the run is over (`c.ended`), never mid-run.
 */
import { counter, feat } from "../helpers";
import type { AchievementDef } from "../types";
import { diedThisRun, runKillCount } from "./_shared";

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
  counter("episode_100", "Long-Running Series", "Play 100 runs. The show has outlived its manga.", "silly", 100, (c) => c.life.runs, { gems: 320, coins: 5000 }),
  counter("tax_brackets", "Tax Brackets", "Hold 100,000 Star Coins at once.", "silly", 100_000, (c) => c.p.currencies.coins, { gems: 100 }),
  counter("flesh_wound", "Back After the Commercial Break", "Get revived. The death was fake. The tears were real.", "silly", 1, (c) => c.life.revivesUsed, { gems: 50 }),
  counter("deaths_50", "TO BE CONTINUED", "Get defeated 50 times. Every cliffhanger counts.", "silly", 50, (c) => c.life.deaths, { gems: 160 }),
  counter("do_not_disturb", "Do Not Disturb", "Stay Too Comfy in the Kotatsu for 2:00 straight.", "silly", 120, (c) => c.run?.comfyBest ?? 0, { gems: 120 }, { hidden: true }),
  feat("wisp_death", "Should've Blown Out the Candle", "Be defeated by a Candle Wisp.", "silly", (c) => diedThisRun(c) && c.run?.killedBy === "wisp", { gems: 40 }, { hidden: true }),
  feat(
    "isekaid",
    "Isekai'd",
    "Be defeated by Truck-kun or a Mini Truck-kun. See you in the next world.",
    "silly",
    (c) => diedThisRun(c) && (c.run?.killedBy === "truck_kun_boss" || c.run?.killedBy === "mini_truck"),
    { gems: 100, title: "Reincarnated" },
    { hidden: true },
  ),
  feat("saving_it", "Saving It for Later", "Be defeated with Overdrive fully charged.", "silly", (c) => diedThisRun(c) && c.run?.ultReadyAtDeath === true, { gems: 40 }, { hidden: true }),
  counter("commitment_issues", "Commitment Issues", "Reroll 20 times in one run.", "silly", 20, (c) => c.run?.rerollsUsed ?? 0, { gems: 80 }),
  counter("not_my_type", "Not My Type", "Banish 5 cards in one run.", "silly", 5, (c) => c.run?.banishesUsed ?? 0, { gems: 60 }),
  counter("nani_100", "NANI?! ×100", "See 100 NANI?! pops in one run.", "silly", 100, (c) => c.run?.nanis ?? 0, { gems: 80 }),
  feat("background_character", "Background Character", "Survive 1:00 with fewer than 10 kills. Very low profile.", "silly", (c) => !!c.run && c.run.time >= 60 && runKillCount(c) < 10, { gems: 30 }, { hidden: true }),
  feat("dropped_after_ep1", "Dropped After Episode 1", "Quit a run within 30 seconds.", "silly", (c) => c.ended && !!c.run && c.run.outcome === "quit" && !c.run.stageCleared && c.run.time < 30, { gems: 10 }, { hidden: true }),
  feat("censored_clear", "Snack-Free Diet", "Clear a stage with Censored active.", "silly", (c) => !!c.run && c.run.stageCleared && c.run.twists.includes("censored"), { gems: 120 }),
  feat("sequel_hook_clear", "It's Not Over! (It Was)", "Clear a stage with Sequel Hook active.", "silly", (c) => !!c.run && c.run.stageCleared && c.run.twists.includes("sequel_hook"), { gems: 120 }),
  counter("greedy_protagonist", "Greedy Protagonist", "Pick up 1,000 coins in one run.", "silly", 1000, (c) => c.run?.coins ?? 0, { coins: 1000 }),
  feat("read_fine_print", "Read The Fine Print", "Scroll to the very bottom of the Merch Machine fine print. Nobody does that.", "silly", (c) => (c.p.flags.finePrint ?? 0) >= 1, { gems: 69 }, { hidden: true }),
];
