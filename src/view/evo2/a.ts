/**
 * Second evolutions, package A (docs/content/weapons.md §8.3). What the generic projectile drawer and the
 * generic hit feedback cannot express for:
 *
 *   critical_constellation (weapons/star-shot.ts)       the "comet" trail; a thin gold line from each crit to the
 *       next one (FX_STAR_LINK, up to 130 px apart) with a twinkle on the new star, a small ring when the crit kills
 *   already_cut (weapons/petal-slash.ts)                the cut line (w_iai_line, stretched: hairline ->
 *       afterimage -> wisps), a white slit on every marked enemy until the click, the sheath glint on Rin's
 *       hip (her own look: no Focus) and pink halves flying apart on each delayed hit
 *   unrequited_heart (weapons/heart-boomerang.ts)       the "heartBig" trail and a faint dotted leash from
 *       the hero to each heart's target on Layer.FxBelow (never over her: it starts outside her body)
 *   group_chat_lightning (weapons/thunder-bell.ts)      thin cyan-white bolts (the sky bolt, one per forward,
 *       budgeted), a notification dot popping over every hop, the "seen by everyone" ring. No screen flash,
 *       shake <= 0.05
 *   konpeito_minefield (weapons/candy-bomb.ts)          a white blink when a mine arms, candy bits + a ring in
 *       the mine's tint on the pop (budgeted), a puff of dust on a kick
 *
 * Everything that can land on the hero is a particle on the fx layers or a draw with Flag.Focus. Nothing is
 * drawn on or around her except the sheath glint. Pools are fixed and module-scope: no allocation per frame.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { P, type EmitterDef } from "../../fx";
import type { Enemy } from "../../game/types";
import { FX_MINE_ARM, FX_MINE_KICK, FX_MINE_POP, KONPEITO_TINTS } from "../../game/weapons/candy-bomb";
import { FX_CUT, FX_CUT_CLICK, FX_CUT_MARK } from "../../game/weapons/petal-slash";
import { FX_STAR_LINK } from "../../game/weapons/star-shot";
import { FX_CHAT_BOLT, FX_CHAT_HOP, FX_CHAT_SEEN } from "../../game/weapons/thunder-bell";
import { Flag, Layer } from "../../render/layers";
import type { Evo2Module } from "../evo2-fx";
import { TRAILS } from "../trails";

const STAR = "critical_constellation";
const CUT = "already_cut";
const HEART = "unrequited_heart";
const CHAT = "group_chat_lightning";
const MINES = "konpeito_minefield";

// ---------------------------------------------------------------- emitters / looks
/** Comet trail: gold dust shed behind the star, gone in a quarter of a second (short: no streak). */
const cometDust: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [4, 18],
  spread: TAU,
  life: [0.14, 0.26],
  size: [1.3, 0.4],
  colors: [C.paleYellow, C.yellow, C.orange],
  drag: 3,
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** Big-heart trail: a few small pink motes. */
const heartMote: EmitterDef = { ...cometDust, speed: [3, 12], life: [0.16, 0.3], size: [1.4, 0.5], colors: [C.pink, C.pinkLight, C.hotPink] };
/** Already Cut: the two halves of the cut flying apart (emitted twice, at +-90 degrees from the line). */
const cutHalf: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [50, 95],
  spread: 0.5,
  life: [0.16, 0.28],
  size: [1.8, 0.6],
  aspect: 2.4,
  colors: [C.pinkLight, C.pink, C.white],
  drag: 5,
  rot: "velocity",
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** Konpeito pop: candy bits (the Candy Bomb confetti, fewer and shorter). */
const candyBit: EmitterDef = { ...P.confetti, speed: [35, 95], colors: [C.pink, C.pinkLight, C.mint, C.paleYellow, C.white, C.lavender] };
/** A mine arming: one white blink on the candy. */
const armBlink: EmitterDef = {
  sprite: "fx_spark",
  frames: "life",
  speed: [0, 0],
  life: [0.1, 0.1],
  size: [0.9, 0.9],
  colors: C.white,
  alphaCurve: "none",
  layer: Layer.Fx,
};
const pingSpark: EmitterDef = { ...P.sparkle, speed: [20, 60], life: [0.14, 0.26], size: [0.7, 0.4], colors: [C.white, C.aqua, C.cyan] };

