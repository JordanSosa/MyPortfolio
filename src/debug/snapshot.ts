/**
 * `__kk.snapshot()`: structured JSON of the live state (lazy chunk). Plain
 * data only (numbers rounded), so agents can diff two snapshots and the dev
 * console can render it.
 */
import { audioStats } from "../audio";
import { time } from "../core/time";
import { CFG } from "../game/config";
import type { App } from "../ui/app";
import { overlaysOpen } from "../ui/kit";
import { save } from "../ui/save";
import { diagCounts, diagLog, glCounts } from "./diag";
import { prof } from "./perf";

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface Snapshot {
  screen: string;
  modal: string;
  settingsOpen: boolean;
  hubPage: string | null;
  hubDepth: number;
  overlays: number;
  stepMode: boolean;
  frames: number;
  time: { speed: number; paused: boolean; scale: number; hitstop: boolean };
  run: RunSnap | null;
  attract: { hero: string; t: number; enemies: number } | null;
  perf: {
    fps: number;
    frameMs: { p50: number; p95: number; max: number };
    cpuMs: Record<string, { p50: number; p95: number }>;
    tier: string;
    auto: boolean;
    sprites: number;
    drawCalls: number;
    particles: number;
    particleCap: number;
    contextLost: boolean;
    contextLosses: number;
  };
  audio: ReturnType<typeof audioStats>;
  save: { origin: string; writeOk: boolean; runs: number; clears: number; coins: number; gems: number; copium: number; heroes: number; stages: number };
  errors: { errors: number; warnings: number; last: { t: number; level: string; msg: string; n: number }[] };
}

export interface RunSnap {
  stage: string;
  hero: string;
  t: number;
  phase: string;
  practice: boolean;
  level: number;
  xp: number;
  xpNext: number;
  hp: number;
  maxHp: number;
  god: boolean;
  kills: number;
  coins: number;
  combo: number;
  comboRank: number;
  ult: { meter: number; max: number; ready: boolean; phase: string; id: string; t: number };
  dash: { meter: number; charges: number };
  boss: { id: string; hp: number; maxHp: number; frac: number; state: number; enraged: boolean } | null;
  warning: string | null;
  enemies: { total: number; elites: number; props: number; byId: Record<string, number> };
  bullets: number;
  projectiles: number;
  gems: number;
  pickups: number;
  telegraphs: number;
  pendingLevels: number;
  pendingChests: number;
  weapons: { id: string; level: number; evolved: boolean }[];
  passives: { id: string; level: number }[];
  relics: { id: string; stars: number }[];
  twists: Record<string, number>;
  director: { spawnMul: number; adapt: number; endless: boolean; next: { at: number; kind: string; enemy?: string }[] };
  player: { x: number; y: number };
}

export function snapshot(app: App): Snapshot {
  const g = app.game?.world ?? null;
  const att = app.attract?.world ?? null;
  const ph = prof.phases(Math.min(prof.held, 300));
  const dt = prof.pct(prof.dt, Math.min(prof.held, 300));
  const p = save.profile;
  return {
    screen: app.screen,
    modal: app.modalKind,
    settingsOpen: !!app.sub,
    hubPage: app.hub?.top?.id ?? null,
    hubDepth: app.hub?.depth ?? 0,
    overlays: overlaysOpen(),
    stepMode: app.loop.manual,
    frames: app.loop.frames,
    time: { speed: time.speed, paused: time.paused, scale: r2(time.scale), hitstop: time.inHitstop },
    run: g ? runSnap(app, g) : null,
    attract: att ? { hero: att.hero.id, t: r1(att.t), enemies: att.enemyCount } : null,
    perf: {
      fps: r1(app.fpsMeter.fps || prof.window().fps),
      frameMs: { p50: r1(dt.p50), p95: r1(dt.p95), max: r1(dt.max) },
      cpuMs: Object.fromEntries(Object.entries(ph).map(([k, v]) => [k, { p50: r2(v.p50), p95: r2(v.p95) }])),
      tier: app.tier,
      auto: app.auto.enabled,
      sprites: app.r.batch.stats.instances,
      drawCalls: app.r.batch.stats.drawCalls,
      particles: app.fx.ps.count,
      particleCap: app.fx.ps.capacity,
      contextLost: app.r.contextLost,
      contextLosses: glCounts.lost,
    },
    audio: audioStats(),
    save: {
      origin: save.origin,
      writeOk: save.writeOk,
      runs: p.lifetime.runs,
      clears: p.lifetime.clears,
      coins: Math.floor(p.currencies.coins),
      gems: Math.floor(p.currencies.gems),
      copium: Math.floor(p.currencies.copium),
      heroes: p.unlocks.heroes.length,
      stages: p.unlocks.stages.length,
    },
    errors: { errors: diagCounts.error, warnings: diagCounts.warn, last: diagLog.slice(-10).map((e) => ({ t: r1(e.t), level: e.level, msg: e.msg, n: e.n })) },
  };
}

function runSnap(app: App, w: NonNullable<App["game"]>["world"]): RunSnap {
  const byId: Record<string, number> = {};
  let elites = 0;
  let props = 0;
  const en = w.enemies;
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i];
    if (e.dead) continue;
    byId[e.def.id] = (byId[e.def.id] ?? 0) + 1;
    if (e.elite) elites++;
    if (e.def.prop) props++;
  }
  const b = w.boss && !w.boss.dead ? w.boss : null;
  const d = w.director;
  const events = (w.director as unknown as { events?: { at: number; kind: string; enemy?: string }[] }).events ?? w.stage.events;
  const next = events.filter((e) => e.at > w.t).slice(0, 4).map((e) => ({ at: e.at, kind: e.kind, enemy: e.enemy }));
  return {
    stage: w.stage.id,
    hero: w.hero.id,
    t: r2(w.t),
    phase: w.phase,
    practice: app.practice,
    level: w.level,
    xp: r1(w.xp),
    xpNext: r1(w.xpNext),
    hp: r1(w.player.hp),
    maxHp: w.player.maxHp,
    god: !!(w as unknown as { god: boolean }).god,
    kills: w.kills,
    coins: w.coins,
    combo: w.combo,
    comboRank: w.comboRank,
    ult: { meter: r1(w.ultMeter), max: CFG.ultMax, ready: w.ultReady, phase: w.ult?.phase ?? "", id: w.ultId, t: r2(w.ult?.t ?? 0) },
    dash: { meter: r2(w.dashMeter), charges: w.player.dashCharges },
    boss: b ? { id: b.def.id, hp: Math.round(b.hp), maxHp: b.maxHp, frac: r2(b.hp / b.maxHp), state: b.state, enraged: d.enraged } : null,
    warning: d.warning ? d.warning.def.id : null,
    enemies: { total: w.enemyCount, elites, props, byId },
    bullets: w.bullets.count,
    projectiles: w.projectiles.count,
    gems: w.gems.count,
    pickups: w.pickups.count,
    telegraphs: w.telegraphs.count,
    pendingLevels: w.pendingLevels,
    pendingChests: w.pendingChests.length,
    weapons: w.weapons.map((i) => ({ id: i.def.id, level: i.level, evolved: !!i.def.evolved })),
    passives: w.passives.map((i) => ({ id: i.def.id, level: i.level })),
    relics: (w.run.relics ?? []).map((r) => ({ id: r.id, stars: r.stars })),
    twists: { ...w.twistRanks },
    director: { spawnMul: r2(d.spawnMul), adapt: r2(d.adapt), endless: w.endlessOn, next },
    player: { x: r1(w.player.x), y: r1(w.player.y) },
  };
}
