/**
 * TRAINING ARC (docs/EXPANSION.md §5): the 120-node constellation board in
 * the kit's pan / zoom viewport (pinch, drag, wheel, + / -, gamepad right
 * stick + LB / RB; keyboard / gamepad focus hops node to node and the camera
 * follows). Rings, sector labels and edges are one SVG, nodes are buttons
 * placed in board units inside the same transformed layer - a pan / zoom only
 * rewrites one transform.
 *
 * Node states: owned (gold), maxed, affordable (pulses), reachable, out of
 * reach (dim), ring locked (grey + lock). Tap a node: detail sheet with the
 * flavour, current -> next rank, cost and BUY / REFUND (+ keystone ON / OFF).
 * AUTO-PATH marks the cheapest purchase chain the coins afford (numbered) and
 * can buy it in one go; RESPEC refunds everything minus a small fee.
 * Purchases update node classes in place (no rebuild).
 */
import { affordableNodes, autoPath, boardProgress, buyNode, effectText, nodeView, refundNode, respecBoard, respecFee, ringGate, toggleKeystone, type BuyBlock, type PlanStep } from "../../meta/board/board";
import { BOARD, CENTER_ID } from "../../meta/board/graph";
import type { BoardNode } from "../../meta/board/types";
import { gameContent } from "../../meta/content";
import { TUNING } from "../../meta/tuning";
import { esc, fmtInt, h, img } from "../dom";
import { art, money } from "../kit/art";
import { bindActs, btn, iconBtn, pop, shake, tag } from "../kit/controls";
import { confirmDialog, openSheet, overlaysOpen, type SheetHandle } from "../kit/overlay";
import { PanZoom } from "../kit/viewport";
import { save } from "../save";
import { pageLayer, type Hub, type HubPage, type PageOpts } from "./hub";

/**
 * Screen spread of the meta layout (board units -> CSS px at zoom 1): ring 1's
 * twelve nodes sit 120 units from the centre, which is too tight for 42-48 px
 * buttons with a rank pill under them, so the UI spreads every position.
 */
const K = 1.4;
const R_MAX = BOARD.radius[BOARD.radius.length - 1] * K + 80;
const BOUNDS = { x0: -R_MAX, y0: -R_MAX, x1: R_MAX, y1: R_MAX };
const SIZE: Record<BoardNode["kind"], number> = { center: 76, stat: 42, utility: 48, keystone: 64 };

const BLOCK_TEXT: Record<BuyBlock, string> = {
  unknown: "That node doesn't exist. Spooky.",
  maxed: "Maxed out! This montage is complete.",
  ring: "",
  unreachable: "Connect it to a node you own first. Training is a journey.",
  coins: "Not enough Star Coins! Have you tried... playing an episode?",
};

