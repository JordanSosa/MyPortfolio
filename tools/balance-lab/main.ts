/**
 * `npm run balance:lab` (tools/balance-lab/lab.mjs -> here): balance answers in about a minute.
 *
 *   npm run balance:lab                                   model of every checkpoint x stage + short real-sim samples + report
 *   npm run balance:lab -- --set "stage.final_arc.scaling.hp*=1.2"     what-if (in-process, never edits files): before / after
 *   npm run balance:lab -- --set "boss.*.hp*=0.9" --set "weapon.star_shot.dmg*=1.2"
 *   npm run balance:lab -- --model-only                  the analytic model alone (seconds; the build table still comes from the cache)
 *   npm run balance:lab -- --full P5:final,P6:final --seeds 1-4     real full runs for some cells too (the matrix's ground truth)
 *   npm run balance:lab -- --calibrate                   refit the model's player constants on the reference runs (calibration.json)
 *   npm run balance:lab -- --validate                    the model's error against the measured matrices in tools/results
 *   --cp P2,P3 --stages dm,candy --heroes hoshi,rin,kuro --seeds 1,2 --bot mid --workers 4 --fresh (ignore the cache)
 *   --prog-hours 2 --prog-seeds 1,2 (progression sample; --no-prog skips it) --no-sim (model + cached build data only)
 *   --out <dir> (default shots/balance-lab/<name>) --name <name> --json (print the JSON summary to stdout)
 *   --job '<json>' (run one job in-process and print its result: debugging / agents)  --batch jobs.json --out res.json
 *   --trace P6:final:hoshi (the model's state every 30 s for one cell)  --refcheck (model vs the cached reference runs, per cell)
 *
 * Output: <out>/report.html (self-contained, inline SVG), report.json, report.md; the paths are printed.
 * Cache: node_modules/.cache/balance-lab (keyed by what each job depends on; see deps.ts).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cpus } from "node:os";
import { stageScaling } from "../../src/game/config";
import { STAGES } from "../../src/game/registry";
import { CHECKPOINTS } from "../checkpoints";
import { ROOT, sha } from "./cache";
import { compareAll, errorSummary, lossOf, fitNoise, fitTheta, loadCalibration, refJobs, saveCalibration, REF_CELLS, type Calibration } from "./calibrate";
import { execJobs, makeExec, type Done, type Exec } from "./exec";
import { runJob, type BossRec, type CensusResult, type GaugeResult, type Job, type PathResult, type RunRec, type SliceRec } from "./jobs";
import {
  belowCp,
  bossJobs,
  buildCurves,
  cellInputs,
  setRealLevels,
  censusJobs,
  setCensus,
  clearModelCaches,
  corrections,
  corrJobs,
  CP_IDS,
  intendedOf,
  pathJobs,
  predict,
  progressionJobs,
  sampleCp,
  SHORT_STAGE,
  sliceJobs,
  STAGE_IDS,
  weaponTable,
  weaponTableJobs,
  windowJobs,
  type BuildCurve,
  type Corrections,
  type LabOpts,
} from "./plan";
import { med, runModel, stageModel, survivalAt, type CellPrediction, type Theta, type WeaponTable } from "./model";
import { applyOverrides, parseOverride, relevant, type Override } from "./overrides";
import { closePool } from "./pool";
import { rangedIds, stageIds } from "./deps";
import { buildReport, type LabData } from "./report";
import { validateMatrices } from "./validate";

function args(argv: string[]) {
  const get = (k: string) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
  };
  const has = (k: string) => argv.includes(`--${k}`);
  const list = (k: string) => get(k)?.split(",").filter(Boolean);
  const nums = (v: string | undefined, d: number[]) => {
    if (!v) return d;
    const out: number[] = [];
    for (const part of v.split(",")) {
      const m = part.match(/^(\d+)-(\d+)$/);
      if (m) for (let s = +m[1]; s <= +m[2]; s++) out.push(s);
      else if (part) out.push(+part);
    }
    return out;
  };
  const sets = argv.flatMap((a, i) => (a === "--set" ? [argv[i + 1]] : []));
  return { get, has, list, nums, sets };
}

const stageId = (s: string) => SHORT_STAGE[s] ?? s;

function help(): void {
  const src = readFileSync(join(ROOT, "tools/balance-lab/main.ts"), "utf8");
  const m = src.match(/\/\*\*([\s\S]*?)\*\//);
  console.log((m?.[1] ?? "").replace(/^ \* ?/gm, ""));
}

export interface Prepared {
  table: WeaponTable;
  curves: BuildCurve[];
  paths: Done<PathResult>[];
  corrDone: Done<GaugeResult>[];
}

/** The model's build data: the weapon table, the bot's paths and their snapshot gauges (all cached jobs). */
async function prepare(ex: Exec, set: Override[], o: LabOpts): Promise<Prepared> {
  const wt = weaponTableJobs();
  const pj = pathJobs(o.cps, o.heroes, o.seeds, o.bot);
  const censusP = execJobs<CensusResult>(ex, censusJobs(STAGE_IDS), set, "census");
  const [wtDone, paths] = await Promise.all([execJobs<GaugeResult>(ex, wt.jobs, set, "weapon table"), Promise.resolve(null)]).then(async ([a]) => [a, await execJobs<PathResult>(ex, pj, set, "build paths")] as const);
  const table = weaponTable(wtDone);
  const cj = corrJobs(paths);
  const corrDone = await execJobs<GaugeResult>(ex, cj.jobs, set, "build gauges");
  const curves = buildCurves(paths, corrDone, cj.at, table);
  setCensus(await censusP);
  return { table, curves, paths, corrDone };
}

