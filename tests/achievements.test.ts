/**
 * Plot Points (docs/content/achievements.md): the full 171-entry list by
 * category, unique ids, every title, every reward / unlock target, the
 * canonical unlock rules, and each achievement triggered by a crafted
 * profile / RunStats (and NOT by a neutral one). Evaluated against a
 * bible-sized content catalogue (11 heroes, 20 + 20 weapons, 16 passives,
 * 5 stages, 12 bosses, the live relic registry), so the rules never depend
 * on how much content the content wave has registered so far.
 */
import { describe, expect, test } from "vitest";
import type { RunStats } from "../src/game/run-config";
import { RELICS } from "../src/game/registry";
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_LIST, ACHIEVEMENTS, AchievementWatch, evaluateAchievements, lifetimeWithRun, type AchievementDef } from "../src/meta/achievements";
import { BOSS_IDS } from "../src/meta/achievements/defs/_shared";
import { achievements as COMBAT } from "../src/meta/achievements/defs/combat";
import { achievements as GACHA } from "../src/meta/achievements/defs/gacha";
import { achievements as HEROES_DEFS } from "../src/meta/achievements/defs/heroes";
import { achievements as SILLY } from "../src/meta/achievements/defs/silly";
import { achievements as STORY } from "../src/meta/achievements/defs/story";
import { achievements as WEAPONS_DEFS } from "../src/meta/achievements/defs/weapons";
import { gameContent, makeContent, type MetaContent } from "../src/meta/content";
import { masteryRank } from "../src/meta/economy";
import { heroProgress } from "../src/meta/heroes";
import { defaultStageRecord, type Profile } from "../src/meta/profile";
import { applyRunToProfile } from "../src/meta/rewards";
import { ROSTER } from "../src/meta/roster";
import { condProgress, contentKind, evaluateUnlocks, isUnlocked, unlockRule, UNLOCK_RULES, type UnlockKind } from "../src/meta/unlocks";
import { HOSHI_TREE, STAGES, TWISTS, freshProfile, runStats } from "./meta.fixtures";

/** The 20 base weapons and their evolutions (docs/content/weapons.md). */
const EVOS: [string, string][] = [
  ["star_shot", "galaxy_barrage"],
  ["petal_slash", "sakura_tempest"],
  ["yarn_orbit", "cosmic_yarn"],
  ["heart_boomerang", "love_tornado"],
  ["thunder_bell", "raijin_drum"],
  ["candy_bomb", "sugar_nuke"],
  ["bubble_aura", "ocean_dome"],
  ["prism_beam", "rainbow_cannon"],
  ["dark_flame_dragon", "unsealed_abyss_dragon"],
  ["teapot_tempest", "eternal_tea_party"],
  ["micro_missile_swarm", "al_dente_armageddon"],
  ["baka_harisen", "dere_dere_harisen"],
  ["notice_me_sparkles", "shoujo_filter"],
  ["henshin_burst", "infinite_henshin_loop"],
  ["cheat_fireball", "cheat_meteor"],
  ["horn_of_reincarnation", "isekai_rush_hour"],
  ["bubble_tea_cannon", "tapioca_tsunami"],
  ["paper_crane_flock", "thousand_crane_wish"],
  ["idol_lightstick_wave", "sold_out_dome_tour"],
  ["kotatsu_of_sloth", "eternal_winter_break"],
];
const PASSIVES = ["power_bow", "wish_charm", "big_ribbon", "twin_charm", "swift_shoes", "magnet_star", "lucky_clover", "heart_locket", "plot_armor", "main_character_aura", "bento_box", "speed_lines", "inner_monologue", "training_montage", "friendship_bracelet", "chibi_charm"];
const SIGNATURE: Record<string, string> = {
  hoshi: "star_shot",
  rin: "petal_slash",
  mochi: "yarn_orbit",
  kuro: "dark_flame_dragon",
  pudding: "teapot_tempest",
  aoi: "micro_missile_swarm",
  akane: "baka_harisen",
  senpai: "notice_me_sparkles",
  magical_girl_47: "henshin_burst",
  isekai_kun: "cheat_fireball",
  truck_kun: "horn_of_reincarnation",
};

