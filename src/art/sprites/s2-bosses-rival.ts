/**
 * RIVAL-CHAN (owner "s2-bosses"), The Final Arc 14:00 mid boss.
 * boss_rival 48x56x6, feet pivot (24, 55), faces right.
 *   f0-1 idle bounce (fighting stance, fists up, headband tails sway),
 *   f2 dash (low lunge + afterimage + speed lines: Dash Slash),
 *   f3 beam cast (both palms forward, charging energy ball: Rival Beam),
 *   f4 frustrated (gritted teeth, fists down, anger vein, angry tears),
 *   f5 power-up (flame aura, hair flared, headband tails up: "I'VE BEEN TRAINING!").
 * Spiky black hair with crimson tips, a red headband with long tails, a cheek
 * plaster, a white training gi (rolled sleeves, yellow star patch, red belt),
 * navy gi pants, taped fists and a smug fanged grin.
 * Docs: docs/content/enemies.md §5.8.
 */
import type { SpriteDef } from "../format";
import { Pix, animeEye, ball, gridSprite, layer, range, sparkle, strand, type StrandKeys } from "./s2-bosses-util";

type P2 = [number, number];
const HAIR: StrandKeys = { base: "x", shade: "X", light: "f" };
const SKIN: StrandKeys = { base: "s", shade: "k", light: "t" };
const GI: StrandKeys = { base: "W", shade: "g", light: "w", deep: "G" };
const PANTS: StrandKeys = { base: "n", shade: "X", light: "U" };
const BAND: StrandKeys = { base: "W", shade: "g", light: "w", deep: "G" };
/** local glow keys: afterimage / aura alpha (red-orange) */
const PAL = { "+": "#ff7a2d40", "*": "#ff7a2d88", "=": "#ffb03dcc" };

interface Pose {
  /** head centre */
  head: P2;
  /** neck base and hip centre (torso axis) */
  neck: P2;
  hip: P2;
  /** back (screen-left) and front (screen-right) limbs: [root, joint, end] */
  bArm: [P2, P2, P2];
  fArm: [P2, P2, P2];
  bLeg: [P2, P2, P2];
  fLeg: [P2, P2, P2];
  hands: "fists" | "palms" | "down";
  face: "smug" | "dash" | "shout" | "grit" | "yell";
  /** hair spikes flare upward (power-up) */
  flare: number;
  /** headband tails: angle of travel (radians, PI = straight back/left) + wave phase */
  tails: { ang: number; phase: number; len: number };
}

