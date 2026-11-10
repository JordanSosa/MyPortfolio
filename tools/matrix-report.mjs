#!/usr/bin/env node
/**
 * Compact power-vs-stage grids from matrix results (tools/results/matrix-<name>.json, written by
 * `node tools/matrix.mjs --name <name>`): clear rate + median death time per checkpoint x stage,
 * median boss fight lengths, and the early-game feel numbers, as Markdown.
 *
 *   node tools/matrix-report.mjs after               # one result set
 *   node tools/matrix-report.mjs before after        # side by side ("before -> after")
 *   --bot mid  --twists max  (filter rows)
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(`--${k}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const botF = opt("bot") ?? "mid";
const twF = opt("twists") ?? "";
const names = args.length ? args : ["after"];
const load = (n) => JSON.parse(readFileSync(join(ROOT, `tools/results/matrix-${n}.json`), "utf8")).runs.filter((r) => (r.bot ?? "mid") === botF && (r.twists ?? "") === twF && !r.variant);
const sets = names.map(load);
const STAGES = ["dream_meadow", "candy_kingdom", "shoujo_academy", "beach_episode", "final_arc"];
const SHORT = { dream_meadow: "Dream Meadow", candy_kingdom: "Candy Kingdom", shoujo_academy: "Shoujo Academy", beach_episode: "Beach Episode", final_arc: "The Final Arc" };
const CPS = ["P0", "P1", "P1b", "P2", "P3", "P4", "P5", "P6", "P7", "P7r"];
const INTENDED = { dream_meadow: ["P2"], candy_kingdom: ["P3"], shoujo_academy: ["P4"], beach_episode: ["P5"], final_arc: ["P5", "P6"] };
const med = (a) => {
  const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length & 1 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const mmss = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "-");
const cell = (rs) => {
  if (!rs.length) return "";
  const c = rs.filter((r) => r.outcome === "clear").length;
  const d = med(rs.filter((r) => r.outcome === "death").map((r) => r.end));
  return `${Math.round((100 * c) / rs.length)}%${Number.isFinite(d) ? ` (${mmss(d)})` : ""}`;
};
const pick = (runs, cp, st) => runs.filter((r) => r.cp === cp && r.stage === st);

const out = [];
out.push(`Clear rate (median death time of the runs that died), mid bot, ${names.join(" -> ")}${twF ? `, twists ${twF}` : ""}; **bold** = the stage's intended checkpoint.\n`);
out.push(`| | ${STAGES.map((s) => SHORT[s]).join(" | ")} |`);
out.push(`| --- | ${STAGES.map(() => "---").join(" | ")} |`);
for (const cp of CPS) {
  const row = STAGES.map((st) => {
    const parts = sets.map((rs) => cell(pick(rs, cp, st))).filter(Boolean);
    if (!parts.length) return "";
    const txt = parts.join(" -> ");
    return INTENDED[st].includes(cp) ? `**${txt}**` : txt;
  });
  if (row.some(Boolean)) out.push(`| ${cp} | ${row.join(" | ")} |`);
}

// boss fights at the intended checkpoints (last set)
const last = sets[sets.length - 1];
out.push(`\nBoss fight length (s, median of kills, killed / reached) at the intended checkpoint(s), ${names[names.length - 1]}:\n`);
out.push(`| Stage | Checkpoint | Bosses |`);
out.push(`| --- | --- | --- |`);
for (const st of STAGES)
  for (const cp of INTENDED[st]) {
    const rs = pick(last, cp, st);
    if (!rs.length) continue;
    const ids = [];
    for (const r of rs) for (const b of r.bosses) if (!ids.includes(b.id)) ids.push(b.id);
    const txt = ids
      .map((id) => {
        const f = rs.map((r) => r.bosses.find((b) => b.id === id)).filter(Boolean);
        const k = f.filter((b) => b.dur >= 0);
        return `${id.replace(/_/g, " ")} ${Number.isFinite(med(k.map((b) => b.dur))) ? Math.round(med(k.map((b) => b.dur))) : "-"} (${k.length}/${f.length})`;
      })
      .join("; ");
    out.push(`| ${SHORT[st]} | ${cp} | ${txt} |`);
  }

// feel at the intended checkpoints + P0 Dream Meadow
out.push(`\nEarly-game feel (medians), ${names[names.length - 1]}:\n`);
out.push(`| Stage @ checkpoint | 1st level-up | level-up gap 0:20-3:00 | longest gap (no boss) | level 1/2/3 min | damage taken 0-1:30 / 1:30-3:00 | kills/s min 1-3 | alive min 1-3 |`);
out.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
const rows = [["dream_meadow", "P0"], ...STAGES.flatMap((st) => INTENDED[st].map((cp) => [st, cp]))];
for (const [st, cp] of rows) {
  const rs = pick(last, cp, st);
  if (!rs.length) continue;
  const m = (f) => med(rs.map(f));
  const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "-");
  const f0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : "-");
  out.push(
    `| ${SHORT[st]} @ ${cp} | ${f1(m((r) => r.first))} s | ${f1(m((r) => r.gapEarly))} s | ${f0(m((r) => r.gapMax))} s | ${[0, 1, 2].map((i) => f0(med(rs.map((r) => r.lv[i]).filter((x) => x > 0)))).join(" / ")} | ${f0(m((r) => r.dmg30[0] + r.dmg30[1] + r.dmg30[2]))} / ${f0(m((r) => r.dmg30[3] + r.dmg30[4] + r.dmg30[5]))} | ${[0, 1, 2].map((i) => f1(m((r) => r.kps[i]))).join(" / ")} | ${[0, 1, 2].map((i) => f0(m((r) => r.alive[i]))).join(" / ")} |`,
  );
}
console.log(out.join("\n"));
