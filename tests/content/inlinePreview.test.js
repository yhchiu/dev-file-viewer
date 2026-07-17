import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INLINE_ROOT_SELECTOR,
  findRawSourceElement,
  renderInlinePreview
} from '../../src/content/inlinePreview.js';
import { VIEWER_FONT_SIZE_KEY } from '../../src/core/ui/viewerFontSize.js';

let storageChangeListener = null;

function setRawDocument(text, extra = '') {
  document.body.innerHTML = `<pre>${text}</pre>${extra}`;
  document.title = 'README';
}

describe('Inline Preview', () => {
  beforeEach(() => {
    chrome.runtime.lastError = null;
    chrome.runtime.sendMessage = vi.fn((message, callback) => callback({ ok: true }));
    chrome.storage.local.get = vi.fn(async () => ({}));
    chrome.storage.local.set = vi.fn(async () => {});
    storageChangeListener = null;
    chrome.storage.onChanged = {
      addListener: vi.fn(listener => {
        storageChangeListener = listener;
      })
    };
  });

  afterEach(() => {
    document.body.textContent = '';
    delete chrome.runtime.sendMessage;
    delete chrome.storage.onChanged;
  });

  it('finds the raw PRE without removing unrelated extension DOM', () => {
    setRawDocument('# Hello', '<div id="other-extension-ui">Translate</div>');
    const source = findRawSourceElement();

    expect(source.tagName).toBe('PRE');
    expect(document.querySelector('#other-extension-ui')).not.toBeNull();
  });

  it('renders Markdown in Light DOM and keeps supported links as normal navigation', async () => {
    setRawDocument('# Hello\n\n[Next](docs/next.md)');
    const source = document.querySelector('pre');

    await renderInlinePreview({
      url: 'https://example.com/project/README.md',
      title: 'README',
      mimeType: 'text/plain',
      text: source.textContent
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    const link = root.querySelector('.dfv-inline-preview a');
    expect(source.hidden).toBe(true);
    expect(root.getRootNode()).toBe(document);
    expect(root.querySelector('h1').textContent).toBe('Hello');
    expect(link.href).toBe('https://example.com/project/docs/next.md');

    expect(link.hasAttribute('target')).toBe(false);
  });

  it('toggles Markdown between preview and source', async () => {
    setRawDocument('# Hello');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Hello'
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    root.querySelector('[data-dfv-action="toggle-source"]').click();
    await Promise.resolve();

    expect(root.querySelector('.source-code-lines')).not.toBeNull();
    expect(root.querySelector('[data-dfv-action="toggle-source"]').textContent).toBe(
      'Show preview'
    );
  });

  it('builds an outline popup from Markdown headings', async () => {
    setRawDocument('# Intro\n\n## Install\n\n### Windows');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Intro\n\n## Install\n\n### Windows'
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    const toggle = root.querySelector('[data-dfv-action="toggle-outline"]');
    const popover = root.querySelector('.dfv-inline-outline-popover');
    const items = [...root.querySelectorAll('.dfv-inline-outline-item')];

    expect(toggle.hidden).toBe(false);
    expect(toggle.disabled).toBe(false);
    expect(toggle.textContent).toBe('Outline');
    expect(items.map(item => item.textContent)).toEqual(['Intro', 'Install', 'Windows']);
    expect(items.map(item => item.getAttribute('href'))).toEqual([
      '#intro',
      '#install',
      '#windows'
    ]);
    expect(items[1].style.getPropertyValue('--dfv-inline-outline-indent')).toBe('14px');

    toggle.click();
    expect(popover.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('hides the outline control when Markdown has no headings', async () => {
    setRawDocument('Paragraph only.');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: 'Paragraph only.'
    });

    const toggle = document.querySelector('[data-dfv-action="toggle-outline"]');
    expect(toggle.hidden).toBe(true);
    expect(toggle.disabled).toBe(true);
    expect(document.querySelectorAll('.dfv-inline-outline-item')).toHaveLength(0);
  });

  it('closes the outline popup with Escape and restores focus', async () => {
    setRawDocument('# Intro\n\n## Install');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Intro\n\n## Install'
    });

    const toggle = document.querySelector('[data-dfv-action="toggle-outline"]');
    const popover = document.querySelector('.dfv-inline-outline-popover');

    toggle.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(popover.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('scrolls to an outline heading, marks it active, and closes the popup', async () => {
    setRawDocument('# Intro\n\n## Install');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Intro\n\n## Install'
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    const toggle = root.querySelector('[data-dfv-action="toggle-outline"]');
    const popover = root.querySelector('.dfv-inline-outline-popover');
    const installHeading = root.querySelector('#install');
    const installItem = root.querySelector('[data-heading-id="install"]');
    installHeading.scrollIntoView = vi.fn();

    toggle.click();
    installItem.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    );

    expect(installHeading.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(installItem.classList.contains('is-active')).toBe(true);
    expect(installItem.getAttribute('aria-current')).toBe('location');
    expect(popover.hidden).toBe(true);
  });

  it('removes the outline in source mode and rebuilds it in preview mode', async () => {
    setRawDocument('# Intro\n\n## Install');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Intro\n\n## Install'
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    const sourceToggle = root.querySelector('[data-dfv-action="toggle-source"]');
    const outlineToggle = root.querySelector('[data-dfv-action="toggle-outline"]');

    sourceToggle.click();
    await vi.waitFor(() => expect(root.querySelector('.source-code-lines')).not.toBeNull());
    expect(outlineToggle.hidden).toBe(true);
    expect(root.querySelectorAll('.dfv-inline-outline-item')).toHaveLength(0);

    sourceToggle.click();
    await vi.waitFor(() => expect(root.querySelector('#install')).not.toBeNull());
    expect(outlineToggle.hidden).toBe(false);
    expect(root.querySelectorAll('.dfv-inline-outline-item')).toHaveLength(2);
  });

  it('keeps the outline and text size popovers mutually exclusive', async () => {
    setRawDocument('# Intro');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Intro'
    });

    const outlineToggle = document.querySelector('[data-dfv-action="toggle-outline"]');
    const outlinePopover = document.querySelector('.dfv-inline-outline-popover');
    const textSizeToggle = document.querySelector('[data-dfv-action="toggle-text-size"]');
    const textSizePopover = document.querySelector('.dfv-inline-text-size-popover');

    outlineToggle.click();
    expect(outlinePopover.hidden).toBe(false);

    textSizeToggle.click();
    expect(outlinePopover.hidden).toBe(true);
    expect(textSizePopover.hidden).toBe(false);

    outlineToggle.click();
    expect(textSizePopover.hidden).toBe(true);
    expect(outlinePopover.hidden).toBe(false);
  });

  it('updates the active outline item as the document scrolls', async () => {
    setRawDocument('# Intro\n\n## Install');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Intro\n\n## Install'
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    const toolbar = root.querySelector('.dfv-inline-toolbar');
    const intro = root.querySelector('#intro');
    const install = root.querySelector('#install');
    toolbar.getBoundingClientRect = vi.fn(() => ({ bottom: 60 }));
    intro.getBoundingClientRect = vi.fn(() => ({ top: -20 }));
    install.getBoundingClientRect = vi.fn(() => ({ top: 120 }));

    globalThis.dispatchEvent(new Event('scroll'));
    await vi.waitFor(() => {
      expect(root.querySelector('[data-heading-id="intro"]').getAttribute('aria-current')).toBe(
        'location'
      );
    });

    install.getBoundingClientRect = vi.fn(() => ({ top: 70 }));
    globalThis.dispatchEvent(new Event('scroll'));
    await vi.waitFor(() => {
      expect(root.querySelector('[data-heading-id="install"]').getAttribute('aria-current')).toBe(
        'location'
      );
    });
  });

  it('restores the shared text size preference in the toolbar and preview', async () => {
    chrome.storage.local.get = vi.fn(async () => ({ [VIEWER_FONT_SIZE_KEY]: 18 }));
    setRawDocument('# Hello');

    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Hello'
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    const range = root.querySelector('.dfv-inline-text-size-range');
    const input = root.querySelector('.dfv-inline-text-size-input');

    expect(root.querySelector('[data-dfv-action="toggle-text-size"]').textContent).toBe(
      'Text size'
    );
    expect(root.style.getPropertyValue('--dfv-inline-font-size')).toBe('18px');
    expect(range.value).toBe('18');
    expect(range.style.getPropertyValue('--dfv-inline-font-size-progress')).toBe('50%');
    expect(input.value).toBe('18');
  });

  it('opens the text size popover and closes it with Escape', async () => {
    setRawDocument('# Hello');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Hello'
    });

    const toggle = document.querySelector('[data-dfv-action="toggle-text-size"]');
    const popover = document.querySelector('.dfv-inline-text-size-popover');

    toggle.click();
    expect(popover.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(popover.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('previews range changes immediately and persists only on change', async () => {
    setRawDocument('# Hello');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Hello'
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    const heading = root.querySelector('h1');
    const range = root.querySelector('.dfv-inline-text-size-range');
    const input = root.querySelector('.dfv-inline-text-size-input');

    range.value = '20';
    range.dispatchEvent(new Event('input', { bubbles: true }));

    expect(root.style.getPropertyValue('--dfv-inline-font-size')).toBe('20px');
    expect(input.value).toBe('20');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(root.querySelector('h1')).toBe(heading);

    range.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ [VIEWER_FONT_SIZE_KEY]: 20 });
    });
  });

  it('clamps a typed text size before applying and persisting it', async () => {
    setRawDocument('# Hello');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Hello'
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    const range = root.querySelector('.dfv-inline-text-size-range');
    const input = root.querySelector('.dfv-inline-text-size-input');

    input.value = '40';
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ [VIEWER_FONT_SIZE_KEY]: 24 });
    });
    expect(root.style.getPropertyValue('--dfv-inline-font-size')).toBe('24px');
    expect(range.value).toBe('24');
    expect(input.value).toBe('24');
  });

  it('syncs the text size controls when the Full Viewer changes the shared preference', async () => {
    setRawDocument('# Hello');
    await renderInlinePreview({
      url: 'file:///tmp/README.md',
      mimeType: 'text/plain',
      text: '# Hello'
    });

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    storageChangeListener({ [VIEWER_FONT_SIZE_KEY]: { oldValue: 15, newValue: 19 } }, 'local');

    expect(root.style.getPropertyValue('--dfv-inline-font-size')).toBe('19px');
    expect(root.querySelector('.dfv-inline-text-size-range').value).toBe('19');
    expect(root.querySelector('.dfv-inline-text-size-input').value).toBe('19');
  });

  it('renders Mermaid blocks through the lazy Inline Mermaid client', async () => {
    const inlineMermaid = {
      render: vi.fn(async root => {
        const code = root.querySelector('pre > code.language-mermaid');
        const diagram = document.createElement('div');
        diagram.className = 'mermaid';
        diagram.innerHTML = '<svg aria-label="diagram"></svg>';
        code.closest('pre').replaceWith(diagram);
        return { requested: true, rendered: 1, failed: 0 };
      })
    };
    setRawDocument('```mermaid\ngraph TD; A-->B;\n```');

    await renderInlinePreview(
      {
        url: 'file:///tmp/README.md',
        mimeType: 'text/plain',
        text: '```mermaid\ngraph TD; A-->B;\n```'
      },
      { inlineMermaid }
    );

    const root = document.querySelector(INLINE_ROOT_SELECTOR);
    expect(inlineMermaid.render).toHaveBeenCalledTimes(1);
    expect(inlineMermaid.render).toHaveBeenCalledWith(root.querySelector('[data-dfv-preview]'));
    expect(root.querySelector('.mermaid svg')).not.toBeNull();
    expect(root.querySelector('pre > code.language-mermaid')).toBeNull();
  });

  it('loads Mermaid again when returning from source to preview without using it in source mode', async () => {
    const inlineMermaid = { render: vi.fn(async () => ({ requested: true })) };
    setRawDocument('```mermaid\ngraph TD; A-->B;\n```');

    await renderInlinePreview(
      {
        url: 'file:///tmp/README.md',
        mimeType: 'text/plain',
        text: '```mermaid\ngraph TD; A-->B;\n```'
      },
      { inlineMermaid }
    );

    const toggle = document.querySelector('[data-dfv-action="toggle-source"]');
    expect(inlineMermaid.render).toHaveBeenCalledTimes(1);

    toggle.click();
    await vi.waitFor(() => expect(document.querySelector('.source-code-lines')).not.toBeNull());
    expect(inlineMermaid.render).toHaveBeenCalledTimes(1);

    toggle.click();
    await vi.waitFor(() => expect(inlineMermaid.render).toHaveBeenCalledTimes(2));
  });

  it('keeps the Markdown preview usable when lazy Mermaid injection fails', async () => {
    const inlineMermaid = { render: vi.fn(async () => Promise.reject(new Error('blocked'))) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setRawDocument('# Diagram\n\n```mermaid\ngraph TD; A-->B;\n```');

    await renderInlinePreview(
      {
        url: 'file:///tmp/README.md',
        mimeType: 'text/plain',
        text: '# Diagram\n\n```mermaid\ngraph TD; A-->B;\n```'
      },
      { inlineMermaid }
    );

    expect(document.querySelector('#diagram')).not.toBeNull();
    expect(document.querySelector('pre > code.language-mermaid')).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      'Dev File Viewer could not render Mermaid diagrams:',
      expect.any(Error)
    );
    warn.mockRestore();
  });

  it('opens the same snapshot in a new Full Viewer tab', async () => {
    setRawDocument('# Hello');
    await renderInlinePreview({
      url: 'https://example.com/README.md',
      title: 'README',
      mimeType: 'text/plain',
      text: '# Hello'
    });

    document.querySelector('[data-dfv-action="open-full-viewer"]').click();
    await Promise.resolve();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OPEN_VIEWER_FOR_SNAPSHOT',
        disposition: 'new-tab',
        url: 'https://example.com/README.md',
        text: '# Hello'
      }),
      expect.any(Function)
    );
  });
});
