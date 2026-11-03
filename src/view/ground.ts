/**
 * Infinite procedural stage ground, fully driven by the current StageDef
 * (src/game/stages/): 16 px tiles picked by the stage's region rules (noise
 * paths / patches, hash accents) per tile, plus deco layers - "scatter" deco
 * per small cell (flowers, rocks, glowing mushrooms, crystals...) and "tall"
 * deco per big cell (trees: 2-frame sway, canopy fades when the hero walks
 * behind), y-sorted on the entity layer with shadows. Nothing is stored:
 * everything is a pure function of the cell coordinates (+ a per-stage salt),
 * so the world is stable while scrolling. Dream Meadow's data reproduces the
 * original meadow exactly (same hashes, same thresholds).
 */
import { hash01, noise2 } from "../core/math";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import type { DecoScatter, DecoTall, FramePick, StageDef, StageTiles, TileRule } from "../game/stage";
import type { Anims } from "./anims";

const TILE = 16;

interface ScatterRt {
  def: DecoScatter;
  ids: { first: number; count: number }[];
}
interface TallRt {
  def: DecoTall;
  a: { first: number; count: number };
}

/** frames[] choice from a per-cell hash (stage.ts FramePick). */
function pick(p: FramePick, h: number): number {
  const fr = p.frames;
  const n = fr.length;
  if (n <= 1) return fr[0] ?? 0;
  if (p.cuts) {
    for (let i = 0; i < p.cuts.length && i < n - 1; i++) if (h < p.cuts[i]) return fr[i];
    return fr[n - 1];
  }
  if (p.mul) return fr[((h * p.mul) | 0) % n];
  if (p.weights) {
    let tot = 0;
    for (let i = 0; i < n; i++) tot += p.weights[i] ?? 0;
    let r = h * tot;
    for (let i = 0; i < n; i++) {
      r -= p.weights[i] ?? 0;
      if (r < 0) return fr[i];
    }
    return fr[n - 1];
  }
  return fr[Math.min(n - 1, (h * n) | 0)];
}

function ruleMatches(rule: TileRule, tx: number, ty: number, h: number): boolean {
  const hs = rule.hash;
  if (hs) {
    if (hs.above !== undefined && !(h > hs.above)) return false;
    if (hs.below !== undefined && !(h < hs.below)) return false;
  }
  const nz = rule.noise;
  if (nz) {
    const v = noise2(tx * nz.freq + (nz.ox ?? 0), ty * nz.freq + (nz.oy ?? 0), nz.seed);
    if (nz.above !== undefined && !(v > nz.above)) return false;
    if (nz.below !== undefined && !(v < nz.below)) return false;
  }
  return true;
}

export class Ground {
  /** Deco density multiplier (attract mode / quality). */
  density = 1;
  private tiles: StageTiles | null = null;
  private tile = { first: 0, count: 1 };
  private scatter: ScatterRt[] = [];
  private tall: TallRt[] = [];
  private stageId = "";

  constructor(
    private readonly r: Renderer,
    private readonly anims: Anims,
  ) {}

  /** Switch to a stage's tiles + deco (sprite handles are looked up once here, not per frame). */
  setStage(st: StageDef): void {
    if (st.id === this.stageId) return;
    this.stageId = st.id;
    this.tiles = st.tiles;
    this.tile = this.anims.get(st.tiles.sprite);
    this.scatter = [];
    this.tall = [];
    for (const d of st.deco) {
      if (d.kind === "scatter") this.scatter.push({ def: d, ids: d.items.map((it) => this.anims.get(it.sprite)) });
      else this.tall.push({ def: d, a: this.anims.get(d.sprite) });
    }
  }

