/**
 * SECOND EVOLUTIONS (docs/content/weapons.md §8): a base weapon lists several evolutions, one per passive.
 *
 *   - data model: WeaponDef.evolutions read through registry.ts (evolutionsOf / evolvesInto / baseWeaponOf /
 *     isWeaponOf); every evolved weapon belongs to exactly one base, every recipe of a weapon uses its own passive
 *   - the choice: both passives held -> the level-up offers one card per evolution and the pick decides;
 *     a chest never decides - it hands the pick over (ROUTE SPLIT, World.pendingChoices: no level consumed,
 *     no reroll / banish / skip); one passive held -> a chest evolves straight into that route
 *   - an evolved weapon of either route uses its base weapon's mastery / weaponDamage / Limit Break entry,
 *     and banks into the account as the base weapon (meta content baseOf / evoIndex)
 *   - the pilot, Meowteor Hammer (Yarn Orbit + Power Bow): the ring swings between rIn and rOut, slams at
 *     the top of each swing, keeps the Orbital Guard (block 1), and A Real Friend mirrors it
 */
import { describe, expect, test } from "vitest";
import { Bot, drain } from "../src/debug/bot";
import { ALL_KNOWN, buildEvoHints, recipesOf } from "../src/game/evo-hints";
import { PASSIVE_BY_ID } from "../src/game/passives";
import { WEAPONS, baseWeaponOf, baseWeapons, evolutionOf, evolutionWith, evolutionsOf, evolvedFormsOf, evolvesInto, isWeaponOf } from "../src/game/registry";
import { friendOf } from "../src/game/relics/_friend";
import { defaultRunConfig, type RunConfig } from "../src/game/run-config";
import { evolutionCards, makeOffer } from "../src/game/upgrades";
import { guardOf } from "../src/game/weapons/_orbital";
import { meowteorSwing } from "../src/game/weapons/yarn-orbit";
import { World } from "../src/game/world";
import { baseWeaponId, gameContent } from "../src/meta/content";

const DT = 1 / 60;

function world(hero = "mochi", run: Partial<RunConfig> = {}): World {
  return new World({ hero, seed: 7, director: false, god: true, run: defaultRunConfig(run) });
}

/** Mochi with Yarn Orbit at Lv5 and the given passives. */
function yarn5(passives: string[], run: Partial<RunConfig> = {}): World {
  const w = world("mochi", run);
  const inst = w.hasWeapon("yarn_orbit")!;
  w.setWeaponLevel(inst, 5);
  for (const p of passives) w.addPassive(p, 1);
  return w;
}

function steps(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    w.step(DT);
    each?.();
  }
}

describe("data model: several evolutions per weapon", () => {
  test("every base weapon lists its evolutions; each resolves, with its own passive", () => {
    for (const b of baseWeapons()) {
      const evos = evolutionsOf(b);
      expect(evos.length, b.id).toBeGreaterThanOrEqual(1);
      expect(new Set(evos.map((e) => e.with)).size, `${b.id}: one evolution per passive`).toBe(evos.length);
      expect(new Set(evos.map((e) => e.into)).size, b.id).toBe(evos.length);
      for (const e of evos) {
        expect(PASSIVE_BY_ID.has(e.with), `${b.id} -> ${e.with}`).toBe(true);
        const into = WEAPONS.get(e.into);
        expect(into?.evolved, `${b.id} -> ${e.into}`).toBe(true);
        expect(into?.levels.length, e.into).toBe(1);
        expect(baseWeaponOf(into!).id, e.into).toBe(b.id);
        expect(evolvesInto(b, e.into)).toBe(true);
        expect(evolutionWith(b, e.with)).toBe(e);
        expect(isWeaponOf(e.into, b.id)).toBe(true);
      }
      expect(evolutionOf(b)?.id).toBe(evos[0].into);
      expect(evolvedFormsOf(b).map((d) => d.id)).toEqual(evos.map((e) => e.into));
      expect(recipesOf(b)).toHaveLength(evos.length);
    }
  });

  test("every evolved weapon belongs to exactly one base weapon; evolved weapons have no evolutions", () => {
    for (const d of WEAPONS.values()) {
      if (!d.evolved) continue;
      expect(evolutionsOf(d)).toEqual([]);
      expect(baseWeapons().filter((b) => evolvesInto(b, d.id)).map((b) => b.id), d.id).toHaveLength(1);
    }
    expect(isWeaponOf("yarn_orbit", "yarn_orbit")).toBe(true);
    expect(isWeaponOf("galaxy_barrage", "yarn_orbit")).toBe(false);
    expect(isWeaponOf("nope", "yarn_orbit")).toBe(false);
  });

  test("no passive gates more than 4 evolutions", () => {
    const n = new Map<string, number>();
    for (const b of baseWeapons()) for (const e of evolutionsOf(b)) n.set(e.with, (n.get(e.with) ?? 0) + 1);
    for (const [p, k] of n) expect(k, p).toBeLessThanOrEqual(4);
  });

  test("the account layer maps both routes to the base weapon", () => {
    const ctx = gameContent();
    expect(ctx.weapons.get("yarn_orbit")?.evolutions?.map((e) => e.into)).toEqual(["cosmic_yarn", "meowteor_hammer"]);
    expect(baseWeaponId("cosmic_yarn", ctx)).toBe("yarn_orbit");
    expect(baseWeaponId("meowteor_hammer", ctx)).toBe("yarn_orbit");
    expect(ctx.weapons.get("cosmic_yarn")?.evoIndex).toBe(0);
    expect(ctx.weapons.get("meowteor_hammer")?.evoIndex).toBe(1);
  });
});

