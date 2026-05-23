import { describe, expect, it } from 'vitest';
import { getWatermarkPlaceholder } from './watermark-placeholder';

// Fixed date at UTC noon so timezone offsets in CI can never shift the
// date to the prior/next day in any test environment.
const FIXED_DATE = new Date('2026-05-23T12:00:00Z');

describe('getWatermarkPlaceholder', () => {
  it('formats en-US with 4-digit year', () => {
    expect(getWatermarkPlaceholder(FIXED_DATE, 'en-US')).toBe('For [purpose] · 5/23/2026');
  });

  it('formats en-GB with day-first ordering and zero-padded month', () => {
    // CLDR's en-GB pattern is dd/MM/yyyy — month: 'numeric' still
    // produces a zero-padded month for this locale.
    expect(getWatermarkPlaceholder(FIXED_DATE, 'en-GB')).toBe('For [purpose] · 23/05/2026');
  });

  it('formats de-DE with dot separators', () => {
    expect(getWatermarkPlaceholder(FIXED_DATE, 'de-DE')).toBe('For [purpose] · 23.5.2026');
  });

  it('formats ja-JP with year-first ordering', () => {
    expect(getWatermarkPlaceholder(FIXED_DATE, 'ja-JP')).toBe('For [purpose] · 2026/5/23');
  });

  it('keeps the "For [purpose] · " prefix literal across locales', () => {
    for (const locale of ['en-US', 'en-GB', 'de-DE', 'ja-JP']) {
      expect(getWatermarkPlaceholder(FIXED_DATE, locale)).toMatch(/^For \[purpose\] · /);
    }
  });
});
