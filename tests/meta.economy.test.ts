/**
 * Economy formulas: results grade, line-by-line payout (lines always add up to
 * the total, multipliers in order), first-clear / boss / heat-badge gems,
 * hero XP curve 1-30, weapon mastery ranks 0-10.
 */
import { describe, expect, test } from "vitest";
import {
  computePayout,
  gradeRun,
  heroLevelInfo,
  heroXpForLevel,
  heroXpForRun,
  heroXpToNext,
  masteryDamage,
  masteryInfo,
  masteryLevelBonus,
  masteryXpForDamage,
  newHeatBadges,
  type Payout,
} from "../src/meta/economy";
import { TUNING } from "../src/meta/tuning";
import { BOARD } from "../src/meta/board/graph";
import { runStats, STAGES } from "./meta.fixtures";

const DM = STAGES[0];
const CANDY = STAGES[1];

function sums(p: Payout): void {
  for (const part of [p.coins, p.gems]) {
    expect(part.lines.reduce((a, l) => a + l.amount, 0)).toBe(part.total);
    for (const l of part.lines) expect(Number.isInteger(l.amount)).toBe(true);
  }
}

describe("grade", () => {
  test("deaths grade by score, clears are A / S / SS", () => {
    expect(gradeRun(runStats({ time: 30, killsByEnemy: { puff: 40 }, level: 4, maxCombo: 10 }))).toBe("D");
    expect(gradeRun(runStats({ time: 150 }))).toBe("C");
    expect(gradeRun(runStats({ time: 420, killsByEnemy: { puff: 2500 }, level: 35, maxCombo: 200 }))).toBe("A");
    expect(gradeRun(runStats({ stageCleared: true, damageTaken: 400 }))).toBe("A");
    expect(gradeRun(runStats({ stageCleared: true, damageTaken: 120 }))).toBe("S");
    expect(gradeRun(runStats({ stageCleared: true, damageTaken: 20, maxRank: 5 }))).toBe("SS");
  });
});

describe("payout", () => {
  test("every line adds up; multipliers apply to the running total in order", () => {
    const s = runStats({ time: 600, stageCleared: true, bossKills: ["king_puff", "nightmare_teddy", "lady_lunatic"], eliteKills: 6, coins: 140, heat: 5, curse: 0.2, gemFind: 1.3, damageTaken: 300 });
    const p = computePayout({ stats: s, stage: DM, grade: gradeRun(s), firstClear: true, firstBossKills: ["lady_lunatic"], newHeatBadges: [4] });
    sums(p);
    const ids = p.coins.lines.map((l) => l.id);
    expect(ids.slice(0, 3)).toEqual(["picked", "time", "kills"]);
    expect(ids).toContain("clear");
    expect(ids.filter((i) => i.startsWith("boss:")).length).toBe(3);
    expect(ids.slice(-3)).toEqual(["grade", "heat", "curse"]);
    const heat = p.coins.lines.find((l) => l.id === "heat")!;
    expect(heat.mul).toBeCloseTo(1 + 5 * TUNING.payout.heatCoinPer);
    const gemIds = p.gems.lines.map((l) => l.id);
    expect(gemIds).toEqual(["trickle", "gemFind", "heat", "curse", "firstClear", "firstKill:lady_lunatic", "badge:4"]);
    expect(p.gems.lines.find((l) => l.id === "firstClear")!.amount).toBe(TUNING.payout.firstClearGems[0]);
    expect(p.gems.lines.find((l) => l.id === "firstKill:lady_lunatic")!.amount).toBe(TUNING.payout.finalBossFirstKillGems);
  });

  test("more heat / a richer stage / bosses pay more; nothing is negative", () => {
    const base = runStats({ time: 400 });
    const pay = (over: Partial<ReturnType<typeof runStats>>, stage = DM) => {
      const s = { ...base, ...over };
      return computePayout({ stats: s, stage, grade: gradeRun(s), firstClear: false, firstBossKills: [], newHeatBadges: [] });
    };
    const p0 = pay({});
    sums(p0);
    expect(pay({ heat: 8 }).coins.total).toBeGreaterThan(p0.coins.total);
    expect(pay({}, CANDY).coins.total).toBeGreaterThan(p0.coins.total);
    expect(pay({ bossKills: ["king_puff"] }).coins.total).toBeGreaterThan(p0.coins.total);
    const zero = pay({ time: 0, coins: 0, killsByEnemy: {}, eliteKills: 0 });
    sums(zero);
    expect(zero.coins.total).toBe(0);
    expect(zero.gems.total).toBe(TUNING.payout.gemsPerRun);
  });

  test("fail forward: a 2:30 first death pays for 2-4 cheap ring-1 board nodes (EXPANSION §2)", () => {
    const s = runStats({ time: 150, killsByEnemy: { puff: 900, boo: 100 }, coins: 8, level: 12, maxCombo: 35 });
    const p = computePayout({ stats: s, stage: DM, grade: gradeRun(s), firstClear: false, firstBossKills: [], newHeatBadges: [] });
    const ring1 = BOARD.nodes.filter((n) => n.ring === 1).map((n) => n.costs[0]).sort((a, b) => a - b);
    const cheap2 = ring1[0] + ring1[1];
    const cheap4 = ring1.slice(0, 4).reduce((a, b) => a + b, 0);
    expect(p.coins.total).toBeGreaterThanOrEqual(cheap2);
    expect(p.coins.total).toBeLessThanOrEqual(cheap4 * 1.6);
    expect(p.gems.total).toBeGreaterThan(0);
  });

  test("heat badges: each at most once per stage", () => {
    expect(newHeatBadges(9, -1)).toEqual([4, 8]);
    expect(newHeatBadges(9, 4)).toEqual([8]);
    expect(newHeatBadges(3, -1)).toEqual([]);
    expect(newHeatBadges(40, 32)).toEqual([]);
  });
});

