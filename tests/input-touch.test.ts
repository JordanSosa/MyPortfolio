/**
 * The floating joystick across modals (Season 3 owner bug, Android: "if you're holding the screen when you select
 * an upgrade on level up, sometimes the movement stick gets stuck"). A thumb put back down during the level-up's
 * 430 ms close delay, or held through a modal, was never taken back by the joystick: the hero ignored it until it
 * was lifted and pressed again. src/core/input.ts now tracks every finger and hands a held one the stick when the
 * joystick comes back, and a stick can never outlive its finger.
 *
 * The real Input runs on a tiny DOM stand-in (window / document / elements with capture -> target -> bubble
 * propagation and stopPropagation); the touch overlay is a fake that records the knob. The real-browser version
 * (CDP multi-touch on a phone page) is `node scripts/e2e.mjs --joystick`.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const dom = vi.hoisted(() => {
  type Listener = { fn: (e: FakeEvent) => void; capture: boolean };
  interface FakeEvent {
    type: string;
    target: El;
    stopped: boolean;
    stopPropagation(): void;
    preventDefault(): void;
    [k: string]: unknown;
  }
  class El {
    parent: El | null = null;
    private ls = new Map<string, Listener[]>();
    constructor(
      readonly tag: string,
      readonly attrs: string[] = [],
    ) {}
    addEventListener(type: string, fn: (e: FakeEvent) => void, o?: boolean | AddEventListenerOptions): void {
      const capture = typeof o === "boolean" ? o : !!o?.capture;
      const l = this.ls.get(type) ?? [];
      l.push({ fn, capture });
      this.ls.set(type, l);
    }
    removeEventListener(type: string, fn: (e: FakeEvent) => void, o?: boolean | AddEventListenerOptions): void {
      const capture = typeof o === "boolean" ? o : !!o?.capture;
      this.ls.set(
        type,
        (this.ls.get(type) ?? []).filter((x) => x.fn !== fn || x.capture !== capture),
      );
    }
    listeners(type: string, phase: "capture" | "bubble" | "target"): Listener[] {
      const l = this.ls.get(type) ?? [];
      if (phase === "target") return [...l.filter((x) => x.capture), ...l.filter((x) => !x.capture)];
      return l.filter((x) => x.capture === (phase === "capture"));
    }
    matches(sel: string): boolean {
      return sel.split(",").some((s) => s.trim() === this.tag || this.attrs.some((a) => `[${a}]` === s.trim()));
    }
    closest(sel: string): El | null {
      for (let n: El | null = this; n; n = n.parent) if (n.matches(sel)) return n;
      return null;
    }
    setPointerCapture(): void {}
  }
  const win = new El("#window");
  const doc = new El("#document");
  /** Dispatch like the DOM: window (capture) -> ancestors (capture) -> target -> ancestors (bubble) -> window (bubble). */
  function fire(type: string, target: El, init: Record<string, unknown> = {}): FakeEvent {
    const ev: FakeEvent = {
      type,
      target,
      stopped: false,
      stopPropagation() {
        this.stopped = true;
      },
      preventDefault() {},
      ...init,
    };
    const chain: El[] = [];
    for (let n: El | null = target; n; n = n.parent) chain.unshift(n);
    const path = target === win ? [win] : [win, ...chain];
    const at = path.length - 1;
    for (let i = 0; i < at && !ev.stopped; i++) for (const l of path[i].listeners(type, "capture")) l.fn(ev);
    if (!ev.stopped) for (const l of path[at].listeners(type, "target")) l.fn(ev);
    for (let i = at - 1; i >= 0 && !ev.stopped; i--) for (const l of path[i].listeners(type, "bubble")) l.fn(ev);
    return ev;
  }
  /** The touch overlay: records the knob instead of drawing it. */
  class FakeTouch {
    visible = false;
    stickOn = false;
    /** where the knob is drawn (origin + knob offset) */
    kx = 0;
    ky = 0;
    readonly dashBtn = new El("button", ["data-no-joystick"]);
    readonly ultBtn = new El("button", ["data-no-joystick"]);
    showStick(x: number, y: number): void {
      this.stickOn = true;
      this.kx = x;
      this.ky = y;
    }
    moveStick(x: number, y: number, kx: number, ky: number): void {
      this.kx = x + kx;
      this.ky = y + ky;
    }
    hideStick(): void {
      this.stickOn = false;
    }
    setPressed(): void {}
    deny(): void {}
    setDash(): void {}
    setUlt(): void {}
    destroy(): void {}
  }
  return { El, win, doc, fire, FakeTouch };
});

