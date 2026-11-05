/**
 * Balance lab plan + assembly: which jobs a run needs (the weapon table, the bot's build paths,
 * snapshot gauges, early windows, boss fights and slices from snapshots, the progression
 * sample), and how their results become the analytic model's inputs (tools/balance-lab/model.ts).
 */
import { baseWeaponOf, BOSSES, WEAPONS, stageDef } from "../../src/game/registry";
import { finalBossAt, stageBosses } from "../../src/game/stage";
import { World } from "../../src/game/world";
import { CHECKPOINTS, checkpointRun } from "../checkpoints";
import { execJobs, type Done, type Exec } from "./exec";
import type { BossJob, BossRec, CensusJob, CensusResult, GaugeJob, GaugeResult, Job, PathJob, PathResult, ProgressionJob, RunRec, SliceJob, SliceRec, WindowJob } from "./jobs";
import { buildDps, childPoints, GAUGE_PERTURB, type ChildPoint, predictCell, runModel, stageModel, weaponGauge, type BuildPoint, type CellInput, type CellPrediction, type DifficultyLike, type ModelRun, type StageModel, type Theta, type WeaponTable } from "./model";
import { cpId, type Override } from "./overrides";
import { rangedIds } from "./deps";

export const STAGE_IDS = ["dream_meadow", "candy_kingdom", "shoujo_academy", "beach_episode", "final_arc"];
export const STAGE_SHORT: Record<string, string> = { dream_meadow: "dm", candy_kingdom: "candy", shoujo_academy: "academy", beach_episode: "beach", final_arc: "final" };
export const SHORT_STAGE: Record<string, string> = Object.fromEntries(Object.entries(STAGE_SHORT).map(([k, v]) => [v, k]));
export const CP_IDS = CHECKPOINTS.map((c) => c.id);

/** A stage's intended checkpoint(s) (tools/checkpoints.ts `intended`). */
export function intendedOf(stage: string): string[] {
  return CHECKPOINTS.filter((c) => c.intended.includes(stage)).map((c) => c.id);
}
/** The checkpoint the samples use for a stage (its last intended one). */
export function sampleCp(stage: string): string {
  const i = intendedOf(stage);
  return i[i.length - 1] ?? "P7";
}
/** The checkpoint one below. */
export function belowCp(cp: string): string | null {
  const order = ["P0", "P1", "P1b", "P2", "P3", "P4", "P5", "P6", "P7"];
  const i = order.indexOf(cp);
  return i > 0 ? order[i - 1] : null;
}

export interface LabOpts {
  cps: string[];
  stages: string[];
  heroes: string[];
  seeds: number[];
  bot: string;
  /** Sample cells (early windows): default each stage's sample checkpoint and the one below (+ P0 Dream Meadow). */
  windowCells: [string, string][];
  windowT: number;
  /** Boss / slice samples: cells. */
  bossCells: [string, string][];
  sliceCells: [string, string][];
  slicesPerStage: number;
  progression: { seeds: number[]; hours: number; bot: string } | null;
  sim: boolean;
}

// ---------------------------------------------------------------- the weapon table

const LEVELS = [1, 3, 5, 9];

export function weaponTableJobs(): { jobs: GaugeJob[]; ids: string[] } {
  const jobs: GaugeJob[] = [];
  const ids: string[] = [];
  for (const w of WEAPONS.values()) {
    ids.push(w.id);
    const lvs = w.evolved ? [1] : LEVELS;
    for (const lv of lvs) jobs.push({ kind: "gauge", hero: "hoshi", cp: null, weapons: [[w.id, lv]], T: 6 });
    const top = w.evolved ? 1 : 5;
    jobs.push({ kind: "gauge", hero: "hoshi", cp: null, weapons: [[w.id, top]], T: 6, stat: { cooldown: GAUGE_PERTURB.cooldown } });
    jobs.push({ kind: "gauge", hero: "hoshi", cp: null, weapons: [[w.id, top]], T: 6, stat: { area: GAUGE_PERTURB.area } });
    jobs.push({ kind: "gauge", hero: "hoshi", cp: null, weapons: [[w.id, top]], T: 6, stat: { amount: GAUGE_PERTURB.amount } });
  }
  return { jobs, ids };
}

