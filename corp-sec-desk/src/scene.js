/* "Chaos to order" — the signature hero scene.
   A field of thin translucent paper-toned rectangles drifting in disarray;
   on scroll they tween into a neat aligned grid. One GSAP timeline,
   scrubbed by ScrollTrigger (scrub: 0.8), interpolates every document
   from its scattered transform to its grid slot. */
import {
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const INK = 0x11181a;
const PAPER = 0xf2efe7;
const LEDGER_GREEN = 0x2e6b4e;

const DOC_W = 0.55;
const DOC_H = 0.72;
const CAMERA_Z = 14;
const FOV = 35;

// Deterministic PRNG so the scatter looks considered, not random per load.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initScene(container, { count = 120 } = {}) {
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;

  const renderer = new WebGLRenderer({
    antialias: isDesktop,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(INK, 1);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(INK);

  const camera = new PerspectiveCamera(
    FOV,
    container.clientWidth / container.clientHeight,
    0.1,
    50
  );
  camera.position.z = CAMERA_Z;

  // World-space size of the viewport at z = 0.
  const viewSize = () => {
    const h = 2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360);
    return { w: h * camera.aspect, h };
  };

  const rand = mulberry32(20260612);
  const geometry = new PlaneGeometry(DOC_W, DOC_H);
  const edgeGeometry = new EdgesGeometry(geometry);
  const group = new Group();
  scene.add(group);

  const docs = [];
  const { w: vw, h: vh } = viewSize();

  // Grid layout: roughly viewport-shaped.
  const cols = Math.round(Math.sqrt((count * vw) / vh));
  const rows = Math.ceil(count / cols);
  const gridW = vw * 0.86;
  const gridH = vh * 0.82;

  for (let i = 0; i < count; i++) {
    const tone = 0.05 + rand() * 0.1;
    const material = new MeshBasicMaterial({
      color: PAPER,
      transparent: true,
      opacity: tone,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);

    // A few documents carry ledger-green edges; the rest stay plain.
    if (rand() < 0.09) {
      const edges = new LineSegments(
        edgeGeometry,
        new LineBasicMaterial({
          color: LEDGER_GREEN,
          transparent: true,
          opacity: 0.6,
        })
      );
      mesh.add(edges);
    }

    const col = i % cols;
    const row = Math.floor(i / cols);
    const doc = {
      mesh,
      scatter: {
        x: (rand() - 0.5) * vw * 1.15,
        y: (rand() - 0.5) * vh * 1.15,
        z: (rand() - 0.5) * 4,
        rx: (rand() - 0.5) * 0.7,
        ry: (rand() - 0.5) * 0.7,
        rz: (rand() - 0.5) * 0.9,
      },
      slot: {
        x: cols > 1 ? (col / (cols - 1) - 0.5) * gridW : 0,
        y: rows > 1 ? (0.5 - row / (rows - 1)) * gridH : 0,
        z: 0,
      },
      // Slow noise-based idle drift, rotation kept ≤ 0.15 rad.
      drift: {
        phase: rand() * Math.PI * 2,
        speed: 0.12 + rand() * 0.18,
        amp: 0.18 + rand() * 0.3,
        rot: 0.06 + rand() * 0.08,
      },
      // Small per-document offset so alignment cascades, not snaps.
      delay: rand() * 0.25,
    };
    group.add(mesh);
    docs.push(doc);
  }

  // Single scrub-driven progress value: 0 = scattered, 1 = ordered grid.
  const progress = { t: 0 };
  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom 25%",
      scrub: 0.8,
    },
  });
  timeline.to(progress, { t: 1, ease: "none" });

  const smooth = (x) => x * x * (3 - 2 * x);

  function update(timeSec) {
    for (const doc of docs) {
      const { mesh, scatter, slot, drift, delay } = doc;
      const local = Math.min(
        Math.max((progress.t - delay) / (1 - delay), 0),
        1
      );
      const t = smooth(local);
      const idle = 1 - t;

      const p = drift.phase + timeSec * drift.speed;
      const dx = Math.sin(p) * drift.amp * idle;
      const dy = Math.cos(p * 0.83 + 1.7) * drift.amp * 0.7 * idle;
      const dr = Math.sin(p * 0.61) * drift.rot * idle;

      mesh.position.set(
        scatter.x + (slot.x - scatter.x) * t + dx,
        scatter.y + (slot.y - scatter.y) * t + dy,
        scatter.z + (slot.z - scatter.z) * t
      );
      mesh.rotation.set(
        scatter.rx * idle + dr,
        scatter.ry * idle + dr * 0.6,
        scatter.rz * idle + dr * 0.4
      );
    }
    renderer.render(scene, camera);
  }

  // Render loop: paused when the tab is hidden or the hero leaves the
  // viewport.
  let rafId = null;
  let inView = true;

  function loop(timeMs) {
    rafId = null;
    update(timeMs / 1000);
    schedule();
  }

  function schedule() {
    if (rafId === null && inView && !document.hidden) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function halt() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) schedule();
    else halt();
  });
  observer.observe(container);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) halt();
    else schedule();
  });

  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // The canvas now owns the background; drop the static fallback layer.
  const staticLayer = container.querySelector(".hero-static");
  if (staticLayer) staticLayer.style.display = "none";

  schedule();
}
