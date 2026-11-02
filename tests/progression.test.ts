import { describe, expect, test } from "vitest";
import { RANKS, rankFor, xpToNext, CFG } from "../src/game/config";
import { World } from "../src/game/world";
import { COINS_CARD, HEAL_CARD, makeOffer } from "../src/game/upgrades";
import { PASSIVES } from "../src/game/passives";
import { WEAPONS } from "../src/game/registry";
import { META, metaCost } from "../src/game/meta";

describe("xp curve", () => {
  test("curve: 5 at Lv1, steepening at Lv 6 / 15 / 25", () => {
    expect(xpToNext(1)).toBe(5);
    expect(xpToNext(2)).toBe(15);
    expect(xpToNext(6)).toBe(55);
    expect(xpToNext(7)).toBe(73);
    expect(xpToNext(15)).toBe(5 + 14 * 10 + 9 * 8);
    expect(xpToNext(20)).toBe(5 + 19 * 10 + 14 * 8 + 5 * 12);
    expect(xpToNext(30)).toBe(5 + 29 * 10 + 24 * 8 + 15 * 12 + 5 * 16);
    // strictly increasing
    for (let L = 1; L < 60; L++) expect(xpToNext(L + 1)).toBeGreaterThan(xpToNext(L));
  });
  test("addXp levels up, queues pending levels and carries overflow", () => {
    const w = new World({ hero: "hoshi", seed: 1, director: false });
    w.addXp(5 + 15 + 3);
    expect(w.level).toBe(3);
    expect(w.pendingLevels).toBe(2);
    expect(w.xp).toBeCloseTo(3);
  });
});

describe("combo ranks", () => {
  test("thresholds C 10 · B 30 · A 60 · S 100 · SS 200 · SSS 400", () => {
    expect(rankFor(9)).toBe(-1);
    expect(RANKS[rankFor(10)].id).toBe("C");
    expect(RANKS[rankFor(59)].id).toBe("B");
    expect(RANKS[rankFor(100)].id).toBe("S");
    expect(RANKS[rankFor(400)].id).toBe("SSS");
    expect(RANKS[rankFor(400)].mult).toBe(2);
  });
});

describe("level-up cards", () => {
  test("offers distinct cards; NEW weapons when slots are free", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = new World({ hero: "rin", seed, director: false });
      const cards = makeOffer(w, 3);
      expect(cards.length).toBe(3);
      const keys = cards.map((c) => `${c.kind}:${c.id}`);
      expect(new Set(keys).size).toBe(3);
      for (const c of cards) {
        expect(c.name.length).toBeGreaterThan(0);
        expect(c.desc.length).toBeGreaterThan(0);
        if (c.kind === "weapon" && c.from === 0) expect(c.rarity).toBe("rare");
      }
    }
  });
  test("evolution card appears when the weapon is maxed and the passive owned", () => {
    const w = new World({ hero: "hoshi", seed: 3, director: false });
    const inst = w.hasWeapon("star_shot")!;
    w.setWeaponLevel(inst, 5);
    expect(makeOffer(w, 3).some((c) => c.kind === "evolution")).toBe(false);
    w.addPassive("wish_charm");
    const offer = makeOffer(w, 3);
    const evo = offer.find((c) => c.kind === "evolution");
    expect(evo?.id).toBe("galaxy_barrage");
    expect(evo?.rarity).toBe("evolution");
    w.choose(evo!);
    expect(w.hasWeapon("galaxy_barrage")).toBeTruthy();
    expect(w.hasWeapon("star_shot")).toBeFalsy();
  });
  test("everything maxed -> Heal 30 HP / +50 coins fallbacks", () => {
    const w = new World({ hero: "mochi", seed: 4, director: false });
    for (const def of WEAPONS.values()) if (!def.evolved) w.addWeapon(def.id, 5);
    for (const p of PASSIVES.slice(0, CFG.passiveSlots)) w.addPassive(p.id, 5);
    // evolve everything that can evolve, then nothing is left
    for (;;) {
      const evo = makeOffer(w, 3).find((c) => c.kind === "evolution");
      if (!evo) break;
      w.choose(evo);
    }
    const cards = makeOffer(w, 3);
    const ids = cards.map((c) => c.id);
    expect(ids).toContain(HEAL_CARD.id);
    expect(ids).toContain(COINS_CARD.id);
    const hp = w.player.hp;
    w.player.hp = 10;
    w.choose(cards.find((c) => c.kind === "heal")!);
    expect(w.player.hp).toBe(40);
    w.player.hp = hp;
  });
  test("applying cards levels items and recomputes stats", () => {
    const w = new World({ hero: "hoshi", seed: 5, director: false });
    w.choose({ kind: "passive", id: "power_bow", name: "", icon: "", desc: "", from: 0, to: 1, rarity: "common" });
    expect(w.stats.might).toBeCloseTo(1.1);
    w.choose({ kind: "passive", id: "heart_locket", name: "", icon: "", desc: "", from: 0, to: 2, rarity: "epic" });
    expect(w.player.maxHp).toBe(140);
    w.choose({ kind: "weapon", id: "yarn_orbit", name: "", icon: "", desc: "", from: 0, to: 1, rarity: "rare" });
    expect(w.hasWeapon("yarn_orbit")?.level).toBe(1);
  });
  test("rerolls are limited", () => {
    const w = new World({ hero: "hoshi", seed: 6, director: false });
    expect(w.rerolls).toBe(CFG.rerolls);
    expect(w.reroll()).not.toBeNull();
    expect(w.reroll()).not.toBeNull();
    expect(w.reroll()).toBeNull();
  });
  test("Luck meta rank 3 grants a 4th card", () => {
    const w = new World({ hero: "hoshi", seed: 6, director: false, meta: { luck: 3 } });
    expect(w.stats.cards).toBe(4);
    expect(makeOffer(w).length).toBe(4);
  });
});

describe("chests", () => {
  test("normal chest = 1 reward, golden = 3 (or a 5-reward jackpot)", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = new World({ hero: "rin", seed, director: false });
      w.pendingChests.push({ golden: false }, { golden: true });
      const a = w.openChest()!;
      expect(a.rewards.length === 1 || a.jackpot).toBe(true);
      const b = w.openChest()!;
      expect(b.rewards.length).toBe(b.jackpot ? 5 : 3);
      expect(w.coins).toBeGreaterThan(0);
    }
  });
  test("chests prioritise evolutions", () => {
    const w = new World({ hero: "mochi", seed: 2, director: false });
    w.setWeaponLevel(w.hasWeapon("yarn_orbit")!, 5);
    w.addPassive("magnet_star");
    w.pendingChests.push({ golden: false });
    const r = w.openChest()!;
    expect(r.rewards[0].kind).toBe("evolution");
    expect(w.hasWeapon("cosmic_yarn")).toBeTruthy();
  });
});

describe("meta shop", () => {
  test("costs grow ~1.6x per rank and ranks apply", () => {
    const m = META.find((x) => x.id === "might")!;
    expect(metaCost(m, 1) / metaCost(m, 0)).toBeGreaterThan(1.4);
    const w = new World({ hero: "hoshi", seed: 1, director: false, meta: { might: 2, vitality: 3 } });
    expect(w.stats.might).toBeCloseTo(1.1);
    expect(w.player.maxHp).toBe(130);
  });
});
