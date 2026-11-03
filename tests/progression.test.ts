import { describe, expect, test } from "vitest";
import { RANKS, rankFor, xpToNext, CFG, bossHpScale, enemyHpScale, gemXpScale } from "../src/game/config";
import { World } from "../src/game/world";
import { COINS_CARD, HEAL_CARD, makeOffer } from "../src/game/upgrades";
import { PASSIVES } from "../src/game/passives";
import { defaultRunConfig } from "../src/game/run-config";
import { WEAPONS, baseWeapons } from "../src/game/registry";
import { HERO_IDS } from "../src/game/heroes";
import { META, metaCost } from "../src/game/meta";
import { ADAPT_FROM, ADAPT_MAX } from "../src/game/director/director";

describe("xp curve", () => {
  test("curve: 3 at Lv1, steep Lv 6-12, gentle Lv 12-22, steep again from Lv 22 / 38", () => {
    expect(xpToNext(1)).toBe(3); // the first level-up in a few seconds (+ the starter vacuum)
    expect(xpToNext(2)).toBe(15);
    expect(xpToNext(6)).toBe(55);
    expect(xpToNext(7)).toBe(93); // +38 per level from Lv 6
    expect(xpToNext(12)).toBe(283);
    expect(xpToNext(13)).toBe(295); // only +12 per level through the early mid-game
    expect(xpToNext(22)).toBe(403);
    expect(xpToNext(23)).toBe(475); // +72 per level from Lv 22
    expect(xpToNext(39) - xpToNext(38)).toBe(132); // +132 per level from Lv 38
    // strictly increasing, and the late game costs far more than the early game
    for (let L = 1; L < 80; L++) expect(xpToNext(L + 1)).toBeGreaterThan(xpToNext(L));
    expect(xpToNext(50)).toBeGreaterThan(xpToNext(20) * 7);
  });
  test("addXp levels up, queues pending levels and carries overflow", () => {
    const w = new World({ hero: "hoshi", seed: 1, director: false });
    w.addXp(xpToNext(1) + xpToNext(2) + 3);
    expect(w.level).toBe(3);
    expect(w.pendingLevels).toBe(2);
    expect(w.xp).toBeCloseTo(3);
  });
});

