/**
 * Stage system (docs/EXPANSION.md §10): the registry and StageInfo, Dream
 * Meadow parity with the shipped slice (same seed -> the same run, and the
 * stage-driven ground draws exactly the old meadow), a second stage that only
 * exists in this test (a different tileset, roster, timeline and final boss),
 * and the view's stage look (grade / ambient keyframes, stageFx directives).
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { defaultRunConfig } from "../src/game/run-config";
import { DEFAULT_STAGE, ENEMIES, STAGES, registerStage, stageDef, stageInfos } from "../src/game/registry";
import { finalBossAt, stageBosses, stageEnemies, stageInfo, stagePhaseAt, type StageDef } from "../src/game/stage";
import { dreamMeadow, EVENTS, PHASES } from "../src/game/stages/dream-meadow";
import { phaseAt } from "../src/game/director/timeline";
import { World } from "../src/game/world";
import { Ground } from "../src/view/ground";
import type { Anims } from "../src/view/anims";
import { Layer } from "../src/render/layers";
import type { Renderer } from "../src/render/renderer";
import { Ground as GroundV1 } from "./fixtures/meadow-ground-v1";
import { MEADOW_PARITY } from "./fixtures/meadow-parity";

const DT = 1 / 30;

/**
 * The shipped slice's content: the parity runs only offer these (Season 2 adds weapons / passives to the
 * registries, and a bigger card pool would change every level-up roll of the frozen runs).
 */
const SLICE_POOLS = {
  weaponPool: ["star_shot", "petal_slash", "yarn_orbit", "heart_boomerang", "thunder_bell", "candy_bomb", "bubble_aura", "prism_beam"],
  passivePool: ["power_bow", "wish_charm", "big_ribbon", "twin_charm", "swift_shoes", "magnet_star", "lucky_clover", "heart_locket"],
};

/** The fingerprint the frozen MEADOW_PARITY lines were generated with (do not change its format). */
function fingerprint(hero: string, seed: number, T: number): string {
  const w = new World({ hero, seed, maxEnemies: 250, run: defaultRunConfig(SLICE_POOLS) });
  const evs: string[] = [];
  w.bus.on("bossSpawn", (e) => evs.push(`spawn:${e.enemy.def.id}@${w.t.toFixed(2)}`));
  w.bus.on("bossKilled", (e) => evs.push(`kill:${e.title}@${w.t.toFixed(2)}`));
  w.bus.on("waveIncoming", (e) => evs.push(`wave:${e.kind}@${w.t.toFixed(2)}`));
  simulate(w, T, DT, new Bot(77));
  const s = w.summary();
  return [
    hero,
    seed,
    T,
    w.t.toFixed(3),
    w.phase,
    w.kills,
    w.level,
    w.player.x.toFixed(3),
    w.player.y.toFixed(3),
    w.enemyCount,
    Math.round(w.coins),
    w.damageTaken,
    s.weapons.map((x) => `${x.id}:${x.damage}`).join(","),
    evs.join(" "),
  ].join("|");
}

describe("stage registry", () => {
  test("Dream Meadow is registered, the default, and described for the account layer", () => {
    expect(STAGES.get("dream_meadow")).toBe(dreamMeadow);
    expect(DEFAULT_STAGE).toBe("dream_meadow");
    expect(stageDef(undefined)).toBe(dreamMeadow);
    expect(stageDef("no_such_stage")).toBe(dreamMeadow);
    const info = stageInfo(dreamMeadow);
    expect(info).toMatchObject({ id: "dream_meadow", order: 1, duration: 600, rewardMul: 1, finalBoss: "lady_lunatic" });
    expect(info.bosses).toEqual(["king_puff", "nightmare_teddy", "lady_lunatic"]);
    expect(info.enemies).toEqual(expect.arrayContaining(["puff", "batbun", "boo", "shroomie", "eyepuff", "pumpkin", "teddy", "wisp"]));
    expect(stageInfos().map((s) => s.id)).toContain("dream_meadow");
    expect(finalBossAt(dreamMeadow)).toBe(540);
  });

  test("the timeline lives in the stage file (the old director/timeline exports still work)", () => {
    expect(dreamMeadow.phases).toBe(PHASES);
    expect(dreamMeadow.events).toBe(EVENTS);
    // (Season 2 retune: same phase boundaries, caps up for the denser early horde)
    expect(PHASES.map((p) => [p.from, p.to, p.max])).toEqual([
      [0, 60, 75],
      [60, 120, 120],
      [120, 180, 160],
      [180, 210, 160],
      [210, 300, 190],
      [300, 360, 220],
      [360, 390, 240],
      [390, 540, 260],
      [540, 1e9, 260],
    ]);
    expect(EVENTS.filter((e) => e.kind === "boss").map((e) => [e.at, e.enemy, e.spawnMul])).toEqual([
      [180, "king_puff", 0.55],
      [360, "nightmare_teddy", 0.4],
      [540, "lady_lunatic", 0.4],
    ]);
    for (const t of [0, 59, 60, 200, 389, 541, 5000]) expect(phaseAt(t)).toBe(stagePhaseAt(dreamMeadow, t));
  });
});

