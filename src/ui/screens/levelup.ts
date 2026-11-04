/**
 * Level-up modal (DESIGN §2.3): staggered card fly-in + flip, rarity frames
 * (common / rare / epic / animated rainbow evolution), shimmer, NEW! or
 * "Lv x -> y", rerolls, queued level-ups. Mobile safety: taps are ignored for
 * the first 350 ms and must come from a FRESH touch (not the joystick finger).
 *
 * Season 2 (sim agent; the hub-ui agent owns the rest of src/ui): BANISH xN
 * (tap it, then a card: that item leaves the pool for the run and the card is
 * replaced) and SKIP xN (no card, a small XP + coin refund) appear when the
 * RunConfig grants them (flags.banish / flags.skip); "LIMIT BREAK!" cards for
 * mastery levels past Lv 5; a compact grid when 5-6 cards are offered (the
 * Infinite Gacha Credit Card); free rerolls read "REROLL FREE". The few rules
 * for those live in LU_CSS below (injected once) so styles.css stays untouched.
 *
 * Evolution hints (owner request): once the player has discovered a recipe, a weapon card shows
 * "→ EVO · needs PASSIVE" with its state (READY / levels to go / passive greyed) and a NEW passive
 * card "Evolves WEAPON → EVO" for a held weapon; a card whose pick completes the pair or makes the
 * evolution ready glows (src/game/evo-hints.ts decides, ./evo-hints.ts draws).
 */
import { Bot } from "../../debug/bot";
import { cardEvoHints, type EvoHint } from "../../game/evo-hints";
import { PASSIVE_BY_ID } from "../../game/passives";
import { WEAPONS } from "../../game/registry";
import type { UpgradeCard } from "../../game/types";
import type { World } from "../../game/world";
import { time } from "../../core/time";
import type { App, UiScreen } from "../app";
import { esc, h, img, letters } from "../dom";
import { layer } from "./common";
import { evoCardClass, evoGlowHtml, evoLinesHtml, injectEvoCss, runKnown } from "./evo-hints";

const RARITY_LABEL: Record<string, string> = { common: "COMMON", rare: "RARE", epic: "EPIC · LUCKY!", evolution: "EVOLUTION" };
const GUARD = 0.35;
const bot = new Bot(99);

/** Season 2 level-up rules: banish mode, limit-break tag, the 5-6 card grid. */
const LU_CSS = `
.lu-foot .btn.banish{background:linear-gradient(180deg,#ff6b8f,#d63a64)}
.lu-foot .btn.banish.on{filter:brightness(1.25);box-shadow:0 0 0 3px var(--outline),0 0 18px #ff4d6d}
.lu-foot .btn.skip{background:linear-gradient(180deg,#8fd6ff,#4a8fd6)}
.levelup.banishing .card::after{content:"✕ BANISH";position:absolute;inset:0;display:grid;place-items:center;background:rgba(140,20,60,.78);color:#fff;font-family:var(--font);font-size:1.3em;letter-spacing:.08em;text-shadow:var(--ol1);border-radius:13px;pointer-events:none}
.levelup.banishing .card.nobanish{filter:grayscale(.8) brightness(.6);pointer-events:none}
.levelup.banishing .card.nobanish::after{content:none}
.card .tag.lb{background:linear-gradient(90deg,#ffe14d,#ff8fd0,#8fd6ff);color:var(--outline)}
.levelup.many .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55em;width:min(44em,100%)}
.levelup.many .card{width:auto;min-height:0;padding:.6em .6em .55em}
.levelup.many .card .ds{font-size:.85em}
@media (orientation:portrait){
.levelup.many .lu-title{font-size:2.2em;margin-bottom:.1em}
.levelup.many .cards{grid-template-columns:repeat(2,minmax(0,1fr));width:min(30em,100%)}
.levelup.many .card{display:flex;flex-direction:column;text-align:center;padding:.5em .45em .5em;row-gap:.15em}
.levelup.many .card .ic{width:2.8em;height:2.8em;margin:0}
.levelup.many .card .ic img{width:2.4em;height:2.4em}
.levelup.many .card .nm{padding:0;font-size:.95em}
.levelup.many .card .ds{padding:0;font-size:.78em}
.levelup.many .card .pips{position:static;margin-top:.15em}
.levelup.many .card .lvl-ch{font-size:.75em}
}
@media (orientation:landscape) and (max-height:520px){
.levelup.many .card .ic{width:2.6em;height:2.6em;margin-top:.2em}
.levelup.many .card .ic img{width:2.2em;height:2.2em}
.levelup.many .card .ds{font-size:.75em}
}`;
let cssDone = false;
function injectCss(): void {
  if (cssDone || typeof document === "undefined") return;
  cssDone = true;
  const s = document.createElement("style");
  s.dataset.kk = "levelup-s2";
  s.textContent = LU_CSS;
  document.head.appendChild(s);
}

