/**
 * SECOND EVOLUTIONS, package B (docs/content/weapons.md §8): the mechanics of
 *
 *   Soap Opera (Bubble Aura + Inner Monologue)             a trail of soap bubbles that hold what touches them
 *   Refraction Overload (Prism Beam + Lucky Clover)        one beam that splits in 3, and each of those in 3
 *   Brown Sugar Railgun (Bubble Tea Cannon + Power Bow)    one piercing pearl with a damage falloff + a syrup streak
 *   Failed Exam Storm (Paper Crane Flock + Training Montage) paper planes along the facing, kills mark gems up
 *   Underground Mosh Pit (Idol Lightstick Wave + Plot Armor) a stomp on every beat, Crowd Surf stacks
 *
 * The data model, the choice and the def shape are checked for every evolution by tests/evo2.test.ts and
 * tests/coverage.test.ts.
 */
import { describe, expect, test } from "vitest";
import { evolutionsOf, WEAPONS } from "../src/game/registry";
import { defaultRunConfig } from "../src/game/run-config";
import type { Enemy, WeaponInstance } from "../src/game/types";
import { beatLen } from "../src/game/weapons/_arsenal2";
import { SOAP_FREE, SOAP_HELD } from "../src/game/weapons/bubble-aura";
import { REFRACT_MAX } from "../src/game/weapons/prism-beam";
import { World } from "../src/game/world";

const DT = 1 / 60;

/** Hoshi alone with `base` evolved into `evo` (no other weapon: every hit on the field is the evolution's). */
function evolved(base: string, evo: string): { w: World; inst: WeaponInstance } {
  const w = new World({ hero: "hoshi", seed: 11, director: false, god: true, run: defaultRunConfig({}) });
  for (const i of w.weapons) i.def.dispose?.(w, i);
  w.weapons.length = 0;
  const b = w.addWeapon(base, 5)!;
  const inst = w.evolveWeapon(b, evo)!;
  expect(inst.def.id).toBe(evo);
  return { w, inst };
}

/** A puff with `hp` HP at (dx, dy) from the hero (standing still: the tests place everything). */
function puff(w: World, dx: number, dy: number, hp = 1e9, id = "puff"): Enemy {
  const e = w.spawnEnemy(id, w.player.x + dx, w.player.y + dy)!;
  e.maxHp = e.hp = hp;
  e.speed = 0;
  return e;
}

function steps(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    w.step(DT);
    each?.();
  }
}

test("package B: each base weapon lists its second evolution with the §8.1 passive", () => {
  const want: [string, string, string][] = [
    ["bubble_aura", "soap_opera", "inner_monologue"],
    ["prism_beam", "refraction_overload", "lucky_clover"],
    ["bubble_tea_cannon", "brown_sugar_railgun", "power_bow"],
    ["paper_crane_flock", "failed_exam_storm", "training_montage"],
    ["idol_lightstick_wave", "mosh_pit", "plot_armor"],
  ];
  for (const [base, into, passive] of want) {
    const evos = evolutionsOf(WEAPONS.get(base)!);
    expect(evos[1], base).toEqual({ into, with: passive });
    expect(WEAPONS.get(into)?.desc.startsWith("EVOLUTION! "), into).toBe(true);
  }
});