const POSES: Pose[] = [
  // f0 idle: boxer stance, fists up
  {
    head: [22, 18],
    neck: [21, 29],
    hip: [21, 40],
    bArm: [[16, 31], [15, 37], [23, 33]],
    fArm: [[26, 31], [32, 36], [34, 29]],
    bLeg: [[18, 41], [14, 47], [12, 54]],
    fLeg: [[25, 41], [30, 46], [31, 54]],
    hands: "fists",
    face: "smug",
    flare: 0,
    tails: { ang: Math.PI - 0.35, phase: 0, len: 15 },
  },
  // f1 idle: bounce down 1px, tails sway
  {
    head: [22, 19],
    neck: [21, 30],
    hip: [21, 41],
    bArm: [[16, 32], [15, 38], [23, 34]],
    fArm: [[26, 32], [32, 37], [34, 30]],
    bLeg: [[18, 42], [13, 48], [12, 54]],
    fLeg: [[25, 42], [31, 47], [31, 54]],
    hands: "fists",
    face: "smug",
    flare: 0,
    tails: { ang: Math.PI - 0.15, phase: 1.8, len: 15 },
  },
  // f2 dash: low forward lunge, back leg stretched, front fist leading
  {
    head: [29, 25],
    neck: [26, 34],
    hip: [19, 42],
    bArm: [[21, 36], [15, 39], [10, 36]],
    fArm: [[29, 36], [35, 38], [41, 36]],
    bLeg: [[17, 43], [9, 48], [3, 53]],
    fLeg: [[23, 43], [30, 47], [31, 54]],
    hands: "fists",
    face: "dash",
    flare: 0,
    tails: { ang: Math.PI + 0.1, phase: 0.8, len: 17 },
  },
  // f3 beam cast: wide stance, both palms thrust forward at chest height
  {
    head: [20, 18],
    neck: [19, 29],
    hip: [19, 40],
    bArm: [[15, 31], [24, 34], [33, 32]],
    fArm: [[23, 31], [29, 33], [35, 34]],
    bLeg: [[16, 41], [11, 47], [9, 54]],
    fLeg: [[23, 41], [29, 46], [32, 54]],
    hands: "palms",
    face: "shout",
    flare: 0.25,
    tails: { ang: Math.PI - 0.5, phase: 2.2, len: 16 },
  },
  // f4 frustrated: fists clenched down at her sides, stomping
  {
    head: [22, 19],
    neck: [21, 30],
    hip: [21, 41],
    bArm: [[16, 32], [14, 37], [14, 42]],
    fArm: [[26, 32], [28, 37], [28, 42]],
    bLeg: [[18, 42], [16, 48], [15, 54]],
    fLeg: [[24, 42], [27, 48], [28, 54]],
    hands: "down",
    face: "grit",
    flare: 0,
    tails: { ang: Math.PI * 0.5 + 0.45, phase: 0, len: 12 },
  },
  // f5 power-up: crouched, fists low and wide, screaming, everything flares up
  {
    head: [22, 21],
    neck: [21, 31],
    hip: [21, 42],
    bArm: [[16, 33], [11, 37], [10, 43]],
    fArm: [[26, 33], [31, 37], [32, 43]],
    bLeg: [[18, 43], [12, 48], [11, 54]],
    fLeg: [[24, 43], [31, 48], [32, 54]],
    hands: "down",
    face: "yell",
    flare: 1,
    tails: { ang: -Math.PI * 0.78, phase: 1.1, len: 16 },
  },
];

// ---------------------------------------------------------------------------- parts
/** Taped fist (4x4-ish ball of skin with white tape bands). */
function fist(p: Pix, x: number, y: number): void {
  layer(p, (l) => {
    ball(l, x, y, 2.4, 2.2, ["k", "s", "s", "t"]);
    // tape wraps across the knuckles + wrist
    l.set(x - 1, y - 1, "w").set(x, y - 1, "W").set(x + 1, y, "W").set(x - 1, y + 1, "W");
  });
}

/** Open palm thrust forward (fingers up). */
function palm(p: Pix, x: number, y: number): void {
  layer(p, (l) => {
    l.rect(x - 1, y - 2, 3, 4, "s");
    l.rect(x - 1, y - 4, 1, 2, "s").set(x, y - 4, "t").rect(x + 1, y - 3, 1, 1, "s");
    l.set(x + 1, y - 2, "k").set(x + 1, y - 1, "k").set(x + 1, y, "k");
    l.set(x - 1, y + 1, "W").set(x, y + 1, "w");
  });
}

function legs(p: Pix, pose: Pose): void {
  for (const [leg, keys] of [
    [pose.bLeg, { ...PANTS, base: "X", light: "n", shade: "0" }],
    [pose.fLeg, PANTS],
  ] as [[P2, P2, P2], StrandKeys][]) {
    layer(p, (l) => {
      // baggy gi pants, tapered to the ankle
      strand(l, [leg[0], leg[1], [leg[2][0], leg[2][1] - 2]], 6.5, 4, keys, { shadeAt: 0.25 });
      // ankle wrap + slipper
      const [fx, fy] = leg[2];
      l.rect(fx - 1, fy - 2, 3, 1, "W");
      l.rect(fx - 2, fy - 1, 5, 2, "2");
      l.set(fx + 3, fy, "2").set(fx - 2, fy - 1, "G");
    });
  }
}

