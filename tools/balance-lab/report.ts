/**
 * The balance lab report: one self-contained HTML file (inline CSS + SVG, no external
 * libraries, light / dark), the same numbers as JSON (agents) and a short Markdown summary.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { stageBosses } from "../../src/game/stage";
import { stageDef, WEAPONS } from "../../src/game/registry";
import type { BossRec, RunRec } from "./jobs";
import { STAGE_SHORT, type LabOpts } from "./plan";
import { med, type StageModel, type Theta } from "./model";
import type { Validation } from "./validate";
import type { Variant } from "./main";

export interface LabData {
  date: string;
  argv: string[];
  opts: LabOpts;
  theta: Theta;
  calibration: { date: string; runs: number; loss: number; lossDefault: number };
  base: Variant;
  variant: Variant | null;
  validation: Validation | null;
  stats: { jobs: number; hits: number; cpuMs: number; wallMs: number; bootMs: number; workers: number; byKind: Record<string, { n: number; hits: number; ms: number }> };
  checkpoints: { id: string; hours: number; label: string; intended: string[] }[];
  stageInfo: { id: string; name: string; duration: number; intended: string[] }[];
  stageModels: Record<string, StageModel>;
}

// ---------------------------------------------------------------- targets (docs/ARCHITECTURE.md §6.2, EXPANSION §2)

/** Boss fight length targets at the intended checkpoint (s). */
function bossTarget(id: string, final: boolean): [number, number] {
  if (id === "king_puff") return [20, 45];
  if (id === "cancel_sama") return [120, 180];
  return final ? [75, 100] : [45, 60];
}
const CLEAR_TARGET: [number, number] = [0.4, 0.7];

const ECON_TARGETS: Record<string, [number, number, string]> = {
  king_puff: [0.5, 1, "runs 3-6 (0.5-1 h)"],
  clear1: [1.5, 3, "1.5-3 h"],
  clear2: [4, 7, "4-7 h"],
  clear3: [8, 14, "8-14 h"],
  clear4: [15, 25, "15-25 h"],
  clear5: [30, 45, "30-45 h"],
};
const MILESTONE_LABEL: Record<string, string> = {
  first_buy: "First board node",
  first_pull: "First pull",
  king_puff: "First King Puff kill",
  first10: "First 10-pull",
  ring1: "Board ring 1 complete",
  clear1: "Dream Meadow clear",
  clear2: "Candy Kingdom clear",
  clear3: "Shoujo Academy clear",
  clear4: "Beach Episode clear",
  clear5: "Final Arc clear",
  lv10: "Main hero Lv 10",
  mastery5: "A weapon at mastery 5",
  firstSSR: "First SSR+ pull",
  slots4: "4 relic slots",
  ring2: "Board ring 2 complete",
};

// ---------------------------------------------------------------- summary (the JSON agents read)

const mmss = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "-");
const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : "-");
const f0 = (x: number) => (Number.isFinite(x) ? String(Math.round(x)) : "-");
const r1 = (x: number) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const r2 = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface CellOut {
  cp: string;
  stage: string;
  intended: boolean;
  /** The analytic model alone / with the sim samples' corrections (boss TTK and pressure, stage hit rates). */
  model: { clear: number; death: number | null; deathLo: number | null; deathHi: number | null; sat: number | null };
  hybrid: { clear: number; death: number | null } | null;
  full: { n: number; clear: number; death: number | null } | null;
  window: { n: number; died: number; lv3: number | null; dmg90: number | null; dmg180: number | null } | null;
}

function cellsOf(v: Variant, o: LabOpts, intended: (cp: string, st: string) => boolean): CellOut[] {
  const out: CellOut[] = [];
  for (const st of o.stages)
    for (const cp of o.cps) {
      const k = `${cp}|${st}`;
      const p = v.pred[k];
      if (!p) continue;
      const h = v.hybrid[k];
      const fr = v.full.filter((d) => d.result && d.job.kind === "full" && d.job.cp === cp && d.job.stage === st).map((d) => d.result as RunRec);
      const wr = v.windows.filter((d) => d.result && d.job.kind === "window" && d.job.cp === cp && d.job.stage === st).map((d) => d.result as RunRec);
      const markAt = (r: RunRec, t: number) => r.marks.filter((m) => m.t <= t).pop();
      out.push({
        cp,
        stage: st,
        intended: intended(cp, st),
        model: { clear: r2(p.clear) ?? 0, death: r1(p.deathMed), deathLo: r1(p.deathLo), deathHi: r1(p.deathHi), sat: r1(p.sat) },
        hybrid: h ? { clear: r2(h.clear) ?? 0, death: r1(h.deathMed) } : null,
        full: fr.length ? { n: fr.length, clear: fr.filter((r) => r.outcome === "clear").length / fr.length, death: r1(med(fr.filter((r) => r.outcome !== "clear").map((r) => r.end))) } : null,
        window: wr.length
          ? {
              n: wr.length,
              died: wr.filter((r) => r.outcome === "death").length,
              lv3: r1(med(wr.map((r) => (r.end >= 180 ? (markAt(r, 180)?.level ?? NaN) : NaN)))),
              dmg90: r1(med(wr.map((r) => markAt(r, 90)?.dmg ?? NaN))),
              dmg180: r1(med(wr.map((r) => markAt(r, 180)?.dmg ?? NaN))),
            }
          : null,
      });
    }
  return out;
}

export interface BossOut {
  stage: string;
  cp: string;
  id: string;
  final: boolean;
  at: number;
  hp: number;
  target: [number, number];
  model: number | null;
  hybrid: number | null;
  modelKill: number;
  sample: { n: number; killed: number; ttk: number | null; died: number; dmgPerS: number | null; level: number } | null;
}

