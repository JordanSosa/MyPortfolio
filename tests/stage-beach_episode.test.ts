/**
 * Beach Episode (stage 4, docs/content/stages.md §3, enemies.md §3 / §5.5-5.6):
 * the stage registers with the bible's data, its timeline spawns its roster,
 * every enemy twist works (sidestep, thief, zap + chain, split, rebuild, fin
 * mode, the tide), Kraken-chan and the Firework Dragon cycle every phase and
 * die headless, the dragon's death clears the stage (or starts the Filler
 * Arc), and a full headless bot run completes without exceptions.
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { EVENT_HANDLERS } from "../src/game/director/events";
import { tideBands } from "../src/game/director/events-s45";
import { BX_SIDESTEP, envOf } from "../src/game/enemies/_s45";
import { CRAB_LUNGE_PX } from "../src/game/enemies/crab-kun";
import { GOLEM_PILE, PILE_TIME } from "../src/game/enemies/sandcastle-golem";
import { SG_COIN } from "../src/game/enemies/seagull";
import { BOSSES, ENEMIES, STAGES } from "../src/game/registry";
import { defaultRunConfig } from "../src/game/run-config";
import { stageBosses, stageEnemies, stageInfo } from "../src/game/stage";
import { beachEpisode } from "../src/game/stages/beach-episode";
import { PK_FREE, type Enemy } from "../src/game/types";
import { KR_HUG, KR_INK, KR_RING, KR_SLAM, KR_WHIRL, krakenState } from "../src/game/bosses/kraken-chan";
import { FD_BREATH, FD_DANCE, FD_FINALE, FD_VOLLEY, dragonState } from "../src/game/bosses/firework-dragon";
import { World } from "../src/game/world";

const DT = 1 / 30;
const ROSTER = ["crab_kun", "seagull", "jellyfish", "watermelon", "sandcastle_golem", "tiny_shark"];

/** A quiet beach: no director, no weapons, god mode (enemies are only hurt by the test). */
function sandbox(opts: { seed?: number; god?: boolean; endless?: boolean } = {}): World {
  const w = new World({ hero: "hoshi", seed: opts.seed ?? 5, director: false, god: opts.god ?? true, run: defaultRunConfig({ stage: "beach_episode", endless: opts.endless ?? false }) });
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

/** Spawn a boss the way the director does (w.boss set: the HUD bar, the final-boss rules). */
function spawnBoss(w: World, id: string): Enemy {
  const e = w.spawnEnemy(id, w.player.x, w.player.y - 90)!;
  w.boss = e;
  return e;
}

describe("Beach Episode: registry + data", () => {
  test("registers with the bible's numbers, roster, bosses, props and look", () => {
    expect(STAGES.get("beach_episode")).toBe(beachEpisode);
    const info = stageInfo(beachEpisode);
    expect(info).toMatchObject({ id: "beach_episode", order: 4, duration: 960, rewardMul: 5, requires: "shoujo_academy", finalBoss: "firework_dragon" });
    expect(stageBosses(beachEpisode)).toEqual(["kraken_chan", "firework_dragon"]);
    expect(beachEpisode.enrageAt).toBe(990);
    expect(beachEpisode.bpm).toBe(128);
    expect(beachEpisode.music).toEqual({ battle: "beach", boss: "boss_beach", final: "boss_beach" });
    expect(stageEnemies(beachEpisode)).toEqual(expect.arrayContaining(ROSTER));
    for (const id of ROSTER) expect(ENEMIES.get(id), id).toBeDefined();
    for (const id of ["kraken_chan", "firework_dragon"]) expect(BOSSES.get(id)?.boss, id).toBeDefined();
    expect(BOSSES.get("firework_dragon")!.boss!.final).toBe(true);
    for (const id of beachEpisode.props.ids!) expect(ENEMIES.get(id)?.prop, id).toBe(true);
    expect(beachEpisode.events.filter((e) => e.kind === "boss").map((e) => [e.at, e.enemy])).toEqual([
      [480, "kraken_chan"],
      [900, "firework_dragon"],
    ]);
    // every event kind has a handler
    for (const ev of beachEpisode.events) expect(EVENT_HANDLERS[ev.kind], ev.kind).toBeTypeOf("function");
    expect(beachEpisode.endless.rematches).toEqual(["kraken_chan", "firework_dragon"]);
  });
});

describe("Beach Episode: enemies", () => {
  test("Crab-kun strafes around the hero, lunges when lined up, and sidesteps projectiles (20 %, max 1/s)", () => {
    const w = sandbox();
    const e = w.spawnEnemy("crab_kun", w.player.x + 70, w.player.y + 30)!;
    let lunges = 0;
    let dodges = 0;
    let shots = 0;
    let hits = 0;
    w.bus.on("enemyFx", (f) => {
      if (f.kind === BX_SIDESTEP) dodges++;
    });
    w.hooks.on("hit", (h) => {
      if (h.enemy === e) hits++;
    });
    let maxD = 0;
    let minD = 1e9;
    let prev = -1;
    steps(w, 30, () => {
      if (e.state === 2 && prev !== 2) lunges++;
      prev = e.state;
      if (w.t > 4) {
        const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
        maxD = Math.max(maxD, d);
        minD = Math.min(minD, d);
      }
      // a straight shot at it every 0.25 s
      if (w.steps % 8 === 0) {
        const p = w.spawnProjectile(null, "test");
        p.kind = PK_FREE;
        p.x = w.player.x;
        p.y = w.player.y - 8;
        const a = Math.atan2(e.y - e.cy - p.y, e.x - p.x);
        p.vx = Math.cos(a) * 160;
        p.vy = Math.sin(a) * 160;
        p.r = 3;
        p.dmg = 0.001;
        p.life = 2;
        p.pierce = 1;
        shots++;
      }
      e.hp = e.maxHp;
    });
    expect(lunges).toBeGreaterThan(2);
    expect(minD).toBeLessThan(60);
    expect(maxD).toBeLessThan(120);
    expect(dodges).toBeGreaterThan(1);
    expect(dodges).toBeLessThanOrEqual(31);
    expect(hits).toBeGreaterThan(dodges);
    void shots;
    void CRAB_LUNGE_PX;
  });

  test("Seagull: dives through the hero's spot, steals a resting coin, drops it back + 1 coin when shot down", () => {
    const w = sandbox();
    const g = w.spawnEnemy("seagull", w.player.x + 40, w.player.y - 30)!;
    let dived = false;
    steps(w, 6, () => {
      if (g.state === 2) dived = true;
    });
    expect(dived).toBe(true);
    // a coin right under it
    const c = w.dropPickup("coin", g.x, g.y, 3);
    c.vx = c.vy = c.vz = 0;
    c.z = 0;
    g.state = 0;
    g.timer = 5;
    steps(w, 0.3);
    expect(c.dead).toBe(true);
    expect(g.b).toBe(SG_COIN);
    expect(g.state).toBe(4);
    const before = w.pickups.count;
    w.hitEnemy(g, 1e6, null, 0, 0, 0, "test", 0);
    expect(w.pickups.count).toBeGreaterThanOrEqual(before + 2);
  });

  test("Jellyfish: telegraphed zap pulse (8 dmg + slow) and a death chain to its neighbours", () => {
    const w = sandbox({ god: false });
    const j = w.spawnEnemy("jellyfish", w.player.x + 12, w.player.y)!;
    j.timer = 0.1;
    let zapped = false;
    steps(w, 1.2, () => {
      if (w.damageTaken > 0) zapped = true;
      j.x = w.player.x + 12;
      j.y = w.player.y;
    });
    expect(zapped).toBe(true);
    expect(envOf(w).timedT).toBeGreaterThan(0);
    const a = w.spawnEnemy("jellyfish", 400, 400)!;
    const b = w.spawnEnemy("jellyfish", 430, 410)!;
    const far = w.spawnEnemy("jellyfish", 600, 600)!;
    const hb = b.hp;
    w.hitEnemy(a, 1e6, null, 0, 0, 0, "test", 0);
    expect(b.hp).toBeLessThan(hb);
    expect(Math.round(hb - b.hp)).toBeGreaterThanOrEqual(Math.floor(b.maxHp * 0.3) - 1);
    expect(far.hp).toBe(far.maxHp);
  });

  test("Watermelon rolls on a lane, splits into 2 halves (Prize Melon: 4) that spit eb_seed fans", () => {
    const w = sandbox();
    const m = w.spawnEnemy("watermelon", w.player.x + 80, w.player.y)!;
    let rolled = false;
    steps(w, 5, () => {
      if (m.state === 2) rolled = true;
    });
    expect(rolled).toBe(true);
    w.hitEnemy(m, 1e6, null, 0, 0, 0, "test", 0);
    w.step(DT);
    expect(alive(w, "watermelon_half").length).toBe(2);
    const big = w.spawnEnemy("watermelon", w.player.x - 80, w.player.y, true)!;
    w.hitEnemy(big, 1e9, null, 0, 0, 0, "test", 0);
    w.step(DT);
    expect(alive(w, "watermelon_half").length).toBe(6);
    let seeds = 0;
    steps(w, 4, () => {
      for (let i = 0; i < w.bullets.count; i++) if (w.bullets.items[i].sprite === "eb_seed") seeds = Math.max(seeds, 1);
    });
    expect(seeds).toBe(1);
    // halves never split again
    for (const h of alive(w, "watermelon_half")) w.hitEnemy(h, 1e6, null, 0, 0, 0, "test", 0);
    w.step(DT);
    expect(alive(w, "watermelon_half").length).toBe(0);
  });

  test("Sandcastle Golem: collapses into a pile, rebuilds at 50 % unless stomped or blasted; XP only on the final death", () => {
    const w = sandbox();
    const g = w.spawnEnemy("sandcastle_golem", w.player.x + 60, w.player.y)!;
    const kills0 = w.kills;
    w.hitEnemy(g, 1e6, null, 0, 0, 0, "test", 0);
    expect(g.dead).toBe(false);
    expect(g.state).toBe(GOLEM_PILE);
    expect(g.untargetable).toBe(true);
    expect(w.nearestEnemy(g.x, g.y, 50)).toBe(null);
    expect(w.gems.count).toBe(0);
    steps(w, PILE_TIME + 0.2);
    expect(g.state).toBe(0);
    expect(g.hp).toBe(Math.round(g.maxHp * 0.5));
    // (it rises with a short invulnerable flourish) second death: no rebuild left -> a real kill with its XP
    steps(w, 0.6);
    w.hitEnemy(g, 1e6, null, 0, 0, 0, "test", 0);
    expect(g.dead).toBe(true);
    expect(w.kills).toBe(kills0 + 1);
    expect(w.gems.count).toBeGreaterThan(0);
    // stomp: walk over the pile
    const s = w.spawnEnemy("sandcastle_golem", w.player.x + 40, w.player.y)!;
    w.hitEnemy(s, 1e6, null, 0, 0, 0, "test", 0);
    w.player.x = s.x;
    w.player.y = s.y;
    w.step(DT);
    expect(s.dead).toBe(true);
    // blast: an explosion over the pile crumbles it
    const b = w.spawnEnemy("sandcastle_golem", w.player.x + 90, w.player.y, true)!;
    w.hitEnemy(b, 1e9, null, 0, 0, 0, "test", 0);
    expect(b.state).toBe(GOLEM_PILE);
    w.explode(b.x, b.y - 4, 20, 1, null, 0, "test", 0);
    expect(b.dead).toBe(true);
  });

  test("Tiny Shark is a fin (no auto-aim, no contact) until it surfaces near the hero and chomps", () => {
    const w = sandbox({ god: false });
    const s = w.spawnEnemy("tiny_shark", w.player.x + 90, w.player.y)!;
    expect(s.untargetable).toBe(true);
    expect(w.nearestEnemy(w.player.x, w.player.y, 200)).toBe(null);
    let surfaced = false;
    steps(w, 4, () => {
      if (s.state >= 1) {
        surfaced = true;
        expect(s.untargetable).toBe(false);
      }
    });
    expect(surfaced).toBe(true);
  });

  test("tideSweep: a water band crosses the view, slowing the hero 40 % and carrying enemies", () => {
    const w = sandbox();
    const e = w.spawnEnemy("crab_kun", w.player.x, w.player.y + 2)!;
    EVENT_HANDLERS.tideSweep(w, w.director, { at: 0, kind: "tideSweep", duration: 6, speed: 40 });
    expect(tideBands(w).some((b) => b.on)).toBe(true);
    let slowed = false;
    for (let i = 0; i < 8 / DT; i++) {
      w.director.update(DT);
      w.step(DT);
      if (envOf(w).slowNow < 0.7) slowed = true;
    }
    expect(slowed).toBe(true);
    expect(tideBands(w).every((b) => !b.on)).toBe(true);
    void e;
  });
});

describe("Beach Episode: bosses", () => {
  test("Kraken-chan: tentacle slams, ink spray + puddles, hug lunge; HIGH TIDE at 50 % (whirlpool, tentacle ring, the tide slows); dies", () => {
    const w = sandbox();
    const k = spawnBoss(w, "kraken_chan");
    const seen = new Set<number>();
    const phases: string[] = [];
    w.bus.on("bossPhase", (e) => phases.push(e.title));
    steps(w, 22, () => seen.add(k.state));
    for (const s of [KR_SLAM, KR_INK, KR_HUG]) expect(seen.has(s), `state ${s}`).toBe(true);
    k.hp = k.maxHp * 0.49;
    steps(w, 30, () => seen.add(k.state));
    expect(phases).toEqual(["HIGH TIDE"]);
    for (const s of [KR_WHIRL, KR_RING]) expect(seen.has(s), `state ${s}`).toBe(true);
    const st = krakenState(k)!;
    expect(st.tide).toBe(true);
    expect(st.tideD).toBeGreaterThan(30);
    // the hero wading into the tide is slowed
    w.player.x = st.tideX + w.viewW;
    w.step(DT);
    expect(envOf(w).slowNow).toBeLessThan(0.8);
    w.hitEnemy(k, 1e9, null, 0, 0, 0, "test", 0);
    expect(k.dead).toBe(true);
    expect(w.phase).toBe("play");
  });

  test("Firework Dragon: volley / dance / sparkler breath, GRAND FINALE (EARLY) and ENCORE!!, body contact; its death clears the stage", () => {
    const w = sandbox();
    const d = spawnBoss(w, "firework_dragon");
    const seen = new Set<number>();
    const phases: string[] = [];
    let fireworks = 0;
    let night = false;
    w.bus.on("bossPhase", (e) => phases.push(e.title));
    w.bus.on("stageFx", (e) => {
      if (e.kind === "grade" && e.id === "night") night = true;
    });
    const count = () => {
      seen.add(d.state);
      for (let i = 0; i < w.bullets.count; i++) if (w.bullets.items[i].sprite === "eb_firework") fireworks++;
    };
    steps(w, 20, count);
    for (const s of [FD_VOLLEY, FD_DANCE, FD_BREATH]) expect(seen.has(s), `state ${s}`).toBe(true);
    expect(fireworks).toBeGreaterThan(0);
    d.hp = d.maxHp * 0.55;
    steps(w, 10, count);
    d.hp = d.maxHp * 0.2;
    steps(w, 16, count);
    expect(phases).toEqual(["GRAND FINALE (EARLY)", "ENCORE!!"]);
    expect(night).toBe(true);
    expect(seen.has(FD_FINALE)).toBe(true);
    // the lantern body trails the head
    const s = dragonState(d)!;
    expect(Math.hypot(s.segX[5] - d.x, s.segY[5] - d.y)).toBeGreaterThan(10);
    w.hitEnemy(d, 1e9, null, 0, 0, 0, "test", 0);
    expect(w.stageCleared).toBe(true);
    expect(w.phase).toBe("victory");
  });

  test("endless: the dragon's death starts the Filler Arc and the rematches loop", () => {
    const w = new World({ hero: "rin", seed: 9, god: true, run: defaultRunConfig({ stage: "beach_episode", endless: true }) });
    w.t = 899;
    const ids: string[] = [];
    w.bus.on("bossSpawn", (e) => ids.push(e.enemy.def.id));
    simulate(w, 8, DT, new Bot(2));
    expect(w.boss?.def.id).toBe("firework_dragon");
    w.hitEnemy(w.boss!, 1e9, null, 0, 0, 0, "test", 0);
    expect(w.endlessOn).toBe(true);
    expect(w.phase).toBe("play");
    simulate(w, 130, DT, new Bot(2));
    expect(ids).toContain("kraken_chan");
    expect(w.phase).toBe("play");
  });
});

describe("Beach Episode: a full headless run", () => {
  test("the bot plays 16:00 with the timeline's roster, both bosses fall, the stage clears, no exceptions", () => {
    const w = new World({ hero: "hoshi", seed: 3, maxEnemies: 250, god: true, run: defaultRunConfig({ stage: "beach_episode" }) });
    const seen = new Set<string>();
    const bosses: string[] = [];
    w.bus.on("bossKilled", (e) => bosses.push(e.title));
    simulate(w, 1000, DT, new Bot(2), (ww) => {
      if (ww.steps % 15 === 0) for (let i = 0; i < ww.enemies.count; i++) seen.add(ww.enemies.items[i].def.id);
      // (a fresh default account can't out-damage 160k / 420k bosses: chip them so every phase plays)
      const b = ww.boss;
      if (b && !b.dead && b.t > 25 && ww.steps % 15 === 0) ww.hitEnemy(b, b.maxHp * 0.025, null, 0, 0, 0, "test", 0);
    });
    for (const id of ROSTER) expect(seen.has(id), id).toBe(true);
    expect(bosses).toEqual(["KRAKEN-CHAN", "SUMMER FESTIVAL FIREWORK DRAGON"]);
    expect(w.phase).toBe("victory");
    expect(w.stageCleared).toBe(true);
    expect(w.bullets.count).toBeLessThanOrEqual(400);
  });
});
