import { expect, test } from '@playwright/test';
import { uploadRedImage, dragOnCanvas, pixelAt } from './helpers';

test('drawing a rectangle paints redaction onto the canvas', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);

  // Center of the drawn rect: should be black. Corner outside the rect: still red.
  expect((await pixelAt(canvas, 32, 32))[0]).toBeLessThan(40);
  expect((await pixelAt(canvas, 4, 4))[0]).toBeGreaterThan(200);
});

test('undo removes the drawn rectangle from canvas pixels', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);
  expect((await pixelAt(canvas, 32, 32))[0]).toBeLessThan(40);

  await page.locator('[data-action=undo]').click();
  expect((await pixelAt(canvas, 32, 32))[0]).toBeGreaterThan(200);
});

test('redo restores the undone rectangle', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);
  await page.locator('[data-action=undo]').click();
  await page.locator('[data-action=redo]').click();
  expect((await pixelAt(canvas, 32, 32))[0]).toBeLessThan(40);
});

test('downloaded PNG contains the drawn redaction', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);

  // Read the canvas backing buffer as a data URL, decode in the browser, and
  // sample the same pixel positions. This verifies the bytes that toBlob would
  // emit on download (toBlob and toDataURL share the same canvas serialization).
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
  expect(samples.outside[0]).toBeGreaterThan(200);
});
