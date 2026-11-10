/**
 * Spawn director: continuous spawning from the stage's timeline phases,
 * one-shot timeline events, destructible props, boss warnings / entrances,
 * the end-of-run rules (final boss / fallback victory, enrage) and the
 * endless "Filler Arc" (rising scaling, elite waves, boss rematches).
 * Everything stage-specific comes from `world.stage` (src/game/stages/).
 */
import { lerp } from "../../core/math";
import { BOSSES, ENEMIES } from "../registry";
import { stageBosses, stagePhaseAt, type SpawnPhase, type TimelineEvent } from "../stage";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { EVENT_HANDLERS } from "./events";
import { EFX_SUMMON, efx } from "../enemies/_fx";
import { minBossFeetY } from "../bosses/_entrance";

type Task = (dt: number) => boolean;

/** Fraction of the phase cap kept alive at minimum (spawn rate boosts below it). */
export const MIN_ALIVE = 0.8;
/**
 * Adaptive toughness: while the screen stays below ADAPT_FLOOR x the cap (the
 * build kills faster than the director can refill), newly spawned enemies get
 * tougher (HP x (1 + adapt)), up to ADAPT_MAX; it relaxes once the screen is
 * busy again. Strong builds keep a busy, dangerous screen; weak builds (who
 * already fight a full screen) never see it. Off before ADAPT_FROM s. The
 * ceiling is per stage (StageScaling.adaptMax; ADAPT_MAX is the default).
 */
export const ADAPT_FROM = 210;
export const ADAPT_FLOOR = 0.55;
export const ADAPT_MAX = 1.5;
const ADAPT_UP = 0.03;
const ADAPT_DOWN = 0.02;
/**
 * Boss entrance beat (s): no new spawns while the name card plays (enemies already
 * on screen keep fighting), so the boss arrives into a moment of focus.
 */
export const BOSS_INTRO = 1.6;
/** Seconds of Filler Arc between episode cards. */
export const FILLER_EPISODE = 300;

export class Director {
  /** Spawn-rate multiplier (bosses reduce it while alive). */
  spawnMul = 1;
  /** Extra HP fraction for new spawns (adaptive toughness, see ADAPT_MAX). */
  adapt = 0;
  /**
   * HP multiplier for new (non-boss) spawns: adaptive toughness x a low-tier
   * compensation (a device capped below the phase max fights fewer, tougher
   * enemies: x sqrt(phaseMax / deviceCap), at most x1.4).
   */
  hpMul = 1;
  enraged = false;
  /** Boss currently in its WARNING countdown. */
  warning: { def: EnemyDef; t: number; mul: number } | null = null;
  /** Seconds left of the boss entrance beat (BOSS_INTRO): continuous spawning pauses. */
  introT = 0;
  /** Filler Arc: elite waves / boss rematches so far. */
  endlessWaves = 0;
  endlessBosses = 0;
  /** The boss on screen is a Filler Arc rematch (its spawn multiplier is the endless one). */
  rematch = false;
  private acc = 0;
  private nextEvent = 0;
  private propT = 8;
  private tasks: Task[] = [];
  private mixCache = new Map<SpawnPhase, { defs: EnemyDef[]; weights: number[] }>();
  private readonly events: TimelineEvent[];
  private readonly hasFinalBoss: boolean;
  private readonly propDefs: EnemyDef[] = [];
  private opened = false;
  private eliteT = 0;
  private bossT = 0;
  private rematchIdx = 0;
  /** Filler Arc episode cards (every FILLER_EPISODE s of endless time). */
  private episodes = 0;

  constructor(private readonly w: World) {
    const st = w.stage;
    this.events = [...st.events].sort((a, b) => a.at - b.at);
    this.hasFinalBoss = !!BOSSES.get(st.finalBoss)?.boss;
    if (st.props.ids) {
      for (const id of st.props.ids) {
        const d = ENEMIES.get(id);
        if (d?.prop) this.propDefs.push(d);
      }
    } else for (const d of ENEMIES.values()) if (d.prop) this.propDefs.push(d);
  }

  /** Spawning phase now (the endless phase during the Filler Arc). */
  phase(): SpawnPhase {
    const w = this.w;
    if (w.endlessOn) {
      const e = w.stage.endless.phase;
      if (e) return e;
    }
    return stagePhaseAt(w.stage, w.t);
  }

  /** The Filler Arc begins (World.startEndless): first elite wave and rematch on their own clocks. */
  startEndless(): void {
    const e = this.w.stage.endless;
    this.eliteT = e.eliteEvery;
    this.bossT = e.bossEvery;
  }

  addTask(t: Task): void {
    this.tasks.push(t);
  }

