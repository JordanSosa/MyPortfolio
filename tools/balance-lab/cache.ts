/**
 * Disk cache of the balance lab: one JSON file per job result, keyed by a hash of
 * everything the job depends on (the job, the game code / content it reads, the
 * what-if overrides that touch it) - re-runs are instant and only cells whose
 * inputs changed recompute. Lives in node_modules/.cache/balance-lab (never
 * committed; `--fresh` ignores it, deleting the folder clears it).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const LAB_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(LAB_DIR, "../..");
export const CACHE_DIR = join(ROOT, "node_modules/.cache/balance-lab");

export function sha(...parts: unknown[]): string {
  const h = createHash("sha1");
  for (const p of parts) h.update(typeof p === "string" ? p : JSON.stringify(p) ?? "undefined").update("\u0000");
  return h.digest("hex").slice(0, 20);
}

const file = (key: string) => join(CACHE_DIR, key.slice(0, 2), `${key}.json`);

export function cacheGet<T>(key: string): T | undefined {
  const f = file(key);
  if (!existsSync(f)) return undefined;
  try {
    return JSON.parse(readFileSync(f, "utf8")) as T;
  } catch {
    return undefined;
  }
}

export function cachePut(key: string, value: unknown): void {
  const f = file(key);
  mkdirSync(dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, f);
}
