/**
 * AOI - Mecha Pilot (Licensed Since Tuesday) (owner: s2-heroes-a).
 * Hero set (24x24 idle/run/hurt/cast): Aoi inside the glass dome of her chibi
 * "trash can with legs" mech, Unit-Aoi Mk. II. Plus her bust portrait and the
 * giant robot fist ult actor. Art direction: docs/content/heroes.md §2.6.
 */
import {
  Pix,
  gridSprite,
  heroSprites,
  SPARKLE,
  SPARK_S,
  strand,
  layer,
  eye,
  blush,
  speedLines,
  paintPortrait,
  EYE_NEAR,
  EYE_FAR,
  NEAR_X,
  FAR_X,
  EYE_Y,
  TWINKLE,
  TWINKLE_S,
  type StrandKeys,
  type PortraitDef,
  type Iris,
  type HeroDef,
  type Pose,
  type Anim,
  type SpriteDef,
} from "./s2-heroes-a-util";

/** Semi-transparent dome glass. */
const AOI_PAL = { A: "#bafff666", K: "#bafff6b0" };

// ============================================================================ hero sprite

/** Aoi's head inside the dome (interior-only; outlined): blue bob u/U/n/v, goggles c/a on G frames. */
const A_HEAD_IN = `
............
....vvuu....
..vvuuuuuU..
.GcaGGcaGUU.
.uuUuuuUuUU.
.uUssUssUsU.
.uU111ss111.
.uUswUsswUs.
.uUsUussUus.
.uUsuvssuvs.
.UUkbssRsbb.
..UUssssssk.
............
`;
const A_HEAD = Pix.of(A_HEAD_IN, "aoi head").outline("1");

function domeWithHead(face?: string, crack = false): string {
  const d = new Pix(16, 14);
  // dome glass: a round bubble, open at the bottom (the collar covers it)
  d.ellipse(7.5, 7.5, 7, 7.2, "A");
  d.outline("1");
  for (let x = 0; x < 16; x++) d.set(x, 13, ".");
  const h = A_HEAD.clone();
  if (face) h.put(face, 0, 0);
  d.put(h, 2, 1);
  // glass shine (top-left) + rim tint
  d.set(3, 3, "w").set(4, 2, "w").set(2, 5, "K").set(2, 6, "K").set(6, 1, "K");
  if (crack) d.set(12, 2, "w").set(13, 3, "w").set(12, 4, "w").set(13, 5, "w").set(13, 4, "1");
  return d.str();
}

const A_FACE_BLINK = `
............
............
............
............
............
............
....sss.sss.
....sss.sss.
....111.111.
............
`;
const A_FACE_HURT = `
............
............
............
............
............
............
...1sss.1ss.
...s11ss11s.
...1sss.1ss.
...ssssssss.
...kbs11sbb.
.......RR...
`;
const A_FACE_CAST = `
............
............
............
............
............
............
...111ss111.
...swUsswUs.
...sUussUus.
...swussuws.
...kbs00sbb.
......RRk...
`;

/** Mech torso: white can w/W/g/G, blue chest panel u/v/U, rivets g, status light. Interior; outlined. */
const MECH_BODY = `
..wwWWWWWWWWWgg...
.wwWWWWWWWWWWWgG..
.wWuuuuuuuuuuUgG..
.wWuvvuuuuuuuUgG..
.wWWWWWWWWWWWWgG..
.wWgWWWWWWWWWgGG..
..wWWWWWWWWWWgG...
...gWWWWWWWWgG....
`;
/** Collar ring the dome sits in (drawn over the dome's base). */
const COLLAR = `
1gWWWWWWWWWWg1
.111111111111.
`;
/** Front arm cannon (points right): barrel with a blue band + dark muzzle. Interior; outlined. */
const CANNON = `
.WWWg.
wWWWgG
uuuuU0
gggGG.
`;
const CANNON_UP = `
W0g
WUG
WuG
WuG
gG.
`;
/** Back arm: a round shoulder joint peeking out behind the torso. */
const SHOULDER = `
.Wg.
WWgG
uuUG
.gG.
`;
/** Stubby leg + foot with caution stripes on the shin (y/2). Interior; outlined. */
const LEG = `
.Wg.
.y2.
.2y.
WWgG
`;

