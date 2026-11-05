/** Shared bits for screens. */
import { HEROES } from "../../game/heroes";
import { img } from "../dom";
import type { NavLayer } from "../nav";

/**
 * The three heroes' portraits (frame 0) for the splash / title key art: a
 * staggered idle bob and a one-shot shine sweep (transform-only animations).
 * Layout (row under the logo / flanking it) is up to the screen's CSS.
 */
export function heroLineup(color: (id: string) => string): string {
  return `<div class="lineup">${HEROES.map(
    (hd, i) => `<div class="lp lp${i}" style="--i:${i};--hc:${color(hd.id)}"><div class="lpi">${img(hd.portrait, "px", 0, 3)}</div></div>`,
  ).join("")}</div>`;
}

/** Twinkling star field markup. */
export function sparkles(n: number): string {
  let s = '<div class="stars">';
  for (let i = 0; i < n; i++) {
    const x = (Math.random() * 100).toFixed(1);
    const y = (Math.random() * 100).toFixed(1);
    const d = (Math.random() * 2.4).toFixed(2);
    const sc = (0.6 + Math.random() * 1.4).toFixed(2);
    s += `<i style="left:${x}%;top:${y}%;animation-delay:${d}s;width:${(6 * Number(sc)).toFixed(1)}px;height:${(6 * Number(sc)).toFixed(1)}px"></i>`;
  }
  return s + "</div>";
}

export function layer(root: HTMLElement, onBack?: () => void): NavLayer {
  return { root, onBack, focus: null };
}

/** Fade out + remove. */
export function closeEl(el: HTMLElement, ms = 220): void {
  el.classList.add("out");
  el.style.pointerEvents = "none";
  setTimeout(() => el.remove(), ms);
}

let born = 0;
/** Call when a screen / modal appears: taps in the next ~300 ms are ignored (ghost clicks from the previous screen). */
export function markBorn(): void {
  born = performance.now();
}
export function tooSoon(): boolean {
  return performance.now() - born < 300;
}

/** Bind a click handler (ghost-click protected). */
export function onTap(el: Element | null, fn: (e: Event) => void): void {
  el?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (tooSoon()) return;
    fn(e);
  });
}

// ------------------------------------------------------------------ second-thumb taps
/** What secondThumbTaps reads from the Input (src/core/input.ts). */
export interface TapInput {
  /** The finger went down after the last markTouchesStale(): a finger held from before the modal never is. */
  isFresh(id: number): boolean;
  /** The joystick finger or a DASH / OVERDRIVE finger. */
  ownsPointer(id: number): boolean;
  /** Pointers down now (a lifting finger is already gone when its pointerup reaches the layer). */
  readonly pointersDown: number;
}

/** A press that travelled further than this (CSS px) is a drag or a scroll, never a tap. */
const TAP_SLOP = 12;
/** The browser's own click for a tap handled here would arrive within this (ms): it is swallowed. */
const SWALLOW_MS = 800;
/** What a tap presses: the control it went down on, else the layer itself (the chest's tap-anywhere). */
const TAP_CONTROL = "button, a, [data-nav], [data-tap]";
/** Fields the browser runs itself (focus, caret, keyboard): never pressed from here. */
const TAP_NATIVE = "input, textarea, select, label";

interface Press {
  root: HTMLElement;
  target: Element;
  x: number;
  y: number;
  /** another finger was down at some moment of this press (Chromium sends such a tap no click) */
  multi: boolean;
}
const presses = new Map<number, Press>();
/** pointerId -> until (performance.now() ms): handled here; the browser's click for it must not act again. */
const handled = new Map<number, number>();
/** Until when a click without a pointerId (an older WebKit MouseEvent) is taken for a tap handled here. */
let handledAny = 0;
let dispatching = false;
let wired = false;

function controlOf(root: HTMLElement, n: Element): Element | null {
  if (!root.contains(n)) return null;
  const c = n.closest(TAP_CONTROL);
  return c && root.contains(c) ? c : root;
}