  update(dt: number): void {
    const w = this.w;
    if (!this.opened) {
      this.opened = true;
      this.opening();
    }
    // timeline events
    while (this.nextEvent < this.events.length && this.events[this.nextEvent].at <= w.t) {
      const ev = this.events[this.nextEvent++];
      const h = EVENT_HANDLERS[ev.kind];
      if (h) h(w, this, ev);
      else console.warn(`[director] unknown event kind '${ev.kind}'`);
    }
    for (let i = this.tasks.length - 1; i >= 0; i--) if (!this.tasks[i](dt)) this.tasks.splice(i, 1);

    // boss warning countdown
    if (this.warning) {
      this.warning.t -= dt;
      if (this.warning.t <= 0) {
        const { def, mul } = this.warning;
        this.warning = null;
        this.spawnBoss(def, mul);
      }
    }

    if (w.endlessOn) this.updateEndless(dt);

    // continuous spawning (paused while a boss makes its entrance)
    if (this.introT > 0) this.introT = Math.max(0, this.introT - dt);
    const intro = this.introT > 0 ? 0 : 1;
    const ph = this.phase();
    const k = ph.to > ph.from && ph.to < 1e8 ? (w.t - ph.from) / (ph.to - ph.from) : 1;
    // (Filler Overload raises the phase cap; the device cap still applies)
    const phMax = ph.max * w.difficulty.cap * w.scaling.cap;
    const cap = Math.min(phMax, w.maxEnemies);
    let rate = lerp(ph.rate[0], ph.rate[1], Math.min(1, Math.max(0, k))) * this.spawnMul * intro * this.rateMul();
    // pressure floor: a strong build shouldn't empty the screen - refill faster when sparse
    const floor = cap * MIN_ALIVE * this.spawnMul * intro;
    const deficit = w.enemyCount < floor ? 1 - w.enemyCount / floor : 0;
    if (deficit > 0) rate *= 1 + 3 * deficit;
    if (w.t >= ADAPT_FROM && intro) {
      const af = cap * ADAPT_FLOOR * this.spawnMul;
      if (w.enemyCount < af) this.adapt = Math.min(w.scaling.adaptMax, this.adapt + ADAPT_UP * (1 - w.enemyCount / af) * dt);
      else this.adapt = Math.max(0, this.adapt - ADAPT_DOWN * dt);
    }
    this.hpMul = (1 + this.adapt) * (cap < phMax ? Math.min(1.4, Math.sqrt(phMax / cap)) : 1);
    this.acc += rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (w.enemyCount >= cap) {
        this.acc = Math.min(this.acc, 1);
        break;
      }
      const def = this.pick(ph);
      if (!def) break;
      w.edgePoint(14 + w.rng.next() * 14, w.tmp, true);
      w.spawnEnemy(def, w.tmp.x, w.tmp.y);
    }

    // destructible props
    this.propT -= dt;
    if (this.propT <= 0) {
      this.propT = w.stage.props.interval * (0.8 + w.rng.next() * 0.4);
      this.spawnProp();
    }

