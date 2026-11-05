// The hero focus zone (docs/ENGINE.md "Hero focus zone"): the player's fx (Flag.Focus) fade per pixel over the
// hero. The fade itself runs in the sprite shader; these check the CPU half headless: which draws carry the flag,
// the load that drives how far they fade, and how the busy level rises and eases back.
import { describe, expect, test } from "vitest";
import { SpriteBatch } from "../src/render/batch";
import { Flag, Layer } from "../src/render/layers";
import type { Atlas } from "../src/render/atlas";
import type { Renderer } from "../src/render/renderer";
import { Particles, type EmitterDef } from "../src/fx/particles";
import { Afterimages } from "../src/fx/trails";

/** A 3-frame atlas: 0 = an 8 px spark, 1 = a 16 px hit, 2 = a 64 px blast (no GL needed to queue draws). */
function fakeAtlas(): Atlas {
  const size = [8, 16, 64];
  return {
    fx: new Uint16Array(3),
    fy: new Uint16Array(3),
    fw: Uint16Array.from(size),
    fh: Uint16Array.from(size),
    fox: Float32Array.from(size.map((s) => s / 2)),
    foy: Float32Array.from(size.map((s) => s / 2)),
    info: () => ({ first: 0, count: 1, fps: 0 }),
  } as unknown as Atlas;
}

/** The focus byte of the last instance queued on `layer` (the 4th byte of its extra word). */
const focusByte = (b: SpriteBatch, layer: number): number => {
  const L = b.layers[layer];
  return L.u32[(L.count - 1) * 11 + 10] >>> 24;
};

describe("hero focus zone (SpriteBatch.focus)", () => {
  test("Flag.Focus marks the instance; the load counts flagged fx over her only", () => {
    const b = new SpriteBatch(fakeAtlas());
    b.reset();
    b.setFocus(100, 100);
    b.draw(Layer.FxAdd, 1, 104, 98, 1, 1, 0, 0xffffff, 1, 0, Flag.Add | Flag.Focus);
    expect(focusByte(b, Layer.FxAdd)).toBe(255);
    expect(b.focus.load).toBeCloseTo(1, 5); // a 16 px hit at full alpha: weight 1
    // unflagged (her own aura, a boss attack) and far-away fx never count
    b.draw(Layer.FxAdd, 1, 100, 100, 1, 1, 0, 0xffffff, 1, 0, Flag.Add);
    expect(focusByte(b, Layer.FxAdd)).toBe(0);
    b.draw(Layer.Fx, 1, 300, 100, 1, 1, 0, 0xffffff, 1, 0, Flag.Focus);
    expect(b.focus.load).toBeCloseTo(1, 5);
    // a small spark counts by its size (a quarter at least), a big blast whose edge reaches her counts in full
    b.draw(Layer.FxAdd, 0, 100, 100, 1, 1, 0, 0xffffff, 1, 0, Flag.Focus);
    expect(b.focus.load).toBeCloseTo(1.5, 5);
    b.draw(Layer.Fx, 2, 100 + b.focus.r1 + 30, 100, 1, 1, 0, 0xffffff, 0.5, 0, Flag.Focus);
    expect(b.focus.load).toBeCloseTo(2, 5);
  });

  test("off unless the view centres it this frame (hub, attract game, a dead hero)", () => {
    const b = new SpriteBatch(fakeAtlas());
    b.reset();
    for (let i = 0; i < 40; i++) b.draw(Layer.FxAdd, 1, 0, 0, 1, 1, 0, 0xffffff, 1, 0, Flag.Focus);
    expect(b.focus.load).toBe(0);
    expect(b.updateFocus(1 / 60).min).toBe(1);
    // reset() (every frame start) switches it off again
    b.setFocus(0, 0);
    b.reset();
    expect(b.focus.on).toBe(false);
  });

  test("the busy level rises at once (a blast's first white frame is already faded) and eases back", () => {
    const b = new SpriteBatch(fakeAtlas());
    const F = b.focus;
    const frame = (n: number): number => {
      b.reset();
      b.setFocus(0, 0);
      for (let i = 0; i < n; i++) b.draw(Layer.FxAdd, 1, 0, 0, 1, 1, 0, 0xffffff, 1, 0, Flag.Focus);
      return b.updateFocus(1 / 60).min;
    };
    expect(frame(0)).toBeCloseTo(F.calm, 5);
    expect(frame(1)).toBeCloseTo(F.calm, 5); // a hit or two on a calm screen: only the calm fade
    expect(frame(20)).toBeCloseTo(F.busy, 5); // a storm: at once
    const after = frame(0);
    expect(after).toBeGreaterThan(F.busy);
    expect(after).toBeLessThan(F.calm);
    let m = after;
    for (let i = 0; i < 120; i++) m = frame(0);
    expect(m).toBeGreaterThan(F.calm - 0.01);
  });
});

