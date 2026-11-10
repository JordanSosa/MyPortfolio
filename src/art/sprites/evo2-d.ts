/**
 * Second evolutions, package D (docs/content/weapons.md §8.3): Senpai, Magical Girl #47, Isekai-kun,
 * Truck-kun and the kotatsu.
 *
 *   fx_heartbreak              16x16 x3   Who Are You Again?: a heart cracking (f0 cracked, f1-2 the halves fall apart)
 *   fx_skip                    24x10      Skip Intro: the "SKIP >>" pop
 *   fx_parcel                   8x8  x2   Free Delivery: the cardboard box a pulled enemy wears (f1 = bounced up)
 *   w_nabe                     24x16 x3   All-You-Can-Eat Nabe: the bubbling hot pot (stands on w_kotatsu's table)
 *   icon_who_are_you_again / icon_skip_intro / icon_holding_back / icon_free_delivery /
 *   icon_all_you_can_eat_nabe  16x16      card / HUD / wiki icons
 *
 * "Holding Back" Fireball has no world sprite of its own (w_fireball at 0.6 scale, by design).
 */
import type { SpriteDef } from "../format";
import type { ManifestEntry } from "../manifest";
import { Cv, GLOW, I16, iconRow, row, spr, twinkle } from "./evo2-util";
import { inHeart, micro } from "./s2-items-util";

// ---------------------------------------------------------------- Who Are You Again?
/** A pink heart broken down a zigzag: each half outlined on its own and moved `gap` px apart (and `drop` px down). */
function brokenHeart(c: Cv, cx: number, cy: number, s: number, gap: number, drop: number): Cv {
  for (const side of [-1, 1]) {
    const m = new Cv(c.w, c.h);
    m.shape(
      (x, y) => inHeart(x, y, cx, cy, s) && (x < cx + [0.5, 1.5, 0.5, -0.5][y & 3] ? -1 : 1) === side,
      (x, y) => (x - cx + (y - cy) < -s * 0.55 ? "q" : x - cx + (y - cy) > s * 0.7 ? "P" : "p"),
    );
    m.outline("1");
    c.put(m, side * gap, side < 0 ? drop : drop + (gap > 0 ? 1 : 0));
  }
  return c;
}

function fxHeartbreak(f: number): Cv {
  const c = brokenHeart(new Cv(16, 16), 7.5, 6.5 + f, 5, f, f);
  if (f === 0) c.set(5, 4, "w").set(4, 5, "w");
  // a tear from the crack once it opens
  if (f === 1) c.set(8, 13, "v");
  if (f === 2) c.set(8, 15, "v").set(7, 12, "u");
  return c;
}

function iconWho(): Cv {
  const c = brokenHeart(I16(), 6.5, 7, 4, 1, 0);
  c.set(4, 5, "w");
  // the question, in a speech-mark white
  const q = new Cv(16, 16);
  q.pts([[12, 9], [13, 9], [11, 10], [14, 10], [14, 11], [13, 12], [12, 12], [12, 14]], "w");
  q.outline("1");
  c.put(q, 0, 0);
  return twinkle(c, "tr");
}

// ---------------------------------------------------------------- Skip Intro
/** A right-pointing play triangle, 3 px wide and 5 tall, top-left at (x, y). */
function play(c: Cv, x: number, y: number, k: string, lit: string): void {
  c.pts([[x, y], [x, y + 1], [x, y + 2], [x, y + 3], [x, y + 4], [x + 1, y + 1], [x + 1, y + 2], [x + 1, y + 3], [x + 2, y + 2]], k);
  c.set(x, y, lit).set(x, y + 1, lit);
}

function fxSkip(): Cv {
  const c = new Cv(24, 10);
  let x = micro(c, "SK", 1, 2, "w");
  c.pts([[x, 2], [x, 3], [x, 4], [x, 5], [x, 6]], "w");
  x = micro(c, "P", x + 2, 2, "w");
  play(c, 16, 2, "y", "z");
  play(c, 20, 2, "y", "z");
  c.outline("1");
  return c;
}

