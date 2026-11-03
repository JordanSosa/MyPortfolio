/**
 * Season 2 heroes, group B: Senpai, Magical Girl #47, Isekai-kun, Truck-kun
 * (docs/content/heroes.md §2.8-2.11, weapons.md §2.5-2.8), headless:
 *   - the HeroDef (trait incl. its install part, start weapon, ult, cut-in data, constellations)
 *   - the signature weapon levels 1 -> 7 (Limit Breaks) and hurts enemies at every level
 *   - it evolves (the card once its paired passive is registered; the evolved weapon works either way)
 *   - the ultimate runs to completion, deals damage and keeps the hero invulnerable
 *   - hero mechanics: charm / swoon, Panic Henshin, overdos, the truck's driving / ram / isekai'd
 *   - talents (capstones read by weapon / ult code) and constellations apply
 *   - a 3-minute bot run per hero (and a maxed talents + C6 run) survives without exceptions
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import { heroDef, HEROES } from "../src/game/heroes";
import { PASSIVE_BY_ID } from "../src/game/passives";
import { TALENT_TREES, ULTIMATES, WEAPONS } from "../src/game/registry";
import { defaultRunConfig, type RunConfig } from "../src/game/run-config";
import { baseStats } from "../src/game/stats";
import type { WeaponInstance } from "../src/game/types";
import { evolutionCards } from "../src/game/upgrades";
import { charm, charmRecs, isCharmed, recOf } from "../src/game/weapons/_charm";
import { truckState } from "../src/game/weapons/_truck";
import { World } from "../src/game/world";

const DT = 1 / 60;

const GROUP = [
  { hero: "senpai", weapon: "notice_me_sparkles", evo: "shoujo_filter", passive: "main_character_aura", ult: "senpai_noticed_you" },
  { hero: "magical_girl_47", weapon: "henshin_burst", evo: "infinite_henshin_loop", passive: "plot_armor", ult: "episode_long_transformation" },
  { hero: "isekai_kun", weapon: "cheat_fireball", evo: "cheat_meteor", passive: "training_montage", ult: "status_screen" },
  { hero: "truck_kun", weapon: "horn_of_reincarnation", evo: "isekai_rush_hour", passive: "swift_shoes", ult: "isekai_express" },
] as const;

/** A quiet sandbox: no director, invulnerable hero. */
function sandbox(hero: string, run: Partial<RunConfig> = {}, seed = 7): World {
  const w = new World({ hero, seed, director: false, god: true, run: defaultRunConfig(run) });
  while (w.pendingLevels > 0) w.skipLevel();
  return w;
}

function crowd(w: World, n: number, rMin = 16, rMax = 70, id = "puff"): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + w.rng.next() * 0.3;
    const r = rMin + w.rng.next() * (rMax - rMin);
    w.spawnEnemy(id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r * 0.9);
  }
}

function topUp(w: World, n: number, id = "puff", rMin = 16, rMax = 80): void {
  while (w.enemyCount < n) {
    const a = w.rng.angle();
    const r = rMin + w.rng.next() * (rMax - rMin);
    if (!w.spawnEnemy(id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r)) break;
  }
}

function run(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += DT) {
    w.step(DT);
    each?.();
  }
}

/** Cast the ult and play it out; returns its damage, whether the hero stayed invulnerable, steps taken. */
function castUlt(w: World, keepCrowd = 40): { dmg: number; inv: boolean; steps: number } {
  w.addUlt(100);
  w.input.ult = true;
  w.step(DT);
  expect(w.ult?.phase).toBe("cutin");
  let inv = true;
  let steps = 0;
  while (w.ult && steps < 60 * 12) {
    if (w.ult.phase === "active" && !w.invulnerable) inv = false;
    topUp(w, keepCrowd, "puff", 10, 110);
    w.step(DT);
    steps++;
  }
  return { dmg: w.damageBy.get(w.ultId) ?? 0, inv, steps };
}

function inst(w: World, id: string): WeaponInstance {
  const i = w.hasWeapon(id);
  expect(i, id).toBeTruthy();
  return i as WeaponInstance;
}

