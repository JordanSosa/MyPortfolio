/**
 * The endless "Filler Arc" (docs/EXPANSION.md §10, docs/content/stages.md §7),
 * RunStats collection (run-config.ts contract) and the view's stage look
 * (grade / ambient keyframes, the sim's stageFx directives).
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import { FILLER_EPISODE } from "../src/game/director/director";
import { BOSSES, WEAPONS } from "../src/game/registry";
import { defaultRunConfig } from "../src/game/run-config";
import { dreamMeadow } from "../src/game/stages/dream-meadow";
import { World } from "../src/game/world";
import { GRADES, PostFx } from "../src/render/post";
import type { Renderer } from "../src/render/renderer";
import type { Fx } from "../src/fx";
import { StageLook } from "../src/view/stage-view";

const DT = 1 / 30;

/** Bring the final boss in now and land the killing blow. */
function killFinalBoss(w: World): void {
  w.director.warnBoss(BOSSES.get("lady_lunatic")!, 0.4);
  w.director.warning!.t = 0;
  w.step(DT);
  const lady = w.boss!;
  expect(lady.def.id).toBe("lady_lunatic");
  lady.inv = 0;
  w.hitEnemy(lady, lady.hp * 3, null, 0, 0, 0, "test", 0xffffff);
}

describe("Filler Arc (endless)", () => {
  test("without endless the final boss's death wins the run, as before", () => {
    const w = new World({ hero: "hoshi", seed: 1, god: true });
    let victory = 0;
    w.bus.on("victory", () => victory++);
    killFinalBoss(w);
    expect(w.phase).toBe("victory");
    expect(victory).toBe(1);
    expect(w.stageCleared).toBe(true);
    expect(w.endlessOn).toBe(false);
  });

  test("with endless the run goes on: FILLER ARC, rising scaling, elite waves, boss rematches, episode cards", () => {
    const w = new World({ hero: "rin", seed: 2, god: true, maxEnemies: 250, run: defaultRunConfig({ endless: true }) });
    simulate(w, 30, DT, new Bot(3));
    let victory = 0;
    let filler = 0;
    const waves: string[] = [];
    const rematches: { id: string; hp: number }[] = [];
    const episodes: number[] = [];
    w.bus.on("victory", () => victory++);
    w.bus.on("fillerArc", () => filler++);
    const rematchIds: string[] = [];
    w.bus.on("fillerWave", (e) => {
      waves.push(e.kind);
      if (e.kind === "boss") rematchIds.push(e.id);
    });
    w.bus.on("fillerEpisode", (e) => episodes.push(e.n));
    killFinalBoss(w);
    w.bus.on("bossSpawn", (e) => rematches.push({ id: e.enemy.def.id, hp: e.enemy.maxHp }));
    expect(w.phase).toBe("play");
    expect(victory).toBe(0);
    expect(filler).toBe(1);
    expect(w.endlessOn).toBe(true);
    expect(w.stageCleared).toBe(true);
    const from = w.endlessFrom;
    const hp0 = w.spawnEnemy("puff", 300, 300)!.maxHp;
    simulate(w, FILLER_EPISODE + 5, DT, new Bot(3));
    expect(w.phase).toBe("play");
    // elite waves every 45 s, rematches every 120 s (King Puff first, then Nightmare Teddy, scaled per loop)
    expect(waves.filter((k) => k === "elite").length).toBeGreaterThanOrEqual(6);
    expect(waves.filter((k) => k === "boss").length).toBeGreaterThanOrEqual(2);
    // (this test starts the Filler Arc at 0:30, so the timeline's own 3:00 / 6:00 bosses still arrive too)
    expect(rematchIds.slice(0, 2)).toEqual(["king_puff", "nightmare_teddy"]);
    expect(rematches.some((r) => r.id === "king_puff")).toBe(true);
    expect(w.director.endlessBosses).toBe(rematchIds.length);
    expect(episodes).toEqual([1]);
    // regular enemies keep getting tougher than the plain time scaling
    const later = w.spawnEnemy("puff", 300, 300)!.maxHp;
    expect(later).toBeGreaterThan(hp0 * 1.5);
    // a rematched final boss is not the final boss again (no second Filler Arc / victory)
    expect(w.isFinalBoss(w.spawnEnemy("lady_lunatic", 0, -400)!)).toBe(false);
    const s = w.summary().stats;
    expect(s.endless).toBe(true);
    expect(s.stageCleared).toBe(true);
    expect(s.endlessTime).toBeCloseTo(w.t - from, 6);
    expect(s.endlessTime).toBeGreaterThan(FILLER_EPISODE);
    expect(s.bossKills[0]).toBe("lady_lunatic");
  });

  test("dying in the Filler Arc keeps the clear", () => {
    const w = new World({ hero: "mochi", seed: 4, run: defaultRunConfig({ endless: true }) });
    killFinalBoss(w);
    w.player.iframes = 0;
    w.player.dashInv = 0;
    w.hurtPlayer(99999, 0, 0, "test_blow");
    expect(w.phase).toBe("dead");
    const s = w.summary();
    expect(s.stageCleared).toBe(true);
    expect(s.stats.outcome).toBe("dead");
    expect(s.stats.killedBy).toBe("test_blow");
  });

  test("the final boss falling on the step the hero dies: an endless run still starts its Filler Arc after a revive", () => {
    const w = new World({ hero: "hoshi", seed: 5, run: defaultRunConfig({ endless: true, flags: { revives: 1 } }) });
    w.director.warnBoss(BOSSES.get("lady_lunatic")!, 0.4);
    w.director.warning!.t = 0;
    w.step(DT);
    w.player.iframes = w.player.dashInv = 0;
    w.hurtPlayer(99999, 0, 0);
    const lady = w.boss!;
    lady.inv = 0;
    w.hitEnemy(lady, lady.hp * 3, null, 0, 0, 0, "test", 0);
    expect(w.phase).toBe("dead");
    expect(w.stageCleared).toBe(true);
    expect(w.revive()).toBe(true);
    for (let i = 0; i < 5; i++) w.step(DT);
    expect(w.phase).toBe("play");
    expect(w.endlessOn).toBe(true);
  });
});

