/**
 * SECOND EVOLUTIONS, package D (docs/content/weapons.md §8.3), headless:
 *
 *   Who Are You Again?       a charm that ends, or a charmed enemy that dies, bursts; the burst charms on; 8 a second
 *   Skip Intro               a burst every cd with no i-frames, no slow walk, no Panic Henshin; every 5th is the finisher
 *   "Holding Back" Fireball  a stream of small fireballs without explosion events; every 100th is the sneeze
 *   Free Delivery            the cone pulls enemies (not bosses) and gems to the bumper; the delivery slams them; quiet isekai
 *   All-You-Can-Eat Nabe     deploys standing still, cooks harder the longer an enemy stays, folds to nothing, serves snacks
 *
 * The recipe rows (id, name, base, passive), the def shape and the account mapping are checked for every
 * second evolution by tests/coverage.test.ts and tests/evo2.test.ts.
 */
import { describe, expect, test } from "vitest";
import { isWeaponOf } from "../src/game/registry";
import { defaultRunConfig } from "../src/game/run-config";
import type { Enemy, WeaponInstance } from "../src/game/types";
import { charm, isCharmed } from "../src/game/weapons/_charm";
import { HOLD_POP } from "../src/game/weapons/cheat-fireball";
import { BURST_FINISHER, SKIP_BURST } from "../src/game/weapons/henshin-burst";
import { FD_SLAM } from "../src/game/weapons/horn-of-reincarnation";
import { kotatsuOf } from "../src/game/weapons/kotatsu-of-sloth";
import { WHO_BURST, heartbreaks } from "../src/game/weapons/notice-me-sparkles";
import { World } from "../src/game/world";

const DT = 1 / 60;

/** A quiet sandbox with `base` evolved into `id` (its passive held). */
function evolved(hero: string, base: string, passive: string, id: string, god = true): { w: World; inst: WeaponInstance } {
  const w = new World({ hero, seed: 7, director: false, god, run: defaultRunConfig({}) });
  while (w.pendingLevels > 0) w.skipLevel();
  const b = w.hasWeapon(base) ?? w.addWeapon(base, 1)!;
  w.setWeaponLevel(b, 5);
  w.addPassive(passive, 1);
  const inst = w.evolveWeapon(b, id)!;
  expect(inst.def.id).toBe(id);
  expect(w.hasWeapon(base)).toBeFalsy();
  w.xpNext = 1e12;
  return { w, inst };
}

function run(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    w.step(DT);
    each?.();
  }
}

/** A sturdy enemy that stands where it is put. */
function dummy(w: World, dx: number, dy: number, id = "teddy", hp = 5000): Enemy {
  const e = w.spawnEnemy(id, w.player.x + dx, w.player.y + dy)!;
  e.hp = e.maxHp = hp;
  e.speed = 0;
  return e;
}

/** Count a heroFx cue. */
function cues(w: World, kind: string, into: { n: number; last: number; r: number }): void {
  w.bus.on("heroFx", (e) => {
    if (e.kind !== kind) return;
    into.n++;
    into.last = e.n;
    into.r = e.r;
  });
}

