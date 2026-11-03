/**
 * Persistent save v2 (docs/EXPANSION.md §14): `localStorage['kko.save.v2']`
 * holds the account Profile (src/meta/profile.ts). This file is the ONLY
 * storage boundary of the game; everything else works on `save.profile` with
 * the pure src/meta functions and calls `save.save()` afterwards.
 *
 * Boot (never blocks, whatever is stored):
 *   v2 present   -> sanitizeProfile (every field repaired on its own)
 *   v2 missing   -> migrate kko.save.v1 if present (coins, settings, bests and run
 *                   counts kept; old Dream Shop refunded; Rin + Mochi unlocked;
 *                   1,600-gem "Welcome to Season 2" gift), else a fresh profile
 *   v2 unreadable / not an object -> the raw text is kept in kko.save.v2.corrupt, then as above
 *   then reconcileProfile (content-aware repair + start / newly-met unlocks,
 *   kept in `save.bootUnlocks` for the hub to celebrate) and a write-back if
 *   anything changed. The v1 key is never deleted (it is the migration backup).
 *
 * UI-facing API (small on purpose):
 *   save.profile                      the live Profile (mutate via src/meta, then save.save())
 *   save.save() / save.reset()        persist / start over (settings kept, old profile backed up)
 *   save.runPlan(choice?)             buildRunConfig for the saved loadout -> { hero, config, issues }
 *   save.recordRun(summary)           applyRunToProfile + persist -> RunReport (also save.lastReport)
 *   save.exportString() / importString(text)   settings screen save transfer
 *   save.data                         v1-shaped live view for the pre-hub screens (see LegacySaveView)
 *   recordRun(summary), resetSettings()        v1-compatible helpers used by the current screens
 *
 * `save.data.meta` exposes the old Dream Shop ranks mapped onto their board
 * nodes (src/meta/board LEGACY_SHOP_NODES) for the legacy `World({ meta })`
 * path. A World built from `save.runPlan().config` already contains those
 * nodes in its board mod: pass `meta` OR `run`, never both.
 */
import { loadRaw, removeKey, saveRaw } from "../core/storage";
import type { Best, Profile, Settings, Tutorial } from "../meta/profile";
import { DEFAULT_SETTINGS, defaultProfile, sanitizeProfile, sanitizeSettings } from "../meta/profile";
import { migrateV1, type MigrationReport } from "../meta/legacy";
import { reconcileProfile } from "../meta/reconcile";
import { applyRunToProfile, statsFromLegacySummary, type RunReport } from "../meta/rewards";
import { buildRunConfig, type LoadoutChoice, type RunPlan } from "../meta/loadout";
import { legacyShopRanks, legacyShopSet } from "../meta/board/board";
import { decodeSaveString, DECODE_ERROR_TEXT, encodeSaveString, type DecodeError } from "../meta/transfer";
import type { UnlockEvent } from "../meta/unlocks";
import { isObj } from "../meta/util";
import type { RunSummary } from "../game/world";

// v1 shapes and validator, kept for the migration and its regression tests
export { DEFAULT_SAVE_V1 as DEFAULT_SAVE, sanitizeSaveV1 as sanitizeSave, type SaveDataV1 as SaveData } from "../meta/legacy";
export { DEFAULT_SETTINGS, type QualityPref, type Settings } from "../meta/profile";

export const SAVE_KEY = "kko.save.v2";
export const LEGACY_SAVE_KEY = "kko.save.v1";
/** Raw text of an unreadable v2 save (never overwritten by a fresh one). */
export const CORRUPT_KEY = "kko.save.v2.corrupt";
/** The profile replaced by the last import / reset (one level of undo). */
export const BACKUP_KEY = "kko.save.v2.backup";

/** Where the profile came from at boot. */
export type SaveOrigin = "fresh" | "v2" | "migrated" | "recovered";

/** Raw stored text: missing, parsed JSON, or present-but-unreadable. */
function readStored(key: string): { state: "missing" } | { state: "ok"; value: unknown } | { state: "corrupt"; text: string } {
  let text: string | null = null;
  try {
    text = globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return { state: "missing" };
  }
  if (text == null) return { state: "missing" };
  try {
    const value: unknown = JSON.parse(text);
    // valid JSON that is not an object can't be a profile: treat it like damage (kept aside, v1 still migrates)
    return isObj(value) ? { state: "ok", value } : { state: "corrupt", text };
  } catch {
    return { state: "corrupt", text };
  }
}

