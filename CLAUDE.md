# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, dependency-light personal photo gallery with no framework and no bundler: the browser runs `src/app.js` as a native ES module, and all image processing happens at build time in Node via Sharp.

## Commands

- `npm install` — install build deps (sharp, fs-extra, glob, chokidar).
- `npm run build` — process every image in `src/images/` and regenerate `public/`.
- `npm run dev` — build once, serve `public/` (`npx serve`), then watch `src/` and rebuild on any change.
- `npm run add <path> [<path>...]` — copy external image files into `src/images/` (skips names that already exist); follow with a build.
- `npm start` — serve an already-built `public/` without building or watching.

There are no tests and no linter (the `test` script is a placeholder that exits 1).

## Architecture

The project is split into a **build stage** (Node) and a **runtime stage** (browser), connected by a single generated file, `public/data.json`.

**Build — `scripts/build.js`** is the core of the project. For each image under `src/images/` it uses Sharp to produce:
- an optimized full image (≤1920px wide, mozjpeg q80) → `public/images/`
- a 400px thumbnail (q70) → `public/thumbnails/`
- the dominant color (shown as the tile background before load)
- a 20px blurred base64 data-URI placeholder (the blur-up effect)
- intrinsic width/height/aspectRatio

It writes all of that as an array of records to `public/data.json`, then copies `index.html`, `style.css`, and `app.js` verbatim into `public/`. Encoding is incremental — it skips re-encoding an image when the `public/` copy is newer than the source (mtime check), but always recomputes the metadata/placeholder/color and rewrites `data.json`.

**Runtime — `src/app.js`** fetches `data.json`, builds the gallery DOM, and wires up three things: blur-up image loading (the placeholder data-URI sits in an aspect-ratio padding box that reserves height so there's no layout shift; the thumbnail fades in via a `.loaded` class added on `<img>` load), the PhotoSwipe lightbox (with a custom download button), and a GSAP `ScrollTrigger.batch` scroll-reveal. Dark mode follows `prefers-color-scheme` by toggling `data-theme="dark"` on `<html>`.

**Layout** is CSS-column masonry (`column-count` of 1/2/3/4 at the 600/900/1200px breakpoints), so DOM order is not the visual top-to-bottom order.

### Things that bite

- **`src/` is the only source of truth; `public/` is generated and gitignored.** Never edit files in `public/` — the next build overwrites them. To change the site, edit `src/*` and rebuild.
- **`data.json` is the build↔runtime contract.** Each record is `{ src, thumb, placeholder, color, width, height, aspectRatio, alt }`, with `src`/`thumb` as paths relative to `public/`. Changing what the gallery renders usually means changing both what `build.js` emits and how `app.js` consumes it.
- **Runtime libraries are not bundled.** PhotoSwipe (unpkg, ESM `import`) and GSAP (cdnjs, deferred `<script>`) load from CDNs at runtime, so the page needs network access to render fully. The GSAP scroll-reveal degrades gracefully to a CSS reveal if its script fails to load.

## Deployment

`.github/workflows/deploy.yml` deploys to GitHub Pages on every push to `main` (or manual dispatch): the runner does `npm install && npm run build` and publishes `public/`. The build runs in CI, so `public/` is never committed — and pushing to `main` is a live deploy.
