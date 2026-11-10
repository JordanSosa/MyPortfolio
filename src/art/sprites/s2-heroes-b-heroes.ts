/**
 * Season 2 hero sprites, owner s2-heroes-b: Senpai, Magical Girl #47,
 * Isekai-kun. 24x24, feet pivot (12, 23), facing right. Built on the same
 * layered rig and pose timing as the base cast (s2-heroes-b-util).
 * Art direction: docs/content/heroes.md §2.8-2.10.
 */
import type { SpriteDef } from "../format";
import { Pix } from "./chars-util";
import { type HeroDef, type LegSet, type Pose, SPARKLE, SPARK_S, bend, heroSprites, wave } from "./s2-heroes-b-util";

// ============================================================================ SENPAI
// Long-legged chibi: 13x12 head (head ~50% of the height), 4-row legs.
const S_LEGS: LegSet = {
  idle: `
..nn.NN..
..nn.NN..
..ss.SS..
..gG.Ff..
`,
  run: [
    `
..nnNN...
.nn..NN..
.ss...SS.
gG.....Ff
`,
    `
...nNN...
..nn.NN..
.ss..SS..
Gg...Ff..
`,
    `
...NNn...
...NNn...
...SSs...
...Ffg...
`,
    `
..NNnn...
.NN..nn..
.SS...ss.
Ff.....gG
`,
    `
...Nnn...
..NN.nn..
.SS..ss..
fF...gG..
`,
    `
...nnN...
...nnN...
...ssS...
...gGf...
`,
  ],
  hurt: `
.NN..nn..
.NN..nn..
.SS...ss.
Ff.....gG
`,
  cast: `
.nn...NN.
.nn...NN.
.ss...SS.
.gG...Ff.
`,
};

/** Head fill (outlined in code). Side-swept fringe: a big lock sweeps down-right over the far eye. */
const S_HEAD_FILL = `
.............
....jjjjjj...
..jjjWWwjjj..
.jjWWjjjjjjg.
.jjjjjjjjjgg.
.j0gsGjjjjjg.
.jg000Gjjjjg.
.jgswIsGjjjg.
.jgsIiskGjjg.
.jgsiisskGjg.
..gkbbsksGg..
.............
`;
const S_HEAD = Pix.of(S_HEAD_FILL, "senpai head").outline("1").str();
/** Cast: hair flip - the sweep is flung up, revealing the far eye; both eyes sparkle. */
const S_HEAD_FLIP_FILL = `
.............
....jjjjjj...
..jjjWWwjjj..
.jjWWjjjjjjg.
.jjjjjjjjjgg.
.j0gsGsGjjgg.
.jgs00ssG00g.
.jg0ss0sswIg.
.jgsssssIiGg.
.jgkssssiisg.
..gbbsk0bbg..
.............
`;
const S_HEAD_FLIP = Pix.of(S_HEAD_FLIP_FILL, "senpai head flip").outline("1").str();
const S_FACE_BLINK = `
.............
.............
.............
.............
.............
.............
..sssss......
...ssss......
..00000......
...ssss......
`;
const S_FACE_HURT = `
.............
.............
.............
.............
.............
.............
..s0ss0......
...s00s......
...0ss0......
...ssss......
....b00s.....
`;
const S_FACE_CAST = `
.............
.............
.............
.............
.............
.............
.............
.............
.............
.............
.............
`;
/** Long back hair falling behind the shoulders, pointed tips. */
const S_BACK_HAIR = `
..111.
.1jjj1
1jjjg1
1jjgg1
1jjgG1
1jgG1.
1jgG1.
1jgGG1
.1gG1.
.1gG1.
..1G1.
..1G1.
...1..
`;
const S_BODY = `
...1gWIWg1..
.11wgWIWrW1.
1wW1wWIR1Wg1
1wW1YWIE1Wg1
1s1wwWIgg1s1
.1wwgW2ggW1.
`;
const S_BODY_POCKET = `
...1gWIWg1..
.11wgWIWrW1.
1wW1wWIR1Wg1
1wW1YWIE1Wg1
1s1wwWIgg1g1
.1wwgW2ggW1.
`;
const S_BODY_NOHAND = `
...1gWIWg1..
.11wgWIWrW1.
1wW1wWIR1W1.
1wW1YWIE1W1.
1s1wwWIgg11.
.1wwgW2ggW1.
`;
/** Blazer tail flap streaming behind (image-left) while running. */
const S_TAIL = [
  `
..11
.1w1
1wg1
1g1.
.1..
`,
  `
...11
..1w1
.1wg1
1wg1.
.11..
`,
];
/** Far arm raised to brush the fringe (hand top-right). */
const S_ARM_BRUSH = `
...111
..1st1
..1ss1
.1wg1.
.1Wg1.
1wg1..
1W1...
`;
/** Arm thrown up in the hurt recoil. */
const S_ARM_UP = `
.111.
1sst1
1ss1.
1wW1.
1wg1.
.1W1.
.11..
`;
/** Rose held out toward the camera (cast). Arm comes out of the far shoulder. */
const S_ROSE_ARM = `
.....111..
....1qrR1.
....1rRR1.
.1111RR11.
1wwwsE1...
1gggg11...
.1111.....
`;
/** Twinkles drift up 1px per idle frame (one of them is a little cross on the bright beat). */
const SENPAI_SPARKS: [number, number, string][][] = [
  [[2, 7, "w"], [21, 11, "z"], [20, 3, "w"]],
  [[2, 6, "z"], [21, 10, "w"], [20, 2, "z"]],
  [[2, 5, "w"], [21, 9, "z"]],
  [[2, 4, "z"], [21, 8, "w"], [20, 4, "w"]],
];