export function weaponTable(done: Done<GaugeResult>[]): WeaponTable {
  const by = new Map<string, { levels: Record<number, GaugeResult>; cd?: GaugeResult; area?: GaugeResult; amount?: GaugeResult }>();
  for (const d of done) {
    if (!d.result || d.job.kind !== "gauge") continue;
    const [id, lv] = d.job.weapons[0];
    const e = by.get(id) ?? { levels: {} };
    by.set(id, e);
    const st = d.job.stat;
    if (!st) e.levels[lv] = d.result;
    else if (st.cooldown) e.cd = d.result;
    else if (st.area) e.area = d.result;
    else if (st.amount) e.amount = d.result;
  }
  const t: WeaponTable = {};
  for (const [id, e] of by) t[id] = weaponGauge(e.levels, e, id);
  return t;
}

// ---------------------------------------------------------------- build paths and their DPS

export const PATH_LEVELS = 200;
/** Horde gauge: enemy HPs and the alive count (BuildPoint.horde: the build's damage per second against each). */
export const HORDE_HP = [20, 200, 2000];
export const HORDE_ALIVE = 100;
export const CORR_LEVELS = [8, 25, 60, 120];

export function pathJobs(cps: string[], heroes: string[], seeds: number[], bot: string): PathJob[] {
  const out: PathJob[] = [];
  for (const cp of cps) for (const hero of heroes) for (const seed of seeds) out.push({ kind: "path", cp, hero, seed, bot, levels: PATH_LEVELS, chestEvery: 8 });
  return out;
}

/** Snapshot gauges of real builds (correction of the analytic DPS: relics, talents, passive behaviours). */
export function corrJobs(paths: Done<PathResult>[]): { jobs: GaugeJob[]; at: { cp: string; hero: string; level: number }[] } {
  const jobs: GaugeJob[] = [];
  const at: { cp: string; hero: string; level: number }[] = [];
  const seed0 = Math.min(...paths.map((x) => (x.job.kind === "path" ? x.job.seed : 1e9)));
  for (const p of paths) {
    if (!p.result || p.job.kind !== "path" || p.job.seed !== seed0) continue;
    for (const L of CORR_LEVELS) {
      const b = p.result.builds[L - 1];
      jobs.push({ kind: "gauge", hero: p.job.hero, cp: p.job.cp, weapons: b.weapons, passives: b.passives, T: 4, horde: { hp: HORDE_HP, alive: HORDE_ALIVE } });
      at.push({ cp: p.job.cp, hero: p.job.hero, level: L });
    }
  }
  return { jobs, at };
}

const baseOf = (id: string) => {
  const d = WEAPONS.get(id);
  return d ? baseWeaponOf(d).id : id;
};

export interface BuildCurve {
  cp: string;
  hero: string;
  seed: number;
  startLevel: number;
  points: BuildPoint[];
  /** Snapshot gauge / analytic at the correction levels (dense, boss, horde dps / analytic dense per HORDE_HP). */
  corr: { level: number; dense: number; boss: number; horde: number[]; analytic: { dense: number; boss: number }; measured: { dense: number; boss: number; horde: number[] } }[];
}

function interpCorr(corr: BuildCurve["corr"], L: number, get: (c: BuildCurve["corr"][number]) => number): number {
  if (!corr.length) return 1;
  if (L <= corr[0].level) return get(corr[0]);
  for (let i = 1; i < corr.length; i++)
    if (L <= corr[i].level) {
      const f = (L - corr[i - 1].level) / (corr[i].level - corr[i - 1].level);
      return Math.exp(Math.log(Math.max(1e-6, get(corr[i - 1]))) * (1 - f) + Math.log(Math.max(1e-6, get(corr[i]))) * f);
    }
  return get(corr[corr.length - 1]);
}

