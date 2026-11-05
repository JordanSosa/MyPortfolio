/**
 * Training Arc minimap: the five ring orbits (gold when complete, lavender
 * when open, dashed with a padlock when gated), one dot per node in its state
 * colour, and the camera's view rectangle. Tap / click it to fly there.
 * Repainted only when the board changes; the view box follows the camera
 * through `follow` (a couple of style writes, only when the view moved).
 */
import { BOARD } from "../../../meta/board/graph";
import { h } from "../../dom";
import type { PanZoom } from "../../kit/viewport";
import { BOUNDS, px, R_MAX, RING_PX } from "./layout";

export type DotState = "own" | "afford" | "near" | "far" | "lock" | "key";

export class Minimap {
  readonly el: HTMLElement;
  private readonly dots = new Map<string, SVGCircleElement>();
  private readonly rings: SVGCircleElement[] = [];
  private readonly view: HTMLElement;
  private seen = -1;

  constructor(onJump: (x: number, y: number) => void) {
    this.el = h("button", "bd-mini");
    this.el.dataset.nav = "";
    this.el.setAttribute("aria-label", "Minimap: tap to fly there");
    const W = R_MAX * 2;
    const rings = [1, 2, 3, 4, 5].map((r) => `<circle class="mr" data-ring="${r}" cx="0" cy="0" r="${RING_PX[r].toFixed(0)}"/>`).join("");
    const dots = BOARD.nodes.map((n) => {
      const [x, y] = px(n);
      const r = n.kind === "center" ? 70 : n.kind === "keystone" ? 46 : 30;
      return `<circle class="md" data-id="${n.id}" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}"/>`;
    });
    this.el.innerHTML = `<svg viewBox="${BOUNDS.x0} ${BOUNDS.y0} ${W} ${W}" aria-hidden="true"><circle class="mbg" cx="0" cy="0" r="${R_MAX - 10}"/>${rings}${dots.join("")}</svg><i class="mm-view" aria-hidden="true"></i>`;
    for (const c of this.el.querySelectorAll<SVGCircleElement>(".md")) this.dots.set(c.dataset.id as string, c);
    for (const c of this.el.querySelectorAll<SVGCircleElement>(".mr")) this.rings.push(c);
    this.view = this.el.querySelector(".mm-view") as HTMLElement;
    this.el.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = this.el.getBoundingClientRect();
      // keyboard / gamepad "click" has no position: fly home
      if (!e.clientX && !e.clientY) return onJump(0, 0);
      const fx = (e.clientX - r.left) / Math.max(1, r.width);
      const fy = (e.clientY - r.top) / Math.max(1, r.height);
      onJump(BOUNDS.x0 + fx * W, BOUNDS.y0 + fy * W);
    });
  }

  /** Node dot states + ring states (1 = open, 2 = complete, 0 = gated). */
  paint(state: ReadonlyMap<string, DotState>, rings: readonly number[]): void {
    for (const [id, c] of this.dots) {
      const s = state.get(id) ?? "far";
      const cls = `md ${s}`;
      if (c.getAttribute("class") !== cls) c.setAttribute("class", cls);
    }
    this.rings.forEach((c, i) => {
      const s = rings[i + 1] ?? 0;
      const cls = `mr ${s === 2 ? "done" : s === 1 ? "open" : "gated"}`;
      if (c.getAttribute("class") !== cls) c.setAttribute("class", cls);
    });
  }

  /** Move the view box to the camera (call per frame; writes only when the camera moved). */
  follow(vp: PanZoom): void {
    if (vp.version === this.seen) return;
    this.seen = vp.version;
    const v = vp.visible();
    const W = R_MAX * 2;
    const k = 100 / W;
    const x0 = Math.max(0, (v.x0 - BOUNDS.x0) * k);
    const y0 = Math.max(0, (v.y0 - BOUNDS.y0) * k);
    const x1 = Math.min(100, (v.x1 - BOUNDS.x0) * k);
    const y1 = Math.min(100, (v.y1 - BOUNDS.y0) * k);
    const s = this.view.style;
    s.left = `${x0.toFixed(2)}%`;
    s.top = `${y0.toFixed(2)}%`;
    s.width = `${Math.max(2, x1 - x0).toFixed(2)}%`;
    s.height = `${Math.max(2, y1 - y0).toFixed(2)}%`;
  }
}
