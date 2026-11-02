/**
 * Headless simulation: 3-minute bot runs at fixed dt for every hero.
 * Asserts no exceptions, sane entity counts, progression and determinism.
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG, CH_ULT } from "../src/game/config";
import { BOSSES } from "../src/game/registry";
import { HERO_IDS } from "../src/game/heroes";
import { World } from "../src/game/world";

const DT = 1 / 30;

describe.each(HERO_IDS)("3-minute run: %s", (hero) => {
  test("plays through 3:00 with sane counts and progression", () => {
    const w = new World({ hero, seed: 1234, maxEnemies: 250 });
    let firstLevel = -1;
    let ults = 0;
    let evolutions = 0;
    let hits = 0;
    let deaths = 0;
    w.bus.on("levelUp", () => {
      if (firstLevel < 0) firstLevel = w.t;
    });
    w.bus.on("ultStart", () => ults++);
    w.bus.on("evolution", () => evolutions++);
    w.bus.on("enemyHit", () => hits++);
    w.bus.on("playerDied", () => deaths++);
    let maxEnemies = 0;
    let maxProj = 0;
    let maxGems = 0;
    let maxBullets = 0;
    simulate(w, 180, DT, new Bot(77), () => {
      maxEnemies = Math.max(maxEnemies, w.enemyCount);
      maxProj = Math.max(maxProj, w.projectiles.count);
      maxGems = Math.max(maxGems, w.gems.count);
      maxBullets = Math.max(maxBullets, w.bullets.count);
      // invariants every step
      expect(Number.isFinite(w.player.x) && Number.isFinite(w.player.y)).toBe(true);
      expect(w.player.hp).toBeLessThanOrEqual(w.player.maxHp + 1e-6);
      expect(w.enemyCount).toBeGreaterThanOrEqual(0);
    });
    // either survived to 3:00 or died (bot) - but it must have played a real run
    expect(w.t).toBeGreaterThan(deaths > 0 ? 30 : 179.9);
    expect(firstLevel).toBeGreaterThan(0);
    expect(firstLevel).toBeLessThan(8); // DESIGN pillar: first level-up inside 8 s
    expect(w.level).toBeGreaterThanOrEqual(8);
    expect(w.kills).toBeGreaterThan(250);
    expect(hits).toBeGreaterThan(w.kills);
    expect(maxEnemies).toBeLessThanOrEqual(250 + 60); // cap + event waves / splits
    expect(maxProj).toBeLessThan(800);
    expect(maxGems).toBeLessThanOrEqual(CFG.maxGems + 60);
    expect(ults).toBeGreaterThanOrEqual(1);
    expect(w.weapons.length).toBeGreaterThanOrEqual(2);
    const s = w.summary();
    expect(s.weapons.reduce((a, x) => a + x.damage, 0)).toBeGreaterThan(1000);
    void evolutions;
    void maxBullets;
  });
});

test("same seed + same inputs = same run (determinism)", () => {
  const run = () => {
    const w = new World({ hero: "mochi", seed: 99 });
    simulate(w, 45, DT, new Bot(5));
    return [w.t.toFixed(3), w.kills, w.level, w.player.x.toFixed(3), w.player.y.toFixed(3), w.enemyCount, Math.round(w.coins)].join("|");
  };
  expect(run()).toBe(run());
});

test("ultimates resolve: cut-in pauses the sim, then the effect damages enemies", () => {
  for (const hero of HERO_IDS) {
    const w = new World({ hero, seed: 3, director: false });
    for (let i = 0; i < 30; i++) w.spawnEnemy("puff", (i % 6) * 20 - 50, Math.floor(i / 6) * 20 - 40);
    w.addUlt(100);
    expect(w.ultReady).toBe(true);
    w.input.ult = true;
    w.step(DT);
    expect(w.ult?.phase).toBe("cutin");
    const t0 = w.t;
    for (let i = 0; i < Math.ceil(CFG.cutinTime / DT) + 1; i++) w.step(DT);
    expect(w.t - t0).toBeLessThan(0.2); // run clock barely moved during the cut-in
    expect(w.ult?.phase).toBe("active");
    expect(w.invulnerable).toBe(true);
    for (let i = 0; i < 6 / DT && w.ult; i++) w.step(DT);
    expect(w.ult).toBeNull();
    expect(w.kills).toBeGreaterThan(10);
  }
});

test("dash gives i-frames and moves ~48 px", () => {
  const w = new World({ hero: "hoshi", seed: 1, director: false });
  w.input.mx = 1;
  w.input.dash = true;
  const x0 = w.player.x;
  w.step(1 / 60);
  expect(w.invulnerable).toBe(true);
  for (let i = 0; i < 10; i++) w.step(1 / 60);
  expect(w.player.x - x0).toBeGreaterThan(40);
  expect(w.hurtPlayer(10, w.player.x + 5, w.player.y)).toBe(false);
});

test("gems merge above 250 and are collected with combo multiplier", () => {
  const w = new World({ hero: "hoshi", seed: 2, director: false });
  for (let i = 0; i < 400; i++) w.dropGem(200 + (i % 20) * 9, 200 + Math.floor(i / 20) * 9, 1);
  for (let i = 0; i < 40; i++) w.step(1 / 30);
  expect(w.gems.count).toBeLessThanOrEqual(CFG.maxGems);
  let total = 0;
  for (let i = 0; i < w.gems.count; i++) total += w.gems.items[i].value;
  expect(total).toBe(400);
  expect(w.gems.items.slice(0, w.gems.count).some((g) => g.tier === 4)).toBe(true);
});

test("shroomie splits into spores; elites drop a chest", () => {
  const w = new World({ hero: "rin", seed: 2, director: false });
  const s = w.spawnEnemy("shroomie", 300, 300)!;
  w.hitEnemy(s, 9999, null, 0, 0, 0, "test", 0xffffff);
  let spores = 0;
  for (let i = 0; i < w.enemies.count; i++) if (!w.enemies.items[i].dead && w.enemies.items[i].def.id === "spore") spores++;
  expect(spores).toBe(2);
  const e = w.spawnEnemy("puff", 300, 300, true)!;
  expect(e.elite).toBe(true);
  expect(e.maxHp).toBeGreaterThanOrEqual(80);
  w.hitEnemy(e, 99999, null, 0, 0, 0, "test", 0xffffff);
  expect(w.pickups.items.slice(0, w.pickups.count).some((p) => p.kind === "chest")).toBe(true);
});

test("3:00 boss: WARNING, King Puff enters, slams (telegraph + bullets), dies into a golden chest", () => {
  const w = new World({ hero: "hoshi", seed: 8, god: true });
  const seen = { warning: 0, spawn: 0, telegraph: 0, killed: 0, golden: 0 };
  w.bus.on("bossWarning", () => seen.warning++);
  w.bus.on("bossSpawn", () => seen.spawn++);
  w.bus.on("telegraph", () => seen.telegraph++);
  w.bus.on("bossKilled", () => seen.killed++);
  w.bus.on("chestDropped", (e) => e.golden && seen.golden++);
  let maxBullets = 0;
  simulate(w, 195, 1 / 30, new Bot(4), () => {
    maxBullets = Math.max(maxBullets, w.bullets.count);
  });
  expect(seen.warning).toBe(1);
  expect(seen.spawn).toBe(1);
  if (w.boss) {
    expect(w.boss.def.id).toBe("king_puff");
    w.hitEnemy(w.boss, 1e6, null, 0, 0, 0, "test", 0xffffff);
  }
  expect(seen.killed).toBe(1);
  expect(seen.golden).toBe(1);
  expect(w.boss).toBeNull();
  expect(seen.telegraph + maxBullets).toBeGreaterThan(0);
});

describe("victory while the Overdrive is active", () => {
  test.each(HERO_IDS)("%s: the final boss falls mid-ult -> the ult closes (no stuck time-stop, cast pose, frozen cats / meteors)", (hero) => {
    const H = 1 / 60;
    const w = new World({ hero, seed: 11, god: true });
    w.director.warnBoss(BOSSES.get("lady_lunatic")!, 0);
    w.director.warning!.t = 0;
    for (let i = 0; i < 10 && !w.boss; i++) w.step(H);
    const lady = w.boss!;
    expect(lady.def.id).toBe("lady_lunatic");
    for (let i = 0; i < 120; i++) w.step(H);
    let ultEnd = 0;
    w.bus.on("ultEnd", () => ultEnd++);
    w.addUlt(100);
    w.input.ult = true;
    w.step(H);
    for (let i = 0; i < 200 && w.ult?.phase === "cutin"; i++) w.step(H);
    expect(w.ult?.phase).toBe("active");
    for (let i = 0; i < 12; i++) w.step(H); // 0.2 s in (Rin: time is stopped; cats / meteors in flight)
    lady.inv = 0;
    w.hitEnemy(lady, lady.hp * 2, null, 0, 0, 0, "weapon", 0xffffff); // a weapon lands the final blow
    expect(w.phase).toBe("victory");
    for (let i = 0; i < 60 * 8; i++) w.step(H); // the dawn sequence
    expect(w.ult).toBeNull();
    expect(w.timeStop).toBe(false);
    expect(ultEnd).toBe(1);
    let ultProjs = 0;
    for (let i = 0; i < w.projectiles.count; i++) {
      const p = w.projectiles.items[i];
      if (!p.dead && (p.ch === CH_ULT || p.source === w.hero.ult)) ultProjs++;
    }
    expect(ultProjs).toBe(0);
  });
});
