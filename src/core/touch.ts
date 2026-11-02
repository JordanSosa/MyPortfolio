/**
 * On-screen touch controls (DOM): floating joystick + DASH + OVERDRIVE buttons.
 * Created and driven by `Input` (src/core/input.ts) - use the Input methods
 * (showTouchControls, setUltCharge, setDashCharge, ...) rather than this class.
 */

const STYLE_ID = "kk-touch-style";
const CSS = `
.kk-touch{position:fixed;inset:0;pointer-events:none;z-index:var(--kk-touch-z,40);
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;
  font-family:"Pixelify Sans","Silkscreen",ui-rounded,system-ui,sans-serif}
.kk-touch[hidden]{display:none}
.kk-stick{position:absolute;left:0;top:0;width:0;height:0;opacity:0;transition:opacity .18s ease-out;will-change:transform,opacity}
.kk-stick.on{opacity:1;transition:opacity .06s}
.kk-stick-base{position:absolute;left:-58px;top:-58px;width:116px;height:116px;border-radius:50%;
  background:radial-gradient(circle at 50% 50%,rgba(255,184,220,.10) 0 45%,rgba(180,124,255,.22) 70%,rgba(255,255,255,.0) 72%);
  border:3px solid rgba(255,255,255,.55);box-shadow:0 0 18px rgba(255,122,184,.55),inset 0 0 18px rgba(180,124,255,.45);
  transform:scale(.6);transition:transform .2s cubic-bezier(.3,1.6,.5,1)}
.kk-stick.on .kk-stick-base{transform:scale(1)}
.kk-stick-base::before{content:"";position:absolute;inset:10px;border-radius:50%;border:2px dashed rgba(255,255,255,.28)}
.kk-stick-knob{position:absolute;left:-27px;top:-27px;width:54px;height:54px;border-radius:50%;
  background:radial-gradient(circle at 36% 30%,#fff 0 12%,#ffd1ea 22%,#ff7ab8 62%,#d9468f 100%);
  border:3px solid #fff;box-shadow:0 0 16px rgba(255,122,184,.9),0 3px 0 rgba(45,27,69,.45);will-change:transform}
.kk-btn{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;padding:0;margin:0;
  -webkit-tap-highlight-color:transparent;outline:none;cursor:pointer;color:#fff;
  border:3px solid rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;
  text-shadow:0 2px 0 #2d1b45,0 0 6px rgba(45,27,69,.9),1px 0 0 #2d1b45,-1px 0 0 #2d1b45;
  letter-spacing:.5px;line-height:.95;transition:transform .08s ease-out,filter .2s;transform:translateZ(0)}
.kk-btn svg{position:absolute;inset:-9px;width:calc(100% + 18px);height:calc(100% + 18px);transform:rotate(-90deg);pointer-events:none;overflow:visible}
.kk-btn svg circle{fill:none;stroke-linecap:round}
.kk-btn .trk{stroke:rgba(45,27,69,.45);stroke-width:6}
.kk-btn .fil{stroke-width:6;transition:stroke-dashoffset .12s linear}
.kk-btn .lbl{position:relative;z-index:1;font-weight:700;pointer-events:none}
.kk-btn.down{transform:scale(.88)}
.kk-dash{width:86px;height:86px;right:calc(20px + env(safe-area-inset-right,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));
  background:radial-gradient(circle at 35% 28%,#e6fffb 0 10%,#7ff0e8 32%,#4fb8e6 70%,#3462d6 100%);
  box-shadow:0 0 20px rgba(79,230,223,.75),inset 0 -6px 0 rgba(31,42,115,.35),0 4px 0 rgba(45,27,69,.5);font-size:19px}
.kk-dash .fil{stroke:#bafff6;filter:drop-shadow(0 0 4px #4fe6df)}
.kk-dash.cd{filter:saturate(.45) brightness(.8)}
.kk-dash.ready-pop{animation:kk-pop .32s cubic-bezier(.3,1.8,.5,1)}
.kk-ult{width:74px;height:74px;right:calc(58px + env(safe-area-inset-right,0px));bottom:calc(134px + env(safe-area-inset-bottom,0px));
  background:radial-gradient(circle at 35% 28%,#fff 0 9%,#ffb8dc 30%,#b47cff 72%,#743fd1 100%);
  box-shadow:0 0 14px rgba(180,124,255,.6),inset 0 -6px 0 rgba(45,27,69,.35),0 4px 0 rgba(45,27,69,.5);font-size:12.5px;
  filter:saturate(.55) brightness(.85)}
.kk-ult .fil{stroke:#ffe14d;filter:drop-shadow(0 0 4px #ffb84d)}
.kk-ult.ready{filter:none;animation:kk-rainbow 1.2s linear infinite,kk-pulse .9s ease-in-out infinite}
.kk-ult.ready .fil{stroke:#fff}
.kk-ult.ready::after{content:"";position:absolute;inset:-14px;border-radius:50%;border:3px solid rgba(255,255,255,.8);
  animation:kk-ping 1.1s ease-out infinite;pointer-events:none}
.kk-btn.deny{animation:kk-shake .3s ease-in-out}
@keyframes kk-rainbow{0%{box-shadow:0 0 22px #ff7ab8,0 0 40px rgba(255,122,184,.6),0 4px 0 rgba(45,27,69,.5)}
  25%{box-shadow:0 0 22px #ffe14d,0 0 40px rgba(255,225,77,.6),0 4px 0 rgba(45,27,69,.5)}
  50%{box-shadow:0 0 22px #4fe6df,0 0 40px rgba(79,230,223,.6),0 4px 0 rgba(45,27,69,.5)}
  75%{box-shadow:0 0 22px #b47cff,0 0 40px rgba(180,124,255,.6),0 4px 0 rgba(45,27,69,.5)}
  100%{box-shadow:0 0 22px #ff7ab8,0 0 40px rgba(255,122,184,.6),0 4px 0 rgba(45,27,69,.5)}}
@keyframes kk-pulse{0%,100%{scale:1}50%{scale:1.09}}
@keyframes kk-ping{0%{transform:scale(.8);opacity:.9}100%{transform:scale(1.35);opacity:0}}
@keyframes kk-pop{0%{scale:1}40%{scale:1.18}100%{scale:1}}
@keyframes kk-shake{0%,100%{translate:0}20%{translate:-5px}40%{translate:5px}60%{translate:-3px}80%{translate:3px}}
`;

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

