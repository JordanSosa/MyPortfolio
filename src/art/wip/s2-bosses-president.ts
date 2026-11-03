/**
 * STUDENT COUNCIL PRESIDENT (owner "s2-bosses"), Shoujo Academy 7:00 mid boss.
 * boss_president 48x56x6, feet pivot (24, 55), faces right.
 *   f0-1 idle (clipboard tap; f1 glasses glint), f2 accusing point + glasses
 *   FLASH (Glasses Glint tell), f3 giant stamp slam, f4 cape-blazer swish
 *   (pushing her glasses up), f5 rage (cracked glasses, hair wild).
 * Immaculate uniform: white shirt + red ribbon, the blazer worn over the
 * shoulders like a cape, red 'PRESIDENT' armband, navy pleated skirt, long
 * straight navy hair, rectangular glasses, a clipboard and a giant rubber stamp.
 * Docs: docs/content/enemies.md §5.3.
 */
import type { SpriteDef } from "../format";
import { Pix, animeEye, ball, capsule, gridSprite, layer, range, rrect, sparkle, strand, type StrandKeys } from "./s2-bosses-util";

type P2 = [number, number];
const HAIR: StrandKeys = { base: "n", shade: "X", light: "U", deep: "0" };
const SKIN = { base: "s", shade: "k", light: "t" };

interface Pose {
  bob: number;
  /** head centre */
  hx: number;
  hy: number;
  front: "stamp" | "point" | "slam" | "glasses" | "fist";
  back: "clip" | "clipUp" | "fist";
  cape: 0 | 1 | 2;
  face: "stern" | "glint" | "flash" | "shout" | "smug" | "rage";
  hairWild?: boolean;
}

const POSES: Pose[] = [
  { bob: 0, hx: 22, hy: 14, front: "stamp", back: "clip", cape: 0, face: "stern" },
  { bob: 1, hx: 22, hy: 14, front: "stamp", back: "clipUp", cape: 0, face: "glint" },
  { bob: 0, hx: 22, hy: 14, front: "point", back: "clip", cape: 1, face: "flash" },
  { bob: 2, hx: 23, hy: 15, front: "slam", back: "clip", cape: 1, face: "shout" },
  { bob: 0, hx: 22, hy: 14, front: "glasses", back: "clip", cape: 2, face: "smug" },
  { bob: 0, hx: 22, hy: 14, front: "fist", back: "fist", cape: 1, face: "rage", hairWild: true },
];

/** Giant rubber stamp held by the neck: red dome knob, wooden neck, wooden block with a
 * white 'DENIED' label, red rubber face. Top-left (x, y), 13x15. */
function stamp(p: Pix, x: number, y: number): void {
  layer(p, (l) => {
    ball(l, x + 6, y + 2.6, 4.2, 2.8, ["R", "r", "r", "q"], { spec: "w" });
    l.rect(x + 5, y + 5, 3, 4, "H");
    l.set(x + 5, y + 5, "h").set(x + 5, y + 6, "h").set(x + 7, y + 6, "d").set(x + 7, y + 7, "d").set(x + 7, y + 8, "d");
    rrect(l, x, y + 9, x + 12, y + 13, (xx, yy) => (yy === y + 9 ? "h" : xx > x + 10 ? "d" : "H"), 1);
    l.rect(x + 1, y + 14, 11, 1, "R");
  });
  // label
  p.rect(x + 2, y + 10, 9, 3, "w");
  p.line(x + 3, y + 11, x + 9, y + 11, "r");
  p.set(x + 4, y + 11, "w").set(x + 7, y + 11, "w");
}

function clipboard(p: Pix, x: number, y: number): void {
  layer(p, (l) => {
    rrect(l, x, y, x + 8, y + 11, (xx) => (xx > x + 6 ? "d" : "H"), 1);
    l.rect(x + 1, y + 2, 7, 8, "w");
    for (const yy of [4, 6, 8]) l.line(x + 2, y + yy, x + 6, y + yy, "g");
    l.set(x + 2, y + 3, "r").set(x + 2, y + 5, "u");
    l.rect(x + 3, y - 1, 3, 2, "g");
    l.set(x + 3, y - 1, "w");
  });
}