function bossesOf(v: Variant, o: LabOpts, models: Record<string, StageModel>): BossOut[] {
  const out: BossOut[] = [];
  for (const [cp, st] of o.bossCells) {
    const p = v.pred[`${cp}|${st}`];
    const h = v.hybrid[`${cp}|${st}`];
    const sm = models[st];
    if (!p || !sm) continue;
    const def = stageDef(st);
    for (const id of stageBosses(def)) {
      const ev = sm.events.find((e) => e.boss === id);
      const pb = p.bosses.find((b) => b.id === id);
      const hb = h?.bosses.find((b) => b.id === id);
      const ss = v.bosses.filter((d) => d.result && d.job.kind === "boss" && d.job.boss === id && d.job.cp === cp).map((d) => ({ r: d.result as BossRec, lv: (d.job as { level: number }).level }));
      out.push({
        stage: st,
        cp,
        id,
        final: id === def.finalBoss,
        at: ev?.at ?? NaN,
        hp: Math.round(ev?.bossHp ?? NaN),
        target: bossTarget(id, id === def.finalBoss),
        model: r1(pb?.ttk ?? NaN),
        hybrid: r1(hb?.ttk ?? NaN),
        modelKill: r2(pb?.killRate ?? 0) ?? 0,
        sample: ss.length
          ? {
              n: ss.length,
              killed: ss.filter((x) => x.r.ttk >= 0).length,
              ttk: r1(med(ss.map((x) => x.r.ttk).filter((x) => x >= 0))),
              died: ss.filter((x) => x.r.died >= 0).length,
              dmgPerS: r1(med(ss.map((x) => x.r.dmg / Math.max(5, x.r.ttk >= 0 ? x.r.ttk : x.r.died >= 0 ? x.r.died : 360)))),
              level: ss[0].lv,
            }
          : null,
      });
    }
  }
  return out;
}

export interface WeaponOut {
  id: string;
  name: string;
  evolved: boolean;
  /** Dense-crowd dps at L1 / L5 / Limit Break 4 (L9), single-target (boss) dps at L5; evolutions: their L1. */
  l1: number | null;
  l5: number | null;
  lb: number | null;
  boss: number | null;
  hps: number | null;
  eCd: number;
  eArea: number;
  eAmt: number;
  flag: string;
}

function weaponsOf(v: Variant): WeaponOut[] {
  const t = v.prep.table;
  const rows: WeaponOut[] = [];
  for (const [id, g] of Object.entries(t)) {
    const d = WEAPONS.get(id);
    const ev = !!d?.evolved;
    const at = (lv: number) => g.levels[lv];
    rows.push({
      id,
      name: d?.name ?? id,
      evolved: ev,
      l1: r1(at(1)?.dense ?? NaN),
      l5: ev ? null : r1(at(5)?.dense ?? NaN),
      lb: ev ? null : r1(at(9)?.dense ?? NaN),
      boss: r1((ev ? at(1) : at(5))?.boss ?? NaN),
      hps: r1((ev ? at(1) : at(5))?.hps ?? NaN),
      eCd: r2(g.eCd) ?? 0,
      eArea: r2(g.eArea) ?? 0,
      eAmt: r2(g.eAmt) ?? 0,
      flag: "",
    });
  }
  // outliers: > 2.5x or < 0.4x the median of their peers (base L5 / evolutions), crowd or single-target
  const flag = (sel: WeaponOut[], k: "l5" | "l1" | "boss", what: string, lowToo = true) => {
    const m = med(sel.map((r) => r[k] ?? NaN));
    for (const r of sel) {
      const x = r[k];
      if (x === null || !Number.isFinite(m) || m <= 0) continue;
      if (x > 2.5 * m) r.flag += `${r.flag ? "; " : ""}${what} ${(x / m).toFixed(1)}x the median`;
      else if (lowToo && x < 0.4 * m) r.flag += `${r.flag ? "; " : ""}${what} ${(x / m).toFixed(2)}x the median`;
    }
  };
  const base = rows.filter((r) => !r.evolved);
  const evo = rows.filter((r) => r.evolved);
  flag(base, "l5", "crowd L5");
  flag(evo, "l1", "crowd evo");
  flag(base, "boss", "boss L5", false);
  flag(evo, "boss", "boss evo", false);
  rows.sort((a, b) => Number(a.evolved) - Number(b.evolved) || (b.evolved ? (b.l1 ?? 0) - (a.l1 ?? 0) : (b.l5 ?? 0) - (a.l5 ?? 0)));
  return rows;
}

export interface LevelOut {
  cp: string;
  stage: string;
  /** Model level per 30 s (median over heroes x seeds) and the windows' measured levels (median). */
  model: { t: number; level: number }[];
  sim: { t: number; level: number; n: number }[];
  /** Longest model gap between level-ups outside boss fights (s) and when. */
  gapMax: number;
  gapAt: number;
}

function levelsOf(v: Variant, o: LabOpts): LevelOut[] {
  const out: LevelOut[] = [];
  const cells = [...new Map([...o.windowCells, ...o.bossCells].map((c) => [c.join("|"), c])).values()];
  for (const [cp, st] of cells) {
    const p = v.pred[`${cp}|${st}`];
    if (!p) continue;
    const ts = [...new Set(p.runs.flatMap((r) => r.marks.map((m) => m.t)))].sort((a, b) => a - b);
    const model = ts.map((t) => ({ t, level: med(p.runs.map((r) => r.marks.find((m) => m.t === t)?.level ?? NaN)) })).filter((x) => Number.isFinite(x.level));
    const wr = v.windows.filter((d) => d.result && d.job.kind === "window" && d.job.cp === cp && d.job.stage === st).map((d) => d.result as RunRec);
    const sts = [...new Set(wr.flatMap((r) => r.marks.map((m) => m.t)))].sort((a, b) => a - b);
    const sim = sts.map((t) => {
      const xs = wr.map((r) => r.marks.find((m) => m.t === t)?.level ?? NaN).filter(Number.isFinite);
      return { t, level: med(xs), n: xs.length };
    });
    let gapMax = 0;
    let gapAt = 0;
    for (const r of p.runs) {
      const inBoss = (t: number) => r.bosses.some((b) => t >= b.at && t <= b.at + b.ttk);
      for (let i = 1; i < r.levels.length; i++) {
        const g = r.levels[i] - r.levels[i - 1];
        if (r.levels[i] > 20 && !inBoss(r.levels[i]) && !inBoss(r.levels[i - 1]) && g > gapMax) {
          gapMax = g;
          gapAt = r.levels[i];
        }
      }
    }
    out.push({ cp, stage: st, model, sim, gapMax: Math.round(gapMax), gapAt: Math.round(gapAt) });
  }
  return out;
}

