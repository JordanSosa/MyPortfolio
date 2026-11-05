/**
 * The account profile (save v2, docs/EXPANSION.md §2-§11, §14): versioned,
 * fully typed plain JSON with defaults, plus a sanitiser that repairs every
 * field on its own. `sanitizeProfile(anything)` always returns a valid Profile:
 * corrupt, hand-edited, older or newer saves can never block the boot.
 *
 * Structural repair lives here (types, ranges, sizes). Repairs that need the
 * content catalogue (unknown board nodes refunded, talents checked against the
 * tree, the loadout pointed at unlocked content, start unlocks) are in
 * `reconcileProfile` (src/meta/reconcile.ts).
 *
 * PURE: no DOM, no localStorage. Persisted by src/ui/save.ts.
 */
import { RARITIES, type Rarity } from "../game/defs";
import { bool, idList, int, intRecord, isObj, num, numRecord, oneOf, record, str } from "./util";

export const PROFILE_VERSION = 2;

// ---------------------------------------------------------------- settings (unchanged from save v1)

export type QualityPref = "auto" | "low" | "mid" | "high";

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  /** 0 / 0.5 / 1 */
  shake: number;
  reduceFlashing: boolean;
  damageNumbers: boolean;
  quality: QualityPref;
  haptics: boolean;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  master: 0.8,
  music: 0.7,
  sfx: 0.85,
  shake: 1,
  reduceFlashing: false,
  damageNumbers: true,
  quality: "auto",
  haptics: true,
  showFps: false,
});

export const QUALITY_PREFS: readonly QualityPref[] = ["auto", "low", "mid", "high"];
const SHAKE_STEPS = [0, 0.5, 1];

/** Settings validation (same rules as save v1): volumes 0..1, shake snapped to 0 / 0.5 / 1, booleans, known quality pref. */
export function sanitizeSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {};
  const sh = num(s.shake, DEFAULT_SETTINGS.shake, 0, 1);
  let snap = SHAKE_STEPS[0];
  for (const x of SHAKE_STEPS) if (Math.abs(x - sh) < Math.abs(snap - sh)) snap = x;
  return {
    master: num(s.master, DEFAULT_SETTINGS.master, 0, 1),
    music: num(s.music, DEFAULT_SETTINGS.music, 0, 1),
    sfx: num(s.sfx, DEFAULT_SETTINGS.sfx, 0, 1),
    shake: snap,
    reduceFlashing: s.reduceFlashing === true,
    damageNumbers: s.damageNumbers !== false,
    quality: oneOf(s.quality, QUALITY_PREFS, DEFAULT_SETTINGS.quality),
    haptics: s.haptics !== false,
    showFps: s.showFps === true,
  };
}

// ---------------------------------------------------------------- types

export interface Currencies {
  /** ★ Star Coins. */
  coins: number;
  /** ♦ Dream Gems ("definitely not premium currency"). */
  gems: number;
  /** Copium (gacha consolation). */
  copium: number;
}

/** Content the account has unlocked (ids). Relic slots: extra slots from non-board sources (the board adds its own). */
export interface Unlocks {
  heroes: string[];
  weapons: string[];
  passives: string[];
  stages: string[];
  twists: string[];
  relicSlots: number;
}

/** Training Arc board purchases. */
export interface BoardState {
  /** Node id -> purchased rank (the centre node is implicit). */
  ranks: Record<string, number>;
  /** Node id -> coins paid for its current ranks (exact refunds, respec, removed-node repair). */
  paid: Record<string, number>;
  /** Keystones switched on (owned, at most TUNING.board.keystoneSlots). */
  active: string[];
  respecs: number;
}

export interface HeroProgress {
  xp: number;
  /** Cached from xp (recomputed by reconcile). */
  level: number;
  /** Talent id -> rank. */
  talents: Record<string, number>;
  /** C0-C6 from gacha dupes. */
  constellation: number;
  runs: number;
  clears: number;
  kills: number;
  /** Seconds played with the hero. */
  time: number;
  /** Longest survival (s) in any stage. */
  bestTime: number;
  talentRespecs: number;
}

export interface Loadout {
  stage: string;
  hero: string;
  /** Equipped relic ids (slot order). */
  relics: string[];
  /** Plot Twist id -> rank. */
  twists: Record<string, number>;
  endless: boolean;
  /** Weapon started at Lv2 by the board's "Head Start" node (null = the hero's signature weapon). */
  startWeapon: string | null;
}

