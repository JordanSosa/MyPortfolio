/**
 * Merch Machine pulls (docs/EXPANSION.md §9): costs, rarity (rates.ts),
 * featured 50/50 with a guarantee after a loss, item pick, dupes -> relic
 * stars / hero constellations -> Copium, consolation Copium, the MYTHIC spark,
 * a 100-entry history and lifetime stats. The RNG is injected (`RandomSource`),
 * so tests reproduce every pull.
 */
import { RARITIES, type Rarity } from "../../game/defs";
import { gameContent, type MetaContent } from "../content";
import { discover } from "../codex";
import { addHeroCopy } from "../heroes";
import type { BannerKind, DupeResult, Profile, PullRecord } from "../profile";
import { TUNING } from "../tuning";
import { mathRandom, type RandomSource } from "../util";
import { bannerPool, bannerView, gachaItem, heroItem, TRAFFIC_CONE, type GachaItem, type Pool } from "./banners";
import { R_N, R_SSR, R_UR, rarityAt, rarityIndex, RarityRoller, WHY_BASE, WHY_HARD, WHY_SOFT, WHY_UR, WHY_FLOOR } from "./rates";

export interface PullResult {
  item: GachaItem;
  rarity: Rarity;
  result: DupeResult;
  /** Relic stars / hero constellation after this copy. */
  level: number;
  /** Copium from an overflow dupe (consolation not included). */
  copium: number;
  /** It was the banner's featured item. */
  featured: boolean;
  /** This drop lost the 50/50 ("LOST THE 50/50" toast + sad trombone). */
  lost5050: boolean;
  /** This drop won a 50/50 (not a guarantee). */
  won5050: boolean;
  /** Came from pity: "soft", "hard", "ur", "floor" (10-pull SR guarantee), or "" (luck). */
  pity: "" | "soft" | "hard" | "ur" | "floor";
  /** Pulls it took since the previous SSR+ on this banner (SSR+ drops only). */
  pityCount: number;
  /** Gems from discovering the codex entry. */
  codexGems: number;
}

export type PullError = "banner" | "gems" | "count";

export interface PullOutcome {
  ok: boolean;
  error?: PullError;
  banner: BannerKind;
  results: PullResult[];
  /** Best rarity of the pull (drives the meteor colour). */
  best: Rarity;
  gemsSpent: number;
  /** All Copium gained (consolation + overflow). */
  copium: number;
  codexGems: number;
  /** The MYTHIC spark is claimable. */
  sparkReady: boolean;
}

const ROLLER = new RarityRoller();

/** Item of `rarity` from the pool, stepping down (then up) to the nearest rarity that has items. */
function resolveRarity(pool: Pool, want: number): number {
  for (let r = want; r >= 0; r--) if (pool[rarityAt(r)].length) return r;
  for (let r = want + 1; r < RARITIES.length; r++) if (pool[rarityAt(r)].length) return r;
  return -1;
}

/** Give one copy of an item: new / +star / +constellation / overflow Copium. */
export function grantItem(p: Profile, item: GachaItem): { result: DupeResult; level: number; copium: number; codexGems: number } {
  const overflow = TUNING.gacha.overflowCopium[item.rarity] ?? 0;
  let codexGems = 0;
  if (item.kind === "relic") {
    codexGems += discover(p, "relics", item.id);
    const cur = p.relics[item.id];
    if (cur === undefined) {
      p.relics[item.id] = 0;
      return { result: "new", level: 0, copium: 0, codexGems };
    }
    if (cur < TUNING.relics.maxStars) {
      p.relics[item.id] = cur + 1;
      return { result: "star", level: cur + 1, copium: 0, codexGems };
    }
    p.currencies.copium += overflow;
    return { result: "copium", level: cur, copium: overflow, codexGems };
  }
  const g = addHeroCopy(p, item.id);
  codexGems += discover(p, "heroes", item.id);
  if (g.result === "copium") {
    p.currencies.copium += overflow;
    return { result: "copium", level: g.constellation, copium: overflow, codexGems };
  }
  return { result: g.result, level: g.constellation, copium: 0, codexGems };
}

function record(p: Profile, banner: BannerKind, r: PullResult): void {
  const G = TUNING.gacha;
  const s = p.gacha.stats;
  const rec: PullRecord = { n: s.pulls, banner, kind: r.item.kind, id: r.item.id, rarity: r.rarity, result: r.result, featured: r.featured, lost: r.lost5050 };
  const h = p.gacha.history;
  h.push(rec);
  if (h.length > G.historySize) h.splice(0, h.length - G.historySize);
}

