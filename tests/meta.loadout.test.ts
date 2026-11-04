/**
 * Loadout -> RunConfig: validation (locked stage / hero / twist, relic slots,
 * ownership), every progression track combined into the RunConfig, and an
 * integration check that the live World runs the config the account builds.
 */
import { CFG } from "../src/game/config";
import { describe, expect, test } from "vitest";
import { simulate } from "../src/debug/bot";
import { baseStats } from "../src/game/stats";
import { World } from "../src/game/world";
import { gameContent } from "../src/meta/content";
import { heroXpForLevel, masteryDamage } from "../src/meta/economy";
import { addHeroXp } from "../src/meta/heroes";
import { buildRunConfig, relicSlots, resolveLoadout, setLoadout, twistHeat, validateLoadout } from "../src/meta/loadout";
import { defaultProfile, sanitizeProfile } from "../src/meta/profile";
import { reconcileProfile } from "../src/meta/reconcile";
import { TUNING } from "../src/meta/tuning";
import { fixtureContent, freshProfile } from "./meta.fixtures";

const ctx = fixtureContent();
const cleared = (p: ReturnType<typeof freshProfile>, stage = "dream_meadow") => {
  p.records[stage] = { runs: 1, clears: 1, bestTime: 600, bestHeat: 0, bestEndless: 0, bestKills: 0, bestLevel: 0, bestCombo: 0, firstClear: 1 };
  p.lifetime.clears = Math.max(1, p.lifetime.clears);
};

describe("validation", () => {
  test("a fresh account's default loadout is valid", () => {
    expect(validateLoadout(freshProfile(ctx), {}, ctx)).toEqual([]);
  });

  test("locked / unknown hero and stage fall back with an issue each", () => {
    const p = freshProfile(ctx);
    const r = resolveLoadout(p, { hero: "rin", stage: "candy_kingdom" }, ctx);
    expect(r.issues).toEqual([
      { field: "hero", id: "rin", reason: "locked" },
      { field: "stage", id: "candy_kingdom", reason: "locked" },
    ]);
    expect(r.loadout).toMatchObject({ hero: "hoshi", stage: "dream_meadow" });
    expect(resolveLoadout(p, { hero: "goku", stage: "namek" }, ctx).issues.map((i) => i.reason)).toEqual(["unknown", "unknown"]);
  });

  test("relics: owned only, no duplicates, limited by relic slots (1 + board + unlocks, max 4)", () => {
    const p = freshProfile(ctx);
    p.relics = { bent_spoon: 3, golden_mic: 0, figure: 1 };
    expect(relicSlots(p)).toBe(1);
    const r = resolveLoadout(p, { relics: ["bent_spoon", "bent_spoon", "golden_mic", "poster", "zzz"] }, ctx);
    expect(r.loadout.relics).toEqual(["bent_spoon"]);
    expect(r.issues.map((i) => `${i.id}:${i.reason}`)).toEqual(["bent_spoon:duplicate", "golden_mic:slots", "poster:notOwned", "zzz:unknown"]);
    p.board.ranks = { relic_slot_1: 1, relic_slot_2: 1, relic_slot_3: 1 };
    p.unlocks.relicSlots = 3;
    expect(relicSlots(p)).toBe(TUNING.relics.maxSlots);
    expect(resolveLoadout(p, { relics: ["bent_spoon", "golden_mic", "figure"] }, ctx).issues).toEqual([]);
  });

  test("Plot Twists and endless need a cleared stage; ranks are clamped; heat sums the first r entries", () => {
    const p = freshProfile(ctx);
    p.unlocks.twists.push("budget_cuts", "censored");
    let r = resolveLoadout(p, { twists: { budget_cuts: 2 }, endless: true }, ctx);
    expect(r.issues.map((i) => `${i.field}:${i.reason}`)).toEqual(["twists:notCleared", "endless:notCleared"]);
    cleared(p);
    r = resolveLoadout(p, { twists: { budget_cuts: 9, censored: 1, dub_version: 1, ghost: 1 }, endless: true }, ctx);
    expect(r.loadout.twists).toEqual({ budget_cuts: 3, censored: 1 });
    expect(r.loadout.endless).toBe(true);
    expect(r.issues.map((i) => `${i.id}:${i.reason}`)).toEqual(["budget_cuts:rank", "dub_version:locked", "ghost:unknown"]);
    expect(twistHeat({ budget_cuts: 3, censored: 1 }, ctx)).toBe(1 + 2 + 2 + 2);
    expect(setLoadout(p, { twists: { censored: 1 } }, ctx)).toEqual([]);
    expect(p.loadout.twists).toEqual({ censored: 1 });
  });

  test("visiting an uncleared episode keeps the saved Plot Twists and Filler Arc (the run there is heat 0)", () => {
    const p = freshProfile(ctx);
    p.unlocks.twists.push("budget_cuts", "censored");
    p.unlocks.stages.push("candy_kingdom");
    cleared(p);
    setLoadout(p, { stage: "dream_meadow", twists: { budget_cuts: 3, censored: 1 }, endless: true }, ctx);
    const saved = { twists: { ...p.loadout.twists }, endless: p.loadout.endless };
    expect(saved).toEqual({ twists: { budget_cuts: 3, censored: 1 }, endless: true });
    // tap Candy Kingdom (not cleared): the issues are reported, the choice is kept
    const issues = setLoadout(p, { stage: "candy_kingdom" }, ctx);
    expect(issues.map((i) => `${i.field}:${i.reason}`).sort()).toEqual(["endless:notCleared", "twists:notCleared", "twists:notCleared"]);
    expect(p.loadout.stage).toBe("candy_kingdom");
    expect({ twists: p.loadout.twists, endless: p.loadout.endless }).toEqual(saved);
    // ... but the run there has no heat and no Filler Arc, and the UI's plan shows none
    const plan = buildRunConfig(p, {}, ctx);
    expect(plan.heat).toBe(0);
    expect(plan.config.twists).toEqual([]);
    expect(plan.config.endless).toBe(false);
    expect(plan.loadout.twists).toEqual({});
    // a reload (sanitise + reconcile) keeps it too, and counts no loadout fix for it
    const re = sanitizeProfile(JSON.parse(JSON.stringify(p)), 0).profile;
    expect(re.loadout).toEqual(p.loadout);
    expect(reconcileProfile(re, ctx).loadoutFixes).toBe(0);
    expect(re.loadout).toEqual(p.loadout);
    // back on Dream Meadow: the heat setup is still there
    setLoadout(p, { stage: "dream_meadow" }, ctx);
    expect({ twists: p.loadout.twists, endless: p.loadout.endless }).toEqual(saved);
    expect(buildRunConfig(p, {}, ctx).heat).toBe(twistHeat(saved.twists, ctx));
  });

  test("real repairs still persist on an uncleared stage: unknown / locked twists dropped, ranks clamped", () => {
    const p = freshProfile(ctx);
    p.unlocks.twists.push("budget_cuts");
    setLoadout(p, { twists: { budget_cuts: 9, dub_version: 1, ghost: 2 }, endless: false }, ctx);
    expect(p.loadout.twists).toEqual({ budget_cuts: 3 });
  });
});

