/**
 * The WEAPON BENCH (`npm run balance:lab -- --weapons`): is every weapon pulling its weight?
 *
 * Every base weapon is measured at Lv1, at Lv5 and as EACH of its evolutions (a weapon with several evolutions
 * gets one row per evolution and a sibling comparison), on its signature hero (general weapons: Hoshi):
 *
 *   gauge   alone, base stats: damage per second against a dense immortal crowd and a pinned boss (the lab's gauge:
 *           ideal conditions, deterministic)
 *   solo    alone, base stats, the mid bot, a real stage (Dream Meadow at the tier's run time): seconds to clear a
 *           fixed wave from the stage's mix, then a slice of the real director (kills / min, damage taken)
 *   build   inside a REFERENCE BUILD (a fixed kit of three general weapons + passives at the tier's levels) on the
 *           tier's checkpoint x stage: the weapon's share of the build's damage and its DPS, and what adding it to
 *           the kit changes (kills, damage taken net of healing, bullets blocked) against the same kit without it
 *   boss    the same build against the tier's stage boss: the weapon's share of the damage on the boss, its DPS
 *           on it, the fight's length with / without
 *
 * A row's numbers are compared with the MEDIAN of its tier (Lv1 / Lv5 / evolutions): `crowd`, `boss` and `power`
 * are ratios to it (1.00 = the typical weapon). Flags: power < 0.6 = WEAK unless the weapon clearly protects
 * (damage taken cut by 20 % or more = SUPPORT), power > 1.6 = STRONG. Evolutions of one weapon are also compared
 * with each other (`siblings`).
 *
 * Planning and aggregation here are pure (tests/weapon-bench.test.ts); the jobs run on the lab's pool and cache
 * (tools/balance-lab/job-weapon.ts, exec.ts). Method and limits: docs/DEVTOOLS.md §4.1.
 */
import { HERO_BY_ID } from "../../src/game/heroes";
import { evolutionsOf, WEAPONS } from "../../src/game/registry";
import type { WeaponDef } from "../../src/game/types";
import type { GaugeJob, GaugeResult, Job, WeaponJob, WeaponRec } from "./jobs";

// ---------------------------------------------------------------- the plan

export type TierId = "L1" | "L5" | "evo";

export interface Tier {
  id: TierId;
  label: string;
  /** Solo arena (base stats): stage, run time, slice length, wave size. */
  solo: { stage: string; at: number; len: number; wave: number; waveCap: number };
  /** Reference build cell: checkpoint x stage, slice start / length / warm-up, the boss fought, the hero's level then. */
  ref: { cp: string; stage: string; at: number; len: number; warm: number; boss: string; bossLen: number; level: number };
  /** The kit's weapon level (0 = the kit weapons' first evolutions) and passives. */
  kitLevel: number;
  passives: [string, number][];
}

/** The reference kit: three general weapons every account has early (a boomerang, a random strike, a bomb). */
export const KIT = ["heart_boomerang", "thunder_bell", "candy_bomb"];
/** Takes the place of a kit weapon while that weapon (or its evolution) is the one tested. */
export const KIT_SPARE = "prism_beam";

export const TIERS: readonly Tier[] = [
  {
    id: "L1",
    label: "Lv1 (just picked)",
    solo: { stage: "dream_meadow", at: 20, len: 40, wave: 30, waveCap: 40 },
    ref: { cp: "P2", stage: "dream_meadow", at: 90, len: 45, warm: 10, boss: "king_puff", bossLen: 90, level: 12 },
    kitLevel: 3,
    passives: [["power_bow", 1], ["wish_charm", 1]],
  },
  {
    id: "L5",
    label: "Lv5 (maxed)",
    solo: { stage: "dream_meadow", at: 150, len: 40, wave: 40, waveCap: 40 },
    ref: { cp: "P3", stage: "candy_kingdom", at: 300, len: 45, warm: 10, boss: "gingerbread_golem", bossLen: 90, level: 30 },
    kitLevel: 5,
    passives: [["power_bow", 3], ["wish_charm", 3], ["heart_locket", 2], ["twin_charm", 2]],
  },
  {
    id: "evo",
    label: "evolution",
    solo: { stage: "dream_meadow", at: 270, len: 40, wave: 50, waveCap: 40 },
    ref: { cp: "P4", stage: "shoujo_academy", at: 480, len: 45, warm: 10, boss: "council_president", bossLen: 90, level: 42 },
    kitLevel: 0,
    passives: [["power_bow", 4], ["wish_charm", 4], ["heart_locket", 3], ["twin_charm", 3], ["lucky_clover", 3]],
  },
];

