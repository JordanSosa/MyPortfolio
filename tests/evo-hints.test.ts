/**
 * Evolution hints on the level-up / chest cards and the pause build list (src/game/evo-hints.ts):
 * the known rule, ready / have / missing / blocked, passive cards completing a pair, several
 * recipes, maxed and Limit-Broken weapons, full slots, and agreement with the sim's own
 * evolution rule (upgrades.ts evolutionCards).
 */
import { describe, expect, test } from "vitest";
import { ALL_KNOWN, NONE_KNOWN, buildEvoHints, cardEvoHints, evoSynergy, evolutionsOf, knownFrom, recipesOf, type EvoBuild } from "../src/game/evo-hints";
import { PASSIVE_BY_ID } from "../src/game/passives";
import { WEAPONS } from "../src/game/registry";
import { defaultRunConfig } from "../src/game/run-config";
import type { UpgradeCard, WeaponDef } from "../src/game/types";
import { evolutionCards } from "../src/game/upgrades";
import { World } from "../src/game/world";

const W = (id: string) => WEAPONS.get(id) as WeaponDef;
const P = (id: string) => ({ def: PASSIVE_BY_ID.get(id)!, level: 1 });

function build(weapons: [string | WeaponDef, number][], passives: string[] = [], over: Partial<EvoBuild> = {}): EvoBuild {
  return {
    weapons: weapons.map(([d, level]) => ({ def: typeof d === "string" ? W(d) : d, level })),
    passives: passives.map(P),
    passiveSlots: 6,
    banished: new Set<string>(),
    ...over,
  };
}

const wcard = (id: string, from: number, to = from + 1): UpgradeCard => ({ kind: "weapon", id, name: id, icon: "", desc: "", from, to, rarity: "common" });
const pcard = (id: string, from = 0): UpgradeCard => ({ kind: "passive", id, name: id, icon: "", desc: "", from, to: from + 1, rarity: "common" });
const knowsYarn = knownFrom(["cosmic_yarn"]);

describe("recipes", () => {
  test("every base weapon's evolution resolves to a real evolved weapon + passive", () => {
    for (const def of WEAPONS.values()) {
      if (def.evolved) {
        expect(recipesOf(def)).toEqual([]);
        continue;
      }
      const r = recipesOf(def);
      expect(r.length).toBe(evolutionsOf(def).length);
      for (const x of r) {
        expect(x.into.evolved).toBe(true);
        expect(PASSIVE_BY_ID.has(x.passive.id)).toBe(true);
      }
    }
  });
  test("yarn orbit + magnet star -> cosmic yarn", () => {
    const [r] = recipesOf(W("yarn_orbit"));
    expect([r.base.id, r.passive.id, r.into.id]).toEqual(["yarn_orbit", "magnet_star", "cosmic_yarn"]);
  });
});

describe("known rule", () => {
  test("an unknown recipe shows nothing; a known one shows", () => {
    const b = build([["yarn_orbit", 2]], ["magnet_star"]);
    expect(cardEvoHints(b, wcard("yarn_orbit", 2), NONE_KNOWN)).toEqual([]);
    expect(cardEvoHints(b, wcard("yarn_orbit", 2), knownFrom(["galaxy_barrage"]))).toEqual([]);
    expect(cardEvoHints(b, wcard("yarn_orbit", 2), knowsYarn)).toHaveLength(1);
    expect(cardEvoHints(b, wcard("yarn_orbit", 2), ALL_KNOWN)).toHaveLength(1);
  });
  test("knownFrom merges the codex and this run's evolutions", () => {
    const k = knownFrom(["star_shot", "cosmic_yarn"], ["galaxy_barrage"]);
    expect(k("cosmic_yarn")).toBe(true);
    expect(k("galaxy_barrage")).toBe(true);
    expect(k("love_tornado")).toBe(false);
  });
  test("heal / coins / evolution cards and passive level-ups get no hint", () => {
    const b = build([["yarn_orbit", 5]], ["magnet_star"]);
    expect(cardEvoHints(b, { ...wcard("heal", 0), kind: "heal" }, ALL_KNOWN)).toEqual([]);
    expect(cardEvoHints(b, { ...wcard("cosmic_yarn", 5, 1), kind: "evolution", base: "yarn_orbit", with: "magnet_star" }, ALL_KNOWN)).toEqual([]);
    expect(cardEvoHints(b, pcard("magnet_star", 1), ALL_KNOWN)).toEqual([]);
  });
});