const SENPAI: HeroDef = {
  id: "senpai",
  head: S_HEAD,
  headFor: (p: Pose) => (p.anim === "cast" ? S_HEAD_FLIP : null),
  faces: { blink: S_FACE_BLINK, hurt: S_FACE_HURT, cast: S_FACE_CAST },
  legPal: { N: "G", n: "2", S: "G", s: "2", F: "H", f: "d", G: "d", g: "d" },
  legSet: S_LEGS,
  legY: 18,
  back(c, p, { hx, hy, bx, by }) {
    let hair: Pix;
    if (p.anim === "idle") hair = bend(S_BACK_HAIR, 6, p.i >= 2 ? -1 : 0, 9, p.i === 1 || p.i === 2 ? -1 : 0);
    else if (p.anim === "run") hair = wave(S_BACK_HAIR, (y) => (y < 3 ? 0 : y < 7 ? -1 : p.i % 3 === 1 ? -1 : -2));
    else if (p.anim === "hurt") hair = bend(S_BACK_HAIR, 3, 1, 7, 2);
    else hair = bend(S_BACK_HAIR, 3, -1, 7, -2);
    c.put(hair, hx - 4, hy + 2);
    if (p.anim === "run") c.put(S_TAIL[p.i % 2], bx - 2 - (p.i % 2), 15 + by);
  },
  body(c, p, { bx, by }) {
    const b = p.anim === "run" ? S_BODY_POCKET : p.anim === "cast" || p.anim === "hurt" || (p.anim === "idle" && p.i === 2) ? S_BODY_NOHAND : S_BODY;
    c.put(b, bx, 13 + by);
  },
  front(c, p, { hx, hy, bx, by }) {
    if (p.anim === "idle") {
      if (p.i === 2) c.put(S_ARM_BRUSH, bx + 8, 6 + by);
      for (const [x, y, k] of SENPAI_SPARKS[p.i]) c.set(x, y, k);
    } else if (p.anim === "run") {
      const ph = p.i % 3;
      c.set(2, 5 - ph, ph === 1 ? "z" : "w");
      c.set(21, 10 - ph, "w");
      if (ph === 2) c.put(SPARK_S, 19, 1);
    } else if (p.anim === "cast") {
      c.put(S_ROSE_ARM, bx + 9, 12 + by);
      // the flipped fringe flies out to the right of the head
      c.put(
        `
.111.
1jjg1
.1jjg1
..1gG1
...11.
`,
        hx + 10,
        hy + 2 - p.i,
        { under: true },
      );
      if (p.i === 0) {
        c.put(SPARK_S, 20, 6);
        for (const [x, y] of [[2, 3], [1, 12], [22, 12]] as [number, number][]) c.set(x, y, "w");
      } else {
        c.put(SPARKLE, 18, 4);
        c.put(SPARK_S, 1, 5);
        for (const [x, y] of [[3, 13], [22, 13], [12, 0]] as [number, number][]) c.set(x, y, "z");
      }
    } else {
      // hurt: no sparkles at all, far arm thrown up
      c.put(S_ARM_UP, bx + 9, 8 + by);
    }
  },
};


