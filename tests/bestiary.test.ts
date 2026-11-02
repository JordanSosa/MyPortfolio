/**
 * Bestiary: the four late enemies behave as designed, both bosses arrive on
 * the timeline, cycle through every pattern / phase headless without
 * exceptions and die; Lady Lunatic's death is the victory; enrage at 10:30;
 * enemy-bullet hygiene (cap, culling, bomb clears, fair spawns).
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import { EFX_STOMP } from "../src/game/enemies/_fx";
import { SAFE_SPAWN } from "../src/game/enemies/_bullets";
import { LL_BATS, LL_FANS, LL_FLOWER, LL_SPIRAL, LL_STARFALL, LL_TELE_IN, LL_TELE_OUT, LUNA_RING_N, lunaRing, lunaState } from "../src/game/bosses/lady-lunatic";
import { NT_CHARGE, NT_ROAR, NT_SPIRAL, NT_SWEEP, NT_SWEEP_TELE, NT_WINDUP, teddyState } from "../src/game/bosses/nightmare-teddy";
import type { Enemy } from "../src/game/types";
import { PLAYER_CY, World } from "../src/game/world";

const DT = 1 / 30;

function alive(w: World, id: string): Enemy[] {
  const out: Enemy[] = [];
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i];
    if (!e.dead && e.def.id === id) out.push(e);
  }
  return out;
}

/** A quiet sandbox: no director, no weapons (enemies are only hurt by the test). */
function sandbox(opts: { god?: boolean; seed?: number } = {}): World {
  const w = new World({ hero: "hoshi", seed: opts.seed ?? 7, director: false, god: opts.god ?? false });
  for (const inst of w.weapons) inst.def.dispose?.(w, inst);
  w.weapons.length = 0;
  return w;
}

/** Track every enemy bullet spawned: none may appear within SAFE_SPAWN of the player's body. */
function watchFairSpawns(w: World): { n: number; unfair: number } {
  const s = { n: 0, unfair: 0 };
  w.bus.on("enemyShoot", (e) => {
    s.n++;
    const dx = e.x - w.player.x;
    const dy = e.y - (w.player.y - PLAYER_CY);
    if (Math.sqrt(dx * dx + dy * dy) < SAFE_SPAWN - 0.01) s.unfair++;
  });
  return s;
}

