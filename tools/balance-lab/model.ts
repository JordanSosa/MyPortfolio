/**
 * The balance lab's ANALYTIC MODEL (milliseconds per cell): the stage's incoming horde
 * straight from its data (phases x mixes x HP / damage scaling x events x bosses, read
 * from the live registries - what-if overrides apply), the build's power from the
 * weapon defs' gauged numbers x the account's stats (calibrated per weapon against the
 * real sim, tools/balance-lab/jobs.ts `gauge`), and a coarse time-stepped run on top:
 *
 *   arrivals   phase rate x stage spawn x twists, boosted up to x4 below 80 % of the cap (the director's
 *              pressure floor), events add their counts; elites and bosses from the timeline
 *   kills      crowd DPS x engagement(alive) / effective HP (adaptive toughness included), at most the build's
 *              hit rate; the boss takes the build's single-target DPS while it lives
 *   level      gem XP (mix XP x gemXpScale x growth x collection) -> xpToNext -> the bot's build at that level
 *   damage     hits on the hero ~ h0 x (alive / cap)^p (at most 2/s: hurt i-frames), x the stage's contact damage
 *              ramp, minus armour / reduction; boss pressure while a boss lives; regen, level-up heals, food
 *   death      HP <= 0 after revives (50 % HP each); clear = the final boss dies first
 *
 * The constants that stand for the PLAYER (engagement, collection, hit rate, boss focus...) are
 * fitted against real runs (tools/balance-lab/calibrate.ts -> calibration.json). Clear % comes from
 * noise draws (DPS and hit rate jitter) per hero x seed.
 */
import { CFG, enemyDmgScale, enemyHpScale, gemXpScale, RANKS, xpToNext } from "../../src/game/config";
import { ADAPT_FLOOR, ADAPT_FROM, BOSS_INTRO, MIN_ALIVE } from "../../src/game/director/director";
import { BOSSES, ENEMIES, stageDef } from "../../src/game/registry";
import { finalBossAt, stagePhaseAt, type StageScaling } from "../../src/game/stage";
import type { Difficulty } from "../../src/game/world";
import type { GaugeResult, PathStats } from "./jobs";

// ---------------------------------------------------------------- the player constants (calibrated)

export interface Theta {
  /** Seconds a spawned enemy needs to walk in from the screen edge before the build can reach it. */
  tau: number;
  /** Efficiency of leftover DPS on enemies still walking in (reach: strong builds empty the screen). */
  reach: number;
  /** Crowd DPS efficiency (gauge -> a real moving fight). */
  eff: number;
  /** Alive enemies at which the crowd DPS is half used (engagement = N / (N + n50)). */
  n50: number;
  /** Share of dropped gem XP collected. */
  collect: number;
  /** Hits per second on the hero at a full screen (before the 2/s i-frame limit). */
  h0: number;
  /** Hit-rate exponent on alive / cap. */
  p: number;
  /** Bullet hits per second per 100 ranged enemies alive. */
  hr: number;
  /** Food / lantern healing (HP per second, x healMul). */
  food: number;
  /** Single-target DPS efficiency on bosses (they move, dash, go invulnerable). */
  bossEff: number;
  /** Share of crowd DPS lost while a boss lives. */
  bossDrain: number;
  /** Boss hits on the hero per second (x the boss's contact damage). */
  hb: number;
  /** Boss pressure multiplier after the final boss enrages. */
  enrage: number;
  /** Log-normal jitter of DPS / hit rate per noise draw (clear %). */
  sd: number;
  sh: number;
}

export const DEFAULT_THETA: Theta = { tau: 2, reach: 0.4, eff: 1, n50: 30, collect: 0.85, h0: 1.2, p: 2, hr: 0.5, food: 0.4, bossEff: 0.6, bossDrain: 0.3, hb: 0.3, enrage: 2, sd: 0.25, sh: 0.35 };

// ---------------------------------------------------------------- the stage, from its data

