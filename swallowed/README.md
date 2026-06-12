# Swallowed

An immersive single-page 3D experience. **You are a piece of food** travelling
through the human digestive tract in first person — from bite to exit. Part
*Planet Earth*, part theme-park dark ride: vivid, visceral, and reverent about
how astonishing the body is. Blood and acid are awe, not splatter.

Built with **Vite + vanilla JS + three.js + GSAP** (ScrollTrigger). No
framework, no router, no backend, no analytics, no cookies.

## How it works

- **Scroll is peristalsis.** One `THREE.CatmullRomCurve3` runs through all six
  organs end to end. A single GSAP `ScrollTrigger` (`scrub: 1`) drives one
  progress value; the camera position and lookAt are sampled from the curve at
  that progress, flying you through continuous tube geometry.
- **You are passive cargo.** Mouse / touch drag nudges the camera's local
  rotation (clamped) so you can gawk at villi without steering. Click/tap to
  advance and an auto-play toggle are provided for accessibility and mobile.
- **Six organ segments** (mouth → esophagus → stomach → small intestine →
  large intestine → exit) are consecutive spans of the one curve. Each is a
  group whose visibility toggles based on proximity to the camera, so the whole
  tract is never active at once.

## Build & run

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run preview    # serve the built site locally
```

### Deploy (Cloudflare Pages / Netlify / GitHub Pages)

It's a static build. Point your host at:

- **Build command:** `npm run build`
- **Publish directory:** `dist`

`vite.config.js` reads `base` from `process.env.BASE_PATH || "/"`. Root-domain
hosts (Cloudflare Pages, Netlify) need nothing extra. For a sub-path deploy
(e.g. GitHub Pages under `/MyPortfolio/swallowed/`), set the env var at build
time:

```bash
BASE_PATH=/MyPortfolio/swallowed/ npm run build
```

## Tuning villi / particle counts for performance

All repeated geometry (villi, bacteria, bubbles, saliva, nutrient motes) is
drawn with `InstancedMesh` — never thousands of individual meshes. The counts
live in **one place**: the `budgets` getter in `src/scene.js`.

```js
get budgets() {
  const s = this.lowPerf ? 0.4 : 1.0;   // global scale factor
  return {
    villi: Math.round(2600 * s),
    bacteria: Math.round(1800 * s),
    bubbles: Math.round(220 * s),
    saliva: Math.round(260 * s),
    motes: Math.round(420 * s),
  };
}
```

- To make it lighter everywhere, lower the base numbers or the `s` multiplier.
- `lowPerf` is auto-detected (`window.innerWidth < 768` or
  `navigator.deviceMemory <= 4`) and already cuts counts ~60%, drops the pixel
  ratio, disables antialiasing, and lowers tube tessellation.
- The tube tessellation (`segments`, `radialSeg`) is also in `_buildTube()`.
- If a device still can't hold ~40fps, switch on **Storybook mode** (still,
  lit tableaus advanced by button) — it skips the fly-through and churn
  entirely.

## Accessibility

- `prefers-reduced-motion: reduce` → Storybook mode automatically: no flying
  camera, no churn, no shake — the same six captions as still tableaus,
  advanced by button or arrow keys. All motion is wrapped in
  `gsap.matchMedia()`. The Storybook toggle is offered to **everyone**.
- Captions are exposed to screen readers via `aria-live`. All controls are
  keyboard-operable with visible `:focus-visible` states. Caption text sits on
  a subtle scrim for AA contrast.
- Audio is **opt-in and off by default** — synthesised live with WebAudio
  (oscillators + filtered noise), no fetched files, never autoplayed.

## Proudest scene / would polish next

**Proudest: the small intestine — the cathedral.** It's the emotional and
visual peak, and it earns it: thousands of villi instanced via `InstancedMesh`
sway in a vertex shader like an underwater meadow of golden grass, while glowing
nutrient motes detach from "you" and race into the walls — you literally watch
your nutrients leave you to become someone else. The warm gold palette, the soft
in-scene point light, and the italic thesis caption ("this is where you become
someone else") land the reverent *Planet Earth* tone the brief asked for.

**Would polish next:** real subsurface scattering on the villi (right now warmth
is faked with emissive + a roughness/specular cheat), a capillary network that
visibly *lights up* as each mote is absorbed (currently the motes are absorbed
but the downstream bloodstream is implied rather than shown), and GPU-driven
mote motion so the per-frame `InstancedMesh.setMatrixAt` loop moves onto the
shader for higher counts on mid-range hardware.
