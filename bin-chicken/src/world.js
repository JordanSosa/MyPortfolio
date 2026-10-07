// The park: a harbourside lawn with a walking loop, picnics, bins, a BBQ,
// a chip kiosk, and the harbour (plus a familiar arch bridge) behind it.

import * as THREE from "three";
import { part, toon, grassTexture, checkerTexture, stripeTexture, signTexture } from "./toon.js";

export const BOUNDS = { minX: -44, maxX: 44, minZ: -30, maxZ: 34 };
export const PATH = { rx: 30, rz: 20, width: 3 };
export const SKY = 0x9fd8f5;

const forwardOf = (f) => new THREE.Vector3(Math.sin(f), 0, Math.cos(f));
const rightOf = (f) => new THREE.Vector3(Math.cos(f), 0, -Math.sin(f));

export function buildWorld(scene) {
  const colliders = []; // { x, z, r, h } — the ibis clears it when higher than h
  const bins = [];
  const bushes = [];
  const spots = [];
  const dynamic = []; // things with update(t)
  const fadeables = []; // tall props that turn see-through when they block the camera

  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 70, 260);

  // ---------- Lighting ----------
  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x6f9a52, 1.25));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------- Ground ----------
  const grassMat = toon(0x86c95f, { map: grassTexture() });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 110), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 23);
  ground.receiveShadow = true;
  scene.add(ground);

  // Walking loop (an ellipse made by squashing a ring)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(PATH.rz - PATH.width / 2, PATH.rz + PATH.width / 2, 96, 1),
    toon(0xe9d7ae),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.scale.set(PATH.rx / PATH.rz, 1, 1);
  ring.position.y = 0.015;
  ring.receiveShadow = true;
  scene.add(ring);

  // Straight path from the loop down to the seawall promenade
  const promenade = new THREE.Mesh(new THREE.PlaneGeometry(200, 3.2), toon(0xe9d7ae));
  promenade.rotation.x = -Math.PI / 2;
  promenade.position.set(0, 0.016, -29.4);
  promenade.receiveShadow = true;
  scene.add(promenade);

  // ---------- Harbour ----------
  const wall = part(new THREE.BoxGeometry(200, 1.6, 1.2), 0xd9b77e);
  wall.position.set(0, -0.55, -31.6);
  scene.add(wall);
  for (let x = -96; x <= 96; x += 4) {
    const post = part(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), 0x5b5f66, { shadow: true });
    post.position.set(x, 0.5, -31.2);
    scene.add(post);
  }
  const rail = part(new THREE.CylinderGeometry(0.05, 0.05, 200, 6), 0x5b5f66);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 1, -31.2);
  scene.add(rail);

  const waterUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      time: { value: 0 },
      deep: { value: new THREE.Color(0x1f78b4) },
      shallow: { value: new THREE.Color(0x4fb3e6) },
      foam: { value: new THREE.Color(0xd8f3ff) },
    },
  ]);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    fog: true,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform vec3 deep, shallow, foam;
      varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        float d = clamp((-vW.z - 32.0) / 60.0, 0.0, 1.0);
        vec3 col = mix(shallow, deep, d);
        float w = sin(vW.x * 0.35 + time * 1.3 + sin(vW.z * 0.22 + time * 0.7) * 2.0)
                * sin(vW.z * 0.5 - time * 0.9);
        col = mix(col, foam, step(0.82, w) * (1.0 - d * 0.7) * 0.75);
        col = mix(col, deep * 0.85, step(w, -0.85) * 0.35);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 400), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.9, -232);
  scene.add(water);
  dynamic.push((t) => { waterMat.uniforms.time.value = t; });

  // Far shore, skyline and the coathanger
  const shore = part(new THREE.BoxGeometry(700, 4, 30), 0x7fae6b, { shadow: false });
  shore.position.set(0, -0.5, -205);
  scene.add(shore);
  const towerColors = [0xa9bdd1, 0xbccbdc, 0x93abc4, 0xc7d4e2];
  for (let i = 0; i < 26; i++) {
    const h = 8 + Math.random() * 34;
    const t = part(new THREE.BoxGeometry(5 + Math.random() * 6, h, 6), towerColors[i % 4], { shadow: false });
    t.position.set(-10 + i * 7 + Math.random() * 3, h / 2, -212 - Math.random() * 8);
    scene.add(t);
  }
  buildBridge(scene);

  // Ferries drifting across the harbour
  for (let i = 0; i < 2; i++) {
    const ferry = new THREE.Group();
    const hull = part(new THREE.BoxGeometry(10, 1.4, 3.4), 0x2f6a3d, { shadow: false });
    const cabin = part(new THREE.BoxGeometry(7, 1.6, 3), 0xf6eed9, { shadow: false });
    cabin.position.y = 1.4;
    const roof = part(new THREE.BoxGeometry(6, 0.9, 2.4), 0xf3c94d, { shadow: false });
    roof.position.y = 2.6;
    ferry.add(hull, cabin, roof);
    scene.add(ferry);
    const z = -70 - i * 45, speed = (i ? -1 : 1) * (5 + i * 2), off = i * 160;
    dynamic.push((t) => {
      const x = (((t * speed + off) % 320) + 320) % 320 - 160;
      ferry.position.set(x, -0.4 + Math.sin(t * 1.4 + i) * 0.12, z);
      ferry.rotation.y = speed > 0 ? 0 : Math.PI;
    });
  }

  // ---------- Boundary hedges ----------
  const hedgeMat = 0x3f8a46;
  for (const [x, z, w, d] of [[0, 35.5, 92, 1.6], [-45.5, 3, 1.6, 66], [45.5, 3, 1.6, 66]]) {
    const hedge = part(new THREE.BoxGeometry(w, 1.6, d), hedgeMat);
    hedge.position.set(x, 0.8, z);
    scene.add(hedge);
  }

  // ---------- Trees ----------
  const figs = [[-30, -20], [12, 12], [-18, -12], [34, -24], [-38, 27], [0, 27], [26, -2], [-8, 18], [38, 22]];
  for (const [x, z] of figs) {
    const fig = buildFig(x, z);
    scene.add(fig);
    fadeables.push(makeFadeable(fig, x, z, 4));
    colliders.push({ x, z, r: 0.75, h: 99 });
  }
  const palms = [-40, -26, -12, 16, 30, 42];
  for (const x of palms) {
    const z = -27.2;
    scene.add(buildPalm(x, z));
    colliders.push({ x, z, r: 0.45, h: 99 });
  }

  // ---------- Bushes (hiding spots) ----------
  for (const [x, z, r] of [[-26, -8, 1.8], [4, -14, 1.7], [20, 18, 1.8], [-14, 26, 1.7], [38, 2, 1.6], [-38, 10, 1.7]]) {
    const g = new THREE.Group();
    const mats = [0x4c9a3f, 0x5aa948, 0x438b39];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = part(new THREE.IcosahedronGeometry(r * (0.55 + Math.random() * 0.2), 1), mats[i % 3], { outline: 0.04 });
      s.position.set(Math.cos(a) * r * 0.45, r * 0.5 + Math.random() * 0.2, Math.sin(a) * r * 0.45);
      g.add(s);
    }
    const top = part(new THREE.IcosahedronGeometry(r * 0.6, 1), 0x62b34f, { outline: 0.04 });
    top.position.y = r * 0.85;
    g.add(top);
    // flowers
    for (let i = 0; i < 7; i++) {
      const f = part(new THREE.SphereGeometry(0.09, 6, 4), [0xff6f91, 0xffffff, 0xffd166][i % 3], { shadow: false });
      const a = Math.random() * Math.PI * 2;
      f.position.set(Math.cos(a) * r * 0.85, r * (0.5 + Math.random() * 0.5), Math.sin(a) * r * 0.85);
      g.add(f);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    bushes.push({ x, z, r, group: g, wiggle: 0 });
  }

  // ---------- Bins ----------
  for (const t of [0.3, 1.3, 2.4, 3.4, 4.4, 5.5]) {
    const x = Math.cos(t) * (PATH.rx + 3);
    const z = Math.sin(t) * (PATH.rz + 3);
    bins.push(buildBin(scene, x, z));
    colliders.push({ x, z, r: 0.5, h: 1.25 });
  }

  // ---------- Kiosk ----------
  const kiosk = buildKiosk(20, 28.5);
  scene.add(kiosk);
  fadeables.push(makeFadeable(kiosk, 20, 28.5, 3));
  colliders.push({ x: 20, z: 28.5, r: 2.6, h: 99 });

  // ---------- Picnic spots ----------
  const blankets = [
    [-12, -6, 0.5, 1], [8, 6, -2.6, 2], [-4, 10, 3.0, 1], [16, -8, -0.9, 2],
    [-22, 4, 1.4, 1], [36, 8, -1.6, 1], [-36, -14, 0.9, 2], [6, -24, 0.2, 1],
  ];
  const cloths = [["#d93a3a", "#fafafa"], ["#3a7bd9", "#fafafa"], ["#f2b33d", "#fff4d6"], ["#3fae6b", "#f1fff5"]];
  blankets.forEach(([x, z, f, n], i) => {
    const [a, b] = cloths[i % cloths.length];
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), toon(0xffffff, { map: checkerTexture(a, b) }));
    blanket.rotation.set(-Math.PI / 2, 0, f);
    blanket.position.set(x, 0.025, z);
    blanket.receiveShadow = true;
    scene.add(blanket);
    const fw = forwardOf(f), rt = rightOf(f), c = new THREE.Vector3(x, 0, z);
    const seats = [{ pos: c.clone().addScaledVector(fw, -0.6), facing: f, pose: "ground" }];
    if (n > 1) seats.push({ pos: c.clone().addScaledVector(rt, 0.8).addScaledVector(fw, 0.1), facing: f - 1.7, pose: "ground" });
    const slots = [-0.45, 0.45].map((s) => c.clone().addScaledVector(fw, 0.4).addScaledVector(rt, s).setY(0.06));
    // an esky as set dressing
    const esky = part(new THREE.BoxGeometry(0.6, 0.45, 0.4), 0x2f7fd1, { outline: 0.02 });
    const lid = part(new THREE.BoxGeometry(0.64, 0.1, 0.44), 0xf4f4f4);
    lid.position.y = 0.27;
    esky.add(lid);
    esky.position.copy(c).addScaledVector(rt, -1.0).addScaledVector(fw, -0.5).setY(0.225);
    esky.rotation.y = f;
    scene.add(esky);
    spots.push({ kind: "blanket", x, z, facing: f, seats, slots });
  });

  for (const [x, z, f, n] of [[0, -3, 0.2, 2], [-10, 28, 2.8, 1], [30, -20, -0.6, 2], [-30, 22, 2.2, 1]]) {
    scene.add(buildTable(x, z, f));
    colliders.push({ x, z, r: 1.25, h: 0.92 });
    const fw = forwardOf(f), rt = rightOf(f), c = new THREE.Vector3(x, 0, z);
    const seats = [{ pos: c.clone().addScaledVector(fw, -0.95), facing: f, pose: "bench" }];
    if (n > 1) seats.push({ pos: c.clone().addScaledVector(fw, 0.95).addScaledVector(rt, 0.5), facing: f + Math.PI, pose: "bench" });
    const slots = [-0.55, 0.55].map((s) => c.clone().addScaledVector(fw, -0.15).addScaledVector(rt, s).setY(0.86));
    spots.push({ kind: "table", x, z, facing: f, seats, slots });
  }

  // The BBQ — guarded by a very attentive dad
  {
    const x = -6, z = -16, f = 2.6;
    scene.add(buildBBQ(x, z, f));
    colliders.push({ x, z, r: 0.95, h: 1.0 });
    const fw = forwardOf(f), rt = rightOf(f), c = new THREE.Vector3(x, 0, z);
    spots.push({
      kind: "bbq", x, z, facing: f,
      seats: [{ pos: c.clone().addScaledVector(fw, -1.15), facing: f, pose: "stand" }],
      slots: [-0.35, 0, 0.35].map((s) => c.clone().addScaledVector(rt, s).setY(0.97)),
    });
  }

  let lastT = 0;
  return {
    sun, colliders, bins, bushes, spots,
    update(t, focus) {
      const k = 1 - Math.exp(-8 * Math.min(0.1, Math.max(0, t - lastT)));
      lastT = t;
      sun.position.set(focus.x + 22, 40, focus.z + 18);
      sun.target.position.set(focus.x, 0, focus.z);
      for (const fn of dynamic) fn(t);
      for (const f of fadeables) {
        const dz = f.z - focus.z;
        const block = dz > -1.5 && dz < 11 && Math.abs(f.x - focus.x) < f.r + 1.2;
        const target = block ? 0.1 : 1; // low, because canopy blobs stack
        if (Math.abs(f.opacity - target) < 0.01) continue;
        f.opacity += (target - f.opacity) * k;
        if (Math.abs(f.opacity - target) < 0.02) f.opacity = target;
        for (const m of f.mats) {
          m.opacity = f.opacity;
          const tr = f.opacity < 1;
          if (m.transparent !== tr) {
            m.transparent = tr;
            m.depthWrite = !tr;
            m.needsUpdate = true; // the OPAQUE shader define depends on this flag
          }
        }
        for (const o of f.outlines) o.visible = f.opacity > 0.9;
      }
    },
  };
}

