// Entities: player/mob/NPC/fake-adventurer meshes, ground loot, projectiles,
// telegraphs, hit FX, DOM nameplates and floating combat text.

import * as THREE from "three";
import { G, bagAdd } from "../core/state.js";
import { CLASSES } from "../data/classes.js";
import { SPECIES, SPAWN_ZONES } from "../data/mobs.js";
import { FAKE_NAMES } from "../data/names.js";
import { RARITIES } from "../data/items.js";
import { rng } from "../core/rng.js";
import { on, emit } from "../core/events.js";
import { terrainHeight } from "./scene.js";
import { toon, glowTexture } from "./toon.js";
import { mobMaxHp } from "../systems/combat.js";
import { availableFrom, turninsFor } from "../systems/quests.js";

const ELEM_HEX = { phys: 0xd8d8e0, fire: 0xff7a45, cold: 0x7ad4ff, light: 0xffe45c, poison: 0x8fd45c };

// ---------------- mesh builders ----------------
const lam = toon; // cel-shaded everywhere

const castAll = (g) => {
  g.traverse((o) => { if (o.isMesh && !o.userData.noShadow) o.castShadow = true; });
  return g;
};

// Big anime eyes with highlights + blush — the chibi face kit.
function addFace(g, y, z, s = 1, eyeHex = 0x2a2438) {
  const eyeMat = lam(eyeHex);
  const hiMat = toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
  const blushMat = toon(0xf59aa8, { transparent: true, opacity: 0.85 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105 * s, 8, 8), eyeMat);
    eye.position.set(0.19 * s * side, y, z);
    eye.scale.set(0.8, 1.25, 0.55);
    eye.userData.noShadow = true;
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 6, 6), hiMat);
    hi.position.set(0.19 * s * side - 0.035 * s, y + 0.045 * s, z + 0.05 * s);
    hi.userData.noShadow = true;
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 6, 6), blushMat);
    blush.position.set(0.3 * s * side, y - 0.12 * s, z - 0.03 * s);
    blush.scale.set(1, 0.55, 0.35);
    blush.userData.noShadow = true;
    g.add(eye, hi, blush);
  }
}

export function buildWeapon(weaponType) {
  const weapon = new THREE.Group();
  if (weaponType === "sword") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.24), toon(0xe8edf8, { emissive: 0x8899bb, emissiveIntensity: 0.15 }));
    blade.position.y = 0.68;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.25, 4), toon(0xe8edf8));
    tip.position.y = 1.35;
    tip.rotation.y = Math.PI / 4;
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.12), lam(0xe8b845));
    hilt.position.y = 0.12;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), lam(0xe8b845));
    pommel.position.y = -0.05;
    weapon.add(blade, tip, hilt, pommel);
  } else if (weaponType === "staff") {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 7), lam(0x8a6444));
    const cradle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 6, 12), lam(0xe8b845));
    cradle.position.y = 0.95;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(0x9f8ff8, { emissive: 0x7f5fe5, emissiveIntensity: 1 }));
    orb.position.y = 0.95;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("#b8a4ff"), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
    glow.position.y = 0.95;
    glow.scale.set(0.9, 0.9, 1);
    weapon.add(shaft, cradle, orb, glow);
  } else if (weaponType === "bow") {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.05, 6, 14, Math.PI), lam(0xa87b4f));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6), lam(0xe8b845));
    weapon.add(arc, grip);
  }
  return weapon;
}

