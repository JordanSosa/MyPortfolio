/**
 * Second evolutions, package C (docs/content/weapons.md §8): Kuro, Pudding, Aoi and Akane's second routes.
 *
 *   w_abyss_claw               40x32 x4   Unbandaged Right Arm: three flaming claw arcs sweeping top -> bottom
 *                                          (orange flames, the violet outline Kuro drew on); f2-3 break up
 *   fx_bandage                 8x8 x2     a scrap of bandage (the named attack throws them)
 *   icon_unbandaged_right_arm  16x16
 *   w_saucer                   12x12 x4   Table-Flip Tea Service: a flung cup on its saucer, seen from above
 *                                          (the handle goes round; spun by code as well)
 *   icon_table_flip_service    16x16
 *   w_budget_missile           24x16 x2   Final Episode Budget Missile: one chubby missile with a face and a
 *                                          sweat drop (f1 = the other exhaust flicker, the drop a pixel on)
 *   fx_budget_crater                  32x20 x2   its crater: a scorched ellipse, embers alight (f1 = the other embers)
 *   icon_budget_missile        16x16
 *   w_drill_fan                32x16 x4   Tsun Tsun Drill Harisen: the fan rolled into a paper drill, pointing
 *                                          right; the spiral pleats run one step per frame
 *   icon_tsun_tsun_drill       16x16
 */
import type { SpriteDef } from "../format";
import type { ManifestEntry } from "../manifest";
import { Cv, GLOW, I16, iconRow, row, spr, twinkle } from "./evo2-util";

// ============================================================================ Unbandaged Right Arm

/**
 * One claw arc: a crescent around (cx, cy), thickest in the middle of its sweep. `to` = how far the sweep
 * has come (0..1 of ±62 deg, top first), `fade` = 0 solid, 1 / 2 broken up.
 */
function clawArc(c: Cv, cx: number, cy: number, R: number, thick: number, to: number, fade: number): void {
  const lim = 1.08;
  c.each((x, y) => {
    const dx = x - cx;
    const dy = (y - cy) * 1.25;
    const d = Math.hypot(dx, dy);
    const phi = Math.atan2(dy, dx);
    if (phi < -lim || phi > -lim + 2 * lim * to) return null;
    const k = phi / lim;
    // a fang: fat behind the leading tip, a thin tail where the sweep began
    const lead = (phi + lim) / (2 * lim * to);
    const t = thick * Math.sqrt(Math.max(0, 1 - k * k)) * (0.35 + 0.65 * lead);
    const s = (R - d) / Math.max(0.01, t);
    if (s < 0 || s > 1) return null;
    if (fade && (x * 3 + y * 5 + fade) % (fade === 1 ? 4 : 2) === 0) return null;
    if (fade === 2) return s < 0.4 ? "O" : "*";
    if (s < 0.42) return "o";
    if (s < 0.74) return fade ? "o" : "y";
    return fade ? "y" : "z";
  });
}

function abyssClaw(f: number): Cv {
  const c = new Cv(40, 32);
  const to = [0.55, 1, 1, 1][f];
  const fade = [0, 0, 1, 2][f];
  // three talons, the middle one the longest
  clawArc(c, 2, 16, 23, 4.2, to, fade);
  clawArc(c, 4, 16, 30, 5.2, to, fade);
  clawArc(c, 8, 16, 31, 4.2, to, fade);
  // "black" flames: the outline is felt-tip violet, drawn on
  if (f < 2) c.selout({ o: "I", y: "I", z: "I" }, "I");
  // licks of flame off the outer edge
  if (f === 1) c.pts([[37, 9], [38, 15], [37, 22], [34, 5], [35, 26]], "y");
  if (f === 0) c.pts([[34, 4], [36, 8]], "y");
  return c;
}

const BANDAGE = [
  `
........
.wW.....
..wWw...
...wWW..
....wWg.
.....Wg.
........
........`,
  `
........
....wW..
...wW...
..wWw...
..WW....
.gW.....
.g......
........`,
];

function iconUnbandagedRightArm(): Cv {
  const c = I16();
  // the arm, raised: forearm bottom-left -> a clawed hand top-right, wrapped in orange flame
  c.put(
    `
.........o......
........oyo.o...
.......oyzyoyo..
......oyzzzyzo..
......oysssyyo..
.....oyssstsyo..
.....oyksssyo...
......okssso....
.....WWwkko.....
....WwwWW.......
...ksWwW........
..ksssW.........
..ksss..........
...kk...........`,
    0,
    1,
  );
  c.outline("1");
  // talons (pale, on the outline) and the loose end of the bandage
  c.pts([[8, 4], [10, 4], [12, 5]], "z");
  c.pts([[2, 9], [1, 8], [0, 7], [1, 6]], "w");
  c.set(0, 6, "W");
  return twinkle(c, "br");
}

// ============================================================================ Table-Flip Tea Service

