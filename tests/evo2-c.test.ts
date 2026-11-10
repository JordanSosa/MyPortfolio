/**
 * SECOND EVOLUTIONS, package C (docs/content/weapons.md §8): Unbandaged Right Arm (Kuro), Table-Flip Tea
 * Service (Pudding), Final Episode Budget Missile (Aoi), Tsun Tsun Drill Harisen (Akane). The registry-wide
 * rules (table row, def shape, base mapping) are checked by tests/evo2.test.ts and tests/coverage.test.ts.
 */
import { describe, expect, test } from "vitest";
import { FIRE_SOURCES } from "../src/game/enemies/_candy";
import { isWeaponOf } from "../src/game/registry";
import { defaultRunConfig } from "../src/game/run-config";
import type { Enemy, WeaponInstance } from "../src/game/types";
import { heroesA } from "../src/game/weapons/_heroes-a";
import { guardOf } from "../src/game/weapons/_orbital";
import { HFX_AKANE_DRILL } from "../src/game/weapons/baka-harisen";
import { HFX_KURO_CLAW } from "../src/game/weapons/dark-flame-dragon";
import { CRATER } from "../src/game/weapons/micro-missile-swarm";
import { World } from "../src/game/world";

const DT = 1 / 60;

/** The hero with their signature weapon at Lv5, evolved down the second route through its passive. */
function evolved(hero: string, base: string, passive: string, into: string): { w: World; inst: WeaponInstance } {
  const w = new World({ hero, seed: 7, director: false, god: true, run: defaultRunConfig() });
  w.setWeaponLevel(w.hasWeapon(base)!, 5);
  w.addPassive(passive, 1);
  const card = w.offer().find((c) => c.kind === "evolution" && c.id === into);
  expect(card, `${into} is offered`).toBeTruthy();
  const inst = w.evolveWeapon(w.hasWeapon(base)!, into)!;
  expect(inst.def.id).toBe(into);
  expect(isWeaponOf(into, base)).toBe(true);
  return { w, inst };
}

/** An enemy that stays where it is put and does not die. */
function dummy(w: World, dx: number, dy: number): Enemy {
  const e = w.spawnEnemy("puff", w.player.x + dx, w.player.y + dy)!;
  e.maxHp = e.hp = 1e9;
  e.stun = 1e6;
  return e;
}

function steps(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    w.step(DT);
    each?.();
  }
}

describe("Unbandaged Right Arm (Dark Flame Dragon + Main Character Aura)", () => {
  const arm = () => evolved("kuro", "dark_flame_dragon", "main_character_aura", "unbandaged_right_arm");

  test("no familiars: a claw swipes where Kuro faces, burns what it hits, and nothing behind him", () => {
    const { w, inst } = arm();
    const front = dummy(w, 30, 0);
    const back = dummy(w, -30, 0);
    let cues = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === HFX_KURO_CLAW) cues++;
    });
    steps(w, 0.5);
    expect(inst.projs).toHaveLength(0);
    expect(cues).toBe(1);
    expect(front.hp).toBeLessThan(1e9);
    expect(back.hp).toBe(1e9);
    const st = heroesA(w);
    expect(st.burning(front)).toBe(true);
    expect(st.burning(back)).toBe(false);
    expect(st.burnSource).toBe("unbandaged_right_arm");
    expect(FIRE_SOURCES.has("unbandaged_right_arm")).toBe(true);
  });

  test("every 4th swipe is the named attack: a longer reach and a guaranteed crit", () => {
    const { w, inst } = arm();
    const L = inst.def.levels[0];
    // just past a normal swipe's reach, inside the named one's
    const far = dummy(w, (L.len ?? 0) * w.stats.area + 16, 0);
    dummy(w, 20, 0);
    const named: number[] = [];
    const reach: number[] = [];
    w.bus.on("heroFx", (e) => {
      if (e.kind !== HFX_KURO_CLAW) return;
      named.push(e.n);
      reach.push(e.r);
    });
    const crits: boolean[] = [];
    w.hooks.on("hit", (h) => {
      if (h.enemy === far && h.source === "unbandaged_right_arm" && h.dmg > 20) crits.push(h.crit);
    });
    steps(w, L.cd * w.stats.cooldown * 4 + 0.3);
    expect(named.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(reach[3]).toBeCloseTo(reach[0] * 1.5, 3);
    // (only the named swipe reaches it; its hit is a crit)
    expect(crits).toEqual([true]);
  });

  test("crits on burning enemies deal extra crit damage", () => {
    const { w, inst } = arm();
    const e = dummy(w, 20, 0);
    const k = inst.def.levels[0].critBurn ?? 0;
    expect(k).toBeGreaterThan(0);
    const mul = (crit: boolean, source: string) => w.dmgTaken.reduce((m, f) => m * f(e, source, crit), 1);
    expect(mul(true, "unbandaged_right_arm")).toBeCloseTo(1, 6);
    heroesA(w).burn(e, 5, 3);
    expect(mul(true, "unbandaged_right_arm")).toBeCloseTo(1 + k / w.stats.critMult, 6);
    expect(mul(false, "unbandaged_right_arm")).toBeCloseTo(1, 6);
    expect(mul(true, "star_shot")).toBeCloseTo(1, 6);
  });
});