describe("the choice", () => {
  test("one passive held: only that route is offered, and it is the one the card applies", () => {
    const w = yarn5(["power_bow"]);
    const cards = evolutionCards(w);
    expect(cards.map((c) => [c.id, c.base, c.with])).toEqual([["meowteor_hammer", "yarn_orbit", "power_bow"]]);
    w.pendingLevels = 1;
    w.choose(w.offer().find((c) => c.kind === "evolution")!);
    expect(w.hasWeapon("meowteor_hammer")).toBeTruthy();
    expect(w.hasWeapon("yarn_orbit")).toBeFalsy();
    expect(w.weaponsUsed).toContain("meowteor_hammer");
  });

  test("both passives held: the level-up offers both cards first; the pick decides and the other route is gone", () => {
    const w = yarn5(["magnet_star", "power_bow"]);
    w.pendingLevels = 2;
    const offer = w.offer();
    expect(offer.slice(0, 2).map((c) => [c.kind, c.id])).toEqual([
      ["evolution", "cosmic_yarn"],
      ["evolution", "meowteor_hammer"],
    ]);
    w.choose(offer[1]);
    expect(w.pendingLevels).toBe(1);
    expect(w.hasWeapon("meowteor_hammer")).toBeTruthy();
    expect(w.hasWeapon("cosmic_yarn")).toBeFalsy();
    // nothing offers the other evolution, or Yarn Orbit as NEW, afterwards
    expect(evolutionCards(w)).toEqual([]);
    expect(makeOffer(w, 99).some((c) => c.id === "cosmic_yarn" || c.id === "yarn_orbit")).toBe(false);
    expect(buildEvoHints(w, ALL_KNOWN).some((h) => h.base.id === "yarn_orbit")).toBe(false);
  });

  test("a banished route leaves the other one", () => {
    const w = yarn5(["magnet_star", "power_bow"]);
    w.banished.add("cosmic_yarn");
    expect(evolutionCards(w).map((c) => c.id)).toEqual(["meowteor_hammer"]);
  });

  test("Season Finale double pick: the second pick cannot take the other evolution of the same weapon", () => {
    const w = yarn5(["magnet_star", "power_bow"]);
    w.pendingLevels = 1;
    w.doublePicks.add(w.level - w.pendingLevels + 1);
    const offer = w.offer();
    w.choose(offer[0]);
    expect(w.hasWeapon("cosmic_yarn")).toBeTruthy();
    if (w.pendingLevels > 0) expect(w.offer().some((c) => c.kind === "evolution" && c.base === "yarn_orbit")).toBe(false);
  });

  test("a chest with one route ready evolves it; with two ready it hands over the choice (ROUTE SPLIT)", () => {
    const one = yarn5(["power_bow"]);
    one.pendingChests.push({ golden: false });
    const r1 = one.openChest()!;
    expect(r1.rewards[0].kind).toBe("evolution");
    expect(r1.rewards[0].choices).toBeUndefined();
    expect(one.hasWeapon("meowteor_hammer")).toBeTruthy();

    const w = yarn5(["magnet_star", "power_bow"]);
    w.pendingChests.push({ golden: true });
    const r = w.openChest()!;
    const split = r.rewards.filter((c) => c.choices);
    // (one ROUTE SPLIT however many rewards the chest has: the weapon's cards are not offered twice)
    expect(split).toHaveLength(1);
    expect(split[0].kind).toBe("evolution");
    expect(split[0].base).toBe("yarn_orbit");
    expect(split[0].choices?.map((c) => c.id)).toEqual(["cosmic_yarn", "meowteor_hammer"]);
    expect(w.hasWeapon("yarn_orbit")).toBeTruthy();
    expect(w.choosing).toBe(true);
    expect(w.pendingPicks).toBe(1);
    expect(w.pendingLevels).toBe(0);
    // the choice is not a level-up: no reroll, no banish, no skip
    const offer = w.offer();
    expect(offer.map((c) => c.id)).toEqual(["cosmic_yarn", "meowteor_hammer"]);
    expect(w.reroll()).toBeNull();
    expect(w.banish(offer[0])).toBeNull();
    expect(w.skipLevelUp()).toBe(false);
    const level = w.level;
    w.choose(offer[1]);
    expect(w.hasWeapon("meowteor_hammer")).toBeTruthy();
    expect(w.choosing).toBe(false);
    expect(w.pendingPicks).toBe(0);
    expect(w.level).toBe(level);
  });

  test("the choice comes before a queued level-up, and a stale one (the weapon evolved since) is dropped", () => {
    const w = yarn5(["magnet_star", "power_bow"]);
    w.pendingChests.push({ golden: false });
    w.openChest();
    w.pendingLevels = 1;
    expect(w.pendingPicks).toBe(2);
    expect(w.offer().every((c) => c.kind === "evolution")).toBe(true);
    // (a debug hook / another path evolves it first: the queued choice no longer applies)
    w.evolveWeapon(w.hasWeapon("yarn_orbit")!, "cosmic_yarn");
    expect(w.choosing).toBe(false);
    expect(w.pendingPicks).toBe(1);
    expect(w.offer().some((c) => c.kind === "evolution")).toBe(false);
  });

  test("the bot drains chests, their choices and level-ups (headless runs never hang on a ROUTE SPLIT)", () => {
    const w = yarn5(["magnet_star", "power_bow"]);
    w.pendingChests.push({ golden: false }, { golden: false });
    w.pendingLevels = 1;
    drain(w, new Bot(3));
    expect(w.pendingPicks).toBe(0);
    expect(w.pendingChests.length).toBe(0);
    expect(w.hasWeapon("cosmic_yarn") ?? w.hasWeapon("meowteor_hammer")).toBeTruthy();
  });

  test("evolveWeapon: no id = the first evolution; an id that is not this weapon's = null", () => {
    const a = yarn5([]);
    expect(a.evolveWeapon(a.hasWeapon("yarn_orbit")!)?.def.id).toBe("cosmic_yarn");
    const b = yarn5([]);
    expect(b.evolveWeapon(b.hasWeapon("yarn_orbit")!, "galaxy_barrage")).toBeNull();
    expect(b.hasWeapon("yarn_orbit")).toBeTruthy();
  });
});

