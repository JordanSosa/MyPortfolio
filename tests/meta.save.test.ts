/**
 * Save v2 storage boundary (src/ui/save.ts) against an in-memory
 * localStorage: fresh boot, v1 migration (once), corrupt / garbage v2 blobs,
 * broken storage, export / import, the v1-shaped view the pre-hub screens use,
 * and banking a run; QA2 batch B: the run-in-progress stash (banked once at
 * boot, skipped while another window holds the live-run lock), the revision
 * guard between windows, failed writes (writeOk, the backup freed on a full
 * storage) and the one-time welcome gift.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { simulate } from "../src/debug/bot";
import { World } from "../src/game/world";
import { BACKUP_KEY, CORRUPT_KEY, LEGACY_SAVE_KEY, MIGRATED_KEY, PENDING_KEY, REV_KEY, RUN_LOCK, SAVE_KEY, SaveStore } from "../src/ui/save";
import { encodeSaveString } from "../src/meta/transfer";
import { TUNING } from "../src/meta/tuning";

class MemStorage {
  map = new Map<string, string>();
  throwOn: "none" | "get" | "set" = "none";
  getItem(k: string): string | null {
    if (this.throwOn === "get") throw new Error("SecurityError");
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.throwOn === "set") throw new Error("QuotaExceededError");
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

let mem: MemStorage;
const g = globalThis as { localStorage?: unknown };

beforeEach(() => {
  mem = new MemStorage();
  g.localStorage = mem;
});
afterEach(() => {
  delete g.localStorage;
});

const stored = () => JSON.parse(mem.map.get(SAVE_KEY)!);

describe("boot", () => {
  test("fresh: a valid profile is created and written; start content unlocked", () => {
    const s = new SaveStore();
    expect(s.origin).toBe("fresh");
    expect(s.migration).toBeNull();
    expect(stored().version).toBe(2);
    expect(s.profile.unlocks.weapons).toContain("star_shot");
    expect(s.bootUnlocks).toEqual([]); // start content is unlocked silently
    const again = new SaveStore();
    expect(again.origin).toBe("v2");
    expect(again.bootUnlocks).toEqual([]);
  });

  test("v1 is migrated once (gift + refund), the v1 key is kept as a backup", () => {
    const v1 = { coins: 50, meta: { might: 1, vitality: 2 }, settings: { master: 0.4, music: 0.5, sfx: 0.6, shake: 0, reduceFlashing: true, damageNumbers: true, quality: "high", haptics: true, showFps: false }, best: { time: 300, kills: 900, level: 20, combo: 90 }, runs: 4, wins: 0, lastHero: "mochi", totalKills: 2000, tut: { dash: true, ult: 1 } };
    mem.map.set(LEGACY_SAVE_KEY, JSON.stringify(v1));
    const s = new SaveStore();
    expect(s.origin).toBe("migrated");
    expect(s.migration).toEqual({ refund: 60 + 50 + 80, gift: TUNING.migration.welcomeGems, heroes: ["rin", "mochi"] });
    expect(s.profile.currencies.coins).toBe(50 + 190);
    expect(s.profile.currencies.gems).toBeGreaterThanOrEqual(TUNING.migration.welcomeGems);
    expect(s.profile.settings.quality).toBe("high");
    expect(s.profile.loadout.hero).toBe("mochi");
    expect(mem.map.has(LEGACY_SAVE_KEY)).toBe(true);
    const again = new SaveStore();
    expect(again.origin).toBe("v2");
    expect(again.migration).toBeNull();
    expect(again.profile.currencies).toEqual(s.profile.currencies);
  });

  test("an unreadable v2 is kept aside and the game still boots (from v1 when present)", () => {
    mem.map.set(SAVE_KEY, "{not json!!");
    mem.map.set(LEGACY_SAVE_KEY, JSON.stringify({ coins: 10, runs: 1 }));
    const s = new SaveStore();
    expect(s.origin).toBe("recovered");
    expect(mem.map.get(CORRUPT_KEY)).toBe("{not json!!");
    expect(s.profile.currencies.coins).toBe(10);
    expect(stored().version).toBe(2);
  });

  test("valid JSON that is not a profile object is set aside and v1 still migrates", () => {
    mem.map.set(SAVE_KEY, "[1,2,3]");
    mem.map.set(LEGACY_SAVE_KEY, JSON.stringify({ coins: 42 }));
    const s = new SaveStore();
    expect(s.origin).toBe("recovered");
    expect(mem.map.get(CORRUPT_KEY)).toBe("[1,2,3]");
    expect(s.profile.currencies.coins).toBe(42);
  });

  test.each([JSON.stringify([1, 2]), JSON.stringify("hi"), JSON.stringify({ currencies: { coins: -9 }, board: 7, gacha: { history: "x" } }), "null"])("garbage v2 %s is repaired, not fatal", (raw) => {
    mem.map.set(SAVE_KEY, raw);
    const s = new SaveStore();
    expect(s.profile.version).toBe(2);
    expect(s.profile.currencies.coins).toBe(0);
    expect(stored().version).toBe(2);
  });

  test("storage that throws never blocks boot or saving", () => {
    mem.throwOn = "get";
    expect(() => new SaveStore()).not.toThrow();
    mem.throwOn = "set";
    const s = new SaveStore();
    expect(s.save()).toBe(false);
    delete g.localStorage;
    expect(new SaveStore().profile.version).toBe(2);
  });
});

describe("export / import", () => {
  test("round trip into a fresh browser; the replaced profile is backed up", () => {
    const a = new SaveStore();
    a.profile.currencies.gems = 4321;
    a.profile.lifetime.runs = 9;
    a.save();
    const text = a.exportString();
    mem = new MemStorage();
    g.localStorage = mem;
    const b = new SaveStore();
    const r = b.importString(text);
    expect(r).toEqual({ ok: true, message: expect.any(String) });
    expect(b.profile.currencies.gems).toBe(4321);
    expect(b.profile.lifetime.runs).toBe(9);
    expect(stored().currencies.gems).toBe(4321);
    expect(mem.map.has(BACKUP_KEY)).toBe(true);
  });

  test("bad strings are rejected with a message and change nothing", () => {
    const s = new SaveStore();
    s.profile.currencies.coins = 77;
    for (const bad of ["", "lol", "KKO2.abc.12345678"]) {
      const r = s.importString(bad);
      expect(r.ok).toBe(false);
      expect(r.message.length).toBeGreaterThan(5);
    }
    expect(s.profile.currencies.coins).toBe(77);
    expect(s.importString(encodeSaveString({ hello: "world" }))).toMatchObject({ ok: false, error: "notProfile" });
    expect(s.importString(new SaveStore().exportString()).ok).toBe(true); // a real profile imports
  });
});

describe("v1-shaped view (pre-hub screens) + banking runs", () => {
  test("coins / meta / settings / bests / tutorial read and write the profile", () => {
    const s = new SaveStore();
    s.data.coins = 500;
    expect(s.profile.currencies.coins).toBe(500);
    s.data.coins -= 60;
    s.data.meta.might = 1;
    expect(s.data.meta.might).toBe(1);
    expect(s.profile.board.ranks.might_1).toBe(1);
    expect(s.profile.board.paid.might_1).toBe(60);
    expect(Object.keys(s.data.meta)).toEqual(["might"]);
    expect(() => {
      s.data.meta.not_a_shop_item = 3; // ignored, never a strict-mode TypeError
    }).not.toThrow();
    expect(s.data.meta.not_a_shop_item).toBeUndefined();
    expect(s.data.meta.vitality ?? 0).toBe(0);
    s.data.settings.master = 0.25;
    expect(s.profile.settings.master).toBe(0.25);
    s.data.lastHero = "rin";
    expect(s.profile.loadout.hero).toBe("rin");
    s.data.tut.dash = true;
    expect(s.profile.tutorial.dash).toBe(true);
    expect(s.data.runs).toBe(0);
    expect(s.data.best).toBe(s.profile.best);
  });

  test("recordRun banks a live World run and persists it", { tags: ["slow"] }, () => {
    const s = new SaveStore();
    const plan = s.runPlan();
    const w = new World({ hero: plan.hero, seed: 8, run: plan.config });
    simulate(w, 45);
    const report = s.recordRun(w.summary());
    expect(report.episode).toBe(1);
    expect(s.lastReport).toBe(report);
    expect(s.data.runs).toBe(1);
    expect(stored().lifetime.runs).toBe(1);
    expect(stored().currencies.coins).toBe(report.balances.coins);
    s.reset();
    expect(s.profile.lifetime.runs).toBe(0);
    expect(JSON.parse(mem.map.get(BACKUP_KEY)!).lifetime.runs).toBe(1);
  });
});

// ---------------------------------------------------------------- QA2 batch B: save safety

/** A live account run of `seconds`, its RunStats (as App.stashRun writes them). */
function liveStats(s: SaveStore, seconds = 40, seed = 8) {
  const plan = s.runPlan();
  const w = new World({ hero: plan.hero, seed, run: plan.config });
  simulate(w, seconds);
  return w.runStats();
}

