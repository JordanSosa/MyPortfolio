// three.js scene: cel-shaded pastel island — gradient sky dome, sun shadows,
// painted dirt paths, thousands of billboard grass tufts & flowers, layered
// toon trees, animated water. All generated at runtime, zero assets.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { fbm, Rng } from "../core/rng.js";
import { G } from "../core/state.js";
import {
  toon, toonRamp, terrainDetailTexture, grassTexture, flowerTexture, glowTexture,
  waterTexture, roofTexture, wallTexture,
} from "./toon.js";

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
  { id: "town",   name: "Brightshore Town", x: 0, z: 122, r: 36,  color: [0.66, 0.9, 0.52] },
  { id: "meadow", name: "Sunmeadow",        x: 0, z: 40,  r: 78,  color: [0.6, 0.92, 0.45] },
  { id: "forest", name: "Gloomroot Forest", x: -85, z: -48, r: 72, color: [0.25, 0.52, 0.35] },
  { id: "ruins",  name: "The Broken Ruins", x: 95, z: -70, r: 66,  color: [0.52, 0.46, 0.58] },
  { id: "hollow", name: "Alpha's Hollow",   x: 0, z: -142, r: 32,  color: [0.42, 0.35, 0.52] },
];

export function zoneAt(x, z) {
  let best = null, bd = Infinity;
  for (const zo of ZONES) {
    const d = Math.hypot(x - zo.x, z - zo.z) / zo.r;
    if (d < bd) { bd = d; best = zo; }
  }
  return bd < 1.25 ? best : ZONES[1];
}

// Dirt paths: polyline from town through the zones.
const PATHS = [
  [[0, 112], [0, 78], [0, 45]],                       // town -> meadow
  [[0, 45], [-38, 12], [-68, -22], [-85, -48]],       // -> forest
  [[0, 45], [34, 16], [68, -38], [95, -70]],          // -> ruins
  [[0, 45], [0, -20], [-12, -70], [0, -118], [0, -134]], // -> hollow
];

function pathDist(x, z) {
  let best = Infinity;
  for (const line of PATHS) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x1, z1] = line[i], [x2, z2] = line[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
      const d = Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t));
      if (d < best) best = d;
    }
  }
  return best;
}

function groundColor(x, z) {
  const n = fbm(x * 0.05, z * 0.05, WORLD_SEED + 33);
  const h = terrainHeight(x, z);
  if (h < 0.35) return [0.96, 0.9, 0.68]; // sand
  let cr = 0, cg = 0, cb = 0, wt = 0;
  for (const zo of ZONES) {
    const d = Math.hypot(x - zo.x, z - zo.z);
    const w = 1 / Math.pow(Math.max(8, d) / zo.r, 4.2);
    cr += zo.color[0] * w; cg += zo.color[1] * w; cb += zo.color[2] * w; wt += w;
  }
  cr /= wt; cg /= wt; cb /= wt;
  const v = 0.94 + n * 0.18;
  let out = [cr * v, cg * v, cb * v];
  // painted dirt path
  const pd = pathDist(x, z);
  if (pd < 4.5 && h > 0.4) {
    const pw = 1 - smooth(2.2, 4.5, pd);
    const dirt = [0.82 + n * 0.08, 0.68 + n * 0.06, 0.47];
    out = out.map((c, i) => c * (1 - pw) + dirt[i] * pw);
  }
  return out;
}

export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xaddcf7, 100, 300);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1400);
  camera.position.set(0, 12, 140);

  const hemi = new THREE.HemisphereLight(0xf2fbff, 0x9cc06a, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.9);
  sun.position.set(60, 110, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const d = 75;
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);

  // ---- sky dome + sun disc ----
  const skyUniforms = {
    top: { value: new THREE.Color(0x4f9fe8) },
    mid: { value: new THREE.Color(0xaddcf7) },
    bottom: { value: new THREE.Color(0xeaf7dd) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(650, 24, 14),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: skyUniforms,
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h))
                            : mix(bottom, mid, smoothstep(-0.08, 0.12, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  scene.add(sky);

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture("#fff6c8"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunSprite.scale.set(160, 160, 1);
  scene.add(sunSprite);

  // ---- terrain ----
  const SIZE = 440, SEG = 156;
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
  const terrain = new THREE.Mesh(geo, new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: toonRamp(), map: terrainDetailTexture(),
  }));
  terrain.name = "terrain";
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ---- water ----
  const waterTex = waterTexture();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(700, 48).rotateX(-Math.PI / 2),
    new THREE.MeshToonMaterial({ map: waterTex, color: 0xbfe6ff, gradientMap: toonRamp(), transparent: true, opacity: 0.94 })
  );
  water.position.y = 0.02;
  scene.add(water);

  buildVegetation(scene);
  buildGroundCover(scene);
  buildTown(scene);
  buildRuinsProps(scene);
  buildClouds(scene);

  G.three = { renderer, scene, camera, terrain, sun, hemi, water, waterTex, sky: skyUniforms, sunSprite, pickables: [] };
  G.three.pickables.push(terrain);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return G.three;
}

