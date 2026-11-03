/** Hero Plot Points: the cast, levels, clears with different heroes, constellations. */
import { ROSTER } from "../../roster";
import { counter } from "../helpers";
import type { AchCtx, AchievementDef } from "../types";

const bestHeroLevel = (c: AchCtx) => Object.values(c.p.heroes).reduce((m, h) => Math.max(m, h.level), 0);
const bestConstellation = (c: AchCtx) => Object.values(c.p.heroes).reduce((m, h) => Math.max(m, h.constellation), 0);

export const achievements: AchievementDef[] = [
  counter("heroes_3", "Assemble The Party", "Unlock 3 heroes.", "heroes", 3, (c) => c.p.unlocks.heroes.length, { gems: 80 }),
  counter("heroes_6", "Ensemble Cast", "Unlock 6 heroes.", "heroes", 6, (c) => c.p.unlocks.heroes.length, { gems: 200 }),
  counter("heroes_all", "Full Cast Reveal", `Unlock all ${ROSTER.length} heroes. Yes, even the truck.`, "heroes", ROSTER.length, (c) => c.p.unlocks.heroes.filter((h) => ROSTER.some((r) => r.id === h)).length, { gems: 1600, title: "Showrunner" }),
  counter("hero_level_10", "Character Development", "Raise any hero to level 10.", "heroes", 10, bestHeroLevel, { gems: 100 }),
  counter("hero_level_30", "Max Affection", "Raise any hero to level 30.", "heroes", 30, bestHeroLevel, { gems: 480, title: "Main Character" }),
  counter("clear_3_heroes", "Spin-Off Material", "Clear a stage with 3 different heroes.", "heroes", 3, (c) => c.life.heroesCleared.length, { gems: 240 }),
  counter("constellation_6", "Fully Awakened (Final Form)", "Bring any hero to C6.", "heroes", 6, bestConstellation, { gems: 640, title: "Final Form" }),
];