describe("run in progress (kko.run.pending)", () => {
  test("a stash nobody banked is banked once at the next boot (as DROPPED), then forgotten", () => {
    const a = new SaveStore();
    const stats = liveStats(a);
    expect(a.stashRun(stats)).toBe(true);
    expect(JSON.parse(mem.map.get(PENDING_KEY)!).runsAtStart).toBe(0);
    // the tab dies; the next boot banks it
    const b = new SaveStore();
    expect(b.interrupted).not.toBeNull();
    expect(b.interrupted!.outcome).toBe("quit");
    expect(b.interrupted!.episode).toBe(1);
    expect(b.profile.lifetime.runs).toBe(1);
    expect(b.profile.lifetime.kills).toBeGreaterThan(0);
    expect(b.profile.currencies.coins).toBe(b.interrupted!.balances.coins);
    expect(b.profile.heroes.hoshi.xp).toBeGreaterThan(0);
    expect(stored().lifetime.runs).toBe(1);
    expect(mem.map.has(PENDING_KEY)).toBe(false);
    // ...exactly once
    const c = new SaveStore();
    expect(c.interrupted).toBeNull();
    expect(c.profile.lifetime.runs).toBe(1);
  });

  test("a stash of a death (TO BE CONTINUED with a revive left) banks as a death", () => {
    const a = new SaveStore();
    const stats = { ...liveStats(a), outcome: "dead" as const };
    a.stashRun(stats);
    const b = new SaveStore();
    expect(b.interrupted!.outcome).toBe("death");
    expect(b.profile.lifetime.deaths).toBe(1);
  });

  test("a stash whose runsAtStart no longer matches (the run was banked) is discarded", () => {
    const a = new SaveStore();
    const stats = liveStats(a);
    a.stashRun(stats);
    // Results banked it, then the window died before clearing the stash
    const plan = a.runPlan();
    const w = new World({ hero: plan.hero, seed: 8, run: plan.config });
    simulate(w, 40);
    a.recordRun(w.summary());
    expect(stored().lifetime.runs).toBe(1);
    const b = new SaveStore();
    expect(b.interrupted).toBeNull();
    expect(b.profile.lifetime.runs).toBe(1);
    expect(mem.map.has(PENDING_KEY)).toBe(false);
  });

  test("banking clears it: a normal run never banks twice", () => {
    const a = new SaveStore();
    const plan = a.runPlan();
    const w = new World({ hero: plan.hero, seed: 3, run: plan.config });
    simulate(w, 30);
    a.stashRun(w.runStats());
    a.recordRun(w.summary());
    a.clearStash();
    const b = new SaveStore();
    expect(b.interrupted).toBeNull();
    expect(b.profile.lifetime.runs).toBe(1);
  });

  test("an unreadable stash is dropped, never fatal", () => {
    mem.map.set(PENDING_KEY, "{oops");
    const s = new SaveStore();
    expect(s.interrupted).toBeNull();
    expect(mem.map.has(PENDING_KEY)).toBe(false);
  });

  test("while another window holds the live-run lock its stash is left alone; once it is gone, the stash banks", async () => {
    const a = new SaveStore();
    a.stashRun(liveStats(a));
    const nav = globalThis.navigator as unknown as Record<string, unknown>;
    let held = true;
    Object.defineProperty(nav, "locks", {
      configurable: true,
      value: { query: async () => ({ held: held ? [{ name: RUN_LOCK }] : [] }), request: async () => undefined },
    });
    try {
      const b = new SaveStore();
      await new Promise((r) => setTimeout(r, 0));
      expect(b.interrupted).toBeNull();
      expect(mem.map.has(PENDING_KEY)).toBe(true);
      expect(b.profile.lifetime.runs).toBe(0);
      held = false;
      const c = new SaveStore();
      let late = 0;
      c.onInterrupted = () => late++;
      await new Promise((r) => setTimeout(r, 0));
      expect(late).toBe(1);
      expect(c.interrupted!.episode).toBe(1);
      expect(stored().lifetime.runs).toBe(1);
    } finally {
      delete nav.locks;
    }
  });
});

