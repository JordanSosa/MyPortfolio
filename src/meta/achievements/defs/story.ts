/** Story Plot Points: episodes, stage clears, the Filler Arc and Plot Twist heat. */
import { counter, feat, stageClearByOrder } from "../helpers";
import type { AchievementDef } from "../types";

export const achievements: AchievementDef[] = [
  feat("pilot_episode", "Pilot Episode", "Finish your first run. Every legend has a rough first episode.", "story", (c) => c.life.runs >= 1, { gems: 160 }),
  stageClearByOrder("clear_stage_1", 1, "Dawn Breaks", "Clear Dream Meadow.", { gems: 240, title: "Dawnbringer", unlock: "pudding" }),
  stageClearByOrder("clear_stage_2", 2, "Sugar Crash", "Clear Candy Kingdom.", { gems: 320, unlock: "aoi" }),
  stageClearByOrder("clear_stage_3", 3, "Graduation Ceremony", "Clear Shoujo Academy.", { gems: 400, unlock: "akane" }),
  stageClearByOrder("clear_stage_4", 4, "The Obligatory Beach Episode", "Clear Beach Episode. Crabs were defeated. Watermelons were split.", { gems: 480 }),
  stageClearByOrder("clear_stage_5", 5, "RENEWED FOR SEASON 2!!", "Clear The Final Arc and defeat Cancel-sama.", { gems: 1600, title: "Series Finale" }),
  counter("filler_arc", "Filler Arc Enjoyer", "Survive 5:00 of the endless Filler Arc in one run.", "story", 300, (c) => c.bestEndless(), { gems: 200 }),
  counter("heat_4", "Plot Twist!", "Clear any stage at heat 4 or more.", "story", 4, (c) => Math.max(0, c.bestHeat()), { gems: 240 }),
  counter("heat_16", "Twist Ending Connoisseur", "Clear any stage at heat 16 or more. Nobody saw it coming (they did).", "story", 16, (c) => Math.max(0, c.bestHeat()), { gems: 800, title: "Plot Twister" }),
];
