/**
 * RunConfig plumbing (docs/EXPANSION.md §5-8, §14): the stat pipeline order,
 * content pools, Limit Breaks, build slots, start bonuses, loadout flags
 * (banish / skip / dash charges / Overdrive start / chest luck / elites /
 * Plot Armor / Power of Friendship / revives / free rerolls) and the bot's
 * level-up policy with banishes and skips.
 */
import { earlyAccountRun } from "./fixtures/account";
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG, CH_MISC, CH_ULT, MAX_WEAPON_SLOTS } from "../src/game/config";
import { defaultRunConfig, type RunConfig } from "../src/game/run-config";
import { WEAPONS, baseWeapons } from "../src/game/registry";
import { makeOffer, rollChest } from "../src/game/upgrades";
import { wstats } from "../src/game/weapons/_shared";
import { World } from "../src/game/world";

const DT = 1 / 30;
const run = (over: Partial<RunConfig> = {}) => defaultRunConfig(over);
const quiet = (over: Partial<RunConfig> = {}, hero = "hoshi") => new World({ hero, seed: 11, director: false, run: run(over) });

describe("stat pipeline", () => {
  test("base -> hero -> account mods -> relics -> talents -> constellation -> passives -> run modifiers", () => {
    const order: string[] = [];
    const w = new World({
      hero: "rin",
      seed: 1,
      director: false,
      run: run({
        mods: [
          (s) => {
            order.push(`mods:${s.might.toFixed(2)}`);
            s.might += 0.5;
          },
        ],
        relics: [{ id: "bent_spoon", stars: 6 }],
        talents: { rin_honed_edge: 5 },
        constellation: 1,
      }),
    });
    // Rin trait +10%, account +50%, Bent Spoon +9%, Honed Edge +15%, C1 +15 HP
    expect(order[0]).toBe("mods:1.10");
    expect(w.stats.might).toBeCloseTo(1 + 0.1 + 0.5 + 0.09 + 0.15, 6);
    expect(w.stats.maxHp).toBe(CFG.playerHp + 20 + 15);
    expect(w.player.hp).toBe(w.stats.maxHp);
    // run modifiers come last (after passives)
    w.statMods.push((s) => void (s.might *= 2));
    w.addPassive("power_bow", 1);
    expect(w.stats.might).toBeCloseTo((1 + 0.1 + 0.5 + 0.09 + 0.15 + 0.1) * 2, 6);
  });

  test("weapon mastery damage (weaponDamage) applies to the weapon and its evolution", () => {
    const w = quiet({ weaponDamage: { star_shot: 0.3 } });
    const inst = w.hasWeapon("star_shot")!;
    expect(inst.dmgMul).toBeCloseTo(1.3, 9);
    expect(wstats(w, inst).dmg).toBeCloseTo(inst.def.levels[0].dmg * w.stats.might * 1.3, 6);
    w.setWeaponLevel(inst, 5);
    w.addPassive("wish_charm", 1);
    const evo = w.evolveWeapon(inst)!;
    expect(evo.def.id).toBe("galaxy_barrage");
    expect(evo.dmgMul).toBeCloseTo(1.3, 9);
  });
});

describe("content pools", () => {
  test("level-up cards only offer pool weapons / passives as NEW (undefined = everything)", () => {
    const pool = ["star_shot", "candy_bomb"];
    const passives = ["power_bow", "twin_charm"];
    const w = quiet({ weaponPool: pool, passivePool: passives });
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) for (const c of makeOffer(w, 4)) if (c.from === 0) seen.add(`${c.kind}:${c.id}`);
    for (const k of seen) {
      const [kind, id] = k.split(":");
      if (kind === "weapon") expect(pool).toContain(id);
      if (kind === "passive") expect(passives).toContain(id);
    }
    expect(seen.has("weapon:candy_bomb")).toBe(true);
    expect(seen.has("passive:twin_charm")).toBe(true);
    // everything unlocked by default
    const all = quiet();
    const any = new Set<string>();
    for (let i = 0; i < 300; i++) for (const c of makeOffer(all, 4)) if (c.kind === "weapon" && c.from === 0) any.add(c.id);
    expect(any.size).toBe(baseWeapons().length - 1);
  });

  test("an empty pool falls back to the Heal / Star Pouch cards", () => {
    const w = quiet({ weaponPool: [], passivePool: [] });
    w.setWeaponLevel(w.hasWeapon("star_shot")!, 5);
    const offer = makeOffer(w, 3);
    expect(offer.map((c) => c.kind).sort()).toEqual(["coins", "heal"]);
  });
});

