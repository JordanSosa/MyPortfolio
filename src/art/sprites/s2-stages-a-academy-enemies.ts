/**
 * Shoujo Academy enemies + enemy bullet (owner: s2-stages-a).
 * All face RIGHT, feet pivot (w/2, h-1); floating enemies (Love Letter, Exam
 * Paper) are drawn high in their box (code draws the ground shadow at the
 * pivot). Built like the base bestiary (enemies.ts): directional `ball`
 * bodies lit from the top-left, dark-plum outline, faces hand-pixelled on top.
 * Gameplay notes per enemy (telegraph / attack frames): docs/content/enemies.md §2.
 */
import type { SpriteDef } from "../format";
import { Pix, ball, gridSprite } from "../sprites/chars-util";

function ol(p: Pix, key = "1"): Pix {
  return p.outline(key);
}

// ============================================================================ HALL MONITOR (16x16)
// A stern round student blob: navy peaked cap (gold badge) pulled low, skin
// face with slit disapproving eyes, navy uniform lower half with a white
// collar, yellow armband on the back arm, a whistle on a red cord.
// f0-2 brisk walk, f3 WHISTLE (the dash telegraph): cheeks puffed, eyes
// squeezed, whistle blasting.
function hallMonitor(i: number): Pix {
  const p = new Pix(16, 16);
  const blow = i === 3;
  const bob = [0, -1, 0, 0][i];
  // feet (brisk 3-step: back foot forward / passing / front foot forward)
  const feet = new Pix(16, 16);
  const fx = [
    [4, 10],
    [6, 9],
    [5, 11],
    [5, 10],
  ][i];
  const fy = [
    [15, 14],
    [14, 15],
    [14, 15],
    [15, 15],
  ][i];
  for (const k of [0, 1]) feet.rect(fx[k] - 1, fy[k], 3, 1, "n").set(fx[k] - 1, fy[k], "U");
  ol(feet);
  p.put(feet, 0, 0);
  // body: one round blob - skin face on top, navy uniform below
  const b = new Pix(16, 16);
  const cx = 7.5;
  const cy = 9.6 + bob;
  const rx = blow ? 6.2 : 5.7;
  const ry = 5.0;
  const split = 11 + bob;
  ball(b, cx, cy, rx, ry, ["k", "s", "s", "t"], { only: (_x, y) => y < split });
  ball(b, cx, cy, rx, ry, ["n", "U", "U", "u"], { only: (_x, y) => y >= split });
  // white collar band with a V at the front
  for (let x = 2; x <= 13; x++) if (b.get(x, split) !== ".") b.set(x, split, x > 10 ? "W" : "w");
  b.set(10, split + 1, "w").set(11, split + 1, "W");
  b.set(10, split + 2, "y"); // gold button
  // back arm stub wearing the yellow armband
  ball(b, 2.1, split + 1.4, 1.6, 2.1, ["n", "U", "U", "u"]);
  for (let x = 0; x <= 4; x++) if (b.get(x, split + 1) !== ".") b.set(x, split + 1, x < 2 ? "z" : "y");
  for (let x = 0; x <= 4; x++) if (b.get(x, split + 2) !== "." && x < 3) b.set(x, split + 2, x < 1 ? "y" : "Y");
  ol(b);
  p.put(b, 0, 0);
  // peaked cap: crown, band, black visor jutting forward (right) over the eyes
  const cap = new Pix(16, 16);
  const ct = 2 + bob;
  ball(cap, 7.2, ct + 1.3, 4.8, 2.2, ["n", "U", "U", "u"]);
  cap.rect(3, ct + 3, 9, 1, "n");
  cap.rect(10, ct + 4, 4, 1, "0");
  cap.set(7, ct + 1, "y").set(7, ct + 2, "Y");
  ol(cap);
  p.put(cap, 0, 0);
  // face (looks right)
  const ey = ct + 6;
  if (blow) {
    // squeezed shut, straining, puffed blushing cheeks
    p.set(7, ey - 1, "1").set(8, ey, "1").set(7, ey + 1, "1");
    p.set(12, ey - 1, "1").set(11, ey, "1").set(12, ey + 1, "1");
    p.set(5, ey + 1, "b").set(6, ey + 2, "b").set(5, ey + 2, "b");
  } else {
    // slit eyes: a flat dark lid over a sliver of eye, brows pinched down
    p.set(7, ey, "0").set(8, ey, "0").set(11, ey, "0").set(12, ey, "0");
    p.set(8, ey + 1, "w").set(12, ey + 1, "w");
    p.set(7, ey + 1, "1").set(11, ey + 1, "1");
    p.set(6, ey - 1, "1").set(13, ey - 1, "1");
    p.set(5, ey + 2, "b").set(6, ey + 2, "b");
  }
  // whistle (silver) at the mouth + red cord looping to the collar
  const wy = ey + 2;
  if (blow) {
    p.put(
      `
.111.
1wgG1
.111.`,
      10,
      wy - 1,
    );
    // blast marks
    p.set(15, wy - 2, "w").set(14, wy - 3, "w").set(15, wy + 1, "w").set(15, wy, "W");
  } else {
    p.put(
      `
.11.
1wG1
.11.`,
      10,
      wy - 1,
    );
  }
  p.set(9, wy + 1, "r").set(9, wy + 2, "r");
  return p;
}