function torso(p: Pix, pose: Pose): void {
  const [nx, ny] = pose.neck;
  const [hx, hy] = pose.hip;
  layer(p, (l) => {
    // gi top: broad shoulders tapering to the belt, slight flare below it
    l.poly(
      [
        [nx - 6, ny + 1],
        [nx + 6, ny + 1],
        [hx + 6, hy - 2],
        [hx + 7, hy + 2],
        [hx - 7, hy + 2],
        [hx - 6, hy - 2],
      ],
      "W",
    );
    // shading: lit top-left, shadow down the right side + under the belt
    l.each((x, y, k) => {
      if (k !== "W") return null;
      const t = (y - ny) / Math.max(1, hy - ny);
      const cx = nx + (hx - nx) * t;
      if (x > cx + 4) return "g";
      if (x < cx - 3 && y < ny + 6) return "w";
      return null;
    });
    // crossed lapels (left over right) showing a dark V of undershirt
    l.poly([[nx - 2, ny + 1], [nx + 3, ny + 1], [nx + 1, ny + 6]], "2");
    l.line(nx - 3, ny + 1, nx + 2, ny + 8, "g");
    l.line(nx + 4, ny + 1, nx + 2, ny + 6, "G");
    // red belt + knot with hanging ends
    l.line(hx - 6, hy - 1, hx + 6, hy - 1, "r");
    l.line(hx - 6, hy, hx + 6, hy, "R");
    l.rect(hx + 1, hy - 1, 2, 2, "r");
    l.line(hx + 1, hy + 1, hx, hy + 5, "R");
    l.line(hx + 2, hy + 1, hx + 4, hy + 4, "r");
  });
  // yellow star patch on the chest (near shoulder)
  const sx = nx - 3;
  const sy = ny + 4;
  p.put(
    `
..y..
.yyy.
yyzyY
.yYY.
.Y.Y.
`,
    sx - 2,
    sy - 2,
    { outline: "1" },
  );
}

function arm(p: Pix, a: [P2, P2, P2], back: boolean): void {
  layer(p, (l) => {
    // rolled gi sleeve over the shoulder, then bare arm
    const [s, e, h] = a;
    const mid: P2 = [s[0] + (e[0] - s[0]) * 0.55, s[1] + (e[1] - s[1]) * 0.55];
    strand(l, [s, e, h], 3.2, 3, back ? { ...SKIN, base: "k", light: "s", shade: "k" } : SKIN);
    strand(l, [s, mid], 5, 4.4, back ? { ...GI, base: "g", light: "W", shade: "G" } : GI);
  });
}

/** Spikes [root, mid, tip] relative to the head centre, idle shape (sweeping back/up). */
const SPIKES: { pts: [P2, P2, P2]; w: number }[] = [
  { pts: [[-4, 1], [-12, 1], [-19, 4]], w: 9 },
  { pts: [[-3, 3], [-10, 7], [-14, 12]], w: 8 },
  { pts: [[-4, -2], [-12, -6], [-18, -9]], w: 10 },
  { pts: [[-4, -3], [-9, -11], [-13, -16]], w: 10 },
  { pts: [[-2, -4], [-3, -12], [-1, -18]], w: 10 },
  { pts: [[1, -4], [5, -11], [9, -15]], w: 9 },
  { pts: [[4, -3], [10, -7], [14, -8]], w: 6 },
];

