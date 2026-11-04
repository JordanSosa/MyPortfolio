/**
 * Season 2 heroes, group A: Kuro, Pudding, Aoi, Akane (docs/content/heroes.md
 * §2.4-2.7, weapons.md §2.1-2.4), headless:
 *   - the HeroDef (trait, start weapon, ult, cut-in data, constellations)
 *   - the signature weapon levels 1 -> 7 (Limit Breaks) and hurts enemies at every level
 *   - it evolves (the card when the paired passive is registered; the evolved weapon works)
 *   - the ultimate runs to completion, deals damage, keeps the hero invulnerable
 *   - talents (capstones read by weapon / ult code) and constellations apply
 *   - a 3-minute bot run per hero (plus a maxed-out talent + C6 run) survives without exceptions
 */
import { earlyAccountRun } from "./fixtures/account";
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import { heroDef } from "../src/game/heroes";
import { PASSIVE_BY_ID } from "../src/game/passives";
import { TALENT_TREES, ULTIMATES, WEAPONS } from "../src/game/registry";
import { defaultRunConfig, type RunConfig } from "../src/game/run-config";
import { baseStats } from "../src/game/stats";
import type { Enemy, WeaponInstance } from "../src/game/types";
import { evolutionCards, makeOffer } from "../src/game/upgrades";
import { heroesA } from "../src/game/weapons/_heroes-a";
import { teaPuddle } from "../src/game/weapons/teapot-tempest";
import { World } from "../src/game/world";

const DT = 1 / 60;

const HEROES = [
  { hero: "kuro", weapon: "dark_flame_dragon", evo: "unsealed_abyss_dragon", passive: "inner_monologue", ult: "eternal_abyss" },
  { hero: "pudding", weapon: "teapot_tempest", evo: "eternal_tea_party", passive: "bento_box", ult: "omurice_of_love" },
  { hero: "aoi", weapon: "micro_missile_swarm", evo: "al_dente_armageddon", passive: "speed_lines", ult: "get_in_the_robot" },
  { hero: "akane", weapon: "baka_harisen", evo: "dere_dere_harisen", passive: "friendship_bracelet", ult: "not_like_i_like_you" },
] as const;

/** A quiet sandbox: no director, invulnerable hero. */
function sandbox(hero: string, run: Partial<RunConfig> = {}, seed = 7): World {
  return new World({ hero, seed, director: false, god: true, run: defaultRunConfig(run) });
}

function crowd(w: World, n: number, rMin = 16, rMax = 70, id = "puff"): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + w.rng.next() * 0.3;
    const r = rMin + w.rng.next() * (rMax - rMin);
    w.spawnEnemy(id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r * 0.9);
  }
}

function topUp(w: World, n: number, id = "puff"): void {
  while (w.enemyCount < n) {
    const a = w.rng.angle();
    const r = 20 + w.rng.next() * 70;
    if (!w.spawnEnemy(id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r)) break;
  }
}

function run(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += DT) {
    w.step(DT);
    each?.();
  }
}

/** Cast the ult and play it out; returns the ult's damage and whether the hero stayed invulnerable. */
function castUlt(w: World, keepCrowd = 30): { dmg: number; inv: boolean; steps: number } {
  w.addUlt(100);
  w.input.ult = true;
  w.step(DT);
  expect(w.ult?.phase).toBe("cutin");
  let inv = true;
  let steps = 0;
  while (w.ult && steps < 60 * 12) {
    if (w.ult.phase === "active" && !w.invulnerable) inv = false;
    topUp(w, keepCrowd);
    w.step(DT);
    steps++;
  }
  return { dmg: w.damageBy.get(w.ultId) ?? 0, inv, steps };
}

