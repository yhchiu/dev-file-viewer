import { describe, it, expect } from 'vitest';
import {
  immediateParentId,
  extractHash,
  normalizeDroppedEntryPath,
  isSupportedDroppedName,
  normalizeLinkData,
  themeLabel,
  contentWidthLabel,
  symbolKindLabel
} from '../../src/viewer/viewerHelpers.js';

describe('immediateParentId', () => {
  it('returns the last parent id, or empty for roots/invalid', () => {
    expect(immediateParentId({ parentIds: ['a', 'b'] })).toBe('b');
    expect(immediateParentId({ parentIds: [] })).toBe('');
    expect(immediateParentId(null)).toBe('');
  });
});

describe('extractHash', () => {
  it('extracts the fragment after #', () => {
    expect(extractHash('docs/a.md#sec')).toBe('sec');
    expect(extractHash('docs/a.md')).toBe('');
  });
});

describe('normalizeDroppedEntryPath', () => {
  it('converts backslashes and strips a leading slash', () => {
    expect(normalizeDroppedEntryPath('/a\\b\\c.md')).toBe('a/b/c.md');
  });
});

describe('isSupportedDroppedName', () => {
  it('accepts known extensions and special filenames', () => {
    expect(isSupportedDroppedName('README.md')).toBe(true);
    expect(isSupportedDroppedName('Dockerfile')).toBe(true);
    expect(isSupportedDroppedName('.gitignore')).toBe(true);
    expect(isSupportedDroppedName('main.rs')).toBe(true);
  });

  it('rejects unsupported names', () => {
    expect(isSupportedDroppedName('photo.png')).toBe(false);
    expect(isSupportedDroppedName('')).toBe(false);
  });
});

describe('normalizeLinkData', () => {
  it('wraps string links and passes objects through', () => {
    expect(normalizeLinkData('http://x')).toEqual({ href: 'http://x', url: 'http://x', kind: 'absolute-document' });
    expect(normalizeLinkData({ href: 'y' })).toEqual({ href: 'y' });
    expect(normalizeLinkData(null)).toEqual({});
  });
});

describe('label helpers (i18n-backed)', () => {
  it('returns localized labels via the chrome.i18n mock', () => {
    expect(themeLabel('dark')).toBe('Dark');
    expect(themeLabel('system')).toBe('System');
    expect(contentWidthLabel('full')).toBe('Full width');
    expect(contentWidthLabel('narrow')).toBe('Narrow');
    expect(symbolKindLabel('function')).toBe('fn');
    expect(symbolKindLabel('class')).toBe('class');
  });
});
