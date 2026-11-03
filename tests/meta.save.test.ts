/**
 * Save v2 storage boundary (src/ui/save.ts) against an in-memory
 * localStorage: fresh boot, v1 migration (once), corrupt / garbage v2 blobs,
 * broken storage, export / import, the v1-shaped view the pre-hub screens use,
 * and banking a run.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { simulate } from "../src/debug/bot";
import { World } from "../src/game/world";
import { BACKUP_KEY, CORRUPT_KEY, LEGACY_SAVE_KEY, SAVE_KEY, SaveStore } from "../src/ui/save";
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

  test("recordRun banks a live World run and persists it", () => {
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
