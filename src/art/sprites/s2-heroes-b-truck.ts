/**
 * Truck-kun (owner s2-heroes-b): the playable isekai truck, side view facing
 * right, 32x24, feet pivot (16, 23); plus the C6 "Now With Trailer" trailer.
 * Art direction: docs/content/heroes.md §2.11.
 *
 * Built procedurally so the body, wheels, painted-on eyes and effects compose
 * cleanly per frame: cargo box (left two thirds) + cab-over cab (right third),
 * anime eyes painted in the windshield, blue racing stripe, winged-heart
 * "Reincarnation Services" logo, yellow headlight, grey bumper, black wheels.
 * The truck spans x 1..26 so the cast pose's headlight cones fit in front.
 */
import type { SpriteDef } from "../format";
import { Pix, gridSprite } from "./chars-util";

type Eyes = "open" | "blink" | "determined" | "hurt" | "cast";
interface TruckOpts {
  /** body (box + cab) vertical offset; wheels stay planted */
  dy: number;
  /** wheel rotation phase 0..3 (hub/bolt pixel moves around) */
  wheel: number;
  eyes: Eyes;
  puff?: number;
  dent?: boolean;
  lights?: boolean;
  horn?: number;
  dust?: number;
}

const BOX_X0 = 1;
const BOX_X1 = 17;
const CAB_X0 = 17;
const CAB_X1 = 26;

/** Rounded rect fill helper (corner radius 1 or 2 on chosen corners). */
function rrect(p: Pix, x0: number, y0: number, x1: number, y1: number, k: string, r: { tl?: number; tr?: number; bl?: number; br?: number } = {}): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const cut = (rx: number, ry: number, rr: number | undefined) => {
        if (!rr) return false;
        const dx = Math.abs(x - rx);
        const dy = Math.abs(y - ry);
        return dx < rr && dy < rr && dx + dy >= rr;
      };
      if (cut(x0, y0, r.tl) || cut(x1, y0, r.tr) || cut(x0, y1, r.bl) || cut(x1, y1, r.br)) continue;
      p.set(x, y, k);
    }
}

/** 6x6 wheel with tyre, rim and a hub bolt that orbits with `phase`. */
function wheel(p: Pix, x: number, y: number, phase: number): void {
  const W = `
.0000.
00GG00
0GggG0
0GggG0
00GG00
.0000.
`;
  p.put(W, x, y);
  // rotating bolt on the rim
  const bolts: [number, number][] = [
    [2, 1],
    [4, 2],
    [3, 4],
    [1, 3],
  ];
  const [bx, by] = bolts[phase & 3];
  p.set(x + bx, y + by, "w");
  p.set(x + 2, y + 2, "W").set(x + 3, y + 3, "G");
}

