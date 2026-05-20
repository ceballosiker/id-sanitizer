import { clientToImageSpace, normalizeRect, type Rect } from './geometry';

export function clampRectToImage(rect: Rect, imageW: number, imageH: number): Rect {
  let { x, y, w, h } = rect;

  // Snap origin into [0, imageW/H]; shrink w/h by the snap delta so the
  // opposite edge stays put. Done before the overflow check because a rect
  // with x<0 and w huge would otherwise hit the overflow branch first and
  // truncate against the wrong reference point.
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }

  if (x + w > imageW) w = imageW - x;
  if (y + h > imageH) h = imageH - y;

  // Final floor: zero/negative dimensions are invalid for a crop (we'd
  // produce a 0×N or N×0 source). Force at least 1 px in each axis; the
  // creating→adjusting transition in setupCropTool relies on this so the
  // floating bar never appears for a true zero-area rect, but a later
  // resize that pinches the rect through zero stays valid.
  if (w < 1) w = 1;
  if (h < 1) h = 1;

  return { x, y, w, h };
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const CORNERS: Handle[] = ['nw', 'ne', 'se', 'sw'];
const EDGES: Handle[] = ['n', 'e', 's', 'w'];

function handleAnchor(handle: Handle, rect: Rect): { x: number; y: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  switch (handle) {
    case 'nw':
      return { x: rect.x, y: rect.y };
    case 'n':
      return { x: cx, y: rect.y };
    case 'ne':
      return { x: rect.x + rect.w, y: rect.y };
    case 'e':
      return { x: rect.x + rect.w, y: cy };
    case 'se':
      return { x: rect.x + rect.w, y: rect.y + rect.h };
    case 's':
      return { x: cx, y: rect.y + rect.h };
    case 'sw':
      return { x: rect.x, y: rect.y + rect.h };
    case 'w':
      return { x: rect.x, y: cy };
  }
}

export function hitTestHandle(
  point: { x: number; y: number },
  rect: Rect,
  hitRadius: number,
): Handle | null {
  // Corners first so that a tie at a corner/edge overlap resolves to the
  // corner (e.g. a point equidistant from "nw" and "n" should grab the
  // free corner, not the constrained edge).
  for (const h of CORNERS) {
    const a = handleAnchor(h, rect);
    const dx = point.x - a.x;
    const dy = point.y - a.y;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return h;
  }
  for (const h of EDGES) {
    const a = handleAnchor(h, rect);
    const dx = point.x - a.x;
    const dy = point.y - a.y;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return h;
  }
  return null;
}