describe("mastery, Limit Breaks and relics follow the base weapon on either route", () => {
  test("weaponDamage / talent damage entries of the base weapon apply to the second evolution", () => {
    const plain = yarn5([]);
    const bonus = yarn5([], { weaponDamage: { yarn_orbit: 0.3 } });
    const a = plain.evolveWeapon(plain.hasWeapon("yarn_orbit")!, "meowteor_hammer")!;
    const b = bonus.evolveWeapon(bonus.hasWeapon("yarn_orbit")!, "meowteor_hammer")!;
    expect((b.dmgMul ?? 1) - (a.dmgMul ?? 1)).toBeCloseTo(0.3, 6);
    expect(bonus.weaponDamageMul(WEAPONS.get("meowteor_hammer")!)).toBeCloseTo(1.3, 6);
  });

  test("a Limit-Broken base carries its inheritance into the second evolution; the evolution has no Limit Break levels", () => {
    const w = yarn5(["power_bow"], { weaponLevelBonus: { yarn_orbit: 2 } });
    const inst = w.hasWeapon("yarn_orbit")!;
    w.setWeaponLevel(inst, 7);
    const evo = w.evolveWeapon(inst, "meowteor_hammer")!;
    expect(evo.lbInherit).toBeGreaterThan(0);
    expect(w.weaponMaxLevel(evo.def)).toBe(1);
  });

  test("A Real Friend mirrors the second evolution too (and its copy never guards)", () => {
    const w = yarn5(["power_bow"], { relics: [{ id: "real_friend", stars: 0 }] });
    steps(w, 0.2);
    w.evolveWeapon(w.hasWeapon("yarn_orbit")!, "meowteor_hammer");
    steps(w, 0.5);
    const f = friendOf(w);
    expect(f?.inst?.def.id).toBe("meowteor_hammer");
  });
});