// ---- trees & rocks (instanced, layered toon canopies) ----
function buildVegetation(scene) {
  const rng = new Rng(WORLD_SEED + 1);
  const trees = [], rocks = [], shrooms = [];

  const tryPlace = (x, z) => {
    const h = terrainHeight(x, z);
    if (h < 0.6) return null;
    if (Math.hypot(x, z - 122) < 30) return null;
    if (Math.hypot(x, z + 142) < 24) return null;
    if (pathDist(x, z) < 4) return null;
    return h;
  };

  for (let i = 0; i < 950; i++) {
    const a = rng.float(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 185;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const h = tryPlace(x, z);
    if (h == null) continue;
    const zo = zoneAt(x, z);
    if (zo.id === "forest") {
      if (rng.chance(0.6)) trees.push({ x, z, h, s: rng.float(1, 1.8), kind: "forest" });
      else if (rng.chance(0.35)) shrooms.push({ x, z, h, s: rng.float(0.5, 1) });
      else rocks.push({ x, z, h, s: rng.float(0.4, 1) });
    } else if (zo.id === "meadow" || zo.id === "town") {
      if (rng.chance(0.15)) trees.push({ x, z, h, s: rng.float(0.85, 1.35), kind: rng.chance(0.25) ? "blossom" : "meadow" });
      else if (rng.chance(0.1)) rocks.push({ x, z, h, s: rng.float(0.3, 0.7) });
    } else if (zo.id === "ruins") {
      if (rng.chance(0.3)) rocks.push({ x, z, h, s: rng.float(0.6, 1.6) });
      else if (rng.chance(0.14)) trees.push({ x, z, h, s: rng.float(0.7, 1.15), kind: "dead" });
    } else if (zo.id === "hollow") {
      if (rng.chance(0.4)) rocks.push({ x, z, h, s: rng.float(0.5, 1.4) });
    }
  }

  const dummy = new THREE.Object3D();
  const c = new THREE.Color();

  // trunks
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.2, 0.42, 2.8, 7),
    toon(0x8a6444), trees.length || 1);
  trunkMesh.castShadow = true;
  trees.forEach((t, i) => {
    dummy.position.set(t.x, t.h + 1.3 * t.s, t.z);
    dummy.scale.set(t.s, t.s, t.s);
    dummy.rotation.set(0, i, (i % 5) * 0.02);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(trunkMesh);

  // layered canopies: fat base blob + lighter crown blob (skip dead trees)
  const leafy = trees.filter((t) => t.kind !== "dead");
  const lowGeo = new THREE.IcosahedronGeometry(1.9, 1);
  const topGeo = new THREE.IcosahedronGeometry(1.25, 1);
  const canopyLow = new THREE.InstancedMesh(lowGeo, toon(0xffffff), leafy.length || 1);
  const canopyTop = new THREE.InstancedMesh(topGeo, toon(0xffffff), leafy.length || 1);
  canopyLow.castShadow = true;
  leafy.forEach((t, i) => {
    const baseY = t.h + 2.7 * t.s + 0.9;
    dummy.position.set(t.x, baseY, t.z);
    dummy.scale.set(t.s * 1.15, t.s * (t.kind === "forest" ? 1.25 : 0.9), t.s * 1.15);
    dummy.rotation.set(0, i * 1.7, 0);
    dummy.updateMatrix();
    canopyLow.setMatrixAt(i, dummy.matrix);
    dummy.position.set(t.x + Math.sin(i) * 0.4 * t.s, baseY + 1.5 * t.s, t.z + Math.cos(i) * 0.4 * t.s);
    dummy.scale.setScalar(t.s * 0.95);
    dummy.updateMatrix();
    canopyTop.setMatrixAt(i, dummy.matrix);
    if (t.kind === "forest") {
      c.setHSL(0.36 + (i % 7) * 0.01, 0.5, 0.3 + (i % 5) * 0.02);
      canopyLow.setColorAt(i, c);
      c.setHSL(0.33 + (i % 7) * 0.01, 0.55, 0.42);
      canopyTop.setColorAt(i, c);
    } else if (t.kind === "blossom") {
      c.setHSL(0.93, 0.6, 0.75); canopyLow.setColorAt(i, c);
      c.setHSL(0.95, 0.7, 0.85); canopyTop.setColorAt(i, c);
    } else {
      c.setHSL(0.29 + (i % 9) * 0.012, 0.62, 0.5); canopyLow.setColorAt(i, c);
      c.setHSL(0.26 + (i % 9) * 0.012, 0.68, 0.62); canopyTop.setColorAt(i, c);
    }
  });
  if (canopyLow.instanceColor) canopyLow.instanceColor.needsUpdate = true;
  if (canopyTop.instanceColor) canopyTop.instanceColor.needsUpdate = true;
  scene.add(canopyLow, canopyTop);

  // rocks
  const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.7, 0), toon(0xb9bcc9), rocks.length || 1);
  rockMesh.castShadow = true;
  rocks.forEach((rk, i) => {
    dummy.position.set(rk.x, rk.h + 0.25 * rk.s, rk.z);
    dummy.scale.set(rk.s, rk.s * 0.7, rk.s);
    dummy.rotation.set(i, i * 2, 0);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(rockMesh);

  // wild red-cap mushrooms
  const capGeo = new THREE.SphereGeometry(0.45, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const shroomMesh = new THREE.InstancedMesh(capGeo, toon(0xe86a6a), shrooms.length || 1);
  const stemMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 0.5, 6), toon(0xfff3e0), shrooms.length || 1);
  shrooms.forEach((s, i) => {
    dummy.position.set(s.x, s.h + 0.42 * s.s, s.z);
    dummy.scale.setScalar(s.s);
    dummy.rotation.set(0, i, 0);
    dummy.updateMatrix();
    shroomMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(s.x, s.h + 0.2 * s.s, s.z);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(shroomMesh, stemMesh);
}

// ---- billboard grass & flowers (the Flyff meadow feel) ----
function buildGroundCover(scene) {
  const rng = new Rng(WORLD_SEED + 3);
  const crossQuad = (wdt, hgt) => {
    const p1 = new THREE.PlaneGeometry(wdt, hgt);
    p1.translate(0, hgt / 2, 0);
    const p2 = p1.clone().rotateY(Math.PI / 2);
    return mergeGeometries([p1, p2]);
  };

  const dummy = new THREE.Object3D();
  const c = new THREE.Color();

  // grass tufts
  const spots = [];
  for (let i = 0; i < 5200; i++) {
    const a = rng.float(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 180;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const h = terrainHeight(x, z);
    if (h < 0.6) continue;
    if (pathDist(x, z) < 3.2) continue;
    if (Math.hypot(x, z - 122) < 13) continue; // town plaza
    if (Math.hypot(x, z + 142) < 22) continue;
    const zo = zoneAt(x, z);
    if (zo.id === "ruins" && !rng.chance(0.3)) continue;
    if (zo.id === "hollow") continue;
    spots.push({ x, z, h, zo: zo.id, s: rng.float(0.7, 1.5) });
  }
  const grassMat = new THREE.MeshToonMaterial({
    map: grassTexture(), alphaTest: 0.45, side: THREE.DoubleSide, gradientMap: toonRamp(),
  });
  const grass = new THREE.InstancedMesh(crossQuad(1.1, 0.9), grassMat, spots.length || 1);
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.h - 0.03, s.z);
    dummy.scale.setScalar(s.s);
    dummy.rotation.set(0, rng.float(0, Math.PI), 0);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    if (s.zo === "forest") c.setHSL(0.35, 0.45, 0.42 + (i % 4) * 0.03);
    else if (s.zo === "ruins") c.setHSL(0.24, 0.3, 0.55);
    else c.setHSL(0.27 + (i % 6) * 0.008, 0.65, 0.62 + (i % 4) * 0.04);
    grass.setColorAt(i, c);
  });
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  scene.add(grass);

  // flowers (several petal colors, meadow + town heavy)
  const flowerColors = ["#ff8fb3", "#ffd23e", "#a4c8ff", "#ff9a5c", "#f2f2ff"];
  for (const petal of flowerColors) {
    const pts = [];
    for (let i = 0; i < 300; i++) {
      const a = rng.float(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 150;
      const x = Math.sin(a) * r, z = Math.cos(a) * r + 30; // biased south (meadow/town)
      const h = terrainHeight(x, z);
      if (h < 0.6 || pathDist(x, z) < 3) continue;
      const zo = zoneAt(x, z);
      if (zo.id !== "meadow" && zo.id !== "town" && !(zo.id === "forest" && rng.chance(0.2))) continue;
      pts.push({ x, z, h, s: rng.float(0.5, 0.95) });
    }
    const mat = new THREE.MeshToonMaterial({
      map: flowerTexture(petal), alphaTest: 0.45, side: THREE.DoubleSide, gradientMap: toonRamp(),
    });
    const mesh = new THREE.InstancedMesh(crossQuad(0.7, 0.75), mat, pts.length || 1);
    pts.forEach((p, i) => {
      dummy.position.set(p.x, p.h - 0.02, p.z);
      dummy.scale.setScalar(p.s);
      dummy.rotation.set(0, rng.float(0, Math.PI), 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    scene.add(mesh);
  }
}

// ---- town ----
function buildTown(scene) {
  const g = new THREE.Group();

  const house = (x, z, rotY, bodyHex, roofHex, roofDark, s = 1) => {
    const h = new THREE.Group();
    const wallTex = wallTexture(bodyHex);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4 * s, 3 * s, 3.6 * s),
      new THREE.MeshToonMaterial({ map: wallTex, gradientMap: toonRamp() }));
    body.position.y = 1.5 * s;
    body.castShadow = true;
    const rTex = roofTexture(roofHex, roofDark);
    rTex.repeat.set(3, 2);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9 * s, 2.6 * s, 4),
      new THREE.MeshToonMaterial({ map: rTex, gradientMap: toonRamp() }));
    roof.position.y = 3 * s + 1.3 * s;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(5.2 * s, 0.25 * s, 4.4 * s), toon(0x7a5638));
    brim.position.y = 3.05 * s;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.95 * s, 1.7 * s, 0.12), toon(0x6e4830));
    door.position.set(0, 0.85 * s, 1.85 * s);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 6, 6), toon(0xffd23e));
    knob.position.set(0.3 * s, 0.85 * s, 1.94 * s);
    const win1 = new THREE.Mesh(new THREE.CircleGeometry(0.42 * s, 12), toon(0xbfe8ff, { emissive: 0x86c8f0, emissiveIntensity: 0.35 }));
    win1.position.set(-1.3 * s, 1.9 * s, 1.82 * s);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 1.4 * s, 0.55 * s), toon(0xb5828a));
    chimney.position.set(1.3 * s, 4.1 * s, -0.6 * s);
    h.add(body, roof, brim, door, knob, win1, chimney);
    h.position.set(x, terrainHeight(x, z), z);
    h.rotation.y = rotY;
    g.add(h);
  };

  house(-14, 112, 0.5, "#fdeeda", "#e0574f", "#b83c36");
  house(14, 110, -0.4, "#f0e2fa", "#8f7ff5", "#6a5ad0");
  house(-16, 130, 1.2, "#fdf4e0", "#57c47a", "#3d9c5c", 0.9);
  house(18, 132, -1.0, "#fdeeda", "#ffb03e", "#d88a1e", 1.1);
  house(0, 104, 0, "#fff6e6", "#e0728a", "#bc4d66", 1.25);

  // fountain
  const fy = terrainHeight(0, 122);
  const fBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 0.9, 18), toon(0xdfe4ef));
  fBase.position.set(0, fy + 0.45, 122);
  fBase.castShadow = true;
  const fWater = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.32, 18), toon(0x8fd4f5, { emissive: 0x5aa8d0, emissiveIntensity: 0.25 }));
  fWater.position.set(0, fy + 0.9, 122);
  const fSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 2.3, 10), toon(0xdfe4ef));
  fSpire.position.set(0, fy + 1.9, 122);
  const fTop = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), toon(0x8fd4f5, { emissive: 0x5aa8d0, emissiveIntensity: 0.4 }));
  fTop.position.set(0, fy + 3.15, 122);
  g.add(fBase, fWater, fSpire, fTop);

  // sage's blossom great-tree
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.7, 7, 9), toon(0x8a6444));
  trunk.position.set(20, terrainHeight(20, 126) + 3.5, 126);
  trunk.castShadow = true;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5, 1), toon(0xf6b8d8));
  crown.position.set(20, terrainHeight(20, 126) + 9, 126);
  crown.scale.y = 0.8;
  crown.castShadow = true;
  const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 1), toon(0xfad4e8));
  crown2.position.set(21.5, terrainHeight(20, 126) + 12, 124.5);
  g.add(trunk, crown, crown2);

  // bulletin board
  const post = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.15), toon(0xb98b5c));
  post.position.set(-5, terrainHeight(-5, 118) + 1.7, 118);
  post.castShadow = true;
  const roofB = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 0.8), toon(0x8a5f38));
  roofB.position.set(-5, terrainHeight(-5, 118) + 2.6, 118);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 0.18), toon(0x8a5f38));
  legs.position.set(-5, terrainHeight(-5, 118) + 0.5, 118);
  g.add(post, roofB, legs);

  // picket fences along plaza edge
  const fenceMat = toon(0xe8d9bc);
  for (const [fx, fz, rot, len] of [[-10, 134, 0.15, 8], [11, 136, -0.2, 7], [-19, 122, 1.35, 7]]) {
    for (let i = 0; i < len; i++) {
      const px = fx + Math.cos(rot) * i * 1.1, pz = fz + Math.sin(rot) * i * 1.1;
      const picket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1, 0.1), fenceMat);
      picket.position.set(px, terrainHeight(px, pz) + 0.5, pz);
      picket.rotation.y = rot;
      g.add(picket);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len * 1.1, 0.12, 0.08), fenceMat);
    const mx = fx + Math.cos(rot) * (len - 1) * 0.55, mz = fz + Math.sin(rot) * (len - 1) * 0.55;
    rail.position.set(mx, terrainHeight(mx, mz) + 0.75, mz);
    rail.rotation.y = -rot;
    g.add(rail);
  }

  // lamps with glow sprites
  const glowTex = glowTexture("#ffe9a8");
  for (const [lx, lz] of [[-8, 126], [8, 118], [6, 130], [-4, 108]]) {
    const y0 = terrainHeight(lx, lz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 3, 6), toon(0x5a5a6e));
    pole.position.set(lx, y0 + 1.5, lz);
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 10, Math.PI), toon(0x5a5a6e));
    arm.position.set(lx, y0 + 3, lz);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), toon(0xfff2c0, { emissive: 0xffd76a, emissiveIntensity: 1.1 }));
    lamp.position.set(lx, y0 + 3.15, lz);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 }));
    glow.position.set(lx, y0 + 3.15, lz);
    glow.scale.set(1.6, 1.6, 1);
    g.add(pole, arm, lamp, glow);
    (G.lampGlows = G.lampGlows || []).push(glow);
  }
  scene.add(g);
}

