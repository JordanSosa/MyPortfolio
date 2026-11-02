/**
 * Batch B regression tests: AutoQuality (refresh-relative stepping), the initial
 * tier guess, save validation (a broken save must never stop the boot) and the
 * compact number formatter.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { AutoQuality, guessTier, QUALITY, type QualityTier } from "../src/render/quality";
import { DEFAULT_SAVE, sanitizeSave, type SaveData } from "../src/ui/save";
import { fmtNum } from "../src/ui/dom";
import { META } from "../src/game/meta";

/** Feed `seconds` of identical frames; returns the tier after each 2 s window. */
function run(q: AutoQuality, seconds: number, frameMs: number, cpuMs: number): QualityTier[] {
  const tiers: QualityTier[] = [];
  const n = Math.round((seconds * 1000) / frameMs);
  for (let i = 0; i < n; i++) {
    q.sample(frameMs, cpuMs);
    if ((i + 1) % Math.round(2000 / frameMs) === 0) tiers.push(q.tier);
  }
  return tiers;
}

function auto(initial: QualityTier) {
  const changes: QualityTier[] = [];
  const q = new AutoQuality(initial, (t) => changes.push(t));
  return { q, changes };
}

describe("AutoQuality", () => {
  test("a 60 Hz device hitting every vsync with light CPU climbs low -> high within 30 s", () => {
    const { q, changes } = auto("low");
    run(q, 30, 1000 / 60, 4);
    expect(q.tier).toBe("high");
    expect(changes).toEqual(["mid", "high"]);
    expect(q.refreshMs).toBeCloseTo(1000 / 60, 1);
  });

  test("a 60 Hz device near its CPU budget (14 ms of 16.7) never climbs", () => {
    const { q, changes } = auto("low");
    run(q, 60, 1000 / 60, 14);
    expect(q.tier).toBe("low");
    expect(changes).toEqual([]);
  });

  test("a device stuck at 30 fps on a 60 Hz budget steps down", () => {
    const { q, changes } = auto("high");
    run(q, 12, 33.3, 12);
    expect(changes[0]).toBe("mid");
    run(q, 12, 33.3, 12);
    expect(q.tier).toBe("low");
  });

  test("CPU time above 0.75x refresh steps down even without missed frames", () => {
    const { q } = auto("high");
    run(q, 8, 1000 / 60, 13.5);
    expect(q.tier).toBe("mid");
  });

  test("a 120 Hz display is judged against its own 8.3 ms interval", () => {
    const fast = auto("low");
    run(fast.q, 30, 1000 / 120, 2);
    expect(fast.q.tier).toBe("high");
    expect(fast.q.refreshMs).toBeCloseTo(1000 / 120, 1);
    // ...and 7 ms of CPU per frame is too much there (0.84x of 8.3 ms)
    const busy = auto("high");
    run(busy.q, 8, 1000 / 120, 7);
    expect(busy.q.tier).toBe("mid");
  });

  test("more than 10 % missed frames in a window steps down", () => {
    const { q } = auto("high");
    // every 5th frame takes 2 vsyncs: 20 % missed, CPU light
    for (let i = 0, t = 0; t < 5000; i++) {
      const ms = i % 5 === 0 ? 33.4 : 16.7;
      q.sample(ms, 3);
      t += ms;
    }
    expect(q.tier).toBe("mid");
  });

  test("after a down-step, climbing back waits longer (hysteresis)", () => {
    const { q, changes } = auto("high");
    run(q, 6, 33.3, 12); // -> mid
    expect(q.tier).toBe("mid");
    const stepsBefore = changes.length;
    // smooth again: no climb in the next 18 s (cooldown 8 + 12 per down-step... and 8 s clean)
    run(q, 8, 1000 / 60, 3);
    expect(changes.length).toBe(stepsBefore);
    run(q, 30, 1000 / 60, 3);
    expect(q.tier).toBe("high");
  });

  test("disabled controller never changes tier", () => {
    const { q, changes } = auto("mid");
    q.enabled = false;
    run(q, 20, 40, 30);
    expect(changes).toEqual([]);
  });

  test("tiers: DPR caps keep phone screens crisp, enemy caps step down", () => {
    expect(QUALITY.low.dprCap).toBeGreaterThanOrEqual(2);
    expect(QUALITY.mid.dprCap).toBeGreaterThanOrEqual(QUALITY.low.dprCap);
    expect(QUALITY.high.dprCap).toBeGreaterThanOrEqual(QUALITY.mid.dprCap);
    expect(QUALITY.low.maxEnemies).toBeLessThan(QUALITY.mid.maxEnemies);
    expect(QUALITY.mid.maxEnemies).toBeLessThan(QUALITY.high.maxEnemies);
  });
});

