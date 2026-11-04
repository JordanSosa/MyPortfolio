/**
 * Run integrity (verification pass): the run can always end, long runs stay
 * bounded, and the unmuted event paths (the ones the live game takes, with a
 * listener on every event) never throw.
 */
import { describe, expect, test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import type { GameEvents } from "../src/game/events";
import { BOSSES } from "../src/game/registry";
import type { Enemy } from "../src/game/types";
import { defaultRunConfig } from "../src/game/run-config";
import { earlyAccountRun } from "./fixtures/account";
import { World } from "../src/game/world";

const DT = 1 / 30;

/** Bring a boss in right now (no WARNING countdown) and return it. */
function bossNow(w: World, id: string): Enemy {
  w.director.warnBoss(BOSSES.get(id)!, 0);
  w.director.warning!.t = 0;
  for (let i = 0; i < 10 && !w.boss; i++) w.step(DT);
  expect(w.boss?.def.id).toBe(id);
  return w.boss!;
}

describe("run integrity", () => {
  test("the final boss falling on the step the player dies: a revive wins the run (never an endless run)", () => {
    const w = new World({ hero: "rin", seed: 3, meta: { revive: 1 } });
    const lady = bossNow(w, "lady_lunatic");
    for (let i = 0; i < 90; i++) w.step(DT);
    // same step: the player dies first, then a weapon lands the killing blow
    w.player.iframes = 0;
    w.hurtPlayer(9999, w.player.x, w.player.y);
    expect(w.phase).toBe("dead");
    lady.inv = 0;
    w.hitEnemy(lady, lady.hp * 2, null, 0, 0, 0, "test", 0xffffff);
    expect(lady.dead).toBe(true);
    expect(w.finalBossDown).toBe(true);
    expect(w.phase).toBe("dead"); // death still shows the DREAM OVER / revive modal first
    let won = 0;
    w.bus.on("victory", () => won++);
    expect(w.revive()).toBe(true);
    w.step(DT);
    expect(w.phase).toBe("victory");
    expect(won).toBe(1);
  });

  test("coins left behind fold into merged coins: bounded list, total value kept", () => {
    const w = new World({ hero: "hoshi", seed: 4, director: false, god: true });
    for (const inst of w.weapons) inst.def.dispose?.(w, inst);
    w.weapons.length = 0;
    let total = 0;
    for (let i = 0; i < 400; i++) {
      const a = i * 2.4;
      const r = 90 + (i % 37) * 9;
      const k = w.dropPickup("coin", w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r, 1 + (i % 3));
      k.vx = k.vy = 0;
      total += k.value;
    }
    for (let i = 0; i < 3 / DT; i++) w.step(DT);
    let coins = 0;
    let value = 0;
    let merged = 0;
    for (let i = 0; i < w.pickups.count; i++) {
      const k = w.pickups.items[i];
      if (k.dead || k.kind !== "coin") continue;
      coins++;
      value += k.value;
      if (k.value > 3) merged++;
    }
    expect(coins).toBeLessThanOrEqual(CFG.coinMergeKeep + 1);
    expect(merged).toBeGreaterThan(0);
    expect(value + w.coins / w.stats.greed).toBeCloseTo(total, 6);
  });

  test("full unmuted run (listener on every event): victory, no exceptions, every list bounded", () => {
    // (the shipped slice's card pool: Season 2 content changes every level-up roll of this frozen seed)
    // (+ an early account's damage: since the verification pass's Dream Meadow retune a no-account hero can't kill
    // Lady Lunatic inside the 15 minutes even in god mode - the test is about a full run to the victory)
    const run = earlyAccountRun({
      weaponPool: ["star_shot", "petal_slash", "yarn_orbit", "heart_boomerang", "thunder_bell", "candy_bomb", "bubble_aura", "prism_beam"],
      passivePool: ["power_bow", "wish_charm", "big_ribbon", "twin_charm", "swift_shoes", "magnet_star", "lucky_clover", "heart_locket"],
    });
    const w = new World({ hero: "mochi", seed: 2, god: true, run });
    // every GameEvents key gets a listener, so every payload is built and delivered
    const seen = new Map<string, number>();
    const keys: (keyof GameEvents)[] = [
      "enemyHit", "enemyKilled", "propBroken", "eliteSpawned", "explosion", "weaponFire", "weaponFx", "enemyShoot", "telegraph", "shockwave",
      "playerHurt", "playerHeal", "playerDied", "playerRevived", "dash", "dashReady", "levelUp", "upgradeApplied", "evolution",
      "gem", "coin", "pickup", "chestDropped", "chestCollected", "chestOpened", "magnet", "bomb", "freeze",
      "comboRank", "comboDrop", "comboBreak", "ultReady", "ultCutin", "ultStart", "ultEnd", "ultSlash", "ultBurst", "ultMeow",
      "waveIncoming", "bossWarning", "bossSpawn", "bossKilled", "bossEnrage", "bossPhase", "enemyFx", "bulletsCleared", "victory",
      "heroFx",
    ];
    for (const k of keys) w.bus.on(k, () => seen.set(k, (seen.get(k) ?? 0) + 1));
    const peak = { enemies: 0, projectiles: 0, bullets: 0, gems: 0, pickups: 0, telegraphs: 0 };
    simulate(w, 900, DT, new Bot(11), (ww) => {
      peak.enemies = Math.max(peak.enemies, ww.enemies.count);
      peak.projectiles = Math.max(peak.projectiles, ww.projectiles.count);
      peak.bullets = Math.max(peak.bullets, ww.bullets.count);
      peak.gems = Math.max(peak.gems, ww.gems.count);
      peak.pickups = Math.max(peak.pickups, ww.pickups.count);
      peak.telegraphs = Math.max(peak.telegraphs, ww.telegraphs.count);
    });
    expect(w.phase).toBe("victory");
    for (const k of ["bossSpawn", "bossKilled", "bossPhase", "enemyFx", "bulletsCleared", "victory", "evolution"]) expect(seen.get(k) ?? 0, k).toBeGreaterThan(0);
    // (weapon visuals travel on weaponFx (the arsenal) or heroFx (Season 2 signature weapons), whichever this build picked)
    expect((seen.get("weaponFx") ?? 0) + (seen.get("heroFx") ?? 0), "weaponFx / heroFx").toBeGreaterThan(0);
    expect(seen.get("bossKilled")).toBe(3);
    expect(peak.enemies).toBeLessThanOrEqual(360);
    expect(peak.projectiles).toBeLessThan(900);
    expect(peak.bullets).toBeLessThanOrEqual(CFG.maxBullets);
    expect(peak.gems).toBeLessThanOrEqual(CFG.maxGems * 2); // (merged every 0.5 s: kill bursts overshoot briefly)
    expect(peak.pickups).toBeLessThanOrEqual(CFG.maxCoins + 40);
    expect(peak.telegraphs).toBeLessThan(40);
    // after the end the world idles: nothing moves, nothing spawns
    const n = w.enemies.count;
    for (let i = 0; i < 120; i++) w.step(DT);
    expect(w.enemies.count).toBe(n);
  });
});
