import { test, expect } from 'vitest';
import { clampRectToImage } from './crop-tool';

test('clampRectToImage: rect strictly inside is returned unchanged', () => {
  expect(clampRectToImage({ x: 10, y: 10, w: 50, h: 50 }, 200, 200)).toEqual({
    x: 10,
    y: 10,
    w: 50,
    h: 50,
  });
});

test('clampRectToImage: negative x snaps to 0 and shortens w accordingly', () => {
  expect(clampRectToImage({ x: -10, y: 10, w: 50, h: 50 }, 200, 200)).toEqual({
    x: 0,
    y: 10,
    w: 40,
    h: 50,
  });
});

test('clampRectToImage: negative y snaps to 0 and shortens h accordingly', () => {
  expect(clampRectToImage({ x: 10, y: -20, w: 50, h: 50 }, 200, 200)).toEqual({
    x: 10,
    y: 0,
    w: 50,
    h: 30,
  });
});

test('clampRectToImage: w overflowing image is truncated to bounds', () => {
  expect(clampRectToImage({ x: 180, y: 10, w: 50, h: 50 }, 200, 200)).toEqual({
    x: 180,
    y: 10,
    w: 20,
    h: 50,
  });
});

test('clampRectToImage: h overflowing image is truncated to bounds', () => {
  expect(clampRectToImage({ x: 10, y: 180, w: 50, h: 50 }, 200, 200)).toEqual({
    x: 10,
    y: 180,
    w: 50,
    h: 20,
  });
});

test('clampRectToImage: zero w is forced to minimum 1', () => {
  expect(clampRectToImage({ x: 10, y: 10, w: 0, h: 50 }, 200, 200)).toEqual({
    x: 10,
    y: 10,
    w: 1,
    h: 50,
  });
});

test('clampRectToImage: zero h is forced to minimum 1', () => {
  expect(clampRectToImage({ x: 10, y: 10, w: 50, h: 0 }, 200, 200)).toEqual({
    x: 10,
    y: 10,
    w: 50,
    h: 1,
  });
});

test('clampRectToImage: negative w is forced to 1 (defensive)', () => {
  expect(clampRectToImage({ x: 10, y: 10, w: -5, h: 50 }, 200, 200)).toEqual({
    x: 10,
    y: 10,
    w: 1,
    h: 50,
  });
});

import { hitTestHandle, type Handle } from './crop-tool';

const r = { x: 100, y: 100, w: 200, h: 100 };
const HR = 10; // hit radius

// 8 handle anchor points for the rect above:
const anchors: Record<Handle, { x: number; y: number }> = {
  nw: { x: 100, y: 100 },
  n: { x: 200, y: 100 },
  ne: { x: 300, y: 100 },
  e: { x: 300, y: 150 },
  se: { x: 300, y: 200 },
  s: { x: 200, y: 200 },
  sw: { x: 100, y: 200 },
  w: { x: 100, y: 150 },
};

for (const [name, p] of Object.entries(anchors)) {
  test(`hitTestHandle: exact center of ${name} anchor hits ${name}`, () => {
    expect(hitTestHandle(p, r, HR)).toBe(name as Handle);
  });
}

test('hitTestHandle: just inside hitRadius of NW corner still hits nw', () => {
  // anchor is (100,100); offset (8,5) is distance sqrt(64+25)≈9.43 < 10
  expect(hitTestHandle({ x: 108, y: 105 }, r, HR)).toBe('nw');
});

test('hitTestHandle: point inside rect body but far from all anchors → null', () => {
  expect(hitTestHandle({ x: 200, y: 150 }, r, HR)).toBeNull();
});

test('hitTestHandle: point clearly outside the rect and outside all handle zones → null', () => {
  expect(hitTestHandle({ x: 500, y: 500 }, r, HR)).toBeNull();
});

test('hitTestHandle: when corner and edge zones overlap, corner wins', () => {
  // hitRadius huge enough that the N-edge anchor (200,100) and the NW
  // corner anchor (100,100) both claim the point (150,100). Distance to
  // NW = 50, to N = 50 — a tie that the function must resolve in favour
  // of the corner.
  expect(hitTestHandle({ x: 150, y: 100 }, r, 60)).toBe('nw');
});

import { resizeRectByHandle } from './crop-tool';

const base = { x: 100, y: 100, w: 200, h: 100 }; // image is 400×300 below

test('resizeRectByHandle: SE drag updates w and h only', () => {
  expect(resizeRectByHandle(base, 'se', { x: 350, y: 250 }, 400, 300)).toEqual({
    x: 100,
    y: 100,
    w: 250,
    h: 150,
  });
});

test('resizeRectByHandle: NW drag updates x, y, w, h', () => {
  expect(resizeRectByHandle(base, 'nw', { x: 50, y: 60 }, 400, 300)).toEqual({
    x: 50,
    y: 60,
    w: 250,
    h: 140,
  });
});

test('resizeRectByHandle: N edge updates y and h only (x, w unchanged)', () => {
  expect(resizeRectByHandle(base, 'n', { x: 999, y: 70 }, 400, 300)).toEqual({
    x: 100,
    y: 70,
    w: 200,
    h: 130,
  });
});

test('resizeRectByHandle: S edge updates h only (x, y, w unchanged)', () => {
  expect(resizeRectByHandle(base, 's', { x: 999, y: 250 }, 400, 300)).toEqual({
    x: 100,
    y: 100,
    w: 200,
    h: 150,
  });
});

test('resizeRectByHandle: E edge updates w only', () => {
  expect(resizeRectByHandle(base, 'e', { x: 350, y: 999 }, 400, 300)).toEqual({
    x: 100,
    y: 100,
    w: 250,
    h: 100,
  });
});

test('resizeRectByHandle: W edge updates x and w only', () => {
  expect(resizeRectByHandle(base, 'w', { x: 60, y: 999 }, 400, 300)).toEqual({
    x: 60,
    y: 100,
    w: 240,
    h: 100,
  });
});

test('resizeRectByHandle: SE drag past image bounds is clamped', () => {
  expect(resizeRectByHandle(base, 'se', { x: 9999, y: 9999 }, 400, 300)).toEqual({
    x: 100,
    y: 100,
    w: 300,
    h: 200,
  });
});

test('resizeRectByHandle: NW drag past origin is clamped to 0,0', () => {
  expect(resizeRectByHandle(base, 'nw', { x: -50, y: -50 }, 400, 300)).toEqual({
    x: 0,
    y: 0,
    w: 300,
    h: 200,
  });
});

test('resizeRectByHandle: SE drag past the opposite corner inverts and is normalized', () => {
  // SE handle dragged across the rect to (40, 50) — past the NW corner
  // (100, 100). The rect should flip so the new SE-equivalent corner
  // becomes the upper-left, with positive w/h.
  expect(resizeRectByHandle(base, 'se', { x: 40, y: 50 }, 400, 300)).toEqual({
    x: 40,
    y: 50,
    w: 60,
    h: 50,
  });
});

test('resizeRectByHandle: N edge dragged past the south edge flips correctly', () => {
  // N edge moved from y=100 to y=250, past the S edge at y=200. The rect
  // grows downward and its new y becomes 200 (the old south).
  expect(resizeRectByHandle(base, 'n', { x: 999, y: 250 }, 400, 300)).toEqual({
    x: 100,
    y: 200,
    w: 200,
    h: 50,
  });
});
