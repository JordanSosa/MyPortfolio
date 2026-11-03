/**
 * MERCH MACHINE (docs/EXPANSION.md §9, docs/content/gacha.md): banner tabs
 * (Totally Normal Merch, Featured Hero, Featured Merch, Truck-kun's Isekai
 * Express) with the featured item, the "BANNER ENDS IN N RUNS!!" countdown,
 * visible pity (soft pity glow from 74, hard pity 90, UR pity 300, the 50/50
 * guarantee ribbon, the 1,000-pull MYTHIC spark + picker), PULL x1 / x10
 * through the src/meta gacha engine, a SIMPLE reveal (capsule tinted by the
 * best rarity, cards flip one by one, NEW / ★ UP / C+1 / Copium chips, the
 * LOST THE 50/50 toast) - the gacha wave replaces it with the full summon -
 * the deliberately-too-long fine print, the Copium Exchange (+ the joke Gem
 * Exchange) and the pull history / stats.
 */
import type { Rarity } from "../../game/defs";
import { RARITIES } from "../../game/defs";
import { HEROES } from "../../game/heroes";
import { RELICS } from "../../game/registry";
import { evaluateAchievements } from "../../meta/achievements/engine";
import { gameContent } from "../../meta/content";
import { gemExchangeQuote } from "../../meta/economy";
import { BANNERS, bannerView, type BannerView, type GachaItem } from "../../meta/gacha/banners";
import { claimSpark, gachaStats, pull, pullHistory, sparkChoices, type PullOutcome, type PullResult } from "../../meta/gacha/engine";
import { buyOffer, exchangeCatalogue, exchangeCoinsForGems, type ExchangeOffer } from "../../meta/gacha/exchange";
import { consolidatedSsrPlus } from "../../meta/gacha/rates";
import type { BannerKind } from "../../meta/profile";
import { TUNING } from "../../meta/tuning";
import { esc, fmtInt, h } from "../dom";
import { art, money, portrait, RARITY_CLS, RARITY_TITLE, rarityBadge, relicIcon, trophyIcon } from "../kit/art";
import { bindActs, btn, pbar, pop, sectionTitle, shake, TabBar, tag } from "../kit/controls";
import { confirmDialog, openSheet, trackOverlay, type KitHost, type SheetHandle } from "../kit/overlay";
import type { NavLayer } from "../nav";
import { save } from "../save";
import { markBorn, onTap } from "../screens/common";
import { LOST_5050, RARITY_SUBTITLES, SUMMON_CAPTIONS, WON_5050 } from "./copy-data";
import { pick } from "./copy";
import { pageLayer, type Hub, type HubPage, type PageOpts } from "./hub";

type Tab = BannerKind | "exchange" | "history";

const TAB_LABEL: Record<Tab, string> = { permanent: "PERMANENT", hero: "FEATURED HERO", relic: "FEATURED MERCH", mythic: "ISEKAI EXPRESS", exchange: "COPIUM EXCHANGE", history: "HISTORY" };

/** Gacha item artwork: hero portrait or relic icon. */
function itemArt(it: GachaItem, cls = "gi"): string {
  if (it.kind === "hero") {
    const d = HEROES.find((x) => x.id === it.id);
    return portrait(d?.portrait ?? "", 0, cls);
  }
  return relicIcon(it.id, it.rarity, cls);
}

