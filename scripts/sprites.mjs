// Render the sprite preview sheet to a PNG and print the validation report.
//   node scripts/sprites.mjs [--filter hoshi,en_] [--owner chars] [--scale 4] [--bg checker|dark|light|grass] [--fonts] [--out shots/sprites.png] [--validate]
import { parseArgs, startServer, launchBrowser, newPage, ensureDir } from "./lib.mjs";

const args = parseArgs();
const out = args.out ?? "shots/sprites.png";
const q = new URLSearchParams();
for (const k of ["filter", "owner", "scale", "bg"]) if (args[k] && args[k] !== true) q.set(k, args[k]);
if (args.fonts) q.set("fonts", "1");
if (args.validate) q.set("validate", "1");

const { url, close } = await startServer();
const browser = await launchBrowser();
let code = 0;
try {
  const page = await newPage(browser, { w: Number(args.w ?? 1400), h: 900 });
  await page.goto(`${url}/tools/sprites.html?${q}`, { waitUntil: "load" });
  await page.waitForSelector("body[data-ready='1']", { timeout: 30000 });
  const report = await page.evaluate(() => window.__report);
  if (!args.validate) {
    ensureDir(out);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`screenshot: ${out}`);
  }
  console.log(`sprites registered: ${report.total} | manifest: ${report.manifest} | missing: ${report.missing.length} | errors: ${report.errors.length}`);
  if (report.missing.length) console.log("MISSING:", report.missing.join(", "));
  if (report.errors.length) console.log("ERRORS:\n  " + report.errors.join("\n  "));
  if (report.extra.length) console.log("extra (not in manifest):", report.extra.join(", "));
  const pageErrors = page.__logs.filter((l) => l.startsWith("[pageerror]") || l.startsWith("[error]"));
  if (pageErrors.length) {
    console.log("PAGE ERRORS:\n" + pageErrors.join("\n"));
    code = 2;
  }
  if (report.errors.length) code = 1;
} finally {
  await browser.close();
  await close();
}
process.exit(code);
