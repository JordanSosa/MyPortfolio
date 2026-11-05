/**
 * Hero progression: XP -> levels -> talent points, tier gating
 * (TALENT_TIER_POINTS), `requires`, refunds that never break other talents,
 * coin respec, the level accelerator, repairs, constellations.
 */
import { describe, expect, test } from "vitest";
import { TALENT_TIER_POINTS } from "../src/game/defs";
import { heroXpForLevel, talentRespecCost } from "../src/meta/economy";
import {
  addHeroCopy,
  addHeroXp,
  allocateTalent,
  buyHeroLevel,
  canAllocate,
  heroProgress,
  heroView,
  refundTalent,
  repairTalents,
  resetTalents,
  talentPoints,
  talentsValid,
} from "../src/meta/heroes";
import { TUNING } from "../src/meta/tuning";
import { fixtureContent, freshProfile, HOSHI_TREE } from "./meta.fixtures";

const ctx = fixtureContent();

describe("hero levels", () => {
  test("XP levels the hero up and grants one talent point per level", () => {
    const p = freshProfile(ctx);
    const g = addHeroXp(p, "hoshi", heroXpForLevel(5) + 3);
    expect(g.before.level).toBe(1);
    expect(g.after.level).toBe(5);
    expect(g.levelUps).toEqual([2, 3, 4, 5]);
    expect(g.pointsGained).toBe(4);
    expect(talentPoints(heroProgress(p, "hoshi"))).toEqual({ total: 5, spent: 0, free: 5 });
    addHeroXp(p, "hoshi", 1e12);
    expect(heroProgress(p, "hoshi").level).toBe(TUNING.hero.maxLevel);
    expect(heroProgress(p, "hoshi").xp).toBe(heroXpForLevel(TUNING.hero.maxLevel));
    expect(heroView(p, "hoshi", ctx).level.maxed).toBe(true);
  });

  test("coins can buy the rest of a level (accelerator)", () => {
    const p = freshProfile(ctx);
    expect(buyHeroLevel(p, "hoshi")).toMatchObject({ ok: false, reason: "coins" });
    p.currencies.coins = 1e6;
    const r = buyHeroLevel(p, "hoshi");
    expect(r.ok).toBe(true);
    expect(r.level).toBe(2);
    expect(p.currencies.coins).toBe(1e6 - r.cost);
    expect(buyHeroLevel(p, "rin").reason).toBe("locked");
  });
});

describe("talents", () => {
  const leveled = (level: number) => {
    const p = freshProfile(ctx);
    addHeroXp(p, "hoshi", heroXpForLevel(level));
    return p;
  };

  test("tier T opens after TALENT_TIER_POINTS[T-1] points in the branch's lower tiers", () => {
    const p = leveled(30);
    expect(canAllocate(p, "hoshi", "h0_2", ctx)).toEqual({ ok: false, block: "tier" });
    for (let i = 0; i < TALENT_TIER_POINTS[1]; i++) expect(allocateTalent(p, "hoshi", "h0_1", ctx).ok).toBe(true);
    expect(canAllocate(p, "hoshi", "h0_2", ctx).ok).toBe(true);
    // points in another branch do not count
    expect(canAllocate(p, "hoshi", "h1_2", ctx).block).toBe("tier");
    // fill the branch up to the capstone gate
    while (allocateTalent(p, "hoshi", "h0_1", ctx).ok);
    while (allocateTalent(p, "hoshi", "h0_2", ctx).ok);
    while (allocateTalent(p, "hoshi", "h0_3", ctx).ok);
    expect(canAllocate(p, "hoshi", "h0_5", ctx).block).toBe("tier");
    while (allocateTalent(p, "hoshi", "h0_4", ctx).ok);
    expect(allocateTalent(p, "hoshi", "h0_5", ctx).ok).toBe(true);
    expect(canAllocate(p, "hoshi", "h0_5", ctx).block).toBe("maxed");
    expect(talentsValid(HOSHI_TREE, heroProgress(p, "hoshi").talents)).toBe(true);
  });

  test("no free points / unknown / locked hero are refused", () => {
    const p = leveled(1);
    expect(allocateTalent(p, "hoshi", "h0_1", ctx).ok).toBe(true);
    expect(canAllocate(p, "hoshi", "h0_1", ctx)).toEqual({ ok: false, block: "points" });
    expect(canAllocate(p, "hoshi", "nope", ctx).block).toBe("unknown");
    expect(canAllocate(p, "rin", "h0_1", ctx).block).toBe("unknown");
  });

  test("refunding a point that a higher tier relies on is refused; reset costs cheap coins", () => {
    const p = leveled(10);
    allocateTalent(p, "hoshi", "h0_1", ctx);
    allocateTalent(p, "hoshi", "h0_1", ctx);
    allocateTalent(p, "hoshi", "h0_2", ctx);
    expect(refundTalent(p, "hoshi", "h0_1", ctx)).toEqual({ ok: false, reason: "breaks" });
    expect(refundTalent(p, "hoshi", "h0_2", ctx).ok).toBe(true);
    expect(refundTalent(p, "hoshi", "h0_1", ctx).ok).toBe(true);
    allocateTalent(p, "hoshi", "h0_1", ctx);
    allocateTalent(p, "hoshi", "h0_1", ctx);
    expect(resetTalents(p, "hoshi")).toMatchObject({ ok: false, reason: "coins" });
    p.currencies.coins = 1000;
    const r = resetTalents(p, "hoshi");
    expect(r).toEqual({ ok: true, cost: talentRespecCost(3) });
    expect(heroProgress(p, "hoshi").talents).toEqual({});
    expect(resetTalents(p, "hoshi").reason).toBe("empty");
  });

  test("repair: unknown ids, over-rank, rule breaks and over-budget points are removed", () => {
    expect(repairTalents(HOSHI_TREE, { h0_1: 9, h0_5: 1, junk: 4 }, 30)).toEqual({ h0_1: 5 });
    const full = { h0_1: 5, h0_2: 3, h0_3: 3, h0_4: 3, h0_5: 1 };
    expect(repairTalents(HOSHI_TREE, full, 30)).toEqual(full);
    const cut = repairTalents(HOSHI_TREE, full, 6);
    expect(Object.values(cut).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(6);
    expect(talentsValid(HOSHI_TREE, cut)).toBe(true);
    expect(repairTalents(undefined, full, 30)).toEqual({});
  });
});

describe("constellations", () => {
  test("first copy unlocks, dupes add stars up to C6, then overflow", () => {
    const p = freshProfile(ctx);
    expect(addHeroCopy(p, "senpai")).toEqual({ result: "new", constellation: 0 });
    expect(p.unlocks.heroes).toContain("senpai");
    for (let c = 1; c <= 6; c++) expect(addHeroCopy(p, "senpai")).toEqual({ result: "constellation", constellation: c });
    expect(addHeroCopy(p, "senpai")).toEqual({ result: "copium", constellation: 6 });
  });
});
