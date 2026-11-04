/**
 * Headless progression simulator (docs/EXPANSION.md §13): plays many
 * consecutive runs with one account, exactly like a player would:
 *
 *   buildRunConfig(profile) -> new World({ hero, run }) + bot (src/debug/bot simulate)
 *     -> applyRunToProfile (auto-claiming Plot Points) -> spending policy
 *        (board nodes by value / cost, talents, the first single pull, 10-pulls,
 *         spark, Copium vouchers, relic equip, keystones)
 *
 * and reports hours (and runs) to each milestone of EXPANSION §2 plus income /
 * spend and power curves, unlock times, checkpoint snapshots and the
 * "something to buy" (dead zone) numbers. Not part of `npm test`.
 * One account per process; `node tools/progression.mjs` runs many in parallel
 * (bots x seeds) and aggregates them.
 *
 *   npm run progression                         # mid bot, 40 runs
 *   BOT=weak|mid|good|strong RUNS=200 HOURS=12 SEED=3 npm run progression
 *   EVERY=10 (curve row every N runs)  OVERHEAD=45 (menu seconds per run)  DT=0.0333  MAXE=250
 *   STRIDE=4 STRIDE_FROM=final|<hours>   (late game: bank each simulated run 4 times, from the
 *                                         first Final Arc clear / from that many hours on)
 *   ENDGAME=0 (no heat ladder / hero rotation after the Final Arc clear)  TRY_NEW=0 (no try-out run per new hero)
 *   FARM=0 (always push the furthest stage, never farm the previous one)  FARM_BELOW=0.4
 *   OUT=shots/progression/mid.json (write the log as JSON)   LINES=1 (print every payout line)  QUIET=1
 *   SAVE_AT=30 SAVE_TO=x.json (dump the account at 30 h)   RESUME=x.json (continue that account: late-game tuning
 *                                                        without replaying the first hours; HOURS counts from 0)
 *
 * Bots (src/debug/bot.ts makeBot): weak = lazy (random level-up picks, never
 * dashes); mid = the average player (knows the build rules, takes the shiny
 * card a third of the time, slower and sloppier); good = the autoplay bot;
 * strong = faster reactions and less slop.
 *
 * The player model (tools/policy.ts + below): pushes the furthest open stage
 * with the hero it has played most (each newly unlocked hero gets one try-out
 * run) and the best relics, and after a short death there (under 40 % of the
 * stage, not cleared yet) farms the last cleared stage for one run; buys board nodes by
 * value / cost after every run (nothing open on the board: hero levels with
 * the coin accelerator instead); spends talent points; does the first single
 * pull, then 10-pulls (featured hero banner first); claims the spark; turns
 * Copium into vouchers. After the first Final Arc clear (ENDGAME) it climbs a
 * Plot Twist heat ladder on the Final Arc with the main hero (+2 heat after a
 * clear, -2 after two failures in a row) and every other run trains its
 * lowest-level hero (heat 0), so hero levels / talents and the heat badges
 * keep moving in the hundreds-of-hours tail.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { test } from "vitest";
import { Rng } from "../src/core/rng";
import { makeBot, simulate } from "../src/debug/bot";
import { baseStats } from "../src/game/stats";
import { World } from "../src/game/world";
import { claimAllAchievements, evaluateAchievements } from "../src/meta/achievements/engine";
import { affordableNodes, boardProgress } from "../src/meta/board/board";
import { BOARD } from "../src/meta/board/graph";
import { gameContent, type MetaContent } from "../src/meta/content";
import { masteryRank } from "../src/meta/economy";
import { bannerView } from "../src/meta/gacha/banners";
import { claimSpark, pull, sparkChoices } from "../src/meta/gacha/engine";
import { buyOffer, exchangeCatalogue } from "../src/meta/gacha/exchange";
import { talentPoints } from "../src/meta/heroes";
import { buildRunConfig, relicSlots, type LoadoutChoice } from "../src/meta/loadout";
import { defaultProfile, type Profile } from "../src/meta/profile";
import { reconcileProfile } from "../src/meta/reconcile";
import { applyRunToProfile, type RunReport } from "../src/meta/rewards";
import { heroOrder, ROSTER } from "../src/meta/roster";
import { TUNING } from "../src/meta/tuning";
import { applyPatch } from "./patch";
import { bestRelics, chooseLoadout, spendBoard, spendHeroLevels, spendTalents, twistsForHeat, TWIST_LADDER_MAX } from "./policy";

// ---------------------------------------------------------------- gacha policy

function spendGacha(p: Profile, rng: Rng, ctx: MetaContent): number {
  let pulls = 0;
  const banner = () => (bannerView(p, "hero", ctx).available ? "hero" : bannerView(p, "relic", ctx).available ? "relic" : "permanent");
  // the very first pull is a single one (the "Just one. Surely." Plot Point pays it back)
  if (p.gacha.stats.pulls === 0 && p.currencies.gems >= TUNING.gacha.pullCost) {
    if (pull(p, banner(), 1, rng, ctx).ok) pulls += 1;
  }
  while (p.currencies.gems >= TUNING.gacha.tenPullCost) {
    const o = pull(p, banner(), 10, rng, ctx);
    if (!o.ok) break;
    pulls += 10;
  }
  if (p.gacha.spark >= TUNING.gacha.spark) {
    const c = sparkChoices(ctx);
    if (c.length) claimSpark(p, c[0].id, ctx);
  }
  // Copium: vouchers back into the machine
  for (let guard = 0; guard < 50; guard++) {
    const v = exchangeCatalogue(p, ctx).find((o) => o.id === "voucher");
    if (!v || v.block) break;
    buyOffer(p, "voucher", ctx);
  }
  return pulls;
}

// ---------------------------------------------------------------- milestones

interface Milestone {
  id: string;
  label: string;
  target: string;
  test: (p: Profile, ctx: MetaContent) => boolean;
}

const stageCleared = (order: number) => (p: Profile, ctx: MetaContent) => {
  const s = ctx.stages.find((x) => x.order === order);
  return !!s && (p.records[s.id]?.clears ?? 0) > 0;
};
const ringDone = (ring: number) => (p: Profile) => BOARD.nodes.filter((n) => n.ring === ring).every((n) => (p.board.ranks[n.id] ?? 0) >= n.maxRank);
const gameplayHeroes = ROSTER.filter((r) => r.source === "start" || r.source === "play").map((r) => r.id);
/** Weapons a player earns by playing: everything except the gacha heroes' signature weapons. */
const gameplayWeapons = (ctx: MetaContent) => {
  const gachaSig = new Set(ROSTER.filter((r) => r.source === "gacha" || r.source === "mythic").map((r) => ctx.heroById.get(r.id)?.weapon));
  return ctx.baseWeapons.filter((w) => !gachaSig.has(w.id)).map((w) => w.id);
};
const weaponUnlocked = (p: Profile, ctx: MetaContent, id: string) => {
  if (p.unlocks.weapons.includes(id)) return true;
  const owner = ctx.heroes.find((h) => h.weapon === id);
  return !!owner && p.unlocks.heroes.includes(owner.id);
};
const allHeroes = (p: Profile) => gameplayHeroes.every((id) => p.unlocks.heroes.includes(id));
const allWeapons = (p: Profile, ctx: MetaContent) => gameplayWeapons(ctx).every((id) => weaponUnlocked(p, ctx, id) || ["star_shot", "petal_slash", "yarn_orbit", "heart_boomerang", "thunder_bell", "candy_bomb", "bubble_aura", "prism_beam"].includes(id));
const allPassives = (p: Profile, ctx: MetaContent) => [...ctx.passives.keys()].every((id) => p.unlocks.passives.includes(id) || ["power_bow", "wish_charm", "big_ribbon", "twin_charm", "swift_shoes", "magnet_star", "lucky_clover", "heart_locket"].includes(id));
const ssrPlus = (p: Profile) => p.gacha.stats.byRarity.SSR + p.gacha.stats.byRarity.UR + p.gacha.stats.byRarity.LR + p.gacha.stats.byRarity.MYTHIC;
const mainHero = (p: Profile) => Object.keys(p.heroes).sort((a, b) => (p.heroes[b].runs ?? 0) - (p.heroes[a].runs ?? 0) || heroOrder(a) - heroOrder(b))[0] ?? "hoshi";
const heatCleared = (h: number) => (p: Profile) => Object.values(p.records).some((r) => r.bestHeat >= h);

