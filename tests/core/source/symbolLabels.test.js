import { describe, it, expect } from 'vitest';
import { symbolKindLabel } from '../../../src/core/source/symbolLabels.js';

describe('symbolKindLabel', () => {
  it('returns localized labels via the chrome.i18n mock', () => {
    expect(symbolKindLabel('function')).toBe('fn');
    expect(symbolKindLabel('class')).toBe('class');
    expect(symbolKindLabel('method')).toBe('meth');
  });

  it('falls back to the generic label for unknown kinds', () => {
    expect(symbolKindLabel('unknown-kind')).toBe(symbolKindLabel(undefined));
  });
});
