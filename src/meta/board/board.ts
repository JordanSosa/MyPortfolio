/**
 * Training Arc board rules (docs/EXPANSION.md §5): ring gating by stage
 * clears, buying ranks next to owned nodes, single-rank refunds that never
 * strand other nodes, a cheap full respec, keystone slots, the "auto-path"
 * helper, and applyBoard -> stat mod + run flags + slots + start bonuses.
 * PURE: functions read / mutate the given Profile only.
 */
import type { RunFlag } from "../../game/run-config";
import type { Stats, StatMod } from "../../game/stats";
import { gameContent, stageByOrder, type MetaContent } from "../content";
import type { Profile } from "../profile";
import { TUNING } from "../tuning";
import { BOARD, CENTER_ID } from "./graph";
import { LEGACY_SHOP_NODES } from "./data";
import type { BoardGraph, BoardNode, NodeEffect, StatKey } from "./types";
import { pct, signed } from "../util";
import { oldShopCost, OLD_SHOP } from "../legacy";

// ---------------------------------------------------------------- state queries

export function nodeRank(p: Profile, id: string): number {
  return id === CENTER_ID ? 1 : (p.board.ranks[id] ?? 0);
}

/** Coins paid for everything currently bought. */
export function boardSpent(p: Profile): number {
  let s = 0;
  for (const k in p.board.paid) s += p.board.paid[k];
  return s;
}

/** Stage whose clear opens `ring` (ring 1 is always open; ring r needs the stage with order r - 1). */
export function ringGate(ring: number, ctx: MetaContent = gameContent()) {
  return ring <= 1 ? undefined : stageByOrder(ring - 1, ctx);
}

export function ringUnlocked(p: Profile, ring: number, ctx: MetaContent = gameContent()): boolean {
  if (ring <= 1) return true;
  const st = ringGate(ring, ctx);
  return !!st && (p.records[st.id]?.clears ?? 0) > 0;
}

/** Cost of the next rank (Infinity when maxed). */
export function nextCost(node: BoardNode, rank: number): number {
  return rank >= node.maxRank ? Infinity : node.costs[rank];
}

/** True if `id` touches an owned node (the centre counts as owned). */
export function isReachable(p: Profile, id: string, g: BoardGraph = BOARD): boolean {
  const n = g.byId.get(id);
  if (!n) return false;
  if (n.kind === "center") return true;
  for (const o of n.links) if (nodeRank(p, o) > 0) return true;
  return false;
}

export type BuyBlock = "unknown" | "maxed" | "ring" | "unreachable" | "coins";

export interface NodeView {
  node: BoardNode;
  rank: number;
  maxed: boolean;
  /** Next rank's cost (Infinity when maxed). */
  cost: number;
  ringOpen: boolean;
  reachable: boolean;
  affordable: boolean;
  /** Why it can't be bought right now (undefined = buyable). */
  block?: BuyBlock;
  /** Keystones: switched on. */
  active: boolean;
}

export function nodeView(p: Profile, id: string, ctx: MetaContent = gameContent(), g: BoardGraph = BOARD): NodeView | undefined {
  const node = g.byId.get(id);
  if (!node) return undefined;
  const rank = nodeRank(p, id);
  const maxed = rank >= node.maxRank;
  const cost = nextCost(node, rank);
  const ringOpen = ringUnlocked(p, node.ring, ctx);
  const reachable = isReachable(p, id, g);
  const affordable = !maxed && p.currencies.coins >= cost;
  const block: BuyBlock | undefined = maxed ? "maxed" : !ringOpen ? "ring" : !reachable ? "unreachable" : !affordable ? "coins" : undefined;
  return { node, rank, maxed, cost, ringOpen, reachable, affordable, block, active: node.kind === "keystone" && p.board.active.includes(id) };
}

export function canBuy(p: Profile, id: string, ctx: MetaContent = gameContent(), g: BoardGraph = BOARD): { ok: boolean; block?: BuyBlock } {
  const v = nodeView(p, id, ctx, g);
  if (!v) return { ok: false, block: "unknown" };
  return v.block ? { ok: false, block: v.block } : { ok: true };
}

// ---------------------------------------------------------------- buy / refund / respec