/** The model's build curves: the analytic DPS of every path level, scaled by the (cp, hero) snapshot gauges. */
export function buildCurves(paths: Done<PathResult>[], corrDone: Done<GaugeResult>[], corrAt: { cp: string; hero: string; level: number }[], table: WeaponTable): BuildCurve[] {
  const seed0 = Math.min(...paths.map((x) => (x.job.kind === "path" ? x.job.seed : 1e9)));
  const out: BuildCurve[] = [];
  const analytic = (r: PathResult, L: number) => {
    const b = r.builds[Math.min(r.builds.length, L) - 1];
    return buildDps(b.weapons, b.stats, table, r.weaponDamage, baseOf);
  };
  const corrOf = new Map<string, BuildCurve["corr"]>();
  for (const p of paths) {
    if (!p.result || p.job.kind !== "path" || p.job.seed !== seed0) continue;
    const corr: BuildCurve["corr"] = [];
    corrDone.forEach((c, i) => {
      const a0 = corrAt[i];
      if (!c.result || a0.cp !== (p.job as PathJob).cp || a0.hero !== (p.job as PathJob).hero) return;
      const a = analytic(p.result as PathResult, a0.level);
      const hd = (c.result.horde ?? []).map((h) => h.dps);
      const m = { dense: c.result.dense.dps, boss: c.result.boss.dps, horde: hd };
      corr.push({ level: a0.level, dense: clampK(m.dense / Math.max(1, a.dense)), boss: clampK(m.boss / Math.max(1, a.boss)), horde: hd.map((x) => Math.max(1e-4, x / Math.max(1, a.dense))), analytic: { dense: Math.round(a.dense), boss: Math.round(a.boss) }, measured: m });
    });
    corr.sort((x, y) => x.level - y.level);
    corrOf.set(`${p.job.cp}|${p.job.hero}`, corr);
  }
  for (const p of paths) {
    if (!p.result || p.job.kind !== "path") continue;
    const job = p.job;
    const r = p.result;
    const corr = corrOf.get(`${job.cp}|${job.hero}`) ?? [];
    const points: BuildPoint[] = r.builds.map((b, i) => {
      const a = buildDps(b.weapons, b.stats, table, r.weaponDamage, baseOf);
      const L = i + 1;
      const horde = HORDE_HP.map((hp, k) => ({ hp, dps: a.dense * interpCorr(corr, L, (x) => x.horde[k] ?? 0.05) }));
      return { level: L, dense: a.dense * interpCorr(corr, L, (x) => x.dense), hps: a.hps, boss: a.boss * interpCorr(corr, L, (x) => x.boss), horde, stats: b.stats, weapons: b.weapons };
    });
    out.push({ cp: job.cp, hero: job.hero, seed: job.seed, startLevel: r.startLevel, points, corr });
  }
  return out;
}

const clampK = (k: number) => Math.max(0.2, Math.min(5, Number.isFinite(k) ? k : 1));

// ---------------------------------------------------------------- cells

const probeCache = new Map<string, { diff: DifficultyLike; scaling: World["scaling"]; adaptMax: number }>();

/** Difficulty / toughness a cell's World really gets (twist installs, the stage's scaling). */
export function probeCell(cp: string, stage: string, hero: string, twists: string | Record<string, number> | undefined, tag: string): { diff: DifficultyLike; scaling: World["scaling"]; adaptMax: number } {
  const k = `${cp}|${stage}|${hero}|${JSON.stringify(twists ?? null)}|${tag}`;
  const hit = probeCache.get(k);
  if (hit) return hit;
  const plan = checkpointRun(cpId(cp), { hero, stage, twists });
  const w = new World({ hero: plan.hero, seed: 1, run: plan.config, director: false });
  const d = w.difficulty;
  const out = { diff: { enemyHp: d.enemyHp, bossHp: d.bossHp, enemyDmg: d.enemyDmg, spawn: d.spawn, cap: d.cap, elite: d.elite, eliteHp: d.eliteHp, bossWarning: d.bossWarning, levelHeal: d.levelHeal, food: d.food }, scaling: { ...w.scaling }, adaptMax: w.scaling.adaptMax };
  probeCache.set(k, out);
  return out;
}

