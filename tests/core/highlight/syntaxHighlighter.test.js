import { describe, it, expect } from 'vitest';
import {
  normalizeLanguageName,
  highlightCodeToHtml,
  highlightMarkdownCodeBlocks
} from '../../../src/core/highlight/syntaxHighlighter.js';

describe('normalizeLanguageName', () => {
  it('resolves aliases and strips prefixes', () => {
    expect(normalizeLanguageName('sh')).toBe('bash');
    expect(normalizeLanguageName('TS')).toBe('typescript');
    expect(normalizeLanguageName('language-js')).toBe('javascript');
    expect(normalizeLanguageName('js plain')).toBe('javascript');
  });

  it('passes through unknown tokens', () => {
    expect(normalizeLanguageName('cobol')).toBe('cobol');
  });
});

describe('highlightCodeToHtml', () => {
  it('HTML-escapes plaintext and unknown languages', () => {
    expect(highlightCodeToHtml('<script>x</script>', 'plaintext')).toBe(
      '&lt;script&gt;x&lt;/script&gt;'
    );
    expect(highlightCodeToHtml('<b>', 'not-a-language')).toBe('&lt;b&gt;');
  });

  it('escapes angle brackets inside highlighted known-language output', () => {
    const out = highlightCodeToHtml('const x = "<tag>";', 'javascript');
    expect(out).toContain('hljs-');
    expect(out).toContain('&lt;tag&gt;');
    expect(out).not.toContain('<tag>');
  });
});

describe('highlightMarkdownCodeBlocks', () => {
  it('highlights a known language block and escapes its content', () => {
    const root = document.createElement('div');
    root.innerHTML = '<pre><code class="language-js">const s = "&lt;script&gt;";</code></pre>';
    highlightMarkdownCodeBlocks(root);
    const code = root.querySelector('code');
    expect(code.classList.contains('hljs')).toBe(true);
    expect(code.classList.contains('language-javascript')).toBe(true);
    expect(code.dataset.language).toBe('javascript');
    expect(code.innerHTML).not.toContain('<script>');
  });
});