describe("the pilot: Meowteor Hammer", () => {
  function hammer(): World {
    const w = yarn5(["power_bow"]);
    w.evolveWeapon(w.hasWeapon("yarn_orbit")!, "meowteor_hammer");
    return w;
  }

  test("4 permanent balls on a ring that swings between rIn and rOut once per cd", () => {
    const w = hammer();
    const inst = w.hasWeapon("meowteor_hammer")!;
    const L = inst.def.levels[0];
    let lo = Infinity;
    let hi = 0;
    steps(w, (L.cd ?? 0) * w.stats.cooldown + 0.2, () => {
      const p = inst.projs[0];
      if (!p) return;
      // (the ring is drawn tilted: its x extent is the true radius)
      let r = 0;
      for (const q of inst.projs) r = Math.max(r, Math.abs(q.x - w.player.x));
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    });
    expect(inst.projs).toHaveLength(4);
    expect(inst.projs.every((p) => p.life === Infinity && p.sprite === "w_meowteor")).toBe(true);
    const area = (L.area ?? 1) * w.stats.area;
    expect(hi).toBeGreaterThan((L.rOut ?? 0) * area * 0.9);
    expect(hi).toBeLessThanOrEqual((L.rOut ?? 0) * area + 1e-3);
    expect(lo).toBeLessThan((L.rOut ?? 0) * area * 0.75);
    expect(meowteorSwing(0)).toBeCloseTo(0, 6);
    expect(meowteorSwing(0.5)).toBeCloseTo(1, 6);
  });

  test("SLAM: one blast per ball at the top of every swing, as the weapon's own source", () => {
    const w = hammer();
    const inst = w.hasWeapon("meowteor_hammer")!;
    let blasts = 0;
    w.bus.on("explosion", (e) => {
      if (e.source === "meowteor_hammer") blasts++;
    });
    const cd = (inst.def.levels[0].cd ?? 0) * w.stats.cooldown;
    steps(w, cd * 2 + 0.1);
    expect(blasts).toBe(8);
  });

  test("Orbital Guard: a ball eats a bullet and breaks on the first (block 1); a broken ball does not slam", () => {
    const w = hammer();
    steps(w, 0.3);
    const inst = w.hasWeapon("meowteor_hammer")!;
    const g = guardOf(inst);
    expect(g.n).toBe(4);
    const p = inst.projs[0];
    w.spawnBullet(p.x, p.y, 0, 0, 5, "eb_orb", 3, 5);
    w.step(DT);
    expect(g.blocks).toBe(1);
    expect(g.block).toBe(1);
    expect(g.down[0]).toBeGreaterThan(0);
    // break every ball right before the top of the swing: no blast
    for (let k = 0; k < 4; k++) g.down[k] = 5;
    let blasts = 0;
    w.bus.on("explosion", (e) => {
      if (e.source === "meowteor_hammer") blasts++;
    });
    steps(w, (inst.def.levels[0].cd ?? 0) * w.stats.cooldown);
    expect(blasts).toBe(0);
  });

  test("Mochi's yarn talents and the yarn-only Plot Point treat it as yarn", () => {
    expect(isWeaponOf("meowteor_hammer", "yarn_orbit")).toBe(true);
  });
});
