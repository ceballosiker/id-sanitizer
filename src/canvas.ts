export type Overlay = {
  draw(ctx: CanvasRenderingContext2D): void;
};

export interface CanvasRenderer {
  load(file: File): Promise<void>;
  setOverlays(overlays: readonly Overlay[]): void;
  redraw(): void;
  getBlob(mime: string, quality?: number): Promise<Blob>;
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
      // Defer the initial paint by one frame so the DOM mount commits before
      // we touch the canvas — without this, headless Chromium deadlocks
      // between the DOM update and the canvas compositor on the first draw.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      redraw();
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
  };
}
