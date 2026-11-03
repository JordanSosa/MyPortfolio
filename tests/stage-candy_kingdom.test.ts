/**
 * Stage 2 - Candy Kingdom (docs/content/stages.md §1, enemies.md §1 + §5.1-5.2):
 * the stage registers with the bible's numbers, its timeline spawns the whole
 * roster (props and the new laneCharge / bulletRain events included), every
 * enemy twist works, both bosses cycle every phase headless and die, the
 * Sugar Plum Tyrant's death clears the stage (victory, or the Filler Arc when
 * endless), and full bot runs finish without exceptions.
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import { BOSSES, ENEMIES, STAGES, stageInfos } from "../src/game/registry";
import { defaultRunConfig } from "../src/game/run-config";
import { stageBosses, stageEnemies } from "../src/game/stage";
import { PK_FREE, type Enemy } from "../src/game/types";
import { World } from "../src/game/world";
import { SHIELD_MUL, TOAST_TAKEN, candyState } from "../src/game/enemies/_candy";
import { GUMMY_ST_BOING, GUMMY_ST_KNOCKED } from "../src/game/enemies/gummy-bear";
import { DONUT_ROLLING, DONUT_SPINNING } from "../src/game/enemies/donut-roller";
import { GG_BUTTONS, GG_CUT, GG_CUTTER, GG_FLOURISH, GG_HOP, GG_JUMP, GG_LAND, GG_STOMP, golemState } from "../src/game/bosses/gingerbread-golem";
import { CRASH_TAKEN, SP_COAT, SP_CRASH, SP_DECREE, SP_HIGH, SP_JETE, SP_SPIRAL, SP_TELE, tyrantState } from "../src/game/bosses/sugar-plum-tyrant";

const DT = 1 / 30;
const ROSTER = ["gummy_bear", "candy_corn", "donut_roller", "lollipop_mage", "marshmallow_brute"];

/** A quiet sandbox on the Candy Kingdom: no director, no weapons. */
function sandbox(god = true, seed = 7): World {
  const w = new World({ hero: "hoshi", seed, director: false, god, run: defaultRunConfig({ stage: "candy_kingdom" }) });
  for (const inst of w.weapons) inst.def.dispose?.(w, inst);
  w.weapons.length = 0;
  return w;
}

/** Run `fn` with the damage roll's variance off (exact damage ratios). */
function exact(fn: () => void): void {
  const cfg = CFG as unknown as { damageVariance: number };
  const v = cfg.damageVariance;
  cfg.damageVariance = 0;
  try {
    fn();
  } finally {
    cfg.damageVariance = v;
  }
}

function count(w: World, id: string): number {
  let n = 0;
  for (let i = 0; i < w.enemies.count; i++) if (!w.enemies.items[i].dead && w.enemies.items[i].def.id === id) n++;
  return n;
}

function step(w: World, sec: number, each?: () => void): void {
  for (let i = 0; i < sec / DT; i++) {
    w.step(DT);
    each?.();
  }
}

