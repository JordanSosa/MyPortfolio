/**
 * Season 2 16x16 icons (owner: s2-items): the 12 new weapons, their 12
 * evolutions and the 8 new passives (level-up cards, HUD, codex).
 *
 * House style (same as src/art/sprites/icons.ts): one bold silhouette per
 * icon, 1px plum outline (auto, so the art keeps a 1px margin), 2-3 tone
 * shading lit from the top-left, one white glint. Evolution icons are more
 * ornate (gold trims, extra motifs) and carry the gold twinkle in a corner.
 */
import type { SpriteDef } from "../format";
import { Cv, GLOW, I16, LIGHT, icon, inHeart, inStar, micro, shadedStar, sparkle, spr, twinkle } from "../sprites/s2-items-util";

const shade = (dx: number, dy: number) => dx * LIGHT[0] + dy * LIGHT[1]; // + = lit

/** Shaded heart (pink by default) centred at (cx, cy). */
function heart(c: Cv, cx: number, cy: number, s: number, keys: [string, string, string] = ["P", "p", "q"]): Cv {
  return c.shape(
    (x, y) => inHeart(x, y, cx, cy, s),
    (x, y) => {
      const l = shade(x - cx, y - cy) / s;
      return l > 0.45 ? keys[2] : l > -0.3 ? keys[1] : keys[0];
    },
  );
}

/** Origami crane (faces right) built from flat planes; `o` = offset, `sc` = scale. */
function craneAt(c: Cv, ox: number, oy: number, sc: number, gold: boolean, wingUp = true): void {
  const lit = gold ? "z" : "w";
  const mid = gold ? "y" : "W";
  const dark = gold ? "Y" : "g";
  const P = (x: number, y: number): [number, number] => [ox + x * sc, oy + y * sc];
  c.poly([P(1.5, 5.5), P(5, 4.6), P(9, 5.2), P(7.5, 7.8), P(3.5, 7.8)], (x, y) => (y < oy + 6 * sc ? lit : y < oy + 7 * sc ? mid : dark));
  c.line(...P(1, 5), ...P(0, 3.6), mid);
  c.line(...P(8, 5), ...P(9, 2), lit);
  c.line(...P(9, 1.4), ...P(10.4, 1.4), lit);
  c.set(...P(11, 2.2), mid);
  const apex: [number, number] = wingUp ? [3, 0] : [0.5, 3];
  c.poly([P(3, 5.4), P(7.6, 5.4), P(apex[0] + 0.5, apex[1] + 0.5)], (x, y) => (Math.abs(x - (ox + apex[0] * sc)) + Math.abs(y - (oy + apex[1] * sc)) < 3 * sc ? mid : lit));
  c.line(...P(5, 5), ...P(apex[0], apex[1]), mid);
}

// =========================================================================== weapons

function darkFlameDragon(): Cv {
  // the tiny salamander (bottom-left) breathing a flame up and to the right
  const c = icon(
    `
...ooo.....
..oyyoo....
..oyw0oo...
..oo00ooo..
..ooobo....
.OooooO....
oOBBooO....
yoBBBO.....
z.OooO.....
..O..O.....`,
    0,
    5,
  );
  c.outline("1");
  // wing
  c.put(
    `
.1..
1i1.
1Ii1
.1I1`,
    0,
    6,
    { under: true },
  );
  // flame: orange with a violet outline drawn on by Kuro
  const fl = new Cv(16, 16).put(
    `
....oo.
..oyyoo
.oyzzyo
oyzzyo.
oyyoo..
.oo....`,
    9,
    3,
  );
  fl.outline("I");
  c.put(fl, 0, 0);
  c.set(9, 9, "o").set(10, 9, "y");
  return c;
}

function teapotTempest(): Cv {
  const c = icon(
    `
.....oo.......
....o..y......
....y.oO......
.....oO.......
..pqqqqqqp....
.pyYooooOOp...
.Wppppppppg...
.wwwwwwwwgWWW.
.wwwwwwwwgW.W.
..wwwwwwgWWW..
...wwwwgWW....
WWWWWWWWWWWWg.
.gggggggggggg.`,
    1,
    1,
  );
  c.outline("1");
  c.set(3, 9, "w");
  return c;
}

