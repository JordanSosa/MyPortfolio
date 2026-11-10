/**
 * Ground tiling preview (world art QA). Renders patches of random
 * `tile_ground` variants with deco / props / pickups / actors scattered on
 * top, at an integer scale, so seams, repetition and sprite contrast can be
 * judged. Open /tools/tiles.html in the dev server.
 *
 * URL params:
 *   scale=4         pixel scale
 *   cols=12 rows=8  patch size in tiles
 *   seed=1          layout seed
 *   mode=game      game (same choice as src/view/ground.ts) | weighted | uniform | each
 *   actors=1        draw sample actors / pickups / projectiles on the scene patch
 *   night=1         also render a night-tinted copy (rough colour-grade check)
 */
import { rasterizeSprite, type RasterSprite } from "../src/art/format";
import { ALL_SPRITES } from "../src/art/sprites/index";
import { hash01, noise2 } from "../src/core/math";

const qs = new URLSearchParams(location.search);
const scale = Number(qs.get("scale") ?? 4);
const cols = Number(qs.get("cols") ?? 12);
const rowsN = Number(qs.get("rows") ?? 8);
const seed = Number(qs.get("seed") ?? 1);
const mode = qs.get("mode") ?? "game";
const ox = Number(qs.get("ox") ?? 0);
const oy = Number(qs.get("oy") ?? 0);

/** Mirror of the tile choice in src/view/ground.ts (keep in sync if that changes). */
function gameVariant(tx: number, ty: number): number {
  const h = hash01(tx, ty);
  const n = noise2(tx * 0.09, ty * 0.09, 7);
  const m = noise2(tx * 0.21 + 40, ty * 0.21 - 13, 3);
  if (n > 0.5) return 7;
  if (m > 0.42 && h < 0.55) return h < 0.3 ? 4 : 5;
  if (h > 0.965) return 6;
  if (h > 0.93) return 4 + ((h * 997) & 1);
  return (h * 1000) & 3;
}
const actors = qs.get("actors") !== "0";
const night = qs.get("night") === "1";

const byId = new Map(ALL_SPRITES.map((s) => [s.id, s]));
const cache = new Map<string, RasterSprite>();
function ras(id: string): RasterSprite | null {
  if (cache.has(id)) return cache.get(id)!;
  const def = byId.get(id);
  if (!def) return null;
  const r = rasterizeSprite(def);
  cache.set(id, r);
  return r;
}

function mulberry(s: number): () => number {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEIGHTS = [21, 21, 21, 21, 5, 5, 4, 2];
function pickWeighted(r: number): number {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let v = r * total;
  for (let i = 0; i < WEIGHTS.length; i++) {
    v -= WEIGHTS[i];
    if (v < 0) return i;
  }
  return 0;
}

/** Blit a sprite frame at (x, y) = pivot position, straight alpha "over". */
function blit(img: ImageData, id: string, frame: number, x: number, y: number, flip = false): void {
  const r = ras(id);
  if (!r) return;
  const px = r.frames[frame % r.frames.length];
  const x0 = Math.round(x - r.ox);
  const y0 = Math.round(y - r.oy);
  for (let yy = 0; yy < r.h; yy++)
    for (let xx = 0; xx < r.w; xx++) {
      const sx = flip ? r.w - 1 - xx : xx;
      const si = (yy * r.w + sx) * 4;
      const a = px[si + 3] / 255;
      if (a <= 0) continue;
      const dx = x0 + xx;
      const dy = y0 + yy;
      if (dx < 0 || dy < 0 || dx >= img.width || dy >= img.height) continue;
      const di = (dy * img.width + dx) * 4;
      for (let c = 0; c < 3; c++) img.data[di + c] = Math.round(px[si + c] * a + img.data[di + c] * (1 - a));
      img.data[di + 3] = 255;
    }
}

function panel(title: string, img: ImageData, tint?: [number, number, number]): void {
  if (tint)
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = Math.round(img.data[i] * tint[0]);
      img.data[i + 1] = Math.round(img.data[i + 1] * tint[1]);
      img.data[i + 2] = Math.round(img.data[i + 2] * tint[2]);
    }
  const src = document.createElement("canvas");
  src.width = img.width;
  src.height = img.height;
  src.getContext("2d")!.putImageData(img, 0, 0);
  const c = document.createElement("canvas");
  c.width = img.width * scale;
  c.height = img.height * scale;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const p = document.createElement("div");
  p.className = "panel";
  const l = document.createElement("div");
  l.className = "label";
  l.textContent = title;
  p.append(l, c);
  document.getElementById("root")!.append(p);
}