function body(o: TruckOpts): Pix {
  const p = new Pix(32, 24);
  const dy = o.dy;
  // --- cargo box
  const box = new Pix(32, 24);
  rrect(box, BOX_X0, 3, BOX_X1, 19, "W", { tl: 1 });
  box.each((x, y, k) => {
    if (k !== "W") return null;
    if (y === 3) return "w"; // lit top edge
    if (x === BOX_X0) return "w"; // lit rear edge
    if (y >= 17) return "g"; // underside shade
    if ((x === 6 || x === 12) && y > 4 && y < 17) return "g"; // panel seams
    return null;
  });
  // roof highlight glint
  box.set(3, 4, "w").set(4, 4, "w");
  // --- cab (cab-over, rounded front-top)
  const cab = new Pix(32, 24);
  rrect(cab, CAB_X0, 6, CAB_X1, 19, "w", { tr: 3, tl: 1 });
  cab.each((x, y, k) => {
    if (k !== "w") return null;
    if (x >= CAB_X1 - 1 && y > 8) return "W"; // front face, turned from the light
    if (y >= 17) return "g";
    if (y >= 15) return "W";
    return null;
  });
  // windshield glass (the eyes are painted on it)
  rrect(cab, 18, 7, 25, 12, "a", { tr: 2 });
  cab.each((x, y, k) => (k === "a" && (y === 12 || x === 25 || (x === 24 && y === 7)) ? "v" : null));
  // door line + handle
  cab.line(18, 13, 18, 18, "g");
  cab.set(20, 16, "G").set(21, 16, "G");
  // racing stripe across box and cab
  for (let x = BOX_X0; x <= CAB_X1; x++) {
    for (const q of [box, cab]) if (q.solid(x, 14)) q.set(x, 14, "u").set(x, 15, "U");
  }
  // winged heart logo on the box
  box.put(
    `
qq.p.p.qq
.qqpppqq.
...qpq...
....p....
`,
    5,
    7,
  );
  if (o.dent) box.set(14, 5, "G").set(15, 5, "g").set(14, 6, "g").set(13, 4, "g");
  // compose with an outline between the box and the cab
  box.outline("1");
  cab.outline("1");
  p.put(box, 0, 0);
  p.put(cab, 0, 0);
  // eyes painted in the windshield
  eyes(p, o.eyes);
  // blush sticker under the near eye
  p.set(19, 13, "b").set(20, 13, "b");
  // side mirror (a little ear on the cab's front corner)
  p.put(
    `
.111
1Wg1
1gG1
.11.
`,
    25,
    6,
  );
  // headlight + bumper + plate
  p.put(
    `
11..
zy1.
yY1.
1111
GGG1
2221
111.
`,
    CAB_X1 - 1,
    13,
  );
  p.set(CAB_X1 - 2, 17, "y").set(CAB_X1 - 1, 17, "y");
  p.shift(0, dy);
  return p;
}

/** Eyes painted on the windshield: near eye x 18..20, far (foreshortened) eye x 22..23, lids on row 8. */
function eyes(p: Pix, e: Eyes): void {
  // glass glare streak on the windshield's front edge
  p.set(24, 8, "w").set(24, 9, "w").set(25, 10, "w");
  if (e === "blink") {
    // happy closed '^ ^'
    p.put(`
.0.
0.0
`, 18, 9);
    p.put(`
.0
0.
`, 22, 9);
    return;
  }
  if (e === "hurt") {
    p.put(`
0..
.00
0..
`, 18, 8);
    p.put(`
.0
0.
.0
`, 22, 8);
    // sweat drop on the glass
    p.set(21, 8, "c").set(21, 9, "w");
    return;
  }
  if (e === "determined") {
    // slanted lids toward the nose: focused, driving
    p.put(`
00..
w00.
U0U.
uUw.
`, 18, 8);
    p.put(`
.0
00
0U
uu
`, 22, 8);
    return;
  }
  p.put(`
000
wUU
U0U
uUw
`, 18, 8);
  p.put(`
00
wU
U0
uu
`, 22, 8);
  if (e === "cast") {
    // star shines - the eyes sparkle
    p.set(19, 9, "w").set(18, 10, "w").set(20, 10, "w").set(19, 11, "z").set(23, 10, "w");
  }
}

