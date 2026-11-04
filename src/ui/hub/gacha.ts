/**
 * MERCH MACHINE (docs/EXPANSION.md §9, docs/content/gacha.md): the page.
 *
 *  - icon tabs: the four banners (Totally Normal Merch, Featured Hero,
 *    Featured Merch, Truck-kun's Isekai Express), the Copium Exchange, History
 *    (pull log + stats). Swipe the poster to change banner.
 *  - banner tab (gacha/banner.ts): the key-art poster with the featured item
 *    blown up, the persistent Merch Machine (idles, cranks during a pull, tap
 *    it for "+0% ODDS"), "BANNER ENDS IN 2 RUNS!!" (tap: "Not real time."),
 *    UR pity / MYTHIC spark / 50/50 or the GUARANTEED ribbon, and the pull dock
 *    (PULL ×1 / ×10, the pity bar under them, fine print, Gem Exchange). The
 *    dock sticks to the bottom on portrait phones (thumb zone).
 *  - a pull: confirm sheet (×10) -> `pull()` (src/meta) -> the storyboard
 *    (gacha/summon.ts) -> the page re-renders and the bars glide to the new
 *    pity. Not enough gems: the satirical upsell (play an episode, or the
 *    terrible Gem Exchange; never real money).
 *  - fine print (shrinking scroll bar, "Read The Fine Print"), the MYTHIC
 *    spark picker, the Copium Exchange, history + stats: gacha/sheets.ts.
 *
 * Styles: gacha/gacha.css. Dev-only debug: gacha/debug.ts (`__kkGacha`).
 */
import { audio } from "../../audio";
import { evaluateAchievements, type AchievementDone } from "../../meta/achievements/engine";
import { gameContent } from "../../meta/content";
import { bannerPool, bannerView } from "../../meta/gacha/banners";
import { claimSpark, pull, type PullOutcome } from "../../meta/gacha/engine";
import { buyOffer, exchangeCatalogue } from "../../meta/gacha/exchange";
import type { BannerKind } from "../../meta/profile";
import { TUNING } from "../../meta/tuning";
import { evaluateUnlocks, type UnlockEvent } from "../../meta/unlocks";
import { esc, fmtInt, h, prewarmSprites, sprite } from "../dom";
import { money, trophyIcon } from "../kit/art";
import { badge, bindActs, pop, setBar, shake, TabBar } from "../kit/controls";
import { confirmDialog, openSheet, type SheetHandle } from "../kit/overlay";
import { reducedMotion } from "../kit/ticker";
import { save } from "../save";
import { onTap } from "../screens/common";
import { itemArtFrames, machineArt } from "./gacha/art";
import { dockHtml, machineHtml, pityHtml, posterHtml, tabIcon } from "./gacha/banner";
import * as C from "./gacha/copy";
import { debugRng, installGachaDebug, takeDebug } from "./gacha/debug";
import { celebrateUnlocks } from "./celebrate";
import { exchangeHtml, gemExchange, historyHtml, openFinePrint, sparkHtml } from "./gacha/sheets";
import { Summon, type SummonHost } from "./gacha/summon";
import { choiceDialog, hideTip, showTip } from "./gacha/ui";
import "./gacha/gacha.css";
import { pageLayer, type Hub, type HubPage, type PageOpts } from "./hub";

type Tab = BannerKind | "exchange" | "history";
const BANNER_TABS: readonly BannerKind[] = ["permanent", "hero", "relic", "mythic"];
const TABS: readonly Tab[] = [...BANNER_TABS, "exchange", "history"];

const isBanner = (t: Tab): t is BannerKind => (BANNER_TABS as readonly string[]).includes(t);

installGachaDebug();

