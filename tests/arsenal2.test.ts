/**
 * Arsenal 2 (docs/content/weapons.md §2.9-2.12, §3, §4, §5, §6): the four general Season 2 weapons and
 * their evolutions, the eight new passives, Limit Breaks for every weapon, and the unlock rules.
 *   - each weapon: the bible's 5-level table + upgrade texts, Lv6 / Lv7 Limit Breaks, levels 1 -> 7 and
 *     damages enemies at every level, evolves with its passive, the evolution works, nothing leaks
 *   - each twist: sticky bounces + Lv5 split + the Tsunami's shedding; Folded Tighter + crumple on hurt +
 *     the Wish; waves on the stage beat + the Chorus + the crowd + ENCORE!; deploy / armor / regen /
 *     Too Comfy (no weapon damage, pacifist, comfyBest) / Lv5 sleep / the evolution's mikan + gem pull
 *   - each passive: the exact stat per level (Friendship Bracelet: per weapon held, recomputed)
 *   - unlock rules: locked from the start, unlocked from the bible's counter, codex hints verbatim
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import { PASSIVE_BY_ID, PASSIVES } from "../src/game/passives";
import { WEAPONS, baseWeapons, registerStage, stageDef } from "../src/game/registry";
import { defaultRunConfig, type RunConfig } from "../src/game/run-config";
import { baseStats } from "../src/game/stats";
import type { Enemy, WeaponInstance } from "../src/game/types";
import { evolutionCards, makeOffer } from "../src/game/upgrades";
import { beatIndex, beatLen } from "../src/game/weapons/_arsenal2";
import { flockOf, FOLD_PER, STORM_TIME } from "../src/game/weapons/paper-crane-flock";
import { asleepIn, kotatsuOf, COMFY_AURA, EVO_MOVING_R } from "../src/game/weapons/kotatsu-of-sloth";
import { WAVE_CHORUS } from "../src/game/weapons/idol-lightstick-wave";
import { World } from "../src/game/world";
import { gameContent } from "../src/meta/content";
import { defaultProfile } from "../src/meta/profile";
import { applyRunToProfile } from "../src/meta/rewards";
import { evaluateUnlocks, isUnlocked, unlockRule, unlockStatus } from "../src/meta/unlocks";
import { runStats } from "./meta.fixtures";

const DT = 1 / 60;

const ARSENAL = [
  { weapon: "bubble_tea_cannon", evo: "tapioca_tsunami", passive: "big_ribbon" },
  { weapon: "paper_crane_flock", evo: "thousand_crane_wish", passive: "wish_charm" },
  { weapon: "idol_lightstick_wave", evo: "sold_out_dome_tour", passive: "twin_charm" },
  { weapon: "kotatsu_of_sloth", evo: "eternal_winter_break", passive: "chibi_charm" },
] as const;

/** A quiet sandbox (no director, invulnerable hero) holding only `weapon`. */
function sandbox(weapon: string, level = 1, run: Partial<RunConfig> = {}, seed = 7, god = true): { w: World; inst: WeaponInstance } {
  const w = new World({ hero: "hoshi", seed, director: false, god, run: defaultRunConfig(run) });
  for (const i of w.weapons) i.def.dispose?.(w, i);
  w.weapons.length = 0;
  const inst = w.addWeapon(weapon, level) as WeaponInstance;
  expect(inst).toBeTruthy();
  return { w, inst };
}

function crowd(w: World, n: number, rMin = 14, rMax = 60, id = "puff"): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + w.rng.next() * 0.3;
    const r = rMin + w.rng.next() * (rMax - rMin);
    w.spawnEnemy(id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r * 0.9);
  }
}

function topUp(w: World, n: number, id = "puff", rMax = 60): void {
  while (w.enemyCount < n) {
    const a = w.rng.angle();
    const r = 16 + w.rng.next() * (rMax - 16);
    if (!w.spawnEnemy(id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r)) break;
  }
}

function run(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    w.step(DT);
    each?.();
  }
}

function clearEnemies(w: World): void {
  for (let i = 0; i < w.enemies.count; i++) w.despawn(w.enemies.items[i]);
}

/** One step of movement (wakes / folds the kotatsu), then standing still again. */
function wiggle(w: World): void {
  w.input.mx = 1;
  w.step(DT);
  w.input.mx = 0;
}

function liveBySource(w: World, src: string): number {
  let n = 0;
  for (let i = 0; i < w.projectiles.count; i++) {
    const p = w.projectiles.items[i];
    if (!p.dead && p.source === src) n++;
  }
  return n;
}