/** Extra `pull` options. */
export interface PullOpts {
  /** No gems are charged (welcome gifts, tests). */
  free?: boolean;
  /**
   * Debug / tests only (the UI passes it from a dev-only hook): result number
   * `forceAt` (default: the last of the pull) has this rarity instead of a roll.
   * Pity counters move exactly as if it had been rolled; everything after the
   * rarity (50/50, item pick, dupes) runs as usual.
   */
  force?: Rarity;
  forceAt?: number;
}

/**
 * Pull `count` (1 or 10) on a banner. Pays gems (unless `free`), updates pity,
 * the spark, history, stats and the collection. Never throws; returns
 * `{ ok: false, error }` when the banner is unavailable or gems are short.
 */
export function pull(p: Profile, banner: BannerKind, count: 1 | 10, rng: RandomSource = mathRandom, ctx: MetaContent = gameContent(), opts: PullOpts = {}): PullOutcome {
  const G = TUNING.gacha;
  const fail = (error: PullError): PullOutcome => ({ ok: false, error, banner, results: [], best: "N", gemsSpent: 0, copium: 0, codexGems: 0, sparkReady: p.gacha.spark >= G.spark });
  if (count !== 1 && count !== 10) return fail("count");
  const view = bannerView(p, banner, ctx);
  if (!view.available) return fail("banner");
  const cost = opts.free ? 0 : count === 10 ? G.tenPullCost : G.pullCost;
  if (p.currencies.gems < cost) return fail("gems");
  p.currencies.gems -= cost;

  const st = p.gacha.banners[banner];
  const stats = p.gacha.stats;
  const pool = bannerPool(p, banner, ctx);
  const featured = view.featured;
  const cone = pool.N.find((x) => x.id === TRAFFIC_CONE);
  const floorIdx = rarityIndex(G.tenPullFloor);
  const forceIdx = opts.force !== undefined ? rarityIndex(opts.force) : -1;
  const forceAt = Math.max(0, Math.min(count - 1, Math.floor(opts.forceAt ?? count - 1)));
  const results: PullResult[] = [];
  let best = 0;
  let copium = 0;
  let codexGems = 0;
  let hadFloor = false;
  for (let i = 0; i < count; i++) {
    const floor = count === 10 && i === count - 1 && !hadFloor ? floorIdx : -1;
    const pityBefore = st.pity;
    let rolled: number;
    let why: number;
    if (forceIdx >= 0 && i === forceAt) {
      rolled = forceIdx;
      why = WHY_BASE;
      st.pity = rolled >= R_SSR ? 0 : st.pity + 1;
      st.pityUR = rolled >= R_UR ? 0 : st.pityUR + 1;
    } else {
      rolled = ROLLER.roll(st, rng, floor);
      why = ROLLER.last;
    }
    const ri = resolveRarity(pool, rolled);
    if (ri < 0) break; // unreachable: the banner view guarantees a non-empty pool
    const rarity = rarityAt(ri);
    const items = pool[rarity];
    let item: GachaItem;
    let isFeatured = false;
    let lost = false;
    let won = false;
    if (featured && featured.rarity === rarity && ri >= R_SSR) {
      const others = items.filter((x) => x.id !== featured.id);
      if (st.guaranteed || others.length === 0) {
        item = featured;
        isFeatured = true;
        st.guaranteed = false;
      } else if (rng.next() < G.featuredChance) {
        item = featured;
        isFeatured = true;
        won = true;
        stats.won5050++;
      } else {
        item = others[Math.floor(rng.next() * others.length) % others.length];
        lost = true;
        st.guaranteed = true;
        stats.lost5050++;
      }
    } else if (banner === "mythic" && ri === R_N && cone) {
      item = cone; // the Isekai Express curse
    } else {
      item = items[Math.floor(rng.next() * items.length) % items.length];
      isFeatured = !!featured && item.id === featured.id;
    }
    const g = grantItem(p, item);
    const cons = G.copiumPerPull;
    p.currencies.copium += cons;
    copium += cons + g.copium;
    codexGems += g.codexGems;
    stats.pulls++;
    stats.byRarity[rarity]++;
    stats.copiumEarned += cons + g.copium;
    p.lifetime.pulls++;
    p.lifetime.copiumEarned += cons + g.copium;
    st.pulls++;
    p.gacha.spark++;
    if (ri === R_N) {
      stats.nStreak++;
      if (stats.nStreak > stats.nStreakBest) stats.nStreakBest = stats.nStreak;
    } else stats.nStreak = 0;
    if (ri >= R_SSR && why === WHY_HARD) stats.hardPityHits++;
    if (ri >= floorIdx) hadFloor = true;
    if (ri > best) best = ri;
    const res: PullResult = {
      item,
      rarity,
      result: g.result,
      level: g.level,
      copium: g.copium,
      featured: isFeatured,
      lost5050: lost,
      won5050: won,
      pity: why === WHY_HARD ? "hard" : why === WHY_SOFT ? "soft" : why === WHY_UR ? "ur" : why === WHY_FLOOR ? "floor" : "",
      pityCount: ri >= R_SSR ? pityBefore + 1 : 0,
      codexGems: g.codexGems,
    };
    results.push(res);
    record(p, banner, res);
  }
  if (count === 10) stats.tenPulls++;
  stats.gemsSpent += cost;
  return { ok: true, banner, results, best: rarityAt(best), gemsSpent: cost, copium, codexGems, sparkReady: p.gacha.spark >= G.spark };
}

