/**
 * RunStats collector (docs/EXPANSION.md §11, contract: run-config.ts RunStats).
 * Listens on the never-muted `world.hooks` bus, so fast-forwarded runs count
 * the same as watched ones; counters only (no per-event allocation: a
 * `killsByEnemy` key is created once per enemy type). `finish()` completes
 * the snapshot from the world's end state.
 */
import { CFG } from "./config";
import { WEAPONS } from "./registry";
import type { RunStatCounter, RunStats } from "./run-config";
import type { World } from "./world";

export class RunStatsCollector {
  readonly s: RunStats;
  /** Run time of the last damage taken (no-hit streaks). */
  private lastHurt = 0;
  /** Run time the player last dealt damage (pacifist streaks). */
  private lastDealt = 0;
  private pacifist = 0;
  private finalSpawnT = -1;
  private still = 0;

  constructor(private readonly w: World) {
    this.s = {
      stage: w.stage.id,
      hero: w.hero.id,
      twists: [...w.twistIds],
      heat: w.heat,
      endless: w.run.endless,
      time: 0,
      endlessTime: 0,
      stageCleared: false,
      killsByEnemy: {},
      eliteKills: 0,
      bossKills: [],
      damageByWeapon: {},
      killsByWeapon: {},
      evolutions: [],
      dashes: 0,
      ults: 0,
      levelUps: 0,
      level: 1,
      chests: 0,
      coins: 0,
      foodEaten: 0,
      maxCombo: 0,
      maxRank: -1,
      damageTaken: 0,
      noHitBest: 0,
      revivesUsed: 0,
      twistRanks: { ...w.twistRanks },
      gemFind: 1,
      curse: 0,
      firstDashAt: -1,
      pacifistBest: 0,
      rerollsUsed: 0,
      banishesUsed: 0,
      skipsUsed: 0,
      propsBroken: 0,
      shieldBlocks: 0,
      plotArmorSaves: 0,
      bossRematches: 0,
      finalBossTime: -1,
      weaponsUsed: [],
      passivesUsed: [],
      relics: w.run.relics.map((r) => r.id),
      outcome: "quit",
      crits: 0,
      nanis: 0,
      bakas: 0,
      charmed: 0,
      henshins: 0,
      overdos: 0,
      isekaid: 0,
      healed: 0,
      jackpots: 0,
      killedBy: "",
      ultReadyAtDeath: false,
      stillBest: 0,
      comfyBest: 0,
      gemsCollected: 0,
      maxWeaponsHeld: 0,
    };
    this.bind();
  }

  /** Add to a numeric extra (World.bumpStat). "comfyBest" keeps the max instead. */
  bump(key: RunStatCounter, n: number): void {
    const s = this.s;
    if (key === "comfyBest") s.comfyBest = Math.max(s.comfyBest ?? 0, n);
    else s[key] = (s[key] ?? 0) + n;
  }

