/**
 * SECOND-THUMB TAPS (src/ui/screens/common.ts secondThumbTaps). Chromium sends no click for a finger that taps while
 * another finger is down (or was down at any moment of the tap): a player holding the stick could not pick a level-up
 * card, open the chest or press RESUME with the other thumb (measured on an emulated phone: clicks [], picks 0). The
 * helper presses the control on the fresh finger's pointerup and swallows the click a browser may still send.
 *
 * A tiny DOM stand-in (window / document / elements with capture -> target -> bubble propagation, stopPropagation,
 * stopImmediatePropagation) and an Input stub (isFresh / ownsPointer / pointersDown). The real-browser version (CDP
 * multi-touch on a phone page) is `node scripts/e2e.mjs --joystick`, steps (j)-(m).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const dom = vi.hoisted(() => {
  type Listener = { fn: (e: Ev) => void; capture: boolean };
  class Ev {
    target: El | null = null;
    stopped = false;
    immediate = false;
    defaultPrevented = false;
    detail = 0;
    pointerId?: number;
    pointerType = "touch";
    isPrimary = false;
    clientX = 0;
    clientY = 0;
    screenX = 0;
    screenY = 0;
    constructor(
      readonly type: string,
      init: Record<string, unknown> = {},
      readonly isTrusted = false,
    ) {
      Object.assign(this, init);
    }
    stopPropagation(): void {
      this.stopped = true;
    }
    stopImmediatePropagation(): void {
      this.stopped = true;
      this.immediate = true;
    }
    preventDefault(): void {
      this.defaultPrevented = true;
    }
  }
  class El {
    parent: El | null = null;
    disabled = false;
    readonly classes = new Set<string>();
    private ls = new Map<string, Listener[]>();
    constructor(
      readonly tag: string,
      readonly attrs: string[] = [],
    ) {}
    get classList() {
      return { contains: (c: string) => this.classes.has(c), add: (c: string) => void this.classes.add(c) };
    }
    get isConnected(): boolean {
      let n: El = this;
      while (n.parent) n = n.parent;
      return n === doc;
    }
    append(...kids: El[]): this {
      for (const k of kids) k.parent = this;
      return this;
    }
    addEventListener(type: string, fn: (e: Ev) => void, o?: boolean | AddEventListenerOptions): void {
      const capture = typeof o === "boolean" ? o : !!o?.capture;
      const l = this.ls.get(type) ?? [];
      l.push({ fn, capture });
      this.ls.set(type, l);
    }
    removeEventListener(): void {}
    listeners(type: string, phase: "capture" | "bubble" | "target"): Listener[] {
      const l = this.ls.get(type) ?? [];
      if (phase === "target") return [...l.filter((x) => x.capture), ...l.filter((x) => !x.capture)];
      return l.filter((x) => x.capture === (phase === "capture"));
    }
    matches(sel: string): boolean {
      return sel.split(",").some((s) => s.trim() === this.tag || this.attrs.some((a) => `[${a}]` === s.trim()));
    }
    closest(sel: string): El | null {
      for (let n: El | null = this; n && n !== doc; n = n.parent) if (n.matches(sel)) return n;
      return null;
    }
    contains(n: El | null): boolean {
      for (let k = n; k; k = k.parent) if (k === this) return true;
      return false;
    }
    /** Like the DOM: window (capture) -> ancestors (capture) -> target -> ancestors (bubble) -> window (bubble). */
    dispatchEvent(ev: Ev): boolean {
      ev.target = this;
      const chain: El[] = [];
      for (let n: El | null = this; n; n = n.parent) chain.unshift(n);
      const path = [win, ...chain];
      const at = path.length - 1;
      const run = (ls: Listener[]) => {
        for (const l of ls) {
          if (ev.immediate) return;
          l.fn(ev);
        }
      };
      for (let i = 0; i < at && !ev.stopped; i++) run(path[i].listeners(ev.type, "capture"));
      if (!ev.stopped) run(path[at].listeners(ev.type, "target"));
      for (let i = at - 1; i >= 0 && !ev.stopped; i--) run(path[i].listeners(ev.type, "bubble"));
      return !ev.defaultPrevented;
    }
  }
  const win = new El("#window");
  const doc = new El("#document");
  /** what document.elementFromPoint answers (the element under the lifting finger) */
  const under: { el: El | null } = { el: null };
  Object.assign(globalThis, {
    window: win,
    document: Object.assign(doc, { elementFromPoint: () => under.el }),
    // the helper's own click: untrusted, like a dispatched PointerEvent
    PointerEvent: class extends Ev {
      constructor(type: string, init: Record<string, unknown> = {}) {
        super(type, init, false);
      }
    },
  });
  return { Ev, El, win, doc, under };
});

