# ID Sanitizer

Redact personal info from photos of IDs — locally, in your browser, with no upload.

[![CI](https://github.com/ceballosiker/id-sanitizer/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ceballosiker/id-sanitizer/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/tag/ceballosiker/id-sanitizer?label=version&color=1a1612)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-1a1612.svg)](./LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-1a1612.svg)](https://ceballosiker.github.io/id-sanitizer/)

> **Heads up:** This is free software I built for myself.
> No warranty, no guarantees — use at your own risk.
> Verify your redactions before sharing anything important.

![Screenshot of the ID Sanitizer app](docs/hero.png)

## What it is

ID Sanitizer is a single-page web app for blacking out sensitive fields on
photos of identity documents — driver's licenses, passports, ID cards, that
sort of thing — before you share them with someone who only needs to see
part of the document.

Drop an image, drag rectangles over what you don't want shared, download
the redacted version. The redacted pixels are flattened into the output
image — the original pixels are gone, not just hidden behind a layer.

## Privacy guarantee

Nothing leaves your device. The app makes no network requests at runtime;
your image is processed entirely in the browser. You can verify this:

- **Disconnect from the network** before uploading. Everything still works.
- **Open DevTools → Network tab.** No requests fire when you upload, draw,
  or download.
- **Inspect the source.** A strict CSP (`connect-src 'none'`) is enforced
  via `<meta>` in production — the browser refuses any outbound connection
  the app might try to make.
- **The PWA service worker** caches the app shell so you can use it
  offline indefinitely after one online visit.

## How to use

1. Open the [live URL](https://ceballosiker.github.io/id-sanitizer/) — or
   "Install App" if your browser supports PWAs (Chrome / Edge desktop +
   Android, Safari iOS via Add to Home Screen).
2. Drop an image (JPG / PNG / WebP) onto the page or click _Choose file_.
3. _Optional pre-redaction transforms:_
   - **Crop** — click _Crop_, drag a rectangle to mark the area to keep,
     then _Confirm_ (or _Cancel_ to back out). Pixels outside the
     rectangle are discarded before export. Independent of undo/redo,
     which only walks redactions.
   - **Grayscale** — toggle to render the canvas (and bake the export) in
     black-and-white. Useful when only the information matters, not the
     biometric photo.
   - **Watermark** — type a label (e.g. _"For ACME Bank · 2026-05-12"_)
     and pick an opacity. A diagonal tiled watermark sits beneath any
     redactions in both the live preview and the exported file.
4. Click and drag to draw black rectangles over anything you want redacted.
   Rectangles are always painted on top, so a watermark never reads
   through a redaction.
5. Use Undo / Redo (or Ctrl/Cmd-Z, Ctrl/Cmd-Shift-Z) to fix mistakes.
   The grayscale toggle and watermark settings are independent of the
   rect-history stack — undo / redo only walks redactions.
6. Pick PNG (default) or JPEG and click _Download_. Every visible
   transformation — redactions, grayscale, watermark — is baked into the
   output pixels.

## Run it yourself

You don't have to trust this deployment. The whole point is the app makes
no network requests at runtime — and you can verify that by running it
locally from source.

```sh
git clone https://github.com/ceballosiker/id-sanitizer.git
cd id-sanitizer
npm install
npm run build
npm run preview
```

Open <http://localhost:4173/id-sanitizer/>. The strict CSP from production
is enforced; the service worker registers; everything runs exactly as it
would on the live site, but served from your own machine.

After the first build, even `npm install` and `npm run build` aren't
necessary — the `dist/` directory is a self-contained static site you can
serve with any file server (`python -m http.server`, `npx serve`, nginx,
whatever). No Node required at runtime.

## Develop locally

```sh
git clone https://github.com/ceballosiker/id-sanitizer.git
cd id-sanitizer
npm install
npm run dev
```

| Script                            | What it does                                              |
| --------------------------------- | --------------------------------------------------------- |
| `npm run dev`                     | Vite dev server with HMR on `http://localhost:5173/`      |
| `npm run build`                   | Production build into `dist/`                             |
| `npm run preview`                 | Serve the production build locally on `:4173`             |
| `npm run typecheck`               | `tsc --noEmit`                                            |
| `npm run lint` / `lint:fix`       | ESLint                                                    |
| `npm run format` / `format:check` | Prettier                                                  |
| `npm run test:run`                | Vitest unit tests (pure modules only)                     |
| `npm run e2e`                     | Playwright e2e tests against the production preview build |
| `npm run icons`                   | Regenerate PWA icons + favicon from `scripts/icon*.svg`   |
| `npm run screenshot`              | Recapture `docs/hero.png` from the production build       |

After clone + `npm install`, the app runs fully offline — no CDN, no
remote fonts, no analytics. The bundled fonts (Fraunces, JetBrains Mono)
are self-hosted via [Fontsource](https://fontsource.org/).

### Testing

Five checks run in CI as separate jobs; all must pass before merge.

| Check            | Command                | What it covers                                                                                                                                                        |
| ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier         | `npm run format:check` | Code style, every tracked file                                                                                                                                        |
| ESLint           | `npm run lint`         | Type-aware lint rules                                                                                                                                                 |
| TypeScript       | `npm run typecheck`    | `tsc --noEmit` against `strict` config                                                                                                                                |
| Vitest (unit)    | `npm run test:run`     | Pure modules: grayscale transform, watermark tile math, history stack, rect-tool coord math, upload validation, download filename builder                             |
| Playwright (e2e) | `npm run e2e`          | End-to-end against `npm run preview`: app shell, upload, redaction (mouse + touch), grayscale, watermark, download bake, PWA manifest, service worker, offline reload |

Local gauntlet before push:

```sh
npm run format:check && npm run lint && npm run typecheck && npm run test:run && npm run e2e
```

E2E tests run against the **production preview build** (not the dev
server), so `npm run build` is implicit. The Playwright config disables
GPU + software-rasterizer flags so the suite is reliable in nested-virt
environments (Docker, WSL2) where canvas paints would otherwise deadlock.

## Tech stack

Vanilla TypeScript + Vite, no framework. Canvas 2D for rendering, native
Pointer Events for input, native `<dialog>` for the About modal,
[`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) for the service
worker + manifest. Self-hosted fonts (Fraunces, JetBrains Mono) via
[Fontsource](https://fontsource.org/) — no CDN, no remote requests.

Tests use Vitest with happy-dom for pure modules and Playwright
(Chromium) for end-to-end against the production preview build. PWA
icons are rasterised at build time by
[`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) from
hand-edited SVG sources.

Production weight: ~13 kB JS + ~15 kB CSS uncompressed (~13 kB total
gzipped over the wire), plus the Workbox runtime for the service worker.
Fonts add the rest of the precache.

## Branching and contributing

Two long-lived branches:

- **`main`** — the deployed branch. GitHub Pages auto-deploys on every
  push. Always matches the latest tagged release.
- **`develop`** — the integration branch. All feature work targets
  `develop`.

Feature branches off `develop`, named by issue + topic:

- `feat/<issue#>-<topic>` for new features
- `fix/<issue#>-<topic>` for bug fixes
- `chore/<issue#>-<topic>` for tooling / housekeeping

Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `chore:`, `test:`, `docs:`). The `Closes #N` keyword in
commit messages or PR bodies is wired up via a workflow on merges to
`develop` (see `.github/workflows/`).

When opening a PR, **double-check the base branch is `develop`, not
`main`** — GitHub auto-targets the default branch (`main`), which is
wrong for feature PRs. Feature → `develop` PRs are merged via
`gh pr merge --rebase` to keep the develop history linear.

Bug reports and small PRs welcome. For larger changes, open an issue
first to discuss the approach.

## Releases

The release flow is intentionally manual — no release-please, no
auto-generated changelog, no CI-driven tagging. Each release is a small
deliberate sequence:

1. **Bump on `develop`.** Update `package.json` version + add a new
   entry at the top of `CHANGELOG.md` summarising user-visible changes.
   Commit as `chore: release vX.Y.Z`.
2. **Open the release PR.** `develop` → `main`, titled
   `release: vX.Y.Z`. The PR body lists the issues / features shipping.
   CI must be green.
3. **Fast-forward, don't merge-commit.** Merge locally with
   `git checkout main && git merge --ff-only develop && git push origin main`.
   This keeps both long-lived branches pointing at the same SHA so
   `git log main..develop` is empty until the next cycle starts.
4. **Tag manually.**
   `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`. The
   version badge above auto-updates from the latest tag.
5. **GitHub Pages picks up the deploy** from the push to `main` — no
   further action needed.

## License

[MIT](./LICENSE) © 2026 Iker
