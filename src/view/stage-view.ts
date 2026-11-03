/**
 * Stage look (docs/EXPANSION.md §10): everything the view takes from the
 * current StageDef (src/game/stages/) - colour-grade keyframes, the engine
 * ambient densities (petals / motes / fireflies), extra ambient particle
 * layers (sprinkles, snow, bubbles, glitch motes...), the scene clear colour
 * and the music tracks - plus the sim's `stageFx` directives (grade
 * overrides, render scale, animation frame-rate caps, speed lines, still
 * frames) that a stage's boss can drive (Cancel-sama degrading the show).
 *
 *   look.setWorld(w)            new run / attract restart
 *   look.frame(realDt)          grade + ambient targets + directives (Feedback.frame)
 *   look.draw(time)             extra ambient layers (WorldView.draw)
 *   look.music("battle")        stage track ids for the audio layer
 *
 * Grade / ambient keyframes are piecewise linear over normalized run time
 * t / StageDef.gradeSpan (default: the final boss's arrival).
 *
 * Directives: "grade" blends toward a GRADES preset, a DIRECTIVE_GRADES look
 * ("ratings": Cancel-sama's RATINGS DROP) or a stage grade key; "renderScale"
 * sets Renderer.sceneScale (the scene FBO genuinely renders at that fraction
 * of the art resolution; bullets + text stay crisp - ENGINE.md); "animFps"
 * caps the sprite animation clock (WorldView: enemies / boss / deco, never
 * the hero, bullets or gems); "particles" scales the particle density;
 * "speedLines" / "still" as documented in events.ts. With "Reduce flashing"
 * on, the show-degrading ones (renderScale, animFps, particles, speedLines,
 * still, the "ratings" grade) are ignored - the boss's view draws a corner
 * badge instead (finale-fx.ts).
 */
