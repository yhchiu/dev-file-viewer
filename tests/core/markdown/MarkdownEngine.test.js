import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownEngine } from '../../../src/core/markdown/MarkdownEngine.js';

const noopPlugins = { runAfterRender: async () => {} };

function newTarget() {
  const el = document.createElement('article');
  document.body.append(el);
  return el;
}

describe('MarkdownEngine — XSS sanitisation', () => {
  let engine;
  let target;

  beforeEach(() => {
    engine = new MarkdownEngine(noopPlugins);
    target = newTarget();
  });

  it('strips <script> tags', async () => {
    await engine.render('intro\n\n<script>window.__x = 1</script>', target);
    expect(target.querySelector('script')).toBeNull();
    expect(target.innerHTML).not.toContain('window.__x');
  });

  it('strips event-handler attributes (onerror/onload)', async () => {
    await engine.render('<img src="x" onerror="alert(1)">\n\n<svg onload="alert(1)"></svg>', target);
    expect(target.innerHTML.toLowerCase()).not.toContain('onerror');
    expect(target.innerHTML.toLowerCase()).not.toContain('onload');
  });

  it('neutralises javascript: links (markdown + raw html)', async () => {
    await engine.render('[click](javascript:alert(1))\n\n<a href="javascript:alert(2)">raw</a>', target);
    expect(target.innerHTML.toLowerCase()).not.toContain('javascript:');
  });

  it('removes <iframe> embeds', async () => {
    await engine.render('<iframe src="https://evil.example"></iframe>', target);
    expect(target.querySelector('iframe')).toBeNull();
  });
});

describe('MarkdownEngine — normal rendering', () => {
  let engine;
  let target;

  beforeEach(() => {
    engine = new MarkdownEngine(noopPlugins);
    target = newTarget();
  });

  it('renders headings, emphasis and lists', async () => {
    await engine.render('# Title\n\n**bold** text\n\n- one\n- two', target);
    expect(target.querySelector('h1')?.textContent).toBe('Title');
    expect(target.querySelector('strong')?.textContent).toBe('bold');
    expect(target.querySelectorAll('ul > li')).toHaveLength(2);
  });

  it('highlights fenced code and installs a copy button', async () => {
    await engine.render('```js\nconst x = 1;\n```', target);
    const code = target.querySelector('pre > code');
    expect(code).not.toBeNull();
    expect(code.classList.contains('hljs')).toBe(true);
    expect(target.querySelector('.markdown-code-toolbar .markdown-code-copy')).not.toBeNull();
  });

  it('resolves relative image sources against baseUrl', async () => {
    await engine.render('![alt](img/x.png)', target, { baseUrl: 'https://x.com/d/' });
    expect(target.querySelector('img')?.getAttribute('src')).toBe('https://x.com/d/img/x.png');
  });
});
