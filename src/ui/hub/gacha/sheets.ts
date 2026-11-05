/**
 * The Merch Machine's paperwork: the deliberately-too-long fine print (§4,
 * with a scroll bar that SHRINKS as you scroll and the hidden "Read The Fine
 * Print" Plot Point at the very bottom), the MYTHIC spark picker (§7: Truck-kun
 * honks), the Copium Exchange shop (§6), the pull history + stats (§7) and the
 * joke Gem Exchange.
 */
import type { Rarity } from "../../../game/defs";
import { RARITIES } from "../../../game/defs";
import { RELICS } from "../../../game/registry";
import { evaluateAchievements, type AchievementDone } from "../../../meta/achievements/engine";
import type { MetaContent } from "../../../meta/content";
import { gemExchangeQuote } from "../../../meta/economy";
import { BANNER_BY_ID, gachaItem, type GachaItem } from "../../../meta/gacha/banners";
import { gachaStats, pullHistory, sparkChoices } from "../../../meta/gacha/engine";
import { exchangeCatalogue, exchangeCoinsForGems, type ExchangeOffer } from "../../../meta/gacha/exchange";
import { consolidatedSsrPlus } from "../../../meta/gacha/rates";
import type { BannerKind, Profile } from "../../../meta/profile";
import { TUNING } from "../../../meta/tuning";
import { esc, fmtInt } from "../../dom";
import { art, money, RARITY_CLS, RARITY_TITLE, rarityBadge } from "../../kit/art";
import { sectionTitle, shake, tag } from "../../kit/controls";
import { confirmDialog, openSheet, type KitHost, type SheetHandle } from "../../kit/overlay";
import { itemArt } from "./art";
import * as C from "./copy";

// ================================================================== fine print
export interface FinePrintCtx {
  host: KitHost;
  banner: BannerKind;
  profile: Profile;
  ctx: MetaContent;
  /** The profile changed (persist). */
  changed: () => void;
  /** Plot Points completed (toast them). */
  achieved: (list: AchievementDone[]) => void;
}

export function openFinePrint(o: FinePrintCtx): SheetHandle {
  const rates = TUNING.gacha.rates;
  const block = C.FINE_PRINT[o.banner];
  const ssrPlus = consolidatedSsrPlus();
  const def = BANNER_BY_ID.get(o.banner);
  const html = `
    <div class="fp-wrap">
      <table class="rates">${RARITIES.map((r) => `<tr class="r-${RARITY_CLS[r]}"><td>${rarityBadge(r)}</td><td>${esc(RARITY_TITLE[r])}</td><td class="num">${rates[r]}%</td></tr>`).join("")}</table>
      <p class="fp-sum">Consolidated SSR-or-better rate (pity included): <b>${(ssrPlus * 100).toFixed(2)}%</b></p>
      <h3 class="fp-h">${esc(block.title)}</h3>
      <ol class="fp">${block.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>
      <h3 class="fp-h">Every banner</h3>
      <ol class="fp">${C.FINE_PRINT_COMMON.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>
      <p class="fp-end" data-end>✦ The end. ✦</p>
    </div>`;
  const s = openSheet(o.host, { title: "Rates & Fine Print", kicker: (def?.name ?? "").toUpperCase(), html, cls: "fine-sheet" });
  // the scroll bar that gets SMALLER the further you scroll (native bar hidden)
  const sheet = s.el.querySelector(".ksheet") as HTMLElement;
  const track = document.createElement("div");
  track.className = "fp-track";
  track.innerHTML = "<i></i>";
  sheet.appendChild(track);
  const thumb = track.firstElementChild as HTMLElement;
  let raf = 0;
  let unlocked = !!o.profile.flags.finePrint;
  const place = () => {
    raf = 0;
    const b = s.body;
    track.style.transform = `translateY(${b.offsetTop}px)`;
    const th = b.clientHeight;
    track.style.height = `${th}px`;
    const max = Math.max(1, b.scrollHeight - th);
    const k = Math.min(1, Math.max(0, b.scrollTop / max));
    const base = Math.max(24, (th * th) / Math.max(th, b.scrollHeight));
    const sc = 1 - 0.86 * k;
    thumb.style.height = `${base.toFixed(0)}px`;
    thumb.style.transform = `translateY(${(k * (th - base * sc)).toFixed(1)}px) scaleY(${sc.toFixed(3)})`;
    if (!unlocked && b.scrollTop + th >= b.scrollHeight - 12) {
      unlocked = true;
      if (!o.profile.flags.finePrint) {
        o.profile.flags.finePrint = 1;
        const done = evaluateAchievements(o.profile, null, o.ctx);
        o.changed();
        o.achieved(done);
      }
    }
  };
  s.body.addEventListener("scroll", () => (raf ||= requestAnimationFrame(place)), { passive: true });
  requestAnimationFrame(place);
  return s;
}

