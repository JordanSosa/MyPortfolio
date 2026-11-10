/**
 * The balance lab's weapon bench (`npm run balance:lab -- --weapons`, tools/balance-lab/weapons.ts): the plumbing.
 * The plan (every base weapon at Lv1 / its last level / EVERY evolution, signature weapons on their hero, the kit
 * without the tested weapon, shared baselines), the aggregation (ratios to the tier median, WEAK / STRONG / SUPPORT
 * flags, the sibling comparison), the cache key and one tiny real job. The measurements themselves are the tool's
 * output, not asserted here.
 */
import { describe, expect, test } from "vitest";
import { HERO_BY_ID } from "../src/game/heroes";
import { baseWeapons, evolutionsOf, WEAPONS } from "../src/game/registry";
import type { WeaponDef } from "../src/game/types";
import { jobKey } from "../tools/balance-lab/exec";
import { runJob, type GaugeResult, type Job, type WeaponJob, type WeaponRec } from "../tools/balance-lab/jobs";
import { parseOverride } from "../tools/balance-lab/overrides";
import { aggregate, benchMarkdown, benchPlan, heroOf, KIT, KIT_SPARE, kitFor, median, madRel, TIERS, variantsOf, type Res } from "../tools/balance-lab/weapons";

const def = (id: string, over: Partial<WeaponDef> = {}): WeaponDef => ({ id, name: id.toUpperCase(), icon: "", color: 0, desc: "", levels: [{ dmg: 1 }, { dmg: 2 }, { dmg: 3 }, { dmg: 4 }, { dmg: 5 }] as WeaponDef["levels"], upgrades: [], update() {}, ...over });

/** Synthetic results: every weapon deals `k(id)` x a typical weapon; `guard(id)` scales the damage the hero takes. */
function fake(jobs: Job[], k: (id: string) => number, guard: (id: string) => number = () => 1): Res {
  return jobs.map((j) => {
    if (j.kind === "gauge") {
      const x = k(j.weapons[0][0]);
      return { dense: { dps: 100 * x, hps: 1, by: {} }, boss: { dps: 10 * x, by: {} } } satisfies GaugeResult;
    }
    const w = j as WeaponJob;
    const x = w.test ? k(w.test) : 0;
    const kit = 3000;
    const rec: WeaponRec = { T: w.len, dealt: kit + 1000 * x, test: 1000 * x, kills: Math.round(50 + 20 * x), taken: Math.round(200 * (w.test ? guard(w.test) : 1)), healed: 0, hits: 10, blocks: 0, refills: 0, alive: 100 };
    if (w.mode === "arena") rec.ttc = 20 / Math.max(0.1, x);
    if (w.mode === "boss") rec.boss = { ttk: -1, left: 0.5, dealt: 300 + 100 * x, test: 100 * x };
    return rec;
  });
}

