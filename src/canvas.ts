import { toGrayscale } from './grayscale';
import { tilePositions } from './watermark';
import type { Rect } from './geometry';

export type Overlay = {
  draw(ctx: CanvasRenderingContext2D): void;
};

export interface CanvasRenderer {
  load(file: File): Promise<void>;
  setOverlays(overlays: readonly Overlay[]): void;
  setGrayscale(on: boolean): void;
  setWatermark(text: string, opacity: number): void;
  setCropPreview(rect: Rect | null): void;
  applyCrop(rect: Rect): void;
  redraw(): void;
  getBlob(mime: string, quality?: number): Promise<Blob>;
  getCanvas(): HTMLCanvasElement | null;
  getImageSize(): { width: number; height: number } | null;
}

const WATERMARK_ROTATION_RAD = (30 * Math.PI) / 180;
// Gap between text instances along the rotation axis, in units of lineHeight.
// 1.5 reproduces v0.3.0's short-text spacing exactly (40-px text + 16-px line
// → 24-px gap) while no longer scaling the gap with the text length, which
// was the cause of the #54 long-text diagonal-band bug.
const WATERMARK_X_GAP_MULTIPLIER = 1.5;
const WATERMARK_Y_SPACING = 2.5;
const WATERMARK_LINE_HEIGHT_MULTIPLIER = 1.2;
const WATERMARK_SIZE_DIVISOR = 28;
// Hardcoded mono stack rather than reading var(--mono) at draw time: ctx.font
// is parsed as a CSS font shorthand that doesn't resolve CSS custom properties,
// and getComputedStyle round-trips are slower than a constant string.
const WATERMARK_FONT_STACK =
  '"JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, Consolas, monospace';

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    // Keep the blob URL alive — drawImage needs the source image to remain
    // decodable for redraws. We let the URL leak; it's released on page unload.
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    img.src = url;
  });
}

