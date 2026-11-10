// Vitest config for the unit suite (tests/). It extends vite.config.ts (same plugins / resolution) and adds:
//
//   npm test              the FAST suite: every test not tagged "slow" (target < 10 s). Files whose header says
//                         `// @module-tag slow` hold only long headless runs and are not even loaded.
//   npm run test:slow     only the tests tagged "slow" (long headless bot runs, full stages, fuzzers)
//   npm run test:all      everything (the pre-split `npm test`: 936 tests, ~50 s on 4 cores)
//
// Tag a test that runs the sim for more than ~0.2 s:  test("name", { tags: ["slow"] }, () => { ... })
// (or a whole describe: describe("name", { tags: ["slow"] }, () => { ... })). Nothing is ever deleted or
// skipped for good: test:slow / test:all / doctor --all run the slow ones. docs/DEVTOOLS.md §7.
import { readdirSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type Plugin, type ViteUserConfig } from "vitest/config";
import viteConfig from "./vite.config";

const root = fileURLToPath(new URL(".", import.meta.url));

/** True when this run filters out the slow tag (npm test): whole slow-only files are then excluded up front. */
function fastRun(): boolean {
  const argv = process.argv.join(" ");
  return /--tags-filter[= ]+["']?!slow\b/.test(argv) || process.env.KK_TESTS === "fast";
}

/** tests/*.test.ts files whose docblock carries `@module-tag slow` (they hold no fast test). */
function slowOnlyFiles(): string[] {
  const out: string[] = [];
  for (const f of readdirSync(new URL("./tests/", import.meta.url))) {
    if (!f.endsWith(".test.ts")) continue;
    const head = readFileSync(new URL(`./tests/${f}`, import.meta.url), "utf8").slice(0, 2000);
    if (/(\/\/|\*)\s*@module-tag\s+slow\b/.test(head)) out.push(`tests/${f}`);
  }
  return out;
}

/**
 * A module that calls `import.meta.glob` is transformed into static imports of the files that matched: its
 * transform depends on a folder listing, not only on its own text. Vitest's fs module cache keys a module by its
 * text and only bails out on the literal `import.meta.glob(`, which the typed calls here
 * (`import.meta.glob<Mod>(...)`) never contain. So `npm test` kept serving a stale file list: a new
 * `src/art/sprites/evo2-*.ts` or `src/view/evo2/*.ts` (or a new weapon file) stayed invisible until a cache
 * entry was deleted. This plugin keeps every such module out of the cache (about ten small files).
 */
function globModulesUncached(): Plugin {
  return {
    name: "kk-glob-modules-uncached",
    configureVitest({ defineCacheKeyGenerator }) {
      defineCacheKeyGenerator(({ sourceCode }) => (/\bimport\.meta\.glob\s*[<(]/.test(sourceCode) ? false : undefined));
    },
  };
}

export default defineConfig(async (env) => {
  const base = (typeof viteConfig === "function" ? await viteConfig(env) : viteConfig) as ViteUserConfig;
  return mergeConfig(base, {
    // a fixed build stamp: vite.config.ts stamps the minute, which would change the transform of src/debug/diag.ts
    define: { __KK_BUILD__: JSON.stringify({ version: "test", commit: "test", date: "test" }) },
    plugins: [globModulesUncached()],
    test: {
      root,
      include: ["tests/**/*.test.ts"],
      exclude: ["**/node_modules/**", ...(fastRun() ? slowOnlyFiles() : [])],
      testTimeout: 60_000,
      // every core (the default leaves one idle: 9.2 s -> 7.7 s for the fast suite on 4 cores)
      maxWorkers: Math.max(1, availableParallelism()),
      tags: [{ name: "slow", description: "long headless runs (full stages, 3-minute bot runs, fuzzers): npm run test:slow", timeout: 240_000 }],
    },
  } satisfies ViteUserConfig);
});