describe("several windows (kko.save.v2.rev)", () => {
  test("every save bumps the revision", () => {
    const s = new SaveStore();
    const r0 = Number(mem.map.get(REV_KEY));
    s.save();
    expect(Number(mem.map.get(REV_KEY))).toBe(r0 + 1);
    expect(s.rev).toBe(r0 + 1);
  });

  test("a stale window never overwrites a newer save: it reloads it and reports the conflict", () => {
    const a = new SaveStore();
    const b = new SaveStore(); // a second tab, same storage
    a.profile.currencies.coins = 777;
    expect(a.save()).toBe(true);
    let changed = 0;
    b.onExternalChange = () => changed++;
    b.profile.loadout.hero = "hoshi";
    b.profile.currencies.coins = 1; // stale in-memory state
    expect(b.save()).toBe(false);
    expect(b.conflicted).toBe(true);
    expect(changed).toBe(1);
    expect(b.profile.currencies.coins).toBe(777);
    expect(stored().currencies.coins).toBe(777);
    // now in sync: its next save goes through
    b.profile.currencies.coins += 5;
    expect(b.save()).toBe(true);
    expect(stored().currencies.coins).toBe(782);
  });

  test("a 'storage' event from another window reloads the profile", () => {
    const a = new SaveStore();
    const b = new SaveStore();
    let changed = 0;
    b.onExternalChange = () => changed++;
    a.profile.currencies.gems = 4242;
    a.save();
    b.onStorage();
    expect(changed).toBe(1);
    expect(b.profile.currencies.gems).toBe(4242);
    b.onStorage(); // the second event of the same write (the revision key): nothing new
    expect(changed).toBe(1);
  });

  test("recordRun in a stale window banks INTO the newer profile (a run is never dropped)", { tags: ["slow"] }, () => {
    const a = new SaveStore();
    const b = new SaveStore();
    const plan = a.runPlan();
    const wa = new World({ hero: plan.hero, seed: 5, run: plan.config });
    simulate(wa, 40);
    a.recordRun(wa.summary());
    expect(stored().lifetime.runs).toBe(1);
    const coinsA = stored().currencies.coins;
    const wb = new World({ hero: plan.hero, seed: 6, run: plan.config });
    simulate(wb, 40);
    const rb = b.recordRun(wb.summary());
    expect(rb.episode).toBe(2);
    expect(stored().lifetime.runs).toBe(2);
    expect(stored().currencies.coins).toBe(coinsA + rb.coins.total);
  });

  test("reset / import are the player's choice: they win over a newer revision", () => {
    const a = new SaveStore();
    const b = new SaveStore();
    a.profile.currencies.coins = 50;
    a.save();
    b.reset();
    expect(stored().currencies.coins).toBe(0);
    expect(Number(mem.map.get(REV_KEY))).toBe(b.rev);
  });
});

