/**
 * Markup helpers + small components of the hub kit (styles in kit.css):
 *
 *   btn()        the glossy pill button (.btn, existing look) with icon / subtitle / badge
 *   iconBtn()    round 44 px icon button (back, close, settings, zoom)
 *   badge()      "!" / count / NEW notification dot on any button
 *   pbar()       progress bar (fill by transform: scaleX, label inside)
 *   row()        list row: icon | title + sub | right side
 *   card()       generic card (art | kicker + title + body), optional N..MYTHIC rarity frame
 *   TabBar       horizontal tabs (scrolls on phones), keyboard / gamepad via data-nav
 *
 * Every interactive element carries `data-nav` (spatial keyboard / gamepad
 * focus, ui/nav.ts) and is at least 44 CSS px tall.
 */
import { esc, h } from "../dom";
import { onTap } from "../screens/common";

export interface BtnOpts {
  /** Extra classes: "gold" | "violet" | "alt" | "ghost" | "small" | "wide" ... */
  cls?: string;
  /** data-act value. */
  act?: string;
  /** Leading icon markup. */
  icon?: string;
  /** Small second line under the label. */
  sub?: string;
  /** Badge markup (badge()). */
  badge?: string;
  /** data-nav-default (the layer's default focus). */
  def?: boolean;
  disabled?: boolean;
  /** Extra attributes ("data-id=x"). */
  attrs?: string;
  aria?: string;
}

export function btn(label: string, o: BtnOpts = {}): string {
  const sub = o.sub ? `<small class="bsub">${esc(o.sub)}</small>` : "";
  const text = o.sub ? `<span class="btxt"><span class="blab">${label}</span>${sub}</span>` : `<span class="blab">${label}</span>`;
  const b = `<button class="btn ${o.cls ?? ""}${o.sub ? " two" : ""}" data-nav${o.def ? " data-nav-default" : ""}${o.act ? ` data-act="${o.act}"` : ""}${o.disabled ? " disabled" : ""}${o.aria ? ` aria-label="${esc(o.aria)}"` : ""} ${o.attrs ?? ""}>${o.icon ?? ""}${text}</button>`;
  // a pill clips its children (its shine sweep): the badge sits on a wrapper so it can hang off the corner
  return o.badge ? `<span class="bwrap">${b}${o.badge}</span>` : b;
}

/** Round icon button (glyph or icon markup). */
export function iconBtn(glyph: string, act: string, aria: string, cls = ""): string {
  return `<button class="ibtn ${cls}" data-nav data-act="${act}" aria-label="${esc(aria)}" title="${esc(aria)}">${glyph}</button>`;
}

/** Notification badge: "!" (default), a count, or "NEW". Empty string when `show` is false. */
export function badge(show: boolean | number, text?: string): string {
  if (!show) return "";
  const t = text ?? (typeof show === "number" ? (show > 99 ? "99+" : String(show)) : "!");
  return `<i class="bdg${t === "NEW" ? " new" : ""}" aria-label="${esc(t === "!" ? "something new" : t)}">${esc(t)}</i>`;
}

/** Progress bar 0..1. `label` sits inside; `cls` picks the colour ("gold", "pink", "cyan", "rainbow"). */
export function pbar(frac: number, label = "", cls = ""): string {
  const k = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  return `<div class="pbar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(k * 100)}"><i style="transform:scaleX(${k.toFixed(4)})"></i>${label ? `<span class="pv">${label}</span>` : ""}</div>`;
}

/** Set an existing bar's fill (transform only). */
export function setBar(el: Element | null, frac: number, label?: string): void {
  if (!el) return;
  const k = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  const i = el.querySelector("i") as HTMLElement | null;
  if (i) i.style.transform = `scaleX(${k.toFixed(4)})`;
  el.setAttribute("aria-valuenow", String(Math.round(k * 100)));
  if (label !== undefined) {
    const pv = el.querySelector(".pv");
    if (pv) pv.textContent = label;
  }
}

export interface RowOpts {
  icon?: string;
  title: string;
  sub?: string;
  right?: string;
  cls?: string;
  /** Focusable / tappable row (a <button>). */
  act?: string;
  attrs?: string;
}

/** List row. Interactive rows are buttons with data-nav. */
export function row(o: RowOpts): string {
  const inner = `${o.icon ? `<span class="rw-ic">${o.icon}</span>` : ""}<span class="rw-tx"><b>${o.title}</b>${o.sub ? `<small>${o.sub}</small>` : ""}</span>${o.right ? `<span class="rw-r">${o.right}</span>` : ""}`;
  return o.act
    ? `<button class="krow ${o.cls ?? ""}" data-nav data-act="${o.act}" ${o.attrs ?? ""}>${inner}</button>`
    : `<div class="krow ${o.cls ?? ""}" ${o.attrs ?? ""}>${inner}</div>`;
}

export interface CardOpts {
  /** Title line (markup). */
  title?: string;
  /** Small kicker above the title ("SSR RELIC", "RING 2"). */
  kicker?: string;
  /** Body markup. */
  body?: string;
  /** Art / icon markup on the left. */
  art?: string;
  /** Rarity frame (N..MYTHIC): the card gets `.rf .r-<rarity>`. */
  rarity?: "n" | "r" | "sr" | "ssr" | "ur" | "lr" | "my";
  cls?: string;
  /** Tappable card (a <button> with data-nav). */
  act?: string;
  attrs?: string;
}

