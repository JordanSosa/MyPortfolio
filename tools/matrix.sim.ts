/**
 * Power-vs-stage matrix WORKER (driven by tools/matrix.mjs, not part of `npm test`):
 * plays the jobs of one shard - checkpoint x stage x hero x seed (x bot, x twists) -
 * with the checkpoint's real RunConfig (tools/checkpoints.ts -> buildRunConfig)
 * and writes one compact record per run to MATRIX_OUT.
 *
 *   MATRIX_JOBS=jobs.json MATRIX_OUT=out.json npx vitest run --config tools/matrix.vitest.config.ts
 *
 * A job: { cp, hero, stage, seed, bot?, twists?, dt?, maxE? }. A run ends at its
 * clear, its death (after any revives) or stage duration + 300 s ("timeout").
 */
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "vitest";
import { makeBot, simulate } from "../src/debug/bot";
import { stageDef } from "../src/game/registry";
import { finalBossAt } from "../src/game/stage";
import { World } from "../src/game/world";
import { gameContent } from "../src/meta/content";
import { CHECKPOINTS, checkpointRun, checkpointSummary } from "./checkpoints";
import { applyPatch, type Patch } from "./patch";

export interface MatrixJob {
  cp: string;
  hero: string;
  stage: string;
  seed: number;
  bot?: string;
  /** HEAT_SETS name or {id: rank}. */
  twists?: string | Record<string, number>;
  dt?: number;
  maxE?: number;
  /** Tuning variant name (its patch comes with the shard: MATRIX_VARIANTS). */
  variant?: string;
  /** Stop the run at this time (s): cheap early-game experiments (the outcome is then "timeout"). */
  tmax?: number;
}

export { applyPatch, type Patch };

export interface BossRec {
  id: string;
  /** Spawn time (s). */
  at: number;
  /** Fight length (s) when killed, else -1 (still alive at the end). */
  dur: number;
  /** Boss HP fraction left at the end when not killed. */
  left: number;
}

export interface MatrixRec {
  cp: string;
  hero: string;
  stage: string;
  seed: number;
  bot: string;
  twists: string;
  variant: string;
  heat: number;
  outcome: "clear" | "death" | "timeout" | "error";
  /** Run time at the end (s). */
  end: number;
  revives: number;
  level: number;
  kills: number;
  /** First level-up (s). */
  first: number;
  /** Median / longest gap between level-ups in 0:20-3:00, and the longest gap of the whole run outside boss fights (s). */
  gapEarly: number;
  gapEarlyMax: number;
  gapMax: number;
  /** When the longest gap ended (s). */
  gapMaxAt: number;
  /** Level at 1:00 / 2:00 / 3:00 / 5:00 / 10:00 (0 = dead by then). */
  lv: number[];
  /** HP fraction at 1:00 / 1:30 / 2:00 / 2:30 / 3:00 (0 = dead). */
  hp: number[];
  /** Damage taken per 30 s window over the first 5:00. */
  dmg30: number[];
  /** Kills per second per minute (first 10 minutes). */
  kps: number[];
  /** Mean alive enemies per minute (first 10 minutes). */
  alive: number[];
  bosses: BossRec[];
  evo1: number;
  evos: number;
  /** Final blow of a death. */
  killer: string;
  ms: number;
  /** MATRIX_STATS=1 (`--stats`): the run's RunStats (economy fitting: payout / hero XP / mastery offline). */
  stats?: unknown;
}

