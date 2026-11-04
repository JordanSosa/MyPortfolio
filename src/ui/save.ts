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
 *                   1,600-gem "Welcome to Season 2" gift, paid ONCE: the first
 *                   migration writes kko.save.v1.migrated), else a fresh profile
 *   v2 unreadable / not an object -> the raw text is kept in kko.save.v2.corrupt
 *                   (never deleted by the game), then as above (a re-migration
 *                   after the marker / over a damaged v2 pays no second gift and
 *                   shows no second welcome)
 *   then reconcileProfile (content-aware repair + start / newly-met unlocks,
 *   kept in `save.bootUnlocks` for the hub to celebrate), a write-back if
 *   anything changed, and the interrupted-run stash (below). The v1 key is
 *   never deleted (it is the migration backup).
 *
 * Run in progress (`kko.run.pending`): App stashes the live RunStats of an
 * account run when the page hides / is left, every ~15 s of play and when TO
 * BE CONTINUED offers a revive; banking clears it. A stash found at boot whose
 * `runsAtStart` still equals the profile's run count was never banked (reload,
 * OS tab discard, app kill): it is banked as DROPPED (or the death it was) and
 * kept as `save.interrupted` for the hub notice. While a window plays an
 * account run it holds the shared Web Lock "kko.run.live": a window booting
 * meanwhile leaves that run's stash alone (the run is alive, only hidden).
 *
 * Several windows: every successful write bumps `kko.save.v2.rev`. A 'storage'
 * event from another window reloads `profile` (onExternalChange); a save() that
 * finds a newer rev it missed (a frozen tab) never overwrites it: it reloads
 * and returns false. recordRun re-applies the run to the reloaded profile, so a
 * banked run is never dropped.
 *
 * Failed writes (storage full / blocked): save() frees the reset / import
 * backup and retries once; `writeOk` + onWriteFail / onWriteOk let the UI warn
 * until a write succeeds again.
 *
 * UI-facing API (small on purpose):
 *   save.profile                      the live Profile (mutate via src/meta, then save.save())
 *   save.save() / save.reset()        persist / start over (settings kept, old profile backed up)
 *   save.runPlan(choice?)             buildRunConfig for the saved loadout -> { hero, config, issues }
 *   save.recordRun(summary)           applyRunToProfile + persist -> RunReport (also save.lastReport)
 *   save.stashRun(stats) / clearStash()   the run-in-progress stash (account runs only)
 *   save.pendingUnlocks / takePendingUnlocks()   unlocks still to celebrate (RETRY skipped Results)
 *   save.exportString() / importString(text)   settings screen save transfer
 *   save.data                         v1-shaped live view for the pre-hub screens (see LegacySaveView)
 *   recordRun(summary), resetSettings()        v1-compatible helpers used by the current screens
 *
 * `save.data.meta` exposes the old Dream Shop ranks mapped onto their board
 * nodes (src/meta/board LEGACY_SHOP_NODES) for the legacy `World({ meta })`
 * path. A World built from `save.runPlan().config` already contains those
 * nodes in its board mod: pass `meta` OR `run`, never both.
 */
import { loadRaw, loadText, removeKey, saveRaw, saveText } from "../core/storage";
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
import type { RunStats } from "../game/run-config";
import type { RunSummary } from "../game/world";

// v1 shapes and validator, kept for the migration and its regression tests
export { DEFAULT_SAVE_V1 as DEFAULT_SAVE, sanitizeSaveV1 as sanitizeSave, type SaveDataV1 as SaveData } from "../meta/legacy";
export { DEFAULT_SETTINGS, type QualityPref, type Settings } from "../meta/profile";

export const SAVE_KEY = "kko.save.v2";
export const LEGACY_SAVE_KEY = "kko.save.v1";
/** Raw text of an unreadable v2 save (never overwritten by a fresh one, never deleted by the game). */
export const CORRUPT_KEY = "kko.save.v2.corrupt";
/** The profile replaced by the last import / reset (one level of undo; the first thing freed when storage is full). */
export const BACKUP_KEY = "kko.save.v2.backup";
/** Write revision of SAVE_KEY (bumped by every successful save, in any window). */
export const REV_KEY = "kko.save.v2.rev";
/** The live RunStats of an account run not banked yet (see the file header). */
export const PENDING_KEY = "kko.run.pending";
/** Epoch ms of the first v1 migration (its welcome gift is paid once). */
export const MIGRATED_KEY = "kko.save.v1.migrated";
/** Shared Web Lock held by every window that is playing an account run. */
export const RUN_LOCK = "kko.run.live";