// ============================================================================ MAGICAL GIRL #47
// The default magical-girl template: light-blue bob (NOT pink), one heart clip,
// mint puffy dress, white boots, heart wand, tiny gold badge. Too symmetrical.
const MG_HEAD_FILL = `
..............
.....vvvv.....
...vwwvvvvv...
..vwwvvvvvvu..
.vvvvvvvvvvvu.
.vvuvvuvvuvuu.
.vus111ss111u.
.vusswUsswUsu.
.vussUussUusu.
.vussuvssuvsu.
.vukbbsRsbbku.
.uv.ssssss.vu.
..............
`;
const MG_HEAD = Pix.of(MG_HEAD_FILL, "mg47 head").outline("1").str();
const MG_FACE_BLINK = `
..............
..............
..............
..............
..............
..............
...sssssssss..
...sssssssss..
...s111ss111..
...sssssssss..
`;
const MG_FACE_HURT = `
..............
..............
..............
..............
..............
..............
...s1sss1ss1..
...ss1s1ss1s..
...s1sss1ss1..
...sssssssss..
...kbbs11sbbk.
`;
const MG_FACE_CAST = `
..............
..............
..............
..............
..............
..............
...s111ss111..
...swwUswwUs..
...sUwussUwu..
...suvussuvs..
...kbbs00bbk..
.......RR.....
`;
/** Bob ends that flip out at shoulder height (both sides, symmetrical). */
const MG_BOB_L = `
1v1.
1uv1
.1u1
..1.
`;
const MG_CLIP = `
.1.1.
1q1p1
1ppP1
.1P1.
..1..
`;
const MG_CLIP_S = `
1.1
111
.1.
`;
const MG_BODY = `
..1wwmmww1..
.1wWmyymWW1.
.1s1myYme1s1
..1wmmmeW1..
.1mmmemmee1.
1wWwWwWwWWW1
`;
const MG_BODY_NOHAND = `
..1wwmmww1..
.1wWmyymWW1.
.1s1myYme11.
..1wmmmeW1..
.1mmmemmee1.
1wWwWwWwWWW1
`;
const MG_BODY_WAVE = `
..1wwmmww1..
.1wWmyymWW1.
.111myYme1s1
..1wmmmeW1..
.1mmmemmee1.
1wWwWwWwWWW1
`;
/** Heart wand head (7x6) - stick is drawn separately. */
const MG_WAND = `
.11.11.
1qq1pp1
1qpppP1
.1ppP1.
..1P1..
...1...
`;
const MG_HEART_SPARK = `
q.q
qwq
.q.
`;
const MG_HEART_SPARK_BIG = `
.w...w.
wqw.wqw
.qqwqq.
..qqq..
...q...
`;
const MG_ARM_UP = `
..1s1
.1w1.
1m1..
`;
const MG_WAVE_HAND = `
.111.
1sst1
1sss1
.1s1.
.1w1.
.1W1.
`;

