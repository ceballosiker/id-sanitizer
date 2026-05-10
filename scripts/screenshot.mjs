#!/usr/bin/env node
// Captures docs/hero.png from the running production build. Spins up the
// preview server via Vite's programmatic API, captures a clipped full-page
// screenshot at 2× DPR, exits.
//
// Headless flags --disable-gpu and --disable-software-rasterizer are required
// in nested-virt envs (Docker/WSL2) — without them, page.screenshot() and
// canvas paints deadlock. See playwright.config.ts for the same fix on e2e.

import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const OUT = 'docs/hero.png';
const VIEWPORT = { width: 1440, height: 900 };
const DPR = 2;

console.log('Starting preview server...');
const server = await preview({ preview: { host: '127.0.0.1', port: 4173 } });
const url = `${server.resolvedUrls.local[0]}`.replace(/\/$/, '/');

console.log(`Preview server ready at ${url}`);
console.log('Launching headless Chromium...');
const browser = await chromium.launch({
  args: ['--disable-gpu', '--disable-software-rasterizer'],
});

try {
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  // Auto-detect content extent: clip just below the footer with a small
  // breathing-room buffer. Avoids the empty cream band below the fold.
  const clipHeight = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    return footer
      ? Math.ceil(footer.getBoundingClientRect().bottom) + 40
      : document.documentElement.scrollHeight;
  });

  const buf = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: clipHeight },
    // Snap CSS animations to their end state. The header/footer/dropzone use
    // a 600ms redact-in animation with a 0.6s delay and fill-mode: backwards,
    // so without this the elements are still mid-fade when the screenshot fires.
    animations: 'disabled',
  });

  writeFileSync(OUT, buf);
  console.log(
    `Wrote ${OUT} — ${(buf.length / 1024).toFixed(1)} KB, ${VIEWPORT.width * DPR}×${clipHeight * DPR} px`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(() => resolve()));
}
