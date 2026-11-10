/**
 * Small fixed content catalogue for the src/meta tests: the account rules are
 * tested against it, so they never depend on how much content the content
 * wave has shipped (the live catalogue is exercised by the integration tests).
 */
import type { RelicDef, StageInfo, TalentNode, TalentTree, TwistDef } from "../src/game/defs";
import type { RunStats } from "../src/game/run-config";
import { makeContent, type MetaContent } from "../src/meta/content";
import { defaultProfile, type Profile } from "../src/meta/profile";

const relic = (id: string, rarity: RelicDef["rarity"]): RelicDef => ({ id, name: id.replace(/_/g, " "), rarity, icon: "icon_chest", flavor: "", desc: (s) => `${id} ★${s}` });

export const RELICS: RelicDef[] = [
  relic("bent_spoon", "N"),
  relic("old_keychain", "N"),
  relic("paper_fan", "N"),
  relic("acrylic_stand", "R"),
  relic("poster", "R"),
  relic("plushie", "SR"),
  relic("figure", "SR"),
  relic("giant_plush", "SSR"),
  relic("signed_script", "SSR"),
  relic("golden_mic", "UR"),
  relic("director_chair", "LR"),
  relic("credit_card", "MYTHIC"),
];

const tn = (id: string, branch: number, tier: number, maxRank: number, requires?: string[]): TalentNode => ({ id, name: id, branch, tier, maxRank, desc: (r) => `${id} ${r}`, requires });

export const HOSHI_TREE: TalentTree = {
  hero: "hoshi",
  branches: ["Idol Arc", "Plot Armor", "Star Power"],
  nodes: [0, 1, 2].flatMap((b) => [
    tn(`h${b}_1`, b, 1, 5),
    tn(`h${b}_2`, b, 2, 3),
    tn(`h${b}_3`, b, 3, 3),
    tn(`h${b}_4`, b, 4, 3),
    tn(`h${b}_5`, b, 5, 1, [`h${b}_4`]),
  ]),
};

const twist = (id: string, heat: number[]): TwistDef => ({ id, name: id, maxRank: heat.length, heat, desc: (r) => `${id} ${r}`, install: () => {} });

export const TWISTS: TwistDef[] = [twist("budget_cuts", [1, 2, 2]), twist("censored", [2]), twist("dub_version", [1, 2])];

const stage = (id: string, order: number, rewardMul: number, bosses: string[]): StageInfo => ({ id, name: id.replace(/_/g, " "), subtitle: "", order, duration: 600 + 120 * (order - 1), bosses, rewardMul });

export const STAGES: StageInfo[] = [
  stage("dream_meadow", 1, 1, ["king_puff", "nightmare_teddy", "lady_lunatic"]),
  stage("candy_kingdom", 2, 1.25, ["gingerbread_golem", "sugar_plum_tyrant"]),
  stage("shoujo_academy", 3, 1.5, ["council_president", "bishounen"]),
  stage("beach_episode", 4, 1.75, ["kraken_chan", "firework_dragon"]),
  stage("final_arc", 5, 2.2, ["truck_boss", "rival_chan", "cancel_sama"]),
];

export function fixtureContent(): MetaContent {
  return makeContent({
    heroes: [
      { id: "hoshi", name: "Hoshi", title: "", weapon: "star_shot", portrait: "" },
      { id: "rin", name: "Rin", title: "", weapon: "petal_slash", portrait: "" },
      { id: "mochi", name: "Mochi", title: "", weapon: "yarn_orbit", portrait: "" },
      { id: "kuro", name: "Kuro", title: "", weapon: "dark_flame_dragon", portrait: "" },
      { id: "pudding", name: "Pudding", title: "", weapon: "teapot_tempest", portrait: "" },
      { id: "senpai", name: "Senpai", title: "", weapon: "notice_me_sparkles", portrait: "" },
      { id: "magical_girl_47", name: "Magical Girl #47", title: "", weapon: "henshin_burst", portrait: "" },
      { id: "isekai_kun", name: "Isekai-kun", title: "", weapon: "cheat_fireball", portrait: "" },
      { id: "truck_kun", name: "Truck-kun", title: "", weapon: "horn_of_reincarnation", portrait: "" },
    ],
    weapons: [
      { id: "star_shot", name: "Star Shot", icon: "", evolved: false, evolutions: [{ into: "galaxy_barrage", with: "wish_charm" }] },
      { id: "galaxy_barrage", name: "Galaxy Barrage", icon: "", evolved: true },
      { id: "petal_slash", name: "Petal Slash", icon: "", evolved: false },
      { id: "yarn_orbit", name: "Yarn Orbit", icon: "", evolved: false },
      { id: "dark_flame_dragon", name: "Dark Flame Dragon", icon: "", evolved: false },
      { id: "teapot_tempest", name: "Teapot Tempest", icon: "", evolved: false },
      { id: "bubble_tea_cannon", name: "Bubble Tea Cannon", icon: "", evolved: false },
      { id: "kotatsu_of_sloth", name: "Kotatsu of Sloth", icon: "", evolved: false },
      { id: "notice_me_sparkles", name: "Notice-Me Sparkles", icon: "", evolved: false },
    ],
    passives: [
      { id: "power_bow", name: "Power Bow" },
      { id: "wish_charm", name: "Wish Charm" },
      { id: "plot_armor", name: "Plot Armor" },
    ],
    enemies: [
      { id: "puff", name: "Puff" },
      { id: "boo", name: "Boo" },
    ],
    bosses: [
      { id: "king_puff", name: "King Puff" },
      { id: "nightmare_teddy", name: "Nightmare Teddy" },
      { id: "lady_lunatic", name: "Lady Lunatic" },
    ],
    stages: STAGES,
    relics: RELICS,
    talents: [HOSHI_TREE],
    twists: TWISTS,
  });
}

/** A fresh profile reconciled against the fixture (start content unlocked). */
export function freshProfile(ctx: MetaContent = fixtureContent()): Profile {
  const p = defaultProfile(0);
  p.unlocks.weapons.push(...ctx.baseWeapons.filter((w) => !["dark_flame_dragon", "teapot_tempest", "bubble_tea_cannon", "kotatsu_of_sloth", "notice_me_sparkles"].includes(w.id)).map((w) => w.id));
  p.unlocks.passives.push("power_bow", "wish_charm");
  return p;
}

/** RunStats with sensible defaults. */
export function runStats(over: Partial<RunStats> = {}): RunStats {
  return {
    stage: "dream_meadow",
    hero: "hoshi",
    twists: [],
    heat: 0,
    endless: false,
    time: 150,
    endlessTime: 0,
    stageCleared: false,
    killsByEnemy: { puff: 200, boo: 50 },
    eliteKills: 0,
    bossKills: [],
    damageByWeapon: { star_shot: 20000 },
    killsByWeapon: { star_shot: 250 },
    evolutions: [],
    dashes: 12,
    ults: 1,
    levelUps: 12,
    level: 13,
    chests: 0,
    coins: 12,
    foodEaten: 1,
    maxCombo: 40,
    maxRank: 1,
    damageTaken: 100,
    noHitBest: 25,
    revivesUsed: 0,
    outcome: "dead",
    ...over,
  };
}

/** Deterministic RandomSource from a list of values (cycled). */
export function seq(values: number[]): { next(): number } {
  let i = 0;
  return { next: () => values[i++ % values.length] };
}
