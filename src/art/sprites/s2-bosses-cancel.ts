/**
 * CANCEL-SAMA, the Network Executive (owner "s2-bosses"), The Final Arc FINAL 19:00.
 * boss_cancel 64x72x8, feet pivot (32, 71), faces right.
 *   f0-1 idle (the screen face blinks), f2 stamp raised (Cancel Stamp tell),
 *   f3 stamp SLAM, f4 phone call (cellphone held to the TV), f5 laugh (screen
 *   shows "LOL"), f6 glitched (screen static, RGB split, torn scanlines),
 *   f7 defeated (screen shows "RENEWED" and a tiny smile).
 * A giant dark suit with a red tie and an old CRT television for a head: the
 * screen is his face (drawn in dark pixels on cyan glass), rabbit-ear antennas,
 * and a huge red rubber stamp with a white "CANCEL" label. Not modelled on any
 * real person or company. Docs: docs/content/enemies.md §5.9.
 */
import type { SpriteDef } from "../format";
import { Pix, ball, capsule, gridSprite, hash2, layer, range, rrect, sparkle, strand, type StrandKeys } from "./s2-bosses-util";

type P2 = [number, number];
const SUIT: StrandKeys = { base: "2", shade: "1", light: "G" };
const SKIN: StrandKeys = { base: "s", shade: "k", light: "t" };
/** local keys: RGB-split ghosts (f6) */
const PAL = { "+": "#ff2d5a66", "*": "#2de6ff66" };

type Screen = "frown" | "blink" | "angry" | "shout" | "talk" | "lol" | "static" | "renewed";
type StampAt = "side" | "raised" | "slam" | "dropped";

interface Pose {
  /** TV casing top-left */
  tv: P2;
  /** tilt of the TV casing: rows shift right by this many px per 10 rows (lean) */
  shoulderY: number;
  /** back (screen-left) and front (screen-right) arms: shoulder, elbow, hand */
  bArm: [P2, P2, P2];
  fArm: [P2, P2, P2];
  screen: Screen;
  stamp: StampAt;
  /** antenna droop (defeated) */
  droop?: boolean;
  phone?: boolean;
  /** knees (wide slam stance) */
  stance?: "stand" | "wide";
}

const POSES: Pose[] = [
  // f0 idle
  { tv: [10, 9], shoulderY: 35, bArm: [[12, 38], [9, 48], [9, 56]], fArm: [[52, 38], [55, 46], [49, 51]], screen: "frown", stamp: "side" },
  // f1 idle (blink, breathing settle)
  { tv: [10, 10], shoulderY: 36, bArm: [[12, 39], [9, 49], [9, 57]], fArm: [[52, 39], [55, 47], [49, 52]], screen: "blink", stamp: "side" },
  // f2 stamp raised: leans back, stamp hoisted overhead like a hammer
  { tv: [7, 11], shoulderY: 37, bArm: [[10, 40], [7, 49], [8, 57]], fArm: [[50, 39], [58, 30], [51, 17]], screen: "angry", stamp: "raised" },
  // f3 SLAM: lunges forward, stamp smashed onto the floor in front
  { tv: [12, 13], shoulderY: 39, bArm: [[13, 42], [8, 50], [7, 57]], fArm: [[52, 42], [55, 50], [49, 55]], screen: "shout", stamp: "slam", stance: "wide" },
  // f4 phone call: back hand holds a phone to the side of the set
  { tv: [11, 9], shoulderY: 35, bArm: [[12, 38], [4, 35], [8, 25]], fArm: [[52, 38], [55, 46], [49, 51]], screen: "talk", stamp: "side", phone: true },
  // f5 laugh: leaning back, hand on the belly
  { tv: [8, 8], shoulderY: 35, bArm: [[12, 38], [10, 48], [21, 51]], fArm: [[52, 38], [55, 46], [49, 51]], screen: "lol", stamp: "side" },
  // f6 glitched
  { tv: [10, 9], shoulderY: 35, bArm: [[12, 38], [9, 48], [9, 56]], fArm: [[52, 38], [55, 46], [49, 51]], screen: "static", stamp: "side" },
  // f7 defeated: slumped, stamp dropped, antennas drooping
  { tv: [11, 13], shoulderY: 39, bArm: [[13, 42], [11, 52], [11, 60]], fArm: [[51, 42], [53, 52], [53, 60]], screen: "renewed", stamp: "dropped", droop: true },
];

