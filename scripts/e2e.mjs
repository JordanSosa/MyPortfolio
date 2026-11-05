// End-to-end smoke test: desktop, mobile portrait and mobile landscape.
//   node scripts/e2e.mjs [--only desktop|portrait|landscape] [--out shots/e2e] [--keep-going] [--serial] [--joystick] [--devmode]
// (the devices run in parallel, one browser each; --serial runs them one after another; --joystick runs only D, ~60 s;
// --devmode runs only E, ~40 s; both flags: D and E)
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
//   D) (mobile) the joystick across modals, with real multi-touch (CDP, several fingers, step mode): a finger
//      held through a level-up / chest / pause, a thumb put back down during the level-up close delay (on the
//      fading backdrop or a card), a second offer, a finger held on DASH, pointercancel, a tap on the closing
//      modal, a resting second thumb while the stick thumb repositions (it must never take the stick).
//      After each: the held finger steers (knob under it, the hero walks); no finger down = no move and
//      no knob. (Season 3 owner bug: "the stick gets stuck after picking an upgrade".) Then SECOND-THUMB TAPS
//      with the stick thumb held (Chromium sends such a tap no click): pick a level-up card (exactly one pick), a
//      thumb held from the first offer never picks from the next, open + collect a chest (one step per tap), the
//      HUD pause button, SETTINGS / DONE and RESUME; a drag over the pause panel presses nothing; the narrator
//      caption and the Plot Point toast never catch a tap.
//   E) (mobile) developer mode: without it a 3-finger long-press and the ` key never open the dev console; 7 taps on
//      the Settings build label switch it on (toast, kept across a reload: then the long-press opens the console)
//      and off again; ?dev=1 turns it on (and opens the console), ?dev=0 off.
// Every device also checks that no layer fading out of #ui (a screen, a modal: .out) is ever hit-testable.
// Screenshots go to shots/e2e/<device>-<step>.png. Fails (exit 1) on any page error or
// console.error, or when a step's expected state is not reached.
import { parseArgs, startServer, launchBrowser, newPage, ensureDir } from "./lib.mjs";

const args = parseArgs();
const outDir = args.out && args.out !== true ? args.out : "shots/e2e";
const DEVICES = [
  { name: "desktop", opts: { w: 1280, h: 720 } },
  { name: "portrait", opts: { mobile: true } },
  { name: "landscape", opts: { mobile: true, landscape: true } },
].filter((d) => (!args.only || args.only === d.name) && ((!args.joystick && !args.devmode) || d.opts.mobile));
/** --joystick / --devmode: run only the steps of D / E (both flags: both). */
const ONLY_STEPS = [args.joystick && "joystick", args.devmode && "devmode"].filter(Boolean);
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

/**
 * D) the joystick across modals: real multi-touch through CDP (Input.dispatchTouchEvent with several touch points,
 * so Chrome's own pointer / gesture pipeline runs) on `run:early` in step mode. Real waits are only the UI's own
 * timers (the level-up's 430 ms close delay). Notes: Chrome gives a SECOND finger's tap no click while another
 * finger is down, so "a modal closes while a finger is held" is a programmatic click (a key press would switch the
 * game to keyboard mode and hide the touch controls); touchmoves reach the page aligned to animation frames, and
 * step mode requests none, so every step first flushes one.
 */
