/** Balance lab job `progression` (tools/balance-lab/jobs.ts): the real progression simulator under Vitest, with the overrides. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./cache";
import type { ProgressionJob } from "./jobs";
import type { Override } from "./overrides";

export function runProgression(j: ProgressionJob, set: readonly Override[]): unknown {
  const root = ROOT;
  const dir = mkdtempSync(join(tmpdir(), "kk-lab-prog-"));
  const out = join(dir, "out.json");
  try {
    const r = spawnSync(process.execPath, [join(root, "node_modules/vitest/vitest.mjs"), "run", "--config", "tools/balance-lab/vitest.progression.config.ts", "--root", ".", "--fsModuleCache=false", "--disableConsoleIntercept"], {
      cwd: root,
      env: { ...process.env, BOT: j.bot, SEED: String(j.seed), HOURS: String(j.hours), RUNS: "100000", QUIET: "1", OUT: out, LAB_SET: JSON.stringify(set.map((o) => o.text)) },
      stdio: ["ignore", "ignore", "pipe"],
      maxBuffer: 64 << 20,
    });
    if (r.status !== 0) throw new Error(`progression sample failed (${r.status}): ${String(r.stderr).slice(-1500)}`);
    const o = JSON.parse(readFileSync(out, "utf8"));
    // keep what the report reads (the full log is large)
    return { bot: o.bot, seed: o.seed, hours: o.hours, runs: o.runs, realRuns: o.realRuns, milestones: o.milestones, snaps: o.snaps, logs: o.logs.map((l: Record<string, unknown>) => ({ run: l.run, h: l.h, stage: l.stage, out: l.out, t: l.t, coins: l.coins, gems: l.gems, board: l.board, bought: l.bought, cheap: l.cheap, payBuys: l.payBuys, lv: l.lv })), wallClock: o.wallClock };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