export interface StagePoint {
  t: number;
  /** Base spawn rate (per s, before the floor boost), alive cap. */
  rate: number;
  cap: number;
  /** Mean regular-enemy HP / contact damage / gem XP at t (the mix x scaling, adaptive toughness excluded). */
  hp: number;
  dmg: number;
  xp: number;
  /** Base incoming HP per second (rate x hp) and with the floor boost (x4). */
  inHp: number;
  /** Share of the mix (by weight) that fires bullets. */
  ranged: number;
}

export interface ModelEvent {
  at: number;
  kind: string;
  /** Extra regular enemies (swarm / flood / encircle counts), elites, or a boss id. */
  count: number;
  elites: number;
  boss?: string;
  bossHp?: number;
  spawnMul?: number;
  final?: boolean;
  /** Mean HP of the event's enemies at `at` (count x hp = the HP the event adds). */
  hp: number;
}

export interface StageModel {
  id: string;
  duration: number;
  finalAt: number;
  enrageAt: number;
  finalBoss: string;
  scaling: StageScaling;
  points: StagePoint[];
  events: ModelEvent[];
  /** Per-second lookup tables. */
  at(t: number): StagePoint;
}

/** Twist / heat difficulty multipliers that the model reads (World.difficulty; 1 = none). */
export type DifficultyLike = Pick<Difficulty, "enemyHp" | "bossHp" | "enemyDmg" | "spawn" | "cap" | "elite" | "eliteHp" | "bossWarning" | "levelHeal" | "food">;
export const NO_DIFFICULTY: DifficultyLike = { enemyHp: 1, bossHp: 1, enemyDmg: 1, spawn: 1, cap: 1, elite: 1, eliteHp: 1, bossWarning: CFG.bossWarningTime, levelHeal: true, food: true };

function mixStats(mix: Record<string, number>, ranged: ReadonlySet<string>): { hp: number; dmg: number; xp: number; ranged: number } {
  let w = 0;
  let hp = 0;
  let dmg = 0;
  let xp = 0;
  let rg = 0;
  for (const [id, k] of Object.entries(mix)) {
    const d = ENEMIES.get(id);
    if (!d || k <= 0) continue;
    w += k;
    hp += k * d.hp;
    dmg += k * d.dmg;
    xp += k * d.xp;
    if (ranged.has(id)) rg += k;
  }
  return w > 0 ? { hp: hp / w, dmg: dmg / w, xp: xp / w, ranged: rg / w } : { hp: 10, dmg: 5, xp: 1, ranged: 0 };
}

/** The stage's incoming horde per second, events and bosses, from the live content. */
export function stageModel(id: string, scaling: StageScaling, diff: DifficultyLike = NO_DIFFICULTY, maxE = 250, ranged: ReadonlySet<string> = new Set()): StageModel {
  const def = stageDef(id);
  const end = def.duration + 300;
  const points: StagePoint[] = [];
  for (let t = 0; t <= end; t++) {
    const ph = stagePhaseAt(def, t);
    const k = ph.to > ph.from && ph.to < 1e8 ? Math.min(1, Math.max(0, (t - ph.from) / (ph.to - ph.from))) : 1;
    const rate = (ph.rate[0] + (ph.rate[1] - ph.rate[0]) * k) * scaling.spawn * diff.spawn;
    const cap = Math.min(ph.max * diff.cap * scaling.cap, maxE);
    const m = mixStats(ph.mix, ranged);
    const hp = m.hp * enemyHpScale(t, scaling) * diff.enemyHp;
    points.push({ t, rate, cap, hp, dmg: m.dmg * enemyDmgScale(t, scaling) * diff.enemyDmg, xp: m.xp, inHp: rate * hp, ranged: m.ranged });
  }
  const events: ModelEvent[] = [];
  for (const e of [...def.events].sort((a, b) => a.at - b.at)) {
    const p = points[Math.min(points.length - 1, Math.floor(e.at))];
    if (e.kind === "boss" && e.enemy) {
      const b = BOSSES.get(e.enemy);
      if (!b) continue;
      events.push({ at: e.at, kind: "boss", count: 0, elites: 0, boss: e.enemy, bossHp: b.hp * scaling.bossHp * diff.bossHp, spawnMul: e.spawnMul ?? 0.4, final: e.enemy === def.finalBoss, hp: 0 });
    } else if (e.kind === "elite") events.push({ at: e.at, kind: "elite", count: 0, elites: diff.elite, hp: p.hp * CFG.elite.hp * diff.eliteHp });
    else {
      const d = e.enemy ? ENEMIES.get(e.enemy) : undefined;
      const n = (e.count ?? 0) * (e.kind === "batStorm" ? (e.lines ?? 1) : 1);
      if (!n) continue;
      const hp = d ? d.hp * enemyHpScale(e.at, scaling) * diff.enemyHp : p.hp;
      events.push({ at: e.at, kind: e.kind, count: n, elites: 0, hp });
    }
  }
  return {
    id,
    duration: def.duration,
    finalAt: finalBossAt(def),
    enrageAt: def.enrageAt,
    finalBoss: def.finalBoss,
    scaling,
    points,
    events,
    at: (t) => points[Math.max(0, Math.min(points.length - 1, Math.floor(t)))],
  };
}

