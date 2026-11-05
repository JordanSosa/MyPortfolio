/**
 * ORBITAL GUARD + WARM TEA (owner feedback: orbitals felt weak against shooters, and the tea's healing
 * cost more HP than it gave because she had to stop in the puddles).
 *
 *   - orbiting bodies (yarn balls, Cosmic Yarn planets, teacups) eat enemy bullets, break, and reform
 *     after `mend` s x the hero's cooldown stat; evolutions absorb more (planets 3, Tea Party cups 2)
 *   - only `world.bullets` are blocked: an ignited Candle Wisp's blast (a telegraphed AoE that calls
 *     hurtPlayer directly, like boss slams / beams) goes straight through
 *   - blocks count in RunStats.orbitalBlocks
 *   - Warm Tea: brushing any puddle heals over WARM_T s while she keeps moving, refreshes, never stacks;
 *     spills land on her path, so walking keeps it up; C6 doubles it, Free Refills lengthens it
 *   - reviewer pass (no build is immune): the Amount stat's extra bodies, the cooldown stat and a second
 *     guarding weapon stretch the mend time (mendTime), and A Real Friend's copy neither guards nor heals
 */
import { describe, expect, test } from "vitest";
import { defaultRunConfig, type RunConfig } from "../src/game/run-config";
import type { Projectile, WeaponInstance } from "../src/game/types";
import { friendOf } from "../src/game/relics/_friend";
import { CFG } from "../src/game/config";
import { guardOf } from "../src/game/weapons/_orbital";
import { WARM_T, teaPuddle, warmTime } from "../src/game/weapons/teapot-tempest";
import { World } from "../src/game/world";

const DT = 1 / 60;

function world(hero: string, run: Partial<RunConfig> = {}, god = true): World {
  return new World({ hero, seed: 11, director: false, god, run: defaultRunConfig(run) });
}

function steps(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    each?.();
    w.step(DT);
  }
}

/** The k-th orbiting body of a weapon (teacups: p.a = 0; yarn: every owned projectile). */
function body(inst: WeaponInstance, k: number): Projectile {
  const cups = inst.def.id === "teapot_tempest" || inst.def.id === "eternal_tea_party";
  const list = cups ? inst.projs.filter((p) => p.a === 0) : inst.projs;
  return list[k];
}

/** A still enemy bullet right on body k (it is eaten on the next step). */
function shootAt(w: World, inst: WeaponInstance, k: number): void {
  const p = body(inst, k);
  w.spawnBullet(p.x, p.y, 0, 0, 5, "eb_orb", 3, 5);
}

