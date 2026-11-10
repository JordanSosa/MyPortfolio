// Production bundle budget (docs/DEVTOOLS.md §6): builds dist/ (the GitHub Pages build) and checks the main
// chunk against a size budget, and that the developer suite stays out of it (the dev console and the scenario
// code must remain lazy chunks: zero cost for players who never open them). ~5 s with the build (TS 7 + rolldown).
//
//   node scripts/check-bundle.mjs [--no-build] [--json]
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/**
 * Main chunk budget. Measured: 1,482,128 B raw / 498.2 KB gzip before the developer suite, 1,498,877 B /
 * 505.3 KB after it (the always-on profiler + diagnostics): budget 1,575,000 / 530,000.
 * Season 3, the twenty second evolutions (20 weapons, their sprites and fx): 1,560,834 B raw / 525,959 B gzip,
 * 99 % of that budget. Raised on purpose, in review, to measured + 3 %. Raise it the same way: never in passing.
 */
export const BUDGET = { raw: 1_608_000, gzip: 542_000 };
/** Strings that only the lazy dev chunks contain: finding one in the main chunk means it stopped being lazy. */
const LAZY_ONLY = [
  { what: "dev console (src/debug/console)", re: /kkd-panel/ },
  { what: "scenarios (src/debug/scenarios.ts)", re: /results:first-clear|gacha:pull-x10/ },
  // (~40 KB of art direction: only the atlas painters read it - the dev boot, the bake, tools - never the game)
  { what: "art manifest (src/art/manifest.ts)", re: /Stampede cat \(Mochi ult\)|Yarn Orbit ball: pink yarn ball/ },
  { what: "sprite sources (src/art/sprites)", re: /OOoooyz/ },
];

export function checkBundle(args = {}) {
  const T0 = Date.now();
  let buildMs = null;
  if (!args["no-build"]) {
    const t = Date.now();
    const r = spawnSync("npx", ["vite", "build", "--logLevel", "error"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
    if (r.status !== 0) return { ok: false, ms: Date.now() - T0, problems: [`vite build failed:\n${(r.stdout + r.stderr).split("\n").slice(-20).join("\n")}`] };
    buildMs = Date.now() - t;
  }
  const dist = join(ROOT, "dist");
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const mainRel = /<script[^>]+type="module"[^>]+src="\.?\/?([^"]+)"/.exec(html)?.[1];
  if (!mainRel) return { ok: false, ms: Date.now() - T0, problems: ["no module script in dist/index.html"] };
  const main = readFileSync(join(dist, mainRel));
  const chunks = readdirSync(join(dist, "assets"))
    .map((f) => ({ file: `assets/${f}`, bytes: statSync(join(dist, "assets", f)).size }))
    .sort((a, b) => b.bytes - a.bytes);
  const gz = gzipSync(main, { level: 9 }).length;
  const problems = [];
  if (main.length > BUDGET.raw) problems.push(`main chunk ${main.length} B > budget ${BUDGET.raw} B`);
  if (gz > BUDGET.gzip) problems.push(`main chunk gzip ${gz} B > budget ${BUDGET.gzip} B`);
  const text = main.toString("utf8");
  for (const l of LAZY_ONLY) if (l.re.test(text)) problems.push(`the ${l.what} is in the main chunk: it must stay a lazy import`);
  return { ok: !problems.length, ms: Date.now() - T0, buildMs, main: { file: mainRel, bytes: main.length, gzip: gz }, budget: BUDGET, chunks: chunks.slice(0, 12), totalAssets: chunks.reduce((a, c) => a + c.bytes, 0), problems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs();
  const r = checkBundle(args);
  if (args.json) console.log(JSON.stringify(r, null, 1));
  else {
    if (r.main) {
      console.log(`main chunk ${r.main.file}: ${r.main.bytes} B (budget ${r.budget.raw}, ${((r.main.bytes / r.budget.raw) * 100).toFixed(1)} %), gzip ${r.main.gzip} B (budget ${r.budget.gzip}, ${((r.main.gzip / r.budget.gzip) * 100).toFixed(1)} %)`);
      console.log(`largest assets: ${r.chunks.slice(0, 6).map((c) => `${c.file.replace("assets/", "")} ${(c.bytes / 1024).toFixed(0)} KB`).join(", ")}`);
    }
    if (r.problems.length) console.log(`problems:\n  ${r.problems.join("\n  ")}`);
    console.log(`check:bundle ${r.ok ? "ok" : "FAIL"} in ${(r.ms / 1000).toFixed(1)} s${r.buildMs != null ? ` (build ${(r.buildMs / 1000).toFixed(1)} s)` : ""}`);
  }
  process.exit(r.ok ? 0 : 1);
}