// ---------------------------------------------------------------- the build, from the weapon defs + gauges

/** Gauged numbers of one weapon at base stats (Hoshi, default run): dense dps / hits/s / boss dps per level. */
export interface WeaponGauge {
  levels: Record<number, { dense: number; hps: number; boss: number }>;
  /** Elasticities at the top regular level: d ln(dps) / d ln(1/cooldown), d ln(dps) / d ln(area), relative gain per +1 amount. */
  eCd: number;
  eArea: number;
  eAmt: number;
}

export type WeaponTable = Record<string, WeaponGauge>;

/** The weapon-table gauge jobs' stat perturbations. */
export const GAUGE_PERTURB = { cooldown: 0.7, area: 1.5, amount: 2 } as const;
/** Base stats the weapon table was gauged at (Hoshi's trait: -5 % cooldown; crit 5 % x2). */
export const GAUGE_BASE = { might: 1, cooldown: 0.95, area: 1, amount: 0, crit: CFG.critChance, critMult: CFG.critMult };

export function weaponGauge(levels: Record<number, GaugeResult>, perturb: { cd?: GaugeResult; area?: GaugeResult; amount?: GaugeResult }, id: string): WeaponGauge {
  const lv: WeaponGauge["levels"] = {};
  for (const [k, g] of Object.entries(levels)) lv[Number(k)] = { dense: g.dense.by[id] ?? g.dense.dps, hps: g.dense.hps, boss: g.boss.by[id] ?? g.boss.dps };
  const top = Math.max(...Object.keys(levels).map(Number).filter((k) => k <= 5));
  const base = Math.max(1, lv[top]?.dense ?? 1);
  const el = (g: GaugeResult | undefined, x: number) => (g ? Math.log(Math.max(1, g.dense.by[id] ?? g.dense.dps) / base) / Math.log(x) : 1);
  return {
    levels: lv,
    eCd: Math.max(0, Math.min(1.5, el(perturb.cd, 1 / GAUGE_PERTURB.cooldown))),
    eArea: Math.max(0, Math.min(2, el(perturb.area, GAUGE_PERTURB.area))),
    eAmt: perturb.amount ? Math.max(0, Math.min(1, ((perturb.amount.dense.by[id] ?? perturb.amount.dense.dps) / base - 1) / GAUGE_PERTURB.amount)) : 0.3,
  };
}

/** A weapon's gauged numbers at any level (piecewise linear between the gauged ones). */
function atLevel(g: WeaponGauge, level: number): { dense: number; hps: number; boss: number } {
  const ks = Object.keys(g.levels).map(Number).sort((a, b) => a - b);
  if (!ks.length) return { dense: 0, hps: 0, boss: 0 };
  if (level <= ks[0]) return g.levels[ks[0]];
  for (let i = 1; i < ks.length; i++) {
    if (level <= ks[i]) {
      const a = g.levels[ks[i - 1]];
      const b = g.levels[ks[i]];
      const f = (level - ks[i - 1]) / (ks[i] - ks[i - 1]);
      return { dense: a.dense + (b.dense - a.dense) * f, hps: a.hps + (b.hps - a.hps) * f, boss: a.boss + (b.boss - a.boss) * f };
    }
  }
  return g.levels[ks[ks.length - 1]];
}

