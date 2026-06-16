import { describe, it, expect } from 'vitest';
import {
  immediateParentId,
  extractHash,
  normalizeDroppedEntryPath,
  isSupportedDroppedName,
  normalizeLinkData,
  normalizeThemePreference,
  resolveThemePreference,
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
    expect(isSupportedDroppedName('notes.txt')).toBe(true);
    expect(isSupportedDroppedName('notes.text')).toBe(true);
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
    expect(themeLabel('bloom')).toBe('Bloom (Light)');
    expect(themeLabel('forge')).toBe('Forge (Dark)');
    expect(themeLabel('folio')).toBe('Folio (Light)');
    expect(themeLabel('system')).toBe('System (Light/Dark)');
    expect(contentWidthLabel('full')).toBe('Full width');
    expect(contentWidthLabel('narrow')).toBe('Narrow');
    expect(symbolKindLabel('function')).toBe('fn');
    expect(symbolKindLabel('class')).toBe('class');
  });
});

describe('theme helpers', () => {
  it('maps legacy light/dark preferences to named themes', () => {
    expect(normalizeThemePreference('light')).toBe('bloom');
    expect(normalizeThemePreference('dark')).toBe('forge');
    expect(normalizeThemePreference('folio')).toBe('folio');
    expect(normalizeThemePreference('unknown')).toBe('system');
  });

  it('resolves system to Bloom for light mode and Forge for dark mode', () => {
    expect(resolveThemePreference('system', false)).toEqual({
      appTheme: 'bloom',
      colorScheme: 'light',
      preference: 'system'
    });
    expect(resolveThemePreference('system', true)).toEqual({
      appTheme: 'forge',
      colorScheme: 'dark',
      preference: 'system'
    });
  });
});