function missileSwarm(): Cv {
  const c = I16();
  const M = `
.U.....
UwwwwWu
UWWWWgu
.U.....`;
  const at: [number, number][] = [
    [9, 0],
    [7, 6],
    [9, 11],
  ];
  for (const [x, y] of at) {
    const m = new Cv(16, 16).put(M, x, y);
    m.outline("1");
    c.put(m, 0, 0);
  }
  // tangled spaghetti trails: wavy lines that cross each other
  const trail = (x0: number, y0: number, ph: number, amp: number) => {
    for (let x = x0; x >= 0; x--) {
      const y = Math.round(y0 + Math.sin((x0 - x) * 0.85 + ph) * amp);
      if (c.get(x, y) === ".") c.set(x, y, (x0 - x) % 3 === 0 ? "B" : "F");
    }
  };
  trail(7, 2, 0, 2.2);
  trail(5, 8, 1.6, 2.6);
  trail(7, 13, 3.0, 2.0);
  return c;
}

function bakaHarisen(): Cv {
  const c = I16();
  // pleated paper head: a wedge widening towards the top-right; pleats run along the fan
  c.poly([[5.5, 9.5], [9.5, 13.5], [15, 5], [7.5, 1]], (x, y) => {
    const a = Math.atan2(y - 13, x - 3);
    const pleat = Math.floor((a + 4) / 0.2) % 2 === 0;
    const far = x - y > 4;
    return pleat ? (far ? "W" : "w") : far ? "g" : "W";
  });
  // red-taped grip
  c.pts([[5, 10], [4, 11], [3, 12], [6, 11], [5, 12], [4, 13], [2, 13], [3, 14]], "r");
  c.pts([[4, 12], [3, 13]], "R");
  c.outline("1");
  // anger mark (top-left)
  c.put(
    `
.r.r
rr.r
....
rr.r`.replace(/\n/g, "\n"),
    1,
    1,
  );
  c.set(9, 4, "w");
  return c;
}

function noticeMeSparkles(): Cv {
  const c = I16();
  heart(c, 7.6, 8.4, 5.0);
  c.outline("1");
  c.set(5, 6, "w").set(6, 6, "w").set(5, 7, "w");
  sparkle(c, 13, 2, "w", "q");
  sparkle(c, 2, 2, "w", "z");
  sparkle(c, 14, 13, "w", "q");
  c.set(1, 12, "q");
  return c;
}

function henshinBurst(): Cv {
  const c = I16();
  // gold wand from the bottom-left
  c.line(2, 14, 7, 9, "y");
  c.line(3, 14, 8, 9, "Y");
  // mint heart head (hand-placed so it reads as a heart, not a leaf)
  c.put(
    `
.aa..aa.
awaaaacc
aaaaaccC
aaaacccC
.acccCC.
..cCCC..
...CC...`,
    6,
    1,
  );
  c.outline("1");
  c.set(7, 3, "w");
  // pink ribbons streaming from the heart
  c.pts([[6, 11], [5, 12], [5, 13], [6, 14], [7, 14]], "p");
  c.pts([[10, 10], [11, 11], [12, 11], [13, 12], [14, 12]], "p");
  c.pts([[7, 13], [13, 11]], "q");
  sparkle(c, 2, 3, "w", "z");
  return c;
}

function cheatFireball(): Cv {
  const c = I16();
  // round fireball, tail licking up-left
  c.each((x, y) => {
    const dx = x - 6.8;
    const dy = y - 6.2;
    const back = Math.max(0, -(dx + dy) / 1.4);
    const r = 4.6 + back * 0.35 + (back > 0 ? Math.sin((dx - dy) * 1.3) * 0.7 : 0);
    const d = Math.hypot(dx, dy);
    if (d > r) return null;
    const core = Math.hypot(dx - 0.8, dy - 0.8);
    if (core < 1.6) return "w";
    if (core < 2.8) return "z";
    if (d < r - 1.6) return "y";
    if (d < r - 0.6) return "o";
    return "r";
  });
  c.outline("1");
  // the tag: "Lv.9999" squeezed into a white price tag
  const t = new Cv(16, 16);
  t.rect(3, 9, 13, 7, "w");
  t.rect(3, 15, 13, 1, "W");
  t.set(3, 9, ".").set(3, 15, ".");
  t.outline("1");
  t.set(4, 12, "1");
  micro(t, "999", 5, 10, "r");
  c.put(t, 0, 0);
  return c;
}

function hornOfReincarnation(): Cv {
  const c = I16();
  // red squeeze bulb
  c.ball(3.6, 9.4, 2.8, 3.0, "Rrrp");
  // brass tube + flaring bell
  c.rect(6, 8, 4, 2, "y");
  c.rect(6, 9, 4, 1, "Y");
  c.poly([[9, 8], [13.5, 4], [13.5, 13.5], [9, 10.5]], (x, y) => (y < 7 ? "z" : y > 11 ? "Y" : "y"));
  c.outline("1");
  c.set(2, 8, "w").set(12, 6, "w");
  // sound lines
  c.pts([[15, 6], [15, 7]], "y");
  c.pts([[15, 10], [15, 11]], "y");
  c.set(14, 2, "z").set(14, 15, "z");
  return c;
}

