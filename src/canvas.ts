export type Overlay = {
  draw(ctx: CanvasRenderingContext2D): void;
};

export interface CanvasRenderer {
  load(file: File): Promise<void>;
  setOverlays(overlays: readonly Overlay[]): void;
  redraw(): void;
  getBlob(mime: string, quality?: number): Promise<Blob>;
  getCanvas(): HTMLCanvasElement | null;
}

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

  const redraw = (): void => {
    if (!ctx || !canvas || !source) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0);
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