describe("Soap Opera", () => {
  test("moving leaves a trail of bubbles (one per `every` px, never more than `max`); standing still leaves none", () => {
    const { w, inst } = evolved("bubble_aura", "soap_opera");
    const L = inst.def.levels[0];
    steps(w, 0.5);
    expect(inst.projs).toHaveLength(0);
    const x0 = w.player.x;
    w.input.mx = 1;
    steps(w, 1);
    const moved = w.player.x - x0;
    expect(inst.projs.length).toBeGreaterThanOrEqual(Math.floor(moved / (L.every ?? 0)) - 1);
    expect(inst.projs.every((p) => p.sprite === "w_soap_bubble" && p.a === SOAP_FREE && p.x < w.player.x)).toBe(true);
    steps(w, 8);
    expect(inst.projs.length).toBeLessThanOrEqual(L.max ?? 0);
  });

  test("a bubble lifts and holds the enemy that touches it, ticks it, then pops on it and its neighbours", () => {
    const { w, inst } = evolved("bubble_aura", "soap_opera");
    const L = inst.def.levels[0];
    w.input.mx = 1;
    steps(w, 0.6);
    w.input.mx = 0;
    const b = inst.projs[0];
    // one enemy on the bubble, a neighbour within the pop, a third far outside it (all outside the aura)
    const e = w.spawnEnemy("puff", b.x, b.y + 6)!;
    const near = w.spawnEnemy("puff", b.x - 20, b.y + 6)!;
    const far = w.spawnEnemy("puff", b.x - 20, b.y + 90)!;
    for (const x of [e, near, far]) {
      x.maxHp = x.hp = 1e9;
      x.speed = 0;
    }
    // (the spatial grid picks a new enemy up on the next step)
    steps(w, 3 * DT);
    expect(b.a).toBe(SOAP_HELD);
    expect(b.target).toBe(e);
    expect(e.z).toBeGreaterThan(0);
    const at = { x: e.x, y: e.y };
    const hold = (L.hold ?? 0) * w.stats.duration;
    steps(w, hold - 0.1);
    // held: it has not moved, it is still stunned, and it has been ticked
    expect(e.stun).toBeGreaterThan(0);
    expect(Math.hypot(e.x - at.x, e.y - at.y)).toBeLessThan(1);
    const ticked = e.maxHp - e.hp;
    expect(ticked).toBeGreaterThan(L.dmg * 2);
    expect(near.hp).toBe(near.maxHp);
    steps(w, 0.2);
    // the pop: the held one drops and takes it, the neighbour takes it too, the far one nothing
    // (a dead projectile goes back to the pool: the weapon no longer owns it)
    expect(inst.projs.includes(b)).toBe(false);
    expect(e.z).toBe(0);
    expect(e.maxHp - e.hp).toBeGreaterThan(ticked + (L.pop ?? 0) * 0.5);
    expect(near.maxHp - near.hp).toBeGreaterThan((L.pop ?? 0) * 0.5);
    expect(far.hp).toBe(far.maxHp);
  });

  test("a boss is never held: the bubble pops on it and slows it; dispose lets go of whatever is held", () => {
    const { w, inst } = evolved("bubble_aura", "soap_opera");
    w.input.mx = 1;
    steps(w, 2);
    w.input.mx = 0;
    const b0 = inst.projs[0];
    const boss = w.spawnEnemy("king_puff", b0.x, b0.y + 8)!;
    boss.maxHp = boss.hp = 1e9;
    steps(w, 3 * DT);
    expect(inst.projs.includes(b0)).toBe(false);
    expect(boss.stun).toBe(0);
    expect(boss.slow).toBeLessThan(1);
    expect(boss.hp).toBeLessThan(boss.maxHp);
    w.killEnemy(boss, null);
    // (the boss is wide: it burst its neighbours too - take a bubble that is still there)
    w.step(DT);
    const b1 = inst.projs[inst.projs.length - 1];
    const e = w.spawnEnemy("puff", b1.x, b1.y + 6)!;
    e.maxHp = e.hp = 1e9;
    steps(w, 3 * DT);
    expect(e.z).toBeGreaterThan(0);
    inst.def.dispose?.(w, inst);
    expect(e.z).toBe(0);
    expect(inst.projs).toHaveLength(0);
  });
});

describe("Refraction Overload", () => {
  /** A lane of enemies to the right of the hero: the root beam's first enemy, then a pack behind it. */
  function lane(): { w: World; inst: WeaponInstance; first: Enemy } {
    const { w, inst } = evolved("prism_beam", "refraction_overload");
    // (no crits: the split count below is exact)
    w.statMods.push((s) => {
      s.crit = -10;
    });
    w.recomputeStats();
    const first = puff(w, 50, -11);
    for (let i = 0; i < 3; i++) for (const dy of [-40, -11, 18]) puff(w, 95 + i * 14, dy);
    return { w, inst, first };
  }

  test("one root beam; it splits in 3 from its first enemy, and each of those splits in 3 once (13 beams)", () => {
    const { w, inst, first } = lane();
    let most = 0;
    const tiers = new Set<number>();
    steps(w, 0.5, () => {
      most = Math.max(most, inst.projs.length);
      for (const p of inst.projs) tiers.add(p.angV);
    });
    expect(most).toBe(13);
    expect([...tiers].sort()).toEqual([0, 1, 2]);
    const roots = inst.projs.filter((p) => p.angV === 0);
    expect(roots).toHaveLength(1);
    // the tier-1 beams grow out of the first enemy the root hit, fanned around the root's direction
    const kids = inst.projs.filter((p) => p.angV === 1);
    expect(kids).toHaveLength(3);
    for (const k of kids) expect(k.target).toBe(first);
    const fan = ((inst.def.levels[0].fan ?? 0) * Math.PI) / 180;
    expect(Math.max(...kids.map((k) => k.ang)) - Math.min(...kids.map((k) => k.ang))).toBeCloseTo(2 * fan, 1);
    // every beam ends with the root
    steps(w, 0.4);
    expect(inst.projs.filter((p) => !p.dead)).toHaveLength(0);
  });

  test("a critical hit adds an extra thin beam from that enemy, and the beams stay bounded", () => {
    const { w, inst } = lane();
    w.statMods.push((s) => {
      s.crit = 10;
    });
    w.recomputeStats();
    let most = 0;
    steps(w, 0.6, () => void (most = Math.max(most, inst.projs.length)));
    expect(most).toBeGreaterThan(13);
    expect(most).toBeLessThanOrEqual(REFRACT_MAX);
  });

  test("nothing behind her: an enemy at her back is never hit", () => {
    const { w, first } = lane();
    const behind = puff(w, -60, -11);
    steps(w, 2.5);
    expect(first.hp).toBeLessThan(first.maxHp);
    expect(behind.hp).toBe(behind.maxHp);
  });
});