describe("weapon bench: the plan", () => {
  test("every base weapon gets Lv1, its last level and EVERY evolution; signature weapons run on their hero", () => {
    const vs = variantsOf();
    for (const b of baseWeapons()) {
      const mine = vs.filter((v) => v.base === b.id);
      expect(mine.filter((v) => v.tier === "L1").map((v) => [v.id, v.level])).toEqual([[b.id, 1]]);
      expect(mine.filter((v) => v.tier === "L5").map((v) => [v.id, v.level])).toEqual([[b.id, b.levels.length]]);
      const evos = evolutionsOf(b).filter((e) => WEAPONS.has(e.into));
      expect(mine.filter((v) => v.tier === "evo").map((v) => `${v.id}+${v.passive}`).sort()).toEqual(evos.map((e) => `${e.into}+${e.with}`).sort());
      const sig = [...HERO_BY_ID.values()].find((h) => h.weapon === b.id);
      for (const v of mine) expect([v.hero, v.signature]).toEqual(sig ? [sig.id, true] : ["hoshi", false]);
    }
    expect(new Set(vs.map((v) => v.key)).size).toBe(vs.length);
  });

  test("a weapon with several evolutions: one row per evolution, compared as siblings", () => {
    const defs = [
      def("orb", { evolutions: [{ into: "orb_a", with: "magnet_star" }, { into: "orb_b", with: "power_bow" }, { into: "missing", with: "wish_charm" }] }),
      def("orb_a", { evolved: true }),
      def("orb_b", { evolved: true }),
      def("plain"),
    ];
    const vs = variantsOf(defs, undefined, [{ id: "mochi", weapon: "orb" }]);
    expect(vs.map((v) => v.key)).toEqual(["orb@L1", "orb@L5", "orb_a@evo", "orb_b@evo", "plain@L1", "plain@L5"]);
    expect(vs.filter((v) => v.tier === "evo").map((v) => [v.base, v.passive, v.hero])).toEqual([["orb", "magnet_star", "mochi"], ["orb", "power_bow", "mochi"]]);
    // --only by an evolution's id keeps the whole family
    expect(variantsOf(defs, ["orb_b"]).map((v) => v.id)).toEqual(["orb", "orb", "orb_a", "orb_b"]);
    const plan = benchPlan({ seeds: [1], bot: "mid" }, vs);
    const b = aggregate(plan, fake(plan.jobs, (id) => (id === "orb_a" ? 2 : id === "orb_b" ? 0.5 : 1)));
    const sib = b.siblings.find((s) => s.base === "orb")!;
    expect(sib.evos.map((e) => e.id)).toEqual(["orb_a", "orb_b"]);
    expect(sib.evos[0].vsBest).toBe(1);
    expect(sib.evos[1].vsBest).toBeLessThan(0.5);
    expect(sib.flag).toMatch(/apart/);
    expect(b.flags.some((f) => f.startsWith("SIBLINGS"))).toBe(true);
    expect(b.siblings.some((s) => s.base === "plain")).toBe(false);
  });

  test("the reference kit never holds the tested weapon; baselines are shared and every build is real", () => {
    for (const t of TIERS) {
      expect(kitFor("star_shot", t).map((x) => x[0])).toHaveLength(KIT.length);
      const k = kitFor(KIT[0], t).map((x) => x[0]);
      expect(k).not.toContain(KIT[0]);
      const spare = t.kitLevel ? KIT_SPARE : evolutionsOf(WEAPONS.get(KIT_SPARE)!)[0].into;
      expect(k).toContain(spare);
    }
    const plan = benchPlan({ seeds: [1, 2], bot: "mid" });
    const heroIds = new Set([...HERO_BY_ID.keys()]);
    for (const j of plan.jobs) {
      expect(heroIds.has((j as WeaponJob).hero)).toBe(true);
      for (const [id] of (j as WeaponJob).weapons) expect(WEAPONS.has(id), id).toBe(true);
      if (j.kind !== "weapon") continue;
      expect(new Set(j.weapons.map((x) => x[0])).size).toBe(j.weapons.length);
      if (j.mode !== "arena") expect(j.weapons.length).toBe(KIT.length + (j.test ? 1 : 0));
    }
    // no job twice; the kit-alone baselines are shared (every general weapon on Hoshi reads the same ones)
    expect(new Set(plan.jobs.map((j) => JSON.stringify(j))).size).toBe(plan.jobs.length);
    const baselines = plan.jobs.filter((j) => j.kind === "weapon" && !j.test).length;
    const uses = Object.values(plan.at).reduce((s, a) => s + a.base.length + a.baseBoss.length + a.baseCamp.length, 0);
    expect(baselines).toBeLessThan(uses * 0.8);
    for (const a of Object.values(plan.at)) {
      expect(a.arena).toHaveLength(2);
      expect(a.base).toHaveLength(4);
      expect(a.gauge).toBeGreaterThanOrEqual(0);
    }
    expect(heroOf("yarn_orbit")).toEqual({ hero: "mochi", signature: true });
    expect(heroOf("candy_bomb")).toEqual({ hero: "hoshi", signature: false });
  });
});