async function joystickSteps(browser, dev, step, rec) {
  const page = await newPage(browser, dev.opts);
  let cdp = null;
  try {
    await step("joystick: run:early in step mode", async () => {
      await page.goto(`${url}/?scenario=run:early&step=1&mute=1`, { waitUntil: "load" });
      await waitFor(page, () => ["ready", "error"].includes(document.documentElement.dataset.kkScenario), null, 60000, "run:early");
      if ((await page.evaluate(() => document.documentElement.dataset.kkScenario)) !== "ready") throw new Error("scenario run:early failed");
      cdp = await page.context().newCDPSession(page);
    });
    if (!cdp) return;
    const fingers = new Map();
    let nextId = 1;
    const tp = (id) => ({ x: fingers.get(id).x, y: fingers.get(id).y, id, radiusX: 4, radiusY: 4, force: 1 });
    const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
    const down = async (x, y) => {
      const id = nextId++;
      fingers.set(id, { x, y });
      await touch("touchStart", [...fingers.keys()].map(tp));
      return id;
    };
    const move = async (id, x, y) => {
      fingers.set(id, { x, y });
      await touch("touchMove", [...fingers.keys()].map(tp));
    };
    // (four moves: the first one after an adoption only centres the stick)
    const drag = async (id, dx, dy) => {
      const { x, y } = fingers.get(id);
      for (let i = 1; i <= 4; i++) await move(id, x + (dx * i) / 4, y + (dy * i) / 4);
    };
    // (a touchEnd listing one point releases that finger only)
    const up = async (id) => {
      const p = tp(id);
      fingers.delete(id);
      await touch("touchEnd", [p]);
    };
    const cancelAll = async () => {
      fingers.clear();
      await touch("touchCancel", []);
    };
    const flush = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
    const frames = async (n) => {
      await flush();
      await page.evaluate((k) => window.__kk.step(k), n);
    };
    const state = () =>
      page.evaluate(() => {
        const a = window.__kk.app;
        const i = a.input;
        const k = i.touch.knob.getBoundingClientRect();
        const p = a.game.world.player;
        return { modal: a.modalKind, mx: i.move.x, my: i.move.y, stick: i.stickActive, knob: i.touch.stick.classList.contains("on"), kx: k.x + k.width / 2, ky: k.y + k.height / 2, px: p.x, py: p.y };
      });
    const check = (ok, msg) => {
      if (!ok) throw new Error(msg);
    };
    const vp = page.viewportSize();
    // play-area spots clear of the HUD, DASH / OVERDRIVE (bottom right) and the pause button (top right)
    const P1 = { x: Math.round(vp.width * 0.28), y: Math.round(vp.height * 0.7) };
    const P2 = { x: Math.round(vp.width * 0.4), y: Math.round(vp.height * 0.45) };
    const fmt = (s) => `move ${s.mx.toFixed(2)},${s.my.toFixed(2)} knob ${s.knob} stick ${s.stick}`;
    /** INVARIANT: no finger down -> no move, no knob */
    const idle = async (label) => {
      await frames(2);
      const s = await state();
      check(s.mx === 0 && s.my === 0 && !s.knob && !s.stick, `${label}: no finger is down but ${fmt(s)}`);
    };
    /** the held finger steers: the knob sits under it and the hero walks that way */
    const steers = async (label, id, dx = 40, dy = 0) => {
      await flush();
      const s0 = await state();
      await drag(id, dx, dy);
      await frames(12);
      const s = await state();
      const f = fingers.get(id);
      const off = Math.hypot(s.kx - f.x, s.ky - f.y);
      const walked = Math.hypot(s.px - s0.px, s.py - s0.py);
      check(s.knob && s.stick && off < 6 && s.mx * dx + s.my * dy > 0 && walked > 2, `${label}: the held finger does not steer (${fmt(s)}, knob ${off.toFixed(1)} px from the finger, hero walked ${walked.toFixed(1)})`);
    };
    const levelUp = async (n = 1) => {
      await page.evaluate((k) => {
        const w = window.__kk.world;
        for (let i = 0; i < k; i++) w.addXp(w.xpNext - w.xp + 0.01);
      }, n);
      for (let i = 0; i < 6 && (await state()).modal !== "levelup"; i++) await frames(20);
      await frames(30); // the 0.35 s pick guard + the fly-in
      check((await state()).modal === "levelup", "no level-up modal");
    };
    const cardAt = (i = 0) =>
      page.evaluate((k) => {
        const r = document.querySelectorAll(".levelup .card")[k].getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }, i);
    const tapAt = async (p) => {
      const id = await down(p.x, p.y);
      await sleep(40);
      await up(id);
      await sleep(30);
    };
    const clickSel = (sel) => page.evaluate((q) => document.querySelector(q)?.click(), sel);
    const closed = async (what) => {
      for (let i = 0; i < 40 && (await state()).modal; i++) {
        await sleep(30);
        await frames(1);
      }
      await frames(2);
      check(!(await state()).modal, `${what}: the modal did not close`);
    };
    /** each case starts clean: no finger down, no modal */
    const jstep = (name, fn) =>
      step(`joystick ${name}`, async () => {
        if (fingers.size) await cancelAll();
        if ((await state()).modal) await page.evaluate(() => window.__kk.app.closeModal());
        await frames(3);
        await fn();
      });

    await jstep("(a) held through a level-up, the modal closes under it", async () => {
      await idle("start");
      const f = await down(P1.x, P1.y);
      await steers("before the level-up", f);
      await levelUp();
      await drag(f, 0, -20);
      const s = await state();
      check(!s.knob && s.mx === 0, `modal open: the stick should let go (${fmt(s)})`);
      await clickSel(".levelup .card");
      await sleep(480);
      await closed("level-up");
      const s2 = await state();
      check(s2.knob && s2.stick && Math.hypot(s2.kx - fingers.get(f).x, s2.ky - fingers.get(f).y) < 6, `modal closed: the knob should be back under the held finger (${fmt(s2)})`);
      await steers("after the level-up", f, -40, 0);
      await up(f);
      await idle("lifted");
    });
    for (const where of ["backdrop", "card"]) {
      await jstep(`(b) thumb back down during the 430 ms close delay, on the ${where}`, async () => {
        await levelUp();
        await tapAt(await cardAt(0));
        const at = where === "card" ? await cardAt(1) : P1;
        await sleep(120);
        const f = await down(at.x, at.y);
        await drag(f, 6, 0);
        await sleep(450);
        await closed("level-up");
        await steers("after the close", f, 0, 40);
        await up(f);
        await idle("lifted");
      });
    }
    await jstep("(c) held, lifted during the level-up, then a new touch", async () => {
      const f = await down(P1.x, P1.y);
      await drag(f, 30, 0);
      await levelUp();
      await up(f);
      await tapAt(await cardAt(0));
      await sleep(480);
      await closed("level-up");
      await idle("after the pick");
      const g = await down(P2.x, P2.y);
      await steers("a new touch", g);
      await up(g);
      await idle("lifted");
    });
    await jstep("(d) held through the chest and the pause menu", async () => {
      const f = await down(P1.x, P1.y);
      await drag(f, 30, 0);
      await page.evaluate(() => window.__kk.chest(true));
      for (let i = 0; i < 6 && (await state()).modal !== "chest"; i++) await frames(20);
      check((await state()).modal === "chest", "no chest modal");
      await frames(200);
      for (let i = 0; i < 6 && (await state()).modal === "chest"; i++) {
        await clickSel(".chest-modal");
        await frames(40);
      }
      await closed("chest");
      await steers("after the chest", f, 0, -40);
      await page.evaluate(() => window.__kk.pause());
      await frames(20);
      check((await state()).modal === "pause", "no pause menu");
      await drag(f, 10, 0);
      await page.evaluate(() => window.__kk.app.resume());
      await closed("pause");
      await steers("after the pause menu", f, 40, 0);
      await up(f);
      await idle("lifted");
    });
    await jstep("(e) two pending levels: the second offer, then the thumb in the close delay", async () => {
      await levelUp(2);
      await tapAt(await cardAt(0));
      await sleep(480);
      await frames(30);
      check((await state()).modal === "levelup", "no second offer");
      await tapAt(await cardAt(0));
      await sleep(150);
      const f = await down(P2.x, P2.y);
      await sleep(350);
      await closed("level-up");
      await steers("after the second pick", f, 0, 40);
      await up(f);
      await idle("lifted");
    });
    await jstep("(f) a finger held on DASH across a level-up is never the stick", async () => {
      const d = await page.evaluate(() => {
        const r = window.__kk.app.input.touch.dashBtn.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      });
      const f = await down(d.x, d.y);
      await levelUp();
      await clickSel(".levelup .card");
      await sleep(480);
      await closed("level-up");
      await drag(f, -30, 0);
      await frames(3);
      const s = await state();
      check(!s.stick && !s.knob && s.mx === 0, `the DASH finger took the stick (${fmt(s)})`);
      const g = await down(P2.x, P2.y);
      await steers("a second finger", g);
      await up(g);
      await up(f);
      await idle("lifted");
    });
    await jstep("(g) pointercancel mid-drag", async () => {
      const f = await down(P1.x, P1.y);
      await steers("dragging", f);
      await cancelAll();
      await idle("cancelled");
      const g = await down(P2.x, P2.y);
      await steers("the next touch", g);
      await up(g);
      await idle("lifted");
    });
    await jstep("(h) a tap on the closing level-up picks no second card", async () => {
      await levelUp();
      const c = await cardAt(1);
      // (count the picks the World is asked for)
      await page.evaluate(() => {
        const w = window.__kk.world;
        const choose = w.choose.bind(w);
        w.__picks = 0;
        w.choose = (card) => {
          w.__picks++;
          return choose(card);
        };
      });
      await tapAt(await cardAt(0));
      // (the moment the 430 ms close delay ends: the modal fades out for 220 ms more)
      for (let i = 0; i < 100 && (await page.evaluate(() => window.__kk.modal)); i++) await sleep(10);
      await tapAt(c);
      await sleep(480);
      await frames(3);
      const picks = await page.evaluate(() => window.__kk.world.__picks);
      check(picks === 1, `one level-up, ${picks} cards applied (a tap on the fading modal picked again)`);
      await idle("after");
    });
    await jstep("(i) a second thumb resting beside the stick never takes it while the stick thumb repositions", async () => {
      const d = await page.evaluate(() => {
        const r = window.__kk.app.input.touch.dashBtn.getBoundingClientRect();
        return { x: Math.round(r.x - r.width * 0.5), y: Math.round(r.y + r.height * 0.4) };
      });
      const f = await down(P1.x, P1.y);
      await steers("the stick thumb", f);
      // (the other thumb rests on the play area just left of DASH: a near miss)
      const g = await down(d.x, d.y);
      await up(f);
      // its contact patch drifts while the stick thumb is up
      await drag(g, -10, -10);
      await frames(6);
      const s = await state();
      check(!s.stick && !s.knob && s.mx === 0 && s.my === 0, `the resting thumb took the stick (${fmt(s)})`);
      const h = await down(P1.x + 10, P1.y - 10);
      await steers("the stick thumb pressed again", h, 0, -40);
      await up(h);
      await up(g);
      await idle("lifted");
    });

    // ---- SECOND-THUMB TAPS (Chromium sends no click for a tap while another finger is down: src/ui/screens/common.ts
    // secondThumbTaps presses the control on the fresh finger's pointerup). The stick thumb stays down throughout.
    const centre = (sel) =>
      page.evaluate((q) => {
        const e = document.querySelector(q);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }, sel);
    /** count the cards the World is asked to apply (its own counter: (h) wrapped World.choose already) */
    const countPicks = () =>
      page.evaluate(() => {
        const w = window.__kk.world;
        if (!w.__chosenWrapped) {
          const choose = w.choose.bind(w);
          w.choose = (card) => {
            w.__chosen++;
            return choose(card);
          };
          w.__chosenWrapped = true;
        }
        w.__chosen = 0;
      });
    const picks = () => page.evaluate(() => window.__kk.world.__chosen);
    await jstep("(j) the stick thumb held: a second thumb picks a level-up card, exactly once", async () => {
      const f = await down(P1.x, P1.y);
      await steers("before the level-up", f);
      await levelUp();
      await countPicks();
      await tapAt(await cardAt(0));
      await sleep(480);
      await closed("level-up");
      const n = await picks();
      check(n === 1, `a second-thumb tap on a card applied ${n} cards (want 1)`);
      await steers("after the pick", f, -40, 0);
      await up(f);
      await idle("lifted");
    });
    await jstep("(k) the stick thumb held: a thumb put down on the closing offer never picks from the next one", async () => {
      const f = await down(P1.x, P1.y);
      await drag(f, 30, 0);
      await levelUp(2);
      await countPicks();
      await tapAt(await cardAt(0));
      await sleep(150);
      // (down during the 430 ms close delay; the second offer marks it stale)
      const b = await down((await cardAt(1)).x, (await cardAt(1)).y);
      await sleep(400);
      await frames(30);
      check((await state()).modal === "levelup", "no second offer");
      await up(b);
      await sleep(60);
      await frames(3);
      check((await picks()) === 1 && (await state()).modal === "levelup", `a thumb held from the first offer picked from the second (${await picks()} picks)`);
      await tapAt(await cardAt(0));
      await sleep(480);
      await closed("level-up");
      const n = await picks();
      check(n === 2, `two level-ups, ${n} cards applied`);
      await steers("after both picks", f, 0, 40);
      await up(f);
      await idle("lifted");
    });
    await jstep("(l) the stick thumb held: a second thumb opens the chest (one step per tap) and collects it", async () => {
      const f = await down(P1.x, P1.y);
      await drag(f, 30, 0);
      await page.evaluate(() => window.__kk.chest(true));
      for (let i = 0; i < 6 && (await state()).modal !== "chest"; i++) await frames(20);
      check((await state()).modal === "chest", "no chest modal");
      // the reels are spinning: a tap lands them and reveals the cards, but does not close the chest
      await frames(100);
      const mid = { x: Math.round(vp.width / 2), y: Math.round(vp.height / 2) };
      await tapAt(mid);
      await frames(3);
      const rev = await page.evaluate(() => ({ modal: window.__kk.modal, revealed: !!document.querySelector(".chest-modal.revealed") }));
      check(rev.modal === "chest" && rev.revealed, `a second-thumb tap on the spinning chest: ${JSON.stringify(rev)} (want it revealed and still open)`);
      await frames(30);
      await tapAt(mid);
      await closed("chest");
      await steers("after the chest", f, 0, -40);
      await up(f);
      await idle("lifted");
    });
    await jstep("(m) the stick thumb held: the HUD pause button, SETTINGS / DONE and RESUME by a second thumb; a drag presses nothing", async () => {
      const f = await down(P1.x, P1.y);
      await steers("steering", f);
      await tapAt(await centre(".hud .pause-btn"));
      await frames(20);
      check((await state()).modal === "pause", "a second-thumb tap on the HUD pause button did not pause");
      await sleep(320); // (markBorn: taps in the first 300 ms of a screen are ghost taps)
      // a drag that starts on RESUME (a scroll of the panel) never resumes
      const res = await centre('.pause [data-act="resume"]');
      const g = await down(res.x, res.y);
      for (let i = 1; i <= 4; i++) await move(g, res.x, res.y + 12 * i);
      await flush();
      await up(g);
      await sleep(60);
      await frames(3);
      check((await state()).modal === "pause", "a drag over the pause panel resumed the run");
      await tapAt(await centre('.pause [data-act="settings"]'));
      await frames(3);
      check(await page.evaluate(() => !!document.querySelector(".modal.settings:not(.out)")), "a second-thumb tap on SETTINGS did not open the settings panel");
      await sleep(320);
      await tapAt(await centre('.settings [data-act="done"]'));
      await frames(3);
      check(await page.evaluate(() => !document.querySelector(".modal.settings:not(.out)")), "a second-thumb tap on DONE did not close the settings panel");
      await sleep(320);
      await tapAt(await centre('.pause [data-act="resume"]'));
      await closed("pause");
      await steers("after the pause menu", f, 40, 0);
      await up(f);
      await idle("lifted");
    });
    await jstep("(n) the narrator caption and the Plot Point toast never catch a tap", async () => {
      const pe = await page.evaluate(() =>
        [".narr", ".ptoast"].map((q) => {
          const e = document.querySelector(`#ui > ${q}`);
          return e ? `${q} ${getComputedStyle(e).pointerEvents}` : `${q} missing`;
        }),
      );
      check(pe.every((x) => x.endsWith(" none")), `display-only layers are hit-testable (or missing): ${pe.join(", ")}`);
    });
  } finally {
    rec.errors.push(...page.__logs.filter((l) => l.startsWith("[pageerror]") || l.startsWith("[error]")));
    await cdp?.detach().catch(() => {});
    await page.context().close();
  }
}