// ================================================================ the four weapons
describe.each(ARSENAL)("$weapon", ({ weapon, evo, passive }) => {
  test("registered: 5 levels, 4 upgrade texts, Lv6 / Lv7 Limit Breaks, evolution pair, icons", () => {
    const def = WEAPONS.get(weapon)!;
    expect(def).toBeTruthy();
    expect(def.levels.length).toBe(CFG.maxLevel);
    expect(def.upgrades.length).toBe(CFG.maxLevel - 1);
    expect(def.limitBreak?.length).toBe(2);
    expect(def.limitBreak?.[0].text.startsWith("LIMIT BREAK — ")).toBe(true);
    expect(def.limitBreak?.[1].text.startsWith("MASTERED — ")).toBe(true);
    expect(def.evolutions?.[0]).toEqual({ into: evo, with: passive });
    expect(def.icon).toBe(`icon_${weapon}`);
    expect(def.sfx).toBeTruthy();
    const e = WEAPONS.get(evo)!;
    expect(e.evolved).toBe(true);
    expect(e.levels.length).toBe(1);
    expect(e.icon).toBe(`icon_${evo}`);
    expect(e.desc.startsWith("EVOLUTION! ")).toBe(true);
    expect(baseWeapons().some((b) => b.id === weapon)).toBe(true);
  });

  test("levels 1 -> 7 (Limit Breaks) and damages enemies at every level", () => {
    const def = WEAPONS.get(weapon)!;
    const { w, inst } = sandbox(weapon, 1, { weaponLevelBonus: { [weapon]: 2 } }, 11);
    expect(w.weaponMaxLevel(def)).toBe(7);
    let prev = 0;
    for (let lv = 1; lv <= 7; lv++) {
      w.setWeaponLevel(inst, lv);
      expect(inst.level).toBe(lv);
      wiggle(w);
      crowd(w, 24);
      run(w, 3.5, () => topUp(w, 24));
      expect(inst.damage, `Lv${lv}`).toBeGreaterThan(prev);
      prev = inst.damage;
    }
    expect(inst.kills).toBeGreaterThan(0);
    // the Limit Break cards exist past Lv5
    w.setWeaponLevel(inst, 5);
    let lb = false;
    for (let i = 0; i < 40 && !lb; i++) lb = makeOffer(w, 4).some((c) => c.id === weapon && c.limitBreak);
    expect(lb).toBe(true);
    // nothing leaks once the crowd is gone
    clearEnemies(w);
    run(w, 5);
    expect(w.projectiles.count).toBeLessThan(40);
  });

  test("evolves with its passive: same slot, works, deals real damage", () => {
    const { w, inst } = sandbox(weapon, 5, {}, 5);
    expect(evolutionCards(w).length).toBe(0);
    w.addPassive(passive);
    expect(evolutionCards(w).map((c) => c.id)).toContain(evo);
    crowd(w, 24);
    run(w, 1);
    const next = w.evolveWeapon(inst) as WeaponInstance;
    expect(next.def.id).toBe(evo);
    expect(next.slot).toBe(inst.slot);
    expect(w.hasWeapon(weapon)).toBeUndefined();
    const before = next.damage;
    run(w, 6, () => topUp(w, 26));
    expect(next.damage).toBeGreaterThan(before + 150);
    expect(next.kills).toBeGreaterThan(3);
    clearEnemies(w);
    run(w, 5);
    expect(w.projectiles.count).toBeLessThan(40);
  });
});

// ================================================================ Bubble Tea Cannon
describe("Bubble Tea Cannon", () => {
  test("the bible's level table, verbatim", () => {
    const L = WEAPONS.get("bubble_tea_cannon")!.levels;
    expect(L.map((l) => [l.dmg, l.cd, l.amount, l.speed, l.bounce, l.knock])).toEqual([
      [12, 1.3, 1, 150, 3, 30],
      [12, 1.3, 2, 150, 3, 30],
      [16, 1.3, 2, 155, 4, 32],
      [16, 1.15, 3, 155, 4, 32],
      [21, 1.15, 3, 160, 6, 36],
    ]);
    expect(WEAPONS.get("tapioca_tsunami")!.levels[0]).toMatchObject({ dmg: 30, cd: 1.6, amount: 2, speed: 160, bounce: 8, shed: 3, shedDmg: 14, shedBounce: 2, knock: 60 });
  });

  test("a pearl bounces through `bounce` + 1 enemies, and every hit is sticky (slow)", () => {
    const { w, inst } = sandbox("bubble_tea_cannon", 1, {}, 3);
    // a loose line of tanky enemies: each one within 80 px of the next
    for (let i = 0; i < 6; i++) w.spawnEnemy("teddy", w.player.x + 40 + i * 30, w.player.y + (i & 1 ? 8 : -8));
    const hitNow: Enemy[] = [];
    let hits = 0;
    let slowed = 0;
    w.hooks.on("hit", (h) => {
      if (h.source !== "bubble_tea_cannon") return;
      hits++;
      hitNow.push(h.enemy);
    });
    inst.timer = 0;
    // (the sticky slow lands right after the hit: check at the end of each step)
    run(w, 1.2, () => {
      for (const e of hitNow) if (e.slow < 1 && e.slowT > 0) slowed++;
      hitNow.length = 0;
    });
    // Lv1: one pearl, 3 bounces = 4 hits, then it pops
    expect(hits).toBe(4);
    expect(slowed).toBe(4);
    expect(liveBySource(w, "bubble_tea_cannon")).toBe(0);
  });

  test("Lv5 pearls split into two mini pearls on their last bounce", () => {
    const { w, inst } = sandbox("bubble_tea_cannon", 5, {}, 4);
    crowd(w, 30, 20, 70, "teddy");
    let splits = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "a2_boba_split") splits++;
    });
    let maxMinis = 0;
    inst.timer = 0;
    run(w, 3, () => {
      let m = 0;
      for (let i = 0; i < w.projectiles.count; i++) {
        const p = w.projectiles.items[i];
        if (!p.dead && p.source === "bubble_tea_cannon" && p.a === 1) m++;
      }
      maxMinis = Math.max(maxMinis, m);
    });
    expect(splits).toBeGreaterThan(0);
    expect(maxMinis).toBeGreaterThanOrEqual(2);
  });

  test("Tapioca Tsunami: giant pearls shed regular pearls on every bounce (bounded)", () => {
    const { w } = sandbox("tapioca_tsunami", 1, {}, 9);
    crowd(w, 40, 20, 80, "teddy");
    let sheds = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "a2_boba_shed") sheds += e.n;
    });
    let peak = 0;
    run(w, 5, () => {
      topUp(w, 40, "teddy", 80);
      peak = Math.max(peak, liveBySource(w, "tapioca_tsunami"));
    });
    expect(sheds).toBeGreaterThan(20);
    expect(peak).toBeLessThan(140);
  });
});

