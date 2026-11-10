/**
 * Tiny FPS / frame-time meter (DOM overlay, top-left, respects safe areas).
 *
 *   const fps = new FpsMeter();      // hidden until show()
 *   fps.show(); fps.toggle();
 *   loop: fps.frame(realDtSeconds, cpuMs?, extraText?)
 */
export class FpsMeter {
  readonly el: HTMLDivElement;
  private label: HTMLSpanElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private hist = new Float32Array(90);
  private hi = 0;
  private acc = 0;
  private frames = 0;
  private cpuAcc = 0;
  private worst = 0;
  /** Last measured average fps / ms. */
  fps = 0;
  ms = 0;

  constructor(parent: HTMLElement = document.body) {
    const el = document.createElement("div");
    el.className = "kk-fps";
    Object.assign(el.style, {
      position: "fixed",
      left: "calc(6px + env(safe-area-inset-left, 0px))",
      bottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
      zIndex: "9999",
      pointerEvents: "none",
      font: "10px/1.2 ui-monospace, Menlo, Consolas, monospace",
      color: "#e9e3f7",
      background: "rgba(20,12,34,.72)",
      border: "1px solid rgba(180,124,255,.5)",
      borderRadius: "4px",
      padding: "3px 5px",
      whiteSpace: "pre",
      display: "none",
    } as Partial<CSSStyleDeclaration>);
    this.label = document.createElement("span");
    this.canvas = document.createElement("canvas");
    this.canvas.width = 90;
    this.canvas.height = 18;
    Object.assign(this.canvas.style, { display: "block", width: "90px", height: "18px", marginTop: "2px" });
    el.append(this.label, this.canvas);
    parent.appendChild(el);
    this.el = el;
    this.ctx = this.canvas.getContext("2d");
  }

  get visible(): boolean {
    return this.el.style.display !== "none";
  }
  show(on = true): void {
    this.el.style.display = on ? "block" : "none";
  }
  hide(): void {
    this.show(false);
  }
  toggle(): void {
    this.show(!this.visible);
  }

  /** Feed one frame: dt in seconds (frame interval), optional cpu ms and extra text line. */
  frame(dt: number, cpuMs = 0, extra = ""): void {
    const ms = dt * 1000;
    this.hist[this.hi] = ms;
    this.hi = (this.hi + 1) % this.hist.length;
    this.acc += dt;
    this.frames++;
    this.cpuAcc += cpuMs;
    if (ms > this.worst) this.worst = ms;
    if (this.acc < 0.25) return;
    this.fps = this.frames / this.acc;
    this.ms = (this.acc * 1000) / this.frames;
    const cpu = this.cpuAcc / this.frames;
    if (this.visible) {
      this.label.textContent = `${this.fps.toFixed(0).padStart(3)} fps ${this.ms.toFixed(1)}ms` + (cpuMs ? ` cpu ${cpu.toFixed(1)}` : "") + ` max ${this.worst.toFixed(0)}` + (extra ? `\n${extra}` : "");
      this.drawGraph();
    }
    this.acc = 0;
    this.frames = 0;
    this.cpuAcc = 0;
    this.worst = 0;
  }

  private drawGraph(): void {
    const c = this.ctx;
    if (!c) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,.12)";
    c.fillRect(0, H - (16.7 / 40) * H, W, 1);
    for (let i = 0; i < this.hist.length; i++) {
      const v = this.hist[(this.hi + i) % this.hist.length];
      const h = Math.min(H, (v / 40) * H);
      c.fillStyle = v > 25 ? "#ff4d6d" : v > 18 ? "#ffe14d" : "#4fe6df";
      c.fillRect(i, H - h, 1, h);
    }
  }

  destroy(): void {
    this.el.remove();
  }
}
