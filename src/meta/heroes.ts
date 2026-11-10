/**
 * Hero progression (docs/EXPANSION.md §6): levels 1-30 from hero XP, one
 * talent point per level, talent allocation over the sim's TalentTree
 * registry (3 branches x 5 tiers, ranks per node, tier gating by points spent
 * in the branch's lower tiers = TALENT_TIER_POINTS, `requires` links), refunds
 * that never break other talents, a cheap coin respec, and constellations
 * C0-C6 from gacha dupes. PURE.
 */
import { TALENT_TIER_POINTS, type TalentNode, type TalentTree } from "../game/defs";
import { gameContent, type MetaContent } from "./content";
import { heroLevelInfo, heroLevelUpCost, heroXpForLevel, talentPointsAt, talentRespecCost, type LevelInfo } from "./economy";
import { defaultHeroProgress, type HeroProgress, type Profile } from "./profile";
import { ROSTER_BY_ID } from "./roster";
import { TUNING } from "./tuning";
import { addId, sumValues } from "./util";

// ---------------------------------------------------------------- basics

export function isHeroUnlocked(p: Profile, id: string): boolean {
  return p.unlocks.heroes.includes(id);
}

/** The hero's progress record (created on first access). */
export function heroProgress(p: Profile, id: string): HeroProgress {
  return (p.heroes[id] ??= defaultHeroProgress());
}

/** Unlock a hero (creates its progress). Returns true if it was new. */
export function unlockHero(p: Profile, id: string): boolean {
  heroProgress(p, id);
  return addId(p.unlocks.heroes, id);
}

export interface TalentPoints {
  total: number;
  spent: number;
  free: number;
}

export function talentPointsSpent(hp: HeroProgress): number {
  return sumValues(hp.talents);
}

export function talentPoints(hp: HeroProgress): TalentPoints {
  const total = talentPointsAt(hp.level);
  const spent = talentPointsSpent(hp);
  return { total, spent, free: Math.max(0, total - spent) };
}

export interface HeroView {
  id: string;
  name: string;
  unlocked: boolean;
  /** Registered in the sim (playable). */
  playable: boolean;
  level: LevelInfo;
  points: TalentPoints;
  constellation: number;
  hp: HeroProgress;
}

export function heroView(p: Profile, id: string, ctx: MetaContent = gameContent()): HeroView {
  const hp = p.heroes[id] ?? defaultHeroProgress();
  const info = ctx.heroById.get(id);
  return {
    id,
    name: info?.name ?? ROSTER_BY_ID.get(id)?.name ?? id,
    unlocked: isHeroUnlocked(p, id),
    playable: !!info,
    level: heroLevelInfo(hp.xp),
    points: talentPoints(hp),
    constellation: hp.constellation,
    hp,
  };
}

// ---------------------------------------------------------------- XP / levels

export interface XpGain {
  hero: string;
  gained: number;
  before: LevelInfo;
  after: LevelInfo;
  /** Levels reached by this gain, in order. */
  levelUps: number[];
  pointsGained: number;
}

/** Add hero XP (levels follow automatically). */
export function addHeroXp(p: Profile, id: string, xp: number): XpGain {
  const hp = heroProgress(p, id);
  const before = heroLevelInfo(hp.xp);
  const gained = Math.max(0, Math.floor(xp));
  // stop counting XP past the max level (keeps the save small and the bar honest)
  const cap = heroXpForLevel(TUNING.hero.maxLevel);
  hp.xp = Math.min(cap, hp.xp + gained);
  const after = heroLevelInfo(hp.xp);
  hp.level = after.level;
  const levelUps: number[] = [];
  for (let L = before.level + 1; L <= after.level; L++) levelUps.push(L);
  return { hero: id, gained, before, after, levelUps, pointsGained: talentPointsAt(after.level) - talentPointsAt(before.level) };
}