describe("Orbital Guard", () => {
  test("a yarn ball eats a bullet, breaks (no hits, hidden) and reforms after mend x cooldown", () => {
    const w = world("mochi", { talents: { mochi_infinite_yarn: 1 } });
    steps(w, 0.5);
    const inst = w.hasWeapon("yarn_orbit")!;
    const g = guardOf(inst);
    expect(g.n).toBe(inst.projs.length);
    shootAt(w, inst, 0);
    w.step(DT);
    expect(w.bullets.count).toBe(0);
    expect(g.blocks).toBe(1);
    expect(g.down[0]).toBeGreaterThan(0);
    const mend = (inst.def.levels[0].mend ?? 0) * w.stats.cooldown;
    expect(g.downFor[0]).toBeCloseTo(mend, 5);
    w.step(DT);
    expect(inst.projs[0].r).toBe(0);
    expect(inst.projs[0].scale).toBe(0);
    // the other balls are untouched
    expect(inst.projs[1].r).toBeGreaterThan(0);
    // back after mend x cooldown (to the step), with full size once the reform pop settles
    let t = 0;
    while (g.down[0] > 0 && t < 10) {
      w.step(DT);
      t += DT;
    }
    expect(Math.abs(t + DT - mend)).toBeLessThan(2.5 * DT);
    steps(w, 0.3);
    expect(inst.projs[0].r).toBeGreaterThan(0);
    expect(inst.projs[0].scale).toBeCloseTo(w.stats.area, 5);
    expect(w.runStats().orbitalBlocks).toBe(1);
  });

  test("the cooldown stat speeds the recovery up (Wish Charm)", () => {
    const mendOf = (wish: number): number => {
      const w = world("mochi", { talents: { mochi_infinite_yarn: 1 } });
      if (wish) w.addPassive("wish_charm", wish);
      w.recomputeStats();
      steps(w, 0.5);
      const inst = w.hasWeapon("yarn_orbit")!;
      shootAt(w, inst, 0);
      w.step(DT);
      return guardOf(inst).downFor[0];
    };
    const base = mendOf(0);
    const fast = mendOf(5);
    expect(base).toBeCloseTo(2.5, 5);
    expect(fast).toBeLessThan(base * 0.9);
  });

  test("a broken ball stays down through Yarn Orbit's off phase (the next balls spawn hidden)", () => {
    const w = world("mochi");
    const inst = w.hasWeapon("yarn_orbit")!;
    const g = guardOf(inst);
    // balls come out at 0.2 s and last 3 s x duration: break one just before they go
    steps(w, 0.2 + 3 * w.stats.duration - 0.05);
    expect(inst.projs.length).toBeGreaterThan(0);
    shootAt(w, inst, 0);
    w.step(DT);
    expect(g.down[0]).toBeGreaterThan(0);
    // off phase (1.3 s x cooldown), then the next balls
    steps(w, 0.25);
    expect(inst.projs.length).toBe(0);
    while (inst.projs.length === 0) w.step(DT);
    expect(g.down[0]).toBeGreaterThan(0);
    w.step(DT);
    expect(inst.projs[0].r).toBe(0);
    expect(inst.projs[1].r).toBeGreaterThan(0);
  });

  test("Cosmic Yarn planets soak 3 bullets before breaking and mend faster; base balls break on 1", () => {
    const w = world("mochi");
    const inst = w.evolveWeapon(w.hasWeapon("yarn_orbit")!)!;
    expect(inst.def.id).toBe("cosmic_yarn");
    steps(w, 0.3);
    const g = guardOf(inst);
    shootAt(w, inst, 0);
    shootAt(w, inst, 0);
    w.step(DT);
    expect(g.blocks).toBe(2);
    expect(g.down[0]).toBe(0);
    expect(body(inst, 0).r).toBeGreaterThan(0);
    shootAt(w, inst, 0);
    w.step(DT);
    expect(g.blocks).toBe(3);
    expect(g.down[0]).toBeGreaterThan(0);
    expect(g.downFor[0]).toBeCloseTo(1.5 * w.stats.cooldown, 5);
    // a chipped planet mends: 2 bullets, then a quiet mend time later it takes 3 more to break
    shootAt(w, inst, 1);
    shootAt(w, inst, 1);
    w.step(DT);
    expect(g.down[1]).toBe(0);
    steps(w, 1.5 * w.stats.cooldown * 2 + 0.1);
    expect(g.chips[1]).toBe(0);
    shootAt(w, inst, 1);
    shootAt(w, inst, 1);
    w.step(DT);
    expect(g.down[1]).toBe(0);
  });

  test("teacups guard too: Teapot Tempest cups break on 1 bullet, Eternal Tea Party cups on 2", () => {
    const w = world("pudding");
    steps(w, 0.3);
    const tea = w.hasWeapon("teapot_tempest")!;
    const gt = guardOf(tea);
    shootAt(w, tea, 0);
    w.step(DT);
    expect(gt.blocks).toBe(1);
    expect(gt.down[0]).toBeGreaterThan(0);
    // (hidden from the next placement on)
    w.step(DT);
    expect(body(tea, 0).r).toBe(0);
    expect(body(tea, 0).scale).toBe(0);
    const party = w.evolveWeapon(tea)!;
    steps(w, 0.3);
    const gp = guardOf(party);
    shootAt(w, party, 0);
    w.step(DT);
    expect(gp.blocks).toBe(1);
    expect(gp.down[0]).toBe(0);
    shootAt(w, party, 0);
    w.step(DT);
    expect(gp.down[0]).toBeGreaterThan(0);
    expect(w.runStats().orbitalBlocks).toBe(3);
  });

  test("a volley at the hero: the ring eats part of it; the rest still lands", () => {
    const hits = (guard: boolean): { blocked: number; hurt: number } => {
      const w = world("mochi", {}, false);
      if (guard) w.evolveWeapon(w.hasWeapon("yarn_orbit")!);
      else w.weapons.length = 0;
      steps(w, 0.3);
      const pl = w.player;
      let hurt = 0;
      w.hooks.on("hurt", () => void hurt++);
      for (let wave = 0; wave < 4; wave++) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + wave * 0.13;
          const x = pl.x + Math.cos(a) * 90;
          const y = pl.y - 8 + Math.sin(a) * 90;
          w.spawnBullet(x, y, -Math.cos(a) * 70, -Math.sin(a) * 70, 4, "eb_orb", 3, 4);
        }
        // (iframes would hide the hits: refresh them away between hits)
        steps(w, 1.6, () => void (pl.iframes = 0));
      }
      return { blocked: w.runStats().orbitalBlocks ?? 0, hurt };
    };
    const bare = hits(false);
    const guarded = hits(true);
    expect(bare.blocked).toBe(0);
    expect(bare.hurt).toBeGreaterThan(20);
    expect(guarded.blocked).toBeGreaterThan(8);
    expect(guarded.hurt).toBeLessThan(bare.hurt);
    expect(guarded.hurt).toBeGreaterThan(0);
  });

  test("non-bullet attacks are not blocked: an ignited Candle Wisp's blast inside the ring still hurts", () => {
    const w = world("mochi", {}, false);
    const inst = w.evolveWeapon(w.hasWeapon("yarn_orbit")!)!;
    steps(w, 0.3);
    const pl = w.player;
    const e = w.spawnEnemy("wisp", pl.x + 6, pl.y)!;
    e.maxHp = e.hp = 1e9;
    const hp0 = pl.hp;
    steps(w, 1);
    expect(pl.hp).toBeLessThan(hp0);
    expect(w.runStats().killedBy ?? "").toBe("");
    const g = guardOf(inst);
    expect(g.blocks).toBe(0);
    expect(g.breaks).toBe(0);
  });
});

