// npm run doctor: every cheap gate in one command, in parallel, with one pass / fail table (docs/DEVTOOLS.md §7).
// Run it before every commit; it replaces "typecheck, then npm test, then remember the rest".
//
//   npm run doctor                     typecheck, fast tests, sprite validation, CSS collision lint, audio (cost
//                                      budget, lite shape, device profiles, Android focus), production bundle
//                                      budget, artifact CSP boot (~25 s on 4 cores)
//   npm run doctor -- --scenes         + the quick scene gallery (11 key screens, Kuro's ult filmed; ~35 s)
//   npm run doctor -- --all            + --scenes, and the whole test suite (slow tests included) instead of the fast one
//   npm run doctor -- --slow           + the slow tests alone (next to the fast ones)
//   npm run doctor -- --only lint:css,tests    /  --skip artifact,bundle
//   npm run doctor -- --json           machine-readable summary on stdout (also written to shots/doctor/summary.json)
//   npm run doctor -- --jobs 3         how many checks run at once (default: cores, max 4)
//
// Each check is its own process; full output goes to shots/doctor/<check>.log and the table shows its one-line
// result. Exit code 1 when any check fails.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOGS = join(ROOT, "shots/doctor");

const last = (re) => (out) => {
  const m = [...out.matchAll(re)].pop();
  return m ? m[0].trim() : "";
};
/**
 * The checks. They start longest first (`est`, seconds under doctor's own load); `summary(out)` pulls the one-line
 * result from the log; `opt` = only with that flag, `unless` = not with that flag; `alone(out)` = this failure may
 * be doctor's own load (a real-time cost budget): the check runs again by itself once the others are done, and
 * that run decides.
 */
export const CHECKS = [
  {
    id: "tests:all",
    label: "unit tests (all, incl. slow)",
    opt: "all",
    est: 50,
    cmd: ["npx", "vitest", "run", "--fsModuleCache=false"],
    summary: (out) => /Tests\s+([^\n]+)/.exec(out)?.[1]?.trim() ?? "",
  },
  {
    id: "tests",
    label: "unit tests (fast)",
    unless: "all",
    est: 20,
    cmd: ["npx", "vitest", "run", "--tags-filter=!slow"],
    summary: (out) => {
      const t = /Tests\s+([^\n]+)/.exec(out)?.[1]?.trim() ?? "";
      const f = /Test Files\s+([^\n]+)/.exec(out)?.[1]?.trim() ?? "";
      return [t, f && `files ${f}`].filter(Boolean).join(" | ");
    },
  },
  { id: "artifact", est: 19, label: "artifact CSP boot", cmd: ["node", "scripts/check-artifact.mjs"], summary: (out) => [last(/^page .*$/gm)(out).replace(/\| hub:mid.*$/, ""), last(/^CSP violations.*$/gm)(out)].filter(Boolean).join(" | ") },
  {
    id: "audio",
    est: 20,
    label: "audio cost + devices",
    cmd: ["node", "scripts/check-audio.mjs"],
    // (render speed vs real time: at doctor's load average 9-16 on 4 cores a cost budget can fail that passes alone)
    alone: (out) => /^problems:[\s\S]*load average [\d.]+: other work was running/m.test(out) && !/^FAIL\s+(device\.|lite\.shape)/m.test(out),
    summary: (out) => {
      const cost = [...out.matchAll(/^(ok|FAIL)\s+(lite|full)\.(\S+)\s+([\d.]+x)/gm)].map((m) => `${m[2]}.${m[3]} ${m[4]}`).join(", ");
      const shape = /^(ok|FAIL)\s+lite\.shape/m.exec(out)?.[1];
      const dev = [...out.matchAll(/^(ok|FAIL)\s+device\.(\S+)/gm)];
      return [cost, shape && `shape ${shape}`, dev.length && `devices ${dev.filter((m) => m[1] === "ok").length}/${dev.length} ok (profile + Android focus)`].filter(Boolean).join(" | ");
    },
  },
  { id: "sprites", est: 5, label: "sprite validation", cmd: ["node", "scripts/sprites.mjs", "--validate"], summary: last(/^sprites registered.*$/gm) },
  { id: "bundle", est: 13, label: "bundle budget", cmd: ["node", "scripts/check-bundle.mjs"], summary: (out) => last(/^main chunk.*$/gm)(out).replace(/^main chunk \S+ /, "main ") },
  { id: "typecheck", est: 5, label: "typecheck", cmd: ["npx", "tsc", "--noEmit"], summary: (out) => ((out.match(/error TS/g) ?? []).length ? `${(out.match(/error TS/g) ?? []).length} type errors` : "clean") },
  { id: "lint:css", est: 2, label: "CSS collision lint", cmd: ["node", "scripts/lint-css.mjs"], summary: (out) => last(/^lint:css .*$/gm)(out).replace(/^lint:css (ok|FAIL): /, "").replace(/ \| \d+ sheets.*class uses in TS/, "") },
  { id: "scenes", est: 22, label: "scene gallery (quick)", opt: "scenes", cmd: ["node", "scripts/scenes.mjs", "--quick", "--jobs", "2", "--out", "shots/doctor/scenes"], summary: (out) => last(/^scenes (ok|FAIL).*$/gm)(out).replace(/^scenes (ok|FAIL): /, "") },
  {
    id: "tests:slow",
    label: "unit tests (slow)",
    opt: "slow",
    est: 45,
    cmd: ["npx", "vitest", "run", "--tags-filter=slow", "--fsModuleCache=false"],
    summary: (out) => /Tests\s+([^\n]+)/.exec(out)?.[1]?.trim() ?? "",
  },
];