// ============================================================================ LOVE LETTER (12x10, floats)
// A pink envelope that flaps its flap like a wing; red heart seal on the
// front, dot eyes + blush. f0 flap up (pale inside showing), f1 edge-on,
// f2 flap down (closed), f3 edge-on. The body bobs against the stroke.
function loveLetter(i: number): Pix {
  const p = new Pix(12, 10);
  const pose = [0, 1, 2, 1][i];
  const bob = [1, 0, -1, 0][i];
  const y0 = 4 + bob;
  const y1 = 8 + bob;
  // body
  const b = new Pix(12, 10);
  for (let y = y0; y <= y1; y++)
    for (let x = 1; x <= 10; x++) {
      const lit = x === 1 || y === y0;
      const sh = x === 10 || y === y1;
      b.set(x, y, lit ? "t" : sh ? "p" : "q");
    }
  // back-flap folds (the V seams at the bottom corners)
  b.set(2, y1, "p").set(9, y1, "p");
  // flap
  if (pose === 0) {
    // open, pointing up: the pale lining shows, pink rim
    b.put(
      `
....qp....
...qWjp...
..qWWWjp..
.qWWWWWjp.`,
      1,
      y0 - 4,
    );
  } else if (pose === 1) {
    // edge-on: a thin lip along the top
    b.rect(1, y0 - 1, 10, 1, (x) => (x < 4 ? "t" : x > 8 ? "p" : "q"));
  }
  ol(b);
  p.put(b, 0, 0);
  if (pose === 2) {
    // closed: the flap triangle folds down over the front, its edges drawn in plum
    p.put(
      `
pwqqqqqqqp
.ptqqqqpp.
..ptqqpp..
...pPPp...`,
      1,
      y0,
    );
  }
  // heart seal (front, slightly toward the facing side)
  const sy = pose === 2 ? y0 + 2 : y0 + 1;
  p.put(
    `
r.r
rrr
.R.`,
    5,
    sy,
  );
  p.set(5, sy, "z");
  // face: eyes either side of the seal, blush under them
  const ey = y0 + (pose === 2 ? 3 : 2);
  p.set(3, ey, "0").set(9, ey, "0");
  p.set(3, ey - 1, "1").set(9, ey - 1, "1");
  p.set(2, ey + 1, "b").set(9, ey + 1, "b");
  return p;
}

// ============================================================================ TSUNDERE SLIME (16x16)
// Red slime with tiny Akane-orange spiral drill twin-tails and a red bow,
// angry brows, eyes turned AWAY (pupils on the back side). f0 rest, f1 launch
// stretch, f2 airborne, f3 blushing FLEE (face full of blush, squeezed eyes,
// sweat drop) - shown while it runs from the player.
const TS_RAMP = ["R", "R", "r", "r", "r", "r", "o"];
const TS_POSE: { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 7.5, cy: 10.6, rx: 5.6, ry: 4.2 },
  { cx: 7.5, cy: 9.0, rx: 4.6, ry: 5.4 },
  { cx: 7.5, cy: 7.8, rx: 5.1, ry: 4.7 },
  { cx: 7.5, cy: 10.8, rx: 5.5, ry: 4.0 },
];
/** Tiny spiral drills (interior; outlined when placed): two stacked coils + tip, curling outward. */
const TS_DRILL: Record<number, string> = {
  4: `
zyo
yOR
yo.
.R.`,
  5: `
zyo
yOR
.R.
yo.
.R.`,
  6: `
zyo
yOR
.R.
yo.
oR.
.R.`,
};

