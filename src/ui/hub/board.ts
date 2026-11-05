/**
 * TRAINING ARC (docs/EXPANSION.md §5, satire.md §8): the 120-node
 * constellation board as a pannable / zoomable star map.
 *
 *  - Map: deep-space sky (parallax tiles behind the map), sector nebulae, ring
 *    orbits, constellation lines (dim dotted -> lavender when one end is owned
 *    -> glowing gold along purchased paths; cyan for the auto-path plan),
 *    sector names curved along the rim, the real board art (board_node /
 *    board_keystone / board_center stars + tinted board_glyph stat icons) and
 *    rank pips. Gated rings carry shimmering "REQUIRES: EPISODE N CLEAR" chips.
 *  - Node states: owned (gold), maxed, affordable (bright star + pulse ring,
 *    capped to the cheapest few so a rich account never animates 100 rings),
 *    reachable, out of reach, ring gated; keystones ON AIR.
 *  - Input (kit PanZoom): drag with inertia, pinch, wheel, double-tap zoom,
 *    + / -, gamepad right stick + LB / RB; keyboard / gamepad focus hops node
 *    to node and the camera follows; a tap near a small star snaps to it.
 *  - Node card (sheet, the map stays live and tappable around it) with BUY:
 *    coins fly from the coin pill to the star, the lines from the owned
 *    network ignite into it, then a burst; newly reachable neighbours twinkle
 *    in. A keystone gets a full-screen KEYSTONE ARC splash.
 *  - AUTO-PATH marks the cheapest chain the coins afford (numbered, cyan) and
 *    buys it in one montage; RESPEC (confirm) reboots the series with a VHS
 *    rewind. Minimap (rings + view box) in a corner, tap to fly.
 *
 * 60 fps on phones: the map is one composited layer (pans and zooms only
 * rewrite its transform; it is re-rastered once after a zoom settles), state
 * changes touch only the nodes / lines that changed, and all juice is WAAPI
 * on transform / opacity of short-lived elements.
 */
import { affordableNodes, autoPath, boardProgress, buyNode, nodeView, refundNode, respecBoard, respecFee, ringUnlocked, toggleKeystone, type NodeView, type PlanStep } from "../../meta/board/board";
import { BOARD, CENTER_ID } from "../../meta/board/graph";
import type { BoardNode } from "../../meta/board/types";
import { gameContent } from "../../meta/content";
import { TUNING } from "../../meta/tuning";
import { esc, fmtInt, h, hasArt, img, prewarmSprites } from "../dom";
import { money } from "../kit/art";
import { bindActs, btn, iconBtn, pop, shake } from "../kit/controls";
import { confirmDialog, openSheet, overlaysOpen, type SheetHandle } from "../kit/overlay";
import { reducedMotion } from "../kit/ticker";
import { PanZoom } from "../kit/viewport";
import { save } from "../save";
import { burstAt, centerIn, flyCoins, ignite, keystoneSplash, popEl, revealEl, rewind } from "./board/fx";
import { effectGlyph, fillGlyphs, pretint, setGlyph } from "./board/glyph";
import { boardSvg, BOUNDS, boxOf, EDGES_OF, gateChips, glyphTint, LOCK_TINT, nebulae, nodeButtons, OWN_TINT, px, RING_PX, sectorColor, SIZE, type Look } from "./board/layout";
import { Minimap, type DotState } from "./board/minimap";
import { gateInfo, gateLine, nodeSheet } from "./board/sheet";
import { pageLayer, type Hub, type HubPage, type PageOpts } from "./hub";
import "./board/board.css";

/** At most this many affordable stars pulse at once (the cheapest; the rest glow statically). */
const MAX_PULSE = 24;

/** The map's star frames (board_node / board_keystone looks 0-3, the centre and its glow): encoded with the pretint. */
const STAR_FRAMES: [string, number][] = [
  ...[0, 1, 2, 3].flatMap((f): [string, number][] => [
    ["board_node", f],
    ["board_keystone", f],
  ]),
  ["board_center", 0],
  ["board_center", 1],
];