function truckFrame(o: TruckOpts): Pix {
  const c = new Pix(32, 24);
  // exhaust puff behind the box (idle f2) / dust kicked up (run)
  if (o.puff) {
    const r = o.puff;
    c.ellipse(1.5, 19.5 - r, 1 + r * 0.5, 1 + r * 0.4, "g");
    c.set(1, 18 - r, "W");
  }
  if (o.dust) {
    // dust kicked up behind the rear wheel
    c.put(
      o.dust === 1
        ? `
..WW.
.WggW
gg.g.
`
        : `
.W...
WWg..
.gWg.
..g..
`,
      0,
      19 - o.dust,
    );
  }
  // dark chassis between the wheels (grounds the box)
  c.rect(8, 19 + o.dy, 11, 2, "2");
  c.put(body(o), 0, 0);
  c.rect(9, 20 + o.dy, 9, 1, "2");
  wheel(c, 3, 17, o.wheel);
  wheel(c, 18, 17, o.wheel + 1);
  // wheel outline (tyres sit on the ground line)
  c.outline("1");
  if (o.lights) {
    // two light-cone rows blazing forward from the headlight, widening
    const y = 14 + o.dy;
    for (let x = 27; x <= 31; x++) {
      c.set(x, y, x < 29 ? "w" : "z");
      c.set(x, y + 1, x < 28 ? "w" : "z");
      if (x >= 29) c.set(x, y - 1, "z");
      if (x >= 30) c.set(x, y + 2, "y");
    }
  }
  if (o.horn !== undefined) {
    // horn burst: three sound lines radiating from above the cab
    const ox = 21;
    const oy = 3 + o.dy - o.horn;
    c.set(ox - 2, oy, "w").set(ox - 3, oy - 1, "w");
    c.set(ox + 1, oy - 1, "w").set(ox + 1, oy - 2, "w");
    c.set(ox + 4, oy, "w").set(ox + 5, oy - 1, "w");
  }
  return c;
}

const IDLE: TruckOpts[] = [
  { dy: 0, wheel: 0, eyes: "open" },
  { dy: -1, wheel: 0, eyes: "open" },
  { dy: 0, wheel: 0, eyes: "blink", puff: 1 },
  { dy: -1, wheel: 0, eyes: "open", puff: 2 },
];
const RUN: TruckOpts[] = [0, 1, 2, 3, 4, 5].map((i) => ({
  dy: i % 3 === 1 ? -1 : 0,
  wheel: i % 4,
  eyes: "determined" as Eyes,
  dust: i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 0,
}));
const HURT: TruckOpts[] = [{ dy: 1, wheel: 0, eyes: "hurt", dent: true }];
const CAST: TruckOpts[] = [
  { dy: 0, wheel: 0, eyes: "cast", lights: true, horn: 0 },
  { dy: -1, wheel: 1, eyes: "cast", lights: true, horn: 1 },
];

// ============================================================================ trailer (C6)
function trailerFrame(f: number): Pix {
  const c = new Pix(24, 20);
  const box = new Pix(24, 20);
  rrect(box, 1, 1, 19, 15, "W", { tl: 1, tr: 1 });
  box.each((x, y, k) => {
    if (k !== "W") return null;
    if (y === 1) return "w";
    if (x === 1) return "w";
    if (y >= 14) return "g";
    if ((x === 7 || x === 13) && y > 2 && y < 14) return "g";
    return null;
  });
  for (let x = 1; x <= 19; x++) {
    box.set(x, 10, "u").set(x, 11, "U");
  }
  box.put(
    `
qq.p.p.qq
.qqpppqq.
...qpq...
....p....
`,
    6,
    4,
  );
  box.outline("1");
  c.put(box, 0, 0);
  // tow hitch to the cab (right side)
  c.put(
    `
1111
GGg1
1111
`,
    20,
    12,
  );
  wheel(c, 3, 13, f * 2);
  wheel(c, 10, 13, f * 2 + 1);
  c.outline("1");
  return c;
}

export const sprites: SpriteDef[] = [
  gridSprite("truck_kun_idle", 32, 24, IDLE.map(truckFrame), "feet", { fps: 6 }),
  gridSprite("truck_kun_run", 32, 24, RUN.map(truckFrame), "feet", { fps: 12 }),
  gridSprite("truck_kun_hurt", 32, 24, HURT.map(truckFrame), "feet", { fps: 8 }),
  gridSprite("truck_kun_cast", 32, 24, CAST.map(truckFrame), "feet", { fps: 8 }),
  gridSprite("truck_kun_trailer", 24, 20, [trailerFrame(0), trailerFrame(1)], "feet", { fps: 8 }),
];
