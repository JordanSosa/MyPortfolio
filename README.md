# MyPortfolio

A collection of self-contained, statically-hosted interactive web builds,
deployed together to GitHub Pages.

**Live:** https://jordansosa.github.io/MyPortfolio/

## Layout

This repo hosts several independent sites under one GitHub Pages deployment.
Each project builds into its own sub-path; a landing page ties them together.

| Path | Source | What it is |
| --- | --- | --- |
| `/` | [`homepage/`](./homepage/) | Landing page linking to each project |
| `/corp-sec-desk/` | [`corp-sec-desk/`](./corp-sec-desk/) | Fixed-fee ASIC corporate secretarial one-pager (Vite + three.js + GSAP) |
| `/swallowed/` | [`swallowed/`](./swallowed/) | "Swallowed" — a first-person 3D journey through the digestive system (Vite + three.js + GSAP) |
| `/aethermoor/` | [`aethermoor/`](./aethermoor/) | "Aethermoor" — a browser MMO vertical slice: Flyff × Path of Exile (Vite + three.js + WebAudio). See its [game design document](./aethermoor/GDD.md) |

## Non-deployed folders

| Path | What it is |
| --- | --- |
| [`business/`](./business/) | Operating pack for a low-touch Australian micro-SaaS — structure, task lists, runbooks. Documentation only; not part of the Pages build |

## How deployment works

`.github/workflows/deploy-pages.yml` runs on every push to `master` that
touches `homepage/`, `corp-sec-desk/`, `swallowed/`, or `aethermoor/`. It:

1. Builds each Vite project with its `BASE_PATH` set to its sub-path
   (e.g. `/MyPortfolio/swallowed/`) so asset URLs resolve correctly.
2. Assembles a single `_site/` tree — `homepage/` at the root, each
   project's `dist/` in its own subfolder.
3. Publishes that tree to GitHub Pages.

Pages must be enabled once at **Settings → Pages → Source: GitHub Actions**.

## Adding another project

1. Create a new Vite project folder with a `vite.config.js` that reads
   `base` from `process.env.BASE_PATH || "/"` (copy an existing one).
2. Add a build step + a copy line for it in `deploy-pages.yml`, and add it
   to the `paths:` trigger.
3. Add a card linking to `./<folder>/` in `homepage/index.html`.

## Working on a project locally

```sh
cd swallowed   # or corp-sec-desk
npm install
npm run dev
```

The landing page (`homepage/`) is plain static HTML with no build step —
open `homepage/index.html` directly, or browse the assembled site after a
deploy.
