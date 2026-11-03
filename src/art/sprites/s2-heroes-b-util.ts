/**
 * Shared rig for the s2-heroes-b sprites (Senpai, Magical Girl #47,
 * Isekai-kun). Exports NO sprites (the registry only picks up `sprites`).
 *
 * Same construction and timing as the base cast in heroes.ts (whose rig is not
 * exported): hand-drawn layered parts stamped in z-order so the head and face
 * stay rock-solid while hair, legs, arms and props animate:
 *   back layer -> legs (auto-outlined fill poses) -> body -> head (+ face patch)
 *   -> front layer (props, sparkles).
 * Extended with per-hero leg templates/positions (Senpai is a long-legged
 * chibi) and an optional extra face per frame.
 */
import type { SpriteDef } from "../format";
import { Pix, gridSprite } from "./chars-util";

/** Shift each row of a part by off(y) pixels. Output is 2px wider on each side (place at x-2). */
export function wave(part: string | Pix, off: (y: number) => number): Pix {
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

/** Bend a part: rows >= y0 shift by dx, rows >= y1 by dx2. Output is 2px wider each side. */
export function bend(part: string | Pix, y0: number, dx: number, y1 = 999, dx2 = dx): Pix {
  return wave(part, (y) => (y >= y1 ? dx2 : y >= y0 ? dx : 0));
}

/** Build a part from shapes, then outline it. */
export function outlined(w: number, h: number, draw: (p: Pix) => void, key = "1"): Pix {
  const p = new Pix(w, h);
  draw(p);
  return p.outline(key);
}

/**
 * Leg poses are fill-only grids (one row per leg row) that get an automatic
 * outline. Keys: N = near leg, n = far leg, S/s = near/far lower leg,
 * F/f = near shoe light/dark, G/g = far shoe light/dark.
 */
export interface LegPal {
  N: string;
  n: string;
  S: string;
  s: string;
  F: string;
  f: string;
  G: string;
  g: string;
}

export function legs(art: string, pal: LegPal): Pix {
  const p = Pix.of(art, "legs").recolor(pal as unknown as Record<string, string>);
  const q = new Pix(p.w + 2, p.h + 2);
  q.put(p, 1, 1).outline("1");
  for (let x = 0; x < q.w; x++) q.set(x, 0, "."); // the hem covers the hips
  return q;
}

// ---------------------------------------------------------------------------- standard legs (3 rows)
export const LEGS_IDLE = `
..nn.NN..
..ss.SS..
..gG.Ff..
`;
export const LEGS_RUN = [
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
export const LEGS_HURT = `
.NN..nn..
.SS...ss.
Ff.....gG
`;
export const LEGS_CAST = `
.nn...NN.
.ss...SS.
.gG...Ff.
`;

export interface LegSet {
  idle: string;
  run: string[];
  hurt: string;
  cast: string;
}
export const STD_LEGS: LegSet = { idle: LEGS_IDLE, run: LEGS_RUN, hurt: LEGS_HURT, cast: LEGS_CAST };

// ---------------------------------------------------------------------------- pose table
export type Anim = "idle" | "run" | "hurt" | "cast";
export type FaceKind = "blink" | "hurt" | "cast";
export interface Pose {
  anim: Anim;
  i: number;
  bob: number;
  lean: number;
  legs: string;
  face?: FaceKind;
}
export interface Ctx {
  /** head top-left */
  hx: number;
  hy: number;
  /** body block left x (12-wide block) and upper-body dy */
  bx: number;
  by: number;
}

export const RUN_BOB = [1, 0, -1, 1, 0, -1];

function poses(L: LegSet): Record<Anim, Pose[]> {
  return {
    idle: [
      { anim: "idle", i: 0, bob: 0, lean: 0, legs: L.idle },
      { anim: "idle", i: 1, bob: 1, lean: 0, legs: L.idle },
      { anim: "idle", i: 2, bob: 1, lean: 0, legs: L.idle },
      { anim: "idle", i: 3, bob: 0, lean: 0, legs: L.idle, face: "blink" },
    ],
    run: L.run.map((l, i) => ({ anim: "run" as Anim, i, bob: RUN_BOB[i], lean: 1, legs: l })),
    hurt: [{ anim: "hurt", i: 0, bob: 0, lean: -1, legs: L.hurt, face: "hurt" }],
    cast: [
      { anim: "cast", i: 0, bob: 0, lean: -1, legs: L.cast, face: "cast" },
      { anim: "cast", i: 1, bob: -1, lean: -1, legs: L.cast, face: "cast" },
    ],
  };
}

export interface HeroDef {
  id: string;
  head: string;
  faces: Record<FaceKind, string>;
  legPal: LegPal;
  /** leg templates (default STD_LEGS) and where the leg block is stamped (default 7, 19) */
  legSet?: LegSet;
  legX?: number;
  legY?: number;
  /** head top-left at bob 0 / lean 0 */
  headX?: number;
  headY?: number;
  /** clamp for upper-body bob */
  minBob?: number;
  /** override the upper-body bob for a pose (e.g. a perfectly still idle) */
  bobFor?(p: Pose): number | null;
  /** override/patch the head per pose (e.g. a fringe-brush face); return null for the default */
  headFor?(p: Pose): string | Pix | null;
  back(c: Pix, p: Pose, k: Ctx): void;
  body(c: Pix, p: Pose, k: Ctx): void;
  front(c: Pix, p: Pose, k: Ctx): void;
}

export function buildFrame(h: HeroDef, p: Pose): Pix {
  const c = new Pix(24, 24);
  const bob = Math.max(h.minBob ?? -9, h.bobFor?.(p) ?? p.bob);
  const k: Ctx = { hx: (h.headX ?? 5) + p.lean, hy: (h.headY ?? 1) + bob, bx: 6 + Math.round(p.lean / 2), by: bob };
  h.back(c, p, k);
  c.put(legs(p.legs, h.legPal), h.legX ?? 7, h.legY ?? 19);
  h.body(c, p, k);
  const custom = h.headFor?.(p) ?? null;
  const head = custom ? (typeof custom === "string" ? Pix.of(custom, h.id + " head*") : custom.clone()) : Pix.of(h.head, h.id + " head");
  if (p.face) head.put(h.faces[p.face], 0, 0);
  c.put(head, k.hx, k.hy);
  h.front(c, p, k);
  return c;
}

export function heroSprites(h: HeroDef): SpriteDef[] {
  const fps: Record<Anim, number> = { idle: 6, run: 12, hurt: 8, cast: 8 };
  const P = poses(h.legSet ?? STD_LEGS);
  return (["idle", "run", "hurt", "cast"] as Anim[]).map((a) =>
    gridSprite(
      `${h.id}_${a}`,
      24,
      24,
      P[a].map((p) => buildFrame(h, p)),
      "feet",
      { fps: fps[a] },
    ),
  );
}

// ---------------------------------------------------------------------------- shared small props
export const SPARKLE = `
..w..
..w..
wwzww
..w..
..w..
`;
export const SPARK_S = `
.z.
zwz
.z.
`;