// ---- ruins & boss hollow props ----
function buildRuinsProps(scene) {
  const rng = new Rng(WORLD_SEED + 5);
  const mat = toon(0x9d97ac);
  const mossMat = toon(0x6a9e5a);
  const g = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const x = 95 + rng.float(-52, 52), z = -70 + rng.float(-48, 48);
    const h = terrainHeight(x, z);
    if (h < 0.5) continue;
    const tall = rng.chance(0.5);
    const m = new THREE.Mesh(
      tall ? new THREE.CylinderGeometry(0.7, 0.9, rng.float(3, 6.5), 7) : new THREE.BoxGeometry(rng.float(2, 4), rng.float(0.8, 2), rng.float(1, 2)),
      mat);
    m.position.set(x, h + (tall ? 1.6 : 0.4), z);
    m.rotation.set(rng.float(-0.25, 0.25), rng.float(0, 3), rng.float(-0.2, 0.2));
    m.castShadow = true;
    g.add(m);
    if (tall && rng.chance(0.6)) {
      const moss = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mossMat);
      moss.position.set(x, h + rng.float(3, 4.6), z);
      g.add(moss);
    }
  }
  // boss arena: ring of fangs + glowing crystals
  const crysMat = toon(0xb98af5, { emissive: 0x8a4ae0, emissiveIntensity: 0.8 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.sin(a) * 20, z = -142 + Math.cos(a) * 20;
    const fang = new THREE.Mesh(new THREE.ConeGeometry(1, 4.5, 5), toon(0x6a6178));
    fang.position.set(x, terrainHeight(x, z) + 2, z);
    fang.rotation.z = Math.sin(a) * 0.15;
    fang.castShadow = true;
    g.add(fang);
    if (i % 2 === 0) {
      const cry = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 5), crysMat);
      const cx = Math.sin(a + 0.3) * 15, cz = -142 + Math.cos(a + 0.3) * 15;
      cry.position.set(cx, terrainHeight(cx, cz) + 0.7, cz);
      cry.rotation.z = 0.4;
      g.add(cry);
    }
  }
  scene.add(g);
}

