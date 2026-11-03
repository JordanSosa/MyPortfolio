/**
 * Banner showcase markup (docs/content/gacha.md §1, §7): the key-art poster
 * per banner (featured portrait / relic blown up, the merch shelf, the cursed
 * road with a single cone), the "BANNER ENDS IN 2 RUNS!!" countdown, the pity
 * panel (UR pity, MYTHIC spark, 50/50 / guarantee) and the pull dock (PULL ×1 /
 * ×10, the pity bar under the buttons with the soft-pity mark, fine print).
 */
import { RARITIES, type Rarity } from "../../../game/defs";
import { RELICS } from "../../../game/registry";
import { bannerPool, featuredCandidates, type BannerView, type GachaItem } from "../../../meta/gacha/banners";
import type { MetaContent } from "../../../meta/content";
import type { Profile } from "../../../meta/profile";
import { TUNING } from "../../../meta/tuning";
import { esc, fmtInt, hasArt, img } from "../../dom";
import { art, money, portrait, RARITY_CLS, rarityBadge, relicIcon } from "../../kit/art";
import { pbar } from "../../kit/controls";
import { heroDef, itemArt } from "./art";
import * as C from "./copy";

const G = () => TUNING.gacha;

/** Tab icon per banner / tool tab. */
export function tabIcon(id: string, v: BannerView | null): string {
  if (id === "permanent") return art("ui_merch_machine", `<i class="ti-cap" aria-hidden="true"></i>`, "px ti-img ti-mach");
  if (id === "hero" || id === "relic") {
    const f = v?.featured;
    if (f?.kind === "hero") return portrait(heroDef(f.id)?.portrait ?? "", 0, "ti-img ti-por");
    if (f) return relicIcon(f.id, f.rarity, "ti-img");
    return `<i class="ti-cap" aria-hidden="true"></i>`;
  }
  if (id === "mythic") return hasArt("icon_relic_traffic_cone") ? img("icon_relic_traffic_cone", "px ti-img") : `<i class="ti-cone" aria-hidden="true"></i>`;
  if (id === "exchange") return art("icon_copium", `<i class="css-pill ti-img"></i>`, "px ti-img");
  return `<i class="ti-log" aria-hidden="true"><b></b><b></b><b></b></i>`;
}

/** Runs until a featured item comes back after its banner ends ("it comes back in 6 runs"). */
export function comesBackIn(v: BannerView, ctx: MetaContent): number {
  const n = featuredCandidates(v.def.id, ctx).length;
  return Math.max(1, n - 1) * TUNING.rotation.runsPerBanner;
}

/** The poster (re-rendered per banner; the machine stays outside it). */
export function posterHtml(v: BannerView, p: Profile, ctx: MetaContent): string {
  const id = v.def.id;
  const f = v.featured;
  const rc = f ? RARITY_CLS[f.rarity] : id === "mythic" ? "my" : "sr";
  const featuredBanner = v.def.feature === "hero" || v.def.feature === "relic";
  const last = featuredBanner && v.runsLeft <= 1;
  const fomo = featuredBanner
    ? `<button class="bnr-fomo${last ? " last" : ""}" data-nav data-act="fomo" aria-label="${esc(last ? C.lastRunLine(comesBackIn(v, ctx)) : C.fomoLine(v.runsLeft))}. Tap for details.">${esc(last ? C.lastRunLine(comesBackIn(v, ctx)) : C.fomoLine(v.runsLeft))}</button>`
    : id === "mythic"
      ? `<span class="bnr-fomo cursed">PERMANENT · CURSED</span>`
      : `<span class="bnr-fomo calm">ALWAYS HERE · LIKE YOU</span>`;
  let feat = "";
  if (id === "permanent") feat = shelf(p, ctx);
  else if (id === "mythic") feat = road();
  else if (f) feat = featuredArt(f);
  else feat = `<div class="bnr-soon"><b>Between seasons</b><small>The featured item hasn&apos;t been produced yet.</small></div>`;
  const tagLine = f
    ? `<div class="bnr-tag rf r-${rc}">${rarityBadge(f.rarity)}<span class="bt-tx"><small>${id === "mythic" ? "MYTHIC 50/50 · TRUCK-KUN FINDS YOU" : "FEATURED · 50% RATE-UP"}</small><b>${esc(f.name)}</b></span></div>`
    : id === "permanent"
      ? `<div class="bnr-tag rf r-sr"><span class="bt-tx"><small>THE POOL</small><b>${poolLine(p, ctx)}</b></span></div>`
      : "";
  const warn = f?.id === "isekai_kun" ? `<p class="bnr-warn">${esc(C.ISEKAI_WARNING)}</p>` : "";
  return `<div class="bnr b-${id} r-${rc}" data-b="${id}">
    <i class="bnr-rays" aria-hidden="true"></i>
    <i class="bnr-glow" aria-hidden="true"></i>
    ${sparkleBits()}
    <div class="bnr-feat">${feat}</div>
    <header class="bnr-head">
      <small class="bnr-sub">${esc(v.def.subtitle)}</small>
      <h2 class="bnr-title">${esc(v.title)}</h2>
      ${fomo}
    </header>
    ${tagLine}
  </div>${warn}`;
}

