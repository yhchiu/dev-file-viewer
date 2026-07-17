import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  inlinePreviewMessage,
  localizeInlinePreviewDocument
} from '../../../src/core/i18n/inlinePreviewI18n.js';

const originalGetMessage = chrome.i18n.getMessage;

afterEach(() => {
  chrome.i18n.getMessage = originalGetMessage;
  document.body.textContent = '';
});

describe('Inline Preview i18n', () => {
  it('uses English by default and substitutes positional values', () => {
    expect(inlinePreviewMessage('inlineShowSource')).toBe('Show source');
    expect(inlinePreviewMessage('inlineOutline')).toBe('Outline');
    expect(inlinePreviewMessage('inlineTextSize')).toBe('Text size');
    expect(inlinePreviewMessage('inlineOpenFullViewerFailed', ['Denied'])).toBe(
      'Could not open the full viewer: Denied'
    );
  });

  it('uses Traditional Chinese for the zh-TW UI locale', () => {
    chrome.i18n.getMessage = vi.fn(key => (key === '@@ui_locale' ? 'zh-TW' : ''));

    expect(inlinePreviewMessage('inlineOpenFullViewer')).toBe('在完整 Viewer 開啟');
  });

  it('localizes annotated settings elements without modifying the main catalog', () => {
    document.body.innerHTML = '<span data-inline-preview-i18n="inlinePreviewLabel">fallback</span>';

    localizeInlinePreviewDocument();

    expect(document.body.textContent).toBe('Use Inline Preview');
  });
});
