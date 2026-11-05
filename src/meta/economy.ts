/**
 * Economy formulas (docs/EXPANSION.md §3, §4, §6, §7): results grade, the
 * line-by-line run payout ("Episode Results"), hero XP and level curve, weapon
 * mastery curve, coin costs. All numbers come from TUNING (src/meta/tuning.ts).
 * PURE.
 */
import type { RunStats } from "../game/run-config";
import type { StageInfo } from "../game/defs";
import { TUNING } from "./tuning";
import { sumValues } from "./util";

// ---------------------------------------------------------------- grade

export type Grade = "D" | "C" | "B" | "A" | "S" | "SS";
export const GRADES: readonly Grade[] = ["D", "C", "B", "A", "S", "SS"];

/** Total kills of a run. */
export function runKills(s: Pick<RunStats, "killsByEnemy">): number {
  return sumValues(s.killsByEnemy);
}

/**
 * Results grade. A death scores time, kills, level and combo (D..A); a clear
 * is A, S with little damage taken, SS with almost none and an SSS combo rank.
 */
export function gradeRun(s: RunStats): Grade {
  const G = TUNING.grade;
  if (s.stageCleared) {
    if (s.damageTaken < G.clearSS && s.maxRank >= 5) return "SS";
    return s.damageTaken < G.clearS ? "S" : "A";
  }
  const score = s.time / 60 + runKills(s) / G.scoreKills + s.level / G.scoreLevel + s.maxCombo / G.scoreCombo;
  return score > G.deathA ? "A" : score > G.deathB ? "B" : score > G.deathC ? "C" : "D";
}

export function gradeMul(g: Grade): number {
  return TUNING.payout.gradeMul[g] ?? 1;
}

// ---------------------------------------------------------------- payout

/** One line of the results payout. Lines are shown in order and their `amount`s add up to the total. */
export interface PayoutLine {
  id: string;
  label: string;
  /** What this line adds (for multiplier lines: the delta the multiplier added). */
  amount: number;
  /** Multiplier lines: the factor (x1.35). */
  mul?: number;
  /** Small print under the label ("12:34 survived", "3,021 kills"). */
  detail?: string;
}

export interface PayoutPart {
  lines: PayoutLine[];
  total: number;
}

export interface PayoutInput {
  stats: RunStats;
  stage: StageInfo | undefined;
  grade: Grade;
  /** First clear of this stage (pays firstClearGems). */
  firstClear: boolean;
  /** Bosses killed for the first time ever this run. */
  firstBossKills: string[];
  /** Heat badges (TUNING.payout.heatBadges) reached for the first time on this stage. */
  newHeatBadges: number[];
  /** Display names. */
  names?: (id: string) => string;
}

export interface Payout {
  coins: PayoutPart;
  gems: PayoutPart;
}

/** 12,361 (payout detail lines; locale-independent so results read the same everywhere). */
const grouped = (n: number): string => String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const fmtMin = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Sequential payout builder: additive lines, then multipliers applied to the running total. */
class Ledger {
  lines: PayoutLine[] = [];
  total = 0;
  add(id: string, label: string, amount: number, detail?: string): void {
    const a = Math.max(0, Math.round(amount));
    if (a <= 0) return;
    this.lines.push({ id, label, amount: a, detail });
    this.total += a;
  }
  /** A multiplier on part of the running total (`base`): adds base x (m - 1), shown as "xm". */
  scale(id: string, label: string, base: number, m: number, detail?: string): void {
    if (!(m > 0) || Math.abs(m - 1) < 1e-9 || base <= 0) return;
    const a = Math.round(base * (m - 1));
    if (a === 0 || this.total + a < 0) return;
    this.lines.push({ id, label, amount: a, mul: Math.round(m * 100) / 100, detail });
    this.total += a;
  }
  mul(id: string, label: string, m: number, detail?: string): void {
    if (!(m > 0) || Math.abs(m - 1) < 1e-9 || this.total <= 0) return;
    const next = Math.max(0, Math.round(this.total * m));
    if (next === this.total) return; // a multiplier too small to show on this total
    this.lines.push({ id, label, amount: next - this.total, mul: Math.round(m * 100) / 100, detail });
    this.total = next;
  }
  part(): PayoutPart {
    return { lines: this.lines, total: this.total };
  }
}

/** Index of a boss in its stage's boss list (unknown -> the first slot). */
function bossIndex(stage: StageInfo | undefined, id: string): number {
  const i = stage ? stage.bosses.indexOf(id) : -1;
  return i < 0 ? 0 : i;
}

/** Coin value of a boss kill. */
export function bossCoins(stage: StageInfo | undefined, id: string): number {
  const t = TUNING.payout.bossCoins;
  const i = bossIndex(stage, id);
  return t[Math.min(t.length - 1, i)];
}

/**
 * A stage's reward multipliers ("Ratings", StageInfo.rewardMul): coins get the whole
 * multiplier, run gems and hero XP a gentler power of it (TUNING.payout.gemStageExp /
 * TUNING.hero.xpStageExp), so later stages pay many more coins without flooding the
 * Merch Machine or the hero levels.
 */
