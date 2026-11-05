/**
 * TALENTS tab: three arcs (branches) x five tiers (docs/content/heroes.md §3).
 * Each column is an arc with its colour, name and a spine that fills with the
 * points spent in it; tiers are joined by connectors carrying the tier gate
 * ("2 PTS" lock pill, a progress fill, a check once open); nodes show an icon
 * (the hero's signature weapon / Overdrive when the talent changes them, else
 * a stat glyph), the name and rank pips; the tier-5 capstone is bigger, with a
 * rainbow frame and an ULT / WPN chip, and glows once taken. Tapping a node
 * opens its card (+1 / -1 RANK). RETCON resets for coins.
 */
import type { TalentNode, TalentTree } from "../../../game/defs";
import type { HeroDef } from "../../../game/types";
import { ULTIMATES, WEAPONS } from "../../../game/registry";
import { branchPointsBelow, canAllocate, tierRequirement, type TalentBlock } from "../../../meta/heroes";
import type { Profile } from "../../../meta/profile";
import { esc, fmtInt, hasArt, img } from "../../dom";
import { money, portrait } from "../../kit/art";
import { btn, tag } from "../../kit/controls";
import { G, glyphImg, textGlyph } from "../board/glyph";

/** Arc colours (branch 0 / 1 / 2). */
export const ARC = ["#ff7ab8", "#4fe6df", "#ffe14d"] as const;

export const TALENT_BLOCK: Record<TalentBlock, string> = {
  unknown: "This talent doesn't exist (yet).",
  locked: "Unlock the hero first.",
  maxed: "Maxed out!",
  points: "No free talent points. Hero levels give one each.",
  tier: "",
  requires: "Needs the talent before it first.",
};

/** What a capstone changes: the Overdrive or the start weapon (heroes.md §3: every T5 is one of them). */
export function capKind(hd: HeroDef, n: TalentNode): "ULT" | "WPN" {
  const d = n.desc(1).toLowerCase();
  const ult = ULTIMATES.get(hd.ult)?.name.toLowerCase() ?? "";
  const ultWords = ult.split(/[^a-z]+/).filter((w) => w.length > 4);
  if (/overdrive|ultimate|\bult\b/.test(d) || ultWords.some((w) => d.includes(w))) return "ULT";
  return "WPN";
}

/** Icon markup for a talent: weapon / Overdrive art when the text is about them, else a tinted stat glyph. */
export function talentIcon(hd: HeroDef, n: TalentNode, tint: string): string {
  if (n.icon && hasArt(n.icon)) return img(n.icon, "px");
  const d = n.desc(1);
  if (n.tier === 5 && capKind(hd, n) === "ULT") return portrait(hd.portrait, 1, "pimg");
  const wd = WEAPONS.get(hd.weapon);
  const evo = wd?.evolution ? WEAPONS.get(wd.evolution.into) : undefined;
  if (wd && (d.includes(wd.name) || (evo && d.includes(evo.name)) || (n.tier === 5 && capKind(hd, n) === "WPN")) && hasArt(wd.icon)) return img(wd.icon, "px");
  const g = textGlyph(d);
  return glyphImg(g === G.special ? G.special : g, tint, "px gly");
}

export function treeHtml(p: Profile, hd: HeroDef, tree: TalentTree, unlocked: boolean): string {
  const hp = p.heroes[hd.id];
  const ranks = hp?.talents ?? {};
  const cols = [0, 1, 2]
    .map((br) => {
      const spent = tree.nodes.filter((n) => n.branch === br).reduce((a, n) => a + (ranks[n.id] ?? 0), 0);
      const max = tree.nodes.filter((n) => n.branch === br).reduce((a, n) => a + n.maxRank, 0);
      const tiers = [1, 2, 3, 4, 5]
        .map((t) => {
          const nodes = tree.nodes.filter((n) => n.branch === br && n.tier === t);
          const need = tierRequirement(t);
          const have = branchPointsBelow(tree, ranks, br, t);
          const open = have >= need;
          const gate =
            t > 1
              ? `<span class="tt-gate${open ? " open" : ""}" data-gate="${br}-${t}" style="--k:${Math.min(1, have / Math.max(1, need)).toFixed(3)}"><i class="tg-fill" aria-hidden="true"></i><span class="tg-pill">${open ? "✓" : `<i class="lock-i"></i>${Math.max(0, need - have)}`}</span></span>`
              : "";
          return `<div class="tt-tier${open ? "" : " gated"}" data-tier="${t}">${gate}${nodes.map((n) => nodeHtml(p, hd, n, ranks[n.id] ?? 0, unlocked)).join("")}</div>`;
        })
        .join("");
      return `<div class="tt-col" style="--b:${br};--ac:${ARC[br]};--fill:${(spent / Math.max(1, max)).toFixed(3)}">
        <div class="tt-bn"><b>${esc(tree.branches[br])}</b><small><span>${spent}</span> / ${max} PTS</small><i class="tt-bar" aria-hidden="true"><i></i></i></div>
        ${tiers}
      </div>`;
    })
    .join("");
  return `<div class="tt-tree">${cols}</div>`;
}