// ================================================================== spark picker
export function sparkHtml(ctx: MetaContent): { html: string; choices: GachaItem[] } {
  const choices = sparkChoices(ctx);
  const html = choices.length
    ? `<p class="pg-note">1,000 pulls. You have earned this. Choose your destiny.</p><div class="spk-list">${choices
        .map(
          (c) => `<button class="spk rf r-my" data-nav data-act="sparkpick" data-id="${esc(c.id)}">
            <span class="spk-art">${itemArt(c, "spk-img", c.kind === "hero" ? 1 : 0)}</span>
            <span class="spk-tx"><b>${esc(c.name)}</b>${rarityBadge(c.rarity)}<small>${c.kind === "hero" ? "HONK. (tap again to choose)" : esc(RELICS.get(c.id)?.flavor ?? "")}</small></span>
          </button>`,
        )
        .join("")}</div>`
    : `<p class="pg-note">No MYTHICs have been produced yet. Your spark is safe with us. (It is.)</p>`;
  return { html, choices };
}

// ================================================================== Copium Exchange
/** The shop keeper: the machine's speaker grille making a smile. */
function shopkeeper(copium: number): string {
  return `<div class="cx-keeper">
    <span class="cx-grille" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i class="m"></i></span>
    <span class="cx-bubble"><b>${esc(C.COPIUM_HEADER(copium))}</b><small>Welcome to the Copium Exchange. Everything is priced in feelings.</small></span>
  </div>`;
}

function offerCopy(x: ExchangeOffer): string {
  if (x.kind === "voucher") return C.OFFER_COPY.voucher.line;
  if (x.kind === "insurance") return C.OFFER_COPY.insurance.line;
  const it = x.item;
  if (!it) return x.desc;
  if (x.block === "notForSale") return C.OFFER_COPY.mythic;
  if (x.kind === "hero") {
    if (x.block === "locked") return x.desc;
    return C.OFFER_COPY.hero[it.id] ?? C.OFFER_COPY.heroSR;
  }
  return C.OFFER_COPY.relic[it.rarity] ?? x.desc;
}

function offerCard(p: Profile, x: ExchangeOffer): string {
  const it = x.item;
  const rc = it ? RARITY_CLS[it.rarity] : x.kind === "voucher" ? "ssr" : "sr";
  const icon = it
    ? itemArt(it, "ofr-img")
    : x.kind === "voucher"
      ? art("ui_gem_big", art("icon_dreamgem", `<i class="css-gem ofr-img"></i>`, "px ofr-img"), "px ofr-img")
      : `<i class="ofr-ins" aria-hidden="true">+${TUNING.exchange.pityInsuranceAmount}</i>`;
  const why = x.block === "maxed" ? "MAXED" : x.block === "notForSale" ? "NOT FOR SALE" : x.block === "locked" ? "LOCKED" : x.block === "pity" ? "PITY FULL" : "";
  const owned = it?.kind === "relic" && it.id in p.relics ? `★${p.relics[it.id]}` : it?.kind === "hero" && p.unlocks.heroes.includes(it.id) ? `C${p.heroes[it.id]?.constellation ?? 0}` : "";
  const name = x.kind === "insurance" ? `${C.OFFER_COPY.insurance.name}` : x.kind === "voucher" ? C.OFFER_COPY.voucher.name : x.name;
  const sub = x.kind === "insurance" && x.banner ? `${BANNER_BY_ID.get(x.banner)?.name ?? x.banner} · pity ${p.gacha.banners[x.banner].pity} → ${Math.min(TUNING.gacha.hardPity - 1, p.gacha.banners[x.banner].pity + TUNING.exchange.pityInsuranceAmount)}` : x.kind === "voucher" ? `+${TUNING.exchange.pullVoucherGems} ♦` : "";
  const hard = x.block && x.block !== "copium";
  return `<button class="ofr rf r-${rc}${hard ? " blocked" : ""}${x.block === "copium" ? " poor" : ""}" data-nav data-act="offer" data-id="${esc(x.id)}" aria-label="${esc(`${name}${why ? ` (${why})` : `, ${x.price} Copium`}`)}">
    <span class="ofr-top"><span class="ofr-ic">${icon}</span>${it ? rarityBadge(it.rarity) : ""}${owned ? `<span class="ofr-own">${owned}</span>` : ""}</span>
    <b class="ofr-nm">${esc(name)}</b>
    ${sub ? `<small class="ofr-sub">${esc(sub)}</small>` : ""}
    <small class="ofr-copy">${esc(offerCopy(x))}</small>
    <span class="ofr-price">${why ? tag(why, x.block === "maxed" ? "gold" : "") : money("copium", fmtInt(x.price), x.block === "copium" ? "poor" : "")}</span>
  </button>`;
}