// ---------------------------------------------------------------------------- the CRT head
const TV_W = 38;
const TV_H = 26;
const SCR = { x: 3, y: 3, w: 32, h: 18 };

/** Narrow caps for screen/stamp text (3x4, N is 3 wide so CANCEL / RENEWED fit). */
const GLYPH: Record<string, string> = {
  A: ".x.|x.x|xxx|x.x",
  C: ".xx|x..|x..|.xx",
  D: "xx.|x.x|x.x|xx.",
  E: "xxx|xx.|x..|xxx",
  L: "x..|x..|x..|xxx",
  N: "xx.|x.x|x.x|x.x",
  O: ".x.|x.x|x.x|.x.",
  R: "xx.|x.x|xx.|x.x",
  W: "x...x|x.x.x|x.x.x|.x.x.",
};
function word(p: Pix, s: string, x: number, y: number, k: string, scale = 1): number {
  let pen = x;
  for (const ch of s) {
    const rs = GLYPH[ch].split("|");
    rs.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] === "x") p.rect(pen + xx * scale, y + yy * scale, scale, scale, k);
    });
    pen += (rs[0].length + 1) * scale;
  }
  return pen - x - scale;
}
function wordW(s: string, scale = 1): number {
  let w = 0;
  for (const ch of s) w += GLYPH[ch].split("|")[0].length + 1;
  return (w - 1) * scale;
}

function screenFace(p: Pix, sx: number, sy: number, kind: Screen, f: number): void {
  const { w, h } = SCR;
  const cx = sx + w / 2;
  if (kind === "static") {
    // snow: noise + torn bright scanlines
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!p.solid(sx + x, sy + y)) continue;
        const n = hash2(x, y, 77);
        p.set(sx + x, sy + y, n < 0.22 ? "0" : n < 0.45 ? "G" : n < 0.7 ? "g" : n < 0.88 ? "W" : "w");
      }
    for (const yy of [4, 5, 12]) for (let x = 2; x < w - 2; x++) p.set(sx + x, sy + yy, yy === 12 ? "c" : "w");
    return;
  }
  const ink = "0";
  if (kind === "lol") {
    // giant "LOL" filling the screen
    const ww = wordW("LOL", 2);
    word(p, "LOL", Math.round(cx - ww / 2), sy + 4, ink, 2);
    // laugh tears flying off the corners
    p.set(sx + 2, sy + 2, "w").set(sx + w - 3, sy + 2, "w");
    return;
  }
  if (kind === "renewed") {
    const ww = wordW("RENEWED");
    word(p, "RENEWED", Math.round(cx - ww / 2), sy + 4, ink);
    // tiny reluctant smile + soft eyes
    p.line(cx - 6, sy + 11, cx - 4, sy + 11, ink).line(cx + 3, sy + 11, cx + 5, sy + 11, ink);
    p.set(cx - 2, sy + 14, ink).set(cx - 1, sy + 15, ink).set(cx, sy + 15, ink).set(cx + 1, sy + 14, ink);
    // a blush on the glass
    p.set(cx - 9, sy + 13, "b").set(cx - 8, sy + 13, "b").set(cx + 7, sy + 13, "b").set(cx + 8, sy + 13, "b");
    return;
  }
  // ---- expression face
  const ey = sy + 7;
  const el = cx - 9; // left eye x
  const er = cx + 5; // right eye x
  const brow = (x0: number, dir: 1 | -1, drop: number) => {
    // thick brow slanting down toward the centre by `drop`
    for (let i = 0; i < 6; i++) {
      const x = x0 + i;
      const t = dir > 0 ? i / 5 : 1 - i / 5;
      const y = ey - 4 + Math.round(t * drop);
      p.set(x, y, ink).set(x, y + 1, ink);
    }
  };
  if (kind === "blink") {
    p.line(el, ey + 1, el + 4, ey + 1, ink).line(er, ey + 1, er + 4, ey + 1, ink);
    brow(el - 1, 1, 2);
    brow(er - 1, -1, 2);
  } else if (kind === "talk") {
    // eyes glancing aside at the phone, unimpressed
    p.rect(el, ey, 4, 3, ink).rect(er, ey, 4, 3, ink);
    p.set(el, ey, "c").set(er, ey, "c");
    p.line(el - 1, ey - 2, el + 4, ey - 2, ink).line(er, ey - 2, er + 5, ey - 2, ink);
  } else {
    // stern / angry block eyes with a cold glint
    p.rect(el, ey, 4, 3, ink).rect(er, ey, 4, 3, ink);
    p.set(el + 1, ey, "a").set(er + 1, ey, "a");
    const drop = kind === "frown" ? 2 : 3;
    brow(el - 1, 1, drop);
    brow(er - 1, -1, drop);
  }
  // mouth
  const my = sy + 13;
  if (kind === "shout" || kind === "angry") {
    const big = kind === "shout";
    const mw = big ? 12 : 8;
    const mh = big ? 4 : 2;
    const mx = Math.round(cx - mw / 2);
    p.rect(mx, my - (big ? 1 : 0), mw, mh, ink);
    if (big) p.line(mx + 1, my - 1, mx + mw - 2, my - 1, "w").line(mx + 2, my + 2, mx + mw - 3, my + 2, "r");
    else p.line(mx + 1, my, mx + mw - 2, my, "w");
  } else if (kind === "talk") {
    p.rect(cx - 2, my, 3, 2, ink);
  } else {
    // the executive frown
    for (let i = -5; i <= 5; i++) p.set(cx + i, my + (Math.abs(i) >= 4 ? 1 : 0) - (Math.abs(i) <= 1 ? 0 : 0), ink);
    p.set(cx - 6, my + 2, ink).set(cx + 6, my + 2, ink);
  }
  void f;
}

