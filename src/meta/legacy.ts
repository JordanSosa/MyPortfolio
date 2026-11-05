/**
 * Save v1 (`kko.save.v1`, the shipped vertical slice) as frozen data: its
 * types, defaults, validator and the v1 -> v2 migration (docs/EXPANSION.md §14).
 * Everything v1 needs is copied here (the old Dream Shop table and cost
 * formula, the three v1 heroes) so the migration keeps working whatever
 * happens to the live game code.
 *
 * Migration: keep coins, settings, bests and run counts; refund every coin
 * spent in the old Dream Shop; unlock Rin and Mochi; grant the "Welcome to
 * Season 2" gift (one 10-pull of gems).
 */
import { defaultHeroProgress, defaultProfile, defaultStageRecord, DEFAULT_SETTINGS, sanitizeSettings, START_STAGE, type Profile, type Settings } from "./profile";
import { TUNING } from "./tuning";
import { isObj } from "./util";

export interface BestV1 {
  time: number;
  kills: number;
  level: number;
  combo: number;
}

export interface TutorialV1 {
  dash: boolean;
  ult: number;
}

export interface SaveDataV1 {
  coins: number;
  meta: Record<string, number>;
  settings: Settings;
  best: BestV1;
  runs: number;
  wins: number;
  lastHero: string;
  totalKills: number;
  tut: TutorialV1;
}

export const DEFAULT_SAVE_V1: SaveDataV1 = {
  coins: 0,
  meta: {},
  settings: { ...DEFAULT_SETTINGS },
  best: { time: 0, kills: 0, level: 0, combo: 0 },
  runs: 0,
  wins: 0,
  lastHero: "hoshi",
  totalKills: 0,
  tut: { dash: false, ult: 0 },
};

/** The v1 Dream Shop as shipped (id, max rank, base cost). Frozen: refunds must use the prices players paid. */
export const OLD_SHOP: readonly { id: string; maxRank: number; baseCost: number }[] = [
  { id: "might", maxRank: 5, baseCost: 60 },
  { id: "vitality", maxRank: 5, baseCost: 50 },
  { id: "swiftness", maxRank: 5, baseCost: 50 },
  { id: "magnetism", maxRank: 5, baseCost: 40 },
  { id: "greed", maxRank: 5, baseCost: 70 },
  { id: "luck", maxRank: 5, baseCost: 80 },
  { id: "reroll", maxRank: 3, baseCost: 100 },
  { id: "revive", maxRank: 1, baseCost: 400 },
];

const V1_HEROES = ["hoshi", "rin", "mochi"];

/** Old Dream Shop price of buying rank `rank + 1` (v1 formula: round(base x 1.6^rank / 5) x 5). */
export function oldShopCost(baseCost: number, rank: number): number {
  return Math.round((baseCost * Math.pow(TUNING.migration.oldShopGrowth, rank)) / 5) * 5;
}

/** Coins a v1 player spent on the Dream Shop ranks `meta` (ranks clamped to each max; unknown ids ignored). */
export function oldShopSpent(meta: Readonly<Record<string, number>>): number {
  let total = 0;
  for (const m of OLD_SHOP) {
    const r = Math.min(m.maxRank, Math.max(0, Math.floor(Number(meta[m.id]) || 0)));
    for (let i = 0; i < r; i++) total += oldShopCost(m.baseCost, i);
  }
  return total;
}

/** A finite, non-negative integer (negative / NaN / wrong type -> `def`). */
function count(v: unknown, def = 0): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
}
/** A finite, non-negative number (fractional run times stay fractional). */
function nonNeg(v: unknown, def = 0): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : def;
}

/**
 * Validate a v1 save in place (the shipped v1 rules): settings in range, Dream
 * Shop ranks integer-clamped to each max (unknown ids dropped), counters and
 * bests finite non-negative, lastHero a v1 hero. Returns true if anything changed.
 */