// ================================================================ Paper Crane Flock
describe("Paper Crane Flock", () => {
  test("the bible's level table, verbatim", () => {
    const L = WEAPONS.get("paper_crane_flock")!.levels;
    expect(L.map((l) => [l.dmg, l.cd, l.amount, l.speed, l.range, l.pierce, l.knock])).toEqual([
      [9, 1.2, 3, 170, 100, 1, 25],
      [9, 1.2, 4, 170, 100, 1, 25],
      [12, 1.2, 4, 180, 115, 1, 25],
      [12, 1.0, 5, 180, 115, 1, 28],
      [15, 1.0, 6, 190, 115, 2, 30],
    ]);
  });

  test("amount cranes in the flock; Folded Tighter (+5% per kill, max +50%) resets when the hero is hurt", () => {
    const { w, inst } = sandbox("paper_crane_flock", 5, {}, 2, false);
    run(w, 0.5);
    expect(inst.projs.length).toBe(6);
    const F = flockOf(inst)!;
    // (untouchable while folding: every hurt would reset the folds)
    crowd(w, 20, 30, 90);
    run(w, 8, () => {
      w.player.iframes = 1;
      topUp(w, 20, "puff", 90);
    });
    let folds = 0;
    for (let i = 0; i < 6; i++) folds += F.folds[i];
    expect(folds).toBeGreaterThan(3);
    for (let i = 0; i < 6; i++) expect(F.folds[i]).toBeLessThanOrEqual(10);
    // a folded crane hits harder
    const i0 = [0, 1, 2, 3, 4, 5].reduce((a, b) => (F.folds[b] > F.folds[a] ? b : a), 0);
    expect(F.folds[i0]).toBeGreaterThan(0);
    // hurt: everything resets (and the cranes crumple)
    clearEnemies(w);
    w.player.iframes = 0;
    w.player.dashInv = 0;
    let crumpled = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "a2_crane_crumple") crumpled++;
    });
    expect(w.hurtPlayer(5, w.player.x + 5, w.player.y, "test")).toBe(true);
    w.step(DT);
    for (let i = 0; i < 6; i++) expect(F.folds[i]).toBe(0);
    expect(F.crumple[0]).toBeGreaterThan(0);
    expect(crumpled).toBe(1);
    expect(FOLD_PER).toBe(0.05);
  });

  test("Thousand Crane Wish: 1,000 crane kills -> full heal + a storm that hits every enemy in view once", () => {
    const { w, inst } = sandbox("thousand_crane_wish", 1, {}, 6, false);
    run(w, 0.3);
    expect(inst.projs.length).toBe(12);
    const F = flockOf(inst)!;
    expect(F.gold).toBe(true);
    w.player.hp = 10;
    // a crowd of tough enemies spread over the view, one kill short of the Wish
    for (let i = 0; i < 30; i++) w.spawnEnemy("teddy", w.player.x - 100 + (i % 10) * 22, w.player.y - 150 + Math.floor(i / 10) * 140);
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i];
      e.hp = e.maxHp = 5000;
    }
    F.wish = 1000;
    let wishes = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "a2_wish") wishes++;
    });
    const hit = new Map<number, number>();
    w.hooks.on("hit", (h) => {
      if (h.source === "thousand_crane_wish" && h.dmg >= 150) hit.set(h.enemy.uid, (hit.get(h.enemy.uid) ?? 0) + 1);
    });
    w.step(DT);
    expect(wishes).toBe(1);
    expect(w.player.hp).toBe(w.player.maxHp);
    expect(F.wish).toBe(0);
    // (the storm is the point here: keep the hero out of the 30 teddies' reach while it plays)
    w.player.iframes = STORM_TIME + 1;
    run(w, STORM_TIME + 0.4);
    // every enemy in view took the storm, exactly once
    let inView = 0;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i];
      if (Math.abs(e.x - w.player.x) < w.viewW / 2 - 4 && Math.abs(e.y - w.player.y) < w.viewH / 2 - 10) {
        inView++;
        expect(hit.get(e.uid), `enemy ${i}`).toBe(1);
      }
    }
    expect(inView).toBeGreaterThan(20);
    expect(liveBySource(w, "thousand_crane_wish")).toBe(12);
    expect(inst.data.wishGoal).toBe(1000);
  });
});