export type BannerKind = "permanent" | "hero" | "relic" | "mythic";
export const BANNER_KINDS: readonly BannerKind[] = ["permanent", "hero", "relic", "mythic"];

export interface BannerPity {
  /** Pulls since the last SSR-or-better. */
  pity: number;
  /** Pulls since the last UR-or-better. */
  pityUR: number;
  /** Lost the last 50/50: the next drop at the featured rarity is the featured item. */
  guaranteed: boolean;
  pulls: number;
}

export type DupeResult = "new" | "star" | "constellation" | "copium";
export const DUPE_RESULTS: readonly DupeResult[] = ["new", "star", "constellation", "copium"];

export interface PullRecord {
  /** Lifetime pull number (1-based). */
  n: number;
  banner: BannerKind;
  kind: "hero" | "relic";
  id: string;
  rarity: Rarity;
  result: DupeResult;
  /** It was the banner's featured item. */
  featured: boolean;
  /** This drop lost the 50/50. */
  lost: boolean;
}

export interface GachaStats {
  pulls: number;
  tenPulls: number;
  gemsSpent: number;
  byRarity: Record<Rarity, number>;
  won5050: number;
  lost5050: number;
  /** Current / best run of consecutive N drops ("Gacha Hell"). */
  nStreak: number;
  nStreakBest: number;
  copiumEarned: number;
  sparksUsed: number;
  exchangeBuys: number;
  /** SSR+ drops that came from hard pity ("The Machine Felt Bad"). */
  hardPityHits: number;
  /** Pity Insurance bought. */
  pityInsurance: number;
  /** Joke Gem Exchange uses. */
  gemExchanges: number;
}

export interface GachaState {
  banners: Record<BannerKind, BannerPity>;
  /** Pulls toward the MYTHIC spark (any banner). */
  spark: number;
  /** Last TUNING.gacha.historySize pulls, oldest first. */
  history: PullRecord[];
  stats: GachaStats;
}

/** Featured banners rotate every TUNING.rotation.runsPerBanner runs ("BANNER ENDS IN 2 RUNS!!"). */
export interface RotationState {
  cycle: number;
  runsLeft: number;
}

export interface AchievementState {
  /** Best progress value seen (progress bars). */
  progress: Record<string, number>;
  /** Id -> episode number (lifetime run count) when it was completed. */
  done: Record<string, number>;
  /** Ids whose reward was claimed. */
  claimed: string[];
}

export interface Lifetime {
  runs: number;
  clears: number;
  deaths: number;
  /** Seconds survived in runs. */
  time: number;
  endlessTime: number;
  kills: number;
  killsByEnemy: Record<string, number>;
  eliteKills: number;
  bossKills: Record<string, number>;
  /** "Bosses by stage / heat": stage -> boss -> highest heat it was killed at (0 = no twists). */
  bossHeat: Record<string, Record<string, number>>;
  damage: number;
  /** Base weapon id -> damage dealt (evolutions count toward their base). */
  damageByWeapon: Record<string, number>;
  /** Base weapon id -> kills. */
  killsByWeapon: Record<string, number>;
  dashes: number;
  ults: number;
  levelUps: number;
  chests: number;
  foodEaten: number;
  evolutions: number;
  revivesUsed: number;
  damageTaken: number;
  coinsPicked: number;
  coinsEarned: number;
  gemsEarned: number;
  copiumEarned: number;
  maxCombo: number;
  /** Highest combo rank index (-1 none, 5 = SSS). */
  maxRank: number;
  bestLevel: number;
  noHitBest: number;
  /** Longest run (s) without a single dash. */
  noDashBest: number;
  /** Longest run (s) without dealing any damage. */
  pacifistBest: number;
  /** Shortest death (s), Infinity-free: 0 = no death yet. */
  fastestDeath: number;
  pulls: number;
  /** Most evolutions held at once in one run. */
  maxEvolutions: number;
  heroesCleared: string[];
}

/** Discovered codex entries ("Kira Kira Wiki"). */
export interface CodexState {
  heroes: string[];
  weapons: string[];
  passives: string[];
  enemies: string[];
  bosses: string[];
  relics: string[];
  stages: string[];
}
export type CodexTab = keyof CodexState;
export const CODEX_TABS: readonly CodexTab[] = ["heroes", "weapons", "passives", "enemies", "bosses", "relics", "stages"];