export function buildHumanoid(bodyHex, headHex, weaponType, scale = 1, accentHex = 0x333344, opts = {}) {
  const g = new THREE.Group();

  // chibi: squat egg body, oversized head
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 10), lam(bodyHex));
  body.position.y = 0.62;
  body.scale.set(0.95, 1.15, 0.85);
  // little trim collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 14), lam(accentHex));
  collar.position.y = 1.02;
  collar.rotation.x = Math.PI / 2;
  // feet
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lam(0x6e5138));
    foot.position.set(0.2 * side, 0.12, 0.06);
    foot.scale.set(1, 0.7, 1.3);
    g.add(foot);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), lam(headHex));
  head.position.y = 1.62;
  head.scale.set(1, 0.95, 0.95);
  addFace(g, 1.62, 0.5, 1);

  // hair: cap + swept spikes
  const hairMat = lam(accentHex);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 9, 0, Math.PI * 2, 0, Math.PI / 1.9), hairMat);
  hair.position.y = 1.72;
  hair.scale.set(1, 0.9, 1);
  g.add(hair);
  if (opts.spikes !== false) {
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 6), hairMat);
      const a = (i / 5) * Math.PI * 1.7 + 0.7;
      spike.position.set(Math.sin(a) * 0.42, 2.06 + (i % 2) * 0.06, Math.cos(a) * 0.42 - 0.12);
      spike.rotation.set(Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7);
      spike.userData.noShadow = true;
      g.add(spike);
    }
  }
  g.add(body, collar, head);

  let weapon = null;
  if (weaponType) {
    weapon = buildWeapon(weaponType);
    weapon.position.set(0.6, weaponType === "bow" ? 0.85 : 0.75, weaponType === "bow" ? 0.15 : 0.1);
    if (weaponType === "sword") weapon.rotation.z = -0.35;
    if (weaponType === "bow") weapon.rotation.z = Math.PI / 2;
  }
  if (weapon) g.add(weapon);
  g.userData.weapon = weapon;

  // soft blob shadow (real shadows layer on top)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1e3020, transparent: true, opacity: 0.22 }));
  shadow.position.y = 0.05;
  shadow.userData.noShadow = true;
  g.add(shadow);
  g.scale.setScalar(scale);
  return castAll(g);
}

function buildMobMesh(sp) {
  const g = new THREE.Group();
  const s = sp.size;
  if (sp.shape === "puff") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), lam(sp.color));
    body.position.y = 0.55;
    // fluff tufts
    for (let i = 0; i < 4; i++) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lam(sp.accent));
      const a = i * 1.9;
      tuft.position.set(Math.sin(a) * 0.42, 0.85 + (i % 2) * 0.14, Math.cos(a) * 0.38 - 0.15);
      tuft.userData.noShadow = true;
      g.add(tuft);
    }
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 7), lam(sp.accent));
      ear.position.set(0.3 * side, 1.15, 0);
      ear.rotation.z = -side * 0.25;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), lam(0xffe0ee));
      inner.position.set(0.3 * side, 1.1, 0.06);
      inner.rotation.z = -side * 0.25;
      inner.userData.noShadow = true;
      g.add(ear, inner);
    }
    addFace(g, 0.62, 0.5, 0.95);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), lam(0xffffff));
    tail.position.set(0, 0.5, -0.55);
    g.add(body, tail);
  } else if (sp.shape === "boar") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), lam(sp.color));
    body.position.y = 0.72;
    body.scale.set(1, 0.85, 1.15);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lam(0xd89aa0));
    snout.position.set(0, 0.55, 0.92);
    snout.scale.set(1.15, 0.8, 0.7);
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), lam(0x8a5560));
      nostril.position.set(0.09 * side, 0.55, 1.1);
      nostril.userData.noShadow = true;
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), lam(sp.accent));
      ear.position.set(0.4 * side, 1.28, 0.2);
      ear.rotation.z = -side * 0.5;
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 6), lam(0xfff3dd));
      tusk.position.set(0.28 * side, 0.5, 0.95);
      tusk.rotation.x = -1;
      g.add(nostril, ear, tusk);
      for (const fz of [-0.45, 0.45]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.55, 7), lam(sp.accent));
        leg.position.set(0.36 * side, 0.28, fz);
        g.add(leg);
      }
    }
    addFace(g, 0.88, 0.85, 0.9);
    const mane = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(sp.accent));
    mane.position.set(0, 1.05, -0.15);
    mane.scale.set(1.05, 0.8, 1.3);
    g.add(body, snout, mane);
  } else if (sp.shape === "shroom") {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 0.95, 10), lam(0xfff3dd));
    stem.position.y = 0.48;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 9, 0, Math.PI * 2, 0, Math.PI / 2), lam(sp.color));
    cap.position.y = 0.88;
    cap.scale.y = 0.8;
    const capRim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 8, 18), lam(sp.accent));
    capRim.position.y = 0.9;
    capRim.rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.1 + (i % 2) * 0.05, 6, 6), lam(0xfff6e8));
      const a = i * 1.7 + 0.4;
      spot.position.set(Math.sin(a) * 0.45, 1.12 + (i % 2) * 0.1, Math.cos(a) * 0.45);
      spot.userData.noShadow = true;
      g.add(spot);
    }
    addFace(g, 0.62, 0.44, 0.9);
    g.add(stem, cap, capRim);
  } else if (sp.shape === "wisp") {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), toon(sp.color, { emissive: sp.accent, emissiveIntensity: 1.4, transparent: true, opacity: 0.95 }));
    core.position.y = 1.3;
    core.userData.noShadow = true;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("#aee6ff"), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    glow.position.y = 1.3;
    glow.scale.set(2.4, 2.4, 1);
    // little trailing flames
    for (let i = 0; i < 3; i++) {
      const wispTail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 6), toon(sp.accent, { emissive: sp.accent, emissiveIntensity: 1, transparent: true, opacity: 0.7 }));
      wispTail.position.set((i - 1) * 0.22, 0.95, -0.15);
      wispTail.rotation.x = Math.PI;
      wispTail.userData.noShadow = true;
      g.add(wispTail);
    }
    addFace(g, 1.36, 0.34, 0.8, 0x1a3448);
    g.add(core, glow);
  } else { // humanoid raiders/mystics — hooded, glowing eyes
    const inner = buildHumanoid(sp.color, sp.color, sp.id === "mystic" ? "staff" : "sword", 1, sp.accent, { spikes: false });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), toon(0xff5c5c, { emissive: 0xff3b30, emissiveIntensity: 1.5 }));
      eye.position.set(0.19 * side, 1.62, 0.54);
      eye.userData.noShadow = true;
      inner.add(eye);
    }
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.75, 9), lam(sp.accent));
    hood.position.y = 2.12;
    inner.add(hood);
    g.add(inner);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1e3020, transparent: true, opacity: 0.22 }));
  shadow.position.y = 0.04;
  shadow.userData.noShadow = true;
  g.add(shadow);
  g.scale.setScalar(s);
  return castAll(g);
}

