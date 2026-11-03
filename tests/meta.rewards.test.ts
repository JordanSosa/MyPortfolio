/**
 * applyRunToProfile -> RunReport: payout lines, counters and records, first
 * clears / boss first kills / heat badges paid once, hero XP, mastery (on the
 * base weapon), codex bounties, rotation, unlocks, achievements, "you can
 * afford something", plus a headless run of the live World banked end to end.
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { World } from "../src/game/world";
import { gameContent } from "../src/meta/content";
import { buildRunConfig } from "../src/meta/loadout";
import { defaultProfile, sanitizeProfile } from "../src/meta/profile";
import { reconcileProfile } from "../src/meta/reconcile";
import { applyRunToProfile, statsFromLegacySummary } from "../src/meta/rewards";
import { TUNING } from "../src/meta/tuning";
import { fixtureContent, freshProfile, runStats } from "./meta.fixtures";

const ctx = fixtureContent();

describe("applyRunToProfile", () => {
  test("a first death: payout banked line by line, counters, records, hero XP, mastery, codex, affordable", () => {
    const p = freshProfile(ctx);
    const r = applyRunToProfile(p, { stats: runStats({ damageByWeapon: { star_shot: 15000, galaxy_barrage: 5000, supernova_shower: 9999 }, killsByWeapon: { star_shot: 200, galaxy_barrage: 50 }, evolutions: ["galaxy_barrage"], passivesUsed: ["wish_charm"] }) }, ctx, { now: 123 });
    expect(r.episode).toBe(1);
    expect(r.outcome).toBe("death");
    expect(r.coins.lines.reduce((a, l) => a + l.amount, 0)).toBe(r.coins.total);
    expect(r.gems.lines.reduce((a, l) => a + l.amount, 0)).toBe(r.gems.total);
    expect(p.currencies.coins).toBe(r.coins.total);
    expect(p.currencies.gems).toBe(r.gems.total);
    expect(r.balances).toEqual(p.currencies);
    expect(p.lifetime).toMatchObject({ runs: 1, deaths: 1, clears: 0, kills: 250, evolutions: 1, coinsEarned: r.coins.total });
    expect(p.lifetime.damageByWeapon).toEqual({ star_shot: 20000, supernova_shower: 9999 });
    expect(p.records.dream_meadow).toMatchObject({ runs: 1, clears: 0, bestTime: 150, bestKills: 250 });
    expect(r.records.newBestTime).toBe(true);
    expect(r.heroXp.after.level).toBeGreaterThan(1);
    // mastery: the evolution feeds its base weapon; ultimates are not weapons
    expect(r.mastery.map((m) => m.weapon)).toEqual(["star_shot"]);
    expect(p.mastery.star_shot).toBe(Math.floor(20000 * TUNING.mastery.xpPerDamage));
    // codex: hero, stage, enemies, weapon, its evolution, passive (with a gems line)
    expect(r.codex.map((c) => c.id).sort()).toEqual(["boo", "dream_meadow", "galaxy_barrage", "hoshi", "puff", "star_shot", "wish_charm"]);
    expect(r.gems.lines.at(-1)!.id).toBe("codex");
    expect(r.achievements.map((a) => a.def.id)).toContain("pilot_episode");
    expect(r.affordable.boardNodes).toBeGreaterThan(0);
    expect(p.info.lastPlayed).toBe(123);
    // the banked profile is still a valid profile
    expect(sanitizeProfile(JSON.parse(JSON.stringify(p)), 0).repaired).toBe(false);
  });

  test("first clear, boss first kills and heat badges pay once; records and rotation advance", () => {
    const p = freshProfile(ctx);
    p.unlocks.twists.push("budget_cuts");
    const clear = runStats({ stageCleared: true, outcome: "victory", time: 610, heat: 5, bossKills: ["king_puff", "nightmare_teddy", "lady_lunatic"], killsByEnemy: { puff: 3000 } });
    const r1 = applyRunToProfile(p, { stats: clear }, ctx);
    expect(r1.outcome).toBe("clear");
    expect(r1.records.firstClear).toBe(true);
    expect(r1.records.heatBadges).toEqual([4]);
    expect(r1.firstBossKills).toEqual(["king_puff", "nightmare_teddy", "lady_lunatic"]);
    expect(r1.gems.lines.map((l) => l.id)).toEqual(expect.arrayContaining(["firstClear", "firstKill:king_puff", "firstKill:lady_lunatic", "badge:4"]));
    expect(p.records.dream_meadow).toMatchObject({ clears: 1, bestHeat: 5, firstClear: 1 });
    expect(p.lifetime.bossHeat.dream_meadow).toEqual({ king_puff: 5, nightmare_teddy: 5, lady_lunatic: 5 });
    expect(p.lifetime.heroesCleared).toEqual(["hoshi"]);
    // unlocks from the clear (Pudding, stage 2, Plot Twists) and from King Puff (Rin)
    expect(r1.unlocks.map((u) => u.id)).toEqual(expect.arrayContaining(["rin", "pudding", "candy_kingdom"]));
    const r2 = applyRunToProfile(p, { stats: clear }, ctx);
    expect(r2.records.firstClear).toBe(false);
    expect(r2.firstBossKills).toEqual([]);
    expect(r2.records.heatBadges).toEqual([]);
    expect(r2.gems.lines.map((l) => l.id)).not.toContain("firstClear");
    expect(r2.gems.total).toBeLessThan(r1.gems.total);
    const r3 = applyRunToProfile(p, { stats: { ...clear, heat: 9 } }, ctx);
    expect(r3.records.heatBadges).toEqual([8]);
    expect(r3.records.newBestHeat).toBe(true);
    expect(r3.banner.rotated).toBe(true);
    expect(r3.banner.runsLeft).toBe(TUNING.rotation.runsPerBanner);
    expect(p.rotation.cycle).toBe(1);
  });

  test("auto-claim (simulator) pays achievement gems in the same step", () => {
    const p = freshProfile(ctx);
    const r = applyRunToProfile(p, { stats: runStats() }, ctx, { autoClaim: true });
    expect(r.claimed.count).toBe(r.achievements.length);
    expect(p.currencies.gems).toBe(r.gems.total + r.claimed.gems);
  });

  test("v1-shaped summaries (no RunStats) still bank", () => {
    const p = freshProfile(ctx);
    const stats = statsFromLegacySummary({ hero: "hoshi", time: 200, level: 15, kills: 400, maxCombo: 60, coins: 20, victory: false, damageTaken: 90, weapons: [{ id: "star_shot", damage: 30000, kills: 400 }] });
    const r = applyRunToProfile(p, { stats }, ctx);
    expect(r.kills).toBe(400);
    expect(p.mastery.star_shot).toBeGreaterThan(0);
  });

  test("integration: a headless bot run of the live World, built from the account and banked", () => {
    const live = gameContent();
    const p = defaultProfile(0);
    reconcileProfile(p, live);
    const plan = buildRunConfig(p, {}, live);
    const w = new World({ hero: plan.hero, seed: 21, run: plan.config });
    simulate(w, 90, 1 / 30, new Bot(5));
    const report = applyRunToProfile(p, w.summary(), live);
    expect(report.time).toBeGreaterThan(30);
    expect(report.kills).toBeGreaterThan(20);
    expect(report.coins.total).toBeGreaterThan(0);
    expect(report.mastery.length).toBeGreaterThan(0);
    expect(p.codex.enemies.length).toBeGreaterThan(0);
    expect(p.lifetime.runs).toBe(1);
  });
});
