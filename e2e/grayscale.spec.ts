import { expect, test, type Locator, type Page } from '@playwright/test';
import { makeSolidPng } from './fixtures';

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

test('Grayscale button is disabled before upload', async ({ page }) => {
  await page.goto('/');
  const btn = page.locator('[data-action=grayscale]');
  await expect(page.locator('#toolbar')).toBeHidden();
  await expect(btn).toBeDisabled();
});

test('toggling on converts the canvas to grayscale', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await page.locator('[data-action=grayscale]').click();
  // Rec. 601: round(0.299 * 255) = 76.
  const [r, g, b] = await pixelAt(canvas, 32, 32);
  expect(r).toBe(76);
  expect(g).toBe(76);
  expect(b).toBe(76);
});

test('toggling off restores the original color', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  const btn = page.locator('[data-action=grayscale]');
  await btn.click();
  await btn.click();
  const [r, g, b] = await pixelAt(canvas, 32, 32);
  expect(r).toBe(255);
  expect(g).toBe(0);
  expect(b).toBe(0);
});

test('existing redaction rect survives a toggle flip', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);

  expect((await pixelAt(canvas, 32, 32))[0]).toBeLessThan(40);
  expect((await pixelAt(canvas, 4, 4))[0]).toBeGreaterThan(200);

  const btn = page.locator('[data-action=grayscale]');
  await btn.click();
  await btn.click();

  expect((await pixelAt(canvas, 32, 32))[0]).toBeLessThan(40);
  const corner = await pixelAt(canvas, 4, 4);
  expect(corner[0]).toBeGreaterThan(200);
  expect(corner[1]).toBeLessThan(40);
  expect(corner[2]).toBeLessThan(40);
});

test('undo does not touch the grayscale toggle', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  const btn = page.locator('[data-action=grayscale]');
  await btn.click();
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);
  await page.locator('[data-action=undo]').click();

  const corner = await pixelAt(canvas, 4, 4);
  expect(corner[0]).toBe(76);
  expect(corner[1]).toBe(76);
  expect(corner[2]).toBe(76);
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
});

test('downloaded PNG bakes grayscale and the redaction rect', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await page.locator('[data-action=grayscale]').click();
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);

  // toDataURL shares canvas serialization with toBlob (which is what the
  // Download button calls). Decoding the result verifies the exported bytes.
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
    const inside = ctx.getImageData(32, 32, 1, 1).data;
    const outside = ctx.getImageData(4, 4, 1, 1).data;
    return {
      inside: [inside[0], inside[1], inside[2]],
      outside: [outside[0], outside[1], outside[2]],
    };
  });

  expect(samples.inside[0]).toBeLessThan(40);
  expect(samples.outside[0]).toBe(76);
  expect(samples.outside[1]).toBe(76);
  expect(samples.outside[2]).toBe(76);
});

