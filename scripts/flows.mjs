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
// ENDLESS a progressed profile (Dream Meadow cleared): loadout -> Filler Arc toggle + a Plot Twist by tap ->
//        START -> the final boss falls -> TO BE CONTINUED... JUST KIDDING (Filler Arc) -> die -> Episode
//        Results ("SERIES FINALE?!", Filler Arc line, heat line) -> the clear, endless record, heat and banner
//        rotation are banked.
// NAV    Android Back (history) in every state: a sheet over the loadout, hub pages, the episode card
//        (pause opens after GO!), in-run pause / resume, level-up / game over (ignored), Results -> hub, and
//        at the hub home Back leaves the page.
// KEYS   (desktop) keyboard only: splash -> home -> episodes -> loadout -> run -> pause / resume -> level-up
//        -> game over -> Results -> UPGRADE -> Training Arc -> Escape back home; the default focus is
//        checked on every screen.
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
const flows = args.flow && args.flow !== true ? String(args.flow).split(",") : ["fresh", "v1", "endless", "nav", "keys"];
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
/** A save v2 profile that cleared Dream Meadow once (Plot Twists and the Filler Arc are open). */
const CLEARED = {
  version: 2,
  currencies: { coins: 900, gems: 200, copium: 0 },
  unlocks: { heroes: ["hoshi", "rin", "mochi"], weapons: [], passives: [], stages: ["dream_meadow"], twists: ["budget_cuts", "filler_overload", "rushed_production", "censored", "cliffhanger", "power_creep"], relicSlots: 0 },
  heroes: { hoshi: { xp: 2400, level: 1, talents: {}, constellation: 0, runs: 7, clears: 1, kills: 30000, time: 2600, bestTime: 640, talentRespecs: 0 } },
  loadout: { stage: "dream_meadow", hero: "hoshi", relics: [], twists: {}, endless: false, startWeapon: null },
  records: { dream_meadow: { runs: 7, clears: 1, bestTime: 640, bestHeat: 0, bestEndless: 0, bestKills: 26000, bestLevel: 58, bestCombo: 900, firstClear: 7 } },
  lifetime: { runs: 7, clears: 1, deaths: 6, time: 2600, kills: 30000, bossKills: { king_puff: 5, nightmare_teddy: 2, lady_lunatic: 1 } },
  codex: { heroes: ["hoshi"], stages: ["dream_meadow"], enemies: [], bosses: ["king_puff", "nightmare_teddy", "lady_lunatic"], weapons: ["star_shot"], passives: [], relics: [] },
  flags: { s2Welcome: 1 },
  settings: { master: 0.8, music: 0.7, sfx: 0.85, shake: 1, reduceFlashing: false, damageNumbers: true, quality: "auto", haptics: true, showFps: false },
};

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
    if (flow === "keys" && dev.mobile) continue;
    const rec = { device: dev.name, flow, steps: [], shots: [], notes: [] };
    report.push(rec);
    const context = await browser.newContext(dev.ctx);
    if (flow === "endless") {
      await context.addInitScript((seed) => {
        try {
          if (!localStorage.getItem("kko.save.v2")) localStorage.setItem("kko.save.v2", JSON.stringify(seed));
        } catch {
          /* ignore */
        }
      }, CLEARED);
    }
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
      // layout: no horizontal page overflow; no button cut off at the screen edge (scrolling strips / the board excepted)
      const ov = await page
        .evaluate(() => {
          const vw = window.innerWidth;
          const doc = (document.scrollingElement?.scrollWidth ?? 0) > vw + 1;
          const cut = [];
          for (const b of document.querySelectorAll("button")) {
            if (b.offsetParent === null || b.closest(".kscroll-x, .season-strip, .tabbar, .kvp, .levelup, .hud, .touch, [inert], .out, .p-out-l, .p-out-r")) continue;
            const r = b.getBoundingClientRect();
            if (r.width > 0 && (r.left < -1 || r.right > vw + 1)) cut.push(`${b.dataset.act ?? b.className.split(" ")[0]}@${Math.round(r.left)}..${Math.round(r.right)}`);
          }
          return { doc, cut: cut.slice(0, 6) };
        })
        .catch(() => ({ doc: false, cut: [] }));
      if (ov.doc || ov.cut.length) {
        rec.notes.push(`LAYOUT ${name}: ${ov.doc ? "page overflows horizontally; " : ""}${ov.cut.join(" ")}`);
        failed = true;
      }
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
    /**
     * Tap until `cond` holds: modal buttons ignore taps for their first 0.5 s of FRAME time (ghost-tap guard),
     * and headless SwiftShader runs a few frames per second, so one early tap can be dropped on purpose.
     */
    const tapUntil = async (sel, cond, label, tries = 6) => {
      for (let i = 0; i < tries; i++) {
        await tap(sel).catch(() => {});
        try {
          await waitFor(page, cond, null, 3000, label);
          return;
        } catch {
          /* tap again */
        }
      }
      throw new Error(`timeout waiting for ${label}`);
    };
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
          await tapUntil('.modal [data-act="results"]', () => window.__kk.screen === "results", "results screen");
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
          check(p1.rotation.runsLeft === 2, `banner rotation advanced once (runsLeft ${p1.rotation.runsLeft})`);
          check(Object.keys(p1.achievements.progress).length + Object.keys(p1.achievements.done).length > 0, "Plot Points evaluated");
          check(!(await page.evaluate(() => !!document.querySelector(".er-practice"))), "an account run is not a practice run");
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
          check(p.rotation.runsLeft === 1, `banner rotation (runsLeft ${p.rotation.runsLeft})`);
          await sleep(600);
          await shot("results-quit");
          await tap('.results [data-act="hub"]');
          await waitPage("home");
          await sleep(800);
          await dismiss();
          await shot("home-after");
        });
      } else if (flow === "v1") {
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
      } else if (flow === "endless") {
        await step("home (a profile that cleared Dream Meadow)", async () => {
          await dismiss();
          const p = await profile();
          check(p.records.dream_meadow.clears === 1 && p.unlocks.twists.includes("budget_cuts"), "seeded clear + twists");
        });
        await step("loadout: Filler Arc on + Budget Cuts rank 1 (by tap)", async () => {
          await tap('.home [data-act="play"]');
          await waitPage("stages");
          await tap(".ep-card.open");
          await waitPage("loadout");
          await sleep(500);
          await tap('.loadout [data-act="endless"]');
          await waitFor(page, () => JSON.parse(localStorage.getItem("kko.save.v2")).loadout.endless === true, null, 5000, "endless saved");
          await tap('.loadout [data-act="tw+"][data-id="budget_cuts"]');
          await waitFor(page, () => JSON.parse(localStorage.getItem("kko.save.v2")).loadout.twists.budget_cuts === 1, null, 5000, "twist saved");
          await sleep(500);
          const heat = await page.evaluate(() => document.querySelector(".heat-n b")?.textContent ?? "");
          check(heat === "1", `heat meter shows 1 (got "${heat}")`);
          await page.evaluate(() => document.querySelector(".lo-toggle")?.scrollIntoView({ block: "center" }));
          await sleep(300);
          await shot("loadout");
        });
        await step("START: the Filler Arc and the heat reach the run", async () => {
          await tap('.loadout [data-act="go"]');
          await waitFor(page, () => window.__kk.screen === "game" && window.__kk.world && window.__kk.world.t > 0.2, null, 30000, "run started");
          const r = await page.evaluate(() => {
            const w = window.__kk.world;
            return { endless: w.run.endless, heat: w.heat, twists: w.twistIds.join(","), acct: !window.__kk.app.practice };
          });
          rec.notes.push(`run: ${JSON.stringify(r)}`);
          check(r.endless === true && r.heat === 1 && r.twists === "budget_cuts" && r.acct, "endless + heat 1 + account run");
        });
        await step("the final boss falls -> TO BE CONTINUED... JUST KIDDING (Filler Arc)", async () => {
          await page.evaluate(() => window.__kk.god(true));
          await page.evaluate(() => window.__kk.skipTo(546));
          await resolveModals();
          for (let i = 0; i < 20; i++) {
            if (await page.evaluate(() => window.__kk.world.boss?.def.id === "lady_lunatic" && !window.__kk.world.boss.dead)) break;
            await page.evaluate(() => window.__kk.skipTo(window.__kk.world.t + 3));
            await resolveModals();
          }
          check(await page.evaluate(() => window.__kk.world.boss?.def.id === "lady_lunatic"), "Lady Lunatic is on stage");
          await page.evaluate(() => {
            const w = window.__kk.world;
            w.killEnemy(w.boss, null);
          });
          await waitFor(page, () => window.__kk.world.endlessOn === true, null, 40000, "Filler Arc started");
          await sleep(2500);
          await shot("filler-tbc");
          // (a level-up or chest that pops in these seconds pauses the world: pick / open it, then keep waiting)
          for (let i = 0; i < 6 && !(await page.evaluate(() => window.__kk.world.t > window.__kk.world.endlessFrom + 4)); i++) {
            await resolveModals();
            await sleep(1500);
          }
          await waitFor(page, () => window.__kk.world.t > window.__kk.world.endlessFrom + 4, null, 60000, "Filler Arc plays on");
          await shot("filler-arc");
        });
        await step("Filler Arc -> die -> Results: SERIES FINALE?! + Filler Arc line", async () => {
          await page.evaluate(() => window.__kk.skipTo(window.__kk.world.t + 25));
          await resolveModals();
          await page.evaluate(() => window.__kk.god(false));
          await fightAndDie(0);
          await tapUntil('.modal [data-act="results"]', () => window.__kk.screen === "results", "results screen");
          await sleep(800);
          await page.evaluate(() => document.querySelector(".er-scroll")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
          await waitFor(page, () => !!document.querySelector(".ep-res.done"), null, 15000, "results done");
          await dismiss();
          const ui = await page.evaluate(() => ({
            finale: document.querySelector(".er-finale")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
            lines: [...document.querySelectorAll(".pay-col.c-coins .pl .pl-l b")].map((b) => b.textContent),
          }));
          rec.notes.push(`results: ${ui.finale} | ${ui.lines.join(", ")}`);
          check(/SERIES FINALE/.test(ui.finale), "SERIES FINALE?! stinger");
          check(ui.lines.includes("Filler Arc bonus") && ui.lines.some((l) => /^Heat 1$/.test(l)), "Filler Arc + heat payout lines");
          const p = await profile();
          const r = p.records.dream_meadow;
          rec.notes.push(`record: clears ${r.clears} bestEndless ${r.bestEndless.toFixed(1)} bestHeat ${r.bestHeat}; runs ${p.lifetime.runs}; rotation ${p.rotation.runsLeft}`);
          check(r.clears === 2 && r.bestEndless > 20 && r.bestHeat === 1, "clear + endless record + heat banked");
          check(p.lifetime.runs === 8 && p.rotation.runsLeft === 2, "run counted, rotation advanced");
          await shot("results");
          await tap('.results [data-act="hub"]');
          await waitPage("home");
        });
      } else if (flow === "nav") {
        await step("hub: Back closes a sheet, then pops pages", async () => {
          await dismiss();
          await tap('.home [data-act="play"]');
          await waitPage("stages");
          await tap(".ep-card.open");
          await waitPage("loadout");
          await sleep(500);
          await tap('.rslot[data-act="slot"]');
          await waitFor(page, () => !!document.querySelector(".ksheet-wrap:not(.out)"), null, 8000, "relic sheet");
          await sleep(500);
          await page.goBack();
          await waitFor(page, () => !document.querySelector(".ksheet-wrap:not(.out)"), null, 8000, "sheet closed by Back");
          check(await page.evaluate(() => document.querySelector(".hub")?.dataset.page === "loadout"), "still on the loadout");
          await sleep(400);
          await page.goBack();
          await waitPage("stages");
          await page.goBack();
          await waitPage("home");
          check(page.url().startsWith(url), "still in the app");
        });
        await step("episode card: Back during the stinger pauses right after GO!", async () => {
          await tap('.home [data-act="play"]');
          await waitPage("stages");
          await tap(".ep-card.open");
          await waitPage("loadout");
          await tap('.loadout [data-act="go"]');
          await waitFor(page, () => window.__kk.screen === "game" && !!document.querySelector(".ep-title"), null, 15000, "episode card");
          await page.goBack();
          await sleep(300);
          check(await page.evaluate(() => window.__kk.modal === ""), "no pause over the episode card");
          await waitFor(page, () => window.__kk.modal === "pause", null, 30000, "pause after GO!");
          await sleep(500);
          await shot("pause-after-card");
        });
        await step("in-run: Back resumes, pauses, resumes", async () => {
          await page.goBack();
          await waitFor(page, () => window.__kk.modal === "", null, 8000, "resumed");
          await sleep(700);
          await page.goBack();
          await waitFor(page, () => window.__kk.modal === "pause", null, 8000, "Back pauses");
          await sleep(500);
          await page.goBack();
          await waitFor(page, () => window.__kk.modal === "", null, 8000, "Back resumes");
          check(page.url().startsWith(url), "still in the app");
        });
        await step("level-up: Back is ignored (a card is required)", async () => {
          await page.evaluate(() => window.__kk.levelUp());
          await waitFor(page, () => window.__kk.modal === "levelup", null, 20000, "level-up");
          await sleep(700);
          await page.goBack();
          await sleep(900);
          check(await page.evaluate(() => window.__kk.modal === "levelup"), "level-up still open");
          check(page.url().startsWith(url), "still in the app");
          await tap(".levelup .card");
          await waitFor(page, () => window.__kk.modal === "", null, 8000, "card picked");
        });
        await step("game over: Back is ignored; Results: Back goes to the hub", async () => {
          await fightAndDie(0);
          await page.goBack();
          await sleep(900);
          check(await page.evaluate(() => window.__kk.modal === "over"), "game over still open");
          await tapUntil('.modal [data-act="results"]', () => window.__kk.screen === "results", "results");
          await sleep(900);
          await page.goBack();
          for (let i = 0; i < 8 && !(await page.evaluate(() => window.__kk.screen === "hub")); i++) {
            await sleep(600);
            // (an unlock celebration the Back brought forward closes first)
            if (await page.evaluate(() => !!document.querySelector(".unlock-cele:not(.out)"))) await page.goBack();
          }
          await waitPage("home");
          const p = await profile();
          check(p.lifetime.runs === 1, `the run was banked once (runs ${p.lifetime.runs})`);
        });
        await step("hub home: Back leaves the page", async () => {
          await dismiss();
          await sleep(500);
          await page.goBack().catch(() => {});
          await sleep(1200);
          check(!page.url().startsWith(url), `left the app (url ${page.url()})`);
        });
      } else if (flow === "keys") {
        const focused = () =>
          page.evaluate(() => {
            const f = document.querySelector(".nav-focus");
            return f ? f.dataset.act ?? f.dataset.id ?? "" : "";
          });
        // (headless SwiftShader draws the hub at a few frames per second: a key edge is read on the App's next
        // frame, so wait for frames to pass before the next key, or presses pile up into one frame)
        const frames = (n = 3) => page.evaluate((k) => new Promise((r) => { const f = (i) => (i <= 0 ? r() : requestAnimationFrame(() => f(i - 1))); f(k); }), n);
        const key = async (k, wait = 260) => {
          await page.keyboard.press(k);
          await frames();
          await sleep(wait);
        };
        const expectFocus = async (act, where) => {
          let f = "";
          for (let i = 0; i < 15 && f !== act; i++) {
            f = await focused();
            if (f !== act) await sleep(200);
          }
          check(f === act, `${where}: default focus "${act}" (got "${f}")`);
        };
        await step("every hub page takes the keyboard focus on itself (never on a page sliding away)", async () => {
          await dismiss();
          await key("ArrowDown"); // keyboard mode on: the ring shows on home's default (PLAY), and stays on it
          for (const id of ["board", "heroes", "gacha", "wiki", "stages"]) {
            await page.evaluate((x) => document.querySelector(`.home [data-act="${x === "stages" ? "play" : x}"]`)?.click(), id);
            await waitPage(id);
            await key("ArrowDown", 350);
            const f = await page.evaluate((x) => {
              const el = document.querySelector(".nav-focus");
              if (!el) return "none";
              const r = el.getBoundingClientRect();
              // (the first focus lands on the page itself, never on the header's Back: a gamepad A must not pop it)
              const inPage = !!el.closest(`.hub[data-page="${x}"] .hpage:not([hidden]):not([inert])`);
              const onScreen = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
              return inPage && onScreen ? "ok" : `${el.dataset.act ?? el.className} (in page ${inPage}, on screen ${onScreen})`;
            }, id);
            check(f === "ok", `${id}: focus ${f}`);
            await key("Escape", 500);
            await waitPage("home");
            await sleep(300);
          }
        });
        await step("home -> episodes -> loadout -> START with Enter only", async () => {
          await dismiss();
          if (!(await focused())) await key("ArrowDown"); // the first arrow shows the ring on the default
          await expectFocus("play", "home (focus kept on PLAY after every page popped)");
          await key("Enter", 500);
          await waitPage("stages");
          await expectFocus("ep", "episodes");
          await key("Enter", 500);
          await waitPage("loadout");
          await expectFocus("go", "loadout");
          await shot("loadout-focus");
          await key("Enter");
          await waitFor(page, () => window.__kk.screen === "game" && window.__kk.world && window.__kk.world.t > 0.3, null, 30000, "run started by Enter");
        });
        await step("in-run: Escape pauses (RESUME focused), Escape resumes; arrows steer", async () => {
          await page.keyboard.down("ArrowRight");
          await sleep(900);
          await page.keyboard.up("ArrowRight");
          const moved = await page.evaluate(() => window.__kk.world.player.x);
          check(moved > 1, `arrows move the hero (x ${moved.toFixed(1)})`);
          await key("Escape", 600);
          await waitFor(page, () => window.__kk.modal === "pause", null, 8000, "pause");
          await expectFocus("resume", "pause");
          await key("Escape", 600);
          await waitFor(page, () => window.__kk.modal === "", null, 8000, "resumed");
        });
        await step("level-up: Enter picks the focused card", async () => {
          await page.evaluate(() => window.__kk.levelUp());
          await waitFor(page, () => window.__kk.modal === "levelup", null, 20000, "level-up");
          await sleep(900);
          const lv = await page.evaluate(() => window.__kk.world.buildVersion);
          await key("ArrowRight");
          await key("Enter", 600);
          await waitFor(page, () => window.__kk.modal === "", null, 8000, "card picked by Enter");
          check((await page.evaluate(() => window.__kk.world.buildVersion)) !== lv, "the build changed");
        });
        await step("game over -> RESULTS -> UPGRADE -> Training Arc -> Escape home, by keys", async () => {
          await fightAndDie(20);
          await expectFocus("retry", "game over");
          await key("ArrowRight");
          check((await focused()) === "results", `RESULTS reachable (focus "${await focused()}")`);
          await key("Enter", 800);
          await waitFor(page, () => window.__kk.screen === "results", null, 15000, "results");
          await sleep(600);
          await key("ArrowDown");
          await dismiss();
          const p = await profile();
          const def = p.currencies.coins >= 25 ? "upgrade" : "retry";
          await expectFocus(def, "results");
          if (def === "upgrade") {
            await key("Enter", 800);
            await waitPage("board");
            await sleep(600);
            await shot("board-keys");
            await key("Escape", 800);
            await waitPage("home");
          }
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
