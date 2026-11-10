/**
 * Builds the Training Arc board graph from the sector data: constellation
 * layout (polar: rings around the centre, one 60° wedge per sector, the
 * cheapest "spine" nodes in the middle of each wedge, a little deterministic
 * jitter so it reads as stars, keystones floating beyond ring 5), edges
 * (inward links, arcs inside a sector, full loops on rings 1 and 3, keystones
 * as leaves) and per-rank coin costs. Deterministic and built once.
 */
import { TUNING } from "../tuning";
import { hash01 } from "../util";
import { SECTORS } from "./data";
import type { BoardGraph, BoardNode, NodeEffect, NodeSpec, SectorSpec } from "./types";

export const CENTER_ID = "episode_1";
const RING_R = 120;
const KEYSTONE_R = 5 * RING_R + 60;
const DEG = Math.PI / 180;

/** Round a cost to a friendly number (5 / 25 / 100 / 500 steps as it grows). */
export function niceCost(v: number): number {
  const step = v < 100 ? 1 : v < 1000 ? 5 : v < 10000 ? 25 : v < 100000 ? 100 : 500;
  return Math.max(1, Math.round(v / step) * step);
}

/** Per-rank costs of a node spec at ring `ring`, authoring index `i` of `n` in its sector ring. */
export function specCosts(spec: NodeSpec, ring: number, i: number, n: number): number[] {
  const B = TUNING.board;
  const kind = spec.kind ?? "stat";
  const base = B.ringCost[Math.min(B.ringCost.length - 1, ring - 1)] * (B.kindMul[kind] ?? 1) * (1 + (B.pathGrowth * i) / Math.max(1, n - 1)) * (spec.costMul ?? 1);
  const out: number[] = [];
  for (let r = 0; r < Math.max(1, spec.max ?? 1); r++) out.push(niceCost(base * Math.pow(B.rankGrowth, r)));
  return out;
}

const ICON_BY_STAT: Record<string, string> = {
  might: "icon_power_bow",
  crit: "icon_lucky_clover",
  critMult: "icon_power_bow",
  area: "icon_big_ribbon",
  amount: "icon_twin_charm",
  knock: "icon_power_bow",
  maxHp: "icon_hp_up",
  regen: "icon_heart_locket",
  armor: "icon_heart",
  healMul: "icon_heart_locket",
  dmgReduction: "icon_heart",
  shield: "icon_bubble_aura",
  moveSpeed: "icon_swift_shoes",
  dashCd: "icon_swift_shoes",
  cooldown: "icon_wish_charm",
  projSpeed: "icon_star_shot",
  duration: "icon_wish_charm",
  rerolls: "icon_reroll",
  growth: "icon_wish_charm",
  cards: "icon_reroll",
  greed: "icon_gold_up",
  pickup: "icon_magnet_star",
  luck: "icon_lucky_clover",
  gemFind: "icon_gem",
  curse: "icon_skull",
};
const ICON_BY_FLAG: Record<string, string> = {
  revives: "icon_hp_up",
  plotArmor: "icon_heart",
  dashCharges: "icon_swift_shoes",
  banish: "icon_reroll",
  skip: "icon_reroll",
  chestLuck: "icon_chest",
  eliteRate: "icon_skull",
  ultStart: "icon_star_shot",
  friendship: "icon_twin_charm",
};

function iconFor(fx: readonly NodeEffect[]): string {
  const e = fx[0];
  if (!e) return "icon_star_shot";
  if (e.t === "stat" || e.t === "statPct") return ICON_BY_STAT[e.stat] ?? "icon_star_shot";
  if (e.t === "flag") return ICON_BY_FLAG[e.flag] ?? "icon_star_shot";
  if (e.t === "slot") return e.slot === "relic" ? "icon_chest" : e.slot === "weapon" ? "icon_star_shot" : "icon_big_ribbon";
  return "icon_star_shot";
}

/** Slot order for `n` nodes: the middle first, then alternating outward (authoring order = cost order). */
function centerOut(n: number): number[] {
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
}

