/**
 * The Merch Machine: statistical checks of the printed rates and pity
 * (1,000,000 seeded pulls), the 10-pull floor, featured 50/50 + guarantee,
 * dupes -> stars / constellations -> Copium, history, spark, rotation,
 * Copium Exchange. Seeded RNG everywhere (reproducible).
 */
import { describe, expect, test } from "vitest";
import { Rng } from "../src/core/rng";
import { RARITIES } from "../src/game/defs";
import { makeContent } from "../src/meta/content";
import { advanceRotation, bannerPool, bannerTitleAt, bannerView, featuredAt, featuredCandidates, featuredNow } from "../src/meta/gacha/banners";
import { claimSpark, gachaStats, pull, pullHistory, sparkChoices } from "../src/meta/gacha/engine";
import { buyOffer, exchangeCatalogue, exchangeCoinsForGems } from "../src/meta/gacha/exchange";
import { consolidatedSsrPlus, R_SR, R_SSR, R_UR, rateTable, RarityRoller, WHY_FLOOR } from "../src/meta/gacha/rates";
import type { Profile } from "../src/meta/profile";
import { TUNING } from "../src/meta/tuning";
import { fixtureContent, freshProfile } from "./meta.fixtures";

const G = TUNING.gacha;
const ctx = fixtureContent();
const rich = (): Profile => {
  const p = freshProfile(ctx);
  p.currencies.gems = 1e12;
  return p;
};