Object.assign(TRAILS, {
  comet: { def: cometDust, every: 2, n: 1, color: C.yellow, halo: 7, haloAlpha: 0.16 },
  heartBig: { def: heartMote, every: 3, n: 1, color: C.hotPink, halo: 0, haloAlpha: 0 },
});

/** Konpeito pop: the candy's points flung out in its tint (normal blend: it reads on a pale floor too). */
const popSpike: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [55, 100],
  spread: TAU,
  life: [0.12, 0.22],
  size: [2, 0.7],
  aspect: 2.6,
  colors: C.pink,
  drag: 4,
  rot: "velocity",
  alphaCurve: "late",
  layer: Layer.Fx,
};

// ---------------------------------------------------------------- pools
const LINKS = 24;
const LINK_LIFE = 0.45;
/** Longest link drawn (px). */
const LINK_MAX = 130;
const linkXY = new Float32Array(LINKS * 4);
const linkT = new Float32Array(LINKS).fill(9);
let linkN = 0;

const LINES = 6;
const LINE_LIFE = 0.5;
const lineXY = new Float32Array(LINES * 5);
const lineT = new Float32Array(LINES).fill(9);
let lineN = 0;

const MARKS = 48;
const markE: (Enemy | null)[] = new Array<Enemy | null>(MARKS).fill(null);
const markUid = new Int32Array(MARKS);
const markT = new Float32Array(MARKS);
const markWait = new Float32Array(MARKS);
let markN = 0;
/** Angle of the last cut (the slits lie along it). */
let cutAng = 0;
/** Seconds since the last sheath click (the glint). */
let clickT = 9;

/**
 * Group Chat bolts. Drawn here, not by fx/lightning.ts: that one is additive only and vanishes on a pale floor
 * (Shoujo Academy). A dark-blue and cyan bed under a white core, all normal blend, re-jittered every 40 ms.
 */
const BOLTS = 40;
const boltXY = new Float32Array(BOLTS * 4);
const boltT = new Float32Array(BOLTS).fill(9);
const boltLife = new Float32Array(BOLTS);
/** Core thickness (px): 2 = the sky bolt, 1 = a forward. */
const boltW = new Float32Array(BOLTS);
let boltN = 0;

function bolt(x0: number, y0: number, x1: number, y1: number, life: number, thick: number): void {
  const i = boltN++ % BOLTS;
  boltXY[i * 4] = x0;
  boltXY[i * 4 + 1] = y0;
  boltXY[i * 4 + 2] = x1;
  boltXY[i * 4 + 3] = y1;
  boltT[i] = 0;
  boltLife[i] = life;
  boltW[i] = thick;
}

