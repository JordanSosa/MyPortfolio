/**
 * applyRunToProfile (docs/EXPANSION.md §4): bank a finished run into the
 * profile and return a rich RunReport for the results v2 screen ("Episode
 * Results"): every payout line, hero XP and level-ups, weapon mastery ranks,
 * records, first clears / boss first kills / heat badges, codex discoveries,
 * unlocks, achievements, the banner rotation and "you can afford something".
 *
 *   World --RunSummary.stats--> applyRunToProfile(profile, summary) --> RunReport
 *
 * Mutates the given profile (callers persist it). PURE otherwise.
 */
import type { RunStats } from "../game/run-config";
import { affordableNodes } from "./board/board";
import { baseWeaponId, contentName, gameContent, type MetaContent } from "./content";
import { discover, isDiscovered } from "./codex";
import { computePayout, gradeRun, heroXpForRun, masteryInfo, masteryXpForDamage, newHeatBadges, runKills, type Grade, type PayoutPart } from "./economy";
import { claimAllAchievements, evaluateAchievements, noDashTime, type AchievementDone } from "./achievements/engine";
import { advanceRotation, featuredNow, type GachaItem } from "./gacha/banners";
import { addHeroXp, heroProgress, type XpGain } from "./heroes";
import { defaultStageRecord, type CodexTab, type Currencies, type Profile } from "./profile";
import { TUNING } from "./tuning";
import { evaluateUnlocks, type UnlockEvent } from "./unlocks";
import { addId, bump } from "./util";

/** What applyRunToProfile needs from World.summary(). */
export interface RunInput {
  stats: RunStats;
}

export interface MasteryGain {
  weapon: string;
  name: string;
  /** Mastery XP gained. */
  gained: number;
  rankBefore: number;
  rankAfter: number;
  /** Progress bar 0..1 into the current rank after the run. */
  fill: number;
  /** Crossed rank 5 ("LIMIT BREAK!") this run. */
  limitBreak: boolean;
  /** Reached rank 10 ("MASTERED") this run. */
  mastered: boolean;
}

export interface CodexFind {
  tab: CodexTab;
  id: string;
  name: string;
  gems: number;
}

export interface RunRecords {
  firstClear: boolean;
  newBestTime: boolean;
  newBestHeat: boolean;
  newBestEndless: boolean;
  newBestKills: boolean;
  newBestLevel: boolean;
  newBestCombo: boolean;
  /** Heat badges earned this run (4 / 8 / 16 / 32). */
  heatBadges: number[];
}

export interface RunReport {
  /** "Episode N" (the lifetime run count, this run included). */
  episode: number;
  outcome: "clear" | "death" | "quit";
  stage: string;
  stageName: string;
  hero: string;
  heroName: string;
  heat: number;
  endless: boolean;
  time: number;
  kills: number;
  grade: Grade;
  /** Payout lines, in display order; their amounts add up to `total`. */
  coins: PayoutPart;
  gems: PayoutPart;
  /** Balances after the run. */
  balances: Currencies;
  heroXp: XpGain;
  mastery: MasteryGain[];
  records: RunRecords;
  firstBossKills: string[];
  codex: CodexFind[];
  unlocks: UnlockEvent[];
  achievements: AchievementDone[];
  /** Achievement rewards auto-claimed (opts.autoClaim). */
  claimed: { count: number; gems: number; coins: number };
  banner: { rotated: boolean; runsLeft: number; featuredHero?: GachaItem; featuredRelic?: GachaItem };
  /** "The results screen always ends on 'you can afford something'". */
  affordable: { boardNodes: number; cheapestNode: number | null; tenPull: boolean; singlePull: boolean };
  /** v1-compatible global bests (title screen). */
  newBest: { time: boolean; kills: boolean; level: boolean; combo: boolean };
}

export interface ApplyOptions {
  /** Epoch ms for profile.info.lastPlayed. */
  now?: number;
  /** Claim achievement gems / coins right away (progression simulator). Default false: the UI claims. */
  autoClaim?: boolean;
}

