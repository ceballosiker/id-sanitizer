# Changelog

All notable changes to ID Sanitizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/ceballosiker/id-sanitizer/releases/tag/v0.1.0
