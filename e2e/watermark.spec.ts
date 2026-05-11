import { expect, test, type Locator, type Page } from '@playwright/test';
import { makeSolidPng } from './fixtures';

async function uploadLargeRedImage(page: Page): Promise<Locator> {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', {
    name: 'red.png',
    mimeType: 'image/png',
    buffer: makeSolidPng(400, 400, [255, 0, 0]),
  });
  const canvas = page.locator('.upload-preview');
  await expect(canvas).toBeVisible();
  return canvas;
}

async function dragOnCanvas(
  page: Page,
  canvas: Locator,
  from: [number, number],
  to: [number, number],
): Promise<void> {
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
  await page.mouse.move(coords.x1, coords.y1);
  await page.mouse.down();
  await page.mouse.move(coords.x2, coords.y2, { steps: 8 });
  await page.mouse.up();
}

// Count how many pixels along a horizontal stripe deviate from the source colour
// by more than a small tolerance. Watermark text only covers a fraction of the
// canvas, so scanning a stripe is more robust than picking a single coordinate
// and hoping a glyph lands there.
async function countNonSourcePixels(
  canvas: Locator,
  y: number,
  sourceRgb: [number, number, number],
): Promise<number> {
  return canvas.evaluate(
    (el, [py, sr, sg, sb]) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      const row = ctx.getImageData(0, py, c.width, 1).data;
      let count = 0;
      for (let i = 0; i < row.length; i += 4) {
        if (
          Math.abs(row[i] - sr) > 3 ||
          Math.abs(row[i + 1] - sg) > 3 ||
          Math.abs(row[i + 2] - sb) > 3
        ) {
          count++;
        }
      }
      return count;
    },
    [y, sourceRgb[0], sourceRgb[1], sourceRgb[2]],
  );
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

test('watermark inputs are disabled before upload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#toolbar')).toBeHidden();
  await expect(page.locator('[data-action=watermark-text]')).toBeDisabled();
  await expect(page.locator('[data-action=watermark-opacity]')).toBeDisabled();
});

test('watermark inputs become enabled after upload', async ({ page }) => {
  await uploadLargeRedImage(page);
  await expect(page.locator('[data-action=watermark-text]')).toBeEnabled();
  await expect(page.locator('[data-action=watermark-opacity]')).toBeEnabled();
});

test('typing text draws a watermark on the canvas', async ({ page }) => {
  const canvas = await uploadLargeRedImage(page);
  expect(await countNonSourcePixels(canvas, 200, [255, 0, 0])).toBe(0);

  await page.locator('[data-action=watermark-text]').fill('TEST WATERMARK');
  expect(await countNonSourcePixels(canvas, 200, [255, 0, 0])).toBeGreaterThan(20);
});

test('clearing the text removes the watermark', async ({ page }) => {
  const canvas = await uploadLargeRedImage(page);
  const text = page.locator('[data-action=watermark-text]');
  await text.fill('TEST');
  expect(await countNonSourcePixels(canvas, 200, [255, 0, 0])).toBeGreaterThan(0);
  await text.fill('');
  expect(await countNonSourcePixels(canvas, 200, [255, 0, 0])).toBe(0);
});

test('opacity 0 hides the watermark; opacity 100 makes it solid', async ({ page }) => {
  const canvas = await uploadLargeRedImage(page);
  await page.locator('[data-action=watermark-text]').fill('TEST');
  const slider = page.locator('[data-action=watermark-opacity]');

  await slider.fill('0');
  expect(await countNonSourcePixels(canvas, 200, [255, 0, 0])).toBe(0);

  await slider.fill('100');
  const blackishCount = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    const row = ctx.getImageData(0, 200, c.width, 1).data;
    let count = 0;
    for (let i = 0; i < row.length; i += 4) {
      if (row[i] < 30 && row[i + 1] < 30 && row[i + 2] < 30) count++;
    }
    return count;
  });
  expect(blackishCount).toBeGreaterThan(0);
});

test('opacity slider live-updates the displayed percent', async ({ page }) => {
  await uploadLargeRedImage(page);
  const slider = page.locator('[data-action=watermark-opacity]');
  const out = page.locator('[data-action=watermark-opacity-value]');
  await expect(out).toHaveText('30%');
  await slider.fill('75');
  await expect(out).toHaveText('75%');
});

test('watermark renders below redaction rectangles', async ({ page }) => {
  const canvas = await uploadLargeRedImage(page);
  await page.locator('[data-action=watermark-text]').fill('TEST');
  await dragOnCanvas(page, canvas, [150, 150], [250, 250]);
  const [r, g, b] = await pixelAt(canvas, 200, 200);
  expect(r).toBeLessThan(5);
  expect(g).toBeLessThan(5);
  expect(b).toBeLessThan(5);
});

test('undo leaves the watermark text and opacity untouched', async ({ page }) => {
  const canvas = await uploadLargeRedImage(page);
  const text = page.locator('[data-action=watermark-text]');
  const slider = page.locator('[data-action=watermark-opacity]');
  await text.fill('TEST');
  await dragOnCanvas(page, canvas, [150, 150], [250, 250]);
  await page.locator('[data-action=undo]').click();

  await expect(text).toHaveValue('TEST');
  await expect(slider).toHaveValue('30');
  expect(await countNonSourcePixels(canvas, 50, [255, 0, 0])).toBeGreaterThan(0);
});

test('downloaded PNG bakes the watermark and the redaction rect', async ({ page }) => {
  const canvas = await uploadLargeRedImage(page);
  await page.locator('[data-action=watermark-text]').fill('TEST');
  await dragOnCanvas(page, canvas, [150, 150], [250, 250]);

  const samples = await canvas.evaluate(async (el) => {
    const c = el as HTMLCanvasElement;
    const dataUrl = c.toDataURL('image/png');
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const off = document.createElement('canvas');
    off.width = c.width;
    off.height = c.height;
    const ctx = off.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0);
    const inside = ctx.getImageData(200, 200, 1, 1).data;
    const row = ctx.getImageData(0, 50, c.width, 1).data;
    let outsideHits = 0;
    for (let i = 0; i < row.length; i += 4) {
      if (Math.abs(row[i] - 255) > 3 || row[i + 1] > 3 || row[i + 2] > 3) outsideHits++;
    }
    return {
      inside: [inside[0], inside[1], inside[2]],
      outsideHits,
    };
  });

  expect(samples.inside[0]).toBeLessThan(5);
  expect(samples.inside[1]).toBeLessThan(5);
  expect(samples.inside[2]).toBeLessThan(5);
  expect(samples.outsideHits).toBeGreaterThan(20);
});
