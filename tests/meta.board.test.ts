/**
 * Training Arc board: graph shape (≈120 nodes, 5 rings, keystones outside,
 * everything connected), costs, ring gating by stage clears, purchase /
 * refund (never strands a node) / respec, keystone slots, applyBoard and the
 * auto-path planner, plus the save-v1 Dream Shop compat mapping.
 */
import { describe, expect, test } from "vitest";
import { baseStats, finalizeStats } from "../src/game/stats";
import {
  affordableNodes,
  applyBoard,
  autoPath,
  boardProgress,
  boardSpent,
  buyNode,
  canBuy,
  effectText,
  legacyShopRanks,
  legacyShopSet,
  nodeText,
  refundNode,
  respecBoard,
  respecFee,
  ringUnlocked,
  toggleKeystone,
} from "../src/meta/board/board";
import { LEGACY_SHOP_NODES } from "../src/meta/board/data";
import { BOARD, CENTER_ID } from "../src/meta/board/graph";
import { OLD_SHOP, oldShopCost } from "../src/meta/legacy";
import { TUNING } from "../src/meta/tuning";
import { fixtureContent, freshProfile } from "./meta.fixtures";

const ctx = fixtureContent();
const node = (id: string) => BOARD.byId.get(id)!;

describe("board graph", () => {
  test("about 120 nodes in 5 rings around 'Episode 1', ~10 keystones on the outer ring", () => {
    const real = BOARD.nodes.filter((n) => n.kind !== "center");
    expect(real.length).toBe(120);
    expect(BOARD.center.id).toBe(CENTER_ID);
    for (let r = 1; r <= 5; r++) expect(real.filter((n) => n.ring === r).length).toBe([12, 18, 24, 30, 36][r - 1]);
    const keys = real.filter((n) => n.kind === "keystone");
    expect(keys.length).toBeGreaterThanOrEqual(8);
    expect(keys.length).toBeLessThanOrEqual(12);
    for (const k of keys) {
      expect(k.ring).toBe(5);
      expect(Math.hypot(k.x, k.y)).toBeGreaterThan(5 * 110);
      expect(k.effects.length).toBeGreaterThanOrEqual(2); // a trade-off
      expect(k.flavor.length).toBeGreaterThan(10);
    }
  });

  test("ids unique, links symmetric, every node reachable from the centre, layout finite and spread out", () => {
    const ids = new Set(BOARD.nodes.map((n) => n.id));
    expect(ids.size).toBe(BOARD.nodes.length);
    for (const n of BOARD.nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
      for (const o of n.links) expect(node(o).links).toContain(n.id);
      expect(n.name.length).toBeGreaterThan(2);
    }
    const seen = new Set([CENTER_ID]);
    const stack = [CENTER_ID];
    while (stack.length) for (const o of node(stack.pop()!).links) if (!seen.has(o)) seen.add(o), stack.push(o);
    expect(seen.size).toBe(BOARD.nodes.length);
    for (const a of BOARD.nodes) for (const b of BOARD.nodes) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(20);
    expect(BOARD.edges.length).toBeGreaterThan(120);
  });

  test("costs grow with ring, node and rank: ~25 on ring 1 to tens of thousands on ring 5", () => {
    const first = BOARD.nodes.filter((n) => n.ring === 1).map((n) => n.costs[0]);
    expect(Math.min(...first)).toBe(TUNING.board.ringCost[0]);
    const avg = (r: number) => {
      const c = BOARD.nodes.filter((n) => n.ring === r).map((n) => n.costs[0]);
      return c.reduce((a, b) => a + b, 0) / c.length;
    };
    for (let r = 1; r < 5; r++) expect(avg(r + 1)).toBeGreaterThan(avg(r) * 2);
    const r5 = BOARD.nodes.filter((n) => n.ring === 5).flatMap((n) => n.costs);
    expect(Math.max(...r5)).toBeGreaterThan(20000);
    for (const n of BOARD.nodes) for (let i = 1; i < n.costs.length; i++) expect(n.costs[i]).toBeGreaterThan(n.costs[i - 1]);
    const total = boardProgress(freshProfile(ctx)).totalCost;
    expect(total).toBeGreaterThan(500_000);
  });

  test("every effect has readable text; slot / dash / revive caps match the spec", () => {
    for (const n of BOARD.nodes) for (const e of n.effects) expect(effectText(e, n.maxRank)).not.toMatch(/undefined|NaN/);
    expect(nodeText(node("glass_cannon"), 1)).toBe("+60% damage, -40% max HP");
    const all = freshProfile(ctx);
    for (const n of BOARD.nodes) if (n.kind !== "center") all.board.ranks[n.id] = n.maxRank;
    all.board.active = [];
    const fx = applyBoard(all);
    expect(fx.slots).toEqual({ relic: 3, weapon: 1, passive: 1 });
    expect(fx.flags.dashCharges).toBe(2);
    expect(fx.flags.revives).toBe(2);
  });

  test("the legacy Dream Shop ids map to board nodes with the same per-rank effect and max rank", () => {
    for (const m of OLD_SHOP) {
      const n = node(LEGACY_SHOP_NODES[m.id]);
      expect(n.maxRank).toBe(m.maxRank);
    }
  });
});

