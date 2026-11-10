/**
 * Strongly typed event bus.
 *
 *   type GameEvents = { enemyKilled: { x: number; y: number }; levelUp: { level: number } };
 *   const bus = new EventBus<GameEvents>();
 *   const off = bus.on("enemyKilled", (e) => burst(e.x, e.y));
 *   bus.emit("enemyKilled", { x, y });
 *   off();
 *
 * emit() does not allocate (listener arrays are copy-on-write, so on/off during
 * an emit is safe). Reuse payload objects in hot paths if you want zero garbage.
 */
export type Listener<T> = (payload: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventBus<M extends { [K in keyof M]: unknown }> {
  private map = new Map<keyof M, Listener<never>[]>();

  on<K extends keyof M>(type: K, fn: Listener<M[K]>): () => void {
    const cur = (this.map.get(type) ?? []) as Listener<M[K]>[];
    this.map.set(type, [...cur, fn] as Listener<never>[]);
    return () => this.off(type, fn);
  }

  once<K extends keyof M>(type: K, fn: Listener<M[K]>): () => void {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof M>(type: K, fn: Listener<M[K]>): void {
    const cur = this.map.get(type) as Listener<M[K]>[] | undefined;
    if (!cur) return;
    const i = cur.indexOf(fn);
    if (i < 0) return;
    const next = cur.slice();
    next.splice(i, 1);
    if (next.length) this.map.set(type, next as Listener<never>[]);
    else this.map.delete(type);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const ls = this.map.get(type) as Listener<M[K]>[] | undefined;
    if (!ls) return;
    for (let i = 0; i < ls.length; i++) ls[i](payload);
  }

  has<K extends keyof M>(type: K): boolean {
    return this.map.has(type);
  }

  /** Remove all listeners (of one type, or everything). */
  clear(type?: keyof M): void {
    if (type === undefined) this.map.clear();
    else this.map.delete(type);
  }
}
