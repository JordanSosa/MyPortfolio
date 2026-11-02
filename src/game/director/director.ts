/**
 * Spawn director: continuous spawning from the timeline phases, one-shot
 * timeline events, destructible props every ~20 s, boss warnings/entrances
 * and the end-of-run rules (final boss / fallback victory, enrage).
 */
import { CFG } from "../config";
import { lerp } from "../../core/math";
import { BOSSES, ENEMIES } from "../registry";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { EVENT_HANDLERS } from "./events";
import { EFX_SUMMON, efx } from "../enemies/_fx";
import { EVENTS, phaseAt, type SpawnPhase, type TimelineEvent } from "./timeline";

type Task = (dt: number) => boolean;

/** Fraction of the phase cap kept alive at minimum (spawn rate boosts below it). */
export const MIN_ALIVE = 0.8;
/**
 * Adaptive toughness: while the screen stays below ADAPT_FLOOR x the cap (the
 * build kills faster than the director can refill), newly spawned enemies get
 * tougher (HP x (1 + adapt)), up to ADAPT_MAX; it relaxes once the screen is
 * busy again. Strong builds keep a busy, dangerous screen; weak builds (who
 * already fight a full screen) never see it. Off before ADAPT_FROM s.
 */
export const ADAPT_FROM = 210;
export const ADAPT_FLOOR = 0.55;
export const ADAPT_MAX = 1.5;
const ADAPT_UP = 0.03;
const ADAPT_DOWN = 0.02;

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
  private acc = 0;
  private nextEvent = 0;
  private propT = 8;
  private tasks: Task[] = [];
  private mixCache = new Map<SpawnPhase, { defs: EnemyDef[]; weights: number[] }>();
  private readonly events: TimelineEvent[];
  private readonly hasFinalBoss: boolean;
  private opened = false;

  constructor(private readonly w: World) {
    this.events = [...EVENTS].sort((a, b) => a.at - b.at);
    let fin = false;
    for (const b of BOSSES.values()) if (b.boss?.final) fin = true;
    this.hasFinalBoss = fin;
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

    // continuous spawning
    const ph = phaseAt(w.t);
    const k = ph.to > ph.from && ph.to < 1e8 ? (w.t - ph.from) / (ph.to - ph.from) : 1;
    const cap = Math.min(ph.max, w.maxEnemies);
    let rate = lerp(ph.rate[0], ph.rate[1], Math.min(1, Math.max(0, k))) * this.spawnMul;
    // pressure floor: a strong build shouldn't empty the screen - refill faster when sparse
    const floor = cap * MIN_ALIVE * this.spawnMul;
    const deficit = w.enemyCount < floor ? 1 - w.enemyCount / floor : 0;
    if (deficit > 0) rate *= 1 + 3 * deficit;
    if (w.t >= ADAPT_FROM) {
      const af = cap * ADAPT_FLOOR * this.spawnMul;
      if (w.enemyCount < af) this.adapt = Math.min(ADAPT_MAX, this.adapt + ADAPT_UP * (1 - w.enemyCount / af) * dt);
      else this.adapt = Math.max(0, this.adapt - ADAPT_DOWN * dt);
    }
    this.hpMul = (1 + this.adapt) * (cap < ph.max ? Math.min(1.4, Math.sqrt(ph.max / cap)) : 1);
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
      this.propT = CFG.propInterval * (0.8 + w.rng.next() * 0.4);
      this.spawnProp();
    }

    // end of run (finalBossDown: the final boss fell on the step the player died, then a revive)
    if (w.finalBossDown || (!this.hasFinalBoss && w.t >= CFG.fallbackVictoryAt)) w.win();
    if (!this.enraged && w.t >= CFG.enrageAt && w.boss?.def.boss?.final) {
      this.enraged = true;
      w.emit("bossEnrage", {});
    }
  }

  /** First seconds: a loose ring of easy enemies so the first level-up lands fast. */
  private opening(): void {
    const w = this.w;
    const def = ENEMIES.get("puff") ?? this.pick(phaseAt(0));
    if (!def) return;
    const p = w.player;
    const n = 10;
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
    const m = this.mix(phaseAt(this.w.t));
    for (let tries = 0; tries < 8; tries++) {
      const d = m.defs[this.w.rng.weightedIndex(m.weights)];
      if (d && (!elite || !d.noElite)) return d;
    }
    return m.defs[0];
  }

  private spawnProp(): void {
    const w = this.w;
    if (w.propCount >= CFG.maxProps) return;
    const props: EnemyDef[] = [];
    for (const d of ENEMIES.values()) if (d.prop) props.push(d);
    if (!props.length) return;
    const def = props[w.rng.int(0, props.length - 1)];
    // just off-screen, ahead of the player when moving
    w.edgePoint(10 + w.rng.next() * 30, w.tmp, true);
    w.spawnEnemy(def, w.tmp.x, w.tmp.y);
  }

  warnBoss(def: EnemyDef, mul: number): void {
    if (!def.boss) return;
    this.warning = { def, t: CFG.bossWarningTime, mul };
    this.w.emit("bossWarning", { id: def.id, title: def.boss.title, subtitle: def.boss.subtitle });
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
    w.boss = e;
    this.spawnMul = mul;
    w.emit("bossSpawn", { enemy: e, title: def.boss.title, subtitle: def.boss.subtitle });
  }

  onBossDied(_e: Enemy): void {
    if (!this.w.boss) this.spawnMul = 1;
  }
}
