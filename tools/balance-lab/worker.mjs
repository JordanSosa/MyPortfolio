/**
 * Balance lab worker process (forked by tools/balance-lab/pool.ts): loads the real
 * headless game once (jobs.ts through Vite's module runner) and runs jobs sent
 * over IPC until the parent disconnects. One job at a time; a crash is returned
 * as an error result, the worker keeps going.
 */
import { loadLab } from "./boot.mjs";

const jobs = await loadLab("jobs.ts");
process.on("message", async (msg) => {
  if (!msg || msg.kind !== "job") return;
  const t0 = performance.now();
  let reply;
  try {
    const result = await jobs.runJob(msg.job, msg.set ?? []);
    reply = { kind: "done", id: msg.id, result, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    reply = { kind: "done", id: msg.id, error: String(err && err.stack ? err.stack : err).slice(0, 2000), ms: Math.round(performance.now() - t0) };
  }
  process.send(reply);
});
process.on("disconnect", () => process.exit(0));
process.send({ kind: "ready" });