vi.mock("../src/core/touch", () => ({ TouchControls: dom.FakeTouch }));

import { Input } from "../src/core/input";

type El = InstanceType<typeof dom.El>;
type Touch = InstanceType<typeof dom.FakeTouch>;

const canvas = new dom.El("canvas");
/** a level-up card (a button inside the modal) */
const card = new dom.El("button");
const modal = new dom.El("div");
card.parent = modal;
const pauseBtn = new dom.El("button", ["data-ui"]);
/** What document.elementFromPoint answers (the test moves modals in and out). */
let hit: (x: number, y: number) => El = () => canvas;

let inp: Input;
let touch: Touch;
/** fingers the harness holds down: id -> the element it went down on (touch pointers are implicitly captured) */
const held = new Map<number, El>();
let nextId = 2;

function stubDom(): void {
  vi.stubGlobal("window", dom.win);
  vi.stubGlobal("document", Object.assign(dom.doc, { body: new dom.El("body"), visibilityState: "visible", elementFromPoint: (x: number, y: number) => hit(x, y) }));
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal("navigator", { maxTouchPoints: 5 });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("coarse") }));
}

function make(opts: ConstructorParameters<typeof Input>[0] = {}): void {
  inp = new Input(opts);
  touch = inp.touch as unknown as Touch;
  inp.showTouchControls(true);
}

const ptr = (id: number, x: number, y: number, extra: Record<string, unknown> = {}) => ({ pointerId: id, pointerType: "touch", clientX: x, clientY: y, buttons: 1, isPrimary: false, ...extra });

function down(x: number, y: number, on: El = canvas): number {
  const id = nextId++;
  const primary = held.size === 0;
  held.set(id, on);
  dom.fire("pointerdown", on, ptr(id, x, y, { isPrimary: primary }));
  return id;
}
function move(id: number, x: number, y: number): void {
  dom.fire("pointermove", held.get(id) as El, ptr(id, x, y));
}
function up(id: number, type = "pointerup"): void {
  const on = held.get(id) as El;
  held.delete(id);
  dom.fire(type, on, ptr(id, 0, 0, { buttons: 0 }));
}
/** the modal opens (App.openModal) / closes (the next game frame after App.closeModal) */
function openModal(): void {
  inp.showTouchControls(false);
  inp.markTouchesStale();
}
function closeModal(): void {
  inp.showTouchControls(true);
}
function frame(): { x: number; y: number } {
  inp.update();
  return { x: inp.move.x, y: inp.move.y };
}
/** INVARIANT: with no finger down the hero stands still and no knob shows */
function expectIdle(): void {
  expect(held.size).toBe(0);
  expect(frame()).toEqual({ x: 0, y: 0 });
  expect(inp.stickActive).toBe(false);
  expect(touch.stickOn).toBe(false);
}
/** the finger steers: the knob is under it and the move vector points its way */
function expectSteers(id: number, x0: number, y0: number, dx: number, dy: number): void {
  for (let i = 1; i <= 4; i++) move(id, x0 + (dx * i) / 4, y0 + (dy * i) / 4);
  const m = frame();
  expect(inp.stickActive).toBe(true);
  expect(touch.stickOn).toBe(true);
  expect(Math.hypot(touch.kx - (x0 + dx), touch.ky - (y0 + dy))).toBeLessThan(0.5);
  expect(m.x * dx + m.y * dy).toBeGreaterThan(0);
  expect(Math.hypot(m.x, m.y)).toBeGreaterThan(0.3);
}

beforeEach(() => {
  stubDom();
  hit = () => canvas;
  held.clear();
});
afterEach(() => {
  inp?.destroy();
  vi.unstubAllGlobals();
});

