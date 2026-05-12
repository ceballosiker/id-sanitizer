export interface TileGridParams {
  canvasWidth: number;
  canvasHeight: number;
  textWidth: number;
  lineHeight: number;
  rotationRad: number;
  // Gap between adjacent text instances along the rotation axis, in units of
  // lineHeight. Asymmetric with ySpacing on purpose: text has variable width,
  // so the X step is `textWidth + lineHeight × xGapMultiplier` — the gap stays
  // constant regardless of how long the string is. (Y has constant line height,
  // so ySpacing can be a plain multiplier-of-step.)
  xGapMultiplier: number;
  ySpacing: number;
}

export interface Tile {
  x: number;
  y: number;
}

// Generate tile anchor points so a rotated text grid fully covers the canvas.
// Tiles are laid out in a rotated (u, v) coordinate system with steps
// `textWidth + lineHeight × xGapMultiplier` along the rotation axis and
// `lineHeight × ySpacing` perpendicular to it, then transformed back to
// canvas (x, y). The renderer rotates by `rotationRad` around each anchor at
// draw time.
export function tilePositions(params: TileGridParams): Tile[] {
  const {
    canvasWidth,
    canvasHeight,
    textWidth,
    lineHeight,
    rotationRad,
    xGapMultiplier,
    ySpacing,
  } = params;
  if (canvasWidth <= 0 || canvasHeight <= 0 || textWidth <= 0 || lineHeight <= 0) {
    return [];
  }

  const stepU = textWidth + lineHeight * xGapMultiplier;
  const stepV = lineHeight * ySpacing;
  const cosT = Math.cos(rotationRad);
  const sinT = Math.sin(rotationRad);

  // (u, v) bounding box of the canvas corners in rotated coordinates.
  const corners: Array<[number, number]> = [
    [0, 0],
    [canvasWidth, 0],
    [canvasWidth, canvasHeight],
    [0, canvasHeight],
  ];
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const [x, y] of corners) {
    const u = x * cosT + y * sinT;
    const v = -x * sinT + y * cosT;
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }

  const uStart = Math.floor(uMin / stepU) * stepU;
  const vStart = Math.floor(vMin / stepV) * stepV;

  const tiles: Tile[] = [];
  for (let v = vStart; v <= vMax + stepV; v += stepV) {
    for (let u = uStart; u <= uMax + stepU; u += stepU) {
      tiles.push({
        x: u * cosT - v * sinT,
        y: u * sinT + v * cosT,
      });
    }
  }
  return tiles;
}