describe("RunConfig", () => {
  test("fresh account: Dream Meadow, no account mods, unlocked pools, 6 / 6 slots", () => {
    const plan = buildRunConfig(freshProfile(ctx), {}, ctx);
    expect(plan.hero).toBe("hoshi");
    expect(plan.config).toMatchObject({ stage: "dream_meadow", endless: false, twists: [], mods: [], relics: [], talents: {}, constellation: 0, weaponSlots: 6, passiveSlots: 6, flags: {}, start: { level: 1, weapons: [] } });
    expect(plan.config.weaponPool).toEqual(expect.arrayContaining(["star_shot", "petal_slash"]));
    expect(plan.config.weaponPool).not.toContain("bubble_tea_cannon");
    expect(plan.config.weaponPool).not.toContain("galaxy_barrage");
    expect(plan.config.passivePool).toEqual(["power_bow", "wish_charm"]);
    expect(plan.issues).toEqual([]);
  });

  test("every track feeds the config: board, hero level, talents, constellation, mastery, relic stars, twists, flags, start bonuses", () => {
    const p = freshProfile(ctx);
    cleared(p);
    p.unlocks.twists.push("budget_cuts");
    p.board.ranks = { might_1: 2, weapon_slot: 1, passive_slot: 1, relic_slot_1: 1, head_start: 1, start_level_1: 1, ultstart_1: 1, banish_1: 2 };
    addHeroXp(p, "hoshi", heroXpForLevel(11));
    p.heroes.hoshi.talents = { h0_1: 3, h0_5: 1 }; // the capstone is not reachable: dropped
    p.heroes.hoshi.constellation = 4;
    p.mastery = { star_shot: TUNING.mastery.thresholds[5], petal_slash: TUNING.mastery.thresholds[9], unknown_gun: 1e9 };
    p.relics = { bent_spoon: 4, golden_mic: 0 };
    const plan = buildRunConfig(p, { relics: ["bent_spoon", "golden_mic"], twists: { budget_cuts: 2 }, startWeapon: "petal_slash" }, ctx);
    const c = plan.config;
    expect(plan.issues).toEqual([]);
    expect(c.mods.length).toBe(2);
    const s = baseStats();
    for (const m of c.mods) m(s);
    expect(s.might).toBeCloseTo(1 + 0.08 + 0.1);
    expect(s.maxHp).toBeCloseTo(CFG.playerHp * 1.1);
    expect(c.talents).toEqual({ h0_1: 3 });
    expect(c.constellation).toBe(4);
    expect(c.weaponDamage).toEqual({ star_shot: masteryDamage(6), petal_slash: masteryDamage(10) });
    expect(c.weaponLevelBonus).toEqual({ star_shot: 1, petal_slash: 2 });
    expect(c.relics).toEqual([
      { id: "bent_spoon", stars: 4 },
      { id: "golden_mic", stars: 0 },
    ]);
    expect(c.twists).toEqual(["budget_cuts"]);
    expect(c.twistRanks).toEqual({ budget_cuts: 2 });
    expect(plan.heat).toBe(3);
    expect(c.weaponSlots).toBe(7);
    expect(c.passiveSlots).toBe(7);
    expect(c.start).toEqual({ level: 3, weapons: [{ id: "petal_slash", level: 2 }] });
    expect(c.flags).toEqual({ ultStart: 0.1, banish: 2 });
  });

  test("integration: the live World runs the account's RunConfig", () => {
    const live = gameContent();
    const p = defaultProfile(0);
    reconcileProfile(p, live);
    p.currencies.coins = 1e6;
    p.board.ranks = { might_1: 3, hp_1: 2, head_start: 1, weapon_slot: 1 };
    const plan = buildRunConfig(p, {}, live);
    const w = new World({ hero: plan.hero, seed: 4, run: plan.config });
    expect(w.stats.might).toBeGreaterThan(1.1);
    simulate(w, 20);
    expect(w.t).toBeGreaterThan(19);
    const sum = w.summary();
    expect(sum.stats.stage).toBe(plan.config.stage);
    expect(sum.stats.hero).toBe(plan.hero);
  });
});
