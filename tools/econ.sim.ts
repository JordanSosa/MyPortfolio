/**
 * Economy helpers (docs/META.md §9), not part of `npm test`:
 *
 *   npx vitest run --config tools/econ.vitest.config.ts --root . --disableConsoleIntercept
 *
 * ECON=fit (default): prices every run of a `node tools/matrix.mjs --stats` result
 *   (FIT_DATA, default tools/results/matrix-econ-data.json) with the live payout / hero XP /
 *   mastery formulas: per cell the median time, kills, coins picked up, payout coins,
 *   coins / min, gems, hero XP, top-weapon mastery XP. FIT_PATCH='{"payout.coinsPerMinute": 9,
 *   "stage.final_arc.rewardMul": 12}' tries a change offline (dotted TUNING paths, or
 *   stage.<id>.<field>); FIT_PICKED_MUL=0.5 scales the recorded coins picked up (when the
 *   in-run coin sources changed after the data was taken).
 * ECON=reprice: what each checkpoint's board ranks (tools/checkpoints.ts) cost under
 *   RINGS=15,220,1500,7000,22000 (TUNING.board.ringCost): the coin values META.md §9.1 needs
 *   so a ring-cost change keeps every checkpoint's power.
 */
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { buildBoard } from "../src/meta/board/graph";
import { gameContent } from "../src/meta/content";
import { computePayout, gradeRun, heroXpForRun, masteryXpForDamage } from "../src/meta/economy";
import { TUNING } from "../src/meta/tuning";
import { CHECKPOINTS, checkpointProfile } from "./checkpoints";

const med = (a: number[]) => {
  const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length & 1 ? v[m] : (v[m - 1] + v[m]) / 2;
};

function setPath(root: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  const last = parts.pop()!;
  let o: Record<string, unknown> = root;
  for (const k of parts) o = o[k] as Record<string, unknown>;
  o[last] = value;
}

interface Rec {
  cp: string;
  stage: string;
  kills: number;
  level: number;
  stats?: Record<string, unknown> & { stage: string; time: number; coins: number; stageCleared: boolean; eliteKills: number; bossKills: string[]; damageByWeapon: Record<string, number> };
}

function fit(): void {
  const ctx = gameContent();
  const d = JSON.parse(readFileSync(process.env.FIT_DATA ?? "tools/results/matrix-econ-data.json", "utf8")) as { runs: Rec[] };
  const patch = process.env.FIT_PATCH ? (JSON.parse(process.env.FIT_PATCH) as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(patch)) {
    if (k.startsWith("stage.")) {
      const [, id, f] = k.split(".");
      (ctx.stageById.get(id) as unknown as Record<string, unknown>)[f] = v;
    } else setPath(TUNING as unknown as Record<string, unknown>, k, v);
  }
  const pickedMul = Number(process.env.FIT_PICKED_MUL ?? 1);
  const groups = new Map<string, Rec[]>();
  for (const r of d.runs) if (r.stats) (groups.get(`${r.stage}|${r.cp}`) ?? groups.set(`${r.stage}|${r.cp}`, []).get(`${r.stage}|${r.cp}`)!).push(r);
  const order = ctx.stages.map((s) => s.id);
  const keys = [...groups.keys()].sort((a, b) => order.indexOf(a.split("|")[0]) - order.indexOf(b.split("|")[0]) || (a < b ? -1 : 1));
  console.log("cell                       n clr  min  kills  picked  coins  c/min  gems  heroXP  mastXP(top)");
  for (const k of keys) {
    const rows = groups.get(k)!.map((r) => {
      const s = { ...r.stats!, coins: Math.round(r.stats!.coins * pickedMul) } as unknown as Parameters<typeof gradeRun>[0];
      const stage = ctx.stageById.get(s.stage);
      const pay = computePayout({ stats: s, stage, grade: gradeRun(s), firstClear: false, firstBossKills: [], newHeatBadges: [] });
      const m = Object.entries(s.damageByWeapon)
        .filter(([w]) => ctx.weapons.has(w))
        .map(([, dmg]) => masteryXpForDamage(dmg));
      return { t: s.time, kills: r.kills, picked: s.coins, coins: pay.coins.total, gems: pay.gems.total, xp: heroXpForRun(s, stage), mTop: Math.max(0, ...m), clear: s.stageCleared ? 1 : 0 };
    });
    const m = (f: (x: (typeof rows)[0]) => number) => med(rows.map(f));
    console.log(
      `${k.padEnd(25)} ${String(rows.length).padStart(2)} ${String(rows.reduce((a, x) => a + x.clear, 0)).padStart(3)} ${(m((x) => x.t) / 60).toFixed(1).padStart(4)} ${String(Math.round(m((x) => x.kills))).padStart(6)} ${String(Math.round(m((x) => x.picked))).padStart(7)} ${String(Math.round(m((x) => x.coins))).padStart(6)} ${m((x) => x.coins / (x.t / 60)).toFixed(0).padStart(6)} ${String(Math.round(m((x) => x.gems))).padStart(5)} ${String(Math.round(m((x) => x.xp))).padStart(7)} ${String(Math.round(m((x) => x.mTop))).padStart(12)}`,
    );
  }
}

function reprice(): void {
  const rings = (process.env.RINGS ?? TUNING.board.ringCost.join(",")).split(",").map(Number);
  const ranks = CHECKPOINTS.map((c) => ({ id: c.id, ranks: { ...checkpointProfile(c.id, "hoshi").board.ranks } }));
  const old = TUNING.board.ringCost.slice();
  (TUNING.board as { ringCost: number[] }).ringCost = rings;
  try {
    const g = buildBoard();
    const byRing = [0, 0, 0, 0, 0, 0];
    for (const n of g.nodes) byRing[n.ring] += n.costs.reduce((a, b) => a + b, 0);
    console.log(`ring costs ${rings.join(" / ")}: ring totals ${byRing.slice(1).map((x) => Math.round(x).toLocaleString()).join(" / ")}, board ${byRing.reduce((a, b) => a + b, 0).toLocaleString()}`);
    for (const c of ranks) {
      let sum = 0;
      for (const [id, r] of Object.entries(c.ranks)) {
        const n = g.byId.get(id);
        if (n) for (let i = 0; i < r; i++) sum += n.costs[i];
      }
      console.log(`  ${c.id}: ${Object.values(c.ranks).reduce((a, b) => a + b, 0)} ranks cost ${sum.toLocaleString()}`);
    }
  } finally {
    (TUNING.board as { ringCost: number[] }).ringCost = old;
  }
}

test("economy helper", () => {
  if ((process.env.ECON ?? "fit") === "reprice") reprice();
  else fit();
}, 600_000);