function ringSvg(): string {
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="${RING_R}"/><circle class="fil" cx="50" cy="50" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${RING_C.toFixed(2)}"/></svg>`;
}

export class TouchControls {
  readonly root: HTMLDivElement;
  readonly stick: HTMLDivElement;
  readonly knob: HTMLDivElement;
  readonly dashBtn: HTMLButtonElement;
  readonly ultBtn: HTMLButtonElement;
  private dashFil: SVGCircleElement;
  private ultFil: SVGCircleElement;
  private lastUlt = -1;
  private lastDash = -1;
  private ultReady = false;
  private dashReady = true;

  constructor(parent: HTMLElement = document.body) {
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement("style");
      st.id = STYLE_ID;
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const root = document.createElement("div");
    root.className = "kk-touch";
    root.hidden = true;
    root.innerHTML = `
      <div class="kk-stick"><div class="kk-stick-base"></div><div class="kk-stick-knob"></div></div>
      <button class="kk-btn kk-ult" type="button" aria-label="Overdrive" data-no-joystick>${ringSvg()}<span class="lbl">OVER<br>DRIVE</span></button>
      <button class="kk-btn kk-dash" type="button" aria-label="Dash" data-no-joystick>${ringSvg()}<span class="lbl">DASH</span></button>`;
    parent.appendChild(root);
    this.root = root;
    this.stick = root.querySelector(".kk-stick") as HTMLDivElement;
    this.knob = root.querySelector(".kk-stick-knob") as HTMLDivElement;
    this.dashBtn = root.querySelector(".kk-dash") as HTMLButtonElement;
    this.ultBtn = root.querySelector(".kk-ult") as HTMLButtonElement;
    this.dashFil = this.dashBtn.querySelector(".fil") as SVGCircleElement;
    this.ultFil = this.ultBtn.querySelector(".fil") as SVGCircleElement;
    for (const b of [this.dashBtn, this.ultBtn]) b.addEventListener("contextmenu", (e) => e.preventDefault());
    this.setDash(1);
    this.setUlt(0, false);
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
  }
  get visible(): boolean {
    return !this.root.hidden;
  }

  showStick(x: number, y: number): void {
    this.stick.style.transform = `translate3d(${x}px,${y}px,0)`;
    this.knob.style.transform = "translate3d(0,0,0)";
    this.stick.classList.add("on");
  }
  moveStick(x: number, y: number, kx: number, ky: number): void {
    this.stick.style.transform = `translate3d(${x}px,${y}px,0)`;
    this.knob.style.transform = `translate3d(${kx}px,${ky}px,0)`;
  }
  hideStick(): void {
    this.stick.classList.remove("on");
    this.knob.style.transform = "translate3d(0,0,0)";
  }

  setPressed(btn: "dash" | "ult", down: boolean): void {
    (btn === "dash" ? this.dashBtn : this.ultBtn).classList.toggle("down", down);
  }

  deny(btn: "dash" | "ult"): void {
    const el = btn === "dash" ? this.dashBtn : this.ultBtn;
    el.classList.remove("deny");
    void el.offsetWidth;
    el.classList.add("deny");
  }

  /** fill 0..1 (1 = ready). */
  setDash(fill: number): void {
    const f = Math.max(0, Math.min(1, fill));
    const q = Math.round(f * 100);
    if (q === this.lastDash) return;
    this.lastDash = q;
    this.dashFil.style.strokeDashoffset = (RING_C * (1 - f)).toFixed(1);
    const ready = f >= 1;
    if (ready !== this.dashReady) {
      this.dashReady = ready;
      this.dashBtn.classList.toggle("cd", !ready);
      if (ready) {
        this.dashBtn.classList.remove("ready-pop");
        void this.dashBtn.offsetWidth;
        this.dashBtn.classList.add("ready-pop");
      }
    }
  }

  setUlt(fill: number, ready: boolean): void {
    const f = Math.max(0, Math.min(1, fill));
    const q = Math.round(f * 200);
    if (q !== this.lastUlt) {
      this.lastUlt = q;
      this.ultFil.style.strokeDashoffset = (RING_C * (1 - f)).toFixed(1);
    }
    if (ready !== this.ultReady) {
      this.ultReady = ready;
      this.ultBtn.classList.toggle("ready", ready);
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
