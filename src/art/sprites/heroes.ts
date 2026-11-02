/**
 * Hero sprites (owner: chars). 24x24, feet pivot (12, 23), facing right.
 *
 * Every hero is composed from hand-drawn layered parts so the head/face stays
 * rock-solid between frames while hair, legs, arms and props animate:
 *   back layer (hair/tail/sheath) -> legs (auto-outlined fill poses) -> body
 *   -> head (+ face patch) -> front layer (props, sparkles).
 * All heroes share one pose table (timing, bob, lean, leg poses) so they feel
 * like one cast.
 */
import type { SpriteDef } from "../format";
import { Pix, gridSprite } from "./chars-util";

// ============================================================================ shared helpers

/** Shift each row of a part by off(y) pixels. Output is 2px wider on each side (place at x-2). */
function wave(part: string | Pix, off: (y: number) => number): Pix {
  const p = typeof part === "string" ? Pix.of(part, "wave") : part;
  const out = new Pix(p.w + 4, p.h);
  for (let y = 0; y < p.h; y++) {
    const o = Math.round(off(y));
    for (let x = 0; x < p.w; x++) {
      const k = p.get(x, y);
      if (k !== ".") out.set(x + 2 + o, y, k);
    }
  }
  return out;
}

/** Bend a hair part: rows >= y0 shift by dx, rows >= y1 by dx2. Output is 2px wider each side. */
function bend(part: string | Pix, y0: number, dx: number, y1 = 999, dx2 = dx): Pix {
  return wave(part, (y) => (y >= y1 ? dx2 : y >= y0 ? dx : 0));
}

/** Build a part from shapes, then outline it. */
function outlined(w: number, h: number, draw: (p: Pix) => void, key = "1"): Pix {
  const p = new Pix(w, h);
  draw(p);
  return p.outline(key);
}

/**
 * Leg poses are authored as fill-only 9x3 grids (rows y20..y22) and get an
 * automatic outline. Keys: N = near leg, n = far leg, S/s = near/far lower
 * leg (socks), F/f = near shoe light/dark, G/g = far shoe light/dark.
 */
const LEGS_IDLE = `
..nn.NN..
..ss.SS..
..gG.Ff..
`;
const LEGS_RUN = [
  `
..nnNN...
.ss...SS.
gG.....Ff
`,
  `
...nNN...
.ss..SS..
Gg...Ff..
`,
  `
...NNn...
...SSs...
...Ffg...
`,
  `
..NNnn...
.SS...ss.
Ff.....gG
`,
  `
...Nnn...
.SS..ss..
fF...gG..
`,
  `
...nnN...
...ssS...
...gGf...
`,
];
const LEGS_HURT = `
.NN..nn..
.SS...ss.
Ff.....gG
`;
const LEGS_CAST = `
.nn...NN.
.ss...SS.
.gG...Ff.
`;

interface LegPal {
  N: string;
  n: string;
  S: string;
  s: string;
  F: string;
  f: string;
  G: string;
  g: string;
}

function legs(art: string, pal: LegPal): Pix {
  const p = Pix.of(art, "legs").recolor(pal as unknown as Record<string, string>);
  const q = new Pix(p.w + 2, p.h + 2);
  q.put(p, 1, 1).outline("1");
  for (let x = 0; x < q.w; x++) q.set(x, 0, "."); // the skirt/hem covers the hips
  return q;
}

// ---------------------------------------------------------------------------- pose table
type Anim = "idle" | "run" | "hurt" | "cast";
type FaceKind = "blink" | "hurt" | "cast";
interface Pose {
  anim: Anim;
  i: number;
  bob: number;
  lean: number;
  legs: string;
  face?: FaceKind;
}
interface Ctx {
  /** head top-left */
  hx: number;
  hy: number;
  /** body block left x (12-wide block) and upper-body dy */
  bx: number;
  by: number;
}