// Every (glyph, tint) the map can show (sector colour, locked, owned), tinted in idle slices a little
// after boot, and the star frames encoded the same way: the first Training Arc open finds them made
// instead of tinting ~100 frames (and encoding its stars) in its own task.
if (typeof window !== "undefined") {
  let tries = 0;
  const warm = () => {
    // (the DOM icon atlas arrives with the App, after the atlas preload: look again a little later)
    if (!hasArt("board_node") && ++tries < 20) return void setTimeout(warm, 500);
    prewarmSprites(STAR_FRAMES);
    // (the sector colours first: the map's markup uses them; then locked / owned)
    const stars = BOARD.nodes.filter((n) => n.kind !== "center");
    pretint(stars.map((n) => [effectGlyph(n.effects), sectorColor(n)] as const));
    pretint(stars.flatMap((n) => [[effectGlyph(n.effects), LOCK_TINT] as const, [effectGlyph(n.effects), OWN_TINT] as const]));
  };
  setTimeout(warm, 1200);
}

interface NodeState {
  cls: string;
  look: Look;
  rank: number;
  tint: string;
  ap: string;
}

export function boardPage(hub: Hub, o: PageOpts): HubPage {
  const app = hub.app;
  const el = h("div", "board");
  const layer = pageLayer(hub);
  const ctx = gameContent();
  let sheet: SheetHandle | null = null;
  let sheetId = "";
  let plan: PlanStep[] = [];
  let disposed = false;
  let buyingPlan = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!disposed) fn();
    }, ms);
    timers.add(t);
  };

  // ---- static board markup (built once)
  const gates = [2, 3, 4, 5].map((r) => gateChips(r, gateLine(r), gateInfo(r, ctx).name)).join("");
  const twinkles = Array.from({ length: 10 }, (_, i) => `<i style="left:${((i * 37) % 100) + 2}%;top:${((i * 61) % 100) + 1}%;--d:${(i * 0.37) % 2.4}s"></i>`).join("");
  el.innerHTML = `
    <div class="bd-vp">
      <div class="bd-sky" aria-hidden="true">${twinkles}</div>
      <div class="bd-c">
        ${nebulae()}
        ${boardSvg()}
        ${nodeButtons()}
        ${gates}
        <div class="bd-ovl" aria-hidden="true"><i class="bd-sel" hidden></i></div>
      </div>
    </div>
    <div class="bd-top">
      <span class="bd-prog"></span>
      <span class="bd-intro">Welcome to the Training Arc! Every node is a montage. Every ring is a new season.</span>
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
  const sky = el.querySelector(".bd-sky") as HTMLElement;
  const planEl = el.querySelector(".bd-plan") as HTMLElement;
  const progEl = el.querySelector(".bd-prog") as HTMLElement;
  const nodeEls = new Map<string, HTMLElement>();
  for (const b of el.querySelectorAll<HTMLElement>(".bn")) nodeEls.set(b.dataset.id as string, b);
  const halo = [...el.querySelectorAll<SVGLineElement>(".eh")];
  const core = [...el.querySelectorAll<SVGLineElement>(".ec")];
  const orbs = [...el.querySelectorAll<SVGCircleElement>(".orb[data-ring]")];
  const gateEls = [...el.querySelectorAll<HTMLElement>(".bd-gate")];
  /** Gate chip HUD fade (fadeGates): camera version seen, HUD rects and chip sizes (measured once). */
  let gateSeen = -1;
  let hudRects: DOMRect[] | null = null;
  const gateSize = new Map<HTMLElement, [number, number]>();
  // everything that animates on the map lives in one overlay above the stars (pulse rings, the selection
  // ring, ON AIR halos): nothing static is painted over an animated layer, so no star gets squashed into
  // extra compositor layers
  const ovl = el.querySelector(".bd-ovl") as HTMLElement;
  const selRing = ovl.querySelector(".bd-sel") as HTMLElement;
  const rings = new Map<string, HTMLElement>();
  const syncRings = (want: ReadonlyMap<string, string>) => {
    for (const [id, r] of rings)
      if (want.get(id) !== r.dataset.k) {
        r.remove();
        rings.delete(id);
      }
    for (const [id, k] of want) {
      if (rings.has(id)) continue;
      const n = BOARD.byId.get(id) as BoardNode;
      const [x, y] = px(n);
      const r = h("i", `bd-${k}`);
      r.dataset.k = k;
      r.style.cssText = `left:${(x - BOUNDS.x0).toFixed(1)}px;top:${(y - BOUNDS.y0).toFixed(1)}px;--sz:${SIZE[n.kind]}px`;
      ovl.appendChild(r);
      rings.set(id, r);
    }
  };
  const placeSel = (id: string | null) => {
    const n = id ? BOARD.byId.get(id) : undefined;
    selRing.hidden = !n;
    if (!n) return;
    const [x, y] = px(n);
    selRing.style.cssText = `left:${(x - BOUNDS.x0).toFixed(1)}px;top:${(y - BOUNDS.y0).toFixed(1)}px;--sz:${SIZE[n.kind]}px`;
  };
  fillGlyphs(content);

  // the screen-space fx layer (coins) sits over the sheet so the flight is never hidden
  const fxLayer = h("div", "bfx-layer");
  app.ui.appendChild(fxLayer);

  const minimap = new Minimap((x, y) => {
    app.sfx("uiMove");
    vp.go(x, y, Math.max(vp.z, 0.55));
  });
  el.appendChild(minimap.el);

  const vp = new PanZoom(vpEl, content, {
    bounds: BOUNDS,
    minZoom: 0.2,
    maxZoom: 1.8,
    zoom: 0.8,
    cx: 0,
    cy: 0,
    far: 0.42,
    near: 1.15,
    active: () => hub.top?.el === el && overlaysOpen() === 0,
    // a tap on empty sky near a small star (zoomed out) snaps to it
    onTap: (sx, sy) => {
      const [wx, wy] = vp.toWorld(sx, sy);
      let best: BoardNode | null = null;
      let bd = Infinity;
      for (const n of BOARD.nodes) {
        const [x, y] = px(n);
        const d = Math.hypot(x - wx, y - wy) * vp.z - (SIZE[n.kind] / 2) * vp.z;
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      if (best && bd < 26) {
        openNode(best.id);
        return true;
      }
      return false;
    },
  });

  // ---- paint states (in place, only what changed)
  const states = new Map<string, NodeState>();
  const edgeCls: string[] = [];
  const dots = new Map<string, DotState>();
  let views = new Map<string, NodeView>();

  const lookOf = (v: NodeView): Look => (v.rank > 0 ? 3 : !v.ringOpen || !v.reachable ? 0 : v.affordable ? 2 : 1);

  const paint = () => {
    const p = save.profile;
    const planIdx = new Map<string, number>();
    plan.forEach((s, i) => {
      if (!planIdx.has(s.id)) planIdx.set(s.id, i + 1);
    });
    views = new Map();
    // the cheapest affordable frontier stars pulse
    const frontier = affordableNodes(p, ctx)
      .filter((v) => v.rank === 0)
      .slice(0, MAX_PULSE)
      .map((v) => v.node.id);
    const pulse = new Set(frontier);
    const want = new Map<string, string>();
    for (const n of BOARD.nodes) {
      const b = nodeEls.get(n.id) as HTMLElement;
      if (n.kind === "center") {
        dots.set(n.id, "own");
        continue;
      }
      const v = nodeView(p, n.id, ctx);
      if (!v) continue;
      views.set(n.id, v);
      const look = lookOf(v);
      const st = v.maxed ? "s-max" : v.rank > 0 ? "s-owned" : !v.ringOpen ? "s-lock" : !v.reachable ? "s-far" : v.affordable ? "s-afford" : "s-near";
      const extra = `${v.rank > 0 && !v.maxed && !v.block ? " s-up" : ""}${v.active ? " s-on" : ""}${planIdx.has(n.id) ? " s-plan" : ""}`;
      if (pulse.has(n.id) && !planIdx.has(n.id)) want.set(n.id, "pr");
      else if (v.active) want.set(n.id, "air");
      const cls = `bn k-${n.kind} ${st}${extra}`;
      const tint = glyphTint(n, look);
      const ap = planIdx.has(n.id) ? String(planIdx.get(n.id)) : "";
      const prev = states.get(n.id);
      if (!prev || prev.cls !== cls) {
        b.className = cls;
        const say = v.maxed ? "maxed" : v.rank > 0 ? `rank ${v.rank} of ${n.maxRank}` : !v.ringOpen ? "locked ring" : !v.reachable ? "not connected" : v.affordable ? "affordable" : "too expensive";
        b.setAttribute("aria-label", `${n.name}, ${say}${v.active ? ", on air" : ""}`);
      }
      if (!prev || prev.look !== look) {
        const st2 = b.querySelector<HTMLImageElement>("img.bn-st");
        if (st2) {
          const id = n.kind === "keystone" ? "board_keystone" : "board_node";
          st2.outerHTML = img(id, "px bn-st", look);
        }
      }
      if (!prev || prev.tint !== tint) {
        const g = b.querySelector<HTMLImageElement>("img.bn-gl");
        if (g) setGlyph(g, effectGlyph(n.effects), tint);
      }
      if (!prev || prev.rank !== v.rank) {
        const list = b.querySelectorAll<HTMLElement>(".bn-pips i");
        list.forEach((pi, i) => pi.classList.toggle("on", i < v.rank));
      }
      if (!prev || prev.ap !== ap) (b.querySelector(".bn-ap") as HTMLElement).textContent = ap;
      states.set(n.id, { cls, look, rank: v.rank, tint, ap });
      dots.set(n.id, v.rank > 0 ? "own" : !v.ringOpen ? "lock" : !v.reachable ? "far" : v.affordable ? "afford" : "near");
    }
    syncRings(want);
    // lines: gold where both ends are owned, lavender where one is, cyan along the plan
    const planned = new Set(planIdx.keys());
    const owned = (id: string) => id === CENTER_ID || (p.board.ranks[id] ?? 0) > 0;
    BOARD.edges.forEach(([a, b], i) => {
      const oa = owned(a);
      const ob = owned(b);
      const ringA = a === CENTER_ID || views.get(a)?.ringOpen;
      const ringB = b === CENTER_ID || views.get(b)?.ringOpen;
      let cls = "";
      if (oa && ob) cls = "own";
      else if ((planned.has(a) && (ob || planned.has(b))) || (planned.has(b) && (oa || planned.has(a)))) cls = "plan";
      else if ((oa && ringB) || (ob && ringA)) cls = "reach";
      else if (!ringA || !ringB) cls = "lock";
      if (edgeCls[i] !== cls) {
        edgeCls[i] = cls;
        halo[i].setAttribute("class", `eh ${cls}`);
        core[i].setAttribute("class", `ec ${cls}`);
      }
    });
    // rings
    const ringState: number[] = [1];
    for (let r = 1; r <= BOARD.rings; r++) {
      const open = ringUnlocked(p, r, ctx);
      const ringNodes = BOARD.nodes.filter((n) => n.ring === r && n.kind !== "keystone");
      const full = open && ringNodes.every((n) => (p.board.ranks[n.id] ?? 0) > 0);
      ringState[r] = full ? 2 : open ? 1 : 0;
      const c = orbs[r - 1];
      const cls = `orb ${full ? "done" : open ? "open" : "gated"}`;
      if (c && c.getAttribute("class") !== cls) c.setAttribute("class", cls);
    }
    // one gate chip on screen at a time: the next ring to open (it shimmers), plus a single "more seasons
    // TBA" teaser on the ring after it; rings further out wait quietly
    const nextGate = ringState.findIndex((st, r) => r > 0 && st === 0);
    for (const g of gateEls) {
      const r = Number(g.dataset.ring);
      const next = nextGate > 0 && r === nextGate;
      const tba = nextGate > 0 && r === nextGate + 1 && ringState[r] === 0;
      g.hidden = !next && !tba;
      g.classList.toggle("tba", tba);
      if (next !== g.classList.contains("next")) {
        g.classList.toggle("next", next);
        if (next) g.insertAdjacentHTML("beforeend", `<i class="g-shine" aria-hidden="true"></i>`);
        else g.querySelector(".g-shine")?.remove();
      }
    }
    gateSeen = -1;
    minimap.paint(dots, ringState);
    // HUD
    const pr = boardProgress(p);
    progEl.innerHTML = `<b>${pr.nodesOwned}</b> / ${pr.nodes} NODES · ${money("coins", fmtInt(pr.spent))} SPENT`;
    if (plan.length) {
      const cost = plan.reduce((a, s) => a + s.cost, 0);
      planEl.innerHTML = `<span class="pl-tx"><b>${plan.length}</b> node${plan.length === 1 ? "" : "s"} · ${money("coins", fmtInt(cost))}</span>${btn("BUY PATH", { cls: "gold small", act: "buyplan" })}`;
      bindActs(planEl, { buyplan: buyPlan });
    } else planEl.innerHTML = "";
  };

  // ---- node sheet (the map stays live around it: tap another star to switch)
  const openNode = (id: string) => {
    app.sfx("uiConfirm");
    sheetId = id;
    const c = nodeSheet(save.profile, id, ctx);
    if (sheet && !sheet.closed) {
      sheet.update(c);
      fillGlyphs(sheet.el);
      bindSheet();
    } else {
      sheet = openSheet(app, {
        ...c,
        cls: "node-sheet",
        onClose: () => {
          sheet = null;
          placeSel(null);
        },
      });
      sheet.el.classList.add("bd-sheet-wrap");
      fillGlyphs(sheet.el);
      bindSheet();
    }
    placeSel(id);
    // keep the star clear of the sheet: above a bottom sheet, left of a side panel
    requestAnimationFrame(() => frameNode(id));
  };

  const frameNode = (id: string) => {
    const n = BOARD.byId.get(id);
    if (!n || disposed) return;
    const area = { x0: 0, y0: 0, x1: vp.viewW, y1: vp.viewH };
    const sh = sheet && !sheet.closed ? (sheet.el.querySelector(".ksheet") as HTMLElement | null) : null;
    if (sh && sheet) {
      // the sheet's resting place (offsets ignore its slide-in transform)
      const w = sheet.el.getBoundingClientRect();
      const top = w.top + sh.offsetTop;
      const left = w.left + sh.offsetLeft;
      const v = vpEl.getBoundingClientRect();
      if (top > v.top + v.height * 0.25) area.y1 = Math.max(80, top - v.top);
      else if (left > v.left + v.width * 0.25) area.x1 = Math.max(80, left - v.left);
    }
    const [x, y] = px(n);
    vp.ensureVisible(x, y, 70, area);
  };

  const refreshSheet = () => {
    if (!sheet || sheet.closed || !sheetId) return;
    const c = nodeSheet(save.profile, sheetId, ctx);
    sheet.update({ html: c.html, foot: c.foot, icon: c.icon });
    fillGlyphs(sheet.el);
    bindSheet();
  };

  const bindSheet = () => {
    const s = sheet;
    if (!s) return;
    bindActs(s.el, {
      buy: (b) => buy(sheetId, b),
      refund: async () => {
        const n = BOARD.byId.get(sheetId);
        const ok = await confirmDialog(app, { title: "Refund this rank?", body: `<b>${esc(n?.name ?? "")}</b> loses one rank. You get back what that rank cost.`, ok: "REFUND", cancel: "Keep it" });
        if (!ok || disposed) return;
        const r = refundNode(save.profile, sheetId);
        if (!r.ok) {
          app.sfx("uiDeny");
          hub.toast(r.block === "strands" ? "Other nodes depend on this one." : "Nothing to refund.", { kind: "bad", sub: r.block === "strands" ? "Refund the nodes further out first." : undefined });
          return;
        }
        app.sfx("coin");
        plan = [];
        hub.changed();
        paint();
        refreshSheet();
        const to = centerIn(hub.cbar.pill("coins"), app.ui);
        flyCoins(fxLayer, centerIn(nodeEls.get(sheetId) ?? null, app.ui), to, 4, 420);
      },
      ks: () => {
        const r = toggleKeystone(save.profile, sheetId);
        if (!r.ok) {
          app.sfx("uiDeny");
          hub.toast(`${TUNING.board.keystoneSlots} arcs are already on air.`, { kind: "bad", sub: "Take one off air first." });
          return;
        }
        app.sfx(r.active ? "equip" : "uiBack");
        if (r.active) burstAt(content, ...px(BOARD.byId.get(sheetId) as BoardNode), { color: "#ff7ab8", label: "ON AIR!" });
        hub.changed(false);
        paint();
        refreshSheet();
      },
    });
  };

  // ---- buying (the juice)
  const calm = () => !!app.settings.reduceFlashing;

  /** Buy one rank of `id`; `quiet` = part of a BUY PATH montage (fewer coins, no sheet refresh). */
  const buy = (id: string, b?: HTMLElement, quiet = false): boolean => {
    const p = save.profile;
    const before = new Set<string>();
    for (const [nid, v] of views) if (v.reachable && v.ringOpen) before.add(nid);
    const prevRank = p.board.ranks[id] ?? 0;
    const r = buyNode(p, id, ctx);
    if (!r.ok) {
      app.sfx("nodeDeny");
      shake(b ?? null);
      if (!quiet) {
        if (r.block === "coins") hub.toast("Not enough Star Coins!", { kind: "bad", sub: "Have you tried... playing an episode?" });
        else if (r.block === "unreachable") hub.toast("Not connected yet.", { kind: "bad", sub: "Connect it to a node you own first. Training is a journey." });
      }
      return false;
    }
    const n = BOARD.byId.get(id) as BoardNode;
    const [x, y] = px(n);
    const nodeEl = nodeEls.get(id) ?? null;
    app.sfx("coin", 0.7, 2);
    if (b) pop(b, 1.1);
    plan = quiet ? plan : [];
    if (quiet) hub.cbar.sync(p.currencies, false);
    else hub.changed();
    if (!quiet) refreshSheet();
    // coins: from the coin pill to the star
    const fromPt = centerIn(hub.cbar.pill("coins"), app.ui);
    const toPt = centerIn(nodeEl?.querySelector(".bn-st") ?? nodeEl, app.ui);
    const land = flyCoins(fxLayer, fromPt, toPt, quiet ? 3 : Math.min(8, 4 + Math.round(Math.log10(Math.max(10, r.cost ?? 10)))), quiet ? 340 : 460);
    // the owned network lights the line into the new star while the coins travel
    if (prevRank === 0) {
      for (const ei of EDGES_OF.get(id) ?? []) {
        const [ea, eb] = BOARD.edges[ei];
        const other = ea === id ? eb : ea;
        if (other !== CENTER_ID && (p.board.ranks[other] ?? 0) <= 0) continue;
        const [ox, oy] = px(BOARD.byId.get(other) as BoardNode);
        ignite(content, { x: ox, y: oy }, { x, y }, Math.max(0, land - 260), 260);
      }
    }
    const hit = () => {
      const maxed = (p.board.ranks[id] ?? 0) >= n.maxRank;
      app.sfx("nodeBuy", 1, Math.min(6, prevRank * 2));
      app.input.haptic(n.kind === "keystone" ? [20, 40, 30] : 18);
      paint();
      popEl(nodeEls.get(id)?.querySelector(".bn-st") ?? null, n.kind === "keystone");
      burstAt(content, x, y, { color: sectorColor(n), big: n.kind === "keystone" || maxed, flash: !calm(), label: maxed && n.maxRank > 1 ? "MAX!" : n.maxRank > 1 ? `RANK ${prevRank + 1}` : "GET!" });
      // neighbours that just came into reach twinkle in, outward from the new star
      let k = 0;
      for (const o2 of n.links) {
        const v = views.get(o2);
        if (v && v.reachable && v.ringOpen && v.rank === 0 && !before.has(o2)) revealEl(nodeEls.get(o2)?.querySelector(".bn-st") ?? null, 120 + k++ * 70);
      }
      if (n.kind === "keystone" && prevRank === 0)
        later(reducedMotion() ? 0 : 420, () =>
          keystoneSplash(app, {
            node: n,
            activated: !!r.activated,
            slots: TUNING.board.keystoneSlots,
            calm: calm(),
            done: () => {
              paint();
              refreshSheet();
            },
          }),
        );
    };
    if (land > 0) later(land, hit);
    else hit();
    return true;
  };

  const buyPlan = () => {
    if (buyingPlan || !plan.length) return;
    const steps = plan.slice();
    buyingPlan = true;
    let i = 0;
    let bought = 0;
    const step = () => {
      if (disposed) return;
      const s = steps[i++];
      if (!s || !buy(s.id, undefined, true)) {
        buyingPlan = false;
        plan = [];
        hub.changed();
        later(reducedMotion() ? 0 : 520, () => {
          paint();
          refreshSheet();
        });
        if (bought > 0) hub.toast(`Montage complete: ${bought} node${bought === 1 ? "" : "s"}!`, { kind: "good", sub: "Training Arc: cleared. (This episode.)" });
        else app.sfx("nodeDeny");
        return;
      }
      bought++;
      later(reducedMotion() ? 0 : 170, step);
    };
    step();
  };

  bindActs(el, {
    node: (b) => openNode(b.dataset.id as string),
    zin: () => vp.zoomBy(1.3),
    zout: () => vp.zoomBy(1 / 1.3),
    home: () => vp.go(0, 0, Math.max(vp.z, 0.8)),
    auto: (b) => {
      const p = save.profile;
      if (plan.length) {
        plan = [];
        app.sfx("uiBack");
        b.classList.remove("on");
        paint();
        return;
      }
      plan = autoPath(p, ctx, { maxSteps: 15 });
      if (!plan.length) {
        app.sfx("uiDeny");
        shake(b);
        hub.toast(affordableNodes(p, ctx).length ? "Nothing on the path." : "Nothing affordable right now.", { kind: "bad", sub: "Not enough Star Coins! Have you tried... playing an episode?" });
      } else {
        app.sfx("uiConfirm");
        b.classList.add("on");
        const box = boxOf(plan.map((s) => s.id), 80);
        vp.go((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, Math.min(1, vp.fitZoom(box, 40)));
      }
      paint();
    },
    respec: async (b) => {
      const p = save.profile;
      const pr = boardProgress(p);
      if (pr.spent <= 0) {
        app.sfx("uiDeny");
        shake(b);
        hub.toast("Nothing to reboot yet.", { kind: "info", sub: "Buy a node first. Then regret it." });
        return;
      }
      const fee = respecFee(p);
      const ok = await confirmDialog(app, {
        title: "Reboot the series?",
        body: `All nodes will be refunded (minus a small fee for the reboot).<div class="bd-respec">${money("coins", fmtInt(pr.spent - fee))}<small>refund</small><span>·</span>${money("coins", fmtInt(fee), "poor")}<small>reboot fee</small></div>`,
        ok: "REBOOT",
        cancel: "Keep my arc",
        danger: true,
      });
      if (!ok || disposed) return;
      sheet?.close();
      app.sfx("cassetteEject");
      await rewind(vpEl);
      if (disposed) return;
      const r = respecBoard(save.profile);
      plan = [];
      app.sfx("reroll");
      hub.changed();
      paint();
      vp.go(0, 0, vp.z);
      flyCoins(fxLayer, { x: app.ui.clientWidth / 2, y: app.ui.clientHeight / 2 }, centerIn(hub.cbar.pill("coins"), app.ui), 8, 520);
      hub.toast("Series rebooted!", { kind: "good", sub: `${fmtInt(r.refund)} Star Coins back. The fee was ${fmtInt(r.fee)}. Showbiz.` });
    },
  });
  // keyboard / gamepad focus: keep the focused star on screen
  el.addEventListener("navfocus", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".bn");
    const n = b ? BOARD.byId.get(b.dataset.id as string) : undefined;
    if (n) {
      const [x, y] = px(n);
      vp.ensureVisible(x, y, 110);
    }
  });

  paint();

  // start (first frame, once laid out): the cheapest affordable node (results "Upgrade"), else the centre
  const start = o.focus === "affordable" ? affordableNodes(save.profile, ctx)[0]?.node : undefined;
  const startEl = start ? nodeEls.get(start.id) : nodeEls.get(CENTER_ID);
  layer.focus = startEl ?? null;
  let placed = false;
  const place = () => {
    placed = true;
    vp.measure();
    // fit rings 1-2 (the early game) in the shorter side of the view
    const z = Math.max(0.42, Math.min(1.05, Math.min(vp.viewW, vp.viewH) / (2 * (RING_PX[2] + 70))));
    const [sx, sy] = start ? px(start) : [0, 0];
    vp.go(sx * 0.6, sy * 0.6, z, 0);
    if (start) later(450, () => popEl(startEl?.querySelector(".bn-st") ?? null));
  };

  // gate chips under the HUD (top bar, zoom buttons, minimap, AUTO-PATH / RESPEC) fade out: checked only
  // when the camera moved, from the chips' map positions (no layout read; the HUD rects and chip sizes are
  // measured once, again after a resize)
  const onResize = () => {
    hudRects = null;
    gateSize.clear();
    gateSeen = -1;
  };
  window.addEventListener("resize", onResize);
  const fadeGates = () => {
    if (vp.version === gateSeen) return;
    gateSeen = vp.version;
    const live = gateEls.filter((g) => !g.hidden);
    if (!live.length) return;
    // (in map-host coordinates: measured together, a page slide-in moves both alike)
    if (!hudRects) {
      const host = vpEl.getBoundingClientRect();
      const head = document.querySelector<HTMLElement>(".hub-top");
      // (not the welcome line: it fades out after a few seconds, and a chip it covered would stay faded for good)
      hudRects = [...el.querySelectorAll<HTMLElement>(".bd-prog, .bd-zoom, .bd-bar > *, .bd-mini"), ...(head ? [head] : [])]
        .map((h) => h.getBoundingClientRect())
        .filter((r) => r.width > 0)
        .map((r) => new DOMRect(r.left - host.left, r.top - host.top, r.width, r.height));
    }
    for (const g of live) {
      let sz = gateSize.get(g);
      if (!sz) gateSize.set(g, (sz = [g.offsetWidth, g.offsetHeight]));
      const [sx, sy] = vp.toScreen(Number(g.dataset.x), Number(g.dataset.y));
      const w = (sz[0] * vp.z) / 2;
      const hh = (sz[1] * vp.z) / 2;
      const under = hudRects.some((r) => sx - w < r.right && sx + w > r.left && sy - hh < r.bottom && sy + hh > r.top);
      if (under !== g.classList.contains("under")) g.classList.toggle("under", under);
    }
  };

  // sky parallax (a quarter of the map's speed) - written only when the camera moved
  let skySeen = -1;
  const followSky = () => {
    if (vp.version === skySeen) return;
    skySeen = vp.version;
    const T = 256;
    const ox = (((-vp.cx * vp.z * 0.22) % T) + T) % T;
    const oy = (((-vp.cy * vp.z * 0.22) % T) + T) % T;
    sky.style.transform = `translate3d(${(ox - T).toFixed(1)}px, ${(oy - T).toFixed(1)}px, 0)`;
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
      followSky();
      fadeGates();
      minimap.follow(vp);
    },
    dispose() {
      disposed = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      sheet?.close();
      vp.dispose();
      window.removeEventListener("resize", onResize);
      fxLayer.remove();
    },
  };
}
