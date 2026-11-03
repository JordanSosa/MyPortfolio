/**
 * Seams between the three Season 2 layers, with the LIVE registries:
 *
 *   src/meta (profile -> buildRunConfig)  ->  src/game (World + bot)  ->  src/meta (applyRunToProfile)
 *
 * Each test pins one contract the layers must agree on: nothing from the
 * account is ignored or applied twice, the run reports what the payout reads,
 * and the "fail forward" loop (run -> bank -> buy -> stronger run) holds.
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { defaultRunConfig } from "../src/game/run-config";
import { baseWeaponOf, twistHeat as simTwistHeat, TWISTS, WEAPONS } from "../src/game/registry";
import { World } from "../src/game/world";
import { affordableNodes, buyNode } from "../src/meta/board/board";
import { gameContent } from "../src/meta/content";
import { computePayout, gradeRun, masteryDamage } from "../src/meta/economy";
import { buildRunConfig, twistHeat as metaTwistHeat } from "../src/meta/loadout";
import { defaultProfile, defaultStageRecord, type Profile } from "../src/meta/profile";
import { reconcileProfile } from "../src/meta/reconcile";
import { applyRunToProfile } from "../src/meta/rewards";
import { TUNING } from "../src/meta/tuning";
import { unlockRule } from "../src/meta/unlocks";

const ctx = gameContent();
const DT = 1 / 30;

function fresh(): Profile {
  const p = defaultProfile(0);
  reconcileProfile(p, ctx);
  return p;
}

function cleared(p: Profile, stage = "dream_meadow"): void {
  const r = (p.records[stage] ??= defaultStageRecord());
  r.runs = Math.max(1, r.runs);
  r.clears = Math.max(1, r.clears);
  p.lifetime.clears = Math.max(1, p.lifetime.clears);
  reconcileProfile(p, ctx);
}

/** Stats the World starts with for a plan (no level-ups yet). */
function startWorld(p: Profile, choice = {}, seed = 3): World {
  const plan = buildRunConfig(p, choice, ctx);
  return new World({ hero: plan.hero, seed, run: plan.config, maxEnemies: 200 });
}

describe("fail forward: run -> bank -> buy -> a stronger run", () => {
  test("a fresh account's first death pays enough for a board node, and the node is in the next run", () => {
    const p = fresh();
    const w1 = startWorld(p);
    const might0 = w1.stats.might;
    simulate(w1, 75, DT, new Bot(5));
    const r1 = applyRunToProfile(p, w1.summary(), ctx);
    expect(r1.coins.total).toBeGreaterThan(0);
    expect(p.currencies.coins).toBe(r1.coins.total);
    expect(r1.affordable.boardNodes).toBeGreaterThan(0);
    const cheapest = affordableNodes(p, ctx)[0];
    expect(cheapest.cost).toBe(r1.affordable.cheapestNode);
    // the results' UPGRADE: buy a damage node
    const might = affordableNodes(p, ctx).find((v) => v.node.id === "might_1");
    expect(might, "might_1 affordable after one short run").toBeTruthy();
    expect(buyNode(p, "might_1", ctx).ok).toBe(true);
    const w2 = startWorld(p);
    expect(w2.stats.might).toBeCloseTo(might0 + 0.04, 6);
    // and nothing else moved
    expect(w2.stats.maxHp).toBe(w1.stats.maxHp);
    expect(w2.weapons.map((x) => `${x.def.id}:${x.level}`)).toEqual(["star_shot:1"]);
  });

  test("hero levels from banked XP raise damage and max HP (+1% each per level)", () => {
    const p = fresh();
    p.heroes.hoshi.xp = 1e9; // level cap
    reconcileProfile(p, ctx);
    const lvl = buildRunConfig(p, {}, ctx).heroLevel;
    expect(lvl).toBe(TUNING.hero.maxLevel);
    const base = new World({ hero: "hoshi", seed: 1, run: defaultRunConfig() });
    const w = startWorld(p);
    expect(w.stats.might).toBeCloseTo(base.stats.might + 0.01 * (lvl - 1), 6);
    expect(w.stats.maxHp).toBeCloseTo(base.stats.maxHp * (1 + 0.01 * (lvl - 1)), 6);
  });
});