describe("Dream Meadow parity with the shipped slice", () => {
  test.each(MEADOW_PARITY.map((l) => [l.split("|").slice(0, 3).join(" "), l]))("%s plays exactly as before", (_name, line) => {
    const [hero, seed, T] = line.split("|");
    expect(fingerprint(hero, Number(seed), Number(T))).toBe(line);
  });

  test("an explicit default RunConfig is the same run as no RunConfig", () => {
    const run = (cfg: boolean) => {
      const w = new World({ hero: "rin", seed: 21, maxEnemies: 250, run: cfg ? defaultRunConfig() : undefined });
      simulate(w, 90, DT, new Bot(3));
      return `${w.kills}|${w.level}|${w.player.x.toFixed(4)}|${Math.round(w.coins)}|${w.damageTaken}`;
    };
    expect(run(true)).toBe(run(false));
  });
});

// ------------------------------------------------------------------ the ground draws the same meadow
interface Call {
  k: string;
  a: string;
}

/** A renderer stand-in that records every draw call the ground makes. */
function recorder(view: { x: number; y: number; w: number; h: number }): { r: Renderer; calls: Call[] } {
  const calls: Call[] = [];
  const rec = (k: string) => (...a: unknown[]) => calls.push({ k, a: a.map((v) => (typeof v === "number" ? v.toFixed(5) : String(v))).join(",") });
  const r = { camera: { view }, spr: rec("spr"), shadow: rec("shadow"), glow: rec("glow") } as unknown as Renderer;
  return { r, calls };
}

/** Frame handles per sprite id (any stable numbering works: both grounds see the same one). */
const ANIM: Record<string, { first: number; count: number }> = {
  tile_ground: { first: 100, count: 8 },
  deco_flower: { first: 200, count: 4 },
  deco_grass: { first: 300, count: 3 },
  deco_rock: { first: 400, count: 2 },
  deco_mush: { first: 500, count: 2 },
  deco_crystal: { first: 600, count: 2 },
  deco_tree: { first: 700, count: 2 },
  tile_candy_test: { first: 900, count: 8 },
  deco_test_a: { first: 1000, count: 2 },
};
const anims = { get: (id: string) => ANIM[id] ?? { first: 0, count: 1 } } as unknown as Anims;

describe("stage-driven ground", () => {
  test("Dream Meadow's tiles, deco, trees, glows and canopy fades are drawn exactly as before", () => {
    const views = [
      { x: -108, y: -192, w: 216, h: 384 },
      { x: 1234.5, y: -987.25, w: 216, h: 384 },
      { x: -5000, y: 4321, w: 533, h: 300 },
      { x: 77, y: 33, w: 300, h: 400 },
    ];
    for (const view of views)
      for (const [time, density] of [
        [0, 1],
        [3.7, 1],
        [12.25, 0.6],
      ]) {
        const a = recorder(view);
        const b = recorder(view);
        const v1 = new GroundV1(a.r, anims);
        const v2 = new Ground(b.r, anims);
        v2.setStage(dreamMeadow);
        v1.density = v2.density = density;
        // the hero stands under a canopy somewhere in the view: the see-through fade must match too
        const px = view.x + view.w * 0.5;
        const py = view.y + view.h * 0.5;
        v1.draw(time, px, py);
        v2.draw(time, px, py);
        expect(b.calls.length).toBe(a.calls.length);
        expect(b.calls).toEqual(a.calls);
      }
  });
});

