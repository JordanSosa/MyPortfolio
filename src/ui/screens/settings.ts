/**
 * Settings panel (DESIGN §7): master / music / sfx volume, screen shake
 * 0/50/100 %, reduce flashing, damage numbers, quality auto/low/mid/high,
 * haptics, show FPS. Persisted immediately; works with touch, mouse, keys
 * (left/right adjusts the focused slider/segment) and gamepad.
 */
import type { App, UiScreen } from "../app";
import { h } from "../dom";
import { save, type Settings } from "../save";
import { layer, onTap } from "./common";

type Key = keyof Settings;

export function openSettings(app: App, onClose: () => void): UiScreen {
  const el = h("div", "modal settings");
  const s = save.data.settings;
  const slider = (k: Key, label: string) =>
    `<div class="set-row"><span>${label}</span><button class="slider" data-nav data-k="${k}"><div class="f"></div><div class="v"></div></button></div>`;
  const seg = (k: Key, label: string, opts: [string, string | number][]) =>
    `<div class="set-row"><span>${label}</span><div class="seg" data-k="${k}">${opts
      .map(([t, v]) => `<button data-nav data-v="${v}">${t}</button>`)
      .join("")}</div></div>`;
  const tog = (k: Key, label: string) => `<div class="set-row"><span>${label}</span><button class="tog" data-nav data-k="${k}" aria-label="${label}"></button></div>`;
  el.innerHTML = `
    <div class="panel settings-panel">
      <div class="h1">SETTINGS</div>
      ${slider("master", "Master volume")}
      ${slider("music", "Music")}
      ${slider("sfx", "Sound effects")}
      ${seg("shake", "Screen shake", [
        ["0%", 0],
        ["50%", 0.5],
        ["100%", 1],
      ])}
      ${tog("reduceFlashing", "Reduce flashing")}
      ${tog("damageNumbers", "Damage numbers")}
      ${seg("quality", "Quality", [
        ["AUTO", "auto"],
        ["LOW", "low"],
        ["MID", "mid"],
        ["HIGH", "high"],
      ])}
      ${tog("haptics", "Vibration")}
      ${tog("showFps", "Show FPS")}
      <div class="btn-row" style="margin-top:.6em"><button class="btn small" data-nav data-nav-default data-act="done">✓ DONE</button></div>
    </div>`;
  app.ui.appendChild(el);

  const set = (k: Key, v: unknown) => {
    (s as unknown as Record<string, unknown>)[k] = v;
    save.save();
    app.applySettings();
    refresh();
  };
  const refresh = () => {
    for (const b of el.querySelectorAll<HTMLElement>(".slider")) {
      const v = s[b.dataset.k as Key] as number;
      (b.querySelector(".f") as HTMLElement).style.width = `${Math.round(v * 100)}%`;
      (b.querySelector(".v") as HTMLElement).textContent = `${Math.round(v * 100)}%`;
    }
    for (const g of el.querySelectorAll<HTMLElement>(".seg")) {
      const cur = String(s[g.dataset.k as Key]);
      for (const b of g.querySelectorAll<HTMLElement>("button")) b.classList.toggle("on", b.dataset.v === cur);
    }
    for (const t of el.querySelectorAll<HTMLElement>(".tog")) t.classList.toggle("on", !!s[t.dataset.k as Key]);
  };
  refresh();

  // sliders: drag / tap position
  for (const b of el.querySelectorAll<HTMLElement>(".slider")) {
    const k = b.dataset.k as Key;
    const apply = (e: PointerEvent) => {
      const r = b.getBoundingClientRect();
      const v = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 20) / 20;
      set(k, v);
    };
    let drag = false;
    b.addEventListener("pointerdown", (e) => {
      drag = true;
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      apply(e);
    });
    b.addEventListener("pointermove", (e) => drag && apply(e));
    b.addEventListener("pointerup", () => {
      drag = false;
      app.sfx("uiMove");
    });
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if ((e as MouseEvent).detail === 0) set(k, s[k] === 0 ? 0.8 : 0);
    });
  }
  for (const g of el.querySelectorAll<HTMLElement>(".seg")) {
    const k = g.dataset.k as Key;
    for (const b of g.querySelectorAll<HTMLElement>("button"))
      onTap(b, () => {
        const raw = b.dataset.v as string;
        const num = Number(raw);
        set(k, Number.isFinite(num) && raw !== "" ? num : raw);
        app.sfx("uiMove");
      });
  }
  for (const t of el.querySelectorAll<HTMLElement>(".tog"))
    onTap(t, () => {
      const k = t.dataset.k as Key;
      set(k, !s[k]);
      app.sfx("uiMove");
      if (k === "haptics" && s.haptics) app.input.haptic(30);
    });
  const close = () => {
    app.sfx("uiBack");
    onClose();
  };
  onTap(el.querySelector('[data-act="done"]'), close);

  const L = layer(el, close);
  L.onAdjust = (focus, dir) => {
    if (focus.classList.contains("slider")) {
      const k = focus.dataset.k as Key;
      set(k, Math.round(Math.max(0, Math.min(1, (s[k] as number) + dir * 0.1)) * 10) / 10);
      app.sfx("uiMove");
      return true;
    }
    return false;
  };
  return {
    el,
    layer: L,
    close() {
      el.classList.add("out");
      setTimeout(() => el.remove(), 220);
    },
  };
}
