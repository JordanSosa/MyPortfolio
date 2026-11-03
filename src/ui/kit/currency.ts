/**
 * Currency bar: ★ Star Coins, ♦ Dream Gems, Copium. Each pill counts up / down
 * to a new balance (ease-out, ~0.5-1.1 s depending on the jump), bumps, and
 * floats a "+120" gain pop. Text is written only when the shown integer
 * changes; the bump / pop are one-shot WAAPI animations (no class replays, no
 * forced reflow). `sync()` after any purchase / payout; `set()` jumps.
 */
import type { Currencies } from "../../meta/profile";
import { Bump, fmtInt, h } from "../dom";
import { currencyIcon, type CurrencyId } from "./art";
import { animate, easeOut, reducedMotion, stopAnimating, type Tickable } from "./ticker";

const IDS: readonly CurrencyId[] = ["coins", "gems", "copium"];
const LABEL: Readonly<Record<CurrencyId, string>> = { coins: "Star Coins", gems: "Dream Gems", copium: "Copium" };

const K_BUMP: Keyframe[] = [
  { transform: "none", easing: "cubic-bezier(0.3, 2, 0.5, 1)" },
  { transform: "scale(1.16) rotate(-3deg)", offset: 0.35, easing: "ease-out" },
  { transform: "none" },
];
/** The bar lives at the top edge of the screen: gains drop out BELOW the pill (a pop above would be cut off). */
const K_GAIN: Keyframe[] = [
  { transform: "translate(-50%, -0.6em) scale(0.6)", opacity: 0, easing: "cubic-bezier(0.2, 1.6, 0.4, 1)" },
  { transform: "translate(-50%, 0.2em) scale(1.15)", opacity: 1, offset: 0.25 },
  { transform: "translate(-50%, 0.5em) scale(1)", opacity: 1, offset: 0.7 },
  { transform: "translate(-50%, 1.4em) scale(0.9)", opacity: 0 },
];

class Pill implements Tickable {
  readonly el: HTMLElement;
  private readonly val: HTMLElement;
  private readonly bump: Bump;
  private from = 0;
  private to = 0;
  private shown = -1;
  private t = 0;
  private dur = 0;
  /** Value currently displayed (mid count-up included). */
  cur = 0;

  constructor(readonly id: CurrencyId) {
    this.el = h("div", `cpill c-${id}`);
    this.el.setAttribute("role", "status");
    this.el.title = LABEL[id];
    this.el.innerHTML = `<span class="cicw">${currencyIcon(id, true)}</span><b class="cv">0</b>`;
    this.val = this.el.querySelector(".cv") as HTMLElement;
    this.bump = new Bump(this.el, K_BUMP, { duration: 420 }, 160);
  }

  set(v: number): void {
    stopAnimating(this);
    this.from = this.to = this.cur = v;
    this.write(v);
  }

  sync(v: number, pop: boolean): void {
    if (v === this.to) return;
    const delta = v - this.to;
    this.from = this.cur;
    this.to = v;
    this.t = 0;
    if (reducedMotion()) {
      this.set(v);
    } else {
      const mag = Math.abs(v - this.from);
      this.dur = Math.min(1.1, 0.45 + Math.log10(1 + mag) * 0.14);
      animate(this);
    }
    if (pop && delta !== 0) this.gain(delta);
  }

  private gain(delta: number): void {
    this.bump.play(true);
    const g = h("span", `cgain ${delta > 0 ? "up" : "down"}`, `${delta > 0 ? "+" : "−"}${fmtInt(Math.abs(delta))}`);
    this.el.appendChild(g);
    if (typeof g.animate === "function" && !reducedMotion()) {
      const a = g.animate(K_GAIN, { duration: 1100, fill: "forwards" });
      a.onfinish = () => g.remove();
    } else setTimeout(() => g.remove(), 900);
  }

  tick(dt: number): boolean {
    this.t += dt;
    const k = this.dur > 0 ? this.t / this.dur : 1;
    this.cur = k >= 1 ? this.to : this.from + (this.to - this.from) * easeOut(k);
    this.write(this.cur);
    return k < 1;
  }

  private write(v: number): void {
    const n = Math.round(v);
    if (n === this.shown) return;
    this.shown = n;
    this.val.textContent = fmtInt(n);
  }
}

export class CurrencyBar {
  readonly el: HTMLElement;
  private readonly pills = new Map<CurrencyId, Pill>();

  /** `show`: which pills (default all three). */
  constructor(show: readonly CurrencyId[] = IDS, cls = "") {
    this.el = h("div", `cbar ${cls}`);
    for (const id of show) {
      const p = new Pill(id);
      this.pills.set(id, p);
      this.el.appendChild(p.el);
    }
  }

  /** Jump to balances (no animation). */
  set(c: Readonly<Currencies>): void {
    for (const [id, p] of this.pills) p.set(c[id]);
  }

  /** Count to new balances; `pop` shows "+N" floats and bumps for the pills that changed. */
  sync(c: Readonly<Currencies>, pop = true): void {
    for (const [id, p] of this.pills) p.sync(c[id], pop);
  }

  /** The pill element of a currency (fly-to targets, tutorials). */
  pill(id: CurrencyId): HTMLElement | null {
    return this.pills.get(id)?.el ?? null;
  }

  dispose(): void {
    for (const p of this.pills.values()) stopAnimating(p);
  }
}