const RUN_BOB = [1, 0, -1, 1, 0, -1];
const POSES: Record<Anim, Pose[]> = {
  idle: [
    { anim: "idle", i: 0, bob: 0, lean: 0, legs: LEGS_IDLE },
    { anim: "idle", i: 1, bob: 1, lean: 0, legs: LEGS_IDLE },
    { anim: "idle", i: 2, bob: 1, lean: 0, legs: LEGS_IDLE },
    { anim: "idle", i: 3, bob: 0, lean: 0, legs: LEGS_IDLE, face: "blink" },
  ],
  run: LEGS_RUN.map((l, i) => ({ anim: "run" as Anim, i, bob: RUN_BOB[i], lean: 1, legs: l })),
  hurt: [{ anim: "hurt", i: 0, bob: 0, lean: -1, legs: LEGS_HURT, face: "hurt" }],
  cast: [
    { anim: "cast", i: 0, bob: 0, lean: -1, legs: LEGS_CAST, face: "cast" },
    { anim: "cast", i: 1, bob: -1, lean: -1, legs: LEGS_CAST, face: "cast" },
  ],
};

interface HeroDef {
  id: string;
  head: string;
  faces: Record<FaceKind, string>;
  legPal: LegPal;
  /** head top-left at bob 0 / lean 0 */
  headX?: number;
  headY?: number;
  /** clamp for upper-body bob (e.g. tall ears) */
  minBob?: number;
  back(c: Pix, p: Pose, k: Ctx): void;
  body(c: Pix, p: Pose, k: Ctx): void;
  front(c: Pix, p: Pose, k: Ctx): void;
}

function buildFrame(h: HeroDef, p: Pose): Pix {
  const c = new Pix(24, 24);
  const bob = Math.max(h.minBob ?? -9, p.bob);
  const k: Ctx = { hx: (h.headX ?? 5) + p.lean, hy: (h.headY ?? 1) + bob, bx: 6 + Math.round(p.lean / 2), by: bob };
  h.back(c, p, k);
  c.put(legs(p.legs, h.legPal), 7, 19);
  h.body(c, p, k);
  const head = Pix.of(h.head, h.id + " head");
  if (p.face) head.put(h.faces[p.face], 0, 0);
  c.put(head, k.hx, k.hy);
  h.front(c, p, k);
  return c;
}

function heroSprites(h: HeroDef): SpriteDef[] {
  const fps: Record<Anim, number> = { idle: 6, run: 12, hurt: 8, cast: 8 };
  return (["idle", "run", "hurt", "cast"] as Anim[]).map((a) =>
    gridSprite(
      `${h.id}_${a}`,
      24,
      24,
      POSES[a].map((p) => buildFrame(h, p)),
      "feet",
      { fps: fps[a] },
    ),
  );
}

// shared small props
const STAR5 = `
...1...
..1y1..
11yzy11
1yzzyY1
.1yyY1.
.1Y11Y1
.11..11
`;
const SPARKLE = `
..w..
..w..
wwzww
..w..
..w..
`;
const SPARK_S = `
.z.
zwz
.z.
`;
/** Raised front arm (sleeve colour key `q`) - top-right is the hand. */
const ARM_UP = `
..1s1
.1s1.
1q1..
`;

