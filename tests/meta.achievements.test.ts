/**
 * Plot Points (achievements) and unlock rules: the registry, evaluation after
 * runs / pulls, explicit claims, the in-run watcher used for toasts, hidden
 * entries, and every unlock condition kind with its codex hint.
 */
import { describe, expect, test } from "vitest";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_LIST,
  ACHIEVEMENTS,
  AchievementWatch,
  achievementViews,
  claimAchievement,
  claimAllAchievements,
  evaluateAchievements,
  lifetimeWithRun,
  unclaimedCount,
} from "../src/meta/achievements";
import { applyRunToProfile } from "../src/meta/rewards";
import { evaluateUnlocks, unlockRule, unlockStatus, UNLOCK_RULES } from "../src/meta/unlocks";
import { fixtureContent, freshProfile, runStats } from "./meta.fixtures";

const ctx = fixtureContent();

describe("achievement registry", () => {
  test("~40+ core achievements across every category, unique ids, sane targets and rewards", () => {
    expect(ACHIEVEMENT_LIST.length).toBeGreaterThanOrEqual(40);
    expect(ACHIEVEMENTS.size).toBe(ACHIEVEMENT_LIST.length);
    for (const c of ACHIEVEMENT_CATEGORIES) expect(ACHIEVEMENT_LIST.filter((a) => a.category === c).length, c).toBeGreaterThanOrEqual(5);
    for (const a of ACHIEVEMENT_LIST) {
      expect(a.target).toBeGreaterThan(0);
      expect(a.name.length).toBeGreaterThan(2);
      expect(a.desc.length).toBeGreaterThan(5);
      expect((a.reward.gems ?? 0) + (a.reward.coins ?? 0) > 0 || !!a.reward.unlock || !!a.reward.title).toBe(true);
    }
    // the spec's named examples
    for (const id of ["gacha_hell", "mythic", "speedrun", "pacifist"]) expect(ACHIEVEMENTS.has(id)).toBe(true);
  });

  test("a fresh profile has nothing done and evaluating it completes nothing", () => {
    const p = freshProfile(ctx);
    expect(evaluateAchievements(p, null, ctx)).toEqual([]);
    expect(unclaimedCount(p)).toBe(0);
  });
});

describe("evaluation + claims", () => {
  test("after a run: completions recorded, rewards claimed once, titles granted", () => {
    const p = freshProfile(ctx);
    const r = applyRunToProfile(p, { stats: runStats({ killsByEnemy: { puff: 1200 }, time: 300, maxCombo: 120 }) }, ctx);
    const ids = r.achievements.map((a) => a.def.id);
    expect(ids).toEqual(expect.arrayContaining(["pilot_episode", "kills_1k", "combo_100"]));
    expect(ids).not.toContain("kills_10k");
    expect(p.achievements.done.pilot_episode).toBe(1);
    expect(p.achievements.progress.kills_10k).toBe(1200);
    const gems = p.currencies.gems;
    const c = claimAchievement(p, "pilot_episode");
    expect(c.ok).toBe(true);
    expect(p.currencies.gems).toBe(gems + (ACHIEVEMENTS.get("pilot_episode")!.reward.gems ?? 0));
    expect(claimAchievement(p, "pilot_episode").reason).toBe("claimed");
    expect(claimAchievement(p, "kills_10k").reason).toBe("notDone");
    expect(claimAchievement(p, "nope").reason).toBe("unknown");
    const all = claimAllAchievements(p);
    expect(all.count).toBe(ids.length - 1);
    expect(unclaimedCount(p)).toBe(0);
    // a title reward
    p.records.dream_meadow.clears = 1;
    const done = evaluateAchievements(p, null, ctx).map((a) => a.def.id);
    expect(done).toContain("clear_stage_1");
    expect(p.titles.owned).toContain("clear_stage_1");
  });

  test("speedrun counts a death within 10 s, never a quit", () => {
    const quit = freshProfile(ctx);
    applyRunToProfile(quit, { stats: runStats({ time: 5, outcome: "quit", killsByEnemy: {} }) }, ctx);
    expect("speedrun" in quit.achievements.done).toBe(false);
    const died = freshProfile(ctx);
    applyRunToProfile(died, { stats: runStats({ time: 8, outcome: "dead", killsByEnemy: {} }) }, ctx);
    expect("speedrun" in died.achievements.done).toBe(true);
  });

  test("gacha achievements evaluate outside runs", () => {
    const p = freshProfile(ctx);
    p.gacha.stats.pulls = 1;
    p.gacha.stats.nStreakBest = 10;
    p.gacha.stats.byRarity.MYTHIC = 1;
    const ids = evaluateAchievements(p, null, ctx).map((a) => a.def.id);
    expect(ids).toEqual(expect.arrayContaining(["first_pull", "gacha_hell", "mythic"]));
  });

  test("hidden achievements read ??? until done", () => {
    const p = freshProfile(ctx);
    const v = achievementViews(p, ctx).find((a) => a.def.id === "mythic")!;
    expect(v).toMatchObject({ secret: true, name: "???", done: false });
    p.gacha.stats.byRarity.MYTHIC = 1;
    evaluateAchievements(p, null, ctx);
    expect(achievementViews(p, ctx, "gacha").find((a) => a.def.id === "mythic")).toMatchObject({ secret: false, name: "Whale-Sized Luck", done: true, claimed: false });
  });
});