function sparkleBits(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += `<i class="bsp s${i}" aria-hidden="true">✦</i>`;
  return s;
}

function poolLine(p: Profile, ctx: MetaContent): string {
  const pool = bannerPool(p, "permanent", ctx);
  let relics = 0;
  let heroes = 0;
  for (const r of Object.keys(pool) as Rarity[]) for (const it of pool[r]) it.kind === "hero" ? heroes++ : relics++;
  return `${fmtInt(relics)} merch · ${fmtInt(heroes)} heroes · 0 refunds`;
}

/** Featured hero (portrait x3.5, tap = shouting frame) or relic (icon x8 on a glowing pedestal). */
function featuredArt(f: GachaItem): string {
  if (f.kind === "hero") {
    const d = heroDef(f.id);
    return `<button class="bnr-star hero" data-nav data-act="shout" aria-label="${esc(f.name)}">${portrait(d?.portrait ?? "", 0, "bnr-por f0")}${portrait(d?.portrait ?? "", 1, "bnr-por f1")}</button>`;
  }
  const flav = RELICS.get(f.id)?.flavor ?? "";
  return `<div class="bnr-star relic"><i class="bnr-halo" aria-hidden="true"></i>${itemArt(f, "bnr-relic")}<i class="bnr-ped" aria-hidden="true"></i><span class="bnr-ltd">LIMITED EDITION</span>${flav ? `<small class="bnr-flav">${esc(flav)}</small>` : ""}</div>`;
}

/** "Totally Normal Merch": a shelf of the pool's best merch, floating. */
function shelf(p: Profile, ctx: MetaContent): string {
  const pool = bannerPool(p, "permanent", ctx);
  const pickR: Rarity[] = ["LR", "UR", "SSR", "SR", "R"];
  const items: GachaItem[] = [];
  for (const r of pickR) for (const it of pool[r]) if (it.kind === "relic" && items.length < 5 && !items.some((x) => x.rarity === r)) items.push(it);
  for (const r of pickR) for (const it of pool[r]) if (it.kind === "relic" && items.length < 5 && !items.includes(it)) items.push(it);
  return `<div class="bnr-shelf">${items.map((it, i) => `<span class="sh-it rf r-${RARITY_CLS[it.rarity]}" style="--i:${i}">${itemArt(it, "sh-img")}</span>`).join("")}<span class="sh-board" aria-hidden="true"></span><span class="sh-stamp">TOTALLY NORMAL</span></div>`;
}

/** The Isekai Express: a night road, ONE traffic cone, "It's coming." (and two headlights far away). */
function road(): string {
  const cone = hasArt("icon_relic_traffic_cone") ? img("icon_relic_traffic_cone", "px rd-cone") : `<i class="rd-cone css-cone"></i>`;
  return `<div class="bnr-road" aria-hidden="true">
    <span class="rd-sky"></span>
    <span class="rd-lights"><i></i><i></i></span>
    <span class="rd-ground"><span class="rd-lines"></span></span>
    <span class="rd-cone-w">${cone}<i class="rd-shadow"></i></span>
    <b class="rd-cap">${esc(C.CONE_CAPTION)}</b>
  </div>`;
}

/** The persistent machine (frames stacked; CSS picks one) + the welcome gift. */
export function machineHtml(frames: string, gift: boolean): string {
  return `${frames}${gift ? `<span class="mm-giftbox" aria-hidden="true"><i></i></span>` : ""}<span class="mm-taps" aria-hidden="true"></span>`;
}