interface MechPose extends Pose {
  /** per-leg lift (back, front) */
  lift: [number, number];
  /** body bob (independent of the dome) */
  body: number;
}

const P = (anim: Anim, i: number, bob: number, body: number, lift: [number, number], face?: Pose["face"], lean = 0): MechPose => ({
  anim,
  i,
  bob,
  lean,
  legs: "",
  face,
  body,
  lift,
});

const MECH_POSES: Record<Anim, Pose[]> = {
  idle: [P("idle", 0, 0, 0, [0, 0]), P("idle", 1, 1, 0, [0, 0]), P("idle", 2, 1, 0, [0, 0]), P("idle", 3, 0, 0, [0, 0], "blink")],
  run: [
    P("run", 0, 1, 1, [0, 0]),
    P("run", 1, 0, 0, [2, 0]),
    P("run", 2, -1, -1, [1, 0]),
    P("run", 3, 1, 1, [0, 0]),
    P("run", 4, 0, 0, [0, 2]),
    P("run", 5, -1, -1, [0, 1]),
  ],
  hurt: [P("hurt", 0, 0, 0, [0, 1], "hurt", -1)],
  cast: [P("cast", 0, 0, 0, [0, 0], "cast"), P("cast", 1, -1, -1, [0, 0], "cast")],
};

function stamp(c: Pix, art: string, x: number, y: number): void {
  c.put(Pix.of(art, "aoi part"), x, y, { outline: "1" });
}

const AOI: HeroDef = {
  id: "aoi",
  head: domeWithHead(),
  headFor(p) {
    const face = p.face === "blink" ? A_FACE_BLINK : p.face === "hurt" ? A_FACE_HURT : p.face === "cast" ? A_FACE_CAST : undefined;
    return domeWithHead(face, p.anim === "hurt");
  },
  faceFor() {
    return "";
  },
  headX: 4,
  headY: 0,
  faces: {},
  legPal: { N: "W", n: "g", S: "W", s: "g", F: "W", f: "g", G: "g", g: "G" },
  drawLegs(c, p) {
    const m = p as MechPose;
    stamp(c, LEG, 6, 19 - m.lift[0]);
    stamp(c, LEG, 13, 19 - m.lift[1]);
  },
  back(c, p) {
    const m = p as MechPose;
    const by = m.body;
    // back arm cannon (behind the torso)
    if (p.anim === "cast") stamp(c, CANNON_UP, 1, 6 + by);
    else stamp(c, SHOULDER, 1, 13 + by);
    // exhaust puff (idle f3) / jet flames (run f2, f5)
    if (p.anim === "idle" && p.i === 3) c.put(Pix.of(".W.\nWgW\n.W."), 0, 10, { outline: "1" });
    if (p.anim === "run" && (p.i === 2 || p.i === 5)) {
      c.put(Pix.of("..yo\n.yzyo\n..yo"), 0, 16 + by);
    }
  },
  body(c, p) {
    const m = p as MechPose;
    const by = m.body;
    stamp(c, MECH_BODY, 3, 11 + by);
    // status light blinks on idle f2
    const lit = p.anim === "idle" ? (p.i === 2 ? "r" : "l") : p.anim === "hurt" ? "r" : "l";
    c.set(14, 17 + by, lit);
  },
  front(c, p, { hx, hy }) {
    const m = p as MechPose;
    const by = m.body;
    // collar ring over the dome base (rides with the dome's suspension bob)
    c.put(COLLAR, 4, 11 + Math.max(by, hy));
    if (p.anim === "cast") {
      stamp(c, CANNON_UP, 18, 6 + by);
      if (p.i === 1) {
        c.put(SPARKLE, hx + 11, hy - 1);
        c.put(SPARK_S, hx - 3, hy + 2);
      } else c.put(SPARK_S, hx + 13, hy);
    } else {
      stamp(c, CANNON, 17, 13 + by);
    }
  },
};

// ============================================================================ portrait

const AH: StrandKeys = { base: "u", shade: "U", light: "v", deep: "n" };

