/**
 * The in-game DEV CONSOLE (lazy chunk: src/debug/dev.ts loads it on ?dev=1, the ` key, a
 * 3-finger long-press, or __kk.dev()). docs/DEVTOOLS.md §3.
 *
 * Tabs: Perf (fps / frame breakdown graphs, counts, quality tier, render toggles, freeze + step),
 * Run (time controls, timeline, spawn, give, god / kill / clear), Audio (context, profile, voices,
 * stress, skipped notes, test sounds), Account (currencies, unlock all, checkpoint profiles, reset),
 * Scenarios (one tap), Log (errors / warnings, Copy diagnostics).
 *
 * Touch-first: 30+ px controls, a draggable header, collapses to a small pill that never covers the
 * game; nothing refreshes while it is collapsed except the pill's fps (2x/s). The panel is marked
 * [data-no-joystick] so touches on it never move the hero.
 */
import type { App } from "../../ui/app";
import { copyText, diagnosticsText } from "../diag";
import { prof } from "../perf";
import { CSS } from "./style";
import { accountTab } from "./tab-account";
import { audioTab } from "./tab-audio";
import { logTab, showLogText } from "./tab-log";
import { perfTab } from "./tab-perf";
import { runTab } from "./tab-run";
import { scenarioTab } from "./tab-scenarios";
import { el, toast } from "./ui";

export interface Tab {
  id: string;
  label: string;
  el: HTMLElement;
  /** Called ~4x/s while the tab shows. */
  update?(): void;
  /** The tab became visible. */
  show?(): void;
  hide?(): void;
}

export interface ConsoleHost {
  app: App;
  /** window.__kk (debug hooks: give, spawn, skipTo, boss ... and the dev API). */
  kk: Record<string, (...a: never[]) => unknown> & Record<string, unknown>;
  /** Collapse the panel to its pill (scenarios do, so the state shows). */
  collapse(): void;
}

const STORE = "kko.dev.console";

interface State {
  tab: string;
  collapsed: boolean;
  /** Panel and pill positions (px, -1 = default). */
  x: number;
  y: number;
  px: number;
  py: number;
}

function loadState(): State {
  const d: State = { tab: "perf", collapsed: false, x: -1, y: -1, px: -1, py: -1 };
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<State> | null;
    if (s && typeof s === "object") return { ...d, ...s };
  } catch {
    /* storage blocked: defaults */
  }
  return d;
}

class DevConsole implements ConsoleHost {
  readonly root: HTMLDivElement;
  readonly kk: ConsoleHost["kk"];
  private readonly panel: HTMLDivElement;
  private readonly pill: HTMLDivElement;
  private readonly live: HTMLSpanElement;
  private readonly body: HTMLDivElement;
  private readonly tabBtns = new Map<string, HTMLButtonElement>();
  private readonly tabs: Tab[];
  private cur: Tab | null = null;
  private timer = 0;
  private state = loadState();

