/**
 * Perf tab: frame-time graph (real interval, 16.7 / 33.3 ms lines), stacked CPU breakdown per
 * frame (ui / sim / view / fx / gpu / hud), p50 / p95 / max table, counts, quality tier, render
 * toggles, freeze + step.
 */
import { isQualityTier, type QualityTier } from "../../render";
import { renderOnce, setStepMode, stepFrames } from "../dev";
import { HIST_LABELS, PHASES, prof } from "../perf";
import type { ConsoleHost, Tab } from "./console";
import { installOverlay, overlay, syncZoom } from "./overlay";
import { btn, el, fx1, kv, row, sec, toggle } from "./ui";

const PH_COL = ["#b68cff", "#ff6fa8", "#4fe6df", "#ffe14d", "#7dff9a", "#ffa040"];
const N = 180;

export function perfTab(h: ConsoleHost): Tab {
  const app = h.app;
  const root = el("div");
  root.append(sec("frame time (ms, real interval)"));
  const cvDt = el("canvas", "kkd-cv");
  root.append(cvDt);
  const legend = el("div", "kkd-note", PHASES.map((p, i) => `<span style="color:${PH_COL[i]}">■</span> ${p}`).join(" &nbsp;"));
  root.append(sec("cpu per frame (stacked)"), legend);
  const cvPh = el("canvas", "kkd-cv tall");
  root.append(cvPh);
  const tbl = el("table", "kkd-tbl");
  root.append(tbl);
  const hist = el("div", "kkd-note");
  root.append(hist);
  root.append(sec("counts"));
  const counts = kv();
  root.append(counts.el);

  root.append(sec("quality"));
  const tierRow = row();
  const tierBtns: [string, HTMLButtonElement][] = [];
  for (const t of ["auto", "low", "mid", "high"]) {
    const b = btn(t.toUpperCase(), () => {
      if (t === "auto") app.auto.enabled = true;
      else if (isQualityTier(t)) {
        app.auto.enabled = false;
        app.auto.set(t as QualityTier);
      }
      syncTier();
    }, "sm");
    tierBtns.push([t, b]);
    tierRow.append(b);
  }
  root.append(tierRow);
  const syncTier = () => {
    for (const [t, b] of tierBtns) b.classList.toggle("on", t === "auto" ? app.auto.enabled : !app.auto.enabled && app.tier === t);
  };

  root.append(sec("render toggles"));
  const tg = (label: string, k: keyof typeof overlay) =>
    toggle(label, () => overlay[k], (on) => {
      installOverlay(app);
      overlay[k] = on;
      if (k === "spawnRing") syncZoom(app);
      if (app.loop.manual) renderOnce(app);
    });
  const toggles = [tg("hitboxes", "hitboxes"), tg("spawn ring", "spawnRing"), tg("bloom off", "noBloom"), tg("grade off", "noGrade")];
  root.append(row(...toggles));
  root.append(el("div", "kkd-note", "spawn ring zooms the camera out to 0.6x (the sim's view grows with it while on)"));

  root.append(sec("freeze / step (deterministic)"));
  const freeze = toggle("FREEZE", () => app.loop.manual, (on) => setStepMode(app, on));
  root.append(
    row(
      freeze,
      btn("+1 frame", () => stepFrames(app, 1), "sm"),
      btn("+10", () => stepFrames(app, 10), "sm"),
      btn("+1 s", () => stepFrames(app, 60), "sm"),
      btn("+5 s", () => stepFrames(app, 300), "sm"),
    ),
  );
  root.append(el("div", "kkd-note", "frozen: nothing runs until a step (sim + fx + DOM every frame, one WebGL draw at the end); CSS animations follow the steps"));

  const scratch = new Float32Array(N);
  const draw = () => {
    drawDt(cvDt, prof.recent(prof.dt, N, scratch));
    drawPhases(cvPh);
  };

  return {
    id: "perf",
    label: "Perf",
    el: root,
    update() {
      draw();
      const ph = prof.phases(300);
      const dt = prof.pct(prof.dt, 300);
      let html = `<tr><th>last 300</th><th>p50</th><th>p95</th><th>max</th></tr><tr><td>frame</td><td>${fx1(dt.p50)}</td><td>${fx1(dt.p95)}</td><td>${fx1(dt.max)}</td></tr>`;
      for (const k of [...PHASES, "total"] as const) {
        const v = ph[k];
        html += `<tr><td>${k}</td><td>${v.p50.toFixed(2)}</td><td>${v.p95.toFixed(2)}</td><td>${v.max.toFixed(1)}</td></tr>`;
      }
      if (tbl.innerHTML !== html) tbl.innerHTML = html;
      const w = prof.window();
      const tot = Math.max(1, w.hist.reduce((a, b) => a + b, 0));
      hist.textContent = `last ${w.seconds}s: ${w.fps.toFixed(1)} fps · ${w.hist.map((n, i) => `${HIST_LABELS[i]} ${((n / tot) * 100).toFixed(0)}%`).join(" ")} · worst ${w.worstMs.toFixed(0)}ms`;
      const g = app.game?.world ?? app.attract?.world;
      const st = app.r.stats;
      counts.set([
        ["enemies", g ? `${g.enemyCount} / cap ${g.maxEnemies} (peak 60s ${w.peakEnemies})` : "-"],
        ["bullets / proj", g ? `${g.bullets.count} / ${g.projectiles.count}` : "-"],
        ["gems / pickups", g ? `${g.gems.count} / ${g.pickups.count}` : "-"],
        ["particles", `${app.fx.ps.count} / ${app.fx.ps.capacity} (peak ${w.peakParticles})`],
        ["sprites / glow", `${st.instances} / ${st.glow} · ${st.drawCalls} draws`],
        ["scene", `${st.sceneW}x${st.sceneH} x${st.scale.toFixed(2)} dpr ${st.dpr.toFixed(2)} · ss ${app.r.sceneScale.toFixed(2)}`],
        ["tier", `${app.tier}${app.auto.enabled ? " (auto)" : " (fixed)"}`],
        ["frames", `${app.loop.frames}${app.loop.manual ? " · STEP MODE" : ""}`],
      ]);
      syncTier();
      freeze.refresh();
      for (const t of toggles) t.refresh();
    },
  };
}