function hairBack(p: Pix, hx: number, hy: number, wild: boolean, swish: number): void {
  layer(p, (l) => {
    l.ellipse(hx, hy - 1, 10.6, 10.6, "n");
    const len = 30;
    const flare = wild ? 4 : 0;
    // straight curtain down the back, ends swept with the cape swish
    strand(l, [[hx - 6, hy], [hx - 8 - flare, hy + 14], [hx - 8 - swish - flare * 1.5, hy + len]], 9, 6, HAIR, { shadeAt: 0.2 });
    strand(l, [[hx - 1, hy], [hx - 3, hy + 14], [hx - 3 - swish, hy + len - 2]], 8, 5, HAIR, { shadeAt: 0.1 });
    strand(l, [[hx + 6, hy + 1], [hx + 7 + flare, hy + 12], [hx + 6 - swish * 0.5 + flare, hy + len - 8]], 6, 4, HAIR, { shadeAt: -0.1 });
    if (wild) {
      strand(l, [[hx - 7, hy - 5], [hx - 14, hy - 8], [hx - 18, hy - 6]], 5, 1, HAIR);
      strand(l, [[hx + 6, hy - 6], [hx + 12, hy - 11], [hx + 16, hy - 10]], 5, 1, HAIR);
      strand(l, [[hx - 8, hy + 4], [hx - 15, hy + 6], [hx - 19, hy + 11]], 5, 1, HAIR);
    }
  });
}

function capeBlazer(p: Pix, cx: number, top: number, mode: 0 | 1 | 2): void {
  // worn over the shoulders like a cape; sleeves hang empty
  layer(p, (l) => {
    const flare = mode === 2 ? 9 : mode === 1 ? 3 : 0;
    l.poly(
      [
        [cx - 8, top],
        [cx + 8, top],
        [cx + 11 + flare * 0.3, top + 16],
        [cx + 4, top + 20],
        [cx - 6 - flare, top + 22],
        [cx - 13 - flare * 1.4, top + 19 + flare * 0.2],
      ],
      "G",
    );
    l.each((x, y, k) => (k === "G" && x < cx - 5 - (y - top) * 0.15 ? "g" : k === "G" && x > cx + 6 ? "2" : null));
    // hem trim
    l.each((x, y, k) => (k !== "." && !l.solid(x, y + 1) ? "2" : null));
    // empty sleeve hanging at the back shoulder
    strand(l, [[cx - 8, top + 2], [cx - 11 - flare * 0.8, top + 10], [cx - 12 - flare, top + 17]], 4, 3, { base: "G", shade: "2", light: "g" });
  });
  // gold crest button
  p.set(cx + 7, top + 6, "y").set(cx + 7, top + 9, "Y");
}

/** Front lapel of the shoulder-cape, drawn over the shirt. */
function capeFront(p: Pix, cx: number, top: number): void {
  layer(p, (l) => {
    l.poly([[cx + 3, top - 1], [cx + 8, top], [cx + 9, top + 9], [cx + 6, top + 8], [cx + 4, top + 2]], "G");
    l.each((x, y, k) => (k === "G" && x >= cx + 8 ? "2" : k === "G" && x <= cx + 4 ? "g" : null));
    l.poly([[cx - 3, top - 1], [cx - 8, top], [cx - 8, top + 7], [cx - 5, top + 3]], "g");
  });
  p.set(cx + 6, top + 5, "y");
}

function body(p: Pix, cx: number, top: number, legs: "stand" | "wide"): void {
  // legs (dark tights) + loafers
  layer(p, (l) => {
    const [la, lb, ra, rb] = legs === "wide" ? [[cx - 3, top + 15], [cx - 6, 54], [cx + 3, top + 15], [cx + 6, 54]] : [[cx - 2, top + 15], [cx - 3, 54], [cx + 3, top + 15], [cx + 3, 54]];
    capsule(l, la[0], la[1], lb[0], lb[1], 1.6, "2");
    capsule(l, ra[0], ra[1], rb[0], rb[1], 1.6, "1");
    l.line(la[0] - 1, la[1] + 2, lb[0] - 1, lb[1] - 2, "G");
    // loafers
    rrect(l, lb[0] - 2, 53, lb[0] + 2, 54, "d", 0);
    rrect(l, rb[0] - 1, 53, rb[0] + 3, 54, "d", 0);
    l.set(lb[0] - 1, 53, "H").set(rb[0], 53, "H");
    // white socks
    l.line(lb[0] - 1, 51, lb[0] + 1, 51, "w").line(rb[0] - 1, 51, rb[0] + 1, 51, "W");
  });
  // pleated navy skirt
  layer(p, (l) => {
    l.poly([[cx - 6, top + 8], [cx + 6, top + 8], [cx + 9, top + 17], [cx - 9, top + 17]], "U");
    l.each((x, y, k) => {
      if (k !== "U") return null;
      const pleat = (x - cx + 20) % 3;
      if (pleat === 0) return "n";
      if (x < cx - 4) return y > top + 13 ? "U" : "u";
      return null;
    });
    // plaid line
    l.line(cx - 8, top + 14, cx + 8, top + 14, "r");
  });
  // shirt torso
  layer(p, (l) => {
    l.poly([[cx - 5, top], [cx + 5, top], [cx + 6, top + 9], [cx - 6, top + 9]], "w");
    l.each((x, y, k) => (k === "w" && x > cx + 2 ? "W" : k === "w" && y > top + 7 ? "W" : null));
    // collar + red ribbon
    l.line(cx - 3, top, cx, top + 2, "g").line(cx + 3, top, cx + 1, top + 2, "g");
    l.set(cx, top + 3, "r").set(cx + 1, top + 3, "r").set(cx - 1, top + 3, "R").set(cx + 2, top + 3, "R");
    l.set(cx, top + 4, "R").set(cx + 1, top + 5, "r");
  });
}