function buildClouds(scene) {
  const rng = new Rng(WORLD_SEED + 9);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  const clouds = [];
  for (let i = 0; i < 11; i++) {
    const cl = new THREE.Group();
    const puffs = rng.int(4, 7);
    for (let j = 0; j < puffs; j++) {
      const r = rng.float(3.5, 8);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), mat);
      puff.position.set(rng.float(-10, 10), rng.float(0, 1.5) + r * 0.1, rng.float(-4, 4));
      puff.scale.y = 0.55;
      cl.add(puff);
    }
    cl.position.set(rng.float(-280, 280), rng.float(60, 100), rng.float(-280, 280));
    cl.userData.speed = rng.float(0.5, 1.6);
    scene.add(cl);
    clouds.push(cl);
  }
  G.cloudList = clouds;
}

// ---- day/night tint + per-frame environment animation ----
const DAY = { top: 0x4f9fe8, mid: 0xaddcf7, bottom: 0xeaf7dd, sun: 0xfff3d6, sunI: 1.9, hemiI: 1.25 };
const EVE = { top: 0x7a6fc0, mid: 0xf5b98a, bottom: 0xffe0c0, sun: 0xffc088, sunI: 1.1, hemiI: 0.9 };
const NIGHT = { top: 0x141a3e, mid: 0x2a3560, bottom: 0x3a4470, sun: 0x8898d8, sunI: 0.45, hemiI: 0.5 };
const tmpA = new THREE.Color(), tmpB = new THREE.Color();