export function createCanvasRenderer(container: HTMLElement): CanvasRenderer {
  let source: HTMLImageElement | HTMLCanvasElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let overlays: readonly Overlay[] = [];
  let grayscale = false;
  let cachedGrayscale: ImageData | null = null;
  let watermarkText = '';
  let watermarkOpacity = 0.3;
  let cropPreview: Rect | null = null;

  const drawWatermark = (): void => {
    if (!ctx || !canvas || watermarkText === '') return;
    const size = Math.floor(Math.min(canvas.width, canvas.height) / WATERMARK_SIZE_DIVISOR);
    if (size <= 0) return;
    ctx.save();
    ctx.font = `${size}px ${WATERMARK_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(0, 0, 0, ${watermarkOpacity})`;
    const textWidth = ctx.measureText(watermarkText).width;
    const lineHeight = size * WATERMARK_LINE_HEIGHT_MULTIPLIER;
    const tiles = tilePositions({
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      textWidth,
      lineHeight,
      rotationRad: WATERMARK_ROTATION_RAD,
      xGapMultiplier: WATERMARK_X_GAP_MULTIPLIER,
      ySpacing: WATERMARK_Y_SPACING,
    });
    for (const tile of tiles) {
      ctx.save();
      ctx.translate(tile.x, tile.y);
      ctx.rotate(WATERMARK_ROTATION_RAD);
      ctx.fillText(watermarkText, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  const redraw = (): void => {
    if (!ctx || !canvas || !source) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (grayscale) {
      if (!cachedGrayscale) {
        ctx.drawImage(source, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        data.data.set(toGrayscale(data.data));
        cachedGrayscale = data;
      }
      ctx.putImageData(cachedGrayscale, 0, 0);
    } else {
      ctx.drawImage(source, 0, 0);
    }
    drawWatermark();

    if (cropPreview === null) {
      for (const overlay of overlays) overlay.draw(ctx);
      return;
    }

    // Crop mode — dim pre-existing redactions (read-only signal) and add
    // the dim-outside overlay + outline + handles. Scale is image-px per
    // CSS-px and keeps stroke/handle sizes visually consistent across DPRs.
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (const overlay of overlays) overlay.draw(ctx);
    ctx.restore();

    const cssWidth = Math.max(canvas.getBoundingClientRect().width, 1);
    const scale = canvas.width / cssWidth;
    const r = cropPreview;

    // 1. Dim outside the crop rect with four black strips. Avoids any
    //    clip()/save() interaction with the watermark/source layers.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, r.y);
    ctx.fillRect(0, r.y, r.x, r.h);
    ctx.fillRect(r.x + r.w, r.y, canvas.width - (r.x + r.w), r.h);
    ctx.fillRect(0, r.y + r.h, canvas.width, canvas.height - (r.y + r.h));
    ctx.restore();

    // 2. Crop outline.
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();

    // 3. Eight square handles at corners + edge midpoints. The 8-px floor
    //    keeps handles visible on tiny test fixtures (e.g. 32×32) where
    //    12 * scale would round to zero.
    const handleSize = Math.max(8, 12 * scale);
    const half = handleSize / 2;
    const anchors: Array<[number, number]> = [
      [r.x, r.y],
      [r.x + r.w / 2, r.y],
      [r.x + r.w, r.y],
      [r.x + r.w, r.y + r.h / 2],
      [r.x + r.w, r.y + r.h],
      [r.x + r.w / 2, r.y + r.h],
      [r.x, r.y + r.h],
      [r.x, r.y + r.h / 2],
    ];
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 * scale;
    for (const [ax, ay] of anchors) {
      ctx.fillRect(ax - half, ay - half, handleSize, handleSize);
      ctx.strokeRect(ax - half, ay - half, handleSize, handleSize);
    }
    ctx.restore();
  };

  return {
    async load(file: File): Promise<void> {
      const img = await loadImageElement(file);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.className = 'upload-preview';
      const got = c.getContext('2d');
      if (!got) throw new Error('Failed to acquire 2D context');
      source = img;
      canvas = c;
      ctx = got;
      overlays = [];
      grayscale = false;
      cachedGrayscale = null;
      watermarkText = '';
      watermarkOpacity = 0.3;
      cropPreview = null;
      container.replaceChildren(c);
      // Fire-and-forget the initial paint via rAF. load() resolves immediately
      // so consumers can wire up listeners; the rAF callback paints the base
      // image when the compositor is ready. In real browsers this is one frame.
      // In some headless test environments rAF doesn't fire — that's acceptable
      // because functional state lives in setOverlays-driven redraws, and
      // Playwright tests query DOM state (not pixel state) via CDP.
      requestAnimationFrame(() => redraw());
    },

    setOverlays(next: readonly Overlay[]): void {
      overlays = next;
      redraw();
    },

    setGrayscale(on: boolean): void {
      grayscale = on;
      redraw();
    },

    setWatermark(text: string, opacity: number): void {
      watermarkText = text;
      watermarkOpacity = opacity;
      redraw();
    },

    setCropPreview(rect: Rect | null): void {
      cropPreview = rect;
      redraw();
    },

    applyCrop(rect: Rect): void {
      if (!source || !canvas || !ctx) return;
      // Render the source-only pixels (no overlays, no watermark) into an
      // offscreen canvas. We crop the source, not the live canvas, so the
      // watermark continues to scale relative to the new, smaller canvas
      // dimensions rather than being baked in at the moment of crop.
      const off = document.createElement('canvas');
      off.width = rect.w;
      off.height = rect.h;
      const offCtx = off.getContext('2d');
      if (!offCtx) throw new Error('Failed to acquire 2D context for crop');
      // ctx.drawImage uses canvas.width/height when src is a canvas, and
      // naturalWidth/naturalHeight when src is an image — both correct here.
      offCtx.drawImage(source, -rect.x, -rect.y);

      // Setting canvas.width clears the 2D context state, so do it before
      // any redraw call that relies on it.
      source = off;
      canvas.width = rect.w;
      canvas.height = rect.h;

      cachedGrayscale = null;
      cropPreview = null;
      // Pre-crop overlay coordinates don't translate cleanly across the
      // crop bounds; clearing here keeps the renderer self-consistent.
      // main.ts also resets history; this is the renderer's own guarantee.
      overlays = [];
      redraw();
    },

    redraw,

    getBlob(mime: string, quality?: number): Promise<Blob> {
      return new Promise((resolve, reject) => {
        if (!canvas) {
          reject(new Error('No image loaded'));
          return;
        }
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
          mime,
          quality,
        );
      });
    },

    getCanvas(): HTMLCanvasElement | null {
      return canvas;
    },

    getImageSize(): { width: number; height: number } | null {
      if (!canvas) return null;
      return { width: canvas.width, height: canvas.height };
    },
  };
}