describe("joystick across modals", () => {
  test("a finger held through a modal gets the stick back the moment play resumes, centred under it", () => {
    make();
    const f = down(100, 500);
    expectSteers(f, 100, 500, 30, 0);
    openModal();
    expect(frame()).toEqual({ x: 0, y: 0 });
    expect(touch.stickOn).toBe(false);
    move(f, 140, 480); // (the thumb drifts while the cards are up)
    expect(frame()).toEqual({ x: 0, y: 0 });
    closeModal();
    expect(inp.stickActive).toBe(true);
    expect(touch.stickOn).toBe(true);
    expect([touch.kx, touch.ky]).toEqual([140, 480]);
    expect(frame()).toEqual({ x: 0, y: 0 }); // (zero until it moves: no lurch)
    expectSteers(f, 140, 480, 0, 40);
    up(f);
    expectIdle();
  });

  test("a thumb put down during the level-up's close delay (on a card of the closing modal) steers once it has closed", () => {
    make();
    hit = () => card;
    openModal();
    const f = down(200, 600, card); // the cards are flying out: busy, the modal is still up
    move(f, 205, 600);
    hit = () => canvas; // the modal is gone (or fading with pointer-events: none)
    closeModal();
    expect(inp.stickActive).toBe(true);
    expectSteers(f, 205, 600, -40, 0);
    up(f);
    expectIdle();
  });

  test("a finger still over the fading modal is not taken at once, but on its first move once the modal is gone", () => {
    make();
    hit = () => card;
    openModal();
    const f = down(200, 600, card);
    closeModal(); // (the fade-out still covers the finger)
    expect(inp.stickActive).toBe(false);
    move(f, 202, 600);
    expect(inp.stickActive).toBe(false);
    hit = () => canvas;
    move(f, 204, 600);
    expect(inp.stickActive).toBe(true);
    expectSteers(f, 204, 600, 0, -40);
    up(f);
    expectIdle();
  });

  test("lifted during the modal: nothing to adopt, the next touch is a normal stick", () => {
    make();
    const f = down(100, 500);
    expectSteers(f, 100, 500, 30, 0);
    openModal();
    up(f);
    closeModal();
    expectIdle();
    const g = down(150, 400);
    expectSteers(g, 150, 400, 0, 30);
    up(g);
    expectIdle();
  });

  test("the finger that held the stick wins over one that went down later", () => {
    make();
    const f = down(100, 500);
    move(f, 120, 500);
    openModal();
    const g = down(300, 300);
    closeModal();
    move(g, 340, 300);
    move(f, 120, 540);
    expect(touch.ky).toBe(540); // f steers, g is ignored
    up(g);
    up(f);
    expectIdle();
  });

  test("a finger held on DASH across a modal never becomes the stick; a second finger still steers", () => {
    make();
    const d = down(380, 700, touch.dashBtn);
    expect(inp.held("dash")).toBe(true);
    openModal();
    expect(inp.held("dash")).toBe(false);
    hit = (x) => (x > 350 ? touch.dashBtn : canvas);
    closeModal();
    expect(inp.stickActive).toBe(false);
    move(d, 300, 700); // slides off the button onto the play area
    expect(inp.stickActive).toBe(false);
    expect(frame()).toEqual({ x: 0, y: 0 });
    const g = down(100, 500);
    expectSteers(g, 100, 500, 30, 0);
    up(g);
    up(d);
    expectIdle();
    expect(inp.held("dash")).toBe(false);
  });

  test("a finger on a HUD button ([data-ui]) is never adopted", () => {
    make();
    hit = () => pauseBtn;
    openModal();
    const f = down(390, 20, pauseBtn);
    closeModal();
    move(f, 380, 30);
    expect(inp.stickActive).toBe(false);
    up(f);
    expectIdle();
  });

  test("the ghost-tap guard holds: a finger held through a modal stays stale, even once it steers again", () => {
    make();
    const f = down(100, 500);
    openModal();
    expect(inp.isFresh(f)).toBe(false);
    const tap = down(200, 300, card);
    expect(inp.isFresh(tap)).toBe(true);
    up(tap);
    closeModal();
    expect(inp.stickActive).toBe(true);
    expect(inp.isFresh(f)).toBe(false);
    up(f);
    expectIdle();
  });

  test("pointercancel mid-drag lets go", () => {
    make();
    const f = down(100, 500);
    expectSteers(f, 100, 500, 30, 0);
    up(f, "pointercancel");
    expectIdle();
  });
});