export const MILESTONES: Milestone[] = [
  { id: "first_buy", label: "First board node", target: "run 1", test: (p) => boardProgress(p).ranks > 0 },
  { id: "first_pull", label: "First Merch Machine pull", target: "first hour", test: (p) => p.gacha.stats.pulls > 0 },
  { id: "king_puff", label: "First King Puff kill", target: "runs 3-6 (0.5-1 h)", test: (p) => (p.lifetime.bossKills.king_puff ?? 0) > 0 },
  { id: "clear1", label: "Dream Meadow clear", target: "1.5-3 h", test: stageCleared(1) },
  { id: "clear2", label: "Candy Kingdom clear", target: "4-7 h", test: stageCleared(2) },
  { id: "clear3", label: "Shoujo Academy clear", target: "8-14 h", test: stageCleared(3) },
  { id: "clear4", label: "Beach Episode clear", target: "15-25 h", test: stageCleared(4) },
  { id: "clear5", label: "Final Arc clear", target: "30-45 h", test: stageCleared(5) },
  { id: "heroes", label: "All gameplay heroes unlocked", target: "-", test: allHeroes },
  { id: "weapons", label: "All gameplay weapons unlocked", target: "-", test: allWeapons },
  { id: "passives", label: "All passives unlocked", target: "-", test: allPassives },
  { id: "unlocks", label: "All gameplay heroes + weapons", target: "40-60 h", test: (p, ctx) => allHeroes(p) && allWeapons(p, ctx) },
  { id: "first10", label: "First 10-pull", target: "-", test: (p) => p.gacha.stats.tenPulls > 0 },
  { id: "firstSSR", label: "First SSR+ pull", target: "-", test: (p) => ssrPlus(p) > 0 },
  { id: "firstUR", label: "First UR+ pull", target: "-", test: (p) => p.gacha.stats.byRarity.UR + p.gacha.stats.byRarity.LR + p.gacha.stats.byRarity.MYTHIC > 0 },
  { id: "firstLR", label: "First LR+ pull", target: "-", test: (p) => p.gacha.stats.byRarity.LR + p.gacha.stats.byRarity.MYTHIC > 0 },
  { id: "mythic", label: "First MYTHIC (pull or spark)", target: "-", test: (p, ctx) => Object.keys(p.relics).some((id) => ctx.relics.get(id)?.rarity === "MYTHIC") || p.unlocks.heroes.includes("truck_kun") },
  { id: "slots4", label: "4 relic slots", target: "-", test: (p) => relicSlots(p) >= 4 },
  { id: "ring1", label: "Board ring 1 complete", target: "-", test: ringDone(1) },
  { id: "ring2", label: "Board ring 2 complete", target: "-", test: ringDone(2) },
  { id: "ring3", label: "Board ring 3 complete", target: "-", test: ringDone(3) },
  { id: "ring4", label: "Board ring 4 complete", target: "-", test: ringDone(4) },
  { id: "board", label: "Board fully bought", target: "100-150 h", test: (p) => boardProgress(p).ranks >= boardProgress(p).totalRanks },
  { id: "lv10", label: "Main hero Lv 10", target: "~3 h (P2)", test: (p) => p.heroes[mainHero(p)].level >= 10 },
  { id: "lv20", label: "Main hero Lv 20", target: "~15 h (P4)", test: (p) => p.heroes[mainHero(p)].level >= 20 },
  { id: "lv30", label: "Main hero Lv 30", target: "~80 h (P6)", test: (p) => p.heroes[mainHero(p)].level >= TUNING.hero.maxLevel },
  { id: "allLv30", label: "Every gameplay hero Lv 30", target: "200 h+", test: (p) => gameplayHeroes.every((h) => (p.heroes[h]?.level ?? 0) >= TUNING.hero.maxLevel) },
  { id: "mastery5", label: "A weapon at mastery 5", target: "~8 h (P3)", test: (p) => Object.values(p.mastery).some((xp) => masteryRank(xp) >= 5) },
  { id: "mastery10", label: "A weapon at mastery 10", target: "~80 h (P6)", test: (p) => Object.values(p.mastery).some((xp) => masteryRank(xp) >= 10) },
  { id: "masteryAll", label: "Mastery 10 on every weapon", target: "200 h+", test: (p, ctx) => ctx.baseWeapons.every((w) => masteryRank(p.mastery[w.id] ?? 0) >= 10) },
  { id: "heat8", label: "A heat 8 clear", target: "-", test: heatCleared(8) },
  { id: "heat16", label: "A heat 16 clear", target: "-", test: heatCleared(16) },
  { id: "heat32", label: "A heat 32 clear", target: "-", test: heatCleared(32) },
  { id: "heatMax", label: `A max-heat clear (${TWIST_LADDER_MAX})`, target: "200 h+", test: heatCleared(TWIST_LADDER_MAX) },
];

