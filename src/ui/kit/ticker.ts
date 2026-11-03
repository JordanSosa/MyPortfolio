/**
 * Frame ticker for UI animations that need numbers (count-ups, pan / zoom
 * inertia, bar fills that wait for a beat). App.frame calls `kitTick(dt)` once
 * per frame with the real frame time; a component registers itself with
 * `animate(obj)` while it has something to do and drops out by returning false
 * from `tick`. Nothing is allocated per frame: the list is iterated in place.
 *
 * Pure CSS / WAAPI juice (pops, shines, transitions) does not go through here.
 */
export interface Tickable {
  /** Advance by `dt` real seconds. Return false when finished (it is removed). */
  tick(dt: number): boolean;
}

const active: Tickable[] = [];

/** Start ticking `t` (no-op if it already is). */
export function animate(t: Tickable): void {
  if (active.indexOf(t) < 0) active.push(t);
}

/** Stop ticking `t` (component disposed). */
export function stopAnimating(t: Tickable): void {
  const i = active.indexOf(t);
  if (i >= 0) active.splice(i, 1);
}

/** Called by App.frame. */
export function kitTick(dt: number): void {
  for (let i = active.length - 1; i >= 0; i--) {
    const t = active[i];
    let keep = false;
    try {
      keep = t.tick(dt);
    } catch (e) {
      console.warn("[kit] animation failed", e);
    }
    // (the list may have changed during tick: find it again before removing)
    if (!keep) {
      const j = active.indexOf(t);
      if (j >= 0) active.splice(j, 1);
    }
  }
}

/** The user asked the OS for less motion: skip glides / count-ups (results jump to their end state). */
export function reducedMotion(): boolean {
  try {
    return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Ease-out cubic. */
export const easeOut = (k: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
