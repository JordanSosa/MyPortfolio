import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initMotion() {
  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    heroIntro();
    sectionReveals();
    feeCounters();
  });
}

/* Hero headline lines stagger in once on load: y 24px, opacity,
   0.08s stagger, well under 0.9s total. */
function heroIntro() {
  gsap.from(".hero-line", {
    y: 24,
    autoAlpha: 0,
    duration: 0.6,
    stagger: 0.08,
    ease: "power2.out",
  });
  gsap.from(".hero-sub, .hero-cta", {
    y: 24,
    autoAlpha: 0,
    duration: 0.6,
    delay: 0.16,
    stagger: 0.08,
    ease: "power2.out",
  });
}

/* One fade-up reveal per section. */
function sectionReveals() {
  document.querySelectorAll("[data-reveal]").forEach((section) => {
    gsap.from(section.querySelector(".container"), {
      y: 28,
      autoAlpha: 0,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: {
        trigger: section,
        start: "top 82%",
        once: true,
      },
    });
  });
}

/* Fee amounts count up once when the table enters the viewport.
   Final values are already in the markup (no-JS safe); widths are locked
   before animating so there is zero layout shift. */
function feeCounters() {
  const figures = document.querySelectorAll(".fee-figure[data-count]");
  if (!figures.length) return;

  figures.forEach((el) => {
    el.style.display = "inline-block";
    el.style.minWidth = `${Math.ceil(el.getBoundingClientRect().width)}px`;
    el.style.textAlign = "right";
  });

  ScrollTrigger.create({
    trigger: ".fee-table",
    start: "top 80%",
    once: true,
    onEnter: () => {
      figures.forEach((el) => {
        const target = parseInt(el.dataset.count, 10);
        const prefix = el.dataset.prefix || "";
        const suffix = el.dataset.suffix || "";
        const state = { value: 0 };
        gsap.to(state, {
          value: target,
          duration: 1.1,
          ease: "power1.out",
          onUpdate: () => {
            el.textContent = `${prefix}${Math.round(state.value)}${suffix}`;
          },
        });
      });
    },
  });
}