describe("Limit Break (mastery: weaponLevelBonus)", () => {
  test("max level 5 -> 7 with the weapon's own Limit Break entries (docs/content/weapons.md §4)", () => {
    const w = quiet({ weaponLevelBonus: { star_shot: 2 }, weaponPool: ["star_shot"], passivePool: [] });
    const inst = w.hasWeapon("star_shot")!;
    expect(w.weaponMaxLevel(inst.def)).toBe(7);
    w.setWeaponLevel(inst, 5);
    const L5 = inst.def.levels[4];
    const cd5 = wstats(w, inst).cd;
    const offer = makeOffer(w, 3).find((c) => c.id === "star_shot")!;
    expect(offer).toBeTruthy();
    expect(offer.limitBreak).toBe(true);
    expect(offer.max).toBe(7);
    expect(offer.desc).toContain("LIMIT BREAK — Idol Stamina");
    w.choose(offer);
    expect(inst.level).toBe(6);
    const S6 = wstats(w, inst);
    // Lv6: +15% damage, +1 star
    expect(S6.dmg).toBeCloseTo(L5.dmg * w.stats.might * 1.15, 6);
    expect(S6.amount).toBe(L5.amount + 1 + w.stats.amount);
    w.setWeaponLevel(inst, 99);
    expect(inst.level).toBe(7);
    // Lv7: +25% damage more, +1 star more, -10% cooldown
    const S7 = wstats(w, inst);
    expect(S7.dmg).toBeCloseTo(L5.dmg * w.stats.might * 1.4, 6);
    expect(S7.amount).toBe(L5.amount + 2 + w.stats.amount);
    expect(S7.cd).toBeCloseTo(cd5 * 0.9, 9);
    // never offered past its max
    expect(makeOffer(w, 3).some((c) => c.id === "star_shot")).toBe(false);
  });

  test("a weapon without entries uses the generic rule (+20% damage, +1 amount per level)", () => {
    const w = quiet();
    const inst = w.hasWeapon("star_shot")!;
    const def = { ...inst.def, limitBreak: undefined };
    const fake = { ...inst, def, level: 7 };
    const L5 = def.levels[4];
    const S = wstats(w, fake);
    expect(S.dmg).toBeCloseTo(L5.dmg * w.stats.might * (1 + 2 * CFG.limitBreakDmg), 6);
    expect(S.amount).toBe(L5.amount + 2 + w.stats.amount);
  });

  test("without a bonus the cap stays at Lv5; an evolution inherits +15% damage per Limit Break level", () => {
    const plain = quiet();
    expect(plain.weaponMaxLevel(WEAPONS.get("star_shot")!)).toBe(5);
    const w = quiet({ weaponLevelBonus: { star_shot: 2 } });
    expect(w.weaponMaxLevel(WEAPONS.get("galaxy_barrage")!)).toBe(1);
    const inst = w.hasWeapon("star_shot")!;
    w.setWeaponLevel(inst, 7);
    w.addPassive("wish_charm", 1);
    const card = makeOffer(w, 3).find((c) => c.kind === "evolution")!;
    expect(card.desc).toContain("+30% (Limit Break)");
    w.choose(card);
    const evo = w.hasWeapon("galaxy_barrage")!;
    expect(evo.dmgMul).toBeCloseTo(1.3, 9);
    expect(evo.lbInherit).toBeCloseTo(0.3, 9);
  });
});