// ------------------------------------------------------------------ a second stage (tests only, never shipped)
const TEST_STAGE: StageDef = {
  ...dreamMeadow,
  id: "test_candy",
  name: "Test Candy Kingdom",
  subtitle: "Episode T: A Stage Only The Tests Know",
  order: 99,
  duration: 120,
  rewardMul: 1.5,
  requires: "dream_meadow",
  phases: [
    { from: 0, to: 30, mix: { boo: 1 }, rate: [3, 4], max: 60 },
    { from: 30, to: 1e9, mix: { boo: 1, shroomie: 1 }, rate: [5, 6], max: 90 },
  ],
  events: [
    { at: 20, kind: "encircle", enemy: "shroomie", count: 12, label: "SUGAR RUSH!" },
    { at: 40, kind: "boss", enemy: "king_puff", spawnMul: 0.5 },
  ],
  opening: { enemy: "boo", count: 6 },
  // its own toughness (StageScaling): the default curve, and a 0:40 final King Puff at a third of his HP
  scaling: { bossHp: 0.33 },
  finalBoss: "king_puff",
  enrageAt: 150,
  props: { ids: ["prop_gift"], interval: 10, max: 2 },
  music: { battle: "candy", boss: "boss_candy", final: "boss_candy" },
  clearColor: 0xffb8dc,
  tiles: {
    sprite: "tile_candy_test",
    rules: [{ noise: { freq: 0.12, seed: 3, above: 0.55 }, frames: [7] }],
    base: { frames: [0, 1, 2, 3], weights: [4, 3, 2, 1] },
  },
  deco: [{ kind: "scatter", cell: 30, base: 0.2, noise: 0.4, freq: 0.2, seed: 9, salt: 5, items: [{ sprite: "deco_test_a", upTo: 1, shadow: 6 }] }],
  grade: [{ at: 0, grade: { tint: [1.05, 0.98, 1.0], lift: [0.02, 0, 0.02], saturation: 1.1, contrast: 1.02, brightness: 1.01, hue: 0 } }],
  victory: { fx: "dawn", title: "SUGAR CRASH!", line: "test stage cleared" },
};

describe("a second stage (registered by this test only)", () => {
  registerStage(TEST_STAGE);

  test("its own roster, timeline, props and final boss drive the run", () => {
    expect(stageBosses(TEST_STAGE)).toEqual(["king_puff"]);
    expect(stageEnemies(TEST_STAGE).sort()).toEqual(["boo", "shroomie"]);
    const w = new World({ hero: "hoshi", seed: 4, maxEnemies: 250, god: true, run: defaultRunConfig({ stage: "test_candy" }) });
    expect(w.stage).toBe(TEST_STAGE);
    const labels: string[] = [];
    const bosses: string[] = [];
    let victory = 0;
    w.bus.on("waveIncoming", (e) => labels.push(e.label ?? e.kind));
    w.bus.on("bossSpawn", (e) => bosses.push(e.enemy.def.id));
    w.bus.on("victory", () => victory++);
    const props = new Set<string>();
    simulate(w, 200, DT, new Bot(8), (ww) => {
      for (let i = 0; i < ww.enemies.count; i++) {
        const e = ww.enemies.items[i];
        if (!e.dead && e.def.prop) props.add(e.def.id);
      }
    });
    const s = w.summary();
    // only the stage's roster ever spawned (+ its boss, the Puffs King Puff summons in his slam, the Shroomies' spores)
    expect(Object.keys(s.stats.killsByEnemy).every((id) => ["boo", "shroomie", "spore", "king_puff", "puff"].includes(id))).toBe(true);
    expect(s.stats.killsByEnemy.batbun ?? 0).toBe(0);
    expect(s.stats.killsByEnemy.boo).toBeGreaterThan(0);
    expect(labels).toContain("SUGAR RUSH!");
    expect(bosses).toEqual(["king_puff"]);
    // King Puff is this stage's FINAL boss: killing it wins
    expect(w.phase).toBe("victory");
    expect(victory).toBe(1);
    expect(s.stage).toBe("test_candy");
    expect(s.stageCleared).toBe(true);
    expect(s.stats.stageCleared).toBe(true);
    expect(s.stats.bossKills).toEqual(["king_puff"]);
    expect([...props].every((id) => id === "prop_gift")).toBe(true);
  });

  test("its tileset and deco are drawn from its own sprites (weights, salt)", () => {
    const view = { x: -50, y: 80, w: 216, h: 384 };
    const rec = recorder(view);
    const g = new Ground(rec.r, anims);
    g.setStage(TEST_STAGE);
    g.draw(1);
    const ground = `${Layer.Ground.toFixed(5)},`;
    const tiles = rec.calls.filter((c) => c.k === "spr" && c.a.startsWith(ground));
    expect(tiles.length).toBeGreaterThan(300);
    // every ground tile comes from tile_candy_test (handles 900..907), and the weighted base uses several frames
    const frames = new Set(tiles.map((c) => Number(c.a.split(",")[1])));
    expect([...frames].every((f) => f >= 900 && f < 908)).toBe(true);
    expect(frames.size).toBeGreaterThanOrEqual(4);
    const deco = rec.calls.filter((c) => c.k === "spr" && !c.a.startsWith(ground));
    expect(deco.length).toBeGreaterThan(0);
    expect(deco.every((c) => Number(c.a.split(",")[1]) >= 1000 && Number(c.a.split(",")[1]) < 1002)).toBe(true);
  });

  test("stageInfo carries the gating / reward data", () => {
    const info = stageInfo(TEST_STAGE);
    expect(info).toMatchObject({ id: "test_candy", order: 99, duration: 120, rewardMul: 1.5, requires: "dream_meadow", finalBoss: "king_puff" });
    // (sorted by order: the shipped Season 2 stages sit between Dream Meadow and this order-99 test stage)
    const ids = stageInfos().map((s) => s.id);
    expect(ids[0]).toBe("dream_meadow");
    expect(ids[ids.length - 1]).toBe("test_candy");
  });
});