/** Snapshot hours: the checkpoint hours (META.md §9.1) and a few in between. */
const SNAP_HOURS = [0.5, 1, 2, 3, 5, 8, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300];

export interface Snapshot {
  h: number;
  run: number;
  board: number;
  ranks: number;
  /** Main hero level / talent points. */
  lv: number;
  hero: string;
  /** Mastery rank of the main hero's signature weapon / the best other weapon / median of weapons with any XP. */
  sig: number;
  best: number;
  med: number;
  relics: string[];
  slots: number;
  owned: number;
  constellation: number;
  heroes: number;
  pulls: number;
  gems: number;
  copium: number;
  clears: number[];
  heat: number;
}

function snapshot(p: Profile, ctx: MetaContent, h: number, run: number, heat: number): Snapshot {
  const bp = boardProgress(p);
  const hero = mainHero(p);
  const hp = p.heroes[hero];
  const sigId = ctx.heroById.get(hero)?.weapon ?? "";
  const ranks = ctx.baseWeapons.map((w) => ({ id: w.id, r: masteryRank(p.mastery[w.id] ?? 0), xp: p.mastery[w.id] ?? 0 }));
  const other = ranks.filter((x) => x.id !== sigId).sort((a, b) => b.r - a.r);
  const used = ranks.filter((x) => x.xp > 0).map((x) => x.r).sort((a, b) => a - b);
  return {
    h,
    run,
    board: bp.spent,
    ranks: bp.ranks,
    lv: hp.level,
    hero,
    sig: masteryRank(p.mastery[sigId] ?? 0),
    best: other[0]?.r ?? 0,
    med: used.length ? used[used.length >> 1] : 0,
    relics: bestRelics(p, ctx).map((id) => `${ctx.relics.get(id)?.rarity ?? "?"}:${id}*${p.relics[id] ?? 0}`),
    slots: relicSlots(p),
    owned: Object.keys(p.relics).length,
    constellation: hp.constellation,
    heroes: p.unlocks.heroes.length,
    pulls: p.gacha.stats.pulls,
    gems: p.currencies.gems,
    copium: p.currencies.copium,
    clears: ctx.stages.map((s) => p.records[s.id]?.clears ?? 0),
    heat,
  };
}

