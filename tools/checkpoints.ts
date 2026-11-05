/**
 * Account-power CHECKPOINTS (the contract between the combat difficulty curve
 * and the economy): synthetic profiles built through the REAL meta layer
 * (board purchases with the simulator's value policy, hero XP -> levels ->
 * talents, mastery XP -> ranks / Limit Breaks, relics with stars,
 * constellations, unlocks) and turned into RunConfigs by `buildRunConfig`.
 *
 *   P0 fresh save (0 h)  ... P7 "cute anime death machine" (~150 h)
 *
 * The sim pass tunes each stage against these (docs/ARCHITECTURE.md §6:
 * intended checkpoint -> ~40-70 % clears for the mid bot); the economy pass
 * tunes income / costs so an account reaches each checkpoint at its `hours`
 * (EXPANSION §2). Checkpoints are cumulative: P(k) is built from P(k-1) plus
 * the extra clears / coins / XP, so the board is bought in the order a player
 * would (ring 1 before ring 2 opens, cheap high-value nodes first).
 *
 *   const { hero, config } = checkpointRun("P3", { hero: "rin", stage: "candy_kingdom" });
 *   new World({ hero, seed, run: config });
 *
 * Board coins are what the same purchases cost at today's prices (ring 1 got 40 % cheaper in
 * the economy pass: 3,101 -> 1,862 coins; every checkpoint keeps the ranks it was measured with).
 *
 * Measurement-only liberties: every stage is unlocked (a stage unlock carries
 * no power) and the played hero is unlocked even when the account would not
 * have it yet (P0 Rin = "Rin at fresh-save power").
 */
import type { RunConfig } from "../src/game/run-config";
import { baseStats, finalizeStats, type Stats } from "../src/game/stats";
import { boardProgress } from "../src/meta/board/board";
import { gameContent, type MetaContent } from "../src/meta/content";
import { heroXpForLevel } from "../src/meta/economy";
import { buildRunConfig, relicSlots, type RunPlan } from "../src/meta/loadout";
import { defaultHeroProgress, defaultProfile, type Profile } from "../src/meta/profile";
import { reconcileProfile } from "../src/meta/reconcile";
import { TUNING } from "../src/meta/tuning";
import { grantUnlock } from "../src/meta/unlocks";
import { spendBoard, spendTalents } from "./policy";

export interface Checkpoint {
  id: string;
  /** Intended play time to get here (h), the economy pass's target. */
  hours: number;
  label: string;
  /** Stages cleared, by order (open board rings, stages, twists and the clear-unlocked heroes). */
  clears: number;
  /** Star Coins invested in the Training Arc by then (bought with the simulator's value policy, ring by ring). */
  board: number;
  /** Level of the played hero (its talent points spent by the simulator's policy). */
  heroLevel: number;
  /** Mastery rank of the played hero's signature weapon / of every other weapon in the pool. */
  mastery: number;
  masteryOther: number;
  /** Constellation of the played hero (C0-C6). */
  constellation: number;
  /** Equipped relics [id, stars], best first (trimmed to the relic slots the board gives). */
  relics: [string, number][];
  /** Earnable heroes / general weapons / passives unlocked by then (start content always; signature weapons come with their hero). */
  heroes: string[];
  weapons: string[];
  passives: string[];
  /** Stages this checkpoint is the INTENDED clear power for (~40-70 % mid-bot clears). */
  intended: string[];
  /**
   * Keystones switched on (owned ones; default: the policy's pick). A 150 h player picks survivable
   * ones: the value policy's Glass Cannon (-40 % HP) is a liability against the long stages' damage ramps.
   */
  keystones?: string[];
}

/** The general weapons a player has by the mid game (Paper Crane Flock is the late unlock: 1,000 lifetime evolutions, ~45-55 h). */
const GENERAL_EARLY = ["bubble_tea_cannon", "idol_lightstick_wave", "kotatsu_of_sloth"];
const GENERAL = [...GENERAL_EARLY, "paper_crane_flock"];
const NEW_PASSIVES = ["plot_armor", "main_character_aura", "bento_box", "speed_lines", "inner_monologue", "training_montage", "friendship_bracelet", "chibi_charm"];