// ---------------- spawn ----------------
let mobIdCounter = 1;

export function makeMob(speciesId, x, z, homeR) {
  const sp = SPECIES[speciesId];
  const level = rng.int(sp.lvl[0], sp.lvl[1]);
  const mob = {
    id: mobIdCounter++, species: sp, level,
    maxHp: mobMaxHp(sp, level), hp: mobMaxHp(sp, level),
    pos: { x, z }, spawn: { x, z }, homeR: homeR || 10, facing: rng.float(0, Math.PI * 2),
    state: "idle", statuses: { chill: 0, shock: 0, stun: 0, ignite: null }, dots: [],
    atkReady: 0, dead: false, respawnAt: 0, phase: 1, wanderTo: null, walkPhase: rng.float(0, 6), atkT: 0,
  };
  mob.mesh = buildMobMesh(sp);
  mob.mesh.userData.mob = mob;
  G.three.scene.add(mob.mesh);
  G.three.pickables.push(mob.mesh);
  G.mobs.push(mob);
  return mob;
}

export function spawnAllMobs() {
  for (const zone of SPAWN_ZONES) {
    for (let i = 0; i < zone.count; i++) {
      const a = rng.float(0, Math.PI * 2), r = Math.sqrt(rng.next()) * zone.r;
      makeMob(zone.species, zone.x + Math.sin(a) * r, zone.z + Math.cos(a) * r, zone.r);
    }
  }
}

export const NPCS = [
  { id: "maren", name: "Captain Maren", role: "Quartermaster", x: 6, z: 116, body: 0x3e5a8f, hair: 0xc9c2b8, weapon: "sword" },
  { id: "poppy", name: "Merchant Poppy", role: "Vendor", x: -9, z: 121, body: 0xc06a5a, hair: 0x8a4b2f, weapon: null },
  { id: "elowen", name: "Skill Sage Elowen", role: "Skill Sage", x: 17, z: 123, body: 0x9d78d1, hair: 0xf4a7c6, weapon: "staff" },
];

export function spawnNpcs() {
  for (const def of NPCS) {
    const mesh = buildHumanoid(def.body, 0xf5d3b3, def.weapon, 1.05, def.hair);
    mesh.position.set(def.x, terrainHeight(def.x, def.z), def.z);
    mesh.rotation.y = Math.PI;
    mesh.userData.npc = def;
    G.three.scene.add(mesh);
    G.three.pickables.push(mesh);
    // quest marker
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 64;
    const tex = new THREE.CanvasTexture(cv);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    marker.scale.set(1.1, 1.1, 1);
    marker.position.y = 2.9;
    mesh.add(marker);
    G.npcs.push({ ...def, pos: { x: def.x, z: def.z }, mesh, marker, markerCv: cv, markerTex: tex, sway: rng.float(0, 6) });
  }
  updateQuestMarkers();
  on("questsChanged", updateQuestMarkers);
  on("levelUp", updateQuestMarkers);
}