    // end of run (finalBossDown: the final boss fell on the step the player died, then a revive;
    // without a registered final boss, surviving the stage's duration clears it)
    if (!w.endlessOn) {
      if (!this.hasFinalBoss && !w.finalBossDown && w.t >= w.stage.duration) {
        w.stageCleared = true;
        w.finalBossDown = true;
        if (w.run.endless) w.startEndless();
      }
      if (w.finalBossDown && !w.endlessOn) w.win();
    }
    if (!this.enraged && w.t >= w.stage.enrageAt && w.boss && w.isFinalBoss(w.boss)) {
      this.enraged = true;
      w.emit("bossEnrage", {});
    }
  }

  /** Spawn-rate multiplier from the stage's toughness, the difficulty (twists), the curse stat and the Filler Arc. */
  private rateMul(): number {
    const w = this.w;
    let m = w.difficulty.spawn * w.scaling.spawn;
    const c = w.stats.curse;
    if (c > 0) m *= 1 + c;
    if (w.endlessOn) m *= 1 + w.stage.endless.spawnPerMinute * ((w.t - w.endlessFrom) / 60);
    return m;
  }

  /** Filler Arc: periodic elite waves and boss rematches (scaled), cycling forever, and an episode card every 5:00. */
  private updateEndless(dt: number): void {
    const w = this.w;
    const e = w.stage.endless;
    const ep = Math.floor((w.t - w.endlessFrom) / FILLER_EPISODE);
    if (ep > this.episodes) {
      this.episodes = ep;
      w.emit("fillerEpisode", { n: ep });
    }
    this.eliteT -= dt;
    if (this.eliteT <= 0) {
      this.eliteT = e.eliteEvery;
      this.endlessWaves++;
      const n = Math.round((e.elites + this.endlessWaves - 1) * w.difficulty.elite) + Math.floor(w.run.flags.eliteRate ?? 0);
      for (let i = 0; i < n; i++) {
        const d = this.randomMixDef(true);
        if (!d) break;
        w.edgePoint(20 + i * 6, w.tmp, true);
        w.spawnEnemy(d, w.tmp.x, w.tmp.y, true);
      }
      w.emit("fillerWave", { kind: "elite", n, id: "" });
    }
    this.bossT -= dt;
    if (this.bossT <= 0 && !this.warning && !(w.boss && !w.boss.dead)) {
      this.bossT = e.bossEvery;
      const ids = e.rematches ?? stageBosses(w.stage);
      for (let k = 0; k < ids.length; k++) {
        const idx = (this.rematchIdx + k) % ids.length;
        const def = BOSSES.get(ids[idx]);
        if (!def?.boss) continue;
        this.rematchIdx = idx + 1;
        this.endlessBosses++;
        this.rematch = true;
        this.warnBoss(def, e.bossSpawnMul);
        w.emit("fillerWave", { kind: "boss", n: this.endlessBosses, id: def.id });
        break;
      }
    }
  }

  /** First seconds: a loose ring of easy enemies so the first level-up lands fast. */
  private opening(): void {
    const w = this.w;
    const op = w.stage.opening;
    const def = ENEMIES.get(op.enemy) ?? this.pick(stagePhaseAt(w.stage, 0));
    if (!def) return;
    const p = w.player;
    const n = op.count;
    const R = Math.min(w.viewW, w.viewH) * 0.42;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + w.rng.spread(0.2);
      w.spawnEnemy(def, p.x + Math.cos(a) * R * w.rng.range(0.9, 1.15), p.y + Math.sin(a) * R * w.rng.range(0.9, 1.15));
    }
  }

  private mix(ph: SpawnPhase): { defs: EnemyDef[]; weights: number[] } {
    let m = this.mixCache.get(ph);
    if (!m) {
      const defs: EnemyDef[] = [];
      const weights: number[] = [];
      for (const [id, wt] of Object.entries(ph.mix)) {
        const d = ENEMIES.get(id);
        if (d && !d.prop && wt > 0) {
          defs.push(d);
          weights.push(wt);
        }
      }
      if (!defs.length) {
        // nothing registered for this phase yet: fall back to any registered enemy
        for (const d of ENEMIES.values())
          if (!d.prop) {
            defs.push(d);
            weights.push(1);
          }
      }
      m = { defs, weights };
      this.mixCache.set(ph, m);
    }
    return m;
  }

  private pick(ph: SpawnPhase): EnemyDef | undefined {
    const m = this.mix(ph);
    if (!m.defs.length) return undefined;
    return m.defs[this.w.rng.weightedIndex(m.weights)];
  }

  /** Random enemy from the current phase mix (elite-able when `elite`). */
  randomMixDef(elite = false): EnemyDef | undefined {
    const m = this.mix(this.phase());
    for (let tries = 0; tries < 8; tries++) {
      const d = m.defs[this.w.rng.weightedIndex(m.weights)];
      if (d && (!elite || !d.noElite)) return d;
    }
    return m.defs[0];
  }

  private spawnProp(): void {
    const w = this.w;
    if (w.propCount >= w.stage.props.max) return;
    const props = this.propDefs;
    if (!props.length) return;
    const def = props[w.rng.int(0, props.length - 1)];
    // just off-screen, ahead of the player when moving
    w.edgePoint(10 + w.rng.next() * 30, w.tmp, true);
    w.spawnEnemy(def, w.tmp.x, w.tmp.y);
  }

  warnBoss(def: EnemyDef, mul: number): void {
    if (!def.boss) return;
    const t = this.w.difficulty.bossWarning;
    this.warning = { def, t, mul };
    // (Spoilers twist: no WARNING - the boss just shows up)
    if (t > 0) this.w.emit("bossWarning", { id: def.id, title: def.boss.title, subtitle: def.boss.subtitle });
  }

  private spawnBoss(def: EnemyDef, mul: number): void {
    const w = this.w;
    const p = w.player;
    // a previous boss that is somehow still alive flees into the dark (keeps one boss bar / one theme)
    const old = w.boss;
    if (old && !old.dead) {
      efx(w, EFX_SUMMON, old.x, old.y, 0, 0, 3);
      w.despawn(old);
      w.boss = null;
    }
    const e = w.spawnEnemy(def, p.x, p.y - w.viewH * 0.5 - 30);
    if (!e || !def.boss) return;
    // Filler Arc rematch: tougher with every loop
    if (this.rematch) {
      const k = 1 + w.stage.endless.bossHpPerLoop * Math.max(0, this.endlessBosses - 1);
      e.maxHp = e.hp = Math.round(e.maxHp * k);
      this.rematch = false;
    }
    // enter on screen, right under the HUD (bosses/_entrance.ts): the name card plays over the boss, not
    // over empty meadow (sprite top = feet - body height - hover z; init() has set z). Wide landscape views have little
    // room above the hero, so the boss comes in from the left side there (the touch buttons sit bottom-right).
    e.y = minBossFeetY(w, e.cy * 2 + e.z);
    if (w.viewW > w.viewH * 1.2) e.x = p.x - w.viewW * 0.32;
    e.face = e.x < p.x ? 1 : -1;
    w.boss = e;
    this.spawnMul = mul;
    // (Spoilers: no entrance beat either - the boss just appears)
    this.introT = w.difficulty.bossIntro ? BOSS_INTRO : 0;
    w.emit("bossSpawn", { enemy: e, title: def.boss.title, subtitle: def.boss.subtitle });
    w.hooks.emit("bossSpawn", { enemy: e });
  }

  onBossDied(_e: Enemy): void {
    if (!this.w.boss) this.spawnMul = 1;
  }
}