describe("failed writes (storage full / blocked)", () => {
  test("writeOk goes false (one warning, onWriteFail) and back to true on the next good write", () => {
    const s = new SaveStore();
    let fail = 0;
    let ok = 0;
    s.onWriteFail = () => fail++;
    s.onWriteOk = () => ok++;
    mem.throwOn = "set";
    expect(s.save()).toBe(false);
    expect(s.save()).toBe(false);
    expect(s.writeOk).toBe(false);
    expect(fail).toBe(1);
    mem.throwOn = "none";
    expect(s.save()).toBe(true);
    expect(s.writeOk).toBe(true);
    expect(ok).toBe(1);
  });

  test("a full storage frees the reset / import backup and retries (never the damaged-save copy)", () => {
    const s = new SaveStore();
    mem.map.set(BACKUP_KEY, "x".repeat(5000));
    mem.map.set(CORRUPT_KEY, "{broken");
    const cap = [...mem.map.values()].reduce((n, v) => n + v.length, 0) + 200;
    const set = mem.setItem.bind(mem);
    mem.setItem = (k: string, v: string) => {
      const used = [...mem.map.entries()].reduce((n, [kk, vv]) => n + (kk === k ? 0 : vv.length), 0);
      if (used + v.length > cap) throw new Error("QuotaExceededError");
      set(k, v);
    };
    s.profile.lifetime.runs = 3;
    s.profile.flags.big = 1;
    (s.profile as unknown as { pad: string }).pad = "y".repeat(1500);
    expect(s.save()).toBe(true);
    expect(mem.map.has(BACKUP_KEY)).toBe(false);
    expect(mem.map.get(CORRUPT_KEY)).toBe("{broken");
    expect(stored().lifetime.runs).toBe(3);
  });

  test("blocked storage at boot: writeOk is false before the UI even looks", () => {
    mem.throwOn = "set";
    const s = new SaveStore();
    expect(s.writeOk).toBe(false);
  });
});