function lerpPreset(a, b, t, out) {
  out.top.copy(tmpA.setHex(a.top).lerp(tmpB.setHex(b.top), t));
  out.mid.copy(tmpA.setHex(a.mid).lerp(tmpB.setHex(b.mid), t));
  out.bottom.copy(tmpA.setHex(a.bottom).lerp(tmpB.setHex(b.bottom), t));
  out.sunC.copy(tmpA.setHex(a.sun).lerp(tmpB.setHex(b.sun), t));
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
}
const envOut = { top: new THREE.Color(), mid: new THREE.Color(), bottom: new THREE.Color(), sunC: new THREE.Color(), sunI: 1, hemiI: 1 };

export function updateDayNight(t, dt = 0.016) {
  const th = G.three;
  if (!th.scene) return;
  const s = Math.sin(t * Math.PI * 2); // >0 day
  if (s > 0.3) lerpPreset(DAY, DAY, 0, envOut);
  else if (s > 0) lerpPreset(EVE, DAY, s / 0.3, envOut);
  else if (s > -0.35) lerpPreset(EVE, NIGHT, -s / 0.35, envOut);
  else lerpPreset(NIGHT, NIGHT, 0, envOut);

  th.sky.top.value.copy(envOut.top);
  th.sky.mid.value.copy(envOut.mid);
  th.sky.bottom.value.copy(envOut.bottom);
  th.scene.fog.color.copy(envOut.mid);
  th.sun.color.copy(envOut.sunC);
  th.sun.intensity = envOut.sunI;
  th.hemi.intensity = envOut.hemiI;

  // sun follows the player so the shadow box stays tight; disc rides the sky
  const p = G.player?.pos || { x: 0, z: 122 };
  const sunAng = t * Math.PI * 2;
  const dir = new THREE.Vector3(Math.cos(sunAng * 0.5 + 0.8) * 0.6, Math.max(0.25, Math.abs(s)) + 0.35, Math.sin(sunAng * 0.5 + 0.8) * 0.6).normalize();
  th.sun.position.set(p.x + dir.x * 140, dir.y * 140, p.z + dir.z * 140);
  th.sun.target.position.set(p.x, 0, p.z);
  th.sunSprite.position.set(th.camera.position.x + dir.x * 520, dir.y * 520, th.camera.position.z + dir.z * 520);
  th.sunSprite.material.opacity = Math.max(0.15, s);

  // lamps bloom as night falls
  const lampGlow = Math.min(1, Math.max(0.12, 0.55 - s * 0.6));
  for (const gl of G.lampGlows || []) gl.material.opacity = lampGlow;

  // water shimmer + cloud drift
  th.waterTex.offset.x += dt * 0.012;
  th.waterTex.offset.y += dt * 0.007;
  for (const cl of G.cloudList || []) {
    cl.position.x += cl.userData.speed * dt * 1.4;
    if (cl.position.x > 300) cl.position.x = -300;
  }
}