export function updateQuestMarkers() {
  for (const npc of G.npcs) {
    const ctx = npc.markerCv.getContext("2d");
    ctx.clearRect(0, 0, 64, 64);
    let glyph = null, color = "#ffd23e";
    if (turninsFor(npc.id).length) { glyph = "?"; color = "#ffd23e"; }
    else if (availableFrom(npc.id).length) { glyph = "!"; color = "#ffd23e"; }
    else {
      const pending = G.player && Object.entries(G.player.quests).some(([qid, s]) => s.status === "active");
      if (pending) { glyph = null; }
    }
    if (glyph) {
      ctx.font = "bold 48px Verdana";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(30,30,40,.6)";
      ctx.fillText(glyph, 34, 50);
      ctx.fillStyle = color;
      ctx.fillText(glyph, 32, 48);
    }
    npc.markerTex.needsUpdate = true;
    npc.marker.visible = !!glyph;
  }
}

export function spawnFakes() {
  const picks = rng.shuffle(FAKE_NAMES).slice(0, 10);
  const classIds = Object.keys(CLASSES);
  for (const name of picks) {
    const cid = rng.pick(classIds);
    const cls = CLASSES[cid];
    const hue = rng.pick([0x8a4b2f, 0xf4d03f, 0x3b3b45, 0xc9c2b8, 0xf4a7c6, 0x4a6fb3]);
    const mesh = buildHumanoid(cls.color, 0xf5d3b3, cls.weapon, 1, hue);
    const inTownStart = rng.chance(0.6);
    const pos = inTownStart
      ? { x: rng.float(-16, 16), z: rng.float(108, 132) }
      : { x: rng.float(-40, 40), z: rng.float(20, 70) };
    mesh.position.set(pos.x, terrainHeight(pos.x, pos.z), pos.z);
    G.three.scene.add(mesh);
    G.fakes.push({ name, classId: cid, pos, mesh, wanderTo: null, speed: rng.float(2, 4.4), walkPhase: rng.float(0, 6), pauseUntil: 0 });
  }
}

// Generated GLB roster: class -> model folder in public/models/
const MODEL_BY_CLASS = { blademaster: "blademaster-v4" };

export function spawnPlayerMesh() {
  const cls = CLASSES[G.player.classId];
  const mesh = buildHumanoid(cls.color, 0xf5d3b3, cls.weapon, 1.05, 0x3b3045);
  G.playerEnt = { mesh, walkPhase: 0, atkT: 0, ctl: null, oneShotUntil: 0 };
  G.three.scene.add(mesh);

  const modelName = MODEL_BY_CLASS[G.player.classId];
  if (!modelName) return;
  import("./models.js").then(async ({ loadCharacter, instantiate, attachToHand }) => {
    const entry = await loadCharacter(modelName);
    if (!entry || !G.playerEnt) return;
    const ctl = instantiate(entry);
    // pace one-shots to combat cadence regardless of clip length
    if (ctl.actions.slash) ctl.actions.slash.timeScale = ctl.actions.slash.getClip().duration / 0.7;
    if (ctl.actions.hurt) ctl.actions.hurt.timeScale = ctl.actions.hurt.getClip().duration / 0.5;

    const weapon = buildWeapon(cls.weapon);
    ctl.mesh.updateMatrixWorld(true);
    if (attachToHand(ctl, weapon)) {
      const ws = new THREE.Vector3();
      weapon.parent.getWorldScale(ws);
      weapon.scale.setScalar(1 / Math.max(ws.x, 1e-6));
      weapon.rotation.set(Math.PI / 2, 0, 0); // grip along the palm
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x1e3020, transparent: true, opacity: 0.22 }));
    shadow.position.y = 0.05;
    ctl.mesh.add(shadow);

    G.three.scene.remove(G.playerEnt.mesh);
    G.playerEnt.mesh = ctl.mesh;
    G.playerEnt.ctl = ctl;
    ctl.play("idle");
    G.three.scene.add(ctl.mesh);
  }).catch((e) => console.warn("model load failed, keeping procedural character", e));
}