describe("RunStats", () => {
  test("a bot run's counters agree with the world and the event stream", () => {
    const w = new World({ hero: "rin", seed: 12, maxEnemies: 250 });
    let dashes = 0;
    let chests = 0;
    let food = 0;
    let ults = 0;
    let levelUps = 0;
    w.bus.on("dash", () => dashes++);
    w.bus.on("chestOpened", () => chests++);
    w.bus.on("pickup", (e) => void ((e.kind === "onigiri" || e.kind === "cake") && food++));
    w.bus.on("ultStart", () => ults++);
    w.bus.on("levelUp", () => levelUps++);
    let maxWeapons = 0;
    simulate(w, 200, DT, new Bot(9), (ww) => void (maxWeapons = Math.max(maxWeapons, ww.weapons.length)));
    const sum = w.summary();
    const s = sum.stats;
    expect(s.stage).toBe("dream_meadow");
    expect(s.hero).toBe("rin");
    expect(s.time).toBe(w.t);
    expect(s.level).toBe(w.level);
    expect(s.levelUps).toBe(levelUps);
    expect(s.levelUps).toBe(w.level - 1);
    expect(Object.values(s.killsByEnemy).reduce((a, b) => a + b, 0)).toBe(w.kills);
    expect(s.dashes).toBe(dashes);
    expect(s.chests).toBe(chests);
    expect(s.foodEaten).toBe(food);
    expect(s.ults).toBe(ults);
    expect(s.coins).toBe(Math.floor(w.coins));
    expect(s.maxCombo).toBe(w.maxCombo);
    expect(s.damageTaken).toBe(w.damageTaken);
    expect(s.maxRank).toBeGreaterThanOrEqual(0);
    expect(s.noHitBest).toBeGreaterThan(0);
    expect(s.noHitBest).toBeLessThanOrEqual(w.t);
    expect(s.maxWeaponsHeld).toBe(maxWeapons);
    expect(s.crits!).toBeGreaterThan(0);
    expect(s.gemsCollected!).toBeGreaterThan(0);
    expect(s.healed!).toBeGreaterThan(0);
    expect(s.weaponsUsed![0]).toBe("petal_slash");
    if (dashes > 0) expect(s.firstDashAt!).toBeGreaterThanOrEqual(0);
    else expect(s.firstDashAt).toBe(-1);
    // damage per weapon: weapon ids only, matching the world's tally; kills per weapon never exceed kills
    for (const [id, d] of Object.entries(s.damageByWeapon)) {
      expect(WEAPONS.has(id)).toBe(true);
      expect(d).toBe(Math.round(w.damageBy.get(id)!));
    }
    expect(Object.values(s.killsByWeapon).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(w.kills);
    for (const id of s.evolutions) expect(w.weapons.some((x) => x.def.id === id)).toBe(true);
    expect(s.outcome).toBe(w.phase === "dead" ? "dead" : "quit");
    expect(sum.stats).toBe(s);
  });

  test("no-hit streak and pacifist streak are measured in run seconds", () => {
    const w = new World({ hero: "hoshi", seed: 1, director: false });
    w.weapons.length = 0;
    for (let t = 0; t < 10; t += DT) w.step(DT);
    w.hurtPlayer(1, 0, 0);
    for (let t = 0; t < 4; t += DT) w.step(DT);
    const s = w.summary().stats;
    expect(s.noHitBest).toBeGreaterThan(9.9);
    expect(s.noHitBest).toBeLessThan(10.2);
    expect(s.pacifistBest!).toBeGreaterThan(13.9);
    expect(s.stillBest!).toBeGreaterThan(13.9);
  });
});

// ------------------------------------------------------------------ the view's stage look
function lookRig(): { look: StageLook; post: PostFx; amb: { petals: number; motes: number; fireflies: number }; dpr: number[] } {
  const post = new PostFx();
  const amb = { petals: -1, motes: -1, fireflies: -1 };
  const dpr: number[] = [];
  const quality = { dprCap: 3 } as { dprCap: number };
  const r = {
    post,
    clearColor: 0,
    quality,
    setQuality(q: { dprCap?: number }) {
      if (q.dprCap !== undefined) {
        quality.dprCap = q.dprCap;
        dpr.push(q.dprCap);
      }
    },
    atlas: { info: () => ({ first: 0, count: 1 }) },
    camera: { view: { x: 0, y: 0, w: 216, h: 384 }, x: 0, y: 0 },
  } as unknown as Renderer;
  const fx = { ambient: { set: (d: typeof amb) => Object.assign(amb, d) }, speed: { radial() {}, stop() {} } } as unknown as Fx;
  return { look: new StageLook(r, fx), post, amb, dpr };
}

describe("stage look (view)", () => {
  test("Dream Meadow: day -> dusk -> night over the 9 minutes, petals give way to fireflies", () => {
    const { look, post, amb } = lookRig();
    const w = new World({ hero: "hoshi", seed: 1, director: false });
    look.setWorld(w);
    const at = (t: number) => {
      w.t = t;
      look.frame(1 / 60);
    };
    at(0);
    expect(post.grade).toEqual(GRADES.day);
    expect(amb).toEqual({ petals: 12, motes: 10, fireflies: 0 });
    at(270);
    expect(post.grade).toEqual(GRADES.dusk);
    at(540);
    expect(post.grade.saturation).toBeCloseTo(GRADES.night.saturation, 9);
    expect(amb).toEqual({ petals: 0, motes: 16, fireflies: 22 });
    expect(look.music("battle")).toBe(dreamMeadow.music.battle);
  });

  test("sim stageFx directives: grade override, render scale, animation fps cap, reset", () => {
    const { look, post, dpr } = lookRig();
    const w = new World({ hero: "hoshi", seed: 1, director: false });
    look.setWorld(w);
    look.directive({ kind: "grade", value: 1, seconds: 0, id: "dim" });
    look.frame(1 / 60);
    expect(post.grade.saturation).toBeCloseTo(GRADES.dim.saturation, 9);
    look.directive({ kind: "renderScale", value: 0.5, seconds: 0, id: "" });
    expect(dpr[dpr.length - 1]).toBeLessThan(3);
    look.directive({ kind: "animFps", value: 4, seconds: 0, id: "" });
    expect(look.animFps).toBe(4);
    look.directive({ kind: "reset", value: 0, seconds: 0, id: "" });
    look.frame(1 / 60);
    expect(post.grade).toEqual(GRADES.day);
    expect(look.animFps).toBe(0);
    expect(dpr[dpr.length - 1]).toBe(3);
    void CFG;
  });
});