// ---------------------------------------------------------------------------

// Give a prop its own material copies so it can fade without touching shared ones.
function makeFadeable(group, x, z, r) {
  const mats = [], outlines = [];
  const cloned = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.isShaderMaterial) { outlines.push(o); return; }
    if (!cloned.has(o.material)) {
      const c = o.material.clone();
      cloned.set(o.material, c);
      mats.push(c);
    }
    o.material = cloned.get(o.material);
  });
  return { x, z, r, mats, outlines, opacity: 1 };
}

function buildFig(x, z) {
  const g = new THREE.Group();
  const trunk = part(new THREE.CylinderGeometry(0.45, 0.8, 3.4, 8), 0x7a5a3c, { outline: 0.04 });
  trunk.position.y = 1.7;
  g.add(trunk);
  const greens = [0x3e8a3a, 0x4f9e44, 0x357a34];
  const n = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    const r = 1.6 + Math.random() * 1.6;
    const blob = part(new THREE.IcosahedronGeometry(1.7 + Math.random() * 0.9, 1), greens[i % 3], { outline: 0.05 });
    blob.position.set(Math.cos(a) * r, 4.2 + Math.random() * 1.4, Math.sin(a) * r);
    g.add(blob);
  }
  const crown = part(new THREE.IcosahedronGeometry(2.4, 1), 0x56a84a, { outline: 0.05 });
  crown.position.y = 5.6;
  g.add(crown);
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI;
  return g;
}

