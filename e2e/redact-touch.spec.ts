import { expect, test, type Locator, type Page } from '@playwright/test';
import { makeSolidPng } from './fixtures';

// Mobile-style viewport that's smaller than the page's natural height so the
// browser can interpret a touch drag as a pan gesture (the gesture-recognition
// path that breaks redaction without `touch-action: none` on the canvas).
test.use({
  hasTouch: true,
  viewport: { width: 360, height: 640 },
});

async function uploadRedImage(page: Page): Promise<Locator> {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', {
    name: 'red.png',
    mimeType: 'image/png',
    buffer: makeSolidPng(64, 64, [255, 0, 0]),
  });
  const canvas = page.locator('.upload-preview');
  await expect(canvas).toBeVisible();
  return canvas;
}

// Real touchscreen drag via the Chromium DevTools Protocol. Playwright's
// page.mouse generates pointer events of type "mouse", which bypass touch-
// action gesture handling entirely. CDP touchStart/touchMove/touchEnd, with
// the context's hasTouch enabled, drives the same code path a real finger
// would — including the browser's pan-vs-draw arbitration.
async function touchDragOnCanvas(
  page: Page,
  canvas: Locator,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  // Scroll the canvas into view first: as the toolbar grows with new controls
  // (#39 grayscale, #45 watermark, …), the canvas drifts down the page and on
  // a tight mobile viewport its bottom can sit below the visible area. CDP
  // touch events dispatched to viewport coords outside the visible region
  // never reach the canvas — which would look like a regression of #37 even
  // though the touch-action fix is intact.
  await canvas.scrollIntoViewIfNeeded();
  const coords = await canvas.evaluate(
    (el, [fx, fy, tx, ty]) => {
      const c = el as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      const sx = r.width / c.width;
      const sy = r.height / c.height;
      return {
        x1: r.left + fx * sx,
        y1: r.top + fy * sy,
        x2: r.left + tx * sx,
        y2: r.top + ty * sy,
      };
    },
    [from[0], from[1], to[0], to[1]],
  );

  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: coords.x1, y: coords.y1, id: 1 }],
  });
  const steps = 8;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: coords.x1 + (coords.x2 - coords.x1) * t,
          y: coords.y1 + (coords.y2 - coords.y1) * t,
          id: 1,
        },
      ],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

async function pixelAt(canvas: Locator, x: number, y: number): Promise<[number, number, number]> {
  return canvas.evaluate(
    (el, [px, py]) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      const d = ctx.getImageData(px, py, 1, 1).data;
      return [d[0], d[1], d[2]] as [number, number, number];
    },
    [x, y],
  );
}

test('touch drag draws a rectangle that follows the finger', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await touchDragOnCanvas(page, canvas, [16, 16], [48, 48]);

  // Center of the dragged rect: black (redacted). Outside: still red.
  // Without `touch-action: none` the browser converts the drag to a pan,
  // `pointercancel` fires mid-drag, and only a tiny rect (or none) commits —
  // so the center pixel stays red and this assertion fails.
  expect((await pixelAt(canvas, 32, 32))[0]).toBeLessThan(40);
  expect((await pixelAt(canvas, 4, 4))[0]).toBeGreaterThan(200);
});
