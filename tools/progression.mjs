#!/usr/bin/env node
/**
 * Account-progression report (docs/META.md §9, EXPANSION §2 / §13): runs the
 * progression simulator (tools/progression.sim.ts, one account per process)
 * for bots x seeds in parallel (one process per CPU) and aggregates them:
 * hours / runs to every milestone (median [min-max] per bot, weak / strong vs
 * mid), the checkpoint snapshots against META.md §9.1, income per phase,
 * the "something to buy" hook and the longest dead zones, gacha pacing and
 * the unlock timeline.
 *
 *   node tools/progression.mjs                                  # weak,mid,strong x seeds 1-2, 60 h
 *   node tools/progression.mjs --bots weak,mid,strong --seeds 1-2 --hours 160 --stride 6 --name after   # ~75 min
 *   node tools/progression.mjs --report tools/results/progression-after.json   # re-print a saved run
 *   --runs 2000 (cap)  --overhead 45  --dt 0.0333  --maxE 250  --workers 4  --stride-from final|<h>  --endgame 0
 *   --farm 0 (the player never farms the last cleared stage after a short frontier death)  --farm-below 0.4
 *   --compare tools/results/progression-before.json (adds a "before" column per bot)
 *   --save-at 25 --save-dir dir (each account dumps itself at 25 h: dir/<bot>-<seed>.json, for RESUME=)
 *   --save-end --save-dir dir (each account dumps itself where it stopped)  --resume-dir dir (continue those dumps:
 *   --hours then counts on top of the saved hours)
 *   --stop-at final|<stage order> (end each account at that stage's first clear: cheap stage-clear sweeps)
 *   --patch sweep.json (or an inline JSON object): a combat tuning patch (tools/patch.ts paths) for every account
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}
function seeds(v) {
  const out = [];
  for (const part of String(v).split(",")) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) for (let s = +m[1]; s <= +m[2]; s++) out.push(s);
    else if (part) out.push(+part);
  }
  return out;
}

const MILESTONE_TARGETS = {
  first_buy: "run 1",
  first_pull: "first hour",
  king_puff: "runs 3-6 (0.5-1 h)",
  clear1: "1.5-3 h",
  clear2: "4-7 h",
  clear3: "8-14 h",
  clear4: "15-25 h",
  clear5: "30-45 h",
  unlocks: "40-60 h",
  board: "100-150 h",
  lv10: "~3 h (P2)",
  lv20: "~15 h (P4)",
  lv30: "~80 h (P6)",
  allLv30: "200 h+",
  mastery5: "~8 h (P3)",
  mastery10: "~80 h (P6)",
  masteryAll: "200 h+",
  heatMax: "200 h+",
};
const MILESTONE_LABELS = {
  first_buy: "First board node",
  first_pull: "First Merch Machine pull",
  king_puff: "First King Puff kill",
  clear1: "Dream Meadow clear",
  clear2: "Candy Kingdom clear",
  clear3: "Shoujo Academy clear",
  clear4: "Beach Episode clear",
  clear5: "Final Arc clear",
  heroes: "All gameplay heroes",
  weapons: "All gameplay weapons",
  passives: "All passives",
  unlocks: "All gameplay heroes + weapons",
  first10: "First 10-pull",
  firstSSR: "First SSR+",
  firstUR: "First UR+",
  firstLR: "First LR+",
  mythic: "First MYTHIC",
  slots4: "4 relic slots",
  ring1: "Board ring 1 done",
  ring2: "Board ring 2 done",
  ring3: "Board ring 3 done",
  ring4: "Board ring 4 done",
  board: "Board fully bought",
  lv10: "Main hero Lv 10",
  lv20: "Main hero Lv 20",
  lv30: "Main hero Lv 30",
  allLv30: "Every gameplay hero Lv 30",
  mastery5: "A weapon mastery 5",
  mastery10: "A weapon mastery 10",
  masteryAll: "Mastery 10 on all 20",
  heat8: "Heat 8 clear",
  heat16: "Heat 16 clear",
  heat32: "Heat 32 clear",
  heatMax: "Max heat (41) clear",
};
/** META.md §9.1 checkpoints (tools/checkpoints.ts, board coins at current ring prices): hours -> what the account should have. */
const CHECKPOINTS = [
  { id: "P1", h: 1, board: 420, lv: 5, sig: 1, other: 0, relics: "-" },
  { id: "P2", h: 3, board: 1862, lv: 10, sig: 3, other: 1, relics: "1 SR" },
  { id: "P3", h: 8, board: 19760, lv: 15, sig: 5, other: 2, relics: "SSR + SR" },
  { id: "P4", h: 15, board: 83760, lv: 20, sig: 7, other: 4, relics: "2 SSR + SR" },
  { id: "P5", h: 30, board: 398760, lv: 25, sig: 8, other: 5, relics: "2 UR + 2 SSR, C1" },
  { id: "P6", h: 80, board: 2298760, lv: 30, sig: 10, other: 7, relics: "LR + UR + 2 SSR, C2" },
  { id: "P7", h: 150, board: 4854242, lv: 30, sig: 10, other: 10, relics: "MYTHIC + LR + UR + SSR, C4" },
];
const PHASES = [
  [0, 1],
  [1, 3],
  [3, 8],
  [8, 15],
  [15, 30],
  [30, 80],
  [80, 150],
  [150, 1e9],
];