function tvHead(p: Pix, x0: number, y0: number, pose: Pose, f: number): void {
  // rabbit-ear antennas from a little dome on top
  const ax = x0 + 19;
  const droop = pose.droop ? 1 : 0;
  layer(p, (l) => {
    const tips: P2[] = droop
      ? [[x0 + 8, y0 - 3], [x0 + 31, y0 - 2]]
      : f === 6
        ? [[x0 + 11, y0 - 8], [x0 + 32, y0 - 5]]
        : [[x0 + 12, y0 - 8], [x0 + 27, y0 - 8]];
    for (const [tx, ty] of tips) {
      l.line(ax, y0 - 1, tx, ty, "g");
      l.ellipse(tx, ty, 1.2, 1.2, "W");
      l.set(tx - 1, ty - 1, "w");
    }
    l.rect(ax - 2, y0 - 2, 5, 2, "G");
    l.set(ax - 1, y0 - 2, "g");
  });
  // side depth (the set is a box: its right face is in shadow)
  layer(p, (l) => {
    l.poly([[x0 + TV_W - 1, y0 + 1], [x0 + TV_W + 3, y0 + 3], [x0 + TV_W + 3, y0 + TV_H - 3], [x0 + TV_W - 1, y0 + TV_H - 1]], "G");
    l.each((x, y, k) => (k === "G" && y > y0 + TV_H - 8 ? "2" : null));
    // vent slots
    for (let y = y0 + 6; y < y0 + 16; y += 2) l.line(x0 + TV_W + 1, y, x0 + TV_W + 2, y + 1, "2");
  });
  // the casing
  layer(p, (l) => {
    rrect(l, x0, y0, x0 + TV_W - 1, y0 + TV_H - 1, (x, y) => {
      const u = x - x0;
      const v = y - y0;
      if (u <= 1 || v <= 1) return u + v < 6 ? "w" : "W";
      if (v >= TV_H - 2 || u >= TV_W - 2) return "G";
      return "g";
    }, 3);
    // screen recess: dark rim around the glass
    rrect(l, x0 + SCR.x - 1, y0 + SCR.y - 1, x0 + SCR.x + SCR.w, y0 + SCR.y + SCR.h, "1", 3);
    // glass: cyan, darker toward the rim (curved CRT), glare top-left
    rrect(l, x0 + SCR.x, y0 + SCR.y, x0 + SCR.x + SCR.w - 1, y0 + SCR.y + SCR.h - 1, (x, y) => {
      const u = (x - (x0 + SCR.x)) / (SCR.w - 1);
      const v = (y - (y0 + SCR.y)) / (SCR.h - 1);
      const e = Math.max(Math.abs(u - 0.5) * 2, Math.abs(v - 0.5) * 2);
      if (e > 0.9) return "C";
      // scanlines
      if ((y - y0) % 3 === 0 && e > 0.3) return "C";
      return "c";
    }, 3);
    // bottom bezel: speaker grille + two knobs + power light
    for (let x = x0 + 4; x <= x0 + 14; x += 2) l.line(x, y0 + SCR.y + SCR.h + 1, x, y0 + TV_H - 3, "G");
    for (const kx of [x0 + 27, x0 + 32]) {
      l.ellipse(kx, y0 + TV_H - 4, 1.4, 1.4, "2");
      l.set(kx - 1, y0 + TV_H - 5, "G");
    }
    l.set(x0 + 22, y0 + TV_H - 4, pose.screen === "renewed" ? "l" : "r");
  });
  const sx = x0 + SCR.x;
  const sy = y0 + SCR.y;
  screenFace(p, sx, sy, pose.screen, f);
  // glass glare (over the face: it's on the glass)
  if (pose.screen !== "static") {
    for (const [dx, dy, k] of [[2, 1, "w"], [3, 1, "a"], [1, 2, "a"], [2, 2, "a"], [1, 3, "a"], [6, 1, "a"]] as [number, number, string][]) p.set(sx + dx, sy + dy, k);
  }
}

