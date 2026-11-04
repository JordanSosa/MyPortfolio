/** Balance lab jobs `path` / `slice` / `boss` (tools/balance-lab/jobs.ts): snapshots grown by the bot's own picks, then short real sims. */
import { CFG } from "../../src/game/config";
import type { World } from "../../src/game/world";
import { xpTotal } from "./job-run";
import { DT, type BossJob, type BossRec, type CensusJob, type CensusResult, type PathJob, type PathResult, type PathStats, type SliceJob, type SliceRec } from "./jobs";
import { bossEventAt, buildOf, cellWorld, growBuild, jobBot, jumpTo, setGod, settle } from "./snapshot";

const r3 = (x: number) => Math.round(x * 1000) / 1000;

function pathStats(w: World): PathStats {
  const s = w.stats;
  return { might: r3(s.might), cooldown: r3(s.cooldown), area: r3(s.area), amount: s.amount, crit: r3(s.crit), critMult: r3(s.critMult), bossDmg: r3(s.bossDmg), maxHp: s.maxHp, armor: s.armor, regen: r3(s.regen), dmgReduction: r3(s.dmgReduction), growth: r3(s.growth), healMul: r3(s.healMul), shield: s.shield, shieldCd: s.shieldCd, revives: w.revivesLeft, curse: r3(s.curse) };
}

export function runPath(j: PathJob): PathResult {
  const w = cellWorld({ cp: j.cp, stage: "dream_meadow", hero: j.hero, seed: j.seed }, { director: false, god: true });
  const bot = jobBot(j.bot, j.seed);
  settle(w, bot);
  const startLevel = w.level;
  const builds: PathResult["builds"] = [];
  for (let L = 1; L <= j.levels; L++) {
    if (L > w.level) growBuild(w, bot, L, j.chestEvery && L % j.chestEvery === 0 ? 1 : 0);
    if (w.statsDirty) w.recomputeStats();
    builds.push({ ...buildOf(w), stats: pathStats(w) });
  }
  return { builds, startLevel, weaponDamage: { ...(w.run.weaponDamage ?? {}) } };
}

// ---------------------------------------------------------------- snapshot sims

function snapshotWorld(j: SliceJob | BossJob, at: number): { w: World; bot: ReturnType<typeof jobBot> } {
  const w = cellWorld(j);
  const bot = jobBot(j.bot, j.seed);
  growBuild(w, bot, j.level, j.chests, j.golden);
  jumpTo(w, at, j.adapt);
  return { w, bot };
}

function step(w: World, bot: ReturnType<typeof jobBot>): void {
  bot.think(w, w.input, DT);
  w.step(DT);
  settle(w, bot);
}

export function runSlice(j: SliceJob): SliceRec {
  const { w, bot } = snapshotWorld(j, j.at - j.warm);
  setGod(w, true);
  while (w.t < j.at && w.phase === "play") step(w, bot);
  setGod(w, false);
  w.player.hp = w.player.maxHp;
  let dmg = 0;
  let hits = 0;
  w.bus.on("playerHurt", (e) => {
    dmg += e.dmg;
    hits++;
  });
  let revives = 0;
  w.bus.on("playerRevived", () => revives++);
  const kills0 = w.kills;
  const lv0 = w.level;
  const xp0 = xpTotal(w);
  let dealt0 = 0;
  for (const v of w.damageBy.values()) dealt0 += v;
  let died = -1;
  let minHp = 1;
  let alive = 0;
  let cap = 0;
  let n = 0;
  const end = j.at + j.len;
  while (w.t < end) {
    if (w.phase === "dead" && !w.revive()) {
      died = Math.round((w.t - j.at) * 10) / 10;
      break;
    }
    if (w.phase !== "play") break;
    step(w, bot);
    minHp = Math.min(minHp, w.player.hp / w.player.maxHp);
    alive += w.enemyCount;
    const ph = w.director.phase();
    cap += Math.min(ph.max * w.difficulty.cap * w.scaling.cap, w.maxEnemies);
    n++;
  }
  let dealt = 0;
  for (const v of w.damageBy.values()) dealt += v;
  return {
    dmg: Math.round(dmg),
    hits,
    died,
    revives,
    minHp: Math.round(Math.max(0, minHp) * 100) / 100,
    kills: w.kills - kills0,
    dealt: Math.round(dealt - dealt0),
    alive: Math.round(alive / Math.max(1, n)),
    cap: Math.round(cap / Math.max(1, n)),
    levelEnd: w.level,
    xp: Math.round(xpTotal(w) - xp0),
    maxHp: w.player.maxHp,
    bossAlive: !!(w.boss && !w.boss.dead),
  };
}

