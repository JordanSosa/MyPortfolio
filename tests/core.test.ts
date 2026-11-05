import { describe, expect, test } from "vitest";
import { clamp, damp, easeOutBack, lerp, springStep, wrapAngle, TAU, hash01 } from "../src/core/math";
import { Rng } from "../src/core/rng";
import { SpatialHash } from "../src/core/spatial";
import { EventBus } from "../src/core/events";
import { PooledList } from "../src/core/pool";
import { Particles, type EmitterDef } from "../src/fx/particles";
import type { Renderer } from "../src/render/renderer";

describe("math", () => {
  test("clamp / lerp", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(2, 4, 0.5)).toBe(3);
  });
  test("damp converges and is frame-rate independent", () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 10, 8, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = damp(b, 10, 8, 1 / 30);
    expect(a).toBeGreaterThan(9.9);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });
  test("easeOutBack hits its endpoints and overshoots", () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    let max = 0;
    for (let t = 0; t <= 1; t += 0.01) max = Math.max(max, easeOutBack(t));
    expect(max).toBeGreaterThan(1);
  });
  test("wrapAngle stays in (-PI, PI]", () => {
    for (const a of [0, 4, -4, 10 * TAU + 1, -7.5]) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThan(-Math.PI - 1e-9);
      expect(w).toBeLessThanOrEqual(Math.PI + 1e-9);
      expect(Math.cos(w)).toBeCloseTo(Math.cos(a), 9);
    }
  });
  test("springStep settles at the target", () => {
    const s = { x: 0.6, v: 0 };
    for (let i = 0; i < 240; i++) springStep(s, 1, 340, 14, 1 / 60);
    expect(s.x).toBeCloseTo(1, 3);
  });
  test("hash01 is deterministic and in [0, 1)", () => {
    expect(hash01(3, 4)).toBe(hash01(3, 4));
    for (let i = 0; i < 100; i++) {
      const h = hash01(i, -i * 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe("rng", () => {
  test("same seed -> same sequence", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  test("int stays in range, weightedIndex respects zero weights", () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      expect(r.weightedIndex([0, 3, 0])).toBe(1);
    }
  });
});

describe("spatial hash", () => {
  test("query matches brute force", () => {
    const r = new Rng(9);
    const g = new SpatialHash(32, 64);
    const pts = Array.from({ length: 300 }, () => ({ x: r.range(-300, 300), y: r.range(-300, 300), r: r.range(2, 12) }));
    pts.forEach((p, i) => g.insert(i, p.x, p.y, p.r));
    const out: number[] = [];
    for (let q = 0; q < 50; q++) {
      const x = r.range(-300, 300);
      const y = r.range(-300, 300);
      const rad = r.range(5, 80);
      const n = g.query(x, y, rad, out);
      const got = out.slice(0, n).sort((a, b) => a - b);
      const want = pts
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => Math.hypot(p.x - x, p.y - y) <= rad + p.r)
        .map(({ i }) => i);
      expect(got).toEqual(want);
    }
  });
});

describe("events + pools", () => {
  test("bus on/off/emit", () => {
    const bus = new EventBus<{ a: { n: number } }>();
    let sum = 0;
    const off = bus.on("a", (e) => (sum += e.n));
    bus.emit("a", { n: 2 });
    off();
    bus.emit("a", { n: 5 });
    expect(sum).toBe(2);
  });
  test("PooledList swap-remove reuses objects", () => {
    const l = new PooledList(() => ({ v: 0 }));
    const a = l.spawn();
    l.spawn();
    l.removeAt(0);
    expect(l.count).toBe(1);
    const c = l.spawn();
    expect(c).toBe(a);
  });
});

describe("particles", () => {
  test("setCapacity keeps live particles (a quality-tier change mid-fight doesn't wipe the screen)", () => {
    // headless: only the atlas lookup of the emitter's sprite is needed
    const r = { atlas: { info: () => ({ first: 0, count: 1, fps: 0 }) } } as unknown as Renderer;
    const ps = new Particles(r, 1500);
    const def: EmitterDef = { sprite: "fx_px", speed: [0, 0], life: [5, 5] };
    for (let i = 0; i < 500; i++) ps.emit(def, i, 1000 - i, 1);
    expect(ps.count).toBe(500);
    const at = { x: 0, y: 0 };
    ps.setCapacity(3000);
    expect(ps.capacity).toBe(3000);
    expect(ps.count).toBe(500);
    for (const i of [0, 1, 250, 499]) {
      ps.position(i, at);
      expect(at.x).toBe(i);
      expect(at.y).toBe(1000 - i);
    }
    ps.update(0.1);
    expect(ps.count).toBe(500); // still alive (5 s life), ages copied too
    ps.setCapacity(200);
    expect(ps.count).toBe(200);
    ps.position(199, at);
    expect(at.x).toBe(199);
    // and it keeps emitting into the smaller pool
    ps.emit(def, 7, 7, 10);
    expect(ps.count).toBe(200);
  });
});

describe("storage text helpers", () => {
  test("loadText / saveText never throw and report failures", async () => {
    const { loadText, saveText } = await import("../src/core/storage");
    const g = globalThis as { localStorage?: unknown };
    const map = new Map<string, string>();
    let full = false;
    g.localStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (full) throw new Error("QuotaExceededError");
        map.set(k, v);
      },
      removeItem: (k: string) => map.delete(k),
    };
    try {
      expect(saveText("a", "1")).toBe(true);
      expect(loadText("a")).toBe("1");
      full = true;
      expect(saveText("a", "2")).toBe(false);
      expect(loadText("a")).toBe("1");
      delete g.localStorage;
      expect(saveText("a", "3")).toBe(false);
      expect(loadText("a")).toBeNull();
    } finally {
      delete g.localStorage;
    }
  });
});