describe("what carries Flag.Focus", () => {
  /** A renderer stand-in that records every queued draw's layer and flags. */
  function recorder(): { r: Renderer; draws: { layer: number; flags: number }[] } {
    const draws: { layer: number; flags: number }[] = [];
    const batch = { draw: (layer: number, _h: number, _x: number, _y: number, _sx: number, _sy: number, _rot: number, _c: number, _a: number, _f: number, flags: number) => draws.push({ layer, flags }), sortKey: NaN };
    const r = { atlas: { info: () => ({ first: 0, count: 1, fps: 0 }) }, batch, camera: { view: { x: 0, y: 0, w: 400, h: 800 } } } as unknown as Renderer;
    return { r, draws };
  }

  test("particles on the fx layers do, dust under her feet and decals do not", () => {
    const { r, draws } = recorder();
    const ps = new Particles(r, 64);
    const def: EmitterDef = { sprite: "fx_px", speed: [0, 0], life: [1, 1], alphaCurve: "none" };
    ps.emit(def, 0, 0, 1, NaN, -1, 1, 1, Layer.Fx);
    ps.emit(def, 0, 0, 1, NaN, -1, 1, 1, Layer.FxAdd);
    ps.emit(def, 0, 0, 1, NaN, -1, 1, 1, Layer.FxBelow);
    ps.emit(def, 0, 0, 1, NaN, -1, 1, 1, Layer.Decal);
    ps.draw();
    const by = new Map(draws.map((d) => [d.layer, (d.flags & Flag.Focus) !== 0]));
    expect(by.get(Layer.Fx)).toBe(true);
    expect(by.get(Layer.FxAdd)).toBe(true);
    expect(by.get(Layer.FxBelow)).toBe(false);
    expect(by.get(Layer.Decal)).toBe(false);
  });

  test("an enemy's white death pop does; the hero's dash afterimages sort under every entity instead", () => {
    const { r, draws } = recorder();
    const g = new Afterimages(r);
    g.spawn(1, 0, 0, 1, 1, 0, 0xffffff, 0.2, 0.9, Layer.Fx);
    g.spawn(1, 0, 0, 1, 1, 0, 0x4fe6df, 0.2, 0.6, Layer.Entity);
    const keys: number[] = [];
    const b = r.batch as unknown as { draw: (...a: number[]) => void; sortKey: number };
    const draw = b.draw;
    b.draw = (...a: number[]) => {
      keys.push(b.sortKey);
      draw(...a);
    };
    g.draw();
    expect(draws.map((d) => [d.layer, (d.flags & Flag.Focus) !== 0])).toEqual([
      [Layer.Fx, true],
      [Layer.Entity, false],
    ]);
    // (the Entity-layer ghost sorts above the view's top edge: under every visible entity)
    expect(keys[1]).toBeLessThan(0);
    expect(b.sortKey).toBeNaN();
  });
});
