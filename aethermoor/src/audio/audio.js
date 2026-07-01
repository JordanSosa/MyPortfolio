// All audio synthesized at runtime with WebAudio: zone music + rarity-scaled SFX.

import { G } from "../core/state.js";
import { on } from "../core/events.js";

let ctx = null, master, musicGain, sfxGain;
let muted = false;
let started = false;

const THEMES = {
  town:   { bpm: 92,  root: 261.63, scale: [0, 2, 4, 7, 9], padLevel: 0.05, pluck: "triangle", bright: 1 },
  meadow: { bpm: 104, root: 293.66, scale: [0, 2, 4, 7, 9], padLevel: 0.045, pluck: "triangle", bright: 1.1 },
  forest: { bpm: 88,  root: 220.0,  scale: [0, 3, 5, 7, 10], padLevel: 0.055, pluck: "sine", bright: 0.8 },
  ruins:  { bpm: 80,  root: 196.0,  scale: [0, 2, 3, 7, 8], padLevel: 0.06, pluck: "sine", bright: 0.7 },
  boss:   { bpm: 128, root: 174.61, scale: [0, 1, 5, 6, 8], padLevel: 0.07, pluck: "sawtooth", bright: 0.9 },
};
// simple I–vi–IV–V-ish movement as scale-degree offsets per bar
const PROG = [0, -3, 3, 2];

let themeId = "town";
let nextNoteAt = 0, step = 0;

export function initAudio() {
  on("sfx", playSfx);
  on("toggleMute", () => {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.85;
    try { localStorage.setItem("aethermoor-muted", muted ? "1" : "0"); } catch { /* noop */ }
  });
}

export function startAudio() {
  if (started) return;
  started = true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  master = ctx.createGain();
  muted = (() => { try { return localStorage.getItem("aethermoor-muted") === "1"; } catch { return false; } })();
  master.gain.value = muted ? 0 : 0.85;
  master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.75; sfxGain.connect(master);
  nextNoteAt = ctx.currentTime + 0.1;
  setInterval(scheduleMusic, 90);
}

// ---------------- music sequencer ----------------
function currentTheme() {
  const boss = G.mobs.find((m) => m.species?.boss && !m.dead && m.state === "aggro");
  if (boss) return "boss";
  const z = G.currentZone || "town";
  if (z === "hollow") return "boss";
  return THEMES[z] ? z : "meadow";
}

function scheduleMusic() {
  if (!ctx || G.paused) return;
  const want = currentTheme();
  if (want !== themeId) themeId = want;
  const th = THEMES[themeId];
  const stepDur = 60 / th.bpm / 2; // 8th notes

  while (nextNoteAt < ctx.currentTime + 0.25) {
    const t = nextNoteAt;
    const bar = Math.floor(step / 8) % PROG.length;
    const chordRoot = PROG[bar];
    const deg = (i) => {
      const idx = ((i % th.scale.length) + th.scale.length) % th.scale.length;
      const oct = Math.floor(i / th.scale.length);
      return th.root * Math.pow(2, (th.scale[idx] + chordRoot) / 12 + oct);
    };

    // bass on beats
    if (step % 4 === 0) tone(t, deg(-5) / 2, stepDur * 3.6, "sine", 0.14, musicGain);
    // pad at bar start
    if (step % 8 === 0) {
      for (const iv of [0, 2, 4]) pad(t, deg(iv), stepDur * 8, th.padLevel);
    }
    // melody: sparse random walk
    if (step % 2 === 0 && Math.random() < (themeId === "boss" ? 0.85 : 0.62)) {
      melodyDeg += Math.floor(Math.random() * 5) - 2;
      melodyDeg = Math.max(0, Math.min(9, melodyDeg));
      tone(t, deg(melodyDeg) * th.bright, stepDur * 1.7, th.pluck, 0.11, musicGain);
    }
    // hat tick
    if (themeId === "boss" && step % 2 === 1) noiseHit(t, 0.03, 6000, 0.05);

    step++;
    nextNoteAt += stepDur;
  }
}
let melodyDeg = 4;