// boss adds
on("summonAdds", (boss) => {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const m = makeMob("duskfang_add", boss.pos.x + Math.sin(a) * 4, boss.pos.z + Math.cos(a) * 4, 30);
    m.state = "aggro";
  }
});

// ---------------- ground loot ----------------
const dropVisuals = new Map(); // drop -> {beam, label}

function ensureDropVisual(drop) {
  if (dropVisuals.has(drop)) return;
  const hex = new THREE.Color(RARITIES[drop.item.rarity]?.color || "#fff");
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.3, 3.2, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  const y = terrainHeight(drop.pos.x, drop.pos.z);
  beam.position.set(drop.pos.x, y + 1.6, drop.pos.z);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: hex }));
  gem.position.set(drop.pos.x, y + 0.7, drop.pos.z);
  const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture("#" + hex.getHexString()), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7,
  }));
  sparkle.position.set(drop.pos.x, y + 0.7, drop.pos.z);
  sparkle.scale.set(1.6, 1.6, 1);
  G.three.scene.add(beam, gem, sparkle);
  dropVisuals.set(drop, { beam, gem, sparkle });
}

export function pickupDrop(drop) {
  if (!G.drops.includes(drop)) return;
  if (!bagAdd(drop.item)) { emit("uiError", "Bag is full!"); return; }
  G.drops.splice(G.drops.indexOf(drop), 1);
  emit("chat", { channel: "loot", text: `Looted: ${drop.item.name}${drop.item.count > 1 ? " ×" + drop.item.count : ""}`, rarity: drop.item.rarity });
  emit("sfx", { type: "loot", rarity: drop.item.rarity });
  emit("inventoryChanged");
}

export function vacuumLoot() {
  const near = G.drops.filter((d) => Math.hypot(d.pos.x - G.player.pos.x, d.pos.z - G.player.pos.z) < 7);
  if (!near.length) return;
  for (const d of near) pickupDrop(d);
}

// ---------------- projectiles / telegraphs / fx ----------------
const projVisuals = new Map();
const tgVisuals = new Map();
const fxList = [];

function ensureProjVisual(pr) {
  if (projVisuals.has(pr)) return;
  const hex = ELEM_HEX[pr.element] || 0xffffff;
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(pr.small ? 0.14 : 0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: hex })
  );
  G.three.scene.add(m);
  projVisuals.set(pr, m);
}

function ensureTgVisual(tg) {
  if (tgVisuals.has(tg)) return;
  const color = tg.friendly ? (ELEM_HEX[tg.element] || 0xffffff) : 0xff3b30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(tg.radius * 0.88, tg.radius, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(tg.radius, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 })
  );
  const y = terrainHeight(tg.pos.x, tg.pos.z) + 0.1;
  ring.position.set(tg.pos.x, y, tg.pos.z);
  fill.position.set(tg.pos.x, y, tg.pos.z);
  G.three.scene.add(ring, fill);
  tgVisuals.set(tg, { ring, fill });
}

on("aoeFx", ({ x, z, radius, element, hostile }) => {
  const color = hostile ? 0xff3b30 : (ELEM_HEX[element] || 0xffffff);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.6, radius * 0.72, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  ring.position.set(x, terrainHeight(x, z) + 0.15, z);
  G.three.scene.add(ring);
  fxList.push({ mesh: ring, ttl: 0.35, age: 0, grow: radius });
});

on("chainFx", ({ from, to }) => {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, terrainHeight(from.x, from.z) + 1.2, from.z),
    new THREE.Vector3(to.x, terrainHeight(to.x, to.z) + 1.2, to.z),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe45c, transparent: true, opacity: 0.9 }));
  G.three.scene.add(line);
  fxList.push({ mesh: line, ttl: 0.2, age: 0 });
});

function playerAttackAnim() {
  const pe = G.playerEnt;
  if (!pe) return;
  if (pe.ctl && pe.ctl.actions.slash) {
    pe.ctl.oneShot("slash");
    pe.oneShotUntil = G.now + 0.7;
  } else pe.atkT = 0.28;
}
on("skillUsed", playerAttackAnim);
on("swingFx", playerAttackAnim);
on("playerHurt", () => {
  const pe = G.playerEnt;
  if (pe?.ctl && pe.ctl.actions.hurt && G.now >= pe.oneShotUntil) {
    pe.ctl.oneShot("hurt");
    pe.oneShotUntil = G.now + 0.5;
  }
});
on("mobSwing", (mob) => { mob.atkT = 0.3; });

