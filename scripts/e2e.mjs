// End-to-end smoke test: desktop, mobile portrait and mobile landscape.
//   node scripts/e2e.mjs [--only desktop|portrait|landscape] [--out shots/e2e] [--keep-going]
//
// Per device:
//   A) the real Season 2 flow with real taps / clicks: splash -> tap -> HUB home -> PLAY -> episode
//      select -> loadout (switch hero, equip a relic from the shelf) -> START EPISODE (episode title card,
//      READY? / GO!) -> gameplay, steer (keyboard on desktop, touch joystick via CDP touch events on
//      mobile) + dash -> pause -> QUIT RUN -> Episode Results (payout lines tick) -> HUB -> home.
//   B) hub pages by tap from home: Training Arc (buy a node from its sheet), Heroes -> hero -> talents,
//      Merch Machine (fine print sheet), Wiki (Plot Points), settings (save data tab), with the Back button
//      / Escape popping the stack.
//   C) autoplay + skip: gameplay, forced level-up modal, golden chest reel, pause menu, results.
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
/** A progressed save v2 profile (sanitised on load like any other) for the hub-page steps. */
const SEED = {
  version: 2,
  currencies: { coins: 2480, gems: 3360, copium: 186 },
  unlocks: { heroes: ["hoshi", "rin", "mochi"], weapons: [], passives: [], stages: ["dream_meadow"], twists: ["budget_cuts", "filler_overload"], relicSlots: 0 },
  heroes: { hoshi: { xp: 5200, level: 1, talents: {}, constellation: 2, runs: 9, clears: 1, kills: 21000, time: 3600, bestTime: 640, talentRespecs: 0 } },
  relics: { sakuga_cel: 2, bent_spoon: 4, rubber_duck: 1 },
  loadout: { stage: "dream_meadow", hero: "hoshi", relics: ["sakuga_cel"], twists: {}, endless: false, startWeapon: null },
  records: { dream_meadow: { runs: 13, clears: 1, bestTime: 640, bestHeat: 0, bestEndless: 0, bestKills: 26000, bestLevel: 58, bestCombo: 900, firstClear: 12 } },
  lifetime: { runs: 13, clears: 1, deaths: 12, time: 4700, kills: 26000, bossKills: { king_puff: 6, nightmare_teddy: 2, lady_lunatic: 1 } },
  settings: { master: 0.8, music: 0.7, sfx: 0.85, shake: 1, reduceFlashing: false, damageNumbers: true, quality: "auto", haptics: true, showFps: false },
};

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
    // ---------------------------------------------------------------- A) the Season 2 flow (fresh profile)
    const mobile = !!dev.opts.mobile;
    const tap = async (sel, timeout = 8000) => {
      const loc = page.locator(sel).first();
      await loc.waitFor({ state: "visible", timeout });
      if (mobile) await loc.tap({ timeout });
      else await loc.click({ timeout });
    };
    /** Tap through boot notices (unlock celebrations, the Season 2 welcome dialog) until none shows up for 2 s. */
    const dismissOverlays = async () => {
      let quietSince = Date.now();
      for (let i = 0; i < 60 && Date.now() - quietSince < 2000; i++) {
        const sel = await page.evaluate(() =>
          document.querySelector(".unlock-cele:not(.out) [data-act='ok']") ? ".unlock-cele:not(.out) [data-act='ok']" : document.querySelector(".kdialog-wrap:not(.out) [data-act='no']") ? ".kdialog-wrap:not(.out) [data-act='no']" : "",
        );
        if (sel) {
          await sleep(400);
          await tap(sel).catch(() => {});
          quietSince = Date.now();
        }
        await sleep(250);
      }
    };
    const hubPage = (id) => page.evaluate((x) => window.__kk.screen === "hub" && document.querySelector(".hub")?.dataset.page === x, id);
    const waitPage = (id, label) => waitFor(page, (x) => window.__kk.screen === "hub" && document.querySelector(".hub")?.dataset.page === x && !document.querySelector(".hpage.p-in-r, .hpage.p-in-l"), id, 12000, label ?? `hub page ${id}`);
    await step("splash", async () => {
      await page.goto(`${url}/?mute=1&seed=7`, { waitUntil: "load" });
      await waitFor(page, () => !!document.querySelector(".splash") && !!window.__kk, null, 30000, "splash");
      await sleep(1200);
      await shot(page, dev.name, "1-splash", rec);
    });
    await step("hub home", async () => {
      const vp = page.viewportSize();
      if (mobile) await page.touchscreen.tap(vp.width / 2, vp.height * 0.6);
      else await page.mouse.click(vp.width / 2, vp.height * 0.6);
      await waitPage("home", "hub home");
      await sleep(1500);
      await shot(page, dev.name, "2-hub", rec);
    });
    await step("PLAY -> episodes", async () => {
      await tap('.home [data-act="play"]');
      await waitPage("stages");
      await sleep(700);
      await shot(page, dev.name, "3-episodes", rec);
    });
    await step("episode -> loadout (locked hero, relic shelf)", async () => {
      await tap(".ep-card.open");
      await waitPage("loadout");
      await sleep(600);
      // a locked hero only shakes + explains (no state change)
      const locked = page.locator(".hc-card.locked").first();
      if (await locked.count()) {
        if (mobile) await locked.tap();
        else await locked.click();
        await sleep(300);
      }
      await tap('.rslot[data-i="0"]');
      await waitFor(page, () => !!document.querySelector(".ksheet-wrap:not(.out)"), null, 8000, "relic shelf sheet");
      await sleep(500);
      await shot(page, dev.name, "4-shelf", rec);
      await tap('.ksheet-wrap:not(.out) [data-act="x"]');
      await waitFor(page, () => !document.querySelector(".ksheet-wrap:not(.out)"), null, 8000, "shelf closed");
      await sleep(300);
      await shot(page, dev.name, "4-loadout", rec);
    });
    await step("START EPISODE (title card, READY? / GO!)", async () => {
      await tap('.loadout [data-act="go"]');
      await waitFor(page, () => window.__kk.screen === "game" && !!document.querySelector(".ep-title"), null, 15000, "episode title card");
      await sleep(400);
      await shot(page, dev.name, "5-episode-card", rec);
      await waitFor(page, () => window.__kk.screen === "game" && window.__kk.world && window.__kk.world.t > 0.5, null, 20000, "game running");
      await sleep(800);
      await shot(page, dev.name, "5-game-start", rec);
    });
    await step("steer + dash (+ pick a card by tap if a level-up interrupts)", async () => {
      let moved = false;
      let x0 = 0;
      let x1 = 0;
      for (let tries = 0; tries < 3 && !moved; tries++) {
        await resolveModal(page, mobile);
        x0 = await page.evaluate(() => window.__kk.world.player.x);
        if (mobile) {
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
      await resolveModal(page, mobile);
      if (mobile) {
        const visible = await page.evaluate(() => !document.querySelector(".kk-touch").hidden);
        if (!visible) throw new Error("touch controls not visible during gameplay");
        await page.locator(".kk-dash").tap();
        await sleep(300);
      }
    });
    await step("pause -> QUIT RUN -> Episode Results", async () => {
      await resolveModal(page, mobile);
      await tap(".pause-btn");
      await waitFor(page, () => window.__kk.modal === "pause", null, 10000, "pause modal");
      await sleep(500);
      await tap('.pause [data-act="quit"]');
      await sleep(350);
      await tap('.pause [data-act="quit"]');
      await waitFor(page, () => window.__kk.screen === "results" && !!document.querySelector(".ep-res"), null, 12000, "Episode Results");
      await waitFor(page, () => document.querySelectorAll(".ep-res .pl.in").length >= 2, null, 20000, "payout lines ticking in");
      await sleep(1500);
      await shot(page, dev.name, "6-results", rec);
    });
    await step("results HUB -> home", async () => {
      await tap('.er-btns [data-act="hub"]');
      await waitPage("home", "back at the hub home");
      const runs = await page.evaluate(() => document.querySelector(".oc-ep")?.textContent ?? "");
      if (!/2/.test(runs)) throw new Error(`episode counter did not advance after a banked run: "${runs}"`);
    });

    // ---------------------------------------------------------------- B) hub pages (progressed profile)
    await step("hub: Training Arc buy", async () => {
      await page.evaluate((seed) => localStorage.setItem("kko.save.v2", JSON.stringify(seed)), SEED);
      await page.goto(`${url}/?mute=1&seed=7&screen=hub`, { waitUntil: "load" });
      await waitPage("home", "seeded hub home");
      await sleep(900);
      await dismissOverlays();
      await tap('.home [data-act="board"]');
      await waitPage("board");
      await sleep(900);
      const before = await page.evaluate(() => document.querySelector(".bd-prog b")?.textContent ?? "");
      await tap(".bn.s-afford");
      await waitFor(page, () => !!document.querySelector(".node-sheet"), null, 8000, "node sheet");
      await sleep(450);
      await tap('.ksheet-wrap:not(.out) [data-act="buy"]');
      await waitFor(page, (b) => (document.querySelector(".bd-prog b")?.textContent ?? "") !== b, before, 8000, "node bought");
      await sleep(600);
      await shot(page, dev.name, "7-board", rec);
      if (mobile) await tap('.ksheet-wrap:not(.out) [data-act="x"]');
      else await page.keyboard.press("Escape");
      await waitFor(page, () => !document.querySelector(".ksheet-wrap:not(.out)"), null, 8000, "node sheet closed");
      await tap(".hub-back");
      await waitPage("home");
    });
    if (!mobile)
      await step("keyboard: arrows + Enter open a page, Escape pops it", async () => {
        await page.keyboard.press("ArrowDown"); // first arrow: shows the focus ring on the default (PLAY)
        await sleep(250);
        const f = await page.evaluate(() => document.querySelector(".nav-focus")?.dataset.act ?? "");
        if (f !== "play") throw new Error(`default focus is "${f}", expected PLAY`);
        await page.keyboard.press("Enter");
        await waitPage("stages", "Enter -> episodes");
        await page.keyboard.press("Escape");
        await waitPage("home", "Escape -> home");
      });
    await step("hub: Heroes -> hero -> talents", async () => {
      await tap('.home [data-act="heroes"]');
      await waitPage("heroes");
      await tap(".cast-card:not(.locked):not(.soon)");
      await waitPage("hero");
      await tap('.tabb[data-tab="talents"]');
      await waitFor(page, () => !!document.querySelector(".tt-tree"), null, 8000, "talent tree");
      await sleep(500);
      await shot(page, dev.name, "8-talents", rec);
      await tap(".hub-back");
      await waitPage("heroes");
      await tap(".hub-back");
      await waitPage("home");
    });
    await step("hub: Merch Machine (fine print, pull x1)", async () => {
      await tap('.home [data-act="gacha"]');
      await waitPage("gacha");
      await tap(".mm-fine");
      await waitFor(page, () => !!document.querySelector(".fine-sheet"), null, 8000, "fine print");
      await sleep(400);
      await tap('.ksheet-wrap:not(.out) [data-act="x"]');
      await waitFor(page, () => !document.querySelector(".ksheet-wrap:not(.out)"), null, 8000, "fine print closed");
      await tap('.merch [data-act="pull1"]');
      await waitFor(page, () => !!document.querySelector(".reveal"), null, 8000, "pull reveal");
      await waitFor(page, () => !!document.querySelector(".reveal.done"), null, 20000, "reveal finished");
      await sleep(400);
      await shot(page, dev.name, "9-pull", rec);
      await tap('.reveal [data-act="ok"]');
      await waitFor(page, () => !document.querySelector(".reveal:not(.out)"), null, 8000, "reveal closed");
      await tap(".hub-back");
      await waitPage("home");
    });
    await step("hub: Wiki + settings save tab", async () => {
      await tap('.home [data-act="wiki"]');
      await waitPage("wiki");
      await sleep(500);
      await shot(page, dev.name, "10-wiki", rec);
      await tap(".hub-gear");
      await waitFor(page, () => !!document.querySelector(".settings"), null, 8000, "settings");
      await sleep(450); // taps within 300 ms of a new panel are ghost-click guarded
      await tap('.settings [data-tab="save"]');
      await tap('.settings [data-act="export"]');
      await waitFor(page, () => (document.querySelector('.settings [data-ta="export"]')?.value ?? "").length > 20, null, 8000, "save string exported");
      await sleep(300);
      await shot(page, dev.name, "11-settings-save", rec);
      await tap('.settings [data-act="done"]');
      await waitFor(page, () => !document.querySelector(".settings:not(.out)"), null, 8000, "settings closed");
    });
    await step("Android Back pops the hub stack", async () => {
      if (!(await hubPage("wiki"))) throw new Error("expected the wiki page under the settings");
      await page.goBack();
      await waitPage("home", "Back -> home");
      if (!page.url().startsWith(url)) throw new Error("Back left the page");
    });

    // ---------------------------------------------------------------- C) autoplay + skip
    const hero = HEROES[di % 3];
    await step(`autoplay ${hero} skip 90`, async () => {
      await page.goto(`${url}/?autoplay=1&skip=90&seed=${3 + di}&mute=1&hero=${hero}`, { waitUntil: "load" });
      await waitFor(page, () => window.__kk && window.__kk.screen === "game" && window.__kk.world.t > 90, null, 40000, "skipped run");
      await waitFor(page, () => window.__kk.modal === "", null, 20000, "no modal");
      await sleep(2500);
      await shot(page, dev.name, "12-gameplay", rec);
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
      await shot(page, dev.name, "13-levelup", rec);
      if (n < 3) throw new Error(`expected >= 3 cards, got ${n}`);
      await waitFor(page, () => window.__kk.modal !== "levelup", null, 30000, "auto-pick");
    });
    await step("chest", async () => {
      await waitFor(page, () => window.__kk.modal === "", null, 20000, "no modal");
      await page.evaluate(() => window.__kk.chest(true));
      await waitFor(page, () => window.__kk.modal === "chest", null, 20000, "chest modal");
      await waitFor(page, () => document.querySelectorAll(".chest-modal .reel.landed").length >= 3, null, 30000, "reels landed");
      await sleep(400);
      await shot(page, dev.name, "14-chest", rec);
      await waitFor(page, () => window.__kk.modal !== "chest", null, 30000, "chest closed");
    });
    await step("pause", async () => {
      await waitFor(page, () => window.__kk.modal === "", null, 20000, "no modal");
      await page.evaluate(() => window.__kk.pause());
      await waitFor(page, () => window.__kk.modal === "pause", null, 10000, "pause modal");
      await sleep(700);
      await shot(page, dev.name, "15-pause", rec);
    });
    await step("results", async () => {
      await page.evaluate(() => window.__kk.endRun());
      await waitFor(page, () => window.__kk.screen === "results", null, 10000, "results screen");
      await sleep(2600);
      await shot(page, dev.name, "16-results", rec);
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
