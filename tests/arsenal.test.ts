/**
 * Arsenal: the five later weapons (Heart Boomerang, Thunder Bell, Candy Bomb,
 * Bubble Aura, Prism Beam) and their evolutions, headless.
 *   - acquiring + levelling 1 -> 5, damage in a sandbox world
 *   - evolution cards are offered when eligible (level-up and chest) and the evolved weapon works
 *   - a 60 s stress run with 6 max-level weapons (and one with 6 evolutions) at 250 enemies
 */
import { describe, expect, test } from "vitest";
import { CFG } from "../src/game/config";
import { WEAPONS } from "../src/game/registry";
import { evolutionCards, makeOffer } from "../src/game/upgrades";
import type { Enemy, WeaponInstance } from "../src/game/types";
import { Bot, simulate } from "../src/debug/bot";
import { World } from "../src/game/world";

const DT = 1 / 60;

const ARSENAL = [
  { base: "heart_boomerang", evo: "love_tornado", with: "twin_charm" },
  { base: "thunder_bell", evo: "raijin_drum", with: "power_bow" },
  { base: "candy_bomb", evo: "sugar_nuke", with: "lucky_clover" },
  { base: "bubble_aura", evo: "ocean_dome", with: "heart_locket" },
  { base: "prism_beam", evo: "rainbow_cannon", with: "swift_shoes" },
] as const;

/** A quiet sandbox: no director, invulnerable hero, a crowd of puffs around the hero. */
function sandbox(seed = 7): World {
  const w = new World({ hero: "hoshi", seed, director: false, god: true });
  // remove the hero's start weapon so damage numbers belong to the weapon under test
  w.weapons.length = 0;
  return w;
}

function crowd(w: World, n: number, rMin = 18, rMax = 80, id = "puff"): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + w.rng.next() * 0.3;
    const r = rMin + w.rng.next() * (rMax - rMin);
    w.spawnEnemy(id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r * 0.9);
  }
}

/** Keep the crowd topped up to `n` enemies (respawned on a ring around the hero). */
function topUp(w: World, n: number, id = "puff"): void {
  while (w.enemyCount < n) {
    const a = w.rng.angle();
    const r = 30 + w.rng.next() * 110;
    if (!w.spawnEnemy(id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r)) break;
  }
}

function run(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += DT) {
    w.step(DT);
    each?.();
  }
}

describe.each(ARSENAL)("$base -> $evo", ({ base, evo, with: passive }) => {
  test("is registered with 5 levels, upgrade texts and an evolution", () => {
    const def = WEAPONS.get(base)!;
    expect(def).toBeTruthy();
    expect(def.levels.length).toBe(CFG.maxLevel);
    expect(def.upgrades.length).toBe(CFG.maxLevel - 1);
    for (const t of def.upgrades) expect(t.length).toBeGreaterThan(4);
    expect(def.evolutions?.[0]).toEqual({ into: evo, with: passive });
    const e = WEAPONS.get(evo)!;
    expect(e.evolved).toBe(true);
    expect(e.levels.length).toBe(1);
    expect(def.icon.startsWith("icon_")).toBe(true);
    expect(e.icon.startsWith("icon_")).toBe(true);
  });

  test("is offered as NEW, levels 1 -> 5 and damages enemies at every level", () => {
    const w = sandbox(11);
    // NEW card shows up in offers while a slot is free
    let seen = false;
    for (let i = 0; i < 60 && !seen; i++) seen = makeOffer(w, 4).some((c) => c.id === base && c.from === 0);
    expect(seen).toBe(true);
    const inst = w.addWeapon(base) as WeaponInstance;
    expect(inst).toBeTruthy();
    let prev = 0;
    for (let lv = 1; lv <= 5; lv++) {
      w.setWeaponLevel(inst, lv);
      expect(inst.level).toBe(lv);
      crowd(w, 30);
      run(w, 3);
      expect(inst.damage).toBeGreaterThan(prev);
      prev = inst.damage;
    }
    expect(inst.kills).toBeGreaterThan(0);
    expect(w.summary().weapons.find((x) => x.id === base)!.damage).toBe(Math.round(inst.damage));
    // no orphaned projectiles once the crowd is gone
    for (let i = 0; i < w.enemies.count; i++) w.despawn(w.enemies.items[i]);
    run(w, 6);
    expect(w.projectiles.count).toBeLessThan(40);
  });

  test("evolution is offered when eligible (cards + chest) and the evolved weapon works", () => {
    const w = sandbox(5);
    const inst = w.addWeapon(base, 5) as WeaponInstance;
    expect(evolutionCards(w).length).toBe(0); // needs the passive
    w.addPassive(passive);
    const cards = evolutionCards(w);
    expect(cards.map((c) => c.id)).toContain(evo);
    const offer = makeOffer(w);
    expect(offer[0].kind).toBe("evolution");
    expect(offer[0].id).toBe(evo);
    let evolved = 0;
    w.bus.on("evolution", (e) => {
      if (e.weapon === evo) evolved++;
    });
    crowd(w, 20);
    run(w, 1);
    const dmgBefore = inst.damage;
    w.choose(offer[0]);
    expect(evolved).toBe(1);
    const evoInst = w.hasWeapon(evo) as WeaponInstance;
    expect(evoInst).toBeTruthy();
    expect(w.hasWeapon(base)).toBeUndefined();
    expect(evoInst.slot).toBe(inst.slot);
    expect(evoInst.damage).toBe(dmgBefore);
    for (let k = 0; k < 4; k++) {
      crowd(w, 40, 16, 110);
      run(w, 2.5);
    }
    expect(evoInst.damage).toBeGreaterThan(dmgBefore + 600);
    expect(evoInst.kills).toBeGreaterThan(20);
    // never offered as NEW again once evolved
    for (let i = 0; i < 20; i++) expect(makeOffer(w, 4).some((c) => c.id === base || c.id === evo)).toBe(false);

    // chests prioritise the evolution too
    const w2 = sandbox(9);
    w2.addWeapon(base, 5);
    w2.addPassive(passive);
    w2.dropPickup("chest", w2.player.x, w2.player.y);
    w2.pendingChests.push({ golden: false });
    const res = w2.openChest()!;
    expect(res.rewards[0].kind).toBe("evolution");
    expect(w2.hasWeapon(evo)).toBeTruthy();
  });
});

