/**
 * Season 2 effects through the gameplay hook toolkit (src/game/hooks.ts):
 * relics (every shipped one, by its hook), talent trees and constellations
 * (Hoshi / Rin / Mochi, docs/content/heroes.md) and Plot Twists
 * (docs/content/stages.md §6). Hooks fire on `world.hooks`, which is never
 * muted: a fast-forwarded run behaves exactly like a watched one.
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import { TALENT_TIER_POINTS } from "../src/game/defs";
import { heroDef, HEROES } from "../src/game/heroes";
import { Buff } from "../src/game/hooks";
import { RELICS, TALENT_TREES, TWISTS, twistHeat } from "../src/game/registry";
import { defaultRunConfig, type RunConfig } from "../src/game/run-config";
import { makeOffer } from "../src/game/upgrades";
import { wstats } from "../src/game/weapons/_shared";
import { World } from "../src/game/world";

const DT = 1 / 30;
const mk = (over: Partial<RunConfig> = {}, hero = "hoshi", director = false) => new World({ hero, seed: 5, director, run: defaultRunConfig(over) });
const steps = (w: World, sec: number) => {
  for (let t = 0; t < sec; t += DT) w.step(DT);
};
/** A ring of puffs around the hero. */
function crowd(w: World, n: number, r = 30, id = "puff"): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    w.spawnEnemy(id, w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r);
  }
}

describe("hook toolkit", () => {
  test("hooks fire while muted (fast-forward) exactly as when watched", () => {
    const count = (muted: boolean) => {
      const w = new World({ hero: "rin", seed: 8, maxEnemies: 250 });
      w.muted = muted;
      let kills = 0;
      let hits = 0;
      let levels = 0;
      w.hooks.on("kill", () => kills++);
      w.hooks.on("hit", () => hits++);
      w.hooks.on("levelUp", () => levels++);
      simulate(w, 60, DT, new Bot(2));
      return [kills, hits, levels, w.kills].join("|");
    };
    expect(count(true)).toBe(count(false));
  });

  test("nested hooks (a kill listener that kills) keep every payload intact", () => {
    // Exorcism's ofuda bursts kill inside the kill hook; the RunStats collector listens after it
    const w = new World({ hero: "rin", seed: 4, maxEnemies: 250, run: defaultRunConfig({ talents: { rin_exorcism: 3 } }) });
    let bursts = 0;
    w.hooks.on("hit", (h) => void (h.source === "rin_exorcism" && bursts++));
    simulate(w, 150, DT, new Bot(2));
    expect(bursts).toBeGreaterThan(0);
    const s = w.summary().stats;
    expect(Object.values(s.killsByEnemy).reduce((a, b) => a + b, 0)).toBe(w.kills);
  });

  test("every(), after() and Buff", () => {
    const w = mk();
    let n = 0;
    let once = 0;
    w.every(1, () => n++);
    w.after(0.5, () => once++);
    const b = new Buff(w);
    w.statMods.push((s) => void (b.on && (s.might += 1)));
    steps(w, 3.05);
    expect(n).toBe(3);
    expect(once).toBe(1);
    const m0 = w.stats.might;
    b.start(1);
    w.step(DT);
    expect(w.stats.might).toBeCloseTo(m0 + 1, 9);
    steps(w, 1.1);
    expect(w.stats.might).toBeCloseTo(m0, 9);
  });
});

