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
 *
 * Season 2 run config (debugRunConfig; any of these builds a RunConfig on top of defaultRunConfig()):
 *   ?stage=dream_meadow                 stage id
 *   ?endless=1                          Filler Arc after the final boss
 *   ?twists=budget_cuts:2,spoilers      Plot Twists (id[:rank])
 *   ?relics=glowstick_bundle:3,...      equipped relics (id[:stars])
 *   ?talents=hoshi_idol_5,hoshi_star_1:5   talent ranks (id[:rank])
 *   ?cons=6                             hero constellation
 *   ?flags=banish:3,skip:2,dashCharges:2   RunConfig.flags (key[:value])
 *   ?lb=star_shot:2                     weapon Limit Break levels (id[:levels])
 *   ?startLevel=5  ?slots=7,7           start level, weapon / passive slots
 */
import { defaultRunConfig, type RunConfig } from "../game/run-config";
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
  /** Raw query (Season 2 run-config params, see debugRunConfig). */
  query: string;
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
    query: search,
  };
}

/** "a:2,b" -> { a: 2, b: dflt } (bad numbers fall back to dflt). */
function idList(v: string | null, dflt: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v) return out;
  for (const part of v.split(",")) {
    const [id, n] = part.split(":");
    const k = id?.trim();
    if (!k) continue;
    const x = Number(n);
    out[k] = n !== undefined && Number.isFinite(x) ? x : dflt;
  }
  return out;
}

/** Keys that make a URL describe a Season 2 run config. */
const RUN_KEYS = ["stage", "endless", "twists", "relics", "talents", "cons", "flags", "lb", "startLevel", "slots"];

/**
 * A RunConfig from the Season 2 debug params (`?stage=...&endless=1&relics=...`),
 * or undefined when the URL has none of them (the game then uses its default
 * / the account loadout).
 */
export function debugRunConfig(p: DebugParams): RunConfig | undefined {
  const q = new URLSearchParams(p.query);
  if (!RUN_KEYS.some((k) => q.has(k))) return undefined;
  const run = defaultRunConfig();
  const stage = q.get("stage");
  if (stage) run.stage = stage;
  run.endless = q.get("endless") === "1";
  const tw = idList(q.get("twists"), 1);
  run.twists = Object.keys(tw);
  run.twistRanks = tw;
  const rl = idList(q.get("relics"), 0);
  run.relics = Object.keys(rl).map((id) => ({ id, stars: rl[id] }));
  run.talents = idList(q.get("talents"), 1);
  run.constellation = Math.max(0, Math.min(6, Number(q.get("cons")) || 0));
  run.flags = idList(q.get("flags"), 1);
  const lb = idList(q.get("lb"), 1);
  if (Object.keys(lb).length) run.weaponLevelBonus = lb;
  const sl = Number(q.get("startLevel"));
  if (Number.isFinite(sl) && sl > 1) run.start = { level: Math.floor(sl), weapons: [] };
  const slots = (q.get("slots") ?? "").split(",").map(Number);
  if (slots[0] > 0) run.weaponSlots = slots[0];
  if (slots[1] > 0) run.passiveSlots = slots[1];
  return run;
}
