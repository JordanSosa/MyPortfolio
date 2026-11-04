/**
 * The analytic model against MEASURED matrices (tools/results/matrix-*.json, full runs of the
 * real sim): for each set, the content is patched back to what it was when the set was measured
 * (the matrix's own variant patch, or the values the docs list as "was"), the model predicts each
 * cell, and the errors are reported. Today's reference runs (the lab's cached full runs, `--validate`)
 * are the clean check: same data, same code.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, sha } from "./cache";
import type { Done } from "./exec";
import type { RunRec } from "./jobs";
import { clearModelCaches, predict, type BuildCurve } from "./plan";
import { med, type CellPrediction, type Theta } from "./model";
import { applyOverrides, parseOverride, type Override } from "./overrides";

interface MatrixRun {
  cp: string;
  hero: string;
  stage: string;
  seed: number;
  variant: string;
  twists: string;
  bot: string;
  outcome: string;
  end: number;
  lv: number[];
  bosses: { id: string; dur: number }[];
}

export interface ValidationCell {
  cp: string;
  stage: string;
  n: number;
  real: { clear: number; death: number; bosses: Record<string, number>; lv: number[] };
  model: { clear: number; death: number; bosses: Record<string, number>; lv: number[] };
}

export interface ValidationSet {
  name: string;
  note: string;
  set: string[];
  cells: ValidationCell[];
  err: { clear: number; death: number; boss: number; lv: number; intendedClear: number; n: number };
}

export interface Validation {
  sets: ValidationSet[];
  ms: number;
}

/** Patch-style values (tools/patch.ts) -> lab overrides. */
function fromPatch(p: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (k.startsWith("_")) continue;
    out.push(`${k}=${JSON.stringify(v)}`);
  }
  return out;
}

/** The combat-curve pass's values (docs/ARCHITECTURE.md §6.3 "was" columns): the data matrix-after was measured on. */
const COMBAT_PASS = [
  'stage.dream_meadow.scaling={"hp":1,"pace":1}',
  'stage.candy_kingdom.scaling={"hp":1.3,"pace":0.85}',
  'stage.shoujo_academy.scaling={"hp":2.5,"pace":0.62}',
  'stage.beach_episode.scaling={"hp":5.5,"pace":0.55}',
  'stage.final_arc.scaling={"hp":1.8,"pace":0.6,"dmgPerMinute":0.13}',
  "boss.king_puff.hp=10000",
  "boss.nightmare_teddy.hp=45000",
  "boss.lady_lunatic.hp=58000",
  "boss.gingerbread_golem.hp=60000",
  "boss.sugar_plum_tyrant.hp=120000",
  "boss.council_president.hp=100000",
  "boss.bishounen.hp=180000",
  "boss.kraken_chan.hp=210000",
  "boss.firework_dragon.hp=330000",
  "boss.truck_kun_boss.hp=400000",
  "boss.rival_chan.hp=460000",
  "boss.cancel_sama.hp=1500000",
];

const LV_T = [60, 120, 180, 300, 600];

type Predictor = (cp: string, stage: string, heroes: string[]) => CellPrediction | undefined;

function cellsOf(runs: { cp: string; stage: string; outcome: string; end: number; lv: number[]; bosses: { id: string; dur: number }[] }[], heroes: string[], curves: BuildCurve[], th: Theta, tag: string, heroOf: (i: number) => string, pred?: Predictor): ValidationCell[] {
  const groups = new Map<string, number[]>();
  runs.forEach((r, i) => {
    if (!heroes.includes(heroOf(i))) return;
    const k = `${r.cp}|${r.stage}`;
    const g = groups.get(k) ?? [];
    groups.set(k, g);
    g.push(i);
  });
  const out: ValidationCell[] = [];
  for (const [k, idx] of groups) {
    const [cp, stage] = k.split("|");
    if (!curves.some((c) => c.cp === cp)) continue;
    const rs = idx.map((i) => runs[i]);
    const hs = [...new Set(idx.map(heroOf))].filter((h) => curves.some((c) => c.cp === cp && c.hero === h));
    if (!hs.length) continue;
    const p = pred?.(cp, stage, hs) ?? predict(cp, stage, hs, curves, th, tag);
    const rb: Record<string, number> = {};
    const mb: Record<string, number> = {};
    const ids = [...new Set(rs.flatMap((r) => r.bosses.map((b) => b.id)))];
    for (const id of ids) {
      rb[id] = med(rs.map((r) => r.bosses.find((b) => b.id === id)?.dur ?? NaN).filter((x) => x > 0));
      mb[id] = p.bosses.find((b) => b.id === id)?.ttk ?? NaN;
    }
    const lvReal = LV_T.map((_t, i) => med(rs.map((r) => r.lv[i]).filter((x) => x > 0)));
    const lvModel = LV_T.map((t) => med(p.runs.map((r) => r.marks.find((m) => m.t === t)?.level ?? NaN)));
    out.push({
      cp,
      stage,
      n: rs.length,
      real: { clear: rs.filter((r) => r.outcome === "clear").length / rs.length, death: med(rs.filter((r) => r.outcome !== "clear").map((r) => r.end)), bosses: rb, lv: lvReal },
      model: { clear: p.clear, death: p.deathMed, bosses: mb, lv: lvModel },
    });
  }
  return out;
}

