/**
 * Calibration of the analytic model's PLAYER constants (Theta: engagement, XP collection,
 * hit rate, boss focus...) against real runs: the reference set is full mid-bot runs of
 * each stage at its intended checkpoint and its neighbours (`npm run balance:lab -- --calibrate`
 * runs / reuses them from the cache and writes tools/balance-lab/calibration.json).
 * The fit is a coordinate descent in log space on: levels and kills over time, damage taken,
 * death / clear times and boss fight lengths; then the noise widths are set to match the
 * observed clear rates.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LAB_DIR } from "./cache";
import type { Done } from "./exec";
import type { FullJob, RunRec } from "./jobs";
import { cellInputs, predict, type BuildCurve } from "./plan";
import { DEFAULT_THETA, med, runModel, type ModelRun, type Theta } from "./model";

export const CALIBRATION_FILE = join(LAB_DIR, "calibration.json");

/** The reference cells: each stage at its intended checkpoint and its neighbours. */
export const REF_CELLS: [string, string][] = [
  ["P0", "dream_meadow"],
  ["P1b", "dream_meadow"],
  ["P2", "dream_meadow"],
  ["P3", "dream_meadow"],
  ["P2", "candy_kingdom"],
  ["P3", "candy_kingdom"],
  ["P4", "candy_kingdom"],
  ["P3", "shoujo_academy"],
  ["P4", "shoujo_academy"],
  ["P5", "shoujo_academy"],
  ["P4", "beach_episode"],
  ["P5", "beach_episode"],
  ["P6", "beach_episode"],
  ["P5", "final_arc"],
  ["P6", "final_arc"],
  ["P7", "final_arc"],
];

export function refJobs(heroes: string[], seeds: number[], bot = "mid", cells = REF_CELLS): FullJob[] {
  const out: FullJob[] = [];
  for (const [cp, stage] of cells) for (const hero of heroes) for (const seed of seeds) out.push({ kind: "full", cp, stage, hero, seed, bot });
  return out;
}

export interface Calibration {
  theta: Theta;
  /** What it was fitted on and how well. */
  fitted: { date: string; runs: number; loss: number; lossDefault: number };
}

export function loadCalibration(): Calibration {
  if (existsSync(CALIBRATION_FILE)) {
    try {
      const c = JSON.parse(readFileSync(CALIBRATION_FILE, "utf8")) as Calibration;
      return { ...c, theta: { ...DEFAULT_THETA, ...c.theta } };
    } catch {
      /* fall through */
    }
  }
  return { theta: DEFAULT_THETA, fitted: { date: "", runs: 0, loss: NaN, lossDefault: NaN } };
}

const sq = (x: number) => x * x;
const lr = (a: number, b: number, k = 1) => Math.log((a + k) / (b + k));

/** Value of a mark series at time t (the last mark at or before t; NaN past the end). */
function markAt<T extends { t: number }>(marks: T[], t: number): T | undefined {
  let best: T | undefined;
  for (const m of marks) if (m.t <= t + 1e-6) best = m;
  return best;
}

export interface RunCompare {
  cp: string;
  stage: string;
  hero: string;
  seed: number;
  real: { outcome: string; end: number; lv: number[]; kills: number[]; dmg: number[]; alive: number[]; bosses: { id: string; dur: number }[] };
  model: { outcome: string; end: number; lv: number[]; kills: number[]; dmg: number[]; alive: number[]; bosses: { id: string; dur: number }[] };
}

const MARK_T = [60, 120, 180, 300, 600, 900];

/** Compare one real run with the model's deterministic run of the same cell / hero / seed path. */
export function compareRun(d: Done<RunRec>, m: ModelRun): RunCompare | null {
  if (!d.result || d.job.kind !== "full") return null;
  const r = d.result;
  const j = d.job;
  const pick = (end: number, marks: { t: number; level: number; kills: number; dmg: number; alive: number }[], k: "level" | "kills" | "dmg" | "alive") => MARK_T.map((t) => (t <= end ? (markAt(marks, t)?.[k] ?? NaN) : NaN));
  return {
    cp: j.cp,
    stage: j.stage,
    hero: j.hero,
    seed: j.seed,
    real: { outcome: r.outcome === "clear" ? "clear" : "death", end: r.end, lv: pick(r.end, r.marks, "level"), kills: pick(r.end, r.marks, "kills"), dmg: pick(r.end, r.marks, "dmg"), alive: pick(r.end, r.marks, "alive"), bosses: r.bosses.map((b) => ({ id: b.id, dur: b.dur })) },
    model: { outcome: m.outcome === "clear" ? "clear" : "death", end: m.end, lv: pick(m.end, m.marks, "level"), kills: pick(m.end, m.marks, "kills"), dmg: pick(m.end, m.marks, "dmg"), alive: pick(m.end, m.marks, "alive"), bosses: m.bosses.map((b) => ({ id: b.id, dur: b.killed ? b.ttk : -1 })) },
  };
}