// ---------------------------------------------------------------- the loop

export interface RunLog {
  run: number;
  /** Hours played at the end of the run (menu overhead included). */
  h: number;
  stage: string;
  hero: string;
  lv: number;
  out: RunReport["outcome"];
  t: number;
  kills: number;
  heat: number;
  /** Payout coins / gems (gems: payout + codex + claimed Plot Points). */
  coins: number;
  gems: number;
  /** Plot Point coins claimed. */
  achCoins: number;
  hxp: number;
  /** Hero levels gained this run. */
  lvUp: number;
  /** New pulls made after this run. */
  newPulls: number;
  /** Hero levels bought with coins (dead-zone fallback: nothing open on the board). */
  lvBought: number;
  /** Cheapest open board node before the run (null: nothing open to buy). */
  cheap: number | null;
  /** The payout alone covers the cheapest node that was open before the run. */
  payBuys: boolean;
  /** Something is affordable on Results (report.affordable.boardNodes > 0). */
  afford: boolean;
  /** Board ranks / coins bought after this run. */
  bought: number;
  spent: number;
  /** Coins left after spending. */
  wallet: number;
  board: number;
  ranks: number;
  pulls: number;
  ssr: number;
  unlocks: string[];
  /** How many times this simulated run was banked (STRIDE). */
  copy: number;
  /** Relics equipped for the run ("SSR:id*stars") and the hero's constellation. */
  relics: string[];
  con: number;
  might: number;
  hp: number;
  ms: number;
}

const fmtH = (h: number) => `${h.toFixed(2)} h`;
const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);

