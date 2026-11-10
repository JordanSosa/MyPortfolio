/** Small WebGL2 helpers: shader programs, textures, render targets. */

export type GL = WebGL2RenderingContext;

export function compile(gl: GL, type: number, src: string, name: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error(`[gl] createShader failed (${name})`);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(sh);
    const numbered = src
      .split("\n")
      .map((l, i) => `${String(i + 1).padStart(3)}: ${l}`)
      .join("\n");
    throw new Error(`[gl] ${name} ${type === gl.VERTEX_SHADER ? "VS" : "FS"} compile error:\n${log}\n${numbered}`);
  }
  return sh;
}

export interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

/** Link a program and look up all active uniforms (arrays are available as "name" and "name[0]"). */
export function program(gl: GL, vs: string, fs: string, name: string): Program {
  const p = gl.createProgram();
  if (!p) throw new Error(`[gl] createProgram failed (${name})`);
  const v = compile(gl, gl.VERTEX_SHADER, vs, name);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs, name);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`[gl] ${name} link error: ${gl.getProgramInfoLog(p)}`);
  }
  gl.deleteShader(v);
  gl.deleteShader(f);
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (!info) continue;
    const base = info.name.replace(/\[0\]$/, "");
    u[base] = gl.getUniformLocation(p, info.name);
    if (base !== info.name) u[info.name] = u[base];
  }
  return { prog: p, u };
}

export function texture(
  gl: GL,
  w: number,
  h: number,
  opts: { filter?: number; data?: ArrayBufferView | null; internal?: number; format?: number; type?: number } = {},
): WebGLTexture {
  const t = gl.createTexture();
  if (!t) throw new Error("[gl] createTexture failed");
  gl.bindTexture(gl.TEXTURE_2D, t);
  const filter = opts.filter ?? gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    opts.internal ?? gl.RGBA8,
    w,
    h,
    0,
    opts.format ?? gl.RGBA,
    opts.type ?? gl.UNSIGNED_BYTE,
    opts.data ?? null,
  );
  return t;
}

/**
 * Render target with "capacity" semantics: the texture is allocated at
 * (capW, capH) >= the used size (w, h). Rendering uses a viewport of (w, h)
 * at the origin; samplers scale UVs by (w/capW, h/capH). This lets the used
 * size change every frame (zoom, resize) without reallocating.
 */
export class Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  capW: number;
  capH: number;
  w: number;
  h: number;

  constructor(
    private gl: GL,
    w: number,
    h: number,
    private filter: number,
    private headroom = 1.15,
  ) {
    this.w = Math.max(1, Math.ceil(w));
    this.h = Math.max(1, Math.ceil(h));
    this.capW = Math.ceil(this.w * headroom);
    this.capH = Math.ceil(this.h * headroom);
    this.tex = texture(gl, this.capW, this.capH, { filter });
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error("[gl] createFramebuffer failed");
    this.fbo = fbo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Set the used size; reallocates only if it exceeds the capacity. */
  setSize(w: number, h: number): void {
    w = Math.max(1, Math.ceil(w));
    h = Math.max(1, Math.ceil(h));
    this.w = w;
    this.h = h;
    if (w <= this.capW && h <= this.capH) return;
    const gl = this.gl;
    this.capW = Math.max(this.capW, Math.ceil(w * this.headroom));
    this.capH = Math.max(this.capH, Math.ceil(h * this.headroom));
    gl.deleteTexture(this.tex);
    this.tex = texture(gl, this.capW, this.capH, { filter: this.filter });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Shrink capacity to fit (e.g. after a big resize down). */
  fit(): void {
    if (this.capW <= Math.ceil(this.w * this.headroom * 1.6) && this.capH <= Math.ceil(this.h * this.headroom * 1.6)) return;
    const gl = this.gl;
    this.capW = Math.ceil(this.w * this.headroom);
    this.capH = Math.ceil(this.h * this.headroom);
    gl.deleteTexture(this.tex);
    this.tex = texture(gl, this.capW, this.capH, { filter: this.filter });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bind(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
  }

  dispose(): void {
    this.gl.deleteTexture(this.tex);
    this.gl.deleteFramebuffer(this.fbo);
  }
}

/** Full-screen triangle vertex shader (no buffers: uses gl_VertexID). Outputs v_p in 0..1 over the viewport. */
export const FULLSCREEN_VS = `#version 300 es
out vec2 v_p;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_p = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