/**
 * Generic card: art | kicker + title + body, optionally in a rarity frame.
 * Interactive cards are buttons (44 px+, data-nav) so they join keyboard / gamepad focus.
 */
export function card(o: CardOpts): string {
  const frame = o.rarity ? ` rf r-${o.rarity}` : "";
  const inner = `${o.art ? `<span class="kc-art">${o.art}</span>` : ""}<span class="kc-tx">${o.kicker ? `<small class="kc-k">${esc(o.kicker)}</small>` : ""}${o.title ? `<b class="kc-t">${o.title}</b>` : ""}${o.body ? `<span class="kc-b">${o.body}</span>` : ""}</span>`;
  return o.act
    ? `<button class="kcard${frame} ${o.cls ?? ""}" data-nav data-act="${o.act}" ${o.attrs ?? ""}>${inner}</button>`
    : `<div class="kcard${frame} ${o.cls ?? ""}" ${o.attrs ?? ""}>${inner}</div>`;
}

/** Section heading inside a page / sheet. */
export function sectionTitle(text: string, right = ""): string {
  return `<div class="ksec"><span>${text}</span>${right}</div>`;
}

/** Small tag chip ("KEYSTONE", "LIMIT BREAK!"). */
export function tag(text: string, cls = ""): string {
  return `<span class="ktag ${cls}">${esc(text)}</span>`;
}

export interface TabDef {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
}

/**
 * Tab bar. Tabs are buttons in a horizontally scrolling strip; the active one
 * gets the glossy pill. `onChange` fires on a user switch (not on `select`).
 */
export class TabBar {
  readonly el: HTMLElement;
  current: string;

  constructor(
    tabs: readonly TabDef[],
    initial: string,
    private readonly onChange: (id: string) => void,
    cls = "",
  ) {
    this.el = h("div", `tabbar ${cls}`);
    this.el.setAttribute("role", "tablist");
    this.current = initial;
    this.render(tabs);
    // a deep-linked tab past the strip's right edge: scroll it into view once the strip is laid out
    requestAnimationFrame(() => {
      if (this.el.isConnected) this.select(this.current);
    });
  }

  render(tabs: readonly TabDef[]): void {
    this.el.innerHTML = tabs
      .map(
        (t) =>
          `<button class="tabb${t.id === this.current ? " on" : ""}" role="tab" aria-selected="${t.id === this.current}" data-nav data-tab="${esc(t.id)}">${t.icon ?? ""}<span>${esc(t.label)}</span>${t.badge ?? ""}</button>`,
      )
      .join("");
    for (const b of this.el.querySelectorAll<HTMLElement>(".tabb")) {
      onTap(b, () => {
        const id = b.dataset.tab as string;
        if (id === this.current) return;
        this.select(id);
        this.onChange(id);
      });
    }
  }

  /** Highlight a tab (no callback). Scrolls it into view inside the strip. */
  select(id: string): void {
    this.current = id;
    for (const b of this.el.querySelectorAll<HTMLElement>(".tabb")) {
      const on = b.dataset.tab === id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", String(on));
      if (on) {
        // keep it visible in a scrolled strip (no smooth scroll: no layout thrash on switch)
        const L = b.offsetLeft;
        const R = L + b.offsetWidth;
        const s = this.el.scrollLeft;
        const w = this.el.clientWidth;
        if (L < s) this.el.scrollLeft = L - 8;
        else if (R > s + w) this.el.scrollLeft = R - w + 8;
      }
    }
  }

  /** Update one tab's badge in place. */
  setBadge(id: string, html: string): void {
    const b = this.el.querySelector<HTMLElement>(`.tabb[data-tab="${CSS.escape(id)}"]`);
    if (!b) return;
    b.querySelector(".bdg")?.remove();
    if (html) b.insertAdjacentHTML("beforeend", html);
  }
}

/** Bind data-act buttons inside `root` to handlers (ghost-click protected). */
export function bindActs(root: Element, acts: Record<string, (el: HTMLElement, e: Event) => void>): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-act]")) {
    const fn = acts[el.dataset.act as string];
    if (fn) onTap(el, (e) => fn(el, e));
  }
}

/** Shake an element once (denied purchase). One-shot WAAPI: no class replay, no reflow. */
export function shake(el: Element | null): void {
  if (!el || typeof (el as HTMLElement).animate !== "function") return;
  (el as HTMLElement).animate(
    [{ translate: "0" }, { translate: "-6px" }, { translate: "6px" }, { translate: "-4px" }, { translate: "3px" }, { translate: "0" }],
    { duration: 320, easing: "ease-in-out" },
  );
}

/** One-shot pop (bought / equipped). */
export function pop(el: Element | null, scale = 1.12): void {
  if (!el || typeof (el as HTMLElement).animate !== "function") return;
  (el as HTMLElement).animate(
    [{ transform: "none" }, { transform: `scale(${scale}) rotate(-2deg)`, offset: 0.35 }, { transform: "none" }],
    { duration: 420, easing: "cubic-bezier(0.3, 1.8, 0.5, 1)" },
  );
}
