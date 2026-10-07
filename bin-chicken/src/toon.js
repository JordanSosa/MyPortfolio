// Toon shading helpers, inked outlines and procedural canvas textures.
// Everything in the game is built from primitives — zero image assets.

import * as THREE from "three";

let ramp = null;
export function toonRamp() {
  if (ramp) return ramp;
  const data = new Uint8Array([110, 170, 225, 255]);
  ramp = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

const matCache = new Map();
export function toon(color, opts) {
  if (!opts && matCache.has(color)) return matCache.get(color);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...opts });
  if (!opts) matCache.set(color, m);
  return m;
}

// Inverted-hull outline: a back-face copy pushed out along its normals.
const outlineCache = new Map();
function outlineMaterial(thickness) {
  if (outlineCache.has(thickness)) return outlineCache.get(thickness);
  const m = new THREE.ShaderMaterial({
    uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(0x1d1612) } },
    vertexShader: /* glsl */ `
      uniform float thickness;
      void main() {
        vec3 p = position + normal * thickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() { gl_FragColor = vec4(color, 1.0); }`,
    side: THREE.BackSide,
  });
  outlineCache.set(thickness, m);
  return m;
}

export function addOutline(mesh, thickness = 0.03) {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
  o.castShadow = false;
  o.receiveShadow = false;
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}

// One mesh with the shared toon material, shadows and an optional outline.
export function part(geo, color, { outline = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, toon(color));
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (outline) addOutline(m, outline);
  return m;
}

export function canvasTexture(w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function grassTexture() {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const g = 215 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgba(${g},${g + 5 > 255 ? 255 : g + 5},${g},0.55)`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 2 + Math.random() * 6, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(170,190,160,0.35)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 5);
      ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 26);
  return tex;
}

export function checkerTexture(a, b, n = 8) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const s = w / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? a : b;
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    // woven stripes over the checks
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < n; i++) ctx.fillRect(i * s + s * 0.4, 0, s * 0.2, h);
  });
}

export function stripeTexture(a, b, n = 8) {
  return canvasTexture(128, 32, (ctx, w, h) => {
    const s = w / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect(i * s, 0, s, h);
    }
  });
}

export function signTexture(text, bg, fg) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = fg;
    ctx.font = "bold 64px 'Lilita One', 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}