export interface StageRecord {
  runs: number;
  clears: number;
  bestTime: number;
  /** Highest heat cleared (-1 = never cleared). */
  bestHeat: number;
  /** Best endless time after the final boss (s). */
  bestEndless: number;
  bestKills: number;
  bestLevel: number;
  bestCombo: number;
  /** Episode number of the first clear (0 = not yet). */
  firstClear: number;
}

export interface Best {
  time: number;
  kills: number;
  level: number;
  combo: number;
}

/** Onboarding flags. `dash` / `ult` keep the v1 meaning (in-run tutorial); `flags` is for hub tutorials (id -> step). */
export interface Tutorial {
  dash: boolean;
  ult: number;
  flags: Record<string, number>;
}

export interface Titles {
  owned: string[];
  /** Equipped title id ("" = none). */
  equipped: string;
}

export interface ProfileInfo {
  /** Epoch ms of creation (0 = unknown). */
  created: number;
  /** Epoch ms of the last saved run (0 = never). */
  lastPlayed: number;
  /** Save version this profile was migrated from (0 = created fresh as v2). */
  migratedFrom: number;
  /** Times the profile has been repaired by the sanitiser (diagnostics). */
  repairs: number;
}

export interface Profile {
  version: number;
  currencies: Currencies;
  unlocks: Unlocks;
  board: BoardState;
  heroes: Record<string, HeroProgress>;
  /** Base weapon id -> mastery XP. */
  mastery: Record<string, number>;
  /** Owned relics: id -> stars 0..6. */
  relics: Record<string, number>;
  loadout: Loadout;
  gacha: GachaState;
  rotation: RotationState;
  achievements: AchievementState;
  lifetime: Lifetime;
  codex: CodexState;
  records: Record<string, StageRecord>;
  best: Best;
  settings: Settings;
  tutorial: Tutorial;
  titles: Titles;
  /** Misc. UI-set flags read by achievements / tutorials (e.g. finePrint = 1: scrolled the gacha fine print). */
  flags: Record<string, number>;
  info: ProfileInfo;
}

// ---------------------------------------------------------------- defaults

export const START_HERO = "hoshi";
export const START_STAGE = "dream_meadow";

export function defaultHeroProgress(): HeroProgress {
  return { xp: 0, level: 1, talents: {}, constellation: 0, runs: 0, clears: 0, kills: 0, time: 0, bestTime: 0, talentRespecs: 0 };
}

export function defaultBannerPity(): BannerPity {
  return { pity: 0, pityUR: 0, guaranteed: false, pulls: 0 };
}

export function defaultStageRecord(): StageRecord {
  return { runs: 0, clears: 0, bestTime: 0, bestHeat: -1, bestEndless: 0, bestKills: 0, bestLevel: 0, bestCombo: 0, firstClear: 0 };
}

const zeroByRarity = (): Record<Rarity, number> => ({ N: 0, R: 0, SR: 0, SSR: 0, UR: 0, LR: 0, MYTHIC: 0 });

export function defaultLifetime(): Lifetime {
  return {
    runs: 0,
    clears: 0,
    deaths: 0,
    time: 0,
    endlessTime: 0,
    kills: 0,
    killsByEnemy: {},
    eliteKills: 0,
    bossKills: {},
    bossHeat: {},
    damage: 0,
    damageByWeapon: {},
    killsByWeapon: {},
    dashes: 0,
    ults: 0,
    levelUps: 0,
    chests: 0,
    foodEaten: 0,
    evolutions: 0,
    revivesUsed: 0,
    damageTaken: 0,
    coinsPicked: 0,
    coinsEarned: 0,
    gemsEarned: 0,
    copiumEarned: 0,
    maxCombo: 0,
    maxRank: -1,
    bestLevel: 0,
    noHitBest: 0,
    noDashBest: 0,
    pacifistBest: 0,
    fastestDeath: 0,
    pulls: 0,
    maxEvolutions: 0,
    heroesCleared: [],
  };
}