// ---------------------------------------------------------------- run or load
let results;
const reportFile = arg("report");
if (reportFile && reportFile !== true) {
  results = JSON.parse(readFileSync(String(reportFile), "utf8"));
} else {
  const bots = String(arg("bots", "weak,mid,strong")).split(",").filter(Boolean);
  const seedList = seeds(arg("seeds", "1-2"));
  const hours = Number(arg("hours", 60));
  const runs = Number(arg("runs", 5000));
  const workers = Number(arg("workers", Math.min(4, cpus().length)));
  const extraEnv = {
    OVERHEAD: arg("overhead"),
    DT: arg("dt"),
    MAXE: arg("maxE"),
    STRIDE: arg("stride"),
    STRIDE_FROM: arg("stride-from"),
    ENDGAME: arg("endgame"),
    FARM: arg("farm"),
    FARM_BELOW: arg("farm-below"),
    PATCH: arg("patch"),
    STOP_AT: arg("stop-at"),
  };
  const tmp = join(tmpdir(), `kko-prog-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const jobs = [];
  // slow bots first (longest runs), so the pool drains evenly
  const order = { strong: 0, good: 1, mid: 2, weak: 3, lazy: 3 };
  for (const bot of [...bots].sort((a, b) => (order[a] ?? 2) - (order[b] ?? 2))) for (const seed of seedList) jobs.push({ bot, seed, out: join(tmp, `${bot}-${seed}.json`) });
  const t0 = Date.now();
  console.log(`progression: ${bots.join(",")} x seeds ${seedList.join(",")} = ${jobs.length} accounts, ${hours} h each, ${workers} workers`);
  let next = 0;
  let done = 0;
  const runOne = (j) =>
    new Promise((res) => {
      const env = { ...process.env, BOT: j.bot, SEED: String(j.seed), HOURS: String(hours), RUNS: String(runs), OUT: j.out, QUIET: "1" };
      const resumeDir = arg("resume-dir");
      if (resumeDir && resumeDir !== true) env.RESUME = join(String(resumeDir), `${j.bot}-${j.seed}.json`);
      if (arg("save-end")) {
        const dir = String(arg("save-dir", join(tmpdir(), "kko-saves")));
        mkdirSync(dir, { recursive: true });
        env.SAVE_END = "1";
        env.SAVE_TO = join(dir, `${j.bot}-${j.seed}.json`);
      }
      const saveAt = arg("save-at");
      if (saveAt && saveAt !== true) {
        const dir = String(arg("save-dir", join(tmpdir(), "kko-saves")));
        mkdirSync(dir, { recursive: true });
        env.SAVE_AT = String(saveAt);
        env.SAVE_TO = join(dir, `${j.bot}-${j.seed}.json`);
      }
      for (const [k, v] of Object.entries(extraEnv)) if (v !== undefined && v !== true) env[k] = String(v);
      const p = spawn(process.execPath, [join(ROOT, "node_modules/vitest/vitest.mjs"), "run", "--config", "tools/progression.vitest.config.ts", "--root", ".", "--fsModuleCache=false", "--disableConsoleIntercept"], {
        cwd: ROOT,
        env,
        stdio: ["ignore", "ignore", "inherit"],
      });
      p.on("exit", (code) => {
        done++;
        process.stderr.write(`  ${j.bot} seed ${j.seed} done (exit ${code}) ${done}/${jobs.length}, ${((Date.now() - t0) / 60000).toFixed(1)} min\n`);
        res(code);
      });
    });
  const lane = async () => {
    while (next < jobs.length) await runOne(jobs[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(workers, jobs.length) }, lane));
  results = {
    meta: { date: new Date().toISOString(), bots, seeds: seedList, hours, args: process.argv.slice(2).join(" "), minutes: (Date.now() - t0) / 60000 },
    accounts: jobs.filter((j) => existsSync(j.out)).map((j) => JSON.parse(readFileSync(j.out, "utf8"))),
  };
  rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------- aggregate
const med = (a) => {
  const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length & 1 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const fh = (h) => (Number.isFinite(h) ? (h < 10 ? h.toFixed(2) : h.toFixed(1)) : "-");
const fk = (n) => (!Number.isFinite(n) ? "-" : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(0)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "-");

const byBot = new Map();
for (const a of results.accounts) {
  if (!byBot.has(a.bot)) byBot.set(a.bot, []);
  byBot.get(a.bot).push(a);
}
const botOrder = ["weak", "lazy", "mid", "good", "strong"].filter((b) => byBot.has(b));
const compare = arg("compare") && arg("compare") !== true ? JSON.parse(readFileSync(String(arg("compare")), "utf8")) : null;
const cmpBy = new Map();
if (compare) for (const a of compare.accounts) (cmpBy.get(a.bot) ?? cmpBy.set(a.bot, []).get(a.bot)).push(a);

const lines = [];
const out = (s = "") => {
  console.log(s);
  lines.push(s);
};

function milestoneCell(accs, id) {
  const hs = accs.map((a) => a.milestones[id]?.hours ?? NaN);
  const rs = accs.map((a) => a.milestones[id]?.run ?? NaN);
  const got = hs.filter(Number.isFinite);
  if (!got.length) return { h: NaN, txt: `not reached (${fh(med(accs.map((a) => a.hours)))} h played)` };
  const lo = Math.min(...got);
  const hi = Math.max(...got);
  const miss = accs.length - got.length;
  return { h: med(hs), txt: `${fh(med(got))} h (run ${Math.round(med(rs.filter(Number.isFinite)))})${accs.length > 1 ? ` [${fh(lo)}-${fh(hi)}]` : ""}${miss ? ` +${miss} n/r` : ""}` };
}

out(`## Milestones (median hours (run) [min-max] over ${results.meta.seeds.length} seeds; ${results.meta.args || ""})`);
out("");
const cols = botOrder.flatMap((b) => (compare && cmpBy.has(b) ? [`${b} before`, `${b}`] : [b]));
out(`| Milestone | Target | ${cols.join(" | ")} |`);
out(`| --- | --- | ${cols.map(() => "---").join(" | ")} |`);
const ids = Object.keys(MILESTONE_LABELS);
for (const id of ids) {
  const cells = botOrder.flatMap((b) => {
    const now = milestoneCell(byBot.get(b), id).txt;
    return compare && cmpBy.has(b) ? [milestoneCell(cmpBy.get(b), id).txt, now] : [now];
  });
  out(`| ${MILESTONE_LABELS[id]} | ${MILESTONE_TARGETS[id] ?? "-"} | ${cells.join(" | ")} |`);
}
// pace ratios vs mid (stage clears + unlocks + board rings)
if (byBot.has("mid")) {
  const rIds = ["clear1", "clear2", "clear3", "clear4", "clear5", "ring2", "ring3", "ring4", "board"];
  out("");
  out("Pace vs mid (median hours ratio per milestone; targets: weak ~1.5-2x, strong ~0.6x):");
  for (const b of botOrder.filter((x) => x !== "mid")) {
    const rs = rIds.map((id) => ({ id, r: milestoneCell(byBot.get(b), id).h / milestoneCell(byBot.get("mid"), id).h })).filter((x) => Number.isFinite(x.r));
    out(`- ${b}: ${rs.map((x) => `${x.id} x${x.r.toFixed(2)}`).join(", ")} (median x${med(rs.map((x) => x.r)).toFixed(2)})`);
  }
}

// ---- checkpoint snapshots
out("");
out("## Checkpoint snapshots (median over seeds) vs META.md §9.1");
for (const b of botOrder) {
  out("");
  out(`**${b}**`);
  out("");
  out("| Hours | Contract | Board coins | Hero Lv | Mastery sig / best other | Relics equipped (slots) | Const. | Pulls | Clears |");
  out("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const cp of CHECKPOINTS) {
    const sn = byBot
      .get(b)
      .map((a) => a.snaps.find((s) => s.h === cp.h))
      .filter(Boolean);
    if (!sn.length) continue;
    const first = sn[Math.floor(sn.length / 2)] ?? sn[0];
    out(
      `| ${cp.h} h | ${cp.id}: ${fk(cp.board)}, Lv ${cp.lv}, M ${cp.sig}/${cp.other}, ${cp.relics} | ${fk(med(sn.map((s) => s.board)))} | ${med(sn.map((s) => s.lv))} | ${med(sn.map((s) => s.sig))} / ${med(sn.map((s) => s.best))} | ${first.relics.join(" ") || "-"} (${first.slots}) | C${med(sn.map((s) => s.constellation))} | ${med(sn.map((s) => s.pulls))} | ${first.clears.join("/")} |`,
    );
  }
}

// ---- income per phase
out("");
out("## Income per phase (median over seeds)");
for (const b of botOrder) {
  out("");
  out(`**${b}**`);
  out("");
  out("| Phase | Runs/h | Avg run | Coins/run | Coins/h | Gems/h | 10-pulls/h | Runs per 10-pull | Hero XP/h | Main stage |");
  out("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const [lo, hi] of PHASES) {
    const rows = byBot.get(b).map((a) => {
      const ls = a.logs.filter((l) => l.h > lo && l.h <= hi);
      if (ls.length < 2) return null;
      const span = Math.min(hi, ls[ls.length - 1].h) - Math.max(lo, ls[0].h - (ls[0].t + 45) / 3600);
      const coins = ls.reduce((s, l) => s + l.coins + (l.achCoins ?? 0), 0);
      const gems = ls.reduce((s, l) => s + l.gems, 0);
      const pulls = ls.reduce((s, l) => s + (l.newPulls ?? 0), 0);
      const xp = ls.reduce((s, l) => s + l.hxp, 0);
      const st = {};
      for (const l of ls) st[l.stage] = (st[l.stage] ?? 0) + 1;
      const main = Object.entries(st).sort((x, y) => y[1] - x[1])[0][0];
      return { rph: ls.length / span, avg: ls.reduce((s, l) => s + l.t, 0) / ls.length, cpr: coins / ls.length, cph: coins / span, gph: gems / span, pph: pulls / 10 / span, rpp: pulls > 0 ? ls.length / (pulls / 10) : NaN, xph: xp / span, main };
    }).filter(Boolean);
    if (!rows.length) continue;
    const m = (k) => med(rows.map((r) => r[k]));
    out(`| ${lo}-${hi >= 1e9 ? "end" : hi} h | ${m("rph").toFixed(1)} | ${Math.floor(m("avg") / 60)}:${String(Math.round(m("avg") % 60)).padStart(2, "0")} | ${fk(m("cpr"))} | ${fk(m("cph"))} | ${fk(m("gph"))} | ${m("pph").toFixed(2)} | ${fh(m("rpp"))} | ${fk(m("xph"))} | ${rows[0].main.replace(/_/g, " ")} |`);
  }
}

// ---- the hook: something to buy after every run, dead zones
out("");
out("## The incremental hook (first 10 h) and dead zones (whole run)");
out("");
out("| Bot | Runs 0-10 h | Payout covers cheapest open node | Something affordable on Results | Run bought a node | Longest gap w/o a board buy, 0-10 h | Longest gap w/o a board buy (until the board is full) | Longest gap w/o any progress event (all) |");
out("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const b of botOrder) {
  const per = byBot.get(b).map((a) => {
    const early = a.logs.filter((l) => l.h <= 10);
    const gap = (ls, ev) => {
      let best = { runs: 0, h: 0, at: 0 };
      let start = null;
      let n = 0;
      for (const l of ls) {
        if (ev(l)) {
          start = l.h;
          n = 0;
        } else {
          n++;
          const h = start === null ? l.h : l.h - start;
          if (h > best.h) best = { runs: n, h, at: l.h };
        }
      }
      return best;
    };
    const buy = (l) => l.bought > 0;
    const prog = (l) => l.bought > 0 || l.unlocks.length > 0 || (l.newPulls ?? 0) > 0 || (l.lvUp ?? 0) > 0 || (l.lvBought ?? 0) > 0;
    // (no board buys once the whole board is bought: that is the end of the board, not a dead zone)
    const full = a.milestones.board?.hours ?? Infinity;
    const open = a.logs.filter((l) => l.h <= full);
    return {
      n: early.length,
      pay: early.filter((l) => l.payBuys).length / Math.max(1, early.filter((l) => l.cheap !== null).length),
      aff: early.filter((l) => l.afford).length / Math.max(1, early.length),
      bought: early.filter(buy).length / Math.max(1, early.length),
      gEarly: gap(early, buy),
      gAll: gap(open, buy),
      gProg: gap(a.logs, prog),
    };
  });
  const worst = (k) => per.reduce((x, y) => (y[k].h > x[k].h ? y : x))[k];
  const g = (x) => `${fh(x.h)} h / ${x.runs} runs (at ${fh(x.at)} h)`;
  out(`| ${b} | ${med(per.map((x) => x.n))} | ${pct(med(per.map((x) => x.pay)) * 100, 100)} | ${pct(med(per.map((x) => x.aff)) * 100, 100)} | ${pct(med(per.map((x) => x.bought)) * 100, 100)} | ${g(worst("gEarly"))} | ${g(worst("gAll"))} | ${g(worst("gProg"))} |`);
}
out("");
out("(\"Payout covers\": the run's coin payout alone buys the cheapest node that was open before it; gaps are the worst seed; a progress event = a board buy, an unlock, a pull or a hero level-up, earned or bought.)");

// ---- first hour detail (mid)
for (const b of botOrder.filter((x) => x === "mid" || botOrder.length === 1)) {
  const a = byBot.get(b)[0];
  out("");
  out(`## First 12 runs (${b}, seed ${a.seed})`);
  out("");
  out("| Run | h | Stage | Result | Time | Kills | Coins | Gems | Bought | Board | Pulls | New |");
  out("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const l of a.logs.slice(0, 12)) out(`| ${l.run} | ${fh(l.h)} | ${l.stage.replace(/_/g, " ")} | ${l.out} | ${Math.floor(l.t / 60)}:${String(l.t % 60).padStart(2, "0")} | ${l.kills} | ${l.coins} | ${l.gems} | ${l.bought} (${l.spent}) | ${l.board} | ${l.pulls} | ${l.unlocks.join(", ") || "-"} |`);
}

// ---- unlock timeline
out("");
out("## Unlock timeline (median hours; n/r = not reached)");
out("");
const uids = new Set();
for (const a of results.accounts) for (const id of Object.keys(a.unlockAt)) uids.add(id);
const ul = [...uids].map((id) => ({ id, by: botOrder.map((b) => med(byBot.get(b).map((a) => a.unlockAt[id]?.h ?? NaN))) }));
const midI = Math.max(0, botOrder.indexOf("mid"));
ul.sort((x, y) => (Number.isFinite(x.by[midI]) ? x.by[midI] : 1e9) - (Number.isFinite(y.by[midI]) ? y.by[midI] : 1e9));
out(`| Unlock | ${botOrder.join(" | ")} |`);
out(`| --- | ${botOrder.map(() => "---").join(" | ")} |`);
for (const u of ul) out(`| ${u.id} | ${u.by.map(fh).join(" | ")} |`);

out("");
out(`(${results.accounts.length} accounts; ${results.accounts.reduce((s, a) => s + a.runs, 0)} banked runs, ${results.accounts.reduce((s, a) => s + a.realRuns, 0)} simulated; ${(results.meta.minutes ?? 0).toFixed(0)} min wall clock)`);

const name = arg("name");
if (name && name !== true) {
  const dir = join(ROOT, "tools/results");
  mkdirSync(dir, { recursive: true });
  // the saved log keeps what the report needs (no profile dump); --report f.json --name x only re-writes the .md
  if (!reportFile) writeFileSync(join(dir, `progression-${name}.json`), JSON.stringify(results));
  writeFileSync(join(dir, `progression-${name}.md`), `# Progression ${name}\n\n\`node tools/progression.mjs ${results.meta.args}\` (${results.meta.date.slice(0, 10)})\n\n${lines.join("\n")}\n`);
  console.log(`wrote tools/results/progression-${name}.json / .md`);
}