/** Aviator goggles: two round lenses on a strap. `down` = over the eyes with reflected fire. */
function goggles(p: Pix, y: number, down: boolean): void {
  layer(p, (l) => {
    // strap
    l.line(10, y + 2, 56, y + 1, "2").line(10, y + 3, 56, y + 2, "2");
    // frames
    l.ellipse(26, y + 2, 7.5, 6.2, "g");
    l.ellipse(43, y + 2, 6.5, 6, "g");
    l.rect(32, y, 5, 3, "G");
    // lenses
    l.ellipse(26, y + 2, 5.6, 4.4, down ? "o" : "c");
    l.ellipse(43, y + 2, 4.6, 4.2, down ? "o" : "c");
    l.each((x, yy, k) => {
      if (down) {
        // reflected fire: flame tongues licking up from the bottom of each lens, hot core low
        if (k !== "o") return null;
        const tongue = y + 1 - Math.round(Math.abs(Math.sin(x * 1.15)) * 3);
        if (yy < tongue) return "R";
        if (yy === tongue) return "r";
        if (yy > y + 4) return "z";
        if (yy > y + 2) return "y";
        return "o";
      }
      if (k === "c" && x + (yy - y) > 26 + 2 && x < 32) return "C";
      if (k === "c" && x > 45) return "C";
      return null;
    });
    // lens shine
    l.set(23, y, "w").set(24, y - 1, "w").set(22, y + 1, "a").set(41, y, "w").set(42, y - 1, "w");
    if (down) l.set(23, y + 2, "z").set(41, y + 2, "z");
  });
}

/** Pilot glove (white, blue cuff). */
const GLOVE_THUMB = `
....11....
...1ww1...
...1wW1...
...1wW1...
.111wW1...
1wwwwW1111
1wWWWWWWW1
1wWWWWWWg1
1wWWWWWWg1
1wWWWWWgg1
1WWWWWggg1
.1Wgggggg1.
.1uuuuuuU1
.1uvuuuuU1
.1uuuuuuU1
`;