function buildPalm(x, z) {
  const g = new THREE.Group();
  const lean = (Math.random() - 0.5) * 0.25;
  let y = 0;
  for (let i = 0; i < 7; i++) {
    const seg = part(new THREE.CylinderGeometry(0.26 - i * 0.015, 0.3 - i * 0.015, 1.1, 7), i % 2 ? 0x9b7a52 : 0x8b6b45);
    seg.position.set(lean * y, y + 0.55, 0);
    seg.rotation.z = -lean;
    g.add(seg);
    y += 1.05;
  }
  const top = new THREE.Group();
  top.position.set(lean * y, y, 0);
  for (let i = 0; i < 8; i++) {
    const frond = part(new THREE.ConeGeometry(0.35, 3.2, 4), i % 2 ? 0x4c9a3f : 0x3f8a36, { outline: 0.03 });
    frond.scale.set(1, 1, 0.25);
    frond.position.y = 0.2;
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 8) * Math.PI * 2;
    frond.rotation.x = Math.PI / 2 + 0.5;
    frond.position.z = 1.4;
    frond.position.y = -0.5;
    pivot.add(frond);
    top.add(pivot);
  }
  g.add(top);
  g.position.set(x, 0, z);
  return g;
}

function buildBin(scene, x, z) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = Math.random() * Math.PI * 2;
  const pivot = new THREE.Group();
  pivot.position.x = 0.36;
  root.add(pivot);
  const body = part(new THREE.BoxGeometry(0.72, 1.1, 0.72), 0x2e6b3a, { outline: 0.025 });
  body.position.set(-0.36, 0.55, 0);
  const lid = part(new THREE.BoxGeometry(0.8, 0.1, 0.8), 0xd23b2f, { outline: 0.02 });
  lid.position.set(-0.36, 1.15, 0);
  const handle = part(new THREE.BoxGeometry(0.1, 0.08, 0.6), 0x234f2b);
  handle.position.set(-0.76, 1.0, 0);
  pivot.add(body, lid, handle);
  scene.add(root);
  return { x, z, root, pivot, tipped: false, angle: 0, resetIn: 0 };
}