function writeText(key: string, text: string): void {
  try {
    globalThis.localStorage?.setItem(key, text);
  } catch {
    /* storage full / disabled: the game keeps running on the in-memory profile */
  }
}

const now = () => Date.now();

/**
 * v1-shaped live view over the profile, for the screens written before the
 * hub (title, select, shop, results, settings, tutorial). Reads and writes go
 * straight to `save.profile`.
 */
export interface LegacySaveView {
  coins: number;
  /** Old Dream Shop ranks (id -> rank), backed by the matching board nodes. */
  readonly meta: Record<string, number>;
  settings: Settings;
  readonly best: Best;
  readonly runs: number;
  readonly wins: number;
  lastHero: string;
  readonly totalKills: number;
  readonly tut: Tutorial;
}

export interface ImportResult {
  ok: boolean;
  error?: DecodeError | "notProfile";
  message: string;
}

export class SaveStore {
  profile: Profile;
  origin: SaveOrigin = "fresh";
  /** Set when this boot migrated a v1 save (welcome screen: refund + gift). */
  migration: MigrationReport | null = null;
  /** Content unlocked during boot reconciliation (new build content, start content). */
  bootUnlocks: UnlockEvent[] = [];
  /** Report of the last recordRun (results screen). */
  lastReport: RunReport | null = null;
  readonly data: LegacySaveView;

  constructor(private readonly key = SAVE_KEY) {
    this.profile = defaultProfile(now());
    try {
      this.load();
    } catch (e) {
      console.warn("[save] load failed, starting fresh", e);
      this.profile = defaultProfile(now());
      this.origin = "fresh";
    }
    this.data = this.legacyView();
  }

  private load(): void {
    const stored = readStored(this.key);
    let write = false;
    if (stored.state === "ok") {
      const r = sanitizeProfile(stored.value, now());
      this.profile = r.profile;
      this.origin = "v2";
      write = r.repaired;
    } else {
      if (stored.state === "corrupt") {
        writeText(CORRUPT_KEY, stored.text);
        console.warn(`[save] ${this.key} was unreadable; kept a copy in ${CORRUPT_KEY}`);
      }
      const v1 = loadRaw(LEGACY_SAVE_KEY);
      if (v1 !== undefined) {
        const m = migrateV1(v1, now());
        this.profile = sanitizeProfile(m.profile, now()).profile;
        this.migration = m.report;
        this.origin = stored.state === "corrupt" ? "recovered" : "migrated";
      } else {
        this.profile = defaultProfile(now());
        this.origin = stored.state === "corrupt" ? "recovered" : "fresh";
      }
      write = true;
    }
    const before = JSON.stringify(this.profile);
    try {
      this.bootUnlocks = reconcileProfile(this.profile).unlocks;
    } catch (e) {
      console.warn("[save] reconcile failed", e);
    }
    if (write || JSON.stringify(this.profile) !== before) this.save();
  }

  /** Persist the profile. False if storage is unavailable (the game keeps running). */
  save(): boolean {
    return saveRaw(this.key, this.profile);
  }

  /** Start over: a fresh profile with the current settings (the old one goes to BACKUP_KEY). */
  reset(): void {
    saveRaw(BACKUP_KEY, this.profile);
    const settings = { ...this.profile.settings };
    this.profile = defaultProfile(now());
    this.profile.settings = settings;
    this.bootUnlocks = reconcileProfile(this.profile).unlocks;
    this.lastReport = null;
    this.save();
  }

  /** RunConfig for the saved loadout (merged with `choice`). */
  runPlan(choice: LoadoutChoice = {}): RunPlan {
    return buildRunConfig(this.profile, choice);
  }

  /** Bank a finished run (payout, XP, mastery, records, unlocks, achievements) and persist. */
  recordRun(summary: RunSummary): RunReport {
    const stats = summary.stats ?? statsFromLegacySummary(summary, summary.stage);
    const report = applyRunToProfile(this.profile, { stats }, undefined, { now: now() });
    this.lastReport = report;
    this.save();
    return report;
  }

  /**
   * What a run WOULD pay, computed on a throwaway copy of the profile: debug /
   * deep-link runs (`?autoplay`, `?screen=game`, `?god` ...) play with every
   * pool open and must never bank into the account. Nothing is stored.
   */
  previewRun(summary: RunSummary): RunReport {
    const stats = summary.stats ?? statsFromLegacySummary(summary, summary.stage);
    const copy = JSON.parse(JSON.stringify(this.profile)) as Profile;
    return applyRunToProfile(copy, { stats }, undefined, { now: now() });
  }