describe("relics", () => {
  test("every relic has a valid rarity, icon id, flavour and a desc for every star level", () => {
    expect(RELICS.size).toBeGreaterThanOrEqual(8);
    const rar = new Set([...RELICS.values()].map((r) => r.rarity));
    for (const r of ["N", "R", "SR", "SSR", "UR", "LR", "MYTHIC"]) expect(rar.has(r as never)).toBe(true);
    for (const d of RELICS.values()) {
      expect(d.icon).toMatch(/^icon_/);
      expect(d.flavor.length).toBeGreaterThan(5);
      for (let s = 0; s <= 6; s++) expect(d.desc(s)).not.toMatch(/undefined|NaN/);
      // and installs on a fresh world at every star level
      for (let s = 0; s <= 6; s += 3) expect(() => mk({ relics: [{ id: d.id, stars: s }] })).not.toThrow();
    }
  });

  test("N Slightly Bent Spoon: +3% might at ★0, +9% at ★6", () => {
    expect(mk({ relics: [{ id: "bent_spoon", stars: 0 }] }).stats.might).toBeCloseTo(mk().stats.might + 0.03, 9);
    expect(mk({ relics: [{ id: "bent_spoon", stars: 6 }] }).stats.might).toBeCloseTo(mk().stats.might + 0.09, 9);
  });

  test("R Acrylic Stand (kill): kills drop tiny hearts that heal 3", () => {
    const w = mk({ relics: [{ id: "acrylic_stand", stars: 6 }] });
    for (let k = 0; k < 400; k++) {
      const e = w.spawnEnemy("puff", 200, 200)!;
      w.killEnemy(e, null);
    }
    let hearts = 0;
    for (let i = 0; i < w.pickups.count; i++) if (w.pickups.items[i].kind === "heart") hearts++;
    expect(hearts).toBeGreaterThan(8);
    expect(hearts).toBeLessThan(45);
    // a heart heals 3 when collected
    w.player.hp = 50;
    const k = w.dropPickup("heart", w.player.x, w.player.y, 3);
    k.vx = k.vy = 0;
    k.t = 1;
    w.step(DT);
    w.step(DT);
    expect(w.player.hp).toBeGreaterThanOrEqual(53);
  });

  test("R Rubber Duck (dash): dashing through enemies damages each once per dash", () => {
    const w = mk({ relics: [{ id: "rubber_duck", stars: 0 }] });
    for (let i = 0; i < 4; i++) w.spawnEnemy("teddy", w.player.x + 12 + i * 8, w.player.y);
    w.step(DT);
    w.input.mx = 1;
    let hits = 0;
    w.hooks.on("hit", (h) => void (h.source === "rubber_duck" && hits++));
    w.tryDash();
    steps(w, 0.3);
    expect(hits).toBeGreaterThanOrEqual(3);
    expect(hits).toBeLessThanOrEqual(4);
  });

  test("R Mismatched Chopsticks (pickup): food heals +X%", () => {
    const w = mk({ relics: [{ id: "mismatched_chopsticks", stars: 6 }] });
    w.player.hp = 10;
    const k = w.dropPickup("onigiri", w.player.x, w.player.y);
    k.vx = k.vy = 0;
    k.t = 1;
    k.z = 0;
    w.step(DT);
    expect(w.player.hp).toBeCloseTo(10 + 20 + 20 * 0.5, 0);
  });

  test("R Instant Ramen (every 180 s): heals at 3:00", () => {
    const w = mk({ relics: [{ id: "instant_ramen", stars: 0 }] });
    w.player.hp = 20;
    steps(w, 179);
    const before = w.player.hp;
    steps(w, 1.2);
    expect(w.player.hp - before).toBeCloseTo(w.player.maxHp * 0.2, 0);
  });

  test("SR Light Novel Vol. 1 (levelUp): the first X level-ups offer +1 card", () => {
    const w = mk({ relics: [{ id: "light_novel_vol1", stars: 0 }] });
    expect(w.stats.cards).toBe(CFG.baseCards + 1);
    for (let i = 0; i < 8; i++) {
      w.addXp(w.xpNext + 0.01);
      w.step(DT);
      w.skipLevel();
    }
    expect(w.stats.cards).toBe(CFG.baseCards);
  });

  test("SR Festival Goldfish (every 15 s): heals and slows nearby enemies", () => {
    const w = new World({ hero: "hoshi", seed: 5, director: false, god: true, run: defaultRunConfig({ relics: [{ id: "festival_goldfish", stars: 6 }] }) });
    crowd(w, 6, 30, "teddy");
    // (unkillable for the test: Star Shot keeps firing at them)
    for (let i = 0; i < w.enemies.count; i++) w.enemies.items[i].hp = w.enemies.items[i].maxHp = 1e9;
    w.player.hp = 50;
    steps(w, 15.05);
    expect(w.player.hp).toBeGreaterThanOrEqual(50 + 11 - 1);
    let slowed = 0;
    for (let i = 0; i < w.enemies.count; i++) if (w.enemies.items[i].slow <= 0.5) slowed++;
    expect(slowed).toBeGreaterThan(0);
  });

  test("SSR Protagonist's Scarf (lethal): survives lethal hits; ★6 heals 30% after each save", () => {
    const w = mk({ relics: [{ id: "protagonist_scarf", stars: 6 }] });
    expect(w.plotArmor).toBe(2);
    w.hurtPlayer(9999, 0, 0);
    expect(w.phase).toBe("play");
    expect(w.player.hp).toBe(1);
    w.step(DT);
    expect(w.player.hp).toBeCloseTo(1 + w.player.maxHp * 0.3, 0);
  });

  test("SSR Sentai Team Badge (ult): a 5-colour explosion when Overdrive starts", () => {
    const w = mk({ relics: [{ id: "sentai_badge", stars: 0 }] });
    crowd(w, 10, 26);
    w.step(DT);
    let dmg = 0;
    w.hooks.on("hit", (h) => void (h.source === "sentai_badge" && (dmg += h.dmg)));
    w.addUlt(100);
    w.input.ult = true;
    steps(w, CFG.cutinTime + 0.1);
    expect(dmg).toBeGreaterThan(0);
  });

  test("UR Time-Skip Clock (hurt): below 30% HP everything freezes 3 s and the hero heals 20%", () => {
    const w = mk({ relics: [{ id: "time_skip_clock", stars: 0 }] });
    w.player.hp = 40;
    w.hurtPlayer(20, 0, 0);
    expect(w.freezeT).toBeCloseTo(3, 5);
    expect(w.player.hp).toBeCloseTo(20 + w.player.maxHp * 0.2, 0);
    // cooldown: not again right away
    w.player.iframes = 0;
    w.freezeT = 0;
    w.hurtPlayer(5, 0, 0);
    expect(w.freezeT).toBe(0);
  });

  test("LR Sakuga Animation Cel (every 30 s): SAKUGA MODE -40% cooldown, +20% move speed", () => {
    const w = mk({ relics: [{ id: "sakuga_cel", stars: 0 }] });
    const cd = w.stats.cooldown;
    steps(w, 30.05);
    expect(w.stats.cooldown).toBeCloseTo(Math.max(0.35, cd - 0.4), 6);
    steps(w, 5.1);
    expect(w.stats.cooldown).toBeCloseTo(cd, 6);
  });

  test("MYTHIC Infinite Gacha Credit Card: 6 cards, free rerolls, +X banishes", () => {
    const w = mk({ relics: [{ id: "infinite_credit_card", stars: 4 }] });
    expect(w.stats.cards).toBe(6);
    expect(w.rerollsLeft).toBe(Infinity);
    expect(w.banishes).toBe(4);
    w.addXp(w.xpNext + 0.01);
    expect(w.offer().length).toBe(6);
    for (let i = 0; i < 5; i++) expect(w.reroll()?.length).toBe(6);
  });
});