describe("Brown Sugar Railgun", () => {
  test("one pearl pierces the whole lane, each enemy pierced costing it `falloff` down to `floor`", () => {
    const { w, inst } = evolved("bubble_tea_cannon", "brown_sugar_railgun");
    const L = inst.def.levels[0];
    w.statMods.push((s) => {
      s.crit = -10;
    });
    w.recomputeStats();
    // (off the ground line: the pearl flies at chest height, the syrup lies at her feet, 10 px lower)
    const row: Enemy[] = [];
    for (let i = 0; i < 8; i++) row.push(puff(w, 40 + i * 22, -10));
    for (const e of row) {
      e.cy = 0;
      e.r = 3;
    }
    const dealt: number[] = row.map(() => 0);
    w.hooks.on("hit", (h) => {
      const i = row.indexOf(h.enemy);
      if (i >= 0 && dealt[i] === 0) dealt[i] = h.dmg;
    });
    steps(w, 0.7);
    expect(dealt.every((d) => d > 0)).toBe(true);
    const v = 0.12; // CFG.damageVariance head-room
    for (let i = 0; i < row.length; i++) {
      const k = Math.max(L.floor ?? 0, 1 - (L.falloff ?? 0) * i);
      expect(dealt[i] / L.dmg, `enemy ${i}`).toBeGreaterThan(k * (1 - v) - 0.01);
      expect(dealt[i] / L.dmg, `enemy ${i}`).toBeLessThan(k * (1 + v) + 0.01);
    }
    expect(dealt[7]).toBeLessThan(dealt[0] * 0.6);
  });

  test("the syrup streak slows and ticks what stands on it, for `syrup` s; a ring around her is not its job", () => {
    const { w, inst } = evolved("bubble_tea_cannon", "brown_sugar_railgun");
    const L = inst.def.levels[0];
    const target = puff(w, 60, 0);
    steps(w, 0.3);
    const streak = inst.projs.find((p) => p.a > 0)!;
    expect(streak.life).toBeCloseTo((L.syrup ?? 0) * w.stats.duration, 5);
    // a late-comer steps onto the line after the pearl has gone, another stands beside it
    target.x += 5000;
    const on = puff(w, 150, 0);
    const off = puff(w, 150, 40);
    on.speed = 30;
    steps(w, 0.6);
    expect(on.slow).toBeCloseTo(L.syrupSlow ?? 0, 5);
    expect(on.hp).toBeLessThan(on.maxHp);
    expect(off.hp).toBe(off.maxHp);
    expect(off.slow).toBe(1);
  });
});