  /** Base64 save string (settings "export"). */
  exportString(): string {
    return encodeSaveString(this.profile);
  }

  /** Replace the profile with an exported string. The previous profile goes to BACKUP_KEY. */
  importString(text: string): ImportResult {
    const d = decodeSaveString(text);
    if (!d.ok) return { ok: false, error: d.error, message: DECODE_ERROR_TEXT[d.error] };
    if (typeof d.data.version !== "number" || !isObj(d.data.currencies)) return { ok: false, error: "notProfile", message: "That save string isn't a Kira Kira profile." };
    saveRaw(BACKUP_KEY, this.profile);
    this.profile = sanitizeProfile(d.data, now()).profile;
    this.bootUnlocks = reconcileProfile(this.profile).unlocks;
    this.lastReport = null;
    this.migration = null;
    this.save();
    return { ok: true, message: "Save imported. Welcome back!" };
  }

  /** Drop the corrupt-save copy once the player has seen the recovery notice. */
  clearCorruptCopy(): void {
    removeKey(CORRUPT_KEY);
  }

  private legacyView(): LegacySaveView {
    const store = this;
    const metaProxy = new Proxy({} as Record<string, number>, {
      get: (_t, k) => (typeof k === "string" ? legacyShopRanks(store.profile)[k] : undefined),
      // a Proxy trap returning false throws in strict mode: unknown ids are ignored, never fatal
      set: (_t, k, v) => {
        if (typeof k === "string") legacyShopSet(store.profile, k, Number(v));
        return true;
      },
      has: (_t, k) => typeof k === "string" && k in legacyShopRanks(store.profile),
      ownKeys: () => Object.keys(legacyShopRanks(store.profile)),
      getOwnPropertyDescriptor: (_t, k) => {
        const v = typeof k === "string" ? legacyShopRanks(store.profile)[k] : undefined;
        return v === undefined ? undefined : { value: v, writable: true, enumerable: true, configurable: true };
      },
      deleteProperty: (_t, k) => {
        if (typeof k === "string") legacyShopSet(store.profile, k, 0);
        return true;
      },
    });
    return {
      get coins() {
        return store.profile.currencies.coins;
      },
      set coins(v: number) {
        store.profile.currencies.coins = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : store.profile.currencies.coins;
      },
      get meta() {
        return metaProxy;
      },
      get settings() {
        return store.profile.settings;
      },
      set settings(v: Settings) {
        store.profile.settings = sanitizeSettings(v);
      },
      get best() {
        return store.profile.best;
      },
      get runs() {
        return store.profile.lifetime.runs;
      },
      get wins() {
        return store.profile.lifetime.clears;
      },
      get lastHero() {
        return store.profile.loadout.hero;
      },
      set lastHero(v: string) {
        if (typeof v === "string" && /^[A-Za-z0-9_]{1,64}$/.test(v)) store.profile.loadout.hero = v;
      },
      get totalKills() {
        return store.profile.lifetime.kills;
      },
      get tut() {
        return store.profile.tutorial;
      },
    };
  }
}

export const save = new SaveStore();

/** Put every setting back to its default (boot recovery). */
export function resetSettings(): void {
  save.profile.settings = { ...DEFAULT_SETTINGS };
  save.save();
}

/** v1-compatible result of banking a run (current results / game-over screens). */
export interface RunRecord {
  /** Every coin the run paid (pickups + the payout bonuses). */
  coinsEarned: number;
  newBest: { time: boolean; kills: boolean; level: boolean; combo: boolean };
  report: RunReport;
}

/**
 * Bank a finished run (see SaveStore.recordRun). For the v1 screens, which
 * show `summary.coins` as the run's earnings, the summary's `coins` becomes
 * the whole payout (pickups + Episode Results bonuses); `summary.stats.coins`
 * keeps the coins picked up.
 */
export function recordRun(s: RunSummary): RunRecord {
  const report = save.recordRun(s);
  s.coins = report.coins.total;
  return { coinsEarned: report.coins.total, newBest: report.newBest, report };
}

export function exportSave(): string {
  return save.exportString();
}

export function importSave(text: string): ImportResult {
  return save.importString(text);
}