function saucer(f: number): Cv {
  const c = new Cv(12, 12);
  // saucer: white china, a pink band, lit from the top-left
  c.disc(5.5, 5.5, 5.2, (x, y) => {
    const d = Math.hypot(x - 5.5, y - 5.5);
    if (d > 4.4) return x + y > 12 ? "g" : "W";
    if (d > 3.5) return "p";
    return "w";
  });
  // the cup on it: a rim, the tea
  c.disc(5.5, 5.5, 2.6, (x, y) => (Math.hypot(x - 5.5, y - 5.5) > 1.7 ? (x + y > 11 ? "W" : "w") : "o"));
  c.set(5, 5, "y");
  // the handle goes round
  const a = (f / 4) * Math.PI * 2 + 0.4;
  c.set(Math.round(5.5 + Math.cos(a) * 3.6), Math.round(5.5 + Math.sin(a) * 3.6), "P");
  // a drop of tea thrown off the rim, opposite the handle
  c.set(Math.round(5.5 - Math.cos(a) * 4.6), Math.round(5.5 - Math.sin(a) * 4.6), "o");
  c.outline("1");
  return c;
}

function iconTableFlipService(): Cv {
  const c = I16();
  // the table, mid-flip (legs in the air), bottom-left
  c.put(
    `
.H.......
.Hh......
..Hh..H..
..dHh.Hh.
...dHhhH.
....dHHh.
.....dHh.
......dH.`,
    0,
    7,
  );
  // the cup and saucer leaving it, top-right
  c.put(
    `
..wwww.
.wooowP
.wwwwwP
..WWW..
pWWWWWp
.ggggg.`,
    7,
    3,
  );
  c.outline("1");
  // speed lines behind the cup, tea in the air
  c.pts([[4, 4], [5, 5], [3, 6]], "W");
  c.pts([[9, 1], [11, 1]], "o");
  c.set(10, 0, "y");
  return twinkle(c, "br");
}

// ============================================================================ Final Episode Budget Missile

function budgetMissile(f: number): Cv {
  const c = new Cv(24, 16);
  // a chubby body with a round nose (right); every bit of the budget is on screen
  c.ball(12, 8, 8.4, 5.2, "gWWwww", { bias: 0.1 });
  // nose cone and tail band in Aoi's blue
  c.each((x, y, k) => {
    if (k === ".") return null;
    if (x >= 18) return y < 8 ? "u" : "U";
    if (x <= 5) return y < 8 ? "u" : "U";
    return null;
  });
  // fins
  c.pts([[3, 2], [4, 2], [4, 3], [5, 3], [3, 13], [4, 13], [4, 12], [5, 12]], "U");
  c.pts([[2, 2], [2, 13]], "u");
  c.outline("1");
  // the face: two big eyes, a brave little mouth, blush
  c.pts([[11, 6], [11, 7], [15, 6], [15, 7]], "0");
  c.pts([[11, 6], [15, 6]], "n");
  c.pts([[12, 6], [16, 6]], "w");
  c.pts([[13, 9], [14, 9]], "0");
  c.pts([[10, 9], [17, 9]], "b");
  // the sweat drop on its brow
  const sy = f ? 4 : 3;
  c.set(8, sy, "c").set(8, sy + 1, "a");
  // exhaust
  if (f === 0) c.pts([[1, 7], [1, 8], [0, 8]], "y").pts([[2, 7], [2, 8]], "z");
  else c.pts([[1, 7], [1, 8], [0, 7]], "o").pts([[2, 7], [2, 8]], "y");
  return c;
}

function crater(f: number): Cv {
  const c = new Cv(32, 20);
  c.ellipse(15.5, 9.5, 15, 9, (x, y) => {
    const u = (x - 15.5) / 15;
    const v = (y - 9.5) / 9;
    const d = Math.hypot(u, v);
    const n = (x * 7 + y * 13 + ((x * y) % 5)) % 9;
    if (d > 0.86) return n < 4 ? "!" : null;
    if (d > 0.62) return n < 1 ? "O" : "!";
    if (d > 0.3) return n === (f ? 3 : 6) ? "o" : n === (f ? 7 : 1) ? "O" : "2";
    return n === (f ? 2 : 5) ? "y" : n < 3 ? "O" : "1";
  });
  return c;
}

function iconBudgetMissile(): Cv {
  const c = I16();
  // the missile, nose up-right; fins bottom-left
  c.put(
    `
.........uu..
.......wwuuu.
......wwwwuu.
.....wwwwwwu.
....wwwwwww..
...WwwwwwW...
..uWWwwwW....
.uUWWWWW.....
.UU.UWW......
.U..UU.......
.....U.......`,
    1,
    2,
  );
  c.outline("1");
  // the face
  c.pts([[8, 6], [10, 8]], "0");
  c.set(8, 9, "b");
  // sweat drop, exhaust
  c.set(5, 5, "c");
  c.pts([[1, 13], [0, 14]], "y");
  c.set(1, 14, "o");
  return twinkle(c, "tl");
}

// ============================================================================ Tsun Tsun Drill Harisen