export interface BuildPoint {
  level: number;
  /** Damage per second against a walking-in horde of each HP (horde gauges; log-log interpolated). */
  horde?: { hp: number; dps: number }[];
  /** Crowd dps, hit rate (kills/s ceiling), single-target dps (bossDmg included), and the stats used. */
  dense: number;
  hps: number;
  boss: number;
  stats: PathStats;
  weapons: [string, number][];
}

/**
 * Analytic DPS of a build: sum over weapons of the gauged base numbers x might x crit x
 * (cooldown, area, amount elasticities) x mastery damage. `corr` scales it to the snapshot
 * gauges of real builds (relics / talents / passive behaviours the stats don't show).
 */
export function buildDps(weapons: readonly [string, number][], s: PathStats, table: WeaponTable, weaponDamage: Record<string, number> = {}, baseOf: (id: string) => string = (x) => x): { dense: number; hps: number; boss: number } {
  const critF = (1 + s.crit * (s.critMult - 1)) / (1 + GAUGE_BASE.crit * (GAUGE_BASE.critMult - 1));
  let dense = 0;
  let hps = 0;
  let boss = 0;
  for (const [id, lv] of weapons) {
    const g = table[id];
    if (!g) continue;
    const v = atLevel(g, lv);
    const b = baseOf(id);
    const mastery = 1 + (weaponDamage[id] ?? 0) + (b !== id ? (weaponDamage[b] ?? 0) : 0);
    const cdF = Math.pow(GAUGE_BASE.cooldown / Math.max(0.35, s.cooldown), g.eCd);
    const areaF = Math.pow(Math.max(0.2, s.area), g.eArea);
    const amtF = Math.max(0.2, 1 + g.eAmt * (s.amount - GAUGE_BASE.amount));
    const k = s.might * critF * cdF * areaF * amtF * mastery;
    dense += v.dense * k;
    boss += v.boss * k * s.bossDmg;
    hps += v.hps * cdF * Math.max(0.2, 1 + g.eAmt * s.amount) * Math.pow(Math.max(0.2, s.area), g.eArea * 0.5);
  }
  return { dense, hps, boss };
}

// ---------------------------------------------------------------- the run

export interface CellInput {
  stage: StageModel;
  /** The bot's build per level (index = level - 1), with corrected DPS. */
  build: BuildPoint[];
  startLevel: number;
  diff: DifficultyLike;
  adaptMax: number;
  /** Boss contact damage by id (pressure while it lives). */
  bossDmg: Record<string, number>;
  /** Per-boss calibration from the boss samples: TTK x and pressure x (1 = the pure model). */
  bossK?: Record<string, { ttk: number; hit: number }>;
  /** Stage hit-rate x from the slices (1 = the pure model). */
  hitK?: number;
  /** Child spawns (splits, spores, dropped frames) per regular kill over time, with their base HP / XP (census jobs). */
  children?: ChildPoint[];
}

export interface ChildPoint {
  at: number;
  ratio: number;
  hp: number;
  xp: number;
}

function childAt(cs: ChildPoint[] | undefined, t: number): ChildPoint | null {
  if (!cs?.length) return null;
  if (t <= cs[0].at) return cs[0];
  for (let i = 1; i < cs.length; i++)
    if (t <= cs[i].at) {
      const a = cs[i - 1];
      const b = cs[i];
      const f = (t - a.at) / (b.at - a.at);
      return { at: t, ratio: a.ratio + (b.ratio - a.ratio) * f, hp: a.hp + (b.hp - a.hp) * f, xp: a.xp + (b.xp - a.xp) * f };
    }
  return cs[cs.length - 1];
}