describe("enemies", () => {
  test("eyepuff keeps its distance, charges (frame 3) and then shoots eb_orbs", () => {
    const w = sandbox({ god: true });
    const e = w.spawnEnemy("eyepuff", 60, 0)!;
    const fair = watchFairSpawns(w);
    let chargedBeforeShot = false;
    let firstShot = -1;
    let minD = 1e9;
    for (let i = 0; i < 8 / DT; i++) {
      w.step(DT);
      if (e.state === 1) {
        expect(e.def.frame!(e)).toBe(3);
        if (firstShot < 0) chargedBeforeShot = true;
      }
      if (firstShot < 0 && w.bullets.count > 0) firstShot = w.t;
      if (w.t > 3) minD = Math.min(minD, Math.hypot(e.x - w.player.x, e.y - w.player.y));
    }
    expect(firstShot).toBeGreaterThan(0);
    expect(chargedBeforeShot).toBe(true);
    expect(fair.n).toBeGreaterThanOrEqual(2);
    expect(fair.unfair).toBe(0);
    expect(minD).toBeGreaterThan(55); // hovers ~90 px away instead of rushing in
    expect(w.bullets.items[0].sprite).toBe("eb_orb");
  });

  test("eyepuff elites fan 5 shots", () => {
    const w = sandbox({ god: true });
    w.spawnEnemy("eyepuff", 90, 0, true);
    let maxBurst = 0;
    let burst = 0;
    w.bus.on("enemyShoot", () => burst++);
    for (let i = 0; i < 6 / DT; i++) {
      burst = 0;
      w.step(DT);
      maxBurst = Math.max(maxBurst, burst);
    }
    expect(maxBurst).toBe(5);
  });

  test("pumpkin telegraphs a lane, dashes ~180 px/s along it, then skids", () => {
    const w = sandbox({ god: true });
    const e = w.spawnEnemy("pumpkin", 70, 10)!;
    let lanes = 0;
    w.bus.on("telegraph", () => lanes++);
    const seen = new Set<number>();
    let dashSpeed = 0;
    let px = e.x;
    let py = e.y;
    let order = "";
    for (let i = 0; i < 6 / DT; i++) {
      w.step(DT);
      if (!seen.has(e.state)) {
        seen.add(e.state);
        order += e.state;
      }
      const sp = Math.hypot(e.x - px, e.y - py) / DT;
      if (e.state === 2) dashSpeed = Math.max(dashSpeed, sp);
      px = e.x;
      py = e.y;
    }
    expect(order.startsWith("0123")).toBe(true);
    expect(lanes).toBeGreaterThanOrEqual(1);
    expect(w.telegraphs.count + lanes).toBeGreaterThan(0);
    expect(dashSpeed).toBeGreaterThan(150);
    expect(dashSpeed).toBeLessThan(230);
  });

  test("teddy brute resists 70% of knockback and stomps", () => {
    const w = sandbox({ god: true });
    const t = w.spawnEnemy("teddy", 200, 0)!;
    const p = w.spawnEnemy("puff", 200, 60)!;
    t.hp = p.hp = 1e6;
    w.stats.crit = 0;
    w.hitEnemy(t, 1, null, 0, 100, 0, "test", 0xffffff);
    w.hitEnemy(p, 1, null, 0, 100, 0, "test", 0xffffff);
    expect(t.kx / p.kx).toBeCloseTo(0.3, 2);
    const w2 = sandbox({ god: true });
    let stomps = 0;
    w2.bus.on("enemyFx", (e) => e.kind === EFX_STOMP && stomps++);
    w2.spawnEnemy("teddy", 50, 0);
    for (let i = 0; i < 4 / DT; i++) w2.step(DT);
    expect(stomps).toBeGreaterThanOrEqual(3);
  });

  test("candle wisp ignites, explodes on the player (hurts) and is gone", () => {
    const w = sandbox();
    const e = w.spawnEnemy("wisp", 70, -8)!;
    let hurt = 0;
    let booms = 0;
    let fuseSeen = false;
    w.bus.on("playerHurt", () => hurt++);
    w.bus.on("explosion", (x) => x.source === "wisp" && booms++);
    for (let i = 0; i < 4 / DT && !e.dead; i++) {
      w.step(DT);
      if (e.state === 1) fuseSeen = true;
    }
    expect(fuseSeen).toBe(true);
    expect(e.dead).toBe(true);
    expect(booms).toBe(1);
    expect(hurt).toBe(1);
    expect(w.player.hp).toBeLessThan(w.player.maxHp);
    expect(w.kills).toBe(0); // kamikaze: no credit
  });

  test("killing a calm wisp is safe for the player but chain-reacts through its pack", () => {
    const w = sandbox();
    const pack: Enemy[] = [];
    for (let i = 0; i < 5; i++) pack.push(w.spawnEnemy("wisp", 150 + i * 9, 150)!);
    w.step(DT);
    w.hitEnemy(pack[0], 999, null, 0, 0, 0, "test", 0xffffff);
    expect(pack.every((e) => e.dead)).toBe(true);
    expect(w.player.hp).toBe(w.player.maxHp);
    // and an ignited wisp killed point-blank does hurt (it was telegraphed)
    const w2 = sandbox();
    const e = w2.spawnEnemy("wisp", 0, 14)!;
    w2.step(DT);
    expect(e.state).toBe(1);
    let hurt = 0;
    w2.bus.on("playerHurt", () => hurt++);
    w2.hitEnemy(e, 999, null, 0, 0, 0, "test", 0xffffff);
    expect(hurt).toBe(1);
  });

  test("all four have elite variants", () => {
    const w = sandbox({ god: true });
    for (const id of ["eyepuff", "pumpkin", "teddy", "wisp"]) {
      const e = w.spawnEnemy(id, 120, 0, true)!;
      expect(e.elite).toBe(true);
      expect(e.scale).toBe(CFG.elite.scale);
      expect(e.maxHp).toBeGreaterThan(e.def.hp * 5);
    }
    for (let i = 0; i < 3 / DT; i++) w.step(DT);
  });
});

