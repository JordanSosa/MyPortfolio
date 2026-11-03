/**
 * Hub overlays: the detail sheet (bottom sheet on portrait phones, side panel
 * on landscape / desktop), the confirm dialog and toasts (plain + the
 * achievement style). Sheets and dialogs push a NavLayer (keyboard / gamepad
 * focus stays inside, Esc / B / Android Back close them) and tell the host so
 * the history guard is armed while they are open.
 *
 * Animation: transform / opacity only (compositor); the wrapper is
 * `contain: strict`, so opening a sheet never relayouts the page under it.
 */
import type { SfxId } from "../../audio/api";
import { esc, h } from "../dom";
import type { Nav, NavLayer } from "../nav";
import { markBorn, onTap } from "../screens/common";
import { reducedMotion } from "./ticker";

/** What the kit needs from the App. */
export interface KitHost {
  readonly ui: HTMLElement;
  readonly nav: Nav;
  sfx(id: SfxId, vol?: number, pitch?: number): void;
  /** An overlay opened / closed (history guard, Back routing). */
  overlayOpened(): void;
  overlayClosed(): void;
}

// ------------------------------------------------------------------ detail sheet

export interface SheetOpts {
  title: string;
  /** Body markup. */
  html: string;
  /** Extra class on the sheet ("wide", rarity tint ...). */
  cls?: string;
  /** Small kicker line above the title ("KEYSTONE", "SSR RELIC"). */
  kicker?: string;
  /** Icon markup left of the title. */
  icon?: string;
  /** Sticky footer markup (action buttons). */
  foot?: string;
  onClose?: () => void;
}

export interface SheetHandle {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  readonly foot: HTMLElement;
  readonly layer: NavLayer;
  readonly closed: boolean;
  /** Replace the body (and optionally footer / title) in place. Keeps focus when possible. */
  update(o: Partial<Pick<SheetOpts, "html" | "foot" | "title" | "kicker" | "icon">>): void;
  close(): void;
}

/** Sheets / dialogs currently open (the App's history guard reads it). */
let openCount = 0;
export function overlaysOpen(): number {
  return openCount;
}

/** Custom full-screen overlays (gacha reveal, unlock celebrations) count like sheets for the Back guard. */
export function trackOverlay(delta: 1 | -1): void {
  openCount = Math.max(0, openCount + delta);
}

export function openSheet(host: KitHost, o: SheetOpts): SheetHandle {
  const wrap = h("div", "kover ksheet-wrap");
  wrap.innerHTML = `
    <div class="kscrim"></div>
    <section class="ksheet ${o.cls ?? ""}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
      <div class="ksh-grab" aria-hidden="true"><i></i></div>
      <header class="ksh-head">
        <span class="ksh-ic"></span>
        <div class="ksh-tt"><small class="ksh-k"></small><h2 class="ksh-t"></h2></div>
        <button class="ibtn small" data-nav data-act="x" aria-label="Close">✕</button>
      </header>
      <div class="ksh-body kscroll"></div>
      <footer class="ksh-foot"></footer>
    </section>`;
  host.ui.appendChild(wrap);
  const sheet = wrap.querySelector(".ksheet") as HTMLElement;
  const body = wrap.querySelector(".ksh-body") as HTMLElement;
  const foot = wrap.querySelector(".ksh-foot") as HTMLElement;
  const fill = (u: Partial<SheetOpts>) => {
    if (u.title !== undefined) (wrap.querySelector(".ksh-t") as HTMLElement).textContent = u.title;
    if (u.kicker !== undefined) (wrap.querySelector(".ksh-k") as HTMLElement).textContent = u.kicker;
    if (u.icon !== undefined) (wrap.querySelector(".ksh-ic") as HTMLElement).innerHTML = u.icon;
    if (u.html !== undefined) body.innerHTML = u.html;
    if (u.foot !== undefined) {
      foot.innerHTML = u.foot;
      foot.hidden = !u.foot;
    }
  };
  fill({ title: o.title, kicker: o.kicker ?? "", icon: o.icon ?? "", html: o.html, foot: o.foot ?? "" });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    openCount = Math.max(0, openCount - 1);
    host.nav.remove(layer);
    wrap.classList.add("out");
    wrap.style.pointerEvents = "none";
    setTimeout(() => wrap.remove(), reducedMotion() ? 0 : 240);
    host.sfx("uiBack");
    host.overlayClosed();
    o.onClose?.();
  };
  const layer: NavLayer = { root: wrap, onBack: close, focus: null };
  onTap(wrap.querySelector('[data-act="x"]'), close);
  wrap.querySelector(".kscrim")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  dragToDismiss(sheet, [wrap.querySelector(".ksh-grab") as HTMLElement, wrap.querySelector(".ksh-head") as HTMLElement], close);
  openCount++;
  markBorn();
  host.nav.push(layer);
  host.overlayOpened();
  return {
    el: wrap,
    body,
    foot,
    layer,
    get closed() {
      return closed;
    },
    update(u) {
      const focused = layer.focus;
      const key = focused?.dataset.act ?? focused?.dataset.id;
      fill(u);
      if (key) {
        const again = wrap.querySelector<HTMLElement>(`[data-act="${CSS.escape(key)}"], [data-id="${CSS.escape(key)}"]`);
        host.nav.refocus(layer, again);
      } else host.nav.refocus(layer);
    },
    close,
  };
}

