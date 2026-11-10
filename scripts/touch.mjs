// Touch-only regression checks (real CDP touch events, iPhone 13 portrait, hasTouch):
//   node scripts/touch.mjs [--out shots/touch] [--url http://host:port]   (default: a Vite dev server)
//
// TRAINING ARC  (a mid-progress profile, ?screen=board)
//   drag   a one-finger drag of (-150, -100) in 15 steps moves the map layer (.kvp-c translate) by
//          (-150 +-10, -100 +-10): the browser's implicit touch capture on the touched child must not
//          cancel the pan when PanZoom moves the capture to the host (lostpointercapture bubbling)
//   node   a drag that starts on empty sky and ends over a star does not press it (no sheet)
//   press  a drag that starts ON a star pans and does not press it either
//   tap    a tap on an affordable star opens its node sheet
//   pinch  a two-finger pinch out zooms in (scale grows)
// Exit 1 on any failed check, page error or console.error.
import { parseArgs, startServer, launchBrowser, ensureDir } from "./lib.mjs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(`${execSync("npm root -g").toString().trim()}/playwright`);
}
const { devices } = pw;

const args = parseArgs();
const outDir = args.out && args.out !== true ? args.out : "shots/touch";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mid-progress save v2: Dream Meadow cleared, a few ring-1 nodes bought, coins for more. */
const MID = {
  version: 2,
  currencies: { coins: 4200, gems: 300, copium: 0 },
  unlocks: { heroes: ["hoshi", "rin", "mochi"], weapons: [], passives: [], stages: ["dream_meadow", "candy_kingdom"], twists: ["budget_cuts"], relicSlots: 0 },
  heroes: { hoshi: { xp: 2400, level: 4, talents: {}, constellation: 0, runs: 9, clears: 1, kills: 30000, time: 3600, bestTime: 640, talentRespecs: 0 } },
  board: { ranks: { hp_1: 2, greed_1: 2, might_1: 1 }, paid: {}, keystones: [], respecs: 0 },
  loadout: { stage: "dream_meadow", hero: "hoshi", relics: [], twists: {}, endless: false, startWeapon: null },
  records: { dream_meadow: { runs: 9, clears: 1, bestTime: 640, bestHeat: 0, bestEndless: 0, bestKills: 26000, bestLevel: 58, bestCombo: 900, firstClear: 9 } },
  lifetime: { runs: 9, clears: 1, deaths: 8, time: 3600, kills: 30000, bossKills: { king_puff: 5, nightmare_teddy: 2, lady_lunatic: 1 } },
  codex: { heroes: ["hoshi"], stages: ["dream_meadow"], enemies: [], bosses: ["king_puff"], weapons: ["star_shot"], passives: [], relics: [] },
  flags: { s2Welcome: 1, firstRunCard: 1 },
  settings: { master: 0.8, music: 0.7, sfx: 0.85, shake: 1, reduceFlashing: false, damageNumbers: true, quality: "low", haptics: false, showFps: false },
};

let failures = 0;
const log = [];
function check(ok, what) {
  const line = `${ok ? "PASS" : "FAIL"}  ${what}`;
  log.push(line);
  console.log(line);
  if (!ok) failures++;
}

const own = args.url && args.url !== true ? null : await startServer();
const base = own ? own.url : String(args.url).replace(/\/$/, "");
const browser = await launchBrowser();
const ctxOpts = { ...devices["iPhone 13"] };
delete ctxOpts.defaultBrowserType;
const context = await browser.newContext(ctxOpts);
await context.addInitScript((seed) => {
  try {
    if (!localStorage.getItem("kko.save.v2")) localStorage.setItem("kko.save.v2", JSON.stringify(seed));
  } catch {
    /* storage blocked */
  }
}, MID);
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
const cdp = await context.newCDPSession(page);

const touch = (type, pts) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i, radiusX: 4, radiusY: 4, force: 1 })) });
async function drag(x0, y0, x1, y1, steps = 15, ms = 20) {
  await touch("touchStart", [[x0, y0]]);
  for (let i = 1; i <= steps; i++) {
    await sleep(ms);
    await touch("touchMove", [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]]);
  }
  await sleep(ms);
  await touch("touchEnd", []);
}
async function tap(x, y) {
  await touch("touchStart", [[x, y]]);
  await sleep(50);
  await touch("touchEnd", []);
}
const layer = () =>
  page.evaluate(() => {
    const c = document.querySelector(".hpage:not([hidden]) .kvp-c");
    const m = new DOMMatrix(getComputedStyle(c).transform);
    return { x: m.e, y: m.f, z: m.a };
  });
const sheetOpen = () => page.evaluate(() => !!document.querySelector(".ksheet-wrap:not(.out)"));
const closeSheet = async () => {
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".ksheet-wrap:not(.out)"), null, { timeout: 5000 }).catch(() => {});
  await sleep(400);
};
/** Centre of a visible, uncovered star matching `sel` inside the middle of the map (away from the HUD controls). */
const starAt = (sel) =>
  page.evaluate((s) => {
    const host = document.querySelector(".hpage:not([hidden]) .kvp").getBoundingClientRect();
    for (const b of document.querySelectorAll(`.hpage:not([hidden]) ${s}`)) {
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (x < host.left + 60 || x > host.right - 60 || y < host.top + 90 || y > host.bottom - 160) continue;
      const t = document.elementFromPoint(x, y);
      if (t && (t === b || b.contains(t))) return { x, y, id: b.dataset.id };
    }
    return null;
  }, sel);
