/**
 * The balance lab's progression sample (jobs.ts `progression`): the REAL progression
 * simulator (tools/progression.sim.ts, same env: BOT, SEED, HOURS, OUT, QUIET) with the
 * lab's what-if overrides (LAB_SET = JSON list of `--set` texts) applied to the live
 * content first. Run by Vitest through tools/balance-lab/vitest.progression.config.ts.
 */
import { applyOverrides, parseOverride } from "./overrides";

const set: string[] = process.env.LAB_SET ? JSON.parse(process.env.LAB_SET) : [];
applyOverrides(set.map(parseOverride));
// (registers the simulator's test with the overrides in place)
await import("../progression.sim");