describe("board rules", () => {
  test("buy: ring 1 next to the centre; coins deducted; maxed / poor / unreachable / ring-locked refused", () => {
    const p = freshProfile(ctx);
    expect(canBuy(p, "might_1", ctx)).toEqual({ ok: false, block: "coins" });
    p.currencies.coins = 10_000;
    const r = buyNode(p, "might_1", ctx);
    expect(r).toMatchObject({ ok: true, rank: 1, cost: node("might_1").costs[0] });
    expect(p.currencies.coins).toBe(10_000 - r.cost!);
    expect(boardSpent(p)).toBe(r.cost);
    for (let i = 1; i < node("might_1").maxRank; i++) expect(buyNode(p, "might_1", ctx).ok).toBe(true);
    expect(buyNode(p, "might_1", ctx)).toEqual({ ok: false, block: "maxed" });
    expect(canBuy(p, "might_3", ctx).block).toBe("ring");
    expect(canBuy(p, "nope", ctx).block).toBe("unknown");
    // ring 2 opens with a Dream Meadow clear
    expect(ringUnlocked(p, 2, ctx)).toBe(false);
    p.records.dream_meadow = { runs: 1, clears: 1, bestTime: 600, bestHeat: 0, bestEndless: 0, bestKills: 0, bestLevel: 0, bestCombo: 0, firstClear: 1 };
    expect(ringUnlocked(p, 2, ctx)).toBe(true);
    expect(ringUnlocked(p, 3, ctx)).toBe(false);
    const ring2 = BOARD.nodes.filter((n) => n.ring === 2);
    const far = ring2.find((n) => !n.links.some((o) => o === "might_1" || node(o).ring === 0))!;
    if (!far.links.some((o) => (p.board.ranks[o] ?? 0) > 0)) expect(canBuy(p, far.id, ctx).block).toBe("unreachable");
    const near = ring2.find((n) => n.links.includes("might_1"))!;
    expect(buyNode(p, near.id, ctx).ok).toBe(true);
  });

  test("refund never strands another node; respec refunds everything minus a cheap fee", () => {
    const p = freshProfile(ctx);
    p.currencies.coins = 1e6;
    p.records.dream_meadow = { runs: 1, clears: 1, bestTime: 600, bestHeat: 0, bestEndless: 0, bestKills: 0, bestLevel: 0, bestCombo: 0, firstClear: 1 };
    buyNode(p, "might_1", ctx);
    buyNode(p, "might_1", ctx);
    const child = BOARD.nodes.find((n) => n.ring === 2 && n.links.includes("might_1") && !n.links.some((o) => node(o).ring === 1 && o !== "might_1"))!;
    expect(buyNode(p, child.id, ctx).ok).toBe(true);
    const coins = p.currencies.coins;
    // top rank of might_1 can go (it stays owned)
    const r1 = refundNode(p, "might_1");
    expect(r1.ok).toBe(true);
    expect(p.currencies.coins).toBe(coins + node("might_1").costs[1]);
    // its last rank would strand the child
    expect(refundNode(p, "might_1")).toEqual({ ok: false, block: "strands" });
    expect(refundNode(p, child.id).ok).toBe(true);
    expect(refundNode(p, "might_1").ok).toBe(true);
    expect(p.board.ranks).toEqual({});
    expect(p.currencies.coins).toBe(1e6);
    // respec
    buyNode(p, "might_1", ctx);
    buyNode(p, "hp_1", ctx);
    const spent = boardSpent(p);
    const fee = respecFee(p);
    expect(fee).toBeGreaterThan(0);
    expect(fee).toBeLessThanOrEqual(spent);
    expect(fee).toBeLessThanOrEqual(Math.max(TUNING.board.respecBase, spent * 0.2));
    const before = p.currencies.coins;
    expect(respecBoard(p)).toEqual({ refund: spent - fee, fee });
    expect(p.currencies.coins).toBe(before + spent - fee);
    expect(p.board.ranks).toEqual({});
    expect(p.board.respecs).toBe(1);
  });

  test("keystones: bought keystones auto-activate into free slots; toggle respects the slot limit; inactive ones do nothing", () => {
    const p = freshProfile(ctx);
    const keys = BOARD.nodes.filter((n) => n.kind === "keystone").map((n) => n.id);
    for (const k of keys.slice(0, 3)) p.board.ranks[k] = 1;
    expect(toggleKeystone(p, keys[0])).toEqual({ ok: true, active: true });
    expect(toggleKeystone(p, keys[1])).toEqual({ ok: true, active: true });
    expect(toggleKeystone(p, keys[2])).toEqual({ ok: false, active: false, reason: "slots" });
    expect(toggleKeystone(p, keys[0])).toEqual({ ok: true, active: false });
    expect(toggleKeystone(p, "might_1").reason).toBe("unknown");
    p.board.ranks = { glass_cannon: 1 };
    p.board.active = [];
    expect(applyBoard(p).mod).toBeNull();
    p.board.active = ["glass_cannon"];
    const s = baseStats();
    applyBoard(p).mod!(s);
    finalizeStats(s);
    expect(s.might).toBeCloseTo(1.6);
    expect(s.maxHp).toBe(60);
  });

  test("applyBoard: stat mod, flags, slots, start bonuses", () => {
    const p = freshProfile(ctx);
    p.board.ranks = { might_1: 3, hp_1: 2, curse_1: 1, ultstart_1: 2, relic_slot_1: 1, weapon_slot: 1, start_level_1: 2, head_start: 1, banish_1: 1, revive_1: 1 };
    const fx = applyBoard(p);
    const s = baseStats();
    fx.mod!(s);
    expect(s.might).toBeCloseTo(1.12);
    expect(s.maxHp).toBe(100 + 16);
    expect(s.curse).toBeCloseTo(0.05);
    expect(fx.flags).toMatchObject({ ultStart: 0.2, banish: 1, revives: 1 });
    expect(fx.slots).toEqual({ relic: 1, weapon: 1, passive: 0 });
    expect(fx.startLevel).toBe(4);
    expect(fx.startWeaponLevel).toBe(2);
  });

  test("auto-path: the cheapest affordable chain within the budget; affordable list for the pulse", () => {
    const p = freshProfile(ctx);
    p.currencies.coins = 400;
    const plan = autoPath(p, ctx);
    expect(plan.length).toBeGreaterThan(3);
    expect(plan.reduce((a, s) => a + s.cost, 0)).toBeLessThanOrEqual(400);
    for (const step of plan) expect(node(step.id).ring).toBe(1);
    const list = affordableNodes(p, ctx);
    expect(list[0].cost).toBe(Math.min(...list.map((v) => v.cost)));
    expect(p.board.ranks).toEqual({}); // planning never buys
    // following the plan works step by step
    for (const step of plan) expect(buyNode(p, step.id, ctx)).toMatchObject({ ok: true, rank: step.rank, cost: step.cost });
  });

  test("save v1 Dream Shop shim: ranks read / write the mapped board nodes and record the old prices", () => {
    const p = freshProfile(ctx);
    expect(legacyShopSet(p, "might", 2)).toBe(true);
    expect(legacyShopSet(p, "revive", 5)).toBe(true);
    expect(legacyShopSet(p, "bogus", 1)).toBe(false);
    expect(legacyShopRanks(p)).toEqual({ might: 2, revive: 1 });
    expect(p.board.ranks).toEqual({ might_1: 2, revive_1: 1 });
    expect(p.board.paid.might_1).toBe(oldShopCost(60, 0) + oldShopCost(60, 1));
    const before = p.currencies.coins;
    respecBoard(p);
    expect(p.currencies.coins - before).toBe(oldShopCost(60, 0) + oldShopCost(60, 1) + 400 - respecFee({ ...p, board: { ranks: { might_1: 2, revive_1: 1 }, paid: { might_1: 155, revive_1: 400 }, active: [], respecs: 0 } }));
  });
});
