/**
 * Developer suite entry (always in the bundle, kept tiny): deterministic step
 * mode, lazy loaders for the scenarios and the dev console, and their triggers.
 *
 *   ?step=1                  the main loop runs only on __kk.step() (deterministic: no rAF, CSS / WAAPI
 *                            animations are paused and advanced by the same dt)
 *   ?scenario=<name>         put the game in a named state at boot (src/debug/scenarios.ts); with
 *                            &seed= &hero= &profile=; <html data-kk-scenario="ready|error"> when done
 *   ?dev=1                   open the dev console at boot (also: the ` key, a 3-finger long-press)
 *
 *   __kk.step(frames = 1, dt = 1/60)   run frames now (sim + fx every frame, WebGL draw on the last one only,
 *                                      synchronously: a screenshot right after is exact) -> { t, frames, screen, modal }
 *   __kk.render()                      draw the current state once (no sim time passes)
 *   __kk.freeze(on = true)             enter / leave step mode at runtime
 *   await __kk.scenario(name, opts?)   -> { name, ok, ms, error? } once the state is ready
 *   await __kk.scenarios()             -> the scenario list ({ name, group, desc })
 *   await __kk.snapshot()              -> structured JSON of the live state (src/debug/snapshot.ts)
 *   __kk.diagnostics()                 -> the "Copy diagnostics" text
 *   await __kk.dev(open?)              toggle the dev console overlay
 *   __kk.perf                          the frame profiler (src/debug/perf.ts)
 *
 * Nothing here costs a frame: the scenario / console / snapshot code is a
 * separate lazy chunk, fetched only when one of the above is used.
 */
import type { App } from "../ui/app";
import { diagnosticsText, trackApp } from "./diag";
import { prof } from "./perf";

type ScenarioMod = typeof import("./scenarios");
type ConsoleMod = typeof import("./console/console");

let scn: Promise<ScenarioMod> | null = null;
let con: Promise<ConsoleMod> | null = null;
/** The scenario / snapshot chunk (loaded on first use). */
export const loadScenarios = (): Promise<ScenarioMod> => (scn ??= import("./scenarios"));
/** The dev console chunk (loaded on first use). */
export const loadConsole = (): Promise<ConsoleMod> => (con ??= import("./console/console"));

/** Animations step mode paused (and drives); ones the game paused itself (CSS play-state) are left alone. */
const stepHeld = new Set<Animation>();

/** Pause every running CSS / WAAPI animation and move the ones step mode holds forward by `dt` seconds. */
export function advanceAnimations(dt: number): void {
  if (typeof document === "undefined" || typeof document.getAnimations !== "function") return;
  const inc = dt * 1000;
  for (const a of document.getAnimations()) {
    try {
      if (a.playState === "finished" || a.playState === "idle") {
        stepHeld.delete(a);
        continue;
      }
      if (a.playState === "running") {
        a.pause();
        stepHeld.add(a);
      }
      if (inc > 0 && stepHeld.has(a)) a.currentTime = (Number(a.currentTime) || 0) + inc;
    } catch {
      /* detached / not seekable */
    }
  }
  // (forget animations that left the document)
  if (stepHeld.size > 4096) for (const a of stepHeld) if (a.playState === "finished" || a.playState === "idle") stepHeld.delete(a);
}

/** In step mode CSS / WAAPI animations are synced to the step clock at most every SYNC_EVERY frames (and at the end of every step). */
const SYNC_EVERY = 4;

/**
 * Runs frames of a fixed dt (step mode's frame driver). CSS / WAAPI time follows the frames: synced
 * every SYNC_EVERY frames and on finish() (syncing touches every animation and forces a style
 * flush, ~0.05 ms per animation in headless Chromium: a 200-animation screen paid ~13 ms a frame).
 * Deterministic: the same frames sync at the same points.
 */
export class Stepper {
  private n = 0;
  private pending = 0;
  readonly manual: boolean;
  constructor(
    private readonly app: App,
    private readonly dt = 1 / 60,
  ) {
    this.manual = app.loop.manual;
    if (this.manual) app.auto.enabled = false;
  }
  /** One frame; `draw` = render the WebGL scene this frame. */
  frame(draw: boolean): void {
    if (this.manual && this.n > 0 && this.n % SYNC_EVERY === 0) {
      advanceAnimations(this.pending);
      this.pending = 0;
    }
    this.app.debugDraw = draw ? "force" : "skip";
    try {
      this.app.loop.step(this.dt);
    } finally {
      this.app.debugDraw = "auto";
    }
    this.pending += this.dt;
    this.n++;
  }
  /** Bring CSS time to the end of the last frame and freeze what started meanwhile (a screenshot now is exact). */
  finish(): void {
    if (this.manual) advanceAnimations(this.pending);
    this.pending = 0;
  }
}