export function gachaPage(hub: Hub, o: PageOpts): HubPage {
  const app = hub.app;
  const ctx = gameContent();
  const el = h("div", "merch");
  const layer = pageLayer(hub);
  const tabs0: Tab[] = ["permanent", "hero", "relic", "mythic", "exchange", "history"];
  let tab: Tab = (tabs0 as string[]).includes(o.tab ?? "") ? (o.tab as Tab) : "permanent";
  let sheet: SheetHandle | null = null;
  let reveal: Reveal | null = null;

  el.innerHTML = `<div class="mm-tabs"></div><div class="mm-body kscroll"></div>`;
  const body = el.querySelector(".mm-body") as HTMLElement;
  const tabs = new TabBar(
    tabs0.map((t) => ({ id: t, label: TAB_LABEL[t] })),
    tab,
    (t) => {
      app.sfx("tabSwitch");
      tab = t as Tab;
      render();
      body.scrollTop = 0;
    },
  );
  (el.querySelector(".mm-tabs") as HTMLElement).appendChild(tabs.el);

  const render = () => {
    if (tab === "exchange") body.innerHTML = exchangeHtml();
    else if (tab === "history") body.innerHTML = historyHtml();
    else body.innerHTML = bannerHtml(bannerView(save.profile, tab, ctx));
    bindActs(body, {
      pull1: (b) => doPull(1, b),
      pull10: (b) => doPull(10, b),
      fine: openFinePrint,
      spark: openSpark,
      offer: (b) => doOffer(b.dataset.id as string, b),
      gemx: doGemExchange,
      play: () => hub.popTo("home"),
    });
  };

  // ---------------------------------------------------------------- banner
  const bannerHtml = (v: BannerView): string => {
    const p = save.profile;
    const G = TUNING.gacha;
    const f = v.featured;
    const soft = v.pity >= G.softPityStart;
    const pityLine = v.pity >= G.hardPity - 1 ? "NEXT PULL: SSR OR BETTER. (The machine has no choice.)" : soft ? "SOFT PITY ACTIVE — the machine feels bad for you" : "The machine starts feeling bad for you at 74.";
    const machine = art("ui_merch_machine", `<span class="css-machine"><i class="cm-dome"><i></i><i></i><i></i></i><i class="cm-base"></i><i class="cm-sticker">NOT A SLOT MACHINE</i></span>`, "px mm-img");
    const gift = save.migration && !p.flags.welcomeSeen && v.def.id === "permanent" ? `<div class="mm-gift">${tag("GIFT", "gold")} WELCOME TO SEASON 2! Here's a free 10-pull. (It's 1,600 ♦. We're not made of gems.)</div>` : "";
    const featured = f
      ? `<div class="bc-feat rf r-${RARITY_CLS[f.rarity]}">${itemArt(f, "bf-art")}<span class="bf-tx"><small>FEATURED · 50% RATE-UP</small><b>${esc(f.name)}</b>${rarityBadge(f.rarity)}</span></div>`
      : v.def.feature
        ? `<div class="bc-feat soon"><span class="bf-tx"><small>FEATURED</small><b>Between seasons</b><span class="dim">The featured item hasn't been produced yet.</span></span></div>`
        : "";
    const can1 = v.canPull1;
    const can10 = v.canPull10;
    return `
      ${gift}
      <section class="banner-card b-${v.def.id}">
        <div class="bc-art">${machine}${v.def.id === "mythic" ? `<span class="bc-cone">It's coming.</span>` : ""}</div>
        <div class="bc-info">
          <small class="bc-sub">${esc(v.def.subtitle)}</small>
          <b class="bc-title">${esc(v.title)}</b>
          ${v.def.feature === "hero" || v.def.feature === "relic" ? `<span class="bc-fomo">BANNER ENDS IN ${v.runsLeft} RUN${v.runsLeft === 1 ? "" : "S"}!!</span>` : ""}
          ${featured}
        </div>
      </section>
      <section class="pity-box">
        <div class="pity-row${soft ? " soft" : ""}"><span class="pl">PITY</span>${pbar(v.pity / G.hardPity, `${v.pity} / ${G.hardPity}`, soft ? "pink" : "violet")}<i class="soft-mark" style="left:${((G.softPityStart / G.hardPity) * 100).toFixed(1)}%"></i></div>
        <small class="pity-note${soft ? " soft" : ""}">${esc(pityLine)}</small>
        <div class="pity-row"><span class="pl">UR</span>${pbar(v.pityUR / G.urPity, `${v.pityUR} / ${G.urPity}`, "cyan")}</div>
        <small class="pity-note">UR pity (patience is a rarity too)</small>
        <div class="pity-row${v.sparkReady ? " ready" : ""}"><span class="pl">SPARK</span>${pbar(v.spark / G.spark, `${fmtInt(Math.min(v.spark, G.spark))} / ${fmtInt(G.spark)}`, v.sparkReady ? "rainbow" : "gold")}</div>
        <small class="pity-note">${v.sparkReady ? "SPARK READY! Choose your destiny." : "At 1,000 pulls (any banner) you pick any MYTHIC."}</small>
        ${v.sparkReady ? btn("CLAIM SPARK", { cls: "small", act: "spark" }) : ""}
        ${v.guaranteed && f ? `<div class="ribbon">GUARANTEED featured on the next ${esc(f.rarity)}!</div>` : ""}
      </section>
      <section class="pull-row">
        ${btn(`PULL ×1`, { cls: `violet pull${can1 ? "" : " nope"}`, act: "pull1", sub: `${G.pullCost} ♦`, def: can1 && !can10 })}
        ${btn(`PULL ×10`, { cls: `gold pull${can10 ? "" : " nope"}`, act: "pull10", sub: `${fmtInt(G.tenPullCost)} ♦ · SR+ GUARANTEED`, def: can10 })}
      </section>
      ${!can1 && v.available ? `<div class="mm-poor">Need ${fmtInt(G.pullCost)} ♦ (you have ${fmtInt(p.currencies.gems)} ♦). Play an episode? It pays! ${btn("GO PLAY", { cls: "small ghost", act: "play" })}</div>` : ""}
      <button class="mm-fine" data-nav data-act="fine">ⓘ Rates &amp; fine print</button>`;
  };

  const doPull = async (n: 1 | 10, b: HTMLElement) => {
    if (reveal) return;
    const p = save.profile;
    const kind = tab as BannerKind;
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
      hub.toast(`Need ${fmtInt(cost)} ♦`, { kind: "bad", sub: `You have ${fmtInt(p.currencies.gems)} ♦. Play an episode? It pays!` });
      return;
    }
    if (n === 10 || cost >= 1000) {
      const ok = await confirmDialog(app, { title: `Pull ×${n}?`, body: `Spend ${money("gems", fmtInt(cost))} on <b>${esc(v.title)}</b>?<br><small>${esc(pick("summon", SUMMON_CAPTIONS))}</small>`, ok: "PULL!", okCls: "gold", cancel: "Not today" });
      if (!ok) return;
    }
    const out = pull(p, kind, n, undefined, ctx);
    if (!out.ok) {
      app.sfx("uiDeny");
      return;
    }
    if (save.migration) p.flags.welcomeSeen = 1;
    const done = evaluateAchievements(p, null, ctx);
    hub.changed();
    reveal = new Reveal(app, out, () => {
      reveal = null;
      render();
      // lost / won the 50/50 + Plot Points after the cards
      if (out.results.some((r) => r.lost5050)) {
        app.sfx("gachaLost5050");
        hub.toast(pick("lost", LOST_5050), { kind: "gacha", icon: trophyIcon("kt-img") });
      } else if (out.results.some((r) => r.won5050)) hub.toast(pick("won", WON_5050), { kind: "good" });
      for (const a of done) hub.toast(a.def.name, { kind: "ach", kicker: "PLOT POINT UNLOCKED!", icon: trophyIcon("kt-img"), sub: a.def.desc });
    });
  };

  // ---------------------------------------------------------------- fine print
  const openFinePrint = () => {
    const kind = tab as BannerKind;
    const def = BANNERS.find((b) => b.id === kind) ?? BANNERS[0];
    const rates = TUNING.gacha.rates;
    const ssrPlus = consolidatedSsrPlus();
    const html = `
      <table class="rates">${RARITIES.map((r) => `<tr><td>${rarityBadge(r)}</td><td>${esc(RARITY_TITLE[r])}</td><td class="num">${rates[r]}%</td></tr>`).join("")}</table>
      <p class="fp-sum">Consolidated SSR-or-better rate (pity included): <b>${(ssrPlus * 100).toFixed(2)}%</b></p>
      <ol class="fp">${def.finePrint.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>
      <p class="fp-end">You reached the bottom. Nobody reaches the bottom. ✦</p>`;
    sheet = openSheet(app, { title: "Rates & Fine Print", kicker: def.name.toUpperCase(), html, cls: "fine-sheet", onClose: () => (sheet = null) });
    const s = sheet;
    const onScroll = () => {
      if (s.body.scrollTop + s.body.clientHeight < s.body.scrollHeight - 12) return;
      s.body.removeEventListener("scroll", onScroll);
      const p = save.profile;
      if (p.flags.finePrint) return;
      p.flags.finePrint = 1;
      const done = evaluateAchievements(p, null, ctx);
      hub.changed(false);
      for (const a of done) hub.toast(a.def.name, { kind: "ach", kicker: "PLOT POINT UNLOCKED!", icon: trophyIcon("kt-img"), sub: a.def.desc });
    };
    s.body.addEventListener("scroll", onScroll, { passive: true });
  };

  // ---------------------------------------------------------------- spark
  const openSpark = () => {
    const choices = sparkChoices(ctx);
    const html = choices.length
      ? `<p class="pg-note">1,000 pulls. You have earned this. Choose your destiny.</p><div class="pick-list">${choices
          .map((c) => `<button class="pick-row" data-nav data-act="sparkpick" data-id="${c.id}"><span class="relic-t rf r-my">${itemArt(c)}</span><span class="pk-tx"><b>${esc(c.name)} ${rarityBadge(c.rarity)}</b><small>${c.kind === "hero" ? "HONK." : esc(RELICS.get(c.id)?.flavor ?? "")}</small></span></button>`)
          .join("")}</div>`
      : `<p class="pg-note">No MYTHICs have been produced yet. Your spark is safe with us. (It is.)</p>`;
    sheet = openSheet(app, { title: "MYTHIC Spark", kicker: "1,000 PULLS", html, onClose: () => (sheet = null) });
    const s = sheet;
    bindActs(s.el, {
      sparkpick: async (b) => {
        const it = choices.find((c) => c.id === b.dataset.id);
        if (!it) return;
        if (it.kind === "hero") app.sfx("honk");
        const ok = await confirmDialog(app, { title: `Spark ${it.name}?`, body: "Spend 1,000 pulls of spark on this MYTHIC?", ok: "DESTINY!", okCls: "gold" });
        if (!ok) return;
        const r = claimSpark(save.profile, it.id, ctx);
        if (!r.ok || !r.result) return;
        s.close();
        hub.changed();
        reveal = new Reveal(app, { ok: true, banner: tab as BannerKind, results: [r.result], best: r.result.rarity, gemsSpent: 0, copium: r.result.copium, codexGems: r.result.codexGems, sparkReady: false }, () => {
          reveal = null;
          render();
        });
      },
    });
  };

  // ---------------------------------------------------------------- exchange
  const exchangeHtml = (): string => {
    const p = save.profile;
    const offers = exchangeCatalogue(p, ctx);
    const q = gemExchangeQuote(Math.min(p.currencies.coins, TUNING.gemExchange.coins));
    const group = (title: string, list: ExchangeOffer[]) => (list.length ? `${sectionTitle(title)}<div class="offer-list">${list.map(offerRow).join("")}</div>` : "");
    const relics = offers.filter((x) => x.kind === "relic").sort((a, b) => RARITIES.indexOf((a.item?.rarity ?? "N") as Rarity) - RARITIES.indexOf((b.item?.rarity ?? "N") as Rarity));
    return `
      <div class="cx-head">${art("icon_copium", `<i class="css-pill big"></i>`, "px cx-img")}<span><small>COPIUM</small><b>${fmtInt(p.currencies.copium)}</b><em>(do not inhale)</em></span></div>
      <div class="krow gemx"><span class="rw-ic">${art("icon_dreamgem", `<i class="css-gem"></i>`, "px")}</span><span class="rw-tx"><b>Gem Exchange</b><small>${fmtInt(TUNING.gemExchange.coins)} ★ → ${TUNING.gemExchange.gems} ♦. Terrible rate! Truly awful!</small></span>${btn("EXCHANGE", { cls: `small ghost${q.batches ? "" : " nope"}`, act: "gemx" })}</div>
      ${group("Vouchers & Insurance", offers.filter((x) => x.kind === "voucher" || x.kind === "insurance"))}
      ${group("Heroes", offers.filter((x) => x.kind === "hero"))}
      ${group("Merch", relics)}`;
  };

  const offerRow = (x: ExchangeOffer): string => {
    const icon = x.item ? `<span class="relic-t rf r-${RARITY_CLS[x.item.rarity]}">${itemArt(x.item)}</span>` : x.kind === "voucher" ? art("icon_dreamgem", `<i class="css-gem"></i>`, "px") : trophyIcon();
    const why = x.block === "maxed" ? "MAXED" : x.block === "notForSale" ? "NOT FOR SALE" : x.block === "locked" ? "LOCKED" : x.block === "pity" ? "PITY FULL" : "";
    return `<div class="krow offer${x.block && x.block !== "copium" ? " blocked" : ""}">
      <span class="rw-ic">${icon}</span>
      <span class="rw-tx"><b>${esc(x.name)}${x.item ? ` ${rarityBadge(x.item.rarity)}` : ""}</b><small>${esc(x.desc)}</small></span>
      <span class="rw-r">${why ? tag(why, x.block === "maxed" ? "gold" : "") : btn(money("copium", fmtInt(x.price), x.block === "copium" ? "poor" : ""), { cls: `small violet${x.block ? " nope" : ""}`, act: "offer", attrs: `data-id="${esc(x.id)}"`, aria: `Buy ${x.name}` })}</span>
    </div>`;
  };

  const doOffer = async (id: string, b: HTMLElement) => {
    const offer = exchangeCatalogue(save.profile, ctx).find((x) => x.id === id);
    if (!offer) return;
    if (offer.block) {
      app.sfx("uiDeny");
      shake(b);
      if (offer.block === "copium") hub.toast("Not enough Copium.", { kind: "bad", sub: "Every pull earns a little. Inhale responsibly." });
      return;
    }
    if (offer.price >= 300) {
      const ok = await confirmDialog(app, { title: `Buy ${offer.name}?`, body: `${money("copium", fmtInt(offer.price))} — ${esc(offer.desc)}`, ok: "BUY", okCls: "violet" });
      if (!ok) return;
    }
    const r = buyOffer(save.profile, id, ctx);
    if (!r.ok) {
      app.sfx("uiDeny");
      return;
    }
    hub.changed();
    if (r.result) {
      reveal = new Reveal(app, { ok: true, banner: "permanent", results: [r.result], best: r.result.rarity, gemsSpent: 0, copium: r.result.copium, codexGems: r.result.codexGems, sparkReady: false }, () => {
        reveal = null;
        render();
      });
    } else {
      app.sfx("currencyGain");
      hub.toast(r.gems ? `+${r.gems} ♦` : `Pity +${TUNING.exchange.pityInsuranceAmount}`, { kind: "good", sub: offer.name });
      render();
    }
  };

  const doGemExchange = async (b: HTMLElement) => {
    const p = save.profile;
    const q = gemExchangeQuote(Math.min(p.currencies.coins, TUNING.gemExchange.coins));
    if (!q.batches) {
      app.sfx("uiDeny");
      shake(b);
      hub.toast(`Need ${fmtInt(TUNING.gemExchange.coins)} ★`, { kind: "bad" });
      return;
    }
    const ok = await confirmDialog(app, { title: "Gem Exchange", body: `${money("coins", fmtInt(q.coins))} → ${money("gems", fmtInt(q.gems))}<br>Terrible rate! Truly awful! Do it anyway?`, ok: "Yes", cancel: "I value my coins" });
    if (!ok) return;
    if (exchangeCoinsForGems(p, 1).ok) {
      app.sfx("currencyGain");
      hub.changed();
      render();
    }
  };

  // ---------------------------------------------------------------- history
  const historyHtml = (): string => {
    const p = save.profile;
    const s = gachaStats(p);
    const hist = pullHistory(p, ctx);
    const stat = (k: string, v: string) => `<div class="hs"><small>${k}</small><b>${v}</b></div>`;
    return `
      <div class="hist-stats">
        ${stat("PULLS", fmtInt(s.pulls))}${stat("GEMS “SPENT”", fmtInt(s.gemsSpent))}${stat("N STREAK RECORD", fmtInt(s.nStreakBest))}
        ${stat("50/50 WON · LOST", `${s.won5050} · ${s.lost5050}`)}${stat("COPIUM EARNED", fmtInt(s.copiumEarned))}
        <div class="hs irl"><small>MONEY YOU WOULD HAVE SPENT IRL</small><b>$0</b><em>(we checked)</em></div>
      </div>
      ${sectionTitle("Last 100 pulls")}
      ${
        hist.length
          ? `<div class="hist">${hist
              .map((x) => `<div class="hrow r-${RARITY_CLS[x.rarity]}"><span class="hn">#${fmtInt(x.n)}</span>${rarityBadge(x.rarity)}<b>${esc(x.name)}</b><small>${x.result === "new" ? "NEW" : x.result === "copium" ? "→ COPIUM" : x.result === "star" ? "★ UP" : "C+1"}${x.lost ? " · LOST 50/50" : ""}${x.featured ? " · FEATURED" : ""}</small></div>`)
              .join("")}</div>`
          : `<p class="lo-note">No pulls yet. The machine is waiting. Patiently. Menacingly.</p>`
      }`;
  };

  render();
  return {
    id: "gacha",
    el,
    title: "MERCH MACHINE",
    layer,
    music: "gacha",
    opaque: true,
    show() {
      render();
    },
    dispose() {
      sheet?.close();
      reveal?.close();
    },
  };
}

// ================================================================== simple reveal

const CAPSULE_CLS: Record<Rarity, string> = { N: "blue", R: "blue", SR: "purple", SSR: "gold", UR: "rainbow", LR: "rainbow", MYTHIC: "glitch" };

/** A pull's result: what the copy became. */
function resultChip(r: PullResult): string {
  if (r.result === "new") return tag(r.item.kind === "hero" ? "NEW HERO!" : "NEW!", "gold");
  if (r.result === "star") return tag(`★ UP! ★${r.level}`, "pink");
  if (r.result === "constellation") return tag(`C${r.level} UNLOCKED`, "rainbow");
  return tag(`+${r.copium} COPIUM`, "cyan");
}

/**
 * The simple reveal (the gacha wave builds the dramatic one): a capsule in the
 * best rarity's colour wobbles, pops, and the cards flip in one by one. Tap /
 * SKIP reveals everything at once; OK closes.
 */
class Reveal {
  readonly el: HTMLElement;
  private readonly layer: NavLayer;
  private done = false;
  private closed = false;
  private timers: number[] = [];

  constructor(
    private readonly host: KitHost,
    private readonly out: PullOutcome,
    private readonly onClose: () => void,
  ) {
    const best = out.best;
    const n = out.results.length;
    this.el = h("div", `kover reveal ${n > 1 ? "ten" : "one"} best-${RARITY_CLS[best]}`);
    this.el.innerHTML = `
      <div class="rv-bg"></div>
      <div class="rv-capsule c-${CAPSULE_CLS[best]}">${art("ui_gacha_capsule", `<i class="cap-top"></i><i class="cap-bot"></i><i class="cap-band"></i>`, "px cap-img")}</div>
      <div class="rv-caption">${esc(pick("summon", SUMMON_CAPTIONS))}</div>
      <div class="rv-cards">${out.results
        .map(
          (r, i) => `<div class="rv-card rf r-${RARITY_CLS[r.rarity]}${RARITIES.indexOf(r.rarity) >= 3 ? " big" : ""}" style="--i:${i}">
            <span class="rvc-art">${itemArt(r.item, "rv-art")}</span>
            ${rarityBadge(r.rarity)}
            <b class="rvc-nm">${esc(r.item.name)}</b>
            <span class="rvc-res">${resultChip(r)}</span>
            ${r.lost5050 ? `<span class="rvc-lost">LOST 50/50</span>` : ""}
          </div>`,
        )
        .join("")}</div>
      <div class="rv-title"><b>${esc(RARITY_TITLE[best])}</b><small>${esc(pick(`rs:${best}`, RARITY_SUBTITLES[best] ?? []))}</small></div>
      <div class="rv-btns"><button class="btn ghost small" data-nav data-act="skip">Skip? …fine.</button><button class="btn gold small" data-nav data-act="ok" hidden>OK!</button></div>`;
    host.ui.appendChild(this.el);
    this.layer = { root: this.el, onBack: () => (this.done ? this.close() : this.finish()), focus: null };
    host.nav.push(this.layer);
    trackOverlay(1);
    host.overlayOpened();
    markBorn();
    onTap(this.el.querySelector('[data-act="skip"]'), () => this.finish());
    onTap(this.el.querySelector('[data-act="ok"]'), () => this.close());
    this.el.addEventListener("click", () => {
      if (!this.done) this.finish();
    });
    host.sfx("gachaCharge");
    this.later(700, () => host.sfx(best === "MYTHIC" ? "gachaMythicGlitch" : "gachaMeteor"));
    this.later(1250, () => {
      this.el.classList.add("open");
      host.sfx(best === "MYTHIC" ? "gachaMythicBoom" : RARITIES.indexOf(best) >= 4 ? "gachaRevealUR" : best === "SSR" ? "gachaRevealSSR" : best === "SR" ? "gachaRevealSR" : "gachaReveal");
    });
    // card flips (CSS delays), one tick each
    out.results.forEach((r, i) => this.later(1350 + i * 160, () => host.sfx(r.result === "star" || r.result === "constellation" ? "starUp" : "cardFlip", 0.7, i)));
    this.later(1450 + n * 160, () => this.finish());
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  /** Reveal everything now. */
  finish(): void {
    if (this.done || this.closed) return;
    this.done = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    this.el.classList.add("open", "done");
    (this.el.querySelector('[data-act="skip"]') as HTMLElement).hidden = true;
    const ok = this.el.querySelector('[data-act="ok"]') as HTMLElement;
    ok.hidden = false;
    this.host.nav.refocus(this.layer, ok);
    if (RARITIES.indexOf(this.out.best) >= 3) pop(this.el.querySelector(".rv-title"), 1.2);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const t of this.timers) clearTimeout(t);
    this.host.nav.remove(this.layer);
    this.el.classList.add("out");
    this.el.style.pointerEvents = "none";
    setTimeout(() => this.el.remove(), 220);
    trackOverlay(-1);
    this.host.overlayClosed();
    this.host.sfx("uiBack");
    this.onClose();
  }
}
