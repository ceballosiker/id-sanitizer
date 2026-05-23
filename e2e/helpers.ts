import { expect, type Locator, type Page } from '@playwright/test';
import { makeSolidPng } from './fixtures';

export async function uploadImage(page: Page, name: string, buffer: Buffer): Promise<Locator> {
  await page.setInputFiles('.dropzone input[type=file]', {
    name,
    mimeType: 'image/png',
    buffer,
  });
  const canvas = page.locator('.upload-preview');
  await expect(canvas).toBeVisible();
  return canvas;
}

export async function uploadRedImage(page: Page, width = 64, height = 64): Promise<Locator> {
  await page.goto('/');
  return uploadImage(page, 'red.png', makeSolidPng(width, height, [255, 0, 0]));
}

export async function dragOnCanvas(
  page: Page,
  canvas: Locator,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  // The canvas can render taller than the default Playwright viewport for
  // larger fixtures (e.g. 400×400 on a 720-px viewport). A pointerdown at a
  // client point past the viewport bottom never dispatches — pointer capture
  // lets earlier drags continue past the edge, but a *new* drag started
  // outside the viewport is silently dropped. scrollIntoViewIfNeeded is a
  // no-op when the canvas is already visible, so it's safe to always call.
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

export async function pixelAt(
  canvas: Locator,
  x: number,
  y: number,
): Promise<[number, number, number]> {
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