export function stageRewardMul(stage: StageInfo | undefined, what: "coins" | "gems" | "xp" = "coins"): number {
  const m = Math.max(0, stage?.rewardMul ?? 1);
  if (what === "coins") return m;
  return Math.pow(m, what === "gems" ? TUNING.payout.gemStageExp : TUNING.hero.xpStageExp);
}

/** Heat reward multiplier: x (1 + heat x per). */
export function heatMul(heat: number, per: number): number {
  return 1 + Math.max(0, heat) * per;
}

/**
 * The run payout, line by line: coins (picked up, then the episode bonuses - time,
 * kills, each boss, clear, endless - with greed, the rank and the stage's Ratings on
 * the bonuses, then heat / curse on everything) and gems
 * (trickle, gem find, heat, first clear, first boss kills, heat badges).
 * Codex bounties are added by applyRunToProfile.
 */
export function computePayout(inp: PayoutInput): Payout {
  const P = TUNING.payout;
  const s = inp.stats;
  const name = inp.names ?? ((id: string) => id);
  const kills = runKills(s);
  const stageMul = stageRewardMul(inp.stage, "coins");
  const stageGemMul = stageRewardMul(inp.stage, "gems");
  const curse = Math.max(0, s.curse ?? 0);
  const final = inp.stage && inp.stage.bosses.length > 0 ? inp.stage.bosses[inp.stage.bosses.length - 1] : undefined;
  const c = new Ledger();
  c.add("picked", "Coins picked up", s.coins);
  // (the first P.earlySeconds count double: even a 90 s death buys a cheap board node, and quitting early never pays more)
  const early = Math.min(s.time, P.earlySeconds);
  c.add("time", "Time bonus", ((early * (1 + P.earlyBoost) + Math.max(0, s.time - early)) / 60) * P.coinsPerMinute, `${fmtMin(s.time)} survived`);
  c.add("kills", "Kill bonus", kills * P.coinsPerKill + s.eliteKills * P.coinsPerElite, `${grouped(kills)} kill${kills === 1 ? "" : "s"}${s.eliteKills ? `, ${grouped(s.eliteKills)} elite${s.eliteKills === 1 ? "" : "s"}` : ""}`);
  for (let i = 0; i < s.bossKills.length; i++) {
    const b = s.bossKills[i];
    c.add(`boss:${b}:${i}`, name(b), bossCoins(inp.stage, b), b === final ? "Final boss" : "Boss");
  }
  if (s.stageCleared) c.add("clear", "Stage clear", P.clearCoins, inp.stage?.name);
  if (s.endlessTime > 0) c.add("endless", "Filler Arc bonus", (s.endlessTime / 60) * P.endlessCoinsPerMinute, `${fmtMin(s.endlessTime)} of filler`);
  // The EPISODE BONUSES (time, kills, bosses, clear, endless) get greed, the rank and the
  // stage's "Ratings"; the coins picked up count as they are (they already include greed, and
  // they grow with raw power - a maxed build's Star Pouches - not with the stage). Heat and
  // curse multiply everything.
  const picked = c.lines.length && c.lines[0].id === "picked" ? c.lines[0].amount : 0;
  c.scale("greed", "Greed", c.total - picked, Math.max(1, s.greed ?? 1), "Coin bonuses");
  c.scale("grade", `Rank ${inp.grade}`, c.total - picked, gradeMul(inp.grade), "Coin bonuses");
  c.scale("stage", inp.stage ? inp.stage.name : "Stage", c.total - picked, stageMul, "Ratings: coin bonuses");
  c.mul("heat", `Heat ${s.heat}`, heatMul(s.heat, P.heatCoinPer), "Plot Twists");
  c.mul("curse", "Curse", heatMul(curse, P.curseRewardPer), "More enemies, more rewards");

  const g = new Ledger();
  // the flat stipend is earned over the first minute: an instant quit (pause -> DROP) pays ~0, so a
  // RETRY / quit loop never farms gems (or their heat / curse / stage multipliers) without any risk
  const stipend = P.gemsPerRun * Math.min(1, Math.max(0, s.time) / P.stipendSeconds);
  g.add("trickle", "Episode stipend", stipend + (s.time / 60) * P.gemsPerMinute + (s.endlessTime / 60) * P.endlessGemsPerMinute);
  g.mul("gemFind", "Gem find", Math.max(0, s.gemFind ?? 1));
  g.mul("heat", `Heat ${s.heat}`, heatMul(s.heat, P.heatGemPer));
  g.mul("curse", "Curse", heatMul(curse, P.curseRewardPer));
  g.mul("stage", inp.stage ? inp.stage.name : "Stage", stageGemMul);
  if (inp.firstClear && inp.stage) {
    const t = P.firstClearGems;
    g.add("firstClear", "FIRST CLEAR!", t[Math.min(t.length - 1, Math.max(0, inp.stage.order - 1))], inp.stage.name);
  }
  for (const b of inp.firstBossKills) g.add(`firstKill:${b}`, `First kill: ${name(b)}`, b === final ? P.finalBossFirstKillGems : P.bossFirstKillGems);
  for (const h of inp.newHeatBadges) {
    const i = P.heatBadges.indexOf(h);
    if (i >= 0) g.add(`badge:${h}`, `Heat ${h} badge`, P.heatBadgeGems[i], inp.stage?.name);
  }
  return { coins: c.part(), gems: g.part() };
}