describe("candy kingdom: stage", () => {
  test("registers with the bible's numbers", () => {
    const st = STAGES.get("candy_kingdom")!;
    expect(st).toBeDefined();
    expect(st.order).toBe(2);
    expect(st.duration).toBe(720);
    expect(st.rewardMul).toBe(1.25);
    expect(st.requires).toBe("dream_meadow");
    expect(st.bpm).toBe(150);
    expect(st.finalBoss).toBe("sugar_plum_tyrant");
    expect(st.enrageAt).toBe(750);
    expect(st.music).toEqual({ battle: "candy", boss: "boss_candy", final: "boss_candy" });
    expect(st.victory.title).toBe("SUGAR CRASH!");
    expect(stageBosses(st)).toEqual(["gingerbread_golem", "sugar_plum_tyrant"]);
    expect(stageEnemies(st).sort()).toEqual([...ROSTER].sort());
    expect(st.phases.length).toBe(9);
    expect(st.events.filter((e) => e.kind === "elite").length).toBe(7);
    for (const id of ROSTER) expect(ENEMIES.get(id), id).toBeDefined();
    for (const id of stageBosses(st)) expect(BOSSES.get(id)?.boss, id).toBeDefined();
    const info = stageInfos().find((s) => s.id === "candy_kingdom")!;
    expect(info.bosses).toEqual(["gingerbread_golem", "sugar_plum_tyrant"]);
    expect(info.rewardMul).toBe(1.25);
  });

  test("its timeline spawns the whole roster, its props and the new event kinds", () => {
    const w = new World({ hero: "rin", seed: 4, maxEnemies: 250, god: true, run: defaultRunConfig({ stage: "candy_kingdom" }) });
    const seen = new Set<string>();
    const waves = new Set<string>();
    w.bus.on("waveIncoming", (e) => waves.add(e.label ?? e.kind));
    let rainBullets = 0;
    let laneTeles = 0;
    w.bus.on("telegraph", (e) => {
      if (e.r === 10) laneTeles++;
    });
    simulate(w, 610, DT, new Bot(3), (ww) => {
      for (let i = 0; i < ww.enemies.count; i++) seen.add(ww.enemies.items[i].def.id);
      for (let i = 0; i < ww.bullets.count; i++) if (ww.bullets.items[i].sprite === "eb_candy" && ww.bullets.items[i].vx === 0) rainBullets++;
      // keep the run going past the golem
      const b = ww.boss;
      if (b && !b.dead && b.t > 20) ww.hitEnemy(b, b.maxHp * 0.01, null, 0, 0, 0, "test", 0xffffff);
    });
    for (const id of ROSTER) expect(seen.has(id), id).toBe(true);
    expect(seen.has("prop_candy_jar") || seen.has("prop_pinata")).toBe(true);
    expect(seen.has("gingerbread_golem")).toBe(true);
    expect([...waves]).toEqual(expect.arrayContaining(["PHALANX!", "ROLLING DONUTS!", "GUMMY AVALANCHE!", "SPRINKLE STORM!", "MARSHMALLOW WALL!"]));
    expect(laneTeles).toBeGreaterThanOrEqual(3); // ROLLING DONUTS! lanes (half width 10)
    expect(rainBullets).toBeGreaterThan(0); // SPRINKLE STORM! falls straight down
  });

  test("dream meadow never sees the candy props", () => {
    const w = new World({ hero: "hoshi", seed: 2, god: true });
    const seen = new Set<string>();
    simulate(w, 120, DT, new Bot(1), (ww) => {
      for (let i = 0; i < ww.enemies.count; i++) if (ww.enemies.items[i].def.prop) seen.add(ww.enemies.items[i].def.id);
    });
    expect([...seen].every((id) => id === "prop_lantern" || id === "prop_gift")).toBe(true);
  });
});

