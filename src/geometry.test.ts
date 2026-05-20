import { test, expect } from 'vitest';
import { clientToImageSpace, normalizeRect } from './geometry';

const bounds = { left: 100, top: 50, width: 800, height: 400 };
const imageSize = { width: 200, height: 100 };

test('clientToImageSpace: top-left of bounds maps to image (0, 0)', () => {
  expect(clientToImageSpace(100, 50, bounds, imageSize)).toEqual({ x: 0, y: 0 });
});

test('clientToImageSpace: bottom-right of bounds maps to image (width, height)', () => {
  expect(clientToImageSpace(900, 450, bounds, imageSize)).toEqual({
    x: 200,
    y: 100,
  });
});

test('clientToImageSpace: midpoint maps to half image dims', () => {
  expect(clientToImageSpace(500, 250, bounds, imageSize)).toEqual({
    x: 100,
    y: 50,
  });
});

test('clientToImageSpace: handles different x/y scaling factors', () => {
  const b = { left: 0, top: 0, width: 800, height: 400 };
  const i = { width: 100, height: 100 };
  expect(clientToImageSpace(400, 200, b, i)).toEqual({ x: 50, y: 50 });
});

test('normalizeRect: top-left to bottom-right drag', () => {
  expect(normalizeRect({ x: 10, y: 20 }, { x: 50, y: 80 })).toEqual({
    x: 10,
    y: 20,
    w: 40,
    h: 60,
  });
});

test('normalizeRect: bottom-right to top-left drag (reversed)', () => {
  expect(normalizeRect({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({
    x: 10,
    y: 20,
    w: 40,
    h: 60,
  });
});

test('normalizeRect: bottom-left to top-right drag (mixed direction)', () => {
  expect(normalizeRect({ x: 10, y: 80 }, { x: 50, y: 20 })).toEqual({
    x: 10,
    y: 20,
    w: 40,
    h: 60,
  });
});

test('normalizeRect: same start and end produces zero-size rect', () => {
  expect(normalizeRect({ x: 10, y: 20 }, { x: 10, y: 20 })).toEqual({
    x: 10,
    y: 20,
    w: 0,
    h: 0,
  });
});
