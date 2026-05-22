import { expect, test, type Locator, type Page } from '@playwright/test';
import { makeSolidPng } from './fixtures';
import { ACCEPTED_IMAGE_TYPES_ATTR, INVALID_FILE_TYPE_MESSAGE } from '../src/upload';

const REUPLOAD_BTN = '[data-action=replace-image]';
const REUPLOAD_INPUT = '[data-action=replace-image-input]';
const REUPLOAD_ERROR = '.reupload-error';

async function uploadImage(page: Page, name: string, buffer: Buffer): Promise<Locator> {
  await page.setInputFiles('.dropzone input[type=file]', {
    name,
    mimeType: 'image/png',
    buffer,
  });
  const canvas = page.locator('.upload-preview');
  await expect(canvas).toBeVisible();
  return canvas;
}

async function reupload(page: Page, name: string, buffer: Buffer): Promise<void> {
  await page.setInputFiles(REUPLOAD_INPUT, {
    name,
    mimeType: 'image/png',
    buffer,
  });
}

async function dragOnCanvas(
  page: Page,
  canvas: Locator,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  // Same viewport workaround used by watermark/crop/redact-touch specs.
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

const imageA = (): Buffer => makeSolidPng(400, 400, [255, 0, 0]);
const imageB = (): Buffer => makeSolidPng(200, 320, [0, 128, 0]);

test('re-upload button is hidden before first upload and enabled after', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#toolbar')).toBeHidden();
  await uploadImage(page, 'a.png', imageA());
  await expect(page.locator(REUPLOAD_BTN)).toBeEnabled();
});

test('hidden re-upload input mirrors the shared accept attribute', async ({ page }) => {
  await page.goto('/');
  await uploadImage(page, 'a.png', imageA());
  const accept = await page.locator(REUPLOAD_INPUT).getAttribute('accept');
  expect(accept).toBe(ACCEPTED_IMAGE_TYPES_ATTR);
});

test('preserves grayscale + watermark + format and resets rect history', async ({ page }) => {
  await page.goto('/');
  let dialogSeen = false;
  page.on('dialog', (dialog) => {
    dialogSeen = true;
    void dialog.accept();
  });

  const canvas = await uploadImage(page, 'a.png', imageA());
  await page.locator('[data-action=watermark-text]').fill('PRESERVE ME');
  await page.locator('[data-action=watermark-opacity]').fill('70');
  await page.locator('[data-action=grayscale]').click();
  await expect(page.locator('[data-action=grayscale]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('label:has(input[value=jpeg])').click();
  await expect(page.locator('input[name=format][value=jpeg]')).toBeChecked();
  await dragOnCanvas(page, canvas, [50, 50], [150, 150]);
  await expect(page.locator('[data-action=undo]')).toBeEnabled();

  // Click the button — this triggers the confirm (because rects exist), then opens
  // the file chooser. We accept the dialog via the registered listener and feed the
  // new file to the chooser when it fires.
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator(REUPLOAD_BTN).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'b.png',
    mimeType: 'image/png',
    buffer: imageB(),
  });

  // Sync point — undo flips from enabled to disabled inside the post-load .then().
  await expect(page.locator('[data-action=undo]')).toBeDisabled();

  // New canvas dims match image B.
  const dims = await page.locator('.upload-preview').evaluate((el) => ({
    w: (el as HTMLCanvasElement).width,
    h: (el as HTMLCanvasElement).height,
  }));
  expect(dims).toEqual({ w: 200, h: 320 });

  // Toolbar state preserved.
  await expect(page.locator('[data-action=grayscale]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-action=watermark-text]')).toHaveValue('PRESERVE ME');
  await expect(page.locator('[data-action=watermark-opacity]')).toHaveValue('70');
  await expect(page.locator('input[name=format][value=jpeg]')).toBeChecked();

  // Confirm-accept path was actually taken.
  expect(dialogSeen).toBe(true);
});

test('cancelling the confirm leaves the current image and rects untouched', async ({ page }) => {
  await page.goto('/');
  let dialogSeen = false;
  page.on('dialog', (dialog) => {
    dialogSeen = true;
    void dialog.dismiss();
  });

  const canvas = await uploadImage(page, 'a.png', imageA());
  await dragOnCanvas(page, canvas, [50, 50], [150, 150]);
  await expect(page.locator('[data-action=undo]')).toBeEnabled();

  await page.locator(REUPLOAD_BTN).click();
  // Give Playwright a moment to process the dialog event.
  await expect.poll(() => dialogSeen).toBe(true);

  // Canvas dims unchanged.
  const dims = await page.locator('.upload-preview').evaluate((el) => ({
    w: (el as HTMLCanvasElement).width,
    h: (el as HTMLCanvasElement).height,
  }));
  expect(dims).toEqual({ w: 400, h: 400 });
  await expect(page.locator('[data-action=undo]')).toBeEnabled();
});

test('skips the confirm when no rects have been drawn', async ({ page }) => {
  await page.goto('/');
  let dialogSeen = false;
  page.on('dialog', (dialog) => {
    dialogSeen = true;
    void dialog.accept();
  });

  await uploadImage(page, 'a.png', imageA());

  // Click the button with no rects drawn — should skip the confirm and go
  // straight to the file chooser.
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator(REUPLOAD_BTN).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'b.png',
    mimeType: 'image/png',
    buffer: imageB(),
  });

  // Wait for the load to land.
  await expect
    .poll(async () =>
      page.locator('.upload-preview').evaluate((el) => ({
        w: (el as HTMLCanvasElement).width,
        h: (el as HTMLCanvasElement).height,
      })),
    )
    .toEqual({ w: 200, h: 320 });

  // No dialog fired — the feature's history?.canUndo() guard correctly skipped confirm.
  expect(dialogSeen).toBe(false);
});

test('shows the inline error for an invalid file type', async ({ page }) => {
  await page.goto('/');
  await uploadImage(page, 'a.png', imageA());

  // Force a non-image file through the input — setInputFiles bypasses the
  // browser's `accept` filter, which is exactly the path pickFirstValidImage
  // is meant to guard.
  await page.setInputFiles(REUPLOAD_INPUT, {
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });

  await expect(page.locator(REUPLOAD_ERROR)).toBeVisible();
  await expect(page.locator(REUPLOAD_ERROR)).toHaveText(INVALID_FILE_TYPE_MESSAGE);

  // Canvas unchanged.
  const dims = await page.locator('.upload-preview').evaluate((el) => ({
    w: (el as HTMLCanvasElement).width,
    h: (el as HTMLCanvasElement).height,
  }));
  expect(dims).toEqual({ w: 400, h: 400 });
});

test('exits crop mode when re-uploading mid-crop', async ({ page }) => {
  await page.goto('/');

  await uploadImage(page, 'a.png', imageA());
  await page.locator('[data-action=crop]').click();
  await expect(page.locator('[data-action=crop]')).toHaveAttribute('aria-pressed', 'true');

  await reupload(page, 'b.png', imageB());

  await expect(page.locator('[data-action=crop]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.crop-confirm-bar')).toBeHidden();
  await expect(page.locator('[data-action=grayscale]')).toBeEnabled();
  // Poll until canvas dims reflect the new image (async renderer.load() resolves).
  await expect
    .poll(async () =>
      page.locator('.upload-preview').evaluate((el) => ({
        w: (el as HTMLCanvasElement).width,
        h: (el as HTMLCanvasElement).height,
      })),
    )
    .toEqual({ w: 200, h: 320 });
});