/** Cheap repeatable noise in -1..1. */
function jit(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

const PINGS = 28;
const PING_LIFE = 0.42;
const pingXY = new Float32Array(PINGS * 2);
const pingT = new Float32Array(PINGS).fill(9);
let pingN = 0;

/** Per-frame budgets (reset in `frame`). */
let hops = 0;
let pops = 0;
let halves = 0;
/** View clock (s) and the last time a rate-limited sound played. */
let now = 0;
let popSfxAt = -1;
let hopSfxAt = -1;

let hLine = -1;
let hSheath = -1;
let hPing = -1;
let hFlare = -1;

function clear(): void {
  linkT.fill(9);
  lineT.fill(9);
  pingT.fill(9);
  boltT.fill(9);
  markE.fill(null);
  markN = 0;
  clickT = 9;
  popSfxAt = hopSfxAt = -1;
}

const packageA: Evo2Module = {
  ids: [STAR, CUT, HEART, CHAT, MINES],
  reset() {
    clear();
  },
  bind(w, kit, o) {
    const ps = kit.fx.ps;
    return [
      w.bus.on("heroFx", (e) => {
        switch (e.kind) {
          case FX_STAR_LINK: {
            // (a link stays local: two crits a screen apart get their twinkles, not a line across the whole fight)
            const lx = e.x2 - e.x;
            const ly = e.y2 - e.y;
            const far = lx * lx + ly * ly;
            if (far > 0 && far < LINK_MAX * LINK_MAX) {
              const i = linkN++ % LINKS;
              linkXY[i * 4] = e.x;
              linkXY[i * 4 + 1] = e.y;
              linkXY[i * 4 + 2] = e.x2;
              linkXY[i * 4 + 3] = e.y2;
              linkT[i] = 0;
            }
            ps.emit(P.sparkle, e.x2, e.y2, 2, NaN, C.paleYellow, 0.9, 0.5);
            if (e.n) ps.emit(P.ringThin, e.x2, e.y2, 1, NaN, C.yellow, 0.7);
            break;
          }
          case FX_CUT: {
            const i = lineN++ % LINES;
            lineXY[i * 5] = e.x;
            lineXY[i * 5 + 1] = e.y;
            lineXY[i * 5 + 2] = e.x2;
            lineXY[i * 5 + 3] = e.y2;
            lineXY[i * 5 + 4] = e.r;
            lineT[i] = 0;
            if (e.n === 0) cutAng = Math.atan2(e.y2 - e.y, e.x2 - e.x);
            break;
          }
          case FX_CUT_MARK: {
            if (!e.enemy) break;
            const i = markN++ % MARKS;
            markE[i] = e.enemy;
            markUid[i] = e.n;
            markT[i] = 0;
            markWait[i] = e.r;
            break;
          }
          case FX_CUT_CLICK:
            clickT = 0;
            markE.fill(null);
            if (e.n >= 3 && !o.calm) kit.fx.juice.shake(Math.min(0.14, 0.04 + e.n * 0.012));
            break;
          case FX_CHAT_BOLT:
            bolt(e.x, e.y, e.x2, e.y2, 0.2, 2);
            ps.emit(pingSpark, e.x2, e.y2, 4);
            ping(e.x2, e.y2);
            break;
          case FX_CHAT_HOP: {
            if (hops++ >= 16) break;
            bolt(e.x, e.y, e.x2, e.y2, 0.17, 1);
            ps.emit(pingSpark, e.x2, e.y2, 2);
            ping(e.x2, e.y2);
            // (the notification tick, climbing with the chain; never more than one every 70 ms)
            if (now - hopSfxAt >= 0.07) {
              hopSfxAt = now;
              o.sfx("countTick", 0.22, Math.min(12, e.n), e.x2);
            }
            break;
          }
          case FX_CHAT_SEEN:
            ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.aqua, e.r / 16);
            ps.emit(P.ring, e.x, e.y, 1, NaN, C.cyan, e.r / 26);
            ps.emit(pingSpark, e.x, e.y, 8, NaN, -1, 1.2, 1.6);
            if (!o.calm) kit.fx.juice.shake(0.05);
            o.sfx("thunder", 0.35, 5, e.x);
            break;
          case FX_MINE_ARM:
            ps.emit(armBlink, e.x, e.y - 1, 1);
            break;
          case FX_MINE_POP: {
            if (pops++ >= 6) break;
            const tint = KONPEITO_TINTS[e.n] ?? C.pinkLight;
            ps.emit(P.ringThin, e.x, e.y - 3, 1, NaN, tint, e.r / 16);
            ps.emit(popSpike, e.x, e.y - 3, 7, NaN, tint, e.r / 22);
            ps.emit(candyBit, e.x, e.y - 3, 6, NaN, -1, 0.9, 1);
            ps.emit(P.sparkle, e.x, e.y - 4, 3, NaN, tint, 1, 1.4);
            ps.emit(P.flare, e.x, e.y - 3, 1, NaN, C.white, e.r / 30);
            if (now - popSfxAt >= 0.09) {
              popSfxAt = now;
              o.sfx("explosion", 0.5, 4, e.x);
            }
            break;
          }
          case FX_MINE_KICK:
            ps.emit(P.dust, e.x, e.y, 2, NaN, -1, 0.6, 0.6);
            break;
        }
      }),
      w.bus.on("enemyHit", (e) => {
        if (e.source !== CUT || halves++ >= 10) return;
        // the delayed cut lands: two halves fly apart across the line, a few petals
        ps.emit(cutHalf, e.x, e.y, 2, cutAng + Math.PI / 2);
        ps.emit(cutHalf, e.x, e.y, 2, cutAng - Math.PI / 2);
        ps.emit(P.petals, e.x, e.y, 2);
      }),
    ];
  },
  frame(kit, w, _time, dt) {
    hops = pops = halves = 0;
    now += dt;
    const r = kit.r;
    if (hLine < 0) {
      hLine = r.handle("w_iai_line");
      hSheath = r.handle("fx_sheath");
      hPing = r.handle("fx_ping");
      hFlare = r.handle("fx_flare");
    }
    // ---- Critical Constellation: the links (a crisp 1-px line, no glow: nothing here can bloom into a beam)
    for (let i = 0; i < LINKS; i++) {
      if (linkT[i] >= LINK_LIFE) continue;
      const k = linkT[i] / LINK_LIFE;
      linkT[i] += dt;
      const j = i * 4;
      const al = 1 - k * k;
      // (a gold bed under a pale hairline: it has to read on the pale academy floor as well as on night grass)
      r.line(Layer.Fx, linkXY[j], linkXY[j + 1], linkXY[j + 2], linkXY[j + 3], 3, C.orange, 0.6 * al, Flag.Focus);
      r.line(Layer.Fx, linkXY[j], linkXY[j + 1], linkXY[j + 2], linkXY[j + 3], 1, k < 0.25 ? C.white : C.paleYellow, al, Flag.Focus);
      const s = 0.55 * (1 - k);
      r.spr(Layer.Fx, hFlare, linkXY[j + 2], linkXY[j + 3], s, s, 0, C.paleYellow, al, 0, Flag.Focus);
    }
    // ---- Already Cut: the line (it starts clear of her body and fades over her anyway)
    for (let i = 0; i < LINES; i++) {
      const t = lineT[i];
      if (t >= LINE_LIFE) continue;
      lineT[i] += dt;
      const j = i * 5;
      const dx = lineXY[j + 2] - lineXY[j];
      const dy = lineXY[j + 3] - lineXY[j + 1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const clearK = Math.min(0.4, 12 / len);
      const cx = lineXY[j] + dx * (0.5 + clearK * 0.5);
      const cy = lineXY[j + 1] + dy * (0.5 + clearK * 0.5);
      const f = t < 0.09 ? 0 : t < 0.26 ? 1 : 2;
      const a = t < 0.26 ? 1 : 1 - (t - 0.26) / (LINE_LIFE - 0.26);
      r.spr(Layer.Fx, hLine + f, cx, cy, (len * (1 - clearK)) / 46, Math.max(1, lineXY[j + 4] / 5), Math.atan2(dy, dx), 0xffffff, a, 0, Flag.NoSnap | Flag.Focus);
    }
    // ... the marks: a white slit across each marked enemy, flickering faster as the click comes
    const ca = Math.cos(cutAng);
    const sa = Math.sin(cutAng);
    for (let i = 0; i < MARKS; i++) {
      const e = markE[i];
      if (!e) continue;
      markT[i] += dt;
      if (e.dead || e.uid !== markUid[i] || markT[i] > markWait[i] + 0.1) {
        markE[i] = null;
        continue;
      }
      const k = Math.min(1, markT[i] / Math.max(0.05, markWait[i]));
      const half = e.r + 2;
      const y = e.y - e.cy;
      const al = 0.55 + 0.45 * Math.sin(markT[i] * (18 + 30 * k));
      r.line(Layer.Fx, e.x - ca * half, y - sa * half, e.x + ca * half, y + sa * half, 3, C.outline, 0.5, Flag.Focus);
      r.line(Layer.Fx, e.x - ca * half, y - sa * half, e.x + ca * half, y + sa * half, 1, C.white, al, Flag.Focus);
    }
    // ... and the sheath glint on her hip (her own look)
    if (clickT < 0.18) {
      const pl = w.player;
      r.spr(Layer.Fx, hSheath + (clickT < 0.09 ? 0 : 1), pl.x - pl.face * 5, pl.y - 7, 1, 1, 0, 0xffffff, 1, 0, Flag.Glow);
    }
    clickT += dt;
    // ---- Group Chat Lightning: the bolts
    for (let i = 0; i < BOLTS; i++) {
      const t = boltT[i];
      if (t >= boltLife[i]) continue;
      boltT[i] += dt;
      const j = i * 4;
      const x0 = boltXY[j];
      const y0 = boltXY[j + 1];
      const dx = boltXY[j + 2] - x0;
      const dy = boltXY[j + 3] - y0;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const segs = Math.max(2, Math.min(9, Math.round(len / 14)));
      const amp = Math.min(7, len * 0.16);
      const q = Math.floor(t / 0.04) + i * 7;
      const k = t / boltLife[i];
      const al = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
      const th = boltW[i];
      let ax = x0;
      let ay = y0;
      for (let n = 1; n <= segs; n++) {
        const f = n / segs;
        const off = n === segs ? 0 : jit(q, n) * amp;
        const bx = x0 + dx * f - (dy / len) * off;
        const by = y0 + dy * f + (dx / len) * off;
        r.line(Layer.Fx, ax, ay, bx, by, th + 3, 0x3462d6, 0.5 * al, Flag.Focus);
        r.line(Layer.Fx, ax, ay, bx, by, th + 1.5, C.cyan, 0.9 * al, Flag.Focus);
        r.line(Layer.Fx, ax, ay, bx, by, th, C.white, al, Flag.Focus | Flag.Glow);
        ax = bx;
        ay = by;
      }
    }
    // ... and the notification dots: they pop over the hops and drift up
    for (let i = 0; i < PINGS; i++) {
      const t = pingT[i];
      if (t >= PING_LIFE) continue;
      pingT[i] += dt;
      const k = t / PING_LIFE;
      const s = k < 0.2 ? 0.6 + 5 * k : 1.6 - 0.3 * Math.min(1, (k - 0.2) * 4);
      r.spr(Layer.Fx, hPing + (k < 0.3 ? 1 : 0), pingXY[i * 2], pingXY[i * 2 + 1] - 4 * k, s, s, 0, 0xffffff, k < 0.7 ? 1 : (1 - k) / 0.3, 0, Flag.Focus);
    }
  },
  draw(kit, w, inst, time) {
    if (inst.def.id !== HEART) return;
    // the leash: a faint dotted line under everything from her to each heart's target, crawling outward
    const r = kit.r;
    const pl = w.player;
    const hx = pl.x;
    const hy = pl.y - 10;
    for (const p of inst.projs) {
      const t = p.target;
      // (owned entries are pooled objects: only a live heart of ours)
      if (p.dead || p.sprite !== "w_heart_big" || !t || t.dead || t.uid !== p.targetUid) continue;
      const dx = t.x - hx;
      const dy = t.y - t.cy - hy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 26) continue;
      const ux = dx / len;
      const uy = dy / len;
      for (let d = 16 + ((time * 26) % 7); d < len - 6; d += 7) r.rect(Layer.FxBelow, hx + ux * d - 1, hy + uy * d - 1, 2, 2, C.hotPink, 0.5);
    }
  },
};

/** A notification dot over (x, y). */
function ping(x: number, y: number): void {
  const i = pingN++ % PINGS;
  pingXY[i * 2] = x;
  pingXY[i * 2 + 1] = y - 12;
  pingT[i] = 0;
}

export const evo2: Evo2Module[] = [packageA];