/** Child spawn points from census results (per stage): ratio = other / director spawns, the children's mean base HP / XP. */
export function childPoints(points: { at: number; dir: number; other: number; by: Record<string, number> }[]): ChildPoint[] {
  return points.map((p) => {
    let n = 0;
    let hp = 0;
    let xp = 0;
    for (const [id, k] of Object.entries(p.by)) {
      const d = ENEMIES.get(id);
      if (!d) continue;
      n += k;
      hp += k * d.hp;
      xp += k * d.xp;
    }
    return { at: p.at, ratio: p.dir > 0 ? p.other / p.dir : 0, hp: n ? hp / n : 1, xp: n ? xp / n : 0 };
  });
}

export interface ModelMark {
  t: number;
  /** Near / far alive, effective enemy HP, the build's crowd dps (before engagement) and hits/s, adaptive toughness, HP. */
  near?: number;
  far?: number;
  hEff?: number;
  dense?: number;
  hits?: number;
  adapt?: number;
  level: number;
  alive: number;
  kills: number;
  dmg: number;
  hp: number;
  xp: number;
  inHp: number;
  dps: number;
}

export interface ModelRun {
  outcome: "clear" | "death" | "timeout";
  end: number;
  /** First time the screen reaches 90 % of its cap (s, -1 = never). */
  sat: number;
  bosses: { id: string; at: number; ttk: number; killed: boolean; level: number }[];
  marks: ModelMark[];
  revivesUsed: number;
  levels: number[];
}

const DT = 0.5;

/** A build's damage per second against a horde of `hp` HP enemies (log-log between the gauged HPs). */
export function hordeDps(b: BuildPoint, hp: number): number {
  const h = b.horde;
  if (!h?.length) return b.dense;
  if (hp <= h[0].hp) return h[0].dps;
  for (let i = 1; i < h.length; i++)
    if (hp <= h[i].hp) {
      const f = Math.log(hp / h[i - 1].hp) / Math.log(h[i].hp / h[i - 1].hp);
      return Math.exp(Math.log(Math.max(1, h[i - 1].dps)) * (1 - f) + Math.log(Math.max(1, h[i].dps)) * f);
    }
  return h[h.length - 1].dps;
}

/**
 * The combo rank a kill rate sustains (each kill puts CFG.comboRefill[rank + 1] seconds back on the timer:
 * holding a rank needs kills/s x refill >= 1) -> its gem-XP multiplier (World.comboMult). Getting hit a lot
 * drops a rank.
 */
export function comboXpMul(kps: number, hitsPerS: number): number {
  let r = -1;
  for (let i = 0; i < RANKS.length; i++) if (kps * CFG.comboRefill[i + 1] >= 1) r = i;
  if (hitsPerS > 0.5) r--;
  return r >= 0 ? RANKS[r].mult : 1;
}

