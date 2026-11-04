/**
 * Profile model: defaults, the field-by-field sanitiser (corrupt data must
 * never block boot), content-aware reconcile, v1 -> v2 migration (incl.
 * corrupted v1 blobs) and the export / import save string.
 */
import { describe, expect, test } from "vitest";
import { Rng } from "../src/core/rng";
import { migrateV1, oldShopCost, oldShopSpent, readV1 } from "../src/meta/legacy";
import { cloneProfile, defaultProfile, sanitizeProfile, type Profile } from "../src/meta/profile";
import { reconcileProfile } from "../src/meta/reconcile";
import { base64Decode, base64Encode, crc32, decodeSaveString, encodeSaveString, utf8Decode, utf8Encode } from "../src/meta/transfer";
import { TUNING } from "../src/meta/tuning";
import { fixtureContent, freshProfile } from "./meta.fixtures";

const ctx = fixtureContent();

/** Structural validity: every number finite, every list an array, no prototype keys. */
function assertValid(p: Profile): void {
  const walk = (v: unknown, path: string) => {
    if (typeof v === "number") expect(Number.isFinite(v), `${path} finite`).toBe(true);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") {
      expect(Object.getPrototypeOf(v), `${path} plain`).toBe(Object.prototype);
      for (const k of Object.keys(v)) {
        expect(["__proto__", "constructor", "prototype"]).not.toContain(k);
        walk((v as Record<string, unknown>)[k], `${path}.${k}`);
      }
    }
  };
  walk(p, "p");
  expect(p.version).toBe(2);
  expect(p.currencies.coins).toBeGreaterThanOrEqual(0);
  expect(p.currencies.gems).toBeGreaterThanOrEqual(0);
  expect(p.unlocks.heroes).toContain("hoshi");
  expect(p.unlocks.stages).toContain("dream_meadow");
  expect(p.gacha.history.length).toBeLessThanOrEqual(TUNING.gacha.historySize);
  for (const h of p.unlocks.heroes) expect(p.heroes[h]).toBeDefined();
  for (const s of Object.values(p.relics)) expect(s >= 0 && s <= 6).toBe(true);
}

