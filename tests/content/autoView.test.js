import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAutoView } from '../../src/content/autoView.js';

function memorySession() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function rawPage(text = '# Hello') {
  document.body.innerHTML = `<pre>${text}</pre>`;
  document.title = 'README';
}

describe('runAutoView', () => {
  beforeEach(() => {
    chrome.runtime.lastError = null;
    chrome.runtime.sendMessage = vi.fn((message, callback) => callback({ ok: true }));
    chrome.storage.onChanged = { addListener: vi.fn() };
  });

  afterEach(() => {
    document.body.textContent = '';
    delete chrome.runtime.sendMessage;
    delete chrome.storage.onChanged;
  });

  it('uses the Full Viewer by default', async () => {
    rawPage();
    const result = await runAutoView({
      location: { href: 'https://example.com/README.md', protocol: 'https:' },
      sessionStorage: memorySession(),
      storageArea: { get: vi.fn(async () => ({})) }
    });

    expect(result).toBe('full-viewer');
    expect(document.querySelector('[data-dfv-inline-root]')).toBeNull();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OPEN_VIEWER_FOR_SNAPSHOT',
        disposition: 'current-tab'
      }),
      expect.any(Function)
    );
  });

  it('is idempotent when the content script runs again on an inline page', async () => {
    rawPage();
    const options = {
      location: { href: 'https://example.com/README.md', protocol: 'https:' },
      sessionStorage: memorySession(),
      storageArea: {
        get: vi.fn(async () => ({
          'devFileViewer:autoOpen': { enabled: true, inlinePreview: true, disabled: [] }
        }))
      }
    };

    await runAutoView(options);
    const result = await runAutoView(options);

    expect(result).toBe('inline');
    expect(document.querySelectorAll('[data-dfv-inline-root]')).toHaveLength(1);
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('uses Inline Preview when explicitly enabled', async () => {
    rawPage();
    const result = await runAutoView({
      location: { href: 'https://example.com/README.md', protocol: 'https:' },
      sessionStorage: memorySession(),
      storageArea: {
        get: vi.fn(async () => ({
          'devFileViewer:autoOpen': { enabled: true, inlinePreview: true, disabled: [] }
        }))
      }
    });

    expect(result).toBe('inline');
    expect(document.querySelector('[data-dfv-inline-root]')).not.toBeNull();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('does nothing when the matched file type is disabled', async () => {
    rawPage();
    const result = await runAutoView({
      location: { href: 'file:///tmp/README.md', protocol: 'file:' },
      sessionStorage: memorySession(),
      storageArea: {
        get: vi.fn(async () => ({
          'devFileViewer:autoOpen': { enabled: true, inlinePreview: true, disabled: ['.md'] }
        }))
      }
    });

    expect(result).toBe('ignored');
    expect(document.querySelector('[data-dfv-inline-root]')).toBeNull();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