function drillFan(f: number): Cv {
  const c = new Cv(32, 16);
  // the rolled fan: a cone from the grip (left) to the tip (right)
  c.each((x, y) => {
    if (x < 5 || x > 30) return null;
    const t = (x - 5) / 25;
    const half = 6.4 * (1 - t) + 0.6;
    const v = (y - 7.5) / half;
    if (v < -1 || v > 1) return null;
    // spiral pleats: bands slanted across the cone, one step on per frame
    const band = Math.floor((x * 0.5 + Math.asin(v) * 2.2 + 40 - f * 0.75) / 1.5) % 2 === 0;
    if (v > 0.55) return band ? "W" : "g";
    if (v < -0.5) return band ? "w" : "W";
    return band ? "w" : "q";
  });
  // the red-taped grip
  c.rect(2, 5, 3, 6, (_x, y) => (y < 8 ? "r" : "R"));
  // a red-orange rim, like her twin-tails (the drill sits on the fx layer)
  c.selout({ r: "R", R: "R" }, "o");
  c.set(31, 7, "y").set(31, 8, "y");
  return c;
}

function iconTsunTsunDrill(): Cv {
  const c = I16();
  // the drill, tip up-right
  c.poly([[3.5, 9.5], [8.5, 14.5], [15, 2], [14, 1]], (x, y) => {
    const band = Math.floor((x - y + 20) / 2) % 2 === 0;
    const far = x + y > 17;
    return band ? (far ? "W" : "w") : far ? "g" : "q";
  });
  c.pts([[3, 11], [4, 12], [5, 13], [2, 12], [3, 13], [4, 14], [2, 13], [3, 14]], "r");
  c.pts([[3, 12], [4, 13]], "R");
  c.outline("1");
  // anger mark (top-left): she is not aiming at you
  c.put(
    `
.r.r
rr.r
....
rr.r`,
    1,
    1,
  );
  return twinkle(c, "br");
}

export const sprites: SpriteDef[] = [
  spr("w_abyss_claw", 40, 32, [0, 1, 2, 3].map(abyssClaw), "center", { pal: GLOW, fps: 18 }),
  spr("fx_bandage", 8, 8, BANDAGE, "center"),
  spr("icon_unbandaged_right_arm", 16, 16, [iconUnbandagedRightArm()], "center"),
  spr("w_saucer", 12, 12, [0, 1, 2, 3].map(saucer), "center", { fps: 16 }),
  spr("icon_table_flip_service", 16, 16, [iconTableFlipService()], "center"),
  spr("w_budget_missile", 24, 16, [0, 1].map(budgetMissile), "center", { fps: 8 }),
  spr("fx_budget_crater", 32, 20, [0, 1].map(crater), "center", { pal: GLOW, fps: 6 }),
  spr("icon_budget_missile", 16, 16, [iconBudgetMissile()], "center"),
  spr("w_drill_fan", 32, 16, [0, 1, 2, 3].map(drillFan), "center", { fps: 24 }),
  spr("icon_tsun_tsun_drill", 16, 16, [iconTsunTsunDrill()], "center"),
];

export const manifest: ManifestEntry[] = [
  row("w_abyss_claw", 40, 32, 4, "Unbandaged Right Arm: three flaming claw arcs sweeping top to bottom (pale core, orange flame, felt-tip violet outline); f0 half swept, f1 full, f2-f3 breaking up"),
  row("fx_bandage", 8, 8, 2, "Unbandaged Right Arm: a scrap of white bandage, two tumbling poses"),
  iconRow("icon_unbandaged_right_arm", "Evolution: Unbandaged Right Arm (Dark Flame Dragon + Main Character Aura) - a raised clawed hand wrapped in orange flame, a loose bandage, gold twinkle"),
  row("w_saucer", 12, 12, 4, "Table-Flip Tea Service: a flung teacup on its pink-banded saucer seen from above, tea inside; the handle goes round over the 4 frames"),
  iconRow("icon_table_flip_service", "Evolution: Table-Flip Tea Service (Teapot Tempest + Speed Lines) - a flipped table, a cup and saucer flying off it, gold twinkle"),
  row("w_budget_missile", 24, 16, 2, "Final Episode Budget Missile: one chubby white missile, blue nose and fins, a determined face with blush and a sweat drop; f1 = exhaust flicker"),
  row("fx_budget_crater", 32, 20, 2, "Final Episode Budget Missile: a scorched crater decal with glowing embers; f1 = the other embers alight"),
  iconRow("icon_budget_missile", "Evolution: Final Episode Budget Missile (Micro Missile Swarm + Big Ribbon) - a chubby missile with a face and a sweat drop, gold twinkle"),
  row("w_drill_fan", 32, 16, 4, "Tsun Tsun Drill Harisen: the paper fan rolled into a drill pointing right (spiral pleats, red-taped grip, red-orange rim); the spiral runs over the 4 frames"),
  iconRow("icon_tsun_tsun_drill", "Evolution: Tsun Tsun Drill Harisen (Baka Harisen + Speed Lines) - a pleated paper drill with a red grip and an anger mark, gold twinkle"),
];
