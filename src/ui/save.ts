/**
 * Persistent save (DESIGN §8.4): localStorage['kko.save.v1'] via core Store
 * (every access try/catch'd, merged over defaults).
 */
import { Store } from "../core/storage";
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

export interface SaveData {
  coins: number;
  meta: Record<string, number>;
  settings: Settings;
  best: Best;
  runs: number;
  wins: number;
  lastHero: string;
  totalKills: number;
}

export const DEFAULT_SAVE: SaveData = {
  coins: 0,
  meta: {},
  settings: {
    master: 0.8,
    music: 0.7,
    sfx: 0.85,
    shake: 1,
    reduceFlashing: false,
    damageNumbers: true,
    quality: "auto",
    haptics: true,
    showFps: false,
  },
  best: { time: 0, kills: 0, level: 0, combo: 0 },
  runs: 0,
  wins: 0,
  lastHero: "hoshi",
  totalKills: 0,
};

export const save = new Store<SaveData>("save", 1, DEFAULT_SAVE);

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
