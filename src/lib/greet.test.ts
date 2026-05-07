import { describe, expect, it } from 'vitest';
import { greet } from './greet.ts';

describe('greet', () => {
  it('returns a friendly greeting', () => {
    expect(greet('world')).toBe('Hello, world!');
  });
});