export interface BuyResult {
  ok: boolean;
  block?: BuyBlock;
  cost?: number;
  rank?: number;
  /** A keystone that was switched on automatically (a free slot). */
  activated?: boolean;
}

/** Buy the next rank of a node. */
export function buyNode(p: Profile, id: string, ctx: MetaContent = gameContent(), g: BoardGraph = BOARD): BuyResult {
  const v = nodeView(p, id, ctx, g);
  if (!v) return { ok: false, block: "unknown" };
  if (v.block) return { ok: false, block: v.block };
  p.currencies.coins -= v.cost;
  p.board.paid[id] = (p.board.paid[id] ?? 0) + v.cost;
  p.board.ranks[id] = v.rank + 1;
  let activated = false;
  if (v.node.kind === "keystone" && !p.board.active.includes(id) && p.board.active.length < TUNING.board.keystoneSlots) {
    p.board.active.push(id);
    activated = true;
  }
  return { ok: true, cost: v.cost, rank: v.rank + 1, activated };
}

/** Owned node ids connected to the centre through owned nodes, with `without` treated as unowned. */
function connectedOwned(p: Profile, g: BoardGraph, without?: string): Set<string> {
  const out = new Set<string>([CENTER_ID]);
  const stack = [CENTER_ID];
  while (stack.length) {
    const id = stack.pop()!;
    for (const o of g.byId.get(id)?.links ?? []) {
      if (o === without || out.has(o) || nodeRank(p, o) <= 0) continue;
      out.add(o);
      stack.push(o);
    }
  }
  return out;
}

export type RefundBlock = "unknown" | "unowned" | "strands";

/**
 * Refund the top rank of a node (TUNING.board.nodeRefundRate of what it cost).
 * Removing the last rank is refused if it would disconnect another owned node
 * from the centre.
 */
export function refundNode(p: Profile, id: string, g: BoardGraph = BOARD): { ok: boolean; block?: RefundBlock; refund?: number } {
  const node = g.byId.get(id);
  if (!node || node.kind === "center") return { ok: false, block: "unknown" };
  const rank = nodeRank(p, id);
  if (rank <= 0) return { ok: false, block: "unowned" };
  if (rank === 1) {
    const before = connectedOwned(p, g);
    const after = connectedOwned(p, g, id);
    for (const o of before) if (o !== id && !after.has(o)) return { ok: false, block: "strands" };
  }
  const paidHere = p.board.paid[id] ?? 0;
  // the top rank's share of what this node cost (the last rank refunds whatever is left, e.g. old Dream Shop prices)
  const share = rank === 1 ? paidHere : Math.min(paidHere, node.costs[rank - 1] ?? 0);
  const refund = Math.floor(share * TUNING.board.nodeRefundRate);
  p.currencies.coins += refund;
  if (rank === 1) {
    delete p.board.ranks[id];
    delete p.board.paid[id];
    p.board.active = p.board.active.filter((x) => x !== id);
  } else {
    p.board.ranks[id] = rank - 1;
    p.board.paid[id] = paidHere - share;
  }
  return { ok: true, refund };
}

/** Full respec fee for the current board (cheap: TUNING.board.respec*), never more than the refund. */
export function respecFee(p: Profile): number {
  const B = TUNING.board;
  const spent = boardSpent(p);
  if (spent <= 0) return 0;
  return Math.min(spent, Math.min(B.respecCap, Math.round(B.respecBase + B.respecRate * spent)));
}

/** Reset the whole board: refund everything spent minus the respec fee. */
export function respecBoard(p: Profile): { refund: number; fee: number } {
  const fee = respecFee(p);
  const refund = Math.max(0, boardSpent(p) - fee);
  p.currencies.coins += refund;
  p.board.ranks = {};
  p.board.paid = {};
  p.board.active = [];
  if (fee > 0 || refund > 0) p.board.respecs++;
  return { refund, fee };
}