function face(p: Pix, hx: number, hy: number, kind: Pose["face"]): void {
  layer(p, (l) => {
    l.poly([[hx - 8, hy - 4], [hx - 3, hy - 8], [hx + 6, hy - 7], [hx + 9, hy - 1], [hx + 8, hy + 5], [hx + 5, hy + 9], [hx + 1, hy + 10], [hx - 4, hy + 8], [hx - 8, hy + 4]], "s");
    l.each((x, y, k) => (k === "s" && (x < hx - 6 || y > hy + 7) ? "k" : k === "s" && x > hx + 4 && y < hy - 1 ? "t" : null));
  });
  const ey = hy - 1;
  const iris = { dark: "n", mid: "U", light: "u", pupil: "0" };
  if (kind === "shout") {
    // furious squeezed eyes behind the glasses
    p.line(hx - 5, ey + 1, hx - 2, ey + 2, "0").line(hx - 5, ey + 3, hx - 2, ey + 2, "0");
    p.line(hx + 3, ey + 2, hx + 6, ey + 1, "0").line(hx + 3, ey + 2, hx + 6, ey + 3, "0");
  } else if (kind === "smug") {
    animeEye(p, hx - 6, ey, 5, 6, iris, { round: "s" });
    animeEye(p, hx + 3, ey, 4, 6, iris, { round: "s" });
    // lids lowered: cool and composed
    p.line(hx - 6, ey + 1, hx - 2, ey + 1, "0").line(hx + 3, ey + 1, hx + 6, ey + 1, "0");
    p.line(hx - 6, ey + 2, hx - 2, ey + 2, "0").line(hx + 3, ey + 2, hx + 6, ey + 2, "0");
  } else {
    animeEye(p, hx - 6, ey, 5, 6, iris, { lash: -1, round: "s" });
    animeEye(p, hx + 3, ey, 4, 6, iris, { lash: 1, round: "s" });
    if (kind === "rage") {
      // tiny furious pupils
      for (const x0 of [hx - 5, hx + 3]) {
        p.rect(x0 - (x0 < hx ? 1 : 0), ey + 1, x0 < hx ? 5 : 4, 5, "w");
        p.set(x0 + 1, ey + 2, "r").set(x0 + 2, ey + 2, "r").set(x0 + 1, ey + 3, "R").set(x0 + 2, ey + 3, "R");
        p.line(x0, ey, x0 + 3, ey, "0");
      }
    }
  }
  // glasses: rectangular frames + bridge
  const gl = (x0: number, w: number) => {
    p.line(x0 - 1, ey - 1, x0 + w, ey - 1, "1");
    p.line(x0 - 1, ey + 6, x0 + w, ey + 6, "1");
    p.line(x0 - 1, ey - 1, x0 - 1, ey + 6, "1");
    p.line(x0 + w, ey - 1, x0 + w, ey + 6, "1");
  };
  gl(hx - 6, 5);
  gl(hx + 3, 4);
  p.set(hx, ey + 1, "1").set(hx + 1, ey + 1, "1");
  p.set(hx + 8, ey, "1").set(hx + 9, ey, "1");
  // lens glare
  if (kind === "glint") {
    p.set(hx - 5, ey, "w").set(hx - 4, ey + 1, "w").set(hx - 3, ey + 2, "w").set(hx + 5, ey, "w").set(hx + 6, ey + 1, "w");
    sparkle(p, hx + 8, ey - 2, 1);
  } else if (kind === "flash") {
    // lenses go fully opaque white: the anime glasses glint
    p.rect(hx - 6, ey, 5, 6, "w");
    p.rect(hx + 3, ey, 4, 6, "w");
    p.line(hx - 6, ey + 5, hx - 4, ey + 5, "a").line(hx + 3, ey + 5, hx + 4, ey + 5, "a");
  } else if (kind === "rage") {
    // cracked near lens
    p.line(hx - 6, ey, hx - 3, ey + 3, "w").line(hx - 3, ey + 3, hx - 2, ey + 1, "w").line(hx - 3, ey + 3, hx - 5, ey + 5, "w");
  } else if (kind === "stern" || kind === "smug") {
    p.set(hx - 6, ey, "a").set(hx + 3, ey, "a");
  }
  // mouth
  if (kind === "shout" || kind === "rage") {
    p.put(`
11111
10ww1
1rrr1
.111.
`, hx, hy + 5);
  } else if (kind === "smug") {
    p.set(hx + 1, hy + 7, "1").set(hx + 2, hy + 7, "1").set(hx + 3, hy + 6, "1");
  } else if (kind === "flash") {
    p.put(`
111
1R1
111
`, hx + 1, hy + 6);
  } else {
    p.line(hx + 1, hy + 7, hx + 3, hy + 7, "1");
  }
  // faint blush (she's still a shoujo character)
  p.set(hx - 7, hy + 5, "b").set(hx - 6, hy + 5, "b").set(hx + 6, hy + 5, "b").set(hx + 7, hy + 5, "b");
  if (kind === "rage") {
    // anger vein
    p.put(`
1.1
.1.
1.1
`, hx + 6, hy - 9);
  }
}