// ============================================================================ HOSHI
const H_HEAD = `
.....1111.....
...11qqqq11...
..1qqqqpppp1..
.1qqqpppppppP1
1qqpPppppPppP1
1ppPPssPssPsP1
1ppPs111ss1111
1ppPsswCsswCs1
1ppPssCcssCcs1
1ppPssccssccs1
1pPPkbbssRsbb1
.1PP1ssssssk1.
..11.1111111..
`;
const H_FACE_BLINK = `
..............
..............
..............
..............
..............
..............
....ssssssssss
....ssssssssss
....s111ss111s
....sssssssss.
`;
const H_FACE_HURT = `
..............
..............
..............
..............
..............
..............
....s1ssss1s..
....ss11s11ss.
....s1ssss1ss.
....ssssssssss
....kbss11sbb.
........RR....
`;
const H_FACE_CAST = `
..............
..............
..............
..............
..............
..............
....s111ss1111
....sswCsswCs.
....ssCcssCcs.
....sscwsscws.
....kbbs00bb..
.....sssRRsk..
`;
const H_TAIL_L = `
...11.
..1qp1
..1pP1
.1qpP1
.1qpP1
1qppP1
1qpPP1
1qpPP1
1ppPP1
1ppPP1
.1pPP1
.1pPP1
..1pP1
..1pP1
..1PP1
..1P1.
...1..
`;
const H_TAIL_R = `
.11..
1pP1.
1pP1.
1pPP1
1pPP1
1pPP1
1PPP1
1pPP1
.1PP1
.1PP1
..1P1
...1.
`;
const H_CLIP = `
.y.
yzy
.Y.
`;
const H_BODY = `
..1qwyywq1..
.1qqwyYwPp1.
.1s1pPPp1s1.
..1qpppPP1..
.1qppppPPP1.
.1wWwWwWWW1.
`;
const H_BODY_NOHAND = `
..1qwyywq1..
.1qqwyYwPp1.
.1s1pPPp11..
..1qpppPP1..
.1qppppPPP1.
.1wWwWwWWW1.
`;

const HOSHI: HeroDef = {
  id: "hoshi",
  head: H_HEAD,
  faces: { blink: H_FACE_BLINK, hurt: H_FACE_HURT, cast: H_FACE_CAST },
  legPal: { N: "s", n: "k", S: "W", s: "g", F: "p", f: "P", G: "P", g: "Q" },
  back(c, p, { hx, hy }) {
    if (p.anim === "idle") {
      const sw = p.i >= 2 ? 1 : 0;
      c.put(bend(H_TAIL_L, 9, -sw, 13, -sw), hx - 7, hy + 2);
      c.put(bend(H_TAIL_R, 7, sw, 10, sw), hx + 11, hy + 3);
    } else if (p.anim === "run") {
      const ph = p.i % 3 === 2 ? 1 : 0;
      c.put(wave(H_TAIL_L, (y) => (y < 5 ? 0 : y < 10 ? -1 : ph ? -1 : -2) + (y > 12 ? ph : 0)), hx - 7, hy + 1);
      c.put(wave(H_TAIL_R, (y) => (y < 4 ? -1 : y < 8 ? -2 : ph ? -3 : -2)), hx + 11, hy + 3);
    } else if (p.anim === "hurt") {
      c.put(bend(H_TAIL_L, 5, -1, 9, -2), hx - 7, hy + 1);
      c.put(bend(H_TAIL_R, 4, 1, 7, 2), hx + 11, hy + 2);
    } else {
      c.put(bend(H_TAIL_L, 4, -1, 9, -2 + p.i), hx - 7, hy + 1);
      c.put(wave(H_TAIL_R, (y) => (y < 3 ? 0 : -2)), hx + 11, hy + 3);
    }
  },
  body(c, p, { bx, by }) {
    c.put(p.anim === "cast" || p.anim === "hurt" ? H_BODY_NOHAND : H_BODY, bx, 14 + by);
  },
  front(c, p, { hx, hy, bx, by }) {
    c.put(H_CLIP, hx - 2, hy + 1);
    c.put(H_CLIP, hx + 12, hy + 1);
    if (p.anim === "idle" || p.anim === "run") {
      const wy = 16 + by;
      const sy = p.anim === "run" ? 1 : 0;
      c.put(STAR5, bx + 11, wy - 5 + sy);
      c.set(bx + 10, wy, "1").set(bx + 11, wy, "W").set(bx + 12, wy - 1 + sy, "W").set(bx + 11, wy + 1, "1");
    } else if (p.anim === "cast") {
      const ax = bx + 9;
      const ay = 14 + by;
      c.put(ARM_UP, ax - 1, ay - 1);
      c.set(ax + 3, ay - 2, "W").set(ax + 2, ay - 2, "1").set(ax + 3, ay - 3, "W").set(ax + 4, ay - 3, "1");
      c.put(STAR5, ax + 2, ay - 12);
      const sx = bx + 14;
      const sy = 5 + by;
      if (p.i === 0) {
        c.put(SPARK_S, sx - 5, sy - 6);
        c.put(SPARK_S, sx + 5, sy + 3);
      } else {
        c.put(SPARKLE, sx - 7, sy - 6);
        c.put(SPARK_S, sx + 5, sy + 2);
        c.put(SPARK_S, sx + 2, sy - 7);
      }
    } else {
      c.put(ARM_UP, bx + 8, 13 + by);
      c.put(STAR5, bx + 12, 15 + by);
    }
  },
};

