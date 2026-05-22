import { expect, test, type Locator, type Page } from '@playwright/test';
import { makeSolidPng } from './fixtures';

async function uploadRedImage(page: Page, width = 64, height = 64): Promise<Locator> {
  await page.goto('/');
  await page.setInputFiles('.dropzone input[type=file]', {
    name: 'red.png',
    mimeType: 'image/png',
    buffer: makeSolidPng(width, height, [255, 0, 0]),
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
  // The canvas can render taller than the default 720-px Playwright viewport
  // for larger fixtures (e.g. 400×400). A pointerdown at a client point past
  // the viewport bottom never dispatches — pointer capture lets earlier drags
  // continue past the edge, but a *new* drag started outside the viewport is
  // silently dropped. Same workaround as e2e/redact-touch.spec.ts.
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

async function canvasSize(canvas: Locator): Promise<{ width: number; height: number }> {
  return canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    return { width: c.width, height: c.height };
  });
}

test('1. Crop button is disabled before upload, enabled after', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-action=crop]')).toBeDisabled();
  await uploadRedImage(page);
  await expect(page.locator('[data-action=crop]')).toBeEnabled();
});

test('2. Entering crop mode disables sibling controls and presses Crop', async ({ page }) => {
  await uploadRedImage(page);
  await page.locator('[data-action=crop]').click();
  await expect(page.locator('[data-action=crop]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-action=undo]')).toBeDisabled();
  await expect(page.locator('[data-action=redo]')).toBeDisabled();
  await expect(page.locator('[data-action=grayscale]')).toBeDisabled();
  await expect(page.locator('[data-action=watermark-text]')).toBeDisabled();
  await expect(page.locator('[data-action=watermark-opacity]')).toBeDisabled();
  await expect(page.locator('[data-action=download]')).toBeDisabled();
  await expect(page.locator('input[name=format][value=png]')).toBeDisabled();
  await expect(page.locator('input[name=format][value=jpeg]')).toBeDisabled();
  // No rect drawn yet → bar still hidden.
  await expect(page.locator('.crop-confirm-bar')).toBeHidden();
});

test('3. Dragging a rect dims the outside and shows the floating bar', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);
  await expect(page.locator('.crop-confirm-bar')).toBeVisible();
  // Inside the rect: source red. Outside: still red but darkened by the
  // 55% black overlay → R below source, G and B near 0.
  const inside = await pixelAt(canvas, 32, 32);
  const outside = await pixelAt(canvas, 4, 4);
  expect(inside[0]).toBeGreaterThan(220);
  expect(outside[0]).toBeLessThan(180);
  expect(outside[0]).toBeGreaterThan(60);
});

test('4. Cancel restores the canvas and re-enables controls', async ({ page }) => {
  const canvas = await uploadRedImage(page);
  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);
  await page.locator('[data-action=crop-cancel]').click();
  await expect(page.locator('.crop-confirm-bar')).toBeHidden();
  await expect(page.locator('[data-action=grayscale]')).toBeEnabled();
  await expect(page.locator('[data-action=watermark-text]')).toBeEnabled();
  await expect(page.locator('[data-action=download]')).toBeEnabled();
  const outside = await pixelAt(canvas, 4, 4);
  expect(outside[0]).toBeGreaterThan(220);
});

test('5. Confirm replaces the canvas with the cropped region', async ({ page }) => {
  const canvas = await uploadRedImage(page, 400, 400);
  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [50, 50], [150, 150]);
  await page.locator('[data-action=crop-confirm]').click();
  await expect(page.locator('.crop-confirm-bar')).toBeHidden();
  const size = await canvasSize(canvas);
  expect(size.width).toBe(100);
  expect(size.height).toBe(100);
  // A pixel at (10, 10) on the new canvas corresponds to (60, 60) on the
  // original — also pure red.
  const px = await pixelAt(canvas, 10, 10);
  expect(px[0]).toBeGreaterThan(250);
  expect(px[1]).toBeLessThan(5);
  expect(px[2]).toBeLessThan(5);
});

test('6. Pre-existing redactions dim during crop preview, restore on cancel, clear on confirm', async ({
  page,
}) => {
  const canvas = await uploadRedImage(page);
  // Draw a redaction rect (16,16)-(48,48): pure black.
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);
  expect((await pixelAt(canvas, 32, 32))[0]).toBeLessThan(5);

  // Enter crop mode AND draw a crop rect that contains the redaction.
  // The renderer's dim-overlays paint pass activates only when
  // cropPreview !== null (per spec lines 222-236), i.e. once the user
  // starts drawing — not on the bare click. Drawing the crop also
  // means we don't have to worry about which side of the dim-outside
  // boundary the sampled pixel lands on.
  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [4, 4], [60, 60]);
  // 40% black over red ≈ (255*0.6, 0, 0). Allow generous tolerance —
  // browser compositing rounds, and inside the crop the dim-outside
  // step does not contribute.
  const dimmed = await pixelAt(canvas, 32, 32);
  expect(dimmed[0]).toBeGreaterThan(80);
  expect(dimmed[0]).toBeLessThan(220);

  // Cancel — overlay back to full alpha, redaction is pure black.
  await page.locator('[data-action=crop-cancel]').click();
  expect((await pixelAt(canvas, 32, 32))[0]).toBeLessThan(5);

  // Re-enter, draw a crop covering most of the canvas, confirm.
  // History should be cleared → Undo button disabled.
  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [4, 4], [60, 60]);
  await page.locator('[data-action=crop-confirm]').click();
  await expect(page.locator('[data-action=undo]')).toBeDisabled();
});