describe("talent trees", () => {
  test("Hoshi, Rin and Mochi: 3 branches x 5 tiers (5/3/3/3/1 ranks), unique ids, every desc renders", () => {
    const all = new Set<string>();
    for (const hero of ["hoshi", "rin", "mochi"]) {
      const t = TALENT_TREES.get(hero)!;
      expect(t.branches.length).toBe(3);
      expect(t.nodes.length).toBe(15);
      for (let b = 0; b < 3; b++) {
        const ranks = t.nodes.filter((n) => n.branch === b).sort((x, y) => x.tier - y.tier).map((n) => n.maxRank);
        expect(ranks).toEqual([5, 3, 3, 3, 1]);
      }
      // a capstone needs its whole branch (meta rule)
      expect(TALENT_TIER_POINTS[4]).toBe(14);
      for (const n of t.nodes) {
        expect(n.id.startsWith(`${hero}_`)).toBe(true);
        expect(all.has(n.id)).toBe(false);
        all.add(n.id);
        for (let r = 1; r <= n.maxRank; r++) expect(n.desc(r)).not.toMatch(/undefined|NaN/);
      }
    }
  });

  test("every node installs, and a fully talented run plays (each hero)", () => {
    for (const hero of ["hoshi", "rin", "mochi"]) {
      const talents: Record<string, number> = {};
      for (const n of TALENT_TREES.get(hero)!.nodes) talents[n.id] = n.maxRank;
      const w = new World({ hero, seed: 3, maxEnemies: 200, run: defaultRunConfig({ talents, constellation: 6 }) });
      simulate(w, 120, DT, new Bot(4));
      expect(w.t).toBeGreaterThan(60);
      expect(w.kills).toBeGreaterThan(200);
    }
  });

  test("stat nodes: Choreography 5 = +20% projectile speed, Convenient Shield = 1 charge / 20 s", () => {
    const w = mk({ talents: { hoshi_choreography: 5, hoshi_convenient_shield: 3 } });
    expect(w.stats.projSpeed).toBeCloseTo(heroDefProj() + 0.2, 9);
    expect(w.stats.shield).toBe(1);
    expect(w.stats.shieldCd).toBe(20);
    expect(w.player.shield).toBe(1);
    // the shield eats a whole hit, then recharges
    const hp = w.player.hp;
    expect(w.hurtPlayer(30, 0, 0)).toBe(true);
    expect(w.player.hp).toBe(hp);
    expect(w.player.shield).toBe(0);
    steps(w, 20.1);
    expect(w.player.shield).toBe(1);
  });

  test("Hoshi: Fan Chant (+damage, pierce at rank 3) and Backup Dancers (+1 star per rank) reach Star Shot", () => {
    const w = mk({ talents: { hoshi_fan_chant: 3, hoshi_backup_dancers: 2 } }, "hoshi", false);
    const inst = w.hasWeapon("star_shot")!;
    expect(inst.dmgMul).toBeCloseTo(1.18, 9);
    crowd(w, 12, 60);
    let stars = 0;
    let pierce = 0;
    // one volley (the first fires 0.25 s in, the next one cd later)
    for (let s = 0; s < 22; s++) {
      w.step(DT);
      for (let i = 0; i < w.projectiles.count; i++) {
        const p = w.projectiles.items[i];
        if (p.source === "star_shot" && p.age <= DT + 1e-9) {
          stars++;
          pierce = p.pierce;
        }
      }
    }
    expect(stars).toBe(inst.def.levels[0].amount + 2);
    expect(pierce).toBe(inst.def.levels[0].pierce! + 1);
  });

  test("Hoshi ENCORE!: 15 heart meteors 1.5 s after Supernova Shower", () => {
    const w = mk({ talents: { hoshi_encore: 1 } });
    let encore = 0;
    w.bus.on("ultEncore", () => encore++);
    w.addUlt(100);
    w.input.ult = true;
    // the shower ends 3.7 s after the cut-in; the encore lands 1.5 s later
    steps(w, CFG.cutinTime + 3.7 + 1.35);
    let before = 0;
    for (let i = 0; i < w.projectiles.count; i++) if (w.projectiles.items[i].source === "supernova_shower") before++;
    expect(encore).toBe(0);
    steps(w, 0.2);
    let meteors = 0;
    for (let i = 0; i < w.projectiles.count; i++) if (w.projectiles.items[i].source === "supernova_shower") meteors++;
    expect(encore).toBe(1);
    expect(meteors - before).toBe(15);
  });

  test("Hoshi Guardian Stars block enemy bullets", () => {
    const w = mk({ talents: { hoshi_guardian_stars: 1 } });
    w.step(DT);
    let orbiters = 0;
    for (let i = 0; i < w.projectiles.count; i++) if (w.projectiles.items[i].source === "hoshi_guardian_stars") orbiters++;
    expect(orbiters).toBe(2);
    // a ring of slow bullets around the hero passes through the orbit
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      w.spawnBullet(w.player.x + Math.cos(a) * 34, w.player.y - 8 + Math.sin(a) * 34 * 0.85, -Math.cos(a) * 25, -Math.sin(a) * 25, 5);
    }
    const hp = w.player.hp;
    steps(w, 1.5);
    expect(w.bullets.count).toBeLessThan(24);
    expect(w.player.hp).toBeGreaterThanOrEqual(hp - 15);
  });

  test("Rin: Wide Stance / Petal Storm / Crescent Moon Draw shape Petal Slash; Execution kills the weak", () => {
    const w = mk({ talents: { rin_wide_stance: 3, rin_petal_storm: 2, rin_crescent_draw: 1, rin_execution: 3 } }, "rin");
    crowd(w, 8, 40);
    let petals = 0;
    let moons = 0;
    for (let s = 0; s < 150; s++) {
      w.step(DT);
      for (let i = 0; i < w.projectiles.count; i++) {
        const p = w.projectiles.items[i];
        if (p.age > DT + 1e-9) continue;
        if (p.sprite === "ult_petal") petals++;
        if (p.sprite === "w_tempest") moons++;
      }
    }
    expect(petals).toBeGreaterThanOrEqual(4);
    expect(moons).toBeGreaterThanOrEqual(1);
    // Execution: a slashed enemy under 20% HP dies outright
    const tough = w.spawnEnemy("teddy", w.player.x + 18, w.player.y)!;
    tough.hp = tough.maxHp * 0.19;
    w.hitEnemy(tough, 1, w.hasWeapon("petal_slash")!, 0, 0, 0, "petal_slash", 0xffffff);
    expect(tough.dead).toBe(true);
  });

  test("Rin Ten Thousand Blossoms: 24 slash lines and a second burst", () => {
    const w = mk({ talents: { rin_ten_thousand: 1 } }, "rin");
    let slashes = 0;
    let bursts = 0;
    w.bus.on("ultSlash", () => slashes++);
    w.bus.on("ultBurst", () => bursts++);
    w.addUlt(100);
    w.input.ult = true;
    steps(w, CFG.cutinTime + 3);
    expect(slashes).toBe(24);
    expect(bursts).toBe(2);
  });

  test("Mochi: Ninth Life survives a lethal hit; Infinite Yarn never turns off (+2 balls); Cat Army = 90 cats", () => {
    const w = mk({ talents: { mochi_ninth_life: 3, mochi_infinite_yarn: 1, mochi_cat_army: 1 } }, "mochi");
    expect(w.plotArmor).toBe(1);
    expect(w.plotArmorIframes).toBe(2);
    steps(w, 0.5);
    const inst = w.hasWeapon("yarn_orbit")!;
    const want = Math.min(12, wstats(w, inst).amount + 2);
    expect(inst.projs.length).toBe(want);
    expect(inst.projs.every((p) => p.life === Infinity)).toBe(true);
    steps(w, 6);
    expect(inst.projs.length).toBe(want);
    let cats = 0;
    w.addUlt(100);
    w.input.ult = true;
    for (let s = 0; s < (CFG.cutinTime + 4) / DT; s++) {
      w.step(DT);
      for (let i = 0; i < w.projectiles.count; i++) {
        const p = w.projectiles.items[i];
        if (p.sprite === "ult_cat" && p.age <= DT + 1e-9) cats++;
      }
    }
    // 5 waves x 2 rows x ceil(90 / 10)
    expect(cats).toBe(90);
  });

  test("weapon/ult talents are inert for a hero that doesn't own that weapon / ult", () => {
    const w = mk({ talents: { rin_petal_storm: 3, hoshi_backup_dancers: 3 } }, "mochi");
    expect(() => simulate(w, 20, DT, new Bot(1))).not.toThrow();
  });
});