export function buildBoard(sectors: readonly SectorSpec[] = SECTORS): BoardGraph {
  const nodes: BoardNode[] = [];
  const links = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    links.get(a)!.add(b);
    links.get(b)!.add(a);
  };
  type Placed = { id: string; ring: number; sector: number; angle: number; keystone: boolean };
  const placed: Placed[] = [];
  const nS = sectors.length;
  const wedge = 360 / Math.max(1, nS);
  const raw: { spec: NodeSpec; ring: number; sector: number; angle: number; radius: number; costs: number[] }[] = [];

  sectors.forEach((sec, k) => {
    const center = -90 + wedge * k;
    sec.rings.forEach((list, ri) => {
      const ring = ri + 1;
      const plain = list.filter((s) => s.kind !== "keystone");
      const keys = list.filter((s) => s.kind === "keystone");
      const spread = Math.min(wedge * 0.85, 38 + ring * 3);
      const slots = centerOut(plain.length);
      plain.forEach((spec, i) => {
        const slot = slots[i];
        const t = plain.length > 1 ? slot / (plain.length - 1) - 0.5 : 0;
        const jitterA = (hash01(spec.id + ":a") - 0.5) * 6;
        const jitterR = (hash01(spec.id + ":r") - 0.5) * 14;
        raw.push({ spec, ring, sector: k, angle: center + t * spread + jitterA, radius: ring * RING_R + jitterR, costs: specCosts(spec, ring, i, plain.length) });
      });
      keys.forEach((spec, i) => {
        const t = keys.length > 1 ? i / (keys.length - 1) - 0.5 : 0;
        raw.push({ spec, ring, sector: k, angle: center + t * 26, radius: KEYSTONE_R + (hash01(spec.id) - 0.5) * 10, costs: specCosts(spec, ring, plain.length, plain.length + 1) });
      });
    });
  });

  const center: BoardNode = {
    id: CENTER_ID,
    name: "Episode 1: Pilot",
    kind: "center",
    ring: 0,
    sector: -1,
    maxRank: 1,
    effects: [],
    flavor: "Every legend starts somewhere. Yours starts here, with a tutorial.",
    costs: [0],
    x: 0,
    y: 0,
    links: [],
    icon: "icon_star_shot",
  };
  nodes.push(center);
  const seen = new Set<string>([CENTER_ID]);
  for (const r of raw) {
    if (seen.has(r.spec.id)) throw new Error(`[board] duplicate node id '${r.spec.id}'`);
    seen.add(r.spec.id);
    const a = r.angle * DEG;
    nodes.push({
      id: r.spec.id,
      name: r.spec.name,
      kind: r.spec.kind ?? "stat",
      ring: r.ring,
      sector: r.sector,
      maxRank: Math.max(1, r.spec.max ?? 1),
      effects: r.spec.fx,
      flavor: r.spec.flavor ?? "",
      costs: r.costs,
      x: Math.round(Math.cos(a) * r.radius * 10) / 10,
      y: Math.round(Math.sin(a) * r.radius * 10) / 10,
      links: [],
      icon: iconFor(r.spec.fx),
    });
    placed.push({ id: r.spec.id, ring: r.ring, sector: r.sector, angle: r.angle, keystone: r.spec.kind === "keystone" });
  }

  const angDist = (a: number, b: number) => {
    const d = Math.abs(((a - b) % 360) + 360) % 360;
    return d > 180 ? 360 - d : d;
  };
  const inRing = (ring: number, sector: number) => placed.filter((p) => p.ring === ring && p.sector === sector && !p.keystone).sort((a, b) => a.angle - b.angle);
  const nearest = (from: Placed, pool: Placed[]) => pool.reduce((best, p) => (angDist(p.angle, from.angle) < angDist(best.angle, from.angle) ? p : best));

  for (let k = 0; k < nS; k++) {
    for (let ring = 1; ring <= 5; ring++) {
      const here = inRing(ring, k);
      // inward links
      for (const p of here) {
        if (ring === 1) link(p.id, CENTER_ID);
        else {
          const prev = inRing(ring - 1, k);
          if (prev.length) link(p.id, nearest(p, prev).id);
        }
      }
      // arcs inside the sector
      for (let i = 1; i < here.length; i++) link(here[i - 1].id, here[i].id);
      // keystones hang off ring 5
      if (ring === 5) {
        for (const ksn of placed.filter((p) => p.ring === 5 && p.sector === k && p.keystone)) if (here.length) link(ksn.id, nearest(ksn, here).id);
      }
    }
  }
  // full loops on rings 1 and 3 (lateral moves between sectors)
  for (const ring of [1, 3]) {
    for (let k = 0; k < nS; k++) {
      const a = inRing(ring, k);
      const b = inRing(ring, (k + 1) % nS);
      if (a.length && b.length && nS > 1) link(a[a.length - 1].id, b[0].id);
    }
  }

  const edges: [string, string][] = [];
  for (const n of nodes) {
    const ls = [...(links.get(n.id) ?? [])].sort();
    (n as { links: readonly string[] }).links = ls;
    for (const o of ls) if (n.id < o) edges.push([n.id, o]);
  }
  edges.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  return {
    nodes,
    byId: new Map(nodes.map((n) => [n.id, n])),
    center,
    edges,
    sectors: sectors.map((s, k) => ({ id: s.id, name: s.name, color: s.color, angle: -90 + wedge * k })),
    rings: 5,
    radius: [0, RING_R, 2 * RING_R, 3 * RING_R, 4 * RING_R, 5 * RING_R, KEYSTONE_R],
  };
}

/** The board (built once at import). */
export const BOARD: BoardGraph = buildBoard();
