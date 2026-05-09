import { expect, test } from '@playwright/test';

test('app loads with the expected title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('ID Sanitizer');
});

test('app shell renders semantic landmarks and offline badge', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toContainText('ID Sanitizer');
  await expect(page.getByRole('banner')).toContainText(/works offline/i);

  await expect(page.getByRole('main')).toBeVisible();

  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Source' })).toHaveAttribute(
    'href',
    'https://github.com/ceballosiker/id-sanitizer',
  );
  await expect(footer.getByRole('link', { name: 'License' })).toHaveAttribute('href', /\/LICENSE$/);
});

// 1×1 transparent PNG, smallest valid PNG (67 bytes after base64 decode).
const tinyPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('upload via file picker shows preview and removes the dropzone', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', {
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: tinyPngBuffer,
  });
  await expect(page.locator('.upload-preview')).toBeVisible();
  await expect(page.locator('.dropzone')).toHaveCount(0);
});

test('upload via file picker rejects unsupported types with inline error', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', {
    name: 'doc.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  await expect(page.locator('.upload-error')).toContainText(/jpg, png, or webp/i);
  await expect(page.locator('.upload-preview')).toHaveCount(0);
});

test('upload via drag-drop shows preview', async ({ page }) => {
  await page.goto('/');

  const dataTransfer = await page.evaluateHandle((b64) => {
    const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([binary], 'sample.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt;
  }, tinyPngBuffer.toString('base64'));

  await page.dispatchEvent('.dropzone', 'drop', { dataTransfer });

  await expect(page.locator('.upload-preview')).toBeVisible();
});

test('error auto-clears when a valid upload follows a rejected one', async ({ page }) => {
  await page.goto('/');

  await page.setInputFiles('input[type=file]', {
    name: 'doc.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  await expect(page.locator('.upload-error')).toBeVisible();

  await page.setInputFiles('input[type=file]', {
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: tinyPngBuffer,
  });
  await expect(page.locator('.upload-preview')).toBeVisible();
  await expect(page.locator('.upload-error')).toHaveCount(0);
});

test('canvas preview matches the uploaded image dimensions', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', {
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: tinyPngBuffer,
  });
  const preview = page.locator('.upload-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveJSProperty('tagName', 'CANVAS');
  // tinyPngBuffer is a 1×1 PNG — the canvas backing buffer should match
  await expect(preview).toHaveJSProperty('width', 1);
  await expect(preview).toHaveJSProperty('height', 1);
});

test('toolbar is hidden before upload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#toolbar')).toBeHidden();
});

test('toolbar appears with both buttons disabled after upload', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', {
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: tinyPngBuffer,
  });
  const toolbar = page.locator('#toolbar');
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator('[data-action=undo]')).toBeDisabled();
  await expect(toolbar.locator('[data-action=redo]')).toBeDisabled();
});