import { secondThumbTaps, type TapInput } from "../src/ui/screens/common";

type El = InstanceType<typeof dom.El>;

/** Input stub: fingers down, the fresh ones (down since the last markTouchesStale), the stick / DASH ones. */
const input: TapInput & { down: Set<number>; fresh: Set<number>; owned: Set<number> } = {
  down: new Set<number>(),
  fresh: new Set<number>(),
  owned: new Set<number>(),
  isFresh(id: number) {
    return this.fresh.has(id);
  },
  ownsPointer(id: number) {
    return this.owned.has(id);
  },
  get pointersDown() {
    return this.down.size;
  },
};

let canvas: El;
let modal: El;
let card: El;
let cardText: El;
let other: El;
let presses: { detail: number; pointerId: number | undefined; trusted: boolean }[];
let otherPresses: number;
let rootClicks: number;

const at = { x: 100, y: 200 };
function fire(type: string, target: El, init: Record<string, unknown> = {}, trusted = true) {
  const e = new dom.Ev(type, { clientX: at.x, clientY: at.y, ...init }, trusted);
  target.dispatchEvent(e);
  return e;
}
/** a finger goes down (the real Input's capture listener counts it first; it went down after the last stale mark) */
function down(id: number, target: El, type = "touch") {
  input.down.add(id);
  input.fresh.add(id);
  fire("pointerdown", target, { pointerId: id, pointerType: type });
}
/** it lifts over `over` (Input forgot it before the layer sees the pointerup; implicit capture: the target stays) */
function up(id: number, target: El, over: El = target, dx = 0) {
  input.down.delete(id);
  dom.under.el = over;
  fire("pointerup", target, { pointerId: id, pointerType: "touch", clientX: at.x + dx });
}
/** the browser's own click (trusted, detail 1) */
const nativeClick = (id: number | undefined, target: El) => fire("click", target, { pointerId: id, detail: 1 });

beforeEach(() => {
  input.down.clear();
  input.fresh.clear();
  input.owned.clear();
  canvas = new dom.El("canvas");
  modal = new dom.El("div");
  card = new dom.El("button");
  cardText = new dom.El("div");
  other = new dom.El("button");
  card.append(cardText);
  modal.append(card, other);
  dom.doc.append(canvas, modal);
  presses = [];
  otherPresses = 0;
  rootClicks = 0;
  card.addEventListener("click", (e) => {
    e.stopPropagation();
    presses.push({ detail: e.detail, pointerId: e.pointerId, trusted: e.isTrusted });
  });
  other.addEventListener("click", (e) => {
    e.stopPropagation();
    otherPresses++;
  });
  modal.addEventListener("click", () => rootClicks++);
  secondThumbTaps(modal as unknown as HTMLElement, input);
});

/** the stick thumb: down on the play area before the modal (stale) */
function holdStick(id = 1) {
  down(id, canvas);
  input.fresh.delete(id);
}