const maxKey = (rec: Record<string, number>, key: string, v: number) => {
  if (v > (rec[key] ?? 0)) rec[key] = v;
};

/** Bank a finished run. See the file header. */
export function applyRunToProfile(p: Profile, summary: RunInput, ctx: MetaContent = gameContent(), opts: ApplyOptions = {}): RunReport {
  const s = summary.stats;
  const stage = ctx.stageById.get(s.stage);
  const L = p.lifetime;
  const rec = (p.records[s.stage] ??= defaultStageRecord());
  const outcome: RunReport["outcome"] = s.stageCleared ? "clear" : s.outcome === "quit" ? "quit" : "death";
  const kills = runKills(s);
  const name = (id: string) => contentName(id, ctx);

  // --- payout (decided against the profile BEFORE this run)
  const grade = gradeRun(s);
  const firstClear = s.stageCleared && rec.clears === 0;
  const firstBossKills: string[] = [];
  for (const b of s.bossKills) if (!(L.bossKills[b] > 0) && !firstBossKills.includes(b)) firstBossKills.push(b);
  const badges = s.stageCleared ? newHeatBadges(s.heat, rec.bestHeat) : [];
  const payout = computePayout({ stats: s, stage, grade, firstClear, firstBossKills, newHeatBadges: badges, names: name });
  p.currencies.coins += payout.coins.total;
  p.currencies.gems += payout.gems.total;
  L.coinsEarned += payout.coins.total;
  L.gemsEarned += payout.gems.total;

  // --- lifetime counters
  L.runs++;
  if (s.stageCleared) L.clears++;
  else if (outcome === "death") {
    L.deaths++;
    if (L.fastestDeath <= 0 || s.time < L.fastestDeath) L.fastestDeath = Math.max(0.01, s.time);
  }
  L.time += s.time;
  L.endlessTime += s.endlessTime;
  L.kills += kills;
  for (const k in s.killsByEnemy) bump(L.killsByEnemy, k, s.killsByEnemy[k]);
  L.eliteKills += s.eliteKills;
  const heatByBoss = (L.bossHeat[s.stage] ??= {});
  for (const b of s.bossKills) {
    bump(L.bossKills, b);
    if (s.heat > (heatByBoss[b] ?? -1)) heatByBoss[b] = s.heat;
  }
  for (const w in s.damageByWeapon) {
    const base = baseWeaponId(w, ctx);
    const d = s.damageByWeapon[w];
    L.damage += d;
    bump(L.damageByWeapon, base, d);
  }
  for (const w in s.killsByWeapon) bump(L.killsByWeapon, baseWeaponId(w, ctx), s.killsByWeapon[w]);
  L.dashes += s.dashes;
  L.ults += s.ults;
  L.levelUps += s.levelUps;
  L.chests += s.chests;
  L.foodEaten += s.foodEaten;
  L.evolutions += s.evolutions.length;
  L.maxEvolutions = Math.max(L.maxEvolutions, s.evolutions.length);
  L.revivesUsed += s.revivesUsed;
  L.damageTaken += s.damageTaken;
  L.coinsPicked += s.coins;
  L.maxCombo = Math.max(L.maxCombo, s.maxCombo);
  L.maxRank = Math.max(L.maxRank, s.maxRank);
  L.bestLevel = Math.max(L.bestLevel, s.level);
  L.noHitBest = Math.max(L.noHitBest, s.noHitBest);
  L.noDashBest = Math.max(L.noDashBest, noDashTime(s));
  L.pacifistBest = Math.max(L.pacifistBest, s.pacifistBest ?? 0);
  if (s.stageCleared) addId(L.heroesCleared, s.hero);

  // --- stage record
  const records: RunRecords = {
    firstClear,
    newBestTime: s.time > rec.bestTime + 0.5,
    newBestHeat: s.stageCleared && s.heat > rec.bestHeat,
    newBestEndless: s.endlessTime > rec.bestEndless + 0.5,
    newBestKills: kills > rec.bestKills,
    newBestLevel: s.level > rec.bestLevel,
    newBestCombo: s.maxCombo > rec.bestCombo,
    heatBadges: badges,
  };
  rec.runs++;
  if (s.stageCleared) rec.clears++;
  if (firstClear) rec.firstClear = L.runs;
  if (records.newBestTime) rec.bestTime = s.time;
  if (records.newBestHeat) rec.bestHeat = s.heat;
  if (records.newBestEndless) rec.bestEndless = s.endlessTime;
  if (records.newBestKills) rec.bestKills = kills;
  if (records.newBestLevel) rec.bestLevel = s.level;
  if (records.newBestCombo) rec.bestCombo = s.maxCombo;
  const b = p.best;
  const newBest = { time: s.time > b.time + 0.5, kills: kills > b.kills, level: s.level > b.level, combo: s.maxCombo > b.combo };
  if (newBest.time) b.time = s.time;
  if (newBest.kills) b.kills = kills;
  if (newBest.level) b.level = s.level;
  if (newBest.combo) b.combo = s.maxCombo;

  // --- hero
  const hp = heroProgress(p, s.hero);
  hp.runs++;
  if (s.stageCleared) hp.clears++;
  hp.kills += kills;
  hp.time += s.time;
  hp.bestTime = Math.max(hp.bestTime, s.time);
  const heroXp = addHeroXp(p, s.hero, Math.round(heroXpForRun(s, stage) * catchUpMul(p, s.hero)));

  // --- weapon mastery (evolutions feed their base weapon)
  const dmgByBase: Record<string, number> = {};
  for (const w in s.damageByWeapon) {
    if (!ctx.weapons.has(w)) continue; // ultimates and relic effects are not weapons
    bump(dmgByBase, baseWeaponId(w, ctx), s.damageByWeapon[w]);
  }
  const mastery: MasteryGain[] = [];
  for (const id of Object.keys(dmgByBase).sort((a, b2) => dmgByBase[b2] - dmgByBase[a])) {
    const gained = masteryXpForDamage(dmgByBase[id]);
    if (gained <= 0) continue;
    const before = masteryInfo(p.mastery[id] ?? 0);
    p.mastery[id] = (p.mastery[id] ?? 0) + gained;
    const after = masteryInfo(p.mastery[id]);
    mastery.push({
      weapon: id,
      name: name(id),
      gained,
      rankBefore: before.rank,
      rankAfter: after.rank,
      fill: after.maxed ? 1 : after.into / after.need,
      limitBreak: before.rank < 5 && after.rank >= 5,
      mastered: before.rank < TUNING.mastery.maxRank && after.rank >= TUNING.mastery.maxRank,
    });
  }

  // --- codex (small gem bounties, shown as one payout line)
  const codex: CodexFind[] = [];
  const find = (tab: CodexTab, id: string) => {
    if (isDiscovered(p, tab, id)) return;
    codex.push({ tab, id, name: name(id), gems: discover(p, tab, id) });
  };
  if (ctx.heroById.has(s.hero)) find("heroes", s.hero);
  if (stage) find("stages", stage.id);
  for (const e in s.killsByEnemy) if (ctx.enemies.has(e)) find("enemies", e);
  for (const bId of s.bossKills) if (ctx.bosses.has(bId)) find("bosses", bId);
  const used = new Set<string>([...(s.weaponsUsed ?? []), ...Object.keys(s.damageByWeapon)]);
  for (const w of used) {
    const base = baseWeaponId(w, ctx);
    if (ctx.weapons.has(base) && !ctx.weapons.get(base)!.evolved) find("weapons", base);
    // an evolution is its own discovery (the wiki's recipe card; "Evolve X" Plot Points)
    if (base !== w && ctx.weapons.get(w)?.evolved) find("weapons", w);
  }
  for (const id of s.passivesUsed ?? []) if (ctx.passives.has(id)) find("passives", id);
  const codexGems = codex.reduce((a, c) => a + c.gems, 0);
  const gems: PayoutPart = { lines: [...payout.gems.lines], total: payout.gems.total };
  if (codexGems > 0) {
    gems.lines.push({ id: "codex", label: "Wiki discoveries", amount: codexGems, detail: `${codex.length} new entr${codex.length === 1 ? "y" : "ies"}` });
    gems.total += codexGems;
  }

  // --- banner rotation, unlocks, achievements
  const rotated = advanceRotation(p);
  const unlocks = evaluateUnlocks(p, ctx).filter((e) => !e.start);
  const achievements = evaluateAchievements(p, s, ctx);
  for (const a of achievements) if (a.unlocked) unlocks.push(a.unlocked);
  const claimed = opts.autoClaim ? claimAllAchievements(p) : { count: 0, gems: 0, coins: 0 };
  if (opts.now) p.info.lastPlayed = opts.now;

  const nodes = affordableNodes(p, ctx);
  return {
    episode: L.runs,
    outcome,
    stage: s.stage,
    stageName: stage?.name ?? s.stage,
    hero: s.hero,
    heroName: name(s.hero),
    heat: s.heat,
    endless: s.endless,
    time: s.time,
    kills,
    grade,
    coins: payout.coins,
    gems,
    balances: { ...p.currencies },
    heroXp,
    mastery,
    records,
    firstBossKills,
    codex,
    unlocks,
    achievements,
    claimed,
    banner: { rotated, runsLeft: p.rotation.runsLeft, featuredHero: featuredNow(p, "hero", ctx), featuredRelic: featuredNow(p, "relic", ctx) },
    affordable: {
      boardNodes: nodes.length,
      cheapestNode: nodes.length ? nodes[0].cost : null,
      tenPull: p.currencies.gems >= TUNING.gacha.tenPullCost,
      singlePull: p.currencies.gems >= TUNING.gacha.pullCost,
    },
    newBest,
  };
}