test("progression simulator", () => {
  const ctx = gameContent();
  const env = process.env;
  const botKind = env.BOT ?? "mid";
  const maxRuns = Number(env.RUNS ?? 40);
  const maxHours = Number(env.HOURS ?? 1e9);
  const seed = Number(env.SEED ?? 1);
  const every = Number(env.EVERY ?? 5);
  const overhead = Number(env.OVERHEAD ?? 45);
  const dt = Number(env.DT ?? 1 / 30);
  const maxE = Number(env.MAXE ?? 250);
  const stride = Math.max(1, Math.floor(Number(env.STRIDE ?? 1)));
  const strideFrom = env.STRIDE_FROM ?? "final";
  const endgame = env.ENDGAME !== "0";
  const quiet = !!env.QUIET;
  const tryNew = env.TRY_NEW !== "0";
  // farming (FARM=0 turns it off): after a frontier attempt (the furthest stage, not cleared yet) that died
  // before FARM_BELOW of the stage's length, the next run replays the furthest CLEARED stage for coins, then
  // it is back to the frontier
  const farm = env.FARM !== "0";
  const farmBelow = Number(env.FARM_BELOW ?? 0.4);
  let farmNext = false;
  const rng = new Rng(seed * 7919);
  // PATCH='{"stage.dream_meadow.scaling": {...}, "boss.lady_lunatic.hp": 70000}' (or a .json file): a combat tuning
  // patch (tools/patch.ts) applied for the whole account - sweeps without editing files
  const patchSrc = env.PATCH ? (env.PATCH.trim().startsWith("{") ? env.PATCH : readFileSync(env.PATCH, "utf8")) : "";
  const undoPatch = applyPatch(patchSrc ? JSON.parse(patchSrc) : undefined);
  const stopAt = env.STOP_AT === "final" ? ctx.stages.length : Number(env.STOP_AT ?? 0);
  let stopNow = false;

  const resume = env.RESUME ? JSON.parse(readFileSync(env.RESUME, "utf8")) : null;
  const p: Profile = resume ? resume.profile : defaultProfile(0);
  reconcileProfile(p, ctx);
  const saveAt = Number(env.SAVE_AT ?? NaN);
  let saved = false;
  const reached = new Map<string, { run: number; hours: number }>();
  const unlockAt: Record<string, { run: number; h: number }> = {};
  const logs: RunLog[] = [];
  const snaps: Snapshot[] = [];
  let snapI = 0;
  let hours = resume ? resume.hours : 0;
  let pulls = resume ? resume.pulls : 0;
  let realRuns = resume ? resume.realRuns : 0;
  const t0 = Date.now();
  const ladder = resume ? resume.ladder : { heat: 0, fails: 0 };
  let finalCleared = resume ? resume.finalCleared : false;
  if (resume) for (const k of Object.keys(resume.milestones ?? {})) reached.set(k, resume.milestones[k]);
  if (resume) while (snapI < SNAP_HOURS.length && SNAP_HOURS[snapI] <= hours) snapI++;
  const endHours = resume ? hours + maxHours : maxHours;
  if (!quiet) {
    console.log(`progression: bot=${botKind} runs<=${maxRuns} hours<=${maxHours} seed=${seed} dt=${dt.toFixed(4)} overhead=${overhead}s maxEnemies=${maxE} stride=${stride}@${strideFrom} endgame=${endgame}`);
    console.log(`content: ${ctx.heroes.length} heroes, ${ctx.baseWeapons.length} weapons, ${ctx.stages.length} stages, ${ctx.relics.size} relics, ${ctx.talents.size} talent trees, ${ctx.twists.size} twists; board ${BOARD.nodes.length - 1} nodes, ${boardProgress(p).totalCost.toLocaleString()} coins total`);
  }
  const finalStage = ctx.stages[ctx.stages.length - 1];

  for (let run = resume ? resume.run + 1 : 1; run <= maxRuns + (resume ? resume.run : 0) && hours < endHours && !stopNow; ) {
    // ---- loadout (the player model)
    let choice: LoadoutChoice = chooseLoadout(p, ctx);
    // a new hero gets one try-out run ("NEW HERO UNLOCKED!" - who wouldn't?)
    const fresh = tryNew ? p.unlocks.heroes.find((h) => ctx.heroById.has(h) && (p.heroes[h]?.runs ?? 0) === 0) : undefined;
    if (fresh) choice = { ...choice, hero: fresh };
    let farmRun = false;
    if (farm && farmNext && !fresh && !finalCleared) {
      const done = ctx.stages.filter((x) => p.unlocks.stages.includes(x.id) && (p.records[x.id]?.clears ?? 0) > 0);
      const back = done[done.length - 1];
      if (back && back.id !== choice.stage) {
        choice = { ...choice, stage: back.id };
        farmRun = true;
      }
    }
    farmNext = false;
    let ladderRun = false;
    if (endgame && finalCleared && !fresh) {
      const train = realRuns % 2 === 1 ? lowestHero(p, ctx) : null;
      if (train) choice = { ...choice, hero: train, stage: finalStage.id, twists: {} };
      else {
        choice = { ...choice, stage: finalStage.id, twists: twistsForHeat(ladder.heat, p, ctx) };
        ladderRun = true;
      }
    }
    const plan = buildRunConfig(p, choice, ctx);
    const stage = ctx.stageById.get(plan.config.stage)!;
    const s = baseStats();
    for (const m of plan.config.mods) m(s);
    const ms0 = Date.now();
    const w = new World({ hero: plan.hero, seed: seed * 100003 + run, run: plan.config, maxEnemies: maxE });
    // (a real player keeps fighting a final boss: stop at the clear, the death or 5:00 past the stage length)
    simulate(w, stage.duration + 300, dt, makeBot(botKind, seed * 31 + run));
    const ms = Date.now() - ms0;
    realRuns++;
    const summary = w.summary();
    if (farm && !farmRun && !fresh && !finalCleared && !summary.stats.stageCleared && (p.records[stage.id]?.clears ?? 0) === 0 && summary.stats.time < farmBelow * stage.duration) farmNext = true;
    const copies = stride > 1 && (strideFrom === "final" ? finalCleared : hours >= Number(strideFrom)) ? stride : 1;
    for (let c = 0; c < copies && hours < endHours; c++, run++) {
      const cheapBefore = affordableCheapest(p, ctx);
      const report = applyRunToProfile(p, structuredClone(summary), ctx, { autoClaim: true });
      hours += (report.time + overhead) / 3600;
      for (const u of report.unlocks) if (!unlockAt[u.id]) unlockAt[u.id] = { run, h: hours };
      // spending
      const spent0 = boardProgress(p).spent;
      const ranks0 = boardProgress(p).ranks;
      spendBoard(p, ctx);
      for (const h of p.unlocks.heroes) spendTalents(p, h, ctx);
      const np = spendGacha(p, rng, ctx);
      pulls += np;
      for (const a of evaluateAchievements(p, null, ctx)) if (a.unlocked && !unlockAt[a.unlocked.id]) unlockAt[a.unlocked.id] = { run, h: hours };
      const extra = claimAllAchievements(p);
      spendBoard(p, ctx);
      for (const h of p.unlocks.heroes) spendTalents(p, h, ctx);
      const lvBought = spendHeroLevels(p, chooseLoadout(p, ctx).hero ?? plan.hero, ctx);
      const bp = boardProgress(p);
      logs.push({
        run,
        h: hours,
        stage: stage.id,
        hero: plan.hero,
        lv: p.heroes[plan.hero]?.level ?? 1,
        out: report.outcome,
        t: Math.round(report.time),
        kills: report.kills,
        heat: report.heat,
        coins: report.coins.total,
        gems: report.gems.total + report.claimed.gems + extra.gems,
        achCoins: report.claimed.coins + extra.coins,
        hxp: report.heroXp.gained,
        lvUp: report.heroXp.levelUps.length,
        newPulls: np,
        lvBought,
        cheap: cheapBefore,
        payBuys: cheapBefore !== null && report.coins.total >= cheapBefore,
        afford: report.affordable.boardNodes > 0,
        bought: bp.ranks - ranks0,
        spent: bp.spent - spent0,
        wallet: Math.round(p.currencies.coins),
        board: bp.spent,
        ranks: bp.ranks,
        pulls,
        ssr: ssrPlus(p),
        unlocks: report.unlocks.map((u) => u.id),
        copy: c,
        relics: (plan.config.relics ?? []).map((r) => `${ctx.relics.get(r.id)?.rarity ?? "?"}:${r.id}*${r.stars}`),
        con: plan.config.constellation ?? 0,
        might: Math.round(s.might * 100) / 100,
        hp: Math.round(s.maxHp),
        ms: c === 0 ? ms : 0,
      });
      if (stage.id === finalStage.id && report.outcome === "clear") finalCleared = true;
      // STOP_AT=final (or a stage order 1-5): end the account at that stage's first clear (stage-clear tuning sweeps)
      if (stopAt && report.outcome === "clear" && stage.order >= stopAt) stopNow = true;
      for (const m of MILESTONES) if (!reached.has(m.id) && m.test(p, ctx)) reached.set(m.id, { run, hours });
      while (snapI < SNAP_HOURS.length && hours >= SNAP_HOURS[snapI]) snaps.push(snapshot(p, ctx, SNAP_HOURS[snapI++], run, ladder.heat));
      if (env.LINES) {
        const show = (part: RunReport["coins"]) => part.lines.map((x) => `${x.label}${x.mul ? ` x${x.mul}` : ""} ${x.amount}`).join(" | ");
        console.log(`  coins: ${show(report.coins)}\n  gems:  ${show(report.gems)}${report.claimed.gems ? ` | Plot Points ${report.claimed.gems}` : ""}`);
      }
      if (env.VERBOSE) {
        const l = logs[logs.length - 1];
        console.log(
          `  #${lpad(run, 3)} ${fmtH(hours)} ${pad(l.stage, 15)} ${pad(l.hero, 8)} Lv${lpad(l.lv, 2)} ${pad(l.out, 5)} ${fmtT(l.t)} h${lpad(l.heat, 2)} k${lpad(l.kills, 6)} +${lpad(l.coins, 6)}c +${lpad(l.gems, 4)}g xp+${lpad(l.hxp, 5)} cheap ${lpad(l.cheap ?? "-", 6)} bought ${lpad(l.bought, 2)} board ${l.ranks}/${bp.totalRanks} ${l.board} pulls ${l.pulls} ssr ${l.ssr} C${l.con} [${l.relics.join(" ")}]${l.unlocks.length ? ` NEW ${l.unlocks.join(",")}` : ""}${c ? " (copy)" : ` (${ms} ms)`}`,
        );
      }
    }
    if (!saved && hours >= saveAt && env.SAVE_TO) {
      saved = true;
      mkdirSync(dirname(env.SAVE_TO), { recursive: true });
      writeFileSync(env.SAVE_TO, JSON.stringify({ profile: p, hours, run: run - 1, pulls, realRuns, ladder, finalCleared, milestones: Object.fromEntries(reached) }));
    }
    if (ladderRun) {
      if (summary.stats.stageCleared) {
        ladder.heat = Math.min(TWIST_LADDER_MAX, ladder.heat + 2);
        ladder.fails = 0;
      } else if (++ladder.fails >= 2) {
        ladder.heat = Math.max(0, ladder.heat - 2);
        ladder.fails = 0;
      }
    }
  }
  snaps.push(snapshot(p, ctx, hours, logs.length, ladder.heat));
  // SAVE_END=1 SAVE_TO=f: dump the account where it stopped (with STOP_AT: the next stage's sweeps RESUME from it)
  if (env.SAVE_END && env.SAVE_TO) {
    mkdirSync(dirname(env.SAVE_TO), { recursive: true });
    writeFileSync(env.SAVE_TO, JSON.stringify({ profile: p, hours, run: logs.length ? logs[logs.length - 1].run : resume ? resume.run : 0, pulls, realRuns, ladder, finalCleared, milestones: Object.fromEntries(reached) }));
  }

  if (!quiet) {
    // ---- curves
    console.log("\ncurves (every %d runs):", every);
    console.log(`  ${pad("run", 5)}${pad("hours", 8)}${pad("stage", 16)}${pad("hero Lv", 12)}${pad("result", 8)}${pad("time", 7)}${pad("heat", 5)}${pad("coins+", 8)}${pad("gems+", 7)}${pad("board", 7)}${pad("spent", 10)}${pad("pulls", 7)}${pad("might", 7)}hp`);
    for (const l of logs) {
      if (l.run % every !== 0 && l.run !== 1 && l.run !== logs.length) continue;
      console.log(
        `  ${pad(l.run, 5)}${pad(l.h.toFixed(2), 8)}${pad(l.stage, 16)}${pad(`${l.hero} ${l.lv}`, 12)}${pad(l.out, 8)}${pad(fmtT(l.t), 7)}${pad(l.heat, 5)}${pad(l.coins, 8)}${pad(l.gems, 7)}${pad(l.ranks, 7)}${pad(l.board, 10)}${pad(l.pulls, 7)}${pad(l.might.toFixed(2), 7)}${l.hp}`,
      );
    }
    // ---- milestones
    console.log("\nmilestones (EXPANSION §2):");
    for (const m of MILESTONES) {
      const r = reached.get(m.id);
      console.log(`  ${pad(m.label, 34)} ${pad(r ? `run ${r.run}, ${fmtH(r.hours)}` : "not reached", 22)} target ${m.target}`);
    }
    console.log("\nsnapshots:");
    for (const sn of snaps) console.log(`  ${pad(fmtH(sn.h), 9)} run ${lpad(sn.run, 4)} board ${lpad(sn.board, 9)} (${sn.ranks}) ${sn.hero} Lv${sn.lv} C${sn.constellation} mastery ${sn.sig}/${sn.best}/${sn.med} relics ${sn.relics.join(" ") || "-"} (${sn.slots} slots, ${sn.owned} owned) pulls ${sn.pulls} clears ${sn.clears.join("/")} heat ${sn.heat}`);
    const L = p.lifetime;
    console.log(
      `\ntotals: ${logs.length} runs (${realRuns} simulated), ${fmtH(hours)}, ${L.clears} clears, ${L.kills.toLocaleString()} kills, coins earned ${L.coinsEarned.toLocaleString()} (board spent ${boardProgress(p).spent.toLocaleString()}), gems earned ${L.gemsEarned.toLocaleString()}, pulls ${p.gacha.stats.pulls}, relics ${Object.keys(p.relics).length}, heroes ${p.unlocks.heroes.join(" ")}`,
    );
    const talent = p.unlocks.heroes.map((h) => `${h} ${p.heroes[h]?.level ?? 1}/${talentPoints(p.heroes[h]).spent}`).join(", ");
    console.log(`heroes (Lv / talent points spent): ${talent}`);
    const tot = logs.reduce((a, l) => a + l.ms, 0);
    console.log(`sim cost: ${(tot / 1000 / Math.max(1, realRuns)).toFixed(2)} s per simulated run, ${((Date.now() - t0) / 1000).toFixed(1)} s total`);
  }
  undoPatch();
  if (env.OUT) {
    mkdirSync(dirname(env.OUT), { recursive: true });
    const masteryOut = Object.fromEntries(Object.entries(p.mastery).map(([k, v]) => [k, masteryRank(v)]));
    const heroesOut = Object.fromEntries(Object.entries(p.heroes).map(([k, v]) => [k, { lv: v.level, c: v.constellation, runs: v.runs }]));
    writeFileSync(
      env.OUT,
      JSON.stringify({ bot: botKind, seed, stride, hours, runs: logs.length, realRuns, logs, milestones: Object.fromEntries(reached), unlockAt, snaps, mastery: masteryOut, heroes: heroesOut, relics: p.relics, pulls: p.gacha.stats, wallClock: (Date.now() - t0) / 1000 }),
    );
    if (!quiet) console.log(`wrote ${env.OUT}`);
  }
}, 36_000_000);

/** The cheapest board node that can be bought right now ignoring coins (null: nothing open). */
function affordableCheapest(p: Profile, ctx: MetaContent): number | null {
  const save = p.currencies.coins;
  p.currencies.coins = Number.MAX_SAFE_INTEGER;
  const n = affordableNodes(p, ctx);
  p.currencies.coins = save;
  return n.length ? n[0].cost : null;
}

/** The unlocked hero with the least XP that is below max level (null: all maxed). */
function lowestHero(p: Profile, ctx: MetaContent): string | null {
  const hs = p.unlocks.heroes.filter((h) => ctx.heroById.has(h) && (p.heroes[h]?.level ?? 1) < TUNING.hero.maxLevel);
  hs.sort((a, b) => (p.heroes[a]?.xp ?? 0) - (p.heroes[b]?.xp ?? 0) || (a < b ? -1 : 1));
  return hs[0] ?? null;
}