// ---------------------------------------------------------------------------- the stamp
/** Huge red rubber stamp. (x, y) = top-left of the wooden block; 25x8 block. */
function stampBlock(p: Pix, x: number, y: number, o: { handle: "up" | "down" | "none"; tilt?: number } = { handle: "up" }): void {
  const W = 25;
  // handle + knob
  if (o.handle !== "none") {
    const hx = x + 12;
    layer(p, (l) => {
      if (o.handle === "up") {
        l.rect(hx - 1, y - 6, 3, 6, "H");
        l.set(hx - 1, y - 6, "h").set(hx - 1, y - 5, "h").set(hx + 1, y - 3, "d").set(hx + 1, y - 2, "d").set(hx + 1, y - 1, "d");
        ball(l, hx, y - 9, 4.4, 3.4, ["R", "r", "r", "q"], { spec: "w" });
      } else {
        l.rect(hx - 1, y + 10, 3, 6, "H");
        l.set(hx - 1, y + 10, "h").set(hx - 1, y + 11, "h").set(hx + 1, y + 13, "d").set(hx + 1, y + 14, "d");
        ball(l, hx, y + 18, 4.4, 3.4, ["R", "r", "r", "q"], { spec: "w" });
      }
    });
  }
  layer(p, (l) => {
    // wooden block (lit top-left) + red rubber face
    const rubberTop = o.handle === "down";
    rrect(l, x, y, x + W - 1, y + 7, (xx, yy) => (yy === y ? "h" : xx >= x + W - 2 || yy === y + 7 ? "d" : "H"), 1);
    if (rubberTop) l.rect(x + 1, y - 2, W - 2, 2, "R");
    else l.rect(x + 1, y + 8, W - 2, 2, "R");
    // label
    l.rect(x + 2, y + 2, W - 4, 5, "w");
    l.line(x + 2, y + 6, x + W - 3, y + 6, "W");
  });
  word(p, "CANCEL", x + 2 + Math.round((W - 4 - wordW("CANCEL")) / 2), y + 2, "r");
}

/** Centre of the hand ball drawn at the end of an arm (see `sleeve`). */
function handAt(a: [P2, P2, P2]): P2 {
  const [, e, h] = a;
  const L = Math.hypot(h[0] - e[0], h[1] - e[1]) || 1;
  return [Math.round(h[0] + ((h[0] - e[0]) / L) * 4), Math.round(h[1] + ((h[1] - e[1]) / L) * 4)];
}

function stampFor(p: Pix, pose: Pose): void {
  const [hx, hy] = handAt(pose.fArm);
  const bx = Math.min(hx - 12, 64 - 26);
  if (pose.stamp === "side") stampBlock(p, bx, hy + 4, { handle: "up" });
  else if (pose.stamp === "raised") stampBlock(p, bx, hy - 13, { handle: "down" });
  else if (pose.stamp === "slam") stampBlock(p, bx, 61, { handle: "up" });
  else {
    // dropped: the block lies at his feet, the knob snapped off and rolled away
    stampBlock(p, 2, 61, { handle: "none" });
    layer(p, (l) => ball(l, 31, 68, 2.6, 2.2, ["R", "r", "r", "q"], { spec: "w" }));
  }
}