describe("weapon cards", () => {
  test("READY: the passive is held and the pick reaches the evolve level (the card glows)", () => {
    const [h] = cardEvoHints(build([["yarn_orbit", 4]], ["magnet_star"]), wcard("yarn_orbit", 4), knowsYarn);
    expect(h).toMatchObject({ on: "weapon", state: "ready", from: 4, level: 5, need: 5, readies: true, completes: false });
    expect(evoSynergy([h])).toBe("ready");
  });
  test("HAVE PASSIVE: levels to go, no glow", () => {
    const [h] = cardEvoHints(build([["yarn_orbit", 2]], ["magnet_star"]), wcard("yarn_orbit", 2), knowsYarn);
    expect(h).toMatchObject({ state: "have", from: 2, level: 3, need: 5, readies: false, completes: false });
    expect(evoSynergy([h])).toBeNull();
  });
  test("an epic double level counts its target level", () => {
    const [h] = cardEvoHints(build([["yarn_orbit", 3]], ["magnet_star"]), wcard("yarn_orbit", 3, 5), knowsYarn);
    expect(h).toMatchObject({ state: "ready", readies: true });
  });
  test("MISSING PASSIVE: obtainable but not held", () => {
    const [h] = cardEvoHints(build([["yarn_orbit", 4]], ["wish_charm"]), wcard("yarn_orbit", 4), knowsYarn);
    expect(h).toMatchObject({ state: "missing", readies: false, completes: false });
    expect(h.blocked).toBeUndefined();
  });
  test("a NEW weapon whose passive is already held completes the pair", () => {
    const [h] = cardEvoHints(build([["star_shot", 3]], ["magnet_star"]), wcard("yarn_orbit", 0, 1), knowsYarn);
    expect(h).toMatchObject({ state: "have", from: 0, level: 1, completes: true, readies: false });
    expect(evoSynergy([h])).toBe("pair");
  });
  test("maxed / Limit-Broken weapon: already ready, the Limit Break card does not 'ready' it again", () => {
    const b = build([["yarn_orbit", 5]], ["magnet_star"]);
    const [lb] = cardEvoHints(b, { ...wcard("yarn_orbit", 5, 6), limitBreak: true, max: 7 }, knowsYarn);
    expect(lb).toMatchObject({ state: "ready", readies: false, completes: false });
    const [held] = buildEvoHints(b, knowsYarn);
    expect(held).toMatchObject({ state: "ready", from: 5, level: 5 });
    expect(buildEvoHints(build([["yarn_orbit", 5]]), knowsYarn)[0]).toMatchObject({ state: "missing" });
  });
  test("passive slots full: the missing passive can't be had this run (blocked: slots)", () => {
    const full = build([["yarn_orbit", 3]], ["wish_charm", "twin_charm"], { passiveSlots: 2 });
    expect(cardEvoHints(full, wcard("yarn_orbit", 3), knowsYarn)[0]).toMatchObject({ state: "blocked", blocked: "slots" });
    // ... but a held passive still counts with full slots
    const held = build([["yarn_orbit", 4]], ["magnet_star", "twin_charm"], { passiveSlots: 2 });
    expect(cardEvoHints(held, wcard("yarn_orbit", 4), knowsYarn)[0]).toMatchObject({ state: "ready" });
  });
  test("banished evolution / banished or locked passive: blocked", () => {
    const evoBan = build([["yarn_orbit", 4]], ["magnet_star"], { banished: new Set(["cosmic_yarn"]) });
    expect(cardEvoHints(evoBan, wcard("yarn_orbit", 4), knowsYarn)[0]).toMatchObject({ state: "blocked", blocked: "banished", readies: false });
    const pasBan = build([["yarn_orbit", 4]], [], { banished: new Set(["magnet_star"]) });
    expect(cardEvoHints(pasBan, wcard("yarn_orbit", 4), knowsYarn)[0]).toMatchObject({ state: "blocked", blocked: "banished" });
    const locked = build([["yarn_orbit", 4]], [], { inPool: (_k, id) => id !== "magnet_star" });
    expect(cardEvoHints(locked, wcard("yarn_orbit", 4), knowsYarn)[0]).toMatchObject({ state: "blocked", blocked: "locked" });
  });
});

describe("passive cards", () => {
  test("a NEW passive completing a known recipe for a HELD weapon: 'Evolves X -> Y' with levels to go", () => {
    const [h] = cardEvoHints(build([["yarn_orbit", 3]]), pcard("magnet_star"), knowsYarn);
    expect(h).toMatchObject({ on: "passive", state: "have", level: 3, need: 5, completes: true, readies: false });
    expect(h.base.id).toBe("yarn_orbit");
    expect(h.into.id).toBe("cosmic_yarn");
    expect(evoSynergy([h])).toBe("pair");
  });
  test("... READY when the weapon already sits at its evolve level", () => {
    const [h] = cardEvoHints(build([["yarn_orbit", 5]]), pcard("magnet_star"), knowsYarn);
    expect(h).toMatchObject({ state: "ready", readies: true, completes: true });
    expect(evoSynergy([h])).toBe("ready");
  });
  test("no hint when the weapon is not held or the recipe is unknown", () => {
    expect(cardEvoHints(build([["star_shot", 5]]), pcard("magnet_star"), knowsYarn)).toEqual([]);
    expect(cardEvoHints(build([["yarn_orbit", 5]]), pcard("magnet_star"), NONE_KNOWN)).toEqual([]);
    // an evolved weapon held is no base for another recipe
    expect(cardEvoHints(build([["cosmic_yarn", 1]]), pcard("magnet_star"), ALL_KNOWN)).toEqual([]);
  });
  test("a shared passive lists one line per known recipe (Wish Charm: Star Shot + Paper Crane Flock)", () => {
    const b = build([["star_shot", 5], ["paper_crane_flock", 2]]);
    const both = cardEvoHints(b, pcard("wish_charm"), ALL_KNOWN);
    expect(both.map((h) => [h.base.id, h.into.id, h.state])).toEqual([
      ["star_shot", "galaxy_barrage", "ready"],
      ["paper_crane_flock", "thousand_crane_wish", "have"],
    ]);
    expect(cardEvoHints(b, pcard("wish_charm"), knownFrom(["thousand_crane_wish"])).map((h) => h.into.id)).toEqual(["thousand_crane_wish"]);
  });
});