describe("Failed Exam Storm", () => {
  test("no flock: planes launch along the facing, from behind her, and never home", () => {
    const { w, inst } = evolved("paper_crane_flock", "failed_exam_storm");
    const L = inst.def.levels[0];
    w.input.my = -1;
    steps(w, 0.3);
    w.input.my = 0;
    const side = puff(w, 70, 0);
    const spread = ((L.spread ?? 0) * Math.PI) / 180;
    let seen = 0;
    steps(w, 1, () => {
      for (let i = 0; i < w.projectiles.count; i++) {
        const p = w.projectiles.items[i];
        if (p.dead || p.source !== "failed_exam_storm") continue;
        seen++;
        expect(p.homing).toBe(0);
        // flying up the screen, inside the spread
        expect(Math.abs(Math.atan2(p.vy, p.vx) + Math.PI / 2)).toBeLessThanOrEqual(spread + 1e-6);
        if (p.age < DT * 1.5) expect(p.y).toBeGreaterThan(w.player.y);
      }
    });
    expect(seen).toBeGreaterThan(20);
    expect(inst.projs).toHaveLength(0);
    expect(side.hp).toBe(side.maxHp);
  });

  test("a plane's kill marks that enemy's gem up, 1 % more per kill, capped", () => {
    const { w, inst } = evolved("paper_crane_flock", "failed_exam_storm");
    const L = inst.def.levels[0];
    w.input.mx = 1;
    w.step(DT);
    w.input.mx = 0;
    const plain = w.dropGem(w.player.x, w.player.y + 400, 1).value;
    let kills = 0;
    let gem: { value: number } | null = null;
    let last = 0;
    w.hooks.on("kill", (k) => {
      if (k.source !== "failed_exam_storm") return;
      kills++;
      gem = w.gems.items[w.gems.count - 1];
    });
    const ref = puff(w, 9000, 9000, 1);
    const worth = ref.def.xp;
    w.despawn(ref);
    for (let i = 0; i < 400 && kills < 45; i++) {
      if (w.enemyCount < 6) puff(w, 80 + (i % 5) * 12, -8 + ((i * 7) % 5) * 4 - 8, 1);
      gem = null;
      w.step(DT);
      if (gem) last = (gem as { value: number }).value;
      if (kills === 10) expect(inst.data.xp).toBeCloseTo((L.xp ?? 0) * 10, 6);
    }
    expect(plain).toBe(1);
    expect(kills).toBeGreaterThanOrEqual(45);
    expect(inst.data.xp).toBeCloseTo(L.xpCap ?? 0, 6);
    expect(last / worth).toBeGreaterThan(1 + (L.xpCap ?? 0) - 0.01);
  });
});

describe("Underground Mosh Pit", () => {
  function pit(n: number): { w: World; inst: WeaponInstance; ring: Enemy[] } {
    const { w, inst } = evolved("idol_lightstick_wave", "mosh_pit");
    const ring: Enemy[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const e = puff(w, Math.cos(a) * 30, Math.sin(a) * 30 - 8);
      ring.push(e);
    }
    return { w, inst, ring };
  }

  test("every beat is a 360° stomp: everything in range is hit and dazed, nothing beyond it", () => {
    const { w, inst, ring } = pit(8);
    const L = inst.def.levels[0];
    const out = puff(w, (L.range ?? 0) * 2.2, 0);
    let hits = 0;
    w.hooks.on("hit", (h) => {
      if (ring.includes(h.enemy)) hits++;
    });
    // (the first step only syncs to the beat clock)
    steps(w, beatLen(w) * 1.5);
    expect(hits).toBe(8);
    expect(ring.every((e) => e.hp < e.maxHp)).toBe(true);
    expect(out.hp).toBe(out.maxHp);
    expect(inst.projs).toHaveLength(0);
  });

  test("Crowd Surf: a beat that hits `need`+ adds a stack (damage reduction, a wider stomp); 2 quiet beats lose them all", () => {
    const { w, inst, ring } = pit(8);
    const L = inst.def.levels[0];
    const base = w.stats.dmgReduction;
    // (the stomp shoves: put the crowd back before every beat)
    const home = ring.map((e) => ({ x: e.x, y: e.y }));
    const hold = () =>
      ring.forEach((e, i) => {
        e.x = home[i].x;
        e.y = home[i].y;
        e.kx = e.ky = 0;
      });
    steps(w, beatLen(w) * 3.5, hold);
    expect(inst.data.surf).toBe(3);
    expect(w.stats.dmgReduction - base).toBeCloseTo(3 * (L.dr ?? 0), 6);
    steps(w, beatLen(w) * 6, hold);
    expect(inst.data.surf).toBe(L.stacks);
    // an enemy just outside the plain radius is inside the stack-grown one
    const edge = puff(w, (L.range ?? 0) * w.stats.area * (1 + (L.grow ?? 0) * (L.stacks ?? 0)) - 2 + 6, -8);
    steps(w, beatLen(w) * 1.1, hold);
    expect(edge.hp).toBeLessThan(edge.maxHp);
    // the crowd leaves: one quiet beat keeps the stacks, the second loses them
    for (const e of [...ring, edge]) w.despawn(e);
    steps(w, beatLen(w) * 1.05);
    expect(inst.data.surf).toBe(L.stacks);
    steps(w, beatLen(w) * 1.05);
    expect(inst.data.surf).toBe(0);
    expect(w.stats.dmgReduction).toBeCloseTo(base, 6);
  });

  test("dispose takes the damage reduction away with the weapon", () => {
    const { w, inst } = pit(8);
    const n = w.statMods.length;
    w.step(DT);
    expect(w.statMods.length).toBe(n + 1);
    inst.def.dispose?.(w, inst);
    expect(w.statMods.length).toBe(n);
  });
});
