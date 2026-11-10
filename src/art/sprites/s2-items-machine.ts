/**
 * The Merch Machine (owner: s2-items): `ui_merch_machine` 64x80 x4, the
 * pastel capsule machine that idles in the middle of every gacha tab.
 *
 * A glass dome packed with glowing two-tone capsules on a pink body whose
 * "face" is the heart-shaped coin slot (left eye), the crank (right eye) and
 * the speaker grille smile (the Copium Exchange shop keeper). Under it, the
 * 'NOT A SLOT MACHINE' sticker and the dispenser chute.
 *   f0-1 idle glow (sparkles / glints swap, soft pink glow pulse)
 *   f2 crank turning
 *   f3 dispensing (flap open, a capsule pops out)
 */
import type { SpriteDef } from "../format";
import { Cv, GLOW, LIGHT, hash, inHeart, micro, rgba, sparkle, spr } from "../sprites/s2-items-util";

const shade = (dx: number, dy: number) => dx * LIGHT[0] + dy * LIGHT[1]; // + = lit

const W = 64;
const H = 80;
const DX = 31.5; // dome centre
const DY = 21;
const DR = 17;

/** Capsule colours: [dark, mid, light] for the coloured top half. */
const CAPS: [string, string, string][] = [
  ["P", "p", "q"],
  ["E", "e", "l"],
  ["Y", "y", "z"],
  ["U", "u", "v"],
  ["I", "i", "j"],
  ["C", "c", "a"],
  ["O", "o", "y"],
];

function capsule(cx: number, cy: number, r: number, k: [string, string, string], glint: boolean): Cv {
  const c = new Cv(W, H);
  c.disc(cx, cy, r, (x, y) => {
    const l = shade(x - cx, y - cy);
    if (y < cy) return l > 1.2 ? k[2] : l > -1 ? k[1] : k[0];
    return l > 0.5 ? "w" : l > -1.5 ? "W" : "g";
  });
  c.outline("1");
  c.set(cx - 1, cy - 2, glint ? "w" : k[2]);
  return c;
}

/** Sticker lettering: the micro font, but with a 4-wide N and a 1-wide "!" so the words read at 1x. */
const STK: Record<string, string[]> = {
  N: ["x..x", "xx.x", "x.xx", "x..x", "x..x"],
  "!": ["x", "x", "x", ".", "x"],
};
function sticker(c: Cv, s: string, y: number, k: string): void {
  const width = (ch: string) => (STK[ch] ? STK[ch][0].length : ch === " " ? 2 : 3);
  let total = -1;
  for (const ch of s) total += width(ch) + 1;
  let pen = Math.round(DX - total / 2);
  for (const ch of s) {
    if (STK[ch]) {
      const g = STK[ch];
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < g[yy].length; xx++) if (g[yy][xx] === "x") c.set(pen + xx, y + yy, k);
    } else micro(c, ch, pen, y, k);
    pen += width(ch) + 1;
  }
}