export const CHECKPOINTS: readonly Checkpoint[] = [
  { id: "P0", hours: 0, label: "fresh save", clears: 0, board: 0, heroLevel: 1, mastery: 0, masteryOther: 0, constellation: 0, relics: [], heroes: [], weapons: [], passives: [], intended: [] },
  {
    id: "P1",
    hours: 1,
    label: "~6 runs: a few ring-1 nodes",
    clears: 0,
    board: 420,
    heroLevel: 5,
    mastery: 1,
    masteryOther: 0,
    constellation: 0,
    relics: [],
    heroes: ["rin", "mochi"],
    weapons: ["bubble_tea_cannon"],
    passives: ["main_character_aura"],
    intended: [],
  },
  {
    // (verification pass) where a real account sits while it pushes Dream Meadow: the board's ring 1 is
    // done by ~1.1 h (the progression simulator), the hero is only Lv ~6 and the first 10-pull gave an SR
    // (gated by the Dream Meadow clear, the board then stops until the clear: the first clear lands between
    // P1b and P2, i.e. 1.2-3 h)
    id: "P1b",
    hours: 1.2,
    label: "ring 1 done, Lv 6, a first SR",
    clears: 0,
    board: 1862,
    heroLevel: 6,
    mastery: 2,
    masteryOther: 1,
    constellation: 0,
    relics: [["festival_goldfish", 0]],
    heroes: ["rin", "mochi", "kuro"],
    weapons: GENERAL_EARLY,
    passives: ["main_character_aura", "inner_monologue", "training_montage", "speed_lines", "friendship_bracelet", "chibi_charm"],
    intended: [],
  },
  {
    id: "P2",
    hours: 3,
    label: "ring 1 done, a first SR from the Merch Machine",
    clears: 0,
    board: 1862,
    heroLevel: 10,
    mastery: 3,
    masteryOther: 1,
    constellation: 0,
    // (verification pass: the relic sets P2-P5 are what the Merch Machine gives the average player by then -
    // progression snapshots: an SR by ~1 h, SR / SSR pairs by 3-8 h, SSR + SSR + SR by 15 h, two URs by ~30 h;
    // the combat-curve pass had one rarity less at each step)
    relics: [["festival_goldfish", 0]],
    heroes: ["rin", "mochi", "kuro"],
    weapons: GENERAL_EARLY,
    passives: ["main_character_aura", "inner_monologue", "training_montage", "speed_lines", "friendship_bracelet", "chibi_charm"],
    intended: ["dream_meadow"],
  },
  {
    id: "P3",
    hours: 8,
    label: "Dream Meadow cleared, ring 2 mostly, 2 relic slots",
    clears: 1,
    board: 19760,
    heroLevel: 15,
    mastery: 5,
    masteryOther: 2,
    constellation: 0,
    relics: [
      ["transformation_brooch", 0],
      ["mascot_head", 1],
    ],
    heroes: ["rin", "mochi", "kuro", "pudding"],
    weapons: GENERAL_EARLY,
    passives: NEW_PASSIVES,
    intended: ["candy_kingdom"],
  },
  {
    id: "P4",
    hours: 15,
    label: "Candy cleared, ring 3 started, first SSR",
    clears: 2,
    board: 83760,
    heroLevel: 20,
    mastery: 7,
    masteryOther: 4,
    constellation: 0,
    relics: [
      ["protagonist_scarf", 0],
      ["transformation_brooch", 0],
      ["mascot_head", 1],
    ],
    heroes: ["rin", "mochi", "kuro", "pudding", "aoi"],
    weapons: GENERAL_EARLY,
    passives: NEW_PASSIVES,
    intended: ["shoujo_academy"],
  },
  {
    id: "P5",
    hours: 30,
    label: "Academy cleared, ring 4 started, 4 relic slots",
    clears: 3,
    board: 398760,
    heroLevel: 25,
    mastery: 8,
    masteryOther: 5,
    constellation: 1,
    relics: [
      ["directors_cut", 0],
      ["unopened_figure", 0],
      ["transformation_brooch", 1],
      ["protagonist_scarf", 0],
    ],
    heroes: ["rin", "mochi", "kuro", "pudding", "aoi", "akane", "senpai"],
    weapons: GENERAL_EARLY,
    passives: NEW_PASSIVES,
    intended: ["beach_episode", "final_arc"],
  },
  {
    id: "P6",
    hours: 80,
    label: "every stage cleared, ring 5 half, 2 keystones",
    clears: 5,
    board: 2298760,
    heroLevel: 30,
    mastery: 10,
    masteryOther: 7,
    constellation: 2,
    relics: [
      ["sakuga_cel", 1],
      ["directors_cut", 2],
      ["sakura_snow_globe", 4],
      ["red_string_of_fate", 3],
    ],
    heroes: ["rin", "mochi", "kuro", "pudding", "aoi", "akane", "senpai", "magical_girl_47", "isekai_kun"],
    weapons: GENERAL,
    passives: NEW_PASSIVES,
    intended: ["final_arc"],
  },
  {
    id: "P7",
    hours: 150,
    label: "near max: full board, mastery 10, MYTHIC merch",
    clears: 5,
    board: 4854242,
    heroLevel: 30,
    mastery: 10,
    masteryOther: 10,
    constellation: 4,
    relics: [
      ["real_friend", 1],
      ["sakuga_cel", 4],
      ["red_string_of_fate", 5],
      ["directors_cut", 5],
    ],
    keystones: ["plot_armor", "truck_blessing"],
    heroes: ["rin", "mochi", "kuro", "pudding", "aoi", "akane", "senpai", "magical_girl_47", "isekai_kun", "truck_kun"],
    weapons: GENERAL,
    passives: NEW_PASSIVES,
    intended: [],
  },
  {
    // (verification pass) P7 as the average player really has it at ~150 h: the same board / levels / mastery,
    // but the Merch Machine's actual haul (no MYTHIC - the 1,000-pull spark is ~780 pulls away - one LR in two
    // accounts, URs otherwise) and C6 Hoshi from dupes
    id: "P7r",
    hours: 150,
    label: "near max with a realistic gacha haul",
    clears: 5,
    board: 4854242,
    heroLevel: 30,
    mastery: 10,
    masteryOther: 10,
    constellation: 6,
    relics: [
      ["revival_theme", 0],
      ["directors_cut", 1],
      ["unopened_figure", 1],
      ["hot_blooded_bandana", 0],
    ],
    keystones: ["plot_armor", "truck_blessing"],
    heroes: ["rin", "mochi", "kuro", "pudding", "aoi", "akane", "senpai", "magical_girl_47", "isekai_kun", "truck_kun"],
    weapons: GENERAL,
    passives: NEW_PASSIVES,
    intended: [],
  },
];