/**
 * Run `n` frames of `dt` right now. Every frame runs the sim, fx and DOM updates; only the last
 * one draws the WebGL scene (`drawLast` false: none does). In step mode AutoQuality stays off and
 * CSS animations advance with the frames. `before(i)` runs before frame i (scenario bookkeeping).
 */
export function stepFrames(app: App, n = 1, dt = 1 / 60, drawLast = true, before?: (i: number) => void): void {
  const frames = Math.max(1, Math.floor(Number(n) || 1));
  const st = new Stepper(app, Number.isFinite(dt) && dt >= 0 ? dt : 1 / 60);
  for (let i = 0; i < frames; i++) {
    before?.(i);
    st.frame(drawLast && i === frames - 1);
  }
  st.finish();
}

/** Draw the current state once (a frame with dt 0). */
export function renderOnce(app: App): void {
  app.debugDraw = "force";
  try {
    app.loop.step(0);
  } finally {
    app.debugDraw = "auto";
  }
  if (app.loop.manual) advanceAnimations(0);
}

/** Enter / leave step mode. */
export function setStepMode(app: App, on: boolean): void {
  app.loop.setManual(on);
  if (on) {
    app.auto.enabled = false;
    advanceAnimations(0);
  } else {
    for (const a of stepHeld) {
      try {
        if (a.playState === "paused") a.play();
      } catch {
        /* detached */
      }
    }
    stepHeld.clear();
    app.applySettings();
  }
}

/** Long-press with three or more fingers (ms) that opens the console on touch screens. */
const LONG_PRESS_MS = 650;

function wireTriggers(app: App): void {
  const toggle = () => void loadConsole().then((m) => m.toggleConsole(app));
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Backquote" && e.key !== "`") return;
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
      if (e.touches.length < 3) {
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

/** Scenario state at boot (?scenario=): also mirrored on <html data-kk-scenario>. */
export const scenarioState: { name: string; status: "none" | "pending" | "ready" | "error"; ms: number; error: string; marks: [string, number][] } = {
  name: "",
  status: "none",
  ms: 0,
  error: "",
  marks: [],
};

/**
 * Install the suite: call after installHooks(app) and BEFORE app.start() (step mode must be on before
 * the loop starts); ?scenario= runs right after start().
 */
export function installDev(app: App): void {
  trackApp(app);
  const q = new URLSearchParams(app.params.query);
  if (q.get("step") === "1") setStepMode(app, true);
  const w = window as unknown as { __kk?: Record<string, unknown> };
  const kk = (w.__kk ??= {});
  const api = {
    step(frames = 1, dt = 1 / 60) {
      stepFrames(app, frames, dt);
      return { t: app.game?.world.t ?? app.attract?.world.t ?? 0, frames: app.loop.frames, screen: app.screen, modal: app.modalKind };
    },
    render() {
      renderOnce(app);
    },
    freeze(on = true) {
      setStepMode(app, on);
      return app.loop.manual;
    },
    get stepMode() {
      return app.loop.manual;
    },
    get scenarioState() {
      return { ...scenarioState };
    },
    scenario(name: string, opts: Record<string, unknown> = {}) {
      return loadScenarios().then((m) => m.runScenario(app, name, opts));
    },
    scenarios() {
      return loadScenarios().then((m) => m.listScenarios());
    },
    snapshot() {
      return loadScenarios().then((m) => m.snapshot(app));
    },
    diagnostics() {
      return diagnosticsText(app);
    },
    dev(open?: boolean) {
      return loadConsole().then((m) => m.toggleConsole(app, open));
    },
    perf: prof,
  };
  Object.defineProperties(kk, Object.getOwnPropertyDescriptors(api));
  wireTriggers(app);
  const name = q.get("scenario");
  const devOpen = q.get("dev") === "1";
  if (!name && !devOpen) return;
  // after app.start() (the screens it opens are replaced by the scenario's)
  queueMicrotask(() => {
    if (devOpen) void api.dev(true);
    if (!name) return;
    scenarioState.name = name;
    scenarioState.status = "pending";
    document.documentElement.dataset.kkScenario = "pending";
    const opts: Record<string, unknown> = {};
    for (const k of ["seed", "hero", "profile", "account", "god"]) if (q.has(k)) opts[k] = q.get(k);
    api
      .scenario(name, opts)
      .then((r) => {
        scenarioState.status = r.ok ? "ready" : "error";
        scenarioState.ms = r.ms;
        scenarioState.error = r.error ?? "";
        scenarioState.marks = r.marks;
      })
      .catch((e: unknown) => {
        // (the lazy chunk failed to load)
        scenarioState.status = "error";
        scenarioState.error = e instanceof Error ? e.message : String(e);
        console.error("[dev] scenario chunk failed to load", e);
      })
      .finally(() => (document.documentElement.dataset.kkScenario = scenarioState.status));
  });
}