function tsDrill(len: number): Pix {
  return Pix.of(TS_DRILL[len], "ts drill");
}

function tsundereSlime(i: number): Pix {
  const { cx, cy, rx, ry } = TS_POSE[i];
  const flee = i === 3;
  const p = new Pix(16, 16);
  const top = Math.round(cy - ry);
  // drill twin-tails behind the body, hanging from the top sides
  const dLen = i === 1 ? 6 : i === 2 ? 4 : 5;
  // body
  const b = new Pix(16, 16);
  ball(b, cx, cy, rx, ry, TS_RAMP, { spec: "z", specAt: 0.93 });
  const rim = b.clone();
  b.each((x, y, k) => (k !== "." && !rim.solid(x, y + 1) && x < cx ? "q" : null));
  ol(b);
  p.put(b, 0, 0);
  // drill twin-tails hanging down in front of the body's upper sides
  const dPart = tsDrill(dLen);
  const dy = top + 1;
  const spread = flee ? 1 : 0;
  const dl = new Pix(16, 16);
  dl.put(dPart, Math.round(cx - rx) - 2 - spread, dy);
  dl.put(dPart.flipX(), Math.round(cx + rx) - 1 + spread, dy);
  ol(dl);
  p.put(dl, 0, 0);
  // red bow on top
  p.put(
    `
11.11
1r1r1
.1R1.`,
    Math.round(cx) - 2,
    top - 2,
  );
  // face (looks right, but the eyes are turned AWAY - pupils on the back side)
  const ey = Math.round(cy - (i === 1 ? 1.5 : 1));
  const ex0 = Math.round(cx);
  const ex1 = Math.round(cx + 3);
  if (flee) {
    p.set(ex0, ey - 1, "1").set(ex0 + 1, ey, "1").set(ex0, ey + 1, "1");
    p.set(ex1 + 1, ey - 1, "1").set(ex1, ey, "1").set(ex1 + 1, ey + 1, "1");
    for (const yy of [ey + 1, ey + 2])
      for (let x = ex0 - 2; x <= ex1 + 3; x++) {
        const k = p.get(x, yy);
        if (k !== "." && k !== "1" && k !== "0") p.set(x, yy, "b");
      }
    p.set(ex0 + 1, ey + 3, "1").set(ex0 + 2, ey + 2, "1").set(ex0 + 3, ey + 3, "1"); // wobbly mouth
    // sweat drop
    const sx = Math.round(cx + rx) + 1;
    p.set(sx, top, "1").set(sx, top + 1, "v").set(sx - 1, top + 1, "1").set(sx + 1, top + 1, "1").set(sx, top + 2, "u").set(sx, top + 3, "1");
  } else {
    // angry brows slanting down to the middle
    p.set(ex0 - 1, ey - 2, "1").set(ex0, ey - 1, "1");
    p.set(ex1 + 2, ey - 2, "1").set(ex1 + 1, ey - 1, "1");
    // eyes: white with the pupil on the back (left) side = looking away
    p.set(ex0, ey, "0").set(ex0 + 1, ey, "w").set(ex0, ey + 1, "0").set(ex0 + 1, ey + 1, "W");
    p.set(ex1, ey, "0").set(ex1 + 1, ey, "w").set(ex1, ey + 1, "0").set(ex1 + 1, ey + 1, "W");
    // pout + blush
    p.set(ex0 + 2, ey + 2, "1");
    p.set(ex0 - 1, ey + 2, "b").set(ex1 + 2, ey + 2, "b");
  }
  return p;
}