/**
 * E) developer mode (src/debug/devmode.ts): the hidden dev console gestures work only once it is on. Its own context
 * (empty storage), a phone page on run:early in step mode; the 3-finger long-press is real CDP multi-touch and the
 * Settings build label gets real taps.
 */
async function devModeSteps(browser, dev, step, rec) {
  const page = await newPage(browser, dev.opts);
  let cdp = null;
  try {
    const check = (ok, msg) => {
      if (!ok) throw new Error(msg);
    };
    const load = async (q = "") => {
      await page.goto(`${url}/?scenario=run:early&step=1&mute=1${q}`, { waitUntil: "load" });
      await waitFor(page, () => ["ready", "error"].includes(document.documentElement.dataset.kkScenario), null, 60000, "run:early");
      await cdp?.detach().catch(() => {});
      cdp = await page.context().newCDPSession(page);
      await page.evaluate(() => window.__kk.step(10));
    };
    const consoleOpen = () =>
      page.evaluate(() => {
        const k = document.querySelector(".kkd");
        return !!k && k.isConnected && k.style.display !== "none";
      });
    /** the console opens (lazy chunk: allow it a few seconds) / stays shut (give it 1.5 s to prove it) */
    const expectConsole = async (open, label) => {
      if (open) await waitFor(page, () => !!document.querySelector(".kkd") && document.querySelector(".kkd").style.display !== "none", null, 10000, `${label}: the dev console to open`);
      else {
        await sleep(1500);
        check(!(await consoleOpen()), `${label}: the dev console opened`);
      }
    };
    const stored = () => page.evaluate(() => localStorage.getItem("kko.devmode.v1"));
    const longPress = async (ms = 900) => {
      const vp = page.viewportSize();
      const pts = [0.3, 0.5, 0.7].map((k, i) => ({ x: Math.round(vp.width * k), y: Math.round(vp.height * 0.55), id: 70 + i, radiusX: 4, radiusY: 4, force: 1 }));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts });
      await sleep(ms);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    /** pause -> SETTINGS -> 7 taps on the build label -> the toast; DONE -> RESUME */
    const sevenTaps = async () => {
      await page.evaluate(() => window.__kk.pause());
      await page.evaluate(() => window.__kk.step(5));
      await sleep(350); // (markBorn: the first 300 ms of a screen ignore taps)
      await page.locator('.pause [data-act="settings"]').tap();
      await page.evaluate(() => window.__kk.step(5));
      await sleep(350);
      for (let i = 0; i < 7; i++) await page.locator(".settings .set-build").tap();
      const toast = await page.evaluate(() => document.querySelector(".settings .set-devtoast.on")?.textContent ?? "");
      await page.locator('.settings [data-act="done"]').tap();
      await page.evaluate(() => window.__kk.step(5));
      await sleep(350);
      await page.locator('.pause [data-act="resume"]').tap();
      await page.evaluate(() => window.__kk.step(20));
      return toast;
    };
    await step("devmode: off by default, a 3-finger long-press / the ` key never open the console", async () => {
      await load();
      check((await stored()) === null, "developer mode stored in a fresh browser");
      await longPress();
      await expectConsole(false, "a 3-finger long-press without developer mode");
      await page.keyboard.press("Backquote");
      await expectConsole(false, "the ` key without developer mode");
    });
    await step("devmode: 7 taps on the Settings build label switch it on (toast; kept across a reload)", async () => {
      const toast = await sevenTaps();
      check(/Developer mode ON/.test(toast), `no "Developer mode ON" toast (got "${toast}")`);
      check((await stored()) === "1", "developer mode was not kept");
      await longPress();
      await expectConsole(true, "a 3-finger long-press in developer mode");
      await page.evaluate(() => window.__kk.dev(false));
      await load();
      await longPress();
      await expectConsole(true, "a 3-finger long-press after a reload");
      await page.evaluate(() => window.__kk.dev(false));
      await page.keyboard.press("Backquote");
      await expectConsole(true, "the ` key in developer mode");
      await page.evaluate(() => window.__kk.dev(false));
    });
    await step("devmode: 7 more taps switch it off; ?dev=1 on (console at boot), ?dev=0 off", async () => {
      await load();
      const toast = await sevenTaps();
      check(/Developer mode OFF/.test(toast), `no "Developer mode OFF" toast (got "${toast}")`);
      check((await stored()) === null, "developer mode still stored");
      await longPress();
      await expectConsole(false, "a 3-finger long-press after switching it off");
      await load("&dev=1");
      await expectConsole(true, "?dev=1");
      check((await stored()) === "1", "?dev=1 did not keep developer mode");
      await load("&dev=0");
      check((await stored()) === null, "?dev=0 did not switch developer mode off");
      await longPress();
      await expectConsole(false, "a 3-finger long-press after ?dev=0");
    });
  } finally {
    rec.errors.push(...page.__logs.filter((l) => l.startsWith("[pageerror]") || l.startsWith("[error]")));
    await cdp?.detach().catch(() => {});
    await page.context().close();
  }
}