describe("a stick never outlives its finger", () => {
  test("a lost pointerup: the next first finger (a primary touch) proves it lifted and takes the stick", () => {
    make();
    const f = down(100, 500);
    expectSteers(f, 100, 500, 40, 0);
    held.delete(f); // (its pointerup never reached the page)
    const g = down(200, 400);
    expect(inp.stickActive).toBe(true);
    expectSteers(g, 200, 400, 0, 40);
    up(g);
    expectIdle();
  });

  test("a pointerup whose bubbling was stopped still ends the stick (checked every frame)", () => {
    make();
    const f = down(100, 500);
    expectSteers(f, 100, 500, 40, 0);
    const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
    canvas.addEventListener("pointerup", stop);
    try {
      up(f);
    } finally {
      canvas.removeEventListener("pointerup", stop);
    }
    expectIdle();
  });

  test("a pointer id seen again without its pointerup starts a fresh press", () => {
    make();
    const f = down(100, 500);
    expectSteers(f, 100, 500, 40, 0);
    // the same id goes down somewhere else (no pointerup in between)
    dom.fire("pointerdown", canvas, ptr(f, 300, 300));
    expect([touch.kx, touch.ky]).toEqual([300, 300]);
    expect(frame()).toEqual({ x: 0, y: 0 });
    expectSteers(f, 300, 300, 0, 40);
    up(f);
    expectIdle();
  });

  test("blur lets go; the same finger still down steers again on its next move", () => {
    make();
    const f = down(100, 500);
    expectSteers(f, 100, 500, 40, 0);
    dom.fire("blur", dom.win);
    expect(frame()).toEqual({ x: 0, y: 0 });
    expect(touch.stickOn).toBe(false);
    move(f, 140, 500);
    expectSteers(f, 140, 500, 0, 40);
    up(f);
    expectIdle();
  });

  test("a hidden page forgets every finger; one still down re-registers on its next move", () => {
    make();
    const f = down(100, 500);
    expectSteers(f, 100, 500, 40, 0);
    (document as unknown as { visibilityState: string }).visibilityState = "hidden";
    dom.fire("visibilitychange", dom.doc);
    expect(frame()).toEqual({ x: 0, y: 0 });
    expect(touch.stickOn).toBe(false);
    (document as unknown as { visibilityState: string }).visibilityState = "visible";
    // a modal open + close with no finger known: nothing is adopted out of thin air
    openModal();
    closeModal();
    expect(inp.stickActive).toBe(false);
    move(f, 120, 500);
    expectSteers(f, 120, 500, 0, 40);
    up(f);
    expectIdle();
  });

  test("fuzz: random fingers, moves, lifts, cancels, modals and blurs never leave a stick without a finger", () => {
    make();
    let s = 12345;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
    const pos = new Map<number, [number, number]>();
    let live = true;
    for (let i = 0; i < 3000; i++) {
      const r = rnd();
      const ids = [...held.keys()];
      const any = ids[Math.floor(rnd() * ids.length)];
      if (r < 0.15 && held.size < 4) {
        const x = Math.round(rnd() * 400);
        const y = Math.round(rnd() * 800);
        const onDash = live && rnd() < 0.15;
        const id = down(x, y, onDash ? touch.dashBtn : rnd() < 0.2 && !live ? card : canvas);
        pos.set(id, [x, y]);
      } else if (r < 0.6 && any !== undefined) {
        const [x, y] = pos.get(any) as [number, number];
        const nx = x + Math.round((rnd() - 0.5) * 60);
        const ny = y + Math.round((rnd() - 0.5) * 60);
        pos.set(any, [nx, ny]);
        move(any, nx, ny);
      } else if (r < 0.75 && any !== undefined) up(any, rnd() < 0.2 ? "pointercancel" : "pointerup");
      else if (r < 0.85) {
        live = !live;
        if (live) closeModal();
        else openModal();
      } else if (r < 0.88) dom.fire("blur", dom.win);
      const m = frame();
      if (held.size === 0 || !live) {
        expect(m).toEqual({ x: 0, y: 0 });
        expect(inp.stickActive).toBe(false);
        expect(touch.stickOn).toBe(false);
      }
      if (touch.stickOn) expect(inp.stickActive).toBe(true);
    }
  });
});

