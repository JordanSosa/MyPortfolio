/**
 * Keyboard / gamepad menu navigation. The active layer is the top of a
 * stack (screen < modal < sub-panel). Each layer lists its focusable
 * elements by the `[data-nav]` attribute inside a root element; arrows /
 * d-pad / stick move focus spatially, confirm clicks, back calls onBack.
 * The focus ring is only shown while navigating with keys/gamepad.
 */
import type { Input } from "../core/input";

export interface NavLayer {
  root: HTMLElement;
  onBack?: () => void;
  /** Called on left/right while a slider-like element is focused (returns true if handled). */
  onAdjust?: (el: HTMLElement, dir: number) => boolean;
  focus?: HTMLElement | null;
}

export class Nav {
  private stack: NavLayer[] = [];
  private kb = false;
  /** Sound hooks. */
  onMove: (() => void) | null = null;

  push(layer: NavLayer): NavLayer {
    this.stack.push(layer);
    if (this.kb) this.ensureFocus(layer);
    return layer;
  }

  remove(layer: NavLayer | null): void {
    if (!layer) return;
    const i = this.stack.indexOf(layer);
    if (i >= 0) this.stack.splice(i, 1);
    layer.focus?.classList.remove("nav-focus");
    const top = this.top;
    if (top && this.kb) this.ensureFocus(top);
  }

  clear(): void {
    for (const l of this.stack) l.focus?.classList.remove("nav-focus");
    this.stack.length = 0;
  }

  get top(): NavLayer | undefined {
    return this.stack[this.stack.length - 1];
  }

  private items(l: NavLayer): HTMLElement[] {
    return Array.from(l.root.querySelectorAll<HTMLElement>("[data-nav]")).filter((e) => !e.hasAttribute("disabled") && e.offsetParent !== null);
  }

  /**
   * After a layer re-rendered its items in place (level-up reroll / next queued level):
   * restore the keyboard / gamepad focus, preferring `prefer` (if still focusable),
   * else the layer's `data-nav-default` item. No-op while the pointer is in use.
   */
  refocus(l: NavLayer, prefer: HTMLElement | null = null): void {
    if (!this.kb) return;
    if (prefer && this.items(l).includes(prefer)) this.setFocus(l, prefer);
    else this.ensureFocus(l);
  }

  private ensureFocus(l: NavLayer): void {
    const items = this.items(l);
    if (!items.length) return;
    if (!l.focus || !items.includes(l.focus)) this.setFocus(l, (items.find((e) => e.hasAttribute("data-nav-default")) ?? items[0]) as HTMLElement);
    else l.focus.classList.add("nav-focus");
  }

  setFocus(l: NavLayer, el: HTMLElement): void {
    l.focus?.classList.remove("nav-focus");
    l.focus = el;
    if (this.kb) el.classList.add("nav-focus");
    el.dispatchEvent(new CustomEvent("navfocus", { bubbles: true }));
  }

  /** Mouse/touch use hides the ring. */
  pointerUsed(): void {
    if (!this.kb) return;
    this.kb = false;
    document.body.classList.remove("kb-nav");
    for (const l of this.stack) l.focus?.classList.remove("nav-focus");
  }

  update(input: Input): void {
    const l = this.top;
    if (!l) return;
    const dirs: [string, number, number][] = [
      ["up", 0, -1],
      ["down", 0, 1],
      ["left", -1, 0],
      ["right", 1, 0],
    ];
    for (const [a, dx, dy] of dirs) {
      if (!input.pressed(a as "up")) continue;
      if (!this.kb) {
        this.kb = true;
        document.body.classList.add("kb-nav");
        this.ensureFocus(l);
        if (l.focus) return;
      }
      if (dx !== 0 && l.focus && l.onAdjust?.(l.focus, dx)) return;
      this.move(l, dx, dy);
      return;
    }
    if (input.pressed("confirm")) {
      if (!this.kb) {
        this.kb = true;
        document.body.classList.add("kb-nav");
        this.ensureFocus(l);
        return;
      }
      if (l.focus) {
        input.consume("confirm");
        input.consume("dash");
        input.consume("ult");
        l.focus.click();
      }
      return;
    }
    if (input.pressed("back") && l.onBack) {
      // the same button / key also maps to gameplay actions (gamepad B = back + OVERDRIVE,
      // Esc = back + pause): a back that closes a menu must not also cast / dash / re-pause
      input.consume("back");
      input.consume("pause");
      input.consume("ult");
      input.consume("dash");
      input.consume("confirm");
      l.onBack();
    }
  }

  private move(l: NavLayer, dx: number, dy: number): void {
    const items = this.items(l);
    if (!items.length) return;
    const cur = l.focus && items.includes(l.focus) ? l.focus : null;
    if (!cur) {
      this.setFocus(l, items[0]);
      return;
    }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best: HTMLElement | null = null;
    let bs = Infinity;
    for (const e of items) {
      if (e === cur) continue;
      const b = e.getBoundingClientRect();
      const bx = b.left + b.width / 2;
      const by = b.top + b.height / 2;
      const ox = bx - ax;
      const oy = by - ay;
      const along = ox * dx + oy * dy;
      if (along <= 2) continue;
      const across = Math.abs(ox * dy - oy * dx);
      const s = along + across * 2.2;
      if (s < bs) {
        bs = s;
        best = e;
      }
    }
    if (!best) {
      // wrap around within the same row/column
      let far: HTMLElement | null = null;
      let fs = -Infinity;
      for (const e of items) {
        if (e === cur) continue;
        const b = e.getBoundingClientRect();
        const ox = b.left + b.width / 2 - ax;
        const oy = b.top + b.height / 2 - ay;
        const along = -(ox * dx + oy * dy);
        const across = Math.abs(ox * dy - oy * dx);
        if (across > 40) continue;
        if (along > fs) {
          fs = along;
          far = e;
        }
      }
      best = far;
    }
    if (best) {
      this.setFocus(l, best);
      best.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      this.onMove?.();
    }
  }
}
