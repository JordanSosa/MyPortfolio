/**
 * Uniform spatial hash grid for circles. Rebuilt every (sub)step:
 *
 *   grid.clear();
 *   for (let i = 0; i < enemies.count; i++) grid.insert(i, e.x, e.y, e.r);
 *   const n = grid.query(x, y, r, out);      // out[0..n) = ids overlapping the circle
 *
 * - ids are caller-chosen non-negative integers (e.g. the index in your entity
 *   array). Inserting the same id twice in one build keeps the first insert.
 * - Objects larger than a cell are inserted into every cell they overlap, so
 *   queries are exact circle-vs-circle tests.
 * - Unbounded world: cells are hashed into a fixed bucket table.
 * - Zero allocations per insert/query after warm-up (arrays grow by doubling).
 */
export class SpatialHash {
  readonly cellSize: number;
  private readonly inv: number;
  private readonly mask: number;
  private readonly nBuckets: number;

  // per-item data (slot = insertion order)
  private ix: Float32Array;
  private iy: Float32Array;
  private ir: Float32Array;
  private iid: Int32Array;
  private itemCount = 0;

  // (bucket, slot) entries
  private eBucket: Int32Array;
  private eItem: Int32Array;
  private entryCount = 0;

  // counting sort output
  private readonly start: Int32Array;
  private readonly cursor: Int32Array;
  private sorted: Int32Array;
  private built = false;

  // id bookkeeping
  private idGen: Uint32Array;
  private idSlot: Int32Array;
  private gen = 1;
  private stamp: Uint32Array;
  private queryStamp = 1;

  constructor(cellSize = 32, capacity = 1024, buckets = 4096) {
    this.cellSize = cellSize;
    this.inv = 1 / cellSize;
    let b = 1;
    while (b < buckets) b <<= 1;
    this.nBuckets = b;
    this.mask = b - 1;
    this.ix = new Float32Array(capacity);
    this.iy = new Float32Array(capacity);
    this.ir = new Float32Array(capacity);
    this.iid = new Int32Array(capacity);
    this.eBucket = new Int32Array(capacity * 2);
    this.eItem = new Int32Array(capacity * 2);
    this.sorted = new Int32Array(capacity * 2);
    this.start = new Int32Array(b + 1);
    this.cursor = new Int32Array(b);
    this.idGen = new Uint32Array(capacity);
    this.idSlot = new Int32Array(capacity);
    this.stamp = new Uint32Array(capacity);
  }

  /** Number of items inserted since the last clear(). */
  get size(): number {
    return this.itemCount;
  }

  clear(): void {
    this.itemCount = 0;
    this.entryCount = 0;
    this.built = false;
    this.gen++;
    if (this.gen === 0xffffffff) {
      this.idGen.fill(0);
      this.gen = 1;
    }
  }

  private hash(cx: number, cy: number): number {
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & this.mask;
  }

  private growItems(): void {
    const n = this.ix.length * 2;
    const gf = (a: Float32Array) => {
      const b = new Float32Array(n);
      b.set(a);
      return b;
    };
    this.ix = gf(this.ix);
    this.iy = gf(this.iy);
    this.ir = gf(this.ir);
    const id = new Int32Array(n);
    id.set(this.iid);
    this.iid = id;
  }

  private growEntries(): void {
    const n = this.eBucket.length * 2;
    const a = new Int32Array(n);
    a.set(this.eBucket);
    this.eBucket = a;
    const b = new Int32Array(n);
    b.set(this.eItem);
    this.eItem = b;
    this.sorted = new Int32Array(n);
  }

  private growIds(id: number): void {
    let n = this.idGen.length;
    while (n <= id) n *= 2;
    const g = new Uint32Array(n);
    g.set(this.idGen);
    this.idGen = g;
    const s = new Int32Array(n);
    s.set(this.idSlot);
    this.idSlot = s;
    const st = new Uint32Array(n);
    st.set(this.stamp);
    this.stamp = st;
  }