describe("first level-up (DESIGN pillar: under 8 s)", () => {
  test.each(HERO_IDS)("%s reaches Lv 2 within 8 s standing still, running away or circling (starter vacuum)", (hero) => {
    const times: number[] = [];
    for (const mode of ["still", "right", "circle"])
      for (const seed of [1, 2, 3]) {
        const w = new World({ hero, seed });
        for (let i = 0; i < 60 * 12 && w.level < 2; i++) {
          const t = i / 60;
          w.input.mx = mode === "still" ? 0 : mode === "right" ? 1 : Math.cos(t * 0.8);
          w.input.my = mode === "circle" ? Math.sin(t * 0.8) : 0;
          w.step(1 / 60);
        }
        expect(w.level, `${hero} ${mode} seed ${seed}`).toBeGreaterThanOrEqual(2);
        times.push(w.t);
      }
    for (const t of times) expect(t).toBeLessThanOrEqual(8);
    times.sort((a, b) => a - b);
    expect(times[times.length >> 1]).toBeLessThanOrEqual(6);
  });
  test("the starter vacuum only helps the opening (below Lv 3, first 30 s)", () => {
    expect(CFG.starterVacuum).toBeGreaterThan(CFG.pickupRadius * 3);
    const w = new World({ hero: "hoshi", seed: 1, director: false });
    w.dropGem(w.player.x + 80, w.player.y, 1);
    for (let i = 0; i < 60; i++) w.step(1 / 60);
    expect(w.gems.count).toBe(0); // pulled in from 80 px
    w.addXp(xpToNext(1) + xpToNext(2));
    expect(w.level).toBe(3);
    w.dropGem(w.player.x + 80, w.player.y, 1);
    for (let i = 0; i < 60; i++) w.step(1 / 60);
    expect(w.gems.count).toBe(1); // Lv 3: back to the normal pickup radius
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
  test("maxed build: a reroll that cannot change the offer (only Heal / Star Pouch left) is not consumed", () => {
    const w = maxedWorld();
    w.addXp(w.xpNext + 0.01);
    const a = w.offer().map((c) => c.id);
    expect(a).toEqual([HEAL_CARD.id, COINS_CARD.id]);
    const r0 = w.rerolls;
    expect(r0).toBeGreaterThan(0);
    expect(w.canReroll).toBe(false);
    const b = w.reroll()!.map((c) => c.id);
    expect(b).toEqual(a);
    expect(w.rerolls).toBe(r0);
    // three unowned passives for three cards: still the same set every time
    w.passives.pop();
    w.recomputeStats();
    expect(w.canReroll).toBe(false);
    // a lower-level item (could roll epic / a different pick) makes the reroll meaningful again
    w.setPassiveLevel(w.passives[0].def.id, 2);
    expect(w.canReroll).toBe(true);
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
  test("maxed build: the chest's reported coins (the UI toast) equal the coins actually received", () => {
    for (const golden of [false, true]) {
      const w = maxedWorld();
      const before = w.coins;
      w.pendingChests.push({ golden });
      const res = w.openChest()!;
      expect(res.rewards.every((r) => r.kind === "coins")).toBe(true);
      expect(w.coins - before).toBe(res.coins);
      expect(res.coins).toBeGreaterThanOrEqual(50 * res.rewards.length);
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
    expect(w.stats.might).toBeCloseTo(1.08);
    expect(w.player.maxHp).toBe(124);
  });
});

describe("pacing mechanics (balance pass)", () => {
  /** Kill `n` fresh puffs right next to the player (combo / meter / XP plumbing). */
  function kills(w: World, n: number): void {
    for (let i = 0; i < n; i++) {
      const e = w.spawnEnemy("puff", w.player.x + 300, w.player.y + 300)!;
      w.killEnemy(e, null);
    }
  }

  test("combo: high ranks drain fast and fall one rank at a time; low ranks break", () => {
    const w = new World({ hero: "hoshi", seed: 11, director: false });
    kills(w, RANKS[5].at); // SSS
    expect(w.comboRank).toBe(5);
    // a fresh rank starts with its (short) full window; one kill only puts back a sliver
    expect(w.comboTimer).toBeCloseTo(CFG.comboWindow[6]);
    for (let i = 0; i < 40; i++) w.step(1 / 60);
    const before = w.comboTimer;
    kills(w, 1);
    expect(w.comboTimer - before).toBeCloseTo(CFG.comboRefill[6], 5);
    expect(CFG.comboRefill[6]).toBeLessThan(CFG.comboRefill[1] / 10);
    // starved: SSS falls to SS (count = SS threshold), it does not shatter
    const drops: number[] = [];
    let breaks = 0;
    w.bus.on("comboDrop", (e) => drops.push(e.rank));
    w.bus.on("comboBreak", () => breaks++);
    for (let i = 0; i < 2 * 60 && w.comboRank === 5; i++) w.step(1 / 60);
    expect(w.comboRank).toBe(4);
    expect(w.combo).toBe(RANKS[4].at);
    expect(drops).toEqual([4]);
    expect(breaks).toBe(0);
    // a hit costs one more rank
    w.player.iframes = 0;
    w.hurtPlayer(5, w.player.x + 10, w.player.y);
    expect(w.comboRank).toBe(3);
    // left alone it keeps falling, then breaks below B
    for (let i = 0; i < 30 * 60 && w.combo > 0; i++) w.step(1 / 60);
    expect(w.combo).toBe(0);
    expect(w.comboRank).toBe(-1);
    expect(breaks).toBe(1);
    expect(w.maxCombo).toBeGreaterThanOrEqual(RANKS[5].at + 1);
  });

  test("overdrive: starts part-filled, ordinary kills are capped per second, elites / bosses are not", () => {
    const w = new World({ hero: "rin", seed: 12, director: false });
    expect(w.ultMeter).toBe(CFG.ultStart);
    w.step(1 / 60);
    const m0 = w.ultMeter;
    kills(w, 300); // a screen-clearing burst in one frame
    expect(w.ultMeter - m0).toBeLessThanOrEqual(CFG.ultKillCap * 2 + 1e-6);
    expect(w.ultMeter).toBeLessThan(CFG.ultMax);
    const m1 = w.ultMeter;
    const e = w.spawnEnemy("puff", 300, 300, true)!;
    w.killEnemy(e, null);
    expect(w.ultMeter - m1).toBeCloseTo(CFG.ultPerElite);
  });

  test("boss HP follows the player's level around the boss's tuning level (clamped)", () => {
    expect(bossHpScale(undefined, 40)).toBe(1);
    expect(bossHpScale(30, 30)).toBe(1);
    expect(bossHpScale(30, 40)).toBeCloseTo(1 + 10 * CFG.bossHpPerLevel);
    expect(bossHpScale(30, 200)).toBe(CFG.bossHpMax);
    expect(bossHpScale(30, 1)).toBe(CFG.bossHpMin);
    const lo = new World({ hero: "hoshi", seed: 1, director: false });
    const hi = new World({ hero: "hoshi", seed: 1, director: false });
    hi.level = 60;
    const a = lo.spawnEnemy("lady_lunatic", 0, -100)!;
    const b = hi.spawnEnemy("lady_lunatic", 0, -100)!;
    expect(b.maxHp).toBeGreaterThan(a.maxHp * 2.5);
    expect(b.maxHp).toBeLessThanOrEqual(Math.round(a.def.hp * CFG.bossHpMax));
  });

  test("adaptive toughness: a build that keeps the screen empty gets tougher arrivals", () => {
    const w = new World({ hero: "hoshi", seed: 13 });
    w.t = ADAPT_FROM + 30;
    // nothing alive: the director sees a starved screen
    for (let i = 0; i < 60 * 30; i++) {
      for (let k = w.enemies.count - 1; k >= 0; k--) w.despawn(w.enemies.items[k]);
      w.step(1 / 60);
    }
    expect(w.director.adapt).toBeGreaterThan(0.5);
    expect(w.director.adapt).toBeLessThanOrEqual(ADAPT_MAX);
    const e = w.spawnEnemy("puff", w.player.x + 200, w.player.y)!;
    expect(e.maxHp).toBeGreaterThanOrEqual(Math.floor(8 * enemyHpScale(w.t) * (1 + w.director.adapt) * 0.99));
    // a weaker device (lower enemy cap) fights fewer, tougher enemies
    const low = new World({ hero: "hoshi", seed: 13, maxEnemies: 150 });
    low.t = 500;
    low.step(1 / 60);
    expect(low.director.hpMul).toBeGreaterThan(1.2);
  });

  test("level-ups heal a little; later gems are worth more; merged gems float home", () => {
    const w = new World({ hero: "hoshi", seed: 14, director: false });
    w.player.hp = 50;
    w.addXp(w.xpNext);
    expect(w.player.hp).toBeCloseTo(50 + Math.max(3, w.player.maxHp * CFG.levelHeal));
    expect(gemXpScale(60)).toBe(1);
    expect(gemXpScale(540)).toBeCloseTo(1 + 6 * CFG.gemXpPerMinute);
    const g = w.dropGem(w.player.x + 150, w.player.y, 40, 4);
    g.vx = g.vy = 0;
    const d0 = Math.hypot(g.x - w.player.x, g.y - w.player.y);
    for (let i = 0; i < 60; i++) w.step(1 / 60);
    expect(Math.hypot(g.x - w.player.x, g.y - w.player.y)).toBeLessThan(d0 - CFG.mergedGemDrift * 0.3);
  });
});

/** Late game: 6 evolutions + 6 maxed passives (level-ups / chests fall back to Heal / Star Pouch). */
function maxedWorld(): World {
  // (the shipped slice's 8 passives: Season 2's unlockable passives would add unowned ones to every offer)
  const w = new World({ hero: "rin", seed: 9, god: true, director: false, run: defaultRunConfig({ passivePool: PASSIVES.slice(0, 8).map((p) => p.id) }) });
  w.weapons.length = 0;
  for (const b of baseWeapons().slice(0, CFG.weaponSlots)) w.evolveWeapon(w.addWeapon(b.id, 5)!);
  for (const p of PASSIVES.slice(0, CFG.passiveSlots)) w.addPassive(p.id, p.levels.length);
  expect(w.weapons.every((i) => i.def.evolved)).toBe(true);
  return w;
}
