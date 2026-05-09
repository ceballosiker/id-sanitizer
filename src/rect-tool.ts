import type { Overlay } from './canvas';

export type Rect = { x: number; y: number; w: number; h: number };

export function clientToImageSpace(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
  imageSize: { width: number; height: number },
): { x: number; y: number } {
  const scaleX = imageSize.width / bounds.width;
  const scaleY = imageSize.height / bounds.height;
  return {
    x: (clientX - bounds.left) * scaleX,
    y: (clientY - bounds.top) * scaleY,
  };
}

export function normalizeRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}

const rectToOverlay = (r: Rect): Overlay => ({
  draw: (ctx) => {
    ctx.fillStyle = 'black';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  },
});

export interface RectTool {
  getRects(): readonly Rect[];
  setRects(rects: readonly Rect[]): void;
  isDragging(): boolean;
}

export function setupRectTool(
  canvas: HTMLCanvasElement,
  onOverlaysChanged: (overlays: readonly Overlay[]) => void,
  onCommit: (rects: readonly Rect[]) => void,
): RectTool {
  let dragStart: { x: number; y: number } | null = null;
  let draft: Rect | null = null;
  let committed: Rect[] = [];

  const emit = (): void => {
    const all: readonly Rect[] = draft ? [...committed, draft] : committed;
    onOverlaysChanged(all.map(rectToOverlay));
  };

  const toImage = (e: PointerEvent): { x: number; y: number } =>
    clientToImageSpace(e.clientX, e.clientY, canvas.getBoundingClientRect(), {
      width: canvas.width,
      height: canvas.height,
    });

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    dragStart = toImage(e);
    draft = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
    emit();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    draft = normalizeRect(dragStart, toImage(e));
    emit();
  });

  const finishDrag = (): void => {
    if (draft && draft.w > 0 && draft.h > 0) {
      committed.push(draft);
      onCommit([...committed]);
    }
    dragStart = null;
    draft = null;
    emit();
  };

  canvas.addEventListener('pointerup', (e) => {
    canvas.releasePointerCapture(e.pointerId);
    finishDrag();
  });

  canvas.addEventListener('pointercancel', finishDrag);

  return {
    getRects(): readonly Rect[] {
      return [...committed];
    },
    setRects(next: readonly Rect[]): void {
      committed = [...next];
      emit();
    },
    isDragging(): boolean {
      return dragStart !== null;
    },
  };
}
