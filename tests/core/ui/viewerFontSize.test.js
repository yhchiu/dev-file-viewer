import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWER_FONT_SIZE,
  MAX_VIEWER_FONT_SIZE,
  MIN_VIEWER_FONT_SIZE,
  clampViewerFontSize,
  viewerFontSizeProgress
} from '../../../src/core/ui/viewerFontSize.js';

describe('viewer font size preference', () => {
  it('uses the same constants and clamp behavior for all viewer surfaces', () => {
    expect(DEFAULT_VIEWER_FONT_SIZE).toBe(15);
    expect(MIN_VIEWER_FONT_SIZE).toBe(12);
    expect(MAX_VIEWER_FONT_SIZE).toBe(24);
    expect(clampViewerFontSize(8)).toBe(12);
    expect(clampViewerFontSize(40)).toBe(24);
    expect(clampViewerFontSize('invalid')).toBe(15);
  });

  it('calculates slider progress across the supported range', () => {
    expect(viewerFontSizeProgress(12)).toBe(0);
    expect(viewerFontSizeProgress(18)).toBe(50);
    expect(viewerFontSizeProgress(24)).toBe(100);
  });
});
