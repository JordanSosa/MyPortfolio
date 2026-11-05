/**
 * Renderer facade: canvas + WebGL2 context, atlas, sprite batch, bitmap text,
 * camera, post FX. See docs/ENGINE.md.
 *
 *   await preloadAtlas();                 // once, before the first Renderer (atlas-source.ts)
 *   const r = new Renderer({ parent: document.body });
 *   // per frame:
 *   r.beginFrame(realDt);                 // resize, camera shake/zoom, post timers
 *   r.spr(Layer.Entity, h, x, y, ...);    // queue sprites
 *   r.endFrame();                         // scene -> glow -> bloom -> composite
 */
import { clamp } from "../core/math";
import { animFrame, type Atlas, type Anim } from "./atlas";
import { takeAtlas } from "./atlas-source";
import { SpriteBatch } from "./batch";
import { Camera } from "./camera";
import type { GL } from "./gl";
import { Flag, Layer } from "./layers";
import { PostFx, PostPipeline, type Grade } from "./post";
import { QUALITY, type QualitySettings } from "./quality";
import { BitmapText } from "./text";

export interface RendererOptions {
  /** Existing canvas (otherwise one is created and appended to `parent`). */
  canvas?: HTMLCanvasElement;
  parent?: HTMLElement;
  quality?: Partial<QualitySettings>;
  /** Scene clear colour 0xRRGGBB (visible only where no ground is drawn). */
  clearColor?: number;
  /**
   * The atlas to draw with (default: the one preloadAtlas() loaded; extra stand-in sprite defs are
   * passed to preloadAtlas, see atlas-source.ts).
   */
  atlas?: Atlas;
  /** Override the pixel-scale rule: returns css px per art px. */
  pixelScale?: (cssW: number, cssH: number) => number;
}

export interface SpriteOpts {
  /** Sprite id (+ frame) or a raw frame handle. */
  id?: string;
  frame?: number;
  handle?: number;
  x: number;
  y: number;
  layer?: number;
  scale?: number;
  sx?: number;
  sy?: number;
  flipX?: boolean;
  rot?: number;
  color?: number;
  alpha?: number;
  flash?: number;
  additive?: boolean;
  glow?: boolean;
  glowOnly?: boolean;
  noSnap?: boolean;
  /** Pivot override (sprite px). */
  pivotX?: number;
  pivotY?: number;
  /** Entity-layer sort key override (default y). */
  sortY?: number;
}