describe("rates + pity (1e6 pulls)", () => {
  test("printed rates sum to 1 (N absorbs the remainder) and the consolidated SSR+ rate is shown", () => {
    const t = rateTable();
    expect(t.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(t[6]).toBeCloseTo(0.000069, 9);
    const c = consolidatedSsrPlus();
    const base = new RarityRoller().baseSsrPlus;
    expect(c).toBeGreaterThan(base);
    expect(c).toBeLessThan(base + 0.01);
  });

  test("observed rates match the printed ones; soft pity matches its model; pity is never exceeded", () => {
    const roller = new RarityRoller();
    const rng = new Rng(20241102);
    const st = { pity: 0, pityUR: 0 };
    const N = 1_000_000;
    const base = new Float64Array(7);
    let baseN = 0;
    const all = new Float64Array(7);
    let softExpected = 0;
    let softVar = 0;
    let softHits = 0;
    let gap = 0;
    let gapUR = 0;
    let maxGap = 0;
    let maxGapUR = 0;
    for (let i = 0; i < N; i++) {
      const pity = st.pity;
      const urForced = st.pityUR + 1 >= G.urPity;
      const pure = pity + 1 < G.softPityStart && !urForced;
      const chance = roller.ssrChance(pity);
      const r = roller.roll(st, rng);
      all[r]++;
      if (pure) {
        base[r]++;
        baseN++;
      } else if (!urForced) {
        // soft / hard pity pull (not forced by UR pity)
        softExpected += chance;
        softVar += chance * (1 - chance);
        if (r >= R_SSR) softHits++;
      }
      gap++;
      gapUR++;
      if (r >= R_SSR) {
        maxGap = Math.max(maxGap, gap);
        gap = 0;
      }
      if (r >= R_UR) {
        maxGapUR = Math.max(maxGapUR, gapUR);
        gapUR = 0;
      }
    }
    const t = rateTable();
    for (let k = 0; k < 7; k++) {
      const exp = baseN * t[k];
      const sigma = Math.sqrt(exp * (1 - t[k]));
      expect(Math.abs(base[k] - exp), `${RARITIES[k]} observed ${base[k]} vs ${exp.toFixed(1)}`).toBeLessThan(5 * sigma + 1);
    }
    expect(baseN).toBeGreaterThan(0.9 * N);
    expect(maxGap).toBeLessThanOrEqual(G.hardPity);
    expect(maxGapUR).toBeLessThanOrEqual(G.urPity);
    expect(Math.abs(softHits - softExpected)).toBeLessThan(5 * Math.sqrt(softVar) + 1);
    // MYTHIC: printed 0.0069% (plus a little pity lift): expect roughly 69 in a million
    expect(all[6]).toBeGreaterThan(30);
    expect(all[6]).toBeLessThan(130);
    // SSR+ overall close to the consolidated (pity-inclusive) rate
    const ssrPlus = (all[3] + all[4] + all[5] + all[6]) / N;
    expect(Math.abs(ssrPlus - consolidatedSsrPlus())).toBeLessThan(0.0015);
  });

  test("the 10-pull floor guarantees SR or better in every 10", () => {
    const roller = new RarityRoller();
    const rng = new Rng(7);
    const st = { pity: 0, pityUR: 0 };
    let floors = 0;
    for (let g = 0; g < 50_000; g++) {
      let best = -1;
      for (let i = 0; i < 10; i++) {
        const floor = i === 9 && best < R_SR ? R_SR : -1;
        const r = roller.roll(st, rng, floor);
        if (roller.last === WHY_FLOOR) floors++;
        best = Math.max(best, r);
      }
      expect(best).toBeGreaterThanOrEqual(R_SR);
    }
    // P(no SR+ in 9) ~ (0.82)^9 ~ 17 %
    expect(floors / 50_000).toBeGreaterThan(0.12);
    expect(floors / 50_000).toBeLessThan(0.22);
  });
});

describe("pulls", () => {
  test("costs, errors, determinism", () => {
    const p = freshProfile(ctx);
    p.currencies.gems = 1700;
    const one = pull(p, "permanent", 1, new Rng(1), ctx);
    expect(one.ok).toBe(true);
    expect(p.currencies.gems).toBe(1700 - G.pullCost + one.codexGems);
    expect(pull(p, "permanent", 10, new Rng(1), ctx)).toMatchObject({ ok: false, error: "gems" });
    expect(p.gacha.stats.pulls).toBe(1);
    expect(pull(p, "permanent", 3 as 1, new Rng(1), ctx).error).toBe("count");
    const a = rich();
    const b = rich();
    for (let i = 0; i < 20; i++) {
      pull(a, "hero", 10, new Rng(100 + i), ctx);
      pull(b, "hero", 10, new Rng(100 + i), ctx);
    }
    expect(a.gacha.history).toEqual(b.gacha.history);
    expect(a.relics).toEqual(b.relics);
  });

  test("every 10-pull holds SR+; history keeps the last 100; stats add up", () => {
    const p = rich();
    const rng = new Rng(99);
    for (let i = 0; i < 1500; i++) {
      const o = pull(p, "permanent", 10, rng, ctx);
      expect(o.ok).toBe(true);
      expect(o.results.length).toBe(10);
      expect(o.results.some((r) => RARITIES.indexOf(r.rarity) >= R_SR)).toBe(true);
      expect(o.best).toBe(o.results.reduce((m, r) => (RARITIES.indexOf(r.rarity) > RARITIES.indexOf(m) ? r.rarity : m), "N" as (typeof RARITIES)[number]));
    }
    const s = p.gacha.stats;
    expect(s.pulls).toBe(15_000);
    expect(s.tenPulls).toBe(1500);
    expect(s.gemsSpent).toBe(1500 * G.tenPullCost);
    expect(RARITIES.reduce((a, r) => a + s.byRarity[r], 0)).toBe(15_000);
    expect(p.gacha.history.length).toBe(G.historySize);
    expect(p.gacha.history[99].n).toBe(15_000);
    expect(pullHistory(p, ctx)[0].n).toBe(15_000);
    expect(p.gacha.banners.permanent.pulls).toBe(15_000);
    expect(p.lifetime.pulls).toBe(15_000);
    expect(gachaStats(p).realMoney).toBe(0);
    expect(s.nStreakBest).toBeGreaterThanOrEqual(5);
    // dupes: stars capped at 6, overflow became Copium (plus 1 per pull)
    for (const v of Object.values(p.relics)) expect(v).toBeLessThanOrEqual(6);
    expect(p.relics.bent_spoon).toBe(6);
    expect(p.currencies.copium).toBeGreaterThan(15_000 * G.copiumPerPull);
    expect(s.copiumEarned).toBe(p.currencies.copium);
  });

  test("featured 50/50: about half the featured-rarity drops are featured; a loss guarantees the next", () => {
    const p = rich();
    const feat = featuredNow(p, "hero", ctx)!;
    expect(feat).toBeDefined();
    expect(["SSR", "UR"]).toContain(feat.rarity);
    const rng = new Rng(5050);
    let guaranteed = false;
    let won = 0;
    let lost = 0;
    let forced = 0;
    for (let i = 0; i < 4000; i++) {
      for (const r of pull(p, "hero", 10, rng, ctx).results) {
        if (r.rarity !== feat.rarity) continue;
        if (guaranteed) {
          expect(r.item.id).toBe(feat.id);
          expect(r.won5050).toBe(false);
          forced++;
          guaranteed = false;
        } else if (r.lost5050) {
          expect(r.item.id).not.toBe(feat.id);
          lost++;
          guaranteed = true;
        } else {
          expect(r.item.id).toBe(feat.id);
          expect(r.won5050).toBe(true);
          won++;
        }
      }
    }
    expect(won + lost).toBeGreaterThan(200);
    expect(Math.abs(won / (won + lost) - 0.5)).toBeLessThan(0.07);
    expect(forced).toBe(lost - (guaranteed ? 1 : 0));
    expect(p.gacha.stats.lost5050).toBe(lost);
    expect(p.gacha.banners.hero.guaranteed).toBe(guaranteed);
  });

  test("gacha heroes unlock then gain constellations; gameplay heroes appear only once unlocked; Truck-kun only on his banner", () => {
    const p = rich();
    const perm = bannerPool(p, "permanent", ctx);
    const ids = RARITIES.flatMap((r) => perm[r].map((x) => x.id));
    expect(ids).toContain("senpai");
    expect(ids).toContain("hoshi");
    expect(ids).not.toContain("kuro"); // registered but not unlocked
    expect(ids).not.toContain("truck_kun");
    expect(bannerPool(p, "mythic", ctx).MYTHIC.map((x) => x.id)).toContain("truck_kun");
    const rng = new Rng(3);
    for (let i = 0; i < 600; i++) pull(p, "hero", 10, rng, ctx);
    expect(p.unlocks.heroes).toEqual(expect.arrayContaining(["senpai", "magical_girl_47"]));
    expect(p.heroes.senpai.constellation).toBeGreaterThan(0);
    expect(p.codex.relics.length).toBeGreaterThan(5);
  });

  test("spark: 1,000 pulls on any banner -> pick any MYTHIC", () => {
    const p = rich();
    expect(claimSpark(p, "truck_kun", ctx)).toEqual({ ok: false, reason: "pulls" });
    const rng = new Rng(11);
    for (let i = 0; i < 100; i++) pull(p, i % 2 ? "permanent" : "relic", 10, rng, ctx);
    expect(p.gacha.spark).toBe(1000);
    expect(bannerView(p, "mythic", ctx).sparkReady).toBe(true);
    expect(sparkChoices(ctx).map((x) => x.id)).toEqual(["truck_kun", "credit_card"]);
    expect(claimSpark(p, "bent_spoon", ctx).reason).toBe("item");
    const r = claimSpark(p, "truck_kun", ctx);
    expect(r.ok).toBe(true);
    expect(p.unlocks.heroes).toContain("truck_kun");
    expect(p.gacha.spark).toBe(0);
    expect(p.gacha.stats.sparksUsed).toBe(1);
  });

  test("a banner with nothing to feature is unavailable (content not shipped yet)", () => {
    const bare = makeContent({ heroes: [{ id: "hoshi", name: "Hoshi", title: "", weapon: "star_shot", portrait: "" }], relics: [...ctx.relics.values()], stages: ctx.stages });
    const p = rich();
    expect(bannerView(p, "hero", bare)).toMatchObject({ available: false, block: "noFeatured" });
    expect(pull(p, "hero", 1, new Rng(1), bare)).toMatchObject({ ok: false, error: "banner" });
    expect(bannerView(p, "permanent", bare).available).toBe(true);
    const empty = makeContent({});
    expect(bannerView(p, "permanent", empty).block).toBe("empty");
  });
});

describe("rotation", () => {
  test("featured banners change every 3 runs, cycle through every candidate, never repeat back to back", () => {
    const p = freshProfile(ctx);
    expect(p.rotation.runsLeft).toBe(TUNING.rotation.runsPerBanner);
    const first = featuredNow(p, "hero", ctx)!.id;
    expect(advanceRotation(p)).toBe(false);
    expect(advanceRotation(p)).toBe(false);
    expect(advanceRotation(p)).toBe(true);
    expect(p.rotation.runsLeft).toBe(3);
    expect(featuredNow(p, "hero", ctx)!.id).not.toBe(first);
    for (const banner of ["hero", "relic"] as const) {
      const n = featuredCandidates(banner, ctx).length;
      expect(n).toBeGreaterThan(1);
      const seen = new Set<string>();
      let prev = "";
      for (let c = 0; c < 3 * n; c++) {
        const f = featuredAt(banner, c, ctx)!.id;
        expect(f).not.toBe(prev);
        prev = f;
        if (c < n) seen.add(f);
      }
      expect(seen.size).toBe(n);
    }
  });
});

describe("banner flavour", () => {
  test("seasonal banner names per loop; the Isekai Express curse turns every N into the Traffic Cone", () => {
    expect(bannerTitleAt("hero", 0, ctx)).toBe("Senpai's Rooftop Banner");
    expect(featuredAt("hero", 1, ctx)!.id).toBe("isekai_kun");
    expect(bannerTitleAt("hero", 3, ctx)).toBe("Senpai (Summer Ver.) (Same Outfit)");
    expect(bannerTitleAt("permanent", 5, ctx)).toBe("Totally Normal Merch");
    const withCone = makeContent({ heroes: [...ctx.heroes], relics: [...ctx.relics.values(), { id: "traffic_cone", name: "Traffic Cone", rarity: "N", icon: "", flavor: "", desc: () => "" }], stages: ctx.stages });
    const p = rich();
    const rng = new Rng(77);
    let ns = 0;
    for (let i = 0; i < 30; i++)
      for (const r of pull(p, "mythic", 10, rng, withCone).results)
        if (r.rarity === "N") {
          ns++;
          expect(r.item.id).toBe("traffic_cone");
        }
    expect(ns).toBeGreaterThan(100);
    expect(p.relics.traffic_cone).toBe(6);
    // other banners are not cursed
    const q = rich();
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) for (const r of pull(q, "permanent", 10, rng, withCone).results) if (r.rarity === "N") seen.add(r.item.id);
    expect(seen.size).toBeGreaterThan(2);
  });

  test("meta counters for the Plot Points: hard pity hits, pity insurance, gem exchanges", () => {
    const p = rich();
    p.gacha.banners.permanent.pity = G.hardPity - 1;
    const r = pull(p, "permanent", 1, new Rng(1), ctx);
    expect(r.results[0].pity).toBe("hard");
    expect(p.gacha.stats.hardPityHits).toBe(1);
    p.currencies.copium = 1000;
    buyOffer(p, "insurance:relic", ctx);
    expect(p.gacha.stats.pityInsurance).toBe(1);
    p.currencies.coins = 5000;
    exchangeCoinsForGems(p, 2);
    expect(p.gacha.stats.gemExchanges).toBe(1);
  });
});