describe("RunConfig: nothing ignored, nothing applied twice", () => {
  test("relic, talent and constellation stats come from their ids only (the account mods never repeat them)", () => {
    const p = fresh();
    cleared(p);
    p.relics = { bent_spoon: 4 };
    p.heroes.hoshi.xp = 1e9;
    p.heroes.hoshi.constellation = 5;
    p.heroes.hoshi.talents = { hoshi_twinkle: 5, hoshi_shooting_star: 3, hoshi_wish_upon: 3 };
    reconcileProfile(p, ctx);
    const plan = buildRunConfig(p, { relics: ["bent_spoon"] }, ctx);
    expect(plan.issues).toEqual([]);
    expect(plan.config.talents).toEqual({ hoshi_twinkle: 5, hoshi_shooting_star: 3, hoshi_wish_upon: 3 });
    const account = new World({ hero: "hoshi", seed: 1, run: plan.config });
    // the same ids handed to the sim directly, with the account's own mods: identical stats
    const direct = new World({
      hero: "hoshi",
      seed: 1,
      run: defaultRunConfig({ mods: plan.config.mods, relics: [{ id: "bent_spoon", stars: 4 }], talents: plan.config.talents, constellation: 5 }),
    });
    expect(account.stats).toEqual(direct.stats);
    // and the relic really counts once: with vs without it
    const without = new World({ hero: "hoshi", seed: 1, run: { ...plan.config, relics: [] } });
    expect(account.stats.might - without.stats.might).toBeCloseTo(0.07, 6); // Slightly Bent Spoon ★4 = +7%
  });

  test("Prepared Protagonist: the signature weapon starts at Lv2 (no second copy); a chosen weapon joins at Lv2", () => {
    const p = fresh();
    p.board.ranks = { head_start: 1 };
    const sig = startWorld(p);
    expect(sig.weapons.map((x) => `${x.def.id}:${x.level}`)).toEqual(["star_shot:2"]);
    const chosen = startWorld(p, { startWeapon: "thunder_bell" });
    expect(chosen.weapons.map((x) => `${x.def.id}:${x.level}`)).toEqual(["star_shot:1", "thunder_bell:2"]);
    // C2 ("Star Shot starts at Lv2") and the node don't stack past Lv2
    p.heroes.hoshi.constellation = 2;
    expect(startWorld(p).weapons.map((x) => `${x.def.id}:${x.level}`)).toEqual(["star_shot:2"]);
  });

  test("mastery reaches the World: +3% damage per rank, Limit Break levels at rank 5 / 10", () => {
    const p = fresh();
    p.mastery = { star_shot: TUNING.mastery.thresholds[9] }; // rank 10
    const w = startWorld(p);
    const inst = w.weapons[0];
    expect(inst.def.id).toBe("star_shot");
    expect(inst.dmgMul).toBeCloseTo(1 + masteryDamage(10), 6);
    expect(w.weaponMaxLevel(inst.def)).toBe(7);
  });

  test("board slots, start level and flags reach the World", () => {
    const p = fresh();
    cleared(p);
    p.board.ranks = { weapon_slot: 1, passive_slot: 1, start_level_1: 1, banish_1: 2, skip_1: 1, dash_charge_1: 1, revive_1: 1 };
    const plan = buildRunConfig(p, {}, ctx);
    const w = new World({ hero: plan.hero, seed: 2, run: plan.config });
    expect(w.weaponSlots).toBe(7);
    expect(w.passiveSlots).toBe(7);
    expect(w.level).toBe(3);
    expect(w.pendingLevels).toBe(2);
    expect(w.banishes).toBe(2);
    expect(w.skips).toBe(1);
    expect(w.player.dashChargesMax).toBe(2);
    expect(w.revivesLeft).toBe(w.stats.revives + 1);
  });

  test("Plot Twist heat: the loadout, the sim, RunStats and the payout agree", () => {
    const p = fresh();
    cleared(p);
    p.unlocks.twists = [...TWISTS.keys()];
    const twists = { budget_cuts: 2, censored: 1, spoilers: 1 };
    const plan = buildRunConfig(p, { twists }, ctx);
    expect(plan.issues).toEqual([]);
    const w = new World({ hero: plan.hero, seed: 4, run: plan.config });
    expect(w.heat).toBe(plan.heat);
    expect(simTwistHeat(plan.config.twists, plan.config.twistRanks ?? {})).toBe(metaTwistHeat(twists, ctx));
    simulate(w, 20, DT, new Bot(2));
    const s = w.summary().stats;
    expect(s.heat).toBe(plan.heat);
    expect(s.twistRanks).toEqual(twists);
    const pay = computePayout({ stats: s, stage: ctx.stageById.get(s.stage), grade: gradeRun(s), firstClear: false, firstBossKills: [], newHeatBadges: [] });
    const heatLine = pay.coins.lines.find((l) => l.id === "heat");
    expect(heatLine?.mul).toBeCloseTo(1 + plan.heat * TUNING.payout.heatCoinPer, 2);
  });

  test("content pools: an account offers only its unlocked weapons (+ the hero's signature)", () => {
    const p = fresh();
    p.unlocks.weapons = ["thunder_bell", "candy_bomb"]; // (a hand-made account: the 8 originals are start content)
    const plan = buildRunConfig(p, {}, ctx);
    expect([...plan.config.weaponPool!].sort()).toEqual(["candy_bomb", "star_shot", "thunder_bell"]);
    const w = new World({ hero: plan.hero, seed: 9, run: plan.config });
    simulate(w, 150, DT, new Bot(9));
    const used = new Set((w.summary().stats.weaponsUsed ?? []).map((id) => baseWeaponOf(WEAPONS.get(id)!).id));
    for (const id of used) expect(plan.config.weaponPool).toContain(id);
  });
});

