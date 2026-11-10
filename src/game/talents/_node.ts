/**
 * Talent tree helpers (no `talentTrees` export: the registry ignores this file).
 */
import type { TalentNode } from "../defs";
import type { Stats } from "../stats";
import type { World } from "../world";

/** Compact TalentNode constructor: id, name, branch 0..2, tier 1..5, max rank, effect text at a rank. */
export function node(
  id: string,
  name: string,
  branch: number,
  tier: number,
  maxRank: number,
  desc: (rank: number) => string,
  fx: { mods?: (s: Stats, rank: number) => void; install?: (w: World, rank: number) => void; icon?: string; requires?: string[] } = {},
): TalentNode {
  return { id, name, branch, tier, maxRank, desc, ...fx };
}

/** Value for a rank from a per-rank table (rank 1 = index 0, clamped). */
export function byRank(table: readonly number[], rank: number): number {
  return table[Math.max(0, Math.min(table.length - 1, rank - 1))];
}

/**
 * A per-second budget for effects that could otherwise chain-explode a crit
 * storm (at most `max` triggers per second of run time).
 */
export class Budget {
  private at = -1;
  private left = 0;
  constructor(private readonly max: number) {}
  take(w: World): boolean {
    if (w.t - this.at >= 1) {
      this.at = w.t;
      this.left = this.max;
    }
    if (this.left <= 0) return false;
    this.left--;
    return true;
  }
}