describe("Warm Tea", () => {
  /** Pudding (L1 teapot, healMul 1.15) walking right at full speed; auto spills held off unless `spills`. */
  function walker(run: Partial<RunConfig> = {}, spills = false): { w: World; inst: WeaponInstance; healed: () => number } {
    const w = world("pudding", run);
    const inst = w.hasWeapon("teapot_tempest")!;
    let h = 0;
    w.hooks.on("heal", (x) => void (h += x.amount));
    w.player.hp = 20;
    w.input.mx = 1;
    w.input.my = 0;
    if (!spills) inst.timer = 1e9;
    return { w, inst, healed: () => h };
  }

  test("brushing a puddle while walking past heals for WARM_T s after (heal x healMul), without stopping", () => {
    const { w, inst, healed } = walker();
    steps(w, 0.5);
    const pl = w.player;
    teaPuddle(w, inst, pl.x + 24, pl.y, 14, 0, 20);
    // seconds spent brushing it (each of those steps refreshed the tea to full)
    let inside = 0;
    let stopped = false;
    for (let t = 0; t < 6; t += DT) {
      w.step(DT);
      // (a refreshed tea reads full minus this step)
      if ((inst.data.warm ?? 0) >= warmTime(w) - DT - 1e-9) inside += DT;
      if (Math.abs(pl.vx) < 50) stopped = true;
    }
    expect(stopped).toBe(false);
    expect(inside).toBeGreaterThan(0.2);
    expect(inside).toBeLessThan(0.8);
    expect(inst.data.warmMax).toBe(warmTime(w));
    const rate = (inst.def.levels[0].heal ?? 0) * w.stats.healMul;
    expect(rate).toBeCloseTo(1.5 * 1.15, 5);
    // WARM_T s after the last touch, plus the moments spent crossing the puddle
    expect(healed()).toBeGreaterThan(rate * WARM_T * 0.98);
    expect(healed()).toBeLessThan(rate * (WARM_T + inside + 0.05));
    expect(inst.data.warm).toBe(0);
  });

  test("never stacks: three puddles at once heal exactly like one", () => {
    const heal = (n: number): number => {
      const { w, inst, healed } = walker();
      steps(w, 0.5);
      const pl = w.player;
      for (let i = 0; i < n; i++) teaPuddle(w, inst, pl.x + 24, pl.y, 14, 0, 20);
      steps(w, 6);
      return healed();
    };
    expect(heal(3)).toBeCloseTo(heal(1), 5);
  });

  test("spills land on her path: walking keeps Warm Tea up; standing still it is not (spills go to the action)", () => {
    const uptime = (walk: boolean, lv = 1): number => {
      const { w, inst } = walker({}, true);
      if (lv > 1) w.setWeaponLevel(inst, lv);
      if (!walk) w.input.mx = 0;
      steps(w, 3);
      let warm = 0;
      const T = 10;
      steps(w, T, () => void ((inst.data.warm ?? 0) > 0 && (warm += DT)));
      return warm / T;
    };
    expect(uptime(true)).toBeGreaterThan(0.9);
    expect(uptime(true, 5)).toBeGreaterThan(0.9);
    // (still: the cup in front of her tips 30 px out - she has to walk to it)
    expect(uptime(false)).toBeLessThan(0.1);
  });

  test("a volley that breaks every cup does not cut off the tea: the next spill still lands on her path", () => {
    const { w, inst } = walker({}, true);
    steps(w, 0.5);
    const g = guardOf(inst);
    shootAt(w, inst, 0);
    shootAt(w, inst, 1);
    w.step(DT);
    expect(g.down[0] > 0 && g.down[1] > 0).toBe(true);
    const puddles = () => inst.projs.filter((p) => p.a === 1 && !p.dead).length;
    const before = puddles();
    inst.timer = 0;
    w.step(DT);
    expect(puddles()).toBe(before + 1);
  });

  test("kiting in circles still brushes most spills", () => {
    const { w, inst } = walker({}, true);
    w.setWeaponLevel(inst, 5);
    let warm = 0;
    let t = 0;
    steps(w, 14, () => {
      t += DT;
      w.input.mx = Math.cos(t * 1.3);
      w.input.my = Math.sin(t * 1.3);
      if (t > 3 && (inst.data.warm ?? 0) > 0) warm += DT;
    });
    expect(warm / 11).toBeGreaterThan(0.75);
  });

  test("Pudding C6 doubles it; Free Refills lengthens it (+0.5 s per rank)", () => {
    const heal = (run: Partial<RunConfig>): { h: number; warm: number; mul: number } => {
      const { w, inst, healed } = walker(run);
      steps(w, 0.5);
      teaPuddle(w, inst, w.player.x + 24, w.player.y, 14, 0, 20);
      steps(w, 0.6);
      const warm = inst.data.warmMax ?? 0;
      steps(w, 6);
      return { h: healed(), warm, mul: w.stats.healMul };
    };
    const base = heal({});
    const c6 = heal({ constellation: 6 });
    expect(c6.h / c6.mul).toBeCloseTo((base.h / base.mul) * 2, 1);
    const refill = heal({ talents: { pudding_refill: 3 } });
    expect(base.warm).toBe(WARM_T);
    expect(refill.warm).toBe(WARM_T + 1.5);
    expect(refill.h).toBeGreaterThan(base.h * 1.3);
  });

  test("Eternal Tea Party pours warm tea on her path: Warm Tea stays up while she walks", () => {
    const { w, inst } = walker({}, true);
    const party = w.evolveWeapon(inst)!;
    steps(w, 3);
    let warm = 0;
    steps(w, 10, () => void ((party.data.warm ?? 0) > 0 && (warm += DT)));
    expect(warm / 10).toBeGreaterThan(0.9);
    const rate = party.def.levels[0].heal ?? 0;
    expect(rate).toBeGreaterThan(inst.def.levels[4].heal ?? 0);
  });
});