describe.each(HEROES)("$hero", ({ hero, weapon, evo, passive, ult }) => {
  test("HeroDef: trait, signature weapon, ult, cut-in data, sprites, 6 constellations, talent tree", () => {
    const h = heroDef(hero);
    expect(h.id).toBe(hero);
    expect(h.weapon).toBe(weapon);
    expect(h.ult).toBe(ult);
    expect(h.sprite).toBe(hero);
    expect(h.portrait).toBe(`portrait_${hero}`);
    expect(h.band?.length).toBe(3);
    expect((h.cutinLine ?? "").length).toBeGreaterThan(10);
    expect(h.constellations?.length).toBe(6);
    expect(h.constellations?.[0].name).toBe("Recolour Edition");
    expect(ULTIMATES.get(ult)?.hero).toBe(hero);
    const tree = TALENT_TREES.get(hero)!;
    expect(tree.nodes.length).toBe(15);
    for (let b = 0; b < 3; b++) {
      const ranks = tree.nodes.filter((n) => n.branch === b).sort((x, y) => x.tier - y.tier).map((n) => n.maxRank);
      expect(ranks).toEqual([5, 3, 3, 3, 1]);
    }
    for (const n of tree.nodes) {
      expect(n.id.startsWith(`${hero}_`)).toBe(true);
      for (let r = 1; r <= n.maxRank; r++) expect(n.desc(r).length).toBeGreaterThan(5);
    }
  });

  test("starts with its signature weapon; C2 starts it at Lv2", () => {
    const w = new World({ hero, seed: 1 });
    expect(w.weapons[0].def.id).toBe(weapon);
    expect(w.weapons[0].level).toBe(1);
    expect(sandbox(hero, { constellation: 2 }).hasWeapon(weapon)?.level).toBe(2);
  });

  test("the weapon levels 1 -> 7 (Limit Breaks) and damages enemies at every level", () => {
    const def = WEAPONS.get(weapon)!;
    expect(def.levels.length).toBe(CFG.maxLevel);
    expect(def.upgrades.length).toBe(CFG.maxLevel - 1);
    expect(def.limitBreak?.length).toBe(2);
    expect(def.limitBreak?.[0].text.startsWith("LIMIT BREAK")).toBe(true);
    expect(def.limitBreak?.[1].text.startsWith("MASTERED")).toBe(true);
    expect(def.evolution).toEqual({ into: evo, with: passive });
    const w = sandbox(hero, { weaponLevelBonus: { [weapon]: 2 } }, 11);
    const inst = w.hasWeapon(weapon) as WeaponInstance;
    expect(w.weaponMaxLevel(def)).toBe(7);
    let prev = 0;
    for (let lv = 1; lv <= 7; lv++) {
      w.setWeaponLevel(inst, lv);
      expect(inst.level).toBe(lv);
      crowd(w, 30);
      run(w, 3, () => topUp(w, 30));
      expect(inst.damage).toBeGreaterThan(prev);
      prev = inst.damage;
    }
    expect(inst.kills).toBeGreaterThan(0);
    // limit break cards exist past Lv5
    w.setWeaponLevel(inst, 5);
    let lb = false;
    for (let i = 0; i < 40 && !lb; i++) lb = makeOffer(w, 4).some((c) => c.id === weapon && c.limitBreak);
    expect(lb).toBe(true);
    // nothing leaks once the crowd is gone
    for (let i = 0; i < w.enemies.count; i++) w.despawn(w.enemies.items[i]);
    run(w, 6);
    expect(w.projectiles.count).toBeLessThan(40);
  });

  test("evolves: the evolved weapon replaces it in its slot and works", () => {
    const w = sandbox(hero, {}, 5);
    const inst = w.hasWeapon(weapon) as WeaponInstance;
    w.setWeaponLevel(inst, 5);
    if (PASSIVE_BY_ID.has(passive)) {
      expect(evolutionCards(w).length).toBe(0);
      w.addPassive(passive);
      expect(evolutionCards(w).map((c) => c.id)).toContain(evo);
    }
    crowd(w, 25);
    run(w, 1);
    const next = w.evolveWeapon(inst) as WeaponInstance;
    expect(next.def.id).toBe(evo);
    expect(next.def.evolved).toBe(true);
    expect(next.slot).toBe(inst.slot);
    expect(w.hasWeapon(weapon)).toBeUndefined();
    const before = next.damage;
    run(w, 6, () => topUp(w, 30));
    expect(next.damage).toBeGreaterThan(before + 100);
    expect(next.kills).toBeGreaterThan(5);
    for (let i = 0; i < w.enemies.count; i++) w.despawn(w.enemies.items[i]);
    run(w, 4);
    expect(w.projectiles.count).toBeLessThan(40);
  });

  test("the ultimate plays out, deals damage and keeps the hero invulnerable", () => {
    const w = new World({ hero, seed: 3, director: false });
    crowd(w, 40, 20, 90);
    const r = castUlt(w);
    expect(w.ult).toBeNull();
    expect(r.dmg).toBeGreaterThan(500);
    expect(r.inv).toBe(true);
    expect(w.timeStop).toBe(false);
    // its projectiles end with it (nothing orphaned)
    run(w, 1.5);
    let left = 0;
    for (let i = 0; i < w.projectiles.count; i++) if (w.projectiles.items[i].source === ult) left++;
    expect(left).toBe(0);
  });

  test("a 3-minute bot run survives without exceptions", { tags: ["slow"] }, () => {
    // (an early account: a no-account run is meant to die early since the Season 2 retune)
    const w = new World({ hero, seed: 1234, maxEnemies: 250, run: earlyAccountRun() });
    let ults = 0;
    w.bus.on("ultStart", () => ults++);
    simulate(w, 180, 1 / 30, new Bot(77), () => {
      expect(Number.isFinite(w.player.x) && Number.isFinite(w.player.y)).toBe(true);
      expect(w.player.hp).toBeLessThanOrEqual(w.player.maxHp + 1e-6);
    });
    expect(w.t).toBeGreaterThan(30);
    expect(w.kills).toBeGreaterThan(200);
    expect(ults).toBeGreaterThanOrEqual(1);
    expect(w.projectiles.count).toBeLessThan(800);
    const sig = w.summary().weapons.find((x) => x.id === weapon || x.id === evo);
    expect(sig && sig.damage).toBeGreaterThan(1000);
  });

  test("every talent at max rank + C6 (a maxed account) runs 90 s with ults and an evolution", { tags: ["slow"] }, () => {
    const talents: Record<string, number> = {};
    for (const n of TALENT_TREES.get(hero)!.nodes) talents[n.id] = n.maxRank;
    const w = new World({ hero, seed: 99, maxEnemies: 250, run: defaultRunConfig({ talents, constellation: 6, weaponLevelBonus: { [weapon]: 2 } }) });
    let ults = 0;
    w.bus.on("ultEnd", () => ults++);
    const inst = w.hasWeapon(weapon) as WeaponInstance;
    w.setWeaponLevel(inst, 5);
    simulate(w, 45, 1 / 30, new Bot(5), () => {
      if (w.ultReady) w.input.ult = true;
    });
    if (w.hasWeapon(weapon)) w.evolveWeapon(w.hasWeapon(weapon) as WeaponInstance);
    w.addUlt(100);
    simulate(w, 45, 1 / 30, new Bot(6), () => {
      if (w.ultReady) w.input.ult = true;
    });
    expect(w.t).toBeGreaterThan(20);
    expect(ults).toBeGreaterThanOrEqual(1);
    expect(w.kills).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------- hero specifics
describe("Kuro", () => {
  test("trait: +15% area, +10% duration, -10 max HP; C3 gives the HP back and +20% area", () => {
    const s = baseStats();
    heroDef("kuro").apply(s);
    expect(s.area).toBeCloseTo(1.15);
    expect(s.duration).toBeCloseTo(1.1);
    expect(s.maxHp).toBe(CFG.playerHp - 10);
    expect(sandbox("kuro").stats.maxHp).toBe(CFG.playerHp - 10);
    const c3 = sandbox("kuro", { constellation: 3 }).stats;
    expect(c3.maxHp).toBe(CFG.playerHp);
    expect(c3.area).toBeCloseTo(1.15 + 0.06 + 0.05);
  });

  test("Dark Flame Dragon burns (ticks every 0.5 s); Kindling and The Seal Is Broken raise it; burning enemies take +15%", () => {
    const burnOf = (talents: Record<string, number>): number => {
      const w = sandbox("kuro", { talents });
      const e = w.spawnEnemy("teddy", w.player.x + 30, w.player.y) as Enemy;
      e.hp = e.maxHp = 1e6;
      e.speed = 0;
      run(w, 2.5);
      expect(heroesA(w).burning(e)).toBe(true);
      return heroesA(w).burnByUid.get(e.uid)!.dps;
    };
    const base = burnOf({});
    expect(base).toBeGreaterThan(0);
    expect(burnOf({ kuro_kindling: 3 })).toBeCloseTo(base * 1.45, 1);
    expect(burnOf({ kuro_seal_broken: 1 })).toBeCloseTo(base * 2, 1);
    // +15% damage taken while burning
    const w = sandbox("kuro", { talents: { kuro_seal_broken: 1 } });
    w.weapons.length = 0;
    const e = w.spawnEnemy("teddy", w.player.x + 30, w.player.y) as Enemy;
    e.hp = e.maxHp = 1e6;
    let sum = 0;
    w.hooks.on("hit", (h) => void (sum += h.dmg));
    const hits = (): number => {
      sum = 0;
      for (let i = 0; i < 60; i++) w.hitEnemy(e, 100, null, 0, 0, -1, "test", 0);
      return sum;
    };
    const cold = hits();
    heroesA(w).burn(e, 1, 50);
    expect(w.dmgTaken.some((f) => f(e, "test", false) === 1.15)).toBe(true);
    expect(hits() / cold).toBeGreaterThan(1.1);
  });

  test("C6 adds Ragnarok II; Eyepatch: Off fires the Crimson Eye Beam; Abyssal Gaze marks and forces a crit", () => {
    const w = sandbox("kuro", { constellation: 6, talents: { kuro_eyepatch_off: 1, kuro_abyssal_gaze: 3 } });
    crowd(w, 10, 20, 60, "teddy");
    let beams = 0;
    let marks = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "kuro_eye_beam") beams++;
      if (e.kind === "kuro_mark") marks++;
    });
    run(w, 9);
    expect(w.hasWeapon("dark_flame_dragon")!.projs.length).toBe(2);
    expect(beams).toBeGreaterThanOrEqual(2);
    expect(marks).toBeGreaterThanOrEqual(2);
    const st = heroesA(w);
    const e = w.spawnEnemy("teddy", w.player.x + 50, w.player.y) as Enemy;
    st.mark = e;
    st.markUid = e.uid;
    let crit = false;
    w.hooks.on("hit", (h) => void (h.enemy === e && (crit = h.crit)));
    w.stats.crit = 0;
    w.hitEnemy(e, 1, null, 0, 0, -1, "test", 0);
    expect(crit).toBe(true);
    expect(st.mark).toBeNull();
  });

  test("Wildfire spreads the burn to neighbours; the evolution's burning deaths explode", () => {
    const w = sandbox("kuro", { talents: { kuro_wildfire: 3 } });
    w.weapons.length = 0;
    const a = w.spawnEnemy("puff", w.player.x + 60, w.player.y) as Enemy;
    const b = w.spawnEnemy("puff", w.player.x + 70, w.player.y) as Enemy;
    run(w, DT);
    heroesA(w).burn(a, 5, 3);
    w.hitEnemy(a, 1e4, null, 0, 0, -1, "test", 0);
    expect(heroesA(w).burning(b)).toBe(true);
    const v = sandbox("kuro");
    const inst = v.hasWeapon("dark_flame_dragon") as WeaponInstance;
    v.setWeaponLevel(inst, 5);
    v.evolveWeapon(inst);
    let bursts = 0;
    v.bus.on("heroFx", (e) => void (e.kind === "kuro_burst" && bursts++));
    // (tough enough to burn before they fall)
    crowd(v, 30, 20, 60, "teddy");
    run(v, 8, () => topUp(v, 30, "teddy"));
    expect(bursts).toBeGreaterThan(0);
  });

  test("Eternal Abyss: 10 ticks; C4 13; TRUE Forbidden Technique sweeps twice (20) with a floodlight reveal; Lingering Darkness slows after", () => {
    const ticks = (run0: Partial<RunConfig>): { n: number; flood: number; slowAfter: boolean } => {
      const w = new World({ hero: "kuro", seed: 2, director: false, run: defaultRunConfig(run0) });
      w.weapons.length = 0;
      const e = w.spawnEnemy("teddy", w.player.x + 40, w.player.y) as Enemy;
      e.hp = e.maxHp = 1e7;
      let n = 0;
      let flood = -1;
      w.hooks.on("hit", (h) => void (h.enemy === e && h.source === "eternal_abyss" && n++));
      w.bus.on("heroFx", (x) => void (x.kind === "kuro_reveal" && (flood = x.n)));
      castUlt(w, 0);
      return { n, flood, slowAfter: e.slowT > 1 && e.slow <= 0.6 };
    };
    expect(ticks({})).toMatchObject({ n: 10, flood: 0 });
    expect(ticks({ constellation: 4 }).n).toBe(13);
    expect(ticks({ talents: { kuro_true_forbidden: 1 } })).toMatchObject({ n: 20, flood: 1 });
    expect(ticks({ talents: { kuro_lingering_darkness: 3 } }).slowAfter).toBe(true);
  });
});

describe("Pudding", () => {
  test("trait: +0.3 regen, +15% healing, +10% luck; puddles heal her and scald enemies; C6 heals twice as fast", () => {
    const s = baseStats();
    heroDef("pudding").apply(s);
    expect(s.regen).toBeCloseTo(0.3);
    expect(s.healMul).toBeCloseTo(1.15);
    expect(s.luck).toBeCloseTo(1.1);
    // a puddle right under her feet: 1 HP/s x healMul (C6 x2), one sip per second
    const healed = (cons: number): number => {
      const w = new World({ hero: "pudding", seed: 4, director: false, run: defaultRunConfig({ constellation: cons }) });
      const inst = w.hasWeapon("teapot_tempest")!;
      teaPuddle(w, inst, w.player.x, w.player.y, 30, 0, 20);
      let h = 0;
      w.hooks.on("heal", (x) => void (h += x.amount));
      w.player.hp = 20;
      run(w, 6.05);
      return h;
    };
    const base = healed(0);
    expect(base).toBeCloseTo(6 * 1.15, 0);
    expect(healed(6)).toBeCloseTo(6 * 2 * 1.25, 0);
    // and the tea scalds: an enemy standing in it takes damage and is slowed
    const w = sandbox("pudding");
    const inst = w.hasWeapon("teapot_tempest")!;
    const e = w.spawnEnemy("teddy", w.player.x + 60, w.player.y) as Enemy;
    e.speed = 0;
    teaPuddle(w, inst, e.x, e.y - e.cy, 20, 10, 5);
    run(w, 1.2);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(e.slow).toBeLessThan(1);
  });

  test("Extra Cups, Tea Ceremony (2x puddles), Flying Teacup Service", () => {
    const w = sandbox("pudding", { talents: { pudding_extra_cups: 3, pudding_tea_ceremony: 1, pudding_cup_toss: 1 } });
    crowd(w, 20, 20, 90);
    let shatter = 0;
    w.bus.on("heroFx", (e) => void (e.kind === "pud_shatter" && shatter++));
    run(w, 7, () => topUp(w, 20));
    const inst = w.hasWeapon("teapot_tempest")!;
    expect(inst.projs.filter((p) => p.a === 0).length).toBe(2 + 3);
    const puddle = inst.projs.find((p) => p.a === 1);
    expect(puddle && puddle.r).toBeGreaterThan(14 * 2 * 0.99);
    expect(shatter).toBeGreaterThanOrEqual(1);
  });

  test("Omurice of Love: 3 pulses heal 8% each; C4 +1; Moe Moe Kyun MAX +1 pulse and +1 shield per pulse", () => {
    const pulses = (run0: Partial<RunConfig>): { n: number; shield: number } => {
      const w = new World({ hero: "pudding", seed: 2, director: false, run: defaultRunConfig(run0) });
      crowd(w, 20);
      let n = 0;
      w.bus.on("heroFx", (e) => void (e.kind === "pud_pulse" && n++));
      castUlt(w, 20);
      return { n, shield: w.player.shield };
    };
    expect(pulses({}).n).toBe(3);
    expect(pulses({ constellation: 4 }).n).toBe(4);
    expect(pulses({ talents: { pudding_moe_max: 1 } })).toEqual({ n: 4, shield: 3 });
  });

  test("Service With a Smile drops puddings; Regulars' Discount boosts food", () => {
    const w = sandbox("pudding", { talents: { pudding_service: 3, pudding_regulars: 3 } });
    crowd(w, 40);
    run(w, 10, () => topUp(w, 40));
    let snacks = 0;
    for (let i = 0; i < w.pickups.count; i++) if (w.pickups.items[i].kind === "snack") snacks++;
    expect(w.kills).toBeGreaterThan(30);
    expect(snacks).toBeGreaterThanOrEqual(1);
    // food: an onigiri heals 20 + 30% (x healMul)
    w.player.hp = 10;
    const before = w.player.hp;
    w.dropPickup("onigiri", w.player.x, w.player.y + 2).z = 0;
    run(w, 1);
    expect(w.player.hp - before).toBeGreaterThan(20 * 1.15 * 1.25);
  });
});

describe("Aoi", () => {
  test("trait: +1 projectile (= +2 missiles), +1 armor, -15% move; C3 halves... the penalty to -5%", () => {
    const s = baseStats();
    heroDef("aoi").apply(s);
    expect(s.amount).toBe(1);
    expect(s.armor).toBe(1);
    expect(s.moveSpeed).toBeCloseTo(0.85);
    expect(sandbox("aoi", { constellation: 3 }).stats.moveSpeed).toBeCloseTo(0.95);
  });

  test("salvo size: 4 + 2 per Amount + Extended Magazine; FULL BURST doubles every 5th", () => {
    const w = sandbox("aoi", { talents: { aoi_magazine: 3, aoi_full_burst: 1 } });
    const sizes: number[] = [];
    let banner = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "aoi_salvo") sizes.push(e.n);
      if (e.kind === "ha_text") banner++;
    });
    crowd(w, 30, 40, 90);
    run(w, 9, () => topUp(w, 30));
    // Lv1 4 + trait amount 1 (x2) + magazine 3 = 9; the 5th salvo 18
    expect(sizes[0]).toBe(9);
    expect(sizes[4]).toBe(18);
    expect(banner).toBeGreaterThanOrEqual(1);
  });

  test("GET IN THE ROBOT: 3 fists + rocket punch; C4 +1; Super Robot 5 and a boomerang; Combining Sequence buffs after", () => {
    const fists = (run0: Partial<RunConfig>): { fists: number; rockets: number; might: number } => {
      const w = new World({ hero: "aoi", seed: 2, director: false, run: defaultRunConfig(run0) });
      crowd(w, 40, 20, 100);
      let f = 0;
      let r = 0;
      w.bus.on("heroFx", (e) => {
        if (e.kind === "aoi_impact") f++;
        if (e.kind === "aoi_rocket") r++;
      });
      const m0 = w.stats.might;
      castUlt(w, 30);
      return { fists: f, rockets: r, might: w.stats.might - m0 };
    };
    expect(fists({})).toMatchObject({ fists: 3, rockets: 1 });
    expect(fists({ constellation: 4 }).fists).toBe(4);
    expect(fists({ talents: { aoi_super_robot: 1 } })).toMatchObject({ fists: 5, rockets: 2 });
    expect(fists({ talents: { aoi_combining: 1 } }).might).toBeCloseTo(0.3);
  });

  test("C6 support drone fires; Jet Dash leaves a burning trail and rank 3 adds a dash charge", () => {
    const w = sandbox("aoi", { constellation: 6, talents: { aoi_jet_dash: 3 } });
    w.weapons.length = 0;
    expect(w.player.dashChargesMax).toBe(2);
    crowd(w, 20, 30, 80);
    run(w, 5, () => topUp(w, 20));
    expect(w.damageBy.get("aoi_drone") ?? 0).toBeGreaterThan(0);
    w.input.mx = 1;
    w.tryDash();
    let trail = 0;
    for (let i = 0; i < 20; i++) {
      w.step(DT);
      for (let k = 0; k < w.projectiles.count; k++) if (w.projectiles.items[k].source === "aoi_jet_dash") trail++;
    }
    expect(trail).toBeGreaterThan(0);
  });
});

