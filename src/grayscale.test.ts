import { test, expect } from 'vitest';
import { toGrayscale } from './grayscale';

const u = (...bytes: number[]): Uint8ClampedArray => new Uint8ClampedArray(bytes);

test('pure red maps to Rec. 601 luma 76', () => {
  expect(Array.from(toGrayscale(u(255, 0, 0, 255)))).toEqual([76, 76, 76, 255]);
});

test('pure green maps to Rec. 601 luma 150', () => {
  expect(Array.from(toGrayscale(u(0, 255, 0, 255)))).toEqual([150, 150, 150, 255]);
});

test('pure blue maps to Rec. 601 luma 29', () => {
  expect(Array.from(toGrayscale(u(0, 0, 255, 255)))).toEqual([29, 29, 29, 255]);
});

test('black stays black', () => {
  expect(Array.from(toGrayscale(u(0, 0, 0, 255)))).toEqual([0, 0, 0, 255]);
});

test('white stays white', () => {
  expect(Array.from(toGrayscale(u(255, 255, 255, 255)))).toEqual([255, 255, 255, 255]);
});

test('alpha is preserved per pixel', () => {
  expect(Array.from(toGrayscale(u(255, 0, 0, 128)))).toEqual([76, 76, 76, 128]);
});

test('already-gray pixels are unchanged', () => {
  expect(Array.from(toGrayscale(u(100, 100, 100, 255)))).toEqual([100, 100, 100, 255]);
});

test('transform is idempotent', () => {
  const once = toGrayscale(u(200, 50, 25, 255));
  const twice = toGrayscale(once);
  expect(Array.from(twice)).toEqual(Array.from(once));
});

test('empty input returns empty output', () => {
  expect(toGrayscale(new Uint8ClampedArray(0)).length).toBe(0);
});

test('handles multiple pixels in one buffer', () => {
  expect(Array.from(toGrayscale(u(255, 0, 0, 255, 0, 255, 0, 255)))).toEqual([
    76, 76, 76, 255, 150, 150, 150, 255,
  ]);
});

test('does not mutate the input buffer', () => {
  const input = u(255, 0, 0, 255);
  toGrayscale(input);
  expect(Array.from(input)).toEqual([255, 0, 0, 255]);
});
