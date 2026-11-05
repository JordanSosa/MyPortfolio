// Generic screenshot / smoke tool.
//   node scripts/shot.mjs [--path "/?autoplay=1"] [--url http://host:port/path] [--out shots/shot.png]
//        [--mobile] [--landscape] [--w 1280 --h 720 --dpr 1]
//        [--wait 3000] [--count 3 --every 1000]
//        [--eval "window.__kk && __kk.skipTo(180)"]   (runs after load, before waiting)
//        [--tap 200,600] [--strict]
// Prints console output; with --strict exits 1 if any page error / console.error happened.
import { parseArgs, startServer, launchBrowser, newPage, ensureDir } from "./lib.mjs";

const args = parseArgs();
const out = args.out ?? "shots/shot.png";
const count = Number(args.count ?? 1);
const every = Number(args.every ?? 1000);
const wait = Number(args.wait ?? 2500);

let srv = null;
let base = args.url;
if (!base) {
  srv = await startServer();
  base = srv.url + (args.path && args.path !== true ? args.path : "/");
}
const browser = await launchBrowser();
let code = 0;
try {
  const page = await newPage(browser, { mobile: !!args.mobile, landscape: !!args.landscape, w: args.w, h: args.h, dpr: args.dpr });
  await page.goto(base, { waitUntil: "load" });
  if (args.eval && args.eval !== true) {
    await page.waitForTimeout(300);
    console.log("eval ->", JSON.stringify(await page.evaluate(args.eval)));
  }
  if (args.tap && args.tap !== true) {
    const [x, y] = String(args.tap).split(",").map(Number);
    if (args.mobile) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  }
  await page.waitForTimeout(wait);
  for (let i = 0; i < count; i++) {
    const file = count > 1 ? out.replace(/\.png$/, `-${i}.png`) : out;
    ensureDir(file);
    await page.screenshot({ path: file });
    console.log(`screenshot: ${file}`);
    if (i < count - 1) await page.waitForTimeout(every);
  }
  const logs = page.__logs;
  if (logs.length) console.log(logs.slice(-80).join("\n"));
  if (args.strict && logs.some((l) => l.startsWith("[pageerror]") || l.startsWith("[error]"))) code = 1;
} finally {
  await browser.close();
  if (srv) await srv.close();
}
process.exit(code);