function bibleContent(): MetaContent {
  return makeContent({
    heroes: ROSTER.map((h) => ({ id: h.id, name: h.name, title: "", weapon: SIGNATURE[h.id], portrait: "" })),
    weapons: EVOS.flatMap(([b, e]) => [
      { id: b, name: b, icon: "", evolved: false, evolution: { into: e, with: "wish_charm" } },
      { id: e, name: e, icon: "", evolved: true },
    ]),
    passives: PASSIVES.map((id) => ({ id, name: id })),
    enemies: [
      { id: "puff", name: "Puff" },
      { id: "wisp", name: "Candle Wisp" },
      { id: "mini_truck", name: "Mini Truck-kun" },
    ],
    bosses: BOSS_IDS.map((id) => ({ id, name: id })),
    stages: STAGES,
    relics: [...RELICS.values()],
    talents: [HOSHI_TREE],
    twists: TWISTS,
  });
}
const ctx = bibleContent();

/** Mastery XP that reaches `rank`. */
function xpForRank(rank: number): number {
  let lo = 0;
  let hi = 1;
  while (masteryRank(hi) < rank) hi *= 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (masteryRank(mid) >= rank) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

type Craft = (p: Profile, run: RunStats) => void;
const rec = (p: Profile, stage: string) => (p.records[stage] ??= defaultStageRecord());
const heroesN = (p: Profile, n: number) => {
  p.unlocks.heroes = ROSTER.slice(0, n).map((h) => h.id);
};
const asRun = (over: Partial<RunStats>): Craft => (_p, r) => void Object.assign(r, over);
const clearAs = (hero: string): Craft => (_p, r) => void Object.assign(r, { hero, stageCleared: true, outcome: "victory" });

/** How to complete each Plot Point (every id of the bible). */
const CRAFT: Record<string, Craft> = {
  // ---- story
  pilot_episode: (p) => void (p.lifetime.runs = 1),
  king_puff_down: (p) => void (p.lifetime.bossKills.king_puff = 1),
  teddy_down: (p) => void (p.lifetime.bossKills.nightmare_teddy = 1),
  kuro_awakens: (p) => void (rec(p, "dream_meadow").bestTime = 360),
  clear_stage_1: (p) => void (rec(p, "dream_meadow").clears = 1),
  gingerbread_down: (p) => void (p.lifetime.bossKills.gingerbread_golem = 1),
  clear_stage_2: (p) => void (rec(p, "candy_kingdom").clears = 1),
  president_down: (p) => void (p.lifetime.bossKills.council_president = 1),
  clear_stage_3: (p) => void (rec(p, "shoujo_academy").clears = 1),
  kraken_down: (p) => void (p.lifetime.bossKills.kraken_chan = 1),
  clear_stage_4: (p) => void (rec(p, "beach_episode").clears = 1),
  truck_down: (p) => void (p.lifetime.bossKills.truck_kun_boss = 1),
  rival_down: (p) => void (p.lifetime.bossKills.rival_chan = 1),
  clear_stage_5: (p) => void (rec(p, "final_arc").clears = 1),
  all_bosses: (p) => BOSS_IDS.forEach((b) => (p.lifetime.bossKills[b] = 1)),
  filler_arc: (p) => void (rec(p, "dream_meadow").bestEndless = 300),
  filler_15: (p) => void (rec(p, "dream_meadow").bestEndless = 900),
  filler_30: (p) => void (rec(p, "dream_meadow").bestEndless = 1800),
  rematch_1: asRun({ bossRematches: 1, endless: true, stageCleared: true }),
  heat_4: (p) => void (rec(p, "dream_meadow").bestHeat = 4),
  heat_8: (p) => void (rec(p, "dream_meadow").bestHeat = 8),
  heat_16: (p) => void (rec(p, "candy_kingdom").bestHeat = 16),
  heat_32: (p) => void (rec(p, "final_arc").bestHeat = 32),
  heat_8_everywhere: (p) => STAGES.forEach((s) => (rec(p, s.id).bestHeat = 8)),
  // ---- combat
  kills_1k: (p) => void (p.lifetime.kills = 1_000),
  mochi_3000: (p) => void (p.lifetime.kills = 3_000),
  kills_10k: (p) => void (p.lifetime.kills = 10_000),
  kills_100k: (p) => void (p.lifetime.kills = 100_000),
  kills_1m: (p) => void (p.lifetime.kills = 1_000_000),
  episode_1000: asRun({ killsByEnemy: { puff: 1_000 } }),
  episode_5000: asRun({ killsByEnemy: { puff: 4_000, wisp: 1_000 } }),
  elites_10: (p) => void (p.lifetime.eliteKills = 10),
  elites_100: (p) => void (p.lifetime.eliteKills = 100),
  elites_1000: (p) => void (p.lifetime.eliteKills = 1_000),
  bosses_10: (p) => void (p.lifetime.bossKills = { king_puff: 6, lady_lunatic: 4 }),
  bosses_100: (p) => void (p.lifetime.bossKills = { king_puff: 60, lady_lunatic: 40 }),
  combo_100: (p) => void (p.lifetime.maxCombo = 100),
  combo_1000: (p) => void (p.lifetime.maxCombo = 1_000),
  combo_5000: (p) => void (p.lifetime.maxCombo = 5_000),
  rank_s: (p) => void (p.lifetime.maxRank = 3),
  rank_sss: (p) => void (p.lifetime.maxRank = 5),
  no_hit_120: (p) => void (p.lifetime.noHitBest = 120),
  no_hit_180: (p) => void (p.lifetime.noHitBest = 180),
  flawless_finale: asRun({ stageCleared: true, outcome: "victory", damageTaken: 149 }),
  level_25: (p) => void (p.lifetime.bestLevel = 25),
  level_50: (p) => void (p.lifetime.bestLevel = 50),
  level_99: (p) => void (p.lifetime.bestLevel = 99),
  damage_5000: (p) => void (p.lifetime.damageTaken = 5_000),
  chests_100: (p) => void (p.lifetime.chests = 100),
  jackpot: asRun({ jackpots: 1 }),
  ults_25: (p) => void (p.lifetime.ults = 25),
  ults_500: (p) => void (p.lifetime.ults = 500),
  // ---- heroes
  heroes_3: (p) => heroesN(p, 3),
  heroes_4: (p) => heroesN(p, 4),
  heroes_6: (p) => heroesN(p, 6),
  heroes_all: (p) => heroesN(p, 11),
  hero_level_10: (p) => void (heroProgress(p, "rin").level = 10),
  hero_level_30: (p) => void (heroProgress(p, "rin").level = 30),
  all_heroes_30: (p) => ROSTER.forEach((h) => (heroProgress(p, h.id).level = 30)),
  clear_3_heroes: (p) => void (p.lifetime.heroesCleared = ["hoshi", "rin", "mochi"]),
  clear_6_heroes: (p) => void (p.lifetime.heroesCleared = ROSTER.slice(0, 6).map((h) => h.id)),
  clear_all_heroes: (p) => void (p.lifetime.heroesCleared = ROSTER.map((h) => h.id)),
  constellation_1: (p) => void (heroProgress(p, "senpai").constellation = 1),
  constellation_6: (p) => void (heroProgress(p, "senpai").constellation = 6),
  capstone: (p) => void (heroProgress(p, "hoshi").talents = { h0_1: 5, h0_2: 3, h0_3: 3, h0_4: 3, h0_5: 1 }),
  two_arcs: (p) => void (heroProgress(p, "hoshi").talents = { h0_1: 5, h0_2: 3, h0_3: 3, h0_4: 3, h0_5: 1, h1_1: 5, h1_2: 3, h1_3: 3, h1_4: 3, h1_5: 1 }),
  clear_hoshi: clearAs("hoshi"),
  hoshi_stars: (p) => void (p.lifetime.killsByWeapon.star_shot = 10_000),
  clear_rin: clearAs("rin"),
  rin_blossoms: (p) => void (p.lifetime.damageByWeapon.petal_slash = 1_000_000),
  clear_mochi: clearAs("mochi"),
  mochi_yarn_only: asRun({ hero: "mochi", stageCleared: true, outcome: "victory", weaponsUsed: ["yarn_orbit", "cosmic_yarn"] }),
  clear_kuro: (p) => void (p.lifetime.heroesCleared = ["kuro"]),
  kuro_overdrive: asRun({ hero: "kuro", ults: 8 }),
  clear_pudding: clearAs("pudding"),
  pudding_heal: asRun({ hero: "pudding", healed: 1_000 }),
  clear_aoi: clearAs("aoi"),
  aoi_spaghetti: asRun({ hero: "aoi", killsByWeapon: { micro_missile_swarm: 1_200, al_dente_armageddon: 800 } }),
  clear_akane: clearAs("akane"),
  akane_baka: asRun({ hero: "akane", bakas: 100 }),
  clear_senpai: clearAs("senpai"),
  senpai_charm: asRun({ hero: "senpai", charmed: 300 }),
  clear_mg47: clearAs("magical_girl_47"),
  mg47_henshin: asRun({ hero: "magical_girl_47", henshins: 47 }),
  clear_isekai: clearAs("isekai_kun"),
  isekai_overdo: asRun({ hero: "isekai_kun", overdos: 30 }),
  clear_truck: clearAs("truck_kun"),
  truck_isekai: asRun({ hero: "truck_kun", isekaid: 1_000 }),
  // ---- weapons
  evolve_1: (p) => void (p.lifetime.evolutions = 1),
  evolve_10: (p) => void (p.lifetime.evolutions = 10),
  evolve_25: (p) => void (p.lifetime.evolutions = 25),
  evolve_6_run: asRun({ evolutions: ["a", "b", "c", "d", "e", "f"] }),
  boba_origins: (p) => void (p.lifetime.killsByEnemy.puff = 1_000),
  snacks_50: (p) => void (p.lifetime.foodEaten = 50),
  dashes_500: (p) => void (p.lifetime.dashes = 500),
  mastery_5: (p) => void (p.mastery.star_shot = xpForRank(5)),
  mastery_10: (p) => void (p.mastery.star_shot = xpForRank(10)),
  mastery_5x5: (p) => EVOS.slice(0, 5).forEach(([b]) => (p.mastery[b] = xpForRank(5))),
  mastery_10x5: (p) => EVOS.slice(0, 5).forEach(([b]) => (p.mastery[b] = xpForRank(10))),
  mastery_all: (p) => EVOS.forEach(([b]) => (p.mastery[b] = xpForRank(10))),
  arsenal_8: (p) => void (p.codex.weapons = EVOS.slice(0, 8).map(([b]) => b)),
  arsenal_20: (p) => void (p.codex.weapons = EVOS.map(([b]) => b)),
  evolutions_all: (p) => void (p.codex.weapons = EVOS.map(([, e]) => e)),
  passives_all: (p) => void (p.codex.passives = [...PASSIVES]),
  seven_weapons: asRun({ maxWeaponsHeld: 7 }),
  ...Object.fromEntries(EVOS.map(([, e]): [string, Craft] => [`evo_${e}`, (p) => void p.codex.weapons.push(e)])),
  // ---- gacha
  first_pull: (p) => void (p.gacha.stats.pulls = 1),
  first_ten_pull: (p) => void (p.gacha.stats.tenPulls = 1),
  pulls_100: (p) => void (p.gacha.stats.pulls = 100),
  pulls_300: (p) => void (p.gacha.stats.pulls = 300),
  pulls_1000: (p) => void (p.gacha.stats.pulls = 1_000),
  gacha_hell: (p) => void (p.gacha.stats.nStreakBest = 10),
  gacha_hell_25: (p) => void (p.gacha.stats.nStreakBest = 25),
  lost_5050: (p) => void (p.gacha.stats.lost5050 = 1),
  lost_5050_3: (p) => void (p.gacha.stats.lost5050 = 3),
  won_5050: (p) => void (p.gacha.stats.won5050 = 1),
  first_ssr: (p) => void (p.gacha.stats.byRarity.SSR = 1),
  first_ur: (p) => void (p.gacha.stats.byRarity.UR = 1),
  first_lr: (p) => void (p.gacha.stats.byRarity.LR = 1),
  mythic: (p) => void (p.gacha.stats.byRarity.MYTHIC = 1),
  hard_pity: (p) => void (p.gacha.stats.hardPityHits = 1),
  spark_used: (p) => void (p.gacha.stats.sparksUsed = 1),
  truck_owned: (p) => void p.unlocks.heroes.push("truck_kun"),
  relics_10: (p) => [...RELICS.keys()].slice(0, 10).forEach((id) => (p.relics[id] = 0)),
  relics_30: (p) => [...RELICS.keys()].slice(0, 30).forEach((id) => (p.relics[id] = 0)),
  relics_all: (p) => [...RELICS.keys()].forEach((id) => (p.relics[id] = 0)),
  relic_star_6: (p) => void (p.relics.bent_spoon = 6),
  cone_zone: (p) => void (p.relics.traffic_cone = 6),
  copium_1000: (p) => void (p.gacha.stats.copiumEarned = 1_000),
  exchange_buy: (p) => void (p.gacha.stats.exchangeBuys = 1),
  gem_exchange: (p) => void (p.gacha.stats.gemExchanges = 1),
  // ---- silly
  speedrun: asRun({ time: 7, outcome: "dead" }),
  pacifist: (p) => void (p.lifetime.pacifistBest = 60),
  no_dash: (p) => void (p.lifetime.noDashBest = 180),
  touch_grass: (p) => void (p.lifetime.foodEaten = 100),
  episode_100: (p) => void (p.lifetime.runs = 100),
  tax_brackets: (p) => void (p.currencies.coins = 100_000),
  flesh_wound: (p) => void (p.lifetime.revivesUsed = 1),
  deaths_50: (p) => void (p.lifetime.deaths = 50),
  do_not_disturb: asRun({ comfyBest: 120 }),
  wisp_death: asRun({ outcome: "dead", killedBy: "wisp" }),
  isekaid: asRun({ outcome: "dead", killedBy: "mini_truck" }),
  saving_it: asRun({ outcome: "dead", ultReadyAtDeath: true }),
  commitment_issues: asRun({ rerollsUsed: 20 }),
  not_my_type: asRun({ banishesUsed: 5 }),
  nani_100: asRun({ nanis: 100 }),
  background_character: asRun({ time: 61, killsByEnemy: { puff: 9 } }),
  dropped_after_ep1: asRun({ time: 25, outcome: "quit" }),
  censored_clear: asRun({ stageCleared: true, outcome: "victory", twists: ["censored"] }),
  sequel_hook_clear: asRun({ stageCleared: true, outcome: "victory", twists: ["sequel_hook"] }),
  greedy_protagonist: asRun({ coins: 1_000 }),
  read_fine_print: (p) => void (p.flags.finePrint = 1),
};

/** Done ids after evaluating a fresh profile + the (crafted) run as a finished run. */
function evaluate(craft?: Craft): string[] {
  const p = freshProfile(ctx);
  const run = runStats({ time: 150 });
  craft?.(p, run);
  return evaluateAchievements(p, run, ctx).map((d) => d.def.id);
}

const BY_CAT: Record<string, AchievementDef[]> = { story: STORY, combat: COMBAT, heroes: HEROES_DEFS, weapons: WEAPONS_DEFS, gacha: GACHA, silly: SILLY };

describe("Plot Point list (docs/content/achievements.md)", () => {
  test("171 entries: Story 24 · Combat 28 · Heroes 36 · Weapons 37 · Gacha 25 · Silly 21", () => {
    expect(ACHIEVEMENT_LIST.length).toBe(171);
    const want: Record<string, number> = { story: 24, combat: 28, heroes: 36, weapons: 37, gacha: 25, silly: 21 };
    for (const c of ACHIEVEMENT_CATEGORIES) {
      expect(ACHIEVEMENT_LIST.filter((a) => a.category === c).length, c).toBe(want[c]);
      // each def file holds exactly its own category
      for (const a of BY_CAT[c]) expect(a.category, a.id).toBe(c);
    }
  });

  test("no duplicate ids across the def files; every id has a crafted trigger in this test", () => {
    const all = Object.values(BY_CAT).flat().map((a) => a.id);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(ACHIEVEMENTS.size);
    expect(Object.keys(CRAFT).sort()).toEqual([...all].sort());
  });

  test("the 41 Season 1 ids are kept", () => {
    const kept = [
      "pilot_episode", "clear_stage_1", "clear_stage_2", "clear_stage_3", "clear_stage_4", "clear_stage_5", "filler_arc", "heat_4", "heat_16",
      "kills_1k", "kills_10k", "kills_100k", "kills_1m", "elites_100", "bosses_10", "combo_100", "rank_sss", "no_hit_180",
      "heroes_3", "heroes_6", "heroes_all", "hero_level_10", "hero_level_30", "clear_3_heroes", "constellation_6",
      "evolve_1", "evolve_25", "evolve_6_run", "mastery_5", "mastery_10", "arsenal_8",
      "first_pull", "pulls_100", "pulls_1000", "gacha_hell", "lost_5050", "first_ssr", "mythic", "relics_10",
      "speedrun", "pacifist", "no_dash", "touch_grass", "episode_100", "tax_brackets", "flesh_wound", "deaths_50",
    ];
    for (const id of kept) expect(ACHIEVEMENTS.has(id), id).toBe(true);
  });

  test("names, descriptions, rewards: every entry pays something; hidden ones are the bible's", () => {
    for (const a of ACHIEVEMENT_LIST) {
      expect(a.target, a.id).toBeGreaterThan(0);
      expect(a.name.length, a.id).toBeGreaterThan(2);
      expect(a.desc.length, a.id).toBeGreaterThan(5);
      expect((a.reward.gems ?? 0) + (a.reward.coins ?? 0), a.id).toBeGreaterThan(0);
    }
    const hidden = ACHIEVEMENT_LIST.filter((a) => a.hidden).map((a) => a.id).sort();
    expect(hidden).toEqual(
      ["combo_5000", "level_99", "mochi_yarn_only", "gacha_hell_25", "mythic", "truck_owned", "speedrun", "pacifist", "do_not_disturb", "wisp_death", "isekaid", "saving_it", "background_character", "dropped_after_ep1", "read_fine_print"].sort(),
    );
  });

  test("the 20 titles of the profile card", () => {
    const titles = ACHIEVEMENT_LIST.filter((a) => a.reward.title).map((a) => a.reward.title).sort();
    expect(titles).toEqual(
      [
        "Dawnbringer", "Series Finale", "Villain Collector", "Filler Veteran", "Plot Twister", "Showrunner's Nightmare", "Plushie Nightmare", "Flawless", "Main Character", "Showrunner",
        "Box Set Collector", "Fair Screen Time", "Final Form", "Weapon Otaku", "Weapon Encyclopedia", "Whale (Platonic)", "Literally Chosen", "Spark Plug", "Merch Completionist", "Reincarnated",
      ].sort(),
    );
  });
});

describe("rewards and unlocks", () => {
  /** docs/content/achievements.md §1 "Unlocks": content -> achievement + canonical rule. */
  const CANON: [string, UnlockKind, string, unknown][] = [
    ["rin", "hero", "king_puff_down", { t: "bossKill", boss: "king_puff" }],
    ["mochi", "hero", "mochi_3000", { t: "life", key: "kills", count: 3000 }],
    ["kuro", "hero", "kuro_awakens", { t: "survive", order: 1, time: 360 }],
    ["pudding", "hero", "clear_stage_1", { t: "stageClear", order: 1 }],
    ["aoi", "hero", "clear_stage_2", { t: "stageClear", order: 2 }],
    ["akane", "hero", "clear_stage_3", { t: "stageClear", order: 3 }],
    ["bubble_tea_cannon", "weapon", "boba_origins", { t: "enemyKills", enemy: "puff", count: 1000 }],
    ["paper_crane_flock", "weapon", "evolve_10", { t: "life", key: "evolutions", count: 10 }],
    ["idol_lightstick_wave", "weapon", "rank_sss", { t: "life", key: "maxRank", count: 5 }],
    ["kotatsu_of_sloth", "weapon", "no_dash", { t: "life", key: "noDashBest", count: 180 }],
    ["plot_armor", "passive", "damage_5000", { t: "life", key: "damageTaken", count: 5000 }],
    ["main_character_aura", "passive", "rank_s", { t: "life", key: "maxRank", count: 3 }],
    ["bento_box", "passive", "snacks_50", { t: "life", key: "foodEaten", count: 50 }],
    ["speed_lines", "passive", "dashes_500", { t: "life", key: "dashes", count: 500 }],
    ["inner_monologue", "passive", "ults_25", { t: "life", key: "ults", count: 25 }],
    ["training_montage", "passive", "level_25", { t: "life", key: "bestLevel", count: 25 }],
    ["friendship_bracelet", "passive", "heroes_4", { t: "heroCount", count: 4 }],
    ["chibi_charm", "passive", "no_hit_120", { t: "life", key: "noHitBest", count: 120 }],
  ];

  test("every unlock-granting Plot Point carries its content and matches the canonical UNLOCK_RULES row", () => {
    const granting = ACHIEVEMENT_LIST.filter((a) => a.reward.unlock).map((a) => [a.reward.unlock, a.id]);
    expect(granting.sort()).toEqual(CANON.map(([c, , a]) => [c, a]).sort());
    for (const [content, kind, , cond] of CANON) {
      expect(unlockRule(kind, content, ctx).cond, content).toEqual(cond);
      expect(UNLOCK_RULES.some((r) => r.id === content && r.kind === kind), content).toBe(true);
    }
  });

  test("the same crafted state meets the unlock rule and completes the Plot Point (both celebrate together)", () => {
    for (const [content, kind, ach] of CANON) {
      const p = freshProfile(ctx);
      const run = runStats({ time: 150 });
      CRAFT[ach](p, run);
      expect(condProgress(p, unlockRule(kind, content, ctx).cond, ctx).met, `${content} rule`).toBe(true);
      evaluateUnlocks(p, ctx);
      expect(isUnlocked(p, kind, content), content).toBe(true);
      expect(evaluateAchievements(p, run, ctx).map((d) => d.def.id), ach).toContain(ach);
    }
  });

  test("every unlock target is registered content (the live game catalogue)", () => {
    const live = gameContent();
    for (const [content, kind] of CANON) expect(contentKind(content, live), content).toBe(kind);
  });

  test("an unlock reward grants its content when only the Plot Point fires (and titles are owned)", () => {
    const p = freshProfile(ctx);
    p.lifetime.maxRank = 3;
    const done = evaluateAchievements(p, null, ctx);
    const d = done.find((x) => x.def.id === "rank_s")!;
    expect(d.unlocked?.id).toBe("main_character_aura");
    expect(p.unlocks.passives).toContain("main_character_aura");
    p.lifetime.kills = 1_000_000;
    evaluateAchievements(p, null, ctx);
    expect(p.titles.owned).toContain("kills_1m");
  });
});

describe("every Plot Point can be triggered", () => {
  const neutral = new Set(evaluate());
  test.each(Object.keys(CRAFT))("%s", (id) => {
    expect(neutral.has(id), `${id} completes without its trigger`).toBe(false);
    expect(evaluate(CRAFT[id])).toContain(id);
  });
});

describe("in-run checks", () => {
  test("end-of-run feats (death / quit) never toast mid-run; run feats do", () => {
    const p = freshProfile(ctx);
    const w = new AchievementWatch(p, ctx);
    const live = runStats({ time: 20, outcome: "quit", killsByEnemy: { puff: 3 }, killedBy: "wisp", ultReadyAtDeath: true, nanis: 100 });
    const ids = w.poll(live).map((a) => a.id);
    expect(ids).toContain("nani_100");
    for (const id of ["dropped_after_ep1", "wisp_death", "saving_it", "speedrun", "background_character"]) expect(ids, id).not.toContain(id);
  });

  test("the live lifetime includes the run's weapon kills, evolutions and a clear", () => {
    const p = freshProfile(ctx);
    p.lifetime.killsByWeapon.star_shot = 9_900;
    const L = lifetimeWithRun(p.lifetime, runStats({ killsByWeapon: { galaxy_barrage: 150 }, evolutions: ["galaxy_barrage"], stageCleared: true, hero: "rin" }), ctx);
    expect(L.killsByWeapon.star_shot).toBe(10_050);
    expect(L.evolutions).toBe(1);
    expect(L.heroesCleared).toContain("rin");
    expect(p.lifetime.heroesCleared).not.toContain("rin");
  });

  test("a banked run discovers its evolution in the codex (gem bounty) and completes the Evolve Plot Point", () => {
    const p = freshProfile(ctx);
    const gems = p.currencies.gems;
    const r = applyRunToProfile(p, { stats: runStats({ weaponsUsed: ["star_shot", "galaxy_barrage"], damageByWeapon: { galaxy_barrage: 5000 } }) }, ctx);
    expect(p.codex.weapons).toEqual(expect.arrayContaining(["star_shot", "galaxy_barrage"]));
    expect(r.codex.map((c) => c.id)).toContain("galaxy_barrage");
    expect(r.codex.find((c) => c.id === "galaxy_barrage")!.gems).toBeGreaterThan(0);
    expect(p.currencies.gems).toBeGreaterThan(gems);
    expect(r.achievements.map((a) => a.def.id)).toContain("evo_galaxy_barrage");
  });
});