// ---------------------------------------------------------------------------- the suit
function legs(p: Pix, pose: Pose): void {
  const wide = pose.stance === "wide";
  const L: [P2, P2] = wide ? [[24, 58], [17, 68]] : [[24, 58], [22, 68]];
  const R: [P2, P2] = wide ? [[39, 58], [45, 68]] : [[39, 58], [41, 68]];
  layer(p, (l) => {
    capsule(l, L[0][0], L[0][1], L[1][0], L[1][1], 5, "1");
    capsule(l, R[0][0], R[0][1], R[1][0], R[1][1], 5, "2");
    // pressed creases + lit edge
    l.line(L[0][0], L[0][1], L[1][0], L[1][1] - 1, "2");
    l.line(R[0][0] - 2, R[0][1], R[1][0] - 2, R[1][1] - 1, "G");
    l.line(R[0][0] + 1, R[0][1] + 2, R[1][0] + 1, R[1][1] - 1, "1");
  });
  // polished shoes
  layer(p, (l) => {
    for (const [fx, k] of [[L[1][0], "0"], [R[1][0], "0"]] as [number, string][]) {
      rrect(l, fx - 5, 68, fx + 6, 70, k, { tr: 2, tl: 1 });
      l.line(fx - 3, 68, fx + 1, 68, "G");
      l.set(fx + 3, 68, "g");
    }
  });
}

function jacket(p: Pix, pose: Pose, lean: number): void {
  const sy = pose.shoulderY;
  // jacket body
  layer(p, (l) => {
    l.poly(
      [
        [8, sy + 5],
        [11, sy + 1],
        [16, sy - 1],
        [48, sy - 1],
        [53, sy + 1],
        [56, sy + 5],
        [52, sy + 17],
        [53 + lean * 0.3, 60],
        [11 + lean * 0.3, 60],
        [12, sy + 17],
      ],
      "2",
    );
    // lit left side + shoulder tops, dark right side
    l.each((x, y, k) => {
      if (k !== "2") return null;
      if (y <= sy + 1 && x < 40) return "G";
      if (x <= 13 + (y - sy) * 0.08) return "G";
      if (x >= 48 - (y - sy) * 0.03) return "1";
      return null;
    });
    // hem shadow
    l.line(12, 59, 52, 59, "1");
    // open front: shirt + tie (a tall V down to the button)
    const cx = 32 + Math.round(lean * 0.2);
    l.poly([[cx - 6, sy], [cx + 6, sy], [cx, sy + 15]], "W");
    l.each((x, y, k) => (k === "W" && x > cx + 1 ? "g" : null));
    // lapels: notched, edged in highlight
    l.line(cx - 6, sy, cx, sy + 15, "G");
    l.line(cx + 6, sy, cx, sy + 15, "1");
    l.line(cx - 7, sy + 1, cx - 4, sy + 7, "1");
    l.line(cx + 7, sy + 1, cx + 4, sy + 7, "0");
    // buttons
    l.set(cx, sy + 18, "g").set(cx, sy + 22, "g");
    // pocket square (left chest) + pocket flaps
    l.rect(cx - 13, sy + 9, 4, 1, "1");
    l.set(cx - 13, sy + 8, "w").set(cx - 12, sy + 8, "q").set(cx - 11, sy + 8, "w");
    l.line(cx - 14, sy + 20, cx - 8, sy + 20, "1");
    l.line(cx + 8, sy + 20, cx + 14, sy + 20, "0");
  });
  // tie
  const cx = 32 + Math.round(lean * 0.2);
  layer(p, (l) => {
    l.poly([[cx - 1, sy + 2], [cx + 1, sy + 2], [cx + 2, sy + 12], [cx, sy + 15], [cx - 2, sy + 12]], "r");
    l.each((x, y, k) => (k === "r" && x >= cx + 1 ? "R" : k === "r" && x === cx - 1 && y < sy + 9 ? "q" : null));
    l.rect(cx - 1, sy, 3, 2, "R");
    l.set(cx - 1, sy, "r");
  });
  // gold tie clip
  p.line(cx - 2, sy + 7, cx + 2, sy + 7, "y");
}

