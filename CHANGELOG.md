# Changelog

All notable changes to ID Sanitizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-05-23

### Added

- **Cropping tool** in the toolbar — click _Crop_, drag a rectangle to mark what to keep, then _Confirm_ to discard pixels outside (or _Cancel_ to back out). Cropping happens before redactions and bakes into the downloaded image. Independent of the rect-history stack so undo/redo never re-expands the canvas. (#50)
- Re-upload control: load a new image without page refresh; preserves grayscale, watermark, and format selection while resetting redactions. (#51)
- Watermark `{date}` placeholder now expands to a localized short date via `Intl.DateTimeFormat` (browser locale, explicit `{ year, month, day: 'numeric' }`), so the rendered watermark reads natively in the user's region. (#53)

### Fixed

- Watermark with long text no longer leaves a diagonal gap between tile rows — the per-row horizontal stride now scales with the rendered text width instead of a fixed constant. (#54)

## [0.3.0] - 2026-05-12

### Added

- **Watermark** in the toolbar — user-typed text rendered as a diagonal tiled mark across the canvas with an adjustable opacity slider (default 30%). Sits beneath redaction rectangles so a watermark line never reads through a redaction, and bakes into the downloaded PNG/JPEG. Independent of the rect-history stack — undo/redo doesn't flip it.

### Changed

- Refreshed PWA icons and favicon to a brand-aligned mark — cream-paper background with "ID" letters bisected by a black redaction bar. The maskable variant respects the W3C safe zone so circular / squircle launcher masks no longer clip the mark.

### Fixed

- Renamed the `FORM 0.1` corner annotation to `FORM IDS-001`. The original looked like a stale version number (frozen at 0.1 while the app moved to 0.2.0 / 0.3.0); the new code reads as a non-version administrative form identifier so it doesn't mislead.

## [0.2.0] - 2026-05-11

### Added

- **Grayscale toggle** in the toolbar — converts the loaded image to grayscale before redaction rectangles are composited, and bakes the conversion into the downloaded PNG/JPEG. Useful for IDs (passports, licenses) where only information needs to be preserved, not the color photo. Uses Rec. 601 luma weights (matches CSS `filter: grayscale(1)`). Toggle state is independent of the rect-history stack so undo/redo never flips it.

### Fixed

- Redaction-rectangle drag on mobile / touch devices. Previously the black rect appeared at the tap point but did not follow the finger; lifting committed a tiny rectangle. The canvas now opts out of browser touch gestures so pointer events deliver end-to-end.

### Changed

- Dropped the segmented "stencil bar" decoration above the page title in favour of a cleaner header. The bottom border-rule still separates header from content.

## [0.1.0] - 2026-05-09

Initial release.

### Added

- Drag-and-drop or file-picker upload for JPG / PNG / WebP images.
- Canvas-based redaction tool: draw black rectangles over sensitive fields with a pointer.
- Undo / redo via the toolbar and Ctrl/Cmd-Z, Ctrl/Cmd-Shift-Z, Ctrl-Y.
- Download the redacted image as PNG or JPEG. Redactions are flattened into the output pixels.
- In-app About modal showing version, source link, and MIT attribution.
- Offline-first PWA: installable, service-worker-cached, works after a single online visit.
- Strict CSP (`connect-src 'none'`) enforced via build-time meta tag — the browser refuses outbound connections at runtime.
- Self-hosted fonts (Fraunces, JetBrains Mono) via Fontsource — no CDN, no remote requests.
- GitHub Pages deploy workflow on push to `main`.

[0.4.0]: https://github.com/ceballosiker/id-sanitizer/releases/tag/v0.4.0
[0.3.0]: https://github.com/ceballosiker/id-sanitizer/releases/tag/v0.3.0
[0.2.0]: https://github.com/ceballosiker/id-sanitizer/releases/tag/v0.2.0
[0.1.0]: https://github.com/ceballosiker/id-sanitizer/releases/tag/v0.1.0