function bubbleTea(): Cv {
  const c = icon(
    `
........pq.
.......pP..
......pP...
..WWWWpPWW.
.WwwwwpPwwW
.gWWWWWWWWg
.hhhhhhhhhH
.hhhhhhhhhH
..hhhhhhhH.
..hd0hhd0H.
..d00hd00H.
...0dd00H..
...gggggg..`,
    2,
    1,
  );
  c.outline("1");
  c.set(4, 5, "w").set(4, 8, "B");
  return c;
}

/** Origami crane facing right (13x10): thin tail up-left, tall folded wing, neck up-right with a hooked head, small body. */
const CRANE13 = `
......l......
.....lm......
l....lm.....l
.l..llm....lm
..l.llmm..l..
...lllmm.l...
....llmmlm...
...dllmmmd...
....ddmmd....
......dd.....`;
const crane13 = (lit: string, mid: string, dark: string) => CRANE13.replace(/l/g, lit).replace(/m/g, mid).replace(/d/g, dark);
const CRANE7 = `
..l....
..lm..l
l.lm.l.
.llml..
..dd...`;
const crane7 = (lit: string, mid: string, dark: string) => CRANE7.replace(/l/g, lit).replace(/m/g, mid).replace(/d/g, dark);

function paperCraneFlock(): Cv {
  const c = I16();
  const back = new Cv(16, 16).put(crane7("w", "W", "g"), 8, 1);
  back.outline("1");
  const front = new Cv(16, 16).put(crane13("w", "W", "g"), 1, 5);
  front.outline("1");
  c.put(back, 0, 0);
  c.put(front, 0, 0);
  sparkle(c, 2, 2, "w", "q");
  return c;
}

function idolLightstick(): Cv {
  const c = I16();
  // glowing tube diagonal
  c.line(5, 12, 11, 6, "q");
  c.line(6, 12, 12, 6, "p");
  c.line(5, 11, 11, 5, "w");
  c.set(12, 5, "w").set(12, 4, "q").set(13, 5, "q");
  // handle
  c.line(2, 15, 4, 13, "G");
  c.line(3, 15, 5, 13, "g");
  c.set(4, 14, "2");
  c.outline("1");
  c.halo(["+"]);
  // music note (top-left)
  c.put(
    `
..11.
.1yy1
.1y1z
11y1.
1yy1.
1yy1.
.11..`,
    0,
    0,
  );
  return c;
}

function kotatsuIcon(c: Cv, x: number, y: number, w: number): void {
  // quilt
  c.poly([[x + 1, y + 3], [x + w - 1, y + 3], [x + w, y + 7.5], [x, y + 7.5]], (xx, yy) => (yy > y + 6 ? "R" : (xx - x) % 4 === 1 && yy === y + 5 ? "B" : xx < x + 2 ? "p" : xx > x + w - 2 ? "R" : "r"));
  // table top
  c.rect(x, y + 1, w + 1, 2, "H");
  c.rect(x, y + 1, w + 1, 1, "h");
}

function kotatsuOfSloth(): Cv {
  const c = I16();
  kotatsuIcon(c, 1, 7, 13);
  // mikan on top
  c.ball(8, 6, 2.0, 1.8, "Oooy");
  c.set(8, 3, "e").set(9, 3, "l");
  c.outline("1");
  c.set(7, 5, "z");
  // Zzz
  c.put(
    `
jjj.
.j..
jjj.`,
    1,
    1,
  );
  c.put(
    `
jj
jj`,
    5,
    0,
  );
  return c;
}

// =========================================================================== evolutions

function unsealedAbyssDragon(): Cv {
  const c = I16();
  // ornate gold frame (ring) behind
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 8);
    if (d > 7.4 || d < 6.0) return null;
    return shade(x - 7.5, y - 8) > 0 ? "y" : "Y";
  });
  // dragon head facing right inside
  c.ball(7, 8.4, 4.4, 4.0, "Xxxf");
  c.ball(10.8, 9.8, 2.4, 1.8, "Xxxf");
  c.pts([[5, 4], [4, 3], [3, 2], [8, 4], [8, 3], [9, 2]], "g");
  c.outline("0");
  // ring gems
  c.set(7, 1, "p").set(1, 8, "c").set(14, 8, "c").set(7, 15, "p");
  // glowing magenta eye + grin
  c.pts([[7, 6], [8, 6]], "0");
  c.pts([[7, 7], [8, 7], [7, 8], [8, 8]], "p");
  c.set(7, 7, "w").set(8, 8, "q");
  c.pts([[9, 11], [10, 11], [11, 11]], "0");
  c.set(10, 12, "w").set(12, 9, "0");
  c.set(4, 6, "G");
  twinkle(c, "tr");
  return c;
}