describe("Who Are You Again? (Notice-Me Sparkles + Heart Locket)", () => {
  const make = () => evolved("senpai", "notice_me_sparkles", "heart_locket", "who_are_you_again");

  test("a charm that ends bursts on the spot: area damage as the weapon's own source", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    // (far outside the aura: only the heartbreak can hurt them)
    const a = dummy(w, 200, 0);
    const b = dummy(w, 214, 0);
    const far = dummy(w, 200, 120);
    const seen = { n: 0, last: 0, r: 0 };
    cues(w, WHO_BURST, seen);
    expect(charm(w, a, 0.2)).toBe(true);
    run(w, 0.5);
    expect(seen.n).toBe(1);
    expect(seen.r).toBeCloseTo((L.burst ?? 0) * w.stats.area, 6);
    expect(isCharmed(w, a)).toBe(false);
    // a took dmg + 6 % of its max HP (capped), b the same burst, the far one nothing
    expect(a.maxHp - a.hp).toBeGreaterThan(L.dmg * 0.8);
    expect(b.maxHp - b.hp).toBeGreaterThan(L.dmg * 0.8);
    expect(b.maxHp - b.hp).toBeLessThan((L.dmg + (L.hpCap ?? 0)) * w.stats.might * w.stats.critMult * 1.3);
    expect(far.hp).toBe(far.maxHp);
    expect(w.damageBy.get("who_are_you_again") ?? 0).toBeGreaterThan(0);
    expect(isWeaponOf("who_are_you_again", "notice_me_sparkles")).toBe(true);
  });

  test("a charmed enemy that dies bursts too, and the burst can charm what it hits (the chain)", () => {
    const { w } = make();
    const a = dummy(w, 200, 0);
    const ring: Enemy[] = [];
    for (let i = 0; i < 10; i++) ring.push(dummy(w, 200 + Math.cos(i) * 14, Math.sin(i) * 14));
    const seen = { n: 0, last: 0, r: 0 };
    cues(w, WHO_BURST, seen);
    charm(w, a, 5);
    w.step(DT);
    w.killEnemy(a, null, "test");
    run(w, 0.3);
    expect(seen.n).toBe(1);
    expect(seen.last).toBeGreaterThanOrEqual(10);
    // 10 rolls at 25 %: with this seed at least one of them is charmed on the spot
    expect(ring.some((e) => isCharmed(w, e))).toBe(true);
    // bosses are never charmed by it
    const boss = dummy(w, 205, 0, "king_puff", 1e6);
    charm(w, ring[0], 0.05);
    run(w, 0.4);
    expect(isCharmed(w, boss)).toBe(false);
    expect(boss.hp).toBeLessThan(boss.maxHp);
  });

  test("the chain is paced: at most `rate` bursts a second, the rest wait in the queue", () => {
    const { w, inst } = make();
    const rate = inst.def.levels[0].rate ?? 8;
    // (apart from each other: no burst reaches a neighbour)
    const pack: Enemy[] = [];
    for (let i = 0; i < 12; i++) pack.push(dummy(w, Math.cos((i / 12) * Math.PI * 2) * 170, Math.sin((i / 12) * Math.PI * 2) * 170));
    for (const e of pack) charm(w, e, 0.1, { counted: false });
    const seen = { n: 0, last: 0, r: 0 };
    cues(w, WHO_BURST, seen);
    run(w, 0.1 + 0.5);
    expect(seen.n).toBeGreaterThanOrEqual(3);
    expect(seen.n).toBeLessThanOrEqual(Math.ceil(rate * 0.5) + 1);
    expect(heartbreaks(inst)).toBe(12 - seen.n);
    run(w, 2);
    expect(seen.n).toBe(12);
    expect(heartbreaks(inst)).toBe(0);
  });
});

describe("Skip Intro (Henshin Burst + Wish Charm)", () => {
  const make = (god = true) => evolved("magical_girl_47", "henshin_burst", "wish_charm", "skip_intro", god);

  test("a burst every cd, no henshin: no i-frames, no slow walk, no henshin counted", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    const cd = L.cd * w.stats.cooldown;
    const seen = { n: 0, last: 0, r: 0 };
    cues(w, SKIP_BURST, seen);
    const e = dummy(w, 30, 0);
    const speed = w.stats.moveSpeed;
    let inv = 0;
    run(w, cd * 3 + 0.1, () => {
      inv = Math.max(inv, w.player.dashInv);
      expect(w.stats.moveSpeed).toBe(speed);
    });
    expect(seen.n).toBe(3);
    expect(inv).toBe(0);
    expect(inst.data.hen ?? 0).toBe(0);
    expect(w.runStats().henshins ?? 0).toBe(0);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(w.damageBy.get("skip_intro") ?? 0).toBeGreaterThan(0);
  });

  test("every 5th burst is the stock-footage finisher: a bigger radius, twice the damage", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    const radii: number[] = [];
    const fins: boolean[] = [];
    w.bus.on("heroFx", (e) => {
      if (e.kind !== SKIP_BURST) return;
      radii.push(e.r);
      fins.push((e.n & BURST_FINISHER) !== 0);
    });
    run(w, L.cd * w.stats.cooldown * 5 + 0.1);
    expect(fins).toEqual([false, false, false, false, true]);
    expect(radii[4] / radii[0]).toBeCloseTo(L.finArea ?? 0, 6);
    expect(L.finDmg).toBe(2);
  });

  test("the emergency transform is gone: a hit lands even on a full charge", () => {
    const { w, inst } = make(false);
    inst.data.charge = inst.def.levels[0].cd * w.stats.cooldown - 0.01;
    const hp = w.player.hp;
    w.hurtPlayer(10, w.player.x + 10, w.player.y);
    expect(w.player.hp).toBeLessThan(hp);
  });
});

