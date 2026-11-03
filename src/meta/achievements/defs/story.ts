/**
 * Story Plot Points (docs/content/achievements.md §2, 24): episodes, boss
 * first defeats, stage clears, the Filler Arc and Plot Twist heat.
 */
import { counter, feat, stageClearByOrder } from "../helpers";
import type { AchievementDef } from "../types";
import { BOSS_IDS, bestTimeIn, bossDown, minHeatEverywhere } from "./_shared";

const boss = (id: string, bossId: string, name: string, desc: string, gems: number, unlock?: string): AchievementDef =>
  counter(id, name, desc, "story", 1, (c) => bossDown(c, bossId), unlock ? { gems, unlock } : { gems });

export const achievements: AchievementDef[] = [
  feat("pilot_episode", "Pilot Episode", "Finish your first run. Every legend has a rough first episode.", "story", (c) => c.life.runs >= 1, { gems: 160 }),
  boss("king_puff_down", "king_puff", "Long Live the King (Not)", "Defeat King Puff.", 60, "rin"),
  boss("teddy_down", "nightmare_teddy", "Lights On", "Defeat Nightmare Teddy. Check under the bed: clear.", 80),
  counter("kuro_awakens", "The Seal Weakens", "Survive 6:00 in Dream Meadow. Something stirs. It's edgy.", "story", 360, (c) => bestTimeIn(c, 1), { gems: 80, unlock: "kuro" }),
  stageClearByOrder("clear_stage_1", 1, "Dawn Breaks", "Clear Dream Meadow.", { gems: 240, title: "Dawnbringer", unlock: "pudding" }),
  boss("gingerbread_down", "gingerbread_golem", "Crumbled", "Defeat the Gingerbread Golem. It was supposed to be a house.", 80),
  stageClearByOrder("clear_stage_2", 2, "Sugar Crash", "Clear Candy Kingdom.", { gems: 320, unlock: "aoi" }),
  boss("president_down", "council_president", "Motion Carried", "Defeat the Student Council President. It's going on her record.", 100),
  stageClearByOrder("clear_stage_3", 3, "Graduation Ceremony", "Clear Shoujo Academy.", { gems: 400, unlock: "akane" }),
  boss("kraken_down", "kraken_chan", "She Got Her Hug", "Defeat Kraken-chan. A crab hugged her. Everyone cried.", 120),
  stageClearByOrder("clear_stage_4", 4, "The Obligatory Beach Episode", "Clear Beach Episode. Crabs were defeated. Watermelons were split.", { gems: 480 }),
  boss("truck_down", "truck_kun_boss", "Right of Way", "Defeat Truck-kun. Look both ways next time.", 140),
  boss("rival_down", "rival_chan", "See You Next Season", "Defeat Rival-chan. She'll be back. She said so. Loudly.", 160),
  stageClearByOrder("clear_stage_5", 5, "RENEWED FOR SEASON 2!!", "Clear The Final Arc and defeat Cancel-sama.", { gems: 1600, title: "Series Finale" }),
  counter(
    "all_bosses",
    "Villain of the Week, Every Week",
    "Defeat all 12 bosses at least once.",
    "story",
    BOSS_IDS.length,
    (c) => BOSS_IDS.filter((b) => (c.life.bossKills[b] ?? 0) > 0).length,
    { gems: 600, title: "Villain Collector" },
  ),
  counter("filler_arc", "Filler Arc Enjoyer", "Survive 5:00 of the endless Filler Arc in one run.", "story", 300, (c) => c.bestEndless(), { gems: 200 }),
  counter("filler_15", "This Filler Has Its Own Filler", "Survive 15:00 of the Filler Arc in one run.", "story", 900, (c) => c.bestEndless(), { gems: 400 }),
  counter("filler_30", "The Filler Is the Show Now", "Survive 30:00 of the Filler Arc in one run.", "story", 1800, (c) => c.bestEndless(), { gems: 800, title: "Filler Veteran" }),
  counter("rematch_1", "Rematch!", "Defeat a boss rematch in the Filler Arc.", "story", 1, (c) => c.run?.bossRematches ?? 0, { gems: 120 }),
  counter("heat_4", "Plot Twist!", "Clear any stage at heat 4 or more.", "story", 4, (c) => Math.max(0, c.bestHeat()), { gems: 240 }),
  counter("heat_8", "Twist Upon Twist", "Clear any stage at heat 8 or more.", "story", 8, (c) => Math.max(0, c.bestHeat()), { gems: 400 }),
  counter("heat_16", "Twist Ending Connoisseur", "Clear any stage at heat 16 or more. Nobody saw it coming (they did).", "story", 16, (c) => Math.max(0, c.bestHeat()), { gems: 800, title: "Plot Twister" }),
  counter(
    "heat_32",
    "Nobody Saw That Coming",
    "Clear any stage at heat 32 or more. The writers are concerned.",
    "story",
    32,
    (c) => Math.max(0, c.bestHeat()),
    { gems: 1600, title: "Showrunner's Nightmare" },
  ),
  counter("heat_8_everywhere", "Every Season Has a Twist", "Clear all 5 stages at heat 8 or more.", "story", 8, minHeatEverywhere, { gems: 800 }),
];