describe("hero XP curve", () => {
  test("levels 1-30, strictly growing cost, consistent inverse", () => {
    const max = TUNING.hero.maxLevel;
    expect(max).toBe(30);
    for (let L = 1; L < max - 1; L++) expect(heroXpToNext(L + 1)).toBeGreaterThan(heroXpToNext(L));
    expect(heroXpToNext(max)).toBe(Infinity);
    for (const L of [1, 2, 5, 10, 17, 29, 30]) {
      const xp = heroXpForLevel(L);
      expect(heroLevelInfo(xp).level).toBe(L);
      if (L > 1) expect(heroLevelInfo(xp - 1).level).toBe(L - 1);
    }
    expect(heroLevelInfo(1e12)).toEqual({ level: 30, into: 0, need: Infinity, maxed: true });
  });

  test("a hero takes a long-term commitment to max (100+ full runs), but the first runs level up", () => {
    const fullRun = heroXpForRun(runStats({ time: 600, killsByEnemy: { puff: 3000 }, bossKills: ["a", "b", "c"], stageCleared: true }), DM);
    const firstRun = heroXpForRun(runStats(), DM);
    expect(heroLevelInfo(firstRun).level).toBeGreaterThanOrEqual(2);
    expect(heroXpForLevel(30) / fullRun).toBeGreaterThan(60);
    expect(heroXpForLevel(30) / fullRun).toBeLessThan(250);
  });
});

describe("weapon mastery", () => {
  test("ranks 0-10 from damage; Limit Break at 5 and 10; +3% damage per rank", () => {
    const T = TUNING.mastery.thresholds;
    expect(T.length).toBe(10);
    expect(masteryInfo(0).rank).toBe(0);
    expect(masteryInfo(T[0] - 1).rank).toBe(0);
    expect(masteryInfo(T[0]).rank).toBe(1);
    expect(masteryInfo(T[9]).maxed).toBe(true);
    expect(masteryInfo(T[9]).rank).toBe(10);
    expect([0, 4, 5, 9, 10].map(masteryLevelBonus)).toEqual([0, 0, 1, 1, 2]);
    expect(masteryDamage(5)).toBeCloseTo(0.15);
    expect(masteryXpForDamage(12345)).toBe(Math.floor(12345 * TUNING.mastery.xpPerDamage));
  });
});
