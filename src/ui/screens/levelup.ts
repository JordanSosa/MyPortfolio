/**
 * Level-up modal (DESIGN §2.3): staggered card fly-in + flip, rarity frames
 * (common / rare / epic / animated rainbow evolution), shimmer, NEW! or
 * "Lv x -> y", rerolls, queued level-ups. Mobile safety: taps are ignored for
 * the first 350 ms and must come from a FRESH touch (not the joystick finger).
 */
import { Bot } from "../../debug/bot";
import { PASSIVE_BY_ID } from "../../game/passives";
import { WEAPONS } from "../../game/registry";
import type { UpgradeCard } from "../../game/types";
import type { World } from "../../game/world";
import { time } from "../../core/time";
import type { App, UiScreen } from "../app";
import { esc, h, img, letters } from "../dom";
import { layer } from "./common";

const RARITY_LABEL: Record<string, string> = { common: "COMMON", rare: "RARE", epic: "EPIC · LUCKY!", evolution: "EVOLUTION" };
const GUARD = 0.35;
const bot = new Bot(99);

function maxLevel(c: UpgradeCard): number {
  if (c.kind === "weapon") return WEAPONS.get(c.id)?.levels.length ?? 5;
  if (c.kind === "passive") return PASSIVE_BY_ID.get(c.id)?.levels.length ?? 5;
  return 0;
}

/**
 * Upgrade card markup (rarity frame, icon, name, Lv a -> b, description, pips;
 * rainbow frame for evolutions). Level-up cards are focusable buttons; the
 * chest reuses the same card as a static reveal (`interactive` false).
 */
export function cardHtml(c: UpgradeCard, i: number, interactive = true): string {
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
  const open = interactive ? `<button class="card ${c.rarity}" data-nav${i === 0 ? " data-nav-default" : ""} style="--i:${i}" data-i="${i}">` : `<div class="card ${c.rarity} reveal" style="--i:${i}">`;
  return `${open}
    <div class="shimmer"></div>
    <span class="rar">${RARITY_LABEL[c.rarity] ?? ""}</span>${tag}
    <div class="ic">${img(c.icon, "px", 0, 4)}${plus}</div>
    <div class="nm">${esc(c.name)}</div>
    <div class="lvl-ch">${line}</div>
    <div class="ds">${esc(c.desc)}</div>
    ${pips}
  </${interactive ? "button" : "div"}>`;
}

export function openLevelUp(app: App, w: World): UiScreen {
  const el = h("div", "modal levelup");
  el.innerHTML = `
    <div class="rays"></div>
    <div class="lu-title">${letters("LEVEL UP!", "ltr", 0.05)}</div>
    <div class="lu-sub"></div>
    <div class="cards"></div>
    <div class="lu-foot"><button class="btn violet small" data-nav data-act="reroll"></button></div>`;
  app.ui.appendChild(el);
  const cardsEl = el.querySelector(".cards") as HTMLElement;
  const sub = el.querySelector(".lu-sub") as HTMLElement;
  const rerollBtn = el.querySelector('[data-act="reroll"]') as HTMLButtonElement;
  let openT = 0;
  let busy = false;
  let cards: UpgradeCard[] = [];
  let autoT = 0;
  const L = layer(el);

  const render = (list: UpgradeCard[]) => {
    // keyboard / gamepad focus survives the in-place re-render (reroll, next queued level)
    const prevAct = L.focus?.dataset.act ?? null;
    cards = list;
    cardsEl.innerHTML = list.map((c, i) => cardHtml(c, i)).join("");
    sub.textContent = `LV ${w.level - w.pendingLevels + 1}${w.pendingLevels > 1 ? `  ·  +${w.pendingLevels - 1} MORE` : ""}  ·  CHOOSE ONE`;
    rerollBtn.innerHTML = `${img("icon_reroll")} REROLL ×${w.rerolls}`;
    // (a maxed build only gets the Heal / Star Pouch fallbacks: a reroll could not change them)
    rerollBtn.disabled = w.rerolls <= 0 || !w.canReroll;
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
    pick(i);
  };

  const pick = (i: number) => {
    const c = cards[i];
    if (!c || busy) return;
    busy = true;
    const els = cardsEl.querySelectorAll<HTMLElement>(".card");
    els.forEach((b, k) => b.classList.add(k === i ? "picked" : "gone"));
    app.sfx(c.kind === "evolution" ? "evolve" : "cardPick");
    w.choose(c);
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
    if (busy || openT < GUARD || w.rerolls <= 0 || !w.canReroll) return;
    const next = w.reroll();
    if (next) {
      app.sfx("reroll");
      render(next);
    }
  });
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
