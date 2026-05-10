import { expect, test } from '@playwright/test';
import { tinyPngBuffer } from './fixtures';

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

test('download exports a PNG with sanitized filename', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', {
    name: 'passport.png',
    mimeType: 'image/png',
    buffer: tinyPngBuffer,
  });
  await expect(page.locator('#toolbar')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action=download]').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('passport-sanitized.png');
});

test('download exports a JPEG when format toggle is set to JPEG', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', {
    name: 'passport.png',
    mimeType: 'image/png',
    buffer: tinyPngBuffer,
  });
  await expect(page.locator('#toolbar')).toBeVisible();

  await page.locator('label:has(input[value=jpeg])').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action=download]').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('passport-sanitized.jpg');
});

test('PWA manifest is served with the correct properties', async ({ page }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const response = await page.request.get(manifestHref!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();

  expect(manifest.name).toBe('ID Sanitizer');
  expect(manifest.short_name).toBe('ID Sanitizer');
  expect(manifest.theme_color).toBe('#1a1612');
  expect(manifest.background_color).toBe('#f3ede1');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(3);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
});

test('service worker registers and activates', async ({ page }) => {
  await page.goto('/');

  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });

  // navigator.serviceWorker.ready resolves when registration.active is non-null,
  // which means the worker is in 'activating' or 'activated' state. Both indicate
  // a successful registration; the test catches whichever side of the transition.
  expect(['activating', 'activated']).toContain(state);
});

test('page still loads when offline after first online visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('banner')).toContainText('ID Sanitizer');
  await expect(page.getByRole('banner')).toContainText(/works offline/i);
  await expect(page.getByRole('main')).toBeVisible();
});

test('about modal opens from the footer button', async ({ page }) => {
  await page.goto('/');
  const about = page.locator('#about-dialog');
  await expect(about).toBeHidden();
  await page.locator('[data-action=about]').click();
  await expect(about).toBeVisible();
});

test('about modal closes via Esc', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action=about]').click();
  const about = page.locator('#about-dialog');
  await expect(about).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(about).toBeHidden();
});

test('about modal shows the app version', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action=about]').click();
  await expect(page.locator('.about-version')).toContainText(/v\d+\.\d+\.\d+/);
});

test('page.screenshot() returns a PNG without deadlocking', async ({ page }) => {
  // Regression test for the headless paint pipeline. Without
  // --disable-gpu + --disable-software-rasterizer in launchOptions,
  // page.screenshot() deadlocks in nested-virt envs (Docker/WSL2).
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: 'png', fullPage: true });
  expect(buf.length).toBeGreaterThan(1000);
  // PNG magic bytes: 89 50 4E 47
  expect(buf[0]).toBe(0x89);
  expect(buf[1]).toBe(0x50);
  expect(buf[2]).toBe(0x4e);
  expect(buf[3]).toBe(0x47);
});
