import "./styles.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buildStages } from "./stages.js";
import { AudioEngine } from "./audio.js";

gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// main.js — boots the experience.
//
// Title + first caption are already in static HTML (readable before JS). We
// lazy-init the heavy three.js scene only after first paint, then wire scroll,
// look-drag, autoplay, storybook mode, audio, and accessibility fallbacks.
// ============================================================================

const dom = {
  root: document.getElementById("scene-root"),
  backdrop: document.getElementById("prepaint-backdrop"),
  title: document.getElementById("stage-title"),
  caption: document.getElementById("caption"),
  captionWrap: document.getElementById("caption-wrap"),
  titleCard: document.getElementById("title-card"),
  endCard: document.getElementById("end-card"),
  beginBtn: document.getElementById("begin-btn"),
  restartEnd: document.getElementById("restart-btn-end"),
  foodBtns: Array.from(document.querySelectorAll(".food-btn")),
  soundToggle: document.getElementById("sound-toggle"),
  storybookToggle: document.getElementById("storybook-toggle"),
  autoplayToggle: document.getElementById("autoplay-toggle"),
  restart: document.getElementById("restart-btn"),
  storybookNav: document.getElementById("storybook-nav"),
  sbPrev: document.getElementById("sb-prev"),
  sbNext: document.getElementById("sb-next"),
  sbPos: document.getElementById("sb-pos"),
  gutFill: document.getElementById("gut-fill"),
  progressGut: document.getElementById("progress-gut"),
};

const state = {
  food: "strawberry",
  stages: buildStages("strawberry"),
  scene: null,
  audio: new AudioEngine(),
  started: false,
  autoplay: false,
  autoplayProgress: 0,
  storybook: false,
  sbIndex: 0,
  currentStage: -1,
  progress: 0,
  rafId: null,
  matchMedia: null,
};

// Detect low-perf / mobile.
const lowPerf =
  window.innerWidth < 768 ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// --------------------------------------------------------------------------
// Food picker (changes bite caption + variant captions)
// --------------------------------------------------------------------------
dom.foodBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.food = btn.dataset.food;
    state.stages = buildStages(state.food);
    dom.foodBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    // refresh the visible bite caption immediately
    dom.caption.textContent = state.stages[0].caption;
  });
});

// --------------------------------------------------------------------------
// Caption / title display
// --------------------------------------------------------------------------
function showStage(i, opts = {}) {
  if (i === state.currentStage && !opts.force) return;
  state.currentStage = i;
  const stage = state.stages[i];
  if (!stage) return;

  dom.title.textContent = stage.title;
  gsap.fromTo(dom.title, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.6 });

  const text = opts.variant && stage[opts.variant] ? stage[opts.variant] : stage.caption;
  dom.caption.classList.toggle("thesis", !!stage.thesis);
  gsap.killTweensOf(dom.caption);
  gsap.to(dom.caption, {
    opacity: 0, duration: 0.3,
    onComplete: () => {
      dom.caption.textContent = text;
      gsap.to(dom.caption, { opacity: 1, duration: 0.6 });
    },
  });

  if (state.scene) {
    state.scene.applyPalette(stage.colors, stage.fogDensity);
    state.audio.setStage(i);
  }
}

// Determine stage index from progress.
function stageFromProgress(p) {
  for (let i = 0; i < state.stages.length; i++) {
    const s = state.stages[i];
    if (p >= s.pStart && p < s.pEnd) return i;
  }
  return state.stages.length - 1;
}

// --------------------------------------------------------------------------
// Lazy-init the 3D scene after first paint
// --------------------------------------------------------------------------
async function initScene() {
  if (state.scene) return;
  const { TractScene } = await import("./scene.js");
  state.scene = new TractScene(dom.root, { lowPerf, reduced: reduceMotion });
  dom.backdrop.classList.add("is-hidden");
  startRenderLoop();
}

// --------------------------------------------------------------------------
// Render loop (pauses on hidden tab)
// --------------------------------------------------------------------------
function startRenderLoop() {
  if (state.rafId) return;
  const tick = () => {
    if (!document.hidden && state.scene) {
      if (state.autoplay && state.started && !state.storybook) {
        state.autoplayProgress = Math.min(state.autoplayProgress + 0.0006, 1);
        applyProgress(state.autoplayProgress);
        // also drive the scrollbar so HUD/scrolltrigger agree
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, state.autoplayProgress * max);
      }
      state.scene.render();
    }
    state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.scene && !state.rafId) startRenderLoop();
});