import type { MusicTrack } from "../audio";
import { clamp, TAU } from "../core/math";
import { fxRng } from "../core/rng";
import type { Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import { GRADES, cloneGrade, lerpGrade, type Grade } from "../render/post";
import type { Renderer } from "../render/renderer";
import type { StageFxEvent } from "../game/events";
import { stageGradeSpan, type AmbientLayer, type StageDef, type StageGrade } from "../game/stage";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";

const MAX_PARTS = 120;

/** Looks a "grade" directive can ask for besides the GRADES presets. */
export const DIRECTIVE_GRADES: Record<string, Grade> = {
  // CANCEL-SAMA, RATINGS DROP: viewers are leaving (saturation 1.0 -> 0.25 as it blends in)
  ratings: { tint: [0.97, 0.97, 0.99], lift: [0.03, 0.03, 0.04], saturation: 0.25, contrast: 0.93, brightness: 0.94, hue: 0 },
};

/** Directive kinds that degrade the show (skipped with "Reduce flashing"; restoring ones always pass). */
function degrades(e: StageFxEvent): boolean {
  switch (e.kind) {
    case "renderScale":
      return e.value < 0.999;
    case "particles":
      return e.value > 0 && e.value < 1;
    case "animFps":
    case "speedLines":
      return e.value > 0;
    case "still":
      return true;
    case "grade":
      return e.id === "ratings" && e.value > 0;
    default:
      return false;
  }
}

/** Grade preset by name, or inline values (copied into a render Grade). */
function toGrade(g: string | StageGrade): Grade {
  if (typeof g === "string") return cloneGrade(GRADES[g as keyof typeof GRADES] ?? GRADES.day);
  return { tint: [g.tint[0], g.tint[1], g.tint[2]], lift: [g.lift[0], g.lift[1], g.lift[2]], saturation: g.saturation, contrast: g.contrast, brightness: g.brightness, hue: g.hue };
}

/** Piecewise-linear lookup over `{ at }` keys (sorted); returns the segment index and its blend factor in `seg`. */
function segment(keys: readonly { at: number }[], u: number, seg: { i: number; k: number }): void {
  const n = keys.length;
  if (n <= 1 || u <= keys[0].at) {
    seg.i = 0;
    seg.k = 0;
    return;
  }
  for (let i = 0; i < n - 1; i++) {
    if (u < keys[i + 1].at) {
      const a = keys[i].at;
      const b = keys[i + 1].at;
      seg.i = i;
      seg.k = b > a ? (u - a) / (b - a) : 1;
      return;
    }
  }
  seg.i = n - 2;
  seg.k = 1;
}

/** One extra ambient layer's live particles (struct of arrays, fixed capacity). */
class LayerParts {
  readonly u = new Float32Array(MAX_PARTS);
  readonly v = new Float32Array(MAX_PARTS);
  readonly vx = new Float32Array(MAX_PARTS);
  readonly vy = new Float32Array(MAX_PARTS);
  readonly ph = new Float32Array(MAX_PARTS);
  readonly a = new Float32Array(MAX_PARTS);
  readonly s = new Float32Array(MAX_PARTS);
  readonly col = new Uint32Array(MAX_PARTS);
  readonly frame = new Uint8Array(MAX_PARTS);
  readonly on = new Uint8Array(MAX_PARTS);
  first = 0;
  count = 1;
  target = 0;
  constructor(readonly def: AmbientLayer) {}
}

export class StageLook {
  private w: World | null = null;
  private stage: StageDef | null = null;
  private grades: Grade[] = [];
  private span = 540;
  private readonly seg = { i: 0, k: 0 };
  private readonly amb = { petals: 0, motes: 0, fireflies: 0 };
  private layers: LayerParts[] = [];
  private t = 0;
  private lastX = NaN;
  private lastY = NaN;
  // ---- stageFx directive state
  private readonly ovr = cloneGrade(GRADES.day);
  private ovrFrom = 0;
  private ovrTo = 0;
  private ovrK = 0;
  private ovrT = 0;
  private ovrDur = 0;
  private scaleFrom = 1;
  private scaleTo = 1;
  private scaleT = 0;
  private scaleDur = 0;
  /** Current render scale (1 = full resolution): Renderer.sceneScale. */
  private scale = 1;
  /** Sprite animation fps cap (0 = none) and still-frame seconds left: read by WorldView. */
  animFps = 0;
  stillT = 0;
  private lines = 0;
  private linesT = 0;
  private readonly lineOpts = { color: 0xffffff, intensity: 0.6 };

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
  ) {}

  setWorld(w: World): void {
    this.w = w;
    const st = w.stage;
    this.stage = st;
    this.grades = st.grade.map((k) => toGrade(k.grade));
    this.span = Math.max(1, stageGradeSpan(st));
    this.r.clearColor = st.clearColor;
    this.layers = [];
    for (const l of st.ambient.layers ?? []) {
      const p = new LayerParts(l);
      const info = this.r.atlas.info(l.sprite);
      p.first = info.first;
      p.count = Math.max(1, info.count);
      this.layers.push(p);
    }
    this.resetFx();
  }

  /** Back to the stage's own look (run end / "reset" directive). */
  resetFx(): void {
    this.ovrK = this.ovrFrom = this.ovrTo = 0;
    this.ovrDur = this.ovrT = 0;
    this.animFps = 0;
    this.stillT = 0;
    this.lines = 0;
    if (this.fx.ps) this.fx.ps.density = 1;
    this.scaleFrom = this.scaleTo = this.scale;
    this.scaleT = this.scaleDur = 0;
    this.setScale(1);
  }

  /** Stage music track for a run state. */
  music(kind: "battle" | "boss" | "final"): MusicTrack {
    const m = this.stage?.music;
    return ((m && m[kind]) || kind) as MusicTrack;
  }

  /** Track while boss `e` lives: the stage's final theme for its final boss (or a boss asking for "final"), else its boss theme. */
  bossMusic(e: Enemy): MusicTrack {
    const w = this.w;
    const fin = (w && w.isFinalBoss(e)) || e.def.boss?.music === "final";
    return this.music(fin ? "final" : "boss");
  }

  /** "Reduce flashing" (juice settings): show-degrading directives become the boss view's corner badge. */
  private reduced(): boolean {
    return !!this.fx.juice?.settings?.reduceFlashing;
  }

  /** A sim `stageFx` directive (events.ts StageFxEvent). */
  directive(e: StageFxEvent): void {
    if (degrades(e) && this.reduced()) return;
    switch (e.kind) {
      case "grade": {
        const g = this.findGrade(e.id);
        lerpGrade(g, g, 0, this.ovr);
        this.ovrFrom = this.ovrK;
        this.ovrTo = clamp(e.value, 0, 1);
        this.ovrT = 0;
        this.ovrDur = Math.max(0, e.seconds);
        if (this.ovrDur <= 0) this.ovrK = this.ovrTo;
        break;
      }
      case "renderScale":
        this.scaleFrom = this.scale;
        this.scaleTo = clamp(e.value, 0.25, 1);
        this.scaleT = 0;
        this.scaleDur = Math.max(0, e.seconds);
        if (this.scaleDur <= 0) this.setScale(this.scaleTo);
        break;
      case "animFps":
        this.animFps = Math.max(0, e.value);
        break;
      case "particles":
        if (this.fx.ps) this.fx.ps.density = clamp(e.value || 1, 0.1, 1);
        break;
      case "speedLines":
        this.lines = Math.max(0, e.value);
        this.linesT = 0;
        if (this.lines <= 0) this.fx.speed.stop();
        break;
      case "still":
        this.stillT = Math.max(this.stillT, e.seconds);
        break;
      case "reset":
        this.resetFx();
        break;
    }
  }

  private findGrade(id: string): Grade {
    const st = this.stage;
    if (st) {
      const i = Number(id);
      if (id !== "" && Number.isInteger(i) && i >= 0 && i < this.grades.length) return this.grades[i];
    }
    return DIRECTIVE_GRADES[id] ?? GRADES[id as keyof typeof GRADES] ?? GRADES.neutral;
  }

  /** Per frame (Feedback.frame): the stage grade at the current run time (+ any override) and the ambient targets. */
  frame(realDt: number): void {
    const w = this.w;
    const st = this.stage;
    if (!w || !st) return;
    const post = this.r.post;
    const u = clamp(w.t / this.span, 0, 1);
    const g = this.grades;
    if (g.length === 1) post.blendGrade(g[0], g[0], 0);
    else if (g.length > 1) {
      segment(st.grade, u, this.seg);
      post.blendGrade(g[this.seg.i], g[this.seg.i + 1], this.seg.k);
    }
    // directive: grade override eased in / out
    if (this.ovrDur > 0 && this.ovrT < this.ovrDur) {
      this.ovrT = Math.min(this.ovrDur, this.ovrT + realDt);
      this.ovrK = this.ovrFrom + (this.ovrTo - this.ovrFrom) * (this.ovrT / this.ovrDur);
    }
    if (this.ovrK > 0) lerpGrade(post.grade, this.ovr, this.ovrK, post.grade);
    // Darker and Edgier twist: the whole show a notch darker (glowing gameplay sprites keep their grade protection)
    const dk = w.look.darken;
    if (dk > 0) post.grade.brightness *= 1 - dk;
    // directive: render scale
    if (this.scaleDur > 0 && this.scaleT < this.scaleDur) {
      this.scaleT = Math.min(this.scaleDur, this.scaleT + realDt);
      this.setScale(this.scaleFrom + (this.scaleTo - this.scaleFrom) * (this.scaleT / this.scaleDur));
    } else if (this.scale < 1) this.setScale(this.scale);
    if (this.stillT > 0) this.stillT = Math.max(0, this.stillT - realDt);
    if (this.lines > 0) {
      this.linesT -= realDt;
      if (this.linesT <= 0) {
        this.linesT = 0.45;
        this.lineOpts.intensity = Math.min(1, this.lines);
        this.fx.speed.radial(0.5, this.lineOpts);
      }
    }
    // engine ambient densities
    const ak = st.ambient.base;
    if (ak.length) {
      segment(ak, u, this.seg);
      const a = ak[this.seg.i];
      const b = ak[Math.min(ak.length - 1, this.seg.i + 1)];
      const k = this.seg.k;
      const amb = this.amb;
      amb.petals = Math.round(a.petals + (b.petals - a.petals) * k);
      amb.motes = Math.round(a.motes + (b.motes - a.motes) * k);
      amb.fireflies = Math.round(a.fireflies + (b.fireflies - a.fireflies) * k);
      this.fx.ambient.set(amb);
    }
    for (const l of this.layers) {
      const d = l.def.density;
      if (!d.length) continue;
      segment(d, u, this.seg);
      const a = d[this.seg.i];
      const b = d[Math.min(d.length - 1, this.seg.i + 1)];
      l.target = Math.min(MAX_PARTS, Math.round(a.n + (b.n - a.n) * this.seg.k));
    }
  }

  /**
   * Render scale directive: the scene FBO renders at `s` x the art resolution
   * (Renderer.sceneScale: genuinely fewer, bigger pixels; the protected layers -
   * bullets + text - keep full resolution). The canvas / DPR are untouched.
   */
  private setScale(s: number): void {
    this.scale = s >= 0.999 ? 1 : clamp(s, 0.25, 1);
    this.r.sceneScale = this.scale;
  }

  /** Current scene render scale (1 = full). */
  get renderScale(): number {
    return this.scale;
  }

  // ================================================================ extra ambient layers
  /** Update + draw the stage's extra ambient layers (screen-space, Overlay layer). */
  draw(realDt: number): void {
    if (!this.layers.length) return;
    this.t += realDt;
    const cam = this.r.camera;
    const v = cam.view;
    const dxCam = this.lastX === this.lastX ? cam.x - this.lastX : 0;
    const dyCam = this.lastY === this.lastY ? cam.y - this.lastY : 0;
    this.lastX = cam.x;
    this.lastY = cam.y;
    const W = v.w + 16;
    const H = v.h + 16;
    const b = this.r.batch;
    for (const l of this.layers) {
      const d = l.def;
      let n = 0;
      for (let i = 0; i < MAX_PARTS; i++) if (l.on[i]) n++;
      for (let i = 0; i < MAX_PARTS && n < l.target; i++) {
        if (l.on[i]) continue;
        this.spawn(l, i, v.w, v.h, this.t < 0.1 || d.motion !== "fall");
        n++;
      }
      const over = n - l.target;
      let fading = 0;
      const sway = d.sway ?? 0;
      const flags = d.glow ? Flag.Add | Flag.Glow : 0;
      const baseA = d.alpha ?? 0.85;
      for (let i = 0; i < MAX_PARTS; i++) {
        if (!l.on[i]) continue;
        if (fading < over) {
          fading++;
          l.a[i] -= realDt * 1.5;
          if (l.a[i] <= 0) {
            l.on[i] = 0;
            continue;
          }
        } else l.a[i] = Math.min(1, l.a[i] + realDt * 1.2);
        l.ph[i] += realDt;
        let wx = sway ? Math.sin(l.ph[i] * 1.7) * sway : 0;
        let al = l.a[i] * baseA;
        if (d.motion === "glitch") {
          // jittery hops + hard blinks (RGB-split motes)
          if (fxRng.next() < realDt * 6) {
            l.u[i] += fxRng.spread(10);
            l.v[i] += fxRng.spread(6);
          }
          al *= ((l.ph[i] * 9 + i) | 0) % 3 === 0 ? 0.25 : 1;
          wx = 0;
        }
        l.u[i] += (l.vx[i] + wx) * realDt - dxCam * 0.35;
        l.v[i] += l.vy[i] * realDt - dyCam * 0.35;
        if (l.u[i] < -8) l.u[i] += W;
        else if (l.u[i] > W - 8) l.u[i] -= W;
        if (l.v[i] < -8) {
          if (d.motion === "rise") {
            l.v[i] = H - 8;
            l.u[i] = fxRng.next() * W - 8;
          } else l.v[i] += H;
        } else if (l.v[i] > H - 8) {
          if (d.motion === "fall") {
            l.v[i] = -8;
            l.u[i] = fxRng.next() * W - 8;
          } else l.v[i] -= H;
        }
        const f = d.spin ? ((l.ph[i] * 5) | 0) % l.count : l.frame[i];
        const rot = d.spin ? Math.sin(l.ph[i] * d.spin) * 0.8 : 0;
        b.draw(Layer.Overlay, l.first + f, v.x + l.u[i], v.y + l.v[i], l.s[i], l.s[i], rot, l.col[i], al, 0, flags);
      }
    }
  }

  private spawn(l: LayerParts, i: number, vw: number, vh: number, anywhere: boolean): void {
    const d = l.def;
    l.on[i] = 1;
    l.a[i] = 0;
    l.ph[i] = fxRng.next() * TAU;
    l.u[i] = fxRng.next() * (vw + 16) - 8;
    l.v[i] = anywhere ? fxRng.next() * vh : d.motion === "rise" ? vh + 6 : -8;
    const sp = fxRng.range(d.speed[0], d.speed[1]);
    if (d.motion === "fall") {
      l.vx[i] = fxRng.range(-4, 6);
      l.vy[i] = sp;
    } else if (d.motion === "rise") {
      l.vx[i] = fxRng.range(-3, 3);
      l.vy[i] = -sp;
    } else {
      const a = fxRng.angle();
      l.vx[i] = Math.cos(a) * sp;
      l.vy[i] = Math.sin(a) * sp * 0.6;
    }
    const sc = d.scale ?? [1, 1];
    l.s[i] = fxRng.range(sc[0], sc[1]);
    l.col[i] = d.colors.length ? d.colors[(fxRng.next() * d.colors.length) | 0] : 0xffffff;
    l.frame[i] = (fxRng.next() * l.count) | 0;
  }
}