export interface Variant {
  /** Row key: `<weapon id>@<tier>`. */
  key: string;
  /** The weapon def measured (the base weapon, or the evolved weapon) and its level. */
  id: string;
  level: number;
  name: string;
  tier: TierId;
  /** Base weapon id (itself for a base row) and, for an evolution, the passive of its recipe. */
  base: string;
  passive?: string;
  hero: string;
  signature: boolean;
}

/** The hero a weapon is benched on: the hero whose signature weapon it is, else Hoshi. */
export function heroOf(baseId: string, heroes: Iterable<{ id: string; weapon: string }> = HERO_BY_ID.values()): { hero: string; signature: boolean } {
  for (const h of heroes) if (h.weapon === baseId) return { hero: h.id, signature: true };
  return { hero: "hoshi", signature: false };
}

/** Every row of the bench: each base weapon at Lv1 and at its last regular level, and every evolution of it. */
export function variantsOf(defs: Iterable<WeaponDef> = WEAPONS.values(), only?: string[], heroes?: Iterable<{ id: string; weapon: string }>): Variant[] {
  const all = [...defs];
  const byId = new Map(all.map((d) => [d.id, d]));
  const hs = heroes ? [...heroes] : undefined;
  const out: Variant[] = [];
  for (const d of all) {
    if (d.evolved) continue;
    const evos = evolutionsOf(d);
    if (only?.length && !only.includes(d.id) && !evos.some((e) => only.includes(e.into))) continue;
    const { hero, signature } = heroOf(d.id, hs);
    out.push({ key: `${d.id}@L1`, id: d.id, level: 1, name: d.name, tier: "L1", base: d.id, hero, signature });
    out.push({ key: `${d.id}@L5`, id: d.id, level: d.levels.length, name: d.name, tier: "L5", base: d.id, hero, signature });
    for (const e of evos) {
      const into = byId.get(e.into);
      if (!into) continue;
      out.push({ key: `${into.id}@evo`, id: into.id, level: 1, name: into.name, tier: "evo", base: d.id, passive: e.with, hero, signature });
    }
  }
  return out;
}

/** A kit weapon at a tier ([id, level]; tier `evo`: its first evolution). */
function kitWeapon(id: string, t: Tier): [string, number] {
  if (t.kitLevel > 0) return [id, t.kitLevel];
  const d = WEAPONS.get(id);
  const evo = d ? evolutionsOf(d)[0] : undefined;
  return evo && WEAPONS.has(evo.into) ? [evo.into, 1] : [id, d?.levels.length ?? 5];
}

/** The kit next to a tested base weapon: the three kit weapons, the spare in for the tested one. */
export function kitFor(base: string, t: Tier): [string, number][] {
  return KIT.map((id) => kitWeapon(id === base ? KIT_SPARE : id, t));
}

/** The kit-alone baselines also run on these seeds + this (twice the samples under every ratio). */
export const BASE_SEED_SHIFT = 100;

export interface BenchOpts {
  seeds: number[];
  bot: string;
  only?: string[];
}

export interface BenchPlan {
  variants: Variant[];
  jobs: Job[];
  /** Per variant key: indices into `jobs`. */
  at: Record<string, { gauge: number; arena: number[]; slice: number[]; boss: number[]; camp: number[]; base: number[]; baseBoss: number[]; baseCamp: number[] }>;
}

