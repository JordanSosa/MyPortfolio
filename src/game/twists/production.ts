/**
 * Plot Twists, "production problems" (docs/content/stages.md §6): opt-in
 * difficulty with heat. TwistDef.install runs once at run start (before the
 * first step) and usually scales World.difficulty; `heat[i]` is the heat
 * added at rank i + 1 (registry twistHeat sums them).
 */
import type { TwistDef } from "../defs";
import { ranked } from "./_twist";

export const budgetCuts: TwistDef = {
  id: "budget_cuts",
  name: "Budget Cuts",
  icon: "icon_twist_budget_cuts",
  maxRank: 3,
  heat: [1, 1, 1],
  note: "We're reallocating the HP budget to the villains.",
  unlockedBy: "dream_meadow",
  desc: (r) => `${ranked("Budget Cuts", r, 3)}: enemy HP +${25 * r}%`,
  install(w, r) {
    w.difficulty.enemyHp *= 1 + 0.25 * r;
  },
};

export const fillerOverload: TwistDef = {
  id: "filler_overload",
  name: "Filler Overload",
  icon: "icon_twist_filler_overload",
  maxRank: 2,
  heat: [1, 2],
  note: "Can we stretch this to 52 episodes?",
  unlockedBy: "dream_meadow",
  desc: (r) => `${ranked("Filler Overload", r, 2)}: spawn rate +${30 * r}%, max alive +${10 * r}%`,
  install(w, r) {
    w.difficulty.spawn *= 1 + 0.3 * r;
    w.difficulty.cap *= 1 + 0.1 * r;
  },
};

export const rushedProduction: TwistDef = {
  id: "rushed_production",
  name: "Rushed Production",
  icon: "icon_twist_rushed_production",
  maxRank: 2,
  heat: [1, 1],
  note: "Animate faster. The bullets too.",
  unlockedBy: "dream_meadow",
  desc: (r) => `${ranked("Rushed Production", r, 2)}: enemy bullets +${30 * r}% speed`,
  install(w, r) {
    w.difficulty.bulletSpeed *= 1 + 0.3 * r;
  },
};

export const dubVersion: TwistDef = {
  id: "dub_version",
  name: "Dub Version",
  icon: "icon_twist_dub_version",
  maxRank: 2,
  heat: [1, 2],
  note: "The enemies talk faster in this version.",
  unlockedBy: "candy_kingdom",
  desc: (r) => `${ranked("Dub Version", r, 2)}: enemies +${15 * r}% move speed`,
  install(w, r) {
    w.difficulty.enemySpeed *= 1 + 0.15 * r;
  },
};

export const darkerAndEdgier: TwistDef = {
  id: "darker_and_edgier",
  name: "Darker and Edgier",
  icon: "icon_twist_darker_and_edgier",
  maxRank: 3,
  heat: [1, 1, 2],
  note: "Kids love grit, right? Right?",
  unlockedBy: "shoujo_academy",
  desc: (r) => `${ranked("Darker and Edgier", r, 3)}: enemy damage +${20 * r}%${r >= 3 ? ", the whole show 15% darker" : ""}`,
  install(w, r) {
    w.difficulty.enemyDmg *= 1 + 0.2 * r;
    if (r >= 3) w.look.darken = Math.max(w.look.darken, 0.15);
  },
};

export const studioChange: TwistDef = {
  id: "studio_change",
  name: "Studio Change",
  icon: "icon_twist_studio_change",
  maxRank: 1,
  heat: [1],
  note: "New studio, new look. Elites? Who?",
  unlockedBy: "beach_episode",
  desc: () => "Studio Change: elites have no rainbow outline until they are first hit",
  install(w) {
    w.look.eliteOutlineOnHit = true;
  },
};

export const simulcastDelay: TwistDef = {
  id: "simulcast_delay",
  name: "Simulcast Delay",
  icon: "icon_twist_simulcast_delay",
  maxRank: 2,
  heat: [1, 1],
  note: "Overdrive will be available one week later in your region.",
  unlockedBy: "final_arc",
  desc: (r) => `${ranked("Simulcast Delay", r, 2)}: Overdrive charges ${25 * r}% slower`,
  install(w, r) {
    w.statMods.push((s) => void (s.ultGain *= 1 - 0.25 * r));
  },
};

export const twists: TwistDef[] = [budgetCuts, fillerOverload, rushedProduction, dubVersion, darkerAndEdgier, studioChange, simulcastDelay];
