/**
 * Instanced sprite batcher (WebGL2). One atlas, one shader, one instanced
 * draw per contiguous run of layers. Per-instance data (44 bytes):
 *
 *   x, y, scaleX, scaleY, rotation, pivotX, pivotY   (f32 x7)
 *   uv rect: tx | ty << 16, tw | th << 16              (u16 x4, atlas pixels)
 *   colour RGBA8 (straight tint; A = alpha)
 *   extra  RGBA8: flash (lerp to tint colour), additive, noSnap, -
 *
 * Premultiplied-alpha blending (ONE, ONE_MINUS_SRC_ALPHA) everywhere; additive
 * sprites output alpha 0, so normal and additive sprites mix in one draw call
 * with no blend state changes. Zero allocations in draw().
 */
import { Flag, Layer, LAYER_COUNT } from "./layers";
import type { Atlas } from "./atlas";
import { program, type GL, type Program } from "./gl";

const STRIDE = 11; // 32-bit words per instance
const BYTES = STRIDE * 4;
const MAX_INSTANCES_PER_LAYER = 1 << 17;
const SORT_SHIFT = 1048576; // 2^20: instance index bits inside the sort key

class LayerBuf {
  f32: Float32Array;
  u32: Uint32Array;
  keys: Float64Array | null;
  count = 0;
  constructor(
    public cap: number,
    sorted: boolean,
  ) {
    const buf = new ArrayBuffer(cap * BYTES);
    this.f32 = new Float32Array(buf);
    this.u32 = new Uint32Array(buf);
    this.keys = sorted ? new Float64Array(cap) : null;
  }
  grow(): boolean {
    if (this.cap >= MAX_INSTANCES_PER_LAYER) return false;
    const cap = this.cap * 2;
    const buf = new ArrayBuffer(cap * BYTES);
    const u32 = new Uint32Array(buf);
    u32.set(this.u32);
    this.u32 = u32;
    this.f32 = new Float32Array(buf);
    if (this.keys) {
      const k = new Float64Array(cap);
      k.set(this.keys);
      this.keys = k;
    }
    this.cap = cap;
    return true;
  }
}

