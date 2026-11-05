/**
 * Developer mode gates the hidden dev console (src/debug/devmode.ts). The 3-finger long-press (0.65 s) opened the console
 * in production builds too: a panicking player with three fingers down mid-run could get a developer panel that can
 * rewrite the save. Now the long-press and the ` key work only in developer mode (?dev=1, or 7 taps on the Settings
 * build label), kept per browser through the core storage helpers. The real-browser version (CDP multi-touch on a
 * phone page, real taps on the label) is `node scripts/e2e.mjs --devmode`.
 *
 * A window stand-in records listeners; rAF and performance.now are driven by the test.
 */
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

const env = vi.hoisted(() => {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  type Fn = (e: Record<string, unknown>) => void;
  const listeners = new Map<string, Fn[]>();
  const win = {
    addEventListener: (t: string, fn: Fn) => void listeners.set(t, [...(listeners.get(t) ?? []), fn]),
    removeEventListener() {},
  };
  const frames: (() => void)[] = [];
  Object.assign(globalThis, { localStorage, window: win, requestAnimationFrame: (cb: () => void) => frames.push(cb) });
  const fire = (t: string, e: Record<string, unknown>) => {
    for (const fn of listeners.get(t) ?? []) fn(e);
  };
  return { store, fire, frames, clock: { now: 0 } };
});

import { devMode, LONG_PRESS_MS, setDevMode, wireTriggers } from "../src/debug/devmode";

const now = vi.spyOn(performance, "now").mockImplementation(() => env.clock.now);
afterAll(() => now.mockRestore());

let toggles = 0;
wireTriggers(() => toggles++);

const touches = (n: number) => Array.from({ length: n }, (_, i) => ({ clientX: 100 + i * 40, clientY: 300 }));
/** run the rAF callbacks queued so far */
const frame = () => {
  for (const cb of env.frames.splice(0)) cb();
};
/** `n` fingers held for `ms` (rAF polls every 16 ms), then lifted */
function hold(n: number, ms: number): void {
  env.fire("touchstart", { touches: touches(n) });
  for (let t = 0; t < ms; t += 16) {
    env.clock.now += 16;
    frame();
  }
  env.fire("touchend", { touches: [] });
}
function backquote(): boolean {
  let prevented = false;
  env.fire("keydown", { code: "Backquote", key: "`", target: null, preventDefault: () => (prevented = true) });
  return prevented;
}

beforeEach(() => {
  toggles = 0;
  env.frames.length = 0;
});

describe("developer mode", () => {
  test("off by default: a 3-finger long-press and the ` key never open the console", () => {
    expect(devMode()).toBe(false);
    hold(3, LONG_PRESS_MS + 200);
    expect(backquote()).toBe(false);
    expect(toggles).toBe(0);
  });

  test("on (kept in storage): the long-press opens the console once; the ` key toggles it; short or 2-finger holds do not", () => {
    setDevMode(true);
    expect(env.store.get("kko.devmode.v1")).toBe("1");
    hold(3, LONG_PRESS_MS + 200);
    expect(toggles).toBe(1);
    hold(3, LONG_PRESS_MS - 200);
    hold(2, LONG_PRESS_MS + 200);
    expect(toggles).toBe(1);
    expect(backquote()).toBe(true);
    expect(toggles).toBe(2);
  });

  test("switched off again: storage forgets it and the gestures are inert at once", () => {
    setDevMode(true);
    setDevMode(false);
    expect(env.store.has("kko.devmode.v1")).toBe(false);
    hold(3, LONG_PRESS_MS + 200);
    backquote();
    expect(toggles).toBe(0);
  });

  test("a reload reads the kept choice", async () => {
    env.store.set("kko.devmode.v1", "1");
    vi.resetModules();
    const fresh = await import("../src/debug/devmode");
    expect(fresh.devMode()).toBe(true);
    env.store.delete("kko.devmode.v1");
    vi.resetModules();
    expect((await import("../src/debug/devmode")).devMode()).toBe(false);
  });
});