function heroDefProj(): number {
  const s = { projSpeed: 1, cooldown: 1 } as never as import("../src/game/stats").Stats;
  heroDef("hoshi").apply(s);
  return s.projSpeed;
}

describe("constellations", () => {
  test("C1..C6 per hero: shared names, C2 = start weapon at Lv2", () => {
    for (const h of HEROES) {
      const cons = h.constellations!;
      expect(cons.length).toBe(6);
      expect(cons[0].name).toBe("Recolour Edition");
      expect(cons[5].name).toBe("Fully Awakened (Final Form)");
      expect(mk({ constellation: 2 }, h.id).hasWeapon(h.weapon)?.level).toBe(2);
      expect(mk({ constellation: 1 }, h.id).hasWeapon(h.weapon)?.level).toBe(1);
    }
  });

  test("Hoshi C4 +10 meteors, C6 Overdrive starts at 60%; Rin C6 first cut always crits; Mochi C5 +1 dash charge", () => {
    expect(mk({ constellation: 6 }).ultMeter).toBe(60);
    const h = mk({ constellation: 4 });
    let meteors = 0;
    h.addUlt(100);
    h.input.ult = true;
    for (let i = 0; i < (CFG.cutinTime + 3.5) / DT; i++) {
      h.step(DT);
      for (let k = 0; k < h.projectiles.count; k++) if (h.projectiles.items[k].source === "supernova_shower" && h.projectiles.items[k].age <= DT + 1e-9) meteors++;
    }
    expect(meteors).toBe(40);
    const r = mk({ constellation: 6 }, "rin");
    const e = r.spawnEnemy("teddy", r.player.x + 20, r.player.y)!;
    let crit = false;
    r.hooks.on("hit", (x) => void (crit = x.crit));
    r.hitEnemy(e, 1, null, 0, 0, -1, "petal_slash", 0xffffff);
    expect(crit).toBe(true);
    expect(mk({ constellation: 5 }, "mochi").player.dashChargesMax).toBe(2);
  });
});