// ---------------------------------------------------------------- spark

/** Everything a spark can pick: every MYTHIC relic, plus Truck-kun once registered. */
export function sparkChoices(ctx: MetaContent = gameContent()): GachaItem[] {
  const out: GachaItem[] = [];
  const truck = heroItem("truck_kun", ctx);
  if (truck) out.push(truck);
  for (const d of [...ctx.relics.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) if (d.rarity === "MYTHIC") out.push({ kind: "relic", id: d.id, name: d.name, rarity: d.rarity });
  return out;
}

/** Claim the MYTHIC spark (TUNING.gacha.spark pulls): any MYTHIC of your choice. */
export function claimSpark(p: Profile, id: string, ctx: MetaContent = gameContent()): { ok: boolean; reason?: "pulls" | "item"; result?: PullResult } {
  const G = TUNING.gacha;
  if (p.gacha.spark < G.spark) return { ok: false, reason: "pulls" };
  const item = sparkChoices(ctx).find((x) => x.id === id);
  if (!item) return { ok: false, reason: "item" };
  p.gacha.spark -= G.spark;
  p.gacha.stats.sparksUsed++;
  const g = grantItem(p, item);
  p.lifetime.copiumEarned += g.copium;
  p.gacha.stats.copiumEarned += g.copium;
  const result: PullResult = { item, rarity: item.rarity, result: g.result, level: g.level, copium: g.copium, featured: false, lost5050: false, won5050: false, pity: "", pityCount: 0, codexGems: g.codexGems };
  return { ok: true, result };
}

// ---------------------------------------------------------------- stats view

export interface GachaStatsView {
  pulls: number;
  tenPulls: number;
  gemsSpent: number;
  /** "Money you'd have spent IRL: $0 (we checked)". */
  realMoney: number;
  byRarity: Record<Rarity, number>;
  won5050: number;
  lost5050: number;
  nStreakBest: number;
  copiumEarned: number;
  sparksUsed: number;
  /** Observed share of each rarity (0..1). */
  observed: Record<Rarity, number>;
}

export function gachaStats(p: Profile): GachaStatsView {
  const s = p.gacha.stats;
  const observed = {} as Record<Rarity, number>;
  for (const r of RARITIES) observed[r] = s.pulls > 0 ? s.byRarity[r] / s.pulls : 0;
  return {
    pulls: s.pulls,
    tenPulls: s.tenPulls,
    gemsSpent: s.gemsSpent,
    realMoney: 0,
    byRarity: { ...s.byRarity },
    won5050: s.won5050,
    lost5050: s.lost5050,
    nStreakBest: s.nStreakBest,
    copiumEarned: s.copiumEarned,
    sparksUsed: s.sparksUsed,
    observed,
  };
}

/** History, newest first, with display names. */
export function pullHistory(p: Profile, ctx: MetaContent = gameContent()): (PullRecord & { name: string })[] {
  return [...p.gacha.history].reverse().map((h) => ({ ...h, name: gachaItem(h.id, ctx)?.name ?? h.id }));
}