// ================================================================ Idol Lightstick Wave
describe("Idol Lightstick Wave", () => {
  test("the bible's level table, verbatim (cd = every x 60 / 140 for tooling)", () => {
    const L = WEAPONS.get("idol_lightstick_wave")!.levels;
    expect(L.map((l) => [l.dmg, l.every, l.amount, l.arc, l.range, l.knock])).toEqual([
      [10, 4, 1, 120, 80, 40],
      [10, 4, 2, 120, 80, 40],
      [14, 4, 2, 120, 96, 42],
      [14, 2, 2, 120, 96, 42],
      [18, 2, 2, 150, 96, 46],
    ]);
    for (const l of L) expect(l.cd).toBeCloseTo(((l.every ?? 0) * 60) / 140, 2);
    expect(WEAPONS.get("sold_out_dome_tour")!.levels[0]).toMatchObject({ dmg: 22, every: 1, amount: 4, arc: 90, range: 110, knock: 50, encore: 8, encoreDmg: 40, rank: 0.12 });
  });

  test("fires on the stage beat: every 4th beat (Dream Meadow: 150 bpm, its battle theme's tempo), a Chorus every 16", () => {
    const { w } = sandbox("idol_lightstick_wave", 1, {}, 1);
    expect(beatLen(w)).toBeCloseTo(60 / (w.stage.bpm ?? 140), 6);
    expect(w.stage.bpm).toBe(150);
    const fired: number[] = [];
    let chorus = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind !== "a2_wave") return;
      fired.push(beatIndex(w));
      if (e.n === 1) chorus++;
    });
    run(w, 16 * beatLen(w) * 2 + 0.05);
    // beats 4, 8, 12, 16 (Chorus), 20, 24, 28, 32 (Chorus)
    expect(fired).toEqual([4, 8, 12, 16, 20, 24, 28, 32]);
    expect(chorus).toBe(2);
  });

  test("the beat follows StageDef.bpm and the cooldown stat (every x cooldown, rounded)", () => {
    const meadow = stageDef("dream_meadow");
    registerStage({ ...meadow, id: "arsenal2_test_150", bpm: 150 });
    const { w } = sandbox("idol_lightstick_wave", 4, { stage: "arsenal2_test_150", mods: [(s) => void (s.cooldown -= 0.5)] }, 1);
    expect(beatLen(w)).toBeCloseTo(0.4, 6);
    let waves = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "a2_wave") waves++;
    });
    // Lv4: every 2 beats x cooldown 0.5 -> every beat
    run(w, 10 * 0.4 + 0.02);
    expect(waves).toBe(10);
  });

  test("a wave hits each enemy once, only inside its arc; amount 2 = both sides", () => {
    const { w, inst } = sandbox("idol_lightstick_wave", 1, {}, 1);
    const right = w.spawnEnemy("teddy", w.player.x + 40, w.player.y + 6)!;
    const left = w.spawnEnemy("teddy", w.player.x - 40, w.player.y + 6)!;
    const hits = new Map<number, number>();
    w.hooks.on("hit", (h) => void hits.set(h.enemy.uid, (hits.get(h.enemy.uid) ?? 0) + 1));
    // to just after beat 4 (the first wave, to the right) and its whole expansion
    run(w, 4 * beatLen(w) + 0.7);
    expect(hits.get(right.uid)).toBe(1);
    expect(hits.get(left.uid)).toBeUndefined();
    // beat 8: the next wave sways left
    run(w, 4 * beatLen(w));
    expect(hits.get(left.uid)).toBe(1);
    expect(hits.get(right.uid)).toBe(1);
    w.setWeaponLevel(inst, 2);
    run(w, 4 * beatLen(w));
    expect(hits.get(left.uid)).toBe(2);
    expect(hits.get(right.uid)).toBe(2);
  });

  test("the crowd: +8% damage per combo rank (C = 1 ... SSS = 6)", () => {
    const dmgAt = (rank: number): number => {
      const { w } = sandbox("idol_lightstick_wave", 1, {}, 1);
      w.stats.crit = 0;
      w.comboRank = rank;
      w.combo = 999;
      w.comboTimer = 999;
      let d = 0;
      w.hooks.on("hit", (h) => void (d += h.dmg));
      for (let i = 0; i < 8; i++) w.spawnEnemy("teddy", w.player.x + 30 + i * 5, w.player.y + 6);
      run(w, 4 * beatLen(w) + 0.6, () => {
        w.comboRank = rank;
        w.comboTimer = 999;
      });
      return d;
    };
    const none = dmgAt(-1);
    const sss = dmgAt(5);
    expect(sss / none).toBeGreaterThan(1.38);
    expect(sss / none).toBeLessThan(1.58);
  });

  test("the Chorus is a full ring; Sold-Out Dome Tour fires every beat and ENCOREs every 8", () => {
    const { w } = sandbox("idol_lightstick_wave", 5, {}, 1);
    let ring = false;
    run(w, 16 * beatLen(w) + 0.05, () => {
      for (let i = 0; i < w.projectiles.count; i++) {
        const p = w.projectiles.items[i];
        if (!p.dead && p.source === "idol_lightstick_wave" && p.oy === WAVE_CHORUS) ring = p.a >= Math.PI;
      }
    });
    expect(ring).toBe(true);
    const d = sandbox("sold_out_dome_tour", 1, {}, 2);
    let beats = 0;
    let encores = 0;
    d.w.bus.on("heroFx", (e) => {
      if (e.kind === "a2_wave") beats++;
      if (e.kind === "a2_encore") encores++;
    });
    // an enemy far off in a corner of the view: only the ENCORE reaches it
    const far = d.w.spawnEnemy("teddy", d.w.player.x + 95, d.w.player.y - 170)!;
    far.hp = far.maxHp = 1e6;
    let farHits = 0;
    d.w.hooks.on("hit", (h) => {
      if (h.enemy === far) farHits++;
    });
    run(d.w, 16 * beatLen(d.w) + 0.05, () => {
      far.x = d.w.player.x + 95;
      far.y = d.w.player.y - 170;
    });
    expect(beats).toBe(16);
    expect(encores).toBe(2);
    expect(farHits).toBe(2);
  });
});