// ============================================================================ TRANSFER STUDENT (16x20)
// Tall-ish chibi: long dark hair falling over one eye, a light-blue scarf that
// flutters even indoors, navy blazer, suitcase in hand. f0-1 walk, f2
// teleport-OUT (dissolving into sparkles), f3 teleport-IN (flash of light).
function transferBase(i: number): Pix {
  const p = new Pix(16, 20);
  const step = i % 2;
  const bob = step ? -1 : 0;
  // long hair behind (back of the head down to the waist, left)
  const hb = new Pix(16, 20);
  hb.rect(3, 4 + bob, 4, 11, (x, y) => (x === 3 ? "X" : y > 12 + bob ? "X" : "x"));
  hb.set(2, 12 + bob, "X").set(2, 13 + bob, "X").set(3, 15 + bob, "X");
  ol(hb);
  p.put(hb, 0, 0);
  // scarf tail fluttering behind (left), waves between frames
  const sc = new Pix(16, 20);
  const tail = step
    ? [
        [4, 11],
        [3, 11],
        [2, 10],
        [1, 10],
        [0, 11],
      ]
    : [
        [4, 11],
        [3, 12],
        [2, 12],
        [1, 11],
        [0, 12],
      ];
  for (const [x, y] of tail) sc.set(x, y + bob, "v").set(x, y + bob + 1, "u");
  ol(sc);
  p.put(sc, 0, 0);
  // legs (walk)
  const lg = new Pix(16, 20);
  if (step) {
    lg.rect(6, 16, 2, 3, "n").rect(9, 16, 2, 2, "n");
    lg.rect(6, 18, 2, 1, "2").rect(9, 17, 3, 1, "2");
  } else {
    lg.rect(5, 16, 2, 2, "n").rect(9, 16, 2, 3, "n");
    lg.rect(4, 17, 3, 1, "2").rect(9, 18, 2, 1, "2");
  }
  ol(lg);
  p.put(lg, 0, 0);
  // body: navy blazer, white shirt front, scarf wrap at the neck
  const bd = new Pix(16, 20);
  bd.rect(5, 11 + bob, 6, 6, (x, y) => (x === 5 ? "U" : x >= 10 ? "n" : y > 14 + bob ? "n" : "U"));
  bd.rect(8, 12 + bob, 2, 3, (x) => (x === 8 ? "w" : "W"));
  bd.rect(4, 10 + bob, 8, 2, (x, y) => (y === 10 + bob ? (x < 7 ? "a" : "v") : x > 9 ? "u" : "v"));
  // front arm down to the suitcase
  bd.rect(10, 12 + bob, 2, 3, (x) => (x === 11 ? "n" : "U"));
  bd.set(11, 15 + bob, "s");
  ol(bd);
  p.put(bd, 0, 0);
  // suitcase (brown, with a lighter band and a handle)
  const sx = 10;
  const sy = 15;
  const sui = new Pix(16, 20);
  sui.rect(sx, sy + 1, 5, 3, (x, y) => (y === sy + 1 ? "h" : x === sx + 4 ? "d" : "H"));
  sui.set(sx + 2, sy + 2, "y");
  sui.set(sx + 1, sy, "d").set(sx + 2, sy, "d").set(sx + 3, sy, "d");
  ol(sui);
  p.put(sui, 0, step ? 1 : 0);
  // head
  const hd = new Pix(16, 20);
  ball(hd, 8.5, 6 + bob, 4.6, 4.4, ["k", "s", "s", "t"]);
  ol(hd);
  p.put(hd, 0, 0);
  // hair cap + long bangs sweeping over the BACK eye (left), front eye visible
  p.put(
    `
..1111111..
.1xxxxfxx1.
1xxfxxxxxx1
1xxxxxxxx11
1xxxxxx1s1.
1xxxxx1ss1.
1xxxx1sss1.
.1xx1.....`,
    3,
    1 + bob,
    { skip: "." },
  );
  // visible eye (violet, lid line, highlight) + blush, a small calm mouth
  const ey = 6 + bob;
  p.set(10, ey - 1, "1").set(11, ey - 1, "1");
  p.set(10, ey, "w").set(11, ey, "I");
  p.set(10, ey + 1, "I").set(11, ey + 1, "i");
  p.set(12, ey + 1, "b");
  p.set(11, ey + 3, "k");
  return p;
}