const MG47: HeroDef = {
  id: "magical_girl_47",
  head: MG_HEAD,
  faces: { blink: MG_FACE_BLINK, hurt: MG_FACE_HURT, cast: MG_FACE_CAST },
  legPal: { N: "s", n: "k", S: "w", s: "W", F: "w", f: "g", G: "W", g: "G" },
  back(c, p, { hx, hy }) {
    const sw = p.anim === "run" ? -1 : 0;
    c.put(MG_BOB_L, hx - 1 + sw, hy + 10);
    c.put(MG_BOB_L, hx + 11 + sw, hy + 10, { flip: true });
  },
  body(c, p, { bx, by }) {
    const b = p.anim === "cast" || p.anim === "hurt" ? MG_BODY_NOHAND : p.anim === "idle" && p.i === 2 ? MG_BODY_WAVE : MG_BODY;
    c.put(b, bx, 14 + by);
  },
  front(c, p, { hx, hy, bx, by }) {
    // the one heart clip (pops off when hurt)
    if (p.anim === "hurt") c.put(MG_CLIP, hx - 3, hy - 1);
    else c.put(MG_CLIP, hx + 1, hy + 2);
    if (p.anim === "idle" || p.anim === "run") {
      const wy = 16 + by;
      const bobW = p.anim === "idle" ? (p.i === 1 || p.i === 2 ? 1 : 0) : p.i % 2;
      // stick from the near hand up to the heart
      c.set(bx + 11, wy, "g").set(bx + 12, wy - 1, "g").set(bx + 10, wy, "1");
      c.put(MG_WAND, bx + 11, wy - 6 + bobW);
      if (p.anim === "idle" && p.i === 2) c.put(MG_WAVE_HAND, bx - 1, 9 + by);
    } else if (p.anim === "cast") {
      const ax = bx + 9;
      const ay = 14 + by;
      c.put(MG_ARM_UP, ax - 1, ay - 1);
      c.set(ax + 3, ay - 2, "g").set(ax + 3, ay - 3, "g").set(ax + 4, ay - 4, "g");
      c.put(MG_WAND, ax + 2, ay - 10);
      // a little heart sparkle pops above the wand
      c.put(p.i === 0 ? MG_HEART_SPARK : MG_HEART_SPARK_BIG, p.i === 0 ? ax + 6 : ax + 5, ay - 13);
      c.set(2, 6 + p.i, "q").set(21, 12 - p.i, "q");
    } else {
      c.put(MG_ARM_UP, bx + 8, 13 + by);
    }
  },
};