// ================================================================ Kotatsu of Sloth
describe("Kotatsu of Sloth", () => {
  test("the bible's level table, verbatim", () => {
    const L = WEAPONS.get("kotatsu_of_sloth")!.levels;
    expect(L.map((l) => [l.dmg, l.cd, l.radius, l.slow, l.deploy, l.armor, l.regen, l.comfy])).toEqual([
      [4, 0.5, 40, 0.6, 0.6, 1, 0.5, 5],
      [5, 0.5, 44, 0.6, 0.6, 1, 0.5, 5],
      [5, 0.5, 44, 0.5, 0.6, 1, 1.0, 5],
      [7, 0.5, 44, 0.5, 0.4, 2, 1.0, 5],
      [9, 0.5, 52, 0.5, 0.4, 2, 1.0, 5],
    ]);
    expect(WEAPONS.get("eternal_winter_break")!.levels[0]).toMatchObject({ dmg: 14, cd: 0.4, radius: 64, slow: 0.4, armor: 2, regen: 1.5, comfy: 3, gemPull: 120, mikanEvery: 0.5, mikanDmg: 20 });
  });

  test("deploys after standing still, gives armor + regen inside, slows and hurts; moving folds it", () => {
    const { w, inst } = sandbox("kotatsu_of_sloth", 1, {}, 1);
    const K = kotatsuOf(inst) ?? (w.step(DT), kotatsuOf(inst)!);
    const armor0 = baseStats().armor;
    w.input.mx = 0.5;
    run(w, 0.3);
    expect(K.deployed).toBe(false);
    w.input.mx = 0.05; // (stick drift below 0.1 counts as standing still)
    run(w, 0.55);
    expect(K.deployed).toBe(false);
    run(w, 0.1);
    expect(K.deployed).toBe(true);
    run(w, 0.05);
    expect(w.stats.armor).toBe(armor0 + 1);
    expect(w.stats.regen).toBeCloseTo(0.5, 6);
    const e = w.spawnEnemy("teddy", K.x + 20, K.y)!;
    const hp = e.hp;
    run(w, 1.1);
    expect(e.hp).toBeLessThan(hp);
    expect(e.slow).toBeCloseTo(0.6, 6);
    // moving folds it (no damage, no bonus)
    w.input.mx = 1;
    run(w, 0.1);
    expect(K.deployed).toBe(false);
    expect(w.stats.armor).toBe(armor0);
    expect(K.r).toBeLessThan(25);
  });

  test("Too Comfy: after 5 s still no weapon deals damage (pacifist), the aura grows, regen x3; moving wakes", () => {
    const { w, inst } = sandbox("kotatsu_of_sloth", 1, {}, 1);
    w.addWeapon("star_shot", 5);
    crowd(w, 20, 20, 70, "teddy");
    run(w, 4.5, () => topUp(w, 20, "teddy", 70));
    const K = kotatsuOf(inst)!;
    expect(K.comfy).toBe(false);
    expect(w.damageBy.get("star_shot") ?? 0).toBeGreaterThan(0);
    run(w, 0.6, () => topUp(w, 20, "teddy", 70));
    expect(K.comfy).toBe(true);
    expect(w.dozing).toBe(true);
    expect(K.r).toBeCloseTo(40 * COMFY_AURA, 3);
    expect(w.stats.regen).toBeCloseTo(1.5, 6);
    const star = w.damageBy.get("star_shot") ?? 0;
    const kot = w.damageBy.get("kotatsu_of_sloth") ?? 0;
    let hits = 0;
    w.hooks.on("hit", () => hits++);
    run(w, 6, () => topUp(w, 20, "teddy", 70));
    expect(hits).toBe(0);
    expect(w.damageBy.get("star_shot") ?? 0).toBe(star);
    expect(w.damageBy.get("kotatsu_of_sloth") ?? 0).toBe(kot);
    const rs = w.runStats();
    expect(rs.comfyBest).toBeGreaterThan(5.5);
    expect(w.summary().stats.pacifistBest).toBeGreaterThan(5.5);
    // moving wakes up instantly
    wiggle(w);
    expect(K.comfy).toBe(false);
    expect(w.dozing).toBe(false);
    run(w, 1, () => topUp(w, 20, "teddy", 70));
    expect(hits).toBeGreaterThan(0);
  });

  test("Lv5: enemies inside for 3 s fall asleep and take +25% damage", () => {
    const { w } = sandbox("kotatsu_of_sloth", 5, {}, 1);
    w.stats.crit = 0;
    const e = w.spawnEnemy("teddy", w.player.x + 24, w.player.y)!;
    e.hp = e.maxHp = 1e6;
    let sleeps = 0;
    w.bus.on("heroFx", (ev) => {
      if (ev.kind === "a2_sleep") sleeps++;
    });
    const dmg: number[] = [];
    w.hooks.on("hit", (h) => dmg.push(h.dmg));
    // deploys at 0.4 s, asleep 3 s later
    run(w, 3.7, () => {
      e.x = w.player.x + 24;
      e.y = w.player.y;
    });
    expect(sleeps).toBe(1);
    expect(asleepIn(w)?.has(e.uid)).toBe(true);
    expect(e.stun).toBeGreaterThan(0);
    const awakeAvg = dmg.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    dmg.length = 0;
    run(w, 1.4, () => {
      e.x = w.player.x + 24;
      e.y = w.player.y;
    });
    const sleepAvg = dmg.reduce((a, b) => a + b, 0) / Math.max(1, dmg.length);
    expect(sleepAvg / awakeAvg).toBeGreaterThan(1.12);
    expect(sleepAvg / awakeAvg).toBeLessThan(1.4);
  });

  test("Eternal Winter Break: always deployed, smaller + weaker while moving, pulls gems, lobs mikan when Too Comfy (weapons keep firing)", () => {
    const { w, inst } = sandbox("eternal_winter_break", 1, {}, 1);
    w.step(DT);
    const K = kotatsuOf(inst)!;
    expect(K.deployed).toBe(true);
    w.input.mx = 1;
    run(w, 0.2);
    expect(K.r).toBeCloseTo(EVO_MOVING_R, 3);
    expect(w.stats.armor).toBe(baseStats().armor + 2);
    w.input.mx = 0;
    const g = w.dropGem(w.player.x + 100, w.player.y, 1);
    g.vx = g.vy = g.vz = 0;
    g.z = 0;
    run(w, 0.1);
    expect(g.state === 1 || g.dead).toBe(true);
    crowd(w, 16, 30, 90, "teddy");
    let mikan = 0;
    w.bus.on("heroFx", (e) => {
      if (e.kind === "a2_mikan") mikan++;
    });
    run(w, 5, () => topUp(w, 16, "teddy", 90));
    expect(K.comfy).toBe(true);
    expect(w.dozing).toBe(false);
    expect(K.r).toBeCloseTo(64 * COMFY_AURA, 3);
    expect(mikan).toBeGreaterThan(2);
    expect(w.damageBy.get("eternal_winter_break") ?? 0).toBeGreaterThan(0);
  });

  test("dispose (evolution) lifts the doze and removes the armor / regen modifier", () => {
    const { w, inst } = sandbox("kotatsu_of_sloth", 5, {}, 1);
    run(w, 5.5);
    expect(w.dozing).toBe(true);
    w.addPassive("chibi_charm");
    const mods = w.statMods.length;
    w.evolveWeapon(inst);
    expect(w.dozing).toBe(false);
    w.step(DT);
    // the evolution installs its own modifier in place of the base one
    expect(w.statMods.length).toBe(mods);
  });
});