// --------------------------------------------------------------------------
// Apply a progress value (0..1) to scene + HUD + captions
// --------------------------------------------------------------------------
function applyProgress(p) {
  state.progress = p;
  if (state.scene) state.scene.setProgress(p);

  // gut fill: rect grows from bottom up (y from 200 down to 0)
  const fillH = p * 200;
  dom.gutFill.setAttribute("y", String(200 - fillH));
  dom.gutFill.setAttribute("height", String(fillH));

  const si = stageFromProgress(p);

  // special sub-captions: swallow (start of esophagus), bile (start of small)
  if (si === 2 && p < 0.24) {
    showStage(2, { variant: "captionSwallow" });
  } else if (si === 4 && p < 0.56) {
    showStage(4, { variant: "captionBile" });
  } else {
    showStage(si);
  }

  // end card at the very end
  if (p >= 0.995) showEnd();
}

// --------------------------------------------------------------------------
// ScrollTrigger — single progress driver
// --------------------------------------------------------------------------
let scrollTriggerInst = null;
function setupScroll() {
  if (scrollTriggerInst) scrollTriggerInst.kill();
  scrollTriggerInst = ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
    onUpdate: (self) => {
      if (state.storybook || state.autoplay) return;
      applyProgress(self.progress);
    },
  });
}

// --------------------------------------------------------------------------
// Look-around: mouse / touch drag nudges camera (clamped)
// --------------------------------------------------------------------------
function setupLook() {
  let dragging = false, sx = 0, sy = 0, yaw = 0, pitch = 0;
  const onDown = (x, y) => { dragging = true; sx = x; sy = y; };
  const onMove = (x, y) => {
    if (!dragging || !state.scene) return;
    yaw = ((x - sx) / window.innerWidth) * 1.1;
    pitch = ((y - sy) / window.innerHeight) * 0.8;
    state.scene.setLook(-yaw, -pitch);
  };
  const onUp = () => {
    dragging = false;
    // ease back to neutral
    gsap.to({ y: yaw, p: pitch }, {
      y: 0, p: 0, duration: 0.8, ease: "power2.out",
      onUpdate: function () {
        if (state.scene) state.scene.setLook(-this.targets()[0].y, -this.targets()[0].p);
      },
    });
  };
  window.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchstart", (e) => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener("touchmove", (e) => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener("touchend", onUp);
}

// --------------------------------------------------------------------------
// Click / tap to advance (accessibility + mobile)
// --------------------------------------------------------------------------
function setupClickAdvance() {
  dom.root.addEventListener("click", () => {
    if (!state.started || state.storybook || state.autoplay) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const next = Math.min(state.progress + 0.06, 1);
    const startY = window.scrollY;
    const targetY = next * max;
    gsap.to({ y: startY }, {
      y: targetY, duration: 1.0, ease: "sine.inOut",
      onUpdate: function () { window.scrollTo(0, this.targets()[0].y); },
    });
  });
}

// --------------------------------------------------------------------------
// Start the journey
// --------------------------------------------------------------------------
async function begin() {
  if (state.started) return;
  state.started = true;
  dom.titleCard.classList.add("is-leaving");
  setTimeout(() => { dom.titleCard.hidden = true; }, 800);
  dom.progressGut.classList.add("is-on");

  await initScene();

  if (state.storybook || reduceMotion) {
    enterStorybook();
  } else {
    setupScroll();
    showStage(0, { force: true });
    applyProgress(0.001);
  }
}

dom.beginBtn.addEventListener("click", begin);

// --------------------------------------------------------------------------
// Restart
// --------------------------------------------------------------------------
function restart() {
  window.scrollTo(0, 0);
  state.autoplayProgress = 0;
  state.autoplay = false;
  dom.autoplayToggle.setAttribute("aria-pressed", "false");
  state.sbIndex = 0;
  state.currentStage = -1;
  dom.endCard.hidden = true;
  dom.titleCard.hidden = false;
  dom.titleCard.classList.remove("is-leaving");
  dom.progressGut.classList.remove("is-on");
  state.started = false;
  applyProgress(0);
  dom.caption.textContent = state.stages[0].caption;
  dom.title.textContent = "Swallowed";
}
dom.restart.addEventListener("click", restart);
dom.restartEnd.addEventListener("click", restart);

