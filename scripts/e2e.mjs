// End-to-end smoke test: desktop, mobile portrait and mobile landscape.
//   node scripts/e2e.mjs [--only desktop|portrait|landscape] [--out shots/e2e] [--keep-going]
//
// Per device:
//   A) real UI flow: splash -> tap -> title -> PLAY -> select -> GO -> gameplay, then steer
//      (keyboard on desktop, touch joystick via CDP touch events on mobile) and dash.
//   B) autoplay + skip: gameplay, forced level-up modal, golden chest reel, pause menu, results.
// Screenshots go to shots/e2e/<device>-<step>.png. Fails (exit 1) on any page error or
// console.error, or when a step's expected state is not reached.
import { parseArgs, startServer, launchBrowser, newPage, ensureDir } from "./lib.mjs";

const args = parseArgs();
const outDir = args.out && args.out !== true ? args.out : "shots/e2e";
const DEVICES = [
  { name: "desktop", opts: { w: 1280, h: 720 } },
  { name: "portrait", opts: { mobile: true } },
  { name: "landscape", opts: { mobile: true, landscape: true } },
].filter((d) => !args.only || args.only === d.name);
const HEROES = ["hoshi", "rin", "mochi"];

const { url, close } = await startServer();
const browser = await launchBrowser();
const results = [];
let failed = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(page, fn, arg, timeout = 20000, label = "condition") {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if (await page.evaluate(fn, arg)) return true;
    } catch {
      /* page navigating */
    }
    await sleep(150);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function shot(page, dev, step, rec) {
  const file = `${outDir}/${dev}-${step}.png`;
  ensureDir(file);
  await page.screenshot({ path: file });
  rec.shots.push(file);
}

async function touchDrag(page, x0, y0, dx, dy, holdMs) {
  const cdp = await page.context().newCDPSession(page);
  const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(x0, y0) });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(x0 + (dx * i) / 6, y0 + (dy * i) / 6) });
    await sleep(30);
  }
  await sleep(holdMs);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** If a level-up modal is open, pick the first card with a real tap/click (tests the fresh-touch guard). */
async function resolveModal(page, mobile) {
  for (let i = 0; i < 4; i++) {
    const m = await page.evaluate(() => window.__kk.modal);
    if (!m) return;
    if (m === "levelup") {
      await sleep(700);
      const card = page.locator(".levelup .card").first();
      if (mobile) await card.tap({ timeout: 5000 }).catch(() => {});
      else await card.click({ timeout: 5000 }).catch(() => {});
    } else if (m === "chest") {
      await sleep(3500);
      const vp = page.viewportSize();
      if (mobile) await page.touchscreen.tap(vp.width / 2, vp.height / 2);
      else await page.mouse.click(vp.width / 2, vp.height / 2);
    }
    await waitFor(page, (k) => window.__kk.modal !== k, m, 15000, `${m} closed`).catch(() => {});
    await sleep(300);
  }
}