const AOI_P: PortraitDef = {
  hairLine: "n",
  shine: { key: "v", core: "a", on: ["u", "U", "n", "v"] },
  back(p, f) {
    if (f === 1) speedLines(p, 33, 34, 48, 26, "v", 3);
    // wrench tucked behind the ear (far side)
    layer(p, (l) => {
      l.line(50, 36, 61, 20, "g").line(51, 36, 62, 21, "G").line(50, 37, 61, 21, "g");
      l.ellipse(61, 19, 3, 3, "g");
      l.set(62, 17, ".").set(61, 17, ".").set(62, 18, ".");
      l.set(60, 18, "W");
    });
    // bob back hair
    layer(p, (l) => {
      l.ellipse(33, 27, 21, 20, "U");
      l.poly([[13, 30], [53, 30], [52, 48], [14, 48]], "U");
      l.each((x, y, k) => (k === "U" && x > 48 ? "n" : null));
    });
  },
  body(p) {
    // blue/white pilot suit with a collar zip and a mech-shaped patch
    layer(p, (l) => {
      l.poly([[2, 64], [7, 55], [18, 51], [46, 51], [57, 55], [62, 64]], "w");
      l.each((x, y, k) => (k === "w" && x > 46 ? "W" : null));
      l.poly([[2, 64], [7, 55], [14, 53], [12, 64]], "u");
      l.poly([[62, 64], [57, 55], [50, 53], [52, 64]], "U");
      l.rect(25, 51, 16, 3, "u");
      l.line(33, 54, 33, 63, "g");
      l.set(33, 56, "y");
      // "Unit-Aoi" patch: a tiny round mech
      l.ellipse(43, 59, 3, 2.6, "W");
      l.rect(42, 56, 3, 2, "a");
      l.set(41, 62, "G").set(45, 62, "G");
    });
  },
  expr(p, f) {
    const iris: Iris = { D: "U", M: "u", L: "v", K: "n" };
    if (f === 0) {
      eye(p, EYE_NEAR, NEAR_X, EYE_Y, iris);
      eye(p, EYE_FAR, FAR_X, EYE_Y, iris);
      // proud toothy grin
      p.put(
        `
1........1
11111111111
1wwwwwwwww1
.1wwwwwww1.
..1RRRqR1..
...11111...
`,
        33,
        42,
      );
      blush(p, 19, 40, 3);
      blush(p, 46, 40, 2);
    } else {
      // screaming battle cry
      p.put(
        `
..11111111.
.1wwwwwwww1
1000000000w1
10RRRRRRR001
10RqqqqqR01.
.1RRRRRRR1..
..1111111...
`,
        33,
        41,
      );
      blush(p, 18, 41, 4);
      blush(p, 46, 41, 2);
    }
    // plaster across the nose bridge
    layer(p, (l) => {
      l.rect(33, 35, 8, 3, "W");
      l.rect(36, 35, 2, 3, "q");
      l.set(34, 36, "g").set(39, 36, "g");
    });
  },
  crown(l) {
    l.ellipse(33, 18, 21, 15, "u");
    l.each((x, y, k) => (y > 12 ? "." : x > 44 && k === "u" ? "U" : null));
  },
  bangs(l) {
    const h = AH;
    // short bob, flipping out at the jaw
    strand(l, [[16, 13], [11, 26], [11, 38], [8, 46]], 9, 3, h);
    strand(l, [[49, 12], [54, 25], [55, 37], [58, 44]], 8, 3, h, { shadeAt: 0.0 });
    // choppy fringe
    strand(l, [[20, 8], [18, 17], [19, 24]], 9, 1, h);
    strand(l, [[25, 7], [25, 16], [27, 23]], 9, 1, h);
    strand(l, [[30, 6], [31, 15], [30, 24]], 9, 1, h);
    strand(l, [[35, 6], [36, 15], [38, 22]], 8, 1, h);
    strand(l, [[40, 7], [42, 15], [42, 23]], 9, 1, h);
    strand(l, [[45, 8], [47, 16], [48, 22]], 8, 1, h);
    // ahoge
    strand(l, [[36, 4], [40, -1], [44, 1]], 3, 1, h);
  },
  extras(p, f) {
    if (f === 0) {
      goggles(p, 8, false);
      p.put(TWINKLE, 46, 1);
      // thumbs up!
      const g = Pix.of(GLOVE_THUMB, "glove");
      const big = new Pix(g.w * 2, g.h * 2);
      big.each((x, y) => g.get(x >> 1, y >> 1));
      // 2x glove, then re-thin its outline to 1px so it matches the portrait line weight
      const thin = new Pix(big.w, big.h);
      thin.each((x, y) => {
        const k = big.get(x, y);
        if (k !== "1") return k === "." ? null : k;
        const inner = big.get(x - 1, y) !== "1" && big.get(x - 1, y) !== "." && big.get(x + 1, y) !== "." && big.get(x, y - 1) !== "." && big.get(x, y + 1) !== ".";
        return inner ? "1" : null;
      });
      layer(p, (l) => l.put(thin, 44, 36));
      p.put(TWINKLE_S, 3, 24);
    } else {
      goggles(p, 27, true);
      // fist punched at the viewer
      layer(p, (l) => {
        l.ellipse(13, 55, 12, 10, "w");
        for (let i = 0; i < 4; i++) l.ellipse(5 + i * 5.5, 48, 2.8, 3, "w");
        l.each((x, y, k) => (k === "w" && (x > 18 || y > 60) ? "W" : null));
        for (let i = 0; i < 3; i++) l.line(8 + i * 5.5, 46, 8 + i * 5.5, 51, "g");
        l.line(2, 54, 22, 54, "g");
        l.ellipse(9, 58, 6, 2.4, "W");
        l.line(4, 60, 14, 60, "g");
        l.rect(1, 62, 22, 2, "u");
      });
      p.put(TWINKLE, 22, 40);
    }
  },
};

// ============================================================================ ult actor

const STEEL = ["G", "g", "W", "w"];
/** Directional white-armour shade for a box/ellipse region (light top-left). */
function armor(x: number, y: number, x0: number, y0: number, w: number, h: number): string {
  const t = 1 - ((x - x0) / w) * 0.55 - ((y - y0) / h) * 0.55;
  return STEEL[Math.max(0, Math.min(3, Math.round(t * 3.2 - 0.3)))];
}

/**
 * GET IN THE ROBOT!! A giant white-and-blue robot fist seen from above-front,
 * wrist up (it falls knuckles-first). f0 open hand, f1 clenched fist.
 */
