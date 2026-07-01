// three.js scene: pastel island terrain with zones, water, sky, town props.

import * as THREE from "three";
import { fbm, Rng } from "../core/rng.js";
import { G } from "../core/state.js";

const WORLD_SEED = 4242;
export const ISLAND_R = 200;

const smooth = (a, b, t) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export function terrainHeight(x, z) {
  let h = fbm(x * 0.018 + 10, z * 0.018 + 10, WORLD_SEED) * 11
        + fbm(x * 0.06, z * 0.06, WORLD_SEED + 7) * 2.5;
  const r = Math.hypot(x, z);
  const coast = smooth(198, 152, r); // 1 inland -> 0 at sea
  h = h * coast + (coast * 5 - 5);
  // flatten gameplay areas
  const flat = (cx, cz, rad, target) => {
    const w = smooth(rad, rad * 0.5, Math.hypot(x - cx, z - cz));
    h = h * (1 - w) + target * w;
  };
  flat(0, 122, 36, 1.8);     // town
  flat(0, -142, 26, 2.4);    // boss hollow
  flat(0, 40, 55, 2.6);      // meadow softened
  return h;
}

export const ZONES = [
  { id: "town",   name: "Brightshore Town", x: 0, z: 122, r: 36,  color: [0.62, 0.83, 0.5] },
  { id: "meadow", name: "Sunmeadow",        x: 0, z: 40,  r: 78,  color: [0.55, 0.82, 0.42] },
  { id: "forest", name: "Gloomroot Forest", x: -85, z: -48, r: 72, color: [0.3, 0.55, 0.38] },
  { id: "ruins",  name: "The Broken Ruins", x: 95, z: -70, r: 66,  color: [0.55, 0.52, 0.58] },
  { id: "hollow", name: "Alpha's Hollow",   x: 0, z: -142, r: 32,  color: [0.45, 0.4, 0.5] },
];

export function zoneAt(x, z) {
  let best = null, bd = Infinity;
  for (const zo of ZONES) {
    const d = Math.hypot(x - zo.x, z - zo.z) / zo.r;
    if (d < bd) { bd = d; best = zo; }
  }
  return bd < 1.25 ? best : ZONES[1];
}

function groundColor(x, z) {
  const n = fbm(x * 0.05, z * 0.05, WORLD_SEED + 33);
  const h = terrainHeight(x, z);
  if (h < 0.35) return [0.93, 0.87, 0.66]; // sand
  // blend zone colors by inverse-distance weights
  let cr = 0, cg = 0, cb = 0, wt = 0;
  for (const zo of ZONES) {
    const d = Math.hypot(x - zo.x, z - zo.z);
    const w = 1 / Math.pow(Math.max(8, d) / zo.r, 3.2);
    cr += zo.color[0] * w; cg += zo.color[1] * w; cb += zo.color[2] * w; wt += w;
  }
  cr /= wt; cg /= wt; cb /= wt;
  const v = 0.9 + n * 0.22;
  return [cr * v, cg * v, cb * v];
}

export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd4f5);
  scene.fog = new THREE.Fog(0x9fd4f5, 90, 260);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 800);
  camera.position.set(0, 12, 140);

  const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x7fae6a, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
  sun.position.set(60, 120, 40);
  scene.add(sun);

  // ---- terrain ----
  const SIZE = 440, SEG = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    const [r, g, b] = groundColor(x, z);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  terrain.name = "terrain";
  scene.add(terrain);

  // ---- water ----
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(600, 48).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x4fa8d8, transparent: true, opacity: 0.9 })
  );
  water.position.y = 0.02;
  scene.add(water);

  buildVegetation(scene);
  buildTown(scene);
  buildRuinsProps(scene);
  buildClouds(scene);

  G.three = { renderer, scene, camera, terrain, sun, hemi, water, pickables: [] };
  G.three.pickables.push(terrain);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return G.three;
}

