/**
 * DEVELOPER MODE and the dev console's gestures (always in the bundle, tiny: only the core storage helpers). The
 * 3-finger long-press opened the console in production builds too, so a panicking player with three fingers down
 * mid-run (or a PC player reaching for Esc, right above `) could get a developer panel that can rewrite the save.
 * Now the long-press and the ` key work only in developer mode: ?dev=1 turns it on for this browser (kept; ?dev=0
 * off, src/debug/dev.ts) and Settings switches it (7 taps on the build label: a phone in the artifact viewer cannot
 * add URL params). `__kk.dev()` always works. tests/dev-mode.test.ts, e2e --devmode.
 */
import { loadText, removeKey, saveText, storageKey } from "../core/storage";

/** Long-press with three or more fingers (ms) that opens the console on touch screens. */
export const LONG_PRESS_MS = 650;

/** Developer mode, kept per browser (core storage; never the profile). */
const DEV_KEY = storageKey("devmode", 1);
let devOn: boolean | null = null;
/** Developer mode is on: the ` key and the 3-finger long-press open the dev console. */
export function devMode(): boolean {
  return (devOn ??= loadText(DEV_KEY) === "1");
}
/** Turn developer mode on / off (kept when storage allows). Returns the new state. */
export function setDevMode(on: boolean): boolean {
  devOn = on;
  if (on) saveText(DEV_KEY, "1");
  else removeKey(DEV_KEY);
  return on;
}

/**
 * The console's gestures: the ` key and a 3-finger long-press, both only in developer mode (checked when they
 * happen, so the Settings switch applies at once). `toggle` opens / closes the console.
 */
export function wireTriggers(toggle: () => void): void {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Backquote" && e.key !== "`") return;
      if (!devMode()) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("textarea, input, select, [contenteditable]")) return;
      e.preventDefault();
      toggle();
    },
    { capture: true },
  );
  // (Chrome defers timers while a touch sequence is active, so the hold is timed with rAF polling and
  // also checked when the fingers lift)
  let down = -1;
  let fired = false;
  let x0 = 0;
  let y0 = 0;
  const cancel = () => {
    down = -1;
  };
  const fire = () => {
    if (down < 0 || fired) return;
    fired = true;
    down = -1;
    toggle();
  };
  const poll = () => {
    if (down < 0 || fired) return;
    if (performance.now() - down >= LONG_PRESS_MS) fire();
    else requestAnimationFrame(poll);
  };
  window.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length < 3 || !devMode()) {
        cancel();
        return;
      }
      if (down >= 0) return;
      down = performance.now();
      fired = false;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      requestAnimationFrame(poll);
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (down < 0) return;
      const t = e.touches[0];
      if (!t || Math.hypot(t.clientX - x0, t.clientY - y0) > 30) cancel();
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "touchend",
    (e) => {
      if (down >= 0 && performance.now() - down >= LONG_PRESS_MS) fire();
      if (e.touches.length < 3) cancel();
    },
    { capture: true, passive: true },
  );
  window.addEventListener("touchcancel", cancel, { capture: true, passive: true });
}