/** Switch an owned keystone on / off (at most TUNING.board.keystoneSlots on). */
export function toggleKeystone(p: Profile, id: string, g: BoardGraph = BOARD): { ok: boolean; active: boolean; reason?: "unknown" | "unowned" | "slots" } {
  const node = g.byId.get(id);
  if (!node || node.kind !== "keystone") return { ok: false, active: false, reason: "unknown" };
  if (nodeRank(p, id) <= 0) return { ok: false, active: false, reason: "unowned" };
  const i = p.board.active.indexOf(id);
  if (i >= 0) {
    p.board.active.splice(i, 1);
    return { ok: true, active: false };
  }
  if (p.board.active.length >= TUNING.board.keystoneSlots) return { ok: false, active: false, reason: "slots" };
  p.board.active.push(id);
  return { ok: true, active: true };
}

// ---------------------------------------------------------------- planning helpers

/** Every node that can be bought right now, cheapest first ("affordable nodes pulse"). */
export function affordableNodes(p: Profile, ctx: MetaContent = gameContent(), g: BoardGraph = BOARD): NodeView[] {
  const out: NodeView[] = [];
  for (const n of g.nodes) {
    if (n.kind === "center") continue;
    const v = nodeView(p, n.id, ctx, g);
    if (v && !v.block) out.push(v);
  }
  return out.sort((a, b) => a.cost - b.cost || (a.node.id < b.node.id ? -1 : 1));
}

export interface PlanStep {
  id: string;
  rank: number;
  cost: number;
}

/**
 * "Auto-path": the greedy sequence of cheapest purchases the current coins can
 * afford (each step can open new neighbours). Does not change the profile.
 * `score` (optional) ranks candidates instead of raw cost (the progression
 * simulator's value policy); higher score first.
 */
export function autoPath(p: Profile, ctx: MetaContent = gameContent(), opts: { budget?: number; maxSteps?: number; score?: (node: BoardNode, rank: number, cost: number) => number } = {}, g: BoardGraph = BOARD): PlanStep[] {
  const ranks: Record<string, number> = { ...p.board.ranks };
  let coins = opts.budget ?? p.currencies.coins;
  const max = opts.maxSteps ?? 500;
  const rank = (id: string) => (id === CENTER_ID ? 1 : (ranks[id] ?? 0));
  const ringOpen = new Map<number, boolean>();
  for (let r = 1; r <= g.rings; r++) ringOpen.set(r, ringUnlocked(p, r, ctx));
  const steps: PlanStep[] = [];
  while (steps.length < max) {
    let best: { n: BoardNode; cost: number; s: number } | null = null;
    for (const n of g.nodes) {
      if (n.kind === "center" || !ringOpen.get(n.ring)) continue;
      const r = rank(n.id);
      if (r >= n.maxRank) continue;
      const cost = n.costs[r];
      if (cost > coins) continue;
      if (!n.links.some((o) => rank(o) > 0)) continue;
      const s = opts.score ? opts.score(n, r + 1, cost) : -cost;
      if (!best || s > best.s || (s === best.s && n.id < best.n.id)) best = { n, cost, s };
    }
    if (!best) break;
    coins -= best.cost;
    ranks[best.n.id] = rank(best.n.id) + 1;
    steps.push({ id: best.n.id, rank: ranks[best.n.id], cost: best.cost });
  }
  return steps;
}

export interface BoardProgress {
  ranks: number;
  totalRanks: number;
  nodesOwned: number;
  nodes: number;
  spent: number;
  totalCost: number;
}

export function boardProgress(p: Profile, g: BoardGraph = BOARD): BoardProgress {
  let ranks = 0;
  let totalRanks = 0;
  let owned = 0;
  let nodes = 0;
  let totalCost = 0;
  for (const n of g.nodes) {
    if (n.kind === "center") continue;
    nodes++;
    totalRanks += n.maxRank;
    for (const c of n.costs) totalCost += c;
    const r = Math.min(n.maxRank, nodeRank(p, n.id));
    ranks += r;
    if (r > 0) owned++;
  }
  return { ranks, totalRanks, nodesOwned: owned, nodes, spent: boardSpent(p), totalCost };
}

// ---------------------------------------------------------------- effects