/** UR pity, spark, 50/50 (§7). */
export function pityHtml(v: BannerView, prev: { ur: number; spark: number } | null): string {
  const g = G();
  const f = v.featured;
  const ur = prev?.ur ?? v.pityUR;
  const sp = prev?.spark ?? v.spark;
  const ff = (v.def.feature === "hero" || v.def.feature === "relic" || v.def.feature === "mythic") && f;
  const fifty = ff
    ? v.guaranteed
      ? `<div class="ribbon gold-rb">${esc(C.guaranteeLine(f.rarity))}</div>`
      : `<div class="pb-5050"><i aria-hidden="true">◐</i>NEXT ${esc(f.rarity)}: 50/50 FOR ${esc(f.name.toUpperCase())}</div>`
    : "";
  return `<section class="pity-box">
    <div class="pb-row ur"><span class="pb-l">UR</span>${pbar(ur / g.urPity, `${fmtInt(v.pityUR)} / ${fmtInt(g.urPity)}`, "cyan")}</div>
    <small class="pb-note">${esc(C.urLine(v.pityUR, g.urPity))}</small>
    <div class="pb-row spark${v.sparkReady ? " ready" : ""}"><span class="pb-l">SPARK</span>${pbar(Math.min(1, sp / g.spark), `${fmtInt(Math.min(v.spark, g.spark))} / ${fmtInt(g.spark)}`, v.sparkReady ? "rainbow" : "gold")}${v.sparkReady ? `<button class="btn small gold spk-claim" data-nav data-act="spark">CHOOSE!</button>` : ""}</div>
    <small class="pb-note${v.sparkReady ? " ready" : ""}">${esc(v.sparkReady ? C.SPARK_READY : C.sparkLine(v.spark, g.spark))}</small>
    ${fifty}
    <button class="pb-rates" data-nav data-act="fine" aria-label="Rates and fine print">${RARITIES.map((r) => `<span class="pr r-${RARITY_CLS[r]}">${rarityBadge(r)}<small>${g.rates[r]}%</small></span>`).join("")}</button>
  </section>`;
}

/** The pull dock: PULL ×1 / ×10, the pity bar under them, fine print + Gem Exchange links. */
export function dockHtml(v: BannerView, p: Profile, prevPity: number | null): string {
  const g = G();
  const pity = prevPity ?? v.pity;
  const soft = v.pity >= g.softPityStart;
  const hard = v.pity >= g.hardPity - 1;
  const state = hard ? "hard" : soft ? "soft" : "";
  const msg = hard ? C.HARD_NEXT : soft ? C.SOFT_PITY : "";
  const gems = p.currencies.gems;
  const can1 = v.available && gems >= v.cost1;
  const can10 = v.available && gems >= v.cost10;
  const mark = ((g.softPityStart - 1) / g.hardPity) * 100;
  return `<div class="mm-dock">
    <div class="pull-row">
      <button class="btn violet pull p1${can1 ? "" : " nope"}" data-nav${can1 && !can10 ? " data-nav-default" : ""} data-act="pull1" aria-label="Pull once for ${v.cost1} Dream Gems"><span class="btxt"><span class="blab">PULL ×1</span><small class="bsub">${money("gems", fmtInt(v.cost1))}</small></span></button>
      <button class="btn gold pull p10${can10 ? " can" : " nope"}" data-nav${can10 || !can1 ? " data-nav-default" : ""} data-act="pull10" aria-label="Pull ten times for ${v.cost10} Dream Gems, SR or better guaranteed"><span class="btxt"><span class="blab">PULL ×10</span><small class="bsub">${money("gems", fmtInt(v.cost10))} · SR+ GUARANTEED</small></span></button>
    </div>
    <button class="dock-pity ${state}" data-nav data-act="pitytip" aria-label="Pity ${v.pity} of ${g.hardPity}. ${esc(msg || C.PITY_TIP)}">
      <span class="dp-l">Pity <b>${fmtInt(v.pity)}</b> / ${g.hardPity}</span>
      <span class="dp-bar">${pbar(pity / g.hardPity, "", state === "hard" ? "gold" : state === "soft" ? "" : "violet")}<i class="dp-mark" style="left:${mark.toFixed(2)}%" aria-hidden="true"></i></span>
      ${msg ? `<span class="dp-msg">${esc(msg)}</span>` : ""}
    </button>
    <div class="dock-foot"><button class="mm-fine" data-nav data-act="fine">ⓘ Rates &amp; fine print</button><button class="mm-fine gx" data-nav data-act="gemx">♦ Gem Exchange</button></div>
  </div>`;
}
