/** Small constructors for achievement definition files. */
import type { AchCtx, AchievementCategory, AchievementDef, AchievementReward } from "./types";

/** Generic: progress = value(c), done at target. */
export function counter(
  id: string,
  name: string,
  desc: string,
  category: AchievementCategory,
  target: number,
  value: (c: AchCtx) => number,
  reward: AchievementReward,
  opts: { hidden?: boolean; icon?: string } = {},
): AchievementDef {
  return { id, name, desc, category, target, value, reward, ...opts };
}

/** Yes / no feat (target 1). */
export function feat(
  id: string,
  name: string,
  desc: string,
  category: AchievementCategory,
  test: (c: AchCtx) => boolean,
  reward: AchievementReward,
  opts: { hidden?: boolean; icon?: string } = {},
): AchievementDef {
  return { id, name, desc, category, target: 1, value: (c) => (test(c) ? 1 : 0), reward, ...opts };
}

/** Clear a stage (by id) at least once. */
export function stageClear(id: string, stage: string, name: string, desc: string, reward: AchievementReward): AchievementDef {
  return { id, name, desc, category: "story", target: 1, value: (c) => Math.min(1, c.clears(stage)), reward };
}

/**
 * Clear the stage with this map order (1 = Dream Meadow ... 5 = The Final Arc).
 * Resolved through the content catalogue, so it works before the stage's
 * file lands (it simply can't complete yet).
 */
export function stageClearByOrder(id: string, order: number, name: string, desc: string, reward: AchievementReward): AchievementDef {
  return {
    id,
    name,
    desc,
    category: "story",
    target: 1,
    value: (c) => {
      const st = c.ctx.stages.find((s) => s.order === order);
      return st ? Math.min(1, c.clears(st.id)) : 0;
    },
    reward,
  };
}