/** A brand-new account (start content only; reconcile adds the registered start weapons / passives). */
export function defaultProfile(now = 0): Profile {
  return {
    version: PROFILE_VERSION,
    currencies: { coins: 0, gems: 0, copium: 0 },
    unlocks: { heroes: [START_HERO], weapons: [], passives: [], stages: [START_STAGE], twists: [], relicSlots: 0 },
    board: { ranks: {}, paid: {}, active: [], respecs: 0 },
    heroes: { [START_HERO]: defaultHeroProgress() },
    mastery: {},
    relics: {},
    loadout: { stage: START_STAGE, hero: START_HERO, relics: [], twists: {}, endless: false, startWeapon: null },
    gacha: {
      banners: { permanent: defaultBannerPity(), hero: defaultBannerPity(), relic: defaultBannerPity(), mythic: defaultBannerPity() },
      spark: 0,
      history: [],
      stats: { pulls: 0, tenPulls: 0, gemsSpent: 0, byRarity: zeroByRarity(), won5050: 0, lost5050: 0, nStreak: 0, nStreakBest: 0, copiumEarned: 0, sparksUsed: 0, exchangeBuys: 0, hardPityHits: 0, pityInsurance: 0, gemExchanges: 0 },
    },
    rotation: { cycle: 0, runsLeft: 3 },
    achievements: { progress: {}, done: {}, claimed: [] },
    lifetime: defaultLifetime(),
    codex: { heroes: [], weapons: [], passives: [], enemies: [], bosses: [], relics: [], stages: [] },
    records: {},
    best: { time: 0, kills: 0, level: 0, combo: 0 },
    settings: { ...DEFAULT_SETTINGS },
    tutorial: { dash: false, ult: 0, flags: {} },
    titles: { owned: [], equipped: "" },
    flags: {},
    info: { created: now, lastPlayed: 0, migratedFrom: 0, repairs: 0 },
  };
}

// ---------------------------------------------------------------- sanitiser

/** Biggest currency / counter we accept (keeps arithmetic exact). */
const MAX = 1e15;
const cnt = (v: unknown, def = 0) => int(v, def, 0, MAX);
const sec = (v: unknown, def = 0) => num(v, def, 0, MAX);

/** Run `fn` on a section; if it throws (e.g. a getter / odd prototype), use `fallback`. */
function safe<T>(fn: () => T, fallback: () => T): T {
  try {
    return fn();
  } catch {
    return fallback();
  }
}

function sanitizeHero(v: unknown): HeroProgress | undefined {
  if (!isObj(v)) return undefined;
  return {
    xp: cnt(v.xp),
    level: int(v.level, 1, 1, 1000),
    talents: intRecord(v.talents, 0, 100, true, 200),
    constellation: int(v.constellation, 0, 0, 6),
    runs: cnt(v.runs),
    clears: cnt(v.clears),
    kills: cnt(v.kills),
    time: sec(v.time),
    bestTime: sec(v.bestTime),
    talentRespecs: cnt(v.talentRespecs),
  };
}

function sanitizePity(v: unknown): BannerPity {
  const o = isObj(v) ? v : {};
  return { pity: int(o.pity, 0, 0, 100000), pityUR: int(o.pityUR, 0, 0, 100000), guaranteed: o.guaranteed === true, pulls: cnt(o.pulls) };
}

function sanitizePull(v: unknown): PullRecord | undefined {
  if (!isObj(v) || typeof v.id !== "string") return undefined;
  const id = idList([v.id])[0];
  if (!id) return undefined;
  return {
    n: cnt(v.n),
    banner: oneOf(v.banner, BANNER_KINDS, "permanent"),
    kind: v.kind === "hero" ? "hero" : "relic",
    id,
    rarity: oneOf(v.rarity, RARITIES, "N"),
    result: oneOf(v.result, DUPE_RESULTS, "new"),
    featured: v.featured === true,
    lost: v.lost === true,
  };
}

function sanitizeGacha(v: unknown, historySize: number): GachaState {
  const o = isObj(v) ? v : {};
  const b = isObj(o.banners) ? o.banners : {};
  const s = isObj(o.stats) ? o.stats : {};
  const br = isObj(s.byRarity) ? s.byRarity : {};
  const byRarity = zeroByRarity();
  for (const r of RARITIES) byRarity[r] = cnt(br[r]);
  const history: PullRecord[] = [];
  if (Array.isArray(o.history)) {
    for (const x of o.history.slice(-historySize)) {
      const p = sanitizePull(x);
      if (p) history.push(p);
    }
  }
  return {
    banners: { permanent: sanitizePity(b.permanent), hero: sanitizePity(b.hero), relic: sanitizePity(b.relic), mythic: sanitizePity(b.mythic) },
    spark: cnt(o.spark),
    history,
    stats: {
      pulls: cnt(s.pulls),
      tenPulls: cnt(s.tenPulls),
      gemsSpent: cnt(s.gemsSpent),
      byRarity,
      won5050: cnt(s.won5050),
      lost5050: cnt(s.lost5050),
      nStreak: cnt(s.nStreak),
      nStreakBest: cnt(s.nStreakBest),
      copiumEarned: cnt(s.copiumEarned),
      sparksUsed: cnt(s.sparksUsed),
      exchangeBuys: cnt(s.exchangeBuys),
      hardPityHits: cnt(s.hardPityHits),
      pityInsurance: cnt(s.pityInsurance),
      gemExchanges: cnt(s.gemExchanges),
    },
  };
}