  constructor(readonly app: App) {
    this.kk = (window as unknown as { __kk: ConsoleHost["kk"] }).__kk;
    if (!document.getElementById("kkd-css")) {
      const st = document.createElement("style");
      st.id = "kkd-css";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    this.root = el("div", "kkd");
    this.root.dataset.noJoystick = "";
    this.root.dataset.ui = "";
    // the game never sees touches / clicks / keys aimed at the console
    for (const ev of ["pointerdown", "pointerup", "touchstart", "touchend", "click", "wheel", "keydown", "keyup"] as const)
      this.root.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev === "touchstart" || ev === "wheel" });
    this.panel = el("div", "kkd-panel");
    const head = el("div", "kkd-head");
    head.append(el("span", "kkd-title", "KK DEV"));
    this.live = el("span", "kkd-live");
    head.append(this.live);
    const hb = (label: string, title: string, fn: () => void) => {
      const b = el("button", "kkd-hb");
      b.type = "button";
      b.textContent = label;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
      });
      return b;
    };
    head.append(
      hb("⧉", "Copy diagnostics", () => void this.copyDiag()),
      hb("–", "Collapse", () => this.collapse()),
      hb("×", "Close (` or 3-finger long-press reopens)", () => this.close()),
    );
    const bar = el("div", "kkd-tabs");
    this.body = el("div", "kkd-body kscroll");
    this.tabs = [perfTab(this), runTab(this), audioTab(this), accountTab(this), scenarioTab(this), logTab(this)];
    for (const t of this.tabs) {
      const b = el("button", "kkd-tab");
      b.type = "button";
      b.textContent = t.label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.show(t.id);
      });
      this.tabBtns.set(t.id, b);
      bar.appendChild(b);
    }
    this.panel.append(head, bar, this.body);
    this.pill = el("div", "kkd-pill", "DEV <small></small>");
    this.pill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.dragged) this.expand();
    });
    this.root.append(this.panel, this.pill);
    document.body.appendChild(this.root);
    this.drag(head);
    this.drag(this.pill);
    window.addEventListener("resize", this.place);
    this.show(this.tabs.some((t) => t.id === this.state.tab) ? this.state.tab : "perf");
    if (this.state.collapsed) this.collapse();
    else this.expand();
  }

  get open(): boolean {
    return this.root.isConnected && this.root.style.display !== "none";
  }

  private save(): void {
    try {
      localStorage.setItem(STORE, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
  }

  show(id: string): void {
    const t = this.tabs.find((x) => x.id === id) ?? this.tabs[0];
    if (this.cur === t) return;
    this.cur?.hide?.();
    this.cur = t;
    for (const [k, b] of this.tabBtns) b.classList.toggle("on", k === t.id);
    this.body.replaceChildren(t.el);
    this.body.scrollTop = 0;
    t.show?.();
    t.update?.();
    this.state.tab = t.id;
    this.save();
  }

  collapse(): void {
    this.state.collapsed = true;
    this.panel.style.display = "none";
    this.pill.style.display = "flex";
    this.cur?.hide?.();
    this.save();
    this.restartTimer();
    this.place();
  }

  expand(): void {
    this.state.collapsed = false;
    this.panel.style.display = "flex";
    this.pill.style.display = "none";
    this.cur?.show?.();
    this.cur?.update?.();
    this.save();
    this.restartTimer();
    this.place();
  }

  close(): void {
    this.root.style.display = "none";
    this.cur?.hide?.();
    clearInterval(this.timer);
    this.timer = 0;
  }

  reopen(): void {
    this.root.style.display = "";
    if (this.state.collapsed) this.collapse();
    else this.expand();
  }

  private restartTimer(): void {
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), this.state.collapsed ? 500 : 250);
    this.tick();
  }

  private tick(): void {
    const w = prof.window();
    const ph = prof.pct(prof.cpu, 120);
    const g = this.app.game?.world;
    const fps = this.app.loop.manual ? "STEP" : `${w.fps.toFixed(0)}fps`;
    const txt = `${fps} cpu ${ph.p50.toFixed(1)}/${ph.p95.toFixed(1)}ms ${this.app.tier}${g ? ` · ${Math.floor(g.t / 60)}:${String(Math.floor(g.t % 60)).padStart(2, "0")} en ${g.enemyCount}` : ` · ${this.app.screen}`}`;
    if (this.state.collapsed) {
      const s = this.pill.querySelector("small");
      const short = this.app.loop.manual ? "STEP" : `${w.fps.toFixed(0)}fps`;
      if (s && s.textContent !== short) s.textContent = short;
      return;
    }
    if (this.live.textContent !== txt) this.live.textContent = txt;
    try {
      this.cur?.update?.();
    } catch (e) {
      console.warn("[dev] tab update failed", e);
    }
  }

  private async copyDiag(): Promise<void> {
    const text = diagnosticsText(this.app);
    const ok = await copyText(text);
    if (ok) toast("Diagnostics copied");
    else {
      // (sandboxed hosts may block the clipboard: show it selectable in the Log tab)
      this.show("log");
      showLogText(text);
      toast("Copy blocked here: select the text in the Log tab");
    }
  }

  // ---------------------------------------------------------------- position / drag
  private dragged = false;

  private place = (): void => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pill = this.state.collapsed;
    const box = (pill ? this.pill : this.panel).getBoundingClientRect();
    const bw = box.width || 200;
    const bh = box.height || 40;
    let x = pill ? this.state.px : this.state.x;
    let y = pill ? this.state.py : this.state.y;
    if (x < 0 || y < 0) {
      // defaults: the pill sits on the left edge under the HUD's weapon icons (clear of the combo
      // counter, the pause button and the touch buttons); the panel top-right under the pause
      // button on wide screens, the lower 70 % of a portrait phone
      if (pill) {
        x = 4;
        y = vh * 0.36;
      } else {
        x = vw - bw - 6;
        y = vw < 600 ? Math.max(6, vh * 0.3) : 64;
      }
    }
    x = Math.max(4, Math.min(vw - bw - 4, x));
    y = Math.max(4, Math.min(vh - Math.min(bh, vh - 8) - 4, y));
    this.root.style.left = `${Math.round(x)}px`;
    this.root.style.top = `${Math.round(y)}px`;
  };

  private drag(handle: HTMLElement): void {
    let id = -1;
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;
    handle.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".kkd-hb")) return;
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      const r = this.root.getBoundingClientRect();
      ox = r.left;
      oy = r.top;
      this.dragged = false;
      try {
        handle.setPointerCapture(id);
      } catch {
        /* ignore */
      }
    });
    handle.addEventListener("pointermove", (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!this.dragged && Math.hypot(dx, dy) < 6) return;
      this.dragged = true;
      if (this.state.collapsed) {
        this.state.px = ox + dx;
        this.state.py = oy + dy;
      } else {
        this.state.x = ox + dx;
        this.state.y = oy + dy;
      }
      this.place();
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      if (this.dragged) this.save();
      // (the click that follows a drag must not expand the pill)
      setTimeout(() => (this.dragged = false), 0);
    };
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }
}

let inst: DevConsole | null = null;

/** Open / close the console (`open` forces a state). Returns whether it is open now. */
export function toggleConsole(app: App, open?: boolean): boolean {
  if (!inst) {
    if (open === false) return false;
    inst = new DevConsole(app);
    return true;
  }
  const want = open ?? !inst.open;
  if (want) inst.reopen();
  else inst.close();
  return want;
}
