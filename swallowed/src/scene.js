import * as THREE from "three";
import { gsap } from "gsap";

// ============================================================================
// scene.js — the whole 3D tract.
//
// ONE CatmullRomCurve3 runs through all six organ segments end to end. The
// camera position and lookAt are sampled from this single curve at a progress
// value driven by scroll. Each organ is a group whose visibility toggles based
// on proximity to the camera so the whole tract isn't active at once.
// ============================================================================

// Linear interpolation of two hex colours into a THREE.Color (reused buffer).
const _cA = new THREE.Color();
const _cB = new THREE.Color();

export class TractScene {
  constructor(root, opts = {}) {
    this.root = root;
    this.lowPerf = !!opts.lowPerf;
    this.reduced = !!opts.reduced;
    this.progress = 0;
    this.running = false;
    this.clock = new THREE.Clock();
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this.lookYaw = 0;     // user drag look (clamped)
    this.lookPitch = 0;
    this.stageGroups = {};
    this.disposables = [];

    this._initRenderer();
    this._initSceneCamera();
    this._buildCurve();
    this._buildTube();
    this._buildOrgans();
    this._bindResize();
  }

  // ----- particle / instance budgets (scaled down on low-perf) -----
  get budgets() {
    const s = this.lowPerf ? 0.4 : 1.0;
    return {
      villi: Math.round(2600 * s),
      bacteria: Math.round(1800 * s),
      bubbles: Math.round(220 * s),
      saliva: Math.round(260 * s),
      motes: Math.round(420 * s),
    };
  }

  _initRenderer() {
    const isDesktop = window.innerWidth >= 768 && !this.lowPerf;
    this.renderer = new THREE.WebGLRenderer({
      antialias: isDesktop,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowPerf ? 1.25 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x120d0a, 1);
    this.root.appendChild(this.renderer.domElement);
  }

  _initSceneCamera() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1a1012, 0.035);

    this.camera = new THREE.PerspectiveCamera(
      72, window.innerWidth / window.innerHeight, 0.05, 60
    );

    // Lighting: a warm key that we recolour per stage, plus a soft ambient and
    // a "headlamp" point light that travels with the camera so nearby flesh
    // always glistens.
    this.ambient = new THREE.AmbientLight(0xe8868c, 0.55);
    this.scene.add(this.ambient);

    this.key = new THREE.DirectionalLight(0xffffff, 0.8);
    this.key.position.set(2, 4, 2);
    this.scene.add(this.key);