async function runDevice(di, browser) {
  const dev = DEVICES[di];
  const rec = { device: dev.name, steps: [], shots: [], errors: [], ms: 0 };
  results[di] = rec;
  const T0 = Date.now();
  const page = await newPage(browser, dev.opts);
  // every layer that starts fading out of #ui (.out: a screen, a modal, an overlay) must stop catching taps at once:
  // `#ui > *` has an ID's weight, so a bare `.x.out { pointer-events: none }` lost to it (the splash kept eating taps)
  // (reported through a binding: the page navigates between the flows)
  const fadeHits = [];
  await page.exposeFunction("__kkFadeHit", (s) => fadeHits.push(s));
  await page.addInitScript(() => {
    const seen = new WeakSet();
    // (only #ui's own children are watched, not their subtrees: the HUD changes classes every frame)
    const kids = new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target;
        if (el.parentElement?.id !== "ui" || seen.has(el) || !el.classList.contains("out")) continue;
        seen.add(el);
        const pe = getComputedStyle(el).pointerEvents;
        if (pe !== "none") void window.__kkFadeHit?.(`.${[...el.classList].join(".")} (pointer-events: ${pe})`);
      }
    });
    const start = () => {
      const ui = document.getElementById("ui");
      if (!ui) return;
      const watch = (el) => el.nodeType === 1 && kids.observe(el, { attributes: true, attributeFilter: ["class"] });
      for (const c of ui.children) watch(c);
      new MutationObserver((list) => {
        for (const m of list) for (const n of m.addedNodes) watch(n);
      }).observe(ui, { childList: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  });
  const step = async (name, fn) => {
    if (ONLY_STEPS.length && !ONLY_STEPS.some((p) => name.startsWith(p))) return;
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
      // (the card + READY? run on frame time, dt clamped to 1/20 s: a DPR-3 phone page on a loaded SwiftShader needed > 20 s)
      await waitFor(page, () => window.__kk.screen === "game" && window.__kk.world && window.__kk.world.t > 0.5, null, 45000, "game running");
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
      if (mobile) {
        // (a level-up can pop between resolving the modals and the tap, hiding the controls: pick it, tap again)
        for (let i = 0; ; i++) {
          await resolveModal(page, mobile);
          const visible = await page.evaluate(() => !document.querySelector(".kk-touch").hidden);
          try {
            if (!visible) throw new Error("touch controls not visible during gameplay");
            await page.locator(".kk-dash").tap({ timeout: 5000 });
            break;
          } catch (e) {
            if (i >= 3) throw e;
          }
        }
        await sleep(300);
      } else await resolveModal(page, mobile);
    });
    await step("pause -> QUIT RUN -> Episode Results", async () => {
      // (a level-up can pop between resolving the modals and the tap: pick it, then tap pause again)
      for (let i = 0; ; i++) {
        await resolveModal(page, mobile);
        try {
          await tap(".pause-btn", 4000);
          break;
        } catch (e) {
          if (i >= 2) throw e;
        }
      }
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
        // (the key edge is read on the App's next frame: headless SwiftShader may take a while to draw one)
        await waitFor(page, () => !!document.querySelector(".nav-focus"), null, 8000, "focus ring").catch(() => {});
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
      // (god=1: a no-account practice run is meant to die around 2:00-3:30 since the Season 2 retune - this
      // section checks the in-run UI (level-up modal, chest reel, pause, results), not survival)
      await page.goto(`${url}/?autoplay=1&skip=90&seed=${3 + di}&mute=1&god=1&hero=${hero}`, { waitUntil: "load" });
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
    await step("no fading layer catches taps (every screen / modal that faded out of #ui above)", async () => {
      if (fadeHits.length) throw new Error(`layers kept catching taps while fading out: ${[...new Set(fadeHits)].join(", ")}`);
    });
  } catch {
    /* recorded */
  }
  // ---------------------------------------------------------------- D) the joystick across modals (mobile, own page)
  if (dev.opts.mobile) {
    try {
      if (!ONLY_STEPS.length || ONLY_STEPS.includes("joystick")) await joystickSteps(browser, dev, step, rec);
    } catch {
      /* recorded */
    }
    // ---------------------------------------------------------------- E) developer mode (mobile, own page)
    if (!ONLY_STEPS.length || ONLY_STEPS.includes("devmode")) {
      try {
        await devModeSteps(browser, dev, step, rec);
      } catch {
        /* recorded */
      }
    }
  }
  const errs = [...rec.errors, ...page.__logs.filter((l) => l.startsWith("[pageerror]") || l.startsWith("[error]"))];
  rec.errors = errs;
  if (errs.length) failed = true;
  await page.context().close();
  rec.ms = Date.now() - T0;
}

