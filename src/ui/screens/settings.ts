/**
 * Settings panel ("Behind the Scenes", DESIGN §7) with two tabs:
 *  - GAME: master / music / sfx volume, screen shake 0/50/100 %, reduce
 *    flashing, damage numbers, quality auto/low/mid/high, haptics (only where
 *    the browser can vibrate), show FPS, and a Fullscreen switch where the
 *    Fullscreen API exists (not persisted). Changes apply live; slider drags
 *    are saved when the finger lifts.
 *  - SAVE DATA (docs/EXPANSION.md §14): export the profile as a text string
 *    (copied with a button, also shown selectable), import one (pasted, with a
 *    confirm; the replaced profile is kept as a backup), start over.
 * Works with touch, mouse, keys (left/right adjusts the focused slider /
 * segment) and gamepad.
 */
import type { App, UiScreen } from "../app";
import { esc, fmtInt, h } from "../dom";
import { confirmDialog } from "../kit/overlay";
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
  const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === "function";
  el.innerHTML = `
    <div class="panel settings-panel">
      <div class="set-head"><div class="h1">SETTINGS</div><div class="seg set-tabs" role="tablist"><button class="on" data-nav data-tab="game" role="tab">GAME</button><button data-nav data-tab="save" role="tab">SAVE DATA</button></div></div>
      <div class="set-game">
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
      ${canVibrate ? tog("haptics", "Vibration") : ""}
      ${tog("showFps", "Show FPS")}
      ${canFullscreen ? `<div class="set-row"><span>Fullscreen</span><button class="tog" data-nav data-fs aria-label="Fullscreen"></button></div>` : ""}
      </div>
      <div class="set-save" hidden>
        <p class="ss-note">Copy your save as text. Keep it somewhere safe. Somewhere SAFE.</p>
        <div class="ss-row"><button class="btn small cyan" data-nav data-act="export">⇪ EXPORT SAVE</button><span class="ss-msg" data-msg="export"></span></div>
        <textarea class="ss-text" data-ta="export" readonly hidden aria-label="Your save string"></textarea>
        <p class="ss-note">Paste a save string to load it. Your current profile is kept as a backup.</p>
        <textarea class="ss-text" data-ta="import" placeholder="KKO2.…" aria-label="Paste a save string"></textarea>
        <div class="ss-row"><button class="btn small violet" data-nav data-act="import">⇩ IMPORT SAVE</button><span class="ss-msg" data-msg="import"></span></div>
        <div class="ss-info"></div>
        <div class="ss-row"><button class="btn small danger" data-nav data-act="reset">✕ START OVER</button></div>
      </div>
      <div class="btn-row" style="margin-top:.6em"><button class="btn small" data-nav data-nav-default data-act="done">✓ DONE</button></div>
    </div>`;
  app.ui.appendChild(el);

  /** Apply a setting live; `persist` false while a slider is being dragged (saved on release). */
  const set = (k: Key, v: unknown, persist = true) => {
    (s as unknown as Record<string, unknown>)[k] = v;
    if (persist) save.save();
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
    for (const t of el.querySelectorAll<HTMLElement>(".tog[data-k]")) t.classList.toggle("on", !!s[t.dataset.k as Key]);
    el.querySelector(".tog[data-fs]")?.classList.toggle("on", !!document.fullscreenElement);
  };
  refresh();

  // sliders: drag / tap position
  for (const b of el.querySelectorAll<HTMLElement>(".slider")) {
    const k = b.dataset.k as Key;
    const apply = (e: PointerEvent) => {
      const r = b.getBoundingClientRect();
      const v = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 20) / 20;
      if (v !== s[k]) set(k, v, false);
    };
    let drag = false;
    const endDrag = () => {
      if (!drag) return;
      drag = false;
      save.save();
      app.sfx("uiMove");
    };
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
    b.addEventListener("pointerup", endDrag);
    // the OS took the touch (scroll, system gesture): stop dragging, keep what was set
    b.addEventListener("pointercancel", endDrag);
    b.addEventListener("lostpointercapture", endDrag);
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
  for (const t of el.querySelectorAll<HTMLElement>(".tog[data-k]"))
    onTap(t, () => {
      const k = t.dataset.k as Key;
      set(k, !s[k]);
      app.sfx("uiMove");
      if (k === "haptics" && s.haptics) app.input.haptic(30);
    });
  const fsBtn = el.querySelector<HTMLElement>(".tog[data-fs]");
  const onFs = () => refresh();
  if (fsBtn) {
    document.addEventListener("fullscreenchange", onFs);
    onTap(fsBtn, () => {
      app.sfx("uiMove");
      try {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      } catch {
        /* not allowed here */
      }
    });
  }
  // ---- tabs + save data
  const tabBtns = [...el.querySelectorAll<HTMLElement>("[data-tab]")];
  const showTab = (t: string) => {
    for (const b of tabBtns) b.classList.toggle("on", b.dataset.tab === t);
    (el.querySelector(".set-game") as HTMLElement).hidden = t !== "game";
    (el.querySelector(".set-save") as HTMLElement).hidden = t !== "save";
    if (t === "save") info();
    app.nav.refocus(L, tabBtns.find((b) => b.dataset.tab === t) ?? null);
  };
  for (const b of tabBtns)
    onTap(b, () => {
      app.sfx("tabSwitch");
      showTab(b.dataset.tab as string);
    });
  const msg = (k: string, text: string, ok = true) => {
    const m = el.querySelector(`[data-msg="${k}"]`) as HTMLElement;
    m.textContent = text;
    m.classList.toggle("bad", !ok);
  };
  const info = () => {
    const p = save.profile;
    const box = el.querySelector(".ss-info") as HTMLElement;
    box.innerHTML = `<span>Episodes aired: <b>${fmtInt(p.lifetime.runs)}</b></span><span>Clears: <b>${fmtInt(p.lifetime.clears)}</b></span><span>Started: <b>${p.info.created ? esc(new Date(p.info.created).toLocaleDateString()) : "a while ago"}</b></span>`;
  };
  onTap(el.querySelector('[data-act="export"]'), async () => {
    const text = save.exportString();
    const ta = el.querySelector('[data-ta="export"]') as HTMLTextAreaElement;
    ta.hidden = false;
    ta.value = text;
    let copied = false;
    try {
      await navigator.clipboard?.writeText(text);
      copied = !!navigator.clipboard;
    } catch {
      copied = false;
    }
    if (!copied) {
      ta.focus();
      ta.select();
    }
    app.sfx("uiConfirm");
    msg("export", copied ? "Copied! Paste it somewhere SAFE." : "Select the text below and copy it.");
  });
  onTap(el.querySelector('[data-act="import"]'), async () => {
    const ta = el.querySelector('[data-ta="import"]') as HTMLTextAreaElement;
    const text = ta.value.trim();
    if (!text) {
      app.sfx("uiDeny");
      msg("import", "Paste a save string first.", false);
      return;
    }
    const ok = await confirmDialog(app, { title: "Load this save?", body: "Your current profile is replaced (and kept as a backup on this device).", ok: "LOAD IT", danger: true });
    if (!ok) return;
    const r = save.importString(text);
    msg("import", r.message, r.ok);
    if (r.ok) {
      app.sfx("unlockFanfare");
      ta.value = "";
      app.applySettings();
      refresh();
      info();
    } else app.sfx("uiDeny");
  });
  onTap(el.querySelector('[data-act="reset"]'), async () => {
    const a = await confirmDialog(app, { title: "Start over?", body: "Every coin, gem, hero level, relic and record goes. Settings stay. (A backup of this profile is kept on this device.)", ok: "START OVER", danger: true });
    if (!a) return;
    const b = await confirmDialog(app, { title: "Really really?", body: "Episode 1 again. The plushies will be thrilled.", ok: "YES, RESET", cancel: "No, I'm invested", danger: true });
    if (!b) return;
    save.reset();
    app.sfx("reroll");
    msg("import", "Fresh profile. Welcome to Episode 1!");
    info();
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
      document.removeEventListener("fullscreenchange", onFs);
      el.classList.add("out");
      setTimeout(() => el.remove(), 220);
    },
  };
}
