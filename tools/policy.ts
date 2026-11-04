/**
 * The simulated player's account policy, shared by the progression simulator
 * (tools/progression.sim.ts) and the account-power checkpoints
 * (tools/checkpoints.ts): how board nodes are valued and bought, how talent
 * points are spent and which loadout is picked. One policy, so a checkpoint
 * profile built "by hand" looks like the account the simulator grows.
 */
import type { Stats } from "../src/game/stats";
import { affordableNodes, autoPath, buyNode, toggleKeystone } from "../src/meta/board/board";
import { BOARD } from "../src/meta/board/graph";
import type { BoardNode, NodeEffect } from "../src/meta/board/types";
import type { MetaContent } from "../src/meta/content";
import { allocateTalent, buyHeroLevel, canAllocate, talentPoints } from "../src/meta/heroes";
import { relicSlots, type LoadoutChoice } from "../src/meta/loadout";
import type { Profile } from "../src/meta/profile";
import { heroOrder } from "../src/meta/roster";

/** Rough "power per unit" of each effect (the policy only needs a sensible order). */
export const STAT_VALUE: Partial<Record<keyof Stats, number>> = {
  might: 100,
  maxHp: 0.6,
  regen: 25,
  armor: 4,
  moveSpeed: 50,
  cooldown: -120,
  area: 60,
  amount: 15,
  projSpeed: 20,
  duration: 40,
  pickup: 15,
  crit: 80,
  critMult: 30,
  luck: 20,
  growth: 60,
  greed: 40,
  dashCd: -20,
  knock: 10,
  rerolls: 4,
  cards: 15,
  curse: 15,
  gemFind: 30,
  dmgReduction: 200,
  healMul: 20,
  shield: 15,
};
export const FLAG_VALUE: Record<string, number> = { banish: 3, skip: 2, dashCharges: 8, ultStart: 20, chestLuck: 20, eliteRate: 8, plotArmor: 25, friendship: 500, revives: 20, freeRerolls: 30 };

export function effectValue(e: NodeEffect): number {
  switch (e.t) {
    case "stat":
      return (STAT_VALUE[e.stat] ?? 5) * e.per;
    case "statPct":
      return (e.stat === "maxHp" ? 60 : 30) * e.per;
    case "flag":
      return (FLAG_VALUE[e.flag] ?? 5) * e.per;
    case "slot":
      // (a relic slot holds a whole relic: a player buys it as soon as there is merch to put in it)
      return e.slot === "weapon" ? 25 : e.slot === "relic" ? 60 : 15;
    case "startLevel":
      return 5 * e.per;
    case "startWeapon":
      return 10;
  }
}

/** Board value of one more rank of a node (keystones: their absolute value + a bonus for being build-defining). */
export function nodeValue(n: BoardNode): number {
  const v = n.effects.reduce((a, e) => a + Math.abs(effectValue(e)) * (effectValue(e) < 0 ? -0.6 : 1), 0);
  return n.kind === "keystone" ? Math.max(5, v) + 10 : Math.max(0.5, v);
}

/** Spend the profile's coins on the board (best value / cost first), then fill the keystone slots. Returns ranks bought. */
export function spendBoard(p: Profile, ctx: MetaContent): number {
  const plan = autoPath(p, ctx, { score: (n, _r, cost) => nodeValue(n) / Math.max(1, cost) });
  let bought = 0;
  for (const step of plan) {
    if (!buyNode(p, step.id, ctx).ok) break;
    bought++;
  }
  // fill keystone slots with the most valuable owned keystones
  const owned = BOARD.nodes.filter((n) => n.kind === "keystone" && (p.board.ranks[n.id] ?? 0) > 0).sort((a, b) => nodeValue(b) - nodeValue(a));
  for (const k of owned) if (!p.board.active.includes(k.id)) toggleKeystone(p, k.id);
  return bought;
}

/** Spend a hero's free talent points: commit to the branch with the most points (ties: branch 0), deepest affordable tier first. */
export function spendTalents(p: Profile, hero: string, ctx: MetaContent): void {
  const tree = ctx.talents.get(hero);
  const hp = p.heroes[hero];
  if (!tree || !hp) return;
  for (let guard = 0; guard < 200 && talentPoints(hp).free > 0; guard++) {
    const byBranch = [0, 1, 2].map((b) => tree.nodes.filter((n) => n.branch === b).reduce((a, n) => a + (hp.talents[n.id] ?? 0), 0));
    const order = [0, 1, 2].sort((a, b) => byBranch[b] - byBranch[a] || a - b);
    let done = false;
    for (const b of order) {
      const nodes = tree.nodes.filter((n) => n.branch === b).sort((x, y) => y.tier - x.tier);
      const pick = nodes.find((n) => canAllocate(p, hero, n.id, ctx).ok);
      if (pick) {
        allocateTalent(p, hero, pick.id, ctx);
        done = true;
        break;
      }
    }
    if (!done) break;
  }
}

