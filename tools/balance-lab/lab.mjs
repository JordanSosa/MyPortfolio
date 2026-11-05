#!/usr/bin/env node
/**
 * `npm run balance:lab` - the balance lab (docs/DEVTOOLS.md): an analytic model of every
 * checkpoint x stage cell (milliseconds) + short real-sim samples in a parallel worker pool
 * (cached on disk by what they depend on) + what-if overrides, one HTML / JSON / Markdown report.
 * Usage: `npm run balance:lab -- --help`.
 */
import { loadLab } from "./boot.mjs";

const t0 = performance.now();
const main = await loadLab("main.ts");
let code = 1;
try {
  code = await main.main(process.argv.slice(2), t0);
} finally {
  main.shutdown?.();
}
process.exit(code ?? 0);