export interface Variant {
  label: string;
  set: Override[];
  prep: Prepared;
  pred: Record<string, CellPrediction>;
  hybrid: Record<string, CellPrediction>;
  corr: Corrections | null;
  windows: Done<RunRec>[];
  bosses: Done<BossRec>[];
  slices: Done<SliceRec>[];
  full: Done<RunRec>[];
  progression: Done<unknown>[];
  modelMs: number;
}

/**
 * Real early deaths bound the clear rate: when the sampled windows of a cell die before their end more (or less)
 * often than the model's draws, the clear share scales by the ratio of survivals (the model's deaths after it keep their shape).
 */
function withWindows(p: CellPrediction, windows: Done<RunRec>[], cp: string, st: string): CellPrediction {
  const ws = windows.filter((d) => d.result && d.job.kind === "window" && d.job.cp === cp && d.job.stage === st).map((d) => d.result as RunRec);
  if (!ws.length) return p;
  const t1 = Math.min(...ws.map((r) => (r.outcome === "death" ? Infinity : r.end)));
  const T = Number.isFinite(t1) ? t1 : 180;
  // (Laplace-smoothed: 6 runs that all die still leave the clear share a little room)
  const real = (ws.filter((r) => r.outcome !== "death").length + 0.5) / (ws.length + 1);
  const model = Math.max(0.02, survivalAt(p, T));
  const k = Math.min(1 / Math.max(1e-6, p.clear || 1e-6), real / model);
  return { ...p, clear: Math.max(0, Math.min(1, p.clear * k)) };
}

/** Can an override change a progression sample of `hours` from a fresh save (it reaches stage ~1 + hours / 2.5)? */
function progressionRelevant(x: Override, hours: number): boolean {
  const root = x.path[0];
  if (!["stage", "enemy", "boss"].includes(root)) return true;
  const reach = STAGE_IDS.slice(0, Math.min(STAGE_IDS.length, 1 + Math.ceil(hours / 2.5)));
  return reach.some((st) => relevant(x, st, stageIds(st)));
}