function fit(cv: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(10, Math.round(cv.clientWidth * dpr));
  const h = Math.max(10, Math.round(cv.clientHeight * dpr));
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  return cv.getContext("2d");
}

function drawDt(cv: HTMLCanvasElement, v: Float32Array): void {
  const c = fit(cv);
  if (!c) return;
  const W = cv.width;
  const H = cv.height;
  const top = 50;
  c.clearRect(0, 0, W, H);
  c.fillStyle = "rgba(255,255,255,.18)";
  for (const m of [16.7, 33.3]) c.fillRect(0, H - (m / top) * H, W, 1);
  const n = v.length;
  const bw = W / N;
  for (let i = 0; i < n; i++) {
    const ms = v[i];
    const hh = Math.min(H, (ms / top) * H);
    c.fillStyle = ms > 34 ? "#ff4d6d" : ms > 20 ? "#ffe14d" : "#4fe6df";
    c.fillRect((N - n + i) * bw, H - hh, Math.max(1, bw - 0.5), hh);
  }
}

function drawPhases(cv: HTMLCanvasElement): void {
  const c = fit(cv);
  if (!c) return;
  const W = cv.width;
  const H = cv.height;
  const top = 25;
  c.clearRect(0, 0, W, H);
  c.fillStyle = "rgba(255,255,255,.18)";
  for (const m of [8.3, 16.7]) c.fillRect(0, H - (m / top) * H, W, 1);
  const n = Math.min(N, prof.held);
  const chans = prof.ph.map((ch) => prof.recent(ch, n));
  const bw = W / N;
  for (let i = 0; i < n; i++) {
    let y = H;
    for (let k = 0; k < chans.length; k++) {
      const hh = (chans[k][i] / top) * H;
      if (hh <= 0) continue;
      c.fillStyle = PH_COL[k];
      c.fillRect((N - n + i) * bw, y - hh, Math.max(1, bw - 0.5), hh);
      y -= hh;
    }
  }
}