export function exchangeHtml(p: Profile, ctx: MetaContent): string {
  const offers = exchangeCatalogue(p, ctx);
  const q = gemExchangeQuote(Math.min(p.currencies.coins, TUNING.gemExchange.coins));
  const grid = (title: string, list: ExchangeOffer[], right = "") => (list.length ? `${sectionTitle(title, right)}<div class="ofr-grid">${list.map((x) => offerCard(p, x)).join("")}</div>` : "");
  const byR = (a: ExchangeOffer, b: ExchangeOffer) => RARITIES.indexOf((a.item?.rarity ?? "N") as Rarity) - RARITIES.indexOf((b.item?.rarity ?? "N") as Rarity);
  const relics = offers.filter((x) => x.kind === "relic").sort(byR);
  const groups = RARITIES.map((r) => ({ r, list: relics.filter((x) => x.item?.rarity === r) })).filter((g) => g.list.length);
  return `
    ${shopkeeper(p.currencies.copium)}
    <button class="gemx-row" data-nav data-act="gemx">
      <span class="gx-ic">${art("ui_gem_big", art("icon_dreamgem", `<i class="css-gem"></i>`, "px"), "px")}</span>
      <span class="gx-tx"><b>${esc(C.GEMX.title)}</b><small>${fmtInt(TUNING.gemExchange.coins)} ★ → ${TUNING.gemExchange.gems} ♦. Terrible rate! Truly awful!</small></span>
      <span class="gx-r">${q.batches ? tag("−99% VALUE", "red") : tag(`NEED ${fmtInt(TUNING.gemExchange.coins)} ★`)}</span>
    </button>
    ${grid("Vouchers & Insurance", offers.filter((x) => x.kind === "voucher" || x.kind === "insurance"))}
    ${grid("Heroes", offers.filter((x) => x.kind === "hero").sort(byR))}
    ${groups.map((g) => grid(`Merch · ${g.r}`, g.list, rarityBadge(g.r))).join("")}`;
}

// ================================================================== history + stats
export function historyHtml(p: Profile, ctx: MetaContent, view: "log" | "stats"): string {
  const seg = `<div class="mm-seg" role="tablist">
    <button class="mm-seg-b${view === "log" ? " on" : ""}" role="tab" aria-selected="${view === "log"}" data-nav data-act="hview" data-v="log">PULL LOG</button>
    <button class="mm-seg-b${view === "stats" ? " on" : ""}" role="tab" aria-selected="${view === "stats"}" data-nav data-act="hview" data-v="stats">STATS</button>
  </div>`;
  if (view === "stats") return seg + statsHtml(p, ctx);
  const hist = pullHistory(p, ctx);
  if (!hist.length) return `${seg}<p class="lo-note">No pulls yet. The machine is waiting. Patiently. Menacingly.</p>`;
  const res = (r: string) => (r === "new" ? "NEW" : r === "copium" ? "→ COPIUM" : r === "star" ? "★ UP" : "C+1");
  return `${seg}${sectionTitle(`Last ${hist.length} pulls`)}<div class="hist">${hist
    .map(
      (x) => `<div class="hrow r-${RARITY_CLS[x.rarity]}">
        <span class="hn">#${fmtInt(x.n)}</span>${rarityBadge(x.rarity)}
        <b>${esc(x.name)}</b>
        <small>${res(x.result)}${x.lost ? " · LOST 50/50" : ""}${x.featured ? " · FEATURED" : ""} · ${esc(BANNER_BY_ID.get(x.banner)?.name ?? x.banner)}</small>
      </div>`,
    )
    .join("")}</div>`;
}