describe('"Holding Back" Fireball (Cheat Fireball + Twin Charm)', () => {
  const make = () => evolved("isekai_kun", "cheat_fireball", "twin_charm", "holding_back");

  test("a stream of small fireballs at the nearest enemy: pops, not explosions", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    const e = dummy(w, 80, 0);
    let booms = 0;
    w.bus.on("explosion", (x) => {
      if (x.source === "holding_back") booms++;
    });
    const pops = { n: 0, last: 0, r: 0 };
    cues(w, HOLD_POP, pops);
    run(w, 2);
    const per = L.cd * w.stats.cooldown;
    const streams = 1 + Math.floor((L.amount + w.stats.amount - 1) / 2);
    // (the first volley leaves after 0.3 s; each pop is one fireball that reached the dummy)
    expect(inst.data.cast).toBeGreaterThanOrEqual(Math.floor((1.6 / per) * streams));
    expect(inst.data.cast).toBeLessThanOrEqual(Math.ceil((2 / per) * streams));
    expect(pops.n).toBeGreaterThan(inst.data.cast * 0.6);
    expect(pops.r).toBeCloseTo((L.blast ?? 0) * w.stats.area, 6);
    expect(booms).toBe(0);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(w.damageBy.get("holding_back") ?? 0).toBeGreaterThan(pops.n * L.dmg * 0.5);
    expect(w.runStats().overdos ?? 0).toBe(0);
  });

  test("every 100th fireball is a sneeze: one overdone blast of the base weapon", () => {
    const { w, inst } = make();
    dummy(w, 80, 0);
    let big = 0;
    w.bus.on("explosion", (x) => {
      if (x.source === "holding_back" && x.big) big++;
    });
    inst.data.cast = (inst.def.levels[0].sneeze ?? 100) - 1;
    run(w, 1.5);
    expect(big).toBe(1);
    expect(w.runStats().overdos).toBe(1);
  });
});

describe("Free Delivery (Horn of Reincarnation + Magnet Star)", () => {
  const make = () => evolved("truck_kun", "horn_of_reincarnation", "magnet_star", "free_delivery");

  test("the honk pulls what is in the cone toward the bumper, never a boss; the delivery slams it", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    // (the truck starts heading +x)
    // (`a` near the far end of the cone: the parcels stop 8 px short of the drop spot 38 px off the bumper, so
    // only an enemy from further out travels most of `pull`)
    const a = dummy(w, 105, 0, "puff");
    const b = dummy(w, 70, 16, "puff");
    const behind = dummy(w, -70, 0, "puff");
    const boss = dummy(w, 100, -20, "king_puff", 1e6);
    const ax = a.x;
    const bossX = boss.x;
    const behindX = behind.x;
    const slam = { n: 0, last: 0, r: 0 };
    cues(w, FD_SLAM, slam);
    run(w, 0.3 + (L.slamAfter ?? 0) - 0.05);
    // pulled: close to `pull` px nearer, the boss and the one behind not at all
    expect(ax - a.x).toBeGreaterThan((L.pull ?? 0) * 0.5);
    expect(ax - a.x).toBeLessThanOrEqual((L.pull ?? 0) * 1.1);
    expect(Math.abs(boss.x - bossX)).toBeLessThan(2);
    expect(Math.abs(behind.x - behindX)).toBeLessThan(2);
    expect(slam.n).toBe(0);
    const hpA = a.hp;
    run(w, 0.3);
    expect(slam.n).toBe(1);
    expect(slam.last % 100).toBeGreaterThanOrEqual(2);
    expect(hpA - a.hp).toBeGreaterThan((L.slam ?? 0) * 0.8);
    expect(b.hp).toBeLessThan(b.maxHp - (L.slam ?? 0) * 0.8);
    expect(behind.hp).toBe(behind.maxHp);
    // a boss the cone reaches is not pulled: its parcel is delivered where it stands
    expect(boss.maxHp - boss.hp).toBeGreaterThan((L.slam ?? 0) * 0.8);
    expect(w.damageBy.get("free_delivery") ?? 0).toBeGreaterThan(0);
  });

  test("free shipping: pickups in the cone fly in (food too); its kills are isekai'd, quietly", () => {
    const { w } = make();
    const p = w.player;
    const front = w.dropPickup("onigiri", p.x + 90, p.y - 8);
    const back = w.dropPickup("onigiri", p.x - 90, p.y - 8);
    let marks = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "hb_isekai_mark" || e.kind === "hb_isekai") marks++;
    });
    const weak = dummy(w, 60, 0, "puff", 1);
    run(w, 0.4);
    expect(front.state).toBe(1);
    expect(back.state).toBe(0);
    expect(weak.dead).toBe(true);
    expect(w.runStats().isekaid).toBe(1);
    // (no light pillar per kill: they all die on the bumper, see quietIsekai)
    expect(marks).toBe(0);
  });
});

