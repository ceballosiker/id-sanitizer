import { test, expect } from 'vitest';
import { tilePositions, type TileGridParams } from './watermark';

const baseParams = (overrides: Partial<TileGridParams> = {}): TileGridParams => ({
  canvasWidth: 200,
  canvasHeight: 100,
  textWidth: 40,
  lineHeight: 16,
  rotationRad: 0,
  xSpacing: 1.6,
  ySpacing: 2.5,
  ...overrides,
});

test('axis-aligned grid (rotation 0) produces an expected count', () => {
  // stepU = 40 * 1.6 = 64; stepV = 16 * 2.5 = 40
  // u in {0, 64, 128, 192, 256}; v in {0, 40, 80, 120} → 5 × 4 = 20 tiles
  const tiles = tilePositions(baseParams());
  expect(tiles).toHaveLength(20);
});

test('axis-aligned grid: first row is at y=0 with x stepping by 64', () => {
  const tiles = tilePositions(baseParams());
  const firstRow = tiles.filter((t) => t.y === 0).map((t) => t.x);
  expect(firstRow).toEqual([0, 64, 128, 192, 256]);
});

test('axis-aligned grid: row spacing matches lineHeight × ySpacing', () => {
  const tiles = tilePositions(baseParams());
  const distinctYs = [...new Set(tiles.map((t) => t.y))].sort((a, b) => a - b);
  expect(distinctYs).toEqual([0, 40, 80, 120]);
});

test('90° rotation swaps the grid orientation', () => {
  // cos=0, sin=1; canvas corners → u = y, v = -x
  // uMin=0, uMax=100; vMin=-200, vMax=0
  // stepU=64, stepV=40
  // u in {0, 64, 128} (3); v in {-200, -160, -120, -80, -40, 0, 40} (7)
  // 3 × 7 = 21 tiles
  const tiles = tilePositions(baseParams({ rotationRad: Math.PI / 2 }));
  expect(tiles).toHaveLength(21);
});

test('30° rotation produces a known tile count for a 200×100 canvas', () => {
  // cos≈0.866, sin=0.5
  // Corners (0,0),(200,0),(200,100),(0,100) → u in {0, 173.205, 223.205, 50}
  //                                            v in {0, -100, -13.397, 86.603}
  // uMin=0, uMax≈223.205; vMin=-100, vMax≈86.603
  // u steps from 0 by 64 while ≤ 287.205: {0, 64, 128, 192, 256} (5)
  // v steps from -120 by 40 while ≤ 126.603: {-120, -80, -40, 0, 40, 80, 120} (7)
  // 5 × 7 = 35 tiles
  const tiles = tilePositions(baseParams({ rotationRad: (30 * Math.PI) / 180 }));
  expect(tiles).toHaveLength(35);
});

test('30° rotation: rotating a tile center back puts it on the rotated-space grid', () => {
  const rotationRad = (30 * Math.PI) / 180;
  const tiles = tilePositions(baseParams({ rotationRad }));
  const cosT = Math.cos(rotationRad);
  const sinT = Math.sin(rotationRad);
  for (const t of tiles) {
    const u = t.x * cosT + t.y * sinT;
    const v = -t.x * sinT + t.y * cosT;
    // Tiles live on a (stepU=64, stepV=40) lattice
    expect(Math.abs(u - Math.round(u / 64) * 64)).toBeLessThan(1e-6);
    expect(Math.abs(v - Math.round(v / 40) * 40)).toBeLessThan(1e-6);
  }
});

test('every canvas pixel is within max-step distance of at least one tile', () => {
  const params = baseParams({ rotationRad: (30 * Math.PI) / 180 });
  const tiles = tilePositions(params);
  const maxStep = Math.max(params.textWidth * params.xSpacing, params.lineHeight * params.ySpacing);
  const samples: Array<[number, number]> = [
    [0, 0],
    [params.canvasWidth - 1, 0],
    [0, params.canvasHeight - 1],
    [params.canvasWidth - 1, params.canvasHeight - 1],
    [params.canvasWidth / 2, params.canvasHeight / 2],
  ];
  for (const [px, py] of samples) {
    const minDist = Math.min(...tiles.map((t) => Math.hypot(t.x - px, t.y - py)));
    expect(minDist).toBeLessThanOrEqual(maxStep);
  }
});

test('zero-width canvas yields no tiles', () => {
  expect(tilePositions(baseParams({ canvasWidth: 0 }))).toEqual([]);
});

test('zero-height canvas yields no tiles', () => {
  expect(tilePositions(baseParams({ canvasHeight: 0 }))).toEqual([]);
});

test('zero text width yields no tiles', () => {
  expect(tilePositions(baseParams({ textWidth: 0 }))).toEqual([]);
});

test('zero line height yields no tiles', () => {
  expect(tilePositions(baseParams({ lineHeight: 0 }))).toEqual([]);
});

test('negative dimensions yield no tiles', () => {
  expect(tilePositions(baseParams({ canvasWidth: -10 }))).toEqual([]);
});
