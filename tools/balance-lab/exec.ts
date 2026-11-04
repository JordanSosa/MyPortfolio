/**
 * Job execution for the balance lab: cache keys (what each job depends on), cache lookups,
 * the worker pool for the misses, progress on stderr.
 */
import { cpus } from "node:os";
import { CHECKPOINTS, checkpointRun } from "../checkpoints";
import { cacheGet, cachePut, sha } from "./cache";
import { engineHash, idsHash, metaHash, runFingerprint, stageHash, stageIds } from "./deps";
import type { Job } from "./jobs";
import { cpId, relevant, type Override } from "./overrides";
import { runPool, setPoolSize, type PoolTask } from "./pool";
import { WEAPONS } from "../../src/game/registry";

/** Bump when a job's measurement code changes in a way the file hashes would not catch. */
const JOB_VERSION = 3;

export interface Exec {
  workers: number;
  fresh: boolean;
  quiet: boolean;
  /** Totals for the report: jobs, cache hits, CPU ms of the misses, wall ms. */
  stats: { jobs: number; hits: number; cpuMs: number; wallMs: number; byKind: Record<string, { n: number; hits: number; ms: number }> };
}

export function makeExec(workers = Math.min(4, cpus().length), fresh = false, quiet = false): Exec {
  setPoolSize(workers);
  return { workers, fresh, quiet, stats: { jobs: 0, hits: 0, cpuMs: 0, wallMs: 0, byKind: {} } };
}

const fpCache = new Map<string, string>();
/** RunConfig fingerprint of a cell under the current overrides (see deps.runFingerprint). */
function fingerprint(cp: string, hero: string, stage: string, twists: unknown, setTag: string): string {
  const k = `${cp}|${hero}|${stage}|${JSON.stringify(twists ?? null)}|${setTag}`;
  let f = fpCache.get(k);
  if (!f) {
    f = runFingerprint(checkpointRun(cpId(cp), { hero, stage, twists: twists as string | Record<string, number> | undefined }).config);
    fpCache.set(k, f);
  }
  return f;
}

const GAUGE_DUMMIES = ["puff", "king_puff"];

/** The weapon ids a gauge job measures (with their evolution / base, for override relevance). */
function gaugeWeapons(job: Extract<Job, { kind: "gauge" }>): Set<string> {
  const out = new Set<string>();
  for (const [id] of job.weapons) {
    out.add(id);
    const d = WEAPONS.get(id);
    if (d?.evolution) out.add(d.evolution.into);
    for (const w of WEAPONS.values()) if (w.evolution?.into === id) out.add(w.id);
  }
  return out;
}

/** The cache key of a job under the overrides `set` (only the overrides that touch it count). */
export function jobKey(job: Job, set: readonly Override[]): string {
  const tag = sha(set.map((o) => o.text));
  switch (job.kind) {
    case "progression":
      return sha("v", JOB_VERSION, job, engineHash(job.kind), metaHash(), CHECKPOINTS.length, [...new Set([...stageIdsAll()])].map(stageHash), set.map((o) => o.text));
    case "gauge": {
      const ws = gaugeWeapons(job);
      const rel = set.filter((o) => {
        if (o.path[0] === "weapon") return o.path[1] === "*" || ws.has(o.path[1]);
        // the gauges set their dummies' HP themselves: only the dummies' other fields (speed, size, AI) matter
        if ((o.path[0] === "enemy" || o.path[0] === "boss") && o.path[2] === "hp") return false;
        return relevant(o, null, new Set(GAUGE_DUMMIES));
      });
      const fp = job.cp ? fingerprint(job.cp, job.hero, "dream_meadow", null, tag) : "";
      return sha("v", JOB_VERSION, job, engineHash(job.kind), idsHash(GAUGE_DUMMIES), fp, rel.map((o) => o.text));
    }
    case "path": {
      const rel = set.filter((o) => relevant(o, null, null));
      return sha("v", JOB_VERSION, job, engineHash(job.kind), fingerprint(job.cp, job.hero, "dream_meadow", null, tag), rel.map((o) => o.text));
    }
    case "census": {
      const ids = stageIds(job.stage);
      // (a census counts child spawns per director spawn under a god-mode build: boss HP does not change that)
      const rel = set.filter((o) => relevant(o, job.stage, ids) && !(o.path[0] === "boss" && o.path[2] === "hp"));
      return sha("v", JOB_VERSION, job, engineHash(job.kind), stageHash(job.stage), fingerprint("P6", "hoshi", job.stage, null, tag), rel.map((o) => o.text));
    }
    default: {
      const ids = stageIds(job.stage);
      const rel = set.filter((o) => relevant(o, job.stage, ids));
      return sha("v", JOB_VERSION, job, engineHash(job.kind), stageHash(job.stage), fingerprint(job.cp, job.hero, job.stage, job.twists, tag), rel.map((o) => o.text));
    }
  }
}