describe("profile defaults + sanitiser", () => {
  test("a default profile is valid and left untouched", () => {
    const p = defaultProfile(0);
    assertValid(p);
    const r = sanitizeProfile(cloneProfile(p), 0);
    expect(r.repaired).toBe(false);
    expect(r.profile).toEqual(p);
  });

  test.each([null, undefined, 42, "save", [], [1, 2, 3], true, { version: "two" }, { currencies: "lol", gacha: 7 }])("garbage %j becomes a valid profile", (raw) => {
    const r = sanitizeProfile(raw, 0);
    assertValid(r.profile);
  });

  test("each field is repaired on its own", () => {
    const p = defaultProfile(0) as unknown as Record<string, any>;
    p.currencies = { coins: -50, gems: Number.NaN, copium: 1e30 };
    p.settings = { quality: "ultra", master: 40, music: -2, sfx: "loud", shake: 0.7, reduceFlashing: "yes", damageNumbers: 0, haptics: null, showFps: 1 };
    p.relics = { spoon: 9, fork: -3, "bad key!": 2, __proto__: 1 };
    p.mastery = { star_shot: 1.5e3, petal_slash: "lots" };
    p.gacha.banners.hero = { pity: -4, pityUR: 1e9, guaranteed: "yes", pulls: 3.7 };
    p.gacha.history = Array.from({ length: 250 }, (_, i) => ({ n: i, banner: i % 2 ? "hero" : "nope", kind: "relic", id: "spoon", rarity: i % 3 ? "SSR" : "OMEGA", result: "new" }));
    p.loadout = { stage: 7, hero: "<script>", relics: "all", twists: { budget_cuts: 99 }, endless: "y", startWeapon: 3 };
    p.titles = { owned: ["series_finale"], equipped: "god_emperor" };
    p.lifetime = { kills: -1, runs: 3, clears: 9, deaths: 9, killsByEnemy: { puff: 5.9, boo: -2 }, maxRank: 99 };
    const r = sanitizeProfile(p, 0);
    const q = r.profile;
    assertValid(q);
    expect(r.repaired).toBe(true);
    expect(q.currencies).toEqual({ coins: 0, gems: 0, copium: 1e15 });
    expect(q.settings).toMatchObject({ quality: "auto", master: 1, music: 0, shake: 0.5, reduceFlashing: false, damageNumbers: true, haptics: true, showFps: false });
    expect(q.relics).toEqual({ spoon: 6, fork: 0 });
    expect(q.mastery).toEqual({ star_shot: 1500 });
    expect(q.gacha.banners.hero).toEqual({ pity: 0, pityUR: 100000, guaranteed: false, pulls: 3 });
    expect(q.gacha.history.length).toBe(100);
    expect(q.gacha.history[0].n).toBe(150);
    expect(q.gacha.history.some((h) => h.banner === "permanent" && h.rarity === "N")).toBe(true);
    expect(q.loadout).toEqual({ stage: "dream_meadow", hero: "hoshi", relics: [], twists: { budget_cuts: 10 }, endless: false, startWeapon: null });
    expect(q.titles).toEqual({ owned: ["series_finale"], equipped: "" });
    expect(q.lifetime.kills).toBe(0);
    expect(q.lifetime.clears).toBe(3);
    expect(q.lifetime.killsByEnemy).toEqual({ puff: 5 });
    expect(q.lifetime.maxRank).toBe(64);
  });

  test("a sanitised profile is stable (idempotent)", () => {
    const r1 = sanitizeProfile({ currencies: { coins: 12.7 }, heroes: { hoshi: { xp: 99 } } }, 0);
    const r2 = sanitizeProfile(JSON.parse(JSON.stringify(r1.profile)), 0);
    expect(r2.repaired).toBe(false);
    expect(r2.profile).toEqual(r1.profile);
  });

  test("fuzz: random corruption of a lived-in profile never throws and always yields a valid, stable profile", { tags: ["slow"] }, () => {
    const rng = new Rng(1234);
    const base = freshProfile(ctx);
    base.currencies = { coins: 5000, gems: 3200, copium: 77 };
    base.board.ranks = { might_1: 3 };
    base.board.paid = { might_1: 120 };
    base.relics = { bent_spoon: 2 };
    base.records.dream_meadow = { runs: 4, clears: 1, bestTime: 600, bestHeat: 0, bestEndless: 0, bestKills: 3000, bestLevel: 50, bestCombo: 300, firstClear: 4 };
    const junk = [null, -1, 1e308, Number.NaN, "x", [], {}, true, { __proto__: { evil: 1 } }, [null, "a"], -0.5];
    for (let i = 0; i < 400; i++) {
      const p = JSON.parse(JSON.stringify(base)) as Record<string, any>;
      // corrupt 1-4 random paths
      for (let k = 0; k < 1 + rng.int(0, 3); k++) {
        let obj: any = p;
        const keys: string[] = [];
        while (obj && typeof obj === "object" && Object.keys(obj).length && rng.chance(0.7)) {
          const key = rng.pick(Object.keys(obj));
          keys.push(key);
          if (typeof obj[key] !== "object" || obj[key] === null) break;
          obj = obj[key];
        }
        if (!keys.length) continue;
        let parent: any = p;
        for (const key of keys.slice(0, -1)) parent = parent[key];
        if (parent && typeof parent === "object") parent[keys[keys.length - 1]] = rng.pick(junk);
      }
      const r = sanitizeProfile(p, 0);
      assertValid(r.profile);
      const again = sanitizeProfile(JSON.parse(JSON.stringify(r.profile)), 0);
      expect(again.repaired).toBe(false);
      expect(() => reconcileProfile(r.profile, ctx)).not.toThrow();
      assertValid(r.profile);
    }
  });
});