function hairBack(p: Pix, pose: Pose): void {
  const [hx, hy] = pose.head;
  const fl = pose.flare;
  layer(p, (l) => {
    l.ellipse(hx - 0.5, hy - 1, 9.6, 9.2, "x");
    for (const sp of SPIKES) {
      const pts = sp.pts.map(([x, y], i): P2 => {
        if (!fl || i === 0) return [hx + x, hy + y];
        // power-up: every spike swings toward straight up and grows
        const a = Math.atan2(y, x);
        const r = Math.hypot(x, y) + fl * 1.0 * i;
        const up = -Math.PI / 2;
        let da = up - a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const b = a + da * 0.55 * fl;
        return [hx + Math.cos(b) * r, hy + Math.sin(b) * r];
      });
      strand(l, pts, sp.w, 1, HAIR, { shadeAt: 0.35, lightAt: -0.6 });
    }
    // red-black: black at the scalp, crimson spikes, hot red tips (reads on dark paper too)
    l.each((x, y, k) => {
      if (k === ".") return null;
      const d = Math.hypot(x - hx, y - (hy - 1));
      if (d < 9.5 + fl) return null;
      if (d > 13.5 + fl * 2) return k === "X" || k === "0" ? "R" : k === "f" ? "o" : "r";
      return k === "X" || k === "0" ? "2" : k === "f" ? "r" : "R";
    });
  });
}

function face(p: Pix, pose: Pose): void {
  const [hx, hy] = pose.head;
  layer(p, (l) => {
    l.poly([[hx - 8, hy - 4], [hx - 3, hy - 8], [hx + 6, hy - 7], [hx + 9, hy - 1], [hx + 8, hy + 5], [hx + 5, hy + 9], [hx + 1, hy + 10], [hx - 4, hy + 8], [hx - 8, hy + 4]], "s");
    l.each((x, y, k) => (k === "s" && (x < hx - 6 || y > hy + 7) ? "k" : k === "s" && x > hx + 4 && y < hy - 1 ? "t" : null));
  });
  const ey = hy - 1;
  const iris = { dark: "O", mid: "o", light: "y", pupil: "0" };
  const k = pose.face;
  if (k === "grit") {
    // teary furious eyes: tiny pupils, wet lower rim
    for (const [x0, w] of [[hx - 6, 5], [hx + 3, 4]] as [number, number][]) {
      p.rect(x0, ey + 1, w, 4, "w");
      p.line(x0, ey, x0 + w - 1, ey + (x0 < hx ? 1 : -0) * 0, "0");
      p.set(x0 + Math.floor(w / 2), ey + 2, "o").set(x0 + Math.floor(w / 2), ey + 3, "O");
      p.line(x0, ey + 5, x0 + w - 1, ey + 5, "a");
    }
    p.set(hx - 6, ey + 6, "a").set(hx - 6, ey + 7, "v");
  } else if (k === "yell") {
    // eyes squeezed shut in a battle scream: > <
    p.line(hx - 6, ey + 1, hx - 3, ey + 3, "0").line(hx - 6, ey + 5, hx - 3, ey + 3, "0");
    p.line(hx + 6, ey + 1, hx + 3, ey + 3, "0").line(hx + 6, ey + 5, hx + 3, ey + 3, "0");
  } else {
    animeEye(p, hx - 6, ey, 5, 6, iris, { lash: -1, round: "s" });
    animeEye(p, hx + 3, ey, 4, 6, iris, { lash: 1, round: "s" });
    if (k === "smug") {
      // cocky half-lidded eyes
      p.line(hx - 6, ey + 1, hx - 2, ey + 1, "0").line(hx + 3, ey + 1, hx + 6, ey + 1, "0");
      p.set(hx - 5, ey + 2, "w").set(hx + 4, ey + 2, "w");
    }
  }
  // cheek plaster on the near cheek
  p.put(
    `
BhB
`,
    hx - 7,
    hy + 3,
    { outline: "1" },
  );
  // blush on the far cheek
  p.set(hx + 6, hy + 5, "b").set(hx + 7, hy + 5, "b");
  // mouth
  if (k === "smug") {
    // lopsided smug grin with one fang
    p.line(hx, hy + 6, hx + 5, hy + 5, "1");
    p.set(hx - 1, hy + 5, "1");
    p.set(hx + 4, hy + 6, "w").set(hx + 4, hy + 7, "1");
  } else if (k === "dash") {
    p.line(hx + 1, hy + 6, hx + 5, hy + 6, "1");
    p.set(hx + 2, hy + 7, "w").set(hx + 3, hy + 7, "w").set(hx + 4, hy + 7, "1");
  } else if (k === "grit") {
    p.put(`
1111111
1wwwww1
1w1w1w1
1111111
`, hx - 1, hy + 4);
  } else {
    // shout / yell: big open mouth with a fang
    p.put(`
111111
10ww01
100001
10rr01
.1111.
`, hx, hy + 4);
    p.set(hx + 3, hy + 6, "w");
  }
}

