/**
 * Helpers shared by the Plot Point definition files (no `achievements`
 * export: the registry skips this file). Every helper reads only the AchCtx
 * (profile, lifetime incl. the evaluated run, the run itself, content) and
 * never throws on missing data: content that has not shipped yet simply
 * keeps its achievement locked.
 */
import { masteryRank } from "../../economy";
import { stageByOrder } from "../../content";
import { talentPointsSpent } from "../../heroes";
import type { AchCtx } from "../types";

/** The 12 bosses of Season 2 (docs/content/enemies.md §5), for "Villain of the Week, Every Week". */
export const BOSS_IDS: readonly string[] = [
  "king_puff",
  "nightmare_teddy",
  "lady_lunatic",
  "gingerbread_golem",
  "sugar_plum_tyrant",
  "council_president",
  "bishounen",
  "kraken_chan",
  "firework_dragon",
  "truck_kun_boss",
  "rival_chan",
  "cancel_sama",
];

/** Defeats of one boss (lifetime incl. the evaluated run), capped at 1 for "defeat X" feats. */
export function bossDown(c: AchCtx, id: string): number {
  return Math.min(1, c.life.bossKills[id] ?? 0);
}

/** Total boss defeats. */
export function bossTotal(c: AchCtx): number {
  let n = 0;
  for (const k in c.life.bossKills) n += c.life.bossKills[k];
  return n;
}

/** Has this hero cleared a stage (lifetime, or the evaluated run)? */
export function heroCleared(c: AchCtx, hero: string): boolean {
  return c.life.heroesCleared.includes(hero) || (!!c.run && c.run.stageCleared && c.run.hero === hero);
}

/** Heroes that cleared a stage (lifetime + the evaluated run). */
export function heroesClearedCount(c: AchCtx): number {
  const L = c.life.heroesCleared;
  const r = c.run;
  return L.length + (r && r.stageCleared && !L.includes(r.hero) ? 1 : 0);
}

/** A weapon (base or evolution) is in the codex, or was held in the evaluated run. */
export function weaponSeen(c: AchCtx, id: string): boolean {
  return c.p.codex.weapons.includes(id) || !!c.run?.weaponsUsed?.includes(id);
}

/** Number of discovered codex weapons that are base weapons (`evolved = false`) or evolutions (`true`). */
export function codexWeapons(c: AchCtx, evolved: boolean): number {
  const seen = new Set(c.p.codex.weapons);
  for (const id of c.run?.weaponsUsed ?? []) seen.add(id);
  let n = 0;
  for (const id of seen) {
    const w = c.ctx.weapons.get(id);
    if (w && w.evolved === evolved) n++;
  }
  return n;
}

/** Weapons with mastery rank >= `rank`. */
export function masteryAtLeast(c: AchCtx, rank: number): number {
  let n = 0;
  for (const id in c.p.mastery) if (masteryRank(c.p.mastery[id]) >= rank) n++;
  return n;
}

/** Best mastery rank of any weapon. */
export function bestMastery(c: AchCtx): number {
  let m = 0;
  for (const id in c.p.mastery) m = Math.max(m, masteryRank(c.p.mastery[id]));
  return m;
}

/** Highest hero level / constellation on the account. */
export function bestHeroLevel(c: AchCtx): number {
  let m = 0;
  for (const id in c.p.heroes) m = Math.max(m, c.p.heroes[id].level);
  return m;
}
export function bestConstellation(c: AchCtx): number {
  let m = 0;
  for (const id in c.p.heroes) m = Math.max(m, c.p.heroes[id].constellation);
  return m;
}

/** Heroes at level >= `lv`. */
export function heroesAtLevel(c: AchCtx, lv: number): number {
  let n = 0;
  for (const id in c.p.heroes) if (c.p.heroes[id].level >= lv) n++;
  return n;
}

/** Most talent points spent on one hero. */
export function mostTalentPoints(c: AchCtx): number {
  let m = 0;
  for (const id in c.p.heroes) m = Math.max(m, talentPointsSpent(c.p.heroes[id]));
  return m;
}

/** Any hero has a rank in a tier-5 (capstone) talent. */
export function hasCapstone(c: AchCtx): boolean {
  for (const id in c.p.heroes) {
    const t = c.p.heroes[id].talents;
    for (const n in t) if (t[n] > 0 && c.ctx.talentNodes.get(n)?.node.tier === 5) return true;
  }
  return false;
}

/** Best time survived in the stage with this map order (records + the live run). */
export function bestTimeIn(c: AchCtx, order: number): number {
  const st = stageByOrder(order, c.ctx);
  if (!st) return 0;
  const rec = c.p.records[st.id]?.bestTime ?? 0;
  const live = c.run && c.run.stage === st.id ? c.run.time : 0;
  return Math.max(rec, live);
}

/** Lowest best heat cleared over the 5 stages (records + the live run); 0 until all 5 exist. */
export function minHeatEverywhere(c: AchCtx): number {
  const stages = c.ctx.stages;
  if (stages.length < 5) return 0;
  let m = Infinity;
  for (const st of stages.slice(0, 5)) {
    let h = c.p.records[st.id]?.bestHeat ?? -1;
    if (c.run && c.run.stageCleared && c.run.stage === st.id) h = Math.max(h, c.run.heat);
    m = Math.min(m, h);
  }
  return Math.max(0, m === Infinity ? 0 : m);
}

/** Owned relics at >= `stars`. */
export function relicsAtStars(c: AchCtx, stars: number): number {
  let n = 0;
  for (const id in c.p.relics) if (c.p.relics[id] >= stars) n++;
  return n;
}

/** Kills in the evaluated run. */
export function runKillCount(c: AchCtx): number {
  const r = c.run;
  if (!r) return 0;
  let n = 0;
  for (const k in r.killsByEnemy) n += r.killsByEnemy[k];
  return n;
}

/** The evaluated run is over and ended in a death (never a quit / clear). */
export function diedThisRun(c: AchCtx): boolean {
  return c.ended && !!c.run && c.run.outcome === "dead" && !c.run.stageCleared;
}
