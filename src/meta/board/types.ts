/**
 * Training Arc board types (docs/EXPANSION.md §5).
 */
import type { RunFlag } from "../../game/run-config";
import type { Stats } from "../../game/stats";

export type StatKey = keyof Stats;
export type NodeKind = "center" | "stat" | "utility" | "keystone";
export type SlotKind = "relic" | "weapon" | "passive";

/** One effect of a node, scaled by the purchased rank. */
export type NodeEffect =
  /** stats[stat] += per x rank */
  | { t: "stat"; stat: StatKey; per: number }
  /** stats[stat] *= 1 + per x rank (e.g. -40% max HP) */
  | { t: "statPct"; stat: StatKey; per: number }
  /** RunConfig.flags[flag] += per x rank */
  | { t: "flag"; flag: RunFlag; per: number }
  /** +per build / relic slots per rank */
  | { t: "slot"; slot: SlotKind; per: number }
  /** the run starts `per` x rank levels higher */
  | { t: "startLevel"; per: number }
  /** the loadout's chosen start weapon begins at this level */
  | { t: "startWeapon"; level: number };

/** Authoring spec of one node (src/meta/board/data.ts). */
export interface NodeSpec {
  id: string;
  name: string;
  kind?: Exclude<NodeKind, "center">;
  /** Max rank (default 1). */
  max?: number;
  fx: NodeEffect[];
  /** Satire flavour for the detail card. */
  flavor?: string;
  /** Cost multiplier on top of the ring / kind cost. */
  costMul?: number;
}

export interface SectorSpec {
  id: string;
  name: string;
  /** Palette hint for the UI (CSS colour). */
  color: string;
  /** Node specs per ring 1..5 (index 0 = ring 1). */
  rings: NodeSpec[][];
}

export interface BoardNode {
  id: string;
  name: string;
  kind: NodeKind;
  /** 0 = centre, 1..5. */
  ring: number;
  /** 0..5 (-1 = centre). */
  sector: number;
  maxRank: number;
  effects: readonly NodeEffect[];
  flavor: string;
  /** Coins for rank 1..maxRank (index 0 = rank 1). */
  costs: readonly number[];
  /** Constellation layout (board units; centre at 0,0, y down). */
  x: number;
  y: number;
  /** Neighbour ids (undirected). */
  links: readonly string[];
  /** Default UI icon (atlas id). */
  icon: string;
}

export interface BoardGraph {
  nodes: readonly BoardNode[];
  byId: ReadonlyMap<string, BoardNode>;
  center: BoardNode;
  /** Undirected edges [a, b] (a < b), for drawing. */
  edges: readonly (readonly [string, string])[];
  sectors: readonly { id: string; name: string; color: string; angle: number }[];
  rings: number;
  /** Layout radius per ring (index = ring). */
  radius: readonly number[];
}
