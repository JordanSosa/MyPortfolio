/**
 * KRAKEN-CHAN (owner "s2-bosses"), Beach Episode 8:00 mid boss.
 * boss_kraken 72x56x6, feet pivot (36, 55), faces right.
 *   f0-1 bob / tentacle wiggle, f2 ink cannon (cheeks puffed, ink dribble),
 *   f3 half submerged in the sand (eyes peeking), f4 rise (sand + water splash),
 *   f5 blush (death hug: ^^ eyes, big blush, hearts).
 * boss_kraken_tentacle 16x48x4, feet pivot (8, 47): f0 tip emerging, f1 fully
 * up, f2 slam (whips down onto the sand, impact), f3 sinking.
 * A round, chubby cartoon octopus with bath-toy proportions (never humanoid):
 * coral-pink dome with lighter spots, huge sparkly eyes, blush, a white sailor
 * hat with a navy ribbon, 6 stubby curled tentacles. Docs: enemies.md §5.5.
 */
import type { SpriteDef } from "../format";
import { Pix, ball, capsule, gridSprite, hash2, layer, range, sparkle, strand } from "./s2-bosses-util";

type P2 = [number, number];
/** local coral ramp (shadows lean magenta, lights lean peach) */
const PAL = { "4": "#b83a66", "5": "#ef5f7c", "6": "#ff8f8c", "7": "#ffc2b0", "8": "#ffe6da" };
const CORAL = ["4", "5", "6", "6", "7"];
const SAND = ["h", "F", "B"];

/** Stubby curled tentacle from (x, y0) down to the tip; curl -1 left / +1 right. */
function tentacle(l: Pix, x: number, y0: number, len: number, curl: number, phase: number, w = 7): void {
  const pts: P2[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    pts.push([x + Math.sin(t * 2.2 + phase) * 1.4 + curl * t * t * 4, y0 + t * len]);
  }
  // curled tip
  const [tx, ty] = pts[4];
  pts.push([tx + curl * 2.5, ty + 1.5]);
  pts.push([tx + curl * 3.5, ty - 0.5]);
  strand(l, pts, w, 3, { base: "5", shade: "4", light: "6" }, { shadeAt: 0.3, lightAt: -0.4 });
}

function suckers(p: Pix, x: number, y0: number, len: number, curl: number): void {
  for (let t = 0.45; t < 1; t += 0.22) {
    const sx = Math.round(x + curl * t * t * 4 + 1);
    const sy = Math.round(y0 + t * len);
    if (p.get(sx, sy) !== "." && p.get(sx, sy) !== "1") p.set(sx, sy, "8");
  }
}

interface Face {
  kind: "happy" | "puff" | "peek" | "rise" | "blush";
}

function sailorHat(p: Pix, cx: number, y: number, tilt: number): void {
  layer(p, (l) => {
    // crown
    l.poly([[cx - 7, y + 6 + tilt], [cx - 5, y], [cx + 5, y - tilt * 0.5], [cx + 7, y + 6]], "W");
    l.each((x, yy, k) => (k === "W" && x < cx - 2 ? "w" : k === "W" && x > cx + 4 ? "g" : null));
    // navy band
    l.line(cx - 7, y + 4 + tilt, cx + 7, y + 4 - 0, "n");
    l.line(cx - 7, y + 5 + tilt, cx + 7, y + 5, "U");
    // brim
    l.ellipse(cx, y + 7, 10, 2.3, "W");
    l.each((x, yy, k) => (k === "W" && yy >= y + 7 ? "g" : k === "W" && x < cx - 4 ? "w" : null));
  });
  // ribbon tails fluttering at the back (left)
  layer(p, (l) => {
    l.line(cx - 7, y + 5, cx - 11, y + 10, "n");
    l.line(cx - 6, y + 5, cx - 9, y + 11, "U");
    l.set(cx - 12, y + 10, "n").set(cx - 10, y + 11, "U");
  });
  // tiny anchor
  p.set(cx + 1, y + 2, "n").set(cx + 1, y + 3, "n").set(cx, y + 3, "U").set(cx + 2, y + 3, "U");
}