describe("several evolutions per weapon (data normalised to a list)", () => {
  const multi: WeaponDef = { ...W("yarn_orbit"), id: "test_multi_yarn", evolution: [{ into: "cosmic_yarn", with: "magnet_star" }, { into: "galaxy_barrage", with: "wish_charm" }] as unknown as WeaponDef["evolution"] };
  test("one hint per recipe, each with its own state", () => {
    expect(evolutionsOf(multi)).toHaveLength(2);
    const hints = cardEvoHints(build([[multi, 4]], ["magnet_star"]), wcard("test_multi_yarn", 4), ALL_KNOWN);
    expect(hints.map((h) => [h.into.id, h.state])).toEqual([
      ["cosmic_yarn", "ready"],
      ["galaxy_barrage", "missing"],
    ]);
    expect(evoSynergy(hints)).toBe("ready");
    // only the known one when just one is discovered
    expect(cardEvoHints(build([[multi, 4]]), wcard("test_multi_yarn", 4), knownFrom(["galaxy_barrage"])).map((h) => h.into.id)).toEqual(["galaxy_barrage"]);
  });
  test("a NEW passive card for it lists only the recipe that passive drives", () => {
    const hints = cardEvoHints(build([[multi, 2]]), pcard("wish_charm"), ALL_KNOWN);
    expect(hints.map((h) => h.into.id)).toEqual(["galaxy_barrage"]);
  });
});

describe("the real World", () => {
  test("World satisfies EvoBuild, and READY agrees with the sim's evolution cards", () => {
    const w = new World({ hero: "hoshi", seed: 3, director: false, run: defaultRunConfig() });
    w.addWeapon("yarn_orbit", 4);
    w.addPassive("magnet_star", 1);
    const yarn = w.hasWeapon("yarn_orbit")!;
    const [before] = buildEvoHints(w, ALL_KNOWN).filter((h) => h.base.id === "yarn_orbit");
    expect(before.state).toBe("have");
    expect(evolutionCards(w).some((c) => c.id === "cosmic_yarn")).toBe(false);
    const [pick] = cardEvoHints(w, wcard("yarn_orbit", 4), ALL_KNOWN);
    expect(pick.state).toBe("ready");
    w.setWeaponLevel(yarn, 5);
    expect(evolutionCards(w).some((c) => c.id === "cosmic_yarn")).toBe(true);
    expect(buildEvoHints(w, ALL_KNOWN).find((h) => h.base.id === "yarn_orbit")?.state).toBe("ready");
    // the run's own evolution makes the recipe known (World.weaponsUsed)
    w.evolveWeapon(w.hasWeapon("yarn_orbit")!);
    expect(knownFrom([], w.weaponsUsed)("cosmic_yarn")).toBe(true);
    // a banished evolution is never offered, and never hinted as ready
    const w2 = new World({ hero: "hoshi", seed: 3, director: false, run: defaultRunConfig() });
    w2.addWeapon("yarn_orbit", 5);
    w2.addPassive("magnet_star", 1);
    w2.banished.add("cosmic_yarn");
    expect(evolutionCards(w2).length).toBe(0);
    expect(buildEvoHints(w2, ALL_KNOWN).find((h) => h.base.id === "yarn_orbit")?.state).toBe("blocked");
  });
});

describe("chest reveals (read after the chest)", () => {
  test("a weapon that evolved in the same chest gets no hint; a held evolution is never hinted", () => {
    // the chest took Star Shot 4 -> 5, then evolved it: the build now holds Galaxy Barrage
    const after = build([["galaxy_barrage", 1], ["yarn_orbit", 2]], ["wish_charm"]);
    expect(cardEvoHints(after, wcard("star_shot", 4), ALL_KNOWN)).toEqual([]);
    expect(cardEvoHints(after, pcard("wish_charm"), ALL_KNOWN)).toEqual([]);
    expect(buildEvoHints(after, ALL_KNOWN).map((h) => h.into.id)).toEqual(["cosmic_yarn"]);
  });
});