// ============================================================================ ISEKAI-KUN
// The most average boy possible: flat helmet hair with no shine (everyone else
// has glossy anime hair), tiny neutral eyes, beige hoodie, grey capelet, a sword
// he never draws, sneakers from his previous life, and a floating status icon.
const IK_HEAD_FILL = `
..............
....hhhhhh....
..hhhhhhhhhh..
.hhhhhhhhhhhH.
.hhhhhhhhhhhH.
.hhhhhhhhhhHH.
.hHHHHHHHHHHH.
.hHss11ss11sH.
.hHsswdsswdsH.
.hHssHdssHdsH.
..Hkssssksssk.
...sssssssss..
..............
`;
const IK_HEAD = Pix.of(IK_HEAD_FILL, "isekai head").outline("1").str();
const IK_FACE_BLINK = `
..............
..............
..............
..............
..............
..............
..............
...ssssssss...
...ss11ss11...
...ssssssss...
`;
const IK_FACE_HURT = `
..............
..............
..............
..............
..............
..............
..............
...ssssssss...
...ss1sss1s...
...ssssssss...
...kssssskks..
`;
/** Cast: the same blank face, lids a touch lower (unbothered). */
const IK_FACE_CAST = `
..............
..............
..............
..............
..............
..............
..............
...ss11ss11...
...ss11ss11...
...ssHdssHd...
`;
/** Status window icon (3x3 + outline). */
const IK_ICON = `
.111.
1uuu1
1awa1
1aaa1
.111.
`;
/** Enlarged status window above the raised finger (cast). */
const IK_ICON_BIG = `
.111111.
1uuuuUu1
1awawaa1
1aaaaaa1
1awwawa1
1aaaaaa1
.111111.
`;
/** Sword hilt poking up over the shoulder (the rest is behind his back). */
const IK_SWORD = `
.111.
.1Y1.
.1H1.
.1H1.
1YYY1
.111.
`;
const IK_CAPE = [
  `
..11..
.1gG1.
1ggG1.
1gGG1.
1gGG1.
1ggGG1
1gGG21
.1G221
..1111
`,
  `
..11...
.1gG1..
1ggG1..
1gGG1..
1ggGG1.
1gGGG21
.1gG221
..11111
`,
];
const IK_BODY = `
...1hhhh1...
.11GBBBBhG11
1BB1BwBh1Bh1
1BB1BwBh1Bh1
1s1hhhhhh1s1
.1BBBBBhhB1.
`;
const IK_BODY_POCKET = `
...1hhhh1...
.11GBBBBhG11
1BB1BwBh1Bh1
.1BB1wBh1h1.
..11hhhhh11.
.1BBBBBhhB1.
`;
const IK_BODY_NOHAND = `
...1hhhh1...
.11GBBBBhG11
1BB1BwBh1B1.
1BB1BwBh1B1.
1s1hhhhhh11.
.1BBBBBhhB1.
`;
/** Raised index finger (cast). */
const IK_FINGER = `
..1.
.1s1
.1s1
1ss1
1Bh1
1B1.
`;
const IK_ARM_UP = `
..1s1
.1B1.
1B1..
`;

const ISEKAI: HeroDef = {
  id: "isekai_kun",
  head: IK_HEAD,
  faces: { blink: IK_FACE_BLINK, hurt: IK_FACE_HURT, cast: IK_FACE_CAST },
  legPal: { N: "U", n: "n", S: "U", s: "n", F: "w", f: "g", G: "W", g: "G" },
  // the stillness is the joke: no breathing bob at all in idle
  bobFor: (p: Pose) => (p.anim === "idle" ? 0 : null),
  back(c, p, { hx, hy, bx, by }) {
    c.put(IK_SWORD, hx - 4, hy + 8);
    const cape = p.anim === "run" ? IK_CAPE[1] : IK_CAPE[0];
    const sway = p.anim === "run" ? (p.i % 2 ? -1 : 0) : p.anim === "hurt" ? 1 : 0;
    c.put(bend(cape, 4, sway), bx - 4 - (p.anim === "run" ? 1 : 0), 14 + by);
  },
  body(c, p, { bx, by }) {
    const b = p.anim === "run" ? IK_BODY_POCKET : p.anim === "cast" || p.anim === "hurt" ? IK_BODY_NOHAND : IK_BODY;
    c.put(b, bx, 14 + by);
  },
  front(c, p, { hx, hy, bx, by }) {
    const iconBob = p.anim === "idle" ? [0, -1, -1, 0][p.i] : p.anim === "run" ? [0, -1, -1, 0, 0, -1][p.i] : 0;
    if (p.anim === "cast") {
      c.put(IK_FINGER, bx + 9, 10 + by);
      c.put(IK_ICON_BIG, bx + 9, 2 + by - p.i);
      if (p.i === 1) c.put(SPARK_S, bx + 16, by + 1);
    } else if (p.anim === "hurt") {
      c.put(IK_ARM_UP, bx + 8, 13 + by);
      c.put(IK_ICON, hx + 14, hy - 1);
      // single sweat drop
      c.set(hx + 13, hy + 5, "a").set(hx + 13, hy + 6, "a").set(hx + 12, hy + 6, "c");
    } else {
      c.put(IK_ICON, hx + 14, hy - 1 + iconBob);
    }
  },
};

export const sprites: SpriteDef[] = [...heroSprites(SENPAI), ...heroSprites(MG47), ...heroSprites(ISEKAI)];