describe("guessTier", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stubPointer = (coarse: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("coarse") ? coarse : false }));

  test("every touch device starts at mid (iOS hides its core count)", () => {
    stubPointer(true);
    vi.stubGlobal("navigator", { hardwareConcurrency: 2 });
    expect(guessTier()).toBe("mid");
  });
  test("desktops start at high", () => {
    stubPointer(false);
    expect(guessTier()).toBe("high");
  });
});

describe("sanitizeSave", () => {
  const fresh = (): SaveData => structuredClone(DEFAULT_SAVE);

  test("a valid default save is left untouched", () => {
    const d = fresh();
    expect(sanitizeSave(d)).toBe(false);
    expect(d).toEqual(DEFAULT_SAVE);
  });

  test("unknown quality falls back to auto; volumes are clamped; shake snaps", () => {
    const d = fresh();
    Object.assign(d.settings, { quality: "ultra", master: 40, music: -2, sfx: Number.NaN, shake: 0.7 });
    expect(sanitizeSave(d)).toBe(true);
    expect(d.settings.quality).toBe("auto");
    expect(d.settings.master).toBe(1);
    expect(d.settings.music).toBe(0);
    expect(d.settings.sfx).toBe(DEFAULT_SAVE.settings.sfx);
    expect(d.settings.shake).toBe(0.5);
  });

  test("booleans are coerced", () => {
    const d = fresh();
    (d.settings as unknown as Record<string, unknown>).reduceFlashing = "yes";
    (d.settings as unknown as Record<string, unknown>).haptics = 0;
    sanitizeSave(d);
    expect(d.settings.reduceFlashing).toBe(false);
    expect(d.settings.haptics).toBe(true);
  });

  test("meta ranks are integer-clamped to each upgrade's max; unknown ids dropped", () => {
    const d = fresh();
    const revive = META.find((m) => m.id === "revive");
    d.meta = { might: 99, vitality: 2.7, swiftness: -3, revive: 4, bogus: 3 };
    sanitizeSave(d);
    expect(d.meta.might).toBe(META.find((m) => m.id === "might")?.maxRank);
    expect(d.meta.vitality).toBe(2);
    expect(d.meta.swiftness).toBeUndefined();
    expect(d.meta.revive).toBe(revive?.maxRank);
    expect(d.meta.bogus).toBeUndefined();
  });

  test("counters and bests are finite non-negative integers; lastHero is a known hero", () => {
    const d = fresh();
    Object.assign(d, { coins: -50, runs: 3.9, wins: 7, totalKills: Number.POSITIVE_INFINITY, lastHero: "goku" });
    Object.assign(d.best, { time: -1, kills: 12.5, level: Number.NaN, combo: 40 });
    sanitizeSave(d);
    expect(d.coins).toBe(0);
    expect(d.runs).toBe(3);
    expect(d.wins).toBe(3);
    expect(d.totalKills).toBe(0);
    expect(d.lastHero).toBe("hoshi");
    expect(d.best).toEqual({ time: 0, kills: 12, level: 0, combo: 40 });
  });

  test("tutorial flags are coerced", () => {
    const d = fresh();
    (d.tut as unknown as Record<string, unknown>).dash = "1";
    d.tut.ult = -4;
    sanitizeSave(d);
    expect(d.tut).toEqual({ dash: false, ult: 0 });
  });
});

describe("fmtNum", () => {
  test.each([
    [0, "0"],
    [9999, "9999"],
    [9999.9, "9999"],
    [10000, "10.0K"],
    [12345, "12.3K"],
    [99949, "99.9K"],
    [99950, "100K"],
    [150000, "150K"],
    [999499, "999K"],
    [999500, "1.0M"],
    [2500000, "2.5M"],
    [9999999, "10M"],
    [50000000, "50M"],
  ])("fmtNum(%d) = %s", (n, s) => {
    expect(fmtNum(n)).toBe(s);
  });
});