function eternalTeaParty(): Cv {
  const c = I16();
  // small flying teapot, tilted, pouring
  const pot = new Cv(16, 16);
  pot.ball(7, 8, 4.6, 3.6, "gWww", { spec: "w" });
  pot.ellipse(7, 4.4, 2.6, 0.9, "W");
  pot.ball(7, 3, 1.0, 1.0, "Pp");
  pot.poly([[10.5, 9], [14.2, 4.4], [14.8, 5.6], [12, 10.5]], "W");
  for (let y = 5; y <= 11; y++) for (let x = 0; x <= 3; x++) if (Math.abs(Math.hypot(x - 3, y - 8) - 2.4) < 0.7) pot.set(x, y, "W");
  pot.set(6, 7, "p").set(5, 7, "q").set(7, 7, "q").set(6, 6, "q").set(6, 8, "P");
  pot.outline("1");
  c.put(pot.rotate(0.35, 7, 8), 0, 0);
  // tea pouring + golden sparkles
  c.pts([[14, 9], [14, 10], [14, 11], [13, 12], [13, 13]], "o");
  c.set(14, 10, "y");
  sparkle(c, 2, 14, "w", "y");
  sparkle(c, 10, 14, "z", "Y");
  twinkle(c, "tr");
  return c;
}

function alDente(): Cv {
  const c = I16();
  // missile, diagonal (nose up-right)
  c.poly([[3, 12], [10, 5], [12, 7], [5, 14]], (x, y) => (x + y < 16 ? "w" : "W"));
  c.pts([[2, 11], [3, 10], [6, 15], [5, 14]], "U");
  // meatball tip
  c.ball(12, 4.2, 2.6, 2.4, "dHHh");
  c.outline("1");
  c.set(11, 3, "h").set(13, 5, "R").set(12, 6, "r").set(14, 4, "r");
  // spaghetti wrapped round it (pale yellow strands crossing over the outline)
  const sp: [number, number][] = [[3, 9], [4, 10], [5, 11], [6, 12], [7, 13], [6, 8], [7, 9], [8, 10], [9, 11], [9, 7], [10, 8], [11, 9], [2, 13], [1, 14]];
  for (const [x, y] of sp) c.set(x, y, "z");
  c.set(4, 10, "B").set(8, 10, "B");
  // flame exhaust
  c.set(1, 15, "o").set(2, 15, "y");
  twinkle(c, "tl");
  return c;
}

function dereDereHarisen(): Cv {
  const c = I16();
  // heart-shaped pleated fan head
  c.shape(
    (x, y) => inHeart(x, y, 8.6, 6.6, 5.2),
    (x, y) => {
      const a = Math.atan2(y - 13, x - 8.6);
      const pleat = Math.floor((a + 4) / 0.32) % 2 === 0;
      const l = shade(x - 8.6, y - 6.6);
      if (l > 3) return "q";
      return pleat ? "p" : "P";
    },
  );
  // grip
  c.pts([[8, 12], [8, 13], [7, 14], [9, 12], [9, 13], [8, 14]], "r");
  c.set(8, 14, "R");
  c.outline("1");
  c.set(6, 4, "w").set(5, 5, "w");
  // tiny hearts
  c.set(1, 12, "p").set(2, 12, "p").set(1, 11, "q");
  twinkle(c, "tr");
  return c;
}

function shoujoFilter(): Cv {
  const c = I16();
  // screentone dot disc behind
  c.disc(7.5, 7.5, 7.2, (x, y) => ((x + y * 2) % 3 === 0 && (y % 2 === 0) ? "j" : null));
  // rose
  const cx = 7.5;
  const cy = 7;
  c.disc(cx, cy, 4.4, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const ph = (((r * 0.7 - a / (Math.PI * 2)) % 1) + 1) % 1;
    if (ph < 0.22) return "R";
    if (r < 1.4) return "R";
    return dx + dy < -1 ? "p" : "r";
  });
  c.poly([[4, 13], [6.5, 10.5], [7.5, 12], [5, 14.5]], "e");
  c.poly([[11, 13], [8.5, 10.5], [8, 12], [10.5, 14.5]], "E");
  c.outline("1");
  c.set(6, 4, "w");
  sparkle(c, 13, 3, "w", "q");
  sparkle(c, 2, 2, "w", "j");
  twinkle(c, "br");
  return c;
}