describe("Table-Flip Tea Service (Teapot Tempest + Speed Lines)", () => {
  const flip = () => evolved("pudding", "teapot_tempest", "speed_lines", "table_flip_service");
  const cups = (inst: WeaponInstance, a: number) => inst.projs.filter((p) => p.a === a && !p.dead);

  test("five cups orbit; the one nearest an enemy is flung as a saucer and comes home to its slot", () => {
    const { w, inst } = flip();
    steps(w, 0.05);
    expect(cups(inst, 0)).toHaveLength(5);
    const e = dummy(w, 100, 0);
    let out = 0;
    let maxD = 0;
    steps(w, 0.6, () => {
      const f = cups(inst, 4);
      out = Math.max(out, f.length);
      for (const p of f) {
        expect(p.sprite).toBe("w_saucer");
        maxD = Math.max(maxD, Math.abs(p.x - w.player.x));
      }
      // (a flung cup is never replaced in the ring)
      expect(cups(inst, 0).length + f.length).toBe(5);
    });
    expect(out).toBe(1);
    expect(maxD).toBeGreaterThan(90);
    expect(e.hp).toBeLessThan(1e9);
    w.despawn(e);
    steps(w, 1.5);
    expect(cups(inst, 4)).toHaveLength(0);
    expect(cups(inst, 0)).toHaveLength(5);
    expect(cups(inst, 0).every((p) => p.sprite === "" && p.r > 0)).toBe(true);
  });

  test("a flung cup does not guard; the cups at home do (block 1)", () => {
    const { w, inst } = flip();
    steps(w, 0.05);
    dummy(w, 100, 0);
    let flung = -1;
    for (let i = 0; i < 40 && flung < 0; i++) {
      w.step(DT);
      flung = inst.projs.filter((p) => p.a === 0 || p.a === 4).findIndex((p) => p.a === 4);
    }
    expect(flung).toBeGreaterThanOrEqual(0);
    const g = guardOf(inst);
    const saucer = cups(inst, 4)[0];
    // a bullet on the saucer flies on; a bullet on a cup at home is eaten
    w.spawnBullet(saucer.x, saucer.y, saucer.vx, saucer.vy, 5, "eb_orb", 3, 5);
    w.step(DT);
    expect(g.blocks).toBe(0);
    const home = cups(inst, 0)[0];
    w.spawnBullet(home.x, home.y, 0, 0, 5, "eb_orb", 3, 5);
    w.step(DT);
    expect(g.blocks).toBe(1);
    expect(g.block).toBe(1);
  });

  test("Warm Tea stays: a puddle is poured on her path and brushing it warms her up", () => {
    const { w, inst } = flip();
    steps(w, 1);
    expect(cups(inst, 1).length).toBeGreaterThanOrEqual(1);
    expect(inst.data.warm ?? 0).toBeGreaterThan(0);
  });
});

