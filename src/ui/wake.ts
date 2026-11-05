/**
 * Screen Wake Lock for runs: a controller / keyboard player never touches the
 * screen, and reading level-up cards takes a while, so the display must not
 * dim mid-run. The browser drops the lock whenever the page is hidden: call
 * acquire() again when it becomes visible. Every call is a no-op where the API
 * is missing or refused (insecure context, low battery, iOS < 16.4).
 */
export class ScreenWake {
  private sentinel: WakeLockSentinel | null = null;
  private pending = false;
  private wanted = false;
  /** Requests made (debug / tests). */
  requests = 0;

  acquire(): void {
    this.wanted = true;
    if (this.pending || (this.sentinel && !this.sentinel.released)) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const wl = typeof navigator !== "undefined" ? (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock : undefined;
    if (!wl || typeof wl.request !== "function") return;
    this.pending = true;
    this.requests++;
    try {
      wl.request("screen").then(
        (s) => {
          this.pending = false;
          if (!this.wanted) {
            s.release().catch(() => {});
            return;
          }
          this.sentinel = s;
        },
        () => {
          this.pending = false;
        },
      );
    } catch {
      this.pending = false;
    }
  }

  release(): void {
    this.wanted = false;
    const s = this.sentinel;
    this.sentinel = null;
    if (s && !s.released) s.release().catch(() => {});
  }
}