function sanitizeLifetime(v: unknown): Lifetime {
  const o = isObj(v) ? v : {};
  const d = defaultLifetime();
  const out = d as unknown as Record<string, unknown>;
  for (const k of Object.keys(d) as (keyof Lifetime)[]) {
    const dv = d[k];
    if (typeof dv === "number") out[k] = k === "maxRank" ? int(o[k], -1, -1, 64) : sec(o[k], dv);
  }
  // integer counters stay integers
  for (const k of ["runs", "clears", "deaths", "kills", "eliteKills", "dashes", "ults", "levelUps", "chests", "foodEaten", "evolutions", "revivesUsed", "coinsPicked", "coinsEarned", "gemsEarned", "copiumEarned", "maxCombo", "bestLevel", "pulls", "maxEvolutions"] as const)
    d[k] = Math.floor(d[k]);
  d.killsByEnemy = intRecord(o.killsByEnemy, 0, MAX, true, 1000);
  d.bossKills = intRecord(o.bossKills, 0, MAX, true, 500);
  d.bossHeat = record(o.bossHeat, (x) => intRecord(x, 0, 10000, false, 100), 100);
  d.damageByWeapon = numRecord(o.damageByWeapon, 0, MAX, 500);
  d.killsByWeapon = intRecord(o.killsByWeapon, 0, MAX, true, 500);
  d.heroesCleared = idList(o.heroesCleared, 200);
  d.clears = Math.min(d.clears, d.runs);
  d.deaths = Math.min(d.deaths, d.runs);
  return d;
}

function sanitizeStageRecord(v: unknown): StageRecord | undefined {
  if (!isObj(v)) return undefined;
  const runs = cnt(v.runs);
  return {
    runs,
    clears: Math.min(runs, cnt(v.clears)),
    bestTime: sec(v.bestTime),
    bestHeat: int(v.bestHeat, -1, -1, 10000),
    bestEndless: sec(v.bestEndless),
    bestKills: cnt(v.bestKills),
    bestLevel: cnt(v.bestLevel),
    bestCombo: cnt(v.bestCombo),
    firstClear: cnt(v.firstClear),
  };
}

export interface SanitizeResult {
  profile: Profile;
  /** True if anything had to be repaired or filled in. */
  repaired: boolean;
}

/**
 * Repair any value into a valid Profile. Each section is validated on its own:
 * a broken gacha block resets only the gacha block. Never throws.
 */