describe("All-You-Can-Eat Nabe (Kotatsu of Sloth + Bento Box)", () => {
  const make = () => evolved("hoshi", "kotatsu_of_sloth", "bento_box", "all_you_can_eat_nabe");

  test("deploys standing still, slows and cooks harder the longer an enemy stays; moving folds it to nothing", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    w.input.mx = 1;
    run(w, 0.2);
    const K = kotatsuOf(inst)!;
    expect(K.deployed).toBe(false);
    expect(K.r).toBe(0);
    dummy(w, 20, 0);
    run(w, 0.5);
    // (on the move it is worth nothing: no aura, no slow, no damage)
    expect(w.damageBy.get("all_you_can_eat_nabe") ?? 0).toBe(0);
    w.input.mx = 0;
    run(w, (L.deploy ?? 0) + 0.05);
    expect(K.deployed).toBe(true);
    expect(K.r).toBeCloseTo((L.radius ?? 0) * w.stats.area, 6);
    const e = dummy(w, 20, 0);
    const out = dummy(w, (L.radius ?? 0) * w.stats.area + 60, 0);
    const hits: number[] = [];
    let outside = 0;
    w.hooks.on("hit", (h) => {
      if (h.source !== "all_you_can_eat_nabe") return;
      if (h.enemy === out) outside++;
      if (h.enemy === e && !h.crit) hits.push(h.dmg);
    });
    run(w, 4);
    expect(e.slow).toBeCloseTo(L.slow ?? 0, 6);
    expect(outside).toBe(0);
    // +25 % a second inside: after 4 s a tick is about twice the first one (damage variance aside)
    expect(hits.length).toBeGreaterThan(8);
    const first = hits[0];
    const last = hits[hits.length - 1];
    expect(last / first).toBeGreaterThan(1.5);
    expect(K.heat).toBeGreaterThan(0.8);
    expect(K.heat).toBeLessThanOrEqual(L.cookMax ?? 0);
    expect(w.dozing).toBe(false);
    // moving folds it at once; the cooking starts over
    w.input.mx = 1;
    run(w, 0.05);
    expect(K.deployed).toBe(false);
    expect(K.r).toBe(0);
    expect(K.heat).toBe(0);
    const dealt = w.damageBy.get("all_you_can_eat_nabe") ?? 0;
    run(w, 0.5);
    expect(w.damageBy.get("all_you_can_eat_nabe")).toBe(dealt);
  });

  test("every 12th enemy that dies inside is dinner: a snack that heals", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    run(w, (L.deploy ?? 0) + 0.1);
    const K = kotatsuOf(inst)!;
    expect(K.deployed).toBe(true);
    const snacks = () => {
      let n = 0;
      for (let i = 0; i < w.pickups.count; i++) if (!w.pickups.items[i].dead && w.pickups.items[i].kind === "snack") n++;
      return n;
    };
    // (killed by anything: what counts is where it dies)
    const every = L.snackEvery ?? 12;
    for (let i = 0; i < every - 1; i++) w.killEnemy(dummy(w, 30, 10), null, "test");
    expect(snacks()).toBe(0);
    w.killEnemy(dummy(w, 300, 0), null, "test");
    expect(K.eaten).toBe(every - 1);
    w.killEnemy(dummy(w, 30, 10), null, "test");
    expect(K.eaten).toBe(every);
    expect(snacks()).toBe(1);
    const k = w.pickups.items[0];
    expect(k.value).toBe(L.snackHeal);
  });
});
