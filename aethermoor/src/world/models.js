// Generated-character loader: GLB models from public/models/<name>/ with
// per-clip animation GLBs, cel-shade material swap, scale normalization,
// and an animation state machine driven by entity state.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";
import { toonRamp } from "./toon.js";

const loader = new GLTFLoader();
const registry = new Map(); // name -> {template, clips:{key:AnimationClip}, height}

const CLIP_KEYS = ["idle", "walk", "run", "slash", "hurt", "die"];

function loadGlb(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function toToon(root) {
  root.traverse((o) => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.length === 1
        ? convertMat(mats[0])
        : mats.map(convertMat);
      o.castShadow = true;
      o.frustumCulled = false; // skinned meshes move; avoid culling pops
    }
  });
}

function convertMat(src) {
  return new THREE.MeshToonMaterial({
    map: src.map || null,
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    gradientMap: toonRamp(),
    transparent: !!src.transparent,
    opacity: src.opacity ?? 1,
  });
}

// Load a character: base rigged model + one GLB per animation clip.
export async function loadCharacter(name, targetHeight = 1.9) {
  if (registry.has(name)) return registry.get(name);
  const base = `${import.meta.env.BASE_URL}models/${name}`;
  let manifest;
  try {
    manifest = await (await fetch(`${base}/manifest.json`)).json();
  } catch {
    return null; // no generated assets for this name
  }

  // the idle clip's GLB doubles as the mesh source (rigged + posed)
  const meshFile = manifest.anims?.idle || manifest.files?.rigged || manifest.files?.base;
  if (!meshFile) return null;
  const gltf = await loadGlb(`${base}/${typeof meshFile === "string" ? meshFile : meshFile.file}`);
  const template = gltf.scene;
  toToon(template);

  // normalize scale/origin: feet at y=0, targetHeight tall
  const box = new THREE.Box3().setFromObject(template);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 0.001);
  const wrapper = new THREE.Group();
  template.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(template);
  template.position.y -= box2.min.y;
  template.position.x -= (box2.min.x + box2.max.x) / 2;
  template.position.z -= (box2.min.z + box2.max.z) / 2;
  wrapper.add(template);

  const clips = {};
  if (gltf.animations?.length) clips.idle = gltf.animations[0];
  await Promise.all(Object.entries(manifest.anims || {}).map(async ([key, file]) => {
    if (key === "idle" || typeof file !== "string") return;
    try {
      const g = await loadGlb(`${base}/${file}`);
      if (g.animations?.length) clips[key] = g.animations[0];
    } catch { /* missing clip is non-fatal */ }
  }));

  const entry = { template: wrapper, clips, name };
  registry.set(name, entry);
  return entry;
}

// Instantiate a playable character with its animation controller.
export function instantiate(entry) {
  const mesh = skeletonClone(entry.template);
  const inner = mesh.children[0];
  const mixer = new THREE.AnimationMixer(inner);
  const actions = {};
  for (const [key, clip] of Object.entries(entry.clips)) {
    actions[key] = mixer.clipAction(clip);
    if (key === "slash" || key === "hurt" || key === "die") {
      actions[key].setLoop(THREE.LoopOnce, 1);
      actions[key].clampWhenFinished = key === "die";
    }
  }
  const ctl = {
    mesh, mixer, actions, current: null,
    play(key, fade = 0.18) {
      if (!this.actions[key] || this.current === key) return;
      const next = this.actions[key];
      next.reset().fadeIn(fade).play();
      if (this.current && this.actions[this.current]) this.actions[this.current].fadeOut(fade);
      this.current = key;
    },
    // one-shot overlay (attack/hurt) that returns to a base state
    oneShot(key, then = "idle", fade = 0.1) {
      const a = this.actions[key];
      if (!a) return 0;
      this.play(key, fade);
      const dur = a.getClip().duration;
      return dur;
    },
    update(dt) { this.mixer.update(dt); },
  };
  return ctl;
}

// Attach a prop (weapon) to the skeleton's right hand if one can be found.
export function attachToHand(ctl, prop) {
  let hand = null;
  ctl.mesh.traverse((o) => {
    if (hand) return;
    if (o.isBone && /hand|wrist/i.test(o.name) && /r($|[._-])|right/i.test(o.name)) hand = o;
  });
  if (!hand) {
    ctl.mesh.traverse((o) => { if (!hand && o.isBone && /hand|wrist/i.test(o.name)) hand = o; });
  }
  if (hand) {
    hand.add(prop);
    return true;
  }
  return false;
}