describe("weapon bench: aggregation and flags", () => {
  const plan = benchPlan({ seeds: [1], bot: "mid" });
  const bases = baseWeapons().map((b) => b.id);
  const [weak, strong, support] = bases;
  const fam = (id: string) => plan.variants.find((v) => v.id === id)?.base ?? id;
  const k = (id: string) => (fam(id) === weak || fam(id) === support ? 0.2 : fam(id) === strong ? 3 : 1);
  const bench = aggregate(plan, fake(plan.jobs, k, (id) => (fam(id) === support ? 0.3 : 1)));
  const row = (id: string, tier: string) => bench.rows.find((r) => r.base === id && r.tier === tier)!;

  test("ratios to the tier median: a typical weapon is 1.00, outliers are flagged, a protective one is SUPPORT", () => {
    const typical = row(bases[5], "L5");
    expect(typical.power).toBeCloseTo(1, 5);
    expect(typical.flag).toBe("");
    expect(typical.share).toBeCloseTo(0.25, 5);
    expect(row(weak, "L5").flag).toBe("WEAK");
    expect(row(weak, "L5").power).toBeLessThan(0.6);
    expect(row(strong, "L5").flag).toBe("STRONG");
    expect(row(support, "L5").flag).toBe("SUPPORT");
    expect(row(support, "L5").takenX).toBeLessThan(0.4);
    expect(row(support, "L5").notes.join()).toMatch(/cuts damage taken/);
    // ranks: 1 = the strongest of its tier
    expect(row(strong, "L1").rank).toBe(1);
    expect(bench.tiers.map((t) => t.id)).toEqual(["L1", "L5", "evo"]);
    for (const t of bench.tiers) expect(t.n).toBe(bench.rows.filter((r) => r.tier === t.id).length);
    expect(bench.flags.filter((f) => f.startsWith("WEAK")).length).toBe(bench.rows.filter((r) => r.flag === "WEAK").length);
  });

  test("missing results do not throw; the Markdown report lists every row and the what-if arrows", () => {
    const holes = fake(plan.jobs, k).map((r, i) => (i % 7 === 0 ? undefined : r));
    expect(() => aggregate(plan, holes)).not.toThrow();
    const meta = { date: "2026-01-01T00:00:00Z", seeds: [1], bot: "mid", set: ["weapon.x.dmg*=2"], stats: { jobs: 1, hits: 0, cpuMs: 0, wallMs: 0, workers: 1 } };
    const md = benchMarkdown(bench, meta, aggregate(plan, fake(plan.jobs, () => 1)));
    for (const r of bench.rows) expect(md).toContain(`| ${r.name} |`);
    expect(md).toMatch(/1\.00 -> /);
    expect(md).toContain("## Evolutions of each weapon (siblings)");
  });

  test("median / MAD", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 100])).toBe(2.5);
    expect(median([NaN, 4])).toBe(4);
    expect(madRel([1, 2, 3, 4, 100])).toBeCloseTo(1 / 3, 5);
  });
});

describe("weapon bench: jobs", () => {
  const job: WeaponJob = { kind: "weapon", mode: "arena", hero: "hoshi", cp: null, stage: "dream_meadow", seed: 1, bot: "mid", weapons: [["star_shot", 1]], passives: [], test: "star_shot", level: 1, at: 20, len: 1.5, warm: 0, wave: 6, waveCap: 1.5 };

  test("the cache key follows the weapons held, not the others", () => {
    const k0 = jobKey(job, []);
    expect(jobKey(job, [])).toBe(k0);
    expect(jobKey(job, [parseOverride("weapon.star_shot.dmg*=2")])).not.toBe(k0);
    expect(jobKey(job, [parseOverride("weapon.galaxy_barrage.dmg*=2")])).not.toBe(k0);
    expect(jobKey(job, [parseOverride("weapon.candy_bomb.dmg*=2")])).toBe(k0);
    expect(jobKey(job, [parseOverride("stage.candy_kingdom.scaling.hp*=2")])).toBe(k0);
    expect(jobKey({ ...job, seed: 2 }, [])).not.toBe(k0);
  });

  test("a job runs the fixed build on the real World: deterministic, picks thrown away", () => {
    const a = runJob(job) as WeaponRec;
    expect(a).toEqual(runJob(job));
    expect(a.T).toBeCloseTo(1.5, 1);
    expect(a.test).toBe(a.dealt);
    expect(a.waveLeft).toBeGreaterThanOrEqual(0);
    const ref: WeaponJob = { ...job, mode: "slice", cp: "P2", weapons: [...kitFor("star_shot", TIERS[0]), ["star_shot", 1]], passives: TIERS[0].passives, level: 12, at: 60, len: 1, warm: 0.5, wave: undefined };
    const r = runJob(ref) as WeaponRec;
    expect(r.dealt).toBeGreaterThanOrEqual(r.test);
    expect(r.alive).toBeGreaterThan(0);
    const camp = runJob({ ...ref, play: "camp" }) as WeaponRec;
    expect(camp.T).toBeCloseTo(1, 1);
  });
});