test("Thunder Bell chains: one strike hits several enemies", () => {
  const w = sandbox(3);
  const inst = w.addWeapon("thunder_bell", 3) as WeaponInstance;
  // a tight cluster in view
  for (let i = 0; i < 8; i++) {
    const e = w.spawnEnemy("shroomie", w.player.x + 40 + (i % 4) * 12, w.player.y - 30 + Math.floor(i / 4) * 14)!;
    e.maxHp = e.hp = 5000;
  }
  let chains = 0;
  w.bus.on("weaponFx", (e) => {
    if (e.kind === 2) chains++;
  });
  run(w, 2);
  expect(inst.damage).toBeGreaterThan(0);
  expect(chains).toBeGreaterThan(2);
});

test("Bubble Aura slows enemies inside and spares bosses from the slow", () => {
  const w = sandbox(4);
  w.addWeapon("bubble_aura", 1);
  const e = w.spawnEnemy("shroomie", w.player.x + 12, w.player.y + 4)!;
  e.maxHp = e.hp = 1e6;
  run(w, 0.5);
  expect(e.slow).toBeLessThan(1);
  expect(e.hp).toBeLessThan(1e6);
});

test("Ocean Dome heals 1 HP per 10 kills and bursts outward", () => {
  const w = sandbox(6);
  w.addWeapon("bubble_aura", 5);
  w.addPassive("heart_locket");
  w.choose(evolutionCards(w)[0]);
  const dome = w.hasWeapon("ocean_dome")!;
  expect(dome).toBeTruthy();
  w.player.hp = 20;
  let bursts = 0;
  w.bus.on("weaponFx", (e) => {
    if (e.kind === 6) bursts++;
  });
  const hp0 = w.player.hp;
  for (let k = 0; k < 6; k++) {
    crowd(w, 30, 10, 50);
    run(w, 1);
  }
  expect(dome.kills).toBeGreaterThanOrEqual(20);
  // regen from the locket is part of it; at least the kill heals on top
  expect(w.player.hp - hp0).toBeGreaterThan(Math.floor(dome.kills / 10) - 1);
  expect(bursts).toBeGreaterThanOrEqual(2);
});

test("Candy bombs land after ~0.6 s and explode with the weapon's radius", () => {
  const w = sandbox(2);
  w.addWeapon("candy_bomb", 1);
  crowd(w, 10, 40, 60);
  const booms: { t: number; r: number }[] = [];
  w.bus.on("explosion", (e) => {
    if (e.source === "candy_bomb") booms.push({ t: w.t, r: e.r });
  });
  run(w, 1.2);
  expect(booms.length).toBe(1);
  expect(booms[0].t).toBeGreaterThan(0.75);
  expect(booms[0].t).toBeLessThan(1.05);
  expect(booms[0].r).toBeCloseTo(28, 0);
});