/** One lab pass (base or a what-if variant). */
async function runVariant(label: string, set: Override[], o: LabOpts, ex: Exec, th: Theta, full: Job[]): Promise<Variant> {
  const undo = applyOverrides(set);
  clearModelCaches();
  const tag = sha(set.map((x) => x.text));
  try {
    if (!ex.quiet) process.stderr.write(`[${label}]${set.length ? ` ${set.map((x) => x.text).join(" ")}` : ""}\n`);
    // phase A: build data + early windows + the progression sample (the long jobs start first, in parallel)
    // the progression sample (a few hours from a fresh save) only sees the first stages: a what-if on later content
    // reuses the base sample (the economy, global combat numbers and the early stages re-run it)
    const progSet = set.filter((x) => progressionRelevant(x, o.progression?.hours ?? 0));
    const progP = o.sim ? execJobs<unknown>(ex, progressionJobs(o), progSet, "progression") : Promise.resolve([]);
    const prep = await prepare(ex, set, o);
    const winP = o.sim ? execJobs<RunRec>(ex, windowJobs(o), set, "windows") : Promise.resolve([]);
    const fullP = full.length ? execJobs<RunRec>(ex, full, set, "full runs") : Promise.resolve([]);
    const t0 = performance.now();
    const pred: Record<string, CellPrediction> = {};
    for (const cp of o.cps) for (const st of o.stages) pred[`${cp}|${st}`] = predict(cp, st, o.heroes, prep.curves, th, tag);
    const modelMs = performance.now() - t0;
    const predOf = (cp: string, st: string) => pred[`${cp}|${st}`] ?? predict(cp, st, o.heroes, prep.curves, th, tag);
    // phase B: boss fights and slices from snapshots at the model's levels
    const bossP = o.sim ? execJobs<BossRec>(ex, bossJobs(o, predOf, tag), set, "boss fights") : Promise.resolve([]);
    const sliceP = o.sim ? execJobs<SliceRec>(ex, sliceJobs(o, predOf, tag), set, "slices") : Promise.resolve([]);
    const [windows, bosses, slices, fullDone, progression] = await Promise.all([winP, bossP, sliceP, fullP, progP]);
    let corr: Corrections | null = null;
    const hybrid: Record<string, CellPrediction> = {};
    if (bosses.length || slices.length) {
      corr = corrections(bosses, slices, prep.curves, th, tag);
      for (const cp of o.cps) for (const st of o.stages) hybrid[`${cp}|${st}`] = withWindows(predict(cp, st, o.heroes, prep.curves, th, tag, corr), windows, cp, st);
    }
    return { label, set, prep, pred, hybrid, corr, windows, bosses, slices, full: fullDone, progression, modelMs };
  } finally {
    undo();
    clearModelCaches();
  }
}

/** Stop the worker pool (lab.mjs calls it on exit). */
export function shutdown(): void {
  closePool();
}