function ground(rand: () => number, W: number, H: number): ImageData {
  const img = new ImageData(W * 16, H * 16);
  const tile = ras("tile_ground");
  const n = tile ? tile.frames.length : 1;
  for (let ty = 0; ty < H; ty++)
    for (let tx = 0; tx < W; tx++) {
      let f: number;
      if (mode === "game") f = gameVariant(tx + ox, ty + oy) % n;
      else if (mode === "uniform") f = Math.floor(rand() * n);
      else if (mode === "each") f = (tx + ty * 3) % n;
      else f = pickWeighted(rand());
      blit(img, "tile_ground", f, tx * 16 + 8, ty * 16 + 8);
    }
  return img;
}

const rand = mulberry(seed);

// 1) bare ground patch
panel(`tile_ground ${cols}x${rowsN} (${mode})`, ground(rand, cols, rowsN));

// 2) variant pairs: each variant tiled 3x3 to spot self-repetition
{
  const tile = ras("tile_ground");
  const n = tile ? tile.frames.length : 0;
  const img = new ImageData(n * 3 * 16 + (n - 1) * 4, 48);
  for (let f = 0; f < n; f++)
    for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) blit(img, "tile_ground", f, f * 52 + tx * 16 + 8, ty * 16 + 8);
  panel("each variant 3x3", img);
}

// 3) scene: ground + deco + props + pickups + actors
{
  const W = cols;
  const H = rowsN;
  const img = ground(rand, W, H);
  const items: { id: string; f: number; x: number; y: number; flip: boolean }[] = [];
  const decoPool = ["deco_flower", "deco_flower", "deco_grass", "deco_grass", "deco_grass", "deco_rock", "deco_mush", "deco_crystal"];
  for (let i = 0; i < 26; i++) {
    const id = decoPool[Math.floor(rand() * decoPool.length)];
    const r = ras(id);
    items.push({ id, f: Math.floor(rand() * (r?.frames.length ?? 1)), x: 6 + rand() * (W * 16 - 12), y: 8 + rand() * (H * 16 - 10), flip: rand() < 0.5 });
  }
  items.push({ id: "deco_tree", f: 0, x: 28, y: 46, flip: false });
  items.push({ id: "deco_tree", f: 1, x: W * 16 - 30, y: H * 16 - 10, flip: true });
  items.push({ id: "prop_lantern", f: 0, x: 70, y: 40, flip: false });
  items.push({ id: "prop_gift", f: 0, x: 150, y: 112, flip: false });
  items.push({ id: "chest", f: 0, x: 120, y: 30, flip: false });
  if (actors) {
    items.push({ id: "hoshi_idle", f: 0, x: 96, y: 72, flip: false });
    items.push({ id: "en_puff", f: 0, x: 130, y: 66, flip: true });
    items.push({ id: "en_batbun", f: 1, x: 60, y: 92, flip: false });
    items.push({ id: "en_shroom", f: 0, x: 140, y: 88, flip: true });
    items.push({ id: "en_boo", f: 0, x: 40, y: 70, flip: false });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) blit(img, it.id, it.f, it.x, it.y, it.flip);
  if (actors) {
    const fx: [string, number, number, number][] = [
      ["gem_1", 0, 80, 84],
      ["gem_2", 0, 86, 90],
      ["gem_3", 0, 74, 94],
      ["gem_4", 0, 110, 96],
      ["coin", 0, 118, 80],
      ["food_onigiri", 0, 46, 112],
      ["food_cake", 0, 62, 116],
      ["pk_magnet", 0, 160, 50],
      ["pk_bomb", 0, 176, 64],
      ["pk_clock", 0, 168, 80],
      ["w_star", 0, 112, 60],
      ["w_heart", 0, 82, 56],
      ["w_yarn", 0, 104, 82],
      ["w_bell", 0, 150, 70],
      ["w_candy", 0, 128, 104],
      ["w_bubble", 0, 90, 104],
      ["eb_orb", 0, 150, 100],
    ];
    for (const [id, f, x, y] of fx) blit(img, id, f, x, y);
  }
  panel("scene", img);
  if (night) {
    const copy = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
    panel("scene (rough night tint)", copy, [0.55, 0.5, 0.85]);
  }
}

document.body.dataset.ready = "1";