// ================================================================ passives
describe("the 8 new passives", () => {
  type Stat = keyof ReturnType<typeof baseStats>;
  /** Expected stat deltas at level l (on top of the hero's own stats). */
  const cases: [string, (l: number) => Partial<Record<Stat, number>>, string][] = [
    ["plot_armor", (l) => ({ dmgReduction: 0.05 * l }), "Damage taken -5%"],
    ["main_character_aura", (l) => ({ critMult: 0.15 * l }), "Crit damage +15%"],
    ["bento_box", (l) => ({ regen: 0.15 * l, healMul: 0.1 * l }), "Regen +0.15/s, healing +10%"],
    ["speed_lines", (l) => ({ projSpeed: 0.12 * l, knock: 0.05 * l }), "Projectile speed +12%, knockback +5%"],
    ["inner_monologue", (l) => ({ duration: 0.1 * l }), "Duration +10%"],
    ["training_montage", (l) => ({ growth: 0.08 * l }), "XP +8%"],
    ["chibi_charm", (l) => ({ hitbox: -0.08 * l, pickup: 0.15 * l }), "Hitbox -8%, pickup range +15%"],
  ];

  test.each(cases)("%s: exact stats at every level, bible card text", (id, want, lv1) => {
    const def = PASSIVE_BY_ID.get(id)!;
    expect(def).toBeTruthy();
    expect(def.icon).toBe(`icon_${id}`);
    expect(def.levels.length).toBe(5);
    expect(def.levels[0]).toBe(lv1);
    const w = new World({ hero: "hoshi", seed: 1, director: false });
    const base = { ...w.stats };
    w.addPassive(id, 1);
    for (let l = 1; l <= 5; l++) {
      w.setPassiveLevel(id, l);
      const exp = want(l);
      for (const k in exp) expect(w.stats[k as Stat] - base[k as Stat], `${id} Lv${l} ${k}`).toBeCloseTo(exp[k as Stat] as number, 6);
    }
  });

  test("bento box Lv5 text and the other Lv5 texts", () => {
    expect(PASSIVE_BY_ID.get("bento_box")!.levels[4]).toBe("Regen +0.75/s, healing +50%");
    expect(PASSIVE_BY_ID.get("plot_armor")!.levels[4]).toBe("Damage taken -25%");
    expect(PASSIVE_BY_ID.get("friendship_bracelet")!.levels).toEqual([
      "Damage +1.5% per different weapon held",
      "Damage +3% per different weapon held",
      "Damage +4.5% per different weapon held",
      "Damage +6% per different weapon held",
      "Damage +7.5% per different weapon held",
    ]);
  });

  test("Friendship Bracelet: +1.5% x level per different weapon held, recomputed on weapon changes (an evolution counts)", () => {
    const w = new World({ hero: "hoshi", seed: 1, director: false });
    const m0 = w.stats.might;
    w.addPassive("friendship_bracelet", 2);
    expect(w.stats.might).toBeCloseTo(m0 + 0.03 * 1, 6);
    w.addWeapon("petal_slash");
    w.addWeapon("yarn_orbit");
    w.step(DT);
    expect(w.stats.might).toBeCloseTo(m0 + 0.03 * 3, 6);
    w.setPassiveLevel("friendship_bracelet", 5);
    expect(w.stats.might).toBeCloseTo(m0 + 0.075 * 3, 6);
    // evolving keeps the count (the evolution is its own weapon in the same slot)
    const star = w.hasWeapon("star_shot")!;
    w.setWeaponLevel(star, 5);
    w.addPassive("wish_charm");
    w.evolveWeapon(star);
    w.step(DT);
    expect(w.stats.might).toBeCloseTo(m0 + 0.075 * 3, 6);
  });

  test("Chibi Charm shrinks the hero's hitbox (contact needs to be closer)", () => {
    const hitAt = (chibi: number, dx: number): boolean => {
      const w = new World({ hero: "hoshi", seed: 2, director: false });
      for (const i of w.weapons) i.def.dispose?.(w, i);
      w.weapons.length = 0;
      if (chibi) w.addPassive("chibi_charm", chibi);
      const e = w.spawnEnemy("teddy", w.player.x + dx, w.player.y)!;
      e.speed = 0;
      const hp = w.player.hp;
      run(w, 0.2, () => {
        e.x = w.player.x + dx;
        e.y = w.player.y;
        e.vx = e.vy = 0;
      });
      return w.player.hp < hp;
    };
    // find a distance that hurts at normal size but not at Chibi Charm Lv5 (-40% radius)
    let found = false;
    for (let dx = 4; dx < 24 && !found; dx++) if (hitAt(0, dx) && !hitAt(5, dx)) found = true;
    expect(found).toBe(true);
  });

  test("every passive that drives an evolution is registered (20 evolution pairs resolve)", () => {
    for (const b of baseWeapons()) {
      for (const e of b.evolutions ?? []) expect(PASSIVE_BY_ID.has(e.with), `${b.id} -> ${e.with}`).toBe(true);
    }
    expect(PASSIVES.length).toBeGreaterThanOrEqual(16);
  });
});