function infiniteHenshinLoop(): Cv {
  const c = I16();
  for (let i = 0; i <= 200; i++) {
    const a = (i / 200) * Math.PI * 2;
    const den = 1 + Math.sin(a) * Math.sin(a);
    const x = Math.round(7.5 + (6.6 * Math.cos(a)) / den);
    const y = Math.round(7.0 + ((6.6 * Math.sin(a) * Math.cos(a)) / den) * 1.8);
    c.set(x, y, y < 7 ? "y" : "Y");
    c.set(x, y + 1, "Y");
  }
  // ribbon tails from the crossing
  c.pts([[7, 10], [6, 11], [6, 12], [5, 13], [5, 14]], "y");
  c.pts([[8, 10], [9, 11], [9, 12], [10, 13], [11, 14]], "Y");
  c.outline("1");
  for (const [x, y] of [[6, 5], [7, 6], [7, 7], [8, 8], [8, 9]] as [number, number][]) c.set(x, y, "z");
  c.set(3, 4, "w").set(11, 4, "z");
  twinkle(c, "tr");
  return c;
}

function cheatMeteor(): Cv {
  const c = I16();
  // fire tail (up-left) + rock head (down-right)
  c.each((x, y) => {
    const u = (x + y - 16) / Math.SQRT2; // along the fall direction
    const v = (x - y) / Math.SQRT2; // across
    if (u > 4.5 || u < -9) return null;
    const w = 2.0 + (u + 9) * 0.22;
    if (Math.abs(v) > w) return null;
    const t = Math.abs(v) / w;
    if (t < 0.35) return u > -3 ? "z" : "y";
    if (t < 0.7) return "o";
    return "r";
  });
  c.ball(10, 10, 3.6, 3.4, "2dHh");
  c.pts([[9, 11], [10, 10], [11, 11]], "o");
  c.outline("1");
  c.set(9, 8, "h");
  // the absurd number tag
  const t = new Cv(16, 16);
  t.rect(1, 10, 13, 5, "w");
  t.rect(1, 14, 13, 1, "W");
  t.outline("1");
  micro(t, "999", 2, 10, "R");
  t.set(14, 10, "1").set(14, 11, "R").set(14, 12, "R").set(14, 14, "R").set(14, 13, "1");
  c.put(t, 0, 0);
  twinkle(c, "tr");
  return c;
}

function isekaiRushHour(): Cv {
  const c = I16();
  // ghostly (aqua-tinted) truck facing right
  c.rect(2, 5, 8, 6, "a");
  c.rect(2, 5, 8, 1, "w");
  c.rect(2, 10, 8, 1, "c");
  c.rect(10, 7, 4, 4, "a");
  c.rect(10, 7, 4, 1, "w");
  c.rect(11, 8, 3, 2, "U");
  c.set(11, 8, "w").set(13, 8, "w");
  c.pts([[4, 7], [5, 8], [6, 7]], "p");
  c.ball(4.5, 11.5, 1.4, 1.4, "Ggg");
  c.ball(11.5, 11.5, 1.4, 1.4, "Ggg");
  c.outline("C");
  c.set(13, 9, "y");
  // speed lines streaming behind
  c.pts([[0, 6], [1, 6], [0, 9], [1, 9], [0, 12]], "a");
  c.pts([[3, 3], [4, 3], [5, 3]], "a");
  twinkle(c, "tr");
  return c;
}

const WAVE = `
..ww......ww..
.wBBw....wBBw.
wBhhBwwwwBhhBw
hhHhhhBBBhhHhh
hHHhhhhhhhhHHh
.HHHHHHHHHHHH.`;
function tapiocaTsunami(): Cv {
  const c = I16();
  // giant glossy boba riding the crest of a milk-tea wave
  c.ball(7.5, 5.4, 4.6, 4.4, "22ddH", { spec: "w", specAt: 0.9 });
  c.put(WAVE, 1, 9);
  c.outline("1");
  c.pts([[5, 3], [6, 2]], "h"); // glossy streak next to the spec
  c.pts([[10, 7], [11, 6]], "H"); // bounce light bottom-right
  // splash droplets flying off
  c.set(1, 7, "B").set(14, 7, "B").set(0, 5, "h");
  twinkle(c, "tr");
  return c;
}