/** The bench's jobs (deduplicated baselines: one per hero x tier x kit x seed). */
export function benchPlan(o: BenchOpts, variants: Variant[] = variantsOf(undefined, o.only)): BenchPlan {
  const jobs: Job[] = [];
  const at: BenchPlan["at"] = {};
  const baseIdx = new Map<string, number>();
  const push = (j: Job) => jobs.push(j) - 1;
  for (const v of variants) {
    const t = TIERS.find((x) => x.id === v.tier)!;
    const a: BenchPlan["at"][string] = { gauge: -1, arena: [], slice: [], boss: [], camp: [], base: [], baseBoss: [], baseCamp: [] };
    at[v.key] = a;
    const gauge: GaugeJob = { kind: "gauge", hero: v.hero, cp: null, weapons: [[v.id, v.level]], T: 6 };
    a.gauge = push(gauge);
    const kit = kitFor(v.base, t);
    const common = { kind: "weapon" as const, hero: v.hero, bot: o.bot, passives: t.passives };
    for (const seed of o.seeds) {
      const solo: WeaponJob = { kind: "weapon", mode: "arena", hero: v.hero, cp: null, stage: t.solo.stage, seed, bot: o.bot, weapons: [[v.id, v.level]], passives: [], test: v.id, level: 1, at: t.solo.at, len: t.solo.len, warm: 0, wave: t.solo.wave, waveCap: t.solo.waveCap };
      a.arena.push(push(solo));
      const ref = { ...common, cp: t.ref.cp, stage: t.ref.stage, seed, level: t.ref.level };
      const slice = (weapons: [string, number][], test: string): WeaponJob => ({ ...ref, mode: "slice", weapons, test, at: t.ref.at, len: t.ref.len, warm: t.ref.warm });
      const boss = (weapons: [string, number][], test: string): WeaponJob => ({ ...ref, mode: "boss", weapons, test, at: 0, len: t.ref.bossLen, warm: 0, boss: t.ref.boss });
      const camp = (weapons: [string, number][], test: string): WeaponJob => ({ ...slice(weapons, test), play: "camp" });
      a.slice.push(push(slice([...kit, [v.id, v.level]], v.id)));
      a.boss.push(push(boss([...kit, [v.id, v.level]], v.id)));
      a.camp.push(push(camp([...kit, [v.id, v.level]], v.id)));
    }
    // the kit alone (shared by every weapon of the hero x tier x kit), on twice the seeds: every ratio leans on it
    for (const seed of [...o.seeds, ...o.seeds.map((x) => x + BASE_SEED_SHIFT)]) {
      const ref = { ...common, cp: t.ref.cp, stage: t.ref.stage, seed, level: t.ref.level };
      const slice: WeaponJob = { ...ref, mode: "slice", weapons: kit, test: "", at: t.ref.at, len: t.ref.len, warm: t.ref.warm };
      const boss: WeaponJob = { ...ref, mode: "boss", weapons: kit, test: "", at: 0, len: t.ref.bossLen, warm: 0, boss: t.ref.boss };
      for (const [mode, list, job] of [["slice", a.base, slice], ["boss", a.baseBoss, boss], ["camp", a.baseCamp, { ...slice, play: "camp" }]] as const) {
        const k = `${mode}|${v.hero}|${t.id}|${kit.map((x) => x[0]).join(",")}|${seed}`;
        let i = baseIdx.get(k);
        if (i === undefined) {
          i = push(job);
          baseIdx.set(k, i);
        }
        list.push(i);
      }
    }
  }
  return { variants, jobs, at };
}

// ---------------------------------------------------------------- aggregation

export interface Row extends Variant {
  /** Gauge DPS: dense crowd / pinned boss (alone, base stats). */
  gCrowd: number;
  gBoss: number;
  /** Solo: seconds to clear 90 % of the wave (the cap when it never did: `soloStuck`), kills / min, net damage taken / min. */
  soloTtc: number;
  soloStuck: boolean;
  soloKpm: number;
  soloTaken: number;
  /** Reference build: share of the build's weapon damage, own DPS, kills and net damage taken against the kit alone (1 = no change). */
  share: number;
  dps: number;
  killsX: number;
  takenX: number;
  /** Net damage taken per minute with / without it (slice + boss fight), bullets blocked per minute, refills per minute (with / without). */
  taken: number;
  takenBase: number;
  blocks: number;
  refills: number;
  refillsBase: number;
  /** Stand-your-ground play (`camp`): the weapon's DPS in the build, kills and net damage taken against the kit alone played the same way. */
  campDps: number;
  campKillsX: number;
  campTakenX: number;
  /** Boss fight in the reference build: share of the weapon damage on the boss, own DPS on it, fight length with / without (s; estimated from the HP left when it outlasted the fight). */
  bossShare: number;
  bossDps: number;
  ttk: number;
  ttkBase: number;
  /** Ratios to the tier's median (1 = typical): crowd index, boss index, power (their mean); `camp` = its DPS standing ground. */
  crowd: number;
  boss: number;
  power: number;
  camp: number;
  rank: number;
  flag: "" | "WEAK" | "STRONG" | "SUPPORT";
  notes: string[];
}