function eye(p: Pix, cx: number, cy: number, kind: Face["kind"]): void {
  if (kind === "blush") {
    // happy ^^ arcs
    p.line(cx - 3, cy + 1, cx - 1, cy - 1, "0").line(cx - 1, cy - 1, cx + 1, cy - 1, "0").line(cx + 1, cy - 1, cx + 3, cy + 1, "0");
    p.line(cx - 3, cy + 2, cx - 1, cy, "1").line(cx + 1, cy, cx + 3, cy + 2, "1");
    return;
  }
  if (kind === "puff") {
    // squeezed > < effort eyes
    p.line(cx - 3, cy - 2, cx + 1, cy, "0").line(cx + 1, cy, cx - 3, cy + 2, "0");
    return;
  }
  layer(p, (l) => {
    l.ellipse(cx, cy, 4.2, 5.4, "0");
    // deep navy iris gradient at the bottom
    l.ellipse(cx, cy + 2.2, 3.2, 2.6, "n");
    l.ellipse(cx + 0.5, cy + 3, 2.2, 1.4, "U");
    l.set(cx + 1, cy + 4, "u");
  }, "1");
  // big glossy highlights + a sparkle
  p.rect(cx - 2, cy - 3, 2, 2, "w").set(cx - 2, cy - 1, "w");
  p.set(cx + 2, cy + 1, "w");
  p.set(cx + 1, cy - 3, "a");
}

function body(f: number, o: { dy: number; puff: number; face: Face["kind"]; tPhase: number; spread: number }): Pix {
  const p = new Pix(72, 56);
  const cx = 36;
  const cy = 30 + o.dy;
  // tentacles behind (back row: 3) then front row (3)
  const tents: [number, number, number][] = [
    [17, -1, 0],
    [26, -1, 1],
    [35, 0, 2],
    [44, 1, 3],
    [53, 1, 4],
    [60, 1, 5],
  ];
  layer(p, (l) => {
    for (const [tx, curl, i] of tents) {
      if (i % 2 === 0) continue;
      const sx = (tx - cx) * o.spread;
      tentacle(l, cx + sx * 1, cy + 12, 10 + (i === 3 ? 1 : 0), curl * (1.3 + o.spread * 0.5), o.tPhase + i * 1.3, 8.5);
    }
  });
  layer(p, (l) => {
    for (const [tx, curl, i] of tents) {
      if (i % 2 === 1) continue;
      const sx = (tx - cx) * o.spread;
      tentacle(l, cx + sx * 1, cy + 14, 9, curl * (1.3 + o.spread * 0.5), o.tPhase + i * 1.3 + 2, 9);
    }
  });
  for (const [tx, curl, i] of tents) {
    const sx = (tx - cx) * o.spread;
    suckers(p, cx + sx, cy + 14 + (i % 2), 9, curl);
  }
  // the dome
  const rx = 23 + o.puff * 2;
  const ry = 19.5 - o.puff * 0.5;
  layer(p, (l) => {
    ball(l, cx, cy, rx, ry, CORAL, { spec: "8", specAt: 0.93 });
    // puffed cheeks bulge
    if (o.puff) {
      ball(l, cx - 11, cy + 6, 9, 7, CORAL);
      ball(l, cx + 13, cy + 6, 9, 7, CORAL);
    }
    // lighter spots (bath-toy freckles), more on the lit side
    const spots: [number, number, number][] = [
      [cx - 12, cy - 9, 2.6],
      [cx - 5, cy - 14, 1.8],
      [cx - 17, cy - 1, 1.6],
      [cx + 10, cy - 13, 1.5],
      [cx + 16, cy - 6, 1.3],
      [cx - 8, cy - 4, 1.2],
    ];
    for (const [sx, sy, r] of spots) l.ellipse(sx, sy, r, r * 0.9, (x, y) => (l.get(x, y) === "4" ? "5" : l.get(x, y) === "." ? null : "7"));
  });
  // face (turned slightly right)
  const fx = cx + 3;
  const fy = cy + 3;
  if (o.face === "peek") {
    eye(p, fx - 8, fy - 2, "happy");
    eye(p, fx + 8, fy - 2, "happy");
  } else {
    eye(p, fx - 8, fy, o.face);
    eye(p, fx + 8, fy, o.face);
  }
  // blush
  const blushY = fy + 6;
  const bl = o.face === "blush" ? 3 : 2;
  for (const bx of [fx - 14, fx + 11]) {
    for (let i = 0; i < 4; i++) p.set(bx + i, blushY, "b");
    if (bl > 2) for (let i = 0; i < 4; i++) p.set(bx + i, blushY + 1, "b");
    p.set(bx + 1, blushY - 1, "q");
  }
  // mouth
  if (o.face === "puff") {
    // puckered cannon mouth with ink
    p.put(`
.111.
1I0I1
1000 1
.111.
`.replace(" ", "1"), fx - 2, fy + 7);
    p.set(fx, fy + 11, "I").set(fx, fy + 12, "2").set(fx + 1, fy + 11, "I");
  } else if (o.face === "rise") {
    p.put(`
11111
10001
1rrr1
.111.
`, fx - 2, fy + 6);
  } else if (o.face !== "peek") {
    // omega cat mouth
    p.set(fx - 2, fy + 7, "1").set(fx - 1, fy + 8, "1").set(fx, fy + 7, "1").set(fx + 1, fy + 8, "1").set(fx + 2, fy + 7, "1");
  }
  // sailor hat
  sailorHat(p, cx + 4, cy - 23 + (o.face === "rise" ? -1 : 0), o.face === "blush" ? 1 : 0);
  return p;
}

