/** The weapon bench's report files (`npm run balance:lab -- --weapons`): report.html / report.json / report.md. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CSS, esc, table } from "./report";
import { benchMarkdown, HEAD, KIT, KIT_SPARE, rowCells, SIBLING_SPREAD, STRONG, TIERS, WEAK, type Bench, type BenchMeta } from "./weapons";

const FLAG = HEAD.length - 1;
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "-");

function bar(x: number): string {
  if (!Number.isFinite(x)) return "";
  const cls = x < WEAK || x > STRONG ? " s2" : "";
  return `<span class="bar${cls}" style="width:${Math.max(2, Math.round(Math.min(3, x) * 40))}px"></span>`;
}

export function writeBench(out: string, b: Bench, meta: BenchMeta, was?: Bench): { html: string; json: string; md: string } {
  mkdirSync(out, { recursive: true });
  const paths = { html: join(out, "report.html"), json: join(out, "report.json"), md: join(out, "report.md") };
  writeFileSync(paths.md, benchMarkdown(b, meta, was));
  writeFileSync(paths.json, JSON.stringify({ ...meta, method: { tiers: TIERS, kit: KIT, spare: KIT_SPARE, weak: WEAK, strong: STRONG, siblingSpread: SIBLING_SPREAD }, ...b, before: was ? { rows: was.rows, siblings: was.siblings, flags: was.flags } : undefined }, null, 1));
  const st = meta.stats;
  const wasBy = new Map((was?.rows ?? []).map((r) => [r.key, r]));
  let h = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weapon Bench</title><style>${CSS}</style></head><body><main>`;
  h += `<h1>Weapon bench</h1><p>${esc(meta.date.slice(0, 16).replace("T", " "))} · ${(st.wallMs / 1000).toFixed(1)} s wall, ${st.hits}/${st.jobs} jobs cached, ${Math.round(st.cpuMs / 1000)} s CPU on ${st.workers} workers · seeds ${meta.seeds.join(", ")}, ${esc(meta.bot)} bot${meta.set.length ? ` · what-if <code>${esc(meta.set.join(" "))}</code> (before -&gt; after)` : ""}</p>`;
  h += `<p>Every weapon at Lv1, Lv5 and as each evolution, on its signature hero (<b>*</b>; general weapons on Hoshi). <b>power</b>, <b>crowd</b> and <b>boss</b> are ratios to the median weapon of the tier (1.00 = typical): below ${WEAK} is flagged WEAK (SUPPORT when it clearly cuts the damage taken instead), above ${STRONG} STRONG. <b>share</b> = of the reference build's weapon damage (kit: ${KIT.join(", ")}); <b>kills x</b> / <b>taken x</b> = the kit with the weapon against the kit alone (damage taken net of healing: lower = it protects). Method and limits: docs/DEVTOOLS.md §4.1.</p>`;
  h += `<h2>Flags</h2><ul class="flags">${b.flags.length ? b.flags.map((f) => `<li class="${/^(WEAK|STRONG|SIBLINGS)/.test(f) ? "warn" : "info"}">${esc(f)}</li>`).join("") : "<li class='info'>none</li>"}</ul>`;
  for (const t of b.tiers) {
    const tier = TIERS.find((x) => x.id === t.id)!;
    h += `<h2>${esc(t.label)}</h2><p>Solo: ${esc(tier.solo.stage)} at ${tier.solo.at} s (base stats, a wave of ${tier.solo.wave}, then ${tier.solo.len} s). Build: ${esc(tier.ref.cp)} x ${esc(tier.ref.stage)} at ${tier.ref.at} s for ${tier.ref.len} s, boss ${esc(tier.ref.boss)}; kit ${tier.kitLevel ? `Lv${tier.kitLevel}` : "evolved"}, passives ${esc(tier.passives.map((p) => `${p[0]} ${p[1]}`).join(", "))}. Spread (MAD / median): power ${Math.round(t.mad.power * 100)} %.</p>`;
    h += table(
      HEAD,
      b.rows
        .filter((r) => r.tier === t.id)
        .sort((x, y) => x.rank - y.rank)
        .map((r) => {
          const c = rowCells(r, wasBy.get(r.key)).map(esc);
          c[3] = `${bar(r.power)}<span class="num">${c[3]}</span>`;
          c[FLAG] = r.flag === "WEAK" || r.flag === "STRONG" ? `<span class="bad">${c[FLAG]}</span>` : `<span class="muted">${c[FLAG]}</span>`;
          return c.map((x, i) => (i > 3 && i < FLAG ? `<span class="num">${x}</span>` : x));
        }),
    );
  }
  h += `<h2>Evolutions of each weapon (siblings)</h2><p>Every evolution of a base weapon next to its Lv5 form (power within its own tier). Evolutions of one weapon more than ${SIBLING_SPREAD}x apart are flagged (a stand-your-ground evolution is compared on its camp DPS).</p>`;
  h += table(
    ["weapon", "Lv5 power", "evolution (passive)", "power", "crowd", "boss", "taken x", "camp", "vs best sibling", "flag"],
    b.siblings.flatMap((s) =>
      s.evos.map((e, i) => [i ? "" : esc(s.name), i ? "" : f2(s.l5Power), `${esc(e.name)} <span class="muted">(${esc(e.passive)})</span>`, `${bar(e.power)}<span class="num">${f2(e.power)}</span>`, f2(e.crowd), f2(e.boss), f2(e.takenX), f2(e.camp), f2(e.vsBest), `<span class="bad">${esc([e.flag === "SUPPORT" ? "" : e.flag, i ? "" : s.flag].filter(Boolean).join("; "))}</span>`]),
    ),
  );
  h += `</main></body></html>`;
  writeFileSync(paths.html, h);
  return paths;
}
