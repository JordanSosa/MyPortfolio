/**
 * Seeded, fast PRNG (sfc32 core, seeded through splitmix32). Deterministic
 * across platforms, so `?seed=N` reproduces a run. Not cryptographic.
 */

function splitmix32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

/** Hash a string to a 32-bit seed. */
export function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;
  /** The seed this generator was (re)seeded with. */
  seed = 0;

  constructor(seed: number | string = (Math.random() * 0xffffffff) >>> 0) {
    this.reseed(seed);
  }

  reseed(seed: number | string): void {
    const s = typeof seed === "string" ? seedFromString(seed) : seed >>> 0;
    this.seed = s;
    const sm = splitmix32(s);
    this.a = sm();
    this.b = sm();
    this.c = sm();
    this.d = sm();
    for (let i = 0; i < 12; i++) this.u32();
  }

  /** Raw 32-bit unsigned integer. */
  u32(): number {
    let { a, b, c, d } = this;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    return t >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.u32() / 4294967296;
  }
  /** Float in [0, 1) - alias of next(). */
  float(): number {
    return this.u32() / 4294967296;
  }
  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * (this.u32() / 4294967296);
  }
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor((this.u32() / 4294967296) * (max - min + 1));
  }
  /** True with probability p. */
  chance(p: number): boolean {
    return this.u32() / 4294967296 < p;
  }
  /** -1 or 1. */
  sign(): number {
    return this.u32() & 1 ? 1 : -1;
  }
  /** Random angle in [0, 2PI). */
  angle(): number {
    return (this.u32() / 4294967296) * Math.PI * 2;
  }
  /** Symmetric spread: value in [-amount, amount). */
  spread(amount: number): number {
    return ((this.u32() / 4294967296) * 2 - 1) * amount;
  }
  /** Uniform pick from an array (undefined for empty arrays). */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor((this.u32() / 4294967296) * arr.length)];
  }
  /** Index chosen proportionally to weights (weights >= 0). Returns -1 if all zero. */
  weightedIndex(weights: ArrayLike<number>): number {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i]);
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
  /** Weighted pick: items[i] with weight weights[i], or items with a `weight` field via `weightOf`. */
  weighted<T>(items: readonly T[], weights: ArrayLike<number> | ((item: T) => number)): T {
    if (typeof weights === "function") {
      let total = 0;
      for (const it of items) total += Math.max(0, weights(it));
      let r = this.next() * total;
      for (const it of items) {
        r -= Math.max(0, weights(it));
        if (r < 0) return it;
      }
      return items[items.length - 1];
    }
    const i = this.weightedIndex(weights);
    return items[i < 0 ? 0 : i];
  }
  /** Approximately gaussian (Irwin-Hall, 4 samples): mean 0, sd ~1, bounded at about +-3.46. */
  gauss(mean = 0, sd = 1): number {
    const s = this.next() + this.next() + this.next() + this.next() - 2;
    return mean + s * 1.7320508 * sd;
  }
  /** In-place Fisher-Yates shuffle. Returns the array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
  /** Independent child generator (deterministic given this one's state). */
  fork(): Rng {
    return new Rng(this.u32());
  }
  /** Snapshot / restore the generator state. */
  getState(): [number, number, number, number] {
    return [this.a, this.b, this.c, this.d];
  }
  setState(s: readonly [number, number, number, number]): void {
    [this.a, this.b, this.c, this.d] = s;
  }
}

/** Seed from `?seed=` if present, else random. */
export function urlSeed(): number {
  try {
    const s = new URLSearchParams(globalThis.location?.search ?? "").get("seed");
    if (s) return /^\d+$/.test(s) ? Number(s) >>> 0 : seedFromString(s);
  } catch {
    /* no location (node) */
  }
  return (Math.random() * 0xffffffff) >>> 0;
}

/** Shared generator for cosmetic randomness (FX). Gameplay should own its own seeded Rng. */
export const fxRng = new Rng((Math.random() * 0xffffffff) >>> 0);
