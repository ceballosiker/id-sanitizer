import { test, expect } from 'vitest';
import { createHistory } from './history';

test('canUndo and canRedo are false on a fresh history', () => {
  const h = createHistory<number>(100);
  expect(h.canUndo()).toBe(false);
  expect(h.canRedo()).toBe(false);
});

test('canUndo is false after pushing only the floor entry', () => {
  const h = createHistory<number>(100);
  h.push(1);
  expect(h.canUndo()).toBe(false);
});

test('canUndo is true after pushing two entries', () => {
  const h = createHistory<number>(100);
  h.push(1);
  h.push(2);
  expect(h.canUndo()).toBe(true);
});

test('undo returns the previous snapshot and enables redo', () => {
  const h = createHistory<number>(100);
  h.push(1);
  h.push(2);
  h.push(3);
  expect(h.undo()).toBe(2);
  expect(h.canRedo()).toBe(true);
});

test('redo replays consumed undos in order', () => {
  const h = createHistory<number>(100);
  h.push(1);
  h.push(2);
  h.push(3);
  h.undo();
  h.undo();
  expect(h.canRedo()).toBe(true);
  expect(h.redo()).toBe(2);
  expect(h.redo()).toBe(3);
  expect(h.canRedo()).toBe(false);
});

test('push after undo invalidates the redo stack', () => {
  const h = createHistory<number>(100);
  h.push(1);
  h.push(2);
  h.push(3);
  h.undo();
  h.push(99);
  expect(h.canRedo()).toBe(false);
});

test('undo returns undefined at the floor', () => {
  const h = createHistory<number>(100);
  h.push(1);
  expect(h.undo()).toBeUndefined();
});

test('redo returns undefined when the redo stack is empty', () => {
  const h = createHistory<number>(100);
  h.push(1);
  expect(h.redo()).toBeUndefined();
});

test('reset clears past and future', () => {
  const h = createHistory<number>(100);
  h.push(1);
  h.push(2);
  h.undo();
  h.reset();
  expect(h.canUndo()).toBe(false);
  expect(h.canRedo()).toBe(false);
});

test('maxEntries cap drops the oldest entry beyond the limit', () => {
  const h = createHistory<number>(3);
  h.push(1);
  h.push(2);
  h.push(3);
  h.push(4);
  expect(h.undo()).toBe(3);
  expect(h.undo()).toBe(2);
  expect(h.canUndo()).toBe(false);
});
