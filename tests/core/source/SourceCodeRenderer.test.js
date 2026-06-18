import { describe, it, expect, beforeEach } from 'vitest';
import {
  SourceCodeRenderer,
  MAX_RENDERED_LINES
} from '../../../src/core/source/SourceCodeRenderer.js';

const ZWSP = String.fromCharCode(0x200b);

let target;
beforeEach(() => {
  target = document.createElement('div');
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
