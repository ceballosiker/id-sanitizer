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