/** Brows drawn OVER the fringe (anime convention) so the stern look always reads. */
function brows(p: Pix, hx: number, hy: number, kind: Pose["face"]): void {
  const ey = hy - 1;
  const drop = kind === "rage" || kind === "shout" ? 2 : kind === "smug" ? 0 : 1;
  for (const [x0, x1, d0, d1] of [[hx - 7, hx - 2, 0, drop], [hx + 3, hx + 7, drop, 0]] as [number, number, number, number][]) {
    p.line(x0, ey - 3 + d0, x1, ey - 3 + d1, "0");
    p.line(x0, ey - 4 + d0, x1, ey - 4 + d1, "1");
  }
}

function bangs(p: Pix, hx: number, hy: number, wild: boolean): void {
  layer(p, (l) => {
    // straight hime-cut fringe + long side locks
    for (let i = 0; i < 6; i++) {
      const x = hx - 6 + i * 2.8;
      strand(l, [[x, hy - 10], [x + 0.5, hy - 7], [x, hy - 4 - (i % 2)]], 4, 2, HAIR, { shadeAt: 0.4 });
    }
    strand(l, [[hx - 8, hy - 7], [hx - 9, hy + 4], [hx - 8, hy + 13]], 4, 3, HAIR, { shadeAt: 0.2 });
    strand(l, [[hx + 8, hy - 7], [hx + 9, hy + 3], [hx + 9, hy + 11]], 3, 2, HAIR);
    l.ellipse(hx, hy - 9, 9, 3.4, "n");
    if (wild) {
      strand(l, [[hx - 2, hy - 9], [hx - 5, hy - 14], [hx - 3, hy - 16]], 3, 1, HAIR);
      strand(l, [[hx + 3, hy - 9], [hx + 6, hy - 13], [hx + 9, hy - 14]], 3, 1, HAIR);
    }
  });
  // glossy "angel ring" sheen band
  for (let x = hx - 6; x <= hx + 5; x++) {
    const y = hy - 10 + (x > hx - 2 ? 0 : 1);
    const k = p.get(x, y);
    if (k === "n" || k === "U" || k === "X") p.set(x, y, x === hx - 3 || x === hx + 2 ? "v" : "u");
  }
}

function armband(p: Pix, x: number, y: number): void {
  p.rect(x, y, 4, 3, "r");
  p.line(x, y, x + 3, y, "R");
  p.set(x + 1, y + 1, "y").set(x + 2, y + 1, "y");
}