/**
 * Hero XP multiplier for a hero that trails the account's best hero ("Recap Episode": a
 * newly unlocked hero catches up quickly): x (1 + TUNING.hero.catchUp) while its level is
 * more than TUNING.hero.catchUpGap below the highest hero level, else x1.
 */
export function catchUpMul(p: Profile, hero: string): number {
  const H = TUNING.hero;
  let best = 1;
  for (const id in p.heroes) best = Math.max(best, p.heroes[id]?.level ?? 1);
  const lv = p.heroes[hero]?.level ?? 1;
  return lv < best - H.catchUpGap ? 1 + H.catchUp : 1;
}

/**
 * RunStats for a run summary from a build whose World did not report them
 * (v1-shaped summaries): enough for payout, XP and records.
 */
export function statsFromLegacySummary(s: { hero: string; time: number; level: number; kills: number; maxCombo: number; coins: number; victory: boolean; damageTaken: number; weapons: { id: string; damage: number; kills: number }[] }, stage = "dream_meadow"): RunStats {
  const damageByWeapon: Record<string, number> = {};
  const killsByWeapon: Record<string, number> = {};
  for (const w of s.weapons) {
    damageByWeapon[w.id] = w.damage;
    killsByWeapon[w.id] = w.kills;
  }
  return {
    stage,
    hero: s.hero,
    twists: [],
    heat: 0,
    endless: false,
    time: s.time,
    endlessTime: 0,
    stageCleared: s.victory,
    killsByEnemy: s.kills > 0 ? { unknown: s.kills } : {},
    eliteKills: 0,
    bossKills: [],
    damageByWeapon,
    killsByWeapon,
    evolutions: [],
    dashes: 0,
    ults: 0,
    levelUps: Math.max(0, s.level - 1),
    level: s.level,
    chests: 0,
    coins: s.coins,
    foodEaten: 0,
    maxCombo: s.maxCombo,
    maxRank: -1,
    damageTaken: s.damageTaken,
    noHitBest: 0,
    revivesUsed: 0,
    outcome: s.victory ? "victory" : "dead",
  };
}
