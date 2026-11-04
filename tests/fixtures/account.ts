// An early account (about the P3 checkpoint's Training Arc: ring 1 + most of ring 2, tools/checkpoints.ts) as plain
// stat mods, for tests that need a REAL 3-4 minute run: since the Season 2 retune a no-account run is meant to die
// around 2:30-4:00 (docs/ARCHITECTURE.md section 6), and the later heroes (Akane, Senpai...) earlier than that.
import { defaultRunConfig, type RunConfig } from "../../src/game/run-config";
import type { StatMod } from "../../src/game/stats";

export const EARLY_ACCOUNT: StatMod = (s) => {
  // (verification pass: Dream Meadow got tougher - tier x1.45 - so the fixture moved up to the P3 checkpoint's
  // board numbers it describes: might x1.46, 2 armor)
  s.might += 0.45;
  s.crit += 0.06;
  s.maxHp += 70;
  s.armor += 2;
  s.regen += 0.5;
  s.moveSpeed += 0.2;
  s.growth += 0.2;
};

/** defaultRunConfig with the early-account mods on top. */
export function earlyAccountRun(over: Partial<RunConfig> = {}): RunConfig {
  return defaultRunConfig({ ...over, mods: [EARLY_ACCOUNT, ...(over.mods ?? [])] });
}
