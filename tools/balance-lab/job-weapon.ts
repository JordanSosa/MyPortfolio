/**
 * Balance lab job `weapon` (tools/balance-lab/jobs.ts): one FIXED build on the real World + director + bot,
 * for the weapon bench (`npm run balance:lab -- --weapons`, tools/balance-lab/weapons.ts).
 *
 *   arena   the build (one weapon: "solo") on a stage at run time `at`: first a fixed wave of `wave` enemies drawn
 *           from the stage's own mix, the director off (time to clear 90 % of it), then `len` s of the real director
 *   slice   the build inside a checkpoint's account on a stage: `warm` s in god mode, then `len` s measured
 *   boss    the same build against a stage boss from just before its timeline event (a charged Overdrive, like the
 *           lab's boss fights), `len` s at most
 *
 * The build never changes: level-ups and chests are thrown away (the gauges do the same), so every weapon is
 * measured next to the same kit. The hero cannot die: HP floats like in a real run (heals land, are wasted at full
 * HP) and is refilled when it drops under 40 % (a `refill`; the bot stays in its normal, brave mode); Plot Armor
 * charges (the keystone's own code path) catch a hit that would kill from above that.
 *
 * `play: "camp"` swaps the bot's steering for a player who stands their ground (see WeaponJob.play).
 *
 * No game logic is copied: World, Director, Bot, checkpointRun, the live registries.
 */
import { defaultRunConfig, type RunConfig } from "../../src/game/run-config";
import { CFG } from "../../src/game/config";
import type { WeaponInstance } from "../../src/game/types";
import { World } from "../../src/game/world";
import { checkpointRun } from "../checkpoints";
import { DT, type WeaponJob, type WeaponRec } from "./jobs";
import { cpId } from "./overrides";
import { bossEventAt, jobBot, jumpTo, setGod } from "./snapshot";

/** `camp` play: seconds standing still / stepping aside (under the Kotatsu's 5 s "Too Comfy" doze). */
const CAMP_STAND = 4;
const CAMP_STEP = 0.35;
/** HP share under which the hero is refilled (the bot plays "brave" above 40 %). */
const REFILL = 0.4;

function buildWorld(j: WeaponJob): World {
  let run: RunConfig;
  let hero = j.hero;
  if (j.cp) {
    const plan = checkpointRun(cpId(j.cp), { hero: j.hero, stage: j.stage });
    run = plan.config;
    hero = plan.hero;
  } else run = { ...defaultRunConfig(), stage: j.stage };
  run = {
    ...run,
    start: { level: Math.max(1, j.level), weapons: [] },
    weaponSlots: Math.max(run.weaponSlots, j.weapons.length),
    passiveSlots: Math.max(run.passiveSlots, j.passives.length),
  };
  const w = new World({ hero, seed: j.seed * 7717 + 13, run, maxEnemies: 250, director: true, god: true });
  // the start level's picks, the hero's start weapon: thrown away - the job's build is the whole build
  w.pendingLevels = 0;
  for (const inst of w.weapons) {
    inst.def.dispose?.(w, inst);
    for (const p of inst.projs) p.dead = true;
  }
  w.weapons.length = 0;
  w.buildVersion++;
  for (const [id, lv] of j.passives) if (!w.addPassive(id, lv)) throw new Error(`weapon job: cannot add passive ${id}`);
  for (const [id, lv] of j.weapons) if (!w.addWeapon(id, lv)) throw new Error(`weapon job: cannot add weapon ${id}`);
  w.recomputeStats();
  w.player.hp = w.player.maxHp;
  w.plotArmor = 1e6;
  return w;
}

interface Meter {
  rec: WeaponRec;
  start(): void;
  stop(seconds: number): void;
  tick(): void;
}

/** Counters of a measured span (damage dealt per weapon, damage taken, heals, kills, crowd). */
function meter(w: World, test: WeaponInstance | undefined): Meter {
  const rec: WeaponRec = { T: 0, dealt: 0, test: 0, kills: 0, taken: 0, healed: 0, hits: 0, blocks: 0, refills: 0, alive: 0 };
  let on = false;
  let n = 0;
  let aliveAcc = 0;
  let d0 = 0;
  let t0 = 0;
  let k0 = 0;
  let b0 = 0;
  let taken0 = 0;
  const weaponsDealt = () => {
    let s = 0;
    for (const inst of w.weapons) s += inst.damage;
    return s;
  };
  w.bus.on("playerHurt", () => {
    if (on) rec.hits++;
  });
  w.hooks.on("heal", (h) => {
    if (on) rec.healed += h.amount;
  });
  return {
    rec,
    start() {
      on = true;
      d0 = weaponsDealt();
      t0 = test?.damage ?? 0;
      k0 = w.kills;
      b0 = w.runStats().orbitalBlocks ?? 0;
      taken0 = w.damageTaken;
    },
    tick() {
      if (!on) return;
      aliveAcc += w.enemyCount;
      n++;
    },
    stop(seconds) {
      on = false;
      rec.T = Math.round(seconds * 10) / 10;
      rec.dealt = Math.round(weaponsDealt() - d0);
      rec.test = Math.round((test?.damage ?? 0) - t0);
      rec.kills = w.kills - k0;
      rec.blocks = (w.runStats().orbitalBlocks ?? 0) - b0;
      rec.taken = Math.round(w.damageTaken - taken0);
      rec.healed = Math.round(rec.healed);
      rec.alive = Math.round(aliveAcc / Math.max(1, n));
    },
  };
}

