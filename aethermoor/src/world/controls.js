// Input & camera: WASD movement, click-to-move, orbit camera, tab-targeting,
// clicking mobs/NPCs/ground, hotkeys.

import * as THREE from "three";
import { G, classOf, unlockedSkills } from "../core/state.js";
import { emit } from "../core/events.js";
import { terrainHeight, ISLAND_R } from "./scene.js";
import { useSkill, usePotion, livingMobs, autoAttackRange } from "../systems/combat.js";
import { vacuumLoot, pickupDrop } from "./entities.js";

const keys = new Set();
const cam = { yaw: Math.PI, pitch: 0.52, dist: 13 };
let dragging = false, dragBtn = 0, dragMoved = 0, lastX = 0, lastY = 0;
const ray = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2();

export function initControls(canvas) {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; dragBtn = e.button; dragMoved = 0;
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    if (dragMoved > 6) {
      cam.yaw -= dx * 0.008;
      cam.pitch = Math.max(0.15, Math.min(1.25, cam.pitch + dy * 0.005));
    }
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    if (dragMoved <= 6 && e.button === 0) handleClick(e);
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => {
    cam.dist = Math.max(5, Math.min(32, cam.dist + Math.sign(e.deltaY) * 1.6));
  }, { passive: true });
}

function handleClick(e) {
  mouseNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(mouseNdc, G.three.camera);
  const hits = ray.intersectObjects(G.three.pickables, true);
  for (const h of hits) {
    let o = h.object;
    while (o) {
      if (o.userData.mob && !o.userData.mob.dead) {
        setTarget(o.userData.mob);
        return;
      }
      if (o.userData.npc) {
        const npc = G.npcs.find((n) => n.id === o.userData.npc.id);
        if (npc && Math.hypot(npc.pos.x - G.player.pos.x, npc.pos.z - G.player.pos.z) < 6) emit("npcInteract", npc);
        else { G.moveTarget = { x: npc.pos.x, z: npc.pos.z - 2, npc: npc.id }; }
        return;
      }
      o = o.parent;
    }
  }
  // ground click -> move
  const terrainHit = hits.find((h) => h.object.name === "terrain");
  if (terrainHit && !G.dead) {
    G.moveTarget = { x: terrainHit.point.x, z: terrainHit.point.z };
    emit("moveMarker", G.moveTarget);
  }
}

export function setTarget(mob) {
  G.target = mob;
  emit("targetChanged");
  emit("sfx", { type: "ui" });
}

function cycleTarget() {
  const p = G.player.pos;
  const candidates = livingMobs()
    .filter((m) => Math.hypot(m.pos.x - p.x, m.pos.z - p.z) < 45)
    .sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z));
  if (!candidates.length) return;
  const idx = candidates.indexOf(G.target);
  setTarget(candidates[(idx + 1) % candidates.length]);
}

function onKeyDown(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  keys.add(e.code);
  if (e.code === "Tab") { e.preventDefault(); if (!G.dead) cycleTarget(); return; }
  if (G.uiBlocked) { if (e.code === "Escape") emit("escape"); return; }

  switch (e.code) {
    case "Digit1": case "Digit2": case "Digit3": case "Digit4": case "Digit5": case "Digit6": {
      const idx = Number(e.code.slice(5)) - 1;
      const sks = unlockedSkills();
      if (sks[idx] && !G.dead) useSkill(sks[idx].id);
      break;
    }
    case "KeyQ": usePotion("hp_potion"); break;
    case "KeyE": usePotion("mp_potion"); break;
    case "KeyZ": vacuumLoot(); break;
    case "KeyR": G.autoAttack = !G.autoAttack; emit("hudDirty"); break;
    case "KeyB": emit("toggleWindow", "inventory"); break;
    case "KeyC": emit("toggleWindow", "character"); break;
    case "KeyK": emit("toggleWindow", "skills"); break;
    case "KeyP": emit("toggleWindow", "tree"); break;
    case "KeyL": emit("toggleWindow", "quests"); break;
    case "KeyH": emit("toggleWindow", "help"); break;
    case "KeyM": emit("toggleMute"); break;
    case "Escape": emit("escape"); break;
  }
}

export function tickControls(dt) {
  const p = G.player;
  if (G.dead) { G.playerMoving = false; return; }

  // chill slow from wisps
  const chillMult = (G.playerChillUntil || 0) > G.now && !G.stats.specials.has("juggernaut") ? 0.8 : 1;
  const speed = G.stats.moveSpd * chillMult;

  let ix = 0, iz = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) iz += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) iz -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;

  let moving = false;
  if (ix || iz) {
    G.moveTarget = null;
    const len = Math.hypot(ix, iz);
    ix /= len; iz /= len;
    // camera-relative: forward = away from camera
    const fwd = cam.yaw;
    const dx = Math.sin(fwd) * iz + Math.sin(fwd + Math.PI / 2) * ix;
    const dz = Math.cos(fwd) * iz + Math.cos(fwd + Math.PI / 2) * ix;
    tryMove(p, dx * speed * dt, dz * speed * dt);
    p.facing = Math.atan2(dx, dz);
    moving = true;
  } else if (G.moveTarget) {
    const dx = G.moveTarget.x - p.pos.x, dz = G.moveTarget.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) {
      const npcId = G.moveTarget.npc;
      G.moveTarget = null;
      if (npcId) {
        const npc = G.npcs.find((n) => n.id === npcId);
        if (npc) emit("npcInteract", npc);
      }
    } else {
      const s = Math.min(speed * dt, d);
      tryMove(p, (dx / d) * s, (dz / d) * s);
      p.facing = Math.atan2(dx, dz);
      moving = true;
    }
  } else if (G.autoAttack && G.target && !G.target.dead) {
    // walk into range like the classics
    const d = Math.hypot(G.target.pos.x - p.pos.x, G.target.pos.z - p.pos.z);
    const range = autoAttackRange();
    if (d > range - 0.4) {
      const dx = G.target.pos.x - p.pos.x, dz = G.target.pos.z - p.pos.z;
      tryMove(p, (dx / d) * speed * dt, (dz / d) * speed * dt);
      p.facing = Math.atan2(dx, dz);
      moving = true;
    }
  }
  G.playerMoving = moving;

  updateCamera();
}

function tryMove(p, dx, dz) {
  const nx = p.pos.x + dx, nz = p.pos.z + dz;
  const r = Math.hypot(nx, nz);
  if (r > ISLAND_R - 12) return;                 // stay on the island
  if (terrainHeight(nx, nz) < 0.25) return;      // don't swim
  p.pos.x = nx; p.pos.z = nz;
}

function updateCamera() {
  const { camera } = G.three;
  const p = G.player.pos;
  const py = terrainHeight(p.x, p.z);
  const cx = p.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const cz = p.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  let cy = py + Math.sin(cam.pitch) * cam.dist + 1.6;
  cy = Math.max(cy, terrainHeight(cx, cz) + 1.2);
  camera.position.set(cx, cy, cz);
  camera.lookAt(p.x, py + 1.8, p.z);
}