/** Sand mound/ripple ring hiding the bottom of the sprite (submerge / rise). */
function sandRing(p: Pix, cx: number, y: number, rx: number, splash: boolean): void {
  // everything below the waterline is hidden by a sand berm
  for (let yy = y; yy < 56; yy++) for (let x = 0; x < 72; x++) p.set(x, yy, ".");
  layer(p, (l) => {
    ball(l, cx, y + 1, rx, 3.6, ["h", "F", "B", "B"], { ly: -1.5 });
    // ripple grains
    for (let i = 0; i < 18; i++) {
      const x = Math.round(cx - rx + 2 + hash2(i, 9, 4) * (rx * 2 - 4));
      const yy = Math.round(y + hash2(i, 8, 4) * 3);
      if (l.get(x, yy) !== ".") l.set(x, yy, i % 3 ? "h" : "H");
    }
  }, "H");
  if (splash) {
    // flying sand clods + sea-water droplets
    for (const [x, yy, k] of [[10, 34, "F"], [6, 26, "a"], [16, 22, "a"], [62, 30, "F"], [66, 22, "a"], [57, 18, "a"], [3, 40, "h"], [69, 40, "h"]] as [number, number, string][]) {
      layer(p, (l) => l.ellipse(x, yy, 1.4, 1.4, k), k === "a" ? "C" : "H");
      p.set(x - 1, yy - 1, "w");
    }
  }
}

function kraken(f: number): Pix {
  switch (f) {
    case 0:
      return body(f, { dy: 0, puff: 0, face: "happy", tPhase: 0, spread: 1 });
    case 1: {
      const p = body(f, { dy: -2, puff: 0, face: "happy", tPhase: 1.6, spread: 1.05 });
      sparkle(p, 66, 10, 1);
      return p;
    }
    case 2: {
      const p = body(f, { dy: 0, puff: 1, face: "puff", tPhase: 0.8, spread: 1.08 });
      // ink-cannon tell: little ink bubbles
      for (const [x, y] of [[33, 50], [44, 51]] as P2[]) layer(p, (l) => l.ellipse(x, y, 1.6, 1.6, "I"), "2");
      return p;
    }
    case 3: {
      const p = body(f, { dy: 9, puff: 0, face: "peek", tPhase: 0.4, spread: 1 });
      sandRing(p, 36, 48, 27, false);
      // nervous sweat drop
      p.set(61, 30, "a").set(61, 31, "a").set(60, 32, "C");
      return p;
    }
    case 4: {
      const p = body(f, { dy: -4, puff: 0, face: "rise", tPhase: 2.4, spread: 1.15 });
      sandRing(p, 36, 50, 30, true);
      return p;
    }
    default: {
      const p = body(f, { dy: 0, puff: 0, face: "blush", tPhase: 1.1, spread: 0.95 });
      // floating hearts
      for (const [x, y] of [[8, 8], [63, 4], [66, 16]] as P2[]) {
        p.put(`
.1.1.
1r1r1
1rrr1
.1r1.
..1..
`, x - 2, y - 2);
        p.set(x - 1, y - 1, "w");
      }
      return p;
    }
  }
}

