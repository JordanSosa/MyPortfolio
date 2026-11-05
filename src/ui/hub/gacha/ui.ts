/**
 * Small Merch Machine overlays: the pull confirm (gacha.md §2 beat 0: a bottom
 * sheet over the machine, "Spend 1,600 ♦? (That's 1,600 ♦.)" PULL! / I have
 * regrets), a multi-button choice dialog (the insufficient-gems upsell) and a
 * tap tooltip. Same rules as kit/overlay.ts: a NavLayer (keyboard / gamepad,
 * Back closes), the Back guard via overlayOpened / Closed, transform /
 * opacity animation only, the safe choice is the default focus.
 */
import { esc, h } from "../../dom";
import { trackOverlay, type KitHost } from "../../kit/overlay";
import { reducedMotion } from "../../kit/ticker";
import type { NavLayer } from "../../nav";
import { markBorn, onTap } from "../../screens/common";

export interface ChoiceBtn {
  id: string;
  label: string;
  cls?: string;
  /** The default focus (the safe choice). */
  def?: boolean;
}

export interface ChoiceOpts {
  title: string;
  /** Body markup. */
  body: string;
  buttons: ChoiceBtn[];
  /** Extra class on the panel ("sheet" = bottom sheet on portrait phones). */
  cls?: string;
  /** Markup above the title (art). */
  art?: string;
}

/** Modal with N buttons. Resolves the pressed button's id, or null (Back / scrim). */
export function choiceDialog(host: KitHost, o: ChoiceOpts): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = h("div", `kover kdialog-wrap mm-choice ${o.cls ?? ""}`);
    wrap.innerHTML = `
      <div class="kscrim"></div>
      <section class="kdialog panel" role="alertdialog" aria-modal="true" aria-label="${esc(o.title)}">
        ${o.art ? `<div class="mc-art">${o.art}</div>` : ""}
        <h2 class="kd-t">${esc(o.title)}</h2>
        <div class="kd-b">${o.body}</div>
        <div class="kd-btns">${o.buttons.map((b) => `<button class="btn small ${b.cls ?? ""}" data-nav${b.def ? " data-nav-default" : ""} data-id="${esc(b.id)}">${esc(b.label)}</button>`).join("")}</div>
      </section>`;
    host.ui.appendChild(wrap);
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      trackOverlay(-1);
      host.nav.remove(layer);
      wrap.classList.add("out");
      wrap.style.pointerEvents = "none";
      setTimeout(() => wrap.remove(), reducedMotion() ? 0 : 220);
      host.sfx(v && v !== "no" ? "uiConfirm" : "uiBack");
      host.overlayClosed();
      resolve(v);
    };
    const layer: NavLayer = { root: wrap, onBack: () => finish(null), focus: null };
    for (const b of wrap.querySelectorAll<HTMLElement>("[data-id]")) onTap(b, () => finish(b.dataset.id as string));
    wrap.querySelector(".kscrim")?.addEventListener("click", (e) => {
      e.stopPropagation();
      finish(null);
    });
    trackOverlay(1);
    markBorn();
    host.nav.push(layer);
    host.overlayOpened();
    host.sfx("uiMove");
  });
}

/** Tap tooltip above (or below) an anchor; one at a time, gone after `ms` or the next tap anywhere. */
let tipEl: HTMLElement | null = null;
let tipTimer = 0;
export function showTip(anchor: HTMLElement, text: string, ms = 2800): void {
  hideTip();
  const r = anchor.getBoundingClientRect();
  const t = h("div", "mm-tip", esc(text));
  t.setAttribute("role", "tooltip");
  document.getElementById("ui")?.appendChild(t) ?? document.body.appendChild(t);
  const w = Math.min(innerWidth - 24, 300);
  t.style.maxWidth = `${w}px`;
  const tw = t.offsetWidth;
  const th = t.offsetHeight;
  const x = Math.max(12, Math.min(innerWidth - 12 - tw, r.left + r.width / 2 - tw / 2));
  const above = r.top - th - 12 > 8;
  const y = above ? r.top - th - 10 : r.bottom + 10;
  t.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  t.classList.add(above ? "up" : "down");
  t.style.setProperty("--ax", `${(r.left + r.width / 2 - x).toFixed(0)}px`);
  tipEl = t;
  tipTimer = window.setTimeout(hideTip, ms);
  setTimeout(() => addEventListener("pointerdown", hideTip, { once: true, capture: true }), 0);
}

export function hideTip(): void {
  clearTimeout(tipTimer);
  const t = tipEl;
  tipEl = null;
  if (!t) return;
  t.classList.add("out");
  setTimeout(() => t.remove(), 180);
}