export interface BoardEffects {
  /** One stat modifier for RunConfig.mods (null when the board adds no stats). */
  mod: StatMod | null;
  /** Additive / multiplicative totals per stat (UI summary). */
  stats: Partial<Record<StatKey, { add: number; mul: number }>>;
  flags: Partial<Record<RunFlag, number>>;
  /** Extra slots from the board. */
  slots: { relic: number; weapon: number; passive: number };
  /** Extra starting levels. */
  startLevel: number;
  /** Level the chosen start weapon begins at (0 = no node). */
  startWeaponLevel: number;
  /** Active keystone ids that applied. */
  keystones: string[];
}

/** Everything the purchased board ranks do in a run (only active keystones count). */
export function applyBoard(p: Profile, g: BoardGraph = BOARD): BoardEffects {
  const stats: Partial<Record<StatKey, { add: number; mul: number }>> = {};
  const flags: Partial<Record<RunFlag, number>> = {};
  const slots = { relic: 0, weapon: 0, passive: 0 };
  let startLevel = 0;
  let startWeaponLevel = 0;
  const keystones: string[] = [];
  const ent = (k: StatKey) => (stats[k] ??= { add: 0, mul: 1 });
  for (const id of Object.keys(p.board.ranks).sort()) {
    const n = g.byId.get(id);
    if (!n || n.kind === "center") continue;
    const rank = Math.min(n.maxRank, p.board.ranks[id]);
    if (rank <= 0) continue;
    if (n.kind === "keystone") {
      if (!p.board.active.includes(id)) continue;
      keystones.push(id);
    }
    for (const e of n.effects) {
      switch (e.t) {
        case "stat":
          ent(e.stat).add += e.per * rank;
          break;
        case "statPct":
          ent(e.stat).mul *= 1 + e.per * rank;
          break;
        case "flag":
          flags[e.flag] = (flags[e.flag] ?? 0) + e.per * rank;
          break;
        case "slot":
          slots[e.slot] += e.per * rank;
          break;
        case "startLevel":
          startLevel += e.per * rank;
          break;
        case "startWeapon":
          startWeaponLevel = Math.max(startWeaponLevel, e.level);
          break;
      }
    }
  }
  const entries = Object.entries(stats) as [StatKey, { add: number; mul: number }][];
  const mod: StatMod | null = entries.length
    ? (s: Stats) => {
        for (const [k, v] of entries) {
          const cur = s[k];
          s[k] = (cur + v.add) * v.mul;
        }
      }
    : null;
  return { mod, stats, flags, slots, startLevel, startWeaponLevel, keystones };
}

// ---------------------------------------------------------------- text

const STAT_TEXT: Partial<Record<StatKey, { label: string; many?: string; fmt: "pct" | "flat" | "rate" }>> = {
  might: { label: "damage", fmt: "pct" },
  maxHp: { label: "max HP", fmt: "flat" },
  regen: { label: "HP/s regen", fmt: "rate" },
  armor: { label: "armor", fmt: "flat" },
  moveSpeed: { label: "move speed", fmt: "pct" },
  cooldown: { label: "cooldown", fmt: "pct" },
  area: { label: "area", fmt: "pct" },
  amount: { label: "projectile", many: "projectiles", fmt: "flat" },
  projSpeed: { label: "projectile speed", fmt: "pct" },
  duration: { label: "duration", fmt: "pct" },
  pickup: { label: "pickup range", fmt: "pct" },
  crit: { label: "crit chance", fmt: "pct" },
  critMult: { label: "crit damage", fmt: "pct" },
  luck: { label: "luck", fmt: "pct" },
  growth: { label: "XP", fmt: "pct" },
  greed: { label: "coins", fmt: "pct" },
  dashCd: { label: "dash cooldown", fmt: "pct" },
  knock: { label: "knockback", fmt: "pct" },
  rerolls: { label: "reroll per run", many: "rerolls per run", fmt: "flat" },
  cards: { label: "card choice", many: "card choices", fmt: "flat" },
  curse: { label: "curse (more enemies, more rewards)", fmt: "pct" },
  gemFind: { label: "gem find", fmt: "pct" },
  dmgReduction: { label: "damage taken", fmt: "pct" },
  healMul: { label: "healing", fmt: "pct" },
  shield: { label: "shield charge", many: "shield charges", fmt: "flat" },
  revives: { label: "revive", many: "revives", fmt: "flat" },
};