test('7. Resizing via the SE handle adjusts the crop region', async ({ page }) => {
  const canvas = await uploadRedImage(page, 400, 400);
  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [50, 50], [150, 150]);
  // SE handle anchor is at (150, 150) in image space. Drag it to (250, 250).
  await dragOnCanvas(page, canvas, [150, 150], [250, 250]);
  await page.locator('[data-action=crop-confirm]').click();
  const size = await canvasSize(canvas);
  expect(size.width).toBe(200);
  expect(size.height).toBe(200);
});

test('8. Body drag relocates the crop region', async ({ page }) => {
  const canvas = await uploadRedImage(page, 400, 400);
  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [50, 50], [150, 150]);
  // Grab the rect body at its center (100, 100) and drag to (200, 200).
  // New origin should be (150, 150), same w/h.
  await dragOnCanvas(page, canvas, [100, 100], [200, 200]);
  await page.locator('[data-action=crop-confirm]').click();
  const size = await canvasSize(canvas);
  expect(size.width).toBe(100);
  expect(size.height).toBe(100);
});

test('9. Esc cancels, Enter confirms', async ({ page }) => {
  const canvas = await uploadRedImage(page, 200, 200);

  // Esc path.
  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [20, 20], [80, 80]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.crop-confirm-bar')).toBeHidden();
  let size = await canvasSize(canvas);
  expect(size.width).toBe(200);

  // Enter path.
  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [20, 20], [120, 120]);
  await page.keyboard.press('Enter');
  size = await canvasSize(canvas);
  expect(size.width).toBe(100);
  expect(size.height).toBe(100);
});

test('10. Clicking Crop again without dragging acts as a cancel', async ({ page }) => {
  await uploadRedImage(page);
  const cropBtn = page.locator('[data-action=crop]');
  await cropBtn.click();
  await expect(cropBtn).toHaveAttribute('aria-pressed', 'true');
  await cropBtn.click();
  await expect(cropBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-action=grayscale]')).toBeEnabled();
});

test('11. Watermark text + grayscale state survive a confirmed crop', async ({ page }) => {
  const canvas = await uploadRedImage(page, 400, 400);
  await page.locator('[data-action=watermark-text]').fill('TEST');
  await page.locator('[data-action=grayscale]').click();

  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [100, 100], [300, 300]);
  await page.locator('[data-action=crop-confirm]').click();

  await expect(page.locator('[data-action=watermark-text]')).toHaveValue('TEST');
  await expect(page.locator('[data-action=grayscale]')).toHaveAttribute('aria-pressed', 'true');

  // Pixel sampling: the grayscale of pure red (255,0,0) is rec. 601 = 76.
  // A non-watermark sample should be 76,76,76 (gray); a glyph pixel would
  // be darker. Sample top-left of the cropped canvas, which on the 200×200
  // crop is well clear of where text typically lands.
  const px = await pixelAt(canvas, 2, 2);
  expect(px[0]).toBeGreaterThan(40);
  expect(px[0]).toBeLessThan(120);
  // Equal channels = grayscale.
  expect(Math.abs(px[0] - px[1])).toBeLessThan(3);
  expect(Math.abs(px[1] - px[2])).toBeLessThan(3);
});

test('12. History is cleared on confirm (Undo and Redo both disabled afterwards)', async ({
  page,
}) => {
  const canvas = await uploadRedImage(page, 200, 200);
  await dragOnCanvas(page, canvas, [10, 10], [40, 40]); // redact A
  await dragOnCanvas(page, canvas, [60, 60], [90, 90]); // redact B
  await page.locator('[data-action=undo]').click(); // future contains B
  await expect(page.locator('[data-action=redo]')).toBeEnabled();

  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [5, 5], [180, 180]);
  await page.locator('[data-action=crop-confirm]').click();

  await expect(page.locator('[data-action=undo]')).toBeDisabled();
  await expect(page.locator('[data-action=redo]')).toBeDisabled();
});

test('13. Full lifecycle: load → crop → redact → download produces cropped + redacted PNG', async ({
  page,
}) => {
  const canvas = await uploadRedImage(page, 400, 400);

  await page.locator('[data-action=crop]').click();
  await dragOnCanvas(page, canvas, [100, 100], [300, 300]);
  await page.locator('[data-action=crop-confirm]').click();

  // After crop, draw a new redaction on the cropped canvas. The cropped
  // canvas is 200×200; redact (16,16)-(48,48).
  await dragOnCanvas(page, canvas, [16, 16], [48, 48]);

  // Re-decode the canvas via toDataURL (the same serializer toBlob uses)
  // and verify the exported dimensions match the crop and the redact
  // rect appears as pure black.
  const result = await canvas.evaluate(async (el) => {
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
    const px = ctx.getImageData(32, 32, 1, 1).data;
    return {
      width: c.width,
      height: c.height,
      inside: [px[0], px[1], px[2]] as [number, number, number],
    };
  });
  expect(result.width).toBe(200);
  expect(result.height).toBe(200);
  expect(result.inside[0]).toBeLessThan(5);
  expect(result.inside[1]).toBeLessThan(5);
  expect(result.inside[2]).toBeLessThan(5);
});
