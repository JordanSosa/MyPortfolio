// The passive constellation window: zoomable/pannable canvas over ~330 nodes.

import { G } from "../core/state.js";
import { TREE } from "../data/passives.js";
import { CLASSES } from "../data/classes.js";
import { on } from "../core/events.js";
import { allocateNode, refundNode, nodeAllocatable, RESPEC_COST } from "../systems/actions.js";
import { showTooltipHtml, hideTooltip, modText } from "./tooltip.js";

const FLAVOR_HEX = { str: "#e0574f", int: "#8f7ff5", dex: "#57c47a" };

let cv, ctx, win;
const view = { x: 0, y: 0, scale: 0.55 };
let hoverNode = null;
let searchTerm = "";

export function initTreeWindow(makeWindow) {
  win = makeWindow("tree", "Passive Constellation (P)", { x: 0, y: 0 });
  win.el.style.left = "50%";
  win.el.style.top = "50%";

  const top = document.createElement("div");
  top.className = "tree-top";
  top.innerHTML = `<span id="tree-pts"></span><input id="tree-search" placeholder="Search nodes…"/><span style="color:#9a94b0;font-size:11px">click: allocate · click allocated: refund (${RESPEC_COST}g) · drag: pan · wheel: zoom</span>`;
  win.body.style.padding = "0";
  win.body.appendChild(top);

  cv = document.createElement("canvas");
  cv.id = "tree-cv";
  win.body.appendChild(cv);
  ctx = cv.getContext("2d");

  const sizeCanvas = () => {
    cv.width = Math.min(window.innerWidth - 80, 1060);
    cv.height = Math.min(window.innerHeight - 160, 640);
  };
  sizeCanvas();
  window.addEventListener("resize", () => { sizeCanvas(); if (win.isOpen()) draw(); });

  top.querySelector("#tree-search").addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    draw();
  });
  top.querySelector("#tree-search").addEventListener("keydown", (e) => e.stopPropagation());

  // pan/zoom
  let drag = null;
  cv.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      view.x += dx / view.scale;
      view.y += dy / view.scale;
      drag.x = e.clientX; drag.y = e.clientY;
      draw();
    } else {
      const n = nodeAt(e);
      if (n !== hoverNode) {
        hoverNode = n;
        draw();
      }
      if (n) showTooltipHtml(nodeTooltip(n), e);
      else hideTooltip();
    }
  });
  cv.addEventListener("pointerup", (e) => {
    const wasDrag = drag && drag.moved > 6;
    drag = null;
    if (wasDrag) return;
    const n = nodeAt(e);
    if (!n || n.kind === "start") return;
    if (G.player.allocated.includes(n.id)) refundNode(n.id);
    else allocateNode(n.id);
    draw();
  });
  cv.addEventListener("pointerleave", () => { hoverNode = null; hideTooltip(); });
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    view.scale = Math.max(0.28, Math.min(1.8, view.scale * (e.deltaY > 0 ? 0.88 : 1.14)));
    draw();
  }, { passive: false });

  win.render = () => {
    // center on the player's class start on open
    const start = TREE.starts[G.player.classId];
    if (!win._centered) {
      view.x = -start.x * 1.6;
      view.y = -start.y * 1.6;
      win._centered = true;
    }
    draw();
  };
  on("treeChanged", () => { if (win.isOpen()) draw(); });
}

function toScreen(n) {
  return {
    x: cv.width / 2 + (n.x + view.x) * view.scale,
    y: cv.height / 2 + (n.y + view.y) * view.scale,
  };
}

function nodeAt(e) {
  const rect = cv.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  for (const n of TREE.nodes) {
    const s = toScreen(n);
    const r = radiusFor(n) * view.scale + 4;
    if ((mx - s.x) ** 2 + (my - s.y) ** 2 < r * r) return n;
  }
  return null;
}

function radiusFor(n) {
  return n.kind === "keystone" ? 16 : n.kind === "notable" ? 11 : n.kind === "start" ? 13 : 6.5;
}

