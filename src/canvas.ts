export type Overlay = {
  draw(ctx: CanvasRenderingContext2D): void;
};

export interface CanvasRenderer {
  load(file: File): Promise<void>;
  setOverlays(overlays: readonly Overlay[]): void;
  redraw(): void;
  getBlob(mime: string, quality?: number): Promise<Blob>;
}

export function createCanvasRenderer(container: HTMLElement): CanvasRenderer {
  let bitmap: ImageBitmap | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let overlays: readonly Overlay[] = [];

  const redraw = (): void => {
    if (!ctx || !canvas || !bitmap) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    for (const overlay of overlays) overlay.draw(ctx);
  };

  return {
    async load(file: File): Promise<void> {
      bitmap = await createImageBitmap(file);
      canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.className = 'upload-preview';
      const got = canvas.getContext('2d');
      if (!got) throw new Error('Failed to acquire 2D context');
      ctx = got;
      container.replaceChildren(canvas);
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
