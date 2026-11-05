/**
 * Diagnostics (every build, normal players too): a ring buffer of recent errors
 * / warnings, WebGL context-loss counters, quality-tier history, and the
 * compact text block that Settings "Copy diagnostics" and the dev console copy.
 *
 *   installDiag()                 once at boot, before the App (constructor errors are caught too)
 *   trackApp(app)                 after the App exists (context losses, tier changes)
 *   diagnosticsText(app)          the text block (docs/DEVTOOLS.md)
 *   copyText(text)                clipboard inside the click, else a hidden textarea + execCommand
 *
 * Cost when nothing reads it: console.error / console.warn are wrapped (one
 * array write each), two window listeners, a 1 Hz tier sampler.
 */
import { audioStats } from "../audio";
import type { App } from "../ui/app";
import { save } from "../ui/save";
import { HIST_LABELS, prof } from "./perf";

declare const __KK_BUILD__: { version: string; commit: string; date: string } | undefined;

export interface LogEntry {
  /** Seconds since boot. */
  t: number;
  level: "error" | "warn";
  msg: string;
  /** Times this exact message repeated in a row (1 = once). */
  n: number;
}

const LOG_MAX = 100;
const MSG_MAX = 400;
const t0 = typeof performance !== "undefined" ? performance.now() : 0;
/** Recent errors / warnings, oldest first (at most LOG_MAX). */
export const diagLog: LogEntry[] = [];
export const diagCounts = { error: 0, warn: 0 };
/** WebGL context losses / restores, quality tier changes (time s, tier). */
export const glCounts = { lost: 0, restored: 0 };
export const tierLog: { t: number; tier: string }[] = [];
/** Last AudioContext.renderCapacity reading (the dev console starts the meter where the browser has it). */
export const renderCap = { avg: -1, peak: -1, underrun: -1, at: -1 };

/** Listeners of new log entries (the dev console Log tab). */
export const logListeners = new Set<(e: LogEntry) => void>();

function since(): number {
  return (performance.now() - t0) / 1000;
}