const stageCache = new Map<string, StageModel>();
export function stageFor(stage: string, scaling: World["scaling"], diff: DifficultyLike, tag: string): StageModel {
  const k = `${stage}|${JSON.stringify(scaling)}|${JSON.stringify(diff)}|${tag}`;
  let s = stageCache.get(k);
  if (!s) {
    s = stageModel(stage, scaling, diff, 250, rangedIds());
    stageCache.set(k, s);
  }
  return s;
}

export function clearModelCaches(): void {
  probeCache.clear();
  stageCache.clear();
}

export function bossDmgTable(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of BOSSES.values()) out[b.id] = b.dmg;
  return out;
}

export interface Corrections {
  /** Per boss: TTK x and pressure x from the boss samples. */
  boss: Record<string, { ttk: number; hit: number; n: number }>;
  /** Per stage: hit-rate x from the slices. */
  stageHit: Record<string, { k: number; n: number }>;
}

/** Census jobs: child spawns per stage at a few run times (content calibration of the model). */
export function censusJobs(stages: string[]): CensusJob[] {
  return stages.map((stage) => {
    const def = stageDef(stage);
    const end = finalBossAt(def);
    const at = [30, 0.2, 0.4, 0.6, 0.8, 0.97].map((k) => (k < 1 ? Math.round(end * k) : k)).map((x, i) => (i === 0 ? 30 : x));
    return { kind: "census", stage, at, len: 20 };
  });
}

/** Children per stage (the model's CellInput.children), from census results. */
export const CHILDREN = new Map<string, ChildPoint[]>();
export function setCensus(done: Done<CensusResult>[]): void {
  CHILDREN.clear();
  for (const d of done) if (d.result && d.job.kind === "census") CHILDREN.set(d.job.stage, childPoints(d.result.points));
}

export function cellInputs(cp: string, stage: string, heroes: string[], curves: BuildCurve[], tag: string, corr?: Corrections, seed?: number, twists?: string | Record<string, number>): CellInput[] {
  const out: CellInput[] = [];
  const bd = bossDmgTable();
  for (const hero of heroes) {
    const cs = curves.filter((c) => c.cp === cp && c.hero === hero && (seed === undefined || c.seed === seed));
    for (const c of cs) {
      const pr = probeCell(cp, stage, hero, twists, tag);
      const sm = stageFor(stage, pr.scaling, pr.diff, tag);
      const bossK: CellInput["bossK"] = {};
      if (corr) for (const [id, k] of Object.entries(corr.boss)) bossK[id] = { ttk: k.ttk, hit: k.hit };
      out.push({ stage: sm, build: c.points, startLevel: c.startLevel, diff: pr.diff, adaptMax: pr.adaptMax, bossDmg: bd, bossK, hitK: corr?.stageHit[stage]?.k ?? 1, children: CHILDREN.get(stage) });
    }
  }
  return out;
}

export function predict(cp: string, stage: string, heroes: string[], curves: BuildCurve[], th: Theta, tag: string, corr?: Corrections, twists?: string | Record<string, number>): CellPrediction {
  return predictCell(cellInputs(cp, stage, heroes, curves, tag, corr, undefined, twists), th);
}

// ---------------------------------------------------------------- samples from the model's trajectory

/** Level / chests / adaptive toughness the model expects at time t (median over heroes / seeds). */
/**
 * Real levels over time per cell (cached full reference runs, see main.ts): the snapshots' level when known -
 * the model's late level curve lags real runs, and an under-levelled snapshot turns every boss into a wall.
 */
export const REAL_LEVELS = new Map<string, { t: number; level: number }[][]>();
export function setRealLevels(runs: Done<RunRec>[]): void {
  REAL_LEVELS.clear();
  for (const d of runs) {
    if (!d.result || d.job.kind !== "full") continue;
    const k = `${d.job.cp}|${d.job.stage}`;
    REAL_LEVELS.set(k, [...(REAL_LEVELS.get(k) ?? []), d.result.marks.map((m) => ({ t: m.t, level: m.level }))]);
  }
}

