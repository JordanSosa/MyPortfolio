// Toon shading + procedural canvas textures — the Flyff look, zero assets.

import * as THREE from "three";

// Stepped gradient ramp shared by every toon material (4-band cel shading).
let gradientMap = null;
export function toonRamp() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([90, 150, 215, 255]);
  gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const matCache = new Map();
export function toon(hex, opts = {}) {
  const key = typeof hex === "number" && !Object.keys(opts).length ? hex : null;
  if (key !== null && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color: hex, gradientMap: toonRamp(), ...opts });
  if (key !== null) matCache.set(key, m);
  return m;
}

function canvas(w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Subtle mottled overlay multiplied onto terrain vertex colors.
export function terrainDetailTexture() {
  const tex = canvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const g = 225 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgba(${g},${g},${g},0.5)`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 2 + Math.random() * 9, 2 + Math.random() * 9, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // sparse painterly darker dapples
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = "rgba(190,200,185,0.35)";
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 6, 2 + Math.random() * 4, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(48, 48);
  return tex;
}

// Grass tuft billboard (alpha-tested blades).
export function grassTexture() {
  return canvas(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = 6 + i * 6 + Math.random() * 4;
      const lean = (Math.random() - 0.5) * 14;
      const tall = 28 + Math.random() * 30;
      const grad = ctx.createLinearGradient(0, h, 0, h - tall);
      grad.addColorStop(0, "#7dbb4e");
      grad.addColorStop(1, "#b8e07a");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + lean * 0.4, h - tall * 0.6, x + lean, h - tall);
      ctx.stroke();
    }
  });
}

// Five-petal flower billboard.
export function flowerTexture(petalHex, centerHex = "#ffe082") {
  return canvas(64, 64, (ctx) => {
    ctx.clearRect(0, 0, 64, 64);
    // stem
    ctx.strokeStyle = "#6da84e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(32, 62);
    ctx.quadraticCurveTo(30, 44, 32, 30);
    ctx.stroke();
    // petals
    ctx.fillStyle = petalHex;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(32 + Math.cos(a) * 10, 22 + Math.sin(a) * 10, 8.5, 6.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = centerHex;
    ctx.beginPath();
    ctx.arc(32, 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.beginPath();
    ctx.arc(30, 20, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Soft radial glow sprite (sun, lamps, wisps, loot sparkle).
export function glowTexture(hex = "#ffffff") {
  return canvas(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, hex);
    g.addColorStop(0.35, hex + "aa");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

// Scrolling stylized water texture (light bands on blue).
export function waterTexture() {
  const tex = canvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#4fb0e8";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w, y = Math.random() * h, len = 12 + Math.random() * 30;
      ctx.globalAlpha = 0.25 + Math.random() * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y - 3, x + len, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  return tex;
}

// Roof tile stripes for houses.
export function roofTexture(baseHex, darkHex) {
  const tex = canvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = darkHex;
    for (let y = 0; y < h; y += 16) {
      ctx.fillRect(0, y + 12, w, 4);
      for (let x = (y / 16) % 2 ? 0 : 12; x < w; x += 24) ctx.fillRect(x, y, 3, 12);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Plaster + timber wall.
export function wallTexture(baseHex) {
  return canvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(140,100,60,0.9)";
    ctx.fillRect(0, 0, w, 7);
    ctx.fillRect(0, h - 7, w, 7);
    ctx.fillRect(10, 0, 6, h);
    ctx.fillRect(w - 16, 0, 6, h);
    ctx.fillRect(60, 0, 6, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = "rgba(0,0,0,0.03)";
      ctx.fillRect(Math.random() * w, Math.random() * h, 4, 4);
    }
  });
}