function buildKiosk(x, z) {
  const g = new THREE.Group();
  const body = part(new THREE.BoxGeometry(5, 3, 3.4), 0xf6efe0, { outline: 0.03 });
  body.position.y = 1.5;
  const roof = part(new THREE.BoxGeometry(5.6, 0.35, 4), 0x2b8fb3);
  roof.position.y = 3.2;
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.4), toon(0xffffff, { map: stripeTexture("#e84a3c", "#ffffff", 10), side: THREE.DoubleSide }));
  awning.position.set(0, 2.55, -2.2);
  awning.rotation.x = -0.6;
  awning.castShadow = true;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: signTexture("FISH & CHIPS", "#ffd23e", "#2b2b2b") }));
  sign.position.set(0, 3.9, -1.2);
  sign.rotation.y = Math.PI;
  const signBack = sign.clone();
  signBack.rotation.y = 0;
  signBack.position.z = -1.22;
  const counter = part(new THREE.BoxGeometry(4, 0.2, 0.6), 0x2b8fb3);
  counter.position.set(0, 1.2, -1.95);
  const window_ = part(new THREE.BoxGeometry(3.6, 1.1, 0.05), 0x3a2b22, { shadow: false });
  window_.position.set(0, 1.9, -1.72);
  g.add(body, roof, awning, signBack, counter, window_);
  g.position.set(x, 0, z);
  // Open side faces the camera (+z) so the counter and awning read on screen.
  g.rotation.y = Math.PI;
  return g;
}

