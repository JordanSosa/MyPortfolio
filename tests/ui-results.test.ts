/**
 * QA2 batch B (B6): leaving Episode Results (or a TBC RETRY) claims the Plot Point rewards for the player
 * whenever a completed, unclaimed one pays gems or coins - the Pilot Episode's gems pay the first pull even
 * without CLAIM ALL - and never otherwise.
 */
import { describe, expect, test } from "vitest";
import { claimAllAchievements } from "../src/meta/achievements/engine";
import { ACHIEVEMENT_LIST } from "../src/meta/achievements/registry";
import { defaultProfile } from "../src/meta/profile";
import { cashClaimable } from "../src/ui/screens/results";

describe("cashClaimable (auto-claim on leaving Results)", () => {
  test("a fresh profile has nothing to claim", () => {
    expect(cashClaimable(defaultProfile(0))).toBe(false);
  });

  test("the Pilot Episode done and unclaimed pays gems: claim; once claimed: nothing left", () => {
    const p = defaultProfile(0);
    p.achievements.done.pilot_episode = 1;
    expect(cashClaimable(p)).toBe(true);
    const gems = p.currencies.gems;
    const r = claimAllAchievements(p);
    expect(r.gems).toBeGreaterThan(0);
    expect(p.currencies.gems).toBe(gems + r.gems);
    expect(cashClaimable(p)).toBe(false);
  });

  test("Plot Points without a gem / coin reward (or unknown ids) never trigger the auto-claim", () => {
    const p = defaultProfile(0);
    p.achievements.done.not_a_plot_point = 1;
    const noCash = ACHIEVEMENT_LIST.find((a) => !a.reward.gems && !a.reward.coins);
    if (noCash) p.achievements.done[noCash.id] = 1;
    expect(cashClaimable(p)).toBe(false);
  });
});
