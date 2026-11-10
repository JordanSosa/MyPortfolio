/**
 * Balance lab bootstrap (plain Node): loads a TypeScript entry of the lab through
 * Vite's module runner (the same transform as Vitest: `import.meta.glob` content
 * registries work), without starting Vitest. One call = one module graph, so an
 * entry imports everything it needs statically.
 */
import { runnerImport } from "vite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Import `tools/balance-lab/<file>` (TS) through Vite's module runner. The files of the loaded
 * module graph are left in `globalThis.__kkLabGraph` (tools/balance-lab/deps.ts hashes exactly
 * the code the sim runs, so an edit to an unrelated file - the browser loop, the UI - keeps the cache).
 */
export async function loadLab(file) {
  const { module, dependencies } = await runnerImport(join(ROOT, "tools/balance-lab", file), { configFile: false, root: ROOT, logLevel: "error", clearScreen: false });
  globalThis.__kkLabGraph = dependencies;
  return module;
}
