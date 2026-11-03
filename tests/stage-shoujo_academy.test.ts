/**
 * Stage 3 - Shoujo Academy (docs/content/stages.md §2, enemies.md §2 + §5.3-5.4):
 * the stage registers with the bible's numbers, its timeline spawns the whole
 * roster (teleportIn / schoolBell included), every enemy twist works, both
 * bosses cycle every phase headless and die, the Bishounen's death clears the
 * stage (victory, or the Filler Arc when endless), and full bot runs finish
 * without exceptions.
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import { BOSSES, ENEMIES, STAGES } from "../src/game/registry";
import { defaultRunConfig } from "../src/game/run-config";
import { stageBosses, stageEnemies } from "../src/game/stage";
import type { Enemy } from "../src/game/types";
import { World } from "../src/game/world";
import { EVENT_HANDLERS } from "../src/game/director/events";
import { academyState, F_GROWTH, HEART } from "../src/game/enemies/_academy";
import { MON_DASH, MON_WHISTLE } from "../src/game/enemies/hall-monitor";
import { SLIME_FLEEING, SLIME_RETURNING } from "../src/game/enemies/tsundere-slime";
import { TS_ARRIVING, TS_WALK } from "../src/game/enemies/transfer-student";
import { activeRule, CP_DENIED, CP_FLOURISH, CP_GLARE, CP_GLINT, CP_SPIRAL, CP_SUMMON, CP_SWEEP, presidentState } from "../src/game/bosses/council-president";
import { BS_FANCLUB, BS_FLIP, BS_FAN7, BS_HEART, BS_PHONE, BS_RAIN, BS_RING, BS_SPIRAL, BS_STORM, BS_WIND, bishBodyY, bishState } from "../src/game/bosses/bishounen";
import { angDiff } from "../src/game/bosses/_s23";

const DT = 1 / 30;
const ROSTER = ["exam_paper", "love_letter", "tsundere_slime", "hall_monitor", "council_ninja", "transfer_student"];

function sandbox(god = true, seed = 7): World {
  const w = new World({ hero: "hoshi", seed, director: false, god, run: defaultRunConfig({ stage: "shoujo_academy" }) });
  for (const inst of w.weapons) inst.def.dispose?.(w, inst);
  w.weapons.length = 0;
  return w;
}
function mortal(w: World, on: boolean): void {
  (w as unknown as { god: boolean }).god = !on;
}
function step(w: World, sec: number, each?: () => void): void {
  for (let i = 0; i < sec / DT; i++) {
    w.step(DT);
    each?.();
  }
}
function alive(w: World, id: string): Enemy[] {
  const out: Enemy[] = [];
  for (let i = 0; i < w.enemies.count; i++) if (!w.enemies.items[i].dead && w.enemies.items[i].def.id === id) out.push(w.enemies.items[i]);
  return out;
}

describe("shoujo academy: stage", () => {
  test("registers with the bible's numbers", () => {
    const st = STAGES.get("shoujo_academy")!;
    expect(st).toBeDefined();
    expect(st.order).toBe(3);
    expect(st.duration).toBe(840);
    expect(st.rewardMul).toBe(1.5);
    expect(st.requires).toBe("candy_kingdom");
    expect(st.bpm).toBe(136);
    expect(st.finalBoss).toBe("bishounen");
    expect(st.enrageAt).toBe(870);
    expect(st.music).toEqual({ battle: "academy", boss: "boss_academy", final: "boss_academy" });
    expect(st.victory.title).toBe("CLASS DISMISSED!");
    expect(stageBosses(st)).toEqual(["council_president", "bishounen"]);
    expect(stageEnemies(st).sort()).toEqual([...ROSTER].sort());
    expect(st.phases.length).toBe(9);
    expect(st.grade.length).toBe(4);
    for (const id of ROSTER) expect(ENEMIES.get(id), id).toBeDefined();
    for (const id of stageBosses(st)) expect(BOSSES.get(id)?.boss, id).toBeDefined();
  });

  test("its timeline spawns the whole roster, its props and the new event kinds", () => {
    const w = new World({ hero: "rin", seed: 4, maxEnemies: 250, god: true, run: defaultRunConfig({ stage: "shoujo_academy" }) });
    const seen = new Set<string>();
    const waves = new Set<string>();
    w.bus.on("waveIncoming", (e) => waves.add(e.label ?? e.kind));
    simulate(w, 560, DT, new Bot(3), (ww) => {
      for (let i = 0; i < ww.enemies.count; i++) seen.add(ww.enemies.items[i].def.id);
      const b = ww.boss;
      if (b && !b.dead && b.t > 20) ww.hitEnemy(b, b.maxHp * 0.01, null, 0, 0, 0, "test", 0xffffff);
    });
    for (const id of ROSTER) expect(seen.has(id), id).toBe(true);
    expect(seen.has("prop_school_desk") || seen.has("prop_vending")).toBe(true);
    expect(seen.has("council_president")).toBe(true);
    expect([...waves]).toEqual(expect.arrayContaining(["POP QUIZ!", "TRANSFER STUDENTS?!", "THE BELL RINGS!", "CONFESSION SEASON!"]));
  });

  test("teleportIn: sparkle circles first, then the students appear 40-70 px from the player", () => {
    const w = sandbox();
    const d = w.director;
    EVENT_HANDLERS.teleportIn(w, d, { at: 0, kind: "teleportIn", enemy: "transfer_student", count: 3 });
    expect(w.telegraphs.count).toBe(3);
    expect(alive(w, "transfer_student").length).toBe(0);
    for (let i = 0; i < 0.7 / DT; i++) {
      w.step(DT);
      // (the director's tasks run in its update: drive them by hand in a director-less sandbox)
      (d as unknown as { tasks: ((dt: number) => boolean)[] }).tasks.forEach((t) => t(DT));
    }
    const ts = alive(w, "transfer_student");
    expect(ts.length).toBeGreaterThanOrEqual(3);
    for (const e of ts) {
      const r = Math.hypot(e.x - w.player.x, e.y - w.player.y);
      expect(r).toBeGreaterThan(30);
      expect(r).toBeLessThan(80);
      expect(e.state).not.toBe(TS_ARRIVING); // already telegraphed: no second sparkle wait
    }
  });

  test("schoolBell: every Hall Monitor on screen whistles, more arrive around the edges", () => {
    const w = sandbox();
    const m = w.spawnEnemy("hall_monitor", 50, 0)!;
    step(w, 0.1);
    EVENT_HANDLERS.schoolBell(w, w.director, { at: 0, kind: "schoolBell", count: 8 });
    expect(m.state).toBe(MON_WHISTLE);
    expect(alive(w, "hall_monitor").length).toBe(9);
  });
});

describe("shoujo academy: enemies", () => {
  test("hall monitor: a dash within 100 px -> whistle (0.3 s) -> a 150 px/s dash; 3 s cooldown", () => {
    const w = sandbox();
    const m = w.spawnEnemy("hall_monitor", 70, 0)!;
    m.b = 0;
    step(w, 0.2);
    expect(m.state).toBe(0);
    w.input.mx = -1;
    w.input.dash = true;
    let whistled = false;
    let dashed = false;
    step(w, 1.2, () => {
      w.input.mx = 0;
      if (m.state === MON_WHISTLE) {
        whistled = true;
        expect(m.def.frame!(m)).toBe(3);
      }
      if (m.state === MON_DASH && m.timer > 0.05) {
        dashed = true;
        expect(Math.hypot(m.vx, m.vy)).toBeCloseTo(150, 0);
      }
    });
    expect(whistled && dashed).toBe(true);
    // cooldown: a second dash right away is ignored
    w.player.dashCharges = 1;
    w.player.dashCd = 0;
    w.input.dash = true;
    step(w, 0.2);
    expect(m.state).not.toBe(MON_WHISTLE);
  });

  test("love letter: hearts sometimes; confession elites always burst into 3 homing hearts", () => {
    const w = sandbox();
    const e = w.spawnEnemy("love_letter", 80, 0, true)!;
    step(w, 0.05);
    w.killEnemy(e, null);
    const hearts = () => {
      let n = 0;
      for (let i = 0; i < w.bullets.count; i++) if (!w.bullets.items[i].dead && w.bullets.items[i].sprite === HEART) n++;
      return n;
    };
    expect(hearts()).toBe(3);
    const b = w.bullets.items[0];
    const a0 = Math.atan2(b.vy, b.vx);
    step(w, 0.5);
    const a1 = Math.atan2(b.vy, b.vx);
    expect(Math.abs(angDiff(a1, a0))).toBeGreaterThan(0.1); // homing turns them
    expect(Math.abs(angDiff(a1, a0))).toBeLessThanOrEqual(0.8 * 0.5 + 0.05); // at <= 0.8 rad/s
  });

  test("tsundere slime: a non-lethal hit -> flees 1.5 s -> returns 40 % faster for 2 s", () => {
    const w = sandbox();
    const s = w.spawnEnemy("tsundere_slime", 60, 0)!;
    step(w, 0.1);
    w.hitEnemy(s, 1, null, 0, 0, -10, "test", 0xffffff);
    expect(s.state).toBe(SLIME_FLEEING);
    let fledAway = false;
    const d0 = Math.hypot(s.x - w.player.x, s.y - w.player.y);
    step(w, 1.4, () => {
      if (Math.hypot(s.x - w.player.x, s.y - w.player.y) > d0 + 20) fledAway = true;
    });
    expect(fledAway).toBe(true);
    step(w, 0.2);
    expect(s.state).toBe(SLIME_RETURNING);
    step(w, 2.1);
    expect(s.state).toBe(0);
  });

  test("ojou slime's return leaves 3 static orbs", () => {
    const w = sandbox();
    const s = w.spawnEnemy("tsundere_slime", 90, 0, true)!;
    step(w, 0.1);
    w.hitEnemy(s, 1, null, 0, 0, -10, "test", 0xffffff);
    let maxStatic = 0;
    step(w, 4, () => {
      let n = 0;
      for (let i = 0; i < w.bullets.count; i++) {
        const b = w.bullets.items[i];
        if (!b.dead && b.sprite === "eb_orb" && b.vx === 0 && b.vy === 0) n++;
      }
      maxStatic = Math.max(maxStatic, n);
    });
    expect(maxStatic).toBe(3);
  });

  test("transfer student: never walks in - hidden, sparkle, then it appears 36-60 px away; blinks every 5 s", () => {
    const w = sandbox();
    const e = w.spawnEnemy("transfer_student", 200, 0)!; // the spawn ring
    expect(e.state).toBe(TS_ARRIVING);
    expect(e.untargetable).toBe(true);
    expect(e.dmg).toBe(0);
    step(w, 0.7);
    expect(e.state === TS_WALK || e.untargetable === false).toBe(true);
    const r = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    expect(r).toBeGreaterThan(30);
    expect(r).toBeLessThan(66);
    expect(e.dmg).toBeGreaterThan(0);
    const x0 = e.x;
    step(w, 5.8);
    expect(Math.abs(e.x - x0)).toBeGreaterThan(0.5); // it blinked (or walked) somewhere else
  });

  test("exam paper: contact = damage + F- (-5 % XP gain each, max 3; Final Exam 6)", () => {
    const w = sandbox(false);
    const g0 = w.stats.growth;
    for (let i = 0; i < 4; i++) {
      const p = w.spawnEnemy("exam_paper", w.player.x + 2, w.player.y)!;
      w.player.iframes = 0;
      step(w, DT * 2);
      w.despawn(p);
      w.player.hp = w.player.maxHp;
    }
    step(w, DT);
    const st = academyState(w)!;
    expect(st.fStacks).toBe(3);
    expect(w.stats.growth).toBeCloseTo(g0 - 3 * F_GROWTH, 5);
    for (let i = 0; i < 4; i++) {
      const p = w.spawnEnemy("exam_paper", w.player.x + 2, w.player.y, true)!;
      w.player.iframes = 0;
      step(w, DT * 2);
      w.despawn(p);
      w.player.hp = w.player.maxHp;
    }
    expect(st.fStacks).toBeGreaterThan(3);
    expect(st.fStacks).toBeLessThanOrEqual(6);
    step(w, 9);
    expect(st.fStacks).toBe(0);
    expect(w.stats.growth).toBeCloseTo(g0, 5);
  });

  test("council ninja: 3-fans of shuriken, and a smoke bomb behind you when you get close", () => {
    const w = sandbox();
    const n = w.spawnEnemy("council_ninja", 70, 0)!;
    let shuriken = 0;
    step(w, 5, () => {
      for (let i = 0; i < w.bullets.count; i++) if (w.bullets.items[i].sprite === "eb_shuriken") shuriken = Math.max(shuriken, w.bullets.count);
    });
    expect(shuriken).toBeGreaterThanOrEqual(3);
    w.bullets.clear();
    // walk right into it while facing right: it reappears ~60 px behind (to the left)
    w.player.aimX = 1;
    w.player.aimY = 0;
    n.x = w.player.x + 20;
    n.y = w.player.y;
    n.b = 0;
    step(w, DT * 2);
    expect(n.x).toBeLessThan(w.player.x - 40);
  });

  test("an elite ninja's decoy explodes after 1 s", () => {
    const w = sandbox(false);
    const n = w.spawnEnemy("council_ninja", 20, 0, true)!;
    n.b = 0;
    step(w, DT * 2);
    const st = academyState(w)!;
    expect(Array.from(st.dt).some((t) => t > 0)).toBe(true);
    // stand on the decoy
    let hurt = false;
    w.hooks.on("hurt", () => (hurt = true));
    const i = Array.from(st.dt).findIndex((t) => t > 0);
    step(w, 1.1, () => {
      w.player.x = st.dx[i] || w.player.x;
      w.player.y = st.dy[i] || w.player.y;
    });
    expect(hurt).toBe(true);
  });
});

function bossRun(id: string, seed = 5): { w: World; e: Enemy; states: Set<number> } {
  const w = sandbox(true, seed);
  const e = w.spawnEnemy(id, 0, -80)!;
  w.boss = e;
  return { w, e, states: new Set<number>() };
}

describe("shoujo academy: bosses", () => {
  test("student council president: every pattern of all three phases, rules on their own clock", () => {
    const { w, e, states } = bossRun("council_president");
    const rules = new Set<number>();
    step(w, 40, () => {
      states.add(e.state);
      const r = activeRule(w);
      if (r) rules.add(r.rule);
    });
    for (const s of [CP_DENIED, CP_GLINT, CP_GLARE, CP_SUMMON]) expect(states.has(s), `p1 state ${s}`).toBe(true);
    expect(alive(w, "hall_monitor").length).toBeGreaterThan(0);
    expect(rules.size).toBeGreaterThanOrEqual(2);
    e.hp = e.maxHp * 0.45;
    states.clear();
    step(w, 25, () => states.add(e.state));
    expect(presidentState(e)!.phase).toBe(2);
    expect(states.has(CP_FLOURISH) && states.has(CP_DENIED) && states.has(CP_SUMMON)).toBe(true);
    expect(alive(w, "council_ninja").length).toBeGreaterThan(0);
    e.hp = e.maxHp * 0.15;
    states.clear();
    step(w, 25, () => states.add(e.state));
    expect(presidentState(e)!.phase).toBe(3);
    expect(states.has(CP_SPIRAL) && states.has(CP_SWEEP)).toBe(true);
    w.hitEnemy(e, e.maxHp * 3, null, 0, 0, 0, "test", 0xffffff);
    expect(e.dead).toBe(true);
    expect(activeRule(w)).toBeNull();
    expect(w.phase).toBe("play");
  });

  test("school regulation: RULE 7 fines each dash 8 HP, RULE 12 punishes loitering", () => {
    const { w, e } = bossRun("council_president");
    mortal(w, true);
    const s = presidentState(e)!;
    step(w, 2.5); // past the entrance
    s.ruleNext = 99;
    s.rule = 7;
    s.ruleT = 10;
    const hp0 = w.player.hp;
    w.input.mx = 1;
    w.input.dash = true;
    step(w, DT);
    expect(hp0 - w.player.hp).toBe(8);
    s.rule = 12;
    s.ruleT = 10;
    w.input.mx = 0;
    w.player.vx = w.player.vy = 0;
    w.player.iframes = 0;
    w.player.dashInv = 0;
    const hp1 = w.player.hp;
    let hit = false;
    w.hooks.on("hurt", () => (hit = true));
    step(w, 1.8, () => {
      w.bullets.clear();
      e.x = 0;
      e.y = -150; // out of reach: only the rule can hurt
    });
    expect(hit).toBe(true);
    expect(w.player.hp).toBeLessThan(hp1);
  });

  test("the bishounen: never aims at you in phases 1-2, aims everything in phase 3", () => {
    const { w, e, states } = bossRun("bishounen");
    let flipChecked = 0;
    w.bus.on("stageCue", (c) => {
      if (c.kind !== "academy_flip") return;
      const toYou = Math.atan2(w.player.y - 8 - (bishBodyY(e) - 14), w.player.x - e.x);
      expect(Math.abs(angDiff(Math.atan2(c.y2, c.x2), toYou))).toBeGreaterThanOrEqual((30 * Math.PI) / 180 - 1e-6);
      flipChecked++;
    });
    let facedAway = true;
    step(w, 40, () => {
      states.add(e.state);
      if (Math.sign(w.player.x - e.x) * e.face > 0 && Math.abs(w.player.x - e.x) > 2) facedAway = false;
    });
    expect(facedAway).toBe(true);
    expect(flipChecked).toBeGreaterThan(0);
    for (const s of [BS_FLIP, BS_RAIN, BS_FANCLUB, BS_WIND]) expect(states.has(s), `p1 state ${s}`).toBe(true);
    expect(alive(w, "love_letter").length).toBeGreaterThan(0); // his fan club notices you
    e.hp = e.maxHp * 0.55;
    states.clear();
    step(w, 40, () => states.add(e.state));
    expect(bishState(e)!.phase).toBe(2);
    for (const s of [BS_PHONE, BS_SPIRAL, BS_STORM]) expect(states.has(s), `p2 state ${s}`).toBe(true);
    e.hp = e.maxHp * 0.2;
    states.clear();
    let facing = 0;
    step(w, 25, () => {
      states.add(e.state);
      if (e.state !== 14 && Math.sign(w.player.x - e.x) * e.face > 0) facing++;
    });
    expect(bishState(e)!.phase).toBe(3);
    expect(facing).toBeGreaterThan(0); // ...he noticed you
    for (const s of [BS_HEART, BS_FAN7, BS_RING]) expect(states.has(s), `p3 state ${s}`).toBe(true);
    expect(e.def.frame!(e)).toBe(5);
  });

  test("dramatic wind pushes the player along its lane", () => {
    const { w, e } = bossRun("bishounen");
    const s = bishState(e)!;
    step(w, 60, () => {
      if (e.state === BS_WIND && e.timer < 0.05) {
        const x0 = w.player.x;
        w.player.y = s.laneY;
        w.step(DT * 10);
        expect(Math.sign(w.player.x - x0)).toBe(s.push);
      }
    });
  });

  test("the bishounen's death clears the stage", () => {
    const w = new World({ hero: "hoshi", seed: 9, god: true, run: defaultRunConfig({ stage: "shoujo_academy" }) });
    simulate(w, 20, DT, new Bot(2));
    w.director.warnBoss(BOSSES.get("bishounen")!, 0.4);
    w.director.warning!.t = 0;
    simulate(w, 2, DT, new Bot(2));
    const b = w.boss!;
    expect(b.def.id).toBe("bishounen");
    b.inv = 0;
    w.hitEnemy(b, b.maxHp * 3, null, 0, 0, 0, "test", 0xffffff);
    expect(w.stageCleared).toBe(true);
    expect(w.phase).toBe("victory");
  });

  test("endless: the Filler Arc continues with president / bishounen rematches", () => {
    const w = new World({ hero: "hoshi", seed: 9, god: true, run: defaultRunConfig({ stage: "shoujo_academy", endless: true }) });
    simulate(w, 20, DT, new Bot(2));
    w.director.warnBoss(BOSSES.get("bishounen")!, 0.4);
    w.director.warning!.t = 0;
    simulate(w, 2, DT, new Bot(2));
    const b = w.boss!;
    b.inv = 0;
    w.hitEnemy(b, b.maxHp * 3, null, 0, 0, 0, "test", 0xffffff);
    expect(w.stageCleared).toBe(true);
    expect(w.endlessOn).toBe(true);
    const rematches: string[] = [];
    w.bus.on("fillerWave", (e) => {
      if (e.kind === "boss") rematches.push(e.id);
    });
    simulate(w, 260, DT, new Bot(2), (ww) => {
      const bb = ww.boss;
      if (bb && !bb.dead && bb.t > 5) {
        bb.inv = 0;
        ww.hitEnemy(bb, bb.maxHp * 3, null, 0, 0, 0, "test", 0xffffff);
      }
    });
    expect(w.phase).toBe("play");
    expect(rematches).toEqual(["council_president", "bishounen"]);
  });
});

describe("shoujo academy: full runs", () => {
  test("a god-mode bot run clears the whole stage", () => {
    const w = new World({ hero: "hoshi", seed: 12, maxEnemies: 250, god: true, run: defaultRunConfig({ stage: "shoujo_academy" }) });
    simulate(w, 920, DT, new Bot(4), (ww) => {
      const b = ww.boss;
      if (b && !b.dead && b.t > 25) ww.hitEnemy(b, b.maxHp * 0.004, null, 0, 0, 0, "test", 0xffffff);
    });
    expect(w.stageCleared).toBe(true);
    expect(w.phase).toBe("victory");
    expect(w.bullets.count).toBeLessThanOrEqual(CFG.maxBullets);
  });

  test("a mortal bot run plays out without exceptions", () => {
    for (const hero of ["rin", "mochi"]) {
      const w = new World({ hero, seed: 22, maxEnemies: 250, run: defaultRunConfig({ stage: "shoujo_academy" }) });
      simulate(w, 880, DT, new Bot(8));
      expect(["play", "dead", "victory"]).toContain(w.phase);
      expect(w.t).toBeGreaterThan(30);
    }
  });
});