// ---------------- nameplates & floaters (DOM) ----------------
const plates = new Map(); // key -> {el, nameEl, hpEl, hpIn}
let platesRoot, floatersRoot;
const v3 = new THREE.Vector3();

export function initDomLayers() {
  platesRoot = document.getElementById("plates");
  floatersRoot = document.getElementById("floaters");
  on("floater", spawnFloater);
}

function worldToScreen(x, y, z) {
  const { camera } = G.three;
  v3.set(x, y, z).project(camera);
  if (v3.z > 1) return null;
  return { x: (v3.x * 0.5 + 0.5) * window.innerWidth, y: (-v3.y * 0.5 + 0.5) * window.innerHeight };
}

const floaters = [];
function spawnFloater({ x, z, y, text, cls }) {
  const el = document.createElement("div");
  el.className = `floater ${cls || ""}`;
  el.textContent = text;
  floatersRoot.appendChild(el);
  floaters.push({ el, x, z, y: (y || 2) + terrainHeight(x, z), age: 0, ttl: 1.1, drift: (Math.random() - 0.5) * 30 });
}

function getPlate(key) {
  let p = plates.get(key);
  if (!p) {
    const el = document.createElement("div");
    el.className = "plate";
    const nameEl = document.createElement("div");
    nameEl.className = "plate-name";
    const hpEl = document.createElement("div");
    hpEl.className = "plate-hp";
    const hpIn = document.createElement("div");
    hpIn.className = "plate-hp-in";
    hpEl.appendChild(hpIn);
    el.appendChild(nameEl);
    el.appendChild(hpEl);
    platesRoot.appendChild(el);
    p = { el, nameEl, hpEl, hpIn, lastName: "", used: false };
    plates.set(key, p);
  }
  p.used = true;
  return p;
}

function setPlate(key, sx, sy, name, nameColor, hpFrac, opts = {}) {
  const p = getPlate(key);
  p.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
  p.el.style.display = "block";
  if (p.lastName !== name) { p.nameEl.textContent = name; p.lastName = name; }
  p.nameEl.style.color = nameColor;
  if (hpFrac == null) p.hpEl.style.display = "none";
  else {
    p.hpEl.style.display = "block";
    p.hpIn.style.width = `${Math.max(0, Math.min(100, hpFrac * 100))}%`;
    p.hpIn.style.background = opts.hpColor || "#e0574f";
  }
  if (opts.click && !p.clickBound) {
    p.el.style.pointerEvents = "auto";
    p.el.style.cursor = "pointer";
    p.clickBound = true;
  }
  p.onClick = opts.onClick || null;
  if (!p.bound) {
    p.el.addEventListener("click", (e) => { e.stopPropagation(); if (p.onClick) p.onClick(); });
    p.bound = true;
  }
  if (opts.cls !== p.lastCls) {
    p.el.className = `plate ${opts.cls || ""}`;
    p.lastCls = opts.cls;
  }
  return p;
}

function mobNameColor(mob) {
  const diff = mob.level - G.player.level;
  if (diff >= 5) return "#ff5c5c";
  if (diff >= 2) return "#ffa632";
  if (diff >= -4) return "#f2f2f2";
  return "#9a9a9a";
}

// ---------------- per-frame update ----------------
const PLATE_DIST = 55;