/** The point of empty sky farthest from every star / control near the centre of the map. */
const emptySky = () =>
  page.evaluate(() => {
    const host = document.querySelector(".hpage:not([hidden]) .kvp").getBoundingClientRect();
    const pts = [...document.querySelectorAll(".hpage:not([hidden]) .bn, .hpage:not([hidden]) button")]
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width)
      .map((r) => [r.left + r.width / 2, r.top + r.height / 2]);
    let best = null;
    let bd = -1;
    for (let y = host.top + 140; y < host.bottom - 220; y += 6)
      for (let x = host.left + 100; x < host.right - 100; x += 6) {
        const d = Math.min(...pts.map(([a, b]) => Math.hypot(a - x, b - y)));
        if (d > bd) {
          bd = d;
          best = [x, y];
        }
      }
    return best;
  });

try {
  await page.goto(`${base}/?mute=1&quality=low&screen=board`, { waitUntil: "load" });
  await page.waitForFunction(
    () => window.__kk?.screen === "hub" && document.querySelector(".hub")?.dataset.page === "board" && !document.querySelector(".hpage.p-in-r, .hpage.p-in-l"),
    null,
    { timeout: 60000 },
  );
  await sleep(1200);
  ensureDir(`${outDir}/x`);
  const vp = page.viewportSize();
  check(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), "touch device emulation (pointer: coarse)");

  // ---- drag: the full distance, not ~10 px
  let sky = await emptySky();
  let a = await layer();
  await drag(sky[0], sky[1], sky[0] - 150, sky[1] - 100);
  await sleep(60); // before inertia adds much
  let b = await layer();
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  check(Math.abs(dx + 150) <= 10 && Math.abs(dy + 100) <= 10, `one-finger drag (-150,-100) moved the map (${dx.toFixed(0)},${dy.toFixed(0)})`);
  check(!(await sheetOpen()), "the drag opened no sheet");
  await sleep(900);
  await page.screenshot({ path: `${outDir}/board-drag.png` });

  // ---- a drag that ends over a star does not press it
  let star = await starAt(".bn");
  sky = await emptySky();
  if (star && sky) {
    a = await layer();
    await drag(sky[0], sky[1], star.x, star.y, 12, 20);
    await sleep(500);
    b = await layer();
    check(Math.hypot(b.x - a.x, b.y - a.y) > 30, `drag onto star ${star.id} panned the map`);
    check(!(await sheetOpen()), `drag ending over star ${star.id} did not press it`);
    if (await sheetOpen()) await closeSheet();
  } else check(false, "found a star and empty sky for the drag-onto-a-star check");

  // ---- a drag that starts on a star pans and does not press it
  star = await starAt(".bn");
  if (star) {
    a = await layer();
    await drag(star.x, star.y, star.x + 90, star.y + 70, 12, 20);
    await sleep(500);
    b = await layer();
    check(Math.hypot(b.x - a.x, b.y - a.y) > 60, `drag starting on star ${star.id} panned the map`);
    check(!(await sheetOpen()), `drag starting on star ${star.id} did not press it`);
    if (await sheetOpen()) await closeSheet();
  } else check(false, "found a star for the drag-from-a-star check");

  // ---- tap an affordable star: its sheet opens
  star = await starAt(".bn.s-afford");
  if (!star) {
    // pan back to the centre (the frontier stars are around it)
    sky = await emptySky();
    await drag(sky[0], sky[1], sky[0] + 150, sky[1] + 100);
    await sleep(1200);
    star = await starAt(".bn.s-afford");
  }
  if (star) {
    await tap(star.x, star.y);
    await page.waitForFunction(() => !!document.querySelector(".ksheet-wrap:not(.out)"), null, { timeout: 4000 }).catch(() => {});
    check(await sheetOpen(), `tap on affordable star ${star.id} opened its sheet`);
    await page.screenshot({ path: `${outDir}/board-tap-sheet.png` });
    await closeSheet();
  } else check(false, "found an affordable star on screen");

  // ---- pinch out zooms in
  a = await layer();
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  const pts = (d) => [
    [cx - d / 2, cy, 0],
    [cx + d / 2, cy, 1],
  ];
  await touch("touchStart", [pts(80)[0]]);
  await touch("touchStart", pts(80));
  for (let i = 1; i <= 10; i++) {
    await sleep(20);
    await touch("touchMove", pts(80 + i * 12));
  }
  await touch("touchEnd", [pts(200)[1]]);
  await touch("touchEnd", []);
  await sleep(700);
  b = await layer();
  check(b.z > a.z * 1.6, `pinch 80 -> 200 px zoomed in (${a.z.toFixed(3)} -> ${b.z.toFixed(3)})`);
  check(!(await sheetOpen()), "the pinch opened no sheet");
} catch (e) {
  check(false, `exception: ${e.message}`);
}
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
await browser.close();
if (own) await own.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall touch checks passed");
process.exit(failures ? 1 : 0);