function thousandCraneWish(): Cv {
  const c = I16();
  c.put(crane13("z", "y", "Y"), 1, 5);
  c.outline("1");
  c.set(6, 6, "w");
  // star above the crane's head
  shadedStar(c, 12, 3.2, 3, 1.4, { rimLit: "z", rimDark: "O", body: "y", inner: "y", core: "w" }, { coreR: 0.6 });
  sparkle(c, 14, 13, "w", "y");
  twinkle(c, "tl");
  return c;
}

function soldOutDomeTour(): Cv {
  const c = I16();
  // the dome: broad roof lit from the top-left, panel ribs, a lit stage mouth, a crowd of lightsticks
  c.ellipse(7.5, 14, 7.2, 7, (x, y) => (y > 13 ? null : shade(x - 7.5, y - 14) > 2.5 ? "j" : shade(x - 7.5, y - 14) > -1.5 ? "i" : "I"));
  c.rect(0, 13, 16, 2, "2");
  c.outline("1");
  c.line(7, 8, 4, 12, "I");
  c.line(8, 8, 11, 12, "I");
  c.line(7, 7, 8, 7, "w");
  c.rect(6, 11, 4, 2, "z");
  c.rect(6, 11, 4, 1, "w");
  for (let x = 1; x <= 14; x += 2) c.set(x, 14, ["p", "c", "y", "l"][(x >> 1) % 4]);
  // spotlight beams fanning out of the roof (no outline: they're light)
  c.line(5, 7, 1, 1, "z");
  c.line(10, 7, 14, 1, "a");
  c.line(6, 7, 3, 1, "&");
  c.line(9, 7, 12, 1, "^");
  twinkle(c, "tl");
  return c;
}

function eternalWinterBreak(): Cv {
  const c = I16();
  kotatsuIcon(c, 1, 8, 13);
  // mikan bowl
  c.ellipse(7.5, 8, 3.6, 1.2, "W");
  c.ball(6, 6.4, 1.6, 1.5, "Ooy");
  c.ball(9, 6.4, 1.6, 1.5, "Ooy");
  c.ball(7.5, 4.8, 1.6, 1.5, "Ooy");
  c.outline("1");
  // snowflake (top-left)
  c.pts([[2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [0, 3], [1, 3], [3, 3], [4, 3], [1, 2], [3, 4], [1, 4], [3, 2]], "v");
  c.set(2, 3, "w");
  twinkle(c, "tr");
  return c;
}

// =========================================================================== passives

function plotArmor(): Cv {
  const c = I16();
  // heater shield silhouette: gold rim, rolled script inside
  const inShield = (x: number, y: number) => {
    if (y < 2 || y > 14.5) return false;
    const hw = y < 9 ? 6.4 : 6.4 - (y - 9) * 1.1;
    return Math.abs(x - 7.5) <= hw;
  };
  c.shape(inShield, (x, y) => {
    const edge = !inShield(x - 1.4, y) || !inShield(x + 1.4, y) || !inShield(x, y - 1.2) || !inShield(x, y + 1.2);
    if (edge) return shade(x - 7.5, y - 8) > 0 ? "y" : "Y";
    // paper with text lines; rolled edges top and bottom
    if (y === 4 || y === 12) return "F";
    return (y % 2 === 1 && x > 3 && x < 11) ? "g" : "B";
  });
  // red bookmark ribbon hanging down the right
  c.pts([[11, 3], [11, 4], [11, 5], [11, 6], [11, 7], [11, 8], [11, 9], [10, 10], [12, 10]], "r");
  c.pts([[11, 3], [11, 4]], "R");
  c.outline("1");
  // star on the crest
  shadedStar(c, 7.5, 7.6, 3.0, 1.4, { rimLit: "z", rimDark: "O", body: "y", inner: "y", core: "z" }, { coreR: 0 });
  c.set(3, 3, "w");
  return c;
}

function mainCharacterAura(): Cv {
  const c = I16();
  // sunburst rays
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r1 = i % 2 === 0 ? 7.4 : 6.2;
    for (let r = 5.2; r <= r1; r += 0.5) c.set(7.5 + Math.cos(a) * r, 7.8 + Math.sin(a) * r, i % 2 === 0 ? "y" : "o");
  }
  // radiant ring
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.8);
    if (d < 3.9 || d > 5.2) return null;
    return shade(x - 7.5, y - 7.8) > 0 ? "z" : "y";
  });
  c.outline("1");
  // the empty silhouette head (anyone could be the main character)
  c.disc(7.5, 6.6, 1.9, "2");
  c.ellipse(7.5, 10.6, 2.8, 1.4, "2");
  c.set(7, 6, "G");
  sparkle(c, 14, 1, "w", "z");
  return c;
}