// ---- vegetation via instancing ----
function buildVegetation(scene) {
  const rng = new Rng(WORLD_SEED + 1);
  const trunks = [], canopies = [], flowers = [], rocks = [], shrooms = [];

  const tryPlace = (x, z) => {
    const h = terrainHeight(x, z);
    if (h < 0.6) return null;
    if (Math.hypot(x, z - 122) < 30) return null;         // town clear (props placed by hand)
    if (Math.hypot(x, z + 142) < 24) return null;         // boss arena clear
    return h;
  };

  for (let i = 0; i < 900; i++) {
    const a = rng.float(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 185;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const h = tryPlace(x, z);
    if (h == null) continue;
    const zo = zoneAt(x, z);
    if (zo.id === "forest") {
      if (rng.chance(0.62)) trunks.push({ x, z, h, s: rng.float(0.9, 1.7), forest: true });
      else if (rng.chance(0.3)) shrooms.push({ x, z, h, s: rng.float(0.5, 1) });
      else rocks.push({ x, z, h, s: rng.float(0.4, 1) });
    } else if (zo.id === "meadow" || zo.id === "town") {
      if (rng.chance(0.16)) trunks.push({ x, z, h, s: rng.float(0.8, 1.3), forest: false });
      else if (rng.chance(0.75)) flowers.push({ x, z, h, s: rng.float(0.5, 1.1) });
      else rocks.push({ x, z, h, s: rng.float(0.3, 0.7) });
    } else if (zo.id === "ruins") {
      if (rng.chance(0.3)) rocks.push({ x, z, h, s: rng.float(0.6, 1.6) });
      else if (rng.chance(0.12)) trunks.push({ x, z, h, s: rng.float(0.7, 1.1), forest: true, dead: true });
    } else if (zo.id === "hollow") {
      if (rng.chance(0.4)) rocks.push({ x, z, h, s: rng.float(0.5, 1.4) });
    }
  }

  const dummy = new THREE.Object3D();

  // trunks
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6444 }), trunks.length || 1);
  trunks.forEach((t, i) => {
    dummy.position.set(t.x, t.h + 1.3 * t.s, t.z);
    dummy.scale.setScalar(t.s);
    dummy.rotation.set(0, i, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(trunkMesh);

  // canopies (skip dead trees)
  const canopyList = trunks.filter((t) => !t.dead);
  const canopyMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.7, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff }), canopyList.length || 1);
  const c = new THREE.Color();
  canopyList.forEach((t, i) => {
    dummy.position.set(t.x, t.h + 2.6 * t.s + 1.1, t.z);
    dummy.scale.set(t.s * 1.15, t.s * (t.forest ? 1.35 : 0.95), t.s * 1.15);
    dummy.rotation.set(0, i * 1.7, 0);
    dummy.updateMatrix();
    canopyMesh.setMatrixAt(i, dummy.matrix);
    if (t.forest) c.setHSL(0.36 + (i % 7) * 0.008, 0.42, 0.3 + (i % 5) * 0.02);
    else c.setHSL(0.3 + (i % 9) * 0.012, 0.55, 0.48 + (i % 4) * 0.03);
    canopyMesh.setColorAt(i, c);
  });
  if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
  scene.add(canopyMesh);

  // flowers
  const flowerMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.16, 0.5, 5),
    new THREE.MeshLambertMaterial({ color: 0xffffff }), flowers.length || 1);
  const petals = [0xff8fb3, 0xffe08a, 0xa4c8ff, 0xffb3f2, 0xfff4ff];
  flowers.forEach((f, i) => {
    dummy.position.set(f.x, f.h + 0.25 * f.s, f.z);
    dummy.scale.setScalar(f.s);
    dummy.rotation.set(0, i, 0);
    dummy.updateMatrix();
    flowerMesh.setMatrixAt(i, dummy.matrix);
    flowerMesh.setColorAt(i, c.setHex(petals[i % petals.length]));
  });
  if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
  scene.add(flowerMesh);

  // rocks
  const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.7, 0),
    new THREE.MeshLambertMaterial({ color: 0x9a9aa5 }), rocks.length || 1);
  rocks.forEach((rk, i) => {
    dummy.position.set(rk.x, rk.h + 0.25 * rk.s, rk.z);
    dummy.scale.set(rk.s, rk.s * 0.7, rk.s);
    dummy.rotation.set(i, i * 2, 0);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(rockMesh);

  // wild mushrooms
  const shroomMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.45, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xd96a6a }), shrooms.length || 1);
  shrooms.forEach((s, i) => {
    dummy.position.set(s.x, s.h + 0.3 * s.s, s.z);
    dummy.scale.setScalar(s.s);
    dummy.rotation.set(0, i, 0);
    dummy.updateMatrix();
    shroomMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(shroomMesh);
}

// ---- town ----
function buildTown(scene) {
  const g = new THREE.Group();
  const wallMat = (hex) => new THREE.MeshLambertMaterial({ color: hex });

  const house = (x, z, rotY, bodyHex, roofHex, s = 1) => {
    const h = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4 * s, 3 * s, 3.6 * s), wallMat(bodyHex));
    body.position.y = 1.5 * s;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4 * s, 2.2 * s, 4), wallMat(roofHex));
    roof.position.y = 3 * s + 1.1 * s;
    roof.rotation.y = Math.PI / 4;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 1.6 * s, 0.1), wallMat(0x6e4830));
    door.position.set(0, 0.8 * s, 1.85 * s);
    h.add(body, roof, door);
    h.position.set(x, terrainHeight(x, z), z);
    h.rotation.y = rotY;
    g.add(h);
  };

  house(-14, 112, 0.5, 0xf3e4c8, 0xd96a6a);
  house(14, 110, -0.4, 0xe8d8f0, 0x7d6ff0);
  house(-16, 130, 1.2, 0xfbe9d4, 0x4fae6b, 0.9);
  house(18, 132, -1.0, 0xf3e4c8, 0xe0a13e, 1.1);
  house(0, 104, 0, 0xfdf2dd, 0xc06a5a, 1.2);

  // fountain
  const fBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 0.8, 16), wallMat(0xcfd4dd));
  fBase.position.set(0, terrainHeight(0, 122) + 0.4, 122);
  const fWater = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 16), new THREE.MeshLambertMaterial({ color: 0x6fc3e8 }));
  fWater.position.set(0, terrainHeight(0, 122) + 0.85, 122);
  const fSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.2, 8), wallMat(0xcfd4dd));
  fSpire.position.set(0, terrainHeight(0, 122) + 1.8, 122);
  g.add(fBase, fWater, fSpire);

  // sage's great tree
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.6, 7, 8), wallMat(0x7a5638));
  trunk.position.set(20, terrainHeight(20, 126) + 3.5, 126);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5, 1), new THREE.MeshLambertMaterial({ color: 0xf4a7c6 }));
  crown.position.set(20, terrainHeight(20, 126) + 9, 126);
  crown.scale.y = 0.8;
  g.add(trunk, crown);

  // bulletin board
  const post = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.15), wallMat(0xa87b4f));
  post.position.set(-5, terrainHeight(-5, 118) + 1.6, 118);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.2), wallMat(0x6e4830));
  legs.position.set(-5, terrainHeight(-5, 118) + 0.6, 118);
  g.add(post, legs);

  // lamps
  for (const [lx, lz] of [[-8, 126], [8, 118], [6, 130]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3, 6), wallMat(0x555566));
    pole.position.set(lx, terrainHeight(lx, lz) + 1.5, lz);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd76a, emissiveIntensity: 0.9 }));
    lamp.position.set(lx, terrainHeight(lx, lz) + 3.1, lz);
    g.add(pole, lamp);
  }
  scene.add(g);
}