function iconSkip(): Cv {
  const c = I16();
  // a pink ribbon tail behind the button (the skipped sequence)
  c.pts([[1, 12], [2, 13], [3, 13], [4, 14], [5, 14], [6, 13], [7, 13]], "p");
  c.pts([[2, 12], [3, 12], [5, 13]], "q");
  // skip-forward: two mint triangles and the bar
  const tone = (_x: number, y: number) => (y < 7 ? "a" : y > 9 ? "C" : "c");
  const tri = (x0: number) => c.shape((x, y) => x >= x0 && x <= x0 + 4 && Math.abs(y - 8) <= 4 - (x - x0) * 1.2, tone);
  tri(1);
  tri(6);
  c.rect(11, 4, 2, 9, tone);
  c.outline("1");
  c.set(1, 5, "w").set(6, 5, "w");
  return twinkle(c, "tr");
}

// ---------------------------------------------------------------- "Holding Back" Fireball
function iconHolding(): Cv {
  const c = I16();
  // a small, perfectly ordinary fireball (the base icon's, two sizes down), tail licking up-left
  c.each((x, y) => {
    const dx = x - 6.4;
    const dy = y - 5.4;
    const back = Math.max(0, -(dx + dy) / 1.4);
    const r = 3.1 + back * 0.22 + (back > 0 ? Math.sin((dx - dy) * 1.3) * 0.6 : 0);
    const d = Math.hypot(dx, dy);
    if (d > r) return null;
    const core = Math.hypot(dx - 0.6, dy - 0.6);
    if (core < 1.1) return "w";
    if (core < 2) return "z";
    if (d < r - 1.2) return "y";
    return d < r - 0.5 ? "o" : "r";
  });
  c.outline("1");
  // the tag: he says it is Lv.1
  const t = new Cv(16, 16);
  t.rect(3, 9, 12, 7, "w");
  t.rect(3, 15, 12, 1, "W");
  t.set(3, 9, ".").set(3, 15, ".");
  t.outline("1");
  micro(t, "LV1", 4, 10, "r");
  c.put(t, 0, 0);
  return twinkle(c, "tr");
}

// ---------------------------------------------------------------- Free Delivery
/** A taped cardboard box: (x, y) = its top-left, w x h, lit from the top-left. */
function box(c: Cv, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, (px, py) => (py === y ? "B" : px === x + w - 1 || py === y + h - 1 ? "H" : "h"));
  // packing tape down the middle, over the lid
  const t = x + Math.floor(w / 2) - 1;
  c.rect(t, y, 2, h, (_px, py) => (py === y ? "w" : "W"));
}

function fxParcel(f: number): Cv {
  const c = new Cv(8, 8);
  box(c, 1, 2 - f, 6, 5);
  c.outline("1");
  return c;
}

function iconDelivery(): Cv {
  const c = I16();
  box(c, 5, 6, 10, 8);
  // a red "fragile" label
  c.rect(11, 10, 3, 2, "r");
  c.outline("1");
  // pull chevrons: the parcel is on its way to the bumper
  const m = new Cv(16, 16);
  m.pts([[3, 7], [2, 8], [1, 9], [2, 10], [3, 11]], "y");
  m.pts([[3, 8], [2, 9], [3, 10]], "z");
  m.outline("1");
  c.put(m, 0, 0, { under: true });
  return twinkle(c, "tr");
}

// ---------------------------------------------------------------- All-You-Can-Eat Nabe
/** An earthen hot pot: (cx, top) = the centre of its rim, half-width rx. Broth bits flip with `f`. */
function pot(c: Cv, cx: number, top: number, rx: number, f: number): void {
  const by = top + rx * 0.42;
  // the bowl (dark glaze, lit from the top-left) and its two lug handles
  c.ellipse(cx, by, rx - 0.6, rx * 0.5, (x, y) => (x - cx + (y - by) * 2 < -rx * 0.6 ? "o" : x - cx > rx * 0.45 ? "d" : "O"));
  c.rect(Math.round(cx - rx - 0.5), Math.round(by - 1), 2, 2, "O");
  c.rect(Math.round(cx + rx - 0.5), Math.round(by - 1), 2, 2, "d");
  // the rim and the broth
  c.ellipse(cx, top, rx, rx * 0.26, "h");
  c.ellipse(cx, top, rx - 1.4, rx * 0.16, (x) => ((Math.round(x) + f) % 5 === 0 ? "z" : "y"));
  // dinner: tofu, greens, a carrot flower (they bob a pixel each frame)
  const k = ["w", "e", "r", "l", "w"];
  for (let i = 0; i < k.length; i++) {
    const x = Math.round(cx - rx + 2.5 + i * ((rx * 2 - 5) / (k.length - 1)));
    c.set(x, Math.round(top - ((i + f) % 3 === 0 ? 1 : 0)), k[i]);
  }
}

