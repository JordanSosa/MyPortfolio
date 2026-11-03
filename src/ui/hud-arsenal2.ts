/**
 * HUD details for the Season 2 general weapons (docs/content/weapons.md §2.11, §3), driven by
 * hud.ts after its weapon slots are synced:
 *   - Idol Lightstick Wave / Sold-Out Dome Tour: the weapon icon pulses on every beat of the stage
 *     tempo (the sim's beat clock: WeaponInstance.data.beatAt)
 *   - Thousand Crane Wish: the crane-kill count toward the next Wish on the icon + a progress bar, "742/1000" in the
 *     tooltip (data.wish / data.wishGoal; a full "742/1000" label is wider than a slot on phones)
 * DOM rules (ARCHITECTURE §2.1): one WAAPI Bump per slot element (created once, rewound), the
 * counter node is created once per slot and its text written only when it changes, at most 4x/s.
 */
import type { World } from "../game/world";
import { Bump } from "./dom";

/** The bits of a HUD weapon slot this module touches. */
export interface HudWeaponSlot {
  el: HTMLElement;
  img: HTMLImageElement;
  id: string;
}

const K_BEAT: Keyframe[] = [{ transform: "scale(1)" }, { transform: "scale(1.28)", offset: 0.3 }, { transform: "scale(1)" }];
const O_BEAT: KeyframeAnimationOptions = { duration: 180, easing: "ease-out" };
const STICKS = new Set(["idol_lightstick_wave", "sold_out_dome_tour"]);
const WISH = "thousand_crane_wish";
const COUNTER_DT = 0.25;

export class HudArsenal2 {
  private readonly bumps = new WeakMap<HTMLImageElement, Bump>();
  private readonly counters = new WeakMap<HTMLElement, HTMLElement>();
  private readonly beatSeen = new WeakMap<HTMLElement, number>();
  private t = 0;

  update(w: World, slots: readonly HudWeaponSlot[], realDt: number): void {
    this.t += realDt;
    const tick = this.t >= COUNTER_DT;
    if (tick) this.t = 0;
    const n = Math.min(slots.length, w.weapons.length);
    for (let i = 0; i < n; i++) {
      const s = slots[i];
      const inst = w.weapons[i];
      if (inst.def.id !== s.id) continue;
      if (STICKS.has(s.id)) {
        const at = inst.data.beatAt ?? -1;
        if (at >= 0 && this.beatSeen.get(s.el) !== at) {
          this.beatSeen.set(s.el, at);
          let b = this.bumps.get(s.img);
          if (!b) {
            b = new Bump(s.img, K_BEAT, O_BEAT, 90);
            this.bumps.set(s.img, b);
          }
          b.play(true);
        }
      }
      let c = this.counters.get(s.el);
      if (s.id === WISH) {
        if (!c) c = this.makeCounter(s.el);
        if (tick || !c.firstChild?.textContent) {
          const kills = Math.floor(inst.data.wish ?? 0);
          const goal = Math.max(1, Math.floor(inst.data.wishGoal ?? 1000));
          const text = String(kills);
          const num = c.firstChild as HTMLElement;
          if (num.textContent !== text) {
            num.textContent = text;
            c.title = `${kills}/${goal} crane kills to the next Wish`;
            (c.lastChild as HTMLElement).style.transform = `scaleX(${Math.min(1, kills / goal).toFixed(3)})`;
          }
        }
        if (c.style.display === "none") c.style.display = "";
      } else if (c && c.style.display !== "none") c.style.display = "none";
    }
  }

  /** The Wish badge: the kill count in the icon's top-left corner + a thin gold progress bar along its bottom. */
  private makeCounter(el: HTMLElement): HTMLElement {
    const c = document.createElement("span");
    c.className = "a2-wish";
    // (inline styles: a self-contained badge inside the slot, no stylesheet edits)
    c.style.cssText = "position:absolute;inset:0;pointer-events:none";
    const num = document.createElement("span");
    num.style.cssText =
      "position:absolute;left:2px;top:2px;z-index:2;font:700 7px/1 var(--font-ui,sans-serif);color:#ffd34d;" +
      "text-shadow:0 1px 0 #3a2266,1px 0 0 #3a2266,-1px 0 0 #3a2266,0 -1px 0 #3a2266;white-space:nowrap;font-variant-numeric:tabular-nums";
    const bar = document.createElement("span");
    bar.style.cssText =
      "position:absolute;left:12%;right:12%;bottom:2px;height:2px;border-radius:1px;background:#ffd34d;box-shadow:0 0 2px #ffd34d;" +
      "transform-origin:0 50%;transform:scaleX(0)";
    c.append(num, bar);
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(c);
    this.counters.set(el, c);
    return c;
  }
}