export interface Sibling {
  base: string;
  name: string;
  /** Power of the base weapon at its last level (within the Lv5 tier). */
  l5Power: number;
  evos: { id: string; name: string; passive: string; power: number; crowd: number; boss: number; takenX: number; camp: number; vsBest: number; flag: string }[];
  /** Best / worst power among the evolutions (1 = one evolution, or equals). */
  spread: number;
  flag: string;
}

export interface Bench {
  rows: Row[];
  tiers: { id: TierId; label: string; n: number; median: Record<string, number>; mad: Record<string, number> }[];
  siblings: Sibling[];
  flags: string[];
}

export const WEAK = 0.6;
export const STRONG = 1.6;
/**
 * A weapon that cuts the damage taken by this share or more is a SUPPORT weapon, not a weak one (taken x is the
 * noisiest number of the bench - about +-15 % between seed sets - so the bar is well above that).
 */
export const SUPPORT_CUT = 0.4;
/** Evolutions of one weapon further apart than this are flagged. */
export const SIBLING_SPREAD = 1.6;

export const median = (a: number[]): number => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length & 1 ? v[m] : (v[m - 1] + v[m]) / 2;
};
/** Median absolute deviation as a share of the median (a robust spread). */
export const madRel = (a: number[]): number => {
  const m = median(a);
  return m > 0 ? median(a.filter(Number.isFinite).map((x) => Math.abs(x - m))) / m : NaN;
};
const mean = (a: number[]): number => {
  const v = a.filter(Number.isFinite);
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN;
};
const gm = (a: number[]): number => {
  const v = a.filter((x) => Number.isFinite(x));
  return v.length ? Math.exp(v.reduce((s, x) => s + Math.log(Math.max(x, 0.01)), 0) / v.length) : NaN;
};

/** Fight length: to the kill, or estimated from the HP left when the boss outlasted the measurement. */
const ttkOf = (r: WeaponRec): number => (!r.boss ? NaN : r.boss.ttk >= 0 ? r.boss.ttk : r.boss.left < 0.98 ? r.T / (1 - r.boss.left) : r.T * 50);
const net = (r: WeaponRec): number => (Math.max(0, r.taken - r.healed) / Math.max(1, r.T)) * 60;
/** Net damage taken per minute over several measurements (time-weighted). */
const netOf = (rs: WeaponRec[]): number => (rs.reduce((s, r) => s + Math.max(0, r.taken - r.healed), 0) / Math.max(1, rs.reduce((s, r) => s + r.T, 0))) * 60;
const perMin = (rs: WeaponRec[], f: (r: WeaponRec) => number): number => (rs.reduce((s, r) => s + f(r), 0) / Math.max(1, rs.reduce((s, r) => s + r.T, 0))) * 60;

export type Res = (GaugeResult | WeaponRec | undefined)[];