/** Heat badges reached by clearing at `heat` that are above `previousBest` (-1 = never cleared). */
export function newHeatBadges(heat: number, previousBest: number): number[] {
  return TUNING.payout.heatBadges.filter((b) => heat >= b && previousBest < b);
}

// ---------------------------------------------------------------- hero XP / levels

/** Hero XP needed to go from `level` to `level + 1` (Infinity at max level). */
export function heroXpToNext(level: number): number {
  const H = TUNING.hero;
  if (level >= H.maxLevel) return Infinity;
  const L = Math.max(1, level);
  return Math.round(H.xpBase * Math.pow(L, H.xpExp) * Math.pow(H.xpGrowth, L - 1));
}

/** Total hero XP needed to reach `level` from level 1. */
export function heroXpForLevel(level: number): number {
  let t = 0;
  const top = Math.min(level, TUNING.hero.maxLevel);
  for (let L = 1; L < top; L++) t += heroXpToNext(L);
  return t;
}

export interface LevelInfo {
  level: number;
  /** XP into the current level. */
  into: number;
  /** XP the current level needs (Infinity at max). */
  need: number;
  maxed: boolean;
}

/** Hero level from total XP. */
export function heroLevelInfo(xp: number): LevelInfo {
  const max = TUNING.hero.maxLevel;
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (level < max) {
    const need = heroXpToNext(level);
    if (rest < need) return { level, into: rest, need, maxed: false };
    rest -= need;
    level++;
  }
  return { level: max, into: 0, need: Infinity, maxed: true };
}

export function heroLevel(xp: number): number {
  return heroLevelInfo(xp).level;
}

/** Hero XP earned by a run (time, kills, bosses, clear; x stage reward). */
export function heroXpForRun(s: RunStats, stage: StageInfo | undefined): number {
  const H = TUNING.hero;
  const raw = s.time * H.xpPerSecond + runKills(s) * H.xpPerKill + s.bossKills.length * H.xpPerBoss + (s.stageCleared ? H.xpPerClear : 0);
  return Math.max(0, Math.round(raw * stageRewardMul(stage, "xp")));
}

/** Coins to buy the rest of the current level ("optional accelerator"); 0 at max level. */
export function heroLevelUpCost(xp: number): number {
  const li = heroLevelInfo(xp);
  if (li.maxed) return 0;
  return Math.max(1, Math.ceil((li.need - li.into) * TUNING.hero.levelUpCoinsPerXp));
}

/** Talent points a hero level grants. */
export function talentPointsAt(level: number): number {
  return Math.max(0, Math.floor(level)) * TUNING.hero.pointsPerLevel;
}

/** Coins to reset a hero's talents (cheap so players experiment). */
export function talentRespecCost(pointsSpent: number): number {
  return pointsSpent <= 0 ? 0 : TUNING.hero.respecBase + TUNING.hero.respecPerPoint * pointsSpent;
}

// ---------------------------------------------------------------- weapon mastery

/** Mastery XP earned from damage dealt. */
export function masteryXpForDamage(damage: number): number {
  return Math.max(0, Math.floor(damage * TUNING.mastery.xpPerDamage));
}

export interface MasteryInfo {
  rank: number;
  /** XP into the current rank. */
  into: number;
  /** XP the next rank needs from the current threshold (Infinity at max). */
  need: number;
  maxed: boolean;
}

/** Mastery rank (0..10) from XP. */
export function masteryInfo(xp: number): MasteryInfo {
  const T = TUNING.mastery.thresholds;
  let rank = 0;
  while (rank < T.length && xp >= T[rank]) rank++;
  if (rank >= T.length) return { rank: T.length, into: 0, need: Infinity, maxed: true };
  const base = rank === 0 ? 0 : T[rank - 1];
  return { rank, into: xp - base, need: T[rank] - base, maxed: false };
}

export function masteryRank(xp: number): number {
  return masteryInfo(xp).rank;
}

/** Extra max weapon levels at a mastery rank (rank 5: +1 "Limit Break", rank 10: +2). */
export function masteryLevelBonus(rank: number): number {
  let b = 0;
  for (const [r, bonus] of TUNING.mastery.levelBonus) if (rank >= r) b = Math.max(b, bonus);
  return b;
}

/** Extra damage (additive fraction) with the weapon at a mastery rank. */
export function masteryDamage(rank: number): number {
  return Math.max(0, rank) * TUNING.mastery.mightPerRank;
}

// ---------------------------------------------------------------- gem exchange

/** Joke Gem Exchange: how many gems `coins` buys (whole batches only). */
export function gemExchangeQuote(coins: number): { batches: number; coins: number; gems: number } {
  const E = TUNING.gemExchange;
  const batches = Math.max(0, Math.floor(coins / E.coins));
  return { batches, coins: batches * E.coins, gems: batches * E.gems };
}
