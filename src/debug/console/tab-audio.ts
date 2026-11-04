/**
 * Audio tab: AudioContext state, sample rate, base / output latency, lite / full profile, voices,
 * main-thread stress, skipped music notes, sfx budget drops, AudioContext.renderCapacity where the
 * browser has it; test sounds, music on / off, and the profile override for the next load.
 */
import { audio, audioInternals, audioStats, type MusicTrack, type SfxId } from "../../audio";
import { SONGS } from "../../audio/music/songs";
import { SFX } from "../../audio/sfx";
import { renderCap } from "../diag";
import type { ConsoleHost, Tab } from "./console";
import { btn, el, kv, row, sec, select, toast } from "./ui";

type RenderCapacity = EventTarget & { start(o?: { updateInterval?: number }): void; stop(): void };
interface CapEvent extends Event {
  averageLoad: number;
  peakLoad: number;
  underrunRatio: number;
}

let capOn = false;

function startCapacity(): string {
  const ctx = audioInternals().ctx as (AudioContext & { renderCapacity?: RenderCapacity }) | null;
  if (!ctx) return "no AudioContext yet (tap anywhere to unlock audio)";
  const rc = ctx.renderCapacity;
  if (!rc) return "renderCapacity: not exposed by this browser";
  if (capOn) return "renderCapacity: on";
  capOn = true;
  rc.addEventListener("update", (e) => {
    const c = e as CapEvent;
    renderCap.avg = c.averageLoad;
    renderCap.peak = c.peakLoad;
    renderCap.underrun = c.underrunRatio;
    renderCap.at = performance.now();
  });
  rc.start({ updateInterval: 1 });
  return "renderCapacity: on";
}

const ms = (s: number | null) => (s == null ? "n/a" : `${(s * 1000).toFixed(1)} ms`);

export function audioTab(h: ConsoleHost): Tab {
  const app = h.app;
  const root = el("div");
  root.append(sec("context"));
  const info = kv();
  root.append(info.el);
  const capNote = el("div", "kkd-note");
  root.append(capNote);

  root.append(sec("test"));
  const sfxSel = select(Object.keys(SFX).sort(), "uiConfirm");
  root.append(
    row(
      sfxSel,
      btn("PLAY", () => {
        app.unlockAudio();
        audio.sfx(sfxSel.value as SfxId, { vol: 1 });
      }),
    ),
  );
  const tracks = Object.keys(SONGS) as Exclude<MusicTrack, "none">[];
  const musSel = select(tracks, "battle");
  root.append(
    row(
      musSel,
      btn("MUSIC", () => {
        app.unlockAudio();
        audio.music(musSel.value as MusicTrack, 0.5);
      }),
      btn("STOP", () => audio.music("none", 0.3), "sm"),
      btn("UNLOCK / RESUME", () => {
        app.unlockAudio();
        audio.resume();
      }, "sm"),
    ),
  );

  root.append(sec("profile (next load)"));
  const reload = (v: string | null) => {
    const u = new URL(location.href);
    if (v) u.searchParams.set("audio", v);
    else u.searchParams.delete("audio");
    try {
      location.assign(u.toString());
    } catch {
      toast("reload blocked here: add ?audio=lite or ?audio=full to the URL");
    }
  };
  root.append(row(btn("RELOAD LITE", () => reload("lite")), btn("RELOAD FULL", () => reload("full")), btn("AUTO", () => reload(null), "sm")));
  root.append(el("div", "kkd-note", "lite = phones: 24 kHz, 'playback' latency, 12 voices, no music reverb. The override rides on ?audio= (src/audio/index.ts wantLite)."));

  return {
    id: "audio",
    label: "Audio",
    el: root,
    show() {
      capNote.textContent = startCapacity();
    },
    update() {
      const a = audioStats();
      const rc = renderCap.at >= 0 ? `avg ${(renderCap.avg * 100).toFixed(0)}% · peak ${(renderCap.peak * 100).toFixed(0)}% · underrun ${(renderCap.underrun * 100).toFixed(1)}%` : "n/a";
      info.set([
        ["state", `${a.state}${a.wantSuspended ? " (suspend requested)" : ""}${a.unlocked ? "" : " · never ran"}`],
        ["rate", a.sampleRate ? `${a.sampleRate} Hz` : "-"],
        ["latency", `base ${ms(a.baseLatency)} · out ${ms(a.outputLatency)}`],
        ["profile", `${a.lite ? "LITE (phone)" : "FULL"} · lookahead ${a.lookahead.toFixed(2)} s`],
        ["voices", `${a.voices} / ${a.maxVoices}`],
        ["stress", a.stress.toFixed(2)],
        ["skipped notes", a.skippedNotes],
        ["sfx", `${a.started} voices started · ${a.budgetDrops} dropped by the budget`],
        ["music", `${a.track}${a.muffled ? " (muffled)" : ""}`],
        ["renderCap", rc],
      ]);
    },
  };
}