describe("bosses", () => {
  test("Nightmare Teddy cycles charge x3, claw sweep, star spiral and roar; rages at 50%; dies", () => {
    const w = sandbox({ god: true });
    const e = w.spawnEnemy("nightmare_teddy", 0, -150)!;
    w.boss = e;
    e.maxHp = e.hp = 1e7;
    const fair = watchFairSpawns(w);
    const bot = new Bot(3);
    const seen = new Set<number>();
    let charges = 0;
    let prev = -1;
    let phases = 0;
    w.bus.on("bossPhase", () => phases++);
    for (let i = 0; i < 45 / DT; i++) {
      bot.think(w, w.input, DT);
      w.step(DT);
      seen.add(e.state);
      if (e.state === NT_CHARGE && prev !== NT_CHARGE) charges++;
      prev = e.state;
    }
    for (const s of [NT_WINDUP, NT_CHARGE, NT_SWEEP_TELE, NT_SWEEP, NT_SPIRAL, NT_ROAR]) expect(seen.has(s)).toBe(true);
    expect(charges).toBeGreaterThanOrEqual(3);
    expect(alive(w, "teddy").length + alive(w, "puff").length).toBeGreaterThanOrEqual(4); // roar summons
    expect(fair.n).toBeGreaterThan(40);
    expect(fair.unfair).toBe(0);
    expect(phases).toBe(0);
    // rage
    e.hp = e.maxHp * 0.45;
    w.step(DT);
    expect(teddyState(e)!.rage).toBe(true);
    expect(phases).toBe(1);
    expect(e.inv).toBeGreaterThan(0);
    for (let i = 0; i < 20 / DT; i++) {
      bot.think(w, w.input, DT);
      w.step(DT);
    }
    e.inv = 0;
    expect(w.hitEnemy(e, 1e8, null, 0, 0, 0, "test", 0xffffff)).toBe(true);
    expect(w.boss).toBeNull();
  });

  test("Lady Lunatic: P1 spirals/fans/teleports, P2 moon ring + bats + starfall, P3 flowers; fair; death = victory", () => {
    const w = sandbox({ god: true, seed: 11 });
    const e = w.spawnEnemy("lady_lunatic", 0, -200)!;
    w.boss = e;
    e.maxHp = e.hp = 1e7;
    const fair = watchFairSpawns(w);
    const bot = new Bot(9);
    const phaseEv: number[] = [];
    let cleared = 0;
    w.bus.on("bossPhase", (p) => phaseEv.push(p.phase));
    w.bus.on("bulletsCleared", () => cleared++);
    let maxBullets = 0;
    const run = (sec: number, seen: Set<number>) => {
      for (let i = 0; i < sec / DT; i++) {
        bot.think(w, w.input, DT);
        w.step(DT);
        seen.add(e.state);
        maxBullets = Math.max(maxBullets, w.bullets.count);
        // bullets are slow-ish (<= 90 px/s, starfall / flowers / enrage included)
        for (let b = 0; b < w.bullets.count; b++) {
          const bb = w.bullets.items[b];
          expect(Math.hypot(bb.vx, bb.vy)).toBeLessThanOrEqual(90.5);
        }
      }
    };
    const p1 = new Set<number>();
    run(30, p1);
    for (const s of [LL_SPIRAL, LL_FANS, LL_TELE_OUT, LL_TELE_IN]) expect(p1.has(s)).toBe(true);
    expect(lunaState(e)!.phase).toBe(1);
    // P2
    e.hp = e.maxHp * 0.55;
    const p2 = new Set<number>();
    run(4, p2);
    expect(lunaState(e)!.phase).toBe(2);
    const t = { x: 0, y: 0 };
    expect(lunaRing(e, 0, t)).toBe(true);
    let ringSpread = 0;
    for (let i = 0; i < LUNA_RING_N; i++) {
      lunaRing(e, i, t);
      ringSpread = Math.max(ringSpread, Math.hypot(t.x - e.x, t.y - (e.y - e.z - 30)));
    }
    expect(ringSpread).toBeGreaterThan(5);
    run(40, p2);
    for (const s of [LL_BATS, LL_STARFALL, LL_FANS]) expect(p2.has(s)).toBe(true);
    // P3
    e.hp = e.maxHp * 0.2;
    const p3 = new Set<number>();
    run(35, p3);
    expect(lunaState(e)!.phase).toBe(3);
    expect(p3.has(LL_FLOWER)).toBe(true);
    // enraged (10:30 rule): faster and denser, still within the speed / fairness limits
    w.director.enraged = true;
    run(25, new Set<number>());
    expect(phaseEv).toEqual([2, 3]);
    expect(cleared).toBeGreaterThanOrEqual(1); // each flourish clears the screen
    expect(fair.unfair).toBe(0);
    expect(fair.n).toBeGreaterThan(200);
    expect(maxBullets).toBeLessThanOrEqual(CFG.maxBullets);
    // death -> victory (other enemies dissolve, bullets cleared)
    let victory = 0;
    let killed = 0;
    w.bus.on("victory", () => victory++);
    w.bus.on("bossKilled", (k) => k.final && killed++);
    w.spawnEnemy("puff", 40, 40);
    e.inv = 0;
    w.hitEnemy(e, 1e8, null, 0, 0, 0, "test", 0xffffff);
    expect(killed).toBe(1);
    expect(victory).toBe(1);
    expect(w.phase).toBe("victory");
    expect(w.bullets.count).toBe(0);
    expect(alive(w, "puff").length).toBe(0);
  });

  test("timeline: Nightmare Teddy at 6:00, Lady Lunatic at 9:00, enrage at 10:30, her death wins the run", () => {
    const w = new World({ hero: "rin", seed: 21, god: true });
    const spawns: { id: string; t: number }[] = [];
    let enrage = 0;
    w.bus.on("bossSpawn", (e) => spawns.push({ id: e.enemy.def.id, t: w.t }));
    w.bus.on("bossEnrage", () => enrage++);
    const bot = new Bot(21);
    let maxBullets = 0;
    simulate(w, 548, DT, bot, () => {
      maxBullets = Math.max(maxBullets, w.bullets.count);
    });
    const ids = spawns.map((s) => s.id);
    expect(ids).toContain("king_puff");
    expect(ids).toContain("nightmare_teddy");
    expect(ids).toContain("lady_lunatic");
    const nt = spawns.find((s) => s.id === "nightmare_teddy")!;
    const ll = spawns.find((s) => s.id === "lady_lunatic")!;
    expect(nt.t).toBeGreaterThanOrEqual(360 + CFG.bossWarningTime - 0.1);
    expect(nt.t).toBeLessThan(366);
    expect(ll.t).toBeGreaterThanOrEqual(540 + CFG.bossWarningTime - 0.1);
    expect(maxBullets).toBeLessThanOrEqual(CFG.maxBullets);
    expect(w.phase).toBe("play");
    // keep her alive until 10:30 -> enrage
    const lady = w.boss!;
    expect(lady.def.id).toBe("lady_lunatic");
    lady.maxHp = lady.hp = 1e8;
    simulate(w, 640 - w.t, DT, bot);
    expect(enrage).toBe(1);
    expect(w.director.enraged).toBe(true);
    expect(w.boss).toBe(lady);
    // kill her -> victory
    let victory = 0;
    w.bus.on("victory", () => victory++);
    lady.inv = 0; // (she may be mid-teleport)
    w.hitEnemy(lady, 1e9, null, 0, 0, 0, "test", 0xffffff);
    expect(victory).toBe(1);
    expect(w.phase).toBe("victory");
    expect(w.summary().victory).toBe(true);
  });
});