describe("Copium Exchange", () => {
  test("catalogue, purchases, not-for-sale MYTHICs, insurance cap, voucher, gem exchange", () => {
    const p = freshProfile(ctx);
    const cat = exchangeCatalogue(p, ctx);
    expect(cat.find((o) => o.id === "voucher")).toBeDefined();
    expect(cat.filter((o) => o.kind === "insurance").length).toBe(4);
    expect(cat.find((o) => o.id === "hero:truck_kun")!.block).toBe("notForSale");
    expect(cat.find((o) => o.id === "relic:credit_card")!.block).toBe("notForSale");
    expect(cat.find((o) => o.id === "hero:kuro")!.block).toBe("locked");
    expect(buyOffer(p, "relic:golden_mic", ctx)).toMatchObject({ ok: false, block: "copium" });
    p.currencies.copium = 100_000;
    const r = buyOffer(p, "relic:golden_mic", ctx);
    expect(r.ok).toBe(true);
    expect(r.result!.result).toBe("new");
    expect(p.relics.golden_mic).toBe(0);
    expect(buyOffer(p, "relic:golden_mic", ctx).result!.result).toBe("star");
    expect(buyOffer(p, "hero:senpai", ctx).result!.result).toBe("new");
    expect(buyOffer(p, "hero:senpai", ctx).result!.level).toBe(1);
    expect(buyOffer(p, "hero:truck_kun", ctx).block).toBe("notForSale");
    p.gacha.banners.hero.pity = 75;
    expect(buyOffer(p, "insurance:hero", ctx).pity).toBe(85);
    expect(buyOffer(p, "insurance:hero", ctx).pity).toBe(G.hardPity - 1);
    expect(buyOffer(p, "insurance:hero", ctx).block).toBe("pity");
    const gems = p.currencies.gems;
    expect(buyOffer(p, "voucher", ctx).gems).toBe(TUNING.exchange.pullVoucherGems);
    expect(p.currencies.gems).toBe(gems + TUNING.exchange.pullVoucherGems);
    expect(buyOffer(p, "nope", ctx).block).toBe("unknown");
    for (let i = 0; i < 6; i++) buyOffer(p, "relic:bent_spoon", ctx);
    expect(p.relics.bent_spoon).toBe(5);
    buyOffer(p, "relic:bent_spoon", ctx);
    expect(buyOffer(p, "relic:bent_spoon", ctx).block).toBe("maxed");
    p.currencies.coins = 2500;
    expect(exchangeCoinsForGems(p, 5)).toEqual({ ok: true, coins: 2000, gems: 2 * TUNING.gemExchange.gems });
    expect(exchangeCoinsForGems(p, 1).ok).toBe(false);
  });
});