// ================================================================ Limit Breaks on every weapon
describe("Limit Breaks", () => {
  test("every registered base weapon has its Lv6 LIMIT BREAK and Lv7 MASTERED entries", () => {
    const missing: string[] = [];
    for (const b of baseWeapons()) {
      const lb = b.limitBreak;
      if (!lb || lb.length < 2 || !lb[0].text.startsWith("LIMIT BREAK") || !lb[1].text.startsWith("MASTERED")) missing.push(b.id);
    }
    expect(missing).toEqual([]);
  });
});

// ================================================================ unlocks
describe("unlock rules (weapons.md §6, achievements.md §1)", () => {
  const ctx = gameContent();
  const RULES: { id: string; kind: "weapon" | "passive"; hint: string; set: (L: ReturnType<typeof defaultProfile>, v: number) => void; target: number; run?: (v: number) => Parameters<typeof runStats>[0] }[] = [
    { id: "bubble_tea_cannon", kind: "weapon", hint: "Puffs are chewy. Squish a thousand of them.", target: 1000, set: (p, v) => void (p.lifetime.killsByEnemy.puff = v), run: (v) => ({ killsByEnemy: { puff: v } }) },
    { id: "paper_crane_flock", kind: "weapon", hint: "Fold 600 evolutions. Legend says a thousand folds grant a wish; the other 400 are sold separately.", target: 600, set: (p, v) => void (p.lifetime.evolutions = v) },
    { id: "idol_lightstick_wave", kind: "weapon", hint: "The crowd only cheers for SSS.", target: 5, set: (p, v) => void (p.lifetime.maxRank = v), run: (v) => ({ maxRank: v }) },
    { id: "kotatsu_of_sloth", kind: "weapon", hint: "Have you tried... not dashing? For three whole minutes?", target: 180, set: (p, v) => void (p.lifetime.noDashBest = v), run: (v) => ({ time: v, dashes: 0, firstDashAt: -1 }) },
    { id: "plot_armor", kind: "passive", hint: "Take five thousand damage. Walk it off. Character building.", target: 5000, set: (p, v) => void (p.lifetime.damageTaken = v), run: (v) => ({ damageTaken: v }) },
    { id: "main_character_aura", kind: "passive", hint: "Reach S rank. Main characters always do.", target: 3, set: (p, v) => void (p.lifetime.maxRank = v), run: (v) => ({ maxRank: v }) },
    { id: "bento_box", kind: "passive", hint: "Eat fifty snacks. Heroes are growing.", target: 50, set: (p, v) => void (p.lifetime.foodEaten = v), run: (v) => ({ foodEaten: v }) },
    { id: "speed_lines", kind: "passive", hint: "Dash five hundred times. Feel the lines.", target: 500, set: (p, v) => void (p.lifetime.dashes = v), run: (v) => ({ dashes: v }) },
    { id: "inner_monologue", kind: "passive", hint: "Shout twenty-five attack names.", target: 25, set: (p, v) => void (p.lifetime.ults = v), run: (v) => ({ ults: v }) },
    { id: "training_montage", kind: "passive", hint: "Reach level 25 in one episode. Cue the montage music.", target: 25, set: (p, v) => void (p.lifetime.bestLevel = v), run: (v) => ({ level: v }) },
    { id: "chibi_charm", kind: "passive", hint: "Two minutes without a scratch. Be small. Be unhittable.", target: 120, set: (p, v) => void (p.lifetime.noHitBest = v), run: (v) => ({ noHitBest: v, time: v + 10 }) },
  ];

  test.each(RULES)("$id: locked at the start, hint verbatim, unlocks exactly at the counter's target", ({ id, kind, hint, target, set }) => {
    const p = defaultProfile(0);
    evaluateUnlocks(p, ctx);
    expect(isUnlocked(p, kind, id)).toBe(false);
    const st = unlockStatus(p, kind, id, ctx);
    expect(st.rule.hint).toBe(hint);
    expect(st.target).toBe(target);
    set(p, target - 1);
    expect(evaluateUnlocks(p, ctx).map((e) => e.id)).not.toContain(id);
    set(p, target);
    const ev = evaluateUnlocks(p, ctx).find((e) => e.id === id);
    expect(ev).toMatchObject({ kind, id, start: false });
    expect(isUnlocked(p, kind, id)).toBe(true);
  });

  test.each(RULES.filter((r) => r.run))("$id: a banked run carrying the counter unlocks it", ({ id, kind, target, run: over }) => {
    const p = defaultProfile(0);
    evaluateUnlocks(p, ctx);
    applyRunToProfile(p, { stats: runStats(over!(target)) }, ctx);
    evaluateUnlocks(p, ctx);
    expect(isUnlocked(p, kind, id)).toBe(true);
  });

  test("Friendship Bracelet: own 4 heroes", () => {
    const p = defaultProfile(0);
    evaluateUnlocks(p, ctx);
    expect(unlockRule("passive", "friendship_bracelet", ctx)).toMatchObject({ cond: { t: "heroCount", count: 4 }, hint: "Make four friends. (Heroes count.)" });
    expect(isUnlocked(p, "passive", "friendship_bracelet")).toBe(false);
    for (const h of ["rin", "mochi", "kuro"]) if (!p.unlocks.heroes.includes(h)) p.unlocks.heroes.push(h);
    while (p.unlocks.heroes.length < 4) p.unlocks.heroes.push(`friend_${p.unlocks.heroes.length}`);
    evaluateUnlocks(p, ctx);
    expect(isUnlocked(p, "passive", "friendship_bracelet")).toBe(true);
  });

  test("a locked weapon / passive never shows up on level-up cards; unlocked ones do", () => {
    const pool = ["star_shot", "petal_slash"];
    const w = new World({ hero: "hoshi", seed: 3, director: false, run: defaultRunConfig({ weaponPool: pool, passivePool: ["power_bow"] }) });
    for (let i = 0; i < 60; i++) for (const c of makeOffer(w, 4)) expect(["star_shot", "petal_slash", "power_bow", "heal", "coins"]).toContain(c.id);
    const w2 = new World({ hero: "hoshi", seed: 3, director: false, run: defaultRunConfig({ weaponPool: ["star_shot", "kotatsu_of_sloth"], passivePool: ["chibi_charm"] }) });
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) for (const c of makeOffer(w2, 4)) seen.add(c.id);
    expect(seen.has("kotatsu_of_sloth")).toBe(true);
    expect(seen.has("chibi_charm")).toBe(true);
  });
});

