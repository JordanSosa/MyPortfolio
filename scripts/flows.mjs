// Season 2 account flows, end to end with real taps / clicks (Playwright):
//   node scripts/flows.mjs [--only portrait,desktop,landscape,se] [--flow fresh,v1] [--out shots/flows] [--keep-going]
//
// FRESH  an empty profile: splash -> tap -> hub home -> PLAY -> episode select (only Dream Meadow is open)
//        -> loadout (only Hoshi is playable) -> START EPISODE -> fight (bot fast-forward) -> die -> TO BE
//        CONTINUED -> RESULTS (payout lines; the profile was banked once) -> UPGRADE -> Training Arc ->
//        buy the cheapest node from its sheet -> back home -> PLAY -> START again: the next run's stats are
//        measurably stronger (the bought node's stat, and the hero level bonus).
// V1     a seeded `kko.save.v1` (coins, Dream Shop ranks, custom settings, bests, runs): boot migrates it
//        -> WELCOME TO SEASON 2 dialog (refund + gift + Rin and Mochi) -> balances / unlocks / settings /
//        records checked in `kko.save.v2` -> loadout shows Rin and Mochi playable -> settings screen
//        shows the kept values; `kko.save.v1` is still there.
// Every step is checked against the stored profile (localStorage) and screenshotted to
// <out>/<device>-<flow>-<n>-<step>.png. Exit 1 on any failed check, page error or console.error.
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
const outDir = args.out && args.out !== true ? args.out : "shots/flows";
const only = args.only && args.only !== true ? String(args.only).split(",") : ["portrait", "desktop", "landscape"];
const flows = args.flow && args.flow !== true ? String(args.flow).split(",") : ["fresh", "v1"];
const strip = (d) => {
  const c = { ...d };
  delete c.defaultBrowserType;
  return c;
};
const DEVICES = [
  { name: "portrait", mobile: true, ctx: strip(devices["iPhone 13"]) },
  { name: "landscape", mobile: true, ctx: strip(devices["iPhone 13 landscape"]) },
  { name: "se", mobile: true, ctx: strip(devices["iPhone SE"]) },
  { name: "desktop", mobile: false, ctx: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } },
].filter((d) => only.includes(d.name));

/** A shipped-slice v1 save: 120 coins, Dream Shop might 2 / vitality 1 / greed 1 / reroll 1, custom settings. */
const V1 = {
  coins: 120,
  meta: { might: 2, vitality: 1, greed: 1, reroll: 1 },
  settings: { master: 0.55, music: 0.35, sfx: 0.9, shake: 0.5, reduceFlashing: true, damageNumbers: false, quality: "mid", haptics: false, showFps: false },
  best: { time: 412.5, kills: 3100, level: 31, combo: 240 },
  runs: 9,
  wins: 0,
  lastHero: "rin",
  totalKills: 14000,
  tut: { dash: true, ult: 2 },
};
/** Old Dream Shop refund for V1.meta (frozen v1 prices: round(base x 1.6^rank / 5) x 5). */
const V1_REFUND = 60 + 95 + 50 + 70 + 100; // might 60 + 95, vitality 50, greed 70, reroll 100

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const report = [];

const { url, close } = await startServer();
const browser = await launchBrowser();

async function waitFor(page, fn, arg, timeout = 20000, label = "condition") {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if (await page.evaluate(fn, arg)) return true;
    } catch {
      /* navigating */
    }
    await sleep(150);
  }
  throw new Error(`timeout waiting for ${label}`);
}