export interface EconOut {
  accounts: number;
  hours: number;
  milestones: { id: string; label: string; hours: number | null; runs: number | null; reached: number; target: string; flag: string }[];
  coinsPerRun: number | null;
  runsPerHour: number | null;
  buyShare: number | null;
}

function econOf(v: Variant): EconOut | null {
  const accs = v.progression.filter((d) => d.result).map((d) => d.result as { hours: number; runs: number; milestones: Record<string, { run: number; hours: number }>; logs: { coins: number; bought: number }[] });
  if (!accs.length) return null;
  const ids = [...new Set(accs.flatMap((a) => Object.keys(a.milestones)))];
  const order = Object.keys(MILESTONE_LABEL);
  ids.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
  const hours = med(accs.map((a) => a.hours));
  const milestones = ids.map((id) => {
    const r = accs.map((a) => a.milestones[id]).filter(Boolean);
    const h = med(r.map((x) => x.hours));
    const t = ECON_TARGETS[id];
    let flag = "";
    if (t && r.length === accs.length && Number.isFinite(h)) {
      if (h < t[0] * 0.7) flag = `early (${(h / t[0]).toFixed(2)}x the low end)`;
      else if (h > t[1] * 1.4) flag = `late (${(h / t[1]).toFixed(2)}x the high end)`;
    }
    return { id, label: MILESTONE_LABEL[id] ?? id, hours: r2(h), runs: r1(med(r.map((x) => x.run))), reached: r.length, target: t?.[2] ?? "", flag };
  });
  const logs = accs.flatMap((a) => a.logs);
  return {
    accounts: accs.length,
    hours: r1(hours) ?? 0,
    milestones,
    coinsPerRun: r1(med(logs.map((l) => l.coins))),
    runsPerHour: r1(med(accs.map((a) => a.runs / Math.max(0.01, a.hours)))),
    buyShare: r2(logs.filter((l) => l.bought > 0).length / Math.max(1, logs.length)),
  };
}

export interface Flag {
  level: "warn" | "info";
  kind: string;
  text: string;
}

function flagsOf(cells: CellOut[], bosses: BossOut[], weapons: WeaponOut[], levels: LevelOut[], econ: EconOut | null, o: LabOpts, intendedOf: (st: string) => string[]): Flag[] {
  const out: Flag[] = [];
  const cpIdx = (cp: string) => o.cps.indexOf(cp);
  const best = (c: CellOut) => c.hybrid?.clear ?? c.model.clear;
  for (const st of o.stages) {
    const its = intendedOf(st);
    for (const c of cells.filter((x) => x.stage === st)) {
      const k = best(c);
      const name = `${c.cp} ${STAGE_SHORT[st]}`;
      if (c.intended) {
        if (k < 0.25) out.push({ level: "warn", kind: "wall", text: `${name}: intended checkpoint clears ${pct(k)} (target 40-70 %)${c.full ? `; full runs ${pct(c.full.clear)} of ${c.full.n}` : ""}` });
        else if (k > 0.9) out.push({ level: "warn", kind: "trivial", text: `${name}: intended checkpoint clears ${pct(k)} (target 40-70 %)` });
        if (c.model.sat !== null && c.model.sat < 30) out.push({ level: "info", kind: "pressure", text: `${name}: the screen fills in the first ${f0(c.model.sat)} s` });
        if (c.model.sat === null && st !== "dream_meadow") out.push({ level: "info", kind: "pressure", text: `${name}: the build out-kills the horde the whole run (the screen never fills)` });
      }
      // one checkpoint below the (first) intended one should mostly die before the final boss; two above should clear
      const i0 = Math.min(...its.map(cpIdx).filter((i) => i >= 0));
      const i = cpIdx(c.cp);
      if (Number.isFinite(i0) && i === i0 - 1 && k > 0.6) out.push({ level: "warn", kind: "trivial", text: `${name}: one checkpoint below intended already clears ${pct(k)}` });
      if (Number.isFinite(i0) && i === i0 + 2 && k < 0.7 && c.cp !== "P7r") out.push({ level: "warn", kind: "wall", text: `${name}: two checkpoints above intended clears only ${pct(k)}` });
      if (c.window && c.window.died > 0 && c.intended) out.push({ level: "warn", kind: "early death", text: `${name}: ${c.window.died}/${c.window.n} sampled runs die in the first ${o.windowT / 60} min` });
    }
  }
  for (const b of bosses) {
    const t = b.sample?.ttk ?? b.hybrid ?? b.model;
    if (t === null) continue;
    if (t > b.target[1] * 1.5) out.push({ level: "warn", kind: "boss slog", text: `${b.id.replace(/_/g, " ")} (${b.cp} ${STAGE_SHORT[b.stage]}): ${f0(t)} s fight, target ${b.target[0]}-${b.target[1]} s` });
    else if (t < b.target[0] * 0.5) out.push({ level: "info", kind: "boss melts", text: `${b.id.replace(/_/g, " ")} (${b.cp} ${STAGE_SHORT[b.stage]}): ${f0(t)} s fight, target ${b.target[0]}-${b.target[1]} s` });
    if (b.sample && b.sample.died >= Math.ceil(b.sample.n / 2)) out.push({ level: "warn", kind: "boss wall", text: `${b.id.replace(/_/g, " ")} (${b.cp}): the hero died in ${b.sample.died}/${b.sample.n} sampled fights` });
  }
  for (const w of weapons) if (w.flag) out.push({ level: "info", kind: "outlier weapon", text: `${w.name}: ${w.flag}` });
  for (const l of levels) if (l.gapMax > 30) out.push({ level: "warn", kind: "dead zone", text: `${l.cp} ${STAGE_SHORT[l.stage]}: ${l.gapMax} s without a level-up (model, outside boss fights) around ${mmss(l.gapAt)}` });
  if (econ) for (const m of econ.milestones) if (m.flag) out.push({ level: "warn", kind: "economy", text: `${m.label} at ${m.hours} h: ${m.flag} (target ${m.target})` });
  return out;
}