/** Where the profile came from at boot. */
export type SaveOrigin = "fresh" | "v2" | "migrated" | "recovered";

/** The stash of a run in progress. */
export interface PendingRun {
  v: 1;
  /** Epoch ms of the write. */
  at: number;
  /** profile.lifetime.runs when it was written (equal at boot = never banked). */
  runsAtStart: number;
  stats: RunStats;
}

/** Raw stored text: missing, parsed JSON, or present-but-unreadable. */
function readStored(key: string): { state: "missing" } | { state: "ok"; value: unknown; text: string } | { state: "corrupt"; text: string } {
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
    return isObj(value) ? { state: "ok", value, text } : { state: "corrupt", text };
  } catch {
    return { state: "corrupt", text };
  }
}

const readRev = (): number => {
  const n = Number(loadText(REV_KEY));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

function readPending(): PendingRun | null {
  const v = loadRaw(PENDING_KEY);
  if (!isObj(v) || v.v !== 1 || !isObj(v.stats) || typeof v.runsAtStart !== "number") return null;
  const st = v.stats as Partial<RunStats>;
  // (the minimum applyRunToProfile needs; everything else defaults inside the meta layer)
  if (typeof st.stage !== "string" || typeof st.hero !== "string" || typeof st.time !== "number") return null;
  return v as unknown as PendingRun;
}

interface LockManagerLike {
  query?: () => Promise<{ held?: { name?: string }[] }>;
  request?: (name: string, opts: { mode: "shared" | "exclusive" }, cb: () => Promise<void>) => Promise<unknown>;
}
const lockManager = (): LockManagerLike | null => {
  try {
    const l = (globalThis.navigator as (Navigator & { locks?: LockManagerLike }) | undefined)?.locks;
    return l && typeof l.query === "function" && typeof l.request === "function" ? l : null;
  } catch {
    return null;
  }
};

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
  /** Set when this boot migrated a v1 save for the first time (welcome screen: refund + gift). */
  migration: MigrationReport | null = null;
  /** This boot's profile came from the v1 save because the v2 one was unreadable (the recovery notice says so). */
  recoveredFromV1 = false;
  /** Content unlocked during boot reconciliation (new build content, start content). */
  bootUnlocks: UnlockEvent[] = [];
  /** Report of the last recordRun (results screen). */
  lastReport: RunReport | null = null;
  /** A run found stashed at boot and banked as DROPPED (the hub's "Episode N was interrupted" notice). */
  interrupted: RunReport | null = null;
  /** Unlocks from runs whose Episode Results never showed (TBC RETRY, interrupted runs): celebrated later. */
  pendingUnlocks: UnlockEvent[] = [];
  /** Write revision this window last loaded or wrote (see REV_KEY). */
  rev = 0;
  /** The last save() / write-back reached storage. */
  writeOk = true;
  /** The last save() refused to overwrite a newer save from another window (and reloaded it). */
  conflicted = false;
  /** Another window changed the save: `profile` was reloaded. */
  onExternalChange: (() => void) | null = null;
  /** A save() failed (storage full / blocked) after succeeding before (or at boot). */
  onWriteFail: (() => void) | null = null;
  /** A save() succeeded again after a failure. */
  onWriteOk: (() => void) | null = null;
  /** A stash left by a run in another, now closed, window was banked after boot (the lock check is async). */
  onInterrupted: ((r: RunReport) => void) | null = null;
  readonly data: LegacySaveView;
  /** JSON text of the profile as this window last wrote / read it (skips no-op storage events). */
  private lastText: string | null = null;
  private warned = false;
  private persistAsked = false;
  private lockRelease: (() => void) | null = null;

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
    if (key === SAVE_KEY && typeof window !== "undefined" && typeof window.addEventListener === "function")
      window.addEventListener("storage", (e) => {
        if (e.key === this.key || e.key === REV_KEY) this.onStorage();
      });
  }

  private load(): void {
    const stored = readStored(this.key);
    this.rev = readRev();
    let write = false;
    if (stored.state === "ok") {
      const r = sanitizeProfile(stored.value, now());
      this.profile = r.profile;
      this.origin = "v2";
      this.lastText = stored.text;
      write = r.repaired;
    } else {
      if (stored.state === "corrupt") {
        saveText(CORRUPT_KEY, stored.text);
        console.warn(`[save] ${this.key} was unreadable; kept a copy in ${CORRUPT_KEY}`);
      }
      const v1 = loadRaw(LEGACY_SAVE_KEY);
      if (v1 !== undefined) {
        const m = migrateV1(v1, now());
        this.profile = sanitizeProfile(m.profile, now()).profile;
        // a v2 save (now damaged) or the marker means this v1 save was migrated before: its gift was paid
        const again = stored.state === "corrupt" || loadText(MIGRATED_KEY) != null;
        if (again) {
          this.profile.currencies.gems = Math.max(0, this.profile.currencies.gems - m.report.gift);
          this.migration = null;
        } else {
          this.migration = m.report;
          saveText(MIGRATED_KEY, String(now()));
        }
        this.recoveredFromV1 = stored.state === "corrupt";
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
    this.resumeStash();
  }

  // ---------------------------------------------------------------- writing
  /**
   * Persist the profile. False if storage refused the write (the game keeps
   * running on the in-memory profile, `writeOk` turns false) or another window
   * saved a newer profile in the meantime (`conflicted`: it was reloaded instead).
   */
  save(): boolean {
    this.conflicted = false;
    const stored = readRev();
    if (stored > this.rev) {
      // a newer save from another window that this one never heard about (a frozen / suspended tab): adopt it
      if (this.adoptStored()) {
        this.conflicted = true;
        return false;
      }
      this.rev = stored;
    }
    return this.write();
  }

  /** Write the profile whatever the stored revision says (reset / import: the player chose this one). */
  private write(): boolean {
    const text = JSON.stringify(this.profile);
    let ok = saveText(this.key, text);
    // storage full: the reset / import backup is the one thing we can give up (never the damaged-save copy)
    if (!ok && loadText(BACKUP_KEY) != null) {
      removeKey(BACKUP_KEY);
      ok = saveText(this.key, text);
    }
    if (ok) {
      this.rev = Math.max(this.rev, readRev()) + 1;
      saveText(REV_KEY, String(this.rev));
      this.lastText = text;
    }
    this.writeState(ok);
    return ok;
  }

  private writeState(ok: boolean): void {
    if (ok === this.writeOk) return;
    this.writeOk = ok;
    if (!ok) {
      if (!this.warned) {
        this.warned = true;
        console.warn(`[save] could not write ${this.key} (storage full or blocked): progress lives in memory only`);
      }
      this.onWriteFail?.();
    } else this.onWriteOk?.();
  }

  /** Re-read the stored profile if another window changed it. True when `profile` was replaced. */
  private adoptStored(): boolean {
    const stored = readStored(this.key);
    const rev = readRev();
    if (stored.state !== "ok") return false;
    if (stored.text === this.lastText) {
      if (rev > this.rev) this.rev = rev;
      return false;
    }
    this.profile = sanitizeProfile(stored.value, now()).profile;
    try {
      reconcileProfile(this.profile);
    } catch {
      /* the other window reconciled it already */
    }
    this.lastText = stored.text;
    this.rev = Math.max(this.rev, rev);
    this.onExternalChange?.();
    return true;
  }

  /** A 'storage' event for the save (or its revision) from another window. */
  onStorage(): void {
    try {
      this.adoptStored();
    } catch (e) {
      console.warn("[save] could not reload the save changed in another window", e);
    }
  }

  /** Start over: a fresh profile with the current settings (the old one goes to BACKUP_KEY). */
  reset(): void {
    saveRaw(BACKUP_KEY, this.profile);
    const settings = { ...this.profile.settings };
    this.profile = defaultProfile(now());
    this.profile.settings = settings;
    this.bootUnlocks = reconcileProfile(this.profile).unlocks;
    this.lastReport = null;
    this.interrupted = null;
    this.pendingUnlocks = [];
    this.write();
  }

  /** RunConfig for the saved loadout (merged with `choice`). */
  runPlan(choice: LoadoutChoice = {}): RunPlan {
    return buildRunConfig(this.profile, choice);
  }

  /** Bank a finished run (payout, XP, mastery, records, unlocks, achievements) and persist. */
  recordRun(summary: RunSummary): RunReport {
    return this.bank(summary.stats ?? statsFromLegacySummary(summary, summary.stage));
  }

  /** applyRunToProfile + persist; a save from another window found on the way is adopted first, then the run re-applied to it. */
  private bank(stats: RunStats): RunReport {
    if (readRev() > this.rev) this.adoptStored();
    let report = applyRunToProfile(this.profile, { stats }, undefined, { now: now() });
    for (let i = 0; i < 2 && !this.save() && this.conflicted; i++) report = applyRunToProfile(this.profile, { stats }, undefined, { now: now() });
    this.lastReport = report;
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

  // ---------------------------------------------------------------- the run in progress
  /** Stash the live stats of an account run (banked at the next boot if this window dies first). */
  stashRun(stats: RunStats): boolean {
    const st: PendingRun = { v: 1, at: now(), runsAtStart: this.profile.lifetime.runs, stats };
    const text = JSON.stringify(st);
    let ok = saveText(PENDING_KEY, text);
    if (!ok && loadText(BACKUP_KEY) != null) {
      removeKey(BACKUP_KEY);
      ok = saveText(PENDING_KEY, text);
    }
    return ok;
  }

  clearStash(): void {
    removeKey(PENDING_KEY);
  }

  /** An account run is live in this window: hold RUN_LOCK (shared) until releaseRunLock(). */
  holdRunLock(): void {
    if (this.lockRelease) return;
    const locks = lockManager();
    if (!locks?.request) return;
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    this.lockRelease = release;
    try {
      void locks.request(RUN_LOCK, { mode: "shared" }, () => held).catch(() => {});
    } catch {
      /* no locks here: a booting window banks any stash it finds */
    }
  }

  releaseRunLock(): void {
    const r = this.lockRelease;
    this.lockRelease = null;
    r?.();
  }

  /** Boot: bank a stash nobody banked (unless a window still playing that run holds RUN_LOCK). */
  private resumeStash(): void {
    const st = readPending();
    if (!st) {
      if (loadText(PENDING_KEY) != null) removeKey(PENDING_KEY); // unreadable: nothing to bank
      return;
    }
    if (st.runsAtStart !== this.profile.lifetime.runs) {
      // banked already (Results / RETRY wrote the profile, then the window died before clearing it)
      removeKey(PENDING_KEY);
      return;
    }
    const locks = lockManager();
    if (!locks?.query) {
      this.bankStash(false);
      return;
    }
    locks.query().then(
      (q) => {
        if (!(q.held ?? []).some((l) => l.name === RUN_LOCK)) this.bankStash(true);
      },
      () => this.bankStash(true),
    );
  }

  private bankStash(late: boolean): void {
    const st = readPending();
    if (!st || st.runsAtStart !== this.profile.lifetime.runs) return;
    removeKey(PENDING_KEY);
    const stats: RunStats = { ...st.stats, outcome: st.stats.outcome === "dead" ? "dead" : "quit" };
    const keep = this.lastReport;
    let report: RunReport;
    try {
      report = this.bank(stats);
    } catch (e) {
      console.warn("[save] could not bank the interrupted run", e);
      return;
    }
    this.lastReport = keep;
    this.interrupted = report;
    for (const u of report.unlocks) if (!u.start) this.pendingUnlocks.push(u);
    if (late) this.onInterrupted?.(report);
  }

  /** Unlocks still to celebrate (and forget them). */
  takePendingUnlocks(): UnlockEvent[] {
    return this.pendingUnlocks.splice(0);
  }

  /**
   * Ask the browser to keep this origin's storage (no eviction under pressure). Once per profile, after its
   * first banked run; the answer is kept in profile.flags.persist (1 / 0).
   */
  requestPersist(): void {
    if (this.persistAsked || "persist" in this.profile.flags) return;
    this.persistAsked = true;
    try {
      const st = (globalThis.navigator as Navigator | undefined)?.storage;
      if (!st || typeof st.persist !== "function") return;
      st.persist().then(
        (ok) => {
          this.profile.flags.persist = ok ? 1 : 0;
          this.save();
        },
        () => {},
      );
    } catch {
      /* not offered here */
    }
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
    this.interrupted = null;
    this.pendingUnlocks = [];
    this.migration = null;
    this.write();
    return { ok: true, message: "Save imported. Welcome back!" };
  }

  /** The damaged-save copy, if one was kept (Settings -> SAVE DATA). */
  corruptCopy(): string | null {
    return loadText(CORRUPT_KEY);
  }

  /** Throw the damaged-save copy away (the player asked to, in Settings). */
  discardCorruptCopy(): void {
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