describe("second-thumb taps", () => {
  test("the stick thumb held: a second thumb's tap presses the card once (detail 1, its pointerId); the browser's click after it is swallowed", () => {
    holdStick();
    down(2, cardText);
    up(2, cardText);
    expect(presses).toEqual([{ detail: 1, pointerId: 2, trusted: false }]);
    // a browser that does send a click for that tap: it never reaches the card
    const late = nativeClick(2, cardText);
    expect(late.defaultPrevented).toBe(true);
    expect(presses).toHaveLength(1);
  });

  test("a lone finger keeps the browser's own click (nothing pressed here, nothing swallowed)", () => {
    down(5, cardText);
    up(5, cardText);
    expect(presses).toHaveLength(0);
    nativeClick(5, cardText);
    expect(presses).toEqual([{ detail: 1, pointerId: 5, trusted: true }]);
  });

  test("the other finger lifted first, or went down mid-press: still a multi-touch tap", () => {
    holdStick();
    down(2, cardText);
    input.down.delete(1); // the stick thumb lifts before the tapping one
    up(2, cardText);
    expect(presses).toHaveLength(1);
    down(3, card);
    down(4, canvas); // a thumb lands on the play area while the card is pressed
    up(3, card);
    expect(presses).toHaveLength(2);
  });

  test("a finger held from before (stale), the stick / DASH finger, a mouse: never pressed", () => {
    holdStick();
    down(2, card);
    input.fresh.delete(2); // a new offer marked it stale while it was down
    up(2, card);
    down(3, card);
    input.owned.add(3); // (the joystick / DASH finger)
    up(3, card);
    down(4, card, "mouse");
    up(4, card);
    expect(presses).toHaveLength(0);
  });

  test("a drag, a scroll (pointercancel), lifting over another control: nothing pressed", () => {
    holdStick();
    down(2, card);
    fire("pointermove", card, { pointerId: 2, clientX: at.x, clientY: at.y + 20 });
    up(2, card);
    down(3, card);
    fire("pointercancel", card, { pointerId: 3 });
    up(3, card);
    down(4, card);
    up(4, card, other);
    down(5, card);
    up(5, card, card, 30);
    expect(presses).toHaveLength(0);
    expect(otherPresses).toBe(0);
  });

  test("a disabled button, a layer fading out (.out), a detached one: nothing pressed", () => {
    holdStick();
    card.disabled = true;
    down(2, card);
    up(2, card);
    card.disabled = false;
    modal.classList.add("out");
    down(3, card);
    up(3, card);
    expect(presses).toHaveLength(0);
  });

  test("a tap anywhere on a layer without a control reaches the layer (the chest's tap-anywhere)", () => {
    holdStick();
    const reel = new dom.El("div");
    modal.append(reel);
    down(2, reel);
    up(2, reel);
    expect(rootClicks).toBe(1);
  });

  test("a browser whose click has no pointerId: the click right after the tap is swallowed, the next tap's own is not", () => {
    holdStick();
    down(2, card);
    up(2, card);
    expect(presses).toHaveLength(1);
    expect(nativeClick(undefined, card).defaultPrevented).toBe(true);
    expect(presses).toHaveLength(1);
    // another second-thumb tap, then (the stick thumb lifted) a lone tap well inside the old 800 ms window
    down(3, card);
    up(3, card);
    expect(presses).toHaveLength(2);
    input.down.delete(1);
    down(4, card);
    up(4, card);
    nativeClick(undefined, card);
    expect(presses).toHaveLength(3);
  });

  test("keyboard / gamepad clicks (detail 0) and a mouse click still act while a swallow is armed", () => {
    holdStick();
    down(2, card);
    up(2, card);
    expect(presses).toHaveLength(1);
    fire("click", card, { detail: 0 }, false); // nav.ts confirm: el.click()
    fire("click", card, { pointerId: 1, pointerType: "mouse", detail: 1 }); // a mouse (another pointer)
    expect(presses).toHaveLength(3);
  });
});
