/**
 * Post-processing (DESIGN 8.1):
 *   scene FBO (art-pixel res) + half/full-res GLOW FBO -> dual-Kawase bloom chain
 *   -> final composite at device res: sharp-bilinear upscale with sub-pixel camera
 *   offset, shockwave ripples (<= 8), chromatic aberration, colour grade,
 *   bloom, vignette + damage vignette, full-screen flash, dither.
 *
 * `PostFx` is the user-facing state (call its methods any time);
 * `PostPipeline` owns the GL objects and runs the passes.
 */
import { clamp, ease, lerp } from "../core/math";
import { FULLSCREEN_VS, program, Target, type GL, type Program } from "./gl";

export type RGB = [number, number, number];

export interface Grade {
  /** Multiplicative colour (1,1,1 = neutral; may exceed 1). */
  tint: RGB;
  /** Shadow lift colour (added in the darks). */
  lift: RGB;
  saturation: number;
  contrast: number;
  brightness: number;
  /** Hue rotation in radians. */
  hue: number;
}

export const GRADES: Record<"day" | "dusk" | "night" | "neutral" | "dim", Grade> = {
  neutral: { tint: [1, 1, 1], lift: [0, 0, 0], saturation: 1, contrast: 1, brightness: 1, hue: 0 },
  day: { tint: [1.02, 1.0, 0.98], lift: [0.0, 0.0, 0.02], saturation: 1.06, contrast: 1.03, brightness: 1.0, hue: 0 },
  // dusk / night stay readable (DESIGN pillar 5): the mood comes from the warm / violet lift and the
  // fireflies, not from muting the frame; glowing gameplay sprites are protected in the composite too
  dusk: { tint: [1.05, 0.93, 0.92], lift: [0.05, 0.01, 0.05], saturation: 1.04, contrast: 1.04, brightness: 0.97, hue: 0 },
  night: { tint: [0.88, 0.86, 1.0], lift: [0.03, 0.0, 0.08], saturation: 1.08, contrast: 1.06, brightness: 0.97, hue: 0 },
  dim: { tint: [0.55, 0.5, 0.7], lift: [0.02, 0.0, 0.06], saturation: 0.7, contrast: 1.05, brightness: 0.75, hue: 0 },
};

export function cloneGrade(g: Grade): Grade {
  return { tint: [...g.tint], lift: [...g.lift], saturation: g.saturation, contrast: g.contrast, brightness: g.brightness, hue: g.hue };
}

export function lerpGrade(a: Grade, b: Grade, t: number, out: Grade): Grade {
  for (let i = 0; i < 3; i++) {
    out.tint[i] = lerp(a.tint[i], b.tint[i], t);
    out.lift[i] = lerp(a.lift[i], b.lift[i], t);
  }
  out.saturation = lerp(a.saturation, b.saturation, t);
  out.contrast = lerp(a.contrast, b.contrast, t);
  out.brightness = lerp(a.brightness, b.brightness, t);
  out.hue = lerp(a.hue, b.hue, t);
  return out;
}

const MAX_WAVES = 8;

interface Wave {
  x: number;
  y: number;
  age: number;
  life: number;
  strength: number;
  radius: number;
  active: boolean;
}

