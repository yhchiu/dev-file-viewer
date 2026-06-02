import { describe, it, expect, vi, afterEach } from 'vitest';
import { installMarkdownCodeCopyButtons } from '../../../src/core/markdown/codeCopyButtons.js';

function blockWith(className, text = 'const x = 1;') {
  const root = document.createElement('div');
  root.innerHTML = `<pre><code class="${className}">${text}</code></pre>`;
  return root;
}

function setClipboard(writeText) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
  // Drop the stubbed clipboard between tests.
  delete navigator.clipboard;
});

describe('installMarkdownCodeCopyButtons', () => {
  it('adds one copy button and is idempotent', () => {
    const root = blockWith('language-js');
    installMarkdownCodeCopyButtons(root);
    installMarkdownCodeCopyButtons(root);
    expect(root.querySelectorAll('.markdown-code-toolbar')).toHaveLength(1);
    expect(root.querySelector('.markdown-code-copy')).not.toBeNull();
  });

  it('skips mermaid blocks', () => {
    const root = blockWith('language-mermaid', 'graph TD; A-->B;');
    installMarkdownCodeCopyButtons(root);
    expect(root.querySelector('.markdown-code-toolbar')).toBeNull();
  });

  it('shows the copied state on success', async () => {
    setClipboard(vi.fn().mockResolvedValue(undefined));
    const root = blockWith('language-js');
    installMarkdownCodeCopyButtons(root);
    const button = root.querySelector('.markdown-code-copy');
    button.click();
    await vi.waitFor(() => expect(button.classList.contains('is-copied')).toBe(true));
    expect(button.getAttribute('aria-label')).toBe('Copied');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const x = 1;');
  });

  it('shows the failed state when copying rejects', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const root = blockWith('language-js');
    installMarkdownCodeCopyButtons(root);
    const button = root.querySelector('.markdown-code-copy');
    button.click();
    await vi.waitFor(() => expect(button.classList.contains('is-copy-failed')).toBe(true));
    expect(button.getAttribute('aria-label')).toBe('Copy failed');
  });
});