function president(f: number): Pix {
  const pose = POSES[f];
  const p = new Pix(48, 56);
  const dy = pose.bob;
  const hx = pose.hx;
  const hy = pose.hy + dy;
  const cx = 22;
  const top = 26 + dy;
  const swish = pose.cape === 2 ? 5 : pose.cape === 1 ? 2 : 0;
  hairBack(p, hx, hy, !!pose.hairWild, swish);
  capeBlazer(p, cx, top, pose.cape);
  body(p, cx, top, f === 3 || f === 5 ? "wide" : "stand");
  // ---- back arm (screen-left) with the clipboard hugged to the chest
  if (pose.back === "fist") {
    layer(p, (l) => {
      strand(l, [[cx - 5, top + 2], [cx - 8, top + 8], [cx - 6, top + 12]], 3, 3, SKIN);
      l.ellipse(cx - 6, top + 12, 2, 2, "s");
    });
    clipboard(p, 2, 40);
  } else {
    const up = pose.back === "clipUp" ? -2 : 0;
    layer(p, (l) => {
      strand(l, [[cx - 5, top + 2], [cx - 8, top + 7], [cx - 9, top + 10 + up]], 3, 3, SKIN);
    });
    clipboard(p, cx - 17, top + 5 + up);
    // fingers gripping the board edge
    layer(p, (l) => l.ellipse(cx - 9, top + 10 + up, 1.6, 1.6, "s"));
  }
  capeFront(p, cx, top);
  armband(p, cx - 8, top + 4);
  // ---- head
  face(p, hx, hy, pose.face);
  bangs(p, hx, hy, !!pose.hairWild);
  brows(p, hx, hy, pose.face);
  // ---- front arm (screen-right)
  const sh: P2 = [cx + 5, top + 2];
  if (pose.front === "stamp") {
    stamp(p, 31, top + 10);
    layer(p, (l) => strand(l, [sh, [cx + 8, top + 7], [cx + 13, top + 11]], 3, 3, SKIN));
  } else if (pose.front === "point") {
    stamp(p, 0, 40);
    layer(p, (l) => {
      strand(l, [sh, [cx + 12, top - 1], [cx + 19, top - 4]], 3, 2.6, SKIN);
      // pointing finger
      l.line(cx + 19, top - 4, cx + 23, top - 6, "s");
      l.ellipse(cx + 19, top - 4, 1.6, 1.4, "s");
    });
    // accusation lines
    for (const [x0, y0, x1, y1] of [[40, 8, 44, 6], [42, 13, 47, 13], [40, 18, 44, 20]] as [number, number, number, number][]) p.line(x0, y0, x1, y1, "w");
    sparkle(p, hx - 4, hy - 1, 2);
  } else if (pose.front === "slam") {
    layer(p, (l) => strand(l, [sh, [cx + 11, top + 6], [cx + 15, top + 17]], 3, 3, SKIN));
    stamp(p, 31, 40);
    // impact: stamped red mark + shock lines
    p.line(29, 55, 44, 55, "R");
    for (const [x0, y0, x1, y1] of [[27, 46, 24, 43], [45, 46, 47, 43], [26, 51, 22, 51], [46, 51, 47, 51]] as [number, number, number, number][]) p.line(x0, y0, x1, y1, "w");
    sparkle(p, 44, 38, 1);
  } else if (pose.front === "glasses") {
    stamp(p, 31, top + 12);
    // two fingers pushing the glasses up the nose bridge
    layer(p, (l) => {
      strand(l, [sh, [cx + 9, top + 4], [hx + 2, hy + 3]], 3, 2.6, SKIN);
      l.line(hx + 1, hy + 2, hx + 1, hy - 1, "s");
    });
    sparkle(p, hx + 7, hy - 4, 1);
  } else {
    layer(p, (l) => {
      strand(l, [sh, [cx + 9, top + 7], [cx + 11, top + 12]], 3, 3, SKIN);
      l.ellipse(cx + 11, top + 12, 2.2, 2, "s");
    });
    stamp(p, 34, 40);
    // rage aura flicks
    for (const [x, y] of [[2, 10], [44, 4], [5, 22], [42, 22]] as P2[]) p.line(x, y, x + (x < 24 ? -2 : 2), y - 3, "r");
  }
  return p;
}

export const sprites: SpriteDef[] = [gridSprite("boss_president", 48, 56, range(6).map(president), "feet", { fps: 4 })];
