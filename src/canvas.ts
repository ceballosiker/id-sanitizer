import { toGrayscale } from './grayscale';
import { tilePositions } from './watermark';

export type Overlay = {
  draw(ctx: CanvasRenderingContext2D): void;
};

export interface CanvasRenderer {
  load(file: File): Promise<void>;
  setOverlays(overlays: readonly Overlay[]): void;
  setGrayscale(on: boolean): void;
  setWatermark(text: string, opacity: number): void;
  redraw(): void;
  getBlob(mime: string, quality?: number): Promise<Blob>;
  getCanvas(): HTMLCanvasElement | null;
}

const WATERMARK_ROTATION_RAD = (30 * Math.PI) / 180;
const WATERMARK_X_SPACING = 1.6;
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
  let source: HTMLImageElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let overlays: readonly Overlay[] = [];
  let grayscale = false;
  let cachedGrayscale: ImageData | null = null;
  let watermarkText = '';
  let watermarkOpacity = 0.3;

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
      xSpacing: WATERMARK_X_SPACING,
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
    for (const overlay of overlays) overlay.draw(ctx);
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
  };
}