// ---- ruins props ----
function buildRuinsProps(scene) {
  const rng = new Rng(WORLD_SEED + 5);
  const mat = new THREE.MeshLambertMaterial({ color: 0x8d8898 });
  const g = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const x = 95 + rng.float(-52, 52), z = -70 + rng.float(-48, 48);
    const h = terrainHeight(x, z);
    if (h < 0.5) continue;
    const tall = rng.chance(0.5);
    const m = new THREE.Mesh(
      tall ? new THREE.CylinderGeometry(0.7, 0.9, rng.float(3, 6.5), 6) : new THREE.BoxGeometry(rng.float(2, 4), rng.float(0.8, 2), rng.float(1, 2)),
      mat);
    m.position.set(x, h + (tall ? 1.6 : 0.4), z);
    m.rotation.set(rng.float(-0.25, 0.25), rng.float(0, 3), rng.float(-0.2, 0.2));
    g.add(m);
  }
  // boss arena: ring of fangs
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.sin(a) * 20, z = -142 + Math.cos(a) * 20;
    const fang = new THREE.Mesh(new THREE.ConeGeometry(1, 4.5, 5), new THREE.MeshLambertMaterial({ color: 0x5a5266 }));
    fang.position.set(x, terrainHeight(x, z) + 2, z);
    fang.rotation.z = Math.sin(a) * 0.15;
    g.add(fang);
  }
  scene.add(g);
}

function buildClouds(scene) {
  const rng = new Rng(WORLD_SEED + 9);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.float(4, 8), 8, 6), mat);
      puff.position.set(rng.float(-8, 8), rng.float(-1, 1), rng.float(-4, 4));
      puff.scale.y = 0.45;
      cl.add(puff);
    }
    cl.position.set(rng.float(-260, 260), rng.float(60, 95), rng.float(-260, 260));
    cl.userData.speed = rng.float(0.5, 1.6);
    scene.add(cl);
    clouds.push(cl);
  }
  G.cloudList = clouds;
}

// ---- day/night tint ----
const SKY_DAY = new THREE.Color(0x9fd4f5), SKY_EVE = new THREE.Color(0xf5b98a), SKY_NIGHT = new THREE.Color(0x2a3560);
const tmp = new THREE.Color();
export function updateDayNight(t) {
  // t: 0..1, 0.25 = noon-ish start
  const th = G.three;
  if (!th.scene) return;
  const s = Math.sin(t * Math.PI * 2); // day when > 0
  let sky;
  if (s > 0.25) sky = tmp.copy(SKY_DAY);
  else if (s > -0.1) sky = tmp.copy(SKY_EVE).lerp(SKY_DAY, (s + 0.1) / 0.35);
  else sky = tmp.copy(SKY_NIGHT).lerp(SKY_EVE, (s + 1) / 0.9 * 0.6);
  th.scene.background.copy(sky);
  th.scene.fog.color.copy(sky);
  th.sun.intensity = 0.5 + Math.max(0, s) * 0.9;
  th.hemi.intensity = 0.55 + Math.max(0.1, s) * 0.55;
  for (const cl of G.cloudList || []) {
    cl.position.x += cl.userData.speed * 0.02;
    if (cl.position.x > 280) cl.position.x = -280;
  }
}