// --------------------------------------------------------------------------
// End card
// --------------------------------------------------------------------------
function showEnd() {
  if (!dom.endCard.hidden) return;
  dom.endCard.hidden = false;
  gsap.fromTo(dom.endCard, { opacity: 0 }, { opacity: 1, duration: 1.2 });
}

// --------------------------------------------------------------------------
// Sound toggle (opt-in, off by default, needs gesture)
// --------------------------------------------------------------------------
dom.soundToggle.addEventListener("click", () => {
  const on = state.audio.toggle();
  dom.soundToggle.setAttribute("aria-pressed", on ? "true" : "false");
  dom.soundToggle.querySelector(".ctl-label").textContent = on ? "Sound on" : "Sound off";
  if (on) state.audio.setStage(Math.max(0, state.currentStage));
});

// --------------------------------------------------------------------------
// Auto-play toggle
// --------------------------------------------------------------------------
dom.autoplayToggle.addEventListener("click", () => {
  state.autoplay = !state.autoplay;
  dom.autoplayToggle.setAttribute("aria-pressed", state.autoplay ? "true" : "false");
  if (state.autoplay) {
    state.autoplayProgress = state.progress;
    if (!state.started) begin();
  }
});

// --------------------------------------------------------------------------
// Storybook mode — still tableaus, button-advanced, same captions.
// Offered to EVERYONE; auto-on for reduced-motion.
// --------------------------------------------------------------------------
function setupMatchMedia() {
  // wrap all JS-driven motion so reduced-motion users never get the fly-through
  state.matchMedia = gsap.matchMedia();
  state.matchMedia.add("(prefers-reduced-motion: no-preference)", () => {
    // motion path: nothing extra needed here; scroll/autoplay handle it.
    return () => {};
  });
}

function enterStorybook() {
  state.storybook = true;
  document.body.classList.add("storybook");
  dom.storybookToggle.setAttribute("aria-pressed", "true");
  dom.storybookNav.hidden = false;
  if (scrollTriggerInst) scrollTriggerInst.disable();
  state.autoplay = false;
  dom.autoplayToggle.setAttribute("aria-pressed", "false");
  state.sbIndex = 0;
  goStorybook(0);
}

function exitStorybook() {
  state.storybook = false;
  document.body.classList.remove("storybook");
  dom.storybookToggle.setAttribute("aria-pressed", "false");
  dom.storybookNav.hidden = true;
  if (scrollTriggerInst) scrollTriggerInst.enable();
  else setupScroll();
}

function goStorybook(i) {
  state.sbIndex = Math.max(0, Math.min(state.stages.length - 1, i));
  const stage = state.stages[state.sbIndex];
  // sample the middle of the stage's progress window for a still tableau
  const mid = (stage.pStart + stage.pEnd) / 2;
  applyProgress(mid);
  showStage(state.sbIndex, { force: true });
  dom.sbPos.textContent = `${state.sbIndex + 1} / ${state.stages.length}`;
  dom.sbPrev.disabled = state.sbIndex === 0;
  dom.sbNext.disabled = state.sbIndex === state.stages.length - 1;
  if (state.sbIndex === state.stages.length - 1) {
    // show end card option in storybook too
    setTimeout(showEnd, 600);
  }
}

dom.storybookToggle.addEventListener("click", () => {
  if (!state.started) begin();
  if (state.storybook) exitStorybook();
  else enterStorybook();
});
dom.sbPrev.addEventListener("click", () => goStorybook(state.sbIndex - 1));
dom.sbNext.addEventListener("click", () => goStorybook(state.sbIndex + 1));

// keyboard: arrows advance in storybook
window.addEventListener("keydown", (e) => {
  if (!state.storybook) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") goStorybook(state.sbIndex + 1);
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") goStorybook(state.sbIndex - 1);
});

// --------------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------------
function boot() {
  setupMatchMedia();
  setupLook();
  setupClickAdvance();
  // honour reduced-motion: pre-flip the storybook control so users see it's on
  if (reduceMotion) {
    dom.storybookToggle.setAttribute("aria-pressed", "true");
  }
  // first caption already in HTML; nothing else to paint before gesture.
}

// init after first paint so title/caption are visible immediately
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(boot));
} else {
  requestAnimationFrame(boot);
}

// expose for debugging / verification
window.__swallowed = state;