describe("reconcile (content-aware repair)", () => {
  test("unknown board nodes are refunded exactly; excess ranks clamped and refunded", () => {
    const p = freshProfile(ctx);
    p.board.ranks = { removed_node: 2, might_1: 9, episode_1: 1 };
    p.board.paid = { removed_node: 300, might_1: 5000 };
    p.board.active = ["glass_cannon", "might_1"];
    const r = reconcileProfile(p, ctx);
    expect(p.board.ranks).toEqual({ might_1: 5 });
    expect(r.boardRefund).toBeGreaterThan(300);
    expect(p.currencies.coins).toBe(r.boardRefund);
    expect(p.board.active).toEqual([]);
  });

  test("hero levels follow XP; talents fit the tree and the points", () => {
    const p = freshProfile(ctx);
    p.heroes.hoshi.xp = 500;
    p.heroes.hoshi.level = 30;
    p.heroes.hoshi.talents = { h0_1: 9, h0_5: 1, nonsense: 3 };
    const r = reconcileProfile(p, ctx);
    expect(p.heroes.hoshi.level).toBeLessThan(5);
    expect(p.heroes.hoshi.talents.nonsense).toBeUndefined();
    expect(p.heroes.hoshi.talents.h0_5).toBeUndefined();
    expect(Object.values(p.heroes.hoshi.talents).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(p.heroes.hoshi.level);
    expect(r.talentRepairs).toContain("hoshi");
  });

  test("the loadout always points at playable content; pity stays under its caps", () => {
    const p = freshProfile(ctx);
    p.loadout = { stage: "final_arc", hero: "truck_kun", relics: ["credit_card"], twists: { budget_cuts: 2 }, endless: true, startWeapon: "nope" };
    p.gacha.banners.permanent.pity = 400;
    p.gacha.banners.mythic.pityUR = 5000;
    reconcileProfile(p, ctx);
    expect(p.loadout).toEqual({ stage: "dream_meadow", hero: "hoshi", relics: [], twists: {}, endless: false, startWeapon: null });
    expect(p.gacha.banners.permanent.pity).toBe(TUNING.gacha.hardPity - 1);
    expect(p.gacha.banners.mythic.pityUR).toBe(TUNING.gacha.urPity - 1);
  });

  test("start content is unlocked silently; conditions already met are unlocked and reported", () => {
    const p = defaultProfile(0);
    const r = reconcileProfile(p, ctx);
    expect(p.unlocks.weapons).toEqual(expect.arrayContaining(["star_shot", "petal_slash", "yarn_orbit"]));
    expect(p.unlocks.weapons).not.toContain("dark_flame_dragon"); // Kuro's signature: locked with Kuro
    expect(p.unlocks.weapons).not.toContain("bubble_tea_cannon");
    expect(r.unlocks).toEqual([]);
    expect(p.codex.heroes).toContain("hoshi");
    // a profile whose counters already meet a rule (e.g. content added by a new build)
    p.lifetime.killsByEnemy.puff = 1500;
    expect(reconcileProfile(p, ctx).unlocks.map((u) => u.id)).toEqual(["bubble_tea_cannon"]);
  });
});

describe("save v1 -> v2 migration", () => {
  test("old Dream Shop prices are the frozen v1 formula", () => {
    expect([0, 1, 2, 3, 4].map((r) => oldShopCost(50, r))).toEqual([50, 80, 130, 205, 330]);
    expect(oldShopSpent({ might: 2, revive: 1, bogus: 5 })).toBe(60 + 95 + 400);
    expect(oldShopSpent({ might: 99 })).toBe([0, 1, 2, 3, 4].reduce((a, r) => a + oldShopCost(60, r), 0));
  });

  test("keeps coins / settings / bests / run counts, refunds the shop, unlocks Rin + Mochi, gifts a 10-pull", () => {
    const v1 = {
      coins: 120,
      meta: { might: 2, revive: 1, bogus: 5 },
      settings: { master: 0.3, music: 0.2, sfx: 0.9, shake: 0.5, reduceFlashing: true, damageNumbers: false, quality: "low", haptics: false, showFps: true },
      best: { time: 612.5, kills: 4100, level: 55, combo: 380 },
      runs: 7,
      wins: 2,
      lastHero: "rin",
      totalKills: 4321,
      tut: { dash: true, ult: 2 },
    };
    const { profile: p, report } = migrateV1(v1, 1000);
    expect(report.refund).toBe(555);
    expect(p.currencies).toEqual({ coins: 675, gems: TUNING.migration.welcomeGems, copium: 0 });
    expect(TUNING.migration.welcomeGems).toBe(TUNING.gacha.tenPullCost);
    expect(p.settings).toEqual(v1.settings);
    expect(p.best).toEqual(v1.best);
    expect(p.lifetime).toMatchObject({ runs: 7, clears: 2, deaths: 5, kills: 4321, maxCombo: 380, bestLevel: 55 });
    expect(p.records.dream_meadow).toMatchObject({ runs: 7, clears: 2, bestTime: 612.5, bestHeat: 0, bestKills: 4100 });
    expect(p.unlocks.heroes).toEqual(["hoshi", "rin", "mochi"]);
    expect(p.loadout.hero).toBe("rin");
    expect(p.tutorial).toMatchObject({ dash: true, ult: 2 });
    expect(p.board.ranks).toEqual({});
    expect(p.info.migratedFrom).toBe(1);
    const r = sanitizeProfile(JSON.parse(JSON.stringify(p)), 0);
    expect(r.repaired).toBe(false);
    // a v1 clear opens ring 2 + stage 2 after reconcile
    reconcileProfile(r.profile, ctx);
    expect(r.profile.unlocks.stages).toContain("candy_kingdom");
  });

  test.each([
    null,
    "corrupted",
    42,
    [],
    { coins: "lots", meta: [1, 2], settings: 5, best: null, tut: "x", runs: -3, wins: 1e99, lastHero: { evil: true } },
    { coins: Number.POSITIVE_INFINITY, meta: { might: Number.NaN, revive: "1" }, best: { time: -5 } },
  ])("corrupted v1 blob %j migrates without throwing", (raw) => {
    const { profile, report } = migrateV1(raw, 0);
    const p = sanitizeProfile(JSON.parse(JSON.stringify(profile)), 0).profile;
    assertValid(p);
    expect(report.refund).toBe(0);
    expect(p.currencies.gems).toBe(TUNING.migration.welcomeGems);
    expect(p.unlocks.heroes).toEqual(["hoshi", "rin", "mochi"]);
    expect(readV1(raw).wins).toBeLessThanOrEqual(readV1(raw).runs);
  });
});

describe("export / import save string", () => {
  test("base64 + utf-8 + crc32 primitives", () => {
    const s = "Kira☆Kira ♦ ★ 日本語 🚚 nice";
    const b = utf8Encode(s);
    expect(utf8Decode(b)).toBe(s);
    expect(Array.from(base64Decode(base64Encode(b))!)).toEqual(Array.from(b));
    expect(base64Encode(utf8Encode("hello"))).toBe("aGVsbG8=");
    expect(crc32(utf8Encode("123456789"))).toBe(0xcbf43926);
    expect(base64Decode("a$bc")).toBeNull();
  });

  test("round trip, wrapped / spaced pastes accepted", () => {
    const p = freshProfile(ctx);
    p.currencies.gems = 1234;
    p.loadout.hero = "rin";
    const s = encodeSaveString(p);
    expect(s.startsWith("KKO2.")).toBe(true);
    const wrapped = s.replace(/(.{40})/g, "$1\n  ");
    const d = decodeSaveString(wrapped);
    expect(d.ok).toBe(true);
    if (d.ok) expect(sanitizeProfile(d.data, 0).profile).toEqual(sanitizeProfile(JSON.parse(JSON.stringify(p)), 0).profile);
  });

  test("tampered / truncated / foreign strings are rejected with a reason", () => {
    const s = encodeSaveString(defaultProfile(0));
    const [pre, body, sum] = s.split(".");
    const flip = body[10] === "A" ? "B" : "A";
    expect(decodeSaveString("")).toEqual({ ok: false, error: "empty" });
    expect(decodeSaveString("hello world")).toEqual({ ok: false, error: "format" });
    expect(decodeSaveString(`XXX2.${body}.${sum}`)).toEqual({ ok: false, error: "format" });
    expect(decodeSaveString(`${pre}.${body.slice(0, 10)}${flip}${body.slice(11)}.${sum}`)).toEqual({ ok: false, error: "checksum" });
    expect(decodeSaveString(`${pre}.${body.slice(0, -8)}.${sum}`).ok).toBe(false);
    expect(decodeSaveString(`${pre}.${body}!.${sum}`)).toEqual({ ok: false, error: "base64" });
    const arr = encodeSaveString([1, 2, 3]);
    expect(decodeSaveString(arr)).toEqual({ ok: false, error: "json" });
  });
});