export function runBoss(j: BossJob): BossRec {
  const probe = cellWorld(j, { director: true });
  const at = bossEventAt(probe, j.boss);
  if (!Number.isFinite(at)) throw new Error(`boss ${j.boss} is not on ${j.stage}'s timeline`);
  const { w, bot } = snapshotWorld(j, Math.max(0, at - 8));
  setGod(w, true);
  let spawned = false;
  let t0 = 0;
  let e0: { hp: number; maxHp: number; dead: boolean } | null = null;
  let killed = -1;
  w.bus.on("bossSpawn", (e) => {
    if (e.enemy.def.id !== j.boss || spawned) return;
    spawned = true;
    t0 = w.t;
    e0 = e.enemy;
    setGod(w, false);
    w.player.hp = w.player.maxHp;
    // a real run reaches its bosses with a charged Overdrive (the meter fills every ~1-2 min; the bot fires it on bosses)
    w.addUlt(CFG.ultMax);
  });
  w.bus.on("bossKilled", () => {
    if (spawned && killed < 0) killed = w.t - t0;
  });
  let dmg = 0;
  let hits = 0;
  w.bus.on("playerHurt", (e) => {
    if (!spawned) return;
    dmg += e.dmg;
    hits++;
  });
  let revives = 0;
  w.bus.on("playerRevived", () => revives++);
  const timeout = j.timeout ?? 360;
  let died = -1;
  for (let g = 0; g < (timeout + 30) / DT; g++) {
    if (w.phase === "dead" && !w.revive()) {
      died = w.t - t0;
      break;
    }
    if (w.phase === "victory" || killed >= 0) break;
    if (spawned && w.t - t0 > timeout) break;
    if (!spawned && w.t > at + 30) break;
    step(w, bot);
  }
  const b = e0 as { hp: number; maxHp: number; dead: boolean } | null;
  return {
    ttk: killed >= 0 ? Math.round(killed * 10) / 10 : -1,
    died: died >= 0 ? Math.round(died * 10) / 10 : -1,
    left: b ? Math.round((Math.max(0, b.hp) / b.maxHp) * 100) / 100 : 1,
    dmg: Math.round(dmg),
    hits,
    revives,
    maxHp: w.player.maxHp,
    levelEnd: w.level,
    spawned,
  };
}


/**
 * Census: a strong god-mode build (P6 Hoshi at Lv 60) plays `len` seconds at each sampled time; every spawn
 * made outside the director's own spawning (splits, spores, summons, dropped frames) is counted per director spawn.
 */
export function runCensus(j: CensusJob): CensusResult {
  const points: CensusResult["points"] = [];
  for (const at of j.at) {
    const w = cellWorld({ cp: "P6", stage: j.stage, hero: "hoshi", seed: 1 }, { god: true });
    const bot = jobBot("good", 1);
    growBuild(w, bot, 60, 6, 2);
    jumpTo(w, Math.max(0, at - 5), 0);
    let inDir = false;
    let dir = 0;
    let other = 0;
    let on = false;
    const by: Record<string, number> = {};
    const spawn = w.spawnEnemy.bind(w);
    w.spawnEnemy = (d, x, y, elite) => {
      const e = spawn(d, x, y, elite);
      if (e && on && !e.def.prop && !e.def.boss) {
        if (inDir) dir++;
        else {
          other++;
          by[e.def.id] = (by[e.def.id] ?? 0) + 1;
        }
      }
      return e;
    };
    const upd = w.director.update.bind(w.director);
    w.director.update = (dt: number) => {
      inDir = true;
      try {
        upd(dt);
      } finally {
        inDir = false;
      }
    };
    while (w.t < at + j.len && w.phase === "play") {
      on = w.t >= at;
      step(w, bot);
    }
    points.push({ at, dir, other, by });
  }
  return { points };
}