// ============================================================================ RIN
const R_HEAD = `
.....1111.....
...11xxxx11...
..1xfffxxxx1..
.1xffxxxxxxX1.
1xxxxXxxxXxxX1
1xxXXsXxsXxsX1
1xxXs111ss1111
1xxXsswRsswRs1
1xxXssRrssRrs1
1xxXssrossros1
1xXXkbssskssb1
.1XX1ssssssk1.
..11.1111111..
`;
const R_FACE_BLINK = `
..............
..............
..............
..............
..............
..............
....ssssssssss
....ssssssssss
....s111ss111s
....sssssssss.
`;
const R_FACE_HURT = `
..............
..............
..............
..............
..............
..............
....s1ssss1s..
....ss11s11ss.
....s1ssss1ss.
....ssssssssss
....kbss11sbb.
........RR....
`;
const R_FACE_CAST = `
..............
..............
..............
..............
..............
..............
....s11sss111.
....ss11ss11s.
....sswRsswRs.
....ssrrssrrs.
....kbbs00bb..
.....sssRRsk..
`;
const R_PONY = `
...111..
..1xfX1.
.1fxxXX1
1ffxxXX1
1fxxxXX1
1xfxXXX1
1xfxXXX1
1xxxXX1.
.1fxXX1.
.1xfXX1.
.1xxX1..
..1fX1..
..1xXX1.
..1X1X1.
...1.1..
`;
const R_BOW = `
11...11
1rr1rr1
1rRRRr1
1Rr1rR1
11.1.11
..1R1..
..1r1..
...1...
`;
const R_BODY = `
...1wwgW1...
.11wwwwgW11.
1wW1rrrR1Wg1
1wW1rrrR1Wg1
1s1rrrrRR1s1
.1rrrRrrRR1.
`;
const R_BODY_NOHAND = `
...1wwgW1...
.11wwwwgW11.
1wW1rrrR11..
1wW1rrrR1...
1s1rrrrRR1..
.1rrrRrrRR1.
`;

/** Katana tucked in the obi: hilt forward at the waist, scabbard out the back. */
const KATANA = outlined(24, 24, (p) => {
  p.line(2, 18, 14, 16, "U"); // scabbard (blue lacquer)
  p.line(3, 19, 14, 17, "n");
  p.set(2, 18, "Y").set(3, 19, "Y"); // kojiri end cap
  p.set(15, 15, "y").set(15, 16, "Y").set(15, 17, "Y"); // tsuba
  p.line(16, 15, 19, 13, "W"); // hilt wrap
  p.set(17, 14, "1").set(19, 13, "g");
});
function sheathedKatana(c: Pix, dx: number, dy: number, behind: boolean): void {
  if (behind) c.put(KATANA, dx, dy);
  else c.put(KATANA.crop(14, 0, 10, 24), dx + 14, dy); // hilt only, in front of the body
}

