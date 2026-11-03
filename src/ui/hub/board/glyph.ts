/**
 * Board / talent glyphs: the 24 white 8x8 `board_glyph` frames (art manifest
 * order: might, max HP, regen, armor, move, cooldown, area, amount, projectile
 * speed, duration, pickup, crit, crit damage, luck, XP, coins, gem find, dash
 * cooldown, curse, reroll / banish / skip / cards, slot, revive, dash charge,
 * overdrive / chest / elite) recoloured per use. The white pixels take the
 * tint, the dark outline stays, so a glyph reads on any star. Tinted frames
 * are PNG data URLs made once on a tiny canvas and cached (async: the source
 * frame has to decode first); `<img data-glyph data-tint>` placeholders are
 * filled by `fillGlyphs`.
 */
import type { RunFlag } from "../../../game/run-config";
import type { NodeEffect, StatKey } from "../../../meta/board/types";
import { hasArt, sprite } from "../../dom";

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
const pending = new Map<string, Promise<string>>();

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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
  let p = pending.get(key);
  if (p) return p;
  const src = hasArt("board_glyph") ? sprite("board_glyph", frame) : "";
  if (!src || typeof document === "undefined") return Promise.resolve("");
  p = new Promise<string>((resolve) => {
    const im = new Image();
    const finish = () => {
      try {
        const w = im.naturalWidth || 8;
        const h = im.naturalHeight || 8;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(src);
        ctx.drawImage(im, 0, 0);
        const d = ctx.getImageData(0, 0, w, h);
        const [r, g, b] = rgb(tint);
        for (let i = 0; i < d.data.length; i += 4) {
          if (d.data[i + 3] === 0) continue;
          // white / light pixels take the tint (keeping their shade); the dark outline stays
          const lum = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 765;
          if (lum < 0.45) continue;
          d.data[i] = Math.round(r * lum);
          d.data[i + 1] = Math.round(g * lum);
          d.data[i + 2] = Math.round(b * lum);
        }
        ctx.putImageData(d, 0, 0);
        const url = c.toDataURL("image/png");
        done.set(key, url);
        resolve(url);
      } catch {
        resolve(src);
      } finally {
        pending.delete(key);
      }
    };
    im.onload = finish;
    im.onerror = () => {
      pending.delete(key);
      resolve("");
    };
    im.src = src;
  });
  pending.set(key, p);
  return p;
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