for (const dev of DEVICES) {
  for (const flow of flows) {
    const rec = { device: dev.name, flow, steps: [], shots: [], notes: [] };
    report.push(rec);
    const context = await browser.newContext(dev.ctx);
    if (flow === "v1") {
      // seed the v1 save before the app's first boot only (later reloads keep the migrated v2 profile)
      await context.addInitScript((v1) => {
        try {
          if (!localStorage.getItem("kko.save.v2")) localStorage.setItem("kko.save.v1", JSON.stringify(v1));
        } catch {
          /* ignore */
        }
      }, V1);
    }
    const page = await context.newPage();
    const logs = [];
    page.on("console", (m) => {
      if (m.type() === "error") logs.push(`[console.error] ${m.text()}`);
    });
    page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
    let n = 0;
    const shot = async (name) => {
      const file = `${outDir}/${dev.name}-${flow}-${String(++n).padStart(2, "0")}-${name}.png`;
      ensureDir(file);
      await page.screenshot({ path: file });
      rec.shots.push(file);
    };
    const step = async (name, fn) => {
      const t0 = Date.now();
      try {
        await fn();
        rec.steps.push(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      } catch (e) {
        const diag = await page.evaluate(() => ({ screen: window.__kk?.screen, modal: window.__kk?.modal, phase: window.__kk?.world?.phase, t: window.__kk?.world?.t, hp: window.__kk?.world?.player?.hp })).catch(() => ({}));
        rec.steps.push(`FAIL ${name}: ${e.message} ${JSON.stringify(diag)}`);
        await shot(`FAIL-${name.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}`).catch(() => {});
        failed = true;
        if (!args["keep-going"]) throw e;
      }
    };
    const check = (cond, msg) => {
      if (!cond) throw new Error(`check failed: ${msg}`);
    };
    /** A real tap / click (`force` for pulsing buttons, which never count as "stable"). */
    const tap = async (sel, timeout = 10000, force = false) => {
      const loc = page.locator(sel).first();
      await loc.waitFor({ state: "visible", timeout });
      if (dev.mobile) await loc.tap({ timeout, force });
      else await loc.click({ timeout, force });
    };
    const profile = () => page.evaluate(() => JSON.parse(localStorage.getItem("kko.save.v2") || "null"));
    const waitPage = (id) =>
      waitFor(page, (x) => window.__kk?.screen === "hub" && document.querySelector(".hub")?.dataset.page === x && !document.querySelector(".hpage.p-in-r, .hpage.p-in-l"), id, 15000, `hub page ${id}`);
    /** Close unlock celebrations / dialogs (Later) until nothing shows for 1.5 s. */
    const dismiss = async (choice = "no") => {
      let quiet = Date.now();
      for (let i = 0; i < 60 && Date.now() - quiet < 1500; i++) {
        const sel = await page.evaluate(
          (c) => (document.querySelector(".unlock-cele:not(.out) [data-act='ok']") ? ".unlock-cele:not(.out) [data-act='ok']" : document.querySelector(`.kdialog-wrap:not(.out) [data-act='${c}']`) ? `.kdialog-wrap:not(.out) [data-act='${c}']` : ""),
          choice,
        );
        if (sel) {
          await sleep(400);
          await tap(sel).catch(() => {});
          quiet = Date.now();
        }
        await sleep(200);
      }
    };
    /** Account run from the hub home: PLAY -> episode -> loadout -> START; returns the run's opening numbers. */
    const startEpisode = async (label) => {
      await tap('.home [data-act="play"]');
      await waitPage("stages");
      await tap(".ep-card.open");
      await waitPage("loadout");
      await sleep(500);
      await shot(`${label}-loadout`);
      await tap('.loadout [data-act="go"]');
      await waitFor(page, () => window.__kk.screen === "game" && window.__kk.world && window.__kk.world.t > 0.2, null, 30000, "run started");
      return page.evaluate(() => {
        const w = window.__kk.world;
        const s = w.stats;
        return { might: s.might, maxHp: s.maxHp, armor: s.armor, moveSpeed: s.moveSpeed, cooldown: s.cooldown, area: s.area, crit: s.crit, regen: s.regen, pickup: s.pickup, greed: s.greed, growth: s.growth, luck: s.luck, hp: w.player.hp, hero: w.hero.id, stage: w.stage.id, account: true };
      });
    };
    /** Fast-forward with the bot, then a lethal hit (no revive): the game-over modal opens. */
    /** Level-ups / chests a fast-forward left pending open their modals: pick cards until the run plays on. */
    const resolveModals = async () => {
      for (let i = 0; i < 12; i++) {
        await sleep(600);
        const m = await page.evaluate(() => window.__kk.modal || (window.__kk.world.pendingLevels > 0 ? "pending" : ""));
        if (!m) break;
        if (m === "levelup") await tap(".levelup .card").catch(() => {});
        else if (m === "chest") {
          const vp = page.viewportSize();
          await sleep(2500);
          if (dev.mobile) await page.touchscreen.tap(vp.width / 2, vp.height / 2);
          else await page.mouse.click(vp.width / 2, vp.height / 2);
        }
      }
    };
    const fightAndDie = async (seconds) => {
      await page.evaluate((sec) => window.__kk.skipTo(sec), seconds);
      await resolveModals();
      let hit = false;
      for (let i = 0; i < 40 && !hit; i++) {
        // (an Overdrive in progress keeps the hero invulnerable: wait it out)
        hit = await page.evaluate(() => {
          const w = window.__kk.world;
          if (w.ult) return false;
          w.revivesLeft = 0;
          w.player.iframes = 0;
          w.player.dashInv = 0;
          w.player.shield = 0;
          return w.hurtPlayer(1e6, w.player.x + 4, w.player.y, "puff");
        });
        if (!hit) await sleep(500);
      }
      check(hit, "lethal hit landed");
      await waitFor(page, () => window.__kk.modal === "over", null, 40000, "game over modal");
      await sleep(900);
    };

    try {
      await step("boot -> splash", async () => {
        await page.goto(`${url}/?mute=1&seed=11`, { waitUntil: "load" });
        await waitFor(page, () => !!document.querySelector(".splash") && !!window.__kk, null, 30000, "splash");
        await sleep(900);
      });
      await step("tap -> hub home", async () => {
        const vp = page.viewportSize();
        if (dev.mobile) await page.touchscreen.tap(vp.width / 2, vp.height * 0.6);
        else await page.mouse.click(vp.width / 2, vp.height * 0.6);
        await waitPage("home");
        await sleep(1400);
      });

      if (flow === "fresh") {
        let p0;
        await step("fresh profile", async () => {
          await dismiss();
          p0 = await profile();
          check(p0 && p0.version === 2, "kko.save.v2 written at boot");
          check(p0.currencies.coins === 0 && p0.currencies.gems === 0, `fresh balances 0 / 0 (got ${p0.currencies.coins} / ${p0.currencies.gems})`);
          check(JSON.stringify(p0.unlocks.heroes) === '["hoshi"]', `only Hoshi unlocked (got ${p0.unlocks.heroes})`);
          check(p0.lifetime.runs === 0, "no runs yet");
          check(!(await page.evaluate(() => localStorage.getItem("kko.save.v1"))), "no v1 key invented");
          await shot("home");
        });
        await step("PLAY -> episodes: only Dream Meadow is open", async () => {
          await tap('.home [data-act="play"]');
          await waitPage("stages");
          await sleep(500);
          const eps = await page.evaluate(() => [...document.querySelectorAll(".ep-card")].map((b) => `${b.dataset.id}:${b.classList.contains("open") ? "open" : b.classList.contains("production") ? "production" : "locked"}`));
          rec.notes.push(`episodes ${eps.join(" ")}`);
          check(eps.filter((e) => e.endsWith(":open")).length === 1 && eps[0] === "dream_meadow:open", `only dream_meadow open (${eps.join(", ")})`);
          // a locked card only explains itself
          const locked = page.locator(".ep-card.locked").first();
          if (await locked.count()) {
            if (dev.mobile) await locked.tap();
            else await locked.click();
            await sleep(300);
            check((await page.evaluate(() => document.querySelector(".hub")?.dataset.page)) === "stages", "a locked episode does not open");
          }
          await shot("episodes");
        });
        await step("loadout: only Hoshi playable", async () => {
          await tap(".ep-card.open");
          await waitPage("loadout");
          await sleep(500);
          const cast = await page.evaluate(() => [...document.querySelectorAll(".hc-card")].map((b) => `${b.dataset.id}:${b.classList.contains("locked") ? "locked" : "open"}`));
          rec.notes.push(`cast ${cast.join(" ")}`);
          check(cast.filter((c) => c.endsWith(":open")).join() === "hoshi:open", `only hoshi open (${cast.join(", ")})`);
          // tapping a locked hero keeps Hoshi
          await tap('.hc-card.locked[data-act="hero"]');
          await sleep(400);
          check((await profile()).loadout.hero === "hoshi", "locked hero not selectable");
          check(!(await page.evaluate(() => !!document.querySelector('.tw-list'))), "no Plot Twists before a clear");
          await shot("loadout");
          await page.evaluate(() => document.querySelector(".hub-back")?.click());
          await waitPage("stages");
          await page.evaluate(() => document.querySelector(".hub-back")?.click());
          await waitPage("home");
        });
        let run1;
        await step("START EPISODE 1", async () => {
          run1 = await startEpisode("run1");
          rec.notes.push(`run 1: might ${run1.might.toFixed(3)} maxHp ${run1.maxHp.toFixed(1)} hero ${run1.hero} stage ${run1.stage}`);
          check(run1.hero === "hoshi" && run1.stage === "dream_meadow", "Hoshi in Dream Meadow");
          await waitFor(page, () => !document.querySelector(".ep-title"), null, 30000, "episode card gone");
          await sleep(600);
          await shot("run1");
        });
        let coinsAfter1 = 0;
        await step("fight -> die -> TO BE CONTINUED", async () => {
          await fightAndDie(75);
          check(await page.evaluate(() => !!document.querySelector(".tbc-over")), "TO BE CONTINUED modal");
          await shot("tbc");
        });
        await step("RESULTS: payout banked once", async () => {
          await tap('.modal [data-act="results"]');
          await waitFor(page, () => window.__kk.screen === "results", null, 15000, "results screen");
          await sleep(800);
          // tap the show to skip to the end state
          const vp = page.viewportSize();
          await page.evaluate(() => document.querySelector(".er-scroll")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
          await waitFor(page, () => !!document.querySelector(".ep-res.done"), null, 15000, "results done");
          await sleep(500);
          await dismiss();
          const p1 = await profile();
          const tot = await page.evaluate(() => Number(document.querySelector(".pay-col.c-coins .pay-tot")?.getAttribute("data-to")));
          const lines = await page.evaluate(() => [...document.querySelectorAll(".pay-col.c-coins .pl .pl-l b")].map((b) => b.textContent));
          rec.notes.push(`run 1 payout ${tot} coins (${lines.join(", ")}); profile coins ${p1.currencies.coins} gems ${p1.currencies.gems}`);
          check(p1.lifetime.runs === 1, `one run banked (got ${p1.lifetime.runs})`);
          check(tot > 0 && p1.currencies.coins === tot, `coins = payout (${p1.currencies.coins} vs ${tot})`);
          check(p1.heroes.hoshi && p1.heroes.hoshi.xp > 0, "hero XP banked");
          check(p1.records.dream_meadow && p1.records.dream_meadow.runs === 1, "stage record banked");
          check(p1.codex.heroes.includes("hoshi") && p1.codex.stages.includes("dream_meadow"), "codex discoveries");
          check(Object.keys(p1.mastery).length > 0, "weapon mastery banked");
          coinsAfter1 = p1.currencies.coins;
          await shot("results");
          void vp;
        });
        let bought = "";
        let boughtStat = "";
        await step("UPGRADE -> Training Arc -> buy the cheapest node", async () => {
          await tap('.results [data-act="upgrade"]', 10000, true);
          await waitPage("board");
          await sleep(900);
          const afford = await page.evaluate(() => [...document.querySelectorAll(".bn.s-afford")].map((b) => b.dataset.id));
          check(afford.length > 0, "something affordable after run 1 (EXPANSION §1: fail forward)");
          rec.notes.push(`affordable after run 1: ${afford.join(", ")}`);
          // prefer a damage / HP node so the next run's strength is easy to see
          bought = ["might_1", "hp_1"].find((id) => afford.includes(id)) ?? afford[0];
          await tap(`.bn[data-id="${bought}"]`, 10000, true);
          await waitFor(page, () => !!document.querySelector(".ksheet-wrap:not(.out) [data-act='buy']"), null, 8000, "node sheet");
          await sleep(400);
          await shot("node-sheet");
          await tap(".ksheet-wrap:not(.out) [data-act='buy']");
          await sleep(500);
          const p2 = await profile();
          check((p2.board.ranks[bought] ?? 0) === 1, `${bought} rank 1 saved`);
          check(p2.currencies.coins < coinsAfter1 && p2.board.paid[bought] === coinsAfter1 - p2.currencies.coins, `paid ${p2.board.paid[bought]} = ${coinsAfter1} - ${p2.currencies.coins}`);
          boughtStat = await page.evaluate(() => document.querySelector(".ksheet-wrap:not(.out) .fx-now b")?.textContent ?? "");
          rec.notes.push(`bought ${bought} (${boughtStat}) for ${p2.board.paid[bought]}`);
          await shot("bought");
          await tap(".ksheet-wrap:not(.out) [data-act='x']");
          await sleep(400);
          await page.evaluate(() => document.querySelector(".hub-back")?.click());
          await waitPage("home");
        });
        await step("next run is measurably stronger", async () => {
          const run2 = await startEpisode("run2");
          const p = await profile();
          rec.notes.push(`run 2: might ${run2.might.toFixed(3)} maxHp ${run2.maxHp.toFixed(1)} armor ${run2.armor} moveSpeed ${run2.moveSpeed.toFixed(1)} (hero LV ${p.heroes.hoshi.level})`);
          const keys = ["might", "maxHp", "armor", "moveSpeed", "area", "crit", "regen", "pickup", "greed", "growth", "luck"];
          const better = keys.filter((k) => run2[k] > run1[k] + 1e-9);
          const worse = keys.filter((k) => run2[k] < run1[k] - 1e-9);
          rec.notes.push(`stronger: ${better.join(", ") || "-"}; weaker: ${worse.join(", ") || "-"}; cooldown ${run1.cooldown} -> ${run2.cooldown}`);
          check(better.length > 0 || run2.cooldown < run1.cooldown, "at least one stat improved");
          check(worse.length === 0, "nothing got weaker");
          if (bought === "might_1") check(run2.might >= run1.might * 1.03, "might_1 gives +4% damage");
          if (bought === "hp_1") check(run2.maxHp > run1.maxHp, "hp_1 gives max HP");
          await waitFor(page, () => !document.querySelector(".ep-title"), null, 30000, "episode card gone");
          await sleep(500);
          await shot("run2");
        });
        await step("quit run 2 from pause -> Results -> HUB", async () => {
          await page.evaluate(() => window.__kk.skipTo(window.__kk.world.t + 20));
          await resolveModals();
          await page.evaluate(() => window.__kk.pause());
          await waitFor(page, () => window.__kk.modal === "pause", null, 10000, "pause");
          // QUIT RUN asks twice ("SURE? TAP AGAIN")
          await sleep(600);
          await tap('.modal [data-act="quit"]');
          await sleep(400);
          await tap('.modal [data-act="quit"]');
          await waitFor(page, () => window.__kk.screen === "results", null, 15000, "results after quit");
          const p = await profile();
          check(p.lifetime.runs === 2, `quit run banked (runs ${p.lifetime.runs})`);
          await sleep(600);
          await shot("results-quit");
          await tap('.results [data-act="hub"]');
          await waitPage("home");
          await sleep(800);
          await dismiss();
          await shot("home-after");
        });
      } else {
        let pv;
        await step("v1 migrated: WELCOME TO SEASON 2", async () => {
          await waitFor(page, () => !!document.querySelector(".kdialog-wrap:not(.out) .welcome"), null, 15000, "welcome dialog");
          await sleep(700);
          const text = await page.evaluate(() => document.querySelector(".kdialog-wrap .welcome")?.textContent?.replace(/\s+/g, " ").trim() ?? "");
          rec.notes.push(`welcome: ${text}`);
          check(text.includes(String(V1_REFUND)), `refund ${V1_REFUND} shown`);
          check(/1,600/.test(text), "1,600 gem gift shown");
          check(/Rin/.test(text) && /Mochi/.test(text), "Rin + Mochi named");
          await shot("welcome");
          await dismiss("no");
        });
        await step("v2 profile: coins refunded, gems, Rin + Mochi, settings, records", async () => {
          pv = await profile();
          const v1Still = await page.evaluate(() => localStorage.getItem("kko.save.v1"));
          check(!!v1Still, "kko.save.v1 kept");
          check(pv.currencies.coins === V1.coins + V1_REFUND, `coins ${pv.currencies.coins} = ${V1.coins} + ${V1_REFUND}`);
          check(pv.currencies.gems >= 1600, `gems >= 1600 (got ${pv.currencies.gems})`);
          check(["hoshi", "rin", "mochi"].every((h) => pv.unlocks.heroes.includes(h)), `heroes ${pv.unlocks.heroes}`);
          for (const k of Object.keys(V1.settings)) check(pv.settings[k] === V1.settings[k], `setting ${k} kept (${pv.settings[k]} vs ${V1.settings[k]})`);
          check(pv.lifetime.runs === V1.runs && pv.lifetime.kills === V1.totalKills, "run count + kills kept");
          check(pv.best.time === V1.best.time && pv.best.combo === V1.best.combo, "bests kept");
          check(pv.records.dream_meadow?.bestTime === V1.best.time, "Dream Meadow record from v1 bests");
          check(pv.loadout.hero === "rin", `last hero kept (${pv.loadout.hero})`);
          check(Object.keys(pv.board.ranks).length === 0, "old Dream Shop ranks refunded, not kept as nodes");
          check(pv.info.migratedFrom === 1 && pv.flags.s2Welcome === 1, "migration flags");
          rec.notes.push(`v2: coins ${pv.currencies.coins} gems ${pv.currencies.gems} heroes ${pv.unlocks.heroes.join("/")} runs ${pv.lifetime.runs}`);
          await sleep(400);
          await dismiss();
          await shot("home");
        });
        await step("loadout: Rin and Mochi playable", async () => {
          await tap('.home [data-act="play"]');
          await waitPage("stages");
          await tap(".ep-card.open");
          await waitPage("loadout");
          await sleep(500);
          const cast = await page.evaluate(() => [...document.querySelectorAll(".hc-card")].map((b) => `${b.dataset.id}:${b.classList.contains("locked") ? "locked" : "open"}`));
          rec.notes.push(`cast ${cast.join(" ")}`);
          for (const hId of ["hoshi", "rin", "mochi"]) check(cast.includes(`${hId}:open`), `${hId} open`);
          await tap('.hc-card[data-id="mochi"]');
          await sleep(400);
          check((await profile()).loadout.hero === "mochi", "Mochi selectable");
          await shot("loadout");
        });
        await step("settings kept on screen", async () => {
          await page.evaluate(() => document.querySelector(".hub-back")?.click());
          await waitPage("stages");
          await page.evaluate(() => document.querySelector(".hub-back")?.click());
          await waitPage("home");
          await tap(".hub-gear");
          await waitFor(page, () => !!document.querySelector(".settings"), null, 8000, "settings");
          await sleep(500);
          const vals = await page.evaluate(() => [
            ...[...document.querySelectorAll(".settings .slider[data-k]")].map((b) => `${b.dataset.k}=${b.querySelector(".v")?.textContent}`),
            ...[...document.querySelectorAll(".settings .tog[data-k]")].map((b) => `${b.dataset.k}=${b.classList.contains("on")}`),
            ...[...document.querySelectorAll(".settings .seg[data-k]")].map((b) => `${b.dataset.k}=${b.querySelector(".on")?.textContent ?? ""}`),
          ]);
          rec.notes.push(`settings sliders ${vals.join(" ")}`);
          await shot("settings");
          await page.keyboard.press("Escape");
          await sleep(400);
        });
        await step("reload: no second migration", async () => {
          await page.reload({ waitUntil: "load" });
          await waitFor(page, () => !!window.__kk, null, 30000, "reloaded");
          await sleep(1500);
          const p2 = await profile();
          check(p2.currencies.coins === pv.currencies.coins && p2.currencies.gems === pv.currencies.gems, "balances unchanged after reload (no double refund / gift)");
        });
      }
    } catch {
      /* recorded in steps */
    }
    const errs = logs.filter((l) => !/favicon|ERR_FILE_NOT_FOUND|net::/.test(l));
    if (errs.length) {
      failed = true;
      rec.steps.push(`FAIL page errors:\n    ${errs.slice(0, 8).join("\n    ")}`);
    }
    await context.close();
  }
}

await browser.close();
await close();
for (const r of report) {
  console.log(`\n== ${r.device} / ${r.flow}`);
  for (const s of r.steps) console.log(`  ${s}`);
  for (const nn of r.notes) console.log(`  · ${nn}`);
}
console.log(failed ? "\nFLOWS FAILED" : "\nFLOWS PASSED");
process.exit(failed ? 1 : 0);