function transferOut(): Pix {
  // dissolve: the lower body breaks into a column of sparkles that rise
  const base = transferBase(0);
  const p = new Pix(16, 20);
  base.each((x, y, k) => {
    if (k === ".") return null;
    const keep = y < 9 || (y < 13 && (x + y) % 2 === 0) || (y >= 13 && (x * 3 + y) % 5 === 0);
    p.set(x, y, keep ? (y >= 9 ? (k === "1" ? "j" : "v") : k) : null);
    return null;
  });
  const sparks: [number, number, string][] = [
    [3, 3, "w"],
    [13, 2, "a"],
    [2, 9, "v"],
    [14, 8, "w"],
    [6, 1, "a"],
  ];
  for (const [x, y, k] of sparks) p.set(x, y, k);
  // little 4-point twinkles
  for (const [x, y] of [
    [13, 12],
    [3, 16],
  ] as const)
    p.set(x, y, "w").set(x - 1, y, "v").set(x + 1, y, "v").set(x, y - 1, "v").set(x, y + 1, "v");
  return p;
}

function transferIn(): Pix {
  // flash-in: the whole figure in pale light-blue, a vertical light seam, twinkles
  const base = transferBase(0);
  const p = new Pix(16, 20);
  const map: Record<string, string> = { "1": "U", "0": "U", "2": "u", n: "u", U: "v", X: "u", x: "v", f: "a", k: "v", s: "a", t: "w", I: "U", i: "u" };
  base.each((x, y, k) => {
    if (k === ".") return null;
    p.set(x, y, map[k] ?? (k === "w" ? "w" : "a"));
    return null;
  });
  for (let y = 0; y < 20; y += 1) if (!p.solid(8, y)) p.set(8, y, y % 3 === 0 ? "a" : null);
  for (const [x, y] of [
    [2, 4],
    [14, 6],
    [1, 14],
    [14, 15],
  ] as const)
    p.set(x, y, "w").set(x - 1, y, "a").set(x + 1, y, "a").set(x, y - 1, "a").set(x, y + 1, "a");
  return p;
}

// ============================================================================ EXAM PAPER (12x14, floats)
// A sheet with a red circled 'F-', a dog-eared corner and an angry pencil face.
// f0-3 flutter: the top of the sheet bends right / back / left / back and the
// dog-ear flaps.
/**
 * Build the flat sheet (11x13 incl. outline): red ring with a dark-red 'F' and
 * a '-' slashing through the ring, dog-ear (top-right), angry pencil face.
 */
function paperSheet(dogUp: boolean): Pix {
  const s = new Pix(11, 13);
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 11; x++) {
      const edge = x === 0 || y === 0 || x === 10 || y === 12;
      s.set(x, y, edge ? "1" : x === 9 || y === 11 ? "W" : x === 1 || y === 1 ? "w" : "w");
    }
  // ruled pencil lines (faint) on the lower half
  // red ring x=2..8, y=1..7
  for (let x = 3; x <= 7; x++) s.set(x, 1, "r").set(x, 7, "r");
  for (let y = 2; y <= 6; y++) s.set(2, y, "r").set(8, y, "r");
  // F (dark red): stem x=4, bars at x=5 on rows 2 and 4
  for (let y = 2; y <= 6; y++) s.set(4, y, "R");
  s.set(5, 2, "R").set(6, 2, "R").set(5, 4, "R");
  // '-' slashing out through the ring
  s.set(7, 4, "r").set(8, 4, "R").set(9, 4, "r");
  // angry pencil face: brows slanting in, dot eyes, zigzag frown
  s.set(2, 8, "2").set(3, 9, "2");
  s.set(8, 8, "2").set(7, 9, "2");
  s.set(4, 9, "0").set(6, 9, "0").set(4, 10, "0").set(6, 10, "0");
  s.set(3, 11, "G").set(4, 10, "G").set(5, 11, "G").set(6, 10, "G").set(7, 11, "G");
  s.set(4, 10, "0").set(6, 10, "0");
  // dog-ear (top-right corner folded down, the back of the sheet shows)
  s.set(10, 0, ".").set(9, 0, ".").set(10, 1, ".");
  if (dogUp) {
    // corner flipping up: a lighter fold standing off the sheet
    s.set(8, 0, "1").set(9, 1, "1").set(10, 2, "1");
    s.set(8, 1, "w").set(9, 2, "W");
  } else {
    s.set(8, 0, "1").set(9, 1, "1").set(10, 2, "1");
    s.set(8, 1, "g").set(9, 2, "g").set(8, 2, "G");
  }
  return s;
}

