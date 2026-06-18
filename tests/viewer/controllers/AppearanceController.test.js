import { describe, it, expect } from 'vitest';
import { clampViewerFontSize } from '../../../src/viewer/controllers/AppearanceController.js';

describe('clampViewerFontSize', () => {
  it('clamps to the [12, 24] range', () => {
    expect(clampViewerFontSize(8)).toBe(12);
    expect(clampViewerFontSize(40)).toBe(24);
    expect(clampViewerFontSize(12)).toBe(12);
    expect(clampViewerFontSize(24)).toBe(24);
  });

  it('rounds to the nearest integer in range', () => {
    expect(clampViewerFontSize(15.6)).toBe(16);
    expect(clampViewerFontSize(18)).toBe(18);
  });

  it('falls back to the default for non-numeric (NaN) input', () => {
    expect(clampViewerFontSize('abc')).toBe(15);
    expect(clampViewerFontSize(undefined)).toBe(15);
    expect(clampViewerFontSize({})).toBe(15);
  });
});
