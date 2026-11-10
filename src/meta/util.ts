/**
 * Small pure helpers shared by the meta layer: field sanitisers (every value
 * loaded from a save goes through one of these, so a corrupt field is repaired
 * on its own and never blocks boot), id checks, hashing and a random-source
 * interface for injectable RNG.
 */

/** Any `[0, 1)` random source (a `core/rng` Rng, Math.random wrapper, test stub). */
export interface RandomSource {
  next(): number;
}

/** Math.random as a RandomSource (live game; tests inject a seeded `Rng`). */
export const mathRandom: RandomSource = { next: () => Math.random() };

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype", "hasOwnProperty", "toString", "valueOf"]);

/** A content id or record key we accept from a save (no prototype keys, bounded length). */
export function isId(k: unknown): k is string {
  return typeof k === "string" && ID_RE.test(k) && !BAD_KEYS.has(k);
}

/** Finite number clamped to [lo, hi]; anything else -> `def`. */
export function num(v: unknown, def: number, lo = -Number.MAX_VALUE, hi = Number.MAX_VALUE): number {
  return typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : def;
}

/** Finite number floored and clamped to [lo, hi]; anything else -> `def`. */
export function int(v: unknown, def: number, lo = 0, hi = Number.MAX_SAFE_INTEGER): number {
  return typeof v === "number" && Number.isFinite(v) ? clamp(Math.floor(v), lo, hi) : def;
}

export function bool(v: unknown, def: boolean): boolean {
  return typeof v === "boolean" ? v : def;
}

export function str(v: unknown, def: string, max = 64): string {
  return typeof v === "string" && v.length <= max ? v : def;
}

export function oneOf<T extends string>(v: unknown, list: readonly T[], def: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : def;
}

/** Unique valid ids in their original order, at most `max`. */
export function idList(v: unknown, max = 2000): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (out.length >= max) break;
    if (isId(x) && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

/** A record of `id -> T` where `fn` validates each value (undefined drops the entry). */
export function record<T>(v: unknown, fn: (value: unknown, key: string) => T | undefined, maxKeys = 4000): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const k of Object.keys(v)) {
    if (n >= maxKeys) break;
    if (!isId(k)) continue;
    const val = fn(v[k], k);
    if (val === undefined) continue;
    out[k] = val;
    n++;
  }
  return out;
}

/** `id -> integer` in [lo, hi]; zero entries are dropped when `dropZero`. */
export function intRecord(v: unknown, lo = 0, hi = Number.MAX_SAFE_INTEGER, dropZero = true, maxKeys = 4000): Record<string, number> {
  return record(
    v,
    (x) => {
      if (typeof x !== "number" || !Number.isFinite(x)) return undefined;
      const n = clamp(Math.floor(x), lo, hi);
      return dropZero && n === 0 ? undefined : n;
    },
    maxKeys,
  );
}

/** `id -> finite number` in [lo, hi] (fractional values kept). */
export function numRecord(v: unknown, lo = 0, hi = Number.MAX_VALUE, maxKeys = 4000): Record<string, number> {
  return record(v, (x) => (typeof x === "number" && Number.isFinite(x) ? clamp(x, lo, hi) : undefined), maxKeys);
}

/** Add `n` to `rec[key]` (creating it). */
export function bump(rec: Record<string, number>, key: string, n = 1): void {
  rec[key] = (rec[key] ?? 0) + n;
}

/** Push `id` into `list` if missing. Returns true if it was added. */
export function addId(list: string[], id: string): boolean {
  if (list.includes(id)) return false;
  list.push(id);
  return true;
}

/** Sum of a record's values. */
export function sumValues(rec: Readonly<Record<string, number>>): number {
  let s = 0;
  for (const k in rec) s += rec[k];
  return s;
}

/** FNV-1a 32-bit hash of a string (deterministic picks, layout jitter). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic float in [0, 1) from a string key. */
export function hash01(s: string): number {
  return hash32(s) / 4294967296;
}

/** Deep copy of plain JSON data. */
export function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** "+12%" / "-5%" from a fraction. */
export function pct(v: number, digits = 0): string {
  const p = v * 100;
  const s = digits > 0 ? p.toFixed(digits).replace(/\.?0+$/, "") : String(Math.round(p));
  return `${v >= 0 ? "+" : ""}${s}%`;
}

/** "+3" / "-1" from a number. */
export function signed(v: number): string {
  const r = Math.round(v * 100) / 100;
  return `${r >= 0 ? "+" : ""}${r}`;
}