export const CHECKPOINT_BY_ID: ReadonlyMap<string, Checkpoint> = new Map(CHECKPOINTS.map((c) => [c.id, c]));

/** Plot Twist sets for heat runs (P7): "moderate" heat and every twist at max rank (41). */
export const HEAT_SETS: Readonly<Record<string, Record<string, number>>> = {
  /** heat 12: tougher, busier, faster, nastier, no warnings. */
  mid: { budget_cuts: 3, filler_overload: 2, darker_and_edgier: 2, dub_version: 1, power_creep: 1, spoilers: 1, rushed_production: 1 },
  /** heat 41: everything. */
  max: {
    budget_cuts: 3,
    filler_overload: 2,
    rushed_production: 2,
    dub_version: 2,
    darker_and_edgier: 3,
    studio_change: 1,
    simulcast_delay: 2,
    censored: 2,
    cliffhanger: 2,
    power_creep: 2,
    spoilers: 1,
    shounen_rival: 3,
    sequel_hook: 2,
    mid_season_break: 2,
    light_novel_title: 1,
  },
};

function masteryXp(rank: number): number {
  return rank <= 0 ? 0 : TUNING.mastery.thresholds[Math.min(rank, TUNING.mastery.thresholds.length) - 1];
}

const cache = new Map<string, Profile>();

/**
 * The checkpoint's profile for a played hero (cached; a fresh deep copy each call).
 * Board: each checkpoint's extra coins arrive in 24 chunks (one per "run") and are
 * spent with the simulator's policy with only the rings of that checkpoint open.
 */
