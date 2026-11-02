/**
 * Debug URL params (DESIGN §8.5):
 *   ?autoplay=1        bot plays + auto-picks upgrades
 *   ?seed=N            deterministic run
 *   ?hero=hoshi|rin|mochi
 *   ?skip=SECONDS      fast-forward the sim headlessly at run start (bot-driven)
 *   ?god=1             invulnerable
 *   ?mute=1            no audio
 *   ?quality=low|mid|high
 *   ?screen=title|select|game|results|shop|settings   jump straight to a screen (skips the splash)
 *   ?fps=1             FPS meter
 *   ?speed=N           sim speed multiplier
 */
import type { QualityTier } from "../render/quality";

export interface DebugParams {
  autoplay: boolean;
  seed: number | null;
  hero: string | null;
  skip: number;
  god: boolean;
  mute: boolean;
  quality: QualityTier | null;
  screen: string | null;
  fps: boolean;
  speed: number;
}

export function readParams(search = typeof location !== "undefined" ? location.search : ""): DebugParams {
  const q = new URLSearchParams(search);
  const num = (k: string, d: number) => {
    const v = Number(q.get(k));
    return q.has(k) && Number.isFinite(v) ? v : d;
  };
  const ql = q.get("quality");
  return {
    autoplay: q.get("autoplay") === "1",
    seed: q.has("seed") ? num("seed", 0) >>> 0 : null,
    hero: q.get("hero"),
    skip: Math.max(0, num("skip", 0)),
    god: q.get("god") === "1",
    mute: q.get("mute") === "1",
    quality: ql === "low" || ql === "mid" || ql === "high" ? ql : null,
    screen: q.get("screen"),
    fps: q.get("fps") === "1",
    speed: Math.max(0.1, num("speed", 1)),
  };
}
