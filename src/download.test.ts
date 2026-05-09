import { test, expect } from 'vitest';
import { buildFilename, formatToMime } from './download';

test('buildFilename: appends -sanitized and the right extension', () => {
  expect(buildFilename('passport.png', 'png')).toBe('passport-sanitized.png');
});

test('buildFilename: changes extension when format differs from source', () => {
  expect(buildFilename('passport.png', 'jpeg')).toBe('passport-sanitized.jpg');
});

test('buildFilename: jpeg uses .jpg extension (conventional)', () => {
  expect(buildFilename('photo.jpeg', 'jpeg')).toBe('photo-sanitized.jpg');
});

test('buildFilename: input without an extension is treated as a base name', () => {
  expect(buildFilename('photo', 'png')).toBe('photo-sanitized.png');
});

test('buildFilename: only the last extension is stripped', () => {
  expect(buildFilename('archive.tar.gz', 'png')).toBe('archive.tar-sanitized.png');
});

test('buildFilename: empty string falls back to "id"', () => {
  expect(buildFilename('', 'png')).toBe('id-sanitized.png');
});

test('buildFilename: undefined falls back to "id"', () => {
  expect(buildFilename(undefined, 'jpeg')).toBe('id-sanitized.jpg');
});

test('formatToMime: png returns image/png with undefined quality', () => {
  expect(formatToMime('png')).toEqual({
    mime: 'image/png',
    quality: undefined,
  });
});

test('formatToMime: jpeg returns image/jpeg with 0.92 quality', () => {
  expect(formatToMime('jpeg')).toEqual({
    mime: 'image/jpeg',
    quality: 0.92,
  });
});