describe("unreadable save + v1 (no second welcome gift)", () => {
  const V1 = { coins: 120, meta: { might: 2 }, runs: 9, wins: 0, best: { time: 100, kills: 10, level: 5, combo: 10 }, lastHero: "hoshi", totalKills: 100, tut: { dash: true, ult: 1 } };

  test("the first migration pays the gift and writes the marker", () => {
    mem.map.set(LEGACY_SAVE_KEY, JSON.stringify(V1));
    const s = new SaveStore();
    expect(s.migration?.gift).toBe(TUNING.migration.welcomeGems);
    expect(s.profile.currencies.gems).toBeGreaterThanOrEqual(TUNING.migration.welcomeGems);
    expect(mem.map.has(MIGRATED_KEY)).toBe(true);
  });

  test("a damaged v2 with the marker re-migrates v1 WITHOUT the gift or the welcome; the damaged copy stays", () => {
    mem.map.set(LEGACY_SAVE_KEY, JSON.stringify(V1));
    mem.map.set(MIGRATED_KEY, "1");
    mem.map.set(SAVE_KEY, '{"version":2,"currencies":{"coins":123456');
    const s = new SaveStore();
    expect(s.origin).toBe("recovered");
    expect(s.recoveredFromV1).toBe(true);
    expect(s.migration).toBeNull();
    expect(s.profile.currencies.gems).toBe(0);
    expect(s.profile.currencies.coins).toBeGreaterThanOrEqual(120);
    expect(mem.map.get(CORRUPT_KEY)).toBe('{"version":2,"currencies":{"coins":123456');
    // later boots and a START OVER never delete it (only Settings -> DISCARD does)
    new SaveStore().reset();
    expect(mem.map.get(CORRUPT_KEY)).toBe('{"version":2,"currencies":{"coins":123456');
    s.discardCorruptCopy();
    expect(mem.map.has(CORRUPT_KEY)).toBe(false);
  });

  test("a damaged v2 over a v1 save means the gift was paid already, even without the marker (saves from before it)", () => {
    mem.map.set(LEGACY_SAVE_KEY, JSON.stringify(V1));
    mem.map.set(SAVE_KEY, "{nope");
    const s = new SaveStore();
    expect(s.migration).toBeNull();
    expect(s.profile.currencies.gems).toBe(0);
  });
});
