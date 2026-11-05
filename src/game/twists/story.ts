/**
 * Plot Twists, "story" (docs/content/stages.md §6): rule changes for the
 * hero, the bosses and the rival.
 */
import type { TwistDef } from "../defs";
import { spawnRival } from "../enemies/rival";
import { ranked } from "./_twist";

export const censored: TwistDef = {
  id: "censored",
  name: "Censored",
  icon: "icon_twist_censored",
  maxRank: 2,
  heat: [2, 2],
  note: "Snacks tested poorly with focus groups.",
  unlockedBy: "dream_meadow",
  desc: (r) => `${ranked("Censored", r, 2)}: no food or heal pickups (props drop coins instead)${r >= 2 ? ", and no level-up heal" : ""}`,
  install(w, r) {
    w.difficulty.food = false;
    w.look.censored = true;
    if (r >= 2) w.difficulty.levelHeal = false;
  },
};

export const cliffhanger: TwistDef = {
  id: "cliffhanger",
  name: "Cliffhanger",
  icon: "icon_twist_cliffhanger",
  maxRank: 2,
  heat: [1, 2],
  note: "Leave them hanging. Literally.",
  unlockedBy: "dream_meadow",
  desc: (r) => `${ranked("Cliffhanger", r, 2)}: max HP -${20 * r}%`,
  install(w, r) {
    w.statMods.push((s) => void (s.maxHp *= 1 - 0.2 * r));
  },
};

export const powerCreep: TwistDef = {
  id: "power_creep",
  name: "Power Creep",
  icon: "icon_twist_power_creep",
  maxRank: 2,
  heat: [1, 2],
  note: "Every villain needs a stronger villain.",
  unlockedBy: "dream_meadow",
  desc: (r) => `${ranked("Power Creep", r, 2)}: elites x${r + 1} per elite event${r >= 2 ? ", elites +50% HP" : ""}`,
  install(w, r) {
    w.difficulty.elite *= r + 1;
    if (r >= 2) w.difficulty.eliteHp *= 1.5;
  },
};

export const spoilers: TwistDef = {
  id: "spoilers",
  name: "Spoilers",
  icon: "icon_twist_spoilers",
  maxRank: 1,
  heat: [1],
  note: "The trailer showed everything anyway.",
  unlockedBy: "candy_kingdom",
  desc: () => "Spoilers: no boss WARNING and no spawn pause - bosses just appear",
  install(w) {
    w.difficulty.bossWarning = 0;
    w.difficulty.bossIntro = false;
  },
};

/** Seconds between Rival (Recolour) hunts per rank. */
const RIVAL_EVERY = [90, 60, 40];

export const shounenRival: TwistDef = {
  id: "shounen_rival",
  name: "Shounen Rival",
  icon: "icon_twist_shounen_rival",
  maxRank: 3,
  heat: [1, 1, 2],
  note: "Give them a rival. Test audiences love yelling.",
  unlockedBy: "beach_episode",
  desc: (r) => `${ranked("Shounen Rival", r, 3)}: your rival (recolour) hunts you every ${RIVAL_EVERY[r - 1]} s`,
  install(w, r) {
    w.every(RIVAL_EVERY[Math.max(1, Math.min(3, r)) - 1], spawnRival);
  },
};

export const sequelHook: TwistDef = {
  id: "sequel_hook",
  name: "Sequel Hook",
  icon: "icon_twist_sequel_hook",
  maxRank: 2,
  heat: [2, 2],
  note: "Nobody really dies if there's a sequel.",
  unlockedBy: "final_arc",
  desc: (r) => `${ranked("Sequel Hook", r, 2)}: ${r >= 2 ? "every boss gets" : "the final boss gets"} back up once at 40% HP ("IT'S NOT OVER!")`,
  install(w, r) {
    w.difficulty.sequel = Math.max(w.difficulty.sequel, r);
  },
};

export const twists: TwistDef[] = [censored, cliffhanger, powerCreep, spoilers, shounenRival, sequelHook];
