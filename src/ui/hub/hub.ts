/**
 * The Season 2 hub (docs/EXPANSION.md §14): one screen holding a navigation
 * STACK of pages (home -> stages -> loadout, home -> board, home -> heroes ->
 * hero, ...) under a persistent header (back button, page title, currency bar,
 * settings). The live attract game keeps running behind it.
 *
 *  - push: the new page slides in from the right, the old one slides a little
 *    left and fades (then `hidden`, so it keeps its state and scroll); pop is
 *    the reverse and disposes the page. transform / opacity only.
 *  - every page has its own NavLayer whose root is the whole hub, so the
 *    header buttons and the visible page are navigable (hidden pages drop out
 *    because `offsetParent` is null); Esc / gamepad B / Android Back pop.
 *  - App.syncHistory() keeps the Back guard armed while the stack is deeper
 *    than home (or an overlay is open), so Back at the home page leaves the app.
 *  - pages call `hub.changed()` after mutating the profile: it persists the
 *    save and counts the currency bar to the new balances.
 */
import type { MusicTrack } from "../../audio/api";
import type { App, UiScreen } from "../app";
import { h } from "../dom";
import { CurrencyBar } from "../kit/currency";
import { iconBtn } from "../kit/controls";
import { toast, type ToastOpts } from "../kit/overlay";
import type { NavLayer } from "../nav";
import { save } from "../save";
import { markBorn, onTap, sparkles } from "../screens/common";
import { boardPage } from "./board";
import { bootNotices } from "./celebrate";
import { gachaPage } from "./gacha";
import { heroPage, heroesPage } from "./heroes";
import { homePage } from "./home";
import { loadoutPage } from "./loadout";
import { stagesPage } from "./stages";
import { wikiPage } from "./wiki";

export type PageId = "home" | "stages" | "loadout" | "board" | "heroes" | "hero" | "gacha" | "wiki";

export interface PageOpts {
  /** hero detail page: which hero. */
  hero?: string;
  /** board: centre on the cheapest affordable node (results "Upgrade"). */
  focus?: "affordable";
  /** initial tab (gacha / wiki / hero). */
  tab?: string;
}

export interface HubPage {
  readonly id: PageId;
  /** Page root (class "hpage"). */
  readonly el: HTMLElement;
  /** Header title ("" = none: the home page shows the logo instead). */
  readonly title: string;
  readonly layer: NavLayer;
  /** Music while this page is on top (default "hub"). */
  readonly music?: MusicTrack;
  /** The page covers most of the attract game (its WebGL redraw is throttled). */
  readonly opaque?: boolean;
  /** Where the attract hero should run on this page (screen fractions), if visible. */
  camAnchor?(): { x: number; y: number } | null;
  /** The page is on top again (after a pop or a purchase elsewhere): refresh what it shows. */
  show?(): void;
  update?(dt: number): void;
  dispose?(): void;
}

type Factory = (hub: Hub, o: PageOpts) => HubPage;

const PAGES: Record<PageId, Factory> = {
  home: homePage,
  stages: stagesPage,
  loadout: loadoutPage,
  board: boardPage,
  heroes: heroesPage,
  hero: heroPage,
  gacha: gachaPage,
  wiki: wikiPage,
};

const SLIDE_MS = 300;

export class Hub implements UiScreen {
  readonly el: HTMLElement;
  /** The hub manages its own page layers. */
  readonly layer: NavLayer | null = null;
  readonly cbar: CurrencyBar;
  private readonly pagesEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly backBtn: HTMLElement;
  private readonly stack: HubPage[] = [];
  private closed = false;

  constructor(
    readonly app: App,
    path: readonly PageId[] = ["home"],
    opts: PageOpts = {},
  ) {
    this.el = h("div", "scr hub");
    this.el.innerHTML = `
      <div class="hub-bg" aria-hidden="true"></div>
      ${sparkles(10)}
      <header class="hub-top">
        ${iconBtn("◀", "back", "Back", "hub-back")}
        <div class="hub-title" aria-live="polite"><span></span></div>
        <div class="hub-cbar"></div>
        ${iconBtn("⚙", "settings", "Settings", "hub-gear")}
      </header>
      <div class="hub-pages"></div>`;
    this.pagesEl = this.el.querySelector(".hub-pages") as HTMLElement;
    this.titleEl = this.el.querySelector(".hub-title span") as HTMLElement;
    this.backBtn = this.el.querySelector(".hub-back") as HTMLElement;
    this.cbar = new CurrencyBar();
    this.cbar.set(save.profile.currencies);
    (this.el.querySelector(".hub-cbar") as HTMLElement).appendChild(this.cbar.el);
    onTap(this.backBtn, () => this.back());
    onTap(this.el.querySelector(".hub-gear"), () => {
      app.sfx("uiConfirm");
      app.openSettingsModal();
    });
    app.ui.appendChild(this.el);
    // build the path without transitions (deep links, results "Upgrade" -> home > board)
    const ids: PageId[] = path.length ? [...path] : ["home"];
    if (ids[0] !== "home") ids.unshift("home");
    ids.forEach((id, i) => this.pushNow(PAGES[id](this, i === ids.length - 1 ? opts : {}), i === ids.length - 1));
    this.syncChrome();
    // first time at home this session: welcome (v1 migration), recovered save, boot unlocks, Plot Points ready
    if (this.stack.length === 1) bootNotices(this);
  }