function wireTaps(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  // a finger going down makes every press already in flight a multi-touch one
  window.addEventListener(
    "pointerdown",
    (e) => {
      for (const [id, p] of presses) {
        if (!p.root.isConnected) presses.delete(id);
        else if (id !== e.pointerId) p.multi = true;
      }
    },
    { capture: true },
  );
  // the click the browser may still send after a tap handled here: swallowed before any handler sees it
  window.addEventListener(
    "click",
    (e) => {
      if (dispatching || !e.isTrusted || e.detail === 0) return;
      const now = performance.now();
      const id = (e as PointerEvent).pointerId;
      let hit = false;
      if (typeof id === "number" && id >= 0) {
        hit = (handled.get(id) ?? 0) > now;
        handled.delete(id);
      } else {
        hit = handledAny > now;
        handledAny = 0;
      }
      if (!hit) return;
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    { capture: true },
  );
}

/**
 * SECOND-THUMB TAPS for a layer shown during a run (the level-up, chest, pause, game-over modals, the settings panel,
 * the HUD pause button). Chromium sends no click for a finger that taps while another finger is down (or was down
 * at any moment of the tap): a player holding the stick could not pick a card, open the chest or press RESUME with
 * the other thumb. Here such a tap presses the control itself: on the pointerup of a FRESH finger (not the stick,
 * not DASH / OVERDRIVE) that went down on the same control and barely moved, a click (detail 1, the finger's
 * pointerId) is dispatched where it went down, so every handler's own guards still run (isFresh, markBorn /
 * tooSoon, the level-up's open GUARD, busy); a click the browser sends after all is swallowed (one press per tap).
 * A lone finger keeps the browser's own click (its touch-target adjustment); mouse clicks and keyboard / gamepad
 * clicks (detail 0) are untouched; a drag or a scroll (pointercancel) presses nothing. Owner bug, Season 3: e2e
 * "joystick (j)-(m)", tests/ui-taps.test.ts.
 */
export function secondThumbTaps(root: HTMLElement, input: TapInput): void {
  wireTaps();
  root.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target as Element | null;
      if (e.pointerType === "mouse" || typeof t?.closest !== "function") return;
      presses.set(e.pointerId, { root, target: t, x: e.clientX, y: e.clientY, multi: input.pointersDown > 1 });
    },
    { capture: true },
  );
  root.addEventListener(
    "pointermove",
    (e) => {
      const p = presses.get(e.pointerId);
      if (p?.root === root && Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_SLOP) presses.delete(e.pointerId);
    },
    { capture: true, passive: true },
  );
  root.addEventListener(
    "pointercancel",
    (e) => {
      if (presses.get(e.pointerId)?.root === root) presses.delete(e.pointerId);
    },
    { capture: true },
  );
  root.addEventListener(
    "pointerup",
    (e) => {
      const id = e.pointerId;
      const p = presses.get(id);
      if (p?.root !== root) return;
      presses.delete(id);
      // (a lone finger: the browser clicks)
      if (!p.multi && input.pointersDown === 0) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_SLOP) return;
      if (!root.isConnected || root.classList.contains("out") || !p.target.isConnected) return;
      if (!input.isFresh(id) || input.ownsPointer(id) || p.target.closest(TAP_NATIVE)) return;
      const ctl = controlOf(root, p.target);
      const under = typeof document.elementFromPoint === "function" ? document.elementFromPoint(e.clientX, e.clientY) : p.target;
      if (!ctl || !under || controlOf(root, under) !== ctl || (ctl as HTMLButtonElement).disabled === true) return;
      const now = performance.now();
      for (const [k, until] of handled) if (until <= now) handled.delete(k);
      handled.set(id, now + SWALLOW_MS);
      handledAny = now + SWALLOW_MS;
      const init: PointerEventInit = { bubbles: true, cancelable: true, composed: true, detail: 1, button: 0, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, pointerId: id, pointerType: e.pointerType, isPrimary: e.isPrimary };
      dispatching = true;
      try {
        p.target.dispatchEvent(typeof PointerEvent === "function" ? new PointerEvent("click", init) : new MouseEvent("click", init));
      } finally {
        dispatching = false;
      }
    },
    { capture: true },
  );
}