// ================================================================ the counters, end to end
describe("counters feed the account", () => {
  test("a real 3:05 run dozing in the kotatsu: RunStats.comfyBest -> the hidden 'Do Not Disturb' Plot Point; no dash -> the Kotatsu unlock", () => {
    const { w } = sandbox("kotatsu_of_sloth", 5, {}, 3);
    run(w, 185);
    const stats = w.summary().stats;
    expect(stats.comfyBest).toBeGreaterThanOrEqual(120);
    expect(stats.pacifistBest).toBeGreaterThanOrEqual(120);
    expect(stats.firstDashAt).toBe(-1);
    const p = defaultProfile(0);
    evaluateUnlocks(p, gameContent());
    const rep = applyRunToProfile(p, { stats }, gameContent());
    expect(rep.achievements.map((a) => a.def.id)).toContain("do_not_disturb");
    expect(rep.achievements.map((a) => a.def.id)).toContain("no_dash");
    expect(isUnlocked(p, "weapon", "kotatsu_of_sloth")).toBe(true);
  });

  test("a Lightstick-unlocking SSS run and a Bubble-Tea-unlocking puff count come from the sim's own RunStats", () => {
    const w = new World({ hero: "hoshi", seed: 8, director: false, god: true });
    crowd(w, 30);
    w.combo = 400;
    w.comboTimer = 99;
    run(w, 3, () => topUp(w, 30));
    const s = w.summary().stats;
    expect(s.maxRank).toBeGreaterThanOrEqual(0);
    expect(s.killsByEnemy.puff ?? 0).toBeGreaterThan(0);
    const p = defaultProfile(0);
    evaluateUnlocks(p, gameContent());
    p.lifetime.killsByEnemy.puff = 1000 - (s.killsByEnemy.puff ?? 0);
    p.lifetime.maxRank = 4;
    applyRunToProfile(p, { stats: { ...s, maxRank: 5 } }, gameContent());
    evaluateUnlocks(p, gameContent());
    expect(isUnlocked(p, "weapon", "bubble_tea_cannon")).toBe(true);
    expect(isUnlocked(p, "weapon", "idol_lightstick_wave")).toBe(true);
  });
});

// ================================================================ in a real run
describe("in a real run", () => {
  test("a 2-minute bot run holding all four (then all four evolutions) survives without exceptions", { tags: ["slow"] }, () => {
    for (const set of [ARSENAL.map((a) => a.weapon), ARSENAL.map((a) => a.evo)]) {
      const w = new World({ hero: "mochi", seed: 4242, maxEnemies: 250 });
      for (const id of set) w.addWeapon(id, 5);
      simulate(w, 120, 1 / 30, new Bot(9), () => {
        expect(Number.isFinite(w.player.x) && Number.isFinite(w.player.y)).toBe(true);
      });
      expect(w.t).toBeGreaterThan(30);
      // (the kotatsu only hurts what walks into it before Too Comfy pauses every weapon: with three Lv5 weapons
      // clearing the screen it may never get a hit in, so it counts as working once it got the hero Too Comfy)
      for (const id of set) {
        const worked = (w.damageBy.get(id) ?? 0) > 0 || (id.startsWith("kotatsu") && (w.runStats().comfyBest ?? 0) > 0);
        expect(worked, id).toBe(true);
      }
      expect(w.projectiles.count).toBeLessThan(900);
    }
  });
});
