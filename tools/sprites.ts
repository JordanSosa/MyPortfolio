/**
 * Sprite preview / validation page. Used by `npm run sprites` (scripts/sprites.mjs).
 * URL params:
 *   filter=hoshi,en_      comma list of id substrings (default: all)
 *   owner=chars|world|engine
 *   scale=4               pixel scale
 *   bg=checker|dark|light|grass
 *   fonts=1               also render fonts
 *   validate=1            only report (no drawing)
 */
import { isGrid, rasterizeFont, rasterizeSprite, validateGrid } from "../src/art/format";
import { FONT_MANIFEST, MANIFEST } from "../src/art/manifest";
import { ALL_FONTS, ALL_SPRITES } from "../src/art/sprites/index";

const qs = new URLSearchParams(location.search);
const filters = (qs.get("filter") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const owner = qs.get("owner");
const scale = Number(qs.get("scale") ?? 4);
const bg = qs.get("bg") ?? "checker";
const showFonts = qs.get("fonts") === "1" || filters.some((f) => f.startsWith("font"));

const errors: string[] = [];
const byId = new Map(ALL_SPRITES.map((s) => [s.id, s]));

// ---- validation -------------------------------------------------------------
for (const s of ALL_SPRITES) if (isGrid(s)) errors.push(...validateGrid(s));
const missing: string[] = [];
for (const m of MANIFEST) {
  const s = byId.get(m.id);
  if (!s) {
    missing.push(m.id);
    continue;
  }
  const frames = isGrid(s) ? s.frames.length : s.frames;
  if (s.w !== m.w || s.h !== m.h) errors.push(`${m.id}: size ${s.w}x${s.h}, manifest wants ${m.w}x${m.h}`);
  if (frames !== m.frames) errors.push(`${m.id}: ${frames} frames, manifest wants ${m.frames}`);
  const ex = m.pivot === "feet" ? [m.w / 2, m.h - 1] : [m.w / 2, m.h / 2];
  const ox = s.ox ?? s.w / 2;
  const oy = s.oy ?? s.h / 2;
  if (Math.abs(ox - ex[0]) > 1 || Math.abs(oy - ex[1]) > 1)
    errors.push(`${m.id}: pivot (${ox},${oy}) but manifest pivot '${m.pivot}' expects ~(${ex[0]},${ex[1]})`);
}
const fontIds = new Set(ALL_FONTS.map((f) => f.id));
for (const f of FONT_MANIFEST) if (!fontIds.has(f.id)) missing.push(f.id);

const report = {
  total: ALL_SPRITES.length,
  manifest: MANIFEST.length,
  missing,
  errors,
  extra: ALL_SPRITES.filter((s) => !MANIFEST.some((m) => m.id === s.id)).map((s) => s.id),
};
(window as unknown as { __report: unknown }).__report = report;
document.getElementById("errors")!.textContent =
  (errors.length ? `ERRORS (${errors.length}):\n` + errors.join("\n") + "\n" : "") +
  (missing.length ? `MISSING (${missing.length}): ${missing.join(", ")}` : "");

// ---- drawing ------------------------------------------------------------------
function bgFill(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (bg === "dark") {
    ctx.fillStyle = "#1a1028";
    ctx.fillRect(0, 0, w, h);
  } else if (bg === "light") {
    ctx.fillStyle = "#f4eefc";
    ctx.fillRect(0, 0, w, h);
  } else if (bg === "grass") {
    ctx.fillStyle = "#7fd47a";
    ctx.fillRect(0, 0, w, h);
  } else {
    const c = Math.max(4, scale * 2);
    for (let y = 0; y < h; y += c)
      for (let x = 0; x < w; x += c) {
        ctx.fillStyle = ((x / c + y / c) & 1) === 0 ? "#3a2d55" : "#45376a";
        ctx.fillRect(x, y, c, c);
      }
  }
}

function canvasFor(px: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  src.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  bgFill(ctx, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const grid = document.getElementById("grid")!;
if (qs.get("validate") !== "1") {
  const wanted = (id: string) => {
    if (filters.length && !filters.some((f) => id.includes(f))) return false;
    if (owner) {
      const m = MANIFEST.find((e) => e.id === id);
      if (!m || m.owner !== owner) return false;
    }
    return true;
  };
  const ids = [...new Set([...MANIFEST.map((m) => m.id), ...ALL_SPRITES.map((s) => s.id)])].filter(wanted);
  for (const id of ids) {
    const cell = document.createElement("div");
    cell.className = "cell";
    const def = byId.get(id);
    const label = document.createElement("div");
    label.className = "label";
    if (!def) {
      cell.classList.add("missing");
      const m = MANIFEST.find((e) => e.id === id)!;
      label.innerHTML = `<b>${id}</b> MISSING ${m.w}x${m.h} x${m.frames}`;
      cell.append(label);
      grid.append(cell);
      continue;
    }
    const r = rasterizeSprite(def);
    label.innerHTML = `<b>${id}</b> ${r.w}x${r.h} x${r.frames.length}`;
    const frames = document.createElement("div");
    frames.className = "frames";
    for (const f of r.frames) frames.append(canvasFor(f, r.w, r.h));
    cell.append(label, frames);
    grid.append(cell);
  }
  if (showFonts) {
    for (const fd of ALL_FONTS) {
      const font = rasterizeFont(fd);
      const cell = document.createElement("div");
      cell.className = "cell";
      const label = document.createElement("div");
      label.className = "label";
      label.innerHTML = `<b>${fd.id}</b> h=${fd.h} glyphs=${font.glyphs.size}`;
      cell.append(label);
      const lines = ["0123456789 +-x%.,:/'*!?", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz", "LEVEL UP! CRIT 12345 x99", "Kira Kira OVERDRIVE!"];
      for (const text of lines) {
        let w = 0;
        for (const ch of text) w += font.glyphs.get(ch)?.advance ?? 4;
        const W = w + 4;
        const H = font.h + 2;
        const px = new Uint8ClampedArray(W * H * 4);
        let pen = 1;
        for (const ch of text) {
          const g = font.glyphs.get(ch);
          if (!g) {
            pen += 4;
            continue;
          }
          for (let y = 0; y < g.h; y++)
            for (let x = 0; x < g.w; x++) {
              const si = (y * g.w + x) * 4;
              if (g.pixels[si + 3] === 0) continue;
              const di = ((y + 1) * W + (pen + x)) * 4;
              px.set(g.pixels.subarray(si, si + 4), di);
            }
          pen += g.advance;
        }
        cell.append(canvasFor(px, W, H));
      }
      grid.append(cell);
    }
  }
}
document.body.dataset.ready = "1";
