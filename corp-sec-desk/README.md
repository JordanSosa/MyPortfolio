# Corp-Sec Desk — one-page site

Single-page static marketing site for a fixed-fee ASIC corporate secretarial
desk serving small Australian accounting firms.

- **Stack:** Vite + vanilla JS (ES modules), `three` and `gsap` (ScrollTrigger) via npm. No framework, no router, no backend, no analytics, no cookies.
- **Signature element:** a three.js hero scene — ~120 translucent paper documents drifting in disarray that align into an ordered grid as you scroll ("chaos to order").
- **Fonts:** Archivo (display), Public Sans (body), IBM Plex Mono (figures), self-hosted via `@fontsource`.

## Before deploying

Fill in every bracketed placeholder — see [`PLACEHOLDERS.md`](./PLACEHOLDERS.md).

## Develop

```sh
npm install
npm run dev
```

Open the printed local URL (defaults to `http://localhost:5173`).

## Build

```sh
npm run build
```

The static output is written to `dist/`. Preview the production build locally:

```sh
npm run preview
```

## Deploy

The build is fully static; any static host works.

### Cloudflare Pages

1. Push this directory to a Git repository and create a new Pages project
   from it (Workers & Pages → Create → Pages → Connect to Git).
2. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** path to this folder if it lives in a monorepo
     (e.g. `corp-sec-desk`).
3. Deploy. No environment variables are required.

Or deploy directly from your machine:

```sh
npm run build
npx wrangler pages deploy dist
```

### Netlify

1. Create a new site from Git (Add new site → Import an existing project).
2. Build settings:
   - **Base directory:** this folder if it lives in a monorepo
     (e.g. `corp-sec-desk`)
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Deploy. No environment variables are required.

Or deploy directly from your machine:

```sh
npm run build
npx netlify deploy --prod --dir=dist
```

## Accessibility and performance notes

- Semantic HTML, a single `h1`, labelled landmarks, visible
  `:focus-visible` states, AA contrast throughout.
- Fully readable with JavaScript disabled: all content and the fee table are
  plain HTML, the FAQ uses native `<details>` elements, and the hero falls
  back to a static SVG of the ordered end-state.
- `prefers-reduced-motion: reduce` disables all scroll animation
  (via `gsap.matchMedia()`) and the three.js scene never initialises;
  the static end-state is shown instead.
- On small screens (`< 768px`) or low-memory devices
  (`navigator.deviceMemory <= 4`) the scene runs with ~40 documents instead
  of ~120.
- The scene lazy-initialises after first paint, caps pixel ratio at 2,
  enables antialiasing on desktop only, and pauses rendering when the tab is
  hidden or the hero is out of the viewport.
