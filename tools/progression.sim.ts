/**
 * Headless progression simulator (docs/EXPANSION.md §13): plays many
 * consecutive runs with one account, exactly like a player would:
 *
 *   buildRunConfig(profile) -> new World({ hero, run }) + bot (src/debug/bot simulate)
 *     -> applyRunToProfile (auto-claiming Plot Points) -> spending policy
 *        (board nodes by value / cost, talents, 10-pulls, spark, Copium, relic equip)
 *
 * and reports hours (and runs) to each milestone of EXPANSION §2 plus income /
 * spend and power curves. Not part of `npm test`.
 *
 *   npm run progression                         # mid bot, 40 runs
 *   BOT=weak|mid|strong RUNS=200 HOURS=12 SEED=3 npm run progression
 *   EVERY=10 (curve row every N runs)  OVERHEAD=45 (menu seconds per run)  DT=0.0333  MAXE=250
 *   OUT=shots/progression/mid.json (write the full log as JSON)   LINES=1 (print every payout line)
 *
 * Bots: weak = random level-up picks, never dashes (the balance probe's
 * "lazy" weak-player proxy); mid = the autoplay bot (average player); strong =
 * the autoplay bot with faster reactions and less slop.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { test } from "vitest";
import { Rng } from "../src/core/rng";
import { Bot, simulate } from "../src/debug/bot";
import type { Stats } from "../src/game/stats";
import { baseStats } from "../src/game/stats";
import { World } from "../src/game/world";
import { claimAllAchievements, evaluateAchievements } from "../src/meta/achievements/engine";
import { autoPath, boardProgress, buyNode, toggleKeystone } from "../src/meta/board/board";
import { BOARD } from "../src/meta/board/graph";
import type { BoardNode, NodeEffect } from "../src/meta/board/types";
import { gameContent, type MetaContent } from "../src/meta/content";
import { masteryRank } from "../src/meta/economy";
import { bannerView } from "../src/meta/gacha/banners";
import { claimSpark, pull, sparkChoices } from "../src/meta/gacha/engine";
import { buyOffer, exchangeCatalogue } from "../src/meta/gacha/exchange";
import { allocateTalent, canAllocate, talentPoints } from "../src/meta/heroes";
import { buildRunConfig, relicSlots, type LoadoutChoice } from "../src/meta/loadout";
import { defaultProfile, type Profile } from "../src/meta/profile";
import { reconcileProfile } from "../src/meta/reconcile";
import { applyRunToProfile, type RunReport } from "../src/meta/rewards";
import { ROSTER } from "../src/meta/roster";
import { TUNING } from "../src/meta/tuning";

// ---------------------------------------------------------------- spending policy

/** Rough "power per unit" of each effect (the policy only needs a sensible order). */
const STAT_VALUE: Partial<Record<keyof Stats, number>> = {
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
const FLAG_VALUE: Record<string, number> = { banish: 3, skip: 2, dashCharges: 8, ultStart: 20, chestLuck: 20, eliteRate: 8, plotArmor: 25, friendship: 500, revives: 20, freeRerolls: 30 };

function effectValue(e: NodeEffect): number {
  switch (e.t) {
    case "stat":
      return (STAT_VALUE[e.stat] ?? 5) * e.per;
    case "statPct":
      return (e.stat === "maxHp" ? 60 : 30) * e.per;
    case "flag":
      return (FLAG_VALUE[e.flag] ?? 5) * e.per;
    case "slot":
      return e.slot === "weapon" ? 25 : e.slot === "relic" ? 20 : 15;
    case "startLevel":
      return 5 * e.per;
    case "startWeapon":
      return 10;
  }
}

/** Board value of one more rank of a node (keystones: their absolute value + a bonus for being build-defining). */
function nodeValue(n: BoardNode): number {
  const v = n.effects.reduce((a, e) => a + Math.abs(effectValue(e)) * (effectValue(e) < 0 ? -0.6 : 1), 0);
  return n.kind === "keystone" ? Math.max(5, v) + 10 : Math.max(0.5, v);
}

function spendBoard(p: Profile, ctx: MetaContent): number {
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

function spendTalents(p: Profile, hero: string, ctx: MetaContent): void {
  const tree = ctx.talents.get(hero);
  const hp = p.heroes[hero];
  if (!tree || !hp) return;
  // commit to the branch that already has the most points (ties: branch 0), lowest tier first
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

function spendGacha(p: Profile, rng: Rng, ctx: MetaContent): number {
  let pulls = 0;
  while (p.currencies.gems >= TUNING.gacha.tenPullCost) {
    const banner = bannerView(p, "hero", ctx).available ? "hero" : bannerView(p, "relic", ctx).available ? "relic" : "permanent";
    const o = pull(p, banner, 10, rng, ctx);
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

const RARITY_RANK: Record<string, number> = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4, LR: 5, MYTHIC: 6 };

/** The loadout a player would pick: the furthest unlocked stage, the main hero, the best relics. */
function chooseLoadout(p: Profile, ctx: MetaContent): LoadoutChoice {
  const stages = ctx.stages.filter((s) => p.unlocks.stages.includes(s.id));
  const stage = stages[stages.length - 1]?.id ?? ctx.stages[0].id;
  const heroes = p.unlocks.heroes.filter((h) => ctx.heroById.has(h));
  const hero = heroes.sort((a, b) => (p.heroes[b]?.xp ?? 0) - (p.heroes[a]?.xp ?? 0) || (p.heroes[b]?.constellation ?? 0) - (p.heroes[a]?.constellation ?? 0))[0] ?? "hoshi";
  const relics = Object.keys(p.relics)
    .filter((id) => ctx.relics.has(id))
    .sort((a, b) => RARITY_RANK[ctx.relics.get(b)!.rarity] - RARITY_RANK[ctx.relics.get(a)!.rarity] || p.relics[b] - p.relics[a] || (a < b ? -1 : 1))
    .slice(0, relicSlots(p));
  return { stage, hero, relics, twists: {}, endless: false };
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

const MILESTONES: Milestone[] = [
  { id: "king_puff", label: "First King Puff kill", target: "runs 3-6 (0.5-1 h)", test: (p) => (p.lifetime.bossKills.king_puff ?? 0) > 0 },
  { id: "clear1", label: "Dream Meadow clear", target: "1.5-3 h", test: stageCleared(1) },
  { id: "clear2", label: "Candy Kingdom clear", target: "4-7 h", test: stageCleared(2) },
  { id: "clear3", label: "Shoujo Academy clear", target: "8-14 h", test: stageCleared(3) },
  { id: "clear4", label: "Beach Episode clear", target: "15-25 h", test: stageCleared(4) },
  { id: "clear5", label: "Final Arc clear", target: "30-45 h", test: stageCleared(5) },
  { id: "ring1", label: "Board ring 1 complete", target: "-", test: (p) => BOARD.nodes.filter((n) => n.ring === 1).every((n) => (p.board.ranks[n.id] ?? 0) >= n.maxRank) },
  { id: "first10", label: "First 10-pull", target: "-", test: (p) => p.gacha.stats.tenPulls > 0 },
  { id: "firstSSR", label: "First SSR+ pull", target: "-", test: (p) => p.gacha.stats.byRarity.SSR + p.gacha.stats.byRarity.UR + p.gacha.stats.byRarity.LR + p.gacha.stats.byRarity.MYTHIC > 0 },
  { id: "heroes", label: "All gameplay heroes unlocked", target: "40-60 h", test: (p) => ROSTER.filter((r) => r.source === "start" || r.source === "play").every((r) => p.unlocks.heroes.includes(r.id)) },
  { id: "mastery10", label: "A weapon at mastery 10", target: "-", test: (p) => Object.values(p.mastery).some((xp) => masteryRank(xp) >= 10) },
  { id: "board", label: "Board fully bought", target: "100-150 h", test: (p) => boardProgress(p).ranks >= boardProgress(p).totalRanks },
];

// ---------------------------------------------------------------- the loop

interface RunLog {
  run: number;
  hours: number;
  stage: string;
  hero: string;
  heroLevel: number;
  outcome: RunReport["outcome"];
  time: number;
  kills: number;
  coins: number;
  gems: number;
  boardRanks: number;
  boardSpent: number;
  pulls: number;
  might: number;
  maxHp: number;
  ms: number;
}

const fmtH = (h: number) => `${h.toFixed(2)} h`;
const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);

function makeBot(kind: string, seed: number): Bot {
  const b = new Bot(seed);
  if (kind === "weak") {
    b.noDash = true;
    b.randomPicks = true;
  } else if (kind === "strong") {
    b.sloppiness = 0.05;
    b.reaction = 0.12;
  }
  return b;
}

test("progression simulator", () => {
  const ctx = gameContent();
  const botKind = process.env.BOT ?? "mid";
  const maxRuns = Number(process.env.RUNS ?? 40);
  const maxHours = Number(process.env.HOURS ?? 1e9);
  const seed = Number(process.env.SEED ?? 1);
  const every = Number(process.env.EVERY ?? 5);
  const overhead = Number(process.env.OVERHEAD ?? 45);
  const dt = Number(process.env.DT ?? 1 / 30);
  const maxE = Number(process.env.MAXE ?? 250);
  const rng = new Rng(seed * 7919);

  const p = defaultProfile(0);
  reconcileProfile(p, ctx);
  const reached = new Map<string, { run: number; hours: number }>();
  const logs: RunLog[] = [];
  let hours = 0;
  let pulls = 0;
  const t0 = Date.now();
  console.log(`progression: bot=${botKind} runs<=${maxRuns} hours<=${maxHours} seed=${seed} dt=${dt.toFixed(4)} overhead=${overhead}s maxEnemies=${maxE}`);
  console.log(`content: ${ctx.heroes.length} heroes, ${ctx.baseWeapons.length} weapons, ${ctx.stages.length} stages, ${ctx.relics.size} relics, ${ctx.talents.size} talent trees, ${ctx.twists.size} twists; board ${BOARD.nodes.length - 1} nodes, ${boardProgress(p).totalCost.toLocaleString()} coins total`);

  for (let run = 1; run <= maxRuns && hours < maxHours; run++) {
    const choice = chooseLoadout(p, ctx);
    const plan = buildRunConfig(p, choice, ctx);
    const stage = ctx.stageById.get(plan.config.stage)!;
    const s = baseStats();
    for (const m of plan.config.mods) m(s);
    const ms0 = Date.now();
    const w = new World({ hero: plan.hero, seed: seed * 100003 + run, run: plan.config, maxEnemies: maxE });
    simulate(w, stage.duration + 120, dt, makeBot(botKind, seed * 31 + run));
    const ms = Date.now() - ms0;
    const report = applyRunToProfile(p, w.summary(), ctx, { autoClaim: true });
    hours += (report.time + overhead) / 3600;

    // spending
    spendBoard(p, ctx);
    for (const h of p.unlocks.heroes) spendTalents(p, h, ctx);
    pulls += spendGacha(p, rng, ctx);
    evaluateAchievements(p, null, ctx);
    claimAllAchievements(p);
    spendBoard(p, ctx);

    const bp = boardProgress(p);
    logs.push({
      run,
      hours,
      stage: stage.id,
      hero: plan.hero,
      heroLevel: p.heroes[plan.hero]?.level ?? 1,
      outcome: report.outcome,
      time: report.time,
      kills: report.kills,
      coins: report.coins.total,
      gems: report.gems.total + report.claimed.gems,
      boardRanks: bp.ranks,
      boardSpent: bp.spent,
      pulls,
      might: s.might,
      maxHp: Math.round(s.maxHp),
      ms,
    });
    for (const m of MILESTONES) if (!reached.has(m.id) && m.test(p, ctx)) reached.set(m.id, { run, hours });
    if (process.env.LINES) {
      const show = (part: RunReport["coins"]) => part.lines.map((x) => `${x.label}${x.mul ? ` x${x.mul}` : ""} ${x.amount}`).join(" | ");
      console.log(`  coins: ${show(report.coins)}\n  gems:  ${show(report.gems)}${report.claimed.gems ? ` | Plot Points ${report.claimed.gems}` : ""}`);
    }
    if (process.env.VERBOSE) {
      const l = logs[logs.length - 1];
      console.log(`  #${lpad(run, 3)} ${fmtH(hours)} ${pad(l.stage, 15)} ${pad(l.hero, 8)} Lv${lpad(l.heroLevel, 2)} ${pad(l.outcome, 5)} ${fmtT(l.time)} k${lpad(l.kills, 5)} +${lpad(l.coins, 5)}c +${lpad(l.gems, 4)}g board ${l.boardRanks}/${bp.totalRanks} might ${l.might.toFixed(2)} hp ${l.maxHp} (${ms} ms)`);
    }
  }

  // ---- curves
  console.log("\ncurves (every %d runs):", every);
  console.log(`  ${pad("run", 5)}${pad("hours", 8)}${pad("stage", 16)}${pad("hero Lv", 9)}${pad("result", 8)}${pad("time", 7)}${pad("coins+", 8)}${pad("gems+", 7)}${pad("board", 11)}${pad("spent", 10)}${pad("pulls", 7)}${pad("might", 7)}hp`);
  for (const l of logs) {
    if (l.run % every !== 0 && l.run !== 1 && l.run !== logs.length) continue;
    console.log(
      `  ${pad(l.run, 5)}${pad(l.hours.toFixed(2), 8)}${pad(l.stage, 16)}${pad(`${l.hero} ${l.heroLevel}`, 9)}${pad(l.outcome, 8)}${pad(fmtT(l.time), 7)}${pad(l.coins, 8)}${pad(l.gems, 7)}${pad(`${l.boardRanks}`, 11)}${pad(l.boardSpent, 10)}${pad(l.pulls, 7)}${pad(l.might.toFixed(2), 7)}${l.maxHp}`,
    );
  }

  // ---- milestones
  console.log("\nmilestones (EXPANSION §2):");
  for (const m of MILESTONES) {
    const r = reached.get(m.id);
    console.log(`  ${pad(m.label, 32)} ${pad(r ? `run ${r.run}, ${fmtH(r.hours)}` : "not reached", 22)} target ${m.target}`);
  }
  const L = p.lifetime;
  console.log(
    `\ntotals: ${logs.length} runs, ${fmtH(hours)}, ${L.clears} clears, ${L.kills.toLocaleString()} kills, coins earned ${L.coinsEarned.toLocaleString()} (board spent ${boardProgress(p).spent.toLocaleString()}), gems earned ${L.gemsEarned.toLocaleString()}, pulls ${p.gacha.stats.pulls}, relics ${Object.keys(p.relics).length}, heroes ${p.unlocks.heroes.join(" ")}`,
  );
  const avgMs = logs.reduce((a, l) => a + l.ms, 0) / Math.max(1, logs.length);
  console.log(`sim cost: ${(avgMs / 1000).toFixed(2)} s per run, ${((Date.now() - t0) / 1000).toFixed(1)} s total`);
  if (process.env.OUT) {
    mkdirSync(dirname(process.env.OUT), { recursive: true });
    writeFileSync(process.env.OUT, JSON.stringify({ bot: botKind, seed, logs, milestones: Object.fromEntries(reached), profile: p }, null, 1));
    console.log(`wrote ${process.env.OUT}`);
  }
}, 7_200_000);
