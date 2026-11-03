/** Weapon Plot Points: evolutions, mastery, the arsenal codex. */
import { masteryRank } from "../../economy";
import { counter } from "../helpers";
import type { AchCtx, AchievementDef } from "../types";

const bestMastery = (c: AchCtx) => Object.values(c.p.mastery).reduce((m, xp) => Math.max(m, masteryRank(xp)), 0);

export const achievements: AchievementDef[] = [
  counter("evolve_1", "Glow-Up", "Evolve a weapon.", "weapons", 1, (c) => c.life.evolutions, { gems: 60 }),
  counter("evolve_25", "Transformation Sequence Addict", "Evolve 25 weapons.", "weapons", 25, (c) => c.life.evolutions, { gems: 240 }),
  counter("evolve_6_run", "Six-Evolution Spectacle", "Hold 6 evolved weapons in one run.", "weapons", 6, (c) => Math.max(c.life.maxEvolutions, c.run?.evolutions.length ?? 0), { gems: 320 }),
  counter("mastery_5", "Limit Break!", "Reach mastery rank 5 with any weapon.", "weapons", 5, bestMastery, { gems: 120 }),
  counter("mastery_10", "MASTERED", "Reach mastery rank 10 with any weapon.", "weapons", 10, bestMastery, { gems: 400, title: "Weapon Otaku" }),
  counter("arsenal_8", "Arsenal Otaku", "Discover 8 weapons in the codex.", "weapons", 8, (c) => c.p.codex.weapons.length, { gems: 100 }),
];
