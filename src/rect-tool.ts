import type { Overlay } from './canvas';
import { clientToImageSpace, normalizeRect, type Rect } from './geometry';

export type { Rect };

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
  enabled: () => boolean = () => true,
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
    if (!enabled()) return;
    canvas.setPointerCapture(e.pointerId);
    dragStart = toImage(e);
    draft = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
    emit();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!enabled()) return;
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
    if (!enabled()) return;
    canvas.releasePointerCapture(e.pointerId);
    finishDrag();
  });

  canvas.addEventListener('pointercancel', () => {
    if (!enabled()) return;
    finishDrag();
  });

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