describe("candy kingdom: enemies", () => {
  test("gummy bear: halved knockback, then a boing back toward the player", () => {
    const w = sandbox();
    const g = w.spawnEnemy("gummy_bear", 60, 0)!;
    expect(g.b).toBeGreaterThanOrEqual(0);
    expect(g.b).toBeLessThan(4);
    step(w, 0.2);
    w.hitEnemy(g, 1, null, 0, 160, 0, "test", 0xffffff); // knocked away (+x)
    expect(g.kx).toBeCloseTo(80, 0); // knockback halved (knockResist 0.5)
    let boing = false;
    let knocked = false;
    step(w, 0.8, () => {
      if (g.state === GUMMY_ST_KNOCKED) knocked = true;
      if (g.state === GUMMY_ST_BOING) {
        boing = true;
        expect(g.def.frame!(g)).toBe(3);
        if (g.timer < 0.05) expect(g.kx).toBeLessThan(0); // springs back toward the player (at x 0)
      }
    });
    expect(knocked && boing).toBe(true);
  });

  test("king-size gummy splits into 3", () => {
    const w = sandbox();
    const g = w.spawnEnemy("gummy_bear", 60, 0, true)!;
    w.killEnemy(g, null);
    expect(count(w, "gummy_bear")).toBe(3);
  });

  test("candy corn shield wall: front-half projectile hits in formation deal 40 % less", () => exact(() => {
    const w = sandbox();
    // a squad marching left toward the player at x 0
    const a = w.spawnEnemy("candy_corn", 80, 0)!;
    w.spawnEnemy("candy_corn", 80, 12);
    w.spawnEnemy("candy_corn", 80, -12);
    step(w, 0.1);
    const lone = w.spawnEnemy("candy_corn", 80, 200)!;
    step(w, 0.05);
    const hitFrom = (e: Enemy, side: number): number => {
      const p = w.spawnProjectile(null, "test");
      p.kind = PK_FREE;
      p.x = e.x + side * 4;
      p.y = e.y - e.cy;
      const before = e.hp;
      w.hitProj = p;
      w.hitEnemy(e, 10, null, 0, 0, -10, "test", 0xffffff); // critBonus -10: no crit
      w.hitProj = null;
      p.dead = true;
      return before - e.hp;
    };
    const front = hitFrom(a, -1); // the side facing the player
    const back = hitFrom(a, 1);
    const alone = hitFrom(lone, -1);
    expect(front / back).toBeCloseTo(SHIELD_MUL, 1);
    expect(alone).toBeGreaterThan(front);
    // explosions are never blocked
    const hp0 = a.hp;
    w.explode(a.x - 2, a.y - a.cy, 4, 10, null, 0, "test", 0xffffff);
    expect(hp0 - a.hp).toBe(back);
  }));

  test("corn-mander rallies the squad 20 % faster", () => {
    const w = sandbox();
    w.spawnEnemy("candy_corn", 100, 0, true);
    const s = w.spawnEnemy("candy_corn", 110, 20)!;
    step(w, 0.5);
    expect(s.c).toBeGreaterThan(w.t);
  });

  test("donut roller: spin telegraph, a 165 px/s roll and one planned ricochet off the view edge", () => {
    const w = sandbox();
    // the player 40 px to its left: the roll heads left and meets the view edge after ~142 px
    const d = w.spawnEnemy("donut_roller", 0, 0)!;
    w.player.x = -50;
    w.player.y = 0;
    d.timer = 0;
    let planned = 0;
    let spun = false;
    let rolled = false;
    let flipped = false;
    let lanes = 0;
    w.bus.on("telegraph", () => lanes++);
    step(w, 2.2, () => {
      if (d.state === DONUT_SPINNING) {
        spun = true;
        if (!planned) planned = d.b;
      }
      if (d.state === DONUT_ROLLING && d.timer > 0.05) {
        rolled = true;
        expect(Math.hypot(d.vx, d.vy)).toBeCloseTo(165, 0);
        if (d.c > 0) flipped = true;
      }
    });
    expect(spun && rolled).toBe(true);
    expect(planned).toBeGreaterThan(100); // bounce on the x wall, ~142 px in
    expect(flipped).toBe(true); // ...and it really came back
    expect(lanes).toBeGreaterThanOrEqual(4); // both segments at the spin, again for the roll itself
  });

  test("donut rolls never start point-blank", () => {
    const w = sandbox();
    const d = w.spawnEnemy("donut_roller", 20, 0)!;
    d.timer = 0;
    d.speed = 0.001;
    step(w, 1, () => expect(d.state).not.toBe(DONUT_SPINNING));
  });

  test("marshmallow brute: fire or explosions toast it for life (+30 % speed, +50 % damage taken)", () => exact(() => {
    const w = sandbox();
    const m = w.spawnEnemy("marshmallow_brute", 60, 0)!;
    step(w, DT); // (explosions find enemies through the spatial grid, rebuilt every step)
    const sp = m.speed;
    const h1 = m.hp;
    w.hitEnemy(m, 10, null, 0, 0, -10, "star_shot", 0xffffff);
    const plain = h1 - m.hp;
    expect(m.c).toBe(0);
    w.explode(m.x, m.y - m.cy, 6, 1, null, 0, "candy_bomb", 0xffffff);
    expect(m.c).toBe(1);
    expect(m.speed).toBeCloseTo(sp * 1.3, 5);
    const h2 = m.hp;
    w.hitEnemy(m, 10, null, 0, 0, -10, "star_shot", 0xffffff);
    expect((h2 - m.hp) / plain).toBeCloseTo(TOAST_TAKEN, 1);
    const m2 = w.spawnEnemy("marshmallow_brute", -60, 0)!;
    w.hitEnemy(m2, 1, null, 0, 0, -10, "dark_flame_dragon", 0xffffff);
    expect(m2.c).toBe(1);
  }));

  test("s'more supreme leaves a chocolate puddle that slows enemies, not the player", () => {
    const w = sandbox();
    const m = w.spawnEnemy("marshmallow_brute", 40, 0, true)!;
    const x = m.x;
    w.killEnemy(m, null);
    const st = candyState(w)!;
    expect(Array.from(st.pt).some((t) => t > 0)).toBe(true);
    const g = w.spawnEnemy("gummy_bear", x, 0)!;
    step(w, 0.2);
    expect(g.slow).toBeLessThan(1);
  });

  test("lollipop mage: curving candies, and every 3rd cast heals nearby candy", () => {
    const w = sandbox();
    const m = w.spawnEnemy("lollipop_mage", 90, 0)!;
    m.b = 0;
    const g = w.spawnEnemy("gummy_bear", 100, 10)!;
    g.speed = 0.001;
    g.hp = g.maxHp * 0.3;
    let curving = false;
    let healed = false;
    const hp0 = g.hp;
    step(w, 14, () => {
      for (let i = 0; i < w.bullets.count; i++) if (w.bullets.items[i].sprite === "eb_candy" && w.bullets.items[i].turn !== 0) curving = true;
      if (g.hp > hp0) healed = true;
      g.x = m.x + 10;
      g.y = m.y + 10;
    });
    expect(curving).toBe(true);
    expect(healed).toBe(true);
  });
});

