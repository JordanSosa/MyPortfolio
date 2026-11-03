/**
 * Kira Kira Wiki: the PLOT POINTS tab (docs/content/achievements.md). A wiki
 * "list article" of every Plot Point:
 *
 *   header     done / total, unclaimed rewards preview, CLAIM ALL (N)
 *   categories Story / Combat / Heroes / Weapons / Gacha / Silly chips with
 *              their own done / total
 *   filters    ALL · CLAIMABLE · IN PROGRESS · DONE
 *   rows       trophy, name, description, progress bar, reward chips, CLAIM;
 *              hidden ones read "???" (no name, no progress: no spoilers)
 *
 * Claiming stamps the row, flies the reward chips into the currency bar and
 * counts it up (celebrate.ts flyCurrency). Markup + one claim helper.
 */
import { achievementViews, type AchievementView } from "../../../meta/achievements/engine";
import { ACHIEVEMENT_CATEGORIES, CATEGORY_NAMES, type AchievementCategory } from "../../../meta/achievements/types";
import type { MetaContent } from "../../../meta/content";
import type { Profile } from "../../../meta/profile";
import { esc, fmtInt } from "../../dom";
import { art, money, trophyIcon, unknownIcon } from "../../kit/art";
import { btn, pbar, tag } from "../../kit/controls";
import { CITES, pickBy } from "./copy";

export type PlotFilter = "all" | "claim" | "todo" | "done";
export interface PlotState {
  cat: AchievementCategory | "all";
  filter: PlotFilter;
}

const FILTERS: readonly { id: PlotFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "claim", label: "CLAIMABLE" },
  { id: "todo", label: "IN PROGRESS" },
  { id: "done", label: "DONE" },
];

const claimable = (v: AchievementView) => v.done && !v.claimed && !!(v.def.reward.gems || v.def.reward.coins);

function rewardChips(v: AchievementView): string {
  const r = v.def.reward;
  return [r.gems ? money("gems", `+${fmtInt(r.gems)}`) : "", r.coins ? money("coins", `+${fmtInt(r.coins)}`) : "", r.title ? tag(`TITLE: ${r.title}`, "pink") : "", r.unlock ? tag("UNLOCK", "cyan") : ""].join("");
}

/** One Plot Point row. */
export function plotRow(v: AchievementView, i: number): string {
  const can = claimable(v);
  const right = v.done ? (can ? btn("CLAIM", { cls: "gold small", act: "claim", attrs: `data-id="${esc(v.def.id)}"` }) : `<span class="pp-stamp">✓ DONE</span>`) : "";
  const frac = v.target > 0 ? Math.min(1, v.progress / v.target) : 0;
  const ic = v.secret ? unknownIcon("aico") : art(v.def.icon ?? "icon_trophy", trophyIcon("aico"), "px aico");
  return `<div class="pp${v.done ? " done" : ""}${can ? " can" : ""}${v.secret ? " secret" : ""}" data-id="${esc(v.def.id)}" style="--i:${Math.min(i, 24)}">
      <span class="pp-ic">${ic}</span>
      <span class="pp-tx"><b>${esc(v.secret ? "???" : v.name)}</b><small>${v.secret ? `This Plot Point is hidden. <i class="cn">${esc(pickBy(CITES, v.def.id))}</i>` : esc(v.desc)}</small>${v.done || v.secret ? "" : pbar(frac, `${fmtInt(Math.min(v.progress, v.target))} / ${fmtInt(v.target)}`, "violet")}<span class="pp-rw">${v.secret ? "" : rewardChips(v)}</span></span>
      <span class="pp-r">${right}</span>
    </div>`;
}

/** The whole tab body. */
export function plotHtml(p: Profile, ctx: MetaContent, st: PlotState): string {
  const all = achievementViews(p, ctx);
  const done = all.filter((v) => v.done).length;
  const ready = all.filter(claimable);
  const gems = ready.reduce((a, v) => a + (v.def.reward.gems ?? 0), 0);
  const coins = ready.reduce((a, v) => a + (v.def.reward.coins ?? 0), 0);
  const inCat = st.cat === "all" ? all : all.filter((v) => v.def.category === st.cat);
  const views = inCat.filter((v) => (st.filter === "claim" ? claimable(v) : st.filter === "todo" ? !v.done : st.filter === "done" ? v.done : true));
  const order = [...views].sort((a, b) => Number(claimable(b)) - Number(claimable(a)) || Number(a.done) - Number(b.done) || Number(a.secret) - Number(b.secret) || b.progress / b.target - a.progress / a.target);
  const cats = [
    `<button class="pp-cat${st.cat === "all" ? " on" : ""}" data-nav data-act="cat" data-id="all"><b>ALL</b><small>${done}/${all.length}</small><i style="--f:${all.length ? done / all.length : 0}"></i></button>`,
    ...ACHIEVEMENT_CATEGORIES.map((c) => {
      const list = all.filter((v) => v.def.category === c);
      const d = list.filter((v) => v.done).length;
      const n = list.filter(claimable).length;
      return `<button class="pp-cat${st.cat === c ? " on" : ""}" data-nav data-act="cat" data-id="${c}"><b>${esc(CATEGORY_NAMES[c].toUpperCase())}</b><small>${d}/${list.length}</small><i style="--f:${list.length ? d / list.length : 0}"></i>${n ? `<span class="bdg">${n}</span>` : ""}</button>`;
    }),
  ].join("");
  const filters = FILTERS.map((f) => `<button class="wk-chip${st.filter === f.id ? " on" : ""}" data-nav data-act="pfilter" data-id="${f.id}">${f.label}${f.id === "claim" && ready.length ? ` <b>${ready.length}</b>` : ""}</button>`).join("");
  const empty =
    st.filter === "claim" ? "Nothing to claim. The narrator suggests: playing an episode." : st.filter === "done" ? "Nothing done here yet. Every legend starts somewhere." : "Everything here is done. The fans are speechless.";
  return `
    <section class="pp-head">
      <div class="pp-sum">
        <span class="pp-big">${trophyIcon("pp-tro")}<b>${done}</b><small>/ ${all.length}</small></span>
        <span class="pp-bar">${pbar(all.length ? done / all.length : 0, `${Math.round((all.length ? done / all.length : 0) * 100)}% of the plot`, "gold")}</span>
      </div>
      ${
        ready.length
          ? `<div class="pp-claimall"><span class="pp-pre">${gems ? money("gems", `+${fmtInt(gems)}`) : ""}${coins ? money("coins", `+${fmtInt(coins)}`) : ""}</span>${btn(`CLAIM ALL (${ready.length})`, { cls: "gold small pulse", act: "claimall" })}</div>`
          : `<p class="pp-none">All rewards claimed. Go make some plot.</p>`
      }
    </section>
    <div class="pp-cats kscroll-x">${cats}</div>
    <div class="wk-chips">${filters}</div>
    <div class="pp-list">${order.length ? order.map(plotRow).join("") : `<p class="wk-empty">${esc(empty)}</p>`}</div>`;
}
