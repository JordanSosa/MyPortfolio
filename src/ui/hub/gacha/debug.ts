/**
 * Dev-only Merch Machine hooks (never in a production build: the page reads
 * them only under `import.meta.env.DEV`). From the console / Playwright:
 *
 *   __kkGacha.force("MYTHIC")          next pull: its last result is a MYTHIC
 *   __kkGacha.force("SSR", 0, "lose")  first result SSR and the 50/50 lost ("win" = won)
 *   __kkGacha.fakeout(true)            next SSR+ pull: the blue meteor fake-out
 *   __kkGacha.speed(0.05)              slow the pull's clock
 *   await __kkGacha.step(0.3)          frame-exact captures: with the clock frozen (speed(0)) and CDP
 *                                      Animation.setPlaybackRate(0), advance the pull's clock AND every
 *                                      CSS / WAAPI animation by 0.3 s in 40 ms steps
 *   __kkGacha.clear()
 *
 * "lose" / "win" swap the RNG for a constant (0.999 / 0.001), so the rest of
 * that pull is SR / SSR+ spam: fine for screenshots, not for statistics.
 */
import type { Rarity } from "../../../game/defs";
import { RARITIES } from "../../../game/defs";
import type { RandomSource } from "../../../meta/util";

export interface GachaDebug {
  force?: Rarity;
  at?: number;
  rng?: "lose" | "win";
  fakeout?: boolean;
}

let next: GachaDebug = {};
let speed = 1;
let stepper: ((dt: number) => void) | null = null;

/** The live pull registers its clock here (dev only). */
export function setDebugStepper(fn: ((dt: number) => void) | null): void {
  if (import.meta.env.DEV) stepper = fn;
}

/** Install `window.__kkGacha` (dev builds only). */
export function installGachaDebug(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  (window as unknown as { __kkGacha: unknown }).__kkGacha = {
    force(r: Rarity, at?: number, rng?: "lose" | "win") {
      if (!RARITIES.includes(r)) return `unknown rarity ${r}`;
      next = { ...next, force: r, at, rng };
      return next;
    },
    fakeout(on = true) {
      next = { ...next, fakeout: on };
      return next;
    },
    speed(x = 1) {
      speed = Number.isFinite(x) && x >= 0 ? Math.max(1e-6, x) : 1;
      return speed;
    },
    async step(sec: number, inc = 0.04) {
      const n = Math.max(1, Math.round(sec / inc));
      for (let i = 0; i < n; i++) {
        stepper?.(inc);
        for (const a of document.getAnimations()) {
          try {
            a.pause();
            a.currentTime = (Number(a.currentTime) || 0) + inc * 1000;
          } catch {
            /* finished / detached */
          }
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    },
    clear() {
      next = {};
      speed = 1;
    },
    get next() {
      return next;
    },
  };
}

/** Take (and clear) the pending debug request for one pull. */
export function takeDebug(): GachaDebug {
  if (!import.meta.env.DEV) return {};
  const d = next;
  next = {};
  return d;
}

export function debugRng(kind: "lose" | "win" | undefined): RandomSource | undefined {
  if (!kind) return undefined;
  const v = kind === "lose" ? 0.999 : 0.001;
  return { next: () => v } as RandomSource;
}

/** Clock multiplier of the pull sequence (1 outside dev builds). */
export function debugSpeed(): number {
  return import.meta.env.DEV ? speed : 1;
}