/** f0-3 flutter: the sheet waves (column offsets), the dog-ear flaps, a gentle bob. */
function examPaper(i: number): Pix {
  const sheet = paperSheet(i === 1 || i === 3);
  const wave = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  ][i];
  const bob = [0, -1, -1, 0][i];
  const p = new Pix(12, 14);
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 11; x++) {
      const k = sheet.get(x, y);
      if (k !== ".") p.set(x + 1, y + 1 + wave[x] + bob, k);
    }
  // the bend catches light / shadow along the fold
  if (i === 1) for (let y = 3; y < 12; y++) if (p.get(2, y + bob + 1) === "w") p.set(2, y + bob + 1, "W");
  if (i === 3) for (let y = 3; y < 12; y++) if (p.get(5, y + bob + 2) === "w") p.set(5, y + bob + 2, "W");
  return p;
}

// ============================================================================ STUDENT COUNCIL NINJA (16x16)
// Chibi ninja in a navy school uniform, red council armband, navy face mask,
// black ponytail streaming back. f0-1 crouch-run, f2 THROW (arm raised with a
// glinting shuriken: the 0.4 s tell), f3 smoke bomb (half dissolved).
function ninjaBase(i: number): Pix {
  const p = new Pix(16, 16);
  const step = i % 2;
  const bob = step ? 0 : 1;
  // ponytail streaming back (left)
  const pt = new Pix(16, 16);
  const tail = step
    ? [
        [4, 3],
        [3, 3],
        [2, 4],
        [1, 4],
        [0, 5],
      ]
    : [
        [4, 3],
        [3, 4],
        [2, 4],
        [1, 5],
        [0, 6],
      ];
  for (const [x, y] of tail) pt.set(x, y + bob, "x").set(x, y + bob + 1, "X");
  ol(pt);
  p.put(pt, 0, 0);
  // legs: crouch-run, wide stance
  const lg = new Pix(16, 16);
  if (step) {
    lg.rect(4, 12, 2, 2, "n").rect(3, 14, 2, 1, "2");
    lg.rect(9, 12, 2, 3, "n").rect(10, 14, 2, 1, "2");
  } else {
    lg.rect(5, 12, 2, 3, "n").rect(5, 14, 2, 1, "2");
    lg.rect(9, 12, 2, 2, "n").rect(11, 13, 2, 1, "2").set(10, 13, "n");
  }
  ol(lg);
  p.put(lg, 0, 0);
  // body (leaning forward): navy blazer, red armband on the back arm
  const bd = new Pix(16, 16);
  bd.rect(5, 8 + bob, 6, 4, (x) => (x === 5 ? "U" : x >= 9 ? "n" : "U"));
  bd.rect(4, 9 + bob, 2, 3, (x, y) => (y === 9 + bob ? "r" : "n"));
  bd.set(4, 9 + bob, "r").set(5, 9 + bob, "R");
  bd.set(8, 8 + bob, "w"); // shirt collar peek
  ol(bd);
  p.put(bd, 0, 0);
  // head
  const hd = new Pix(16, 16);
  ball(hd, 8.5, 5 + bob, 4.3, 3.9, ["k", "s", "s", "t"]);
  ol(hd);
  p.put(hd, 0, 0);
  // hair cap (dark) and the mask over the lower face
  p.put(
    `
..11111..
.1xxfxx1.
1xxfxxxxx1
1xxxxxxxx1`,
    4,
    0 + bob,
    { skip: "." },
  );
  p.put(
    `
1nnnnnnn1
1nUnnnnnn1
.1nnnnnn1.
..111111..`,
    4,
    6 + bob,
    { skip: "." },
  );
  // determined eyes in the strip between hair and mask
  const ey = 4 + bob;
  p.set(9, ey, "0").set(9, ey + 1, "0").set(12, ey, "0").set(12, ey + 1, "0");
  p.set(9, ey, "w");
  p.set(8, ey - 1, "1").set(13, ey - 1, "1"); // brows
  return p;
}