// ---------------------------------------------------------------- SVG charts

const W = 320;
const H = 170;
const PAD = { l: 40, r: 10, t: 12, b: 24 };

function axisTicks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo || 1;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

const fmtBig = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k` : `${Math.round(v)}`);

interface Series {
  name: string;
  cls: string;
  pts: [number, number][];
  dash?: boolean;
  dots?: boolean;
}

/** A small line chart (one y axis; log y optional), native tooltips on the points, direct labels. */
function lineChart(title: string, series: Series[], o: { logY?: boolean; xMax: number; yLabel: string; markers?: { x: number; label: string }[]; xFmt?: (x: number) => string }): string {
  const ys = series.flatMap((s) => s.pts.map((p) => p[1])).filter((y) => Number.isFinite(y) && (!o.logY || y > 0));
  if (!ys.length) return "";
  let lo = o.logY ? Math.min(...ys) : 0;
  let hi = Math.max(...ys);
  if (o.logY) {
    lo = Math.pow(10, Math.floor(Math.log10(lo)));
    hi = Math.pow(10, Math.ceil(Math.log10(hi)));
  } else hi = hi * 1.08 || 1;
  const X = (x: number) => PAD.l + (x / o.xMax) * (W - PAD.l - PAD.r);
  const Y = (y: number) => {
    const k = o.logY ? (Math.log10(Math.max(lo, y)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) : (y - lo) / (hi - lo);
    return H - PAD.b - k * (H - PAD.t - PAD.b);
  };
  const xf = o.xFmt ?? mmss;
  let g = "";
  const yt = o.logY ? Array.from({ length: Math.round(Math.log10(hi / lo)) + 1 }, (_, i) => lo * Math.pow(10, i)) : axisTicks(lo, hi);
  for (const v of yt) g += `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="tick" x="${PAD.l - 4}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${fmtBig(v)}</text>`;
  for (const v of axisTicks(0, o.xMax, 5)) g += `<text class="tick" x="${X(v).toFixed(1)}" y="${H - 8}" text-anchor="middle">${xf(v)}</text>`;
  for (const m of o.markers ?? []) g += `<line class="marker" x1="${X(m.x).toFixed(1)}" x2="${X(m.x).toFixed(1)}" y1="${PAD.t}" y2="${H - PAD.b}"><title>${esc(m.label)} at ${xf(m.x)}</title></line>`;
  for (const s of series) {
    const pts = s.pts.filter((p) => Number.isFinite(p[1]) && (!o.logY || p[1] > 0));
    if (!pts.length) continue;
    if (!s.dots) g += `<polyline class="ln ${s.cls}${s.dash ? " dash" : ""}" points="${pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")}"/>`;
    const every = s.dots ? 1 : Math.max(1, Math.floor(pts.length / 24));
    pts.forEach((p, i) => {
      if (i % every) return;
      g += `<circle class="${s.dots ? "dot" : "hit"} ${s.cls}" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="${s.dots ? 3.5 : 6}"><title>${esc(s.name)} ${xf(p[0])}: ${fmtBig(p[1])} ${esc(o.yLabel)}</title></circle>`;
    });
    const last = pts[pts.length - 1];
    if (!s.dots) g += `<text class="dl ${s.cls}-t" x="${Math.min(W - PAD.r - 2, X(last[0]) + 2).toFixed(1)}" y="${(Y(last[1]) - 4).toFixed(1)}" text-anchor="end">${esc(s.name)}</text>`;
  }
  const legend = series.map((s) => `<span class="lg"><i class="sw ${s.cls}${s.dash ? " dash" : ""}${s.dots ? " dotsw" : ""}"></i>${esc(s.name)}</span>`).join("");
  return `<figure class="chart"><figcaption>${esc(title)}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${g}</svg><div class="legend">${legend}</div></figure>`;
}

// ---------------------------------------------------------------- HTML

function clearColor(k: number): string {
  // diverging around the target band: red (wall) - neutral (40-70 %) - blue (trivial)
  if (k < CLEAR_TARGET[0]) return k < 0.15 ? "c-lo2" : "c-lo1";
  if (k > CLEAR_TARGET[1]) return k > 0.9 ? "c-hi2" : "c-hi1";
  return "c-mid";
}

