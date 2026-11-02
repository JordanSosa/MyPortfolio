/**
 * Infinite procedural dream meadow: tile_ground variants chosen by stable
 * per-cell hashing + low-frequency noise (worn paths, flower/clover patches),
 * plus scattered deco (flowers, grass, rocks, glowing mushrooms, crystals,
 * cotton-candy trees) placed per 24 px cell (trees per 96 px cell), y-sorted
 * on the entity layer with shadows. Nothing is stored: everything is a pure
 * function of the cell coordinates, so the world is stable while scrolling.
 */
import { hash01, noise2 } from "../core/math";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import type { Anims } from "./anims";

const TILE = 16;
const CELL = 24;
const TREE_CELL = 96;

export class Ground {
  /** Deco density multiplier (attract mode / quality). */
  density = 1;
  private tile = { first: 0, count: 1 };
  private ids: Record<string, { first: number; count: number }> = {};

  constructor(
    private readonly r: Renderer,
    anims: Anims,
  ) {
    this.tile = anims.get("tile_ground");
    for (const id of ["deco_flower", "deco_grass", "deco_rock", "deco_mush", "deco_crystal", "deco_tree"]) this.ids[id] = anims.get(id);
  }

  /**
   * @param px,py  hero feet: a tree canopy the hero walks behind fades out so
   *               the player never loses sight of their character.
   */
  draw(time: number, px = NaN, py = NaN): void {
    const r = this.r;
    const v = r.camera.view;
    const T = this.tile;
    const x0 = Math.floor(v.x / TILE) - 1;
    const y0 = Math.floor(v.y / TILE) - 1;
    const x1 = Math.ceil((v.x + v.w) / TILE) + 1;
    const y1 = Math.ceil((v.y + v.h) / TILE) + 1;
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const h = hash01(tx, ty);
        const n = noise2(tx * 0.09, ty * 0.09, 7);
        const m = noise2(tx * 0.21 + 40, ty * 0.21 - 13, 3);
        let f: number;
        if (n > 0.5) f = 7; // worn path
        else if (m > 0.42 && h < 0.55) f = h < 0.3 ? 4 : 5; // flower / clover patch
        else if (h > 0.965) f = 6; // sparkle grass
        else if (h > 0.93) f = 4 + ((h * 997) & 1);
        else f = (h * 1000) & 3;
        r.spr(Layer.Ground, T.first + (f % T.count), tx * TILE + 8, ty * TILE + 8);
      }

    // deco cells
    const ids = this.ids;
    const cx0 = Math.floor(v.x / CELL) - 1;
    const cy0 = Math.floor(v.y / CELL) - 1;
    const cx1 = Math.ceil((v.x + v.w) / CELL) + 1;
    const cy1 = Math.ceil((v.y + v.h) / CELL) + 3;
    const dens = this.density;
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const h = hash01(cx * 3 + 11, cy * 5 - 7);
        const n = noise2(cx * 0.16, cy * 0.16, 21);
        // denser near noise peaks (meadow clumps), sparse elsewhere
        const p = (0.18 + n * 0.5) * dens;
        if (h > p) continue;
        const h2 = hash01(cx - 91, cy + 37);
        const h3 = hash01(cx + 13, cy * 7 + 3);
        const x = cx * CELL + Math.floor(h2 * (CELL - 6)) + 3;
        const y = cy * CELL + Math.floor(h3 * (CELL - 4)) + 4;
        const k = hash01(cx * 17, cy * 29);
        let id: string;
        let glow = 0;
        let shadow = 0;
        if (k < 0.42) id = "deco_grass";
        else if (k < 0.78) id = "deco_flower";
        else if (k < 0.88) {
          id = "deco_rock";
          shadow = 9;
        } else if (k < 0.95) {
          id = "deco_mush";
          glow = Flag.Glow;
        } else {
          id = "deco_crystal";
          glow = Flag.Glow;
          shadow = 7;
        }
        const a = ids[id];
        const frame = a.first + Math.floor(h2 * 977) % a.count;
        const flip = h3 > 0.5 ? -1 : 1;
        if (shadow) r.shadow(x, y, shadow, 0.7);
        if (glow) {
          const pulse = 0.55 + 0.25 * Math.sin(time * 2.2 + h * 30);
          r.glow(x, y - 4, id === "deco_crystal" ? 10 : 7, id === "deco_crystal" ? 0xb47cff : 0x4fe6df, pulse * 0.45);
        }
        r.spr(Layer.Entity, frame, x, y, flip, 1, 0, 0xffffff, 1, 0, glow);
      }

    // cotton-candy trees (big, rare, sway between their 2 frames)
    const tr = ids.deco_tree;
    const tx0 = Math.floor(v.x / TREE_CELL) - 1;
    const ty0 = Math.floor(v.y / TREE_CELL) - 1;
    const tx1 = Math.ceil((v.x + v.w) / TREE_CELL) + 1;
    const ty1 = Math.ceil((v.y + v.h) / TREE_CELL) + 1;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const h = hash01(tx * 7 + 3, ty * 13 + 1);
        if (h > 0.42 * dens) continue;
        const x = tx * TREE_CELL + 16 + Math.floor(hash01(tx, ty * 3) * (TREE_CELL - 32));
        const y = ty * TREE_CELL + 40 + Math.floor(hash01(tx * 5, ty) * (TREE_CELL - 44));
        const sway = Math.sin(time * 1.3 + h * 40) > 0.35 ? 1 : 0;
        r.shadow(x, y, 26, 0.85);
        // hero behind the canopy (drawn earlier in the y-sort): see-through canopy
        let alpha = 1;
        if (py < y) {
          const dx = (px - x) / 17;
          const dy = (py - 8 - (y - 24)) / 17;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1.6) alpha = 0.42 + 0.58 * Math.max(0, (d2 - 0.7) / 0.9);
        }
        r.spr(Layer.Entity, tr.first + (sway % tr.count), x, y, h > 0.21 ? -1 : 1, 1, 0, 0xffffff, alpha);
      }
  }
}