function maxLevel(c: UpgradeCard): number {
  if (c.max) return c.max;
  if (c.kind === "weapon") return WEAPONS.get(c.id)?.levels.length ?? 5;
  if (c.kind === "passive") return PASSIVE_BY_ID.get(c.id)?.levels.length ?? 5;
  return 0;
}

/**
 * Upgrade card markup (rarity frame, icon, name, Lv a -> b, description, pips;
 * rainbow frame for evolutions). Level-up cards are focusable buttons; the
 * chest reuses the same card as a static reveal (`interactive` false).
 * `hints`: the card's evolution hints (cardEvoHints) - lines under it + the synergy glow.
 */
export function cardHtml(c: UpgradeCard, i: number, interactive = true, hints: readonly EvoHint[] = []): string {
  const max = maxLevel(c);
  let tag = "";
  let line = "";
  if (c.kind === "evolution") {
    tag = `<span class="tag">EVOLVE!</span>`;
    const base = WEAPONS.get(c.base ?? "");
    const pas = PASSIVE_BY_ID.get(c.with ?? "");
    line = `${esc(base?.name ?? "")} + ${esc(pas?.name ?? "")}`;
  } else if (c.kind === "heal" || c.kind === "coins") {
    line = "BONUS";
  } else if (c.from === 0) {
    tag = `<span class="tag">NEW!</span>`;
    line = c.kind === "weapon" ? "NEW WEAPON" : "NEW PASSIVE";
  } else if (c.limitBreak) {
    // Lv6 = LIMIT BREAK!, the last mastery level (Lv7) = MASTERED!
    tag = `<span class="tag lb">${c.to >= max && c.to > 6 ? "MASTERED!" : "LIMIT BREAK!"}</span>`;
    line = `WEAPON · Lv <b>${c.from}</b> → <b>${c.to}</b>`;
  } else {
    tag = c.to >= max ? `<span class="tag max">MAX!</span>` : `<span class="tag lv">Lv${c.from}→${c.to}</span>`;
    line = `${c.kind === "weapon" ? "WEAPON" : "PASSIVE"} · Lv <b>${c.from}</b> → <b>${c.to}</b>`;
  }
  let pips = "";
  if (max > 0) {
    pips = '<div class="pips">';
    for (let l = 1; l <= max; l++) pips += `<i class="${l <= c.from ? "on" : l <= c.to ? "up" : ""}"></i>`;
    pips += "</div>";
  }
  const plus = c.kind === "evolution" && c.with ? `<span class="plus">${img(PASSIVE_BY_ID.get(c.with)?.icon ?? "")}</span>` : "";
  const evo = evoCardClass(hints);
  const open = interactive ? `<button class="card ${c.rarity}${evo}" data-nav${i === 0 ? " data-nav-default" : ""} style="--i:${i}" data-i="${i}">` : `<div class="card ${c.rarity}${evo} reveal" style="--i:${i}">`;
  return `${open}
    ${evoGlowHtml(hints)}<div class="shimmer"></div>
    <span class="rar">${RARITY_LABEL[c.rarity] ?? ""}</span>${tag}
    <div class="ic">${img(c.icon, "px", 0, 4)}${plus}</div>
    <div class="nm">${esc(c.name)}</div>
    <div class="lvl-ch">${line}</div>
    <div class="ds">${esc(c.desc)}</div>
    ${pips}${evoLinesHtml(hints)}
  </${interactive ? "button" : "div"}>`;
}