const RIN: HeroDef = {
  id: "rin",
  head: R_HEAD,
  faces: { blink: R_FACE_BLINK, hurt: R_FACE_HURT, cast: R_FACE_CAST },
  legPal: { N: "r", n: "R", S: "r", s: "R", F: "W", f: "g", G: "g", g: "G" },
  back(c, p, { hx, hy, bx, by }) {
    let pony: Pix;
    if (p.anim === "idle") pony = bend(R_PONY, 7, p.i >= 2 ? -1 : 0, 11, p.i >= 2 ? -1 : 0);
    else if (p.anim === "run") {
      const ph = p.i % 3;
      pony = wave(R_PONY, (y) => (y < 4 ? 0 : y < 8 ? -1 : y < 12 ? -2 + (ph === 1 ? 1 : 0) : -2 + (ph === 2 ? 1 : 0)));
    } else if (p.anim === "hurt") pony = bend(R_PONY, 4, 1, 9, 2);
    else pony = bend(R_PONY, 5, -1, 10, -2);
    c.put(pony, hx - 7, hy + 1);
    sheathedKatana(c, bx - 6, by, true);
  },
  body(c, p, { bx, by }) {
    c.put(p.anim === "cast" || p.anim === "hurt" ? R_BODY_NOHAND : R_BODY, bx, 14 + by);
  },
  front(c, p, { hx, hy, bx, by }) {
    const bw = p.anim === "run" ? (p.i % 3 === 1 ? 1 : 0) : 0;
    c.put(bend(R_BOW, 5, bw), hx - 5, hy - 1);
    if (p.anim !== "cast") sheathedKatana(c, bx - 6, by, false);
    if (p.anim === "cast") {
      const ax = bx + 9;
      const ay = 14 + by;
      c.put(ARM_UP.replace(/q/g, "w"), ax - 1, ay - 1);
      // drawn katana raised high, edge glinting
      const blade = outlined(11, 14, (q) => {
        q.line(1, 12, 3, 10, "W"); // hilt
        q.set(3, 10, "y").set(4, 10, "y").set(3, 9, "y");
        q.line(4, 9, 9, 1, "w");
        q.line(5, 9, 9, 2, "v");
      });
      c.put(blade, ax, ay - 14);
      if (p.i === 1) {
        c.put(SPARKLE, ax + 6, ay - 15);
        c.put(SPARK_S, ax - 4, ay - 11);
      } else c.put(SPARK_S, ax + 7, ay - 14);
      // sakura petals swirling
      const pts = p.i === 0 ? [[3, 9], [20, 15], [1, 16]] : [[2, 6], [21, 13], [4, 17]];
      for (const [x, y] of pts) c.set(x, y + by, "q").set(x + 1, y + by, "p");
    } else if (p.anim === "hurt") {
      c.put(ARM_UP.replace(/q/g, "w"), bx + 8, 13 + by);
    }
  },
};

// ============================================================================ MOCHI
const M_HEAD = `
......1111......
....11BBBB11....
...1BBBFFFFF1...
..1BBFFFFFFFh1..
.1BFFFFFFFFFFh1.
1BFFhFhhFhhFhhh1
1Fhh111sss111hF1
1FhhswYssswYshF1
1FhhsYysssYyshF1
1FhhszyssszyshF1
1Fhhbbs1s1sbbhF1
.1hhksss1ssskh1.
..111111111111..
`;
const M_FACE_BLINK = `
................
................
................
................
................
................
....sssssssss...
....sssssssss...
....111sss111...
....sssssssss...
`;
const M_FACE_HURT = `
................
................
................
................
................
................
....1sssssss1...
....s11sss11s...
....1sssssss1...
....sssssssss...
....bbs111sbb...
....sss1R1sss...
`;
const M_FACE_CAST = `
................
................
................
................
................
................
....111sss111...
....sYwsssYws...
....swysssswy...
....szysssszy...
....bbs00wsbb...
....sssRR0sss...
`;
const M_EARS = `
..1..........1..
.1F1........1F1.
.1qF1......1Fq1.
1qbF1......1Fbq1
1bqF1......1Fqb1
`;
const M_EARS_TWITCH = `
................
.11.........1F1.
1qF1.......1Fq1.
1qbF1......1Fbq1
1bqF1......1Fqb1
`;
const M_EARS_FLAT = `
................
................
11............11
1qF11......11Fq1
1bqF1......1Fqb1
`;
const M_TAIL = `
.111...
1BBB1..
1FFh1..
1Fhh1..
.1Fh1..
.1FFh1.
..1Fh1.
..1FFh1
...1Fh1
....111
`;
const M_HOOD = `
..111.
.1jjI1
1jiII1
1iII1.
.111..
`;
const M_BODY = `
..1jjjiiI1..
.1jjjqiqiI1.
1jj1iqqqI1I1
1Bq1iiiiI1qB
.11jiiiiII11
..1IiIiIiI1.
`;
const M_BODY_NOHAND = `
..1jjjiiI1..
.1jjjqiqiI1.
1jj1iqqqI1..
1Bq1iiiiI1..
.11jiiiiII1.
..1IiIiIiI1.
`;
const M_PAW_UP = `
.111.
1Bqq1
1BBq1
1jI1.
1ji1.
1ji1.
1ji1.
1i1..
`;