describe("Orbital Guard limits (reviewer pass: no build is immune to bullets)", () => {
  /** Break body 0 of a weapon and return its mend time. */
  function breakTime(w: World, inst: WeaponInstance): number {
    steps(w, 0.3);
    const g = guardOf(inst);
    for (let i = 0; i < g.block; i++) shootAt(w, inst, 0);
    // (Cosmic Yarn: block is read on the first guarded step - shoot enough for the evolution's 3)
    for (let i = g.block; i < 3; i++) shootAt(w, inst, 0);
    w.step(DT);
    expect(g.down[0]).toBeGreaterThan(0);
    return g.downFor[0];
  }

  test("the Amount stat's extra bodies share the guard; cooldown counts at half its rate; two guarding weapons share recovery", () => {
    const cosmic = (mod?: (s: World["stats"]) => void): number => {
      const w = world("mochi");
      if (mod) w.statMods.push(mod);
      w.recomputeStats();
      return breakTime(w, w.evolveWeapon(w.hasWeapon("yarn_orbit")!)!);
    };
    expect(cosmic()).toBeCloseTo(1.5, 4);
    // +5 amount: 11 planets on the ring, each mends (11/6)^k as long (the ring's block rate barely grows)
    expect(cosmic((s) => void (s.amount += 5))).toBeCloseTo(1.5 * (11 / 6) ** CFG.guard.amount, 4);
    // the cooldown floor (0.35) mends in 0.675x, not 0.35x
    expect(cosmic((s) => void (s.cooldown = 0.1))).toBeCloseTo(1.5 * (1 - CFG.guard.cd + CFG.guard.cd * 0.35), 4);
    // Pudding's teacups + a Yarn Orbit: two rings, one recovery (x 1.5 each)
    const w = world("pudding");
    w.addWeapon("yarn_orbit", 1);
    const tea = w.hasWeapon("teapot_tempest")!;
    expect(breakTime(w, tea)).toBeCloseTo(2.5 * (1 - CFG.guard.cd + CFG.guard.cd * w.stats.cooldown) * (1 + CFG.guard.share), 4);
  });

  test("evolving mid-break resets cleanly: the evolution starts whole with its own guard", () => {
    const w = world("mochi", { talents: { mochi_infinite_yarn: 1 } });
    const yarn = w.hasWeapon("yarn_orbit")!;
    steps(w, 0.5);
    shootAt(w, yarn, 0);
    shootAt(w, yarn, 1);
    w.step(DT);
    expect(guardOf(yarn).down[0]).toBeGreaterThan(0);
    const cosmic = w.evolveWeapon(yarn)!;
    steps(w, 0.1);
    const g = guardOf(cosmic);
    expect(g).not.toBe(guardOf(yarn));
    expect(g.n).toBe(6);
    for (let k = 0; k < g.n; k++) expect(g.down[k]).toBe(0);
    expect(body(cosmic, 0).r).toBeGreaterThan(0);
    // (the base weapon's balls are gone with it)
    expect(yarn.projs.length).toBe(0);
  });

  test("Infinite Yarn's +2 balls and Extra Cups are the weapon's own: no dilution", () => {
    const w = world("mochi", { talents: { mochi_infinite_yarn: 1 } });
    expect(breakTime(w, w.hasWeapon("yarn_orbit")!)).toBeCloseTo(2.5 * (1 - CFG.guard.cd + CFG.guard.cd * w.stats.cooldown), 4);
    const p = world("pudding", { talents: { pudding_extra_cups: 3 } });
    const tea = p.hasWeapon("teapot_tempest")!;
    expect(breakTime(p, tea)).toBeCloseTo(2.5 * (1 - CFG.guard.cd + CFG.guard.cd * p.stats.cooldown), 4);
    expect(guardOf(tea).n).toBe(2 + 3);
  });

  test("A Real Friend's copy (Pudding) neither guards nor heals: one Warm Tea, one guard", () => {
    const run = (friend: boolean): { heal: number; friendBlocks: number; copy: string } => {
      const w = world("pudding", friend ? { relics: [{ id: "real_friend", stars: 6 }] } : {});
      w.setWeaponLevel(w.hasWeapon("teapot_tempest")!, 5);
      let h = 0;
      w.hooks.on("heal", (x) => void (h += x.amount));
      let t = 0;
      let friendBlocks = 0;
      steps(w, 8, () => {
        t += DT;
        w.player.hp = 10;
        w.input.mx = Math.cos(t * 0.4);
        w.input.my = Math.sin(t * 0.4);
        const f = friendOf(w)?.inst;
        if (f) {
          // a still bullet on one of the Friend's cups every step: it is never eaten
          const cup = f.projs.find((p) => p.a === 0 && p.r > 0);
          if (cup) w.spawnBullet(cup.x, cup.y, 0, 0, 0, "eb_orb", 3, 0.05);
          friendBlocks = guardOf(f).blocks;
        }
      });
      return { heal: h, friendBlocks, copy: friendOf(w)?.inst?.def.id ?? "" };
    };
    const solo = run(false);
    const duo = run(true);
    expect(duo.copy).toBe("teapot_tempest");
    expect(duo.friendBlocks).toBe(0);
    expect(solo.heal).toBeGreaterThan(10);
    // (the hero's own Warm Tea only: within the noise of a slightly different run)
    expect(duo.heal).toBeLessThan(solo.heal * 1.2);
  });

  /** Share of a storm's bullets that reach the hero (aimed from 180 px, `rate` per s, 90 px/s; no i-frames). */
  function storm(hero: string, base: [string, number][], evolve: string[], late: boolean, rate: number, T = 10): number {
    const w = new World({ hero, seed: 5, director: false, god: false, run: defaultRunConfig({ start: { level: 1, weapons: [] }, weaponSlots: 6 }) });
    for (const i of w.weapons.slice()) i.def.dispose?.(w, i);
    w.weapons.length = 0;
    for (const [id, lv] of base) w.addWeapon(id, lv);
    for (const id of evolve) w.evolveWeapon(w.hasWeapon(id)!);
    // a strong late-game build's stats (a P7 bot build: cooldown 0.685, area 2.09, +5 amount)
    if (late) w.statMods.push((s) => void ((s.cooldown = 0.685), (s.area *= 2.09), (s.amount += 5)));
    w.recomputeStats();
    const pl = w.player;
    pl.maxHp = pl.hp = 1e9;
    let reached = 0;
    // (measurement: every bullet that reaches her counts and dies)
    (w as unknown as { hurtPlayer: () => boolean }).hurtPlayer = () => (reached++, true);
    steps(w, 0.5);
    let acc = 0;
    let shot = 0;
    steps(w, T, () => {
      for (acc += rate * DT; acc >= 1; acc--) {
        const a = w.rng.next() * Math.PI * 2;
        const x = pl.x + Math.cos(a) * 180;
        const y = pl.y - 8 + Math.sin(a) * 180;
        const aim = Math.atan2(pl.y - 8 - y, pl.x - x) + (w.rng.next() - 0.5) * 0.15;
        w.spawnBullet(x, y, Math.cos(aim) * 90, Math.sin(aim) * 90, 1, "eb_orb", 3, 6);
        shot++;
      }
    });
    return reached / shot;
  }

  test("a 15 bullet/s storm against late-game orbital builds: they eat a lot, never all of it", () => {
    const bare = storm("mochi", [], [], false, 15);
    expect(bare).toBeGreaterThan(0.35);
    // Cosmic Yarn with P7 stats: about a quarter of what hits a bare hero still lands (0.12 before the limits)
    expect(storm("mochi", [["yarn_orbit", 5]], ["yarn_orbit"], true, 15) / bare).toBeGreaterThan(0.18);
    // Pudding's two rings (Cosmic Yarn + Eternal Tea Party) with P7 stats: about a fifth (0 before: immune)
    expect(storm("pudding", [["teapot_tempest", 5], ["yarn_orbit", 5]], ["teapot_tempest", "yarn_orbit"], true, 15) / bare).toBeGreaterThan(0.1);
  });
});