describe("build slots", () => {
  test("RunConfig slot limits replace the 6 / 6 defaults (and channels never collide)", () => {
    const w = quiet({ weaponSlots: 7, passiveSlots: 2 });
    const ids = baseWeapons().map((d) => d.id);
    for (const id of ids) w.addWeapon(id);
    expect(w.weapons.length).toBe(Math.min(7, ids.length));
    expect(new Set(w.weapons.map((x) => x.slot)).size).toBe(w.weapons.length);
    for (const x of w.weapons) {
      expect(x.slot).toBeLessThan(MAX_WEAPON_SLOTS);
      expect(x.slot).not.toBe(CH_ULT);
      expect(x.slot).not.toBe(CH_MISC);
    }
    w.addPassive("power_bow");
    w.addPassive("wish_charm");
    expect(w.addPassive("big_ribbon")).toBeNull();
    expect(w.passives.length).toBe(2);
    // a full passive bar offers no NEW passive
    for (let i = 0; i < 50; i++) expect(makeOffer(w, 4).some((c) => c.kind === "passive" && c.from === 0)).toBe(false);
    const small = quiet({ weaponSlots: 2 });
    for (const id of ids) small.addWeapon(id);
    expect(small.weapons.length).toBe(2);
  });
});

describe("start bonuses and flags", () => {
  test("start level -> queued level-up picks; start weapons at their level", () => {
    const w = quiet({ start: { level: 5, weapons: [{ id: "candy_bomb", level: 2 }] } });
    expect(w.level).toBe(5);
    expect(w.pendingLevels).toBe(4);
    expect(w.hasWeapon("candy_bomb")?.level).toBe(2);
    const bot = new Bot(1);
    while (w.pendingLevels > 0) bot.resolve(w);
    expect(w.pendingLevels).toBe(0);
  });

  test("dash charges: several dashes in a row, recharged one at a time; the HUD meter reads ready", () => {
    const w = quiet({ flags: { dashCharges: 2 } });
    const p = w.player;
    expect(p.dashChargesMax).toBe(3);
    let dashes = 0;
    w.hooks.on("dash", () => dashes++);
    for (let i = 0; i < 3; i++) {
      expect(w.tryDash()).toBe(true);
      for (let k = 0; k < 6; k++) w.step(DT); // let the dash itself end
    }
    expect(dashes).toBe(3);
    expect(p.dashCharges).toBe(0);
    expect(w.tryDash()).toBe(false);
    expect(w.dashMeter).toBeLessThan(1);
    // one charge back after dashMax seconds
    for (let t = 0; t < p.dashMax + 0.1; t += DT) w.step(DT);
    expect(p.dashCharges).toBe(1);
    expect(w.dashMeter).toBe(1);
    expect(w.tryDash()).toBe(true);
    // default: one charge (the slice's behaviour)
    expect(quiet().player.dashChargesMax).toBe(1);
  });

  test("ultStart, revives, plotArmor, friendship, freeRerolls", () => {
    const w = quiet({ flags: { ultStart: 0.5, revives: 2, plotArmor: 1, friendship: 0.04, freeRerolls: 1 } });
    expect(w.ultMeter).toBe(Math.min(CFG.ultMax, CFG.ultStart + 50));
    expect(w.revivesLeft).toBe(2);
    expect(w.plotArmor).toBe(1);
    expect(w.rerollsLeft).toBe(Infinity);
    const might1 = w.stats.might;
    w.addWeapon("candy_bomb");
    w.step(DT);
    expect(w.stats.might).toBeCloseTo(might1 + 0.04, 9);
    // Plot Armor: a lethal hit leaves the hero at 1 HP once
    let saves = 0;
    w.bus.on("plotArmor", () => saves++);
    w.player.hp = 5;
    expect(w.hurtPlayer(999, 0, 0)).toBe(true);
    expect(w.player.hp).toBe(1);
    expect(w.phase).toBe("play");
    expect(saves).toBe(1);
    w.player.iframes = 0;
    w.hurtPlayer(999, 0, 0);
    expect(w.phase).toBe("dead");
    expect(w.summary().stats.plotArmorSaves).toBe(1);
    expect(w.summary().stats.killedBy).toBe("hit");
  });

  test("free rerolls never run out; chest luck turns plain chests into 3-reward chests", () => {
    const w = quiet({ flags: { freeRerolls: 1 } });
    w.rerolls = 0;
    w.addXp(w.xpNext + 0.1);
    for (let i = 0; i < 10; i++) expect(w.reroll()).not.toBeNull();
    const lucky = quiet({ flags: { chestLuck: 1 } });
    let threes = 0;
    for (let i = 0; i < 20; i++) if (rollChest(lucky, false).rewards.length >= 3) threes++;
    expect(threes).toBe(20);
  });

  test("eliteRate adds elites to every elite event", () => {
    const count = (flags: Record<string, number>) => {
      const w = new World({ hero: "hoshi", seed: 2, god: true, run: run({ flags }) });
      let elites = 0;
      w.hooks.on("eliteSpawn", () => elites++);
      simulate(w, 160, DT, new Bot(1));
      return elites;
    };
    expect(count({})).toBe(1);
    expect(count({ eliteRate: 2 })).toBe(3);
  });
});