function errOf(cells: ValidationCell[], intended: (cp: string, stage: string) => boolean): ValidationSet["err"] {
  const c: number[] = [];
  const d: number[] = [];
  const b: number[] = [];
  const l: number[] = [];
  const ic: number[] = [];
  for (const x of cells) {
    c.push(Math.abs(x.model.clear - x.real.clear));
    if (intended(x.cp, x.stage)) ic.push(Math.abs(x.model.clear - x.real.clear));
    if (Number.isFinite(x.real.death) && Number.isFinite(x.model.death)) d.push(Math.abs(x.model.death / x.real.death - 1));
    for (const id of Object.keys(x.real.bosses)) if (Number.isFinite(x.real.bosses[id]) && Number.isFinite(x.model.bosses[id])) b.push(Math.abs(x.model.bosses[id] / x.real.bosses[id] - 1));
    for (let i = 0; i < LV_T.length; i++) if (x.real.lv[i] > 0 && x.model.lv[i] > 0) l.push(Math.abs(x.model.lv[i] / x.real.lv[i] - 1));
  }
  const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  return { clear: mean(c), death: med(d), boss: med(b), lv: med(l), intendedClear: mean(ic), n: cells.length };
}

const INTENDED: Record<string, string[]> = { dream_meadow: ["P2"], candy_kingdom: ["P3"], shoujo_academy: ["P4"], beach_episode: ["P5"], final_arc: ["P5", "P6"] };
const isIntended = (cp: string, st: string) => INTENDED[st]?.includes(cp) ?? false;

function withSet<T>(set: string[], fn: (tag: string) => T): T {
  const os: Override[] = set.map(parseOverride);
  const undo = applyOverrides(os);
  clearModelCaches();
  try {
    return fn(sha(set));
  } finally {
    undo();
    clearModelCaches();
  }
}

export function validateMatrices(curves: BuildCurve[], th: Theta, heroes: string[], refs: Done<RunRec>[], log?: (s: string) => void, hybrid?: Record<string, CellPrediction>): Validation {
  const t0 = performance.now();
  const sets: ValidationSet[] = [];
  // today's data: the lab's own full reference runs (same code, same content)
  if (refs.some((r) => r.result)) {
    const runs = refs.filter((r) => r.result && r.job.kind === "full").map((r) => {
      const j = r.job as { cp: string; stage: string; hero: string };
      const x = r.result as RunRec;
      return { cp: j.cp, stage: j.stage, hero: j.hero, outcome: x.outcome === "clear" ? "clear" : "death", end: x.end, lv: LV_T.map((t) => (t <= x.end ? (x.marks.filter((m) => m.t <= t).pop()?.level ?? 0) : 0)), bosses: x.bosses };
    });
    const cells = withSet([], (tag) => cellsOf(runs, heroes, curves, th, tag, (i) => runs[i].hero));
    sets.push({ name: "today: model", note: `${runs.length} full mid-bot runs on the current code and content (the lab's cached reference runs: --validate)`, set: [], cells, err: errOf(cells, isIntended) });
    if (hybrid && Object.keys(hybrid).length) {
      const hc = withSet([], (tag) => cellsOf(runs, heroes, curves, th, tag, (i) => runs[i].hero, (cp, st) => hybrid[`${cp}|${st}`]));
      sets.push({ name: "today: model + sim samples", note: "the same runs against the report's matrix (boss / slice corrections, early-window survival)", set: [], cells: hc, err: errOf(hc, isIntended) });
    }
  }
  const file = (n: string) => join(ROOT, "tools/results", `matrix-${n}.json`);
  // Dream Meadow verification set, variant F (its patch reproduces the data it was measured on)
  if (existsSync(file("verify-dm-f"))) {
    const j = JSON.parse(readFileSync(file("verify-dm-f"), "utf8")) as { meta: { variants: Record<string, Record<string, unknown>> }; runs: MatrixRun[] };
    const set = fromPatch(j.meta.variants.F ?? {});
    const runs = j.runs.filter((r) => r.variant === "F");
    const cells = withSet(set, (tag) => cellsOf(runs, heroes, curves, th, tag, (i) => runs[i].hero));
    sets.push({ name: "matrix-verify-dm-f [F]", note: "Dream Meadow P0-P3, measured during the verification pass (variant F's patch applied; later QA changes not)", set, cells, err: errOf(cells, isIntended) });
  }
  if (existsSync(file("after"))) {
    const j = JSON.parse(readFileSync(file("after"), "utf8")) as { runs: MatrixRun[] };
    const runs = j.runs;
    const cells = withSet(COMBAT_PASS, (tag) => cellsOf(runs, heroes, curves, th, tag, (i) => runs[i].hero));
    sets.push({ name: "matrix-after (combat pass)", note: "every stage, measured before the verification pass: stage tiers and boss HP patched back, the checkpoints' older (one rarity lower) relic sets are NOT reconstructed, so the model sees stronger accounts than were measured", set: COMBAT_PASS, cells, err: errOf(cells, isIntended) });
  }
  const ms = performance.now() - t0;
  for (const s of sets)
    log?.(`  validation ${s.name}: ${s.err.n} cells, clear % off by ${(s.err.clear * 100).toFixed(0)} pts (intended cells ${(s.err.intendedClear * 100).toFixed(0)}), death time ${(s.err.death * 100).toFixed(0)} %, boss TTK ${(s.err.boss * 100).toFixed(0)} %, levels ${(s.err.lv * 100).toFixed(0)} %`);
  return { sets, ms };
}