function fmtArg(a: unknown): string {
  if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? ` @ ${a.stack.split("\n").slice(1, 3).join(" ").trim()}` : ""}`;
  if (typeof a === "string") return a;
  try {
    return JSON.stringify(a) ?? String(a);
  } catch {
    return String(a);
  }
}

/** Record a log entry (also used by the dev console for its own notes). */
export function pushLog(level: LogEntry["level"], args: unknown[]): void {
  let msg = args.map(fmtArg).join(" ");
  if (msg.length > MSG_MAX) msg = msg.slice(0, MSG_MAX) + "…";
  diagCounts[level]++;
  const last = diagLog[diagLog.length - 1];
  // (a burst of the same message counts up instead of flooding the ring)
  let e: LogEntry;
  if (last && last.msg === msg && last.level === level) {
    e = last;
    e.n++;
    e.t = since();
  } else {
    e = { t: since(), level, msg, n: 1 };
    diagLog.push(e);
    if (diagLog.length > LOG_MAX) diagLog.splice(0, diagLog.length - LOG_MAX);
  }
  for (const fn of logListeners) {
    try {
      fn(e);
    } catch {
      /* a listener must never break logging */
    }
  }
}

let installed = false;

/** Wrap console.error / console.warn and listen for uncaught errors (idempotent). */
export function installDiag(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  for (const level of ["error", "warn"] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      pushLog(level, args);
      orig(...args);
    };
  }
  window.addEventListener("error", (e) => {
    const where = e.filename ? ` (${e.filename.split("/").pop()}:${e.lineno}:${e.colno})` : "";
    pushLog("error", [`[uncaught] ${e.error instanceof Error ? fmtArg(e.error) : e.message}${where}`]);
  });
  window.addEventListener("unhandledrejection", (e) => pushLog("error", ["[unhandled rejection]", e.reason]));
}

/** Context losses on the App's canvas and quality-tier changes (1 Hz sampler). */
export function trackApp(app: App): void {
  const c = app.r.canvas;
  c.addEventListener("webglcontextlost", () => glCounts.lost++);
  c.addEventListener("webglcontextrestored", () => glCounts.restored++);
  let tier = app.tier;
  tierLog.push({ t: since(), tier });
  setInterval(() => {
    if (app.tier !== tier) {
      tier = app.tier;
      tierLog.push({ t: since(), tier });
      if (tierLog.length > 12) tierLog.splice(0, tierLog.length - 12);
    }
  }, 1000);
}

/** Build identifier: package version, commit and build date when the build defines them. */
export function buildInfo(): string {
  const b = typeof __KK_BUILD__ !== "undefined" ? __KK_BUILD__ : undefined;
  const mode = import.meta.env.DEV ? "dev" : import.meta.env.MODE === "single" ? "single-file" : "prod";
  return b ? `${b.version} · ${b.commit} · ${b.date} · ${mode}` : `${mode} (no build stamp)`;
}

/** Short build label (the Settings footer): "v0.1.0 · e96d843", plus the mode outside a production build. */
export function buildLabel(): string {
  const b = typeof __KK_BUILD__ !== "undefined" ? __KK_BUILD__ : undefined;
  const mode = import.meta.env.DEV ? " · dev" : import.meta.env.MODE === "single" ? " · single-file" : "";
  return b ? `v${b.version} · ${b.commit}${mode}` : `build${mode}`;
}

let glInfo: string | null = null;
/** WebGL renderer string (unmasked where the browser allows), version, limits. */
export function glString(app: App): string {
  if (glInfo) return glInfo;
  try {
    const gl = app.r.gl as WebGL2RenderingContext;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const ren = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const ven = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    glInfo = `${ren} (${ven}) · ${gl.getParameter(gl.VERSION)} · maxTex ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`;
  } catch {
    glInfo = "unavailable";
  }
  return glInfo;
}

const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "-");
const ms = (sec: number | null) => (sec == null ? "n/a" : `${(sec * 1000).toFixed(1)} ms`);

/** The compact diagnostics block (copied by Settings and the dev console). */
export function diagnosticsText(app: App): string {
  const L: string[] = [];
  const now = new Date();
  L.push(`Kira Kira Overdrive diagnostics · ${now.toISOString().replace(/\.\d+Z$/, "Z")} · up ${f1(since())} s`);
  L.push(`build ${buildInfo()}`);
  L.push(`ua ${navigator.userAgent}`);
  const r = app.r;
  const vv = window.visualViewport;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  L.push(
    `screen ${window.innerWidth}x${window.innerHeight}${vv ? ` (vv ${Math.round(vv.width)}x${Math.round(vv.height)})` : ""} dpr ${window.devicePixelRatio} · canvas ${r.canvas.width}x${r.canvas.height} · scene ${r.sceneW}x${r.sceneH} x${r.camera.scale.toFixed(2)} · ${window.innerWidth > window.innerHeight ? "landscape" : "portrait"} · ${coarse ? "touch" : "mouse"}`,
  );
  const q = r.quality;
  L.push(`quality ${app.tier} (${app.auto.enabled ? "auto" : "fixed"}) · dprCap ${q.dprCap} glow ${q.glowScale} bloom ${q.bloom ? "on" : "off"} · particles ${q.particles} · enemy cap ${q.maxEnemies}${tierLog.length > 1 ? ` · tiers ${tierLog.map((x) => `${x.tier}@${x.t.toFixed(0)}s`).join(">")}` : ""}`);
  L.push(`gl ${glString(app)} · ctx lost ${glCounts.lost} restored ${glCounts.restored}${r.contextLost ? " · LOST NOW" : ""}`);
  const w = prof.window();
  const tot = Math.max(1, w.hist.reduce((a, b) => a + b, 0));
  L.push(`fps ${f1(w.fps)} · last ${w.seconds} s: ${w.frames} frames · worst ${w.worstMs.toFixed(0)} ms${app.loop.manual ? " · STEP MODE" : ""}`);
  L.push(`frame ms ${w.hist.map((n, i) => `${HIST_LABELS[i]} ${((n / tot) * 100).toFixed(n && n / tot < 0.01 ? 1 : 0)}%`).join(" | ")}`);
  const ph = prof.phases(Math.min(prof.held, 600));
  L.push(`cpu ms p50/p95 (last ${Math.min(prof.held, 600)} frames) total ${f1(ph.total.p50)}/${f1(ph.total.p95)} · ui ${f1(ph.ui.p50)}/${f1(ph.ui.p95)} · sim ${f1(ph.sim.p50)}/${f1(ph.sim.p95)} · view ${f1(ph.view.p50)}/${f1(ph.view.p95)} · fx ${f1(ph.fx.p50)}/${f1(ph.fx.p95)} · gpu ${f1(ph.gpu.p50)}/${f1(ph.gpu.p95)} · hud ${f1(ph.hud.p50)}/${f1(ph.hud.p95)}`);
  L.push(`peaks (60 s) enemies ${w.peakEnemies} · particles ${w.peakParticles} · sprites ${w.peakSprites}`);
  const g = app.game?.world;
  const where = `screen ${app.screen}${app.modalKind ? ` · modal ${app.modalKind}` : ""}${app.sub ? " · settings" : ""}${app.hub?.top ? ` · page ${app.hub.top.id}` : ""}`;
  L.push(
    g
      ? `${where} · run ${g.stage.id} t ${f1(g.t)} ${g.phase} · hero ${g.hero.id} L${g.level} hp ${Math.ceil(g.player.hp)}/${g.player.maxHp} · enemies ${g.enemyCount} bullets ${g.bullets.count}${app.practice ? " · practice" : ""}`
      : where,
  );
  try {
    const a = audioStats();
    const rc = renderCap.at >= 0 ? `renderCap avg ${(renderCap.avg * 100).toFixed(0)}% peak ${(renderCap.peak * 100).toFixed(0)}% underrun ${(renderCap.underrun * 100).toFixed(1)}%` : "renderCap n/a";
    L.push(
      `audio ${a.state} · ${a.sampleRate || "-"} Hz · base ${ms(a.baseLatency)} out ${ms(a.outputLatency)} · ${a.lite ? "lite" : "full"} · voices ${a.voices}/${a.maxVoices} · stress ${a.stress.toFixed(2)} · skipped notes ${a.skippedNotes} · sfx started ${a.started} dropped ${a.budgetDrops} · lookahead ${a.lookahead.toFixed(2)} s · ${a.track}${a.muffled ? " (muffled)" : ""} · ${rc}`,
    );
  } catch (e) {
    L.push(`audio stats failed: ${fmtArg(e)}`);
  }
  try {
    const p = save.profile;
    L.push(
      `save ${save.origin} rev ${save.rev} · write ${save.writeOk ? "ok" : "FAILING"} · runs ${p.lifetime.runs} clears ${p.lifetime.clears} · coins ${Math.floor(p.currencies.coins)} gems ${Math.floor(p.currencies.gems)} · heroes ${p.unlocks.heroes.length} stages ${p.unlocks.stages.length} · board ${Object.keys(p.board.ranks).length} nodes`,
    );
  } catch (e) {
    L.push(`save summary failed: ${fmtArg(e)}`);
  }
  const last = diagLog.slice(-20);
  L.push(`errors ${diagCounts.error} warnings ${diagCounts.warn}${last.length ? ` (last ${last.length}):` : ""}`);
  for (const e of last) L.push(` ${e.t.toFixed(1)}s [${e.level}]${e.n > 1 ? ` x${e.n}` : ""} ${e.msg}`);
  return L.join("\n");
}

/**
 * Copy `text` to the clipboard. Call it synchronously inside the click handler (the clipboard API
 * needs the user activation; the artifact sandbox may refuse it): navigator.clipboard first, then a
 * hidden textarea + execCommand("copy"). False when neither worked (show the text selectable).
 */
export async function copyText(text: string): Promise<boolean> {
  let p: Promise<void> | null = null;
  try {
    p = navigator.clipboard?.writeText(text) ?? null;
  } catch {
    p = null;
  }
  if (p) {
    try {
      await p;
      return true;
    } catch {
      /* blocked (permissions policy / sandbox): try the old way */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    Object.assign(ta.style, { position: "fixed", left: "-9999px", top: "0", opacity: "0" });
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
