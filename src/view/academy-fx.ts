/**
 * Shoujo Academy visuals (stage 3): the academy roster, the Student Council
 * President and The Bishounen Who Never Notices You. Wired like the other
 * content views (WorldView constructs it, Feedback.bind subscribes it):
 *
 *   decorate  per enemy: the Hall Monitor's whistle glint + dash afterimages, the
 *             Tsundere Slime's blush / angry return, Transfer Student sparkles at
 *             its destination, the Council Ninja's smoke, the President's glasses
 *             glint, the Bishounen's rose petals and phone glow
 *   draw      glare beams (3-fan and the rotating 5), the phone-glare wedge and sweep,
 *             the Dramatic Wind lane, ninja decoys, REJECTED stamps, the School
 *             Regulation rule card under the timer, the F- badge under the XP bar,
 *             and phase 3's shoujo filter (pink lift, bloom +40 %, sparkle border,
 *             the music swells)
 *   bind      `stageCue` academy_* kinds, the bell chime, deaths (boss death lines),
 *             prop breaks (paper scraps, cans)
 *
 * Reads the world, never mutates it. No per-frame allocation.
 */
import { C } from "../art/palette";
import { audio } from "../audio";
import { TAU, clamp, easeOutBack } from "../core/math";
import { P, type EmitterDef, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import type { TextOpts } from "../render/text";
import type { StageCueEvent } from "../game/events";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";
import {
  academyState,
  DECOY_FUSE,
  MAX_DECOYS,
  SA_BLUSH,
  SA_DECOY_BOOM,
  SA_FAIL,
  SA_REJECTED,
  SA_RETURN,
  SA_SMOKE,
  SA_TELE_IN,
  SA_TELE_OUT,
  SA_WHISTLE,
} from "../game/enemies/_academy";
import { MON_DASH, MON_WHISTLE } from "../game/enemies/hall-monitor";
import { SLIME_FLEEING, SLIME_RETURNING } from "../game/enemies/tsundere-slime";
import { TS_ARRIVING, TS_BLINKING } from "../game/enemies/transfer-student";
import {
  activeRule,
  CP_GLARE,
  CP_GLINT,
  CP_SWEEP,
  CP_SWEEP_TELE,
  GLARE_LEN,
  GLARE_T,
  presidentEyeY,
  presidentState,
  RULE_ON,
  RULE_TITLES,
  SA_CRACK,
  SA_DETENTION,
  SA_GLINT,
  SA_RULE,
  SA_STAMP,
  SWEEP_LEN,
  SWEEP_N,
} from "../game/bosses/council-president";
import {
  BS_PHONE,
  BS_PHONE_TELE,
  BS_WIND,
  BS_WIND_TELE,
  bishState,
  phoneAngle,
  PHONE_ARC,
  PHONE_LEN,
  SA_FLIP,
  SA_HEART,
  SA_NOTICED,
  SA_PHONE,
  SA_WIND,
  WIND_HALF,
} from "../game/bosses/bishounen";
import { bulletLook } from "./bullet-looks";
import type { Anims } from "./anims";
import type { WorldTexts } from "./texts";
import type { Speech } from "./speech";
import type { StageFxOpts } from "./candy-fx";

// ---------------------------------------------------------------- bullets
bulletLook("eb_shuriken", { glow: C.lightBlue, glowR: 8, spin: 14 });
bulletLook("eb_stamp", { glow: C.red, glowR: 10 });
bulletLook("eb_rose", { glow: C.pink, glowR: 9.5, spin: 1.5 });
bulletLook("fx_heart", { glow: C.pinkLight, glowR: 7, tint: C.pink });

// ---------------------------------------------------------------- emitters
/** Paper scraps (desks, exam papers). */
const paper: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [30, 80],
  life: [0.6, 1.0],
  size: [1.3, 1],
  colors: [C.white, C.offWhite, 0xfff0c9],
  rot: "random",
  spin: [4, 10],
  drag: 1.5,
  gravity: 40,
  sway: 14,
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** Ninja smoke. */
const smoke: EmitterDef = {
  sprite: "fx_puff",
  frames: "life",
  speed: [10, 34],
  life: [0.4, 0.7],
  size: [0.7, 1.3],
  colors: [0xb6acd9, 0x7a6ea3, C.offWhite],
  alpha: 0.8,
  drag: 3,
  gravity: -10,
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** Sparkles (transfer students, glints, the noticed moment). */
const shine: EmitterDef = {
  sprite: "fx_spark",
  frames: "life",
  speed: [12, 50],
  life: [0.3, 0.6],
  size: [1, 0.5],
  colors: [C.white, C.lavender, C.pinkLight, C.lightBlue],
  drag: 2.5,
  additive: true,
  glow: true,
  alphaCurve: "none",
  layer: Layer.FxAdd,
};
/** Glass shards (cracked glasses). */
const shards: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [40, 100],
  life: [0.4, 0.7],
  size: [1, 0.6],
  colors: [C.white, C.lightBlue, C.aqua],
  rot: "random",
  spin: [8, 18],
  gravity: 160,
  additive: true,
  glow: true,
  alphaCurve: "late",
  layer: Layer.FxAdd,
};
/** Sakura petals blown along the wind lane / around the Bishounen. */
const petals: EmitterDef = {
  sprite: "fx_petal",
  frames: "random",
  speed: [40, 90],
  life: [0.6, 1.1],
  size: [1, 0.8],
  colors: [C.pinkLight, C.pink, C.white],
  rot: "random",
  spin: [3, 8],
  sway: 10,
  alphaCurve: "late",
  layer: Layer.Fx,
};

const BEAM = 0xbafff6;
const FAIL_X = ["", "", "x2", "x3", "x4", "x5", "x6"];
/** REJECTED stamps: a few at a time, on some deaths only (they are a tiny joke, not a wall of text). */
const MAX_STAMPS = 3;
const STAMP_CHANCE = 0.35;
const STAMP_LIFE = 0.7;
/** Rule card text rows ("RULE 7" / "NO RUNNING IN THE HALLS"), split once. */
const RULE_ROWS = new Map<number, [string, string]>();
for (const [k, v] of Object.entries(RULE_TITLES)) {
  const i = v.indexOf(": ");
  RULE_ROWS.set(Number(k), [v.slice(0, i), v.slice(i + 2)]);
}

export class AcademyFx {
  private w: World | null = null;
  private o: StageFxOpts | null = null;
  private frameN = 0;
  private live = true;
  private budget = 0;
  private readonly hSpark: number;
  private readonly hGlow: number;
  private readonly hNinjaSmoke: number;
  private readonly hHeart: number;
  /** REJECTED stamps: x, y, age. */
  private readonly sx = new Float64Array(MAX_STAMPS);
  private readonly sy = new Float64Array(MAX_STAMPS);
  private readonly st = new Float64Array(MAX_STAMPS).fill(9);
  private stampHead = 0;
  /** F- badge pulse (s since the last stack). */
  private failPulse = 9;
  /** Shoujo filter blend (Bishounen phase 3). */
  private shoujoK = 0;
  /** Rule card: rule shown + its drop-in clock. */
  private cardRule = 0;
  private cardAge = 9;
  /** Boss state last frame (phone glare start sound). */
  private lastBossState = -1;
  private readonly tOpts: TextOpts = { scale: 1, color: C.red, align: "center", valign: "middle", rotation: -0.22, layer: Layer.Text, alpha: 1 };

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    anims: Anims,
    private readonly texts: WorldTexts,
    private readonly speech: Speech,
  ) {
    this.hSpark = r.atlas.handle("fx_spark");
    this.hGlow = r.atlas.handle("fx_glow");
    this.hNinjaSmoke = anims.get("en_council_ninja").first + 3;
    this.hHeart = r.atlas.handle("fx_heart");
  }

  setWorld(w: World): void {
    this.w = w;
    this.st.fill(9);
    this.failPulse = 9;
    this.shoujoK = 0;
    this.cardRule = 0;
    this.cardAge = 9;
    this.lastBossState = -1;
  }

  private sfx(id: Parameters<StageFxOpts["sfx"]>[0], vol = 1, pitch = 0, x = NaN): void {
    this.o?.sfx(id, vol, pitch, x);
  }

  // ================================================================ per enemy
  decorate(e: Enemy, h: number, sx: number, sy: number, y: number, time: number, tint: number, flash: number): boolean {
    const r = this.r;
    const frozen = tint !== 0xffffff;
    const live = this.live && !frozen;
    switch (e.def.id) {
      case "hall_monitor":
        if (e.state === MON_WHISTLE) {
          const k = clamp(e.timer / 0.3, 0, 1);
          const wx = e.x + e.face * 5 * e.scale;
          const wy = y - 7 * e.scale;
          r.glow(wx, wy, (3 + 5 * k) * e.scale, C.yellow, 0.4 + 0.4 * k);
          r.spr(Layer.FxAdd, this.hSpark, wx + e.face * 3, wy - 2, 0.6 + 0.6 * k, 0.6 + 0.6 * k, time * 4, C.white, 0.9, 0, Flag.Add | Flag.Glow);
        } else if (e.state === MON_DASH && live && (this.frameN + e.uid) % 3 === 0) {
          this.fx.ghosts.spawn(h, e.x, y, sx, sy, 0, C.navy, 0.18, 0.45, Layer.FxBelow);
        }
        return false;
      case "tsundere_slime":
        if (e.state === SLIME_FLEEING) {
          // flustered: pink glow + shiver
          r.glow(e.x, y - 6 * e.scale, 9 * e.scale, C.pink, 0.25 + 0.1 * Math.sin(time * 18));
          const j = frozen ? 0 : ((((time * 40) | 0) & 1) * 2 - 1) * 0.6;
          r.spr(Layer.Entity, h, e.x + j, y, sx, sy, 0, tint, e.alpha, flash, 0);
          return true;
        }
        if (e.state === SLIME_RETURNING) {
          r.glow(e.x, y - 6 * e.scale, 8 * e.scale, C.red, 0.18 + 0.08 * Math.sin(time * 24));
          if (live && (this.frameN + e.uid) % 3 === 0) this.fx.ghosts.spawn(h, e.x, y, sx, sy, 0, C.red, 0.16, 0.35, Layer.FxBelow);
        }
        return false;
      case "transfer_student": {
        if (e.state === TS_ARRIVING || e.state === TS_BLINKING) {
          // sparkles gather where it will appear
          const k = clamp(e.timer / (e.state === TS_ARRIVING ? 0.6 : 0.5), 0, 1);
          if (live && (this.frameN & 1) === 0 && this.budget-- > 0) {
            const a = Math.random() * TAU;
            this.fx.ps.emit(shine, e.c + Math.cos(a) * 14, e.d - 8 + Math.sin(a) * 10, 1, a + Math.PI, -1, 0.8, 0.8);
          }
          r.glow(e.c, e.d - 8, 6 + 8 * k, C.lavender, 0.2 + 0.3 * k);
        }
        // hidden until it has arrived
        return e.state === TS_ARRIVING;
      }
      case "council_ninja":
        if (e.state === 3 && live && (this.frameN + e.uid) % 4 === 0) this.fx.ps.emit(smoke, e.x, y - 6, 1, NaN, -1, 0.6);
        return false;
      case "council_president":
        this.decoratePresident(e, y, time);
        return false;
      case "bishounen":
        this.decorateBishounen(e, y, time, live);
        return false;
    }
    return false;
  }

  private decoratePresident(e: Enemy, y: number, time: number): void {
    const r = this.r;
    const s = presidentState(e);
    if (!s) return;
    const ex = e.x + 4 * e.face;
    const ey = y - 44;
    if (e.state === CP_GLINT || e.state === CP_SWEEP_TELE) {
      // the glasses glint (bigger as the beams are about to fire)
      const k = clamp(e.timer / 0.8, 0, 1);
      r.glow(ex, ey, 4 + 8 * k, C.white, 0.5 + 0.4 * k);
      r.spr(Layer.FxAdd, this.hSpark, ex, ey, 1 + 1.5 * k, 1 + 1.5 * k, time * 2, C.white, 1, 0, Flag.Add | Flag.Glow);
    } else if ((Math.floor(time * 0.8 + e.uid) & 3) === 0 && time % 1.25 < 0.12) {
      r.spr(Layer.FxAdd, this.hSpark, ex, ey, 0.8, 0.8, 0, C.white, 0.9, 0, Flag.Add | Flag.Glow);
    }
    // the authority aura while a rule is in force
    if (s.rule) r.ring(Layer.Decal, e.x, e.y, 26 + 2 * Math.sin(time * 4), C.red, 0.35, 0, true);
  }

  private decorateBishounen(e: Enemy, y: number, time: number, live: boolean): void {
    const r = this.r;
    const s = bishState(e);
    const p3 = (s?.phase ?? 1) >= 3;
    const by = y - 32;
    // a sparkle aura (shoujo protagonists come with their own lighting)
    r.batch.sortKey = e.y - 0.02;
    r.spr(Layer.Entity, this.hGlow, e.x, by, 2.2, 2.6, 0, p3 ? C.pink : C.lavender, (0.22 + 0.06 * Math.sin(time * 2.6)) * e.alpha, 0, Flag.Add);
    r.batch.sortKey = NaN;
    if (live && (this.frameN & 7) === 0 && this.budget-- > 0) this.fx.ps.emit(petals, e.x + (Math.random() - 0.5) * 30, by - 20, 1, Math.PI * 0.6, -1, 0.9, 0.4);
    if (live && (this.frameN % 11) === 0) this.fx.ps.emit(shine, e.x + (Math.random() - 0.5) * 34, by + (Math.random() - 0.5) * 40, 1, NaN, -1, 0.8, 0.5);
    if (s && (e.state === BS_PHONE_TELE || e.state === BS_PHONE)) {
      // the phone screen lights his face
      r.glow(e.x - e.face * 6, by + 2, 7 + 2 * Math.sin(time * 20), C.aqua, 0.55);
    }
  }

  // ================================================================ per frame
  draw(time: number, dt: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    this.frameN++;
    this.live = dt > 0;
    this.budget = 10;
    this.failPulse += realDt;
    const b = w.boss && !w.boss.dead ? w.boss : null;
    if (b?.def.id === "council_president") this.drawGlare(b, time);
    if (b?.def.id === "bishounen") this.drawBishounen(b, w, time);
    this.drawDecoys(w, time);
    this.drawStamps(realDt);
    this.drawRuleCard(w, realDt, time);
    this.drawFail(w);
    this.applyShoujo(b, realDt, time);
    this.lastBossState = b ? b.state : -1;
  }

  private drawGlare(e: Enemy, time: number): void {
    const s = presidentState(e);
    if (!s) return;
    const r = this.r;
    let n = 0;
    let a0 = 0;
    let step = 0;
    let len = 0;
    let k = 1;
    if (e.state === CP_GLARE) {
      n = 3;
      step = (20 * Math.PI) / 180;
      a0 = s.aim - step;
      len = GLARE_LEN;
      k = 1 - clamp(e.timer / GLARE_T, 0, 1) * 0.6;
    } else if (e.state === CP_SWEEP) {
      n = SWEEP_N;
      step = TAU / SWEEP_N;
      a0 = s.aim;
      len = SWEEP_LEN;
    } else return;
    const flick = 0.85 + 0.15 * Math.sin(time * 40);
    for (let i = 0; i < n; i++) {
      const a = a0 + i * step;
      const x1 = s.ox + Math.cos(a) * len;
      const y1 = s.oy + Math.sin(a) * len;
      r.line(Layer.FxAdd, s.ox, s.oy, x1, y1, 7, BEAM, 0.35 * k * flick, Flag.Add | Flag.Glow);
      r.line(Layer.FxAdd, s.ox, s.oy, x1, y1, 2, C.white, 0.9 * k, Flag.Add | Flag.Glow);
    }
    // the glare comes off her glasses
    r.line(Layer.FxAdd, e.x + 4 * e.face, presidentEyeY(e), s.ox, s.oy, 2, C.white, 0.6 * k, Flag.Add | Flag.Glow);
    r.glow(s.ox, s.oy, 12, BEAM, 0.6 * k);
  }

  private drawBishounen(e: Enemy, w: World, time: number): void {
    const s = bishState(e);
    if (!s) return;
    const r = this.r;
    if (e.state === BS_PHONE_TELE) {
      // the wedge he is about to sweep with his phone's glare
      const k = clamp(e.timer / 1.0, 0, 1);
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const a = s.a0 + s.dir * PHONE_ARC * (i / n);
        r.line(Layer.Decal, s.ox, s.oy, s.ox + Math.cos(a) * PHONE_LEN, s.oy + Math.sin(a) * PHONE_LEN, 3, BEAM, 0.08 + 0.1 * k, 0);
      }
    } else if (e.state === BS_PHONE) {
      if (this.lastBossState !== BS_PHONE) this.sfx("beam", 0.6, 3, e.x);
      for (let j = 0; j < 4; j++) {
        const a = phoneAngle(s, e.timer - j * 0.05);
        const al = 1 - j * 0.24;
        const x1 = s.ox + Math.cos(a) * PHONE_LEN;
        const y1 = s.oy + Math.sin(a) * PHONE_LEN;
        r.line(Layer.FxAdd, s.ox, s.oy, x1, y1, j === 0 ? 8 : 5, BEAM, 0.3 * al, Flag.Add | Flag.Glow);
        if (j === 0) r.line(Layer.FxAdd, s.ox, s.oy, x1, y1, 2, C.white, 0.95, Flag.Add | Flag.Glow);
      }
      r.glow(s.ox, s.oy - 4, 10, C.aqua, 0.6);
    } else if ((e.state === BS_WIND_TELE || e.state === BS_WIND) && this.live) {
      // petals streaming along the wind lane
      const p = w.player;
      const n = e.state === BS_WIND ? 3 : 1;
      for (let i = 0; i < n && this.budget-- > 0; i++) {
        const x = s.push > 0 ? p.x - w.viewW * 0.5 : p.x + w.viewW * 0.5;
        this.fx.ps.emit(petals, x, s.laneY + (Math.random() - 0.5) * WIND_HALF * 1.6, 1, s.push > 0 ? 0 : Math.PI, -1, 1, e.state === BS_WIND ? 2.6 : 1.2);
      }
      if (e.state === BS_WIND) {
        const q = 0.5 + 0.5 * Math.sin(time * 12);
        r.line(Layer.Decal, p.x - w.viewW * 0.5, s.laneY - WIND_HALF, p.x + w.viewW * 0.5, s.laneY - WIND_HALF, 1, C.white, 0.35 + 0.2 * q);
        r.line(Layer.Decal, p.x - w.viewW * 0.5, s.laneY + WIND_HALF, p.x + w.viewW * 0.5, s.laneY + WIND_HALF, 1, C.white, 0.35 + 0.2 * q);
      }
    }
  }

  private drawDecoys(w: World, time: number): void {
    const s = academyState(w);
    if (!s) return;
    const r = this.r;
    for (let i = 0; i < MAX_DECOYS; i++) {
      const t = s.dt[i];
      if (t <= 0) continue;
      const k = 1 - t / DECOY_FUSE;
      const blink = ((t * (10 + 30 * k)) | 0) & 1;
      r.spr(Layer.Entity, this.hNinjaSmoke, s.dx[i], s.dy[i], 1, 1, 0, blink ? C.white : C.lavender, 0.55, blink ? 0.6 : 0.2, 0);
      r.glow(s.dx[i], s.dy[i] - 6, 6 + 6 * k, C.violet, 0.3 + 0.3 * k);
      r.spr(Layer.FxAdd, this.hSpark, s.dx[i] + 4, s.dy[i] - 14, 0.7, 0.7, time * 9, C.yellow, 1, 0, Flag.Add | Flag.Glow);
    }
  }

  private drawStamps(realDt: number): void {
    const r = this.r;
    const o = this.tOpts;
    for (let i = 0; i < MAX_STAMPS; i++) {
      const t = (this.st[i] += realDt);
      if (t > STAMP_LIFE) continue;
      const pop = t < 0.1 ? easeOutBack(t / 0.1, 3) : 1;
      o.scale = Math.max(0.5, pop);
      o.alpha = 0.9 * (t > STAMP_LIFE - 0.25 ? (STAMP_LIFE - t) / 0.25 : 1);
      o.color = C.red;
      r.text.draw("REJECTED", this.sx[i], this.sy[i], o);
    }
  }

  /** The School Regulation card, dropped in under the timer. */
  private drawRuleCard(w: World, realDt: number, time: number): void {
    const ar = activeRule(w);
    const r = this.r;
    if (ar && ar.rule !== this.cardRule) {
      this.cardRule = ar.rule;
      this.cardAge = 0;
    }
    if (!ar) {
      this.cardRule = 0;
      return;
    }
    this.cardAge += realDt;
    const rows = RULE_ROWS.get(ar.rule);
    if (!rows) return;
    const v = r.camera.view;
    const tw = Math.max(r.text.measure(rows[0], 1), r.text.measure(rows[1], 1));
    const cw = Math.min(v.w - 12, Math.ceil(tw) + 14);
    const ch = 25;
    const drop = this.cardAge < 0.4 ? 1 - easeOutBack(this.cardAge / 0.4, 1.8) : 0;
    const fade = ar.t < 0.3 ? ar.t / 0.3 : 1;
    const x = Math.round(v.x + v.w / 2 - cw / 2);
    const y = Math.round(v.y + v.h * (w.viewW > w.viewH ? 0.2 : 0.155) - drop * 40);
    const L = Layer.Overlay;
    const sway = Math.sin(time * 2) * 0.5;
    r.rect(L, x + 2, y + 2, cw, ch, C.outline, 0.35 * fade);
    r.rect(L, x, y, cw, ch, 0xfff0c9, fade);
    r.rect(L, x, y, cw, 1, C.red, fade);
    r.rect(L, x, y + ch - 1, cw, 1, C.red, fade);
    r.rect(L, x, y, 1, ch, C.red, fade);
    r.rect(L, x + cw - 1, y, 1, ch, C.red, fade);
    // the pin
    r.rect(L, x + cw / 2 - 1 + sway, y - 2, 3, 3, C.red, fade);
    r.text.drawFast(L, rows[0], x + cw / 2, y + 3, 1, C.red, fade, 1, 0, 0);
    r.text.drawFast(L, rows[1], x + cw / 2, y + 12, 1, C.outline, fade, 1, 0, 0);
    // time left
    const k = clamp(ar.t / RULE_ON, 0, 1);
    r.rect(L, x + 2, y + ch - 3, Math.max(0, (cw - 4) * k), 1, C.red, 0.8 * fade);
  }

  /** "F-" badge under the XP bar while Exam Paper stacks are active. */
  private drawFail(w: World): void {
    const s = academyState(w);
    if (!s || s.fStacks <= 0) return;
    const r = this.r;
    const v = r.camera.view;
    const x = Math.round(v.x + 6);
    const y = Math.round(v.y + v.h * (w.viewW > w.viewH ? 0.12 : 0.085));
    const pop = this.failPulse < 0.25 ? 1 + 0.4 * (1 - this.failPulse / 0.25) : 1;
    const L = Layer.Overlay;
    const bw = 14 + (s.fStacks > 1 ? 10 : 0);
    r.rect(L, x, y, bw * pop, 10 * pop, C.red, 0.92);
    r.rect(L, x, y, bw * pop, 1, C.white, 0.5);
    r.text.drawFast(L, "F-", x + 2, y + 1, pop >= 1.2 ? 1 : 1, C.white, 1, 0, 0, 0);
    if (s.fStacks > 1) r.text.drawFast(L, FAIL_X[Math.min(6, s.fStacks)], x + 13, y + 1, 1, C.paleYellow, 1, 0, 0, 0);
  }

  /** Phase 3 of the Bishounen: the whole world turns into a shoujo panel. */
  private applyShoujo(b: Enemy | null, realDt: number, time: number): void {
    const s = b && b.def.id === "bishounen" ? bishState(b) : undefined;
    const want = s && s.phase >= 3 ? 1 : 0;
    this.shoujoK += clamp(want - this.shoujoK, -realDt * 0.7, realDt * 0.7);
    const k = this.shoujoK;
    if (k <= 0.001) return;
    const r = this.r;
    const post = r.post;
    const g = post.grade;
    g.lift[0] += 0.06 * k;
    g.lift[1] += 0.01 * k;
    g.lift[2] += 0.05 * k;
    g.saturation += 0.08 * k;
    g.brightness *= 1 + 0.03 * k;
    post.bloomSurge(0.4 * k, 0.4);
    if (this.o?.sound && want) audio.setIntensity(1);
    // the sparkle screen border: a soft pink frame (3 layers deep), sparkles and hearts drifting
    // along it (a steady glow only in calm / reduced-flashing mode)
    const v = r.camera.view;
    const L = Layer.Overlay;
    for (let j = 0; j < 3; j++) {
      const e0 = 4 + j * 5;
      const a = (0.16 - j * 0.045) * k;
      r.rect(L, v.x, v.y, v.w, e0, C.pink, a);
      r.rect(L, v.x, v.y + v.h - e0, v.w, e0, C.pink, a);
      r.rect(L, v.x, v.y + e0, e0, v.h - e0 * 2, C.pinkLight, a);
      r.rect(L, v.x + v.w - e0, v.y + e0, e0, v.h - e0 * 2, C.pinkLight, a);
    }
    if (this.o?.calm) return;
    const n = 28;
    const per = (v.w + v.h) * 2;
    for (let i = 0; i < n; i++) {
      const u = ((i / n) * per + time * 18) % per;
      let x: number;
      let y: number;
      const inset = 5 + (i % 3) * 3;
      if (u < v.w) {
        x = v.x + u;
        y = v.y + inset;
      } else if (u < v.w + v.h) {
        x = v.x + v.w - inset;
        y = v.y + (u - v.w);
      } else if (u < v.w * 2 + v.h) {
        x = v.x + v.w - (u - v.w - v.h);
        y = v.y + v.h - inset;
      } else {
        x = v.x + inset;
        y = v.y + v.h - (u - v.w * 2 - v.h);
      }
      const tw = 0.5 + 0.5 * Math.sin(time * 6 + i * 1.7);
      if (i % 4 === 0) r.spr(L, this.hHeart, x, y, 1, 1, Math.sin(time * 3 + i) * 0.3, C.pink, 0.75 * k, 0, Flag.Glow);
      else r.spr(L, this.hSpark, x, y, 0.8 + 1.1 * tw, 0.8 + 1.1 * tw, time * 2 + i, i & 1 ? C.white : C.pinkLight, 0.9 * k * tw, 0, Flag.Add | Flag.Glow);
    }
  }

  // ================================================================ events
  bind(w: World, o: StageFxOpts): (() => void)[] {
    this.w = w;
    this.o = o;
    const bus = w.bus;
    return [
      bus.on("stageCue", (e) => this.onCue(e)),
      bus.on("enemyKilled", (e) => {
        const id = e.enemy.def.id;
        if (id === "council_president") {
          this.fx.ps.emit(paper, e.x, e.y - 30, 26, NaN, -1, 1.2, 1.4);
          this.speech.sayAt(e.x, e.y - 64, "This... will go on your... permanent record...", 3);
        } else if (id === "bishounen") {
          this.fx.ps.emit(petals, e.x, e.y - 34, 30, NaN, -1, 1.2, 1.4);
          this.speech.sayAt(e.x, e.y - 72, "...Who are you again?", 3);
        } else if (id === "exam_paper") {
          this.fx.ps.emit(paper, e.x, e.y - 6, 4, NaN, -1, 0.8);
        }
      }),
      bus.on("propBroken", (e) => {
        if (e.sprite === "prop_school_desk") {
          this.fx.ps.emit(paper, e.x, e.y - 8, 16, NaN, -1, 1.1, 1.3);
          this.fx.ps.emit(P.debris, e.x, e.y - 6, 6, NaN, 0xa6683f);
        } else if (e.sprite === "prop_vending") {
          this.fx.ps.emit(P.confetti, e.x, e.y - 14, 14, NaN, -1, 1);
          this.fx.ps.emit(shine, e.x, e.y - 16, 6, NaN, C.lightBlue);
          this.texts.add("*clunk*", e.x, e.y - 30, { color: C.lightBlue, scale: 1, life: 0.8, rise: 10 });
        }
      }),
      bus.on("waveIncoming", (e) => {
        if (w.stage.id !== "shoujo_academy") return;
        if (e.kind === "bell") this.sfx("schoolChime", 0.9);
        else if (e.kind === "teleport") this.sfx("sparkleCharm", 0.5, -3);
      }),
    ];
  }

  /** A pop near (x, y) but never within 32 px of the hero (satire pop rule). */
  private clearOfHero(x: number, y: number, out: { x: number; y: number }): void {
    const p = this.w!.player;
    const hx = p.x;
    const hy = p.y - 9;
    let dx = x - hx;
    let dy = y - hy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= 34) {
      out.x = x;
      out.y = y;
      return;
    }
    if (d < 1) {
      dx = 0;
      dy = -1;
    } else {
      dx /= d;
      dy /= d;
    }
    out.x = hx + dx * 34;
    out.y = hy + dy * 34;
  }
  private readonly pt = { x: 0, y: 0 };

  private onCue(e: StageCueEvent): void {
    const fx = this.fx;
    const juice = fx.juice;
    const calm = !!this.o?.calm;
    switch (e.kind) {
      case SA_WHISTLE:
        fx.ps.emit(shine, e.x, e.y, e.n ? 6 : 3, NaN, C.yellow, 0.9);
        this.sfx("whistle", e.n ? 0.8 : 0.45, e.n ? -2 : (Math.random() * 3) | 0, e.x);
        break;
      case SA_FAIL: {
        this.failPulse = 0;
        this.clearOfHero(e.x2, e.y2 - 10, this.pt);
        this.texts.add("F-", this.pt.x, this.pt.y, { color: C.red, scale: e.r ? 3 : 2, life: 0.8, rise: 10, wobble: 2 });
        this.sfx("uiDeny", 0.45, -2, e.x);
        break;
      }
      case SA_BLUSH:
        fx.ps.emit(P.hearts, e.x, e.y - 4, 2, NaN, C.pink, 0.6);
        this.sfx("voiceBlip", 0.3, 6, e.x);
        break;
      case SA_RETURN:
        fx.ps.emit(P.dust, e.x, e.y + 4, 3, Math.atan2(-e.y2, -e.x2));
        break;
      case SA_SMOKE:
        fx.ps.emit(smoke, e.x, e.y, 6, NaN, -1, 1);
        if (!e.x2) this.sfx("dash", 0.35, -6, e.x);
        break;
      case SA_DECOY_BOOM:
        fx.ps.emit(P.explosion, e.x, e.y - 6, 1, NaN, -1, e.r / 16);
        fx.ps.emit(P.ring, e.x, e.y - 6, 1, NaN, C.violet, e.r / 14);
        fx.ps.emit(smoke, e.x, e.y - 6, 5, NaN, -1, 1.2);
        if (!calm && juice) juice.shake(0.15);
        this.sfx("explosion", 0.45, 3, e.x);
        break;
      case SA_TELE_OUT:
        fx.ps.emit(shine, e.x, e.y, 8, NaN, -1, 0.9);
        break;
      case SA_TELE_IN:
        fx.ps.emit(shine, e.x, e.y, 10, NaN, -1, 1, 1.2);
        fx.ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.lavender, 0.6);
        this.sfx("sparkleCharm", 0.18, 4, e.x);
        break;
      case SA_REJECTED: {
        if (e.n) fx.ps.emit(P.hearts, e.x, e.y, 3, NaN, C.pink, 0.8);
        if (!e.n && Math.random() >= STAMP_CHANCE) break;
        const i = this.stampHead;
        this.stampHead = (this.stampHead + 1) % MAX_STAMPS;
        this.clearOfHero(e.x, e.y - 6, this.pt);
        this.sx[i] = this.pt.x;
        this.sy[i] = this.pt.y;
        this.st[i] = 0;
        break;
      }
      case SA_STAMP:
        fx.ps.emit(P.sparkle, e.x, e.y, 3, NaN, C.red, 0.9);
        this.sfx("hit", 0.5, -8, e.x);
        break;
      case SA_GLINT:
        fx.ps.emit(shine, e.x, e.y, 6, NaN, C.white, 1);
        this.sfx("sparkleCharm", 0.5, 7, e.x);
        break;
      case SA_RULE:
        this.sfx("warning", 0.45, 2);
        break;
      case SA_DETENTION:
        this.texts.add(`-${Math.round(e.r)} DETENTION`, 0, -30, { anchor: 1, color: C.red, scale: 1, life: 1.1, rise: 10 });
        this.sfx("uiDeny", 0.7, -4);
        break;
      case SA_CRACK:
        fx.ps.emit(shards, e.x, e.y, 14, NaN, -1, 1);
        if (!calm && juice) juice.flash(C.white, 0.18, 0.12);
        this.sfx("crunch", 0.8, 4, e.x);
        break;
      case SA_FLIP:
        fx.ps.emit(petals, e.x, e.y, 10, Math.atan2(e.y2, e.x2), -1, 1, 1.2);
        fx.ps.emit(shine, e.x, e.y, 6, NaN, -1, 1);
        this.sfx("sparkleCharm", 0.4, 0, e.x);
        break;
      case SA_WIND:
        this.sfx("dash", 0.5, -8, e.x);
        break;
      case SA_PHONE:
        this.sfx("telegraph", 0.5, 4, e.x);
        break;
      case SA_NOTICED:
        fx.ps.emit(P.hearts, e.x, e.y, 14, NaN, C.pink, 1.2, 1.4);
        fx.ps.emit(shine, e.x, e.y, 24, NaN, -1, 1.3, 1.8);
        fx.ps.emit(P.rays, e.x, e.y, 16, NaN, C.pinkLight, 1.2);
        if (!calm && juice) {
          juice.flash(C.pinkLight, 0.35, 0.4);
          juice.bloomSurge(1, 1);
        }
        this.sfx("transform", 0.8, 0, e.x);
        break;
      case SA_HEART:
        fx.ps.emit(shine, e.x, e.y, 8, NaN, C.pinkLight, 1);
        this.sfx("sparkleCharm", 0.45, -4, e.x);
        break;
    }
  }
}