/** Rows, tier medians, flags and the sibling comparison from the job results (`res[i]` = the result of `plan.jobs[i]`). */
export function aggregate(plan: BenchPlan, res: Res): Bench {
  const rec = (i: number) => res[i] as WeaponRec | undefined;
  const all = (ix: number[]) => ix.map(rec).filter((r): r is WeaponRec => !!r);
  const rows: Row[] = [];
  for (const v of plan.variants) {
    const a = plan.at[v.key];
    const t = TIERS.find((x) => x.id === v.tier)!;
    const g = res[a.gauge] as GaugeResult | undefined;
    const arena = all(a.arena);
    const slice = all(a.slice);
    const boss = all(a.boss);
    const base = all(a.base);
    const baseBoss = all(a.baseBoss);
    const sum = (rs: WeaponRec[], f: (r: WeaponRec) => number) => rs.reduce((s, r) => s + f(r), 0);
    const camp = all(a.camp);
    const baseCamp = all(a.baseCamp);
    const taken = netOf([...slice, ...boss]);
    const takenBase = netOf([...base, ...baseBoss]);
    rows.push({
      ...v,
      gCrowd: g ? (g.dense.by[v.id] ?? g.dense.dps) : NaN,
      gBoss: g ? (g.boss.by[v.id] ?? g.boss.dps) : NaN,
      soloTtc: mean(arena.map((r) => (r.ttc !== undefined && r.ttc >= 0 ? r.ttc : t.solo.waveCap / Math.max(0.05, 1 - (r.waveLeft ?? 1))))),
      soloStuck: arena.some((r) => (r.ttc ?? -1) < 0),
      soloKpm: (sum(arena, (r) => r.kills) / Math.max(1, sum(arena, (r) => r.T))) * 60,
      soloTaken: mean(arena.map(net)),
      share: sum(slice, (r) => r.test) / Math.max(1, sum(slice, (r) => r.dealt)),
      dps: sum(slice, (r) => r.test) / Math.max(1, sum(slice, (r) => r.T)),
      killsX: perMin(slice, (r) => r.kills) / Math.max(1e-6, perMin(base, (r) => r.kills)),
      // (+3 HP / min on both sides: a kit that takes nearly nothing does not turn noise into a ratio)
      takenX: (taken + 3) / (takenBase + 3),
      taken,
      takenBase,
      blocks: perMin([...slice, ...boss], (r) => r.blocks),
      refills: perMin([...slice, ...boss], (r) => r.refills),
      refillsBase: perMin([...base, ...baseBoss], (r) => r.refills),
      campDps: sum(camp, (r) => r.test) / Math.max(1, sum(camp, (r) => r.T)),
      campKillsX: perMin(camp, (r) => r.kills) / Math.max(1e-6, perMin(baseCamp, (r) => r.kills)),
      campTakenX: (netOf(camp) + 3) / (netOf(baseCamp) + 3),
      bossShare: sum(boss, (r) => r.boss?.test ?? 0) / Math.max(1, sum(boss, (r) => r.boss?.dealt ?? 0)),
      bossDps: sum(boss, (r) => r.boss?.test ?? 0) / Math.max(1, sum(boss, (r) => r.T)),
      ttk: mean(boss.map(ttkOf)),
      ttkBase: mean(baseBoss.map(ttkOf)),
      crowd: NaN,
      boss: NaN,
      power: NaN,
      camp: NaN,
      rank: 0,
      flag: "",
      notes: [],
    });
  }
  const tiers: Bench["tiers"] = [];
  const METRICS = ["gCrowd", "gBoss", "soloKpm", "soloTtc", "share", "dps", "bossShare", "bossDps", "takenX", "killsX", "campDps", "campTakenX"] as const;
  for (const t of TIERS) {
    const rs = rows.filter((r) => r.tier === t.id);
    if (!rs.length) continue;
    const md: Record<string, number> = {};
    const mad: Record<string, number> = {};
    for (const k of METRICS) {
      md[k] = median(rs.map((r) => r[k]));
      mad[k] = madRel(rs.map((r) => r[k]));
    }
    const rel = (x: number, m: number) => (m > 0 && Number.isFinite(x) ? x / m : NaN);
    for (const r of rs) {
      // crowd: the weapon's damage in the reference build's fight and what it kills alone (bot-played, a real stage)
      r.crowd = gm([rel(r.dps, md.dps), rel(r.soloKpm, md.soloKpm)]);
      r.boss = rel(r.bossDps, md.bossDps);
      r.power = mean([r.crowd, r.boss]);
      r.camp = rel(r.campDps, md.campDps);
    }
    md.power = median(rs.map((r) => r.power));
    mad.power = madRel(rs.map((r) => r.power));
    // (power is a mean of ratios: re-centre it so 1.00 is the tier's median weapon)
    for (const r of rs) r.power = md.power > 0 ? r.power / md.power : r.power;
    md.power = 1;
    for (const r of rs) {
      // protection: with the bot, or standing ground (where auras, orbitals and the Kotatsu do their job)
      const cut = 1 - r.takenX;
      const campCut = 1 - r.campTakenX;
      const protects = cut >= SUPPORT_CUT || campCut >= SUPPORT_CUT;
      if (r.power < WEAK) r.flag = protects ? "SUPPORT" : r.camp >= WEAK ? "" : "WEAK";
      else if (r.power > STRONG) r.flag = "STRONG";
      if (cut >= SUPPORT_CUT) r.notes.push(`cuts damage taken ${Math.round(cut * 100)} %`);
      else if (campCut >= SUPPORT_CUT) r.notes.push(`cuts damage taken ${Math.round(campCut * 100)} % standing ground`);
      if (r.power < WEAK && r.camp >= WEAK) r.notes.push(`a stand-your-ground weapon (${r.camp.toFixed(2)}x standing ground)`);
      if (r.takenX > 1.5 && r.taken - r.takenBase > 20) r.notes.push(`hero takes ${Math.round((r.takenX - 1) * 100)} % more damage with it`);
      if (r.boss < 0.4 && r.crowd >= 1) r.notes.push("crowd specialist");
      if (r.crowd < 0.4 && r.boss >= 1) r.notes.push("boss specialist");
      if (r.soloStuck) r.notes.push("cannot clear the wave alone");
      const ideal = gm([rel(r.gCrowd, md.gCrowd), rel(r.gBoss, md.gBoss)]);
      if (Number.isFinite(ideal) && ideal > 0 && r.power / ideal < 0.4) r.notes.push(`plays far below its gauge (${ideal.toFixed(1)}x in ideal conditions): reach or the bot's play`);
      if (Number.isFinite(ideal) && ideal > 0 && r.power / ideal > 2.5) r.notes.push(`plays far above its gauge (${ideal.toFixed(1)}x in ideal conditions)`);
    }
    [...rs].sort((x, y) => y.power - x.power).forEach((r, i) => (r.rank = i + 1));
    tiers.push({ id: t.id, label: t.label, n: rs.length, median: md, mad });
  }
  // siblings: every evolution of a base weapon, next to each other and to the Lv5 base
  const siblings: Sibling[] = [];
  const bases = [...new Set(rows.map((r) => r.base))];
  for (const b of bases) {
    const evos = rows.filter((r) => r.base === b && r.tier === "evo");
    if (!evos.length) continue;
    const l5 = rows.find((r) => r.base === b && r.tier === "L5");
    const best = Math.max(...evos.map((r) => r.power));
    const worst = Math.min(...evos.map((r) => r.power));
    const spread = worst > 0 ? best / worst : NaN;
    siblings.push({
      base: b,
      name: l5?.name ?? b,
      l5Power: l5?.power ?? NaN,
      evos: evos.map((r) => ({ id: r.id, name: r.name, passive: r.passive ?? "", power: r.power, crowd: r.crowd, boss: r.boss, takenX: r.takenX, camp: r.camp, vsBest: best > 0 ? r.power / best : NaN, flag: r.flag })),
      spread,
      flag: evos.length > 1 && spread > SIBLING_SPREAD ? `evolutions ${spread.toFixed(1)}x apart` : "",
    });
  }
  const flags: string[] = [];
  for (const r of rows) if (r.flag) flags.push(`${r.flag} ${r.name} (${r.tier}): power ${r.power.toFixed(2)}x the tier median (crowd ${r.crowd.toFixed(2)}x, boss ${r.boss.toFixed(2)}x)${r.notes.length ? `; ${r.notes.join("; ")}` : ""}`);
  for (const s of siblings) if (s.flag) flags.push(`SIBLINGS ${s.name}: ${s.flag} (${s.evos.map((e) => `${e.name} ${e.power.toFixed(2)}x`).join(", ")})`);
  return { rows, tiers, siblings, flags };
}