describe("in-run watcher (toasts)", () => {
  test("reports each completion once as the live run crosses it, never touching the profile", () => {
    const p = freshProfile(ctx);
    p.lifetime.kills = 900;
    const before = JSON.stringify(p);
    const w = new AchievementWatch(p, ctx);
    expect(w.poll(runStats({ killsByEnemy: { puff: 50 }, maxCombo: 20 })).map((a) => a.id)).toEqual([]);
    expect(w.poll(runStats({ killsByEnemy: { puff: 150 }, maxCombo: 20 })).map((a) => a.id)).toEqual(["kills_1k"]);
    expect(w.poll(runStats({ killsByEnemy: { puff: 400 }, maxCombo: 130 })).map((a) => a.id)).toEqual(["combo_100"]);
    expect(w.poll(runStats({ killsByEnemy: { puff: 500 }, maxCombo: 140 }))).toEqual([]);
    expect(w.toasted.sort()).toEqual(["combo_100", "kills_1k"]);
    expect(JSON.stringify(p)).toBe(before);
    // end-of-run events (deaths, clears of other stages) are not toasted mid-run
    const L = lifetimeWithRun(p.lifetime, runStats({ killsByEnemy: { puff: 10, boo: 5 }, bossKills: ["king_puff"] }), ctx);
    expect(L.kills).toBe(915);
    expect(L.bossKills.king_puff).toBe(1);
    expect(L.runs).toBe(0); // the run counts when it is banked
  });
});

describe("unlock rules", () => {
  test("hero rules: Rin (King Puff), Mochi (3,000 kills), Kuro (6:00 in Dream Meadow), Pudding (clear); gacha heroes never by rules", () => {
    const p = freshProfile(ctx);
    expect(evaluateUnlocks(p, ctx).map((e) => e.id)).not.toContain("rin");
    p.lifetime.bossKills.king_puff = 1;
    p.lifetime.kills = 3000;
    p.records.dream_meadow = { runs: 3, clears: 0, bestTime: 361, bestHeat: -1, bestEndless: 0, bestKills: 0, bestLevel: 0, bestCombo: 0, firstClear: 0 };
    const ev = evaluateUnlocks(p, ctx);
    expect(ev.map((e) => `${e.kind}:${e.id}`)).toEqual(expect.arrayContaining(["hero:rin", "hero:mochi", "hero:kuro", "weapon:dark_flame_dragon"]));
    expect(ev.find((e) => e.id === "rin")!.hint).toBe("Defeat King Puff.");
    expect(p.unlocks.heroes).not.toContain("pudding");
    p.records.dream_meadow.clears = 1;
    p.lifetime.clears = 1;
    const ev2 = evaluateUnlocks(p, ctx).map((e) => e.id);
    expect(ev2).toEqual(expect.arrayContaining(["pudding", "teapot_tempest", "candy_kingdom", "budget_cuts", "censored"]));
    expect(p.unlocks.twists).not.toContain("dub_version"); // opens with the Candy Kingdom clear
    expect(p.unlocks.heroes).not.toContain("senpai");
    expect(evaluateUnlocks(p, ctx)).toEqual([]); // idempotent
  });

  test("weapon / passive rules with progress for the codex hint", () => {
    const p = freshProfile(ctx);
    p.lifetime.killsByEnemy.puff = 412;
    const st = unlockStatus(p, "weapon", "bubble_tea_cannon", ctx);
    expect(st).toMatchObject({ unlocked: false, value: 412, target: 1000 });
    expect(st.rule.hint).toBe("Puffs are chewy. Squish a thousand of them.");
    p.lifetime.noDashBest = 200;
    expect(evaluateUnlocks(p, ctx).map((e) => e.id)).toContain("kotatsu_of_sloth");
    expect(unlockRule("passive", "plot_armor", ctx).cond).toEqual({ t: "life", key: "damageTaken", count: 5000 });
    // the content bible's canonical rules (docs/content/achievements.md §1)
    expect(unlockRule("passive", "main_character_aura", ctx).cond).toEqual({ t: "life", key: "maxRank", count: 3 });
    expect(unlockRule("passive", "inner_monologue", ctx).cond).toEqual({ t: "life", key: "ults", count: 25 });
    expect(unlockRule("passive", "training_montage", ctx).cond).toEqual({ t: "life", key: "bestLevel", count: 25 });
    expect(unlockRule("twist", "spoilers", ctx).cond).toEqual({ t: "stageClear", order: 2 });
    // content without a rule is free; stages need the previous clear
    expect(unlockRule("weapon", "mystery_weapon", ctx).cond.t).toBe("start");
    expect(unlockRule("stage", "shoujo_academy", ctx)).toMatchObject({ cond: { t: "stageClear", order: 2 }, hint: "Clear candy kingdom." });
    expect(unlockRule("hero", "truck_kun", ctx).cond.t).toBe("gacha");
    const ids = UNLOCK_RULES.map((r) => `${r.kind}:${r.id}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