const median = (a: number[]): number => {
  const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length & 1 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export function playJob(job: MatrixJob): MatrixRec {
  const ctx = gameContent();
  const plan = checkpointRun(job.cp, { hero: job.hero, stage: job.stage, twists: job.twists }, ctx);
  const st = stageDef(plan.config.stage);
  const dt = job.dt ?? 1 / 30;
  const w = new World({ hero: plan.hero, seed: job.seed * 7717 + 13, run: plan.config, maxEnemies: job.maxE ?? 250 });
  const bot = makeBot(job.bot ?? "mid", job.seed * 31 + 7);
  const lvT: number[] = [];
  let lastLv = w.level;
  const bosses: BossRec[] = [];
  let cur: BossRec | null = null;
  let curE: { hp: number; maxHp: number } | null = null;
  w.bus.on("bossSpawn", (e) => {
    cur = { id: e.enemy.def.id, at: w.t, dur: -1, left: 1 };
    curE = e.enemy;
    bosses.push(cur);
  });
  w.bus.on("bossKilled", () => {
    if (cur && cur.dur < 0) cur.dur = w.t - cur.at;
    cur = null;
    curE = null;
  });
  let evo1 = -1;
  let evos = 0;
  w.bus.on("evolution", () => {
    evos++;
    if (evo1 < 0) evo1 = w.t;
  });
  let revives = 0;
  w.bus.on("playerRevived", () => revives++);
  let killer = "";
  w.bus.on("playerHurt", (e) => {
    if (w.player.hp > 0) return;
    // the final blow: an overlapping bullet, else the closest enemy
    const px = w.player.x;
    const py = w.player.y - 8;
    let best = 1e9;
    killer = "?";
    for (let i = 0; i < w.bullets.count; i++) {
      const b = w.bullets.items[i];
      const d = (b.x - px) ** 2 + (b.y - py) ** 2;
      if (d < 100 && d < best) {
        best = d;
        killer = `bullet:${b.sprite}`;
      }
    }
    if (killer === "?")
      for (let i = 0; i < w.enemies.count; i++) {
        const en = w.enemies.items[i];
        if (en.dead || en.def.prop) continue;
        const d = (en.x - px) ** 2 + (en.y - en.cy - py) ** 2 - en.r * en.r * 4;
        if (d < best) {
          best = d;
          killer = en.def.id + (en.elite ? "*" : "");
        }
      }
    void e;
  });
  const dmg30 = new Array(10).fill(0);
  w.bus.on("playerHurt", (e) => {
    const i = Math.floor(w.t / 30);
    if (i < dmg30.length) dmg30[i] += e.dmg;
  });
  const lvMarks = [60, 120, 180, 300, 600];
  const lv = lvMarks.map(() => 0);
  const hpMarks = [60, 90, 120, 150, 180];
  const hp = hpMarks.map(() => 0);
  const kps = new Array(10).fill(0);
  const aliveAcc = new Array(10).fill(0);
  const aliveN = new Array(10).fill(0);
  let lastKills = 0;
  let li = 0;
  let hi = 0;
  // (the final boss enrages at duration + 30 but the run goes on: give its fight room to end in a kill or a death)
  const T = Math.min(job.tmax ?? Infinity, st.duration + 300);
  const t0 = performance.now();
  simulate(w, T, dt, bot, (ww) => {
    if (ww.level !== lastLv) {
      for (let l = lastLv + 1; l <= ww.level; l++) lvT.push(ww.t);
      lastLv = ww.level;
    }
    while (li < lvMarks.length && ww.t >= lvMarks[li]) lv[li++] = ww.level;
    while (hi < hpMarks.length && ww.t >= hpMarks[hi]) hp[hi++] = ww.player.hp / ww.player.maxHp;
    const m = Math.floor(ww.t / 60);
    if (m < 10) {
      kps[m] += ww.kills - lastKills;
      aliveAcc[m] += ww.enemyCount;
      aliveN[m]++;
    }
    lastKills = ww.kills;
    if (cur && curE) cur.left = curE.hp / curE.maxHp;
  });
  const ms = performance.now() - t0;
  const end = w.t;
  // level-up gaps: early (0:20-3:00), and the longest one outside boss fights
  const gapsE: number[] = [];
  let gapMax = 0;
  let gapMaxAt = 0;
  const inBoss = (t: number) => bosses.some((b) => t >= b.at && t <= (b.dur >= 0 ? b.at + b.dur : end));
  const times = [0, ...lvT, end];
  for (let i = 1; i < times.length; i++) {
    const g = times[i] - times[i - 1];
    if (times[i] >= 20 && times[i] <= 180 && i < times.length - 1) gapsE.push(g);
    if (!inBoss(times[i]) && !inBoss(times[i - 1]) && g > gapMax) {
      gapMax = g;
      gapMaxAt = times[i];
    }
  }
  const heat = plan.heat;
  return {
    cp: job.cp,
    hero: job.hero,
    stage: job.stage,
    seed: job.seed,
    bot: job.bot ?? "mid",
    twists: typeof job.twists === "string" ? job.twists : job.twists ? Object.keys(job.twists).join("+") : "",
    variant: job.variant ?? "",
    heat,
    outcome: w.phase === "victory" || w.stageCleared ? "clear" : w.phase === "dead" ? "death" : "timeout",
    end: Math.round(end * 10) / 10,
    revives,
    level: w.level,
    kills: w.kills,
    first: lvT[0] ?? -1,
    gapEarly: Math.round(median(gapsE) * 10) / 10,
    gapEarlyMax: Math.round(Math.max(0, ...gapsE) * 10) / 10,
    gapMax: Math.round(gapMax * 10) / 10,
    gapMaxAt: Math.round(gapMaxAt),
    lv,
    hp: hp.map((x) => Math.round(x * 100) / 100),
    dmg30: dmg30.map((x) => Math.round(x)),
    kps: kps.map((k, i) => Math.round((k / 60) * 10) / 10).slice(0, Math.min(10, Math.ceil(end / 60))),
    alive: aliveAcc.map((a, i) => (aliveN[i] ? Math.round(a / aliveN[i]) : 0)).slice(0, Math.min(10, Math.ceil(end / 60))),
    bosses: bosses.map((b) => ({ id: b.id, at: Math.round(b.at), dur: Math.round(b.dur * 10) / 10, left: Math.round(b.left * 100) / 100 })),
    evo1: Math.round(evo1),
    evos,
    killer,
    ms: Math.round(ms),
    ...(process.env.MATRIX_STATS ? { stats: { ...w.summary().stats, killsByEnemy: { all: w.kills } } } : {}),
  };
}

/** Final boss arrival of a stage (for reports). */
export function stageFinalAt(id: string): number {
  return finalBossAt(stageDef(id));
}

test("matrix shard", () => {
  const jobsPath = process.env.MATRIX_JOBS;
  const out = process.env.MATRIX_OUT;
  if (!jobsPath || !out) {
    // no jobs: print what each checkpoint gives (node tools/matrix.mjs runs the shards)
    for (const cp of CHECKPOINTS) for (const h of (process.env.HEROES ?? "hoshi").split(",")) console.log(`${h} ${checkpointSummary(cp.id, h)}`);
    return;
  }
  const jobs: MatrixJob[] = JSON.parse(readFileSync(jobsPath, "utf8"));
  const variants: Record<string, Patch> = process.env.MATRIX_VARIANTS ? JSON.parse(readFileSync(process.env.MATRIX_VARIANTS, "utf8")) : {};
  const recs: MatrixRec[] = [];
  for (const j of jobs) {
    let r: MatrixRec;
    const undo = applyPatch(j.variant ? variants[j.variant] : undefined);
    try {
      r = playJob(j);
    } catch (err) {
      // a sim crash is a finding, not a reason to lose the shard
      console.error(`matrix: ${j.cp} ${j.stage} ${j.hero} s${j.seed} crashed:`, err);
      r = { ...j, bot: j.bot ?? "mid", twists: "", variant: j.variant ?? "", heat: 0, outcome: "error", end: 0, revives: 0, level: 0, kills: 0, first: -1, gapEarly: NaN, gapEarlyMax: NaN, gapMax: NaN, gapMaxAt: 0, lv: [], hp: [], dmg30: [], kps: [], alive: [], bosses: [], evo1: -1, evos: 0, killer: String(err).slice(0, 120), ms: 0 };
    }
    undo();
    recs.push(r);
    writeFileSync(out, JSON.stringify(recs));
    if (process.env.MATRIX_LOG)
      console.log(`${r.cp} ${r.stage} ${r.hero} s${r.seed} ${r.bot}${r.twists ? ` ${r.twists}` : ""}: ${r.outcome} @${r.end} L${r.level} ${r.bosses.map((b) => `${b.id}:${b.dur}`).join(" ")} (${r.ms} ms)`);
  }
}, 36_000_000);