const plural = (v: number, one: string, many: string) => `${signed(v)} ${Math.abs(v) === 1 ? one : many}`;

const FLAG_TEXT: Partial<Record<RunFlag, (v: number) => string>> = {
  banish: (v) => plural(v, "banish per run", "banishes per run"),
  skip: (v) => plural(v, "level-up skip per run", "level-up skips per run"),
  dashCharges: (v) => plural(v, "dash charge", "dash charges"),
  ultStart: (v) => `start with ${pct(v).replace("+", "")} Overdrive`,
  chestLuck: (v) => `${pct(v)} chest luck`,
  eliteRate: (v) => `${pct(v)} elite frequency`,
  plotArmor: (v) => (v === 1 ? "survive one lethal hit per run" : `survive ${v} lethal hits per run`),
  friendship: (v) => `${pct(v)} damage per different weapon held`,
  revives: (v) => plural(v, "revive per run", "revives per run"),
  freeRerolls: () => "rerolls are free",
};

/** One effect as text at `rank` ("+8% damage", "-40% max HP", "+1 relic slot"). */
export function effectText(e: NodeEffect, rank: number): string {
  const r = Math.max(1, rank);
  switch (e.t) {
    case "stat": {
      const t = STAT_TEXT[e.stat];
      const v = e.per * r;
      if (!t) return `${signed(v)} ${e.stat}`;
      if (e.stat === "dmgReduction") return `${pct(-v, 1)} ${t.label}`;
      if (t.fmt === "pct") return `${pct(v, 1)} ${t.label}`;
      if (t.fmt === "rate") return `${signed(v)} ${t.label}`;
      return plural(v, t.label, t.many ?? t.label);
    }
    case "statPct":
      return `${pct(e.per * r)} ${STAT_TEXT[e.stat]?.label ?? e.stat}`;
    case "flag":
      return FLAG_TEXT[e.flag]?.(e.per * r) ?? `${e.flag} ${signed(e.per * r)}`;
    case "slot":
      return plural(e.per * r, `${e.slot} slot`, `${e.slot} slots`);
    case "startLevel":
      return `start ${e.per * r} levels higher`;
    case "startWeapon":
      return `chosen start weapon begins at Lv${e.level}`;
  }
}

/** Node description at a rank (0 shows rank 1, the preview). */
export function nodeText(node: BoardNode, rank: number): string {
  return node.effects.map((e) => effectText(e, Math.max(1, rank))).join(", ");
}

// ---------------------------------------------------------------- save v1 compat

/** Old Dream Shop ranks as seen through the board (legacy UI / World `meta` option). */
export function legacyShopRanks(p: Profile, g: BoardGraph = BOARD): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of OLD_SHOP) {
    const node = g.byId.get(LEGACY_SHOP_NODES[m.id]);
    const r = node ? Math.min(m.maxRank, nodeRank(p, node.id)) : 0;
    if (r > 0) out[m.id] = r;
  }
  return out;
}

/**
 * The old Dream Shop wrote `meta[id] = rank`: map it onto the matching board
 * node, recording the old price as spent (so a later respec refunds exactly
 * what was paid). The caller already took the coins.
 */
export function legacyShopSet(p: Profile, id: string, rank: number, g: BoardGraph = BOARD): boolean {
  const m = OLD_SHOP.find((x) => x.id === id);
  const node = m ? g.byId.get(LEGACY_SHOP_NODES[m.id]) : undefined;
  if (!m || !node) return false;
  const cur = nodeRank(p, node.id);
  const next = Math.max(0, Math.min(m.maxRank, node.maxRank, Number.isFinite(rank) ? Math.floor(rank) : 0));
  let paid = p.board.paid[node.id] ?? 0;
  for (let r = cur; r < next; r++) paid += oldShopCost(m.baseCost, r);
  for (let r = next; r < cur; r++) paid = Math.max(0, paid - oldShopCost(m.baseCost, r));
  if (next > 0) {
    p.board.ranks[node.id] = next;
    p.board.paid[node.id] = paid;
  } else {
    delete p.board.ranks[node.id];
    delete p.board.paid[node.id];
    p.board.active = p.board.active.filter((x) => x !== node.id);
  }
  return true;
}
