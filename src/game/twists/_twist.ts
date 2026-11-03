/**
 * Plot Twist helpers (no `twists` export: the registry ignores this file).
 */
const ROMAN = ["", "I", "II", "III", "IV", "V"];

/** Card title with the rank numeral for multi-rank twists: "Budget Cuts II". */
export function ranked(name: string, rank: number, maxRank: number): string {
  return maxRank > 1 ? `${name} ${ROMAN[rank] ?? rank}` : name;
}