/** Portrait bottom sheets: drag the grab handle / header down to dismiss. */
function dragToDismiss(sheet: HTMLElement, handles: readonly HTMLElement[], done: () => void): void {
  let id = -1;
  let y0 = 0;
  let dy = 0;
  let t0 = 0;
  const portrait = () => matchMedia("(orientation: portrait)").matches;
  for (const el of handles) {
    el.addEventListener("pointerdown", (e) => {
      if (!portrait() || (e.target as HTMLElement).closest("button")) return;
      id = e.pointerId;
      y0 = e.clientY;
      dy = 0;
      t0 = performance.now();
      try {
        el.setPointerCapture(id);
      } catch {
        /* ignore */
      }
      sheet.style.transition = "none";
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerId !== id) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      sheet.style.transition = "";
      const fast = dy / Math.max(1, performance.now() - t0) > 0.6;
      if (dy > 90 || (fast && dy > 24)) {
        sheet.style.transform = `translateY(${Math.max(dy, sheet.offsetHeight)}px)`;
        done();
      } else sheet.style.transform = "";
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
}

// ------------------------------------------------------------------ confirm dialog

export interface ConfirmOpts {
  title: string;
  /** Body markup. */
  body: string;
  ok?: string;
  cancel?: string;
  /** Destructive action: red OK button. */
  danger?: boolean;
  /** OK button style ("gold" ...). */
  okCls?: string;
  icon?: string;
}

/** Modal confirm. Resolves true on OK, false on cancel / Back / scrim. The default focus is Cancel (safe). */
export function confirmDialog(host: KitHost, o: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = h("div", "kover kdialog-wrap");
    wrap.innerHTML = `
      <div class="kscrim"></div>
      <section class="kdialog panel" role="alertdialog" aria-modal="true" aria-label="${esc(o.title)}">
        ${o.icon ? `<div class="kd-ic">${o.icon}</div>` : ""}
        <h2 class="kd-t">${esc(o.title)}</h2>
        <div class="kd-b">${o.body}</div>
        <div class="kd-btns">
          <button class="btn ghost small" data-nav data-nav-default data-act="no">${esc(o.cancel ?? "Cancel")}</button>
          <button class="btn small ${o.danger ? "red" : (o.okCls ?? "")}" data-nav data-act="yes">${esc(o.ok ?? "OK")}</button>
        </div>
      </section>`;
    host.ui.appendChild(wrap);
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      openCount = Math.max(0, openCount - 1);
      host.nav.remove(layer);
      wrap.classList.add("out");
      wrap.style.pointerEvents = "none";
      setTimeout(() => wrap.remove(), reducedMotion() ? 0 : 220);
      host.sfx(v ? "uiConfirm" : "uiBack");
      host.overlayClosed();
      resolve(v);
    };
    const layer: NavLayer = { root: wrap, onBack: () => finish(false), focus: null };
    onTap(wrap.querySelector('[data-act="no"]'), () => finish(false));
    onTap(wrap.querySelector('[data-act="yes"]'), () => finish(true));
    wrap.querySelector(".kscrim")?.addEventListener("click", (e) => {
      e.stopPropagation();
      finish(false);
    });
    openCount++;
    markBorn();
    host.nav.push(layer);
    host.overlayOpened();
    host.sfx("uiMove");
  });
}