function tone(t, freq, dur, type, vol, dest, slideTo = null) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(dest || sfxGain);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function pad(t, freq, dur, vol) {
  if (!ctx) return;
  for (const det of [-4, 4]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 900;
    o.type = "sawtooth";
    o.frequency.value = freq;
    o.detune.value = det;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f).connect(g).connect(musicGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

function noiseHit(t, dur, freq, vol, dest) {
  if (!ctx) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(dest || sfxGain);
  src.start(t);
}

// ---------------- SFX ----------------
const RARITY_NOTES = {
  normal: [523], uncommon: [523, 659], rare: [523, 659, 784],
  epic: [523, 659, 784, 1047], legendary: [523, 659, 784, 1047, 1319], unique: [440, 554, 659, 880, 1109, 1319],
};

function playSfx(e) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  switch (e.type) {
    case "hit": {
      const base = { phys: 220, fire: 300, cold: 700, light: 900 }[e.element] || 220;
      noiseHit(t, 0.08, 1200, 0.16);
      tone(t, base * (e.crit ? 1.5 : 1), 0.12, e.element === "phys" ? "square" : "triangle", e.crit ? 0.16 : 0.09, sfxGain, base * 0.5);
      if (e.crit) tone(t + 0.03, base * 2.2, 0.12, "triangle", 0.1, sfxGain);
      break;
    }
    case "auto": noiseHit(t, 0.05, e.tags?.includes("melee") ? 900 : 2400, 0.08); break;
    case "cast": tone(t, 500, 0.14, "sine", 0.07, sfxGain, 900); break;
    case "impact": noiseHit(t, 0.2, 400, 0.2); tone(t, 130, 0.25, "sine", 0.15, sfxGain, 60); break;
    case "mobshoot": tone(t, 700, 0.12, "sine", 0.06, sfxGain, 350); break;
    case "hurt": tone(t, 180, 0.12, "square", 0.08, sfxGain, 120); break;
    case "die": tone(t, 300, 0.8, "sawtooth", 0.14, sfxGain, 60); break;
    case "mobdie":
      tone(t, 400, 0.2, "square", 0.08, sfxGain, 150);
      if (e.boss) { for (let i = 0; i < 5; i++) tone(t + i * 0.12, 200 + i * 100, 0.3, "sawtooth", 0.1, sfxGain); }
      break;
    case "loot": {
      const notes = RARITY_NOTES[e.rarity] || RARITY_NOTES.normal;
      notes.forEach((f, i) => tone(t + i * 0.07, f, 0.18, "triangle", 0.1, sfxGain));
      break;
    }
    case "levelup": [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(t + i * 0.09, f, 0.25, "triangle", 0.13, sfxGain)); break;
    case "quest": [659, 784].forEach((f, i) => tone(t + i * 0.1, f, 0.2, "triangle", 0.1, sfxGain)); break;
    case "questdone": [523, 659, 784, 659, 1047].forEach((f, i) => tone(t + i * 0.09, f, 0.22, "triangle", 0.12, sfxGain)); break;
    case "potion": tone(t, 700, 0.2, "sine", 0.09, sfxGain, 1100); break;
    case "coin": tone(t, 1200, 0.08, "triangle", 0.09, sfxGain); tone(t + 0.05, 1500, 0.1, "triangle", 0.08, sfxGain); break;
    case "equip": noiseHit(t, 0.06, 800, 0.1); tone(t, 350, 0.1, "triangle", 0.07, sfxGain); break;
    case "craft": {
      tone(t, 900, 0.1, "sine", 0.1, sfxGain, 1400);
      const notes = RARITY_NOTES[e.rarity] || RARITY_NOTES.normal;
      notes.slice(0, 3).forEach((f, i) => tone(t + 0.08 + i * 0.06, f, 0.15, "triangle", 0.08, sfxGain));
      break;
    }
    case "allocate": tone(t, 800, 0.15, "sine", 0.1, sfxGain, 1200); break;
    case "ui": tone(t, 900, 0.05, "sine", 0.04, sfxGain); break;
    case "error": tone(t, 200, 0.15, "square", 0.06, sfxGain, 150); break;
    case "bossroar": tone(t, 90, 0.7, "sawtooth", 0.18, sfxGain, 55); noiseHit(t, 0.5, 300, 0.14); break;
  }
}