// ---------------------------------------------------------------- report text

const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "-");
const f0 = (x: number) => (Number.isFinite(x) ? String(Math.round(x)) : "-");
const pc = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : "-");

export const HEAD = ["#", "weapon", "hero", "power", "crowd", "boss", "share", "boss share", "DPS / boss DPS", "solo kills/min", "wave s", "kills x", "taken x", "camp", "camp taken x", "gauge crowd / boss", "flag"];

export function rowCells(r: Row, was?: Row): string[] {
  const d = (x: number, y: number | undefined) => (y === undefined || !Number.isFinite(y) ? f2(x) : `${f2(y)} -> ${f2(x)}`);
  return [
    String(r.rank),
    r.name,
    `${r.hero}${r.signature ? "*" : ""}`,
    d(r.power, was?.power),
    d(r.crowd, was?.crowd),
    d(r.boss, was?.boss),
    pc(r.share),
    pc(r.bossShare),
    `${f0(r.dps)} / ${f0(r.bossDps)}`,
    f0(r.soloKpm),
    `${r.soloStuck ? ">" : ""}${f0(r.soloTtc)}`,
    f2(r.killsX),
    d(r.takenX, was?.takenX),
    d(r.camp, was?.camp),
    f2(r.campTakenX),
    `${f0(r.gCrowd)} / ${f0(r.gBoss)}`,
    [r.flag, ...r.notes].filter(Boolean).join("; "),
  ];
}