export function resizeRectByHandle(
  rect: Rect,
  handle: Handle,
  point: { x: number; y: number },
  imageW: number,
  imageH: number,
): Rect {
  // Express the rect by its two corner xs/ys, mutate the corners the handle
  // controls, then re-derive {x, y, w, h} via min/abs. This is the same
  // normalization trick as normalizeRect — flipping the rect through zero
  // just swaps which corner is "top-left".
  let x1 = rect.x;
  let y1 = rect.y;
  let x2 = rect.x + rect.w;
  let y2 = rect.y + rect.h;

  // Corners drive two coordinates. Edges drive one. Each branch falls
  // through to a single normalize+clamp step at the end.
  switch (handle) {
    case 'nw':
      x1 = point.x;
      y1 = point.y;
      break;
    case 'n':
      y1 = point.y;
      break;
    case 'ne':
      x2 = point.x;
      y1 = point.y;
      break;
    case 'e':
      x2 = point.x;
      break;
    case 'se':
      x2 = point.x;
      y2 = point.y;
      break;
    case 's':
      y2 = point.y;
      break;
    case 'sw':
      x1 = point.x;
      y2 = point.y;
      break;
    case 'w':
      x1 = point.x;
      break;
  }

  const normalized: Rect = {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
  return clampRectToImage(normalized, imageW, imageH);
}

export interface CropTool {
  getRect(): Rect | null;
  destroy(): void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'creating'; anchor: { x: number; y: number } }
  | { kind: 'adjusting' }
  | { kind: 'dragging-handle'; handle: Handle }
  | { kind: 'dragging-body'; offset: { x: number; y: number } };

const RECT_EXISTS = (s: State): boolean =>
  s.kind === 'adjusting' || s.kind === 'dragging-handle' || s.kind === 'dragging-body';

export function setupCropTool(
  canvas: HTMLCanvasElement,
  imageSize: { width: number; height: number },
  callbacks: {
    onPreviewChanged: (rect: Rect | null) => void;
    onConfirm: (rect: Rect) => void;
    onCancel: () => void;
  },
): CropTool {
  let state: State = { kind: 'idle' };
  let rect: Rect | null = null;

  // Floating confirm/cancel bar — appended to the canvas's parent, which
  // main.ts gives `position: relative` via the existing #upload selector.
  const parent = canvas.parentElement;
  if (!parent) throw new Error('Crop tool requires the canvas to have a parent element');
  const bar = document.createElement('div');
  bar.className = 'crop-confirm-bar';
  bar.hidden = true;
  bar.innerHTML = `
    <button type="button" data-action="crop-cancel">Cancel</button>
    <button type="button" data-action="crop-confirm">Confirm</button>
  `;
  parent.appendChild(bar);
  const cancelBtn = bar.querySelector<HTMLButtonElement>('[data-action=crop-cancel]')!;
  const confirmBtn = bar.querySelector<HTMLButtonElement>('[data-action=crop-confirm]')!;

  const toImage = (e: PointerEvent): { x: number; y: number } =>
    clientToImageSpace(e.clientX, e.clientY, canvas.getBoundingClientRect(), imageSize);

  const hitRadius = (): number => {
    // Recompute per pointerdown — cheap, and handles window resizes
    // between drags. Formula matches the spec (line 161): 24 CSS px in
    // image-space units.
    const cssWidth = Math.max(canvas.getBoundingClientRect().width, 1);
    const scale = canvas.width / cssWidth;
    return 24 * scale;
  };

  const updateCursor = (
    kind: State['kind'],
    handle?: Handle,
    point?: { x: number; y: number },
  ): void => {
    if (kind === 'idle' || kind === 'creating') {
      canvas.style.cursor = 'crosshair';
      return;
    }
    // Adjusting / dragging — pick the cursor from the hovered/active handle
    // when one is supplied; otherwise default to 'move' inside the body.
    if (handle) {
      canvas.style.cursor = cursorForHandle(handle);
      return;
    }
    if (point && rect && pointInRect(point, rect)) {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  };

  const emit = (): void => {
    callbacks.onPreviewChanged(rect);
    bar.hidden = !(rect !== null && RECT_EXISTS(state));
  };

  const onPointerDown = (e: PointerEvent): void => {
    canvas.setPointerCapture(e.pointerId);
    const p = toImage(e);
    if (state.kind === 'idle' || !rect) {
      state = { kind: 'creating', anchor: p };
      rect = { x: p.x, y: p.y, w: 0, h: 0 };
      updateCursor(state.kind);
      emit();
      return;
    }
    // adjusting — pick handle, body, or restart-from-here.
    const handle = hitTestHandle(p, rect, hitRadius());
    if (handle) {
      state = { kind: 'dragging-handle', handle };
      updateCursor(state.kind, handle);
      emit();
      return;
    }
    if (pointInRect(p, rect)) {
      state = { kind: 'dragging-body', offset: { x: p.x - rect.x, y: p.y - rect.y } };
      updateCursor(state.kind, undefined, p);
      emit();
      return;
    }
    // Outside the rect — discard and start a fresh drag.
    state = { kind: 'creating', anchor: p };
    rect = { x: p.x, y: p.y, w: 0, h: 0 };
    updateCursor(state.kind);
    emit();
  };

  const onPointerMove = (e: PointerEvent): void => {
    const p = toImage(e);
    if (state.kind === 'creating') {
      rect = clampRectToImage(normalizeRect(state.anchor, p), imageSize.width, imageSize.height);
      emit();
      return;
    }
    if (state.kind === 'dragging-handle' && rect) {
      rect = resizeRectByHandle(rect, state.handle, p, imageSize.width, imageSize.height);
      emit();
      return;
    }
    if (state.kind === 'dragging-body' && rect) {
      const nx = p.x - state.offset.x;
      const ny = p.y - state.offset.y;
      // Move-only translation: keep w/h fixed and clamp the origin so
      // the rect cannot leave the image bounds.
      const x = Math.max(0, Math.min(imageSize.width - rect.w, nx));
      const y = Math.max(0, Math.min(imageSize.height - rect.h, ny));
      rect = { x, y, w: rect.w, h: rect.h };
      emit();
      return;
    }
    if (state.kind === 'adjusting' && rect) {
      // Hover-only — update the cursor to give the user a hit-test hint.
      const handle = hitTestHandle(p, rect, hitRadius());
      updateCursor(state.kind, handle ?? undefined, p);
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    canvas.releasePointerCapture(e.pointerId);
    if (state.kind === 'creating') {
      if (rect && rect.w >= 1 && rect.h >= 1) {
        state = { kind: 'adjusting' };
      } else {
        rect = null;
        state = { kind: 'idle' };
      }
    } else if (state.kind === 'dragging-handle' || state.kind === 'dragging-body') {
      state = { kind: 'adjusting' };
    }
    updateCursor(state.kind);
    emit();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      callbacks.onCancel();
      return;
    }
    if (e.key === 'Enter' && rect && RECT_EXISTS(state)) {
      e.preventDefault();
      callbacks.onConfirm(rect);
    }
  };

  cancelBtn.addEventListener('click', () => callbacks.onCancel());
  confirmBtn.addEventListener('click', () => {
    if (rect && RECT_EXISTS(state)) callbacks.onConfirm(rect);
  });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKeyDown);

  // Initial paint: clear any leftover preview from a previous session.
  emit();

  return {
    getRect(): Rect | null {
      return rect;
    },
    destroy(): void {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      bar.remove();
      canvas.style.cursor = '';
    },
  };
}

function pointInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function cursorForHandle(h: Handle): string {
  switch (h) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
  }
}