/** Post FX state + animation. All amounts decay automatically; call update(dt) once per frame. */
export class PostFx {
  bloomStrength = 0.95;
  /** Weight of the un-blurred glow buffer (tight halo around glowing sprites). */
  glowCore = 0.3;
  bloomEnabled = true;
  /** Constant aberration (art px at the screen edge). */
  baseAberration = 0;
  /** Base vignette amount + colour. */
  vignette = 0.32;
  vignetteColor: RGB = [0.1, 0.04, 0.16];
  damageColor: RGB = [1.0, 0.12, 0.28];
  /** Persistent damage vignette floor (e.g. low-HP heartbeat), 0..1. */
  damageFloor = 0;
  /**
   * Darken the final image (scene AND bloom) by this fraction, 0..1. Set every
   * frame by the owner (e.g. the ultimate cut-in); an overlay sprite can't do
   * this because bloom is added after the scene in the composite.
   */
  dim = 0;
  /**
   * How much glowing gameplay sprites (enemy bullets, gems, shots, crit numbers -
   * everything drawn with Flag.Glow in normal blend, i.e. with coverage in the glow
   * buffer's alpha) escape the colour grade, 0..1: the night grade tints the meadow
   * and the actors, while the bullets stay bright and high-contrast.
   */
  gradeProtect = 0.8;
  /** Multipliers applied by settings ("reduce flashing"). */
  flashScale = 1;
  aberrationScale = 1;
  /**
   * Adaptive bloom limiter (readable peak chaos). `load` (0..1) follows how many
   * glowing instances fill the view - the renderer feeds it every frame through
   * feedGlow(): fast attack, slow release. The composite scales bloom, the glow
   * core and bloom surges by (1 - bloomLimit x load), so a late-game screen full
   * of evolved weapons never whites out the hero or the enemy bullets. Gameplay
   * code can read `load` too (the feedback bridge thins damage numbers / sparks).
   */
  load = 0;
  bloomLimit = 0.6;
  /** Glow instances per phone-sized view (80k art px²) where the limiter starts / is fully on. */
  loadFrom = 220;
  loadTo = 800;

  readonly waves: Wave[] = [];
  flashColor: RGB = [1, 1, 1];
  flashAmount = 0;
  private flashDecay = 4;
  aberrationAmount = 0;
  damageAmount = 0;
  surge = 0;
  private surgeDecay = 1;
  private hueT = 0;
  private hueDur = 0;

  readonly grade: Grade = cloneGrade(GRADES.day);
  private gradeFrom: Grade = cloneGrade(GRADES.day);
  private gradeTo: Grade = cloneGrade(GRADES.day);
  private gradeT = 0;
  private gradeDur = 0;
  time = 0;

  constructor() {
    for (let i = 0; i < MAX_WAVES; i++) this.waves.push({ x: 0, y: 0, age: 0, life: 1, strength: 0, radius: 0, active: false });
  }

  /** World-positioned expanding ring distortion. strength ~0.3 subtle .. 1 big .. 2 huge; radius in art px. */
  shockwave(x: number, y: number, strength = 1, radius = 64, life = 0.6): void {
    let w = this.waves.find((v) => !v.active);
    if (!w) {
      w = this.waves[0];
      for (const v of this.waves) if (v.age / v.life > w.age / w.life) w = v;
    }
    w.x = x;
    w.y = y;
    w.age = 0;
    w.life = Math.max(0.05, life);
    w.strength = strength;
    w.radius = radius;
    w.active = true;
  }

  /** Full-screen colour flash. amount 0..1 (decays over `seconds`). */
  flash(color: number, amount: number, seconds = 0.22): void {
    const a = clamp(amount * this.flashScale, 0, 1);
    if (a < this.flashAmount * 0.6) return;
    this.flashColor[0] = ((color >>> 16) & 255) / 255;
    this.flashColor[1] = ((color >>> 8) & 255) / 255;
    this.flashColor[2] = (color & 255) / 255;
    this.flashAmount = Math.max(this.flashAmount, a);
    this.flashDecay = 1 / Math.max(0.02, seconds);
  }

  /** Chromatic aberration pulse (art px at the screen edge, ~1..4). */
  aberration(amount: number): void {
    this.aberrationAmount = Math.max(this.aberrationAmount, amount * this.aberrationScale);
  }

  /** Red damage vignette pulse 0..1. */
  damageVignette(amount: number): void {
    this.damageAmount = Math.max(this.damageAmount, clamp(amount, 0, 1));
  }

  /** Feed this frame's glow-instance count over a scene of `area` art px² (Renderer.endFrame does it). */
  feedGlow(count: number, area: number, dt: number): void {
    const n = count * (80000 / Math.max(20000, area));
    const t = clamp((n - this.loadFrom) / (this.loadTo - this.loadFrom), 0, 1);
    const k = t > this.load ? 1 - Math.exp(-dt * 8) : 1 - Math.exp(-dt * 1.2);
    this.load += (t - this.load) * k;
  }

  /** Bloom multiplier from the adaptive limiter (1 = untouched). */
  get bloomLimiter(): number {
    return 1 - this.bloomLimit * this.load;
  }