/**
 * Loss over CELLS (cp x stage): the median of the real runs against the median of the model's runs of the same
 * heroes / seeds - levels, kills, alive and damage over time, the end time, the clear share and boss fight lengths.
 * (Per-run comparisons are dominated by seed noise: the same cell dies at 3:00 or clears at 10:00.)
 */
export interface LossW {
  lv: number;
  kills: number;
  alive: number;
  dmg: number;
  end: number;
  clear: number;
  boss: number;
}
export const LOSS_ALL: LossW = { lv: 1, kills: 0.5, alive: 0.3, dmg: 0.3, end: 3, clear: 3, boss: 1 };

export function lossOf(cs: RunCompare[], w: LossW = LOSS_ALL): number {
  const cells = new Map<string, RunCompare[]>();
  for (const c of cs) {
    const k = `${c.cp}|${c.stage}`;
    cells.set(k, [...(cells.get(k) ?? []), c]);
  }
  let L = 0;
  let n = 0;
  const mid = (xs: number[]) => med(xs.filter(Number.isFinite));
  for (const g of cells.values()) {
    for (let i = 0; i < MARK_T.length; i++) {
      const pairs: [keyof RunCompare["real"], number, number][] = [
        ["lv", w.lv, 1],
        ["kills", w.kills, 20],
        ["alive", w.alive, 10],
        ["dmg", w.dmg, 30],
      ];
      for (const [k, wt, sm] of pairs) {
        if (!wt) continue;
        // only marks most runs of both sides reached
        const ra = g.map((c) => (c.real[k] as number[])[i]);
        const ma = g.map((c) => (c.model[k] as number[])[i]);
        if (ra.filter(Number.isFinite).length * 2 < g.length || ma.filter(Number.isFinite).length * 2 < g.length) continue;
        L += wt * sq(lr(mid(ra), mid(ma), sm));
        n += wt;
      }
    }
    L += w.end * sq(lr(mid(g.map((c) => c.real.end)), mid(g.map((c) => c.model.end)), 30));
    const rc = g.filter((c) => c.real.outcome === "clear").length / g.length;
    const mc = g.filter((c) => c.model.outcome === "clear").length / g.length;
    L += w.clear * sq(rc - mc);
    n += w.end + w.clear;
    const ids = [...new Set(g.flatMap((c) => c.real.bosses.map((b) => b.id)))];
    for (const id of ids) {
      const r = mid(g.map((c) => c.real.bosses.find((b) => b.id === id)?.dur ?? NaN).filter((x) => x > 0));
      const m = mid(g.map((c) => c.model.bosses.find((b) => b.id === id)?.dur ?? NaN).filter((x) => x > 0));
      if (w.boss && Number.isFinite(r) && Number.isFinite(m)) {
        L += w.boss * sq(lr(r, m, 10));
        n += w.boss;
      }
    }
  }
  return n ? L / n : 0;
}

export function compareAll(refs: Done<RunRec>[], curves: BuildCurve[], th: Theta, tag: string): RunCompare[] {
  const out: RunCompare[] = [];
  for (const d of refs) {
    if (!d.result || d.job.kind !== "full") continue;
    const j = d.job;
    const inp = cellInputs(j.cp, j.stage, [j.hero], curves, tag, undefined, j.seed)[0] ?? cellInputs(j.cp, j.stage, [j.hero], curves, tag)[0];
    if (!inp) continue;
    const c = compareRun(d, runModel(inp, th, 1, 1, 60));
    if (c) out.push(c);
  }
  return out;
}

type Key = Exclude<keyof Theta, "sd" | "sh">;
const FIT: { k: Key; lo: number; hi: number }[] = [
  { k: "tau", lo: 0.5, hi: 20 },
  { k: "reach", lo: 0.01, hi: 1 },
  { k: "eff", lo: 0.05, hi: 3 },
  { k: "n50", lo: 2, hi: 200 },
  { k: "collect", lo: 0.3, hi: 1.2 },
  { k: "h0", lo: 0.05, hi: 6 },
  { k: "p", lo: 0.5, hi: 5 },
  { k: "hr", lo: 0.01, hi: 10 },
  { k: "food", lo: 0, hi: 5 },
  { k: "bossEff", lo: 0.05, hi: 3 },
  { k: "bossDrain", lo: 0, hi: 0.9 },
  { k: "hb", lo: 0.01, hi: 3 },
  { k: "enrage", lo: 1, hi: 6 },
];