function draw() {
  if (!win.isOpen()) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const allocated = new Set(G.player.allocated);
  document.getElementById("tree-pts").textContent = `${G.player.passivePoints} point${G.player.passivePoints === 1 ? "" : "s"}`;

  // edges
  ctx.lineWidth = Math.max(1, 1.6 * view.scale);
  for (const [a, b] of TREE.edges) {
    const na = TREE.nodes[a], nb = TREE.nodes[b];
    const sa = toScreen(na), sb = toScreen(nb);
    if ((sa.x < -50 && sb.x < -50) || (sa.x > cv.width + 50 && sb.x > cv.width + 50)) continue;
    const both = allocated.has(a) && allocated.has(b);
    ctx.strokeStyle = both ? "#e8c86a" : "rgba(120,120,160,.35)";
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
  }

  // nodes
  for (const n of TREE.nodes) {
    const s = toScreen(n);
    if (s.x < -30 || s.x > cv.width + 30 || s.y < -30 || s.y > cv.height + 30) continue;
    const r = radiusFor(n) * view.scale;
    const isAlloc = allocated.has(n.id);
    const canAlloc = !isAlloc && nodeAllocatable(n.id);
    const flavorHex = FLAVOR_HEX[n.flavor] || "#c8c8e0";
    const matchesSearch = searchTerm && (n.name || "").toLowerCase().includes(searchTerm);

    ctx.beginPath();
    if (n.kind === "keystone") {
      polygon(s.x, s.y, r, 6);
    } else {
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    }
    if (isAlloc) {
      ctx.fillStyle = flavorHex;
      ctx.fill();
      ctx.lineWidth = 2.5 * view.scale;
      ctx.strokeStyle = "#ffe8a0";
      ctx.stroke();
    } else {
      ctx.fillStyle = canAlloc ? "rgba(200,200,230,.5)" : "rgba(70,72,100,.8)";
      ctx.fill();
      ctx.lineWidth = 1.5 * view.scale;
      ctx.strokeStyle = canAlloc ? "#ffe8a0" : flavorHex + "66";
      ctx.stroke();
    }
    if (n.kind === "start") {
      ctx.fillStyle = CLASSES[n.classStart].uiColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (matchesSearch) {
      ctx.lineWidth = 3 * view.scale;
      ctx.strokeStyle = "#ffd23e";
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 5 * view.scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (n === hoverNode) {
      ctx.lineWidth = 2 * view.scale;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 3 * view.scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    // labels for big nodes when zoomed in
    if ((n.kind === "notable" || n.kind === "keystone" || n.kind === "start") && view.scale > 0.5) {
      ctx.font = `bold ${Math.round(10 * Math.min(1.2, view.scale + 0.4))}px "Trebuchet MS"`;
      ctx.textAlign = "center";
      ctx.fillStyle = n.kind === "keystone" ? "#ffd700" : "#e8e2d0";
      ctx.fillText(n.name, s.x, s.y - r - 5);
    }
  }
}

function polygon(x, y, r, sides) {
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
}

function nodeTooltip(n) {
  const isAlloc = G.player.allocated.includes(n.id);
  const kindName = n.kind === "keystone" ? "Keystone" : n.kind === "notable" ? "Notable" : n.kind === "start" ? "Class Origin" : "Passive";
  let h = `<div class="tt-name" style="color:${n.kind === "keystone" ? "#ffd700" : "#ffe8b0"}">${n.name}</div>`;
  h += `<div class="tt-type">${kindName}</div>`;
  if (n.desc) h += `<div>${n.desc}</div>`;
  for (const m of n.mods || []) h += `<div class="tt-affix">${modText(m)}</div>`;
  if (n.kind !== "start") {
    if (isAlloc) h += `<div class="tt-foot">Allocated — click to refund (${RESPEC_COST}g)</div>`;
    else if (nodeAllocatable(n.id)) h += `<div class="tt-foot">Click to allocate (${G.player.passivePoints} points left)</div>`;
    else h += `<div class="tt-foot">${G.player.passivePoints > 0 ? "Not connected to your path yet" : "No passive points available"}</div>`;
  }
  return h;
}