  private bind(): void {
    const w = this.w;
    const s = this.s;
    const h = w.hooks;
    h.on("kill", (k) => {
      const id = k.enemy.def.id;
      s.killsByEnemy[id] = (s.killsByEnemy[id] ?? 0) + 1;
      if (k.elite) s.eliteKills++;
      const src = k.source;
      if (src && WEAPONS.has(src)) s.killsByWeapon[src] = (s.killsByWeapon[src] ?? 0) + 1;
      if (w.comboRank > (s.maxRank ?? -1)) s.maxRank = w.comboRank;
    });
    h.on("hit", (e) => {
      this.dealt();
      if (e.crit) s.crits = (s.crits ?? 0) + 1;
    });
    h.on("heal", (e) => {
      s.healed = (s.healed ?? 0) + e.amount;
    });
    h.on("gem", () => {
      s.gemsCollected = (s.gemsCollected ?? 0) + 1;
    });
    h.on("step", (e) => {
      const p = w.player;
      if (p.moving || p.dashT > 0) this.still = 0;
      else {
        this.still += e.dt;
        if (this.still > (s.stillBest ?? 0)) s.stillBest = this.still;
      }
      if (w.weapons.length > (s.maxWeaponsHeld ?? 0)) s.maxWeaponsHeld = w.weapons.length;
    });
    h.on("hurt", (e) => {
      this.streak();
      this.lastHurt = w.t;
      void e;
    });
    h.on("block", () => {
      s.shieldBlocks = (s.shieldBlocks ?? 0) + 1;
    });
    h.on("dash", () => {
      s.dashes++;
      if ((s.firstDashAt ?? -1) < 0) s.firstDashAt = w.t;
    });
    h.on("ult", () => {
      s.ults++;
    });
    h.on("levelUp", () => {
      s.levelUps++;
    });
    h.on("chest", (c) => {
      s.chests++;
      if (c.jackpot) s.jackpots = (s.jackpots ?? 0) + 1;
    });
    h.on("pickup", (p) => {
      if (p.kind === "onigiri" || p.kind === "cake") s.foodEaten++;
    });
    h.on("prop", () => {
      s.propsBroken = (s.propsBroken ?? 0) + 1;
    });
    h.on("bossSpawn", (b) => {
      if (w.isFinalBoss(b.enemy)) this.finalSpawnT = w.t;
    });
    h.on("bossKill", (b) => {
      s.bossKills.push(b.enemy.def.id);
      if (b.final && (s.finalBossTime ?? -1) < 0) s.finalBossTime = this.finalSpawnT >= 0 ? w.t - this.finalSpawnT : -1;
      if (w.endlessOn && !b.final) s.bossRematches = (s.bossRematches ?? 0) + 1;
    });
    h.on("revive", () => {
      s.revivesUsed++;
      // a revive starts a fresh no-hit stretch
      this.lastHurt = w.t;
    });
    h.on("reroll", () => {
      s.rerollsUsed = (s.rerollsUsed ?? 0) + 1;
    });
    h.on("banish", () => {
      s.banishesUsed = (s.banishesUsed ?? 0) + 1;
    });
    h.on("skip", () => {
      s.skipsUsed = (s.skipsUsed ?? 0) + 1;
    });
  }

  private dealt(): void {
    const t = this.w.t;
    const gap = t - this.lastDealt;
    if (gap > this.pacifist) this.pacifist = gap;
    this.lastDealt = t;
  }

  private streak(): void {
    const gap = this.w.t - this.lastHurt;
    if (gap > this.s.noHitBest) this.s.noHitBest = gap;
  }

  /** Complete the snapshot from the world's current state (World.summary calls it; safe to call repeatedly). */
  finish(): RunStats {
    const w = this.w;
    const s = this.s;
    this.streak();
    const gap = w.t - this.lastDealt;
    s.pacifistBest = Math.max(this.pacifist, gap);
    s.time = w.t;
    s.endlessTime = w.endlessOn ? Math.max(0, w.t - w.endlessFrom) : 0;
    s.stageCleared = w.stageCleared;
    s.level = w.level;
    s.coins = Math.floor(w.coins);
    s.maxCombo = w.maxCombo;
    s.damageTaken = w.damageTaken;
    s.gemFind = w.stats.gemFind;
    s.plotArmorSaves = w.plotArmorSaves;
    s.curse = w.stats.curse;
    s.outcome = w.phase === "victory" ? "victory" : w.phase === "dead" ? "dead" : "quit";
    s.killedBy = w.phase === "dead" ? w.killedBy : "";
    s.ultReadyAtDeath = w.phase === "dead" && w.ultMeter >= CFG.ultMax && !w.ult;
    s.damageByWeapon = {};
    for (const [k, v] of w.damageBy) if (WEAPONS.has(k)) s.damageByWeapon[k] = Math.round(v);
    s.evolutions = [];
    for (const inst of w.weapons) if (inst.def.evolved || inst.level >= w.weaponMaxLevel(inst.def)) s.evolutions.push(inst.def.id);
    s.weaponsUsed = [...w.weaponsUsed];
    s.passivesUsed = [...w.passivesUsed];
    return s;
  }
}