describe("bullet hygiene", () => {
  test("cap, off-screen culling, bomb + ultimate clear the screen", () => {
    const w = sandbox({ god: true });
    for (let i = 0; i < 600; i++) w.spawnBullet(40 + (i % 30), -40 - Math.floor(i / 30), 0, 0, 5, "eb_orb", 3, 30);
    expect(w.bullets.count).toBe(CFG.maxBullets);
    // far away bullets are culled
    const far = w.bullets.items[0];
    far.x = w.player.x + w.viewW;
    w.step(DT);
    expect(w.bullets.count).toBe(CFG.maxBullets - 1);
    // bomb pickup clears them (with a sparkle event first)
    let cleared = 0;
    w.bus.on("bulletsCleared", (e) => (cleared = e.n));
    const k = w.dropPickup("bomb", w.player.x, w.player.y);
    k.vx = k.vy = 0;
    k.vz = 0;
    k.z = 0;
    k.t = 0.4;
    w.step(DT);
    expect(cleared).toBeGreaterThan(300);
    expect(w.bullets.count).toBe(0);
    // ultimate start clears too
    for (let i = 0; i < 20; i++) w.spawnBullet(60, i * 3, 0, 0, 5, "eb_star", 3, 30);
    w.addUlt(100);
    w.input.ult = true;
    for (let i = 0; i < Math.ceil(CFG.cutinTime / DT) + 2; i++) w.step(DT);
    expect(w.bullets.count).toBe(0);
  });

  test("invulnerable enemies ignore hits", () => {
    const w = sandbox({ god: true });
    const e = w.spawnEnemy("teddy", 100, 0)!;
    e.inv = 1;
    const hp = e.hp;
    expect(w.hitEnemy(e, 9999, null, 0, 50, 0, "test", 0xffffff)).toBe(false);
    expect(e.hp).toBe(hp);
    for (let i = 0; i < 1.1 / DT; i++) w.step(DT);
    expect(e.inv).toBe(0);
    expect(w.hitEnemy(e, 9999, null, 0, 50, 0, "test", 0xffffff)).toBe(true);
  });
});
