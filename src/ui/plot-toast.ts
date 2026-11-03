/**
 * In-run Plot Point toasts (docs/content/achievements.md header: "rate-limited
 * to one per 4 s, queued, top-centre under the timer, never over the hero.
 * Text: PLOT POINT! <name> + the reward chip").
 *
 * One reusable element: it drops in from under the HUD timer (below the boss
 * bar while one is up), shows the trophy, PLOT POINT!, the name and the reward
 * chips, a shine sweeps it, and it slides back up. Queued Plot Points wait
 * their 4 s turn; nothing shows while a modal, the cut-in or the run-start
 * card is up (they wait); the queue is capped (a burst becomes "+N more").
 * Transform / opacity only.
 */
import type { AchievementDef } from "../meta/achievements/types";
import { esc, fmtInt, h } from "./dom";
import { money, tag, trophyIcon } from "./kit";

/** Visible time (s) and the minimum spacing between two toasts (s). */
const SHOW = 2.8;
const SPACING = 4;
const MAX_QUEUE = 4;

export interface PlotToastHost {
  readonly ui: HTMLElement;
  sfx(id: "achievement", vol?: number, pitch?: number): void;
}

export class PlotToasts {
  private readonly el: HTMLElement;
  private readonly queue: AchievementDef[] = [];
  private overflow = 0;
  private showing = 0;
  private wait = 0;
  private disposed = false;

  constructor(private readonly host: PlotToastHost) {
    this.el = h("div", "ptoast");
    this.el.setAttribute("role", "status");
    this.el.setAttribute("aria-live", "polite");
    host.ui.appendChild(this.el);
  }

  push(def: AchievementDef): void {
    if (this.disposed) return;
    if (this.queue.length >= MAX_QUEUE) {
      this.overflow++;
      return;
    }
    this.queue.push(def);
  }

  /** Per frame (real dt). `blocked` = a modal / the cut-in / the run-start card is up. */
  frame(dt: number, blocked: boolean): void {
    if (this.disposed) return;
    if (this.wait > 0) this.wait -= dt;
    if (this.showing > 0) {
      this.showing -= dt;
      // a modal opening mid-toast: tuck it away now (it was shown; it is not re-queued)
      if (this.showing <= 0 || blocked) {
        this.showing = 0;
        this.el.classList.remove("on");
      }
      return;
    }
    if (blocked || this.wait > 0 || !this.queue.length) return;
    const def = this.queue.shift() as AchievementDef;
    const more = !this.queue.length && this.overflow > 0 ? this.overflow : 0;
    if (more) this.overflow = 0;
    const r = def.reward;
    const chips = [r.gems ? money("gems", `+${fmtInt(r.gems)}`) : "", r.coins ? money("coins", `+${fmtInt(r.coins)}`) : "", r.unlock ? tag("UNLOCK!", "cyan") : "", more ? tag(`+${more} MORE`, "pink") : ""].join("");
    this.el.innerHTML = `<span class="pt-ic">${trophyIcon("pt-img")}</span><span class="pt-tx"><small class="pt-k">PLOT POINT!</small><b>${esc(def.name)}</b></span>${chips ? `<span class="pt-rw">${chips}</span>` : ""}<i class="pt-shine" aria-hidden="true"></i>`;
    // below the boss bar while one is up (read once per toast, not per frame)
    this.el.classList.toggle("low", !!this.host.ui.querySelector(".bossbar.on"));
    this.el.classList.remove("on");
    requestAnimationFrame(() => {
      if (!this.disposed) this.el.classList.add("on");
    });
    this.showing = SHOW;
    this.wait = SPACING;
    this.host.sfx("achievement", 0.7);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.queue.length = 0;
    this.el.remove();
  }
}