export function updateEntities(dt) {
  const th = G.three;
  const p = G.player;
  const py = terrainHeight(p.pos.x, p.pos.z);

  // player mesh
  const pe = G.playerEnt;
  pe.mesh.position.set(p.pos.x, py, p.pos.z);
  pe.mesh.rotation.y = p.facing;
  if (pe.ctl) {
    // GLB character: clip-driven animation state machine
    pe.ctl.update(dt);
    if (G.now >= pe.oneShotUntil) {
      if (G.playerMoving) pe.ctl.play(pe.ctl.actions.run ? "run" : "walk");
      else pe.ctl.play("idle");
    }
  } else {
    if (G.playerMoving) {
      pe.walkPhase += dt * 10;
      pe.mesh.position.y = py + Math.abs(Math.sin(pe.walkPhase)) * 0.12;
      pe.mesh.rotation.x = 0.06;
    } else pe.mesh.rotation.x = 0;
    if (pe.atkT > 0) {
      pe.atkT -= dt;
      const w = pe.mesh.userData.weapon;
      if (w) w.rotation.x = -Math.sin((0.28 - pe.atkT) / 0.28 * Math.PI) * 1.4;
    } else if (pe.mesh.userData.weapon) pe.mesh.userData.weapon.rotation.x = 0;
  }

  // mobs
  for (const mob of G.mobs) {
    const m = mob.mesh;
    if (mob.dead) { m.visible = false; continue; }
    m.visible = true;
    const y = terrainHeight(mob.pos.x, mob.pos.z);
    m.position.set(mob.pos.x, y, mob.pos.z);
    m.rotation.y = mob.facing || 0;
    if (mob.state !== "idle" || mob.wanderTo) {
      mob.walkPhase += dt * 9;
      m.position.y = y + Math.abs(Math.sin(mob.walkPhase)) * 0.1 * mob.species.size;
    }
    if (mob.atkT > 0) { mob.atkT -= dt; m.rotation.x = -Math.sin((0.3 - mob.atkT) / 0.3 * Math.PI) * 0.4; }
    else m.rotation.x = 0;
    if (mob.species.shape === "wisp") m.position.y = y + Math.sin(G.now * 2 + mob.id) * 0.25;
  }

  // npcs sway
  for (const npc of G.npcs) {
    npc.sway += dt;
    npc.mesh.rotation.y = Math.PI + Math.sin(npc.sway * 0.5) * 0.3;
  }

  // fakes wander
  for (const f of G.fakes) {
    if (G.now < f.pauseUntil) { }
    else if (!f.wanderTo || Math.hypot(f.pos.x - f.wanderTo.x, f.pos.z - f.wanderTo.z) < 0.6) {
      if (rng.chance(0.01)) {
        const town = rng.chance(0.65);
        f.wanderTo = town
          ? { x: rng.float(-18, 18), z: rng.float(106, 134) }
          : { x: rng.float(-50, 50), z: rng.float(15, 75) };
        f.pauseUntil = G.now + rng.float(0, 4);
      }
    } else {
      const dx = f.wanderTo.x - f.pos.x, dz = f.wanderTo.z - f.pos.z;
      const d = Math.hypot(dx, dz);
      const s = Math.min(f.speed * dt, d);
      f.pos.x += (dx / d) * s; f.pos.z += (dz / d) * s;
      f.mesh.rotation.y = Math.atan2(dx, dz);
      f.walkPhase += dt * 10;
    }
    const fy = terrainHeight(f.pos.x, f.pos.z);
    f.mesh.position.set(f.pos.x, fy + Math.abs(Math.sin(f.walkPhase)) * 0.1, f.pos.z);
  }

  // drops
  for (const d of G.drops.slice()) {
    if (G.now > d.despawnAt) {
      const vis = dropVisuals.get(d);
      if (vis) { th.scene.remove(vis.beam, vis.gem, vis.sparkle); dropVisuals.delete(d); }
      G.drops.splice(G.drops.indexOf(d), 1);
      continue;
    }
    ensureDropVisual(d);
    const vis = dropVisuals.get(d);
    vis.gem.rotation.y += dt * 2;
    vis.gem.position.y = terrainHeight(d.pos.x, d.pos.z) + 0.7 + Math.sin(G.now * 3 + d.at) * 0.1;
  }
  for (const [d, vis] of dropVisuals) {
    if (!G.drops.includes(d)) { th.scene.remove(vis.beam, vis.gem, vis.sparkle); dropVisuals.delete(d); }
  }

  // projectiles
  for (const pr of G.projectiles) {
    ensureProjVisual(pr);
    const m = projVisuals.get(pr);
    m.position.set(pr.pos.x, terrainHeight(pr.pos.x, pr.pos.z) + pr.y, pr.pos.z);
  }
  for (const [pr, m] of projVisuals) {
    if (pr.dead || !G.projectiles.includes(pr)) { th.scene.remove(m); projVisuals.delete(pr); }
  }

  // telegraphs
  for (const tg of G.telegraphs) {
    ensureTgVisual(tg);
    const vis = tgVisuals.get(tg);
    const t = 1 - Math.max(0, tg.at - G.now) / Math.max(0.01, tg.at - (tg.spawnAt || (tg.spawnAt = G.now - 0.001)));
    vis.fill.material.opacity = 0.1 + 0.25 * t;
  }
  for (const [tg, vis] of tgVisuals) {
    if (tg.dead || !G.telegraphs.includes(tg)) { th.scene.remove(vis.ring, vis.fill); tgVisuals.delete(tg); }
  }

  // fx
  for (let i = fxList.length - 1; i >= 0; i--) {
    const fx = fxList[i];
    fx.age += dt;
    const t = fx.age / fx.ttl;
    if (fx.grow) fx.mesh.scale.setScalar(0.6 + t * 0.9);
    fx.mesh.material.opacity = Math.max(0, 0.9 * (1 - t));
    if (t >= 1) { th.scene.remove(fx.mesh); fxList.splice(i, 1); }
  }

  updatePlates();
  updateFloaters(dt);
}