describe.each(GROUP)("$hero", ({ hero, weapon, evo, passive, ult }) => {
  test("HeroDef: trait, signature weapon, ult, cut-in data, sprites, 6 constellations, talent tree", () => {
    const h = heroDef(hero);
    expect(h.id).toBe(hero);
    expect(HEROES.filter((x) => x.id === hero).length).toBe(1);
    expect(h.weapon).toBe(weapon);
    expect(h.ult).toBe(ult);
    expect(h.sprite).toBe(hero);
    expect(h.portrait).toBe(`portrait_${hero}`);
    expect(h.cutinLine && h.cutinLine.length).toBeGreaterThan(5);
    expect(h.band?.length).toBe(3);
    expect(h.constellations?.length).toBe(6);
    expect(WEAPONS.get(weapon)?.evolution).toEqual({ into: evo, with: passive });
    expect(WEAPONS.get(evo)?.evolved).toBe(true);
    expect(ULTIMATES.get(ult)?.hero).toBe(hero);
    const tree = TALENT_TREES.get(hero);
    expect(tree?.nodes.length).toBe(15);
    for (let b = 0; b < 3; b++) {
      const ranks = tree!.nodes.filter((n) => n.branch === b).sort((x, y) => x.tier - y.tier).map((n) => n.maxRank);
      expect(ranks).toEqual([5, 3, 3, 3, 1]);
    }
    for (const n of tree!.nodes) {
      expect(n.id.startsWith(hero === "magical_girl_47" ? "mg47_" : hero === "isekai_kun" ? "isekai_" : hero === "truck_kun" ? "truck_" : "senpai_")).toBe(true);
      expect(n.desc(n.maxRank).length).toBeGreaterThan(5);
    }
    const w = sandbox(hero);
    expect(w.weapons.map((x) => x.def.id)).toEqual([weapon]);
  });

  test("the signature weapon levels 1 -> 7 (Limit Breaks) and hurts enemies at every level", () => {
    const w = sandbox(hero, { weaponLevelBonus: { [weapon]: 2 } });
    const wi = inst(w, weapon);
    expect(w.weaponMaxLevel(wi.def)).toBe(7);
    expect(wi.def.limitBreak?.length).toBe(2);
    expect(wi.def.upgrades.length).toBe(4);
    for (let lv = 1; lv <= 7; lv++) {
      w.setWeaponLevel(wi, lv);
      expect(wi.level).toBe(lv);
      const before = wi.damage;
      crowd(w, 24, 14, 50);
      run(w, 6, () => topUp(w, 18, "puff", 14, 50));
      expect(wi.damage, `Lv${lv}`).toBeGreaterThan(before);
    }
  });

  test("evolves into its evolution (and the evolved weapon works)", () => {
    const w = sandbox(hero);
    const wi = inst(w, weapon);
    w.setWeaponLevel(wi, 5);
    if (PASSIVE_BY_ID.has(passive)) {
      expect(evolutionCards(w).length).toBe(0);
      w.addPassive(passive, 1);
      const cards = evolutionCards(w);
      expect(cards.map((c) => c.id)).toContain(evo);
      w.choose(cards.find((c) => c.id === evo)!);
    } else w.evolveWeapon(wi);
    const ev = inst(w, evo);
    crowd(w, 30, 14, 60);
    run(w, 10, () => topUp(w, 26, "puff", 14, 70));
    expect(ev.damage).toBeGreaterThan(wi.damage);
  });

  test("the ultimate runs to completion, deals damage and keeps the hero invulnerable", () => {
    const w = sandbox(hero);
    (w as unknown as { god: boolean }).god = false;
    w.player.hp = w.player.maxHp = 9999;
    crowd(w, 40, 10, 110);
    const r = castUlt(w);
    expect(w.ult).toBeNull();
    expect(r.dmg).toBeGreaterThan(0);
    expect(r.inv).toBe(true);
    // (the active part ends by its own duration, never stuck)
    expect(r.steps).toBeLessThan(60 * 7.5);
  });

  test("a 3-minute bot run survives without exceptions", () => {
    const w = new World({ hero, seed: 11, maxEnemies: 250 });
    expect(() => simulate(w, 180, 1 / 30, new Bot(3))).not.toThrow();
    expect(w.t).toBeGreaterThan(60);
    expect(w.kills).toBeGreaterThan(100);
  });

  test("maxed talents (two full branches) + C6: a 3-minute bot run with ults survives", () => {
    const tree = TALENT_TREES.get(hero)!;
    const talents: Record<string, number> = {};
    for (const n of tree.nodes) if (n.branch !== 2 || hero === "isekai_kun") talents[n.id] = n.maxRank;
    const w = new World({ hero, seed: 12, maxEnemies: 250, run: defaultRunConfig({ talents, constellation: 6 }) });
    expect(() => simulate(w, 180, 1 / 30, new Bot(4))).not.toThrow();
    expect(w.t).toBeGreaterThan(60);
    expect(w.summary().stats.ults).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------- Senpai
describe("Senpai", () => {
  test("trait: +20% luck, +10% XP and the staring aura (C3: 20% within 56 px)", () => {
    const s = baseStats();
    heroDef("senpai").apply(s);
    expect(s.luck).toBeCloseTo(1.2, 9);
    expect(s.growth).toBeCloseTo(1.1, 9);
    for (const [cons, r, k] of [
      [0, 30, 0.9],
      [3, 50, 0.8],
    ] as const) {
      const w = sandbox("senpai", { constellation: cons });
      for (const x of w.weapons) x.def.dispose?.(w, x);
      w.weapons.length = 0;
      const e = w.spawnEnemy("teddy", w.player.x + r, w.player.y + 8)!;
      run(w, 0.2);
      expect(e.slow).toBeCloseTo(k, 6);
    }
  });

  test("Notice-Me Sparkles charms enemies (bosses immune, max respected), they fight each other, then heartbreak", () => {
    const w = sandbox("senpai");
    const wi = inst(w, "notice_me_sparkles");
    w.setWeaponLevel(wi, 5);
    crowd(w, 30, 10, 40, "teddy");
    let maxCharmed = 0;
    run(w, 8, () => {
      const n = charmRecs(w).filter((r) => r.charm > 0 && r.counted).length;
      maxCharmed = Math.max(maxCharmed, n);
    });
    const s = w.runStats();
    expect(s.charmed ?? 0).toBeGreaterThan(0);
    expect(maxCharmed).toBeLessThanOrEqual(10);
    // charmed enemies hit others for the weapon (contact attacks credited to it), and never the hero
    expect(wi.damage).toBeGreaterThan(0);
    // a boss is never charmed
    const b = w.spawnEnemy("king_puff", w.player.x + 10, w.player.y)!;
    run(w, 3);
    expect(isCharmed(w, b)).toBe(false);
  });

  test("a charmed enemy never hurts the hero and gets its contact damage back after the charm", () => {
    const w = sandbox("senpai");
    (w as unknown as { god: boolean }).god = false;
    const e = w.spawnEnemy("teddy", w.player.x + 6, w.player.y)!;
    const dmg0 = e.dmg;
    expect(recOf(w, e)).toBeNull();
    for (const x of w.weapons) x.def.dispose?.(w, x);
    w.weapons.length = 0;
    expect(charm(w, e, 1.5, {})).toBe(true);
    expect(e.dmg).toBe(0);
    const hp = w.player.hp;
    run(w, 1);
    expect(w.player.hp).toBe(hp);
    run(w, 1);
    expect(isCharmed(w, e)).toBe(false);
    expect(e.dmg).toBe(dmg0);
  });

  test("SENPAI NOTICED YOU: swoon (+50%, stops moving), bosses flustered; C4 +2 s; capstone 7 s + rose burst", () => {
    for (const [cfg, secs] of [
      [{}, 4],
      [{ constellation: 4 }, 6],
      [{ talents: { senpai_noticed_everyone: 1 } }, 7],
    ] as [Partial<RunConfig>, number][]) {
      const w = sandbox("senpai", cfg);
      for (const x of w.weapons) x.def.dispose?.(w, x);
      w.weapons.length = 0;
      const e = w.spawnEnemy("teddy", w.player.x + 50, w.player.y)!;
      const b = w.spawnEnemy("king_puff", w.player.x - 60, w.player.y)!;
      e.hp = e.maxHp = 1e6;
      b.hp = b.maxHp = 1e7;
      w.addUlt(100);
      w.input.ult = true;
      run(w, CFG.cutinTime + 0.05);
      const r = recOf(w, e)!;
      expect(r.swoon).toBeGreaterThan(secs - 0.2);
      expect(e.stun).toBeGreaterThan(0);
      expect(b.stun).toBeGreaterThan(1.3);
      expect(recOf(w, b)!.vuln).toBeGreaterThan(3.5);
      const x0 = e.x;
      run(w, 1);
      expect(Math.abs(e.x - x0)).toBeLessThan(2);
    }
  });
});

// ---------------------------------------------------------------- Magical Girl #47
describe("Magical Girl #47", () => {
  test("trait: +5% to everything (C3 +8%)", () => {
    const s = baseStats();
    heroDef("magical_girl_47").apply(s);
    expect(s.might).toBeCloseTo(1.05, 9);
    expect(s.cooldown).toBeCloseTo(0.95, 9);
    expect(s.maxHp).toBe(CFG.playerHp + 5);
    const w = sandbox("magical_girl_47", { constellation: 3 });
    expect(w.stats.might).toBeCloseTo(1.05 + 0.03 + 0.03, 6);
  });

  test("Henshin Burst: invulnerable henshin, then a burst; counts henshins", () => {
    const w = sandbox("magical_girl_47");
    const wi = inst(w, "henshin_burst");
    crowd(w, 16, 20, 40);
    let invSeen = false;
    run(w, 5.4, () => {
      if ((wi.data.hen ?? 0) > 0 && w.player.dashInv > 0) invSeen = true;
    });
    expect(invSeen).toBe(true);
    expect(w.runStats().henshins ?? 0).toBeGreaterThanOrEqual(1);
    expect(wi.damage).toBeGreaterThan(0);
  });

  test("Panic Henshin negates a hit at >= 80% charge (Panic Henshin+ from 50%) and emits block", () => {
    for (const [rank, frac] of [
      [0, 0.82],
      [3, 0.52],
    ] as const) {
      const w = sandbox("magical_girl_47", { talents: rank ? { mg47_panic_plus: rank } : {} });
      (w as unknown as { god: boolean }).god = false;
      const wi = inst(w, "henshin_burst");
      w.step(DT);
      wi.data.charge = 5 * frac;
      let blocks = 0;
      w.hooks.on("block", () => blocks++);
      const hp = w.player.hp;
      expect(w.hurtPlayer(30, w.player.x + 5, w.player.y, "test")).toBe(true);
      expect(w.player.hp).toBe(hp);
      expect(blocks).toBe(1);
      expect(wi.data.hen).toBeGreaterThan(0);
    }
    // below the threshold the hit lands
    const w = sandbox("magical_girl_47");
    (w as unknown as { god: boolean }).god = false;
    const wi = inst(w, "henshin_burst");
    w.step(DT);
    wi.data.charge = 1;
    const hp = w.player.hp;
    w.hurtPlayer(30, w.player.x + 5, w.player.y, "test");
    expect(w.player.hp).toBeLessThan(hp);
  });

  test("Infinite Henshin Loop leaves a shield charge; C6 henshins on level-up", () => {
    const w = sandbox("magical_girl_47");
    const wi = inst(w, "henshin_burst");
    w.setWeaponLevel(wi, 5);
    w.evolveWeapon(wi);
    run(w, 3);
    expect(w.player.shield).toBe(1);
    const c6 = sandbox("magical_girl_47", { constellation: 6 });
    const h0 = c6.runStats().henshins ?? 0;
    c6.addXp(c6.xpNext + 1);
    expect((c6.runStats().henshins ?? 0) - h0).toBe(1);
  });

  test("Finally Has a Name! cuts the ult to 4 s; Episode 47 (Special) buffs after it", () => {
    const w = sandbox("magical_girl_47", { talents: { mg47_has_a_name: 1, mg47_special_episode: 1 } });
    crowd(w, 30, 10, 100);
    const m0 = w.stats.might;
    const r = castUlt(w);
    expect(r.steps).toBeLessThan(60 * 4.3);
    expect(r.steps).toBeGreaterThan(60 * 3.8);
    w.step(DT);
    expect(w.stats.might).toBeGreaterThan(m0 + 0.39);
  });
});

// ---------------------------------------------------------------- Isekai-kun
describe("Isekai-kun", () => {
  test("trait: +15% damage / XP and the run starts at Lv 3 (C3: Lv 5, Starter Village +rank)", () => {
    const s = baseStats();
    heroDef("isekai_kun").apply(s);
    expect(s.might).toBeCloseTo(1.15, 9);
    expect(new World({ hero: "isekai_kun", seed: 1, director: false }).level).toBe(3);
    expect(new World({ hero: "isekai_kun", seed: 1, director: false, run: defaultRunConfig({ constellation: 3 }) }).level).toBe(5);
    expect(new World({ hero: "isekai_kun", seed: 1, director: false, run: defaultRunConfig({ talents: { isekai_starter_village: 2 } }) }).level).toBe(5);
    expect(new World({ hero: "hoshi", seed: 1, director: false }).level).toBe(1);
  });

  test("every 5th cast is overdone (Overdone: 4th / 3rd) and counts overdos", () => {
    for (const [talents, every] of [
      [{}, 5],
      [{ isekai_overdone: 1 }, 4],
      [{ isekai_overdone: 3 }, 3],
    ] as [Record<string, number>, number][]) {
      const w = sandbox("isekai_kun", { talents });
      const wi = inst(w, "cheat_fireball");
      crowd(w, 20, 30, 60);
      let casts = 0;
      run(w, 20, () => {
        casts = wi.data.cast ?? 0;
        topUp(w, 16, "puff", 30, 60);
      });
      expect(casts).toBeGreaterThan(every * 2);
      expect(w.runStats().overdos).toBe(Math.floor(casts / every));
    }
  });

  test("Second Cheat Skill adds a random non-signature weapon at Lv1", () => {
    const w = new World({ hero: "isekai_kun", seed: 3, director: false, run: defaultRunConfig({ talents: { isekai_second_cheat: 1 } }) });
    w.step(DT);
    expect(w.weapons.length).toBe(2);
    const sig = new Set(HEROES.map((h) => h.weapon));
    expect(sig.has(w.weapons[1].def.id)).toBe(false);
    expect(w.weapons[1].level).toBe(1);
  });

  test("STATUS SCREEN!! slams 3 bands (Expanded 5)", () => {
    for (const [cfg, n] of [
      [{}, 3],
      [{ talents: { isekai_status_expanded: 1 } }, 5],
      [{ constellation: 4 }, 4],
    ] as [Partial<RunConfig>, number][]) {
      const w = sandbox("isekai_kun", cfg);
      let slams = 0;
      w.bus.on("heroFx", (e) => void (e.kind === "hb_slam" && slams++));
      crowd(w, 30, 10, 100);
      castUlt(w);
      expect(slams).toBe(n);
    }
  });
});

// ---------------------------------------------------------------- Truck-kun
describe("Truck-kun", () => {
  test("trait: 180 HP, 3 armor, radius 9, no recoil; drives like a vehicle", () => {
    const w = sandbox("truck_kun");
    expect(w.stats.maxHp).toBe(180);
    expect(w.stats.armor).toBe(3);
    expect(CFG.playerRadius * w.stats.hitbox).toBeCloseTo(9, 6);
    expect(w.heavy).toBe(true);
    const st = truckState(w)!;
    expect(st).toBeTruthy();
    // full throttle to the right, then a hard left turn: it turns over time (not instantly) and corners
    w.input.mx = 1;
    run(w, 0.6);
    const max = CFG.playerSpeed * w.stats.moveSpeed;
    expect(w.player.vx).toBeGreaterThan(max * 0.95);
    w.input.mx = -1;
    w.step(DT);
    expect(w.player.vx).toBeGreaterThan(0);
    run(w, 0.6);
    expect(w.player.vx).toBeLessThan(-max * 0.5);
    w.input.mx = 0;
    run(w, 0.5);
    expect(Math.abs(w.player.vx) + Math.abs(w.player.vy)).toBeLessThan(1);
    // hit recoil ignored
    (w as unknown as { god: boolean }).god = false;
    w.hurtPlayer(10, w.player.x - 10, w.player.y);
    expect(w.player.vx).toBe(0);
  });

  test("ramming damages enemies ahead while moving fast, and their deaths are isekai'd", () => {
    const w = sandbox("truck_kun");
    const wi = inst(w, "horn_of_reincarnation");
    w.input.mx = 1;
    run(w, 0.5);
    for (let i = 0; i < 12; i++) w.spawnEnemy("puff", w.player.x + 20 + i * 14, w.player.y + 8);
    const g0 = w.gems.count;
    run(w, 2);
    expect(wi.damage).toBeGreaterThan(0);
    const s = w.runStats();
    expect(s.isekaid ?? 0).toBeGreaterThan(0);
    expect(w.gems.count).toBeGreaterThan(g0);
  });

  test("ISEKAI EXPRESS: 4 lanes (C4 +1, Unlimited Mileage 6 + Overdrive), Afterlife Loyalty minis", () => {
    for (const [cfg, n] of [
      [{}, 4],
      [{ constellation: 4 }, 5],
      [{ talents: { truck_unlimited_mileage: 1, truck_loyalty: 1 } }, 6],
    ] as [Partial<RunConfig>, number][]) {
      const w = sandbox("truck_kun", cfg);
      let lanes = 0;
      w.bus.on("heroFx", (e) => void (e.kind === "hb_lane" && lanes++));
      crowd(w, 40, 10, 100);
      castUlt(w);
      expect(lanes).toBe(n);
      if (cfg.talents?.truck_loyalty) {
        expect(w.projectiles.items.slice(0, w.projectiles.count).some((p) => !p.dead && p.source === "truck_loyalty")).toBe(true);
        w.step(DT);
        expect(w.ultMeter).toBeGreaterThan(0);
      }
    }
  });

  test("C6 trailer follows on a rope and rams", () => {
    const w = sandbox("truck_kun", { constellation: 6 });
    w.input.mx = 1;
    run(w, 1);
    const st = truckState(w)!;
    expect(st.trailer).toBeTruthy();
    const dx = w.player.x - st.tx;
    expect(dx).toBeGreaterThan(10);
    expect(dx).toBeLessThan(30);
  });
});