  /** Insert a circle (x, y, r) under `id`. */
  insert(id: number, x: number, y: number, r = 0): void {
    if (id >= this.idGen.length) this.growIds(id);
    if (this.idGen[id] === this.gen) return;
    if (this.itemCount >= this.ix.length) this.growItems();
    const slot = this.itemCount++;
    this.idGen[id] = this.gen;
    this.idSlot[id] = slot;
    this.ix[slot] = x;
    this.iy[slot] = y;
    this.ir[slot] = r;
    this.iid[slot] = id;
    const inv = this.inv;
    const cx0 = Math.floor((x - r) * inv);
    const cx1 = Math.floor((x + r) * inv);
    const cy0 = Math.floor((y - r) * inv);
    const cy1 = Math.floor((y + r) * inv);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        if (this.entryCount >= this.eBucket.length) this.growEntries();
        this.eBucket[this.entryCount] = this.hash(cx, cy);
        this.eItem[this.entryCount] = slot;
        this.entryCount++;
      }
    this.built = false;
  }

  /** Finalise after inserts (counting sort into buckets). Called lazily by query(). */
  build(): void {
    const start = this.start;
    const cursor = this.cursor;
    const nb = this.nBuckets;
    const n = this.entryCount;
    const eb = this.eBucket;
    const ei = this.eItem;
    start.fill(0);
    for (let i = 0; i < n; i++) start[eb[i] + 1]++;
    for (let b = 0; b < nb; b++) start[b + 1] += start[b];
    cursor.set(start.subarray(0, nb));
    const sorted = this.sorted;
    for (let i = 0; i < n; i++) sorted[cursor[eb[i]]++] = ei[i];
    this.built = true;
  }

  /**
   * Ids of circles overlapping circle (x, y, r) are written to out[0..n); returns n.
   * `out` is reusable: a number[] (grows as needed) or an Int32Array (truncated at its length).
   */
  query(x: number, y: number, r: number, out: number[] | Int32Array): number {
    if (!this.built) this.build();
    const inv = this.inv;
    const cx0 = Math.floor((x - r) * inv);
    const cx1 = Math.floor((x + r) * inv);
    const cy0 = Math.floor((y - r) * inv);
    const cy1 = Math.floor((y + r) * inv);
    let qs = ++this.queryStamp;
    if (qs === 0xffffffff) {
      this.stamp.fill(0);
      qs = this.queryStamp = 1;
    }
    const stamp = this.stamp;
    const start = this.start;
    const sorted = this.sorted;
    const ix = this.ix;
    const iy = this.iy;
    const ir = this.ir;
    const iid = this.iid;
    const cap = Array.isArray(out) ? Infinity : out.length;
    let n = 0;
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const b = this.hash(cx, cy);
        for (let k = start[b], e = start[b + 1]; k < e; k++) {
          const s = sorted[k];
          const id = iid[s];
          if (stamp[id] === qs) continue;
          stamp[id] = qs;
          const dx = ix[s] - x;
          const dy = iy[s] - y;
          const rr = ir[s] + r;
          if (dx * dx + dy * dy > rr * rr) continue;
          if (n < cap) out[n++] = id;
        }
      }
    return n;
  }

  /**
   * Nearest inserted id whose centre is within maxR of (x, y) and for which
   * `accept(id)` returns true. Returns -1 if none. (Pass a stable `accept`
   * function, not a fresh closure, in hot loops.)
   */
  nearest(x: number, y: number, maxR: number, accept?: (id: number) => boolean): number {
    const n = this.query(x, y, maxR, scratch);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const id = scratch[i];
      if (accept && !accept(id)) continue;
      const s = this.idSlot[id];
      const dx = this.ix[s] - x;
      const dy = this.iy[s] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  /** True if `id` was inserted since the last clear(). */
  has(id: number): boolean {
    return id < this.idGen.length && this.idGen[id] === this.gen;
  }
}

const scratch: number[] = [];