// ------------------------------------------------------------------ toasts

export interface ToastOpts {
  /** "info" (default), "good" (gains), "bad" (denied), "ach" (Plot Point card), "gacha". */
  kind?: "info" | "good" | "bad" | "ach" | "gacha";
  icon?: string;
  /** Kicker line ("PLOT POINT UNLOCKED!"). */
  kicker?: string;
  /** Second line. */
  sub?: string;
  /** Reward chips markup. */
  reward?: string;
  /** Visible time (ms). */
  ms?: number;
  /** In-run placement: bottom centre, compact, never over the hero. */
  inRun?: boolean;
}

interface QueuedToast {
  msg: string;
  o: ToastOpts;
}

const MAX_VISIBLE = 2;
/** In-run toasts: one at a time (the playfield stays readable), the rest wait their turn. */
const MAX_VISIBLE_RUN = 1;
let box: HTMLElement | null = null;
let boxRun: HTMLElement | null = null;
const queue: QueuedToast[] = [];
let visible = 0;
let visibleRun = 0;
let lastMsg = "";
let lastAt = 0;

function container(host: KitHost, inRun: boolean): HTMLElement {
  if (inRun) {
    if (!boxRun || !boxRun.isConnected) {
      boxRun = h("div", "ktoasts inrun");
      boxRun.setAttribute("aria-live", "polite");
      host.ui.appendChild(boxRun);
    }
    return boxRun;
  }
  if (!box || !box.isConnected) {
    box = h("div", "ktoasts");
    box.setAttribute("aria-live", "polite");
    host.ui.appendChild(box);
  }
  return box;
}

/** Show a toast (queued: at most two at once; an identical message within 1.2 s is dropped). */
export function toast(host: KitHost, msg: string, o: ToastOpts = {}): void {
  const now = performance.now();
  if (msg === lastMsg && now - lastAt < 1200) return;
  lastMsg = msg;
  lastAt = now;
  queue.push({ msg, o });
  pump(host);
}

function pump(host: KitHost): void {
  for (let i = 0; i < queue.length && visible < MAX_VISIBLE; ) {
    const t = queue[i];
    if (t.o.inRun && visibleRun >= MAX_VISIBLE_RUN) {
      i++;
      continue;
    }
    queue.splice(i, 1);
    show(host, t);
  }
}

function show(host: KitHost, t: QueuedToast): void {
  const o = t.o;
  const kind = o.kind ?? "info";
  const el = h("div", `ktoast k-${kind}${o.inRun ? " small" : ""}`);
  el.innerHTML = `${o.icon ? `<span class="kt-ic">${o.icon}</span>` : ""}<span class="kt-tx">${o.kicker ? `<small class="kt-k">${esc(o.kicker)}</small>` : ""}<b>${esc(t.msg)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span>${o.reward ? `<span class="kt-rw">${o.reward}</span>` : ""}<i class="kt-shine" aria-hidden="true"></i>`;
  container(host, !!o.inRun).appendChild(el);
  visible++;
  if (o.inRun) visibleRun++;
  const ms = o.ms ?? (kind === "ach" ? 3400 : 2300);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => {
      // (clearRunToasts may have dropped it already)
      if (el.isConnected) {
        el.remove();
        visible = Math.max(0, visible - 1);
        if (o.inRun) visibleRun = Math.max(0, visibleRun - 1);
      }
      pump(host);
    }, 260);
  }, ms);
}

/** Drop queued in-run toasts and clear the in-run strip (run ended). */
export function clearRunToasts(): void {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].o.inRun) queue.splice(i, 1);
  if (boxRun) {
    visible = Math.max(0, visible - boxRun.childElementCount);
    visibleRun = 0;
    boxRun.replaceChildren();
  }
}