const VS = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_scale;
layout(location=2) in float a_rot;
layout(location=3) in vec2 a_pivot;
layout(location=4) in uvec4 a_uv;
layout(location=5) in vec4 a_color;
layout(location=6) in vec4 a_extra;
uniform vec2 u_origin;   // world position of target pixel (0,0) (integer)
uniform vec2 u_size;     // target size in world pixels
uniform vec2 u_atlasInv;
out vec2 v_uv;
out vec4 v_tint;   // rgb = tint * alpha, a = alpha
out float v_aout;  // output alpha multiplier = alpha * (1 - additive)
out float v_flash;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 size = vec2(a_uv.zw);
  vec2 local = (corner * size - a_pivot) * a_scale;
  vec2 rel = a_pos - u_origin;
  vec2 p;
  if (a_rot != 0.0) {
    float c = cos(a_rot), s = sin(a_rot);
    p = rel + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  } else {
    p = rel + local;
    if (a_extra.z < 0.5) {
      // snap the quad's min corner to the pixel grid (crisp, no shimmering)
      vec2 mn = rel + min(-a_pivot * a_scale, (size - a_pivot) * a_scale);
      p += floor(mn + 0.5) - mn;
    }
  }
  gl_Position = vec4(p / u_size * 2.0 - 1.0, 0.0, 1.0);
  v_uv = (vec2(a_uv.xy) + corner * size) * u_atlasInv;
  v_tint = vec4(a_color.rgb * a_color.a, a_color.a);
  v_aout = a_color.a * (1.0 - a_extra.y);
  v_flash = a_extra.x;
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D u_atlas;
uniform float u_gain;
in vec2 v_uv;
in vec4 v_tint;
in float v_aout;
in float v_flash;
out vec4 o;
void main() {
  vec4 t = texture(u_atlas, v_uv);           // premultiplied
  // flash lerps toward the tint colour: white tint = classic hit flash, other tints = coloured silhouette
  vec3 rgb = mix(t.rgb, vec3(t.a), v_flash) * v_tint.rgb;
  o = vec4(rgb * u_gain, t.a * v_aout);
}`;

export class SpriteBatch {
  readonly layers: LayerBuf[] = [];
  readonly glow: LayerBuf;
  /** Added to the y used for Entity-layer sorting (e.g. +0.01 to draw an attachment just in front). */
  sortBias = 0;
  /** Explicit sort key for subsequent Entity draws (NaN = use y + sortBias). */
  sortKey = NaN;
  /** Instances drawn last frame (scene + glow) and draw calls. */
  readonly stats = { instances: 0, glow: 0, drawCalls: 0 };

  private atlas: Atlas;
  private fx: Uint16Array;
  private fy: Uint16Array;
  private fw: Uint16Array;
  private fh: Uint16Array;
  private fox: Float32Array;
  private foy: Float32Array;
  private warnedFull = false;

  // gl
  private gl: GL | null = null;
  private prog: Program | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;
  private staging: Uint32Array;
  private glowStart = 0;
  private layerStart = new Int32Array(LAYER_COUNT);
  private layerCount = new Int32Array(LAYER_COUNT);

  constructor(atlas: Atlas) {
    this.atlas = atlas;
    this.fx = atlas.fx;
    this.fy = atlas.fy;
    this.fw = atlas.fw;
    this.fh = atlas.fh;
    this.fox = atlas.fox;
    this.foy = atlas.foy;
    for (let i = 0; i < LAYER_COUNT; i++) this.layers.push(new LayerBuf(2048, i === Layer.Entity));
    this.glow = new LayerBuf(2048, false);
    this.staging = new Uint32Array(16384 * STRIDE);
  }

  // ------------------------------------------------------------------ drawing
  /**
   * Fast positional draw. `handle` = atlas frame handle. color = 0xRRGGBB tint
   * (multiplied), alpha 0..1, flash 0..1 (lerp to the tint colour - white by
   * default, so a white-tinted sprite flashes white and a cyan-tinted one
   * becomes a cyan silhouette), flags = Flag bits.
   * Negative scale flips. Rotation in radians around the pivot.
   */
  draw(
    layer: number,
    handle: number,
    x: number,
    y: number,
    sx = 1,
    sy = 1,
    rot = 0,
    color = 0xffffff,
    alpha = 1,
    flash = 0,
    flags = 0,
  ): void {
    this.drawP(layer, handle, x, y, sx, sy, rot, color, alpha, flash, flags, this.fox[handle], this.foy[handle]);
  }

  /** Same as draw() with an explicit pivot (sprite pixels). */
  drawP(
    layer: number,
    handle: number,
    x: number,
    y: number,
    sx: number,
    sy: number,
    rot: number,
    color: number,
    alpha: number,
    flash: number,
    flags: number,
    px: number,
    py: number,
  ): void {
    if (alpha <= 0.002) return;
    if (layer === Layer.FxAdd) flags |= Flag.Add;
    const a = alpha >= 1 ? 255 : (alpha * 255 + 0.5) | 0;
    const col = ((color >>> 16) & 255) | (color & 0xff00) | ((color & 255) << 16) | (a << 24);
    const ext =
      (flash <= 0 ? 0 : flash >= 1 ? 255 : (flash * 255 + 0.5) | 0) | (flags & Flag.Add ? 0xff00 : 0) | (flags & Flag.NoSnap ? 0xff0000 : 0);
    const uv0 = this.fx[handle] | (this.fy[handle] << 16);
    const uv1 = this.fw[handle] | (this.fh[handle] << 16);
    if (!(flags & Flag.GlowOnly)) {
      const L = this.layers[layer];
      if (L.count >= L.cap && !L.grow()) return this.full();
      const o = L.count * STRIDE;
      const f = L.f32;
      const u = L.u32;
      f[o] = x;
      f[o + 1] = y;
      f[o + 2] = sx;
      f[o + 3] = sy;
      f[o + 4] = rot;
      f[o + 5] = px;
      f[o + 6] = py;
      u[o + 7] = uv0;
      u[o + 8] = uv1;
      u[o + 9] = col;
      u[o + 10] = ext;
      if (L.keys) {
        const key = this.sortKey === this.sortKey ? this.sortKey : y + this.sortBias;
        L.keys[L.count] = (Math.floor(key * 4) + 1073741824) * SORT_SHIFT + L.count;
      }
      L.count++;
    }
    if (flags & (Flag.Glow | Flag.GlowOnly)) {
      const G = this.glow;
      if (G.count >= G.cap && !G.grow()) return this.full();
      const o = G.count * STRIDE;
      const f = G.f32;
      const u = G.u32;
      f[o] = x;
      f[o + 1] = y;
      f[o + 2] = sx;
      f[o + 3] = sy;
      f[o + 4] = rot;
      f[o + 5] = px;
      f[o + 6] = py;
      u[o + 7] = uv0;
      u[o + 8] = uv1;
      u[o + 9] = col;
      u[o + 10] = ext;
      G.count++;
    }
  }

  private full(): void {
    if (!this.warnedFull) {
      this.warnedFull = true;
      console.warn("[batch] layer capacity exceeded; extra sprites dropped");
    }
  }

  /** Number of instances queued on a layer this frame. */
  count(layer: number): number {
    return this.layers[layer].count;
  }

  /** Drop everything queued (the renderer calls this at frame start). */
  reset(): void {
    for (let i = 0; i < LAYER_COUNT; i++) this.layers[i].count = 0;
    this.glow.count = 0;
    this.sortBias = 0;
    this.sortKey = NaN;
  }

  // ------------------------------------------------------------------ GPU
  init(gl: GL): void {
    this.gl = gl;
    this.prog = program(gl, VS, FS, "sprite");
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    for (let i = 0; i <= 6; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribDivisor(i, 1);
    }
    this.pointers(0);
    gl.bindVertexArray(null);
  }

  private pointers(firstInstance: number): void {
    const gl = this.gl as GL;
    const b = firstInstance * BYTES;
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, BYTES, b);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, BYTES, b + 8);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, BYTES, b + 16);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, BYTES, b + 20);
    gl.vertexAttribIPointer(4, 4, gl.UNSIGNED_SHORT, BYTES, b + 28);
    gl.vertexAttribPointer(5, 4, gl.UNSIGNED_BYTE, true, BYTES, b + 36);
    gl.vertexAttribPointer(6, 4, gl.UNSIGNED_BYTE, true, BYTES, b + 40);
  }

  /** Sort the entity layer, pack all layers + glow into the staging buffer and upload once. */
  upload(): void {
    const gl = this.gl as GL;
    let total = this.glow.count;
    for (let i = 0; i < LAYER_COUNT; i++) total += this.layers[i].count;
    if (this.staging.length < total * STRIDE) {
      let cap = this.staging.length / STRIDE;
      while (cap < total) cap *= 2;
      this.staging = new Uint32Array(cap * STRIDE);
    }
    const S = this.staging;
    let at = 0;
    for (let i = 0; i < LAYER_COUNT; i++) {
      const L = this.layers[i];
      this.layerStart[i] = at;
      this.layerCount[i] = L.count;
      if (!L.count) continue;
      if (L.keys && L.count > 1) {
        const keys = L.keys.subarray(0, L.count);
        keys.sort();
        const src = L.u32;
        let d = at * STRIDE;
        for (let k = 0; k < L.count; k++) {
          const key = keys[k];
          const so = (key - Math.floor(key / SORT_SHIFT) * SORT_SHIFT) * STRIDE;
          S[d] = src[so];
          S[d + 1] = src[so + 1];
          S[d + 2] = src[so + 2];
          S[d + 3] = src[so + 3];
          S[d + 4] = src[so + 4];
          S[d + 5] = src[so + 5];
          S[d + 6] = src[so + 6];
          S[d + 7] = src[so + 7];
          S[d + 8] = src[so + 8];
          S[d + 9] = src[so + 9];
          S[d + 10] = src[so + 10];
          d += STRIDE;
        }
      } else {
        S.set(L.u32.subarray(0, L.count * STRIDE), at * STRIDE);
      }
      at += L.count;
    }
    this.glowStart = at;
    if (this.glow.count) S.set(this.glow.u32.subarray(0, this.glow.count * STRIDE), at * STRIDE);
    at += this.glow.count;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    // orphan + upload in one call (avoids syncing on the previous frame's buffer)
    gl.bufferData(gl.ARRAY_BUFFER, S, gl.STREAM_DRAW, 0, Math.max(STRIDE, at * STRIDE));
    this.stats.instances = at;
    this.stats.glow = this.glow.count;
    this.stats.drawCalls = 0;
  }

  /** Bind program + uniforms for a pass into a target covering the world rect (ox, oy, w, h). */
  begin(ox: number, oy: number, w: number, h: number, gain: number): void {
    const gl = this.gl as GL;
    const p = this.prog as Program;
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.u_origin, ox, oy);
    gl.uniform2f(p.u.u_size, w, h);
    gl.uniform2f(p.u.u_atlasInv, 1 / this.atlas.width, 1 / this.atlas.height);
    gl.uniform1f(p.u.u_gain, gain);
    gl.uniform1i(p.u.u_atlas, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas.texture);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
  }

  /** Draw layers [from, to] (inclusive). Consecutive layers are contiguous -> a single instanced draw. */
  drawLayers(from: number, to: number): void {
    const gl = this.gl as GL;
    let start = -1;
    let n = 0;
    for (let i = from; i <= to; i++) {
      if (!this.layerCount[i]) continue;
      if (start < 0) start = this.layerStart[i];
      n += this.layerCount[i];
    }
    if (n <= 0) return;
    this.pointers(start);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    this.stats.drawCalls++;
  }

  drawGlow(): void {
    if (!this.glow.count) return;
    const gl = this.gl as GL;
    this.pointers(this.glowStart);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.glow.count);
    this.stats.drawCalls++;
  }

  end(): void {
    (this.gl as GL).bindVertexArray(null);
  }

  get glowCount(): number {
    return this.glow.count;
  }
}