const MOCHI: HeroDef = {
  id: "mochi",
  head: M_HEAD,
  headX: 4,
  headY: 2,
  minBob: 0,
  faces: { blink: M_FACE_BLINK, hurt: M_FACE_HURT, cast: M_FACE_CAST },
  legPal: { N: "s", n: "k", S: "B", s: "h", F: "i", f: "I", G: "I", g: "2" },
  back(c, p, { hx, hy, bx, by }) {
    // tail: sways in idle, streams behind while running, stands up when casting
    let tail: Pix;
    if (p.anim === "idle") tail = wave(M_TAIL, (y) => (y < 4 ? (p.i === 1 || p.i === 2 ? 1 : 0) : 0));
    else if (p.anim === "run") tail = wave(M_TAIL, (y) => (y < 3 ? (p.i % 3) - 1 : y < 6 ? (p.i % 2 ? 0 : -1) : 0));
    else if (p.anim === "hurt") tail = bend(M_TAIL, 0, 1, 4, 0);
    else tail = wave(M_TAIL, (y) => (y < 3 ? 1 + p.i : y < 6 ? 1 : 0));
    c.put(tail, bx - 7, 10 + by);
    const ears = p.anim === "hurt" ? M_EARS_FLAT : p.anim === "idle" && p.i === 3 ? M_EARS_TWITCH : M_EARS;
    c.put(ears, hx, hy - 2);
    // little ahoge tuft
    const tuftDx = p.anim === "run" ? -1 : p.anim === "idle" && p.i >= 2 ? 1 : 0;
    c.set(hx + 7, hy - 1, "1").set(hx + 8 + tuftDx, hy - 2, "1").set(hx + 8, hy - 1, "F");
  },
  body(c, p, { bx, by }) {
    c.put(p.anim === "cast" || p.anim === "hurt" ? M_BODY_NOHAND : M_BODY, bx, 14 + by);
  },
  front(c, p, { hx, hy, bx, by }) {
    if (p.anim === "cast") {
      c.put(M_PAW_UP, bx + 11, 6 + by - p.i);
      c.put(M_PAW_UP, bx - 4, 6 + by - p.i, { flip: true });
      if (p.i === 1) {
        c.put(SPARKLE, hx + 14, hy - 1);
        c.put(SPARK_S, hx - 4, hy + 1);
      } else {
        c.put(SPARK_S, hx + 15, hy);
        c.put(SPARK_S, hx - 3, hy + 3);
      }
    } else if (p.anim === "hurt") {
      c.put(M_PAW_UP, bx + 10, 8 + by);
    }
  },
};

export const sprites: SpriteDef[] = [...heroSprites(HOSHI), ...heroSprites(RIN), ...heroSprites(MOCHI)];