function machine(f: number): Cv {
  const c = new Cv(W, H);

  // ---------------------------------------------------------------- glow pulse (behind everything)

  // ---------------------------------------------------------------- feet + body
  c.rect(12, 74, 9, 4, (x, y) => (y > 75 ? "Q" : "P"));
  c.rect(43, 74, 9, 4, (x, y) => (y > 75 ? "Q" : "P"));
  c.rect(7, 38, 50, 37, (x, y) => {
    if (x < 10) return x === 7 ? "q" : "t";
    if (x > 52) return x === 56 ? "Q" : "P";
    if (y > 72) return "p";
    return x > 46 ? "p" : "q";
  });
  // rounded bottom corners
  for (const [x, y] of [[7, 74], [56, 74], [7, 73], [56, 73], [8, 74], [55, 74]] as const) c.set(x, y, ".");

  // ---------------------------------------------------------------- dome: glass + packed capsules
  c.disc(DX, DY, DR, (x, y) => (shade(x - DX, y - DY) > 6 ? "%" : "@"));
  const spots: [number, number][] = [];
  for (let row = 0; row < 4; row++) {
    const y = 33 - row * 6;
    const off = row % 2 ? 3.5 : 0;
    for (let x = 10 + off; x <= 54; x += 7) {
      if (Math.hypot(x - DX, y - DY) > DR - 4.2) continue;
      spots.push([x, y]);
    }
  }
  // back rows first so the front rows overlap them
  spots.sort((a, b) => a[1] - b[1]);
  spots.forEach(([x, y], i) => {
    const k = CAPS[Math.floor(hash(i, 7, 3) * CAPS.length)];
    const glint = (i + f) % 3 === 0;
    c.put(capsule(x, y, 3.4, k, glint), 0, 0);
  });
  // a lone capsule falling inside the dome on the dispensing frame
  if (f === 3) c.put(capsule(DX, 16, 3.4, CAPS[2], true), 0, 0);
  // glass rim + highlight arc
  c.each((x, y, k) => {
    const d = Math.hypot(x - DX, y - DY);
    if (d > DR + 0.5 && d <= DR + 1.5 && y < 36) return "1";
    if (d > DR - 0.6 && d <= DR + 0.5 && y < 36) return shade(x - DX, y - DY) > 0 ? "a" : "C";
    if (d > DR - 4 && d < DR - 2.2) {
      const a = Math.atan2(y - DY, x - DX);
      if (a > -2.75 && a < -1.85) return "w";
    }
    return null;
  });
  c.pts([[22, 13], [21, 15], [20, 17]], "w");

  // ---------------------------------------------------------------- topper: little pink cap with a heart
  c.ellipse(DX, 4.5, 7, 2.6, (x, y) => (shade(x - DX, y - 4.5) > 1 ? "q" : "p"));
  c.shape(
    (x, y) => inHeart(x, y, DX, 1.6, 2.6),
    (x, y) => (shade(x - DX, y - 1.6) > 0.6 ? "q" : "r"),
  );
  // collar (gold trim band where the dome meets the body)
  c.rect(5, 35, 54, 5, (x, y) => (y === 35 ? "z" : y === 39 ? "O" : x < 9 ? "z" : x > 54 ? "Y" : "y"));

  c.outline("1");
  // idle glow pulse round the dome (only in empty space, after the outline)
  if (f === 1 || f === 3)
    c.each((x, y, k) => {
      if (k !== "." || y > 36) return null;
      const d = Math.hypot(x - DX, y - DY);
      return d < DR + 3 ? "+" : d < DR + 4.5 ? "-" : null;
    });

  // collar studs
  for (let x = 10; x <= 54; x += 6) c.set(x, 37, "w");

  // ---------------------------------------------------------------- face: coin slot (left eye)
  c.shape(
    (x, y) => inHeart(x, y, 18, 47, 6.2),
    (x, y) => (shade(x - 18, y - 47) > 1.6 ? "z" : shade(x - 18, y - 47) > -2 ? "y" : "Y"),
  );
  c.selout({}, "1", false, (x, y) => y > 39 && y < 56 && x < 28);
  c.rect(17, 44, 2, 6, "0");
  c.set(17, 44, "2").set(15, 43, "w").set(14, 44, "w");

  // ---------------------------------------------------------------- face: crank (right eye)
  const KX = 45.5;
  const KY = 47;
  c.disc(KX, KY, 6, (x, y) => (shade(x - KX, y - KY) > 1.5 ? "w" : shade(x - KX, y - KY) > -2.5 ? "W" : "g"));
  c.disc(KX, KY, 2, "G");
  c.selout({}, "1", false, (x, y) => y > 39 && y < 56 && x > 36);
  // handle: a bar from the hub to a pink knob; rotated on the crank frame
  const ang = f === 2 ? Math.PI * 0.2 : -Math.PI * 0.3;
  const ex = KX + Math.cos(ang) * 6.5;
  const ey = KY + Math.sin(ang) * 6.5;
  c.line(KX, KY, ex, ey, "g");
  c.line(KX + 1, KY, ex + 1, ey, "G");
  const knob = new Cv(W, H);
  knob.disc(ex, ey, 2.2, (x, y) => (shade(x - ex, y - ey) > 0 ? "q" : "p"));
  knob.outline("1");
  knob.set(ex - 1, ey - 1, "w");
  c.put(knob, 0, 0);
  c.set(KX, KY, "1");
  if (f === 2) {
    // motion arcs round the crank
    c.pts([[53, 41], [54, 42], [55, 44]], "w");
    c.pts([[38, 53], [37, 52], [36, 50]], "w");
  }

  // ---------------------------------------------------------------- speaker grille smile
  for (let x = 25; x <= 38; x += 2) {
    const y = Math.round(51 - ((x - 31.5) * (x - 31.5)) / 14);
    c.set(x, y, "1");
  }
  c.set(24, 49, "b").set(39, 49, "b"); // blush

  // ---------------------------------------------------------------- the sticker: NOT A SLOT / MACHINE
  const st = new Cv(W, H);
  st.rect(11, 55, 42, 13, "w");
  st.rect(11, 67, 42, 1, "W");
  st.rect(52, 55, 1, 13, "W");
  st.set(52, 67, ".").set(51, 67, "."); // peeled corner
  st.outline("1");
  st.set(51, 67, "g");
  sticker(st, "NOT A SLOT", 56, "r");
  sticker(st, "MACHINE!", 62, "r");
  c.put(st, 0, 0);

  // ---------------------------------------------------------------- dispenser chute
  const open = f === 3;
  c.rect(23, 69, 18, 6, "1");
  c.rect(24, 70, 16, 4, open ? "2" : "j");
  if (!open) {
    c.rect(24, 70, 16, 1, "w");
    c.rect(24, 73, 16, 1, "i");
    c.set(31, 72, "i").set(32, 72, "i");
  } else {
    c.rect(24, 70, 16, 1, "0");
    // flap swung up + the capsule popping out
    c.rect(24, 68, 16, 1, "j");
    c.put(capsule(32, 74, 4.2, CAPS[0], true), 0, 0);
  }

  // ---------------------------------------------------------------- sparkles (swap between idle frames)
  const sp: [number, number][][] = [
    [
      [6, 10],
      [58, 24],
      [14, 30],
    ],
    [
      [57, 8],
      [5, 26],
      [48, 30],
    ],
    [
      [6, 10],
      [57, 28],
    ],
    [
      [10, 70],
      [53, 72],
      [57, 8],
      [5, 22],
    ],
  ];
  for (const [x, y] of sp[f]) sparkle(c, x, y, "w", f === 3 ? "z" : "q", true);
  return c;
}

export const sprites: SpriteDef[] = [
  spr("ui_merch_machine", W, H, [0, 1, 2, 3].map(machine), "center", {
    pal: { ...GLOW, "+": rgba("#ff7ab8", 0.22), "-": rgba("#ff7ab8", 0.1), "%": rgba("#bafff6", 0.35), "@": rgba("#bafff6", 0.18) },
    fps: 3,
  }),
];