describe("unlock rules agree with the sim's content", () => {
  test("every Plot Twist opens with the stage its TwistDef names (unlockedBy)", () => {
    for (const d of TWISTS.values()) {
      if (!d.unlockedBy) continue;
      const rule = unlockRule("twist", d.id, ctx);
      const st = ctx.stageById.get(d.unlockedBy);
      expect(rule.cond.t, d.id).toBe("stageClear");
      // (stages not registered yet: the table's order must still be the bible's, i.e. after every registered stage)
      if (rule.cond.t === "stageClear") {
        if (st) expect(rule.cond.order, d.id).toBe(st.order);
        else expect(rule.cond.order, d.id).toBeGreaterThan(Math.max(...ctx.stages.map((x) => x.order)));
      }
    }
  });

  test("a fresh account can play: Dream Meadow, Hoshi, the 8 original weapons and passives", () => {
    const p = fresh();
    const plan = buildRunConfig(p, {}, ctx);
    expect(plan.issues).toEqual([]);
    expect(plan.hero).toBe("hoshi");
    expect(plan.config.stage).toBe("dream_meadow");
    expect(plan.config.weaponPool?.length).toBe(8);
    expect(plan.config.passivePool?.length).toBe(8);
    for (const id of plan.config.weaponPool!) expect(WEAPONS.get(id)?.evolved, id).toBeFalsy();
  });
});

describe("banking", () => {
  test("every banked run advances the banner rotation once and evaluates Plot Points", () => {
    const p = fresh();
    const left = p.rotation.runsLeft;
    const w = startWorld(p);
    simulate(w, 10, DT, new Bot(1));
    const r = applyRunToProfile(p, w.summary(), ctx);
    expect(p.rotation.runsLeft).toBe(left - 1 > 0 ? left - 1 : TUNING.rotation.runsPerBanner);
    expect(r.banner.runsLeft).toBe(p.rotation.runsLeft);
    expect(p.lifetime.runs).toBe(1);
    // Plot Points are evaluated against the banked lifetime (the stored progress moved)
    expect(Object.keys(p.achievements.progress).length + Object.keys(p.achievements.done).length).toBeGreaterThan(0);
  });

  test("greed scales the coin bonuses; the coins picked up already include it", () => {
    const p = fresh();
    const w = startWorld(p);
    simulate(w, 60, DT, new Bot(4));
    const s = w.summary().stats;
    expect(s.greed).toBe(1);
    const base = computePayout({ stats: s, stage: ctx.stageById.get(s.stage), grade: gradeRun(s), firstClear: false, firstBossKills: [], newHeatBadges: [] });
    expect(base.coins.lines.some((l) => l.id === "greed")).toBe(false);
    const greedy = computePayout({ stats: { ...s, greed: 1.5 }, stage: ctx.stageById.get(s.stage), grade: gradeRun(s), firstClear: false, firstBossKills: [], newHeatBadges: [] });
    const line = greedy.coins.lines.find((l) => l.id === "greed");
    const picked = base.coins.lines.find((l) => l.id === "picked")?.amount ?? 0;
    const bonuses = base.coins.lines.filter((l) => !l.mul && l.id !== "picked").reduce((a, l) => a + l.amount, 0);
    expect(line?.amount).toBe(Math.round(bonuses * 0.5));
    expect(greedy.coins.total).toBeGreaterThan(base.coins.total);
    expect(greedy.coins.lines.reduce((a, l) => a + l.amount, 0)).toBe(greedy.coins.total);
    expect(picked).toBe(s.coins);
  });

  test("a Filler Arc run banks as a clear with its endless time and record", () => {
    const p = fresh();
    cleared(p);
    const plan = buildRunConfig(p, { endless: true }, ctx);
    expect(plan.config.endless).toBe(true);
    const w = new World({ hero: plan.hero, seed: 6, run: plan.config, maxEnemies: 200 });
    simulate(w, 30, DT, new Bot(6));
    // (the final boss's death, as the director would see it)
    w.stageCleared = true;
    w.finalBossDown = true;
    w.startEndless();
    simulate(w, 45, DT, new Bot(6));
    const s = w.summary().stats;
    expect(s.endless).toBe(true);
    expect(s.stageCleared).toBe(true);
    expect(s.endlessTime).toBeGreaterThan(40);
    const r = applyRunToProfile(p, w.summary(), ctx);
    expect(r.outcome).toBe("clear");
    expect(r.records.newBestEndless).toBe(true);
    expect(p.records.dream_meadow.bestEndless).toBeCloseTo(s.endlessTime, 3);
    expect(r.coins.lines.some((l) => l.id === "endless")).toBe(true);
  });
});
