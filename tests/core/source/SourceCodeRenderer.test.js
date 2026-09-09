import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SourceCodeRenderer,
  MAX_RENDERED_LINES
} from '../../../src/core/source/SourceCodeRenderer.js';

const ZWSP = String.fromCharCode(0x200b);

function setClipboard(writeText) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

let target;
beforeEach(() => {
  target = document.createElement('div');
});

afterEach(() => {
  delete navigator.clipboard;
});

describe('SourceCodeRenderer.render', () => {
  it('renders one .source-line per line with numbers and ids', () => {
    const result = new SourceCodeRenderer().render('const x = 1;\nconst y = 2;', target, {
      language: 'javascript'
    });
    const lines = target.querySelectorAll('.source-line');
    expect(lines).toHaveLength(2);
    expect(result.lineCount).toBe(2);
    expect(lines[0].id).toBe('L1');
    expect(lines[1].id).toBe('L2');
    expect(lines[0].querySelector('.source-line-number').textContent).toBe('1');
    expect(target.querySelector('code').className).toContain('language-javascript');
    expect(target.querySelector('code').dataset.language).toBe('javascript');
  });

  it('omits data-language for plaintext so the format badge stays hidden', () => {
    new SourceCodeRenderer().render('hello', target, { language: 'plaintext' });
    expect(target.querySelector('code').dataset.language).toBeUndefined();
  });

  it('puts a language pill and copy button in the source toolbar', () => {
    new SourceCodeRenderer().render('const x = 1;', target, { language: 'javascript' });

    const toolbar = target.querySelector('.markdown-code-toolbar');
    const language = toolbar.querySelector('.markdown-code-language');
    const copy = toolbar.querySelector('.markdown-code-copy');

    expect(toolbar).not.toBeNull();
    expect(target.querySelector('pre').classList.contains('has-code-copy-button')).toBe(true);
    expect(language.textContent).toBe('JAVASCRIPT');
    expect(language.hidden).toBe(false);
    expect(copy).not.toBeNull();
    expect(copy.getAttribute('aria-label')).toBe('Copy code');
    expect([...toolbar.children]).toEqual([language, copy]);
  });

  it('hides the language pill for plaintext but still offers copy', () => {
    new SourceCodeRenderer().render('hello', target, { language: 'plaintext' });

    const language = target.querySelector('.markdown-code-language');
    expect(target.querySelector('.markdown-code-copy')).not.toBeNull();
    expect(language.hidden).toBe(true);
    expect(language.textContent).toBe('');
  });

  it('copies the original source without line numbers', async () => {
    const source = 'const x = 1;\nconst y = 2;';
    setClipboard(vi.fn().mockResolvedValue(undefined));
    new SourceCodeRenderer().render(source, target, { language: 'javascript' });

    target.querySelector('.markdown-code-copy').click();
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(source));
    expect(navigator.clipboard.writeText.mock.calls[0][0]).not.toMatch(/1const/);
  });

  it('copies the full original source when the view is truncated', async () => {
    const source = Array.from({ length: 15 }, (_, i) => `line ${i}`).join('\n');
    setClipboard(vi.fn().mockResolvedValue(undefined));
    new SourceCodeRenderer().render(source, target, { language: 'javascript', maxLines: 10 });

    target.querySelector('.markdown-code-copy').click();
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(source));
  });

  it('keeps CRLF when copying', async () => {
    const source = 'a\r\nb';
    setClipboard(vi.fn().mockResolvedValue(undefined));
    new SourceCodeRenderer().render(source, target, { language: 'plaintext' });

    target.querySelector('.markdown-code-copy').click();
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(source));
  });

  it('HTML-escapes plaintext content', () => {
    new SourceCodeRenderer().render('<script>alert(1)</script>', target, { language: 'plaintext' });
    const codeCell = target.querySelector('.source-line-code');
    expect(codeCell.innerHTML).toContain('&lt;script&gt;');
    expect(codeCell.querySelector('script')).toBeNull();
  });

  it('normalises CRLF and uses a zero-width space for empty lines', () => {
    new SourceCodeRenderer().render('a\r\nb', target, { language: 'plaintext' });
    expect(target.querySelectorAll('.source-line')).toHaveLength(2);

    const empty = document.createElement('div');
    new SourceCodeRenderer().render('', empty, { language: 'plaintext' });
    expect(empty.querySelector('.source-line-code').innerHTML).toBe(ZWSP);
  });

  it('caps rendered lines and shows a notice for very large files', () => {
    // Exercise the cap with a small override so the test does not build 200k nodes.
    const total = 15;
    const source = Array.from({ length: total }, (_, i) => `line ${i}`).join('\n');

    const result = new SourceCodeRenderer().render(source, target, {
      language: 'plaintext',
      maxLines: 10
    });

    expect(target.querySelectorAll('.source-line')).toHaveLength(10);
    expect(result.lineCount).toBe(total);

    const notice = target.querySelector('.source-truncated-notice');
    expect(notice).not.toBeNull();
    expect(notice.textContent).toContain('10');
    expect(notice.textContent).toContain(String(total));
  });

  it('exposes a sane default line cap', () => {
    expect(MAX_RENDERED_LINES).toBeGreaterThanOrEqual(10000);
  });

  it('does not show a notice when under the cap', () => {
    new SourceCodeRenderer().render('a\nb\nc', target, { language: 'plaintext' });
    expect(target.querySelector('.source-truncated-notice')).toBeNull();
  });
});