export async function main(argv: string[], t0: number): Promise<number> {
  const a = args(argv);
  if (a.has("help") || a.has("h")) {
    help();
    return 0;
  }
  const sets = a.sets.map(parseOverride);
  const job = a.get("job");
  if (job) {
    const t1 = performance.now();
    const r = await runJob(JSON.parse(job) as Job, sets);
    console.log(JSON.stringify(r));
    console.error(`job ${(performance.now() - t1).toFixed(0)} ms (boot ${(t1 - t0).toFixed(0)} ms)`);
    return 0;
  }
  const workers = Number(a.get("workers") ?? Math.min(4, cpus().length));
  const ex = makeExec(workers, a.has("fresh"), a.has("quiet"));
  const batch = a.get("batch");
  if (batch) {
    const jobs = JSON.parse(readFileSync(batch, "utf8")) as Job[];
    const undo = applyOverrides(sets);
    const res = await execJobs(ex, jobs, sets, "batch");
    undo();
    writeFileSync(a.get("out") ?? "/dev/stdout", JSON.stringify(res));
    console.error(`batch ${jobs.length} jobs, ${ex.stats.hits} cached, cpu ${(ex.stats.cpuMs / 1000).toFixed(1)} s, wall ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    return 0;
  }

  const heroes = a.list("heroes") ?? ["hoshi", "rin", "kuro"];
  const seeds = a.nums(a.get("seeds"), [1, 2]);
  const bot = a.get("bot") ?? "mid";
  const cps = a.list("cp") ?? CP_IDS;
  const stages = (a.list("stages") ?? STAGE_IDS).map(stageId).filter((s) => STAGES.has(s));
  const sim = !a.has("no-sim") && !a.has("model-only");
  const windowCells: [string, string][] = [];
  for (const st of stages) {
    const cp = sampleCp(st);
    for (const c of [belowCp(cp), cp]) if (c && cps.includes(c) && !windowCells.some(([x, y]) => x === c && y === st)) windowCells.push([c, st]);
  }
  if (stages.includes("dream_meadow") && cps.includes("P0")) windowCells.unshift(["P0", "dream_meadow"]);
  const sampleCells = stages.map((st) => [sampleCp(st), st] as [string, string]).filter(([cp]) => cps.includes(cp));
  const o: LabOpts = {
    cps,
    stages,
    heroes,
    seeds,
    bot,
    windowCells,
    windowT: Number(a.get("window") ?? 180),
    bossCells: sampleCells,
    sliceCells: sampleCells,
    slicesPerStage: Number(a.get("slices") ?? 2),
    progression: a.has("no-prog") ? null : { seeds: a.nums(a.get("prog-seeds"), [1, 2]), hours: Number(a.get("prog-hours") ?? 2), bot },
    sim,
  };
  // --full P5:final,P6:final: real full runs of those cells (ground truth next to the model)
  const fullCells = (a.get("full") ?? "")
    .split(",")
    .filter(Boolean)
    .map((c) => {
      const [cp, st] = c.split(":");
      return [cp, stageId(st)] as [string, string];
    });
  const fullJobs: Job[] = refJobs(heroes, seeds, bot, fullCells);

  let cal: Calibration = loadCalibration();
  const trace = a.get("trace");
  if (trace) {
    // the model's internal state every 30 s for one cell / hero (model development; agents)
    const [cp, st, hero] = trace.split(":");
    const base = await prepare(ex, [], o);
    const inp = cellInputs(cp, stageId(st), [hero ?? "hoshi"], base.curves, sha([]), undefined, seeds[0])[0];
    const r = runModel(inp, cal.theta);
    console.log(`${cp} ${stageId(st)} ${hero ?? "hoshi"}: ${r.outcome} at ${r.end} s, bosses ${r.bosses.map((b) => `${b.id} ${Math.round(b.ttk)}${b.killed ? "" : " (alive)"}`).join(", ")}`);
    console.log("t | level | near far | enemy hp | inHp/s | dense dps | dps used | kills | hits/s | dmg | hp | adapt");
    for (const m of r.marks) console.log([m.t, m.level, `${m.near} ${m.far}`, m.hEff, Math.round(m.inHp), m.dense, Math.round(m.dps), m.kills, m.hits, m.dmg, Math.round(m.hp * 100) + "%", m.adapt].join(" | "));
    return 0;
  }
  if (a.has("refcheck")) {
    // model vs today's reference runs, per cell (model development / a quick sanity check)
    const base = await prepare(ex, [], o);
    const refs = await execJobs<RunRec>(ex, refJobs(heroes, seeds, bot, REF_CELLS), [], "reference runs");
    const tag = sha([]);
    const cs = compareAll(refs, base.curves, cal.theta, tag);
    const by = new Map<string, typeof cs>();
    for (const c of cs) {
      const k = `${c.cp} ${c.stage}`;
      by.set(k, [...(by.get(k) ?? []), c]);
    }
    const f = (x: number) => (Number.isFinite(x) ? String(Math.round(x)) : "-");
    const md = (xs: number[]) => med(xs.filter(Number.isFinite));
    console.log("cell                 | levels 1/2/3/5/10/15 min real ~ model | kills@3m | alive@3m | dmg@3m | end real ~ model | clear real ~ model ~ pred | bosses real ~ model");
    for (const [k, g] of by) {
      const p = predict(g[0].cp, g[0].stage, heroes, base.curves, cal.theta, tag);
      const ser = (side: "real" | "model", key: "lv" | "kills" | "alive" | "dmg", i?: number) => (i === undefined ? [0, 1, 2, 3, 4, 5].map((j) => f(md(g.map((c) => c[side][key][j])))).join("/") : f(md(g.map((c) => c[side][key][i]))));
      const cl = (side: "real" | "model") => `${Math.round((g.filter((c) => c[side].outcome === "clear").length / g.length) * 100)}%`;
      const ids = [...new Set(g.flatMap((c) => c.real.bosses.map((b) => b.id)))];
      const bs = ids.map((id) => `${id.slice(0, 6)} ${f(md(g.map((c) => c.real.bosses.find((b) => b.id === id)?.dur ?? NaN).filter((x) => x > 0)))}~${f(md(g.map((c) => c.model.bosses.find((b) => b.id === id)?.dur ?? NaN).filter((x) => x > 0)))}`).join(" ");
      console.log(`${k.padEnd(20)} | ${ser("real", "lv")} ~ ${ser("model", "lv")} | ${ser("real", "kills", 2)}~${ser("model", "kills", 2)} | ${ser("real", "alive", 2)}~${ser("model", "alive", 2)} | ${ser("real", "dmg", 2)}~${ser("model", "dmg", 2)} | ${f(md(g.map((c) => c.real.end)))}~${f(md(g.map((c) => c.model.end)))} | ${cl("real")}~${cl("model")}~${Math.round(p.clear * 100)}% | ${bs}`);
    }
    const e = errorSummary(cs);
    console.log(`loss ${lossOf(cs).toFixed(3)} median errors: levels ${(e.lv * 100).toFixed(0)} %, kills ${(e.kills * 100).toFixed(0)} %, end ${(e.end * 100).toFixed(0)} %, boss ${(e.boss * 100).toFixed(0)} %, outcome ${(e.outcome * 100).toFixed(0)} % (${e.n})`);
    for (const c of base.curves.filter((x) => x.seed === seeds[0])) console.log(`corr ${c.cp} ${c.hero}: ${c.corr.map((k) => `L${k.level} d${k.dense.toFixed(2)} b${k.boss.toFixed(2)} (${k.measured.dense}/${k.analytic.dense})`).join("  ")}`);
    return 0;
  }
  if (a.has("calibrate")) {
    const base = await prepare(ex, [], o);
    const refs = await execJobs<RunRec>(ex, refJobs(heroes, seeds, bot, REF_CELLS), [], "reference runs");
    const tag = sha([]);
    const t1 = performance.now();
    const fit = fitTheta(refs, base.curves, tag, cal.theta, Number(a.get("passes") ?? 5), (s) => process.stderr.write(`${s}\n`));
    const th = fitNoise(refs, base.curves, fit.theta, tag, heroes);
    cal = { theta: th, fitted: { date: new Date().toISOString(), runs: refs.filter((r) => r.result).length, loss: fit.loss, lossDefault: fit.loss0 } };
    saveCalibration(cal);
    const e = errorSummary(compareAll(refs, base.curves, th, tag));
    process.stderr.write(`calibrated in ${((performance.now() - t1) / 1000).toFixed(1)} s: loss ${fit.loss0.toFixed(3)} -> ${fit.loss.toFixed(3)}; median error levels ${(e.lv * 100).toFixed(0)} %, kills ${(e.kills * 100).toFixed(0)} %, end time ${(e.end * 100).toFixed(0)} %, boss TTK ${(e.boss * 100).toFixed(0)} %, outcome agreement ${(e.outcome * 100).toFixed(0)} % (${e.n} runs)\n`);
    process.stderr.write(`theta ${JSON.stringify(th)}\n`);
  }
  const th = cal.theta;

  // today's reference runs (cached only: --validate runs them) - the snapshots' real levels and the validation
  const refs = await execJobs<RunRec>(ex, refJobs(heroes, seeds, bot, REF_CELLS), [], "reference runs", !a.has("validate"));
  setRealLevels(refs);
  const base = await runVariant("base", [], { ...o, sim: o.sim && (!sets.length || !a.has("no-base")) }, ex, th, fullJobs);
  const variant = sets.length ? await runVariant("what-if", sets, o, ex, th, fullJobs) : null;

  // validation against the measured matrices (and the cached reference runs on today's data)
  let validation = null;
  if (a.has("validate") || !a.has("no-validate")) {
    validation = validateMatrices(base.prep.curves, th, heroes, refs, (s) => !ex.quiet && process.stderr.write(`${s}\n`), base.hybrid);
  }

  const wall = performance.now() - t0;
  const name = a.get("name") ?? (sets.length ? `whatif-${sha(sets.map((s) => s.text)).slice(0, 6)}` : "latest");
  const out = a.get("out") ?? join(ROOT, "shots/balance-lab", name);
  mkdirSync(out, { recursive: true });
  const data: LabData = {
    date: new Date().toISOString(),
    argv,
    opts: o,
    theta: th,
    calibration: cal.fitted,
    base,
    variant,
    validation,
    stats: { ...ex.stats, wallMs: wall, bootMs: 0, workers },
    checkpoints: CHECKPOINTS.map((c) => ({ id: c.id, hours: c.hours, label: c.label, intended: c.intended })),
    stageInfo: stages.map((id) => {
      const s = STAGES.get(id)!;
      return { id, name: s.name, duration: s.duration, intended: intendedOf(id) };
    }),
    stageModels: Object.fromEntries(stages.map((id) => [id, stageModel(id, { ...defaultScaling(id) }, undefined, 250, rangedIds())])),
  };
  const r = buildReport(data, out);
  console.log(`balance lab: ${r.summaryLine}`);
  console.log(`  report  ${r.html}`);
  console.log(`  json    ${r.json}`);
  console.log(`  summary ${r.md}`);
  if (a.has("json")) console.log(JSON.stringify(r.summary));
  return 0;
}

function defaultScaling(id: string) {
  return stageScaling(STAGES.get(id)!.scaling);
}
