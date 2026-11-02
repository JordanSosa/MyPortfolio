/**
 * Persistent save (DESIGN §8.4): localStorage['kko.save.v1'] via core Store
 * (every access try/catch'd, merged over defaults). After loading, every
 * value is validated (`sanitizeSave`): a hand-edited, older/newer-build or
 * otherwise broken save can never stop the game from booting, and a repaired
 * save is written back.
 */
import { Store } from "../core/storage";
import { HEROES } from "../game/heroes";
import { META } from "../game/meta";
import type { RunSummary } from "../game/world";

export type QualityPref = "auto" | "low" | "mid" | "high";

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  /** 0 / 0.5 / 1 */
  shake: number;
  reduceFlashing: boolean;
  damageNumbers: boolean;
  quality: QualityPref;
  haptics: boolean;
  showFps: boolean;
}

export interface Best {
  time: number;
  kills: number;
  level: number;
  combo: number;
}

/** Onboarding progress (first runs only; app.ts). */
export interface Tutorial {
  /** The player has dashed at least once (the DASH bubble is done). */
  dash: boolean;
  /** How many times the "OVERDRIVE READY" bubble was shown (shown twice). */
  ult: number;
}

export interface SaveData {
  coins: number;
  meta: Record<string, number>;
  settings: Settings;
  best: Best;
  runs: number;
  wins: number;
  lastHero: string;
  totalKills: number;
  tut: Tutorial;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  master: 0.8,
  music: 0.7,
  sfx: 0.85,
  shake: 1,
  reduceFlashing: false,
  damageNumbers: true,
  quality: "auto",
  haptics: true,
  showFps: false,
});

export const DEFAULT_SAVE: SaveData = {
  coins: 0,
  meta: {},
  settings: { ...DEFAULT_SETTINGS },
  best: { time: 0, kills: 0, level: 0, combo: 0 },
  runs: 0,
  wins: 0,
  lastHero: "hoshi",
  totalKills: 0,
  tut: { dash: false, ult: 0 },
};

const QUALITY_PREFS: readonly string[] = ["auto", "low", "mid", "high"];
const SHAKE_STEPS = [0, 0.5, 1];

/** A finite number in [lo, hi] (NaN / Infinity / wrong type -> `def`). */
function num01(v: unknown, def: number, lo = 0, hi = 1): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
}
/** A finite, non-negative integer (negative / NaN / wrong type -> `def`). */
function count(v: unknown, def = 0): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
}
/** A finite, non-negative number (fractional run times stay fractional). */
function nonNeg(v: unknown, def = 0): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : def;
}

/**
 * Validate a loaded save in place: settings in range (quality one of the known
 * prefs, volumes 0..1, shake snapped to 0 / 0.5 / 1, booleans), meta ranks
 * integer-clamped to each upgrade's max rank (unknown ids dropped), counters and
 * bests finite non-negative, lastHero a known hero. Returns true if anything changed.
 */
export function sanitizeSave(d: SaveData): boolean {
  const before = JSON.stringify(d);
  const s = d.settings;
  s.quality = (QUALITY_PREFS.includes(s.quality as string) ? s.quality : DEFAULT_SETTINGS.quality) as QualityPref;
  s.master = num01(s.master, DEFAULT_SETTINGS.master);
  s.music = num01(s.music, DEFAULT_SETTINGS.music);
  s.sfx = num01(s.sfx, DEFAULT_SETTINGS.sfx);
  const sh = num01(s.shake, DEFAULT_SETTINGS.shake);
  let snap = SHAKE_STEPS[0];
  for (const v of SHAKE_STEPS) if (Math.abs(v - sh) < Math.abs(snap - sh)) snap = v;
  s.shake = snap;
  s.reduceFlashing = s.reduceFlashing === true;
  s.damageNumbers = s.damageNumbers !== false;
  s.haptics = s.haptics !== false;
  s.showFps = s.showFps === true;

  const meta: Record<string, number> = {};
  for (const m of META) {
    const r = count(d.meta?.[m.id]);
    if (r > 0) meta[m.id] = Math.min(m.maxRank, r);
  }
  d.meta = meta;
  d.coins = count(d.coins);
  d.runs = count(d.runs);
  d.wins = Math.min(d.runs, count(d.wins));
  d.totalKills = count(d.totalKills);
  const b = d.best;
  b.time = nonNeg(b.time);
  b.kills = count(b.kills);
  b.level = count(b.level);
  b.combo = count(b.combo);
  if (!HEROES.some((h) => h.id === d.lastHero)) d.lastHero = DEFAULT_SAVE.lastHero;
  d.tut.dash = d.tut.dash === true;
  d.tut.ult = count(d.tut.ult);
  return JSON.stringify(d) !== before;
}

export const save = new Store<SaveData>("save", 1, DEFAULT_SAVE);
if (sanitizeSave(save.data)) save.save();

/** Put every setting back to its default (boot recovery). */
export function resetSettings(): void {
  save.data.settings = { ...DEFAULT_SETTINGS };
  save.save();
}

export interface RunRecord {
  coinsEarned: number;
  newBest: { time: boolean; kills: boolean; level: boolean; combo: boolean };
}

/** Bank a finished run: coins, bests, counters. Returns what changed. */
export function recordRun(s: RunSummary): RunRecord {
  const d = save.data;
  const b = d.best;
  const newBest = {
    time: s.time > b.time + 0.5,
    kills: s.kills > b.kills,
    level: s.level > b.level,
    combo: s.maxCombo > b.combo,
  };
  if (newBest.time) b.time = s.time;
  if (newBest.kills) b.kills = s.kills;
  if (newBest.level) b.level = s.level;
  if (newBest.combo) b.combo = s.maxCombo;
  d.coins += s.coins;
  d.runs++;
  if (s.victory) d.wins++;
  d.totalKills += s.kills;
  save.save();
  return { coinsEarned: s.coins, newBest };
}