/** Spawn a boss into a sandbox (on screen, above the player) and track the states it visits. */
function bossRun(id: string, seed = 5): { w: World; e: Enemy; states: Set<number> } {
  const w = sandbox(true, seed);
  const e = w.spawnEnemy(id, 0, -70)!;
  w.boss = e;
  return { w, e, states: new Set<number>() };
}

describe("candy kingdom: bosses", () => {
  test("gingerbread golem cycles every pattern in both phases and dies", () => {
    const { w, e, states } = bossRun("gingerbread_golem");
    let cutHits = 0;
    w.bus.on("stageCue", (c) => {
      if (c.kind === "candy_cut") cutHits++;
    });
    let gummies = 0;
    step(w, 26, () => states.add(e.state));
    for (const s of [GG_STOMP, GG_JUMP, GG_LAND, GG_BUTTONS, GG_CUTTER, GG_CUT]) expect(states.has(s), `p1 state ${s}`).toBe(true);
    expect(golemState(e)!.phase).toBe(1);
    expect(cutHits).toBeGreaterThan(0);
    e.hp = e.maxHp * 0.45;
    states.clear();
    step(w, 30, () => {
      states.add(e.state);
      gummies = Math.max(gummies, count(w, "gummy_bear"));
    });
    expect(golemState(e)!.phase).toBe(2);
    for (const s of [GG_FLOURISH, GG_HOP, GG_JUMP, GG_LAND, GG_BUTTONS, GG_CUTTER]) expect(states.has(s), `p2 state ${s}`).toBe(true);
    expect(gummies).toBeGreaterThanOrEqual(8); // each Cookie Cutter brings 8 Gummy Bears
    expect(e.def.frame!(e)).toBeGreaterThanOrEqual(0);
    w.hitEnemy(e, e.maxHp * 3, null, 0, 0, 0, "test", 0xffffff);
    expect(e.dead).toBe(true);
    expect(w.phase).toBe("play"); // a mid boss: the run goes on
  });

  test("cookie cutter: 40 damage inside the outline, nothing in the gaps", () => {
    const { w, e } = bossRun("gingerbread_golem");
    const s = golemState(e)!;
    const mortal = (on: boolean): void => {
      (w as unknown as { god: boolean }).god = !on;
    };
    const results: number[] = [];
    let place: [number, number] = [22, -26]; // between the head and the right arm
    step(w, 60, () => {
      if (e.state === GG_CUTTER && e.timer < 0.05 && results.length < 2) {
        w.clearBullets();
        mortal(true);
        w.player.x = s.cutX + place[0];
        w.player.y = s.cutY + place[1];
        w.player.iframes = 0;
        w.player.hp = w.player.maxHp;
      }
      if (e.state === GG_CUTTER) {
        w.player.x = s.cutX + place[0];
        w.player.y = s.cutY + place[1];
        w.clearBullets();
      }
      if (e.state === GG_CUT && e.timer < 0.05 && results.length < 2 && !(w as unknown as { god: boolean }).god) {
        results.push(w.player.maxHp - w.player.hp);
        mortal(false);
        place = [0, 0]; // the next one: dead centre of the body
      }
    });
    expect(results.length).toBe(2);
    expect(results[0]).toBe(0);
    expect(results[1]).toBeGreaterThanOrEqual(30);
  });

  test("sugar plum tyrant: every pattern of all three phases; the crash takes +50 %", () => exact(() => {
    const { w, e, states } = bossRun("sugar_plum_tyrant");
    let decreed = 0;
    w.bus.on("waveIncoming", (x) => {
      if (x.label === "BY ROYAL DECREE!") decreed++;
    });
    step(w, 30, () => states.add(e.state));
    for (const s of [SP_SPIRAL, SP_DECREE, SP_COAT, SP_TELE]) expect(states.has(s), `p1 state ${s}`).toBe(true);
    expect(decreed).toBeGreaterThan(0);
    expect(count(w, "candy_corn")).toBeGreaterThan(0);
    e.hp = e.maxHp * 0.55;
    states.clear();
    step(w, 40, () => states.add(e.state));
    expect(tyrantState(e)!.phase).toBe(2);
    for (const s of [SP_SPIRAL, SP_JETE, SP_TELE]) expect(states.has(s), `p2 state ${s}`).toBe(true);
    e.hp = e.maxHp * 0.2;
    states.clear();
    let crashHit = 0;
    let highHit = 0;
    step(w, 20, () => {
      states.add(e.state);
      if (e.state === SP_CRASH && !crashHit) {
        const h = e.hp;
        w.hitEnemy(e, 100, null, 0, 0, -10, "test", 0xffffff);
        crashHit = h - e.hp;
      }
      if (e.state === SP_HIGH && e.inv <= 0 && !highHit) {
        const h = e.hp;
        w.hitEnemy(e, 100, null, 0, 0, -10, "test", 0xffffff);
        highHit = h - e.hp;
      }
    });
    expect(tyrantState(e)!.phase).toBe(3);
    expect(states.has(SP_HIGH) && states.has(SP_CRASH)).toBe(true);
    expect(crashHit / highHit).toBeCloseTo(CRASH_TAKEN, 1);
  }));

  test("the tyrant's death clears the stage (victory, the other candies dissolve)", () => {
    const w = new World({ hero: "hoshi", seed: 9, god: true, run: defaultRunConfig({ stage: "candy_kingdom" }) });
    simulate(w, 30, DT, new Bot(2));
    w.director.warnBoss(BOSSES.get("sugar_plum_tyrant")!, 0.4);
    w.director.warning!.t = 0;
    simulate(w, 2, DT, new Bot(2));
    const b = w.boss!;
    expect(b.def.id).toBe("sugar_plum_tyrant");
    b.inv = 0;
    w.hitEnemy(b, b.maxHp * 3, null, 0, 0, 0, "test", 0xffffff);
    expect(w.stageCleared).toBe(true);
    expect(w.phase).toBe("victory");
    expect(w.enemyCount).toBe(0);
  });

  test("endless: the tyrant's death starts the Filler Arc and the rematches come", () => {
    const w = new World({ hero: "hoshi", seed: 9, god: true, run: defaultRunConfig({ stage: "candy_kingdom", endless: true }) });
    simulate(w, 20, DT, new Bot(2));
    w.director.warnBoss(BOSSES.get("sugar_plum_tyrant")!, 0.4);
    w.director.warning!.t = 0;
    simulate(w, 2, DT, new Bot(2));
    const b = w.boss!;
    b.inv = 0;
    w.hitEnemy(b, b.maxHp * 3, null, 0, 0, 0, "test", 0xffffff);
    expect(w.stageCleared).toBe(true);
    expect(w.endlessOn).toBe(true);
    expect(w.phase).toBe("play");
    const rematches = new Set<string>();
    w.bus.on("fillerWave", (e) => {
      if (e.kind === "boss") rematches.add(e.id);
    });
    simulate(w, 260, DT, new Bot(2), (ww) => {
      const bb = ww.boss;
      if (bb && !bb.dead && bb.t > 5) ww.hitEnemy(bb, bb.maxHp, null, 0, 0, 0, "test", 0xffffff);
    });
    expect(w.phase).toBe("play");
    expect([...rematches]).toEqual(["gingerbread_golem", "sugar_plum_tyrant"]);
  });
});

describe("candy kingdom: full runs", () => {
  test("a god-mode bot run clears the whole stage", () => {
    const w = new World({ hero: "rin", seed: 11, maxEnemies: 250, god: true, run: defaultRunConfig({ stage: "candy_kingdom" }) });
    simulate(w, 800, DT, new Bot(4), (ww) => {
      // (keep the bosses to a test-friendly length: chip them while they live)
      const b = ww.boss;
      if (b && !b.dead && b.t > 25) ww.hitEnemy(b, b.maxHp * 0.004, null, 0, 0, 0, "test", 0xffffff);
    });
    expect(w.stageCleared).toBe(true);
    expect(w.phase).toBe("victory");
    expect(w.bullets.count).toBeLessThanOrEqual(CFG.maxBullets);
  });

  test("a mortal bot run plays out without exceptions", () => {
    for (const hero of ["hoshi", "mochi"]) {
      const w = new World({ hero, seed: 21, maxEnemies: 250, run: defaultRunConfig({ stage: "candy_kingdom" }) });
      simulate(w, 760, DT, new Bot(8));
      expect(["play", "dead", "victory"]).toContain(w.phase);
      expect(w.t).toBeGreaterThan(30);
    }
  });
});
