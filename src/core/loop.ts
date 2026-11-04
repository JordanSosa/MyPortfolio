/**
 * requestAnimationFrame main loop.
 *
 *   const loop = new Loop((dt, now) => { time.update(dt); ...; renderer.endFrame(); });
 *   loop.onVisibility = (hidden) => hidden && pauseGame();
 *   loop.start();
 *
 * - dt is real seconds since the previous frame, clamped to `maxDt` (1/20);
 *   `rawDt` is the same interval unclamped (frame-time judging: AutoQuality).
 * - While the tab is hidden the loop stops requesting frames; when it comes
 *   back the first dt is small (no giant catch-up step).
 * - `substep(dt, 1/60, step)` splits a frame into equal stable sub-steps.
 */
export class Loop {
  maxDt = 1 / 20;
  running = false;
  /** Called with true when the page becomes hidden (or the window blurs), false when visible again. */
  onVisibility: ((hidden: boolean) => void) | null = null;
  /** Milliseconds the last frame callback took (CPU time). */
  frameMs = 0;
  /** Real seconds since the previous frame, NOT clamped to maxDt (1/60 on the first frame after a start / resume). */
  rawDt = 1 / 60;

  private raf = 0;
  private last = -1;
  private hidden = false;

  constructor(private readonly frame: (dt: number, now: number) => void) {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVis);
      window.addEventListener("blur", this.onBlur);
      window.addEventListener("focus", this.onFocus);
      window.addEventListener("pagehide", this.onBlur);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    if (!this.hidden) this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("pagehide", this.onBlur);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    let dt = this.last < 0 ? 1 / 60 : (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 1 / 240;
    this.rawDt = dt;
    if (dt > this.maxDt) dt = this.maxDt;
    const t0 = performance.now();
    this.frame(dt, now / 1000);
    this.frameMs = performance.now() - t0;
  };

  private onVis = (): void => {
    const hidden = document.visibilityState === "hidden";
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (this.running) {
      this.last = -1;
      this.raf = requestAnimationFrame(this.tick);
    }
    this.onVisibility?.(hidden);
  };

  private onBlur = (): void => {
    this.onVisibility?.(true);
  };
  private onFocus = (): void => {
    if (!this.hidden) this.onVisibility?.(false);
  };
}

/**
 * Split `dt` into n equal steps of at most `maxStep` and call `step(h, i, n)`.
 * Returns the number of steps taken.
 */
export function substep(dt: number, maxStep: number, step: (h: number, i: number, n: number) => void): number {
  if (dt <= 0) return 0;
  const n = Math.max(1, Math.ceil(dt / maxStep - 1e-6));
  const h = dt / n;
  for (let i = 0; i < n; i++) step(h, i, n);
  return n;
}
