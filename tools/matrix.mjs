#!/usr/bin/env node
/**
 * Power-vs-stage matrix (docs/ARCHITECTURE.md §6): plays checkpoint x stage x
 * hero x seed runs with the account checkpoints of tools/checkpoints.ts, in
 * parallel vitest workers (tools/matrix.sim.ts, one per CPU), and prints /
 * writes clear rates, death times, boss fight lengths and the early-game feel
 * numbers per cell.
 *
 *   node tools/matrix.mjs                                   # every checkpoint x stage, hoshi/rin/kuro, seeds 1-4, mid bot
 *   node tools/matrix.mjs --cp P0,P1,P2 --stages dm --seeds 1-8
 *   node tools/matrix.mjs --cells P2:dm,P3:candy,P4:academy,P5:beach,P5:final,P6:final --seeds 1-8
 *   node tools/matrix.mjs --cp P7 --stages final --twists max --name heat
 *   node tools/matrix.mjs --bot lazy,mid,good --cp P2 --stages dm
 *   --tmax 240 (stop every run at 4:00: early-game experiments)
 *   --heroes hoshi,rin,kuro  --dt 0.0333  --maxE 250  --workers 4  --name after (-> tools/results/matrix-after.json + .md)
 *   --by hero (one row per hero too)  --log (a line per run)  --stats (keep each run's RunStats: economy fitting)
 *   --variants sweep.json  (a JSON {name: patch}: every job runs once per variant, "" = no patch;
 *                           patch paths: tools/matrix.sim.ts applyPatch, e.g. {"cfg.playerHp": 80};
 *                           "_only": ["final_arc"] limits a variant to those stages)
 *
 * Stage aliases: dm, candy, academy, beach, final (or the ids).
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGES = { dm: "dream_meadow", candy: "candy_kingdom", academy: "shoujo_academy", beach: "beach_episode", final: "final_arc" };
const STAGE_ORDER = ["dream_meadow", "candy_kingdom", "shoujo_academy", "beach_episode", "final_arc"];
const SHORT = { dream_meadow: "dm", candy_kingdom: "candy", shoujo_academy: "academy", beach_episode: "beach", final_arc: "final" };
const DURATION = { dream_meadow: 600, candy_kingdom: 720, shoujo_academy: 840, beach_episode: 960, final_arc: 1200 };
const CPS = ["P0", "P1", "P1b", "P2", "P3", "P4", "P5", "P6", "P7", "P7r"];

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}
const list = (v, all) => (v === undefined || v === "all" ? all : String(v).split(",").filter(Boolean));
function seeds(v) {
  const out = [];
  for (const part of String(v).split(",")) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) for (let s = +m[1]; s <= +m[2]; s++) out.push(s);
    else if (part) out.push(+part);
  }
  return out;
}
const stageId = (s) => STAGES[s] ?? s;

const heroes = list(arg("heroes"), ["hoshi", "rin", "kuro"]);
const bots = list(arg("bot"), ["mid"]);
const seedList = seeds(arg("seeds", "1-4"));
const twists = arg("twists");
const dt = arg("dt") ? Number(arg("dt")) : undefined;
const maxE = arg("maxE") ? Number(arg("maxE")) : undefined;
const tmax = arg("tmax") ? Number(arg("tmax")) : undefined;
const workers = Number(arg("workers", Math.min(4, cpus().length)));
const name = arg("name");
const byHero = arg("by") === "hero";
const log = !!arg("log");
const variantsFile = arg("variants");
const variants = variantsFile ? JSON.parse(readFileSync(String(variantsFile), "utf8")) : null;
const variantNames = variants ? Object.keys(variants) : [""];

let cells = [];
if (arg("cells")) {
  for (const c of String(arg("cells")).split(",")) {
    const [cp, st] = c.split(":");
    cells.push([cp, stageId(st)]);
  }
} else {
  const cps = list(arg("cp"), CPS);
  const sts = list(arg("stages"), Object.keys(STAGES)).map(stageId);
  for (const cp of cps) for (const st of sts) cells.push([cp, st]);
}

const jobs = [];
for (const [cp, stage] of cells)
  for (const hero of heroes)
    for (const bot of bots)
      for (const seed of seedList)
        for (const variant of variantNames) {
        // a variant with an "_only": [stage ids] list runs on those stages only
        const only = variant ? variants[variant]._only : undefined;
        if (only && !only.includes(stage)) continue;
        const j = { cp, hero, stage, seed, bot };
        if (variant) j.variant = variant;
        if (twists && twists !== true) j.twists = twists;
        if (dt) j.dt = dt;
        if (maxE) j.maxE = maxE;
        if (tmax) j.tmax = tmax;
        jobs.push(j);
      }

// longest-processing-time first onto the least loaded shard
const cost = (j) => DURATION[j.stage] * (1 + CPS.indexOf(j.cp) * 0.6);
const shards = Array.from({ length: Math.max(1, Math.min(workers, jobs.length)) }, () => ({ jobs: [], load: 0 }));
for (const j of [...jobs].sort((a, b) => cost(b) - cost(a))) {
  const s = shards.reduce((a, b) => (b.load < a.load ? b : a));
  s.jobs.push(j);
  s.load += cost(j);
}

const tmp = join(tmpdir(), `kko-matrix-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const t0 = Date.now();
console.log(`matrix: ${cells.length} cells x ${heroes.length} heroes x ${bots.length} bots x ${seedList.length} seeds x ${variantNames.length} variants = ${jobs.length} runs on ${shards.length} workers${twists ? ` twists=${twists}` : ""}`);

const procs = shards.map((s, i) => {
  const jf = join(tmp, `jobs-${i}.json`);
  const of = join(tmp, `out-${i}.json`);
  writeFileSync(jf, JSON.stringify(s.jobs));
  const env = { ...process.env, MATRIX_JOBS: jf, MATRIX_OUT: of };
  if (variants) {
    const vf = join(tmp, "variants.json");
    writeFileSync(vf, JSON.stringify(variants));
    env.MATRIX_VARIANTS = vf;
  }
  if (log) env.MATRIX_LOG = "1";
  if (arg("stats")) env.MATRIX_STATS = "1";
  const p = spawn(process.execPath, [join(ROOT, "node_modules/vitest/vitest.mjs"), "run", "--config", "tools/matrix.vitest.config.ts", "--root", ".", "--fsModuleCache=false", "--disableConsoleIntercept"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", log ? "inherit" : "ignore", "inherit"],
  });
  return { p, of, n: s.jobs.length, done: new Promise((res) => p.on("exit", (code) => res(code))) };
});
const read = (f) => {
  try {
    return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
  } catch {
    return [];
  }
};
const timer = setInterval(() => {
  const n = procs.reduce((a, p) => a + read(p.of).length, 0);
  process.stderr.write(`  ${n}/${jobs.length} runs, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}, 30000);
const codes = await Promise.all(procs.map((p) => p.done));
clearInterval(timer);
const runs = procs.flatMap((p) => read(p.of));
rmSync(tmp, { recursive: true, force: true });
if (codes.some((c) => c !== 0)) console.log(`(worker exit codes ${codes.join(",")})`);

// ---------------------------------------------------------------- summary
const med = (a) => {
  const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length & 1 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const q = (a, f) => {
  const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  return v.length ? v[Math.min(v.length - 1, Math.floor(f * v.length))] : NaN;
};
const mmss = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "-");
const f0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : "-");
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "-");
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "-");

function summarize(rs) {
  const n = rs.length;
  const clears = rs.filter((r) => r.outcome === "clear").length;
  const deaths = rs.filter((r) => r.outcome === "death");
  const bossIds = [];
  for (const r of rs) for (const b of r.bosses) if (!bossIds.includes(b.id)) bossIds.push(b.id);
  const bosses = bossIds.map((id) => {
    const fights = rs.map((r) => r.bosses.find((b) => b.id === id)).filter(Boolean);
    const kills = fights.filter((b) => b.dur >= 0);
    return { id, reach: fights.length, kills: kills.length, dur: med(kills.map((b) => b.dur)), lo: q(kills.map((b) => b.dur), 0.25), hi: q(kills.map((b) => b.dur), 0.75) };
  });
  const at = (i) => med(rs.map((r) => r.lv[i]).filter((x) => x > 0));
  return {
    n,
    clear: clears,
    deathMed: med(deaths.map((r) => r.end)),
    deathLo: q(deaths.map((r) => r.end), 0.25),
    deathHi: q(deaths.map((r) => r.end), 0.75),
    timeouts: rs.filter((r) => r.outcome === "timeout").length,
    errors: rs.filter((r) => r.outcome === "error").length,
    bosses,
    first: med(rs.map((r) => r.first)),
    gapEarly: med(rs.map((r) => r.gapEarly)),
    gapEarlyMax: med(rs.map((r) => r.gapEarlyMax)),
    gapMax: med(rs.map((r) => r.gapMax)),
    gapMaxAt: med(rs.map((r) => r.gapMaxAt)),
    lv: [at(0), at(1), at(2), at(3), at(4)],
    hp90: med(rs.map((r) => r.hp[1])),
    hp120: med(rs.map((r) => r.hp[2])),
    dmgA: med(rs.map((r) => r.dmg30[0] + r.dmg30[1] + r.dmg30[2])),
    dmgB: med(rs.map((r) => r.dmg30[3] + r.dmg30[4] + r.dmg30[5])),
    kps: [0, 1, 2].map((i) => med(rs.map((r) => r.kps[i]))),
    alive: [0, 1, 2].map((i) => med(rs.map((r) => r.alive[i]))),
    revives: rs.reduce((a, r) => a + r.revives, 0),
    killers: Object.entries(deaths.reduce((m, r) => ((m[r.killer] = (m[r.killer] ?? 0) + 1), m), {}))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}x${v}`)
      .join(" "),
    ms: med(rs.map((r) => r.ms)),
  };
}

const groups = new Map();
const keyOf = (r, hero) => `${r.cp}|${r.stage}|${r.bot}|${r.twists}|${r.variant ?? ""}${hero ? `|${r.hero}` : ""}`;
for (const r of runs) {
  for (const k of byHero ? [keyOf(r), keyOf(r, true)] : [keyOf(r)]) {
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
}
const keys = [...groups.keys()].sort((a, b) => {
  const [ca, sa] = a.split("|");
  const [cb, sb] = b.split("|");
  return STAGE_ORDER.indexOf(sa) - STAGE_ORDER.indexOf(sb) || CPS.indexOf(ca) - CPS.indexOf(cb) || (a < b ? -1 : 1);
});

const lines = [];
const out = (s) => {
  console.log(s);
  lines.push(s);
};
out(`| cell | n | clear | death (p25-p75) | bosses: fight s median [p25-p75] (killed/reached) | 1st lv | gap 0:20-3:00 (max) | gap max | lv 1/2/3/5/10 min | hp 1:30 / 2:00 | dmg 0-1:30 / 1:30-3:00 | kills/s m1-3 | alive m1-3 | deaths by | ms |`);
out(`| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`);
for (const k of keys) {
  const s = summarize(groups.get(k));
  const [cp, stage, bot, tw, variant, hero] = k.split("|");
  const label = `${cp} ${SHORT[stage] ?? stage}${bot !== "mid" ? ` ${bot}` : ""}${tw ? ` ${tw}` : ""}${variant ? ` [${variant}]` : ""}${hero ? ` ${hero}` : ""}`;
  const bs = s.bosses.map((b) => `${b.id.replace(/_/g, " ")} ${f0(b.dur)} [${f0(b.lo)}-${f0(b.hi)}] (${b.kills}/${b.reach})`).join("; ");
  out(
    `| ${label} | ${s.n} | ${pct(s.clear, s.n)}${s.timeouts ? ` (+${s.timeouts} t/o)` : ""}${s.errors ? ` (${s.errors} CRASHED)` : ""} | ${mmss(s.deathMed)} (${mmss(s.deathLo)}-${mmss(s.deathHi)}) | ${bs || "-"} | ${f1(s.first)} | ${f1(s.gapEarly)} (${f0(s.gapEarlyMax)}) | ${f0(s.gapMax)} @${mmss(s.gapMaxAt)} | ${s.lv.map(f0).join("/")} | ${f0(s.hp90 * 100)}% / ${f0(s.hp120 * 100)}% | ${f0(s.dmgA)} / ${f0(s.dmgB)} | ${s.kps.map(f1).join("/")} | ${s.alive.map(f0).join("/")} | ${s.killers || "-"} | ${f0(s.ms)} |`,
  );
}
console.log(`\n${runs.length} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (name && name !== true) {
  const dir = join(ROOT, "tools/results");
  mkdirSync(dir, { recursive: true });
  const meta = { name, date: new Date().toISOString(), cells, heroes, bots, seeds: seedList, twists: twists ?? null, variants, dt: dt ?? 1 / 30, maxE: maxE ?? 250 };
  writeFileSync(join(dir, `matrix-${name}.json`), JSON.stringify({ meta, runs }));
  writeFileSync(join(dir, `matrix-${name}.md`), `# Matrix ${name}\n\n\`${process.argv.slice(2).join(" ")}\` (${meta.date.slice(0, 10)}, dt ${meta.dt.toFixed(4)}, ${runs.length} runs)\n\n${lines.join("\n")}\n`);
  console.log(`wrote tools/results/matrix-${name}.json / .md`);
}