function statsHtml(p: Profile, ctx: MetaContent): string {
  const s = gachaStats(p);
  const tile = (k: string, v: string, cls = "") => `<div class="hs ${cls}"><small>${k}</small><b>${v}</b></div>`;
  // most-pulled item in the log ("Your most loyal N")
  const counts = new Map<string, number>();
  for (const h of p.gacha.history) counts.set(h.id, (counts.get(h.id) ?? 0) + 1);
  let loyal = "";
  let loyalN = 0;
  for (const [id, n] of counts)
    if (n > loyalN) {
      loyal = id;
      loyalN = n;
    }
  const li = loyal ? gachaItem(loyal, ctx) : undefined;
  const rates = TUNING.gacha.rates;
  const bars = RARITIES.map((r) => {
    const obs = s.observed[r] * 100;
    const k = Math.min(1, obs / 60);
    return `<div class="rb r-${RARITY_CLS[r]}">${rarityBadge(r)}<span class="rb-bar"><i style="transform:scaleX(${k.toFixed(4)})"></i></span><span class="rb-v">${fmtInt(s.byRarity[r])} <small>${obs.toFixed(obs < 1 && obs > 0 ? 2 : 1)}% · printed ${rates[r]}%</small></span></div>`;
  }).join("");
  return `
    <div class="hist-stats">
      ${tile("PULLS", fmtInt(s.pulls))}${tile("GEMS “SPENT”", fmtInt(s.gemsSpent))}${tile("N STREAK RECORD", fmtInt(s.nStreakBest))}
      ${tile("50/50 WON · LOST", `${s.won5050} · ${s.lost5050}`)}${tile("COPIUM EARNED", fmtInt(s.copiumEarned))}${tile("10-PULLS", fmtInt(s.tenPulls))}
      <div class="hs irl"><small>MONEY YOU WOULD HAVE SPENT IRL</small><b>$0</b><em>(we checked)</em></div>
      ${li ? `<div class="hs loyal"><small>${esc(C.LOYAL_N.toUpperCase())}</small><span class="ly">${itemArt(li, "ly-img")}<b>${esc(li.name)}</b><em>×${loyalN} in the last ${p.gacha.history.length}</em></span></div>` : ""}
    </div>
    ${sectionTitle("Your rates vs. the printed rates")}
    <div class="rbars">${bars}</div>`;
}

// ================================================================== Gem Exchange
/** "1,000 ★ -> 10 ♦" with the bible's confirm. Returns true when it traded. */
export async function gemExchange(host: KitHost, p: Profile, deny: (b: HTMLElement | null) => void, b: HTMLElement | null = null): Promise<boolean> {
  const q = gemExchangeQuote(Math.min(p.currencies.coins, TUNING.gemExchange.coins));
  if (!q.batches) {
    deny(b);
    return false;
  }
  const ok = await confirmDialog(host, {
    title: C.GEMX.title,
    body: `<p class="gx-deal">${money("coins", fmtInt(q.coins))} → ${money("gems", fmtInt(q.gems))}</p><p>${esc(C.GEMX.line)}</p><small class="gx-fine">No real money. Ever. Not even a little.</small>`,
    ok: C.GEMX.ok,
    cancel: C.GEMX.no,
    okCls: "gold",
  });
  if (!ok) return false;
  return exchangeCoinsForGems(p, 1).ok;
}

/** Deny feedback shared by the page (sfx + shake). */
export function denyFx(host: KitHost, b: Element | null): void {
  host.sfx("uiDeny");
  shake(b);
}