function updatePlates() {
  for (const p of plates.values()) p.used = false;
  const pp = G.player.pos;
  const near = (pos, r = PLATE_DIST) => Math.hypot(pos.x - pp.x, pos.z - pp.z) < r;

  // player plate
  {
    const y = terrainHeight(pp.x, pp.z) + 2.5;
    const s = worldToScreen(pp.x, y, pp.z);
    if (s) {
      const title = G.player.title ? ` <${G.player.title}>` : "";
      setPlate("player", s.x, s.y, `${G.player.name}${title}`, "#8ff59a", null, { cls: "mine" });
    }
  }

  for (const mob of G.mobs) {
    if (mob.dead || !near(mob.pos)) continue;
    const y = terrainHeight(mob.pos.x, mob.pos.z) + mob.species.size * 1.7 + 0.7;
    const s = worldToScreen(mob.pos.x, y, mob.pos.z);
    if (!s) continue;
    setPlate(`mob${mob.id}`, s.x, s.y, `Lv${mob.level} ${mob.species.name}`, mobNameColor(mob),
      mob.hp / mob.maxHp, { cls: G.target === mob ? "targeted" : (mob.species.boss ? "boss" : ""), hpColor: mob.species.boss ? "#c0392b" : "#e0574f" });
  }

  for (const npc of G.npcs) {
    if (!near(npc.pos)) continue;
    const y = terrainHeight(npc.pos.x, npc.pos.z) + 2.5;
    const s = worldToScreen(npc.pos.x, y, npc.pos.z);
    if (!s) continue;
    setPlate(`npc${npc.id}`, s.x, s.y, `${npc.name}`, "#ffd23e", null, { cls: "npc" });
  }

  for (const f of G.fakes) {
    if (!near(f.pos)) continue;
    const y = terrainHeight(f.pos.x, f.pos.z) + 2.5;
    const s = worldToScreen(f.pos.x, y, f.pos.z);
    if (!s) continue;
    setPlate(`fake${f.name}`, s.x, s.y, f.name, "#dfe8ff", null, {});
  }

  for (const d of G.drops) {
    if (!near(d.pos, 40)) continue;
    const y = terrainHeight(d.pos.x, d.pos.z) + 1.2;
    const s = worldToScreen(d.pos.x, y, d.pos.z);
    if (!s) continue;
    const col = RARITIES[d.item.rarity]?.color || "#fff";
    setPlate(`drop${d.item.id}`, s.x, s.y, d.item.name + (d.item.count > 1 ? ` ×${d.item.count}` : ""), col, null,
      { cls: "loot", click: true, onClick: () => pickupDrop(d) });
  }

  for (const [key, p] of plates) {
    if (!p.used) { p.el.remove(); plates.delete(key); }
  }
}

function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.age += dt;
    if (f.age >= f.ttl) { f.el.remove(); floaters.splice(i, 1); continue; }
    const s = worldToScreen(f.x, f.y, f.z);
    if (!s) { f.el.style.display = "none"; continue; }
    f.el.style.display = "block";
    const t = f.age / f.ttl;
    f.el.style.transform = `translate(${s.x + f.drift * t}px, ${s.y - t * 70}px) translate(-50%,-50%) scale(${1 + (f.el.classList.contains("crit") ? 0.4 : 0) - t * 0.2})`;
    f.el.style.opacity = String(1 - t * t);
  }
}