export function gachaPage(hub: Hub, o: PageOpts): HubPage {
  const app = hub.app;
  const ctx = gameContent();
  const el = h("div", "merch");
  const layer = pageLayer(hub);
  let tab: Tab = (TABS as readonly string[]).includes(o.tab ?? "") ? (o.tab as Tab) : "permanent";
  let histView: "log" | "stats" = "log";
  let sheet: SheetHandle | null = null;
  let summon: Summon | null = null;
  let busy = false;
  let disposed = false;
  /** Unlocks of a summon that PULL AGAIN closed: celebrated when the chained summon closes (never on top of it). */
  const carried: UnlockEvent[] = [];
  /** What the bars showed last (they glide from there after a pull). */
  const shown = new Map<BannerKind, { pity: number; ur: number; spark: number }>();

  const host: SummonHost = {
    ui: app.ui,
    nav: app.nav,
    sfx: (id, vol, pitch) => app.sfx(id, vol, pitch),
    overlayOpened: () => app.overlayOpened(),
    overlayClosed: () => app.overlayClosed(),
    music: (t, f) => app.music(t, f),
    duck: (a, s) => {
      if (!app.params.mute) audio.duck(a, s);
    },
    haptic: (ms) => app.input.haptic(ms),
    get shakeAmt() {
      return Math.max(0, Math.min(1.5, app.settings.shake));
    },
    get reduceFlash() {
      return !!app.settings.reduceFlashing;
    },
    toast: (m, t) => hub.toast(m, t),
  };

  el.innerHTML = `<div class="mm-tabs"></div><div class="mm-body kscroll"></div>`;
  const body = el.querySelector(".mm-body") as HTMLElement;
  const views = () => new Map(BANNER_TABS.map((b) => [b, bannerView(save.profile, b, ctx)]));
  const tabDefs = () => {
    const vs = views();
    const runsLast = (b: BannerKind) => {
      const v = vs.get(b);
      return !!v && (v.def.feature === "hero" || v.def.feature === "relic") && v.runsLeft <= 1;
    };
    const spark = save.profile.gacha.spark >= TUNING.gacha.spark;
    return TABS.map((t) => ({
      id: t,
      label: C.TAB_SHORT[t],
      icon: `<span class="ti">${tabIcon(t, isBanner(t) ? (vs.get(t) ?? null) : null)}</span>`,
      badge: isBanner(t) ? (runsLast(t) ? badge(true, "!") : spark && t === "mythic" ? badge(true, "!") : "") : "",
    }));
  };
  const tabs = new TabBar(tabDefs(), tab, (t) => switchTab(t as Tab), "mm-tabbar");
  (el.querySelector(".mm-tabs") as HTMLElement).appendChild(tabs.el);

  // ---------------------------------------------------------------- the machine (persists across banners)
  const machine = h("button", "bnr-machine");
  machine.setAttribute("data-nav", "");
  machine.setAttribute("data-act", "machine");
  machine.setAttribute("aria-label", "The Merch Machine. Tapping it does not improve the odds.");
  let machineTaps = 0;
  let giftShown = false;
  onTap(machine, () => {
    machineTaps++;
    save.profile.flags.machineTaps = Math.min(1e6, (save.profile.flags.machineTaps ?? 0) + 1);
    app.sfx("uiMove", 0.7, (machineTaps % 5) * 2);
    if (!reducedMotion()) machine.animate([{ transform: "rotate(0)" }, { transform: "rotate(-7deg) scale(1.05)", offset: 0.3 }, { transform: "rotate(5deg)", offset: 0.6 }, { transform: "none" }], { duration: 380, easing: "ease-out" });
    machine.classList.add("crank");
    window.setTimeout(() => !summon && machine.classList.remove("crank"), 420);
    const t = h("span", "mm-tapfx", esc(C.MACHINE_TAPS[machineTaps % C.MACHINE_TAPS.length]));
    machine.querySelector(".mm-taps")?.appendChild(t);
    window.setTimeout(() => t.remove(), 900);
    if (gift()) showTip(machine, C.WELCOME_GIFT, 4200);
  });
  const gift = () => !!save.migration && !save.profile.flags.welcomeSeen;
  const machineFrames = machineArt();
  const fillMachine = (b: BannerKind) => {
    machine.className = `bnr-machine at-${b}`;
    machine.innerHTML = machineHtml(machineFrames, gift() && b === "permanent");
  };

  // ---------------------------------------------------------------- the gem pill's "+" (Gem Exchange)
  const gemPlus = h("button", "mm-gemx-plus", "+");
  gemPlus.setAttribute("data-nav", "");
  gemPlus.setAttribute("aria-label", "Gem Exchange (terrible rate)");
  gemPlus.title = "Gem Exchange";
  onTap(gemPlus, () => void doGemExchange(gemPlus));
  const mountPlus = () => {
    const pill = hub.cbar.pill("gems");
    if (pill && gemPlus.parentElement !== pill) pill.appendChild(gemPlus);
  };

  // ---------------------------------------------------------------- render
  const render = (dir = 0) => {
    hideTip();
    el.dataset.tab = tab;
    el.classList.toggle("is-banner", isBanner(tab));
    if (isBanner(tab)) renderBanner(tab, dir);
    else {
      body.innerHTML = tab === "exchange" ? exchangeHtml(save.profile, ctx) : historyHtml(save.profile, ctx, histView);
      bind(body);
    }
  };

  const renderBanner = (b: BannerKind, dir: number) => {
    const p = save.profile;
    const v = bannerView(p, b, ctx);
    const prev = shown.get(b) ?? null;
    body.innerHTML = `<div class="mm-cols">
      <div class="mm-col a"><section class="bnr-wrap">${posterHtml(v, p, ctx)}<div class="bnr-dots" aria-hidden="true">${BANNER_TABS.map((x) => `<i class="${x === b ? "on" : ""}"></i>`).join("")}</div></section></div>
      <div class="mm-col b">${pityHtml(v, prev ? { ur: prev.ur, spark: prev.spark } : null)}${!v.available ? `<p class="mm-poor">This banner is between seasons. The machine is restocking.</p>` : ""}${dockHtml(v, p, prev?.pity ?? null)}</div>
    </div>`;
    fillMachine(b);
    (body.querySelector(".bnr-wrap") as HTMLElement).appendChild(machine);
    // the v1 welcome gift on the machine says hello once
    if (b === "permanent" && gift() && !giftShown) {
      giftShown = true;
      window.setTimeout(() => !disposed && !summon && tab === "permanent" && machine.isConnected && showTip(machine, C.WELCOME_GIFT, 4200), 650);
    }
    bind(body);
    swipe(body.querySelector(".bnr-wrap") as HTMLElement);
    const poster = body.querySelector(".bnr") as HTMLElement;
    if (dir && !reducedMotion()) {
      poster.animate([{ transform: `translateX(${dir * 22}%) scale(0.96)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: "cubic-bezier(0.2, 1, 0.3, 1)" });
      machine.animate([{ transform: "translateY(0)" }, { transform: "translateY(-14%) rotate(-4deg)", offset: 0.4 }, { transform: "none" }], { duration: 360, easing: "ease-out" });
    }
    // bars glide from what they showed before (a pull just happened)
    const g = TUNING.gacha;
    const now = { pity: v.pity, ur: v.pityUR, spark: Math.min(v.spark, g.spark) };
    if (prev && (prev.pity !== now.pity || prev.ur !== now.ur || prev.spark !== now.spark))
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setBar(body.querySelector(".dock-pity .pbar"), now.pity / g.hardPity);
          setBar(body.querySelector(".pb-row.ur .pbar"), now.ur / g.urPity);
          setBar(body.querySelector(".pb-row.spark .pbar"), now.spark / g.spark);
        }),
      );
    shown.set(b, now);
  };

  const bind = (root: HTMLElement) =>
    bindActs(root, {
      pull1: (b) => void doPull(1, b),
      pull10: (b) => void doPull(10, b),
      fine: openFine,
      spark: openSpark,
      offer: (b) => void doOffer(b.dataset.id as string, b),
      gemx: (b) => void doGemExchange(b),
      fomo: (b) => {
        app.sfx("uiMove");
        showTip(b, C.FOMO_TIP);
      },
      pitytip: (b) => {
        app.sfx("uiMove");
        showTip(b, C.PITY_TIP);
      },
      shout: (b) => {
        b.classList.add("shout");
        app.sfx("voiceBlip", 0.8, 5);
        window.setTimeout(() => b.classList.remove("shout"), 900);
      },
      hview: (b) => {
        histView = b.dataset.v === "stats" ? "stats" : "log";
        app.sfx("tabSwitch");
        render();
      },
    });

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    const a = TABS.indexOf(tab);
    const b = TABS.indexOf(t);
    app.sfx("tabSwitch");
    tab = t;
    tabs.select(t);
    render(isBanner(t) ? Math.sign(b - a) : 0);
    body.scrollTop = 0;
  };

  /** Horizontal swipe on the poster: previous / next banner. */
  const swipe = (wrap: HTMLElement) => {
    let id = -1;
    let x0 = 0;
    let y0 = 0;
    wrap.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary) return;
      id = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
    });
    wrap.addEventListener("pointerup", (e) => {
      if (e.pointerId !== id) return;
      id = -1;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4 || !isBanner(tab)) return;
      const i = BANNER_TABS.indexOf(tab) + (dx < 0 ? 1 : -1);
      if (i < 0 || i >= BANNER_TABS.length) {
        shake(wrap.querySelector(".bnr"));
        return;
      }
      switchTab(BANNER_TABS[i]);
    });
    wrap.addEventListener("pointercancel", () => (id = -1));
  };

  // ---------------------------------------------------------------- pulls
  /**
   * Everything a grant unlocked right away: the item's own unlock rules (meta afterGrant: a new hero's
   * signature weapon, hero-count passives), Plot Point rewards, and rules those Plot Points completed.
   */
  const unlocksOf = (base: readonly UnlockEvent[] | undefined, done: AchievementDone[]): UnlockEvent[] => {
    const all = [...(base ?? []), ...done.flatMap((a) => (a.unlocked ? [a.unlocked] : [])), ...evaluateUnlocks(save.profile, ctx).filter((u) => !u.start)];
    const seen = new Set<string>();
    return all.filter((u) => {
      const k = `${u.kind}:${u.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const achieved = (list: AchievementDone[]) => {
    if (!list.length) return;
    app.sfx("achievement", 0.8);
    for (const a of list) hub.toast(a.def.name, { kind: "ach", kicker: "PLOT POINT UNLOCKED!", icon: trophyIcon("kt-img"), sub: a.def.desc });
    // (a Plot Point that unlocks content: celebrated here too; saved again in case a rule it completed fired)
    const unlocks = unlocksOf(undefined, list);
    if (unlocks.length) {
      hub.changed(false);
      celebrateUnlocks(app, unlocks);
    }
  };

  const poor = async (cost: number) => {
    const p = save.profile;
    const coins = p.currencies.coins;
    const id = await choiceDialog(app, {
      title: "NOT ENOUGH ♦",
      cls: "mm-poorc",
      body: `<p class="pc-line">${esc(C.poorLine(cost, p.currencies.gems))}</p>
        <div class="pc-offer">
          <span class="pc-burst">−99% VALUE!!</span>
          <b class="pc-name">✦ SUPER VALUE STARTER PACK ✦</b>
          <span class="pc-deal">${money("coins", fmtInt(TUNING.gemExchange.coins))} → ${money("gems", String(TUNING.gemExchange.gems))}</span>
          <small class="pc-fine">Price: $0.00. Paid in Star Coins you earned by playing. No real money, ever. ${coins < TUNING.gemExchange.coins ? "(You can't afford this either.)" : "(It is a terrible deal.)"}</small>
        </div>`,
      buttons: [
        { id: "play", label: "Go Play", cls: "gold" },
        { id: "gemx", label: "Gem Exchange", cls: "violet" },
        { id: "no", label: "Okay", cls: "ghost", def: true },
      ],
    });
    if (id === "play") hub.popTo("home");
    else if (id === "gemx") void doGemExchange(null);
  };

  const confirmPull = async (n: 1 | 10, cost: number, title: string): Promise<boolean> => {
    app.sfx("uiConfirm");
    const after = save.profile.currencies.gems - cost;
    const id = await choiceDialog(app, {
      title: `PULL ×${n}`,
      cls: "mm-pullc",
      art: `<span class="pc-mach">${machineFrames}</span>`,
      body: `<p class="pc-q">${esc(C.confirmLine(cost))}</p><p class="pc-b">on <b>${esc(title)}</b></p><small class="pc-after">You'll have ${money("gems", fmtInt(after))} left. ${n === 10 ? "SR or better guaranteed." : ""}</small>`,
      buttons: [
        { id: "no", label: C.CONFIRM_NO, cls: "ghost", def: true },
        { id: "pull", label: C.CONFIRM_OK, cls: "gold" },
      ],
    });
    return id === "pull";
  };

  const doPull = async (n: 1 | 10, b: HTMLElement | null, again = false) => {
    if (busy || summon || disposed) return;
    const p = save.profile;
    const kind = isBanner(tab) ? tab : "permanent";
    const v = bannerView(p, kind, ctx);
    const cost = n === 10 ? v.cost10 : v.cost1;
    if (!v.available) {
      app.sfx("uiDeny");
      shake(b);
      hub.toast("This banner is between seasons.", { kind: "bad" });
      return;
    }
    if (p.currencies.gems < cost) {
      app.sfx("uiDeny");
      shake(b);
      void poor(cost);
      return;
    }
    busy = true;
    try {
      if (n === 10 && !again && !(await confirmPull(n, cost, v.title))) return;
      if (disposed) return;
      const dbg = takeDebug();
      const out = pull(p, kind, n, debugRng(dbg.rng), ctx, dbg.force ? { force: dbg.force, forceAt: dbg.at } : {});
      if (!out.ok) {
        app.sfx("uiDeny");
        return;
      }
      if (save.migration) p.flags.welcomeSeen = 1;
      // the Isekai Express curse: count the cones
      if (kind === "mythic") {
        const cones = out.results.filter((r) => r.item.id === "traffic_cone").length;
        if (cones) p.flags.cones = Math.min(1e6, (p.flags.cones ?? 0) + cones);
      }
      const done = evaluateAchievements(p, null, ctx);
      const unlocks = unlocksOf(out.unlocks, done);
      hub.changed();
      // the results' art (cards, splashes, summary) encoded now, so the storyboard builds from the icon
      // cache; most of it is already warm (warmPool); the summon opens after the next frame, in its own task
      // (not inside a frame callback: its first style + layout then lands in the following frame's task)
      for (const r of out.results) for (const [id, f] of itemArtFrames(r.item)) sprite(id, f);
      await new Promise<void>((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      if (disposed) return;
      openSummon(out, "pull", done, unlocks, dbg.fakeout, n);
    } finally {
      busy = false;
    }
  };

  const openSummon = (out: PullOutcome, mode: "pull" | "shop" | "spark", done: AchievementDone[], unlocks: UnlockEvent[], fakeout?: boolean, n: 1 | 10 = 1) => {
    const kind = isBanner(tab) ? tab : "permanent";
    const cost = n === 10 ? TUNING.gacha.tenPullCost : TUNING.gacha.pullCost;
    // the page under the (dimmed) summon stops its idle loops; the machine keeps cranking
    el.classList.add("summoning");
    summon = new Summon(host, out, {
      mode,
      achievements: done,
      cones: save.profile.flags.cones ?? 0,
      fakeout,
      again:
        mode === "pull"
          ? {
              label: `PULL ×${n} AGAIN`,
              sub: `${fmtInt(cost)} ♦`,
              afford: save.profile.currencies.gems >= cost,
              run: () => {
                if (save.profile.currencies.gems < cost) {
                  app.sfx("uiDeny");
                  void poor(cost);
                  return;
                }
                if (isBanner(tab) && tab !== kind) tab = kind;
                void doPull(n, null, true);
              },
            }
          : undefined,
      onClose: () => {
        summon = null;
        el.classList.remove("summoning");
        if (disposed) {
          // (the page went away with the summon: the hub home celebrates them instead)
          save.pendingUnlocks.push(...carried.splice(0), ...unlocks);
          return;
        }
        tabs.render(tabDefs());
        render();
        if (mode === "spark") app.sfx("unlockFanfare", 0.6);
        // what the new items unlocked (Senpai -> Notice Me Sparkles, a 4th hero -> Friendship Bracelet):
        // celebrated now, not as a stray card at the next run's Results (already saved by hub.changed)
        const list = [...carried.splice(0), ...unlocks];
        if (!list.length) return;
        // (PULL AGAIN closes this summon and starts the next pull in the same task: the cards wait for that
        // summon to close instead of covering its storyboard)
        queueMicrotask(() => {
          if (disposed) save.pendingUnlocks.push(...list);
          else if (busy || summon) carried.push(...list);
          else celebrateUnlocks(app, list);
        });
      },
    });
  };

  // ---------------------------------------------------------------- fine print / spark
  const openFine = () => {
    app.sfx("uiConfirm");
    sheet = openFinePrint({ host: app, banner: isBanner(tab) ? tab : "permanent", profile: save.profile, ctx, changed: () => hub.changed(false), achieved });
  };

  const openSpark = () => {
    app.sfx("uiConfirm");
    const { html, choices } = sparkHtml(ctx);
    const s = openSheet(app, { title: "MYTHIC Spark", kicker: "1,000 PULLS · CHOOSE YOUR DESTINY", html, cls: "spark-sheet" });
    sheet = s;
    const armed = new Set<string>();
    bindActs(s.el, {
      sparkpick: async (b) => {
        const it = choices.find((c) => c.id === b.dataset.id);
        if (!it) return;
        if (it.kind === "hero" && !armed.has(it.id)) {
          // Truck-kun's card honks when tapped (HONK-HONK)
          armed.add(it.id);
          app.sfx("honk");
          window.setTimeout(() => app.sfx("honk", 1, 2), 250);
          pop(b, 1.08);
          return;
        }
        const ok = await confirmDialog(app, { title: `Spark ${it.name}?`, body: "Spend 1,000 pulls of spark on this MYTHIC? This is the only promise we keep.", ok: "DESTINY!", okCls: "gold", cancel: "Not yet" });
        if (!ok) return;
        const r = claimSpark(save.profile, it.id, ctx);
        if (!r.ok || !r.result) return;
        s.close();
        const done = evaluateAchievements(save.profile, null, ctx);
        const unlocks = unlocksOf(r.unlocks, done);
        hub.changed();
        openSummon({ ok: true, banner: "mythic", results: [r.result], best: r.result.rarity, gemsSpent: 0, copium: r.result.copium, codexGems: r.result.codexGems, sparkReady: false, unlocks: r.unlocks ?? [], equipped: r.equipped ?? [] }, "spark", done, unlocks);
      },
    });
  };

  // ---------------------------------------------------------------- Copium Exchange / Gem Exchange
  const doOffer = async (id: string, b: HTMLElement) => {
    if (summon) return;
    const offer = exchangeCatalogue(save.profile, ctx).find((x) => x.id === id);
    if (!offer) return;
    if (offer.block) {
      app.sfx("uiDeny");
      shake(b);
      if (offer.block === "copium") hub.toast("Not enough Copium.", { kind: "bad", sub: "Every pull earns a little. Inhale responsibly." });
      else if (offer.block === "notForSale") hub.toast("Not for sale.", { kind: "bad", sub: C.OFFER_COPY.mythic });
      else if (offer.block === "pity") hub.toast("Pity is already as full as it gets.", { kind: "bad", sub: "The next pull is guaranteed anyway." });
      return;
    }
    if (offer.price >= 300) {
      const ok = await confirmDialog(app, { title: `Buy ${offer.item?.name ?? offer.name}?`, body: `${money("copium", fmtInt(offer.price))}<br><small>${esc(offer.kind === "voucher" ? C.OFFER_COPY.voucher.line : offer.desc)}</small>`, ok: "BUY", okCls: "violet", cancel: "I have regrets" });
      if (!ok) return;
    }
    const r = buyOffer(save.profile, id, ctx);
    if (!r.ok) {
      app.sfx("uiDeny");
      return;
    }
    const done = evaluateAchievements(save.profile, null, ctx);
    const unlocks = unlocksOf(r.unlocks, done);
    hub.changed();
    if (r.result) openSummon({ ok: true, banner: "permanent", results: [r.result], best: r.result.rarity, gemsSpent: 0, copium: r.result.copium, codexGems: r.result.codexGems, sparkReady: false, unlocks: r.unlocks ?? [], equipped: r.equipped ?? [] }, "shop", done, unlocks);
    else {
      app.sfx("currencyGain");
      hub.toast(r.gems ? `+${r.gems} ♦` : `Pity ${r.pity ?? ""}`, { kind: "good", sub: offer.kind === "voucher" ? C.OFFER_COPY.voucher.line : C.OFFER_COPY.insurance.line });
      achieved(done);
      const y = body.scrollTop;
      render();
      body.scrollTop = y;
    }
  };

  const doGemExchange = async (b: HTMLElement | null) => {
    const ok = await gemExchange(app, save.profile, (x) => {
      app.sfx("uiDeny");
      shake(x);
      hub.toast(`Need ${fmtInt(TUNING.gemExchange.coins)} ★`, { kind: "bad", sub: "Even the terrible deal is out of reach. Play an episode!" });
    }, b);
    if (!ok || disposed) return;
    app.sfx("currencyGain");
    const done = evaluateAchievements(save.profile, null, ctx);
    hub.changed();
    achieved(done);
    const y = body.scrollTop;
    render();
    body.scrollTop = y;
  };

  /** Banners whose pool art is warm (or warming): every item a pull could show, encoded in idle slices. */
  const warmed = new Set<BannerKind>();
  /** The storyboard's own art: summoning circle, meteor / capsule colours, card corners, rarity badges. */
  const STORY_ART: [string, number][] = [
    ["ui_summon_circle", 0],
    ...[0, 1, 2, 3, 4].map((f): [string, number] => ["ui_gacha_meteor", f]),
    ...[0, 1, 2, 3, 4, 5].map((f): [string, number] => ["ui_gacha_capsule", f]),
    ...[0, 1, 2, 3, 4, 5, 6].map((f): [string, number] => ["ui_card_corner", f]),
    ...[0, 1, 2, 3, 4, 5, 6].map((f): [string, number] => ["ui_rarity_badge", f]),
  ];
  const warmPool = () => {
    if (!warmed.size) prewarmSprites(STORY_ART, () => !summon && !disposed && !busy);
    for (const b of BANNER_TABS) {
      if (warmed.has(b) || !bannerView(save.profile, b, ctx).available) continue;
      warmed.add(b);
      const frames: [string, number][] = [];
      for (const list of Object.values(bannerPool(save.profile, b, ctx))) for (const it of list) frames.push(...itemArtFrames(it));
      prewarmSprites(frames, () => !summon && !disposed && !busy);
    }
  };

  render();
  mountPlus();
  warmPool();
  return {
    id: "gacha",
    el,
    title: "MERCH MACHINE",
    layer,
    music: "gacha",
    opaque: true,
    show() {
      mountPlus();
      tabs.render(tabDefs());
      render();
    },
    dispose() {
      disposed = true;
      hideTip();
      sheet?.close();
      summon?.close(false);
      gemPlus.remove();
    },
  };
}