describe("banish and skip", () => {
  test("banish removes the item from the pool for the run and replaces the card", () => {
    const w = quiet({ flags: { banish: 2 } });
    w.addXp(w.xpNext + 0.1);
    const offer = w.offer();
    const target = offer.find((c) => w.canBanish(c))!;
    const next = w.banish(target)!;
    expect(next).toBeTruthy();
    expect(w.banishes).toBe(1);
    expect(next.length).toBe(offer.length);
    expect(next.some((c) => c.kind === target.kind && c.id === target.id)).toBe(false);
    expect(w.banished.has(target.id)).toBe(true);
    for (let i = 0; i < 200; i++) expect(makeOffer(w, 4).some((c) => c.id === target.id)).toBe(false);
    expect(w.summary().stats.banishesUsed).toBe(1);
  });

  test("evolutions and the fallback cards can't be banished; no banish left = no banish", () => {
    const w = quiet({ flags: { banish: 1 } });
    expect(w.canBanish({ kind: "heal", id: "heal", name: "", icon: "", desc: "", from: 0, to: 0, rarity: "common" })).toBe(false);
    expect(w.canBanish({ kind: "evolution", id: "galaxy_barrage", name: "", icon: "", desc: "", from: 5, to: 1, rarity: "evolution" })).toBe(false);
    const none = quiet();
    none.addXp(none.xpNext + 0.1);
    expect(none.banish(none.offer()[0])).toBeNull();
  });

  test("skip: no card, an XP + coin refund, one skip spent", () => {
    const w = quiet({ flags: { skip: 1 } });
    w.addXp(w.xpNext + 0.1);
    expect(w.pendingLevels).toBe(1);
    const xp0 = w.xp;
    const coins0 = w.coins;
    const cost = w.xpNext;
    expect(w.skipLevelUp()).toBe(true);
    expect(w.pendingLevels).toBe(0);
    expect(w.skips).toBe(0);
    expect(w.coins).toBe(coins0 + CFG.skipCoins);
    expect(w.xp).toBeCloseTo(xp0 + cost * CFG.skipXp, 6);
    w.addXp(w.xpNext + 0.1);
    expect(w.skipLevelUp()).toBe(false);
    expect(w.summary().stats.skipsUsed).toBe(1);
  });

  test("the bot banishes cards it would never take and skips filler-only offers", () => {
    // (an early account so the run lasts long enough for a full build)
    const w = new World({ hero: "mochi", seed: 6, maxEnemies: 250, run: earlyAccountRun({ flags: { banish: 3, skip: 3 } }) });
    simulate(w, 240, DT, new Bot(2));
    const s = w.summary().stats;
    expect(s.banishesUsed).toBeGreaterThan(0);
    expect(s.banishesUsed).toBeLessThanOrEqual(3);
    expect(w.banished.size).toBe(s.banishesUsed);
  });
});