export const RARITY_RANK: Record<string, number> = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4, LR: 5, MYTHIC: 6 };

/** The loadout a player would pick: the furthest unlocked stage, the main hero, the best relics. */
export function chooseLoadout(p: Profile, ctx: MetaContent): LoadoutChoice {
  const stages = ctx.stages.filter((s) => p.unlocks.stages.includes(s.id));
  const stage = stages[stages.length - 1]?.id ?? ctx.stages[0].id;
  const heroes = p.unlocks.heroes.filter((h) => ctx.heroById.has(h));
  // the main hero: the one played most; ties go to the earlier roster hero (the starting hero), never to
  // XP (a try-out run with catch-up XP would otherwise steal the main slot when every hero has one run)
  const hero = heroes.sort((a, b) => (p.heroes[b]?.runs ?? 0) - (p.heroes[a]?.runs ?? 0) || heroOrder(a) - heroOrder(b))[0] ?? "hoshi";
  return { stage, hero, relics: bestRelics(p, ctx), twists: {}, endless: false };
}

/** The best owned relics for the relic slots (rarity, then stars, then id). */
export function bestRelics(p: Profile, ctx: MetaContent): string[] {
  return Object.keys(p.relics)
    .filter((id) => ctx.relics.has(id))
    .sort((a, b) => RARITY_RANK[ctx.relics.get(b)!.rarity] - RARITY_RANK[ctx.relics.get(a)!.rarity] || p.relics[b] - p.relics[a] || (a < b ? -1 : 1))
    .slice(0, relicSlots(p));
}

/**
 * Plot Twist heat ladder (the simulator's endgame): single-rank steps in the order a player
 * would stack them (the moderate "heat 12" set first, then everything else), every twist at
 * its max rank at the end (heat 41, checkpoints.ts HEAT_SETS.max).
 */
export const TWIST_LADDER: readonly string[] = [
  "budget_cuts",
  "filler_overload",
  "dub_version",
  "power_creep",
  "spoilers",
  "rushed_production",
  "budget_cuts",
  "darker_and_edgier",
  "filler_overload",
  "budget_cuts",
  "darker_and_edgier",
  "light_novel_title",
  "studio_change",
  "simulcast_delay",
  "censored",
  "cliffhanger",
  "shounen_rival",
  "sequel_hook",
  "mid_season_break",
  "rushed_production",
  "dub_version",
  "power_creep",
  "darker_and_edgier",
  "simulcast_delay",
  "censored",
  "cliffhanger",
  "shounen_rival",
  "sequel_hook",
  "mid_season_break",
  "shounen_rival",
];
/** Heat of the whole ladder (every twist at max rank). */
export const TWIST_LADDER_MAX = 41;

/** The twists {id: rank} for at least `heat` (unlocked twists only, ladder order). */
export function twistsForHeat(heat: number, p: Profile, ctx: MetaContent): Record<string, number> {
  const out: Record<string, number> = {};
  if (heat <= 0) return out;
  let h = 0;
  for (const id of TWIST_LADDER) {
    if (h >= heat) break;
    const d = ctx.twists.get(id);
    if (!d || !p.unlocks.twists.includes(id)) continue;
    const r = out[id] ?? 0;
    if (r >= d.maxRank) continue;
    out[id] = r + 1;
    h += d.heat[r] ?? 0;
  }
  return out;
}

/**
 * The dead-zone fallback: with nothing open on the board (every open ring bought, the next ring
 * still gated by a stage clear), coins go into the hero-level accelerator for `hero` (buyHeroLevel,
 * TUNING.hero.levelUpCoinsPerXp) instead of piling up. Returns levels bought.
 */
export function spendHeroLevels(p: Profile, hero: string, ctx: MetaContent): number {
  const save = p.currencies.coins;
  p.currencies.coins = Number.MAX_SAFE_INTEGER;
  const open = affordableNodes(p, ctx).length > 0;
  p.currencies.coins = save;
  if (open) return 0;
  let n = 0;
  for (let guard = 0; guard < 30; guard++) {
    if (!buyHeroLevel(p, hero).ok) break;
    n++;
  }
  if (n) spendTalents(p, hero, ctx);
  return n;
}
