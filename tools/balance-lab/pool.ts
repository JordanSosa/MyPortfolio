/**
 * Worker pool for the balance lab: up to N forked Node processes (tools/balance-lab/worker.mjs),
 * each with the real headless game loaded once, fed jobs over IPC from ONE shared queue
 * (longest first), so concurrent batches never oversubscribe the cores. Workers start on
 * demand and stay up until `closePool()`.
 */
import { fork, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { LAB_DIR } from "./cache";
import type { Job } from "./jobs";
import type { Override } from "./overrides";

export interface PoolTask {
  key: string;
  job: Job;
  set: Override[];
  /** Relative cost estimate (scheduling only: longest first). */
  cost: number;
}

export interface PoolResult {
  key: string;
  result?: unknown;
  error?: string;
  ms: number;
}

interface Pending {
  task: PoolTask;
  done: (r: PoolResult) => void;
}

interface W {
  p: ChildProcess;
  ready: boolean;
  busy: Pending | null;
}

let size = 4;
const workers: W[] = [];
const queue: Pending[] = [];

export function setPoolSize(n: number): void {
  size = Math.max(1, Math.floor(n));
}

function spawnWorker(): W {
  const p = fork(join(LAB_DIR, "worker.mjs"), [], { stdio: ["ignore", "inherit", "inherit", "ipc"], execArgv: ["--max-old-space-size=4096"] });
  const w: W = { p, ready: false, busy: null };
  p.on("message", (m: { kind: string; result?: unknown; error?: string; ms?: number }) => {
    if (m.kind === "ready") {
      w.ready = true;
      pump();
      return;
    }
    if (m.kind === "done" && w.busy) {
      const b = w.busy;
      w.busy = null;
      b.done({ key: b.task.key, result: m.result, error: m.error, ms: m.ms ?? 0 });
      pump();
    }
  });
  p.on("exit", (code) => {
    const i = workers.indexOf(w);
    if (i >= 0) workers.splice(i, 1);
    if (w.busy) {
      // a hard crash (OOM...): report the job, carry on with the others on a fresh worker
      const b = w.busy;
      w.busy = null;
      b.done({ key: b.task.key, error: `worker exited (${code})`, ms: 0 });
    }
    pump();
  });
  workers.push(w);
  return w;
}

function pump(): void {
  for (const w of workers) {
    if (!queue.length) break;
    if (!w.ready || w.busy) continue;
    const next = queue.shift()!;
    w.busy = next;
    w.p.send({ kind: "job", id: next.task.key, job: next.task.job, set: next.task.set });
  }
  // start more workers while work is waiting
  const idleOrStarting = workers.filter((w) => !w.ready || !w.busy).length;
  let want = Math.min(size - workers.length, queue.length - idleOrStarting);
  while (want-- > 0) spawnWorker();
}

/** Queue tasks on the shared pool; `onDone` sees each result as it lands. */
export function runPool(tasks: PoolTask[], onDone: (r: PoolResult, done: number, total: number) => void): Promise<PoolResult[]> {
  if (!tasks.length) return Promise.resolve([]);
  return new Promise((resolve) => {
    const out: PoolResult[] = [];
    for (const task of tasks) {
      const pend: Pending = {
        task,
        done: (r) => {
          out.push(r);
          onDone(r, out.length, tasks.length);
          if (out.length === tasks.length) resolve(out);
        },
      };
      // keep the queue sorted by cost (longest first)
      let i = queue.findIndex((q) => q.task.cost < task.cost);
      if (i < 0) i = queue.length;
      queue.splice(i, 0, pend);
    }
    pump();
  });
}

/** Stop the workers (end of a lab run). */
export function closePool(): void {
  for (const w of [...workers]) {
    try {
      w.p.disconnect();
    } catch {
      w.p.kill();
    }
  }
  workers.length = 0;
}

/** Workers alive right now (reports). */
export function poolSize(): number {
  return workers.length;
}