/** Brows over the fringe: sharp, slanted, cocky. */
function brows(p: Pix, pose: Pose): void {
  const [hx, hy] = pose.head;
  const ey = hy - 1;
  const k = pose.face;
  const drop = k === "grit" || k === "yell" || k === "shout" ? 2 : k === "smug" ? 1 : 2;
  p.line(hx - 7, ey - 3, hx - 2, ey - 3 + drop, "0");
  p.line(hx - 7, ey - 4, hx - 3, ey - 4 + drop, "1");
  p.line(hx + 3, ey - 3 + drop + (k === "smug" ? -2 : 0), hx + 7, ey - 3 + (k === "smug" ? -1 : 0), "0");
}

function bangsAndBand(p: Pix, pose: Pose): void {
  const [hx, hy] = pose.head;
  // headband tails streaming from the knot at the back of the head
  const { ang, phase, len } = pose.tails;
  const kx = hx - 11;
  const ky = hy - 4;
  for (let t = 0; t < 2; t++) {
    const pts: P2[] = [];
    for (let i = 0; i <= 6; i++) {
      const s = i / 6;
      const L = s * (len - t * 4);
      const wav = Math.sin(s * 5.5 + phase + t * 1.7) * 1.8 * s;
      const a = ang + (t ? 0.32 : 0);
      pts.push([kx + Math.cos(a) * L - Math.sin(a) * wav, ky + Math.sin(a) * L + Math.cos(a) * wav]);
    }
    layer(p, (l) => strand(l, pts, 2.6, 2.2, BAND, { shadeAt: 0.1 }), "1");
  }
  // jagged spiky fringe (spills out under the headband)
  layer(p, (l) => {
    const locks: [number, number, number, number][] = [
      // root x, tip x, tip y, width
      [hx - 6, hx - 7, hy - 3, 4],
      [hx - 1, hx - 2, hy - 3, 4],
      [hx + 4, hx + 5, hy - 4, 4],
      [hx + 8, hx + 10, hy - 2, 3],
    ];
    for (const [rx, tx, ty, w] of locks) strand(l, [[rx, hy - 9], [rx + (tx - rx) * 0.4, hy - 7], [tx, ty]], w, 1, HAIR, { shadeAt: 0.3 });
    // short side lock by the ear (behind the cheek line)
    strand(l, [[hx - 9, hy - 6], [hx - 10, hy - 1], [hx - 11, hy + 3]], 3, 1, HAIR);
  });
  // the headband itself, tied OVER the hair along the hairline, knot at the back
  layer(p, (l) => {
    for (let x = hx - 9; x <= hx + 9; x++) {
      const y = Math.round(hy - 7 + Math.max(0, hx - 2 - x) * 0.22);
      l.set(x, y, x < hx - 3 ? "w" : "W");
      l.set(x, y + 1, x > hx + 5 ? "g" : "W");
    }
    l.rect(hx - 12, hy - 6, 3, 3, "W");
    l.set(hx - 12, hy - 6, "w").set(hx - 10, hy - 4, "g").set(hx - 11, hy - 5, "g");
  });
  // glossy sheen on the crown
  for (const [dx, dy] of [[-4, -9], [-3, -10], [-2, -10], [1, -10], [2, -10]] as P2[]) {
    const k = p.get(hx + dx, hy + dy);
    if (k === "x" || k === "X") p.set(hx + dx, hy + dy, "f");
  }
}