// The devices run in parallel, one Chromium each (pages of one browser share its single SwiftShader GPU process and
// serialise; separate browsers use separate cores): 3 devices took 6.3 min one after another. --serial = the old way.
const T0 = Date.now();
if (args.serial) for (let di = 0; di < DEVICES.length; di++) await runDevice(di, browser);
else {
  const extra = await Promise.all(DEVICES.slice(1).map(() => launchBrowser()));
  await Promise.all(DEVICES.map((_, di) => runDevice(di, di === 0 ? browser : extra[di - 1])));
  for (const b of extra) await b.close();
}

await browser.close();
await close();

console.log("\n===== E2E SUMMARY =====");
for (const r of results) {
  console.log(`\n[${r.device}]`);
  for (const s of r.steps) console.log("  " + s);
  console.log(`  device time: ${(r.ms / 1000).toFixed(1)} s`);
  if (r.stats) console.log("  stats:", JSON.stringify(r.stats));
  console.log(`  screenshots: ${r.shots.length} -> ${outDir}/${r.device}-*.png`);
  if (r.errors.length) {
    console.log(`  PAGE ERRORS (${r.errors.length}):`);
    for (const e of r.errors.slice(0, 12)) console.log("    " + e.split("\n")[0]);
  } else console.log("  page errors: 0");
}
console.log(`${failed ? "\nE2E: FAILED" : "\nE2E: PASSED"} in ${((Date.now() - T0) / 1000).toFixed(0)} s (${results.map((r) => `${r.device} ${(r.ms / 1000).toFixed(0)} s`).join(", ")}${args.serial ? ", serial" : ", in parallel"})`);
process.exit(failed ? 1 : 0);
