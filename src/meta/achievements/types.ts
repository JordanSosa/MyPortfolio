/**
 * Achievement ("Plot Point") definitions, docs/EXPANSION.md §11. One file per
 * category group in ./defs (auto-registered with import.meta.glob):
 *
 *   // src/meta/achievements/defs/<group>.ts
 *   export const achievements: AchievementDef[] = [
 *     counter("kills_1k", "Plushie Problem", "Defeat 1,000 enemies.", "combat", 1000, (c) => c.life.kills, { gems: 50 }),
 *   ];
 *
 * `value(c)` returns the current progress; the achievement completes when it
 * reaches `target`. The context `c.life` already includes the run being
 * evaluated: during a run (in-run toasts) it is the lifetime counters plus
 * the live RunStats; after a run it is the updated lifetime.
 */
import type { RunStats } from "../../game/run-config";
import type { MetaContent } from "../content";
import type { Lifetime, Profile } from "../profile";

export type AchievementCategory = "story" | "combat" | "heroes" | "weapons" | "gacha" | "silly";
export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = ["story", "combat", "heroes", "weapons", "gacha", "silly"];

export const CATEGORY_NAMES: Readonly<Record<AchievementCategory, string>> = {
  story: "Story",
  combat: "Combat",
  heroes: "Heroes",
  weapons: "Weapons",
  gacha: "Gacha",
  silly: "Silly",
};

export interface AchievementReward {
  gems?: number;
  coins?: number;
  /** Content id unlocked when the achievement completes (hero / weapon / passive / stage / twist / relic). */
  unlock?: string;
  /** Title shown on the profile card (the achievement id is the title id). */
  title?: string;
}

export interface AchCtx {
  p: Profile;
  /** Lifetime counters including the run being evaluated (see file header). */
  life: Lifetime;
  /** The run (live during a run, final after it), null outside runs (gacha, boot). */
  run: RunStats | null;
  /** The run is over (death / clear known). */
  ended: boolean;
  ctx: MetaContent;
  /** Clears of a stage including the live run. */
  clears(stage: string): number;
  /** Best heat cleared on any stage including the live run (-1 = none). */
  bestHeat(): number;
  /** Best endless time on any stage including the live run. */
  bestEndless(): number;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  category: AchievementCategory;
  /** Shown as "???" until done. */
  hidden?: boolean;
  icon?: string;
  target: number;
  value(c: AchCtx): number;
  reward: AchievementReward;
}