/** DESIGN 8.1 rule: short side shows clamp(minCss / 1.8, 200, 300) art px. */
export function defaultPixelScale(cssW: number, cssH: number): number {
  const m = Math.max(1, Math.min(cssW, cssH));
  return m / clamp(m / 1.8, 200, 300);
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  gl: GL;
  readonly atlas: Atlas;
  readonly batch: SpriteBatch;
  readonly text: BitmapText;
  readonly camera = new Camera();
  readonly post = new PostFx();
  readonly pipeline = new PostPipeline();
  readonly quality: QualitySettings;

  /** Real seconds accumulated by beginFrame (for UI-ish animation). */
  time = 0;
  cssW = 1;
  cssH = 1;
  dpr = 1;
  /** Scene buffer size (art px) used last frame. */
  sceneW = 1;
  sceneH = 1;
  clearColor: number;
  contextLost = false;
  /** Glow pass brightness multiplier. */
  glowGain = 1;
  /**
   * Scene buffer resolution scale, 0.25..1 (1 = art resolution). Below 1 the world renders into a
   * smaller scene target (chunkier pixels: Cancel-sama's BUDGET CUTS, stageFx "renderScale"), while
   * the protected layers - enemy bullets and in-world text - render at full art resolution into a
   * second target composited on top (so they stay crisp and are never graded down with the scene).
   */
  sceneScale = 1;
  /** realDt of the current frame (feeds the adaptive bloom limiter). */
  private frameDt = 1 / 60;
  /** Called after the canvas size / pixel scale changes. */
  onResize: ((r: Renderer) => void) | null = null;
  /** Called after a lost context was restored and resources rebuilt. */
  onRestore: ((r: Renderer) => void) | null = null;

  /** Handles of common utility sprites. */
  readonly H: { px: number; glow: number; glowS: number; shadow: number; ring: number; ringThick: number; circle: number; streak: number };

  private pixelScale: (w: number, h: number) => number;
  private dirty = true;
  private ro: ResizeObserver | null = null;
  private ownCanvas: boolean;
  private mq: MediaQueryList | null = null;

  constructor(opts: RendererOptions = {}) {
    this.ownCanvas = !opts.canvas;
    const canvas = opts.canvas ?? document.createElement("canvas");
    if (!opts.canvas) {
      canvas.className = "kk-canvas";
      Object.assign(canvas.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "100%",
        height: "100%",
        display: "block",
        touchAction: "none",
        userSelect: "none",
        webkitUserSelect: "none",
        outline: "none",
      } as Partial<CSSStyleDeclaration>);
      (opts.parent ?? document.body).appendChild(canvas);
    } else canvas.style.touchAction = "none";
    this.canvas = canvas;
    this.quality = { ...QUALITY.high, ...(opts.quality ?? {}) };
    this.clearColor = opts.clearColor ?? 0x2d1b45;
    this.pixelScale = opts.pixelScale ?? defaultPixelScale;
    this.pipeline.glowScale = this.quality.glowScale;

    const gl = this.createContext();
    this.gl = gl;
    this.atlas = opts.atlas ?? takeAtlas();
    this.batch = new SpriteBatch(this.atlas);
    this.text = new BitmapText(this.atlas, this.batch);
    const a = this.atlas;
    this.H = {
      px: a.handle("fx_px"),
      glow: a.handle("fx_glow"),
      glowS: a.handle("fx_glow_s"),
      shadow: a.handle("fx_shadow"),
      ring: a.handle("fx_ring"),
      ringThick: a.handle("fx_ring_thick"),
      circle: a.handle("fx_circle"),
      streak: a.handle("fx_streak"),
    };
    this.measure();
    this.initGL();

    canvas.addEventListener("webglcontextlost", this.onLost, false);
    canvas.addEventListener("webglcontextrestored", this.onRestored, false);
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => (this.dirty = true));
      this.ro.observe(canvas);
    }
    window.addEventListener("resize", this.markDirty);
    window.addEventListener("orientationchange", this.markDirty);
    window.visualViewport?.addEventListener("resize", this.markDirty);
    this.watchDpr();
  }

  // ------------------------------------------------------------------ setup
  private createContext(): GL {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is not available");
    return gl;
  }

  private initGL(): void {
    const gl = this.gl;
    this.atlas.upload(gl);
    this.batch.init(gl);
    this.pipeline.init(gl, this.sceneW, this.sceneH);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  private onLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    console.warn("[renderer] WebGL context lost");
  };

  private onRestored = (): void => {
    console.warn("[renderer] WebGL context restored - rebuilding GPU resources");
    try {
      this.pipeline.chain = [];
      this.initGL();
      this.contextLost = false;
      this.dirty = true;
      this.onRestore?.(this);
    } catch (err) {
      console.error("[renderer] failed to rebuild after context restore", err);
    }
  };

  private markDirty = (): void => {
    this.dirty = true;
  };

  private watchDpr(): void {
    if (typeof matchMedia === "undefined") return;
    this.mq?.removeEventListener("change", this.onDpr);
    this.mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.mq.addEventListener("change", this.onDpr);
  }
  private onDpr = (): void => {
    this.dirty = true;
    this.watchDpr();
  };

  private measure(): void {
    const r = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, r.width || window.innerWidth);
    this.cssH = Math.max(1, r.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprCap);
    const w = Math.max(1, Math.round(this.cssW * this.dpr));
    const h = Math.max(1, Math.round(this.cssH * this.dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.dpr = w / this.cssW;
    this.camera.setViewport(this.cssW, this.cssH, this.pixelScale(this.cssW, this.cssH));
    this.sceneW = Math.ceil(this.cssW / this.camera.scale) + 2;
    this.sceneH = Math.ceil(this.cssH / this.camera.scale) + 2;
  }

  /** Apply quality settings (DPR cap, glow buffer scale, bloom on/off). */
  setQuality(q: Partial<QualitySettings>): void {
    Object.assign(this.quality, q);
    if (q.glowScale !== undefined && q.glowScale !== this.pipeline.glowScale) {
      this.pipeline.glowScale = q.glowScale;
      if (!this.contextLost) this.pipeline.resize(this.sceneW, this.sceneH);
    }
    this.post.bloomEnabled = this.quality.bloom;
    this.dirty = true;
  }

  // ------------------------------------------------------------------ frame
  /** Start a frame: handles resizes, advances camera shake/zoom and post FX by realDt. */
  beginFrame(realDt: number): void {
    this.time += realDt;
    this.text.time = this.time;
    if (this.dirty) {
      this.dirty = false;
      const prevW = this.cssW;
      const prevH = this.cssH;
      const prevS = this.camera.baseScale;
      this.measure();
      if (prevW !== this.cssW || prevH !== this.cssH || prevS !== this.camera.baseScale) this.onResize?.(this);
    }
    this.frameDt = realDt;
    this.camera.update(realDt);
    this.post.update(realDt);
    this.batch.reset();
  }

  /** Render everything queued this frame. */
  endFrame(): void {
    if (this.contextLost || this.gl.isContextLost()) {
      this.batch.reset();
      return;
    }
    const gl = this.gl;
    const cam = this.camera;
    const v = cam.view;
    const sw = Math.ceil(this.cssW / cam.scale) + 2;
    const sh = Math.ceil(this.cssH / cam.scale) + 2;
    this.sceneW = sw;
    this.sceneH = sh;
    // reduced-resolution scene (sceneScale < 1): the scene target shrinks, bullets + text get their own full-res target
    const ss = clamp(this.sceneScale, 0.25, 1);
    const split = ss < 0.999;
    const tw = split ? Math.max(2, Math.ceil(sw * ss)) : sw;
    const th = split ? Math.max(2, Math.ceil(sh * ss)) : sh;
    this.pipeline.resize(tw, th, split ? sw : 0, split ? sh : 0);
    const ox = Math.floor(v.x) - 1;
    const oy = Math.floor(v.y) - 1;

    this.batch.upload();
    this.post.feedGlow(this.batch.glowCount, sw * sh, this.frameDt);
    // hero focus zone: the composite cuts bloom over her as far as the batch fades the player's fx (SpriteBatch.focus)
    const F = this.batch.updateFocus(this.frameDt);
    this.post.focusX = F.x;
    this.post.focusY = F.y;
    this.post.focusCut = F.on ? F.k * this.post.focusBloomCut : 0;

    // scene pass
    const p = this.pipeline;
    p.scene.bind();
    const c = this.clearColor;
    gl.clearColor(((c >>> 16) & 255) / 255, ((c >>> 8) & 255) / 255, (c & 255) / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (!split) {
      this.batch.begin(ox, oy, sw, sh, 1);
      this.batch.drawLayers(0, 9);
    } else {
      // low-res scene: everything but the protected layers (snapped to the coarse texel grid)
      this.batch.begin(ox, oy, sw, sh, 1, tw / sw, th / sh);
      this.batch.drawLayers(0, Layer.FxAdd);
      this.batch.drawLayers(Layer.Overlay, Layer.Overlay);
      // protected layers at art resolution into a transparent target (premultiplied)
      const top = p.top;
      if (top) {
        top.bind();
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.batch.begin(ox, oy, sw, sh, 1);
        this.batch.drawLayers(Layer.Bullets, Layer.Text);
      }
    }

    // glow pass
    const bloomOn = this.quality.bloom && this.post.bloomEnabled;
    p.glow.bind();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (bloomOn && this.batch.glowCount > 0) {
      this.batch.begin(ox, oy, sw, sh, this.glowGain);
      this.batch.drawGlow();
    }
    this.batch.end();
    if (bloomOn) p.bloom();

    p.composite(
      this.post,
      {
        resW: this.canvas.width,
        resH: this.canvas.height,
        dpr: this.dpr,
        scale: cam.scale,
        offX: v.x - ox,
        offY: v.y - oy,
        viewX: v.x,
        viewY: v.y,
        sceneKx: split ? tw / sw : 1,
        sceneKy: split ? th / sh : 1,
        topOn: split,
      },
      bloomOn,
    );
    gl.enable(gl.BLEND);
  }

  // ------------------------------------------------------------------ drawing helpers
  /** Fast positional sprite draw (see SpriteBatch.draw). */
  spr(layer: number, handle: number, x: number, y: number, sx = 1, sy = 1, rot = 0, color = 0xffffff, alpha = 1, flash = 0, flags = 0): void {
    this.batch.drawP(layer, handle, x, y, sx, sy, rot, color, alpha, flash, flags, this.atlas.fox[handle], this.atlas.foy[handle]);
  }

  /** Convenience options-object draw (allocates the options object at the call site; fine outside hot loops). */
  sprite(o: SpriteOpts): void {
    const h = o.handle ?? this.atlas.handle(o.id ?? "__missing", o.frame ?? 0);
    const s = o.scale ?? 1;
    let sx = (o.sx ?? 1) * s;
    const sy = (o.sy ?? 1) * s;
    if (o.flipX) sx = -sx;
    let flags = 0;
    if (o.additive) flags |= Flag.Add;
    if (o.glow) flags |= Flag.Glow;
    if (o.glowOnly) flags |= Flag.GlowOnly;
    if (o.noSnap) flags |= Flag.NoSnap;
    const layer = o.layer ?? Layer.Entity;
    const prevKey = this.batch.sortKey;
    if (o.sortY !== undefined) this.batch.sortKey = o.sortY;
    this.batch.drawP(
      layer,
      h,
      o.x,
      o.y,
      sx,
      sy,
      o.rot ?? 0,
      o.color ?? 0xffffff,
      o.alpha ?? 1,
      o.flash ?? 0,
      flags,
      o.pivotX ?? this.atlas.fox[h],
      o.pivotY ?? this.atlas.foy[h],
    );
    this.batch.sortKey = prevKey;
  }

  /** Animation descriptor for an id. */
  anim(id: string, fps?: number): Anim {
    return this.atlas.anim(id, fps);
  }
  /** Frame handle of an animation at time t. */
  frame(a: Anim, t: number, loop = true): number {
    return animFrame(a, t, loop);
  }
  /** Frame handle by id. */
  handle(id: string, frame = 0): number {
    return this.atlas.handle(id, frame);
  }

  /** Axis-aligned filled rectangle (top-left x, y). */
  rect(layer: number, x: number, y: number, w: number, h: number, color = 0xffffff, alpha = 1, flags = 0): void {
    this.batch.drawP(layer, this.H.px, x, y, w / 2, h / 2, 0, color, alpha, 0, flags, 0, 0);
  }

  /** Fill the whole current view (e.g. ult screen darkening: fillView(Layer.Overlay, C.deep, 0.5)). */
  fillView(layer: number, color: number, alpha: number, flags = 0): void {
    const v = this.camera.view;
    this.batch.drawP(layer, this.H.px, Math.floor(v.x) - 2, Math.floor(v.y) - 2, (v.w + 6) / 2, (v.h + 6) / 2, 0, color, alpha, 0, flags, 0, 0);
  }

  /** Line segment of `thickness` px (stretched/rotated pixel quad). */
  line(layer: number, x0: number, y0: number, x1: number, y1: number, thickness = 1, color = 0xffffff, alpha = 1, flags = 0): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return;
    this.batch.drawP(layer, this.H.px, x0, y0, len / 2, thickness / 2, Math.atan2(dy, dx), color, alpha, 0, flags, 0, 1);
  }

  /** Filled circle of radius r (soft-edged pixel circle sprite). */
  circle(layer: number, x: number, y: number, r: number, color = 0xffffff, alpha = 1, flags = 0): void {
    const s = r / 16;
    this.batch.drawP(layer, this.H.circle, x, y, s, s, 0, color, alpha, 0, flags | Flag.NoSnap, 16, 16);
  }

  /** 1px (or thick) ring of radius r. */
  ring(layer: number, x: number, y: number, r: number, color = 0xffffff, alpha = 1, flags = 0, thick = false): void {
    const s = r / 16;
    this.batch.drawP(layer, thick ? this.H.ringThick : this.H.ring, x, y, s, s, 0, color, alpha, 0, flags | Flag.NoSnap, 16, 16);
  }

  /** Soft radial glow (additive + bloom by default). */
  glow(x: number, y: number, r: number, color = 0xffffff, alpha = 1, layer: number = Layer.FxAdd, flags: number = Flag.Add | Flag.Glow): void {
    const s = r / 16;
    this.batch.drawP(layer, this.H.glow, x, y, s, s, 0, color, alpha, 0, flags | Flag.NoSnap, 16, 16);
  }

  /** Blob shadow under an actor (w = shadow width in px). */
  shadow(x: number, y: number, w = 12, alpha = 1): void {
    const s = w / 16;
    this.batch.drawP(Layer.Shadow, this.H.shadow, x, y, s, s, 0, 0xffffff, alpha, 0, 0, 8, 3);
  }

  // ------------------------------------------------------------------ post shortcuts
  shockwave(x: number, y: number, strength = 1, radius = 64, life = 0.6): void {
    this.post.shockwave(x, y, strength, radius, life);
  }
  flash(color: number, amount: number, seconds = 0.22): void {
    this.post.flash(color, amount, seconds);
  }
  aberration(amount: number): void {
    this.post.aberration(amount);
  }
  damageVignette(amount: number): void {
    this.post.damageVignette(amount);
  }
  /** Ease the colour grade (see GRADES presets). */
  setGrade(g: Partial<Grade>, seconds = 0): void {
    this.post.setGrade(g, seconds);
  }
  /** Base bloom strength (default 0.95). */
  get bloom(): number {
    return this.post.bloomStrength;
  }
  set bloom(v: number) {
    this.post.bloomStrength = v;
  }

  /** World -> CSS px (relative to the canvas). */
  worldToScreen(x: number, y: number, out: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
    return this.camera.worldToScreen(x, y, out);
  }
  /** CSS px (relative to the canvas) -> world. */
  screenToWorld(sx: number, sy: number, out: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
    return this.camera.screenToWorld(sx, sy, out);
  }

  /** CPU stats of the last frame. */
  get stats(): { instances: number; glow: number; drawCalls: number; sceneW: number; sceneH: number; scale: number; dpr: number } {
    return { ...this.batch.stats, sceneW: this.sceneW, sceneH: this.sceneH, scale: this.camera.scale, dpr: this.dpr };
  }

  /** Simulate a context loss + restore (testing). */
  debugLoseContext(restoreAfterMs = 500): void {
    const ext = this.gl.getExtension("WEBGL_lose_context");
    if (!ext) return;
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), restoreAfterMs);
  }

  destroy(): void {
    this.ro?.disconnect();
    window.removeEventListener("resize", this.markDirty);
    window.removeEventListener("orientationchange", this.markDirty);
    window.visualViewport?.removeEventListener("resize", this.markDirty);
    this.mq?.removeEventListener("change", this.onDpr);
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    this.pipeline.dispose();
    if (this.ownCanvas) this.canvas.remove();
  }
}