/** The fit stages: which constants move, against which part of the loss. */
const STAGES: { keys: Key[]; w: LossW }[] = [
  // kills / XP: the walk-in, reach, crowd efficiency, density, XP collection (levels, kills, alive over time)
  { keys: ["tau", "reach", "eff", "n50", "collect"], w: { lv: 1, kills: 0.7, alive: 0.7, dmg: 0, end: 0, clear: 0, boss: 0 } },
  // damage: hit rate, its density exponent, healing (damage over time, death times, clears)
  { keys: ["h0", "p", "hr", "food"], w: { lv: 0, kills: 0, alive: 0, dmg: 0.5, end: 3, clear: 3, boss: 0 } },
  // bosses: single-target efficiency, the crowd lost meanwhile, boss pressure, the final enrage
  { keys: ["bossEff", "bossDrain", "hb", "enrage"], w: { lv: 0, kills: 0, alive: 0, dmg: 0, end: 2, clear: 3, boss: 1 } },
  // everything together, small steps
  { keys: FIT.map((f) => f.k), w: LOSS_ALL },
];

/** Staged coordinate descent (log steps, shrinking) on the deterministic cell-level loss. */
export function fitTheta(refs: Done<RunRec>[], curves: BuildCurve[], tag: string, start: Theta = DEFAULT_THETA, passes = 4, log?: (s: string) => void): { theta: Theta; loss: number; loss0: number } {
  let th = { ...start };
  const f = (t: Theta, w: LossW) => lossOf(compareAll(refs, curves, t, tag), w);
  const loss0 = f(th, LOSS_ALL);
  for (const [si, st] of STAGES.entries()) {
    let best = f(th, st.w);
    let step = si === STAGES.length - 1 ? 0.15 : 0.6;
    for (let pass = 0; pass < passes; pass++) {
      for (const { k, lo, hi } of FIT.filter((x) => st.keys.includes(x.k))) {
        for (const dir of [1, -1]) {
          for (let tries = 0; tries < 8; tries++) {
            const v = th[k] === 0 ? (dir > 0 ? 0.05 : 0) : th[k] * Math.exp(dir * step);
            const cand = { ...th, [k]: Math.max(lo, Math.min(hi, v)) };
            if (cand[k] === th[k]) break;
            const l = f(cand, st.w);
            if (l < best - 1e-6) {
              best = l;
              th = cand;
            } else break;
          }
        }
      }
      step *= 0.6;
    }
    log?.(`  fit stage ${si + 1} (${st.keys.join(", ")}): loss ${best.toFixed(4)}`);
  }
  return { theta: th, loss: f(th, LOSS_ALL), loss0 };
}

/** Noise widths that match the observed clear rates (Brier score over the reference cells). */
export function fitNoise(refs: Done<RunRec>[], curves: BuildCurve[], th: Theta, tag: string, heroes: string[]): Theta {
  const cells = new Map<string, { cp: string; stage: string; clears: number; n: number }>();
  for (const d of refs) {
    if (!d.result || d.job.kind !== "full") continue;
    const k = `${d.job.cp}|${d.job.stage}`;
    const c = cells.get(k) ?? { cp: d.job.cp, stage: d.job.stage, clears: 0, n: 0 };
    cells.set(k, c);
    c.n++;
    if (d.result.outcome === "clear") c.clears++;
  }
  let best = th;
  let bestL = Infinity;
  for (const sd of [0.15, 0.25, 0.35, 0.5]) {
    for (const sh of [0.2, 0.35, 0.5, 0.7, 0.9]) {
      const t = { ...th, sd, sh };
      let L = 0;
      for (const c of cells.values()) L += sq(predict(c.cp, c.stage, heroes, curves, t, tag).clear - c.clears / c.n);
      if (L < bestL) {
        bestL = L;
        best = t;
      }
    }
  }
  return best;
}

export function saveCalibration(c: Calibration): void {
  writeFileSync(CALIBRATION_FILE, `${JSON.stringify(c, null, 2)}\n`);
}

/** Median absolute errors of a comparison set (levels %, death / clear time %, boss TTK %, outcome agreement). */
export function errorSummary(cs: RunCompare[]): { lv: number; kills: number; end: number; boss: number; outcome: number; n: number } {
  const lvE: number[] = [];
  const kE: number[] = [];
  const endE: number[] = [];
  const bE: number[] = [];
  let agree = 0;
  for (const c of cs) {
    for (let i = 0; i < MARK_T.length; i++) {
      if (Number.isFinite(c.real.lv[i]) && Number.isFinite(c.model.lv[i])) lvE.push(Math.abs(c.model.lv[i] / c.real.lv[i] - 1));
      if (Number.isFinite(c.real.kills[i]) && Number.isFinite(c.model.kills[i]) && c.real.kills[i] > 50) kE.push(Math.abs(c.model.kills[i] / c.real.kills[i] - 1));
    }
    endE.push(Math.abs(c.model.end / c.real.end - 1));
    if (c.model.outcome === c.real.outcome) agree++;
    for (const b of c.real.bosses) {
      const mb = c.model.bosses.find((x) => x.id === b.id);
      if (b.dur > 0 && mb && mb.dur > 0) bE.push(Math.abs(mb.dur / b.dur - 1));
    }
  }
  return { lv: med(lvE), kills: med(kE), end: med(endE), boss: med(bE), outcome: cs.length ? agree / cs.length : NaN, n: cs.length };
}