export function sanitizeProfile(raw: unknown, now = 0, historySize = 100): SanitizeResult {
  const def = defaultProfile(now);
  if (!isObj(raw)) return { profile: def, repaired: raw !== undefined };
  const o = raw;
  const p: Profile = {
    version: PROFILE_VERSION,
    currencies: safe(() => {
      const c = isObj(o.currencies) ? o.currencies : {};
      return { coins: cnt(c.coins), gems: cnt(c.gems), copium: cnt(c.copium) };
    }, () => def.currencies),
    unlocks: safe(() => {
      const u = isObj(o.unlocks) ? o.unlocks : {};
      return {
        heroes: idList(u.heroes, 200),
        weapons: idList(u.weapons, 500),
        passives: idList(u.passives, 500),
        stages: idList(u.stages, 100),
        twists: idList(u.twists, 200),
        relicSlots: int(u.relicSlots, 0, 0, 3),
      };
    }, () => def.unlocks),
    board: safe(() => {
      const b = isObj(o.board) ? o.board : {};
      const ranks = intRecord(b.ranks, 0, 100, true, 500);
      const paid = intRecord(b.paid, 0, MAX, true, 500);
      for (const k of Object.keys(paid)) if (!(k in ranks)) delete paid[k];
      return { ranks, paid, active: idList(b.active, 10), respecs: cnt(b.respecs) };
    }, () => def.board),
    heroes: safe(() => record(o.heroes, sanitizeHero, 200), () => def.heroes),
    mastery: safe(() => intRecord(o.mastery, 0, MAX, true, 500), () => ({})),
    relics: safe(() => intRecord(o.relics, 0, 6, false, 1000), () => ({})),
    loadout: safe(() => {
      const l = isObj(o.loadout) ? o.loadout : {};
      const sw = l.startWeapon;
      return {
        stage: idList([l.stage])[0] ?? def.loadout.stage,
        hero: idList([l.hero])[0] ?? def.loadout.hero,
        relics: idList(l.relics, 8),
        twists: intRecord(l.twists, 0, 10, true, 64),
        endless: l.endless === true,
        startWeapon: typeof sw === "string" ? (idList([sw])[0] ?? null) : null,
      };
    }, () => def.loadout),
    gacha: safe(() => sanitizeGacha(o.gacha, historySize), () => def.gacha),
    rotation: safe(() => {
      const r = isObj(o.rotation) ? o.rotation : {};
      return { cycle: cnt(r.cycle), runsLeft: int(r.runsLeft, def.rotation.runsLeft, 1, 1000) };
    }, () => def.rotation),
    achievements: safe(() => {
      const a = isObj(o.achievements) ? o.achievements : {};
      return { progress: numRecord(a.progress, 0, MAX, 2000), done: intRecord(a.done, 0, MAX, false, 2000), claimed: idList(a.claimed, 2000) };
    }, () => def.achievements),
    lifetime: safe(() => sanitizeLifetime(o.lifetime), defaultLifetime),
    codex: safe(() => {
      const c = isObj(o.codex) ? o.codex : {};
      return {
        heroes: idList(c.heroes, 200),
        weapons: idList(c.weapons, 500),
        passives: idList(c.passives, 500),
        enemies: idList(c.enemies, 1000),
        bosses: idList(c.bosses, 500),
        relics: idList(c.relics, 1000),
        stages: idList(c.stages, 100),
      };
    }, () => def.codex),
    records: safe(() => record(o.records, sanitizeStageRecord, 100), () => ({})),
    best: safe(() => {
      const b = isObj(o.best) ? o.best : {};
      return { time: sec(b.time), kills: cnt(b.kills), level: cnt(b.level), combo: cnt(b.combo) };
    }, () => def.best),
    settings: safe(() => sanitizeSettings(o.settings), () => ({ ...DEFAULT_SETTINGS })),
    tutorial: safe(() => {
      const t = isObj(o.tutorial) ? o.tutorial : {};
      return { dash: t.dash === true, ult: int(t.ult, 0, 0, 1000), flags: intRecord(t.flags, 0, 1e6, false, 200) };
    }, () => def.tutorial),
    titles: safe(() => {
      const t = isObj(o.titles) ? o.titles : {};
      const owned = idList(t.owned, 500);
      const eq = str(t.equipped, "", 64);
      return { owned, equipped: owned.includes(eq) ? eq : "" };
    }, () => def.titles),
    flags: safe(() => numRecord(o.flags, -MAX, MAX, 200), () => ({})),
    info: safe(() => {
      const i = isObj(o.info) ? o.info : {};
      return { created: cnt(i.created, now), lastPlayed: cnt(i.lastPlayed), migratedFrom: int(i.migratedFrom, 0, 0, 1000), repairs: cnt(i.repairs) };
    }, () => def.info),
  };
  // cross-field consistency that needs no content
  p.board.active = p.board.active.filter((id) => (p.board.ranks[id] ?? 0) > 0);
  p.achievements.claimed = p.achievements.claimed.filter((id) => id in p.achievements.done);
  if (!p.unlocks.heroes.includes(START_HERO)) p.unlocks.heroes.unshift(START_HERO);
  if (!p.unlocks.stages.includes(START_STAGE)) p.unlocks.stages.unshift(START_STAGE);
  for (const h of p.unlocks.heroes) if (!p.heroes[h]) p.heroes[h] = defaultHeroProgress();
  const repaired = safe(() => JSON.stringify(raw) !== JSON.stringify(p), () => true) || o.version !== PROFILE_VERSION;
  if (repaired && o.version === PROFILE_VERSION) p.info.repairs++;
  return { profile: p, repaired };
}

/** Set a misc. profile flag (UI events like "scrolled the fine print"). */
export function setFlag(p: Profile, key: string, value = 1): void {
  if (/^[A-Za-z0-9_.:-]{1,64}$/.test(key) && Number.isFinite(value)) p.flags[key] = value;
}

/** Plain-JSON deep copy of a profile (snapshots, export). */
export function cloneProfile(p: Profile): Profile {
  return JSON.parse(JSON.stringify(p)) as Profile;
}
