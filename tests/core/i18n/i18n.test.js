import { describe, it, expect } from 'vitest';
import { t, localizeDocument } from '../../../src/core/i18n/i18n.js';

describe('t', () => {
  it('returns the resolved message', () => {
    expect(t('viewerOpenFile')).toBe('Open File');
  });

  it('substitutes positional placeholders', () => {
    expect(t('statusLoaded', ['README.md'])).toBe('Loaded README.md.');
  });

  it('falls back to the key when the message is missing', () => {
    expect(t('totallyMadeUpKey')).toBe('totallyMadeUpKey');
  });
});

describe('localizeDocument', () => {
  it('fills text and attributes from data-i18n* annotations', () => {
    const root = document.createElement('div');
    root.innerHTML = [
      '<span data-i18n="viewerOpenFile">x</span>',
      '<button data-i18n-title="a11yReloadFolder"></button>',
      '<input data-i18n-placeholder="urlPlaceholder" />',
      '<div data-i18n-aria-label="a11yCloseOutline"></div>',
      '<img data-i18n-alt="onboardingImgAlt" />'
    ].join('');

    localizeDocument(root);

    expect(root.querySelector('span').textContent).toBe('Open File');
    expect(root.querySelector('button').getAttribute('title')).toBe('Reload folder');
    expect(root.querySelector('input').getAttribute('placeholder')).toBe(
      'https://example.com/README.md'
    );
    expect(root.querySelector('div').getAttribute('aria-label')).toBe('Close outline');
    expect(root.querySelector('img').getAttribute('alt')).toContain('Dev File Viewer');
  });

  it('syncs the document language from @@ui_locale', () => {
    localizeDocument(document.createElement('div'));
    expect(document.documentElement.lang).toBe('en');
  });
});