export function checkpointProfile(id: string, hero = "hoshi", ctx: MetaContent = gameContent()): Profile {
  const key = `${id}|${hero}`;
  const hit = cache.get(key);
  if (hit) return structuredClone(hit);
  const idx = CHECKPOINTS.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error(`unknown checkpoint ${id}`);
  const p = defaultProfile(0);
  reconcileProfile(p, ctx);
  let invested = 0;
  for (let j = 0; j <= idx; j++) {
    const cp = CHECKPOINTS[j];
    // stage clears (records drive the board ring gates, stage / twist / hero unlocks)
    for (const st of ctx.stages) {
      if (st.order > cp.clears) continue;
      const r = p.records[st.id];
      if (r && r.clears > 0) continue;
      p.records[st.id] = { runs: 1, clears: 1, bestTime: st.duration, bestHeat: 0, bestEndless: 0, bestKills: 0, bestLevel: 0, bestCombo: 0, firstClear: j + 1 };
    }
    for (const h of cp.heroes) grantUnlock(p, h, ctx);
    for (const w of cp.weapons) grantUnlock(p, w, ctx);
    for (const ps of cp.passives) grantUnlock(p, ps, ctx);
    reconcileProfile(p, ctx);
    // board coins, a run's worth at a time
    const delta = Math.max(0, cp.board - invested);
    for (let k = 0; k < 24 && delta > 0; k++) {
      p.currencies.coins += delta / 24;
      spendBoard(p, ctx);
    }
    invested = cp.board;
  }
  const cp = CHECKPOINTS[idx];
  if (cp.keystones) p.board.active = cp.keystones.filter((k) => (p.board.ranks[k] ?? 0) > 0);
  grantUnlock(p, hero, ctx);
  // measurement: every stage playable
  for (const st of ctx.stages) if (!p.unlocks.stages.includes(st.id)) p.unlocks.stages.push(st.id);
  // the played hero: level (talents by the policy), constellation
  const hp = (p.heroes[hero] ??= defaultHeroProgress());
  hp.xp = heroXpForLevel(cp.heroLevel);
  hp.constellation = cp.constellation;
  reconcileProfile(p, ctx);
  spendTalents(p, hero, ctx);
  // mastery: the signature weapon and every other base weapon of the pool
  const sig = ctx.heroById.get(hero)?.weapon;
  for (const w of ctx.baseWeapons) {
    const rank = w.id === sig ? cp.mastery : cp.masteryOther;
    if (rank > 0) p.mastery[w.id] = masteryXp(rank);
  }
  // relics (equipped best first, as many as the slots allow)
  const slots = relicSlots(p);
  for (const [rid, stars] of cp.relics) if (ctx.relics.has(rid)) p.relics[rid] = stars;
  p.loadout.relics = cp.relics.map(([rid]) => rid).filter((rid) => ctx.relics.has(rid)).slice(0, slots);
  p.loadout.hero = hero;
  p.currencies.coins = 0;
  cache.set(key, structuredClone(p));
  return p;
}

export interface CheckpointRunOpts {
  hero?: string;
  stage?: string;
  /** Plot Twists {id: rank} or a HEAT_SETS name. */
  twists?: Record<string, number> | string;
  endless?: boolean;
}

/** The RunPlan (hero + RunConfig, through buildRunConfig) of a checkpoint run. */
export function checkpointRun(id: string, opts: CheckpointRunOpts = {}, ctx: MetaContent = gameContent()): RunPlan {
  const hero = opts.hero ?? "hoshi";
  const p = checkpointProfile(id, hero, ctx);
  const twists = typeof opts.twists === "string" ? (HEAT_SETS[opts.twists] ?? {}) : (opts.twists ?? {});
  return buildRunConfig(p, { hero, stage: opts.stage ?? "dream_meadow", relics: p.loadout.relics, twists, endless: opts.endless ?? false }, ctx);
}

/** One-line summary of what a checkpoint gives (for reports). */
export function checkpointSummary(id: string, hero = "hoshi", ctx: MetaContent = gameContent()): string {
  const p = checkpointProfile(id, hero, ctx);
  const plan = checkpointRun(id, { hero }, ctx);
  const s: Stats = baseStats();
  for (const m of plan.config.mods) m(s);
  finalizeStats(s);
  const bp = boardProgress(p);
  const cfg: RunConfig = plan.config;
  const ks = p.board.active.join("+") || "-";
  return (
    `${id} board ${bp.spent.toLocaleString()} (${bp.ranks}/${bp.totalRanks} ranks, keystones ${ks}) Lv${plan.heroLevel} ` +
    `might x${s.might.toFixed(2)} hp ${s.maxHp} armor ${s.armor} cd x${s.cooldown.toFixed(2)} area x${s.area.toFixed(2)} amount +${s.amount} growth x${s.growth.toFixed(2)} curse ${s.curse.toFixed(2)} ` +
    `start Lv${cfg.start?.level ?? 1} slots ${cfg.weaponSlots}/${cfg.passiveSlots} relics ${cfg.relics?.map((r) => `${r.id}*${r.stars}`).join(",") || "-"} ` +
    `pool ${cfg.weaponPool?.length}w/${cfg.passivePool?.length}p flags ${JSON.stringify(cfg.flags)}`
  );
}
