/**
 * Training Arc node card (the detail sheet): the node's star + glyph, ring /
 * sector / kind kicker, satire flavour, rank pips, NOW and NEXT effects,
 * keystone air status, and why it can't be bought (a shimmering
 * "REQUIRES: EPISODE N CLEAR" stamp for a gated ring, the missing coins...).
 * Footer: BUY (with the price, or what is missing), PUT ON / TAKE OFF AIR for
 * owned keystones, REFUND.
 */
import { effectText, nodeView, ringGate, type BuyBlock } from "../../../meta/board/board";
import { BOARD } from "../../../meta/board/graph";
import type { BoardNode } from "../../../meta/board/types";
import type { MetaContent } from "../../../meta/content";
import type { Profile } from "../../../meta/profile";
import { TUNING } from "../../../meta/tuning";
import { esc, fmtInt, hasArt, img } from "../../dom";
import { money } from "../../kit/art";
import { btn, tag } from "../../kit/controls";
import { SEASON } from "../copy";
import { effectMood, flavor } from "./fx";
import { effectGlyph, glyphImg } from "./glyph";
import { glyphTint, type Look } from "./layout";

export const BLOCK_TEXT: Record<BuyBlock, string> = {
  unknown: "That node doesn't exist. Spooky.",
  maxed: "Maxed out! This montage is complete.",
  ring: "",
  unreachable: "Connect it to a node you own first. Training is a journey.",
  coins: "Not enough Star Coins! Have you tried... playing an episode?",
};

/** Stage that opens `ring` (registered StageInfo, else the season plan's name). */
export function gateInfo(ring: number, ctx: MetaContent): { order: number; name: string } {
  const order = ring - 1;
  const st = ringGate(ring, ctx);
  return { order, name: st?.name ?? SEASON.find((s) => s.order === order)?.name ?? "the next episode" };
}

export function gateLine(ring: number): string {
  return `REQUIRES: EPISODE ${ring - 1} CLEAR`;
}

/** Big star + glyph for the sheet header. */
export function nodeArt(n: BoardNode, look: Look, cls = "nart"): string {
  if (n.kind === "center") return hasArt("board_center") ? `<span class="${cls} center">${img("board_center", "px", 1)}</span>` : `<span class="${cls} center"><i class="css-star center"></i></span>`;
  const id = n.kind === "keystone" ? "board_keystone" : "board_node";
  const star = hasArt(id) ? img(id, "px na-st", look) : `<i class="na-st css-star"></i>`;
  return `<span class="${cls} k-${n.kind}">${star}${glyphImg(effectGlyph(n.effects), glyphTint(n, look), "px na-gl")}</span>`;
}

export interface SheetContent {
  title: string;
  kicker: string;
  icon: string;
  html: string;
  foot: string;
}

export function nodeSheet(p: Profile, id: string, ctx: MetaContent): SheetContent {
  const n = BOARD.byId.get(id) as BoardNode;
  const v = nodeView(p, id, ctx);
  const sector = n.sector >= 0 ? BOARD.sectors[n.sector] : null;
  const kind = n.kind === "keystone" ? "KEYSTONE" : n.kind === "utility" ? "UTILITY" : n.kind === "center" ? "THE PILOT" : "STAT";
  const look: Look = !v || n.kind === "center" ? 3 : v.rank > 0 ? 3 : !v.ringOpen || !v.reachable ? 0 : v.affordable ? 2 : 1;
  const kicker = n.kind === "center" ? "EPISODE 1 · WHERE IT ALL BEGINS" : `RING ${n.ring} · ${sector?.name.toUpperCase() ?? ""} · ${kind}`;
  const icon = nodeArt(n, look);
  if (!v || n.kind === "center")
    return {
      title: n.name,
      kicker,
      icon,
      html: `<p class="flav">“${flavor(n.flavor)}”</p><p class="bd-note">The centre of your Training Arc. Every path starts here. Buy a star next to one you own, and the constellation grows.</p>`,
      foot: "",
    };
  const pips =
    n.maxRank > 1
      ? `<div class="rk-pips big">${Array.from({ length: n.maxRank }, (_, i) => `<i class="${i < v.rank ? "on" : ""}"></i>`).join("")}<span>RANK ${v.rank} / ${n.maxRank}</span></div>`
      : `<div class="rk-pips big">${`<i class="${v.rank > 0 ? "on" : ""}"></i>`}<span>${v.rank > 0 ? "OWNED" : "ONE RANK"}</span></div>`;
  const fxLine = (e: (typeof n.effects)[number], r: number) => `<b class="${n.kind === "keystone" ? effectMood(e) : ""}">${esc(effectText(e, r))}</b>`;
  const now = v.rank > 0 ? `<div class="fx-now"><small>NOW</small>${n.effects.map((e) => fxLine(e, v.rank)).join("")}</div>` : "";
  const next = !v.maxed
    ? `<div class="fx-next"><small>${v.rank > 0 ? "NEXT RANK" : "EFFECT"}</small>${n.effects.map((e) => fxLine(e, v.rank + 1)).join("")}</div>`
    : `<div class="fx-max">${tag("MAXED", "gold")} The montage is complete.</div>`;
  let why = "";
  if (v.block === "ring") {
    const g = gateInfo(n.ring, ctx);
    why = `<div class="bd-req"><i class="lock-i"></i><span><b>${gateLine(n.ring)}</b><small>Clear <em>${esc(g.name)}</em> to open ring ${n.ring}. Each ring is a new season.</small></span><i class="g-shine" aria-hidden="true"></i></div>`;
  } else if (v.block === "coins") {
    why = `<p class="why">${esc(BLOCK_TEXT.coins)} <b>${fmtInt(v.cost - p.currencies.coins)}</b> more to go.</p>`;
  } else if (v.block && v.block !== "maxed") why = `<p class="why">${esc(BLOCK_TEXT[v.block])}</p>`;
  const keyNote =
    n.kind === "keystone"
      ? `<div class="ks-note">${tag("KEYSTONE", "rainbow")} A build-defining story arc. Only ${TUNING.board.keystoneSlots} arcs can air per season.${v.rank > 0 ? ` <b class="${v.active ? "air" : ""}">${v.active ? "● ON AIR" : "OFF AIR"}</b>` : ""}</div>`
      : "";
  const html = `${n.flavor ? `<p class="flav">“${flavor(n.flavor)}”</p>` : ""}${pips}${now}${next}${keyNote}${why}`;
  const buy =
    v.maxed || v.block === "ring"
      ? ""
      : btn(`BUY ${money("coins", fmtInt(v.cost), v.affordable ? "" : "poor")}`, {
          cls: `gold${v.block ? " nope" : ""}`,
          act: "buy",
          def: !v.block,
          sub: v.block === "coins" ? `need ${fmtInt(v.cost - p.currencies.coins)} more` : v.block === "unreachable" ? "not connected yet" : v.rank > 0 ? `rank ${v.rank + 1}` : "",
        });
  const foot = [
    buy,
    n.kind === "keystone" && v.rank > 0 ? btn(v.active ? "TAKE OFF AIR" : "PUT ON AIR", { cls: "violet small", act: "ks" }) : "",
    v.rank > 0 ? btn("REFUND", { cls: "ghost small", act: "refund" }) : "",
  ].join("");
  return { title: n.name, kicker, icon, html, foot };
}
