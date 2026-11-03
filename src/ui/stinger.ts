/**
 * Run-start episode title card (docs/content/satire.md §2.1): a diagonal anime
 * title band "EPISODE 12" whose letters drop in one by one, the episode's
 * title stamped under it, a speed-line sweep and a flash, over the frozen
 * first frame; a satirical loading tip (satire.md §7) rides along the bottom.
 * It holds, then wipes out to the left as READY? appears (App's run-start
 * stinger drives the timing). CSS animations only (transform / opacity); the
 * element removes itself.
 */
import { esc, h } from "./dom";
import { wordLetters } from "./hub/celebrate";
import { tip } from "./hub/copy";
import "./stinger.css";

export interface EpisodeCard {
  /** Wipe out (READY? is up). */
  leave(): void;
  /** Remove now (run ended / skipped). */
  remove(): void;
}

export function showEpisodeCard(parent: HTMLElement, n: number, title: string, stage: string): EpisodeCard {
  const el = h("div", "ep-title");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `
    <i class="ept-flash" aria-hidden="true"></i>
    <div class="ept-band">
      <i class="ept-lines" aria-hidden="true"></i>
      <i class="ept-sweep" aria-hidden="true"></i>
      <div class="ept-no"><small>${esc(stage.toUpperCase())} · TONIGHT'S EPISODE</small><b>${wordLetters(`EPISODE ${n}`, "eltr", 0.045, 0.12)}</b></div>
      <div class="ept-t">“${esc(title)}”</div>
    </div>
    <div class="ept-tip"><b>TIP</b><span>${esc(tip())}</span></div>`;
  parent.appendChild(el);
  let gone = false;
  return {
    leave() {
      if (gone) return;
      el.classList.add("out");
      setTimeout(() => this.remove(), 420);
    },
    remove() {
      if (gone) return;
      gone = true;
      el.remove();
    },
  };
}

/** Shown when a run ends in a quit / at the results: the "TO BE CONTINUED ->" arrow banner. */
export function tbcBanner(text = "TO BE CONTINUED"): string {
  return `<div class="tbc" role="img" aria-label="${esc(text)}"><span class="tbc-t">${esc(text)}</span><span class="tbc-arrow" aria-hidden="true"></span></div>`;
}