function ninjaThrow(): Pix {
  const p = ninjaBase(0);
  // the tell: front arm raised high, a shuriken glinting in the hand
  const arm = new Pix(16, 16);
  for (const [x, y] of [
    [10, 9],
    [11, 9],
    [11, 8],
    [12, 8],
    [11, 7],
    [12, 7],
    [12, 6],
    [13, 6],
  ] as const)
    arm.set(x, y, x + y > 19 ? "n" : "U");
  arm.set(12, 5, "s").set(13, 5, "s");
  ol(arm);
  p.put(arm, 0, 0);
  // shuriken in hand: navy blades, white core, a glint
  p.put(
    `
.1.1.
1n1n1
.1w1.
1n1n1
.1.1.`,
    11,
    0,
    { skip: "." },
  );
  p.set(13, 2, "w").set(12, 2, "U").set(14, 2, "U").set(13, 1, "U").set(13, 3, "U");
  p.set(15, 0, "w");
  return p;
}

function ninjaSmoke(): Pix {
  const base = ninjaBase(1);
  const p = new Pix(16, 16);
  // keep the head and shoulders, the rest is already gone
  base.each((x, y, k) => {
    if (k === ".") return null;
    if (y < 8 || (y < 10 && (x + y) % 2 === 0)) p.set(x, y, k);
    return null;
  });
  // billowing smoke: separate outlined puffs, back to front
  const puffs: [number, number, number, number][] = [
    [11.5, 9.5, 2.0, 1.8],
    [3.5, 10.5, 2.2, 2.0],
    [7.5, 11.5, 3.0, 2.4],
    [12, 13, 2.6, 2.0],
    [4, 13.5, 2.6, 1.6],
  ];
  for (const [x, y, rx, ry] of puffs) {
    const q = new Pix(16, 16);
    ball(q, x, y, rx, ry, ["g", "W", "W", "w"]);
    ol(q, "G");
    p.put(q, 0, 0);
  }
  // wisps drifting up
  p.set(1, 7, "W").set(14, 6, "W").set(15, 5, "g");
  return p;
}

// ============================================================================ eb_shuriken (8x8)
// 4-blade pinwheel star: navy blades with a bright silver/light-blue leading
// edge (reads on pale stone AND dark paper), white core, soft glow halo.
const SHURI_PAL = { "+": "#b0d8ff40", "*": "#b0d8ff90" };
const SHURIKEN = [
  `
...*n...
...vn...
..+vUn..
*vvwgUUn
nUUgwvv*
..nUv+..
...nv...
...n*...`,
  `
..+*n+..
..*vn...
.+vvUn+.
*vvwwUUn
nUUwwvv*
.+nUvv+.
...nv*..
..+n*+..`,
];

export const sprites: SpriteDef[] = [
  gridSprite("en_hall_monitor", 16, 16, [0, 1, 2, 3].map(hallMonitor), "feet", { fps: 9 }),
  gridSprite("en_love_letter", 12, 10, [0, 1, 2, 3].map(loveLetter), "feet", { fps: 10 }),
  gridSprite("en_tsundere_slime", 16, 16, [0, 1, 2, 3].map(tsundereSlime), "feet", { fps: 8 }),
  gridSprite("en_transfer_student", 16, 20, [transferBase(0), transferBase(1), transferOut(), transferIn()], "feet", { fps: 6 }),
  gridSprite("en_exam_paper", 12, 14, [0, 1, 2, 3].map(examPaper), "feet", { fps: 8 }),
  gridSprite("en_council_ninja", 16, 16, [ninjaBase(0), ninjaBase(1), ninjaThrow(), ninjaSmoke()], "feet", { fps: 10 }),
  gridSprite("eb_shuriken", 8, 8, SHURIKEN, "center", { fps: 8, pal: SHURI_PAL }),
];