function bentoBox(): Cv {
  const c = I16();
  // box body
  c.rect(1, 7, 14, 7, "P");
  c.rect(2, 8, 12, 5, "B");
  c.rect(1, 13, 14, 1, "Q");
  // divider + onigiri (white triangle with nori) + octopus sausage (red) + leaf
  c.line(8, 8, 8, 12, "P");
  c.poly([[2.6, 12.6], [5, 7.8], [7.4, 12.6]], "w");
  c.rect(4, 11, 2, 2, "x");
  c.ball(11, 10.4, 2.1, 1.8, "Rrrp");
  c.pts([[9, 12], [10, 13], [11, 12], [12, 13], [13, 12]], "r");
  c.set(10, 9, "w").set(12, 9, "w");
  // lid, ajar (tilted above the box)
  c.poly([[2, 5.5], [14, 1.5], [15, 3.5], [3, 7.5]], (x, y) => (x + y * 2 < 14 ? "q" : "p"));
  c.outline("1");
  c.set(5, 4, "w");
  c.set(10, 10, "0").set(12, 10, "0");
  return c;
}

function speedLines(): Cv {
  const c = I16();
  // three streaks of different lengths
  c.rect(1, 4, 8, 2, "w");
  c.rect(0, 8, 9, 2, "w");
  c.rect(3, 12, 6, 2, "w");
  c.rect(1, 5, 8, 1, "g");
  c.rect(0, 9, 9, 1, "g");
  c.rect(3, 13, 6, 1, "g");
  // tiny star at the front
  shadedStar(c, 11.6, 8.2, 3.8, 1.8, { rimLit: "z", rimDark: "Y", body: "y", inner: "y", core: "z" }, { coreR: 0 });
  c.outline("1");
  c.set(11, 6, "w");
  return c;
}

function innerMonologue(): Cv {
  const c = I16();
  // cloud thought bubble
  for (const [x, y, r] of [
    [5, 5.5, 3.2],
    [9.5, 4.5, 3.4],
    [11.5, 7.5, 2.8],
    [7.5, 8.2, 3.2],
    [3.5, 8, 2.4],
  ] as [number, number, number][])
    c.disc(x, y, r, (xx, yy) => (shade(xx - 7.5, yy - 6.5) < -2.5 ? "W" : "w"));
  // trailing bubbles
  c.disc(3, 13, 1.2, "w");
  c.set(1, 15, "w");
  c.outline("1");
  // "..."
  c.set(5, 7, "2").set(7, 7, "2").set(9, 7, "2").set(11, 7, "2");
  // sweat drop
  c.pts([[14, 1], [14, 2], [13, 2], [15, 2], [13, 3], [14, 3], [15, 3]], "u");
  c.set(14, 0, "1").set(13, 1, "1").set(15, 1, "1").set(12, 2, "1").set(12, 3, "1").set(14, 4, "1").set(13, 4, "1").set(15, 4, "1");
  c.set(13, 2, "v");
  return c;
}

function trainingMontage(): Cv {
  const c = I16();
  // dumbbell (diagonal-ish, horizontal for readability)
  c.rect(4, 9, 8, 2, "g");
  c.rect(4, 10, 8, 1, "G");
  c.rect(1, 6, 3, 8, "G");
  c.rect(12, 6, 3, 8, "G");
  c.rect(1, 6, 1, 8, "W");
  c.rect(12, 6, 1, 8, "g");
  c.rect(2, 6, 1, 8, "g");
  // red hachimaki tied round the bar, tails flowing up
  c.rect(7, 8, 2, 4, "r");
  c.pts([[8, 7], [9, 6], [10, 5], [11, 4], [9, 7], [10, 6]], "r");
  c.pts([[7, 7], [6, 5], [6, 4], [7, 3], [6, 6]], "r");
  c.set(7, 11, "R").set(8, 11, "R");
  c.outline("1");
  c.set(7, 9, "q").set(2, 7, "w");
  // sweat drop
  c.pts([[13, 1], [12, 2], [13, 2], [14, 2], [13, 3]], "u");
  c.set(12, 2, "v");
  return c;
}

function friendshipBracelet(): Cv {
  const c = I16();
  const cols = ["p", "c", "y", "i", "l"];
  c.each((x, y) => {
    const d = Math.hypot((x - 7.5) / 6.4, (y - 8.4) / 5.0);
    if (d > 1.0 || d < 0.66) return null;
    const a = Math.atan2(y - 8.4, x - 7.5);
    const band = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 15);
    // woven diagonal stripes
    return cols[(band + (x + y)) % cols.length];
  });
  // heart bead (bottom left) and star bead (bottom right)
  heart(c, 5, 12.2, 2.6, ["R", "r", "p"]);
  shadedStar(c, 11, 12.6, 2.8, 1.3, { rimLit: "z", rimDark: "Y", body: "y", inner: "y", core: "z" }, { coreR: 0 });
  c.outline("1");
  c.set(4, 11, "w").set(3, 4, "w");
  return c;
}