export function sanitizeSaveV1(d: SaveDataV1): boolean {
  const before = JSON.stringify(d);
  if (!isObj(d.settings)) (d as { settings: unknown }).settings = { ...DEFAULT_SETTINGS };
  if (!isObj(d.best)) (d as { best: unknown }).best = { ...DEFAULT_SAVE_V1.best };
  if (!isObj(d.tut)) (d as { tut: unknown }).tut = { ...DEFAULT_SAVE_V1.tut };
  Object.assign(d.settings, sanitizeSettings(d.settings));
  const meta: Record<string, number> = {};
  const src = isObj(d.meta) ? d.meta : {};
  for (const m of OLD_SHOP) {
    const r = count(src[m.id]);
    if (r > 0) meta[m.id] = Math.min(m.maxRank, r);
  }
  d.meta = meta;
  d.coins = count(d.coins);
  d.runs = count(d.runs);
  d.wins = Math.min(d.runs, count(d.wins));
  d.totalKills = count(d.totalKills);
  const b = d.best;
  b.time = nonNeg(b.time);
  b.kills = count(b.kills);
  b.level = count(b.level);
  b.combo = count(b.combo);
  if (!V1_HEROES.includes(d.lastHero)) d.lastHero = DEFAULT_SAVE_V1.lastHero;
  d.tut.dash = d.tut.dash === true;
  d.tut.ult = count(d.tut.ult);
  return JSON.stringify(d) !== before;
}

/** Merge raw v1 JSON over the v1 defaults (missing / mistyped fields -> defaults) and validate it. */
export function readV1(raw: unknown): SaveDataV1 {
  const o = isObj(raw) ? raw : {};
  const pick = <T>(v: unknown, def: T): T => (isObj(def) ? ((isObj(v) ? { ...def, ...v } : { ...def }) as T) : typeof v === typeof def ? (v as T) : def);
  const d: SaveDataV1 = {
    coins: pick(o.coins, 0),
    meta: pick(o.meta, {} as Record<string, number>),
    settings: pick(o.settings, { ...DEFAULT_SETTINGS }),
    best: pick(o.best, { ...DEFAULT_SAVE_V1.best }),
    runs: pick(o.runs, 0),
    wins: pick(o.wins, 0),
    lastHero: pick(o.lastHero, "hoshi"),
    totalKills: pick(o.totalKills, 0),
    tut: pick(o.tut, { ...DEFAULT_SAVE_V1.tut }),
  };
  sanitizeSaveV1(d);
  return d;
}

export interface MigrationReport {
  /** Coins refunded for the old Dream Shop. */
  refund: number;
  /** "Welcome to Season 2" gems. */
  gift: number;
  /** Heroes unlocked for existing players. */
  heroes: string[];
}

/**
 * v1 save (raw JSON, any shape) -> v2 profile. The result still goes through
 * `sanitizeProfile` / `reconcileProfile` like any loaded profile.
 */
export function migrateV1(raw: unknown, now = 0): { profile: Profile; report: MigrationReport } {
  const v1 = readV1(raw);
  const p = defaultProfile(now);
  const refund = oldShopSpent(v1.meta);
  const gift = TUNING.migration.welcomeGems;
  p.currencies.coins = v1.coins + refund;
  p.currencies.gems = gift;
  p.settings = sanitizeSettings(v1.settings);
  p.best = { ...v1.best };
  p.tutorial.dash = v1.tut.dash;
  p.tutorial.ult = v1.tut.ult;
  const L = p.lifetime;
  L.runs = v1.runs;
  L.clears = v1.wins;
  L.deaths = v1.runs - v1.wins;
  L.kills = v1.totalKills;
  L.maxCombo = v1.best.combo;
  L.bestLevel = v1.best.level;
  // v1 only had Dream Meadow
  if (v1.runs > 0) {
    const rec = defaultStageRecord();
    rec.runs = v1.runs;
    rec.clears = v1.wins;
    rec.bestTime = v1.best.time;
    rec.bestKills = v1.best.kills;
    rec.bestLevel = v1.best.level;
    rec.bestCombo = v1.best.combo;
    if (v1.wins > 0) {
      rec.bestHeat = 0;
      rec.firstClear = 1;
    }
    p.records[START_STAGE] = rec;
  }
  const heroes = ["rin", "mochi"];
  for (const h of heroes) {
    if (!p.unlocks.heroes.includes(h)) p.unlocks.heroes.push(h);
    p.heroes[h] = defaultHeroProgress();
  }
  p.loadout.hero = V1_HEROES.includes(v1.lastHero) ? v1.lastHero : p.loadout.hero;
  p.info.migratedFrom = 1;
  return { profile: p, report: { refund, gift, heroes } };
}