describe("Final Episode Budget Missile (Micro Missile Swarm + Big Ribbon)", () => {
  const budget = () => evolved("aoi", "micro_missile_swarm", "big_ribbon", "budget_missile");

  test("one big missile per launch: it lands on the pack as a big blast and leaves a burning crater", () => {
    const { w, inst } = budget();
    for (let i = 0; i < 6; i++) dummy(w, 90 + (i % 3) * 6, -20 + i * 5);
    const blasts: { big: boolean; r: number }[] = [];
    w.bus.on("explosion", (e) => {
      if (e.source === "budget_missile") blasts.push({ big: e.big, r: e.r });
    });
    let most = 0;
    let small = 0;
    steps(w, 2.1, () => {
      most = Math.max(most, inst.projs.filter((p) => p.sprite === "w_budget_missile" && !p.dead).length);
      for (let i = 0; i < w.projectiles.count; i++) if (w.projectiles.items[i].sprite === "w_missile" && !w.projectiles.items[i].dead) small++;
    });
    expect(most).toBe(1);
    // (no small missiles while the big one flies, none before the last second)
    expect(small).toBe(0);
    expect(blasts).toHaveLength(1);
    expect(blasts[0].big).toBe(true);
    expect(blasts[0].r).toBeCloseTo((inst.def.levels[0].blast ?? 0) * w.stats.area, 3);
    const craters = inst.projs.filter((p) => p.a === CRATER && !p.dead);
    expect(craters).toHaveLength(1);
    expect(craters[0].dmg * 2).toBeCloseTo((inst.def.levels[0].craterDps ?? 0) * w.stats.might, 3);
    // the crater burns out
    steps(w, (inst.def.levels[0].crater ?? 0) * w.stats.duration + 0.1);
    w.step(DT);
    expect(inst.projs.filter((p) => p.a === CRATER && !p.dead)).toHaveLength(0);
  });

  test("the last second before the next launch: the small missiles go out, as the weapon's own source", () => {
    const { w, inst } = budget();
    for (let i = 0; i < 6; i++) dummy(w, 90 + (i % 3) * 6, -20 + i * 5);
    const seen = new Set<number>();
    steps(w, inst.def.levels[0].cd * w.stats.cooldown + 0.05, () => {
      for (let i = 0; i < w.projectiles.count; i++) {
        const p = w.projectiles.items[i];
        if (p.sprite === "w_missile" && !p.dead && p.source === "budget_missile") seen.add(p.uid);
      }
    });
    // (each extra Amount is 2 more small missiles, as for the base weapon)
    expect(seen.size).toBe((inst.def.levels[0].tiny ?? 0) + 2 * w.stats.amount);
  });
});

describe("Tsun Tsun Drill Harisen (Baka Harisen + Speed Lines)", () => {
  const drill = () => evolved("akane", "baka_harisen", "speed_lines", "tsun_tsun_drill");

  test("a thrust ticks 4 times, winds what it holds towards the tip, then launches it", () => {
    const { w, inst } = drill();
    const L = inst.def.levels[0];
    const e = dummy(w, 30, 0);
    const x0 = e.x;
    let cue = 0;
    w.bus.on("heroFx", (h) => {
      if (h.kind === HFX_AKANE_DRILL) cue++;
    });
    let hits = 0;
    w.hooks.on("hit", (h) => {
      if (h.enemy === e && h.source === "tsun_tsun_drill") hits++;
    });
    let held = 0;
    let launched = 0;
    steps(w, 0.5, () => {
      if (hits === 3 && !held) held = e.x;
      launched = Math.max(launched, e.kx);
    });
    expect(cue).toBe(1);
    expect(hits).toBe(L.ticks);
    // dragged out along the lane before the launch, then knocked away hard
    expect(held).toBeGreaterThan(x0 + 20);
    expect(held).toBeLessThanOrEqual(w.player.x + (L.len ?? 0) * w.stats.area + 1);
    expect(launched).toBeGreaterThan(200);
  });

  test("a narrow lane: an enemy beside it is not hit, and the route does not heal", () => {
    const { w } = drill();
    dummy(w, 40, 0);
    const side = dummy(w, 40, 40);
    w.player.hp = w.player.maxHp - 10;
    const hp = w.player.hp;
    steps(w, 0.6);
    expect(side.hp).toBe(1e9);
    expect(w.player.hp).toBe(hp);
  });
});