function chibiCharm(): Cv {
  const c = I16();
  // keyring (pink) + chain
  c.each((x, y) => {
    const d = Math.hypot(x - 11.5, y - 3.2);
    return d <= 2.6 && d >= 1.4 ? (x + y < 14 ? "q" : "p") : null;
  });
  c.pts([[10, 6], [9, 7]], "g");
  // the chibi: round head with blonde hair, dot eyes, blush, tiny body
  c.ball(6.5, 9.8, 4.6, 4.2, "kstt");
  c.each((x, y, k) => (k !== "." && y < 9 && Math.hypot(x - 6.5, y - 9.8) > 2.2 && y < 8 + (x % 3 === 0 ? 1 : 0) ? (x < 5 ? "z" : "F") : null));
  c.outline("1");
  c.set(5, 10, "0").set(8, 10, "0").set(5, 9, "0").set(8, 9, "0");
  c.set(5, 9, "w");
  c.set(4, 11, "b").set(9, 11, "b");
  c.set(6, 12, "k").set(7, 12, "k");
  sparkle(c, 14, 10, "w", "q");
  return c;
}

export const sprites: SpriteDef[] = [
  spr("icon_dark_flame_dragon", 16, 16, [darkFlameDragon()], "center"),
  spr("icon_teapot_tempest", 16, 16, [teapotTempest()], "center"),
  spr("icon_micro_missile_swarm", 16, 16, [missileSwarm()], "center"),
  spr("icon_baka_harisen", 16, 16, [bakaHarisen()], "center"),
  spr("icon_notice_me_sparkles", 16, 16, [noticeMeSparkles()], "center"),
  spr("icon_henshin_burst", 16, 16, [henshinBurst()], "center"),
  spr("icon_cheat_fireball", 16, 16, [cheatFireball()], "center"),
  spr("icon_horn_of_reincarnation", 16, 16, [hornOfReincarnation()], "center"),
  spr("icon_bubble_tea_cannon", 16, 16, [bubbleTea()], "center"),
  spr("icon_paper_crane_flock", 16, 16, [paperCraneFlock()], "center"),
  spr("icon_idol_lightstick_wave", 16, 16, [idolLightstick()], "center", { pal: GLOW }),
  spr("icon_kotatsu_of_sloth", 16, 16, [kotatsuOfSloth()], "center"),
  spr("icon_unsealed_abyss_dragon", 16, 16, [unsealedAbyssDragon()], "center"),
  spr("icon_eternal_tea_party", 16, 16, [eternalTeaParty()], "center"),
  spr("icon_al_dente_armageddon", 16, 16, [alDente()], "center"),
  spr("icon_dere_dere_harisen", 16, 16, [dereDereHarisen()], "center"),
  spr("icon_shoujo_filter", 16, 16, [shoujoFilter()], "center"),
  spr("icon_infinite_henshin_loop", 16, 16, [infiniteHenshinLoop()], "center"),
  spr("icon_cheat_meteor", 16, 16, [cheatMeteor()], "center"),
  spr("icon_isekai_rush_hour", 16, 16, [isekaiRushHour()], "center"),
  spr("icon_tapioca_tsunami", 16, 16, [tapiocaTsunami()], "center"),
  spr("icon_thousand_crane_wish", 16, 16, [thousandCraneWish()], "center"),
  spr("icon_sold_out_dome_tour", 16, 16, [soldOutDomeTour()], "center", { pal: GLOW }),
  spr("icon_eternal_winter_break", 16, 16, [eternalWinterBreak()], "center"),
  spr("icon_plot_armor", 16, 16, [plotArmor()], "center"),
  spr("icon_main_character_aura", 16, 16, [mainCharacterAura()], "center"),
  spr("icon_bento_box", 16, 16, [bentoBox()], "center"),
  spr("icon_speed_lines", 16, 16, [speedLines()], "center"),
  spr("icon_inner_monologue", 16, 16, [innerMonologue()], "center"),
  spr("icon_training_montage", 16, 16, [trainingMontage()], "center"),
  spr("icon_friendship_bracelet", 16, 16, [friendshipBracelet()], "center"),
  spr("icon_chibi_charm", 16, 16, [chibiCharm()], "center"),
];

void inStar;
