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
 * Encode the UI sprites ahead of time in small idle chunks, so opening a
 * modal never stalls on PNG encoding mid-game.
 */
export function prewarmSprites(ids: [string, number][]): void {
  let i = 0;
  const idle = (cb: () => void) => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(cb, { timeout: 300 });
    else setTimeout(cb, 16);
  };
  const step = () => {
    const t0 = performance.now();
    while (i < ids.length && performance.now() - t0 < 6) {
      const [id, f] = ids[i++];
      sprite(id, f);
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

export function fmtNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`;
  return String(Math.floor(n));
}

/** Split text into per-letter spans for bouncy title animations. */
export function letters(text: string, cls = "ltr", step = 0.06): string {
  let i = 0;
  return [...text]
    .map((ch) => (ch === " " ? `<span class="${cls} sp">&nbsp;</span>` : `<span class="${cls}" style="--i:${i++};--d:${(i * step).toFixed(2)}s">${esc(ch)}</span>`))
    .join("");
}

/** Restart a CSS animation class on an element. */
export function replay(el: Element, cls: string): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}