export function boardPage(hub: Hub, o: PageOpts): HubPage {
  const app = hub.app;
  const el = h("div", "board");
  const layer = pageLayer(hub);
  const ctx = gameContent();
  let sheet: SheetHandle | null = null;
  let sheetId = "";
  let plan: PlanStep[] = [];

  // ---- static board markup (built once)
  const svg: string[] = [];
  for (let r = 1; r <= BOARD.rings; r++) svg.push(`<circle class="ring" data-ring="${r}" cx="0" cy="0" r="${BOARD.radius[r] * K}"/>`);
  for (const s of BOARD.sectors) {
    const a = ((s.angle - 30) * Math.PI) / 180;
    svg.push(`<line class="wedge" x1="0" y1="0" x2="${(Math.cos(a) * R_MAX).toFixed(1)}" y2="${(Math.sin(a) * R_MAX).toFixed(1)}"/>`);
  }
  for (const [a, b] of BOARD.edges) {
    const na = BOARD.byId.get(a) as BoardNode;
    const nb = BOARD.byId.get(b) as BoardNode;
    svg.push(`<line class="edge" data-a="${a}" data-b="${b}" x1="${na.x * K}" y1="${na.y * K}" x2="${nb.x * K}" y2="${nb.y * K}"/>`);
  }
  const labels = BOARD.sectors
    .map((s) => {
      const a = (s.angle * Math.PI) / 180;
      const r = BOARD.radius[5] * K + 118;
      return `<span class="bd-sec" style="left:${(Math.cos(a) * r - BOUNDS.x0).toFixed(1)}px;top:${(Math.sin(a) * r - BOUNDS.y0).toFixed(1)}px;--sc:${s.color}">${esc(s.name)}</span>`;
    })
    .join("");
  const nodes = BOARD.nodes
    .map((n) => {
      const sc = n.sector >= 0 ? BOARD.sectors[n.sector].color : "#ffe14d";
      const glyph = n.kind === "center" ? art("board_center", `<i class="bn-clap">EP.1</i>`, "px") : img(n.icon, "px");
      return `<button class="bn k-${n.kind}" data-nav data-act="node" data-id="${n.id}" style="left:${(n.x * K - BOUNDS.x0).toFixed(1)}px;top:${(n.y * K - BOUNDS.y0).toFixed(1)}px;--sz:${SIZE[n.kind]}px;--sc:${sc}" aria-label="${esc(n.name)}"><span class="bn-ic">${glyph}</span><span class="bn-rk"></span><span class="bn-ap"></span></button>`;
    })
    .join("");
  el.innerHTML = `
    <div class="bd-vp">
      <div class="bd-c">
        <svg class="bd-svg" width="${R_MAX * 2}" height="${R_MAX * 2}" viewBox="${BOUNDS.x0} ${BOUNDS.y0} ${R_MAX * 2} ${R_MAX * 2}" aria-hidden="true">${svg.join("")}</svg>
        ${labels}
        ${nodes}
      </div>
    </div>
    <div class="bd-top">
      <span class="bd-prog"></span>
      <span class="bd-intro">Every node is a montage. Every ring is a new season.</span>
    </div>
    <div class="bd-zoom">
      ${iconBtn("+", "zin", "Zoom in", "small")}
      ${iconBtn("−", "zout", "Zoom out", "small")}
      ${iconBtn("⌖", "home", "Back to the centre", "small")}
    </div>
    <div class="bd-bar">
      ${btn("AUTO-PATH", { cls: "cyan small", act: "auto", aria: "Show the cheapest affordable path" })}
      <span class="bd-plan"></span>
      ${btn("RESPEC", { cls: "ghost small", act: "respec" })}
    </div>`;

  const vpEl = el.querySelector(".bd-vp") as HTMLElement;
  const content = el.querySelector(".bd-c") as HTMLElement;
  const nodeEls = new Map<string, HTMLElement>();
  for (const b of el.querySelectorAll<HTMLElement>(".bn")) nodeEls.set(b.dataset.id as string, b);
  const edgeEls = [...el.querySelectorAll<SVGLineElement>(".edge")];
  const ringEls = [...el.querySelectorAll<SVGCircleElement>(".ring")];

  const vp = new PanZoom(vpEl, content, {
    bounds: BOUNDS,
    minZoom: 0.2,
    maxZoom: 1.8,
    zoom: 0.8,
    cx: 0,
    cy: 0,
    far: 0.42,
    active: () => hub.top?.el === el && overlaysOpen() === 0,
  });

  // ---- paint states (in place)
  const paint = () => {
    const p = save.profile;
    const planIdx = new Map<string, number>();
    plan.forEach((s, i) => {
      if (!planIdx.has(s.id)) planIdx.set(s.id, i + 1);
    });
    for (const n of BOARD.nodes) {
      const b = nodeEls.get(n.id) as HTMLElement;
      if (n.kind === "center") {
        b.className = "bn k-center s-owned";
        continue;
      }
      const v = nodeView(p, n.id, ctx);
      if (!v) continue;
      const st = v.maxed ? "s-max" : v.rank > 0 ? (v.block ? "s-owned" : "s-owned s-afford") : !v.ringOpen ? "s-lock" : !v.reachable ? "s-far" : v.affordable ? "s-afford" : "s-near";
      const cls = `bn k-${n.kind} ${st}${v.active ? " s-on" : ""}${planIdx.has(n.id) ? " s-plan" : ""}`;
      if (b.className !== cls) b.className = cls;
      const rk = b.querySelector(".bn-rk") as HTMLElement;
      const txt = n.maxRank > 1 ? `${v.rank}/${n.maxRank}` : v.rank > 0 ? "✓" : "";
      if (rk.textContent !== txt) rk.textContent = txt;
      const ap = b.querySelector(".bn-ap") as HTMLElement;
      const at = planIdx.get(n.id);
      const apTxt = at ? String(at) : "";
      if (ap.textContent !== apTxt) ap.textContent = apTxt;
    }
    for (const e of edgeEls) {
      const a = e.dataset.a as string;
      const b = e.dataset.b as string;
      const ra = a === CENTER_ID ? 1 : (p.board.ranks[a] ?? 0);
      const rb = b === CENTER_ID ? 1 : (p.board.ranks[b] ?? 0);
      const cls = ra > 0 && rb > 0 ? "edge own" : ra > 0 || rb > 0 ? "edge reach" : "edge";
      if (e.getAttribute("class") !== cls) e.setAttribute("class", cls);
    }
    for (const c of ringEls) {
      const r = Number(c.dataset.ring);
      const open = r <= 1 || (() => {
        const g = ringGate(r, ctx);
        return !!g && (p.records[g.id]?.clears ?? 0) > 0;
      })();
      c.setAttribute("class", open ? "ring open" : "ring");
    }
    const pr = boardProgress(p);
    (el.querySelector(".bd-prog") as HTMLElement).innerHTML = `<b>${pr.nodesOwned}</b> / ${pr.nodes} nodes · ${money("coins", fmtInt(pr.spent))} spent`;
    const planEl = el.querySelector(".bd-plan") as HTMLElement;
    if (plan.length) {
      const cost = plan.reduce((a, s) => a + s.cost, 0);
      planEl.innerHTML = `${plan.length} node${plan.length === 1 ? "" : "s"} · ${money("coins", fmtInt(cost))} ${btn("BUY PATH", { cls: "gold small", act: "buyplan" })}`;
      bindActs(planEl, { buyplan: buyPlan });
    } else planEl.innerHTML = "";
  };

  // ---- node sheet
  const nodeSheetHtml = (id: string): { html: string; foot: string; kicker: string; title: string; icon: string } => {
    const p = save.profile;
    const v = nodeView(p, id, ctx);
    const n = BOARD.byId.get(id) as BoardNode;
    const sector = n.sector >= 0 ? BOARD.sectors[n.sector] : null;
    const kind = n.kind === "keystone" ? "KEYSTONE" : n.kind === "utility" ? "UTILITY" : n.kind === "center" ? "THE PILOT" : "STAT";
    const kicker = n.kind === "center" ? "EPISODE 1" : `RING ${n.ring} · ${sector?.name.toUpperCase() ?? ""} · ${kind}`;
    const icon = n.kind === "center" ? art("board_center", `<i class="bn-clap big">EP.1</i>`, "px") : img(n.icon, "px");
    if (!v || n.kind === "center") return { html: `<p class="flav">${esc(n.flavor)}</p><p>The centre of your Training Arc. Every path starts here.</p>`, foot: "", kicker, title: n.name, icon };
    const pips = n.maxRank > 1 ? `<div class="rk-pips">${Array.from({ length: n.maxRank }, (_, i) => `<i class="${i < v.rank ? "on" : ""}"></i>`).join("")}<span>RANK ${v.rank} / ${n.maxRank}</span></div>` : "";
    const now = v.rank > 0 ? `<div class="fx-now"><small>NOW</small>${n.effects.map((e) => `<b>${esc(effectText(e, v.rank))}</b>`).join("")}</div>` : "";
    const next = !v.maxed ? `<div class="fx-next"><small>${v.rank > 0 ? "NEXT RANK" : "EFFECT"}</small>${n.effects.map((e) => `<b>${esc(effectText(e, v.rank + 1))}</b>`).join("")}</div>` : `<div class="fx-max">${tag("MAXED", "gold")} The montage is complete.</div>`;
    let why = "";
    if (v.block === "ring") {
      const g = ringGate(n.ring, ctx);
      why = `Ring ${n.ring} opens when you clear <b>${esc(g?.name ?? "the next stage")}</b>. Each ring is a new season.`;
    } else if (v.block && v.block !== "maxed") why = esc(BLOCK_TEXT[v.block]);
    const keyNote =
      n.kind === "keystone"
        ? `<div class="ks-note">${tag("KEYSTONE", "rainbow")} A build-defining story arc. Only ${TUNING.board.keystoneSlots} arcs can air per season.${v.rank > 0 ? ` <b>${v.active ? "ON AIR" : "OFF AIR"}</b>` : ""}</div>`
        : "";
    const html = `${n.flavor ? `<p class="flav">“${esc(n.flavor)}”</p>` : ""}${pips}${now}${next}${keyNote}${why ? `<p class="why">${why}</p>` : ""}`;
    const foot = [
      !v.maxed ? btn(`BUY ${money("coins", fmtInt(v.cost), v.affordable ? "" : "poor")}`, { cls: `gold small${v.block ? " nope" : ""}`, act: "buy", def: !v.block }) : "",
      n.kind === "keystone" && v.rank > 0 ? btn(v.active ? "TAKE OFF AIR" : "PUT ON AIR", { cls: "violet small", act: "ks" }) : "",
      v.rank > 0 ? btn("REFUND", { cls: "ghost small", act: "refund" }) : "",
    ].join("");
    return { html, foot, kicker, title: n.name, icon };
  };

  const openNode = (id: string) => {
    app.sfx("uiConfirm");
    sheetId = id;
    const c = nodeSheetHtml(id);
    sheet?.close();
    sheet = openSheet(app, { title: c.title, kicker: c.kicker, icon: c.icon, html: c.html, foot: c.foot, cls: "node-sheet", onClose: () => (sheet = null) });
    bindSheet();
  };

  const refreshSheet = () => {
    if (!sheet || !sheetId) return;
    const c = nodeSheetHtml(sheetId);
    sheet.update({ html: c.html, foot: c.foot });
    bindSheet();
  };

  const bindSheet = () => {
    const s = sheet;
    if (!s) return;
    bindActs(s.el, {
      buy: (b) => {
        const r = buyNode(save.profile, sheetId, ctx);
        if (!r.ok) {
          app.sfx("nodeDeny");
          shake(b);
          if (r.block === "coins") hub.toast("Not enough Star Coins!", { kind: "bad", sub: "Have you tried... playing an episode?" });
          return;
        }
        app.sfx("nodeBuy");
        if (r.activated) hub.toast("Keystone on air!", { kind: "good", sub: BOARD.byId.get(sheetId)?.name });
        plan = [];
        hub.changed();
        paint();
        pop(nodeEls.get(sheetId) ?? null, 1.3);
        refreshSheet();
      },
      refund: async () => {
        const n = BOARD.byId.get(sheetId);
        const ok = await confirmDialog(app, { title: "Refund this rank?", body: `<b>${esc(n?.name ?? "")}</b> loses one rank. You get back what that rank cost.`, ok: "REFUND", cancel: "Keep it" });
        if (!ok) return;
        const r = refundNode(save.profile, sheetId);
        if (!r.ok) {
          app.sfx("uiDeny");
          hub.toast(r.block === "strands" ? "Other nodes depend on this one." : "Nothing to refund.", { kind: "bad", sub: r.block === "strands" ? "Refund the nodes further out first." : undefined });
          return;
        }
        plan = [];
        hub.changed();
        paint();
        refreshSheet();
      },
      ks: () => {
        const r = toggleKeystone(save.profile, sheetId);
        if (!r.ok) {
          app.sfx("uiDeny");
          hub.toast("Two arcs are already on air.", { kind: "bad", sub: "Take one off air first." });
          return;
        }
        app.sfx(r.active ? "equip" : "uiBack");
        hub.changed(false);
        paint();
        refreshSheet();
      },
    });
  };

  const buyPlan = () => {
    const p = save.profile;
    let n = 0;
    for (const s of plan) {
      if (!buyNode(p, s.id, ctx).ok) break;
      n++;
      const b = nodeEls.get(s.id);
      setTimeout(() => pop(b ?? null, 1.3), n * 70);
    }
    plan = [];
    if (n > 0) {
      app.sfx("nodeBuy");
      hub.toast(`Montage complete: ${n} node${n === 1 ? "" : "s"}!`, { kind: "good" });
    } else app.sfx("nodeDeny");
    hub.changed();
    paint();
  };

  bindActs(el, {
    node: (b) => openNode(b.dataset.id as string),
    zin: () => vp.zoomBy(1.3),
    zout: () => vp.zoomBy(1 / 1.3),
    home: () => vp.go(0, 0, Math.max(vp.z, 0.8)),
    auto: () => {
      const p = save.profile;
      plan = plan.length ? [] : autoPath(p, ctx, { maxSteps: 12 });
      if (!plan.length) {
        const cheap = affordableNodes(p, ctx)[0];
        app.sfx("uiDeny");
        hub.toast(cheap ? "Nothing on the path." : "Nothing affordable right now.", { kind: "bad", sub: "Not enough Star Coins! Have you tried... playing an episode?" });
      } else {
        app.sfx("uiConfirm");
        const first = BOARD.byId.get(plan[0].id);
        if (first) vp.go(first.x * K, first.y * K, Math.max(vp.z, 0.7));
      }
      paint();
    },
    respec: async () => {
      const p = save.profile;
      const pr = boardProgress(p);
      if (pr.spent <= 0) {
        app.sfx("uiDeny");
        hub.toast("Nothing to reboot yet.", { kind: "info" });
        return;
      }
      const fee = respecFee(p);
      const ok = await confirmDialog(app, {
        title: "Reboot the series?",
        body: `All nodes will be refunded (minus a small fee for the reboot).<br>Refund ${money("coins", fmtInt(pr.spent - fee))} · fee ${money("coins", fmtInt(fee))}`,
        ok: "REBOOT",
        cancel: "Keep my arc",
        danger: true,
      });
      if (!ok) return;
      respecBoard(p);
      plan = [];
      app.sfx("reroll");
      hub.changed();
      paint();
      vp.go(0, 0, 0.8);
    },
  });
  // keyboard / gamepad focus: keep the focused node on screen
  el.addEventListener("navfocus", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".bn");
    const n = b ? BOARD.byId.get(b.dataset.id as string) : undefined;
    if (n) vp.ensureVisible(n.x * K, n.y * K, 90 * vp.z + 40);
  });

  paint();
  // start (first frame, once the page is laid out): the cheapest affordable node (results "Upgrade"),
  // else the centre, at a zoom that fits rings 1-2 in the view
  const start = o.focus === "affordable" ? affordableNodes(save.profile, ctx)[0]?.node : undefined;
  const startEl = start ? nodeEls.get(start.id) : nodeEls.get(CENTER_ID);
  layer.focus = startEl ?? null;
  let placed = false;
  const place = () => {
    placed = true;
    vp.measure();
    // fit rings 1-2 (the early game) in the shorter side of the view
    const z = Math.max(0.42, Math.min(1.05, Math.min(vp.viewW, vp.viewH) / (2 * (BOARD.radius[2] * K + 56))));
    vp.go(start ? start.x * K * 0.6 : 0, start ? start.y * K * 0.6 : 0, z, 0);
    if (start) setTimeout(() => pop(startEl ?? null, 1.5), 450);
  };

  return {
    id: "board",
    el,
    title: "TRAINING ARC",
    layer,
    opaque: true,
    show() {
      paint();
    },
    update(dt) {
      if (!placed) place();
      vp.update(dt);
    },
    dispose() {
      sheet?.close();
      vp.dispose();
    },
  };
}