function sleeve(p: Pix, a: [P2, P2, P2], front: boolean): void {
  const [s, e, h] = a;
  layer(p, (l) => {
    strand(l, [s, e, h], 9, 7, front ? SUIT : { base: "2", shade: "1", light: "G" }, { shadeAt: 0.2, lightAt: -0.5 });
  });
  // white shirt cuff + hand
  const dx = h[0] - e[0];
  const dy = h[1] - e[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  layer(p, (l) => {
    capsule(l, h[0], h[1], h[0] + ux * 1.5, h[1] + uy * 1.5, 2.6, "W");
    ball(l, h[0] + ux * 4, h[1] + uy * 4, 3, 3, ["k", "s", "s", "t"]);
  });
  p.set(Math.round(h[0] + ux * 1.5 - uy * 2), Math.round(h[1] + uy * 1.5 + ux * 2), "y"); // cufflink
}

// ---------------------------------------------------------------------------- frame
function exec(pose: Pose, f: number): Pix {
  const p = new Pix(64, 72);
  const lean = pose.tv[0] - 10;
  const [tx, ty] = pose.tv;
  legs(p, pose);
  sleeve(p, pose.bArm, false);
  jacket(p, pose, lean);
  // shirt collar under the set
  layer(p, (l) => {
    const cx = 32 + Math.round(lean * 0.2);
    l.poly([[cx - 6, pose.shoulderY - 2], [cx + 6, pose.shoulderY - 2], [cx + 2, pose.shoulderY + 3], [cx, pose.shoulderY + 1], [cx - 2, pose.shoulderY + 3]], "W");
    l.each((x, y, k) => (k === "W" && x < cx ? "w" : null));
  });
  tvHead(p, tx, ty, pose, f);
  if (pose.stamp === "raised") stampFor(p, pose);
  if (pose.phone) {
    const [hx, hy] = pose.bArm[2];
    layer(p, (l) => {
      rrect(l, hx - 1, hy - 7, hx + 2, hy + 1, "0", 1);
      l.rect(hx, hy - 6, 2, 3, "a");
    });
  }
  // the fist wraps the stamp's handle: stamp first, then the arm over it
  if (pose.stamp === "side" || pose.stamp === "slam" || pose.stamp === "dropped") stampFor(p, pose);
  sleeve(p, pose.fArm, true);
  return p;
}

function cancel(f: number): Pix {
  const pose = POSES[f];
  const me = exec(pose, f);
  const p = new Pix(64, 72);
  if (f === 6) {
    // RGB split: red ghost left, cyan ghost right, then torn horizontal slices
    p.put(me.clone().each((x, y, k) => (k === "." ? null : "+")), -2, 0);
    p.put(me.clone().each((x, y, k) => (k === "." ? null : "*")), 2, 0);
    const torn = me.clone();
    for (const [y0, y1, dx] of [[14, 16, 3], [30, 31, -2], [47, 49, 2]] as [number, number, number][]) {
      for (let y = y0; y <= y1; y++) {
        const row = torn.d.slice(y * 64, y * 64 + 64);
        for (let x = 0; x < 64; x++) torn.d[y * 64 + x] = row[x - dx] ?? ".";
      }
    }
    p.put(torn, 0, 0);
    return p;
  }
  p.put(me, 0, 0);
  if (f === 2) {
    // windup lines
    for (const [x0, y0, x1, y1] of [[60, 18, 63, 15], [61, 26, 63, 26], [40, 4, 38, 1]] as [number, number, number, number][]) p.line(x0, y0, x1, y1, "w");
  } else if (f === 3) {
    // impact: dust puffs either side of the block + shock lines + sparks
    for (const [x, y, r] of [[33, 69, 2.6], [29, 70, 1.8], [62, 68, 2.2]] as [number, number, number][])
      layer(p, (l) => {
        l.ellipse(x, y, r, r * 0.8, "W");
        l.set(Math.round(x - r * 0.4), Math.round(y - r * 0.4), "w");
      }, "g");
    for (const [x0, y0, x1, y1] of [[32, 62, 28, 58], [36, 58, 34, 54], [62, 58, 63, 54]] as [number, number, number, number][]) p.line(x0, y0, x1, y1, "w");
    sparkle(p, 58, 52, 1);
    sparkle(p, 30, 55, 0);
  } else if (f === 4) {
    // "blah blah" squiggles from the phone
    p.line(2, 16, 4, 14, "w").line(1, 21, 4, 21, "w");
  } else if (f === 5) {
    // laugh shake lines
    for (const [x0, y0, x1, y1] of [[6, 6, 4, 3], [56, 6, 58, 3], [4, 14, 1, 14], [59, 14, 62, 14]] as [number, number, number, number][]) p.line(x0, y0, x1, y1, "w");
  } else if (f === 7) {
    // sweat drop on the casing
    p.put(`
.1.
1a1
1c1
.1.
`, 51, 12);
  }
  return p;
}

export const sprites: SpriteDef[] = [gridSprite("boss_cancel", 64, 72, range(8).map(cancel), "feet", { fps: 4, pal: PAL })];
