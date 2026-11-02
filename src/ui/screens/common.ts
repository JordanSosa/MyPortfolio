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