/** One deterministic model run of a cell (noise: DPS x kd, hit rate x kh). */
export function runModel(c: CellInput, th: Theta, kd = 1, kh = 1, markEvery = 30): ModelRun {
  const st = c.stage;
  const end = st.duration + 300;
  let t = 0;
  /** Near (in reach, on the hero) and far (walking in from the edge) enemies. */
  let N = 0;
  let F = 0;
  let L = Math.max(1, c.startLevel);
  let xpBar = 0;
  let xpTot = 0;
  let kills = 0;
  let dmgTot = 0;
  const bp = (lv: number) => c.build[Math.max(0, Math.min(c.build.length - 1, lv - 1))];
  let b = bp(L);
  let hp = b.stats.maxHp;
  let revives = b.stats.revives;
  let revUsed = 0;
  let shield = b.stats.shield;
  let shieldT = 0;
  let adapt = 0;
  let acc = 0;
  let sat = -1;
  const evs = [...st.events];
  let ei = 0;
  let boss: { id: string; hp: number; at: number; mul: number; final: boolean; level: number } | null = null;
  let pendingBoss: { e: ModelEvent; t: number } | null = null;
  let introT = 0;
  let eliteHp = 0;
  let eliteN = 0;
  /** Smoothed kills per second (the combo rank) and the last hit rate. */
  let kps = 0;
  let lastHits = 0;
  const bosses: ModelRun["bosses"] = [];
  const marks: ModelMark[] = [];
  const levels: number[] = [];
  let nextMark = markEvery;
  let outcome: ModelRun["outcome"] = "timeout";
  // the opening ring (a few easy enemies)
  N = stageDef(st.id).opening.count;
  for (; t < end; t += DT) {
    const P = st.at(t);
    // events
    while (ei < evs.length && evs[ei].at <= t) {
      const e = evs[ei++];
      if (e.kind === "boss") pendingBoss = { e, t: t + c.diff.bossWarning };
      else if (e.kind === "elite") {
        eliteN += e.elites;
        eliteHp += e.elites * e.hp;
      } else F = Math.min(P.cap * 1.25 - N, F + e.count * Math.min(1, e.hp / Math.max(1, P.hp)));
    }
    if (pendingBoss && t >= pendingBoss.t) {
      const e = pendingBoss.e;
      pendingBoss = null;
      boss = { id: e.boss!, hp: e.bossHp! * (c.bossK?.[e.boss!]?.ttk ?? 1), at: t, mul: e.spawnMul ?? 0.4, final: !!e.final, level: L };
      introT = BOSS_INTRO;
    }
    const spawnMul = boss ? boss.mul : 1;
    // arrivals (the director: pressure floor below MIN_ALIVE of the cap; paused during a boss intro)
    if (introT > 0) introT -= DT;
    const intro = introT > 0 ? 0 : 1;
    const alive = N + F;
    const floor = P.cap * MIN_ALIVE * spawnMul * intro;
    const deficit = floor > 0 && alive < floor ? 1 - alive / floor : 0;
    const curse = b.stats.curse ?? 0;
    acc += P.rate * spawnMul * intro * (1 + 3 * deficit) * (1 + curse) * DT;
    const room = Math.max(0, P.cap - alive);
    const add = Math.min(room, Math.floor(acc));
    acc -= Math.floor(acc);
    if (room <= 0) acc = Math.min(acc, 1);
    F += add;
    // the walk in
    const inN = F * (1 - Math.exp(-DT / Math.max(0.2, th.tau)));
    F -= inN;
    N += inN;
    // adaptive toughness (the director counts everything alive)
    if (t >= ADAPT_FROM && intro) {
      const af = P.cap * ADAPT_FLOOR * spawnMul;
      if (N + F < af) adapt = Math.min(c.adaptMax, adapt + 0.03 * (1 - (N + F) / af) * DT);
      else adapt = Math.max(0, adapt - 0.02 * DT);
    }
    // kills
    b = bp(L);
    const hEff = P.hp * (1 + adapt) * (1 + 0.25 * curse);
    // the horde gauge was measured at HORDE_ALIVE enemies on screen: fewer in reach -> less of it is usable
    const eng = Math.min(1.5, (N / (N + th.n50)) * ((100 + th.n50) / 100));
    const crowdDps = hordeDps(b, hEff) * th.eff * kd * (boss ? 1 - th.bossDrain : 1);
    let budget = crowdDps * DT;
    // elites first (they are tanky; the build chews through them)
    if (eliteHp > 0) {
      const used = Math.min(eliteHp, budget * 0.3);
      eliteHp -= used;
      budget -= used;
      if (eliteHp <= 1) {
        const xs = gemXpScale(t);
        const g = eliteN * Math.max(25, P.xp * 10) * xs * b.stats.growth * th.collect;
        xpBar += g;
        xpTot += g;
        kills += eliteN;
        eliteN = 0;
        eliteHp = 0;
      }
    }
    const kCap = Infinity;
    const Kn = Math.min(N, (budget * eng) / Math.max(1, hEff), kCap);
    N -= Kn;
    // leftover DPS reaches enemies still walking in (strong builds keep the screen empty -> the floor boost -> more XP)
    const left = Math.max(0, budget - Kn * hEff);
    const Kf = Math.min(F, (left * th.reach) / Math.max(1, hEff), Math.max(0, kCap - Kn));
    F -= Kf;
    const K = Kn + Kf;
    kills += K;
    kps += (K / DT - kps) * Math.min(1, DT / 3);
    const combo = comboXpMul(kps, lastHits);
    const xs = gemXpScale(t) * combo;
    let gain = K * P.xp * xs * b.stats.growth * th.collect;
    // children (spores, splits, dropped frames) appear where their parents die: in reach, as HP-equivalent enemies
    const ch = childAt(c.children, t);
    if (ch && ch.ratio > 0) {
      const nc = K * ch.ratio;
      N += nc * Math.min(3, (ch.hp * enemyHpScale(t, st.scaling) * c.diff.enemyHp) / Math.max(1, P.hp));
      kills += nc;
      gain += nc * ch.xp * xs * b.stats.growth * th.collect;
    }
    xpBar += gain;
    xpTot += gain;
    // the boss
    if (boss) {
      const enr = boss.final && t >= st.enrageAt ? 1 : 0;
      boss.hp -= b.boss * th.bossEff * kd * DT;
      if (boss.hp <= 0) {
        bosses.push({ id: boss.id, at: boss.at, ttk: t - boss.at, killed: true, level: boss.level });
        const g = 100 * xs * b.stats.growth;
        xpBar += g;
        xpTot += g;
        kills++;
        const fin = boss.final;
        boss = null;
        if (fin) {
          outcome = "clear";
          break;
        }
      } else if (enr) boss.mul = Math.max(boss.mul, 0.4);
    }
    // level-ups (heal 3 % max HP each)
    while (xpBar >= xpToNext(L)) {
      xpBar -= xpToNext(L);
      L++;
      levels.push(t);
      const nb = bp(L);
      if (nb.stats.maxHp > b.stats.maxHp) hp += nb.stats.maxHp - b.stats.maxHp;
      b = nb;
      if (c.diff.levelHeal) hp = Math.min(b.stats.maxHp, hp + Math.max(3, b.stats.maxHp * CFG.levelHeal) * b.stats.healMul);
    }
    // damage taken
    const fill = Math.min(1.25, N / Math.max(1, P.cap));
    // contact (enemies in reach, steeply with the fill) + bullets (every ranged enemy alive shoots)
    let hits = Math.min(1 / CFG.hurtIframes, (th.h0 * Math.pow(fill, th.p) + (th.hr * P.ranged * (N + F)) / 100) * kh * (c.hitK ?? 1));
    let dmg = hits * Math.max(1, P.dmg - b.stats.armor) * (1 - b.stats.dmgReduction);
    if (eliteN > 0) dmg += 0.15 * kh * eliteN * Math.max(1, P.dmg * CFG.elite.dmg - b.stats.armor) * (1 - b.stats.dmgReduction);
    if (boss) {
      const bk = c.bossK?.[boss.id]?.hit ?? 1;
      const enr = boss.final && t >= st.enrageAt ? th.enrage : 1;
      const bh = th.hb * kh * bk * enr;
      hits += bh;
      dmg += bh * Math.max(1, (c.bossDmg[boss.id] ?? 20) - b.stats.armor) * (1 - b.stats.dmgReduction);
    }
    // shields eat whole hits
    if (b.stats.shield > 0) {
      shieldT += DT;
      if (shieldT >= b.stats.shieldCd && shield < b.stats.shield) {
        shield++;
        shieldT = 0;
      }
      const eat = Math.min(shield, hits * DT);
      if (hits > 0) dmg *= 1 - eat / Math.max(1e-9, hits * DT);
      shield -= eat;
    }
    lastHits = hits;
    const heal = (b.stats.regen + th.food * b.stats.healMul * (c.diff.food ? 1 : 0)) * DT;
    hp = Math.min(b.stats.maxHp, hp - dmg * DT + heal);
    dmgTot += dmg * DT;
    if (sat < 0 && N + F >= 0.9 * P.cap && t > 5) sat = t;
    if (hp <= 0) {
      if (revives > 0) {
        revives--;
        revUsed++;
        hp = b.stats.maxHp * 0.5;
        N *= 0.3;
        F *= 0.5;
        if (boss) boss.hp -= (boss.hp / 0.9) * 0.1;
      } else {
        outcome = "death";
        if (boss) bosses.push({ id: boss.id, at: boss.at, ttk: t - boss.at, killed: false, level: boss.level });
        boss = null;
        break;
      }
    }
    if (t + DT >= nextMark) {
      marks.push({ t: nextMark, level: L, alive: Math.round(N + F), kills: Math.round(kills), dmg: Math.round(dmgTot), hp: Math.max(0, hp) / b.stats.maxHp, xp: Math.round(xpTot), inHp: P.inHp, dps: crowdDps * eng, near: Math.round(N), far: Math.round(F), hEff: Math.round(hEff), dense: Math.round(b.dense), hits: Math.round(hits * 100) / 100, adapt: Math.round(adapt * 100) / 100 });
      nextMark += markEvery;
    }
  }
  if (boss) bosses.push({ id: boss.id, at: boss.at, ttk: t - boss.at, killed: false, level: boss.level });
  return { outcome, end: Math.min(t, end), sat, bosses, marks, revivesUsed: revUsed, levels };
}