// ---------------------------------------------------------------------------- frame
function body(pose: Pose): Pix {
  const p = new Pix(48, 56);
  hairBack(p, pose);
  // headband tails sit behind the body when they stream back
  arm(p, pose.bArm, true);
  legs(p, pose);
  torso(p, pose);
  face(p, pose);
  bangsAndBand(p, pose);
  brows(p, pose);
  arm(p, pose.fArm, false);
  // hands
  if (pose.hands === "palms") {
    palm(p, pose.bArm[2][0], pose.bArm[2][1]);
    palm(p, pose.fArm[2][0], pose.fArm[2][1]);
  } else {
    fist(p, pose.bArm[2][0], pose.bArm[2][1]);
    fist(p, pose.fArm[2][0], pose.fArm[2][1]);
  }
  return p;
}

function rival(f: number): Pix {
  const pose = POSES[f];
  const p = new Pix(48, 56);
  const me = body(pose);
  if (f === 2) {
    // motion smear: horizontal streaks trailing from the back edge of the silhouette
    for (let y = 8; y < 56; y += 2) {
      let x0 = -1;
      for (let x = 0; x < 48; x++)
        if (me.solid(x, y)) {
          x0 = x;
          break;
        }
      if (x0 < 2) continue;
      const len = 5 + Math.round(6 * Math.abs(Math.sin(y * 0.9)));
      for (let i = 1; i <= len && x0 - i >= 0; i++) p.set(x0 - i, y, i <= 2 ? "=" : i <= len * 0.6 ? "*" : "+");
    }
    for (const [y, x0, len] of [[12, 0, 6], [20, 1, 4]] as [number, number, number][]) p.line(x0, y, x0 + len, y, "w");
  }
  if (f === 5) {
    // flame aura: the body silhouette grown outward, with tongues of fire licking upward
    const m = me.clone();
    const aura = new Pix(48, 56);
    const tongue = (x: number) => 3 + Math.round(4 * Math.abs(Math.sin(x * 0.55)) + 3 * Math.abs(Math.sin(x * 0.23 + 1)));
    for (let y = 0; y < 56; y++)
      for (let x = 0; x < 48; x++) {
        if (m.solid(x, y)) continue;
        let best = 99;
        for (let dy = -2; dy <= 10; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            if (!m.solid(x + dx, y + dy)) continue;
            // distance with upward stretch: flames rise, so below-the-body counts more
            const d = Math.hypot(dx, dy > 0 ? dy / (tongue(x) / 3) : dy * 1.5);
            if (d < best) best = d;
          }
        if (best <= 1.2) aura.set(x, y, "y");
        else if (best <= 2.3) aura.set(x, y, "o");
        else if (best <= 3.3) aura.set(x, y, "=");
        else if (best <= 4.2) aura.set(x, y, "*");
      }
    p.put(aura, 0, 0);
  }
  p.put(me, 0, 0);
  if (f === 3) {
    // charging energy ball between the palms
    layer(p, (l) => {
      ball(l, 41, 28, 4.6, 4.6, ["r", "o", "y", "z"]);
      l.ellipse(41.5, 28, 2, 2, "w");
    }, "R");
    for (const [x, y] of [[44, 21], [46, 33], [38, 22]] as P2[]) sparkle(p, x, y, 1);
  } else if (f === 4) {
    // anger vein + stomp dust
    p.put(`
1.1
.1.
1.1
`, 30, 4);
    for (const [x, y] of [[24, 53], [34, 53]] as P2[]) p.line(x, y, x + (x < 29 ? -3 : 3), y - 2, "g");
  } else if (f === 5) {
    for (const [x, y, s] of [[5, 12, 1], [42, 8, 2], [40, 28, 1], [6, 34, 1]] as [number, number, 0 | 1 | 2][]) sparkle(p, x, y, s);
  } else if (f <= 1) {
    sparkle(p, 40, 12 + f, 0);
  }
  return p;
}

export const sprites: SpriteDef[] = [gridSprite("boss_rival", 48, 56, range(6).map(rival), "feet", { fps: 6, pal: PAL })];