for (let di = 0; di < DEVICES.length; di++) {
  const dev = DEVICES[di];
  const rec = { device: dev.name, steps: [], shots: [], errors: [] };
  results.push(rec);
  const page = await newPage(browser, dev.opts);
  const step = async (name, fn) => {
    const t0 = Date.now();
    try {
      await fn();
      rec.steps.push(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      rec.steps.push(`FAIL ${name}: ${e.message}`);
      failed = true;
      if (!args["keep-going"]) throw e;
    }
  };
  try {
    // ---------------------------------------------------------------- A) UI flow
    await step("splash", async () => {
      await page.goto(`${url}/?mute=1&seed=7`, { waitUntil: "load" });
      await waitFor(page, () => !!document.querySelector(".splash") && !!window.__kk, null, 30000, "splash");
      await sleep(1200);
      await shot(page, dev.name, "1-splash", rec);
    });
    await step("title", async () => {
      const vp = page.viewportSize();
      if (dev.opts.mobile) await page.touchscreen.tap(vp.width / 2, vp.height * 0.6);
      else await page.mouse.click(vp.width / 2, vp.height * 0.6);
      await waitFor(page, () => window.__kk.screen === "title" && !!document.querySelector(".title"), null, 10000, "title screen");
      await sleep(1500);
      await shot(page, dev.name, "2-title", rec);
    });
    await step("select", async () => {
      const b = page.locator('.title [data-act="play"]');
      if (dev.opts.mobile) await b.tap();
      else await b.click();
      await waitFor(page, () => window.__kk.screen === "select", null, 10000, "select screen");
      await sleep(900);
      // preview another hero (tapping the already-selected tab would start the run)
      await sleep(400);
      const tab = page.locator(".select .tab:not(.on)").first();
      if (dev.opts.mobile) await tab.tap();
      else await tab.click();
      await sleep(700);
      await shot(page, dev.name, "3-select", rec);
    });
    await step("start run", async () => {
      const b = page.locator('.select [data-act="go"]');
      if (dev.opts.mobile) await b.tap();
      else await b.click();
      await waitFor(page, () => window.__kk.screen === "game" && window.__kk.world && window.__kk.world.t > 0.5, null, 15000, "game running");
      await sleep(1500);
      await shot(page, dev.name, "4-game-start", rec);
    });
    await step("steer + dash (+ pick a card by tap if a level-up interrupts)", async () => {
      let moved = false;
      let x0 = 0;
      let x1 = 0;
      for (let tries = 0; tries < 3 && !moved; tries++) {
        await resolveModal(page, dev.opts.mobile);
        x0 = await page.evaluate(() => window.__kk.world.player.x);
        if (dev.opts.mobile) {
          const vp = page.viewportSize();
          await touchDrag(page, vp.width * 0.3, vp.height * 0.7, 46, 0, 1500);
        } else {
          await page.keyboard.down("KeyD");
          await sleep(1200);
          await page.keyboard.press("Space");
          await sleep(400);
          await page.keyboard.up("KeyD");
        }
        x1 = await page.evaluate(() => window.__kk.world.player.x);
        moved = x1 > x0 + 4;
      }
      if (!moved) throw new Error(`player did not move right (${x0.toFixed(1)} -> ${x1.toFixed(1)})`);
      await resolveModal(page, dev.opts.mobile);
      if (dev.opts.mobile) {
        const visible = await page.evaluate(() => !document.querySelector(".kk-touch").hidden);
        if (!visible) throw new Error("touch controls not visible during gameplay");
        await page.locator(".kk-dash").tap();
        await sleep(300);
      }
    });

    // ---------------------------------------------------------------- B) autoplay + skip
    const hero = HEROES[di % 3];
    await step(`autoplay ${hero} skip 90`, async () => {
      await page.goto(`${url}/?autoplay=1&skip=90&seed=${3 + di}&mute=1&hero=${hero}`, { waitUntil: "load" });
      await waitFor(page, () => window.__kk && window.__kk.screen === "game" && window.__kk.world.t > 90, null, 40000, "skipped run");
      await waitFor(page, () => window.__kk.modal === "", null, 20000, "no modal");
      await sleep(2500);
      await shot(page, dev.name, "5-gameplay", rec);
      const s = await page.evaluate(() => window.__kk.stats());
      rec.stats = s;
      if (s.level < 3) throw new Error(`low level after skip: ${s.level}`);
    });
    await step("level-up modal", async () => {
      await waitFor(page, () => window.__kk.modal === "", null, 20000, "no modal");
      await page.evaluate(() => window.__kk.levelUp());
      await waitFor(page, () => window.__kk.modal === "levelup", null, 15000, "level-up modal");
      await sleep(900);
      const n = await page.evaluate(() => document.querySelectorAll(".levelup .card").length);
      await shot(page, dev.name, "6-levelup", rec);
      if (n < 3) throw new Error(`expected >= 3 cards, got ${n}`);
      await waitFor(page, () => window.__kk.modal !== "levelup", null, 30000, "auto-pick");
    });
    await step("chest", async () => {
      await waitFor(page, () => window.__kk.modal === "", null, 20000, "no modal");
      await page.evaluate(() => window.__kk.chest(true));
      await waitFor(page, () => window.__kk.modal === "chest", null, 20000, "chest modal");
      await waitFor(page, () => document.querySelectorAll(".chest-modal .reel.landed").length >= 3, null, 30000, "reels landed");
      await sleep(400);
      await shot(page, dev.name, "7-chest", rec);
      await waitFor(page, () => window.__kk.modal !== "chest", null, 30000, "chest closed");
    });
    await step("pause", async () => {
      await waitFor(page, () => window.__kk.modal === "", null, 20000, "no modal");
      await page.evaluate(() => window.__kk.pause());
      await waitFor(page, () => window.__kk.modal === "pause", null, 10000, "pause modal");
      await sleep(700);
      await shot(page, dev.name, "8-pause", rec);
    });
    await step("results", async () => {
      await page.evaluate(() => window.__kk.endRun());
      await waitFor(page, () => window.__kk.screen === "results", null, 10000, "results screen");
      await sleep(2600);
      await shot(page, dev.name, "9-results", rec);
    });
  } catch {
    /* recorded */
  }
  const errs = page.__logs.filter((l) => l.startsWith("[pageerror]") || l.startsWith("[error]"));
  rec.errors = errs;
  if (errs.length) failed = true;
  await page.context().close();
}

await browser.close();
await close();

console.log("\n===== E2E SUMMARY =====");
for (const r of results) {
  console.log(`\n[${r.device}]`);
  for (const s of r.steps) console.log("  " + s);
  if (r.stats) console.log("  stats:", JSON.stringify(r.stats));
  console.log(`  screenshots: ${r.shots.length} -> ${outDir}/${r.device}-*.png`);
  if (r.errors.length) {
    console.log(`  PAGE ERRORS (${r.errors.length}):`);
    for (const e of r.errors.slice(0, 12)) console.log("    " + e.split("\n")[0]);
  } else console.log("  page errors: 0");
}
console.log(failed ? "\nE2E: FAILED" : "\nE2E: PASSED");
process.exit(failed ? 1 : 0);