// ---------------------------------------------------------------------------- tentacle actor
function bigTentacle(f: number): Pix {
  const p = new Pix(16, 48);
  const ground = 46;
  const shapes: { pts: P2[]; w0: number; ring: number; splash?: boolean }[] = [
    // f0 tip emerging
    { pts: [[7, ground + 2], [7, ground - 5], [9, ground - 9], [11, ground - 8]], w0: 8, ring: 6 },
    // f1 fully up, S-curve, curled tip
    { pts: [[7, ground + 2], [6, ground - 12], [9, ground - 24], [7, ground - 34], [4, ground - 40], [7, ground - 42], [8, ground - 39]], w0: 9, ring: 6 },
    // f2 slam: whipped down, low arch onto the sand, impact
    { pts: [[6, ground + 2], [6, ground - 6], [8, ground - 11], [12, ground - 10], [14, ground - 5], [14, ground - 1]], w0: 11, ring: 7, splash: true },
    // f3 sinking (half height, drooping)
    { pts: [[7, ground + 2], [7, ground - 10], [9, ground - 17], [12, ground - 18], [12, ground - 15]], w0: 8, ring: 6 },
  ];
  const sh = shapes[f];
  layer(p, (l) => {
    strand(l, sh.pts, sh.w0, 2.4, { base: "5", shade: "4", light: "6" }, { shadeAt: 0.25, lightAt: -0.35 });
  });
  // suckers on the inner (right) side
  for (let i = 1; i < sh.pts.length - 1; i++) {
    const [x, y] = sh.pts[i];
    const sx = Math.round(x + 2);
    const sy = Math.round(y);
    if (p.get(sx, sy) !== "." && p.get(sx, sy) !== "1") p.set(sx, sy, "8").set(sx, sy + 1, "7").set(sx - 1, sy, "7");
  }
  // sand ring around the base
  for (let y = ground + 1; y < 48; y++) for (let x = 0; x < 16; x++) p.set(x, y, ".");
  layer(p, (l) => {
    ball(l, 7.5, ground + 0.5, sh.ring + 1, 2.2, ["h", "F", "B"], { ly: -1.5 });
    l.set(3, ground, "H").set(12, ground + 1, "H").set(7, ground + 1, "h");
  }, "H");
  if (sh.splash) {
    // impact: sand spray + sea-water droplets + speed lines from above
    for (const [x, y, k] of [[1, 40, "F"], [2, 35, "a"], [5, 31, "a"], [14, 30, "a"], [15, 38, "F"], [0, 44, "h"]] as [number, number, string][]) p.set(x, y, k).set(x, y - 1, k === "a" ? "w" : "B");
    p.line(4, 20, 5, 25, "w").line(9, 17, 9, 23, "w").line(13, 20, 12, 25, "w");
  }
  if (f === 3) {
    // sinking: sand trickle + bubbles
    p.set(3, 38, "a").set(2, 35, "a").set(13, 40, "B");
  }
  return p;
}

export const sprites: SpriteDef[] = [
  gridSprite("boss_kraken", 72, 56, range(6).map(kraken), "feet", { fps: 5, pal: PAL }),
  gridSprite("boss_kraken_tentacle", 16, 48, range(4).map(bigTentacle), "feet", { fps: 8, pal: PAL }),
];