/** "Optional accelerator": pay coins for the rest of the current level. */
export function buyHeroLevel(p: Profile, id: string): { ok: boolean; cost: number; level: number; reason?: "locked" | "maxed" | "coins" } {
  if (!isHeroUnlocked(p, id)) return { ok: false, cost: 0, level: 0, reason: "locked" };
  const hp = heroProgress(p, id);
  const li = heroLevelInfo(hp.xp);
  if (li.maxed) return { ok: false, cost: 0, level: li.level, reason: "maxed" };
  const cost = heroLevelUpCost(hp.xp);
  if (p.currencies.coins < cost) return { ok: false, cost, level: li.level, reason: "coins" };
  p.currencies.coins -= cost;
  hp.xp += li.need - li.into;
  hp.level = heroLevelInfo(hp.xp).level;
  return { ok: true, cost, level: hp.level };
}

// ---------------------------------------------------------------- talents

export type TalentBlock = "unknown" | "locked" | "maxed" | "points" | "tier" | "requires";

/** Points spent in `branch` on nodes of tier < `tier`. */
export function branchPointsBelow(tree: TalentTree, ranks: Readonly<Record<string, number>>, branch: number, tier: number): number {
  let s = 0;
  for (const n of tree.nodes) if (n.branch === branch && n.tier < tier) s += ranks[n.id] ?? 0;
  return s;
}

/** Points spent in a branch (all tiers). */
export function branchPoints(tree: TalentTree, ranks: Readonly<Record<string, number>>, branch: number): number {
  return branchPointsBelow(tree, ranks, branch, Infinity);
}

/** Points in lower tiers of the branch needed before a node of `tier` can take a rank. */
export function tierRequirement(tier: number): number {
  return TALENT_TIER_POINTS[Math.max(0, Math.min(TALENT_TIER_POINTS.length - 1, tier - 1))] ?? 0;
}

function nodeOk(tree: TalentTree, ranks: Readonly<Record<string, number>>, n: TalentNode): TalentBlock | undefined {
  if (branchPointsBelow(tree, ranks, n.branch, n.tier) < tierRequirement(n.tier)) return "tier";
  for (const r of n.requires ?? []) if ((ranks[r] ?? 0) < 1) return "requires";
  return undefined;
}

export function canAllocate(p: Profile, hero: string, talentId: string, ctx: MetaContent = gameContent()): { ok: boolean; block?: TalentBlock } {
  const tree = ctx.talents.get(hero);
  const n = tree?.nodes.find((x) => x.id === talentId);
  if (!tree || !n) return { ok: false, block: "unknown" };
  if (!isHeroUnlocked(p, hero)) return { ok: false, block: "locked" };
  const hp = heroProgress(p, hero);
  const rank = hp.talents[talentId] ?? 0;
  if (rank >= n.maxRank) return { ok: false, block: "maxed" };
  if (talentPoints(hp).free <= 0) return { ok: false, block: "points" };
  const b = nodeOk(tree, hp.talents, n);
  return b ? { ok: false, block: b } : { ok: true };
}

export function allocateTalent(p: Profile, hero: string, talentId: string, ctx: MetaContent = gameContent()): { ok: boolean; block?: TalentBlock; rank?: number } {
  const c = canAllocate(p, hero, talentId, ctx);
  if (!c.ok) return c;
  const hp = heroProgress(p, hero);
  hp.talents[talentId] = (hp.talents[talentId] ?? 0) + 1;
  return { ok: true, rank: hp.talents[talentId] };
}

/** True if every owned talent still satisfies its tier / requires rules under `ranks`. */
export function talentsValid(tree: TalentTree, ranks: Readonly<Record<string, number>>): boolean {
  for (const n of tree.nodes) if ((ranks[n.id] ?? 0) > 0 && nodeOk(tree, ranks, n)) return false;
  return true;
}

