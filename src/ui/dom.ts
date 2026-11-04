/**
 * Tiny DOM helpers for the UI layer (no framework).
 */
import type { Atlas } from "../render/atlas";

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html) el.innerHTML = html;
  return el;
}

/** Element from an HTML string (first element child). */
export function frag(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

let atlasRef: Atlas | null = null;
export function setAtlas(a: Atlas): void {
  atlasRef = a;
}

/**
 * PNG data URL of an atlas sprite frame. Always encoded at 1x (one cache entry
 * per frame); the DOM upscales it with `image-rendering: pixelated`, which is
 * pixel-identical. `_scale` is accepted for call-site readability only.
 */
export function sprite(id: string, frame = 0, _scale = 1): string {
  if (!atlasRef || !id) return "";
  try {
    return atlasRef.dataURL(id, frame, 1);
  } catch {
    return "";
  }
}

/**
 * True when the atlas holds real art for `id` (not the generated placeholder):
 * the hub kit draws a CSS stand-in for Season 2 art that has not landed yet.
 */
export function hasArt(id: string): boolean {
  return !!atlasRef && !!id && atlasRef.has(id);
}

/** Decoded <img> per warmed sprite URL: keeps the decoded bitmaps in the browser's image cache. */
const decoded: HTMLImageElement[] = [];

/**
 * Encode the UI sprites ahead of time in small idle chunks, and decode them
 * (img.decode()), so opening a modal never stalls on PNG encoding or on
 * decoding a dozen icons inside its first paint mid-game. Real idle time only
 * (requestIdleCallback without a timeout, a slice never longer than 8 ms; a
 * 50 ms timer where it is missing), and nothing at all while `canRun()` says
 * no (a run, a modal, an overlay, a screen change): the queue waits on a
 * coarse timer instead of polling every frame. List the most-needed sprites
 * first.
 */
/** Sprite prewarm progress (debug / perf scripts: `__kk.prewarm()`). */
export const prewarmState = { done: 0, total: 0 };

export function prewarmSprites(ids: [string, number][], canRun: () => boolean = () => true): void {
  let i = 0;
  prewarmState.total += ids.length;
  const decode = (url: string) => {
    if (!url || typeof Image === "undefined") return;
    const im = new Image();
    im.src = url;
    decoded.push(im);
    im.decode?.().catch(() => {});
  };
  type Deadline = { timeRemaining(): number };
  const ric = (window as Window & { requestIdleCallback?: (cb: (d: Deadline) => void) => number }).requestIdleCallback;
  const idle = (cb: (d?: Deadline) => void) => {
    if (ric) ric(cb);
    else setTimeout(cb, 50);
  };
  const step = (d?: Deadline) => {
    if (!canRun()) {
      // blocked (gameplay, a modal...): look again in a while, never every frame
      setTimeout(() => idle(step), 500);
      return;
    }
    const t0 = performance.now();
    const budget = d ? Math.min(8, d.timeRemaining()) : 6;
    while (i < ids.length && performance.now() - t0 < budget) {
      const [id, f] = ids[i++];
      decode(sprite(id, f));
      prewarmState.done++;
    }
    if (i < ids.length) idle(step);
  };
  idle(step);
}

/** <img> markup for an atlas sprite. */
export function img(id: string, cls = "px", frame = 0, scale = 1): string {
  const src = sprite(id, frame, scale);
  return src ? `<img class="${cls}" src="${src}" alt="" draggable="false">` : `<span class="${cls} px-missing"></span>`;
}

export function fmtTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** [divisor, suffix, values below this (in units) keep one decimal]. */
const NUM_UNITS: readonly [number, string, number][] = [
  [1e3, "K", 100],
  [1e6, "M", 10],
];

/**
 * Compact counter text: 9999, 12.3K, 150K, 1.0M, 25M. Rounds to the shown
 * precision first and then picks the unit, so 99,950 reads "100K" (not
 * "100.0K") and 999,500 reads "1.0M" (not "1000K").
 */
export function fmtNum(n: number): string {
  if (!(n >= 1e4)) return String(Math.floor(n));
  for (let u = 0; u < NUM_UNITS.length; u++) {
    const [div, suf, decBelow] = NUM_UNITS[u];
    const x = n / div;
    let d = x < decBelow ? 1 : 0;
    let r = Number(x.toFixed(d));
    if (d === 1 && r >= decBelow) {
      d = 0;
      r = Number(x.toFixed(0));
    }
    if (r >= 1000 && u < NUM_UNITS.length - 1) continue;
    return `${r.toFixed(d)}${suf}`;
  }
  return String(Math.floor(n));
}

/** Whole number with thousands separators: 1234567 -> "1,234,567" (currency bars, prices). */
export function fmtInt(n: number): string {
  const v = Math.floor(Math.abs(n));
  const s = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? `-${s}` : s;
}

/** Split text into per-letter spans for bouncy title animations. */
export function letters(text: string, cls = "ltr", step = 0.06): string {
  let i = 0;
  return [...text]
    .map((ch) => (ch === " " ? `<span class="${cls} sp">&nbsp;</span>` : `<span class="${cls}" style="--i:${i++};--d:${(i * step).toFixed(2)}s">${esc(ch)}</span>`))
    .join("");
}

/**
 * Restart a CSS animation class on an element. Forces a synchronous reflow:
 * only for one-off, non-HUD screens. Per-frame HUD juice uses `Bump`.
 */
export function replay(el: Element, cls: string): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

/**
 * A reusable one-shot WAAPI animation on one element ("bump", "pop", "stamp"):
 * no class toggling, no forced reflow, no allocation per play (the Animation
 * object is created once and rewound). `play()` is rate-limited: it does nothing
 * while the previous play is still running (so a bump always plays out instead
 * of restarting every frame) or within `gapMs` of the last start; `force`
 * restarts regardless (rank stamps).
 */
export class Bump {
  private anim: Animation | null = null;
  private last = -1e9;

  constructor(
    readonly el: Element,
    private readonly frames: Keyframe[],
    private readonly opts: KeyframeAnimationOptions,
    private readonly gapMs = 120,
  ) {}

  play(force = false, now = performance.now()): boolean {
    let a = this.anim;
    if (!force && (now - this.last < this.gapMs || a?.playState === "running")) return false;
    this.last = now;
    if (!a) {
      if (typeof this.el.animate !== "function") return false;
      a = this.anim = this.el.animate(this.frames, this.opts);
      return true;
    }
    a.currentTime = 0;
    a.play();
    return true;
  }

  /** Stop and drop the effect (e.g. when another animation takes over the element). */
  cancel(): void {
    this.anim?.cancel();
  }
}