function matrixHtml(cells: CellOut[], vcells: CellOut[] | null, o: LabOpts, names: Record<string, string>): string {
  let h = `<div class="tw"><table class="matrix"><thead><tr><th>checkpoint</th>${o.stages.map((s) => `<th>${esc(names[s] ?? s)}</th>`).join("")}</tr></thead><tbody>`;
  for (const cp of o.cps) {
    h += `<tr><th>${cp}</th>`;
    for (const st of o.stages) {
      const c = cells.find((x) => x.cp === cp && x.stage === st);
      if (!c) {
        h += "<td></td>";
        continue;
      }
      const k = c.hybrid?.clear ?? c.model.clear;
      const v = vcells?.find((x) => x.cp === cp && x.stage === st);
      const vk = v ? (v.hybrid?.clear ?? v.model.clear) : null;
      const death = c.hybrid?.death ?? c.model.death;
      const tip = `${cp} ${names[st]}: model ${pct(c.model.clear)} clear${c.hybrid ? `, model+sim ${pct(c.hybrid.clear)}` : ""}, deaths at ${mmss(c.model.death ?? NaN)} (${mmss(c.model.deathLo ?? NaN)}-${mmss(c.model.deathHi ?? NaN)}), screen fills at ${mmss(c.model.sat ?? NaN)}${c.full ? `; ${c.full.n} full runs: ${pct(c.full.clear)} clear, deaths ${mmss(c.full.death ?? NaN)}` : ""}${c.window ? `; ${c.window.n} early windows: ${c.window.died} died by ${o.windowT / 60}:00, Lv ${f0(c.window.lv3 ?? NaN)} at 3:00` : ""}`;
      const delta = vk !== null ? Math.round((vk - k) * 100) : 0;
      h += `<td class="cell ${clearColor(vk ?? k)}${c.intended ? " intended" : ""}" title="${esc(tip)}"><b>${pct(vk ?? k)}</b>${vk !== null && delta ? `<span class="delta">${delta > 0 ? "+" : ""}${delta}</span>` : ""}<small>${k >= 0.995 && (vk ?? k) >= 0.995 ? "clear" : `&#8224; ${mmss((v?.hybrid?.death ?? v?.model.death ?? death) ?? NaN)}`}</small>${c.full ? `<small class="ev">full ${pct(c.full.clear)}/${c.full.n}</small>` : c.window ? `<small class="ev">sim ${c.window.died}/${c.window.n}&#8224;3m</small>` : ""}</td>`;
    }
    h += "</tr>";
  }
  return `${h}</tbody></table></div>`;
}

