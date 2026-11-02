/**
 * Audio test bench (tools/audio.html): buttons for every sfx and track, an
 * intensity slider, muffle / duck / suspend toggles, volume sliders and a live
 * scope + status line. Also exposes `window.__audioRender` for
 * scripts/audio-render.mjs (offline rendering through the same engine).
 */
import { audio, audioInternals, type MusicTrack, type SfxId } from "../src/audio/index";
import {
  analyzeTrack,
  renderChaos,
  renderSfx,
  renderSpam,
  renderTrack,
  SFX_IDS,
  stats,
  toBase64,
  TRACKS,
  trimmed,
  wavBytes,
  type TrackRenderOpts,
} from "../src/audio/render";

const GROUPS: [string, SfxId[]][] = [
  ["UI", ["uiMove", "uiConfirm", "uiBack", "uiDeny", "cardFlip", "cardPick", "reroll", "countTick"]],
  ["Player", ["dash", "playerHurt", "playerDie", "heal", "levelUp", "evolve", "revive", "ultReady", "ultCutin", "ultBlast", "voiceBlip"]],
  ["Pickups", ["gem", "coin", "magnet", "chestDrop", "chestOpen", "chestReel", "chestJackpot", "food", "powerup"]],
  ["Combat", ["hit", "hitCrit", "enemyDie", "eliteDie", "bossHit", "bossDie", "explosion", "explosionBig", "thunder", "enemyShoot", "telegraph", "freeze", "propBreak"]],
  ["Weapons", ["starShot", "slash", "boomerang", "bell", "candyThrow", "bubblePop", "beam", "beamBig", "meow", "orbitHit"]],
  ["Events", ["warning", "bossRoar", "comboUp", "comboBreak", "rankUp", "waveIncoming", "victory", "gameOver"]],
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const num = (id: string) => Number($<HTMLInputElement>(id).value);

function bindRange(id: string, fmt: (v: number) => string, on: (v: number) => void): void {
  const el = $<HTMLInputElement>(id);
  const out = $(id + "V");
  const upd = () => {
    const v = Number(el.value);
    out.textContent = fmt(v);
    on(v);
  };
  el.addEventListener("input", upd);
  upd();
}

let selectedTrack: MusicTrack = "none";
let lastSfx: SfxId = "hit";
let muffled = false;
let suspended = false;

function unlock(): void {
  audio.unlock();
  $("unlock").textContent = "audio on";
  applyVolumes();
}

function applyVolumes(): void {
  audio.setVolumes({ master: num("vm"), music: num("vmu"), sfx: num("vs") });
}

function play(id: SfxId): void {
  unlock();
  lastSfx = id;
  $("spam").textContent = `spam ${id} ×20 (rate-limit test)`;
  audio.sfx(id, { pitch: num("pitch"), pan: num("pan"), vol: num("vol") });
}

function buildUi(): void {
  $("unlock").addEventListener("click", unlock);
  const tr = $("tracks");
  for (const t of ["none", ...TRACKS] as MusicTrack[]) {
    const b = document.createElement("button");
    b.className = "track";
    b.textContent = t;
    b.addEventListener("click", () => {
      unlock();
      selectedTrack = t;
      audio.music(t, num("fade"));
      for (const c of tr.children) c.classList.toggle("on", c === b);
    });
    tr.appendChild(b);
  }
  const box = $("sfx");
  for (const [name, ids] of GROUPS) {
    const g = document.createElement("div");
    g.className = "grp row";
    g.innerHTML = `<b>${name}</b>`;
    for (const id of ids) {
      const b = document.createElement("button");
      b.textContent = id;
      b.addEventListener("click", () => play(id));
      g.appendChild(b);
    }
    box.appendChild(g);
  }
  bindRange("fade", (v) => v.toFixed(1), () => {});
  bindRange("inten", (v) => v.toFixed(2), (v) => audio.setIntensity(v));
  bindRange("pitch", (v) => String(v), () => {});
  bindRange("pan", (v) => v.toFixed(1), () => {});
  bindRange("vol", (v) => v.toFixed(2), () => {});
  for (const id of ["vm", "vmu", "vs"]) bindRange(id, (v) => v.toFixed(2), () => applyVolumes());
  $("muffle").addEventListener("click", (e) => {
    muffled = !muffled;
    audio.setMuffled(muffled);
    (e.currentTarget as HTMLElement).classList.toggle("on", muffled);
  });
  $("duck").addEventListener("click", () => audio.duck(0.65, 1.3));
  $("susp").addEventListener("click", (e) => {
    suspended = !suspended;
    if (suspended) audio.suspend();
    else audio.resume();
    (e.currentTarget as HTMLElement).classList.toggle("on", suspended);
  });
  $("spam").addEventListener("click", () => {
    unlock();
    const id = lastSfx;
    for (let i = 0; i < 20; i++) setTimeout(() => audio.sfx(id, { pitch: (Math.random() * 4 - 2) | 0, pan: Math.random() * 1.6 - 0.8 }), i * 8);
  });
  $("chain").addEventListener("click", () => {
    unlock();
    for (let i = 0; i < 12; i++) setTimeout(() => audio.sfx("gem", { pitch: Math.min(14, i * 0.6 * 2), vol: 0.5 }), i * 70);
  });
  $("chaos").addEventListener("click", () => {
    unlock();
    const ids: SfxId[] = ["hit", "hitCrit", "enemyDie", "gem", "starShot", "slash", "orbitHit", "explosion", "bubblePop", "coin"];
    const t0 = performance.now();
    const iv = setInterval(() => {
      for (let j = 0; j < 3; j++) audio.sfx(ids[(Math.random() * ids.length) | 0], { pitch: (Math.random() * 6) | 0, pan: Math.random() * 1.6 - 0.8, vol: 0.7 });
      if (performance.now() - t0 > 4000) clearInterval(iv);
    }, 16);
  });
}

// ------------------------------------------------------------------ scope + status
let analyser: AnalyserNode | null = null;
const scopeBuf = new Float32Array(2048);
function frame(): void {
  requestAnimationFrame(frame);
  const { ctx, engine } = audioInternals();
  const cv = $<HTMLCanvasElement>("scope");
  const g = cv.getContext("2d");
  if (engine && !analyser) analyser = engine.tap(2048);
  if (g) {
    const w = cv.width, h = cv.height;
    g.fillStyle = "#1a1129";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#4b3470";
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();
    if (analyser) {
      analyser.getFloatTimeDomainData(scopeBuf);
      g.strokeStyle = "#ff8fc8";
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i < scopeBuf.length; i++) {
        const x = (i / scopeBuf.length) * w;
        const y = h / 2 - scopeBuf[i] * (h / 2) * 0.95;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
  }
  const red = engine?.reduction;
  $("status").textContent = ctx
    ? `ctx ${ctx.state} · ${ctx.sampleRate} Hz · t ${ctx.currentTime.toFixed(1)} s · voices ${engine?.activeVoices ?? 0} · track ${selectedTrack} [${engine?.section ?? ""}] · comp ${red?.comp.toFixed(1)} dB · lim ${red?.limiter.toFixed(1)} dB`
    : "audio locked (tap the button)";
}

// ------------------------------------------------------------------ offline API for scripts/audio-render.mjs
async function pack(buf: AudioBuffer, trim: boolean) {
  const s = stats(buf);
  const out = trim ? trimmed(buf, s.audible) : buf;
  return { stats: s, wav: toBase64(wavBytes(out)) };
}

declare global {
  interface Window {
    __audioRender: unknown;
  }
}

window.__audioRender = {
  sfxIds: SFX_IDS,
  tracks: TRACKS,
  sfx: async (id: SfxId, pitch = 0) => pack(await renderSfx(id, { pitch }), true),
  spam: async (id: SfxId, count: number, every: number) => {
    const r = await renderSpam(id, count, every);
    return { ...(await pack(r.buf, true)), played: r.played };
  },
  chaos: async (seconds: number) => pack(await renderChaos(seconds), false),
  track: async (track: Exclude<MusicTrack, "none">, o: TrackRenderOpts) => pack(await renderTrack(track, o), false),
  analyze: (track: Exclude<MusicTrack, "none">) => analyzeTrack(track),
};

// realtime smoke-test hooks (scripts/audio-render.mjs --live)
const liveBuf = new Float32Array(2048);
let liveTap: AnalyserNode | null = null;
(window as unknown as { __audioLive: unknown }).__audioLive = {
  unlocked: () => audio.unlocked,
  state: () => audioInternals().ctx?.state ?? "none",
  /** perform an action, then measure output level over `ms` */
  async run(action: string, ms: number) {
    for (const a of action.split("|")) {
      const [k, v] = a.split(":");
      if (k === "music") audio.music(v as MusicTrack, 1);
      else if (k === "int") audio.setIntensity(Number(v));
      else if (k === "muffle") audio.setMuffled(v === "1");
      else if (k === "duck") audio.duck(0.65, 1.3);
      else if (k === "suspend") audio.suspend();
      else if (k === "resume") audio.resume();
      else if (k === "burst") {
        const ids: SfxId[] = ["hit", "enemyDie", "gem", "explosion", "levelUp", "coin", "slash", "starShot"];
        for (let i = 0; i < 60; i++) setTimeout(() => audio.sfx(ids[i % ids.length], { pitch: i % 7 }), i * 10);
      }
    }
    const { ctx, engine } = audioInternals();
    if (engine && !liveTap) liveTap = engine.tap(2048);
    let peak = 0, sum = 0, n = 0, voices = 0;
    const t0 = performance.now();
    await new Promise<void>((res) => {
      const iv = setInterval(() => {
        if (liveTap) {
          liveTap.getFloatTimeDomainData(liveBuf);
          for (const x of liveBuf) {
            const a = Math.abs(x);
            if (a > peak) peak = a;
            sum += x * x;
            n++;
          }
        }
        voices = Math.max(voices, engine?.activeVoices ?? 0);
        if (performance.now() - t0 >= ms) {
          clearInterval(iv);
          res();
        }
      }, 40);
    });
    const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);
    return { state: ctx?.state ?? "none", rmsDb: db(Math.sqrt(sum / Math.max(1, n))), peakDb: db(peak), voices, section: engine?.section ?? "" };
  },
};

buildUi();
frame();
document.body.dataset.ready = "1";