    this.headlamp = new THREE.PointLight(0xffe9b0, 2.4, 14, 1.6);
    this.scene.add(this.headlamp);
  }

  // ----- the single curve through all six organs -----
  _buildCurve() {
    // Hand-laid control points: descend in Y, meander in X/Z so it reads like
    // a real tract. Segments are consecutive spans of this one curve.
    // mouth ~ top, then throat, stomach pocket, coiled small intestine, wider
    // colon loop, exit straight down to light.
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const pts = [
      // bite + mouth (open cavern, slight forward travel)
      P(0, 0, 0), P(0.2, -0.6, 0.4), P(-0.1, -1.4, 0.2),
      // esophagus — straightish tube down
      P(0.1, -2.6, 0), P(-0.1, -3.8, 0.1), P(0.05, -5.0, -0.1),
      // stomach — a big curved pocket to the side
      P(0.8, -6.0, 0.3), P(1.6, -6.7, -0.2), P(1.0, -7.6, -0.6), P(0.0, -7.9, 0.0),
      // small intestine — coils (the long showpiece)
      P(-1.0, -8.6, 0.6), P(-1.4, -9.4, -0.4), P(-0.6, -10.0, -1.0),
      P(0.4, -10.5, -0.3), P(1.0, -11.1, 0.6), P(0.3, -11.8, 1.2),
      P(-0.8, -12.3, 0.6), P(-1.2, -13.0, -0.4), P(-0.4, -13.6, -1.0),
      P(0.6, -14.1, -0.4), P(0.9, -14.8, 0.5),
      // large intestine — wider sweeping loop
      P(0.0, -15.6, 1.0), P(-1.2, -16.2, 0.4), P(-1.6, -17.0, -0.6),
      P(-0.6, -17.7, -1.0), P(0.6, -18.2, -0.4),
      // rectum + exit — straight drop toward the light
      P(0.2, -19.0, 0.0), P(0.0, -20.0, 0.0), P(0.0, -21.4, 0.0),
    ];
    this.curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    this.curveLen = this.curve.getLength();
  }

  // ----- continuous tube geometry for the whole tract -----
  _buildTube() {
    const segments = this.lowPerf ? 360 : 600;
    const radialSeg = this.lowPerf ? 14 : 22;
    const geo = new THREE.TubeGeometry(this.curve, segments, 0.85, radialSeg, false);

    // Store base positions + per-vertex curve-u so we can do peristalsis on GPU.
    const pos = geo.attributes.position;
    const count = pos.count;
    const uArr = new Float32Array(count);
    const uv = geo.attributes.uv;
    for (let i = 0; i < count; i++) {
      uArr[i] = uv.getX(i); // tube u runs 0..1 along length
    }
    geo.setAttribute("aU", new THREE.BufferAttribute(uArr, 1));

    // Wet, fleshy inner-wall material via onBeforeCompile: vertex sway for
    // peristalsis + radial constriction wave; fragment wet specular tint.
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc25a66,
      roughness: 0.35,
      metalness: 0.0,
      side: THREE.BackSide, // we fly *inside* the tube
      flatShading: false,
    });
    this.tubeUniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
    };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.tubeUniforms.uTime;
      shader.uniforms.uProgress = this.tubeUniforms.uProgress;
      shader.vertexShader =
        "attribute float aU;\nuniform float uTime;\nuniform float uProgress;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           // travelling sine constriction = peristalsis wave behind the camera
           float wavePhase = (aU - uProgress) * 38.0 - uTime * 2.2;
           float pinch = sin(wavePhase) * 0.5 + 0.5;
           pinch = pow(pinch, 3.0) * 0.16;
           // push vertices inward toward tube centerline (object normal points in for BackSide)
           transformed -= normal * pinch;
          `
        );
      // NOTE: an earlier "wet sheen banding" fragment effect was cut here — it
      // read as regular plastic ridges, against the "never plastic" direction.
      // The travelling headlamp's specular highlight sells wetness on its own.
    };

    this.tube = new THREE.Mesh(geo, mat);
    this.tube.frustumCulled = false;
    this.scene.add(this.tube);
    this.tubeMat = mat;
    this.disposables.push(geo, mat);
  }

  // Position helper: place an object on the tube wall at curve-u with offset.
  _onWall(u, radial, depth, inward = 0.0) {
    const t = THREE.MathUtils.clamp(u, 0, 1);
    const pt = this.curve.getPointAt(t, this._tmpV.clone());
    const tan = this.curve.getTangentAt(t, this._tmpV2.clone()).normalize();
    // build a frame
    const up = Math.abs(tan.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const nx = new THREE.Vector3().crossVectors(tan, up).normalize();
    const ny = new THREE.Vector3().crossVectors(tan, nx).normalize();
    const r = 0.85 - inward;
    pt.addScaledVector(nx, Math.cos(radial) * r * depth);
    pt.addScaledVector(ny, Math.sin(radial) * r * depth);
    return { pt: pt.clone(), nx, ny, tan };
  }

  // ============================ ORGANS ============================
  _buildOrgans() {
    this._buildMouth();
    this._buildStomach();
    this._buildSmallIntestine(); // the peak
    this._buildLargeIntestine();
    this._buildExit();
  }

  _group(id, uStart, uEnd) {
    const g = new THREE.Group();
    g.userData = { uStart, uEnd };
    this.scene.add(g);
    this.stageGroups[id] = g;
    return g;
  }

  // 1 · Mouth — vast teeth above/below, tongue floor, saliva droplets.
  _buildMouth() {
    const g = this._group("mouth", 0.0, 0.18);

    // Teeth as enamel monoliths arranged in two arcs (top + bottom).
    const toothGeo = new THREE.BoxGeometry(0.16, 0.34, 0.16);
    toothGeo.translate(0, 0.17, 0);
    const enamel = new THREE.MeshStandardMaterial({
      color: 0xf4efe4, roughness: 0.25, metalness: 0.0,
    });
    const teethCount = 26;
    const teeth = new THREE.InstancedMesh(toothGeo, enamel, teethCount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    this.toothPhase = [];
    for (let i = 0; i < teethCount; i++) {
      const top = i % 2 === 0;
      const idx = Math.floor(i / 2);
      const ang = (idx / 13) * Math.PI * 2;
      const u = 0.02 + (idx / 13) * 0.05;
      const frame = this._onWall(u, ang, 0.78);
      p.copy(frame.pt);
      const dir = top ? -1 : 1;
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, dir, 0));
      const h = 0.7 + Math.random() * 0.6;
      s.set(1, h, 1);
      m.compose(p, q, s);
      teeth.setMatrixAt(i, m);
      this.toothPhase.push({ base: p.clone(), dir, idx });
    }
    teeth.instanceMatrix.needsUpdate = true;
    teeth.frustumCulled = false;
    g.add(teeth);
    this.teeth = teeth;
    this.disposables.push(toothGeo, enamel);

    // Saliva droplets (instanced points-as-spheres).
    const dropGeo = new THREE.SphereGeometry(0.02, 6, 6);
    const dropMat = new THREE.MeshStandardMaterial({
      color: 0xfff6f3, roughness: 0.1, metalness: 0.0,
      transparent: true, opacity: 0.7,
    });
    const n = this.budgets.saliva;
    const drops = new THREE.InstancedMesh(dropGeo, dropMat, n);
    this.salivaData = [];
    for (let i = 0; i < n; i++) {
      const u = 0.02 + Math.random() * 0.12;
      const ang = Math.random() * Math.PI * 2;
      const frame = this._onWall(u, ang, Math.random() * 0.7);
      this.salivaData.push({ base: frame.pt.clone(), spd: 0.4 + Math.random() * 0.8, ph: Math.random() * 10 });
      m.compose(frame.pt, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      drops.setMatrixAt(i, m);
    }
    drops.instanceMatrix.needsUpdate = true;
    drops.frustumCulled = false;
    g.add(drops);
    this.saliva = drops;
    this.disposables.push(dropGeo, dropMat);
  }

  // 3 · Stomach — rugae folds, acid pool, rising bubbles.
  _buildStomach() {
    const g = this._group("stomach", 0.32, 0.52);

    // Rugae: wrinkled torus-ish ribs lining the chamber wall.
    const ribGeo = new THREE.TorusGeometry(0.7, 0.08, 8, 22);
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0x9b3d2e, roughness: 0.5, metalness: 0.0,
    });
    const ribCount = 10;
    const ribs = new THREE.InstancedMesh(ribGeo, ribMat, ribCount);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1,1,1);
    for (let i = 0; i < ribCount; i++) {
      const u = 0.36 + (i / ribCount) * 0.12;
      const pt = this.curve.getPointAt(u, this._tmpV.clone());
      const tan = this.curve.getTangentAt(u, this._tmpV2.clone()).normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
      const sc = 0.9 + Math.sin(i) * 0.2;
      m.compose(pt, q, s.set(sc, sc, 1));
      ribs.setMatrixAt(i, m);
    }
    ribs.instanceMatrix.needsUpdate = true;
    ribs.frustumCulled = false;
    g.add(ribs);
    this.disposables.push(ribGeo, ribMat);

    // Acid bubbles rising (instanced spheres).
    const bubGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const bubMat = new THREE.MeshStandardMaterial({
      color: 0xd98a3d, roughness: 0.15, metalness: 0.0,
      transparent: true, opacity: 0.55, emissive: 0x6b2f14, emissiveIntensity: 0.4,
    });
    const n = this.budgets.bubbles;
    const bub = new THREE.InstancedMesh(bubGeo, bubMat, n);
    this.bubbleData = [];
    for (let i = 0; i < n; i++) {
      const u = 0.36 + Math.random() * 0.12;
      const ang = Math.random() * Math.PI * 2;
      const frame = this._onWall(u, ang, 0.2 + Math.random() * 0.6);
      const sc = 0.5 + Math.random() * 1.5;
      this.bubbleData.push({ base: frame.pt.clone(), spd: 0.3 + Math.random() * 0.7, ph: Math.random() * 10, sc });
      m.compose(frame.pt, new THREE.Quaternion(), s.set(sc, sc, sc));
      bub.setMatrixAt(i, m);
    }
    bub.instanceMatrix.needsUpdate = true;
    bub.frustumCulled = false;
    g.add(bub);
    this.bubbles = bub;
    this.disposables.push(bubGeo, bubMat);
  }

  // 4 · Small intestine — THE CATHEDRAL. Thousands of swaying villi + glowing
  // nutrient motes drawn into the walls. Vertex-shader sway via InstancedMesh.
  _buildSmallIntestine() {
    const g = this._group("small", 0.48, 0.76);

    // A villus = a tapered capsule. Low-poly; we instance thousands.
    const villGeo = new THREE.CapsuleGeometry(0.018, 0.16, 3, 6);
    villGeo.translate(0, 0.1, 0); // root at origin

    const villMat = new THREE.MeshStandardMaterial({
      color: 0xd98c8c, roughness: 0.45, metalness: 0.0,
      emissive: 0xffe9b0, emissiveIntensity: 0.18,
    });

    // sway in the vertex shader: each instance gets a phase via instanceColor's
    // unused channel? Simpler: derive phase from instance world position in shader.
    this.villiUniforms = { uTime: { value: 0 } };
    villMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.villiUniforms.uTime;
      shader.vertexShader =
        "uniform float uTime;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           // phase from instance matrix translation (column 3)
           float ph = instanceMatrix[3].x * 7.3 + instanceMatrix[3].z * 5.1;
           float sway = sin(uTime * 1.6 + ph) * 0.18 + sin(uTime * 0.9 + ph * 1.7) * 0.08;
           // bend more toward the tip (transformed.y is height up the villus)
           float bend = smoothstep(0.0, 0.26, transformed.y);
           transformed.x += sway * bend;
           transformed.z += cos(uTime * 1.3 + ph) * 0.12 * bend;
          `
        );
    };

    const n = this.budgets.villi;
    const villi = new THREE.InstancedMesh(villGeo, villMat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const upV = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const u = 0.5 + Math.random() * 0.24;
      const ang = Math.random() * Math.PI * 2;
      const frame = this._onWall(u, ang, 1.0);
      // orient villus pointing inward (from wall toward centerline)
      const inward = new THREE.Vector3()
        .subVectors(this.curve.getPointAt(u, new THREE.Vector3()), frame.pt)
        .normalize();
      q.setFromUnitVectors(upV, inward);
      const h = 0.7 + Math.random() * 0.8;
      s.set(0.8 + Math.random() * 0.5, h, 0.8 + Math.random() * 0.5);
      m.compose(frame.pt, q, s);
      villi.setMatrixAt(i, m);
    }
    villi.instanceMatrix.needsUpdate = true;
    villi.frustumCulled = false;
    g.add(villi);
    this.villi = villi;
    this.disposables.push(villGeo, villMat);

    // Glowing nutrient motes that detach from "you" (the camera) and drift to walls.
    const moteGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const moteMat = new THREE.MeshBasicMaterial({
      color: 0xffe9b0, transparent: true, opacity: 0.9,
    });
    const mn = this.budgets.motes;
    const motes = new THREE.InstancedMesh(moteGeo, moteMat, mn);
    this.moteData = [];
    for (let i = 0; i < mn; i++) {
      const u = 0.5 + Math.random() * 0.24;
      const ang = Math.random() * Math.PI * 2;
      const target = this._onWall(u, ang, 0.95);
      // start near centerline, race outward into the wall
      const start = this.curve.getPointAt(u, new THREE.Vector3());
      this.moteData.push({
        u, start: start.clone(), target: target.pt.clone(),
        t: Math.random(), spd: 0.15 + Math.random() * 0.35,
      });
      m.compose(start, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      motes.setMatrixAt(i, m);
    }
    motes.instanceMatrix.needsUpdate = true;
    motes.frustumCulled = false;
    g.add(motes);
    this.motes = motes;
    this.disposables.push(moteGeo, moteMat);

    // A warm volumetric-ish glow: a big soft point light in the cathedral.
    const glow = new THREE.PointLight(0xffe9b0, 3.0, 10, 1.5);
    const gp = this.curve.getPointAt(0.62, new THREE.Vector3());
    glow.position.copy(gp);
    g.add(glow);
  }

  // 5 · Large intestine — microbiome swarm + fermentation gas bubbles.
  _buildLargeIntestine() {
    const g = this._group("large", 0.72, 0.92);

    // Microbes: tiny glowing instanced icosahedra swarming.
    const microGeo = new THREE.IcosahedronGeometry(0.025, 0);
    const microMat = new THREE.MeshStandardMaterial({
      color: 0x6f8a5a, emissive: 0x9fd07a, emissiveIntensity: 0.7,
      roughness: 0.6, metalness: 0.0,
    });
    const n = this.budgets.bacteria;
    const micro = new THREE.InstancedMesh(microGeo, microMat, n);
    this.microData = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const u = 0.74 + Math.random() * 0.16;
      const ang = Math.random() * Math.PI * 2;
      const frame = this._onWall(u, ang, Math.random() * 0.85);
      this.microData.push({
        base: frame.pt.clone(),
        amp: 0.05 + Math.random() * 0.12,
        spd: 0.5 + Math.random() * 1.5,
        ph: Math.random() * 10,
      });
      m.compose(frame.pt, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      micro.setMatrixAt(i, m);
    }
    micro.instanceMatrix.needsUpdate = true;
    micro.frustumCulled = false;
    g.add(micro);
    this.microbes = micro;
    this.disposables.push(microGeo, microMat);
  }

  // 6 · Exit — a final dark chamber and a literal light at the end of the tunnel.
  _buildExit() {
    const g = this._group("exit", 0.88, 1.0);
    // A bright disc placed at the very end of the curve = the light.
    const discGeo = new THREE.CircleGeometry(1.4, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xfbfaf6, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    const end = this.curve.getPointAt(1.0, new THREE.Vector3());
    const tan = this.curve.getTangentAt(1.0, new THREE.Vector3()).normalize();
    disc.position.copy(end).addScaledVector(tan, 1.6);
    disc.lookAt(this.camera.position);
    g.add(disc);
    this.exitDisc = disc;
    this.exitMat = discMat;
    this.disposables.push(discGeo, discMat);
  }

  // ============================ RUNTIME ============================

  setProgress(p) {
    this.progress = THREE.MathUtils.clamp(p, 0, 1);
    if (this.tubeUniforms) this.tubeUniforms.uProgress.value = this.progress;
  }

  setLook(yaw, pitch) {
    // clamped nudge — they gawk, they don't steer
    this.lookYaw = THREE.MathUtils.clamp(yaw, -0.55, 0.55);
    this.lookPitch = THREE.MathUtils.clamp(pitch, -0.4, 0.4);
  }

  // Crossfade fog + lights toward a stage palette (called by main on stage change).
  applyPalette(colors, fogDensity, dur = 1.4) {
    const fog = this.scene.fog;
    gsap.to(fog.color, {
      r: new THREE.Color(colors.fog).r,
      g: new THREE.Color(colors.fog).g,
      b: new THREE.Color(colors.fog).b,
      duration: dur, ease: "sine.inOut",
    });
    gsap.to(fog, { density: fogDensity, duration: dur, ease: "sine.inOut" });
    const c = new THREE.Color(colors.fog);
    gsap.to({ t: 0 }, {
      t: 1, duration: dur, ease: "sine.inOut",
      onUpdate: () => this.renderer.setClearColor(c, 1),
    });
    gsap.to(this.ambient.color, {
      r: new THREE.Color(colors.key).r, g: new THREE.Color(colors.key).g, b: new THREE.Color(colors.key).b,
      duration: dur, ease: "sine.inOut",
    });
    gsap.to(this.headlamp.color, {
      r: new THREE.Color(colors.accent).r, g: new THREE.Color(colors.accent).g, b: new THREE.Color(colors.accent).b,
      duration: dur, ease: "sine.inOut",
    });
    gsap.to(this.tubeMat.color, {
      r: new THREE.Color(colors.fill).r, g: new THREE.Color(colors.fill).g, b: new THREE.Color(colors.fill).b,
      duration: dur, ease: "sine.inOut",
    });
  }

  // Show only the organ group(s) near current progress.
  _cullGroups() {
    for (const id in this.stageGroups) {
      const g = this.stageGroups[id];
      const { uStart, uEnd } = g.userData;
      const pad = 0.06;
      g.visible = this.progress >= uStart - pad && this.progress <= uEnd + pad;
    }
  }

  // Sample camera position/orientation from the single curve.
  _updateCamera() {
    const p = this.progress;
    const pt = this.curve.getPointAt(p, this._tmpV);
    this.camera.position.copy(pt);

    // lookAt a point slightly ahead on the curve
    const ahead = Math.min(p + 0.012, 1);
    const la = this.curve.getPointAt(ahead, this._tmpV2);
    this._lookTarget.copy(la);
    this.camera.lookAt(this._lookTarget);

    // apply clamped user look nudge on top
    this.camera.rotateY(this.lookYaw);
    this.camera.rotateX(this.lookPitch);

    // headlamp rides with camera
    this.headlamp.position.copy(this.camera.position);
  }

  render() {
    const t = this.clock.getElapsedTime();
    if (this.tubeUniforms) this.tubeUniforms.uTime.value = t;
    if (this.villiUniforms) this.villiUniforms.uTime.value = t;

    this._cullGroups();
    this._updateCamera();
    this._animateInstances(t);

    this.renderer.render(this.scene, this.camera);
  }

  _animateInstances(t) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();

    // saliva: bob & fall
    if (this.saliva && this.stageGroups.mouth.visible) {
      const d = this.salivaData;
      for (let i = 0; i < d.length; i++) {
        const o = d[i];
        const fall = ((t * o.spd + o.ph) % 2) - 1;
        pos.copy(o.base);
        pos.y -= fall * 0.4;
        m.compose(pos, q, sc);
        this.saliva.setMatrixAt(i, m);
      }
      this.saliva.instanceMatrix.needsUpdate = true;
    }

    // teeth crush
    if (this.teeth && this.stageGroups.mouth.visible) {
      const crush = Math.max(0, Math.sin(t * 1.6)) * 0.18;
      for (let i = 0; i < this.toothPhase.length; i++) {
        const tp = this.toothPhase[i];
        pos.copy(tp.base);
        pos.y += tp.dir * crush * -1; // move toward centerline on crush
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, tp.dir, 0));
        m.compose(pos, q, new THREE.Vector3(1, 0.7 + (tp.idx % 3) * 0.2, 1));
        this.teeth.setMatrixAt(i, m);
      }
      this.teeth.instanceMatrix.needsUpdate = true;
    }

    // stomach bubbles rise
    if (this.bubbles && this.stageGroups.stomach.visible) {
      const d = this.bubbleData;
      for (let i = 0; i < d.length; i++) {
        const o = d[i];
        const rise = ((t * o.spd + o.ph) % 2);
        pos.copy(o.base);
        pos.y += rise * 0.5;
        sc.set(o.sc, o.sc, o.sc);
        m.compose(pos, q, sc);
        this.bubbles.setMatrixAt(i, m);
      }
      sc.set(1, 1, 1);
      this.bubbles.instanceMatrix.needsUpdate = true;
    }

    // nutrient motes: race from centerline into the wall, then respawn
    if (this.motes && this.stageGroups.small.visible) {
      const d = this.moteData;
      for (let i = 0; i < d.length; i++) {
        const o = d[i];
        o.t += o.spd * 0.016;
        if (o.t > 1) o.t = 0;
        pos.lerpVectors(o.start, o.target, o.t);
        const fade = 0.4 + 0.6 * Math.sin(o.t * Math.PI);
        sc.set(fade, fade, fade);
        m.compose(pos, q, sc);
        this.motes.setMatrixAt(i, m);
      }
      sc.set(1, 1, 1);
      this.motes.instanceMatrix.needsUpdate = true;
    }

    // microbes swarm
    if (this.microbes && this.stageGroups.large.visible) {
      const d = this.microData;
      for (let i = 0; i < d.length; i++) {
        const o = d[i];
        pos.copy(o.base);
        pos.x += Math.sin(t * o.spd + o.ph) * o.amp;
        pos.y += Math.cos(t * o.spd * 0.8 + o.ph) * o.amp;
        pos.z += Math.sin(t * o.spd * 1.2 + o.ph * 1.4) * o.amp;
        m.compose(pos, q, sc);
        this.microbes.setMatrixAt(i, m);
      }
      this.microbes.instanceMatrix.needsUpdate = true;
    }

    // exit light brightens as we approach the end
    if (this.exitMat) {
      const near = THREE.MathUtils.smoothstep(this.progress, 0.9, 1.0);
      this.exitMat.opacity = near;
      if (this.exitDisc) this.exitDisc.lookAt(this.camera.position);
    }
  }

  _bindResize() {
    this._onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener("resize", this._onResize);
  }

  dispose() {
    window.removeEventListener("resize", this._onResize);
    this.disposables.forEach((d) => d.dispose && d.dispose());
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