export function openLevelUp(app: App, w: World): UiScreen {
  injectCss();
  injectEvoCss();
  const el = h("div", "modal levelup");
  // BANISH / SKIP only exist when the run grants them (RunConfig.flags.banish / skip)
  const hasBanish = w.banishes > 0;
  const hasSkip = w.skips > 0;
  el.innerHTML = `
    <div class="rays"></div>
    <div class="lu-title">${letters("LEVEL UP!", "ltr", 0.05)}</div>
    <div class="lu-sub"></div>
    <div class="cards"></div>
    <div class="lu-foot"><button class="btn violet small" data-nav data-act="reroll"></button>${hasBanish ? `<button class="btn small banish" data-nav data-act="banish"></button>` : ""}${hasSkip ? `<button class="btn small skip" data-nav data-act="skip"></button>` : ""}</div>`;
  app.ui.appendChild(el);
  const cardsEl = el.querySelector(".cards") as HTMLElement;
  const sub = el.querySelector(".lu-sub") as HTMLElement;
  const rerollBtn = el.querySelector('[data-act="reroll"]') as HTMLButtonElement;
  const banishBtn = el.querySelector('[data-act="banish"]') as HTMLButtonElement | null;
  const skipBtn = el.querySelector('[data-act="skip"]') as HTMLButtonElement | null;
  let openT = 0;
  let busy = false;
  let banishing = false;
  let cards: UpgradeCard[] = [];
  let autoT = 0;
  const L = layer(el);

  const setBanishing = (on: boolean) => {
    banishing = on;
    el.classList.toggle("banishing", on);
    banishBtn?.classList.toggle("on", on);
    updateSub();
  };
  /** The first card of a SEASON FINALE level-up (Season Finale Manga: w.doublePicks) was taken: one more from the rest. */
  let bonusPick = false;
  const updateSub = () => {
    const lv = w.level - w.pendingLevels + 1;
    const choose = bonusPick ? "SEASON FINALE · PICK 1 MORE" : w.doublePicks.has(lv) ? "SEASON FINALE · PICK 2" : "CHOOSE ONE";
    sub.textContent = banishing ? "TAP A CARD TO BANISH IT FOR THE RUN" : `LV ${lv}${w.pendingLevels > 1 ? `  ·  +${w.pendingLevels - 1} MORE` : ""}  ·  ${choose}`;
  };
  const updateFoot = () => {
    const left = w.rerollsLeft;
    rerollBtn.innerHTML = `${img("icon_reroll")} REROLL ${left === Infinity ? "FREE" : `×${left}`}`;
    // (a maxed build only gets the Heal / Star Pouch fallbacks: a reroll could not change them)
    rerollBtn.disabled = left <= 0 || !w.canReroll;
    if (banishBtn) {
      banishBtn.textContent = `✕ BANISH ×${w.banishes}`;
      banishBtn.disabled = w.banishes <= 0 || !cards.some((c) => w.canBanish(c));
    }
    if (skipBtn) {
      skipBtn.textContent = `» SKIP ×${w.skips}`;
      skipBtn.disabled = w.skips <= 0;
    }
  };

  const render = (list: UpgradeCard[]) => {
    // keyboard / gamepad focus survives the in-place re-render (reroll, next queued level)
    const prevAct = L.focus?.dataset.act ?? null;
    cards = list;
    el.classList.toggle("many", list.length > 4);
    // (the known recipes: the Wiki's discoveries + this run's evolutions; a practice run knows all)
    const known = runKnown(app, w);
    const hints = list.map((c) => cardEvoHints(w, c, known));
    // (any hint line: the landscape card grid trims its icons to make room)
    el.classList.toggle("kk-evo-any", hints.some((x) => x.length > 0));
    cardsEl.innerHTML = list.map((c, i) => cardHtml(c, i, true, hints[i])).join("");
    banishing = false;
    el.classList.remove("banishing");
    banishBtn?.classList.remove("on");
    updateSub();
    updateFoot();
    cardsEl.querySelectorAll<HTMLElement>(".card").forEach((b, i) => {
      if (!w.canBanish(list[i])) b.classList.add("nobanish");
    });
    list.forEach((_, i) => setTimeout(() => app.sfx("cardFlip", 0.7, i * 2), 110 + i * 110));
    openT = 0;
    autoT = 0;
    L.focus?.classList.remove("nav-focus");
    L.focus = null;
    for (const b of cardsEl.querySelectorAll<HTMLElement>(".card")) {
      b.addEventListener("click", (e) => onPick(e, Number(b.dataset.i)));
    }
    if (app.nav.top === L) app.nav.refocus(L, prevAct ? el.querySelector<HTMLElement>(`[data-act="${prevAct}"]`) : null);
  };

  const onPick = (e: Event, i: number) => {
    e.stopPropagation();
    if (busy || openT < GUARD) return;
    // real pointer clicks must come from a fresh touch; synthetic (keyboard/gamepad) clicks have detail 0
    const pointer = (e as MouseEvent).detail > 0;
    if (pointer && !app.input.isFresh(e)) return;
    if (banishing) banish(i);
    else pick(i);
  };

  /** Banish mode: the tapped card's item leaves the pool, a fresh card flips into its place. */
  const banish = (i: number) => {
    const c = cards[i];
    if (!c || busy || !w.canBanish(c)) return;
    const next = w.banish(c);
    if (!next) return;
    busy = true;
    app.sfx("uiBack");
    const b = cardsEl.querySelectorAll<HTMLElement>(".card")[i];
    b?.classList.add("gone");
    setTimeout(() => {
      busy = false;
      render(next);
    }, 260);
  };

  /** Skip this level-up: no card, an XP + coin refund (the next queued level, or back to the game). */
  const skip = () => {
    if (busy || openT < GUARD || w.skips <= 0) return;
    if (!w.skipLevelUp()) return;
    bonusPick = false;
    busy = true;
    app.sfx("coin");
    cardsEl.querySelectorAll<HTMLElement>(".card").forEach((b) => b.classList.add("gone"));
    setTimeout(() => {
      busy = false;
      if (w.pendingLevels > 0) {
        app.input.markTouchesStale();
        app.sfx("levelUp", 0.6);
        render(w.offer());
      } else {
        app.closeModal();
        time.easeTo(1, 0.25);
      }
    }, 330);
  };

  const pick = (i: number) => {
    const c = cards[i];
    if (!c || busy) return;
    busy = true;
    const els = cardsEl.querySelectorAll<HTMLElement>(".card");
    els.forEach((b, k) => b.classList.add(k === i ? "picked" : "gone"));
    // evolutions play their "evolve" fanfare in the deferred celebration (view/feedback.ts) once the modal closes
    app.sfx(c.kind === "evolution" ? "powerup" : "cardPick");
    const lv = w.level - w.pendingLevels + 1;
    const double = w.doublePicks.has(lv);
    const pending = w.pendingLevels;
    w.choose(c);
    // (World.choose kept the rest of the offer for a second pick when the level is still pending)
    bonusPick = double && w.pendingLevels === pending;
    setTimeout(() => {
      busy = false;
      if (w.pendingLevels > 0) {
        app.input.markTouchesStale();
        app.sfx("levelUp", 0.6);
        render(w.offer());
      } else {
        app.closeModal();
        time.easeTo(1, 0.25);
      }
    }, 430);
  };

  onTapGuarded(rerollBtn, () => {
    if (busy || openT < GUARD || w.rerollsLeft <= 0 || !w.canReroll) return;
    const next = w.reroll();
    if (next) {
      app.sfx("reroll");
      render(next);
    }
  });
  if (banishBtn)
    onTapGuarded(banishBtn, () => {
      if (busy || openT < GUARD || w.banishes <= 0) return;
      app.sfx(banishing ? "uiBack" : "uiConfirm", 0.8);
      setBanishing(!banishing);
    });
  if (skipBtn) onTapGuarded(skipBtn, skip);
  render(w.offer());

  return {
    el,
    layer: L,
    close() {
      el.classList.add("out");
      setTimeout(() => el.remove(), 220);
    },
    update(dt) {
      openT += dt;
      if (app.params.autoplay && !busy) {
        autoT += dt;
        if (autoT > 1.6) pick(cards.indexOf(bot.pick(w, cards)));
      }
    },
  };
}

function onTapGuarded(el: HTMLElement, fn: () => void): void {
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    fn();
  });
}