function run(check) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(check.cmd[0], check.cmd.slice(1), { cwd: ROOT, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), Number(check.timeout ?? 300_000));
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      out = out.replace(/\x1b\[[0-9;]*m/g, "");
      writeFileSync(join(LOGS, `${check.id.replace(/[:]/g, "-")}.log`), out);
      let summary = "";
      try {
        summary = check.summary(out);
      } catch {
        /* keep the tail */
      }
      const ok = code === 0;
      if (!ok && !summary) summary = out.trim().split("\n").slice(-1)[0] ?? "";
      resolve({ id: check.id, label: check.label, ok, code, signal, ms: Date.now() - t0, summary: summary.slice(0, 150), tail: ok ? undefined : out.trim().split("\n").slice(-12).join("\n"), out: ok ? undefined : out });
    });
  });
}

export async function doctor(args = {}) {
  const T0 = Date.now();
  mkdirSync(LOGS, { recursive: true });
  const only = args.only && args.only !== true ? String(args.only).split(",") : null;
  const skip = args.skip && args.skip !== true ? String(args.skip).split(",") : [];
  const on = (c) => (only ? only.includes(c.id) : (!c.opt || args[c.opt] || (c.opt === "scenes" && args.all)) && !(c.unless && args[c.unless]));
  // longest first, so the critical path is the longest check rather than the sum of the last ones
  const want = CHECKS.filter((c) => on(c) && !skip.includes(c.id)).sort((a, b) => (b.est ?? 0) - (a.est ?? 0));
  const jobs = Math.max(1, Number(args.jobs ?? Math.min(4, availableParallelism())));
  const results = [];
  const queue = [...want];
  const running = new Set();
  const tick = () => {
    if (args.json || !process.stdout.isTTY) return;
    const r = [...running].map((c) => c.id).join(", ");
    process.stdout.write(`\r  ${results.length}/${want.length} done${r ? ` | running: ${r}` : ""}`.padEnd(100).slice(0, 110));
  };
  const ticker = setInterval(tick, 1000);
  await Promise.all(
    Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        running.add(c);
        tick();
        const r = await run(c);
        running.delete(c);
        results.push(r);
        tick();
      }
    }),
  );
  clearInterval(ticker);
  // a load-sensitive check that failed under doctor's own load runs again alone, on a quiet machine
  for (let i = 0; i < results.length; i++) {
    const c = want.find((x) => x.id === results[i].id);
    if (results[i].ok || !c?.alone || !c.alone(results[i].out)) continue;
    running.add(c);
    tick();
    const r = await run(c);
    running.delete(c);
    r.summary = `rerun alone (failed under load first): ${r.summary}`.slice(0, 150);
    r.ms += results[i].ms;
    results[i] = r;
  }
  for (const r of results) delete r.out;
  if (!args.json && process.stdout.isTTY) process.stdout.write("\r".padEnd(110) + "\r");
  results.sort((a, b) => want.findIndex((c) => c.id === a.id) - want.findIndex((c) => c.id === b.id));
  const summary = { ok: results.every((r) => r.ok), ms: Date.now() - T0, jobs, checks: results, logs: "shots/doctor/" };
  writeFileSync(join(LOGS, "summary.json"), JSON.stringify(summary, null, 1));
  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs();
  const s = await doctor(args);
  if (args.json) console.log(JSON.stringify(s, null, 1));
  else {
    const w = Math.max(...s.checks.map((c) => c.label.length));
    console.log(`${"check".padEnd(w)}  result  ${"time".padStart(6)}  details`);
    for (const c of s.checks) console.log(`${c.label.padEnd(w)}  ${c.ok ? "ok    " : "FAIL  "}  ${((c.ms / 1000).toFixed(1) + " s").padStart(6)}  ${c.summary}`);
    for (const c of s.checks.filter((x) => !x.ok)) console.log(`\n--- ${c.label} (exit ${c.code ?? c.signal}; full log shots/doctor/${c.id.replace(/[:]/g, "-")}.log)\n${c.tail}`);
    const sum = s.checks.reduce((a, c) => a + c.ms, 0);
    console.log(`\ndoctor ${s.ok ? "ok" : "FAIL"} in ${(s.ms / 1000).toFixed(1)} s (${s.checks.length} checks, ${(sum / 1000).toFixed(0)} s of work on ${s.jobs} lanes) | logs: shots/doctor/`);
  }
  process.exit(s.ok ? 0 : 1);
}