export function snapshotAt(runs: ModelRun[], t: number, stage: StageModel, cell?: string): { level: number; chests: number; golden: number; adapt: number; from: "real" | "model" } {
  const lv: number[] = [];
  const real = cell ? REAL_LEVELS.get(cell) : undefined;
  let from: "real" | "model" = "model";
  if (real?.length) {
    // the real runs still alive at t (a run that died earlier says nothing about the level at t)
    for (const ms of real) {
      const m = ms.filter((x) => x.t <= t);
      if (m.length && ms[ms.length - 1].t >= t - 60) lv.push(m[m.length - 1].level);
    }
    if (lv.length >= 2) from = "real";
    else lv.length = 0;
  }
  if (!lv.length)
    for (const r of runs) {
      const m = r.marks.filter((x) => x.t <= t);
      if (m.length) lv.push(m[m.length - 1].level);
    }
  lv.sort((a, b) => a - b);
  const level = lv.length ? lv[lv.length >> 1] : 1;
  const elites = stage.events.filter((e) => e.kind === "elite" && e.at < t).length;
  const golden = stage.events.filter((e) => e.kind === "boss" && e.at + 30 < t).length;
  return { level: Math.max(1, Math.round(level)), chests: elites, golden, adapt: 0, from };
}

export function windowJobs(o: LabOpts): WindowJob[] {
  const out: WindowJob[] = [];
  for (const [cp, stage] of o.windowCells) for (const hero of o.heroes) for (const seed of o.seeds) out.push({ kind: "window", cp, stage, hero, seed, bot: o.bot, t1: o.windowT });
  return out;
}

export function bossJobs(o: LabOpts, predOf: (cp: string, stage: string) => CellPrediction, tag: string): BossJob[] {
  const out: BossJob[] = [];
  for (const [cp, stage] of o.bossCells) {
    const pred = predOf(cp, stage);
    const pr = probeCell(cp, stage, o.heroes[0], undefined, tag);
    const sm = stageFor(stage, pr.scaling, pr.diff, tag);
    for (const boss of stageBosses(stageDef(stage))) {
      const ev = sm.events.find((e) => e.boss === boss);
      if (!ev) continue;
      const { from: _f, ...snap } = snapshotAt(pred.runs, ev.at, sm, `${cp}|${stage}`);
      // every seed: a boss fight swings with the build (one seed has two evolutions by 3:00, another none)
      for (const hero of o.heroes) for (const seed of o.seeds) out.push({ kind: "boss", cp, stage, hero, seed, bot: o.bot, boss, ...snap });
    }
  }
  return out;
}

export function sliceJobs(o: LabOpts, predOf: (cp: string, stage: string) => CellPrediction, tag: string): SliceJob[] {
  const out: SliceJob[] = [];
  for (const [cp, stage] of o.sliceCells) {
    const pred = predOf(cp, stage);
    const pr = probeCell(cp, stage, o.heroes[0], undefined, tag);
    const sm = stageFor(stage, pr.scaling, pr.diff, tag);
    const bossT = sm.events.filter((e) => e.kind === "boss").map((e) => e.at);
    for (let i = 0; i < o.slicesPerStage; i++) {
      let at = Math.round((sm.finalAt * (i + 0.6)) / (o.slicesPerStage + 0.2) / 10) * 10;
      // keep the slice clear of boss fights (a boss window has its own sample)
      for (let g = 0; g < 10 && bossT.some((b) => at + 60 > b && at < b + 60); g++) at += 30;
      if (at + 60 >= sm.finalAt) at = Math.max(60, sm.finalAt - 120);
      const { from: _f, ...snap } = snapshotAt(pred.runs, at, sm, `${cp}|${stage}`);
      for (const hero of o.heroes) out.push({ kind: "slice", cp, stage, hero, seed: o.seeds[0], bot: o.bot, at, len: 60, warm: 15, ...snap });
    }
  }
  return out;
}