/** Remove one rank of a talent (free), refused if another talent would lose its tier / requirement. */
export function refundTalent(p: Profile, hero: string, talentId: string, ctx: MetaContent = gameContent()): { ok: boolean; reason?: "unknown" | "unowned" | "breaks" } {
  const tree = ctx.talents.get(hero);
  if (!tree || !tree.nodes.some((x) => x.id === talentId)) return { ok: false, reason: "unknown" };
  const hp = heroProgress(p, hero);
  const rank = hp.talents[talentId] ?? 0;
  if (rank <= 0) return { ok: false, reason: "unowned" };
  const next = { ...hp.talents };
  if (rank === 1) delete next[talentId];
  else next[talentId] = rank - 1;
  if (!talentsValid(tree, next)) return { ok: false, reason: "breaks" };
  hp.talents = next;
  return { ok: true };
}

/** Coins to reset a hero's talents now. */
export function talentResetCost(p: Profile, hero: string): number {
  return talentRespecCost(talentPointsSpent(heroProgress(p, hero)));
}

/** Reset every talent of a hero for TUNING.hero.respec* coins. */
export function resetTalents(p: Profile, hero: string): { ok: boolean; cost: number; reason?: "empty" | "coins" } {
  const hp = heroProgress(p, hero);
  const spent = talentPointsSpent(hp);
  if (spent <= 0) return { ok: false, cost: 0, reason: "empty" };
  const cost = talentRespecCost(spent);
  if (p.currencies.coins < cost) return { ok: false, cost, reason: "coins" };
  p.currencies.coins -= cost;
  hp.talents = {};
  hp.talentRespecs++;
  return { ok: true, cost };
}

/**
 * Repair a talent allocation against its tree and point budget: unknown ids
 * dropped, ranks clamped, rule-breaking nodes removed (highest tier first),
 * then over-budget points removed from the highest tiers. Returns the repaired ranks.
 */
export function repairTalents(tree: TalentTree | undefined, ranks: Readonly<Record<string, number>>, budget: number): Record<string, number> {
  if (!tree) return {};
  const out: Record<string, number> = {};
  for (const n of tree.nodes) {
    const r = Math.min(n.maxRank, Math.max(0, Math.floor(ranks[n.id] ?? 0)));
    if (r > 0) out[n.id] = r;
  }
  const byTierDesc = [...tree.nodes].sort((a, b) => b.tier - a.tier || (a.id < b.id ? 1 : -1));
  for (let guard = 0; guard < 100 && !talentsValid(tree, out); guard++) {
    const bad = byTierDesc.find((n) => (out[n.id] ?? 0) > 0 && nodeOk(tree, out, n));
    if (!bad) break;
    delete out[bad.id];
  }
  let over = sumValues(out) - Math.max(0, budget);
  for (const n of byTierDesc) {
    if (over <= 0) break;
    const r = out[n.id] ?? 0;
    if (r <= 0) continue;
    const take = Math.min(r, over);
    if (r - take > 0) out[n.id] = r - take;
    else delete out[n.id];
    over -= take;
  }
  // removing budget may have broken lower-tier gates for higher nodes: re-validate
  for (let guard = 0; guard < 100 && !talentsValid(tree, out); guard++) {
    const bad = byTierDesc.find((n) => (out[n.id] ?? 0) > 0 && nodeOk(tree, out, n));
    if (!bad) break;
    delete out[bad.id];
  }
  return out;
}

// ---------------------------------------------------------------- constellations

export interface ConstellationGain {
  /** "new" = the hero was unlocked; "constellation" = +1 star; "copium" = already C6. */
  result: "new" | "constellation" | "copium";
  constellation: number;
}

/** A gacha copy of a hero: unlock, or +1 constellation up to C6, or overflow. */
export function addHeroCopy(p: Profile, hero: string): ConstellationGain {
  if (unlockHero(p, hero)) return { result: "new", constellation: heroProgress(p, hero).constellation };
  const hp = heroProgress(p, hero);
  if (hp.constellation >= TUNING.constellation.max) return { result: "copium", constellation: hp.constellation };
  hp.constellation++;
  return { result: "constellation", constellation: hp.constellation };
}