describe("the device enemy ceiling (World.enemyCeiling)", () => {
  test("scripted spawns stop at maxEnemies x 1.25; bosses and props always spawn", () => {
    const w = new World({ hero: "hoshi", seed: 3, maxEnemies: 40 });
    expect(w.enemyCeiling).toBe(50);
    const p = w.player;
    let n = 0;
    for (let i = 0; i < 200; i++) if (w.spawnEnemy("puff", p.x + 200 + (i % 20) * 9, p.y + 200 + Math.floor(i / 20) * 9)) n++;
    expect(n).toBe(50);
    expect(w.enemyCount).toBe(50);
    // a plain enemy (and an elite) past the ceiling: null, nothing changed
    expect(w.spawnEnemy("puff", p.x + 300, p.y)).toBeNull();
    expect(w.spawnEnemy("puff", p.x + 300, p.y, true)).toBeNull();
    expect(w.enemyCount).toBe(50);
    // a boss still spawns (and counts), a prop still spawns
    const boss = w.spawnEnemy("king_puff", p.x, p.y - 200);
    expect(boss).not.toBeNull();
    expect(boss!.def.boss).toBeTruthy();
    expect(w.enemyCount).toBe(51);
    const prop = [...ENEMIES.values()].find((d) => d.prop);
    expect(prop).toBeDefined();
    expect(w.spawnEnemy(prop!, p.x - 200, p.y)).not.toBeNull();
    // (the boss counts toward the ceiling too) two deaths free a slot for the next plain spawn
    w.despawn(boss!);
    expect(w.spawnEnemy("puff", p.x + 300, p.y)).toBeNull();
    w.despawn(w.enemies.items.slice(0, w.enemies.count).find((e) => !e.dead && e.def.id === "puff")!);
    expect(w.spawnEnemy("puff", p.x + 300, p.y)).not.toBeNull();
  });

  test("the Final Arc and the Beach Episode at the low tier stay under the ceiling and their events still finish", () => {
    for (const stage of ["final_arc", "beach_episode"]) {
      const w = new World({ hero: "rin", seed: 11, god: true, maxEnemies: 150, run: { ...defaultRunConfig(), stage } });
      let peakPlain = 0;
      simulate(w, 1260, DT, new Bot(11), (ww) => {
        let bosses = 0;
        for (let i = 0; i < ww.enemies.count; i++) if (!ww.enemies.items[i].dead && ww.enemies.items[i].def.boss) bosses++;
        peakPlain = Math.max(peakPlain, ww.enemyCount - bosses);
      });
      expect(peakPlain, stage).toBeLessThanOrEqual(w.enemyCeiling);
      // the run reached its end (no scripted event stalled waiting on a spawn that never happened)
      expect(["victory", "play"]).toContain(w.phase);
      expect(w.t, stage).toBeGreaterThan(stageDef(stage)!.duration - 5);
    }
  }, 240_000);
});