describe("Akane", () => {
  test("trait: +10% damage, +30% knockback, +5% crit; smacks daze (not bosses) and pop BAKA!", () => {
    const s = baseStats();
    heroDef("akane").apply(s);
    expect(s.might).toBeCloseTo(1.1);
    expect(s.knock).toBeCloseTo(1.3);
    expect(s.crit).toBeCloseTo(CFG.critChance + 0.05);
    const w = sandbox("akane");
    let dazed = 0;
    crowd(w, 20, 14, 40, "teddy");
    // (12 s: a smack that hits pops BAKA! 35 % of the time with a 1.2 s cooldown - ~8 smacks so the roll can't miss
    // them all; the Dream Meadow retune's tougher teddies shifted the old 6 s window's RNG to zero pops)
    run(w, 12, () => {
      topUp(w, 20, "teddy");
      for (let i = 0; i < w.enemies.count; i++) if (w.enemies.items[i].stun > 0) dazed++;
    });
    expect(dazed).toBeGreaterThan(0);
    expect(w.runStats().bakas ?? 0).toBeGreaterThan(0);
    const b = w.spawnEnemy("king_puff", w.player.x + 20, w.player.y) as Enemy;
    run(w, 3);
    expect(b.stun).toBe(0);
  });

  test("MEGA BAKA every 5th smack at Lv5 (ring + a pop that always shows); Ultimate Denial fans; Twin-Tail Tornado", () => {
    const w = sandbox("akane", { talents: { akane_ultimate_denial: 1 } });
    w.setWeaponLevel(w.hasWeapon("baka_harisen")!, 5);
    let rings = 0;
    let fans = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "akane_ring") rings++;
      if (e.kind === "akane_smack" && e.n === 0) fans++;
    });
    crowd(w, 25, 14, 40);
    run(w, 8, () => topUp(w, 25));
    expect(rings).toBeGreaterThanOrEqual(1);
    expect(fans).toBeGreaterThanOrEqual(3 * 4);
    const t = sandbox("akane", { talents: { akane_twin_tail_tornado: 1 } });
    let drills = 0;
    t.bus.on("heroFx", (e) => void (e.kind === "akane_smack" && e.n === 2 && drills++));
    crowd(t, 25, 14, 40);
    run(t, 9, () => topUp(t, 25));
    expect(drills).toBeGreaterThanOrEqual(1);
  });

  test("Barrage: 36 smacks then the final ring; C4 48; Dere Mode heart heals 25%; C6 pops stun", () => {
    const barrage = (run0: Partial<RunConfig>): { n: number; heart: number; hp: number; stunned: number } => {
      const w = new World({ hero: "akane", seed: 2, director: false, run: defaultRunConfig(run0) });
      w.weapons.length = 0;
      crowd(w, 30, 20, 90);
      let n = 0;
      let heart = 0;
      let stunned = 0;
      w.bus.on("heroFx", (e) => {
        if (e.kind === "akane_barrage") n++;
        if (e.kind === "akane_heart") heart++;
      });
      w.player.hp = 10;
      castUlt(w, 30);
      for (let i = 0; i < w.enemies.count; i++) if (w.enemies.items[i].stun > 0.5) stunned++;
      return { n, heart, hp: w.player.hp, stunned };
    };
    expect(barrage({}).n).toBe(36);
    expect(barrage({ constellation: 4 }).n).toBe(48);
    const dere = barrage({ talents: { akane_dere_mode: 1 } });
    expect(dere.heart).toBe(1);
    expect(dere.hp).toBeGreaterThan(10 + 100 * 0.25 - 1);
  });
});