/** Steam curls over (x, y): three rising wisps, one step per frame. */
function steam(c: Cv, x: number, y: number, f: number): void {
  for (let i = 0; i < 3; i++) {
    const h = (i + f) % 3;
    const sx = x + (i - 1) * 4 + [0, 1, 0][h];
    c.set(sx, y - h * 2, "%").set(sx + (h & 1 ? -1 : 1), y - h * 2 - 1, "@");
    if (h === 2) c.set(sx, y - 5, "@");
  }
}

function wNabe(f: number): Cv {
  const c = new Cv(24, 16);
  // (a pot for two: it shares the kotatsu's table with whoever sits there)
  pot(c, 11.5, 10, 6.6, f);
  c.outline("1");
  steam(c, 11, 6, f);
  return c;
}

function iconNabe(): Cv {
  const c = I16();
  pot(c, 7, 8.5, 5.6, 0);
  c.outline("1");
  c.pts([[4, 5], [5, 4], [4, 3], [8, 5], [9, 4], [8, 3], [8, 2]], "W");
  c.set(5, 2, "w").set(9, 1, "w");
  return twinkle(c, "tr");
}

export const sprites: SpriteDef[] = [
  spr("fx_heartbreak", 16, 16, [0, 1, 2].map(fxHeartbreak), "center"),
  spr("fx_skip", 24, 10, [fxSkip()], "center"),
  spr("fx_parcel", 8, 8, [0, 1].map(fxParcel), "center"),
  spr("w_nabe", 24, 16, [0, 1, 2].map(wNabe), "feet", { pal: GLOW, fps: 5 }),
  spr("icon_who_are_you_again", 16, 16, [iconWho()], "center"),
  spr("icon_skip_intro", 16, 16, [iconSkip()], "center"),
  spr("icon_holding_back", 16, 16, [iconHolding()], "center"),
  spr("icon_free_delivery", 16, 16, [iconDelivery()], "center"),
  spr("icon_all_you_can_eat_nabe", 16, 16, [iconNabe()], "center"),
];

export const manifest: ManifestEntry[] = [
  row("fx_heartbreak", 16, 16, 3, "Who Are You Again?: a pink heart cracking down a zigzag; f0 cracked, f1-2 the halves fall apart with a tear"),
  row("fx_skip", 24, 10, 1, "Skip Intro: the 'SKIP >>' pop (white micro letters, two yellow play triangles, plum outline)"),
  row("fx_parcel", 8, 8, 2, "Free Delivery: a taped cardboard box worn by a pulled enemy; f1 = bounced a pixel up"),
  row("w_nabe", 24, 16, 3, "All-You-Can-Eat Nabe: an earthen hot pot (broth, tofu, greens, a carrot) with rising steam, 3-frame bubble loop; stands on the kotatsu", "feet"),
  iconRow("icon_who_are_you_again", "Evolution: Who Are You Again? (Notice-Me Sparkles + Heart Locket) - a broken pink heart and a white '?', gold twinkle"),
  iconRow("icon_skip_intro", "Evolution: Skip Intro (Henshin Burst + Wish Charm) - a mint skip-forward button over a pink ribbon tail, gold twinkle"),
  iconRow("icon_holding_back", "Evolution: 'Holding Back' Fireball (Cheat Fireball + Twin Charm) - a small ordinary fireball with an 'LV1' tag, gold twinkle"),
  iconRow("icon_free_delivery", "Evolution: Free Delivery (Horn of Reincarnation + Magnet Star) - a taped parcel with yellow pull chevrons, gold twinkle"),
  iconRow("icon_all_you_can_eat_nabe", "Evolution: All-You-Can-Eat Nabe (Kotatsu of Sloth + Bento Box) - a steaming earthen hot pot, gold twinkle"),
];