  /** Temporary bloom boost (added to bloomStrength), decays over `seconds`. */
  bloomSurge(amount: number, seconds = 0.6): void {
    this.surge = Math.min(1.5, Math.max(this.surge, amount));
    this.surgeDecay = 1 / Math.max(0.05, seconds);
  }

  /** Hue-cycling grade (evolution celebration) for `seconds`. */
  hueCycle(seconds = 0.6): void {
    if (this.flashScale < 0.5) return;
    this.hueT = 0;
    this.hueDur = seconds;
  }

  /** Ease the colour grade to `g` (partial fields keep the current target's values). */
  setGrade(g: Partial<Grade> | Grade, seconds = 0): void {
    const target = cloneGrade(this.gradeTo);
    if (g.tint) target.tint = [...g.tint];
    if (g.lift) target.lift = [...g.lift];
    if (g.saturation !== undefined) target.saturation = g.saturation;
    if (g.contrast !== undefined) target.contrast = g.contrast;
    if (g.brightness !== undefined) target.brightness = g.brightness;
    if (g.hue !== undefined) target.hue = g.hue;
    this.gradeFrom = cloneGrade(this.grade);
    this.gradeTo = target;
    this.gradeT = 0;
    this.gradeDur = Math.max(0, seconds);
    if (seconds <= 0) lerpGrade(target, target, 0, this.grade);
  }

  /** Set the grade directly to a blend of two presets (e.g. day->night by run progress). */
  blendGrade(a: Grade, b: Grade, t: number): void {
    lerpGrade(a, b, clamp(t, 0, 1), this.grade);
    this.gradeTo = cloneGrade(this.grade);
    this.gradeDur = 0;
  }

  update(dt: number): void {
    this.time += dt;
    for (const w of this.waves) {
      if (!w.active) continue;
      w.age += dt;
      if (w.age >= w.life) w.active = false;
    }
    this.flashAmount = Math.max(0, this.flashAmount - this.flashAmount * this.flashDecay * dt * 1.6 - dt * 0.4);
    this.aberrationAmount = Math.max(0, this.aberrationAmount - dt * (2 + this.aberrationAmount * 4));
    this.damageAmount = Math.max(0, this.damageAmount - dt * 2.2);
    this.surge = Math.max(0, this.surge - this.surge * this.surgeDecay * dt * 2 - dt * 0.05);
    if (this.gradeT < this.gradeDur) {
      this.gradeT = Math.min(this.gradeDur, this.gradeT + dt);
      lerpGrade(this.gradeFrom, this.gradeTo, ease.sineInOut(this.gradeT / this.gradeDur), this.grade);
    }
    if (this.hueT < this.hueDur) this.hueT += dt;
  }

  /** Current hue rotation (grade hue + hue cycle). */
  get hue(): number {
    let h = this.grade.hue;
    if (this.hueT < this.hueDur) {
      const t = this.hueT / this.hueDur;
      h += t * Math.PI * 2 * 2;
    }
    return h;
  }

  reset(): void {
    for (const w of this.waves) w.active = false;
    this.flashAmount = this.aberrationAmount = this.damageAmount = this.surge = 0;
    this.hueDur = 0;
    this.damageFloor = 0;
    this.dim = 0;
    this.load = 0;
  }
}