export function nodeHtml(p: Profile, hd: HeroDef, n: TalentNode, rank: number, unlocked: boolean): string {
  const c = unlocked ? canAllocate(p, hd.id, n.id) : { ok: false, block: "locked" as TalentBlock };
  const st = rank >= n.maxRank ? "max" : rank > 0 ? "own" : c.ok ? "can" : c.block === "tier" || c.block === "requires" ? "gate" : "idle";
  const cap = n.tier === 5;
  const tint = st === "gate" || st === "idle" ? "#8a7bb5" : ARC[n.branch];
  const pips = Array.from({ length: n.maxRank }, (_, i) => `<i class="${i < rank ? "on" : ""}"></i>`).join("");
  return `<button class="tn s-${st}${cap ? " cap" : ""}${c.ok ? " can" : ""}" data-nav data-act="tal" data-id="${n.id}" aria-label="${esc(n.name)} ${rank}/${n.maxRank}">
    <span class="tn-ic">${talentIcon(hd, n, tint)}</span>
    <span class="tn-nm">${esc(n.name)}</span>
    <span class="tn-pips">${pips}</span>
    ${cap ? `<span class="tn-cap">${capKind(hd, n)}</span>` : ""}
    ${st === "gate" ? `<i class="tn-lock lock-i" aria-hidden="true"></i>` : ""}
  </button>`;
}

export interface TalentCard {
  title: string;
  kicker: string;
  icon: string;
  html: string;
  foot: string;
}

export function talentCard(p: Profile, hd: HeroDef, tree: TalentTree, nid: string): TalentCard {
  const n = tree.nodes.find((x) => x.id === nid) as TalentNode;
  const ranks = p.heroes[hd.id]?.talents ?? {};
  const rank = ranks[nid] ?? 0;
  const c = canAllocate(p, hd.id, nid);
  let why = "";
  if (!c.ok && c.block) {
    if (c.block === "tier") {
      const need = tierRequirement(n.tier) - branchPointsBelow(tree, ranks, n.branch, n.tier);
      why = `Spend <b>${need}</b> more point${need === 1 ? "" : "s"} in <b>${esc(tree.branches[n.branch])}</b> first. Character development takes time.`;
    } else why = esc(TALENT_BLOCK[c.block]);
  }
  const pips = `<div class="rk-pips big">${Array.from({ length: n.maxRank }, (_, i) => `<i class="${i < rank ? "on" : ""}"></i>`).join("")}<span>RANK ${rank} / ${n.maxRank}</span></div>`;
  const cap = n.tier === 5 ? `<p class="ks-note">${tag("CAPSTONE", "rainbow")} ${capKind(hd, n) === "ULT" ? "Changes the Overdrive." : "Changes the start weapon."} The whole arc leads here.</p>` : "";
  const html = `${pips}${rank > 0 ? `<div class="fx-now"><small>NOW</small><b>${esc(n.desc(rank))}</b></div>` : ""}${
    rank < n.maxRank ? `<div class="fx-next"><small>${rank > 0 ? "NEXT RANK" : "EFFECT"}</small><b>${esc(n.desc(rank + 1))}</b></div>` : `<div class="fx-max">${tag("MAXED", "gold")} This arc is complete.</div>`
  }${cap}${why && rank < n.maxRank ? `<p class="why">${why}</p>` : ""}`;
  const foot = [rank < n.maxRank ? btn("+1 RANK", { cls: `gold${c.ok ? "" : " nope"}`, act: "add", def: c.ok, sub: c.ok ? "1 talent point" : "" }) : "", rank > 0 ? btn("−1 RANK", { cls: "ghost small", act: "sub" }) : ""].join("");
  return {
    title: n.name,
    kicker: `TIER ${n.tier} · ${tree.branches[n.branch].toUpperCase()}`,
    icon: `<span class="tal-ic" style="--ac:${ARC[n.branch]}">${talentIcon(hd, n, ARC[n.branch])}</span>`,
    html,
    foot,
  };
}

/** The header strip above the tree: free points, spent, RETCON. */
export function treeHead(free: number, spent: number, total: number, cost: number): string {
  return `
    <div class="tt-head">
      <span class="tt-pts"><b>${free}</b><span>FREE<small>${spent} / ${total} spent</small></span></span>
      ${spent > 0 ? btn(`RETCON ${money("coins", fmtInt(cost))}`, { cls: "ghost small", act: "reset", aria: "Retcon (reset) talents" }) : ""}
    </div>
    <p class="pg-note">Talent Tree: three arcs, five tiers, one hero who refuses to rest. Higher tiers need points in the arc below.</p>`;
}