function buildTable(x, z, f) {
  const g = new THREE.Group();
  const wood = 0x9a6a3e, dark = 0x7b5230;
  const top = part(new THREE.BoxGeometry(2.4, 0.1, 1.1), wood, { outline: 0.02 });
  top.position.y = 0.8;
  g.add(top);
  for (const s of [-1, 1]) {
    const bench = part(new THREE.BoxGeometry(2.4, 0.08, 0.35), wood, { outline: 0.02 });
    bench.position.set(0, 0.45, s * 0.95);
    g.add(bench);
    for (const lx of [-0.95, 0.95]) {
      const leg = part(new THREE.BoxGeometry(0.1, 0.8, 0.1), dark);
      leg.position.set(lx, 0.4, s * 0.35);
      g.add(leg);
      const bl = part(new THREE.BoxGeometry(0.1, 0.45, 0.1), dark);
      bl.position.set(lx, 0.22, s * 0.95);
      g.add(bl);
    }
  }
  g.position.set(x, 0, z);
  // Benches run along local ±z; the seat sits at -forward, so align local z with forward.
  g.rotation.y = f;
  return g;
}

function buildBBQ(x, z, f) {
  const g = new THREE.Group();
  const base = part(new THREE.BoxGeometry(1.6, 0.85, 0.9), 0xb9a07a, { outline: 0.02 });
  base.position.y = 0.425;
  const plate = part(new THREE.BoxGeometry(1.5, 0.08, 0.8), 0x3d4148);
  plate.position.y = 0.9;
  const hood = part(new THREE.BoxGeometry(1.6, 0.5, 0.1), 0x8e959e);
  hood.position.set(0, 1.15, 0.45);
  g.add(base, plate, hood);
  // smoke puffs
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18 + i * 0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 - i * 0.12, depthWrite: false }));
    puff.position.set((i - 1) * 0.2, 1.3 + i * 0.45, 0);
    g.add(puff);
  }
  g.position.set(x, 0, z);
  g.rotation.y = f;
  return g;
}

function buildBridge(scene) {
  const g = new THREE.Group();
  const steel = 0x8496ad;
  for (const zo of [-2.5, 2.5]) {
    const arch = part(new THREE.TorusGeometry(60, 1.6, 6, 48, Math.PI), steel, { shadow: false });
    arch.position.set(0, -22, zo);
    g.add(arch);
    const inner = part(new THREE.TorusGeometry(55, 0.8, 6, 48, Math.PI), steel, { shadow: false });
    inner.position.set(0, -22, zo);
    g.add(inner);
  }
  const deck = part(new THREE.BoxGeometry(190, 2, 8), 0x7a8ba1, { shadow: false });
  deck.position.y = 12;
  g.add(deck);
  for (let i = -10; i <= 10; i++) {
    const x = i * 5;
    const yTop = -22 + Math.sqrt(Math.max(0, 57.5 * 57.5 - x * x));
    if (yTop < 13) continue;
    const hanger = part(new THREE.BoxGeometry(0.4, yTop - 12, 0.4), steel, { shadow: false });
    hanger.position.set(x, 12 + (yTop - 12) / 2, 0);
    g.add(hanger);
  }
  for (const x of [-66, 66]) {
    const pylon = part(new THREE.BoxGeometry(8, 30, 10), 0xc9b48e, { shadow: false });
    pylon.position.set(x, 14, 0);
    g.add(pylon);
  }
  g.position.set(-55, 0, -150);
  g.rotation.y = 0.12;
  scene.add(g);
}
