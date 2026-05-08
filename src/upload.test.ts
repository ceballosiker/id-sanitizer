import { test, expect } from 'vitest';
import { pickFirstValidImage } from './upload';

const file = (type: string, name = 'x') => new File(['x'], name, { type });

test('returns the only file when one valid image given', () => {
  const png = file('image/png');
  expect(pickFirstValidImage([png])).toBe(png);
});

test('skips non-images and returns the first valid', () => {
  const txt = file('text/plain');
  const jpg = file('image/jpeg');
  expect(pickFirstValidImage([txt, jpg])).toBe(jpg);
});

test('returns the first when multiple images given', () => {
  const png = file('image/png');
  const webp = file('image/webp');
  expect(pickFirstValidImage([png, webp])).toBe(png);
});

test('returns null when no valid files', () => {
  expect(pickFirstValidImage([file('text/plain'), file('application/pdf')])).toBeNull();
});

test('returns null on empty input', () => {
  expect(pickFirstValidImage([])).toBeNull();
});
