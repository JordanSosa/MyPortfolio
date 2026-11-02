/**
 * Object pooling.
 *
 *  Pool<T>        free-list of reusable objects.
 *  PooledList<T>  dense array of live objects backed by a pool, with O(1)
 *                 swap-remove. Iterate `for (let i = 0; i < list.count; i++) list.items[i]`
 *                 and remove with `list.removeAt(i--)` (or iterate backwards).
 */
export class Pool<T> {
  private free: T[] = [];
  /** Total objects ever created by this pool. */
  created = 0;

  constructor(
    private readonly create: () => T,
    private readonly reset?: (obj: T) => void,
    prewarm = 0,
  ) {
    for (let i = 0; i < prewarm; i++) {
      this.free.push(create());
      this.created++;
    }
  }

  get(): T {
    const o = this.free.pop();
    if (o !== undefined) return o;
    this.created++;
    return this.create();
  }

  release(obj: T): void {
    this.reset?.(obj);
    this.free.push(obj);
  }

  get available(): number {
    return this.free.length;
  }
}

export class PooledList<T> {
  readonly items: T[] = [];
  count = 0;
  private pool: Pool<T>;

  constructor(create: () => T, reset?: (obj: T) => void, prewarm = 0) {
    this.pool = new Pool(create, reset, prewarm);
  }

  /** Take an object from the pool and append it to the live list. Initialise its fields yourself. */
  spawn(): T {
    const o = this.pool.get();
    if (this.count < this.items.length) this.items[this.count] = o;
    else this.items.push(o);
    this.count++;
    return o;
  }

  /** Swap-remove the item at index i (order is not preserved). */
  removeAt(i: number): void {
    const last = this.count - 1;
    const o = this.items[i];
    this.items[i] = this.items[last];
    this.items[last] = o;
    this.count--;
    this.pool.release(o);
  }

  /** Remove a specific object (O(n) search). */
  remove(obj: T): boolean {
    for (let i = 0; i < this.count; i++)
      if (this.items[i] === obj) {
        this.removeAt(i);
        return true;
      }
    return false;
  }

  /** Remove every item matching `pred` (single pass, swap-remove). */
  removeWhere(pred: (o: T) => boolean): void {
    for (let i = this.count - 1; i >= 0; i--) if (pred(this.items[i])) this.removeAt(i);
  }

  clear(): void {
    while (this.count > 0) this.removeAt(this.count - 1);
  }
}