/** Corrections from the boss samples and slices: measured vs the pure model at the same snapshot. */
export function corrections(bossDone: Done<BossRec>[], sliceDone: Done<SliceRec>[], curves: BuildCurve[], th: Theta, tag: string): Corrections {
  const boss: Corrections["boss"] = {};
  const by = new Map<string, { tr: number[]; tm: number[]; hr: number[]; hm: number[] }>();
  for (const d of bossDone) {
    if (!d.result || d.job.kind !== "boss" || !d.result.spawned) continue;
    const j = d.job;
    const c = curves.find((x) => x.cp === j.cp && x.hero === j.hero && x.seed === j.seed) ?? curves.find((x) => x.cp === j.cp && x.hero === j.hero);
    if (!c) continue;
    const pr = probeCell(j.cp, j.stage, j.hero, undefined, tag);
    const sm = stageFor(j.stage, pr.scaling, pr.diff, tag);
    const ev = sm.events.find((e) => e.boss === j.boss);
    if (!ev || !ev.bossHp) continue;
    const bp = c.points[Math.min(c.points.length, j.level) - 1];
    const modelTtk = ev.bossHp / Math.max(1, bp.boss * th.bossEff);
    // a fight the hero lost: the TTK it would have needed (HP fraction left extrapolated)
    const fightT = d.result.ttk >= 0 ? d.result.ttk : d.result.died > 0 && d.result.left < 0.98 ? d.result.died / (1 - d.result.left) : NaN;
    const e = by.get(j.boss) ?? { tr: [], tm: [], hr: [], hm: [] };
    by.set(j.boss, e);
    if (Number.isFinite(fightT)) {
      e.tr.push(fightT);
      e.tm.push(modelTtk);
    }
    const len = d.result.ttk >= 0 ? d.result.ttk : d.result.died >= 0 ? d.result.died : 360;
    e.hr.push(d.result.hits / Math.max(5, len));
    e.hm.push(th.hb);
  }
  const gm = (a: number[]) => (a.length ? Math.exp(a.reduce((s, x) => s + Math.log(Math.max(1e-3, x)), 0) / a.length) : NaN);
  for (const [id, e] of by) {
    const ttk = e.tr.length ? gm(e.tr) / gm(e.tm) : 1;
    // boss pressure: measured hits/s during the fight (crowd + boss) over the model's boss term; crowd hits are part of
    // the measurement, so only the excess over a quiet screen counts
    const hit = e.hr.length ? Math.max(0.2, Math.min(5, gm(e.hr.map((x) => x + 0.02)) / Math.max(0.02, th.hb))) : 1;
    boss[id] = { ttk: Math.max(0.3, Math.min(4, Number.isFinite(ttk) ? ttk : 1)), hit, n: e.tr.length };
  }
  const stageHit: Corrections["stageHit"] = {};
  const sb = new Map<string, { r: number[]; m: number[] }>();
  for (const d of sliceDone) {
    if (!d.result || d.job.kind !== "slice") continue;
    const j = d.job;
    const pr = probeCell(j.cp, j.stage, j.hero, undefined, tag);
    const sm = stageFor(j.stage, pr.scaling, pr.diff, tag);
    const P = sm.at(j.at + 30);
    const fill = Math.min(1.25, d.result.alive / Math.max(1, P.cap));
    const model = Math.min(2, th.h0 * Math.pow(fill, th.p));
    const len = d.result.died >= 0 ? Math.max(5, d.result.died) : j.len;
    const e = sb.get(j.stage) ?? { r: [], m: [] };
    sb.set(j.stage, e);
    e.r.push(d.result.hits / len + 0.01);
    e.m.push(model + 0.01);
  }
  for (const [st, e] of sb) stageHit[st] = { k: Math.max(0.25, Math.min(4, gm(e.r) / gm(e.m))), n: e.r.length };
  return { boss, stageHit };
}

export function progressionJobs(o: LabOpts): ProgressionJob[] {
  if (!o.progression) return [];
  return o.progression.seeds.map((seed) => ({ kind: "progression", bot: o.progression!.bot, seed, hours: o.progression!.hours }));
}

export async function runJobs<T>(ex: Exec, jobs: Job[], set: Override[], label: string): Promise<Done<T>[]> {
  return execJobs<T>(ex, jobs, set, label);
}