function stageIdsAll(): string[] {
  return ["dream_meadow", "candy_kingdom", "shoujo_academy", "beach_episode", "final_arc"];
}

/** Rough relative cost (scheduling: longest first). */
function costOf(job: Job): number {
  const stageMul: Record<string, number> = { dream_meadow: 1, candy_kingdom: 1.4, shoujo_academy: 1.6, beach_episode: 2, final_arc: 3 };
  const cpMul = (cp: string | null) => 1 + Math.max(0, CHECKPOINTS.findIndex((c) => c.id === cp)) * 0.3;
  switch (job.kind) {
    case "progression":
      return 1e6 + job.hours;
    case "gauge":
      return 1 + job.weapons.length * 0.5;
    case "path":
      return 0.5;
    case "window":
      return (job.t1 / 60) * stageMul[job.stage] * cpMul(job.cp);
    case "slice":
      return (job.len / 60) * 1.5 * stageMul[job.stage] * cpMul(job.cp);
    case "boss":
      return 3 * stageMul[job.stage] * cpMul(job.cp);
    case "full":
      return 12 * stageMul[job.stage] * stageMul[job.stage] * cpMul(job.cp);
    case "census":
      return job.at.length * 0.5 * stageMul[job.stage];
  }
}

export interface Done<T = unknown> {
  job: Job;
  result?: T;
  error?: string;
  cached: boolean;
  ms: number;
}

/** Run jobs (cache first, the rest on the pool); results in input order. */
export async function execJobs<T = unknown>(ex: Exec, jobs: Job[], set: Override[], label = "jobs", cachedOnly = false): Promise<Done<T>[]> {
  const t0 = performance.now();
  const keys = jobs.map((j) => jobKey(j, set));
  const out: Done<T>[] = jobs.map((job) => ({ job, cached: false, ms: 0 }));
  const tasks: PoolTask[] = [];
  const seen = new Map<string, number[]>();
  jobs.forEach((job, i) => {
    const k = keys[i];
    const kind = (ex.stats.byKind[job.kind] ??= { n: 0, hits: 0, ms: 0 });
    if (!cachedOnly) {
      kind.n++;
      ex.stats.jobs++;
    }
    const hit = ex.fresh && !cachedOnly ? undefined : cacheGet<{ result: T; ms: number }>(k);
    if (cachedOnly) {
      if (hit) out[i] = { job, result: hit.result, cached: true, ms: hit.ms };
      return;
    }
    if (hit) {
      out[i] = { job, result: hit.result, cached: true, ms: hit.ms };
      kind.hits++;
      ex.stats.hits++;
      return;
    }
    const dup = seen.get(k);
    if (dup) {
      dup.push(i);
      return;
    }
    seen.set(k, [i]);
    tasks.push({ key: k, job, set, cost: costOf(job) });
  });
  if (tasks.length) {
    let last = 0;
    if (!ex.quiet) process.stderr.write(`  ${label}: ${jobs.length} (${jobs.length - tasks.length} cached), running ${tasks.length}\n`);
    const results = await runPool(tasks, (r, done, total) => {
      const now = performance.now();
      if (!ex.quiet && (now - last > 5000 || done === total)) {
        last = now;
        process.stderr.write(`    ${done}/${total} ${((now - t0) / 1000).toFixed(1)} s\n`);
      }
      if (r.error && !ex.quiet) process.stderr.write(`    ! ${r.error.split("\n")[0]}\n`);
    });
    for (const r of results) {
      const idx = seen.get(r.key) ?? [];
      const job = jobs[idx[0]];
      const kind = ex.stats.byKind[job.kind];
      kind.ms += r.ms;
      ex.stats.cpuMs += r.ms;
      if (!r.error) cachePut(r.key, { result: r.result, ms: r.ms, job });
      for (const i of idx) out[i] = { job: jobs[i], result: r.result as T, error: r.error, cached: false, ms: r.ms };
    }
  }
  ex.stats.wallMs += performance.now() - t0;
  return out;
}