/** Deterministic normal draws (Box-Muller on a fixed LCG): the same draws every run. */
export function draws(n: number, seed = 12345): [number, number][] {
  let s = seed >>> 0;
  const u = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) + 0.5) / 4294967296;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(-2 * Math.log(u()));
    const a = 2 * Math.PI * u();
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

export interface CellPrediction {
  /** Share of noise draws (x heroes) that clear, median end time of the deaths, median boss TTKs. */
  clear: number;
  deathMed: number;
  deathLo: number;
  deathHi: number;
  sat: number;
  bosses: { id: string; ttk: number; killRate: number; reach: number }[];
  /** The deterministic (no-noise) run per hero. */
  runs: ModelRun[];
  /** End times of the noise draws (Infinity = cleared): survival curves. */
  ends: number[];
}

/** Share of a prediction's noise draws still alive (or cleared) at time t. */
export function survivalAt(p: CellPrediction, t: number): number {
  return p.ends.length ? p.ends.filter((e) => e > t).length / p.ends.length : 1;
}

export const med = (a: number[]): number => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length & 1 ? v[m] : (v[m - 1] + v[m]) / 2;
};
export const q = (a: number[], f: number): number => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  return v.length ? v[Math.min(v.length - 1, Math.floor(f * v.length))] : NaN;
};

