// Aethermoor bootstrap: class select -> world spawn -> game loop.

import "./style.css";
import { G, newCharacter, load, save, wipeSave } from "./core/state.js";
import { CLASSES } from "./data/classes.js";
import { on, emit } from "./core/events.js";
import { computeStats, tickBuffs } from "./systems/stats.js";
import {
  tickMobs, tickProjectiles, tickTelegraphs, tickAutoAttack, tickRegen, awardXp,
} from "./systems/combat.js";
import { initScene, updateDayNight } from "./world/scene.js";
import {
  spawnAllMobs, spawnNpcs, spawnFakes, spawnPlayerMesh, initDomLayers, updateEntities,
} from "./world/entities.js";
import { initControls, tickControls } from "./world/controls.js";
import { initHud, updateHotbar, updateMinimap } from "./ui/hud.js";
import { initWindows } from "./ui/windows.js";
import { initAudio, startAudio } from "./audio/audio.js";

const canvas = document.getElementById("game");
initScene(canvas);
initDomLayers();
initAudio();
G.uiBlocked = true;
G.playing = false;
G.playerChillUntil = 0;

// quest XP rewards arrive via event to keep quests.js free of combat imports
on("awardXp", (amount) => awardXp(amount));
on("respawned", () => emit("hudDirty"));
on("bossKilled", () => {
  emit("chat", { channel: "system", text: "The Duskfang Alpha has fallen! Brightshore is saved — return to Captain Maren!" });
});

// ---------------- character select ----------------
const cs = document.getElementById("charselect");
const csClasses = document.getElementById("cs-classes");
const csName = document.getElementById("cs-name");
const csStart = document.getElementById("cs-start");
let chosenClass = null;

for (const cls of Object.values(CLASSES)) {
  const card = document.createElement("div");
  card.className = "cs-card";
  card.innerHTML = `
    <div class="cs-ico">${cls.icon}</div>
    <h3 style="color:${cls.uiColor}">${cls.name}</h3>
    <p>${cls.blurb}</p>
    <div class="cs-stats">STR ${cls.baseAttrs.str} · DEX ${cls.baseAttrs.dex} · INT ${cls.baseAttrs.int} · VIT ${cls.baseAttrs.vit}</div>`;
  card.addEventListener("click", () => {
    chosenClass = cls.id;
    document.querySelectorAll(".cs-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    csStart.disabled = false;
    if (!csName.value) csName.value = { blademaster: "Bram", arcanist: "Lyra", windrunner: "Fen" }[cls.id];
  });
  csClasses.appendChild(card);
}

const existing = load();
if (existing) {
  const cont = document.getElementById("cs-continue");
  cont.style.display = "block";
  const btn = document.getElementById("cs-continue-btn");
  btn.textContent = `▶ Continue: ${existing.name} — Lv ${existing.level} ${CLASSES[existing.classId].name}`;
  btn.addEventListener("click", () => beginGame(existing));
}

csStart.addEventListener("click", () => {
  if (!chosenClass) return;
  wipeSave();
  beginGame(newCharacter(chosenClass, csName.value.trim() || "Adventurer"));
});

function beginGame(player) {
  G.player = player;
  computeStats();
  if (player.hp <= 1) { player.hp = G.stats.maxHp; player.mp = G.stats.maxMp; }

  spawnPlayerMesh();
  spawnAllMobs();
  spawnNpcs();
  spawnFakes();
  initControls(canvas);
  initHud();
  initWindows();
  startAudio();

  cs.style.display = "none";
  G.uiBlocked = false;
  G.playing = true;

  emit("chat", { channel: "system", text: `Welcome to the Isle of Brightshore, ${player.name}!` });
  emit("chat", { channel: "system", text: "Captain Maren by the fountain has work for you — look for the ! marker. Press H for help." });
  emit("questsChanged");
  emit("hudDirty");
  save();
}

// ---------------- game loop ----------------
let last = performance.now();
let hudAcc = 0, mapAcc = 0, saveAcc = 0;

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  if (G.playing && !G.paused) {
    G.now += dt;
    G.player.playtime += dt;
    G.dayT = (G.dayT + dt / 600) % 1;

    tickControls(dt);
    tickAutoAttack();
    tickMobs(dt);
    tickProjectiles(dt);
    tickTelegraphs();
    tickRegen(dt);
    tickBuffs();
    updateEntities(dt);
    updateHotbar();

    hudAcc += dt;
    if (hudAcc > 0.5) { hudAcc = 0; emit("hudDirty"); }
    mapAcc += dt;
    if (mapAcc > 0.2) { mapAcc = 0; updateMinimap(); }
    saveAcc += dt;
    if (saveAcc > 10) { saveAcc = 0; save(); }
  }

  updateDayNight(G.dayT, dt);
  G.three.renderer.render(G.three.scene, G.three.camera);
}
requestAnimationFrame(frame);

// debug/testing handle
import * as actions from "./systems/actions.js";
import * as loot from "./systems/loot.js";
import * as questsSys from "./systems/quests.js";
window.__aether = { G, emit, actions, loot, quests: questsSys };

window.addEventListener("beforeunload", () => save());
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