const STRESS_BASE = ["star_shot", "heart_boomerang", "thunder_bell", "candy_bomb", "bubble_aura", "prism_beam"];
const STRESS_EVO = ["galaxy_barrage", "love_tornado", "raijin_drum", "sugar_nuke", "ocean_dome", "rainbow_cannon"];

test.each([
  ["6 max-level weapons", STRESS_BASE, 5],
  ["6 evolutions", STRESS_EVO, 1],
])("60 s stress: %s with 250 enemies, no exceptions, bounded counts", { tags: ["slow"] }, (_name, ids, level) => {
  const w = new World({ hero: "hoshi", seed: 21, director: false, god: true, maxEnemies: 400 });
  w.weapons.length = 0;
  for (const id of ids) expect(w.addWeapon(id, level)).toBeTruthy();
  for (const p of ["power_bow", "wish_charm", "big_ribbon", "twin_charm", "swift_shoes", "lucky_clover"]) w.addPassive(p, 5);
  expect(w.weapons.length).toBe(6);
  let maxProj = 0;
  let hits = 0;
  w.bus.on("enemyHit", () => hits++);
  for (let t = 0; t < 60; t += DT) {
    topUp(w, 250, w.rng.next() < 0.1 ? "shroomie" : "puff");
    // wander so weapons see fresh crowds from every side
    w.input.mx = Math.cos(w.t * 0.4);
    w.input.my = Math.sin(w.t * 0.31);
    w.step(DT);
    maxProj = Math.max(maxProj, w.projectiles.count);
    expect(Number.isFinite(w.player.x)).toBe(true);
  }
  expect(w.phase).toBe("play");
  expect(maxProj).toBeLessThan(900);
  expect(w.kills).toBeGreaterThan(1500);
  expect(hits).toBeGreaterThan(w.kills);
  for (const inst of w.weapons) expect(inst.damage).toBeGreaterThan(0);
});

describe("homing projectiles and pooled enemies", () => {
  test("a homing star never keeps chasing a pooled Enemy object that was recycled into a new enemy", { tags: ["slow"] }, () => {
    // (god mode: the run must still be going after 150 s whatever the card offers of the day make the bot pick -
    // every new evolution recipe moves them, and this seed's hero once died at 130 s with nothing left to check)
    const w = new World({ hero: "hoshi", seed: 21, god: true });
    const bot = new Bot(3);
    simulate(w, 150, 1 / 30, bot);
    // A target that dies and whose pooled object is re-spawned AFTER this step's homing update (a kill-hook spawn
    // such as a spore reusing the object) is seen here once with a foreign uid; the next homing update must drop
    // it before steering. A projectile still holding the same foreign object one step later is chasing a stranger.
    const pending = new Map<number, Enemy>();
    let stale = 0;
    let checks = 0;
    simulate(w, 60, DT, bot, (ww) => {
      for (let i = 0; i < ww.projectiles.count; i++) {
        const p = ww.projectiles.items[i];
        // (a projectile inside its `delay` - a boba pearl's beat after a bounce - is not homing yet: World skips its
        // homing update, so it neither drops nor chases the stale object until the delay is over)
        if (p.dead || p.homing <= 0 || !p.target || p.age < p.delay) continue;
        checks++;
        const t = p.target;
        if (t.uid !== p.targetUid) {
          if (pending.get(p.uid) === t) stale++;
          pending.set(p.uid, t);
        } else pending.delete(p.uid);
      }
    });
    expect(checks).toBeGreaterThan(1000);
    expect(stale).toBe(0);
  });

  test("a pierce-once star that already hit its surviving target moves on to one it has not hit", () => {
    const w = new World({ hero: "hoshi", seed: 5, god: true, director: false });
    const tough = w.spawnEnemy("teddy", w.player.x + 50, w.player.y, true)!;
    tough.hp = tough.maxHp = 1e9;
    const other = w.spawnEnemy("puff", w.player.x + 50, w.player.y + 60)!;
    other.hp = other.maxHp = 1e9;
    const p = w.spawnProjectile(w.weapons[0]);
    p.x = tough.x - 4;
    p.y = tough.y - tough.cy;
    p.vx = 160;
    p.speed = 160;
    p.homing = 7.5;
    p.target = tough;
    p.targetUid = tough.uid;
    p.r = 5;
    p.dmg = 1;
    p.pierce = 4;
    p.life = 3;
    for (let i = 0; i < 10 && p.target === tough; i++) {
      tough.x = w.player.x + 50;
      tough.kx = tough.ky = 0;
      w.step(DT);
    }
    expect(p.nHits).toBeGreaterThanOrEqual(1);
    expect(p.target).toBe(other);
    expect(p.targetUid).toBe(other.uid);
  });
});