describe("other ways to steer still work", () => {
  test("?touch=1 mouse joystick: a held button drags the stick, hover moves do not, and it is adopted after a modal", () => {
    make({ mouseJoystick: true, forceTouchUI: true });
    const mouse = (type: string, x: number, y: number, buttons: number) => dom.fire(type, canvas, { pointerId: 1, pointerType: "mouse", clientX: x, clientY: y, buttons, isPrimary: true });
    mouse("pointermove", 50, 50, 0);
    expect(inp.stickActive).toBe(false);
    mouse("pointerdown", 100, 100, 1);
    mouse("pointermove", 140, 100, 1);
    expect(frame().x).toBeGreaterThan(0.5);
    openModal();
    mouse("pointermove", 150, 100, 1);
    closeModal();
    expect(inp.stickActive).toBe(true);
    mouse("pointermove", 150, 140, 1);
    expect(frame().y).toBeGreaterThan(0.5);
    mouse("pointerup", 150, 140, 0);
    expect(frame()).toEqual({ x: 0, y: 0 });
    expect(touch.stickOn).toBe(false);
  });

  test("the keyboard still moves the hero (and hides the touch controls)", () => {
    make();
    dom.fire("keydown", dom.win, { code: "KeyD", repeat: false });
    expect(frame().x).toBe(1);
    expect(inp.touchControlsVisible).toBe(false);
    dom.fire("keyup", dom.win, { code: "KeyD" });
    expect(frame().x).toBe(0);
  });

  test("keyboard mid-hold: the press that brings the touch controls back steers, not the finger resting since before", () => {
    make();
    const f = down(100, 500);
    expectSteers(f, 100, 500, 30, 0);
    dom.fire("keydown", dom.win, { code: "KeyD", repeat: false });
    expect(frame().x).toBe(1);
    expect(touch.stickOn).toBe(false);
    dom.fire("keyup", dom.win, { code: "KeyD" });
    move(f, 130, 520);
    expect(frame()).toEqual({ x: 0, y: 0 }); // (keyboard mode: no touch controls, no stick)
    const g = down(250, 400);
    expect(inp.touchControlsVisible).toBe(true);
    expectSteers(g, 250, 400, 0, 40);
    up(g);
    // (the resting finger was passed over: its moves never steer until it lifts)
    move(f, 150, 540);
    move(f, 180, 560);
    expect(frame()).toEqual({ x: 0, y: 0 });
    expect(inp.stickActive).toBe(false);
    up(f);
    expectIdle();
  });
});

describe("one stick per touch: a finger that was down beside the stick never takes it", () => {
  test("the stick thumb lifts to reposition: a second thumb resting on the play area does not take the stick, the next press steers", () => {
    make();
    const a = down(100, 500);
    expectSteers(a, 100, 500, 30, 0);
    const b = down(300, 700); // the other thumb rests on the play area (a near miss of DASH)
    move(b, 301, 699);
    expect(frame().x).toBeGreaterThan(0); // (a still steers)
    up(a);
    move(b, 295, 695); // its contact patch drifts while a is up
    move(b, 286, 686);
    expect(frame()).toEqual({ x: 0, y: 0 });
    expect(inp.stickActive).toBe(false);
    expect(touch.stickOn).toBe(false);
    const c = down(110, 490); // the steering thumb comes back
    expectSteers(c, 110, 490, 0, -40);
    up(c);
    up(b);
    expectIdle();
  });

  test("a thumb passed over when the stick comes back after a modal never takes it later", () => {
    make();
    const a = down(100, 500);
    expectSteers(a, 100, 500, 30, 0);
    openModal();
    const b = down(300, 700); // rests while the cards are up
    closeModal(); // a (held the stick last) is adopted, b is passed over
    expect(inp.stickActive).toBe(true);
    expectSteers(a, 130, 500, 0, 30);
    up(a);
    move(b, 295, 695);
    move(b, 286, 686);
    expect(frame()).toEqual({ x: 0, y: 0 });
    expect(inp.stickActive).toBe(false);
    const c = down(110, 490);
    expectSteers(c, 110, 490, 0, -40);
    up(c);
    up(b);
    expectIdle();
  });
});