/** Clear %, death times and boss TTKs over heroes x noise draws. */
export function predictCell(inputs: CellInput[], th: Theta, nDraws = 16): CellPrediction {
  const runs = inputs.map((c) => runModel(c, th));
  const all: ModelRun[] = [];
  const dz = draws(nDraws);
  for (const c of inputs) for (const [z1, z2] of dz) all.push(runModel(c, th, Math.exp(th.sd * z1), Math.exp(th.sh * z2), 1e9));
  const clears = all.filter((r) => r.outcome === "clear").length;
  const deaths = all.filter((r) => r.outcome !== "clear").map((r) => r.end);
  const ids: string[] = [];
  for (const r of all) for (const b of r.bosses) if (!ids.includes(b.id)) ids.push(b.id);
  const bosses = ids.map((id) => {
    const f = all.map((r) => r.bosses.find((b) => b.id === id)).filter((x): x is ModelRun["bosses"][number] => !!x);
    const k = f.filter((x) => x.killed);
    return { id, ttk: med(k.map((x) => x.ttk)), killRate: f.length ? k.length / f.length : 0, reach: f.length / all.length };
  });
  return { clear: clears / all.length, deathMed: med(deaths), deathLo: q(deaths, 0.25), deathHi: q(deaths, 0.75), sat: med(runs.map((r) => (r.sat >= 0 ? r.sat : NaN))), bosses, runs, ends: all.map((r) => (r.outcome === "clear" ? Infinity : r.end)) };
}

