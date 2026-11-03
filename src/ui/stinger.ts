/**
 * Run-start episode title card (docs/content/satire.md §2.1): a diagonal anime
 * title band "EPISODE 12" + the episode's title stamps in over the frozen
 * first frame, holds, and wipes out to the left as READY? appears (App's
 * run-start stinger drives the timing). CSS animations only (transform /
 * opacity); the element removes itself.
 */
import { esc, h, letters } from "./dom";

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
    <div class="ept-band">
      <i class="ept-lines" aria-hidden="true"></i>
      <div class="ept-no"><small>${esc(stage.toUpperCase())}</small><b>${letters(`EPISODE ${n}`, "ltr", 0.04)}</b></div>
      <div class="ept-t">${esc(title)}</div>
    </div>`;
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