  /** Stack depth (1 = home). */
  get depth(): number {
    return this.stack.length;
  }

  get top(): HubPage | undefined {
    return this.stack[this.stack.length - 1];
  }

  /** The visible page covers the attract game. */
  get coversScene(): boolean {
    return !!this.top?.opaque;
  }

  camAnchor(): { x: number; y: number } | null {
    return this.top?.camAnchor?.() ?? null;
  }

  // ---------------------------------------------------------------- stack
  /** Open a page on top (animated). */
  open(id: PageId, o: PageOpts = {}): void {
    if (this.closed) return;
    this.app.sfx("hubOpen");
    const prev = this.top;
    const page = PAGES[id](this, o);
    if (prev) {
      this.app.nav.remove(prev.layer);
      this.slide(prev.el, "p-out-l", true);
    }
    this.pushNow(page, true, false);
    this.slide(page.el, "p-in-r", false);
    this.syncChrome();
  }

  private pushNow(page: HubPage, visible: boolean, hidePrev = true): void {
    page.el.classList.add("hpage");
    this.pagesEl.appendChild(page.el);
    const prev = this.top;
    if (prev && visible && hidePrev) {
      this.app.nav.remove(prev.layer);
      prev.el.hidden = true;
    }
    this.stack.push(page);
    page.el.hidden = !visible;
    if (visible) this.app.nav.push(page.layer);
    markBorn();
  }

  /** Pop the top page (Back). At home: nothing (Back leaves the app through the history guard). */
  back(): void {
    if (this.closed || this.stack.length <= 1) return;
    const page = this.stack.pop() as HubPage;
    this.app.nav.remove(page.layer);
    this.app.sfx("uiBack");
    this.slide(page.el, "p-out-r", false, () => {
      page.dispose?.();
      page.el.remove();
    });
    const top = this.top as HubPage;
    top.el.hidden = false;
    this.slide(top.el, "p-in-l", false);
    this.app.nav.push(top.layer);
    markBorn();
    top.show?.();
    this.syncChrome();
  }

  /** Pop back to a page id (home if it is not in the stack): the pages in between go silently. */
  popTo(id: PageId): void {
    const i = this.stack.findIndex((p) => p.id === id);
    const target = i < 0 ? 0 : i;
    while (this.stack.length - 1 > target + 1) {
      const p = this.stack.splice(this.stack.length - 2, 1)[0];
      this.app.nav.remove(p.layer);
      p.dispose?.();
      p.el.remove();
    }
    if (this.stack.length - 1 > target) this.back();
  }

  /** Play a slide class; `hide` sets `hidden` at the end; `done` runs at the end. */
  private slide(el: HTMLElement, cls: string, hide: boolean, done?: () => void): void {
    el.classList.remove("p-in-r", "p-in-l", "p-out-l", "p-out-r");
    el.classList.add(cls);
    const end = () => {
      el.classList.remove(cls);
      if (hide && this.top?.el !== el) el.hidden = true;
      done?.();
    };
    setTimeout(end, SLIDE_MS);
  }

  /** Header + music + history after the top changed. */
  private syncChrome(): void {
    const top = this.top;
    if (!top) return;
    this.el.classList.toggle("at-home", this.stack.length <= 1);
    this.el.classList.toggle("covered", !!top.opaque);
    this.el.dataset.page = top.id;
    this.backBtn.hidden = this.stack.length <= 1;
    if (this.titleEl.textContent !== top.title) {
      this.titleEl.textContent = top.title;
      if (top.title && typeof this.titleEl.animate === "function")
        this.titleEl.animate([{ transform: "translateY(-40%) scale(1.15)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 320, easing: "cubic-bezier(0.2, 1.6, 0.4, 1)" });
    }
    this.app.music(top.music ?? "hub");
    this.app.syncHistory();
  }

  // ---------------------------------------------------------------- shared helpers for pages
  /** The profile changed (purchase, equip, pull...): persist and count the currency bar. */
  changed(pop = true): void {
    save.save();
    this.cbar.sync(save.profile.currencies, pop);
  }

  toast(msg: string, o: ToastOpts = {}): void {
    toast(this.app, msg, o);
  }

  /** The visible page re-reads the profile (after import / external changes). */
  refreshTop(): void {
    this.cbar.set(save.profile.currencies);
    this.top?.show?.();
  }

  // ---------------------------------------------------------------- UiScreen
  update(dt: number): void {
    this.top?.update?.(dt);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.stack) {
      this.app.nav.remove(p.layer);
      p.dispose?.();
    }
    this.stack.length = 0;
    this.cbar.dispose();
    this.el.classList.add("out");
    this.el.style.pointerEvents = "none";
    setTimeout(() => this.el.remove(), 240);
  }
}

/** NavLayer of a page: the whole hub is the root (header + the visible page); Back pops. */
export function pageLayer(hub: Hub, onBack?: () => void): NavLayer {
  return { root: hub.el, onBack: onBack ?? (() => hub.back()), focus: null };
}
