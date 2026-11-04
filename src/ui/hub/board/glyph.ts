/**
 * Board / talent glyphs: the 24 white 8x8 `board_glyph` frames (art manifest
 * order: might, max HP, regen, armor, move, cooldown, area, amount, projectile
 * speed, duration, pickup, crit, crit damage, luck, XP, coins, gem find, dash
 * cooldown, curse, reroll / banish / skip / cards, slot, revive, dash charge,
 * overdrive / chest / elite) recoloured per use. The white pixels take the
 * tint, the dark outline stays, so a glyph reads on any star. Tinted frames
 * are PNG data URLs made once from the atlas raster's pixels (no image
 * decode, no canvas readback: one putImageData + toDataURL of an 8x8 canvas)
 * and cached. Requests are queued and made in idle slices (a few ms each), so
 * the first Training Arc open never tints in one long task; board.ts queues
 * every board (frame, tint) pair at boot (`pretint`), so the first open finds
 * them made. `<img data-glyph data-tint>` placeholders are filled by
 * `fillGlyphs`.
 */
import type { RasterSprite } from "../../../art/format";
import type { RunFlag } from "../../../game/run-config";
import type { NodeEffect, StatKey } from "../../../meta/board/types";
import { takeAtlas } from "../../../render/atlas-source";

export const G = {
  might: 0,
  maxHp: 1,
  regen: 2,
  armor: 3,
  move: 4,
  cooldown: 5,
  area: 6,
  amount: 7,
  projSpeed: 8,
  duration: 9,
  pickup: 10,
  crit: 11,
  critMult: 12,
  luck: 13,
  xp: 14,
  coins: 15,
  gems: 16,
  dash: 17,
  curse: 18,
  reroll: 19,
  slot: 20,
  revive: 21,
  dashCharge: 22,
  special: 23,
} as const;

const BY_STAT: Partial<Record<StatKey, number>> = {
  might: G.might,
  knock: G.might,
  maxHp: G.maxHp,
  regen: G.regen,
  healMul: G.regen,
  armor: G.armor,
  dmgReduction: G.armor,
  shield: G.armor,
  moveSpeed: G.move,
  cooldown: G.cooldown,
  area: G.area,
  amount: G.amount,
  projSpeed: G.projSpeed,
  duration: G.duration,
  pickup: G.pickup,
  crit: G.crit,
  critMult: G.critMult,
  luck: G.luck,
  growth: G.xp,
  greed: G.coins,
  gemFind: G.gems,
  dashCd: G.dash,
  curse: G.curse,
  rerolls: G.reroll,
  cards: G.reroll,
  revives: G.revive,
};

const BY_FLAG: Partial<Record<RunFlag, number>> = {
  revives: G.revive,
  plotArmor: G.revive,
  dashCharges: G.dashCharge,
  banish: G.reroll,
  skip: G.reroll,
  freeRerolls: G.reroll,
  chestLuck: G.special,
  eliteRate: G.special,
  ultStart: G.special,
  friendship: G.amount,
};

/** Glyph frame for a board node's first effect. */
export function effectGlyph(fx: readonly NodeEffect[]): number {
  const e = fx[0];
  if (!e) return G.special;
  switch (e.t) {
    case "stat":
    case "statPct":
      return BY_STAT[e.stat] ?? G.special;
    case "flag":
      return BY_FLAG[e.flag] ?? G.special;
    case "slot":
      return G.slot;
    case "startLevel":
      return G.xp;
    case "startWeapon":
      return G.special;
  }
}

/** Keyword -> glyph for free text (talent descriptions). First match wins: specific before generic. */
const TEXT_RULES: readonly [RegExp, number][] = [
  [/crit(ical)? dam/i, G.critMult],
  [/crit/i, G.crit],
  [/projectile speed/i, G.projSpeed],
  [/dash charge/i, G.dashCharge],
  [/dash/i, G.dash],
  [/revive|survive|lethal/i, G.revive],
  [/max hp|\bhp\b(?! ?\/ ?s)/i, G.maxHp],
  [/regen|heal|hp ?\/ ?s/i, G.regen],
  [/armor|shield|damage reduction|damage taken/i, G.armor],
  [/move speed|movement|faster/i, G.move],
  [/cooldown/i, G.cooldown],
  [/area|radius|bigger/i, G.area],
  [/projectile|fires \+|\+\d+ (star|missile|shot|cat|fist|smack|slash)/i, G.amount],
  [/duration|lasts/i, G.duration],
  [/pickup|magnet/i, G.pickup],
  [/luck/i, G.luck],
  [/\bxp\b|experience|level/i, G.xp],
  [/coin|greed/i, G.coins],
  [/gem/i, G.gems],
  [/curse/i, G.curse],
  [/reroll|card/i, G.reroll],
  [/overdrive|ultimate|meteor|ult\b/i, G.special],
  [/damage|might/i, G.might],
];

export function textGlyph(text: string): number {
  for (const [re, g] of TEXT_RULES) if (re.test(text)) return g;
  return G.special;
}

// ---------------------------------------------------------------- tinting

const done = new Map<string, string>();
const waiting = new Map<string, ((url: string) => void)[]>();
/** Keys to make, in request order (on-demand requests jump ahead of the boot pretint). */
const queue: string[] = [];

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The `board_glyph` raster (straight RGBA frames); undefined without the art, null while the atlas is still loading. */
function glyphRaster(): RasterSprite | undefined | null {
  let a;
  try {
    a = takeAtlas();
  } catch {
    return null;
  }
  return a.has("board_glyph") ? a.raster("board_glyph") : undefined;
}

