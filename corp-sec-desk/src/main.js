import { initMotion } from "./motion.js";
import { initAccordion } from "./accordion.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

initMotion();
initAccordion();

// Lazy-init the three.js hero scene after first paint. The hero headline,
// CTA, and the static SVG end-state are all present and readable before
// (and without) this running.
if (!reducedMotion.matches) {
  const start = () => {
    import("./scene.js").then(({ initScene }) => {
      const container = document.querySelector(".hero-scene");
      if (!container) return;
      const small =
        window.matchMedia("(max-width: 767px)").matches ||
        (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 4);
      initScene(container, { count: small ? 40 : 120 });
    });
  };
  // Two rAFs guarantee we are past the first paint; idle callback keeps the
  // main thread clear for LCP.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(start, { timeout: 1500 });
      } else {
        setTimeout(start, 200);
      }
    })
  );
}