function robotFist(f: number): Pix {
  const p = new Pix(48, 48);
  // wrist cuff with caution stripes + blue band
  layer(p, (l) => {
    l.rect(15, 1, 18, 11, (x, y) => armor(x, y, 15, 1, 18, 11));
    for (let y = 2; y < 8; y++) for (let x = 15; x < 33; x++) if ((((x + y) >> 1) & 1) === 0) l.set(x, y, "y");
    for (let y = 2; y < 8; y++) for (let x = 15; x < 33; x++) if (l.get(x, y) !== "y") l.set(x, y, "2");
    l.rect(15, 8, 18, 3, "u");
    l.rect(15, 8, 18, 1, "v");
    l.rect(15, 10, 18, 1, "U");
  });
  if (f === 1) {
    // back of the clenched fist
    layer(p, (l) => {
      l.ellipse(24, 23, 16, 12, (x, y) => armor(x, y, 8, 11, 32, 24));
      // blue armour plate with rivets
      l.poly([[15, 15], [33, 15], [31, 26], [17, 26]], "u");
      l.line(15, 15, 33, 15, "v").line(17, 26, 31, 26, "U");
      l.set(17, 17, "w").set(31, 17, "W").set(18, 24, "W").set(30, 24, "g");
    });
    // knuckles row (falls knuckles-first)
    layer(p, (l) => {
      for (let i = 0; i < 4; i++) {
        const kx = 12.5 + i * 7.7;
        l.ellipse(kx, 36, 4.3, 5.2, (x, y) => armor(x, y, kx - 4, 31, 9, 10));
      }
    });
    layer(p, (l) => {
      for (let i = 0; i < 4; i++) {
        const kx = 12.5 + i * 7.7;
        l.ellipse(kx, 41.5, 3.6, 3, (x, y) => (y > 42 ? "G" : "g"));
      }
    });
    // thumb wrapped on the left
    layer(p, (l) => {
      l.ellipse(9, 27, 5, 7, (x, y) => armor(x, y, 4, 20, 10, 14));
      l.set(7, 23, "w").set(8, 22, "w");
    });
  } else {
    // open hand: palm down, fingers spread
    layer(p, (l) => {
      l.ellipse(24, 21, 15, 10, (x, y) => armor(x, y, 9, 11, 30, 20));
      l.poly([[16, 14], [32, 14], [30, 24], [18, 24]], "u");
      l.line(16, 14, 32, 14, "v").line(18, 24, 30, 24, "U");
      l.set(18, 16, "w").set(30, 16, "W").set(19, 22, "W").set(29, 22, "g");
    });
    layer(p, (l) => {
      const fingers: [number, number, number][] = [[13, 46, 4.5], [20, 47, 4.5], [27, 47, 4.5], [34, 45, 4.2]];
      for (const [fx, fy, w] of fingers) {
        const x0 = fx - (fx - 24) * 0.25;
        for (let y = 26; y <= fy; y++) {
          const cx = x0 + ((fx - x0) * (y - 26)) / (fy - 26);
          for (let x = Math.round(cx - w / 2); x <= Math.round(cx + w / 2); x++) l.set(x, y, armor(x, y, cx - w / 2, 26, w + 2, fy - 26 + 8));
        }
        // joint lines
        const j1 = Math.round(26 + (fy - 26) * 0.4);
        const j2 = Math.round(26 + (fy - 26) * 0.75);
        for (const jy of [j1, j2]) {
          const cx = x0 + ((fx - x0) * (jy - 26)) / (fy - 26);
          l.line(Math.round(cx - w / 2), jy, Math.round(cx + w / 2), jy, "G");
        }
      }
    });
    // thumb out to the left
    layer(p, (l) => {
      l.poly([[10, 18], [4, 26], [2, 33], [6, 34], [10, 28], [14, 24]], "W");
      l.set(4, 28, "w").set(5, 26, "w").line(9, 27, 6, 32, "g");
    });
  }
  // rivets
  for (const [x, y] of [[13, 19], [35, 19], [24, 13], [13, 27], [35, 27]] as [number, number][]) if (p.get(x, y) !== "." && p.get(x, y) !== "1") p.set(x, y, "G");
  p.outline("1");
  return p;
}

export const sprites: SpriteDef[] = [
  ...heroSprites(AOI, MECH_POSES, AOI_PAL),
  gridSprite("ult_robot_fist", 48, 48, [robotFist(0), robotFist(1)], "center"),
  gridSprite("portrait_aoi", 64, 64, [paintPortrait(AOI_P, 0), paintPortrait(AOI_P, 1)], "center"),
];