// ------------------------------------------------------------------ shaders
const DOWN_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_uvScale;  // src used / src cap
uniform vec2 u_texel;    // 1 / src cap
uniform vec2 u_uvMax;
in vec2 v_p;
out vec4 o;
vec4 tap(vec2 uv) { return texture(u_src, clamp(uv, u_texel * 0.5, u_uvMax)); }
void main() {
  vec2 uv = v_p * u_uvScale;
  vec2 h = u_texel;
  vec4 s = tap(uv) * 4.0;
  s += tap(uv - h);
  s += tap(uv + h);
  s += tap(uv + vec2(h.x, -h.y));
  s += tap(uv - vec2(h.x, -h.y));
  o = s * 0.125;
}`;

const UP_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_uvScale;
uniform vec2 u_texel;
uniform vec2 u_uvMax;
uniform float u_gain;
in vec2 v_p;
out vec4 o;
vec4 tap(vec2 uv) { return texture(u_src, clamp(uv, u_texel * 0.5, u_uvMax)); }
void main() {
  vec2 uv = v_p * u_uvScale;
  vec2 h = u_texel;
  vec4 s = tap(uv + vec2(-h.x * 2.0, 0.0));
  s += tap(uv + vec2(-h.x, h.y)) * 2.0;
  s += tap(uv + vec2(0.0, h.y * 2.0));
  s += tap(uv + vec2(h.x, h.y)) * 2.0;
  s += tap(uv + vec2(h.x * 2.0, 0.0));
  s += tap(uv + vec2(h.x, -h.y)) * 2.0;
  s += tap(uv + vec2(0.0, -h.y * 2.0));
  s += tap(uv + vec2(-h.x, -h.y)) * 2.0;
  o = s * (u_gain / 12.0);
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_scene;
uniform sampler2D u_glow;
uniform sampler2D u_bloom;
uniform vec2 u_res;        // device px
uniform float u_dpr;       // device px per css px
uniform float u_scale;     // css px per art px
uniform vec2 u_off;        // scene texel at the screen's top-left
uniform vec2 u_sceneUsed;  // used scene size (texels)
uniform vec2 u_sceneInv;   // 1 / scene capacity
uniform vec2 u_sceneK;     // scene texels per art px (1; 0.5 = a half-resolution scene, Renderer.sceneScale)
uniform sampler2D u_top;   // protected layers (bullets + text) at full art resolution while the scene is low-res
uniform float u_topOn;
uniform vec2 u_topUsed;
uniform vec2 u_topInv;
uniform vec2 u_glowK;      // glow uv per scene texel
uniform vec2 u_glowMax;
uniform vec2 u_bloomK;
uniform vec2 u_bloomMax;
uniform float u_bloomStr;
uniform float u_glowCore;
uniform vec4 u_waves[8];   // css px: cx, cy, radius, width
uniform float u_waveS[8];  // displacement amplitude (css px)
uniform float u_waveA[8];  // rim brightness 0..1
uniform int u_waveN;
uniform float u_aberr;     // css px at the edge
uniform vec3 u_tint;
uniform vec3 u_lift;
uniform float u_sat;
uniform float u_contrast;
uniform float u_bright;
uniform float u_hue;
uniform float u_protect;
uniform float u_vig;
uniform vec3 u_vigColor;
uniform float u_dmg;
uniform vec3 u_dmgColor;
uniform vec3 u_flashColor;
uniform float u_flash;
uniform float u_dim;
uniform float u_time;
out vec4 o;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

// sharp-bilinear: flat texels, ~1 device px of linear blend at texel borders (sc = device px per texel)
vec2 sharpUvOf(vec2 t, vec2 used, vec2 inv, float sc) {
  t = clamp(t, vec2(0.5), used - 0.5);
  vec2 tf = floor(t);
  vec2 cd = fract(t) - 0.5;
  float rr = 0.5 - 0.5 / max(sc, 1.0);
  vec2 f = (cd - clamp(cd, -rr, rr)) * sc + 0.5;
  return (tf + f) * inv;
}
vec2 sharpUv(vec2 t) {
  return sharpUvOf(t, u_sceneUsed, u_sceneInv, u_scale * u_dpr / u_sceneK.x);
}

vec3 hueRotate(vec3 c, float a) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * c;
  float cs = cos(a), sn = sin(a);
  yiq.yz = mat2(cs, sn, -sn, cs) * yiq.yz;
  return toRGB * yiq;
}

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec2 css = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr;
  vec2 cssRes = u_res / u_dpr;
  vec2 s = css;
  float ring = 0.0;
  vec2 ringDir = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= u_waveN) break;
    vec4 w = u_waves[i];
    vec2 d = css - w.xy;
    float dist = length(d);
    float x = (dist - w.z) / w.w;
    if (abs(x) < 1.0 && dist > 0.001) {
      vec2 n = d / dist;
      float e = 1.0 - x * x;
      // lens profile: pull inward just outside the rim, push outward just inside it
      s -= n * sin(3.14159265 * x) * e * u_waveS[i];
      float rw = e * e * u_waveA[i];
      ring += rw;
      ringDir += n * rw;
    }
  }
  vec2 tArt = u_off + s / u_scale;
  vec2 t = tArt * u_sceneK;
  vec3 col;
  float ab = u_aberr + ring * 2.5 * u_scale;
  if (ab > 0.01) {
    vec2 dir = (css - cssRes * 0.5) / (0.5 * length(cssRes));
    dir = normalize(dir + ringDir * 4.0 + 1e-5) * min(1.0, length(dir) + ring);
    vec2 o2 = dir * (ab / u_scale) * u_sceneK;
    col.r = texture(u_scene, sharpUv(t + o2)).r;
    col.g = texture(u_scene, sharpUv(t)).g;
    col.b = texture(u_scene, sharpUv(t - o2)).b;
  } else {
    col = texture(u_scene, sharpUv(t)).rgb;
  }

  // grade (glowing gameplay sprites - coverage in the glow buffer's alpha - are protected from it)
  vec3 raw = col;
  col *= u_tint;
  float l0 = dot(col, LUMA);
  col += u_lift * (1.0 - clamp(l0, 0.0, 1.0));
  float l = dot(col, LUMA);
  col = mix(vec3(l), col, u_sat);
  col = (col - 0.5) * u_contrast + 0.5;
  col *= u_bright;
  vec2 fsc = clamp(t, vec2(0.0), u_sceneUsed);
  vec4 glowS = texture(u_glow, min(fsc * u_glowK, u_glowMax));
  col = mix(col, raw, clamp(glowS.a * 1.5, 0.0, 1.0) * u_protect);
  if (u_hue != 0.0) col = hueRotate(col, u_hue);

  // bloom (added after grading so glowing things stay luminous at night)
  vec3 glow = glowS.rgb;
  vec3 bloom = texture(u_bloom, min(fsc * u_bloomK, u_bloomMax)).rgb;
  col += glow * u_glowCore + bloom * u_bloomStr;
  // protected layers (low-res scene only): drawn crisp over the graded scene (premultiplied)
  if (u_topOn > 0.5) {
    vec4 tp = texture(u_top, sharpUvOf(tArt, u_topUsed, u_topInv, u_scale * u_dpr));
    col = col * (1.0 - tp.a) + tp.rgb;
  }
  col += vec3(ring * 0.16);
  col *= 1.0 - u_dim;

  // vignette + damage vignette
  vec2 q = (css / cssRes - 0.5) * 2.0;
  float r = length(q * vec2(1.0, 0.92));
  float v = smoothstep(0.55, 1.5, r);
  col = mix(col, u_vigColor, v * u_vig);
  if (u_dmg > 0.0) {
    float dv = smoothstep(0.25, 1.35, r);
    col = mix(col, u_dmgColor * 0.85, clamp(dv * u_dmg * 1.1, 0.0, 0.92));
    col += u_dmgColor * dv * dv * u_dmg * 0.25;
  }

  col = mix(col, u_flashColor, u_flash);
  col += (hash(gl_FragCoord.xy + fract(u_time) * 61.0) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export interface PostFrame {
  /** Device px of the canvas. */
  resW: number;
  resH: number;
  dpr: number;
  /** css px per art px (effective, incl. zoom). */
  scale: number;
  /** Scene texel at the screen top-left. */
  offX: number;
  offY: number;
  /** World -> css px conversion for waves. */
  viewX: number;
  viewY: number;
  /** Scene texels per art px on x / y (default 1; Renderer.sceneScale). */
  sceneKx?: number;
  sceneKy?: number;
  /** Composite the protected-layer target (`PostPipeline.top`) over the scene. */
  topOn?: boolean;
}

export class PostPipeline {
  scene!: Target;
  glow!: Target;
  /**
   * Full-resolution target for the protected layers (bullets + text) while the scene renders at a
   * reduced scale (Renderer.sceneScale < 1); created on first use.
   */
  top: Target | null = null;
  chain: Target[] = [];
  private gl!: GL;
  private down!: Program;
  private up!: Program;
  private comp!: Program;
  private vao!: WebGLVertexArrayObject;
  private waveBuf = new Float32Array(MAX_WAVES * 4);
  private waveS = new Float32Array(MAX_WAVES);
  private waveA = new Float32Array(MAX_WAVES);
  glowScale = 0.5;

  init(gl: GL, sceneW: number, sceneH: number): void {
    this.gl = gl;
    this.down = program(gl, FULLSCREEN_VS, DOWN_FS, "bloom-down");
    this.up = program(gl, FULLSCREEN_VS, UP_FS, "bloom-up");
    this.comp = program(gl, FULLSCREEN_VS, COMPOSITE_FS, "composite");
    this.vao = gl.createVertexArray() as WebGLVertexArrayObject;
    this.scene = new Target(gl, sceneW, sceneH, gl.LINEAR);
    this.glow = new Target(gl, sceneW * this.glowScale, sceneH * this.glowScale, gl.LINEAR);
    this.chain = [];
    this.top = null;
    this.resize(sceneW, sceneH);
  }

  /**
   * Set used sizes for this frame (cheap unless capacity grows). `topW / topH` > 0 sizes the
   * protected-layer target (a reduced-scale scene: art resolution for bullets + text).
   */
  resize(sceneW: number, sceneH: number, topW = 0, topH = 0): void {
    const gl = this.gl;
    this.scene.setSize(sceneW, sceneH);
    if (topW > 0) {
      if (!this.top) this.top = new Target(gl, topW, topH, gl.LINEAR);
      else this.top.setSize(topW, topH);
    }
    const gw = Math.max(2, Math.ceil(sceneW * this.glowScale));
    const gh = Math.max(2, Math.ceil(sceneH * this.glowScale));
    this.glow.setSize(gw, gh);
    let w = gw;
    let h = gh;
    let i = 0;
    while (i < 6) {
      w = Math.ceil(w / 2);
      h = Math.ceil(h / 2);
      if (Math.min(w, h) < 3 && i >= 2) break;
      if (!this.chain[i]) this.chain[i] = new Target(gl, w, h, gl.LINEAR);
      else this.chain[i].setSize(w, h);
      i++;
    }
    for (let k = i; k < this.chain.length; k++) this.chain[k].dispose();
    this.chain.length = i;
  }

  private pass(p: Program, src: Target, dst: Target, gain = 1): void {
    const gl = this.gl;
    dst.bind();
    gl.useProgram(p.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(p.u.u_src, 0);
    gl.uniform2f(p.u.u_uvScale, src.w / src.capW, src.h / src.capH);
    gl.uniform2f(p.u.u_texel, 1 / src.capW, 1 / src.capH);
    gl.uniform2f(p.u.u_uvMax, (src.w - 0.5) / src.capW, (src.h - 0.5) / src.capH);
    if (p.u.u_gain) gl.uniform1f(p.u.u_gain, gain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Blur the glow buffer down/up the chain. Leaves chain[0] = accumulated bloom. */
  bloom(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    let src = this.glow;
    for (const t of this.chain) {
      this.pass(this.down, src, t);
      src = t;
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.chain.length - 1; i > 0; i--) this.pass(this.up, this.chain[i], this.chain[i - 1], 1);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  composite(fx: PostFx, f: PostFrame, bloomOn: boolean): void {
    const gl = this.gl;
    const p = this.comp;
    const u = p.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, f.resW, f.resH);
    gl.disable(gl.BLEND);
    gl.useProgram(p.prog);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(u.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.glow.tex);
    gl.uniform1i(u.u_glow, 1);
    const b = this.chain[0] ?? this.glow;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, b.tex);
    gl.uniform1i(u.u_bloom, 2);
    const top = f.topOn && this.top ? this.top : null;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, top ? top.tex : this.glow.tex);
    gl.uniform1i(u.u_top, 3);
    gl.uniform1f(u.u_topOn, top ? 1 : 0);
    if (top) {
      gl.uniform2f(u.u_topUsed, top.w, top.h);
      gl.uniform2f(u.u_topInv, 1 / top.capW, 1 / top.capH);
    }
    gl.activeTexture(gl.TEXTURE0);

    const sc = this.scene;
    gl.uniform2f(u.u_res, f.resW, f.resH);
    gl.uniform1f(u.u_dpr, f.dpr);
    gl.uniform1f(u.u_scale, f.scale);
    gl.uniform2f(u.u_off, f.offX, f.offY);
    gl.uniform2f(u.u_sceneUsed, sc.w, sc.h);
    gl.uniform2f(u.u_sceneInv, 1 / sc.capW, 1 / sc.capH);
    gl.uniform2f(u.u_sceneK, f.sceneKx ?? 1, f.sceneKy ?? 1);
    const g = this.glow;
    gl.uniform2f(u.u_glowK, g.w / g.capW / sc.w, g.h / g.capH / sc.h);
    gl.uniform2f(u.u_glowMax, (g.w - 0.5) / g.capW, (g.h - 0.5) / g.capH);
    gl.uniform2f(u.u_bloomK, b.w / b.capW / sc.w, b.h / b.capH / sc.h);
    gl.uniform2f(u.u_bloomMax, (b.w - 0.5) / b.capW, (b.h - 0.5) / b.capH);
    const levels = Math.max(1, this.chain.length);
    // adaptive limiter: a crowded glow buffer gets less bloom (and smaller surges) instead of a white-out
    const lim = fx.bloomLimiter;
    const surge = fx.surge * lim;
    gl.uniform1f(u.u_bloomStr, bloomOn ? ((fx.bloomStrength + surge) * 1.6 * lim) / levels : 0);
    gl.uniform1f(u.u_glowCore, bloomOn ? fx.glowCore * (1 + surge * 0.5) * (0.5 + 0.5 * lim) : 0);

    // waves
    let n = 0;
    for (const w of fx.waves) {
      if (!w.active) continue;
      const t = w.age / w.life;
      const r = w.radius * ease.cubicOut(t) * f.scale;
      const o = n * 4;
      this.waveBuf[o] = (w.x - f.viewX) * f.scale;
      this.waveBuf[o + 1] = (w.y - f.viewY) * f.scale;
      this.waveBuf[o + 2] = r;
      this.waveBuf[o + 3] = (4 + w.radius * 0.2) * f.scale * (0.7 + 0.5 * t);
      const fade = Math.pow(1 - t, 1.5);
      this.waveS[n] = w.strength * 5 * f.scale * fade;
      this.waveA[n] = Math.min(1, w.strength) * fade;
      n++;
    }
    for (let k = n; k < MAX_WAVES; k++) this.waveS[k] = this.waveA[k] = 0;
    gl.uniform4fv(u.u_waves, this.waveBuf);
    gl.uniform1fv(u.u_waveS, this.waveS);
    gl.uniform1fv(u.u_waveA, this.waveA);
    gl.uniform1i(u.u_waveN, n);

    gl.uniform1f(u.u_aberr, (fx.baseAberration + fx.aberrationAmount) * f.scale);
    const gr = fx.grade;
    gl.uniform3f(u.u_tint, gr.tint[0], gr.tint[1], gr.tint[2]);
    gl.uniform3f(u.u_lift, gr.lift[0], gr.lift[1], gr.lift[2]);
    gl.uniform1f(u.u_sat, gr.saturation);
    gl.uniform1f(u.u_contrast, gr.contrast);
    gl.uniform1f(u.u_bright, gr.brightness);
    gl.uniform1f(u.u_hue, fx.hue);
    gl.uniform1f(u.u_protect, bloomOn ? clamp(fx.gradeProtect, 0, 1) : 0);
    gl.uniform1f(u.u_vig, fx.vignette);
    gl.uniform3f(u.u_vigColor, fx.vignetteColor[0], fx.vignetteColor[1], fx.vignetteColor[2]);
    gl.uniform1f(u.u_dmg, Math.min(1, Math.max(fx.damageAmount, fx.damageFloor)));
    gl.uniform3f(u.u_dmgColor, fx.damageColor[0], fx.damageColor[1], fx.damageColor[2]);
    gl.uniform3f(u.u_flashColor, fx.flashColor[0], fx.flashColor[1], fx.flashColor[2]);
    gl.uniform1f(u.u_flash, Math.min(1, fx.flashAmount));
    gl.uniform1f(u.u_dim, Math.min(0.95, Math.max(0, fx.dim)));
    gl.uniform1f(u.u_time, fx.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    this.scene?.dispose();
    this.glow?.dispose();
    this.top?.dispose();
    this.top = null;
    for (const t of this.chain) t.dispose();
    this.chain = [];
  }
}