export function table(head: string[], rows: string[][], cls = ""): string {
  return `<div class="tw"><table class="${cls}"><thead><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

export const CSS = `
:root{color-scheme:light;--bg:#fcfcfb;--panel:#f4f3f0;--ink:#0b0b0b;--ink2:#52514e;--ink3:#8a8984;--grid:#e3e2de;--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--lo2:#e34948;--lo1:#f2a5a1;--mid:#f0efec;--hi1:#9ec5f4;--hi2:#3987e5;--warn:#d03b3b;--info:#52514e;--ring:#0b0b0b}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#1a1a19;--panel:#242422;--ink:#f0efec;--ink2:#c3c2b7;--ink3:#8f8e86;--grid:#383835;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--lo2:#c93b3b;--lo1:#6e3533;--mid:#383835;--hi1:#1c5cab;--hi2:#3987e5;--warn:#e66767;--info:#c3c2b7;--ring:#f0efec}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#1a1a19;--panel:#242422;--ink:#f0efec;--ink2:#c3c2b7;--ink3:#8f8e86;--grid:#383835;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--lo2:#c93b3b;--lo1:#6e3533;--mid:#383835;--hi1:#1c5cab;--hi2:#3987e5;--warn:#e66767;--info:#c3c2b7;--ring:#f0efec}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:16px}h1{font-size:22px;margin:4px 0}h2{font-size:17px;margin:28px 0 8px}p,li{color:var(--ink2)}code{font-size:12px;background:var(--panel);padding:1px 4px;border-radius:4px;word-break:break-all}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:12px 0}.tile{background:var(--panel);border-radius:8px;padding:8px 10px}.tile b{display:block;font-size:20px}.tile span{color:var(--ink2);font-size:12px}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}table{border-collapse:collapse;font-size:13px;min-width:100%}th,td{padding:5px 7px;border-bottom:1px solid var(--grid);text-align:left;vertical-align:top}th{color:var(--ink2);font-weight:600;white-space:nowrap}
.matrix td.cell{text-align:center;min-width:92px;border:2px solid var(--bg);border-radius:6px;color:var(--ink)}.matrix td b{font-size:16px;display:block}.matrix small{display:block;font-size:11px;color:var(--ink2)}.matrix small.ev{color:var(--ink3)}
.c-lo2{background:var(--lo2)}.c-lo1{background:var(--lo1)}.c-mid{background:var(--mid)}.c-hi1{background:var(--hi1)}.c-hi2{background:var(--hi2)}.c-lo2 b,.c-hi2 b,.c-lo2 small,.c-hi2 small{color:#fff!important}
.matrix td.intended{outline:3px solid var(--ring);outline-offset:-3px}.delta{font-size:12px;font-weight:700;margin-left:3px}
.flags{list-style:none;padding:0}.flags li{padding:4px 0 4px 26px;position:relative;color:var(--ink)}.flags li:before{position:absolute;left:0;top:4px;font-weight:700;font-size:12px}.flags li.warn:before{content:"!";color:var(--warn);border:1.5px solid var(--warn);border-radius:50%;width:16px;height:16px;text-align:center;line-height:15px}.flags li.info:before{content:"i";color:var(--info);border:1.5px solid var(--info);border-radius:50%;width:16px;height:16px;text-align:center;line-height:15px}.flags .k{color:var(--ink2);font-size:12px;margin-right:6px}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}figure.chart{margin:0;background:var(--panel);border-radius:8px;padding:8px}figcaption{font-weight:600;font-size:13px;margin-bottom:2px}svg{width:100%;height:auto;display:block}
.grid{stroke:var(--grid);stroke-width:1}.tick{fill:var(--ink3);font-size:9px}.marker{stroke:var(--ink3);stroke-width:1;stroke-dasharray:2 3}.ln{fill:none;stroke-width:2;stroke-linejoin:round}.ln.dash{stroke-dasharray:5 4;stroke-width:1.5}.hit{fill:transparent;stroke:none}.dot{stroke:var(--panel);stroke-width:2}
.ln.s1{stroke:var(--s1)}.ln.s2{stroke:var(--s2)}.ln.s3{stroke:var(--s3)}.dot.s1{fill:var(--s1)}.dot.s2{fill:var(--s2)}.dot.s3{fill:var(--s3)}.dl{font-size:9px;fill:var(--ink2)}
.legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11px;color:var(--ink2);margin-top:2px}.sw{display:inline-block;width:14px;height:2px;margin-right:4px;vertical-align:middle;background:var(--s1)}.sw.s2{background:var(--s2)}.sw.s3{background:var(--s3)}.sw.dash{background:repeating-linear-gradient(90deg,var(--s1) 0 4px,transparent 4px 7px);height:2px}.sw.s2.dash{background:repeating-linear-gradient(90deg,var(--s2) 0 4px,transparent 4px 7px)}.sw.dotsw{width:8px;height:8px;border-radius:50%}
.bar{display:inline-block;height:8px;border-radius:0 4px 4px 0;background:var(--s1);vertical-align:middle;margin-right:6px}.bar.s2{background:var(--s2)}.num{font-variant-numeric:tabular-nums;white-space:nowrap}.muted{color:var(--ink3)}.ok{color:var(--ink2)}.bad{color:var(--warn);font-weight:600}
details{margin:8px 0}summary{cursor:pointer;color:var(--ink2)}
`;

export interface Report {
  html: string;
  json: string;
  md: string;
  summaryLine: string;
  summary: unknown;
}

export function buildReport(d: LabData, out: string): Report {
  const o = d.opts;
  const intendedOf = (st: string) => d.stageInfo.find((s) => s.id === st)?.intended ?? [];
  const isInt = (cp: string, st: string) => intendedOf(st).includes(cp);
  const names = Object.fromEntries(d.stageInfo.map((s) => [s.id, s.name]));
  const cells = cellsOf(d.base, o, isInt);
  const vcells = d.variant ? cellsOf(d.variant, o, isInt) : null;
  const top = d.variant ?? d.base;
  const bosses = bossesOf(top, o, d.stageModels);
  const baseBosses = d.variant ? bossesOf(d.base, o, d.stageModels) : null;
  const weapons = weaponsOf(top);
  const levels = levelsOf(top, o);
  const econ = econOf(top);
  const baseEcon = d.variant ? econOf(d.base) : null;
  const flags = flagsOf(vcells ?? cells, bosses, weapons, levels, econ, o, intendedOf);
  const st = d.stats;
  const summary = {
    date: d.date,
    set: d.variant?.set.map((x) => x.text) ?? [],
    perf: { wallS: r1(st.wallMs / 1000), jobs: st.jobs, cached: st.hits, ran: st.jobs - st.hits, cpuS: r1(st.cpuMs / 1000), workers: st.workers, modelMs: Math.round(d.base.modelMs), byKind: st.byKind },
    calibration: d.calibration,
    theta: d.theta,
    matrix: vcells ? vcells.map((c, i) => ({ ...c, base: { model: cells[i]?.model, hybrid: cells[i]?.hybrid } })) : cells,
    bosses: bosses.map((b, i) => ({ ...b, base: baseBosses?.[i] ? { model: baseBosses[i].model, hybrid: baseBosses[i].hybrid, sample: baseBosses[i].sample } : undefined })),
    weapons,
    levels,
    economy: econ,
    economyBase: baseEcon,
    flags,
    corrections: top.corr,
    validation: d.validation?.sets.map((s) => ({ name: s.name, note: s.note, err: s.err, cells: s.cells })) ?? null,
  };
  const json = join(out, "report.json");
  writeFileSync(json, JSON.stringify(summary, null, 1));

  // ---------------- HTML
  const tiles = [
    [`${(st.wallMs / 1000).toFixed(1)} s`, "wall time"],
    [`${st.hits}/${st.jobs}`, "sim jobs from cache"],
    [`${(st.cpuMs / 1000).toFixed(0)} s`, `CPU on ${st.workers} workers`],
    [`${Math.round(d.base.modelMs)} ms`, `model, ${cells.length} cells`],
    [`${flags.filter((f) => f.level === "warn").length}`, "warnings"],
  ];
  let h = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Balance Lab Report</title><style>${CSS}</style></head><body><main>`;
  h += `<h1>Balance lab</h1><p>${esc(d.date.slice(0, 16).replace("T", " "))} UTC &middot; mid bot = the average player &middot; heroes ${o.heroes.join(", ")} &middot; ${d.variant ? `what-if: ${d.variant.set.map((x) => `<code>${esc(x.text)}</code>`).join(" ")} (cells show the what-if, the delta is vs today)` : "today's content"}</p>`;
  h += `<div class="tiles">${tiles.map(([a, b]) => `<div class="tile"><b>${a}</b><span>${b}</span></div>`).join("")}</div>`;
  const li = (f: Flag) => `<li class="${f.level}"><span class="k">${esc(f.kind)}</span>${esc(f.text)}</li>`;
  const warns = flags.filter((f) => f.level === "warn");
  const infos = flags.filter((f) => f.level !== "warn");
  h += `<h2>Flags</h2>${warns.length ? `<ul class="flags">${warns.map(li).join("")}</ul>` : "<p>No warnings.</p>"}`;
  if (infos.length) h += `<details><summary>${infos.length} notes (weapon outliers, pressure)</summary><ul class="flags">${infos.map(li).join("")}</ul></details>`;
  h += `<h2>Clear rate: checkpoint x stage</h2><p>Mid-bot clear % (${Object.keys(d.base.hybrid).length ? "model corrected by the boss / slice samples" : "analytic model"}) and the median death time (&#8224;). Outlined: the stage's intended checkpoint (target 40-70 %). Red = below the band, blue = above. "full" = real full runs, "sim" = early windows that died by ${o.windowT / 60}:00. Tap or hover a cell for details.</p>`;
  h += matrixHtml(cells, vcells, o, names);
  // bosses
  h += `<h2>Boss fights at the intended checkpoint</h2><p>Time to kill (s): the model, the model with the samples' corrections, and real fights from snapshots (the build grown to the model's level, the timeline skipped to just before the boss).</p>`;
  h += table(
    ["stage", "boss", "HP", "target", "model", "model+sim", "sampled fights", "hero deaths", "dmg taken/s"],
    bosses.map((b, i) => {
      const bb = baseBosses?.[i];
      const t = b.sample?.ttk ?? b.hybrid ?? b.model;
      const cls = t !== null && (t > b.target[1] * 1.5 || t < b.target[0] * 0.5) ? "bad" : "ok";
      return [
        `${esc(names[b.stage] ?? b.stage)} <span class="muted">${b.cp}</span>`,
        `${esc(b.id.replace(/_/g, " "))}${b.final ? " <span class='muted'>(final)</span>" : ""}`,
        `<span class="num">${fmtBig(b.hp)}</span>`,
        `<span class="num">${b.target[0]}-${b.target[1]}</span>`,
        `<span class="num">${f0(b.model ?? NaN)}${bb && bb.model !== b.model ? ` <span class="muted">(was ${f0(bb.model ?? NaN)})</span>` : ""}</span>`,
        `<span class="num">${f0(b.hybrid ?? NaN)}</span>`,
        b.sample ? `<span class="num ${cls}">${f0(b.sample.ttk ?? NaN)} s</span> <span class="muted">${b.sample.killed}/${b.sample.n} killed, Lv ${b.sample.level}</span>` : "-",
        b.sample ? `${b.sample.died}/${b.sample.n}` : "-",
        b.sample ? `<span class="num">${f0(b.sample.dmgPerS ?? NaN)}</span>` : "-",
      ];
    }),
  );
  // stage pressure
  h += `<h2>Stage pressure (intended checkpoint)</h2><p>Incoming enemy HP per second from the stage data (spawn rate x mix x HP scaling; dashed: with the director's x4 pressure-floor boost) against the build's crowd DPS in the model run (median hero). Where the solid line crosses above the DPS the screen fills; dotted verticals are bosses.</p><div class="charts">`;
  for (const stg of o.stages) {
    const cp = o.bossCells.find((c) => c[1] === stg)?.[0];
    const sm = d.stageModels[stg];
    const p = cp ? top.pred[`${cp}|${stg}`] : undefined;
    if (!sm || !p) continue;
    const xMax = sm.duration + 60;
    const inc = sm.points.filter((x) => x.t % 10 === 0 && x.t <= xMax).map((x) => [x.t, x.inHp] as [number, number]);
    const boosted = inc.map(([t, v]) => [t, v * 4] as [number, number]);
    const run = p.runs[Math.floor(p.runs.length / 2)];
    const dps = (run?.marks ?? []).map((m) => [m.t, m.dps] as [number, number]);
    h += lineChart(
      `${names[stg]} @ ${cp}: screen fills at ${mmss(p.sat)}`,
      [
        { name: "incoming HP/s", cls: "s1", pts: inc },
        { name: "x4 floor boost", cls: "s1", pts: boosted, dash: true },
        { name: "crowd DPS (model)", cls: "s2", pts: dps },
      ],
      { logY: true, xMax, yLabel: "HP/s", markers: sm.events.filter((e) => e.kind === "boss").map((e) => ({ x: e.at, label: e.boss ?? "boss" })) },
    );
  }
  h += `</div>`;
  // levels
  h += `<h2>Level curve</h2><p>Model level over time (median of heroes x seeds) against real runs of the same cell (early windows, dots). The model's longest level-up gap outside boss fights is in the title.</p><div class="charts">`;
  for (const l of levels) {
    const sm = d.stageModels[l.stage];
    h += lineChart(
      `${l.cp} ${names[l.stage]} (longest gap ${l.gapMax} s)`,
      [
        { name: "model", cls: "s1", pts: l.model.map((x) => [x.t, x.level]) },
        { name: "real runs", cls: "s2", pts: l.sim.map((x) => [x.t, x.level]), dots: true },
      ],
      { xMax: (sm?.duration ?? 600) + 60, yLabel: "level" },
    );
  }
  h += `</div>`;
  // weapons
  const maxL5 = Math.max(1, ...weapons.map((w) => (w.evolved ? (w.l1 ?? 0) : (w.l5 ?? 0))));
  h += `<h2>Weapon DPS (gauge: alone, base stats)</h2><p>Damage per second against a dense crowd (120 enemies around the hero) at L1 / L5 / Limit Break 4, and against a pinned boss at L5 (evolutions: their single level). Elasticities: how the crowd DPS scales with cooldown, area and +1 amount (the analytic model's stat terms).</p>`;
  h += table(
    ["weapon", "crowd L1", "crowd L5 / evo", "LB 4", "boss", "hits/s", "cd / area / amount", "flag"],
    weapons.map((w) => {
      const main = w.evolved ? (w.l1 ?? 0) : (w.l5 ?? 0);
      return [
        `${esc(w.name)}${w.evolved ? " <span class='muted'>evo</span>" : ""}`,
        `<span class="num">${w.evolved ? "-" : fmtBig(w.l1 ?? NaN)}</span>`,
        `<span class="bar" style="width:${Math.max(2, Math.round((main / maxL5) * 90))}px"></span><span class="num">${fmtBig(main)}</span>`,
        `<span class="num">${w.lb !== null ? fmtBig(w.lb) : "-"}</span>`,
        `<span class="num">${fmtBig(w.boss ?? NaN)}</span>`,
        `<span class="num">${w.hps ?? "-"}</span>`,
        `<span class="num">${w.eCd} / ${w.eArea} / ${w.eAmt}</span>`,
        w.flag ? `<span class="bad">${esc(w.flag)}</span>` : "",
      ];
    }),
  );
  // economy
  if (econ) {
    h += `<h2>Economy (quick progression sample)</h2><p>${econ.accounts} mid-bot accounts played from a fresh save for ${econ.hours} h with the real progression simulator (tools/progression.sim.ts): median hours / runs to each milestone reached. ${econ.coinsPerRun ?? "-"} coins per run, ${econ.runsPerHour ?? "-"} runs per hour, a board node bought after ${pct(econ.buyShare ?? NaN)} of the runs. Longer samples: <code>--prog-hours 8</code>.</p>`;
    h += table(
      ["milestone", "hours", "runs", "reached", "target", ""],
      econ.milestones.map((m) => {
        const b = baseEcon?.milestones.find((x) => x.id === m.id);
        return [esc(m.label), `<span class="num">${m.hours ?? "-"}${b && b.hours !== m.hours ? ` <span class="muted">(was ${b.hours ?? "-"})</span>` : ""}</span>`, `<span class="num">${m.runs ?? "-"}</span>`, `${m.reached}/${econ.accounts}`, esc(m.target), m.flag ? `<span class="bad">${esc(m.flag)}</span>` : ""];
      }),
    );
  }
  // validation
  if (d.validation?.sets.length) {
    h += `<h2>Model accuracy</h2><p>The analytic model against measured full runs (each set's content patched back to what it was measured on). Clear: mean absolute difference in percentage points; death time, boss TTK, levels: median relative error.</p>`;
    h += table(
      ["set", "cells", "clear % (pts)", "intended cells", "death time", "boss TTK", "levels", "note"],
      d.validation.sets.map((s) => [esc(s.name), String(s.err.n), `<span class="num">${f0(s.err.clear * 100)}</span>`, `<span class="num">${f0(s.err.intendedClear * 100)}</span>`, pct(s.err.death), pct(s.err.boss), pct(s.err.lv), `<span class="muted">${esc(s.note)}</span>`]),
    );
  }
  // corrections + method
  const corr = top.corr;
  h += `<h2>How this was computed</h2><ul>`;
  h += `<li><b>Model</b>: incoming horde from the stage data, build DPS from the gauged weapon table x the account's stats (scaled to snapshot gauges of the bot's real builds), a coarse time-stepped run per hero x seed x 16 noise draws. Player constants fitted on ${d.calibration.runs || "no"} reference runs${d.calibration.date ? ` (${d.calibration.date.slice(0, 10)}, loss ${d.calibration.lossDefault.toFixed(3)} -> ${d.calibration.loss.toFixed(3)})` : " (defaults: run --calibrate)"}.</li>`;
  if (corr) h += `<li><b>Sim corrections</b>: boss TTK x ${Object.entries(corr.boss).map(([k, v]) => `${k.replace(/_/g, " ")} ${v.ttk.toFixed(2)}`).join(", ")}; stage hit rate x ${Object.entries(corr.stageHit).map(([k, v]) => `${STAGE_SHORT[k]} ${v.k.toFixed(2)}`).join(", ")}.</li>`;
  h += `<li><b>Samples</b>: ${Object.entries(st.byKind).map(([k, v]) => `${k} ${v.n} (${v.hits} cached, ${(v.ms / 1000).toFixed(0)} s CPU)`).join(", ")}.</li>`;
  h += `<li><b>Re-run</b>: <code>npm run balance:lab ${esc(d.argv.join(" "))}</code>; what-if: <code>--set "stage.final_arc.scaling.hp*=1.2"</code>. JSON next to this file.</li></ul>`;
  h += `</main></body></html>`;
  const html = join(out, "report.html");
  writeFileSync(html, h);

  // ---------------- Markdown
  const md: string[] = [];
  md.push(`# Balance lab ${d.date.slice(0, 16).replace("T", " ")}${d.variant ? ` - what-if ${d.variant.set.map((x) => `\`${x.text}\``).join(" ")}` : ""}`);
  md.push("");
  md.push(`${(st.wallMs / 1000).toFixed(1)} s wall, ${st.hits}/${st.jobs} jobs cached, ${(st.cpuMs / 1000).toFixed(0)} s CPU on ${st.workers} workers.`);
  md.push("");
  md.push(`| | ${o.stages.map((s) => names[s]).join(" | ")} |`);
  md.push(`| --- | ${o.stages.map(() => "---").join(" | ")} |`);
  for (const cp of o.cps) {
    const row = o.stages.map((s) => {
      const c = cells.find((x) => x.cp === cp && x.stage === s);
      const v = vcells?.find((x) => x.cp === cp && x.stage === s);
      if (!c) return "";
      const k = c.hybrid?.clear ?? c.model.clear;
      const vk = v ? (v.hybrid?.clear ?? v.model.clear) : null;
      const txt = vk !== null ? `${pct(k)} -> ${pct(vk)}` : `${pct(k)}${k < 0.995 ? ` (${mmss(c.hybrid?.death ?? c.model.death ?? NaN)})` : ""}`;
      return c.intended ? `**${txt}**` : txt;
    });
    md.push(`| ${cp} | ${row.join(" | ")} |`);
  }
  md.push("");
  if (flags.length) {
    md.push("Flags:");
    for (const f of flags) md.push(`- ${f.level === "warn" ? "WARN" : "info"} ${f.kind}: ${f.text}`);
    md.push("");
  }
  md.push(`Bosses (s, sampled / model): ${bosses.map((b) => `${b.id} ${f0(b.sample?.ttk ?? NaN)} / ${f0(b.hybrid ?? b.model ?? NaN)} (target ${b.target[0]}-${b.target[1]})`).join("; ")}`);
  if (econ) md.push(`\nEconomy (${econ.accounts} x ${econ.hours} h): ${econ.milestones.map((m) => `${m.label} ${m.hours ?? "-"} h`).join("; ")}`);
  if (d.validation) md.push(`\nModel error: ${d.validation.sets.map((s) => `${s.name}: clear ${f0(s.err.clear * 100)} pts, deaths ${pct(s.err.death)}, bosses ${pct(s.err.boss)}, levels ${pct(s.err.lv)}`).join("; ")}`);
  const mdPath = join(out, "report.md");
  writeFileSync(mdPath, `${md.join("\n")}\n`);
  const warn = flags.filter((f) => f.level === "warn").length;
  return { html, json, md: mdPath, summaryLine: `${cells.length} cells, ${warn} warnings, ${(st.wallMs / 1000).toFixed(1)} s (${st.hits}/${st.jobs} cached)`, summary };
}