describe("Plot Twists", () => {
  test("15 twists from the content bible; heat per rank sums to 41 at max", () => {
    expect(TWISTS.size).toBe(15);
    const ranks: Record<string, number> = {};
    for (const d of TWISTS.values()) {
      ranks[d.id] = d.maxRank;
      expect(d.heat.length).toBe(d.maxRank);
      for (let r = 1; r <= d.maxRank; r++) expect(d.desc(r)).not.toMatch(/undefined|NaN/);
    }
    expect(twistHeat([...TWISTS.keys()], ranks)).toBe(41);
    expect(twistHeat(["budget_cuts"], { budget_cuts: 2 })).toBe(2);
    const w = mk({ twists: ["budget_cuts", "spoilers"], twistRanks: { budget_cuts: 3 } });
    expect(w.heat).toBe(4);
    expect(w.summary().stats.heat).toBe(4);
    expect(w.summary().stats.twists).toEqual(["budget_cuts", "spoilers"]);
  });

  const tw = (id: string, rank = 1, hero = "hoshi") => mk({ twists: [id], twistRanks: { [id]: rank } }, hero);

  test("difficulty multipliers", () => {
    expect(tw("budget_cuts", 3).difficulty.enemyHp).toBeCloseTo(1.75, 9);
    const fo = tw("filler_overload", 2).difficulty;
    expect(fo.spawn).toBeCloseTo(1.6, 9);
    expect(fo.cap).toBeCloseTo(1.2, 9);
    expect(tw("rushed_production", 2).difficulty.bulletSpeed).toBeCloseTo(1.6, 9);
    expect(tw("dub_version", 2).difficulty.enemySpeed).toBeCloseTo(1.3, 9);
    const de = tw("darker_and_edgier", 3);
    expect(de.difficulty.enemyDmg).toBeCloseTo(1.6, 9);
    expect(de.look.darken).toBeCloseTo(0.15, 9);
    expect(tw("darker_and_edgier", 2).look.darken).toBe(0);
    const pc = tw("power_creep", 2).difficulty;
    expect(pc.elite).toBe(3);
    expect(pc.eliteHp).toBeCloseTo(1.5, 9);
    expect(tw("studio_change").look.eliteOutlineOnHit).toBe(true);
    expect(tw("simulcast_delay", 2).stats.ultGain).toBeCloseTo(0.5, 9);
    expect(tw("cliffhanger", 2).stats.maxHp).toBe(Math.round(mk().stats.maxHp * 0.6));
    // and they bite in the sim
    const base = mk();
    const hard = tw("budget_cuts", 2);
    // (both HP values are rounded: within 1 of x1.5)
    expect(Math.abs(hard.spawnEnemy("puff", 0, 0)!.maxHp - base.spawnEnemy("puff", 0, 0)!.maxHp * 1.5)).toBeLessThanOrEqual(1);
    const fast = tw("rushed_production", 1);
    const b = fast.spawnBullet(0, 0, 100, 0, 10);
    expect(b.vx).toBeCloseTo(130, 6);
  });

  test("Censored: no food (coins with a CENSORED bar instead); rank 2 also cancels the level-up heal", () => {
    const w = tw("censored", 2);
    w.player.hp = 10;
    for (let i = 0; i < 80; i++) {
      const e = w.spawnEnemy("prop_lantern", 100, 100)!;
      w.killEnemy(e, null);
    }
    let food = 0;
    let censored = 0;
    for (let i = 0; i < w.pickups.count; i++) {
      const k = w.pickups.items[i];
      if (k.kind === "onigiri" || k.kind === "cake") food++;
      if (k.censored) censored++;
    }
    expect(food).toBe(0);
    expect(censored).toBeGreaterThan(0);
    const hp = w.player.hp;
    w.addXp(w.xpNext + 0.01);
    expect(w.player.hp).toBe(hp);
  });

  test("Spoilers: bosses arrive with no WARNING and no spawn pause", () => {
    const w = new World({ hero: "hoshi", seed: 2, god: true, run: defaultRunConfig({ twists: ["spoilers"] }) });
    let warnings = 0;
    let spawnAt = -1;
    w.bus.on("bossWarning", () => warnings++);
    w.bus.on("bossSpawn", () => void (spawnAt = w.t));
    simulate(w, 182, DT, new Bot(1));
    expect(warnings).toBe(0);
    expect(spawnAt).toBeGreaterThan(179.9);
    expect(spawnAt).toBeLessThan(180.2);
    expect(w.director.introT).toBe(0);
  });

  test("Mid-Season Break: no rerolls (rank 2: no banishes / skips either)", () => {
    const w = mk({ twists: ["mid_season_break"], twistRanks: { mid_season_break: 2 }, flags: { banish: 3, skip: 3 } });
    w.addXp(w.xpNext + 0.01);
    expect(w.rerollsLeft).toBe(0);
    expect(w.reroll()).toBeNull();
    expect(w.banishes).toBe(0);
    expect(w.skips).toBe(0);
  });

  test("Light Novel Title: one card fewer (min 2) with very long titles", () => {
    const w = tw("light_novel_title");
    expect(w.stats.cards).toBe(CFG.baseCards - 1);
    const offer = makeOffer(w, w.stats.cards);
    expect(offer.length).toBe(2);
    expect(offer.some((c) => c.name.length > 40 && c.name.includes(": "))).toBe(true);
  });

  test("Shounen Rival: a red re-skinned rival of another hero hunts you and drops a chest", () => {
    const w = new World({ hero: "hoshi", seed: 3, god: true, run: defaultRunConfig({ twists: ["shounen_rival"], twistRanks: { shounen_rival: 3 } }) });
    let rival: { skin: string; id: string } | null = null;
    simulate(w, 41, DT, new Bot(1), (ww) => {
      for (let i = 0; i < ww.enemies.count; i++) {
        const e = ww.enemies.items[i];
        if (!e.dead && e.def.id === "rival_recolour") rival = { skin: e.skin, id: e.def.id };
      }
    });
    expect(rival).not.toBeNull();
    // another hero's run sprite (any of the roster but the one playing)
    expect(HEROES.filter((h) => h.id !== "hoshi").map((h) => `${h.sprite}_run`)).toContain(rival!.skin);
    let chests = 0;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i];
      if (!e.dead && e.def.id === "rival_recolour") {
        w.killEnemy(e, null);
      }
    }
    for (let i = 0; i < w.pickups.count; i++) if (w.pickups.items[i].kind === "chest") chests++;
    expect(chests).toBeGreaterThanOrEqual(1);
  });

  test("Sequel Hook: the final boss gets back up once at 40% HP (rank 2: every boss)", () => {
    const w = tw("sequel_hook", 1);
    w.player.x = 0;
    const lady = w.spawnEnemy("lady_lunatic", 0, -60)!;
    const king = w.spawnEnemy("king_puff", 60, -60)!;
    // (bosses enter invulnerable)
    lady.inv = king.inv = 0;
    let phases = 0;
    w.bus.on("bossPhase", (e) => void (e.title === "IT'S NOT OVER!" && phases++));
    expect(w.hitEnemy(lady, lady.hp * 2, null, 0, 0, 0, "test", 0)).toBe(false);
    expect(lady.dead).toBe(false);
    expect(lady.hp).toBe(Math.round(lady.maxHp * 0.4));
    expect(lady.inv).toBe(3);
    lady.inv = 0;
    // a mid boss stays down at rank 1 (before Lady's dawn sweeps the screen)
    expect(w.hitEnemy(king, king.hp * 2, null, 0, 0, 0, "test", 0)).toBe(true);
    expect(w.hitEnemy(lady, lady.hp * 2, null, 0, 0, 0, "test", 0)).toBe(true);
    expect(phases).toBe(1);
    const all = tw("sequel_hook", 2);
    const k2 = all.spawnEnemy("king_puff", 0, -60)!;
    k2.inv = 0;
    expect(all.hitEnemy(k2, k2.hp * 2, null, 0, 0, 0, "test", 0)).toBe(false);
  });

  test("every twist at max rank: a run still plays to a clean end", () => {
    const ranks: Record<string, number> = {};
    for (const d of TWISTS.values()) ranks[d.id] = d.maxRank;
    const w = new World({ hero: "rin", seed: 9, run: defaultRunConfig({ twists: Object.keys(ranks), twistRanks: ranks }) });
    simulate(w, 300, DT, new Bot(5));
    expect(w.heat).toBe(41);
    expect(["dead", "play"]).toContain(w.phase);
  });
});