export interface BenchMeta {
  date: string;
  seeds: number[];
  bot: string;
  set: string[];
  stats: { jobs: number; hits: number; cpuMs: number; wallMs: number; workers: number };
}

export function benchMarkdown(b: Bench, meta: BenchMeta, was?: Bench): string {
  const md: string[] = [];
  const st = meta.stats;
  md.push(`# Weapon bench ${meta.date.slice(0, 16).replace("T", " ")}`, "");
  md.push(`${(st.wallMs / 1000).toFixed(1)} s wall, ${st.hits}/${st.jobs} jobs cached, ${Math.round(st.cpuMs / 1000)} s CPU on ${st.workers} workers; seeds ${meta.seeds.join(",")}, ${meta.bot} bot.${meta.set.length ? ` What-if: \`${meta.set.join(" ")}\` (before -> after).` : ""}`, "");
  md.push("power / crowd / boss = ratio to the tier's median weapon (1.00 = typical; < 0.6 WEAK, > 1.6 STRONG). share = of the reference build's weapon damage; kills x / taken x = the kit with the weapon against the kit alone (taken: net of healing, lower = it protects). camp = the same build played standing ground (DPS as a ratio to the tier median, damage taken against the kit alone played the same way). `*` = on its signature hero.", "");
  md.push("Flags:");
  for (const f of b.flags) md.push(`- ${f}`);
  if (!b.flags.length) md.push("- none");
  const wasBy = new Map((was?.rows ?? []).map((r) => [r.key, r]));
  for (const t of b.tiers) {
    md.push("", `## ${t.label} (${t.n} weapons)`, "");
    md.push(`Median: DPS in the build ${f0(t.median.dps)} (share ${pc(t.median.share)}), on the boss ${f0(t.median.bossDps)} (share ${pc(t.median.bossShare)}), solo ${f0(t.median.soloKpm)} kills/min, wave ${f0(t.median.soloTtc)} s, taken x${f2(t.median.takenX)}. Spread (MAD / median): power ${pc(t.mad.power)}, crowd DPS ${pc(t.mad.dps)}, boss DPS ${pc(t.mad.bossDps)}.`, "");
    md.push(`| ${HEAD.join(" | ")} |`, `| ${HEAD.map(() => "---").join(" | ")} |`);
    for (const r of b.rows.filter((x) => x.tier === t.id).sort((x, y) => x.rank - y.rank)) md.push(`| ${rowCells(r, wasBy.get(r.key)).join(" | ")} |`);
  }
  md.push("", "## Evolutions of each weapon (siblings)", "");
  md.push("| weapon | Lv5 power | evolution (passive) | power | crowd | boss | taken x | vs best sibling | flag |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const s of b.siblings) {
    s.evos.forEach((e, i) => md.push(`| ${i ? "" : s.name} | ${i ? "" : f2(s.l5Power)} | ${e.name} (${e.passive}) | ${f2(e.power)} | ${f2(e.crowd)} | ${f2(e.boss)} | ${f2(e.takenX)} | ${f2(e.vsBest)} | ${[e.flag, i ? "" : s.flag].filter(Boolean).join("; ")} |`));
  }
  return `${md.join("\n")}\n`;
}