/** Make one tinted frame now ("" without art; null while the atlas is still loading: try again later). */
function tintNow(frame: number, tint: string): string | null {
  const r = glyphRaster();
  if (r === null) return null;
  if (!r || typeof document === "undefined") return "";
  const n = r.frames.length;
  const px = new Uint8ClampedArray(r.frames[((frame % n) + n) % n]);
  const [tr, tg, tb] = rgb(tint);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    // white / light pixels take the tint (keeping their shade); the dark outline stays
    const lum = (px[i] + px[i + 1] + px[i + 2]) / 765;
    if (lum < 0.45) continue;
    px[i] = Math.round(tr * lum);
    px[i + 1] = Math.round(tg * lum);
    px[i + 2] = Math.round(tb * lum);
  }
  const c = document.createElement("canvas");
  c.width = r.w;
  c.height = r.h;
  // (willReadFrequently: a CPU-side canvas; toDataURL on a GPU one stalls on a readback per glyph)
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  ctx.putImageData(new ImageData(px, r.w, r.h), 0, 0);
  return c.toDataURL("image/png");
}

type Deadline = { timeRemaining(): number; didTimeout?: boolean };
const ric = typeof window !== "undefined" ? (window as Window & { requestIdleCallback?: (cb: (d: Deadline) => void, o?: { timeout: number }) => number }).requestIdleCallback : undefined;

/**
 * Make queued tints in slices: a frame slice (<= 8 ms) while a visible placeholder waits for one, else
 * idle slices (<= 10 ms, 6 ms when the idle callback timed out) for the background pretint. A waiting
 * placeholder never sits behind a pending idle callback: it gets its own frame slice.
 */
let rafPending = false;
let idlePending = false;
/** Returns false when the atlas is not loaded yet (the queue waits and retries). */
function slice(budget: number): boolean {
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < budget) {
    const key = queue[0];
    if (done.has(key)) {
      queue.shift();
      continue;
    }
    const bar = key.indexOf("|");
    const url = tintNow(Number(key.slice(0, bar)), key.slice(bar + 1));
    if (url === null) return false;
    queue.shift();
    done.set(key, url);
    for (const w of waiting.get(key) ?? []) w(url);
    waiting.delete(key);
  }
  return true;
}
/** The atlas is still loading (boot): try the queue again a little later. */
let retryPending = false;
function retryLater(): void {
  if (retryPending) return;
  retryPending = true;
  setTimeout(() => {
    retryPending = false;
    pump();
  }, 400);
}
function pump(): void {
  if (!queue.length || retryPending) return;
  if (waiting.size && !rafPending && typeof requestAnimationFrame === "function") {
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (slice(8)) pump();
      else retryLater();
    });
    return;
  }
  if (rafPending || idlePending) return;
  idlePending = true;
  const run = (d?: Deadline) => {
    idlePending = false;
    if (slice(d && !d.didTimeout ? Math.max(2, Math.min(10, d.timeRemaining())) : 6)) pump();
    else retryLater();
  };
  // (a hub that animates all the time has little true idle: the timeout keeps the pretint moving)
  if (ric) ric(run, { timeout: 150 });
  else setTimeout(run, 16);
}

/** Cached tinted frame (data URL), or "" while it is still being made. */
export function glyphNow(frame: number, tint: string): string {
  return done.get(`${frame}|${tint}`) ?? "";
}

/** Tinted `board_glyph` frame as a PNG data URL ("" when the atlas has no glyph art). */
export function glyph(frame: number, tint: string): Promise<string> {
  const key = `${frame}|${tint}`;
  const hit = done.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise<string>((resolve) => {
    const w = waiting.get(key);
    if (w) w.push(resolve);
    else waiting.set(key, [resolve]);
    // (a visible placeholder waits on it: ahead of the background pretint)
    const at = queue.indexOf(key);
    if (at > 0) queue.splice(at, 1);
    if (at !== 0) queue.unshift(key);
    pump();
  });
}

/** Queue tints in the background (board.ts: every board pair, at boot), so a first open finds them made. */
export function pretint(pairs: Iterable<readonly [number, string]>): void {
  for (const [f, t] of pairs) {
    const key = `${f}|${t}`;
    if (!done.has(key) && !queue.includes(key)) queue.push(key);
  }
  pump();
}

/** `<img>` placeholder that `fillGlyphs` (or `setGlyph`) fills with the tinted frame. */
export function glyphImg(frame: number, tint: string, cls = "px gly"): string {
  const now = glyphNow(frame, tint);
  return `<img class="${cls}" data-glyph="${frame}" data-tint="${tint}" alt="" draggable="false"${now ? ` src="${now}"` : ""}>`;
}

/** Point an existing glyph <img> at another frame / tint (async when not cached yet). */
export function setGlyph(el: HTMLImageElement, frame: number, tint: string): void {
  if (el.dataset.glyph === String(frame) && el.dataset.tint === tint && el.getAttribute("src")) return;
  el.dataset.glyph = String(frame);
  el.dataset.tint = tint;
  const now = glyphNow(frame, tint);
  if (now) {
    el.src = now;
    return;
  }
  void glyph(frame, tint).then((url) => {
    // (a later setGlyph may have retargeted it meanwhile)
    if (url && el.dataset.glyph === String(frame) && el.dataset.tint === tint) el.src = url;
  });
}

/** Fill every unfilled glyph placeholder under `root`. */
export function fillGlyphs(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLImageElement>("img[data-glyph]")) {
    if (el.getAttribute("src")) continue;
    setGlyph(el, Number(el.dataset.glyph), el.dataset.tint ?? "#ffffff");
  }
}
