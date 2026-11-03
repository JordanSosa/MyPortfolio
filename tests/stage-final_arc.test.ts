/**
 * The Final Arc (stage 5, docs/content/stages.md §4, enemies.md §4 / §5.7-5.9):
 * the stage registers with the bible's data, its timeline spawns its roster
 * (commercial breaks, flashbacks, plot holes), every enemy twist works,
 * Truck-kun, Rival-chan and CANCEL-SAMA cycle every phase and die headless
 * (Cancel-sama degrading the show through stageFx directives and restoring
 * it on his death), his death clears the stage (or starts the Filler Arc),
 * and a full headless bot run completes without exceptions.
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { EVENT_HANDLERS } from "../src/game/director/events";
import { commercialOf, isFlashback } from "../src/game/director/events-s45";
import { BX_CUT, envOf } from "../src/game/enemies/_s45";
import { HOLE_MAX } from "../src/game/enemies/plot-hole";
import { BOSSES, ENEMIES, STAGES } from "../src/game/registry";
import { defaultRunConfig } from "../src/game/run-config";
import { stageBosses, stageEnemies, stageInfo } from "../src/game/stage";
import { finalArc } from "../src/game/stages/final-arc";
import { MODE_STRAIGHT, PK_FREE, type Enemy } from "../src/game/types";
import { TK_BEEP, TK_CONES, TK_GONE, TK_HORN, TK_LANE, EVIL_TITLE, TRUCK_TITLE, truckKunBoss } from "../src/game/bosses/truck-kun";
import { RV_BEAM, RV_DASH, RV_FANS, RV_FINAL, RV_MONTAGE, RV_SPIRAL, rivalState } from "../src/game/bosses/rival-chan";
import { CS_COMBO, CS_DRIFT, CS_FOCUS, CS_GRAPH, CS_HOLES, CS_OUTSOURCE, CS_SHEET, CS_STAMP, CUT_AFTER, cancelState } from "../src/game/bosses/cancel-sama";
import { World } from "../src/game/world";

const DT = 1 / 30;
const ROSTER = ["filler_goon", "animation_error", "mini_truck", "shadow_clone", "plot_hole"];

function sandbox(opts: { seed?: number; god?: boolean; hero?: string; endless?: boolean } = {}): World {
  const w = new World({ hero: opts.hero ?? "hoshi", seed: opts.seed ?? 5, director: false, god: opts.god ?? true, run: defaultRunConfig({ stage: "final_arc", endless: opts.endless ?? false }) });
  for (const inst of w.weapons) inst.def.dispose?.(w, inst);
  w.weapons.length = 0;
  return w;
}

function steps(w: World, sec: number, each?: () => void): void {
  for (let i = 0; i < sec / DT; i++) {
    w.step(DT);
    each?.();
  }
}

function alive(w: World, id: string): Enemy[] {
  const out: Enemy[] = [];
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i];
    if (!e.dead && e.def.id === id) out.push(e);
  }
  return out;
}

function spawnBoss(w: World, id: string): Enemy {
  const e = w.spawnEnemy(id, w.player.x, w.player.y - 90)!;
  w.boss = e;
  return e;
}

describe("The Final Arc: registry + data", () => {
  test("registers with the bible's numbers, roster, three bosses, props, music and its restoration hook", () => {
    expect(STAGES.get("final_arc")).toBe(finalArc);
    expect(stageInfo(finalArc)).toMatchObject({ id: "final_arc", order: 5, duration: 1200, rewardMul: 2.2, requires: "beach_episode", finalBoss: "cancel_sama" });
    expect(stageBosses(finalArc)).toEqual(["truck_kun_boss", "rival_chan", "cancel_sama"]);
    expect(finalArc.enrageAt).toBe(1230);
    expect(finalArc.bpm).toBe(160);
    expect(finalArc.music).toEqual({ battle: "finale", boss: "boss_finale", final: "cancel" });
    expect(finalArc.victory.title).toBe("RENEWED FOR SEASON 2!!");
    expect(stageEnemies(finalArc)).toEqual(expect.arrayContaining(ROSTER));
    for (const id of ROSTER) expect(ENEMIES.get(id), id).toBeDefined();
    for (const id of stageBosses(finalArc)) expect(BOSSES.get(id)?.boss, id).toBeDefined();
    for (const id of finalArc.props.ids!) expect(ENEMIES.get(id)?.prop, id).toBe(true);
    for (const ev of finalArc.events) expect(EVENT_HANDLERS[ev.kind], ev.kind).toBeTypeOf("function");
    expect(finalArc.events.filter((e) => e.kind === "boss").map((e) => [e.at, e.enemy])).toEqual([
      [480, "truck_kun_boss"],
      [840, "rival_chan"],
      [1140, "cancel_sama"],
    ]);
  });
});

describe("The Final Arc: enemies + events", () => {
  test("Shadow Clone wears the hero's run animation, mirrors her dash and shoots dark orbs", () => {
    const w = sandbox({ hero: "rin" });
    const c = w.spawnEnemy("shadow_clone", w.player.x + 70, w.player.y)!;
    expect(c.skin).toBe("rin_run");
    const hold = () => {
      // (kept at range: a clone right on the hero never fires - no bullet spawns on her)
      c.x = w.player.x + 70;
      c.y = w.player.y;
    };
    steps(w, 0.5);
    w.input.mx = 1;
    w.tryDash();
    let mirrored = false;
    steps(w, 0.6, () => {
      if (c.state === 1) mirrored = true;
    });
    expect(mirrored).toBe(true);
    let orbs = 0;
    steps(w, 4, () => {
      hold();
      for (let i = 0; i < w.bullets.count; i++) if (w.bullets.items[i].tint === 0x743fd1) orbs = 1;
    });
    expect(orbs).toBe(1);
  });

  test("Filler Goons share one frame clock and sometimes come back next episode", () => {
    const w = sandbox();
    const a = w.spawnEnemy("filler_goon", w.player.x + 50, w.player.y)!;
    const b = w.spawnEnemy("filler_goon", w.player.x - 50, w.player.y)!;
    steps(w, 1.3);
    expect(a.def.frame!(a)).toBe(b.def.frame!(b));
    let reruns = 0;
    for (let i = 0; i < 60; i++) {
      const g = w.spawnEnemy("filler_goon", w.player.x + 60, w.player.y + 20)!;
      const before = alive(w, "filler_goon").length;
      w.hitEnemy(g, 1e6, null, 0, 0, 0, "test", 0);
      if (alive(w, "filler_goon").length >= before) reruns++;
    }
    expect(reruns).toBeGreaterThan(4);
    expect(reruns).toBeLessThan(30);
  });

  test("Plot Hole: at most 3, never closer than 90 px, pulls the hero, eats gems + shots and spits the gems back", () => {
    const w = sandbox();
    const h = w.spawnEnemy("plot_hole", w.player.x + 30, w.player.y)!;
    expect(Math.hypot(h.x - w.player.x, h.y - w.player.y)).toBeGreaterThanOrEqual(89);
    for (let i = 0; i < 4; i++) w.spawnEnemy("plot_hole", w.player.x - 100, w.player.y + i * 30);
    w.step(DT);
    expect(alive(w, "plot_hole").length).toBe(HOLE_MAX);
    // the pull: the hero drifts toward it
    const d0 = Math.hypot(h.x - w.player.x, h.y - w.player.y);
    steps(w, 1);
    expect(Math.hypot(h.x - w.player.x, h.y - w.player.y)).toBeLessThan(d0 - 10);
    // it eats a gem and a projectile
    const g = w.dropGem(h.x, h.y, 50);
    g.vx = g.vy = 0;
    const p = w.spawnProjectile(null, "test");
    p.kind = PK_FREE;
    p.x = h.x;
    p.y = h.y - h.cy;
    p.life = 3;
    p.r = 0;
    const shots = w.projectiles.count;
    const stored = h.a;
    w.step(DT);
    expect(g.dead).toBe(true);
    expect(h.a).toBeGreaterThan(stored);
    // (the swallowed shot left the pool this step)
    expect(w.projectiles.count).toBe(shots - 1);
    const gems = w.gems.count;
    w.hitEnemy(h, 1e9, null, 0, 0, 0, "test", 0);
    expect(w.gems.count).toBeGreaterThan(gems);
  });

  test("Animation Error frame-skips toward the hero and leaves 2 dropped frames that expire", () => {
    const w = sandbox();
    const e = w.spawnEnemy("animation_error", w.player.x + 100, w.player.y)!;
    const x0 = e.x;
    steps(w, 1);
    expect(e.x).toBeLessThan(x0 - 30);
    w.hitEnemy(e, 1e6, null, 0, 0, 0, "test", 0);
    w.step(DT);
    expect(alive(w, "dropped_frame").length).toBe(2);
    expect(alive(w, "dropped_frame")[0].hp).toBe(12);
    steps(w, 1.7);
    expect(alive(w, "dropped_frame").length).toBe(0);
  });

  test("Mini Truck-kun telegraphs a lane through the hero, drives across and isekai's enemies in its way (no XP)", () => {
    const w = sandbox();
    const t = w.spawnEnemy("mini_truck", w.player.x - 150, w.player.y)!;
    const victim = w.spawnEnemy("filler_goon", w.player.x - 60, w.player.y)!;
    victim.hp = 1;
    w.step(DT);
    expect(w.telegraphs.count).toBeGreaterThan(0);
    const kills = w.kills;
    steps(w, 3.5);
    expect(victim.dead).toBe(true);
    expect(w.kills).toBe(kills);
    expect(t.dead).toBe(true);
    // lane events: straight-mode trucks bump too
    EVENT_HANDLERS.laneCharge(w, w.director, { at: 0, kind: "laneCharge", enemy: "mini_truck", count: 3, lines: 3, speed: 200 });
    for (let i = 0; i < 1.5 / DT; i++) {
      w.director.update(DT);
      w.step(DT);
    }
    expect(alive(w, "mini_truck").every((m) => m.mode === MODE_STRAIGHT)).toBe(true);
  });

  test("commercialBreak pauses spawning, then floods; flashback rings sepia re-runs with base HP 70", () => {
    const w = new World({ hero: "hoshi", seed: 4, god: true, run: defaultRunConfig({ stage: "final_arc" }) });
    w.step(DT);
    EVENT_HANDLERS.commercialBreak(w, w.director, { at: 0, kind: "commercialBreak", duration: 4, enemy: "filler_goon", count: 20 });
    expect(commercialOf(w)?.left).toBe(4);
    expect(w.director.introT).toBeGreaterThanOrEqual(4);
    steps(w, 4.2);
    expect(commercialOf(w)?.left).toBe(0);
    steps(w, 4.5);
    expect(alive(w, "filler_goon").length).toBeGreaterThan(15);
    EVENT_HANDLERS.flashback(w, w.director, { at: 0, kind: "flashback", count: 20 });
    let fb = 0;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i];
      if (!e.dead && isFlashback(w, e.uid)) {
        fb++;
        expect(["puff", "gummy_bear", "love_letter", "crab_kun"]).toContain(e.def.id);
      }
    }
    expect(fb).toBe(20);
  });
});

describe("The Final Arc: bosses", () => {
  test("Truck-kun: lane changes (off the view and back), reverse beep, cone scatter; RUSH HOUR brings Mini Truck-kuns + horn blasts; dies", () => {
    const w = sandbox();
    const t = spawnBoss(w, "truck_kun_boss");
    expect(truckKunBoss.boss!.title).toBe(TRUCK_TITLE);
    const seen = new Set<number>();
    const phases: string[] = [];
    w.bus.on("bossPhase", (e) => phases.push(e.title));
    steps(w, 26, () => seen.add(t.state));
    for (const s of [TK_LANE, TK_GONE, TK_BEEP, TK_CONES]) expect(seen.has(s), `state ${s}`).toBe(true);
    t.hp = t.maxHp * 0.45;
    let minis = 0;
    steps(w, 30, () => {
      seen.add(t.state);
      minis = Math.max(minis, alive(w, "mini_truck").length);
    });
    expect(phases).toEqual(["RUSH HOUR"]);
    expect(seen.has(TK_HORN)).toBe(true);
    expect(minis).toBeGreaterThanOrEqual(3);
    t.inv = 0;
    w.hitEnemy(t, 1e9, null, 0, 0, 0, "test", 0);
    expect(t.dead).toBe(true);
  });

  test("Truck-kun meets its evil alternate-universe self when the hero IS Truck-kun", () => {
    const w = sandbox({ hero: "truck_kun" });
    finalArc.onStart?.(w);
    expect(truckKunBoss.boss!.title).toBe(EVIL_TITLE);
    const w2 = sandbox({ hero: "rin" });
    finalArc.onStart?.(w2);
    expect(truckKunBoss.boss!.title).toBe(TRUCK_TITLE);
  });

  test("Rival-chan: a dark 2x recolour of the hero; dash slashes, beam sweep, star fans; the montage (x2 damage), spiral; FINAL CLASH beam; dies", () => {
    const w = sandbox({ hero: "mochi" });
    const r = spawnBoss(w, "rival_chan");
    expect(r.scale).toBe(2);
    expect(r.skin.startsWith("mochi_")).toBe(true);
    const seen = new Set<number>();
    const phases: string[] = [];
    w.bus.on("bossPhase", (e) => phases.push(e.title));
    steps(w, 20, () => seen.add(r.state));
    for (const s of [RV_DASH, RV_BEAM, RV_FANS]) expect(seen.has(s), `state ${s}`).toBe(true);
    r.hp = r.maxHp * 0.55;
    let montageHit = 0;
    steps(w, 10, () => {
      seen.add(r.state);
      if (r.state === RV_MONTAGE && montageHit === 0) {
        const hp = r.hp;
        w.hitEnemy(r, 100, null, 0, 0, 0, "test", 0);
        montageHit = hp - r.hp;
      }
    });
    expect(seen.has(RV_MONTAGE)).toBe(true);
    expect(montageHit).toBeGreaterThanOrEqual(150);
    steps(w, 12, () => seen.add(r.state));
    expect(seen.has(RV_SPIRAL)).toBe(true);
    expect(rivalState(r)!.trained).toBe(true);
    r.hp = r.maxHp * 0.2;
    steps(w, 16, () => seen.add(r.state));
    expect(phases).toEqual(["I'VE BEEN TRAINING!", "FINAL CLASH"]);
    expect(seen.has(RV_FINAL)).toBe(true);
    w.hitEnemy(r, 1e9, null, 0, 0, 0, "test", 0);
    expect(r.dead).toBe(true);
  });

  test("CANCEL-SAMA: four phases degrade the show (ratings grade, half-res + 6 fps + particles, speed lines + still frames, countdown -> OVERTIME); his death restores it and clears the stage", () => {
    const w = sandbox();
    const c = spawnBoss(w, "cancel_sama");
    const seen = new Set<number>();
    const phases: string[] = [];
    const fx: string[] = [];
    let stills = 0;
    w.bus.on("bossPhase", (e) => phases.push(e.title));
    w.bus.on("stageFx", (e) => {
      fx.push(`${e.kind}:${e.id}:${Math.round(e.value * 100) / 100}`);
      if (e.kind === "still") stills++;
    });
    steps(w, 26, () => seen.add(c.state));
    for (const s of [CS_STAMP, CS_SHEET, CS_FOCUS]) expect(seen.has(s), `state ${s}`).toBe(true);
    // RATINGS DROP: the saturation slides with the HP through the phase
    c.hp = c.maxHp * 0.74;
    steps(w, 4, () => seen.add(c.state));
    c.hp = c.maxHp * 0.6;
    steps(w, 16, () => seen.add(c.state));
    for (const s of [CS_GRAPH, CS_HOLES]) expect(seen.has(s), `state ${s}`).toBe(true);
    expect(fx.some((f) => f.startsWith("grade:ratings:") && Number(f.split(":")[2]) > 0.4)).toBe(true);
    // BUDGET CUTS
    c.hp = c.maxHp * 0.45;
    steps(w, 20, () => seen.add(c.state));
    expect(fx).toContain("renderScale::0.5");
    expect(fx).toContain("animFps::6");
    expect(fx).toContain("particles::0.5");
    expect(seen.has(CS_OUTSOURCE)).toBe(true);
    // RUSHED ENDING
    c.hp = c.maxHp * 0.2;
    steps(w, 64, () => seen.add(c.state));
    expect(fx).toContain("speedLines::0.6");
    expect(stills).toBeGreaterThan(10);
    expect(seen.has(CS_COMBO)).toBe(true);
    expect(cancelState(c)!.overtime).toBe(true);
    expect(phases).toEqual(["RATINGS DROP", "BUDGET CUTS", "RUSHED ENDING", "OVERTIME"]);
    fx.length = 0;
    w.hitEnemy(c, 1e9, null, 0, 0, 0, "test", 0);
    // restoration: colour, resolution, frame rate, particles, speed lines all back
    expect(fx).toEqual(expect.arrayContaining(["grade:ratings:0", "renderScale::1", "animFps::0", "particles::1", "speedLines::0"]));
    expect(w.stageCleared).toBe(true);
    expect(w.phase).toBe("victory");
  });

  test("CANCEL-SAMA smash-cuts back into the shot when left behind, and re-sends his degradations after a muted fast-forward", () => {
    const w = sandbox();
    const c = spawnBoss(w, "cancel_sama");
    const cuts: number[] = [];
    w.bus.on("enemyFx", (e) => {
      if (e.kind === BX_CUT) cuts.push(e.x);
    });
    steps(w, 4);
    // left far behind while drifting: "CUT TO:" him at his anchor within ~CUT_AFTER
    c.state = CS_DRIFT;
    c.timer = 0;
    c.x = w.player.x + 400;
    steps(w, CUT_AFTER + 0.3);
    expect(cuts.length).toBe(1);
    expect(Math.abs(c.x - w.player.x)).toBeLessThan(w.viewW * 0.5);
    // degradations sent while muted never reach the view: re-sent once on unmute
    c.hp = c.maxHp * 0.45;
    w.muted = true;
    steps(w, 6);
    const fx: string[] = [];
    w.bus.on("stageFx", (e) => fx.push(`${e.kind}:${e.id}:${e.value}`));
    w.muted = false;
    steps(w, 0.2);
    expect(cancelState(c)!.phase).toBe(3);
    expect(fx).toEqual(expect.arrayContaining(["grade:ratings:1", "renderScale::0.5", "animFps::6", "particles::0.5"]));
  });

  test("endless: Cancel-sama's death starts the Filler Arc; rematches cycle the stage's bosses", () => {
    const w = new World({ hero: "rin", seed: 9, god: true, run: defaultRunConfig({ stage: "final_arc", endless: true }) });
    w.t = 1139;
    const ids: string[] = [];
    w.bus.on("bossSpawn", (e) => ids.push(e.enemy.def.id));
    simulate(w, 8, DT, new Bot(2));
    expect(w.boss?.def.id).toBe("cancel_sama");
    w.hitEnemy(w.boss!, 1e9, null, 0, 0, 0, "test", 0);
    expect(w.endlessOn).toBe(true);
    simulate(w, 130, DT, new Bot(2));
    expect(ids).toContain("truck_kun_boss");
    expect(w.phase).toBe("play");
    void envOf;
  });
});

describe("The Final Arc: a full headless run", () => {
  test("the bot plays 20:00 with the timeline's roster, all three bosses fall, RENEWED FOR SEASON 2!!, no exceptions", () => {
    const w = new World({ hero: "rin", seed: 3, maxEnemies: 250, god: true, run: defaultRunConfig({ stage: "final_arc" }) });
    const seen = new Set<string>();
    const bosses: string[] = [];
    w.bus.on("bossKilled", (e) => bosses.push(e.title));
    simulate(w, 1260, DT, new Bot(2), (ww) => {
      if (ww.steps % 15 === 0) for (let i = 0; i < ww.enemies.count; i++) seen.add(ww.enemies.items[i].def.id);
      const b = ww.boss;
      if (b && !b.dead && b.t > 25 && ww.steps % 15 === 0) ww.hitEnemy(b, b.maxHp * 0.02, null, 0, 0, 0, "test", 0);
    });
    for (const id of ROSTER) expect(seen.has(id), id).toBe(true);
    expect(seen.has("crab_kun") || seen.has("puff")).toBe(true);
    expect(bosses).toEqual(["TRUCK-KUN", "RIVAL-CHAN", "CANCEL-SAMA"]);
    expect(w.phase).toBe("victory");
    expect(w.stageCleared).toBe(true);
  });
});
