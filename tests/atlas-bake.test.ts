/**
 * The build-time atlas bake (tools/bake-atlas.ts, docs/ENGINE.md "Boot path"):
 * atlas.png decoded with pngjs + the baked palette is byte for byte the
 * premultiplied RGBA a runtime `new Atlas()` uploads, the tables round-trip,
 * and Atlas.fromBaked rebuilds an atlas whose lookups and DOM rasters match
 * the runtime one.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { bakeAtlas, decodePng, runtimeAtlas, texelHash, texelsFromIndexPng, type BakedAtlas } from "../tools/bake-atlas";
import { Atlas } from "../src/render/atlas";

let baked: BakedAtlas;
let live: Atlas;

beforeAll(() => {
  baked = bakeAtlas();
  live = runtimeAtlas();
});

describe("baked atlas", () => {
  test("atlas.png (pngjs) + the palette = the runtime atlas' texture bytes", () => {
    const png = decodePng(baked.png);
    expect(png.width).toBe(live.width);
    expect(png.height).toBe(live.height * 2);
    const texels = texelsFromIndexPng(png.data, live.width, live.height, baked.meta.palette);
    const want = live.buildPixels();
    expect(texels.length).toBe(want.length);
    // (byte compare without a 4 MB diff on failure)
    let firstDiff = -1;
    for (let i = 0; i < want.length; i++)
      if (texels[i] !== want[i]) {
        firstDiff = i;
        break;
      }
    expect(firstDiff).toBe(-1);
    expect(texelHash(new Uint32Array(want.buffer, want.byteOffset, want.byteLength >> 2))).toBe(baked.meta.hash);
    // small enough to ship (a plain RGBA PNG of the same texels is 0.7-1 MB)
    expect(baked.png.length).toBeLessThan(400_000);
  });

  test("frame tables, sprite infos and font tables deep-equal the runtime atlas", () => {
    const m = baked.meta;
    expect([m.width, m.height]).toEqual([live.width, live.height]);
    expect(m.fx).toEqual([...live.fx]);
    expect(m.fy).toEqual([...live.fy]);
    expect(m.fw).toEqual([...live.fw]);
    expect(m.fh).toEqual([...live.fh]);
    expect(m.fox).toEqual([...live.fox]);
    expect(m.foy).toEqual([...live.foy]);
    expect(m.missing).toEqual(live.missing);
    const a = Atlas.fromBaked(JSON.parse(JSON.stringify(m)), live.buildPixels().slice());
    expect(a.frameCount).toBe(live.frameCount);
    expect([...a.sprites.keys()].sort()).toEqual([...live.sprites.keys()].sort());
    for (const [id, s] of live.sprites) expect(a.sprites.get(id), id).toEqual(s);
    expect(a.missingInfo).toEqual(live.missingInfo);
    for (const [id, f] of live.fonts) {
      const g = a.fonts.get(id)!;
      expect(g, id).toBeDefined();
      expect([g.h, g.spaceAdvance, g.placeholder]).toEqual([f.h, f.spaceAdvance, f.placeholder]);
      expect([...g.handle]).toEqual([...f.handle]);
      expect([...g.advance]).toEqual([...f.advance]);
      expect([...g.width]).toEqual([...f.width]);
    }
    expect(a.font("font_main")).toBeDefined();
    expect(a.handle("fx_px")).toBe(live.handle("fx_px"));
    expect(a.anim("en_puff")).toEqual(live.anim("en_puff"));
    expect(Buffer.from(a.buildPixels()).equals(Buffer.from(live.buildPixels()))).toBe(true);
  });

  test("rasters cut from the baked texels: opaque / clear pixels exact, partial alpha premultiplies back to the same texel", { tags: ["slow"] }, () => {
    const a = Atlas.fromBaked(baked.meta, live.buildPixels().slice());
    let partial = 0;
    for (const id of live.sprites.keys()) {
      const r0 = live.raster(id)!;
      const r1 = a.raster(id)!;
      expect([r1.w, r1.h, r1.ox, r1.oy, r1.fps, r1.frames.length], id).toEqual([r0.w, r0.h, r0.ox, r0.oy, r0.fps, r0.frames.length]);
      for (let f = 0; f < r0.frames.length; f++) {
        const p0 = r0.frames[f];
        const p1 = r1.frames[f];
        for (let i = 0; i < p0.length; i += 4) {
          const al = p0[i + 3];
          expect(p1[i + 3]).toBe(al);
          if (al === 0) continue;
          if (al === 255) {
            if (p1[i] !== p0[i] || p1[i + 1] !== p0[i + 1] || p1[i + 2] !== p0[i + 2]) expect([id, f, i, ...p1.subarray(i, i + 3)]).toEqual([id, f, i, ...p0.subarray(i, i + 3)]);
            continue;
          }
          partial++;
          // the atlas' premultiply of both colours lands on the same texel
          for (let c = 0; c < 3; c++) {
            const want = Math.trunc((p0[i + c] * al + 127) / 255);
            const got = Math.trunc((p1[i + c] * al + 127) / 255);
            if (want !== got) expect([id, f, i, c, got]).toEqual([id, f, i, c, want]);
          }
        }
      }
    }
    expect(partial).toBeGreaterThan(0);
  });
});