  /**
   * @param px,py  hero feet: a tree canopy the hero walks behind fades out so
   *               the player never loses sight of their character.
   */
  draw(time: number, px = NaN, py = NaN): void {
    const tiles = this.tiles;
    if (!tiles) return;
    const r = this.r;
    const v = r.camera.view;
    const T = this.tile;
    const rules = tiles.rules;
    const x0 = Math.floor(v.x / TILE) - 1;
    const y0 = Math.floor(v.y / TILE) - 1;
    const x1 = Math.ceil((v.x + v.w) / TILE) + 1;
    const y1 = Math.ceil((v.y + v.h) / TILE) + 1;
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const h = hash01(tx, ty);
        let f = -1;
        for (let i = 0; i < rules.length; i++) {
          if (ruleMatches(rules[i], tx, ty, h)) {
            f = pick(rules[i], h);
            break;
          }
        }
        if (f < 0) f = pick(tiles.base, h);
        r.spr(Layer.Ground, T.first + (f % T.count), tx * TILE + 8, ty * TILE + 8);
      }
    for (let i = 0; i < this.scatter.length; i++) this.drawScatter(this.scatter[i], time);
    for (let i = 0; i < this.tall.length; i++) this.drawTall(this.tall[i], time, px, py);
  }

  private drawScatter(rt: ScatterRt, time: number): void {
    const r = this.r;
    const v = r.camera.view;
    const d = rt.def;
    const CELL = d.cell;
    const s = d.salt ?? 0;
    const items = d.items;
    const cx0 = Math.floor(v.x / CELL) - 1;
    const cy0 = Math.floor(v.y / CELL) - 1;
    const cx1 = Math.ceil((v.x + v.w) / CELL) + 1;
    const cy1 = Math.ceil((v.y + v.h) / CELL) + 3;
    const dens = this.density;
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const h = hash01(cx * 3 + 11 + s, cy * 5 - 7);
        const n = noise2(cx * d.freq, cy * d.freq, d.seed);
        // denser near noise peaks (clumps), sparse elsewhere
        const p = (d.base + n * d.noise) * dens;
        if (h > p) continue;
        const h2 = hash01(cx - 91 + s, cy + 37);
        const h3 = hash01(cx + 13 + s, cy * 7 + 3);
        const x = cx * CELL + Math.floor(h2 * (CELL - 6)) + 3;
        const y = cy * CELL + Math.floor(h3 * (CELL - 4)) + 4;
        const k = hash01(cx * 17 + s, cy * 29);
        let j = 0;
        while (j < items.length - 1 && !(k < items[j].upTo)) j++;
        const it = items[j];
        const a = rt.ids[j];
        const glow = it.glow ? Flag.Glow : 0;
        const frame = a.first + (Math.floor(h2 * 977) % a.count);
        const flip = h3 > 0.5 ? -1 : 1;
        if (it.shadow) r.shadow(x, y, it.shadow, 0.7);
        if (it.glow) {
          const pulse = 0.55 + 0.25 * Math.sin(time * 2.2 + h * 30);
          r.glow(x, y - 4, it.glow.r, it.glow.color, pulse * 0.45);
        }
        r.spr(Layer.Entity, frame, x, y, flip, 1, 0, 0xffffff, 1, 0, glow);
      }
  }

  private drawTall(rt: TallRt, time: number, px: number, py: number): void {
    const r = this.r;
    const v = r.camera.view;
    const d = rt.def;
    const tr = rt.a;
    const CELL = d.cell;
    const s = d.salt ?? 0;
    const can = d.canopy;
    const tx0 = Math.floor(v.x / CELL) - 1;
    const ty0 = Math.floor(v.y / CELL) - 1;
    const tx1 = Math.ceil((v.x + v.w) / CELL) + 1;
    const ty1 = Math.ceil((v.y + v.h) / CELL) + 1;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const h = hash01(tx * 7 + 3 + s, ty * 13 + 1);
        if (h > d.chance * this.density) continue;
        const x = tx * CELL + 16 + Math.floor(hash01(tx + s, ty * 3) * (CELL - 32));
        const y = ty * CELL + 40 + Math.floor(hash01(tx * 5 + s, ty) * (CELL - 44));
        const sway = Math.sin(time * d.sway.speed + h * 40) > d.sway.above ? 1 : 0;
        r.shadow(x, y, d.shadow, 0.85);
        // hero behind the canopy (drawn earlier in the y-sort): see-through canopy
        let alpha = 1;
        if (can && py < y) {
          const dx = (px - x) / can.r;
          const dy = (py - 8 - (y - can.h)) / can.r;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1.6) alpha = 0.42 + 0.58 * Math.max(0, (d2 - 0.7) / 0.9);
        }
        r.spr(Layer.Entity, tr.first + (sway % tr.count), x, y, h > d.flipAbove ? -1 : 1, 1, 0, 0xffffff, alpha);
      }
  }
}