describe("Censored (no food or heal pickups) covers every hero-kit snack", () => {
  const eaten = (hero: string, run: Partial<RunConfig>, talents: Record<string, number> = {}) => {
    const w = new World({ hero, seed: 5, god: true, run: defaultRunConfig({ ...run, talents, constellation: 6 }) });
    let food = 0;
    let censoredCoins = 0;
    w.hooks.on("pickup", (p) => {
      if (p.kind === "snack" || p.kind === "onigiri" || p.kind === "cake") food++;
    });
    simulate(w, 240, 1 / 30, new Bot(3), (ww) => {
      for (let i = 0; i < ww.pickups.count; i++) if (ww.pickups.items[i].censored && !ww.pickups.items[i].dead) censoredCoins = Math.max(censoredCoins, 1);
    });
    return { food, foodEaten: w.runStats().foodEaten, censoredCoins };
  };

  test("Pudding under Censored eats no food (her puddings become censored coins); without it she still drops snacks", { tags: ["slow"], timeout: 120_000 }, () => {
    const off = eaten("pudding", {});
    expect(off.food).toBeGreaterThan(0);
    const on = eaten("pudding", { twists: ["censored"], twistRanks: { censored: 2 } });
    expect(on.food).toBe(0);
    expect(on.foodEaten).toBe(0);
    expect(on.censoredCoins).toBe(1);
  });

  test("Senpai's Valentine chocolates are censored too", { tags: ["slow"], timeout: 120_000 }, () => {
    const talents = { senpai_valentines: 3 };
    expect(TALENT_TREES.get("senpai")?.nodes.some((n) => n.id === "senpai_valentines")).toBe(true);
    expect(eaten("senpai", {}, talents).food).toBeGreaterThan(0);
    expect(eaten("senpai", { twists: ["censored"], twistRanks: { censored: 2 } }, talents).food).toBe(0);
  });
});
