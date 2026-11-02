// Peak-chaos readability: limiter ON vs OFF shots of a 6-evolution crowd scene and a late autoplay run.
//   node scripts/peak.mjs [allevo,late-hoshi,late-mochi,lady]   -> shots/peak/<name>-limiter-on|off.png
import { startServer, launchBrowser, newPage, ensureDir } from "./lib.mjs";

const filter = process.argv[2] ?? "";
const OUT = "shots/peak";
const S = [
  { name: "allevo", give: [["love_tornado", 1], ["raijin_drum", 1], ["sugar_nuke", 1], ["ocean_dome", 1], ["rainbow_cannon", 1], ["galaxy_barrage", 1]], keep: 220, wait: `__kk.world.t > 3.5` },
  { name: "late-hoshi", url: "/?autoplay=1&hero=hoshi&skip=470&god=1&seed=7&mute=1", wait: `__kk.world.t > 474` },
  { name: "late-mochi", url: "/?autoplay=1&hero=mochi&skip=500&god=1&seed=3&mute=1", wait: `__kk.world.t > 504` },
  { name: "lady", url: "/?autoplay=1&hero=rin&skip=575&god=1&seed=4&mute=1", wait: `__kk.world.t > 578 && __kk.world.bullets.count > 20` },
];

const srv = await startServer();
const browser = await launchBrowser();
try {
  for (const sc of S) {
    if (filter && !filter.split(",").includes(sc.name)) continue;
    const page = await newPage(browser, { mobile: true });
    await page.addInitScript(() => localStorage.setItem("kko.save.v1", JSON.stringify({ runs: 9, lastHero: "hoshi" })));
    await page.goto(`${srv.url}${sc.url ?? `/?screen=game&hero=hoshi&god=1&seed=5&mute=1`}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__kk && window.__kk.world && window.__kk.screen === "game", null, { timeout: 60000 });
    await page.waitForTimeout(500);
    if (!sc.url)
      await page.evaluate(() => {
        __kk.clearWeapons();
        const w = __kk.world;
        for (let i = 0; i < w.enemies.count; i++) w.despawn(w.enemies.items[i]);
        w.directorOn = false;
        w.xpNext = 1e9;
      });
    else await page.evaluate(() => (__kk.world.xpNext = 1e9));
    for (const [id, lv] of sc.give ?? []) await page.evaluate(([id, lv]) => __kk.give(id, lv), [id, lv]);
    if (sc.keep)
      await page.evaluate(
        (n) =>
          setInterval(() => {
            const w = __kk.world;
            let g = 0;
            while (w.enemyCount < n && g++ < 40) {
              const a = Math.random() * 6.283;
              const r = 60 + Math.random() * 90;
              w.spawnEnemy(Math.random() < 0.15 ? "shroomie" : "puff", w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r * 1.4);
            }
          }, 60),
        sc.keep,
      );
    await page.waitForFunction(sc.wait, null, { timeout: 90000, polling: 50 });
    // let the limiter settle on the live scene, then freeze and shoot ON / OFF
    await page.waitForTimeout(1500);
    await page.evaluate(() => (__kk.time.paused = true));
    await page.waitForTimeout(600);
    const on = await page.evaluate(() => ({ load: __kk.app.r.post.load.toFixed(2), glow: __kk.app.r.stats.glow, nums: __kk.app.fx.dmg.alive, enemies: __kk.world.enemyCount, bullets: __kk.world.bullets.count }));
    let file = `${OUT}/${sc.name}-limiter-on.png`;
    ensureDir(file);
    await page.screenshot({ path: file });
    console.log(`[${sc.name}] ON`, JSON.stringify(on), file);
    await page.evaluate(() => {
      __kk.app.r.post.bloomLimit = 0;
      __kk.app.fx.dmg.busy = 0;
    });
    await page.waitForTimeout(600);
    file = `${OUT}/${sc.name}-limiter-off.png`;
    await page.screenshot({ path: file });
    console.log(`[${sc.name}] OFF`, file);
    const errs = page.__logs.filter((l) => l.startsWith("[pageerror]") || l.startsWith("[error]"));
    if (errs.length) console.log(errs.join("\n"));
    await page.context().close();
  }
} finally {
  await browser.close();
  await srv.close();
}