export function runWeapon(j: WeaponJob): WeaponRec {
  const w = buildWorld(j);
  const bot = jobBot(j.bot, j.seed);
  const test = j.test ? w.weapons.find((x) => x.def.id === j.test) : undefined;
  if (j.test && !test) throw new Error(`weapon job: ${j.test} is not in the build`);
  const m = meter(w, test);
  let campT = 0;
  let campN = 0;
  const step = () => {
    bot.think(w, w.input, DT);
    if (j.play === "camp") {
      // stand your ground: still for CAMP_STAND s, then a short step (left / right in turn: she stays put)
      campT += DT;
      if (campT >= CAMP_STAND + CAMP_STEP) {
        campT = 0;
        campN++;
      }
      w.input.mx = campT >= CAMP_STAND ? (campN & 1 ? 1 : -1) : 0;
      w.input.my = 0;
    }
    w.step(DT);
    // a fixed build: no picks
    if (w.pendingLevels) w.pendingLevels = 0;
    if (w.pendingChests.length) w.pendingChests.length = 0;
    const p = w.player;
    if (!w.god && w.phase === "play" && p.hp < p.maxHp * REFILL) {
      // (heals wasted on the refill are not counted: the hook reports what landed)
      p.hp = p.maxHp;
      m.rec.refills++;
    }
    m.tick();
  };

  if (j.mode === "boss") {
    const at = bossEventAt(w, j.boss ?? "");
    if (!Number.isFinite(at)) throw new Error(`weapon job: boss ${j.boss} is not on ${j.stage}'s timeline`);
    jumpTo(w, Math.max(0, at - 8), 0);
    let boss: { hp: number; maxHp: number; dead: boolean } | null = null;
    let t0 = 0;
    let killed = -1;
    let toBoss = 0;
    let testBoss = 0;
    w.bus.on("bossSpawn", (e) => {
      if (e.enemy.def.id !== j.boss || boss) return;
      boss = e.enemy;
      t0 = w.t;
      setGod(w, false);
      w.player.hp = w.player.maxHp;
      w.addUlt(CFG.ultMax);
      m.start();
    });
    w.bus.on("bossKilled", () => {
      if (boss && killed < 0) killed = w.t - t0;
    });
    w.hooks.on("hit", (h) => {
      if (!boss || h.enemy !== (boss as unknown) || !h.owner) return;
      toBoss += h.dmg;
      if (h.owner === test) testBoss += h.dmg;
    });
    for (let g = 0; g < (j.len + 40) / DT; g++) {
      if (w.phase !== "play" || killed >= 0) break;
      if (boss && w.t - t0 >= j.len) break;
      if (!boss && w.t > at + 30) break;
      step();
    }
    if (!boss) throw new Error(`weapon job: boss ${j.boss} never spawned`);
    const b = boss as { hp: number; maxHp: number; dead: boolean };
    const T = killed >= 0 ? killed : w.t - t0;
    m.stop(T);
    m.rec.boss = { ttk: killed >= 0 ? Math.round(killed * 10) / 10 : -1, left: killed >= 0 ? 0 : Math.round((Math.max(0, b.hp) / b.maxHp) * 1000) / 1000, dealt: Math.round(toBoss), test: Math.round(testBoss) };
    return m.rec;
  }

  if (j.mode === "arena") {
    // a fixed wave from the stage's own mix at this run time, the director off: time to clear 90 % of it
    jumpTo(w, j.at, 0);
    w.directorOn = false;
    setGod(w, false);
    const n = j.wave ?? 0;
    if (n > 0) {
      let spawned = 0;
      for (let g = 0; g < n * 4 && spawned < n; g++) {
        const d = w.director.randomMixDef();
        if (!d) break;
        w.edgePoint(10 + w.rng.next() * 20, w.tmp, false);
        if (w.spawnEnemy(d, w.tmp.x, w.tmp.y)) spawned++;
      }
      const k0 = w.kills;
      const need = Math.ceil(spawned * 0.9);
      const cap = j.waveCap ?? 45;
      const t0 = w.t;
      while (w.t - t0 < cap && w.kills - k0 < need && w.phase === "play") step();
      m.rec.ttc = w.kills - k0 >= need ? Math.round((w.t - t0) * 10) / 10 : -1;
      m.rec.waveLeft = Math.round((1 - Math.min(1, (w.kills - k0) / Math.max(1, spawned))) * 100) / 100;
      // back to the slice's run time with a clean field
      for (let i = 0; i < w.enemies.count; i++) {
        const e = w.enemies.items[i];
        if (!e.dead && !e.def.prop) w.despawn(e);
      }
      w.clearBullets();
      w.t = j.at;
      w.player.hp = w.player.maxHp;
      m.rec.refills = 0;
      m.rec.hits = 0;
      m.rec.healed = 0;
    }
    w.directorOn = true;
  } else {
    jumpTo(w, Math.max(0, j.at - j.warm), 0);
    while (w.t < j.at && w.phase === "play") step();
    setGod(w, false);
    w.player.hp = w.player.maxHp;
  }
  m.start();
  const t0 = w.t;
  while (w.t - t0 < j.len && w.phase === "play") step();
  m.stop(w.t - t0);
  return m.rec;
}
